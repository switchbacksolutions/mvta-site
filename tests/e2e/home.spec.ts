/**
 * tests/e2e/home.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Playwright E2E tests for the home page (/).
 *
 * Run: npm run test:e2e
 * Run in UI mode: npm run test:e2e:ui
 */

import { test, expect } from '@playwright/test';

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
    await expect(page.getByRole('link', { name: 'Astro Template' }).first()).toBeVisible();
  });

  test('has a visible main navigation', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Trails' })).toBeVisible();
  });

  test('has a page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Astro Template/);
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

  test('shows the features / what\'s included section', async ({ page }) => {
    await expect(page.getByText(/what's included/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Astro \+ TypeScript/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tailwind CSS', exact: true })).toBeVisible();
  });

  test('has a footer with copyright text', async ({ page }) => {
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Astro Template');
  });

  test('dark mode toggle is present and functional', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /toggle dark mode/i });
    await expect(toggle).toBeVisible();

    // Toggle on
    await toggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Toggle off
    await toggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('is accessible — no obvious ARIA violations', async ({ page }) => {
    // Ensure key landmark roles are present
    await expect(page.getByRole('banner')).toBeVisible();      // <header>
    await expect(page.getByRole('main')).toBeVisible();         // implied by sections? no — check for main
    await expect(page.getByRole('contentinfo')).toBeVisible(); // <footer>
  });

  test('navigation links point to correct paths', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    const blogLink = nav.getByRole('link', { name: 'Blog' });
    await expect(blogLink).toHaveAttribute('href', '/blog');

    const aboutLink = nav.getByRole('link', { name: 'About' });
    await expect(aboutLink).toHaveAttribute('href', '/about');
  });
});
