import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface SettingsViewProps {
  signedIn: boolean;
  onDeleted: () => void;
}

interface Preferences {
  autoRefresh: boolean;
  compactLayout: boolean;
  reduceMotion: boolean;
  favoriteAlerts: boolean;
  lineupAlerts: boolean;
  gameReminders: boolean;
  timeZone: 'local' | 'eastern';
}

const DEFAULT_PREFERENCES: Preferences = {
  autoRefresh: true,
  compactLayout: true,
  reduceMotion: false,
  favoriteAlerts: true,
  lineupAlerts: true,
  gameReminders: false,
  timeZone: 'local',
};

const loadPreferences = (): Preferences => {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem('scoutcore-preferences') || '{}') };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const SettingToggle: React.FC<{
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}> = ({ title, description, enabled, onToggle }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3 rounded-lg border border-[#3b494b]/20 bg-[#131b2e] p-3 sm:p-4">
    <div className="min-w-0">
      <div className="text-sm font-bold text-[#dae2fd]">{title}</div>
      <div className="mt-0.5 text-xs leading-5 text-[#849495]">{description}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={title}
      onClick={onToggle}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-[#00e5f0]' : 'bg-[#394158]'}`}
    >
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-[#071525] transition-transform ${enabled ? 'left-1 translate-x-5' : 'left-1 translate-x-0'}`} />
    </button>
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ signedIn, onDeleted }) => {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('scoutcore-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const togglePreference = (key: keyof Omit<Preferences, 'timeZone'>) => {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  };

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
    <div className="flex min-h-screen w-full flex-col gap-5 overflow-x-hidden bg-[#0b1326] p-3 text-[#dae2fd] sm:gap-8 sm:p-6 lg:p-8">
      <div className="border-b border-[#3b494b]/20 pb-5">
        <span className="font-label-caps text-[11px] font-bold uppercase tracking-widest text-[#00f0ff]">Preferences</span>
        <h1 className="mt-1 font-display-lg text-[28px] font-bold leading-tight text-[#dae2fd] sm:text-[36px]">Settings</h1>
        <p className="mt-1 text-sm text-[#b9cacb]">Control your display, game times, alerts, and account.</p>
      </div>

      <div className="w-full max-w-3xl space-y-5">
        <section className="space-y-3 rounded-xl border border-[#3b494b]/20 bg-[#171f33] p-3 sm:p-6">
          <h2 className="px-1 font-headline-lg text-sm font-bold uppercase text-[#dae2fd]">App experience</h2>
          <SettingToggle title="Auto-refresh live data" description="Keep scores and game data current while the app is open." enabled={preferences.autoRefresh} onToggle={() => togglePreference('autoRefresh')} />
          <SettingToggle title="Compact mobile layout" description="Show more information on screen with less spacing." enabled={preferences.compactLayout} onToggle={() => togglePreference('compactLayout')} />
          <SettingToggle title="Reduce animations" description="Use fewer interface transitions and motion effects." enabled={preferences.reduceMotion} onToggle={() => togglePreference('reduceMotion')} />

          <label className="block rounded-lg border border-[#3b494b]/20 bg-[#131b2e] p-3 sm:p-4">
            <span className="text-sm font-bold text-[#dae2fd]">Game times</span>
            <span className="mt-0.5 block text-xs leading-5 text-[#849495]">Choose how game start times are displayed.</span>
            <select
              value={preferences.timeZone}
              onChange={(event) => setPreferences((current) => ({ ...current, timeZone: event.target.value as Preferences['timeZone'] }))}
              className="mt-3 w-full rounded-lg border border-[#3b494b]/40 bg-[#0d1628] px-3 py-2.5 text-sm font-bold text-[#d9faff] outline-none focus:border-[#00e5f0]"
            >
              <option value="local">My local time</option>
              <option value="eastern">Eastern Time</option>
            </select>
          </label>
        </section>

        <section className="space-y-3 rounded-xl border border-[#3b494b]/20 bg-[#171f33] p-3 sm:p-6">
          <h2 className="px-1 font-headline-lg text-sm font-bold uppercase text-[#dae2fd]">Notifications</h2>
          <SettingToggle title="Favorite team alerts" description="Get important updates for teams you follow." enabled={preferences.favoriteAlerts} onToggle={() => togglePreference('favoriteAlerts')} />
          <SettingToggle title="Confirmed lineup updates" description="Know when a starting lineup becomes official." enabled={preferences.lineupAlerts} onToggle={() => togglePreference('lineupAlerts')} />
          <SettingToggle title="Game start reminders" description="Receive a reminder shortly before followed games begin." enabled={preferences.gameReminders} onToggle={() => togglePreference('gameReminders')} />
        </section>

        {signedIn && (
          <section className="rounded-xl border border-[#fb7185]/30 bg-[#1b1320] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#fb7185]">warning</span>
              <div>
                <div className="text-[10px] font-label-caps uppercase tracking-[.18em] text-[#fb7185]">Account security</div>
                <h2 className="mt-1 font-bold text-[#fecdd3]">Delete account</h2>
                <p className="mt-1 text-sm leading-6 text-[#c8aeb8]">This permanently removes your IXMetrics login and the community posts, comments and likes tied to this account. To make sure it is really you, enter your current password first.</p>
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
