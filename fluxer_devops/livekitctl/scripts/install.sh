#!/usr/bin/env sh

# Copyright (C) 2026 Fluxer Contributors
#
# This file is part of Fluxer.
#
# Fluxer is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Fluxer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with Fluxer. If not, see <https://www.gnu.org/licenses/>.

set -eu

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
GITHUB_REPO="fluxerapp/fluxer"
BINARY_NAME="livekitctl"

info() {
    echo "[livekitctl] $*"
}

error() {
    echo "[livekitctl] ERROR: $*" >&2
    exit 1
}

check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        error "This script must be run as root (use sudo)"
    fi
}

detect_arch() {
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64)
            echo "amd64"
            ;;
        aarch64|arm64)
            echo "arm64"
            ;;
        *)
            error "Unsupported architecture: $arch"
            ;;
    esac
}

detect_os() {
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$os" in
        linux)
            echo "linux"
            ;;
        *)
            error "Unsupported OS: $os (livekitctl only supports Linux)"
            ;;
    esac
}

get_latest_version() {
    version=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases" | \
        grep -oP '"tag_name":\s*"livekitctl-v\K[0-9]+\.[0-9]+\.[0-9]+' | \
        head -1)
    if [ -z "$version" ]; then
        error "Failed to determine latest version"
    fi
    echo "$version"
}

download_binary() {
    version="$1"
    os="$2"
    arch="$3"
    url="https://github.com/${GITHUB_REPO}/releases/download/livekitctl-v${version}/${BINARY_NAME}-${os}-${arch}"
    tmp_file=$(mktemp)

    info "Downloading livekitctl v${version} for ${os}/${arch}..."
    if ! curl -fsSL "$url" -o "$tmp_file"; then
        rm -f "$tmp_file"
        error "Failed to download from $url"
    fi

    echo "$tmp_file"
}

install_binary() {
    tmp_file="$1"
    dest="${INSTALL_DIR}/${BINARY_NAME}"

    info "Installing to ${dest}..."
    mv "$tmp_file" "$dest"
    chmod 755 "$dest"
}

verify_installation() {
    if command -v "$BINARY_NAME" >/dev/null 2>&1; then
        info "Successfully installed livekitctl"
        "$BINARY_NAME" --help | head -5
    else
        error "Installation failed - binary not found in PATH"
    fi
}

main() {
    info "livekitctl installer"
    info ""

    check_root

    os=$(detect_os)
    arch=$(detect_arch)

    info "Detected: ${os}/${arch}"

    version=$(get_latest_version)
    tmp_file=$(download_binary "$version" "$os" "$arch")
    install_binary "$tmp_file"
    verify_installation

    info ""
    info "Run 'livekitctl bootstrap --help' to get started"
}

main "$@"
