import tempfile
import unittest
from pathlib import Path

from scripts.check_runtime_assets import validate_runtime_assets


class RuntimeAssetTests(unittest.TestCase):
    def test_clean_output_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            public = Path(directory)
            (public / "index.html").write_text("<main>mantou</main>", encoding="utf-8")

            self.assertEqual([], validate_runtime_assets(public))

    def test_disabled_payload_and_reference_fail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            public = Path(directory)
            font = public / "lib" / "katex" / "fonts" / "example.woff2"
            font.parent.mkdir(parents=True)
            font.write_bytes(b"font")
            (public / "index.html").write_text(
                '<script src="/lib/lightgallery/lightgallery.min.js"></script>',
                encoding="utf-8",
            )

            issues = validate_runtime_assets(public)

            self.assertTrue(any("lib/katex" in issue for issue in issues))
            self.assertTrue(any("lib/lightgallery" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
