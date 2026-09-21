#!/usr/bin/env python3
"""Validate generated short post URLs, canonical metadata, RSS, and redirects."""

from __future__ import annotations

import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "content" / "posts"
PUBLIC_DIR = ROOT / "public"
SLUG_PATTERN = re.compile(r"(?m)^slug:\s*['\"]?(?P<slug>[a-z0-9]+(?:-[a-z0-9]+)*)")
ALIASES_BLOCK = re.compile(r"(?ms)^aliases:\s*\n(?P<items>(?:[ \t]+-.*\n?)+)")
ALIAS_ITEM = re.compile(r"^\s*-\s*[\'\"]?(?P<alias>[^\'\"\r\n]+)[\'\"]?\s*$")
LEGACY_ALIAS = re.compile(r"^/posts/[^?#\s]+/$")


def legacy_aliases(text: str) -> list[str]:
    """Extract valid legacy /posts/.../ aliases from YAML front matter."""
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

        aliases = legacy_aliases(text)
        if not aliases:
            issues.append(
                f"{source.relative_to(ROOT)}: missing valid legacy /posts/.../ alias"
            )

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

        for alias in aliases:
            redirect = PUBLIC_DIR / alias.strip("/") / "index.html"
            if not redirect.is_file():
                issues.append(
                    f"{source.relative_to(ROOT)}: legacy alias {alias!r} "
                    "did not generate a redirect page"
                )
                continue

            redirect_parser = CanonicalParser()
            redirect_parser.feed(redirect.read_text(encoding="utf-8"))
            if redirect_parser.canonical != canonical:
                issues.append(
                    f"{redirect.relative_to(ROOT)}: legacy redirect canonical "
                    f"must point to {canonical}"
                )

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
            if os.environ.get("GITHUB_ACTIONS") == "true":
                print(f"::error title=Post URL validation::{issue}")
            print(f"- {issue}")
        return 1

    print(f"Short post URL validation passed: checked {checked} posts and RSS output.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
