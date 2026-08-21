import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mlbPlayerCutoutUrl, mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import './mobile-live-approved.css';

type Props = { feed: any; onExit: () => void };
type Side = 'away' | 'home';
type FieldKey = 'pitcher'|'catcher'|'first'|'second'|'shortstop'|'third'|'left'|'center'|'right';

const FIELD_POSITIONS: Record<FieldKey, [number, number, string]> = {
  pitcher:[50,55,'P'], catcher:[50,88,'C'], first:[78,59,'1B'], second:[64,43,'2B'], shortstop:[36,43,'SS'], third:[22,59,'3B'], left:[19,21,'LF'], center:[50,13,'CF'], right:[81,21,'RF'],
};
const BASE_POINTS:Record<string,[number,number]>={home:[50,89],first:[77,60],second:[50,44],third:[23,60],score:[50,93]};

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const teamShort=(team:any)=>team?.abbreviation??team?.teamCode??team?.teamName??team?.name??'TEAM';
const teamLabel=(team:any)=>team?.teamName??String(team?.name??teamShort(team)).split(' ').at(-1)??teamShort(team);
const personName=(player:any,fallback='—')=>player?.fullName??player?.name??player?.person?.fullName??fallback;
const compactPersonName=(player:any,fallback='Batter')=>{
  const parts=String(personName(player,fallback)).trim().split(/\s+/).filter(Boolean);
  const suffix=/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(parts.at(-1)??'');
  return suffix?(parts.at(-2)??parts.at(-1)??fallback):(parts.at(-1)??fallback);
};
const personId=(player:any)=>Number(player?.person?.id??player?.id)||null;
const mergePlayer=(player:any,gamePlayers:any)=>{
  if(!player)return null;
  const id=personId(player);
  const gamePlayer=id?gamePlayers?.[`ID${id}`]:null;
  const person={...(gamePlayer?.person??gamePlayer??{}),...(player?.person??{})};
  return {...(gamePlayer??{}),...player,person:{...person,id:person?.id??id}};
};
const lineupRows=(teamBox:any,gamePlayers:any)=>{
  const players=teamBox?.players??{};
  const order=Array.isArray(teamBox?.battingOrder)&&teamBox.battingOrder.length
    ? teamBox.battingOrder
    : Array.isArray(teamBox?.batters)?teamBox.batters:[];
  const ids=[...new Set<number>(order.map((value:any)=>Number(value)).filter(Boolean))];
  const ordered=ids.map(id=>players[`ID${id}`]??gamePlayers?.[`ID${id}`]).filter(Boolean);
  const fallback=(Object.values(players) as any[])
    .filter(row=>row?.battingOrder||row?.stats?.batting)
    .sort((a,b)=>Number(a?.battingOrder??9999)-Number(b?.battingOrder??9999));
  return (ordered.length?ordered:fallback).map(row=>mergePlayer(row,gamePlayers)).filter(Boolean).slice(0,9);
};
const stat=(value:any,fallback='0')=>value===null||value===undefined||value===''?fallback:String(value);
const avgStat=(value:any)=>{
  if(value===null||value===undefined||value==='')return '—';
  const n=Number(value);
  if(Number.isFinite(n))return n.toFixed(3).replace(/^0/, '');
  return String(value).replace(/^0(?=\.)/, '');
};
const normalizeBase=(value:any,fallback='home')=>{
  const base=String(value??'').toLowerCase();
  if(base.includes('home'))return 'score';
  if(base.includes('1')||base.includes('first'))return 'first';
  if(base.includes('2')||base.includes('second'))return 'second';
  if(base.includes('3')||base.includes('third'))return 'third';
  return fallback;
};
const inferBallTarget=(description:string):[number,number,FieldKey]=>{
  const d=description.toLowerCase();
  if(d.includes('left field')||d.includes('left fielder'))return[22,20,'left'];
  if(d.includes('right field')||d.includes('right fielder'))return[78,20,'right'];
  if(d.includes('center field')||d.includes('center fielder')||d.includes('home run'))return[50,13,'center'];
  if(d.includes('shortstop'))return[36,43,'shortstop'];
  if(d.includes('second baseman'))return[64,43,'second'];
  if(d.includes('third baseman'))return[22,59,'third'];
  if(d.includes('first baseman'))return[78,59,'first'];
  if(d.includes('pitcher'))return[50,55,'pitcher'];
  if(d.includes('catcher'))return[50,84,'catcher'];
  return[50,30,'center'];
};

