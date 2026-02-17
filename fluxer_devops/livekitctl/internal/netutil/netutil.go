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

package netutil

import (
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

func DetectPublicIP(family string) string {
	var urls []string
	if family == "4" {
		urls = []string{"https://api.ipify.org", "https://ipv4.icanhazip.com"}
	} else if family == "6" {
		urls = []string{"https://api64.ipify.org", "https://ipv6.icanhazip.com"}
	}

	client := &http.Client{Timeout: 10 * time.Second}

	for _, u := range urls {
		req, err := http.NewRequest("GET", u, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "livekitctl/0.1")

		resp, err := client.Do(req)
		if err != nil {
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		ip := strings.TrimSpace(strings.Split(string(body), "\n")[0])

		if family == "4" {
			if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() != nil {
				return ip
			}
		} else {
			if parsed := net.ParseIP(ip); parsed != nil && parsed.To4() == nil {
				return ip
			}
		}
	}

	return ""
}

func HasGlobalIPv6() bool {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return false
	}

	for _, addr := range addrs {
		ipNet, ok := addr.(*net.IPNet)
		if !ok {
			continue
		}
		ip := ipNet.IP
		if ip.To4() != nil {
			continue
		}
		if ip.IsGlobalUnicast() && !ip.IsPrivate() {
			return true
		}
	}

	return false
}

func PrimaryPrivateIPv4() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return ""
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)
	ip := localAddr.IP.To4()
	if ip == nil {
		return ""
	}
	return ip.String()
}

func IsPrivateIPv4(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}
	ip4 := ip.To4()
	if ip4 == nil {
		return false
	}
	return ip.IsPrivate()
}
