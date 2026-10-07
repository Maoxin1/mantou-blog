#!/usr/bin/env python3
"""Generate a public discussion registry from the exact production HTML build."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re

BLOG_COMMENTS = 'https://mantou-comments.vercel.app'
REGISTRY_PATH = Path('feedback/threads.json')
MAX_BYTES = 262144
MAX_PATHS = 10000
PATH = re.compile(r'/(?:p|works)/[A-Za-z0-9_-]+/')

class FeedbackParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.widgets = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if 'data-feedback-path' in values:
            if len(attrs) != len(values):
                raise ValueError('Duplicate feedback attributes')
            self.widgets.append(values)

def collect_paths(site: Path) -> list[str]:
    if not site.is_dir() or site.is_symlink():
        raise ValueError('Expected the built site directory')
    paths = set()
    for file in site.rglob('index.html'):
        if file.is_symlink():
            raise ValueError('Unexpected symlink in built site')
        parser = FeedbackParser()
        parser.feed(file.read_text(encoding='utf-8'))
        if not parser.widgets:
            continue
        if len(parser.widgets) != 1:
            raise ValueError('Expected one discussion per page')
        widget = parser.widgets[0]
        canonical = widget['data-feedback-path']
        route = '/' + file.parent.relative_to(site).as_posix() + '/'
        language = 'en' if route.startswith('/en/') else 'zh-cn'
        expected_route = '/en' + canonical if language == 'en' else canonical
        if (not isinstance(canonical, str) or len(canonical) > 200
                or not PATH.fullmatch(canonical) or route != expected_route
                or widget.get('data-feedback-lang') != language
                or widget.get('data-feedback-server') != BLOG_COMMENTS
                or widget.get('data-feedback-reactions') != 'false'):
            raise ValueError('Invalid published discussion configuration')
        paths.add(canonical)
    if len(paths) > MAX_PATHS:
        raise ValueError('Published discussion count exceeds the supported bound')
    return sorted(paths)

def manifest_for(site: Path, source_commit: str) -> dict:
    if not isinstance(source_commit, str) or not re.fullmatch(r'[a-f0-9]{40}', source_commit):
        raise ValueError('Expected the exact source commit')
    return {'version': 1, 'sourceCommit': source_commit, 'paths': collect_paths(site)}

def encoded(manifest: dict) -> str:
    result = json.dumps(manifest, ensure_ascii=True, separators=(',', ':')) + '\n'
    if len(result.encode('utf-8')) > MAX_BYTES:
        raise ValueError('Published discussion registry exceeds the supported size')
    return result

def generate(site: Path, source_commit: str) -> dict:
    manifest = manifest_for(site, source_commit)
    destination = site / REGISTRY_PATH
    if destination.is_symlink() or destination.parent.is_symlink():
        raise ValueError('Registry destination must stay inside the built site')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(encoded(manifest), encoding='utf-8', newline='\n')
    return manifest

def check(site: Path, source_commit: str) -> dict:
    expected = manifest_for(site, source_commit)
    file = site / REGISTRY_PATH
    if file.is_symlink() or file.read_text(encoding='utf-8') != encoded(expected):
        raise ValueError('Published registry differs from the built pages or source commit')
    return expected

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('generate', 'check'))
    parser.add_argument('--site', type=Path, default=Path('public'))
    parser.add_argument('--source-commit', required=True)
    args = parser.parse_args()
    manifest = (generate if args.command == 'generate' else check)(args.site, args.source_commit)
    print(f"Published discussion registry: {len(manifest['paths'])} canonical paths")

if __name__ == '__main__':
    main()
