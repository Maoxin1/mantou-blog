"""Exercise translation disclosures in real HTML/RSS with isolated content."""
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
MACHINE = 'Machine translation; not fully reviewed and may contain errors.'
REVIEWED = 'Edited English version based on the Chinese original.'
STALE = 'The Chinese original has been updated since this translation.'


class TranslationNotes(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.notes = []
        self.current = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'p' and 'translation-note' in attrs.get('class', '').split():
            self.current = {'text': '', 'links': []}
            self.notes.append(self.current)
        if self.current is not None and tag == 'a':
            self.current['links'].append(attrs)

    def handle_data(self, text):
        if self.current is not None:
            self.current['text'] += text

    def handle_endtag(self, tag):
        if tag == 'p':
            self.current = None


@unittest.skipUnless(shutil.which('hugo'), 'Hugo is required for generated translation regression')
class TranslationOutputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        temporary = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temporary.cleanup)
        root = Path(temporary.name)
        # A real isolated source tree also exercises readFile("content/...") in
        # the shared note partial. No tracked content or translation is edited.
        for directory in ('assets', 'static', 'themes', 'layouts', 'data', 'i18n', 'content', 'content_en'):
            shutil.copytree(ROOT / directory, root / directory,
                            ignore=shutil.ignore_patterns('node_modules', '.git', 'exampleSite'))
        shutil.copyfile(ROOT / 'hugo.toml', root / 'hugo.toml')
        cls.cases = []
        for status in ('machine', 'reviewed'):
            for stale in (False, True):
                slug = f'translation-fixture-{status}-{"stale" if stale else "fresh"}'
                source = (f'---\ntitle: 中文测试\nslug: {slug}\ndate: 2026-01-01\n'
                          f'aliases: [/posts/2026-01-01-{slug}/]\n---\n中文原文。\n')
                digest = hashlib.sha256(source.encode('utf-8')).hexdigest()
                (root / 'content/posts' / f'{slug}.md').write_text(
                    source + ('原文后来增加的段落。\n' if stale else ''), encoding='utf-8')
                (root / 'content_en/posts' / f'{slug}.md').write_text(
                    f'---\ntitle: Translation fixture\nslug: {slug}\ndate: 2026-01-01\n'
                    f'translation_status: {status}\ntranslation_source_hash: {digest}\n'
                    '---\nTranslated fixture.\n', encoding='utf-8')
                cls.cases.append((slug, status, stale))
        cls.public = root / 'public'
        build = subprocess.run(['hugo', '--source', str(root), '--destination', str(cls.public),
                                '--cacheDir', str(root / 'cache'), '--minify', '--panicOnWarning'],
                               capture_output=True, text=True, encoding='utf-8', timeout=120)
        if build.returncode:
            raise AssertionError(build.stdout + build.stderr)

    def assert_disclosure(self, html, slug, status, stale):
        notes = TranslationNotes(html).notes
        self.assertEqual(len(notes), 1)
        self.assertEqual(MACHINE in notes[0]['text'], status == 'machine')
        self.assertEqual(REVIEWED in notes[0]['text'], status == 'reviewed')
        self.assertEqual(STALE in notes[0]['text'], stale)
        self.assertEqual(notes[0]['links'], [{
            'href': f'https://mantou-blog.pages.dev/p/{slug}/', 'lang': 'zh-cn',
        }])

    def test_pages_label_review_state_and_source_freshness_independently(self):
        for slug, status, stale in self.cases:
            with self.subTest(status=status, stale=stale):
                english = (self.public / f'en/p/{slug}/index.html').read_text(encoding='utf-8')
                self.assert_disclosure(english, slug, status, stale)
                chinese = (self.public / f'p/{slug}/index.html').read_text(encoding='utf-8')
                self.assertEqual(TranslationNotes(chinese).notes, [])

    def test_rss_preserves_machine_reviewed_and_stale_disclosures(self):
        feed = ET.parse(self.public / 'en/index.xml')
        descriptions = {item.findtext('link'): item.findtext('description')
                        for item in feed.findall('./channel/item')}
        for slug, status, stale in self.cases:
            with self.subTest(status=status, stale=stale):
                url = f'https://mantou-blog.pages.dev/en/p/{slug}/'
                self.assertIn(url, descriptions)
                self.assert_disclosure(descriptions[url], slug, status, stale)
        chinese = ET.parse(self.public / 'index.xml')
        for item in chinese.findall('./channel/item'):
            self.assertEqual(TranslationNotes(item.findtext('description') or '').notes, [])


if __name__ == '__main__':
    unittest.main()
