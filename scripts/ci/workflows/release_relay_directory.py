#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from release_workflow import build_release_steps, run_release_workflow


STEPS = build_release_steps(
    title="Fluxer Relay Directory release",
    image_name_env="IMAGE_NAME",
)


def main() -> int:
    return run_release_workflow(
        title="Fluxer Relay Directory release",
        image_name_arg="--image-name",
        image_name_env="IMAGE_NAME",
    )


if __name__ == "__main__":
    raise SystemExit(main())
