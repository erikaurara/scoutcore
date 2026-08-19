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
  // Keep the gameLog request itself simple and supported for every MLB player.
  // Extra game context is derived from the live feed only when a filter needs it.
  const data = await json(`${MLB_API}/people/${player.id}/stats?stats=gameLog&season=${season}&group=${player.group}`);
  return (data?.stats?.[0]?.splits ?? []).map((split: any) => ({
    date: split?.date ?? '', season,
    opponent: split?.opponent?.name ?? '—',
    opponentId: split?.opponent?.id ? Number(split.opponent.id) : null,
    gamePk: split?.game?.gamePk ? Number(split.game.gamePk) : null,
    isHome: typeof split?.isHome === 'boolean' ? split.isHome : null,
    stat: split?.stat ?? {},
  }));
}

export async function fetchPredictionLogs(player: PredictionPlayer, mode: PredictionSeasonMode = 'CURRENT'): Promise<PredictionLog[]> {
  const current = new Date().getFullYear();
  const seasons = mode === '2025' ? [2025] : mode === 'COMBINED' ? [current, 2025] : [current];
  const chunks = await Promise.all(seasons.map(season => seasonLogs(player, season).catch(() => [])));
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

function playerSide(feed: any, player: PredictionPlayer): 'away'|'home'|null {
  const teams=feed?.liveData?.boxscore?.teams ?? {};
  if(teams?.away?.players?.[`ID${player.id}`]) return 'away';
  if(teams?.home?.players?.[`ID${player.id}`]) return 'home';
  const teamId=Number(player.currentTeam?.id);
  if(teamId&&Number(feed?.gameData?.teams?.away?.id)===teamId)return 'away';
  if(teamId&&Number(feed?.gameData?.teams?.home?.id)===teamId)return 'home';
  return null;
}

function opponentStarter(feed: any, player: PredictionPlayer) {
  const side=playerSide(feed,player);
  const opponentSide=side==='away'?'home':side==='home'?'away':null;
  if(!opponentSide)return {id:null,name:null,hand:null};
  const box=feed?.liveData?.boxscore?.teams?.[opponentSide];
  const starterId=Number(box?.pitchers?.[0])||null;
  const person=starterId?feed?.gameData?.players?.[`ID${starterId}`]:null;
  return {id:starterId,name:person?.fullName??null,hand:person?.pitchHand?.code??null};
}

export async function addPredictionContext(log: PredictionLog, player: PredictionPlayer, withPlayer?: PredictionPlayer | null, withoutPlayer?: PredictionPlayer | null) {
  if (!log.gamePk) return { ...log };
  const feed = await fetchFeed(log.gamePk);
  if (!feed) return { ...log };
  const starter = opponentStarter(feed, player);
  const side=playerSide(feed,player);
  return {
    ...log,
    isHome: side ? side==='home' : log.isHome,
    opponentStarterId: starter.id,
    opponentStarterName: starter.name,
    opponentStarterHand: starter.hand,
    withPlayerActive: withPlayer ? activeInGame(feed, withPlayer.id) : undefined,
    withoutPlayerActive: withoutPlayer ? activeInGame(feed, withoutPlayer.id) : undefined,
  };
}

export function clearPredictionFeedCache() { feedCache.clear(); }
