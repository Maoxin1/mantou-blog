const {test,expect}=require('@playwright/test');
const fixture=require('../../data/dca.json');
const priceFixture=require('../../data/btcprices.json');
const priceResponse=()=>({data:priceFixture.daily.map(([date,price])=>({asset:'btc',time:date+'T00:00:00.000000000Z',PriceUSD:String(price)}))});
const NOW=Date.UTC(2026,9,8,10);
// Independent calendar oracle: a day's close is usable at the next UTC midnight.
const DAY=86400000;
const dailyPrices=new Map(priceFixture.daily);
const periods=kind=>priceFixture.daily.flatMap(([day,price])=>{
 const time=Date.parse(day+'T00:00:00Z')+DAY, start=new Date(time);
 if(kind==='weekly'?start.getUTCDay()!==1:start.getUTCDate()!==1)return [];
 const next=kind==='weekly'?time+7*DAY:Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1);
 const closeDay=new Date(next-DAY).toISOString().slice(0,10),valuePrice=dailyPrices.get(closeDay);
 return valuePrice===undefined?[]:[{period:start.toISOString().slice(0,kind==='weekly'?10:7),time,end:next-1,buyPrice:price,valuePrice}];
});
async function setup(page,state={mode:'ok',requests:0}) {
 await page.clock.install({time:new Date(NOW)});
 await page.route('https://community-api.coinmetrics.io/**',async route=>{
  state.priceRequests=(state.priceRequests||0)+1;
  const mode=state.priceMode||state.mode;
  if(mode==='fail')return route.abort();
  const raw=priceResponse();if(mode==='next-day')raw.data.push({asset:'btc',time:'2026-10-08T00:00:00Z',PriceUSD:'90000'});if(mode==='lag')raw.data.pop();if(mode==='extended')for(let day=8;day<=11;day++)raw.data.push({asset:'btc',time:`2026-10-${day.toString().padStart(2,'0')}T00:00:00.000000000Z`,PriceUSD:'90000'});if(mode==='revised')raw.data.forEach(row=>{if(['2026-10-04','2026-10-07'].includes(row.time.slice(0,10)))row.PriceUSD=String(Number(row.PriceUSD)*1.1);});if(mode==='gap')raw.data.splice(10,1);
  if(mode==='narrow')raw.data.forEach((row,index)=>{row.PriceUSD=String(60000+20000*index/(raw.data.length-1));});
  if(state.holdPrices){state.holdPrices=false;await new Promise(resolve=>state.releasePrices=resolve);}return route.fulfill({json:raw});
 });
 await page.route('https://data-api.binance.vision/**',async route=>{
  const url=route.request().url();
  if(state.mode==='fail')return route.abort();
  if(url.includes('klines'))throw new Error('USD DCA must not request Binance candles');
  state.requests++;if(state.holdQuote){state.holdQuote=false;await new Promise(resolve=>state.releaseQuote=resolve);}return route.fulfill({json:{...fixture.quote,lastPrice:'84000',closeTime:state.mode==='stale'?NOW-180000:await page.evaluate(()=>Date.now())}});
 });
 await page.goto('/dca/');await expect(page.locator('#c-tab-future')).toHaveAttribute('aria-selected','true');await page.locator('#c-tab-history').click();await expect(page.locator('#c-h-invest')).toHaveText((periods('weekly').length*100).toLocaleString('en-US',{minimumFractionDigits:2}));return state;
}
const value=async(page,id)=>Number((await page.locator('#'+id).textContent()).replace(/[$,]/g,''));
const percentValue=async(page,id)=>Number((await page.locator('#'+id).textContent()).replace(/[%,]/g,''));
const openMarket=async page=>{
 await page.locator('#c-tab-market').click();
 await expect(page.locator('#c-panel-market')).toBeVisible();await expect(page.locator('#c-market-chart')).toHaveAttribute('viewBox',/\d/);
};
const openInspection=async page=>{if(await page.locator('#c-inspection').getAttribute('open')===null)await page.locator('#c-inspection>summary').click();};
const openOptions=async page=>{if(!await page.locator('#c-options').getAttribute('open'))await page.locator('#c-options>summary').click();};
const setCustomRange=async page=>{
 const kind=await page.locator('[data-frequency=monthly]').getAttribute('aria-pressed')==='true'?'monthly':'weekly';
 const rows=periods(kind).filter(row=>row.period>='2021-11'&&row.period<'2023-01');
 await page.locator('[data-period=all]').click();
 await page.locator('#c-start').fill(new Date(rows[0].time).toISOString().slice(0,10));await page.locator('#c-end').fill(new Date(rows.at(-1).end).toISOString().slice(0,10));
};

test('Weekly DCA uses known Sunday close references, fees, complete weeks and preserves separate monthly ranges',async({page})=>{
 await setup(page);const weekly=periods('weekly');
 const expected=weekly.reduce((qty,r)=>qty+99.9/r.buyPrice,0)*weekly.at(-1).valuePrice;
 expect(await value(page,'c-h-value')).toBeCloseTo(expected,2);
 await expect(page.locator('#c-schedule')).toContainText('每周一 08:00');
 await expect(page.locator('#c-history-range')).toContainText('BTC/USD');await expect(page.locator('#c-trades tr').first()).toContainText('0.08584');
 await expect(page.locator('#c-trades tr')).toHaveCount(weekly.length);
 await openOptions(page);await expect(page.locator('#c-start')).toHaveAttribute('min','2010-07-18');
 await page.locator('#c-start').fill('2020-12-28');await page.locator('#c-end').fill('2021-01-10');
 await page.locator('#c-fee').fill('1');
 const two=weekly.filter(r=>['2020-12-28','2021-01-04'].includes(r.period));
 expect(await value(page,'c-h-value')).toBeCloseTo(two.reduce((sum,r)=>sum+99/r.buyPrice,0)*two.at(-1).valuePrice,2);
 expect(await value(page,'c-h-invest')).toBe(200);await expect(page.locator('#c-trades tr')).toHaveCount(2);
 await page.locator('[data-frequency=monthly]').click();await expect(page.locator('#c-schedule')).toContainText('每月 1 日');
 await expect(page.locator('#c-monthly')).toHaveValue('100');expect(await value(page,'c-h-invest')).toBe(periods('monthly').length*100);
 await page.locator('#c-start').fill('2021-01-01');await page.locator('#c-end').fill('2021-02-28');
 await page.locator('[data-frequency=weekly]').click();await expect(page.locator('#c-start')).toHaveValue('2020-12-28');await expect(page.locator('#c-end')).toHaveValue('2021-01-10');
 await page.locator('#c-start').fill('2021-01-11');await expect(page.locator('#c-h-error')).toContainText('不能');await expect(page.locator('#c-h-value')).toHaveText('—');
 await page.locator('#c-start').fill('2021-01-04');expect(await value(page,'c-h-value')).toBeCloseTo(99/two[1].buyPrice*two[1].valuePrice,2);
 await page.locator('#c-monthly').fill('');await expect(page.locator('#c-h-value')).toHaveText('—');await expect(page.locator('#c-history-chart')).not.toHaveAttribute('tabindex','0');await expect(page.locator('#c-history-chart + .chart-detail')).not.toBeVisible();
});

