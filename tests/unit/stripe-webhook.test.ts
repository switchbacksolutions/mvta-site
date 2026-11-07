import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';
import { handler } from '../../netlify/functions/stripe-webhook.js';

// Cancellation emails look up the customer's email. Keep the real SDK for signature checks.
vi.mock('stripe', async (importOriginal) => {
  const { default: RealStripe } = await importOriginal<typeof import('stripe')>();
  class StripeWithFakeCustomers extends RealStripe {
    constructor(key: string) {
      super(key);
      Object.assign(this, { customers: { retrieve: async () => ({ email: 'pat@example.com' }) } });
    }
  }
  return { default: StripeWithFakeCustomers };
});

const SECRET = 'whsec_test';

function signedEvent(type: string, object: object, previous_attributes?: object) {
  const body = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object, previous_attributes } });
  // The SDK type marks every option required, but it fills in all except payload and secret.
  type HeaderOptions = Parameters<typeof Stripe.webhooks.generateTestHeaderString>[0];
  const sig = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET } as HeaderOptions);
  return { body, headers: { 'stripe-signature': sig } };
}

const renewalInvoice = (billing_reason: string) => ({
  object: 'invoice',
  billing_reason,
  customer_email: 'pat@example.com',
  amount_paid: 3500,
  parent: { subscription_details: { metadata: { name: 'Pat Doe', membership: 'Family' } } },
});

const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'));
const sentEmail = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unused');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('TREASURER_EMAIL', 'treasurer@example.com');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('stripe-webhook invoice.paid', () => {
  it('emails the treasurer for an automatic renewal', async () => {
    const res = await handler(signedEvent('invoice.paid', renewalInvoice('subscription_cycle')));

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const { subject, text } = sentEmail();
    expect(subject).toBe('Automatic renewal Membership Received — Pat Doe (Family)');
    expect(text).toContain('($35.00)');
    expect(text).toContain('pat@example.com');
  });

  it('does not email for the first invoice of a new subscription', async () => {
    await handler(signedEvent('invoice.paid', renewalInvoice('subscription_create')));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const PERIOD_END = Date.UTC(2027, 10, 6) / 1000;

const subscription = (fields: object = {}) => ({
  object: 'subscription',
  customer: 'cus_x',
  cancel_at_period_end: false,
  cancel_at: null,
  metadata: { name: 'Pat Doe', membership: 'Family' },
  items: { data: [{ current_period_end: PERIOD_END }] },
  ...fields,
});

describe('stripe-webhook cancellations', () => {
  it('emails the treasurer when a member cancels in the portal', async () => {
    const sub = subscription({
      cancel_at_period_end: true,
      cancel_at: PERIOD_END,
      cancellation_details: { reason: 'cancellation_requested', feedback: 'too_expensive', comment: null },
    });
    await handler(signedEvent('customer.subscription.updated', sub, { cancel_at_period_end: false, cancel_at: null }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const { subject, text } = sentEmail();
    expect(subject).toBe('Membership Cancelled — Pat Doe (Family)');
    expect(text).toContain('stays active until 2027-11-06');
    expect(text).toContain('pat@example.com');
    expect(text).toContain('Feedback: too expensive');
  });

  it('emails the treasurer when a member takes back a cancellation', async () => {
    await handler(signedEvent('customer.subscription.updated', subscription(), { cancel_at_period_end: true, cancel_at: PERIOD_END }));
    expect(sentEmail().subject).toBe('Membership Cancellation Withdrawn — Pat Doe (Family)');
  });

  it('does not email for other subscription updates', async () => {
    await handler(signedEvent('customer.subscription.updated', subscription(), { metadata: {} }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('emails the treasurer when a membership ends', async () => {
    const sub = subscription({ status: 'canceled', cancellation_details: { reason: 'payment_failed' } });
    await handler(signedEvent('customer.subscription.deleted', sub));

    const { subject, text } = sentEmail();
    expect(subject).toBe('Membership Ended — Pat Doe (Family)');
    expect(text).toContain('Reason:   payment failed');
  });
});
