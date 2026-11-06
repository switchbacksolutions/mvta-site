// Every link labeled "Join" must go to the membership sign-up page, not /contact.
import { test, expect } from '@playwright/test';

const PAGES = ['/', '/about', '/events', '/trails', '/dog-park', '/horse-arena', '/board', '/contact'];

for (const path of PAGES) {
  test(`Join links on ${path} go to /join`, async ({ page }) => {
    await page.goto(path);
    const links = page.getByRole('link', { name: /\bjoin\b/i, includeHidden: true });
    const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href).toBe('/join');
  });
}
