import { getGame, getPlayerGameLog, getPlayerSplits, getPlayerStats, getSchedule } from './mlbApi';

type Side = 'away' | 'home';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const num = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };

function getSeasonStats(player: any) {
  return player?.seasonStats ?? player?.stats?.[0]?.splits?.[0]?.stat ?? {};
}

function getPlayerName(player: any) {
  return player?.person?.fullName ?? player?.fullName ?? 'Unknown player';
}

function normalizePlayer(player: any) {
  const stat = getSeasonStats(player);
  const isPitcher = player?.position?.abbreviation === 'P'
    || stat?.era !== undefined
    || (stat?.strikeOuts !== undefined && stat?.inningsPitched !== undefined);
  return {
    id: player?.person?.id ?? player?.id,
    name: getPlayerName(player),
    position: player?.position?.abbreviation ?? '',
    batSide: player?.batSide?.code ?? player?.person?.batSide?.code ?? null,
    pitchHand: player?.pitchHand?.code ?? player?.person?.pitchHand?.code ?? null,
    isPitcher,
    stats: stat,
  };
}

function handednessContext(batter: any, pitcher: any) {
  const bat = batter?.batSide;
  const pitch = pitcher?.pitchHand;
  if (!bat || !pitch) return { label: 'Handedness unavailable', edge: null, score: null, splitCode: null };
  if (bat === 'S') return { label: 'Switch hitter', edge: 'Uses the side that matches the pitcher hand', score: null, splitCode: pitch === 'L' ? 'vl' : 'vr' };
  const opposite = bat !== pitch;
  return {
    label: opposite ? 'Opposite-handed matchup' : 'Same-handed matchup',
    edge: opposite ? 'Platoon context favors the hitter' : 'Platoon context favors the pitcher',
    score: opposite ? 1 : -1,
    splitCode: pitch === 'L' ? 'vl' : 'vr',
  };
}

function pitchUsage(feed: any) {
  const counts: Record<string, number> = {};
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    for (const event of play?.playEvents ?? []) {
      const type = event?.details?.type?.code;
      if (event?.isPitch && type) counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([type, count]) => ({ type, count, usage: total ? Math.round((count / total) * 1000) / 10 : 0 }));
}

function inningsToOuts(value: unknown) {
  const text = String(value ?? '0');
  const [whole, fraction] = text.split('.');
  const base = Number(whole) || 0;
  if (fraction === '1') return base * 3 + 1;
  if (fraction === '2') return base * 3 + 2;
  return base * 3;
}

function outsToInnings(outs: number) {
  return Math.round((outs / 3) * 100) / 100;
}

function getSplits(data: any) {
  return (data?.stats ?? []).flatMap((group: any) => group?.splits ?? []);
}

function findSplit(data: any, code: string | null) {
  if (!code) return null;
  return getSplits(data).find((split: any) => {
    const current = String(split?.split?.code ?? '').toLowerCase();
    return current === code || current.includes(code);
  })?.stat ?? null;
}

function hitterRecentForm(data: any) {
  const splits = getSplits(data).filter((split: any) => split?.date).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
  let ab = 0; let hits = 0; let walks = 0; let hbp = 0; let sf = 0; let totalBases = 0; let strikeouts = 0;
  for (const split of splits) {
    const stat = split.stat ?? {};
    ab += num(stat.atBats); hits += num(stat.hits); walks += num(stat.baseOnBalls); hbp += num(stat.hitByPitch);
    sf += num(stat.sacFlies); totalBases += num(stat.totalBases); strikeouts += num(stat.strikeOuts);
  }
  if (!splits.length || (!ab && !hits && !walks)) return null;
  const avg = ab ? hits / ab : 0;
  const obpDen = ab + walks + hbp + sf;
  const obp = obpDen ? (hits + walks + hbp) / obpDen : 0;
  const slg = ab ? totalBases / ab : 0;
  return { games: splits.length, avg, obp, slg, ops: obp + slg, strikeoutRate: (ab + walks) ? strikeouts / (ab + walks) : null };
}

