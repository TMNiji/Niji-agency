// Iris — browser voice session shell.
//
// Replaces the original localhost-POST shell from NIJI AGENCY AI/index.html.
// Flow: POST /api/iris-token → ephemeral token (+ server-built greeting) →
// open mic → connect to the Gemini Live API directly over WebSocket → stream
// 16 kHz PCM up, play 24 kHz PCM down. The agent's prompt/voice/model are locked
// server-side into the token, so nothing sensitive lives in this bundle.
//
// All visual state (status pill, body.active, equalizer, "parle / écoute" text)
// is driven from real session + audio events rather than timers.
import { GoogleGenAI, Modality } from '@google/genai';

const SAMPLE_RATE_INPUT = 16000;
const SAMPLE_RATE_OUTPUT = 24000;

// ── DOM ──────────────────────────────────────────────────────────────────
const pill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const stateIdle = document.getElementById('state-text');
const stateLive = document.getElementById('state-live');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const errorMsg = document.getElementById('error-msg');
const bars = Array.from(document.querySelectorAll('.viz-bar'));
const orbWrap = document.querySelector('.orb-wrap');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Per-bar gain so the equalizer looks alive off a single RMS level.
const BAR_GAIN = [0.6, 0.85, 1.0, 0.75, 0.95, 0.8, 0.65];

// ── Session state ──────────────────────────────────────────────────────────
let session = null;
let micStream = null;
let inCtx = null;
let outCtx = null;
let micNode = null;
let playNode = null;
let connecting = false;

// ── UI helpers ───────────────────────────────────────────────────────────
function setStatus(label, state) {
  pill.classList.add('fading');
  setTimeout(() => {
    statusText.textContent = label;
    pill.setAttribute('data-state', state);
    pill.classList.remove('fading');
  }, 200);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('show');
}
function clearError() {
  errorMsg.classList.remove('show');
}

function setLiveText(txt) {
  stateLive.textContent = txt;
}

function setBars(level) {
  if (reduceMotion) return;
  for (let i = 0; i < bars.length; i++) {
    bars[i].style.setProperty('--level', (level * BAR_GAIN[i]).toFixed(3));
  }
}

// Rotating idle prompt under the orb (paused while a session is active).
const IDLE_STATES = ['Prête à échanger', 'Posez votre question', 'Découvrez l’agence'];
let idleIdx = 0;
setInterval(() => {
  if (document.body.classList.contains('active')) return;
  stateIdle.classList.remove('show');
  setTimeout(() => {
    idleIdx = (idleIdx + 1) % IDLE_STATES.length;
    stateIdle.textContent = IDLE_STATES[idleIdx];
    stateIdle.classList.add('show');
  }, 800);
}, 3000);

