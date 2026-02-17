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

package platform

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

func IsLinux() bool {
	return runtime.GOOS == "linux"
}

func RequireRoot() error {
	if os.Geteuid() != 0 {
		return errors.NewPlatformError("Run as root (sudo -i).")
	}
	return nil
}

func ReadOSRelease() map[string]string {
	data := make(map[string]string)
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return data
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := parts[0]
		value := strings.Trim(parts[1], `"`)
		data[key] = value
	}
	return data
}

type PlatformInfo struct {
	ID     string
	IDLike string
	Pretty string
}

func DetectPlatform() PlatformInfo {
	osr := ReadOSRelease()
	return PlatformInfo{
		ID:     strings.ToLower(osr["ID"]),
		IDLike: strings.ToLower(osr["ID_LIKE"]),
		Pretty: strings.TrimSpace(osr["PRETTY_NAME"]),
	}
}

type PackageManager struct {
	Kind string
}

func DetectPackageManager() *PackageManager {
	if util.Which("apt-get") != "" {
		return &PackageManager{Kind: "apt"}
	}
	if util.Which("dnf") != "" {
		return &PackageManager{Kind: "dnf"}
	}
	if util.Which("yum") != "" {
		return &PackageManager{Kind: "yum"}
	}
	if util.Which("pacman") != "" {
		return &PackageManager{Kind: "pacman"}
	}
	if util.Which("zypper") != "" {
		return &PackageManager{Kind: "zypper"}
	}
	if util.Which("apk") != "" {
		return &PackageManager{Kind: "apk"}
	}
	return nil
}

func (pm *PackageManager) Install(pkgs []string) error {
	if len(pkgs) == 0 {
		return nil
	}

	switch pm.Kind {
	case "apt":
		if err := util.RunSimple([]string{"apt-get", "update"}); err != nil {
			return err
		}
		args := append([]string{"apt-get", "install", "-y", "--no-install-recommends"}, pkgs...)
		return util.RunSimple(args)

	case "dnf":
		args := append([]string{"dnf", "-y", "install"}, pkgs...)
		return util.RunSimple(args)

	case "yum":
		args := append([]string{"yum", "-y", "install"}, pkgs...)
		return util.RunSimple(args)

	case "pacman":
		args := append([]string{"pacman", "-Sy", "--noconfirm"}, pkgs...)
		return util.RunSimple(args)

	case "zypper":
		args := append([]string{"zypper", "--non-interactive", "install"}, pkgs...)
		return util.RunSimple(args)

	case "apk":
		args := append([]string{"apk", "add", "--no-cache"}, pkgs...)
		return util.RunSimple(args)
	}

	return errors.NewPlatformErrorf("Unsupported package manager: %s", pm.Kind)
}

type ServiceManager struct {
	Kind string
}

func DetectServiceManager() *ServiceManager {
	if util.Which("systemctl") != "" && util.FileExists("/run/systemd/system") {
		return &ServiceManager{Kind: "systemd"}
	}
	return &ServiceManager{Kind: "none"}
}

func (sm *ServiceManager) IsSystemd() bool {
	return sm.Kind == "systemd"
}

func (sm *ServiceManager) DaemonReload() {
	if sm.Kind == "systemd" {
		util.Run([]string{"systemctl", "daemon-reload"}, util.RunOptions{Check: false, Capture: true})
	}
}

func (sm *ServiceManager) Enable(name string) {
	if sm.Kind == "systemd" {
		util.Run([]string{"systemctl", "enable", name}, util.RunOptions{Check: false, Capture: true})
	}
}

func (sm *ServiceManager) Disable(name string) {
	if sm.Kind == "systemd" {
		util.Run([]string{"systemctl", "disable", name}, util.RunOptions{Check: false, Capture: true})
	}
}

func (sm *ServiceManager) Restart(name string) {
	if sm.Kind == "systemd" {
		util.Run([]string{"systemctl", "restart", name}, util.RunOptions{Check: false, Capture: true})
	}
}

func (sm *ServiceManager) Start(name string) {
	if sm.Kind == "systemd" {
		util.Run([]string{"systemctl", "start", name}, util.RunOptions{Check: false, Capture: true})
	}
}

func (sm *ServiceManager) Stop(name string) {
	if sm.Kind == "systemd" {
		util.Run([]string{"systemctl", "stop", name}, util.RunOptions{Check: false, Capture: true})
	}
}

func (sm *ServiceManager) Status(name string) string {
	if sm.Kind != "systemd" {
		return "Service manager not available."
	}
	result, _ := util.Run([]string{"systemctl", "status", name, "--no-pager"}, util.RunOptions{Check: false, Capture: true})
	if result != nil {
		return strings.TrimSpace(result.Output)
	}
	return ""
}

func (sm *ServiceManager) Logs(name string, lines int) string {
	if sm.Kind != "systemd" {
		return "Service manager not available."
	}
	if lines < 1 {
		lines = 1
	}
	result, _ := util.Run([]string{"journalctl", "-u", name, "-n", fmt.Sprintf("%d", lines), "--no-pager"}, util.RunOptions{Check: false, Capture: true})
	if result != nil {
		return strings.TrimSpace(result.Output)
	}
	return ""
}