test('Monthly calculation and independent compound zero/negative scenarios remain correct',async({page})=>{
 await setup(page);await page.locator('[data-frequency=monthly]').click();await openOptions(page);
 const rows=periods('monthly');expect(await value(page,'c-h-value')).toBeCloseTo(rows.reduce((sum,r)=>sum+99.9/r.buyPrice,0)*rows.at(-1).valuePrice,2);
 await setCustomRange(page);expect(await value(page,'c-h-profit')).toBeLessThan(0);await expect(page.locator('#c-trades tr')).toHaveCount(14);
 await page.locator('#c-tab-future').click();expect(await percentValue(page,'c-f-return')).toBeCloseTo(29.48,2);expect(await percentValue(page,'c-f-annual')).toBe(5);
 await page.locator('[data-compound-frequency=monthly]').click();await page.locator('[data-rate="0"]').click();expect(await value(page,'c-f-value')).toBe(13000);
 await page.locator('[data-rate="-5"]').click();expect(await value(page,'c-f-profit')).toBeLessThan(0);await expect(page.locator('#c-f-composition')).toContainText('模拟损失');
 await page.locator('[data-rate="5"]').click();const rate=Math.pow(1.05,1/12)-1;expect(await value(page,'c-f-value')).toBeCloseTo(1000*Math.pow(1+rate,120)+100*(Math.pow(1+rate,120)-1)/rate,2);
 await page.locator('#c-principal').fill('0');await page.locator('#c-add').fill('0');await expect(page.locator('#c-f-composition')).toContainText('尚未投入');
 await expect(page.locator('#c-f-return')).toHaveText('—');await expect(page.locator('#c-f-annual')).toHaveText('—');
});

test('Maximum dollar price history starts in 2010 and retains early precision on a logarithmic chart',async({page})=>{
 await setup(page);await openMarket(page);
 await expect(page.locator('#c-market-range')).toContainText('2010-07-18');await expect(page.locator('#c-market-range')).toContainText('2026-10-07');await expect(page.locator('[data-market="0"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#c-market-chart [data-year-tick]').first()).toHaveText('2010');await expect(page.locator('#c-market-chart [data-year-tick]').last()).toHaveText('2026');await expect(page.locator('#c-market-chart')).toContainText('USD/BTC');await expect(page.locator('#c-market-chart')).toContainText('0.1');await expect(page.locator('#c-panel-market .panel-context').first()).toContainText('对数刻度');
 const full=await page.locator('#c-market-chart path').last().getAttribute('d');
 await page.locator('[data-market="1"]').click();await expect(page.locator('#c-market-selection')).toContainText('近 1 年');expect(await page.locator('#c-market-chart path').last().getAttribute('d')).not.toBe(full);
 const recentSpan=await page.locator('#c-market-chart path').last().evaluate(path=>{const ys=[...path.getAttribute('d').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match=>Number(match[2]));return {span:Math.max(...ys)-Math.min(...ys),plotHeight:path.ownerSVGElement.viewBox.baseVal.height-61};});
 expect(recentSpan.span).toBeGreaterThan(.6*recentSpan.plotHeight);
 await page.locator('[data-market="0"]').click();expect(await page.locator('#c-market-chart path').last().getAttribute('d')).toBe(full);
 expect(full).not.toMatch(/NaN|Infinity/);
 await page.locator('#c-market-chart').focus();await page.keyboard.press('Home');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2010-07-18');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('0.08584 USD/BTC');
 await page.keyboard.press('ArrowRight');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2010-07-19');await page.keyboard.press('End');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('83,273.72 USD/BTC');
});

test('Bitcoin cumulative return follows its own selected USD price range without an annualized metric',async({page})=>{
 await setup(page);await openMarket(page);
 for(const years of [0,1,5]){
  await page.locator(`[data-market="${years}"]`).click();
  const cutoff=new Date(priceFixture.daily.at(-1)[0]+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-years);
  const rows=years?priceFixture.daily.filter(([day])=>Date.parse(day+'T00:00:00Z')>=cutoff.getTime()):priceFixture.daily;
  const first=rows[0],last=rows.at(-1);
  expect(await percentValue(page,'c-m-return')).toBeCloseTo((last[1]/first[1]-1)*100,2);
  await expect(page.locator('#c-m-annual')).toHaveCount(0);await expect(page.locator('#c-m-annual-hint')).toHaveCount(0);await expect(page.locator('.market-performance strong')).toHaveCount(1);
 }
 const original=await page.locator('#c-m-return').textContent();
 await page.locator('#c-tab-history').click();
 await page.locator('#c-start').fill('2022-05-18');await page.locator('#c-end').fill('2022-06-01');
 await openMarket(page);
 await expect(page.locator('#c-m-return')).toHaveText(original);await expect(page.locator('[data-market="5"]')).toHaveAttribute('aria-pressed','true');
});

test('Dollar price history failure and missing days preserve the snapshot for both USD views independently of USDT quotes',async({page})=>{
 const state=await setup(page,{mode:'ok',priceMode:'fail',requests:0});await openMarket(page);
 await expect(page.locator('#c-price-status')).toContainText('更新未成功');await expect(page.locator('#c-history-status')).toContainText('历史更新未成功');await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
 const original=await page.locator('#c-market-chart path').last().getAttribute('d');
 state.priceMode='gap';await page.locator('#c-refresh').click();await expect(page.locator('#c-refresh')).toBeEnabled();await expect(page.locator('#c-price-status')).toContainText('完整性异常');expect(await page.locator('#c-market-chart path').last().getAttribute('d')).toBe(original);
 state.priceMode='ok';await page.locator('#c-refresh').click();await expect(page.locator('#c-price-status')).toBeHidden();await expect(page.locator('#c-history-status')).toBeHidden();
 const requests=state.priceRequests;await page.clock.fastForward(60001);await expect.poll(()=>state.requests).toBeGreaterThan(2);expect(state.priceRequests).toBe(requests);
 await page.locator('#c-tab-history').click();await openOptions(page);await expect(page.locator('#c-start')).toHaveAttribute('min','2010-07-18');expect(await value(page,'c-h-invest')).toBe(periods('weekly').length*100);
});