export const MobileLiveApproved: React.FC<Props> = ({feed,onExit}) => {
  const [selectedSide,setSelectedSide]=useState<Side>('away');
  const [finalOverlayOpen,setFinalOverlayOpen]=useState(false);
  const finalOverlayShownFor=useRef<string|null>(null);
  const gameWasLive=useRef(false);
  const boxScoreRef=useRef<HTMLElement|null>(null);
  const gameData=feed?.gameData??{};
  const liveData=feed?.liveData??{};
  const linescore=liveData?.linescore??{};
  const boxscore=liveData?.boxscore??{};
  const plays=liveData?.plays??{};
  const awayTeam=gameData?.teams?.away??{};
  const homeTeam=gameData?.teams?.home??{};
  const innings=Array.isArray(linescore?.innings)?linescore.innings:[];
  const displayInnings=Array.from({length:9},(_,index)=>innings.find((item:any)=>Number(item?.num)===index+1)??{num:index+1});
  const currentPlay=plays?.currentPlay??(Array.isArray(plays?.allPlays)?plays.allPlays.at(-1):null)??null;
  const playEvents=Array.isArray(currentPlay?.playEvents)?currentPlay.playEvents:[];
  const latestEvent=playEvents.at(-1)??null;
  const recentPitches=playEvents.filter((event:any)=>event?.isPitch||event?.details?.isPitch).slice(-6);
  const latestPitch=recentPitches.at(-1)??null;
  const offense=linescore?.offense??{};
  const defense=linescore?.defense??{};
  const gamePlayers=gameData?.players??{};
  const batter=mergePlayer(currentPlay?.matchup?.batter??offense?.batter??null,gamePlayers);
  const pitcher=mergePlayer(currentPlay?.matchup?.pitcher??defense?.pitcher??null,gamePlayers);
  const balls=currentPlay?.count?.balls??linescore?.balls??0;
  const strikes=currentPlay?.count?.strikes??linescore?.strikes??0;
  const outs=currentPlay?.count?.outs??linescore?.outs??0;
  const inning=linescore?.currentInning??0;
  const inningState=String(linescore?.inningState??'').toUpperCase();
  const detailedState=gameData?.status?.detailedState??'LIVE';
  const isFinal=gameData?.status?.abstractGameState==='Final'||String(detailedState).toLowerCase().includes('final');
  const inningLabel=isFinal?'FINAL':inning?`${inningState} ${inning}`:String(detailedState).toUpperCase();
  const battingSide:Side=linescore?.isTopInning?'away':'home';
  const isDayGame=String(gameData?.datetime?.dayNight??'night').toLowerCase()==='day';
  const selectedTeam=selectedSide==='away'?awayTeam:homeTeam;
  const selectedBox=boxscore?.teams?.[selectedSide]??{};
  const selectedPlayers=selectedBox?.players??{};
  const eventDescription=[currentPlay?.result?.description,latestEvent?.details?.description,currentPlay?.result?.event].filter(Boolean).join(' · ');
  const isContact=Boolean(latestEvent?.details?.isInPlay||latestEvent?.hitData||/in play|single|double|triple|home run|ground|fly|line|pop|reaches on|fielder/i.test(eventDescription));
  const [ballX,ballY,targetFielder]=inferBallTarget(eventDescription);
  const eventKey=String(latestEvent?.playId??currentPlay?.playEndTime??`${currentPlay?.atBatIndex??'pregame'}-${latestEvent?.index??playEvents.length}`);
  const runnerMotions=(Array.isArray(currentPlay?.runners)?currentPlay.runners:[]).map((runner:any,index:number)=>{
    const startKey=normalizeBase(runner?.movement?.start,'home');
    const endKey=normalizeBase(runner?.movement?.end,startKey);
    const [startX,startY]=BASE_POINTS[startKey]??BASE_POINTS.home;
    const [endX,endY]=BASE_POINTS[endKey]??BASE_POINTS.first;
    return{id:String(runner?.details?.runner?.id??index),startX,startY,endX,endY,isOut:Boolean(runner?.movement?.isOut)};
  });

  useEffect(()=>{setSelectedSide(battingSide);},[awayTeam?.id,homeTeam?.id,battingSide]);

  const finalGameKey=String(gameData?.game?.pk??`${awayTeam?.id??'away'}-${homeTeam?.id??'home'}`);
  useEffect(()=>{
    if(!isFinal){gameWasLive.current=true;return;}
    if(!gameWasLive.current||finalOverlayShownFor.current===finalGameKey)return;
    finalOverlayShownFor.current=finalGameKey;
    setFinalOverlayOpen(true);
  },[finalGameKey,isFinal]);

  const battingRows=useMemo(()=>{
    return lineupRows(selectedBox,gamePlayers);
  },[selectedBox,gamePlayers]);

  const pitchingRows=useMemo(()=>{
    const ids=Array.isArray(selectedBox?.pitchers)?selectedBox.pitchers:[];
    return ids.map((id:number)=>mergePlayer(selectedPlayers?.[`ID${id}`]??gamePlayers?.[`ID${id}`],gamePlayers)).filter(Boolean);
  },[selectedBox?.pitchers,selectedPlayers,gamePlayers]);

  const fielders: Array<[FieldKey, any]> = [
    ['pitcher',defense?.pitcher],['catcher',defense?.catcher],['first',defense?.first],['second',defense?.second],['shortstop',defense?.shortstop],['third',defense?.third],['left',defense?.left],['center',defense?.center],['right',defense?.right],
  ].map(([key,player])=>[key,mergePlayer(player,gamePlayers)] as [FieldKey,any]);

  const pitchPoint=(event:any)=>{
    const x=Number(event?.pitchData?.coordinates?.pX);
    const z=Number(event?.pitchData?.coordinates?.pZ);
    if(!Number.isFinite(x)||!Number.isFinite(z))return{x:50,y:50};
    return {x:50+clamp(x/1.5,-1,1)*39,y:86-clamp((z-1)/3,0,1)*72};
  };
  const pitchDot=(event:any)=>{const point=pitchPoint(event);return{left:`${point.x}%`,top:`${point.y}%`};};
  const pitchCell=(event:any)=>{const point=pitchPoint(event);return clamp(Math.floor(point.y/33.34),0,2)*3+clamp(Math.floor(point.x/33.34),0,2);};
  const pitchHeat=Array.from({length:9},(_,index)=>recentPitches.filter((event:any)=>pitchCell(event)===index).length);
  const latestPitchPoint=pitchPoint(latestPitch);
  const latestPitchCell=latestPitch?pitchCell(latestPitch):-1;
  const releaseX=String(currentPlay?.matchup?.pitchHand?.code??'R').toUpperCase()==='L'?72:28;
  const pitchCurve=`M ${releaseX} -72 Q ${50+(latestPitchPoint.x-releaseX)*.22} 8 ${latestPitchPoint.x} ${latestPitchPoint.y}`;
  const pitchEventKey=String(latestPitch?.playId??latestPitch?.index??`${currentPlay?.atBatIndex??'pregame'}-${recentPitches.length}`);
  const latestPitchNumber=Number(latestPitch?.pitchNumber??recentPitches.length)||recentPitches.length;
  const latestPitchCall=latestPitch?.details?.call?.description??latestPitch?.details?.description??'Pitch tracked';
  const latestPitchType=latestPitch?.details?.type?.description??'Pitch';
  const latestPitchSpeed=Number(latestPitch?.pitchData?.startSpeed);
  const latestPitchTone=/strike|foul|in play/i.test(latestPitchCall)?'is-strike':/ball|pitchout/i.test(latestPitchCall)?'is-ball':'is-neutral';
  const awayRuns=Number(linescore?.teams?.away?.runs??0);
  const homeRuns=Number(linescore?.teams?.home?.runs??0);
  const winnerSide:Side|null=awayRuns===homeRuns?null:awayRuns>homeRuns?'away':'home';
  const winnerTeam=winnerSide==='away'?awayTeam:winnerSide==='home'?homeTeam:null;

  const pitcherStats=selectedBox?.teamStats?.pitching??{};
  const teamTotals={
    ip: pitcherStats?.inningsPitched??'0.0', h:pitcherStats?.hits??0, r:pitcherStats?.runs??0, er:pitcherStats?.earnedRuns??0,
    bb:pitcherStats?.baseOnBalls??0, k:pitcherStats?.strikeOuts??0, hr:pitcherStats?.homeRuns??0, era:pitcherStats?.era??'—',
  };

  return <main className="sc-approved-mobile" aria-label="ScoutCore mobile live game">
    <header className="sc-am-topbar">
      <button type="button" onClick={onExit} aria-label="Back"><span className="material-symbols-outlined">arrow_back_ios_new</span></button>
      <strong>Gameday</strong>
      <span className="sc-am-topbar-spacer" aria-hidden="true"/>
    </header>

    <section className="sc-am-score" aria-label={`${teamShort(awayTeam)} ${linescore?.teams?.away?.runs??0}, ${teamShort(homeTeam)} ${linescore?.teams?.home?.runs??0}`}>
      <div className={`sc-am-score-team is-away ${battingSide==='away'&&!isFinal?'is-batting':''}`}><img src={mlbTeamLogoUrl(awayTeam?.id)} alt=""/><div><b>{teamShort(awayTeam)}</b><small>{awayTeam?.record?.wins!=null?`${awayTeam.record.wins} - ${awayTeam.record.losses}`:'AWAY'}</small></div></div>
      <strong className="sc-am-runs">{linescore?.teams?.away?.runs??0}</strong>
      <div className="sc-am-game-state"><b>{inningLabel}</b><div className="sc-am-bases" aria-label={`${inningLabel}. ${offense?.first||offense?.second||offense?.third?'Runners on base':'Bases empty'}`}><i className={offense?.second?'is-on':''}/><i className={offense?.third?'is-on':''}/><i className={offense?.first?'is-on':''}/></div></div>
      <strong className="sc-am-runs">{linescore?.teams?.home?.runs??0}</strong>
      <div className={`sc-am-score-team is-home ${battingSide==='home'&&!isFinal?'is-batting':''}`}><div><b>{teamShort(homeTeam)}</b><small>{homeTeam?.record?.wins!=null?`${homeTeam.record.wins} - ${homeTeam.record.losses}`:'HOME'}</small></div><img src={mlbTeamLogoUrl(homeTeam?.id)} alt=""/></div>
    </section>

    <section ref={boxScoreRef} className="sc-am-card sc-am-linescore">
      <h2>BOX SCORE</h2>
      <div className="sc-am-line-scroll"><table><thead><tr><th>TEAM</th>{displayInnings.map((item:any)=><th key={item.num}>{item.num}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>
        <tr><th>{teamShort(awayTeam)}</th>{displayInnings.map((item:any)=><td key={item.num}>{item?.away?.runs??'—'}</td>)}<td>{linescore?.teams?.away?.runs??0}</td><td>{linescore?.teams?.away?.hits??0}</td><td>{linescore?.teams?.away?.errors??0}</td></tr>
        <tr><th>{teamShort(homeTeam)}</th>{displayInnings.map((item:any)=><td key={item.num}>{item?.home?.runs??'—'}</td>)}<td>{linescore?.teams?.home?.runs??0}</td><td>{linescore?.teams?.home?.hits??0}</td><td>{linescore?.teams?.home?.errors??0}</td></tr>
      </tbody></table></div>
    </section>

    <div className="sc-am-split">
      <div className="sc-am-left">
        <section className="sc-am-card sc-am-pitch-card">
          <h2>PITCHER <span>vs</span> BATTER</h2>
          <div className="sc-am-matchup">
            <article><img src={mlbPlayerCutoutUrl(pitcher?.id,120)} onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=mlbPlayerHeadshotUrl(pitcher?.id,100);}} alt={personName(pitcher,'Pitcher')}/><div><b>{personName(pitcher,'Pitcher')}</b><small>{currentPlay?.matchup?.pitchHand?.code??'—'}HP #{pitcher?.primaryNumber??''}</small><p>{stat(pitcher?.stats?.pitching?.inningsPitched,'')} {pitcher?.stats?.pitching?.inningsPitched?'IP':''}</p></div></article>
            <span>VS</span>
            <article className="is-batter"><div><b>{personName(batter,'Batter')}</b><small>{currentPlay?.matchup?.batSide?.code??'—'} · #{batter?.primaryNumber??''}</small><p>{balls}–{strikes} count</p></div><img src={mlbPlayerCutoutUrl(batter?.id,120)} onError={event=>{event.currentTarget.onerror=null;event.currentTarget.src=mlbPlayerHeadshotUrl(batter?.id,100);}} alt={personName(batter,'Batter')}/></article>
          </div>
          <div className={`sc-am-pitch-scene ${isDayGame?'is-day':'is-night'}`}>
            <div className="sc-am-pitch-brand"><span className="material-symbols-outlined" aria-hidden="true">radar</span><div><b>SCOUTCORE PITCH TRACK</b><small>LIVE DATA</small></div></div>
            <div className="sc-am-zone">
              {pitchHeat.map((count,index)=><i key={index} className={`${count?`is-heat-${Math.min(count,3)}`:''} ${index===latestPitchCell?'is-latest-zone':''}`}/>) }
              {latestPitch&&<svg key={`trajectory-${pitchEventKey}`} className="sc-am-pitch-trajectory" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={pitchCurve} pathLength="1"/><circle cx={latestPitchPoint.x} cy={latestPitchPoint.y} r="4"/></svg>}
              {recentPitches.map((event:any,index:number)=>{const fallbackNumber=Math.max(1,latestPitchNumber-recentPitches.length+index+1);return <span key={event?.playId??event?.index??index} style={pitchDot(event)} className={index===recentPitches.length-1?'is-latest':''}>{event?.pitchNumber??fallbackNumber}</span>})}
            </div>
          </div>
          {latestPitch?<div aria-live="polite" key={`pitch-result-${pitchEventKey}`} className={`sc-am-pitch-result ${latestPitchTone}`}><b>{latestPitchNumber}</b><div><strong>{latestPitchCall}</strong><span>{Number.isFinite(latestPitchSpeed)?`${latestPitchSpeed.toFixed(1)} mph · `:''}{latestPitchType}</span></div><em>SC</em></div>:<div className="sc-am-pitch-result is-waiting"><span className="material-symbols-outlined">sensors</span><div><strong>Waiting for the next pitch</strong><span>Verified pitch data will animate here.</span></div><em>SC</em></div>}
        </section>

        <section className="sc-am-card sc-am-field-card">
          <h2>FIELD VIEW</h2>
          <div key={`field-${eventKey}`} className="sc-am-field-scene" style={{'--sc-am-ball-x':`${ballX}%`,'--sc-am-ball-y':`${ballY}%`} as React.CSSProperties}>
            <span className={`sc-am-field-base is-second ${offense?.second?'is-on':''}`}/><span className={`sc-am-field-base is-first ${offense?.first?'is-on':''}`}/><span className={`sc-am-field-base is-third ${offense?.third?'is-on':''}`}/><span className="sc-am-field-base is-home"/>
            {fielders.map(([key,player],index)=>{const [left,top,label]=FIELD_POSITIONS[key];const primary=isContact&&key===targetFielder;const coverage=primary?0.78:0.15;const dx=(ballX-left)*coverage,dy=(ballY-top)*coverage;return <span key={`${key}-${eventKey}`} title={personName(player,label)} style={{left:`${left}%`,top:`${top}%`,'--sc-am-fielder-x':`${dx}px`,'--sc-am-fielder-y':`${dy}px`,'--sc-am-fielder-delay':`${Math.min(index*.025,.18)}s`} as React.CSSProperties} className={`sc-am-fielder ${isContact?'is-moving':''} ${primary?'is-target':''}`}>{label}</span>;})}
            {isContact&&<span className="sc-am-ball" aria-label="Batted ball"><i/></span>}
            {runnerMotions.map(runner=><span key={runner.id} className={`sc-am-runner ${isContact?'is-moving':''} ${runner.isOut?'is-out':''}`} style={{'--sc-am-runner-start-x':`${runner.startX}%`,'--sc-am-runner-start-y':`${runner.startY}%`,'--sc-am-runner-end-x':`${runner.endX}%`,'--sc-am-runner-end-y':`${runner.endY}%`} as React.CSSProperties}/>) }
            <span className="sc-am-current-batter"><i/>{compactPersonName(batter,'Batter')}</span>
            <div className="sc-am-count"><div><span>Balls</span><i>{[0,1,2].map(i=><b key={i} className={balls>i?'is-on':''}/>)}</i></div><div><span>Strikes</span><i>{[0,1].map(i=><b key={i} className={strikes>i?'is-on':''}/>)}</i></div><div><span>Outs</span><i>{[0,1].map(i=><b key={i} className={outs>i?'is-on':''}/>)}</i></div></div>
          </div>
        </section>
      </div>

      <section className="sc-am-card sc-am-lineup-card">
        <h2>LINEUP</h2>
        <div className="sc-am-team-tabs" role="tablist" aria-label="Choose lineup">
          <button type="button" role="tab" aria-selected={selectedSide==='away'} className={`${selectedSide==='away'?'is-active':''} ${battingSide==='away'&&!isFinal?'is-playing':''}`} onClick={()=>setSelectedSide('away')}>{teamLabel(awayTeam)}</button>
          <button type="button" role="tab" aria-selected={selectedSide==='home'} className={`${selectedSide==='home'?'is-active':''} ${battingSide==='home'&&!isFinal?'is-playing':''}`} onClick={()=>setSelectedSide('home')}>{teamLabel(homeTeam)}</button>
        </div>
        <div className="sc-am-lineup-scroll"><table><thead><tr><th>BATTER</th><th>AB</th><th>R</th><th>H</th><th>RBI</th><th>BB</th><th>K</th><th>AVG</th><th>OPS</th></tr></thead><tbody>{battingRows.map((row:any,index:number)=>{const s=row?.stats?.batting??{},active=selectedSide===battingSide&&personId(row)===personId(batter);return <tr key={row?.person?.id??index} className={active?'is-current':''}><th title={personName(row,'Player')}><span className="sc-am-lineup-player"><em>{index+1}</em><b>{personName(row,'Player')}</b></span><small>{row?.position?.abbreviation??row?.position?.code??'—'}{active?' · AT BAT':''}</small></th><td>{stat(s.atBats)}</td><td>{stat(s.runs)}</td><td>{stat(s.hits)}</td><td>{stat(s.rbi)}</td><td>{stat(s.baseOnBalls)}</td><td>{stat(s.strikeOuts)}</td><td>{avgStat(s.avg)}</td><td>{avgStat(s.ops)}</td></tr>})}{!battingRows.length&&<tr><td colSpan={9}>Lineup waiting for MLB data.</td></tr>}</tbody></table></div>
        <div className="sc-am-lineup-total"><span>Totals</span><b>{stat(selectedBox?.teamStats?.batting?.atBats)}</b><b>{stat(selectedBox?.teamStats?.batting?.runs)}</b><b>{stat(selectedBox?.teamStats?.batting?.hits)}</b><b>{stat(selectedBox?.teamStats?.batting?.rbi)}</b><b>{stat(selectedBox?.teamStats?.batting?.baseOnBalls)}</b><b>{stat(selectedBox?.teamStats?.batting?.strikeOuts)}</b></div>
      </section>
    </div>

    <section className="sc-am-card sc-am-pitchers">
      <h2>PITCHERS – {teamShort(selectedTeam)}</h2>
      <div className="sc-am-pitchers-scroll"><table><thead><tr><th></th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>ERA</th></tr></thead><tbody>{pitchingRows.map((row:any,index:number)=>{const s=row?.stats?.pitching??{};return <tr key={row?.person?.id??index}><th>{personName(row,'Pitcher')}</th><td>{stat(s.inningsPitched,'0.0')}</td><td>{stat(s.hits)}</td><td>{stat(s.runs)}</td><td>{stat(s.earnedRuns)}</td><td>{stat(s.baseOnBalls)}</td><td>{stat(s.strikeOuts)}</td><td>{stat(s.homeRuns)}</td><td>{stat(s.era,'—')}</td></tr>})}{!pitchingRows.length&&<tr><td colSpan={9}>Pitching data will appear here.</td></tr>}<tr className="is-total"><th>Totals</th><td>{stat(teamTotals.ip,'0.0')}</td><td>{stat(teamTotals.h)}</td><td>{stat(teamTotals.r)}</td><td>{stat(teamTotals.er)}</td><td>{stat(teamTotals.bb)}</td><td>{stat(teamTotals.k)}</td><td>{stat(teamTotals.hr)}</td><td>{stat(teamTotals.era,'—')}</td></tr></tbody></table></div>
    </section>

    {finalOverlayOpen&&<div className="sc-am-final-overlay" role="dialog" aria-modal="true" aria-labelledby="sc-am-final-title">
      <section className="sc-am-final-card">
        <span className="sc-am-final-badge">GAME FINAL</span>
        <h2 id="sc-am-final-title">Final Score</h2>
        <p className="sc-am-final-summary">{winnerTeam?`${teamLabel(winnerTeam)} win by ${Math.abs(awayRuns-homeRuns)}.`:'The game finished tied.'}</p>
        <div className="sc-am-final-score">
          <article><img src={mlbTeamLogoUrl(awayTeam?.id)} alt=""/><b>{teamShort(awayTeam)}</b><strong>{awayRuns}</strong></article>
          <span>FINAL</span>
          <article><img src={mlbTeamLogoUrl(homeTeam?.id)} alt=""/><b>{teamShort(homeTeam)}</b><strong>{homeRuns}</strong></article>
        </div>
        <button type="button" className="sc-am-final-primary" onClick={()=>{setFinalOverlayOpen(false);window.requestAnimationFrame(()=>boxScoreRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));}}>VIEW FINAL BOX SCORE</button>
        <button type="button" className="sc-am-final-exit" onClick={onExit}><span className="material-symbols-outlined">arrow_back</span>BACK TO DASHBOARD</button>
      </section>
    </div>}
  </main>;
};
