#!/usr/bin/env python3
"""Check local href/src references in the generated Hugo site."""

from __future__ import annotations

import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
LINK_ATTRIBUTES = {"href", "src", "poster"}
IGNORED_SCHEMES = {"data", "javascript", "mailto", "tel"}


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []

    def handle_starttag(self, _tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in LINK_ATTRIBUTES and value:
                self.links.append(value)


def reference_exists(source: Path, raw_reference: str) -> bool:
    parsed = urlsplit(raw_reference)
    if parsed.scheme in IGNORED_SCHEMES or parsed.scheme or parsed.netloc:
        return True
    if not parsed.path:
        return True

    path = unquote(parsed.path)
    candidate = PUBLIC_DIR / path.lstrip("/") if path.startswith("/") else source.parent / path
    candidate = candidate.resolve()

    try:
        candidate.relative_to(PUBLIC_DIR.resolve())
    except ValueError:
        return False

    candidates = [candidate]
    if candidate.suffix == "":
        candidates.extend((candidate / "index.html", candidate.with_suffix(".html")))
    return any(item.exists() for item in candidates)


def main() -> int:
    if not PUBLIC_DIR.is_dir():
        print("Generated site is missing: run Hugo before this validator.")
        return 1

    issues: list[str] = []
    checked = 0
    for html_file in sorted(PUBLIC_DIR.rglob("*.html")):
        parser = LinkParser()
        parser.feed(html_file.read_text(encoding="utf-8"))
        for reference in parser.links:
            checked += 1
            if not reference_exists(html_file, reference):
                relative_source = html_file.relative_to(PUBLIC_DIR).as_posix()
                issues.append(f"{relative_source} -> {reference}")

    if issues:
        print("Internal link validation failed:\n")
        for issue in sorted(set(issues)):
            print(f"- {issue}")
        return 1

    print(f"Internal link validation passed: checked {checked} references.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
