const { test, expect } = require('@playwright/test');

for (const path of ['/admin/', '/admin/sveltia/']) {
  test(`${path} registers the shared alias hook with the real pinned CMS`, async ({ page }) => {
    // Capture registration only: no login, draft, save or publishing request is made.
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
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => window.aliasHook?.name), { timeout: 20000 }).toBe('preSave');
    await expect(page.locator('#cms-error')).toBeHidden();
    const result = await page.evaluate(() => {
      const immutable = value => ({
        get: key => value[key],
        set: (key, next) => immutable({ ...value, [key]: next }),
        toJS: () => value,
      });
      const original = immutable({ date: '2026-10-04', slug: 'new-entry', aliases: [] });
      const save = (data, extra = {}) => window.aliasHook.handler({ entry: immutable({
        data, collection: 'posts', newRecord: true, isModification: null, ...extra,
      }) });
      const first = save(original);
      const historical = immutable({ date: '2026-10-04', slug: 'new-entry', aliases: ['/posts/旧地址/'] });
      let invalidRejected = false;
      try { save(immutable({ date: '', slug: 'new-entry' })); } catch { invalidRejected = true; }
      return {
        first: first.get('aliases'), again: save(first).get('aliases'),
        existingUnchanged: save(historical, { newRecord: false }) === historical,
        unknownUnchanged: save(historical, { newRecord: undefined }) === historical,
        otherUnchanged: save(original, { collection: 'works' }) === original,
        preserved: save(historical).get('aliases'), invalidRejected,
      };
    });
    expect(result.first).toEqual(['/posts/2026-10-04-new-entry/']);
    expect(result.again).toEqual(result.first);
    expect(result.preserved).toEqual(['/posts/旧地址/', '/posts/2026-10-04-new-entry/']);
    for (const key of ['existingUnchanged', 'unknownUnchanged', 'otherUnchanged', 'invalidRejected']) {
      expect(result[key], key).toBe(true);
    }
  });
}
