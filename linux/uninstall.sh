#!/bin/sh
# Fluxer World — Linux uninstaller
# Removes everything installed by install.sh

set -e

APP_NAME="fluxer-world"
APP_ID="org.fluxer.World"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor"
AUTOSTART_DIR="$HOME/.config/autostart"

echo "Uninstalling Fluxer World ..."

# Remove app files
if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  Removed $INSTALL_DIR"
fi

# Remove binary
if [ -f "$BIN_DIR/$APP_NAME" ]; then
    rm -f "$BIN_DIR/$APP_NAME"
    echo "  Removed $BIN_DIR/$APP_NAME"
fi

# Remove desktop entry
if [ -f "$APPS_DIR/$APP_ID.desktop" ]; then
    rm -f "$APPS_DIR/$APP_ID.desktop"
    echo "  Removed desktop entry"
fi

# Remove autostart entry
if [ -f "$AUTOSTART_DIR/$APP_ID.desktop" ]; then
    rm -f "$AUTOSTART_DIR/$APP_ID.desktop"
    echo "  Removed autostart entry"
fi

# Remove icons
for size in 16 32 48 64 128 256 512; do
    icon="$ICONS_DIR/${size}x${size}/apps/$APP_ID.png"
    if [ -f "$icon" ]; then
        rm -f "$icon"
    fi
done
echo "  Removed icons"

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICONS_DIR" 2>/dev/null || true
fi

echo ""
echo "Fluxer World has been uninstalled."