test('Shared daily price revisions update USD DCA results and the chart while keeping period selections and the USDT quote',async({page})=>{
 const state=await setup(page);const initial=await value(page,'c-h-value');await openOptions(page);
 await page.locator('[data-frequency=monthly]').click();await page.locator('#c-start').fill('2021-01-01');await page.locator('#c-end').fill('2021-02-28');
 const monthly=await value(page,'c-h-value');await page.locator('[data-frequency=weekly]').click();
 state.priceMode='revised';await openMarket(page);await page.locator('#c-refresh').click();await expect(page.locator('#c-price-status')).toBeHidden();
 await page.locator('#c-market-chart').focus();await page.keyboard.press('End');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('91,601.10 USD/BTC');await expect(page.locator('#c-quote')).toHaveText('84,000.00 USDT');
 await page.locator('#c-tab-history').click();expect(await value(page,'c-h-value')).toBeCloseTo(initial*1.1,2);await expect(page.locator('#c-start')).toHaveValue('2010-07-19');
 await page.locator('[data-frequency=monthly]').click();await expect(page.locator('#c-start')).toHaveValue('2021-01-01');await expect(page.locator('#c-end')).toHaveValue('2021-02-28');expect(await value(page,'c-h-value')).toBe(monthly);
});

test('A newly completed week extends the full-history end without changing a custom monthly range',async({page})=>{
 const state=await setup(page);await openOptions(page);await page.locator('[data-frequency=monthly]').click();await page.locator('#c-start').fill('2021-01-01');await page.locator('#c-end').fill('2021-02-28');
 await page.locator('[data-frequency=weekly]').click();await expect(page.locator('#c-end')).toHaveValue('2026-10-04');
 await page.clock.fastForward(4*DAY);state.priceMode='extended';await openMarket(page);await page.locator('#c-refresh').click();await expect(page.locator('#c-refresh')).toBeEnabled();await expect(page.locator('#c-price-status')).toBeHidden();
 await page.locator('#c-tab-history').click();await expect(page.locator('#c-start')).toHaveValue('2010-07-19');await expect(page.locator('#c-end')).toHaveValue('2026-10-11');expect(await value(page,'c-h-invest')).toBe(84700);
 const qty=periods('weekly').reduce((sum,r)=>sum+99.9/r.buyPrice,0)+99.9/dailyPrices.get('2026-10-04');expect(await value(page,'c-h-value')).toBeCloseTo(qty*90000,2);
 await page.locator('[data-frequency=monthly]').click();await expect(page.locator('#c-start')).toHaveValue('2021-01-01');await expect(page.locator('#c-end')).toHaveValue('2021-02-28');
});

test('A narrow logarithmic price range retains readable numeric ticks, chart height and exact day prices',async({page})=>{
 await setup(page,{mode:'ok',priceMode:'narrow',requests:0});await openMarket(page);await expect(page.locator('#c-price-status')).toBeHidden();
 await page.locator('[data-market="1"]').click();await expect(page.locator('#c-market-selection')).toContainText('近 1 年');
 const chart=page.locator('#c-market-chart'),ticks=chart.locator('[data-value-tick]'),count=await ticks.count();
 expect(count).toBeGreaterThanOrEqual(2);expect(count).toBeLessThanOrEqual(4);
 expect(new Set(await ticks.allTextContents()).size).toBe(count);
 for(const tick of await ticks.all())await expect(tick).toBeVisible();
 const coordinates=await ticks.evaluateAll(nodes=>nodes.map(node=>{const box=node.getBBox(),svg=node.ownerSVGElement;return {value:Number(node.getAttribute('data-value-tick')),centerY:box.y+box.height/2,height:svg.viewBox.baseVal.height};}));
 for(const tick of coordinates){expect(tick.value).toBeGreaterThan(0);expect(tick.centerY).toBeGreaterThanOrEqual(26);expect(tick.centerY).toBeLessThanOrEqual(tick.height-35);}
 const recentSpan=await chart.locator('path').last().evaluate(path=>{const ys=[...path.getAttribute('d').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match=>Number(match[2]));return {span:Math.max(...ys)-Math.min(...ys),plotHeight:path.ownerSVGElement.viewBox.baseVal.height-61};});
 expect(recentSpan.span).toBeGreaterThan(.6*recentSpan.plotHeight);
 const cutoff=new Date(priceFixture.daily.at(-1)[0]+'T00:00:00Z');cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
 const firstIndex=priceFixture.daily.findIndex(([date])=>Date.parse(date+'T00:00:00Z')>=cutoff.getTime()),firstDate=priceFixture.daily[firstIndex][0],firstPrice=60000+20000*firstIndex/(priceFixture.daily.length-1);
 await chart.focus();await page.keyboard.press('Home');
 await expect(page.locator('#c-market-chart + .chart-detail')).toHaveText(firstDate+' · 价格 '+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(firstPrice)+' USD/BTC');
});

test('DCA quote failure, stale response and recovery preserve honest states',async({page})=>{
 const state=await setup(page,{mode:'fail',requests:0});await expect(page.locator('#c-history-status')).toContainText('历史更新未成功');await openMarket(page);
 await expect(page.locator('#c-quote-status')).toContainText('更新失败');await expect(page.locator('#c-quote-label')).toHaveText('上次报价');await expect(page.locator('#c-quote-time')).toContainText('北京时间');state.mode='stale';await page.locator('#c-refresh').click();await expect(page.locator('#c-quote-status')).toContainText('已过期');await expect(page.locator('#c-quote-label')).toHaveText('上次报价');
 state.mode='ok';await page.locator('#c-refresh').click();await expect(page.locator('#c-quote-status')).toContainText('行情已更新');await expect(page.locator('#c-quote')).toHaveText('84,000.00 USDT');await expect(page.locator('#c-quote-label')).toHaveText('当前报价');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));});await expect(page.locator('#c-quote-status')).toContainText('离线');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));});await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
});

for (const initial of ['offline','hidden']) {
 test(`DCA validates deferred initial histories after ${initial} recovery`,async({page})=>{
  await page.addInitScript(initial=>{
   if(initial==='offline')Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
   else Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  },initial);
  const state=await setup(page);
  expect(state.priceRequests||0).toBe(0);
  if(initial==='offline'){
   await expect(page.locator('#c-history-status')).toContainText('当前离线');
   await openMarket(page);await expect(page.locator('#c-price-status')).toContainText('当前离线');
  }
  await page.evaluate(initial=>{
   if(initial==='offline'){Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));}
   else {Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));}
  },initial);
  await expect(page.locator('#c-refresh')).toBeEnabled();
  await expect.poll(()=>state.priceRequests).toBe(1);
  await page.locator('#c-tab-history').click();await expect(page.locator('#c-history-status')).toHaveText(/已核对最新完整周定投/);
  await expect(page.locator('#c-history-status')).toBeHidden();
  await openMarket(page);await expect(page.locator('#c-price-status')).toBeHidden();
  const quotes=state.requests;await page.clock.fastForward(60001);await expect.poll(()=>state.requests).toBeGreaterThan(quotes);
  expect(state.priceRequests).toBe(1);
 });
}

