import React, { useEffect, useMemo, useState } from 'react';
import { fetchPlayerProfile, currentSeason } from '../services/profileClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

interface Props { playerId: number | null; onOpenTeam: (teamId: number) => void; }

export const PlayerProfileView: React.FC<Props> = ({ playerId, onOpenTeam }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCareer, setShowCareer] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetchPlayerProfile(playerId).then(setData).finally(() => setLoading(false));
  }, [playerId]);

  const cards = useMemo(() => {
    if (!data) return [];
    const s = data.season ?? {};
    return data.group === 'pitching'
      ? [['G', s.gamesPlayed], ['W-L', `${s.wins ?? 0}-${s.losses ?? 0}`], ['ERA', s.era], ['IP', s.inningsPitched], ['SO', s.strikeOuts], ['WHIP', s.whip]]
      : [['G', s.gamesPlayed], ['AVG', s.avg], ['HR', s.homeRuns], ['RBI', s.rbi], ['H', s.hits], ['OPS', s.ops]];
  }, [data]);

  if (!playerId) return <div className="p-8 text-[#849495]">Search for a player to open a profile.</div>;
  if (loading || !data) return <div className="p-8 text-[#849495]">Loading player profile…</div>;

  const c = data.career ?? {};
  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto space-y-6">
      <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl p-6 flex items-center gap-6">
        <img src={mlbPlayerHeadshotUrl(data.id, 240)} alt={data.name} className="w-36 h-36 object-contain" />
        <div className="flex-1">
          <div className="text-[11px] tracking-[.18em] text-[#65f2b5] font-mono uppercase">Player Profile</div>
          <h1 className="text-4xl font-bold mt-1">{data.name}</h1>
          <div className="text-[#b9cacb] mt-2 flex items-center gap-3 flex-wrap">
            <span>{data.position}</span><span>·</span><span>{data.group === 'pitching' ? `${data.pitchHand ?? '—'}HP` : `${data.batSide ?? '—'}HB`}</span>
            {data.team && <button onClick={() => onOpenTeam(data.team.id)} className="inline-flex items-center gap-2 text-[#00f0ff] hover:underline"><img src={mlbTeamLogoUrl(data.team.id)} className="w-6 h-6 object-contain" />{data.team.name}</button>}
          </div>
        </div>
        <button onClick={() => setShowCareer(!showCareer)} className="w-9 h-9 rounded-full border border-[#3b494b] text-[#00f0ff]" title="Career regular season stats">i</button>
      </section>

      {showCareer && <section className="bg-[#10192c] border border-[#00f0ff]/25 rounded-2xl p-5"><div className="text-xs text-[#00f0ff] uppercase tracking-wider mb-3">Career Regular Season</div><div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">{data.group === 'pitching' ? <><Stat l="G" v={c.gamesPlayed}/><Stat l="W-L" v={`${c.wins ?? 0}-${c.losses ?? 0}`}/><Stat l="ERA" v={c.era}/><Stat l="IP" v={c.inningsPitched}/><Stat l="SO" v={c.strikeOuts}/><Stat l="WHIP" v={c.whip}/></> : <><Stat l="G" v={c.gamesPlayed}/><Stat l="AVG" v={c.avg}/><Stat l="HR" v={c.homeRuns}/><Stat l="RBI" v={c.rbi}/><Stat l="H" v={c.hits}/><Stat l="OPS" v={c.ops}/></>}</div></section>}

      <section>
        <div className="text-xs text-[#00f0ff] uppercase tracking-wider mb-3">{currentSeason()} Regular Season</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{cards.map(([l,v]: any) => <div key={l} className="bg-[#171f33] border border-[#3b494b]/25 rounded-xl p-4"><div className="text-[10px] text-[#849495]">{l}</div><div className="text-2xl font-mono mt-2">{v ?? '—'}</div></div>)}</div>
      </section>

      <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-[#3b494b]/25"><div className="text-[10px] text-[#00f0ff] uppercase tracking-wider">Recent Game Log</div><h2 className="text-xl font-semibold">Last 30 games</h2></div>
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm"><thead className="sticky top-0 bg-[#10192c] text-[#849495]"><tr><th className="text-left p-3">DATE</th><th className="text-left p-3">OPP</th>{data.group === 'pitching' ? <><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>SO</th></> : <><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>SO</th></>}</tr></thead><tbody>{data.logs.map((g:any, i:number) => <tr key={`${g.date}-${i}`} className="border-t border-[#3b494b]/20"><td className="p-3">{g.date}</td><td className="p-3">{g.opponent}</td>{data.group === 'pitching' ? <><td className="text-center">{g.stat.inningsPitched ?? '—'}</td><td className="text-center">{g.stat.hits ?? '—'}</td><td className="text-center">{g.stat.earnedRuns ?? '—'}</td><td className="text-center">{g.stat.baseOnBalls ?? '—'}</td><td className="text-center">{g.stat.strikeOuts ?? '—'}</td></> : <><td className="text-center">{g.stat.atBats ?? '—'}</td><td className="text-center">{g.stat.runs ?? '—'}</td><td className="text-center">{g.stat.hits ?? '—'}</td><td className="text-center">{g.stat.homeRuns ?? '—'}</td><td className="text-center">{g.stat.rbi ?? '—'}</td><td className="text-center">{g.stat.strikeOuts ?? '—'}</td></>}</tr>)}</tbody></table>
        </div>
      </section>
    </div>
  );
};

const Stat = ({l,v}:{l:string;v:any}) => <div className="bg-[#171f33] rounded-lg p-3"><div className="text-[10px] text-[#849495]">{l}</div><div className="font-mono text-lg mt-1">{v ?? '—'}</div></div>;
