const {test,expect}=require('@playwright/test');
const fixture=require('../../data/dca.json');
const priceFixture=require('../../data/btcprices.json');
const priceResponse=()=>({data:priceFixture.daily.map(([date,price])=>({asset:'btc',time:date+'T00:00:00.000000000Z',PriceUSD:String(price)}))});
const NOW=Date.UTC(2026,9,8,10);
const periods=kind=>fixture[kind].filter(r=>!r.partial);
const candles=kind=>fixture[kind].map(r=>[r.time,r.open,0,0,r.close,0,r.end]);
async function setup(page,state={mode:'ok',requests:0}) {
 await page.clock.install({time:new Date(NOW)});
 await page.route('https://community-api.coinmetrics.io/**',async route=>{
  state.priceRequests=(state.priceRequests||0)+1;
  const mode=state.priceMode||state.mode;
  if(mode==='fail')return route.abort();
  const raw=priceResponse();if(mode==='gap')raw.data.splice(10,1);
  return route.fulfill({json:raw});
 });
 await page.route('https://data-api.binance.vision/**',async route=>{
  const url=route.request().url();
  if(state.mode==='fail')return route.abort();
  if(url.includes('klines'))return route.fulfill({json:candles(url.includes('interval=1w')?'weekly':'monthly')});
  state.requests++;return route.fulfill({json:{...fixture.quote,lastPrice:'84000',closeTime:state.mode==='stale'?NOW-180000:await page.evaluate(()=>Date.now())}});
 });
 await page.goto('/dca/');await expect(page.locator('#c-tab-future')).toHaveAttribute('aria-selected','true');await page.locator('#c-tab-history').click();await expect(page.locator('#c-h-invest')).toHaveText((periods('weekly').length*100).toLocaleString('en-US',{minimumFractionDigits:2}));return state;
}
const value=async(page,id)=>Number((await page.locator('#'+id).textContent()).replace(/[$,]/g,''));
const openOptions=async page=>{if(!await page.locator('#c-options').getAttribute('open'))await page.locator('#c-options>summary').click();};

test('Weekly DCA uses Monday opens, fees, complete weeks and preserves separate monthly ranges',async({page})=>{
 await setup(page);const weekly=periods('weekly');
 const expected=weekly.reduce((qty,r)=>qty+99.9/r.open,0)*weekly.at(-1).close;
 expect(await value(page,'c-h-value')).toBeCloseTo(expected,2);
 await expect(page.locator('#c-schedule')).toContainText('每周一 08:00');
 await expect(page.locator('#c-trades tr')).toHaveCount(weekly.length);
 await openOptions(page);await expect(page.locator('#c-start option').first()).toHaveValue('2017-08-21');
 await page.locator('#c-start').selectOption('2020-12-28');await page.locator('#c-end').selectOption('2021-01-04');
 await page.locator('#c-fee').fill('1');
 const two=weekly.filter(r=>['2020-12-28','2021-01-04'].includes(r.period));
 expect(await value(page,'c-h-value')).toBeCloseTo(two.reduce((sum,r)=>sum+99/r.open,0)*two.at(-1).close,2);
 expect(await value(page,'c-h-invest')).toBe(200);await expect(page.locator('#c-trades tr')).toHaveCount(2);
 await page.locator('[data-frequency=monthly]').click();await expect(page.locator('#c-schedule')).toContainText('每月 1 日');
 await expect(page.locator('#c-monthly')).toHaveValue('100');expect(await value(page,'c-h-invest')).toBe(periods('monthly').length*100);
 await page.locator('#c-start').selectOption('2021-01');await page.locator('#c-end').selectOption('2021-02');
 await page.locator('[data-frequency=weekly]').click();await expect(page.locator('#c-start')).toHaveValue('2020-12-28');await expect(page.locator('#c-end')).toHaveValue('2021-01-04');
 await page.locator('#c-start').selectOption('2021-01-11');await expect(page.locator('#c-h-error')).toContainText('不能');await expect(page.locator('#c-h-value')).toHaveText('—');
 await page.locator('#c-start').selectOption('2021-01-04');expect(await value(page,'c-h-value')).toBeCloseTo(99/two[1].open*two[1].close,2);
 await page.locator('#c-monthly').fill('');await expect(page.locator('#c-h-value')).toHaveText('—');await expect(page.locator('#c-history-chart')).not.toHaveAttribute('tabindex','0');await expect(page.locator('#c-history-chart + .chart-detail')).not.toBeVisible();
});

