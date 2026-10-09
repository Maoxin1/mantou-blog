import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--outdir')) throw new Error('Expected optional --outdir path');
const output = path.resolve(args[1] || path.join(root, 'public/_worker.js'));
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/wrangler/bin/wrangler.js'),
  'pages', 'functions', 'build', '--outdir', output, '--minify'], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
// Preserve the reused library's MIT notice in the distributed module itself.
const license = fs.readFileSync(path.join(root, 'node_modules/jose/LICENSE.md'), 'utf8');
fs.appendFileSync(path.join(output, 'index.js'), `\n/* @license jose 6.2.12\n${license.replaceAll('*/', '* /')}\n*/\n`);
