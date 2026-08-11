import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getGame, getPlayer, getPlayerStats, getSchedule, getTeamRoster } from "./src/services/mlbApi";
import { getGameAnalytics, getTodayAnalytics } from "./src/services/analytics";

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
