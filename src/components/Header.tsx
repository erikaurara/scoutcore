import React, { useState } from 'react';
import { NavigationTab } from '../types';
import { LOGO_URL } from '../data/mockData';

interface HeaderProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSearch: () => void;
  onOpenReport: () => void;
  onBack?: () => void;
  onOpenMobileNav?: () => void;
  signedIn?: boolean;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onOpenReport, onBack, onOpenMobileNav, signedIn = false, onOpenAuth }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const isProfilePage = currentTab === 'player-profile' || currentTab === 'team-profile';
  const showAiScoutReport = currentTab === 'player-profile';

  return (
    <header className="fixed top-0 left-0 right-0 lg:left-72 h-16 bg-[#0b1326]/95 backdrop-blur-xl z-40 border-b border-[#3b494b]/20 flex items-center justify-between px-3 sm:px-4 lg:px-8 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={onOpenMobileNav} aria-label="Open menu" className="w-10 h-10 rounded-xl border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:text-[#00f0ff] lg:hidden flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>
        <div className="lg:hidden flex items-center gap-2 min-w-0">
          <img src={LOGO_URL} alt="ScoutCoreMLB" className="h-7 w-7 object-contain shrink-0" />
          <span className="font-headline-lg font-bold text-[#dbfcff] truncate text-sm sm:text-base">ScoutCoreMLB</span>
        </div>
        {isProfilePage && onBack && (
          <button onClick={onBack} aria-label="Go back" title="Go back" className="w-9 h-9 rounded-lg border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:text-[#62ddeb] hover:border-[#62ddeb]/70 hover:bg-[#17233a] transition-all hidden lg:flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 shrink-0">
        {isProfilePage && onBack && (
          <button onClick={onBack} aria-label="Go back" className="w-9 h-9 rounded-lg border border-[#31405b] bg-[#111a2d] text-[#b9cacb] hover:text-[#62ddeb] lg:hidden flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
        )}
        {showAiScoutReport && (
          <button onClick={onOpenReport} className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 text-xs font-label-caps flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)]">
            <span className="material-symbols-outlined text-[16px]">smart_toy</span>
            <span className="hidden sm:inline">AI SCOUT REPORT</span>
            <span className="sm:hidden">AI</span>
          </button>
        )}
        {!signedIn && onOpenAuth && (
          <button
            type="button"
            onClick={onOpenAuth}
            className="h-9 rounded-lg border border-[#00f0ff]/35 bg-[#00f0ff]/10 px-2.5 sm:px-3 text-[#00f0ff] hover:bg-[#00f0ff]/18 transition-all flex items-center gap-1.5"
            title="Log in"
            aria-label="Log in"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span className="hidden sm:inline text-[11px] font-label-caps font-bold tracking-wide">LOG IN</span>
          </button>
        )}
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} className="w-9 h-9 text-[#b9cacb] hover:text-[#00f0ff] transition-colors relative rounded-lg hover:bg-[#222a3d] flex items-center justify-center" title="Notifications">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#00f0ff]" />
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-80 bg-[#171f33] border border-[#3b494b]/40 rounded-xl shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-[#3b494b]/30 mb-3"><span className="font-label-caps text-xs text-[#00f0ff] font-bold">LIVE SCOUT ALERTS</span><span className="text-[10px] text-[#849495]">3 New</span></div>
              <div className="space-y-2"><div className="p-2 bg-[#131b2e] rounded-lg text-xs border border-[#3b494b]/20"><div className="text-[#65f2b5] font-semibold">Performance Spike</div><p className="text-[#b9cacb] mt-1">Recent performance signal detected from verified game data.</p></div></div>
            </div>
          )}
        </div>
        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-[#3b494b]/30"><span className="text-xs font-label-caps text-[#4edea3] tracking-wide">LIVE SYSTEM: OPTIMAL</span><div className="w-2.5 h-2.5 rounded-full bg-[#65f2b5] shadow-[0_0_8px_rgba(101,242,181,0.8)] animate-pulse" /></div>
      </div>
    </header>
  );
};
