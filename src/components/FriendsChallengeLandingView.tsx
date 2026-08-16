import React, { useEffect, useMemo, useState } from 'react';
import { FriendsChallengeView } from './FriendsChallengeView';
import { supabase } from '../services/supabaseClient';

type Props = { onBack: () => void };
type Mode = 'weekly_h2h' | 'same_game' | 'team_up';
type Tab = 'play' | 'inbox' | 'active' | 'history';
type Friend = { profile_id: string; display_name: string; avatar_url?: string | null; scout_level?: string | null };
type Challenge = { challenge_id: string; role: 'inviter' | 'invitee'; other_profile_id: string; other_display_name: string; other_avatar_url?: string | null; mode?: Mode | null; status: string; created_at: string; updated_at: string; completed_at?: string | null; my_score?: number | null; other_score?: number | null };

const cards = [
  { id: 'weekly_h2h' as Mode, icon: 'swords', title: 'Weekly Head-to-Head', badge: '1 vs 1', description: 'Compete with a friend for the whole week. Your normal ScoutCore predictions are compared automatically.', footer: 'FREE TO PLAY · NO EXTRA PREDICTIONS' },
  { id: 'same_game' as Mode, icon: 'sports_baseball', title: 'Same Game: You vs Friend', badge: '1 vs 1', description: 'Pick the same MLB game. Different predictions. You both make private picks and ScoutCore reveals them after both lock in.', footer: 'FREE TO PLAY · PRIVATE PICKS' },
  { id: 'team_up' as Mode, icon: 'groups', title: 'Team Up – 2 vs 2', badge: '2 vs 2', description: 'Team up with a friend and compete against another team on the same game. Combined score wins!', footer: 'FREE TO PLAY · WORK TOGETHER' },
];

const modeTitle = (mode?: Mode | null) => cards.find(c => c.id === mode)?.title || 'Friends Challenge';

const Avatar = ({ name, url }: { name: string; url?: string | null }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2a5268] bg-[#59e8f3]/10 font-black text-[#59e8f3]">
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0,2).toUpperCase()}
  </div>
);

