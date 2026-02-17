#!/usr/bin/env python3

import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))

from ci_steps import ADD_KNOWN_HOSTS_SCRIPT, record_deploy_commit_script
from ci_workflow import parse_step_env_args
from ci_utils import run_step


STEPS: dict[str, str] = {
    "compile": """
set -euo pipefail
cd fluxer_gateway
rebar3 as prod compile
""",
    "add_known_hosts": ADD_KNOWN_HOSTS_SCRIPT,
    "record_deploy_commit": record_deploy_commit_script(
        include_env=False,
        include_sentry=False,
    ),
    "deploy": """
set -euo pipefail

CONTAINER_ID="$(ssh "${SERVER}" "docker ps -q --filter label=com.docker.swarm.service.name=fluxer-gateway_app | head -1")"
if [ -z "${CONTAINER_ID}" ]; then
  echo "::error::No running container found for service fluxer-gateway_app"
  ssh "${SERVER}" "docker ps --filter 'name=fluxer-gateway_app' --format '{{.ID}} {{.Names}} {{.Status}}'" || true
  exit 1
fi
echo "Container: ${CONTAINER_ID}"

GATEWAY_HTTP_PORT="8080"
echo "Gateway HTTP port: ${GATEWAY_HTTP_PORT}"
if ! ssh "${SERVER}" "docker exec ${CONTAINER_ID} curl -fsS --max-time 3 http://localhost:${GATEWAY_HTTP_PORT}/_health >/dev/null"; then
  echo "::error::Gateway HTTP listener is not reachable on port ${GATEWAY_HTTP_PORT}"
  exit 1
fi

LOCAL_MD5_LINES="$(
  erl -noshell -eval '
    Files = filelib:wildcard("fluxer_gateway/_build/prod/lib/fluxer_gateway/ebin/*.beam"),
    lists:foreach(
      fun(F) ->
        {ok, {M, Md5}} = beam_lib:md5(F),
        Hex = binary:encode_hex(Md5, lowercase),
        io:format("~s ~s ~s~n", [atom_to_list(M), binary_to_list(Hex), F])
      end,
      Files
    ),
    halt().'
)"

REMOTE_MD5_LINES="$(
  ssh "${SERVER}" "docker exec ${CONTAINER_ID} /opt/fluxer_gateway/bin/fluxer_gateway eval '
    Mods = hot_reload:get_loaded_modules(),
    lists:foreach(
      fun(M) ->
        case hot_reload:get_module_info(M) of
          {ok, Info} ->
            V = maps:get(loaded_md5, Info),
            S = case V of
                  null -> \"null\";
                  B when is_binary(B) -> binary_to_list(B)
                end,
            io:format(\"~s ~s~n\", [atom_to_list(M), S]);
          _ ->
            ok
        end
      end,
      Mods
    ),
    ok.
  ' " | tr -d '\r'
)"

LOCAL_MD5_FILE="$(mktemp)"
REMOTE_MD5_FILE="$(mktemp)"
CHANGED_FILE_LIST="$(mktemp)"
CHANGED_MAIN_LIST="$(mktemp)"
CHANGED_SELF_LIST="$(mktemp)"
RELOAD_RESULT_MAIN="$(mktemp)"
RELOAD_RESULT_SELF="$(mktemp)"
trap 'rm -f "${LOCAL_MD5_FILE}" "${REMOTE_MD5_FILE}" "${CHANGED_FILE_LIST}" "${CHANGED_MAIN_LIST}" "${CHANGED_SELF_LIST}" "${RELOAD_RESULT_MAIN}" "${RELOAD_RESULT_SELF}"' EXIT

printf '%s' "${LOCAL_MD5_LINES}" > "${LOCAL_MD5_FILE}"
printf '%s' "${REMOTE_MD5_LINES}" > "${REMOTE_MD5_FILE}"

python3 scripts/ci/erlang_hot_reload.py diff-md5 \
  "${LOCAL_MD5_FILE}" \
  "${REMOTE_MD5_FILE}" \
  "${CHANGED_FILE_LIST}"

mapfile -t CHANGED_FILES < "${CHANGED_FILE_LIST}"

if [ "${#CHANGED_FILES[@]}" -eq 0 ]; then
  echo "No BEAM changes detected, nothing to hot-reload."
  exit 0
fi

echo "Changed modules count: ${#CHANGED_FILES[@]}"

while IFS= read -r p; do
  [ -n "${p}" ] || continue
  m="$(basename "${p}")"
  m="${m%.beam}"
  if [ "${m}" = "hot_reload" ] || [ "${m}" = "hot_reload_handler" ]; then
    printf '%s\n' "${p}" >> "${CHANGED_SELF_LIST}"
  else
    printf '%s\n' "${p}" >> "${CHANGED_MAIN_LIST}"
  fi
done < "${CHANGED_FILE_LIST}"

build_json() {
  python3 scripts/ci/erlang_hot_reload.py build-json "$1"
}

strict_verify() {
  python3 scripts/ci/erlang_hot_reload.py verify --mode strict
}

self_verify() {
  python3 scripts/ci/erlang_hot_reload.py verify --mode self
}

if [ -s "${CHANGED_SELF_LIST}" ]; then
  if ! build_json "${CHANGED_SELF_LIST}" | ssh "${SERVER}" "docker exec -i ${CONTAINER_ID} curl -sS -X POST -H 'Authorization: Bearer ${GATEWAY_ADMIN_SECRET}' -H 'Content-Type: application/json' --data @- http://localhost:${GATEWAY_HTTP_PORT}/_admin/reload" | tee "${RELOAD_RESULT_SELF}" | self_verify; then
    echo "::group::Hot reload response (self)"
    cat "${RELOAD_RESULT_SELF}" || true
    echo "::endgroup::"
    exit 1
  fi
fi

if [ -s "${CHANGED_MAIN_LIST}" ]; then
  if ! build_json "${CHANGED_MAIN_LIST}" | ssh "${SERVER}" "docker exec -i ${CONTAINER_ID} curl -sS -X POST -H 'Authorization: Bearer ${GATEWAY_ADMIN_SECRET}' -H 'Content-Type: application/json' --data @- http://localhost:${GATEWAY_HTTP_PORT}/_admin/reload" | tee "${RELOAD_RESULT_MAIN}" | strict_verify; then
    echo "::group::Hot reload response (main)"
    cat "${RELOAD_RESULT_MAIN}" || true
    echo "::endgroup::"
    exit 1
  fi
fi
""",
}


def main() -> int:
    args = parse_step_env_args(include_server_ip=True)
    run_step(STEPS, args.step)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