test('DCA polls every minute and pauses while hidden',async({page})=>{
 const state=await setup(page);await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
 const before=state.requests;await page.clock.fastForward(60001);await expect.poll(()=>state.requests).toBeGreaterThan(before);await expect(page.locator('#c-refresh')).toBeEnabled();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const paused=state.requests;await page.clock.fastForward(180000);expect(state.requests).toBe(paused);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>state.requests).toBeGreaterThan(paused);
});

test('Result-first tools and the separate C market panel retain three tabs across widths and themes',async({page})=>{
 const errors=[],iconRequests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(new URL(request.url()).pathname==='/images/identity/bitcoin-drip.png')iconRequests.push(request.url());});await setup(page);
 expect(iconRequests).toEqual([]);
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.body.setAttribute('theme',t),theme);
   for(const panel of ['history','future']){
    await page.locator('#c-tab-'+panel).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await expect(page.locator('#c-panel-'+panel)).toBeVisible();
    const result=await page.locator('#c-panel-'+panel+' .history-results').boundingBox(),settings=await page.locator('#c-panel-'+panel+' fieldset').boundingBox();expect(result.y+result.height).toBeLessThan(settings.y);
    const metrics=page.locator('#c-panel-'+panel+' .history-results .result-pair > div');await expect(metrics).toHaveCount(4);
    const boxes=await metrics.evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {left:box.left,top:box.top,right:box.right,overflow:node.scrollWidth-node.clientWidth};}));
    if(width>=800){
     for(const box of boxes)expect(box.top).toBeCloseTo(boxes[0].top,0);
     for(let index=1;index<boxes.length;index++)expect(boxes[index].left).toBeGreaterThanOrEqual(boxes[index-1].right);
    }else{
     expect(boxes[0].top).toBeCloseTo(boxes[1].top,0);expect(boxes[2].top).toBeCloseTo(boxes[3].top,0);expect(boxes[2].top).toBeGreaterThan(boxes[0].top);
     expect(boxes[0].left).toBeCloseTo(boxes[2].left,0);expect(boxes[1].left).toBeCloseTo(boxes[3].left,0);expect(boxes[1].left).toBeGreaterThanOrEqual(boxes[0].right);
    }
    for(const box of boxes)expect(box.overflow).toBeLessThanOrEqual(1);
   }
   await openMarket(page);await expect.poll(()=>page.locator('.bitcoin-icon').evaluate(image=>image.complete&&image.naturalWidth===1120)).toBe(true);expect(iconRequests).toHaveLength(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  }
 }
 await page.setViewportSize({width:390,height:1000});await page.locator('#c-tab-history').click();const result=await page.locator('#c-h-value').boundingBox(),chart=await page.locator('#c-history-chart').boundingBox();expect(result.y).toBeLessThan(chart.y);
 await expect(page.locator('#mantou-dca-c [role=tab]')).toHaveCount(3);await page.locator('#c-tab-history').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#c-tab-market')).toBeFocused();await expect(page.locator('#c-panel-market')).toBeVisible();
 await page.keyboard.press('ArrowRight');await expect(page.locator('#c-tab-future')).toBeFocused();await expect(page.locator('#c-panel-future')).toBeVisible();
 await page.keyboard.press('ArrowLeft');await expect(page.locator('#c-tab-market')).toBeFocused();await page.keyboard.press('ArrowLeft');await expect(page.locator('#c-tab-history')).toBeFocused();await expect(page.locator('#c-panel-history')).toBeVisible();
 await page.goto('/');await expect(page.locator('[data-home-dca] a').first()).toHaveAttribute('href','/dca/');await page.goto('/en/dca/');await expect(page.getByRole('link',{name:'Open the interactive notebook (中文)'})).toHaveAttribute('href','/dca/');expect(errors).toEqual([]);
});


