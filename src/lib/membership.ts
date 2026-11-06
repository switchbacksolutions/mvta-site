// Stripe customer portal login page; falls back to /contact when the env var is not set.
export const MANAGE_MEMBERSHIP_URL: string = import.meta.env.PUBLIC_STRIPE_PORTAL_URL || '/contact';
