import React, { useMemo, useState } from 'react';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

type Side = 'away' | 'home';

type LiveBoxScorePanelProps = {
  feed: any;
  onClose: () => void;
};

const n = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown, fallback = '—') => {
  const result = String(value ?? '').trim();
  return result || fallback;
};

const playerName = (row: any) => row?.person?.fullName ?? row?.fullName ?? row?.name ?? 'MLB Player';
const teamLabel = (team: any) => team?.teamName ?? team?.name ?? team?.abbreviation ?? 'TEAM';
const teamShort = (team: any) => team?.abbreviation ?? team?.teamName ?? team?.name ?? 'TEAM';

const idsFrom = (value: unknown): number[] => Array.isArray(value)
  ? value.map((item) => Number(typeof item === 'object' ? item?.id ?? item?.person?.id : item)).filter(Number.isFinite)
  : [];

const playerRows = (teamBox: any, ids: number[]) => ids
  .map((id) => teamBox?.players?.[`ID${id}`])
  .filter(Boolean);

const formatAvg = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  return raw.startsWith('0.') ? raw.slice(1) : raw;
};

const inningsPitched = (value: unknown) => text(value, '0.0');

const buildPitchSummary = (rows: any[]) => rows
  .filter((row) => row?.stats?.pitching)
  .map((row) => `${playerName(row)} ${n(row.stats.pitching.strikes)}-${n(row.stats.pitching.numberOfPitches)}`)
  .join('; ');

const buildGroundoutSummary = (rows: any[]) => rows
  .filter((row) => row?.stats?.pitching)
  .map((row) => `${playerName(row)} ${n(row.stats.pitching.groundOuts)}-${n(row.stats.pitching.airOuts)}`)
  .join('; ');

const BatterTable = ({ rows, team }: { rows: any[]; team: any }) => {
  const totals = rows.reduce((sum, row) => {
    const s = row?.stats?.batting ?? {};
    sum.ab += n(s.atBats);
    sum.r += n(s.runs);
    sum.h += n(s.hits);
    sum.rbi += n(s.rbi);
    sum.bb += n(s.baseOnBalls);
    sum.k += n(s.strikeOuts);
    return sum;
  }, { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, k: 0 });

  return <section className="overflow-hidden rounded-2xl border border-[#263a54] bg-[#0a1424]">
    <div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#65f2b5]">Batters · {teamShort(team)}</p>
        <p className="mt-1 text-[10px] text-[#73849a]">Live game line + season AVG / OPS</p>
      </div>
      <img src={mlbTeamLogoUrl(team?.id)} alt="" className="h-8 w-8 object-contain" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[11px]">
        <thead className="border-b border-[#26364e] bg-[#07101d] text-[#718198]"><tr><th className="px-4 py-2.5 text-left">BATTER</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th><th>AVG</th><th className="pr-4">OPS</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => {
            const live = row?.stats?.batting ?? {};
            const season = row?.seasonStats?.batting ?? {};
            return <tr key={row?.person?.id ?? index} className="border-b border-[#1c2c42] last:border-0">
              <td className="px-4 py-3"><div className="flex items-center gap-2.5"><img src={mlbPlayerHeadshotUrl(row?.person?.id, 80)} alt="" className="h-9 w-9 rounded-lg bg-[#e5eaef] object-contain"/><div className="min-w-0"><p className="truncate font-black text-white">{playerName(row)}</p><p className="mt-0.5 text-[9px] text-[#718198]">{text(row?.position?.abbreviation, '')}</p></div></div></td>
              <td className="text-center font-mono text-[#c6d2e2]">{n(live.atBats)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.runs)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.hits)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.rbi)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.baseOnBalls)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.strikeOuts)}</td><td className="text-center font-mono font-bold text-[#65f2b5]">{formatAvg(season.avg)}</td><td className="pr-4 text-center font-mono font-bold text-[#00e6f4]">{formatAvg(season.ops)}</td>
            </tr>;
          }) : <tr><td colSpan={9} className="px-4 py-8 text-center text-[#718198]">No batter data available yet.</td></tr>}
          {rows.length > 0 && <tr className="bg-[#0d192a] font-black text-white"><td className="px-4 py-3">Totals</td><td className="text-center">{totals.ab}</td><td className="text-center">{totals.r}</td><td className="text-center">{totals.h}</td><td className="text-center">{totals.rbi}</td><td className="text-center">{totals.bb}</td><td className="text-center">{totals.k}</td><td/><td/></tr>}
        </tbody>
      </table>
    </div>
  </section>;
};

