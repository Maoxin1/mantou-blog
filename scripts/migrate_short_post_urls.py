#!/usr/bin/env python3
"""Give every dated post a short stable slug and preserve its previous URL.

Dry-run by default. Pass --write to update content files. The transformation is
idempotent for posts already carrying their assigned YYYYMMDD[-N] slug.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
FILE_PATTERN = re.compile(r"^(?P<date>\d{4}-\d{2}-\d{2})-(?P<name>.+)\.md$")
SLUG_LINE = re.compile(r"^slug:\s*['\"]?(?P<slug>[^'\"\r\n]+)")


def split_front_matter(text: str) -> tuple[list[str], list[str]]:
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        raise ValueError("expected YAML front matter")
    try:
        end = lines.index("---", 1)
    except ValueError as error:
        raise ValueError("unterminated YAML front matter") from error
    return lines[1:end], lines[end + 1 :]


def previous_permalink(path: Path, front_matter: list[str]) -> str:
    for line in front_matter:
        match = SLUG_LINE.match(line)
        if match:
            return f"/posts/{match.group('slug').strip()}/"
    return f"/posts/{path.stem}/"


def add_alias(front_matter: list[str], alias: str) -> None:
    serialized = json.dumps(alias, ensure_ascii=False)
    for index, line in enumerate(front_matter):
        if line == "aliases:":
            block_end = index + 1
            while block_end < len(front_matter):
                candidate = front_matter[block_end]
                if candidate.startswith((" ", "\t")) or not candidate.strip():
                    block_end += 1
                    continue
                break
            existing = "\n".join(front_matter[index:block_end])
            if alias not in existing:
                front_matter.insert(block_end, f"  - {serialized}")
            return

    slug_index = next(
        (index for index, line in enumerate(front_matter) if line.startswith("slug:")),
        1,
    )
    front_matter[slug_index + 1 : slug_index + 1] = ["aliases:", f"  - {serialized}"]


def set_slug(front_matter: list[str], slug: str) -> None:
    for index, line in enumerate(front_matter):
        if line.startswith("slug:"):
            front_matter[index] = f"slug: {slug}"
            return
    date_index = next(
        (index for index, line in enumerate(front_matter) if line.startswith("date:")),
        1,
    )
    front_matter.insert(date_index + 1, f"slug: {slug}")


def migration_plan() -> list[tuple[Path, str]]:
    dated: list[tuple[Path, str]] = []
    for path in sorted(POSTS_DIR.glob("*.md"), key=lambda item: item.name):
        match = FILE_PATTERN.match(path.name)
        if match:
            dated.append((path, match.group("date")))

    occurrences: Counter[str] = Counter()
    plan: list[tuple[Path, str]] = []
    for path, date in dated:
        occurrences[date] += 1
        suffix = "" if occurrences[date] == 1 else f"-{occurrences[date]}"
        plan.append((path, f"{date.replace('-', '')}{suffix}"))
    return plan


def migrate(path: Path, short_slug: str, write: bool) -> bool:
    original = path.read_text(encoding="utf-8")
    front_matter, body = split_front_matter(original)
    current_slug = next(
        (match.group("slug").strip() for line in front_matter if (match := SLUG_LINE.match(line))),
        None,
    )

    if current_slug == short_slug:
        return False

    add_alias(front_matter, previous_permalink(path, front_matter))
    set_slug(front_matter, short_slug)
    updated = "\n".join(["---", *front_matter, "---", *body]) + "\n"
    if write:
        path.write_text(updated, encoding="utf-8", newline="\n")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="update content files")
    args = parser.parse_args()

    changed = 0
    for path, short_slug in migration_plan():
        if migrate(path, short_slug, args.write):
            changed += 1
            print(f"{path.relative_to(ROOT)} -> /p/{short_slug}/")

    mode = "updated" if args.write else "would update"
    print(f"{mode} {changed} posts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
