// Optional: regenerate the 1200 x 630 site share image from the selected assets.
// Run after npm ci and npx playwright install chromium.
const fs=require('fs'),path=require('path'),{chromium}=require('@playwright/test');
const root=path.resolve(__dirname,'..');
const uri=(file,mime)=>'data:'+mime+';base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.MANTOU_CHROMIUM_PATH?{executablePath:process.env.MANTOU_CHROMIUM_PATH}:{}),args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.setContent('<html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#fffaf1;color:#292824;font-family:"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif}.scene{position:absolute;left:480px;top:75px;width:720px;height:480px;object-fit:contain}.copy{position:absolute;left:60px;top:166px;width:385px}.logo{width:305px;height:auto}h1{font-size:36px;line-height:1.5;letter-spacing:-1px;margin:30px 0 16px}p{font-size:16px;color:#6b6258;margin:0}</style><img class="scene" src="'+uri('static/images/identity/comic-book-v3-900.webp','image/webp')+'" alt=""><div class="copy"><img class="logo" src="'+uri('static/images/identity/mantou-wordmark-ink.svg','image/svg+xml')+'" alt="mantou"><h1>知不足而奋进，<br>望远山而前行。</h1><p>投资 · 阅读 · 实践</p></div></html>');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.complete?Promise.resolve():new Promise(r=>{x.onload=r;x.onerror=r}))));
  await page.screenshot({path:path.join(root,'static/images/mantou-social.jpg'),type:'jpeg',quality:90});
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1});
