#!/usr/bin/env python3
"""Lightweight validator for static/admin/config.yml.

Checks:
1) No unresolved git conflict markers.
2) No duplicate YAML keys at the same indentation scope.
3) Collection slug templates avoid unsupported placeholders.
4) Slug templates relying on {{hour}}/{{minute}}/{{second}} must not be paired
   with a date field that has time_format: false (otherwise the time part
   degenerates to a fixed value and same-day posts overwrite each other).
5) CMS publishing uses pull requests and squash merges so protected main and
   linear history cannot be bypassed.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from validate_portfolio import INVESTMENT_REQUIRED_FIELDS, REQUIRED_FIELDS

CONFIG_PATH = Path(__file__).resolve().parents[1] / "static" / "admin" / "config.yml"
KEY_LINE_RE = re.compile(r"^(?P<indent>\s*)(?P<key>[^\s:#][^:]*):")
LIST_KEY_RE = re.compile(r"^(?P<indent>\s*)-\s+(?P<key>[^\s:#][^:]*):")
SLUG_RE = re.compile(r"^\s*slug:\s*[\"']?(?P<slug>.+?)[\"']?\s*$")
COLLECTION_RE_TEMPLATE = r'(?ms)^  - name:\s*["\']?{name}["\']?\s*$.*?(?=^  - name:|\Z)'
FIELD_NAME_RE = re.compile(r'\bname:\s*["\']?(?P<name>[a-zA-Z_][\w-]*)')


def collection_block(text: str, name: str) -> str | None:
    match = re.search(COLLECTION_RE_TEMPLATE.format(name=re.escape(name)), text)
    return match.group(0) if match else None


def collection_field_names(block: str) -> set[str]:
    return {match.group("name") for match in FIELD_NAME_RE.finditer(block)}


def main() -> int:
    issues: list[str] = []
    text = CONFIG_PATH.read_text(encoding="utf-8")

    for marker in ("<<<<<<<", "=======", ">>>>>>>"):
        if marker in text:
            issues.append(f"found unresolved merge marker: {marker}")

    backend_block = text.split("media_folder:", maxsplit=1)[0]
    if not re.search(r"(?m)^publish_mode:\s*editorial_workflow\s*$", text):
        issues.append(
            "publish_mode must be editorial_workflow so CMS changes use pull "
            "requests instead of pushing directly to protected main"
        )
    if not re.search(r"(?m)^\s+squash_merges:\s*true\s*$", backend_block):
        issues.append(
            "backend.squash_merges must be true to preserve required linear history"
        )

    works_block = collection_block(text, "works")
    if works_block is None:
        issues.append("missing Decap CMS 'works' collection")
    else:
        cms_fields = collection_field_names(works_block)
        missing_fields = sorted(
            (REQUIRED_FIELDS | INVESTMENT_REQUIRED_FIELDS | {"body"}) - cms_fields
        )
        if missing_fields:
            issues.append(
                "Decap CMS 'works' collection is missing fields required by "
                f"portfolio validation: {', '.join(missing_fields)}"
            )

    posts_block = collection_block(text, "posts")
    if posts_block and re.search(r'value:\s*["\']?works["\']?', posts_block):
        issues.append(
            "Decap CMS 'posts' collection still offers the legacy 'works' "
            "category; new portfolio entries must use the 'works' collection"
        )

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
