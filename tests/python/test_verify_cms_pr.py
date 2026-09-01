import unittest

from scripts.verify_cms_pr import validate_cms_pr


def pull_request(
    *,
    is_draft: bool = True,
    status: str = "draft",
) -> dict[str, object]:
    return {
        "baseRefName": "main",
        "headRefName": "cms/works/canary",
        "isDraft": is_draft,
        "labels": [{"name": f"sveltia-cms/{status}"}],
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

    def test_accepts_each_workflow_status_mapping(self) -> None:
        diff = '-stage: "before"\n+stage: "after"\n'

        for status, is_draft in (
            ("draft", True),
            ("pending_review", False),
            ("pending_publish", False),
        ):
            with self.subTest(status=status):
                issues = validate_cms_pr(
                    pull_request(is_draft=is_draft, status=status),
                    diff,
                    expected_file="content/works/canary.md",
                    allowed_front_matter_keys={"stage"},
                    expected_workflow_status=status,
                )

                self.assertEqual([], issues)

    def test_rejects_a_status_label_that_disagrees_with_the_expected_stage(self) -> None:
        issues = validate_cms_pr(
            pull_request(is_draft=False, status="draft"),
            '-stage: "before"\n+stage: "after"\n',
            expected_file="content/works/canary.md",
            allowed_front_matter_keys={"stage"},
            expected_workflow_status="pending_review",
        )

        self.assertTrue(any("pending_review label" in issue for issue in issues))

    def test_rejects_a_ready_stage_that_is_still_a_github_draft(self) -> None:
        issues = validate_cms_pr(
            pull_request(is_draft=True, status="pending_publish"),
            '-stage: "before"\n+stage: "after"\n',
            expected_file="content/works/canary.md",
            allowed_front_matter_keys={"stage"},
            expected_workflow_status="pending_publish",
        )

        self.assertTrue(any("must not be a GitHub Draft" in issue for issue in issues))

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
