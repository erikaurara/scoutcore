import type { PredictionLog, PredictionPlayer, PredictionSeasonMode } from './predictionModel';
import { inningsToOuts, num } from './predictionModel';

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const feedCache = new Map<number, Promise<any>>();

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
}

async function seasonLogs(player: PredictionPlayer, season: number): Promise<PredictionLog[]> {
  // hydrate=team is important here: MLB's gameLog splits do not reliably expose
  // home/away on the split itself.  The hydrated game teams let us derive it.
  const data = await json(`${MLB_API}/people/${player.id}/stats?stats=gameLog&season=${season}&group=${player.group}&hydrate=team`);
  return (data?.stats?.[0]?.splits ?? []).map((split: any) => {
    const gameTeams = split?.game?.teams;
    const playerTeamId = Number(split?.team?.id ?? player.currentTeam?.id ?? 0) || null;
    const homeId = Number(gameTeams?.home?.team?.id ?? gameTeams?.home?.id ?? 0) || null;
    const awayId = Number(gameTeams?.away?.team?.id ?? gameTeams?.away?.id ?? 0) || null;
    let isHome: boolean | null = typeof split?.isHome === 'boolean' ? split.isHome : null;
    if (isHome == null && playerTeamId && homeId) isHome = playerTeamId === homeId;
    else if (isHome == null && playerTeamId && awayId) isHome = playerTeamId !== awayId;
    return {
      date: split?.date ?? '', season,
      opponent: split?.opponent?.name ?? '—',
      opponentId: split?.opponent?.id ? Number(split.opponent.id) : null,
      gamePk: split?.game?.gamePk ? Number(split.game.gamePk) : null,
      isHome,
      stat: split?.stat ?? {},
    };
  });
}

export async function fetchPredictionLogs(player: PredictionPlayer, mode: PredictionSeasonMode = 'CURRENT'): Promise<PredictionLog[]> {
  const current = new Date().getFullYear();
  const seasons = mode === '2025' ? [2025] : mode === 'COMBINED' ? [current, 2025] : [current];
  const chunks = await Promise.all(seasons.map(season => seasonLogs(player, season).catch(() => [])));
  // Keep one row per MLB game. This prevents duplicate split rows from consuming
  // an L5/L10/L20/L30 slot and guarantees newest-first window semantics.
  const unique = new Map<string, PredictionLog>();
  for (const log of chunks.flat()) {
    const key = log.gamePk ? `${log.season}:${log.gamePk}` : `${log.season}:${log.date}:${log.opponentId ?? log.opponent}`;
    if (!unique.has(key)) unique.set(key, log);
  }
  return [...unique.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async function fetchFeed(gamePk: number) {
  if (!feedCache.has(gamePk)) feedCache.set(gamePk, json(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`).catch(() => null));
  return feedCache.get(gamePk)!;
}

function activeInGame(feed: any, playerId: number) {
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  const row = teams?.away?.players?.[`ID${playerId}`] ?? teams?.home?.players?.[`ID${playerId}`];
  return Boolean(row && (num(row?.stats?.batting?.plateAppearances) > 0 || inningsToOuts(row?.stats?.pitching?.inningsPitched) > 0));
}

function opponentStarter(feed: any, player: PredictionPlayer) {
  const away = feed?.gameData?.teams?.away;
  const home = feed?.gameData?.teams?.home;
  const teamId = player.currentTeam?.id;
  let side: 'away' | 'home' = 'away';
  if (teamId && Number(away?.id) === teamId) side = 'home';
  else if (teamId && Number(home?.id) === teamId) side = 'away';
  else side = feed?.liveData?.boxscore?.teams?.away?.players?.[`ID${player.id}`] ? 'home' : 'away';
  const box = feed?.liveData?.boxscore?.teams?.[side];
  const starterId = Number(box?.pitchers?.[0]) || null;
  const person = starterId ? feed?.gameData?.players?.[`ID${starterId}`] : null;
  return { id: starterId, name: person?.fullName ?? null, hand: person?.pitchHand?.code ?? null };
}

export async function addPredictionContext(log: PredictionLog, player: PredictionPlayer, withPlayer?: PredictionPlayer | null, withoutPlayer?: PredictionPlayer | null) {
  if (!log.gamePk) return { ...log };
  const feed = await fetchFeed(log.gamePk);
  if (!feed) return { ...log };
  const starter = opponentStarter(feed, player);
  return {
    ...log,
    opponentStarterId: starter.id,
    opponentStarterName: starter.name,
    opponentStarterHand: starter.hand,
    withPlayerActive: withPlayer ? activeInGame(feed, withPlayer.id) : undefined,
    withoutPlayerActive: withoutPlayer ? activeInGame(feed, withoutPlayer.id) : undefined,
  };
}

export function clearPredictionFeedCache() { feedCache.clear(); }
