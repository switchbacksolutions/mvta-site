import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';
import { handler } from '../../netlify/functions/stripe-webhook.js';

const SECRET = 'whsec_test';

function signedEvent(type: string, object: object) {
  const body = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object } });
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

describe('stripe-webhook invoice.paid', () => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'));

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

  it('emails the treasurer for an automatic renewal', async () => {
    const res = await handler(signedEvent('invoice.paid', renewalInvoice('subscription_cycle')));

    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    const { subject, text } = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(subject).toBe('Automatic renewal Membership Received — Pat Doe (Family)');
    expect(text).toContain('($35.00)');
    expect(text).toContain('pat@example.com');
  });

  it('does not email for the first invoice of a new subscription', async () => {
    await handler(signedEvent('invoice.paid', renewalInvoice('subscription_create')));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
