#!/usr/bin/env python3
"""Validate structured portfolio entries before Hugo builds them."""

from __future__ import annotations

import re
import sys
from datetime import date, datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKS_DIR = ROOT / "content" / "works"
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_PATTERN = re.compile(r"^https://")
ALLOWED_TYPES = {"investment", "tools", "methodology", "body"}
ALLOWED_DISCLOSURES = {"public", "anonymized", "delayed"}
REQUIRED_FIELDS = {
    "title",
    "date",
    "description",
    "work_type",
    "stage",
    "problem",
    "hypothesis",
    "constraints",
    "decision",
    "outcome",
    "evidence",
    "limitations",
    "next_step",
    "disclosure",
    "featured",
}
INVESTMENT_REQUIRED_FIELDS = {"privacy_reviewed", "security_disclosure_basis"}
ALLOWED_SECURITY_DISCLOSURE_BASES = {"not_named", "boundary_met"}
ARABIC_NUMBER = r"[+\-]?\s*\d(?:[\d\s,，.]*\d)?\s*(?:%|％|元|万|万元|亿|亿元|成)?"
CHINESE_NUMBER = r"[零〇一二两三四五六七八九十百千万亿点]+(?:元|万元|亿元|成)?"
PRIVATE_NUMBER = rf"(?:{ARABIC_NUMBER}|{CHINESE_NUMBER})"
VALUE_CONNECTOR = r"\s*(?:(?:约|大约|大概|接近|将近)?(?:为|是|达到)?|[：:=])\s*"

INVESTMENT_PRIVACY_PATTERNS = (
    (
        "账户总收益",
        re.compile(
            rf"(?:账户|组合)\s*(?:总?收益(?:率)?|盈利|盈亏)"
            rf"{VALUE_CONNECTOR}{PRIVATE_NUMBER}"
        ),
    ),
    (
        "个人仓位",
        re.compile(
            rf"(?:我的|本人|个人|当前)\s*(?:总)?(?:持仓|仓位)(?:比例)?"
            rf"{VALUE_CONNECTOR}{PRIVATE_NUMBER}"
        ),
    ),
    (
        "个人金额",
        re.compile(
            rf"(?:投入本金|个人本金|账户金额|持仓金额|投资金额)"
            rf"{VALUE_CONNECTOR}(?:[¥￥$]\s*)?{PRIVATE_NUMBER}"
        ),
    ),
)


class UniqueKeyLoader(yaml.SafeLoader):
    """Safe YAML loader that rejects ambiguous duplicate mapping keys."""


def _construct_unique_mapping(
    loader: UniqueKeyLoader,
    node: yaml.nodes.MappingNode,
    deep: bool = False,
) -> dict[object, object]:
    mapping: dict[object, object] = {}

    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise ValueError(f"duplicate YAML key: {key}")
        mapping[key] = loader.construct_object(value_node, deep=deep)

    return mapping


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def investment_privacy_risks(text: str) -> list[str]:
    """Return high-confidence personal account disclosures that need review.

    The patterns deliberately require both personal-account context and a
    numeric value. Company financial figures remain valid research evidence
    and should not be blocked by this mechanical preflight.
    """

    return [label for label, pattern in INVESTMENT_PRIVACY_PATTERNS if pattern.search(text)]


def investment_privacy_issues(fields: dict[str, str], body: str) -> list[str]:
    issues: list[str] = []
    missing_fields = sorted(
        field for field in INVESTMENT_REQUIRED_FIELDS if not fields.get(field)
    )
    if missing_fields:
        issues.append(f"investment work is missing {', '.join(missing_fields)}")
    elif fields.get("privacy_reviewed", "").lower() != "true":
        issues.append("privacy_reviewed must be true before publishing investment work")

    disclosure_basis = fields.get("security_disclosure_basis")
    if (
        disclosure_basis
        and disclosure_basis not in ALLOWED_SECURITY_DISCLOSURE_BASES
    ):
        issues.append(
            "security_disclosure_basis must be 'not_named' or 'boundary_met'"
        )

    privacy_text = "\n".join((*fields.values(), body))
    privacy_risks = investment_privacy_risks(privacy_text)
    if privacy_risks:
        issues.append(
            "possible restricted investment disclosure "
            f"({', '.join(privacy_risks)}); review "
            "docs/investment-publication-checklist.md"
        )
    return issues


