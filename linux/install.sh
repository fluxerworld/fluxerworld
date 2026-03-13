#!/bin/sh
# Fluxer World — Linux installer
# Installs the app from an extracted tar.gz into user-local directories.
# Usage: ./install.sh [--autostart]

set -e

APP_NAME="fluxer-world"
APP_ID="org.fluxer.World"
DISPLAY_NAME="Fluxer World"
INSTALL_DIR="$HOME/.local/share/$APP_NAME"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor"
AUTOSTART_DIR="$HOME/.config/autostart"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Detect the app directory (the extracted tar.gz root with the binary)
if [ -f "$SCRIPT_DIR/fluxer-desktop" ]; then
    APP_SOURCE="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../fluxer-desktop" ]; then
    APP_SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    echo "Error: Cannot find fluxer-desktop binary."
    echo "Run this script from inside the extracted tar.gz directory."
    exit 1
fi

AUTOSTART=false
for arg in "$@"; do
    case "$arg" in
        --autostart) AUTOSTART=true ;;
        --help|-h)
            echo "Usage: $0 [--autostart]"
            echo "  --autostart  Start Fluxer World automatically on login"
            exit 0
            ;;
    esac
done

echo "Installing $DISPLAY_NAME to $INSTALL_DIR ..."

# Copy app files
mkdir -p "$INSTALL_DIR"
cp -r "$APP_SOURCE"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/fluxer-desktop"
# Chrome sandbox needs suid but we use --no-sandbox in wrapper
chmod -f 4755 "$INSTALL_DIR/chrome-sandbox" 2>/dev/null || true

# Create wrapper script in bin dir
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/$APP_NAME" <<'EOF'
#!/bin/sh
exec "$HOME/.local/share/fluxer-world/fluxer-desktop" \
  --no-sandbox \
  --enable-features=UseOzonePlatform,WaylandWindowDecorations \
  --ozone-platform-hint=auto \
  "$@"
EOF
chmod +x "$BIN_DIR/$APP_NAME"

# Install .desktop file
mkdir -p "$APPS_DIR"
cat > "$APPS_DIR/$APP_ID.desktop" <<EOF
[Desktop Entry]
Name=$DISPLAY_NAME
Comment=Fluxer World desktop client
Exec=$BIN_DIR/$APP_NAME %U
Icon=$APP_ID
Terminal=false
Type=Application
Categories=Network;InstantMessaging;
StartupWMClass=fluxer-world
MimeType=x-scheme-handler/fluxerworld;
EOF

# Install icons
ICON_SOURCE="$INSTALL_DIR/resources/assets/icons"
if [ -f "$ICON_SOURCE/icon.png" ]; then
    for size in 16 32 48 64 128 256 512; do
        icon_dir="$ICONS_DIR/${size}x${size}/apps"
        mkdir -p "$icon_dir"
        if command -v convert >/dev/null 2>&1; then
            convert "$ICON_SOURCE/icon.png" -resize "${size}x${size}" "$icon_dir/$APP_ID.png"
        elif [ $size -eq 512 ] || [ $size -eq 256 ] || [ $size -eq 128 ]; then
            # Fallback: copy the full-size icon for larger sizes
            cp "$ICON_SOURCE/icon.png" "$icon_dir/$APP_ID.png"
        fi
    done
    # Always install the 512px master icon
    mkdir -p "$ICONS_DIR/512x512/apps"
    cp "$ICON_SOURCE/icon.png" "$ICONS_DIR/512x512/apps/$APP_ID.png"
fi

# Register protocol handler
if command -v xdg-mime >/dev/null 2>&1; then
    xdg-mime default "$APP_ID.desktop" x-scheme-handler/fluxerworld 2>/dev/null || true
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t "$ICONS_DIR" 2>/dev/null || true
fi

# Autostart
if [ "$AUTOSTART" = true ]; then
    mkdir -p "$AUTOSTART_DIR"
    cat > "$AUTOSTART_DIR/$APP_ID.desktop" <<EOF
[Desktop Entry]
Name=$DISPLAY_NAME
Exec=$BIN_DIR/$APP_NAME --start-minimized
Terminal=false
Type=Application
X-GNOME-Autostart-enabled=true
EOF
    echo "Autostart enabled."
fi

echo ""
echo "$DISPLAY_NAME installed successfully!"
echo ""
echo "  Binary:   $BIN_DIR/$APP_NAME"
echo "  App data: $INSTALL_DIR"
echo ""
if echo "$PATH" | grep -q "$BIN_DIR"; then
    echo "You can now launch it from your app menu or by running: $APP_NAME"
else
    echo "Add $BIN_DIR to your PATH to run '$APP_NAME' from the terminal:"
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
echo ""
echo "To uninstall, run: $SCRIPT_DIR/uninstall.sh"
