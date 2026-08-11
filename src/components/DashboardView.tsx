import React, { useEffect, useMemo, useState } from 'react';
import { NavigationTab } from '../types';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchSchedule } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { LOGO_URL } from '../data/mockData';

interface DashboardViewProps { onSelectTab: (tab: NavigationTab) => void; onSelectMatchup: (matchup: any) => void; }
interface DailyReport { generatedAt: string | null; report: { headline?: string; summary?: string; signals?: { team?: string; player?: string; score?: number; confidence?: number; reason?: string }[]; watchList?: string[]; } | null; }

const formatGameTime = (gameDate: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(gameDate));
const gameLabel = (game: MlbScheduleGame) => game.detailedState === 'Final' ? 'FINAL' : game.status === 'Live' ? 'LIVE' : formatGameTime(game.gameDate);

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab, onSelectMatchup }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [briefInfoOpen, setBriefInfoOpen] = useState(false);

  const openGameMatchup = (game: MlbScheduleGame) => {
    const selection = {
      gamePk: game.gamePk,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      awayProbablePitcher: game.awayProbablePitcher,
      homeProbablePitcher: game.homeProbablePitcher,
    };
    onSelectMatchup(selection);
    try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {}
    setReportOpen(false);
    onSelectTab('matchups');
  };

  const loadGames = async () => {
    try {
      setError(null);
      setGames(await fetchSchedule());
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load MLB games.');
    } finally { setLoading(false); }
  };

  const loadDailyReport = async () => { try { const response = await fetch(`/data/daily-intelligence.json?ts=${Date.now()}`); if (response.ok) setDailyReport(await response.json()); } catch {} };
  useEffect(() => { loadGames(); loadDailyReport(); const timer = window.setInterval(() => { loadGames(); loadDailyReport(); }, 5 * 60 * 1000); return () => window.clearInterval(timer); }, []);

  const liveCount = useMemo(() => games.filter((game) => game.status === 'Live').length, [games]);
  const finalCount = useMemo(() => games.filter((game) => game.detailedState === 'Final').length, [games]);
  const probableCount = useMemo(() => games.reduce((n, g) => n + (g.awayProbablePitcher?.id ? 1 : 0) + (g.homeProbablePitcher?.id ? 1 : 0), 0), [games]);
  const report = dailyReport?.report;
  const featuredGames = useMemo(() => games.slice(0, 4), [games]);
  const pitcherWatch = useMemo(() => games.flatMap(g => [
    g.awayProbablePitcher ? { ...g.awayProbablePitcher, team: g.awayTeam.name, opponent: g.homeTeam.name } : null,
    g.homeProbablePitcher ? { ...g.homeProbablePitcher, team: g.homeTeam.name, opponent: g.awayTeam.name } : null,
  ]).filter(Boolean).slice(0, 6) as { id: number; name: string; team: string; opponent: string }[], [games]);

  const autoHeadline = liveCount ? `${liveCount} MLB game${liveCount === 1 ? '' : 's'} live now` : finalCount === games.length && games.length ? 'Today’s MLB slate is complete' : `${games.length} MLB games on today’s slate`;
  const autoSummary = games.length
    ? `${probableCount} probable starters are currently posted. ScoutCore refreshes this briefing automatically as MLB updates the schedule, starters and game status.`
    : 'ScoutCore is checking MLB data for today’s schedule and probable starters.';

  return <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
    <section className="relative px-8 py-8 overflow-hidden border-b border-[#3b494b]/10">
      <div className="absolute inset-0 bg-gradient-to-r from-[#060e20] via-[#0b1326] to-transparent" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl flex gap-5 items-start"><div className="hidden sm:flex w-20 h-20 rounded-2xl bg-[#131b2e] border border-[#00f0ff]/25 items-center justify-center p-3"><img src={LOGO_URL} alt="ScoutCore logo" className="max-w-full max-h-full object-contain" /></div><div><div className="flex items-center gap-3 mb-3"><span className="px-2.5 py-1 bg-[#d8ffe7]/10 border border-[#d8ffe7]/20 text-[#65f2b5] rounded-full text-[10px]">LIVE GAME ENGINE</span><span className="text-[#849495] text-[10px]">{lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'UPDATING'}</span></div><h1 className="font-display-lg text-[44px] text-[#dbfcff] mb-2 leading-none">Gameday <span className="text-[#b9cacb] font-light italic">Intelligence</span></h1><p className="text-sm text-[#b9cacb]">ScoutCore is connected directly to MLB data. {games.length} games are scheduled today{liveCount ? `, with ${liveCount} live` : ''}.</p></div></div>
        <div className="flex gap-4"><Metric label="TODAY'S GAMES" value={loading ? '—' : games.length}/><Metric label="LIVE NOW" value={loading ? '—' : liveCount} accent/></div>
      </div>
    </section>

    <div className="p-8 space-y-8">
      <section className="bg-[#131b2e] rounded-2xl border border-[#00f0ff]/20 overflow-visible shadow-[0_0_30px_rgba(0,240,255,.04)]">
        <div className="px-6 py-4 border-b border-[#3b494b]/20 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3"><img src={LOGO_URL} alt="ScoutCore" className="w-10 h-10 object-contain"/><div><div className="flex items-center gap-2"><h2 className="font-bold text-lg">Daily ScoutCore Intelligence</h2><div className="relative"><button type="button" aria-label="What is Daily ScoutCore Intelligence?" aria-expanded={briefInfoOpen} onClick={() => setBriefInfoOpen(v => !v)} className="w-5 h-5 rounded-full border border-[#00f0ff]/45 text-[#00f0ff] text-[12px] font-bold leading-none flex items-center justify-center hover:bg-[#00f0ff]/10">i</button>{briefInfoOpen && <div className="absolute left-0 top-7 z-30 w-[310px] rounded-xl border border-[#00f0ff]/25 bg-[#0d172b] p-4 shadow-2xl"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-[#dbfcff]">What is this?</p><button onClick={() => setBriefInfoOpen(false)} className="text-[#8f9dac] hover:text-white text-base leading-none">×</button></div><p className="mt-2 text-xs leading-5 text-[#b9cacb]">A quick daily overview of what matters across MLB. It automatically follows today’s games, probable starters and game status so you can scan the slate before opening the deeper ScoutCore pages.</p><p className="mt-2 text-[11px] leading-4 text-[#65f2b5]">Use View Daily Report for the expanded briefing.</p></div>}</div></div><p className="text-[11px] text-[#9ba9b7]">AUTOMATIC MLB MORNING + GAMEDAY BRIEFING</p></div></div>
          <div className="flex items-center gap-3"><span className="text-[11px] text-[#65f2b5]">● AUTO-UPDATING</span><button onClick={() => setReportOpen(true)} className="px-4 py-2 rounded-lg border border-[#00f0ff]/35 text-[#00f0ff] text-xs font-bold hover:bg-[#00f0ff]/10">VIEW DAILY REPORT</button></div>
        </div>
        <div className="p-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-5"><div><span className="font-label-caps text-[10px] text-[#65f2b5]">TODAY’S BRIEFING</span><h3 className="text-2xl font-bold mt-1">{report?.headline || autoHeadline}</h3><p className="text-sm text-[#b9cacb] mt-2 max-w-3xl">{report?.summary || autoSummary}</p></div><div className="grid grid-cols-3 gap-2 min-w-[320px]"><BriefStat label="GAMES" value={games.length}/><BriefStat label="STARTERS" value={probableCount}/><BriefStat label="FINAL" value={finalCount}/></div></div>

          {report?.signals?.length ? <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{report.signals.slice(0,6).map((s,i)=><div key={i} className="rounded-xl bg-[#171f33] border border-[#3b494b]/15 p-4"><div className="flex justify-between"><span className="text-[#00f0ff] text-xs font-bold">{s.player || s.team || 'ScoutCore signal'}</span><span className="text-[#65f2b5] text-xs">{s.score ?? '—'}</span></div><p className="text-xs text-[#b9cacb] mt-2 leading-5">{s.reason}</p></div>)}</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{featuredGames.map(game => <BriefGame key={game.gamePk} game={game} onClick={() => openGameMatchup(game)} />)}{!featuredGames.length && <div className="col-span-full rounded-xl bg-[#171f33] p-5 text-sm text-[#9ba9b7]">Today’s game cards will appear here as soon as MLB schedule data is available.</div>}</div>}

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs"><button onClick={() => onSelectTab('matchups')} className="text-[#00f0ff] hover:underline">OPEN MATCHUPS + GAME LOGS →</button><span className="text-[#596879]">•</span><button onClick={() => onSelectTab('matchups')} className="text-[#b9cacb] hover:text-white">Injury watch is available in Matchups + Game Logs</button></div>
        </div>
      </section>

      <div><div className="flex items-center justify-between mb-5"><h2 className="font-headline-lg text-[22px] font-bold">Today's MLB Games</h2><button onClick={loadGames} className="text-xs text-[#00f0ff]">REFRESH</button></div>{error && <div className="mb-5 p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}{loading ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">Loading today's MLB schedule…</div> : games.length === 0 ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">No MLB games are scheduled today.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{games.map(game => <button key={game.gamePk} onClick={() => openGameMatchup(game)} className="text-left bg-[#131b2e] rounded-xl overflow-hidden border border-[#3b494b]/20 hover:border-[#00f0ff]/40"><div className="px-4 py-3 bg-[#222a3d]/50 flex justify-between"><span className="text-[10px] text-[#00f0ff]">{gameLabel(game)}</span><span className="text-[10px] text-[#849495]">GAME {game.gamePk}</span></div><div className="p-5 space-y-4"><TeamRow team={game.awayTeam} score={game.awayScore}/><div className="h-px bg-[#3b494b]/30"/><TeamRow team={game.homeTeam} score={game.homeScore}/><div className="pt-3 border-t border-[#3b494b]/20"><p className="text-[9px] text-[#849495] mb-2">PROBABLE PITCHERS</p><div className="grid grid-cols-2 gap-2"><PitcherMini pitcher={game.awayProbablePitcher}/><PitcherMini pitcher={game.homeProbablePitcher}/></div></div></div></button>)}</div>}</div>
    </div>

    {reportOpen && <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setReportOpen(false)}><div className="w-full max-w-5xl max-h-[88vh] overflow-y-auto bg-[#131b2e] border border-[#00f0ff]/30 rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}><div className="sticky top-0 z-10 bg-[#131b2e] px-6 py-5 border-b border-[#3b494b]/20 flex justify-between gap-4"><div><span className="font-label-caps text-[10px] text-[#65f2b5]">DAILY SCOUTCORE INTELLIGENCE</span><h2 className="text-3xl font-bold mt-1">{report?.headline || autoHeadline}</h2><p className="text-sm text-[#9ba9b7] mt-1">Automatically refreshed from MLB data.</p></div><button onClick={() => setReportOpen(false)} className="w-9 h-9 rounded-full bg-[#0b1326] text-xl">×</button></div><div className="p-6 space-y-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><BriefStat label="TODAY’S GAMES" value={games.length}/><BriefStat label="LIVE" value={liveCount}/><BriefStat label="FINAL" value={finalCount}/><BriefStat label="PROBABLE STARTERS" value={probableCount}/></div><section><p className="font-label-caps text-xs text-[#9ba9b7] mb-3">TODAY’S SCHEDULE WATCH</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{games.slice(0,8).map(game => <BriefGame key={game.gamePk} game={game} onClick={() => openGameMatchup(game)} />)}</div></section><section><p className="font-label-caps text-xs text-[#9ba9b7] mb-3">PROBABLE PITCHER WATCH</p><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{pitcherWatch.map(p => <div key={`${p.id}-${p.team}`} className="bg-[#171f33] rounded-xl p-3 flex items-center gap-3"><div className="w-14 h-14 shrink-0 overflow-hidden flex items-end justify-center"><img src={mlbPlayerHeadshotUrl(p.id,140)} alt={p.name} className="w-full h-full object-contain" /></div><div className="min-w-0"><p className="font-bold text-sm truncate">{p.name}</p><p className="text-xs text-[#9ba9b7] truncate">{p.team}</p><p className="text-[11px] text-[#00f0ff] truncate">vs {p.opponent}</p></div></div>)}</div></section><section className="bg-[#101a30] rounded-xl p-5"><p className="font-label-caps text-xs text-[#65f2b5]">INJURY WATCH</p><p className="text-sm text-[#b9cacb] mt-2">For current injured-list status, open Matchups + Game Logs. ScoutCore keeps injury information there so the daily briefing stays compact.</p><button onClick={() => { setReportOpen(false); onSelectTab('matchups'); }} className="text-xs text-[#00f0ff] mt-3">OPEN INJURED LIST →</button></section></div></div></div>}
  </div>;
};

const Metric = ({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) => <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 min-w-[180px]"><span className="text-[#849495] block mb-2 text-[10px]">{label}</span><span className={`text-[32px] ${accent ? 'text-[#65f2b5]' : 'text-[#dbfcff]'}`}>{value}</span></div>;
const BriefStat = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#101a30] rounded-lg px-3 py-3 border border-[#3b494b]/15"><p className="text-[10px] text-[#8f9dac]">{label}</p><p className="font-data-numeric text-2xl text-[#dbfcff] mt-1">{value}</p></div>;
const BriefGame = ({ game, onClick }: { game: MlbScheduleGame; onClick: () => void }) => <button onClick={onClick} className="text-left bg-[#171f33] rounded-xl border border-[#3b494b]/15 p-4 hover:border-[#00f0ff]/50"><div className="flex items-center justify-between gap-2 mb-3"><span className={`text-[10px] font-bold ${game.status === 'Live' ? 'text-[#ff6b76]' : game.detailedState === 'Final' ? 'text-[#00f0ff]' : 'text-[#9ba9b7]'}`}>{gameLabel(game)}</span><span className="text-[10px] text-[#8f9dac]">VIEW MATCHUP →</span></div><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><img src={mlbTeamLogoUrl(game.awayTeam.id)} alt="" className="w-8 h-8 object-contain"/><span className="font-bold text-sm truncate">{game.awayTeam.abbreviation ?? game.awayTeam.name}</span></div><span className="text-[#596879]">vs</span><div className="flex items-center gap-2 min-w-0"><span className="font-bold text-sm truncate">{game.homeTeam.abbreviation ?? game.homeTeam.name}</span><img src={mlbTeamLogoUrl(game.homeTeam.id)} alt="" className="w-8 h-8 object-contain"/></div></div><p className="text-[11px] text-[#9ba9b7] mt-3 truncate">{game.awayProbablePitcher?.name ?? 'TBD'} vs {game.homeProbablePitcher?.name ?? 'TBD'}</p></button>;
const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-white/95 p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="w-full h-full object-contain"/></div><div className="flex-1"><p className="text-xs font-bold">{team.abbreviation ?? team.name}</p><p className="text-[11px] text-[#849495]">{team.name}</p></div><span className="text-xl">{score ?? '—'}</span></div>;
const PitcherMini = ({ pitcher }: { pitcher?: { id: number; name: string } }) => <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-[#222a3d] overflow-hidden border border-[#3b494b]/25">{pitcher?.id && <img src={mlbPlayerHeadshotUrl(pitcher.id,96)} alt={pitcher.name} className="w-full h-full object-cover object-top"/>}</div><span className="text-[10px] text-[#00f0ff] truncate">{pitcher?.name ?? 'TBD'}</span></div>;
