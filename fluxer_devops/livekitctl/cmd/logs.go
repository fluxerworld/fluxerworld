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

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Show systemd logs",
	Run:   runLogs,
}

var (
	logsService string
	logsLines   int
)

func init() {
	rootCmd.AddCommand(logsCmd)

	logsCmd.Flags().StringVar(&logsService, "service", "", "systemd unit, eg livekit.service (required)")
	logsCmd.Flags().IntVar(&logsLines, "lines", 200, "Number of log lines")

	logsCmd.MarkFlagRequired("service")
}

func runLogs(cmd *cobra.Command, args []string) {
	exitOnError(ops.EnsureLinuxRoot())

	st, err := ops.EnsureStateLoadedOrFail(statePath)
	exitOnError(err)

	util.Log(ops.OpLogs(st, logsService, logsLines))
}
