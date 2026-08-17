import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getGame, getSchedule, type MlbScheduleGame } from '../services/mlbApi';

type Mode = 'weekly_h2h' | 'same_game' | 'team_up';
type View = 'play' | 'inbox' | 'active' | 'history';
type Friend = { profile_id: string; display_name: string; avatar_url?: string | null; scout_level?: string | null };
type GameChoice = {
  gamePk: number; gameDate: string; status: string; detailedState?: string;
  awayTeam: { id: number; name: string }; homeTeam: { id: number; name: string };
};
type Pick = { key: 'winner' | 'total_runs' | 'both_3' | 'close_game'; choice: string; label: string };
type Challenge = {
  challenge_id: string; role: 'inviter' | 'invitee'; other_profile_id: string; other_display_name: string; other_avatar_url?: string | null;
  mode?: Mode | null; inviter_preference?: Mode | null; invitee_preference?: Mode | null; status: string; created_at: string; updated_at: string;
  shared_game?: GameChoice | null; my_game_choice?: GameChoice | null; other_game_choice?: GameChoice | null;
  my_picks?: Pick[] | null; other_picks?: Pick[] | null; my_submitted?: boolean; other_submitted?: boolean;
  my_score?: number | null; other_score?: number | null; result_json?: any; completed_at?: string | null;
};

type WeeklyStats = { my_correct: number; my_total: number; my_points: number; other_correct: number; other_total: number; other_points: number };

const modes: { id: Mode; icon: string; title: string; sub: string; available: boolean }[] = [
  { id: 'weekly_h2h', icon: '⚔️', title: 'Weekly Head-to-Head', sub: 'Your normal weekly predictions compete automatically.', available: true },
  { id: 'same_game', icon: '⚾', title: 'Same Game: You vs Friend', sub: 'Choose the same MLB game, make private picks, then battle.', available: true },
  { id: 'team_up', icon: '🤝', title: 'Team Up', sub: 'Full 2 vs 2 challenge flow is coming soon.', available: false },
];
const modeName = (m?: Mode | null) => modes.find(x => x.id === m)?.title || 'Friends Challenge';
const shortTeam = (name: string) => name.replace(/^(Arizona|Atlanta|Baltimore|Boston|Chicago|Cincinnati|Cleveland|Colorado|Detroit|Houston|Kansas City|Los Angeles|Miami|Milwaukee|Minnesota|New York|Oakland|Philadelphia|Pittsburgh|San Diego|San Francisco|Seattle|St\. Louis|Tampa Bay|Texas|Toronto|Washington)\s+/, '');
const teamLogo = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const gameLabel = (g?: GameChoice | null) => g ? `${shortTeam(g.awayTeam.name)} vs ${shortTeam(g.homeTeam.name)}` : 'MLB game';
const sameGame = (a?: GameChoice | null, b?: GameChoice | null) => Boolean(a && b && Number(a.gamePk) === Number(b.gamePk));
const accuracy = (c: number, t: number) => t ? Math.round((c / t) * 100) : 0;

function gamePayload(g: MlbScheduleGame): GameChoice {
  return { gamePk: g.gamePk, gameDate: g.gameDate, status: g.status, detailedState: g.detailedState, awayTeam: { id: g.awayTeam.id, name: g.awayTeam.name }, homeTeam: { id: g.homeTeam.id, name: g.homeTeam.name } };
}

