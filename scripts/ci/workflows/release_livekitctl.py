#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from cli_release import (
    determine_cli_version,
    generate_checksums,
    prepare_release_assets,
    write_cli_version_outputs,
)
from ci_workflow import EnvArg, apply_env_args, build_step_parser
from ci_utils import require_env, run_step


BINARY_PREFIX = "livekitctl"
TAG_PREFIX = "livekitctl-v"
PROJECT_DIR = pathlib.Path("fluxer_devops/livekitctl")


def determine_version_step() -> None:
    import os

    require_env(["EVENT_NAME"])
    info = determine_cli_version(
        event_name=os.environ["EVENT_NAME"],
        input_version=os.environ.get("INPUT_VERSION", ""),
        ref_name=os.environ.get("REF_NAME", ""),
        tag_prefix=TAG_PREFIX,
    )
    write_cli_version_outputs(info)


def build_binary_step() -> None:
    from ci_utils import run_bash

    run_bash(
        f"""
set -euo pipefail
cd {PROJECT_DIR}
go build -ldflags=\"-s -w\" -o {BINARY_PREFIX}-${{GOOS}}-${{GOARCH}} .
"""
    )


def prepare_release_assets_step(artifacts_dir: pathlib.Path, release_dir: pathlib.Path) -> None:
    prepare_release_assets(
        artifacts_dir=artifacts_dir,
        release_dir=release_dir,
        binary_prefix=BINARY_PREFIX,
    )


def generate_checksums_step(release_dir: pathlib.Path) -> None:
    files = release_dir.glob(f"{BINARY_PREFIX}-*")
    generate_checksums(files, release_dir / "checksums.txt")


def create_tag_step() -> None:
    from ci_utils import run_bash
    from ci_utils import require_env

    require_env(["TAG", "VERSION"])
    run_bash(
        """
set -euo pipefail
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git tag -a "${TAG}" -m "Release livekitctl v${VERSION}"
git push origin "${TAG}"
"""
    )


STEPS = {
    "determine_version": determine_version_step,
    "build_binary": build_binary_step,
    "prepare_release_assets": prepare_release_assets_step,
    "generate_checksums": generate_checksums_step,
    "create_tag": create_tag_step,
}


ENV_ARGS = [
    EnvArg("--event-name", "EVENT_NAME"),
    EnvArg("--input-version", "INPUT_VERSION"),
    EnvArg("--ref-name", "REF_NAME"),
    EnvArg("--version", "VERSION"),
    EnvArg("--tag", "TAG"),
]


def parse_args():
    parser = build_step_parser(ENV_ARGS)
    parser.add_argument("--artifacts-dir", default="artifacts")
    parser.add_argument("--release-dir", default="release")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    apply_env_args(args, ENV_ARGS)

    if args.step == "prepare_release_assets":
        prepare_release_assets_step(
            pathlib.Path(args.artifacts_dir),
            pathlib.Path(args.release_dir),
        )
        return 0

    if args.step == "generate_checksums":
        generate_checksums_step(pathlib.Path(args.release_dir))
        return 0

    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
