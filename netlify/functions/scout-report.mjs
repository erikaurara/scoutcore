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
        error: 'IXMetrics AI Analyst Report is not configured yet. Add GEMINI_API_KEY to the Netlify site environment variables and redeploy.',
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
    const prompt = `You are IXMetrics AI, an MLB data analyst. Create a concise, readable analyst report using ONLY the supplied verified data. Do not invent statistics, outcomes, injuries, pitch characteristics, or matchup facts. If a requested detail is missing, say that the data is not available.\n\nPLAYER\nName: ${playerName}\nTeam: ${team || 'Not supplied'}\nPosition: ${position || 'Not supplied'}\nOpponent: ${opponent || 'Not supplied'}\n\n2026 / CURRENT-SEASON DATA\n${JSON.stringify(stats ?? {}, null, 2)}\n\nRECENT FORM\n${JSON.stringify(recentForm ?? {}, null, 2)}\n\nRECENT PITCH MIX\n${JSON.stringify(pitchMix ?? {}, null, 2)}\n\nUSER FOCUS\n${extraPrompt || 'Summarize the most meaningful current trends.'}\n\nFormat the report with these short sections:\nQUICK SUMMARY\nRECENT FORM\nPITCH MIX / VELOCITY (pitchers only; otherwise write Not applicable)\nMATCHUP STRENGTHS\nCONCERNS\nKEY NUMBERS\n\nKeep it practical and brief. Clearly distinguish verified numbers from interpretation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

    return new Response(JSON.stringify({ report: response.text || 'No report was returned.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('IXMetrics analyst report function failed:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to generate analyst report.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