const PitcherTable = ({ rows, team }: { rows: any[]; team: any }) => (
  <section className="overflow-hidden rounded-2xl border border-[#263a54] bg-[#0a1424]">
    <div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#00e6f4]">Pitchers · {teamShort(team)}</p><p className="mt-1 text-[10px] text-[#73849a]">Current game pitching line + season ERA</p></div>
      <img src={mlbTeamLogoUrl(team?.id)} alt="" className="h-8 w-8 object-contain" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-[11px]">
        <thead className="border-b border-[#26364e] bg-[#07101d] text-[#718198]"><tr><th className="px-4 py-2.5 text-left">PITCHER</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th className="pr-4">ERA</th></tr></thead>
        <tbody>{rows.length ? rows.map((row, index) => {
          const live = row?.stats?.pitching ?? {};
          const season = row?.seasonStats?.pitching ?? {};
          return <tr key={row?.person?.id ?? index} className="border-b border-[#1c2c42] last:border-0"><td className="px-4 py-3"><div className="flex items-center gap-2.5"><img src={mlbPlayerHeadshotUrl(row?.person?.id, 80)} alt="" className="h-9 w-9 rounded-lg bg-[#e5eaef] object-contain"/><div><p className="font-black text-white">{playerName(row)}</p><p className="mt-0.5 text-[9px] text-[#718198]">{text(row?.pitchHand?.code ?? row?.person?.pitchHand?.code, '')}</p></div></div></td><td className="text-center font-mono text-[#c6d2e2]">{inningsPitched(live.inningsPitched)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.hits)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.runs)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.earnedRuns)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.baseOnBalls)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.strikeOuts)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(live.homeRuns)}</td><td className="pr-4 text-center font-mono font-bold text-[#65f2b5]">{text(season.era)}</td></tr>;
        }) : <tr><td colSpan={9} className="px-4 py-8 text-center text-[#718198]">No pitcher data available yet.</td></tr>}</tbody>
      </table>
    </div>
  </section>
);

