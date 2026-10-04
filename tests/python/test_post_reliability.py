import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import check_short_post_urls, validate_posts
from scripts.post_front_matter import parse_front_matter, legacy_aliases


class FrontMatterTests(unittest.TestCase):
    def test_yaml_toml_bom_crlf_and_inline_lists(self):
        for text in [
            '---\nslug: 20260101\naliases:\n  - /posts/旧文章/\n---\nBody',
            '\ufeff---\r\nslug: example\r\naliases: [/posts/example/]\r\n---\r\n',
            '+++\nslug = "example"\naliases = ["/posts/example/"]\n+++\n',
        ]:
            with self.subTest(text=text):
                self.assertEqual(1, len(legacy_aliases(parse_front_matter(text))))

    def test_rejects_missing_delimiters_invalid_yaml_and_duplicate_keys(self):
        for text in [
            'title: example\n---\n', '---\ntitle: example\n',
            'Body\n---\ntitle: example\n---\n',
            '---\nslug: one\nslug: two\n---\n',
            '---\naliases: [broken\n---\n',
            '+++\nslug = "one"\nslug = "two"\n+++\n',
            '---\n- one\n- two\n---\n',
        ]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_front_matter(text)

    def test_alias_examples_in_body_or_unsafe_paths_do_not_pass(self):
        for text in [
            '---\ntitle: Example\n---\n```yaml\naliases:\n  - /posts/example/\n```',
            '---\naliases: ["/posts/example/?draft=1"]\n---\n',
            '---\naliases: [/posts/../../outside/]\n---\n',
            '---\naliases: [/posts/%2e%2e/outside/]\n---\n',
            '---\naliases: [/posts/one%5c..%5ctwo/]\n---\n',
            '---\naliases: /posts/example/\n---\n',
        ]:
            with self.subTest(text=text):
                self.assertEqual([], legacy_aliases(parse_front_matter(text)))

    def test_post_fields_must_be_in_front_matter_and_have_valid_types(self):
        with tempfile.TemporaryDirectory() as directory:
            post = Path(directory) / '2026-01-01-example.md'
            for fields in [
                'description: Example',
                'date: 2026-01-01\ntitle: ""\nslug: [example]',
                'date: 2026-02-30\ntitle: Example\nslug: example',
            ]:
                post.write_text('---\n' + fields + '\n---\n```yaml\ndate: 2026-01-01\n'
                                'title: Example\nslug: example\naliases: [/posts/example/]\n```', encoding='utf-8')
                issues = []
                validate_posts.check(post, '2026-01-01', 'post.md', issues)
                self.assertTrue(issues)
                if '2026-02-30' not in fields:
                    self.assertTrue(any('legacy' in issue for issue in issues))

    def test_null_boolean_and_invalid_explicit_yaml_types_cannot_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            post = Path(directory) / '2026-01-01-example.md'
            for field, value in [('title', 'null'), ('title', 'false'), ('title', '!!int not-a-number'),
                                 ('slug', 'null'), ('slug', 'false'), ('date', 'null')]:
                fields = {'title': 'Example', 'date': '2026-01-01', 'slug': 'example'}
                fields[field] = value
                post.write_text('---\n' + ''.join(f'{key}: {value}\n' for key, value in fields.items())
                                + 'aliases: [/posts/example/]\n---\nBody', encoding='utf-8')
                issues = []
                validate_posts.check(post, '2026-01-01', 'post.md', issues)
                self.assertTrue(issues, f'{field}: {value} must fail')

    def test_existing_numeric_titles_and_date_number_slugs_remain_valid(self):
        with tempfile.TemporaryDirectory() as directory:
            post = Path(directory) / '2026-01-01-example.md'
            post.write_text('---\ntitle: 1.28\ndate: 2026-01-01\nslug: 20260101\n'
                            'aliases: [/posts/example/]\n---\nBody', encoding='utf-8')
            issues = []
            self.assertEqual('20260101', validate_posts.check(post, '2026-01-01', 'post.md', issues))
            self.assertEqual([], issues)


class RedirectOutputTests(unittest.TestCase):
    def test_every_legacy_redirect_must_exist_and_match_canonical_and_refresh(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            posts, public = root / 'content/posts', root / 'public'
            posts.mkdir(parents=True)
            article = public / 'p/example/index.html'
            article.parent.mkdir(parents=True)
            canonical = 'https://mantou-blog.pages.dev/p/example/'
            article.write_text(f'<link rel="canonical" href="{canonical}">', encoding='utf-8')
            (public / 'index.xml').write_text(f'<rss><link>{canonical}</link></rss>', encoding='utf-8')
            (posts / '2026-01-01-example.md').write_text(
                '---\nslug: example\naliases: [/posts/legacy/, /posts/older/]\n---\n', encoding='utf-8')
            with patch.object(check_short_post_urls, 'ROOT', root), \
                 patch.object(check_short_post_urls, 'POSTS_DIR', posts), \
                 patch.object(check_short_post_urls, 'PUBLIC_DIR', public), \
                 contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(1, check_short_post_urls.main())
                for alias in ['legacy', 'older']:
                    output = public / 'posts' / alias / 'index.html'
                    output.parent.mkdir(parents=True)
                    output.write_text(f'<link rel="canonical" href="{canonical}">'
                                      f'<meta http-equiv="refresh" content="0;url={canonical}">', encoding='utf-8')
                self.assertEqual(0, check_short_post_urls.main())
                output = public / 'posts/older/index.html'
                for target, refresh in [('', canonical), ('https://example.com/wrong/', canonical),
                                        (canonical, ''), (canonical, 'https://example.com/wrong/')]:
                    output.write_text(f'<link rel="canonical" href="{target}">'
                                      f'<meta http-equiv="refresh" content="0;url={refresh}">', encoding='utf-8')
                    self.assertEqual(1, check_short_post_urls.main())

    def test_metadata_gate_runs_before_node_hugo_and_browser_setup(self):
        workflow = (Path(__file__).resolve().parents[2] / '.github/workflows/validate.yml').read_text()
        self.assertLess(workflow.index('python scripts/validate_posts.py'), workflow.index('name: Set up Node.js'))
        self.assertLess(workflow.index('requirements-validation.txt'), workflow.index('python scripts/validate_posts.py'))
