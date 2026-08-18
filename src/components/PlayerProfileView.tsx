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

const TEAM_ABBR: Record<string,string> = {
  'Arizona Diamondbacks':'ARI','Athletics':'ATH','Oakland Athletics':'OAK','Atlanta Braves':'ATL','Baltimore Orioles':'BAL','Boston Red Sox':'BOS','Chicago Cubs':'CHC','Chicago White Sox':'CWS','Cincinnati Reds':'CIN','Cleveland Guardians':'CLE','Colorado Rockies':'COL','Detroit Tigers':'DET','Houston Astros':'HOU','Kansas City Royals':'KC','Los Angeles Angels':'LAA','Los Angeles Dodgers':'LAD','Miami Marlins':'MIA','Milwaukee Brewers':'MIL','Minnesota Twins':'MIN','New York Mets':'NYM','New York Yankees':'NYY','Philadelphia Phillies':'PHI','Pittsburgh Pirates':'PIT','San Diego Padres':'SD','San Francisco Giants':'SF','Seattle Mariners':'SEA','St. Louis Cardinals':'STL','Tampa Bay Rays':'TB','Texas Rangers':'TEX','Toronto Blue Jays':'TOR','Washington Nationals':'WSH'
};
const shortDate=(date:string)=>{const d=new Date(`${date}T00:00:00`);return Number.isNaN(d.getTime())?date:d.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
const shortTeam=(name:string)=>TEAM_ABBR[name]??name.split(/\s+/).map((part:string)=>part[0]).join('').slice(0,3).toUpperCase();

export const PlayerProfileView: React.FC<Props> = ({ playerId, onOpenTeam }) => {
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [pitchProfile,setPitchProfile]=useState<any[]>([]);
  const [pitchLoading,setPitchLoading]=useState(false);
  const [mobileStatsView,setMobileStatsView]=useState<'season'|'career'>('season');

  useEffect(()=>{if(!playerId)return;setLoading(true);setPitchProfile([]);setMobileStatsView('season');fetchPlayerProfile(playerId).then(setData).finally(()=>setLoading(false));},[playerId]);
  useEffect(()=>{if(!playerId||data?.group!=='pitching')return;setPitchLoading(true);fetchRecentPitchProfile(playerId,5).then(setPitchProfile).catch(()=>setPitchProfile([])).finally(()=>setPitchLoading(false));},[playerId,data?.group]);

  const seasonCards=useMemo(()=>{if(!data)return[];const s=data.season??{};return data.group==='pitching'?[['G',s.gamesPlayed],['W-L',`${s.wins??0}-${s.losses??0}`],['ERA',s.era],['IP',s.inningsPitched],['SO',s.strikeOuts],['WHIP',s.whip]]:[['G',s.gamesPlayed],['AVG',s.avg],['HR',s.homeRuns],['RBI',s.rbi],['H',s.hits],['OPS',s.ops]];},[data]);
  const careerCards=useMemo(()=>{if(!data)return[];const c=data.career??{};return data.group==='pitching'?[['G',c.gamesPlayed],['W-L',`${c.wins??0}-${c.losses??0}`],['ERA',c.era],['IP',c.inningsPitched],['SO',c.strikeOuts],['WHIP',c.whip]]:[['G',c.gamesPlayed],['AVG',c.avg],['HR',c.homeRuns],['RBI',c.rbi],['H',c.hits],['OPS',c.ops]];},[data]);

  if(!playerId)return <div className="p-4 sm:p-8 text-[#849495]">Search for a player to open a profile.</div>;
  if(loading||!data)return <div className="p-4 sm:p-8 text-[#849495]">Loading player profile…</div>;

  const mobileCards=mobileStatsView==='season'?seasonCards:careerCards;

  return <div className="px-3 py-3 sm:px-8 sm:py-8 max-w-[1280px] mx-auto h-[calc(100svh-116px)] sm:h-auto overflow-hidden sm:overflow-visible flex flex-col sm:block gap-2.5 sm:space-y-6">
    <section className="shrink-0 bg-[#171f33] border border-[#3b494b]/30 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 flex items-center gap-3 sm:gap-6">
      <img src={mlbPlayerHeadshotUrl(data.id,240)} alt={data.name} className="w-16 h-16 sm:w-36 sm:h-36 shrink-0 object-contain"/>
      <div className="min-w-0 flex-1"><div className="text-[8px] sm:text-[11px] tracking-[.16em] sm:tracking-[.18em] text-[#65f2b5] font-mono uppercase">Player Profile</div><h1 className="text-lg sm:text-4xl leading-tight font-bold mt-0.5 sm:mt-1">{data.name}</h1><div className="text-[10px] sm:text-base text-[#b9cacb] mt-1 sm:mt-2 flex items-center gap-1.5 sm:gap-3 flex-wrap"><span>{data.position}</span><span>·</span><span>{data.group==='pitching'?`${data.pitchHand??'—'}HP`:`${data.batSide??'—'}HB`}</span>{data.team&&<button onClick={()=>onOpenTeam(data.team.id)} className="inline-flex items-center gap-1 sm:gap-2 text-[#00f0ff] hover:underline"><img src={mlbTeamLogoUrl(data.team.id)} className="w-3.5 h-3.5 sm:w-6 sm:h-6 object-contain"/>{data.team.name}</button>}</div></div>
    </section>

    <section className="sm:hidden shrink-0 bg-[#10192c] border border-[#00f0ff]/25 rounded-xl p-2.5">
      <div className="flex rounded-lg border border-[#30415c] overflow-hidden mb-2"><button type="button" onClick={()=>setMobileStatsView('season')} className={`flex-1 px-3 py-1.5 text-[11px] font-bold ${mobileStatsView==='season'?'bg-[#56d3df] text-[#07101f]':'bg-[#111a2d] text-[#9fb0c8]'}`}>{currentSeason()}</button><button type="button" onClick={()=>setMobileStatsView('career')} className={`flex-1 px-3 py-1.5 text-[11px] font-bold ${mobileStatsView==='career'?'bg-[#56d3df] text-[#07101f]':'bg-[#111a2d] text-[#9fb0c8]'}`}>Career</button></div>
      <div className="grid grid-cols-3 gap-1.5">{mobileCards.map(([l,v]:any)=><Stat key={l} l={l} v={v}/>)}</div>
    </section>

    <div className="hidden sm:block space-y-6"><section className="bg-[#10192c] border border-[#00f0ff]/25 rounded-2xl p-5"><div className="text-xs text-[#00f0ff] uppercase tracking-wider mb-3">Career Regular Season</div><div className="grid md:grid-cols-6 gap-3">{careerCards.map(([l,v]:any)=><Stat key={l} l={l} v={v}/>)}</div></section><section><div className="text-xs text-[#00f0ff] uppercase tracking-wider mb-3">{currentSeason()} Regular Season</div><div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">{seasonCards.map(([l,v]:any)=><Stat key={l} l={l} v={v}/>)}</div></section></div>

    {data.group==='pitching'&&<section className="bg-[#171f33] border border-[#3b494b]/30 rounded-xl sm:rounded-2xl overflow-hidden"><div className="p-3 sm:p-5 border-b border-[#3b494b]/25"><div className="text-[9px] sm:text-[10px] text-[#00f0ff] uppercase tracking-wider">Pitching Chart</div><h2 className="text-base sm:text-xl font-semibold mt-1">Pitch Mix Motion</h2></div><div className="p-3 sm:p-5">{pitchLoading?<div className="text-sm text-[#849495] py-4">Loading pitch data…</div>:pitchProfile.length?<div className="space-y-2">{pitchProfile.slice(0,6).map((pitch:any,index:number)=>{const color=pitchColors[index%pitchColors.length];return <div key={pitch.code} className="rounded-lg bg-[#10192c] border border-[#2b3851] p-2.5 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${color.ball}`}/><span className="text-xs font-semibold">{pitch.name}</span></div><div className={`font-mono text-sm ${color.text}`}>{pitch.usagePct.toFixed(1)}% · {pitch.avgVelo.toFixed(1)} mph</div></div>})}</div>:<div className="text-sm text-[#849495] py-4">Recent pitch-tracking data is not available yet.</div>}</div></section>}

    <section className="min-h-0 flex-1 sm:flex-none bg-[#171f33] border border-[#3b494b]/30 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col">
      <div className="shrink-0 px-3 pt-2.5 pb-2 sm:p-5 border-b border-[#3b494b]/25"><div className="text-[9px] sm:text-[10px] text-[#00f0ff] uppercase tracking-wider leading-none">Recent Game Log</div><h2 className="text-base sm:text-xl font-semibold leading-tight mt-1">Last 30 games</h2></div>
      <div className="sm:hidden min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#171f33]">
        <table className="w-full table-fixed border-collapse text-[9px] leading-none"><thead className="sticky top-0 z-20 bg-[#10192c] text-[#849495] shadow-[0_1px_0_rgba(59,73,75,.3)]"><tr><th className="text-left px-2 py-2 w-[14%]">DATE</th><th className="text-left px-1 py-2 w-[12%]">OPP</th>{data.group==='pitching'?<><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>SO</th></>:<><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th><th>SB</th></>}</tr></thead><tbody>{data.logs.map((g:any,i:number)=><tr key={`${g.date}-${i}`} className="border-t border-[#3b494b]/20"><td className="px-2 py-2.5 whitespace-nowrap">{shortDate(g.date)}</td><td className="px-1 py-2.5 font-semibold">{shortTeam(g.opponent)}</td>{data.group==='pitching'?<><td className="text-center">{g.stat.inningsPitched??'—'}</td><td className="text-center">{g.stat.hits??'—'}</td><td className="text-center">{g.stat.earnedRuns??'—'}</td><td className="text-center">{g.stat.baseOnBalls??'—'}</td><td className="text-center">{g.stat.strikeOuts??'—'}</td></>:<><td className="text-center">{g.stat.atBats??'—'}</td><td className="text-center">{g.stat.runs??'—'}</td><td className="text-center">{g.stat.hits??'—'}</td><td className="text-center">{g.stat.homeRuns??'—'}</td><td className="text-center">{g.stat.rbi??'—'}</td><td className="text-center">{g.stat.baseOnBalls??'—'}</td><td className="text-center">{g.stat.strikeOuts??'—'}</td><td className="text-center">{g.stat.stolenBases??'—'}</td></>}</tr>)}</tbody></table>
      </div>
      <div className="hidden sm:block max-h-[420px] overflow-y-auto overscroll-contain"><table className="w-full table-fixed text-sm"><thead className="sticky top-0 z-10 bg-[#10192c] text-[#849495]"><tr><th className="text-left p-3">DATE</th><th className="text-left p-3">OPP</th>{data.group==='pitching'?<><th>IP</th><th>H</th><th>ER</th><th>BB</th><th>SO</th></>:<><th>AB</th><th>R</th><th>H</th><th>HR</th><th>RBI</th><th>BB</th><th>SO</th><th>SB</th></>}</tr></thead><tbody>{data.logs.map((g:any,i:number)=><tr key={`${g.date}-${i}`} className="border-t border-[#3b494b]/20"><td className="p-3 whitespace-nowrap">{g.date}</td><td className="p-3 font-semibold">{g.opponent}</td>{data.group==='pitching'?<><td className="text-center">{g.stat.inningsPitched??'—'}</td><td className="text-center">{g.stat.hits??'—'}</td><td className="text-center">{g.stat.earnedRuns??'—'}</td><td className="text-center">{g.stat.baseOnBalls??'—'}</td><td className="text-center">{g.stat.strikeOuts??'—'}</td></>:<><td className="text-center">{g.stat.atBats??'—'}</td><td className="text-center">{g.stat.runs??'—'}</td><td className="text-center">{g.stat.hits??'—'}</td><td className="text-center">{g.stat.homeRuns??'—'}</td><td className="text-center">{g.stat.rbi??'—'}</td><td className="text-center">{g.stat.baseOnBalls??'—'}</td><td className="text-center">{g.stat.strikeOuts??'—'}</td><td className="text-center">{g.stat.stolenBases??'—'}</td></>}</tr>)}</tbody></table></div>
    </section>
  </div>;
};

const Stat=({l,v}:{l:string;v:any})=><div className="bg-[#171f33] rounded-lg p-2 sm:p-3"><div className="text-[9px] sm:text-[10px] text-[#849495] leading-none">{l}</div><div className="font-mono text-sm sm:text-lg mt-1">{v??'—'}</div></div>;
