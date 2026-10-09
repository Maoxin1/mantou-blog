import { authorize } from './access.mjs';
import { readOverview } from './provider.mjs';
import { completePeriods } from './analytics-domain.mjs';
import { privateJson } from './errors.mjs';

export function createOverviewHandler({ authorizeFn = authorize, readFn = readOverview, clock = Date.now } = {}) {
  let cached, inFlight;
  return async ({ request, env }) => {
    try {
      await authorizeFn(request, env);
      if (request.method !== 'GET') return privateJson({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
      if (new URL(request.url).search) return privateJson({ error: { code: 'INVALID_REQUEST' } }, 400);
      const now = clock();
      const key = `${env.ANALYTICS_ACCOUNT_ID}:${env.ANALYTICS_SITE_TAG}:${env.ANALYTICS_HOST}:${completePeriods(now).current.to}`;
      if (cached?.key === key && now - cached.at >= 0 && now - cached.at < 300000) return privateJson(cached.body);
      if (!inFlight || inFlight.key !== key) {
        const promise = readFn(env, { now }).then(body => {
          cached = { key, at: now, body };
          return body;
        });
        inFlight = { key, promise };
      }
      const active = inFlight;
      try { return privateJson(await active.promise); }
      finally { if (inFlight === active) inFlight = undefined; }
    } catch (error) {
      return privateJson({ error: { code: typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'UPSTREAM_FAILED' } }, error.status || 502);
    }
  };
}
