import tempfile
import unittest
from pathlib import Path

from PIL import Image

from scripts.compress_images import optimize_roots


class ImageCompressionTests(unittest.TestCase):
    def test_rejects_a_corrupt_supported_image(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "broken.jpg"
            image_path.write_bytes(b"this is not a jpeg")

            summary = optimize_roots([Path(directory)], min_bytes=0)

            self.assertEqual(0, summary.changed)
            self.assertEqual(1, len(summary.errors))
            self.assertIn("broken.jpg", summary.errors[0])

    def test_resizes_an_oversized_image(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "large.jpg"
            Image.new("RGB", (2000, 1000), "#2563eb").save(
                image_path,
                "JPEG",
                quality=95,
            )

            summary = optimize_roots([Path(directory)], min_bytes=0)

            self.assertEqual([], summary.errors)
            self.assertEqual(1, summary.changed)
            with Image.open(image_path) as optimized:
                self.assertEqual((1600, 800), optimized.size)

    def test_accepts_a_small_valid_image_without_rewriting_it(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            image_path = Path(directory) / "small.png"
            Image.new("RGBA", (32, 32), "#10b981").save(image_path, "PNG")
            original = image_path.read_bytes()

            summary = optimize_roots([Path(directory)])

            self.assertEqual([], summary.errors)
            self.assertEqual(0, summary.changed)
            self.assertEqual(original, image_path.read_bytes())


if __name__ == "__main__":
    unittest.main()
