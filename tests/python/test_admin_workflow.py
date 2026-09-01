import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "static" / "admin" / "config.yml"


class AdminPublishingWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.config = CONFIG_PATH.read_text(encoding="utf-8")
        cls.backend = cls.config.split("media_folder:", maxsplit=1)[0]

    def test_content_changes_use_pull_requests_instead_of_direct_main_pushes(self) -> None:
        self.assertRegex(
            self.config,
            r"(?m)^publish_mode:\s*editorial_workflow\s*$",
        )

    def test_cms_uses_linear_history_compatible_squash_merges(self) -> None:
        self.assertRegex(
            self.backend,
            r"(?m)^\s+squash_merges:\s*true\s*$",
        )

    def test_publication_branch_remains_protected_main(self) -> None:
        self.assertRegex(self.backend, r"(?m)^\s+branch:\s*main\s*$")


if __name__ == "__main__":
    unittest.main()
