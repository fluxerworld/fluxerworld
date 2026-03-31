#!/bin/sh
# Post-install script for deb/rpm packages.
# Patches the system wrapper at /usr/bin/fluxer-world to check for a user-local
# updated copy before falling back to the system install. This allows the in-app
# updater to work without root privileges.

WRAPPER="/usr/bin/fluxer-world"

if [ -f "$WRAPPER" ]; then
  cat > "$WRAPPER" <<'EOF'
#!/bin/sh
export GDK_BACKEND=wayland,x11

# Prefer user-local updated copy over system install
LOCAL_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/fluxer-world"
if [ -x "$LOCAL_DIR/fluxer-world" ]; then
  FLUXER_BIN="$LOCAL_DIR/fluxer-world"
else
  FLUXER_BIN="/opt/Fluxer World/fluxer-world"
fi

exec "$FLUXER_BIN" \
  --no-sandbox \
  --enable-features=UseOzonePlatform,WaylandWindowDecorations \
  --ozone-platform-hint=auto \
  --class=org.fluxer.World \
  --wayland-app-id=org.fluxer.World \
  "$@"
EOF
  chmod 755 "$WRAPPER"
fi
