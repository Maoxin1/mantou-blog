const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test.use({ serviceWorkers: 'block' });
// Tests use synthetic endpoints and must never write to the real service.
test.beforeEach(async ({ page }) => {
  await page.route('https://mantou-comments.vercel.app/**', route => route.abort());
});
let enabledSite;
let disabledSite;
const articlePath = '/p/20260803/';

test.beforeAll(() => {
  disabledSite = mkdtempSync(join(tmpdir(), 'mantou-feedback-disabled-'));
  execFileSync(process.env.HUGO_BIN || 'hugo', ['--config', 'hugo.toml', '--destination', disabledSite, '--minify', '--panicOnWarning'], { stdio: 'pipe' });
  enabledSite = mkdtempSync(join(tmpdir(), 'mantou-feedback-'));
  execFileSync(process.env.HUGO_BIN || 'hugo', [
    '--config', 'hugo.toml,tests/fixtures/feedback.toml',
    '--destination', enabledSite, '--minify', '--panicOnWarning',
  ], { stdio: 'pipe' });
});

test.afterAll(() => {
  if (disabledSite) rmSync(disabledSite, { recursive: true, force: true });
  if (enabledSite) rmSync(enabledSite, { recursive: true, force: true });
});

async function enableFeedback(page, state = {}) {
  state.count ??= 4;
  state.writes ??= [];
  state.requests ??= [];
  await page.route('**/p/20260803/', async route => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ contentType: 'text/html', body: readFileSync(join(enabledSite, pathname, 'index.html')) });
  });
  // Fingerprinted feedback assets belong to this enabled fixture build, while
  // the shared static server uses the default (feedback-disabled) build.
  await page.route(/\/(?:js\/reader-feedback|lib\/waline\/3\.15\.2\/waline)\.[a-f0-9]+\.js(?:\?.*)?$/, async route => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(enabledSite, pathname)) });
  });
  await page.route('https://comments.example.test/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push(url.pathname);
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' } });
      return;
    }
    const json = data => route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
    if (state.offline) return json({ errno: 503, errmsg: 'Temporarily unavailable' });
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      state.writes.push({ endpoint: url.pathname, body });
      if (url.pathname === '/api/article') {
        if (state.rejectReaction) return json({ errno: 503, errmsg: 'Reaction not saved' });
        state.count += body.action === 'desc' ? -1 : 1;
        return json({ errno: 0, data: [{ reaction0: state.count }] });
      }
      if (state.holdComment) await state.holdComment;
      // A rejected comment must retain the reader's draft; no live service is contacted.
      return json({ errno: 1, errmsg: '测试服务暂时无法保存留言' });
    }
    if (url.pathname === '/api/article') return json({ errno: 0, data: [{ reaction0: state.count }] });
    if (url.pathname === '/api/comment') return json({ errno: 0, data: { count: 0, data: [], page: 1, pageSize: 5, totalPages: 0 } });
    return json({ errno: 0, data: [] });
  });
  return state;
}

for (const width of [1366, 390]) {
  test(`真实照片在 ${width}px 加载并能进入来源文章`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const gallery = page.locator('[data-home-photos]');
    await gallery.scrollIntoViewIfNeeded();
    const images = gallery.locator('img');
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('alt', /.+/);
      await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await gallery.locator('a').first().click();
    await expect(page.locator('h1')).toContainText('友谊万岁');
    await page.goto('/posts/');
    const thumbnail = page.locator('.archive-item__image').first();
    await thumbnail.scrollIntoViewIfNeeded();
    await expect.poll(() => thumbnail.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test('未配置服务时提供真实邮件反馈，不展示点赞或评论计数', async ({ page }) => {
  // Characterize the explicit disabled configuration even when the server
  // hosts a production-enabled build.
  await page.route(/\/(?:en\/)?(?:p\/20260803|works\/mantou-checklist-pwa)\/$/, route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ contentType: 'text/html', body: readFileSync(join(disabledSite, pathname, 'index.html')) });
  });
  const network = [];
  page.on('request', request => network.push(request.url()));
  for (const path of [articlePath, `/en${articlePath}`, '/works/mantou-checklist-pwa/']) {
    await page.goto(path);
    const feedback = page.locator('[data-reader-feedback]');
    await expect(feedback).toHaveCount(1);
    const mail = new URL(await feedback.locator('a[href^="mailto:"]').getAttribute('href'));
    const title = await page.locator('h1').innerText();
    expect(mail.searchParams.get('subject')).toContain(title);
    expect(mail.searchParams.get('body')).toContain(`https://mantou-blog.pages.dev${path}`);
    await expect(feedback.locator('button')).toHaveCount(0);
  }
  expect(network.some(url => url.includes('/lib/waline/') || url.includes('comments.example.test'))).toBe(false);
});

