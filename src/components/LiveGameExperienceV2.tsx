import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

type ChatMessage = {
  id: string;
  game_pk: number;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

type LiveGameExperienceProps = {
  gamePk: number;
  feed: any;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
};

type ReactionBurst = { id: number; emoji: string; lane: number };

type SceneMode = 'pregame' | 'pitch' | 'in-play' | 'home-run' | 'strikeout' | 'walk' | 'final';

const REACTION_EMOJIS = ['🔥', '👏', '😱', '⚾', '😂', '💙'] as const;
const CHAT_EMOJIS = ['🔥', '👏', '😱', '⚾', '😂', '💙', '👀', '💪'] as const;
const localChatKey = (gamePk: number) => `scoutcore:live-chat-preview:${gamePk}`;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const readLocalMessages = (gamePk: number): ChatMessage[] => {
  try {
    const raw = window.localStorage.getItem(localChatKey(gamePk));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-50) : [];
  } catch {
    return [];
  }
};

const writeLocalMessages = (gamePk: number, messages: ChatMessage[]) => {
  try { window.localStorage.setItem(localChatKey(gamePk), JSON.stringify(messages.slice(-50))); } catch {}
};

const displayTeamName = (team: any) => team?.abbreviation ?? team?.teamName ?? team?.name ?? 'TEAM';
const playerName = (player: any) => player?.fullName ?? player?.name ?? player?.person?.fullName ?? 'Player';

const getSceneMode = (currentPlay: any, latestEvent: any, detailedState: string): SceneMode => {
  if (String(detailedState).toLowerCase() === 'final') return 'final';
  const result = `${currentPlay?.result?.event ?? ''} ${currentPlay?.result?.eventType ?? ''}`.toLowerCase();
  if (result.includes('home run')) return 'home-run';
  if (result.includes('strikeout')) return 'strikeout';
  if (result.includes('walk') || result.includes('hit by pitch')) return 'walk';
  if (latestEvent?.details?.isInPlay || latestEvent?.hitData) return 'in-play';
  if (latestEvent?.isPitch || latestEvent?.details?.isPitch) return 'pitch';
  return 'pregame';
};

const buildLiveCall = ({ mode, batter, pitcher, description, pitchType, pitchSpeed, exitVelo, launchAngle, distance }: {
  mode: SceneMode;
  batter: any;
  pitcher: any;
  description: string;
  pitchType?: string;
  pitchSpeed?: number | null;
  exitVelo?: number | null;
  launchAngle?: number | null;
  distance?: number | null;
}) => {
  const hitter = playerName(batter);
  const thrower = playerName(pitcher);
  const pitchBits = [Number.isFinite(pitchSpeed) ? `${pitchSpeed!.toFixed(1)} mph` : '', pitchType ?? ''].filter(Boolean).join(' ');
  const contactBits = [
    Number.isFinite(exitVelo) ? `${exitVelo!.toFixed(1)} mph exit velocity` : '',
    Number.isFinite(launchAngle) ? `${Math.round(launchAngle!)}° launch angle` : '',
    Number.isFinite(distance) && distance! > 0 ? `${Math.round(distance!)} ft` : '',
  ].filter(Boolean).join(' · ');

  if (mode === 'home-run') return `${hitter} leaves the yard. ${contactBits || description}`;
  if (mode === 'strikeout') return `${thrower} wins the matchup and records the strikeout${pitchBits ? ` on ${pitchBits}` : ''}.`;
  if (mode === 'walk') return `${hitter} reaches base. The simulator updates the verified baserunner state from MLB.`;
  if (mode === 'in-play') return `${hitter} puts the ball in play${contactBits ? ` — ${contactBits}` : ''}. The ball path is drawn only after the verified event arrives.`;
  if (mode === 'pitch') return `${thrower} delivers${pitchBits ? ` ${pitchBits}` : ''}. Count and pitch result come directly from the live MLB feed.`;
  if (mode === 'final') return `Final. ScoutCore has stopped live animation because the verified game is complete.`;
  return description || 'Waiting for the next verified MLB event.';
};

const fielderSlots = [
  { pos: 'LF', className: 'fielder-lf' },
  { pos: 'CF', className: 'fielder-cf' },
  { pos: 'RF', className: 'fielder-rf' },
  { pos: '3B', className: 'fielder-3b' },
  { pos: 'SS', className: 'fielder-ss' },
  { pos: '2B', className: 'fielder-2b' },
  { pos: '1B', className: 'fielder-1b' },
] as const;

