#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Iterable, Sequence


@dataclass(frozen=True)
class EnvArg:
    flag: str
    env: str
    default: str = ""
    dest: str | None = None

    def dest_name(self) -> str:
        if self.dest is not None:
            return self.dest
        return self.flag.lstrip("-").replace("-", "_")


def build_step_parser(
    env_args: Sequence[EnvArg] | None = None,
    *,
    include_server_ip: bool = False,
    step_required: bool = True,
) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    if step_required:
        parser.add_argument("--step", required=True)
    if include_server_ip:
        parser.add_argument("--server-ip", default="")
    for arg in env_args or []:
        parser.add_argument(arg.flag, default=arg.default, dest=arg.dest_name())
    return parser


def apply_env_args(args: argparse.Namespace, env_args: Iterable[EnvArg]) -> None:
    for arg in env_args:
        value = getattr(args, arg.dest_name(), "")
        if value:
            os.environ[arg.env] = value


def apply_server_ip(args: argparse.Namespace) -> None:
    value = getattr(args, "server_ip", "")
    if value:
        os.environ["SERVER_IP"] = value


def parse_step_env_args(
    env_args: Sequence[EnvArg] | None = None,
    *,
    include_server_ip: bool = False,
) -> argparse.Namespace:
    parser = build_step_parser(env_args, include_server_ip=include_server_ip)
    args = parser.parse_args()
    apply_env_args(args, env_args or [])
    if include_server_ip:
        apply_server_ip(args)
    return args


def parse_env_args(env_args: Sequence[EnvArg]) -> argparse.Namespace:
    parser = build_step_parser(env_args, step_required=False)
    args = parser.parse_args()
    apply_env_args(args, env_args)
    return args
