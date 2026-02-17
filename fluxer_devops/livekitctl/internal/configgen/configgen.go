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

package configgen

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/secrets"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/state"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

func GenerateLiveKitYAML(st *state.BootstrapState, sec *secrets.Secrets, redisAddr string) string {
	var webhookBlock string
	if len(st.Webhooks) > 0 {
		var urls []string
		for _, u := range st.Webhooks {
			urls = append(urls, fmt.Sprintf("    - '%s'", u))
		}
		webhookBlock = fmt.Sprintf(`webhook:
  api_key: '%s'
  urls:
%s
`, sec.LiveKitAPIKey, strings.Join(urls, "\n"))
	}

	return fmt.Sprintf(`port: %d
bind_addresses:
  - "127.0.0.1"

log_level: info

rtc:
  tcp_port: %d
  port_range_start: %d
  port_range_end: %d
  use_external_ip: true

  turn_servers:
    - host: "%s"
      port: 443
      protocol: tls
      username: "%s"
      credential: "%s"
    - host: "%s"
      port: %d
      protocol: udp
      username: "%s"
      credential: "%s"

redis:
  address: "%s"
  username: ""
  password: "%s"
  db: 0
  use_tls: false

keys:
  "%s": "%s"

%s`,
		st.Ports.LiveKitHTTPLocal,
		st.Ports.LiveKitRTCTCP,
		st.Ports.LiveKitRTCUDPStart,
		st.Ports.LiveKitRTCUDPEnd,
		st.Domains.TURN,
		sec.TURNUsername,
		sec.TURNPassword,
		st.Domains.TURN,
		st.Ports.TURNListenPort,
		sec.TURNUsername,
		sec.TURNPassword,
		redisAddr,
		sec.KVPassword,
		sec.LiveKitAPIKey,
		sec.LiveKitAPISecret,
		strings.TrimSpace(webhookBlock),
	)
}

func GenerateKVConf(sec *secrets.Secrets, bindHost string, port int, dataDir string) string {
	return fmt.Sprintf(`bind %s
protected-mode yes
port %d
tcp-backlog 511
timeout 0
tcp-keepalive 300
daemonize no
supervised no

dir %s
dbfilename dump.rdb
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

requirepass %s
`, bindHost, port, dataDir, sec.KVPassword)
}

func GenerateCoTURNConf(st *state.BootstrapState, sec *secrets.Secrets, publicIPv4, privateIPv4 string) string {
	external := publicIPv4
	if privateIPv4 != "" && privateIPv4 != publicIPv4 {
		external = fmt.Sprintf("%s/%s", publicIPv4, privateIPv4)
	}

	return fmt.Sprintf(`listening-port=%d
fingerprint
lt-cred-mech
user=%s:%s
realm=%s
server-name=%s

no-multicast-peers
no-loopback-peers
stale-nonce

no-tls
no-dtls

min-port=%d
max-port=%d

external-ip=%s
`, st.Ports.TURNListenPort,
		sec.TURNUsername, sec.TURNPassword,
		st.Domains.TURN,
		st.Domains.TURN,
		st.Ports.TURNRelayUDPStart,
		st.Ports.TURNRelayUDPEnd,
		external)
}

func GenerateLiveKitUnit(st *state.BootstrapState) string {
	return fmt.Sprintf(`[Unit]
Description=LiveKit Server
After=network-online.target
Wants=network-online.target

[Service]
User=livekit
Group=livekit
ExecStart=%s/livekit-server --config %s/livekit.yaml
Restart=on-failure
RestartSec=2
LimitNOFILE=1048576
WorkingDirectory=%s

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=%s %s %s /var/lib/livekit
LockPersonality=true
MemoryDenyWriteExecute=true
RestrictSUIDSGID=true
RestrictRealtime=true

[Install]
WantedBy=multi-user.target
`, st.Paths.LiveKitBinDir, st.Paths.ConfigDir, st.Paths.LiveKitInstallDir,
		st.Paths.LiveKitLogDir, st.Paths.LiveKitInstallDir, st.Paths.ConfigDir)
}

