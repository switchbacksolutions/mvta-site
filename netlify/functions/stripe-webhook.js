import Stripe from 'stripe';

export const handler = async (event) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const { name, membership } = session.metadata ?? {};
    const email = session.customer_details?.email ?? session.customer_email ?? 'unknown';
    const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

    await sendPaymentNotification({ name, membership, email, amount });
  }

  return { statusCode: 200, body: 'OK' };
};

async function sendPaymentNotification({ name, membership, email, amount }) {
  const toEmail = process.env.TREASURER_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!toEmail || !resendKey) {
    console.warn('TREASURER_EMAIL or RESEND_API_KEY not set — skipping payment notification email');
    return;
  }

  const subject = `MVTA Payment Received — ${name} (${membership})`;
  const text = [
    'An MVTA membership payment has been received online.',
    '',
    `Name:       ${name}`,
    `Email:      ${email}`,
    `Membership: ${membership}`,
    `Amount:     $${amount}`,
    '',
    'Payment was processed via Stripe. Please update membership records accordingly.',
  ].join('\n');

  const from = process.env.FROM_EMAIL ?? 'MVTA Website <noreply@meadowvistatrails.org>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [toEmail], subject, text }),
  });

  if (!res.ok) {
    console.error('Failed to send payment notification email:', await res.text());
  }
}
