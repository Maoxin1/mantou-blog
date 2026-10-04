#!/usr/bin/env python3
"""Validate the bilingual garden's generated structure and real content links.

This is a static contract check, not a replacement for browser layout tests.
"""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys

ROOT = Path(__file__).resolve().parents[1]


class Node:
    def __init__(self, tag="", attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []
        self.parts = []

    def find(self, *, tag=None, attr=None, value=None):
        return [node for node in self.walk()
                if (tag is None or node.tag == tag)
                and (attr is None or (attr in node.attrs and (value is None or node.attrs[attr] == value)))]

    def walk(self):
        for child in self.children:
            yield child
            yield from child.walk()

    @property
    def text(self):
        return "".join(part.text if isinstance(part, Node) else part for part in self.parts)


class Document(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        self.stack[-1].parts.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, data):
        self.stack[-1].parts.append(data)


def validate_home(html: str, prefix: str, public: Path) -> list[str]:
    root = Document(html).root
    label = prefix or "/"
    issues = []
    expected_title = "Keep learning.Look ahead." if prefix else "知不足而奋进，望远山而前行。"
    headings = root.find(tag="h1")
    if len(headings) != 1 or headings[0].text.strip() != expected_title:
        issues.append(f"{label}: expected a single localized garden h1")

    for marker in ("data-home-featured-post", "data-garden-reading", "data-home-latest", "data-home-featured-work", "data-home-selected", "data-home-work-updates"):
        modules = root.find(attr=marker)
        if len(modules) != 1 or not modules[0].find(tag="a", attr="href"):
            issues.append(f"{label}: {marker} must be a single populated module")
    for marker, tag, count in (("data-home-latest", "li", 5), ("data-home-work-updates", "li", 3), ("data-home-selected", "article", 3)):
        modules = root.find(attr=marker)
        if modules and len(modules[0].find(tag=tag)) != count:
            issues.append(f"{label}: {marker} must contain {count} {tag} elements")

    skip = [node for node in root.find(tag="a") if "garden-skip" in (node.attrs.get("class") or "").split()]
    if len(skip) != 1 or skip[0].attrs.get("href") != "#main-content" or not root.find(tag="main", attr="id", value="main-content"):
        issues.append(f"{label}: missing working skip-to-content link")

    desktop = root.find(tag="header", attr="id", value="header-desktop")
    if len(desktop) != 1:
        issues.append(f"{label}: missing desktop identity navigation")
    else:
        destinations = {node.attrs.get("href") for node in desktop[0].find(tag="a")}
        for path in ("posts/", "works/", "now/", "about/", "search/", "follow/", "index.xml"):
            if prefix + "/" + path not in destinations:
                issues.append(f"{label}: navigation missing {path}")
        for language in ("zh-cn", "en"):
            if not desktop[0].find(tag="a", attr="hreflang", value=language):
                issues.append(f"{label}: navigation missing {language} switch")

    # Check actual rendered targets, including reading/selected cards and anchors.
    for anchor in root.find(tag="a", attr="href"):
        href = anchor.attrs["href"] or ""
        target = urlsplit(href)
        if target.scheme or target.netloc or not href or href == "#":
            continue
        path = unquote(target.path)
        if path and not path.startswith("/"):
            issues.append(f"{label}: unexpected relative garden link {href}")
            continue
        destination = public / path.lstrip("/") if path else public / prefix.lstrip("/") / "index.html"
        if destination.is_dir():
            destination /= "index.html"
        if not destination.is_file():
            issues.append(f"{label}: missing target {href}")
        elif target.fragment and destination.suffix == ".html":
            linked = root if not path else Document(destination.read_text(encoding="utf-8")).root
            if not linked.find(attr="id", value=unquote(target.fragment)):
                issues.append(f"{label}: missing anchor {href}")
    return issues


def validate_garden_output(public: Path) -> list[str]:
    issues = []
    for prefix in ("", "/en"):
        path = public / prefix.lstrip("/") / "index.html"
        if not path.is_file():
            issues.append(f"{prefix or '/'}: generated home is missing")
        else:
            issues.extend(validate_home(path.read_text(encoding="utf-8"), prefix, public))
    return issues


def main():
    issues = validate_garden_output(ROOT / "public")
    if issues:
        print("Garden output validation failed:\n" + "\n".join(f"- {issue}" for issue in issues))
        return 1
    print("Garden output validation passed: bilingual modules, navigation, skip link, and real destinations.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
