/**
 * tests/e2e/newsletters.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Playwright E2E tests for the newsletter archive (/newsletters).
 *
 * Run: npm run test:e2e
 */

import { test, expect } from '@playwright/test';

test.describe('Newsletters page (/newsletters)', () => {
  test('loads with status 200', async ({ page }) => {
    const response = await page.request.get('/newsletters');
    expect(response.status()).toBe(200);
  });

  test('displays the Newsletters heading', async ({ page }) => {
    await page.goto('/newsletters');
    await expect(page.getByRole('heading', { name: 'Newsletters', level: 1 })).toBeVisible();
  });

  test('is reachable from the About Us nav dropdown', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'About Us' }).hover();
    const link = page.getByRole('link', { name: 'Newsletters' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/newsletters');
  });

  test('each newsletter links directly to a PDF file', async ({ page }) => {
    await page.goto('/newsletters');
    const list = page.getByTestId('newsletter-list');
    if (await list.count() === 0) {
      // No newsletters published yet — empty state is acceptable.
      await expect(page.getByText(/no newsletters have been published yet/i)).toBeVisible();
      return;
    }
    const firstLink = list.getByRole('listitem').first().getByRole('link');
    await expect(firstLink).toHaveAttribute('href', /\.pdf$/);
    await expect(firstLink).toHaveAttribute('target', '_blank');
  });
});
