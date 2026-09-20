import re
import unittest
from pathlib import Path

import yaml

from scripts.validate_admin_config import parse_front_matter_text
from scripts.validate_portfolio import UniqueKeyLoader


ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "static" / "admin" / "config.yml"
NOW_CONTENT_PATH = ROOT / "content" / "now.md"
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
        cls.parsed_config = yaml.load(cls.config, Loader=UniqueKeyLoader)
        cls.sveltia_overlay = yaml.load(
            SVELTIA_CONFIG_PATH.read_text(encoding="utf-8"),
            Loader=UniqueKeyLoader,
        )
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
        self.assertRegex(
            overlay,
            r"(?m)^\s+omit_empty_optional_fields:\s*true\s*$",
        )
        self.assertRegex(overlay, r"(?m)^\s+yaml:\s*$")
        self.assertRegex(overlay, r"(?m)^\s+quote:\s*double\s*$")

    def test_sveltia_installed_app_uses_mantou_branding(self) -> None:
        self.assertEqual("mantou 内容工作台", self.sveltia_overlay["app_title"])
        self.assertEqual(
            {
                "src": "/images/mantou.jpg",
                "show_in_header": True,
            },
            self.sveltia_overlay["logo"],
        )
        self.assertTrue((ROOT / "static" / "images" / "mantou.jpg").is_file())

    def test_optional_investment_review_does_not_pollute_other_work_drafts(self) -> None:
        works = next(
            collection
            for collection in self.parsed_config["collections"]
            if collection["name"] == "works"
        )
        privacy_review = next(
            field
            for field in works["fields"]
            if field["name"] == "privacy_reviewed"
        )

        self.assertEqual("select", privacy_review["widget"])
        self.assertFalse(privacy_review["required"])
        self.assertNotIn("default", privacy_review)
        self.assertEqual(
            [{"label": "已完成", "value": "true"}],
            privacy_review["options"],
        )

    def test_work_afterlife_fields_are_optional_and_minimal(self) -> None:
        works = next(
            collection
            for collection in self.parsed_config["collections"]
            if collection["name"] == "works"
        )
        fields = {field["name"]: field for field in works["fields"]}

        follow_ups = fields["follow_ups"]
        self.assertEqual("list", follow_ups["widget"])
        self.assertFalse(follow_ups["required"])
        self.assertNotIn("default", follow_ups)
        self.assertEqual(
            {"date", "note"},
            {field["name"] for field in follow_ups["fields"]},
        )

        reused_in = fields["reused_in"]
        self.assertEqual("list", reused_in["widget"])
        self.assertFalse(reused_in["required"])
        self.assertNotIn("default", reused_in)
        self.assertEqual(
            {"title", "note", "url"},
            {field["name"] for field in reused_in["fields"]},
        )
        url = next(field for field in reused_in["fields"] if field["name"] == "url")
        self.assertFalse(url["required"])

    def test_new_posts_require_an_ascii_share_slug(self) -> None:
        posts = next(
            collection
            for collection in self.parsed_config["collections"]
            if collection["name"] == "posts"
        )
        share_slug = next(
            field
            for field in posts["fields"]
            if field["name"] == "slug"
        )

        self.assertEqual("{{fields.date}}-{{fields.slug}}", posts["slug"])
        self.assertEqual("string", share_slug["widget"])
        self.assertEqual(
            "^(?=.{1,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$",
            share_slug["pattern"][0],
        )

    def test_now_is_a_small_cms_managed_current_bets_list(self) -> None:
        now = next(
            collection
            for collection in self.parsed_config["collections"]
            if collection["name"] == "now"
        )
        now_file = next(file for file in now["files"] if file["name"] == "now")
        directions = next(
            field for field in now_file["fields"] if field["name"] == "directions"
        )

        self.assertEqual("content/now.md", now_file["file"])
        self.assertEqual("list", directions["widget"])
        self.assertEqual(1, directions["min"])
        self.assertEqual(4, directions["max"])
        self.assertEqual(
            {"title", "question", "status", "checkpoint", "updated"},
            {field["name"] for field in directions["fields"]},
        )
        self.assertNotIn("decision", {field["name"] for field in directions["fields"]})

        status = next(
            field for field in directions["fields"] if field["name"] == "status"
        )
        allowed_statuses = set(status["options"])
        now_content = parse_front_matter_text(
            NOW_CONTENT_PATH.read_text(encoding="utf-8"), str(NOW_CONTENT_PATH)
        )
        self.assertGreaterEqual(len(now_content["directions"]), directions["min"])
        self.assertLessEqual(len(now_content["directions"]), directions["max"])
        self.assertTrue(
            all(
                direction["status"] in allowed_statuses
                for direction in now_content["directions"]
            )
        )

    def test_front_matter_parser_ignores_inline_delimiter_text(self) -> None:
        parsed = parse_front_matter_text(
            '---\ncheckpoint: "phase 1 --- phase 2"\nstatus: "进行中"\n---\nBody\n'
        )

        self.assertEqual("phase 1 --- phase 2", parsed["checkpoint"])
        self.assertEqual("进行中", parsed["status"])


if __name__ == "__main__":
    unittest.main()
