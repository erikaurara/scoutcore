import React, { useEffect, useMemo, useState } from 'react';
import { fetchLiveGameFeed } from '../services/mlbClient';
import { LiveGameExperienceV3 } from './LiveGameExperienceV3';
import { LiveMatchupSpotlight } from './LiveMatchupSpotlight';
import { LiveBoxScorePanel } from './LiveBoxScorePanel';

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const baseToken = (value: unknown) => {
  const raw = String(value ?? '').toLowerCase();
  if (!raw || raw === 'home') return 'home';
  if (raw === '1b' || raw.includes('first')) return 'first';
  if (raw === '2b' || raw.includes('second')) return 'second';
  if (raw === '3b' || raw.includes('third')) return 'third';
  if (raw === 'score' || raw.includes('home')) return 'score';
  return raw.replace(/[^a-z0-9]+/g, '-');
};

const motionForFeed = (feed: any) => {
  const plays = feed?.liveData?.plays ?? {};
  const allPlays = Array.isArray(plays?.allPlays) ? plays.allPlays : [];
  const currentPlay = plays?.currentPlay ?? allPlays[allPlays.length - 1] ?? null;
  const events = Array.isArray(currentPlay?.playEvents) ? currentPlay.playEvents : [];
  const latestEvent = events[events.length - 1] ?? null;
  const latestPitch = latestEvent?.isPitch ? latestEvent : null;
  const callText = String(latestPitch?.details?.call?.description ?? latestPitch?.details?.description ?? '').toLowerCase();
  const callCode = String(latestPitch?.details?.call?.code ?? '').toLowerCase();
  const hitData = latestPitch?.hitData ?? null;
  const isInPlay = Boolean(latestPitch && (latestPitch?.details?.isInPlay || callCode === 'x' || hitData));
  const isSwing = Boolean(latestPitch && (isInPlay || callText.includes('swing') || callText.includes('foul')));
  const resultText = `${currentPlay?.result?.eventType ?? ''} ${currentPlay?.result?.event ?? ''} ${currentPlay?.result?.description ?? ''}`.toLowerCase();
  const isHomeRun = resultText.includes('home_run') || resultText.includes('home run') || resultText.includes('homers');
  const trajectoryText = String(hitData?.trajectory ?? '').toLowerCase();

  let trajectoryClass = 'scoutcore-ball-line';
  if (isHomeRun) trajectoryClass = 'scoutcore-ball-home-run';
  else if (trajectoryText.includes('ground')) trajectoryClass = 'scoutcore-ball-ground';
  else if (trajectoryText.includes('popup') || trajectoryText.includes('pop_up')) trajectoryClass = 'scoutcore-ball-popup';
  else if (trajectoryText.includes('fly')) trajectoryClass = 'scoutcore-ball-fly';

  const rawX = Number(hitData?.coordinates?.coordX);
  const rawY = Number(hitData?.coordinates?.coordY);
  const hasHitCoordinates = Number.isFinite(rawX) && Number.isFinite(rawY) && rawX >= 0 && rawX <= 260 && rawY >= 0 && rawY <= 260;
  const description = `${resultText} ${callText}`;

  let fallbackX = 50;
  if (description.includes('left field') || description.includes('left-center') || description.includes('left center')) fallbackX = 30;
  else if (description.includes('right field') || description.includes('right-center') || description.includes('right center')) fallbackX = 70;

  let fallbackY = 36;
  if (isHomeRun) fallbackY = 5;
  else if (trajectoryClass === 'scoutcore-ball-fly') fallbackY = 20;
  else if (trajectoryClass === 'scoutcore-ball-popup') fallbackY = 32;
  else if (trajectoryClass === 'scoutcore-ball-ground') fallbackY = 56;

  const targetX = hasHitCoordinates ? clamp((rawX / 250) * 100, 8, 92) : fallbackX;
  const targetY = hasHitCoordinates ? clamp((rawY / 250) * 100, 6, 84) : fallbackY;

  const px = Number(latestPitch?.pitchData?.coordinates?.pX);
  const pitchEndX = Number.isFinite(px) ? clamp(50 + (px / 1.6) * 4, 45.5, 54.5) : 50;

  const runnerClasses = new Set<string>();
  const runners = Array.isArray(currentPlay?.runners) ? currentPlay.runners : [];
  runners.forEach((runner: any) => {
    const endRaw = runner?.movement?.end;
    if (!endRaw) return;
    const start = baseToken(runner?.movement?.start);
    const end = baseToken(endRaw);
    if (start && end && start !== end) runnerClasses.add(`scoutcore-run-${start}-${end}`);
  });

  const pulseNumber = Number(currentPlay?.atBatIndex ?? 0) * 17 + Number(latestEvent?.index ?? events.length ?? 0);
  const pulseClass = pulseNumber % 2 === 0 ? 'scoutcore-event-pulse-a' : 'scoutcore-event-pulse-b';
  const modeClass = latestPitch ? (isInPlay ? 'scoutcore-motion-contact' : 'scoutcore-motion-pitch') : 'scoutcore-motion-idle';

  return {
    className: [
      'scoutcore-live-motion',
      modeClass,
      trajectoryClass,
      pulseClass,
      isSwing ? 'scoutcore-batter-swing' : '',
      ...runnerClasses,
    ].filter(Boolean).join(' '),
    style: {
      '--sc-ball-target-x': `${targetX}%`,
      '--sc-ball-target-y': `${targetY}%`,
      '--sc-pitch-end-x': `${pitchEndX}%`,
    } as React.CSSProperties,
  };
};

