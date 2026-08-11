import type { MlbScheduleGame } from './mlbApi';

const MLB_API = 'https://statsapi.mlb.com/api/v1';

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
}

export function easternDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function mapScheduleGame(game: any): MlbScheduleGame {
  const away = game.teams?.away ?? {};
  const home = game.teams?.home ?? {};
  const awayTeam = away.team ?? {};
  const homeTeam = home.team ?? {};
  return {
    gamePk: game.gamePk,
    gameDate: game.gameDate,
    status: game.status?.abstractGameState ?? 'Unknown',
    detailedState: game.status?.detailedState ?? 'Unknown',
    awayTeam: { id: awayTeam.id, name: awayTeam.name ?? 'Away Team', abbreviation: awayTeam.abbreviation },
    homeTeam: { id: homeTeam.id, name: homeTeam.name ?? 'Home Team', abbreviation: homeTeam.abbreviation },
    awayScore: away.score,
    homeScore: home.score,
    awayProbablePitcher: away.probablePitcher?.id ? { id: away.probablePitcher.id, name: away.probablePitcher.fullName ?? 'TBD' } : undefined,
    homeProbablePitcher: home.probablePitcher?.id ? { id: home.probablePitcher.id, name: home.probablePitcher.fullName ?? 'TBD' } : undefined,
  };
}

export async function fetchSchedule(date = easternDateKey()): Promise<MlbScheduleGame[]> {
  const data = await json(`${MLB_API}/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=team,linescore,probablePitcher`);
  return (data.dates ?? []).flatMap((day: any) => (day.games ?? []).map(mapScheduleGame));
}

export async function fetchTeams() {
  const data = await json(`${MLB_API}/teams?sportId=1`);
  return (data.teams ?? []).map((team: any) => ({ id: team.id, name: team.name, abbreviation: team.abbreviation })).sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function searchMlbPitchers(query: string) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/sports/1/players?season=${season}`);
  const needle = query.trim().toLowerCase();
  return (data.people ?? [])
    .filter((person: any) => person.primaryPosition?.abbreviation === 'P' && String(person.fullName ?? '').toLowerCase().includes(needle))
    .slice(0, 20)
    .map((person: any) => ({
      id: person.id,
      name: person.fullName,
      pitchHand: person.pitchHand?.code ?? null,
      currentTeam: person.currentTeam ? { id: person.currentTeam.id, name: person.currentTeam.name } : null,
    }));
}

async function playerInfo(id: number) {
  const data = await json(`${MLB_API}/people/${id}`);
  return data.people?.[0] ?? {};
}

async function playerStats(id: number, group: 'hitting' | 'pitching') {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${id}/stats?stats=season&season=${season}&group=${group}`);
  return data.stats?.[0]?.splits?.[0]?.stat ?? {};
}

export async function fetchPlayerRecentGameLogs(id: number, group: 'hitting' | 'pitching', limit = 8) {
  const season = new Date().getFullYear();
  const data = await json(`${MLB_API}/people/${id}/stats?stats=gameLog&season=${season}&group=${group}`);
  return (data.stats?.[0]?.splits ?? []).slice(-limit).reverse().map((split: any) => ({
    date: split.date ?? '',
    opponent: split.opponent?.name ?? '—',
    isHome: split.isHome ?? null,
    stat: split.stat ?? {},
  }));
}

export async function buildPitcherVsTeam(pitcherId: number, teamId: number) {
  const [pitcher, pitching, activeRoster, fortyMan, teams] = await Promise.all([
    playerInfo(pitcherId),
    playerStats(pitcherId, 'pitching'),
    json(`${MLB_API}/teams/${teamId}/roster?rosterType=active`),
    json(`${MLB_API}/teams/${teamId}/roster?rosterType=40Man`).catch(() => ({ roster: [] })),
    fetchTeams(),
  ]);

  const team = teams.find((item: any) => item.id === teamId) ?? { id: teamId, name: 'Selected Team' };
  const hitters = (activeRoster.roster ?? []).filter((entry: any) => entry.position?.abbreviation !== 'P' && entry.position?.type !== 'Pitcher').slice(0, 16);
  const batters = await Promise.all(hitters.map(async (entry: any) => {
    const id = entry.person?.id;
    if (!id) return null;
    const [person, hitting] = await Promise.all([playerInfo(id), playerStats(id, 'hitting').catch(() => ({}))]);
    return {
      id,
      name: person.fullName ?? entry.person?.fullName ?? 'Unknown player',
      position: entry.position?.abbreviation ?? person.primaryPosition?.abbreviation ?? '',
      batSide: person.batSide?.code ?? null,
      stats: {
        gamesPlayed: hitting.gamesPlayed ?? null,
        atBats: hitting.atBats ?? null,
        hits: hitting.hits ?? null,
        homeRuns: hitting.homeRuns ?? null,
        rbi: hitting.rbi ?? null,
        strikeOuts: hitting.strikeOuts ?? null,
        avg: hitting.avg ?? null,
        obp: hitting.obp ?? null,
        slg: hitting.slg ?? null,
        ops: hitting.ops ?? null,
      },
    };
  }));

  const activeIds = new Set((activeRoster.roster ?? []).map((entry: any) => entry.person?.id));
  const injuredList = (fortyMan.roster ?? [])
    .filter((entry: any) => entry.person?.id && !activeIds.has(entry.person.id))
    .filter((entry: any) => {
      const text = `${entry.status?.description ?? ''} ${entry.status?.code ?? ''}`.toLowerCase();
      return text.includes('injur') || /^d(7|10|15|60)/i.test(entry.status?.code ?? '');
    })
    .map((entry: any) => ({ id: entry.person.id, name: entry.person.fullName, position: entry.position?.abbreviation ?? '', status: entry.status?.description ?? entry.status?.code ?? 'Unavailable' }));

  return {
    pitcher: {
      id: pitcherId,
      name: pitcher.fullName ?? 'Unknown pitcher',
      pitchHand: pitcher.pitchHand?.code ?? null,
      stats: {
        gamesPlayed: pitching.gamesPlayed ?? null,
        gamesStarted: pitching.gamesStarted ?? null,
        inningsPitched: pitching.inningsPitched ?? null,
        era: pitching.era ?? null,
        whip: pitching.whip ?? null,
        strikeOuts: pitching.strikeOuts ?? null,
        strikeoutsPer9Inn: pitching.strikeoutsPer9Inn ?? null,
        walksPer9Inn: pitching.walksPer9Inn ?? null,
      },
    },
    team,
    batters: batters.filter(Boolean),
    injuredList,
  };
}
