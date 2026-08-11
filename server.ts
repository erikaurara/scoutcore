import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { getGame, getSchedule } from "./src/services/mlbApi";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Real MLB schedule endpoint
  app.get("/api/games/today", async (_req, res) => {
    try {
      const games = await getSchedule();
      res.json({ games, updatedAt: new Date().toISOString() });
    } catch (error: any) {
      console.error("MLB schedule error:", error);
      res.status(502).json({ error: error?.message || "Failed to load MLB schedule" });
    }
  });

  // Real MLB game feed endpoint
  app.get("/api/games/:gamePk", async (req, res) => {
    try {
      const gamePk = Number(req.params.gamePk);
      if (!Number.isInteger(gamePk)) {
        return res.status(400).json({ error: "Invalid gamePk" });
      }

      const game = await getGame(gamePk);
      res.json(game);
    } catch (error: any) {
      console.error("MLB game error:", error);
      res.status(502).json({ error: error?.message || "Failed to load MLB game" });
    }
  });

  // Gemini AI Scouting Report endpoint
  app.post("/api/scout-report", async (req, res) => {
    try {
      const { playerName, team, opponent, position, extraPrompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(503).json({
          error: "GEMINI_API_KEY is not configured. Add it to the server environment to enable AI reports.",
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are ScoutCore AI, an MLB scouting analyst. Generate a concise scouting report for ${playerName || "the selected player"} (${team || "unknown team"}) against ${opponent || "upcoming opponents"}.
Position: ${position || "unknown"}
Additional Context: ${extraPrompt || "Evaluate relevant performance, matchup, pitch, and batted-ball tendencies."}

Do not invent statistics. If a statistic is not supplied, say it is unavailable. Format the report with:
1. Executive Summary
2. Key Statistical Tendencies
3. Matchup Considerations
4. Strategic Notes`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ report: response.text || "Report generated successfully." });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate report" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ScoutCore server running on http://localhost:${PORT}`);
  });
}

startServer();
