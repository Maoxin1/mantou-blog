#!/usr/bin/env python3
"""Lightweight validator for static/admin/config.yml.

Checks:
1) No unresolved git conflict markers.
2) No duplicate YAML keys at the same indentation scope.
3) Collection slug templates avoid unsupported placeholders.
4) Slug templates relying on {{hour}}/{{minute}}/{{second}} must not be paired
   with a date field that has time_format: false (otherwise the time part
   degenerates to a fixed value and same-day posts overwrite each other).
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

        if re.search(r"\{\{\s*(hour|minute|second)\s*\}\}", slug):
            if re.search(r"time_format:\s*false", text):
                issues.append(
                    f"line {idx}: slug uses {{{{hour/minute/second}}}} but a "
                    "date field has 'time_format: false'; the time part will "
                    "degenerate to a constant and cause same-day post overwrites"
                )

    scopes: list[tuple[int, set[str]]] = []

    for idx, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if line.lstrip().startswith("- {"):
            # Skip flow-style inline maps in list items.
            continue

        if line.lstrip().startswith("- {"):
            # Skip flow-style inline maps in list items.
            continue

        stripped = line.lstrip()
        line_indent = len(line) - len(stripped)
        is_list_item = bool(LIST_KEY_RE.match(line))

        if is_list_item:
            # A "- key:" line opens a NEW map (its own list element). Its keys
            # live one scope deeper than the dash. Sibling list items at the
            # same indent are distinct maps, so close any prior sibling/child
            # scope and start a fresh one — otherwise two valid collections
            # (each "- name: ...") would look like a duplicate 'name'.
            match = LIST_KEY_RE.match(line)
            key = match.group("key").strip()
            key_indent = line_indent + 2
            while scopes and scopes[-1][0] > key_indent:
                scopes.pop()
            if scopes and scopes[-1][0] == key_indent:
                scopes.pop()
            scopes.append((key_indent, {key}))
            continue

        match = KEY_LINE_RE.match(line)
        if not match:
            continue

        indent = line_indent
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
