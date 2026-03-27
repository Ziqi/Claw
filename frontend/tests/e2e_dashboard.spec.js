import { test, expect } from '@playwright/test';

test.describe('CLAW V8.2 Dashboard Physical UI Integrity', () => {
    test('Zustand Rendering Pipeline Stability Test', async ({ page }) => {
        page.on('pageerror', exception => {
            console.log(`Uncaught exception: "${exception}"`);
        });
        page.on('console', msg => {
            if (msg.type() === 'error') console.log(`Error log: "${msg.text()}"`);
        });
        // 1. Initial Load Test
        await page.goto('/');
        
        // Assert the framework boots without White-Screen-of-Death
        await expect(page.locator('button, input, select').first()).toBeVisible({ timeout: 15000 });
        
        // 2. Sidebar Navigation Stress Test (Render Cache Check)
        // Locate primary navigation text elements or icons avoiding rigid text strings
        const interactables = [
            page.locator('.sidebar-item').first(),
            page.locator('.sidebar-item').nth(1),
            page.locator('.sidebar-item').nth(2),
            page.locator('.stat-item').first()
        ];
        
        for (const element of interactables) {
            if (await element.isVisible().catch(()=>false)) {
                await element.click({ force: true }).catch(()=>null);
                // Wait for React to complete Reconciliation via Zustand state propagation
                await page.waitForTimeout(100); 
            }
        }
        
        // 3. AI Agent Side Panel WebSocket Drawer Initiation
        const aiButton = page.locator('text=AI 驻场渗透');
        if (await aiButton.isVisible()) {
            await aiButton.click();
            
            // The Sliding Drawer (AiPanel) must appear
            const chatInput = page.locator('input[placeholder*="输入你的战术意图"]');
            await expect(chatInput).toBeVisible({ timeout: 2000 });
        }
        
        // 4. Validate Top Navbar "Environment" selector doesn't break
        const envSelector = page.locator('.env-dropdown, select, button').filter({ hasText: /default|环境/i }).first();
        if (await envSelector.isVisible()) {
          await envSelector.click();
        }
    });
});
