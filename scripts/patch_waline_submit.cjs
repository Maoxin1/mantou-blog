#!/usr/bin/env node
// Reproduce the site's narrowly scoped local patch after re-vendoring 3.15.2.
// Refuse every unknown upstream input; do not silently patch another release.
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const originalSHA256 = 'e724ca392e46cea5a4b038a023607d15a01e1aae4693982a3684c18b932f47dc';
const replacements = [
  // GET preflight must respect explicit HTTP failure even if JSON claims errno=0.
  ['.then(e=>e.json()).then(e=>p(e,`Get counter`).data)', '.then(e=>{if(!e.ok)throw TypeError(`Get counter failed with HTTP ${e.status}`);return e.json()}).then(e=>p(e,`Get counter`).data)'],
  ['.then(e=>e.json()).then(e=>p(e,`Get comment data`).data)', '.then(e=>{if(!e.ok)throw TypeError(`Get comment data failed with HTTP ${e.status}`);return e.json()}).then(e=>p(e,`Get comment data`).data)'],
  // Lock synchronously, before userAgent() and all validation/async preparation.
  ['R=async()=>{let{serverURL:', 'R=async()=>{if(N.value)return;N.value=!0;try{let{serverURL:'],
  // Preserve the upstream inner block: its i/o locals shadow configuration refs.
  ['h.at=n.replyUser),N.value=!0;try{p&&', 'h.at=n.replyUser);try{p&&'],
  // Release only once the whole operation (including nextTick) has finished.
  ['if(N.value=!1,o.errmsg)', 'if(o.errno||o.errmsg)'],
  // A nonzero error code remains a rejection even without a useful message.
  ['alert(o.errmsg);return', 'alert(o.errmsg||(t.startsWith(`zh`)?`评论服务返回错误（${o.errno}），草稿已保留。`:`The comment service returned an error (${o.errno}). Your draft has been kept.`));return'],
  ['}catch(e){N.value=!1,alert(e.message)}},se=', '}catch(e){alert(e?.message||(typeof e==`string`&&e)||(i.value.lang.startsWith(`zh`)?`评论操作出现错误，草稿已保留。`:`The comment action returned an error. Your draft has been kept.`))}}catch(e){alert(e?.message||(typeof e==`string`&&e)||(i.value.lang.startsWith(`zh`)?`评论操作出现错误，草稿已保留。`:`The comment action returned an error. Your draft has been kept.`))}finally{N.value=!1}},se='],
];

function patch(source) {
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== originalSHA256) throw new Error(`Unexpected Waline source SHA-256: ${hash}`);
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error(`Expected exactly one pinned patch marker: ${before}`);
    source = source.replace(before, after);
  }
  return source;
}

if (require.main === module) {
  const path = resolve(process.argv[2] || 'static/lib/waline/3.15.2/waline.js');
  writeFileSync(path, patch(readFileSync(path, 'utf8')));
}
module.exports = { patch, originalSHA256, replacements };
