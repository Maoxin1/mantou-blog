const assert = require('node:assert/strict');

async function checkUncachedResource(request, resourcePath, baseURL) {
  const origin = new URL(baseURL);
  const pathname = new URL(resourcePath, origin).pathname;
  const privateAnalytics = pathname === '/admin/analytics' || pathname.startsWith('/admin/analytics/');
  const response = await request.get(resourcePath, privateAnalytics ? { maxRedirects: 0 } : undefined);
  if (privateAnalytics) {
    assert.ok([302, 303, 307, 308].includes(response.status()), `${resourcePath} must return a login challenge; received HTTP ${response.status()}`);
    const location = new URL(response.headers().location || '', origin);
    const team = process.env.SMOKE_ACCESS_TEAM_DOMAIN || 'frosty-fire-be92.cloudflareaccess.com';
    assert.equal(location.protocol, 'https:', 'Access team redirect must use HTTPS');
    assert.equal(location.hostname, team, 'Redirect must use the configured Access team');
    assert.equal(location.pathname, `/cdn-cgi/access/login/${origin.hostname}`, 'Access challenge must target this site');
  } else {
    assert.ok(response.ok(), `${resourcePath} should be readable`);
  }
  assert.ok((response.headers()['cache-control'] || '').includes('no-store'), `${resourcePath} must prohibit caching`);
  return response;
}

module.exports = { checkUncachedResource };
