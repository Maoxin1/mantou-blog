import { parseQuote, parseHistory, marketJSON, QUOTE_MAX_AGE } from './dca-market.mjs';
(()=>{
const root=document.getElementById('mantou-dca-c');
const q=id=>root.querySelector('#'+id);
const data=JSON.parse(q('c-verified-data').textContent);
const number=v=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
const money=v=>'$'+number(v);
const ns='http://www.w3.org/2000/svg';
let marketLength=0;
let quoteState='snapshot', busy=false, pollTimer;
const lastMonth=()=>data.monthly.at(-1).month;
const colors=()=>{const s=getComputedStyle(root);return {ink:s.getPropertyValue('--ink').trim(),muted:s.getPropertyValue('--muted').trim(),line:s.getPropertyValue('--line').trim(),orange:s.getPropertyValue('--orange').trim()};};
function chart(svg,a,b,labels,unit='USD',names=['累计投入','资产价值']){
 const width=Math.max(200,svg.getBoundingClientRect().width),height=width<450?210:230,L=59,R=12,T=26,B=35,c=colors();
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren();
 const values=a?[...a,...b]:b;const max=Math.max(1,...values)*1.08;
 const x=i=>L+(width-L-R)*i/Math.max(1,b.length-1),y=v=>height-B-(height-T-B)*v/max;
 const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!=null)e.textContent=text;svg.appendChild(e);return e;};
 const fmt=v=>v>=1e6?(v/1e6).toFixed(1)+'m':v>=1e3?(v/1e3).toFixed(v<1e4?1:0)+'k':Math.round(v);
 for(let i=0;i<=3;i++){const value=max*i/3,cy=y(value);add('line',{x1:L,y1:cy,x2:width-R,y2:cy,stroke:c.line,'stroke-width':.7});add('text',{x:L-7,y:cy+4,'text-anchor':'end',fill:c.muted,'font-size':11},fmt(value));}
 add('text',{x:L,y:13,fill:c.muted,'font-size':11},unit);
 const line=arr=>arr.map((v,i)=>(i?'L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2)).join(' ');
 add('path',{d:line(b)+` L${x(b.length-1)},${height-B} L${L},${height-B}Z`,fill:c.orange,'fill-opacity':.065});
 if(a)add('path',{d:line(a),fill:'none',stroke:c.ink,'stroke-width':1.7});
 add('path',{d:line(b),fill:'none',stroke:c.orange,'stroke-width':2.1});
 const ticks=[...new Set([0,Math.floor((b.length-1)/2),b.length-1])];
 ticks.forEach((i,j)=>add('text',{x:x(i),y:height-10,'text-anchor':j===0?'start':j===ticks.length-1?'end':'middle',fill:c.muted,'font-size':11},labels[i]));
 let detail=svg.nextElementSibling;
 if(!detail?.classList.contains('chart-detail')){detail=document.createElement('div');detail.className='chart-detail';detail.setAttribute('aria-live','polite');svg.insertAdjacentElement('afterend',detail);}
 const guide=add('line',{x1:L,y1:T,x2:L,y2:height-B,stroke:c.orange,'stroke-width':1,visibility:'hidden'});
 const dot=add('circle',{cx:L,cy:y(b[0]),r:3,fill:c.orange,visibility:'hidden'});
 const hit=add('rect',{x:L,y:T,width:width-L-R,height:height-T-B,fill:'transparent','aria-hidden':'true'});
 const show=i=>{guide.setAttribute('x1',x(i));guide.setAttribute('x2',x(i));guide.setAttribute('visibility','visible');dot.setAttribute('cx',x(i));dot.setAttribute('cy',y(b[i]));dot.setAttribute('visibility','visible');detail.textContent=labels[i]+' · '+(a?names[0]+' '+number(a[i])+' / ':'')+names[1]+' '+number(b[i])+' '+unit;};
 const inspect=e=>{const box=svg.getBoundingClientRect();const px=(e.clientX-box.left)*width/box.width;show(Math.max(0,Math.min(b.length-1,Math.round((px-L)/(width-L-R)*(b.length-1)))));};
 hit.addEventListener('pointermove',inspect);hit.addEventListener('click',inspect);show(b.length-1);
}
function clearHistory(message){q('c-h-error').textContent=message;['c-h-invest','c-h-value','c-h-profit'].forEach(id=>q(id).textContent='—');q('c-history-chart').replaceChildren();const d=q('c-history-chart').nextElementSibling;if(d?.classList.contains('chart-detail'))d.textContent='';q('c-h-note').textContent='';q('c-h-detail').textContent='';q('c-trades').replaceChildren();}
function history(){
 const amount=Number(q('c-monthly').value),fee=Number(q('c-fee').value)/100,start=q('c-start').value,end=q('c-end').value;
 if(!q('c-monthly').value||!q('c-fee').value||!Number.isFinite(amount)||amount<1||amount>100000||!Number.isFinite(fee)||fee<0||fee>.05){clearHistory('请输入有效金额（1—100,000 USDT）和费率（0—5%）。');return;}
 if(start>end){clearHistory('开始月份不能晚于结束月份。');return;}
 const rows=data.monthly.filter(d=>d.month>=start&&d.month<=end);
 if(rows.length<1){clearHistory('所选区间没有可用历史数据。');return;}
 root.querySelectorAll('[data-period]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.period==='all'?start==='2018-01'&&end===lastMonth():start==='2021-11'&&end==='2022-12')));
 q('c-h-error').textContent='';let qty=0,under=0;const a=[],b=[],labels=[];q('c-trades').replaceChildren();
 rows.forEach((row,i)=>{const added=amount*(1-fee)/row.open;qty+=added;const invested=amount*(i+1),value=qty*row.close;a.push(invested);b.push(value);labels.push(row.month);if(value<invested)under++;
 const tr=document.createElement('tr');[row.month,number(row.open),added.toFixed(8),number(invested),number(value)].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.appendChild(td);});q('c-trades').appendChild(tr);});
 q('c-h-invest').textContent=number(a.at(-1));q('c-h-value').textContent=number(b.at(-1));q('c-h-profit').textContent=number(b.at(-1)-a.at(-1));
 q('c-h-note').textContent=`${rows.length} 个持有月份里，有 ${under} 个月末的持仓价值低于累计投入。`;
 q('c-h-detail').textContent=`累计买入 ${qty.toFixed(8)} BTC · 买入费用合计 ${number(amount*fee*rows.length)} USDT · 盈亏未扣卖出费用`;
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
function market(){const quote=data.quote;q('c-quote').textContent=number(Number(quote.lastPrice))+' USDT';q('c-quote-change').textContent='24h 变动 '+Number(quote.priceChangePercent).toFixed(2)+'%';q('c-quote-time').textContent='报价时间：'+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(quote.closeTime))+' 北京时间';const rows=marketLength?data.monthly.slice(-marketLength):data.monthly;chart(q('c-market-chart'),null,rows.map(r=>r.close),rows.map(r=>r.month),'USDT/BTC',['','月末价']);root.querySelectorAll('[data-market]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.market===marketLength)));q('c-market-range').textContent=`历史曲线截至 ${lastMonth()}；报价时间见上方，两者时间不同。`;updateQuoteStatus();}
function populate(start='2018-01',end=lastMonth()){['c-start','c-end'].forEach(id=>q(id).replaceChildren());data.monthly.forEach(row=>['c-start','c-end'].forEach(id=>{const o=document.createElement('option');o.value=row.month;o.textContent=row.month;q(id).appendChild(o);}));q('c-start').value=start;q('c-end').value=end;q('c-history-range').textContent=`Binance 月度数据 · 2018.01—${lastMonth()}`;}
function updateQuoteStatus(){const el=q('c-quote-status');const age=Date.now()-Number(data.quote.closeTime);let state=quoteState;if(!navigator.onLine)state='offline';else if(state==='live'&&age>QUOTE_MAX_AGE)state='stale';el.dataset.state=state;el.textContent=({live:'行情已更新 · 每 60 秒刷新',snapshot:'随站点发布的快照 · 待更新',failed:'更新失败 · 显示旧报价',stale:'报价已过期 · 等待更新',offline:'离线 · 显示旧报价'})[state];}
async function request(path){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);try{return await marketJSON(path,{signal:controller.signal});}finally{clearTimeout(timer);}}
async function refresh(includeHistory=false){
 if(busy||document.hidden)return;
 if(!navigator.onLine){quoteState='offline';updateQuoteStatus();return;}
 busy=true;q('c-refresh').disabled=true;q('c-refresh').textContent='更新中…';
 const quoteTask=(async()=>{try{const raw=await request('ticker/24hr?symbol=BTCUSDT');const parsed=parseQuote(raw);if(parsed.time<Number(data.quote.closeTime))throw new Error('Older quote');data.quote=raw;quoteState=parsed.fresh?'live':'stale';}catch{quoteState='failed';}market();})();
 const historyTask=includeHistory?(async()=>{try{const raw=await request('klines?symbol=BTCUSDT&interval=1M&startTime=1514764800000&limit=1000&timeZone=0');const rows=parseHistory(raw);if(rows.length<data.monthly.length)throw new Error('Short history');const start=q('c-start').value,end=q('c-end').value,extend=end===lastMonth();data.monthly=rows;populate(start,extend?lastMonth():end);q('c-history-status').textContent=`已核对最新完整月线，截至 ${lastMonth()}。`;q('c-history-method-range').textContent=`当前加载 ${rows.length} 个完整月份，2018-01 至 ${lastMonth()}，本次打开页面时已核对。`;history();market();}catch{q('c-history-status').textContent=`历史更新未成功，使用已加载数据（截至 ${lastMonth()}）。可通过“刷新行情”重试。`;}})():Promise.resolve();
 try{await Promise.all([quoteTask,historyTask]);}finally{busy=false;q('c-refresh').disabled=false;q('c-refresh').textContent='刷新行情';}
}
populate();
['c-monthly','c-fee','c-start','c-end'].forEach(id=>q(id).addEventListener('input',history));['c-principal','c-add','c-years','c-rate'].forEach(id=>q(id).addEventListener('input',future));
root.querySelectorAll('[data-rate]').forEach(el=>el.addEventListener('click',()=>{q('c-rate').value=el.dataset.rate;future();}));
root.querySelectorAll('[data-period]').forEach(el=>el.addEventListener('click',()=>{q('c-start').value=el.dataset.period==='all'?'2018-01':'2021-11';q('c-end').value=el.dataset.period==='all'?lastMonth():'2022-12';history();}));
root.querySelectorAll('[data-market]').forEach(el=>el.addEventListener('click',()=>{marketLength=+el.dataset.market;market();}));
root.querySelectorAll('fieldset').forEach(el=>el.disabled=false);
history();future();market();let previousWidth=0;new ResizeObserver(()=>{const width=root.getBoundingClientRect().width;if(Math.abs(previousWidth-width)>1){previousWidth=width;history();future();market();}}).observe(root);
new MutationObserver(()=>{history();future();market();}).observe(document.body,{attributes:true,attributeFilter:['theme']});
q('c-refresh').addEventListener('click',()=>refresh(true));
function schedule(){clearInterval(pollTimer);if(!document.hidden){updateQuoteStatus();refresh();pollTimer=setInterval(()=>{updateQuoteStatus();refresh();},60000);}}
document.addEventListener('visibilitychange',schedule);window.addEventListener('online',()=>{refresh(true);schedule();});window.addEventListener('offline',()=>{quoteState='offline';updateQuoteStatus();});window.addEventListener('pagehide',()=>clearInterval(pollTimer));window.addEventListener('pageshow',schedule);
refresh(true);schedule();
})();
