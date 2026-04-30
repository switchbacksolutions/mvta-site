import Stripe from 'stripe';

// Membership amounts in cents
const PRICES = {
  Individual: 2500,
  Family: 3500,
  'Trail Guardian': 10000,
  'Lifetime Sponsor': 100000,
};

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

  const { membership, email, name } = body;

  if (!PRICES[membership]) {
    return { statusCode: 400, body: 'Invalid membership level' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const siteUrl = process.env.URL || 'http://localhost:8888';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `MVTA ${membership} Membership`,
              description: 'Meadow Vista Trails Association — annual membership. Tax-deductible donation to a 501(c)(3).',
            },
            unit_amount: PRICES[membership],
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${siteUrl}/join-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/join?cancelled=true`,
      metadata: { membership, name },
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
