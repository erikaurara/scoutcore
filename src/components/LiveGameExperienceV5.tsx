import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { SocialAvatar, SocialProfileCard, type SocialProfileTarget } from './SocialProfileCard';

type Props = { gamePk:number; feed:any; signedIn:boolean; userEmail?:string|null; onOpenAuth:()=>void };
type ChatMessage = { id:string; game_pk:number; user_id:string; display_name:string; body:string; created_at:string };
type ChatSocial = { message_id:string; profile_id?:string|null; display_name?:string|null; avatar_url?:string|null };
type PitchKind = 'four-seam'|'two-seam'|'slider'|'changeup'|'curveball'|'cutter'|'other';

const CHAT_EMOJIS=['🔥','👏','😱','⚾','😂','💙','👀','💪'];
const displayTeamName=(team:any)=>team?.abbreviation??team?.teamName??team?.name??'TEAM';
const playerName=(player:any,fallback='—')=>player?.fullName??player?.name??player?.person?.fullName??fallback;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));

const BASE_POSITIONS:Record<string,[number,number]>={
  pitcher:[50,56],catcher:[50,84],first:[70,62],second:[63,46],shortstop:[37,46],third:[30,62],left:[24,27],center:[50,17],right:[76,27],
};

const RUNNER_POSITIONS:Record<string,[number,number]>={
  home:[50,87],first:[70,67],second:[50,47],third:[30,67],score:[50,92],
};

const PITCH_COLORS:Record<PitchKind,string>={
  'four-seam':'#ff4d5a','two-seam':'#8b5cf6',slider:'#ffd43b',changeup:'#22c55e',curveball:'#38a7ff',cutter:'#ff922b',other:'#00e6f4',
};

const pitchKind=(event:any):PitchKind=>{
  const text=String(event?.details?.type?.description??'').toLowerCase();
  if(text.includes('four-seam')||text.includes('4-seam'))return 'four-seam';
  if(text.includes('two-seam')||text.includes('2-seam')||text.includes('sinker'))return 'two-seam';
  if(text.includes('slider')||text.includes('sweeper'))return 'slider';
  if(text.includes('change'))return 'changeup';
  if(text.includes('curve'))return 'curveball';
  if(text.includes('cutter'))return 'cutter';
  return 'other';
};

const useDraggable=(initial:{x:number;y:number},bounds:{w:number;h:number})=>{
  const [pos,setPos]=useState(initial); const drag=useRef<{x:number;y:number;sx:number;sy:number;moved:boolean}|null>(null);
  useEffect(()=>{const move=(e:PointerEvent)=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.sx,dy=e.clientY-d.sy;if(Math.abs(dx)+Math.abs(dy)>4)d.moved=true;setPos({x:clamp(d.x+dx,8,window.innerWidth-bounds.w),y:clamp(d.y+dy,8,window.innerHeight-bounds.h)});};const up=()=>{};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};},[bounds.h,bounds.w]);
  const start=(e:React.PointerEvent)=>{drag.current={x:pos.x,y:pos.y,sx:e.clientX,sy:e.clientY,moved:false};};
  const stop=()=>{const moved=drag.current?.moved??false;drag.current=null;return moved;};
  return {pos,start,stop};
};

const inferBallTarget=(description:string):{x:number;y:number;fielder:string;kind:string}=>{
  const d=description.toLowerCase();
  if(d.includes('home run')) return {x:d.includes('left')?24:d.includes('right')?76:50,y:5,fielder:d.includes('left')?'left':d.includes('right')?'right':'center',kind:'home-run'};
  if(d.includes('left field')||d.includes('left fielder')) return {x:25,y:25,fielder:'left',kind:d.includes('fly')?'fly':d.includes('ground')?'ground':'line'};
  if(d.includes('center field')||d.includes('center fielder')) return {x:50,y:17,fielder:'center',kind:d.includes('fly')?'fly':d.includes('ground')?'ground':'line'};
  if(d.includes('right field')||d.includes('right fielder')) return {x:75,y:25,fielder:'right',kind:d.includes('fly')?'fly':d.includes('ground')?'ground':'line'};
  if(d.includes('shortstop')) return {x:39,y:48,fielder:'shortstop',kind:'ground'};
  if(d.includes('second baseman')) return {x:61,y:48,fielder:'second',kind:'ground'};
  if(d.includes('third baseman')) return {x:31,y:61,fielder:'third',kind:'ground'};
  if(d.includes('first baseman')) return {x:69,y:61,fielder:'first',kind:'ground'};
  if(d.includes('pitcher')) return {x:50,y:55,fielder:'pitcher',kind:'ground'};
  if(d.includes('catcher')) return {x:50,y:81,fielder:'catcher',kind:'popup'};
  return {x:50,y:26,fielder:'center',kind:d.includes('ground')?'ground':d.includes('pop')?'popup':d.includes('fly')?'fly':'line'};
};

