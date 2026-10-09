import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('TM-OVW-007 backend is compiled into the credential-free verified artifact before packaging', () => {
  const workflow = fs.readFileSync('.github/workflows/deploy-pages.yml', 'utf8');
  const build = workflow.slice(0, workflow.indexOf('\n  deploy:'));
  assert.ok(build.indexOf('npm run build:analytics') > -1, 'Private backend must be bundled with the verified build');
  assert.ok(build.indexOf('npm run build:analytics') < build.indexOf('Package the credential-free site'));
  assert.ok(!build.includes('secrets.CLOUDFLARE_API_TOKEN'), 'Build must not receive deployment credentials');
});
