import fs from "node:fs/promises";

const baseUrl = process.env.SCOUTCORE_BASE_URL || "http://127.0.0.1:3000";

const analyticsResponse = await fetch(`${baseUrl}/api/analytics/today`);
if (!analyticsResponse.ok) throw new Error(`ScoutCore analytics failed: ${analyticsResponse.status}`);
const analytics = await analyticsResponse.json();

const rows = (analytics.games ?? [])
  .flatMap((game) => (game.teams ?? []).flatMap((team) => (team.matchups ?? []).map((matchup) => ({
    gamePk: game.gamePk,
    gameDate: game.gameDate,
    team: team.team,
    teamId: team.teamId,
    opponentTeam: team.opponentTeam,
    opponentTeamId: team.opponentTeamId,
    batter: matchup.batter,
    pitcher: matchup.pitcher,
    analysis: matchup.analysis,
  }))))
  .filter((row) => row.analysis && Number.isFinite(Number(row.analysis.score)))
  .sort((a, b) => Number(b.analysis.score) - Number(a.analysis.score));

const fmt3 = (value) => Number(value).toFixed(3).replace(/^0/, "");
const fmt2 = (value) => Number(value).toFixed(2);
const dedupe = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const matchupEdges = rows
  .filter((row) => Number(row.analysis.score) >= 55 && Number(row.analysis.confidence ?? 0) >= 55)
  .slice(0, 3)
  .map((row) => {
    const hand = row.analysis?.handedness?.label;
    const components = Array.isArray(row.analysis?.components) ? row.analysis.components : [];
    const strongest = components
      .filter((item) => Number.isFinite(Number(item?.value)))
      .sort((a, b) => Number(b.value) - Number(a.value))[0];
    const reasons = [
      hand,
      strongest ? `${strongest.name} ${Number(strongest.value).toFixed(1)}` : null,
      row.analysis?.dataQuality ? `data quality ${row.analysis.dataQuality}` : null,
    ].filter(Boolean);
    return {
      kind: "MATCHUP EDGE",
      gamePk: row.gamePk,
      team: row.team ?? "Unknown team",
      player: row.batter?.name ?? "Unknown hitter",
      opponentPitcher: row.pitcher?.name ?? "Pitcher unavailable",
      score: Number(row.analysis.score),
      value: `${Number(row.analysis.score).toFixed(1)} EDGE`,
      confidence: Number(row.analysis.confidence ?? 0),
      reason: reasons.join(" · ") || "Verified matchup factors favor the hitter in ScoutCore's model.",
    };
  });

const hotHitters = dedupe(
  rows
    .filter((row) => {
      const recent = row.analysis?.historical?.recentHitterForm;
      return recent && Number(recent.games) >= 3 && Number(recent.ops) >= 0.8;
    })
    .sort((a, b) => Number(b.analysis.historical.recentHitterForm.ops) - Number(a.analysis.historical.recentHitterForm.ops)),
  (row) => row.batter?.id,
).slice(0, 2).map((row) => {
  const recent = row.analysis.historical.recentHitterForm;
  return {
    kind: "HOT HITTER",
    gamePk: row.gamePk,
    team: row.team,
    player: row.batter?.name ?? "Unknown hitter",
    opponentPitcher: row.pitcher?.name ?? "Pitcher unavailable",
    score: Math.round(Number(recent.ops) * 1000) / 10,
    value: `${fmt3(recent.ops)} OPS`,
    confidence: Number(row.analysis.confidence ?? 0),
    reason: `Last ${recent.games} tracked games: ${fmt3(recent.avg)} AVG, ${fmt3(recent.ops)} OPS. Today's probable opponent is ${row.pitcher?.name ?? 'not posted yet'}.`,
  };
});

