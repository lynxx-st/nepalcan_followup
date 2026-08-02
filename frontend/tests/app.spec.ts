import { test, expect } from '@playwright/test';

const LOGGED_OUT = { storageState: { cookies: [], origins: [] } };

test.describe('Login Flow', () => {
  test.use(LOGGED_OUT);

  test('should load login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('NepalCan Ops');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Login failed')).toBeVisible({ timeout: 5000 });
  });

  test('should log in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'sabeen684@gmail.com');
    await page.fill('input[type="password"]', 'Password@12');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/today', { timeout: 10000 });
    await expect(page.locator('nav')).toBeVisible();
  });
});

test.describe('Dashboard / Today Work', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/today');
  });

  test('should load dashboard page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText("Today's Work Engine");
    await expect(page.locator('text=Smart Queue Active')).toBeVisible();
  });

  test('should show queue cards', async ({ page }) => {
    await expect(page.locator('text=Customer Conf.')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Vendor Action')).toBeVisible();
    await expect(page.locator('text=Logistics Follow-up')).toBeVisible();
  });

  test('should have sync button', async ({ page }) => {
    await expect(page.locator('button:has-text("Sync Orders")')).toBeVisible();
  });
});

test.describe('Orders Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/orders');
  });

  test('should load orders page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Orders');
  });

  test('should show segment tabs', async ({ page }) => {
    await expect(page.locator('button:has-text("Pending Order Confirmation")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Pending Review Calls")')).toBeVisible();
    await expect(page.locator('button:has-text("Confirmed But Not Processed")')).toBeVisible();
    await expect(page.locator('button:has-text("Follow-up of Delivered Calls")')).toBeVisible();
    await expect(page.locator('button:has-text("Marked Done")')).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    await expect(page.locator('main input[placeholder*="Search"]')).toBeVisible();
  });

  test('should navigate between segments', async ({ page }) => {
    const tab = page.locator('button', { hasText: 'Pending Review Calls' }).first();
    await tab.click();
    await expect(tab).toHaveClass(/bg-red-600/);
  });
});

test.describe('Order Detail Page', () => {
  test('should load order detail page', async ({ page }) => {
    await page.goto('/orders');
    const firstOrder = page.locator('main div[class*="cursor-pointer"]').filter({ hasText: 'Rs' }).first();
    await firstOrder.click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/, { timeout: 10000 });
    await expect(page.locator('text=Order not found')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Navigation', () => {
  test('should have navigation links when logged in', async ({ page }) => {
    await page.goto('/today');
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.getByRole('link', { name: "Today's Work" })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();
  });
});

test.describe('Auth Redirect', () => {
  test.use(LOGGED_OUT);

  test('should redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/today');
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });
});

test.describe('Responsive', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/today');
    await expect(page.locator('h1')).toContainText("Today's Work Engine");
  });
});
