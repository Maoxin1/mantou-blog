const { test, expect } = require('@playwright/test');

test('正式站版本对应成功部署的精确提交与运行批次', async ({ request }) => {
  test.setTimeout(150_000);
  // Daily/manual smoke checks inspect the live version without assuming that
  // the repository's latest commit has already reached production.
  const expected = process.env.SMOKE_EXPECTED_VERSION
    ? JSON.parse(process.env.SMOKE_EXPECTED_VERSION) : {
      commit_sha: expect.stringMatching(/^[0-9a-f]{40}$/),
      deploy_branch: 'main',
      run_id: expect.stringMatching(/^[1-9][0-9]*$/),
      run_attempt: expect.stringMatching(/^[1-9][0-9]*$/),
    };
  await expect.poll(async () => {
    try {
      // APIRequestContext bypasses Service Workers; a unique URL and no-cache
      // prevent a prior CDN/browser response from claiming a successful release.
      const response = await request.get(`/version.json?smoke=${Date.now()}`, {
        headers: { 'cache-control': 'no-cache' }, timeout: 10_000,
      });
      if (!response.ok()) return { error: `HTTP ${response.status()}` };
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  }, {
    message: 'Production must serve the expected deployment version',
    timeout: 120_000,
    intervals: [1_000, 2_000, 5_000, 10_000],
  }).toEqual(expected);
});