test('Compound weekly/monthly frequency uses effective annual return and independent inputs',async({page})=>{
 await setup(page);await page.locator('#c-tab-future').click();
 await expect(page.locator('[data-compound-frequency=weekly]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#c-years').fill('1');
 for(const kind of ['weekly','monthly']){
  await page.locator(`[data-compound-frequency=${kind}]`).click();const count=kind==='weekly'?52:12;
  for(const annual of [-5,0,5]){
   await page.locator(`[data-rate="${annual}"]`).click();const rate=Math.pow(1+annual/100,1/count)-1,invested=1000+100*count;
   const balance=annual===0?invested:1000*(1+annual/100)+100*((1+annual/100)-1)/rate;
   expect(await value(page,'c-f-invest')).toBe(invested);expect(await value(page,'c-f-value')).toBeCloseTo(balance,2);
   expect(await percentValue(page,'c-f-return')).toBeCloseTo((balance/invested-1)*100,2);expect(await percentValue(page,'c-f-annual')).toBe(annual);
  }
 }
 await expect(page.locator('#c-f-annual').locator('..').locator('small')).toHaveText('假设年化回报率');
 await page.locator('[data-compound-frequency=weekly]').click();await page.locator('[data-rate="0"]').click();
 await expect(page.locator('#c-f-period')).toContainText('每周 100.00 USD · 1 年 · 假设年收益 0%');
 await page.locator('[data-compound-frequency=monthly]').click();expect(await value(page,'c-f-value')).toBe(2200);await expect(page.locator('#c-add')).toHaveValue('100');
 await page.locator('#c-add').fill('0');await page.locator('[data-rate="5"]').click();expect(await value(page,'c-f-value')).toBeCloseTo(1050,2);
 await page.locator('[data-compound-frequency=weekly]').click();expect(await value(page,'c-f-value')).toBeCloseTo(1050,2);
 await page.locator('#c-add').fill('100');await page.locator('[data-rate="-5"]').click();expect(await value(page,'c-f-profit')).toBeLessThan(0);
 await page.locator('#c-tab-history').click();await page.locator('[data-frequency=monthly]').click();await page.locator('#c-tab-future').click();await expect(page.locator('[data-compound-frequency=weekly]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#c-principal').fill('');await expect(page.locator('#c-f-value')).toHaveText('—');await expect(page.locator('#c-f-return')).toHaveText('—');await expect(page.locator('#c-f-annual')).toHaveText('—');await expect(page.locator('#c-f-error')).toContainText('每次投入');await page.locator('#c-future-chart').dispatchEvent('focus');await page.locator('#c-future-chart').dispatchEvent('keydown',{key:'Home'});await expect(page.locator('#c-future-chart + .chart-detail')).not.toBeVisible();await expect(page.locator('#c-future-chart')).not.toHaveAttribute('tabindex','0');
});

test('Quiet default presentation preserves important context and reveals graph details on demand',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await page.locator('#c-tab-future').click();
 await expect(page.locator('[role=tab]').first()).toHaveText('复利模拟');
 await expect(page.locator('#c-panel-future .panel-context')).toContainText('非收益预测');
 await expect(page.locator('#c-f-schedule')).toContainText('52 次');
 await expect(page.locator('#c-f-composition')).not.toBeVisible();await expect(page.locator('#c-future-chart + .chart-detail')).not.toBeVisible();
 await page.locator('#c-future-chart').focus();await page.keyboard.press('Home');await expect(page.locator('#c-future-chart + .chart-detail')).toBeVisible();await expect(page.locator('#c-future-chart + .chart-detail')).toContainText('现在');
 const valueBox=await page.locator('#c-f-value').boundingBox(),chartBox=await page.locator('#c-future-chart').boundingBox();expect(valueBox.y).toBeLessThan(chartBox.y);
 await page.locator('#c-tab-history').click();await expect(page.locator('[data-period=down]')).toHaveCount(0);await expect(page.locator('[data-period=all]')).toBeVisible();await expect(page.locator('#c-panel-history .budget-note')).toBeVisible();await expect(page.locator('#c-h-detail')).not.toBeVisible();
 await expect(page.locator('#c-tab-market')).toBeVisible();await expect(page.locator('#c-tab-market')).toHaveAttribute('aria-selected','false');await expect(page.locator('#c-market-context')).toHaveCount(0);await expect(page.locator('#c-panel-market')).not.toBeVisible();
 await openMarket(page);await expect(page.locator('#c-panel-market')).toHaveAttribute('aria-labelledby','c-tab-market');await expect(page.locator('.bitcoin-heading h2')).toHaveText('比特币行情');await expect(page.locator('.bitcoin-icon')).toBeVisible();await expect(page.locator('.bitcoin-icon')).toHaveAttribute('src','/images/identity/bitcoin-drip.png');await expect(page.locator('#c-history-chart')).not.toBeVisible();await expect(page.locator('#c-future-chart')).not.toBeVisible();
});

test('Phone market tap reveals its date and USD price inside the visible chart',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4174',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{const page=await context.newPage();await setup(page);await openMarket(page);const chart=page.locator('#c-market-chart'),detail=page.locator('#c-market-chart + .chart-detail');
 await chart.scrollIntoViewIfNeeded();const box=await chart.boundingBox();await page.touchscreen.tap(box.x+box.width*.55,box.y+box.height*.4);
 await expect(detail).toBeVisible();await expect(detail).toContainText('USD/BTC');const reading=await detail.boundingBox();expect(reading.y).toBeGreaterThan(box.y);expect(reading.y+reading.height).toBeLessThanOrEqual(844);expect(reading.x+reading.width).toBeLessThanOrEqual(390);
 }finally{await context.close();}
});