test('Monthly calculation and independent compound zero/negative scenarios remain correct',async({page})=>{
 await setup(page);await page.locator('[data-frequency=monthly]').click();await openOptions(page);
 const rows=periods('monthly');expect(await value(page,'c-h-value')).toBeCloseTo(rows.reduce((sum,r)=>sum+99.9/r.open,0)*rows.at(-1).close,2);
 await page.locator('[data-period=down]').click();expect(await value(page,'c-h-profit')).toBeLessThan(0);await expect(page.locator('#c-trades tr')).toHaveCount(14);
 await page.locator('#c-tab-future').click();await page.locator('[data-compound-frequency=monthly]').click();await page.locator('[data-rate="0"]').click();expect(await value(page,'c-f-value')).toBe(13000);
 await page.locator('[data-rate="-5"]').click();expect(await value(page,'c-f-profit')).toBeLessThan(0);await expect(page.locator('#c-f-composition')).toContainText('模拟损失');
 await page.locator('[data-rate="5"]').click();const rate=Math.pow(1.05,1/12)-1;expect(await value(page,'c-f-value')).toBeCloseTo(1000*Math.pow(1+rate,120)+100*(Math.pow(1+rate,120)-1)/rate,2);
 await page.locator('#c-principal').fill('0');await page.locator('#c-add').fill('0');await expect(page.locator('#c-f-composition')).toContainText('尚未投入');
});

test('Maximum dollar price history starts in 2010 and retains early precision on a logarithmic chart',async({page})=>{
 await setup(page);await page.locator('#c-tab-market').click();
 await expect(page.locator('#c-market-range')).toContainText('2010-07-18');await expect(page.locator('#c-market-range')).toContainText('2026-10-07');await expect(page.locator('[data-market="0"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#c-market-chart [data-year-tick]').first()).toHaveText('2010');await expect(page.locator('#c-market-chart [data-year-tick]').last()).toHaveText('2026');await expect(page.locator('#c-market-chart')).toContainText('USD/BTC');await expect(page.locator('#c-market-chart')).toContainText('0.01');await expect(page.locator('#c-panel-market .panel-context').first()).toContainText('对数刻度');
 const full=await page.locator('#c-market-chart path').last().getAttribute('d');
 await page.locator('[data-market="1"]').click();await expect(page.locator('#c-market-range')).toContainText('近 1 年');expect(await page.locator('#c-market-chart path').last().getAttribute('d')).not.toBe(full);
 await page.locator('[data-market="0"]').click();expect(await page.locator('#c-market-chart path').last().getAttribute('d')).toBe(full);
 expect(full).not.toMatch(/NaN|Infinity/);
 await page.locator('#c-market-chart').focus();await page.keyboard.press('Home');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2010-07-18');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('0.08584 USD/BTC');
 await page.keyboard.press('ArrowRight');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2010-07-19');await page.keyboard.press('End');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('83,273.72 USD/BTC');
});

