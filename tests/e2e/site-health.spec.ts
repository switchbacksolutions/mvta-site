// Site-wide checks from the 2026-11 audit: 404 page, robots.txt, share image, noindex, CSP.
import { test, expect } from '@playwright/test';

test('unknown URLs show the 404 page', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
});

test('robots.txt points to the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('Sitemap: https://mvtrails.org/sitemap-index.xml');
});

test('the default share image exists', async ({ page, request }) => {
  await page.goto('/');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  const res = await request.get(new URL(og!).pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/jpeg');
});

test('post-submit pages are noindex and other pages are not', async ({ page }) => {
  for (const path of ['/join-success', '/join-thank-you']) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  }
  await page.goto('/join');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('the site fonts load without CSP errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  expect(errors.filter((e) => e.includes('Content Security Policy'))).toEqual([]);
  const families = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  expect(families.join(',')).toMatch(/Karla|Poppins/);
});
