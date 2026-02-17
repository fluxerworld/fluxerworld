#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_workflow import EnvArg, parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "verify": """
set -euo pipefail
src="${SRC}"
dst="${DST}"

git fetch origin "${dst}" "${src}" --prune

# Ensure HEAD is exactly origin/src
git reset --hard "origin/${src}"

# FF-only requirement: dst must be an ancestor of src
if ! git merge-base --is-ancestor "origin/${dst}" "origin/${src}"; then
  echo "::error::Cannot fast-forward: origin/${dst} is not an ancestor of origin/${src} (branches diverged)."
  exit 1
fi

ahead="$(git rev-list --count "origin/${dst}..origin/${src}")"
echo "ahead=$ahead" >> "$GITHUB_OUTPUT"

{
  echo "## Promote \`${src}\` → \`${dst}\` (ff-only)"
  echo ""
  echo "- \`${dst}\`: \`$(git rev-parse "origin/${dst}")\`"
  echo "- \`${src}\`: \`$(git rev-parse "origin/${src}")\`"
  echo "- Commits to promote: **${ahead}**"
  echo ""
  echo "### Commits"
  if [ "$ahead" -eq 0 ]; then
    echo "_Nothing to promote._"
  else
    git log --oneline --decorate "origin/${dst}..origin/${src}"
  fi
} >> "$GITHUB_STEP_SUMMARY"
""",
    "push": """
set -euo pipefail
dst="${DST}"
# Push src HEAD to dst (no merge commit, same SHAs)
git push origin "HEAD:refs/heads/${dst}"
""",
    "dry_run": """
echo "No push performed (dry_run=${DRY_RUN}, ahead=${AHEAD})."
""",
}


def main() -> int:
    args = parse_step_env_args(
        [
            EnvArg("--src", "SRC"),
            EnvArg("--dst", "DST"),
            EnvArg("--dry-run", "DRY_RUN"),
            EnvArg("--ahead", "AHEAD"),
        ]
    )
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