test('评论按需加载，键盘点赞与取消都读回服务端总数', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await enableFeedback(page);
  await page.goto(`/en${articlePath}`);
  expect(state.requests).toHaveLength(0);
  await page.locator('[data-feedback-load]').click();
  await expect(page.locator('#reader-comments textarea')).toBeVisible();
  await expect(page.locator('#reader-comments .wl-login')).toHaveCount(0);
  const helpful = page.locator('[data-feedback-helpful]');
  await expect(helpful).toContainText('4');
  await helpful.focus();
  await page.keyboard.press('Enter');
  await expect(helpful).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-feedback-count]')).toHaveText('5');
  expect(state.writes[0]).toEqual({ endpoint: '/api/article', body: { path: articlePath, type: 'reaction0', action: 'inc' } });
  await page.reload();
  await page.locator('[data-feedback-load]').click();
  await expect(helpful).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-feedback-count]')).toHaveText('5');
  await helpful.click();
  await expect(helpful).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-feedback-count]')).toHaveText('4');
  await page.evaluate(() => document.body.setAttribute('theme', 'dark'));
  await expect(helpful).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('.reader-feedback__email')).toBeVisible();
});

test('服务故障可重试，点赞保存失败不显示成功', async ({ page }) => {
  const state = await enableFeedback(page, { offline: true });
  await page.goto(articlePath);
  await page.locator('[data-feedback-load]').click();
  await expect(page.locator('[data-feedback-status]')).toContainText('评论暂时没加载出来');
  await expect(page.locator('[data-feedback-load]')).toBeEnabled();
  await expect(page.locator('[data-feedback-helpful]')).toBeHidden();
  await expect(page.locator('.reader-feedback__email')).toBeVisible();
  state.offline = false;
  await page.locator('[data-feedback-load]').click();
  await expect(page.locator('#reader-comments textarea')).toBeVisible();
  state.rejectReaction = true;
  const helpful = page.locator('[data-feedback-helpful]');
  await helpful.click();
  await expect(page.locator('[data-feedback-status]')).toContainText('点赞没存上');
  await expect(helpful).toHaveAttribute('aria-pressed', 'false');
  await expect(helpful).toBeEnabled();
  await expect(page.locator('[data-feedback-count]')).toHaveText('4');
  state.rejectReaction = false;
  await helpful.click();
  await expect(page.locator('[data-feedback-count]')).toHaveText('5');
});

test('无需登录和邮箱即可提交，服务拒绝时保留留言草稿', async ({ page }) => {
  const state = await enableFeedback(page);
  await page.goto(articlePath);
  await page.locator('[data-feedback-load]').click();
  await page.locator('#reader-comments input[name="nick"]').fill('测试读者');
  const editor = page.locator('#reader-comments textarea');
  await editor.fill('这段关于学习的想法很有帮助。');
  const dialog = page.waitForEvent('dialog');
  await editor.press('Control+Enter');
  const rejection = await dialog;
  expect(rejection.message()).toBe('测试服务暂时无法保存留言');
  await rejection.accept();
  await expect(editor).toHaveValue('这段关于学习的想法很有帮助。');
  const submitted = state.writes.find(write => write.endpoint === '/api/comment').body;
  expect(submitted).toMatchObject({ nick: '测试读者', mail: '', url: articlePath });
});


