// Static Hugo output characterization only; browser network/visibility is E2E.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

test('TM-002 characterization: empty serverURL builds article and mail without Waline entry points', () => {
  const destination = mkdtempSync(join(tmpdir(), 'mantou-disabled-feedback-'));
  try {
    execFileSync(process.env.HUGO_BIN || 'hugo', ['--destination', destination, '--minify', '--panicOnWarning'], {
      cwd: resolve(__dirname, '../..'), stdio: 'pipe',
    });
    for (const route of ['/p/20260803/', '/en/p/20260803/', '/works/mantou-checklist-pwa/']) {
      const html = readFileSync(join(destination, route, 'index.html'), 'utf8');
      assert.match(html, /<h1\b[^>]*>[^<]+<\/h1>/, route);
      const sections = html.match(/<section\b[^>]*data-reader-feedback[^>]*>[\s\S]*?<\/section>/g) || [];
      assert.equal(sections.length, 1, route);
      assert.doesNotMatch(sections[0], /<button\b|<textarea\b|data-feedback-count/, route);
      assert.doesNotMatch(html, /data-feedback-server|\/lib\/waline\/|reader-feedback\.js/, route);
      const mail = sections[0].match(/href=(?:"(mailto:[^"]+)"|'(mailto:[^']+)'|(mailto:[^ >]+))/);
      assert.ok(mail, `${route} retains a mailto link`);
      const url = new URL((mail[1] || mail[2] || mail[3]).replace(/&amp;/g, '&'));
      assert.ok(url.pathname, 'Mail recipient is present');
      assert.ok(url.searchParams.get('subject'), 'Mail subject is present');
      assert.ok(url.searchParams.get('body').includes(`https://mantou-blog.pages.dev${route}`), route);
    }
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
});
