#!/usr/bin/env python3
"""Ensure disabled theme libraries are absent from generated production output."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"
FORBIDDEN_PREFIXES = (
    Path("lib/katex"),
    Path("lib/lightgallery"),
    Path("lib/lazysizes"),
)
TEXT_SUFFIXES = {".css", ".html", ".js", ".json", ".xml"}


def validate_runtime_assets(public_dir: Path) -> list[str]:
    if not public_dir.is_dir():
        return [f"generated site directory does not exist: {public_dir}"]

    issues: list[str] = []
    markers = tuple(f"{path.as_posix()}/" for path in FORBIDDEN_PREFIXES)

    for relative_path in FORBIDDEN_PREFIXES:
        target = public_dir / relative_path
        if target.exists():
            files = [path for path in target.rglob("*") if path.is_file()]
        else:
            files = []
        if files:
            size = sum(path.stat().st_size for path in files)
            issues.append(
                f"{relative_path.as_posix()} is disabled but still ships "
                f"{len(files)} files ({size} bytes)"
            )

    for path in public_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        document = path.read_text(encoding="utf-8", errors="replace")
        referenced = [marker for marker in markers if marker in document]
        if referenced:
            label = path.relative_to(public_dir).as_posix()
            issues.append(f"{label} references disabled assets: {', '.join(referenced)}")

    return issues


def main() -> int:
    issues = validate_runtime_assets(PUBLIC_DIR)
    if issues:
        print("Runtime asset validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("Runtime asset validation passed: disabled theme payloads are absent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
