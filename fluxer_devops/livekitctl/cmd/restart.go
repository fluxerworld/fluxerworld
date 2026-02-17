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
	"github.com/spf13/cobra"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/ops"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

var restartCmd = &cobra.Command{
	Use:   "restart [services...]",
	Short: "Restart one or more services",
	Long:  "Restart one or more services. If no services specified, restarts all managed services.",
	Run:   runRestart,
}

func init() {
	rootCmd.AddCommand(restartCmd)
}

func runRestart(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	services := args
	if len(services) == 0 {
		services = []string{"livekit-kv.service", "livekit-coturn.service", "livekit.service", "caddy.service"}
	}

	exitOnError(ops.OpRestart(services))
	util.Log("Restart requested.")
}