export const LiveGameFullscreen: React.FC<LiveGameFullscreenProps> = ({ selectedGame, signedIn, userEmail, onOpenAuth, onExit }) => {
  const game = useMemo(() => selectedGame?.gamePk ? selectedGame : readStoredGame(), [selectedGame?.gamePk]);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boxScoreOpen, setBoxScoreOpen] = useState(false);
  const motion = useMemo(() => motionForFeed(feed), [feed]);

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
      if (event.key !== 'Escape') return;
      if (boxScoreOpen) {
        setBoxScoreOpen(false);
        return;
      }
      onExit();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onExit, boxScoreOpen]);

  if (!game?.gamePk) {
    return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#02060d] p-5 text-[#dae2fd]"><button onClick={onExit} aria-label="Exit live game" className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#30415c] bg-[#10192b] text-[#d7e1ef]"><span className="material-symbols-outlined">close</span></button><div className="max-w-lg rounded-2xl border border-[#2b405b] bg-[#0d1727] p-8 text-center"><h1 className="text-xl font-extrabold text-white">No live game selected</h1><p className="mt-2 text-sm text-[#8fa0b7]">Choose a game from the Dashboard or Schedule first.</p></div></div>;
  }

  return <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#02060d] text-[#dae2fd]">
    <div className="fixed right-4 top-4 z-[260] flex items-center gap-2 sm:right-5 sm:top-5">
      {feed && <button onClick={() => setBoxScoreOpen(true)} aria-label="Open full box score" title="Full box score" className="flex h-11 items-center gap-2 rounded-xl border border-[#40516b] bg-[#07101f]/95 px-3 text-[10px] font-black tracking-[.08em] text-[#c8d4e2] shadow-2xl backdrop-blur transition hover:border-[#00e6f4] hover:text-white"><span className="material-symbols-outlined text-[19px]">table_chart</span><span className="hidden sm:inline">BOX SCORE</span></button>}
      <button onClick={onExit} aria-label="Exit live game" title="Exit live game" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#40516b] bg-[#07101f]/95 text-[#c8d4e2] shadow-2xl backdrop-blur transition hover:border-[#00e6f4] hover:text-white"><span className="material-symbols-outlined">close</span></button>
    </div>
    {loading && !feed && <div className="flex min-h-screen items-center justify-center p-6"><div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] px-8 py-10 text-center text-sm text-[#9aa8bc]">Loading verified MLB live data…</div></div>}
    {error && !feed && <div className="flex min-h-screen items-center justify-center p-6"><div className="max-w-lg rounded-2xl border border-[#ff8d8d]/30 bg-[#2a1218] p-6 text-center text-sm text-[#ffb4ab]">{error}</div></div>}
    {feed && <div className={motion.className} style={motion.style}>
      <div
        className="absolute top-[101px] z-[235] hidden w-[270px] xl:block"
        style={{ left: 'max(1.25rem, calc((100vw - 1740px) / 2 + 1.25rem))' }}
      >
        <LiveMatchupSpotlight feed={feed} />
      </div>
      <LiveGameExperienceV3 gamePk={game.gamePk} feed={feed} signedIn={signedIn} userEmail={userEmail} onOpenAuth={onOpenAuth} />
      {boxScoreOpen && <LiveBoxScorePanel feed={feed} onClose={() => setBoxScoreOpen(false)} />}
    </div>}
  </div>;
};
