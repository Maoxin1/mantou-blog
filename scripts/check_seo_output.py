#!/usr/bin/env python3
"""Validate page-level descriptions and Article JSON-LD in Hugo output."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "public" / "p"
SITE_DESCRIPTION = "用真实作品、证据和复盘，把时间转化为能力、资本与自主权。"
DESCRIPTION_PATTERN = re.compile(
    r'<meta\b(?=[^>]*\bname=(?:"description"|description))'
    r'(?=[^>]*\bcontent=(?:"([^"]*)"|([^\s>]*)))[^>]*>',
    re.IGNORECASE,
)
SCHEMA_PATTERN = re.compile(
    r'<script\s+type=(?:"application/ld\+json"|application/ld\+json)>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
ISO_OFFSET_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$")


def fail(message: str, issues: list[str]) -> None:
    issues.append(message)


def main() -> int:
    issues: list[str] = []
    pages = sorted(POSTS_DIR.glob("*/index.html"))

    if not pages:
        print("SEO output validation failed: no generated post pages found.")
        return 1

    for page in pages:
        label = page.relative_to(ROOT).as_posix()
        document = page.read_text(encoding="utf-8")
        description_match = DESCRIPTION_PATTERN.search(document)
        description = "" if description_match is None else next(
            (value for value in description_match.groups() if value is not None), ""
        )
        if not description.strip():
            fail(f"{label}: missing page description", issues)
        elif description == SITE_DESCRIPTION:
            fail(f"{label}: falls back to the site-wide description", issues)

        schemas = [json.loads(value) for value in SCHEMA_PATTERN.findall(document)]
        if len(schemas) != 1:
            fail(f"{label}: expected one JSON-LD entity, found {len(schemas)}", issues)
            continue

        schema = schemas[0]
        if schema.get("@type") != "BlogPosting":
            fail(f"{label}: expected BlogPosting JSON-LD", issues)
        author = schema.get("author", {})
        if author.get("@type") != "Person" or not author.get("name"):
            fail(f"{label}: missing Person author in JSON-LD", issues)
        for field in ("datePublished", "dateModified"):
            if not ISO_OFFSET_PATTERN.fullmatch(str(schema.get(field, ""))):
                fail(f"{label}: invalid or missing {field}", issues)

    if issues:
        print("SEO output validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"SEO output validation passed: {len(pages)} post pages have distinct descriptions and Article metadata.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
