#!/usr/bin/env python3

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path
from typing import Iterable

from ci_utils import write_github_output


@dataclass(frozen=True)
class CliVersion:
    version: str
    tag: str


def determine_cli_version(
    *,
    event_name: str,
    input_version: str,
    ref_name: str,
    tag_prefix: str,
) -> CliVersion:
    if event_name == "workflow_dispatch":
        version = input_version
        if not version:
            raise SystemExit("Missing version input")
        tag = f"{tag_prefix}{version}"
        return CliVersion(version=version, tag=tag)

    if not ref_name:
        raise SystemExit("Missing ref name")
    version = ref_name
    if version.startswith(tag_prefix):
        version = version[len(tag_prefix) :]
    if not version:
        raise SystemExit("Unable to determine version from ref")
    return CliVersion(version=version, tag=ref_name)


def write_cli_version_outputs(info: CliVersion) -> None:
    write_github_output({"version": info.version, "tag": info.tag})


def prepare_release_assets(
    *,
    artifacts_dir: Path,
    release_dir: Path,
    binary_prefix: str,
) -> list[Path]:
    release_dir.mkdir(parents=True, exist_ok=True)
    output_files: list[Path] = []

    for entry in sorted(artifacts_dir.glob(f"{binary_prefix}-*")):
        if not entry.is_dir():
            continue
        name = entry.name
        source = entry / name
        if not source.exists():
            raise SystemExit(f"Missing binary {source}")
        target = release_dir / name
        target.write_bytes(source.read_bytes())
        target.chmod(0o755)
        output_files.append(target)

    if not output_files:
        raise SystemExit("No release assets found")

    return output_files


def generate_checksums(files: Iterable[Path], checksums_path: Path) -> None:
    lines: list[str] = []
    for path in sorted(files):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {path.name}")
    checksums_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