def _field_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, str):
        return value
    if isinstance(value, (list, dict)):
        return yaml.safe_dump(
            value,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        ).strip()
    return str(value)


def parse_front_matter_text(text: str) -> tuple[dict[str, str], str]:
    text = text.removeprefix("\ufeff").replace("\r\n", "\n")
    if not text.startswith("---\n"):
        raise ValueError("front matter must use YAML delimiters")

    closing = re.search(r"(?m)^---\s*$", text[4:])
    if closing is None:
        raise ValueError("front matter closing delimiter is missing")

    raw_start = 4
    raw_end = raw_start + closing.start()
    body_start = raw_start + closing.end()
    raw_front_matter = text[raw_start:raw_end]
    body = text[body_start:].lstrip("\n")

    try:
        loaded = yaml.load(raw_front_matter, Loader=UniqueKeyLoader)
    except ValueError:
        raise
    except yaml.YAMLError as error:
        raise ValueError(f"invalid YAML front matter: {error}") from error

    if not isinstance(loaded, dict):
        raise ValueError("front matter must be a YAML mapping")

    fields = {str(key): _field_text(value) for key, value in loaded.items()}
    return fields, body.strip()


def parse_front_matter(path: Path) -> tuple[dict[str, str], str]:
    return parse_front_matter_text(path.read_text(encoding="utf-8"))


def portfolio_pages() -> list[Path]:
    pages = list(WORKS_DIR.glob("*.md")) + list(WORKS_DIR.glob("*/index.md"))
    return sorted(path for path in pages if path.name != "_index.md")


def main() -> int:
    issues: list[str] = []
    if not WORKS_DIR.is_dir():
        print("Portfolio validation failed:\n\n- content/works is missing")
        return 1

    pages = portfolio_pages()
    if not pages:
        print("Portfolio validation failed:\n\n- no portfolio entries found")
        return 1

    featured_count = 0
    published_count = 0
    for path in pages:
        label = path.relative_to(ROOT).as_posix()
        try:
            fields, body = parse_front_matter(path)
        except ValueError as error:
            issues.append(f"{label}: {error}")
            continue

        if fields.get("draft", "").lower() == "true":
            continue
        published_count += 1

        missing = sorted(field for field in REQUIRED_FIELDS if not fields.get(field))
        if missing:
            issues.append(f"{label}: missing fields {', '.join(missing)}")
        if fields.get("work_type") not in ALLOWED_TYPES:
            issues.append(f"{label}: unsupported work_type {fields.get('work_type')!r}")
        if fields.get("disclosure") not in ALLOWED_DISCLOSURES:
            issues.append(f"{label}: unsupported disclosure {fields.get('disclosure')!r}")
        if fields.get("date") and not DATE_PATTERN.fullmatch(fields["date"]):
            issues.append(f"{label}: date must use YYYY-MM-DD")
        if fields.get("work_type") == "tools" and not fields.get("artifact_url"):
            issues.append(f"{label}: tools must provide an artifact_url")
        if fields.get("work_type") == "investment":
            issues.extend(
                f"{label}: {issue}"
                for issue in investment_privacy_issues(fields, body)
            )
        if fields.get("artifact_url") and not URL_PATTERN.match(fields["artifact_url"]):
            issues.append(f"{label}: artifact_url must use HTTPS")
        if fields.get("source_url") and not URL_PATTERN.match(fields["source_url"]):
            issues.append(f"{label}: source_url must use HTTPS")
        if not body:
            issues.append(f"{label}: published work body is empty")
        if fields.get("featured", "").lower() == "true":
            featured_count += 1

    if featured_count == 0:
        issues.append("at least one portfolio entry must be featured on the homepage")

    if issues:
        print("Portfolio validation failed:\n")
        for issue in issues:
            print(f"- {issue}")
        return 1

    print(f"Portfolio validation passed: checked {published_count} published entries, {featured_count} featured.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
