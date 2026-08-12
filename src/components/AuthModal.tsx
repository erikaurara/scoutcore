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
    // A password-recovery link creates a temporary authenticated session.
    // If the user cancels without choosing a new password, sign that recovery
    // session out instead of leaving it active as a normal account session.
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
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim(), plan: 'free' },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          onClose();
          return;
        }

        setMessage('Account created. Check your email and tap the confirmation link. You will return to ScoutCoreMLB signed in.');
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
    ? 'Welcome back'
    : mode === 'signup'
      ? 'Create your free account'
      : mode === 'forgot'
        ? 'Reset your password'
        : 'Choose a new password';

  const primaryLabel = loading
    ? 'Please wait…'
    : mode === 'signin'
      ? 'Sign in with email'
      : mode === 'signup'
        ? 'Create free account'
        : mode === 'forgot'
          ? 'Send reset link'
          : 'Update password';

  const primaryDisabled = loading
    || (mode === 'forgot' && !email.trim())
    || (mode === 'reset' && (!password || !confirmPassword))
    || ((mode === 'signin' || mode === 'signup') && (!email.trim() || !password));

  return (
    <div className="fixed inset-0 z-[70] bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4" onClick={closeModal}>
      <div className="w-full max-w-md rounded-2xl border border-[#3b494b]/40 bg-[#171f33] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#3b494b]/30 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#00f0ff] uppercase tracking-[.2em]">ScoutCoreMLB Account</div>
            <h2 className="text-xl font-bold text-[#dae2fd] mt-1">{title}</h2>
          </div>
          <button onClick={closeModal} className="text-[#849495] hover:text-white" aria-label="Close account window">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!isSupabaseConfigured && (
            <div className="rounded-xl border border-[#fbbf24]/25 bg-[#fbbf24]/5 p-3 text-xs text-[#f5d98b]">
              Real sign-in will activate after Supabase is connected.
            </div>
          )}

          {(mode === 'signin' || mode === 'signup') && (
            <>
              <button onClick={continueWithGoogle} disabled={loading} className="w-full py-3 rounded-xl bg-white text-[#172033] font-semibold text-sm flex items-center justify-center gap-3 hover:bg-[#f4f7fb] disabled:opacity-50">
                <span className="inline-flex w-5 h-5 rounded-full border border-[#d7dce5] items-center justify-center text-[11px] font-bold">G</span>
                Continue with Google
              </button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#34425a]" />
                <span className="text-[10px] uppercase tracking-widest text-[#718090]">or email</span>
                <div className="h-px flex-1 bg-[#34425a]" />
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <p className="text-sm text-[#9aabad] leading-relaxed">
              Enter the email used to register your account. We’ll send the password-reset link there.
            </p>
          )}

          {mode === 'reset' && (
            <p className="text-sm text-[#9aabad] leading-relaxed">
              Enter a new password for your ScoutCoreMLB account.
            </p>
          )}

          {mode === 'signup' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">Display name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1 w-full rounded-lg bg-[#0f182b] border border-[#34425a] px-3 py-2 text-sm outline-none focus:border-[#00f0ff]" placeholder="Your name" />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1 w-full rounded-lg bg-[#0f182b] border border-[#34425a] px-3 py-2 text-sm outline-none focus:border-[#00f0ff]" placeholder="you@example.com" />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">{mode === 'reset' ? 'New password' : 'Password'}</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={6}
                  className="w-full rounded-lg bg-[#0f182b] border border-[#34425a] pl-3 pr-11 py-2 text-sm outline-none focus:border-[#00f0ff]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-[#849495] hover:text-[#00f0ff] focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <div>
              <label className="text-[10px] uppercase text-[#849495]">Confirm new password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full rounded-lg bg-[#0f182b] border border-[#34425a] pl-3 pr-11 py-2 text-sm outline-none focus:border-[#00f0ff]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-[#849495] hover:text-[#00f0ff] focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'signin' && (
            <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-[#00f0ff] hover:text-white">
              Forgot password?
            </button>
          )}

          {error && <div className="text-xs text-[#fecdd3] bg-[#301a24] border border-[#fb7185]/30 rounded-lg p-3">{error}</div>}
          {message && <div className="text-xs text-[#9fe8c9] bg-[#123126] border border-[#65f2b5]/25 rounded-lg p-3">{message}</div>}

          <button onClick={submit} disabled={primaryDisabled} className="w-full py-3 rounded-xl bg-[#00f0ff] text-[#00363a] font-bold text-xs uppercase disabled:opacity-50">
            {primaryLabel}
          </button>

          {mode === 'signin' && (
            <button onClick={() => switchMode('signup')} className="w-full text-xs text-[#9aabad] hover:text-[#00f0ff]">New to ScoutCoreMLB? Create an account</button>
          )}
          {mode === 'signup' && (
            <button onClick={() => switchMode('signin')} className="w-full text-xs text-[#9aabad] hover:text-[#00f0ff]">Already have an account? Sign in</button>
          )}
          {mode === 'forgot' && (
            <button onClick={() => switchMode('signin')} className="w-full text-xs text-[#9aabad] hover:text-[#00f0ff]">Back to sign in</button>
          )}
        </div>
      </div>
    </div>
  );
};