test('Expanded price history immediately rotates portrait phones and preserves range, pointer selection, focus and scroll',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
 await openMarket(page);
 await page.evaluate(()=>{document.getElementById('c-price-viewport').requestFullscreen=()=>Promise.reject(new Error('Fullscreen unavailable'));});
 const chart=page.locator('#c-market-chart'),detail=page.locator('#c-market-chart + .chart-detail');
 const clickDate=async target=>{
  const point=await chart.evaluate((svg,{date,first,last})=>{
   const width=svg.viewBox.baseVal.width,height=svg.viewBox.baseVal.height;
   const time=d=>Date.parse(d+'T00:00:00Z'),point=svg.createSVGPoint();
   point.x=date===first?52:date===last?width-13:51+(width-63)*(time(date)-time(first))/(time(last)-time(first));
   point.y=height/2;const screen=point.matrixTransform(svg.getScreenCTM());return {x:screen.x,y:screen.y,plotWidth:width-63};
  },{date:target,first:priceFixture.daily[0][0],last:priceFixture.daily.at(-1)[0]});
  await page.mouse.click(point.x,point.y);
  const shownDate=(await detail.textContent()).split(' · ')[0],first=priceFixture.daily[0][0],last=priceFixture.daily.at(-1)[0];
  const spanDays=(Date.parse(last)-Date.parse(first))/86400000;
  // One physical pixel spans several days in the maximum overview; Chromium rounds mouse coordinates.
  if(target===first||target===last)expect(shownDate).toBe(target);
  else expect(Math.abs(Date.parse(shownDate)-Date.parse(target))/86400000).toBeLessThanOrEqual(Math.ceil(spanDays/point.plotWidth)/2+1);
  const row=priceFixture.daily.find(row=>row[0]===shownDate);expect(row).toBeDefined();const price=row[1];
  await expect(detail).toHaveText(shownDate+' · 价格 '+new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:price<1?6:2}).format(price)+' USD/BTC');
 };
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  const normal=await chart.boundingBox(),panel=await page.locator('#c-panel-market').boundingBox();
  expect(normal.width).toBeGreaterThanOrEqual(panel.width-1);expect(normal.height).toBeGreaterThanOrEqual(280);
  await page.locator('[data-market="5"]').click();await chart.focus();await page.keyboard.press('Home');
  const selected=await detail.textContent(),reading=await detail.boundingBox(),controls=await page.locator('#c-market-ranges').boundingBox(),focusedChart=await chart.boundingBox();
  expect(controls.y+controls.height).toBeLessThan(focusedChart.y+1);
  expect(reading.y).toBeGreaterThan(focusedChart.y);expect(reading.y+reading.height).toBeLessThan(focusedChart.y+focusedChart.height);
  await expect(page.locator('#c-market-controls #c-market-ranges')).toBeVisible();
  await page.locator('#c-expand').scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
  await page.locator('#c-expand').click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#c-collapse')).toBeFocused();
  await expect(page.locator('#c-price-screen')).toHaveClass(/is-rotated/);
  const geometry=await page.locator('#c-price-screen').evaluate(screen=>{const matrix=new DOMMatrix(getComputedStyle(screen).transform);return {width:screen.clientWidth,height:screen.clientHeight,a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d};});
  expect(geometry.width).toBeGreaterThan(geometry.height);expect(geometry.a).toBeCloseTo(0);expect(geometry.b).toBeCloseTo(1);expect(geometry.c).toBeCloseTo(-1);expect(geometry.d).toBeCloseTo(0);
  await expect.poll(()=>chart.evaluate(svg=>svg.viewBox.baseVal.width)).toBeGreaterThan(780);
  const dimensions=await chart.evaluate(svg=>({width:svg.clientWidth,height:svg.clientHeight,viewWidth:svg.viewBox.baseVal.width,viewHeight:svg.viewBox.baseVal.height}));
  expect(dimensions.viewWidth).toBe(dimensions.width);expect(dimensions.viewHeight).toBe(dimensions.height);expect(dimensions.width).toBeGreaterThan(dimensions.height);
  await expect(detail).toHaveText(selected);await expect(page.locator('[data-market="5"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#c-price-controls #c-market-ranges')).toBeVisible();
  await expect(page.locator('#c-price-dialog #c-m-return')).toBeVisible();await expect(page.locator('#c-price-dialog #c-m-annual')).toHaveCount(0);
  // The modal traps focus and keeps the original tab controls inert.
  await page.keyboard.press('Shift+Tab');await expect(page.locator('#c-tab-history')).not.toBeFocused();
  await page.locator('[data-market="0"]').click();await expect(page.locator('#c-market-range')).toContainText('2010-07-18');
  await expect(page.locator('#c-price-dialog .panel-context')).toContainText('对数刻度');
  // Real screen clicks cover both endpoints and an interior date while the phone remains portrait.
  await clickDate('2010-07-18');await clickDate('2026-10-07');await clickDate('2017-12-17');
  let inspected=await detail.textContent();
  await page.setViewportSize({width:844,height:390});await expect(page.locator('#c-price-screen')).not.toHaveClass(/is-rotated/);await expect(detail).toHaveText(inspected);
  const box=await chart.boundingBox();expect(box.width).toBeGreaterThan(780);expect(box.height).toBeGreaterThan(120);
  const tickBoxes=await chart.locator('[data-year-tick]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right};}));
  expect(tickBoxes.length).toBeGreaterThanOrEqual(7);for(let i=1;i<tickBoxes.length;i++)expect(tickBoxes[i].left-tickBoxes[i-1].right).toBeGreaterThan(8);
  await clickDate('2017-12-17');inspected=await detail.textContent();
  await page.evaluate(()=>document.body.setAttribute('theme','dark'));await expect(detail).toHaveText(inspected);
  const before=await chart.getAttribute('viewBox');await page.clock.fastForward(60001);await expect(detail).toHaveText(inspected);expect(await chart.getAttribute('viewBox')).toBe(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({width,height:844});await expect(page.locator('#c-price-screen')).toHaveClass(/is-rotated/);await expect(detail).toHaveText(inspected);
  await expect.poll(()=>chart.evaluate(svg=>svg.viewBox.baseVal.width)).toBeGreaterThan(780);
  await page.locator('#c-collapse').click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
  await expect(detail).toHaveText(inspected);await expect(page.locator('[data-market="0"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#c-market-controls #c-market-ranges')).toBeVisible();await expect(page.locator('#c-market-home #c-market-chart')).toBeVisible();
  const restoredReading=await detail.boundingBox(),restoredControls=await page.locator('#c-market-ranges').boundingBox(),restoredChart=await chart.boundingBox();expect(restoredControls.y+restoredControls.height).toBeLessThan(restoredChart.y+1);expect(restoredReading.y).toBeGreaterThan(restoredChart.y);
  expect(await page.evaluate(()=>scrollY)).toBeCloseTo(scroll,0);expect(await page.evaluate(()=>document.documentElement.style.overflow)).toBe('');
 }
 await page.locator('#c-expand').click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 await page.locator('#c-tab-future').click();await expect(page.locator('[data-compound-frequency=weekly]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#c-add')).toHaveValue('100');
 expect(errors).toEqual([]);
});

test('Browser fullscreen exit restores the same price chart and normal page controls',async({page})=>{
 await setup(page);await openMarket(page);await page.locator('[data-market="1"]').click();await page.locator('#c-expand').click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe('c-price-viewport');
 await page.evaluate(()=>document.exitFullscreen());await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 await expect(page.locator('[data-market="1"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#c-market-home #c-market-chart')).toBeVisible();
 await page.locator('#c-expand').click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe('c-price-viewport');
 await page.locator('#c-collapse').click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement)).toBeNull();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.locator('#c-tab-history').click();await expect(page.locator('[data-frequency=weekly]')).toHaveAttribute('aria-pressed','true');
});

test('A late fullscreen grant after closing cannot leave an empty fullscreen view',async({page})=>{
 await setup(page);await openMarket(page);
 await page.evaluate(()=>{
  let element=null;window.lateFullscreenExitCount=0;
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>element});
  document.exitFullscreen=async()=>{element=null;window.lateFullscreenExitCount++;document.dispatchEvent(new Event('fullscreenchange'));};
  document.getElementById('c-price-viewport').requestFullscreen=()=>new Promise(resolve=>{window.grantLateFullscreen=()=>{element=document.getElementById('c-price-viewport');document.dispatchEvent(new Event('fullscreenchange'));resolve();};});
 });
 await page.locator('#c-expand').click();await page.locator('#c-collapse').click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.evaluate(()=>window.grantLateFullscreen());await expect.poll(()=>page.evaluate(()=>window.lateFullscreenExitCount)).toBe(1);
 await expect(page.locator('#c-market-home #c-market-chart')).toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 expect(await page.evaluate(()=>document.fullscreenElement)).toBeNull();
});


