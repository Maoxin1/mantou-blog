import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "optimize-images.yml"


class ImageOptimizationWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.workflow = WORKFLOW_PATH.read_text(encoding="utf-8")

    def test_images_are_optimized_on_the_pull_request_before_merge(self) -> None:
        self.assertIn("pull_request:", self.workflow)
        self.assertNotIn("branches: [main]", self.workflow)

    def test_external_forks_are_not_given_write_access(self) -> None:
        self.assertIn(
            "github.event.pull_request.head.repo.full_name == github.repository",
            self.workflow,
        )

    def test_optimizer_never_pushes_directly_to_protected_main(self) -> None:
        self.assertNotIn("git push origin HEAD:main", self.workflow)
        self.assertIn("github.event.pull_request.head.ref", self.workflow)


if __name__ == "__main__":
    unittest.main()
