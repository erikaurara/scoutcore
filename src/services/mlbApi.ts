export type MlbScheduleGame = {
  gamePk: number;
  gameDate: string;
  status: string;
  detailedState: string;
  awayTeam: { id: number; name: string; abbreviation?: string };
  homeTeam: { id: number; name: string; abbreviation?: string };
  awayScore?: number;
  homeScore?: number;
  awayProbablePitcher?: { id: number; name: string };
  homeProbablePitcher?: { id: number; name: string };
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';

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

export async function getGame(gamePk: number) {
  return requestJson(`${MLB_API}/game/${gamePk}/feed/live`, 'MLB game');
}

export async function getTeamRoster(teamIdValue: number) {
  return requestJson(`${MLB_API}/teams/${teamIdValue}/roster?rosterType=active`, 'MLB roster');
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
