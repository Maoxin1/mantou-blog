"""Keep high-specificity custom anchor rules on the same sticky-header token."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class AnchorOffsetTests(unittest.TestCase):
    def test_active_custom_anchor_rules_share_the_header_offset(self):
        for filename in ['_custom.scss', '_balanced.scss', '_visual-identity.scss']:
            text = (ROOT / 'assets/css' / filename).read_text()
            offsets = re.findall(r'scroll-margin-top:\s*([^;]+);', text)
            self.assertTrue(offsets, filename)
            for offset in offsets:
                self.assertIn('var(--anchor-offset', offset, f'{filename}: {offset}')

    def test_header_token_tracks_desktop_and_mobile_height(self):
        text = (ROOT / 'assets/css/_visual-identity.scss').read_text()
        self.assertIn('--anchor-offset: calc(var(--header-height) + 16px);', text)
        self.assertIn('--header-height: 100px;', text)
        self.assertIn('--header-height: 81px;', text)
        self.assertIn('.mantou-site .page { width: 100%; padding-top: 0; }', text)
