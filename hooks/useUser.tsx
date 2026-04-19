import { useEffect, useState, createContext, useContext, useRef } from 'react';
import {
  useUser as useSupaUser,
  useSessionContext,
  User
} from '@supabase/auth-helpers-react';

import { UserDetails, Subscription } from '@/types';

type UserContextType = {
  accessToken: string | null;
  user: User | null;
  userDetails: UserDetails | null;
  isLoading: boolean;
  subscription: Subscription | null;
};

export const UserContext = createContext<UserContextType | undefined>(
  undefined
);

export interface Props {
  [propName: string]: any;
}

export const MyUserContextProvider = (props: Props) => {
  const {
    session,
    isLoading: isLoadingUser,
    supabaseClient: supabase
  } = useSessionContext();
  const user = useSupaUser();
  const accessToken = session?.access_token ?? null;
  const [isLoadingData, setIsloadingData] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const subscriptionSyncAttemptedForUser = useRef<string | null>(null);

  const getUserDetails = (userId: string) =>
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

  const getSubscription = (userId: string) =>
    supabase
      .from('subscriptions')
      .select('*, prices(*, products(*))')
      .eq('user_id', userId)
      .in('status', ['trialing', 'active'])
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle();

  const syncSubscriptionFromStripe = async () => {
    await fetch('/api/sync-subscription', {
      method: 'POST',
      headers: new Headers({ 'Content-Type': 'application/json' }),
      credentials: 'same-origin',
    });
  };

  useEffect(() => {
    if (!user && !isLoadingUser) {
      setUserDetails(null);
      setSubscription(null);
      subscriptionSyncAttemptedForUser.current = null;
      return;
    }

    if (!user?.id || isLoadingUser) {
      return;
    }

    const fetchUserData = async () => {
      setIsloadingData(true);

      try {
        const results = await Promise.allSettled([
          getUserDetails(user.id),
          getSubscription(user.id)
        ]);

        const userDetailsPromise = results[0];
        const subscriptionPromise = results[1];

        if (userDetailsPromise.status === 'fulfilled') {
          setUserDetails(userDetailsPromise.value.data as UserDetails);
        }

        if (subscriptionPromise.status === 'fulfilled') {
          const activeSubscription =
            (subscriptionPromise.value.data as Subscription | null) ?? null;
          setSubscription(activeSubscription);

          // Recover quickly when webhook delivery is delayed or missed after checkout.
          if (
            !activeSubscription &&
            subscriptionSyncAttemptedForUser.current !== user.id
          ) {
            subscriptionSyncAttemptedForUser.current = user.id;

            try {
              await syncSubscriptionFromStripe();
              const { data: refreshedSubscription } = await getSubscription(user.id);
              setSubscription((refreshedSubscription as Subscription | null) ?? null);
            } catch (error) {
              console.log('Subscription sync failed', error);
            }
          }
        }
      } finally {
        setIsloadingData(false);
      }
    };

    fetchUserData();
  }, [user?.id, isLoadingUser]);

  const value = {
    accessToken,
    user,
    userDetails,
    isLoading: isLoadingUser || isLoadingData,
    subscription
  };

  return <UserContext.Provider value={value} {...props} />;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error(`useUser must be used within a MyUserContextProvider.`);
  }
  return context;
};
