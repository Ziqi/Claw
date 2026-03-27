import { test, expect } from '@playwright/test';
test('test live VS switch 2', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push('PAGE: ' + e));
    page.on('console', msg => {
        if(msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
        console.log(`[${msg.type()}] ${msg.text()}`);
    });
    
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1500);
    
    const vsBtn = page.locator('button', { hasText: '全域' });
    if(await vsBtn.isVisible()) {
        console.log("Clicking VS 全域...");
        await vsBtn.click();
        await page.waitForTimeout(2000);
    } else {
        console.log("VS btn not visible");
    }
    
    console.log("--- ERRORS DUMP ---");
    errors.forEach(e => console.log(e));
});
