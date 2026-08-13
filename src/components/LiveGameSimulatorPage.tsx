import React, { useEffect, useMemo, useState } from 'react';
import { fetchLiveGameFeed } from '../services/mlbClient';
import { LiveGameExperienceV4 } from './LiveGameExperienceV4';

type GameSelection = {
  gamePk?: number;
  gameDate?: string;
  status?: string;
  detailedState?: string;
  awayTeam?: { id: number; name: string; abbreviation?: string };
  homeTeam?: { id: number; name: string; abbreviation?: string };
};

type LiveGameSimulatorPageProps = {
  selectedGame?: GameSelection | null;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
  onBack: () => void;
};

const readStoredGame = (): GameSelection | null => {
  try {
    const raw = window.sessionStorage.getItem('scoutcore:selected-game');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const LiveGameSimulatorPage: React.FC<LiveGameSimulatorPageProps> = ({ selectedGame, signedIn, userEmail, onOpenAuth, onBack }) => {
  const game = useMemo(() => selectedGame?.gamePk ? selectedGame : readStoredGame(), [selectedGame?.gamePk]);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!game?.gamePk) return;
    let cancelled = false;

    const load = async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const data = await fetchLiveGameFeed(game.gamePk!);
        if (!cancelled) {
          setFeed(data);
          setError(null);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load ScoutCore AI Live Sim.');
      } finally {
        if (!cancelled && !quiet) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(true), 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [game?.gamePk]);

  if (!game?.gamePk) {
    return <div className="min-h-[calc(100vh-4rem)] bg-[#08111f] px-4 py-10 text-[#dae2fd]"><div className="mx-auto max-w-2xl rounded-2xl border border-[#2b405b] bg-[#0d1727] p-8 text-center"><span className="material-symbols-outlined text-4xl text-[#00e6f4]">sports_baseball</span><h1 className="mt-3 text-2xl font-black text-white">Select a game first</h1><p className="mt-2 text-sm text-[#8fa0b7]">Open a game from Dashboard or Schedule to launch ScoutCore AI Live Sim.</p><button type="button" onClick={onBack} className="mt-5 rounded-xl bg-[#00e6f4] px-5 py-3 text-xs font-black text-[#062029]">BACK</button></div></div>;
  }

  return <div className="min-h-[calc(100vh-4rem)] bg-[#07101d] text-[#dae2fd]">
    <div className="border-b border-[#26364e] bg-[#08111f] px-3 py-2.5 sm:px-5">
      <div className="mx-auto flex max-w-[1740px] items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 rounded-lg border border-[#30415c] bg-[#0d1727] px-3 py-2 text-[10px] font-bold text-[#aebbd0] hover:border-[#00e6f4]/50 hover:text-white"><span className="material-symbols-outlined text-[16px]">arrow_back</span>BACK</button>
        <div className="min-w-0 flex-1 text-center"><p className="truncate text-[10px] font-black uppercase tracking-[.15em] text-[#00e6f4]">ScoutCore AI Live Sim</p><p className="mt-0.5 truncate text-[9px] text-[#718198]">{game.awayTeam?.abbreviation ?? game.awayTeam?.name ?? 'Away'} @ {game.homeTeam?.abbreviation ?? game.homeTeam?.name ?? 'Home'} · separate live game page</p></div>
        <div className="shrink-0 text-right text-[9px] text-[#607086]">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Live data'}</div>
      </div>
    </div>

    {loading && !feed && <div className="mx-auto max-w-[1740px] px-5 py-16 text-center text-sm text-[#8fa0b7]">Loading verified MLB live data…</div>}
    {error && !feed && <div className="mx-auto max-w-[1740px] px-5 py-8"><div className="rounded-2xl border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 p-5 text-sm text-[#ffb4ab]">{error}</div></div>}
    {error && feed && <div className="mx-auto max-w-[1740px] px-5 pt-3"><div className="rounded-xl border border-[#ffd166]/25 bg-[#ffd166]/7 px-4 py-2 text-[10px] text-[#e7d9aa]">Live refresh paused temporarily. Showing the most recent verified game state.</div></div>}
    {feed && <LiveGameExperienceV4 gamePk={game.gamePk} feed={feed} signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />}
  </div>;
};
