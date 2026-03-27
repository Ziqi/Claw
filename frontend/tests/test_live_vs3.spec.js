import { test, expect } from '@playwright/test';
test('test live VS switch 3', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push('PAGE: ' + e));
    page.on('console', msg => {
        if(msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
        console.log(`[${msg.type()}] ${msg.text()}`);
    });
    
    await page.goto('http://localhost:5173/');
    console.log("Waiting for network idle...");
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(e => console.log("idle timeout"));
    
    console.log("Waiting for nav bar...");
    await page.waitForSelector('.terminal-tab-bar', { timeout: 10000 }).catch(e => console.log("nav bar not found"));
    
    const html = await page.content();
    console.log("HTML length:", html.length);
    if(html.length < 1000) console.log(html);
    
    const vsBtn = page.locator('button', { hasText: '全域' });
    if(await vsBtn.isVisible()) {
        console.log("Clicking VS 全域...");
        await vsBtn.click();
        await page.waitForTimeout(2000);
    } else {
        console.log("VS btn STILL not visible");
    }
    
    console.log("--- ERRORS DUMP ---");
    errors.forEach(e => console.log(e));
});
