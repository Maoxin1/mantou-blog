"""Read legacy redirects from front matter without installing YAML dependencies."""
from __future__ import annotations

import ast
import re
import tomllib
from urllib.parse import unquote

FRONT_MATTER = re.compile(r"\A(?:\ufeff)?(---|\+\+\+)[ \t]*\r?\n(.*?)\r?\n\1[ \t]*(?:\r?\n|\Z)", re.S)
ALIASES_BLOCK = re.compile(r"(?m)^aliases:[ \t]*\r?\n((?:[ \t]+-.*(?:\r?\n|\Z))*)")
ALIAS_ITEM = re.compile(r"^\s*-\s*['\"]?([^'\"\r\n]+)['\"]?\s*$")
LEGACY_ALIAS = re.compile(r"^/posts/[^?#\s]+/$")


def legacy_aliases(text: str) -> list[str]:
    match = FRONT_MATTER.search(text)
    if not match:
        return []
    kind, front_matter = match.groups()
    if kind == "+++":
        try:
            values = tomllib.loads(front_matter).get("aliases", [])
        except tomllib.TOMLDecodeError:
            return []
    else:
        block = ALIASES_BLOCK.search(front_matter + "\n")
        if block:
            values = [item.group(1).strip() for line in block.group(1).splitlines()
                      if (item := ALIAS_ITEM.match(line))]
        else:
            inline = re.search(r"(?m)^aliases:[ \t]*(\[.*\])[ \t]*$", front_matter)
            try:
                values = ast.literal_eval(inline.group(1)) if inline else []
            except (ValueError, SyntaxError):
                return []
    if not isinstance(values, list):
        return []
    return [value for value in values if isinstance(value, str)
            and LEGACY_ALIAS.fullmatch(value)
            and not any(part in {".", ".."} for part in unquote(value).split("/"))]