test('Dollar price history failure and missing days preserve the snapshot independently of USDT quotes and DCA',async({page})=>{
 const state=await setup(page,{mode:'ok',priceMode:'fail',requests:0});await page.locator('#c-tab-market').click();
 await expect(page.locator('#c-price-status')).toContainText('更新未成功');await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
 const original=await page.locator('#c-market-chart path').last().getAttribute('d');
 state.priceMode='gap';await page.locator('#c-refresh').click();await expect(page.locator('#c-refresh')).toBeEnabled();await expect(page.locator('#c-price-status')).toContainText('更新未成功');expect(await page.locator('#c-market-chart path').last().getAttribute('d')).toBe(original);
 state.priceMode='ok';await page.locator('#c-refresh').click();await expect(page.locator('#c-price-status')).toBeHidden();
 const requests=state.priceRequests;await page.clock.fastForward(60001);await expect.poll(()=>state.requests).toBeGreaterThan(2);expect(state.priceRequests).toBe(requests);
 await page.locator('#c-tab-history').click();await openOptions(page);await expect(page.locator('#c-start option').first()).toHaveValue('2017-08-21');expect(await value(page,'c-h-invest')).toBe(periods('weekly').length*100);
});

test('DCA quote failure, stale response and recovery preserve honest states',async({page})=>{
 const state=await setup(page,{mode:'fail',requests:0});await expect(page.locator('#c-history-status')).toContainText('历史更新未成功');await page.locator('#c-tab-market').click();
 await expect(page.locator('#c-quote-status')).toContainText('更新失败');state.mode='stale';await page.locator('#c-refresh').click();await expect(page.locator('#c-quote-status')).toContainText('已过期');
 state.mode='ok';await page.locator('#c-refresh').click();await expect(page.locator('#c-quote-status')).toContainText('行情已更新');await expect(page.locator('#c-quote')).toHaveText('84,000.00 USDT');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));});await expect(page.locator('#c-quote-status')).toContainText('离线');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));});await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
});

test('DCA polls every minute and pauses while hidden',async({page})=>{
 const state=await setup(page);await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
 const before=state.requests;await page.clock.fastForward(60001);await expect.poll(()=>state.requests).toBeGreaterThan(before);await expect(page.locator('#c-refresh')).toBeEnabled();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const paused=state.requests;await page.clock.fastForward(180000);expect(state.requests).toBe(paused);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>state.requests).toBeGreaterThan(paused);
});

test('Result-first mobile layout, all tabs, keyboard navigation and themes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});
  for(const theme of ['light','dark']){
   await page.evaluate(t=>document.body.setAttribute('theme',t),theme);
   for(const panel of ['history','future','market']){await page.locator('#c-tab-'+panel).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);await expect(page.locator('#c-panel-'+panel)).toBeVisible();}
  }
 }
 await page.setViewportSize({width:390,height:1000});await page.locator('#c-tab-history').click();const result=await page.locator('#c-h-value').boundingBox(),chart=await page.locator('#c-history-chart').boundingBox();expect(result.y).toBeLessThan(chart.y);
 await page.locator('#c-tab-history').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('#c-tab-future')).toBeFocused();await expect(page.locator('#c-panel-future')).toBeVisible();
 await page.goto('/');await expect(page.locator('[data-home-dca] a').first()).toHaveAttribute('href','/dca/');await page.goto('/en/dca/');await expect(page.getByRole('link',{name:'Open the interactive notebook (中文)'})).toHaveAttribute('href','/dca/');expect(errors).toEqual([]);
});