function pitcherRecentForm(data: any) {
  const splits = getSplits(data).filter((split: any) => split?.date).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
  let outs = 0; let earnedRuns = 0; let strikeouts = 0; let walks = 0; let hits = 0;
  for (const split of splits) {
    const stat = split.stat ?? {};
    outs += inningsToOuts(stat.inningsPitched); earnedRuns += num(stat.earnedRuns); strikeouts += num(stat.strikeOuts);
    walks += num(stat.baseOnBalls); hits += num(stat.hits);
  }
  if (!splits.length || !outs) return null;
  const innings = outsToInnings(outs);
  return {
    games: splits.length,
    innings,
    era: earnedRuns * 9 / (outs / 3),
    k9: strikeouts * 9 / (outs / 3),
    bb9: walks * 9 / (outs / 3),
    whip: (walks + hits) / (outs / 3),
  };
}

function bullpenContext(players: any[], starterId: number | undefined) {
  const relievers = players.filter((player: any) => player.isPitcher && player.id !== starterId);
  let outs = 0; let earnedRuns = 0; let hits = 0; let walks = 0; let pitchersWithData = 0;
  for (const reliever of relievers) {
    const stat = reliever.stats ?? {};
    const pitcherOuts = inningsToOuts(stat.inningsPitched);
    if (!pitcherOuts) continue;
    pitchersWithData += 1; outs += pitcherOuts; earnedRuns += num(stat.earnedRuns); hits += num(stat.hits); walks += num(stat.baseOnBalls);
  }
  if (pitchersWithData < 2 || !outs) return { available: false, label: 'Bullpen season data unavailable' };
  return {
    available: true,
    label: 'Bullpen season context',
    era: Math.round((earnedRuns * 9 / (outs / 3)) * 100) / 100,
    whip: Math.round(((hits + walks) / (outs / 3)) * 100) / 100,
    pitchers: pitchersWithData,
  };
}

async function safe<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try { return await loader(); } catch { return fallback; }
}

