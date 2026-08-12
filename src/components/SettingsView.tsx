import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface SettingsViewProps {
  signedIn: boolean;
  onDeleted: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ signedIn, onDeleted }) => {
  const [dataSync, setDataSync] = useState(true);
  const [highLeverageAlerts, setHighLeverageAlerts] = useState(true);
  const [modelMode, setModelMode] = useState('statcast-v4');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteAccount = async () => {
    if (!supabase || !signedIn || !confirmPassword) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = userData.user?.email;
      if (!email) throw new Error('We could not verify the email for this account.');

      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: confirmPassword });
      if (verifyError) throw new Error('That password is incorrect. Please try again.');

      const { error: functionError } = await supabase.functions.invoke('delete-account', {
        body: { password: confirmPassword },
      });
      if (functionError) throw functionError;

      await supabase.auth.signOut().catch(() => undefined);
      onDeleted();
    } catch (err: any) {
      setDeleteError(err?.message || 'Unable to delete this account right now.');
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col gap-8 bg-[#0b1326] p-4 text-[#dae2fd] sm:p-6 lg:p-8">
      <div className="border-b border-[#3b494b]/20 pb-6">
        <span className="font-label-caps text-xs font-bold uppercase tracking-widest text-[#00f0ff]">System Tools</span>
        <h1 className="font-display-lg text-[32px] font-bold leading-tight text-[#dae2fd] sm:text-[36px]">ScoutCore Settings & Preferences</h1>
        <p className="text-sm text-[#b9cacb]">Configure data sync, model settings, alerts and account security.</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="space-y-4 rounded-xl border border-[#3b494b]/20 bg-[#171f33] p-6">
          <h2 className="font-headline-lg text-sm font-bold uppercase text-[#dae2fd]">Data Feed & Syncing</h2>

          <div className="flex items-center justify-between rounded-lg border border-[#3b494b]/20 bg-[#131b2e] p-3">
            <div>
              <div className="text-xs font-bold text-[#dae2fd]">Live Statcast Auto-Sync</div>
              <div className="text-[10px] text-[#849495]">Synchronize pitch velocity, spin rates, and launch angles in real-time.</div>
            </div>
            <button onClick={() => setDataSync(!dataSync)} className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors ${dataSync ? 'bg-[#00f0ff]' : 'bg-[#2d3449]'}`}>
              <div className={`h-4 w-4 rounded-full bg-[#002022] transition-transform ${dataSync ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#3b494b]/20 bg-[#131b2e] p-3">
            <div>
              <div className="text-xs font-bold text-[#dae2fd]">High-Leverage Signal Alerts</div>
              <div className="text-[10px] text-[#849495]">Notify when pitch-velocity or spin rate deviations cross 1.5 standard deviations.</div>
            </div>
            <button onClick={() => setHighLeverageAlerts(!highLeverageAlerts)} className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors ${highLeverageAlerts ? 'bg-[#00f0ff]' : 'bg-[#2d3449]'}`}>
              <div className={`h-4 w-4 rounded-full bg-[#002022] transition-transform ${highLeverageAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-[#3b494b]/20 bg-[#171f33] p-6">
          <h2 className="font-headline-lg text-sm font-bold uppercase text-[#dae2fd]">Prediction Engine Model</h2>
          <div className="space-y-2">
            <label className="block text-xs font-mono text-[#849495]">Active Predictive Algorithm</label>
            <select value={modelMode} onChange={(e) => setModelMode(e.target.value)} className="w-full rounded-lg border border-[#3b494b]/40 bg-[#131b2e] p-3 text-xs font-mono text-[#00f0ff] focus:outline-none">
              <option value="statcast-v4">Statcast v4 (xg wOBA + Stuff+ Neural Net)</option>
              <option value="pitch-fxx">PitchF/X Historical Baseline</option>
              <option value="bayes-leverage">Bayesian High-Leverage Win Probability</option>
            </select>
          </div>
        </div>

        {signedIn && (
          <section className="rounded-xl border border-[#fb7185]/30 bg-[#1b1320] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#fb7185]">warning</span>
              <div>
                <div className="text-[10px] font-label-caps uppercase tracking-[.18em] text-[#fb7185]">Account security</div>
                <h2 className="mt-1 font-bold text-[#fecdd3]">Delete account</h2>
                <p className="mt-1 text-sm leading-6 text-[#c8aeb8]">This permanently removes your ScoutCoreMLB login and the community posts, comments and likes tied to this account. To make sure it is really you, enter your current password first.</p>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#c8aeb8]">Confirm password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your current password"
                  className="w-full rounded-xl border border-[#6d3546] bg-[#120d14] py-3 pl-4 pr-12 text-sm text-white outline-none focus:border-[#fb7185]"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#9d7785] hover:text-[#fecdd3]">
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {deleteError && <div className="mt-3 rounded-lg border border-[#fb7185]/30 bg-[#301a24] p-3 text-xs text-[#fecdd3]">{deleteError}</div>}

            <div className="mt-4 flex justify-end">
              <button onClick={deleteAccount} disabled={!confirmPassword || deleting} className="rounded-xl border border-[#fb7185]/50 bg-[#fb7185]/10 px-5 py-3 text-xs font-extrabold text-[#fecdd3] hover:bg-[#fb7185]/15 disabled:cursor-not-allowed disabled:opacity-40">{deleting ? 'DELETING…' : 'DELETE ACCOUNT'}</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
