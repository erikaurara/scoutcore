import React from 'react';
import { NavigationTab } from '../types';
import { LOGO_URL } from '../data/mockData';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenSearch: () => void;
  signedIn: boolean;
  userEmail?: string | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenSearch, signedIn, userEmail, onOpenAuth, onSignOut, mobileOpen = false, onCloseMobile }) => {
  const navItems: { id: NavigationTab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: 'dashboard' },
    { id: 'schedule', label: 'SCHEDULE', icon: 'calendar_month' },
    { id: 'matchups', label: 'MATCHUPS + GAME LOGS', icon: 'sports_baseball' },
    { id: 'team-comparison', label: 'TEAM ANALYSIS', icon: 'analytics' },
    { id: 'scouting-feed', label: 'SCOUTING FEED', icon: 'rss_feed' },
    { id: 'analytics', label: 'ANALYTICS', icon: 'query_stats' },
  ];

  const selectTab = (tab: NavigationTab) => {
    onSelectTab(tab);
    onCloseMobile?.();
  };

  return (
    <>
      {mobileOpen && <button aria-label="Close navigation" onClick={onCloseMobile} className="fixed inset-0 z-40 bg-[#030814]/70 backdrop-blur-sm lg:hidden" />}
      <aside className={`fixed left-0 top-0 h-full w-[86vw] max-w-72 bg-[#131b2e] z-50 flex flex-col border-r border-[#3b494b]/20 shadow-[1px_0_0_0_rgba(255,255,255,0.05)] select-none transform transition-transform duration-200 lg:w-72 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center px-5 sm:px-6 gap-3 border-b border-[#3b494b]/20">
          <button onClick={() => selectTab('dashboard')} className="flex items-center gap-3 min-w-0 hover:opacity-90 transition-opacity">
            <img src={LOGO_URL} alt="ScoutCore Logo" className="h-8 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]" />
            <span className="font-headline-lg text-[20px] text-[#dbfcff] tracking-tight font-bold">ScoutCore</span>
          </button>
          <button onClick={onCloseMobile} aria-label="Close menu" className="ml-auto w-9 h-9 rounded-lg border border-[#31405b] text-[#b9cacb] hover:text-[#00f0ff] lg:hidden flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">close</span></button>
        </div>
        <div className="p-4 border-b border-[#3b494b]/10"><button onClick={() => { onOpenSearch(); onCloseMobile?.(); }} className="w-full flex items-center bg-[#060e20] rounded-xl px-3 py-2.5 border border-[#3b494b]/30 text-[#849495] hover:text-[#dae2fd] hover:border-[#00f0ff]/50 transition-all text-xs font-mono"><span className="material-symbols-outlined text-[18px] mr-2 text-[#00f0ff]">search</span><span className="truncate">Quick Search...</span></button></div>
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 pt-1"><span className="text-[10px] text-[#849495] font-label-caps uppercase tracking-wider">CORE MODULES</span></div>
          {navItems.map((item) => { const isActive = currentTab === item.id; return <button key={item.id} onClick={() => selectTab(item.id)} className={`w-full flex items-center gap-3 px-4 py-3 lg:py-2.5 rounded-xl transition-all group text-left ${isActive ? 'bg-[#00f0ff] text-[#00363a] font-bold shadow-[0_2px_12px_rgba(0,239,255,0.25)]' : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'}`}><span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-[#00363a]' : 'group-hover:text-[#00f0ff]'}`}>{item.icon}</span><span className="font-label-caps text-[12px]">{item.label}</span></button>; })}
          <div className="pt-5 border-t border-[#3b494b]/10 mt-4 mx-2"><span className="text-[10px] text-[#849495] px-2 font-label-caps uppercase tracking-wider">ACCOUNT</span></div>
          <button onClick={() => selectTab('membership')} className={`w-full flex items-center gap-3 px-4 py-3 lg:py-2.5 rounded-xl transition-all group text-left mt-1 ${currentTab === 'membership' ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'}`}><span className="material-symbols-outlined text-[20px]">person_add</span><span className="font-label-caps text-[12px]">UNLOCK MORE</span></button>
          <button onClick={() => selectTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 lg:py-2.5 rounded-xl transition-all group text-left mt-1 ${currentTab === 'settings' ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#b9cacb] hover:bg-[#222a3d] hover:text-[#dae2fd]'}`}><span className="material-symbols-outlined text-[20px]">settings</span><span className="font-label-caps text-[12px]">SETTINGS</span></button>
        </nav>
        {signedIn ? (
          <div className="m-3 rounded-xl border border-[#3b494b]/25 bg-[#060e20] p-3"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-[#00f0ff] flex items-center justify-center text-[#00363a]"><span className="material-symbols-outlined text-[18px]">person</span></div><div className="min-w-0 flex-1"><div className="text-xs font-semibold truncate">{userEmail || 'ScoutCore User'}</div><div className="text-[10px] text-[#65f2b5] uppercase">Account unlocked</div></div></div><button onClick={onSignOut} className="mt-3 w-full text-[10px] uppercase text-[#849495] hover:text-[#00f0ff]">Sign out</button></div>
        ) : (
          <button onClick={() => { onOpenAuth(); onCloseMobile?.(); }} className="m-3 rounded-xl border border-[#00f0ff]/30 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/15 p-3 flex items-center gap-3 text-left"><div className="w-8 h-8 rounded-full bg-[#00f0ff] flex items-center justify-center text-[#00363a]"><span className="material-symbols-outlined text-[18px]">person_add</span></div><div><div className="text-xs font-semibold">Create free account</div><div className="text-[10px] text-[#849495]">Unlock AI, saves and alerts</div></div></button>
        )}
      </aside>
    </>
  );
};