// ── base64 <-> bytes (Gemini Live carries PCM as base64) ────────────────────
function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToInt16Buffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ── Session lifecycle ────────────────────────────────────────────────────
async function start(theme) {
  if (connecting || session) return;
  connecting = true;
  clearError();
  btnStart.setAttribute('disabled', '');
  setStatus('Connexion…', 'ready');

  try {
    // 1. Token (also returns the server-built first turn + the locked model).
    const res = await fetch('/api/iris-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: theme || '' }),
    });
    if (!res.ok) {
      // Surface the server's reason so failures are diagnosable instead of a
      // blanket "indisponible". The endpoint returns { error } on every path.
      let detail = '';
      try { detail = (await res.json())?.error || ''; } catch (_) {}
      console.error('[iris] token endpoint', res.status, detail);
      if (res.status === 429) {
        throw new Error(detail || 'Trop de sessions pour le moment. Réessayez dans quelques minutes.');
      }
      throw new Error(
        (detail || 'Le service est momentanément indisponible.') + ` (code ${res.status})`
      );
    }
    const { token, model, initialMessage } = await res.json();

    // 2. Microphone.
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    // 3. Audio graph — separate contexts for capture and playback.
    inCtx = new AudioContext({ sampleRate: SAMPLE_RATE_INPUT });
    outCtx = new AudioContext({ sampleRate: SAMPLE_RATE_OUTPUT });
    await inCtx.audioWorklet.addModule(new URL('./worklets/mic-worklet.js', import.meta.url));
    await outCtx.audioWorklet.addModule(new URL('./worklets/playback-worklet.js', import.meta.url));

    playNode = new AudioWorkletNode(outCtx, 'playback-processor');
    playNode.connect(outCtx.destination);
    playNode.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'level') setBars(m.level);
      else if (m.type === 'playing') setLiveText('Iris parle…');
      else if (m.type === 'drained') setLiveText('En écoute…');
    };

    // 4. Connect to Gemini Live. Model + AUDIO modality must match the locked
    //    server-side constraints; everything else is fixed by the token.
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
    session = await ai.live.connect({
      model,
      config: { responseModalities: [Modality.AUDIO] },
      callbacks: {
        onopen: () => {},
        onmessage: handleMessage,
        onerror: (e) => fail(e?.message || 'Erreur de connexion.'),
        onclose: () => { if (session) stop(); },
      },
    });

    // 5. Wire the mic into the open session.
    micNode = new AudioWorkletNode(inCtx, 'mic-processor');
    micNode.port.onmessage = (e) => {
      if (!session) return;
      session.sendRealtimeInput({
        audio: { data: bytesToBase64(e.data), mimeType: `audio/pcm;rate=${SAMPLE_RATE_INPUT}` },
      });
    };
    inCtx.createMediaStreamSource(micStream).connect(micNode);

    // 6. Kick off the conversation with the server-authored opening turn.
    session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text: initialMessage }] }],
      turnComplete: true,
    });

    document.body.classList.add('active');
    setLiveText('En écoute…');
    setStatus('Session active', 'active');
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      fail('Micro refusé. Autorisez l’accès au microphone pour parler à Iris.');
    } else {
      fail(err?.message || 'Impossible de démarrer la session.');
    }
  } finally {
    connecting = false;
    btnStart.removeAttribute('disabled');
  }
}

function handleMessage(message) {
  const sc = message.serverContent;
  // Barge-in: the human started talking, model output is cut — flush playback.
  if (sc && sc.interrupted) {
    playNode?.port.postMessage({ type: 'flush' });
    setLiveText('En écoute…');
    return;
  }
  // Audio frames live in modelTurn.parts[].inlineData (base64 PCM @ 24 kHz).
  const parts = sc?.modelTurn?.parts;
  if (parts) {
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data && part.inlineData.mimeType?.startsWith('audio/')) {
        const buf = base64ToInt16Buffer(data);
        playNode?.port.postMessage({ type: 'push', buffer: buf }, [buf]);
      }
    }
  }
}

function stop() {
  const s = session;
  session = null;
  try { s?.close(); } catch (_) {}
  micNode?.port.close?.();
  micNode?.disconnect();
  playNode?.disconnect();
  micStream?.getTracks().forEach((t) => t.stop());
  inCtx?.close();
  outCtx?.close();
  micNode = playNode = micStream = inCtx = outCtx = null;

  document.body.classList.remove('active');
  setBars(0);
  setStatus('En veille', 'idle');
}

function fail(msg) {
  showError(msg);
  stop();
}

// ── Wiring ───────────────────────────────────────────────────────────────
btnStart.addEventListener('click', () => start(''));
btnStop.addEventListener('click', stop);
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => start(chip.dataset.theme || ''));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') stop();
});

// CTA hover → "Prête" (green dot) when idle, mirroring the original.
btnStart.addEventListener('mouseenter', () => {
  if (!document.body.classList.contains('active') && !connecting) setStatus('Prête', 'ready');
});
btnStart.addEventListener('mouseleave', () => {
  if (!document.body.classList.contains('active') && !connecting) setStatus('En veille', 'idle');
});

// Soft parallax — orb follows the cursor (±18px).
if (orbWrap && !reduceMotion) {
  document.addEventListener('mousemove', (e) => {
    const dx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    orbWrap.style.setProperty('--px', (dx * 18).toFixed(1) + 'px');
    orbWrap.style.setProperty('--py', (dy * 18).toFixed(1) + 'px');
  });
  document.addEventListener('mouseleave', () => {
    orbWrap.style.setProperty('--px', '0px');
    orbWrap.style.setProperty('--py', '0px');
  });
}
