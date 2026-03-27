import { test, expect } from '@playwright/test';
test('test ops click', async ({ page }) => {
    const logs = [];
    page.on('console', msg => { console.log('PAGE LOG:', msg.text()); });
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', req => console.log('FAIL:', req.url(), req.failure().errorText));
    
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);
    
    console.log("Switching to OP tab...");
    const opBtn = page.locator('button', { hasText: '作战' });
    await opBtn.click();
    await page.waitForTimeout(1000);
    
    console.log("Clicking 被动嗅探 action...");
    const btn = page.locator('button', { hasText: '▶ 执行' }).first();
    await btn.click();
    
    console.log("Waiting for network and UI to settle...");
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: '/Users/xiaoziqi/.gemini/antigravity/brain/3386a705-10d7-4465-b7fb-936434e79c7b/_after_ops_click.png' });
});
