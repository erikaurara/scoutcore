import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';

interface LiveMatchupsViewProps { onOpenReport: () => void; }

type PitcherCard = { id: number; name: string; team: string; era?: string; whip?: string; k9?: string; strikeOuts?: number; innings?: string };

const getStat = (data: any) => data?.stats?.[0]?.splits?.[0]?.stat ?? {};

export const LiveMatchupsView: React.FC<LiveMatchupsViewProps> = ({ onOpenReport }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [pitchers, setPitchers] = useState<{ away?: PitcherCard; home?: PitcherCard }>({});
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGames = async () => {
    try {
      const response = await fetch('/api/games/today');
      if (!response.ok) throw new Error('Unable to load today\'s MLB games.');
      const data = await response.json();
      const nextGames: MlbScheduleGame[] = data.games ?? [];
      setGames(nextGames);
      setSelectedGamePk((current) => current ?? nextGames[0]?.gamePk ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load MLB games.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadGames();
    const timer = window.setInterval(loadGames, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedGame = useMemo(() => games.find((g) => g.gamePk === selectedGamePk), [games, selectedGamePk]);

  useEffect(() => {
    if (!selectedGame) return;
    let cancelled = false;
    const loadDetails = async () => {
      try {
        const [feedResponse, ...statResponses] = await Promise.all([
          fetch(`/api/games/${selectedGame.gamePk}`),
          selectedGame.awayProbablePitcher ? fetch(`/api/players/${selectedGame.awayProbablePitcher.id}/stats`) : Promise.resolve(null),
          selectedGame.homeProbablePitcher ? fetch(`/api/players/${selectedGame.homeProbablePitcher.id}/stats`) : Promise.resolve(null),
        ]);
        const nextFeed = feedResponse.ok ? await feedResponse.json() : null;
        const makePitcher = async (side: 'away' | 'home', response: Response | null): Promise<PitcherCard | undefined> => {
          const pitcher = side === 'away' ? selectedGame.awayProbablePitcher : selectedGame.homeProbablePitcher;
          const team = side === 'away' ? selectedGame.awayTeam.name : selectedGame.homeTeam.name;
          if (!pitcher) return undefined;
          const data = response?.ok ? await response.json() : {};
          const stat = getStat(data);
          return { id: pitcher.id, name: pitcher.name, team, era: stat.era, whip: stat.whip, k9: stat.strikeoutsPer9Inn, strikeOuts: stat.strikeOuts, innings: stat.inningsPitched };
        };
        const away = await makePitcher('away', statResponses[0] as Response | null);
        const home = await makePitcher('home', statResponses[1] as Response | null);
        if (!cancelled) { setFeed(nextFeed); setPitchers({ away, home }); }
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load matchup details.'); }
    };
    loadDetails();
    return () => { cancelled = true; };
  }, [selectedGame]);

  if (loading) return <div className="min-h-screen bg-[#0b1326] text-[#849495] p-8">Loading live matchups…</div>;

  const boxscoreTeams = feed?.liveData?.boxscore?.teams ?? {};
  const awayPlayers = Object.values(boxscoreTeams.away?.players ?? {}) as any[];
  const homePlayers = Object.values(boxscoreTeams.home?.players ?? {}) as any[];

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131b2e] p-4 rounded-xl border border-[#3b494b]/20">
      <div><span className="font-label-caps text-[10px] text-[#65f2b5]">LIVE DATA</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">MLB Matchups</h1></div>
      <div className="flex gap-3">
        <select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 text-sm text-[#00f0ff] rounded-lg px-3 py-2">
          {games.map((game) => <option key={game.gamePk} value={game.gamePk}>{game.awayTeam.name} @ {game.homeTeam.name}</option>)}
        </select>
        <button onClick={onOpenReport} className="px-4 py-2 rounded-lg bg-[#00f0ff] text-[#002022] font-bold text-xs">SCOUT REPORT</button>
      </div>
    </div>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {selectedGame && <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(['away', 'home'] as const).map((side) => {
          const pitcher = pitchers[side];
          const team = side === 'away' ? selectedGame.awayTeam : selectedGame.homeTeam;
          return <div key={side} className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-6">
            <span className="font-label-caps text-[10px] text-[#849495]">{team.name}</span>
            <h2 className="font-display-lg text-3xl mt-1">{pitcher?.name ?? 'Probable pitcher TBD'}</h2>
            <div className="grid grid-cols-4 gap-3 mt-5">
              {[['ERA', pitcher?.era], ['WHIP', pitcher?.whip], ['K/9', pitcher?.k9], ['SO', pitcher?.strikeOuts]].map(([label, value]) => <div key={String(label)} className="bg-[#131b2e] rounded-lg p-3"><span className="text-[9px] text-[#849495]">{label}</span><p className="text-xl font-bold text-[#dbfcff]">{value ?? '—'}</p></div>)}
            </div>
          </div>;
        })}
      </div>

      <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-6">
        <div className="flex items-center justify-between mb-5"><div><span className="font-label-caps text-[10px] text-[#849495]">VERIFIED MLB FEED</span><h2 className="font-headline-lg text-xl">Lineup & Game Data</h2></div><span className="text-xs text-[#65f2b5]">AUTO-REFRESH 5 MIN</span></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {([[selectedGame.awayTeam.name, awayPlayers], [selectedGame.homeTeam.name, homePlayers]] as const).map(([team, players]) => <div key={team}><h3 className="text-sm font-bold text-[#00f0ff] mb-3">{team}</h3><div className="space-y-2">{players.filter((p) => p.position?.abbreviation !== 'P').slice(0, 9).map((p) => <div key={p.person?.id} className="flex justify-between bg-[#131b2e] p-2 rounded"><span className="text-xs">{p.person?.fullName ?? 'Player'}</span><span className="text-[10px] text-[#849495]">{p.position?.abbreviation ?? ''}</span></div>)}{players.length === 0 && <p className="text-xs text-[#849495]">Official lineup not available yet.</p>}</div></div>)}
        </div>
      </div>
    </>}
  </div>;
};
