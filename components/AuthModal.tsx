"use client";

import React, { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { 
  useSessionContext, 
  useSupabaseClient
} from '@supabase/auth-helpers-react';
import { useRouter } from 'next/navigation';

import useAuthModal from "@/hooks/useAuthModal";

import Modal from './Modal';

type SocialProvider = 'google' | 'apple' | 'github';

const AuthModal = () => {
  const { session } = useSessionContext();
  const router = useRouter();
  const { onClose, isOpen } = useAuthModal();
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const oauthRedirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
  
  const supabaseClient = useSupabaseClient();

  useEffect(() => {
    if (session) {
      router.refresh();
      onClose();
    }
  }, [session, router, onClose]);

  useEffect(() => {
    const requestedProviders: SocialProvider[] = [];

    if (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true') {
      requestedProviders.push('google');
    }

    if (process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === 'true') {
      requestedProviders.push('apple');
    }

    if (process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === 'true') {
      requestedProviders.push('github');
    }

    if (!requestedProviders.length) {
      setProviders([]);
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      setProviders([]);
      return;
    }

    let isMounted = true;

    fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load auth provider settings.');
        }

        return response.json();
      })
      .then((settings) => {
        if (!isMounted) {
          return;
        }

        const external = settings?.external || {};
        const enabled = requestedProviders.filter((provider) => external[provider] === true);
        setProviders(enabled);
      })
      .catch(() => {
        if (isMounted) {
          setProviders([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const onChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  }

  return (
    <Modal 
      title="Welcome back" 
      description="Login to your account." 
      isOpen={isOpen} 
      onChange={onChange} 
    >
      <Auth
        supabaseClient={supabaseClient}
        providers={providers}
        redirectTo={oauthRedirectTo}
        magicLink={false}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#404040',
                brandAccent: '#22c55e'
              }
            }
          }
        }}
        theme="dark"
      />
    </Modal>
  );
}

export default AuthModal;