export const FriendsChallengeLandingView: React.FC<Props> = ({ onBack }) => {
  const [tab, setTab] = useState<Tab>('play');
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState('');

  const loadChallenges = async () => {
    if (!supabase) { setLoadingChallenges(false); return; }
    setLoadingChallenges(true);
    const { data, error: rpcError } = await supabase.rpc('get_my_friend_challenges');
    if (!rpcError) setChallenges((data ?? []) as Challenge[]);
    setLoadingChallenges(false);
  };

  useEffect(() => { void loadChallenges(); }, []);

  const incoming = useMemo(() => challenges.filter(c => c.role === 'invitee' && c.status === 'pending'), [challenges]);
  const active = useMemo(() => challenges.filter(c => ['choosing','negotiating','accepted'].includes(c.status)), [challenges]);
  const history = useMemo(() => challenges.filter(c => ['completed','declined','cancelled'].includes(c.status)), [challenges]);

  const openFriendPicker = async (mode: Mode) => {
    setSelectedMode(mode); setError(''); setLoadingFriends(true);
    try {
      if (!supabase) throw new Error('Friends Challenge is not connected right now.');
      const { data, error: rpcError } = await supabase.rpc('get_friend_challenge_friends');
      if (rpcError) throw rpcError;
      setFriends((data ?? []) as Friend[]);
    } catch (e: any) { setFriends([]); setError(e?.message || 'Could not load your friends.'); }
    finally { setLoadingFriends(false); }
  };

  const sendChallenge = async (friend: Friend) => {
    if (!supabase || !selectedMode) return;
    setSending(friend.profile_id); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('create_friend_challenge', { p_profile_id: friend.profile_id, p_mode: selectedMode });
      if (rpcError) throw rpcError;
      setSelectedMode(null); await loadChallenges(); setTab('active');
    } catch (e: any) { setError(e?.message || 'Could not create the challenge.'); }
    finally { setSending(null); }
  };

  const respond = async (id: string, response: 'accept' | 'decline') => {
    if (!supabase) return;
    setBusy(id);
    const { error: rpcError } = await supabase.rpc('respond_friend_challenge', { p_challenge_id: id, p_response: response });
    if (rpcError) setError(rpcError.message || 'Could not update the invitation.');
    await loadChallenges();
    if (!rpcError && response === 'accept') setTab('active');
    setBusy(null);
  };

  if (detailOpen) return <FriendsChallengeView onBack={() => { setDetailOpen(false); void loadChallenges(); }} />;

  if (selectedMode) return <div className="min-h-screen bg-[#081225] px-6 py-8 text-[#dae2fd]"><div className="mx-auto max-w-4xl"><div className="flex items-center gap-3"><button onClick={() => setSelectedMode(null)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d]"><span className="material-symbols-outlined">arrow_back</span></button><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-[#65f2b5]">START CHALLENGE</div><h1 className="text-2xl font-black text-white">{modeTitle(selectedMode)}</h1><p className="mt-1 text-xs text-[#8fa0b5]">Choose the friend you want to challenge.</p></div></div><section className="mt-6 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5">{loadingFriends ? <div className="py-12 text-center text-sm text-[#8fa0b5]">Loading friends…</div> : friends.length ? <div className="grid gap-3 md:grid-cols-2">{friends.map(friend => <button key={friend.profile_id} disabled={sending === friend.profile_id} onClick={() => void sendChallenge(friend)} className="flex items-center gap-3 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-3 text-left"><Avatar name={friend.display_name} url={friend.avatar_url} /><div className="min-w-0 flex-1"><div className="truncate font-black text-white">{friend.display_name}</div><div className="text-[10px] uppercase tracking-wide text-[#65f2b5]">{friend.scout_level || 'Rookie Scout'}</div></div><span className="rounded-lg border border-[#23e5ef] px-3 py-2 text-[10px] font-black text-[#32e8f0]">{sending === friend.profile_id ? 'SENDING…' : 'CHALLENGE'}</span></button>)}</div> : <div className="py-12 text-center text-sm text-[#8fa0b5]">No mutual friends found yet.</div>}{error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">{error}</div>}</section></div></div>;

  const tabButton = (id: Tab, label: string, count = 0) => <button onClick={() => setTab(id)} className={`relative py-4 text-xs font-black ${tab === id ? 'text-[#32e8f0]' : 'text-[#8e9aad]'}`}>{label}{count > 0 ? ` (${count})` : ''}{tab === id && <span className="absolute bottom-0 left-[18%] right-[18%] h-[3px] rounded-full bg-[#22eaf3]" />}</button>;

  return <div className="sc-friends-landing min-h-screen bg-[radial-gradient(circle_at_50%_5%,rgba(0,229,244,.08),transparent_28%),linear-gradient(180deg,#06101f_0%,#081426_100%)] px-6 pb-12 pt-8 text-[#d9e4f5]"><div className="mx-auto max-w-6xl">
    <div className="flex items-start gap-3"><button onClick={onBack} className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2c435e] bg-[#0b182b]"><span className="material-symbols-outlined">arrow_back</span></button><div><div className="text-[11px] font-black uppercase tracking-[.18em] text-[#5ff0b5]">FREE · ALWAYS</div><h1 className="mt-1 text-4xl font-black leading-none text-white">Friends Challenge</h1><p className="mt-2 text-sm text-[#8f9caf]">ScoutBot handles invitations, private choices, reveals and results.</p></div></div>
    <div className="mt-6 grid grid-cols-4 overflow-hidden rounded-xl border border-[#29425e] bg-[#091629]">{tabButton('play','PLAY')}{tabButton('inbox','INVITES',incoming.length)}{tabButton('active','ACTIVE',active.length)}{tabButton('history','HISTORY')}</div>

    {tab === 'play' && (
      <section className="sc-friends-play mt-5 rounded-2xl border border-[#29425e] bg-[#08172a]/92 p-5">
        <div className="sc-friends-play-heading py-3 text-center">
          <div className="text-xl font-black uppercase tracking-[.13em] text-[#45e8f0]">🏆 Choose a Game Mode</div>
          <p className="mt-1 text-sm text-[#a1adbe]">Play with friends. Make predictions. Win together.</p>
        </div>

        <div className="sc-friends-mode-grid mt-3 grid gap-4 lg:grid-cols-3">
          {cards.map(card => (
            <article key={card.id} className="sc-friends-mode-card flex min-h-[260px] flex-col rounded-2xl border border-[#29425e] bg-[#0a182b] p-5">
              <div className={`sc-friends-mode-icon flex h-16 w-16 items-center justify-center rounded-full border ${card.id === 'team_up' ? 'border-[#b88b12] text-[#f5bd18]' : 'border-[#2d687e] text-[#39e5ef]'}`}>
                <span className="material-symbols-outlined text-[32px]">{card.icon}</span>
              </div>
              <div className="sc-friends-mode-title mt-4 flex items-center gap-2">
                <h2 className="text-lg font-black uppercase text-white">{card.title}</h2>
                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${card.id === 'team_up' ? 'border-[#c49615] text-[#f5bd18]' : 'border-[#17cdd7] text-[#34e8f0]'}`}>{card.badge}</span>
              </div>
              <p className="sc-friends-mode-description mt-2 text-sm leading-5 text-[#9aa8bb]">{card.description}</p>
              <p className={`sc-friends-mode-footer mt-auto pt-4 text-[11px] font-black tracking-wide ${card.id === 'team_up' ? 'text-[#f5bd18]' : 'text-[#31e5ee]'}`}>★ {card.footer}</p>
              <button onClick={() => void openFriendPicker(card.id)} className="sc-friends-mode-start mt-4 rounded-lg border border-[#23e5ef] bg-[#062031] px-4 py-3 text-sm font-black text-[#32e8f0]">START</button>
            </article>
          ))}
        </div>

        <div className="sc-friends-process mt-5 rounded-2xl border border-[#29425e] bg-[#09172a] px-6 py-5">
          <div className="sc-friends-process-grid grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-4 text-center">
            <div className="sc-friends-process-step"><span className="material-symbols-outlined text-[34px] text-[#39e5ef]">person_add</span><div className="mt-2 text-xs font-black text-[#39e5ef]">INVITE FRIENDS</div></div>
            <span className="sc-friends-process-arrow material-symbols-outlined text-[#8fa0b5]">arrow_forward</span>
            <div className="sc-friends-process-step"><span className="material-symbols-outlined text-[34px] text-[#be65ef]">lock</span><div className="mt-2 text-xs font-black text-[#be65ef]">PRIVATE PICKS</div></div>
            <span className="sc-friends-process-arrow material-symbols-outlined text-[#8fa0b5]">arrow_forward</span>
            <div className="sc-friends-process-step"><span className="material-symbols-outlined text-[34px] text-[#55e8ad]">emoji_events</span><div className="mt-2 text-xs font-black text-[#55e8ad]">AUTO RESULTS</div></div>
            <span className="sc-friends-process-arrow material-symbols-outlined text-[#8fa0b5]">arrow_forward</span>
            <div className="sc-friends-process-step"><span className="material-symbols-outlined text-[34px] text-[#f5bd18]">calendar_month</span><div className="mt-2 text-xs font-black text-[#f5bd18]">HISTORY</div></div>
          </div>
          <div className="sc-friends-process-note mt-4 text-center text-xs text-[#8794a6]">🛡 All modes are free. No tickets required.</div>
        </div>
      </section>
    )}

    {tab !== 'play' && <section className="mt-5 rounded-2xl border border-[#29425e] bg-[#08172a]/92 p-5">{loadingChallenges ? <div className="py-16 text-center text-sm text-[#8fa0b5]">Loading challenges…</div> : tab === 'inbox' ? <div className="space-y-3">{incoming.length ? incoming.map(c => <article key={c.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#0a182b] p-4"><div className="flex items-center gap-3"><Avatar name={c.other_display_name} url={c.other_avatar_url} /><div className="min-w-0 flex-1"><h3 className="truncate font-black text-white">{c.other_display_name}</h3><div className="mt-1 text-xs text-[#8fa0b5]">Invited you to <b className="text-[#59e8f3]">{modeTitle(c.mode)}</b></div></div></div><div className="mt-4 flex gap-2"><button disabled={busy === c.challenge_id} onClick={() => void respond(c.challenge_id,'accept')} className="rounded-xl bg-[#59e8f3] px-4 py-2.5 text-xs font-black text-[#07101f]">ACCEPT</button><button disabled={busy === c.challenge_id} onClick={() => void respond(c.challenge_id,'decline')} className="rounded-xl border border-[#3a4b63] px-4 py-2.5 text-xs font-black text-[#aebbd0]">DECLINE</button></div></article>) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No new challenge invitations.</div>}</div> : tab === 'active' ? <div className="space-y-3">{active.length ? active.map(c => <article key={c.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#0a182b] p-4"><div className="flex items-center gap-3"><Avatar name={c.other_display_name} url={c.other_avatar_url} /><div className="min-w-0 flex-1"><h3 className="font-black text-white">{c.other_display_name}</h3><div className="mt-1 text-xs text-[#8fa0b5]">{modeTitle(c.mode)}</div></div><button onClick={() => setDetailOpen(true)} className="rounded-lg border border-[#23e5ef] bg-[#062031] px-3 py-2 text-xs font-black text-[#32e8f0]">CONTINUE</button></div></article>) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No active Friends Challenges yet.</div>}</div> : <div className="space-y-3">{history.length ? history.map(c => <article key={c.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#0a182b] p-4"><div className="flex items-center gap-3"><Avatar name={c.other_display_name} url={c.other_avatar_url} /><div className="min-w-0 flex-1"><h3 className="font-black text-white">{c.other_display_name}</h3><div className="mt-1 text-xs text-[#8fa0b5]">{modeTitle(c.mode)} · {c.status}</div></div><b className="text-white">{c.my_score ?? '—'} – {c.other_score ?? '—'}</b></div></article>) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No finished Friends Challenges yet.</div>}</div>}{error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">{error}</div>}</section>}
  </div></div>;
};
