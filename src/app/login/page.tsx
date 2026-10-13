'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Sparkles, Mail, Lock, User, ShieldCheck, GraduationCap, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { UserRole } from '@/lib/types';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

function LoginForm() {
  const router = useRouter();
  const { error, success } = useToast();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'TEACHER' | 'ADMIN'>('TEACHER');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedState, setConfirmedState] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check URL parameters (code, token_hash, confirmed state, errors) & active session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const confirmed = searchParams.get('confirmed');
    const notice = searchParams.get('notice');
    const err = searchParams.get('error');

    // 1. If code or token_hash is in URL, delegate to /auth/callback route handler immediately
    if (code || tokenHash) {
      window.location.href = `/auth/callback${window.location.search}`;
      return;
    }

    // 2. If email was confirmed
    if (confirmed === 'true') {
      setConfirmedState(true);
      if (notice) setStatusMessage(notice);
      success('Email Confirmed', 'Your email has been verified successfully.');
    }

    // 3. If an error occurred
    if (err) {
      setErrorMessage(decodeURIComponent(err));
      error('Verification Notice', decodeURIComponent(err));
    }

    // 4. Check active session or reactive auth events (e.g. hash fragments)
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
        if (res.data.session) {
          router.replace('/dashboard');
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, session: Session | null) => {
          if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
            router.replace('/dashboard?confirmed=true');
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [router, success, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
      }

      const supabase = createClient();

      if (mode === 'signup') {
        const origin =
          typeof window !== 'undefined' && window.location.origin
            ? window.location.origin
            : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const emailRedirectTo = `${origin}/auth/callback`;

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo,
            data: {
              full_name: fullName,
              role,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (signUpData.user) {
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            full_name: fullName,
            email,
            role,
          });
        }

        if (signUpData.session) {
          success('Account Created', 'Registration successful! Directing to dashboard...');
          router.push('/dashboard');
        } else {
          success(
            'Confirmation Sent',
            'We have emailed you a confirmation link. Please check your inbox and click the link to verify.'
          );
          setStatusMessage(
            'Confirmation email sent! Please click the verification link in your email to activate your account.'
          );
          setMode('signin');
        }
      } else {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        if (signInData.user) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', signInData.user.id)
            .maybeSingle();

          if (!existingProfile) {
            await supabase.from('profiles').upsert({
              id: signInData.user.id,
              full_name: signInData.user.user_metadata?.full_name || email.split('@')[0],
              email,
              role: (signInData.user.user_metadata?.role as UserRole) || 'TEACHER',
            });
          }
        }

        success('Welcome Back', 'Signed in successfully. Redirecting to dashboard...');
        router.push('/dashboard');
      }
    } catch (err: any) {
      error('Authentication Error', err.message || 'Unable to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            ATTENDER
          </span>
        </Link>
        <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          Smart attendance. Zero hassle.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl rounded-3xl border border-slate-200 dark:border-slate-800 sm:px-10">
          {/* Confirmed / Status Banners */}
          {confirmedState && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Email Confirmed Successfully!</p>
                <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
                  {statusMessage || 'Your email address is verified. Please sign in below to access your classes.'}
                </p>
              </div>
            </div>
          )}

          {statusMessage && !confirmedState && (
            <div className="mb-6 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Verification Notice</p>
                <p className="mt-0.5 text-indigo-700 dark:text-indigo-400">{statusMessage}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Verification Error</p>
                <p className="mt-0.5 text-rose-700 dark:text-rose-400">{errorMessage}</p>
              </div>
            </div>
          )}
          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-6 text-xs font-bold">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                mode === 'signin'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Sarah Jenkins"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('TEACHER')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        role === 'TEACHER'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" /> Teacher
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('ADMIN')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        role === 'ADMIN'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" /> Admin
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="educator@school.edu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full font-bold shadow-md shadow-indigo-600/25 mt-2"
            >
              {mode === 'signin' ? 'Sign In to Dashboard' : 'Register Account'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <LoginForm />
    </ToastProvider>
  );
}
