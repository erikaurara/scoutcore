import React, { useEffect, useState } from 'react';
import { fetchPlayerProfile } from '../services/profileClient';
import { fetchRecentPitchProfile } from '../services/mlbClient';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId?: number | null;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, playerId }) => {
  const [playerName, setPlayerName] = useState('Gerrit Cole');
  const [team, setTeam] = useState('NYY');
  const [opponent, setOpponent] = useState('Boston Red Sox');
  const [position, setPosition] = useState('');
  const [stats, setStats] = useState<any>({});
  const [recentForm, setRecentForm] = useState<any[]>([]);
  const [pitchMix, setPitchMix] = useState<any[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState('Summarize recent form, key strengths, concerns, and the most important matchup notes.');
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !playerId) return;
    let cancelled = false;
    setContextLoading(true);
    setReportResult(null);
    setReportError(null);

    (async () => {
      try {
        const profile = await fetchPlayerProfile(playerId);
        if (cancelled) return;
        setPlayerName(profile.name);
        setTeam(profile.team?.name || '');
        setPosition(profile.position || '');
        setStats(profile.season || {});
        setRecentForm((profile.logs || []).slice(0, 10));

        if (profile.group === 'pitching') {
          const pitches = await fetchRecentPitchProfile(playerId, 5).catch(() => []);
          if (!cancelled) setPitchMix(pitches || []);
        } else {
          setPitchMix([]);
        }
      } catch (err: any) {
        if (!cancelled) setReportError(err?.message || 'Unable to load verified MLB data for this player.');
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, playerId]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setReportResult(null);
    setReportError(null);
    try {
      const res = await fetch('/api/scout-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, team, opponent, position, extraPrompt, stats, recentForm, pitchMix }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : { error: await res.text() };
      if (!res.ok) throw new Error(data?.error || `AI report request failed (${res.status}).`);
      if (!data?.report) throw new Error('The AI service returned no report.');
      setReportResult(data.report);
    } catch (err: any) {
      console.error(err);
      setReportError(err?.message || 'Unable to generate the AI Scout Report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#171f33] border border-[#3b494b]/40 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 bg-[#222a3d] border-b border-[#3b494b]/30 flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#00f0ff] text-[22px]">smart_toy</span><div><h2 className="font-headline-lg text-base text-[#dae2fd] font-bold uppercase tracking-wide">ScoutCore AI Scout Report</h2><div className="text-[10px] text-[#849495] mt-0.5">Uses verified ScoutCore / MLB data when a player profile is open.</div></div></div>
          <button onClick={onClose} className="text-[#849495] hover:text-[#dae2fd] p-1 rounded-lg hover:bg-[#2d3449] transition-colors" aria-label="Close report"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {playerId && <div className="rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/5 px-3 py-2 text-[11px] text-[#9fe8c9]">{contextLoading ? 'Loading verified player data…' : `Verified MLB data loaded for ${playerName}.`}</div>}

          <div className="grid grid-cols-2 gap-4"><div><label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Target Player</label><input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff]" /></div><div><label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Player Team</label><input type="text" value={team} onChange={(e) => setTeam(e.target.value)} className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff]" /></div></div>

          <div><label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Opponent Team</label><input type="text" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Optional" className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff]" /></div>
          <div><label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">What should ScoutCore focus on?</label><textarea rows={2} value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg p-3 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff] resize-none" /></div>

          <button onClick={handleGenerate} disabled={loading || contextLoading || !playerName.trim()} className="w-full py-3 bg-[#00f0ff] disabled:opacity-50 text-[#00363a] font-label-caps text-xs uppercase rounded-xl hover:opacity-90 transition-all font-bold flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,240,255,0.3)]">{loading ? <><span className="w-4 h-4 rounded-full border-2 border-[#00363a] border-t-transparent animate-spin" /><span>Building Scout Report...</span></> : <><span className="material-symbols-outlined text-[18px]">bolt</span><span>Generate Scout Report</span></>}</button>

          {reportError && <div className="p-4 bg-[#301a24] border border-[#fb7185]/35 rounded-xl text-xs leading-relaxed text-[#fecdd3]"><div className="font-bold text-[#fb7185] mb-1">REPORT UNAVAILABLE</div>{reportError}</div>}

          {reportResult && <div className="mt-6 p-5 bg-[#131b2e] border border-[#00f0ff]/30 rounded-xl space-y-3 animate-in fade-in duration-300"><div className="flex items-center justify-between pb-2 border-b border-[#3b494b]/30"><span className="font-label-caps text-xs text-[#00f0ff] font-bold">SCOUTCORE AI REPORT</span><button onClick={() => navigator.clipboard.writeText(reportResult)} className="text-[10px] font-label-caps bg-[#222a3d] px-2 py-1 rounded text-[#849495] hover:text-[#dae2fd]">Copy Report</button></div><div className="text-xs text-[#b9cacb] leading-relaxed whitespace-pre-line font-mono">{reportResult}</div></div>}
        </div>
      </div>
    </div>
  );
};
