import React, { useEffect, useMemo, useState } from 'react';
import type { NavigationTab } from '../types';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchSchedule } from '../services/mlbClient';
import { mlbTeamLogoUrl } from '../services/mlbMedia';
import { DashboardView } from './DashboardView';

interface DashboardWithLiveNowProps {
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMatchup: (matchup: any) => void;
}

const toSelection = (game: MlbScheduleGame) => ({
  gamePk: game.gamePk,
  gameDate: game.gameDate,
  status: game.status,
  detailedState: game.detailedState,
  awayScore: game.awayScore,
  homeScore: game.homeScore,
  awayTeam: game.awayTeam,
  homeTeam: game.homeTeam,
  awayProbablePitcher: game.awayProbablePitcher,
  homeProbablePitcher: game.homeProbablePitcher,
});

export const DashboardWithLiveNow: React.FC<DashboardWithLiveNowProps> = ({ onSelectTab, onSelectMatchup }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);

  const load = async () => {
    try {
      setGames(await fetchSchedule());
    } catch {
      // The main Dashboard has its own schedule error state, so this compact strip stays quiet.
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const liveGames = useMemo(() => games.filter(game => game.status === 'Live'), [games]);

  const openLiveGame = (game: MlbScheduleGame) => {
    const selection = toSelection(game);
    onSelectMatchup(selection);
    try { window.sessionStorage.setItem('scoutcore:selected-game', JSON.stringify(selection)); } catch {}
    onSelectTab('live-game');
  };

  return <>
    <section className="hidden md:block bg-[#08111f] border-b border-[#25354b] px-3 sm:px-5 lg:px-8 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            {liveGames.length > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6274] opacity-60" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${liveGames.length > 0 ? 'bg-[#ff6274]' : 'bg-[#58677a]'}`} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold tracking-wide text-[#eaf7ff]">LIVE NOW</h2>
            <p className="text-[10px] sm:text-xs text-[#849495] truncate">Live MLB games · tap a game to open IXMetrics Gameday</p>
          </div>
        </div>
        <button onClick={load} className="text-[10px] sm:text-xs font-bold text-[#00e6f4] hover:text-white shrink-0">REFRESH</button>
      </div>

      {liveGames.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {liveGames.map(game => (
            <button key={game.gamePk} onClick={() => openLiveGame(game)} className="w-full min-w-0 rounded-xl border border-[#ff6274]/30 bg-[#111b2d] hover:border-[#ff6274]/65 p-3 sm:p-4 text-left transition-colors">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6274]/10 border border-[#ff6274]/25 px-2 py-1 text-[10px] font-bold text-[#ff8090]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff6274] animate-pulse" /> LIVE
                </span>
                <span className="text-[10px] font-bold text-[#00e6f4]">OPEN GAMEDAY →</span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex items-center gap-2">
                  <img src={mlbTeamLogoUrl(game.awayTeam.id)} alt="" className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-sm sm:text-base truncate">{game.awayTeam.abbreviation ?? game.awayTeam.name}</div>
                    <div className="text-[10px] text-[#849495] truncate">{game.awayTeam.name}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 px-1">
                  <span className="font-mono text-2xl sm:text-3xl text-[#eaf7ff]">{game.awayScore ?? 0}</span>
                  <span className="text-[#58677a] text-xs">—</span>
                  <span className="font-mono text-2xl sm:text-3xl text-[#eaf7ff]">{game.homeScore ?? 0}</span>
                </div>

                <div className="min-w-0 flex items-center justify-end gap-2 text-right">
                  <div className="min-w-0">
                    <div className="font-bold text-sm sm:text-base truncate">{game.homeTeam.abbreviation ?? game.homeTeam.name}</div>
                    <div className="text-[10px] text-[#849495] truncate">{game.homeTeam.name}</div>
                  </div>
                  <img src={mlbTeamLogoUrl(game.homeTeam.id)} alt="" className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0" />
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[#26364e] bg-[#0d1727] px-4 py-3 text-xs text-[#849495]">
          No MLB games are live right now. This section will automatically fill when a game starts.
        </div>
      )}
    </section>

    <DashboardView onSelectTab={onSelectTab} onSelectMatchup={onSelectMatchup} />
  </>;
};
