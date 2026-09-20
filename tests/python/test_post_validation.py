import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import validate_posts


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
