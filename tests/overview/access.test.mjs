import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT, createRemoteJWKSet, customFetch, exportJWK } from 'jose';
import { authorize } from '../../functions/_lib/access.mjs';
import { createOverviewHandler } from '../../functions/_lib/handler.mjs';

const env = { ACCESS_TEAM_DOMAIN: 'mantou-test.cloudflareaccess.com', ACCESS_AUD: 'a'.repeat(64), ACCESS_OWNER_EMAIL: 'owner@example.invalid' };
const now = Date.parse('2026-10-09T00:00:00Z');
const { privateKey, publicKey } = await generateKeyPair('RS256');
const options = { key: publicKey, now };
function request(token) {
  return new Request('https://mantou-blog.pages.dev/admin/analytics/data', { headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {} });
}
async function token(overrides = {}) {
  return new SignJWT({ email: overrides.email || env.ACCESS_OWNER_EMAIL }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer(overrides.issuer || `https://${env.ACCESS_TEAM_DOMAIN}`).setAudience(overrides.aud || env.ACCESS_AUD)
    .setSubject('test-subject').setIssuedAt(now / 1000 - 60).setExpirationTime(overrides.exp || now / 1000 + 3600).sign(privateKey);
}

test('TM-OVW-003 rejects absent, forged, expired, wrong-audience/issuer and other-owner JWTs', async () => {
  for (const jwt of [null, 'forged.jwt.value', await token({ exp: now / 1000 - 1 }), await token({ aud: 'b'.repeat(64) }),
    await token({ issuer: 'https://attacker.invalid' }), await token({ email: 'other@example.invalid' })]) {
    await assert.rejects(authorize(request(jwt), env, options), error => error.code === 'UNAUTHORIZED');
  }
});

test('TM-OVW-003 verifies real RS256 signature and owner; ignores spoofed email header', async () => {
  const jwt = await token();
  assert.equal((await authorize(request(jwt), env, options)).email, env.ACCESS_OWNER_EMAIL);
  const spoofed = new Request(request(await token({ email: 'other@example.invalid' })), { headers: {
    'Cf-Access-Jwt-Assertion': await token({ email: 'other@example.invalid' }),
    'Cf-Access-Authenticated-User-Email': env.ACCESS_OWNER_EMAIL,
  } });
  await assert.rejects(authorize(spoofed, env, options));
});

test('TM-OVW-003 missing identity config fails closed before verification', async () => {
  await assert.rejects(authorize(request(await token()), {}, options), error => error.code === 'SETUP_REQUIRED');
  await assert.rejects(authorize(request(await token()), { ...env, ACCESS_TEAM_DOMAIN: 'attacker.invalid' }, options));
});

test('TM-OVW-003 real JWKS retrieval failures report a temporary auth outage, not rejected owner identity', async () => {
  const failures = [
    async () => { throw new TypeError('DNS lookup failed'); },
    async () => { throw new TypeError('TLS connection failed'); },
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('not JSON', { status: 200 }),
    async () => Response.json({ unexpected: [] }),
    async () => { throw new DOMException('request timed out', 'TimeoutError'); },
  ];
  const jwt = await token();
  for (const fetchImpl of failures) {
    const key = createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`), { [customFetch]: fetchImpl });
    await assert.rejects(authorize(request(jwt), env, { key, now }), error => error.code === 'AUTH_UNAVAILABLE' && error.status === 503);
  }
});

test('TM-OVW-003 JWKS recovery verifies the same owner; an unknown signing key still has no permission', async () => {
  const jwk = { ...await exportJWK(publicKey), kid: 'published-key', alg: 'RS256' };
  let fail = true;
  const key = createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`), {
    [customFetch]: async () => {
      if (fail) throw new TypeError('connection refused');
      return Response.json({ keys: [jwk] });
    },
  });
  const jwt = await token();
  await assert.rejects(authorize(request(jwt), env, { key, now }), error => error.code === 'AUTH_UNAVAILABLE');
  fail = false;
  assert.equal((await authorize(request(jwt), env, { key, now })).email, env.ACCESS_OWNER_EMAIL);
  const unknown = await new SignJWT({ email: env.ACCESS_OWNER_EMAIL }).setProtectedHeader({ alg: 'RS256', kid: 'unknown-key' })
    .setIssuer(`https://${env.ACCESS_TEAM_DOMAIN}`).setAudience(env.ACCESS_AUD).setSubject('test-subject')
    .setIssuedAt(now / 1000 - 60).setExpirationTime(now / 1000 + 3600).sign(privateKey);
  await assert.rejects(authorize(request(unknown), env, { key, now }), error => error.code === 'UNAUTHORIZED' && error.status === 401);
  const { privateKey: attackerKey } = await generateKeyPair('RS256');
  const forged = await new SignJWT({ email: env.ACCESS_OWNER_EMAIL }).setProtectedHeader({ alg: 'RS256', kid: 'published-key' })
    .setIssuer(`https://${env.ACCESS_TEAM_DOMAIN}`).setAudience(env.ACCESS_AUD).setSubject('test-subject')
    .setIssuedAt(now / 1000 - 60).setExpirationTime(now / 1000 + 3600).sign(attackerKey);
  await assert.rejects(authorize(request(forged), env, { key, now }), error => error.code === 'UNAUTHORIZED' && error.status === 401);
});

test('TM-OVW-006 auth-service outage stays no-store and never reads analytics', async () => {
  let reads = 0;
  const key = createRemoteJWKSet(new URL(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`), {
    [customFetch]: async () => new Response('unavailable', { status: 500 }),
  });
  const handler = createOverviewHandler({ authorizeFn: (req, bindings) => authorize(req, bindings, { key, now }),
    readFn: async () => { reads++; return {}; }, clock: () => now });
  const response = await handler({ request: request(await token()), env });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AUTH_UNAVAILABLE');
  assert.ok(response.headers.get('cache-control').includes('no-store'));
  assert.equal(reads, 0);
});
