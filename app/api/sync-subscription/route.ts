import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { stripe } from '@/libs/stripe';
import {
  manageSubscriptionStatusChange,
  supabaseAdmin,
} from '@/libs/supabaseAdmin';

const getRecentCompletedSubscriptionSessionsForUser = async (userId: string) => {
  const matchedSessions = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < 5; page += 1) {
    const sessionPage = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const pageMatches = sessionPage.data.filter(
      (session) =>
        session.client_reference_id === userId &&
        session.mode === 'subscription' &&
        session.status === 'complete' &&
        typeof session.customer === 'string' &&
        typeof session.subscription === 'string'
    );

    matchedSessions.push(...pageMatches);

    if (!sessionPage.has_more || sessionPage.data.length === 0) {
      break;
    }

    startingAfter = sessionPage.data[sessionPage.data.length - 1].id;

    if (matchedSessions.length >= 10) {
      break;
    }
  }

  return matchedSessions;
};

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: customerData, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    const recentSessions = await getRecentCompletedSubscriptionSessionsForUser(
      user.id
    );

    const candidateCustomerIds = new Set<string>();

    if (customerData?.stripe_customer_id) {
      candidateCustomerIds.add(customerData.stripe_customer_id);
    }

    for (const session of recentSessions) {
      candidateCustomerIds.add(session.customer as string);
    }

    if (candidateCustomerIds.size === 0) {
      return NextResponse.json({
        synced: false,
        reason: 'no_customer_mapping_or_completed_sessions',
      });
    }

    const customerSubscriptionData = await Promise.all(
      [...candidateCustomerIds].map(async (customerId) => {
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 20,
        });

        const activeOrTrialing = subscriptions.data.filter(
          (subscription) =>
            subscription.status === 'active' || subscription.status === 'trialing'
        );

        return {
          customerId,
          subscriptions: subscriptions.data,
          activeOrTrialing,
        };
      })
    );

    const recentCustomerOrder = [...new Set(recentSessions.map((session) => session.customer as string))];

    const preferredActive = recentCustomerOrder
      .map((customerId) =>
        customerSubscriptionData.find(
          (entry) =>
            entry.customerId === customerId && entry.activeOrTrialing.length > 0
        )
      )
      .find(Boolean);

    const fallbackPreferred = recentCustomerOrder
      .map((customerId) =>
        customerSubscriptionData.find((entry) => entry.customerId === customerId)
      )
      .find(Boolean);

    const preferredCustomer =
      preferredActive ||
      customerSubscriptionData.find((entry) => entry.activeOrTrialing.length > 0) ||
      fallbackPreferred ||
      customerSubscriptionData[0];

    if (!preferredCustomer) {
      return NextResponse.json({ synced: false, reason: 'no_subscriptions_found' });
    }

    const syncTargets =
      preferredCustomer.activeOrTrialing.length > 0
        ? preferredCustomer.activeOrTrialing
        : preferredCustomer.subscriptions.length > 0
          ? [preferredCustomer.subscriptions[0]]
          : [];
    const hasActive = preferredCustomer.activeOrTrialing.length > 0;

    const { error: upsertError } = await supabaseAdmin
      .from('customers')
      .upsert([
        {
          id: user.id,
          stripe_customer_id: preferredCustomer.customerId,
        },
      ]);

    if (upsertError) {
      throw upsertError;
    }

    for (const subscription of syncTargets) {
      await manageSubscriptionStatusChange(subscription.id, preferredCustomer.customerId);
    }

    return NextResponse.json({
      synced: syncTargets.length > 0,
      syncedCount: syncTargets.length,
      hasActive,
      mappedCustomerId: preferredCustomer.customerId,
      candidateCustomers: [...candidateCustomerIds],
      recentSessionsFound: recentSessions.length,
    });
  } catch (error: any) {
    console.log(error);
    return new NextResponse(error?.message || 'Internal Error', { status: 500 });
  }
}
