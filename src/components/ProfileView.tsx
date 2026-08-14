import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { PrivateConnectionsPanel } from './PrivateConnectionsPanel';

interface ProfileViewProps {
  onOpenPremium: () => void;
  onOpenChallenge: () => void;
  onOpenSettings: () => void;
}

type SavedSelection = {
  type?: string | null;
  scope?: 'batter' | 'pitcher' | 'game' | null;
  result?: 'pending' | 'correct' | 'incorrect' | 'void' | null;
};

type ChallengeCardRow = {
  status?: string | null;
  ticket_kind?: string | null;
  week_key?: string | null;
  correct_count?: number | null;
  settled_count?: number | null;
  points?: number | null;
  selections?: SavedSelection[] | null;
  created_at?: string | null;
  settled_at?: string | null;
};

type ChallengeScoreRow = {
  user_id?: string | null;
  display_name?: string | null;
  points?: number | null;
  correct_picks?: number | null;
  total_picks?: number | null;
  current_streak?: number | null;
  best_streak?: number | null;
  perfect_cards?: number | null;
  monthly_points?: number | null;
  monthly_correct_picks?: number | null;
  monthly_total_picks?: number | null;
  hitting_correct_picks?: number | null;
  hitting_total_picks?: number | null;
  pitching_correct_picks?: number | null;
  pitching_total_picks?: number | null;
  team_correct_picks?: number | null;
  team_total_picks?: number | null;
};

type ScoutLevel = {
  name: string;
  min: number;
  next: number | null;
  icon: string;
  accent: string;
};

type ProfileBadge = {
  name: string;
  icon: string;
  earned: boolean;
  detail: string;
  accent: string;
  soft: string;
};

const MIN_LEADERBOARD_PICKS = 20;

const SCOUT_LEVELS: ScoutLevel[] = [
  { name: 'Rookie Scout', min: 0, next: 250, icon: 'explore', accent: '#65f2b5' },
  { name: 'Advanced Scout', min: 250, next: 750, icon: 'travel_explore', accent: '#54dff0' },
  { name: 'Pro Scout', min: 750, next: 2000, icon: 'workspace_premium', accent: '#a78bfa' },
  { name: 'Elite Scout', min: 2000, next: 5000, icon: 'diamond', accent: '#ffd166' },
  { name: 'ScoutCore All-Star', min: 5000, next: null, icon: 'stars', accent: '#ff9d69' },
];

const getInitials = (name?: string | null, email?: string | null) => {
  const source = (name || email || 'U').trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
};

const weekKeyUTC = () => {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
};

const pct = (correct: number, total: number) => total ? `${Math.round((correct / total) * 100)}%` : '—';
const scoreAccuracy = (row: ChallengeScoreRow) => Number(row.total_picks || 0) ? Number(row.correct_picks || 0) / Number(row.total_picks || 0) : 0;
const monthlyAccuracy = (row: ChallengeScoreRow) => Number(row.monthly_total_picks || 0) ? Number(row.monthly_correct_picks || 0) / Number(row.monthly_total_picks || 0) : 0;

const scoutLevelFor = (points: number) => {
  const current = [...SCOUT_LEVELS].reverse().find((level) => points >= level.min) ?? SCOUT_LEVELS[0];
  const progress = current.next == null ? 100 : Math.max(0, Math.min(100, ((points - current.min) / (current.next - current.min)) * 100));
  return { ...current, progress };
};

const scopeForSelection = (selection: SavedSelection) => {
  if (selection.scope) return selection.scope;
  const type = String(selection.type || '');
  if (type.startsWith('pitcher_')) return 'pitcher';
  if (type.startsWith('hitter_')) return 'batter';
  return 'game';
};

