#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import EnvArg
from ci_utils import require_env, write_github_output
from release_workflow import build_release_steps, run_release_workflow


def determine_build_targets_step() -> None:
    import os

    require_env(["EVENT_NAME"])
    if os.environ["EVENT_NAME"] == "workflow_dispatch":
        write_github_output({"server": os.environ.get("BUILD_SERVER_INPUT", "")})
        return
    write_github_output({"server": "true"})


EXTRA_ENV_ARGS = [
    EnvArg("--event-name", "EVENT_NAME"),
    EnvArg("--build-server-input", "BUILD_SERVER_INPUT"),
]

STEPS = build_release_steps(
    title="Fluxer Server release",
    image_name_env="IMAGE_NAME_SERVER",
    extra_steps={"determine_build_targets": determine_build_targets_step},
)


def main() -> int:
    return run_release_workflow(
        title="Fluxer Server release",
        image_name_arg="--image-name-server",
        image_name_env="IMAGE_NAME_SERVER",
        extra_steps={"determine_build_targets": determine_build_targets_step},
        extra_env_args=EXTRA_ENV_ARGS,
    )


if __name__ == "__main__":
    raise SystemExit(main())
