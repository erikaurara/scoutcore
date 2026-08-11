import React, { useState } from 'react';
import { NavigationTab } from '../types';

interface HeaderProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSearch: () => void;
  onOpenReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab, onOpenSearch, onOpenReport }) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const topTabs: { id: NavigationTab; label: string }[] = [
    { id: 'matchups', label: 'Matchups (PvB)' },
    { id: 'team-comparison', label: 'Team Comparison' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'game-logs', label: 'Game Logs' },
  ];

  return (
    <header className="fixed top-0 left-72 right-0 h-16 bg-[#0b1326]/85 backdrop-blur-xl z-40 border-b border-[#3b494b]/20 flex items-center justify-between px-8 select-none">
      {/* Top Nav Sub-links */}
      <nav className="flex items-center gap-6 h-full">
        {topTabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`h-full flex items-center font-label-caps text-[13px] tracking-wider transition-all relative ${
                isActive
                  ? 'text-[#00f0ff] font-bold'
                  : 'text-[#b9cacb] hover:text-[#dae2fd]'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#00f0ff] rounded-t-full shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Generate Report Button */}
        <button
          onClick={onOpenReport}
          className="px-3 py-1.5 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-label-caps flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)]"
        >
          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          <span>AI SCOUT REPORT</span>
        </button>

        <div className="h-6 w-[1px] bg-[#3b494b]/30 mx-1" />

        {/* Action icons */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-[#b9cacb] hover:text-[#00f0ff] transition-colors relative rounded-lg hover:bg-[#222a3d]"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00f0ff]" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#171f33] border border-[#3b494b]/40 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-[#3b494b]/30 mb-3">
                <span className="font-label-caps text-xs text-[#00f0ff] font-bold">LIVE SCOUT ALERTS</span>
                <span className="text-[10px] text-[#849495]">3 New</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <div className="p-2 bg-[#131b2e] rounded-lg text-xs space-y-1 border border-[#3b494b]/20">
                  <div className="text-[#65f2b5] font-semibold flex justify-between">
                    <span>Performance Spike</span>
                    <span className="text-[10px] text-[#849495]">2m ago</span>
                  </div>
                  <p className="text-[#b9cacb]">Jackson Holliday exit velo +4.2 MPH in last 10 PAs.</p>
                </div>
                <div className="p-2 bg-[#131b2e] rounded-lg text-xs space-y-1 border border-[#3b494b]/20">
                  <div className="text-[#00f0ff] font-semibold flex justify-between">
                    <span>Spin Rate Deviation</span>
                    <span className="text-[10px] text-[#849495]">14m ago</span>
                  </div>
                  <p className="text-[#b9cacb]">T. Horton sweeper 2940 RPM confirmed by Triple-A Scout.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSearch}
          className="p-2 text-[#b9cacb] hover:text-[#00f0ff] transition-colors rounded-lg hover:bg-[#222a3d]"
          title="Search (Cmd+K)"
        >
          <span className="material-symbols-outlined text-[20px]">search</span>
        </button>

        {/* Live System Indicator */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#3b494b]/30">
          <span className="text-xs font-label-caps text-[#4edea3] tracking-wide hidden md:inline">
            LIVE SYSTEM: OPTIMAL
          </span>
          <div className="w-2.5 h-2.5 rounded-full bg-[#65f2b5] shadow-[0_0_8px_rgba(101,242,181,0.8)] animate-pulse" />
        </div>
      </div>
    </header>
  );
};
