import React, { useEffect, useMemo, useState } from 'react';
import { fetchPlayerProfile, currentSeason } from '../services/profileClient';
import { fetchRecentPitchProfile } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

interface Props { playerId: number | null; onOpenTeam: (teamId: number) => void; }

const pitchColors = [
  { ball: 'bg-[#5eead4]', glow: 'shadow-[0_0_20px_rgba(94,234,212,.55)]', text: 'text-[#5eead4]' },
  { ball: 'bg-[#60a5fa]', glow: 'shadow-[0_0_20px_rgba(96,165,250,.55)]', text: 'text-[#60a5fa]' },
  { ball: 'bg-[#fb7185]', glow: 'shadow-[0_0_20px_rgba(251,113,133,.55)]', text: 'text-[#fb7185]' },
  { ball: 'bg-[#a78bfa]', glow: 'shadow-[0_0_20px_rgba(167,139,250,.55)]', text: 'text-[#a78bfa]' },
  { ball: 'bg-[#fbbf24]', glow: 'shadow-[0_0_20px_rgba(251,191,36,.55)]', text: 'text-[#fbbf24]' },
  { ball: 'bg-[#34d399]', glow: 'shadow-[0_0_20px_rgba(52,211,153,.55)]', text: 'text-[#34d399]' },
];

const pitchPositions = [
  { left: '18%', top: '24%' }, { left: '63%', top: '17%' }, { left: '39%', top: '60%' },
  { left: '76%', top: '57%' }, { left: '13%', top: '68%' }, { left: '52%', top: '38%' },
];

