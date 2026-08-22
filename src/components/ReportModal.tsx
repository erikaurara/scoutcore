import React, { useEffect, useMemo, useState } from 'react';
import { fetchPlayerProfile } from '../services/profileClient';
import { fetchRecentPitchProfile } from '../services/mlbClient';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId?: number | null;
}

type ReportSection = { title: string; lines: string[] };

const MLB_TEAMS = [
  'Arizona Diamondbacks', 'Athletics', 'Atlanta Braves', 'Baltimore Orioles',
  'Boston Red Sox', 'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds',
  'Cleveland Guardians', 'Colorado Rockies', 'Detroit Tigers', 'Houston Astros',
  'Kansas City Royals', 'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins',
  'Milwaukee Brewers', 'Minnesota Twins', 'New York Mets', 'New York Yankees',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals',
];

const normalizeTitle = (raw: string) => raw
  .replace(/^#+\s*/, '')
  .replace(/\*\*/g, '')
  .replace(/:$/, '')
  .trim();

const cleanLine = (raw: string) => raw
  .replace(/^\s*[-*•]\s*/, '')
  .replace(/\*\*/g, '')
  .replace(/^#+\s*/, '')
  .trim();

function parseReport(text: string): ReportSection[] {
  const known = ['QUICK SUMMARY', 'RECENT FORM', 'PITCH MIX / VELOCITY', 'MATCHUP STRENGTHS', 'CONCERNS', 'KEY NUMBERS'];
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const sections: ReportSection[] = [];
  let current: ReportSection = { title: 'SCOUT REPORT', lines: [] };

  for (const raw of lines) {
    if (!raw) continue;
    const candidate = normalizeTitle(raw).toUpperCase();
    const matched = known.find((title) => candidate === title || candidate.includes(title));
    if (matched) {
      if (current.lines.length) sections.push(current);
      current = { title: matched, lines: [] };
      continue;
    }
    const cleaned = cleanLine(raw);
    if (cleaned) current.lines.push(cleaned);
  }

  if (current.lines.length) sections.push(current);
  return sections;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, playerId }) => {
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('');
  const [opponent, setOpponent] = useState('');
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
    if (!isOpen) return;
    setReportResult(null);
    setReportError(null);
    if (!playerId) {
      setPlayerName(''); setTeam(''); setPosition(''); setStats({}); setRecentForm([]); setPitchMix([]);
      return;
    }
    let cancelled = false;
    setContextLoading(true);
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
        } else setPitchMix([]);
      } catch (err: any) {
        if (!cancelled) setReportError(err?.message || 'Unable to load verified MLB data for this player.');
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, playerId]);

  const parsedReport = useMemo(() => reportResult ? parseReport(reportResult) : [], [reportResult]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true); setReportResult(null); setReportError(null);
    try {
      const res = await fetch('/api/scout-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, team, opponent, position, extraPrompt, stats, recentForm, pitchMix }),
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : { error: await res.text() };
      if (!res.ok) throw new Error(data?.error || `AI report request failed (${res.status}).`);
      if (!data?.report) throw new Error('The AI service returned no report.');
      setReportResult(data.report);
    } catch (err: any) {
      console.error(err); setReportError(err?.message || 'Unable to generate the AI Scout Report.');
    } finally { setLoading(false); }
  };

  const opponentTeams = MLB_TEAMS.filter((name) => name !== team);

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#171f33] border border-[#3b494b]/40 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 bg-[#222a3d] border-b border-[#3b494b]/30 flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#00f0ff] text-[22px]">smart_toy</span><div><h2 className="font-headline-lg text-base text-[#dae2fd] font-bold uppercase tracking-wide">IXMetrics AI Scout Report</h2><div className="text-[10px] text-[#849495] mt-0.5">Uses the player and verified MLB data from the profile you already opened.</div></div></div>
          <button onClick={onClose} className="text-[#849495] hover:text-[#dae2fd] p-1 rounded-lg hover:bg-[#2d3449] transition-colors" aria-label="Close report"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {playerId ? <div className="rounded-xl border border-[#65f2b5]/25 bg-[#65f2b5]/5 px-4 py-3 flex items-center justify-between gap-4"><div><div className="text-[10px] uppercase tracking-wider text-[#65f2b5]">Selected Player</div><div className="text-base font-semibold text-[#dae2fd] mt-1">{contextLoading ? 'Loading player…' : playerName}</div>{!contextLoading && team && <div className="text-xs text-[#9aabad] mt-0.5">{team}{position ? ` · ${position}` : ''}</div>}</div>{!contextLoading && <div className="text-[10px] text-[#9fe8c9] border border-[#65f2b5]/20 rounded-full px-2.5 py-1">MLB DATA LOADED</div>}</div> : <div className="rounded-xl border border-[#fbbf24]/25 bg-[#fbbf24]/5 px-4 py-3 text-xs text-[#f5d98b]">Open a player profile first, then click AI Scout Report. IXMetrics will automatically use that player and team.</div>}

          <div><label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Opponent Team <span className="normal-case tracking-normal">(optional)</span></label><div className="relative"><select value={opponent} onChange={(e) => setOpponent(e.target.value)} className="w-full appearance-none bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2.5 pr-10 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff] cursor-pointer"><option value="">Select opponent team</option>{opponentTeams.map((name) => <option key={name} value={name}>{name}</option>)}</select><span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#00f0ff] text-[20px]">keyboard_arrow_down</span></div></div>

          <div><label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">What should IXMetrics focus on?</label><textarea rows={2} value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg p-3 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff] resize-none" /></div>

          <button onClick={handleGenerate} disabled={loading || contextLoading || !playerId || !playerName.trim()} className="w-full py-3 bg-[#00f0ff] disabled:opacity-50 text-[#00363a] font-label-caps text-xs uppercase rounded-xl hover:opacity-90 transition-all font-bold flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,240,255,0.3)]">{loading ? <><span className="w-4 h-4 rounded-full border-2 border-[#00363a] border-t-transparent animate-spin" /><span>Building Scout Report...</span></> : <><span className="material-symbols-outlined text-[18px]">bolt</span><span>Generate Scout Report</span></>}</button>

          {reportError && <div className="p-4 bg-[#301a24] border border-[#fb7185]/35 rounded-xl text-xs leading-relaxed text-[#fecdd3]"><div className="font-bold text-[#fb7185] mb-1">REPORT UNAVAILABLE</div>{reportError}</div>}

          {reportResult && (
            <section className="mt-6 bg-[#0f182b] border border-[#00f0ff]/30 rounded-2xl overflow-hidden animate-in fade-in duration-300">
              <div className="px-5 py-4 border-b border-[#3b494b]/30 flex items-center justify-between gap-4 bg-[#121d33]">
                <div><div className="font-label-caps text-[11px] tracking-[.14em] text-[#00f0ff] font-bold">IXMETRICS AI REPORT</div><div className="text-sm text-[#dae2fd] mt-1">{playerName}{opponent ? ` vs ${opponent}` : ''}</div></div>
                <button onClick={() => navigator.clipboard.writeText(reportResult)} className="text-[10px] font-label-caps bg-[#222a3d] border border-[#3b494b]/30 px-3 py-1.5 rounded-lg text-[#9fb0b2] hover:text-[#dae2fd]">Copy Report</button>
              </div>

              <div className="p-5 grid md:grid-cols-2 gap-4">
                {parsedReport.map((section, index) => (
                  <div key={`${section.title}-${index}`} className={`${section.title === 'QUICK SUMMARY' ? 'md:col-span-2' : ''} rounded-xl border border-[#2c3a52] bg-[#131d31] p-4`}>
                    <div className="flex items-center gap-2 mb-3"><span className="w-1.5 h-1.5 rounded-full bg-[#62ddeb] shadow-[0_0_8px_rgba(98,221,235,.7)]"/><h3 className="text-[11px] uppercase tracking-[.13em] text-[#62ddeb] font-bold">{section.title.replace('PITCH MIX / VELOCITY', 'Pitch Mix & Velocity')}</h3></div>
                    <div className="space-y-2.5 text-[13px] leading-6 text-[#c6d2e6]">
                      {section.lines.map((line, lineIndex) => {
                        const hasLabel = line.includes(':');
                        const [label, ...rest] = hasLabel ? line.split(':') : [line];
                        return hasLabel && rest.length ? (
                          <div key={lineIndex} className="flex gap-2 items-start"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#65f2b5] shrink-0"/><p><span className="font-semibold text-[#e3e9f8]">{label.trim()}:</span>{' '}{rest.join(':').trim()}</p></div>
                        ) : (
                          <p key={lineIndex}>{line}</p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
