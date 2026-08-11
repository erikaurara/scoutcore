import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import { FavoriteButton } from './FavoriteButton';

interface LiveMatchupsViewProps { onOpenReport: () => void; }
type Analytics = any;

export const LiveMatchupsView: React.FC<LiveMatchupsViewProps> = ({ onOpenReport }) => {
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGames = async () => {
    try {
      const response = await fetch('/api/games/today');
      if (!response.ok) throw new Error('Unable to load today\'s MLB games.');
      const data = await response.json();
      const nextGames = data.games ?? [];
      setGames(nextGames);
      setSelectedGamePk((current) => current ?? nextGames[0]?.gamePk ?? null);
      setError(null);
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
    if (!selectedGamePk) return;
    let cancelled = false;
    setAnalytics(null);
    fetch(`/api/games/${selectedGamePk}/analytics`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to calculate matchup analytics.');
        return response.json();
      })
      .then((data) => { if (!cancelled) setAnalytics(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to calculate matchup analytics.'); });
    return () => { cancelled = true; };
  }, [selectedGamePk]);

  if (loading) return <div className="min-h-screen bg-[#0b1326] text-[#849495] p-8">Loading live MLB matchups…</div>;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131b2e] p-4 rounded-xl border border-[#3b494b]/20">
      <div><span className="font-label-caps text-[10px] text-[#65f2b5]">LIVE + CALCULATED</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">MLB Matchup Intelligence</h1><p className="text-xs text-[#849495] mt-1">Transparent scores from verified MLB season data. Missing data lowers confidence.</p></div>
      <div className="flex gap-3">
        <select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 text-sm text-[#00f0ff] rounded-lg px-3 py-2">
          {games.map((game) => <option key={game.gamePk} value={game.gamePk}>{game.awayTeam.name} @ {game.homeTeam.name}</option>)}
        </select>
        <button onClick={onOpenReport} className="px-4 py-2 rounded-lg bg-[#00f0ff] text-[#002022] font-bold text-xs">SCOUT REPORT</button>
      </div>
    </div>

    {selectedGame && <div className="flex items-center justify-center gap-8 bg-[#131b2e] rounded-xl border border-[#3b494b]/20 p-5">
      <div className="flex items-center gap-3"><TeamLogo id={selectedGame.awayTeam.id} name={selectedGame.awayTeam.name} /><FavoriteButton compact item={{ id: selectedGame.awayTeam.id, kind: 'team', name: selectedGame.awayTeam.name, imageUrl: mlbTeamLogoUrl(selectedGame.awayTeam.id) }} /></div>
      <div className="text-center"><p className="text-xs text-[#849495]">{selectedGame.awayTeam.name}</p><p className="font-display-lg text-2xl text-[#dbfcff]">@</p><p className="text-xs text-[#849495]">{selectedGame.homeTeam.name}</p></div>
      <div className="flex items-center gap-3"><FavoriteButton compact item={{ id: selectedGame.homeTeam.id, kind: 'team', name: selectedGame.homeTeam.name, imageUrl: mlbTeamLogoUrl(selectedGame.homeTeam.id) }} /><TeamLogo id={selectedGame.homeTeam.id} name={selectedGame.homeTeam.name} /></div>
    </div>}

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}
    {!games.length && <div className="p-8 rounded-xl bg-[#171f33] text-center text-[#849495]">No MLB games scheduled today.</div>}
    {analytics && selectedGame && <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Metric label="MATCHUPS" value={analytics.summary.matchupCount} />
        <Metric label="AVG MATCHUP SCORE" value={analytics.summary.averageMatchupScore ?? '—'} />
        <Metric label="DATA CONFIDENCE" value={`${analytics.summary.dataQuality}%`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {analytics.teams.map((team: any) => <div key={team.side} className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="flex items-center gap-3"><TeamLogo id={team.teamId} name={team.team} small /><div><span className="text-[10px] text-[#849495]">{team.side.toUpperCase()}</span><h2 className="font-display-lg text-2xl">{team.team}</h2></div><FavoriteButton compact item={{ id: team.teamId, kind: 'team', name: team.team, imageUrl: mlbTeamLogoUrl(team.teamId) }} /></div>
            <div className="flex items-center gap-3 text-right"><PlayerPhoto id={team.pitcher?.id} name={team.pitcher?.name} size="md" /><div><span className="text-[9px] text-[#849495]">STARTER</span><p className="font-bold text-[#dbfcff]">{team.pitcher?.name ?? 'TBD'}</p><p className="text-[10px] text-[#849495]">ERA {team.pitcher?.stats?.era ?? '—'} · K/9 {team.pitcher?.stats?.strikeoutsPer9Inn ?? '—'}</p></div>{team.pitcher?.id && <FavoriteButton compact item={{ id: team.pitcher.id, kind: 'player', name: team.pitcher.name, subtitle: team.team, imageUrl: mlbPlayerHeadshotUrl(team.pitcher.id, 120) }} />}</div>
          </div>
          <div className="space-y-2">
            {team.matchups.map((matchup: any) => <div key={matchup.batter.id} className="bg-[#131b2e] rounded-lg p-3 flex items-center gap-3">
              <PlayerPhoto id={matchup.batter.id} name={matchup.batter.name} />
              <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{matchup.batter.name}</p><p className="text-[10px] text-[#849495]">{matchup.batter.position || 'H'} · OPS {matchup.batter.stats?.ops ?? '—'} · AVG {matchup.batter.stats?.avg ?? '—'}</p></div>
              <FavoriteButton compact item={{ id: matchup.batter.id, kind: 'player', name: matchup.batter.name, subtitle: team.team, imageUrl: mlbPlayerHeadshotUrl(matchup.batter.id, 120) }} />
              <div className="text-right"><div className="w-10 h-10 rounded-full bg-[#222a3d] flex items-center justify-center text-xs font-bold text-[#00f0ff] ml-auto">{matchup.analysis?.score ?? '—'}</div><p className="text-[9px] text-[#849495] mt-1">CONF. <span className="text-[#65f2b5]">{matchup.analysis?.confidence ?? 0}%</span></p></div>
            </div>)}
            {!team.matchups.length && <p className="text-xs text-[#849495]">Official lineup data is not available yet.</p>}
          </div>
        </div>)}
      </div>
    </>}
    {selectedGame && !analytics && <div className="p-8 rounded-xl bg-[#171f33] text-center text-[#849495]">Calculating verified matchup data…</div>}
  </div>;
};

const PlayerPhoto = ({ id, name, size = 'sm' }: { id?: number; name?: string; size?: 'sm' | 'md' }) => {
  const px = size === 'md' ? 'w-14 h-14' : 'w-12 h-12';
  const [failed, setFailed] = useState(false);
  if (!id || failed) return <div className={`${px} rounded-full bg-[#222a3d] border border-[#3b494b]/30 flex items-center justify-center text-[10px] font-bold text-[#00f0ff] shrink-0`}>{playerInitials(name)}</div>;
  return <img src={mlbPlayerHeadshotUrl(id, size === 'md' ? 160 : 120)} onError={() => setFailed(true)} alt={name ?? 'MLB player'} className={`${px} rounded-full object-cover bg-[#222a3d] border border-[#3b494b]/30 shrink-0`} />;
};

const TeamLogo = ({ id, name, small = false }: { id?: number; name: string; small?: boolean }) => <div className={`${small ? 'w-12 h-12' : 'w-20 h-20'} rounded-2xl bg-white/95 p-2 flex items-center justify-center shrink-0`}><img src={mlbTeamLogoUrl(id)} alt={`${name} logo`} className="max-w-full max-h-full object-contain" /></div>;
const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><span className="text-[10px] text-[#849495]">{label}</span><p className="font-data-numeric text-3xl font-bold text-[#dbfcff] mt-1">{value}</p></div>;