test('TM-019：异步 UA 准备、连续点击和快捷键共用一次提交锁', async ({ page }) => {
  let releaseComment;
  const holdComment = new Promise(resolve => { releaseComment = resolve; });
  const state = await enableFeedback(page, { holdComment });
  await page.addInitScript(() => {
    const pending = [];
    window.releaseFeedbackUA = () => pending.splice(0).forEach(resolve => resolve({ platformVersion: '13.0.0' }));
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      value: {
        platform: 'Windows',
        getHighEntropyValues: () => new Promise(resolve => pending.push(resolve)),
      },
    });
  });
  await page.goto(articlePath);
  await page.locator('[data-feedback-load]').click();
  await page.locator('#reader-comments input[name="nick"]').fill('测试读者');
  const editor = page.locator('#reader-comments textarea');
  await editor.fill('异步窗口中的同一份草稿');
  await page.evaluate(() => {
    const button = document.querySelector('#reader-comments button[type="submit"].primary');
    const textarea = document.querySelector('#reader-comments textarea');
    button.click();
    button.click();
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
  });
  expect(state.writes.filter(write => write.endpoint === '/api/comment')).toHaveLength(0);
  await page.evaluate(() => window.releaseFeedbackUA());
  await expect.poll(() => state.writes.filter(write => write.endpoint === '/api/comment').length).toBe(1);
  await editor.press('Control+Enter');
  await editor.press('Meta+Enter');
  const submit = page.locator('#reader-comments button[type="submit"].primary');
  await expect(submit).toBeDisabled();
  const dialog = page.waitForEvent('dialog');
  releaseComment();
  const rejection = await dialog;
  expect(rejection.message()).toBe('测试服务暂时无法保存留言');
  await rejection.accept();
  await expect(submit).toBeEnabled();
  await expect(editor).toHaveValue('异步窗口中的同一份草稿');
  expect(state.writes.filter(write => write.endpoint === '/api/comment')).toHaveLength(1);
  await expect(page.locator('.reader-feedback__email')).toBeVisible();
  await expect(page.locator('h1')).toBeVisible();
});

for (const resource of ['CSS', 'JS']) {
  test(`TM-024：${resource} 明确加载失败后保留正文邮件，恢复后可显式重试`, async ({ page }) => {
    const state = await enableFeedback(page);
    let unavailable = true;
    const resourceRequests = [];
    const pattern = resource === 'CSS'
      ? '**/lib/waline/3.15.2/waline.css'
      : /\/lib\/waline\/3\.15\.2\/waline\.[a-f0-9]+\.js(?:\?.*)?$/;
    await page.route(pattern, route => {
      resourceRequests.push(route.request().url());
      return unavailable ? route.abort('failed') : route.fallback();
    });
    await page.goto(articlePath);
    const trigger = page.locator('[data-feedback-load]');
    await trigger.click();
    await expect(page.locator('[data-feedback-status]')).toContainText('评论暂时没加载出来');
    await expect(trigger).toBeEnabled();
    await expect(page.locator('#reader-comments textarea')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.reader-feedback__email')).toBeVisible();
    expect(state.requests).toHaveLength(0);
    unavailable = false;
    // Recovery must use the visible explicit retry; no automatic reload or POST.
    await trigger.click();
    await expect(page.locator('#reader-comments textarea')).toBeVisible();
    await expect(page.locator('#reader-comments [data-waline]')).toHaveCount(1);
    await expect(trigger).toBeHidden();
    await expect(page.locator('[data-feedback-status]')).toHaveText('');
    expect(state.writes).toHaveLength(0);
    expect(resourceRequests).toHaveLength(2);
    if (resource === 'JS') {
      expect(new URL(resourceRequests[1]).pathname).toBe(new URL(resourceRequests[0]).pathname);
      expect(new URL(resourceRequests[1]).searchParams.get('retry')).toBe('1');
    }
  });
}
