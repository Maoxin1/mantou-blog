import re
import json
import os
import shutil
import subprocess
import tempfile
import unittest

import yaml
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATE_WORKFLOW = ROOT / ".github" / "workflows" / "validate.yml"
DEPLOY_WORKFLOW = ROOT / ".github" / "workflows" / "deploy-pages.yml"
SMOKE_WORKFLOW = ROOT / ".github" / "workflows" / "smoke-production.yml"


class DeploymentWorkflowSecurityTests(unittest.TestCase):
    def test_pinned_pages_cli_loads_independent_production_config_without_credentials(self) -> None:
        node = shutil.which('node')
        self.assertIsNotNone(node)
        with tempfile.TemporaryDirectory(prefix='analytics-cli-test-') as temporary:
            fixture = Path(temporary).resolve()
            self.assertEqual(fixture.parent, Path(tempfile.gettempdir()).resolve())
            output = fixture / 'config.json'
            # build-env uses the real Pages config reader without authenticating or deploying.
            env = {key: value for key, value in os.environ.items()
                   if key.upper() in ('PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP')}
            env.update(WRANGLER_SEND_METRICS='false', PAGES_ENVIRONMENT='production',
                       XDG_CONFIG_HOME=str(fixture / 'config'), CI='true')
            result = subprocess.run([
                node, str(ROOT / 'node_modules/wrangler/bin/wrangler.js'),
                'pages', 'functions', 'build-env', '.', '--cwd', 'deploy/analytics',
                '--outfile', str(output),
            ], cwd=ROOT, env=env, capture_output=True, text=True, encoding='utf-8', timeout=60)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            config = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual((ROOT / 'deploy/analytics' / config['pages_build_output_dir']).resolve(),
                             ROOT / 'analytics-public')
            self.assertEqual(config['vars']['ANALYTICS_HOST'], 'mantou-blog.pages.dev')
            self.assertEqual(set(config['vars']),
                             {'ANALYTICS_HOST', 'ANALYTICS_SITE_TAG', 'ANALYTICS_ACCOUNT_ID'})

    def test_independent_analytics_uses_verified_artifact_and_only_automatic_production_deploy(self) -> None:
        workflow = yaml.safe_load(DEPLOY_WORKFLOW.read_text(encoding='utf-8'))
        build = workflow['jobs']['build']['steps']
        compile_index = next(i for i, s in enumerate(build) if 'npm run build:analytics' in s.get('run', ''))
        package_index = next(i for i, s in enumerate(build) if 'node scripts/build_analytics_app.mjs' in s.get('run', ''))
        self.assertLess(compile_index, package_index)
        app_upload = next(s for s in build if s.get('with', {}).get('path') == 'analytics-public/')
        self.assertEqual(app_upload['with']['name'], 'analytics-app-${{ github.run_id }}')
        steps = workflow['jobs']['deploy']['steps']
        app_download = next(s for s in steps if s.get('with', {}).get('path') == 'analytics-public/')
        self.assertEqual(app_download['if'], "github.event_name == 'workflow_run'")
        self.assertEqual(app_download['with']['name'], app_upload['with']['name'])
        marker = next(s for s in steps if 'deployment_metadata.py write' in s.get('run', ''))
        self.assertIn('deployment_metadata.py write analytics-public/version.json', marker['run'])
        deploy = next(s for s in steps if 'wrangler pages deploy' in s.get('run', ''))
        before, app_command = deploy['run'].split('npx wrangler pages deploy ../../analytics-public', 1)
        self.assertIn('if [ "$DEPLOY_BRANCH" = main ]; then', before)
        self.assertIn('--cwd deploy/analytics', app_command)
        self.assertNotIn('--config', app_command, 'Pages deploy rejects custom configuration paths')
        self.assertIn('--project-name=mantou-blog-data', app_command)
        self.assertIn('--commit-hash="$DEPLOY_COMMIT"', app_command)
        self.assertEqual(deploy['env']['DEPLOY_COMMIT'], '${{ needs.build.outputs.commit_sha }}')
        config_dir = ROOT / 'deploy' / 'analytics'
        config = json.loads((config_dir / 'wrangler.jsonc').read_text(encoding='utf-8'))
        self.assertEqual(config['name'], 'mantou-blog-data')
        self.assertEqual((config_dir / config['pages_build_output_dir']).resolve(), ROOT / 'analytics-public')
        self.assertEqual(config['env']['production']['vars']['ANALYTICS_HOST'], 'mantou-blog.pages.dev')
        for key in ('ANALYTICS_API_TOKEN', 'ACCESS_AUD', 'ACCESS_OWNER_EMAIL', 'ACCESS_TEAM_DOMAIN'):
            self.assertNotIn(key, config.get('vars', {}))
            self.assertNotIn(key, config['env']['production']['vars'])

    def test_smoke_follows_only_successful_production_deployments(self) -> None:
        workflow = yaml.safe_load(SMOKE_WORKFLOW.read_text(encoding="utf-8"))
        # PyYAML's YAML 1.1 loader treats the unquoted Actions `on` key as True.
        triggers = workflow[True]
        self.assertEqual(triggers['workflow_run'], {
            'workflows': ['Deploy Pages'], 'types': ['completed'], 'branches': ['main'],
        })
        self.assertIn('workflow_dispatch', triggers)
        self.assertEqual(triggers['schedule'], [{'cron': '15 1 * * *'}])
        guard = workflow['jobs']['deployment']['if']
        for condition in (
            "github.event.workflow_run.conclusion == 'success'",
            "github.event.workflow_run.event == 'workflow_run'",
            "github.event.workflow_run.head_branch == 'main'",
            "github.event.workflow_run.head_repository.full_name == github.repository",
        ):
            self.assertIn(condition, guard)
        self.assertIn('github.event.workflow_run.id', workflow['concurrency']['group'])
        self.assertEqual(workflow['permissions'], {'contents': 'read', 'actions': 'read'})
        self.assertNotIn('CLOUDFLARE_API_TOKEN', SMOKE_WORKFLOW.read_text(encoding='utf-8'))

    def test_smoke_changes_are_checked_on_prs_without_deployment_credentials(self) -> None:
        workflow = yaml.safe_load(SMOKE_WORKFLOW.read_text(encoding='utf-8'))
        trigger = workflow[True]['pull_request']
        self.assertEqual(trigger['branches'], ['main'])
        self.assertIn('tests/smoke/**', trigger['paths'])
        self.assertNotIn('content/**', trigger['paths'])
        self.assertIn('github.event.pull_request.number', workflow['concurrency']['group'])
        self.assertIn("github.event_name == 'workflow_run'", workflow['jobs']['deployment']['if'])
        self.assertIn("github.event_name != 'workflow_run'", workflow['jobs']['smoke']['if'])
        self.assertEqual(workflow['permissions'], {'contents': 'read', 'actions': 'read'})
        self.assertNotIn('secrets.', SMOKE_WORKFLOW.read_text(encoding='utf-8'))

    def test_successful_but_skipped_deployment_does_not_start_smoke(self) -> None:
        workflow = yaml.safe_load(SMOKE_WORKFLOW.read_text(encoding='utf-8'))
        job = workflow['jobs']['deployment']
        step = job['steps'][0]
        self.assertIn('attempts/$DEPLOY_RUN_ATTEMPT/jobs', step['run'])
        self.assertIn('.name == "deploy" and .conclusion == "success"', step['run'])
        self.assertIn('production=false', step['run'])
        self.assertEqual(step['env']['GH_TOKEN'], '${{ github.token }}')
        smoke = workflow['jobs']['smoke']
        self.assertEqual(smoke['needs'], 'deployment')
        self.assertIn("needs.deployment.outputs.production == 'true'", smoke['if'])
        self.assertIn("github.event_name != 'workflow_run'", smoke['if'])
        self.assertIn('always()', smoke['if'])
        self.assertIn('!cancelled()', smoke['if'])

    def test_smoke_uses_exact_deployment_metadata_not_workflow_head(self) -> None:
        workflow = yaml.safe_load(SMOKE_WORKFLOW.read_text(encoding="utf-8"))
        steps = workflow['jobs']['smoke']['steps']
        download = next(step for step in steps if step.get('uses', '').startswith('actions/download-artifact@'))
        self.assertEqual(download['if'], "github.event_name == 'workflow_run'")
        self.assertEqual(download['with']['run-id'], '${{ github.event.workflow_run.id }}')
        self.assertEqual(download['with']['github-token'], '${{ github.token }}')
        self.assertIn('github.event.workflow_run.run_attempt', download['with']['name'])
        verify = next(step for step in steps if 'deployment_metadata.py expected' in step.get('run', ''))
        self.assertEqual(verify['if'], "github.event_name == 'workflow_run'")
        self.assertEqual(verify['env']['DEPLOY_RUN_ID'], '${{ github.event.workflow_run.id }}')
        self.assertEqual(verify['env']['DEPLOY_RUN_ATTEMPT'], '${{ github.event.workflow_run.run_attempt }}')
        self.assertNotIn('workflow_run.head_sha', SMOKE_WORKFLOW.read_text(encoding='utf-8'))

    def test_deployment_publishes_the_same_version_in_site_and_metadata_artifact(self) -> None:
        workflow = yaml.safe_load(DEPLOY_WORKFLOW.read_text(encoding="utf-8"))
        steps = workflow['jobs']['deploy']['steps']
        marker_index = next(index for index, step in enumerate(steps)
                            if 'deployment_metadata.py write' in step.get('run', ''))
        marker = steps[marker_index]
        self.assertEqual(marker['env']['DEPLOY_COMMIT'], '${{ needs.build.outputs.commit_sha }}')
        self.assertEqual(marker['env']['DEPLOY_BRANCH'], '${{ needs.build.outputs.deploy_branch }}')
        upload_index = next(index for index, step in enumerate(steps)
                            if step.get('uses', '').startswith('actions/upload-artifact@'))
        self.assertEqual(steps[upload_index]['with']['path'], 'public/version.json')
        self.assertIn('github.run_attempt', steps[upload_index]['with']['name'])
        deploy_index = next(index for index, step in enumerate(steps)
                            if 'wrangler pages deploy' in step.get('run', ''))
        self.assertLess(marker_index, upload_index)
        self.assertLess(upload_index, deploy_index)
        self.assertRegex((ROOT / 'static/_headers').read_text(encoding='utf-8'),
                         r'/version\.json\n\s+Cache-Control: no-store')

    def test_production_output_validator_dependencies_are_always_installed(self) -> None:
        workflow = yaml.safe_load(DEPLOY_WORKFLOW.read_text(encoding="utf-8"))
        steps = workflow['jobs']['build']['steps']
        install = next(index for index, step in enumerate(steps)
                       if 'requirements-validation.txt' in step.get('run', ''))
        validate = next(index for index, step in enumerate(steps)
                        if 'python scripts/check_short_post_urls.py' in step.get('run', ''))
        self.assertNotIn('if', steps[install], 'Production output checks also need PyYAML')
        self.assertLess(install, validate)

    def test_validation_and_deployment_reject_disabled_runtime_assets(self) -> None:
        for workflow_path in (VALIDATE_WORKFLOW, DEPLOY_WORKFLOW):
            workflow = workflow_path.read_text(encoding="utf-8")
            self.assertIn("python scripts/check_runtime_assets.py", workflow)

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

    def test_deployment_tooling_uses_an_immutable_trusted_revision(self) -> None:
        workflow = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
        _, deploy_job = self._job_sections(workflow)

        self.assertNotRegex(deploy_job, r"(?m)^\s+ref:\s+main\s*$")
        self.assertIn("github.event.workflow_run.head_sha", deploy_job)
        self.assertIn("github.sha", deploy_job)

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
