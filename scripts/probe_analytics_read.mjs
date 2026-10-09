// Read-only schema instrument: at most 4 requests / 45 seconds; no secrets or counts in output.
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const folder = path.join(root, '.local-evidence/analytics-overview');
const input = await fs.readFile(path.join(root, '.dev.vars'), 'utf8');
const vars = {};
for (const line of input.replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^#\r\n]*))$/);
  if (match) vars[match[1]] = (match[2] ?? match[3] ?? match[4]).trim();
}
if (!vars.ANALYTICS_API_TOKEN) {
  console.log('BLOCKED: analytics read token is not configured. No authenticated request sent.');
  process.exit(2);
}
const typeInfo = 'name kind ofType { name kind ofType { name kind ofType { name kind } } }';
const fields = `name type { ${typeInfo} }`;
const shape = `name fields { ${fields} args { ${fields} } } inputFields { ${fields} }`;
const deadline = AbortSignal.timeout(45000);
let requests = 0, stage = 'type-names';
const named = type => !type ? null : type.name || named(type.ofType);
const record = { tokenValueSaved: false, startedAtUtc: new Date().toISOString() };
async function query(body) {
  if (++requests > 4) throw new Error('REQUEST_BUDGET_EXCEEDED');
  const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${vars.ANALYTICS_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: body }),
    signal: AbortSignal.any([deadline, AbortSignal.timeout(15000)]),
  });
  record.lastHttpStatus = response.status;
  const result = await response.json();
  if (!response.ok || result.errors?.length || !result.data) {
    record.errorCount = result.errors?.length ?? 0;
    record.errorCodes = result.errors?.map(error => error.extensions?.code).filter(Boolean);
    throw new Error('SCHEMA_UNAVAILABLE');
  }
  return result.data;
}
try {
  const names = await query('{ __schema { types { name } } }');
  const accountType = names.__schema.types.map(type => type.name).find(name => /^account$/i.test(name));
  record.accountType = accountType;
  record.rumTypeNames = names.__schema.types.map(type => type.name).filter(name => /rumPageloadEventsAdaptiveGroups/i.test(name));
  if (!accountType) throw new Error('ACCOUNT_TYPE_NOT_FOUND');
  stage = 'account-dataset';
  const account = await query(`{ account: __type(name: ${JSON.stringify(accountType)}) { ${shape} } }`);
  const dataset = account.account.fields.find(field => field.name === 'rumPageloadEventsAdaptiveGroups');
  if (!dataset) throw new Error('RUM_DATASET_NOT_FOUND');
  record.dataset = dataset;
  const rowType = named(dataset.type);
  const filterType = named(dataset.args.find(arg => arg.name === 'filter')?.type);
  record.rowType = rowType; record.filterType = filterType;
  stage = 'dataset-types';
  Object.assign(record, await query(`{ row: __type(name: ${JSON.stringify(rowType)}) { ${shape} } filter: __type(name: ${JSON.stringify(filterType)}) { ${shape} } }`));
  stage = 'nested-types';
  const nestedTypes = record.row.fields.map(field => named(field.type)).filter(type => type && !['Int', 'Float', 'String', 'Boolean', 'Date', 'Time', 'UInt64'].includes(type));
  if (nestedTypes.length) record.nested = await query(`{ ${nestedTypes.map((type, i) => `type${i}: __type(name: ${JSON.stringify(type)}) { ${shape} }`).join(' ')} }`);
  record.state = 'rum-schema-discovered';
} catch (error) {
  record.state = 'schema-spike-incomplete'; record.failedStage = stage;
  record.errorType = error.name;
  if (typeof error.cause?.code === 'string' && /^[A-Z0-9_]+$/.test(error.cause.code)) record.causeCode = error.cause.code;
  if (['SCHEMA_UNAVAILABLE', 'ACCOUNT_TYPE_NOT_FOUND', 'RUM_DATASET_NOT_FOUND', 'REQUEST_BUDGET_EXCEEDED'].includes(error.message)) record.reason = error.message;
}
record.requests = requests; record.finishedAtUtc = new Date().toISOString();
await fs.mkdir(folder, { recursive: true });
const output = path.join(folder, `schema-${Date.now()}.json`);
await fs.writeFile(output, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify({ state: record.state, failedStage: record.failedStage, causeCode: record.causeCode, reason: record.reason,
  requests, httpStatus: record.lastHttpStatus, metadataFile: output,
  filterFields: record.filter?.inputFields?.map(field => field.name).filter(name => ['bot', 'datetime_geq', 'datetime_lt', 'siteTag', 'requestHost', 'requestPath', 'refererHost'].includes(name)), rowFields: record.row?.fields?.map(field => field.name),
  tokenValueSaved: false }));
if (record.state !== 'rum-schema-discovered') process.exitCode = 1;
