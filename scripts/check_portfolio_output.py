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
    "about and collaboration": PUBLIC_DIR / "about" / "index.html",
}


def require_text(label: str, text: str, fragments: tuple[str, ...], issues: list[str]) -> None:
    for fragment in fragments:
        if fragment not in text:
            issues.append(f"{label}: missing {fragment!r}")


def require_href(label: str, text: str, path: str, issues: list[str]) -> None:
    candidates = (f'href="{path}"', f"href='{path}'", f"href={path}")
    if not any(candidate in text for candidate in candidates):
        issues.append(f"{label}: missing link to {path!r}")


def forbid_text(label: str, text: str, fragments: tuple[str, ...], issues: list[str]) -> None:
    for fragment in fragments:
        if fragment in text:
            issues.append(f"{label}: unexpected {fragment!r}")


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
            (
                'data-portfolio-home',
                'data-portfolio-status',
                'data-featured-work',
                'data-work-method-compact',
                'data-analytics-loader',
                'location.hostname',
                'mantou-blog.pages.dev',
            ),
            issues,
        )
        forbid_text(
            "homepage",
            pages["homepage"],
            ('data-proof-strip', '5 / 5</strong>', '次失败被完整保留'),
            issues,
        )
        require_href("homepage", pages["homepage"], "/works/", issues)
        require_href("homepage", pages["homepage"], "/about/", issues)
        require_href("homepage", pages["homepage"], "/categories/essays/", issues)
    if "works index" in pages:
        require_text("works index", pages["works index"], ('data-works-index', 'mantou-checklist-pwa'), issues)
    if "PWA work" in pages:
        require_text(
            "PWA work",
            pages["PWA work"],
            (
                'data-work-detail',
                'data-case-map',
                'data-verification-matrix',
                'https://mantou-checklist.pages.dev/editor',
                'https://github.com/Maoxin1/mantou-checklist',
            ),
            issues,
        )
    if "about and collaboration" in pages:
        require_text(
            "about and collaboration",
            pages["about and collaboration"],
            ('data-about-collaboration', '工作原则', '目前适合交流与合作的方向'),
            issues,
        )

    if issues:
        print("Portfolio output validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("Portfolio output validation passed: the complete visitor journey is connected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
