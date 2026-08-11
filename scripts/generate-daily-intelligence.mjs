import fs from "node:fs/promises";

const baseUrl = process.env.SCOUTCORE_BASE_URL || "http://127.0.0.1:3000";

const analyticsResponse = await fetch(`${baseUrl}/api/analytics/today`);
if (!analyticsResponse.ok) throw new Error(`ScoutCore analytics failed: ${analyticsResponse.status}`);
const analytics = await analyticsResponse.json();

const rows = (analytics.games ?? [])
  .flatMap((game) => (game.teams ?? []).flatMap((team) => (team.matchups ?? []).map((matchup) => ({
    gamePk: game.gamePk,
    team: team.team,
    batter: matchup.batter,
    pitcher: matchup.pitcher,
    analysis: matchup.analysis,
  }))))
  .filter((row) => row.analysis && Number.isFinite(Number(row.analysis.score)))
  .sort((a, b) => Number(b.analysis.score) - Number(a.analysis.score));

const top = rows.slice(0, 8);

const signals = top.map((row) => {
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
    team: row.team ?? "Unknown team",
    player: row.batter?.name ?? "Unknown hitter",
    opponentPitcher: row.pitcher?.name ?? "Pitcher unavailable",
    score: Number(row.analysis.score),
    confidence: Number(row.analysis.confidence ?? 0),
    reason: reasons.join(" · ") || "Verified matchup factors available in ScoutCore analytics.",
  };
});

const gameCount = Array.isArray(analytics.games) ? analytics.games.length : 0;
const matchupCount = rows.length;
const highConfidence = signals.filter((signal) => signal.confidence >= 80).length;

const report = {
  headline: signals.length
    ? `ScoutCore found ${signals.length} notable matchup signals today`
    : "ScoutCore daily matchup scan complete",
  summary: signals.length
    ? `ScoutCore analyzed ${matchupCount} verified hitter-pitcher matchups across ${gameCount} games. ${highConfidence} of the top signals have confidence of at least 80%.`
    : `ScoutCore checked ${gameCount} games, but no verified matchup signals are available yet.`,
  signals,
  watchList: signals.slice(0, 5).map((signal) => `${signal.player} vs ${signal.opponentPitcher} — index ${signal.score.toFixed(1)}, confidence ${signal.confidence}%`),
  caveats: [
    "Generated automatically from ScoutCore's verified MLB data and analytics rules.",
    "The matchup index is an analytics score, not a guaranteed outcome probability.",
    "Lineups, probable pitchers, and game data can change during the day.",
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
console.log(`Generated free daily intelligence with ${signals.length} signals from ${matchupCount} matchups.`);
