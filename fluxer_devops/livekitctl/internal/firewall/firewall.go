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

package firewall

import (
	"fmt"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/constants"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

type FirewallTool struct {
	Name string
}

func DetectFirewallTool() FirewallTool {
	if util.Which("ufw") != "" {
		return FirewallTool{Name: "ufw"}
	}
	if util.Which("firewall-cmd") != "" {
		return FirewallTool{Name: "firewalld"}
	}
	return FirewallTool{Name: "none"}
}

func ConfigureFirewall(tool FirewallTool, ports constants.Ports, enable bool) string {
	if tool.Name == "none" {
		return "Firewall tool not detected. Skipping."
	}

	if tool.Name == "ufw" {
		util.Run([]string{"ufw", "allow", "22/tcp"}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"ufw", "allow", "80/tcp"}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"ufw", "allow", "443/tcp"}, util.RunOptions{Check: false, Capture: true})

		util.Run([]string{"ufw", "allow", fmt.Sprintf("%d/tcp", ports.LiveKitRTCTCP)}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"ufw", "allow", fmt.Sprintf("%d:%d/udp", ports.LiveKitRTCUDPStart, ports.LiveKitRTCUDPEnd)}, util.RunOptions{Check: false, Capture: true})

		util.Run([]string{"ufw", "allow", fmt.Sprintf("%d/udp", ports.TURNListenPort)}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"ufw", "allow", fmt.Sprintf("%d/tcp", ports.TURNListenPort)}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"ufw", "allow", fmt.Sprintf("%d:%d/udp", ports.TURNRelayUDPStart, ports.TURNRelayUDPEnd)}, util.RunOptions{Check: false, Capture: true})

		if enable {
			util.Run([]string{"ufw", "--force", "enable"}, util.RunOptions{Check: false, Capture: true})
		}

		result, _ := util.Run([]string{"ufw", "status", "verbose"}, util.RunOptions{Check: false, Capture: true})
		if result != nil {
			return result.Output
		}
		return ""
	}

	if tool.Name == "firewalld" {
		util.Run([]string{"firewall-cmd", "--permanent", "--add-service=ssh"}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"firewall-cmd", "--permanent", "--add-service=http"}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"firewall-cmd", "--permanent", "--add-service=https"}, util.RunOptions{Check: false, Capture: true})

		util.Run([]string{"firewall-cmd", "--permanent", "--add-port", fmt.Sprintf("%d/tcp", ports.LiveKitRTCTCP)}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"firewall-cmd", "--permanent", "--add-port", fmt.Sprintf("%d-%d/udp", ports.LiveKitRTCUDPStart, ports.LiveKitRTCUDPEnd)}, util.RunOptions{Check: false, Capture: true})

		util.Run([]string{"firewall-cmd", "--permanent", "--add-port", fmt.Sprintf("%d/udp", ports.TURNListenPort)}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"firewall-cmd", "--permanent", "--add-port", fmt.Sprintf("%d/tcp", ports.TURNListenPort)}, util.RunOptions{Check: false, Capture: true})
		util.Run([]string{"firewall-cmd", "--permanent", "--add-port", fmt.Sprintf("%d-%d/udp", ports.TURNRelayUDPStart, ports.TURNRelayUDPEnd)}, util.RunOptions{Check: false, Capture: true})

		if enable {
			util.Run([]string{"firewall-cmd", "--reload"}, util.RunOptions{Check: false, Capture: true})
		}

		result, _ := util.Run([]string{"firewall-cmd", "--list-all"}, util.RunOptions{Check: false, Capture: true})
		if result != nil {
			return result.Output
		}
		return ""
	}

	return "Unsupported firewall tool."
}
