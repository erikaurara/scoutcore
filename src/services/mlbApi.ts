export type MlbScheduleGame = {
  gamePk: number;
  gameDate: string;
  status: string;
  detailedState: string;
  currentInning?: number;
  currentInningOrdinal?: string;
  inningState?: string;
  awayTeam: { id: number; name: string; abbreviation?: string };
  homeTeam: { id: number; name: string; abbreviation?: string };
  awayScore?: number;
  homeScore?: number;
  awayProbablePitcher?: { id: number; name: string };
  homeProbablePitcher?: { id: number; name: string };
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const MLB_LIVE_API = 'https://statsapi.mlb.com/api/v1.1';

function teamName(team: any): string {
  return team?.team?.name ?? team?.name ?? 'Unknown Team';
}

function teamId(team: any): number {
  return team?.team?.id ?? team?.id;
}

function probablePitcher(team: any) {
  const pitcher = team?.probablePitcher;
  return pitcher?.id ? { id: pitcher.id, name: pitcher.fullName ?? 'Unknown Pitcher' } : undefined;
}

function requestJson(url: string, label: string) {
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`${label} request failed: ${response.status}`);
    return response.json();
  });
}

export async function getSchedule(date = new Date()): Promise<MlbScheduleGame[]> {
  const dateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);

  const data = await requestJson(
    `${MLB_API}/schedule?sportId=1&date=${dateString}&hydrate=team,linescore,probablePitcher`,
    'MLB schedule',
  );

  return (data.dates ?? []).flatMap((day: any) =>
    (day.games ?? []).map((game: any): MlbScheduleGame => ({
      gamePk: game.gamePk,
      gameDate: game.gameDate,
      status: game.status?.abstractGameState ?? 'Unknown',
      detailedState: game.status?.detailedState ?? 'Unknown',
      currentInning: game.linescore?.currentInning,
      currentInningOrdinal: game.linescore?.currentInningOrdinal,
      inningState: game.linescore?.inningState,
      awayTeam: {
        id: teamId(game.teams?.away),
        name: teamName(game.teams?.away),
        abbreviation: game.teams?.away?.team?.abbreviation,
      },
      homeTeam: {
        id: teamId(game.teams?.home),
        name: teamName(game.teams?.home),
        abbreviation: game.teams?.home?.team?.abbreviation,
      },
      awayScore: game.teams?.away?.score,
      homeScore: game.teams?.home?.score,
      awayProbablePitcher: probablePitcher(game.teams?.away),
      homeProbablePitcher: probablePitcher(game.teams?.home),
    })),
  );
}

export async function getTeams() {
  const data = await requestJson(`${MLB_API}/teams?sportId=1`, 'MLB teams');
  return (data.teams ?? []).map((team: any) => ({
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function searchPitchers(query: string, season = new Date().getFullYear()) {
  const data = await requestJson(`${MLB_API}/sports/1/players?season=${season}`, 'MLB players');
  const needle = query.trim().toLowerCase();
  return (data.people ?? [])
    .filter((person: any) => {
      const position = person.primaryPosition?.type ?? person.primaryPosition?.abbreviation;
      const isPitcher = position === 'Pitcher' || person.primaryPosition?.abbreviation === 'P';
      return isPitcher && (!needle || String(person.fullName ?? '').toLowerCase().includes(needle));
    })
    .slice(0, 20)
    .map((person: any) => ({
      id: person.id,
      name: person.fullName,
      pitchHand: person.pitchHand?.code ?? null,
      currentTeam: person.currentTeam ? { id: person.currentTeam.id, name: person.currentTeam.name } : null,
    }));
}

export async function getGame(gamePk: number) {
  return requestJson(`${MLB_LIVE_API}/game/${gamePk}/feed/live`, 'MLB game');
}

export async function getTeamRoster(teamIdValue: number) {
  return requestJson(`${MLB_API}/teams/${teamIdValue}/roster?rosterType=active`, 'MLB roster');
}

export async function getTeamInjuredList(teamIdValue: number, season = new Date().getFullYear()) {
  const data = await requestJson(
    `${MLB_API}/teams/${teamIdValue}/roster?rosterType=fullRoster&season=${season}&hydrate=person`,
    'MLB full roster',
  );

  return (data.roster ?? [])
    .filter((entry: any) => {
      const statusText = [
        entry?.status?.code,
        entry?.status?.description,
        entry?.status?.name,
        entry?.person?.status?.code,
        entry?.person?.status?.description,
        entry?.person?.status?.name,
      ].filter(Boolean).join(' ').toLowerCase();
      return statusText.includes('injur') || statusText.includes('disabled') || /(^|\s)il(\s|$)/.test(statusText);
    })
    .map((entry: any) => ({
      id: entry?.person?.id,
      name: entry?.person?.fullName ?? 'Unknown player',
      position: entry?.position?.abbreviation ?? entry?.person?.primaryPosition?.abbreviation ?? '',
      status: entry?.status?.description ?? entry?.person?.status?.description ?? entry?.status?.code ?? entry?.person?.status?.code ?? 'Injured list',
    }))
    .filter((entry: any) => entry.id);
}

export async function getTeamStats(teamIdValue: number, season = new Date().getFullYear()) {
  return requestJson(
    `${MLB_API}/teams/${teamIdValue}/stats?stats=season&season=${season}&group=pitching`,
    'MLB team pitching stats',
  );
}

export async function getPlayer(playerId: number) {
  return requestJson(`${MLB_API}/people/${playerId}`, 'MLB player');
}

export async function getPlayerStats(playerId: number, season = new Date().getFullYear()) {
  return requestJson(
    `${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=hitting,pitching`,
    'MLB player stats',
  );
}

export async function getPlayerSplits(playerId: number, season = new Date().getFullYear()) {
  return requestJson(
    `${MLB_API}/people/${playerId}/stats?stats=statSplits&season=${season}&group=hitting,pitching&sitCodes=vl,vr`,
    'MLB player handedness splits',
  );
}

export async function getPlayerGameLog(playerId: number, season = new Date().getFullYear()) {
  return requestJson(
    `${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=hitting,pitching`,
    'MLB player game log',
  );
}
