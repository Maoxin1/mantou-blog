"""Exercise the shared browser hook offline without authenticating or publishing."""
import json
import subprocess
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]


class AdminAliasTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        program = r'''
const fs = require('node:fs');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync('static/admin/post-aliases.js', 'utf8'), { window, WeakSet });
let calls = 0, hook;
const cms = { registerEventListener: value => { calls++; hook = value; } };
window.registerPostAliases(cms);
window.registerPostAliases(cms);
const map = value => ({ get: key => value[key], set: (key, next) => map({ ...value, [key]: next }) });
const input = map({ date: '2026-10-04T08:30:00+08:00', slug: 'new-post', aliases: { toJS: () => ['/posts/older/'] } });
const save = (data, extra = {}) => hook.handler({ entry: map({ data, collection: 'posts', newRecord: true, isModification: null, ...extra }) });
const first = save(input);
const unchanged = [false, undefined].map(newRecord => save(input, { newRecord }) === input);
let invalidRejected = 0;
for (const data of [{ date: '', slug: 'post' }, { date: '2026-10-04', slug: 'A'.repeat(33) }]) {
  try { save(map(data)); } catch { invalidRejected++; }
}
let unsupportedRejected = false;
try { window.registerPostAliases({}); } catch { unsupportedRejected = true; }
console.log(JSON.stringify({ calls, name: hook.name, first: first.get('aliases'), again: save(first).get('aliases'), unchanged,
  otherUnchanged: save(input, { collection: 'works' }) === input, invalidRejected, unsupportedRejected }));
'''
        result = subprocess.run(['node', '-e', program], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
        cls.result = json.loads(result.stdout)

    def test_new_post_adds_alias_once_and_keeps_existing_aliases(self):
        self.assertEqual(['/posts/older/', '/posts/2026-10-04-new-post/'], self.result['first'])
        self.assertEqual(self.result['first'], self.result['again'])
        self.assertEqual(1, self.result['calls'])
        self.assertEqual('preSave', self.result['name'])

    def test_old_unknown_entries_and_other_collections_are_unchanged(self):
        self.assertEqual([True, True], self.result['unchanged'])
        self.assertTrue(self.result['otherUnchanged'])

    def test_invalid_data_or_missing_hook_support_fails_explicitly(self):
        self.assertEqual(2, self.result['invalidRejected'])
        self.assertTrue(self.result['unsupportedRejected'])

    def test_both_entrypoints_and_shared_config_keep_alias_contract(self):
        for path in ['static/admin/index.html', 'static/admin/sveltia/index.html']:
            text = (ROOT / path).read_text(encoding='utf-8')
            self.assertIn('<script src="/admin/post-aliases.js"></script>', text)
            self.assertIn('window.registerPostAliases(window.CMS)', text)
        config = yaml.safe_load((ROOT / 'static/admin/config.yml').read_text(encoding='utf-8'))
        posts = next(item for item in config['collections'] if item['name'] == 'posts')
        aliases = next(field for field in posts['fields'] if field['name'] == 'aliases')
        self.assertEqual('hidden', aliases['widget'])
        self.assertEqual([], aliases['default'])
