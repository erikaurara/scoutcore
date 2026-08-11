const MLB_API = 'https://statsapi.mlb.com/api/v1';

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
}

export const currentSeason = () => new Date().getFullYear();

export async function searchMlbPlayers(query: string) {
  const season = currentSeason();
  const data = await json(`${MLB_API}/sports/1/players?season=${season}`);
  const needle = query.trim().toLowerCase();
  return (data.people ?? [])
    .filter((p: any) => String(p.fullName ?? '').toLowerCase().includes(needle))
    .slice(0, 20)
    .map((p: any) => ({
      id: p.id,
      name: p.fullName,
      position: p.primaryPosition?.abbreviation ?? '—',
      group: p.primaryPosition?.type === 'Pitcher' ? 'pitching' : 'hitting',
      batSide: p.batSide?.code ?? null,
      pitchHand: p.pitchHand?.code ?? null,
      currentTeam: p.currentTeam ? { id: p.currentTeam.id, name: p.currentTeam.name } : null,
    }));
}

export async function fetchPlayerProfile(playerId: number) {
  const season = currentSeason();
  const personData = await json(`${MLB_API}/people/${playerId}?hydrate=currentTeam`);
  const person = personData.people?.[0] ?? {};
  const group: 'pitching' | 'hitting' = person.primaryPosition?.type === 'Pitcher' ? 'pitching' : 'hitting';
  const [seasonData, careerData, logsData] = await Promise.all([
    json(`${MLB_API}/people/${playerId}/stats?stats=season&season=${season}&group=${group}`).catch(() => ({ stats: [] })),
    json(`${MLB_API}/people/${playerId}/stats?stats=career&group=${group}`).catch(() => ({ stats: [] })),
    json(`${MLB_API}/people/${playerId}/stats?stats=gameLog&season=${season}&group=${group}`).catch(() => ({ stats: [] })),
  ]);
  return {
    id: playerId,
    name: person.fullName ?? 'Unknown Player',
    position: person.primaryPosition?.abbreviation ?? '—',
    group,
    team: person.currentTeam ? { id: person.currentTeam.id, name: person.currentTeam.name } : null,
    batSide: person.batSide?.code ?? null,
    pitchHand: person.pitchHand?.code ?? null,
    season: seasonData.stats?.[0]?.splits?.[0]?.stat ?? {},
    career: careerData.stats?.[0]?.splits?.[0]?.stat ?? {},
    logs: (logsData.stats?.[0]?.splits ?? []).slice(-30).reverse().map((x: any) => ({
      date: x.date,
      opponent: x.opponent?.name ?? '—',
      stat: x.stat ?? {},
      gamePk: x.game?.gamePk ?? null,
    })),
  };
}

export async function fetchTeamProfile(teamId: number) {
  const season = currentSeason();
  const [teamData, rosterData, scheduleData] = await Promise.all([
    json(`${MLB_API}/teams/${teamId}?hydrate=division,venue`),
    json(`${MLB_API}/teams/${teamId}/roster?rosterType=active`),
    json(`${MLB_API}/schedule?sportId=1&teamId=${teamId}&season=${season}&hydrate=probablePitcher,linescore`).catch(() => ({ dates: [] })),
  ]);
  const team = teamData.teams?.[0] ?? {};
  const games = (scheduleData.dates ?? []).flatMap((d: any) => d.games ?? []);
  const completed = games.filter((g: any) => g.status?.abstractGameState === 'Final');
  const wins = completed.filter((g: any) => {
    const isHome = g.teams?.home?.team?.id === teamId;
    return isHome ? g.teams?.home?.isWinner : g.teams?.away?.isWinner;
  }).length;
  const losses = completed.length - wins;
  const upcoming = games.filter((g: any) => g.status?.abstractGameState !== 'Final').slice(0, 5).map((g: any) => {
    const isHome = g.teams?.home?.team?.id === teamId;
    const opponent = isHome ? g.teams?.away : g.teams?.home;
    const own = isHome ? g.teams?.home : g.teams?.away;
    return { gamePk: g.gamePk, gameDate: g.gameDate, opponent: opponent?.team?.name ?? '—', homeAway: isHome ? 'HOME' : 'AWAY', probablePitcher: own?.probablePitcher?.fullName ?? 'TBD', status: g.status?.detailedState ?? '' };
  });
  return {
    id: teamId,
    name: team.name ?? 'MLB Team',
    abbreviation: team.abbreviation ?? '',
    division: team.division?.name ?? '',
    venue: team.venue?.name ?? '',
    record: `${wins}-${losses}`,
    roster: (rosterData.roster ?? []).map((r: any) => ({ id: r.person?.id, name: r.person?.fullName, position: r.position?.abbreviation ?? '—' })).filter((r: any) => r.id),
    upcoming,
  };
}
