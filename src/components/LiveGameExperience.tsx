import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { mlbTeamLogoUrl } from '../services/mlbMedia';

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

const REACTION_EMOJIS = ['🔥', '👏', '😱', '⚾', '😂', '💙'] as const;
const CHAT_EMOJIS = ['🔥', '👏', '😱', '⚾', '😂', '💙', '👀', '💪'] as const;

const localChatKey = (gamePk: number) => `scoutcore:live-chat-preview:${gamePk}`;

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

export const LiveGameExperience: React.FC<LiveGameExperienceProps> = ({ gamePk, feed, signedIn, userEmail, onOpenAuth }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(userEmail?.split('@')[0] || 'ScoutCore User');
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [reactionBusy, setReactionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastSentAt = useRef(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const gameData = feed?.gameData ?? {};
  const liveData = feed?.liveData ?? {};
  const linescore = liveData?.linescore ?? {};
  const plays = liveData?.plays ?? {};
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

  const battingTeam = linescore?.isTopInning ? awayTeam : homeTeam;

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
      setMyReactions((current) => current.includes(emoji) ? current.filter((item) => item !== emoji) : [...current, emoji]);
      setReactionCounts((current) => {
        const active = myReactions.includes(emoji);
        return { ...current, [emoji]: Math.max(0, (current[emoji] ?? 0) + (active ? -1 : 1)) };
      });
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
      const { error } = await supabase.from('game_chat_messages').insert({
        game_pk: gamePk,
        user_id: userId,
        display_name: displayName.slice(0, 48),
        body,
      });
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
    <main className="max-w-6xl mx-auto px-3 sm:px-5 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${abstractState === 'Live' ? 'bg-[#ff5d6c] animate-pulse' : 'bg-[#6e7d91]'}`} />
                <p className="text-xs font-extrabold tracking-[.12em] text-[#00e6f4]">LIVE SIMULATOR</p>
              </div>
              <p className="mt-1 text-[11px] text-[#8fa0b7]">A visualizer of verified MLB game events — it does not invent future plays.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#2b405b] bg-[#08111f] px-3 py-2">
              <div className="flex items-center gap-2"><img src={mlbTeamLogoUrl(awayTeam?.id)} alt="" className="h-7 w-7 object-contain"/><span className="font-mono font-bold">{awayRuns}</span></div>
              <span className="text-[#64748b]">—</span>
              <div className="flex items-center gap-2"><span className="font-mono font-bold">{homeRuns}</span><img src={mlbTeamLogoUrl(homeTeam?.id)} alt="" className="h-7 w-7 object-contain"/></div>
            </div>
          </div>

          <div className="scoutcore-sim-field relative min-h-[430px] overflow-hidden p-4 sm:min-h-[520px] sm:p-6">
            <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/10 bg-[#07101f]/85 px-3 py-2 backdrop-blur">
              <div className="font-mono text-xs font-bold text-[#00e6f4]">{inningLabel}</div>
              <div className="mt-1 text-[10px] text-[#aab7c9]">{balls}-{strikes} COUNT · {outs} OUT{Number(outs) === 1 ? '' : 'S'}</div>
            </div>

            <div className="absolute right-4 top-4 z-20 rounded-xl border border-white/10 bg-[#07101f]/85 px-3 py-2 text-right backdrop-blur">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#718090]">Batting</div>
              <div className="mt-1 text-xs font-bold text-white">{displayTeamName(battingTeam)}</div>
            </div>

            <div className="scoutcore-sim-diamond" aria-hidden="true" />
            <div className={`scoutcore-sim-base scoutcore-sim-base-second ${offense?.second ? 'is-active' : ''}`}><span>2B</span></div>
            <div className={`scoutcore-sim-base scoutcore-sim-base-first ${offense?.first ? 'is-active' : ''}`}><span>1B</span></div>
            <div className={`scoutcore-sim-base scoutcore-sim-base-third ${offense?.third ? 'is-active' : ''}`}><span>3B</span></div>
            <div className="scoutcore-sim-home"><span>HOME</span></div>
            <div className="scoutcore-sim-mound"><span>P</span></div>
            <div key={eventKey} className="scoutcore-sim-ball" aria-hidden="true">⚾</div>

            <div className="absolute bottom-[92px] left-1/2 z-20 w-[92%] max-w-2xl -translate-x-1/2 rounded-2xl border border-[#00e6f4]/20 bg-[#07101f]/90 p-4 text-center shadow-[0_18px_50px_rgba(0,0,0,.28)] backdrop-blur">
              <div className="text-[10px] font-bold uppercase tracking-[.14em] text-[#65f2b5]">Current matchup</div>
              <div className="mt-1 text-base font-extrabold text-white sm:text-xl">{pitcher?.fullName ?? pitcher?.name ?? 'Pitcher'} <span className="text-[#607086]">vs</span> {batter?.fullName ?? batter?.name ?? 'Batter'}</div>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-[#bdc9da]">{latestDescription}</p>
            </div>
          </div>

          <div className="border-t border-[#26364e] bg-[#0a1424] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8fa0b7]">React to this live moment</p><p className="mt-1 text-[10px] text-[#64748b]">Account users can react once per emoji and change it anytime.</p></div>
              <div className="flex flex-wrap gap-2">
                {REACTION_EMOJIS.map((emoji) => {
                  const active = myReactions.includes(emoji);
                  return <button key={emoji} type="button" onClick={() => void react(emoji)} disabled={reactionBusy === emoji} className={`flex min-w-[48px] items-center justify-center gap-1 rounded-full border px-2.5 py-1.5 text-sm transition ${active ? 'border-[#00e6f4] bg-[#00e6f4]/12' : 'border-[#30415c] bg-[#10192b] hover:border-[#00e6f4]/45'}`}><span>{emoji}</span><span className="text-[10px] font-bold text-[#aebbd0]">{reactionCounts[emoji] ?? 0}</span></button>;
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[#2b405b] bg-[#0d1727] xl:max-h-[720px]">
          <div className="flex items-center justify-between gap-3 border-b border-[#26364e] px-4 py-3">
            <div><p className="text-sm font-extrabold text-white">LIVE GAME CHAT</p><p className="mt-1 text-[10px] text-[#8fa0b7]">Talk about this game while the simulator updates.</p></div>
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