test('Compound weekly/monthly frequency uses effective annual return and independent inputs',async({page})=>{
 await setup(page);await page.locator('#c-tab-future').click();
 await expect(page.locator('[data-compound-frequency=weekly]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#c-years').fill('1');await page.locator('[data-rate="0"]').click();
 expect(await value(page,'c-f-invest')).toBe(6200);expect(await value(page,'c-f-value')).toBe(6200);
 await expect(page.locator('#c-f-period')).toContainText('52 次');
 await page.locator('[data-compound-frequency=monthly]').click();expect(await value(page,'c-f-value')).toBe(2200);await expect(page.locator('#c-add')).toHaveValue('100');
 await page.locator('#c-add').fill('0');await page.locator('[data-rate="5"]').click();expect(await value(page,'c-f-value')).toBeCloseTo(1050,2);
 await page.locator('[data-compound-frequency=weekly]').click();expect(await value(page,'c-f-value')).toBeCloseTo(1050,2);
 await page.locator('#c-add').fill('100');await page.locator('[data-rate="-5"]').click();expect(await value(page,'c-f-profit')).toBeLessThan(0);
 await page.locator('#c-tab-history').click();await page.locator('[data-frequency=monthly]').click();await page.locator('#c-tab-future').click();await expect(page.locator('[data-compound-frequency=weekly]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#c-principal').fill('');await expect(page.locator('#c-f-value')).toHaveText('—');await expect(page.locator('#c-f-error')).toContainText('每次投入');await page.locator('#c-future-chart').dispatchEvent('focus');await page.locator('#c-future-chart').dispatchEvent('keydown',{key:'Home'});await expect(page.locator('#c-future-chart + .chart-detail')).not.toBeVisible();await expect(page.locator('#c-future-chart')).not.toHaveAttribute('tabindex','0');
});

test('Quiet default presentation preserves important context and reveals graph details on demand',async({page})=>{
 await setup(page);await page.setViewportSize({width:390,height:844});await page.locator('#c-tab-future').click();
 await expect(page.locator('[role=tab]').first()).toHaveText('复利模拟');
 await expect(page.locator('#c-panel-future .panel-context')).toContainText('非收益预测');
 await expect(page.locator('#c-f-schedule')).toContainText('52 次');
 await expect(page.locator('#c-f-composition')).not.toBeVisible();await expect(page.locator('#c-future-chart + .chart-detail')).not.toBeVisible();
 await page.locator('#c-future-chart').focus();await page.keyboard.press('Home');await expect(page.locator('#c-future-chart + .chart-detail')).toBeVisible();await expect(page.locator('#c-future-chart + .chart-detail')).toContainText('现在');
 const valueBox=await page.locator('#c-f-value').boundingBox(),chartBox=await page.locator('#c-future-chart').boundingBox();expect(valueBox.y).toBeLessThan(chartBox.y);
 await page.locator('#c-tab-history').click();await expect(page.locator('[data-period=down]')).toBeVisible();await expect(page.locator('#c-panel-history .budget-note')).toBeVisible();await expect(page.locator('#c-h-detail')).not.toBeVisible();
});

test('Expanded price history adapts to phone landscape and preserves range, selection, focus and scroll when native fullscreen fails',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
 await page.setViewportSize({width:390,height:844});await page.locator('#c-tab-market').click();
 await page.evaluate(()=>{document.getElementById('c-price-screen').requestFullscreen=()=>Promise.reject(new Error('Fullscreen unavailable'));});
 await page.locator('[data-market="5"]').click();await page.locator('#c-market-chart').focus();await page.keyboard.press('Home');
 const selected=await page.locator('#c-market-chart + .chart-detail').textContent();
 await page.locator('#c-expand').scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);
 await page.locator('#c-expand').click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#c-collapse')).toBeFocused();
 await expect(page.locator('#c-market-chart + .chart-detail')).toHaveText(selected);await expect(page.locator('[data-market="5"]')).toHaveAttribute('aria-pressed','true');
 expect((await page.locator('#c-market-chart').boundingBox()).height).toBeGreaterThan(400);
 // The modal traps focus and keeps the original tab controls inert.
 await page.keyboard.press('Shift+Tab');await expect(page.locator('#c-tab-market')).not.toBeFocused();
 await page.setViewportSize({width:844,height:390});await page.locator('[data-market="0"]').click();
 await expect(page.locator('#c-market-range')).toContainText('2010-07-18');await expect(page.locator('#c-price-dialog .panel-context')).toContainText('对数刻度');
 await expect.poll(async()=>Number((await page.locator('#c-market-chart').getAttribute('viewBox')).split(' ')[2])).toBeGreaterThan(780);
 const chart=page.locator('#c-market-chart'),box=await chart.boundingBox();expect(box.height).toBeGreaterThan(170);
 const tickBoxes=await chart.locator('[data-year-tick]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right};}));
 expect(tickBoxes.length).toBeGreaterThanOrEqual(7);for(let i=1;i<tickBoxes.length;i++)expect(tickBoxes[i].left-tickBoxes[i-1].right).toBeGreaterThan(8);
 await chart.click({position:{x:52,y:30}});await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2010-07-18 · 价格 0.08584 USD/BTC');
 await chart.click({position:{x:box.width-13,y:30}});await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2026-10-07');
 const inspected=await page.locator('#c-market-chart + .chart-detail').textContent();
 await page.evaluate(()=>document.body.setAttribute('theme','dark'));await expect(page.locator('#c-market-chart + .chart-detail')).toHaveText(inspected);
 const before=await page.locator('#c-market-chart').getAttribute('viewBox');await page.clock.fastForward(60001);await expect(page.locator('#c-market-chart + .chart-detail')).toHaveText(inspected);expect(await chart.getAttribute('viewBox')).toBe(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.setViewportSize({width:390,height:844});await expect.poll(async()=>Number((await chart.getAttribute('viewBox')).split(' ')[2])).toBeLessThan(400);
 await page.locator('#c-collapse').click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 await expect(page.locator('#c-market-chart + .chart-detail')).toHaveText(inspected);await expect(page.locator('[data-market="0"]')).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>scrollY)).toBeCloseTo(scroll,0);expect(await page.evaluate(()=>document.documentElement.style.overflow)).toBe('');
 await page.locator('#c-expand').click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 await page.locator('#c-tab-future').click();await expect(page.locator('[data-compound-frequency=weekly]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#c-add')).toHaveValue('100');
 expect(errors).toEqual([]);
});

