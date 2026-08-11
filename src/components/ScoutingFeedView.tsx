import React, { useEffect, useState } from 'react';

const dateKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

const labelDate = (key: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date(`${key}T12:00:00Z`));

async function fetchJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
}

function playerName(entry: any) {
  return entry?.person?.fullName ?? entry?.fullName ?? 'Unknown player';
}

function buildGameSignals(feed: any, selectedDate: string) {
  const rows: any[] = [];
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  const gameData = feed?.gameData ?? {};
  const gamePk = gameData?.game?.pk ?? feed?.gamePk ?? gameData?.gamePk ?? Math.random();

  (['away', 'home'] as const).forEach((side) => {
    const teamBlock = teams?.[side] ?? {};
    const teamName = teamBlock?.team?.name ?? gameData?.teams?.[side]?.name ?? 'Unknown Team';
    const players = Object.values(teamBlock?.players ?? {}) as any[];

    const hitters = players
      .filter((p: any) => p?.stats?.batting && Number(p.stats.batting.plateAppearances ?? 0) > 0)
      .map((p: any) => {
        const s = p.stats.batting ?? {};
        const hits = Number(s.hits ?? 0);
        const hr = Number(s.homeRuns ?? 0);
        const rbi = Number(s.rbi ?? 0);
        const walks = Number(s.baseOnBalls ?? 0);
        const totalBases = Number(s.totalBases ?? 0);
        const score = hits * 12 + hr * 20 + rbi * 7 + walks * 4 + totalBases * 2;
        return { p, s, score };
      })
      .filter((x: any) => x.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 2);

    hitters.forEach(({ p, s, score }: any, index: number) => {
      const hits = Number(s.hits ?? 0);
      const hr = Number(s.homeRuns ?? 0);
      const rbi = Number(s.rbi ?? 0);
      const runs = Number(s.runs ?? 0);
      const ab = Number(s.atBats ?? 0);
      const pieces = [`${hits} H`];
      if (hr) pieces.push(`${hr} HR`);
      if (rbi) pieces.push(`${rbi} RBI`);
      if (runs) pieces.push(`${runs} R`);
      rows.push({
        id: `${selectedDate}-${gamePk}-${side}-bat-${p.person?.id ?? index}`,
        date: selectedDate,
        player: playerName(p),
        team: teamName,
        type: 'MATCHUP EDGE',
        severity: score >= 55 ? 'HIGH' : 'MEDIUM',
        score: Math.min(95, Math.max(60, Math.round(58 + score / 2))),
        confidence: 100,
        description: `Actual game result: ${pieces.join(', ')} in ${ab} AB. This card summarizes verified box-score production from this game.`,
      });
    });

    const pitchers = players
      .filter((p: any) => p?.stats?.pitching && Number(p.stats.pitching.inningsPitched ?? 0) > 0)
      .map((p: any) => {
        const s = p.stats.pitching ?? {};
        const ip = Number.parseFloat(String(s.inningsPitched ?? '0')) || 0;
        const so = Number(s.strikeOuts ?? 0);
        const er = Number(s.earnedRuns ?? 0);
        const hits = Number(s.hits ?? 0);
        const walks = Number(s.baseOnBalls ?? 0);
        const score = ip * 7 + so * 6 - er * 10 - hits * 2 - walks * 2;
        return { p, s, score };
      })
      .filter((x: any) => x.score >= 18)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 1);

    pitchers.forEach(({ p, s, score }: any, index: number) => {
      rows.push({
        id: `${selectedDate}-${gamePk}-${side}-pit-${p.person?.id ?? index}`,
        date: selectedDate,
        player: playerName(p),
        team: teamName,
        type: 'PITCHER EDGE',
        severity: score >= 45 ? 'HIGH' : 'MEDIUM',
        score: Math.min(95, Math.max(60, Math.round(60 + score / 2))),
        confidence: 100,
        description: `Actual game result: ${s.inningsPitched ?? '—'} IP, ${s.hits ?? 0} H, ${s.earnedRuns ?? 0} ER, ${s.baseOnBalls ?? 0} BB, ${s.strikeOuts ?? 0} K.`,
      });
    });
  });

  return rows;
}

