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

package install

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/constants"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/download"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/errors"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/platform"
	"github.com/fluxerapp/fluxer/fluxer_devops/livekitctl/internal/util"
)

func DetectArchLinuxRelease() (string, error) {
	m := strings.ToLower(runtime.GOARCH)
	switch m {
	case "amd64":
		return "amd64", nil
	case "arm64":
		return "arm64", nil
	case "arm":
		return "armv7", nil
	}
	return "", errors.NewPlatformErrorf("Unsupported architecture: %s", runtime.GOARCH)
}

func LiveKitReleaseURL(tag, arch string) string {
	v := strings.TrimPrefix(tag, "v")
	return fmt.Sprintf("https://github.com/livekit/livekit/releases/download/v%s/livekit_%s_linux_%s.tar.gz", v, v, arch)
}

func EnsureUsers() error {
	if util.Which("useradd") == "" {
		return nil
	}
	if err := ensureSystemUser("livekit", "/var/lib/livekit"); err != nil {
		return err
	}
	return ensureSystemUser("caddy", "/var/lib/caddy")
}

func ensureSystemUser(name, home string) error {
	output, exitCode := util.RunCaptureNoCheck([]string{"id", "-u", name})
	if exitCode == 0 && strings.TrimSpace(output) != "" {
		return nil
	}

	return util.RunSimple([]string{
		"useradd",
		"--system",
		"--home", home,
		"--shell", "/usr/sbin/nologin",
		name,
	})
}

func InstallBasePackages(pm *platform.PackageManager) error {
	var pkgs []string
	switch pm.Kind {
	case "apt":
		pkgs = []string{
			"ca-certificates",
			"curl",
			"tar",
			"xz-utils",
			"dnsutils",
			"iproute2",
			"libcap2-bin",
			"coturn",
			"git",
			"build-essential",
			"golang-go",
		}
	case "dnf", "yum":
		pkgs = []string{
			"ca-certificates",
			"curl",
			"tar",
			"xz",
			"bind-utils",
			"iproute",
			"libcap",
			"coturn",
			"git",
			"gcc",
			"gcc-c++",
			"make",
			"golang",
		}
	case "pacman":
		pkgs = []string{
			"ca-certificates",
			"curl",
			"tar",
			"xz",
			"bind",
			"iproute2",
			"libcap",
			"coturn",
			"git",
			"base-devel",
			"go",
		}
	case "zypper":
		pkgs = []string{
			"ca-certificates",
			"curl",
			"tar",
			"xz",
			"bind-utils",
			"iproute2",
			"libcap-progs",
			"coturn",
			"git",
			"gcc",
			"gcc-c++",
			"make",
			"go",
		}
	case "apk":
		pkgs = []string{
			"ca-certificates",
			"curl",
			"tar",
			"xz",
			"bind-tools",
			"iproute2",
			"libcap",
			"coturn",
			"git",
			"build-base",
			"go",
		}
	}
	return pm.Install(pkgs)
}

func InstallKVBinary(pm *platform.PackageManager) (string, error) {
	if bin := util.Which("valkey-server"); bin != "" {
		util.Logf("Using existing valkey-server: %s", bin)
		return bin, nil
	}
	if bin := util.Which("redis-server"); bin != "" {
		util.Logf("Using existing redis-server: %s", bin)
		return bin, nil
	}

	util.Log("Installing KV store...")
	switch pm.Kind {
	case "apt":
		if err := pm.Install([]string{"valkey-server"}); err != nil {
			util.Log("valkey-server not available, trying redis-server...")
			if err2 := pm.Install([]string{"redis-server"}); err2 != nil {
				return "", err
			}
		}
	case "dnf", "yum":
		if err := pm.Install([]string{"valkey"}); err != nil {
			util.Log("valkey not available, trying redis...")
			if err2 := pm.Install([]string{"redis"}); err2 != nil {
				return "", err
			}
		}
	case "pacman":
		if err := pm.Install([]string{"valkey"}); err != nil {
			util.Log("valkey not available, trying redis...")
			if err2 := pm.Install([]string{"redis"}); err2 != nil {
				return "", err
			}
		}
	case "zypper":
		if err := pm.Install([]string{"valkey"}); err != nil {
			util.Log("valkey not available, trying redis...")
			if err2 := pm.Install([]string{"redis"}); err2 != nil {
				return "", err
			}
		}
	case "apk":
		if err := pm.Install([]string{"valkey"}); err != nil {
			util.Log("valkey not available, trying redis...")
			if err2 := pm.Install([]string{"redis"}); err2 != nil {
				return "", err
			}
		}
	default:
		return "", errors.NewPlatformError("No supported package manager for installing KV store.")
	}

	if bin := util.Which("valkey-server"); bin != "" {
		util.Logf("Installed valkey-server: %s", bin)
		return bin, nil
	}
	if bin := util.Which("redis-server"); bin != "" {
		util.Logf("Installed redis-server: %s", bin)
		return bin, nil
	}

	return "", errors.NewPlatformError("Could not install redis-compatible server.")
}

