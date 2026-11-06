import { describe, it, expect } from 'vitest';
import { emailVariants, hasLiveSubscription } from '../../netlify/lib/membership.js';

const customer = (...statuses: string[]) => ({
  id: 'cus_x',
  subscriptions: { data: statuses.map((status) => ({ status })) },
});

describe('emailVariants', () => {
  it('returns the trimmed address and its lowercase form', () => {
    expect(emailVariants('  Pat@Example.com ')).toEqual(['Pat@Example.com', 'pat@example.com']);
  });

  it('returns one entry when the address is already lowercase', () => {
    expect(emailVariants('pat@example.com')).toEqual(['pat@example.com']);
  });

  it('returns nothing for an empty address', () => {
    expect(emailVariants(undefined)).toEqual([]);
  });
});

describe('hasLiveSubscription', () => {
  it.each(['active', 'trialing', 'past_due', 'unpaid'])('is true for a %s subscription', (status) => {
    expect(hasLiveSubscription([customer(status)])).toBe(true);
  });

  it.each(['canceled', 'incomplete', 'incomplete_expired', 'paused'])(
    'is false for a %s subscription',
    (status) => {
      expect(hasLiveSubscription([customer(status)])).toBe(false);
    },
  );

  it('is false for a customer with no subscriptions', () => {
    expect(hasLiveSubscription([{ id: 'cus_x' }])).toBe(false);
  });

  it('is true when any of several customers has a live subscription', () => {
    expect(hasLiveSubscription([customer('canceled'), customer('active')])).toBe(true);
  });
});
