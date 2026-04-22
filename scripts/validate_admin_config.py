#!/usr/bin/env python3
"""Lightweight validator for static/admin/config.yml.

Checks:
1) No unresolved git conflict markers.
2) No duplicate YAML keys at the same indentation scope.
3) Collection slug templates avoid unsupported placeholders.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parents[1] / "static" / "admin" / "config.yml"
KEY_LINE_RE = re.compile(r"^(?P<indent>\s*)(?P<key>[^\s:#][^:]*):")
LIST_KEY_RE = re.compile(r"^(?P<indent>\s*)-\s+(?P<key>[^\s:#][^:]*):")
SLUG_RE = re.compile(r"^\s*slug:\s*[\"']?(?P<slug>.+?)[\"']?\s*$")


def main() -> int:
    issues: list[str] = []
    text = CONFIG_PATH.read_text(encoding="utf-8")

    for marker in ("<<<<<<<", "=======", ">>>>>>>"):
        if marker in text:
            issues.append(f"found unresolved merge marker: {marker}")

    for idx, raw_line in enumerate(text.splitlines(), start=1):
        slug_match = SLUG_RE.match(raw_line)
        if not slug_match:
            continue

        slug = slug_match.group("slug")
        if "{{uuid}}" in slug:
            issues.append(
                f"line {idx}: slug template uses unsupported placeholder '{{{{uuid}}}}'"
            )

    scopes: list[tuple[int, set[str]]] = []

    for idx, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line.lstrip().startswith("- {"):
            # Skip flow-style inline maps in list items.
            continue

        match = KEY_LINE_RE.match(line)
        if not match:
            match = LIST_KEY_RE.match(line)
        if not match:
            continue

        indent = len(match.group("indent"))
        key = match.group("key").strip()

        while scopes and indent < scopes[-1][0]:
            scopes.pop()

        if not scopes or indent > scopes[-1][0]:
            scopes.append((indent, set()))

        current_keys = scopes[-1][1]
        if key in current_keys:
            issues.append(f"line {idx}: duplicate key '{key}' at indent {indent}")
        else:
            current_keys.add(key)

    if issues:
        print("Admin config validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print("Admin config validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
