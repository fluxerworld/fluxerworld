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

package constants

const (
	DefaultLiveKitVersion = "v1.9.11"
	DefaultXcaddyVersion  = "v0.4.5"
	DefaultCaddyVersion   = "v2.10.2"
	DefaultCaddyL4Version = "master"
)

type Ports struct {
	LiveKitHTTPLocal   int    `json:"livekit_http_local"`
	LiveKitRTCTCP      int    `json:"livekit_rtc_tcp"`
	LiveKitRTCUDPStart int    `json:"livekit_rtc_udp_start"`
	LiveKitRTCUDPEnd   int    `json:"livekit_rtc_udp_end"`
	TURNListenPort     int    `json:"turn_listen_port"`
	TURNRelayUDPStart  int    `json:"turn_relay_udp_start"`
	TURNRelayUDPEnd    int    `json:"turn_relay_udp_end"`
	KVBindHost         string `json:"kv_bind_host"`
	KVPort             int    `json:"kv_port"`
}

func DefaultPorts() Ports {
	return Ports{
		LiveKitHTTPLocal:   7880,
		LiveKitRTCTCP:      7881,
		LiveKitRTCUDPStart: 50000,
		LiveKitRTCUDPEnd:   60000,
		TURNListenPort:     3478,
		TURNRelayUDPStart:  40000,
		TURNRelayUDPEnd:    49999,
		KVBindHost:         "127.0.0.1",
		KVPort:             6379,
	}
}
