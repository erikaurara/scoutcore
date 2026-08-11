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

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);

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
  const report = dailyReport?.report;

  return <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
    <section className="relative px-8 py-8 overflow-hidden border-b border-[#3b494b]/10">
      <div className="absolute inset-0 bg-gradient-to-r from-[#060e20] via-[#0b1326] to-transparent" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl flex gap-5 items-start"><div className="hidden sm:flex w-20 h-20 rounded-2xl bg-[#131b2e] border border-[#00f0ff]/25 items-center justify-center p-3"><img src={LOGO_URL} alt="ScoutCore logo" className="max-w-full max-h-full object-contain" /></div><div><div className="flex items-center gap-3 mb-3"><span className="px-2.5 py-1 bg-[#d8ffe7]/10 border border-[#d8ffe7]/20 text-[#65f2b5] rounded-full text-[10px]">LIVE GAME ENGINE</span><span className="text-[#849495] text-[10px]">{lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'UPDATING'}</span></div><h1 className="font-display-lg text-[44px] text-[#dbfcff] mb-2 leading-none">Gameday <span className="text-[#b9cacb] font-light italic">Intelligence</span></h1><p className="text-sm text-[#b9cacb]">ScoutCore is connected directly to MLB data. {games.length} games are scheduled today{liveCount ? `, with ${liveCount} live` : ''}.</p></div></div>
        <div className="flex gap-4"><Metric label="TODAY'S GAMES" value={loading ? '—' : games.length}/><Metric label="LIVE NOW" value={loading ? '—' : liveCount} accent/></div>
      </div>
    </section>

    <div className="p-8 space-y-8">
      <section className="bg-[#131b2e] rounded-2xl border border-[#00f0ff]/20 overflow-hidden"><div className="px-6 py-4 border-b border-[#3b494b]/20 flex items-center justify-between"><div className="flex items-center gap-3"><img src={LOGO_URL} alt="ScoutCore" className="w-9 h-9 object-contain"/><div><h2 className="font-bold">Daily ScoutCore Intelligence</h2><p className="text-[10px] text-[#849495]">VERIFIED MLB DATA · NO PAID AI REQUIRED</p></div></div><span className="text-[10px] text-[#849495]">{dailyReport?.generatedAt ? `GENERATED ${new Date(dailyReport.generatedAt).toLocaleString()}` : 'WAITING FOR DAILY REPORT'}</span></div><div className="p-6">{!report ? <div className="text-sm text-[#849495]">The automated daily report will appear here after the workflow runs.</div> : <><h3 className="text-xl font-bold mb-2">{report.headline || 'Today’s scouting signals'}</h3><p className="text-sm text-[#b9cacb] mb-5">{report.summary}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-3">{(report.signals ?? []).slice(0,6).map((s,i)=><div key={i} className="rounded-xl bg-[#171f33] p-4"><div className="flex justify-between"><span className="text-[#00f0ff] text-xs">{s.player || 'Player'}</span><span className="text-[#65f2b5] text-xs">{s.score ?? '—'}</span></div><p className="text-xs text-[#b9cacb] mt-2">{s.reason}</p></div>)}</div></>}</div></section>

      <div><div className="flex items-center justify-between mb-5"><h2 className="font-headline-lg text-[22px] font-bold">Today's MLB Games</h2><button onClick={loadGames} className="text-xs text-[#00f0ff]">REFRESH</button></div>{error && <div className="mb-5 p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}{loading ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">Loading today's MLB schedule…</div> : games.length === 0 ? <div className="bg-[#171f33] rounded-xl p-8 text-center text-[#849495]">No MLB games are scheduled today.</div> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{games.map(game => <button key={game.gamePk} onClick={() => onSelectTab('matchups')} className="text-left bg-[#131b2e] rounded-xl overflow-hidden border border-[#3b494b]/20 hover:border-[#00f0ff]/40"><div className="px-4 py-3 bg-[#222a3d]/50 flex justify-between"><span className="text-[10px] text-[#00f0ff]">{gameLabel(game)}</span><span className="text-[10px] text-[#849495]">GAME {game.gamePk}</span></div><div className="p-5 space-y-4"><TeamRow team={game.awayTeam} score={game.awayScore}/><div className="h-px bg-[#3b494b]/30"/><TeamRow team={game.homeTeam} score={game.homeScore}/><div className="pt-3 border-t border-[#3b494b]/20"><p className="text-[9px] text-[#849495] mb-2">PROBABLE PITCHERS</p><div className="grid grid-cols-2 gap-2"><PitcherMini pitcher={game.awayProbablePitcher}/><PitcherMini pitcher={game.homeProbablePitcher}/></div></div></div></button>)}</div>}</div>
    </div>
  </div>;
};

const Metric = ({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) => <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 min-w-[180px]"><span className="text-[#849495] block mb-2 text-[10px]">{label}</span><span className={`text-[32px] ${accent ? 'text-[#65f2b5]' : 'text-[#dbfcff]'}`}>{value}</span></div>;
const TeamRow = ({ team, score }: { team: MlbScheduleGame['awayTeam']; score?: number }) => <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-white/95 p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt={`${team.name} logo`} className="w-full h-full object-contain"/></div><div className="flex-1"><p className="text-xs font-bold">{team.abbreviation ?? team.name}</p><p className="text-[11px] text-[#849495]">{team.name}</p></div><span className="text-xl">{score ?? '—'}</span></div>;
const PitcherMini = ({ pitcher }: { pitcher?: { id: number; name: string } }) => <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg bg-[#222a3d] overflow-hidden border border-[#3b494b]/25">{pitcher?.id && <img src={mlbPlayerHeadshotUrl(pitcher.id,96)} alt={pitcher.name} className="w-full h-full object-cover object-top"/>}</div><span className="text-[10px] text-[#00f0ff] truncate">{pitcher?.name ?? 'TBD'}</span></div>;