test('Custom history ranges support exact valuation dates, touch and keyboard, retaining its selection on redraw',async({page,context})=>{
 await setup(page);await setCustomRange(page);
 await openInspection(page);
 const chart=page.locator('#c-history-chart'),detail=page.locator('#c-history-chart + .chart-detail');
 await page.locator('#c-point-date').fill('2022-05-18');await expect(page.locator('#c-point-date')).toHaveValue('2022-05-22');await expect(detail).toContainText('2022-05-22');
 const rows=periods('weekly').filter(r=>r.period>='2021-11'&&r.period<'2023-01'),through=rows.filter(r=>r.end<=Date.parse('2022-05-23T00:00:00Z'));
 const expected=through.reduce((qty,r)=>qty+99.9/r.buyPrice,0)*through.at(-1).valuePrice;
 await expect(detail).toContainText(expected.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+' USD');
 await page.locator('#c-point-next').click();await expect(detail).toContainText('2022-05-29');await page.locator('#c-point-prev').click();await expect(detail).toContainText('2022-05-22');
 const selected=await detail.textContent();await page.evaluate(()=>document.body.setAttribute('theme','dark'));await page.setViewportSize({width:320,height:844});await expect(detail).toHaveText(selected);
 await openMarket(page);await page.locator('#c-refresh').click();await expect(page.locator('#c-refresh')).toBeEnabled();await page.locator('#c-tab-history').click();await expect(detail).toHaveText(selected);
 await chart.focus();await page.keyboard.press('Home');await expect(detail).toContainText('2021-11-07');await expect(page.locator('#c-point-prev')).toBeDisabled();
 await chart.scrollIntoViewIfNeeded();
 const point=await chart.evaluate(svg=>{const p=svg.createSVGPoint();p.x=51+(svg.viewBox.baseVal.width-63)*5/(61-1);p.y=svg.viewBox.baseVal.height-8;const screen=p.matrixTransform(svg.getScreenCTM());return {x:screen.x,y:screen.y};});
 await page.mouse.click(point.x,point.y);await expect(detail).toContainText('2021-12-12');
 const phone=await context.browser().newContext({hasTouch:true,viewport:{width:390,height:844}});const touch=await phone.newPage();await setup(touch);await setCustomRange(touch);await openInspection(touch);
 await touch.locator('#c-history-chart').scrollIntoViewIfNeeded();
 const tap=await touch.locator('#c-history-chart').evaluate(svg=>{const p=svg.createSVGPoint();p.x=52;p.y=svg.viewBox.baseVal.height/2;const s=p.matrixTransform(svg.getScreenCTM());return {x:s.x,y:s.y};});await touch.touchscreen.tap(tap.x,tap.y);await expect(touch.locator('#c-history-chart + .chart-detail')).toContainText('2021-11-07');await phone.close();
 await page.locator('[data-frequency=monthly]').click();await setCustomRange(page);await openInspection(page);await page.locator('#c-point-date').fill('2022-05-18');await expect(detail).toContainText('2022-05-31');
 await page.locator('[data-frequency=weekly]').click();await expect(detail).toContainText('2021-12-12');
 await page.locator('#c-point-date').fill('2020-01-01');await expect(page.locator('#c-point-error')).toContainText('当前回测区间');await expect(detail).toBeHidden();
});

test('Custom history uses an editable range with visible dates, independent recalculation and separate weekly/monthly custom spans',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await setCustomRange(page);
 await openInspection(page);
 const start=page.locator('#c-start'),end=page.locator('#c-end'),custom=page.locator('#c-range-custom'),detail=page.locator('#c-history-chart + .chart-detail');
 await expect(page.locator('#c-options')).not.toHaveAttribute('open','');await expect(start).toBeVisible();await expect(end).toBeVisible();await expect(custom).toBeVisible();
 const assertRange=async(kind,from,to)=>{
  const rows=periods(kind).filter(r=>r.time>=Date.parse(from+'T00:00:00Z')&&r.end<Date.parse(to+'T00:00:00Z')+DAY),balance=rows.reduce((qty,r)=>qty+99.9/r.buyPrice,0)*rows.at(-1).valuePrice;
  expect(await value(page,'c-h-value')).toBeCloseTo(balance,2);expect(await value(page,'c-h-invest')).toBe(rows.length*100);expect(await value(page,'c-h-profit')).toBeCloseTo(balance-rows.length*100,2);
  await expect(page.locator('#c-trades tr')).toHaveCount(rows.length);
  await expect(page.locator('#c-h-period')).toHaveText(`有效回测 ${new Date(rows[0].time).toISOString().slice(0,10)} — ${new Date(rows.at(-1).end).toISOString().slice(0,10)} UTC · ${rows.length} 次投入`);
  await expect(page.locator('#c-history-chart')).toContainText(new Date(rows.at(-1).end).toISOString().slice(0,10));
 };
 const initialCurve=await page.locator('#c-history-chart path').last().getAttribute('d');await page.locator('#c-point-date').fill('2022-12-25');
 await start.fill('2022-05-04');await end.fill('2022-05-26');await expect(start).toHaveValue('2022-05-04');await expect(end).toHaveValue('2022-05-26');await assertRange('weekly','2022-05-04','2022-05-26');
 await expect(custom).toBeVisible();await expect(page.locator('[data-period=all]')).toHaveAttribute('aria-pressed','false');
 expect(await page.locator('#c-history-chart path').last().getAttribute('d')).not.toBe(initialCurve);await expect(detail).toBeHidden();await expect(page.locator('#c-point-date')).toHaveValue('');
 await start.fill('2019-05-06');await end.fill('2019-05-20');await assertRange('weekly','2019-05-06','2019-05-20');
 await page.locator('[data-frequency=monthly]').click();await setCustomRange(page);await expect(start).toHaveAttribute('type','date');await expect(start).toBeVisible();await expect(end).toBeVisible();
 await start.fill('2022-05-01');await end.fill('2022-07-31');await assertRange('monthly','2022-05-01','2022-07-31');await expect(custom).toBeVisible();
 await page.locator('[data-frequency=weekly]').click();await expect(start).toHaveValue('2019-05-06');await expect(end).toHaveValue('2019-05-20');await assertRange('weekly','2019-05-06','2019-05-20');
 await openMarket(page);await page.locator('#c-refresh').click();await expect(page.locator('#c-refresh')).toBeEnabled();await page.locator('#c-tab-history').click();await expect(start).toHaveValue('2019-05-06');await expect(end).toHaveValue('2019-05-20');
 await page.locator('[data-frequency=monthly]').click();await expect(start).toHaveValue('2022-05-01');await expect(end).toHaveValue('2022-07-31');await assertRange('monthly','2022-05-01','2022-07-31');
 await page.locator('[data-period=all]').click();await expect(custom).toBeHidden();await expect(page.locator('[data-period=all]')).toHaveAttribute('aria-pressed','true');await assertRange('monthly',new Date(periods('monthly')[0].time).toISOString().slice(0,10),new Date(periods('monthly').at(-1).end).toISOString().slice(0,10));
});

test('Invalid custom history spans clear results, point readings and preset selection for both frequencies',async({page})=>{
 await setup(page);
 for(const kind of ['weekly','monthly']){
  await page.locator(`[data-frequency=${kind}]`).click();
  const invalid=kind==='weekly'?[['c-start',''],['c-end',''],['c-start','2023-01-02'],['c-start','2010-07-17'],['c-end','2026-10-12']]:[['c-start',''],['c-end',''],['c-start','2023-01-01'],['c-start','2010-07-17'],['c-end','2026-10-08']];
  for(const [id,date] of invalid){
   await setCustomRange(page);await openInspection(page);await page.locator('#c-point-date').fill('2022-05-18');await expect(page.locator('#c-history-chart + .chart-detail')).toBeVisible();await page.locator('#'+id).fill(date);
   await expect(page.locator('#c-h-error')).not.toBeEmpty();await expect(page.locator('#c-h-value')).toHaveText('—');await expect(page.locator('#c-h-invest')).toHaveText('—');await expect(page.locator('#c-h-profit')).toHaveText('—');await expect(page.locator('#c-h-return')).toHaveText('—');await expect(page.locator('#c-h-annual')).toHaveText('—');
   await expect(page.locator('#c-trades tr')).toHaveCount(0);await expect(page.locator('#c-history-chart path')).toHaveCount(0);await expect(page.locator('#c-history-chart + .chart-detail')).toBeHidden();await expect(page.locator('#c-point-date')).toBeDisabled();
   await expect(page.locator('[data-period=all]')).toHaveAttribute('aria-pressed','false');await expect(page.locator('#c-range-custom')).toBeVisible();
  }
 }
});

