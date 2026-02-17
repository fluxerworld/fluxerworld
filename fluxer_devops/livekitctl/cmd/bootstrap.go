/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/constants"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/dnswait"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/firewall"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/install"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/netutil"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/ops"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/platform"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/secrets"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/state"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/validate"
)

var bootstrapCmd = &cobra.Command{
	Use:   "bootstrap",
	Short: "Install and configure LiveKit, Caddy (l4), coturn, and KV store",
	Run:   runBootstrap,
}

var (
	livekitDomain     string
	turnDomain        string
	email             string
	livekitVersion    string
	caddyVersion      string
	caddyL4Version    string
	xcaddyVersion     string
	installDir        string
	enableFirewall    bool
	kvPort            int
	kvPortAuto        bool
	webhookURLs       []string
	webhookURLsFile   string
	allowHTTPWebhooks bool
	dnsTimeout        int
	dnsInterval       int
	printSecrets      bool
)

func init() {
	rootCmd.AddCommand(bootstrapCmd)

	bootstrapCmd.Flags().StringVar(&livekitDomain, "livekit-domain", "", "LiveKit domain (required)")
	bootstrapCmd.Flags().StringVar(&turnDomain, "turn-domain", "", "TURN domain (required)")
	bootstrapCmd.Flags().StringVar(&email, "email", "", "ACME email (required)")

	bootstrapCmd.Flags().StringVar(&livekitVersion, "livekit-version", constants.DefaultLiveKitVersion, "LiveKit version")
	bootstrapCmd.Flags().StringVar(&caddyVersion, "caddy-version", constants.DefaultCaddyVersion, "Caddy version")
	bootstrapCmd.Flags().StringVar(&caddyL4Version, "caddy-l4-version", constants.DefaultCaddyL4Version, "Caddy L4 version")
	bootstrapCmd.Flags().StringVar(&xcaddyVersion, "xcaddy-version", constants.DefaultXcaddyVersion, "xcaddy version")

	bootstrapCmd.Flags().StringVar(&installDir, "install-dir", "", "Override LiveKit install dir (default: /opt/livekit)")
	bootstrapCmd.Flags().BoolVar(&enableFirewall, "firewall", false, "Configure detected firewall tool")
	bootstrapCmd.Flags().IntVar(&kvPort, "kv-port", 0, "KV port (default: 6379)")
	bootstrapCmd.Flags().BoolVar(&kvPortAuto, "kv-port-auto", false, "Pick a free KV port from 6379-6382")
	bootstrapCmd.Flags().StringArrayVar(&webhookURLs, "webhook-url", nil, "Webhook URL (repeatable)")
	bootstrapCmd.Flags().StringVar(&webhookURLsFile, "webhook-urls-file", "", "File with webhook URLs (one per line)")
	bootstrapCmd.Flags().BoolVar(&allowHTTPWebhooks, "allow-http-webhooks", false, "Allow http:// webhook URLs")

	bootstrapCmd.Flags().IntVar(&dnsTimeout, "dns-timeout", 900, "DNS wait timeout in seconds")
	bootstrapCmd.Flags().IntVar(&dnsInterval, "dns-interval", 10, "DNS check interval in seconds")

	bootstrapCmd.Flags().BoolVar(&printSecrets, "print-secrets", false, "Print secrets JSON to stdout")

	bootstrapCmd.MarkFlagRequired("livekit-domain")
	bootstrapCmd.MarkFlagRequired("turn-domain")
	bootstrapCmd.MarkFlagRequired("email")
}

