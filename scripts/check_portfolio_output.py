#!/usr/bin/env python3
"""Check the generated portfolio paths and critical visitor journeys."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
EXPECTED_FILES = {
    "homepage": PUBLIC_DIR / "index.html",
    "works index": PUBLIC_DIR / "works" / "index.html",
    "PWA work": PUBLIC_DIR / "works" / "mantou-checklist-pwa" / "index.html",
}


def require_text(label: str, text: str, fragments: tuple[str, ...], issues: list[str]) -> None:
    for fragment in fragments:
        if fragment not in text:
            issues.append(f"{label}: missing {fragment!r}")


def main() -> int:
    issues: list[str] = []
    pages: dict[str, str] = {}
    for label, path in EXPECTED_FILES.items():
        if not path.is_file():
            issues.append(f"{label}: generated file is missing ({path.relative_to(ROOT)})")
            continue
        pages[label] = path.read_text(encoding="utf-8")

    if "homepage" in pages:
        require_text(
            "homepage",
            pages["homepage"],
            ('data-portfolio-home', 'href=/works/', 'href=/categories/essays/', 'data-featured-work'),
            issues,
        )
    if "works index" in pages:
        require_text("works index", pages["works index"], ('data-works-index', 'mantou-checklist-pwa'), issues)
    if "PWA work" in pages:
        require_text(
            "PWA work",
            pages["PWA work"],
            (
                'data-work-detail',
                'https://mantou-checklist.pages.dev/editor',
                'https://github.com/Maoxin1/mantou-checklist',
            ),
            issues,
        )

    if issues:
        print("Portfolio output validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("Portfolio output validation passed: homepage, works index and PWA work are connected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
