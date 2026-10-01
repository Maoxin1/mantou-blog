const { test, expect } = require('@playwright/test');

test('新文章自动补充旧路径，重复保存、历史文章和其他集合保留原别名', async ({ page }) => {
  // Capture the real CMS hook without logging in or creating a GitHub draft.
  await page.addInitScript(() => {
    let cms;
    Object.defineProperty(window, 'CMS', {
      configurable: true,
      get: () => cms,
      set: value => {
        const register = value.registerEventListener.bind(value);
        value.registerEventListener = listener => {
          if (listener.name === 'preSave') window.aliasHook = listener;
          return register(listener);
        };
        cms = value;
      },
    });
  });
  await page.goto('/admin/');
  await expect.poll(() => page.evaluate(() => window.aliasHook?.name)).toBe('preSave');
  const results = await page.evaluate(() => {
    const immutable = value => ({
      get: key => value[key],
      set: (key, next) => immutable({ ...value, [key]: next }),
      toJS: () => value,
    });
    const save = (data, collection = 'posts', isModification = false) => (
      window.aliasHook.handler({ entry: immutable({ data, collection, isModification }) })
    );
    const original = immutable({ date: '2026-10-01T08:00:00+08:00', slug: 'example',
      aliases: { toJS: () => ['/posts/historical/'] } });
    const first = save(original);
    return {
      first: first.get('aliases'),
      again: save(first).get('aliases'),
      historicalUnchanged: save(original, 'posts', true) === original,
      otherUnchanged: save(original, 'works') === original,
      invalidUnchanged: save(immutable({ date: '', slug: 'example' })).get('aliases') === undefined,
    };
  });
  expect(results.first).toEqual(['/posts/historical/', '/posts/2026-10-01-example/']);
  expect(results.again).toEqual(results.first);
  expect(results.historicalUnchanged).toBe(true);
  expect(results.otherUnchanged).toBe(true);
  expect(results.invalidUnchanged).toBe(true);
});
