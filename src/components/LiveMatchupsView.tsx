import React, { useEffect, useMemo, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl, playerInitials } from '../services/mlbMedia';
import { isFavoritePlayer, isFavoriteTeam, toggleFavoritePlayer, toggleFavoriteTeam } from '../services/favorites';

interface LiveMatchupsViewProps { onOpenReport: () => void; }
type Analytics = any;
type TeamOption = { id: number; name: string; abbreviation?: string };
type PitcherOption = { id: number; name: string; pitchHand?: string | null; currentTeam?: { id: number; name: string } | null };
type CustomMatchup = any;

export const LiveMatchupsView: React.FC<LiveMatchupsViewProps> = ({ onOpenReport }) => {
  const [mode, setMode] = useState<'live' | 'custom'>('live');
  const [games, setGames] = useState<MlbScheduleGame[]>([]);
  const [selectedGamePk, setSelectedGamePk] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, forceFavorites] = useState(0);

  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamId, setTeamId] = useState<number | null>(null);
  const [pitcherQuery, setPitcherQuery] = useState('');
  const [pitcherResults, setPitcherResults] = useState<PitcherOption[]>([]);
  const [selectedPitcher, setSelectedPitcher] = useState<PitcherOption | null>(null);
  const [custom, setCustom] = useState<CustomMatchup | null>(null);
  const [selectedBatterId, setSelectedBatterId] = useState<number | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/games/today').then((r) => r.json()),
      fetch('/api/teams').then((r) => r.json()),
    ]).then(([gameData, teamData]) => {
      const nextGames = gameData.games ?? [];
      setGames(nextGames);
      setSelectedGamePk(nextGames[0]?.gamePk ?? null);
      setTeams(teamData.teams ?? []);
      setTeamId(teamData.teams?.[0]?.id ?? null);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load MLB data.')).finally(() => setLoading(false));
  }, []);

  const selectedGame = useMemo(() => games.find((g) => g.gamePk === selectedGamePk), [games, selectedGamePk]);

  useEffect(() => {
    if (mode !== 'live' || !selectedGamePk) return;
    let cancelled = false;
    setAnalytics(null);
    fetch(`/api/games/${selectedGamePk}/analytics`).then(async (response) => {
      if (!response.ok) throw new Error('Unable to calculate matchup analytics.');
      return response.json();
    }).then((data) => { if (!cancelled) setAnalytics(data); }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to calculate matchup analytics.'); });
    return () => { cancelled = true; };
  }, [selectedGamePk, mode]);

  useEffect(() => {
    if (mode !== 'custom' || pitcherQuery.trim().length < 2) {
      setPitcherResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/players/search?q=${encodeURIComponent(pitcherQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => setPitcherResults(data.players ?? []))
        .catch(() => setPitcherResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pitcherQuery, mode]);

  const buildCustom = async () => {
    if (!selectedPitcher || !teamId) return;
    setCustomLoading(true);
    setError(null);
    setSelectedBatterId(null);
    try {
      const response = await fetch(`/api/matchup-builder?pitcherId=${selectedPitcher.id}&teamId=${teamId}`);
      if (!response.ok) throw new Error('Unable to build the custom matchup.');
      const data = await response.json();
      setCustom(data);
      setSelectedBatterId(data.batters?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build the custom matchup.');
    } finally {
      setCustomLoading(false);
    }
  };

  const selectedBatter = custom?.batters?.find((b: any) => b.id === selectedBatterId) ?? null;
  const refreshFavoriteUi = () => forceFavorites((v) => v + 1);

  if (loading) return <div className="min-h-screen bg-[#0b1326] text-[#849495] p-8">Loading MLB matchups…</div>;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131b2e] p-4 rounded-xl border border-[#3b494b]/20">
      <div><span className="font-label-caps text-[10px] text-[#65f2b5]">PITCHER VS BATTER LAB</span><h1 className="font-display-lg text-3xl text-[#dbfcff]">MLB Matchup Intelligence</h1><p className="text-xs text-[#849495] mt-1">Use today's live games, or build any pitcher vs team comparison.</p></div>
      <div className="flex gap-2">
        <button onClick={() => setMode('live')} className={`px-4 py-2 rounded-lg text-xs font-bold ${mode === 'live' ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#222a3d] text-[#b9cacb]'}`}>TODAY'S GAMES</button>
        <button onClick={() => setMode('custom')} className={`px-4 py-2 rounded-lg text-xs font-bold ${mode === 'custom' ? 'bg-[#00f0ff] text-[#002022]' : 'bg-[#222a3d] text-[#b9cacb]'}`}>CUSTOM PvB</button>
      </div>
    </div>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab] text-sm">{error}</div>}

    {mode === 'custom' ? <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto] gap-4 items-end bg-[#131b2e] rounded-xl border border-[#3b494b]/20 p-5">
        <div className="relative">
          <label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE PITCHER</label>
          <input value={selectedPitcher ? selectedPitcher.name : pitcherQuery} onChange={(e) => { setSelectedPitcher(null); setPitcherQuery(e.target.value); }} placeholder="Search Yamamoto, Cole, Skubal..." className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm text-[#dbfcff]" />
          {!selectedPitcher && pitcherResults.length > 0 && <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-[#171f33] border border-[#3b494b]/40 shadow-xl">
            {pitcherResults.map((p) => <button key={p.id} onClick={() => { setSelectedPitcher(p); setPitcherQuery(p.name); setPitcherResults([]); }} className="w-full px-3 py-3 text-left hover:bg-[#222a3d] flex items-center gap-3">
              <PlayerPhoto id={p.id} name={p.name} /><div><p className="text-sm font-bold">{p.name}</p><p className="text-[10px] text-[#849495]">{p.pitchHand ? `${p.pitchHand}HP` : 'Pitch hand unavailable'}{p.currentTeam?.name ? ` · ${p.currentTeam.name}` : ''}</p></div>
            </button>)}
          </div>}
        </div>
        <div className="pb-3 font-display-lg text-2xl text-[#00f0ff] text-center">VS</div>
        <div>
          <label className="text-[10px] text-[#849495] font-label-caps block mb-2">CHOOSE TEAM</label>
          <select value={teamId ?? ''} onChange={(e) => setTeamId(Number(e.target.value))} className="w-full bg-[#171f33] border border-[#3b494b]/40 rounded-lg px-3 py-3 text-sm text-[#dbfcff]">
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </div>
        <button disabled={!selectedPitcher || !teamId || customLoading} onClick={buildCustom} className="px-5 py-3 rounded-lg bg-[#00f0ff] disabled:opacity-40 text-[#002022] font-bold text-xs">{customLoading ? 'BUILDING…' : 'BUILD MATCHUP'}</button>
      </div>

      {custom && <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
        <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 overflow-hidden">
          <div className="p-5 border-b border-[#3b494b]/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3"><TeamLogo id={custom.team.id} name={custom.team.name} small /><div><p className="text-[10px] text-[#849495]">BATTER LIST</p><h2 className="font-display-lg text-2xl">{custom.team.name}</h2></div></div>
            <FavoriteButton active={isFavoriteTeam(custom.team.id)} label="team" onClick={() => { toggleFavoriteTeam(custom.team); refreshFavoriteUi(); }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#131b2e] text-[#849495]"><tr><th className="p-3">BATTER</th><th className="p-3">BATS</th><th className="p-3">H</th><th className="p-3">HR</th><th className="p-3">SO</th><th className="p-3">AVG</th><th className="p-3">OPS</th><th className="p-3">★</th></tr></thead>
              <tbody>{custom.batters.map((batter: any) => <tr key={batter.id} onClick={() => setSelectedBatterId(batter.id)} className={`border-t border-[#3b494b]/15 cursor-pointer hover:bg-[#222a3d]/60 ${selectedBatterId === batter.id ? 'bg-[#00f0ff]/10' : ''}`}>
                <td className="p-3"><div className="flex items-center gap-2"><PlayerPhoto id={batter.id} name={batter.name} /><div><p className="font-bold text-[#dbfcff]">{batter.name}</p><p className="text-[10px] text-[#849495]">{batter.position || '—'}</p></div></div></td>
                <td className="p-3"><HandBadge hand={batter.batSide} suffix="HB" /></td><td className="p-3">{batter.stats?.hits ?? '—'}</td><td className="p-3">{batter.stats?.homeRuns ?? '—'}</td><td className="p-3">{batter.stats?.strikeOuts ?? '—'}</td><td className="p-3">{batter.stats?.avg ?? '—'}</td><td className="p-3">{batter.stats?.ops ?? '—'}</td>
                <td className="p-3"><button onClick={(e) => { e.stopPropagation(); toggleFavoritePlayer({ id: batter.id, name: batter.name, teamId: custom.team.id, team: custom.team.name }); refreshFavoriteUi(); }} className="text-xl text-[#ffd166]">{isFavoritePlayer(batter.id) ? '★' : '☆'}</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-6">
          {selectedBatter ? <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              <PlayerProfile id={custom.pitcher.id} name={custom.pitcher.name} subtitle={`${custom.pitcher.pitchHand ?? '?'}HP · ERA ${custom.pitcher.stats?.era ?? '—'} · WHIP ${custom.pitcher.stats?.whip ?? '—'}`} />
              <div className="text-center"><p className="font-display-lg text-3xl text-[#00f0ff]">VS</p><p className="text-[9px] text-[#849495]">SEASON COMPARISON</p></div>
              <PlayerProfile id={selectedBatter.id} name={selectedBatter.name} subtitle={`${selectedBatter.batSide ?? '?'}HB · AVG ${selectedBatter.stats?.avg ?? '—'} · OPS ${selectedBatter.stats?.ops ?? '—'}`} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metric label="PITCHER HAND" value={`${custom.pitcher.pitchHand ?? '—'}HP`} />
              <Metric label="BATTER SIDE" value={`${selectedBatter.batSide ?? '—'}HB`} />
              <Metric label="PITCHER K" value={custom.pitcher.stats?.strikeOuts ?? '—'} />
              <Metric label="BATTER HITS" value={selectedBatter.stats?.hits ?? '—'} />
              <Metric label="BATTER HR" value={selectedBatter.stats?.homeRuns ?? '—'} />
              <Metric label="BATTER SO" value={selectedBatter.stats?.strikeOuts ?? '—'} />
            </div>
            <div className="mt-5 p-4 rounded-lg bg-[#131b2e] text-xs text-[#b9cacb]">{custom.pitcher.name} throws <b>{custom.pitcher.pitchHand === 'R' ? 'right-handed' : custom.pitcher.pitchHand === 'L' ? 'left-handed' : 'with an unavailable hand designation'}</b>. {selectedBatter.name} bats <b>{selectedBatter.batSide === 'R' ? 'right-handed' : selectedBatter.batSide === 'L' ? 'left-handed' : selectedBatter.batSide === 'S' ? 'switch' : 'with an unavailable side'}</b>. These are verified season stats; this panel does not invent direct career BvP numbers.</div>
          </> : <div className="text-center text-[#849495] py-12">Choose a batter from the list to open the pitcher vs batter view.</div>}
        </div>
      </div>}
    </> : <>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131b2e] p-4 rounded-xl border border-[#3b494b]/20">
        <select value={selectedGamePk ?? ''} onChange={(e) => setSelectedGamePk(Number(e.target.value))} className="bg-[#171f33] border border-[#3b494b]/40 text-sm text-[#00f0ff] rounded-lg px-3 py-2">
          {games.map((game) => <option key={game.gamePk} value={game.gamePk}>{game.awayTeam.name} @ {game.homeTeam.name}</option>)}
        </select>
        <button onClick={onOpenReport} className="px-4 py-2 rounded-lg bg-[#00f0ff] text-[#002022] font-bold text-xs">SCOUT REPORT</button>
      </div>

      {selectedGame && <div className="flex items-center justify-center gap-8 bg-[#131b2e] rounded-xl border border-[#3b494b]/20 p-5"><TeamLogo id={selectedGame.awayTeam.id} name={selectedGame.awayTeam.name} /><div className="text-center"><p className="text-xs text-[#849495]">{selectedGame.awayTeam.name}</p><p className="font-display-lg text-2xl text-[#dbfcff]">@</p><p className="text-xs text-[#849495]">{selectedGame.homeTeam.name}</p></div><TeamLogo id={selectedGame.homeTeam.id} name={selectedGame.homeTeam.name} /></div>}

      {analytics && selectedGame && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{analytics.teams.map((team: any) => <div key={team.side} className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><div className="flex justify-between items-start gap-4 mb-4"><div className="flex items-center gap-3"><TeamLogo id={team.teamId} name={team.team} small /><div><span className="text-[10px] text-[#849495]">{team.side.toUpperCase()}</span><h2 className="font-display-lg text-2xl">{team.team}</h2></div></div><div className="flex items-center gap-3 text-right"><PlayerPhoto id={team.pitcher?.id} name={team.pitcher?.name} size="md" /><div><span className="text-[9px] text-[#849495]">STARTER</span><p className="font-bold text-[#dbfcff]">{team.pitcher?.name ?? 'TBD'}</p></div></div></div><div className="space-y-2">{team.matchups.map((matchup: any) => <div key={matchup.batter.id} className="bg-[#131b2e] rounded-lg p-3 flex items-center gap-3"><PlayerPhoto id={matchup.batter.id} name={matchup.batter.name} /><div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{matchup.batter.name}</p><p className="text-[10px] text-[#849495]">{matchup.batter.position || 'H'} · {matchup.batter.batSide ?? '?'}HB · OPS {matchup.batter.stats?.ops ?? '—'}</p></div><div className="w-10 h-10 rounded-full bg-[#222a3d] flex items-center justify-center text-xs font-bold text-[#00f0ff]">{matchup.analysis?.score ?? '—'}</div></div>)}</div></div>)}</div>}
    </>}
  </div>;
};

const PlayerPhoto = ({ id, name, size = 'sm' }: { id?: number; name?: string; size?: 'sm' | 'md' }) => {
  const px = size === 'md' ? 'w-14 h-14' : 'w-10 h-10';
  const [failed, setFailed] = useState(false);
  if (!id || failed) return <div className={`${px} rounded-full bg-[#222a3d] border border-[#3b494b]/30 flex items-center justify-center text-[10px] font-bold text-[#00f0ff] shrink-0`}>{playerInitials(name)}</div>;
  return <img src={mlbPlayerHeadshotUrl(id, size === 'md' ? 160 : 120)} onError={() => setFailed(true)} alt={name ?? 'MLB player'} className={`${px} rounded-full object-cover bg-[#222a3d] border border-[#3b494b]/30 shrink-0`} />;
};
const TeamLogo = ({ id, name, small = false }: { id?: number; name: string; small?: boolean }) => <div className={`${small ? 'w-12 h-12' : 'w-20 h-20'} rounded-2xl bg-white/95 p-2 flex items-center justify-center shrink-0`}><img src={mlbTeamLogoUrl(id)} alt={`${name} logo`} className="max-w-full max-h-full object-contain" /></div>;
const HandBadge = ({ hand, suffix }: { hand?: string | null; suffix: string }) => <span className="px-2 py-1 rounded bg-[#222a3d] text-[#00f0ff] font-bold">{hand ?? '—'}{hand ? suffix : ''}</span>;
const FavoriteButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => <button onClick={onClick} className="px-3 py-2 rounded-lg bg-[#222a3d] text-[#ffd166] text-xs font-bold">{active ? '★ FAVORITED' : `☆ FAVORITE ${label.toUpperCase()}`}</button>;
const PlayerProfile = ({ id, name, subtitle }: { id?: number; name: string; subtitle: string }) => <div className="text-center flex flex-col items-center"><PlayerPhoto id={id} name={name} size="md" /><h3 className="mt-2 font-bold text-[#dbfcff]">{name}</h3><p className="text-[10px] text-[#849495] mt-1">{subtitle}</p></div>;
const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#131b2e] rounded-lg border border-[#3b494b]/20 p-3"><span className="text-[9px] text-[#849495]">{label}</span><p className="font-data-numeric text-xl font-bold text-[#dbfcff] mt-1">{value}</p></div>;
