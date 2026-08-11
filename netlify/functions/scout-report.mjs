import { GoogleGenAI } from '@google/genai';

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'AI Scout Report is not configured yet. Add GEMINI_API_KEY to the Netlify site environment variables and redeploy.',
      }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const {
      playerName,
      team,
      opponent,
      position,
      extraPrompt,
      stats,
      recentForm,
      pitchMix,
    } = body ?? {};

    if (!playerName || !String(playerName).trim()) {
      return new Response(JSON.stringify({ error: 'A player name is required.' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are ScoutCore AI, an MLB scouting analyst. Create a concise, readable scouting report using ONLY the supplied verified data. Do not invent statistics, outcomes, injuries, pitch characteristics, or matchup facts. If a requested detail is missing, say that the data is not available.

PLAYER
Name: ${playerName}
Team: ${team || 'Not supplied'}
Position: ${position || 'Not supplied'}
Opponent: ${opponent || 'Not supplied'}

2026 / CURRENT-SEASON DATA
${JSON.stringify(stats ?? {}, null, 2)}

RECENT FORM
${JSON.stringify(recentForm ?? {}, null, 2)}

RECENT PITCH MIX
${JSON.stringify(pitchMix ?? {}, null, 2)}

USER FOCUS
${extraPrompt || 'Summarize the most meaningful current trends.'}

Format the report with these short sections:
QUICK SUMMARY
RECENT FORM
PITCH MIX / VELOCITY (pitchers only; otherwise write Not applicable)
MATCHUP STRENGTHS
CONCERNS
KEY NUMBERS

Keep it practical and brief. Clearly distinguish verified numbers from interpretation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

    return new Response(JSON.stringify({ report: response.text || 'No report was returned.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Scout report function failed:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to generate scout report.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
