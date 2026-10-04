"""Strict, bounded YAML/TOML front matter for the post source/output gates."""
from __future__ import annotations

import re
import tomllib
from urllib.parse import unquote

import yaml

FRONT_MATTER = re.compile(r"\A\ufeff?(---|\+\+\+)[ \t]*\r?\n(.*?)^\1[ \t]*(?:\r?\n|\Z)", re.S | re.M)
LEGACY_ALIAS = re.compile(r"^/posts/[^?#\s]+/$")


class UniqueKeyLoader(yaml.SafeLoader):
    """Preserve YAML scalar types and reject ambiguous duplicate mapping keys."""


def _mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str):
            raise ValueError("front-matter mapping keys must be strings")
        if key in result:
            raise ValueError(f"duplicate YAML key: {key}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)


def parse_front_matter(text: str) -> dict:
    match = FRONT_MATTER.match(text)
    if not match:
        raise ValueError("missing or unclosed YAML/TOML front matter at start of file")
    delimiter, raw = match.groups()
    try:
        fields = tomllib.loads(raw) if delimiter == "+++" else yaml.load(raw, Loader=UniqueKeyLoader)
    except (yaml.YAMLError, tomllib.TOMLDecodeError, ValueError) as error:
        raise ValueError(f"invalid front matter: {error}") from error
    if not isinstance(fields, dict):
        raise ValueError("front matter must be a mapping")
    return fields


def legacy_aliases(fields: dict) -> list[str]:
    """Return only safe local legacy URLs; never interpret examples in the body."""
    values = fields.get("aliases", [])
    if not isinstance(values, list):
        return []
    return [value for value in values if isinstance(value, str)
            and LEGACY_ALIAS.fullmatch(value)
            and not any(part in {".", "..", ""} for part in unquote(value).strip("/").split("/"))
            and not any(char in unquote(value) for char in "\\?#")]
