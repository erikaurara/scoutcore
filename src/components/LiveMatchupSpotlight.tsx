import React, { useMemo, useState } from 'react';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

type LiveMatchupSpotlightProps = {
  feed: any;
};

const playerName = (player: any, fallback: string) => player?.fullName ?? player?.name ?? fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const pitchDotStyle = (event: any) => {
  const x = Number(event?.pitchData?.coordinates?.pX);
  const z = Number(event?.pitchData?.coordinates?.pZ);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { left: '50%', top: '50%' };
  const left = 50 + clamp(x / 1.5, -1, 1) * 39;
  const top = 86 - clamp((z - 1) / 3, 0, 1) * 72;
  return { left: `${left}%`, top: `${top}%` };
};

const dotClass = (event: any, index: number) => {
  const call = String(event?.details?.call?.code ?? event?.details?.call?.description ?? '').toLowerCase();
  if (call.includes('ball') || call === 'b') return 'border-[#a8f58d] bg-[#63b64a] text-white';
  if (call.includes('foul')) return 'border-[#c9a9ff] bg-[#7b4db5] text-white';
  if (call.includes('strike') || call.includes('in play') || call.includes('x')) return 'border-[#ff9c92] bg-[#c93e37] text-white';
  return index % 2 === 0 ? 'border-[#8ff7ff] bg-[#0ea5b6] text-white' : 'border-[#c9a9ff] bg-[#7b4db5] text-white';
};

