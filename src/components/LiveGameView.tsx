import React, { useEffect, useMemo, useState } from 'react';
import { fetchLiveGameFeed } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

type GameSelection = {
  gamePk?: number;
  gameDate?: string;
  status?: string;
  detailedState?: string;
  awayScore?: number;
  homeScore?: number;
  awayTeam?: { id: number; name: string; abbreviation?: string };
  homeTeam?: { id: number; name: string; abbreviation?: string };
  awayProbablePitcher?: { id: number; name: string } | null;
  homeProbablePitcher?: { id: number; name: string } | null;
};

type LiveTab = 'live' | 'box' | 'matchup' | 'insights';
type Side = 'away' | 'home';

interface LiveGameViewProps {
  selectedGame?: GameSelection | null;
  onOpenMatchup: () => void;
  onBack: () => void;
}

const readStoredGame = (): GameSelection | null => {
  try {
    const raw = window.sessionStorage.getItem('scoutcore:selected-game');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const num = (value: any, fallback: any = '—') => value === 0 || value ? value : fallback;
const shortName = (name?: string) => String(name ?? '—').split(' ').slice(-1)[0];

export const LiveGameView: React.FC<LiveGameViewProps> = ({ selectedGame, onOpenMatchup, onBack }) => {
  const game = useMemo(() => (selectedGame?.gamePk ? selectedGame : readStoredGame()), [selectedGame?.gamePk]);
  const [tab, setTab] = useState<LiveTab>('live');
  const [boxSide, setBoxSide] = useState<Side>('home');
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async (quiet = false) => {
    if (!game?.gamePk) return;
    if (!quiet) setLoading(true);
    try {
      setError(null);
      const data = await fetchLiveGameFeed(game.gamePk);
      setFeed(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load live game data.');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    setTab('live');
    setFeed(null);
    if (!game?.gamePk) {
      setLoading(false);
      return;
    }
    void load();
  }, [game?.gamePk]);

  const abstractState = feed?.gameData?.status?.abstractGameState ?? game?.status ?? 'Preview';
  useEffect(() => {
    if (!game?.gamePk || abstractState !== 'Live') return;
    const timer = window.setInterval(() => void load(true), 12000);
    return () => window.clearInterval(timer);
  }, [game?.gamePk, abstractState]);

  if (!game?.gamePk) {
    return <div className="min-h-screen bg-[#08111f] p-4 sm:p-6 text-[#dae2fd]"><div className="max-w-2xl mx-auto mt-10 rounded-2xl border border-[#2b405b] bg-[#0d1727] p-8 text-center"><h1 className="text-2xl font-bold">Live Gameday</h1><p className="mt-3 text-sm text-[#9aa8bc]">Open a game from the Dashboard to launch the live gameday screen.</p><button onClick={onBack} className="mt-5 px-4 py-2 rounded-lg bg-[#00dff0] text-[#06131b] font-bold text-sm">BACK TO DASHBOARD</button></div></div>;
  }

  const gameData = feed?.gameData ?? {};
  const liveData = feed?.liveData ?? {};
  const linescore = liveData?.linescore ?? {};
  const plays = liveData?.plays ?? {};
  const allPlays = plays?.allPlays ?? [];
  const currentPlay = plays?.currentPlay ?? allPlays[allPlays.length - 1] ?? null;
  const boxscore = liveData?.boxscore ?? {};
  const awayTeam = gameData?.teams?.away ?? game.awayTeam ?? {};
  const homeTeam = gameData?.teams?.home ?? game.homeTeam ?? {};
  const awayBox = boxscore?.teams?.away ?? {};
  const homeBox = boxscore?.teams?.home ?? {};
  const awayRuns = linescore?.teams?.away?.runs ?? game.awayScore ?? 0;
  const homeRuns = linescore?.teams?.home?.runs ?? game.homeScore ?? 0;
  const detailedState = gameData?.status?.detailedState ?? game.detailedState ?? abstractState;
  const currentInning = linescore?.currentInning ?? 0;
  const inningState = String(linescore?.inningState ?? '').toUpperCase();
  const inningLabel = detailedState === 'Final' ? 'FINAL' : currentInning ? `${inningState || ''} ${currentInning}`.trim() : detailedState;
  const count = currentPlay?.count ?? linescore?.offense ?? {};
  const batter = currentPlay?.matchup?.batter ?? null;
  const pitcher = currentPlay?.matchup?.pitcher ?? null;
  const offense = linescore?.offense ?? {};
  const battingSide: Side = linescore?.isTopInning ? 'away' : 'home';
  const currentPitches = (currentPlay?.playEvents ?? []).filter((event: any) => event?.isPitch || event?.details?.isPitch);
  const recentEvents = [...(currentPlay?.playEvents ?? [])].reverse().slice(0, 9);

  const playerFromBox = (id?: number) => {
    if (!id) return null;
    return awayBox?.players?.[`ID${id}`] ?? homeBox?.players?.[`ID${id}`] ?? null;
  };
  const batterBoxPlayer = playerFromBox(batter?.id);
  const pitcherBoxPlayer = playerFromBox(pitcher?.id);
  const batterGame = batterBoxPlayer?.stats?.batting ?? {};
  const pitcherGame = pitcherBoxPlayer?.stats?.pitching ?? {};

  const pitcherPitches = useMemo(() => {
    if (!pitcher?.id) return [] as any[];
    return allPlays.flatMap((play: any) => play?.matchup?.pitcher?.id === pitcher.id ? (play.playEvents ?? []).filter((event: any) => event?.isPitch || event?.details?.isPitch) : []);
  }, [allPlays, pitcher?.id]);

  const pitchMix = useMemo(() => {
    const grouped = new Map<string, { name: string; count: number; velo: number; veloCount: number }>();
    pitcherPitches.forEach((event: any) => {
      const code = event?.details?.type?.code ?? 'UNK';
      const name = event?.details?.type?.description ?? 'Unknown pitch';
      const velo = Number(event?.pitchData?.startSpeed);
      const row = grouped.get(code) ?? { name, count: 0, velo: 0, veloCount: 0 };
      row.count += 1;
      if (Number.isFinite(velo)) { row.velo += velo; row.veloCount += 1; }
      grouped.set(code, row);
    });
    return [...grouped.entries()].map(([code, row]) => ({ code, name: row.name, count: row.count, avgVelo: row.veloCount ? row.velo / row.veloCount : null, pct: pitcherPitches.length ? row.count / pitcherPitches.length * 100 : 0 })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [pitcherPitches]);

  const scoringPlays = (plays?.scoringPlays ?? []).map((index: number) => allPlays[index]).filter(Boolean).slice(-6).reverse();
  const sideBox = boxSide === 'away' ? awayBox : homeBox;
  const sideTeam = boxSide === 'away' ? awayTeam : homeTeam;
  const batters = (sideBox?.batters ?? []).map((id: number) => sideBox?.players?.[`ID${id}`]).filter(Boolean);
  const pitchers = (sideBox?.pitchers ?? []).map((id: number) => sideBox?.players?.[`ID${id}`]).filter(Boolean);

  return <div className="min-h-screen bg-[#08111f] text-[#dae2fd] pb-10">
    <section className="border-b border-[#26364e] bg-[#0b1424]">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <button onClick={onBack} className="text-xs text-[#9fb0c7] hover:text-white flex items-center gap-1"><span className="material-symbols-outlined text-[18px]">arrow_back</span> Dashboard</button>
          <div className="flex items-center gap-2 text-[10px]"><span className={`w-2 h-2 rounded-full ${abstractState === 'Live' ? 'bg-[#ff5d6c] animate-pulse' : detailedState === 'Final' ? 'bg-[#00dff0]' : 'bg-[#8291a7]'}`} /><span className={abstractState === 'Live' ? 'text-[#ff8a94] font-bold' : 'text-[#9aa8bc]'}>{abstractState === 'Live' ? 'LIVE · AUTO REFRESH' : detailedState.toUpperCase()}</span>{lastUpdated&&<span className="text-[#64748b] hidden sm:inline">UPDATED {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}</div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-6">
          <ScoreTeam team={awayTeam} score={awayRuns} align="left" />
          <div className="text-center min-w-[76px] sm:min-w-[110px]"><div className="font-mono text-[11px] sm:text-sm text-[#00e6f4] font-bold">{inningLabel}</div><div className="mt-2"><BaseDiamond first={Boolean(offense?.first)} second={Boolean(offense?.second)} third={Boolean(offense?.third)} /></div><div className="text-[10px] text-[#9aa8bc] mt-2">{num(currentPlay?.count?.outs, linescore?.outs ?? 0)} OUT{Number(currentPlay?.count?.outs ?? linescore?.outs ?? 0) === 1 ? '' : 'S'}</div></div>
          <ScoreTeam team={homeTeam} score={homeRuns} align="right" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-2 sm:px-5 flex items-center gap-1 border-t border-[#1e2d43] overflow-hidden">
        {(['live','box','matchup','insights'] as LiveTab[]).map(item => <button key={item} onClick={()=>{setTab(item);if(item==='box'&&abstractState==='Live')setBoxSide(battingSide);}} className={`flex-1 min-w-0 py-3 text-[11px] sm:text-sm font-bold uppercase border-b-2 ${tab===item?'border-[#00e6f4] text-[#e8fbff]':'border-transparent text-[#8998ad]'}`}>{item === 'box' ? 'Box Score' : item}</button>)}
      </div>
    </section>

    {error&&<div className="max-w-6xl mx-auto mt-4 px-3 sm:px-5"><div className="rounded-xl border border-[#ff8d8d]/30 bg-[#ff8d8d]/10 p-3 text-sm text-[#ffb4ab]">{error}</div></div>}
    {loading&&!feed&&<div className="max-w-6xl mx-auto p-10 text-center text-[#9aa8bc]">Loading live MLB gameday…</div>}

    {!loading&&feed&&tab==='live'&&<main className="max-w-6xl mx-auto px-3 sm:px-5 py-4 space-y-4">
      <section className="grid grid-cols-1 lg:grid-cols-[1.25fr_.75fr] gap-4">
        <div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#26364e] flex items-center justify-between"><div><p className="text-[10px] text-[#00e6f4] font-bold">LIVE PITCH TRACKER</p><p className="text-xs text-[#8fa0b7] mt-1">Current plate appearance · verified MLB pitch data</p></div><div className="font-mono text-lg">{num(currentPlay?.count?.balls,0)}-{num(currentPlay?.count?.strikes,0)}</div></div>
          <div className="relative min-h-[390px] sm:min-h-[460px] bg-gradient-to-b from-[#0e2433] via-[#0d1b2c] to-[#09111e] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#15263a] to-transparent" />
            <div className="absolute w-[210px] h-[260px] sm:w-[250px] sm:h-[310px] border-2 border-[#80eaf3]/80 bg-[#07111e]/25 shadow-[0_0_35px_rgba(0,230,244,.08)]">
              <div className="absolute left-1/3 top-0 bottom-0 border-l border-[#80eaf3]/25"/><div className="absolute left-2/3 top-0 bottom-0 border-l border-[#80eaf3]/25"/><div className="absolute top-1/3 left-0 right-0 border-t border-[#80eaf3]/25"/><div className="absolute top-2/3 left-0 right-0 border-t border-[#80eaf3]/25"/>
            </div>
            <div className="absolute inset-0">
              {currentPitches.map((event:any,index:number)=>{
                const px=Number(event?.pitchData?.coordinates?.pX); const pz=Number(event?.pitchData?.coordinates?.pZ);
                if(!Number.isFinite(px)||!Number.isFinite(pz))return null;
                const left=clamp(((px+2.5)/5)*100,5,95); const top=clamp((1-pz/5)*100,5,95);
                const inPlay=Boolean(event?.details?.isInPlay); const strike=Boolean(event?.details?.isStrike);
                const bg=inPlay?'#65f2b5':strike?'#00e6f4':'#7f8da3';
                return <div key={event?.playId??index} className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-[#08111f] flex items-center justify-center text-[11px] font-bold text-[#06131b] shadow-lg" style={{left:`${left}%`,top:`${top}%`,backgroundColor:bg}} title={event?.details?.description??''}>{index+1}</div>;
              })}
            </div>
            {!currentPitches.length&&<div className="relative z-10 text-center px-6"><span className="material-symbols-outlined text-4xl text-[#34475f]">sports_baseball</span><p className="mt-2 text-sm text-[#8fa0b7]">Pitch locations will appear here during the plate appearance.</p></div>}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 p-4 border-t border-[#26364e] items-center">
            <LivePlayer player={pitcher} boxPlayer={pitcherBoxPlayer} role="PITCHER" align="left" subtitle={`${num(pitcherGame?.numberOfPitches, pitcherPitches.length)} P · ${num(pitcherGame?.inningsPitched)} IP · ${num(pitcherGame?.strikeOuts)} K`} />
            <div className="text-center"><div className="text-[10px] text-[#8fa0b7]">COUNT</div><div className="font-mono text-xl mt-1">{num(currentPlay?.count?.balls,0)}-{num(currentPlay?.count?.strikes,0)}</div><div className="flex justify-center mt-2"><BaseDiamond first={Boolean(offense?.first)} second={Boolean(offense?.second)} third={Boolean(offense?.third)} small /></div></div>
            <LivePlayer player={batter} boxPlayer={batterBoxPlayer} role="BATTER" align="right" subtitle={`${num(batterGame?.atBats,0)} AB · ${num(batterGame?.hits,0)} H · ${num(batterGame?.homeRuns,0)} HR`} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-4 py-3 border-b border-[#26364e]"><p className="text-sm font-bold text-[#00e6f4]">PITCH-BY-PITCH</p><p className="text-[10px] text-[#8fa0b7] mt-1">Current plate appearance</p></div>
          <div className="divide-y divide-[#203149] flex-1">
            {recentEvents.length?recentEvents.map((event:any,index:number)=>{
              const isPitch=event?.isPitch||event?.details?.isPitch; const velo=Number(event?.pitchData?.startSpeed); const pitchType=event?.details?.type?.description;
              return <div key={event?.playId??index} className="px-4 py-3 flex gap-3"><div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold ${isPitch?'bg-[#17364a] text-[#00e6f4]':'bg-[#172235] text-[#9fb0c7]'}`}>{isPitch?currentPitches.findIndex((p:any)=>p===event)+1:'•'}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#e5edf9]">{event?.details?.description??event?.type??'Game event'}</p>{isPitch&&<p className="text-xs text-[#9aa8bc] mt-1">{Number.isFinite(velo)?`${velo.toFixed(1)} mph · `:''}{pitchType??'Pitch'}{event?.count?` · ${event.count.balls}-${event.count.strikes}`:''}</p>}</div></div>;
            }):<div className="p-5 text-sm text-[#8fa0b7]">Live events will appear when play begins.</div>}
          </div>
          <button onClick={()=>setTab('matchup')} className="m-3 py-2.5 rounded-lg border border-[#00e6f4]/35 text-[#00e6f4] text-xs font-bold hover:bg-[#00e6f4]/10">VIEW CURRENT MATCHUP →</button>
        </div>
      </section>
    </main>}

    {!loading&&feed&&tab==='box'&&<main className="max-w-6xl mx-auto px-3 sm:px-5 py-4 space-y-4">
      <InningScore linescore={linescore} awayTeam={awayTeam} homeTeam={homeTeam} />
      <div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] overflow-hidden">
        <div className="flex border-b border-[#26364e]"><button onClick={()=>setBoxSide('away')} className={`flex-1 py-3 text-sm font-bold ${boxSide==='away'?'text-white bg-[#152237]':'text-[#8fa0b7]'}`}>{awayTeam?.teamName??awayTeam?.name??'Away'}{abstractState==='Live'&&battingSide==='away'&&<span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#00e6f4]/10 px-2 py-0.5 text-[9px] text-[#00e6f4]"><span className="h-1.5 w-1.5 rounded-full bg-[#00e6f4] animate-pulse"/>AT BAT</span>}</button><button onClick={()=>setBoxSide('home')} className={`flex-1 py-3 text-sm font-bold ${boxSide==='home'?'text-white bg-[#152237]':'text-[#8fa0b7]'}`}>{homeTeam?.teamName??homeTeam?.name??'Home'}{abstractState==='Live'&&battingSide==='home'&&<span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#00e6f4]/10 px-2 py-0.5 text-[9px] text-[#00e6f4]"><span className="h-1.5 w-1.5 rounded-full bg-[#00e6f4] animate-pulse"/>AT BAT</span>}</button></div>
        <div className="p-3 sm:p-4"><p className="text-xs font-bold text-[#00e6f4] mb-2">BATTERS — {sideTeam?.abbreviation??sideTeam?.name??''}</p><BatterTable players={batters} activeBatterId={boxSide===battingSide?batter?.id:undefined} /></div>
      </div>
      <div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-3 sm:p-4"><p className="text-xs font-bold text-[#00e6f4] mb-2">PITCHERS — {sideTeam?.abbreviation??sideTeam?.name??''}</p><PitcherTable players={pitchers} /></div>
      <div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"><Info label="VENUE" value={gameData?.venue?.name}/><Info label="WEATHER" value={gameData?.weather?.condition ? `${gameData.weather.temp??'—'}° · ${gameData.weather.condition}` : '—'}/><Info label="WIND" value={gameData?.weather?.wind}/><Info label="FIRST PITCH" value={gameData?.datetime?.dateTime ? new Date(gameData.datetime.dateTime).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : '—'}/></div>
    </main>}

    {!loading&&feed&&tab==='matchup'&&<main className="max-w-4xl mx-auto px-3 sm:px-5 py-4 space-y-4">
      <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4 sm:p-6"><div className="text-center mb-5"><p className="text-[10px] text-[#00e6f4] font-bold">CURRENT LIVE MATCHUP</p><h2 className="text-xl sm:text-2xl font-bold mt-1">{pitcher?.fullName??pitcher?.name??'Pitcher'} vs {batter?.fullName??batter?.name??'Batter'}</h2><p className="text-xs text-[#8fa0b7] mt-2">{inningLabel} · {num(currentPlay?.count?.balls,0)}-{num(currentPlay?.count?.strikes,0)} count · {num(currentPlay?.count?.outs,linescore?.outs??0)} outs</p></div><div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-5 items-center"><MatchupPlayer player={pitcher} role="PITCHER" stat={`${num(pitcherGame?.numberOfPitches,pitcherPitches.length)} pitches · ${num(pitcherGame?.strikeOuts)} K`} /><div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-[#26364e] border-t-[#00e6f4] flex items-center justify-center font-bold text-sm">VS</div><MatchupPlayer player={batter} role="BATTER" stat={`${num(batterGame?.atBats,0)} AB · ${num(batterGame?.hits,0)} H`} /></div><button onClick={onOpenMatchup} className="mt-6 w-full py-3 rounded-lg bg-[#00dff0] text-[#06131b] text-sm font-bold">OPEN DEEP PITCHER VS BATTER ANALYSIS →</button></section>
      <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4"><p className="text-xs font-bold text-[#00e6f4]">THIS PLATE APPEARANCE</p><div className="mt-3 grid grid-cols-3 gap-2"><LiveStat label="PITCHES" value={currentPitches.length}/><LiveStat label="BALLS" value={num(currentPlay?.count?.balls,0)}/><LiveStat label="STRIKES" value={num(currentPlay?.count?.strikes,0)}/></div></section>
    </main>}

    {!loading&&feed&&tab==='insights'&&<main className="max-w-6xl mx-auto px-3 sm:px-5 py-4 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><LiveStat label="PITCH COUNT" value={num(pitcherGame?.numberOfPitches,pitcherPitches.length)}/><LiveStat label="CURRENT COUNT" value={`${num(currentPlay?.count?.balls,0)}-${num(currentPlay?.count?.strikes,0)}`}/><LiveStat label="OUTS" value={num(currentPlay?.count?.outs,linescore?.outs??0)}/><LiveStat label="RUNNERS ON" value={[offense?.first,offense?.second,offense?.third].filter(Boolean).length}/></div>
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#00e6f4]">LIVE PITCH MIX</p><span className="text-[10px] text-[#8fa0b7]">{pitcher?.fullName??pitcher?.name??'CURRENT PITCHER'}</span></div><div className="mt-4 space-y-3">{pitchMix.length?pitchMix.map(p=><div key={p.code}><div className="flex justify-between gap-2 text-xs"><span className="truncate">{p.name}</span><span className="text-[#9aa8bc]">{p.count} · {p.avgVelo!=null?`${p.avgVelo.toFixed(1)} mph`:'—'}</span></div><div className="mt-1 h-2 rounded-full bg-[#223249] overflow-hidden"><div className="h-full bg-[#00dff0]" style={{width:`${Math.max(4,p.pct)}%`}}/></div></div>):<p className="text-sm text-[#8fa0b7]">Pitch mix will appear once pitch data is available.</p>}</div></div><div className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-4"><p className="text-sm font-bold text-[#65f2b5]">SCORING PLAYS</p><div className="mt-3 divide-y divide-[#213149]">{scoringPlays.length?scoringPlays.map((play:any,index:number)=><div key={index} className="py-3"><div className="flex justify-between gap-2"><span className="text-xs text-[#00e6f4]">{String(play?.about?.halfInning??'').toUpperCase()} {play?.about?.inning??''}</span><span className="font-mono text-xs">{num(play?.result?.awayScore,awayRuns)}-{num(play?.result?.homeScore,homeRuns)}</span></div><p className="text-sm mt-1 text-[#dbe4f3]">{play?.result?.description??play?.result?.event??'Scoring play'}</p></div>):<p className="text-sm text-[#8fa0b7] py-3">No scoring plays yet.</p>}</div></div></section>
      <section className="rounded-2xl border border-[#00e6f4]/25 bg-[#0d1727] p-4"><p className="text-[10px] font-bold text-[#00e6f4]">SCOUTCORE LIVE NOTE</p><p className="text-sm text-[#b9c5d8] mt-2 leading-6">This screen uses the game feed for live score, pitch locations, count, baserunners, current players and box-score data. ScoutCore does not turn the live feed into a guaranteed outcome prediction.</p></section>
    </main>}
  </div>;
};

const ScoreTeam=({team,score,align}:{team:any;score:any;align:'left'|'right'})=><div className={`flex items-center gap-2 sm:gap-4 min-w-0 ${align==='right'?'flex-row-reverse text-right':'text-left'}`}><div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/95 p-1.5 shrink-0"><img src={mlbTeamLogoUrl(team?.id)} alt="" className="w-full h-full object-contain"/></div><div className="min-w-0"><p className="font-bold text-sm sm:text-lg truncate">{team?.abbreviation??team?.teamName??team?.name??'TEAM'}</p><p className="text-[10px] sm:text-xs text-[#8fa0b7] truncate">{team?.record?.wins!=null?`${team.record.wins}-${team.record.losses}`:team?.name??team?.teamName??''}</p></div><div className="font-mono text-3xl sm:text-5xl font-bold shrink-0">{num(score,0)}</div></div>;

const BaseDiamond=({first,second,third,small=false}:{first:boolean;second:boolean;third:boolean;small?:boolean})=>{const size=small?'w-3 h-3':'w-4 h-4';return <div className={`relative ${small?'w-9 h-7':'w-12 h-9'} mx-auto`}><span className={`absolute left-1/2 top-0 -translate-x-1/2 rotate-45 ${size} border ${second?'bg-[#65f2b5] border-[#65f2b5]':'border-[#73839a]'}`}/><span className={`absolute right-0 top-1/2 -translate-y-1/2 rotate-45 ${size} border ${first?'bg-[#65f2b5] border-[#65f2b5]':'border-[#73839a]'}`}/><span className={`absolute left-0 top-1/2 -translate-y-1/2 rotate-45 ${size} border ${third?'bg-[#65f2b5] border-[#65f2b5]':'border-[#73839a]'}`}/></div>};

const LivePlayer=({player,boxPlayer,role,align,subtitle}:{player:any;boxPlayer:any;role:string;align:'left'|'right';subtitle:string})=><div className={`flex items-center gap-2 min-w-0 ${align==='right'?'flex-row-reverse text-right':''}`}><img src={player?.id?mlbPlayerHeadshotUrl(player.id,160):''} alt="" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-contain bg-[#dfe7f2] shrink-0"/><div className="min-w-0"><p className="text-[9px] text-[#00e6f4] font-bold">{role}</p><p className="text-sm font-bold truncate">{boxPlayer?.person?.fullName??player?.fullName??player?.name??'—'}</p><p className="text-[10px] text-[#8fa0b7] truncate">{subtitle}</p></div></div>;

const MatchupPlayer=({player,role,stat}:{player:any;role:string;stat:string})=><div className="text-center min-w-0"><img src={player?.id?mlbPlayerHeadshotUrl(player.id,240):''} alt="" className="mx-auto w-20 h-20 sm:w-28 sm:h-28 rounded-xl object-contain bg-[#dfe7f2]"/><p className="text-[9px] text-[#00e6f4] font-bold mt-2">{role}</p><p className="font-bold text-sm sm:text-lg truncate">{player?.fullName??player?.name??'—'}</p><p className="text-[10px] sm:text-xs text-[#8fa0b7] mt-1">{stat}</p></div>;

const LiveStat=({label,value}:{label:string;value:any})=><div className="rounded-xl border border-[#2b405b] bg-[#0d1727] p-3 sm:p-4"><p className="text-[9px] text-[#8fa0b7] font-bold">{label}</p><p className="font-mono text-xl sm:text-2xl mt-1 text-[#e7f4ff]">{value}</p></div>;
const Info=({label,value}:{label:string;value:any})=><div><p className="text-[9px] text-[#00e6f4] font-bold">{label}</p><p className="mt-1 text-[#c2cee0]">{value??'—'}</p></div>;

const InningScore=({linescore,awayTeam,homeTeam}:{linescore:any;awayTeam:any;homeTeam:any})=>{const innings=(linescore?.innings??[]).slice(0,9);while(innings.length<9)innings.push({num:innings.length+1});const cols=`52px repeat(9,minmax(19px,1fr)) 28px 28px 28px`;const row=(side:'away'|'home',team:any)=><div className="grid items-center text-center text-[10px] sm:text-xs" style={{gridTemplateColumns:cols}}><div className="text-left font-bold truncate pr-1">{team?.abbreviation??shortName(team?.teamName??team?.name)}</div>{innings.map((inning:any,index:number)=><div key={index} className={inning?.[side]?.runs!=null?'text-[#e7f4ff]':'text-[#526178]'}>{inning?.[side]?.runs??'·'}</div>)}<div className="font-bold">{num(linescore?.teams?.[side]?.runs,0)}</div><div>{num(linescore?.teams?.[side]?.hits,0)}</div><div>{num(linescore?.teams?.[side]?.errors,0)}</div></div>;return <section className="rounded-2xl border border-[#2b405b] bg-[#0d1727] p-3 sm:p-4 overflow-hidden"><div className="grid text-center text-[9px] sm:text-[10px] text-[#8fa0b7] mb-2" style={{gridTemplateColumns:cols}}><div/><>{innings.map((_:any,index:number)=><div key={index}>{index+1}</div>)}</><div>R</div><div>H</div><div>E</div></div><div className="space-y-2">{row('away',awayTeam)}{row('home',homeTeam)}</div></section>};

const BatterTable=({players,activeBatterId}:{players:any[];activeBatterId?:number})=><div className="w-full text-[10px] sm:text-xs"><div className="grid grid-cols-[minmax(90px,1.6fr)_repeat(5,minmax(28px,.45fr))] sm:grid-cols-[minmax(130px,1.7fr)_repeat(7,minmax(40px,.5fr))] gap-1 px-2 py-2 text-[#8fa0b7] border-b border-[#26364e]"><span>PLAYER</span><span className="text-center">AB</span><span className="text-center">R</span><span className="text-center">H</span><span className="text-center">RBI</span><span className="text-center">K</span><span className="hidden sm:block text-center">BB</span><span className="hidden sm:block text-center">OPS</span></div>{players.length?players.map((p:any)=>{const s=p?.stats?.batting??{};const isActive=Boolean(activeBatterId&&p?.person?.id===activeBatterId);return <div key={p?.person?.id} className={`grid grid-cols-[minmax(90px,1.6fr)_repeat(5,minmax(28px,.45fr))] sm:grid-cols-[minmax(130px,1.7fr)_repeat(7,minmax(40px,.5fr))] gap-1 px-2 py-2.5 border-b last:border-0 items-center transition-colors ${isActive?'border-[#00e6f4]/30 bg-[#00e6f4]/10 text-[#f2fdff] shadow-[inset_3px_0_0_#00e6f4]':'border-[#1c2b40]'}`}><span className={`font-semibold min-w-0 flex items-center gap-2 ${isActive?'text-[#e8fdff]':''}`}><span className="truncate">{p?.person?.fullName??'—'} <span className={isActive?'text-[#9feaf1] font-normal':'text-[#7f8ea3] font-normal'}>{p?.position?.abbreviation??''}</span></span>{isActive&&<span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full border border-[#00e6f4]/35 bg-[#00e6f4]/10 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-[#00e6f4]"><span className="h-1.5 w-1.5 rounded-full bg-[#00e6f4] animate-pulse"/>AT BAT</span>}</span><span className="text-center">{num(s.atBats,0)}</span><span className="text-center">{num(s.runs,0)}</span><span className="text-center">{num(s.hits,0)}</span><span className="text-center">{num(s.rbi,0)}</span><span className="text-center">{num(s.strikeOuts,0)}</span><span className="hidden sm:block text-center">{num(s.baseOnBalls,0)}</span><span className="hidden sm:block text-center">{s.ops??'—'}</span></div>}):<p className="py-4 text-[#8fa0b7]">Batting lines will populate when available.</p>}</div>;

const PitcherTable=({players}:{players:any[]})=><div className="w-full text-[10px] sm:text-xs"><div className="grid grid-cols-[minmax(90px,1.5fr)_repeat(6,minmax(27px,.45fr))] sm:grid-cols-[minmax(130px,1.7fr)_repeat(7,minmax(38px,.5fr))] gap-1 px-2 py-2 text-[#8fa0b7] border-b border-[#26364e]"><span>PLAYER</span><span className="text-center">IP</span><span className="text-center">H</span><span className="text-center">R</span><span className="text-center">ER</span><span className="text-center">BB</span><span className="text-center">K</span><span className="hidden sm:block text-center">ERA</span></div>{players.length?players.map((p:any)=>{const s=p?.stats?.pitching??{};return <div key={p?.person?.id} className="grid grid-cols-[minmax(90px,1.5fr)_repeat(6,minmax(27px,.45fr))] sm:grid-cols-[minmax(130px,1.7fr)_repeat(7,minmax(38px,.5fr))] gap-1 px-2 py-2.5 border-b border-[#1c2b40] last:border-0 items-center"><span className="font-semibold truncate">{p?.person?.fullName??'—'}</span><span className="text-center">{num(s.inningsPitched,0)}</span><span className="text-center">{num(s.hits,0)}</span><span className="text-center">{num(s.runs,0)}</span><span className="text-center">{num(s.earnedRuns,0)}</span><span className="text-center">{num(s.baseOnBalls,0)}</span><span className="text-center">{num(s.strikeOuts,0)}</span><span className="hidden sm:block text-center">{s.era??'—'}</span></div>}):<p className="py-4 text-[#8fa0b7]">Pitching lines will populate when available.</p>}</div>;
