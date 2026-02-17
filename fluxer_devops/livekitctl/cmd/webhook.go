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

	"github.com/spf13/cobra"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/install"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/netutil"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/ops"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/platform"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/state"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

var webhookCmd = &cobra.Command{
	Use:   "webhook",
	Short: "Manage LiveKit webhooks (writes config and restarts LiveKit)",
}

var webhookListCmd = &cobra.Command{
	Use:   "list",
	Short: "List webhook URLs",
	Run:   runWebhookList,
}

var webhookAddCmd = &cobra.Command{
	Use:   "add <url>",
	Short: "Add a webhook URL",
	Args:  cobra.ExactArgs(1),
	Run:   runWebhookAdd,
}

var webhookRemoveCmd = &cobra.Command{
	Use:   "remove <url>",
	Short: "Remove a webhook URL",
	Args:  cobra.ExactArgs(1),
	Run:   runWebhookRemove,
}

var webhookSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Replace webhook URLs",
	Run:   runWebhookSet,
}

var (
	webhookAllowHTTP bool
	webhookSetURLs   []string
	webhookSetFile   string
)

func init() {
	rootCmd.AddCommand(webhookCmd)

	webhookCmd.AddCommand(webhookListCmd)

	webhookAddCmd.Flags().BoolVar(&webhookAllowHTTP, "allow-http-webhooks", false, "Allow http:// webhook URLs")
	webhookCmd.AddCommand(webhookAddCmd)

	webhookCmd.AddCommand(webhookRemoveCmd)

	webhookSetCmd.Flags().StringArrayVar(&webhookSetURLs, "url", nil, "Webhook URL (repeatable)")
	webhookSetCmd.Flags().StringVar(&webhookSetFile, "file", "", "File with webhook URLs (one per line)")
	webhookSetCmd.Flags().BoolVar(&webhookAllowHTTP, "allow-http-webhooks", false, "Allow http:// webhook URLs")
	webhookCmd.AddCommand(webhookSetCmd)
}

func runWebhookList(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	st, err := ops.EnsureStateLoadedOrFail(statePath)
	exitOnError(err)

	for _, u := range ops.WebhookList(st) {
		fmt.Println(u)
	}
}

func runWebhookAdd(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	st, err := ops.EnsureStateLoadedOrFail(statePath)
	exitOnError(err)

	changed, err := ops.WebhookAdd(st, args[0], webhookAllowHTTP)
	exitOnError(err)

	if changed {
		exitOnError(applyAndRestart(st))
		util.Log("Webhook added and LiveKit restarted.")
	} else {
		util.Log("Webhook already present.")
	}
}

func runWebhookRemove(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	st, err := ops.EnsureStateLoadedOrFail(statePath)
	exitOnError(err)

	changed, err := ops.WebhookRemove(st, args[0])
	exitOnError(err)

	if changed {
		exitOnError(applyAndRestart(st))
		util.Log("Webhook removed and LiveKit restarted.")
	} else {
		util.Log("Webhook not found.")
	}
}

func runWebhookSet(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	st, err := ops.EnsureStateLoadedOrFail(statePath)
	exitOnError(err)

	var urls []string
	urls = append(urls, webhookSetURLs...)

	if webhookSetFile != "" {
		lines, err := ops.ReadLinesFile(webhookSetFile)
		exitOnError(err)
		urls = append(urls, lines...)
	}

	exitOnError(ops.WebhookSet(st, urls, webhookAllowHTTP))
	exitOnError(applyAndRestart(st))
	util.Log("Webhooks updated and LiveKit restarted.")
}

func applyAndRestart(st *state.BootstrapState) error {
	pm := platform.DetectPackageManager()
	if pm == nil {
		return fmt.Errorf("no supported package manager detected")
	}

	kvBin, err := install.InstallKVBinary(pm)
	if err != nil {
		return err
	}

	pub4 := netutil.DetectPublicIP("4")
	if pub4 == "" {
		util.Log("Warning: Could not detect public IPv4, using 0.0.0.0")
		pub4 = "0.0.0.0"
	}
	priv4 := netutil.PrimaryPrivateIPv4()

	return ops.ApplyConfigAndRestart(st, kvBin, pub4, priv4)
}
