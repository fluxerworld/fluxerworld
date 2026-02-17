#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_steps import INSTALL_RCLONE_SCRIPT, rclone_config_script
from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "install_rclone": INSTALL_RCLONE_SCRIPT,
    "push": rclone_config_script(
        endpoint="$RCLONE_ENDPOINT",
        acl="private",
        expand_vars=True,
    )
    + """
mkdir -p "$RCLONE_SOURCE_DIR"
rclone sync "$RCLONE_SOURCE" "$RCLONE_REMOTE:$RCLONE_BUCKET" --create-empty-src-dirs --exclude "assets/**"
""",
}


def main() -> int:
    args = parse_step_env_args()
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