function scoreMatchup(batter: any, pitcher: any, feed: any, historical: any) {
  const bs = batter.stats ?? {};
  const ps = pitcher.stats ?? {};
  const ops = num(bs.ops); const avg = num(bs.avg); const slg = num(bs.slg); const obp = num(bs.obp);
  const strikeouts = num(bs.strikeOuts); const atBats = num(bs.atBats);
  const k9 = num(ps.strikeoutsPer9Inn); const era = num(ps.era); const whip = num(ps.whip); const walksPer9 = num(ps.walksPer9Inn);
  const pitcherStrikeouts = num(ps.strikeOuts); const innings = num(ps.inningsPitched);
  const hand = handednessContext(batter, pitcher);
  const split = findSplit(historical?.batterSplits, hand.splitCode);
  const recentHitter = hitterRecentForm(historical?.batterGameLog);
  const recentPitcher = pitcherRecentForm(historical?.pitcherGameLog);
  const bullpen = historical?.bullpen ?? { available: false, label: 'Bullpen season data unavailable' };

  const offense = clamp((ops ? ops * 100 : 50) * .40 + (obp ? obp * 100 : 25) * .20 + (slg ? slg * 100 : 45) * .25 + (avg ? avg * 100 : 25) * .15);
  const contact = atBats ? clamp(100 - (strikeouts / atBats) * 100) : null;
  const pitcherRunPrevention = clamp(100 - (era ? era * 12 : 40) - (whip ? whip * 12 : 20) + (k9 ? k9 * 1.5 : 0));
  const pitcherCommand = clamp(100 - (walksPer9 ? walksPer9 * 8 : 25));
  const strikeoutPressure = k9 ? clamp(k9 * 8) : null;
  const splitOps = split?.ops !== undefined ? num(split.ops) : null;
  const recentHitterScore = recentHitter ? clamp(recentHitter.ops * 100) : null;
  const recentPitcherScore = recentPitcher ? clamp(100 - recentPitcher.era * 10) : null;
  const bullpenScore = bullpen.available ? clamp(100 - bullpen.era * 10) : null;

  const components = [
    { name: 'Hitter production', value: offense, weight: .30 },
    { name: 'Hitter contact', value: contact, weight: .10 },
    { name: 'Handedness split', value: splitOps === null ? null : clamp(splitOps * 100), weight: .15 },
    { name: 'Recent hitter form', value: recentHitterScore, weight: .10 },
    { name: 'Pitcher run prevention', value: 100 - pitcherRunPrevention, weight: .15 },
    { name: 'Pitcher command', value: 100 - pitcherCommand, weight: .08 },
    { name: 'Strikeout pressure', value: strikeoutPressure === null ? null : 100 - strikeoutPressure, weight: .07 },
    { name: 'Recent pitcher form', value: recentPitcherScore, weight: .03 },
    { name: 'Bullpen context', value: bullpenScore, weight: .02 },
  ].filter(component => component.value !== null);

  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  const score = weightTotal ? components.reduce((sum, component) => sum + (component.value as number) * component.weight, 0) / weightTotal : 50;
  const available = [ops, obp, slg, avg, k9, era, whip, walksPer9, pitcherStrikeouts, innings, splitOps, recentHitterScore, recentPitcherScore, bullpenScore].filter(value => value !== 0 && value !== null).length;
  const confidence = clamp(34 + available * 4 + (hand.score === null ? 0 : 4) + (splitOps === null ? 0 : 5) + (recentHitter ? 5 : 0) + (recentPitcher ? 5 : 0), 30, 96);
  const livePitches = pitchUsage(feed);

  return {
    score: Math.round(clamp(score) * 10) / 10,
    confidence: Math.round(confidence),
    dataQuality: confidence >= 82 ? 'High' : confidence >= 62 ? 'Medium' : 'Limited',
    handedness: hand,
    historical: {
      handednessSplit: split ? { code: hand.splitCode, avg: split.avg, obp: split.obp, slg: split.slg, ops: split.ops, atBats: split.atBats } : null,
      recentHitterForm: recentHitter,
      recentPitcherForm: recentPitcher,
      bullpen,
      headToHead: { available: false, note: 'Direct batter-vs-pitcher history is not exposed by the MLB Stats API endpoint used by ScoutCore, so no head-to-head numbers are fabricated.' },
    },
    components: components.map(component => ({ ...component, value: Math.round((component.value as number) * 10) / 10 })),
    stats: {
      hitter: { ops, obp, slg, avg, contactRate: contact === null ? null : Math.round(contact * 10) / 10 },
      pitcher: { era, whip, k9, walksPer9, strikeouts: pitcherStrikeouts, inningsPitched: innings },
    },
    pitchUsage: livePitches,
    pitchUsageScope: livePitches.length ? 'Current game feed' : 'Unavailable before pitches are recorded',
    note: 'Model score is an explainable analytics index, not a guaranteed outcome probability. Historical components are included only when verified MLB data is available.',
  };
}

async function buildHistoricalContext(batter: any, pitcher: any, opponentPlayers: any[]) {
  const season = new Date().getFullYear();
  const hand = handednessContext(batter, pitcher);
  const [batterSplits, batterGameLog, pitcherGameLog] = await Promise.all([
    safe(() => getPlayerSplits(batter.id, season), null),
    safe(() => getPlayerGameLog(batter.id, season), null),
    pitcher?.id ? safe(() => getPlayerGameLog(pitcher.id, season), null) : Promise.resolve(null),
  ]);
  return { batterSplits, batterGameLog, pitcherGameLog, hand, bullpen: bullpenContext(opponentPlayers, pitcher?.id) };
}

