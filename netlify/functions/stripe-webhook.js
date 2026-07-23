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
    const meta = session.metadata ?? {};
    const email = session.customer_details?.email ?? session.customer_email ?? 'unknown';
    const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

    await sendPaymentNotification({ ...meta, email, amount });
  }

  return { statusCode: 200, body: 'OK' };
};

// Field layout mirrors the treasurer email the old memberapp.php site sent
// on every membership submission (see templates/memberappEmail.htm in the
// old site repo) — same data, minus the household-members table, which
// doesn't exist as a field group on the current /join form.
async function sendPaymentNotification({
  name, membership, email, amount,
  status, gender, year1, street, city, state, zipcode, phone,
  trailUses, canHelp, news, key, remarks, source,
}) {
  const toEmail = process.env.TREASURER_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!toEmail || !resendKey) {
    console.warn('TREASURER_EMAIL or RESEND_API_KEY not set — skipping payment notification email');
    return;
  }

  const subject = `${status || 'New'} Membership Received — ${name} (${membership})`;
  const text = [
    `${status || 'New'} Membership received at the ${membership} level ($${amount}).`,
    '',
    'Primary Member:',
    `  ${name}${gender ? `  ${gender}` : ''}${year1 ? `  ${year1}` : ''}`,
    `  ${street}`,
    `  ${city}, ${state}  ${zipcode}`,
    `  ${phone}`,
    `  ${email}`,
    '',
    `Trail Uses:    ${trailUses || '(none selected)'}`,
    `Willing to help: ${canHelp || '(none selected)'}`,
    `Newsletter:    ${news || '(not specified)'}`,
    `Arena Key:     ${key || '(not specified)'}`,
    `Remarks:       ${remarks || '(none)'}`,
    `First learned: ${source || '(not specified)'}`,
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