func GenerateCaddyJSON(st *state.BootstrapState) string {
	caddyConfig := map[string]interface{}{
		"storage": map[string]interface{}{
			"module": "file_system",
			"root":   st.Paths.CaddyStorageDir,
		},
		"logging": map[string]interface{}{
			"logs": map[string]interface{}{
				"default": map[string]interface{}{
					"level": "INFO",
				},
			},
		},
		"apps": map[string]interface{}{
			"tls": map[string]interface{}{
				"automation": map[string]interface{}{
					"policies": []interface{}{
						map[string]interface{}{
							"subjects": []string{st.Domains.LiveKit, st.Domains.TURN},
							"issuers": []interface{}{
								map[string]interface{}{
									"module": "acme",
									"email":  st.ACMEEmail,
								},
							},
						},
					},
				},
				"certificates": map[string]interface{}{
					"automate": []string{st.Domains.LiveKit, st.Domains.TURN},
				},
			},
			"layer4": map[string]interface{}{
				"servers": map[string]interface{}{
					"main443": map[string]interface{}{
						"listen": []string{":443"},
						"routes": []interface{}{
							map[string]interface{}{
								"match": []interface{}{
									map[string]interface{}{
										"tls": map[string]interface{}{
											"sni": []string{st.Domains.TURN},
										},
									},
								},
								"handle": []interface{}{
									map[string]interface{}{
										"handler": "tls",
										"connection_policies": []interface{}{
											map[string]interface{}{
												"alpn": []string{"acme-tls/1", "h2", "http/1.1"},
											},
										},
									},
									map[string]interface{}{
										"handler": "proxy",
										"upstreams": []interface{}{
											map[string]interface{}{
												"dial": []string{fmt.Sprintf("127.0.0.1:%d", st.Ports.TURNListenPort)},
											},
										},
									},
								},
							},
							map[string]interface{}{
								"match": []interface{}{
									map[string]interface{}{
										"tls": map[string]interface{}{
											"sni": []string{st.Domains.LiveKit},
										},
									},
								},
								"handle": []interface{}{
									map[string]interface{}{
										"handler": "tls",
										"connection_policies": []interface{}{
											map[string]interface{}{
												"alpn": []string{"acme-tls/1", "http/1.1"},
											},
										},
									},
									map[string]interface{}{
										"handler": "proxy",
										"upstreams": []interface{}{
											map[string]interface{}{
												"dial": []string{fmt.Sprintf("127.0.0.1:%d", st.Ports.LiveKitHTTPLocal)},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	data, err := json.MarshalIndent(caddyConfig, "", "  ")
	if err != nil {
		panic("failed to marshal caddy config: " + err.Error())
	}
	return string(data) + "\n"
}

func GenerateCaddyUnit(st *state.BootstrapState) string {
	return fmt.Sprintf(`[Unit]
Description=Caddy (custom build with caddy-l4) for LiveKit + TURN/TLS
After=network-online.target
Wants=network-online.target

[Service]
User=caddy
Group=caddy
ExecStart=%s run --config %s/caddy.json
ExecReload=%s reload --config %s/caddy.json
Restart=on-failure
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
WorkingDirectory=%s

[Install]
WantedBy=multi-user.target
`, st.Paths.CaddyBin, st.Paths.ConfigDir, st.Paths.CaddyBin, st.Paths.ConfigDir, st.Paths.CaddyStorageDir)
}

func GenerateCoTURNUnit(st *state.BootstrapState) string {
	return fmt.Sprintf(`[Unit]
Description=CoTURN for LiveKit
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/turnserver -c %s/coturn.conf -n
Restart=on-failure
RestartSec=2
LimitNOFILE=1048576

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`, st.Paths.ConfigDir)
}

func GenerateKVUnit(st *state.BootstrapState, kvBin string) string {
	return fmt.Sprintf(`[Unit]
Description=Redis-compatible KV store for LiveKit (managed by livekitctl)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=%s %s/kv.conf
Restart=on-failure
RestartSec=2
LimitNOFILE=1048576

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`, kvBin, st.Paths.ConfigDir)
}

type WriteAllConfigsParams struct {
	State       *state.BootstrapState
	Secrets     *secrets.Secrets
	PublicIPv4  string
	PrivateIPv4 string
	KVBin       string
}

func WriteAllConfigs(params WriteAllConfigsParams) error {
	st := params.State
	sec := params.Secrets

	cfgDir := st.Paths.ConfigDir
	if err := util.EnsureDir(cfgDir, 0755, -1, -1); err != nil {
		return err
	}

	ugLiveKit := util.LookupUserGroup("livekit")
	ugCaddy := util.LookupUserGroup("caddy")

	lkUID, lkGID := -1, -1
	if ugLiveKit != nil {
		lkUID, lkGID = ugLiveKit.UID, ugLiveKit.GID
	}

	caddyUID, caddyGID := -1, -1
	if ugCaddy != nil {
		caddyUID, caddyGID = ugCaddy.UID, ugCaddy.GID
	}

	if err := util.EnsureDir(st.Paths.LiveKitLogDir, 0755, lkUID, lkGID); err != nil {
		return err
	}
	if err := util.EnsureDir(st.Paths.CaddyStorageDir, 0700, caddyUID, caddyGID); err != nil {
		return err
	}
	if err := util.EnsureDir(st.Paths.CaddyLogDir, 0755, caddyUID, caddyGID); err != nil {
		return err
	}
	if err := util.EnsureDir(st.Paths.KVDataDir, 0700, -1, -1); err != nil {
		return err
	}

	redisAddr := fmt.Sprintf("%s:%d", st.KV.BindHost, st.KV.Port)
	livekitYAML := GenerateLiveKitYAML(st, sec, redisAddr)
	if err := util.AtomicWriteText(filepath.Join(cfgDir, "livekit.yaml"), livekitYAML, 0640, lkUID, lkGID); err != nil {
		return err
	}

	kvConf := GenerateKVConf(sec, st.KV.BindHost, st.KV.Port, st.Paths.KVDataDir)
	if err := util.AtomicWriteText(filepath.Join(cfgDir, "kv.conf"), kvConf, 0600, -1, -1); err != nil {
		return err
	}

	coturnConf := GenerateCoTURNConf(st, sec, params.PublicIPv4, params.PrivateIPv4)
	if err := util.AtomicWriteText(filepath.Join(cfgDir, "coturn.conf"), coturnConf, 0600, -1, -1); err != nil {
		return err
	}

	caddyJSON := GenerateCaddyJSON(st)
	if err := util.AtomicWriteText(filepath.Join(cfgDir, "caddy.json"), caddyJSON, 0644, -1, -1); err != nil {
		return err
	}

	if util.FileExists(st.Paths.UnitDir) {
		if err := util.AtomicWriteText(filepath.Join(st.Paths.UnitDir, "livekit.service"), GenerateLiveKitUnit(st), 0644, -1, -1); err != nil {
			return err
		}
		if err := util.AtomicWriteText(filepath.Join(st.Paths.UnitDir, "caddy.service"), GenerateCaddyUnit(st), 0644, -1, -1); err != nil {
			return err
		}
		if err := util.AtomicWriteText(filepath.Join(st.Paths.UnitDir, "livekit-coturn.service"), GenerateCoTURNUnit(st), 0644, -1, -1); err != nil {
			return err
		}
		if err := util.AtomicWriteText(filepath.Join(st.Paths.UnitDir, "livekit-kv.service"), GenerateKVUnit(st, params.KVBin), 0644, -1, -1); err != nil {
			return err
		}
	}

	return nil
}