export const ScoutingFeedView: React.FC = () => {
  const [signals, setSignals] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [day, setDay] = useState<'TODAY' | 'YESTERDAY'>('TODAY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedDate = day === 'TODAY' ? dateKey(0) : dateKey(-1);
      const schedule = await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${selectedDate}`);
      const games = (schedule?.dates ?? []).flatMap((d: any) => d.games ?? []);
      const feeds = await Promise.all(games.slice(0, 15).map((game: any) => fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`).catch(() => null)));
      const rows = feeds.filter(Boolean).flatMap((feed: any) => buildGameSignals(feed, selectedDate));
      setSignals(rows.sort((a: any, b: any) => b.score - a.score));
    } catch (e) {
      setSignals([]);
      setError(e instanceof Error ? e.message : 'Unable to load scouting feed.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const timer = window.setInterval(load, 10 * 60 * 1000); return () => window.clearInterval(timer); }, [day]);
  const filtered = signals.filter((s) => filter === 'ALL' || s.type === filter);
  const selectedDate = day === 'TODAY' ? dateKey(0) : dateKey(-1);

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap justify-between gap-4 border-b border-[#3b494b]/20 pb-6"><div><span className="font-label-caps text-xs text-[#00f0ff]">AUTOMATED MLB FEED</span><h1 className="font-display-lg text-4xl">Scouting Signal Feed</h1><p className="text-sm text-[#849495] mt-1">Today shows available in-game results; Yesterday summarizes verified MLB box-score performances.</p></div><div className="flex flex-col items-end gap-2"><div className="flex gap-2 bg-[#131b2e] p-1.5 rounded-xl">{['TODAY','YESTERDAY'].map((item) => <button key={item} onClick={() => setDay(item as 'TODAY' | 'YESTERDAY')} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${day === item ? 'bg-[#00f0ff] text-[#00363a]' : 'text-[#849495]'}`}>{item}</button>)}</div><span className="text-xs text-[#849495]">{labelDate(selectedDate)} · ET</span></div></div>
    <div className="flex gap-2 bg-[#131b2e] p-1.5 rounded-xl max-w-max">{['ALL','MATCHUP EDGE','PITCHER EDGE'].map((cat) => <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs ${filter === cat ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#849495]'}`}>{cat}</button>)}</div>
    {error && <div className="p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-sm">{error}</div>}
    {loading ? <div className="text-[#849495]">Loading verified MLB performances…</div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map((signal) => <div key={signal.id} className="p-5 bg-[#171f33] rounded-xl border border-[#3b494b]/20"><div className="flex justify-between"><span className="text-[10px] text-[#00f0ff] font-bold">{signal.type}</span><span className={`text-[10px] ${signal.severity === 'HIGH' ? 'text-[#ffb4ab]' : 'text-[#65f2b5]'}`}>{signal.severity}</span></div><h3 className="font-bold mt-2">{signal.player} <span className="text-[#849495] font-normal">· {signal.team}</span></h3><p className="text-xs text-[#b9cacb] mt-2 leading-relaxed">{signal.description}</p><div className="flex gap-5 mt-4 text-[10px] text-[#849495]"><span>PERFORMANCE INDEX <b className="text-[#dbfcff]">{signal.score}</b></span><span>DATA <b className="text-[#65f2b5]">VERIFIED</b></span></div></div>)}{!filtered.length && <div className="col-span-full p-8 bg-[#171f33] rounded-xl text-center text-[#849495]">No qualifying player performances are available for {day === 'TODAY' ? 'today yet' : 'yesterday'}.</div>}</div>}
  </div>;
};
