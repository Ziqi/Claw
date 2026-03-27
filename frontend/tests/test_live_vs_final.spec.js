import { test, expect } from '@playwright/test';
test('test live VS switch 5', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push('PAGE: ' + e));
    page.on('console', msg => {
        if(msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
        console.log(`[${msg.type()}] ${msg.text()}`);
    });
    
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);
    
    console.log("Looking for buttons...");
    const btns = await page.$$('button.nav-item');
    for(let btn of btns) {
        const text = await btn.evaluate(node => node.innerText);
        if(text.includes('全域')) {
            console.log("Found VS button, clicking...");
            await btn.click();
            break;
        }
    }
    
    await page.waitForTimeout(2000);
    console.log("--- ERRORS DUMP ---");
    errors.forEach(e => console.log(e));
    await page.screenshot({ path: '/Users/xiaoziqi/.gemini/antigravity/brain/3386a705-10d7-4465-b7fb-936434e79c7b/_after_click.png' });
});
