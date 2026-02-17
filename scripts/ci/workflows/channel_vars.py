#!/usr/bin/env python3

import os
import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import EnvArg, parse_env_args
from ci_utils import require_env, write_github_output


ENV_ARGS = [
    EnvArg("--event-name", "EVENT_NAME"),
    EnvArg("--ref-name", "REF_NAME"),
    EnvArg("--dispatch-channel", "DISPATCH_CHANNEL"),
]


def determine_channel(
    *,
    event_name: str,
    ref_name: str,
    dispatch_channel: str,
) -> str:
    if event_name == "push":
        return "canary" if ref_name == "canary" else "stable"
    return "canary" if dispatch_channel == "canary" else "stable"


def main() -> int:
    parse_env_args(ENV_ARGS)
    require_env(["EVENT_NAME"])
    channel = determine_channel(
        event_name=os.environ.get("EVENT_NAME", ""),
        ref_name=os.environ.get("REF_NAME", ""),
        dispatch_channel=os.environ.get("DISPATCH_CHANNEL", ""),
    )

    stack_suffix = "-canary" if channel == "canary" else ""
    is_canary = "true" if channel == "canary" else "false"

    write_github_output(
        {
            "channel": channel,
            "is_canary": is_canary,
            "stack_suffix": stack_suffix,
        }
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
