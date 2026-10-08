import json
import tempfile
import unittest
from pathlib import Path

from scripts.check_garden_output import Document, validate_home, validate_garden_output

ROOT = Path(__file__).resolve().parents[2]


class GardenLayoutTests(unittest.TestCase):
    def test_localized_garden_copy_is_complete(self):
        keys = ("identityKicker", "identityTitleFirst", "identityTitleSecond", "identityLead", "identityStart", "identityProjects", "identityHeroAlt", "identityHeroCaption", "identityBridgeAlt", "identityClosing", "gardenSkip")
        for language in ("en", "zh-cn"):
            copy = json.loads((ROOT / "i18n" / f"{language}.json").read_text(encoding="utf-8"))
            for key in keys:
                self.assertTrue(copy[key]["other"].strip(), f"{language}: {key}")

    def test_responsive_and_dark_theme_contracts_are_present(self):
        css = (ROOT / "assets/css/_visual-identity.scss").read_text(encoding="utf-8")
        for rule in (".mantou-site[theme=dark]", ".garden-skip:focus", "min-width: 1025px", "max-width: 1024px", "max-width: 680px", "grid-template-columns: minmax(0, 1fr)", "#header-mobile", "#header-desktop", "#toc-static", "#toc-auto"):
            self.assertIn(rule, css)
        self.assertIn('@import "visual-identity"', (ROOT / "assets/css/_custom.scss").read_text(encoding="utf-8"))

    def test_skip_destination_and_mobile_toggle_are_semantic(self):
        base = (ROOT / "layouts/_default/baseof.html").read_text(encoding="utf-8")
        header = (ROOT / "layouts/partials/header.html").read_text(encoding="utf-8")
        self.assertIn('href="#main-content"', base)
        self.assertIn('<main class="main" id="main-content" tabindex="-1">', base)
        self.assertIn('aria-controls="menu-mobile"', header)
        self.assertIn('aria-expanded="false"', header)
        self.assertIn('type="button" class="menu-toggle"', header)

    def test_toc_stays_in_the_visible_static_container(self):
        template = (ROOT / 'layouts/posts/single.html').read_text(encoding='utf-8')
        self.assertIn('id="toc-static" data-kept="true"', template)

    def test_output_checker_rejects_retired_investment_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            for marker in ('data-home-filter="investment"', 'data-home-topic="investment"', 'data-home-featured-post'):
                issues = validate_home(f'<section {marker}></section>', "", Path(directory))
                self.assertTrue(any("retired investment" in issue for issue in issues))

    def test_document_parser_keeps_nested_text_and_void_elements(self):
        root = Document('<h1>Ideas <em>grow</em>.</h1><img src="x"><nav><a href="/">Home</a></nav>').root
        self.assertEqual(root.find(tag="h1")[0].text, "Ideas grow.")
        self.assertEqual(root.find(tag="nav")[0].find(tag="a")[0].attrs["href"], "/")

    def test_output_checker_rejects_missing_homes(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(len(validate_garden_output(Path(directory))), 2)

    def test_output_checker_rejects_empty_modules_and_broken_links(self):
        with tempfile.TemporaryDirectory() as directory:
            issues = validate_home('<h1>Wrong title</h1><section data-garden-reading></section><a href="/missing/">Broken</a>', "", Path(directory))
            self.assertTrue(any("single localized garden h1" in issue for issue in issues))
            self.assertTrue(any("data-garden-reading" in issue for issue in issues))
            self.assertTrue(any("missing target /missing/" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
