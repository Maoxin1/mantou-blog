import unittest

from scripts.verify_cms_pr import validate_cms_pr


def pull_request(*, is_draft: bool = True) -> dict[str, object]:
    return {
        "baseRefName": "main",
        "headRefName": "cms/works/canary",
        "isDraft": is_draft,
        "labels": [{"name": "sveltia-cms/draft"}],
        "state": "OPEN",
        "files": [{"path": "content/works/canary.md"}],
    }


class CmsPullRequestAcceptanceTests(unittest.TestCase):
    def test_accepts_a_real_draft_with_a_single_semantic_field_change(self) -> None:
        diff = """diff --git a/content/works/canary.md b/content/works/canary.md
--- a/content/works/canary.md
+++ b/content/works/canary.md
@@ -4 +4 @@
-stage: "before"
+stage: "after"
"""

        issues = validate_cms_pr(
            pull_request(),
            diff,
            expected_file="content/works/canary.md",
            allowed_front_matter_keys={"stage"},
        )

        self.assertEqual([], issues)

    def test_rejects_a_label_only_draft(self) -> None:
        issues = validate_cms_pr(
            pull_request(is_draft=False),
            "",
            expected_file="content/works/canary.md",
            allowed_front_matter_keys={"stage"},
        )

        self.assertTrue(any("GitHub Draft PR" in issue for issue in issues))

    def test_rejects_front_matter_reformatting(self) -> None:
        diff = """@@ -1,2 +1,2 @@
-title: "Canary"
+title: Canary
-stage: "before"
+stage: "after"
"""

        issues = validate_cms_pr(
            pull_request(),
            diff,
            expected_file="content/works/canary.md",
            allowed_front_matter_keys={"stage"},
        )

        self.assertTrue(any("unrelated Front Matter keys" in issue for issue in issues))

    def test_rejects_an_extra_changed_file(self) -> None:
        payload = pull_request()
        payload["files"] = [
            {"path": "content/works/canary.md"},
            {"path": "static/images/unexpected.png"},
        ]

        issues = validate_cms_pr(
            payload,
            "",
            expected_file="content/works/canary.md",
            allowed_front_matter_keys={"stage"},
        )

        self.assertTrue(any("exactly one expected file" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