const runnerClass=(runner:any)=>{
  const start=String(runner?.movement?.start??'').toLowerCase();
  const end=String(runner?.movement?.end??'').toLowerCase();
  const s=start.includes('home')?'home':start.includes('1')||start.includes('first')?'first':start.includes('2')||start.includes('second')?'second':start.includes('3')||start.includes('third')?'third':'';
  const e=end.includes('home')?'score':end.includes('1')||end.includes('first')?'first':end.includes('2')||end.includes('second')?'second':end.includes('3')||end.includes('third')?'third':'';
  return s&&e?`scoutcore-run-${s}-${e}`:'';
};

const normalizeBase=(value:any, fallback='')=>{
  const base=String(value??'').toLowerCase();
  if(base.includes('home')||base.includes('score'))return base.includes('score')?'score':'home';
  if(base.includes('1')||base.includes('first'))return 'first';
  if(base.includes('2')||base.includes('second'))return 'second';
  if(base.includes('3')||base.includes('third'))return 'third';
  return fallback;
};

const mobileRunnerMotion=(runner:any,index:number)=>{
  const start=normalizeBase(runner?.movement?.start,'home');
  const isOut=Boolean(runner?.movement?.isOut);
  const end=normalizeBase(runner?.movement?.end,isOut?'first':start);
  const [startX,startY]=RUNNER_POSITIONS[start]??RUNNER_POSITIONS.home;
  const [endX,endY]=RUNNER_POSITIONS[end]??RUNNER_POSITIONS.first;
  return {id:String(runner?.details?.runner?.id??runner?.details?.playIndex??index),startX,startY,endX,endY,isOut,label:index+1};
};

