import React, { useEffect, useState } from 'react';
import { fetchTeamProfile, currentSeason } from '../services/profileClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

interface Props { teamId: number | null; onOpenPlayer: (playerId: number) => void; }

export const TeamProfileView: React.FC<Props> = ({ teamId, onOpenPlayer }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    fetchTeamProfile(teamId).then(setData).finally(() => setLoading(false));
  }, [teamId]);

  if (!teamId) return <div className="p-8 text-[#849495]">Search for a team to open a profile.</div>;
  if (loading || !data) return <div className="p-8 text-[#849495]">Loading team profile…</div>;

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto space-y-6">
      <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl p-6 flex items-center gap-6">
        <div className="w-36 h-36 bg-[#eef1f5] rounded-2xl p-5"><img src={mlbTeamLogoUrl(data.id)} alt={data.name} className="w-full h-full object-contain" /></div>
        <div className="flex-1"><div className="text-[11px] tracking-[.18em] text-[#65f2b5] font-mono uppercase">Team Profile</div><h1 className="text-4xl font-bold mt-1">{data.name}</h1><div className="text-[#b9cacb] mt-2">{data.division || 'MLB'}{data.venue ? ` · ${data.venue}` : ''}</div></div>
        <div className="text-right"><div className="text-[10px] text-[#849495] uppercase">{currentSeason()} Record</div><div className="text-4xl font-mono text-[#00f0ff] mt-1">{data.record}</div></div>
      </section>

      <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-5">
        <div className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#3b494b]/25"><div className="text-[10px] text-[#00f0ff] uppercase tracking-wider">Active Roster</div><h2 className="text-xl font-semibold">Players</h2></div>
          <div className="grid md:grid-cols-2 max-h-[520px] overflow-y-auto">{data.roster.map((p:any) => <button key={p.id} onClick={() => onOpenPlayer(p.id)} className="p-3 border-b border-r border-[#3b494b]/20 hover:bg-[#222a3d] flex items-center gap-3 text-left"><img src={mlbPlayerHeadshotUrl(p.id,90)} className="w-12 h-12 object-contain" /><div><div className="font-semibold">{p.name}</div><div className="text-[11px] text-[#849495]">{p.position}</div></div></button>)}</div>
        </div>
        <div className="bg-[#171f33] border border-[#3b494b]/30 rounded-2xl overflow-hidden h-fit">
          <div className="p-5 border-b border-[#3b494b]/25"><div className="text-[10px] text-[#65f2b5] uppercase tracking-wider">Schedule</div><h2 className="text-xl font-semibold">Upcoming games</h2></div>
          <div>{data.upcoming.length ? data.upcoming.map((g:any) => <div key={g.gamePk} className="p-4 border-b border-[#3b494b]/20"><div className="flex justify-between gap-3"><div><div className="font-semibold">{g.homeAway === 'HOME' ? 'vs' : '@'} {g.opponent}</div><div className="text-xs text-[#849495] mt-1">Probable: {g.probablePitcher}</div></div><div className="text-right text-xs"><div className="text-[#00f0ff]">{new Date(g.gameDate).toLocaleDateString()}</div><div className="text-[#849495] mt-1">{g.status}</div></div></div></div>) : <div className="p-6 text-[#849495]">No upcoming games found.</div>}</div>
        </div>
      </section>
    </div>
  );
};
