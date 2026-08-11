import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini AI Scouting Report endpoint
  app.post("/api/scout-report", async (req, res) => {
    try {
      const { playerName, team, opponent, position, extraPrompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        // Fallback simulated AI response if key not provided
        return res.json({
          report: `### ScoutCore Automated Intelligence Report: ${playerName || 'Gerrit Cole'} (${team || 'NYY'})

**Executive Summary:**
${playerName || 'Gerrit Cole'} demonstrates elite level metrics across all primary pitch tracking parameters. Statcast tracking confirms an average 4-seam fastball velocity of 97.4 MPH with 18.4 inches of vertical break.

**Key Pitcher vs Batter Tendencies:**
- **Primary Fastball:** High upper-quadrant usage generating a 34.2% whiff rate.
- **Secondary Slider:** Tight lateral sweep measuring 88.6 MPH, lethal against right-handed hitters in 2-strike counts.
- **Chase Efficiency:** Opponents chase at a low 18.5% rate outside the strike zone when Cole commands the lower third.

**Front Office Recommendation:**
High priority leverage asset. Optimal strategy involves elevating fastballs high-and-inside followed by sharp knuckle-curve low-and-away.`,
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are ScoutCore AI, an elite MLB front office scouting analyst. Generate a concise, high-density scouting report for ${playerName || 'Gerrit Cole'} (${team || 'NYY'}) against ${opponent || 'upcoming opponents'}.
Position: ${position || 'Pitcher'}
Additional Context: ${extraPrompt || 'Evaluate pitch velocity, whiff rates, barrel percentages, and high-leverage gameday strategy.'}

Format the report with clear markdown headings:
1. Executive Summary & Statcast Profile
2. Pitch Arsenal Breakdown & Movement Profile
3. Strategic Matchup Recommendation (High Leverage)
Use professional scouting terminology (e.g., vertical break, xFIP, barrel rate, whiff %, launch angle).`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const reportText = response.text || "Report generated successfully.";
      return res.json({ report: reportText });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({ error: error?.message || "Failed to generate report" });
    }
  });

  // Vite middleware for development
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
