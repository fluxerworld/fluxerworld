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

package state

import (
	"encoding/json"
	"os"
	"sort"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/constants"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

type Versions struct {
	LiveKit string `json:"livekit"`
	Caddy   string `json:"caddy"`
	CaddyL4 string `json:"caddy_l4"`
	Xcaddy  string `json:"xcaddy"`
}

type Domains struct {
	LiveKit string `json:"livekit"`
	TURN    string `json:"turn"`
}

type Paths struct {
	ConfigDir         string `json:"config_dir"`
	StatePath         string `json:"state_path"`
	SecretsPath       string `json:"secrets_path"`
	LiveKitInstallDir string `json:"livekit_install_dir"`
	LiveKitBinDir     string `json:"livekit_bin_dir"`
	CaddyBin          string `json:"caddy_bin"`
	CaddyStorageDir   string `json:"caddy_storage_dir"`
	CaddyLogDir       string `json:"caddy_log_dir"`
	LiveKitLogDir     string `json:"livekit_log_dir"`
	KVDataDir         string `json:"kv_data_dir"`
	KVLogDir          string `json:"kv_log_dir"`
	UnitDir           string `json:"unit_dir"`
}

func DefaultPaths() Paths {
	return Paths{
		ConfigDir:         "/etc/livekit",
		StatePath:         "/etc/livekit/livekitctl-state.json",
		SecretsPath:       "/etc/livekit/livekitctl-secrets.json",
		LiveKitInstallDir: "/opt/livekit",
		LiveKitBinDir:     "/opt/livekit/bin",
		CaddyBin:          "/usr/local/bin/caddy",
		CaddyStorageDir:   "/var/lib/caddy",
		CaddyLogDir:       "/var/log/caddy",
		LiveKitLogDir:     "/var/log/livekit",
		KVDataDir:         "/var/lib/livekit/kv",
		KVLogDir:          "/var/log/livekit",
		UnitDir:           "/etc/systemd/system",
	}
}

type KVConfig struct {
	BindHost string `json:"bind_host"`
	Port     int    `json:"port"`
}

type FirewallConfig struct {
	Enabled bool   `json:"enabled"`
	Tool    string `json:"tool"`
}

type BootstrapState struct {
	SchemaVersion int             `json:"schema_version"`
	CreatedAt     string          `json:"created_at"`
	UpdatedAt     string          `json:"updated_at"`
	ACMEEmail     string          `json:"acme_email"`
	Domains       Domains         `json:"domains"`
	Ports         constants.Ports `json:"ports"`
	Versions      Versions        `json:"versions"`
	KV            KVConfig        `json:"kv"`
	Webhooks      []string        `json:"webhooks"`
	Paths         Paths           `json:"paths"`
	Firewall      FirewallConfig  `json:"firewall"`
}

type NewStateParams struct {
	ACMEEmail string
	Domains   Domains
	Ports     constants.Ports
	Versions  Versions
	KV        KVConfig
	Webhooks  []string
	Firewall  FirewallConfig
	Paths     *Paths
}

func NewState(params NewStateParams) *BootstrapState {
	ts := util.NowRFC3339()

	webhooks := params.Webhooks
	if webhooks == nil {
		webhooks = []string{}
	}
	unique := make(map[string]bool)
	for _, w := range webhooks {
		unique[w] = true
	}
	sorted := make([]string, 0, len(unique))
	for w := range unique {
		sorted = append(sorted, w)
	}
	sort.Strings(sorted)

	paths := DefaultPaths()
	if params.Paths != nil {
		paths = *params.Paths
	}

	return &BootstrapState{
		SchemaVersion: 1,
		CreatedAt:     ts,
		UpdatedAt:     ts,
		ACMEEmail:     params.ACMEEmail,
		Domains:       params.Domains,
		Ports:         params.Ports,
		Versions:      params.Versions,
		KV:            params.KV,
		Webhooks:      sorted,
		Paths:         paths,
		Firewall:      params.Firewall,
	}
}

func (st *BootstrapState) Touch() {
	st.UpdatedAt = util.NowRFC3339()
}

func LoadState(path string) (*BootstrapState, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var st BootstrapState
	if err := json.Unmarshal(data, &st); err != nil {
		return nil, err
	}

	return &st, nil
}

func SaveState(st *BootstrapState) error {
	return util.WriteJSON(st.Paths.StatePath, st, 0600, -1, -1)
}
