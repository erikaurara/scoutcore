import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { SocialAvatar, SocialProfileCard, type SocialProfileTarget } from './SocialProfileCard';

type Props = { gamePk:number; feed:any; signedIn:boolean; userEmail?:string|null; onOpenAuth:()=>void };
type FieldMode = 'STANDARD'|'INFIELD IN'|'CORNERS IN'|'SHIFT';
type ChatMessage = { id:string; game_pk:number; user_id:string; display_name:string; body:string; created_at:string };
type ChatSocial = { message_id:string; profile_id?:string|null; display_name?:string|null; avatar_url?:string|null };
const CHAT_EMOJIS=['🔥','👏','😱','⚾','😂','💙','👀','💪'];
const displayTeamName=(team:any)=>team?.abbreviation??team?.teamName??team?.name??'TEAM';
const playerName=(player:any,fallback='—')=>player?.fullName??player?.name??player?.person?.fullName??fallback;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const fieldPositions:Record<FieldMode,Record<string,[number,number]>>={
  STANDARD:{pitcher:[50,56],catcher:[50,84],first:[70,62],second:[63,46],shortstop:[37,46],third:[30,62],left:[24,27],center:[50,17],right:[76,27]},
  'INFIELD IN':{pitcher:[50,60],catcher:[50,84],first:[64,66],second:[58,55],shortstop:[42,55],third:[36,66],left:[24,27],center:[50,17],right:[76,27]},
  'CORNERS IN':{pitcher:[50,56],catcher:[50,84],first:[62,68],second:[63,46],shortstop:[37,46],third:[38,68],left:[24,27],center:[50,17],right:[76,27]},
  SHIFT:{pitcher:[50,56],catcher:[50,84],first:[72,62],second:[68,45],shortstop:[49,45],third:[38,62],left:[32,27],center:[56,17],right:[80,27]},
};

const useDraggable=(initial:{x:number;y:number}, bounds:{w:number;h:number})=>{
  const [pos,setPos]=useState(initial); const drag=useRef<{x:number;y:number;sx:number;sy:number;moved:boolean}|null>(null);
  useEffect(()=>{const move=(e:PointerEvent)=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.sx,dy=e.clientY-d.sy;if(Math.abs(dx)+Math.abs(dy)>4)d.moved=true;setPos({x:clamp(d.x+dx,8,window.innerWidth-bounds.w),y:clamp(d.y+dy,8,window.innerHeight-bounds.h)});};const up=()=>{};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};},[bounds.h,bounds.w]);
  const start=(e:React.PointerEvent)=>{drag.current={x:pos.x,y:pos.y,sx:e.clientX,sy:e.clientY,moved:false};};
  const stop=()=>{const moved=drag.current?.moved??false;drag.current=null;return moved;};
  return {pos,start,stop};
};

