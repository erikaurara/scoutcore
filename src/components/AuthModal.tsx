import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryMode?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, recoveryMode = false }) => {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recoveryMode) return;
    setMode('reset');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setMessage(null);
    setError(null);
  }, [recoveryMode]);

  if (!isOpen) return null;

  const requireSupabase = () => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Account login is ready, but Supabase still needs to be connected before real accounts can be used.');
      return false;
    }
    return true;
  };

  const resetFormMessages = () => {
    setMessage(null);
    setError(null);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    resetFormMessages();
  };

  const closeModal = async () => {
    if (mode === 'reset' && supabase) {
      await supabase.auth.signOut();
    }
    switchMode('signin');
    onClose();
  };

  const submit = async () => {
    resetFormMessages();
    if (!requireSupabase() || !supabase) return;

    if (mode === 'forgot') {
      if (!email.trim()) return;
      setLoading(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/`,
        });
        if (resetError) throw resetError;
        setMessage('Password reset link sent. Check the inbox for the email used to register your ScoutCoreMLB account.');
      } catch (err: any) {
        if (err?.code === 'over_email_send_rate_limit' || String(err?.message || '').toLowerCase().includes('rate')) {
          setError('A reset email was just requested. Please wait about a minute before requesting another one.');
        } else {
          setError(err?.message || 'Unable to send the reset link.');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'reset') {
      if (!password) return;
      if (password.length < 6) {
        setError('Use a password with at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage('Password updated. You are signed in to ScoutCoreMLB.');
        setTimeout(() => {
          switchMode('signin');
          onClose();
        }, 900);
      } catch (err: any) {
        setError(err?.message || 'Unable to update your password.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) return;

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Use a password with at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim(), plan: 'free', onboarding_complete: false },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          onClose();
          return;
        }

        setMessage('Account created. Check your email and tap the confirmation link. After you sign in, ScoutCoreMLB will guide you through a quick personalization setup.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err: any) {
      if (err?.code === 'over_email_send_rate_limit' || String(err?.message || '').includes('50 seconds')) {
        setError('An account email was just sent. Please wait about a minute before requesting another one, or check your inbox now.');
      } else {
        setError(err?.message || 'Unable to continue.');
      }
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    resetFormMessages();
    if (!requireSupabase() || !supabase) return;
    setLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err?.message || 'Unable to continue with Google.');
      setLoading(false);
    }
  };

  const title = mode === 'signin'
    ? 'Log in'
    : mode === 'signup'
      ? 'Create a free account'
      : mode === 'forgot'
        ? 'Reset your password'
        : 'Choose a new password';

  const primaryLabel = loading
    ? 'Please wait…'
    : mode === 'signin'
      ? 'Log in'
      : mode === 'signup'
        ? 'Create free account'
        : mode === 'forgot'
          ? 'Send reset link'
          : 'Update password';

  const primaryDisabled = loading
    || (mode === 'forgot' && !email.trim())
    || (mode === 'reset' && (!password || !confirmPassword))
    || (mode === 'signin' && (!email.trim() || !password))
    || (mode === 'signup' && (!email.trim() || !password || !confirmPassword));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#060e20]/85 p-4 backdrop-blur-md" onClick={closeModal}>
      <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[#3b494b]/40 bg-[#171f33] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#3b494b]/30 p-5">
          <div>
            <div className="text-[10px] uppercase tracking-[.22em] text-[#00f0ff]">ScoutCoreMLB Access</div>
            <h2 className="mt-1 text-2xl font-bold text-white">{title}</h2>
          </div>
          <button onClick={closeModal} className="text-[#849495] hover:text-white" aria-label="Close account window">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {!isSupabaseConfigured && (
            <div className="rounded-xl border border-[#fbbf24]/25 bg-[#fbbf24]/5 p-3 text-xs text-[#f5d98b]">
              Real sign-in will activate after Supabase is connected.
            </div>
          )}

          {mode === 'forgot' && (
            <p className="text-sm leading-relaxed text-[#9aabad]">Enter the email used to register your account. We’ll send the password-reset link there.</p>
          )}

          {mode === 'reset' && (
            <p className="text-sm leading-relaxed text-[#9aabad]">Enter and confirm a new password for your ScoutCoreMLB account.</p>
          )}

          {mode === 'signup' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">Display name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg border border-[#34425a] bg-[#0f182b] px-3 py-2.5 text-sm outline-none focus:border-[#00f0ff]" placeholder="Your name" />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">Email</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1 w-full rounded-lg border border-[#34425a] bg-[#0f182b] px-3 py-2.5 text-sm outline-none focus:border-[#00f0ff]" placeholder="you@example.com" />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={6}
                  className="w-full rounded-lg border border-[#34425a] bg-[#0f182b] py-2.5 pl-3 pr-11 text-sm outline-none focus:border-[#00f0ff]"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#849495] hover:text-[#00f0ff]">
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
          )}

          {(mode === 'signup' || mode === 'reset') && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">Confirm {mode === 'reset' ? 'new ' : ''}password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full rounded-lg border border-[#34425a] bg-[#0f182b] py-2.5 pl-3 pr-11 text-sm outline-none focus:border-[#00f0ff]"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#849495] hover:text-[#00f0ff]">
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
          )}

          {error && <div className="rounded-lg border border-[#fb7185]/30 bg-[#301a24] p-3 text-xs text-[#fecdd3]">{error}</div>}
          {message && <div className="rounded-lg border border-[#65f2b5]/25 bg-[#123126] p-3 text-xs text-[#9fe8c9]">{message}</div>}

          <button onClick={submit} disabled={primaryDisabled} className="w-full rounded-xl bg-[#00f0ff] py-3.5 text-xs font-extrabold uppercase tracking-wide text-[#00363a] hover:bg-[#7df4ff] disabled:opacity-50">
            {primaryLabel}
          </button>

          {mode === 'signin' && (
            <>
              <button type="button" onClick={() => switchMode('forgot')} className="w-full text-center text-xs font-medium text-[#00f0ff] hover:text-white">Forgot password?</button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-[#34425a]" />
                <span className="text-[10px] uppercase tracking-widest text-[#718090]">or</span>
                <div className="h-px flex-1 bg-[#34425a]" />
              </div>

              <button onClick={continueWithGoogle} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3 text-sm font-semibold text-[#172033] hover:bg-[#f4f7fb] disabled:opacity-50">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d7dce5] text-[11px] font-bold">G</span>
                Continue with Google
              </button>

              <button onClick={() => switchMode('signup')} className="w-full rounded-xl border border-[#00f0ff] py-3 text-xs font-bold uppercase tracking-wide text-[#7df4ff] hover:bg-[#00f0ff]/5">Create a free account</button>

              <div className="mt-2 rounded-2xl border border-[#34425a] bg-[#10192b] p-5">
                <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#00f0ff]">ScoutCoreMLB Access</div>
                <h3 className="mt-2 text-lg font-bold text-white">Scout for free. Sign up when you want more.</h3>
                <p className="mt-2 text-sm leading-6 text-[#aebbd0]">No account is required to explore ScoutCoreMLB. Search players, check games and use the core baseball tools immediately. A free account unlocks personalized scouting features.</p>
                <div className="mt-4 grid gap-2 text-xs text-[#91a0b5] sm:grid-cols-3">
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#00f0ff]">bookmark</span>Saved preferences</div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#00f0ff]">groups</span>Community posting</div>
                  <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#00f0ff]">analytics</span>Scouting reports</div>
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[#718090]"><span className="material-symbols-outlined text-[16px]">lock</span>No credit card required.</div>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <>
              <p className="text-center text-xs leading-5 text-[#91a0b5]">After your account is confirmed, we’ll help you choose your favorite team, players, stats and notification preferences.</p>
              <button onClick={() => switchMode('signin')} className="w-full text-xs text-[#9aabad] hover:text-[#00f0ff]">Already have an account? Log in</button>
            </>
          )}

          {mode === 'forgot' && (
            <button onClick={() => switchMode('signin')} className="w-full text-xs text-[#9aabad] hover:text-[#00f0ff]">Back to log in</button>
          )}
        </div>
      </div>
    </div>
  );
};
