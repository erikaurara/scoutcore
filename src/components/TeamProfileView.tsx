import React, { useEffect, useState } from 'react';
import type { MlbScheduleGame } from '../services/mlbApi';
import { fetchTeamProfile, currentSeason } from '../services/profileClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

interface Props {
  teamId: number | null;
  onOpenPlayer: (playerId: number) => void;
  onOpenGame: (game: MlbScheduleGame) => void;
}

export const TeamProfileView: React.FC<Props> = ({ teamId, onOpenPlayer, onOpenGame }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    fetchTeamProfile(teamId).then(setData).finally(() => setLoading(false));
  }, [teamId]);

  if (!teamId) return <div className="p-4 sm:p-8 text-[#849495]">Search for a team to open a profile.</div>;
  if (loading || !data) return <div className="p-4 sm:p-8 text-[#849495]">Loading team profile…</div>;

  return (
    <div className="px-3 py-4 sm:px-8 sm:py-8 max-w-[1280px] mx-auto space-y-3 sm:space-y-6">
      <section className="bg-[#171f33] border border-[#3b494b]/30 rounded-xl sm:rounded-2xl p-3 sm:p-6 flex items-center gap-3 sm:gap-6">
        <div className="w-16 h-16 sm:w-36 sm:h-36 shrink-0 bg-[#eef1f5] rounded-xl sm:rounded-2xl p-2 sm:p-5"><img src={mlbTeamLogoUrl(data.id)} alt={data.name} className="w-full h-full object-contain" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] sm:text-[11px] tracking-[.16em] sm:tracking-[.18em] text-[#65f2b5] font-mono uppercase">Team Profile</div>
          <h1 className="text-xl sm:text-4xl leading-tight font-bold mt-0.5 sm:mt-1 truncate">{data.name}</h1>
          <div className="text-[11px] sm:text-base text-[#b9cacb] mt-1 sm:mt-2 truncate">{data.division || 'MLB'}{data.venue ? ` · ${data.venue}` : ''}</div>
        </div>
        <div className="text-right shrink-0 pl-1">
          <div className="text-[8px] sm:text-[10px] text-[#849495] uppercase leading-tight">{currentSeason()}<br className="sm:hidden" /> Record</div>
          <div className="text-xl sm:text-4xl font-mono text-[#00f0ff] mt-1 whitespace-nowrap">{data.record}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.1fr_.9fr] gap-3 sm:gap-5">
        <div className="bg-[#171f33] border border-[#3b494b]/30 rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="px-3 py-2.5 sm:p-5 border-b border-[#3b494b]/25 flex items-end justify-between gap-3">
            <div><div className="text-[9px] sm:text-[10px] text-[#00f0ff] uppercase tracking-wider">Active Roster</div><h2 className="text-base sm:text-xl font-semibold">Players</h2></div>
            <div className="text-[10px] text-[#849495] sm:hidden">{data.roster.length} total</div>
          </div>

          <div className="sm:hidden max-h-[350px] overflow-y-auto overscroll-contain touch-pan-y">
            {data.roster.map((p:any) => <button key={p.id} onClick={() => onOpenPlayer(p.id)} className="w-full px-3 py-2 border-b border-[#3b494b]/20 hover:bg-[#222a3d] flex items-center gap-2.5 text-left min-h-[58px]"><img src={mlbPlayerHeadshotUrl(p.id,90)} alt="" className="w-10 h-10 shrink-0 object-contain" /><div className="min-w-0"><div className="font-semibold text-sm truncate">{p.name}</div><div className="text-[10px] text-[#849495]">{p.position}</div></div></button>)}
          </div>

          <div className="hidden sm:grid md:grid-cols-2 sm:max-h-[520px] sm:overflow-y-auto">{data.roster.map((p:any) => <button key={p.id} onClick={() => onOpenPlayer(p.id)} className="p-3 border-b md:border-r border-[#3b494b]/20 hover:bg-[#222a3d] flex items-center gap-3 text-left"><img src={mlbPlayerHeadshotUrl(p.id,90)} alt="" className="w-12 h-12 shrink-0 object-contain" /><div className="min-w-0"><div className="font-semibold text-base truncate">{p.name}</div><div className="text-[11px] text-[#849495]">{p.position}</div></div></button>)}</div>
        </div>

        <div className="bg-[#171f33] border border-[#3b494b]/30 rounded-xl sm:rounded-2xl overflow-hidden h-fit">
          <div className="px-3 py-2.5 sm:p-5 border-b border-[#3b494b]/25"><div className="text-[9px] sm:text-[10px] text-[#65f2b5] uppercase tracking-wider">Schedule</div><h2 className="text-base sm:text-xl font-semibold">Upcoming games</h2></div>
          <div>{data.upcoming.length ? data.upcoming.map((g:any) => <button type="button" key={g.gamePk} onClick={() => onOpenGame(g.game)} className="w-full p-3 sm:p-4 border-b border-[#3b494b]/20 text-left hover:bg-[#1c2639] transition-colors"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="font-semibold text-sm sm:text-base truncate">{g.homeAway === 'HOME' ? 'vs' : '@'} {g.opponent}</div><div className="text-[10px] sm:text-xs text-[#849495] mt-0.5 sm:mt-1 truncate">Probable: {g.probablePitcher}</div><div className="mt-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-[#00f0ff]">Open matchup →</div></div><div className="text-right text-[10px] sm:text-xs shrink-0"><div className="text-[#00f0ff]">{new Date(g.gameDate).toLocaleDateString()}</div><div className="text-[#849495] mt-0.5 sm:mt-1">{g.status}</div></div></div></button>) : <div className="p-4 sm:p-6 text-sm text-[#849495]">No upcoming games found.</div>}</div>
        </div>
      </section>
    </div>
  );
};
