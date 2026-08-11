import React, { useEffect, useState } from 'react';

const dateKey = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};
const labelDate = (key: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }).format(new Date(`${key}T12:00:00Z`));
const gameTime = (iso?: string) => iso ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(iso)) : 'TBD';
const headshot = (id?: number) => id ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_auto:best/v1/people/${id}/headshot/67/current` : '';
const teamLogo = (id?: number) => id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : '';

async function fetchJson(url: string) { const response = await fetch(url); if (!response.ok) throw new Error(`MLB request failed (${response.status})`); return response.json(); }
function playerName(entry: any) { return entry?.person?.fullName ?? entry?.fullName ?? 'Unknown player'; }

function buildPregameSignals(schedule: any, selectedDate: string) {
  const games = (schedule?.dates ?? []).flatMap((d: any) => d.games ?? []);
  return games.map((game: any) => {
    const away = game?.teams?.away?.team; const home = game?.teams?.home?.team;
    const awayPitcher = game?.teams?.away?.probablePitcher; const homePitcher = game?.teams?.home?.probablePitcher;
    const bothStarters = awayPitcher?.fullName && homePitcher?.fullName;
    return { id:`pre-${selectedDate}-${game.gamePk}`, gamePk:game.gamePk, player:`${away?.name ?? 'Away Team'} at ${home?.name ?? 'Home Team'}`, team:gameTime(game.gameDate), type:'GAME PREVIEW', severity:bothStarters?'READY':'WAITING', image:teamLogo(away?.id), secondaryImage:teamLogo(home?.id), short:`${awayPitcher?.fullName ?? 'TBD'} vs ${homePitcher?.fullName ?? 'TBD'}`, description:`Probable starters: ${awayPitcher?.fullName ?? 'TBD'} vs ${homePitcher?.fullName ?? 'TBD'}. ScoutCore will use confirmed lineups, pitcher handedness and current player data as they become available.`, confidence:bothStarters?'STARTERS POSTED':'STARTERS TBD' };
  });
}

function buildPostgameSignals(feed: any, selectedDate: string) {
  const rows:any[]=[]; const teams=feed?.liveData?.boxscore?.teams??{}; const gameData=feed?.gameData??{}; const gamePk=gameData?.game?.pk??feed?.gamePk??Math.random();
  (['away','home'] as const).forEach((side)=>{
    const teamBlock=teams?.[side]??{}; const teamName=teamBlock?.team?.name??gameData?.teams?.[side]?.name??'Unknown Team'; const players=Object.values(teamBlock?.players??{}) as any[];
    players.filter((p:any)=>p?.stats?.batting&&Number(p.stats.batting.plateAppearances??0)>0).map((p:any)=>{const s=p.stats.batting??{}; const score=Number(s.hits??0)*12+Number(s.homeRuns??0)*20+Number(s.rbi??0)*7+Number(s.baseOnBalls??0)*4+Number(s.totalBases??0)*2; return {p,s,score};}).filter((x:any)=>x.score>0).sort((a:any,b:any)=>b.score-a.score).slice(0,2).forEach(({p,s,score}:any,index:number)=>{
      const pieces=[`${s.hits??0} H`]; if(Number(s.homeRuns??0))pieces.push(`${s.homeRuns} HR`); if(Number(s.rbi??0))pieces.push(`${s.rbi} RBI`); if(Number(s.runs??0))pieces.push(`${s.runs} R`);
      rows.push({id:`${selectedDate}-${gamePk}-${side}-bat-${p.person?.id??index}`,gamePk,playerId:p.person?.id,player:playerName(p),team:teamName,type:'HITTER REPORT',severity:score>=55?'STANDOUT':'NOTABLE',image:headshot(p.person?.id),short:pieces.join(' · '),score:Math.min(95,Math.max(60,Math.round(58+score/2))),confidence:'VERIFIED',description:`Final line: ${pieces.join(', ')} in ${s.atBats??0} AB. Plate appearances: ${s.plateAppearances??'—'}, walks: ${s.baseOnBalls??0}, strikeouts: ${s.strikeOuts??0}, total bases: ${s.totalBases??0}. This report summarizes verified MLB box-score production from the completed game.`});
    });
    players.filter((p:any)=>p?.stats?.pitching&&Number.parseFloat(String(p.stats.pitching.inningsPitched??'0'))>0).map((p:any)=>{const s=p.stats.pitching??{}; const ip=Number.parseFloat(String(s.inningsPitched??'0'))||0; const score=ip*7+Number(s.strikeOuts??0)*6-Number(s.earnedRuns??0)*10-Number(s.hits??0)*2-Number(s.baseOnBalls??0)*2; return {p,s,score};}).filter((x:any)=>x.score>=18).sort((a:any,b:any)=>b.score-a.score).slice(0,1).forEach(({p,s,score}:any,index:number)=>{
      const short=`${s.inningsPitched??'—'} IP · ${s.strikeOuts??0} K · ${s.earnedRuns??0} ER`;
      rows.push({id:`${selectedDate}-${gamePk}-${side}-pit-${p.person?.id??index}`,gamePk,playerId:p.person?.id,player:playerName(p),team:teamName,type:'PITCHER REPORT',severity:score>=45?'STANDOUT':'NOTABLE',image:headshot(p.person?.id),short,score:Math.min(95,Math.max(60,Math.round(60+score/2))),confidence:'VERIFIED',description:`Final line: ${s.inningsPitched??'—'} IP, ${s.hits??0} H, ${s.earnedRuns??0} ER, ${s.baseOnBalls??0} BB, ${s.strikeOuts??0} K. Pitches: ${s.numberOfPitches??'—'}, strikes: ${s.strikes??'—'}. This is verified completed-game pitching data.`});
    });
  }); return rows;
}

function pickGameMedia(content:any, signal:any) {
  const items = content?.highlights?.highlights?.items ?? [];
  const full = String(signal?.player ?? '').toLowerCase();
  const last = full.split(' ').filter(Boolean).pop() ?? '';
  const scored = items.map((item:any) => {
    const text = `${item?.title ?? ''} ${item?.blurb ?? ''} ${item?.description ?? ''}`.toLowerCase();
    let score = 0;
    if (full && text.includes(full)) score += 10;
    if (last && text.includes(last)) score += 5;
    if (signal?.type === 'HITTER REPORT' && /(home run|homer|hit|double|triple|single|rbi|scores)/i.test(text)) score += 2;
    if (signal?.type === 'PITCHER REPORT' && /(strikeout|strikes out|pitch|inning)/i.test(text)) score += 2;
    return { item, score };
  }).sort((a:any,b:any)=>b.score-a.score);
  const item = scored[0]?.score > 0 ? scored[0].item : items[0];
  if (!item) return null;
  const cuts = item?.image?.cuts ?? [];
  const poster = [...cuts].sort((a:any,b:any)=>(Number(b?.width)||0)-(Number(a?.width)||0))[0]?.src ?? item?.image?.templateUrl ?? null;
  const playbacks = item?.playbacks ?? [];
  const video = playbacks.find((p:any)=>String(p?.name??'').toLowerCase().includes('mp4'))?.url ?? playbacks.find((p:any)=>String(p?.url??'').includes('.mp4'))?.url ?? null;
  return { poster, video, title:item?.title ?? 'MLB game highlight', blurb:item?.blurb ?? '' };
}

export const ScoutingFeedView:React.FC=()=>{
  const [signals,setSignals]=useState<any[]>([]); const [filter,setFilter]=useState('ALL'); const [mode,setMode]=useState<'PRE-GAME'|'POST-GAME'>('POST-GAME'); const [day,setDay]=useState<'TODAY'|'YESTERDAY'>('YESTERDAY'); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [selected,setSelected]=useState<any|null>(null); const [selectedMedia,setSelectedMedia]=useState<any|null>(null); const [mediaLoading,setMediaLoading]=useState(false);
  const load=async()=>{setLoading(true);setError(null);try{const selectedDate=day==='TODAY'?dateKey(0):dateKey(-1);const schedule=await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${selectedDate}&hydrate=team,probablePitcher`);if(mode==='PRE-GAME')setSignals(buildPregameSignals(schedule,selectedDate));else{const games=(schedule?.dates??[]).flatMap((d:any)=>d.games??[]).filter((g:any)=>g?.status?.abstractGameState==='Final'||g?.status?.detailedState==='Final');const feeds=await Promise.all(games.slice(0,15).map((g:any)=>fetchJson(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`).catch(()=>null)));setSignals(feeds.filter(Boolean).flatMap((f:any)=>buildPostgameSignals(f,selectedDate)).sort((a:any,b:any)=>(b.score??0)-(a.score??0)));}}catch(e){setSignals([]);setError(e instanceof Error?e.message:'Unable to load scouting feed.');}finally{setLoading(false);}};
  useEffect(()=>{setFilter('ALL');setSelected(null);setSelectedMedia(null);load();const timer=window.setInterval(load,10*60*1000);return()=>window.clearInterval(timer);},[day,mode]);
  useEffect(()=>{if(!selected||mode!=='POST-GAME'||!selected.gamePk){setSelectedMedia(null);return;} let cancelled=false; setMediaLoading(true); setSelectedMedia(null); fetchJson(`https://statsapi.mlb.com/api/v1/game/${selected.gamePk}/content`).then(content=>{if(!cancelled)setSelectedMedia(pickGameMedia(content,selected));}).catch(()=>{if(!cancelled)setSelectedMedia(null);}).finally(()=>{if(!cancelled)setMediaLoading(false);}); return()=>{cancelled=true;};},[selected,mode]);
  const filters=mode==='PRE-GAME'?['ALL','GAME PREVIEW']:['ALL','HITTER REPORT','PITCHER REPORT']; const filtered=signals.filter(s=>filter==='ALL'||s.type===filter); const selectedDate=day==='TODAY'?dateKey(0):dateKey(-1);
  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap justify-between gap-4 border-b border-[#3b494b]/20 pb-6"><div><span className="font-label-caps text-xs text-[#00f0ff]">SCOUTCORE INTELLIGENCE</span><h1 className="font-display-lg text-4xl">Scouting Feed</h1><p className="text-sm text-[#849495] mt-1">Quick visual reports. Click any card for the full scouting detail.</p></div><div className="flex flex-col items-end gap-2"><div className="flex gap-2 bg-[#131b2e] p-1.5 rounded-xl">{['PRE-GAME','POST-GAME'].map(item=><button key={item} onClick={()=>{const next=item as 'PRE-GAME'|'POST-GAME';setMode(next);setDay(next==='PRE-GAME'?'TODAY':'YESTERDAY');}} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${mode===item?'bg-[#00f0ff] text-[#00363a]':'text-[#849495]'}`}>{item}</button>)}</div><div className="flex gap-2"><button onClick={()=>setDay('TODAY')} className={`text-xs font-bold ${day==='TODAY'?'text-[#00f0ff]':'text-[#849495]'}`}>TODAY</button><span>·</span><button onClick={()=>setDay('YESTERDAY')} className={`text-xs font-bold ${day==='YESTERDAY'?'text-[#00f0ff]':'text-[#849495]'}`}>YESTERDAY</button></div><span className="text-xs text-[#849495]">{labelDate(selectedDate)} · ET</span></div></div>
    <div className="flex gap-2 bg-[#131b2e] p-1.5 rounded-xl max-w-max">{filters.map(cat=><button key={cat} onClick={()=>setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs ${filter===cat?'bg-[#00f0ff] text-[#00363a] font-bold':'text-[#849495]'}`}>{cat}</button>)}</div>
    {error&&<div className="p-4 rounded-xl bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] text-sm">{error}</div>}
    {loading?<div className="text-[#849495]">Loading scouting reports…</div>:<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(signal=><button key={signal.id} onClick={()=>setSelected(signal)} className="text-left overflow-hidden bg-[#171f33] rounded-xl border border-[#3b494b]/30 hover:border-[#00f0ff]/70 transition group"><div className="h-36 bg-[#101a30] relative flex items-center justify-center overflow-hidden">{signal.image&&<img src={signal.image} className={`${signal.secondaryImage?'w-24 h-24 object-contain':'w-full h-full object-contain object-center'} group-hover:scale-[1.03] transition`} />}{signal.secondaryImage&&<><span className="mx-5 text-[#00f0ff] font-bold">VS</span><img src={signal.secondaryImage} className="w-24 h-24 object-contain" /></>}</div><div className="p-4"><div className="flex justify-between text-[10px]"><span className="text-[#00f0ff] font-bold">{signal.type}</span><span className="text-[#65f2b5]">{signal.severity}</span></div><h3 className="font-bold text-lg mt-1 truncate">{signal.player}</h3><p className="text-sm text-[#849495] truncate">{signal.team}</p><p className="text-sm text-[#d0d8da] mt-3 font-data-numeric">{signal.short}</p><span className="inline-block mt-3 text-xs text-[#00f0ff]">VIEW REPORT →</span></div></button>)}{!filtered.length&&<div className="col-span-full p-8 bg-[#171f33] rounded-xl text-center text-[#849495]">No scouting reports are available for this date yet.</div>}</div>}
    {selected&&<div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-5" onClick={()=>setSelected(null)}><div className="w-full max-w-2xl bg-[#171f33] border border-[#00f0ff]/30 rounded-2xl overflow-hidden shadow-2xl" onClick={e=>e.stopPropagation()}><div className="h-64 bg-[#101a30] flex items-center justify-center overflow-hidden relative">{mediaLoading?<div className="text-sm text-[#849495]">Loading game media…</div>:selectedMedia?.video?<video key={selectedMedia.video} controls playsInline preload="metadata" poster={selectedMedia.poster??undefined} className="w-full h-full object-cover bg-black"><source src={selectedMedia.video} type="video/mp4" /></video>:selectedMedia?.poster?<img src={selectedMedia.poster} alt={selectedMedia.title} className="w-full h-full object-cover" />:selected.image?<img src={selected.image} className="h-full w-full object-contain" />:null}{selectedMedia&&!selectedMedia.video&&<div className="absolute bottom-3 left-3 right-3 bg-black/55 backdrop-blur-sm px-3 py-2 rounded-lg"><p className="text-xs font-bold text-white truncate">{selectedMedia.title}</p></div>}</div><div className="p-6"><div className="flex justify-between items-start gap-4"><div><span className="text-xs text-[#00f0ff] font-bold">{selected.type}</span><h2 className="font-display-lg text-3xl mt-1">{selected.player}</h2><p className="text-sm text-[#849495]">{selected.team}</p></div><button onClick={()=>setSelected(null)} className="text-2xl text-[#849495] hover:text-white">×</button></div><div className="mt-5 p-4 bg-[#101a30] rounded-xl"><div className="font-data-numeric text-[#65f2b5]">{selected.short}</div><p className="text-sm text-[#d0d8da] leading-relaxed mt-3">{selected.description}</p>{selectedMedia?.blurb&&<p className="text-xs text-[#849495] mt-3">Game highlight: {selectedMedia.blurb}</p>}</div>{mode==='POST-GAME'&&<div className="flex gap-8 mt-5 text-xs text-[#849495]"><span>PERFORMANCE INDEX <b className="text-white ml-1">{selected.score}</b></span><span>DATA <b className="text-[#65f2b5] ml-1">VERIFIED</b></span></div>}</div></div></div>}
  </div>;
};
