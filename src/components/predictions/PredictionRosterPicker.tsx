import React, { useEffect, useMemo, useState } from 'react';
import { mlbPlayerHeadshotUrl } from '../../services/mlbMedia';
import { LocalizedPlayerName, useLocalizedPlayerName } from '../LocalizedPlayerName';

export type PredictionPlayerChoice = {
  id: number;
  name: string;
  position?: string;
  group: 'hitting' | 'pitching';
  currentTeam?: { id: number; name: string } | null;
};

const MLB_API = 'https://statsapi.mlb.com/api/v1';

async function fetchRoster(teamId: number, teamName: string, group?: 'hitting' | 'pitching'): Promise<PredictionPlayerChoice[]> {
  const response = await fetch(`${MLB_API}/teams/${teamId}/roster?rosterType=active`);
  if (!response.ok) throw new Error(`MLB roster request failed (${response.status})`);
  const data = await response.json();
  return (data?.roster ?? []).filter((entry: any) => entry?.person?.id).map((entry: any) => {
    const position = String(entry?.position?.abbreviation ?? '');
    const playerGroup: 'hitting' | 'pitching' = position === 'P' ? 'pitching' : 'hitting';
    return {
      id: Number(entry.person.id),
      name: entry.person.fullName ?? 'MLB Player',
      position,
      group: playerGroup,
      currentTeam: { id: teamId, name: teamName },
    } as PredictionPlayerChoice;
  }).filter((row: PredictionPlayerChoice) => !group || row.group === group).sort((a: PredictionPlayerChoice, b: PredictionPlayerChoice) => a.name.localeCompare(b.name));
}

export function PredictionRosterPicker({ label, value, onPick, teamId, teamName, group }: { label: string; value: PredictionPlayerChoice | null; onPick: (value: PredictionPlayerChoice | null) => void; teamId: number | null; teamName?: string | null; group?: 'hitting' | 'pitching' }) {
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState<PredictionPlayerChoice[]>([]);
  const [open, setOpen] = useState(false);
  const [browse, setBrowse] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedName = useLocalizedPlayerName(value?.id, value?.name);

  useEffect(() => setQuery(value?.name ?? ''), [value?.id]);
  useEffect(() => {
    let cancelled = false;
    if (!teamId || !teamName) { setRoster([]); return; }
    setLoading(true);
    fetchRoster(teamId, teamName, group).then(rows => { if (!cancelled) setRoster(rows); }).catch(() => { if (!cancelled) setRoster([]); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [teamId, teamName, group]);

  const choices = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (browse || !text || text === value?.name?.toLowerCase()) return roster;
    return roster.filter(row => row.name.toLowerCase().includes(text) || String(row.position ?? '').toLowerCase().includes(text));
  }, [roster, query, browse, value?.name]);

  const disabled = !teamId;
  return <div className="relative min-w-0">
    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="text-[#b8c6d8]">{label}</span>{teamName && <span className="truncate font-bold text-[#59e8f3]">{teamName} ONLY</span>}</div>
    <div className="relative">
      {value ? <span className="absolute left-2 top-1.5 h-7 w-7 overflow-hidden rounded bg-[#f2f4f8]"><img src={mlbPlayerHeadshotUrl(value.id,80)} alt="" className="h-full w-full object-contain"/></span> : <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-2.5 text-[17px] text-[#71839a]">search</span>}
      <input disabled={disabled} value={query} onFocus={() => { setBrowse(false); setOpen(true); }} onChange={e => { setQuery(e.target.value); setBrowse(false); setOpen(true); if (!e.target.value.trim() || (value && e.target.value !== value.name)) onPick(null); }} placeholder={disabled ? 'Choose opponent first' : `Search ${teamName ?? ''} players`} className={`h-10 w-full rounded-lg border border-[#30415c] bg-[#091427] pr-10 text-sm font-semibold text-white placeholder:text-[#71839a] outline-none focus:border-[#00e6f4] disabled:cursor-not-allowed disabled:opacity-50 ${value ? 'pl-11' : 'pl-9'}`}/>
      <button type="button" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => { setBrowse(true); setOpen(current => !current); }} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded text-[#c1cede] hover:bg-[#17263b] hover:text-white disabled:opacity-30"><span className={`material-symbols-outlined text-[20px] ${open && browse ? 'rotate-180' : ''}`}>expand_more</span></button>
    </div>
    {value && selectedName.isLocalized && <div className="mt-1 text-xs text-[#dce8f6]">{selectedName.displayName}<span className="ml-2 text-[#8fa0b7]">{selectedName.officialName}</span></div>}
    {open && !disabled && <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[#30415c] bg-[#111b2f] shadow-2xl">
      {loading && <div className="px-3 py-3 text-sm text-[#aab8ca]">Loading roster…</div>}
      {!loading && choices.slice(0,40).map(row => <button key={row.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(row); setQuery(row.name); setOpen(false); setBrowse(false); }} className="flex w-full items-center gap-3 border-b border-[#26354d] px-3 py-2 text-left last:border-b-0 hover:bg-[#18263d]"><img src={mlbPlayerHeadshotUrl(row.id,80)} alt="" className="h-9 w-9 rounded bg-[#f2f4f8] object-contain"/><span className="min-w-0"><LocalizedPlayerName playerId={row.id} englishName={row.name} className="block truncate text-sm font-bold text-white" secondaryClassName="mt-0.5"/><span className="text-xs text-[#a5b4c7]">{row.position ?? '—'} · {row.currentTeam?.name}</span></span></button>)}
      {!loading && !choices.length && <div className="px-3 py-3 text-sm text-[#aab8ca]">No matching players.</div>}
    </div>}
  </div>;
}
