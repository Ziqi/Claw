import { test, expect } from '@playwright/test';
test('test live VS switch', async ({ page }) => {
    // Collect all errors
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    page.on('console', msg => {
        if(msg.type() === 'error') errors.push(msg.text());
        console.log(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Go to the local dev server
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);
    
    const vsTab = page.locator('div.nav-item').filter({ hasText: 'VS' });
    if(await vsTab.isVisible()) {
        console.log("Clicking VS tab...");
        await vsTab.click();
        await page.waitForTimeout(2000);
    } else {
        console.log("VS tab not visible, dump HTML body:");
        console.log(await page.content());
    }
    
    console.log("--- ERRORS DUMP ---");
    errors.forEach(e => console.log(e.message || e));
    console.log("--- END ERRORS ---");
});
