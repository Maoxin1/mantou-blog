#!/usr/bin/env python3
"""Validate dated posts against their front matter.

Covers two layouts:
  1. Single files:  content/posts/YYYY-MM-DD-<slug>.md
  2. Page bundles:  content/posts/YYYY-MM-DD/index.md
Front matter may be YAML (---) or TOML (+++).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
FILE_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-(?P<slug>.+)\.md$")
DIR_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})$")
# YAML (date: ...) or TOML (date = '...') forms:
DATE_PATTERN = re.compile(r"^date\s*[:=]\s*['\"]?(?P<date>\d{4}-\d{2}-\d{2})", re.MULTILINE)
TITLE_PATTERN = re.compile(r"^title\s*[:=]\s*(?P<title>.+)$", re.MULTILINE)
SLUG_PATTERN = re.compile(r"^slug\s*[:=]\s*['\"]?(?P<slug>[^'\"\r\n]+)", re.MULTILINE)
VALID_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def check(path: Path, expected_date: str, label: str, issues: list[str]) -> str | None:
    text = path.read_text(encoding="utf-8")
    date_match = DATE_PATTERN.search(text)
    title_match = TITLE_PATTERN.search(text)
    if not date_match:
        issues.append(f"{label}: missing front-matter date")
        return None
    if date_match.group("date") != expected_date:
        issues.append(
            f"{label}: filename date {expected_date} != front-matter date {date_match.group('date')}"
        )
    if not title_match:
        issues.append(f"{label}: missing front-matter title")
    slug_match = SLUG_PATTERN.search(text)
    if not slug_match:
        issues.append(f"{label}: missing front-matter slug")
        return None
    slug = slug_match.group("slug").strip()
    if len(slug) > 32 or not VALID_SLUG_PATTERN.fullmatch(slug):
        issues.append(
            f"{label}: slug must be 1-32 lowercase ASCII letters, numbers, or hyphen-separated words"
        )
    return slug


def main() -> int:
    issues: list[str] = []
    slugs: dict[str, str] = {}
    checked = 0

    # 1. single dated files
    for path in sorted(POSTS_DIR.glob("*.md")):
        m = FILE_PATTERN.match(path.name)
        if not m:
            continue
        checked += 1
        slug = check(path, m.group("date"), str(path), issues)
        if slug:
            if slug in slugs:
                issues.append(f"{path}: duplicate slug {slug!r} also used by {slugs[slug]}")
            else:
                slugs[slug] = str(path)

    # 2. page bundles (YYYY-MM-DD/index.md)
    for sub in sorted(POSTS_DIR.iterdir()):
        if not sub.is_dir():
            continue
        m = DIR_PATTERN.match(sub.name)
        if not m:
            continue
        index = sub / "index.md"
        if not index.exists():
            issues.append(f"{sub}: bundle missing index.md")
            continue
        checked += 1
        slug = check(index, m.group("date"), str(index), issues)
        if slug:
            if slug in slugs:
                issues.append(f"{index}: duplicate slug {slug!r} also used by {slugs[slug]}")
            else:
                slugs[slug] = str(index)

    if issues:
        print("Post validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"Post validation passed: checked {checked} dated posts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