const pitcherWatch = dedupe(
  rows
    .filter((row) => {
      const recent = row.analysis?.historical?.recentPitcherForm;
      return recent && Number(recent.games) >= 2 && (Number(recent.era) <= 3.5 || Number(recent.k9) >= 9.5 || Number(recent.whip) <= 1.2);
    })
    .sort((a, b) => Number(a.analysis.historical.recentPitcherForm.era) - Number(b.analysis.historical.recentPitcherForm.era)),
  (row) => row.pitcher?.id,
).slice(0, 2).map((row) => {
  const recent = row.analysis.historical.recentPitcherForm;
  return {
    kind: "PITCHER WATCH",
    gamePk: row.gamePk,
    team: row.opponentTeam ?? "Pitching team",
    player: row.pitcher?.name ?? "Probable pitcher",
    score: Math.max(0, 100 - Number(recent.era) * 10),
    value: `${fmt2(recent.era)} ERA`,
    confidence: Number(row.analysis.confidence ?? 0),
    reason: `Recent ${recent.games}-game form: ${fmt2(recent.era)} ERA, ${fmt2(recent.whip)} WHIP and ${fmt2(recent.k9)} K/9.`,
  };
});

const bullpenWatch = dedupe(
  rows
    .filter((row) => {
      const bullpen = row.analysis?.historical?.bullpen;
      return bullpen?.available && (Number(bullpen.era) >= 4.3 || Number(bullpen.whip) >= 1.35);
    })
    .sort((a, b) => Number(b.analysis.historical.bullpen.era) - Number(a.analysis.historical.bullpen.era)),
  (row) => row.opponentTeamId ?? row.opponentTeam,
).slice(0, 1).map((row) => {
  const bullpen = row.analysis.historical.bullpen;
  return {
    kind: "BULLPEN WATCH",
    gamePk: row.gamePk,
    team: row.opponentTeam ?? "Opponent bullpen",
    player: `${row.opponentTeam ?? 'Opponent'} bullpen`,
    score: Number(bullpen.era),
    value: `${fmt2(bullpen.era)} ERA`,
    confidence: Number(row.analysis.confidence ?? 0),
    reason: `Season bullpen context: ${fmt2(bullpen.era)} ERA and ${fmt2(bullpen.whip)} WHIP across ${bullpen.pitchers} relievers with verified data.`,
  };
});

const signals = [...matchupEdges, ...hotHitters, ...pitcherWatch, ...bullpenWatch].slice(0, 8);
const gameCount = Array.isArray(analytics.games) ? analytics.games.length : 0;
const matchupCount = rows.length;
const highConfidence = signals.filter((signal) => Number(signal.confidence) >= 80).length;
const breakdown = {
  matchupEdges: signals.filter((signal) => signal.kind === "MATCHUP EDGE").length,
  hotHitters: signals.filter((signal) => signal.kind === "HOT HITTER").length,
  pitcherWatch: signals.filter((signal) => signal.kind === "PITCHER WATCH").length,
  bullpenWatch: signals.filter((signal) => signal.kind === "BULLPEN WATCH").length,
};

const report = {
  headline: signals.length
    ? `ScoutCore found ${signals.length} signals worth watching today`
    : "ScoutCore is scanning today's verified matchup data",
  summary: signals.length
    ? `${breakdown.matchupEdges} matchup edges, ${breakdown.hotHitters} hot hitters and ${breakdown.pitcherWatch + breakdown.bullpenWatch} pitcher/bullpen watch alerts are currently verified. ${highConfidence} signals have confidence of at least 80%.`
    : `ScoutCore checked ${gameCount} games and ${matchupCount} available hitter-pitcher matchups. No signal has cleared the current display thresholds yet; this updates automatically as lineups and verified data arrive.`,
  signals,
  breakdown,
  watchList: signals.slice(0, 6).map((signal) => `${signal.kind}: ${signal.player} — ${signal.value}`),
  caveats: [
    "Generated automatically from ScoutCore's verified MLB data and analytics rules.",
    "Matchup Edge is an explainable analytics index, not a guaranteed outcome probability.",
    "Recent-form signals use only MLB game-log data returned by ScoutCore's verified data pipeline.",
    "Lineups, probable pitchers and game data can change during the day.",
  ],
};

const payload = {
  generatedAt: new Date().toISOString(),
  source: "ScoutCore verified MLB analytics",
  generator: "ScoutCore rules engine (no paid AI API)",
  report,
};

await fs.mkdir("public/data", { recursive: true });
await fs.writeFile("public/data/daily-intelligence.json", JSON.stringify(payload, null, 2) + "\n");
console.log(`Generated daily intelligence with ${signals.length} signals from ${matchupCount} verified matchups.`);
