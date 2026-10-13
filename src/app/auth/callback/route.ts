import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const errorParam = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/dashboard?confirmed=true';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const siteUrl = isLocalEnv
    ? origin
    : forwardedHost
    ? `https://${forwardedHost}`
    : origin;

  // 1. If Supabase reported an auth error (e.g. expired link)
  if (errorParam || errorDescription) {
    const errorMsg = errorDescription || errorParam || 'Email confirmation failed';
    return NextResponse.redirect(`${siteUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${siteUrl}/login?error=Supabase+is+not+configured`);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });

  // 2. PKCE Authorization Code Exchange
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Ensure matching public.profiles row exists for the verified auth.users UUID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.email?.split('@')[0] ||
            'Educator',
          email: data.user.email || '',
          role: data.user.user_metadata?.role || 'TEACHER',
        });
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    } else {
      console.warn('[auth/callback] Code exchange warning:', error?.message);
      // If code exchange failed (e.g. different browser missing PKCE verifier cookie),
      // redirect to login with confirmed state so user can sign in directly
      return NextResponse.redirect(
        `${siteUrl}/login?confirmed=true&notice=${encodeURIComponent(
          'Email verification processed. Please enter your password to enter ATTENDER.'
        )}`
      );
    }
  }

  // 3. Token Hash verification (OTP / email verification link)
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.email?.split('@')[0] ||
            'Educator',
          email: data.user.email || '',
          role: data.user.user_metadata?.role || 'TEACHER',
        });
      }

      return NextResponse.redirect(`${siteUrl}${next}`);
    } else {
      console.error('[auth/callback] verifyOtp failed:', error);
      return NextResponse.redirect(
        `${siteUrl}/login?error=${encodeURIComponent(
          error?.message || 'Verification token is invalid or expired.'
        )}`
      );
    }
  }

  // 4. If request has no query parameters (e.g. client-side hash fragments /auth/callback#...)
  // Return an HTML bridge script so hash tokens are preserved and processed
  const htmlBridge = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verifying Session - ATTENDER</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #020617; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <p style="font-size: 16px; font-weight: bold;">Verifying your authenticated session...</p>
    <p style="font-size: 13px; color: #94a3b8;">Redirecting to ATTENDER...</p>
  </div>
  <script>
    if (window.location.hash) {
      window.location.replace('/login' + window.location.hash);
    } else {
      window.location.replace('/login');
    }
  </script>
</body>
</html>`;

  return new NextResponse(htmlBridge, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
