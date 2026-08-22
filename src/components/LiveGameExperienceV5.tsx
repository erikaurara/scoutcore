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
const compactPlayerName=(player:any,fallback='Batter')=>{
  const full=String(playerName(player,fallback)).trim();
  const parts=full.split(/\s+/).filter(Boolean);
  const suffix=/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts.at(-1)??'');
  return suffix?(parts.at(-2)??parts.at(-1)??fallback):(parts.at(-1)??fallback);
};
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));

const BASE_POSITIONS:Record<string,[number,number]>={
  pitcher:[50,56],catcher:[50,84],first:[70,62],second:[63,46],shortstop:[37,46],third:[30,62],left:[24,27],center:[50,17],right:[76,27],
};

const DESKTOP_FIELD_POSITIONS:Record<string,[number,number]>={
  pitcher:[50,45],catcher:[50,82],first:[76,40],second:[61,32],shortstop:[39,32],third:[24,40],left:[19,18],center:[50,11],right:[81,18],
};

const RUNNER_POSITIONS:Record<string,[number,number]>={
  home:[50,87],first:[70,67],second:[50,47],third:[30,67],score:[50,92],
};

const desktopRunnerPoint=(x:number,y:number):[number,number]=>{
  if(y>=90)return[50,91];
  if(y>=82)return[50,82];
  if(y>=58&&x>=60)return[79,40];
  if(y>=58&&x<=40)return[21,40];
  if(y>=42&&y<=54)return[50,25];
  return[x,y];
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

const useDraggable=(initial:{x:number;y:number},bounds:{w:number;h:number;snapX?:boolean})=>{
  const [pos,setPos]=useState(initial);
  const [dragging,setDragging]=useState(false);
  const posRef=useRef(initial);
  const drag=useRef<{x:number;y:number;sx:number;sy:number;moved:boolean}|null>(null);
  const frame=useRef<number|null>(null);
  const lastGestureMoved=useRef(false);

  const renderedSize=()=>({
    width:Math.min(bounds.w,Math.max(1,window.innerWidth-16)),
    height:Math.min(bounds.h,Math.max(1,window.innerHeight-16)),
  });
  const constrain=(next:{x:number;y:number})=>{
    const {width,height}=renderedSize();
    return {
      x:clamp(next.x,8,Math.max(8,window.innerWidth-width-8)),
      y:clamp(next.y,8,Math.max(8,window.innerHeight-height-8)),
    };
  };
  const commit=(next:{x:number;y:number})=>{
    posRef.current=constrain(next);
    if(frame.current!==null)return;
    frame.current=window.requestAnimationFrame(()=>{
      frame.current=null;
      setPos(posRef.current);
    });
  };

  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      const current=drag.current;
      if(!current)return;
      const dx=event.clientX-current.sx,dy=event.clientY-current.sy;
      if(!current.moved&&Math.hypot(dx,dy)<=5)return;
      current.moved=true;
      if(event.pointerType==='touch')event.preventDefault();
      commit({x:current.x+dx,y:current.y+dy});
    };
    const keepInView=()=>commit(posRef.current);
    window.addEventListener('pointermove',move,{passive:false});
    window.addEventListener('resize',keepInView);
    return()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('resize',keepInView);
      if(frame.current!==null)window.cancelAnimationFrame(frame.current);
    };
  },[bounds.h,bounds.w]);

  const start=(event:React.PointerEvent<HTMLElement>)=>{
    event.currentTarget.setPointerCapture?.(event.pointerId);
    lastGestureMoved.current=false;
    drag.current={x:posRef.current.x,y:posRef.current.y,sx:event.clientX,sy:event.clientY,moved:false};
    setDragging(true);
  };
  const stop=(event?:React.PointerEvent<HTMLElement>)=>{
    const current=drag.current;
    const moved=Boolean(current&&(event?Math.hypot(event.clientX-current.sx,event.clientY-current.sy)>7:current.moved));
    lastGestureMoved.current=moved;
    drag.current=null;
    setDragging(false);
    if(moved&&bounds.snapX){
      const {width}=renderedSize();
      const left=8,right=Math.max(8,window.innerWidth-width-8);
      commit({...posRef.current,x:posRef.current.x+width/2<window.innerWidth/2?left:right});
    }
    if(event?.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    return moved;
  };
  const consumeMoved=()=>{const moved=lastGestureMoved.current;lastGestureMoved.current=false;return moved;};
  return {pos,start,stop,dragging,consumeMoved};
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
  const [desktopLiveView,setDesktopLiveView]=useState<'pitch'|'field'>('pitch');
  const [desktopTab,setDesktopTab]=useState<'live'|'summary'|'plays'|'insights'>('live');
  const [messages,setMessages]=useState<ChatMessage[]>([]);
  const [messageText,setMessageText]=useState('');
  const [backendReady,setBackendReady]=useState<boolean|null>(null);
  const [userId,setUserId]=useState<string|null>(null);
  const [displayName,setDisplayName]=useState(userEmail?.split('@')[0]||'IXMetrics User');
  const [chatSocial,setChatSocial]=useState<Record<string,ChatSocial>>({});
  const [selectedSocial,setSelectedSocial]=useState<SocialProfileTarget|null>(null);
  const [mobileChat,setMobileChat]=useState(()=>typeof window!=='undefined'&&window.innerWidth<640);
  const [chatSheetSnap,setChatSheetSnap]=useState<'compact'|'expanded'>('compact');
  const [chatSheetOffset,setChatSheetOffset]=useState(0);
  const [chatSheetDragging,setChatSheetDragging]=useState(false);
  const chatEnd=useRef<HTMLDivElement|null>(null);
  const chatSheetDrag=useRef<{startY:number;lastY:number;lastAt:number;velocity:number}|null>(null);
  const chatCloseTimer=useRef<number|null>(null);
  const bubbleDrag=useDraggable({x:Math.max(12,window.innerWidth-72),y:Math.max(100,window.innerHeight-76)},{w:64,h:64,snapX:true});
  const chatDrag=useDraggable(
    {x:Math.max(12,window.innerWidth-366),y:84},
    {w:350,h:Math.min(600,Math.max(360,window.innerHeight-32))},
  );

  useEffect(()=>{
    const update=()=>{
      const next=window.innerWidth<640;
      setMobileChat(next);
      if(!next){
        setChatSheetOffset(0);
        setChatSheetDragging(false);
        chatSheetDrag.current=null;
      }
    };
    window.addEventListener('resize',update);
    return()=>window.removeEventListener('resize',update);
  },[]);
  useEffect(()=>()=>{
    if(chatCloseTimer.current!==null)window.clearTimeout(chatCloseTimer.current);
  },[]);

  const finishChatClose=()=>{
    setChatOpen(false);
    setChatSheetOffset(0);
    setChatSheetSnap('compact');
    chatCloseTimer.current=null;
  };
  const closeChat=()=>{
    if(!mobileChat){setChatOpen(false);return;}
    setChatSheetDragging(false);
    setChatSheetOffset(Math.max(440,window.innerHeight));
    if(chatCloseTimer.current!==null)window.clearTimeout(chatCloseTimer.current);
    chatCloseTimer.current=window.setTimeout(finishChatClose,230);
  };
  const toggleChat=()=>{
    if(chatOpen){closeChat();return;}
    if(chatCloseTimer.current!==null)window.clearTimeout(chatCloseTimer.current);
    setChatSheetSnap('compact');
    setChatSheetOffset(0);
    setChatOpen(true);
  };
  const startChatWindowDrag=(event:React.PointerEvent<HTMLElement>)=>{
    if(!mobileChat){chatDrag.start(event);return;}
    event.currentTarget.setPointerCapture?.(event.pointerId);
    chatSheetDrag.current={startY:event.clientY,lastY:event.clientY,lastAt:event.timeStamp,velocity:0};
    setChatSheetDragging(true);
  };
  const moveChatWindowDrag=(event:React.PointerEvent<HTMLElement>)=>{
    if(!mobileChat||!chatSheetDrag.current)return;
    const current=chatSheetDrag.current;
    const elapsed=Math.max(1,event.timeStamp-current.lastAt);
    current.velocity=(event.clientY-current.lastY)/elapsed;
    current.lastY=event.clientY;
    current.lastAt=event.timeStamp;
    const dy=event.clientY-current.startY;
    setChatSheetOffset(clamp(dy<0?dy*.46:dy,-76,Math.max(360,window.innerHeight*.74)));
  };
  const stopChatWindowDrag=(event:React.PointerEvent<HTMLElement>)=>{
    if(!mobileChat){chatDrag.stop(event);return;}
    const current=chatSheetDrag.current;
    chatSheetDrag.current=null;
    setChatSheetDragging(false);
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(!current){setChatSheetOffset(0);return;}
    const dy=event.clientY-current.startY;
    if(dy>105||current.velocity>.68){
      if(chatSheetSnap==='expanded'){
        setChatSheetSnap('compact');
        setChatSheetOffset(0);
      }else closeChat();
      return;
    }
    if(dy<-62||current.velocity<-.62)setChatSheetSnap('expanded');
    setChatSheetOffset(0);
  };

  const chatWindowStyle:React.CSSProperties=mobileChat?{
    left:10,right:10,bottom:'max(10px, env(safe-area-inset-bottom))',
    width:'auto',height:chatSheetSnap==='expanded'?'min(76dvh, 640px)':'min(52dvh, 460px)',
    maxHeight:'calc(100dvh - 24px)',
    transform:`translate3d(0,${chatSheetOffset}px,0)`,
    transition:chatSheetDragging?'none':'transform 230ms cubic-bezier(.2,.8,.2,1), height 260ms cubic-bezier(.2,.8,.2,1)',
    willChange:'transform,height',
  }:{
    left:chatDrag.pos.x,top:chatDrag.pos.y,width:350,height:'min(600px, calc(100vh - 32px))',
    transition:chatDrag.dragging?'none':'left 180ms cubic-bezier(.2,.8,.2,1), top 180ms cubic-bezier(.2,.8,.2,1)',
    willChange:'left,top',
  };

  const gameData=feed?.gameData??{},liveData=feed?.liveData??{},linescore=liveData?.linescore??{},boxscore=liveData?.boxscore??{},plays=liveData?.plays??{};
  const allPlays=Array.isArray(plays?.allPlays)?plays.allPlays:[];
  const currentPlay=plays?.currentPlay??allPlays[allPlays.length-1]??null;
  const events=Array.isArray(currentPlay?.playEvents)?currentPlay.playEvents:[];
  const latestEvent=events[events.length-1]??null;
  const recentPitches=events.filter((e:any)=>e?.isPitch||e?.details?.isPitch).slice(-6);
  const latestPitch=recentPitches[recentPitches.length-1]??null;
  const recentPlays=allPlays.slice(-4).reverse();
  const awayTeam=gameData?.teams?.away??{},homeTeam=gameData?.teams?.home??{};
  const isDayGame=String(gameData?.datetime?.dayNight??'night').toLowerCase()==='day';
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
  const participantCount=new Set(messages.map(message=>message.user_id)).size;
  const awayRecord=awayTeam?.record?.wins!=null&&awayTeam?.record?.losses!=null?`${awayTeam.record.wins}–${awayTeam.record.losses}`:'';
  const homeRecord=homeTeam?.record?.wins!=null&&homeTeam?.record?.losses!=null?`${homeTeam.record.wins}–${homeTeam.record.losses}`:'';
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
  const desktopRunners=(isContactEvent?runnerMotions:staticRunners).map(runner=>{const[startX,startY]=desktopRunnerPoint(runner.startX,runner.startY);const[endX,endY]=desktopRunnerPoint(runner.endX,runner.endY);return{...runner,startX,startY,endX,endY};});
  const [desktopTargetX,desktopTargetY]=target.kind==='home-run'?[target.x,3]:(DESKTOP_FIELD_POSITIONS[target.fielder]??[target.x,target.y]);
  const desktopFieldBallMidX=50+(desktopTargetX-50)*.42;
  const desktopFieldBallMidY=Math.max(3,Math.min(38,desktopTargetY-17));
  const desktopFieldBallHop1X=50+(desktopTargetX-50)*.23;
  const desktopFieldBallHop1Y=82+(desktopTargetY-82)*.23;
  const desktopFieldBallBounce1X=50+(desktopTargetX-50)*.36;
  const desktopFieldBallBounce1Y=82+(desktopTargetY-82)*.36;
  const desktopFieldBallHop2X=50+(desktopTargetX-50)*.56;
  const desktopFieldBallHop2Y=82+(desktopTargetY-82)*.56;
  const desktopFieldBallBounce2X=50+(desktopTargetX-50)*.70;
  const desktopFieldBallBounce2Y=82+(desktopTargetY-82)*.70;
  const desktopFieldBallHop3X=50+(desktopTargetX-50)*.84;
  const desktopFieldBallHop3Y=82+(desktopTargetY-82)*.84;
  const fieldBallMidX=50+(target.x-50)*.42;
  const fieldBallMidY=Math.max(5,Math.min(48,target.y-24));
  const fieldBallHop1X=50+(target.x-50)*.23;
  const fieldBallHop1Y=84+(target.y-84)*.23;
  const fieldBallBounce1X=50+(target.x-50)*.36;
  const fieldBallBounce1Y=84+(target.y-84)*.36;
  const fieldBallHop2X=50+(target.x-50)*.56;
  const fieldBallHop2Y=84+(target.y-84)*.56;
  const fieldBallBounce2X=50+(target.x-50)*.70;
  const fieldBallBounce2Y=84+(target.y-84)*.70;
  const fieldBallHop3X=50+(target.x-50)*.84;
  const fieldBallHop3Y=84+(target.y-84)*.84;

  const pitchDot=(event:any)=>{const x=Number(event?.pitchData?.coordinates?.pX),z=Number(event?.pitchData?.coordinates?.pZ);if(!Number.isFinite(x)||!Number.isFinite(z))return{left:'50%',top:'50%'};return{left:`${50+clamp(x/1.5,-1,1)*39}%`,top:`${86-clamp((z-1)/3,0,1)*72}%`};};
  const latestPitchDot=pitchDot(latestPitch);
  const playComplete=Boolean(currentPlay?.about?.isComplete);
  const latestCall=(playComplete?currentPlay?.result?.event:null)??latestEvent?.details?.call?.description??currentPlay?.result?.event??(isFinal?'Game Final':'Live update');
  const liveSummary=(playComplete?currentPlay?.result?.description:null)??latestDescription;
  const latestSpeed=Number(latestPitch?.pitchData?.startSpeed);
  const latestPitchMeta=[latestPitch?.details?.type?.description,Number.isFinite(latestSpeed)?`${latestSpeed.toFixed(1)} mph`:null].filter(Boolean).join(' · ');

  useEffect(()=>{let cancelled=false;const load=async()=>{setDisplayName(userEmail?.split('@')[0]||'IXMetrics User');if(!supabase){setBackendReady(false);return;}let uid:string|null=null;if(signedIn){const{data}=await supabase.auth.getUser();uid=data.user?.id??null;if(data.user){setUserId(uid);const m=data.user.user_metadata??{};setDisplayName(m.display_name||m.full_name||data.user.email?.split('@')[0]||'IXMetrics User');await supabase.rpc('sync_my_social_profile');}}const[messagesResult,socialResult]=await Promise.all([supabase.from('game_chat_messages').select('id,game_pk,user_id,display_name,body,created_at').eq('game_pk',gamePk).order('created_at',{ascending:false}).limit(50),supabase.rpc('get_game_chat_social_profiles',{p_game_pk:gamePk,p_limit:50})]);if(cancelled)return;if(messagesResult.error){setBackendReady(false);return;}setBackendReady(true);setMessages([...(messagesResult.data??[])].reverse() as ChatMessage[]);if(!socialResult.error){const next:Record<string,ChatSocial>={};for(const row of(socialResult.data??[])as ChatSocial[])next[row.message_id]=row;setChatSocial(next);}};void load();return()=>{cancelled=true;};},[gamePk,signedIn,userEmail]);
  useEffect(()=>{if(!backendReady||!supabase)return;const channel=supabase.channel(`live-chat-v5-${gamePk}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'game_chat_messages',filter:`game_pk=eq.${gamePk}`},payload=>{const incoming=payload.new as ChatMessage;setMessages(current=>current.some(m=>m.id===incoming.id)?current:[...current,incoming].slice(-50));}).subscribe();return()=>{void supabase.removeChannel(channel);};},[backendReady,gamePk]);
  useEffect(()=>{chatEnd.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[messages.length,chatOpen]);
  useEffect(()=>{if(isContactEvent)setMobileView('field');else if(isPitchEvent)setMobileView('pitch');},[eventKey,isContactEvent,isPitchEvent]);

  const send=async()=>{const body=messageText.trim().slice(0,280);if(!body)return;if(!signedIn){onOpenAuth();return;}if(!supabase||!backendReady||!userId)return;const{error}=await supabase.from('game_chat_messages').insert({game_pk:gamePk,user_id:userId,display_name:displayName.slice(0,48),body});if(!error)setMessageText('');};

  const renderChatMessages=(compact=false)=>messages.length?messages.map(message=>{const social=chatSocial[message.id],shownName=social?.display_name||message.display_name,targetProfile:SocialProfileTarget={profileId:social?.profile_id||(message.user_id!=='preview-user'?message.user_id:null),displayName:shownName,avatarUrl:social?.avatar_url||null};return <div key={message.id} className={compact?'sc-desktop-chat-message':'rounded-xl border border-[#26364e] bg-[#10192b] p-3'}><div className="flex gap-2"><button onClick={()=>setSelectedSocial(targetProfile)}><SocialAvatar displayName={shownName} avatarUrl={social?.avatar_url||null} size="sm"/></button><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><button data-i18n-user-content onClick={()=>setSelectedSocial(targetProfile)} className="truncate text-[10px] font-bold text-[#00e6f4]">{shownName}</button><span className="shrink-0 text-[8px] text-[#607086]">{new Date(message.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div><p data-i18n-user-content className={`${compact?'mt-0.5 text-[11px] leading-4':'mt-1 text-sm'} break-words text-[#d7e0ee]`}>{message.body}</p></div></div></div>}):<div className={compact?'sc-desktop-chat-empty':'rounded-xl border border-dashed border-[#40516b] p-6 text-center text-xs text-[#8fa0b7]'}>No messages yet. Start the live conversation.</div>;

  const renderChatComposer=(compact=false)=>!signedIn?<button onClick={onOpenAuth} className={`${compact?'min-h-10':'py-3'} w-full rounded-xl bg-[#00e6f4] text-xs font-black text-[#062029]`}>LOG IN TO JOIN LIVE CHAT</button>:<><div className={`${compact?'mb-1.5':'mb-2'} flex gap-1 overflow-x-auto`}>{CHAT_EMOJIS.map(emoji=><button key={emoji} onClick={()=>setMessageText(v=>`${v}${emoji}`.slice(0,280))} className={`${compact?'h-7 min-w-7 text-xs':'h-8 min-w-8'} rounded-lg border border-[#30415c] bg-[#10192b]`}>{emoji}</button>)}</div><div className="flex gap-2"><textarea rows={compact?1:2} value={messageText} onChange={e=>setMessageText(e.target.value.slice(0,280))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder="Type a message…" className={`${compact?'min-h-10 text-xs':'min-h-12 text-sm'} flex-1 resize-none rounded-xl border border-[#30415c] bg-[#08111f] px-3 py-2 text-white outline-none focus:border-[#00e6f4]`}/><button onClick={()=>void send()} disabled={!messageText.trim()} aria-label="Send message" className={`${compact?'w-10 px-0':'px-4'} rounded-xl bg-[#00e6f4] text-xs font-black text-[#062029] disabled:opacity-35`}><span className="material-symbols-outlined text-[18px]">send</span></button></div></>;

  return <main className="sc-live-experience mx-auto h-screen max-w-[1780px] overflow-y-auto px-3 py-3 text-[#dae2fd] sm:px-4 lg:overflow-hidden">

    <div className="sc-live-lens-mobile lg:hidden">
      <div className="sc-live-lens-score-stack">
        <header className="sc-live-lens-header">
          <div className="sc-live-lens-brand">
            <span className="sc-live-lens-live-dot"/>
            <div><strong>IXMETRICS LIVE LENS</strong><small>Verified MLB events visualized live</small></div>
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
        </div>:<div key={`field-${eventKey}`} style={{'--sc-field-ball-x':`${target.x}%`,'--sc-field-ball-y':`${target.y}%`,'--sc-field-ball-mid-x':`${fieldBallMidX}%`,'--sc-field-ball-mid-y':`${fieldBallMidY}%`,'--sc-field-ball-hop1-x':`${fieldBallHop1X}%`,'--sc-field-ball-hop1-y':`${fieldBallHop1Y}%`,'--sc-field-ball-bounce1-x':`${fieldBallBounce1X}%`,'--sc-field-ball-bounce1-y':`${fieldBallBounce1Y}%`,'--sc-field-ball-hop2-x':`${fieldBallHop2X}%`,'--sc-field-ball-hop2-y':`${fieldBallHop2Y}%`,'--sc-field-ball-bounce2-x':`${fieldBallBounce2X}%`,'--sc-field-ball-bounce2-y':`${fieldBallBounce2Y}%`,'--sc-field-ball-hop3-x':`${fieldBallHop3X}%`,'--sc-field-ball-hop3-y':`${fieldBallHop3Y}%`} as React.CSSProperties} className={`sc-live-field-stage ${isContactEvent?'has-contact':''} ${target.kind==='ground'?'is-ground-ball':''}`}>
          <svg className="sc-live-field-diagram" viewBox="0 0 400 330" preserveAspectRatio="none" aria-hidden="true">
            <path className="sc-live-field-outfield" d="M18 177 Q31 77 200 28 Q369 77 382 177 L292 236 Q263 290 200 307 Q137 290 108 236 Z"/>
            <path className="sc-live-field-track" d="M18 177 Q31 77 200 28 Q369 77 382 177"/>
            <path className="sc-live-field-infield-dirt" d="M200 302 L104 220 Q129 176 200 154 Q271 176 296 220 Z"/>
            <path className="sc-live-field-infield-grass" d="M200 279 L143 220 L200 163 L257 220 Z"/>
            <path className="sc-live-field-lines" d="M200 289 L27 169 M200 289 L373 169"/>
            <circle className="sc-live-field-mound" cx="200" cy="214" r="15"/>
            <text className="sc-live-field-distance" x="43" y="172">331</text>
            <text className="sc-live-field-distance" x="200" y="54" textAnchor="middle">404</text>
            <text className="sc-live-field-distance" x="357" y="172" textAnchor="end">322</text>
          </svg>
          <span aria-label="Second base" className={`sc-live-field-base is-second ${offense?.second?'is-active':''}`}/>
          <span aria-label="First base" className={`sc-live-field-base is-first ${offense?.first?'is-active':''}`}/>
          <span aria-label="Third base" className={`sc-live-field-base is-third ${offense?.third?'is-active':''}`}/>
          <span aria-label="Home plate" className="sc-live-field-base is-home"/>
          {fielders.map(([key,label,player],index)=>{const [left,top]=BASE_POSITIONS[key];const primary=isContactEvent&&key===target.fielder;const coverage=primary ? 2.25 : key==='catcher' ? 0.22 : key==='pitcher' ? 0.58 : 0.36;const direction=target.x<45?-1:1;const dx=(target.x-left)*coverage+(primary?direction*5:0),dy=(target.y-top)*coverage*.72+(primary?(target.kind==='home-run'?-5:7):0);return <span key={key} aria-label={`${label}, ${playerName(player,label)}`} style={{left:`${left}%`,top:`${top}%`,'--sc-fielder-x':`${dx}px`,'--sc-fielder-y':`${dy}px`,'--sc-fielder-delay':`${Math.min(index*.035,.22)}s`} as React.CSSProperties} className={`sc-live-fielder ${primary?'is-target':''}`}>{label}</span>})}
          <span className="sc-live-batter-tag" aria-label={`Batting: ${playerName(batter,'Batter')}`}><i/>{compactPlayerName(batter,'Batter')}</span>
          {(isContactEvent?runnerMotions:staticRunners).map((runner)=><span key={`runner-${runner.id}`} style={{'--sc-runner-start-x':`${runner.startX}%`,'--sc-runner-start-y':`${runner.startY}%`,'--sc-runner-end-x':`${runner.endX}%`,'--sc-runner-end-y':`${runner.endY}%`} as React.CSSProperties} className={`sc-live-runner ${isContactEvent?'is-moving':'is-static'} ${runner.isOut?'is-out':''}`}>R{runner.label}</span>)}
          <span className="sc-live-field-contact-pop"/>
          <span className="sc-live-field-impact"/>
          <span className="sc-live-field-ball" aria-label="Batted ball">⚾</span>
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

    <div className="sc-live-desktop hidden lg:flex">
      <header className="sc-desktop-topbar">
        <div className="sc-desktop-brand"><strong>IXMETRICS <span>MLB</span></strong><i/><b>Gameday</b><span className="material-symbols-outlined">expand_more</span></div>
        <div className="sc-desktop-live-state"><i/><span>{isFinal?'FINAL':'AI LIVE SIMULATION'}</span><small>Verified MLB events</small></div>
      </header>

      <div className="sc-desktop-workspace">
        <section className="sc-desktop-main-column">
          <section className="sc-desktop-scoreboard" aria-label={`${displayTeamName(awayTeam)} ${awayRuns}, ${displayTeamName(homeTeam)} ${homeRuns}`}>
            <div className="sc-desktop-score-team is-away">
              <img src={mlbTeamLogoUrl(awayTeam?.id)} alt=""/>
              <div><strong>{displayTeamName(awayTeam)}</strong><small>{awayRecord||'AWAY'}</small></div>
              <b>{awayRuns}</b>
            </div>
            <div className="sc-desktop-score-state">
              <strong>{inningLabel}</strong>
              <div className="sc-desktop-bases" aria-label="Occupied bases"><i className={offense?.second?'is-active':''}/><i className={offense?.third?'is-active':''}/><i className={offense?.first?'is-active':''}/></div>
              <small>{outs} {outs===1?'OUT':'OUTS'}</small>
            </div>
            <div className="sc-desktop-score-team is-home">
              <b>{homeRuns}</b>
              <img src={mlbTeamLogoUrl(homeTeam?.id)} alt=""/>
              <div><strong>{displayTeamName(homeTeam)}</strong><small>{homeRecord||'HOME'}</small></div>
            </div>
          </section>

          <nav className="sc-desktop-tabs" aria-label="Gameday sections">
            {([['live','Live'],['summary','Summary'],['plays','Plays'],['insights','Insights']] as const).map(([key,label])=><button type="button" key={key} className={desktopTab===key?'is-active':''} aria-pressed={desktopTab===key} onClick={()=>setDesktopTab(key)}>{label}</button>)}
          </nav>

          <div className="sc-desktop-tab-content">
            {desktopTab==='live'&&<section className="sc-desktop-panel sc-desktop-live-view">
              <div className="sc-desktop-view-toggle" role="group" aria-label="Live simulation view">
                <button type="button" className={desktopLiveView==='pitch'?'is-active':''} aria-pressed={desktopLiveView==='pitch'} onClick={()=>setDesktopLiveView('pitch')}>Pitch View</button>
                <button type="button" className={desktopLiveView==='field'?'is-active':''} aria-pressed={desktopLiveView==='field'} onClick={()=>setDesktopLiveView('field')}>Field View</button>
              </div>

              {desktopLiveView==='pitch'&&
                <div key={`desktop-pitch-${eventKey}`} className={`sc-desktop-pitch-stage ${isDayGame?'is-day':'is-night'}`}>
                  <span className="sc-desktop-view-label">PITCH VIEW</span>
                  <div className="sc-desktop-duel-stack">
                    <article className="sc-desktop-duel-card is-pitcher">
                      <img src={mlbPlayerHeadshotUrl(pitcher?.id,180)} alt=""/>
                      <div><span>PITCHING</span><strong>{playerName(pitcher,'Pitcher')}</strong><small>{currentPlay?.matchup?.pitchHand?.code??'—'}HP · {latestPitchMeta||'LIVE'}</small></div>
                    </article>
                    <article className="sc-desktop-duel-card is-batter is-live-batter">
                      <img src={mlbPlayerHeadshotUrl(batter?.id,180)} alt=""/>
                      <div><span><i/>LIVE AT BAT</span><strong>{playerName(batter,'Batter')}</strong><small>{currentPlay?.matchup?.batSide?.code??'—'} · {balls}–{strikes} COUNT</small></div>
                    </article>
                  </div>
                  <div className="sc-desktop-pitch-track">
                    <span className="sc-desktop-mound-point">P</span>
                    <div className="sc-desktop-strike-zone">
                      <i/><i/><i/><i/><i/><i/><i/><i/><i/>
                      {recentPitches.map((event:any,index:number)=><span key={event?.playId??event?.index??index} style={{...pitchDot(event),backgroundColor:PITCH_COLORS[pitchKind(event)]}} className={`sc-live-pitch-dot ${index===recentPitches.length-1?'is-latest':''}`}>{index+1}</span>)}
                      {latestPitch&&<span style={{'--sc-end-x':latestPitchDot.left,'--sc-end-y':latestPitchDot.top,'--sc-pitch-color':PITCH_COLORS[pitchKind(latestPitch)]} as React.CSSProperties} className="sc-live-pitch-flight"/>}
                    </div>
                    <span className="sc-desktop-home-point">HOME</span>
                  </div>
                  <div className="sc-desktop-live-call"><i/><div><span>{latestCall}</span><strong>{liveSummary}</strong></div></div>
                </div>}

              {desktopLiveView==='field'&&
                <div key={`desktop-field-${eventKey}`} style={{'--sc-field-ball-x':`${desktopTargetX}%`,'--sc-field-ball-y':`${desktopTargetY}%`,'--sc-field-ball-mid-x':`${desktopFieldBallMidX}%`,'--sc-field-ball-mid-y':`${desktopFieldBallMidY}%`,'--sc-field-ball-hop1-x':`${desktopFieldBallHop1X}%`,'--sc-field-ball-hop1-y':`${desktopFieldBallHop1Y}%`,'--sc-field-ball-bounce1-x':`${desktopFieldBallBounce1X}%`,'--sc-field-ball-bounce1-y':`${desktopFieldBallBounce1Y}%`,'--sc-field-ball-hop2-x':`${desktopFieldBallHop2X}%`,'--sc-field-ball-hop2-y':`${desktopFieldBallHop2Y}%`,'--sc-field-ball-bounce2-x':`${desktopFieldBallBounce2X}%`,'--sc-field-ball-bounce2-y':`${desktopFieldBallBounce2Y}%`,'--sc-field-ball-hop3-x':`${desktopFieldBallHop3X}%`,'--sc-field-ball-hop3-y':`${desktopFieldBallHop3Y}%`} as React.CSSProperties} className={`sc-live-field-stage sc-desktop-field-stage ${isContactEvent?'has-contact':''} ${target.kind==='ground'?'is-ground-ball':''}`}>
                  <span className="sc-desktop-view-label">FIELD VIEW</span>
                  <span aria-label="Second base" className={`sc-live-field-base is-second ${offense?.second?'is-active':''}`}/><span aria-label="First base" className={`sc-live-field-base is-first ${offense?.first?'is-active':''}`}/><span aria-label="Third base" className={`sc-live-field-base is-third ${offense?.third?'is-active':''}`}/><span aria-label="Home plate" className="sc-live-field-base is-home"/>
                  {fielders.map(([key,label,player],index)=>{const [left,top]=DESKTOP_FIELD_POSITIONS[key];const primary=isContactEvent&&key===target.fielder;const coverage=primary?2.1:key==='catcher'?0.2:key==='pitcher'?0.5:0.32;const direction=desktopTargetX<45?-1:1;const dx=(desktopTargetX-left)*coverage+(primary?direction*4:0),dy=(desktopTargetY-top)*coverage*.6+(primary?(target.kind==='home-run'?-4:5):0);return <div key={key} aria-label={`${label}, ${playerName(player,label)}`} style={{left:`${left}%`,top:`${top}%`,'--sc-fielder-x':`${dx}px`,'--sc-fielder-y':`${dy}px`,'--sc-fielder-delay':`${Math.min(index*.035,.22)}s`} as React.CSSProperties} className={`sc-desktop-fielder ${primary?'is-target':''}`}><b>{label}</b><small>{compactPlayerName(player,label)}</small></div>})}
                  <span className="sc-live-batter-tag" aria-label={`Batting: ${playerName(batter,'Batter')}`}><i/>{compactPlayerName(batter,'Batter')}</span>
                  {desktopRunners.map(runner=><span key={`desktop-runner-${runner.id}`} style={{'--sc-runner-start-x':`${runner.startX}%`,'--sc-runner-start-y':`${runner.startY}%`,'--sc-runner-end-x':`${runner.endX}%`,'--sc-runner-end-y':`${runner.endY}%`} as React.CSSProperties} className={`sc-live-runner ${isContactEvent?'is-moving':'is-static'} ${runner.isOut?'is-out':''}`}>R{runner.label}</span>)}
                  <span className="sc-live-field-contact-pop"/><span className="sc-live-field-impact"/><span className="sc-live-field-ball" aria-label="Batted ball">⚾</span>
                  <div className="sc-desktop-count-board"><div><span>Balls</span><i>{[0,1,2].map(index=><b key={index} className={balls>index?'is-on':''}/>)}</i></div><div><span>Strikes</span><i>{[0,1].map(index=><b key={index} className={strikes>index?'is-on':''}/>)}</i></div><div><span>Outs</span><i>{[0,1].map(index=><b key={index} className={outs>index?'is-on':''}/>)}</i></div></div>
                </div>}
            </section>}

            {desktopTab==='summary'&&<section className="sc-desktop-alt-panel">
              <div className="sc-desktop-alt-heading"><span>GAME SUMMARY</span><strong>{displayTeamName(awayTeam)} at {displayTeamName(homeTeam)}</strong><small>{inningLabel}</small></div>
              <div className="sc-desktop-summary-grid"><article><span>CURRENT MATCHUP</span><strong>{playerName(batter,'Batter')}</strong><p>vs {playerName(pitcher,'Pitcher')}</p></article><article><span>COUNT</span><strong>{balls}–{strikes}</strong><p>{outs} {outs===1?'out':'outs'}</p></article><article><span>LATEST PITCH</span><strong>{latestPitchMeta||'Waiting'}</strong><p>{latestCall}</p></article><article className="is-wide"><span>LATEST VERIFIED UPDATE</span><strong>{liveSummary}</strong></article></div>
              <div className="sc-desktop-summary-events">{recentPlays.map((play:any,index:number)=><article key={play?.atBatIndex??index}><time>{play?.about?.halfInning?`${String(play.about.halfInning).slice(0,3).toUpperCase()} ${play?.about?.inning??''}`:'GAME'}</time><div><strong>{play?.result?.event??'Game event'}</strong><p>{play?.result?.description??'Verified game event'}</p></div></article>)}</div>
            </section>}

            {desktopTab==='plays'&&<section className="sc-desktop-alt-panel">
              <div className="sc-desktop-alt-heading"><span>VERIFIED PLAY-BY-PLAY</span><strong>Game flow</strong><small>Newest first</small></div>
              <div className="sc-desktop-play-list">{allPlays.length?[...allPlays].slice(-18).reverse().map((play:any,index:number)=><article key={play?.atBatIndex??index} className={index===0?'is-latest':''}><time>{play?.about?.halfInning?`${String(play.about.halfInning).toUpperCase()} ${play?.about?.inning??''}`:'GAME'}</time><div><strong>{play?.result?.event??'Game event'}</strong><p>{play?.result?.description??'Verified game event'}</p></div><span>{play?.count?.outs??0} OUT</span></article>):<p className="sc-live-events-empty">Verified play-by-play will appear here.</p>}</div>
            </section>}

            {desktopTab==='insights'&&<section className="sc-desktop-alt-panel">
              <div className="sc-desktop-alt-heading"><span>IXMETRICS INSIGHTS</span><strong>Live matchup context</strong><small>Data-led, not a guarantee</small></div>
              <div className="sc-desktop-insight-matchup"><article><img src={mlbPlayerHeadshotUrl(pitcher?.id,180)} alt=""/><div><span>PITCHER</span><strong>{playerName(pitcher,'Pitcher')}</strong><p>{latestPitchMeta||'Awaiting verified pitch data'}</p></div></article><b>VS</b><article><img src={mlbPlayerHeadshotUrl(batter?.id,180)} alt=""/><div><span>BATTER</span><strong>{playerName(batter,'Batter')}</strong><p>{balls}–{strikes} count · {outs} {outs===1?'out':'outs'}</p></div></article></div>
              <div className="sc-desktop-insight-copy"><span>IXMETRICS TAKE</span><strong>{latestCall}</strong><p>{liveSummary}</p><small>Visualization and movement are inferred from verified MLB pitch and play-by-play data.</small></div>
            </section>}
          </div>
        </section>

        <aside className="sc-desktop-side-column">
          <section className="sc-desktop-side-card sc-desktop-line-card">
            <header><strong>BOX SCORE</strong><span>{inningLabel}</span></header>
            <div className="sc-desktop-line-scroll"><table><thead><tr><th>TEAM</th>{innings.slice(0,9).map((item:any)=><th key={item?.num}>{item?.num}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead><tbody><tr><td>{displayTeamName(awayTeam)}</td>{innings.slice(0,9).map((item:any)=><td key={item?.num}>{item?.away?.runs??'—'}</td>)}<td>{awayRuns}</td><td>{awayHits}</td><td>{awayErrors}</td></tr><tr><td>{displayTeamName(homeTeam)}</td>{innings.slice(0,9).map((item:any)=><td key={item?.num}>{item?.home?.runs??'—'}</td>)}<td>{homeRuns}</td><td>{homeHits}</td><td>{homeErrors}</td></tr></tbody></table></div>
          </section>

          <section className="sc-desktop-side-card sc-desktop-active-batter-card">
            <header><div><i/><strong>LIVE AT BAT</strong></div><span>{displayTeamName(battingTeam)}</span></header>
            <div className="sc-desktop-active-batter">
              <div className="sc-desktop-active-batter-photo"><img src={mlbPlayerHeadshotUrl(batter?.id,240)} alt=""/><i/></div>
              <div><span><i/>CURRENT BATTER</span><strong>{playerName(batter,'Batter')}</strong><small>{currentPlay?.matchup?.batSide?.code??'—'} · {displayTeamName(battingTeam)}</small></div>
            </div>
            <div className="sc-desktop-active-batter-stats"><div><span>COUNT</span><strong>{balls}–{strikes}</strong></div><div><span>OUTS</span><strong>{outs}</strong></div><div><span>LATEST PITCH</span><strong>{latestPitchMeta||'Waiting'}</strong></div></div>
            <p className="sc-desktop-active-batter-call"><span>{latestCall}</span>{liveSummary}</p>
          </section>
        </aside>
      </div>
    </div>

    {false&&<div className="hidden">
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
    </div>}

    <div
      style={{
        left:bubbleDrag.pos.x,
        top:bubbleDrag.pos.y,
        transition:bubbleDrag.dragging?'none':'left 190ms cubic-bezier(.2,.8,.2,1), top 190ms cubic-bezier(.2,.8,.2,1)',
      }}
      onPointerDown={bubbleDrag.start}
      onPointerUp={event=>bubbleDrag.stop(event)}
      onPointerCancel={event=>bubbleDrag.stop(event)}
      onClick={()=>{if(bubbleDrag.consumeMoved())return;toggleChat();}}
      className="sc-live-chat-bubble fixed z-[350] flex h-16 w-16 touch-none items-center justify-center rounded-full border border-[#00e6f4]/65 bg-[#082033] text-[#7df4ff] shadow-[0_12px_35px_rgba(0,0,0,.5),0_0_22px_rgba(0,230,244,.22)]"
      title="Drag to move live chat"
    >
      <button
        type="button"
        aria-label={chatOpen?'Close live chat':'Open live chat'}
        className="relative z-10 grid h-12 w-12 cursor-pointer place-items-center rounded-full bg-[#061a2b] text-[#7df4ff] shadow-inner"
      >
        <span className="material-symbols-outlined">{chatOpen?'close':'chat_bubble'}</span>
        {!chatOpen&&<span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-[#65f2b5] shadow-[0_0_10px_rgba(101,242,181,.9)]"/>}
      </button>
    </div>

    {chatOpen&&<button type="button" aria-label="Close live chat" onClick={closeChat} className="fixed inset-0 z-[340] cursor-default bg-[#020813]/35 backdrop-blur-[1px]"/>}

    {chatOpen&&<aside style={chatWindowStyle} className="fixed z-[345] flex max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] shadow-2xl">
      <div
        onPointerDown={startChatWindowDrag}
        onPointerMove={moveChatWindowDrag}
        onPointerUp={stopChatWindowDrag}
        onPointerCancel={stopChatWindowDrag}
        className="relative flex touch-none cursor-move select-none items-center justify-between border-b border-[#26364e] px-4 pb-3 pt-4"
      >
        {mobileChat&&<span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-11 -translate-x-1/2 rounded-full bg-[#526178]"/>}
        <div>
          <p className="text-sm font-black text-white">LIVE GAME CHAT</p>
          <p className="mt-1 text-[9px] text-[#8fa0b7]">{participantCount||0} scouts · {mobileChat?'swipe up to expand · down to close':'drag this window anywhere'}.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-1 text-[8px] font-bold ${backendReady?'border-[#65f2b5]/35 text-[#65f2b5]':'border-[#ffd166]/35 text-[#ffd166]'}`}>{backendReady?'LIVE SYNC':'PREVIEW'}</span>
          <button type="button" aria-label="Close live chat" onPointerDown={event=>event.stopPropagation()} onClick={closeChat} className="grid h-8 w-8 place-items-center rounded-full border border-[#40516b] text-[#cbd6e5] hover:border-[#00e6f4] hover:text-[#00e6f4]"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">{renderChatMessages(false)}<div ref={chatEnd}/></div>
      <div className="border-t border-[#26364e] p-3">{renderChatComposer(false)}</div>
    </aside>}
    <SocialProfileCard target={selectedSocial} signedIn={signedIn} onOpenAuth={onOpenAuth} onClose={()=>setSelectedSocial(null)}/>
  </main>;
};

const Mini:React.FC<{label:string;value:string}>=({label,value})=><div className="rounded-lg border border-[#26364e] bg-[#10192b] px-3 py-2"><p className="text-[8px] font-bold text-[#607086]">{label}</p><p className="mt-1 font-mono text-lg font-black text-white">{value}</p></div>;
