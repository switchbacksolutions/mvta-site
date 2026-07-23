/**
 * tests/e2e/join.spec.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * E2E test for the membership join + payment flow: fills out /join, submits
 * to Stripe Checkout, pays with Stripe's test card, and confirms the
 * redirect back to /join-success.
 *
 * Runs against `netlify dev` (see playwright.config.ts) so the real
 * /.netlify/functions/create-checkout function is exercised, not a mock.
 *
 * Requires STRIPE_SECRET_KEY in the environment — this MUST be a TEST MODE
 * key (sk_test_...). In CI this comes from the STRIPE_SECRET_KEY repo
 * secret (see .github/workflows/e2e.yml); never point this test at a live
 * key.
 *
 * Safety notes (why this won't cause problems against real Stripe/Resend):
 *  - Card details are Stripe's documented test card (4242 4242 4242 4242),
 *    which only works in test mode and never moves real money.
 *  - The email address is regenerated on every run (timestamp + random
 *    suffix) so repeated CI runs don't build up duplicate-looking customers
 *    or trip any dedup/fraud heuristics on Stripe's side.
 *  - "Save my information" (Stripe Link) is explicitly unchecked before
 *    submitting, so this test doesn't create a Link account tied to a fake
 *    phone number on every run.
 *  - Stripe's optional "I am an AI agent acting on behalf of someone else"
 *    disclosure checkbox is checked when present — accurate for a CI run,
 *    and avoids the test hanging on it.
 *  - RESEND_API_KEY is intentionally NOT set in CI, so stripe-webhook.js's
 *    email step no-ops even if the webhook were reachable. This test also
 *    doesn't run `stripe listen`, so the webhook is never invoked at all —
 *    this test only covers the browser-facing checkout flow, not the
 *    email notification. If you want webhook/email coverage, that's better
 *    suited to a focused integration test that calls the handler directly
 *    with a synthetic Stripe event, rather than driving it through the UI.
 */

import { test, expect, type Page } from '@playwright/test';

const TEST_CARD = {
  number: '4242424242424242',
  expiry: '12/34',
  cvc: '123',
};

function uniqueTestEmail(): string {
  return `e2e+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function fillJoinForm(page: Page, membership: string): Promise<string> {
  await page.goto('/join');

  await page.locator('input[name="status"][value="New"]').check();
  await page.locator(`input[name="membership"][value="${membership}"]`).check();

  await page.locator('#firstname').fill('E2E');
  await page.locator('#lastname').fill('Test');
  await page.locator('#street').fill('123 Test Ln');
  await page.locator('#city').fill('Meadow Vista');
  await page.locator('#state').fill('CA');
  await page.locator('#zipcode').fill('95722');
  await page.locator('#phone').fill('(530) 555-0100');

  const email = uniqueTestEmail();
  await page.locator('#email').fill(email);
  await page.locator('#email2').fill(email);

  await page.locator('#pay-online').check();

  return email;
}

async function payOnStripeCheckout(page: Page): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

  // Card number / expiry / CVC each live in their own Stripe-hosted PCI
  // iframe — these titles are part of Stripe's documented Elements markup.
  await page
    .frameLocator('iframe[title="Secure card number input frame"]')
    .getByPlaceholder('1234 1234 1234 1234')
    .fill(TEST_CARD.number);
  await page
    .frameLocator('iframe[title="Secure expiration date input frame"]')
    .getByPlaceholder('MM / YY')
    .fill(TEST_CARD.expiry);
  await page
    .frameLocator('iframe[title="Secure CVC input frame"]')
    .getByPlaceholder('CVC')
    .fill(TEST_CARD.cvc);

  await page.getByLabel('Cardholder name').fill('E2E Test');
  await page.getByLabel('ZIP').fill('95722');

  // Skip Link signup — avoids a required phone-number field and avoids
  // creating a Link account from CI on every run.
  const saveInfo = page.getByLabel(/save my information/i);
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck();
  }

  // Stripe sometimes shows an "I am an AI agent acting on behalf of someone
  // else" disclosure checkbox for automated-looking traffic — which a CI
  // runner is. Answer it honestly if it's there; it's optional the rest of
  // the time so this is a no-op when it doesn't appear.
  const aiAgentDisclosure = page.getByLabel(/I am an AI agent acting on behalf of someone else/i);
  if (await aiAgentDisclosure.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await aiAgentDisclosure.check();
  }

  await page.getByRole('button', { name: /^(Subscribe|Pay)\b/ }).click();
  await page.waitForURL(/\/join-success/, { timeout: 20_000 });
}

test.describe('Membership join + payment flow', () => {
  test('completes a subscription membership (Individual, $25/yr)', async ({ page }) => {
    await fillJoinForm(page, 'Individual');
    await page.locator('#submit-btn').click();

    await payOnStripeCheckout(page);

    await expect(page.getByRole('heading', { name: /Payment received/i })).toBeVisible();
  });

  test('completes a one-time membership (Lifetime Sponsor, $1,000)', async ({ page }) => {
    await fillJoinForm(page, 'Lifetime Sponsor');
    await page.locator('#submit-btn').click();

    await payOnStripeCheckout(page);

    await expect(page.getByRole('heading', { name: /Payment received/i })).toBeVisible();
  });
});