test('Browser fullscreen exit restores the same price chart and normal page controls',async({page})=>{
 await setup(page);await page.locator('#c-tab-market').click();await page.locator('[data-market="1"]').click();await page.locator('#c-expand').click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe('c-price-screen');
 await page.evaluate(()=>document.exitFullscreen());await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 await expect(page.locator('[data-market="1"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#c-market-home #c-market-chart')).toBeVisible();
 await page.locator('#c-expand').click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id)).toBe('c-price-screen');
 await page.locator('#c-collapse').click();await expect.poll(()=>page.evaluate(()=>document.fullscreenElement)).toBeNull();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.locator('#c-tab-history').click();await expect(page.locator('[data-frequency=weekly]')).toHaveAttribute('aria-pressed','true');
});

test('A late fullscreen grant after closing cannot leave an empty fullscreen view',async({page})=>{
 await setup(page);await page.locator('#c-tab-market').click();
 await page.evaluate(()=>{
  let element=null;window.lateFullscreenExitCount=0;
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>element});
  document.exitFullscreen=async()=>{element=null;window.lateFullscreenExitCount++;document.dispatchEvent(new Event('fullscreenchange'));};
  document.getElementById('c-price-screen').requestFullscreen=()=>new Promise(resolve=>{window.grantLateFullscreen=()=>{element=document.getElementById('c-price-screen');document.dispatchEvent(new Event('fullscreenchange'));resolve();};});
 });
 await page.locator('#c-expand').click();await page.locator('#c-collapse').click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.evaluate(()=>window.grantLateFullscreen());await expect.poll(()=>page.evaluate(()=>window.lateFullscreenExitCount)).toBe(1);
 await expect(page.locator('#c-market-home #c-market-chart')).toBeVisible();await expect(page.locator('#c-expand')).toBeFocused();
 expect(await page.evaluate(()=>document.fullscreenElement)).toBeNull();
});
