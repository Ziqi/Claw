import { test, expect } from '@playwright/test';
test('test live crash', async ({ page }) => {
    const logs = [];
    page.on('console', msg => { logs.push(msg.type() + ': ' + msg.text()); console.log("LIVE LOG:", msg.text()); });
    page.on('pageerror', err => { logs.push('PAGE_ERROR: ' + err.message); console.log("LIVE ERROR:", err.message); });
    
    // Navigate to the exact URL the user has
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);
    
    console.log("Locating topology tab...");
    const vsTab = page.locator('button', { hasText: '星图拓扑 (Network)' });
    
    if (await vsTab.isVisible()) {
        console.log("Clicking topology tab...");
        await vsTab.click();
        await page.waitForTimeout(2000);
    } else {
        console.log("Tab not visible!");
    }
    
    await page.screenshot({ path: 'live_crash.png' });
});
