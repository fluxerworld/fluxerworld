#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "install_dependencies": """
set -euo pipefail
pnpm install --frozen-lockfile
""",
    "typecheck": """
set -euo pipefail
pnpm typecheck
""",
    "test": """
set -euo pipefail
pnpm test
""",
    "gateway_compile": """
set -euo pipefail
cd fluxer_gateway
rebar3 compile
""",
    "gateway_dialyzer": """
set -euo pipefail
cd fluxer_gateway
rebar3 dialyzer
""",
    "gateway_eunit": """
set -euo pipefail
cd fluxer_gateway
rebar3 eunit
""",
    "knip": """
set -euo pipefail
pnpm knip
""",
}


def main() -> int:
    args = parse_step_env_args()
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
