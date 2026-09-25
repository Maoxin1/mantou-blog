import importlib.util
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("translations", Path(__file__).parents[2] / "scripts/validate_translations.py")
translations = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(translations)

class TranslationContractTests(unittest.TestCase):
    def test_missing_stale_and_matched_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "content/posts").mkdir(parents=True)
            (root / "content_en/posts").mkdir(parents=True)
            raw = "---\ntitle: 原文\nslug: sample\ndate: 2026-09-25\n---\n原文内容\n"
            source = root / "content/posts/sample.md"
            source.write_text(raw, encoding="utf-8")
            self.assertTrue(any("missing English" in x for x in translations.validate(root)))
            pending = []
            self.assertEqual(translations.validate(root, allow_pending=True, pending=pending), [])
            self.assertTrue(any("missing English" in x for x in pending))
            target = root / "content_en/posts/sample.md"
            target.write_text("---\ntitle: Translation\nslug: sample\ndate: 2026-09-25\ntranslation_status: machine\ntranslation_source_hash: " + translations.digest(raw) + "\n---\nTranslated body\n", encoding="utf-8")
            self.assertEqual(translations.validate(root), [])
            source.write_text(raw + "New paragraph", encoding="utf-8")
            self.assertTrue(any("source changed" in x for x in translations.validate(root)))
            self.assertEqual(translations.validate(root, allow_pending=True), [])
            target.write_text(target.read_text(encoding="utf-8").replace("slug: sample", "slug: wrong"), encoding="utf-8")
            self.assertTrue(any("slug must match" in x for x in translations.validate(root, allow_pending=True)))

    def test_drafts_do_not_block_publication(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "content").mkdir()
            (root / "content/draft.md").write_text("---\ntitle: Draft\ndraft: true\n---\n", encoding="utf-8")
            self.assertEqual(translations.validate(root), [])
