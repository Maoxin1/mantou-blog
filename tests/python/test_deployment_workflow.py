import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATE_WORKFLOW = ROOT / ".github" / "workflows" / "validate.yml"
DEPLOY_WORKFLOW = ROOT / ".github" / "workflows" / "deploy-pages.yml"


class DeploymentWorkflowSecurityTests(unittest.TestCase):
    def test_validation_never_reads_cloudflare_credentials_or_deploys(self) -> None:
        workflow = VALIDATE_WORKFLOW.read_text(encoding="utf-8")

        self.assertNotIn("CLOUDFLARE_API_TOKEN", workflow)
        self.assertNotRegex(workflow, r"\bwrangler\b.*\bpages\s+deploy\b")

    def test_deployment_has_trusted_automatic_and_manual_entry_points(self) -> None:
        workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("workflow_run:", workflow)
        self.assertIn('workflows: ["Validate"]', workflow)
        self.assertIn("types: [completed]", workflow)
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("source_ref:", workflow)

    def test_production_only_follows_successful_main_push_validation(self) -> None:
        workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")

        for condition in (
            "github.event.workflow_run.conclusion == 'success'",
            "github.event.workflow_run.event == 'push'",
            "github.event.workflow_run.head_branch == 'main'",
        ):
            self.assertIn(condition, workflow)

    def test_untrusted_source_is_built_without_deployment_secret(self) -> None:
        workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
        build_job, deploy_job = self._job_sections(workflow)

        self.assertNotIn("CLOUDFLARE_API_TOKEN", build_job)
        self.assertIn("actions/upload-artifact@", build_job)
        self.assertIn("actions/download-artifact@", deploy_job)

    def test_only_environment_gated_job_reads_deployment_secret(self) -> None:
        workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
        _, deploy_job = self._job_sections(workflow)

        self.assertEqual(1, workflow.count("secrets.CLOUDFLARE_API_TOKEN"))
        self.assertIn("environment: pages-deploy", deploy_job)
        self.assertIn("secrets.CLOUDFLARE_API_TOKEN", deploy_job)
        self.assertIn("wrangler pages deploy", deploy_job)

    @staticmethod
    def _job_sections(workflow: str) -> tuple[str, str]:
        build_match = re.search(
            r"(?ms)^  build:\s*$.*?(?=^  deploy:\s*$)", workflow
        )
        deploy_match = re.search(r"(?ms)^  deploy:\s*$.*\Z", workflow)
        if build_match is None or deploy_match is None:
            raise AssertionError("deploy workflow must contain build and deploy jobs")
        return build_match.group(0), deploy_match.group(0)


if __name__ == "__main__":
    unittest.main()
