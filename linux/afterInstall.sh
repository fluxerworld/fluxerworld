#!/bin/sh
# Post-install script for deb/rpm packages.
# Patches the system wrapper at /usr/bin/fluxer-world to check for a user-local
# updated copy before falling back to the system install. This allows the in-app
# updater to work without root privileges.

WRAPPER="/usr/bin/fluxer-world"

if [ -f "$WRAPPER" ]; then
  cat > "$WRAPPER" <<'EOF'
#!/bin/sh
LOCAL_DIR="$HOME/.local/share/fluxer-world"
if [ -x "$LOCAL_DIR/fluxer-world" ]; then
  exec "$LOCAL_DIR/fluxer-world" --no-sandbox "$@"
else
  exec "/opt/Fluxer World/fluxer-world" --no-sandbox "$@"
fi
EOF
  chmod 755 "$WRAPPER"
fi
