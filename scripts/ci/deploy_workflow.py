#!/usr/bin/env python3

from __future__ import annotations

from collections.abc import Mapping, Sequence

from ci_steps import (
    ADD_KNOWN_HOSTS_SCRIPT,
    INSTALL_DOCKER_PUSSH_SCRIPT,
    record_deploy_commit_script,
    set_build_timestamp_script,
)
from ci_workflow import EnvArg, parse_step_env_args
from ci_utils import Step, run_step


def build_standard_deploy_steps(
    *,
    push_and_deploy_script: str,
    include_sentry: bool = False,
    include_build_timestamp: bool = True,
) -> dict[str, Step]:
    steps: dict[str, Step] = {
        "record_deploy_commit": record_deploy_commit_script(
            include_env=True,
            include_sentry=include_sentry,
        ),
    }
    if include_build_timestamp:
        steps["set_build_timestamp"] = set_build_timestamp_script()
    steps["install_docker_pussh"] = INSTALL_DOCKER_PUSSH_SCRIPT
    steps["add_known_hosts"] = ADD_KNOWN_HOSTS_SCRIPT
    steps["push_and_deploy"] = push_and_deploy_script
    return steps


def run_deploy_workflow(
    steps: Mapping[str, Step],
    *,
    env_args: Sequence[EnvArg] | None = None,
) -> int:
    args = parse_step_env_args(env_args, include_server_ip=True)
    run_step(steps, args.step)
    return 0
