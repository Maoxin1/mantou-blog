const $ = selector => document.querySelector(selector);
const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const stamp = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium', hour12: false });
const messages = {
  SETUP_REQUIRED: '统计读取或私有访问尚未配置。请稍后重试，或打开 Cloudflare 后台。',
  UNAUTHORIZED: '当前会话没有查看权限，请重新通过私有访问登录。',
  AUTH_UNAVAILABLE: '暂时无法验证访问权限，请稍后重试。',
  UPSTREAM_FAILED: '暂时无法读取 Cloudflare 数据。当前数字未显示，请稍后重试。',
  INVALID_DATA: '收到的数据不完整，当前数字未显示，请稍后重试。',
};
let busy = false;
let trendRows = [];
function empty() {
  trendRows = [];
  for (const id of ['pv', 'visits']) { $(`#${id}`).textContent = '—'; $(`#${id}-change`).textContent = '等待数据'; delete $(`#${id}-change`).dataset.direction; }
  for (const selector of ['#paths', '#sources', '#trend', '#trend-table tbody']) $(selector).replaceChildren();
  $('#freshness').textContent = '数据来源：Cloudflare Web Analytics · 仅本人可读取';
  $('#scope').textContent = '';
}
function safePath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//') || /[\\\u0000-\u001f]/.test(pathname)) return false;
  try { return new URL(pathname, location.origin).origin === location.origin; } catch { return false; }
}
function list(selector, rows, property) {
  const children = rows.map(row => {
    const item = document.createElement('li');
    const label = document.createElement(property === 'path' && safePath(row.path) ? 'a' : 'span');
    label.textContent = row[property] || '未取得来源信息（direct）';
    if (label.tagName === 'A') label.setAttribute('href', row.path);
    const value = document.createElement('strong'); value.textContent = `${number.format(row.pv)} PV`;
    item.append(label, value); return item;
  });
  if (!children.length) { const item = document.createElement('li'); item.textContent = '此区间暂无可显示记录'; children.push(item); }
  $(selector).replaceChildren(...children);
}
function chart(rows) {
  trendRows = rows;
  const ns = 'http://www.w3.org/2000/svg';
  const make = (tag, attrs = {}, text) => { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); if (text !== undefined) node.textContent = text; return node; };
  const width = Math.max(320, Math.min(1040, Math.round($('#trend').getBoundingClientRect().width)));
  const svg = make('svg', { viewBox: `0 0 ${width} 170` });
  const max = Math.max(1, ...rows.map(row => row.pv));
  const points = rows.map((row, i) => [24 + i * ((width - 48) / 6), 118 - row.pv / max * 86]);
  svg.append(make('line', { x1: 24, y1: 118, x2: width - 24, y2: 118, stroke: '#dce5dd' }));
  svg.append(make('polyline', { points: points.map(point => point.join(',')).join(' '), fill: 'none', stroke: '#286445', 'stroke-width': 3 }));
  points.forEach(([x, y], i) => { svg.append(make('circle', { cx: x, cy: y, r: 4, fill: '#286445' }), make('text', { x, y: 152, 'text-anchor': 'middle' }, rows[i].date.slice(5)), make('text', { x, y: Math.max(15, y - 12), 'text-anchor': 'middle' }, number.format(rows[i].pv))); });
  $('#trend').replaceChildren(svg);
  $('#trend-table tbody').replaceChildren(...rows.map(row => { const tr = document.createElement('tr'); for (const value of [row.date, number.format(row.pv), number.format(row.visits)]) { const td = document.createElement('td'); td.textContent = value; tr.append(td); } return tr; }));
}
function render(data) {
  if (data.site !== 'mantou-blog.pages.dev' || !data.metrics?.pv || !data.metrics?.visits || !Array.isArray(data.trend) || data.trend.length !== 7 ||
    !Array.isArray(data.paths) || !Array.isArray(data.sources) || !data.periods?.current || !data.periods?.previous) throw new Error('INVALID_DATA');
  const range = period => `${date.format(new Date(period.from))} 至 ${date.format(new Date(Date.parse(period.to) - 1))}`;
  const periodText = `本期 ${range(data.periods.current)} · 上期 ${range(data.periods.previous)} · 北京时间，不含今天`;
  const currentSampled = Number.isFinite(data.sampling?.current) && data.sampling.current > 1;
  const previousSampled = Number.isFinite(data.sampling?.previous) && data.sampling.previous > 1;
  for (const id of ['pv', 'visits']) {
    const metric = data.metrics[id];
    if (![metric.current, metric.previous, metric.absolute].every(value => typeof value === 'number' && Number.isFinite(value)) || metric.current < 0 || metric.previous < 0) throw new Error('INVALID_DATA');
    const zero = metric.previous === 0;
    if (!zero && (typeof metric.percent !== 'number' || !Number.isFinite(metric.percent))) throw new Error('INVALID_DATA');
    $(`#${id}`).textContent = `${currentSampled ? '约 ' : ''}${number.format(metric.current)}`;
    const prefix = metric.absolute > 0 ? '+' : '';
    $(`#${id}-change`).textContent = zero ? `较上期 ${prefix}${number.format(metric.absolute)} · 上期为 0，暂无可比百分比` :
      `较上期 ${prefix}${number.format(metric.absolute)} · ${metric.percent > 0 ? '增长' : metric.percent < 0 ? '减少' : '持平'} ${Math.abs(metric.percent).toFixed(1)}%`;
    $(`#${id}-change`).dataset.direction = metric.absolute > 0 ? 'up' : metric.absolute < 0 ? 'down' : 'flat';
  }
  if (data.trend.some(row => typeof row.date !== 'string' || !Number.isFinite(row.pv) || row.pv < 0 || !Number.isFinite(row.visits) || row.visits < 0) ||
    [...data.paths, ...data.sources].some(row => !Number.isFinite(row.pv) || row.pv < 0)) throw new Error('INVALID_DATA');
  $('#periods').textContent = periodText;
  list('#paths', data.paths, 'path'); list('#sources', data.sources, 'source'); chart(data.trend);
  $('#freshness').textContent = `数据来源：Cloudflare Web Analytics · 读取于 ${stamp.format(new Date(data.queriedAt))}（北京时间）`;
  const botInfo = data.filters?.botExclusion === 'excluded-classified-bots' && data.filters.bot === 0 ?
    '已排除服务商标记的机器人，分类可能有误差' : '机器人筛选条件未核对，不作排除保证';
  const sampledPeriods = [currentSampled && '本期', previousSampled && '上期'].filter(Boolean);
  const samplingInfo = sampledPeriods.length ? `${sampledPeriods.join('、')}包含采样估算，日数相加可能与总量不同` :
    Number.isFinite(data.sampling?.current) && Number.isFinite(data.sampling?.previous) ? '服务商统计可能因漏报或延迟而变化' : '采样状态未提供';
  $('#scope').textContent = `本站全部路径 · ${botInfo} · 排名最多 15 项 · ${samplingInfo}。`;
}
async function refresh() {
  if (busy) return;
  busy = true; $('#refresh').disabled = true; empty();
  $('#status').textContent = '正在读取数据…'; delete $('#status').dataset.error;
  try {
    const response = await fetch('./data', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.code || 'UPSTREAM_FAILED');
    render(data); $('#status').textContent = data.metrics.pv.current === 0 ? '此区间暂无可显示的浏览记录。' : '数据已显示，以标注的读取时间为准。';
  } catch (error) {
    empty(); $('#status').textContent = messages[error.message] || messages.UPSTREAM_FAILED; $('#status').dataset.error = 'true';
  } finally { busy = false; $('#refresh').disabled = false; }
}
$('#refresh').addEventListener('click', refresh);
window.addEventListener('resize', () => { if (trendRows.length) chart(trendRows); });
refresh();