const RosterTable = ({ title, rows }: { title: string; rows: any[] }) => (
  <section className="overflow-hidden rounded-2xl border border-[#263a54] bg-[#0a1424]">
    <div className="border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#91a2b8]">{title}</p></div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-[11px]"><thead className="border-b border-[#26364e] bg-[#07101d] text-[#718198]"><tr><th className="px-4 py-2.5 text-left">PLAYER</th><th>B</th><th>POS</th><th>AVG</th><th>G</th><th>R</th><th>H</th><th className="pr-4">HR</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => { const season = row?.seasonStats?.batting ?? {}; return <tr key={row?.person?.id ?? index} className="border-b border-[#1c2c42] last:border-0"><td className="px-4 py-2.5 font-bold text-white">{playerName(row)}</td><td className="text-center text-[#9dacbf]">{text(row?.batSide?.code ?? row?.person?.batSide?.code, '')}</td><td className="text-center text-[#9dacbf]">{text(row?.position?.abbreviation, '')}</td><td className="text-center font-mono text-[#c6d2e2]">{formatAvg(season.avg)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(season.gamesPlayed)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(season.runs)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(season.hits)}</td><td className="pr-4 text-center font-mono text-[#c6d2e2]">{n(season.homeRuns)}</td></tr>; }) : <tr><td colSpan={8} className="px-4 py-6 text-center text-[#718198]">No players listed.</td></tr>}</tbody></table>
    </div>
  </section>
);

const BullpenTable = ({ rows }: { rows: any[] }) => (
  <section className="overflow-hidden rounded-2xl border border-[#263a54] bg-[#0a1424]">
    <div className="border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#91a2b8]">Bullpen</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[11px]"><thead className="border-b border-[#26364e] bg-[#07101d] text-[#718198]"><tr><th className="px-4 py-2.5 text-left">PITCHER</th><th>T</th><th>ERA</th><th>IP</th><th>H</th><th>BB</th><th className="pr-4">K</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => { const s = row?.seasonStats?.pitching ?? {}; return <tr key={row?.person?.id ?? index} className="border-b border-[#1c2c42] last:border-0"><td className="px-4 py-2.5 font-bold text-white">{playerName(row)}</td><td className="text-center text-[#9dacbf]">{text(row?.pitchHand?.code ?? row?.person?.pitchHand?.code, '')}</td><td className="text-center font-mono text-[#65f2b5]">{text(s.era)}</td><td className="text-center font-mono text-[#c6d2e2]">{text(s.inningsPitched)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(s.hits)}</td><td className="text-center font-mono text-[#c6d2e2]">{n(s.baseOnBalls)}</td><td className="pr-4 text-center font-mono text-[#c6d2e2]">{n(s.strikeOuts)}</td></tr>; }) : <tr><td colSpan={7} className="px-4 py-6 text-center text-[#718198]">No bullpen players listed.</td></tr>}</tbody></table></div>
  </section>
);

export const LiveBoxScorePanel: React.FC<LiveBoxScorePanelProps> = ({ feed, onClose }) => {
  const [side, setSide] = useState<Side>('away');
  const gameData = feed?.gameData ?? {};
  const liveData = feed?.liveData ?? {};
  const boxscore = liveData?.boxscore ?? {};
  const linescore = liveData?.linescore ?? {};
  const team = side === 'away' ? gameData?.teams?.away : gameData?.teams?.home;
  const teamBox = boxscore?.teams?.[side] ?? {};

  const batterIds = useMemo(() => idsFrom(teamBox?.batters), [teamBox?.batters]);
  const pitcherIds = useMemo(() => idsFrom(teamBox?.pitchers), [teamBox?.pitchers]);
  const benchIds = useMemo(() => idsFrom(teamBox?.bench), [teamBox?.bench]);
  const bullpenIds = useMemo(() => idsFrom(teamBox?.bullpen), [teamBox?.bullpen]);
  const batters = useMemo(() => playerRows(teamBox, batterIds), [teamBox, batterIds]);
  const pitchers = useMemo(() => playerRows(teamBox, pitcherIds), [teamBox, pitcherIds]);
  const bench = useMemo(() => playerRows(teamBox, benchIds), [teamBox, benchIds]);
  const bullpen = useMemo(() => playerRows(teamBox, bullpenIds), [teamBox, bullpenIds]);
  const awayTeam = gameData?.teams?.away ?? {};
  const homeTeam = gameData?.teams?.home ?? {};
  const gameInfo = gameData?.gameInfo ?? {};
  const weather = gameData?.weather ?? {};
  const venue = gameData?.venue ?? {};
  const officials = Array.isArray(boxscore?.officials) ? boxscore.officials : [];
  const dateValue = gameData?.datetime?.dateTime ?? gameData?.datetime?.officialDate ?? gameData?.officialDate;
  const dateLabel = dateValue ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(dateValue)) : '—';
  const firstPitch = dateValue ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(dateValue)) : '—';
  const pitchSummary = buildPitchSummary(pitchers);
  const groundoutSummary = buildGroundoutSummary(pitchers);

  return <div className="fixed inset-0 z-[290] bg-[#020712]/85 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Full box score">
    <section className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[24px] border border-[#2b405b] bg-[#07101f] text-[#d8e2f0] shadow-2xl">
      <header className="shrink-0 border-b border-[#26364e] bg-[#0a1424]">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#00e6f4]">ScoutCore Full Box Score</p><p className="mt-1 text-[10px] text-[#718198]">Verified MLB boxscore data from the live game feed</p></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#40516b] bg-[#10192b] text-[#c9d5e4] hover:border-[#00e6f4]" aria-label="Close box score"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="flex items-center gap-1 px-3 pb-3 sm:px-5">
          {([['away', awayTeam], ['home', homeTeam]] as [Side, any][]).map(([value, item]) => <button key={value} type="button" onClick={() => setSide(value)} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-black transition ${side === value ? 'border-[#00e6f4] bg-[#00e6f4]/10 text-white' : 'border-[#26364e] bg-[#08111f] text-[#7f90a6] hover:border-[#40516b]'}`}><img src={mlbTeamLogoUrl(item?.id)} alt="" className="h-7 w-7 object-contain"/><span className="truncate">{teamLabel(item)}</span></button>)}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
        <div className="space-y-4">
          <BatterTable rows={batters} team={team} />
          <PitcherTable rows={pitchers} team={team} />

          <section className="rounded-2xl border border-[#263a54] bg-[#0a1424] p-4 text-[11px] leading-6 text-[#aab8ca]">
            <p><span className="font-black text-white">Pitches-strikes:</span> {pitchSummary || 'Waiting for pitch totals.'}</p>
            <p><span className="font-black text-white">Groundouts-flyouts:</span> {groundoutSummary || 'Waiting for batted-ball totals.'}</p>
            <p><span className="font-black text-white">Umpires:</span> {officials.length ? officials.map((item: any) => `${item?.officialType ?? 'Ump'}: ${item?.official?.fullName ?? '—'}`).join(' · ') : '—'}</p>
            <p><span className="font-black text-white">Weather:</span> {weather?.temp ? `${weather.temp}° · ${text(weather.condition, '')}` : text(weather?.condition)}</p>
            <p><span className="font-black text-white">Wind:</span> {text(weather?.wind)}</p>
            <p><span className="font-black text-white">First pitch:</span> {firstPitch}</p>
            <p><span className="font-black text-white">Venue:</span> {text(venue?.name)}</p>
            <p><span className="font-black text-white">Attendance:</span> {gameInfo?.attendance ? Number(gameInfo.attendance).toLocaleString() : '—'}</p>
            <p className="mt-1 font-black text-[#65f2b5]">{dateLabel}</p>
            <p className="mt-2 text-[9px] leading-4 text-[#607086]">Current line score: {teamShort(awayTeam)} {n(linescore?.teams?.away?.runs)} · {teamShort(homeTeam)} {n(linescore?.teams?.home?.runs)}</p>
          </section>

          <RosterTable title={`Bench · ${teamShort(team)}`} rows={bench} />
          <BullpenTable rows={bullpen} />
        </div>
      </div>
    </section>
  </div>;
};
