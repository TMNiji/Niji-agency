// POST /api/iris-chat  →  { reply }
//
// Written-chat counterpart to api/iris-token.js. Takes the running conversation
// ({ messages: [{ role:'user'|'model', text }] }) and returns Iris's next text
// turn from Gemini — same persona and knowledge as the voice agent, locked
// server-side. GEMINI_API_KEY never reaches the browser. Ported from
// NIJI AGENCY AI/_agents/Iris/iris_chat.py (which hit a local server); here it's
// a serverless function so the chat works for any visitor.
//
// Same best-effort, per-instance rate cap as the token endpoint: each call is a
// paid Gemini request, so we throttle per IP and cap global throughput. State is
// in-memory (resets on cold start, not shared across instances) — enough to
// blunt casual abuse; move to Vercel KV / Upstash for a hard, global limit.
import { GoogleGenAI } from '@google/genai';
import {
  MODEL_CHAT,
  CHAT_SYSTEM_PROMPT,
  CHAT_TEMPERATURE,
  CHAT_MAX_OUTPUT_TOKENS,
} from './_lib/iris-config.js';

// ── Rate cap ───────────────────────────────────────────────────────────────
const WINDOW_MS = 10 * 60 * 1000; // 10-minute rolling window
const MAX_PER_IP = 40; // chat turns per IP per window
const MAX_GLOBAL_PER_WINDOW = 400; // turns across all IPs per window
const hits = new Map(); // ip -> number[] (timestamps)
let globalHits = []; // timestamps across all IPs

function rateLimited(ip, now) {
  globalHits = globalHits.filter((t) => now - t < WINDOW_MS);
  const mine = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (globalHits.length >= MAX_GLOBAL_PER_WINDOW) return true;
  if (mine.length >= MAX_PER_IP) return true;
  mine.push(now);
  hits.set(ip, mine);
  globalHits.push(now);
  return false;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Keep the prompt bounded: only the last turns matter for a chat window, and an
// unbounded history is an easy way to inflate token cost.
const MAX_TURNS = 20;
const MAX_CHARS_PER_TURN = 2000;

function buildContents(messages) {
  const trimmed = Array.isArray(messages) ? messages.slice(-MAX_TURNS) : [];
  const contents = [];
  for (const m of trimmed) {
    const text = (typeof m?.text === 'string' ? m.text : '').trim().slice(0, MAX_CHARS_PER_TURN);
    if (!text) continue;
    const role = m.role === 'model' ? 'model' : 'user';
    contents.push({ role, parts: [{ text }] });
  }
  return contents;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing GEMINI_API_KEY' });
  }

  // Date.now() is intentional here — runtime serverless function, not a
  // replayable workflow script.
  const now = Date.now();
  if (rateLimited(clientIp(req), now)) {
    res.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).json({ error: 'Trop de messages. Réessayez dans quelques minutes.' });
  }

  const contents = buildContents(req.body?.messages);
  if (!contents.length) {
    return res.status(400).json({ error: 'Aucun message à traiter.' });
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: MODEL_CHAT,
      contents,
      config: {
        systemInstruction: CHAT_SYSTEM_PROMPT,
        temperature: CHAT_TEMPERATURE,
        maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
      },
    });

    const reply = (result?.text || '').trim();
    if (!reply) {
      return res.status(502).json({ error: 'Réponse vide.' });
    }
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('[iris-chat] generation failed:', err?.message || err);
    return res.status(502).json({ error: 'Impossible de répondre pour le moment.' });
  }
}
