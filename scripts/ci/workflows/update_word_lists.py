#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "download": """
set -euo pipefail
curl -fsSL https://raw.githubusercontent.com/tailscale/tailscale/refs/heads/main/words/scales.txt -o /tmp/scales.txt
curl -fsSL https://raw.githubusercontent.com/tailscale/tailscale/refs/heads/main/words/tails.txt -o /tmp/tails.txt
""",
    "check_changes": """
set -euo pipefail
if ! diff -q /tmp/scales.txt fluxer_api/src/words/scales.txt > /dev/null 2>&1 || \
   ! diff -q /tmp/tails.txt fluxer_api/src/words/tails.txt > /dev/null 2>&1; then
  printf 'changes_detected=true\n' >> "$GITHUB_OUTPUT"
  echo "Changes detected in word lists"
else
  printf 'changes_detected=false\n' >> "$GITHUB_OUTPUT"
  echo "No changes detected in word lists"
fi
""",
    "update": """
set -euo pipefail
cp /tmp/scales.txt fluxer_api/src/words/scales.txt
cp /tmp/tails.txt fluxer_api/src/words/tails.txt
""",
    "no_changes": """
echo "Word lists are already up to date."
""",
}


def main() -> int:
    args = parse_step_env_args()
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
