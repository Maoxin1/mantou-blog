import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { authorize } from '../../functions/_lib/access.mjs';

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
