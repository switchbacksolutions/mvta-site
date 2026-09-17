/**
 * tests/e2e/home.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Playwright E2E tests for the home page (/).
 *
 * Run: npm run test:e2e
 * Run in UI mode: npm run test:e2e:ui
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

// Below the sm breakpoint the desktop nav is hidden behind the menu button.
async function openSiteNav(page: Page, isMobile: boolean): Promise<Locator> {
  if (!isMobile) return page.getByRole('navigation', { name: 'Main navigation' });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  return page.getByRole('navigation', { name: 'Mobile navigation' });
}

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads successfully with status 200', async ({ page }) => {
    const response = await page.request.get('/');
    expect(response.status()).toBe(200);
  });

  test('displays the site name in the header', async ({ page }) => {
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Meadow Vista Trails Association' }),
    ).toBeVisible();
  });

  test('has a visible main navigation', async ({ page, isMobile }) => {
    const nav = await openSiteNav(page, isMobile);
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Trails' })).toBeVisible();
  });

  test('has a page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Meadow Vista Trails Association/);
  });

  test('has a meta description', async ({ page }) => {
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });

  test('has canonical and OG meta tags', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
  });

  test('shows a hero section with call-to-action links', async ({ page }) => {
    const hero = page.locator('section').first();
    await expect(hero.getByRole('link', { name: /join/i })).toBeVisible();
    await expect(hero.getByRole('link', { name: /trails/i })).toBeVisible();
  });

  test('shows the featured trails and facilities sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Featured Trails', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Facilities', level: 2 })).toBeVisible();
  });

  test('has a footer with copyright text', async ({ page }) => {
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Meadow Vista Trails Association. All rights reserved.');
  });

  test('is accessible — no obvious ARIA violations', async ({ page }) => {
    // Ensure key landmark roles are present
    await expect(page.getByRole('banner')).toBeVisible();      // <header>
    await expect(page.getByRole('main')).toBeVisible();         // implied by sections? no — check for main
    await expect(page.getByRole('contentinfo')).toBeVisible(); // <footer>
  });

  test('navigation links point to correct paths', async ({ page, isMobile }) => {
    const nav = await openSiteNav(page, isMobile);

    await expect(nav.getByRole('link', { name: 'Trails', exact: true })).toHaveAttribute('href', '/trails');
    await expect(nav.getByRole('link', { name: 'Events', exact: true })).toHaveAttribute('href', '/events');
    await expect(nav.getByRole('link', { name: 'Join', exact: true })).toHaveAttribute('href', '/join');
  });
});
