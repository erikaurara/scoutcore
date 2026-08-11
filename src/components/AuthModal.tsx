import React, { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const requireSupabase = () => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Account login is ready, but Supabase still needs to be connected before real accounts can be created.');
      return false;
    }
    return true;
  };

  const submit = async () => {
    setMessage(null); setError(null);
    if (!requireSupabase() || !supabase) return;
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim(), plan: 'free' } },
        });
        if (signUpError) throw signUpError;
        setMessage('Account created. Check your email if confirmation is required.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to continue.');
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setMessage(null); setError(null);
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

  return (
    <div className="fixed inset-0 z-[70] bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#3b494b]/40 bg-[#171f33] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-[#3b494b]/30 flex items-center justify-between">
          <div><div className="text-[10px] text-[#00f0ff] uppercase tracking-[.2em]">ScoutCore Account</div><h2 className="text-xl font-bold text-[#dae2fd] mt-1">{mode === 'signin' ? 'Welcome back' : 'Create your free account'}</h2></div>
          <button onClick={onClose} className="text-[#849495] hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5 space-y-4">
          {!isSupabaseConfigured && <div className="rounded-xl border border-[#fbbf24]/25 bg-[#fbbf24]/5 p-3 text-xs text-[#f5d98b]">Preview UI is ready. Real sign-in will activate after Supabase is connected.</div>}

          <button onClick={continueWithGoogle} disabled={loading} className="w-full py-3 rounded-xl bg-white text-[#172033] font-semibold text-sm flex items-center justify-center gap-3 hover:bg-[#f4f7fb] disabled:opacity-50">
            <span className="inline-flex w-5 h-5 rounded-full border border-[#d7dce5] items-center justify-center text-[11px] font-bold">G</span>
            Continue with Google
          </button>

          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-[#34425a]"/><span className="text-[10px] uppercase tracking-widest text-[#718090]">or email</span><div className="h-px flex-1 bg-[#34425a]"/></div>

          {mode === 'signup' && <div><label className="text-[10px] uppercase text-[#849495]">Display name</label><input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-lg bg-[#0f182b] border border-[#34425a] px-3 py-2 text-sm outline-none focus:border-[#00f0ff]" placeholder="Your name" /></div>}
          <div><label className="text-[10px] uppercase text-[#849495]">Email</label><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-1 w-full rounded-lg bg-[#0f182b] border border-[#34425a] px-3 py-2 text-sm outline-none focus:border-[#00f0ff]" placeholder="you@example.com" /></div>
          <div><label className="text-[10px] uppercase text-[#849495]">Password</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-[#0f182b] border border-[#34425a] px-3 py-2 text-sm outline-none focus:border-[#00f0ff]" placeholder="••••••••" /></div>
          {error && <div className="text-xs text-[#fecdd3] bg-[#301a24] border border-[#fb7185]/30 rounded-lg p-3">{error}</div>}
          {message && <div className="text-xs text-[#9fe8c9] bg-[#123126] border border-[#65f2b5]/25 rounded-lg p-3">{message}</div>}
          <button onClick={submit} disabled={loading || !email.trim() || !password} className="w-full py-3 rounded-xl bg-[#00f0ff] text-[#00363a] font-bold text-xs uppercase disabled:opacity-50">{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in with email' : 'Create free account'}</button>
          <button onClick={()=>{setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null);}} className="w-full text-xs text-[#9aabad] hover:text-[#00f0ff]">{mode === 'signin' ? 'New to ScoutCore? Create an account' : 'Already have an account? Sign in'}</button>
        </div>
      </div>
    </div>
  );
};
