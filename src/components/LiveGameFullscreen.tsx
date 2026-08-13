import React, { useEffect, useMemo, useState } from 'react';
import { fetchLiveGameFeed } from '../services/mlbClient';
import { LiveGameExperienceV3 } from './LiveGameExperienceV3';

type GameSelection = {
  gamePk?: number;
  gameDate?: string;
  status?: string;
  detailedState?: string;
  awayTeam?: { id: number; name: string; abbreviation?: string };
  homeTeam?: { id: number; name: string; abbreviation?: string };
};

interface LiveGameFullscreenProps {
  selectedGame?: GameSelection | null;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
  onExit: () => void;
}

const readStoredGame = (): GameSelection | null => {
  try {
    const raw = window.sessionStorage.getItem('scoutcore:selected-game');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const LiveGameFullscreen: React.FC<LiveGameFullscreenProps> = ({ selectedGame, signedIn, userEmail, onOpenAuth, onExit }) => {
  const game = useMemo(() => selectedGame?.gamePk ? selectedGame : readStoredGame(), [selectedGame?.gamePk]);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!game?.gamePk) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const data = await fetchLiveGameFeed(game.gamePk!);
        if (!cancelled) {
          setFeed(data);
          setError(null);
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

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onExit]);

  if (!game?.gamePk) {
    return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#02060d] p-5 text-[#dae2fd]"><button onClick={onExit} aria-label="Exit live game" className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#30415c] bg-[#10192b] text-[#d7e1ef]"><span className="material-symbols-outlined">close</span></button><div className="max-w-lg rounded-2xl border border-[#2b405b] bg-[#0d1727] p-8 text-center"><h1 className="text-xl font-extrabold text-white">No live game selected</h1><p className="mt-2 text-sm text-[#8fa0b7]">Choose a game from the Dashboard or Schedule first.</p></div></div>;
  }

  return <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#02060d] text-[#dae2fd]">
    <button onClick={onExit} aria-label="Exit live game" title="Exit live game" className="fixed right-4 top-4 z-[260] flex h-11 w-11 items-center justify-center rounded-xl border border-[#40516b] bg-[#07101f]/95 text-[#c8d4e2] shadow-2xl backdrop-blur transition hover:border-[#00e6f4] hover:text-white sm:right-5 sm:top-5"><span className="material-symbols-outlined">close</span></button>
    {loading && !feed && <div className="flex min-h-screen items-center justify-center p-6"><div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] px-8 py-10 text-center text-sm text-[#9aa8bc]">Loading verified MLB live data…</div></div>}
    {error && !feed && <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-lg rounded-2xl border border-[#ff8d8d]/30 bg-[#2a1218] p-6 text-center text-sm text-[#ffb4ab]">{error}</div></div>}
    {feed && <LiveGameExperienceV3 gamePk={game.gamePk} feed={feed} signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />}
  </div>;
};
