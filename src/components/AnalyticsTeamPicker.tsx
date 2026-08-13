import React, { useMemo, useState } from 'react';
import { mlbTeamLogoUrl } from '../services/mlbMedia';

export type AnalyticsTeamOption = { id: number; name: string };
type Props = { options: AnalyticsTeamOption[]; value: string; allLabel: string; onChange: (value: string) => void };

export const AnalyticsTeamPicker: React.FC<Props> = ({ options, value, allLabel, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((team) => team.name === value);
  const visible = useMemo(() => { const text = query.trim().toLowerCase(); return text ? options.filter((team) => team.name.toLowerCase().includes(text)) : options; }, [options, query]);
  const choose = (name: string) => { onChange(name); setOpen(false); setQuery(''); };
  return <div className="relative w-full sm:w-[360px]">
    <p className="mb-1.5 text-xs font-extrabold tracking-[.1em] text-[#9dafc3]">SEARCH TEAM</p>
    <button type="button" onClick={() => setOpen((current) => !current)} className="flex h-12 w-full items-center gap-3 rounded-xl border border-[#2b405b] bg-[#10192b] px-3 text-left hover:border-[#00f0ff]/55">
      <span className="material-symbols-outlined text-[20px] text-[#00e6f4]">search</span>
      {selected ? <img src={mlbTeamLogoUrl(selected.id)} alt="" className="h-8 w-8 object-contain" /> : <span className="material-symbols-outlined text-[#9dafc3]">groups</span>}
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{selected?.name ?? allLabel}</span>
      <span className={`material-symbols-outlined text-[20px] text-[#aab8ca] ${open ? 'rotate-180' : ''}`}>expand_more</span>
    </button>
    {open && <div className="absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-[#304765] bg-[#0b1526] shadow-2xl">
      <div className="border-b border-[#26364e] p-3"><div className="flex h-11 items-center gap-2 rounded-lg border border-[#30415c] bg-[#07101d] px-3 focus-within:border-[#00e6f4]"><span className="material-symbols-outlined text-[19px] text-[#00e6f4]">search</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white placeholder:text-[#8293aa] outline-none" /></div></div>
      <div className="max-h-[350px] overflow-y-auto p-1.5">
        <button type="button" onClick={() => choose(allLabel)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#15233a]"><span className="material-symbols-outlined text-[#9dafc3]">groups</span><span className="text-sm font-bold text-white">{allLabel}</span></button>
        {visible.map((team) => <button key={team.id} type="button" onClick={() => choose(team.name)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#15233a]"><img src={mlbTeamLogoUrl(team.id)} alt="" className="h-9 w-9 object-contain" /><span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{team.name}</span>{value === team.name && <span className="material-symbols-outlined text-[18px] text-[#65f2b5]">check</span>}</button>)}
        {!visible.length && <p className="px-4 py-7 text-center text-sm text-[#9dafc3]">No matching teams.</p>}
      </div>
    </div>}
  </div>;
};