func runBootstrap(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	livekitDomainValidated, err := validate.RequireDomain(livekitDomain, "livekit domain")
	exitOnError(err)

	turnDomainValidated, err := validate.RequireDomain(turnDomain, "turn domain")
	exitOnError(err)

	acmeEmail, err := validate.RequireEmail(email)
	exitOnError(err)

	ports := constants.DefaultPorts()
	if kvPort > 0 {
		ports.KVPort = kvPort
	}

	livekitVersionValidated, err := validate.NormaliseVersionTag(livekitVersion)
	exitOnError(err)

	caddyVersionValidated, err := validate.NormaliseVersionTag(caddyVersion)
	exitOnError(err)

	caddyL4VersionValidated, err := validate.NormaliseVersionTag(caddyL4Version)
	exitOnError(err)

	xcaddyVersionValidated, err := validate.NormaliseVersionTag(xcaddyVersion)
	exitOnError(err)

	var webhooks []string
	for _, u := range webhookURLs {
		validated, err := validate.RequireWebhookURL(u, allowHTTPWebhooks)
		exitOnError(err)
		webhooks = append(webhooks, validated)
	}

	if webhookURLsFile != "" {
		lines, err := ops.ReadLinesFile(webhookURLsFile)
		exitOnError(err)
		for _, u := range lines {
			validated, err := validate.RequireWebhookURL(u, allowHTTPWebhooks)
			exitOnError(err)
			webhooks = append(webhooks, validated)
		}
	}

	pm := platform.DetectPackageManager()
	if pm == nil {
		exitOnError(errors.NewPlatformError("No supported package manager detected."))
	}

	exitOnError(install.InstallBasePackages(pm))
	exitOnError(install.EnsureUsers())

	kvBin, err := install.InstallKVBinary(pm)
	exitOnError(err)

	paths := state.DefaultPaths()
	if installDir != "" {
		paths.LiveKitInstallDir = installDir
		paths.LiveKitBinDir = filepath.Join(installDir, "bin")
	}

	if kvPortAuto {
		for _, cand := range []int{6379, 6380, 6381, 6382} {
			output, exitCode := util.RunCaptureNoCheck([]string{"bash", "-lc", fmt.Sprintf("ss -lnt | awk '{print $4}' | grep -q ':%d$'", cand)})
			_ = output
			if exitCode != 0 {
				ports.KVPort = cand
				break
			}
		}
	}

	fwTool := firewall.DetectFirewallTool()
	firewallCfg := state.FirewallConfig{Enabled: enableFirewall, Tool: fwTool.Name}

	st := state.NewState(state.NewStateParams{
		ACMEEmail: acmeEmail,
		Domains: state.Domains{
			LiveKit: livekitDomainValidated,
			TURN:    turnDomainValidated,
		},
		Ports: ports,
		Versions: state.Versions{
			LiveKit: livekitVersionValidated,
			Caddy:   caddyVersionValidated,
			CaddyL4: caddyL4VersionValidated,
			Xcaddy:  xcaddyVersionValidated,
		},
		KV: state.KVConfig{
			BindHost: ports.KVBindHost,
			Port:     ports.KVPort,
		},
		Webhooks: webhooks,
		Firewall: firewallCfg,
		Paths:    &paths,
	})

	exitOnError(os.MkdirAll(st.Paths.ConfigDir, 0755))

	sec := secrets.GenerateNewSecrets()
	exitOnError(ops.SaveSecrets(st, sec))

	pub4 := netutil.DetectPublicIP("4")
	if pub4 == "" {
		exitOnError(errors.NewPlatformError("Could not detect public IPv4."))
	}

	var pub6 string
	if netutil.HasGlobalIPv6() {
		pub6 = netutil.DetectPublicIP("6")
	}

	priv4 := netutil.PrimaryPrivateIPv4()

	util.Log("")
	util.Log("DNS records needed before TLS issuance:")
	util.Logf("A   %s -> %s", livekitDomainValidated, pub4)
	util.Logf("A   %s -> %s", turnDomainValidated, pub4)
	if pub6 != "" {
		util.Logf("AAAA %s -> %s", livekitDomainValidated, pub6)
		util.Logf("AAAA %s -> %s", turnDomainValidated, pub6)
	}
	util.Log("")

	okDNS := dnswait.WaitForDNS(livekitDomainValidated, turnDomainValidated, pub4, pub6, dnsTimeout, dnsInterval)
	if !okDNS {
		util.Log("DNS not verified yet. Continuing. ACME may fail until DNS is correct.")
	}

	_, err = install.InstallLiveKitBinary(livekitVersionValidated, st.Paths.LiveKitInstallDir, "")
	exitOnError(err)

	exitOnError(install.EnsureCaddyWithL4(
		"/tmp/livekitctl-caddy-build",
		caddyVersionValidated,
		caddyL4VersionValidated,
		xcaddyVersionValidated,
		st.Paths.CaddyBin,
	))

	exitOnError(state.SaveState(st))

	ops.StopConflictingServices()
	exitOnError(ops.ApplyConfigAndRestart(st, kvBin, pub4, priv4))

	if st.Firewall.Enabled {
		msg, err := ops.ConfigureFirewallFromState(st)
		exitOnError(err)
		util.Log(msg)
	}

	util.Log("")
	util.Log("Bootstrap completed.")
	util.Log("")
	util.Log("State:")
	util.Logf("  %s", st.Paths.StatePath)
	util.Log("Secrets:")
	util.Logf("  %s", st.Paths.SecretsPath)
	util.Log("")

	if printSecrets {
		data, err := os.ReadFile(st.Paths.SecretsPath)
		if err == nil {
			util.Log("Secrets JSON:")
			util.Log(strings.TrimSpace(string(data)))
			util.Log("")
		}
	}

	util.Log(ops.RunBasicHealthChecks(st))
}
