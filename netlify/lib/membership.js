// Existing-member lookup for create-checkout, so a renewal does not start a second subscription.
// Lives outside netlify/functions so Netlify does not deploy it as its own function.

// Stripe keeps billing (or retrying) these, so a new Checkout would charge the member twice.
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

// customers.list filters email case-sensitively, so also try the lowercase form.
export function emailVariants(email) {
  const trimmed = String(email ?? '').trim();
  return [...new Set([trimmed, trimmed.toLowerCase()])].filter(Boolean);
}

export function hasLiveSubscription(customers) {
  return customers.some((c) => c.subscriptions?.data?.some((s) => LIVE_STATUSES.has(s.status)));
}

export async function findCustomers(stripe, email) {
  const lists = await Promise.all(
    emailVariants(email).map((e) =>
      stripe.customers.list({ email: e, limit: 10, expand: ['data.subscriptions'] }),
    ),
  );
  const byId = new Map(lists.flatMap((l) => l.data).map((c) => [c.id, c]));
  return [...byId.values()];
}
