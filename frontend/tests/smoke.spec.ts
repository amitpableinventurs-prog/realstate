import { expect, test } from '@playwright/test';

test('home page renders the Bhumi Bazar experience', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Bhumi|BuildEstate/i);
  await expect(page.locator('body')).toContainText(/property|home|real estate/i);
});

test('unknown routes show the not-found experience', async ({ page }) => {
  await page.goto('/route-that-does-not-exist');
  await expect(page.getByText('Page not found')).toBeVisible();
});
