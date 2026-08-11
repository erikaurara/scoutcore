import React, { useState } from 'react';

export const AnalyticsView: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'xwoba' | 'spin' | 'stuff'>('xwoba');

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3b494b]/20 pb-6">
        <div>
          <span className="font-label-caps text-xs text-[#65f2b5] uppercase tracking-widest font-bold">
            STATCAST DEEP DIVE
          </span>
          <h1 className="font-display-lg text-[36px] text-[#dae2fd] font-bold leading-tight">
            Advanced Sabermetric Analytics
          </h1>
          <p className="text-sm text-[#b9cacb]">
            High-frequency tracking metrics, pitch movement profiles, and expected outcome distributions.
          </p>
        </div>

        <div className="flex bg-[#131b2e] p-1.5 rounded-xl border border-[#3b494b]/30">
          <button
            onClick={() => setSelectedMetric('xwoba')}
            className={`px-4 py-2 rounded-lg text-xs font-label-caps transition-all ${
              selectedMetric === 'xwoba' ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#849495]'
            }`}
          >
            xwOBA vs ERA
          </button>
          <button
            onClick={() => setSelectedMetric('spin')}
            className={`px-4 py-2 rounded-lg text-xs font-label-caps transition-all ${
              selectedMetric === 'spin' ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#849495]'
            }`}
          >
            Spin Efficiency
          </button>
          <button
            onClick={() => setSelectedMetric('stuff')}
            className={`px-4 py-2 rounded-lg text-xs font-label-caps transition-all ${
              selectedMetric === 'stuff' ? 'bg-[#00f0ff] text-[#00363a] font-bold' : 'text-[#849495]'
            }`}
          >
            Stuff+ / Location+
          </button>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-[#171f33] p-6 rounded-xl border border-[#3b494b]/20 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-headline-lg text-sm uppercase text-[#dae2fd] font-bold">
              Pitch Movement Profile (Vertical vs Horizontal Break)
            </h3>
            <span className="font-label-caps text-xs text-[#00f0ff]">PITCHER: GERRIT COLE</span>
          </div>

          {/* Interactive Plot Canvas Placeholder / Visualizer */}
          <div className="w-full h-80 bg-[#060e20] rounded-lg border border-[#3b494b]/30 relative flex items-center justify-center p-6 overflow-hidden">
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-6 opacity-15 pointer-events-none">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="border border-[#3b494b]" />
              ))}
            </div>

            {/* Axes */}
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#3b494b]/60" />
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#3b494b]/60" />

            {/* Pitch Clusters */}
            <div className="absolute top-12 left-[62%] w-6 h-6 rounded-full bg-[#00f0ff]/60 border border-[#00f0ff] flex items-center justify-center text-[9px] font-mono text-[#002022] font-bold shadow-[0_0_12px_rgba(0,240,255,0.8)]">
              4SFB
            </div>
            <div className="absolute top-36 left-[32%] w-6 h-6 rounded-full bg-[#b9c8de]/60 border border-[#b9c8de] flex items-center justify-center text-[9px] font-mono text-[#0d1c2d] font-bold">
              SL
            </div>
            <div className="absolute bottom-12 left-[42%] w-6 h-6 rounded-full bg-[#65f2b5]/60 border border-[#65f2b5] flex items-center justify-center text-[9px] font-mono text-[#003824] font-bold">
              KC
            </div>
            <div className="absolute top-28 right-[24%] w-6 h-6 rounded-full bg-[#ffb4ab]/60 border border-[#ffb4ab] flex items-center justify-center text-[9px] font-mono text-[#690005] font-bold">
              CH
            </div>

            <span className="absolute bottom-2 right-4 text-[10px] font-mono text-[#849495]">Horizontal Break (Inches) →</span>
            <span className="absolute top-4 left-2 text-[10px] font-mono text-[#849495] -rotate-90 origin-top-left">↑ Induced Vertical Break</span>
          </div>

          <div className="flex justify-around text-xs font-mono pt-2">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#00f0ff]" /> 4SFB: 18.4" VBreak / 97.4 MPH</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#b9c8de]" /> SL: 4.2" VBreak / 88.6 MPH</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#65f2b5]" /> KC: -11.2" VBreak / 83.1 MPH</div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-[#171f33] p-6 rounded-xl border border-[#3b494b]/20 shadow-xl space-y-6">
          <h3 className="font-headline-lg text-sm uppercase text-[#dae2fd] font-bold">
            Pitch Run Value Leaders
          </h3>

          <div className="space-y-4 font-mono text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[#dae2fd]">4-Seam Fastball</span>
                <span className="text-[#00f0ff] font-bold">+18 RV</span>
              </div>
              <div className="h-2 bg-[#060e20] rounded-full overflow-hidden">
                <div className="h-full bg-[#00f0ff] w-[88%]" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[#dae2fd]">Sweeper</span>
                <span className="text-[#65f2b5] font-bold">+14 RV</span>
              </div>
              <div className="h-2 bg-[#060e20] rounded-full overflow-hidden">
                <div className="h-full bg-[#65f2b5] w-[74%]" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[#dae2fd]">Knuckle Curve</span>
                <span className="text-[#b9c8de] font-bold">+9 RV</span>
              </div>
              <div className="h-2 bg-[#060e20] rounded-full overflow-hidden">
                <div className="h-full bg-[#b9c8de] w-[58%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
