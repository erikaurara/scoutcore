import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';
import { SocialAvatar, SocialProfileCard, type SocialProfileTarget } from './SocialProfileCard';

type ChatMessage = {
  id: string;
  game_pk: number;
  user_id: string;
  display_name: string;
  body: string;
  created_at: string;
};

type ChatSocial = {
  message_id: string;
  profile_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type LiveGameExperienceProps = {
  gamePk: number;
  feed: any;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
};

type PostgameTab = 'wrap' | 'breakdown';

const REACTION_EMOJIS = ['🔥', '👏', '😱', '⚾', '😂', '💙'] as const;
const CHAT_EMOJIS = ['🔥', '👏', '😱', '⚾', '😂', '💙', '👀', '💪'] as const;
const localChatKey = (gamePk: number) => `scoutcore:live-chat-preview:${gamePk}`;

const displayTeamName = (team: any) => team?.abbreviation ?? team?.teamName ?? team?.name ?? 'TEAM';
const playerName = (player: any, fallback = '—') => player?.fullName ?? player?.name ?? player?.person?.fullName ?? fallback;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const stat = (value: any, fallback: string | number = '—') => value === 0 || value ? value : fallback;

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

export const LiveGameExperienceV4: React.FC<LiveGameExperienceProps> = ({ gamePk, feed, signedIn, userEmail, onOpenAuth }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(userEmail?.split('@')[0] || 'ScoutCore User');
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [reactionBusy, setReactionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatSocial, setChatSocial] = useState<Record<string, ChatSocial>>({});
  const [selectedSocial, setSelectedSocial] = useState<SocialProfileTarget | null>(null);
  const [postgameOpen, setPostgameOpen] = useState(false);
  const [postgameTab, setPostgameTab] = useState<PostgameTab>('wrap');
  const lastSentAt = useRef(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const gameData = feed?.gameData ?? {};
  const liveData = feed?.liveData ?? {};
  const linescore = liveData?.linescore ?? {};
  const boxscore = liveData?.boxscore ?? {};
  const plays = liveData?.plays ?? {};
  const decisions = liveData?.decisions ?? {};
  const allPlays = Array.isArray(plays?.allPlays) ? plays.allPlays : [];
  const currentPlay = plays?.currentPlay ?? allPlays[allPlays.length - 1] ?? null;
  const currentEvents = Array.isArray(currentPlay?.playEvents) ? currentPlay.playEvents : [];
  const latestEvent = currentEvents[currentEvents.length - 1] ?? null;
  const offense = linescore?.offense ?? {};
  const defense = linescore?.defense ?? {};
  const awayTeam = gameData?.teams?.away ?? {};
  const homeTeam = gameData?.teams?.home ?? {};
  const awayRuns = Number(linescore?.teams?.away?.runs ?? 0);
  const homeRuns = Number(linescore?.teams?.home?.runs ?? 0);
  const awayHits = Number(linescore?.teams?.away?.hits ?? 0);
  const homeHits = Number(linescore?.teams?.home?.hits ?? 0);
  const awayErrors = Number(linescore?.teams?.away?.errors ?? 0);
  const homeErrors = Number(linescore?.teams?.home?.errors ?? 0);
  const abstractState = gameData?.status?.abstractGameState ?? 'Preview';
  const detailedState = gameData?.status?.detailedState ?? abstractState;
  const isFinal = abstractState === 'Final' || String(detailedState).toLowerCase().includes('final');
  const inning = Number(linescore?.currentInning ?? 0);
  const topBottom = String(linescore?.inningState ?? '').toUpperCase();
  const inningLabel = isFinal ? 'FINAL' : inning ? `${topBottom} ${inning}`.trim() : detailedState;
  const batter = currentPlay?.matchup?.batter ?? null;
  const pitcher = currentPlay?.matchup?.pitcher ?? null;
  const balls = Number(currentPlay?.count?.balls ?? linescore?.balls ?? 0);
  const strikes = Number(currentPlay?.count?.strikes ?? linescore?.strikes ?? 0);
  const outs = Number(currentPlay?.count?.outs ?? linescore?.outs ?? 0);
  const latestDescription = latestEvent?.details?.description
    ?? currentPlay?.result?.description
    ?? currentPlay?.result?.event
    ?? (abstractState === 'Live' ? 'Waiting for the next verified MLB event…' : detailedState);

  const eventKey = useMemo(() => String(
    latestEvent?.playId
    ?? currentPlay?.playEndTime
    ?? `${currentPlay?.atBatIndex ?? 'pregame'}-${latestEvent?.index ?? currentEvents.length}`
  ), [latestEvent?.playId, latestEvent?.index, currentPlay?.playEndTime, currentPlay?.atBatIndex, currentEvents.length]);

  const battingSide = linescore?.isTopInning ? 'away' : 'home';
  const battingTeam = battingSide === 'away' ? awayTeam : homeTeam;
  const fieldingTeam = battingSide === 'away' ? homeTeam : awayTeam;
  const battingBox = boxscore?.teams?.[battingSide] ?? {};
  const awayBox = boxscore?.teams?.away ?? {};
  const homeBox = boxscore?.teams?.home ?? {};
  const innings = Array.isArray(linescore?.innings) ? linescore.innings : [];
  const recentPitches = currentEvents.filter((event: any) => event?.isPitch || event?.details?.isPitch).slice(-6);
  const recentPlays = allPlays.slice(-6).reverse();
  const battingRows = (Array.isArray(battingBox?.batters) ? battingBox.batters : [])
    .map((id: number) => battingBox?.players?.[`ID${id}`])
    .filter(Boolean)
    .slice(0, 6);

  const findBoxPlayer = (id?: number | null) => {
    if (!id) return null;
    return awayBox?.players?.[`ID${id}`] ?? homeBox?.players?.[`ID${id}`] ?? null;
  };
  const batterRow = findBoxPlayer(batter?.id);
  const pitcherRow = findBoxPlayer(pitcher?.id);
  const batterStats = batterRow?.stats?.batting ?? {};
  const pitcherStats = pitcherRow?.stats?.pitching ?? {};

  const fielders = [
    { key: 'pitcher', label: 'P', player: defense?.pitcher, left: '50%', top: '57%' },
    { key: 'catcher', label: 'C', player: defense?.catcher, left: '50%', top: '85%' },
    { key: 'first', label: '1B', player: defense?.first, left: '72%', top: '64%' },
    { key: 'second', label: '2B', player: defense?.second, left: '64%', top: '47%' },
    { key: 'shortstop', label: 'SS', player: defense?.shortstop, left: '36%', top: '47%' },
    { key: 'third', label: '3B', player: defense?.third, left: '28%', top: '64%' },
    { key: 'left', label: 'LF', player: defense?.left, left: '23%', top: '27%' },
    { key: 'center', label: 'CF', player: defense?.center, left: '50%', top: '17%' },
    { key: 'right', label: 'RF', player: defense?.right, left: '77%', top: '27%' },
  ];

  const winnerTeam = awayRuns > homeRuns ? awayTeam : homeRuns > awayRuns ? homeTeam : null;
  const loserTeam = winnerTeam ? (winnerTeam?.id === awayTeam?.id ? homeTeam : awayTeam) : null;
  const runMargin = Math.abs(awayRuns - homeRuns);
  const highestScoringInning = innings.reduce((best: any, item: any) => {
    const total = Number(item?.away?.runs ?? 0) + Number(item?.home?.runs ?? 0);
    const bestTotal = Number(best?.away?.runs ?? 0) + Number(best?.home?.runs ?? 0);
    return total > bestTotal ? item : best;
  }, innings[0] ?? null);

  const pitchDotStyle = (event: any) => {
    const x = Number(event?.pitchData?.coordinates?.pX);
    const z = Number(event?.pitchData?.coordinates?.pZ);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return { left: '50%', top: '50%' };
    const left = 50 + clamp(x / 1.5, -1, 1) * 40;
    const top = 86 - clamp((z - 1) / 3, 0, 1) * 72;
    return { left: `${left}%`, top: `${top}%` };
  };

  const insight = useMemo(() => {
    if (isFinal) return `The verified final box score is ${displayTeamName(awayTeam)} ${awayRuns}, ${displayTeamName(homeTeam)} ${homeRuns}. Open the postgame breakdown for the recorded game summary.`;
    const pitcherKs = Number(pitcherStats?.strikeOuts ?? 0);
    const pitcherIp = pitcherStats?.inningsPitched;
    const batterHits = Number(batterStats?.hits ?? 0);
    const batterAbs = Number(batterStats?.atBats ?? 0);
    if (pitcherKs >= 5) return `${playerName(pitcher, 'The pitcher')} has ${pitcherKs} strikeouts${pitcherIp ? ` through ${pitcherIp} innings` : ''}. ScoutCore is highlighting the current strikeout total from the verified box score.`;
    if (batterHits >= 2) return `${playerName(batter, 'The batter')} is ${batterHits}-for-${Math.max(batterAbs, batterHits)} in this game. The live view is using the recorded box score, not a projected result.`;
    return latestDescription || 'ScoutCore will summarize the next verified MLB event when it reaches the live feed.';
  }, [isFinal, awayRuns, homeRuns, awayTeam, homeTeam, pitcherStats?.strikeOuts, pitcherStats?.inningsPitched, batterStats?.hits, batterStats?.atBats, pitcher, batter, latestDescription]);

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

  const loadChatSocial = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc('get_game_chat_social_profiles', { p_game_pk: gamePk, p_limit: 50 });
    if (error) return;
    const next: Record<string, ChatSocial> = {};
    for (const row of (data ?? []) as ChatSocial[]) next[row.message_id] = row;
    setChatSocial(next);
  };

  useEffect(() => {
    setDisplayName(userEmail?.split('@')[0] || 'ScoutCore User');
  }, [userEmail]);

  useEffect(() => {
    setPostgameOpen(isFinal);
    setPostgameTab('wrap');
  }, [gamePk, isFinal]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setNotice(null);
      let activeUserId: string | null = null;
      if (supabase && signedIn) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          activeUserId = data.user.id;
          await supabase.rpc('sync_my_social_profile');
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
          setChatSocial({});
        }
        return;
      }

      const [messageResult, reactionResult, socialResult] = await Promise.all([
        supabase.from('game_chat_messages').select('id,game_pk,user_id,display_name,body,created_at').eq('game_pk', gamePk).order('created_at', { ascending: false }).limit(50),
        supabase.from('game_event_reactions').select('emoji,user_id').eq('game_pk', gamePk).eq('event_key', eventKey),
        supabase.rpc('get_game_chat_social_profiles', { p_game_pk: gamePk, p_limit: 50 }),
      ]);
      if (cancelled) return;
      if (!socialResult.error) {
        const next: Record<string, ChatSocial> = {};
        for (const row of (socialResult.data ?? []) as ChatSocial[]) next[row.message_id] = row;
        setChatSocial(next);
      }
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
      .channel(`game-social-v4-${gamePk}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_chat_messages', filter: `game_pk=eq.${gamePk}` }, (payload) => {
        const incoming = payload.new as ChatMessage;
        setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming].slice(-50));
        void loadChatSocial();
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
      window.setTimeout(() => void loadChatSocial(), 250);
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
    setNotice('Preview mode: this message is only visible on this device until live sync is published.');
  };

  return (
    <main className="mx-auto w-full max-w-[1740px] px-3 py-4 sm:px-5">
      <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2b405b] bg-[#0a1423] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${abstractState === 'Live' ? 'animate-pulse bg-[#ff5d6c]' : isFinal ? 'bg-[#65f2b5]' : 'bg-[#6e7d91]'}`} />
          <div><p className="text-[11px] font-black tracking-[.16em] text-[#00e6f4]">SCOUTCORE AI LIVE SIM</p><p className="mt-0.5 text-[10px] text-[#718198]">Live MLB data · field alignment · pitch tracking · chat</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-[#26364e] bg-[#07101d] px-3 py-2">
          <div className="flex items-center gap-2"><img src={mlbTeamLogoUrl(awayTeam?.id)} alt="" className="h-7 w-7 object-contain"/><span className="text-xs font-black text-white">{displayTeamName(awayTeam)}</span><span className="font-mono text-xl font-black text-white">{awayRuns}</span></div>
          <span className="rounded-md border border-[#33465f] px-2 py-1 font-mono text-[9px] font-bold text-[#8fa0b7]">{inningLabel}</span>
          <div className="flex items-center gap-2"><span className="font-mono text-xl font-black text-white">{homeRuns}</span><span className="text-xs font-black text-white">{displayTeamName(homeTeam)}</span><img src={mlbTeamLogoUrl(homeTeam?.id)} alt="" className="h-7 w-7 object-contain"/></div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[280px_minmax(460px,1fr)_300px_340px]">
        <div className="space-y-3">
          <PlayerLiveCard title="AT BAT" player={batter} imageId={batter?.id} subtitle={`${currentPlay?.matchup?.batSide?.description ?? 'Batter'} · ${displayTeamName(battingTeam)}`} stats={[
            ['AB', stat(batterStats?.atBats, 0)], ['H', stat(batterStats?.hits, 0)], ['R', stat(batterStats?.runs, 0)], ['RBI', stat(batterStats?.rbi, 0)],
          ]} />
          <PlayerLiveCard title="PITCHING" player={pitcher} imageId={pitcher?.id} subtitle={`${currentPlay?.matchup?.pitchHand?.description ?? 'Pitcher'} · ${displayTeamName(fieldingTeam)}`} stats={[
            ['IP', stat(pitcherStats?.inningsPitched)], ['K', stat(pitcherStats?.strikeOuts, 0)], ['H', stat(pitcherStats?.hits, 0)], ['P', stat(pitcherStats?.numberOfPitches, 0)],
          ]} />

          <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
            <div className="flex items-center justify-between border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black tracking-[.14em] text-white">PITCH SEQUENCE</p><span className="font-mono text-[10px] font-bold text-[#00e6f4]">{balls}-{strikes}</span></div>
            <div className="divide-y divide-[#1e3047]">
              {recentPitches.length ? [...recentPitches].reverse().map((event: any, index: number) => {
                const speed = Number(event?.pitchData?.startSpeed);
                return <div key={event?.playId ?? event?.index ?? index} className="flex items-center gap-3 px-4 py-2.5"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#2f5264] bg-[#09222c] text-[9px] font-black text-[#00e6f4]">{recentPitches.length - index}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#dce6f4]">{event?.details?.type?.description ?? 'Pitch'}</p><p className="truncate text-[9px] text-[#718198]">{event?.details?.call?.description ?? event?.details?.description ?? 'Tracked event'}</p></div><span className="font-mono text-[9px] font-bold text-[#9dafc3]">{Number.isFinite(speed) ? `${speed.toFixed(1)} mph` : '—'}</span></div>;
              }) : <div className="px-4 py-6 text-center text-[11px] text-[#718198]">Pitch data will appear during the plate appearance.</div>}
            </div>
            <div className="border-t border-[#26364e] p-3"><div className="relative mx-auto h-28 w-24 rounded-lg border border-[#31445e] bg-[#07101d]"><div className="absolute inset-x-[19%] bottom-[18%] top-[18%] border border-[#637992]"/>{recentPitches.map((event: any, index: number) => <span key={`dot-${event?.playId ?? event?.index ?? index}`} style={pitchDotStyle(event)} className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#00e6f4] text-[7px] font-black text-[#062029]">{index + 1}</span>)}</div></div>
          </section>
        </div>

        <div className="space-y-3">
          <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
            <div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3"><div><p className="text-[11px] font-black tracking-[.14em] text-white">FIELD ALIGNMENT</p><p className="mt-1 text-[9px] text-[#718198]">Current defensive positions</p></div><span className="rounded-lg border border-[#00e6f4]/35 bg-[#00e6f4]/8 px-2.5 py-1 text-[8px] font-black tracking-wider text-[#00e6f4]">DEFENSE · STANDARD</span></div>
            <div className="scoutcore-sim-field relative min-h-[535px] overflow-hidden">
              <div className="scoutcore-sim-diamond" aria-hidden="true"/>
              <div className={`scoutcore-sim-base scoutcore-sim-base-second ${offense?.second ? 'is-active' : ''}`}><span>2B</span></div>
              <div className={`scoutcore-sim-base scoutcore-sim-base-first ${offense?.first ? 'is-active' : ''}`}><span>1B</span></div>
              <div className={`scoutcore-sim-base scoutcore-sim-base-third ${offense?.third ? 'is-active' : ''}`}><span>3B</span></div>
              <div className="scoutcore-sim-home"><span>HOME</span></div>
              <div className="scoutcore-sim-mound"><span>P</span></div>
              {fielders.map((spot) => <div key={spot.key} style={{ left: spot.left, top: spot.top }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center"><div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#00e6f4]/45 bg-[#071522]/95 text-[8px] font-black text-[#00e6f4] shadow-[0_0_12px_rgba(0,230,244,.16)]">{spot.label}</div><span className="mt-1 block max-w-[94px] truncate rounded bg-[#06101c]/85 px-1.5 py-0.5 text-[8px] font-bold text-[#d7e1ef]">{playerName(spot.player, spot.label)}</span></div>)}
              <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-[#07101f]/85 px-3 py-2 backdrop-blur"><p className="text-[8px] uppercase tracking-wider text-[#718198]">Fielding</p><p className="mt-1 text-xs font-black text-white">{displayTeamName(fieldingTeam)}</p></div>
              <div className="absolute bottom-4 right-4 rounded-xl border border-white/10 bg-[#07101f]/85 px-3 py-2 text-right backdrop-blur"><p className="text-[8px] uppercase tracking-wider text-[#718198]">At bat</p><p className="mt-1 text-xs font-black text-white">{displayTeamName(battingTeam)}</p></div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
            <div className="flex items-center justify-between border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black tracking-[.14em] text-white">LIVE FEED</p><span className="text-[9px] font-bold text-[#65f2b5]">VERIFIED</span></div>
            <div className="divide-y divide-[#1e3047]">{recentPlays.length ? recentPlays.map((play: any, index: number) => <div key={play?.playId ?? play?.atBatIndex ?? index} className="grid grid-cols-[56px_1fr] gap-3 px-4 py-3"><span className="font-mono text-[9px] font-bold text-[#00e6f4]">{play?.about?.halfInning ? `${String(play.about.halfInning).slice(0, 3).toUpperCase()} ${play?.about?.inning ?? ''}` : 'GAME'}</span><p className="text-[11px] leading-5 text-[#c4d0df]">{play?.result?.description ?? play?.result?.event ?? 'Verified game event'}</p></div>) : <div className="px-4 py-6 text-center text-[11px] text-[#718198]">Verified play-by-play will appear here.</div>}</div>
          </section>
        </div>

        <div className="space-y-3">
          <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
            <div className="border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black tracking-[.14em] text-white">SCOREBOARD</p></div>
            <div className="space-y-3 p-4"><ScoreRow team={awayTeam} runs={awayRuns}/><ScoreRow team={homeTeam} runs={homeRuns}/><div className="flex items-center justify-between border-t border-[#26364e] pt-3 text-[10px] text-[#8fa0b7]"><span>{inningLabel}</span><span>{outs} OUT{outs === 1 ? '' : 'S'}</span></div></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
            <div className="border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black tracking-[.14em] text-white">LINE SCORE</p></div>
            <div className="overflow-x-auto p-3"><table className="w-full min-w-[260px] text-center text-[9px]"><thead className="text-[#607086]"><tr><th className="px-1 py-1 text-left">TEAM</th>{innings.slice(0, 9).map((item: any) => <th key={item?.num}>{item?.num}</th>)}<th className="text-[#d6dfed]">R</th><th>H</th><th>E</th></tr></thead><tbody className="font-mono font-bold text-[#d7e1ef]"><LineScoreRow team={awayTeam} innings={innings} side="away" runs={awayRuns} hits={awayHits} errors={awayErrors}/><LineScoreRow team={homeTeam} innings={innings} side="home" runs={homeRuns} hits={homeHits} errors={homeErrors}/></tbody></table></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
            <div className="flex items-center justify-between border-b border-[#26364e] px-4 py-3"><div><p className="text-[10px] font-black tracking-[.14em] text-white">TEAM AT BAT</p><p className="mt-1 text-[9px] text-[#718198]">{displayTeamName(battingTeam)}</p></div><img src={mlbTeamLogoUrl(battingTeam?.id)} alt="" className="h-7 w-7 object-contain"/></div>
            <div className="divide-y divide-[#1e3047]">{battingRows.length ? battingRows.map((row: any, index: number) => { const s = row?.stats?.batting ?? {}; const active = Number(row?.person?.id) === Number(batter?.id); return <div key={row?.person?.id ?? index} className={`grid grid-cols-[1fr_auto] gap-3 px-4 py-2.5 ${active ? 'bg-[#00e6f4]/7' : ''}`}><div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#d8e2ef]">{active && <span className="mr-1 text-[#00e6f4]">▶</span>}{playerName(row, 'Player')}</p><p className="mt-0.5 text-[9px] text-[#718198]">{stat(s?.hits, 0)} H · {stat(s?.runs, 0)} R · {stat(s?.rbi, 0)} RBI</p></div><span className="font-mono text-[10px] text-[#91a2b8]">{stat(s?.atBats, 0)} AB</span></div>; }) : <div className="px-4 py-6 text-center text-[10px] text-[#718198]">Batting summary will appear with boxscore data.</div>}</div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#00e6f4]/25 bg-[#0d1727]">
            <div className="flex items-center gap-2 border-b border-[#26364e] px-4 py-3"><span className="material-symbols-outlined text-[18px] text-[#00e6f4]">graphic_eq</span><p className="text-[10px] font-black tracking-[.14em] text-white">SCOUTCORE AI INSIGHT</p><span className="ml-auto rounded-full border border-[#65f2b5]/30 bg-[#65f2b5]/8 px-2 py-0.5 text-[8px] font-black text-[#65f2b5]">LIVE</span></div>
            <div className="p-4"><p className="text-[11px] leading-5 text-[#c8d3e1]">{insight}</p><p className="mt-3 text-[9px] leading-4 text-[#607086]">Based only on verified current game events and box-score data.</p></div>
          </section>
        </div>

        <aside className="flex min-h-[760px] flex-col overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] xl:max-h-[900px]">
          <div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3"><div><p className="text-sm font-black text-white">LIVE GAME CHAT</p><p className="mt-1 text-[10px] text-[#8fa0b7]">Tap a profile photo to follow a user.</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${backendReady ? 'border-[#65f2b5]/35 bg-[#65f2b5]/10 text-[#65f2b5]' : 'border-[#ffd166]/35 bg-[#ffd166]/10 text-[#ffd166]'}`}>{backendReady ? 'LIVE SYNC' : 'PREVIEW'}</span></div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length ? messages.map((message) => {
              const social = chatSocial[message.id];
              const shownName = social?.display_name || message.display_name;
              const target = { profileId: social?.profile_id || message.user_id, displayName: shownName, avatarUrl: social?.avatar_url || null };
              return <div key={message.id} className="flex items-start gap-2.5"><button type="button" onClick={() => setSelectedSocial(target)} className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#00e6f4]"><SocialAvatar displayName={shownName} avatarUrl={social?.avatar_url} size="sm"/></button><div className="min-w-0 flex-1 rounded-xl border border-[#26364e] bg-[#10192b] p-3"><div className="flex items-center justify-between gap-2"><button type="button" onClick={() => setSelectedSocial(target)} className="truncate text-left text-[11px] font-bold text-[#00e6f4] hover:underline">{shownName}</button><span className="shrink-0 text-[9px] text-[#607086]">{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-[#d7e0ee]">{message.body}</p></div></div>;
            }) : <div className="rounded-xl border border-dashed border-[#40516b] p-6 text-center"><span className="material-symbols-outlined text-3xl text-[#526275]">forum</span><p className="mt-2 text-sm font-semibold text-white">No messages yet</p><p className="mt-1 text-xs text-[#8fa0b7]">Be the first ScoutCore user to join the game chat.</p></div>}
            <div ref={chatEndRef}/>
          </div>
          <div className="border-t border-[#26364e] p-3">
            {notice && <div className="mb-2 rounded-lg border border-[#ffd166]/25 bg-[#ffd166]/7 px-3 py-2 text-[10px] leading-4 text-[#e7d9aa]">{notice}</div>}
            {!signedIn ? <button type="button" onClick={onOpenAuth} className="w-full rounded-xl bg-[#00e6f4] px-4 py-3 text-xs font-black text-[#062029]">LOG IN TO JOIN LIVE CHAT</button> : <><div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">{CHAT_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setMessageText((current) => `${current}${emoji}`.slice(0, 280))} className="h-8 min-w-8 rounded-lg border border-[#30415c] bg-[#10192b] text-base hover:border-[#00e6f4]/45">{emoji}</button>)}</div><div className="flex items-end gap-2"><textarea value={messageText} onChange={(event) => setMessageText(event.target.value.slice(0, 280))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={2} placeholder="Chat about the game…" className="min-h-[48px] flex-1 resize-none rounded-xl border border-[#30415c] bg-[#08111f] px-3 py-2 text-sm text-white outline-none placeholder:text-[#607086] focus:border-[#00e6f4]"/><button type="button" onClick={() => void sendMessage()} disabled={!messageText.trim()} className="h-12 rounded-xl bg-[#00e6f4] px-4 text-xs font-black text-[#062029] disabled:opacity-35">SEND</button></div></>}
            <div className="mt-3 flex flex-wrap gap-1.5">{REACTION_EMOJIS.map((emoji) => { const active = myReactions.includes(emoji); return <button key={emoji} type="button" onClick={() => void react(emoji)} disabled={reactionBusy === emoji} className={`flex min-w-[42px] items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs ${active ? 'border-[#00e6f4] bg-[#00e6f4]/12' : 'border-[#30415c] bg-[#10192b]'}`}><span>{emoji}</span><span className="text-[9px] text-[#9facbd]">{reactionCounts[emoji] ?? 0}</span></button>; })}</div>
          </div>
        </aside>
      </div>

      {postgameOpen && isFinal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020712]/82 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ScoutCore postgame result"><section className="relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[26px] border border-[#00e6f4]/45 bg-[#081423] shadow-[0_0_70px_rgba(0,230,244,.20)]"><button type="button" onClick={() => setPostgameOpen(false)} aria-label="Close postgame result" className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#30445e] bg-[#0d1c2e] text-[#9fb0c5]"><span className="material-symbols-outlined text-lg">close</span></button><div className="border-b border-[#26364e] px-5 py-5 text-center sm:px-8"><span className="inline-flex rounded-full border border-[#00e6f4]/35 bg-[#00e6f4]/10 px-3 py-1 text-[9px] font-black tracking-[.16em] text-[#00e6f4]">SCOUTCORE AI LIVE SIM</span><p className="mt-3 text-[10px] font-black tracking-[.22em] text-[#65f2b5]">SIMULATION COMPLETE</p><h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{winnerTeam ? `${displayTeamName(winnerTeam)} defeats ${displayTeamName(loserTeam)}` : `${displayTeamName(awayTeam)} vs ${displayTeamName(homeTeam)}`}</h2><div className="mx-auto mt-5 grid max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-4"><FinalTeam team={awayTeam} runs={awayRuns}/><span className="rounded-lg border border-[#33465f] bg-[#07101d] px-3 py-1.5 font-mono text-[10px] font-black tracking-wider text-[#8fa0b7]">FINAL</span><FinalTeam team={homeTeam} runs={homeRuns}/></div></div><div className="px-5 py-5 sm:px-8">{postgameTab === 'wrap' ? <><div className="overflow-x-auto rounded-xl border border-[#26364e] bg-[#07101d] p-3"><table className="w-full min-w-[430px] text-center text-[9px]"><thead className="text-[#607086]"><tr><th className="text-left">TEAM</th>{innings.slice(0, 9).map((item: any) => <th key={item?.num}>{item?.num}</th>)}<th>R</th><th>H</th><th>E</th></tr></thead><tbody className="font-mono font-bold text-[#d7e1ef]"><LineScoreRow team={awayTeam} innings={innings} side="away" runs={awayRuns} hits={awayHits} errors={awayErrors}/><LineScoreRow team={homeTeam} innings={innings} side="home" runs={homeRuns} hits={homeHits} errors={homeErrors}/></tbody></table></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{[{ label: 'Winning pitcher', person: decisions?.winner }, { label: 'Losing pitcher', person: decisions?.loser }, { label: 'Save', person: decisions?.save }].map((item) => <div key={item.label} className="flex items-center gap-3 rounded-xl border border-[#26364e] bg-[#0d1a2b] p-3">{item.person?.id ? <img src={mlbPlayerHeadshotUrl(item.person.id, 100)} alt="" className="h-11 w-11 rounded-lg bg-[#10192b] object-contain"/> : <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#30415c] bg-[#10192b] text-[#607086]">—</div>}<div className="min-w-0"><p className="text-[8px] uppercase tracking-wider text-[#718198]">{item.label}</p><p className="mt-1 truncate text-[11px] font-black text-white">{playerName(item.person)}</p></div></div>)}</div></> : <div className="grid gap-3 sm:grid-cols-3"><PostgameStat label="Result" value={winnerTeam ? `${displayTeamName(winnerTeam)} by ${runMargin}` : 'Tie'}/><PostgameStat label="Most scoring" value={highestScoringInning?.num ? `Inning ${highestScoringInning.num}` : '—'}/><PostgameStat label="Combined hits" value={String(awayHits + homeHits)}/><div className="sm:col-span-3 rounded-xl border border-[#00e6f4]/20 bg-[#00e6f4]/6 p-4 text-[11px] leading-5 text-[#c5d1e0]">This breakdown uses the verified final game feed and box score. It does not invent unrecorded events.</div></div>}<div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setPostgameTab('wrap')} className={`rounded-xl border px-4 py-3 text-[10px] font-black ${postgameTab === 'wrap' ? 'border-[#00e6f4] bg-[#00e6f4] text-[#05222a]' : 'border-[#30445e] bg-[#101b2c] text-[#d4dfed]'}`}>VIEW GAME WRAP</button><button type="button" onClick={() => setPostgameTab('breakdown')} className={`rounded-xl border px-4 py-3 text-[10px] font-black ${postgameTab === 'breakdown' ? 'border-[#65f2b5] bg-[#65f2b5] text-[#08231b]' : 'border-[#30445e] bg-[#101b2c] text-[#d4dfed]'}`}>POSTGAME BREAKDOWN</button></div></div></section></div>}

      <SocialProfileCard target={selectedSocial} signedIn={signedIn} onOpenAuth={onOpenAuth} onClose={() => setSelectedSocial(null)} />
    </main>
  );
};

const PlayerLiveCard: React.FC<{ title: string; player: any; imageId?: number | null; subtitle: string; stats: [string, any][] }> = ({ title, player, imageId, subtitle, stats }) => <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]"><div className="border-b border-[#26364e] px-4 py-3"><p className="text-[10px] font-black tracking-[.14em] text-[#00e6f4]">{title}</p></div><div className="p-4"><div className="flex items-center gap-3"><img src={mlbPlayerHeadshotUrl(imageId, 140)} alt="" className="h-16 w-16 rounded-xl border border-[#2b405b] bg-[#10192b] object-contain"/><div className="min-w-0"><p className="truncate text-base font-black text-white">{playerName(player, title === 'AT BAT' ? 'Batter' : 'Pitcher')}</p><p className="mt-1 text-[10px] text-[#8fa0b7]">{subtitle}</p></div></div><div className="mt-4 grid grid-cols-4 gap-1.5">{stats.map(([label, value]) => <div key={label} className="rounded-lg border border-[#26364e] bg-[#08111f] px-1.5 py-2 text-center"><p className="text-[8px] font-bold text-[#607086]">{label}</p><p className="mt-1 font-mono text-[11px] font-black text-white">{value}</p></div>)}</div></div></section>;

const ScoreRow: React.FC<{ team: any; runs: number }> = ({ team, runs }) => <div className="flex items-center gap-3"><img src={mlbTeamLogoUrl(team?.id)} alt="" className="h-9 w-9 object-contain"/><span className="min-w-0 flex-1 truncate text-sm font-black text-[#dbe5f2]">{displayTeamName(team)}</span><span className="font-mono text-2xl font-black text-white">{runs}</span></div>;

const LineScoreRow: React.FC<{ team: any; innings: any[]; side: 'away' | 'home'; runs: number; hits: number; errors: number }> = ({ team, innings, side, runs, hits, errors }) => <tr className="border-t border-[#26364e]"><td className="px-1 py-2 text-left font-sans font-black">{displayTeamName(team)}</td>{innings.slice(0, 9).map((item: any) => <td key={item?.num} className="px-1 py-2">{item?.[side]?.runs ?? '—'}</td>)}<td className="px-1 py-2 text-[#00e6f4]">{runs}</td><td>{hits}</td><td>{errors}</td></tr>;

const FinalTeam: React.FC<{ team: any; runs: number }> = ({ team, runs }) => <div className="flex flex-col items-center"><img src={mlbTeamLogoUrl(team?.id)} alt="" className="h-12 w-12 object-contain"/><span className="mt-1 text-sm font-black text-white">{displayTeamName(team)}</span><span className="mt-1 font-mono text-4xl font-black text-white">{runs}</span></div>;

const PostgameStat: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-[#26364e] bg-[#0d1a2b] p-4"><p className="text-[8px] font-bold uppercase tracking-wider text-[#718198]">{label}</p><p className="mt-2 text-lg font-black text-white">{value}</p></div>;
