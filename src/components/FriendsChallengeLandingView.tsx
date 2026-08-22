import React, { useEffect, useMemo, useState } from 'react';
import { FriendsChallengeView, type FriendsChallengeMode } from './FriendsChallengeView';
import { supabase } from '../services/supabaseClient';

type Mode = FriendsChallengeMode;
type Tab = 'play' | 'inbox' | 'active' | 'history';
type Props = { onBack: () => void; onOpenWeeklyPicks: () => void; initialTab?: Tab };
type Friend = {
  profile_id: string;
  display_name: string;
  avatar_url?: string | null;
  scout_level?: string | null;
};
type Challenge = {
  challenge_id: string;
  role: 'inviter' | 'invitee';
  other_profile_id: string;
  other_display_name: string;
  other_avatar_url?: string | null;
  mode?: Mode | null;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  my_score?: number | null;
  other_score?: number | null;
};

const cards = [
  {
    id: 'weekly_h2h' as Mode,
    icon: 'swords',
    eyebrow: 'Weekly',
    title: 'Head-to-Head',
    badge: '1 vs 1',
    description: 'Use your normal weekly IXMetrics picks. Your results are compared with one friend automatically.',
    feature: 'No extra predictions',
    cta: 'Invite a Friend',
    accent: '#50eaf4',
    accentRgb: '80,234,244',
    available: true,
  },
  {
    id: 'same_game' as Mode,
    icon: 'sports_baseball',
    eyebrow: 'Same Game',
    title: 'You vs Friend',
    badge: '1 vs 1',
    description: 'Choose the same MLB game, make private picks, and reveal them after both players submit.',
    feature: 'Private picks',
    cta: 'Invite a Friend',
    accent: '#bd72ff',
    accentRgb: '189,114,255',
    available: true,
  },
  {
    id: 'team_up' as Mode,
    icon: 'groups',
    eyebrow: 'Team Up',
    title: 'Two vs Two',
    badge: '2 vs 2',
    description: 'Pair with a friend and face another duo on the same game. Every teammate’s correct pick counts.',
    feature: 'Four players',
    cta: 'Build Your Team',
    accent: '#8bed68',
    accentRgb: '139,237,104',
    available: true,
  },
] as const;

const howItWorksSteps = [
  { icon: 'person_add', title: 'Invite', copy: 'Choose a friend and send a challenge.', color: '#50eaf4' },
  { icon: 'mark_email_read', title: 'Accept', copy: 'Your friend can accept or decline the invitation.', color: '#62d7ff' },
  { icon: 'stadium', title: 'Choose', copy: 'Pick Weekly Head-to-Head or one shared game.', color: '#bd72ff' },
  { icon: 'edit_note', title: 'Predict', copy: 'Both players make their own IXMetrics picks.', color: '#d578ff' },
  { icon: 'lock_clock', title: 'Lock', copy: 'Picks lock when the game begins and cannot be changed.', color: '#8bed68' },
  { icon: 'emoji_events', title: 'Results', copy: 'IXMetrics scores completed picks and shows the winner.', color: '#f6bf4f' },
  { icon: 'history', title: 'History', copy: 'Finished challenges stay saved for both players.', color: '#50eaf4' },
] as const;

const processPreviewSteps = [
  {
    icon: 'group_add',
    title: 'Choose a Friend',
    copy: 'Pick a friend from your list to start a challenge.',
    color: '#50eaf4',
    glow: 'rgba(80,234,244,.13)',
  },
  {
    icon: 'sports_esports',
    title: 'Pick a Mode',
    copy: 'Choose the game mode that fits you both.',
    color: '#bd72ff',
    glow: 'rgba(189,114,255,.13)',
  },
  {
    icon: 'lock',
    title: 'Make Predictions',
    copy: 'Make your predictions privately when required.',
    color: '#8bed68',
    glow: 'rgba(139,237,104,.12)',
  },
  {
    icon: 'emoji_events',
    title: 'IXMetrics Reveals',
    copy: 'See the results and find out who won.',
    color: '#f6bf4f',
    glow: 'rgba(246,191,79,.13)',
  },
] as const;

