#!/usr/bin/env python3
"""Validate dated post filenames against front matter.

Checks only files matching: content/posts/YYYY-MM-DD-<slug>.md
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
FILE_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-(?P<slug>.+)\.md$")
DATE_PATTERN = re.compile(r"^date:\s*(?P<date>\d{4}-\d{2}-\d{2})", re.MULTILINE)
TITLE_PATTERN = re.compile(r"^title:\s*(?P<title>.+)$", re.MULTILINE)


def main() -> int:
    issues: list[str] = []
    checked = 0

    for path in sorted(POSTS_DIR.glob("*.md")):
        m = FILE_PATTERN.match(path.name)
        if not m:
            continue

        checked += 1
        expected_date = m.group("date")
        text = path.read_text(encoding="utf-8")

        date_match = DATE_PATTERN.search(text)
        title_match = TITLE_PATTERN.search(text)

        if not date_match:
            issues.append(f"{path}: missing front-matter date")
            continue

        actual_date = date_match.group("date")
        if actual_date != expected_date:
            issues.append(
                f"{path}: filename date {expected_date} != front-matter date {actual_date}"
            )

        if not title_match:
            issues.append(f"{path}: missing front-matter title")

    if issues:
        print("Post validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"Post validation passed: checked {checked} dated markdown files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
