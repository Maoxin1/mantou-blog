"""Build a real asymmetric bilingual fixture without changing repository content."""
import shutil
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]


class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.elements = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))


@unittest.skipUnless(shutil.which('hugo'), 'Hugo is required for generated pagination regression')
class AsymmetricPaginationTests(unittest.TestCase):
    def test_chinese_only_posts_cannot_generate_missing_english_pagination_links(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            content = root / 'content'
            shutil.copytree(ROOT / 'content', content)
            # Current essays: 197 per language. Four Chinese-only posts cross 200.
            for number in range(4):
                (content / 'posts' / f'2026-01-01-pagination-fixture-{number}.md').write_text(
                    f'---\ntitle: Pagination fixture {number}\ndate: 2026-01-01\n'
                    f'slug: pagination-fixture-{number}\ncategories: [essays]\n'
                    f'aliases: [/posts/2026-01-01-pagination-fixture-{number}/]\n---\nFixture.\n',
                    encoding='utf-8')
            overlay = root / 'fixture.toml'
            overlay.write_text('resourceDir = ' + repr(str(root / 'resources')) + '\n[languages.zh-cn]\ncontentDir = ' + repr(str(content)) + '\n', encoding='utf-8')
            public = root / 'public'
            build = subprocess.run(['hugo', '--source', str(ROOT), '--config', f'{ROOT / "hugo.toml"},{overlay}',
                                    '--destination', str(public),
                                    '--cacheDir', str(root / 'cache'), '--minify', '--panicOnWarning'],
                                   capture_output=True, text=True, timeout=120)
            self.assertEqual(0, build.returncode, build.stdout + build.stderr)
            page = public / 'categories/essays/page/11/index.html'
            self.assertTrue(page.is_file())
            self.assertFalse((public / 'en/categories/essays/page/11/index.html').exists())
            links = Links(page.read_text(encoding='utf-8')).elements
            switches = [attrs['href'] for tag, attrs in links if tag == 'a' and attrs.get('lang') == 'en']
            self.assertEqual(['/en/categories/essays/'] * 2, switches)
            self.assertFalse(any(tag == 'link' and attrs.get('hreflang') == 'en' for tag, attrs in links))
            self.assertTrue(any(attrs.get('rel') == 'canonical' and attrs.get('href') ==
                                'https://mantou-blog.pages.dev/categories/essays/page/11/' for _, attrs in links))
            # Verify every language switch/hreflang generated anywhere, not only the fixture page.
            for output in public.rglob('*.html'):
                for tag, attrs in Links(output.read_text(encoding='utf-8')).elements:
                    if not attrs.get('hreflang') or not attrs.get('href'):
                        continue
                    target = public / unquote(urlsplit(attrs['href']).path).lstrip('/')
                    if attrs['href'].endswith('/'):
                        target /= 'index.html'
                    self.assertTrue(target.is_file(), f'{output.relative_to(public)} -> {attrs["href"]}')
            matching = Links((public / 'en/categories/essays/page/10/index.html').read_text()).elements
            self.assertTrue(any(attrs.get('hreflang') == 'zh-cn' and attrs.get('href') ==
                                'https://mantou-blog.pages.dev/categories/essays/page/10/' for _, attrs in matching))
