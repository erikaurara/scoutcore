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
  const isPitcher = player?.position?.abbreviation === 'P' || stat?.era !== undefined || stat?.strikeOuts !== undefined && stat?.inningsPitched !== undefined;
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

function scoreMatchup(batter: any, pitcher: any) {
  const bs = batter.stats ?? {};
  const ps = pitcher.stats ?? {};
  const ops = num(bs.ops);
  const avg = num(bs.avg);
  const slg = num(bs.slg);
  const k9 = num(ps.strikeoutsPer9Inn);
  const era = num(ps.era);
  const whip = num(ps.whip);

  // This is intentionally transparent and conservative: no score is produced
  // from missing data, and the components are visible to the UI.
  const offense = clamp((ops ? ops * 100 : 50) * 0.55 + (avg ? avg * 100 : 25) * 0.25 + (slg ? slg * 100 : 45) * 0.2);
  const pitcherControl = clamp(100 - (era ? era * 12 : 40) - (whip ? whip * 12 : 20) + (k9 ? k9 * 1.5 : 0));
  const score = clamp(offense * 0.65 + (100 - pitcherControl) * 0.35);
  const dataPoints = [ops, avg, slg, k9, era, whip].filter(Boolean).length;
  const confidence = clamp(35 + dataPoints * 10, 35, 95);

  return {
    score: Math.round(score * 10) / 10,
    offenseIndex: Math.round(offense * 10) / 10,
    pitcherIndex: Math.round(pitcherControl * 10) / 10,
    confidence: Math.round(confidence),
    components: { ops, avg, slg, era, whip, k9 },
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
        isPitcher: true,
        stats: getSeasonStats(stats),
      };
    }

    const matchups = hitters.map((hitter: any) => ({
      batter: hitter,
      pitcher,
      analysis: pitcher ? scoreMatchup(hitter, pitcher) : null,
    }));

    return {
      side,
      team: team?.team?.name ?? game?.teams?.[side]?.name ?? 'Unknown Team',
      teamId: team?.team?.id,
      pitcher,
      hitters,
      matchups,
    };
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
