import React, { useEffect, useState } from 'react';
import { searchMlbPlayers } from '../../services/profileClient';
import { mlbPlayerHeadshotUrl } from '../../services/mlbMedia';
import type { PredictionPlayer } from './predictionModel';

export function PredictionPlayerSearch({ value, onPick }: { value: PredictionPlayer | null; onPick: (value: PredictionPlayer) => void }) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<PredictionPlayer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(value?.name ?? ''), [value?.id]);
  useEffect(() => {
    const text = query.trim();
    if (!open || text.length < 2 || text === value?.name) { setResults([]); return; }
    const timer = window.setTimeout(() => {
      searchMlbPlayers(text).then((rows: any[]) => setResults(rows as PredictionPlayer[])).catch(() => setResults([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, open, value?.name]);

  return <div className="relative">
    <label className="mb-1.5 block text-[10px] text-[#c2cede]">PLAYER</label>
    <div className="relative">
      <input value={query} onFocus={() => setOpen(true)} onChange={e => { setQuery(e.target.value); setOpen(true); }} placeholder="Select player" className={`h-11 w-full rounded-lg border border-[#30415c] bg-[#091427] pr-3 text-sm font-bold text-white placeholder:text-[#71839a] outline-none focus:border-[#00e6f4] ${value ? 'pl-11' : 'pl-3'}`}/>
      {value && <span className="absolute left-3 top-2.5 h-6 w-6 overflow-hidden rounded bg-[#f2f4f8]"><img src={mlbPlayerHeadshotUrl(value.id,80)} alt="" className="h-full w-full object-contain"/></span>}
    </div>
    {open && results.length > 0 && <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#30415c] bg-[#111b2f] shadow-2xl">
      {results.slice(0,15).map(row => <button type="button" key={row.id} onMouseDown={e => e.preventDefault()} onClick={() => { onPick(row); setQuery(row.name); setOpen(false); }} className="flex w-full items-center gap-3 border-b border-[#26354d] px-3 py-2 text-left last:border-b-0 hover:bg-[#18263d]"><img src={mlbPlayerHeadshotUrl(row.id,80)} alt="" className="h-9 w-9 rounded bg-[#f2f4f8] object-contain"/><span><b className="block text-xs text-white">{row.name}</b><span className="text-[10px] text-[#a5b4c7]">{row.position ?? '—'}{row.currentTeam?.name ? ` · ${row.currentTeam.name}` : ''}</span></span></button>)}
    </div>}
  </div>;
}
