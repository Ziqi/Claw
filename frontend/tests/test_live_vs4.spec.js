import { test, expect } from '@playwright/test';
import fs from 'fs';
test('dump HTML', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(3000);
    const html = await page.content();
    fs.writeFileSync('live_dom.html', html);
});
