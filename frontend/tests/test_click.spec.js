import { test, expect } from '@playwright/test';
test('test click theater', async ({ page }) => {
    // Navigate
    await page.goto('/');
    
    // Check initial state
    await page.waitForTimeout(1000); // let fetch finish
    await page.screenshot({ path: 'before_click.png' });

    // Click on the text 'GhostTheater' or '战区'
    const theaterToggle = page.locator('div', { hasText: '战区' })
                              .filter({ has: page.locator('span', { hasText: 'GhostTheater' }) })
                              .first();
    await theaterToggle.click({ force: true });
    
    // Wait for dropdown
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'after_click.png' });
    
    // Check if dropdown is visible by looking for default inside
    const defaultItem = page.locator('div', { hasText: 'default' }).last();
    console.log("Is dropdown default visible?", await defaultItem.isVisible());
});
