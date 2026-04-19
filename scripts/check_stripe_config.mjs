import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!secretKey) {
  console.error('Missing STRIPE_SECRET_KEY in environment.');
  process.exit(1);
}

if (!publishableKey) {
  console.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in environment.');
  process.exit(1);
}

const modeSecret = secretKey.startsWith('sk_live_') ? 'live' : secretKey.startsWith('sk_test_') ? 'test' : 'unknown';
const modePublishable = publishableKey.startsWith('pk_live_') ? 'live' : publishableKey.startsWith('pk_test_') ? 'test' : 'unknown';

if (modeSecret !== modePublishable) {
  console.error(`Stripe key mode mismatch: secret=${modeSecret}, publishable=${modePublishable}`);
  process.exit(1);
}

try {
  const stripe = new Stripe(secretKey, { apiVersion: '2022-11-15' });
  const account = await stripe.accounts.retrieve();
  const products = await stripe.products.list({ limit: 3, active: true });

  console.log(`Stripe account OK: ${account.id}`);
  console.log(`Mode: ${modeSecret}`);
  console.log(`Active products available: ${products.data.length}`);
} catch (error) {
  console.error('Stripe validation failed:', error?.message || error);
  process.exit(1);
}
