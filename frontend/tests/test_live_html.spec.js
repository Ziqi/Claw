import { test, expect } from '@playwright/test';
test('test HTML dump', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);
    const html = await page.content();
    console.log("HTML START\n" + html + "\nHTML END");
});
