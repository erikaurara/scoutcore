import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getGame, getPlayer, getPlayerStats, getSchedule, getTeamRoster, getTeams, searchPitchers } from "./src/services/mlbApi";
import { getGameAnalytics, getTodayAnalytics } from "./src/services/analytics";

function seasonStat(payload: any, group: 'hitting' | 'pitching') {
  const block = (payload?.stats ?? []).find((item: any) => item?.group?.displayName?.toLowerCase() === group || item?.group?.displayName?.toLowerCase().includes(group));
  return block?.splits?.[0]?.stat ?? {};
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/games/today", async (_req, res) => {
    try {
      const games = await getSchedule();
      res.json({ games, updatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("MLB schedule error:", error);
      res.status(502).json({ error: error?.message || "Failed to load MLB schedule" });
    }
  });

  app.get("/api/teams", async (_req, res) => {
    try {
      res.json({ teams: await getTeams() });
    } catch (error: any) {
      console.error("MLB teams error:", error);
      res.status(502).json({ error: error?.message || "Failed to load MLB teams" });
    }
  });

  app.get("/api/players/search", async (req, res) => {
    try {
      const query = String(req.query.q ?? '').trim();
      if (query.length < 2) return res.json({ players: [] });
      res.json({ players: await searchPitchers(query) });
    } catch (error: any) {
      console.error("MLB pitcher search error:", error);
      res.status(502).json({ error: error?.message || "Failed to search MLB pitchers" });
    }
  });

  app.get("/api/matchup-builder", async (req, res) => {
    try {
      const pitcherId = Number(req.query.pitcherId);
      const teamId = Number(req.query.teamId);
      if (!Number.isInteger(pitcherId) || !Number.isInteger(teamId)) return res.status(400).json({ error: "pitcherId and teamId are required" });

      const [pitcherInfo, pitcherStatsPayload, rosterPayload, teams] = await Promise.all([
        getPlayer(pitcherId),
        getPlayerStats(pitcherId),
        getTeamRoster(teamId),
        getTeams(),
      ]);

      const pitcherPerson = pitcherInfo?.people?.[0] ?? {};
      const pitcherStats = seasonStat(pitcherStatsPayload, 'pitching');
      const team = teams.find((item: any) => item.id === teamId) ?? { id: teamId, name: 'Selected Team' };
      const hitters = (rosterPayload?.roster ?? []).filter((entry: any) => entry?.position?.type !== 'Pitcher' && entry?.position?.abbreviation !== 'P').slice(0, 16);

      const batters = await Promise.all(hitters.map(async (entry: any) => {
        const id = entry?.person?.id;
        if (!id) return null;
        try {
          const [playerPayload, statsPayload] = await Promise.all([getPlayer(id), getPlayerStats(id)]);
          const person = playerPayload?.people?.[0] ?? entry.person ?? {};
          const stats = seasonStat(statsPayload, 'hitting');
          return {
            id,
            name: person.fullName ?? entry?.person?.fullName ?? 'Unknown player',
            position: entry?.position?.abbreviation ?? person?.primaryPosition?.abbreviation ?? '',
            batSide: person?.batSide?.code ?? null,
            stats: {
              gamesPlayed: stats.gamesPlayed ?? null,
              atBats: stats.atBats ?? null,
              hits: stats.hits ?? null,
              homeRuns: stats.homeRuns ?? null,
              rbi: stats.rbi ?? null,
              strikeOuts: stats.strikeOuts ?? null,
              baseOnBalls: stats.baseOnBalls ?? null,
              avg: stats.avg ?? null,
              obp: stats.obp ?? null,
              slg: stats.slg ?? null,
              ops: stats.ops ?? null,
            },
          };
        } catch {
          return {
            id,
            name: entry?.person?.fullName ?? 'Unknown player',
            position: entry?.position?.abbreviation ?? '',
            batSide: null,
            stats: {},
          };
        }
      }));

      res.json({
        pitcher: {
          id: pitcherId,
          name: pitcherPerson.fullName ?? 'Unknown pitcher',
          pitchHand: pitcherPerson?.pitchHand?.code ?? null,
          stats: {
            gamesPlayed: pitcherStats.gamesPlayed ?? null,
            gamesStarted: pitcherStats.gamesStarted ?? null,
            inningsPitched: pitcherStats.inningsPitched ?? null,
            era: pitcherStats.era ?? null,
            whip: pitcherStats.whip ?? null,
            strikeOuts: pitcherStats.strikeOuts ?? null,
            strikeoutsPer9Inn: pitcherStats.strikeoutsPer9Inn ?? null,
            walksPer9Inn: pitcherStats.walksPer9Inn ?? null,
          },
        },
        team,
        batters: batters.filter(Boolean),
        note: "Batter rows show current season totals. Selecting a batter opens a pitcher-vs-batter comparison; direct career BvP history is only shown when a verified source is added.",
      });
    } catch (error: any) {
      console.error("Matchup builder error:", error);
      res.status(502).json({ error: error?.message || "Failed to build pitcher vs team matchup" });
    }
  });

  app.get("/api/games/:gamePk", async (req, res) => {
    try {
      const gamePk = Number(req.params.gamePk);
      if (!Number.isInteger(gamePk)) return res.status(400).json({ error: "Invalid gamePk" });
      res.json(await getGame(gamePk));
    } catch (error: any) {
      console.error("MLB game error:", error);
      res.status(502).json({ error: error?.message || "Failed to load MLB game" });
    }
  });

  app.get("/api/games/:gamePk/analytics", async (req, res) => {
    try {
      const gamePk = Number(req.params.gamePk);
      if (!Number.isInteger(gamePk)) return res.status(400).json({ error: "Invalid gamePk" });
      res.json(await getGameAnalytics(gamePk));
    } catch (error: any) {
      console.error("Matchup analytics error:", error);
      res.status(502).json({ error: error?.message || "Failed to calculate matchup analytics" });
    }
  });

  app.get("/api/analytics/today", async (_req, res) => {
    try {
      res.json({ games: await getTodayAnalytics(), updatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("Daily analytics error:", error);
      res.status(502).json({ error: error?.message || "Failed to calculate daily analytics" });
    }
  });

  app.get("/api/teams/:teamId/roster", async (req, res) => {
    try {
      const teamId = Number(req.params.teamId);
      if (!Number.isInteger(teamId)) return res.status(400).json({ error: "Invalid teamId" });
      res.json(await getTeamRoster(teamId));
    } catch (error: any) {
      console.error("MLB roster error:", error);
      res.status(502).json({ error: error?.message || "Failed to load roster" });
    }
  });

  app.get("/api/players/:playerId", async (req, res) => {
    try {
      const playerId = Number(req.params.playerId);
      if (!Number.isInteger(playerId)) return res.status(400).json({ error: "Invalid playerId" });
      res.json(await getPlayer(playerId));
    } catch (error: any) {
      console.error("MLB player error:", error);
      res.status(502).json({ error: error?.message || "Failed to load player" });
    }
  });

  app.get("/api/players/:playerId/stats", async (req, res) => {
    try {
      const playerId = Number(req.params.playerId);
      const season = req.query.season ? Number(req.query.season) : new Date().getFullYear();
      if (!Number.isInteger(playerId) || !Number.isInteger(season)) return res.status(400).json({ error: "Invalid playerId or season" });
      res.json(await getPlayerStats(playerId, season));
    } catch (error: any) {
      console.error("MLB player stats error:", error);
      res.status(502).json({ error: error?.message || "Failed to load player stats" });
    }
  });

  app.post("/api/scout-report", async (req, res) => {
    try {
      const { playerName, team, opponent, position, extraPrompt, stats } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "GEMINI_API_KEY is not configured." });

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are ScoutCore AI, an MLB scouting analyst. Generate a concise scouting report for ${playerName || "the selected player"} (${team || "unknown team"}) against ${opponent || "upcoming opponents"}.
Position: ${position || "unknown"}
Verified MLB data supplied to you:
${JSON.stringify(stats ?? {}, null, 2)}
Additional Context: ${extraPrompt || "Evaluate relevant performance, matchup, pitch, and batted-ball tendencies."}

Do not invent statistics. Use only supplied verified data for numerical claims. If a statistic is unavailable, say it is unavailable. Clearly distinguish observed data from interpretation.`;

      const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
      res.json({ report: response.text || "Report generated successfully." });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate report" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`ScoutCore server running on http://localhost:${PORT}`));
}

startServer();
