import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OverviewError } from './errors.mjs';

const resolvers = new Map();

export async function authorize(request, env, options = {}) {
  const domain = env.ACCESS_TEAM_DOMAIN || '';
  const audience = env.ACCESS_AUD || '';
  const owner = env.ACCESS_OWNER_EMAIL?.trim().toLowerCase();
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !/^[a-zA-Z0-9_-]{16,128}$/.test(audience) ||
    !owner || !/^[^\s@]+@[^\s@]+$/.test(owner)) throw new OverviewError('SETUP_REQUIRED', 503);
  const cookies = (request.headers.get('cookie') || '').split(';').map(item => item.trim())
    .filter(item => item.startsWith('CF_Authorization='));
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion') || (cookies.length === 1 ? cookies[0].slice(17) : '');
  if (!assertion || assertion.length > 8192) throw new OverviewError('UNAUTHORIZED', 401);
  if (!resolvers.has(domain)) resolvers.set(domain, createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`), {
    timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000,
  }));
  try {
    const { payload } = await jwtVerify(assertion, options.key || resolvers.get(domain), {
      issuer: `https://${domain}`, audience, algorithms: ['RS256'],
      requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub', 'email'],
      currentDate: options.now === undefined ? undefined : new Date(options.now),
    });
    if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== owner) throw new OverviewError('UNAUTHORIZED', 401);
    return { email: payload.email.toLowerCase() };
  } catch (error) {
    if (error.code === 'ERR_JWKS_TIMEOUT') throw new OverviewError('AUTH_UNAVAILABLE', 503);
    throw new OverviewError('UNAUTHORIZED', 401);
  }
}
