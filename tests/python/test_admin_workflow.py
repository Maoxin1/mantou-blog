import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "static" / "admin" / "config.yml"
HEADERS_PATH = ROOT / "static" / "_headers"


class AdminPublishingWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.config = CONFIG_PATH.read_text(encoding="utf-8")
        cls.backend = cls.config.split("media_folder:", maxsplit=1)[0]
        cls.headers = HEADERS_PATH.read_text(encoding="utf-8")

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

    def test_admin_configuration_cannot_be_reused_from_http_cache(self) -> None:
        self.assertRegex(
            self.headers,
            r"(?m)^/admin/\*\s*$\n^\s+Cache-Control:\s*no-store\s*$",
        )

    def test_service_worker_update_is_always_revalidated(self) -> None:
        self.assertRegex(
            self.headers,
            r"(?m)^/sw\.js\s*$\n^\s+Cache-Control:\s*no-cache, max-age=0, must-revalidate\s*$",
        )


if __name__ == "__main__":
    unittest.main()
