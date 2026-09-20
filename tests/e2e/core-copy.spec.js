const { test, expect } = require('@playwright/test');

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

test('首页按身份、实践范围、证据和下一步组织核心信息', async ({ page }) => {
  await open(page, '/');

  const home = page.locator('[data-portfolio-home]');
  await expect(home.getByRole('heading', { level: 1 })).toContainText('我是 mantou');
  await expect(home).toContainText('个人系统、主动投资、轻量工具与 AI 协作');
  await expect(page.locator('[data-portfolio-status]')).toContainText(/目前公开 \d+ 个可独立验收的作品/);
  await expect(home.getByRole('link', { name: '查看已公开作品' })).toHaveAttribute('href', '/works/');
  await expect(home.getByRole('link', { name: '查看工作原则与合作范围' })).toHaveAttribute('href', '/about/');
  await expect(home.getByRole('link', { name: '订阅后续更新' })).toHaveAttribute('href', '/follow/');
  await expect(home.getByRole('heading', { name: '长期实践的四个方向', level: 2 })).toBeVisible();
  await expect(home.getByRole('link', { name: '当前在做什么', exact: true })).toHaveAttribute('href', '/now/');
});

test('当前下注清单说明验证问题、检查点与人工复核时间', async ({ page }) => {
  await open(page, '/now/');

  const now = page.locator('[data-now-page]');
  await expect(now.getByRole('heading', { name: '当前在做什么', level: 1 })).toBeVisible();
  const items = now.locator('.now-item');
  const count = await items.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(4);

  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    await expect(item.locator('h2')).not.toBeEmpty();
    await expect(item.getByRole('heading', { name: '正在验证', level: 3 })).toBeVisible();
    await expect(item.getByRole('heading', { name: '下一检查点', level: 3 })).toBeVisible();
    await expect(item.locator('.now-item__detail p')).toHaveCount(2);
    await expect(item.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('作品集说明收录标准并把证据承诺落到公开案例', async ({ page }) => {
  await open(page, '/works/');

  const index = page.locator('[data-works-index]');
  await expect(index).toContainText('只收录完成阶段验收');
  await expect(index).toContainText('问题与约束 · 阶段产出 · 验证证据 · 失败与限制 · 下一步判断');

  const firstCase = index.locator('.work-card__link').first();
  await expect(firstCase).toHaveAttribute('href', /\/works\/[^/]+\/$/);
  await firstCase.click();
  await expect(page.locator('[data-work-detail]')).toBeVisible();
  await expect(page.locator('.evidence-panel')).toBeVisible();
});

test('关于页区分实践范围、公开证据和联系前提', async ({ page }) => {
  await open(page, '/about/');

  const about = page.locator('[data-about-collaboration]');
  await expect(about.getByRole('heading', { level: 1 })).toContainText('我是 mantou');
  await expect(about).toContainText('已有公开 PWA 案例可供核对');
  await expect(about).toContainText('当前证据以公开个人作品为主');
  await expect(about.getByRole('link', { name: '邮件说明你的问题' })).toHaveAttribute(
    'href',
    'mailto:2114206091@qq.com',
  );
  await expect(about.getByRole('link', { name: '核对 GitHub 源码' })).toHaveAttribute(
    'href',
    'https://github.com/Maoxin1',
  );
});

test('关注页准确说明两种送达方式及第三方边界', async ({ page }) => {
  await open(page, '/follow/');

  const follow = page.locator('[data-follow-page]');
  await expect(follow.getByRole('heading', { name: '订阅博客更新', level: 1 })).toBeVisible();
  await expect(follow).toContainText('邮箱地址会提交给 follow.it');
  await expect(follow.locator('[data-follow-form]')).toHaveAttribute(
    'action',
    /^https:\/\/api\.follow\.it\/subscription-form\//,
  );
  await expect(follow.getByRole('button', { name: /复制 RSS 地址/ })).toHaveAttribute(
    'data-feed-url',
    'https://mantou-blog.pages.dev/index.xml',
  );

  const feed = await page.evaluate(async () => {
    const response = await fetch('/index.xml');
    if (!response.ok) {
      throw new Error(`RSS feed returned ${response.status}`);
    }
    return response.text();
  });
  expect(feed).toContain('把个人定投清单做成可离线运行的手机 PWA');
  expect(feed).toContain('<title>First</title>');
});
