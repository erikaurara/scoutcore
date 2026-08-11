import fs from "node:fs/promises";

const baseUrl = process.env.SCOUTCORE_BASE_URL || "http://127.0.0.1:3000";
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY is not configured.");
  process.exit(1);
}

const analyticsResponse = await fetch(`${baseUrl}/api/analytics/today`);
if (!analyticsResponse.ok) throw new Error(`ScoutCore analytics failed: ${analyticsResponse.status}`);
const analytics = await analyticsResponse.json();

const compact = JSON.stringify(analytics);
const prompt = `You are ScoutCore Daily Intelligence, an MLB analytics assistant. Create a concise daily scouting brief from the VERIFIED ScoutCore analytics JSON below. Do not invent statistics, probabilities, injuries, lineups, or outcomes. Only cite numbers that exist in the supplied JSON. If information is unavailable, say unavailable. This is analysis, not betting advice or a guarantee.

Return valid JSON with exactly these fields:
headline: string
summary: string
signals: array of objects with {team, player, score, confidence, reason}
watchList: array of strings
caveats: array of strings

Prioritize the strongest explainable matchup signals and mention confidence/data quality where available.

VERIFIED DATA:
${compact}`;

const response = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    input: prompt,
    text: { format: { type: "json_object" } },
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`OpenAI request failed: ${response.status} ${body}`);
}

const result = await response.json();
const output = result.output_text;
if (!output) throw new Error("OpenAI returned no output text.");

let report;
try {
  report = JSON.parse(output);
} catch {
  throw new Error("OpenAI returned invalid JSON.");
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: "ScoutCore verified MLB analytics",
  report,
};

await fs.mkdir("public/data", { recursive: true });
await fs.writeFile("public/data/daily-intelligence.json", JSON.stringify(payload, null, 2) + "\n");
console.log(`Generated daily intelligence with ${report.signals?.length ?? 0} signals.`);
