import { parseQuote, parseHistory, marketJSON, QUOTE_MAX_AGE } from './dca-market.mjs';
(()=>{
const root=document.getElementById('mantou-dca-c');
const q=id=>root.querySelector('#'+id);
const data=JSON.parse(q('c-verified-data').textContent);
const number=v=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const money=v=>'$'+number(v);
const ns='http://www.w3.org/2000/svg';
let marketLength=0, frequency='weekly', historyState='checking';
const ranges={};
const periods=()=>data[frequency].filter(r=>!r.partial);
const date=t=>new Date(t).toISOString().slice(0,10);
const remember=()=>{ranges[frequency]={start:q('c-start').value,end:q('c-end').value};};
let quoteState='snapshot', busy=false, pollTimer;
const firstPeriod=()=>periods()[0].period;
const lastPeriod=()=>periods().at(-1).period;
const colors=()=>{const s=getComputedStyle(root);return {ink:s.getPropertyValue('--ink').trim(),muted:s.getPropertyValue('--muted').trim(),line:s.getPropertyValue('--line').trim(),orange:s.getPropertyValue('--orange').trim()};};
function chart(svg,a,b,labels,unit='USD',names=['累计投入','资产价值'],times=null){
 const measured=svg.getBoundingClientRect().width;if(!measured)return;
 const width=Math.max(200,measured),height=width<450?230:250,L=51,R=12,T=26,B=35,c=colors();
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
 const values=a?[...a,...b]:b;const max=Math.max(1,...values)*1.08;
 const x=i=>L+(width-L-R)*(times?(times[i]-times[0])/Math.max(1,times.at(-1)-times[0]):i/Math.max(1,b.length-1)),y=v=>height-B-(height-T-B)*v/max;
 const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!=null)e.textContent=text;svg.appendChild(e);return e;};
 const fmt=v=>v>=1e6?(v/1e6).toFixed(1)+'m':v>=1e3?(v/1e3).toFixed(v<1e4?1:0)+'k':Math.round(v);
 for(let i=0;i<=3;i++){const value=max*i/3,cy=y(value);add('line',{x1:L,y1:cy,x2:width-R,y2:cy,stroke:c.line,'stroke-width':.7});add('text',{x:L-7,y:cy+4,'text-anchor':'end',fill:c.muted,'font-size':11},fmt(value));}
 add('text',{x:L,y:13,fill:c.muted,'font-size':11},unit);
 const line=arr=>arr.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
 add('path',{d:line(b)+` L${x(b.length-1)},${height-B} L${L},${height-B}Z`,fill:c.orange,'fill-opacity':.065});
 if(a)add('path',{d:line(a),fill:'none',stroke:c.ink,'stroke-width':1.7});
 add('path',{d:line(b),fill:'none',stroke:c.orange,'stroke-width':2.1});
 const ticks=[...new Set(width<420?[0,b.length-1]:[0,Math.floor((b.length-1)/2),b.length-1])];
 ticks.forEach((i,j)=>add('text',{x:x(i),y:height-10,'text-anchor':j===0?'start':j===ticks.length-1?'end':'middle',fill:c.muted,'font-size':11},labels[i]));
 let detail=svg.nextElementSibling;
 if(!detail?.classList.contains('chart-detail')){detail=document.createElement('div');detail.className='chart-detail';detail.setAttribute('aria-live','polite');svg.insertAdjacentElement('afterend',detail);}
 const guide=add('line',{x1:L,y1:T,x2:L,y2:height-B,stroke:c.orange,'stroke-width':1,visibility:'hidden'});
 const dot=add('circle',{cx:L,cy:y(b[0]),r:3,fill:c.orange,visibility:'hidden'});
 const hit=add('rect',{x:L,y:T,width:width-L-R,height:height-T-B,fill:'transparent','aria-hidden':'true'});
 let selected=b.length-1;const show=i=>{selected=i;guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.setAttribute('visibility','visible');dot.setAttribute('cx',x(i));dot.setAttribute('cy',y(b[i]));dot.setAttribute('visibility','visible');detail.textContent=labels[i]+' · '+(a?names[0]+' '+number(a[i])+' / ':'')+names[1]+' '+number(b[i])+' '+unit;};
 const inspect=e=>{const box=svg.getBoundingClientRect();const px=(e.clientX-box.left)*width/box.width;let i=0;for(let j=1;j<b.length;j++)if(Math.abs(x(j)-px)<Math.abs(x(i)-px))i=j;show(i);};
 hit.addEventListener('pointermove',inspect);hit.addEventListener('click',inspect);svg.setAttribute('tabindex','0');svg.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();show(e.key==='Home'?0:e.key==='End'?b.length-1:Math.max(0,Math.min(b.length-1,selected+(e.key==='ArrowRight'?1:-1))));}};show(b.length-1);
}
function clearHistory(message){q('c-h-error').textContent=message;['c-h-invest','c-h-value','c-h-profit'].forEach(id=>q(id).textContent='—');q('c-history-chart').replaceChildren();const d=q('c-history-chart').nextElementSibling;if(d?.classList.contains('chart-detail'))d.textContent='';q('c-h-note').textContent='';q('c-h-detail').textContent='';q('c-h-period').textContent='';q('c-trades').replaceChildren();}
function history(){
 const amount=Number(q('c-monthly').value),fee=Number(q('c-fee').value)/100,start=q('c-start').value,end=q('c-end').value;
 remember();q('c-selection').textContent=`${start} — ${end} · 费率 ${q('c-fee').value || '—'}%`;
 if(!q('c-monthly').value||!q('c-fee').value||!Number.isFinite(amount)||amount<1||amount>100000||!Number.isFinite(fee)||fee<0||fee>.05){clearHistory('请输入有效金额（1—100,000 USDT）和费率（0—5%）。');return;}
 if(start>end){clearHistory('开始周期不能晚于结束周期。');return;}
 const rows=periods().filter(d=>d.period>=start&&d.period<=end);
 if(!rows.length){clearHistory('所选区间没有可用历史数据。');return;}
 const downturn=periods().filter(d=>d.period>='2021-11'&&d.period<'2023-01');
 root.querySelectorAll('[data-period]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.period==='all'?start===firstPeriod()&&end===lastPeriod():start===downturn[0].period&&end===downturn.at(-1).period)));
 q('c-h-error').textContent='';let qty=0,under=0;const a=[],b=[],labels=[];q('c-trades').replaceChildren();
 rows.forEach((row,i)=>{const added=amount*(1-fee)/row.open;qty+=added;const invested=amount*(i+1),value=qty*row.close;a.push(invested);b.push(value);labels.push(date(row.end));if(value<invested)under++;
 const tr=document.createElement('tr');[date(row.time),number(row.open),added.toFixed(8),number(invested),number(value)].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.appendChild(td);});q('c-trades').appendChild(tr);});
 q('c-h-invest').textContent=number(a.at(-1));q('c-h-value').textContent=number(b.at(-1));q('c-h-profit').textContent=number(b.at(-1)-a.at(-1));
 const endName=frequency==='weekly'?'周末':'月末';
 q('c-h-period').textContent=`${frequency==='weekly'?'每周':'每月'}投入 ${number(amount)} · 共 ${rows.length} 次 · 估值截至 ${date(rows.at(-1).end)} UTC`;
 q('c-h-note').textContent=`${rows.length} 个${endName}里，有 ${under} 次持仓价值低于累计投入。`;
 q('c-h-detail').textContent=`累计买入 ${qty.toFixed(8)} BTC · 买入费用 ${number(amount*fee*rows.length)} USDT · 盈亏未扣卖出费用`;
 chart(q('c-history-chart'),a,b,labels,'USDT',['投入','持仓']);
}
function future(){
 const initial=Number(q('c-principal').value),add=Number(q('c-add').value),years=Number(q('c-years').value),annual=Number(q('c-rate').value);
 q('c-years-label').textContent=years+' 年';q('c-rate-label').textContent=annual+'%';root.querySelectorAll('[data-rate]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.rate===annual)));
 if(!q('c-principal').value||!q('c-add').value||!Number.isFinite(initial)||!Number.isFinite(add)||initial<0||initial>10000000||add<0||add>100000){q('c-f-error').textContent='本金范围 0—10,000,000 USD；每月投入范围 0—100,000 USD。';['c-f-invest','c-f-value','c-f-profit'].forEach(id=>q(id).textContent='—');q('c-future-chart').replaceChildren();const d=q('c-future-chart').nextElementSibling;if(d?.classList.contains('chart-detail'))d.textContent='';q('c-f-composition').textContent='';q('c-capital-bar').style.width='0%';q('c-return-bar').style.width='0%';return;}
 q('c-f-error').textContent='';const monthly=Math.pow(1+annual/100,1/12)-1;let balance=initial;const a=[initial],b=[initial],labels=['现在'];
 for(let i=1;i<=years*12;i++){balance=balance*(1+monthly)+add;a.push(initial+add*i);b.push(balance);labels.push((i/12).toFixed(i%12?1:0)+' 年');}
 const principal=a.at(-1),value=b.at(-1),gain=value-principal;
 q('c-f-invest').textContent=money(principal);q('c-f-value').textContent=money(value);q('c-f-profit').textContent=money(gain);
 if(principal===0){q('c-f-composition').textContent='尚未投入本金，模拟资产价值为 $0.00。';q('c-capital-bar').style.width='0%';q('c-return-bar').style.width='0%';}
 else if(gain>=0){q('c-f-composition').textContent=`期末每 100 美元中，${(principal/value*100).toFixed(1)} 美元来自投入，${(gain/value*100).toFixed(1)} 美元来自模拟收益。`;q('c-capital-bar').style.width=(principal/value*100)+'%';q('c-return-bar').style.width=(gain/value*100)+'%';}
 else{q('c-f-composition').textContent=`累计投入 ${money(principal)}，模拟损失 ${money(-gain)}，期末剩余 ${money(value)}。`;q('c-capital-bar').style.width=(value/principal*100)+'%';q('c-return-bar').style.width=(-gain/principal*100)+'%';}
 q('c-return-bar').style.background=gain<0?'var(--line)':'var(--orange)';chart(q('c-future-chart'),a,b,labels,'USD',['投入','模拟价值']);
}
function market(){
 const quote=data.quote;
 q('c-quote').textContent=number(Number(quote.lastPrice))+' USDT';q('c-quote-change').textContent='24h 变动 '+Number(quote.priceChangePercent).toFixed(2)+'%';
 q('c-quote-time').textContent='报价时间：'+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(quote.closeTime))+' 北京时间';
 const all=[data.marketStart,...data.weekly.map(r=>({date:date(r.end),time:r.end,price:r.close}))];
 const cutoff=new Date(all.at(-1).time);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-marketLength);
 const rows=marketLength?all.filter(r=>r.time>=cutoff.getTime()):all;
 chart(q('c-market-chart'),null,rows.map(r=>r.price),rows.map(r=>r.date),'USDT/BTC',['','价格'],rows.map(r=>r.time));
 root.querySelectorAll('[data-market]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.market===marketLength)));
 q('c-market-range').textContent=`${marketLength?'近 '+marketLength+' 年':'最大范围'}：${rows[0].date} — ${rows.at(-1).date} · 历史价格；最新报价时间见上方。`;
 updateQuoteStatus();
}
function historyStatus(){
 const name=frequency==='weekly'?'周线':'月线',end=date(periods().at(-1).end);
 q('c-history-status').textContent=historyState==='fresh'?`已核对最新完整${name}，截至 ${end} UTC。`:historyState==='failed'?`历史更新未成功，使用已加载${name}（截至 ${end} UTC）。可到“比特币”页刷新重试。`:`已加载截至 ${end} UTC 的历史快照，正在检查更新。`;
 q('c-history-range').textContent=`Binance ${name} · ${firstPeriod()} — ${lastPeriod()}，共 ${periods().length} 个完整周期。`;
 q('c-history-method-range').textContent=historyState==='fresh'?'本次打开页面已核对最新历史数据。':`初始快照读取于 ${data.snapshotReadAt.slice(0,10)}；更新失败时保留已注明截止日期的数据。`;
}
function populate(){
 const saved=ranges[frequency]||{start:firstPeriod(),end:lastPeriod()};
 ['c-start','c-end'].forEach(id=>q(id).replaceChildren());
 periods().forEach(row=>['c-start','c-end'].forEach(id=>{const o=document.createElement('option');o.value=row.period;o.textContent=row.period+(frequency==='weekly'?' 周':'');q(id).appendChild(o);}));
 q('c-start').value=saved.start;q('c-end').value=saved.end;
 q('c-start-label').textContent=frequency==='weekly'?'开始周（含，周一）':'开始月份（含）';q('c-end-label').textContent=frequency==='weekly'?'结束周（含，周一）':'结束月份（含）';
 q('c-schedule').textContent=frequency==='weekly'?'每周一 08:00 买入（北京时间）':'每月 1 日 08:00 买入（北京时间）';
 root.querySelectorAll('[data-frequency]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.frequency===frequency)));
 historyStatus();
}
function updateQuoteStatus(){const el=q('c-quote-status');const age=Date.now()-Number(data.quote.closeTime);let state=quoteState;if(!navigator.onLine)state='offline';else if(state==='live'&&age>QUOTE_MAX_AGE)state='stale';el.dataset.state=state;el.textContent=({live:'行情已更新 · 每 60 秒刷新',snapshot:'随站点发布的快照 · 待更新',failed:'更新失败 · 显示旧报价',stale:'报价已过期 · 等待更新',offline:'离线 · 显示旧报价'})[state];}
async function request(path){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{return await marketJSON(path,{signal:controller.signal});}finally{clearTimeout(timer);}}
async function refresh(includeHistory=false){
 if(busy||document.hidden)return;
 if(!navigator.onLine){quoteState='offline';updateQuoteStatus();return;}
 busy=true;q('c-refresh').disabled=true;q('c-refresh').textContent='更新中…';
 const quoteTask=(async()=>{try{const raw=await request('ticker/24hr?symbol=BTCUSDT');const parsed=parseQuote(raw);if(parsed.time<Number(data.quote.closeTime))throw new Error('Older quote');data.quote=raw;quoteState=parsed.fresh?'live':'stale';}catch{quoteState='failed';}market();})();
 const historyTask=includeHistory?(async()=>{
  try{
   const values=await Promise.all(['1M','1w'].map(interval=>request(`klines?symbol=BTCUSDT&interval=${interval}&startTime=0&limit=1000&timeZone=0`)));
   const updated={monthly:parseHistory(values[0],Date.now(),'monthly'),weekly:parseHistory(values[1],Date.now(),'weekly')};
   for(const key of ['monthly','weekly'])if(updated[key].length<data[key].length)throw new Error('Short history');
   remember();
   for(const key of ['monthly','weekly']){if(ranges[key]?.end===data[key].at(-1).period)ranges[key].end=updated[key].at(-1).period;data[key]=updated[key];}
   historyState='fresh';populate();history();market();
  }catch{historyState='failed';historyStatus();}
 })():Promise.resolve();
 try{await Promise.all([quoteTask,historyTask]);}finally{busy=false;q('c-refresh').disabled=false;q('c-refresh').textContent='刷新行情';}
}
populate();
root.querySelectorAll('[data-frequency]').forEach(el=>el.addEventListener('click',()=>{remember();frequency=el.dataset.frequency;populate();history();}));
const tabs=[...root.querySelectorAll('[data-panel]')];
function showPanel(name){tabs.forEach(tab=>{const selected=tab.dataset.panel===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;q('c-panel-'+tab.dataset.panel).hidden=!selected;});history();future();market();}
tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>showPanel(tab.dataset.panel));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;showPanel(tabs[next].dataset.panel);tabs[next].focus();}});});
root.querySelector('.dca-tabs').hidden=false;showPanel('history');
['c-monthly','c-fee','c-start','c-end'].forEach(id=>q(id).addEventListener('input',history));['c-principal','c-add','c-years','c-rate'].forEach(id=>q(id).addEventListener('input',future));
root.querySelectorAll('[data-rate]').forEach(el=>el.addEventListener('click',()=>{q('c-rate').value=el.dataset.rate;future();}));
root.querySelectorAll('[data-period]').forEach(el=>el.addEventListener('click',()=>{const rows=el.dataset.period==='all'?periods():periods().filter(r=>r.period>='2021-11'&&r.period<'2023-01');q('c-start').value=rows[0].period;q('c-end').value=rows.at(-1).period;history();}));
root.querySelectorAll('[data-market]').forEach(el=>el.addEventListener('click',()=>{marketLength=+el.dataset.market;market();}));
root.querySelectorAll('fieldset').forEach(el=>el.disabled=false);
history();future();market();let previousWidth=0;new ResizeObserver(()=>{const width=root.getBoundingClientRect().width;if(Math.abs(previousWidth-width)>1){previousWidth=width;history();future();market();}}).observe(root);
new MutationObserver(()=>{history();future();market();}).observe(document.body,{attributes:true,attributeFilter:['theme']});
q('c-refresh').addEventListener('click',()=>refresh(true));
function schedule(){clearInterval(pollTimer);if(!document.hidden){updateQuoteStatus();refresh();pollTimer=setInterval(()=>{updateQuoteStatus();refresh();},60000);}}
document.addEventListener('visibilitychange',schedule);window.addEventListener('online',()=>{refresh(true);schedule();});window.addEventListener('offline',()=>{quoteState='offline';updateQuoteStatus();});window.addEventListener('pagehide',()=>clearInterval(pollTimer));window.addEventListener('pageshow',schedule);
refresh(true);schedule();
})();
