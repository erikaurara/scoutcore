import React, { useState, useEffect } from 'react';
import { samplePlayers, sampleMatchups } from '../data/mockData';
import { NavigationTab, MatchupCardData } from '../types';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: NavigationTab) => void;
  onSelectMatchup: (m: MatchupCardData) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onSelectMatchup,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const playerList = Object.values(samplePlayers);
  const matchingPlayers = playerList.filter(
    (p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.team.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-start justify-center pt-24 px-4">
      <div 
        className="bg-[#171f33] border border-[#3b494b]/40 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#3b494b]/30 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#00f0ff]">search</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, teams, matchups, or game logs..."
            className="w-full bg-transparent text-sm font-mono text-[#dae2fd] placeholder:text-[#849495] outline-none"
          />
          <button 
            onClick={onClose}
            className="text-xs bg-[#222a3d] px-2 py-1 rounded text-[#849495] hover:text-[#dae2fd]"
          >
            ESC
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-3 space-y-2">
          {matchingPlayers.length > 0 ? (
            matchingPlayers.map((player) => (
              <div
                key={player.id}
                onClick={() => {
                  onSelectTab('matchups');
                  onClose();
                }}
                className="p-3 bg-[#131b2e] hover:bg-[#222a3d] rounded-xl flex items-center justify-between cursor-pointer transition-colors border border-[#3b494b]/20 group"
              >
                <div className="flex items-center gap-3">
                  <img src={player.avatarUrl} alt={player.name} className="w-10 h-10 rounded-lg object-cover border border-[#00f0ff]/30" />
                  <div>
                    <div className="text-xs font-bold text-[#dae2fd] group-hover:text-[#00f0ff]">{player.name}</div>
                    <div className="text-[10px] font-mono text-[#849495]">{player.team} · {player.position} · {player.number}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#849495] group-hover:text-[#00f0ff] text-[18px]">
                  arrow_forward
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-xs text-[#849495]">
              No direct matches found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