export const LiveMatchupSpotlight: React.FC<LiveMatchupSpotlightProps> = ({ feed }) => {
  const [logOpen, setLogOpen] = useState(false);
  const gameData = feed?.gameData ?? {};
  const liveData = feed?.liveData ?? {};
  const linescore = liveData?.linescore ?? {};
  const boxscore = liveData?.boxscore ?? {};
  const plays = liveData?.plays ?? {};
  const allPlays = Array.isArray(plays?.allPlays) ? plays.allPlays : [];
  const currentPlay = plays?.currentPlay ?? allPlays[allPlays.length - 1] ?? null;
  const events = Array.isArray(currentPlay?.playEvents) ? currentPlay.playEvents : [];
  const pitches = events.filter((event: any) => event?.isPitch).slice(-6);
  const batter = currentPlay?.matchup?.batter ?? null;
  const pitcher = currentPlay?.matchup?.pitcher ?? null;
  const battingSide = linescore?.isTopInning ? 'away' : 'home';
  const fieldingSide = battingSide === 'away' ? 'home' : 'away';
  const battingTeam = gameData?.teams?.[battingSide] ?? {};
  const fieldingTeam = gameData?.teams?.[fieldingSide] ?? {};
  const batterBox = batter?.id ? boxscore?.teams?.[battingSide]?.players?.[`ID${batter.id}`] : null;
  const pitcherBox = pitcher?.id ? boxscore?.teams?.[fieldingSide]?.players?.[`ID${pitcher.id}`] : null;
  const battingStats = batterBox?.stats?.batting ?? {};
  const pitchingStats = pitcherBox?.stats?.pitching ?? {};
  const batSide = currentPlay?.matchup?.batSide?.code ?? batterBox?.batSide?.code ?? '—';
  const pitchHand = currentPlay?.matchup?.pitchHand?.code ?? pitcherBox?.pitchHand?.code ?? '—';
  const latestDescription = events[events.length - 1]?.details?.description
    ?? currentPlay?.result?.description
    ?? currentPlay?.result?.event
    ?? 'Waiting for verified pitch data…';

  const batterLine = useMemo(() => {
    const hits = battingStats?.hits ?? 0;
    const atBats = battingStats?.atBats ?? 0;
    const rbi = battingStats?.rbi ?? 0;
    return `${hits}-${atBats} · ${rbi} RBI`;
  }, [battingStats?.hits, battingStats?.atBats, battingStats?.rbi]);

  const pitcherLine = useMemo(() => {
    const ip = pitchingStats?.inningsPitched ?? '0.0';
    const strikeouts = pitchingStats?.strikeOuts ?? 0;
    const pitchesThrown = pitchingStats?.numberOfPitches ?? 0;
    return `${ip} IP · ${strikeouts} K · ${pitchesThrown} P`;
  }, [pitchingStats?.inningsPitched, pitchingStats?.strikeOuts, pitchingStats?.numberOfPitches]);

  return <>
    <section className="overflow-hidden rounded-2xl border border-[#24435a] bg-[linear-gradient(180deg,#081827_0%,#07111d_48%,#030913_100%)] shadow-[0_18px_45px_rgba(0,0,0,.38)]">
      <div className="grid grid-cols-2 border-b border-[#1d3548]">
        <div className="border-r border-[#1d3548] px-3 py-2.5">
          <p className="text-[8px] font-black uppercase tracking-[.15em] text-[#53e8e0]">AT BAT</p>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#2b5365] bg-[#dfe5ea]">
              {batter?.id ? <img src={mlbPlayerHeadshotUrl(batter.id, 120)} alt="" className="h-full w-full object-contain"/> : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black text-white">{playerName(batter, 'Batter')}</p>
              <p className="mt-0.5 text-[8px] font-bold text-[#8396aa]">{batSide} · {batterBox?.position?.abbreviation ?? ''}</p>
              <p className="mt-1 truncate text-[8px] text-[#9dafc2]">{batterLine}</p>
            </div>
          </div>
        </div>

        <div className="px-3 py-2.5">
          <p className="text-right text-[8px] font-black uppercase tracking-[.15em] text-[#53e8e0]">PITCHING</p>
          <div className="mt-2 flex flex-row-reverse items-center gap-2.5">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#2b5365] bg-[#dfe5ea]">
              {pitcher?.id ? <img src={mlbPlayerHeadshotUrl(pitcher.id, 120)} alt="" className="h-full w-full object-contain"/> : null}
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate text-[11px] font-black text-white">{playerName(pitcher, 'Pitcher')}</p>
              <p className="mt-0.5 text-[8px] font-bold text-[#8396aa]">{pitchHand}HP</p>
              <p className="mt-1 truncate text-[8px] text-[#9dafc2]">{pitcherLine}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-[190px] overflow-hidden border-b border-[#1d3548] bg-[radial-gradient(circle_at_50%_90%,rgba(20,92,91,.22),transparent_40%),linear-gradient(180deg,#0b1726_0%,#07101b_100%)]">
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1.5 rounded-full border border-[#2c5264] bg-[#07121d]/90 px-2 py-1">
          <img src={mlbTeamLogoUrl(battingTeam?.id)} alt="" className="h-3.5 w-3.5 object-contain"/>
          <span className="text-[7px] font-black uppercase tracking-wider text-[#9eb0c3]">{battingTeam?.abbreviation ?? battingTeam?.name ?? 'AT BAT'}</span>
        </div>
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full border border-[#2c5264] bg-[#07121d]/90 px-2 py-1">
          <span className="text-[7px] font-black uppercase tracking-wider text-[#9eb0c3]">{fieldingTeam?.abbreviation ?? fieldingTeam?.name ?? 'PITCHING'}</span>
          <img src={mlbTeamLogoUrl(fieldingTeam?.id)} alt="" className="h-3.5 w-3.5 object-contain"/>
        </div>

        <div className="absolute -bottom-5 -left-5 h-[175px] w-[155px] opacity-80 saturate-75">
          {batter?.id ? <img src={mlbPlayerHeadshotUrl(batter.id, 300)} alt="" className="h-full w-full object-contain object-bottom drop-shadow-[0_18px_16px_rgba(0,0,0,.7)]"/> : null}
        </div>

        <div className="absolute bottom-5 right-5 h-[130px] w-[122px]">
          <div className="absolute inset-x-[17%] bottom-[7%] top-[4%] border border-[#8aa0b4]/80 bg-[#09121e]/45 shadow-[0_0_18px_rgba(0,0,0,.35)]">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-[#177c96]/18" />
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[#d84242]/18" />
            <div className="absolute inset-x-0 top-1/3 border-t border-[#62788d]/25" />
            <div className="absolute inset-x-0 top-2/3 border-t border-[#62788d]/25" />
            <div className="absolute inset-y-0 left-1/3 border-l border-[#62788d]/25" />
            <div className="absolute inset-y-0 left-2/3 border-l border-[#62788d]/25" />
          </div>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[7px] font-black uppercase tracking-[.14em] text-[#ce6aff]">LIVE PITCH MAP</div>
          {pitches.map((event: any, index: number) => <span key={event?.playId ?? event?.index ?? index} style={pitchDotStyle(event)} className={`absolute z-20 flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[7px] font-black shadow-[0_0_12px_rgba(0,0,0,.45)] ${dotClass(event, index)}`}>{index + 1}</span>)}
        </div>

        <div className="absolute bottom-2 left-3 right-[138px] rounded-lg border border-white/8 bg-[#020813]/72 px-2.5 py-2 backdrop-blur-sm">
          <p className="line-clamp-2 text-[9px] font-bold leading-4 text-[#d3dfec]">{latestDescription}</p>
        </div>
      </div>

      <button type="button" onClick={() => setLogOpen(true)} className="flex w-full items-center justify-center gap-2 bg-[#071522] px-3 py-2.5 text-[8px] font-black uppercase tracking-[.13em] text-[#72efe8] transition hover:bg-[#0a2030]">
        VIEW FULL PITCH LOG
        <span className="material-symbols-outlined text-[14px]">open_in_new</span>
      </button>
    </section>

    {logOpen && <div className="fixed inset-0 z-[320] flex items-center justify-center bg-[#01050c]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Full pitch log">
      <section className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0b1524] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#26364e] px-4 py-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#53e8e0]">FULL PITCH LOG</p><p className="mt-1 text-xs font-bold text-white">{playerName(batter, 'Batter')} vs {playerName(pitcher, 'Pitcher')}</p></div>
          <button type="button" onClick={() => setLogOpen(false)} aria-label="Close pitch log" className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#30415c] text-[#aab8c8] hover:border-[#53e8e0] hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="max-h-[65vh] divide-y divide-[#1e3047] overflow-y-auto">
          {pitches.length ? pitches.map((event: any, index: number) => {
            const speed = Number(event?.pitchData?.startSpeed);
            const type = event?.details?.type?.description ?? 'Pitch';
            const call = event?.details?.call?.description ?? event?.details?.description ?? 'Tracked pitch';
            return <div key={event?.playId ?? event?.index ?? index} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 px-4 py-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-black ${dotClass(event, index)}`}>{index + 1}</span>
              <div><p className="text-xs font-black text-white">{type}</p><p className="mt-1 text-[10px] text-[#8798ac]">{call}</p></div>
              <span className="font-mono text-xs font-black text-[#cbd7e4]">{Number.isFinite(speed) ? `${speed.toFixed(1)} mph` : '—'}</span>
            </div>;
          }) : <div className="p-8 text-center text-sm text-[#8293a7]">Verified pitch tracking has not arrived yet.</div>}
        </div>
      </section>
    </div>}
  </>;
};
