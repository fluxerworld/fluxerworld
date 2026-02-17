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

package dnswait

import (
	"net"
	"time"
)

func ResolveA(host string) []string {
	var out []string
	addrs, err := net.LookupIP(host)
	if err != nil {
		return out
	}
	for _, addr := range addrs {
		if ip4 := addr.To4(); ip4 != nil {
			out = append(out, ip4.String())
		}
	}
	return out
}

func ResolveAAAA(host string) []string {
	var out []string
	addrs, err := net.LookupIP(host)
	if err != nil {
		return out
	}
	for _, addr := range addrs {
		if addr.To4() == nil {
			out = append(out, addr.String())
		}
	}
	return out
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

func WaitForDNS(livekitDomain, turnDomain, publicIPv4, publicIPv6 string, timeoutS, intervalS int) bool {
	if timeoutS < 1 {
		timeoutS = 1
	}
	if intervalS < 1 {
		intervalS = 1
	}

	deadline := time.Now().Add(time.Duration(timeoutS) * time.Second)

	for {
		a1 := ResolveA(livekitDomain)
		a2 := ResolveA(turnDomain)
		ok4 := contains(a1, publicIPv4) && contains(a2, publicIPv4)

		ok6 := true
		if publicIPv6 != "" {
			aaaa1 := ResolveAAAA(livekitDomain)
			aaaa2 := ResolveAAAA(turnDomain)
			ok6 = contains(aaaa1, publicIPv6) && contains(aaaa2, publicIPv6)
		}

		if ok4 && ok6 {
			return true
		}

		if time.Now().After(deadline) {
			return false
		}

		time.Sleep(time.Duration(intervalS) * time.Second)
	}
}