export const PlayerProfileView: React.FC<Props> = ({ playerId, onOpenTeam }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pitchProfile, setPitchProfile] = useState<any[]>([]);
  const [pitchLoading, setPitchLoading] = useState(false);

  useEffect(() => { if (!playerId) return; setLoading(true); setPitchProfile([]); fetchPlayerProfile(playerId).then(setData).finally(() => setLoading(false)); }, [playerId]);
  useEffect(() => { if (!playerId || data?.group !== 'pitching') return; setPitchLoading(true); fetchRecentPitchProfile(playerId, 5).then(setPitchProfile).catch(() => setPitchProfile([])).finally(() => setPitchLoading(false)); }, [playerId, data?.group]);

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

  return <div className="px-8 py-8 max-w-[1280px] mx-auto space-y-6">
    <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl p-6 flex items-center gap-6"><img src={mlbPlayerHeadshotUrl(data.id,240)} alt={data.name} className="w-36 h-36 object-contain"/><div className="flex-1"><div className="text-[11px] tracking-[.18em] text-[#65f2b5] font-mono uppercase">Player Profile</div><h1 className="text-4xl font-bold mt-1">{data.name}</h1><div className="text-[#b9cacb] mt-2 flex items-center gap-3 flex-wrap"><span>{data.position}</span><span>·</span><span>{data.group === 'pitching' ? `${data.pitchHand ?? '—'}HP` : `${data.batSide ?? '—'}HB`}</span>{data.team && <button onClick={()=>onOpenTeam(data.team.id)} className="inline-flex items-center gap-2 text-[#00f0ff] hover:underline"><img src={mlbTeamLogoUrl(data.team.id)} className="w-6 h-6 object-contain"/>{data.team.name}</button>}</div></div></section>

    <section className="bg-[#10192c] border border-[#00f0ff]/25 rounded-2xl p-5"><div className="text-xs text-[#00f0ff] uppercase tracking-wider mb-3">Career Regular Season</div><div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">{data.group==='pitching'?<><Stat l="G" v={c.gamesPlayed}/><Stat l="W-L" v={`${c.wins??0}-${c.losses??0}`}/><Stat l="ERA" v={c.era}/><Stat l="IP" v={c.inningsPitched}/><Stat l="SO" v={c.strikeOuts}/><Stat l="WHIP" v={c.whip}/></>:<><Stat l="G" v={c.gamesPlayed}/><Stat l="AVG" v={c.avg}/><Stat l="HR" v={c.homeRuns}/><Stat l="RBI" v={c.rbi}/><Stat l="H" v={c.hits}/><Stat l="OPS" v={c.ops}/></>}</div></section>

    <section><div className="text-xs text-[#00f0ff] uppercase tracking-wider mb-3">{currentSeason()} Regular Season</div><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">{cards.map(([l,v]:any)=><div key={l} className="bg-[#171f33] border border-[#3b494b]/25 rounded-xl p-4"><div className="text-[10px] text-[#849495]">{l}</div><div className="text-2xl font-mono mt-2">{v??'—'}</div></div>)}</div></section>

    {data.group==='pitching' && <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-[#3b494b]/25 flex items-end justify-between gap-4"><div><div className="text-[10px] text-[#00f0ff] uppercase tracking-wider">Pitching Chart</div><div className="flex items-center gap-3 mt-1"><h2 className="text-xl font-semibold">Pitch Mix Motion</h2><span className="px-2.5 py-1 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[10px] font-mono font-bold tracking-wider text-[#62ddeb]">LAST 5 STARTS</span></div><p className="mt-2 text-xs text-[#9aabad]">Shows this pitcher's recent pitch selection and average velocity across his last 5 tracked starts — not career averages.</p></div><div className="text-[11px] text-[#849495] text-right">Color = pitch type<br/>Ball size = usage</div></div>
      <div className="p-5">{pitchLoading?<div className="text-sm text-[#849495] py-6">Loading pitch data…</div>:pitchProfile.length?<div className="grid lg:grid-cols-[1.05fr_.95fr] gap-5">
        <div className="relative min-h-[330px] rounded-2xl border border-[#31405b] bg-[radial-gradient(circle_at_center,rgba(45,74,111,.25),rgba(9,17,33,.82)_70%)] overflow-hidden"><div className="absolute inset-x-[18%] top-[14%] bottom-[14%] border border-[#475a78]/45 rounded-xl"/><div className="absolute left-1/2 top-[14%] bottom-[14%] border-l border-dashed border-[#475a78]/30"/><div className="absolute top-1/2 left-[18%] right-[18%] border-t border-dashed border-[#475a78]/30"/><div className="absolute top-3 left-4 text-[10px] tracking-[.15em] text-[#62ddeb] uppercase font-semibold">Last 5 Starts · Pitch Mix</div>{pitchProfile.slice(0,6).map((pitch:any,index:number)=>{const color=pitchColors[index%pitchColors.length],pos=pitchPositions[index%pitchPositions.length],size=Math.max(34,Math.min(64,34+pitch.usagePct*.55));return <div key={pitch.code} className="absolute -translate-x-1/2 -translate-y-1/2 group" style={{left:pos.left,top:pos.top}}><div className="relative" style={{width:size,height:size}}><div className={`absolute inset-0 rounded-full opacity-30 ${color.ball} blur-md animate-pulse`}/><div className={`absolute inset-0 rounded-full ${color.ball} ${color.glow} animate-spin`} style={{animationDuration:`${1.8+index*.45}s`}}><div className="absolute left-[18%] top-[12%] bottom-[12%] w-[3px] rounded-full bg-white/80 rotate-[24deg]"/><div className="absolute right-[18%] top-[12%] bottom-[12%] w-[3px] rounded-full bg-white/80 rotate-[24deg]"/><div className="absolute inset-[5px] rounded-full border border-white/25"/></div></div><div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] whitespace-nowrap rounded-md bg-[#081224]/90 px-2 py-1 text-[10px] text-[#dae2fd] border border-[#31405b]">{pitch.name} · {pitch.avgVelo.toFixed(1)} mph</div></div>})}<div className="absolute bottom-3 left-4 right-4 text-[10px] text-[#65758f]">Animated balls show pitch type and usage. Their screen position is for visualization only and does not represent pitch location or break.</div></div>
        <div className="space-y-3">{pitchProfile.slice(0,6).map((pitch:any,index:number)=>{const color=pitchColors[index%pitchColors.length];return <div key={pitch.code} className="rounded-xl bg-[#10192c] border border-[#2b3851] p-3.5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className={`w-3 h-3 rounded-full ${color.ball} ${color.glow}`}/><div><div className="text-sm font-semibold text-[#dae2fd]">{pitch.name}</div><div className="text-[10px] text-[#849495]">{pitch.count} pitches · last 5 starts</div></div></div><div className="text-right"><div className={`font-mono text-lg ${color.text}`}>{pitch.usagePct.toFixed(1)}%</div><div className="text-[10px] text-[#849495]">{pitch.avgVelo.toFixed(1)} mph avg</div></div></div><div className="mt-3 h-2.5 bg-[#26344d] rounded-full overflow-hidden"><div className={`h-full rounded-full ${color.ball}`} style={{width:`${Math.max(4,Math.min(100,pitch.usagePct))}%`}}/></div></div>})}</div>
      </div>:<div className="text-sm text-[#849495] py-6">Recent pitch-tracking data is not available for this pitcher's last 5 starts yet.</div>}</div>
    </section>}

    <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl overflow-hidden"><div className="p-5 border-b border-[#3b494b]/25"><div className="text-[10px] text-[#00f0ff] uppercase tracking-wider">Recent Game Log</div><h2 className="text-xl font-semibold">Last 30 games</h2></div><div className="max-h-[420px] overflow-y-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-[#10192c] text-[#849495]"><tr><th className="text-left p-3">DATE</th><th className="text-left p-3">OPP</th>{data.group==='pitching'?<><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>SO</th></>:<><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>SO</th></>}</tr></thead><tbody>{data.logs.map((g:any,i:number)=><tr key={`${g.date}-${i}`} className="border-t border-[#3b494b]/20"><td className="p-3">{g.date}</td><td className="p-3">{g.opponent}</td>{data.group==='pitching'?<><td className="text-center">{g.stat.inningsPitched??'—'}</td><td className="text-center">{g.stat.hits??'—'}</td><td className="text-center">{g.stat.earnedRuns??'—'}</td><td className="text-center">{g.stat.baseOnBalls??'—'}</td><td className="text-center">{g.stat.strikeOuts??'—'}</td></>:<><td className="text-center">{g.stat.atBats??'—'}</td><td className="text-center">{g.stat.runs??'—'}</td><td className="text-center">{g.stat.hits??'—'}</td><td className="text-center">{g.stat.homeRuns??'—'}</td><td className="text-center">{g.stat.rbi??'—'}</td><td className="text-center">{g.stat.strikeOuts??'—'}</td></>}</tr>)}</tbody></table></div></section>
  </div>;
};

const Stat=({l,v}:{l:string;v:any})=><div className="bg-[#171f33] rounded-lg p-3"><div className="text-[10px] text-[#849495]">{l}</div><div className="font-mono text-lg mt-1">{v??'—'}</div></div>;
