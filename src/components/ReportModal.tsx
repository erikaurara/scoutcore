import React, { useState } from 'react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
  const [playerName, setPlayerName] = useState('Gerrit Cole');
  const [team, setTeam] = useState('NYY');
  const [opponent, setOpponent] = useState('Boston Red Sox');
  const [extraPrompt, setExtraPrompt] = useState('Focus on 4SFB velocity degradation and slider whiff rates in high leverage.');
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scout-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, team, opponent, extraPrompt }),
      });
      const data = await res.json();
      setReportResult(data.report || 'Report generated successfully.');
    } catch (err) {
      console.error(err);
      setReportResult('Error generating report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div 
        className="bg-[#171f33] border border-[#3b494b]/40 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 bg-[#222a3d] border-b border-[#3b494b]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00f0ff] text-[22px]">smart_toy</span>
            <h2 className="font-headline-lg text-base text-[#dae2fd] font-bold uppercase tracking-wide">
              ScoutCore AI Intelligence Report Generator
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-[#849495] hover:text-[#dae2fd] p-1 rounded-lg hover:bg-[#2d3449] transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Target Player Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff]"
              />
            </div>
            <div>
              <label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Player Team / Code</label>
              <input
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff]"
              />
            </div>
          </div>

          <div>
            <label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Opponent Team</label>
            <input
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg px-3 py-2 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff]"
            />
          </div>

          <div>
            <label className="block font-label-caps text-[10px] text-[#849495] uppercase mb-1">Focus & Scouting Directives</label>
            <textarea
              rows={2}
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg p-3 text-xs font-mono text-[#dae2fd] focus:outline-none focus:border-[#00f0ff] resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 bg-[#00f0ff] text-[#00363a] font-label-caps text-xs uppercase rounded-xl hover:opacity-90 transition-all font-bold flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(0,240,255,0.3)]"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-[#00363a] border-t-transparent animate-spin" />
                <span>Generating Statcast AI Analysis...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">bolt</span>
                <span>Generate Deep Report</span>
              </>
            )}
          </button>

          {reportResult && (
            <div className="mt-6 p-5 bg-[#131b2e] border border-[#00f0ff]/30 rounded-xl space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between pb-2 border-b border-[#3b494b]/30">
                <span className="font-label-caps text-xs text-[#00f0ff] font-bold">SCOUTCORE AI REPORT OUTPUT</span>
                <button
                  onClick={() => navigator.clipboard.writeText(reportResult)}
                  className="text-[10px] font-label-caps bg-[#222a3d] px-2 py-1 rounded text-[#849495] hover:text-[#dae2fd]"
                >
                  Copy Report
                </button>
              </div>
              <div className="text-xs text-[#b9cacb] leading-relaxed whitespace-pre-line font-mono">
                {reportResult}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
