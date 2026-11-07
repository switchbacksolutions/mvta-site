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

  // subscription_create invoices are skipped: checkout.session.completed already covers them.
  if (stripeEvent.type === 'invoice.paid' && stripeEvent.data.object.billing_reason === 'subscription_cycle') {
    const invoice = stripeEvent.data.object;
    const meta = invoice.parent?.subscription_details?.metadata ?? {};
    const email = invoice.customer_email ?? 'unknown';
    const amount = ((invoice.amount_paid ?? 0) / 100).toFixed(2);

    await sendPaymentNotification({ ...meta, status: 'Automatic renewal', email, amount });
  }

  // The portal cancels at period end, so a cancellation first arrives as an update, then as a delete.
  if (stripeEvent.type === 'customer.subscription.updated') {
    const sub = stripeEvent.data.object;
    const before = isCancelScheduled({ ...sub, ...stripeEvent.data.previous_attributes });
    const after = isCancelScheduled(sub);
    if (before !== after) {
      await sendCancellationNotification(stripe, sub, after ? 'scheduled' : 'withdrawn');
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    await sendCancellationNotification(stripe, stripeEvent.data.object, 'ended');
  }

  return { statusCode: 200, body: 'OK' };
};

function isCancelScheduled(sub) {
  return Boolean(sub.cancel_at_period_end || sub.cancel_at);
}

async function sendCancellationNotification(stripe, sub, kind) {
  const { name = '(no name)', membership = '(unknown level)' } = sub.metadata ?? {};
  let email = 'unknown';
  try {
    const customer = await stripe.customers.retrieve(sub.customer);
    email = customer.email ?? email;
  } catch (err) {
    console.error('Could not look up the customer for a cancellation email:', err.message);
  }

  const endsAt = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end;
  const endDate = endsAt ? new Date(endsAt * 1000).toISOString().slice(0, 10) : '(unknown date)';
  const details = sub.cancellation_details ?? {};
  const headline = {
    scheduled: `${name} cancelled their ${membership} membership. It stays active until ${endDate} and will not renew.`,
    withdrawn: `${name} took back the cancellation of their ${membership} membership. It will renew as normal.`,
    ended: `${name}'s ${membership} membership has ended.`,
  }[kind];
  const subject = {
    scheduled: 'Membership Cancelled',
    withdrawn: 'Membership Cancellation Withdrawn',
    ended: 'Membership Ended',
  }[kind];

  const text = [
    headline,
    '',
    `Email:    ${email}`,
    ...(details.reason ? [`Reason:   ${details.reason.replaceAll('_', ' ')}`] : []),
    ...(details.feedback ? [`Feedback: ${details.feedback.replaceAll('_', ' ')}`] : []),
    ...(details.comment ? [`Comment:  ${details.comment}`] : []),
    '',
    'Please update membership records accordingly.',
  ].join('\n');

  await sendTreasurerEmail(`${subject} — ${name} (${membership})`, text);
}

// Field layout mirrors the treasurer email the old memberapp.php site sent
// on every membership submission (see templates/memberappEmail.htm in the
// old site repo) — same data, minus the household-members table, which
// doesn't exist as a field group on the current /join form.
async function sendPaymentNotification({
  name, membership, email, amount,
  status, gender, year1, street, city, state, zipcode, phone,
  trailUses, canHelp, news, key, remarks, source,
}) {
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

  await sendTreasurerEmail(subject, text);
}

async function sendTreasurerEmail(subject, text) {
  const toEmail = process.env.TREASURER_EMAIL;
  const resendKey = process.env.RESEND_API_KEY;

  if (!toEmail || !resendKey) {
    console.warn('TREASURER_EMAIL or RESEND_API_KEY not set — skipping treasurer email');
    return;
  }

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
    console.error('Failed to send treasurer email:', await res.text());
  }
}
