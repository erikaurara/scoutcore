import React, { useState, useEffect, useMemo } from 'react';
import { NavigationTab, MatchupCardData } from '../types';
import { fetchTeams, searchMlbPitchers } from '../services/mlbClient';
import { mlbPlayerHeadshotUrl, mlbTeamLogoUrl } from '../services/mlbMedia';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMatchup: (m: MatchupCardData) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ isOpen, onClose, onSelectTab }) => {
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState<any[]>([]);
  const [pitchers, setPitchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTeams().then(setTeams).catch(() => setTeams([]));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) { setQuery(''); setPitchers([]); return; }
    const q = query.trim();
    if (q.length < 2) { setPitchers([]); setLoading(false); return; }
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchMlbPitchers(q).then(setPitchers).catch(() => setPitchers([])).finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, isOpen]);

  const matchingTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return teams.filter((team) => `${team.name} ${team.abbreviation ?? ''}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [query, teams]);

  if (!isOpen) return null;
  const hasResults = matchingTeams.length > 0 || pitchers.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="bg-[#171f33] border border-[#3b494b]/40 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#3b494b]/30 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#00f0ff]">search</span>
          <input type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search MLB teams or pitchers..." className="w-full bg-transparent text-sm font-mono text-[#dae2fd] placeholder:text-[#849495] outline-none" />
          <button onClick={onClose} aria-label="Close search" title="Close" className="w-8 h-8 shrink-0 rounded-full bg-[#222a3d] text-[#b9cacb] hover:text-white hover:bg-[#2c374e] text-xl leading-none flex items-center justify-center">×</button>
        </div>

        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
          {matchingTeams.map((team) => (
            <button key={`team-${team.id}`} onClick={() => { onSelectTab('team-comparison'); onClose(); }} className="w-full p-3 bg-[#131b2e] hover:bg-[#222a3d] rounded-xl flex items-center justify-between text-left transition-colors border border-[#3b494b]/20 group">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-white/95 p-1.5"><img src={mlbTeamLogoUrl(team.id)} alt="" className="w-full h-full object-contain" /></div><div><div className="text-sm font-bold text-[#dae2fd] group-hover:text-[#00f0ff]">{team.name}</div><div className="text-[10px] text-[#849495]">MLB TEAM{team.abbreviation ? ` · ${team.abbreviation}` : ''}</div></div></div>
              <span className="material-symbols-outlined text-[#849495] group-hover:text-[#00f0ff] text-[18px]">arrow_forward</span>
            </button>
          ))}

          {pitchers.map((player) => (
            <button key={`pitcher-${player.id}`} onClick={() => { onSelectTab('matchups'); onClose(); }} className="w-full p-3 bg-[#131b2e] hover:bg-[#222a3d] rounded-xl flex items-center justify-between text-left transition-colors border border-[#3b494b]/20 group">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-[#222a3d] overflow-hidden"><img src={mlbPlayerHeadshotUrl(player.id,120)} alt={player.name} className="w-full h-full object-contain" /></div><div><div className="text-sm font-bold text-[#dae2fd] group-hover:text-[#00f0ff]">{player.name}</div><div className="text-[10px] text-[#849495]">PITCHER{player.currentTeam?.name ? ` · ${player.currentTeam.name}` : ''}</div></div></div>
              <span className="material-symbols-outlined text-[#849495] group-hover:text-[#00f0ff] text-[18px]">arrow_forward</span>
            </button>
          ))}

          {query.trim().length < 2 ? <div className="p-6 text-center text-xs text-[#849495]">Type at least 2 letters to search MLB teams and pitchers.</div> : loading ? <div className="p-6 text-center text-xs text-[#849495]">Searching MLB data…</div> : !hasResults ? <div className="p-6 text-center text-xs text-[#849495]">No MLB teams or pitchers found for “{query}”.</div> : null}
        </div>
      </div>
    </div>
  );
};