function pickOptions(g: GameChoice) {
  return [
    { key: 'winner' as const, title: 'Game Winner', options: [{ value: 'away', label: shortTeam(g.awayTeam.name) }, { value: 'home', label: shortTeam(g.homeTeam.name) }] },
    { key: 'total_runs' as const, title: 'Total Runs', options: [{ value: '8plus', label: '8+ total runs' }, { value: '7under', label: '7 or fewer' }] },
    { key: 'both_3' as const, title: 'Both Teams Score 3+', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { key: 'close_game' as const, title: 'Final Margin', options: [{ value: 'one', label: '1-run game' }, { value: 'two_plus', label: '2+ run margin' }] },
  ];
}

function evaluatePick(pick: Pick, away: number, home: number) {
  if (pick.key === 'winner') return pick.choice === (away > home ? 'away' : 'home');
  if (pick.key === 'total_runs') return pick.choice === (away + home >= 8 ? '8plus' : '7under');
  if (pick.key === 'both_3') return pick.choice === (away >= 3 && home >= 3 ? 'yes' : 'no');
  if (pick.key === 'close_game') return pick.choice === (Math.abs(away - home) === 1 ? 'one' : 'two_plus');
  return false;
}

const Avatar = ({ name, url }: { name: string; url?: string | null }) => <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#59e8f3]/12 text-sm font-black text-[#59e8f3]">{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}</div>;

const WeeklyMatchup = ({ challenge }: { challenge: Challenge }) => {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  useEffect(() => { let live = true; (async () => { if (!supabase) return; const { data } = await supabase.rpc('get_friend_weekly_matchup', { p_challenge_id: challenge.challenge_id }); const row = Array.isArray(data) ? data[0] : data; if (live && row) setStats(row as WeeklyStats); })(); return () => { live = false; }; }, [challenge.challenge_id, challenge.updated_at]);
  if (!stats) return <div className="mt-4 text-xs text-[#8fa0b5]">Loading this week’s matchup…</div>;
  const mineAcc = accuracy(Number(stats.my_correct || 0), Number(stats.my_total || 0));
  const otherAcc = accuracy(Number(stats.other_correct || 0), Number(stats.other_total || 0));
  const mineLeading = mineAcc > otherAcc || (mineAcc === otherAcc && Number(stats.my_correct) > Number(stats.other_correct)) || (mineAcc === otherAcc && Number(stats.my_correct) === Number(stats.other_correct) && Number(stats.my_points) > Number(stats.other_points));
  const tied = mineAcc === otherAcc && Number(stats.my_correct) === Number(stats.other_correct) && Number(stats.my_points) === Number(stats.other_points);
  return <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4">
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><div><div className="text-xs font-black text-[#59e8f3]">YOU</div><div className="mt-1 text-3xl font-black text-white">{mineAcc}%</div><div className="text-xs text-[#8fa0b5]">{stats.my_correct}/{stats.my_total} correct · {stats.my_points} pts</div></div><div className="text-xs font-black text-[#65788f]">VS</div><div><div className="text-xs font-black text-white">{challenge.other_display_name}</div><div className="mt-1 text-3xl font-black text-white">{otherAcc}%</div><div className="text-xs text-[#8fa0b5]">{stats.other_correct}/{stats.other_total} correct · {stats.other_points} pts</div></div></div>
    <div className="mt-3 border-t border-[#263951] pt-3 text-center text-xs font-black text-[#65f2b5]">{tied ? 'TIED RIGHT NOW' : mineLeading ? 'YOU’RE LEADING' : `${challenge.other_display_name.toUpperCase()} IS LEADING`} · updates from normal weekly picks</div>
  </div>;
};

const PickBuilder = ({ challenge, onDone }: { challenge: Challenge; onDone: () => Promise<void> }) => {
  const game = challenge.shared_game!;
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const defs = pickOptions(game);
  const complete = defs.every(d => Boolean(choices[d.key]));
  const submit = async () => {
    if (!supabase || !complete) return;
    setBusy(true);
    setError('');
    const picks: Pick[] = defs.map(d => ({ key: d.key, choice: choices[d.key], label: d.options.find(o => o.value === choices[d.key])?.label || choices[d.key] }));
    const { error } = await supabase.rpc('submit_friend_challenge_picks', { p_challenge_id: challenge.challenge_id, p_picks: picks });
    if (!error) await onDone();
    else setError(error.message || 'Could not lock your picks.');
    setBusy(false);
  };
  return <div className="mt-4"><div className="rounded-xl border border-[#00e6f4]/35 bg-[#00e6f4]/5 px-4 py-3 text-xs text-[#9fb0c5]"><b className="text-[#59e8f3]">🔒 PRIVATE PICKS</b> · Your friend cannot see these until both of you submit.</div>{error && <div className="mt-3 rounded-xl border border-[#ff6f7d]/35 bg-[#ff6f7d]/10 px-4 py-3 text-xs text-[#ff9aa4]">{error}</div>}<div className="mt-3 grid gap-3 sm:grid-cols-2">{defs.map(d => <div key={d.key} className="rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4"><div className="text-xs font-black uppercase tracking-wide text-white">{d.title}</div><div className="mt-3 grid grid-cols-2 gap-2">{d.options.map(o => <button key={o.value} onClick={() => setChoices(v => ({ ...v, [d.key]: o.value }))} className={`rounded-lg border px-3 py-2.5 text-xs font-bold ${choices[d.key] === o.value ? 'border-[#59e8f3] bg-[#00e6f4]/12 text-[#59e8f3]' : 'border-[#354861] text-[#bdc9d8]'}`}>{o.label}</button>)}</div></div>)}</div><button onClick={() => void submit()} disabled={!complete || busy} className="mt-4 w-full rounded-xl bg-[#59e8f3] px-4 py-3 text-sm font-black text-[#07101f] disabled:opacity-40">{busy ? 'SUBMITTING…' : 'LOCK MY 4 PICKS 🔒'}</button></div>;
};

const Reveal = ({ challenge, onRefresh }: { challenge: Challenge; onRefresh: () => Promise<void> }) => {
  const [checking, setChecking] = useState(false);
  const mine = challenge.my_picks || [];
  const theirs = challenge.other_picks || [];
  const matched = mine.filter(p => theirs.some(x => x.key === p.key && x.choice === p.choice)).length;
  const checkFinal = async () => {
    if (!supabase || !challenge.shared_game) return;
    setChecking(true);
    try {
      const feed = await getGame(Number(challenge.shared_game.gamePk));
      const state = String(feed?.gameData?.status?.abstractGameState || feed?.gameData?.status?.detailedState || '');
      if (!/final|completed/i.test(state)) { alert('This game is not final yet. ScoutBot will keep the challenge open.'); setChecking(false); return; }
      const away = Number(feed?.liveData?.linescore?.teams?.away?.runs ?? 0);
      const home = Number(feed?.liveData?.linescore?.teams?.home?.runs ?? 0);
      const myResults = mine.map(p => ({ ...p, correct: evaluatePick(p, away, home) }));
      const otherResults = theirs.map(p => ({ ...p, correct: evaluatePick(p, away, home) }));
      const myScore = myResults.filter(p => p.correct).length;
      const otherScore = otherResults.filter(p => p.correct).length;
      const result = { away, home, myResults, otherResults, matched, teamUpSharedCorrect: myResults.filter(p => p.correct && theirs.some(x => x.key === p.key && x.choice === p.choice)).length };
      const { error } = await supabase.rpc('complete_friend_challenge', { p_challenge_id: challenge.challenge_id, p_my_score: myScore, p_other_score: otherScore, p_result: result });
      if (!error) await onRefresh();
    } finally { setChecking(false); }
  };
  return <div className="mt-4"><div className="grid gap-3 md:grid-cols-2"><PickList title="YOU" picks={mine} /><PickList title={challenge.other_display_name} picks={theirs} /></div>{challenge.mode === 'team_up' && <div className="mt-3 rounded-xl border border-[#65f2b5]/30 bg-[#65f2b5]/7 p-4 text-center"><div className="text-[10px] font-black uppercase tracking-wider text-[#65f2b5]">Team Chemistry</div><div className="mt-1 text-3xl font-black text-white">{Math.round((matched / 4) * 100)}%</div><div className="text-xs text-[#8fa0b5]">{matched} of 4 picks matched</div></div>}<button onClick={() => void checkFinal()} disabled={checking} className="mt-4 w-full rounded-xl border border-[#59e8f3]/50 bg-[#00e6f4]/8 px-4 py-3 text-sm font-black text-[#59e8f3]">{checking ? 'CHECKING MLB RESULT…' : 'CHECK FINAL RESULT'}</button></div>;
};

const PickList = ({ title, picks }: { title: string; picks: Pick[] }) => <div className="rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-[#59e8f3]">{title}</div><div className="mt-3 space-y-2">{picks.map(p => <div key={p.key} className="flex items-center justify-between gap-3 rounded-lg bg-[#101a2d] px-3 py-2"><span className="text-xs text-[#8fa0b5]">{p.key === 'winner' ? 'Winner' : p.key === 'total_runs' ? 'Total Runs' : p.key === 'both_3' ? 'Both 3+' : 'Margin'}</span><b className="text-xs text-white">{p.label}</b></div>)}</div></div>;

const FinalCard = ({ challenge, onRematch }: { challenge: Challenge; onRematch: () => Promise<void> }) => {
  const result = challenge.result_json || {};
  const mine = Number(challenge.my_score || 0), theirs = Number(challenge.other_score || 0);
  const winner = mine === theirs ? 'TIE' : mine > theirs ? 'YOU WIN 🏆' : `${challenge.other_display_name.toUpperCase()} WINS`;
  return <section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">FINAL · {modeName(challenge.mode)}</div><h3 className="mt-1 text-lg font-black text-white">{gameLabel(challenge.shared_game)}</h3></div><span className="rounded-full border border-[#65f2b5]/35 bg-[#65f2b5]/8 px-3 py-1 text-xs font-black text-[#65f2b5]">{winner}</span></div>{challenge.mode === 'team_up' ? <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4 text-center"><div className="text-xs text-[#8fa0b5]">Shared picks correct</div><div className="mt-1 text-3xl font-black text-[#59e8f3]">{Number(result.teamUpSharedCorrect || 0)} / {Number(result.matched || 0)}</div><div className="mt-1 text-xs text-[#8fa0b5]">Final: {result.away ?? '—'} – {result.home ?? '—'}</div></div> : <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4 text-center"><div><div className="text-xs text-[#59e8f3]">YOU</div><div className="text-4xl font-black text-white">{mine}</div></div><div className="text-xs font-black text-[#65788f]">—</div><div><div className="text-xs text-white">{challenge.other_display_name}</div><div className="text-4xl font-black text-white">{theirs}</div></div></div>}<button onClick={() => void onRematch()} className="mt-4 w-full rounded-xl border border-[#59e8f3]/50 px-4 py-3 text-xs font-black text-[#59e8f3]">REMATCH</button></section>;
};

export const FriendsChallengeView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Friend | null>(null);
  const [view, setView] = useState<View>('play');
  const [error, setError] = useState('');

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    const [f, c] = await Promise.all([supabase.rpc('get_friend_challenge_friends'), supabase.rpc('get_my_friend_challenges')]);
    if (!f.error) setFriends((f.data ?? []) as Friend[]);
    if (!c.error) setChallenges((c.data ?? []) as Challenge[]);
    const loadError = f.error || c.error;
    setError(loadError?.message || '');
    setLoading(false);
  };

  useEffect(() => { void load(); (async () => { try { const now = new Date(); const tomorrow = new Date(now.getTime() + 86400000); const list = [...await getSchedule(now), ...await getSchedule(tomorrow)]; const seen = new Set<number>(); setGames(list.filter(g => g.status === 'Preview' && !seen.has(g.gamePk) && seen.add(g.gamePk))); } catch { setGames([]); } })(); }, []);

  const incoming = useMemo(() => challenges.filter(c => c.role === 'invitee' && c.status === 'pending'), [challenges]);
  const active = useMemo(() => challenges.filter(c => ['choosing', 'negotiating', 'accepted'].includes(c.status)), [challenges]);
  const history = useMemo(() => challenges.filter(c => ['completed', 'declined', 'cancelled'].includes(c.status)), [challenges]);

  const runAction = async (busyKey: string, action: () => Promise<{ error: { message?: string } | null }>, after?: () => void) => {
    setBusy(busyKey);
    setError('');
    const { error: actionError } = await action();
    if (actionError) setError(actionError.message || 'ScoutBot could not finish that action.');
    else {
      after?.();
      await load();
    }
    setBusy(null);
  };
  const send = async (mode?: Mode, friend = selected) => { if (!supabase || !friend) return; await runAction('send', () => supabase.rpc('create_friend_challenge', { p_profile_id: friend.profile_id, p_mode: mode ?? null }), () => { setSelected(null); setView('active'); }); };
  const respond = async (id: string, response: 'accept' | 'decline') => { if (!supabase) return; await runAction(id, () => supabase.rpc('respond_friend_challenge', { p_challenge_id: id, p_response: response })); };
  const prefer = async (id: string, mode: Mode) => { if (!supabase) return; await runAction(id, () => supabase.rpc('set_friend_challenge_preference', { p_challenge_id: id, p_mode: mode })); };
  const randomizeMode = async (id: string) => { if (!supabase) return; await runAction(id, () => supabase.rpc('randomize_friend_challenge_mode', { p_challenge_id: id })); };
  const chooseGame = async (id: string, game: MlbScheduleGame) => { if (!supabase) return; await runAction(id, () => supabase.rpc('choose_friend_challenge_game', { p_challenge_id: id, p_game: gamePayload(game) })); };
  const resetGames = async (id: string) => { if (!supabase) return; await runAction(id, () => supabase.rpc('reset_friend_challenge_game_choices', { p_challenge_id: id })); };
  const randomGame = async (id: string) => { if (!supabase) return; await runAction(id, () => supabase.rpc('randomize_friend_challenge_game', { p_challenge_id: id })); };
  const rematch = async (c: Challenge) => { const f: Friend = { profile_id: c.other_profile_id, display_name: c.other_display_name, avatar_url: c.other_avatar_url }; await send(c.mode || undefined, f); };

  return <div className="min-h-screen bg-[#081225] px-4 py-5 text-[#dae2fd] sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl">
    <div className="flex items-center gap-3"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2d4059] bg-[#101a2d] text-white"><span className="material-symbols-outlined">arrow_back</span></button><div><div className="text-[10px] font-black uppercase tracking-[.16em] text-[#65f2b5]">Free · 0 tickets</div><h1 className="text-2xl font-black text-white sm:text-3xl">Friends Challenge</h1><p className="text-xs text-[#8fa0b5]">ScoutBot handles invitations, private choices, reveals and results.</p></div></div>
    <div className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-[#2a405b] bg-[#0d1728]">{([['play', 'PLAY'], ['inbox', `INVITES${incoming.length ? ` (${incoming.length})` : ''}`], ['active', `ACTIVE${active.length ? ` (${active.length})` : ''}`], ['history', 'HISTORY']] as const).map(([id, label]) => <button key={id} onClick={() => { setView(id); setError(''); }} className={`px-2 py-3 text-[10px] font-black sm:text-xs ${view === id ? 'bg-[#00e6f4]/12 text-[#59e8f3]' : 'text-[#8fa0b5]'}`}>{label}</button>)}</div>
    {error && <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-[#ff6f7d]/35 bg-[#ff6f7d]/10 px-4 py-3 text-xs text-[#ff9aa4]"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error" className="text-[#ffb3ba]">×</button></div>}

    {loading ? <div className="py-20 text-center text-sm text-[#8fa0b5]">Loading Friends Challenge…</div> : <div className="mt-5">
      {view === 'play' && <><section className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><h2 className="text-lg font-black text-white">Choose a friend</h2><p className="mt-1 text-xs text-[#8fa0b5]">Friends are mutual follows. Every Friends Challenge is free.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{friends.length ? friends.map(f => <button key={f.profile_id} onClick={() => setSelected(f)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected?.profile_id === f.profile_id ? 'border-[#59e8f3] bg-[#00e6f4]/8' : 'border-[#2b3e58] bg-[#0c1627]'}`}><Avatar name={f.display_name} url={f.avatar_url} /><div className="min-w-0"><div className="truncate font-bold text-white">{f.display_name}</div><div className="text-[10px] uppercase tracking-wide text-[#65f2b5]">{f.scout_level || 'Rookie Scout'}</div></div></button>) : <div className="text-sm text-[#8fa0b5]">You need a mutual friend before you can send a Friends Challenge.</div>}</div></section>
      {selected && <section className="mt-4 rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="text-xs font-black uppercase tracking-[.14em] text-[#59e8f3]">Challenge {selected.display_name}</div><div className="mt-4 grid gap-3 md:grid-cols-3">{modes.map(m => <button key={m.id} onClick={() => m.available && void send(m.id)} disabled={busy === 'send' || !m.available} className={`rounded-xl border p-4 text-left ${m.available ? 'border-[#2b3e58] bg-[#0c1627] hover:border-[#59e8f3]/60' : 'border-[#2b3e58] bg-[#0c1627]/65 opacity-60'}`}><div className="text-2xl">{m.icon}</div><div className="mt-2 font-black text-white">{m.title}</div><div className="mt-1 text-xs text-[#8fa0b5]">{m.sub}</div><div className={`mt-3 text-[10px] font-black ${m.available ? 'text-[#65f2b5]' : 'text-[#8fa0b5]'}`}>{m.available ? 'QUICK CHALLENGE' : 'COMING SOON'}</div></button>)}</div><button onClick={() => void send()} disabled={busy === 'send'} className="mt-3 w-full rounded-xl border border-[#59e8f3]/50 bg-[#00e6f4]/7 px-4 py-3 text-sm font-black text-[#59e8f3]">🤖 PLAY TOGETHER — LET SCOUTBOT ASK BOTH OF US</button></section>}</>}

      {view === 'inbox' && <div className="space-y-4">{incoming.length ? incoming.map(c => <section key={c.challenge_id} className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">🤖 ScoutBot</div><h3 className="mt-2 text-lg font-black text-white">{c.other_display_name} invited you to {c.mode ? modeName(c.mode) : 'play a Friends Challenge'}.</h3><p className="mt-1 text-xs text-[#8fa0b5]">{c.mode ? 'Accept to start.' : 'Accept and ScoutBot will privately ask both of you which mode you prefer.'}</p><div className="mt-4 flex gap-2"><button onClick={() => void respond(c.challenge_id, 'accept')} disabled={busy === c.challenge_id} className="rounded-xl bg-[#59e8f3] px-5 py-2.5 text-xs font-black text-[#07101f]">ACCEPT</button><button onClick={() => void respond(c.challenge_id, 'decline')} disabled={busy === c.challenge_id} className="rounded-xl border border-[#3a4b63] px-5 py-2.5 text-xs font-black text-[#aebbd0]">DECLINE</button></div></section>) : <Empty text="No new challenge invitations." />}</div>}

      {view === 'active' && <div className="space-y-4">{active.length ? active.map(c => <section key={c.challenge_id} className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="flex items-center gap-3"><Avatar name={c.other_display_name} url={c.other_avatar_url} /><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">🤖 ScoutBot · {c.other_display_name}</div><div className="text-xs text-[#718090]">0 tickets · separate from Weekly Challenge</div></div></div>
        {c.status === 'choosing' && <><h3 className="mt-4 text-lg font-black text-white">Which type of game do you prefer?</h3><p className="mt-1 text-xs text-[#8fa0b5]">Your choice stays private until both of you choose.</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{modes.map(m => <button key={m.id} onClick={() => m.available && void prefer(c.challenge_id, m.id)} disabled={busy === c.challenge_id || !m.available} className={`rounded-xl border px-3 py-3 text-xs font-black ${m.available ? 'border-[#2b3e58] bg-[#0c1627] text-white' : 'border-[#2b3e58] bg-[#0c1627]/65 text-[#8fa0b5] opacity-60'}`}>{m.icon} {m.title}{!m.available ? ' · Coming Soon' : ''}</button>)}</div></>}
        {c.status === 'negotiating' && <><h3 className="mt-4 text-lg font-black text-white">You chose different modes.</h3><p className="mt-1 text-xs text-[#8fa0b5]">Choose again or let ScoutBot randomly pick between your choices.</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{modes.map(m => <button key={m.id} onClick={() => m.available && void prefer(c.challenge_id, m.id)} disabled={!m.available} className={`rounded-xl border px-3 py-2 text-xs font-bold ${m.available ? 'border-[#3a4b63]' : 'border-[#2b3e58] text-[#8fa0b5] opacity-60'}`}>{m.icon} {m.title}{!m.available ? ' · Coming Soon' : ''}</button>)}</div><button onClick={() => void randomizeMode(c.challenge_id)} className="mt-3 rounded-xl bg-[#59e8f3] px-4 py-2.5 text-xs font-black text-[#07101f]">🎲 RANDOM MODE</button></>}
        {c.status === 'accepted' && c.mode === 'weekly_h2h' && <><h3 className="mt-4 text-lg font-black text-white">⚔️ Weekly Head-to-Head is live</h3><p className="mt-1 text-xs text-[#8fa0b5]">No extra picks. Your normal ScoutCore predictions this week are compared automatically.</p><WeeklyMatchup challenge={c} /></>}
        {c.status === 'accepted' && c.mode !== 'weekly_h2h' && !c.shared_game && <><h3 className="mt-4 text-lg font-black text-white">{modeName(c.mode)} · choose the game privately</h3>{!c.my_game_choice ? <><p className="mt-1 text-xs text-[#8fa0b5]">Pick one upcoming MLB game. ScoutBot will only reveal choices after both of you choose.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{games.length ? games.map(g => <button key={g.gamePk} onClick={() => void chooseGame(c.challenge_id, g)} disabled={busy === c.challenge_id} className="flex items-center justify-between gap-3 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-3 text-left hover:border-[#59e8f3]/55"><div className="flex items-center gap-2"><img src={teamLogo(g.awayTeam.id)} alt="" className="h-7 w-7" /><span className="text-xs font-black text-white">{shortTeam(g.awayTeam.name)}</span><span className="text-[10px] text-[#718090]">vs</span><img src={teamLogo(g.homeTeam.id)} alt="" className="h-7 w-7" /><span className="text-xs font-black text-white">{shortTeam(g.homeTeam.name)}</span></div><span className="material-symbols-outlined text-[#59e8f3]">chevron_right</span></button>) : <div className="text-xs text-[#8fa0b5]">No upcoming games found right now.</div>}</div></> : !c.other_game_choice ? <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4"><div className="text-xs text-[#8fa0b5]">Your private choice</div><div className="mt-1 font-black text-white">{gameLabel(c.my_game_choice)}</div><div className="mt-2 text-xs font-bold text-[#59e8f3]">Waiting for {c.other_display_name} to choose…</div></div> : <div className="mt-4 rounded-xl border border-[#ffb84d]/25 bg-[#ffb84d]/5 p-4"><div className="text-xs font-black text-[#ffcc73]">Different game choices</div><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><span className="text-[10px] text-[#8fa0b5]">YOU</span><div className="font-bold text-white">{gameLabel(c.my_game_choice)}</div></div><div><span className="text-[10px] text-[#8fa0b5]">{c.other_display_name.toUpperCase()}</span><div className="font-bold text-white">{gameLabel(c.other_game_choice)}</div></div></div><div className="mt-3 flex gap-2"><button onClick={() => void resetGames(c.challenge_id)} className="rounded-xl border border-[#3a4b63] px-4 py-2.5 text-xs font-black">TRY AGAIN</button><button onClick={() => void randomGame(c.challenge_id)} className="rounded-xl bg-[#59e8f3] px-4 py-2.5 text-xs font-black text-[#07101f]">🎲 RANDOM BETWEEN THESE</button></div></div>}</>}
        {c.status === 'accepted' && c.mode !== 'weekly_h2h' && c.shared_game && <><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-4"><div><div className="text-[10px] font-black uppercase tracking-wide text-[#59e8f3]">GAME MATCH ✓</div><div className="mt-1 flex items-center gap-2 font-black text-white"><img src={teamLogo(c.shared_game.awayTeam.id)} alt="" className="h-7 w-7" />{shortTeam(c.shared_game.awayTeam.name)} <span className="text-[#718090]">vs</span> <img src={teamLogo(c.shared_game.homeTeam.id)} alt="" className="h-7 w-7" />{shortTeam(c.shared_game.homeTeam.name)}</div></div><span className="rounded-full border border-[#65f2b5]/30 px-3 py-1 text-[10px] font-black text-[#65f2b5]">BOTH CHOSE THIS GAME</span></div>{!c.my_submitted ? <PickBuilder challenge={c} onDone={load} /> : !c.other_submitted ? <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0c1627] p-5 text-center"><div className="text-2xl">🔒</div><div className="mt-2 font-black text-white">Your picks are locked</div><div className="mt-1 text-xs text-[#8fa0b5]">Waiting for {c.other_display_name}. Your picks are still hidden.</div></div> : <Reveal challenge={c} onRefresh={load} />}</>}
      </section>) : <Empty text="No active Friends Challenges yet." />}</div>}

      {view === 'history' && <div className="space-y-4">{history.length ? history.map(c => c.status === 'completed' ? <FinalCard key={c.challenge_id} challenge={c} onRematch={() => rematch(c)} /> : <section key={c.challenge_id} className="rounded-2xl border border-[#2a405b] bg-[#101a2d] p-5"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#718090]">{c.status}</div><h3 className="mt-1 font-black text-white">{modeName(c.mode)} · {c.other_display_name}</h3></section>) : <Empty text="No finished Friends Challenges yet." />}</div>}
    </div>}
  </div></div>;
};

const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed border-[#31445f] bg-[#0e192b] px-5 py-16 text-center text-sm text-[#8fa0b5]">{text}</div>;
