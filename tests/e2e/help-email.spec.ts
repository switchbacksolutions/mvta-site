// Every email link on the site must go to the one help address (src/lib/contact.ts).
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/about', '/contact', '/dog-park', '/horse-arena', '/join', '/join-success', '/join-thank-you'];

for (const path of PAGES) {
  test(`email links on ${path} go to web-admin@mvtrails.org`, async ({ page }) => {
    await page.goto(path);
    const hrefs = await page.locator('a[href^="mailto:"]').evaluateAll((els) => els.map((el) => el.getAttribute('href')));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toBe('mailto:web-admin@mvtrails.org');
  });
}
