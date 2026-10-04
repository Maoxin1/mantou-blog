#!/usr/bin/env python3
"""Validate dated posts against their front matter.

Covers two layouts:
  1. Single files:  content/posts/YYYY-MM-DD-<slug>.md
  2. Page bundles:  content/posts/YYYY-MM-DD/index.md
Front matter may be YAML (---) or TOML (+++).
"""

from __future__ import annotations

import re
from datetime import date, datetime
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

if __package__:
    from .post_front_matter import parse_front_matter, legacy_aliases
else:
    from post_front_matter import parse_front_matter, legacy_aliases

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
FILE_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-(?P<slug>.+)\.md$")
DIR_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})$")
VALID_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
IMAGE_PATTERN = re.compile(r"!\[(?P<alt>[^\]]*)\]\((?P<target>[^)]*)\)")


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
    try:
        fields = parse_front_matter(text)
    except ValueError as error:
        issues.append(f"{label}: {error}")
        return None
    raw_date = fields.get("date")
    parsed_date = None
    try:
        if isinstance(raw_date, datetime):
            parsed_date = raw_date.date().isoformat()
        elif isinstance(raw_date, date):
            parsed_date = raw_date.isoformat()
        elif isinstance(raw_date, str):
            parsed_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        pass
    if parsed_date is None:
        issues.append(f"{label}: missing or invalid front-matter date")
    elif parsed_date != expected_date:
        issues.append(f"{label}: filename date {expected_date} != front-matter date {parsed_date}")
    title = fields.get("title")
    if not isinstance(title, (str, int, float)) or isinstance(title, bool) or not str(title).strip():
        issues.append(f"{label}: missing or invalid front-matter title")
    if path.name != "index.md" and not legacy_aliases(fields):
        issues.append(f"{label}: missing valid legacy /posts/.../ alias; new posts should include '/posts/{path.stem}/'")
    validate_images(path, text, label, issues)
    slug = fields.get("slug")
    if isinstance(slug, int) and not isinstance(slug, bool):
        slug = str(slug)
    if not isinstance(slug, str) or not slug:
        issues.append(f"{label}: missing front-matter slug")
        return None
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