func InstallLiveKitBinary(tag, installDir, arch string) (string, error) {
	if arch == "" {
		var err error
		arch, err = DetectArchLinuxRelease()
		if err != nil {
			return "", err
		}
	}

	url := LiveKitReleaseURL(tag, arch)
	binDir := filepath.Join(installDir, "bin")
	if err := util.EnsureDir(binDir, 0755, -1, -1); err != nil {
		return "", err
	}

	tmpFile := filepath.Join(binDir, "livekit.tar.gz")
	util.Logf("Downloading LiveKit from %s", url)

	if _, err := download.DownloadWithOptionalSHA256(url, tmpFile, 30, 2); err != nil {
		return "", err
	}

	if err := extractTarGz(tmpFile, binDir); err != nil {
		return "", err
	}

	var serverPath string
	filepath.Walk(binDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			util.Logf("Warning: error walking %s: %v", path, err)
			return nil
		}
		if info.IsDir() {
			return nil
		}
		if info.Name() == "livekit-server" {
			serverPath = path
			return filepath.SkipAll
		}
		if strings.Contains(info.Name(), "livekit") && strings.Contains(info.Name(), "server") {
			serverPath = path
		}
		return nil
	})

	if serverPath == "" {
		return "", errors.NewCmdError("Could not find livekit-server after extracting tarball.", nil)
	}

	target := filepath.Join(binDir, "livekit-server")
	if serverPath != target {
		if err := util.CopyFile(serverPath, target); err != nil {
			if err2 := util.RunSimple([]string{"cp", "-f", serverPath, target}); err2 != nil {
				return "", err
			}
		}
	}

	os.Chmod(target, 0755)
	return target, nil
}

func extractTarGz(tarGzPath, destDir string) error {
	f, err := os.Open(tarGzPath)
	if err != nil {
		return err
	}
	defer f.Close()

	gzr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(destDir, header.Name)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			outFile, err := os.Create(target)
			if err != nil {
				return err
			}
			if _, err := io.Copy(outFile, tr); err != nil {
				outFile.Close()
				return err
			}
			outFile.Close()
			os.Chmod(target, os.FileMode(header.Mode))
		}
	}
	return nil
}

func EnsureCaddyWithL4(stagingDir, caddyVersion, caddyL4Version, xcaddyVersion, outBin string) error {
	if util.FileExists(outBin) {
		output, exitCode := util.RunCaptureNoCheck([]string{outBin, "list-modules"})
		if exitCode == 0 && strings.Contains(output, "layer4") {
			return nil
		}
	}

	if util.Which("go") == "" {
		return errors.NewPlatformError("Go is required to build Caddy with caddy-l4.")
	}
	if util.Which("git") == "" {
		return errors.NewPlatformError("git is required to build Caddy with caddy-l4.")
	}

	env := []string{"GOBIN=/usr/local/bin"}
	_, err := util.Run([]string{"bash", "-lc", fmt.Sprintf("go install github.com/caddyserver/xcaddy/cmd/xcaddy@%s", xcaddyVersion)},
		util.RunOptions{Check: true, Capture: false, Env: env})
	if err != nil {
		return err
	}

	xcaddy := "/usr/local/bin/xcaddy"
	if !util.FileExists(xcaddy) {
		return errors.NewCmdError("xcaddy install failed.", nil)
	}

	if err := os.MkdirAll(stagingDir, 0755); err != nil {
		return err
	}

	cmd := []string{
		xcaddy,
		"build",
		caddyVersion,
		"--with",
		fmt.Sprintf("github.com/mholt/caddy-l4@%s", caddyL4Version),
	}

	_, err = util.Run(cmd, util.RunOptions{Check: true, Capture: false, Cwd: stagingDir})
	if err != nil {
		return err
	}

	built := filepath.Join(stagingDir, "caddy")
	if !util.FileExists(built) {
		return errors.NewCmdError("xcaddy did not produce a caddy binary.", nil)
	}

	if err := os.MkdirAll(filepath.Dir(outBin), 0755); err != nil {
		return err
	}

	if err := util.CopyFile(built, outBin); err != nil {
		return err
	}
	os.Chmod(outBin, 0755)

	if util.Which("setcap") != "" {
		util.Run([]string{"setcap", "cap_net_bind_service=+ep", outBin}, util.RunOptions{Check: false, Capture: true})
	}

	return nil
}

func DefaultVersions() (string, string, string, string) {
	return constants.DefaultLiveKitVersion, constants.DefaultCaddyVersion, constants.DefaultCaddyL4Version, constants.DefaultXcaddyVersion
}
