import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'scripts/deployment_metadata.py'
SPEC = importlib.util.spec_from_file_location('deployment_metadata', SCRIPT)
metadata = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(metadata)


class DeploymentMetadataTests(unittest.TestCase):
    def setUp(self):
        self.version = {'commit_sha': 'a' * 40, 'deploy_branch': 'main',
                        'run_id': '12345', 'run_attempt': '2'}

    def test_exact_source_and_run_attempt_are_preserved(self):
        line = metadata.expected_version(self.version, '12345', '2')
        name, value = line.strip().split('=', 1)
        self.assertEqual(name, 'SMOKE_EXPECTED_VERSION')
        self.assertEqual(json.loads(value), self.version)

    def test_preview_cannot_be_used_as_production_expectation(self):
        self.version['deploy_branch'] = 'manual-preview'
        self.assertEqual(metadata.validate(self.version), self.version)
        with self.assertRaisesRegex(ValueError, 'preview'):
            metadata.expected_version(self.version, '12345', '2')

    def test_wrong_run_or_attempt_is_rejected(self):
        for run_id, attempt in [('12346', '2'), ('12345', '1')]:
            with self.subTest(run_id=run_id, attempt=attempt), self.assertRaisesRegex(ValueError, 'triggering'):
                metadata.expected_version(self.version, run_id, attempt)

    def test_invalid_or_injected_metadata_is_rejected(self):
        for field, value in [('commit_sha', 'main'), ('commit_sha', 'a' * 40 + '\nINJECT=true'),
                             ('deploy_branch', 'feature/test'), ('run_id', 12345),
                             ('run_id', '0'), ('run_attempt', '2\nINJECT=true')]:
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                metadata.validate({**self.version, field: value})
        for value in [None, [], {**self.version, 'extra': 'value'}, {'commit_sha': 'a' * 40}]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                metadata.validate(value)

    def test_cli_round_trip_and_failed_preview_does_not_write_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            version = Path(directory) / 'version.json'
            environment = Path(directory) / 'github-env'
            env = {**os.environ, 'DEPLOY_COMMIT': self.version['commit_sha'],
                   'DEPLOY_BRANCH': 'main', 'GITHUB_RUN_ID': '12345', 'GITHUB_RUN_ATTEMPT': '2',
                   'DEPLOY_RUN_ID': '12345', 'DEPLOY_RUN_ATTEMPT': '2', 'GITHUB_ENV': str(environment)}
            for command in ['write', 'expected']:
                result = subprocess.run([sys.executable, str(SCRIPT), command, str(version)],
                                        env=env, capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(version.read_text()), self.version)
            expected = metadata.expected_version(self.version, '12345', '2')
            self.assertEqual(environment.read_text(), expected)
            version.write_text(json.dumps({**self.version, 'deploy_branch': 'manual-preview'}))
            result = subprocess.run([sys.executable, str(SCRIPT), 'expected', str(version)],
                                    env=env, capture_output=True, text=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(environment.read_text(), expected)


if __name__ == '__main__':
    unittest.main()
