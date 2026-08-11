import React, { useEffect, useState } from 'react';

export const AnalyticsView: React.FC = () => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/today');
      if (!response.ok) throw new Error('Unable to load daily analytics.');
      const data = await response.json();
      setGames(data.games ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const matchupRows = games
    .flatMap((game) => game.teams?.flatMap((team: any) => team.matchups?.map((m: any) => ({ ...m, team: team.team, side: team.side, gamePk: game.gamePk })) ?? []) ?? [])
    .filter((row: any) => row.analysis)
    .sort((a: any, b: any) => b.analysis.score - a.analysis.score);

  const avgScore = matchupRows.length ? matchupRows.reduce((sum: number, row: any) => sum + row.analysis.score, 0) / matchupRows.length : null;
  const avgConfidence = matchupRows.length ? matchupRows.reduce((sum: number, row: any) => sum + row.analysis.confidence, 0) / matchupRows.length : null;

  return <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 space-y-6">
    <div>
      <span className="font-label-caps text-xs text-[#65f2b5]">LIVE MODEL</span>
      <h1 className="font-display-lg text-4xl">Advanced Analytics</h1>
      <p className="text-sm text-[#849495] mt-1">Explainable matchup analysis from verified MLB season and game-feed data.</p>
    </div>

    {error && <div className="p-4 rounded-xl border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 text-[#ffb4ab]">{error}</div>}

    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Metric label="GAMES ANALYZED" value={games.length} />
      <Metric label="MATCHUPS" value={matchupRows.length} />
      <Metric label="AVG SCORE" value={avgScore === null ? '—' : avgScore.toFixed(1)} />
      <Metric label="AVG CONFIDENCE" value={avgConfidence === null ? '—' : `${avgConfidence.toFixed(0)}%`} />
    </div>

    <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5">
      <div className="flex justify-between items-center mb-4">
        <div><span className="text-[10px] text-[#849495]">TOP MATCHUP SIGNALS</span><h2 className="font-headline-lg text-xl">Highest model scores today</h2></div>
        <button onClick={load} className="text-xs text-[#00f0ff]">REFRESH</button>
      </div>

      {loading ? <p className="text-sm text-[#849495]">Calculating…</p> : <div className="space-y-3">
        {matchupRows.slice(0, 15).map((row: any, index: number) => <div key={`${row.gamePk}-${row.batter.id}`} className="bg-[#131b2e] p-4 rounded-lg">
          <div className="grid grid-cols-[32px_1fr_auto_auto] items-center gap-3">
            <span className="text-xs text-[#849495]">#{index + 1}</span>
            <div><p className="text-sm font-bold">{row.batter.name}</p><p className="text-[10px] text-[#849495]">{row.team} · {row.batter.position || 'H'} · OPS {row.analysis.stats.hitter.ops || '—'}</p></div>
            <div className="text-right"><p className="text-[9px] text-[#849495]">INDEX</p><p className="font-bold text-[#00f0ff]">{row.analysis.score}</p></div>
            <div className="text-right"><p className="text-[9px] text-[#849495]">CONF.</p><p className="text-xs text-[#65f2b5]">{row.analysis.confidence}%</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.analysis.components.map((component: any) => <span key={component.name} className="text-[10px] px-2 py-1 rounded-full bg-[#202a40] text-[#aab7d5]">{component.name}: {component.value.toFixed(1)}</span>)}
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#202a40] text-[#aab7d5]">{row.analysis.handedness.label}</span>
          </div>
          <div className="mt-2 text-[10px] text-[#849495]">{row.analysis.handedness.edge ?? 'Handedness context unavailable'} · Data quality: {row.analysis.dataQuality} · {row.analysis.note}</div>
          {row.analysis.pitchUsage.length > 0 && <div className="mt-2 text-[10px] text-[#849495]">Observed pitch mix in current game: {row.analysis.pitchUsage.map((pitch: any) => `${pitch.type} ${pitch.usage}%`).join(' · ')}</div>}
        </div>)}
        {!matchupRows.length && <p className="text-sm text-[#849495]">No verified matchup data is available yet.</p>}
      </div>}
    </div>
  </div>;
};

const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => <div className="bg-[#171f33] rounded-xl border border-[#3b494b]/20 p-5"><span className="text-[10px] text-[#849495]">{label}</span><p className="font-data-numeric text-3xl font-bold text-[#dbfcff] mt-1">{value}</p></div>;
