'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RoleBadge } from '@/components/ui/Badge';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  LogIn,
} from 'lucide-react';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Profile } from '@/lib/types';

function BootstrapContent() {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Status from /api/admin/bootstrap GET
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);

  // Form State
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bootstrapSuccess, setBootstrapSuccess] = useState(false);

  // 1. Check bootstrap availability from server
  const checkAvailability = async () => {
    setIsCheckingAvailability(true);
    try {
      const res = await fetch('/api/admin/bootstrap');
      const data = await res.json();
      if (res.ok) {
        setAdminExists(Boolean(data.adminExists));
        setBootstrapAvailable(Boolean(data.available));
      } else {
        setErrorMessage(data.error || 'Failed to check bootstrap status.');
      }
    } catch (err: any) {
      console.error('[Bootstrap] Availability check error:', err);
      setErrorMessage('Unable to connect to bootstrap status service.');
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // 2. Initialize authenticated Supabase session
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoadingAuth(false);
      setIsCheckingAvailability(false);
      setErrorMessage('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and credentials in .env.local.');
      return;
    }

    const supabase = createClient();
    let isMounted = true;

    const fetchSessionAndProfile = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;
        setSession(currentSession);

        if (currentSession?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .maybeSingle();

          if (isMounted) {
            setProfile(profileData as Profile);
          }
        }
      } catch (err) {
        console.error('[Bootstrap] Auth init error:', err);
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    fetchSessionAndProfile();
    checkAvailability();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, currentSession: Session | null) => {
        if (!isMounted) return;
        setSession(currentSession);
        if (currentSession?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .maybeSingle();
          if (isMounted) {
            setProfile(profileData as Profile);
          }
        } else {
          if (isMounted) setProfile(null);
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handle bootstrap form submission
  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!secret.trim()) {
      setErrorMessage('Please enter the server master ADMIN_BOOTSTRAP_SECRET.');
      return;
    }

    if (!session) {
      setErrorMessage('Authentication required. Please sign in to claim administrator privileges.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ secret: secret.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to bootstrap administrator account.');
      }

      // Re-fetch updated profile directly from Supabase
      const supabase = createClient();
      const { data: refreshedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (refreshedProfile) {
        setProfile(refreshedProfile as Profile);
      } else {
        setProfile((prev) => (prev ? { ...prev, role: 'ADMIN' } : null));
      }

      setBootstrapSuccess(true);
      setAdminExists(true);
      setBootstrapAvailable(false);
      success('Administrator Elevated', 'Your account is now the verified primary system administrator.');
    } catch (err: any) {
      console.error('[Bootstrap] Execution failed:', err);
      setErrorMessage(err.message || 'Bootstrap procedure failed.');
      toastError('Bootstrap Failed', err.message || 'Invalid secret or bootstrap permanently closed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInitialLoading = isLoadingAuth || isCheckingAvailability;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  ATTENDER
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Setup
                </span>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-2xl mx-auto w-full p-4 sm:p-8 flex flex-col justify-center">
        {isInitialLoading ? (
          <Card padding="lg" className="text-center py-16 space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center mx-auto animate-pulse shadow-lg shadow-purple-500/25">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Verifying Security Status
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Checking existing administrator records and authenticated session...
              </p>
            </div>
          </Card>
        ) : !session ? (
          /* State 1: Unauthenticated - Must log in first */
          <Card padding="lg" className="text-center space-y-6 shadow-xl border-amber-200 dark:border-amber-900/60">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-900/60 shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Authentication Required
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                You must be logged in with an active account before claiming the primary system administrator role. The bootstrap process securely binds administrator authority to your authenticated user identity.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-left text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <p className="font-bold text-slate-800 dark:text-slate-200">How to proceed:</p>
              <p>1. Sign in or register the personal email account you wish to elevate.</p>
              <p>2. Return to this page (<code className="font-mono text-indigo-600 dark:text-indigo-400">/admin/bootstrap</code>).</p>
              <p>3. Enter your server-side <code className="font-mono font-bold">ADMIN_BOOTSTRAP_SECRET</code> to claim admin rights.</p>
            </div>

            <div className="pt-2">
              <Link href="/login" className="w-full">
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<LogIn className="w-4 h-4" />}
                  className="w-full font-bold shadow-md shadow-indigo-600/25"
                >
                  Sign In to ATTENDER
                </Button>
              </Link>
            </div>
          </Card>
        ) : bootstrapSuccess || (profile?.role === 'ADMIN') ? (
          /* State 2: Bootstrap Successful or Already Admin */
          <Card padding="lg" className="text-center space-y-6 shadow-xl border-emerald-200 dark:border-emerald-900/60">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300/60 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" /> Administrator Status Confirmed
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {bootstrapSuccess ? 'Administrator Account Claimed!' : 'You Are an Administrator'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Your authenticated account is verified as a primary system administrator for this ATTENDER instance. Full management controls and audit logs are active.
              </p>
            </div>

            {/* Profile Confirmation Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-left">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {profile?.full_name || session.user.email}
                </p>
                <p className="text-xs text-slate-400">{session.user.email}</p>
              </div>
              <RoleBadge role="ADMIN" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/dashboard/admin" className="flex-1">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="w-full font-bold shadow-md shadow-indigo-600/25"
                >
                  Admin Security Center
                </Button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" size="lg" className="w-full font-semibold">
                  Main Dashboard
                </Button>
              </Link>
            </div>
          </Card>
        ) : adminExists && !bootstrapAvailable ? (
          /* State 3: Admin Already Exists - Permanent Lockout */
          <Card padding="lg" className="text-center space-y-6 shadow-xl border-slate-300 dark:border-slate-800">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-700">
              <Lock className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-300 dark:border-slate-700">
                <Lock className="w-3.5 h-3.5 text-slate-500" /> Bootstrap Locked
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Bootstrap Already Completed
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                An institutional administrator account already exists for this ATTENDER deployment. The initial bootstrap mechanism is permanently disabled to prevent unauthorized takeovers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-left text-xs space-y-1 text-slate-600 dark:text-slate-400">
              <p className="font-bold text-slate-800 dark:text-slate-200">Need admin access?</p>
              <p>• Only an existing administrator can generate teacher or administrator invitations.</p>
              <p>• Contact your institutional admin to receive an official cryptographic invite link.</p>
            </div>

            <div className="pt-2">
              <Link href="/dashboard" className="w-full">
                <Button variant="primary" size="lg" className="w-full font-bold">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          /* State 4: Form Ready - First Admin Provisioning */
          <Card padding="lg" className="space-y-6 shadow-xl border-purple-200 dark:border-purple-900/60">
            {/* Header Icon & Title */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto border border-purple-200 dark:border-purple-900/60 shadow-sm">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                First Administrator Bootstrap
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Establish the primary institutional administrator for ATTENDER.
              </p>
            </div>

            {/* Warning Banner */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Critical Security Notice — Initial Setup Only</span>
              </div>
              <p className="leading-relaxed">
                This is a single-use administrative operation. Once this account is elevated, the bootstrap endpoint permanently shuts down. Ensure you are signed in with the intended primary admin account.
              </p>
            </div>

            {/* Caller Identification Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Target Account to be Promoted:
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {profile?.full_name || session.user.email}
                  </p>
                  <p className="text-xs text-slate-400">{session.user.email}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Current Role:</span>
                  <RoleBadge role={profile?.role || 'STUDENT'} />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Server Master Secret (ADMIN_BOOTSTRAP_SECRET)
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="Enter the secret configured in .env.local"
                    disabled={isSubmitting}
                    required
                    className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Must match <code className="font-mono text-purple-600 dark:text-purple-400 font-semibold">ADMIN_BOOTSTRAP_SECRET</code> configured in server environment variables.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
                className="w-full font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/25"
              >
                Claim First Administrator Account
              </Button>
            </form>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-4 py-4 text-center text-xs text-slate-400">
        ATTENDER Institutional Security • Role-Based Access Control System
      </footer>
    </div>
  );
}

export default function BootstrapPage() {
  return (
    <ToastProvider>
      <BootstrapContent />
    </ToastProvider>
  );
}
