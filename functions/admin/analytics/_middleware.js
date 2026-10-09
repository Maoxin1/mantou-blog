import { authorize } from '../../_lib/access.mjs';
import { privateJson } from '../../_lib/errors.mjs';
import { protectResponse } from '../../_lib/access-response.mjs';

export async function onRequest(context) {
  try {
    await authorize(context.request, context.env);
    return protectResponse(await context.next());
  } catch (error) {
    return privateJson({ error: { code: error.code || 'UNAUTHORIZED' } }, error.status || 401);
  }
}
