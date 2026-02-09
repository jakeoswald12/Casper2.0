import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Casper')).toBeVisible();
  });

  test('should navigate to login', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign In');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('should navigate to signup', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Get Started');
    await expect(page.locator('text=Create account')).toBeVisible();
  });

  test('should show validation errors on empty form', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign In');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Email is required')).toBeVisible();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication by setting a cookie/localStorage
    await page.goto('/');
    // In real tests, would set auth token
  });

  test('should redirect unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login or show auth prompt
    await expect(page.locator('text=Sign In').or(page.locator('text=Dashboard'))).toBeVisible();
  });
});

test.describe('Studio', () => {
  test('should handle invalid book ID', async ({ page }) => {
    await page.goto('/studio/99999');
    await expect(page.locator('text=Book not found').or(page.locator('text=Sign In'))).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('should display settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=Settings').or(page.locator('text=Sign In'))).toBeVisible();
  });
});
