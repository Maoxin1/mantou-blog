import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('discussion_manifest', ROOT / 'scripts/discussion_manifest.py')
MANIFEST = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MANIFEST)
SHA = 'a' * 40

class DiscussionManifestTests(unittest.TestCase):
    def page(self, root, route, canonical, language='zh-cn', server=MANIFEST.BLOG_COMMENTS):
        file = root / route.strip('/') / 'index.html'
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(f'<div data-feedback-server={server} data-feedback-path={canonical} '
                        f'data-feedback-lang={language} data-feedback-reactions=false></div>', encoding='utf-8')

    def test_articles_works_and_translations_produce_one_canonical_path_each(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.page(root, '/p/new/', '/p/new/')
            self.page(root, '/en/p/new/', '/p/new/', 'en')
            self.page(root, '/works/new/', '/works/new/')
            self.page(root, '/en/works/new/', '/works/new/', 'en')
            manifest = MANIFEST.generate(root, SHA)
            self.assertEqual(manifest['paths'], ['/p/new/', '/works/new/'])
            self.assertEqual(MANIFEST.check(root, SHA), manifest)

    def test_unpublished_pages_absent_from_build_and_non_discussion_pages_are_excluded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.page(root, '/p/published/', '/p/published/')
            (root / 'index.html').write_text('<p>Home without a discussion</p>', encoding='utf-8')
            manifest = MANIFEST.generate(root, SHA)
            self.assertEqual(manifest['paths'], ['/p/published/'])

    def test_english_only_publication_keeps_the_canonical_non_language_path(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.page(root, '/en/works/english-only/', '/works/english-only/', 'en')
            self.assertEqual(MANIFEST.generate(root, SHA)['paths'], ['/works/english-only/'])

    def test_inconsistent_translation_unknown_origin_and_noncanonical_path_fail_generation(self):
        for route, canonical, language, server in [
                ('/en/p/a/', '/en/p/a/', 'en', MANIFEST.BLOG_COMMENTS),
                ('/p/a/', '/p/b/', 'zh-cn', MANIFEST.BLOG_COMMENTS),
                ('/p/a/', '/p/a/', 'en', MANIFEST.BLOG_COMMENTS),
                ('/p/a/', '/p/a/', 'zh-cn', 'https://evil.invalid'),
                ('/p/a/', '/p/../', 'zh-cn', MANIFEST.BLOG_COMMENTS)]:
            with self.subTest(route=route, canonical=canonical, server=server):
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    self.page(root, route, canonical, language, server)
                    with self.assertRaises(ValueError):
                        MANIFEST.generate(root, SHA)

    def test_registry_tampering_and_wrong_source_commit_fail_output_check(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.page(root, '/p/new/', '/p/new/')
            MANIFEST.generate(root, SHA)
            with self.assertRaises(ValueError):
                MANIFEST.check(root, 'b' * 40)
            manifest = root / MANIFEST.REGISTRY_PATH
            body = json.loads(manifest.read_text(encoding='utf-8'))
            body['paths'].append('/p/not-published/')
            manifest.write_text(json.dumps(body), encoding='utf-8')
            with self.assertRaises(ValueError):
                MANIFEST.check(root, SHA)

    def test_empty_site_produces_an_explicit_empty_registry(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(MANIFEST.generate(Path(directory), SHA)['paths'], [])

    def test_workflow_generates_registry_only_for_production_and_before_packaging(self):
        import yaml
        workflow = yaml.safe_load((ROOT / '.github/workflows/deploy-pages.yml').read_text(encoding='utf-8'))
        steps = workflow['jobs']['build']['steps']
        generate = next(s for s in steps if 'discussion_manifest.py generate' in s.get('run', ''))
        self.assertEqual(generate['if'], "github.event_name == 'workflow_run'")
        self.assertEqual(generate['env']['DISCUSSION_SOURCE_COMMIT'], '${{ steps.source.outputs.commit_sha }}')
        build_index = next(i for i,s in enumerate(steps) if s['name'] == 'Build production site')
        generate_index = steps.index(generate)
        package_index = next(i for i,s in enumerate(steps) if s['name'] == 'Package the credential-free site')
        self.assertLess(build_index, generate_index)
        self.assertLess(generate_index, package_index)
        self.assertIn('discussion_manifest.py check', generate['run'])
        self.assertRegex((ROOT / 'static/_headers').read_text(encoding='utf-8'),
                         r'/feedback/threads\.json\n\s+Cache-Control: no-store')

if __name__ == '__main__':
    unittest.main()
