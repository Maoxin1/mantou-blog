#!/usr/bin/env python3
"""Verify a real CMS canary pull request without changing remote state."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys


FRONT_MATTER_CHANGE_RE = re.compile(
    r"^[+-](?![+-])(?P<key>[a-zA-Z_][\w-]*):",
    re.MULTILINE,
)
WORKFLOW_STATUSES = ("draft", "pending_review", "pending_publish")


def validate_cms_pr(
    pull_request: dict[str, object],
    diff: str,
    *,
    expected_file: str,
    allowed_front_matter_keys: set[str],
    expected_workflow_status: str = "draft",
) -> list[str]:
    """Return acceptance failures for a Sveltia workflow pull request."""

    issues: list[str] = []

    if pull_request.get("state") != "OPEN":
        issues.append("pull request must remain open during acceptance")
    if pull_request.get("baseRefName") != "main":
        issues.append("pull request base must be protected main")

    head = str(pull_request.get("headRefName", ""))
    if not head.startswith("cms/"):
        issues.append("pull request branch must use the cms/ prefix")

    expected_is_draft = expected_workflow_status == "draft"
    if expected_is_draft and pull_request.get("isDraft") is not True:
        issues.append("draft status must be a real GitHub Draft PR")
    if not expected_is_draft and pull_request.get("isDraft") is not False:
        issues.append(
            f"{expected_workflow_status} status must not be a GitHub Draft PR"
        )

    labels = {
        str(label.get("name"))
        for label in pull_request.get("labels", [])
        if isinstance(label, dict)
    }
    expected_label = f"sveltia-cms/{expected_workflow_status}"
    workflow_labels = labels & {
        f"sveltia-cms/{status}" for status in WORKFLOW_STATUSES
    }
    if workflow_labels != {expected_label}:
        issues.append(
            f"expected workflow status must carry only the {expected_label} label; "
            f"found {sorted(workflow_labels)!r}"
        )

    files = [
        str(file.get("path"))
        for file in pull_request.get("files", [])
        if isinstance(file, dict)
    ]
    if files != [expected_file]:
        issues.append(
            "canary pull request must change exactly one expected file: "
            f"expected {expected_file!r}, found {files!r}"
        )

    changed_keys = {
        match.group("key") for match in FRONT_MATTER_CHANGE_RE.finditer(diff)
    }
    unrelated_keys = changed_keys - allowed_front_matter_keys
    if unrelated_keys:
        issues.append(
            "CMS changed unrelated Front Matter keys: "
            + ", ".join(sorted(unrelated_keys))
        )

    missing_keys = allowed_front_matter_keys - changed_keys
    if missing_keys:
        issues.append(
            "CMS diff does not contain the expected Front Matter keys: "
            + ", ".join(sorted(missing_keys))
        )

    return issues


def _run_gh(arguments: list[str]) -> str:
    result = subprocess.run(
        ["gh", *arguments],
        check=True,
        capture_output=True,
        encoding="utf-8",
    )
    return result.stdout


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify a real Sveltia workflow PR and its minimal content diff.",
    )
    parser.add_argument("pr", type=int, help="GitHub pull request number")
    parser.add_argument("--repo", default="Maoxin1/mantou-blog")
    parser.add_argument("--expected-file", required=True)
    parser.add_argument(
        "--expected-status",
        choices=WORKFLOW_STATUSES,
        default="draft",
        help="Expected Sveltia Editorial Workflow stage",
    )
    parser.add_argument(
        "--allowed-key",
        action="append",
        dest="allowed_keys",
        required=True,
        help="Front Matter key intentionally changed; repeat when needed",
    )
    args = parser.parse_args()

    try:
        payload = json.loads(
            _run_gh(
                [
                    "pr",
                    "view",
                    str(args.pr),
                    "--repo",
                    args.repo,
                    "--json",
                    "baseRefName,headRefName,isDraft,labels,state,files",
                ]
            )
        )
        diff = _run_gh(
            ["pr", "diff", str(args.pr), "--repo", args.repo],
        )
    except (json.JSONDecodeError, OSError, subprocess.CalledProcessError) as error:
        print(f"CMS PR verification could not run: {error}")
        return 2

    issues = validate_cms_pr(
        payload,
        diff,
        expected_file=args.expected_file,
        allowed_front_matter_keys=set(args.allowed_keys),
        expected_workflow_status=args.expected_status,
    )

    if issues:
        print("CMS PR verification failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(
        f"CMS PR verification passed: {args.expected_status} status, expected "
        "file only, minimal Front Matter diff."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
