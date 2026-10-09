import { simulateCompound } from './dca-compound.mjs';
import { parseQuote, marketJSON, QUOTE_MAX_AGE } from './dca-market.mjs';
import { DAY, parsePriceHistory, priceHistoryJSON, isCurrentPriceHistory } from './btc-prices.mjs';
import { referencePeriods } from './dca-history.mjs';
import { cumulativeReturn, annualizedReturn, xirr } from './dca-returns.mjs';
(()=>{
const root=document.getElementById('mantou-dca-c');
const q=id=>root.querySelector('#'+id);
const data=JSON.parse(q('c-verified-data').textContent);
const prices=JSON.parse(q('c-price-data').textContent);
const number=v=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const priceNumber=v=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:v<1?6:2}).format(v);
const money=v=>'$'+number(v);
const percent=v=>{if(typeof v!=='number'||!Number.isFinite(v))return '—';if(Math.abs(v)>Number.MAX_VALUE/100){const [mantissa,exponent]=v.toExponential(2).split('e');return `${mantissa}E${Number(exponent)+2}%`;}const p=Math.abs(v)<.00005?0:v*100;return new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,notation:Math.abs(p)>=1e12?'scientific':'standard'}).format(p)+'%';};
const budget=(amount,weekly,action)=>Number.isFinite(amount)&&amount>=0?`年预算${weekly?'约 ': ' '}${number(amount*(weekly?52:12))} USD · 按 ${weekly?52:12} 次${action}`:'年预算 —';
const ns='http://www.w3.org/2000/svg';
const marketSelection={label:null};
const historySelections={weekly:{label:null},monthly:{label:null}};
let inspectedRows=[];
const priceDialog=q('c-price-dialog'),priceScreen=q('c-price-screen'),priceViewport=q('c-price-viewport');
let nativePriceFullscreen=false,scrollLock,priceSession=0;
let marketLength=0, frequency='weekly', compoundFrequency='weekly', priceState='checking';
const ranges={};
let reference={monthly:referencePeriods(prices.daily,'monthly'),weekly:referencePeriods(prices.daily,'weekly')};
const periods=()=>reference[frequency];
const date=t=>new Date(t).toISOString().slice(0,10);
const remember=()=>{ranges[frequency]={start:q('c-start').value,end:q('c-end').value};};
let quoteState='snapshot', busy=false, pollTimer, historyQueued=true, lastHistoryAttemptDay, historyAttempts=0, historyRetryAt=0;
const firstPeriod=()=>date(periods()[0].time);
const lastPeriod=()=>date(periods().at(-1).end);
const colors=()=>{const s=getComputedStyle(root);return {ink:s.getPropertyValue('--ink').trim(),muted:s.getPropertyValue('--muted').trim(),line:s.getPropertyValue('--line').trim(),orange:s.getPropertyValue('--orange').trim()};};
function chart(svg,a,b,labels,unit='USD',names=['累计投入','资产价值'],times=null,logarithmic=false,selection=null,onSelect=null){
 const measured=svg.clientWidth;if(!measured)return;
 const expanded=svg.id==='c-market-chart'&&priceDialog.open;
 const width=Math.max(200,measured),height=Math.max(expanded?120:200,svg.clientHeight),L=51,R=12,T=26,B=35,c=colors();
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
 const values=a?[...a,...b]:b;const max=Math.max(1,...values)*1.08;
 const logMin=logarithmic?Math.log10(Math.min(...values)):0,logMax=logarithmic?Math.log10(Math.max(...values)):0;
 const padding=Math.min(Math.log10(1.15),Math.max(.001,(logMax-logMin)*.08));
 const low=logarithmic?logMin-padding:0,high=logarithmic?logMax+padding:max;
 const x=i=>L+(width-L-R)*(times?(times[i]-times[0])/Math.max(1,times.at(-1)-times[0]):i/Math.max(1,b.length-1)),y=v=>height-B-(height-T-B)*(logarithmic?(Math.log10(v)-low)/Math.max(.001,high-low):v/max);
 const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!=null)e.textContent=text;svg.appendChild(e);return e;};
 const fmt=v=>logarithmic&&high-low<.1?new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(v):v>=1e6?(v/1e6).toFixed(1)+'m':v>=1e3?(v/1e3).toFixed(v<1e4?1:0)+'k':v<1?String(v):Math.round(v);
 const levels=[];if(logarithmic){
  const first=Math.ceil(low),last=Math.floor(high),step=Math.max(1,Math.ceil((last-first)/3));for(let exponent=first;exponent<=last;exponent+=step)levels.push(10**exponent);
  if(!levels.length){const lower=10**low,upper=10**high,raw=(upper-lower)/3,scale=10**Math.floor(Math.log10(raw)),interval=[1,2,5,10].find(n=>n*scale>=raw)*scale;for(let value=Math.ceil(lower/interval)*interval;value<=upper;value+=interval)levels.push(value);}
 }else for(let i=0;i<=3;i++)levels.push(max*i/3);
 for(const value of levels){const cy=y(value);add('line',{x1:L,y1:cy,x2:width-R,y2:cy,stroke:c.line,'stroke-width':.7});add('text',{x:L-7,y:cy+4,'text-anchor':'end',fill:c.muted,'font-size':11,'data-value-tick':value},fmt(value));}
 add('text',{x:L,y:13,fill:c.muted,'font-size':11},unit);
 const line=arr=>arr.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
 if(!logarithmic)add('path',{d:line(b)+` L${x(b.length-1)},${height-B} L${L},${height-B}Z`,fill:c.orange,'fill-opacity':.065});
 if(a)add('path',{d:line(a),fill:'none',stroke:c.ink,'stroke-width':1.7});
 add('path',{d:line(b),fill:'none',stroke:c.orange,'stroke-width':logarithmic?1.5:2.1});
 if(logarithmic&&times&&times.at(-1)-times[0]>2*366*86400000){
  const first=new Date(times[0]).getUTCFullYear(),last=new Date(times.at(-1)).getUTCFullYear();
  const capacity=Math.max(2,Math.floor((width-L-R)/60)),step=[1,2,4,5,10,20].find(s=>s>=(last-first)/capacity)||20;
  const ticks=[{px:L,label:first}];
  for(let year=first+step;year<last;year+=step){const px=L+(width-L-R)*(Date.UTC(year,0,1)-times[0])/(times.at(-1)-times[0]);if(px-ticks.at(-1).px>=52)ticks.push({px,label:year});}
  if(width-R-ticks.at(-1).px<52)ticks.pop();ticks.push({px:width-R,label:last});
  ticks.forEach((tick,j)=>add('text',{x:tick.px,y:height-10,'text-anchor':j===0?'start':j===ticks.length-1?'end':'middle',fill:c.muted,'font-size':12,'data-year-tick':tick.label},tick.label));
 }else{
  const ticks=[...new Set(width<420?[0,b.length-1]:[0,Math.floor((b.length-1)/2),b.length-1])];
  ticks.forEach((i,j)=>add('text',{x:x(i),y:height-10,'text-anchor':j===0?'start':j===ticks.length-1?'end':'middle',fill:c.muted,'font-size':11},labels[i]));
 }
 let detail=svg.nextElementSibling;
 if(!detail?.classList.contains('chart-detail')){detail=document.createElement('div');detail.className='chart-detail';detail.setAttribute('aria-live','polite');svg.insertAdjacentElement('afterend',detail);}
 detail.hidden=true;detail.textContent='';
 const guide=add('line',{x1:L,y1:T,x2:L,y2:height-B,stroke:c.orange,'stroke-width':1,visibility:'hidden'});
 const dot=add('circle',{cx:L,cy:y(b[0]),r:3,fill:c.orange,visibility:'hidden'});
 const hit=add('rect',{x:L,y:T,width:width-L-R,height:height-T-B,fill:'transparent','aria-hidden':'true'});
 let selected=b.length-1;const show=i=>{selected=i;if(selection)selection.label=labels[i];detail.hidden=false;guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.setAttribute('visibility','visible');dot.setAttribute('cx',x(i));dot.setAttribute('cy',y(b[i]));dot.setAttribute('visibility','visible');detail.textContent=labels[i]+' · '+(a?names[0]+' '+number(a[i])+' / ':'')+names[1]+' '+(logarithmic?priceNumber(b[i]):number(b[i]))+' '+unit;if(onSelect)onSelect(labels[i]);};
 const inspect=e=>{const matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const px=point.matrixTransform(matrix.inverse()).x;let i=0;if(px>=width-R-6)i=b.length-1;else if(px>L+6)for(let j=1;j<b.length;j++)if(Math.abs(x(j)-px)<Math.abs(x(i)-px))i=j;show(i);};
 svg.onpointerdown=inspect;svg.onpointermove=inspect;svg.onclick=inspect;svg.setAttribute('tabindex','0');svg.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?b.length-1:Math.max(0,Math.min(b.length-1,selected+(e.key==='ArrowRight'?1:-1))));}};svg.onfocus=()=>show(selected);
 const remembered=selection?labels.indexOf(selection.label):-1;if(remembered>=0)show(remembered);
}
function clearChart(svg){svg.replaceChildren();svg.onfocus=null;svg.onkeydown=null;svg.onpointerdown=null;svg.onpointermove=null;svg.onclick=null;svg.removeAttribute('tabindex');const detail=svg.nextElementSibling;if(detail?.classList.contains('chart-detail')){detail.textContent='';detail.hidden=true;}}
function pointControls(label=null){
 const index=inspectedRows.findIndex(row=>date(row.end)===label);
 q('c-point-date').value=index<0?'':label;
 q('c-point-prev').disabled=index<=0;q('c-point-next').disabled=index<0||index===inspectedRows.length-1;
 q('c-point-error').textContent='';
}
function clearHistory(message){q('c-h-error').textContent=message;['c-h-invest','c-h-value','c-h-profit','c-h-return','c-h-annual'].forEach(id=>q(id).textContent='—');q('c-h-annual-hint').hidden=true;q('c-h-annual-label').textContent='年化回报率 · XIRR';clearChart(q('c-history-chart')); q('c-h-note').textContent='';q('c-h-detail').textContent='';q('c-h-period').textContent='';q('c-trades').replaceChildren();inspectedRows=[];q('c-point-date').disabled=true;pointControls();}
function history(){
 const amount=Number(q('c-monthly').value),fee=Number(q('c-fee').value)/100,start=q('c-start').value,end=q('c-end').value;
 q('c-h-budget').textContent=budget(q('c-monthly').value&&amount>=1&&amount<=100000?amount:NaN,frequency==='weekly','买入');
 remember();
 const presets={all:start===firstPeriod()&&end===lastPeriod()};
 root.querySelectorAll('[data-period]').forEach(el=>el.setAttribute('aria-pressed',String(presets[el.dataset.period])));
 q('c-range-custom').hidden=presets.all;
 const validPeriod=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&date(Date.parse(value+'T00:00:00Z'))===value;
 if(!q('c-monthly').value||!q('c-fee').value||!Number.isFinite(amount)||amount<1||amount>100000||!Number.isFinite(fee)||fee<0||fee>.05){clearHistory('请输入有效金额（1—100,000 USD）和费率（0—5%）。');return;}
 if(!validPeriod(start)||!validPeriod(end)||start<prices.daily[0][0]||end>prices.daily.at(-1)[0]){clearHistory('请选择可用历史范围内的起止日期。');return;}
 if(start>end){clearHistory('开始周期不能晚于结束周期。');return;}
 const from=Date.parse(start+'T00:00:00Z'),through=Date.parse(end+'T00:00:00Z')+DAY;
 const rows=periods().filter(d=>d.time>=from&&d.end<through);
 if(!rows.length){clearHistory('所选区间没有完整的'+(frequency==='weekly'?'周':'月')+'周期，请扩大日期范围。');return;}
 q('c-h-error').textContent='';let qty=0,under=0;const a=[],b=[],labels=[];q('c-trades').replaceChildren();
 rows.forEach((row,i)=>{const added=amount*(1-fee)/row.buyPrice;qty+=added;const invested=amount*(i+1),value=qty*row.valuePrice;a.push(invested);b.push(value);labels.push(date(row.end));if(value<invested)under++;
 const tr=document.createElement('tr');[date(row.time),priceNumber(row.buyPrice),added.toFixed(8),number(invested),number(value)].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.appendChild(td);});q('c-trades').appendChild(tr);});
 q('c-h-invest').textContent=number(a.at(-1));q('c-h-value').textContent=number(b.at(-1));q('c-h-profit').textContent=number(b.at(-1)-a.at(-1));
 q('c-h-return').textContent=percent(cumulativeReturn(b.at(-1),a.at(-1)));
 q('c-h-annual').textContent=percent(xirr([...rows.map(row=>({amount:-amount,time:row.time})),{amount:b.at(-1),time:rows.at(-1).valuationTime}]));
 const shortHistory=rows.at(-1).valuationTime-rows[0].time<365*DAY;
 q('c-h-annual-label').textContent=shortHistory?'折算年化回报率':'年化回报率 · XIRR';q('c-h-annual-hint').hidden=!shortHistory;
 const endName=frequency==='weekly'?'周末':'月末';
 q('c-h-period').textContent=`有效回测 ${date(rows[0].time)} — ${date(rows.at(-1).end)} UTC · ${rows.length} 次投入`;
 q('c-h-note').textContent=`曾有 ${under} 个${endName}的持仓价值低于本金。`;
 q('c-h-detail').textContent=`累计买入 ${qty.toFixed(8)} BTC · 买入费用 ${number(amount*fee*rows.length)} USD · 盈亏未扣卖出费用`;
 inspectedRows=rows;const selection=historySelections[frequency];if(!labels.includes(selection.label))selection.label=null;
 q('c-point-date').disabled=false;q('c-point-date').min=date(rows[0].time);q('c-point-date').max=date(rows.at(-1).end);
 pointControls(selection.label);
 chart(q('c-history-chart'),a,b,labels,'USD',['投入','持仓'],null,false,selection,pointControls);
}
function future(){
 const initial=Number(q('c-principal').value),add=Number(q('c-add').value),years=Number(q('c-years').value),annual=Number(q('c-rate').value);
 q('c-years-label').textContent=years+' 年';q('c-rate-label').textContent=annual+'%';root.querySelectorAll('[data-rate]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.rate===annual)));
 root.querySelectorAll('[data-compound-frequency]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.compoundFrequency===compoundFrequency)));
 q('c-f-schedule').textContent=budget(q('c-add').value&&add>=0&&add<=100000?add:NaN,compoundFrequency==='weekly','追加');
 let result;
 try{if(!q('c-principal').value||!q('c-add').value)throw new Error('Missing amount');result=simulateCompound({initial,contribution:add,years,annualRate:annual,frequency:compoundFrequency});}
 catch{q('c-f-error').textContent='本金范围 0—10,000,000 USD；每次投入范围 0—100,000 USD。';['c-f-invest','c-f-value','c-f-profit','c-f-return','c-f-annual'].forEach(id=>q(id).textContent='—');clearChart(q('c-future-chart')); q('c-f-composition').textContent='';q('c-f-period').textContent='';q('c-capital-bar').style.width='0%';q('c-return-bar').style.width='0%';return;}
 q('c-f-error').textContent='';
 const {invested:principal,value,gain,contributions:a,balances:b,periodsPerYear:p}=result;
 const labels=b.map((_,i)=>i===0?'现在':i%p===0?(i/p)+' 年':`${Math.floor(i/p)} 年 ${i%p} ${p===52?'周':'个月'}`);
 q('c-f-period').textContent=`${compoundFrequency==='weekly'?'每周':'每月'} ${number(add)} USD · ${years} 年 · 假设年收益 ${annual}%`;
 q('c-f-invest').textContent=number(principal);q('c-f-value').textContent=number(value);q('c-f-profit').textContent=number(gain);
 q('c-f-return').textContent=percent(cumulativeReturn(value,principal));
 q('c-f-annual').textContent=percent(annualizedReturn([{amount:-initial,years:0},...b.slice(1).map((_,i)=>({amount:-add,years:(i+1)/p})),{amount:value,years}]));
 if(principal===0){q('c-f-composition').textContent='尚未投入本金，模拟资产价值为 $0.00。';q('c-capital-bar').style.width='0%';q('c-return-bar').style.width='0%';}
 else if(gain>=0){q('c-f-composition').textContent=`期末每 100 美元中，${(principal/value*100).toFixed(1)} 美元来自投入，${(gain/value*100).toFixed(1)} 美元来自模拟收益。`;q('c-capital-bar').style.width=(principal/value*100)+'%';q('c-return-bar').style.width=(gain/value*100)+'%';}
 else{q('c-f-composition').textContent=`累计投入 ${money(principal)}，模拟损失 ${money(-gain)}，期末剩余 ${money(value)}。`;q('c-capital-bar').style.width=(value/principal*100)+'%';q('c-return-bar').style.width=(-gain/principal*100)+'%';}
 q('c-return-bar').style.background=gain<0?'var(--line)':'var(--orange)';chart(q('c-future-chart'),a,b,labels,'USD',['投入','模拟价值']);
}
function market(){
 const quote=data.quote;
 q('c-quote').textContent=number(Number(quote.lastPrice))+' USDT';q('c-quote-change').textContent='24h 变动 '+Number(quote.priceChangePercent).toFixed(2)+'%';
 q('c-quote-time').textContent='报价时间：'+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(quote.closeTime))+' 北京时间';
 const all=prices.daily.map(([date,price])=>({date,time:Date.parse(date+'T00:00:00Z'),price}));
 const cutoff=new Date(all.at(-1).time);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-marketLength);
 const rows=marketLength?all.filter(r=>r.time>=cutoff.getTime()):all;
 chart(q('c-market-chart'),null,rows.map(r=>r.price),rows.map(r=>r.date),'USD/BTC',['','价格'],rows.map(r=>r.time),true,marketSelection);
 root.querySelectorAll('[data-market]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.market===marketLength)));
 q('c-market-range').textContent=`${marketLength?'近 '+marketLength+' 年':'最大范围'}：${rows[0].date} — ${rows.at(-1).date}`;
 priceStatus();
 updateQuoteStatus();
}
function historyState(){return priceState==='fresh'&&!isCurrentPriceHistory(prices.daily)?'stale':priceState;}
function updateReason(){return ({checking:'正在核对历史参考价格',pending:'参考价格尚未到最新日期',timeout:'历史连接超时',invalid:'历史数据完整性异常',failed:'历史更新未成功',offline:'当前离线',stale:'参考价格待更新'})[historyState()];}
function priceStatus(){const state=historyState();q('c-price-status').hidden=state==='fresh';q('c-price-status').textContent=state==='checking'?`正在核对价格历史… · 当前截至 ${prices.daily.at(-1)[0]}`:`${state==='failed'?'价格历史更新未成功':updateReason()}，显示截至 ${prices.daily.at(-1)[0]} 的数据。可刷新重试。`;}
function historyStatus(){
 const name=frequency==='weekly'?'周定投':'月定投',end=date(periods().at(-1).end);
 const state=historyState();q('c-history-status').hidden=state==='fresh';
 q('c-history-status').textContent=state==='fresh'?`已核对最新完整${name}，截至 ${end} UTC 日末。`:`${updateReason()}，使用截至 ${end} UTC 日末的完整周期。可展开“比特币价格”重试。`;
 q('c-history-range').textContent=`Coin Metrics · BTC/USD · ${name} · ${firstPeriod()} — ${lastPeriod()}，共 ${periods().length} 个完整周期。`;
 const method={fresh:'已核对最新完整日历史。',checking:'正在核对更新，保留现有数据。',pending:'来源日期待更新；现有连续日历史已核对。',stale:'参考日期待更新，保留现有数据。',snapshot:`初始价格快照读取于 ${prices.readAt.slice(0,10)}。`};
 q('c-history-method-range').textContent=`价格图与定投共用截至 ${prices.daily.at(-1)[0]} 的日参考价格。${method[state]||`${updateReason()}，保留现有数据。`}`;
}
function populate(){
 const first=periods()[0],last=periods().at(-1),saved=ranges[frequency]||{start:date(first.time),end:date(last.end)};
 ['c-start','c-end'].forEach(id=>{q(id).type='date';q(id).min=prices.daily[0][0];q(id).max=prices.daily.at(-1)[0];});
 q('c-start').value=saved.start;q('c-end').value=saved.end;
 q('c-start-label').textContent='开始日期';q('c-end-label').textContent='结束日期';
 q('c-date-hint').hidden=false;q('c-date-hint').textContent='仅计所选区间内完整的'+(frequency==='weekly'?'周':'月')+'周期。';
 q('c-schedule').textContent=frequency==='weekly'?'每周一 08:00 买入（北京时间）':'每月 1 日 08:00 买入（北京时间）';
 root.querySelectorAll('[data-frequency]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.frequency===frequency)));
 historyStatus();
}

function updateQuoteStatus(){const el=q('c-quote-status');const age=Date.now()-Number(data.quote.closeTime);let state=quoteState;if(!navigator.onLine)state='offline';else if(state==='live'&&age>QUOTE_MAX_AGE)state='stale';el.dataset.state=state;el.textContent=({live:'行情已更新 · 每 60 秒刷新',snapshot:'随站点发布的快照 · 待更新',failed:'更新失败 · 显示旧报价',stale:'报价已过期 · 等待更新',offline:'离线 · 显示旧报价'})[state];}
async function request(path){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{return await marketJSON(path,{signal:controller.signal});}finally{clearTimeout(timer);}}
async function requestPrices(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);try{return await priceHistoryJSON({signal:controller.signal});}finally{clearTimeout(timer);}}
async function refresh(includeHistory=false){
 const today=Math.floor(Date.now()/DAY)*DAY;
 if(includeHistory||lastHistoryAttemptDay!==today||(historyRetryAt&&Date.now()>=historyRetryAt))historyQueued=true;
 if(document.hidden)return;
 if(!navigator.onLine){quoteState='offline';updateQuoteStatus();priceState='offline';priceStatus();historyStatus();return;}
 if(busy)return;
 includeHistory=historyQueued;historyQueued=false;
 if(includeHistory){if(lastHistoryAttemptDay!==today)historyAttempts=0;lastHistoryAttemptDay=today;historyAttempts++;historyRetryAt=0;priceState='checking';priceStatus();historyStatus();}
 busy=true;q('c-refresh').disabled=true;q('c-refresh').textContent='更新中…';
 const quoteTask=(async()=>{try{const raw=await request('ticker/24hr?symbol=BTCUSDT');const parsed=parseQuote(raw);if(parsed.time<Number(data.quote.closeTime))throw new Error('Older quote');data.quote=raw;quoteState=parsed.fresh?'live':'stale';}catch{quoteState='failed';}market();})();
 const priceTask=includeHistory?(async()=>{try{
  const updated=parsePriceHistory(await requestPrices(),Date.now(),{allowPublicationLag:true});if(updated.length<prices.daily.length)throw Object.assign(new Error('Short price history'),{code:'invalid'});
  const nextReference={monthly:referencePeriods(updated,'monthly'),weekly:referencePeriods(updated,'weekly')};
  remember();
  for(const key of ['monthly','weekly'])if(ranges[key]?.end===date(reference[key].at(-1).end))ranges[key].end=date(nextReference[key].at(-1).end);
  prices.daily=updated;reference=nextReference;priceState=isCurrentPriceHistory(updated)?'fresh':'pending';populate();history();market();
 }catch(error){priceState=!navigator.onLine?'offline':error.name==='AbortError'?'timeout':error.code||'failed';priceStatus();historyStatus();}
 finally{if(!['fresh','invalid'].includes(priceState)&&historyAttempts<2)historyRetryAt=Date.now()+600000;}})():Promise.resolve();
 try{await Promise.all([quoteTask,priceTask]);}finally{busy=false;q('c-refresh').disabled=false;q('c-refresh').textContent='刷新行情';if(historyQueued&&!document.hidden&&navigator.onLine)refresh();}
}
populate();
root.querySelectorAll('[data-frequency]').forEach(el=>el.addEventListener('click',()=>{remember();frequency=el.dataset.frequency;populate();history();}));
const tabs=[...root.querySelectorAll('[data-panel]')];
function showPanel(name){tabs.forEach(tab=>{const selected=tab.dataset.panel===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;q('c-panel-'+tab.dataset.panel).hidden=!selected;});history();future();market();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>showPanel(tab.dataset.panel));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;showPanel(tabs[next].dataset.panel);tabs[next].focus();}});});
root.querySelector('.dca-tabs').hidden=false;showPanel('future');
root.querySelectorAll('[data-compound-frequency]').forEach(el=>el.addEventListener('click',()=>{compoundFrequency=el.dataset.compoundFrequency;future();}));
['c-monthly','c-fee'].forEach(id=>q(id).addEventListener('input',history));
['c-start','c-end'].forEach(id=>q(id).addEventListener('input',history));
q('c-point-date').addEventListener('input',()=>{const value=q('c-point-date').value,time=Date.parse(value+'T00:00:00Z'),row=inspectedRows.find(row=>time>=row.time&&time<=row.end);historySelections[frequency].label=row?date(row.end):null;history();if(value&&!row){q('c-point-date').value=value;q('c-point-error').textContent='请选择当前回测区间内的日期。';}});
['prev','next'].forEach(direction=>q('c-point-'+direction).addEventListener('click',()=>{const index=inspectedRows.findIndex(row=>date(row.end)===historySelections[frequency].label),next=index+(direction==='prev'?-1:1);if(index>=0&&next>=0&&next<inspectedRows.length){historySelections[frequency].label=date(inspectedRows[next].end);history();}}));
['c-principal','c-add','c-years','c-rate'].forEach(id=>q(id).addEventListener('input',future));
root.querySelectorAll('[data-rate]').forEach(el=>el.addEventListener('click',()=>{q('c-rate').value=el.dataset.rate;future();}));
root.querySelectorAll('[data-period]').forEach(el=>el.addEventListener('click',()=>{const rows=periods();q('c-start').value=date(rows[0].time);q('c-end').value=date(rows.at(-1).end);history();}));
root.querySelectorAll('[data-market]').forEach(el=>el.addEventListener('click',()=>{marketLength=+el.dataset.market;market();}));
q('c-market-context').addEventListener('toggle',()=>{if(q('c-market-context').open)market();});
if(typeof priceDialog.showModal==='function'){
 const layoutPriceScreen=()=>{
  if(!priceDialog.open)return;
  const width=priceViewport.clientWidth,height=priceViewport.clientHeight,rotated=height>width;
  priceScreen.classList.toggle('is-rotated',rotated);
  priceScreen.style.width=(rotated?height:width)+'px';priceScreen.style.height=(rotated?width:height)+'px';market();
 };
 q('c-expand').hidden=false;
 q('c-expand').addEventListener('click',()=>{
  priceSession++;
  scrollLock={overflow:document.documentElement.style.overflow,x:scrollX,y:scrollY};document.documentElement.style.overflow='hidden';
  q('c-market-home').style.minHeight=q('c-market-home').getBoundingClientRect().height+'px';
  q('c-price-body').appendChild(q('c-market-view'));q('c-price-controls').appendChild(q('c-market-ranges'));
  priceDialog.showModal();layoutPriceScreen();
  if(document.fullscreenEnabled&&priceViewport.requestFullscreen)priceViewport.requestFullscreen().catch(()=>{});
 });
 q('c-collapse').addEventListener('click',()=>priceDialog.close());
 priceDialog.addEventListener('close',()=>{
  q('c-market-controls').appendChild(q('c-market-ranges'));
  q('c-market-home').appendChild(q('c-market-view'));
  q('c-market-home').style.minHeight='';
  document.documentElement.style.overflow=scrollLock?.overflow||'';
  priceScreen.classList.remove('is-rotated');priceScreen.style.width='';priceScreen.style.height='';
  const closedSession=priceSession,restore=()=>{if(priceDialog.open||closedSession!==priceSession)return;if(scrollLock)window.scrollTo({left:scrollLock.x,top:scrollLock.y,behavior:'instant'});q('c-expand').focus({preventScroll:true});};
  if(document.fullscreenElement===priceViewport)document.exitFullscreen().catch(()=>{}).then(restore);
  nativePriceFullscreen=false;market();restore();
 });
 document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement===priceViewport){if(!priceDialog.open){document.exitFullscreen().catch(()=>{});return;}nativePriceFullscreen=true;layoutPriceScreen();}
  else if(nativePriceFullscreen&&priceDialog.open)priceDialog.close();
 });
 let priceWidth=0,priceHeight=0;
 new ResizeObserver(layoutPriceScreen).observe(priceViewport);
 new ResizeObserver(()=>{const svg=q('c-market-chart'),width=svg.clientWidth,height=svg.clientHeight;if(width&&(Math.abs(priceWidth-width)>1||Math.abs(priceHeight-height)>1)){priceWidth=width;priceHeight=height;market();}}).observe(q('c-market-chart'));
}
root.querySelectorAll('fieldset').forEach(el=>el.disabled=false);
history();future();market();let previousWidth=0;new ResizeObserver(()=>{const width=root.getBoundingClientRect().width;if(Math.abs(previousWidth-width)>1){previousWidth=width;history();future();market();}}).observe(root);
new MutationObserver(()=>{history();future();market();}).observe(document.body,{attributes:true,attributeFilter:['theme']});
q('c-refresh').addEventListener('click',()=>refresh(true));
function schedule(){clearInterval(pollTimer);if(!document.hidden){updateQuoteStatus();priceStatus();historyStatus();refresh();pollTimer=setInterval(()=>{updateQuoteStatus();priceStatus();historyStatus();refresh();},60000);}}
document.addEventListener('visibilitychange',schedule);window.addEventListener('online',()=>{refresh(true);schedule();});window.addEventListener('offline',()=>{quoteState='offline';updateQuoteStatus();});window.addEventListener('pagehide',()=>clearInterval(pollTimer));window.addEventListener('pageshow',schedule);
refresh(true);schedule();
})();
