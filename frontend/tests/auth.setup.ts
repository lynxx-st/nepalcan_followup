import { test as setup } from '@playwright/test';
import { Page } from '@playwright/test';

const authFile = 'tests/.auth/user.json';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('sabeen684@gmail.com');
  await page.locator('input[type="password"]').fill('Password@12');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/today', { timeout: 10000 });
}

setup('authenticate', async ({ page }) => {
  await login(page);
  await page.context().storageState({ path: authFile });
});