test('History validates a new UTC day automatically and extends only an end following the latest full week',async({page})=>{
 const state=await setup(page);await expect(page.locator('#c-price-status')).toBeHidden();await openOptions(page);await page.locator('[data-frequency=monthly]').click();await page.locator('#c-start').fill('2021-01-01');await page.locator('#c-end').fill('2021-02-28');await page.locator('[data-frequency=weekly]').click();
 state.priceMode='extended';await page.clock.fastForward(4*DAY);await expect.poll(()=>state.priceRequests).toBe(2);await expect(page.locator('#c-end')).toHaveValue('2026-10-11');expect(await value(page,'c-h-invest')).toBe(84700);
 await page.locator('[data-frequency=monthly]').click();await expect(page.locator('#c-start')).toHaveValue('2021-01-01');await expect(page.locator('#c-end')).toHaveValue('2021-02-28');
});

test('Online recovery during an active quote queues the shared history instead of losing it',async({page})=>{
 const state=await setup(page);await expect(page.locator('#c-price-status')).toBeHidden();await expect(page.locator('#c-refresh')).toBeEnabled();state.holdQuote=true;
 await page.clock.fastForward(60001);await expect.poll(()=>typeof state.releaseQuote).toBe('function');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));});
 expect(state.priceRequests).toBe(1);state.releaseQuote();await expect.poll(()=>state.priceRequests).toBe(2);await expect(page.locator('#c-refresh')).toBeEnabled();await expect(page.locator('#c-history-status')).toBeHidden();
});

test('A slow valid history survives the old eight-second limit, and a publication lag stays visibly pending',async({page})=>{
 const state=await setup(page,{mode:'ok',requests:0,holdPrices:true});await expect.poll(()=>typeof state.releasePrices).toBe('function');await page.clock.fastForward(19000);state.releasePrices();await expect(page.locator('#c-refresh')).toBeEnabled();await expect(page.locator('#c-price-status')).toBeHidden();
 await page.clock.fastForward(DAY);await expect(page.locator('#c-history-status')).toContainText('尚未到最新日期');await expect(page.locator('#c-price-status')).toContainText('尚未到最新日期');await expect(page.locator('#c-history-method-range')).toContainText('现有连续日历史已核对');await expect(page.locator('#c-history-method-range')).not.toContainText('初始价格快照');expect(await value(page,'c-h-invest')).toBe(84600);
 await page.clock.fastForward(600001);await expect.poll(()=>state.priceRequests).toBe(3);await expect(page.locator('#c-refresh')).toBeEnabled();await page.clock.fastForward(600001);expect(state.priceRequests).toBe(3);
 state.priceMode='next-day';await openMarket(page);await page.locator('#c-refresh').click();await expect(page.locator('#c-price-status')).toBeHidden();await expect(page.locator('#c-market-range')).toContainText('2026-10-08');
});

test('History provenance follows the derived stale state before its next source check',async({page})=>{
 await setup(page);await expect(page.locator('#c-history-status')).toBeHidden();await expect(page.locator('#c-history-method-range')).toContainText('已核对最新完整日历史');
 await page.clock.setSystemTime(new Date(NOW+DAY));await page.locator('[data-frequency=monthly]').click();
 await expect(page.locator('#c-history-status')).toContainText('参考价格待更新');await expect(page.locator('#c-history-method-range')).toContainText('参考日期待更新');await expect(page.locator('#c-history-method-range')).not.toContainText('已核对最新');await expect(page.locator('#c-history-method-range')).toContainText('2026-10-07');
});

test('Exact historical dates preserve the interval and count only complete weekly or monthly cycles',async({page})=>{
 await setup(page);await page.locator('#c-start').fill('2022-05-18');await page.locator('#c-end').fill('2022-06-01');
 await expect(page.locator('#c-start')).toHaveValue('2022-05-18');await expect(page.locator('#c-end')).toHaveValue('2022-06-01');
 const row=periods('weekly').find(row=>row.period==='2022-05-23');
 const finalValue=99.9/row.buyPrice*row.valuePrice;
 expect(await value(page,'c-h-invest')).toBe(100);expect(await value(page,'c-h-value')).toBeCloseTo(finalValue,2);
 expect(await percentValue(page,'c-h-return')).toBeCloseTo((finalValue/100-1)*100,2);expect(await percentValue(page,'c-h-annual')).toBeCloseTo((Math.pow(finalValue/100,365/7)-1)*100,2);
 await expect(page.locator('#c-h-annual-label')).toContainText('折算年化回报率');await expect(page.locator('#c-h-annual-hint')).toBeVisible();await expect(page.locator('#c-h-annual-hint')).toContainText('不足一年');
 await expect(page.locator('#c-trades tr')).toHaveCount(1);await expect(page.locator('#c-trades tr')).toContainText('2022-05-23');
 await expect(page.locator('#c-h-period')).toContainText('2022-05-23 — 2022-05-29');
 expect(await page.locator('#c-trades td').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
 await page.locator('[data-frequency=monthly]').click();await page.locator('#c-start').fill('2022-05-18');await page.locator('#c-end').fill('2022-06-01');
 await expect(page.locator('#c-h-error')).toContainText('没有完整的月周期');await expect(page.locator('#c-h-value')).toHaveText('—');await expect(page.locator('#c-h-return')).toHaveText('—');await expect(page.locator('#c-h-annual')).toHaveText('—');await expect(page.locator('#c-trades tr')).toHaveCount(0);
 await page.locator('#c-end').fill('2022-06-30');expect(await value(page,'c-h-invest')).toBe(100);await expect(page.locator('#c-trades tr')).toContainText('2022-06-01');
 await page.locator('[data-frequency=weekly]').click();await expect(page.locator('#c-start')).toHaveValue('2022-05-18');await expect(page.locator('#c-end')).toHaveValue('2022-06-01');
 await expect(page.locator('#c-panel-history .history-results .result-label')).toContainText('参考模拟');await page.locator('#c-start').fill('');await expect(page.locator('#c-h-value')).toHaveText('—');await expect(page.locator('#c-point-date')).toBeDisabled();
});
