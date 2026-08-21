import type { MlbScheduleGame } from './mlbApi';

const MLB_API = 'https://statsapi.mlb.com/api/v1';
const MLB_LIVE = 'https://statsapi.mlb.com/api/v1.1';

async function json(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB request failed (${response.status})`);
  return response.json();
}

export function easternDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function mapScheduleGame(game: any): MlbScheduleGame {
  const away = game.teams?.away ?? {}; const home = game.teams?.home ?? {};
  const awayTeam = away.team ?? {}; const homeTeam = home.team ?? {};
  return { gamePk: game.gamePk, gameDate: game.gameDate, status: game.status?.abstractGameState ?? 'Unknown', detailedState: game.status?.detailedState ?? 'Unknown', awayTeam: { id: awayTeam.id, name: awayTeam.name ?? 'Away Team', abbreviation: awayTeam.abbreviation }, homeTeam: { id: homeTeam.id, name: homeTeam.name ?? 'Home Team', abbreviation: homeTeam.abbreviation }, awayScore: away.score, homeScore: home.score, awayProbablePitcher: away.probablePitcher?.id ? { id: away.probablePitcher.id, name: away.probablePitcher.fullName ?? 'TBD' } : undefined, homeProbablePitcher: home.probablePitcher?.id ? { id: home.probablePitcher.id, name: home.probablePitcher.fullName ?? 'TBD' } : undefined };
}

export async function fetchSchedule(date = easternDateKey()): Promise<MlbScheduleGame[]> { const data = await json(`${MLB_API}/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=team,linescore,probablePitcher`); return (data.dates ?? []).flatMap((day: any) => (day.games ?? []).map(mapScheduleGame)); }
export async function fetchTeams() { const data = await json(`${MLB_API}/teams?sportId=1`); return (data.teams ?? []).map((team: any) => ({ id: team.id, name: team.name, abbreviation: team.abbreviation })).sort((a: any, b: any) => a.name.localeCompare(b.name)); }
export async function fetchTeamPitchers(teamId: number) { const data = await json(`${MLB_API}/teams/${teamId}/roster?rosterType=active`); return (data.roster ?? []).filter((entry: any) => entry.position?.abbreviation === 'P' || entry.position?.type === 'Pitcher').map((entry: any) => ({ id: entry.person?.id, name: entry.person?.fullName ?? 'Unknown pitcher', pitchHand: null, currentTeam: { id: teamId } })).filter((p: any) => p.id).sort((a: any, b: any) => a.name.localeCompare(b.name)); }
export async function searchMlbPitchers(query: string) { const season = new Date().getFullYear(); const data = await json(`${MLB_API}/sports/1/players?season=${season}`); const needle = query.trim().toLowerCase(); return (data.people ?? []).filter((p: any) => p.primaryPosition?.abbreviation === 'P' && String(p.fullName ?? '').toLowerCase().includes(needle)).slice(0, 20).map((p: any) => ({ id: p.id, name: p.fullName, pitchHand: p.pitchHand?.code ?? null, currentTeam: p.currentTeam ? { id: p.currentTeam.id, name: p.currentTeam.name } : null })); }
async function playerInfo(id: number) { const data = await json(`${MLB_API}/people/${id}`); return data.people?.[0] ?? {}; }
async function playerStats(id: number, group: 'hitting' | 'pitching') { const season = new Date().getFullYear(); const data = await json(`${MLB_API}/people/${id}/stats?stats=season&season=${season}&group=${group}`); return data.stats?.[0]?.splits?.[0]?.stat ?? {}; }
export async function fetchPlayerCareerStats(id: number, group: 'hitting' | 'pitching') { const data = await json(`${MLB_API}/people/${id}/stats?stats=career&group=${group}`); return data.stats?.[0]?.splits?.[0]?.stat ?? {}; }
export async function fetchPlayerHittingHandSplits(id: number) { const season = new Date().getFullYear(); const fetchSplit = async (code: 'vl' | 'vr') => { const data = await json(`${MLB_API}/people/${id}/stats?stats=season&season=${season}&group=hitting&sitCodes=${code}`); return data.stats?.[0]?.splits?.[0]?.stat ?? null; }; const [vsLeft, vsRight] = await Promise.all([fetchSplit('vl').catch(() => null), fetchSplit('vr').catch(() => null)]); return { vsLeft, vsRight }; }
export async function fetchPlayerRecentGameLogs(id: number, group: 'hitting' | 'pitching', limit = 8) { const season = new Date().getFullYear(); const data = await json(`${MLB_API}/people/${id}/stats?stats=gameLog&season=${season}&group=${group}`); return (data.stats?.[0]?.splits ?? []).slice(-limit).reverse().map((split: any) => ({ date: split.date ?? '', opponent: split.opponent?.name ?? '—', isHome: split.isHome ?? null, gamePk: split.game?.gamePk ?? null, stat: split.stat ?? {} })); }
export async function fetchLiveGameFeed(gamePk: number) { if (!Number.isInteger(gamePk)) throw new Error('A valid MLB game ID is required.'); return json(`${MLB_LIVE}/game/${gamePk}/feed/live`); }

export async function fetchRecentPitchProfile(id: number, gameLimit = 3) {
  const logs = await fetchPlayerRecentGameLogs(id, 'pitching', gameLimit + 2); const gamePks = logs.map((x: any) => x.gamePk).filter(Boolean).slice(0, gameLimit); const pitches: { code: string; name: string; velo: number }[] = [];
  await Promise.all(gamePks.map(async (gamePk: number) => { const feed = await json(`${MLB_LIVE}/game/${gamePk}/feed/live`).catch(() => null); for (const play of feed?.liveData?.plays?.allPlays ?? []) { if (play?.matchup?.pitcher?.id !== id) continue; for (const event of play.playEvents ?? []) { if (!event?.isPitch && !event?.details?.isPitch) continue; const velo = Number(event?.pitchData?.startSpeed); const code = event?.details?.type?.code ?? 'UNK'; const name = event?.details?.type?.description ?? code; if (Number.isFinite(velo)) pitches.push({ code, name, velo }); } } }));
  const grouped = new Map<string, { name: string; count: number; sum: number; max: number }>(); for (const pitch of pitches) { const current = grouped.get(pitch.code) ?? { name: pitch.name, count: 0, sum: 0, max: 0 }; current.count += 1; current.sum += pitch.velo; current.max = Math.max(current.max, pitch.velo); grouped.set(pitch.code, current); }
  return [...grouped.entries()].map(([code, x]) => ({ code, name: x.name, count: x.count, avgVelo: x.sum / x.count, maxVelo: x.max, usagePct: pitches.length ? (x.count / pitches.length) * 100 : 0 })).sort((a, b) => b.count - a.count);
}

export async function fetchBatterPitchTypeProfile(id: number, gameLimit = 8) {
  const logs = await fetchPlayerRecentGameLogs(id, 'hitting', gameLimit + 4); const gamePks = logs.map((x: any) => x.gamePk).filter(Boolean).slice(0, gameLimit);
  const grouped = new Map<string, { name: string; pitches: number; pa: number; ab: number; hits: number; totalBases: number; strikeouts: number; walks: number }>();
  await Promise.all(gamePks.map(async (gamePk: number) => { const feed = await json(`${MLB_LIVE}/game/${gamePk}/feed/live`).catch(() => null); for (const play of feed?.liveData?.plays?.allPlays ?? []) { if (play?.matchup?.batter?.id !== id) continue; const pitchEvents = (play.playEvents ?? []).filter((e: any) => e?.isPitch || e?.details?.isPitch); const lastPitch = [...pitchEvents].reverse().find((e: any) => e?.details?.type?.code); if (!lastPitch) continue; const code = lastPitch.details.type.code; const name = lastPitch.details.type.description ?? code; const x = grouped.get(code) ?? { name, pitches: 0, pa: 0, ab: 0, hits: 0, totalBases: 0, strikeouts: 0, walks: 0 }; x.pitches += pitchEvents.filter((e: any) => e?.details?.type?.code === code).length || 1; x.pa += 1; const event = String(play?.result?.eventType ?? '').toLowerCase(); const hitBases: Record<string, number> = { single: 1, double: 2, triple: 3, home_run: 4 }; if (hitBases[event]) { x.ab += 1; x.hits += 1; x.totalBases += hitBases[event]; } else if (event === 'strikeout' || event === 'strikeout_double_play') { x.ab += 1; x.strikeouts += 1; } else if (event === 'walk' || event === 'intent_walk') { x.walks += 1; } else if (!['hit_by_pitch','sac_fly','sac_bunt','catcher_interf'].includes(event)) x.ab += 1; grouped.set(code, x); } }));
  return [...grouped.entries()].map(([code, x]) => ({ code, name: x.name, pitches: x.pitches, pa: x.pa, ab: x.ab, hits: x.hits, avg: x.ab ? x.hits / x.ab : null, slg: x.ab ? x.totalBases / x.ab : null, strikeoutPct: x.pa ? (x.strikeouts / x.pa) * 100 : null, walkPct: x.pa ? (x.walks / x.pa) * 100 : null })).filter(x => x.pa >= 2).sort((a,b) => b.pa - a.pa).slice(0,6);
}

const isHitterRosterEntry = (entry: any) => {
  const abbreviation = String(entry?.position?.abbreviation ?? '').toUpperCase();
  const type = String(entry?.position?.type ?? '').toLowerCase();
  return Boolean(entry?.person?.id) && abbreviation !== 'P' && type !== 'pitcher';
};

const activeHitterRoster = (activeRoster: any) => {
  const active = (activeRoster?.roster ?? []).filter(isHitterRosterEntry);
  const seen = new Set<number>();
  return active.filter((entry: any) => {
    const id = Number(entry?.person?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const teamLineupFromFeed = (feed: any, teamId: number) => {
  const side = Number(feed?.gameData?.teams?.away?.id) === teamId ? 'away' : Number(feed?.gameData?.teams?.home?.id) === teamId ? 'home' : null;
  if (!side) return [];
  const teamBox = feed?.liveData?.boxscore?.teams?.[side] ?? {};
  const order = Array.isArray(teamBox?.battingOrder) ? teamBox.battingOrder : [];
  const seen = new Set<number>();
  return order.map((rawId: any, index: number) => {
    const id = Number(rawId);
    if (!id || seen.has(id)) return null;
    seen.add(id);
    const player = teamBox?.players?.[`ID${id}`] ?? {};
    return { id, name: player?.person?.fullName ?? 'Unknown player', position: player?.position?.abbreviation ?? player?.position?.code ?? '', battingOrder: index + 1 };
  }).filter(Boolean).slice(0, 9);
};

export async function fetchTeamGameLineup(gamePk: number, teamId: number) {
  if (!Number.isInteger(gamePk) || !Number.isInteger(teamId)) return [];
  const feed = await json(`${MLB_LIVE}/game/${gamePk}/feed/live`);
  return teamLineupFromFeed(feed, teamId);
}

export async function buildPitcherVsTeam(pitcherId: number, teamId: number, gamePk?: number) {
  const lineupRequest = Number.isInteger(gamePk) ? fetchTeamGameLineup(gamePk!, teamId).catch(() => []) : Promise.resolve([]);
  const [pitcher, pitching, activeRoster, fortyMan, teams, postedLineup] = await Promise.all([playerInfo(pitcherId), playerStats(pitcherId, 'pitching'), json(`${MLB_API}/teams/${teamId}/roster?rosterType=active`).catch(() => ({ roster: [] })), json(`${MLB_API}/teams/${teamId}/roster?rosterType=40Man`).catch(() => ({ roster: [] })), fetchTeams(), lineupRequest]);
  const team = teams.find((item: any) => item.id === teamId) ?? { id: teamId, name: 'Selected Team' };
  const hasConfirmedLineup = postedLineup.length === 9;
  const hitters = hasConfirmedLineup ? postedLineup.map((player: any) => ({ person: { id: player.id, fullName: player.name }, position: { abbreviation: player.position }, battingOrder: player.battingOrder })) : activeHitterRoster(activeRoster);
  const batters = await Promise.all(hitters.map(async (entry: any) => {
    const id = entry.person?.id;
    if (!id) return null;
    const [person, hitting] = await Promise.all([playerInfo(id).catch(() => ({})), playerStats(id, 'hitting').catch(() => ({}))]);
    return {
      id,
      name: person.fullName ?? entry.person?.fullName ?? 'Unknown player',
      position: entry.position?.abbreviation ?? person.primaryPosition?.abbreviation ?? '',
      battingOrder: entry.battingOrder ?? null,
      batSide: person.batSide?.code ?? null,
      stats: {
        gamesPlayed: hitting.gamesPlayed ?? null,
        atBats: hitting.atBats ?? null,
        runs: hitting.runs ?? null,
        hits: hitting.hits ?? null,
        homeRuns: hitting.homeRuns ?? null,
        rbi: hitting.rbi ?? null,
        stolenBases: hitting.stolenBases ?? null,
        baseOnBalls: hitting.baseOnBalls ?? null,
        strikeOuts: hitting.strikeOuts ?? null,
        avg: hitting.avg ?? null,
        obp: hitting.obp ?? null,
        slg: hitting.slg ?? null,
        ops: hitting.ops ?? null,
      },
    };
  }));
  const activeIds = new Set((activeRoster.roster ?? []).map((entry: any) => entry.person?.id));
  const injuredList = (fortyMan.roster ?? []).filter((entry: any) => entry.person?.id && !activeIds.has(entry.person.id)).filter((entry: any) => { const text = `${entry.status?.description ?? ''} ${entry.status?.code ?? ''}`.toLowerCase(); return text.includes('injur') || /^d(7|10|15|60)/i.test(entry.status?.code ?? ''); }).map((entry: any) => ({ id: entry.person.id, name: entry.person.fullName, position: entry.position?.abbreviation ?? '', status: entry.status?.description ?? entry.status?.code ?? 'Unavailable' }));
  return { pitcher: { id: pitcherId, name: pitcher.fullName ?? 'Unknown pitcher', pitchHand: pitcher.pitchHand?.code ?? null, stats: { gamesPlayed: pitching.gamesPlayed ?? null, gamesStarted: pitching.gamesStarted ?? null, inningsPitched: pitching.inningsPitched ?? null, era: pitching.era ?? null, whip: pitching.whip ?? null, strikeOuts: pitching.strikeOuts ?? null, strikeoutsPer9Inn: pitching.strikeoutsPer9Inn ?? null, walksPer9Inn: pitching.walksPer9Inn ?? null } }, team, batters: batters.filter(Boolean), batterSource: hasConfirmedLineup ? 'lineup' : 'activeRoster', lineupIds: hasConfirmedLineup ? postedLineup.map((player: any) => player.id) : [], injuredList };
}
