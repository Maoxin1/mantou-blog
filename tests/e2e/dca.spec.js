const {test,expect}=require('@playwright/test');
const fixture=require('../../data/dca.json');
const NOW=Date.UTC(2026,9,8,10);
const periods=kind=>fixture[kind].filter(r=>!r.partial);
const candles=kind=>fixture[kind].map(r=>[r.time,r.open,0,0,r.close,0,r.end]);
async function setup(page,state={mode:'ok',requests:0}) {
 await page.clock.install({time:new Date(NOW)});
 await page.route('https://data-api.binance.vision/**',async route=>{
  const url=route.request().url();
  if(state.mode==='fail')return route.abort();
  if(url.includes('klines'))return route.fulfill({json:candles(url.includes('interval=1w')?'weekly':'monthly')});
  state.requests++;return route.fulfill({json:{...fixture.quote,lastPrice:'84000',closeTime:state.mode==='stale'?NOW-180000:await page.evaluate(()=>Date.now())}});
 });
 await page.goto('/dca/');await expect(page.locator('#c-h-invest')).toHaveText((periods('weekly').length*100).toLocaleString('en-US',{minimumFractionDigits:2}));return state;
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
 await page.locator('#c-monthly').fill('');await expect(page.locator('#c-h-value')).toHaveText('—');
});

test('Monthly calculation and independent compound zero/negative scenarios remain correct',async({page})=>{
 await setup(page);await page.locator('[data-frequency=monthly]').click();await openOptions(page);
 const rows=periods('monthly');expect(await value(page,'c-h-value')).toBeCloseTo(rows.reduce((sum,r)=>sum+99.9/r.open,0)*rows.at(-1).close,2);
 await page.locator('[data-period=down]').click();expect(await value(page,'c-h-profit')).toBeLessThan(0);await expect(page.locator('#c-trades tr')).toHaveCount(14);
 await page.locator('#c-tab-future').click();await page.locator('[data-rate="0"]').click();expect(await value(page,'c-f-value')).toBe(13000);
 await page.locator('[data-rate="-5"]').click();expect(await value(page,'c-f-profit')).toBeLessThan(0);await expect(page.locator('#c-f-composition')).toContainText('模拟损失');
 await page.locator('[data-rate="5"]').click();const rate=Math.pow(1.05,1/12)-1;expect(await value(page,'c-f-value')).toBeCloseTo(1000*Math.pow(1+rate,120)+100*(Math.pow(1+rate,120)-1)/rate,2);
 await page.locator('#c-principal').fill('0');await page.locator('#c-add').fill('0');await expect(page.locator('#c-f-composition')).toContainText('尚未投入');
});

test('Maximum price history starts at the earliest trading day and range controls change the series',async({page})=>{
 await setup(page);await page.locator('#c-tab-market').click();
 await expect(page.locator('#c-market-range')).toContainText('2017-08-17');await expect(page.locator('[data-market="0"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#c-market-chart')).toContainText('2017-08-17');
 const full=await page.locator('#c-market-chart path').last().getAttribute('d');
 await page.locator('[data-market="1"]').click();await expect(page.locator('#c-market-range')).toContainText('近 1 年');expect(await page.locator('#c-market-chart path').last().getAttribute('d')).not.toBe(full);
 await page.locator('[data-market="0"]').click();expect(await page.locator('#c-market-chart path').last().getAttribute('d')).toBe(full);
 await page.locator('#c-market-chart').focus();await page.keyboard.press('Home');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('2017-08-17');await expect(page.locator('#c-market-chart + .chart-detail')).toContainText('4,261.48');
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
 await page.locator('#c-tab-history').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#c-tab-future')).toBeFocused();await expect(page.locator('#c-panel-future')).toBeVisible();
 await page.goto('/');await expect(page.locator('[data-home-dca] a').first()).toHaveAttribute('href','/dca/');await page.goto('/en/dca/');await expect(page.getByRole('link',{name:'Open the interactive notebook (中文)'})).toHaveAttribute('href','/dca/');expect(errors).toEqual([]);
});
