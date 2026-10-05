const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { patch, originalSHA256, replacements } = require('../../scripts/patch_waline_submit.cjs');

test('Waline patch reproduces exactly from the hash-locked official 3.15.2 bundle', () => {
  const served = readFileSync(join(__dirname, '../../static/lib/waline/3.15.2/waline.js'), 'utf8');
  let upstream = served;
  for (const [before, after] of [...replacements].reverse()) {
    assert.equal(upstream.split(after).length, 2);
    upstream = upstream.replace(after, before);
  }
  assert.equal(createHash('sha256').update(upstream).digest('hex'), originalSHA256);
  assert.equal(patch(upstream), served);
  assert.throws(() => patch('unknown bundle'), /Unexpected Waline source SHA-256/);
  assert.throws(() => patch(served), /Unexpected Waline source SHA-256/, 'Patch must not be double-applied');
});
