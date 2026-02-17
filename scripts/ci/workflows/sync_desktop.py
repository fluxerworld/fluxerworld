#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_steps import bot_user_id_script
from ci_workflow import EnvArg, parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "get_user_id": bot_user_id_script(),
    "determine_branch": """
set -euo pipefail
if [[ -n "${INPUT_BRANCH}" ]]; then
  echo "name=${INPUT_BRANCH}" >> "$GITHUB_OUTPUT"
else
  echo "name=${REF_NAME}" >> "$GITHUB_OUTPUT"
fi
""",
    "clone_target": """
set -euo pipefail
git clone --depth 1 "https://x-access-token:${TOKEN}@github.com/fluxerapp/fluxer_desktop.git" target || {
  mkdir target
  cd target
  git init
  git remote add origin "https://x-access-token:${TOKEN}@github.com/fluxerapp/fluxer_desktop.git"
}
""",
    "configure_git": """
set -euo pipefail
cd target
git config user.name "${APP_SLUG}[bot]"
git config user.email "${USER_ID}+${APP_SLUG}[bot]@users.noreply.github.com"
""",
    "checkout_or_create_branch": """
set -euo pipefail
cd target
BRANCH="${BRANCH_NAME}"

if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
else
  git checkout --orphan "$BRANCH"
  git rm -rf . 2>/dev/null || true
fi
""",
    "sync_files": """
set -euo pipefail
find target -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a source/fluxer_desktop/. target/
""",
    "commit_and_push": """
set -euo pipefail
cd target
BRANCH="${BRANCH_NAME}"
SOURCE_SHA="$(git -C ../source rev-parse --short HEAD)"

git add -A

if git diff --cached --quiet; then
  echo "No changes to commit"
  exit 0
fi

git commit -m "Sync from fluxerapp/fluxer @ ${SOURCE_SHA}"
git push origin "HEAD:refs/heads/${BRANCH}"

echo "Synced to fluxerapp/fluxer_desktop:${BRANCH}"
""",
    "summary": """
set -euo pipefail
{
  echo "## Desktop Sync Complete"
  echo ""
  echo "- **Source:** \`fluxerapp/fluxer:${BRANCH_NAME}\`"
  echo "- **Destination:** \`fluxerapp/fluxer_desktop:${BRANCH_NAME}\`"
  echo "- **Commit:** \`$(git -C source rev-parse --short HEAD)\`"
} >> "$GITHUB_STEP_SUMMARY"
""",
}


def main() -> int:
    args = parse_step_env_args(
        [
            EnvArg("--app-slug", "APP_SLUG"),
            EnvArg("--token", "TOKEN"),
            EnvArg("--user-id", "USER_ID"),
            EnvArg("--input-branch", "INPUT_BRANCH"),
            EnvArg("--ref-name", "REF_NAME"),
            EnvArg("--branch-name", "BRANCH_NAME"),
        ]
    )
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