export const LiveGameExperienceV2: React.FC<LiveGameExperienceProps> = ({ gamePk, feed, signedIn, userEmail, onOpenAuth }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(userEmail?.split('@')[0] || 'ScoutCore User');
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [reactionBusy, setReactionBusy] = useState<string | null>(null);
  const [reactionBursts, setReactionBursts] = useState<ReactionBurst[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const lastSentAt = useRef(0);
  const burstId = useRef(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const gameData = feed?.gameData ?? {};
  const liveData = feed?.liveData ?? {};
  const linescore = liveData?.linescore ?? {};
  const plays = liveData?.plays ?? {};
  const boxscore = liveData?.boxscore ?? {};
  const allPlays = plays?.allPlays ?? [];
  const currentPlay = plays?.currentPlay ?? allPlays[allPlays.length - 1] ?? null;
  const currentEvents = currentPlay?.playEvents ?? [];
  const latestEvent = currentEvents[currentEvents.length - 1] ?? null;
  const offense = linescore?.offense ?? {};
  const awayTeam = gameData?.teams?.away ?? {};
  const homeTeam = gameData?.teams?.home ?? {};
  const awayRuns = linescore?.teams?.away?.runs ?? 0;
  const homeRuns = linescore?.teams?.home?.runs ?? 0;
  const abstractState = gameData?.status?.abstractGameState ?? 'Preview';
  const detailedState = gameData?.status?.detailedState ?? abstractState;
  const inning = linescore?.currentInning ?? 0;
  const topBottom = String(linescore?.inningState ?? '').toUpperCase();
  const inningLabel = detailedState === 'Final' ? 'FINAL' : inning ? `${topBottom} ${inning}`.trim() : detailedState;
  const batter = currentPlay?.matchup?.batter ?? null;
  const pitcher = currentPlay?.matchup?.pitcher ?? null;
  const balls = currentPlay?.count?.balls ?? linescore?.balls ?? 0;
  const strikes = currentPlay?.count?.strikes ?? linescore?.strikes ?? 0;
  const outs = currentPlay?.count?.outs ?? linescore?.outs ?? 0;
  const latestDescription = latestEvent?.details?.description
    ?? currentPlay?.result?.description
    ?? currentPlay?.result?.event
    ?? (abstractState === 'Live' ? 'Waiting for the next verified MLB event…' : detailedState);

  const eventKey = useMemo(() => String(
    latestEvent?.playId
    ?? currentPlay?.playEndTime
    ?? `${currentPlay?.atBatIndex ?? 'pregame'}-${latestEvent?.index ?? currentEvents.length}`
  ), [latestEvent?.playId, latestEvent?.index, currentPlay?.playEndTime, currentPlay?.atBatIndex, currentEvents.length]);

  const sceneMode = getSceneMode(currentPlay, latestEvent, detailedState);
  const battingTeam = linescore?.isTopInning ? awayTeam : homeTeam;
  const fieldingTeam = linescore?.isTopInning ? homeTeam : awayTeam;
  const defenseBox = linescore?.isTopInning ? boxscore?.teams?.home : boxscore?.teams?.away;
  const defensePlayers = Object.values(defenseBox?.players ?? {}) as any[];
  const playerAtPosition = (position: string) => defensePlayers.find((row) => row?.position?.abbreviation === position || row?.allPositions?.some?.((p: any) => p?.abbreviation === position));

  const pitchSpeed = Number(latestEvent?.pitchData?.startSpeed);
  const pitchType = latestEvent?.details?.type?.description as string | undefined;
  const exitVelo = Number(latestEvent?.hitData?.launchSpeed);
  const launchAngle = Number(latestEvent?.hitData?.launchAngle);
  const distance = Number(latestEvent?.hitData?.totalDistance);
  const coordX = Number(latestEvent?.hitData?.coordinates?.coordX);
  const coordY = Number(latestEvent?.hitData?.coordinates?.coordY);
  const ballTarget = {
    x: Number.isFinite(coordX) ? clamp(15 + (coordX / 250) * 70, 12, 88) : 50,
    y: Number.isFinite(coordY) ? clamp(12 + (coordY / 250) * 48, 9, 63) : sceneMode === 'home-run' ? 13 : 29,
  };
  const sceneStyle = { '--ball-x': `${ballTarget.x}%`, '--ball-y': `${ballTarget.y}%` } as React.CSSProperties;

  const liveCall = buildLiveCall({
    mode: sceneMode,
    batter,
    pitcher,
    description: latestDescription,
    pitchType,
    pitchSpeed: Number.isFinite(pitchSpeed) ? pitchSpeed : null,
    exitVelo: Number.isFinite(exitVelo) ? exitVelo : null,
    launchAngle: Number.isFinite(launchAngle) ? launchAngle : null,
    distance: Number.isFinite(distance) ? distance : null,
  });

  const eventBadge = sceneMode === 'home-run' ? 'HOME RUN'
    : sceneMode === 'strikeout' ? 'STRIKEOUT'
      : sceneMode === 'walk' ? 'REACHED BASE'
        : sceneMode === 'in-play' ? 'BALL IN PLAY'
          : sceneMode === 'pitch' ? 'PITCH'
            : sceneMode === 'final' ? 'FINAL'
              : 'LIVE READY';

  const applyReactionRows = (rows: any[], currentUserId?: string | null) => {
    const counts: Record<string, number> = {};
    const mine: string[] = [];
    rows.forEach((row) => {
      counts[row.emoji] = (counts[row.emoji] ?? 0) + 1;
      if (currentUserId && row.user_id === currentUserId) mine.push(row.emoji);
    });
    setReactionCounts(counts);
    setMyReactions(mine);
  };

  const burstReaction = (emoji: string) => {
    const id = ++burstId.current;
    const lane = id % 6;
    setReactionBursts((current) => [...current.slice(-14), { id, emoji, lane }]);
    window.setTimeout(() => setReactionBursts((current) => current.filter((burst) => burst.id !== id)), 1800);
  };

  useEffect(() => {
    setDisplayName(userEmail?.split('@')[0] || 'ScoutCore User');
  }, [userEmail]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setNotice(null);
      let activeUserId: string | null = null;
      if (supabase && signedIn) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          activeUserId = data.user.id;
          if (!cancelled) {
            setUserId(data.user.id);
            const metadata = data.user.user_metadata ?? {};
            setDisplayName(metadata.display_name || metadata.full_name || data.user.email?.split('@')[0] || 'ScoutCore User');
          }
        }
      } else if (!signedIn) {
        setUserId(null);
      }

      if (!supabase) {
        if (!cancelled) {
          setBackendReady(false);
          setMessages(readLocalMessages(gamePk));
          setReactionCounts({});
          setMyReactions([]);
        }
        return;
      }

      const [messageResult, reactionResult] = await Promise.all([
        supabase.from('game_chat_messages').select('id,game_pk,user_id,display_name,body,created_at').eq('game_pk', gamePk).order('created_at', { ascending: false }).limit(50),
        supabase.from('game_event_reactions').select('emoji,user_id').eq('game_pk', gamePk).eq('event_key', eventKey),
      ]);
      if (cancelled) return;
      if (messageResult.error || reactionResult.error) {
        setBackendReady(false);
        setMessages(readLocalMessages(gamePk));
        setReactionCounts({});
        setMyReactions([]);
        return;
      }
      setBackendReady(true);
      setMessages([...(messageResult.data ?? [])].reverse() as ChatMessage[]);
      applyReactionRows(reactionResult.data ?? [], activeUserId);
    };
    void load();
    return () => { cancelled = true; };
  }, [gamePk, eventKey, signedIn, userEmail]);

  useEffect(() => {
    if (!backendReady || !supabase) return;
    const channel = supabase
      .channel(`game-social-${gamePk}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_chat_messages', filter: `game_pk=eq.${gamePk}` }, (payload) => {
        const incoming = payload.new as ChatMessage;
        setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming].slice(-50));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_event_reactions', filter: `game_pk=eq.${gamePk}` }, async () => {
        const { data, error } = await supabase.from('game_event_reactions').select('emoji,user_id').eq('game_pk', gamePk).eq('event_key', eventKey);
        if (!error) applyReactionRows(data ?? [], userId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [backendReady, gamePk, eventKey, userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const refreshReactions = async () => {
    if (!supabase || !backendReady) return;
    const { data, error } = await supabase.from('game_event_reactions').select('emoji,user_id').eq('game_pk', gamePk).eq('event_key', eventKey);
    if (!error) applyReactionRows(data ?? [], userId);
  };

  const react = async (emoji: string) => {
    if (!signedIn) {
      onOpenAuth();
      return;
    }
    if (reactionBusy) return;
    burstReaction(emoji);
    setReactionBusy(emoji);
    setNotice(null);

    if (backendReady && supabase && userId) {
      const active = myReactions.includes(emoji);
      const result = active
        ? await supabase.from('game_event_reactions').delete().eq('game_pk', gamePk).eq('event_key', eventKey).eq('emoji', emoji).eq('user_id', userId)
        : await supabase.from('game_event_reactions').insert({ game_pk: gamePk, event_key: eventKey, emoji, user_id: userId });
      if (result.error) setNotice('Could not sync that reaction right now.');
      else await refreshReactions();
    } else {
      const wasActive = myReactions.includes(emoji);
      setMyReactions((current) => current.includes(emoji) ? current.filter((item) => item !== emoji) : [...current, emoji]);
      setReactionCounts((current) => ({ ...current, [emoji]: Math.max(0, (current[emoji] ?? 0) + (wasActive ? -1 : 1)) }));
      setNotice('Preview mode: this reaction stays on this device until live sync is published.');
    }
    setReactionBusy(null);
  };

  const sendMessage = async () => {
    const body = messageText.trim().slice(0, 280);
    if (!body) return;
    if (!signedIn) {
      onOpenAuth();
      return;
    }
    const now = Date.now();
    if (now - lastSentAt.current < 2000) {
      setNotice('Give the chat a second before sending another message.');
      return;
    }
    lastSentAt.current = now;
    setNotice(null);

    if (backendReady && supabase && userId) {
      const { error } = await supabase.from('game_chat_messages').insert({ game_pk: gamePk, user_id: userId, display_name: displayName.slice(0, 48), body });
      if (error) {
        setNotice(error.message.includes('wait') ? 'Give the chat a second before sending another message.' : 'Live chat could not send that message right now.');
        return;
      }
      setMessageText('');
      return;
    }

    const localMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      game_pk: gamePk,
      user_id: userId || 'preview-user',
      display_name: displayName,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => {
      const next = [...current, localMessage].slice(-50);
      writeLocalMessages(gamePk, next);
      return next;
    });
    setMessageText('');
    setNotice('Preview mode: this message is only visible on this device until the live-chat backend is published.');
  };

  return (
    <main className="mx-auto max-w-[1280px] px-3 py-4 sm:px-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,.58fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] shadow-[0_24px_90px_rgba(0,0,0,.28)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${abstractState === 'Live' ? 'bg-[#ff5d6c] animate-pulse' : 'bg-[#6e7d91]'}`} />
                <p className="text-xs font-extrabold tracking-[.12em] text-[#00e6f4]">SCOUTCORE LIVE STADIUM</p>
                <span className="rounded-full border border-[#65f2b5]/25 bg-[#65f2b5]/8 px-2 py-0.5 text-[8px] font-extrabold tracking-wider text-[#65f2b5]">VERIFIED DATA</span>
              </div>
              <p className="mt-1 text-[11px] text-[#8fa0b7]">AI-style presentation driven by completed live MLB events. It never invents the next play.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#2b405b] bg-[#08111f] px-3 py-2">
              <div className="flex items-center gap-2"><img src={mlbTeamLogoUrl(awayTeam?.id)} alt="" className="h-8 w-8 object-contain"/><span className="text-[10px] font-bold text-[#8fa0b7]">{displayTeamName(awayTeam)}</span><span className="font-mono text-xl font-extrabold">{awayRuns}</span></div>
              <span className="text-[#64748b]">—</span>
              <div className="flex items-center gap-2"><span className="font-mono text-xl font-extrabold">{homeRuns}</span><span className="text-[10px] font-bold text-[#8fa0b7]">{displayTeamName(homeTeam)}</span><img src={mlbTeamLogoUrl(homeTeam?.id)} alt="" className="h-8 w-8 object-contain"/></div>
            </div>
          </div>

          <div className={`scoutcore-stadium scene-${sceneMode} relative min-h-[520px] overflow-hidden sm:min-h-[620px]`} style={sceneStyle}>
            <div className="scoutcore-stadium-crowd" aria-hidden="true" />
            <div className="scoutcore-stadium-lights" aria-hidden="true" />
            <div className="scoutcore-stadium-field" aria-hidden="true" />
            <div className="scoutcore-stadium-diamond" aria-hidden="true" />
            <div className="scoutcore-stadium-foul scoutcore-stadium-foul-left" aria-hidden="true" />
            <div className="scoutcore-stadium-foul scoutcore-stadium-foul-right" aria-hidden="true" />

            <div className="absolute left-4 top-4 z-30 rounded-xl border border-white/10 bg-[#07101f]/88 px-3 py-2 backdrop-blur">
              <div className="font-mono text-xs font-extrabold text-[#00e6f4]">{inningLabel}</div>
              <div className="mt-1 text-[10px] text-[#aab7c9]">{balls}-{strikes} COUNT · {outs} OUT{Number(outs) === 1 ? '' : 'S'}</div>
            </div>
            <div className="absolute right-4 top-4 z-30 rounded-xl border border-white/10 bg-[#07101f]/88 px-3 py-2 text-right backdrop-blur">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#718090]">At bat</div>
              <div className="mt-1 text-xs font-extrabold text-white">{displayTeamName(battingTeam)}</div>
              <div className="mt-0.5 text-[9px] text-[#8fa0b7]">Fielding: {displayTeamName(fieldingTeam)}</div>
            </div>

            {fielderSlots.map((slot) => {
              const row = playerAtPosition(slot.pos);
              return <div key={slot.pos} className={`scoutcore-fielder ${slot.className}`} title={row?.person?.fullName ?? slot.pos}><span className="scoutcore-fielder-dot"/><span>{slot.pos}</span>{row?.person?.fullName && <small>{String(row.person.fullName).split(' ').slice(-1)[0]}</small>}</div>;
            })}

            <div className="scoutcore-sim-base scoutcore-sim-base-second is-stadium-base"><span>2B</span>{offense?.second && <RunnerChip runner={offense.second} />}</div>
            <div className="scoutcore-sim-base scoutcore-sim-base-first is-stadium-base"><span>1B</span>{offense?.first && <RunnerChip runner={offense.first} />}</div>
            <div className="scoutcore-sim-base scoutcore-sim-base-third is-stadium-base"><span>3B</span>{offense?.third && <RunnerChip runner={offense.third} />}</div>
            <div className="scoutcore-sim-home"><span>HOME</span></div>

            <div className="scoutcore-stadium-pitcher">
              {pitcher?.id ? <img src={mlbPlayerHeadshotUrl(pitcher.id, 160)} alt=""/> : <span className="material-symbols-outlined">sports_baseball</span>}
              <div><small>PITCHER</small><strong>{playerName(pitcher)}</strong></div>
            </div>
            <div className="scoutcore-stadium-batter">
              {batter?.id ? <img src={mlbPlayerHeadshotUrl(batter.id, 160)} alt=""/> : <span className="material-symbols-outlined">sports_baseball</span>}
              <div><small>BATTER</small><strong>{playerName(batter)}</strong></div>
            </div>

            <div key={`${eventKey}-${sceneMode}`} className={`scoutcore-live-ball ball-${sceneMode}`} aria-hidden="true">⚾</div>
            {sceneMode === 'home-run' && <div key={`hr-${eventKey}`} className="scoutcore-hr-flash">HOME RUN</div>}
            {sceneMode === 'strikeout' && <div key={`k-${eventKey}`} className="scoutcore-k-flash">K</div>}

            <div className="scoutcore-live-call absolute bottom-5 left-1/2 z-30 w-[94%] max-w-3xl -translate-x-1/2 rounded-2xl border border-[#00e6f4]/20 bg-[#07101f]/92 p-4 shadow-[0_18px_55px_rgba(0,0,0,.34)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="rounded-full bg-[#00e6f4] px-2.5 py-1 text-[9px] font-black tracking-wider text-[#03242b]">{eventBadge}</span><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[#65f2b5]">ScoutCore Live Analysis</span></div>
                <span className="text-[9px] text-[#607086]">Verified event #{currentPlay?.atBatIndex != null ? Number(currentPlay.atBatIndex) + 1 : '—'}</span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-white sm:text-base">{liveCall}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#8fa0b7]">
                {Number.isFinite(pitchSpeed) && <span>Pitch {pitchSpeed.toFixed(1)} mph</span>}
                {pitchType && <span>{pitchType}</span>}
                {Number.isFinite(exitVelo) && exitVelo > 0 && <span>EV {exitVelo.toFixed(1)} mph</span>}
                {Number.isFinite(launchAngle) && <span>LA {Math.round(launchAngle)}°</span>}
                {Number.isFinite(distance) && distance > 0 && <span>{Math.round(distance)} ft</span>}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
              {reactionBursts.map((burst) => <span key={burst.id} className={`scoutcore-reaction-burst burst-lane-${burst.lane}`}>{burst.emoji}</span>)}
            </div>
          </div>

          <div className="border-t border-[#26364e] bg-[#0a1424] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8fa0b7]">React to this live moment</p><p className="mt-1 text-[10px] text-[#64748b]">Reactions float over the stadium. Account required to react.</p></div>
              <div className="flex flex-wrap gap-2">
                {REACTION_EMOJIS.map((emoji) => {
                  const active = myReactions.includes(emoji);
                  return <button key={emoji} type="button" onClick={() => void react(emoji)} disabled={reactionBusy === emoji} className={`flex min-w-[48px] items-center justify-center gap-1 rounded-full border px-2.5 py-1.5 text-sm transition ${active ? 'border-[#00e6f4] bg-[#00e6f4]/12' : 'border-[#30415c] bg-[#10192b] hover:border-[#00e6f4]/45'}`}><span>{emoji}</span><span className="text-[10px] font-bold text-[#aebbd0]">{reactionCounts[emoji] ?? 0}</span></button>;
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] xl:max-h-[790px]">
          <div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3">
            <div><p className="text-sm font-extrabold text-white">LIVE GAME CHAT</p><p className="mt-1 text-[10px] text-[#8fa0b7]">Chat and react while the verified game updates.</p></div>
            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${backendReady ? 'border-[#65f2b5]/35 bg-[#65f2b5]/10 text-[#65f2b5]' : 'border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffd166]'}`}>{backendReady ? 'LIVE SYNC' : 'PREVIEW'}</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length ? messages.map((message) => <div key={message.id} className="rounded-xl border border-[#26364e] bg-[#10192b] p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-bold text-[#00e6f4]">{message.display_name}</span><span className="shrink-0 text-[9px] text-[#607086]">{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-[#d7e0ee]">{message.body}</p></div>) : <div className="rounded-xl border border-dashed border-[#40516b] p-6 text-center"><span className="material-symbols-outlined text-3xl text-[#526275]">forum</span><p className="mt-2 text-sm font-semibold text-white">No messages yet</p><p className="mt-1 text-xs text-[#8fa0b7]">Be the first ScoutCore user to react to the game.</p></div>}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-[#26364e] p-3">
            {notice && <div className="mb-2 rounded-lg border border-[#ffd166]/25 bg-[#ffd166]/7 px-3 py-2 text-[10px] leading-4 text-[#e7d9aa]">{notice}</div>}
            {!signedIn ? <button type="button" onClick={onOpenAuth} className="w-full rounded-xl bg-[#00e6f4] px-4 py-3 text-xs font-extrabold text-[#062029]">LOG IN TO JOIN LIVE CHAT</button> : <>
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{CHAT_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setMessageText((current) => `${current}${emoji}`.slice(0, 280))} className="h-8 min-w-8 rounded-lg border border-[#30415c] bg-[#10192b] text-base hover:border-[#00e6f4]/45">{emoji}</button>)}</div>
              <div className="flex items-end gap-2"><textarea value={messageText} onChange={(event) => setMessageText(event.target.value.slice(0, 280))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={2} placeholder="Chat about the game…" className="min-h-[48px] flex-1 resize-none rounded-xl border border-[#30415c] bg-[#08111f] px-3 py-2 text-sm text-white outline-none placeholder:text-[#607086] focus:border-[#00e6f4]"/><button type="button" onClick={() => void sendMessage()} disabled={!messageText.trim()} className="h-12 rounded-xl bg-[#00e6f4] px-4 text-xs font-extrabold text-[#062029] disabled:opacity-35">SEND</button></div>
              <div className="mt-1.5 flex items-center justify-between text-[9px] text-[#607086]"><span>Enter to send · Shift+Enter for a new line</span><span>{messageText.length}/280</span></div>
            </>}
          </div>
        </aside>
      </div>
    </main>
  );
};

const RunnerChip = ({ runner }: { runner: any }) => <span className="scoutcore-runner-chip" title={playerName(runner)}><span className="material-symbols-outlined">directions_run</span><small>{String(playerName(runner)).split(' ').slice(-1)[0]}</small></span>;
