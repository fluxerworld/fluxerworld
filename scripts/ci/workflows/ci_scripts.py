#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "sync": """
set -euo pipefail
cd scripts/ci
uv sync --dev
""",
    "test": """
set -euo pipefail
cd scripts/ci
uv run pytest
""",
}


def main() -> int:
    args = parse_step_env_args()
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
