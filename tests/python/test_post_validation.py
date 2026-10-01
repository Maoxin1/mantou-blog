import tempfile
import unittest
import contextlib
import io
from pathlib import Path
from unittest.mock import patch

from scripts import validate_posts, check_short_post_urls


class LegacyRedirectTests(unittest.TestCase):
    def test_accepts_yaml_and_toml_front_matter_aliases(self):
        for text in [
            '---\naliases:\n  - "/posts/旧文章/"\n---\nBody',
            "---\naliases: ['/posts/example/']\n---\nBody",
            '+++\naliases = ["/posts/example/"]\n+++\nBody',
        ]:
            with self.subTest(text=text):
                self.assertEqual(1, len(validate_posts.legacy_aliases(text)))

    def test_body_examples_and_invalid_paths_do_not_satisfy_alias_contract(self):
        for text in [
            '---\ntitle: Example\n---\naliases:\n  - /posts/example/\n',
            '---\naliases:\n  - /posts/example/?draft=1\n---\n',
            '---\naliases:\n  - /posts/../../outside/\n---\n',
            '---\naliases:\n  - /posts/%2e%2e/outside/\n---\n',
        ]:
            with self.subTest(text=text):
                issues = []
                validate_posts.validate_legacy_alias(Path('2026-01-01-example.md'), text, 'post.md', issues)
                self.assertTrue(issues)

    def test_generated_redirect_must_exist_and_target_its_own_article(self):
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
                '---\nslug: example\naliases:\n  - /posts/legacy/\n---\n', encoding='utf-8')
            redirect = public / 'posts/legacy/index.html'
            with patch.object(check_short_post_urls, 'ROOT', root), \
                 patch.object(check_short_post_urls, 'POSTS_DIR', posts), \
                 patch.object(check_short_post_urls, 'PUBLIC_DIR', public), \
                 contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(1, check_short_post_urls.main())
                redirect.parent.mkdir(parents=True)
                for target, expected in [('https://example.com/wrong/', 1), (canonical, 0)]:
                    redirect.write_text(
                        f'<link rel="canonical" href="{canonical}">'
                        f'<meta http-equiv="refresh" content="0;url={target}">', encoding='utf-8')
                    self.assertEqual(expected, check_short_post_urls.main())


class PostImageValidationTests(unittest.TestCase):
    def test_accepts_existing_local_and_remote_images(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            post = root / "content" / "posts" / "2026-01-01-example.md"
            post.parent.mkdir(parents=True)
            (root / "static" / "images").mkdir(parents=True)
            (root / "static" / "images" / "site image.jpg").write_bytes(b"image")
            (post.parent / "bundle image.png").write_bytes(b"image")
            text = "\n".join(
                (
                    "![站点图片](/images/site%20image.jpg)",
                    "![同目录图片](<bundle image.png>)",
                    "![远程图片](https://example.com/image.jpg)",
                )
            )
            issues: list[str] = []

            with patch.object(validate_posts, "ROOT", root):
                validate_posts.validate_images(post, text, str(post), issues)

            self.assertEqual([], issues)

    def test_reports_empty_alt_target_and_missing_local_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            post = root / "content" / "posts" / "2026-01-01-example.md"
            post.parent.mkdir(parents=True)
            text = "![ ](/images/missing.jpg)\n![]()"
            issues: list[str] = []

            with patch.object(validate_posts, "ROOT", root):
                validate_posts.validate_images(post, text, "post.md", issues)

            self.assertEqual(
                [
                    "post.md:1: Markdown image is missing alt text",
                    "post.md:1: local image does not exist: /images/missing.jpg",
                    "post.md:2: Markdown image is missing alt text",
                    "post.md:2: empty Markdown image target",
                ],
                issues,
            )


if __name__ == "__main__":
    unittest.main()
