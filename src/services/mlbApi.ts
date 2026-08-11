export type MlbScheduleGame = {
  gamePk: number;
  gameDate: string;
  status: string;
  detailedState: string;
  awayTeam: { id: number; name: string; abbreviation?: string };
  homeTeam: { id: number; name: string; abbreviation?: string };
  awayScore?: number;
  homeScore?: number;
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';

function teamName(team: any): string {
  return team?.team?.name ?? team?.name ?? 'Unknown Team';
}

function teamId(team: any): number {
  return team?.team?.id ?? team?.id;
}

export async function getSchedule(date = new Date()): Promise<MlbScheduleGame[]> {
  const dateString = date.toISOString().slice(0, 10);
  const response = await fetch(`${MLB_API}/schedule?sportId=1&date=${dateString}&hydrate=team,linescore`);

  if (!response.ok) {
    throw new Error(`MLB schedule request failed: ${response.status}`);
  }

  const data = await response.json();
  const dates = data.dates ?? [];

  return dates.flatMap((day: any) =>
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
    })),
  );
}

export async function getGame(gamePk: number) {
  const response = await fetch(`${MLB_API}/game/${gamePk}/feed/live`);

  if (!response.ok) {
    throw new Error(`MLB game request failed: ${response.status}`);
  }

  return response.json();
}
