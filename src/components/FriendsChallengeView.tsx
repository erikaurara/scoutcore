import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getGame, getSchedule, type MlbScheduleGame } from '../services/mlbApi';

export type FriendsChallengeMode = 'weekly_h2h' | 'same_game' | 'team_up';
type View = 'play' | 'inbox' | 'active' | 'history';
type Friend = { profile_id: string; display_name: string; avatar_url?: string | null; scout_level?: string | null };
type GameChoice = {
  gamePk: number;
  gameDate: string;
  status: string;
  detailedState?: string;
  awayTeam: { id: number; name: string };
  homeTeam: { id: number; name: string };
};
type PickKey = 'winner' | 'total_runs' | 'both_3' | 'close_game' | 'home_4';
type Pick = { key: PickKey; choice: string; label: string; correct?: boolean };
type Challenge = {
  challenge_id: string;
  role: 'inviter' | 'invitee';
  other_profile_id: string;
  other_display_name: string;
  other_avatar_url?: string | null;
  mode?: FriendsChallengeMode | null;
  inviter_preference?: FriendsChallengeMode | null;
  invitee_preference?: FriendsChallengeMode | null;
  status: string;
  created_at: string;
  updated_at: string;
  shared_game?: GameChoice | null;
  my_game_choice?: GameChoice | null;
  other_game_choice?: GameChoice | null;
  my_picks?: Pick[] | null;
  other_picks?: Pick[] | null;
  my_submitted?: boolean;
  other_submitted?: boolean;
  my_score?: number | null;
  other_score?: number | null;
  result_json?: Record<string, any> | null;
  completed_at?: string | null;
  week_key?: string | null;
};
type TeamMember = {
  profile_id: string;
  display_name: string;
  avatar_url?: string | null;
  team: 1 | 2;
  role: 'captain' | 'member';
  invite_status: 'pending' | 'accepted' | 'declined';
  submitted: boolean;
  score?: number | null;
  picks?: Pick[] | null;
};
type TeamChallenge = {
  team_challenge_id: string;
  my_team: 1 | 2;
  my_role: 'captain' | 'member';
  my_invite_status: 'pending' | 'accepted' | 'declined';
  status: 'building_team' | 'choosing_opponents' | 'pending_opponents' | 'choosing_game' | 'picking' | 'locked' | 'completed' | 'cancelled';
  game?: GameChoice | null;
  members: TeamMember[];
  team_one_score?: number | null;
  team_two_score?: number | null;
  result_json?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
};
type WeeklyStats = {
  my_correct: number;
  my_total: number;
  my_points: number;
  other_correct: number;
  other_total: number;
  other_points: number;
};

const modeInfo = {
  weekly_h2h: { icon: 'swords', eyebrow: 'Mode 1 · 1 vs 1', title: 'Weekly Head-to-Head', description: 'Your normal weekly ScoutCore picks are compared automatically. No extra predictions.', accent: '#50eaf4' },
  same_game: { icon: 'sports_baseball', eyebrow: 'Mode 2 · 1 vs 1', title: 'Same Game: You vs Friend', description: 'Choose one MLB game, invite a friend, and make private picks before they lock.', accent: '#bd72ff' },
  team_up: { icon: 'groups', eyebrow: 'Mode 3 · 2 vs 2', title: 'Team Up: Two vs Two', description: 'Build a duo, invite two opponents, and combine every correct pick into one team score.', accent: '#8bed68' },
} as const;

const flowSteps: Record<FriendsChallengeMode, { title: string; copy: string }[]> = {
  weekly_h2h: [
    { title: 'Choose a Friend', copy: 'Start from your friends list' },
    { title: 'Invite & Accept', copy: 'Your friend confirms' },
    { title: 'Make Weekly Picks', copy: 'Normal ScoutCore picks' },
    { title: 'Scores Update', copy: 'Compare weekly progress' },
    { title: 'Winner & History', copy: 'Final result is saved' },
  ],
  same_game: [
    { title: 'Choose a Game', copy: 'Select one MLB matchup' },
    { title: 'Invite a Friend', copy: 'Send the selected game' },
    { title: 'Both Make Picks', copy: 'Predictions stay private' },
    { title: 'Picks Lock', copy: 'No edits after first pitch' },
    { title: 'Reveal Results', copy: 'Compare picks and winner' },
  ],
  team_up: [
    { title: 'Build Your Team', copy: 'Choose one teammate' },
    { title: 'Choose Opponents', copy: 'Invite another duo' },
    { title: 'Everyone Predicts', copy: 'Five private picks each' },
    { title: 'All Picks Lock', copy: 'Four players confirmed' },
    { title: 'Combined Result', copy: 'Every correct pick counts' },
  ],
};

const shortTeam = (name: string) => name.replace(/^(Arizona|Atlanta|Baltimore|Boston|Chicago|Cincinnati|Cleveland|Colorado|Detroit|Houston|Kansas City|Los Angeles|Miami|Milwaukee|Minnesota|New York|Oakland|Philadelphia|Pittsburgh|San Diego|San Francisco|Seattle|St\. Louis|Tampa Bay|Texas|Toronto|Washington)\s+/, '');
const teamLogo = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;
const gameLabel = (game?: GameChoice | null) => game ? `${shortTeam(game.awayTeam.name)} vs ${shortTeam(game.homeTeam.name)}` : 'MLB game';
const accuracy = (correct: number, total: number) => total ? Math.round((correct / total) * 100) : 0;
const gamePayload = (game: MlbScheduleGame): GameChoice => ({
  gamePk: game.gamePk,
  gameDate: game.gameDate,
  status: game.status,
  detailedState: game.detailedState,
  awayTeam: { id: game.awayTeam.id, name: game.awayTeam.name },
  homeTeam: { id: game.homeTeam.id, name: game.homeTeam.name },
});

const pickDefinitions = (game: GameChoice, teamMode = false) => {
  const rows = [
    { key: 'winner' as PickKey, title: 'Game Winner', options: [{ value: 'away', label: shortTeam(game.awayTeam.name) }, { value: 'home', label: shortTeam(game.homeTeam.name) }] },
    { key: 'total_runs' as PickKey, title: 'Total Runs', options: [{ value: '8plus', label: '8+ runs' }, { value: '7under', label: '7 or fewer' }] },
    { key: 'both_3' as PickKey, title: 'Both Score 3+', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    { key: 'close_game' as PickKey, title: 'Final Margin', options: [{ value: 'one', label: '1-run game' }, { value: 'two_plus', label: '2+ runs' }] },
  ];
  if (teamMode) rows.push({ key: 'home_4', title: `${shortTeam(game.homeTeam.name)} Score 4+`, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] });
  return rows;
};