export const ProfileView: React.FC<ProfileViewProps> = ({ onOpenChallenge, onOpenSettings }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profileResolved, setProfileResolved] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challengeCards, setChallengeCards] = useState<ChallengeCardRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<ChallengeScoreRow[]>([]);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const loadChallenge = async (userId: string) => {
    if (!supabase) return;
    const [cardsResult, scoresResult] = await Promise.all([
      supabase.from('challenge_cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
      supabase.from('challenge_scores').select('*').limit(1000),
    ]);
    if (!cardsResult.error) setChallengeCards((cardsResult.data ?? []) as ChallengeCardRow[]);
    if (!scoresResult.error) setLeaderboard((scoresResult.data ?? []) as ChallengeScoreRow[]);
  };

  const applyUser = (nextUser: any | null) => {
    setUser(nextUser);
    setDisplayName(String(nextUser?.user_metadata?.display_name || ''));
    if (nextUser?.id) void loadChallenge(nextUser.id);
  };

  const loadUser = async () => {
    if (!supabase) { setProfileResolved(true); return; }
    setError(null);
    try {
      const sessionResult = await Promise.race([
        supabase.auth.getSession(),
        new Promise<any>((resolve) => window.setTimeout(() => resolve({ data: { session: null }, error: new Error('Session check timed out') }), 4500)),
      ]);
      const sessionUser = sessionResult?.data?.session?.user ?? null;
      if (sessionUser) {
        applyUser(sessionUser);
        return;
      }

      const userResult = await Promise.race([
        supabase.auth.getUser(),
        new Promise<any>((resolve) => window.setTimeout(() => resolve({ data: { user: null }, error: new Error('Profile request timed out') }), 4500)),
      ]);
      if (userResult?.error) throw userResult.error;
      applyUser(userResult?.data?.user ?? null);
    } catch (err: any) {
      setError(err?.message || 'Unable to load your profile.');
    } finally {
      setProfileResolved(true);
    }
  };

  useEffect(() => { void loadUser(); }, []);

  const metadata = user?.user_metadata ?? {};
  const avatarUrl = String(metadata.avatar_url || '');
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

  const challengeSummary = useMemo(() => {
    const currentWeek = weekKeyUTC();
    const weekly = challengeCards.filter((card) => card.week_key === currentWeek);
    const rankedUsed = weekly.filter((card) => (card.ticket_kind || 'ranked') === 'ranked').length;
    const upcoming = challengeCards.filter((card) => card.status === 'upcoming').length;
    const finished = challengeCards.filter((card) => card.status === 'finished').length;
    const allCorrect = challengeCards.reduce((sum, card) => sum + Number(card.correct_count || 0), 0);
    const allSettled = challengeCards.reduce((sum, card) => sum + Number(card.settled_count || 0), 0);
    const perfectCardsLocal = challengeCards.filter((card) => Number(card.settled_count || 0) > 1 && Number(card.correct_count || 0) === Number(card.settled_count || 0)).length;
    const monthCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = challengeCards.filter((card) => {
      const value = card.settled_at || card.created_at;
      return value ? new Date(value).getTime() >= monthCutoff : false;
    });
    const monthCorrect = recent.reduce((sum, card) => sum + Number(card.correct_count || 0), 0);
    const monthSettled = recent.reduce((sum, card) => sum + Number(card.settled_count || 0), 0);

    const eligibleOverall = [...leaderboard]
      .filter((row) => Number(row.total_picks || 0) >= MIN_LEADERBOARD_PICKS)
      .sort((a, b) => scoreAccuracy(b) - scoreAccuracy(a)
        || Number(b.correct_picks || 0) - Number(a.correct_picks || 0)
        || Number(b.current_streak || 0) - Number(a.current_streak || 0)
        || Number(b.points || 0) - Number(a.points || 0));
    const eligibleMonthly = [...leaderboard]
      .filter((row) => Number(row.monthly_total_picks || 0) >= MIN_LEADERBOARD_PICKS)
      .sort((a, b) => monthlyAccuracy(b) - monthlyAccuracy(a)
        || Number(b.monthly_correct_picks || 0) - Number(a.monthly_correct_picks || 0)
        || Number(b.current_streak || 0) - Number(a.current_streak || 0)
        || Number(b.monthly_points || 0) - Number(a.monthly_points || 0));

    const score = leaderboard.find((row) => row.user_id === user?.id) ?? null;
    const rankIndex = eligibleOverall.findIndex((row) => row.user_id === user?.id);
    const monthlyRankIndex = eligibleMonthly.findIndex((row) => row.user_id === user?.id);
    const settledSelections = challengeCards
      .flatMap((card) => Array.isArray(card.selections) ? card.selections : [])
      .filter((selection) => selection.result === 'correct' || selection.result === 'incorrect');
    const batterSelections = settledSelections.filter((selection) => scopeForSelection(selection) === 'batter');
    const pitcherSelections = settledSelections.filter((selection) => scopeForSelection(selection) === 'pitcher');
    const batterCorrect = batterSelections.filter((selection) => selection.result === 'correct').length;
    const pitcherCorrect = pitcherSelections.filter((selection) => selection.result === 'correct').length;

    return {
      rankedRemaining: Math.max(0, 5 - rankedUsed), upcoming, finished, allCorrect, allSettled, monthCorrect, monthSettled,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      monthlyRank: monthlyRankIndex >= 0 ? monthlyRankIndex + 1 : null,
      points: Number(score?.points || 0), currentStreak: Number(score?.current_streak || 0), bestStreak: Number(score?.best_streak || 0),
      perfectCards: Number(score?.perfect_cards ?? perfectCardsLocal),
      batterCorrect: Number(score?.hitting_correct_picks ?? batterCorrect), batterTotal: Number(score?.hitting_total_picks ?? batterSelections.length),
      pitcherCorrect: Number(score?.pitching_correct_picks ?? pitcherCorrect), pitcherTotal: Number(score?.pitching_total_picks ?? pitcherSelections.length),
      leaderboardEligible: Number(score?.total_picks || allSettled) >= MIN_LEADERBOARD_PICKS,
    };
  }, [challengeCards, leaderboard, user?.id]);

  const scoutLevel = useMemo(() => scoutLevelFor(challengeSummary.points), [challengeSummary.points]);

  const badges = useMemo<ProfileBadge[]>(() => {
    const batterAccuracy = challengeSummary.batterTotal ? challengeSummary.batterCorrect / challengeSummary.batterTotal : 0;
    const pitcherAccuracy = challengeSummary.pitcherTotal ? challengeSummary.pitcherCorrect / challengeSummary.pitcherTotal : 0;
    return [
      { name: 'Hot Streak', icon: 'local_fire_department', earned: challengeSummary.currentStreak >= 5, detail: 'Reach a 5-pick correct streak.', accent: '#ff693d', soft: 'rgba(255,105,61,.16)' },
      { name: 'Pitching Expert', icon: 'sports_baseball', earned: challengeSummary.pitcherTotal >= 20 && pitcherAccuracy >= .70, detail: '70%+ accuracy across 20 pitcher picks.', accent: '#20e8f1', soft: 'rgba(32,232,241,.14)' },
      { name: 'Hit Predictor', icon: 'track_changes', earned: challengeSummary.batterTotal >= 20 && batterAccuracy >= .70, detail: '70%+ accuracy across 20 batter picks.', accent: '#a78bfa', soft: 'rgba(167,139,250,.15)' },
      { name: 'Perfect Card', icon: 'verified', earned: challengeSummary.perfectCards >= 1, detail: 'Finish a Challenge Card with every settled pick correct.', accent: '#65f2b5', soft: 'rgba(101,242,181,.14)' },
      { name: '100 Correct Picks', icon: 'military_tech', earned: challengeSummary.allCorrect >= 100, detail: 'Record 100 correct Challenge predictions.', accent: '#ffc857', soft: 'rgba(255,200,87,.15)' },
      { name: 'Top 10 This Month', icon: 'leaderboard', earned: Boolean(challengeSummary.monthlyRank && challengeSummary.monthlyRank <= 10), detail: 'Finish in the monthly leaderboard Top 10.', accent: '#d88cff', soft: 'rgba(216,140,255,.15)' },
    ];
  }, [challengeSummary]);

  const earnedBadges = useMemo(() => badges.filter((badge) => badge.earned), [badges]);

  const saveProfile = async () => {
    if (!supabase || !user) return;
    setSaving(true); setMessage(null); setError(null);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ data: { ...metadata, display_name: displayName.trim().slice(0, 50) } });
      if (updateError) throw updateError;
      setUser(data.user); setMessage('Profile updated.');
    } catch (err: any) { setError(err?.message || 'Unable to update your profile.'); }
    finally { setSaving(false); }
  };

  const uploadAvatar = async (file?: File | null) => {
    if (!file || !supabase || !user) return;
    setMessage(null); setError(null);
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) { setError('Choose a JPG, PNG, WebP, or GIF image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Profile photos must be 5 MB or smaller.'); return; }
    setUploadingAvatar(true);
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1] || 'jpg';
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const previousPath = String(metadata.avatar_path || '');
    try {
      const uploaded = await supabase.storage.from('profile-avatars').upload(path, file, { upsert: false, contentType: file.type });
      if (uploaded.error) throw uploaded.error;
      const publicUrl = supabase.storage.from('profile-avatars').getPublicUrl(path).data.publicUrl;
      const { data, error: updateError } = await supabase.auth.updateUser({ data: { ...metadata, avatar_url: publicUrl, avatar_path: path } });
      if (updateError) throw updateError;
      if (previousPath && previousPath !== path) await supabase.storage.from('profile-avatars').remove([previousPath]).catch(() => {});
      setUser(data.user); setMessage('Profile photo updated.');
    } catch (err: any) {
      await supabase.storage.from('profile-avatars').remove([path]).catch(() => {});
      setError(err?.message || 'Unable to upload your profile photo.');
    } finally { setUploadingAvatar(false); if (avatarInputRef.current) avatarInputRef.current.value = ''; }
  };

  const removeAvatar = async () => {
    if (!supabase || !user || !metadata.avatar_path) return;
    setUploadingAvatar(true); setMessage(null); setError(null);
    try {
      const oldPath = String(metadata.avatar_path);
      const { data, error: updateError } = await supabase.auth.updateUser({ data: { ...metadata, avatar_url: null, avatar_path: null } });
      if (updateError) throw updateError;
      await supabase.storage.from('profile-avatars').remove([oldPath]).catch(() => {});
      setUser(data.user); setMessage('Profile photo removed.');
    } catch (err: any) { setError(err?.message || 'Unable to remove your profile photo.'); }
    finally { setUploadingAvatar(false); }
  };

  if (!user) {
    return <div className="min-h-screen bg-[#0b1326] p-8 text-[#dae2fd]"><div className="mx-auto max-w-4xl rounded-2xl border border-[#34425a] bg-[#10192b] p-8 text-center text-sm text-[#849495]">
      {!profileResolved ? 'Loading your profile…' : <div><div className="text-white">We could not load your signed-in profile.</div>{error && <div className="mt-2 text-xs text-[#ffb0b5]">{error}</div>}<button type="button" onClick={() => { setProfileResolved(false); void loadUser(); }} className="mt-4 rounded-xl border border-[#00f0ff]/50 px-4 py-2 text-xs font-bold text-[#7df4ff]">TRY AGAIN</button></div>}
    </div></div>;
  }

  const joined = user.created_at ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(user.created_at)) : '—';
  const nextLevelCopy = scoutLevel.next == null ? 'Highest Scout level reached' : `${Math.max(0, scoutLevel.next - challengeSummary.points)} points to next level`;

  return (
    <div className="min-h-screen bg-[#0b1326] px-4 py-6 text-[#dae2fd] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-2xl border border-[#2a405b] bg-[#101a2d]">
          <div className="relative h-28 bg-[radial-gradient(circle_at_15%_10%,rgba(0,240,255,.23),transparent_35%),linear-gradient(120deg,#17254a,#0d1426_55%,#101a2d)] sm:h-36">
            <button onClick={onOpenSettings} aria-label="Open settings" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#07101f]/60 text-white backdrop-blur hover:border-[#00f0ff]/45"><span className="material-symbols-outlined">settings</span></button>
          </div>
          <div className="px-5 pb-5 sm:px-7 sm:pb-7">
            <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-[#101a2d] bg-[#0b1425] shadow-xl sm:h-28 sm:w-28">
                  {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-[#00f0ff]/12 text-3xl font-extrabold text-[#00f0ff]">{getInitials(displayName, user.email)}</div>}
                  {uploadingAvatar && <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-bold text-white">UPLOADING…</div>}
                </div>
                <div className="pb-1"><div className="text-xs text-[#91a0b5]">Joined {joined}</div><h1 className="mt-1 text-3xl font-extrabold text-white">{displayName.trim() || user.email?.split('@')[0] || 'ScoutCore User'}</h1><div className="mt-1 text-sm text-[#849495]">{user.email}</div></div>
              </div>
              <button onClick={onOpenChallenge} className="min-w-[230px] rounded-2xl border border-[#00f0ff]/30 bg-[#071827]/85 p-4 text-left shadow-[0_12px_40px_rgba(0,240,255,.08)] transition hover:border-[#00f0ff]/55">
                <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5" style={{ color: scoutLevel.accent }}><span className="material-symbols-outlined">{scoutLevel.icon}</span></div><div className="min-w-0 flex-1"><div className="text-[9px] font-extrabold uppercase tracking-[.16em] text-[#7df4ff]">Scout Level</div><div className="mt-0.5 truncate text-base font-extrabold text-white">{scoutLevel.name}</div><div className="text-[10px] text-[#91a0b5]">{challengeSummary.points.toLocaleString()} ScoutCore Points</div></div></div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#26364d]"><div className="h-full rounded-full bg-[#00e6f4] transition-all" style={{ width: `${scoutLevel.progress}%` }} /></div>
                <div className="mt-2 flex items-center justify-between text-[9px] text-[#718090]"><span>{nextLevelCopy}</span>{scoutLevel.next != null && <span>{scoutLevel.next.toLocaleString()}</span>}</div>
                {earnedBadges.length > 0 && <div className="mt-3 border-t border-[#243a53] pt-3"><div className="mb-2 text-[8px] font-extrabold uppercase tracking-[.14em] text-[#8fa1b6]">Earned badges</div><div className="flex flex-wrap gap-1.5">{earnedBadges.map((badge) => <span key={badge.name} title={badge.name} className="flex h-7 w-7 items-center justify-center rounded-full border" style={{ color: badge.accent, background: badge.soft, borderColor: `${badge.accent}55` }}><span className="material-symbols-outlined text-[17px]">{badge.icon}</span></span>)}</div></div>}
              </button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2"><input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0])} /><button onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar} className="rounded-xl bg-[#00f0ff] px-4 py-2.5 text-xs font-extrabold text-[#00363a] disabled:opacity-50"><span className="material-symbols-outlined mr-1 align-middle text-[17px]">photo_camera</span>{avatarUrl ? 'CHANGE PHOTO' : 'ADD PROFILE PHOTO'}</button>{avatarUrl && <button onClick={() => void removeAvatar()} disabled={uploadingAvatar} className="rounded-xl border border-[#3a4b63] px-4 py-2.5 text-xs font-bold text-[#aebbd0] hover:border-[#ff8d94]/50 hover:text-[#ffb0b5]">REMOVE PHOTO</button>}<span className="self-center text-[11px] text-[#718090]">JPG, PNG, WebP or GIF · max 5 MB</span></div>
          </div>
        </section>

        {error && <div className="rounded-xl border border-[#fb7185]/30 bg-[#301a24] p-3 text-sm text-[#fecdd3]">{error}</div>}
        {message && <div className="rounded-xl border border-[#65f2b5]/25 bg-[#123126] p-3 text-sm text-[#9fe8c9]">{message}</div>}

        <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-3 sm:p-4"><div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#65f2b5]">ScoutCore Activity</div><div className="divide-y divide-[#2a405b] overflow-hidden rounded-xl border border-[#263951] bg-[#0c1627]"><ProfileLink icon="emoji_events" title="Weekly Challenge" detail={`${challengeSummary.rankedRemaining}/5 ranked cards remaining this week`} onClick={onOpenChallenge} /><ProfileLink icon="track_changes" title="My Predictions" detail={`${challengeSummary.upcoming} upcoming · ${challengeSummary.finished} finished`} onClick={onOpenChallenge} /><ProfileLink icon="leaderboard" title="Leaderboards" detail={challengeSummary.rank ? `Rank #${challengeSummary.rank} · ${challengeSummary.points} ScoutCore Points` : challengeSummary.leaderboardEligible ? 'Leaderboard rank is being calculated' : `Complete ${Math.max(0, MIN_LEADERBOARD_PICKS - challengeSummary.allSettled)} more picks to qualify`} onClick={onOpenChallenge} /></div></section>

        <PrivateConnectionsPanel />

        <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-[#00f0ff]">Scout Badges</div><h2 className="mt-1 text-xl font-extrabold text-white">Achievements</h2></div><span className="text-xs text-[#718090]">{earnedBadges.length}/{badges.length} earned</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{badges.map((badge) => <div key={badge.name} className={`rounded-xl border p-4 ${badge.earned ? 'border-[#3a506d] bg-[#0d1d31]' : 'border-[#2b3e58] bg-[#0c1627] opacity-65'}`}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ color: badge.accent, background: badge.soft, borderColor: `${badge.accent}55`, boxShadow: badge.earned ? `0 0 18px ${badge.accent}1f` : undefined }}><span className="material-symbols-outlined">{badge.icon}</span></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="text-sm font-bold text-white">{badge.name}</div>{badge.earned && <span className="rounded-full bg-[#65f2b5]/12 px-2 py-0.5 text-[9px] font-extrabold text-[#65f2b5]">EARNED</span>}</div><div className="mt-1 text-[11px] leading-4 text-[#849495]">{badge.earned ? 'Added automatically to your Scout Level profile.' : badge.detail}</div></div></div></div>)}</div></section>

        <section className="grid gap-4 md:grid-cols-2"><StatsPanel title="Last 30 days" correct={challengeSummary.monthCorrect} total={challengeSummary.monthSettled} rank={challengeSummary.monthlyRank} points={challengeSummary.points} streak={challengeSummary.currentStreak} /><StatsPanel title="All time" correct={challengeSummary.allCorrect} total={challengeSummary.allSettled} rank={challengeSummary.rank} points={challengeSummary.points} streak={challengeSummary.currentStreak} /></section>

        <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5 sm:p-6"><div className="mb-4 text-[10px] font-bold uppercase tracking-[.16em] text-[#00f0ff]">Account details</div><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div><label className="text-[10px] uppercase tracking-wider text-[#849495]">Display name</label><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} placeholder="Your name" className="mt-1 w-full rounded-xl border border-[#34425a] bg-[#0b1425] px-4 py-3 text-sm text-white outline-none focus:border-[#00f0ff]" /></div><div className="rounded-xl border border-[#2b3e58] bg-[#0c1627] p-3"><div className="text-[10px] uppercase text-[#718090]">Email</div><div className="mt-1 truncate text-sm font-semibold">{user.email}</div></div></div><div className="mt-4 flex justify-end"><button onClick={saveProfile} disabled={saving} className="rounded-xl bg-[#00f0ff] px-5 py-3 text-xs font-extrabold text-[#00363a] disabled:opacity-50">{saving ? 'SAVING…' : 'SAVE PROFILE'}</button></div></section>

        <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="text-[10px] uppercase tracking-wider text-[#00f0ff]">Baseball preferences</div><div className="mt-4 space-y-4 text-sm"><div><div className="text-xs text-[#849495]">Favorite team</div><div className="mt-1 font-semibold text-[#dbfcff]">{favoriteTeam?.name || 'Not selected'}</div></div><div><div className="text-xs text-[#849495]">Favorite players</div><div className="mt-2 flex flex-wrap gap-2">{favoritePlayers.length ? favoritePlayers.map((player: any) => <span key={player.id ?? player.name} className="rounded-full border border-[#30415c] bg-[#0c1627] px-3 py-1 text-xs">{player.name}</span>) : <span className="text-[#718090]">None selected</span>}</div></div><div><div className="text-xs text-[#849495]">Preferred stats</div><div className="mt-2 flex flex-wrap gap-2">{preferredStats.length ? preferredStats.map((stat: string) => <span key={stat} className="rounded-full border border-[#00f0ff]/25 bg-[#00f0ff]/8 px-3 py-1 text-xs text-[#7df4ff]">{stat}</span>) : <span className="text-[#718090]">None selected</span>}</div></div></div></div><div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="text-[10px] uppercase tracking-wider text-[#65f2b5]">Notifications</div><div className="mt-4 flex flex-wrap gap-2">{notificationSummary.length ? notificationSummary.map((item) => <span key={item} className="rounded-full border border-[#65f2b5]/25 bg-[#65f2b5]/8 px-3 py-1 text-xs text-[#9fe8c9]">{item}</span>) : <span className="text-sm text-[#718090]">No notification preferences selected.</span>}</div><p className="mt-4 text-xs leading-5 text-[#849495]">You can adjust system, alert and account security settings from the Settings page.</p></div></section>

        <section className="rounded-2xl border border-[#2a405b] bg-[#0c1627] p-4 text-[11px] leading-5 text-[#718090]">ScoutCore Points measure Challenge performance only. They have no cash value, cannot be bought, exchanged, transferred or withdrawn. ScoutCore analysis scores and ScoutCore Points are separate systems.</section>
      </div>
    </div>
  );
};

const ProfileLink: React.FC<{ icon: string; title: string; detail: string; onClick: () => void }> = ({ icon, title, detail, onClick }) => (
  <button onClick={onClick} className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-[#142238]"><span className="material-symbols-outlined text-[25px] text-[#7df4ff]">{icon}</span><span className="min-w-0 flex-1"><span className="block text-base font-bold text-white">{title}</span><span className="mt-0.5 block truncate text-xs text-[#849495]">{detail}</span></span><span className="material-symbols-outlined text-[#778aa4]">chevron_right</span></button>
);

const StatsPanel: React.FC<{ title: string; correct: number; total: number; rank: number | null; points: number; streak: number }> = ({ title, correct, total, rank, points, streak }) => (
  <div className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><h2 className="text-center text-xl font-extrabold text-white">{title}</h2><div className="mt-5 space-y-4 text-sm"><StatLine label="Correct predictions" value={total ? `${correct}/${total} (${pct(correct, total)})` : 'No settled picks yet'} accent /><StatLine label="Current streak" value={String(streak)} /><StatLine label="ScoutCore Points" value={String(points)} /><StatLine label="Predictor rank" value={rank ? `#${rank}` : '—'} /></div></div>
);

const StatLine: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="flex items-center justify-between gap-4"><span className={accent ? 'text-[#9b8cff]' : 'text-[#c5cedb]'}>{label}</span><span className="font-semibold text-white">{value}</span></div>
);