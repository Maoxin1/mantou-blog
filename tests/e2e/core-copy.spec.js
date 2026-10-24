const { test, expect } = require('@playwright/test');

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

test('首页同时呈现最近更新、精选文章和实际工具', async ({ page }) => {
  await open(page, '/');

  const home = page.locator('[data-portfolio-home]');
  await expect(home.getByRole('heading', { level: 1 })).toHaveText('知不足而奋进，望远山而前行。');
  await expect(home.locator('[data-home-latest] li')).toHaveCount(5);
  await expect(home.locator('[data-home-selected]')).toContainText('友谊万岁：我的感动日记！');
  await expect(home.locator('[data-home-selected] a[href="/works/body-sculpting/"]')).toBeVisible();
  await expect(home.locator('[data-home-featured-work] .mantou-project-art')).toBeVisible();
  await expect(home.getByRole('link', { name: /了解用途与安装/ })).toHaveAttribute('href', '/works/codex-agents/');
  await expect(home.getByRole('link', { name: /看当前进展/ })).toHaveAttribute('href', '/now/');
});

test('近况保留真实记录日期，不展示未确认的复查计划', async ({ page }) => {
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
    const reviewed = item.locator('.now-item__updated:not(.now-item__review-date) time');
    const planned = item.locator('.now-item__review-date time');
    await expect(reviewed).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(planned).toHaveCount(0);
  }
  await expect(now).not.toContainText('中文 X');

  await open(page, '/en/now/');
  const english = page.locator('[data-now-page]');
  await expect(english.locator('.now-item')).toHaveCount(count);
  await expect(english.locator('.now-item__review-date')).toHaveCount(0);
});

test('作品集使用作品自身摘要引导读者进入公开案例', async ({ page }) => {
  await open(page, '/works/');

  const index = page.locator('[data-works-index]');
  await expect(index).toContainText('七月的一次眩晕');
  await expect(index).toContainText('真实手机断网启动失败后');
  await expect(index).toContainText('具体任务表现仍需继续记录');

  const firstCase = index.locator('.work-card__link').first();
  await expect(firstCase).toHaveAttribute('href', /\/works\/[^/]+\/$/);
  await firstCase.click();
  await expect(page.locator('[data-work-detail]')).toBeVisible();
  await expect(page.locator('.evidence-panel')).toBeVisible();
});

test('关于页区分实践范围、公开证据和联系前提', async ({ page }) => {
  await open(page, '/about/');

  const about = page.locator('[data-about-collaboration]');
  await expect(about.getByRole('heading', { level: 1 })).toContainText('关于 mantou');
  await expect(about).toContainText('已有公开 PWA 案例可供核对');
  await expect(about).toContainText('当前证据以公开个人作品为主');
  await about.locator('.about-principles-detail summary').click();
  await expect(about).toContainText('从真实问题开始');
  await expect(about.getByRole('link', { name: '邮件说明你的问题' })).toHaveAttribute(
    'href',
    'mailto:2114206091@qq.com',
  );
  await expect(about.getByRole('link', { name: '查看 GitHub 源码' })).toHaveAttribute(
    'href',
    'https://github.com/Maoxin1',
  );
  await expect(about.getByRole('link', { name: 'X · @mantouaoao' })).toHaveAttribute('href', 'https://x.com/mantouaoao');
  await expect(about.getByRole('link', { name: /看 Agent 的使用与验证记录/ })).toHaveAttribute('href', '/works/codex-agents/');
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
