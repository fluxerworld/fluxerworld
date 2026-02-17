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

package ops

import (
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/configgen"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/firewall"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/netutil"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/platform"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/secrets"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/state"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/validate"
)

func secretsPath(st *state.BootstrapState) string {
	return st.Paths.SecretsPath
}

func LoadSecrets(st *state.BootstrapState) (*secrets.Secrets, error) {
	var sec secrets.Secrets
	if err := util.ReadJSON(secretsPath(st), &sec); err != nil {
		return nil, err
	}
	if sec.LiveKitAPIKey == "" {
		return nil, errors.NewPlatformError("Secrets file not found. Was bootstrap completed?")
	}
	return &sec, nil
}

func SaveSecrets(st *state.BootstrapState, sec *secrets.Secrets) error {
	return util.WriteJSON(secretsPath(st), sec, 0600, -1, -1)
}

func StatePathDefault() string {
	return state.DefaultPaths().StatePath
}

func EnsureLinuxRoot() error {
	if !platform.IsLinux() {
		return errors.NewPlatformError("This operation is only supported on Linux hosts.")
	}
	return platform.RequireRoot()
}

func ApplyConfigAndRestart(st *state.BootstrapState, kvBin, publicIPv4, privateIPv4 string) error {
	sec, err := LoadSecrets(st)
	if err != nil {
		return err
	}

	if err := configgen.WriteAllConfigs(configgen.WriteAllConfigsParams{
		State:       st,
		Secrets:     sec,
		PublicIPv4:  publicIPv4,
		PrivateIPv4: privateIPv4,
		KVBin:       kvBin,
	}); err != nil {
		return err
	}

	sm := platform.DetectServiceManager()
	if !sm.IsSystemd() {
		return errors.NewPlatformError("systemd is required for managed services on this host.")
	}

	sm.DaemonReload()

	sm.Enable("livekit-kv.service")
	sm.Enable("livekit-coturn.service")
	sm.Enable("livekit.service")
	sm.Enable("caddy.service")

	sm.Restart("livekit-kv.service")
	sm.Restart("livekit-coturn.service")
	sm.Restart("livekit.service")
	sm.Restart("caddy.service")

	return nil
}

func OpStatus(st *state.BootstrapState) string {
	sm := platform.DetectServiceManager()
	if !sm.IsSystemd() {
		return "systemd not detected."
	}

	var parts []string
	for _, svc := range []string{"livekit-kv.service", "livekit-coturn.service", "livekit.service", "caddy.service"} {
		parts = append(parts, sm.Status(svc))
	}
	return strings.TrimSpace(strings.Join(parts, "\n\n"))
}

func OpLogs(st *state.BootstrapState, service string, lines int) string {
	sm := platform.DetectServiceManager()
	if !sm.IsSystemd() {
		return "systemd not detected."
	}
	return sm.Logs(service, lines)
}

func OpRestart(services []string) error {
	sm := platform.DetectServiceManager()
	if !sm.IsSystemd() {
		return errors.NewPlatformError("systemd not detected.")
	}
	for _, s := range services {
		sm.Restart(s)
	}
	return nil
}

func WebhookList(st *state.BootstrapState) []string {
	return st.Webhooks
}

func WebhookAdd(st *state.BootstrapState, url string, allowHTTP bool) (bool, error) {
	u, err := validate.RequireWebhookURL(url, allowHTTP)
	if err != nil {
		return false, err
	}

	for _, existing := range st.Webhooks {
		if existing == u {
			return false, nil
		}
	}

	st.Webhooks = append(st.Webhooks, u)
	sort.Strings(st.Webhooks)
	st.Touch()
	return true, state.SaveState(st)
}

func WebhookRemove(st *state.BootstrapState, url string) (bool, error) {
	found := false
	var newList []string
	for _, existing := range st.Webhooks {
		if existing == url {
			found = true
		} else {
			newList = append(newList, existing)
		}
	}

	if !found {
		return false, nil
	}

	st.Webhooks = newList
	st.Touch()
	return true, state.SaveState(st)
}

