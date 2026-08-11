import { getGame, getPlayerStats, getSchedule } from './mlbApi';

type Side = 'away' | 'home';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function getSeasonStats(player: any) {
  return player?.seasonStats ?? player?.stats?.[0]?.splits?.[0]?.stat ?? {};
}

function getPlayerName(player: any) {
  return player?.person?.fullName ?? player?.fullName ?? 'Unknown player';
}

function normalizePlayer(player: any) {
  const stat = getSeasonStats(player);
  const isPitcher = player?.position?.abbreviation === 'P' || stat?.era !== undefined || (stat?.strikeOuts !== undefined && stat?.inningsPitched !== undefined);
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
  if (!bat || !pitch) return { label: 'Handedness unavailable', edge: null, score: null };
  if (bat === 'S') return { label: 'Switch hitter', edge: 'Depends on pitcher hand', score: null };
  const opposite = bat !== pitch;
  return {
    label: opposite ? 'Opposite-handed matchup' : 'Same-handed matchup',
    edge: opposite ? 'Platoon context favors the hitter' : 'Platoon context favors the pitcher',
    score: opposite ? 1 : -1,
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

function scoreMatchup(batter: any, pitcher: any, feed: any) {
  const bs = batter.stats ?? {};
  const ps = pitcher.stats ?? {};
  const ops = num(bs.ops);
  const avg = num(bs.avg);
  const slg = num(bs.slg);
  const obp = num(bs.obp);
  const strikeouts = num(bs.strikeOuts);
  const atBats = num(bs.atBats);
  const k9 = num(ps.strikeoutsPer9Inn);
  const era = num(ps.era);
  const whip = num(ps.whip);
  const walksPer9 = num(ps.walksPer9Inn);
  const pitcherStrikeouts = num(ps.strikeOuts);
  const innings = num(ps.inningsPitched);

  const offense = clamp(
    (ops ? ops * 100 : 50) * 0.40 +
    (obp ? obp * 100 : 25) * 0.20 +
    (slg ? slg * 100 : 45) * 0.25 +
    (avg ? avg * 100 : 25) * 0.15,
  );

  const contact = atBats ? clamp(100 - (strikeouts / atBats) * 100) : null;
  const pitcherRunPrevention = clamp(100 - (era ? era * 12 : 40) - (whip ? whip * 12 : 20) + (k9 ? k9 * 1.5 : 0));
  const pitcherCommand = clamp(100 - (walksPer9 ? walksPer9 * 8 : 25));
  const strikeoutPressure = k9 ? clamp(k9 * 8) : null;
  const hand = handednessContext(batter, pitcher);

  const components = [
    { name: 'Hitter production', value: offense, weight: 0.40 },
    { name: 'Hitter contact', value: contact, weight: 0.15 },
    { name: 'Pitcher run prevention', value: 100 - pitcherRunPrevention, weight: 0.20 },
    { name: 'Pitcher command', value: 100 - pitcherCommand, weight: 0.10 },
    { name: 'Strikeout pressure', value: strikeoutPressure === null ? null : 100 - strikeoutPressure, weight: 0.15 },
  ].filter((component) => component.value !== null);

  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  const score = weightTotal
    ? components.reduce((sum, component) => sum + (component.value as number) * component.weight, 0) / weightTotal
    : 50;

  const available = [ops, obp, slg, avg, k9, era, whip, walksPer9, pitcherStrikeouts, innings].filter(Boolean).length;
  const confidence = clamp(30 + available * 6 + (hand.score === null ? 0 : 4), 30, 94);
  const livePitches = pitchUsage(feed);

  return {
    score: Math.round(clamp(score) * 10) / 10,
    confidence: Math.round(confidence),
    dataQuality: confidence >= 80 ? 'High' : confidence >= 60 ? 'Medium' : 'Limited',
    handedness: hand,
    components: components.map((component) => ({ ...component, value: Math.round((component.value as number) * 10) / 10 })),
    stats: {
      hitter: { ops, obp, slg, avg, contactRate: contact === null ? null : Math.round(contact * 10) / 10 },
      pitcher: { era, whip, k9, walksPer9, strikeouts: pitcherStrikeouts, inningsPitched: innings },
    },
    pitchUsage: livePitches,
    pitchUsageScope: livePitches.length ? 'Current game feed' : 'Unavailable before pitches are recorded',
    note: 'Model score is an explainable analytics index, not a guaranteed outcome probability.',
  };
}

export async function getGameAnalytics(gamePk: number) {
  const feed = await getGame(gamePk);
  const teams = feed?.liveData?.boxscore?.teams ?? {};
  const game = feed?.gameData ?? {};

  const result = await Promise.all((['away', 'home'] as Side[]).map(async (side) => {
    const team = teams[side];
    const players = Object.values(team?.players ?? {}).map(normalizePlayer);
    const hitters = players.filter((player: any) => !player.isPitcher).slice(0, 9);
    const pitchers = players.filter((player: any) => player.isPitcher);
    const probable = side === 'away' ? game?.probablePitchers?.away : game?.probablePitchers?.home;
    let pitcher = pitchers.find((p: any) => p.id === probable?.id) ?? pitchers[0];

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

    const matchups = hitters.map((hitter: any) => ({
      batter: hitter,
      pitcher,
      analysis: pitcher ? scoreMatchup(hitter, pitcher, feed) : null,
    }));

    return { side, team: team?.team?.name ?? game?.teams?.[side]?.name ?? 'Unknown Team', teamId: team?.team?.id, pitcher, hitters, matchups };
  }));

  const all = result.flatMap((team: any) => team.matchups).filter((m: any) => m.analysis);
  const averageScore = all.length ? all.reduce((sum: number, m: any) => sum + m.analysis.score, 0) / all.length : null;

  return {
    gamePk,
    gameDate: game?.datetime?.dateTime,
    status: feed?.gameData?.status?.detailedState,
    teams: result,
    summary: {
      matchupCount: all.length,
      averageMatchupScore: averageScore === null ? null : Math.round(averageScore * 10) / 10,
      dataQuality: all.length ? Math.round(all.reduce((sum: number, m: any) => sum + m.analysis.confidence, 0) / all.length) : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getTodayAnalytics() {
  const games = await getSchedule();
  const analyses = await Promise.all(games.slice(0, 8).map((game) => getGameAnalytics(game.gamePk).catch(() => null)));
  return analyses.filter(Boolean);
}
