'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

export function AuthCallbackDetector() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const hash = window.location.hash;

    // 1. If query parameters contain an auth code or token hash, immediately route to callback handler
    if (code || tokenHash) {
      window.location.replace(`/auth/callback${window.location.search}`);
      return;
    }

    // 2. If URL contains an auth hash token (e.g. #access_token=...), exchange and forward to dashboard
    if (hash && (hash.includes('access_token') || hash.includes('type='))) {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
          if (res.data.session) {
            router.replace('/dashboard?confirmed=true');
          }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange(
          (_event: AuthChangeEvent, session: Session | null) => {
            if (session) {
              router.replace('/dashboard?confirmed=true');
            }
          }
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      }
    }
  }, [router]);

  return null;
}
