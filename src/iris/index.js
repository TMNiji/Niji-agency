// Iris — browser voice + chat session shell.
//
// Voice: POST /api/iris-token → ephemeral Gemini token (+ server-built greeting +
// locked model) → open mic → connect to the Gemini Live API over WebSocket →
// stream 16 kHz PCM up, play 24 kHz PCM down. The prompt/voice/model are locked
// server-side into the token, so nothing sensitive lives in this bundle.
//
// Chat: POST /api/iris-chat → same persona + knowledge, text only (Gemini flash).
// The API key stays server-side there too.
//
// All visual state is driven from real session + audio events: the status pill,
// body.active, the "Iris parle / En écoute" line, and the crystal-video
// reactivity (scale / brightness / playback rate follow Iris's real RMS).
import { GoogleGenAI, Modality } from '@google/genai';

const SAMPLE_RATE_INPUT = 16000;
const SAMPLE_RATE_OUTPUT = 24000;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── DOM ──────────────────────────────────────────────────────────────────
const video = document.getElementById('iris-video');
const pill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const stateLive = document.getElementById('state-live');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const errorMsg = document.getElementById('error-msg');

// ── Session state ──────────────────────────────────────────────────────────
let session = null;
let micStream = null;
let inCtx = null;
let outCtx = null;
let micNode = null;
let playNode = null;
let connecting = false;
let active = false;

// Crystal-video reactivity. While a session is live this holds Iris's real RMS
// (0 when she's silent/listening, up when she speaks); null hands the loop back
// to the idle "breathing" envelope.
let externalLevel = null;

// ── Video autoplay (muted; relaunch on first interaction if blocked) ─────────
if (video) {
  video.muted = true;
  video.playbackRate = 1.0; // already slowed (iris-web-slow)
  const play = () => video.play().catch(() => {});
  play();
  window.addEventListener('pointerdown', play, { once: true });
}

// ── Film grain — 256×256 tile of random grey pixels, static overlay ──────────
(function initNoise() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(S, S), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  const n = document.createElement('div');
  n.id = 'noise';
  n.style.backgroundImage = `url(${c.toDataURL()})`;
  document.body.appendChild(n);
})();

// ── Glitch title "Iris" — glyph-scramble decode ──────────────────────────────
const nameEl = document.querySelector('.name');
const GLYPHS = '!<>-_\\/[]{}—=+*^?#________01∮ABCDEF0123456789';
const randGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
function scrambleDecode(el, text, duration = 900, stagger = 95) {
  const start = performance.now();
  const chars = text.split('');
  function step(now) {
    const t = now - start;
    let buf = '';
    for (let i = 0; i < chars.length; i++) {
      const tg = chars[i];
      if (tg === ' ') { buf += tg; continue; }
      buf += (t >= stagger * i + 220) ? tg : randGlyph();
    }
    el.textContent = buf;
    if (t < duration) requestAnimationFrame(step);
    else el.textContent = text;
  }
  requestAnimationFrame(step);
}
if (nameEl && !reduceMotion) {
  const NAME = nameEl.textContent.trim();
  setTimeout(() => { if (!document.hidden) scrambleDecode(nameEl, NAME, 1000, 110); }, 850);
  setInterval(() => { if (!document.hidden) scrambleDecode(nameEl, NAME, 700, 80); }, 6500);
}

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
let liveTxt = '';
function setLiveText(txt) {
  if (txt !== liveTxt) { liveTxt = txt; stateLive.textContent = txt; }
}

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

// ── Voice session lifecycle ──────────────────────────────────────────────
async function start(theme) {
  if (connecting || session) return;
  connecting = true;
  clearError();
  if (document.body.classList.contains('chat-open')) closeChat();
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
      if (m.type === 'level') externalLevel = m.level;        // drives the crystal
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

    active = true;
    externalLevel = 0; // real-audio mode for the crystal loop
    document.body.classList.add('active');
    setLiveText('En écoute…');
    setStatus('En écoute', 'active');
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
  if (!session && !active) return;
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

  active = false;
  externalLevel = null; // back to idle breathing
  document.body.classList.remove('active');
  setStatus('En veille', 'idle');
}

function fail(msg) {
  showError(msg);
  stop();
}

