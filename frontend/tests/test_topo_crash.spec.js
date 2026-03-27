import { test, expect } from '@playwright/test';
test('test topo crash', async ({ page }) => {
    const logs = [];
    page.on('console', msg => logs.push(msg.type() + ': ' + msg.text()));
    page.on('pageerror', err => logs.push('PAGE_ERROR: ' + err.message));
    
    // Navigate
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Switch to Topology tab
    const vsTab = page.locator('button', { hasText: '星图拓扑 (Network)' });
    await vsTab.click();
    
    await page.waitForTimeout(1000);
    
    // Dump logs
    console.log("--- BROWSER LOGS ---");
    logs.forEach(l => console.log(l));
    console.log("--------------------");
    
    await page.screenshot({ path: 'topo_crash.png' });
});
