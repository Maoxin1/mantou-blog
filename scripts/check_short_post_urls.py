#!/usr/bin/env python3
"""Validate generated short post URLs, canonical metadata, RSS, and redirects."""

from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
PUBLIC_DIR = ROOT / "public"
SLUG_PATTERN = re.compile(r"(?m)^slug:\s*['\"]?(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)")
ALIASES_BLOCK = re.compile(r"(?ms)^aliases:\s*\n(?P<items>(?:[ \t]+-.*\n?)+)")


class CanonicalParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.canonical: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "link" and values.get("rel") == "canonical":
            self.canonical = values.get("href")


def main() -> int:
    if not PUBLIC_DIR.is_dir():
        print("Generated site is missing: run Hugo before this validator.")
        return 1

    issues: list[str] = []
    slugs: set[str] = set()
    checked = 0

    for source in sorted(POSTS_DIR.glob("*.md")):
        text = source.read_text(encoding="utf-8")
        slug_match = SLUG_PATTERN.search(text)
        if not slug_match:
            issues.append(f"{source.relative_to(ROOT)}: missing valid short slug")
            continue

        slug = slug_match.group("slug")
        if slug in slugs:
            issues.append(f"{source.relative_to(ROOT)}: duplicate slug {slug!r}")
            continue
        slugs.add(slug)
        checked += 1

        alias_match = ALIASES_BLOCK.search(text)
        if not alias_match or "/posts/" not in alias_match.group("items"):
            issues.append(f"{source.relative_to(ROOT)}: missing legacy /posts/ alias")

        output = PUBLIC_DIR / "p" / slug / "index.html"
        if not output.is_file():
            issues.append(f"{source.relative_to(ROOT)}: missing generated /p/{slug}/ page")
            continue

        html = output.read_text(encoding="utf-8")
        canonical = f'https://mantou-blog.pages.dev/p/{slug}/'
        parser = CanonicalParser()
        parser.feed(html)
        if parser.canonical != canonical:
            issues.append(f"{output.relative_to(ROOT)}: incorrect canonical URL")

    feed_path = PUBLIC_DIR / "index.xml"
    if not feed_path.is_file():
        issues.append("public/index.xml: RSS feed is missing")
    else:
        feed = feed_path.read_text(encoding="utf-8")
        post_links = re.findall(r"<link>(https://mantou-blog\.pages\.dev/[^<]+)</link>", feed)
        long_links = [link for link in post_links if "/posts/" in link]
        if long_links:
            issues.append(f"public/index.xml: contains {len(long_links)} legacy post links")

    if issues:
        print("Short post URL validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"Short post URL validation passed: checked {checked} posts and RSS output.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
