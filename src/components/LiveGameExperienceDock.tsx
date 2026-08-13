import React, { useEffect, useMemo, useState } from 'react';
import { fetchLiveGameFeed } from '../services/mlbClient';
import { LiveGameExperienceV3 } from './LiveGameExperienceV3';

type GameSelection = {
  gamePk?: number;
  gameDate?: string;
  status?: string;
  awayTeam?: { id: number; name: string; abbreviation?: string };
  homeTeam?: { id: number; name: string; abbreviation?: string };
};

type LiveGameExperienceDockProps = {
  selectedGame?: GameSelection | null;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
};

const readStoredGame = (): GameSelection | null => {
  try {
    const raw = window.sessionStorage.getItem('scoutcore:selected-game');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const LiveGameExperienceDock: React.FC<LiveGameExperienceDockProps> = ({ selectedGame, signedIn, userEmail, onOpenAuth }) => {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const game = useMemo(() => selectedGame?.gamePk ? selectedGame : readStoredGame(), [selectedGame?.gamePk]);

  useEffect(() => {
    if (!open || !game?.gamePk) return;
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
  }, [open, game?.gamePk]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!game?.gamePk) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-[#00e6f4]/45 bg-[#07101f]/95 px-4 py-3 text-xs font-extrabold text-[#bdfaff] shadow-[0_12px_45px_rgba(0,0,0,.38),0_0_30px_rgba(0,230,244,.12)] backdrop-blur hover:border-[#00e6f4] hover:bg-[#0b1b2c]">
      <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff5d6c] opacity-70"/><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5d6c]"/></span>
      OPEN AI LIVE SIM
      <span className="material-symbols-outlined text-[18px] text-[#00e6f4]">stadium</span>
    </button>

    {open && <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#02060d]/90 p-2 backdrop-blur-sm sm:p-5">
      <div className="mx-auto min-h-full max-w-[1780px]">
        <div className="sticky top-2 z-[80] mb-3 flex items-center justify-between gap-3 rounded-2xl border border-[#2b405b] bg-[#08111f]/96 px-4 py-3 shadow-xl backdrop-blur">
          <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#00e6f4]">ScoutCore AI Live Sim</p><p className="mt-1 truncate text-sm font-bold text-white">{game.awayTeam?.abbreviation ?? game.awayTeam?.name ?? 'Away'} @ {game.homeTeam?.abbreviation ?? game.homeTeam?.name ?? 'Home'} · field alignment + pitch sequence + chat</p></div>
          <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#30415c] bg-[#10192b] text-[#aebbd0] hover:border-[#00e6f4]/50 hover:text-white" aria-label="Close AI live simulator"><span className="material-symbols-outlined">close</span></button>
        </div>

        {loading && !feed && <div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-12 text-center text-sm text-[#9aa8bc]">Loading verified MLB live data…</div>}
        {error && !feed && <div className="rounded-2xl border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 p-5 text-sm text-[#ffb4ab]">{error}</div>}
        {feed && <LiveGameExperienceV3 gamePk={game.gamePk} feed={feed} signedIn={signedIn} userEmail={userEmail} onOpenAuth={() => { setOpen(false); onOpenAuth(); }} />}
      </div>
    </div>}
  </>;
};
