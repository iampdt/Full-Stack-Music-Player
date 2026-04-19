import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeKey || !supabaseUrl || !serviceRoleKey) {
  console.error('Missing required env vars. Need STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: '2022-11-15' });
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const collectActiveProducts = async () => {
  const all = [];
  let hasMore = true;
  let startingAfter;

  while (hasMore) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    });

    all.push(...page.data);
    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
  }

  return all;
};

const collectPricesForProduct = async (productId) => {
  const all = [];
  let hasMore = true;
  let startingAfter;

  while (hasMore) {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {})
    });

    all.push(...page.data);
    hasMore = page.has_more;
    startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
  }

  return all;
};

try {
  const products = await collectActiveProducts();

  if (!products.length) {
    console.log('No active Stripe products found. Nothing to sync.');
    process.exit(0);
  }

  const productRows = products.map((product) => ({
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description,
    image: product.images?.[0] ?? null,
    metadata: product.metadata
  }));

  const { error: productError } = await supabase
    .from('products')
    .upsert(productRows, { onConflict: 'id' });

  if (productError) {
    throw productError;
  }

  const pricesNested = await Promise.all(products.map((p) => collectPricesForProduct(p.id)));
  const priceRows = pricesNested
    .flat()
    .map((price) => ({
      id: price.id,
      product_id: typeof price.product === 'string' ? price.product : price.product.id,
      active: price.active,
      currency: price.currency,
      description: price.nickname,
      type: price.type,
      unit_amount: price.unit_amount,
      interval: price.recurring?.interval ?? null,
      interval_count: price.recurring?.interval_count ?? null,
      trial_period_days: price.recurring?.trial_period_days ?? null,
      metadata: price.metadata
    }));

  if (priceRows.length) {
    const { error: priceError } = await supabase
      .from('prices')
      .upsert(priceRows, { onConflict: 'id' });

    if (priceError) {
      throw priceError;
    }
  }

  console.log(`Synced ${productRows.length} products and ${priceRows.length} prices.`);
} catch (error) {
  console.error('Stripe catalog sync failed:', error?.message || error);
  process.exit(1);
}
