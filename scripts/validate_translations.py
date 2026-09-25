#!/usr/bin/env python3
"""Check complete translation coverage and flag changes to Chinese sources.

Run --record-source content_en/path.md only after bringing that translation up
to date. This records synchronization, not a claim of editorial review.
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
import re
import sys
import yaml

ROOT = Path(__file__).resolve().parents[1]

def read(path: Path):
    raw = path.read_text(encoding="utf-8")
    parts = raw.split("---", 2)
    return raw, yaml.safe_load(parts[1]) or {}, parts[2]

def digest(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

def validate(root: Path = ROOT, *, allow_pending: bool = False, pending: list[str] | None = None) -> list[str]:
    issues = []
    pending = pending if pending is not None else []
    synchronization_issues = pending if allow_pending else issues
    for source in sorted((root / "content").rglob("*.md")):
        relative = source.relative_to(root / "content")
        raw, original, body = read(source)
        if original.get("draft") is True:
            continue
        target = root / "content_en" / relative
        if not target.is_file():
            synchronization_issues.append(f"{relative}: missing English counterpart")
            continue
        translated_raw, translated, translated_body = read(target)
        if translated.get("draft") is True:
            synchronization_issues.append(f"{relative}: English counterpart is still a draft")
            continue
        for field in ("slug", "date", "work_type"):
            if field in original and str(original[field]) != str(translated.get(field)):
                issues.append(f"{relative}: {field} must match the Chinese source")
        if not translated.get("title"):
            issues.append(f"{relative}: missing English title")
        if body.strip() and not translated_body.strip() and original.get("type") != "search":
            issues.append(f"{relative}: missing English body")
        if translated.get("aliases"):
            issues.append(f"{relative}: English must not reuse Chinese redirect aliases")
        if "MANTOUKEEP" in translated_raw:
            issues.append(f"{relative}: unresolved translation placeholder")
        if translated.get("translation_source_hash") != digest(raw):
            synchronization_issues.append(f"{relative}: source changed or synchronization has not been recorded")
        if relative.parts[0] in ("posts", "works") and relative.name != "_index.md":
            if translated.get("translation_status") not in ("machine", "reviewed"):
                issues.append(f"{relative}: translation_status must be machine or reviewed")
    return issues

def record_source(target: Path):
    target = target.resolve()
    relative = target.relative_to((ROOT / "content_en").resolve())
    source = ROOT / "content" / relative
    source_raw = source.read_text(encoding="utf-8")
    raw, _, _ = read(target)
    value = digest(source_raw)
    if re.search(r"(?m)^translation_source_hash:", raw):
        raw = re.sub(r"(?m)^translation_source_hash:.*$", "translation_source_hash: " + value, raw)
    else:
        raw = raw.replace("---", "---\ntranslation_source_hash: " + value, 1)
    target.write_text(raw, encoding="utf-8")
    print(f"Recorded source version: {relative}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record-source", type=Path)
    parser.add_argument("--allow-pending", action="store_true", help="Report missing or stale translations without blocking publication of the Chinese original")
    args = parser.parse_args()
    if args.record_source:
        record_source(args.record_source)
    else:
        pending = []
        errors = validate(allow_pending=args.allow_pending, pending=pending)
        if pending:
            print("Translations awaiting updates (Chinese publication remains available):\n" + "\n".join("- " + x for x in pending))
        if errors:
            print("Translation validation failed:\n" + "\n".join("- " + x for x in errors))
            sys.exit(1)
        print("Translation validation passed." if pending else "Translation coverage and source synchronization passed.")
