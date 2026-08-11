import React, { useState } from 'react';

export const SettingsView: React.FC = () => {
  const [dataSync, setDataSync] = useState(true);
  const [highLeverageAlerts, setHighLeverageAlerts] = useState(true);
  const [modelMode, setModelMode] = useState('statcast-v4');

  return (
    <div className="flex flex-col w-full min-h-screen bg-[#0b1326] text-[#dae2fd] p-8 gap-8">
      <div className="border-b border-[#3b494b]/20 pb-6">
        <span className="font-label-caps text-xs text-[#00f0ff] uppercase tracking-widest font-bold">
          System Tools
        </span>
        <h1 className="font-display-lg text-[36px] text-[#dae2fd] font-bold leading-tight">
          ScoutCore Settings & Preferences
        </h1>
        <p className="text-sm text-[#b9cacb]">
          Configure data sync frequency, Statcast model parameters, and high-leverage gameday notification triggers.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="p-6 bg-[#171f33] rounded-xl border border-[#3b494b]/20 space-y-4">
          <h2 className="font-headline-lg text-sm uppercase text-[#dae2fd] font-bold">Data Feed & Syncing</h2>
          
          <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20">
            <div>
              <div className="text-xs font-bold text-[#dae2fd]">Live Statcast Auto-Sync</div>
              <div className="text-[10px] text-[#849495]">Synchronize pitch velocity, spin rates, and launch angles in real-time.</div>
            </div>
            <button
              onClick={() => setDataSync(!dataSync)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                dataSync ? 'bg-[#00f0ff]' : 'bg-[#2d3449]'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-[#002022] transform transition-transform ${
                dataSync ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#131b2e] rounded-lg border border-[#3b494b]/20">
            <div>
              <div className="text-xs font-bold text-[#dae2fd]">High-Leverage Signal Alerts</div>
              <div className="text-[10px] text-[#849495]">Notify when pitch-velocity or spin rate deviations cross 1.5 standard deviations.</div>
            </div>
            <button
              onClick={() => setHighLeverageAlerts(!highLeverageAlerts)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                highLeverageAlerts ? 'bg-[#00f0ff]' : 'bg-[#2d3449]'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-[#002022] transform transition-transform ${
                highLeverageAlerts ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        <div className="p-6 bg-[#171f33] rounded-xl border border-[#3b494b]/20 space-y-4">
          <h2 className="font-headline-lg text-sm uppercase text-[#dae2fd] font-bold">Prediction Engine Model</h2>
          
          <div className="space-y-2">
            <label className="block text-xs text-[#849495] font-mono">Active Predictive Algorithm</label>
            <select
              value={modelMode}
              onChange={(e) => setModelMode(e.target.value)}
              className="w-full bg-[#131b2e] border border-[#3b494b]/40 rounded-lg p-3 text-xs font-mono text-[#00f0ff] focus:outline-none"
            >
              <option value="statcast-v4">Statcast v4 (xg wOBA + Stuff+ Neural Net)</option>
              <option value="pitch-fxx">PitchF/X Historical Baseline</option>
              <option value="bayes-leverage">Bayesian High-Leverage Win Probability</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
