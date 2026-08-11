import React, { useEffect, useMemo, useState } from 'react';
import { NavigationTab } from '../types';
import type { MlbScheduleGame } from '../services/mlbApi';

interface DashboardViewProps {
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMatchup: (matchup: any) => void;
}

interface DailyReport {
  generatedAt: string | null;
  report: {
    headline?: string;
    summary?: string;
    signals?: { team?: string; player?: string; score?: number; confidence?: number; reason?: string }[];
    watchList?: string[];
    caveats?: string[];
  } | null;
}

const formatGameTime = (gameDate: string) => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(gameDate));

const gameLabel = (game: MlbScheduleGame) => {
  if (game.detailedState === 'Final') return 'FINAL';
  if (game.status === 'Live') return 'LIVE';
  return formatGameTime(game.gameDate);
};

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectTab }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);

  const loadGames = async () => {
    try {
      setError(null);
      const response = await fetch('/api/games/today');
      if (!response.ok) throw new Error('Unable to load today\'s MLB schedule.');
      const data = await response.json();
      setGames(data.games ?? []);
      setLastUpdated(new Date(data.updatedAt ?? Date.now()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load MLB games.');
    } finally {
      setLoading(false);
    }
  };

  const loadDailyReport = async () => {
    try {
      const response = await fetch(`/data/daily-intelligence.json?ts=${Date.now()}`);
      if (!response.ok) return;
      const data = await response.json();
      setDailyReport(data);
    } catch {
      // The dashboard still works when no AI report has been generated yet.
    }
  };

  useEffect(() => {
    loadGames();
    loadDailyReport();
    const timer = window.setInterval(() => {
      loadGames();
      loadDailyReport();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const liveCount = useMemo(() => games.filter((game) => game.status === 'Live').length, [games]);
  const report = dailyReport?.report;

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <section className="relative px-8 py-8 overflow-hidden border-b border-[#3b494b]/10">
        <div className="absolute inset-0 bg-gradient-to-r from-[#060e20] via-[#0b1326] to-transparent z-0 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-[#d8ffe7]/10 border border-[#d8ffe7]/20 text-[#65f2b5] rounded-full font-label-caps text-[10px] tracking-widest animate-pulse">LIVE GAME ENGINE</span>
              <span className="text-[#849495] font-label-caps text-[10px]">
                {lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'UPDATING'}
              </span>
            </div>
            <h1 className="font-display-lg text-[44px] text-[#dbfcff] mb-2 leading-none">Gameday <span className="text-[#b9cacb] font-light italic">Intelligence</span></h1>
            <p className="text-sm text-[#b9cacb] max-w-xl leading-relaxed">
              ScoutCore is connected to the live MLB schedule. {games.length} games are scheduled today{liveCount > 0 ? `, with ${liveCount} currently live` : ''}.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 shadow-xl min-w-[180px]">
              <span className="font-label-caps text-[#849495] block mb-2 text-[10px]">TODAY'S GAMES</span>
              <span className="font-data-numeric text-[32px] text-[#dbfcff] leading-none">{loading ? '—' : games.length}</span>
            </div>
            <div className="bg-[#171f33] p-4 rounded-xl border border-[#3b494b]/20 shadow-xl min-w-[180px]">
              <span className="font-label-caps text-[#849495] block mb-2 text-[10px]">LIVE NOW</span>
              <span className="font-data-numeric text-[32px] text-[#65f2b5] leading-none">{loading ? '—' : liveCount}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="p-8 space-y-8">
        <section className="bg-[#131b2e] rounded-2xl border border-[#00f0ff]/20 overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-[#3b494b]/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#00f0ff]">auto_awesome</span>
              <div>
                <h2 className="font-headline-lg text-[18px] text-[#dae2fd] uppercase tracking-tight font-bold">Daily AI Intelligence</h2>
                <p className="text-[10px] text-[#849495] font-label-caps mt-1">VERIFIED MLB DATA · EXPLAINABLE SIGNALS</p>
              </div>
            </div>
            <span className="text-[10px] text-[#849495] font-label-caps">
              {dailyReport?.generatedAt ? `GENERATED ${new Date(dailyReport.generatedAt).toLocaleString()}` : 'WAITING FOR DAILY REPORT'}
            </span>
          </div>
          <div className="p-6">
            {!report ? (
              <div className="text-sm text-[#849495]">The first automated report will appear here after the daily intelligence workflow runs successfully.</div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-[#dbfcff] mb-2">{report.headline || 'Today\'s scouting signals'}</h3>
                <p className="text-sm text-[#b9cacb] leading-relaxed mb-5">{report.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(report.signals ?? []).slice(0, 6).map((signal, index) => (
                    <div key={`${signal.player ?? 'signal'}-${index}`} className="rounded-xl bg-[#171f33] border border-[#3b494b]/20 p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-label-caps text-xs text-[#00f0ff]">{signal.player || 'Unknown player'}</span>
                        <span className="font-data-numeric text-xs text-[#65f2b5]">{signal.score ?? '—'}</span>
                      </div>
                      <p className="text-xs text-[#b9cacb] leading-relaxed">{signal.reason || 'No explanation supplied.'}</p>
                      <div className="mt-3 text-[9px] text-[#849495] font-label-caps">{signal.team || 'TEAM UNKNOWN'} · CONFIDENCE {signal.confidence ?? '—'}</div>
                    </div>
                  ))}
                </div>
                {(report.watchList?.length ?? 0) > 0 && (
                  <div className="mt-5 pt-5 border-t border-[#3b494b]/20">
                    <span className="font-label-caps text-[10px] text-[#849495]">WATCH LIST</span>
                    <div className="mt-2 flex flex-wrap gap-2">{report.watchList!.map((item, index) => <span key={index} className="px-3 py-1.5 rounded-full bg-[#222a3d] text-xs text-[#dae2fd]">{item}</span>)}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00f0ff]">sports_baseball</span>
              <h2 className="font-headline-lg text-[22px] text-[#dae2fd] uppercase tracking-tight font-bold">Today's MLB Games</h2>
            </div>
            <button onClick={loadGames} className="font-label-caps text-xs text-[#00f0ff] hover:underline">REFRESH</button>
          </div>

          {error && <div className="mb-5 p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}
          {loading ? (
            <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-8 text-center text-[#849495]">Loading today's MLB schedule…</div>
          ) : games.length === 0 ? (
            <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-8 text-center text-[#849495]">No MLB games are scheduled today.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {games.map((game) => (
                <button key={game.gamePk} onClick={() => onSelectTab('matchups')} className="text-left bg-[#131b2e] rounded-xl overflow-hidden border border-[#3b494b]/20 hover:border-[#00f0ff]/40 hover:shadow-2xl hover:shadow-[#00f0ff]/10 transition-all">
                  <div className="px-4 py-3 bg-[#222a3d]/50 border-b border-[#3b494b]/20 flex items-center justify-between">
                    <span className={`font-label-caps text-[10px] font-bold ${game.status === 'Live' ? 'text-[#65f2b5]' : 'text-[#849495]'}`}>{gameLabel(game)}</span>
                    <span className="font-label-caps text-[10px] text-[#849495]">GAME {game.gamePk}</span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1"><p className="font-label-caps text-xs text-[#dae2fd] font-bold">{game.awayTeam.abbreviation ?? game.awayTeam.name}</p><p className="text-[11px] text-[#849495] mt-1 truncate">{game.awayTeam.name}</p></div>
                      <span className="font-data-numeric text-xl text-[#dbfcff]">{game.awayScore ?? '—'}</span>
                    </div>
                    <div className="h-px bg-[#3b494b]/30" />
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1"><p className="font-label-caps text-xs text-[#dae2fd] font-bold">{game.homeTeam.abbreviation ?? game.homeTeam.name}</p><p className="text-[11px] text-[#849495] mt-1 truncate">{game.homeTeam.name}</p></div>
                      <span className="font-data-numeric text-xl text-[#dbfcff]">{game.homeScore ?? '—'}</span>
                    </div>
                    <div className="pt-2 border-t border-[#3b494b]/20 space-y-1">
                      <p className="font-label-caps text-[9px] text-[#849495]">PROBABLE PITCHERS</p>
                      <p className="text-xs text-[#00f0ff]">{game.awayProbablePitcher?.name ?? 'TBD'} <span className="text-[#849495]">vs</span> {game.homeProbablePitcher?.name ?? 'TBD'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