export async function getGameAnalytics(gamePk: number) {
  const feed = await getGame(gamePk);
  const boxTeams = feed?.liveData?.boxscore?.teams ?? {};
  const game = feed?.gameData ?? {};
  const sides: Side[] = ['away', 'home'];

  const sideData: Record<Side, any> = {} as Record<Side, any>;
  for (const side of sides) {
    const boxTeam = boxTeams[side] ?? {};
    const players = Object.values(boxTeam?.players ?? {}).map(normalizePlayer);
    sideData[side] = {
      side,
      team: boxTeam?.team?.name ?? game?.teams?.[side]?.name ?? 'Unknown Team',
      teamId: boxTeam?.team?.id ?? game?.teams?.[side]?.id,
      players,
      hitters: players.filter((player: any) => !player.isPitcher).slice(0, 9),
      pitchers: players.filter((player: any) => player.isPitcher),
    };
  }

  const result = await Promise.all(sides.map(async (side) => {
    const batting = sideData[side];
    const opponentSide: Side = side === 'away' ? 'home' : 'away';
    const opponent = sideData[opponentSide];
    const probable = opponentSide === 'away' ? game?.probablePitchers?.away : game?.probablePitchers?.home;

    let pitcher = opponent.pitchers.find((player: any) => player.id === probable?.id) ?? opponent.pitchers[0];
    if (!pitcher && probable?.id) {
      const stats = await getPlayerStats(probable.id);
      pitcher = {
        id: probable.id,
        name: probable.fullName,
        position: 'P',
        batSide: null,
        pitchHand: probable.pitchHand?.code ?? null,
        isPitcher: true,
        stats: getSeasonStats(stats),
      };
    }

    const enrichedHitters = await Promise.all(batting.hitters.map(async (hitter: any, index: number) => {
      const historical = index < 5 && pitcher
        ? await buildHistoricalContext(hitter, pitcher, opponent.players)
        : { batterSplits: null, batterGameLog: null, pitcherGameLog: null, bullpen: bullpenContext(opponent.players, pitcher?.id) };
      return { hitter, historical };
    }));

    const matchups = enrichedHitters.map(({ hitter, historical }: any) => ({
      batter: hitter,
      pitcher,
      analysis: pitcher ? scoreMatchup(hitter, pitcher, feed, historical) : null,
    }));

    return {
      side,
      team: batting.team,
      teamId: batting.teamId,
      opponentTeam: opponent.team,
      opponentTeamId: opponent.teamId,
      hitters: batting.hitters,
      pitcher,
      bullpen: bullpenContext(opponent.players, pitcher?.id),
      matchups,
    };
  }));

  const all = result.flatMap((team: any) => team.matchups).filter((matchup: any) => matchup.analysis);
  const averageScore = all.length ? all.reduce((sum: number, matchup: any) => sum + matchup.analysis.score, 0) / all.length : null;
  const venue = game?.venue?.name ?? 'Venue unavailable';

  return {
    gamePk,
    gameDate: game?.datetime?.dateTime,
    status: feed?.gameData?.status?.detailedState,
    context: {
      venue,
      homeTeam: game?.teams?.home?.name,
      awayTeam: game?.teams?.away?.name,
      homeField: 'Home-field context is displayed but not converted into a fabricated numeric park factor.',
    },
    teams: result,
    summary: {
      matchupCount: all.length,
      averageMatchupScore: averageScore === null ? null : Math.round(averageScore * 10) / 10,
      dataQuality: all.length ? Math.round(all.reduce((sum: number, matchup: any) => sum + matchup.analysis.confidence, 0) / all.length) : 0,
      historicalCoverage: all.length ? `${all.filter((matchup: any) => matchup.analysis.historical?.recentHitterForm || matchup.analysis.historical?.handednessSplit).length}/${all.length} matchups have historical enrichment` : '0/0',
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsForDate(date?: string) {
  let target: Date | undefined;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD');
    target = new Date(`${date}T12:00:00-04:00`);
  }
  const games = await getSchedule(target);
  const analyses = await Promise.all(games.slice(0, 15).map(game => getGameAnalytics(game.gamePk).catch(() => null)));
  return analyses.filter(Boolean);
}

export async function getTodayAnalytics() {
  return getAnalyticsForDate();
}
