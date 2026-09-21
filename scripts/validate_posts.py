#!/usr/bin/env python3
"""Validate dated posts against their front matter.

Covers two layouts:
  1. Single files:  content/posts/YYYY-MM-DD-<slug>.md
  2. Page bundles:  content/posts/YYYY-MM-DD/index.md
Front matter may be YAML (---) or TOML (+++).
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
FILE_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-(?P<slug>.+)\.md$")
DIR_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})$")
# YAML (date: ...) or TOML (date = '...') forms:
DATE_PATTERN = re.compile(r"^date\s*[:=]\s*['\"]?(?P<date>\d{4}-\d{2}-\d{2})", re.MULTILINE)
TITLE_PATTERN = re.compile(r"^title\s*[:=]\s*(?P<title>.+)$", re.MULTILINE)
SLUG_PATTERN = re.compile(r"^slug\s*[:=]\s*['\"]?(?P<slug>[^'\"\r\n]+)", re.MULTILINE)
VALID_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
IMAGE_PATTERN = re.compile(r"!\[(?P<alt>[^\]]*)\]\((?P<target>[^)]*)\)")
ALIASES_BLOCK = re.compile(r"(?ms)^aliases:\s*\n(?P<items>(?:[ \t]+-.*\n?)+)")
ALIAS_ITEM = re.compile(r"^\s*-\s*[\'\"]?(?P<alias>[^\'\"\r\n]+)[\'\"]?\s*$")
LEGACY_ALIAS = re.compile(r"^/posts/[^?#\s]+/$")



def legacy_aliases(text: str) -> list[str]:
    """Return well-formed legacy /posts/.../ aliases from YAML front matter."""
    match = ALIASES_BLOCK.search(text)
    if not match:
        return []

    aliases: list[str] = []
    for line in match.group("items").splitlines():
        item = ALIAS_ITEM.match(line)
        if not item:
            continue
        alias = item.group("alias").strip()
        if LEGACY_ALIAS.fullmatch(alias):
            aliases.append(alias)
    return aliases


def validate_legacy_alias(path: Path, text: str, label: str, issues: list[str]) -> None:
    """Require at least one explicit legacy redirect for single-file posts."""
    if legacy_aliases(text):
        return

    suggested = f"/posts/{path.stem}/"
    issues.append(
        f"{label}: missing valid legacy /posts/.../ alias; "
        f"new posts should include {suggested!r}"
    )


def validate_images(path: Path, text: str, label: str, issues: list[str]) -> None:
    """Reject Markdown images that are inaccessible or point to missing local files."""
    for match in IMAGE_PATTERN.finditer(text):
        raw_target = match.group("target").strip()
        line = text.count("\n", 0, match.start()) + 1

        if not match.group("alt").strip():
            issues.append(f"{label}:{line}: Markdown image is missing alt text")
        if not raw_target:
            issues.append(f"{label}:{line}: empty Markdown image target")
            continue

        if raw_target.startswith("<") and ">" in raw_target:
            target = raw_target[1 : raw_target.index(">")]
        else:
            target = raw_target.split(maxsplit=1)[0]

        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or target.startswith("data:"):
            continue

        decoded_path = unquote(parsed.path)
        if not decoded_path:
            issues.append(f"{label}:{line}: empty Markdown image target")
            continue

        if decoded_path.startswith("/"):
            image_path = ROOT / "static" / decoded_path.lstrip("/")
        else:
            image_path = path.parent / decoded_path
        if not image_path.is_file():
            issues.append(f"{label}:{line}: local image does not exist: {target}")


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
    validate_images(path, text, label, issues)
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
        label = str(path)
        text = path.read_text(encoding="utf-8")
        validate_legacy_alias(path, text, label, issues)
        slug = check(path, m.group("date"), label, issues)
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
            if os.environ.get("GITHUB_ACTIONS") == "true":
                print(f"::error title=Post source validation::{issue}")
            print(f"- {issue}")
        return 1

    print(f"Post validation passed: checked {checked} dated posts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