const cardForMode = (mode?: Mode | null) => cards.find((card) => card.id === mode);
const modeTitle = (mode?: Mode | null) => {
  const card = cardForMode(mode);
  return card ? `${card.eyebrow} ${card.title}` : 'Friends Challenge';
};

const Avatar = ({ name, url }: { name: string; url?: string | null }) => (
  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2a5268] bg-[#59e8f3]/10 font-black text-[#59e8f3]">
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
  </div>
);

export const FriendsChallengeLandingView: React.FC<Props> = ({ onBack, onOpenWeeklyPicks, initialTab = 'play' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [requestPickerOpen, setRequestPickerOpen] = useState(false);
  const [requestSentMessage, setRequestSentMessage] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingChallenges, setLoadingChallenges] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(initialTab !== 'play');
  const [detailMode, setDetailMode] = useState<Mode | null>(null);
  const [detailView, setDetailView] = useState<Tab>(initialTab);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [scoutBotOpen, setScoutBotOpen] = useState(false);
  const [error, setError] = useState('');

  const loadChallenges = async () => {
    if (!supabase) {
      setLoadingChallenges(false);
      return;
    }
    setLoadingChallenges(true);
    const { data, error: rpcError } = await supabase.rpc('get_my_friend_challenges');
    if (!rpcError) setChallenges((data ?? []) as Challenge[]);
    setLoadingChallenges(false);
  };

  useEffect(() => {
    void loadChallenges();
  }, []);

  const incoming = useMemo(
    () => challenges.filter((challenge) => challenge.role === 'invitee' && challenge.status === 'pending'),
    [challenges],
  );
  const active = useMemo(
    () => challenges.filter((challenge) => ['choosing', 'negotiating', 'accepted'].includes(challenge.status)),
    [challenges],
  );
  const history = useMemo(
    () => challenges.filter((challenge) => ['completed', 'declined', 'cancelled'].includes(challenge.status)),
    [challenges],
  );

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      if (!supabase) throw new Error('Friends Challenge is not connected right now.');
      const { data, error: rpcError } = await supabase.rpc('get_friend_challenge_friends');
      if (rpcError) throw rpcError;
      setFriends((data ?? []) as Friend[]);
    } catch (caughtError: any) {
      setFriends([]);
      setError(caughtError?.message || 'Could not load your friends.');
    } finally {
      setLoadingFriends(false);
    }
  };

  const openFriendPicker = async (mode: Mode) => {
    if (mode === 'team_up') return;
    setRequestPickerOpen(false);
    setSelectedMode(mode);
    setRequestSentMessage('');
    setError('');
    await loadFriends();
  };

  const openPlayRequestPicker = async () => {
    setSelectedMode(null);
    setRequestPickerOpen(true);
    setRequestSentMessage('');
    setError('');
    await loadFriends();
  };

  const sendChallenge = async (friend: Friend) => {
    if (!supabase || !selectedMode || selectedMode === 'team_up') return;
    setSending(friend.profile_id);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('create_friend_challenge', {
        p_profile_id: friend.profile_id,
        p_mode: selectedMode,
      });
      if (rpcError) throw rpcError;
      setSelectedMode(null);
      await loadChallenges();
      setTab('active');
    } catch (caughtError: any) {
      setError(caughtError?.message || 'Could not create the challenge.');
    } finally {
      setSending(null);
    }
  };

  const sendPlayRequest = async (friend: Friend) => {
    if (!supabase) return;
    setSending(friend.profile_id);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('create_friend_challenge', {
        p_profile_id: friend.profile_id,
        p_mode: null,
      });
      if (rpcError) throw rpcError;
      setRequestPickerOpen(false);
      setRequestSentMessage(`ScoutBot asked ${friend.display_name} if they want to play.`);
      await loadChallenges();
      setTab('play');
    } catch (caughtError: any) {
      setError(caughtError?.message || 'Could not send the play request.');
    } finally {
      setSending(null);
    }
  };

  const respond = async (id: string, response: 'accept' | 'later' | 'decline') => {
    if (!supabase) return;
    setBusy(id);
    const { error: rpcError } = await supabase.rpc('respond_friend_challenge', {
      p_challenge_id: id,
      p_response: response,
    });
    if (rpcError) setError(rpcError.message || 'Could not update the invitation.');
    await loadChallenges();
    if (!rpcError && response === 'accept') setTab('active');
    setBusy(null);
  };

  if (detailOpen) {
    return <FriendsChallengeView initialMode={detailMode} initialView={detailView} onOpenWeeklyPicks={onOpenWeeklyPicks} onBack={() => { setDetailOpen(false); setDetailMode(null); setDetailView('play'); void loadChallenges(); }} />;
  }

  if (showHowItWorks) {
    return (
      <div
        className="min-h-screen bg-[#06101f] px-4 pb-14 pt-6 text-[#dce7f6] sm:px-6"
        style={{
          backgroundImage: 'radial-gradient(circle at 6% 8%, rgba(56,232,242,.12), transparent 23%), radial-gradient(circle at 94% 10%, rgba(189,114,255,.11), transparent 24%), linear-gradient(180deg,#06101f 0%,#081426 100%)',
        }}
      >
        <div className="mx-auto max-w-5xl">
          <header className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              aria-label="Back to Friends Challenge"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#29445f] bg-[#0c1a2d] text-white"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#50eaf4]">Friends Challenge</p>
              <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">How it works</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9eacc0]">Invite a friend, make baseball predictions, and compare results after the game.</p>
            </div>
          </header>

          <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((step, index) => (
              <article key={step.title} className="relative overflow-hidden rounded-2xl border border-[#29435e] bg-[#0b192c]/95 p-4">
                <div className="absolute right-3 top-2 text-5xl font-black text-white/[.035]">{index + 1}</div>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${step.color}70`, backgroundColor: `${step.color}12`, color: step.color }}
                >
                  <span className="material-symbols-outlined">{step.icon}</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-[10px] font-black" style={{ color: step.color }}>{String(index + 1).padStart(2, '0')}</span>
                  <h2 className="text-sm font-black uppercase tracking-wide text-white">{step.title}</h2>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#9eacc0]">{step.copy}</p>
              </article>
            ))}
          </section>

          <section className="mt-5 rounded-2xl border border-[#29435e] bg-[#0b192c]/95 p-5">
            <h2 className="text-sm font-black uppercase tracking-[.14em] text-[#65f2b5]">Three clear modes</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {cards.map((card) => (
                <div key={card.id} className="rounded-xl border bg-[#071425] p-3" style={{ borderColor: `${card.accent}55` }}>
                  <div className="text-xs font-black uppercase" style={{ color: card.accent }}>{card.eyebrow}</div>
                  <div className="mt-1 text-sm font-bold text-white">{card.title}</div>
                  <div className="mt-2 text-[11px] text-[#8fa0b5]">{card.available ? card.feature : 'Coming soon'}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#31506a] bg-[#0a182a] px-4 py-4 text-xs leading-5 text-[#a9b5c7]">
            <span className="material-symbols-outlined mt-0.5 text-[#50eaf4]">shield</span>
            <p><strong className="text-white">Friends-only play:</strong> free predictions with no money, betting, or prizes.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowHowItWorks(false)}
            className="mt-5 w-full rounded-xl bg-[#50eaf4] px-5 py-3.5 text-sm font-black uppercase text-[#05101e] sm:w-auto"
          >
            Choose a Mode
          </button>
        </div>
      </div>
    );
  }

  if (selectedMode || requestPickerOpen) {
    const selectedCard = selectedMode ? cardForMode(selectedMode) : null;
    const pickerAccent = selectedCard?.accent ?? '#65f2b5';
    const pickerAccentRgb = selectedCard?.accentRgb ?? '101,242,181';
    return (
      <div
        className="min-h-screen bg-[#06101f] px-4 py-6 text-[#dae2fd] sm:px-6 sm:py-8"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 0%, rgba(${pickerAccentRgb},.12), transparent 30%), linear-gradient(180deg,#06101f 0%,#081426 100%)`,
        }}
      >
        <div className="mx-auto max-w-4xl">
          <header className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setSelectedMode(null); setRequestPickerOpen(false); }}
              aria-label="Back to game modes"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d]"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[.16em]" style={{ color: pickerAccent }}>{requestPickerOpen ? 'ScoutBot Quick Invite' : 'Start Challenge'}</div>
              <h1 className="text-2xl font-black text-white">{requestPickerOpen ? 'Ask a Friend to Play' : modeTitle(selectedMode)}</h1>
              <p className="mt-1 text-xs text-[#8fa0b5]">{requestPickerOpen ? 'ScoutBot sends a preset request. There is no typing or private chat.' : 'Choose the friend you want to challenge.'}</p>
            </div>
          </header>

          <section className="mt-6 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-4 sm:p-5">
            {loadingFriends ? (
              <div className="py-12 text-center text-sm text-[#8fa0b5]">Loading friends…</div>
            ) : friends.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {friends.map((friend) => (
                  <button
                    type="button"
                    key={friend.profile_id}
                    disabled={sending === friend.profile_id}
                    onClick={() => void (requestPickerOpen ? sendPlayRequest(friend) : sendChallenge(friend))}
                    className="flex items-center gap-3 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-3 text-left disabled:opacity-60"
                  >
                    <Avatar name={friend.display_name} url={friend.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <div data-i18n-user-content className="truncate font-black text-white">{friend.display_name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-[#65f2b5]">{friend.scout_level || 'Rookie Scout'}</div>
                    </div>
                    <span className="rounded-lg border px-3 py-2 text-[10px] font-black" style={{ borderColor: pickerAccent, color: pickerAccent }}>
                      {sending === friend.profile_id ? 'SENDING…' : requestPickerOpen ? 'ASK TO PLAY' : 'INVITE'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-[#8fa0b5]">No mutual friends found yet.</div>
            )}
            {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">{error}</div>}
          </section>
        </div>
      </div>
    );
  }

  const tabButton = (id: Tab, label: string, count = 0) => (
    <button
      type="button"
      onClick={() => {
        if (id === 'play') setTab(id);
        else {
          setDetailMode(null);
          setDetailView(id);
          setDetailOpen(true);
        }
      }}
      className={`relative min-w-0 py-3.5 text-[10px] font-black sm:text-xs ${tab === id ? 'text-[#50eaf4]' : 'text-[#8e9aad]'}`}
    >
      <span className="block truncate">{label}{count > 0 ? ` (${count})` : ''}</span>
      {tab === id && <span className="absolute bottom-0 left-[16%] right-[16%] h-[3px] rounded-full bg-[#50eaf4]" />}
    </button>
  );

  return (
    <div
      className="sc-friends-arena min-h-screen bg-[#06101f] px-3 pb-14 pt-5 text-[#d9e4f5] sm:px-6 sm:pt-8"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 4% 14%, rgba(80,234,244,.15), transparent 21%), radial-gradient(ellipse at 96% 14%, rgba(189,114,255,.12), transparent 22%), linear-gradient(180deg,#06101f 0%,#071426 45%,#081426 100%)',
      }}
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex items-start gap-3 px-1 sm:px-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2c435e] bg-[#0b182b]"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[.19em] text-[#65f2b5]">IXMetrics Social</div>
            <h1 className="mt-1 text-[28px] font-black leading-none text-white sm:text-4xl">Friends Challenge</h1>
            <p className="mt-2 text-xs leading-5 text-[#9aa8ba] sm:text-sm">Play with friends. Make predictions. Compare results.</p>
          </div>
        </header>

        <nav aria-label="Friends Challenge sections" className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-[#29425e] bg-[#091629]/95">
          {tabButton('play', 'PLAY')}
          {tabButton('inbox', 'INVITES', incoming.length)}
          {tabButton('active', 'ACTIVE', active.length)}
          {tabButton('history', 'HISTORY')}
        </nav>

        {tab === 'play' && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => void openPlayRequestPicker()}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#65f2b5]/45 bg-[#65f2b5]/[.055] p-3.5 text-left shadow-[inset_0_1px_0_rgba(101,242,181,.08)] sm:p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#65f2b5]/50 bg-[#65f2b5]/10 text-[#65f2b5]">
                <span className="material-symbols-outlined text-[24px]">smart_toy</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-[.15em] text-[#65f2b5]">ScoutBot Quick Invite</span>
                <strong className="mt-0.5 block text-sm text-white">Ask a Friend to Play</strong>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#9aa8ba]">Send one preset request—no typing or private chat.</span>
              </span>
              <span className="material-symbols-outlined shrink-0 text-[#65f2b5]">chevron_right</span>
            </button>
            {requestSentMessage && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-[#65f2b5]/30 bg-[#65f2b5]/[.055] px-3 py-2.5 text-xs text-[#c8fbe2]">
                <span className="material-symbols-outlined text-[18px] text-[#65f2b5]">check_circle</span>
                <span>{requestSentMessage}</span>
              </div>
            )}
          </div>
        )}

        {tab === 'play' && (
          <main className="mt-4 overflow-hidden rounded-[22px] border border-[#2a465f] bg-[#071528]/95 shadow-[0_20px_70px_rgba(0,0,0,.28)]">
            <section
              className="relative overflow-hidden px-4 pb-5 pt-6 text-center sm:px-6"
              style={{
                backgroundImage: 'linear-gradient(180deg,rgba(5,18,34,.12),rgba(5,18,34,.94)), radial-gradient(ellipse at 6% 18%,rgba(164,248,255,.32),transparent 13%), radial-gradient(ellipse at 94% 18%,rgba(164,248,255,.27),transparent 13%), repeating-linear-gradient(103deg,transparent 0 30px,rgba(80,234,244,.025) 31px 32px)',
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#50eaf4]/70 to-transparent" />
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#50eaf4]/40 bg-[#50eaf4]/10 text-[#50eaf4]">
                <span className="material-symbols-outlined">emoji_events</span>
              </div>
              <h2 className="mt-3 text-lg font-black uppercase tracking-[.14em] text-[#50eaf4] sm:text-xl">Choose a Game Mode</h2>
              <p className="mt-1 text-xs text-[#a5b1c2] sm:text-sm">Pick the way you want to play together.</p>
            </section>

            <section className="grid gap-3 p-3 sm:p-5 lg:grid-cols-3">
              {cards.map((card) => (
                <article
                  key={card.id}
                  className="relative flex min-h-[250px] flex-col overflow-hidden rounded-2xl border p-4 text-left sm:min-h-[280px] sm:p-5"
                  style={{
                    borderColor: `${card.accent}78`,
                    backgroundImage: `radial-gradient(circle at 50% 0%, rgba(${card.accentRgb},.15), transparent 39%), linear-gradient(180deg,#0b1a2d 0%,#081426 100%)`,
                    boxShadow: `inset 0 1px 0 rgba(${card.accentRgb},.12), 0 12px 35px rgba(0,0,0,.2)`,
                  }}
                >
                  {!card.available && (
                    <span className="absolute right-3 top-3 rounded-full border border-[#8bed68]/45 bg-[#8bed68]/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#8bed68]">Coming Soon</span>
                  )}
                  <div
                    className="flex h-[60px] w-[60px] items-center justify-center border sm:h-[68px] sm:w-[68px]"
                    style={{
                      clipPath: 'polygon(50% 0%,92% 24%,92% 73%,50% 100%,8% 73%,8% 24%)',
                      borderColor: card.accent,
                      backgroundColor: `rgba(${card.accentRgb},.1)`,
                      color: card.accent,
                    }}
                  >
                    <span className="material-symbols-outlined text-[30px] sm:text-[34px]">{card.icon}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[.1em]" style={{ color: card.accent }}>{card.eyebrow}</div>
                      <h3 className="mt-0.5 text-lg font-black uppercase leading-6 text-white sm:text-xl">{card.title}</h3>
                    </div>
                    <span className="rounded-md border px-2 py-1 text-[10px] font-black" style={{ borderColor: `${card.accent}8c`, color: card.accent }}>{card.badge}</span>
                  </div>

                  <p className="mt-2 text-[13px] leading-5 text-[#a7b2c3] sm:mt-3 sm:text-sm sm:leading-6">{card.description}</p>
                  <div className="mt-auto flex items-center gap-2 pt-4 text-[10px] font-black uppercase tracking-[.08em]" style={{ color: card.accent }}>
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                    <span>{card.feature}</span>
                  </div>
                  {card.available && (
                    <button
                      type="button"
                      onClick={() => { setDetailMode(card.id); setDetailView('play'); setDetailOpen(true); }}
                      className="mt-3 w-full rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#05101e] transition hover:brightness-110 sm:mt-4 sm:py-3"
                      style={{ backgroundColor: card.accent, boxShadow: `0 0 28px rgba(${card.accentRgb},.15)` }}
                    >
                      {card.cta}
                    </button>
                  )}
                </article>
              ))}
            </section>

            <section className="mx-3 mb-3 overflow-hidden rounded-2xl border border-[#2a465f] bg-[#09182b] sm:mx-5 sm:mb-5">
              <button
                type="button"
                aria-expanded={scoutBotOpen}
                onClick={() => setScoutBotOpen((open) => !open)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#50eaf4]/50 bg-[#50eaf4]/10 text-[#50eaf4] shadow-[0_0_25px_rgba(80,234,244,.12)]">
                  <span className="material-symbols-outlined text-[28px]">smart_toy</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">Not sure what to play?</div>
                  <div className="mt-1 text-sm font-black text-white">Let ScoutBot help you choose</div>
                </div>
                <span className="material-symbols-outlined text-[#50eaf4]">{scoutBotOpen ? 'expand_less' : 'chevron_right'}</span>
              </button>

              {scoutBotOpen && (
                <div className="border-t border-[#29425e] p-3 sm:p-4">
                  <p className="text-xs leading-5 text-[#95a4b7]">Choose the kind of experience you want:</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => { setDetailMode('weekly_h2h'); setDetailView('play'); setDetailOpen(true); }} className="rounded-xl border border-[#50eaf4]/45 bg-[#50eaf4]/5 p-3 text-left">
                      <span className="text-xs font-black text-[#50eaf4]">Keep it simple</span>
                      <span className="mt-1 block text-[11px] leading-4 text-[#99a7b9]">Compare the weekly picks you already make.</span>
                    </button>
                    <button type="button" onClick={() => { setDetailMode('same_game'); setDetailView('play'); setDetailOpen(true); }} className="rounded-xl border border-[#bd72ff]/45 bg-[#bd72ff]/5 p-3 text-left">
                      <span className="text-xs font-black text-[#bd72ff]">Play one game together</span>
                      <span className="mt-1 block text-[11px] leading-4 text-[#99a7b9]">Make private picks for the same matchup.</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="border-t border-[#29425e] bg-[#071324] p-3 sm:p-5">
              <button
                type="button"
                onClick={() => setShowHowItWorks(true)}
                aria-label="Open the full Friends Challenge guide"
                className="w-full overflow-hidden rounded-2xl border border-[#50eaf4]/45 bg-[#08182a] text-left shadow-[0_0_32px_rgba(80,234,244,.08)] transition hover:border-[#50eaf4]/70 hover:shadow-[0_0_38px_rgba(80,234,244,.13)]"
              >
                <span className="flex items-center justify-between gap-3 border-b border-[#29425e] bg-[linear-gradient(90deg,rgba(80,234,244,.08),rgba(7,19,36,.2),rgba(189,114,255,.07))] px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="h-px w-5 shrink-0 bg-[#50eaf4] shadow-[0_0_8px_rgba(80,234,244,.8)]" />
                    <span className="text-[11px] font-black uppercase tracking-[.13em] text-[#50eaf4] sm:text-xs">
                      How Friends Challenge Works
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[9px] font-black uppercase tracking-[.08em] text-[#a6b4c6]">
                    Full guide
                    <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                  </span>
                </span>

                <span className="grid grid-cols-2 gap-px bg-[#29425e] md:grid-cols-4">
                  {processPreviewSteps.map((step, index) => (
                    <span key={step.title} className="min-w-0 bg-[#071729] px-3 py-3.5 sm:px-4 sm:py-4">
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl border"
                        style={{ color: step.color, borderColor: `${step.color}80`, backgroundColor: step.glow, boxShadow: `0 0 20px ${step.glow}` }}
                      >
                        <span className="material-symbols-outlined text-[23px]">{step.icon}</span>
                      </span>
                      <span className="mt-3 block text-[10px] font-black uppercase leading-4 tracking-[.04em]" style={{ color: step.color }}>
                        {index + 1}. {step.title}
                      </span>
                      <span className="mt-1.5 block text-[10px] leading-[1.45] text-[#9aa9bb] sm:text-[11px]">{step.copy}</span>
                    </span>
                  ))}
                </span>
              </button>
              <div className="mt-3 flex items-center justify-center gap-2 text-center text-[10px] text-[#7f8da0]">
                <span className="material-symbols-outlined text-[16px]">shield</span>
                <span>Friends-only predictions · no money, betting, or prizes</span>
              </div>
            </section>
          </main>
        )}

        {tab !== 'play' && (
          <section className="mt-4 rounded-2xl border border-[#29425e] bg-[#08172a]/95 p-3 sm:p-5">
            <div className="mb-4 flex items-center gap-3 px-1">
              <span className="material-symbols-outlined text-[#50eaf4]">{tab === 'inbox' ? 'mail' : tab === 'active' ? 'sports_score' : 'history'}</span>
              <div>
                <h2 className="text-base font-black text-white">{tab === 'inbox' ? 'Challenge Invites' : tab === 'active' ? 'Active Challenges' : 'Challenge History'}</h2>
                <p className="mt-0.5 text-[11px] text-[#8fa0b5]">
                  {tab === 'inbox' ? 'Reply to preset ScoutBot requests from your friends.' : tab === 'active' ? 'Continue challenges already in progress.' : 'Review your completed challenges.'}
                </p>
              </div>
            </div>

            {loadingChallenges ? (
              <div className="py-16 text-center text-sm text-[#8fa0b5]">Loading challenges…</div>
            ) : tab === 'inbox' ? (
              <div className="space-y-3">
                {incoming.length ? incoming.map((challenge) => (
                  <article key={challenge.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#0a182b] p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={challenge.other_display_name} url={challenge.other_avatar_url} />
                      <div className="min-w-0 flex-1">
                        <h3 data-i18n-user-content className="truncate font-black text-white">{challenge.other_display_name}</h3>
                        {challenge.mode ? (
                          <div className="mt-1 text-xs text-[#8fa0b5]">Invited you to <b className="text-[#59e8f3]">{modeTitle(challenge.mode)}</b></div>
                        ) : (
                          <div className="mt-1 text-xs leading-5 text-[#8fa0b5]"><b className="text-[#65f2b5]">ScoutBot play request:</b> wants to play a Friends Challenge.</div>
                        )}
                      </div>
                    </div>
                    {challenge.mode ? (
                      <div className="mt-4 flex gap-2">
                        <button type="button" disabled={busy === challenge.challenge_id} onClick={() => void respond(challenge.challenge_id, 'accept')} className="rounded-xl bg-[#59e8f3] px-4 py-2.5 text-xs font-black text-[#07101f] disabled:opacity-60">ACCEPT</button>
                        <button type="button" disabled={busy === challenge.challenge_id} onClick={() => void respond(challenge.challenge_id, 'decline')} className="rounded-xl border border-[#3a4b63] px-4 py-2.5 text-xs font-black text-[#aebbd0] disabled:opacity-60">DECLINE</button>
                      </div>
                    ) : (
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <button type="button" disabled={busy === challenge.challenge_id} onClick={() => void respond(challenge.challenge_id, 'accept')} className="rounded-xl bg-[#65f2b5] px-2 py-2.5 text-[10px] font-black text-[#07101f] disabled:opacity-60">LET’S PLAY</button>
                        <button type="button" disabled={busy === challenge.challenge_id} onClick={() => void respond(challenge.challenge_id, 'later')} className="rounded-xl border border-[#f4bd5f]/55 bg-[#f4bd5f]/5 px-2 py-2.5 text-[10px] font-black text-[#f4bd5f] disabled:opacity-60">MAYBE LATER</button>
                        <button type="button" disabled={busy === challenge.challenge_id} onClick={() => void respond(challenge.challenge_id, 'decline')} className="rounded-xl border border-[#3a4b63] px-2 py-2.5 text-[10px] font-black text-[#aebbd0] disabled:opacity-60">CAN’T NOW</button>
                      </div>
                    )}
                  </article>
                )) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No new challenge invitations.</div>}
              </div>
            ) : tab === 'active' ? (
              <div className="space-y-3">
                {active.length ? active.map((challenge) => (
                  <article key={challenge.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#0a182b] p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={challenge.other_display_name} url={challenge.other_avatar_url} />
                      <div className="min-w-0 flex-1">
                        <h3 data-i18n-user-content className="font-black text-white">{challenge.other_display_name}</h3>
                        <div className="mt-1 text-xs text-[#8fa0b5]">{modeTitle(challenge.mode)}</div>
                      </div>
                      <button type="button" onClick={() => { setDetailMode(null); setDetailView('active'); setDetailOpen(true); }} className="rounded-lg border border-[#23e5ef] bg-[#062031] px-3 py-2 text-xs font-black text-[#32e8f0]">CONTINUE</button>
                    </div>
                  </article>
                )) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No active Friends Challenges yet.</div>}
              </div>
            ) : (
              <div className="space-y-3">
                {history.length ? history.map((challenge) => (
                  <article key={challenge.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#0a182b] p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={challenge.other_display_name} url={challenge.other_avatar_url} />
                      <div className="min-w-0 flex-1">
                        <h3 data-i18n-user-content className="font-black text-white">{challenge.other_display_name}</h3>
                        <div className="mt-1 text-xs text-[#8fa0b5]">{modeTitle(challenge.mode)} · {challenge.status}</div>
                      </div>
                      <b className="text-white">{challenge.my_score ?? '—'} – {challenge.other_score ?? '—'}</b>
                    </div>
                  </article>
                )) : <div className="py-16 text-center text-sm text-[#8fa0b5]">No finished Friends Challenges yet.</div>}
              </div>
            )}

            {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">{error}</div>}
          </section>
        )}
      </div>
    </div>
  );
};
