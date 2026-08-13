import React from 'react';

type Props = { feed: any };
const teamShort = (team: any) => team?.abbreviation ?? team?.teamName ?? team?.name ?? 'TEAM';

export const LiveBoxScoreLineHeader: React.FC<Props> = ({ feed }) => {
  const game = feed?.gameData ?? {};
  const line = feed?.liveData?.linescore ?? {};
  const innings = Array.isArray(line?.innings) ? line.innings : [];
  const away = game?.teams?.away ?? {};
  const home = game?.teams?.home ?? {};
  return <div className="sc-live-box-line fixed right-0 top-0 z-[410] w-[min(620px,94vw)] border-b border-[#3b474e] bg-[#121a1f] px-4 py-3 text-[#f2f5f7] shadow-xl">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-[#aeb9bf]"><tr><th className="w-24 text-left">TEAM</th>{Array.from({ length: 9 }, (_, index) => <th key={index} className="px-1 text-center">{index + 1}</th>)}<th className="px-2 text-center">R</th><th className="text-center">H</th><th className="text-center">E</th></tr></thead>
        <tbody>{([['away', away], ['home', home]] as [string, any][]).map(([side, team]) => <tr key={side}><td className="py-1.5 font-extrabold">{teamShort(team)}</td>{Array.from({ length: 9 }, (_, index) => <td key={index} className="px-1 text-center font-mono">{innings[index]?.[side]?.runs ?? (index < innings.length ? '0' : '—')}</td>)}<td className="px-2 text-center font-mono font-extrabold">{line?.teams?.[side]?.runs ?? 0}</td><td className="text-center font-mono">{line?.teams?.[side]?.hits ?? 0}</td><td className="text-center font-mono">{line?.teams?.[side]?.errors ?? 0}</td></tr>)}</tbody>
      </table>
    </div>
  </div>;
};
