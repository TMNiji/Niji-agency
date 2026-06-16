// POST /api/iris-token  →  { token, initialMessage, model }
//
// Mints a single-use, short-lived Gemini ephemeral auth token so the browser
// can open a Live API session WITHOUT ever seeing GEMINI_API_KEY. The agent's
// model, voice and full system prompt are baked into the token's
// liveConnectConstraints here on the server — the browser only echoes the
// matching model/modality on connect and cannot alter the locked config.
//
// A lightweight, best-effort rate cap guards the endpoint: each token authorises
// a paid real-time audio session, so we throttle per IP and cap global
// concurrency. NOTE: this state is per-instance and in-memory — good enough to
// blunt casual abuse, but it resets on cold start and isn't shared across
// Vercel instances. Move to Vercel KV / Upstash for a hard, global limit.
import { GoogleGenAI } from '@google/genai';
import {
  MODEL,
  VOICE_NAME,
  LANGUAGE_DEFAULT,
  SYSTEM_PROMPT,
  buildInitialMessage,
} from './_lib/iris-config.js';

// ── Rate cap ───────────────────────────────────────────────────────────────
const WINDOW_MS = 10 * 60 * 1000; // 10-minute rolling window
const MAX_PER_IP = 5; // tokens per IP per window
const MAX_GLOBAL_PER_WINDOW = 60; // tokens across all IPs per window
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing GEMINI_API_KEY' });
  }

  // Date.now() is intentional here — this is a runtime serverless function,
  // not a replayable workflow script.
  const now = Date.now();
  if (rateLimited(clientIp(req), now)) {
    res.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
    return res.status(429).json({ error: 'Trop de sessions. Réessayez dans quelques minutes.' });
  }

  // theme comes from the suggested-question chips; optional, free text.
  const theme = typeof req.body?.theme === 'string' ? req.body.theme : '';

  // Config locked into the token. The browser must connect with the same model
  // and AUDIO modality; everything else (voice, system prompt, language) is
  // fixed server-side and cannot be overridden by the client.
  const liveConfig = {
    responseModalities: ['AUDIO'],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    speechConfig: {
      languageCode: LANGUAGE_DEFAULT,
      voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
    },
  };

  try {
    const client = new GoogleGenAI({ apiKey });
    const token = await client.authTokens.create({
      config: {
        uses: 1, // one Live session per token
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(), // token valid 30 min
        newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(), // must start within 2 min
        liveConnectConstraints: {
          model: MODEL,
          config: liveConfig,
        },
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return res.status(200).json({
      token: token.name,
      model: MODEL,
      initialMessage: buildInitialMessage(theme),
    });
  } catch (err) {
    console.error('[iris-token] mint failed:', err?.message || err);
    return res.status(502).json({ error: 'Impossible de démarrer la session.' });
  }
}
