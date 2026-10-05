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
            category = 'pagination-regression-fixture'
            # Keep content required by the homepage, but isolate pagination from
            # the growing production corpus: three Chinese pages, two English.
            for language, count in [('content', 41), ('content_en', 21)]:
                content = root / language
                shutil.copytree(ROOT / language, content)
                category_dir = content / 'categories' / category
                category_dir.mkdir(parents=True)
                (category_dir / '_index.md').write_text(
                    f'---\ntitle: Pagination fixture\ntranslationKey: {category}\n---\n',
                    encoding='utf-8')
                for number in range(count):
                    slug = f'{category}-{number}'
                    (content / 'posts' / f'2026-01-01-{slug}.md').write_text(
                        f'---\ntitle: Pagination fixture {number}\ndate: 2026-01-01\n'
                        f'slug: {slug}\ncategories: [{category}]\n'
                        f'aliases: [/posts/2026-01-01-{slug}/]\n---\nFixture.\n',
                        encoding='utf-8')
            overlay = root / 'fixture.toml'
            overlay.write_text(
                'resourceDir = ' + repr(str(root / 'resources')) + '\n'
                '[params.list]\npaginate = 20\n'
                '[languages.zh-cn]\ncontentDir = ' + repr(str(root / 'content')) + '\n'
                '[languages.en]\ncontentDir = ' + repr(str(root / 'content_en')) + '\n',
                encoding='utf-8')
            public = root / 'public'
            build = subprocess.run(['hugo', '--source', str(ROOT), '--config', f'{ROOT / "hugo.toml"},{overlay}',
                                    '--destination', str(public),
                                    '--cacheDir', str(root / 'cache'), '--minify', '--panicOnWarning'],
                                   capture_output=True, text=True, encoding='utf-8', timeout=120)
            self.assertEqual(0, build.returncode, build.stdout + build.stderr)
            page = public / f'categories/{category}/page/3/index.html'
            self.assertTrue(page.is_file())
            self.assertFalse((public / f'en/categories/{category}/page/3/index.html').exists())
            links = Links(page.read_text(encoding='utf-8')).elements
            switches = [attrs['href'] for tag, attrs in links if tag == 'a' and attrs.get('lang') == 'en']
            self.assertEqual([f'/en/categories/{category}/'] * 2, switches)
            self.assertFalse(any(tag == 'link' and attrs.get('hreflang') == 'en' for tag, attrs in links))
            self.assertTrue(any(attrs.get('rel') == 'canonical' and attrs.get('href') ==
                                f'https://mantou-blog.pages.dev/categories/{category}/page/3/' for _, attrs in links))
            # Verify every language switch/hreflang generated anywhere, not only the fixture page.
            for output in public.rglob('*.html'):
                for tag, attrs in Links(output.read_text(encoding='utf-8')).elements:
                    if not attrs.get('hreflang') or not attrs.get('href'):
                        continue
                    target = public / unquote(urlsplit(attrs['href']).path).lstrip('/')
                    if attrs['href'].endswith('/'):
                        target /= 'index.html'
                    self.assertTrue(target.is_file(), f'{output.relative_to(public)} -> {attrs["href"]}')
            matching = Links((public / f'en/categories/{category}/page/2/index.html').read_text(encoding='utf-8')).elements
            self.assertTrue(any(attrs.get('hreflang') == 'zh-cn' and attrs.get('href') ==
                                f'https://mantou-blog.pages.dev/categories/{category}/page/2/' for _, attrs in matching))
