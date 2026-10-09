import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('TM-OVW-007 actual Wrangler output is an advanced-mode module directory, not a multipart upload body', () => {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const temporary = fs.mkdtempSync(path.join(tempRoot, 'mantou-overview-bundle-'));
  const output = path.join(temporary, '_worker.js');
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const command = manifest.scripts['build:analytics'].split(' ');
  assert.equal(command.shift(), 'node');
  const result = spawnSync(process.execPath, [...command, '--outdir', output], {
    encoding: 'utf8', timeout: 45000, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  try {
    assert.equal(result.status, 0, 'Compilation itself must succeed before checking format');
    assert.ok(fs.statSync(output).isDirectory(), 'Deployment/runtime needs module directory; --outfile emitted a multipart body');
    const modules = fs.readdirSync(output).filter(name => /\.(m?js)$/.test(name));
    assert.ok(modules.length > 0, 'Bundle must contain JavaScript modules');
    for (const file of modules) assert.ok(!fs.readFileSync(path.join(output, file), 'utf8').startsWith('------formdata-'), 'Not a JavaScript deployment module');
  } finally {
    const resolved = fs.realpathSync(temporary);
    if (!resolved.startsWith(tempRoot + path.sep) || !path.basename(resolved).startsWith('mantou-overview-bundle-')) throw new Error('Refusing unexpected cleanup target');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
