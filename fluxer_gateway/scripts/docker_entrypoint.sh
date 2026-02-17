#!/usr/bin/env sh

set -eu

NODE_BASE_NAME="${FLUXER_GATEWAY_NODE_BASENAME:-fluxer_gateway}"

if [ -z "${FLUXER_GATEWAY_NODE_FLAG:-}" ] && [ -n "${FLUXER_GATEWAY_NODE_NAME:-}" ]; then
	case "${FLUXER_GATEWAY_NODE_NAME}" in
		*@*)
			FLUXER_GATEWAY_NODE_FLAG="-name"
			;;
		*)
			FLUXER_GATEWAY_NODE_FLAG="-sname"
			;;
	esac
	export FLUXER_GATEWAY_NODE_FLAG
fi

if [ -z "${FLUXER_GATEWAY_NODE_HOST:-}" ]; then
	if [ -n "${HOSTNAME:-}" ]; then
		FLUXER_GATEWAY_NODE_HOST="$HOSTNAME"
	else
		FLUXER_GATEWAY_NODE_HOST="$(hostname)"
	fi
	export FLUXER_GATEWAY_NODE_HOST
fi

if [ -n "${FLUXER_GATEWAY_NODE_FLAG:-}" ]; then
	case "$FLUXER_GATEWAY_NODE_FLAG" in
		-name | -sname)
			;;
		*)
			echo "Invalid FLUXER_GATEWAY_NODE_FLAG: $FLUXER_GATEWAY_NODE_FLAG" >&2
			exit 64
			;;
	esac
fi

if [ -z "${FLUXER_GATEWAY_NODE_FLAG:-}" ]; then
	NODE_MODE=""
	if [ -n "${FLUXER_GATEWAY_NODE_MODE:-}" ]; then
		NODE_MODE="$FLUXER_GATEWAY_NODE_MODE"
	fi

	if [ -z "$NODE_MODE" ]; then
		FQDN_HOST=""
		if command -v hostname >/dev/null 2>&1; then
			FQDN_HOST="$(hostname -f 2>/dev/null || true)"
		fi

		if [ -n "$FQDN_HOST" ] && printf '%s' "$FQDN_HOST" | grep -q '\.'; then
			NODE_MODE="long"
			FLUXER_GATEWAY_NODE_HOST="$FQDN_HOST"
		else
			if printf '%s' "$FLUXER_GATEWAY_NODE_HOST" | grep -q '\.'; then
				NODE_MODE="long"
			else
				NODE_MODE="short"
			fi
		fi
	fi

	case "$NODE_MODE" in
		long)
			FLUXER_GATEWAY_NODE_FLAG="-name"
			;;
		short)
			FLUXER_GATEWAY_NODE_FLAG="-sname"
			;;
		*)
			echo "Invalid FLUXER_GATEWAY_NODE_MODE: $NODE_MODE" >&2
			exit 64
			;;
	esac

	export FLUXER_GATEWAY_NODE_FLAG
	export FLUXER_GATEWAY_NODE_HOST
fi

if [ -z "${FLUXER_GATEWAY_NODE_NAME:-}" ]; then
	if [ "$FLUXER_GATEWAY_NODE_FLAG" = "-name" ]; then
		FLUXER_GATEWAY_NODE_NAME="${NODE_BASE_NAME}@${FLUXER_GATEWAY_NODE_HOST}"
	else
		SAFE_HOST="$(printf '%s' "$FLUXER_GATEWAY_NODE_HOST" | tr -c 'A-Za-z0-9' '_' | tr 'A-Z' 'a-z')"
		FLUXER_GATEWAY_NODE_NAME="${NODE_BASE_NAME}_${SAFE_HOST}"
	fi
	export FLUXER_GATEWAY_NODE_NAME
fi

if [ "$FLUXER_GATEWAY_NODE_FLAG" = "-sname" ]; then
	case "$FLUXER_GATEWAY_NODE_NAME" in
		*@*)
			echo "FLUXER_GATEWAY_NODE_NAME must not include '@' when using -sname." >&2
			exit 64
			;;
	esac
fi

exec /opt/fluxer_gateway/bin/fluxer_gateway foreground