// ── Crystal reactivity loop — scale / brightness / playback rate ─────────────
const t0 = performance.now();
let displayLevel = 0.12;
function frame() {
  requestAnimationFrame(frame);
  const time = (performance.now() - t0) / 1000;

  // Real audio (Iris's RMS) when live; gentle breathing when idle.
  const target = externalLevel !== null
    ? externalLevel
    : 0.12 + 0.06 * Math.sin(time * 0.7);
  displayLevel += (target - displayLevel) * 0.14;

  if (video && !reduceMotion) {
    const scale = 1.0 + 0.06 * displayLevel;
    video.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;
    video.style.filter = `brightness(${(0.96 + 0.30 * displayLevel).toFixed(3)}) saturate(${(1.0 + 0.55 * displayLevel).toFixed(3)})`;
    const rate = active ? (1.0 + 0.35 * displayLevel) : 1.0;
    if (Math.abs(video.playbackRate - rate) > 0.02) video.playbackRate = rate;
  }
}
frame();

// ── Written chat (POST /api/iris-chat) ───────────────────────────────────
const chatThread = document.getElementById('chat-thread');
const chatField = document.getElementById('chat-field');
const GREETING = "Bonjour, je suis Iris, la voix de l'agence Niji. Avec qui ai-je le plaisir d'échanger ?";
let chatHistory = [];
let chatGreeted = false;
let chatWaiting = false;

function renderMsg(role, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + (role === 'user' ? 'user' : 'iris');
  d.textContent = text;
  chatThread.appendChild(d);
  chatThread.scrollTop = chatThread.scrollHeight;
}
function showTyping(on) {
  let ex = document.getElementById('chat-typing');
  if (on) {
    if (ex) return;
    const d = document.createElement('div');
    d.className = 'msg iris typing'; d.id = 'chat-typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    chatThread.appendChild(d); chatThread.scrollTop = chatThread.scrollHeight;
  } else if (ex) { ex.remove(); }
}
function openChat() {
  if (active || connecting) stop();
  document.body.classList.add('chat-open');
  if (!chatGreeted) {
    renderMsg('iris', GREETING);
    chatHistory.push({ role: 'model', text: GREETING });
    chatGreeted = true;
  }
  setTimeout(() => chatField && chatField.focus(), 80);
}
function closeChat() {
  document.body.classList.remove('chat-open');
}
async function sendChat() {
  if (chatWaiting) return;
  const t = (chatField.value || '').trim();
  if (!t) return;
  chatField.value = '';
  chatHistory.push({ role: 'user', text: t });
  renderMsg('user', t);
  chatWaiting = true;
  showTyping(true);
  try {
    const res = await fetch('/api/iris-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory }),
    });
    let reply = '';
    if (res.ok) {
      reply = (await res.json())?.reply || '';
    } else {
      let detail = '';
      try { detail = (await res.json())?.error || ''; } catch (_) {}
      console.error('[iris] chat endpoint', res.status, detail);
    }
    if (!reply) reply = 'Désolée, je n’ai pas pu répondre. Réessayez dans un instant.';
    chatHistory.push({ role: 'model', text: reply });
    renderMsg('iris', reply);
  } catch (err) {
    console.error('[iris] chat', err);
    renderMsg('iris', 'Connexion impossible pour le moment. Réessayez dans un instant.');
  } finally {
    chatWaiting = false;
    showTyping(false);
  }
}

// ── Wiring ───────────────────────────────────────────────────────────────
btnStart.addEventListener('click', () => start(''));
btnStop.addEventListener('click', stop);
document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => start(chip.dataset.theme || ''));
});

const btnChat = document.getElementById('btn-chat');
const btnChatClose = document.getElementById('chat-close');
const btnChatSend = document.getElementById('chat-send');
if (btnChat) btnChat.addEventListener('click', openChat);
if (btnChatClose) btnChatClose.addEventListener('click', closeChat);
if (btnChatSend) btnChatSend.addEventListener('click', sendChat);
if (chatField) {
  chatField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendChat(); }
  });
}

// CTA hover → "Prête" (green dot) when idle, mirroring the original.
btnStart.addEventListener('mouseenter', () => {
  if (!active && !connecting && !document.body.classList.contains('chat-open')) setStatus('Prête', 'ready');
});
btnStart.addEventListener('mouseleave', () => {
  if (!active && !connecting && !document.body.classList.contains('chat-open')) setStatus('En veille', 'idle');
});

// Escape: close the chat if open, otherwise stop the voice session.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.body.classList.contains('chat-open') ? closeChat() : stop();
  }
});
