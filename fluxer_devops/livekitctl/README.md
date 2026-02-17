# livekitctl

A CLI tool for bootstrapping self-hosted LiveKit SFU infrastructure for Fluxer voice and video.

## Installation

```bash
curl -fsSL https://fluxer.app/get/livekitctl | sudo bash
```

## Overview

livekitctl automates the installation and configuration of a complete LiveKit media server stack including:

- **LiveKit** - WebRTC SFU for voice and video
- **Caddy** - Reverse proxy with automatic TLS (built with L4 module for TCP/UDP)
- **coturn** - TURN/STUN server for NAT traversal
- **KV store** - Redis-compatible key-value store for LiveKit state

## Prerequisites

- Linux server (Debian/Ubuntu, RHEL/CentOS, or Arch-based)
- Root access
- DNS records configured for your LiveKit and TURN domains pointing to your server's public IP

## Commands

### bootstrap

Install and configure the complete LiveKit stack.

```bash
livekitctl bootstrap \
  --livekit-domain livekit.example.com \
  --turn-domain turn.example.com \
  --email admin@example.com
```

Required flags:

- `--livekit-domain <domain>` - Domain for LiveKit WebSocket/HTTP connections
- `--turn-domain <domain>` - Domain for TURN relay server
- `--email <email>` - ACME email for TLS certificate issuance

Optional flags:

- `--livekit-version <version>` - LiveKit version (default: v1.9.11)
- `--caddy-version <version>` - Caddy version (default: v2.10.2)
- `--caddy-l4-version <version>` - Caddy L4 module version (default: master)
- `--xcaddy-version <version>` - xcaddy build tool version (default: v0.4.5)
- `--install-dir <path>` - Override LiveKit install directory (default: /opt/livekit)
- `--firewall` - Configure detected firewall tool (ufw, firewalld, iptables)
- `--kv-port <port>` - KV store port (default: 6379)
- `--kv-port-auto` - Pick a free KV port from 6379-6382
- `--webhook-url <url>` - Webhook URL (repeatable)
- `--webhook-urls-file <file>` - File with webhook URLs (one per line)
- `--allow-http-webhooks` - Allow http:// webhook URLs
- `--dns-timeout <seconds>` - DNS wait timeout (default: 900)
- `--dns-interval <seconds>` - DNS check interval (default: 10)
- `--print-secrets` - Print generated secrets JSON to stdout

### status

Show systemd service status for all managed services.

```bash
livekitctl status
```

### logs

Show systemd logs for a specific service.

```bash
livekitctl logs --service livekit.service [--lines 200]
```

Flags:

- `--service <unit>` - systemd unit name (required), e.g., `livekit.service`, `caddy.service`
- `--lines <n>` - Number of log lines to show (default: 200)

### restart

Restart one or more services. If no services specified, restarts all managed services.

```bash
livekitctl restart [services...]
```

Examples:

```bash
livekitctl restart                    # Restart all services
livekitctl restart livekit.service    # Restart only LiveKit
livekitctl restart caddy.service livekit-coturn.service
```

Managed services:

- `livekit-kv.service` - KV store
- `livekit-coturn.service` - TURN server
- `livekit.service` - LiveKit SFU
- `caddy.service` - Reverse proxy

### webhook

Manage LiveKit webhook URLs. Changes are written to config and LiveKit is restarted.

```bash
livekitctl webhook list
livekitctl webhook add <url> [--allow-http-webhooks]
livekitctl webhook remove <url>
livekitctl webhook set --url <url> [--url <url>...] [--file <path>] [--allow-http-webhooks]
```

Subcommands:

- `list` - List configured webhook URLs
- `add <url>` - Add a webhook URL
- `remove <url>` - Remove a webhook URL
- `set` - Replace all webhook URLs

## Port configuration

Default port allocations:

| Port        | Protocol | Service                   |
| ----------- | -------- | ------------------------- |
| 7880        | TCP      | LiveKit HTTP (internal)   |
| 7881        | TCP      | LiveKit RTC               |
| 50000-60000 | UDP      | LiveKit RTC media         |
| 3478        | UDP      | TURN listen               |
| 40000-49999 | UDP      | TURN relay                |
| 6379        | TCP      | KV store (localhost only) |

## State and configuration files

```
/etc/livekit/
  livekitctl-state.json       # Bootstrap state
  secrets.json                # Generated API keys and secrets
  livekit.yaml                # LiveKit server config
  caddy.json                  # Caddy config
  coturn.conf                 # TURN server config

/opt/livekit/
  bin/
    livekit-server            # LiveKit binary
```

## DNS setup

Before running bootstrap, create DNS records pointing to your server's public IP:

```
A    livekit.example.com  →  <your-ipv4>
A    turn.example.com     →  <your-ipv4>
```

If your server has IPv6:

```
AAAA livekit.example.com  →  <your-ipv6>
AAAA turn.example.com     →  <your-ipv6>
```

The bootstrap command waits for DNS propagation before requesting TLS certificates.

## Global flags

- `--state <path>` - Path to state file (default: /etc/livekit/livekitctl-state.json)
