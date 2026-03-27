import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Looking for buttons...");
  const btns = await page.$$eval('button.nav-item', els => els.map(e => e.innerText));
  console.log("Buttons found:", btns.join(' | ').replace(/\n/g, ''));
  
  const buttons = await page.$$('button.nav-item');
  for(let btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if(text.includes('全域')) {
          console.log("Clicking", text.replace(/\n/g, ''));
          await btn.click();
          break;
      }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  console.log("Done checking.");
  await page.screenshot({ path: '/Users/xiaoziqi/.gemini/antigravity/brain/3386a705-10d7-4465-b7fb-936434e79c7b/_after_click.png' });
  await browser.close();
})();
