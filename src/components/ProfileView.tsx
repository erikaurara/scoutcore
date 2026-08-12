import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface ProfileViewProps {
  onOpenPremium: () => void;
}

const getInitials = (name?: string | null, email?: string | null) => {
  const source = (name || email || 'U').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
};

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenPremium }) => {
  const [user, setUser] = useState<any | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUser = async () => {
    if (!supabase) return;
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setError(userError.message);
      return;
    }
    setUser(data.user ?? null);
    setDisplayName(String(data.user?.user_metadata?.display_name || ''));
  };

  useEffect(() => { void loadUser(); }, []);

  const metadata = user?.user_metadata ?? {};
  const favoriteTeam = metadata.favorite_team;
  const favoritePlayers = Array.isArray(metadata.favorite_players) ? metadata.favorite_players : [];
  const preferredStats = Array.isArray(metadata.preferred_stats) ? metadata.preferred_stats : [];
  const notifications = metadata.notification_preferences ?? {};

  const notificationSummary = useMemo(() => {
    const labels: string[] = [];
    if (notifications.gameUpdates) labels.push('Game updates');
    if (notifications.playerNews) labels.push('Player news');
    if (notifications.injuryUpdates) labels.push('Injury updates');
    if (notifications.weeklyDigest) labels.push('Weekly digest');
    return labels;
  }, [notifications.gameUpdates, notifications.playerNews, notifications.injuryUpdates, notifications.weeklyDigest]);

  const saveProfile = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { ...metadata, display_name: displayName.trim().slice(0, 50) },
      });
      if (updateError) throw updateError;
      setUser(data.user);
      setMessage('Profile updated.');
    } catch (err: any) {
      setError(err?.message || 'Unable to update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="min-h-screen bg-[#0b1326] p-8 text-[#dae2fd]"><div className="mx-auto max-w-4xl rounded-2xl border border-[#34425a] bg-[#10192b] p-8 text-center text-sm text-[#849495]">Loading your profile…</div></div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1326] px-4 py-6 text-[#dae2fd] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-label-caps uppercase tracking-[.22em] text-[#65f2b5]">Your ScoutCoreMLB Account</div>
            <h1 className="mt-2 text-3xl font-bold text-[#dbfcff]">Profile</h1>
            <p className="mt-2 text-sm text-[#aebbc8]">Manage your account details and saved baseball preferences.</p>
          </div>
          <button onClick={onOpenPremium} className="rounded-xl border border-[#00f0ff]/35 bg-[#00f0ff]/10 px-4 py-3 text-xs font-bold text-[#7df4ff] hover:bg-[#00f0ff]/15">
            <span className="mr-2 material-symbols-outlined align-middle text-[18px]">workspace_premium</span>
            WANT PREMIUM?
          </button>
        </header>

        {error && <div className="rounded-xl border border-[#fb7185]/30 bg-[#301a24] p-3 text-sm text-[#fecdd3]">{error}</div>}
        {message && <div className="rounded-xl border border-[#65f2b5]/25 bg-[#123126] p-3 text-sm text-[#9fe8c9]">{message}</div>}

        <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#00f0ff]/35 bg-[#00f0ff]/12 text-2xl font-extrabold text-[#00f0ff]">{getInitials(displayName, user.email)}</div>
            <div className="min-w-0 flex-1">
              <label className="text-[10px] uppercase tracking-wider text-[#849495]">Display name</label>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} placeholder="Your name" className="mt-1 w-full rounded-xl border border-[#34425a] bg-[#0b1425] px-4 py-3 text-sm text-white outline-none focus:border-[#00f0ff]" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#2b3e58] bg-[#0c1627] p-3"><div className="text-[10px] uppercase text-[#718090]">Email</div><div className="mt-1 truncate text-sm font-semibold">{user.email}</div></div>
                <div className="rounded-xl border border-[#2b3e58] bg-[#0c1627] p-3"><div className="text-[10px] uppercase text-[#718090]">Member since</div><div className="mt-1 text-sm font-semibold">{user.created_at ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(user.created_at)) : '—'}</div></div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-end"><button onClick={saveProfile} disabled={saving} className="rounded-xl bg-[#00f0ff] px-5 py-3 text-xs font-extrabold text-[#00363a] disabled:opacity-50">{saving ? 'SAVING…' : 'SAVE PROFILE'}</button></div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5">
            <div className="text-[10px] uppercase tracking-wider text-[#00f0ff]">Baseball preferences</div>
            <div className="mt-4 space-y-4 text-sm">
              <div><div className="text-xs text-[#849495]">Favorite team</div><div className="mt-1 font-semibold text-[#dbfcff]">{favoriteTeam?.name || 'Not selected'}</div></div>
              <div><div className="text-xs text-[#849495]">Favorite players</div><div className="mt-2 flex flex-wrap gap-2">{favoritePlayers.length ? favoritePlayers.map((player: any) => <span key={player.id ?? player.name} className="rounded-full border border-[#30415c] bg-[#0c1627] px-3 py-1 text-xs">{player.name}</span>) : <span className="text-[#718090]">None selected</span>}</div></div>
              <div><div className="text-xs text-[#849495]">Preferred stats</div><div className="mt-2 flex flex-wrap gap-2">{preferredStats.length ? preferredStats.map((stat: string) => <span key={stat} className="rounded-full border border-[#00f0ff]/25 bg-[#00f0ff]/8 px-3 py-1 text-xs text-[#7df4ff]">{stat}</span>) : <span className="text-[#718090]">None selected</span>}</div></div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5">
            <div className="text-[10px] uppercase tracking-wider text-[#65f2b5]">Notifications</div>
            <div className="mt-4 flex flex-wrap gap-2">{notificationSummary.length ? notificationSummary.map((item) => <span key={item} className="rounded-full border border-[#65f2b5]/25 bg-[#65f2b5]/8 px-3 py-1 text-xs text-[#9fe8c9]">{item}</span>) : <span className="text-sm text-[#718090]">No notification preferences selected.</span>}</div>
            <p className="mt-4 text-xs leading-5 text-[#849495]">You can adjust system, alert and account security settings from the Settings page.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
