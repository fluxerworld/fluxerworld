#!/usr/bin/env python3

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence

from ci_steps import (
    build_release_metadata,
    build_release_summary,
    write_release_metadata,
    write_release_summary,
)
from ci_workflow import EnvArg, parse_step_env_args
from ci_utils import require_env, run_step


RELEASE_METADATA_REQUIRED_ENV = (
    "GITHUB_RUN_NUMBER",
    "GITHUB_SHA",
    "CHANNEL",
    "SOURCE_REF",
)

RELEASE_SUMMARY_REQUIRED_ENV = (
    "GITHUB_SHA",
    "CHANNEL",
    "VERSION",
    "BUILD_NUMBER",
    "SHA_SHORT",
    "TIMESTAMP",
    "SOURCE_REF",
    "BUILD_RESULT",
    "REGISTRY",
    "DATE_YMD",
)

BASE_RELEASE_ENV_ARGS = (
    EnvArg("--version-input", "VERSION_INPUT"),
    EnvArg("--channel", "CHANNEL"),
    EnvArg("--source-ref", "SOURCE_REF"),
    EnvArg("--build-result", "BUILD_RESULT"),
    EnvArg("--version", "VERSION"),
    EnvArg("--build-number", "BUILD_NUMBER"),
    EnvArg("--sha-short", "SHA_SHORT"),
    EnvArg("--timestamp", "TIMESTAMP"),
    EnvArg("--date-ymd", "DATE_YMD"),
    EnvArg("--image-tags", "IMAGE_TAGS"),
    EnvArg("--image-digest", "IMAGE_DIGEST"),
    EnvArg("--registry", "REGISTRY"),
)


def release_metadata_step() -> None:
    import os

    require_env(RELEASE_METADATA_REQUIRED_ENV)
    metadata = build_release_metadata(
        version_input=os.environ.get("VERSION_INPUT", ""),
        channel=os.environ["CHANNEL"],
        source_ref=os.environ["SOURCE_REF"],
        env=os.environ,
    )
    write_release_metadata(metadata)


def create_release_summary_step(*, title: str, image_name_env: str) -> Callable[[], None]:
    def summary_step() -> None:
        import os

        require_env([*RELEASE_SUMMARY_REQUIRED_ENV, image_name_env])
        summary = build_release_summary(
            title=title,
            channel=os.environ["CHANNEL"],
            version=os.environ["VERSION"],
            build_number=os.environ["BUILD_NUMBER"],
            sha=os.environ["GITHUB_SHA"],
            sha_short=os.environ["SHA_SHORT"],
            timestamp=os.environ["TIMESTAMP"],
            source_ref=os.environ["SOURCE_REF"],
            build_result=os.environ["BUILD_RESULT"],
            image_tags=os.environ.get("IMAGE_TAGS", ""),
            image_digest=os.environ.get("IMAGE_DIGEST", ""),
            registry=os.environ["REGISTRY"],
            image_name=os.environ[image_name_env],
            date_ymd=os.environ["DATE_YMD"],
        )
        write_release_summary(summary, build_result=os.environ["BUILD_RESULT"])

    return summary_step


def build_release_steps(
    *,
    title: str,
    image_name_env: str,
    extra_steps: Mapping[str, Callable[[], None]] | None = None,
) -> dict[str, Callable[[], None]]:
    steps: dict[str, Callable[[], None]] = {"metadata": release_metadata_step}
    if extra_steps:
        steps.update(extra_steps)
    steps["summary"] = create_release_summary_step(title=title, image_name_env=image_name_env)
    return steps


def build_release_env_args(
    *,
    image_name_arg: str,
    image_name_env: str,
    extra_env_args: Sequence[EnvArg] = (),
) -> list[EnvArg]:
    return [
        *BASE_RELEASE_ENV_ARGS,
        *extra_env_args,
        EnvArg(image_name_arg, image_name_env),
    ]


def run_release_workflow(
    *,
    title: str,
    image_name_arg: str,
    image_name_env: str,
    extra_steps: Mapping[str, Callable[[], None]] | None = None,
    extra_env_args: Sequence[EnvArg] = (),
) -> int:
    args = parse_step_env_args(
        build_release_env_args(
            image_name_arg=image_name_arg,
            image_name_env=image_name_env,
            extra_env_args=extra_env_args,
        )
    )
    run_step(
        build_release_steps(
            title=title,
            image_name_env=image_name_env,
            extra_steps=extra_steps,
        ),
        args.step,
    )
    return 0
