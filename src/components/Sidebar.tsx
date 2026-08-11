import React from 'react';
import { NavigationTab } from '../types';
import { LOGO_URL } from '../data/mockData';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSearch: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenSearch }) => {
  const navItems: { id: NavigationTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: 'dashboard' },
    { id: 'matchups', label: 'MATCHUPS (PvB)', icon: 'sports_baseball' },
    { id: 'team-comparison', label: 'TEAM ANALYSIS', icon: 'analytics' },
    { id: 'game-logs', label: 'GAME LOGS', icon: 'history_edu' },
    { id: 'scouting-feed', label: 'SCOUTING FEED', icon: 'rss_feed' },
    { id: 'analytics', label: 'ANALYTICS', icon: 'query_stats' },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-[#131b2e] z-50 flex flex-col border-r border-[#3b494b]/20 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] select-none">
      {/* Brand Header */}
      <div 
        onClick={() => onSelectTab('dashboard')} 
        className="h-16 flex items-center px-6 gap-3 border-b border-[#3b494b]/20 cursor-pointer hover:bg-[#171f33]/50 transition-colors"
      >
        <img 
          src={LOGO_URL} 
          alt="ScoutCore Logo" 
          className="h-8 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]"
        />
        <span className="font-headline-lg text-[20px] text-[#dbfcff] tracking-tight font-bold">
          ScoutCore
        </span>
      </div>

      {/* Quick Search trigger in sidebar */}
      <div className="p-4 border-b border-[#3b494b]/10">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center bg-[#060e20] rounded-xl px-3 py-2 border border-[#3b494b]/30 text-[#849495] hover:text-[#dae2fd] hover:border-[#00f0ff]/50 transition-all text-xs font-mono"
        >
          <span className="material-symbols-outlined text-[18px] mr-2 text-[#00f0ff]">search</span>
          <span className="truncate">Quick Search...</span>
          <kbd className="ml-auto bg-[#171f33] px-1.5 py-0.5 rounded text-[10px] text-[#849495] border border-[#3b494b]/30">⌘K</kbd>
        </button>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 pt-1">
          <span className="text-[10px] text-[#849495] font-label-caps uppercase tracking-wider">CORE MODULES</span>
        </div>

        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group text-left ${
                isActive
                  ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_12px_rgba(0,239,255,0.25)]'
                  : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#00363a]' : 'group-hover:text-[#00f0ff]'}`}>
                {item.icon}
              </span>
              <span className="font-label-caps text-[12px]">{item.label}</span>
            </button>
          );
        })}

        <div className="pt-6 border-t border-[#3b494b]/10 mt-4 mx-2">
          <span className="text-[10px] text-[#849495] px-2 font-label-caps uppercase tracking-wider">SYSTEM TOOLS</span>
        </div>

        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group text-left mt-1 ${
            currentTab === 'settings'
              ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_12px_rgba(0,239,255,0.25)]'
              : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px] group-hover:text-[#00f0ff]">settings</span>
          <span className="font-label-caps text-[12px]">SETTINGS</span>
        </button>
      </nav>

      {/* User profile card */}
      <div className="p-3 bg-[#060e20] m-3 rounded-xl flex items-center gap-3 border border-[#3b494b]/20">
        <div className="w-8 h-8 rounded-full bg-[#00f0ff] flex items-center justify-center text-[#00363a] font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]">
          <span className="material-symbols-outlined text-[18px]">person</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-[#dae2fd] truncate">Lead Scout</span>
          <span className="text-[10px] text-[#849495] uppercase font-label-caps">MLB LEVEL 4 · FRONT OFFICE</span>
        </div>
      </div>
    </aside>
  );
};
