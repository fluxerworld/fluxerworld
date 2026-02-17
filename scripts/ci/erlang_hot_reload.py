#!/usr/bin/env python3

import argparse
import base64
import json
import os
import sys


def diff_md5(local_path: str, remote_path: str, out_path: str) -> None:
    remote: dict[str, str] = {}
    with open(remote_path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            parts = line.split(None, 1)
            if len(parts) != 2:
                continue
            mod, md5 = parts
            remote[mod] = md5.strip()

    changed_paths: list[str] = []
    with open(local_path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            parts = line.split(" ", 2)
            if len(parts) != 3:
                continue
            mod, md5, path = parts
            remote_md5 = remote.get(mod)
            if remote_md5 is None or remote_md5 == "null" or remote_md5 != md5:
                changed_paths.append(path)

    with open(out_path, "w", encoding="utf-8") as handle:
        for path in changed_paths:
            handle.write(f"{path}\n")


def build_json(list_path: str) -> None:
    beams: list[dict[str, str]] = []
    with open(list_path, "r", encoding="utf-8") as handle:
        for path in handle:
            path = path.strip()
            if not path:
                continue
            mod = os.path.basename(path)
            if not mod.endswith(".beam"):
                continue
            mod = mod[:-5]
            with open(path, "rb") as beam_file:
                beam_data = beam_file.read()
            beams.append({
                "module": mod,
                "beam_b64": base64.b64encode(beam_data).decode("ascii"),
            })

    payload = {"beams": beams, "purge": "soft"}
    print(json.dumps(payload, separators=(",", ":")))


def verify(mode: str) -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("::error::Empty reload response")
        return 1

    try:
        data = json.loads(raw)
    except Exception as exc:
        print(f"::error::Invalid JSON reload response: {exc}")
        return 1

    results = data.get("results", [])
    if not isinstance(results, list):
        print("::error::Reload response missing results array")
        return 1

    if mode == "strict":
        bad = [
            result for result in results
            if result.get("status") != "ok" or result.get("verified") is not True
        ]
        if bad:
            print("::error::Hot reload verification failed")
            print(json.dumps(bad, indent=2))
            return 1

        warns = [
            result for result in results
            if result.get("purged_old_code") is not True
            or (result.get("lingering_count") or 0) != 0
        ]
        if warns:
            print("::warning::Old code is still lingering for some modules after reload")
            print(json.dumps(warns, indent=2))

        print(f"Verified {len(results)} modules")
        return 0

    if mode == "self":
        bad = [
            result for result in results
            if result.get("status") != "ok" or result.get("verified") is not True
        ]
        if bad:
            print("::error::Hot reload verification failed")
            print(json.dumps(bad, indent=2))
            return 1

        warns = [
            result for result in results
            if result.get("purged_old_code") is not True
            or (result.get("lingering_count") or 0) != 0
        ]
        if warns:
            print("::warning::Self-reload modules may linger until request completes")
            print(json.dumps(warns, indent=2))

        print(f"Verified {len(results)} self modules")
        return 0

    print(f"::error::Unknown verify mode: {mode}")
    return 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    diff_parser = subparsers.add_parser("diff-md5")
    diff_parser.add_argument("local_path")
    diff_parser.add_argument("remote_path")
    diff_parser.add_argument("out_path")

    build_parser = subparsers.add_parser("build-json")
    build_parser.add_argument("list_path")

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--mode", choices=("strict", "self"), required=True)

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "diff-md5":
        diff_md5(args.local_path, args.remote_path, args.out_path)
        return 0
    if args.command == "build-json":
        build_json(args.list_path)
        return 0
    if args.command == "verify":
        return verify(args.mode)
    print(f"::error::Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
