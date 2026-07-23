import Stripe from 'stripe';

// Stripe Price IDs — annual tiers are recurring subscriptions;
// Lifetime Sponsor is a one-time payment. Test-mode IDs shown here;
// swap in the live-mode equivalents when STRIPE_SECRET_KEY is a live key.
const PRICE_IDS = {
  Individual: 'price_1Tw7cQBSlwSEcqrGqcx5pbh6',
  Family: 'price_1Tw7d1BSlwSEcqrGB3dbTt0T',
  'Trail Guardian': 'price_1Tw7egBSlwSEcqrGyHniJ9w5',
  'Lifetime Sponsor': 'price_1Tw7fGBSlwSEcqrGtU0uVQXL',
};

const ONE_TIME_TIERS = new Set(['Lifetime Sponsor']);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const {
    membership, email, name,
    status, gender, year1, street, city, state, zipcode, phone,
    trailUses, canHelp, news, key, remarks, source,
  } = body;

  if (!PRICE_IDS[membership]) {
    return { statusCode: 400, body: 'Invalid membership level' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || 'http://localhost:8888';
  const mode = ONE_TIME_TIERS.has(membership) ? 'payment' : 'subscription';

  // Everything the old memberapp.php site emailed the treasurer, minus the
  // household-member rows (that section doesn't exist on the current form).
  // Stripe metadata values must be strings — coerce and cap at 500 chars.
  const toMeta = (v) => String(v ?? '').slice(0, 500);
  const metadata = {
    membership, name,
    status: toMeta(status),
    gender: toMeta(gender),
    year1: toMeta(year1),
    street: toMeta(street),
    city: toMeta(city),
    state: toMeta(state),
    zipcode: toMeta(zipcode),
    phone: toMeta(phone),
    trailUses: toMeta(trailUses),
    canHelp: toMeta(canHelp),
    news: toMeta(news),
    key: toMeta(key),
    remarks: toMeta(remarks),
    source: toMeta(source),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: PRICE_IDS[membership],
          quantity: 1,
        },
      ],
      mode,
      success_url: `${siteUrl}/join-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/join?cancelled=true`,
      metadata,
      // Copy metadata onto the Subscription object too (Checkout Session
      // metadata alone doesn't propagate to renewal invoices/events).
      ...(mode === 'subscription' && {
        subscription_data: { metadata },
      }),
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return { statusCode: 500, body: 'Failed to create checkout session' };
  }
};