export const LiveGameExperienceV5:React.FC<Props>=({gamePk,feed,signedIn,userEmail,onOpenAuth})=>{
  const [fieldMode,setFieldMode]=useState<FieldMode>('STANDARD');
  const [chatOpen,setChatOpen]=useState(false);
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [messageText,setMessageText]=useState('');
  const [backendReady,setBackendReady]=useState<boolean|null>(null);
  const [userId,setUserId]=useState<string|null>(null);
  const [displayName,setDisplayName]=useState(userEmail?.split('@')[0]||'ScoutCore User');
  const [chatSocial,setChatSocial]=useState<Record<string,ChatSocial>>({});
  const [selectedSocial,setSelectedSocial]=useState<SocialProfileTarget|null>(null);
  const chatEnd=useRef<HTMLDivElement|null>(null);
  const bubbleDrag=useDraggable({x:Math.max(12,window.innerWidth-72),y:Math.max(100,window.innerHeight-76)},{w:64,h:64});
  const chatDrag=useDraggable({x:Math.max(12,window.innerWidth-382),y:100},{w:360,h:180});

  const gameData=feed?.gameData??{},liveData=feed?.liveData??{},linescore=liveData?.linescore??{},boxscore=liveData?.boxscore??{},plays=liveData?.plays??{};
  const allPlays=Array.isArray(plays?.allPlays)?plays.allPlays:[];
  const currentPlay=plays?.currentPlay??allPlays[allPlays.length-1]??null;
  const events=Array.isArray(currentPlay?.playEvents)?currentPlay.playEvents:[];
  const recentPitches=events.filter((e:any)=>e?.isPitch).slice(-6);
  const recentPlays=allPlays.slice(-4).reverse();
  const awayTeam=gameData?.teams?.away??{},homeTeam=gameData?.teams?.home??{};
  const awayRuns=linescore?.teams?.away?.runs??0,homeRuns=linescore?.teams?.home?.runs??0;
  const awayHits=linescore?.teams?.away?.hits??0,homeHits=linescore?.teams?.home?.hits??0;
  const awayErrors=linescore?.teams?.away?.errors??0,homeErrors=linescore?.teams?.home?.errors??0;
  const batter=currentPlay?.matchup?.batter??null,pitcher=currentPlay?.matchup?.pitcher??null;
  const balls=currentPlay?.count?.balls??linescore?.balls??0,strikes=currentPlay?.count?.strikes??linescore?.strikes??0,outs=currentPlay?.count?.outs??linescore?.outs??0;
  const inning=linescore?.currentInning??0; const inningState=String(linescore?.inningState??'').toUpperCase();
  const detailedState=gameData?.status?.detailedState??'PREVIEW'; const isFinal=gameData?.status?.abstractGameState==='Final'||String(detailedState).toLowerCase().includes('final');
  const inningLabel=isFinal?'FINAL':inning?`${inningState} ${inning}`:detailedState;
  const latestDescription=events[events.length-1]?.details?.description??currentPlay?.result?.description??currentPlay?.result?.event??'Waiting for the next verified MLB event…';
  const offense=linescore?.offense??{},defense=linescore?.defense??{};
  const battingSide=linescore?.isTopInning?'away':'home'; const battingTeam=battingSide==='away'?awayTeam:homeTeam; const battingBox=boxscore?.teams?.[battingSide]??{};
  const innings=Array.isArray(linescore?.innings)?linescore.innings:[];
  const battingRows=(Array.isArray(battingBox?.batters)?battingBox.batters:[]).map((id:number)=>battingBox?.players?.[`ID${id}`]).filter(Boolean).slice(0,7);
  const positions=fieldPositions[fieldMode];
  const fielders=[['pitcher','P',defense?.pitcher],['catcher','C',defense?.catcher],['first','1B',defense?.first],['second','2B',defense?.second],['shortstop','SS',defense?.shortstop],['third','3B',defense?.third],['left','LF',defense?.left],['center','CF',defense?.center],['right','RF',defense?.right]] as const;
  const eventKey=String(events[events.length-1]?.playId??currentPlay?.playEndTime??currentPlay?.atBatIndex??'pregame');

  const pitchDot=(event:any)=>{const x=Number(event?.pitchData?.coordinates?.pX),z=Number(event?.pitchData?.coordinates?.pZ);if(!Number.isFinite(x)||!Number.isFinite(z))return{left:'50%',top:'50%'};return{left:`${50+clamp(x/1.5,-1,1)*40}%`,top:`${86-clamp((z-1)/3,0,1)*72}%`};};

  useEffect(()=>{let cancelled=false;const load=async()=>{setDisplayName(userEmail?.split('@')[0]||'ScoutCore User');if(!supabase){setBackendReady(false);return;}let uid:string|null=null;if(signedIn){const{data}=await supabase.auth.getUser();uid=data.user?.id??null;if(data.user){setUserId(uid);const m=data.user.user_metadata??{};setDisplayName(m.display_name||m.full_name||data.user.email?.split('@')[0]||'ScoutCore User');await supabase.rpc('sync_my_social_profile');}}const[messagesResult,socialResult]=await Promise.all([supabase.from('game_chat_messages').select('id,game_pk,user_id,display_name,body,created_at').eq('game_pk',gamePk).order('created_at',{ascending:false}).limit(50),supabase.rpc('get_game_chat_social_profiles',{p_game_pk:gamePk,p_limit:50})]);if(cancelled)return;if(messagesResult.error){setBackendReady(false);return;}setBackendReady(true);setMessages([...(messagesResult.data??[])].reverse() as ChatMessage[]);if(!socialResult.error){const next:Record<string,ChatSocial>={};for(const row of(socialResult.data??[])as ChatSocial[])next[row.message_id]=row;setChatSocial(next);}};void load();return()=>{cancelled=true;};},[gamePk,signedIn,userEmail]);
  useEffect(()=>{if(!backendReady||!supabase)return;const channel=supabase.channel(`live-chat-v5-${gamePk}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'game_chat_messages',filter:`game_pk=eq.${gamePk}`},payload=>{const incoming=payload.new as ChatMessage;setMessages(current=>current.some(m=>m.id===incoming.id)?current:[...current,incoming].slice(-50));}).subscribe();return()=>{void supabase.removeChannel(channel);};},[backendReady,gamePk]);
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages.length,chatOpen]);

  const send=async()=>{const body=messageText.trim().slice(0,280);if(!body)return;if(!signedIn){onOpenAuth();return;}if(!supabase||!backendReady||!userId)return;const{error}=await supabase.from('game_chat_messages').insert({game_pk:gamePk,user_id:userId,display_name:displayName.slice(0,48),body});if(!error)setMessageText('');};

  return <main className="mx-auto h-screen max-w-[1780px] overflow-hidden px-3 py-3 text-[#dae2fd] sm:px-4">
    <section className="mb-2 rounded-xl border border-[#2b405b] bg-[#0b1524] pr-28">
      <div className="grid min-h-[70px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2">
        <div><p className="text-[10px] font-black tracking-[.16em] text-[#00e6f4]">SCOUTCORE AI LIVE SIM</p><p className="mt-1 text-[9px] text-[#73849a]">Verified MLB events visualized live.</p></div>
        <div className="flex items-center gap-4 rounded-xl border border-[#243751] bg-[#07101d] px-4 py-2">
          <div className="flex items-center gap-2"><img src={mlbTeamLogoUrl(awayTeam?.id)} className="h-7 w-7 object-contain" alt=""/><b>{displayTeamName(awayTeam)}</b><span className="font-mono text-xl font-black text-white">{awayRuns}</span></div>
          <span className="rounded border border-[#33465f] px-2 py-1 font-mono text-[9px] font-bold text-[#8fa0b7]">{inningLabel}</span>
          <div className="flex items-center gap-2"><span className="font-mono text-xl font-black text-white">{homeRuns}</span><b>{displayTeamName(homeTeam)}</b><img src={mlbTeamLogoUrl(homeTeam?.id)} className="h-7 w-7 object-contain" alt=""/></div>
        </div>
        <div className="justify-self-end rounded-lg border border-[#26364e] bg-[#07101d] px-3 py-2 text-[10px] font-black text-white"><span className="text-[#00e6f4]">{balls}-{strikes}</span> COUNT <span className="mx-2 text-[#40516b]">•</span><span className="text-[#65f2b5]">{outs}</span> OUT{outs===1?'':'S'}</div>
      </div>
    </section>

    <div className="grid h-[calc(100vh-90px)] grid-cols-[260px_minmax(520px,1fr)_320px] gap-2">
      <div className="flex min-h-0 flex-col gap-2">
        <section className="rounded-xl border border-[#2b405b] bg-[#0d1727] p-3">
          <p className="text-[10px] font-black tracking-[.14em] text-[#00e6f4]">AT BAT / PITCHING</p>
          <div className="mt-3 flex items-center gap-3"><img src={mlbPlayerHeadshotUrl(batter?.id,120)} className="h-14 w-14 rounded-xl border border-[#2b405b] bg-[#10192b] object-contain" alt=""/><div className="min-w-0"><p className="truncate text-sm font-black text-white">{playerName(batter,'Batter')}</p><p className="mt-1 truncate text-[10px] text-[#8fa0b7]">vs {playerName(pitcher,'Pitcher')}</p></div></div>
          <div className="mt-3 grid grid-cols-[105px_1fr] gap-2"><div className="relative h-[126px] rounded-lg border border-[#26364e] bg-[#07101d]"><div className="absolute inset-x-[20%] bottom-[18%] top-[18%] border border-[#6b8099]"/>{recentPitches.map((event:any,index:number)=><span key={index} style={pitchDot(event)} className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#00e6f4] text-[8px] font-black text-[#05222a]">{index+1}</span>)}</div><div className="space-y-2"><Mini label="COUNT" value={`${balls}-${strikes}`}/><Mini label="OUTS" value={String(outs)}/></div></div>
          <p className="mt-3 line-clamp-3 text-[10px] leading-4 text-[#c2cede]">{latestDescription}</p>
        </section>
        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="border-b border-[#26364e] px-3 py-2"><p className="text-[10px] font-black text-white">PITCH SEQUENCE</p></div><div className="max-h-full overflow-y-auto">{recentPitches.length?[...recentPitches].reverse().map((event:any,index:number)=><div key={index} className="flex items-center gap-2 border-b border-[#1e3047] px-3 py-2"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#2f5264] text-[8px] text-[#00e6f4]">{recentPitches.length-index}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-white">{event?.details?.type?.description??'Pitch'}</p><p className="text-[8px] text-[#718198]">{event?.details?.call?.description??'Tracked'}</p></div><span className="font-mono text-[9px] text-[#9dafc3]">{Number.isFinite(Number(event?.pitchData?.startSpeed))?`${Number(event.pitchData.startSpeed).toFixed(1)} mph`:'—'}</span></div>):<p className="p-4 text-center text-[10px] text-[#718198]">Pitch tracking will appear here.</p>}</div></section>
      </div>

      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_190px] gap-2">
        <section className="min-h-0 overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-3 py-2"><div><p className="text-[10px] font-black tracking-[.14em] text-white">FIELD ALIGNMENT</p><p className="mt-1 text-[8px] text-[#718198]">Click a view to compare defensive positioning.</p></div><div className="flex gap-1">{(['STANDARD','INFIELD IN','CORNERS IN','SHIFT'] as FieldMode[]).map(item=><button key={item} onClick={()=>setFieldMode(item)} className={`rounded-md border px-2 py-1 text-[8px] font-bold ${fieldMode===item?'border-[#00e6f4]/70 bg-[#00e6f4]/12 text-[#00e6f4]':'border-[#2a3d56] text-[#718198] hover:border-[#00e6f4]/40 hover:text-white'}`}>{item}</button>)}</div></div><div className="scoutcore-sim-field relative h-[calc(100%-48px)] min-h-[360px] overflow-hidden"><div className="scoutcore-sim-diamond"/><div className={`scoutcore-sim-base scoutcore-sim-base-second ${offense?.second?'is-active':''}`}><span>2B</span></div><div className={`scoutcore-sim-base scoutcore-sim-base-first ${offense?.first?'is-active':''}`}><span>1B</span></div><div className={`scoutcore-sim-base scoutcore-sim-base-third ${offense?.third?'is-active':''}`}><span>3B</span></div><div className="scoutcore-sim-home"><span>HOME</span></div><div className="scoutcore-sim-mound"><span>P</span></div><div key={eventKey} className="scoutcore-sim-ball">⚾</div>{fielders.map(([key,label,player])=>{const [left,top]=positions[key];return <div key={key} style={{left:`${left}%`,top:`${top}%`}} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center transition-all duration-300"><div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-[#00e6f4]/45 bg-[#071522]/90 text-[8px] font-black text-[#00e6f4]">{label}</div><span className="mt-1 block max-w-[90px] truncate rounded bg-[#06101c]/80 px-1.5 py-0.5 text-[8px] font-bold text-[#d7e1ef]">{playerName(player,label)}</span></div>})}</div></section>
        <section className="overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="flex items-center justify-between border-b border-[#26364e] px-3 py-2"><p className="text-[10px] font-black text-white">LIVE FEED</p><span className="text-[8px] font-bold text-[#65f2b5]">VERIFIED</span></div><div className="h-[152px] overflow-y-auto">{recentPlays.length?recentPlays.map((play:any,index:number)=><div key={index} className="grid grid-cols-[52px_1fr] gap-2 border-b border-[#1e3047] px-3 py-2"><span className="font-mono text-[8px] font-bold text-[#00e6f4]">{play?.about?.halfInning?`${String(play.about.halfInning).slice(0,3).toUpperCase()} ${play?.about?.inning??''}`:'GAME'}</span><p className="text-[10px] leading-4 text-[#c4d0df]">{play?.result?.description??play?.result?.event??'Verified game event'}</p></div>):<p className="p-4 text-center text-[10px] text-[#718198]">Verified play-by-play will appear here.</p>}</div></section>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <section className="rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="border-b border-[#26364e] px-3 py-2 text-[10px] font-black text-white">LINESCORE</div><div className="overflow-x-auto p-2"><table className="w-full min-w-[280px] text-center text-[8px]"><thead className="text-[#607086]"><tr><th className="text-left">TEAM</th>{innings.slice(0,9).map((i:any)=><th key={i?.num}>{i?.num}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead><tbody className="font-mono text-[#d7e1ef]"><tr><td className="py-2 text-left font-sans font-black">{displayTeamName(awayTeam)}</td>{innings.slice(0,9).map((i:any)=><td key={i?.num}>{i?.away?.runs??'—'}</td>)}<td className="text-[#00e6f4]">{awayRuns}</td><td>{awayHits}</td><td>{awayErrors}</td></tr><tr className="border-t border-[#1e3047]"><td className="py-2 text-left font-sans font-black">{displayTeamName(homeTeam)}</td>{innings.slice(0,9).map((i:any)=><td key={i?.num}>{i?.home?.runs??'—'}</td>)}<td className="text-[#00e6f4]">{homeRuns}</td><td>{homeHits}</td><td>{homeErrors}</td></tr></tbody></table></div></section>
        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="flex items-center justify-between border-b border-[#26364e] px-3 py-2"><div><p className="text-[10px] font-black text-white">TEAM AT BAT</p><p className="text-[8px] text-[#718198]">{displayTeamName(battingTeam)}</p></div><img src={mlbTeamLogoUrl(battingTeam?.id)} className="h-6 w-6 object-contain" alt=""/></div><div className="h-full overflow-y-auto"><table className="w-full text-[9px]"><thead className="sticky top-0 bg-[#0d1727] text-[#607086]"><tr><th className="px-3 py-2 text-left">BATTER</th><th>AB</th><th>H</th><th>R</th><th>RBI</th></tr></thead><tbody>{battingRows.map((row:any,index:number)=>{const s=row?.stats?.batting??{},active=Number(row?.person?.id)===Number(batter?.id);return <tr key={row?.person?.id??index} className={`border-t border-[#1e3047] ${active?'bg-[#00e6f4]/7':''}`}><td className="max-w-[150px] truncate px-3 py-2 font-bold text-white">{active&&<span className="mr-1 text-[#00e6f4]">●</span>}{playerName(row,'Player')}</td><td className="text-center">{s.atBats??0}</td><td className="text-center">{s.hits??0}</td><td className="text-center">{s.runs??0}</td><td className="text-center">{s.rbi??0}</td></tr>})}</tbody></table></div></section>
      </div>
    </div>

    <button type="button" style={{left:bubbleDrag.pos.x,top:bubbleDrag.pos.y}} className="fixed z-[290] flex h-14 w-14 touch-none items-center justify-center rounded-full border border-[#00e6f4]/65 bg-[#082033] text-[#7df4ff] shadow-[0_12px_35px_rgba(0,0,0,.5),0_0_22px_rgba(0,230,244,.22)]" onPointerDown={bubbleDrag.start} onPointerUp={()=>{if(!bubbleDrag.stop())setChatOpen(v=>!v);}} title="Drag · click for live chat"><span className="material-symbols-outlined">{chatOpen?'close':'chat_bubble'}</span>{!chatOpen&&<span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#65f2b5] shadow-[0_0_10px_rgba(101,242,181,.9)]"/>}</button>

    {chatOpen&&<aside style={{left:chatDrag.pos.x,top:chatDrag.pos.y}} className="fixed z-[285] flex h-[min(680px,calc(100vh-120px))] w-[350px] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] shadow-2xl"><div onPointerDown={chatDrag.start} onPointerUp={()=>chatDrag.stop()} className="flex cursor-move select-none items-center justify-between border-b border-[#26364e] px-4 py-3"><div><p className="text-sm font-black text-white">LIVE GAME CHAT</p><p className="mt-1 text-[9px] text-[#8fa0b7]">Drag this window anywhere.</p></div><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${backendReady?'border-[#65f2b5]/35 text-[#65f2b5]':'border-[#ffd166]/35 text-[#ffd166]'}`}>{backendReady?'LIVE SYNC':'PREVIEW'}</span></div><div className="flex-1 space-y-2 overflow-y-auto p-3">{messages.length?messages.map(message=>{const social=chatSocial[message.id],shownName=social?.display_name||message.display_name,target:SocialProfileTarget={profileId:social?.profile_id||(message.user_id!=='preview-user'?message.user_id:null),displayName:shownName,avatarUrl:social?.avatar_url||null};return <div key={message.id} className="rounded-xl border border-[#26364e] bg-[#10192b] p-3"><div className="flex gap-2"><button onClick={()=>setSelectedSocial(target)}><SocialAvatar displayName={shownName} avatarUrl={social?.avatar_url||null} size="sm"/></button><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><button onClick={()=>setSelectedSocial(target)} className="truncate text-[10px] font-bold text-[#00e6f4]">{shownName}</button><span className="text-[8px] text-[#607086]">{new Date(message.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div><p className="mt-1 break-words text-sm text-[#d7e0ee]">{message.body}</p></div></div></div>}):<div className="rounded-xl border border-dashed border-[#40516b] p-6 text-center text-xs text-[#8fa0b7]">No messages yet.</div>}<div ref={chatEnd}/></div><div className="border-t border-[#26364e] p-3">{!signedIn?<button onClick={onOpenAuth} className="w-full rounded-xl bg-[#00e6f4] py-3 text-xs font-black text-[#062029]">LOG IN TO JOIN LIVE CHAT</button>:<><div className="mb-2 flex gap-1 overflow-x-auto">{CHAT_EMOJIS.map(emoji=><button key={emoji} onClick={()=>setMessageText(v=>`${v}${emoji}`.slice(0,280))} className="h-8 min-w-8 rounded-lg border border-[#30415c] bg-[#10192b]">{emoji}</button>)}</div><div className="flex gap-2"><textarea rows={2} value={messageText} onChange={e=>setMessageText(e.target.value.slice(0,280))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="Chat about the game…" className="min-h-12 flex-1 resize-none rounded-xl border border-[#30415c] bg-[#08111f] px-3 py-2 text-sm text-white outline-none focus:border-[#00e6f4]"/><button onClick={()=>void send()} disabled={!messageText.trim()} className="rounded-xl bg-[#00e6f4] px-4 text-xs font-black text-[#062029] disabled:opacity-35">SEND</button></div></>}</div></aside>}
    <SocialProfileCard target={selectedSocial} signedIn={signedIn} onOpenAuth={onOpenAuth} onClose={()=>setSelectedSocial(null)}/>
  </main>;
};

const Mini:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-lg border border-[#26364e] bg-[#10192b] px-3 py-2"><p className="text-[8px] font-bold text-[#607086]">{label}</p><p className="mt-1 font-mono text-lg font-black text-white">{value}</p></div>;