const Avatar = ({ name, url, small = false }: { name: string; url?: string | null; small?: boolean }) => (
  <div className={`${small ? 'h-9 w-9 text-[10px]' : 'h-11 w-11 text-xs'} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#2a5268] bg-[#59e8f3]/10 font-black text-[#59e8f3]`}>
    {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : name.slice(0, 2).toUpperCase()}
  </div>
);

const FlowStrip = ({ mode, current }: { mode: FriendsChallengeMode; current: number }) => {
  const accent = modeInfo[mode].accent;
  return <div className="mt-3 grid gap-2 sm:grid-cols-5" aria-label="Challenge progress">{flowSteps[mode].map((step, index) => <div key={step.title} className="rounded-xl border bg-[#09172a] p-3" style={{ borderColor: index <= current ? `${accent}78` : '#29425e' }}><div className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black text-[#06101f]" style={{ backgroundColor: index <= current ? accent : '#40516a' }}>{index < current ? '✓' : index + 1}</span><div className="min-w-0"><div className="truncate text-[10px] font-black uppercase text-white">{step.title}</div><div className="mt-0.5 truncate text-[9px] text-[#8191a5]">{step.copy}</div></div></div></div>)}</div>;
};

const ModeHeader = ({ mode, onBack }: { mode: FriendsChallengeMode; onBack: () => void }) => {
  const info = modeInfo[mode];
  return <header className="rounded-2xl border border-[#263f59] bg-[#09172a]/95 p-4 sm:p-5"><div className="flex items-start gap-3"><button type="button" onClick={onBack} aria-label="Back to Friends Challenge" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2d4059] bg-[#0d1b2e] text-white"><span className="material-symbols-outlined">arrow_back</span></button><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: `${info.accent}88`, color: info.accent, backgroundColor: `${info.accent}12` }}><span className="material-symbols-outlined">{info.icon}</span></div><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[.18em]" style={{ color: info.accent }}>{info.eyebrow}</div><h1 className="mt-1 text-xl font-black uppercase leading-tight text-white sm:text-2xl">{info.title}</h1><p className="mt-1 text-xs leading-5 text-[#91a0b4]">{info.description}</p></div></div></header>;
};

const GameButton = ({ game, selected, onClick }: { game: MlbScheduleGame; selected?: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selected ? 'border-[#bd72ff] bg-[#bd72ff]/10' : 'border-[#2b3e58] bg-[#0a1728]'}`}><div className="flex items-center gap-2"><img src={teamLogo(game.awayTeam.id)} alt="" className="h-7 w-7" /><span className="text-xs font-black text-white">{shortTeam(game.awayTeam.name)}</span><span className="text-[9px] text-[#718090]">VS</span><img src={teamLogo(game.homeTeam.id)} alt="" className="h-7 w-7" /><span className="text-xs font-black text-white">{shortTeam(game.homeTeam.name)}</span></div><span className="ml-auto text-[9px] font-black uppercase text-[#bd72ff]">{new Date(game.gameDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></button>
);

const SharedGame = ({ game, accent }: { game: GameChoice; accent: string }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-[#071425] p-4" style={{ borderColor: `${accent}65` }}><div><div className="text-[9px] font-black uppercase tracking-[.13em]" style={{ color: accent }}>Shared MLB Game</div><div className="mt-1 flex items-center gap-2 font-black text-white"><img src={teamLogo(game.awayTeam.id)} alt="" className="h-7 w-7" />{shortTeam(game.awayTeam.name)}<span className="text-[#718090]">vs</span><img src={teamLogo(game.homeTeam.id)} alt="" className="h-7 w-7" />{shortTeam(game.homeTeam.name)}</div></div><div className="text-[10px] text-[#8fa0b5]">{new Date(game.gameDate).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>
);

const PickBuilder = ({ game, teamMode = false, onSubmit }: { game: GameChoice; teamMode?: boolean; onSubmit: (picks: Pick[]) => Promise<void> }) => {
  const definitions = pickDefinitions(game, teamMode);
  const [choices, setChoices] = useState<Partial<Record<PickKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const complete = definitions.every((definition) => Boolean(choices[definition.key]));
  const submit = async () => {
    if (!complete) return;
    setBusy(true); setError('');
    try { const picks = definitions.map((definition) => ({ key: definition.key, choice: choices[definition.key]!, label: definition.options.find((option) => option.value === choices[definition.key])?.label || choices[definition.key]! })); await onSubmit(picks); }
    catch (caughtError: any) { setError(caughtError?.message || 'Could not lock your picks.'); }
    finally { setBusy(false); }
  };
  return <div className="mt-4"><div className="rounded-xl border border-[#bd72ff]/35 bg-[#bd72ff]/5 px-4 py-3 text-xs text-[#aebbd0]"><b className="text-[#d297ff]">PRIVATE PICKS</b> · Nobody else can see these until the MLB game is final.</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{definitions.map((definition) => <div key={definition.key} className="rounded-xl border border-[#2b3e58] bg-[#0a1728] p-4"><div className="text-xs font-black uppercase tracking-wide text-white">{definition.title}</div><div className="mt-3 grid grid-cols-2 gap-2">{definition.options.map((option) => <button type="button" key={option.value} onClick={() => setChoices((current) => ({ ...current, [definition.key]: option.value }))} className={`rounded-lg border px-3 py-2.5 text-xs font-bold ${choices[definition.key] === option.value ? 'border-[#bd72ff] bg-[#bd72ff]/12 text-[#d297ff]' : 'border-[#354861] text-[#bdc9d8]'}`}>{option.label}</button>)}</div></div>)}</div>{error && <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">{error}</div>}<button type="button" onClick={() => void submit()} disabled={!complete || busy} className="mt-4 w-full rounded-xl bg-[#bd72ff] px-4 py-3 text-sm font-black uppercase text-[#10061b] disabled:opacity-40">{busy ? 'Locking picks…' : `Submit ${definitions.length} private picks`}</button></div>;
};

const PickList = ({ title, picks = [] }: { title: string; picks?: Pick[] | null }) => (
  <div className="rounded-xl border border-[#2b3e58] bg-[#0a1728] p-4"><div className="text-[10px] font-black uppercase tracking-[.12em] text-[#59e8f3]">{title}</div><div className="mt-3 space-y-2">{picks.map((pick) => <div key={pick.key} className="flex items-center justify-between gap-3 rounded-lg bg-[#101c2f] px-3 py-2"><span className="text-xs text-[#8fa0b5]">{pick.key === 'winner' ? 'Winner' : pick.key === 'total_runs' ? 'Total Runs' : pick.key === 'both_3' ? 'Both 3+' : pick.key === 'close_game' ? 'Margin' : 'Home 4+'}</span><span className="flex items-center gap-2 text-xs font-black text-white">{pick.label}{typeof pick.correct === 'boolean' && <span className={pick.correct ? 'text-[#8bed68]' : 'text-[#ff7d8b]'}>{pick.correct ? '✓' : '×'}</span>}</span></div>)}</div></div>
);

const AutoSettlement = ({ kind, challengeId, game, onSettled }: { kind: 'same' | 'team'; challengeId: string; game: GameChoice; onSettled: () => Promise<void> }) => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('ScoutCore checks the verified MLB result automatically.');
  const refreshRef = useRef(onSettled);
  const checkingRef = useRef(false);
  refreshRef.current = onSettled;
  const check = useCallback(async (quiet = false) => {
    if (!supabase || checkingRef.current) return;
    checkingRef.current = true; setChecking(true);
    try {
      const feed = await getGame(Number(game.gamePk));
      const gameState = String(feed?.gameData?.status?.abstractGameState || feed?.gameData?.status?.detailedState || '');
      if (!/final|completed/i.test(gameState)) { if (!quiet) setStatus('The game is not final yet. This challenge will stay locked.'); return; }
      const away = Number(feed?.liveData?.linescore?.teams?.away?.runs ?? 0), home = Number(feed?.liveData?.linescore?.teams?.home?.runs ?? 0);
      const rpc = kind === 'same' ? 'settle_friend_same_game' : 'settle_friend_team_challenge';
      const { error } = await supabase.rpc(rpc, { p_challenge_id: challengeId, p_away_runs: away, p_home_runs: home });
      if (error) throw error;
      setStatus('Final result verified. Updating the winner…'); await refreshRef.current();
    } catch (caughtError: any) { if (!quiet) setStatus(caughtError?.message || 'Could not verify the final result yet.'); }
    finally { checkingRef.current = false; setChecking(false); }
  }, [challengeId, game.gamePk, kind]);
  useEffect(() => { void check(true); const timer = window.setInterval(() => void check(true), 60000); return () => window.clearInterval(timer); }, [check]);
  return <div className="mt-4 rounded-xl border border-[#59e8f3]/30 bg-[#00e6f4]/5 p-4 text-center"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#59e8f3]">Automatic scoring</div><p className="mt-1 text-xs text-[#92a2b7]">{status}</p><button type="button" onClick={() => void check(false)} disabled={checking} className="mt-3 rounded-lg border border-[#59e8f3]/55 px-4 py-2 text-[10px] font-black uppercase text-[#59e8f3] disabled:opacity-50">{checking ? 'Checking MLB result…' : 'Check now'}</button></div>;
};

const WeeklyMatchup = ({ challenge, onRefresh }: { challenge: Challenge; onRefresh: () => Promise<void> }) => {
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  useEffect(() => { let live = true; void (async () => { if (!supabase) return; const { data } = await supabase.rpc('get_friend_weekly_matchup', { p_challenge_id: challenge.challenge_id }); const row = Array.isArray(data) ? data[0] : data; if (live && row) setStats(row as WeeklyStats); })(); return () => { live = false; }; }, [challenge.challenge_id, challenge.updated_at]);
  if (!stats) return <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0a1728] p-5 text-xs text-[#8fa0b5]">Loading this week’s automatic matchup…</div>;
  const mineAccuracy = accuracy(Number(stats.my_correct || 0), Number(stats.my_total || 0));
  const otherAccuracy = accuracy(Number(stats.other_correct || 0), Number(stats.other_total || 0));
  const mineLeading = Number(stats.my_points) > Number(stats.other_points), tied = Number(stats.my_points) === Number(stats.other_points);
  const weekEnd = challenge.week_key ? new Date(`${challenge.week_key}T00:00:00Z`).getTime() + 7 * 86400000 : null;
  return <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0a1728] p-4"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center"><div><div className="text-[10px] font-black text-[#59e8f3]">YOU</div><div className="mt-1 text-3xl font-black text-white">{stats.my_points}</div><div className="text-[10px] text-[#8fa0b5]">{stats.my_correct}/{stats.my_total} · {mineAccuracy}%</div></div><div className="text-xs font-black text-[#65788f]">VS</div><div><div className="truncate text-[10px] font-black text-white">{challenge.other_display_name}</div><div className="mt-1 text-3xl font-black text-white">{stats.other_points}</div><div className="text-[10px] text-[#8fa0b5]">{stats.other_correct}/{stats.other_total} · {otherAccuracy}%</div></div></div><div className="mt-3 border-t border-[#263951] pt-3 text-center text-xs font-black text-[#65f2b5]">{tied ? 'TIED RIGHT NOW' : mineLeading ? 'YOU’RE LEADING' : `${challenge.other_display_name.toUpperCase()} IS LEADING`}</div><p className="mt-1 text-center text-[10px] text-[#8292a7]">Every completed normal Weekly Challenge prediction updates this score.</p>{weekEnd && Date.now() >= weekEnd && <button type="button" onClick={async () => { if (supabase) await supabase.rpc('complete_friend_weekly_challenge', { p_challenge_id: challenge.challenge_id }); await onRefresh(); }} className="mt-3 w-full rounded-lg border border-[#65f2b5]/45 px-3 py-2 text-[10px] font-black uppercase text-[#65f2b5]">Save final weekly result</button>}</div>;
};

const TeamRoster = ({ members }: { members: TeamMember[] }) => (
  <div className="grid gap-3 sm:grid-cols-2">{([1, 2] as const).map((team) => <div key={team} className="rounded-xl border border-[#2b4059] bg-[#091729] p-3"><div className={`text-[10px] font-black uppercase tracking-[.14em] ${team === 1 ? 'text-[#8bed68]' : 'text-[#f6bf4f]'}`}>{team === 1 ? 'Team Cyan' : 'Team Gold'}</div><div className="mt-2 space-y-2">{members.filter((member) => member.team === team).map((member) => <div key={member.profile_id} className="flex items-center gap-2 rounded-lg bg-[#101c2f] p-2"><Avatar name={member.display_name} url={member.avatar_url} small /><div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-white">{member.display_name}</div><div className="text-[9px] uppercase text-[#8292a7]">{member.role}{member.submitted ? ' · picks locked' : ''}</div></div><span className={`text-[9px] font-black uppercase ${member.invite_status === 'accepted' ? 'text-[#8bed68]' : member.invite_status === 'declined' ? 'text-[#ff7d8b]' : 'text-[#f6bf4f]'}`}>{member.score != null ? `${member.score}/5` : member.invite_status}</span></div>)}{!members.some((member) => member.team === team) && <div className="rounded-lg border border-dashed border-[#31455f] px-3 py-5 text-center text-[10px] text-[#718198]">Waiting for this duo</div>}</div></div>)}</div>
);

type ActionRunner = (key: string, action: () => PromiseLike<{ error: any }>, after?: () => void) => Promise<boolean>;

const OneVOneFinal = ({ challenge, onRematch }: { challenge: Challenge; onRematch: () => Promise<void> }) => {
  const mine = Number(challenge.my_score || 0), theirs = Number(challenge.other_score || 0);
  const winner = mine === theirs ? 'Tie game' : mine > theirs ? 'You won!' : `${challenge.other_display_name} won`;
  const mode = challenge.mode || 'same_game';
  return <section className="rounded-2xl border border-[#29425e] bg-[#09172a] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">Final · {modeInfo[mode].title}</div><h3 className="mt-1 text-lg font-black text-white">{mode === 'weekly_h2h' ? `Week of ${challenge.week_key || '—'}` : gameLabel(challenge.shared_game)}</h3></div><span className="rounded-full border border-[#65f2b5]/40 bg-[#65f2b5]/8 px-3 py-1 text-xs font-black text-[#65f2b5]">{winner}</span></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-[#050b12] p-5 text-center"><div><div className="text-xs text-[#59e8f3]">YOU</div><div className="text-4xl font-black text-white">{mine}</div></div><div className="text-xs font-black text-[#65788f]">VS</div><div><div className="truncate text-xs text-white">{challenge.other_display_name}</div><div className="text-4xl font-black text-white">{theirs}</div></div></div>{mode === 'same_game' && challenge.result_json && <div className="mt-3 grid gap-3 sm:grid-cols-2"><PickList title="Your results" picks={(challenge.role === 'inviter' ? challenge.result_json.inviterResults : challenge.result_json.inviteeResults) as Pick[] | undefined} /><PickList title={`${challenge.other_display_name}'s results`} picks={(challenge.role === 'inviter' ? challenge.result_json.inviteeResults : challenge.result_json.inviterResults) as Pick[] | undefined} /></div>}<button type="button" onClick={() => void onRematch()} className="mt-4 w-full rounded-xl border border-[#59e8f3]/50 px-4 py-3 text-xs font-black uppercase text-[#59e8f3]">Rematch</button></section>;
};

const TeamFinal = ({ challenge }: { challenge: TeamChallenge }) => {
  const mine = challenge.my_team === 1 ? Number(challenge.team_one_score || 0) : Number(challenge.team_two_score || 0), theirs = challenge.my_team === 1 ? Number(challenge.team_two_score || 0) : Number(challenge.team_one_score || 0);
  const winner = mine === theirs ? 'Tie game' : mine > theirs ? 'Your team won!' : 'Opponent team won';
  return <section className="rounded-2xl border border-[#8bed68]/35 bg-[#09172a] p-4 sm:p-5"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8bed68]">Final team score</div><h3 className="mt-1 text-xl font-black text-white">{winner}</h3><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-[#050b12] p-5 text-center"><div><div className="text-xs text-[#8bed68]">YOUR TEAM</div><div className="text-4xl font-black text-white">{mine}</div></div><div className="text-xs font-black text-[#65788f]">VS</div><div><div className="text-xs text-[#f6bf4f]">OPPONENTS</div><div className="text-4xl font-black text-white">{theirs}</div></div></div><div className="mt-3"><TeamRoster members={challenge.members} /></div></section>;
};

const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed border-[#31445f] bg-[#0a1728] px-5 py-16 text-center text-sm text-[#8fa0b5]">{text}</div>;

export const FriendsChallengeView: React.FC<{ onBack: () => void; initialMode?: FriendsChallengeMode | null; initialView?: View }> = ({ onBack, initialMode = null, initialView = 'play' }) => {
  const [view, setView] = useState<View>(initialView);
  const [draftMode, setDraftMode] = useState<FriendsChallengeMode | null>(initialMode);
  const [friends, setFriends] = useState<Friend[]>([]), [challenges, setChallenges] = useState<Challenge[]>([]), [teamChallenges, setTeamChallenges] = useState<TeamChallenge[]>([]), [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState<string | null>(null), [selectedFriendId, setSelectedFriendId] = useState<string | null>(null), [selectedGamePk, setSelectedGamePk] = useState<number | null>(null), [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const [friendResult, challengeResult, teamResult] = await Promise.all([supabase.rpc('get_friend_challenge_friends'), supabase.rpc('get_my_friend_challenges'), supabase.rpc('get_my_friend_team_challenges')]);
    if (!friendResult.error) setFriends((friendResult.data ?? []) as Friend[]);
    const oneRows = (challengeResult.data ?? []) as Challenge[];
    if (!challengeResult.error) setChallenges(oneRows);
    if (!teamResult.error) setTeamChallenges(((teamResult.data ?? []) as TeamChallenge[]).map((challenge) => ({ ...challenge, members: Array.isArray(challenge.members) ? challenge.members : [] })));
    setError((friendResult.error || challengeResult.error || teamResult.error)?.message || ''); setLoading(false);
    const dueWeekly = oneRows.filter((challenge) => challenge.mode === 'weekly_h2h' && challenge.status === 'accepted' && challenge.week_key && Date.now() >= new Date(`${challenge.week_key}T00:00:00Z`).getTime() + 7 * 86400000);
    if (dueWeekly.length) { await Promise.all(dueWeekly.map((challenge) => supabase.rpc('complete_friend_weekly_challenge', { p_challenge_id: challenge.challenge_id }))); const refreshed = await supabase.rpc('get_my_friend_challenges'); if (!refreshed.error) setChallenges((refreshed.data ?? []) as Challenge[]); }
  }, []);

  useEffect(() => { void load(); void (async () => { try { const now = new Date(), tomorrow = new Date(now.getTime() + 86400000), list = [...await getSchedule(now), ...await getSchedule(tomorrow)], seen = new Set<number>(); setGames(list.filter((game) => { if (game.status !== 'Preview' || seen.has(game.gamePk)) return false; seen.add(game.gamePk); return true; }).slice(0, 16)); } catch { setGames([]); } })(); }, [load]);

  const incoming = useMemo(() => challenges.filter((challenge) => challenge.role === 'invitee' && challenge.status === 'pending'), [challenges]);
  const incomingTeams = useMemo(() => teamChallenges.filter((challenge) => challenge.my_invite_status === 'pending' && challenge.status !== 'cancelled'), [teamChallenges]);
  const active = useMemo(() => challenges.filter((challenge) => (challenge.role === 'inviter' && challenge.status === 'pending') || ['choosing', 'negotiating', 'accepted'].includes(challenge.status)), [challenges]);
  const activeTeams = useMemo(() => teamChallenges.filter((challenge) => challenge.my_invite_status === 'accepted' && !['completed', 'cancelled'].includes(challenge.status)), [teamChallenges]);
  const history = useMemo(() => challenges.filter((challenge) => ['completed', 'declined', 'cancelled'].includes(challenge.status)), [challenges]);
  const teamHistory = useMemo(() => teamChallenges.filter((challenge) => ['completed', 'cancelled'].includes(challenge.status)), [teamChallenges]);
  const runAction: ActionRunner = async (key, action, after) => { setBusy(key); setError(''); try { const { error: actionError } = await action(); if (actionError) throw actionError; after?.(); await load(); return true; } catch (caughtError: any) { setError(caughtError?.message || 'ScoutCore could not finish that action.'); return false; } finally { setBusy(null); } };
  const selectedFriend = friends.find((friend) => friend.profile_id === selectedFriendId) || null, selectedGame = games.find((game) => game.gamePk === selectedGamePk) || null;
  const createDraft = async () => { if (!supabase || !draftMode || !selectedFriend) return; let success = false; if (draftMode === 'weekly_h2h') success = await runAction('create', () => supabase.rpc('create_friend_challenge', { p_profile_id: selectedFriend.profile_id, p_mode: 'weekly_h2h' }), () => setView('active')); else if (draftMode === 'same_game') { if (!selectedGame) { setError('Choose an upcoming MLB game first.'); return; } success = await runAction('create', () => supabase.rpc('create_same_game_friend_challenge', { p_profile_id: selectedFriend.profile_id, p_game: gamePayload(selectedGame) }), () => setView('active')); } else success = await runAction('create', () => supabase.rpc('create_friend_team_challenge', { p_teammate_profile_id: selectedFriend.profile_id }), () => setView('active')); if (success) { setDraftMode(null); setSelectedFriendId(null); setSelectedGamePk(null); } };
  const rematch = async (challenge: Challenge) => { if (!supabase) return; if (challenge.mode === 'same_game' && challenge.shared_game) await runAction('rematch', () => supabase.rpc('create_same_game_friend_challenge', { p_profile_id: challenge.other_profile_id, p_game: challenge.shared_game }), () => setView('active')); else await runAction('rematch', () => supabase.rpc('create_friend_challenge', { p_profile_id: challenge.other_profile_id, p_mode: challenge.mode || 'weekly_h2h' }), () => setView('active')); };

  if (draftMode) {
    const accent = modeInfo[draftMode].accent, needsGame = draftMode === 'same_game';
    return <div className="min-h-screen bg-[#06101f] px-3 pb-14 pt-4 text-[#dce7f6] sm:px-6 sm:pt-6"><div className="mx-auto max-w-5xl"><ModeHeader mode={draftMode} onBack={() => { setDraftMode(null); setSelectedFriendId(null); setSelectedGamePk(null); setError(''); }} /><FlowStrip mode={draftMode} current={needsGame ? (selectedGame ? 1 : 0) : 0} /><section className="mt-3 rounded-2xl border border-[#29425e] bg-[#09172a] p-4 sm:p-5">{needsGame && <><div className="text-[10px] font-black uppercase tracking-[.14em]" style={{ color: accent }}>Step 1 · Choose a game</div><h2 className="mt-1 text-xl font-black text-white">Pick one upcoming matchup</h2><p className="mt-1 text-xs text-[#8fa0b5]">This exact game is included in the invitation.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{games.length ? games.map((game) => <GameButton key={game.gamePk} game={game} selected={selectedGamePk === game.gamePk} onClick={() => setSelectedGamePk(game.gamePk)} />) : <div className="text-xs text-[#8fa0b5]">No upcoming games were found right now.</div>}</div></>}{(!needsGame || selectedGame) && <div className={needsGame ? 'mt-6 border-t border-[#263b54] pt-5' : ''}><div className="text-[10px] font-black uppercase tracking-[.14em]" style={{ color: accent }}>{draftMode === 'team_up' ? 'Step 1 · Build your team' : needsGame ? 'Step 2 · Invite a friend' : 'Step 1 · Choose a friend'}</div><h2 className="mt-1 text-xl font-black text-white">{draftMode === 'team_up' ? 'Choose your teammate' : 'Choose your opponent'}</h2><p className="mt-1 text-xs text-[#8fa0b5]">Only mutual friends appear here.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{friends.length ? friends.map((friend) => <button type="button" key={friend.profile_id} onClick={() => setSelectedFriendId(friend.profile_id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${selectedFriendId === friend.profile_id ? 'bg-white/[.045]' : 'border-[#2b3e58] bg-[#0a1728]'}`} style={selectedFriendId === friend.profile_id ? { borderColor: accent } : undefined}><Avatar name={friend.display_name} url={friend.avatar_url} /><div className="min-w-0 flex-1"><div className="truncate font-black text-white">{friend.display_name}</div><div className="text-[10px] uppercase tracking-wide text-[#8fa0b5]">{friend.scout_level || 'Rookie Scout'}</div></div><span className="material-symbols-outlined" style={{ color: selectedFriendId === friend.profile_id ? accent : '#60748b' }}>{selectedFriendId === friend.profile_id ? 'check_circle' : 'person_add'}</span></button>) : <div className="text-xs text-[#8fa0b5]">You need a mutual friend before you can start.</div>}</div></div>}{error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">{error}</div>}<button type="button" disabled={!selectedFriend || (needsGame && !selectedGame) || busy === 'create'} onClick={() => void createDraft()} className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-black uppercase text-[#06101f] disabled:opacity-40" style={{ backgroundColor: accent }}>{busy === 'create' ? 'Sending…' : draftMode === 'team_up' ? 'Invite teammate' : needsGame ? 'Send game invitation' : 'Send weekly invitation'}</button></section></div></div>;
  }

  return <div className="min-h-screen bg-[#06101f] px-3 pb-14 pt-4 text-[#dce7f6] sm:px-6 sm:pt-6"><div className="mx-auto max-w-6xl"><header className="flex items-start gap-3 px-1"><button type="button" onClick={onBack} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2c435e] bg-[#0b182b]"><span className="material-symbols-outlined">arrow_back</span></button><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[.19em] text-[#65f2b5]">ScoutCore Social · Free</div><h1 className="mt-1 text-2xl font-black leading-none text-white sm:text-3xl">Friends Challenge</h1><p className="mt-2 text-xs text-[#9aa8ba]">Invite friends, make MLB predictions, and let ScoutCore save the result.</p></div></header><nav aria-label="Friends Challenge sections" className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-[#29425e] bg-[#091629]">{([['play', 'PLAY', 0], ['inbox', 'INVITES', incoming.length + incomingTeams.length], ['active', 'ACTIVE', active.length + activeTeams.length], ['history', 'HISTORY', 0]] as const).map(([id, label, count]) => <button type="button" key={id} onClick={() => { setView(id); setError(''); }} className={`relative py-3.5 text-[10px] font-black sm:text-xs ${view === id ? 'text-[#50eaf4]' : 'text-[#8e9aad]'}`}>{label}{count > 0 ? ` (${count})` : ''}{view === id && <span className="absolute bottom-0 left-[16%] right-[16%] h-[3px] rounded-full bg-[#50eaf4]" />}</button>)}</nav>{error && <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss">×</button></div>}{loading ? <div className="py-20 text-center text-sm text-[#8fa0b5]">Loading Friends Challenge…</div> : <div className="mt-4">{view === 'play' && <PlayModePicker onChoose={setDraftMode} />}{view === 'inbox' && <InboxView incoming={incoming} incomingTeams={incomingTeams} busy={busy} runAction={runAction} onAccepted={() => setView('active')} />}{view === 'active' && <ActiveView challenges={active} teamChallenges={activeTeams} friends={friends} games={games} busy={busy} runAction={runAction} onRefresh={load} />}{view === 'history' && <div className="space-y-4">{history.map((challenge) => challenge.status === 'completed' ? <OneVOneFinal key={challenge.challenge_id} challenge={challenge} onRematch={() => rematch(challenge)} /> : <section key={challenge.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#09172a] p-4"><div className="text-[10px] font-black uppercase text-[#718090]">{challenge.status}</div><h3 className="mt-1 font-black text-white">{challenge.other_display_name} · {challenge.mode ? modeInfo[challenge.mode].title : 'Friends Challenge'}</h3></section>)}{teamHistory.map((challenge) => challenge.status === 'completed' ? <TeamFinal key={challenge.team_challenge_id} challenge={challenge} /> : <section key={challenge.team_challenge_id} className="rounded-2xl border border-[#29425e] bg-[#09172a] p-4"><div className="text-[10px] font-black uppercase text-[#718090]">Cancelled Team Up</div><div className="mt-3"><TeamRoster members={challenge.members} /></div></section>)}{!history.length && !teamHistory.length && <Empty text="No finished Friends Challenges yet." />}</div>}</div>}</div></div>;
};

const PlayModePicker = ({ onChoose }: { onChoose: (mode: FriendsChallengeMode) => void }) => (
  <section className="rounded-2xl border border-[#29425e] bg-[#09172a] p-3 sm:p-5"><div className="px-1 pb-3"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">Choose how to play</div><h2 className="mt-1 text-xl font-black text-white">Three complete challenge modes</h2><p className="mt-1 text-xs text-[#8fa0b5]">All modes use friends only and never use tickets, money, betting, or prizes.</p></div><div className="grid gap-3 lg:grid-cols-3">{(Object.keys(modeInfo) as FriendsChallengeMode[]).map((mode) => { const info = modeInfo[mode]; return <button type="button" key={mode} onClick={() => onChoose(mode)} className="group rounded-2xl border bg-[#081628] p-4 text-left transition hover:-translate-y-0.5" style={{ borderColor: `${info.accent}70` }}><div className="flex items-center justify-between gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl border" style={{ borderColor: `${info.accent}70`, color: info.accent, backgroundColor: `${info.accent}12` }}><span className="material-symbols-outlined">{info.icon}</span></span><span className="rounded-md border px-2 py-1 text-[9px] font-black uppercase" style={{ borderColor: `${info.accent}70`, color: info.accent }}>{mode === 'team_up' ? '2 vs 2' : '1 vs 1'}</span></div><div className="mt-4 text-[10px] font-black uppercase tracking-[.13em]" style={{ color: info.accent }}>{info.eyebrow}</div><h3 className="mt-1 text-lg font-black uppercase text-white">{info.title}</h3><p className="mt-2 text-xs leading-5 text-[#96a5b8]">{info.description}</p><span className="mt-4 flex items-center justify-between text-[10px] font-black uppercase" style={{ color: info.accent }}>{mode === 'team_up' ? 'Build your team' : 'Start challenge'}<span className="material-symbols-outlined text-[18px]">arrow_forward</span></span></button>; })}</div></section>
);

const InboxView = ({ incoming, incomingTeams, busy, runAction, onAccepted }: { incoming: Challenge[]; incomingTeams: TeamChallenge[]; busy: string | null; runAction: ActionRunner; onAccepted: () => void }) => (
  <div className="space-y-3">{incoming.map((challenge) => <section key={challenge.challenge_id} className="rounded-2xl border border-[#29425e] bg-[#09172a] p-4"><div className="flex items-center gap-3"><Avatar name={challenge.other_display_name} url={challenge.other_avatar_url} /><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-wide text-[#65f2b5]">New 1 vs 1 invitation</div><h3 className="truncate font-black text-white">{challenge.other_display_name}</h3><p className="mt-1 text-xs text-[#8fa0b5]">{challenge.mode ? modeInfo[challenge.mode].title : 'Wants to choose a mode together'}</p></div></div>{challenge.mode === 'same_game' && challenge.shared_game && <div className="mt-3"><SharedGame game={challenge.shared_game} accent="#bd72ff" /></div>}<div className="mt-4 flex gap-2"><button type="button" disabled={busy === challenge.challenge_id} onClick={() => void runAction(challenge.challenge_id, () => supabase!.rpc('respond_friend_challenge', { p_challenge_id: challenge.challenge_id, p_response: 'accept' }), onAccepted)} className="rounded-xl bg-[#59e8f3] px-5 py-2.5 text-xs font-black text-[#07101f]">ACCEPT</button><button type="button" disabled={busy === challenge.challenge_id} onClick={() => void runAction(challenge.challenge_id, () => supabase!.rpc('respond_friend_challenge', { p_challenge_id: challenge.challenge_id, p_response: 'decline' }))} className="rounded-xl border border-[#3a4b63] px-5 py-2.5 text-xs font-black text-[#aebbd0]">DECLINE</button></div></section>)}{incomingTeams.map((challenge) => <section key={challenge.team_challenge_id} className="rounded-2xl border border-[#8bed68]/35 bg-[#09172a] p-4"><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8bed68]">Team Up invitation · 2 vs 2</div><h3 className="mt-1 text-lg font-black text-white">Join this challenge team?</h3><div className="mt-3"><TeamRoster members={challenge.members} /></div><div className="mt-4 flex gap-2"><button type="button" disabled={busy === challenge.team_challenge_id} onClick={() => void runAction(challenge.team_challenge_id, () => supabase!.rpc('respond_friend_team_challenge', { p_challenge_id: challenge.team_challenge_id, p_response: 'accept' }), onAccepted)} className="rounded-xl bg-[#8bed68] px-5 py-2.5 text-xs font-black text-[#07101f]">ACCEPT</button><button type="button" disabled={busy === challenge.team_challenge_id} onClick={() => void runAction(challenge.team_challenge_id, () => supabase!.rpc('respond_friend_team_challenge', { p_challenge_id: challenge.team_challenge_id, p_response: 'decline' }))} className="rounded-xl border border-[#3a4b63] px-5 py-2.5 text-xs font-black text-[#aebbd0]">DECLINE</button></div></section>)}{!incoming.length && !incomingTeams.length && <Empty text="No new challenge invitations." />}</div>
);

const ActiveView = ({ challenges, teamChallenges, friends, games, busy, runAction, onRefresh }: { challenges: Challenge[]; teamChallenges: TeamChallenge[]; friends: Friend[]; games: MlbScheduleGame[]; busy: string | null; runAction: ActionRunner; onRefresh: () => Promise<void> }) => (
  <div className="space-y-4">{challenges.map((challenge) => <OneVOneActiveCard key={challenge.challenge_id} challenge={challenge} games={games} busy={busy} runAction={runAction} onRefresh={onRefresh} />)}{teamChallenges.map((challenge) => <TeamActiveCard key={challenge.team_challenge_id} challenge={challenge} friends={friends} games={games} busy={busy} runAction={runAction} onRefresh={onRefresh} />)}{!challenges.length && !teamChallenges.length && <Empty text="No active Friends Challenges yet." />}</div>
);

const OneVOneActiveCard = ({ challenge, games, busy, runAction, onRefresh }: { challenge: Challenge; games: MlbScheduleGame[]; busy: string | null; runAction: ActionRunner; onRefresh: () => Promise<void> }) => {
  const mode = challenge.mode || 'weekly_h2h', current = challenge.status === 'pending' ? 1 : challenge.status === 'accepted' && mode === 'same_game' ? challenge.my_submitted && challenge.other_submitted ? 3 : 2 : challenge.status === 'accepted' ? 3 : 1;
  return <section className="rounded-2xl border border-[#29425e] bg-[#09172a] p-4 sm:p-5"><div className="flex items-center gap-3"><Avatar name={challenge.other_display_name} url={challenge.other_avatar_url} /><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[.14em]" style={{ color: modeInfo[mode].accent }}>{modeInfo[mode].eyebrow}</div><h3 className="truncate text-lg font-black text-white">You vs {challenge.other_display_name}</h3></div><span className="rounded-full border border-[#314861] px-3 py-1 text-[9px] font-black uppercase text-[#94a4b8]">{challenge.status}</span></div><FlowStrip mode={mode} current={current} />{challenge.status === 'pending' && <div className="mt-4 rounded-xl border border-[#2b3e58] bg-[#0a1728] p-4"><div className="text-xs font-black text-[#59e8f3]">INVITATION SENT</div><p className="mt-1 text-xs text-[#8fa0b5]">Waiting for {challenge.other_display_name} to accept.</p>{challenge.shared_game && <div className="mt-3"><SharedGame game={challenge.shared_game} accent={modeInfo[mode].accent} /></div>}</div>}{challenge.status === 'choosing' && <div className="mt-4"><h4 className="font-black text-white">Choose your preferred mode privately</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{(['weekly_h2h', 'same_game'] as FriendsChallengeMode[]).map((choice) => <button type="button" key={choice} onClick={() => void runAction(challenge.challenge_id, () => supabase!.rpc('set_friend_challenge_preference', { p_challenge_id: challenge.challenge_id, p_mode: choice }))} className="rounded-xl border border-[#344861] p-3 text-left text-xs font-black text-white">{modeInfo[choice].title}</button>)}</div></div>}{challenge.status === 'negotiating' && <div className="mt-4 rounded-xl border border-[#f6bf4f]/30 bg-[#f6bf4f]/5 p-4"><div className="font-black text-white">You chose different modes.</div><p className="mt-1 text-xs text-[#8fa0b5]">Choose again or let ScoutBot pick.</p><button type="button" onClick={() => void runAction(challenge.challenge_id, () => supabase!.rpc('randomize_friend_challenge_mode', { p_challenge_id: challenge.challenge_id }))} className="mt-3 rounded-lg bg-[#59e8f3] px-4 py-2 text-xs font-black text-[#07101f]">RANDOM MODE</button></div>}{challenge.status === 'accepted' && mode === 'weekly_h2h' && <WeeklyMatchup challenge={challenge} onRefresh={onRefresh} />}{challenge.status === 'accepted' && mode === 'same_game' && !challenge.shared_game && <div className="mt-4"><h4 className="font-black text-white">Choose the same MLB game</h4>{!challenge.my_game_choice ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{games.map((game) => <GameButton key={game.gamePk} game={game} onClick={() => void runAction(challenge.challenge_id, () => supabase!.rpc('choose_friend_challenge_game', { p_challenge_id: challenge.challenge_id, p_game: gamePayload(game) }))} />)}</div> : !challenge.other_game_choice ? <div className="mt-3 rounded-xl border border-[#2b3e58] bg-[#0a1728] p-4 text-xs text-[#8fa0b5]">Your choice: <b className="text-white">{gameLabel(challenge.my_game_choice)}</b><br />Waiting for {challenge.other_display_name}…</div> : <button type="button" onClick={() => void runAction(challenge.challenge_id, () => supabase!.rpc('randomize_friend_challenge_game', { p_challenge_id: challenge.challenge_id }))} className="mt-3 rounded-lg bg-[#59e8f3] px-3 py-2 text-xs font-black text-[#07101f]">RANDOM GAME</button>}</div>}{challenge.status === 'accepted' && mode === 'same_game' && challenge.shared_game && <div className="mt-4"><SharedGame game={challenge.shared_game} accent="#bd72ff" />{!challenge.my_submitted ? <PickBuilder game={challenge.shared_game} onSubmit={async (picks) => { await runAction(challenge.challenge_id, () => supabase!.rpc('submit_friend_challenge_picks', { p_challenge_id: challenge.challenge_id, p_picks: picks })); }} /> : !challenge.other_submitted ? <div className="mt-4 rounded-xl border border-[#bd72ff]/30 bg-[#bd72ff]/5 p-6 text-center"><span className="material-symbols-outlined text-4xl text-[#bd72ff]">lock</span><div className="mt-2 font-black text-white">Your picks are locked</div><p className="mt-1 text-xs text-[#8fa0b5]">Waiting for {challenge.other_display_name}. Your picks remain hidden.</p></div> : <><div className="mt-4 rounded-xl border border-[#bd72ff]/30 bg-[#bd72ff]/5 p-6 text-center"><span className="material-symbols-outlined text-4xl text-[#bd72ff]">lock</span><div className="mt-2 font-black text-white">Both players are locked</div><p className="mt-1 text-xs text-[#8fa0b5]">Nobody’s picks are revealed until the MLB game is final.</p></div><AutoSettlement kind="same" challengeId={challenge.challenge_id} game={challenge.shared_game} onSettled={onRefresh} /></>}</div>}{busy === challenge.challenge_id && <div className="mt-3 text-center text-[10px] font-black uppercase text-[#59e8f3]">Updating challenge…</div>}</section>;
};

const TeamActiveCard = ({ challenge, friends, games, busy, runAction, onRefresh }: { challenge: TeamChallenge; friends: Friend[]; games: MlbScheduleGame[]; busy: string | null; runAction: ActionRunner; onRefresh: () => Promise<void> }) => {
  const [opponents, setOpponents] = useState<string[]>([]);
  const phase = challenge.status === 'building_team' ? 0 : ['choosing_opponents', 'pending_opponents', 'choosing_game'].includes(challenge.status) ? 1 : challenge.status === 'picking' ? 2 : challenge.status === 'locked' ? 3 : 4;
  const canChooseOpponents = challenge.status === 'choosing_opponents' && challenge.my_team === 1 && challenge.my_role === 'captain', canChooseGame = challenge.status === 'choosing_game' && challenge.my_role === 'captain';
  const myMember = challenge.members.find((member) => member.team === challenge.my_team && member.role === challenge.my_role), candidates = friends.filter((friend) => !challenge.members.some((member) => member.profile_id === friend.profile_id));
  const toggleOpponent = (id: string) => setOpponents((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 2 ? [...current, id] : [current[1], id]);
  return <section className="rounded-2xl border border-[#8bed68]/35 bg-[#09172a] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-[#8bed68]">Mode 3 · 2 vs 2</div><h3 className="mt-1 text-lg font-black text-white">Team Up Challenge</h3></div><span className="rounded-full border border-[#8bed68]/35 bg-[#8bed68]/8 px-3 py-1 text-[9px] font-black uppercase text-[#8bed68]">{challenge.status.replaceAll('_', ' ')}</span></div><FlowStrip mode="team_up" current={phase} /><div className="mt-4"><TeamRoster members={challenge.members} /></div>{challenge.status === 'building_team' && <div className="mt-4 rounded-xl border border-[#2b4059] bg-[#0a1728] p-4 text-center"><div className="font-black text-white">Teammate invitation sent</div><p className="mt-1 text-xs text-[#8fa0b5]">The next step opens when your teammate accepts.</p></div>}{canChooseOpponents && <div className="mt-4 rounded-xl border border-[#8bed68]/30 bg-[#8bed68]/5 p-4"><div className="text-[10px] font-black uppercase tracking-[.13em] text-[#8bed68]">Step 2 · Choose opponents</div><h4 className="mt-1 font-black text-white">Select two friends who also follow each other</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{candidates.map((friend) => <button type="button" key={friend.profile_id} onClick={() => toggleOpponent(friend.profile_id)} className={`flex items-center gap-2 rounded-xl border p-3 text-left ${opponents.includes(friend.profile_id) ? 'border-[#8bed68] bg-[#8bed68]/10' : 'border-[#334862] bg-[#0a1728]'}`}><Avatar name={friend.display_name} url={friend.avatar_url} small /><span className="min-w-0 flex-1 truncate text-xs font-black text-white">{friend.display_name}</span><span className="material-symbols-outlined text-[18px] text-[#8bed68]">{opponents.includes(friend.profile_id) ? 'check_circle' : 'person_add'}</span></button>)}</div><button type="button" disabled={opponents.length !== 2 || busy === challenge.team_challenge_id} onClick={() => void runAction(challenge.team_challenge_id, () => supabase!.rpc('invite_friend_team_opponents', { p_challenge_id: challenge.team_challenge_id, p_opponent_captain_profile_id: opponents[0], p_opponent_teammate_profile_id: opponents[1] }))} className="mt-4 w-full rounded-xl bg-[#8bed68] px-4 py-3 text-xs font-black uppercase text-[#07101f] disabled:opacity-40">Invite opponent duo</button></div>}{challenge.status === 'pending_opponents' && <div className="mt-4 rounded-xl border border-[#f6bf4f]/30 bg-[#f6bf4f]/5 p-4 text-center"><div className="font-black text-[#f6bf4f]">Opponent invitations sent</div><p className="mt-1 text-xs text-[#8fa0b5]">Both players must accept before a captain chooses the game.</p></div>}{canChooseGame && <div className="mt-4"><div className="text-[10px] font-black uppercase tracking-[.13em] text-[#8bed68]">Both teams are ready</div><h4 className="mt-1 font-black text-white">Choose the shared MLB game</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{games.map((game) => <GameButton key={game.gamePk} game={game} onClick={() => void runAction(challenge.team_challenge_id, () => supabase!.rpc('choose_friend_team_challenge_game', { p_challenge_id: challenge.team_challenge_id, p_game: gamePayload(game) }))} />)}</div></div>}{challenge.status === 'picking' && challenge.game && <div className="mt-4"><SharedGame game={challenge.game} accent="#8bed68" />{!myMember?.submitted ? <PickBuilder game={challenge.game} teamMode onSubmit={async (picks) => { await runAction(challenge.team_challenge_id, () => supabase!.rpc('submit_friend_team_challenge_picks', { p_challenge_id: challenge.team_challenge_id, p_picks: picks })); }} /> : <div className="mt-4 rounded-xl border border-[#8bed68]/25 bg-[#8bed68]/5 p-5 text-center"><span className="material-symbols-outlined text-3xl text-[#8bed68]">lock</span><div className="mt-1 font-black text-white">Your five picks are locked</div><p className="mt-1 text-xs text-[#8fa0b5]">Waiting for every player. Teammates cannot copy each other.</p></div>}</div>}{challenge.status === 'locked' && challenge.game && <div className="mt-4"><div className="rounded-xl border border-[#8bed68]/30 bg-[#8bed68]/5 p-5 text-center"><span className="material-symbols-outlined text-4xl text-[#8bed68]">lock</span><div className="mt-1 text-lg font-black text-white">All four players are locked</div><p className="mt-1 text-xs text-[#8fa0b5]">Every pick stays private until ScoutCore verifies the final score.</p></div><AutoSettlement kind="team" challengeId={challenge.team_challenge_id} game={challenge.game} onSettled={onRefresh} /></div>}{busy === challenge.team_challenge_id && <div className="mt-3 text-center text-[10px] font-black uppercase text-[#8bed68]">Updating team challenge…</div>}</section>;
};