export const LiveGameExperienceV5:React.FC<Props>=({gamePk,feed,signedIn,userEmail,onOpenAuth})=>{
  const [chatOpen,setChatOpen]=useState(false);
  const [pitchExpanded,setPitchExpanded]=useState(false);
  const [mobileView,setMobileView]=useState<'pitch'|'field'>('pitch');
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
  const latestEvent=events[events.length-1]??null;
  const recentPitches=events.filter((e:any)=>e?.isPitch||e?.details?.isPitch).slice(-6);
  const latestPitch=recentPitches[recentPitches.length-1]??null;
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
  const latestDescription=latestEvent?.details?.description??currentPlay?.result?.description??currentPlay?.result?.event??'Waiting for the next verified MLB event…';
  const offense=linescore?.offense??{},defense=linescore?.defense??{};
  const battingSide=linescore?.isTopInning?'away':'home'; const battingTeam=battingSide==='away'?awayTeam:homeTeam; const battingBox=boxscore?.teams?.[battingSide]??{};
  const innings=Array.isArray(linescore?.innings)?linescore.innings:[];
  const battingRows=(Array.isArray(battingBox?.batters)?battingBox.batters:[]).map((id:number)=>battingBox?.players?.[`ID${id}`]).filter(Boolean).slice(0,9);
  const fielders=[['pitcher','P',defense?.pitcher],['catcher','C',defense?.catcher],['first','1B',defense?.first],['second','2B',defense?.second],['shortstop','SS',defense?.shortstop],['third','3B',defense?.third],['left','LF',defense?.left],['center','CF',defense?.center],['right','RF',defense?.right]] as const;
  const eventKey=String(latestEvent?.playId??currentPlay?.playEndTime??`${currentPlay?.atBatIndex??'pregame'}-${latestEvent?.index??events.length}`);
  const descriptionForMotion=[currentPlay?.result?.description,latestEvent?.details?.description,currentPlay?.result?.event].filter(Boolean).join(' · ');
  const target=inferBallTarget(descriptionForMotion);
  const isPitchEvent=Boolean(latestEvent?.isPitch||latestEvent?.details?.isPitch);
  const isContactEvent=Boolean(latestEvent?.details?.isInPlay||latestEvent?.hitData||/in play|singles|doubles|triples|home run|grounds|flies|lines|pops|reaches on|fielders choice/i.test(descriptionForMotion));
  const pitchX=Number(latestPitch?.pitchData?.coordinates?.pX);
  const pitchEndX=Number.isFinite(pitchX)?`${50+clamp(pitchX/1.5,-1,1)*26}%`:'50%';
  const motionClasses=[
    'scoutcore-live-motion',
    isContactEvent?'scoutcore-motion-contact':isPitchEvent?'scoutcore-motion-pitch':'',
    isContactEvent?`scoutcore-ball-${target.kind}`:'',
    ...(Array.isArray(currentPlay?.runners)?currentPlay.runners.map(runnerClass).filter(Boolean):[]),
  ].filter(Boolean).join(' ');
  const motionStyle={'--sc-ball-target-x':`${target.x}%`,'--sc-ball-target-y':`${target.y}%`,'--sc-pitch-end-x':pitchEndX} as React.CSSProperties;
  const rawRunnerMotions=Array.isArray(currentPlay?.runners)?currentPlay.runners.map(mobileRunnerMotion):[];
  const fallbackRunnerEnd=/home run/i.test(descriptionForMotion)?'score':/triples/i.test(descriptionForMotion)?'third':/doubles/i.test(descriptionForMotion)?'second':'first';
  const [fallbackRunnerX,fallbackRunnerY]=RUNNER_POSITIONS[fallbackRunnerEnd];
  const runnerMotions=isContactEvent&&rawRunnerMotions.length===0?[{id:'batter',startX:50,startY:87,endX:fallbackRunnerX,endY:fallbackRunnerY,isOut:/out|grounds|flies|lines|pops/i.test(descriptionForMotion),label:1}]:rawRunnerMotions;
  const staticRunners=[['first',offense?.first],['second',offense?.second],['third',offense?.third]].filter(([,runner])=>Boolean(runner)).map(([base,runner],index)=>{const [x,y]=RUNNER_POSITIONS[String(base)];return{id:String((runner as any)?.id??base),startX:x,startY:y,endX:x,endY:y,isOut:false,label:index+1};});
  const fieldBallMidX=50+(target.x-50)*.42;
  const fieldBallMidY=Math.max(5,Math.min(48,target.y-24));

  const pitchDot=(event:any)=>{const x=Number(event?.pitchData?.coordinates?.pX),z=Number(event?.pitchData?.coordinates?.pZ);if(!Number.isFinite(x)||!Number.isFinite(z))return{left:'50%',top:'50%'};return{left:`${50+clamp(x/1.5,-1,1)*39}%`,top:`${86-clamp((z-1)/3,0,1)*72}%`};};
  const latestPitchDot=pitchDot(latestPitch);
  const playComplete=Boolean(currentPlay?.about?.isComplete);
  const latestCall=(playComplete?currentPlay?.result?.event:null)??latestEvent?.details?.call?.description??currentPlay?.result?.event??(isFinal?'Game Final':'Live update');
  const liveSummary=(playComplete?currentPlay?.result?.description:null)??latestDescription;
  const latestSpeed=Number(latestPitch?.pitchData?.startSpeed);
  const latestPitchMeta=[latestPitch?.details?.type?.description,Number.isFinite(latestSpeed)?`${latestSpeed.toFixed(1)} mph`:null].filter(Boolean).join(' · ');

  useEffect(()=>{let cancelled=false;const load=async()=>{setDisplayName(userEmail?.split('@')[0]||'ScoutCore User');if(!supabase){setBackendReady(false);return;}let uid:string|null=null;if(signedIn){const{data}=await supabase.auth.getUser();uid=data.user?.id??null;if(data.user){setUserId(uid);const m=data.user.user_metadata??{};setDisplayName(m.display_name||m.full_name||data.user.email?.split('@')[0]||'ScoutCore User');await supabase.rpc('sync_my_social_profile');}}const[messagesResult,socialResult]=await Promise.all([supabase.from('game_chat_messages').select('id,game_pk,user_id,display_name,body,created_at').eq('game_pk',gamePk).order('created_at',{ascending:false}).limit(50),supabase.rpc('get_game_chat_social_profiles',{p_game_pk:gamePk,p_limit:50})]);if(cancelled)return;if(messagesResult.error){setBackendReady(false);return;}setBackendReady(true);setMessages([...(messagesResult.data??[])].reverse() as ChatMessage[]);if(!socialResult.error){const next:Record<string,ChatSocial>={};for(const row of(socialResult.data??[])as ChatSocial[])next[row.message_id]=row;setChatSocial(next);}};void load();return()=>{cancelled=true;};},[gamePk,signedIn,userEmail]);
  useEffect(()=>{if(!backendReady||!supabase)return;const channel=supabase.channel(`live-chat-v5-${gamePk}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'game_chat_messages',filter:`game_pk=eq.${gamePk}`},payload=>{const incoming=payload.new as ChatMessage;setMessages(current=>current.some(m=>m.id===incoming.id)?current:[...current,incoming].slice(-50));}).subscribe();return()=>{void supabase.removeChannel(channel);};},[backendReady,gamePk]);
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages.length,chatOpen]);
  useEffect(()=>{if(isContactEvent)setMobileView('field');else if(isPitchEvent)setMobileView('pitch');},[eventKey,isContactEvent,isPitchEvent]);

  const send=async()=>{const body=messageText.trim().slice(0,280);if(!body)return;if(!signedIn){onOpenAuth();return;}if(!supabase||!backendReady||!userId)return;const{error}=await supabase.from('game_chat_messages').insert({game_pk:gamePk,user_id:userId,display_name:displayName.slice(0,48),body});if(!error)setMessageText('');};

  return <main className="sc-live-experience mx-auto h-screen max-w-[1780px] overflow-y-auto px-3 py-3 text-[#dae2fd] sm:px-4 lg:overflow-hidden">
    <section className="mb-2 hidden rounded-xl border border-[#2b405b] bg-[#0b1524] pr-20 lg:block">
      <div className="grid min-h-[70px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-2">
        <div><p className="text-[10px] font-black tracking-[.16em] text-[#00e6f4]">SCOUTCORE LIVE SIM</p><p className="mt-1 text-[9px] text-[#73849a]">Verified MLB events visualized live.</p></div>
        <div className="flex items-center gap-4 rounded-xl border border-[#243751] bg-[#07101d] px-4 py-2">
          <div className="flex items-center gap-2"><img src={mlbTeamLogoUrl(awayTeam?.id)} className="h-7 w-7 object-contain" alt=""/><b>{displayTeamName(awayTeam)}</b><span className="font-mono text-xl font-black text-white">{awayRuns}</span></div>
          <span className="rounded border border-[#33465f] px-2 py-1 font-mono text-[9px] font-bold text-[#8fa0b7]">{inningLabel}</span>
          <div className="flex items-center gap-2"><span className="font-mono text-xl font-black text-white">{homeRuns}</span><b>{displayTeamName(homeTeam)}</b><img src={mlbTeamLogoUrl(homeTeam?.id)} className="h-7 w-7 object-contain" alt=""/></div>
        </div>
        <div />
      </div>
    </section>

    <div className="sc-live-lens-mobile lg:hidden">
      <div className="sc-live-lens-score-stack">
        <header className="sc-live-lens-header">
          <div className="sc-live-lens-brand">
            <span className="sc-live-lens-live-dot"/>
            <div><strong>SCOUTCORE LIVE LENS</strong><small>Verified MLB events visualized live</small></div>
          </div>
          <span className="sc-live-lens-status">{isFinal?'FINAL':'LIVE'}</span>
        </header>

        <section className="sc-live-lens-score" aria-label={`${displayTeamName(awayTeam)} ${awayRuns}, ${displayTeamName(homeTeam)} ${homeRuns}`}>
          <div className="sc-live-lens-team is-away">
            <img src={mlbTeamLogoUrl(awayTeam?.id)} alt=""/>
            <div><span>AWAY</span><strong>{displayTeamName(awayTeam)}</strong></div>
            <b>{awayRuns}</b>
          </div>
          <div className="sc-live-lens-game-state">
            <strong>{inningLabel}</strong>
            <span>{outs} {outs===1?'OUT':'OUTS'}</span>
          </div>
          <div className="sc-live-lens-team is-home">
            <b>{homeRuns}</b>
            <div><span>HOME</span><strong>{displayTeamName(homeTeam)}</strong></div>
            <img src={mlbTeamLogoUrl(homeTeam?.id)} alt=""/>
          </div>
        </section>
      </div>

      <nav className="sc-live-lens-switch" aria-label="Simulation view">
        <button type="button" aria-pressed={mobileView==='pitch'} className={mobileView==='pitch'?'is-active':''} onClick={()=>setMobileView('pitch')}>PITCH VIEW</button>
        <button type="button" aria-pressed={mobileView==='field'} className={mobileView==='field'?'is-active':''} onClick={()=>setMobileView('field')}>FIELD VIEW</button>
      </nav>

      <section className="sc-live-lens-stage-card">
        <div className="sc-live-lens-stage-head">
          <div><span>LIVE SIMULATION</span><strong>{mobileView==='pitch'?'Pitch location':'Ball, runners + fielders'}</strong></div>
          <small>EVENT {events.length||'—'}</small>
        </div>

        {mobileView==='pitch'?<div key={`pitch-${eventKey}`} className="sc-live-pitch-stage">
          <div className="sc-live-duel is-pitcher">
            <div className="sc-live-player-cutout"><img src={mlbPlayerHeadshotUrl(pitcher?.id,120)} alt=""/></div>
            <span>PITCHING</span><strong>{playerName(pitcher,'Pitcher')}</strong>
          </div>
          <div className="sc-live-pitch-lane">
            <span className="sc-live-pitch-origin">P</span>
            <div className="sc-live-strike-zone">
              <i/><i/><i/><i/><i/><i/><i/><i/><i/>
              {recentPitches.map((event:any,index:number)=><span key={event?.playId??event?.index??index} style={{...pitchDot(event),backgroundColor:PITCH_COLORS[pitchKind(event)]}} className={`sc-live-pitch-dot ${index===recentPitches.length-1?'is-latest':''}`}>{index+1}</span>)}
              {latestPitch&&<span style={{'--sc-end-x':latestPitchDot.left,'--sc-end-y':latestPitchDot.top,'--sc-pitch-color':PITCH_COLORS[pitchKind(latestPitch)]} as React.CSSProperties} className="sc-live-pitch-flight"/>}
            </div>
            <span className="sc-live-plate">HOME</span>
          </div>
          <div className="sc-live-duel is-batter">
            <div className="sc-live-player-cutout"><img src={mlbPlayerHeadshotUrl(batter?.id,120)} alt=""/></div>
            <span>AT BAT</span><strong>{playerName(batter,'Batter')}</strong>
          </div>
        </div>:<div key={`field-${eventKey}`} style={{'--sc-field-ball-x':`${target.x}%`,'--sc-field-ball-y':`${target.y}%`,'--sc-field-ball-mid-x':`${fieldBallMidX}%`,'--sc-field-ball-mid-y':`${fieldBallMidY}%`} as React.CSSProperties} className={`sc-live-field-stage ${isContactEvent?'has-contact':''}`}>
          <div className="sc-live-field-foul is-left"/><div className="sc-live-field-foul is-right"/>
          <span className={`sc-live-field-base is-second ${offense?.second?'is-active':''}`}>2</span>
          <span className={`sc-live-field-base is-first ${offense?.first?'is-active':''}`}>1</span>
          <span className={`sc-live-field-base is-third ${offense?.third?'is-active':''}`}>3</span>
          <span className="sc-live-field-base is-home">H</span>
          {fielders.map(([key,label],index)=>{const [left,top]=BASE_POSITIONS[key];const primary=isContactEvent&&key===target.fielder;const coverage=primary ? 2.6 : key==='catcher' ? 0.3 : key==='pitcher' ? 0.7 : 0.46;const direction=target.x<45?-1:1;const dx=(target.x-left)*coverage+(primary?direction*10:0),dy=(target.y-top)*coverage*.8+(primary?(target.kind==='home-run'?-8:10):0);return <span key={key} style={{left:`${left}%`,top:`${top}%`,'--sc-fielder-x':`${dx}px`,'--sc-fielder-y':`${dy}px`,'--sc-fielder-delay':`${Math.min(index*.035,.22)}s`} as React.CSSProperties} className={`sc-live-fielder ${primary?'is-target':''}`}>{label}</span>})}
          {(isContactEvent?runnerMotions:staticRunners).map((runner)=><span key={`runner-${runner.id}`} style={{'--sc-runner-start-x':`${runner.startX}%`,'--sc-runner-start-y':`${runner.startY}%`,'--sc-runner-end-x':`${runner.endX}%`,'--sc-runner-end-y':`${runner.endY}%`} as React.CSSProperties} className={`sc-live-runner ${isContactEvent?'is-moving':'is-static'} ${runner.isOut?'is-out':''}`}>R{runner.label}</span>)}
          <span className="sc-live-field-contact-pop"/>
          <span className="sc-live-field-impact"/>
          <span className="sc-live-field-ball">⚾</span>
          <div className="sc-live-field-key"><span><i className="is-runner"/>Runner</span><span><i className="is-defense"/>Defense</span></div>
        </div>}
      </section>

      <section className="sc-live-now-card">
        <div className="sc-live-now-heading"><span>NOW</span><strong>{latestCall}</strong><small>{inningLabel}</small></div>
        <p>{liveSummary}</p>
        <div className="sc-live-now-stats">
          <div><span>COUNT</span><strong>{balls}–{strikes}</strong></div>
          <div><span>OUTS</span><strong>{outs}</strong></div>
          <div><span>LATEST PITCH</span><strong>{latestPitchMeta||'Waiting'}</strong></div>
        </div>
      </section>

      <section className="sc-live-sequence-card">
        <div className="sc-live-section-title"><div><span>THIS AT-BAT</span><strong>Pitch sequence</strong></div><small>Newest on right</small></div>
        <div className="sc-live-pitch-sequence">
          {recentPitches.length?recentPitches.map((event:any,index:number)=><div key={event?.playId??event?.index??index} className={index===recentPitches.length-1?'is-current':''}><span style={{backgroundColor:PITCH_COLORS[pitchKind(event)]}}>{index+1}</span><strong>{event?.details?.type?.code??event?.details?.type?.description?.split(' ')[0]??'P'}</strong><small>{event?.details?.call?.code??'—'}</small></div>):<p>Pitch tracking will appear when the at-bat begins.</p>}
        </div>
      </section>

      <section className="sc-live-events-card">
        <div className="sc-live-section-title"><div><span>GAME FLOW</span><strong>Recent verified events</strong></div><small>Scroll inside</small></div>
        <div className="sc-live-events-scroll">
          {recentPlays.length?recentPlays.map((play:any,index:number)=><article key={play?.atBatIndex??index} className={index===0?'is-latest':''}>
            <span>{play?.about?.halfInning?`${String(play.about.halfInning).slice(0,3).toUpperCase()} ${play?.about?.inning??''}`:'GAME'}</span>
            <div><strong>{play?.result?.event??'Game event'}</strong><p>{play?.result?.description??'Verified game event'}</p></div>
          </article>):<p className="sc-live-events-empty">Verified play-by-play will appear here.</p>}
        </div>
      </section>

      <p className="sc-live-lens-note">Live visualization of verified MLB events. Field movement is inferred from the official play description.</p>
    </div>

    <div className="hidden h-[calc(100vh-90px)] grid-cols-[260px_minmax(520px,1fr)_320px] gap-2 lg:grid">
      <div className="flex min-h-0 flex-col gap-2">
        <section className="rounded-xl border border-[#2b405b] bg-[#0d1727] p-3">
          <p className="text-[10px] font-black tracking-[.14em] text-[#00e6f4]">AT BAT / PITCHING</p>
          <div className="mt-3 flex items-center gap-3"><img src={mlbPlayerHeadshotUrl(batter?.id,120)} className="h-14 w-14 rounded-xl border border-[#2b405b] bg-[#10192b] object-contain" alt=""/><div className="min-w-0"><p className="truncate text-sm font-black text-white">{playerName(batter,'Batter')}</p><p className="mt-1 truncate text-[10px] text-[#8fa0b7]">vs {playerName(pitcher,'Pitcher')}</p></div></div>
          <div className="mt-3 grid grid-cols-[112px_1fr] gap-2"><div className="relative h-[132px] rounded-lg border border-[#26364e] bg-[#07101d]"><div className="absolute inset-x-[25%] bottom-[18%] top-[18%] grid grid-cols-3 grid-rows-3 border border-[#6b8099]"><i className="border-b border-r border-[#31445e]"/><i className="border-b border-r border-[#31445e]"/><i className="border-b border-[#31445e]"/><i className="border-b border-r border-[#31445e]"/><i className="border-b border-r border-[#31445e]"/><i className="border-b border-[#31445e]"/><i className="border-r border-[#31445e]"/><i className="border-r border-[#31445e]"/><i/></div>{recentPitches.map((event:any,index:number)=><span key={event?.playId??event?.index??index} style={{...pitchDot(event),backgroundColor:PITCH_COLORS[pitchKind(event)]}} className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[7px] font-black text-[#05111c] shadow-[0_0_0_1px_rgba(255,255,255,.18)]">{index+1}</span>)}</div><div className="space-y-2"><Mini label="COUNT" value={`${balls}-${strikes}`}/><Mini label="OUTS" value={String(outs)}/></div></div>
          <p className="mt-3 line-clamp-2 text-[10px] leading-4 text-[#c2cede]">{latestDescription}</p>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]">
          <div className="border-b border-[#26364e] px-3 py-2"><p className="text-[10px] font-black text-white">PITCH SEQUENCE</p></div>
          {latestPitch?<><button type="button" onClick={()=>setPitchExpanded(v=>!v)} className="flex w-full items-center gap-2 px-3 py-2 text-left"><span style={{backgroundColor:PITCH_COLORS[pitchKind(latestPitch)]}} className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black text-[#06101c]">{recentPitches.length}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-white">{latestPitch?.details?.type?.description??'Pitch'}</p><p className="text-[8px] text-[#718198]">{latestPitch?.details?.call?.description??'Tracked'}</p></div><span className="font-mono text-[9px] text-[#9dafc3]">{Number.isFinite(Number(latestPitch?.pitchData?.startSpeed))?`${Number(latestPitch.pitchData.startSpeed).toFixed(1)} mph`:'—'}</span><span className="material-symbols-outlined text-[16px] text-[#8fa0b7]">{pitchExpanded?'expand_less':'expand_more'}</span></button>{pitchExpanded&&<div className="max-h-40 overflow-y-auto border-t border-[#1e3047]">{[...recentPitches].reverse().slice(1).map((event:any,index:number)=><div key={event?.playId??event?.index??index} className="flex items-center gap-2 border-b border-[#1e3047] px-3 py-2"><span style={{backgroundColor:PITCH_COLORS[pitchKind(event)]}} className="h-3 w-3 rounded-full"/><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold text-white">{event?.details?.type?.description??'Pitch'}</p><p className="text-[8px] text-[#718198]">{event?.details?.call?.description??'Tracked'}</p></div><span className="font-mono text-[8px] text-[#9dafc3]">{Number.isFinite(Number(event?.pitchData?.startSpeed))?`${Number(event.pitchData.startSpeed).toFixed(1)} mph`:'—'}</span></div>)}</div>}</>:<p className="p-4 text-center text-[10px] text-[#718198]">Pitch tracking will appear here.</p>}
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727] p-3"><p className="text-[10px] font-black text-white">PITCH TYPE LEGEND</p><div className="mt-3 space-y-2 text-[9px] text-[#c7d2df]">{([['four-seam','4-Seam Fastball'],['two-seam','2-Seam / Sinker'],['slider','Slider / Sweeper'],['changeup','Changeup'],['curveball','Curveball'],['cutter','Cutter']] as [PitchKind,string][]).map(([kind,label])=><div key={kind} className="flex items-center gap-2"><span style={{backgroundColor:PITCH_COLORS[kind]}} className="h-3 w-3 rounded-full"/><span>{label}</span></div>)}</div></section>
      </div>

      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_190px] gap-2">
        <section className="min-h-0 overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="border-b border-[#26364e] px-3 py-2"><p className="text-[10px] font-black tracking-[.14em] text-white">LIVE FIELD SIMULATION</p><p className="mt-1 text-[8px] text-[#718198]">Moves from verified pitch and play-by-play events.</p></div><div key={eventKey} style={motionStyle} className={`scoutcore-sim-field ${motionClasses} relative h-[calc(100%-48px)] min-h-[360px] overflow-hidden`}><div className="scoutcore-sim-diamond"/><div className={`scoutcore-sim-base scoutcore-sim-base-second ${offense?.second?'is-active':''}`}><span>2B</span></div><div className={`scoutcore-sim-base scoutcore-sim-base-first ${offense?.first?'is-active':''}`}><span>1B</span></div><div className={`scoutcore-sim-base scoutcore-sim-base-third ${offense?.third?'is-active':''}`}><span>3B</span></div><div className="scoutcore-sim-home"><span>HOME</span></div><div className="scoutcore-sim-mound"><span>P</span></div><div className="scoutcore-sim-ball">⚾</div>{fielders.map(([key,label,player])=>{const [left,top]=BASE_POSITIONS[key];const reacts=isContactEvent&&key===target.fielder;const dx=(target.x-left)*2.4,dy=(target.y-top)*2.0;return <div key={`${key}-${eventKey}`} style={{left:`${left}%`,top:`${top}%`,'--sc-field-x':`${dx}px`,'--sc-field-y':`${dy}px`} as React.CSSProperties} className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center ${reacts?'scoutcore-fielder-react':''}`}><div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-[#00e6f4]/45 bg-[#071522]/90 text-[8px] font-black text-[#00e6f4]">{label}</div><span className="mt-1 block max-w-[90px] truncate rounded bg-[#06101c]/80 px-1.5 py-0.5 text-[8px] font-bold text-[#d7e1ef]">{playerName(player,label)}</span></div>})}<div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#33465f] bg-[#07101d]/95 px-3 py-2 shadow-xl"><img src={mlbPlayerHeadshotUrl(batter?.id,80)} className="h-9 w-9 rounded-lg object-contain" alt=""/><div><p className="text-[7px] font-bold uppercase tracking-wider text-[#8fa0b7]">Batting</p><p className="text-xs font-black text-white">{playerName(batter,'Batter')}</p><p className="text-[8px] text-[#8fa0b7]">{currentPlay?.matchup?.batSide?.code??''}</p></div></div></div></section>
        <section className="overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="flex items-center justify-between border-b border-[#26364e] px-3 py-2"><p className="text-[10px] font-black text-white">LIVE FEED</p><span className="text-[8px] font-bold text-[#65f2b5]">VERIFIED</span></div><div className="h-[152px] overflow-y-auto">{recentPlays.length?recentPlays.map((play:any,index:number)=><div key={play?.atBatIndex??index} className="grid grid-cols-[52px_1fr] gap-2 border-b border-[#1e3047] px-3 py-2"><span className="font-mono text-[8px] font-bold text-[#00e6f4]">{play?.about?.halfInning?`${String(play.about.halfInning).slice(0,3).toUpperCase()} ${play?.about?.inning??''}`:'GAME'}</span><p className="text-[10px] leading-4 text-[#c4d0df]">{play?.result?.description??play?.result?.event??'Verified game event'}</p></div>):<p className="p-4 text-center text-[10px] text-[#718198]">Verified play-by-play will appear here.</p>}</div></section>
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <section className="rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="border-b border-[#26364e] px-3 py-2 text-[10px] font-black text-white">LINE SCORE</div><div className="overflow-x-auto p-2"><table className="w-full min-w-[280px] text-center text-[8px]"><thead className="text-[#607086]"><tr><th className="text-left">TEAM</th>{innings.slice(0,9).map((i:any)=><th key={i?.num}>{i?.num}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead><tbody className="font-mono text-[#d7e1ef]"><tr><td className="py-2 text-left font-sans font-black">{displayTeamName(awayTeam)}</td>{innings.slice(0,9).map((i:any)=><td key={i?.num}>{i?.away?.runs??'—'}</td>)}<td className="text-[#00e6f4]">{awayRuns}</td><td>{awayHits}</td><td>{awayErrors}</td></tr><tr className="border-t border-[#1e3047]"><td className="py-2 text-left font-sans font-black">{displayTeamName(homeTeam)}</td>{innings.slice(0,9).map((i:any)=><td key={i?.num}>{i?.home?.runs??'—'}</td>)}<td className="text-[#00e6f4]">{homeRuns}</td><td>{homeHits}</td><td>{homeErrors}</td></tr></tbody></table></div></section>
        <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#2b405b] bg-[#0d1727]"><div className="flex items-center justify-between border-b border-[#26364e] px-3 py-2"><div><p className="text-[10px] font-black text-white">BOX SCORE</p><p className="text-[8px] text-[#718198]">{displayTeamName(battingTeam)} <span className="ml-1 text-[#00e6f4]">LIVE</span></p></div><img src={mlbTeamLogoUrl(battingTeam?.id)} className="h-6 w-6 object-contain" alt=""/></div><div className="h-full overflow-y-auto"><table className="w-full text-[8px]"><thead className="sticky top-0 bg-[#0d1727] text-[#607086]"><tr><th className="px-3 py-2 text-left">BATTER</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>SO</th><th>AVG</th></tr></thead><tbody>{battingRows.map((row:any,index:number)=>{const s=row?.stats?.batting??{},active=Number(row?.person?.id)===Number(batter?.id);const avg=Number(s.avg);return <tr key={row?.person?.id??index} className={`border-t border-[#1e3047] ${active?'bg-[#00e6f4]/10':''}`}><td className="max-w-[120px] truncate px-3 py-2 font-bold text-white">{active&&<span className="mr-1 text-[#00e6f4]">●</span>}{playerName(row,'Player')}</td><td className="text-center">{s.atBats??0}</td><td className="text-center">{s.runs??0}</td><td className="text-center">{s.hits??0}</td><td className="text-center">{s.rbi??0}</td><td className="text-center">{s.baseOnBalls??0}</td><td className="text-center">{s.strikeOuts??0}</td><td className="text-center">{Number.isFinite(avg)?avg.toFixed(3).replace(/^0/,''):s.avg??'—'}</td></tr>})}</tbody></table></div></section>
      </div>
    </div>

    <button type="button" style={{left:bubbleDrag.pos.x,top:bubbleDrag.pos.y}} className="sc-live-chat-bubble fixed z-[290] flex h-14 w-14 touch-none items-center justify-center rounded-full border border-[#00e6f4]/65 bg-[#082033] text-[#7df4ff] shadow-[0_12px_35px_rgba(0,0,0,.5),0_0_22px_rgba(0,230,244,.22)]" onPointerDown={bubbleDrag.start} onPointerUp={()=>{if(!bubbleDrag.stop())setChatOpen(v=>!v);}} title="Drag · click for live chat"><span className="material-symbols-outlined">{chatOpen?'close':'chat_bubble'}</span>{!chatOpen&&<span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#65f2b5] shadow-[0_0_10px_rgba(101,242,181,.9)]"/>}</button>

    {chatOpen&&<aside style={{left:chatDrag.pos.x,top:chatDrag.pos.y}} className="fixed z-[285] flex h-[min(680px,calc(100vh-120px))] w-[350px] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] shadow-2xl"><div onPointerDown={chatDrag.start} onPointerUp={()=>chatDrag.stop()} className="flex cursor-move select-none items-center justify-between border-b border-[#26364e] px-4 py-3"><div><p className="text-sm font-black text-white">LIVE GAME CHAT</p><p className="mt-1 text-[9px] text-[#8fa0b7]">Drag this window anywhere.</p></div><span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${backendReady?'border-[#65f2b5]/35 text-[#65f2b5]':'border-[#ffd166]/35 text-[#ffd166]'}`}>{backendReady?'LIVE SYNC':'PREVIEW'}</span></div><div className="flex-1 space-y-2 overflow-y-auto p-3">{messages.length?messages.map(message=>{const social=chatSocial[message.id],shownName=social?.display_name||message.display_name,targetProfile:SocialProfileTarget={profileId:social?.profile_id||(message.user_id!=='preview-user'?message.user_id:null),displayName:shownName,avatarUrl:social?.avatar_url||null};return <div key={message.id} className="rounded-xl border border-[#26364e] bg-[#10192b] p-3"><div className="flex gap-2"><button onClick={()=>setSelectedSocial(targetProfile)}><SocialAvatar displayName={shownName} avatarUrl={social?.avatar_url||null} size="sm"/></button><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><button onClick={()=>setSelectedSocial(targetProfile)} className="truncate text-[10px] font-bold text-[#00e6f4]">{shownName}</button><span className="text-[8px] text-[#607086]">{new Date(message.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div><p className="mt-1 break-words text-sm text-[#d7e0ee]">{message.body}</p></div></div></div>}):<div className="rounded-xl border border-dashed border-[#40516b] p-6 text-center text-xs text-[#8fa0b7]">No messages yet.</div>}<div ref={chatEnd}/></div><div className="border-t border-[#26364e] p-3">{!signedIn?<button onClick={onOpenAuth} className="w-full rounded-xl bg-[#00e6f4] py-3 text-xs font-black text-[#062029]">LOG IN TO JOIN LIVE CHAT</button>:<><div className="mb-2 flex gap-1 overflow-x-auto">{CHAT_EMOJIS.map(emoji=><button key={emoji} onClick={()=>setMessageText(v=>`${v}${emoji}`.slice(0,280))} className="h-8 min-w-8 rounded-lg border border-[#30415c] bg-[#10192b]">{emoji}</button>)}</div><div className="flex gap-2"><textarea rows={2} value={messageText} onChange={e=>setMessageText(e.target.value.slice(0,280))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="Chat about the game…" className="min-h-12 flex-1 resize-none rounded-xl border border-[#30415c] bg-[#08111f] px-3 py-2 text-sm text-white outline-none focus:border-[#00e6f4]"/><button onClick={()=>void send()} disabled={!messageText.trim()} className="rounded-xl bg-[#00e6f4] px-4 text-xs font-black text-[#062029] disabled:opacity-35">SEND</button></div></>}</div></aside>}
    <SocialProfileCard target={selectedSocial} signedIn={signedIn} onOpenAuth={onOpenAuth} onClose={()=>setSelectedSocial(null)}/>
  </main>;
};

const Mini:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-lg border border-[#26364e] bg-[#10192b] px-3 py-2"><p className="text-[8px] font-bold text-[#607086]">{label}</p><p className="mt-1 font-mono text-lg font-black text-white">{value}</p></div>;
