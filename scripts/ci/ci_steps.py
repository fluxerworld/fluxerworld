#!/usr/bin/env python3

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping

from ci_utils import write_github_output, write_github_summary


ADD_KNOWN_HOSTS_SCRIPT = """
set -euo pipefail
mkdir -p ~/.ssh
ssh-keyscan -H "${SERVER_IP}" >> ~/.ssh/known_hosts
"""

INSTALL_DOCKER_PUSSH_SCRIPT = """
set -euo pipefail
mkdir -p ~/.docker/cli-plugins
curl -fsSL https://raw.githubusercontent.com/psviderski/unregistry/v0.3.1/docker-pussh \
  -o ~/.docker/cli-plugins/docker-pussh
chmod +x ~/.docker/cli-plugins/docker-pussh
"""

INSTALL_RCLONE_SCRIPT = """
set -euo pipefail
if ! command -v rclone >/dev/null 2>&1; then
  curl -fsSL https://rclone.org/install.sh | sudo bash
fi
"""


def rclone_config_script(
    *,
    endpoint: str,
    acl: str,
    profile: str = "ovh",
    env_auth: bool = True,
    expand_vars: bool = False,
) -> str:
    heredoc = "RCLONEEOF" if expand_vars else "'RCLONEEOF'"
    env_auth_value = "true" if env_auth else "false"
    lines = [
        "set -euo pipefail",
        "mkdir -p ~/.config/rclone",
        f"cat > ~/.config/rclone/rclone.conf <<{heredoc}",
        f"[{profile}]",
        "type = s3",
        "provider = Other",
        f"env_auth = {env_auth_value}",
        f"endpoint = {endpoint}",
        f"acl = {acl}",
        "RCLONEEOF",
    ]
    return "\n".join(lines) + "\n"


def bot_user_id_script() -> str:
    return (
        "set -euo pipefail\n"
        "echo \"user-id=$(gh api \"/users/${APP_SLUG}[bot]\" --jq .id)\" >> \"$GITHUB_OUTPUT\"\n"
    )


def record_deploy_commit_script(*, include_env: bool, include_sentry: bool) -> str:
    lines = [
        "set -euo pipefail",
        "sha=$(git rev-parse HEAD)",
        "echo \"Deploying commit ${sha}\"",
    ]
    if include_env:
        lines.append("printf 'DEPLOY_SHA=%s\\n' \"$sha\" >> \"$GITHUB_ENV\"")
    if include_sentry:
        lines.extend(
            [
                "printf 'SENTRY_BUILD_SHA=%s\\n' \"$sha\" >> \"$GITHUB_ENV\"",
                "printf 'SENTRY_BUILD_NUMBER=%s\\n' \"$GITHUB_RUN_NUMBER\" >> \"$GITHUB_ENV\"",
                "printf 'SENTRY_BUILD_TIMESTAMP=%s\\n' \"$(date +%s)\" >> \"$GITHUB_ENV\"",
            ]
        )
    return "\n".join(lines) + "\n"


def set_build_timestamp_script(*, env_name: str = "BUILD_TIMESTAMP") -> str:
    return (
        "set -euo pipefail\n"
        f"echo \"{env_name}=$(date -u +%s)\" >> \"$GITHUB_ENV\"\n"
    )


@dataclass(frozen=True)
class ReleaseMetadata:
    version: str
    channel: str
    source_ref: str
    sha_short: str
    timestamp: str
    date_ymd: str
    build_number: str


def build_release_metadata(
    *,
    version_input: str,
    channel: str,
    source_ref: str,
    env: Mapping[str, str],
    now: datetime | None = None,
) -> ReleaseMetadata:
    run_number = env.get("GITHUB_RUN_NUMBER", "")
    sha = env.get("GITHUB_SHA", "")
    version = version_input or f"0.0.{run_number}"
    instant = now or datetime.now(timezone.utc)
    timestamp = instant.strftime("%Y-%m-%dT%H:%M:%SZ")
    date_ymd = instant.strftime("%Y%m%d")
    sha_short = sha[:7]
    return ReleaseMetadata(
        version=version,
        channel=channel,
        source_ref=source_ref,
        sha_short=sha_short,
        timestamp=timestamp,
        date_ymd=date_ymd,
        build_number=run_number,
    )


def write_release_metadata(metadata: ReleaseMetadata) -> None:
    write_github_output(
        {
            "version": metadata.version,
            "channel": metadata.channel,
            "source_ref": metadata.source_ref,
            "sha_short": metadata.sha_short,
            "timestamp": metadata.timestamp,
            "date": metadata.date_ymd,
            "build_number": metadata.build_number,
        }
    )


def build_release_summary(
    *,
    title: str,
    channel: str,
    version: str,
    build_number: str,
    sha: str,
    sha_short: str,
    timestamp: str,
    source_ref: str,
    build_result: str,
    image_tags: str,
    image_digest: str,
    registry: str,
    image_name: str,
    date_ymd: str,
) -> str:
    lines: list[str] = [
        f"## {title}",
        "",
        f"channel: {channel}",
        f"version: v{version}",
        f"build: {build_number}",
        f"sha: {sha} (short: {sha_short})",
        f"time: {timestamp}",
        f"source_ref: {source_ref}",
        "",
        f"build result: {build_result}",
        "",
    ]

    if build_result == "success":
        lines.extend(
            [
                "tags:",
                "```",
                image_tags,
                "```",
                f"digest: `{image_digest}`",
                "",
            ]
        )

    if channel == "nightly":
        lines.extend(
            [
                "pull:",
                "```bash",
                f"docker pull {registry}/{image_name}:nightly",
                f"docker pull {registry}/{image_name}:nightly-{date_ymd}",
                f"docker pull {registry}/{image_name}:sha-{sha_short}",
                "```",
            ]
        )
    else:
        lines.extend(
            [
                "pull:",
                "```bash",
                f"docker pull {registry}/{image_name}:stable",
                f"docker pull {registry}/{image_name}:latest",
                f"docker pull {registry}/{image_name}:v{version}",
                "```",
            ]
        )

    return "\n".join(lines) + "\n"


def write_release_summary(summary: str, *, build_result: str) -> None:
    write_github_summary(summary)
    if build_result == "failure":
        raise SystemExit(1)