func WebhookSet(st *state.BootstrapState, urls []string, allowHTTP bool) error {
	var cleaned []string
	seen := make(map[string]bool)

	for _, u := range urls {
		validated, err := validate.RequireWebhookURL(u, allowHTTP)
		if err != nil {
			return err
		}
		if !seen[validated] {
			seen[validated] = true
			cleaned = append(cleaned, validated)
		}
	}

	sort.Strings(cleaned)
	st.Webhooks = cleaned
	st.Touch()
	return state.SaveState(st)
}

func RunBasicHealthChecks(st *state.BootstrapState) string {
	var out []string
	out = append(out, "Listening sockets:")

	result, _ := util.Run([]string{"ss", "-lntup"}, util.RunOptions{Check: false, Capture: true})
	if result != nil {
		out = append(out, strings.TrimSpace(result.Output))
	}

	result2, _ := util.Run([]string{"curl", "-fsS", fmt.Sprintf("http://127.0.0.1:%d/", st.Ports.LiveKitHTTPLocal)}, util.RunOptions{Check: false, Capture: true})
	if result2 != nil && result2.ExitCode == 0 {
		out = append(out, "LiveKit local HTTP reachable.")
	} else {
		out = append(out, "LiveKit local HTTP not reachable.")
	}

	return strings.TrimSpace(strings.Join(out, "\n"))
}

func EnsureStateLoadedOrFail(path string) (*state.BootstrapState, error) {
	if path == "" {
		path = StatePathDefault()
	}

	st, err := state.LoadState(path)
	if err != nil {
		return nil, err
	}
	if st == nil {
		return nil, errors.NewPlatformErrorf("State file not found: %s", path)
	}
	return st, nil
}

func ConfigureFirewallFromState(st *state.BootstrapState) (string, error) {
	tool := firewall.DetectFirewallTool()
	msg := firewall.ConfigureFirewall(tool, st.Ports, st.Firewall.Enabled)
	st.Firewall.Tool = tool.Name
	st.Touch()
	if err := state.SaveState(st); err != nil {
		return msg, err
	}
	return msg, nil
}

func DetectPublicIPsOrFail() (string, string, string, error) {
	pub4 := netutil.DetectPublicIP("4")
	if pub4 == "" {
		return "", "", "", errors.NewPlatformError("Could not detect public IPv4.")
	}

	var pub6 string
	if netutil.HasGlobalIPv6() {
		pub6 = netutil.DetectPublicIP("6")
	}

	priv4 := netutil.PrimaryPrivateIPv4()

	return pub4, pub6, priv4, nil
}

func ReadLinesFile(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.NewPlatformErrorf("File not found: %s", path)
	}

	var lines []string
	for _, line := range strings.Split(string(data), "\n") {
		s := strings.TrimSpace(line)
		if s != "" {
			lines = append(lines, s)
		}
	}
	return lines, nil
}

// StopConflictingServices stops system-installed services that conflict with managed ones
func StopConflictingServices() {
	sm := platform.DetectServiceManager()
	if !sm.IsSystemd() {
		return
	}

	conflicting := []string{
		"valkey-server.service",
		"valkey.service",
		"redis-server.service",
		"redis.service",
		"coturn.service",
	}

	for _, svc := range conflicting {
		util.Run([]string{"systemctl", "stop", svc}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"systemctl", "disable", svc}, util.RunOptions{Check: false, Capture: true})
	}

	managed := []string{
		"livekit-kv.service",
		"livekit-coturn.service",
		"livekit.service",
		"caddy.service",
	}

	for _, svc := range managed {
		util.Run([]string{"systemctl", "reset-failed", svc}, util.RunOptions{Check: false, Capture: true})
	}
}
