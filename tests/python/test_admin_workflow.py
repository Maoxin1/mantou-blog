import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "static" / "admin" / "config.yml"
HEADERS_PATH = ROOT / "static" / "_headers"
SERVICE_WORKER_PATH = ROOT / "static" / "sw.js"
SVELTIA_INDEX_PATH = ROOT / "static" / "admin" / "sveltia" / "index.html"
SVELTIA_CONFIG_PATH = ROOT / "static" / "admin" / "sveltia" / "config.yml"

SVELTIA_VERSION = "0.203.2"
SVELTIA_INTEGRITY = (
    "sha384-fue7kFAg94Qs3xB6zYD5VeYJyw99klOSaHkOuTXQg888TMyBgMN6PyO+TxyASS+S"
)


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

    def test_service_worker_bypasses_every_admin_route(self) -> None:
        service_worker = SERVICE_WORKER_PATH.read_text(encoding="utf-8")

        self.assertIn("url.pathname === '/admin'", service_worker)
        self.assertIn("url.pathname.startsWith('/admin/')", service_worker)

    def test_sveltia_canary_is_version_pinned_and_integrity_checked(self) -> None:
        self.assertTrue(SVELTIA_INDEX_PATH.is_file(), "missing Sveltia canary entry")
        index = SVELTIA_INDEX_PATH.read_text(encoding="utf-8")

        self.assertIn(
            f"https://unpkg.com/@sveltia/cms@{SVELTIA_VERSION}/dist/sveltia-cms.js",
            index,
        )
        self.assertIn(
            f"https://cdn.jsdelivr.net/npm/@sveltia/cms@{SVELTIA_VERSION}/dist/sveltia-cms.js",
            index,
        )
        self.assertEqual(1, index.count(SVELTIA_INTEGRITY))
        self.assertEqual(2, index.count("          integrity,"))

    def test_sveltia_canary_reuses_shared_config_with_a_safe_overlay(self) -> None:
        self.assertTrue(SVELTIA_INDEX_PATH.is_file(), "missing Sveltia canary entry")
        self.assertTrue(SVELTIA_CONFIG_PATH.is_file(), "missing Sveltia config overlay")
        index = SVELTIA_INDEX_PATH.read_text(encoding="utf-8")
        overlay = SVELTIA_CONFIG_PATH.read_text(encoding="utf-8")

        self.assertRegex(
            index,
            r'<link\s+href="/admin/config\.yml"\s+type="application/yaml"\s+rel="cms-config-url"',
        )
        self.assertRegex(
            index,
            r'<link\s+href="/admin/sveltia/config\.yml"\s+type="application/yaml"\s+rel="cms-config-url"',
        )
        self.assertRegex(overlay, r"(?m)^output:\s*$")
        self.assertRegex(overlay, r"(?m)^\s+yaml:\s*$")
        self.assertRegex(overlay, r"(?m)^\s+quote:\s*double\s*$")


if __name__ == "__main__":
    unittest.main()
