const {test,expect}=require('@playwright/test');
const fixture=require('../../data/dca.json');
const NOW=Date.UTC(2026,9,8,8);
const candleRows=fixture.monthly.map(r=>[r.time,r.open,0,0,r.close,0,r.end]);
async function setup(page,state={mode:'ok',requests:0}) {
  await page.clock.install({time:new Date(NOW)});
  await page.route('https://data-api.binance.vision/**',async route=>{
    const url=route.request().url();
    if(state.mode==='fail')return route.abort();
    if(url.includes('klines'))return route.fulfill({json:candleRows});
    state.requests++;
    return route.fulfill({json:{...fixture.quote,lastPrice:'84000',closeTime:state.mode==='stale'?NOW-180000:await page.evaluate(()=>Date.now())}});
  });
  await page.goto('/dca/');
  await expect(page.locator('#c-h-invest')).toHaveText('10,500.00');
  return state;
}
const value=async(page,id)=>Number((await page.locator('#'+id).textContent()).replace(/[$,]/g,''));

test('DCA actual monthly data, date boundaries, fees, and compound scenarios',async({page})=>{
 await setup(page);
 const expected=fixture.monthly.reduce((qty,r)=>qty+99.9/r.open,0)*fixture.monthly.at(-1).close;
 expect(await value(page,'c-h-value')).toBeCloseTo(expected,2);
 await page.locator('[data-period=down]').click();expect(await value(page,'c-h-profit')).toBeLessThan(0);
 await expect(page.locator('#c-trades tr')).toHaveCount(14);
 await page.locator('#c-start').selectOption('2026-09');await expect(page.locator('#c-h-error')).toContainText('不能');await expect(page.locator('#c-h-value')).toHaveText('—');
 await page.locator('#c-start').selectOption('2018-01');await page.locator('#c-end').selectOption('2018-01');await page.locator('#c-fee').fill('1');
 expect(await value(page,'c-h-value')).toBeCloseTo(99/fixture.monthly[0].open*fixture.monthly[0].close,2);
 await page.locator('#c-fee').fill('');await expect(page.locator('#c-h-value')).toHaveText('—');
 await page.locator('[data-rate="0"]').click();expect(await value(page,'c-f-value')).toBe(13000);
 await page.locator('[data-rate="-5"]').click();expect(await value(page,'c-f-profit')).toBeLessThan(0);await expect(page.locator('#c-f-composition')).toContainText('模拟损失');
 await page.locator('[data-rate="5"]').click();const rate=Math.pow(1.05,1/12)-1;expect(await value(page,'c-f-value')).toBeCloseTo(1000*Math.pow(1+rate,120)+100*(Math.pow(1+rate,120)-1)/rate,2);
 await page.locator('#c-principal').fill('0');await page.locator('#c-add').fill('0');await expect(page.locator('#c-f-composition')).toContainText('尚未投入');
});

test('DCA quote failure, stale response and recovery preserve honest states',async({page})=>{
 const state=await setup(page,{mode:'fail',requests:0});
 await expect(page.locator('#c-quote-status')).toContainText('更新失败');await expect(page.locator('#c-history-status')).toContainText('历史更新未成功');
 state.mode='stale';await page.locator('#c-refresh').click();await expect(page.locator('#c-quote-status')).toContainText('已过期');
 state.mode='ok';await page.locator('#c-refresh').click();await expect(page.locator('#c-quote-status')).toContainText('行情已更新');await expect(page.locator('#c-quote')).toHaveText('84,000.00 USDT');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));});await expect(page.locator('#c-quote-status')).toContainText('离线');
 await page.evaluate(()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));});await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
});

test('DCA polls every minute and pauses while hidden',async({page})=>{
 const state=await setup(page);await expect(page.locator('#c-quote-status')).toContainText('行情已更新');
 const before=state.requests;await page.clock.fastForward(60001);await expect.poll(()=>state.requests).toBeGreaterThan(before);
 await expect(page.locator('#c-refresh')).toBeEnabled();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const paused=state.requests;await page.clock.fastForward(180000);expect(state.requests).toBe(paused);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await expect.poll(()=>state.requests).toBeGreaterThan(paused);
});

test('DCA navigation, Chinese tool bridge, themes and mobile layouts',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await setup(page);
 for(const width of [320,390,820,1440]){
  await page.setViewportSize({width,height:1000});
  for(const theme of ['light','dark']){await page.evaluate(t=>document.body.setAttribute('theme',t),theme);await expect(page.locator('h1')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);}
 }
 await page.goto('/');await expect(page.locator('[data-home-dca] a').first()).toHaveAttribute('href','/dca/');
 await page.goto('/en/dca/');await expect(page.getByRole('link',{name:'Open the interactive notebook (中文)'})).toHaveAttribute('href','/dca/');expect(errors).toEqual([]);
});
