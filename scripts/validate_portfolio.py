#!/usr/bin/env python3
"""Validate structured portfolio entries before Hugo builds them."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKS_DIR = ROOT / "content" / "works"
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_PATTERN = re.compile(r"^https://")
ALLOWED_TYPES = {"investment", "tools", "methodology", "body"}
ALLOWED_DISCLOSURES = {"public", "anonymized", "delayed"}
REQUIRED_FIELDS = {
    "title",
    "date",
    "description",
    "work_type",
    "stage",
    "outcome",
    "evidence",
    "limitations",
    "disclosure",
    "featured",
}


def parse_front_matter(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("front matter must use YAML delimiters")
    try:
        raw_front_matter, body = text[4:].split("\n---", 1)
    except ValueError as error:
        raise ValueError("front matter closing delimiter is missing") from error

    fields: dict[str, str] = {}
    for line in raw_front_matter.splitlines():
        match = re.match(r"^(?P<key>[a-zA-Z_][\w-]*):\s*(?P<value>.*)$", line)
        if not match:
            continue
        value = match.group("value").strip().strip('"').strip("'")
        fields[match.group("key")] = value
    return fields, body.strip()


def portfolio_pages() -> list[Path]:
    pages = list(WORKS_DIR.glob("*.md")) + list(WORKS_DIR.glob("*/index.md"))
    return sorted(path for path in pages if path.name != "_index.md")


def main() -> int:
    issues: list[str] = []
    if not WORKS_DIR.is_dir():
        print("Portfolio validation failed:\n\n- content/works is missing")
        return 1

    pages = portfolio_pages()
    if not pages:
        print("Portfolio validation failed:\n\n- no portfolio entries found")
        return 1

    featured_count = 0
    published_count = 0
    for path in pages:
        label = path.relative_to(ROOT).as_posix()
        try:
            fields, body = parse_front_matter(path)
        except ValueError as error:
            issues.append(f"{label}: {error}")
            continue

        if fields.get("draft", "").lower() == "true":
            continue
        published_count += 1

        missing = sorted(field for field in REQUIRED_FIELDS if not fields.get(field))
        if missing:
            issues.append(f"{label}: missing fields {', '.join(missing)}")
        if fields.get("work_type") not in ALLOWED_TYPES:
            issues.append(f"{label}: unsupported work_type {fields.get('work_type')!r}")
        if fields.get("disclosure") not in ALLOWED_DISCLOSURES:
            issues.append(f"{label}: unsupported disclosure {fields.get('disclosure')!r}")
        if fields.get("date") and not DATE_PATTERN.fullmatch(fields["date"]):
            issues.append(f"{label}: date must use YYYY-MM-DD")
        if fields.get("work_type") == "tools" and not fields.get("artifact_url"):
            issues.append(f"{label}: tools must provide an artifact_url")
        if fields.get("artifact_url") and not URL_PATTERN.match(fields["artifact_url"]):
            issues.append(f"{label}: artifact_url must use HTTPS")
        if fields.get("source_url") and not URL_PATTERN.match(fields["source_url"]):
            issues.append(f"{label}: source_url must use HTTPS")
        if not body:
            issues.append(f"{label}: published work body is empty")
        if fields.get("featured", "").lower() == "true":
            featured_count += 1

    if featured_count == 0:
        issues.append("at least one portfolio entry must be featured on the homepage")

    if issues:
        print("Portfolio validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"Portfolio validation passed: checked {published_count} published entries, {featured_count} featured.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
