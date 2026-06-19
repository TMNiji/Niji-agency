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
// body.active, the "Iris parle / En écoute" line, and the decomposed-flower
// canvas reactivity (scale / brightness / pollen follow Iris's real RMS).
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

// ── Source video (hidden; decoded only to feed the decomposed-flower canvas) ──
if (video) {
  video.muted = true;
  video.playbackRate = 0.4; // fleur-web.mp4 is full-speed; slow it down here
  const play = () => video.play().catch(() => {});
  play();
  window.addEventListener('pointerdown', play, { once: true });
}

// ── Decomposed iris flower (canvas #fx) ──────────────────────────────────────
// The hidden source video is redrawn into a canvas as displaced rectangular
// blocks (kinetic decomposition, re-shuffled periodically) plus three circular
// "lens" portals showing zoomed fragments. The video's black background is
// dropped via mix-blend:screen (CSS). The whole canvas scales / brightens on
// Iris's real voice level.
const fx = document.getElementById('fx');
const fctx = fx ? fx.getContext('2d') : null;
const FXW = 1280, FXH = 600, COLS = 5, ROWS = 6; // FXH<720 crops the stem at the bottom
let blocks = [];
function regenBlocks(intensity) {
  const bw = FXW / COLS, bh = FXH / ROWS;
  const had = blocks.length === COLS * ROWS;
  const nb = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const prev = had ? blocks[nb.length] : null;
    const shift = Math.random() < (0.42 + 0.20 * intensity);
    nb.push({
      c, r,
      ox: prev ? prev.ox : 0, oy: prev ? prev.oy : 0,                 // current offset (lerped)
      tox: shift ? (Math.random() - 0.5) * (0.55 + 0.8 * intensity) * bw : 0,
      toy: shift ? (Math.random() - 0.5) * (0.40 + 0.6 * intensity) * bh : 0, // target
      a: prev ? prev.a : 1, ta: Math.random() < 0.12 ? 0 : 1,         // current / target alpha
    });
  }
  blocks = nb;
}
regenBlocks(0.5);
setInterval(() => { if (!document.hidden && !reduceMotion) regenBlocks(active ? 0.82 : 0.5); }, 5000);

// Lens portals: circular windows showing zoomed fragments of the flower.
const LENSES = [
  { x: 0.64, y: 0.23, r: 0.090, zoom: 1.7,  sx: 0.55, sy: 0.40 },
  { x: 0.73, y: 0.52, r: 0.105, zoom: 1.5,  sx: 0.50, sy: 0.50 },
  { x: 0.35, y: 0.65, r: 0.075, zoom: 1.95, sx: 0.45, sy: 0.46 },
];

// ── Particles / pollen (full-screen canvas #dust) ────────────────────────────
const dust = document.getElementById('dust');
const dctx = dust ? dust.getContext('2d') : null;
const DPRp = Math.min(window.devicePixelRatio || 1, 2);
const dot = document.createElement('canvas'); dot.width = dot.height = 64;
(() => {
  const g = dot.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
})();
let parts = [];
function dustResize() {
  if (!dust) return;
  dust.width = Math.floor(window.innerWidth * DPRp);
  dust.height = Math.floor(window.innerHeight * DPRp);
}
const PCENTER = { x: 0.5, y: 0.42 }; // explosion focus = heart of the flower
function spawnPart(p, spread) {
  p.ang = Math.random() * 6.2832;
  p.dist = spread ? Math.random() * 0.9 : Math.random() * 0.04;        // at load = already scattered
  p.spd = 0.00045 + Math.random() * 0.0013;                            // slow outward drift
  const big = Math.random() < 0.12;
  p.r = (big ? 6 + Math.random() * 10 : 0.6 + Math.random() * 3.4) * DPRp;
  p.baseA = big ? 0.12 + Math.random() * 0.22 : 0.28 + Math.random() * 0.72;
  p.tw = Math.random() * 6.2832;
}
function initParts() {
  const N = Math.min(340, Math.floor(window.innerWidth * 0.26));
  parts = [];
  for (let i = 0; i < N; i++) { const p = {}; spawnPart(p, true); parts.push(p); }
}
if (dust) { dustResize(); initParts(); window.addEventListener('resize', () => { dustResize(); initParts(); }); }

// ── "Data" layer — sparse normalised numbers that flicker (machine reading) ───
const dataEl = document.getElementById('data');
if (dataEl && !reduceMotion) {
  const N = 18;
  const spans = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const val = () => Math.random().toFixed(7); // 0.xxxxxxx
  for (let i = 0; i < N; i++) {
    const s = document.createElement('span');
    s.textContent = val();
    s.style.left = rnd(27, 69).toFixed(1) + '%'; // central band around the flower
    s.style.top  = rnd(11, 86).toFixed(1) + '%';
    s.style.opacity = rnd(0.14, 0.5).toFixed(2);
    dataEl.appendChild(s);
    spans.push(s);
  }
  setInterval(() => { // flicker / "live" update
    if (document.hidden) return;
    const k = 3 + ((Math.random() * 3) | 0);
    for (let j = 0; j < k; j++) {
      const s = spans[(Math.random() * spans.length) | 0];
      s.textContent = val();
      s.style.opacity = rnd(0.14, 0.55).toFixed(2);
    }
  }, 420);
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

// ── Flower reactivity loop — draws the canvas + drives scale / brightness ─────
// The flower "beats" on Iris's real voice: externalLevel (her live RMS, 0 when
// silent/listening) feeds a fast-attack / slow-release envelope follower, so
// each burst of speech lands a pulse and the heart settles when she goes quiet.
const t0 = performance.now();
let displayLevel = 0.12;
let _pulse = 0;
function frame() {
  requestAnimationFrame(frame);
  const time = (performance.now() - t0) / 1000;

  // Real audio (Iris's RMS) when live; gentle breathing when idle.
  const target = externalLevel !== null
    ? externalLevel
    : 0.12 + 0.06 * Math.sin(time * 0.7);
  displayLevel += (target - displayLevel) * 0.14;

  // Voice-locked throb: fast attack so the beat rides each speech burst, slow
  // release so the heart relaxes when Iris falls silent.
  const voice = active ? Math.max(0, externalLevel !== null ? externalLevel : 0) : 0;
  if (voice > _pulse) _pulse += (voice - _pulse) * 0.45;
  else                _pulse += (voice - _pulse) * 0.08;
  const hb = (active && !reduceMotion) ? _pulse : 0;
  // micro-breath while the session is open (the flower stays alive even listening)
  const aliveBreath = (active && !reduceMotion) ? 0.010 * (0.5 + 0.5 * Math.sin(time * 0.9)) : 0;

  // draw the decomposed flower as displaced rectangular blocks
  if (fctx && video && video.readyState >= 2) {
    fctx.clearRect(0, 0, FXW, FXH);
    const bw = FXW / COLS, bh = FXH / ROWS;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      b.ox += (b.tox - b.ox) * 0.04;             // slow glide toward target (kinetic decomposition)
      b.oy += (b.toy - b.oy) * 0.04;
      b.a  += (b.ta - b.a) * 0.045;              // fade blocks in / out
      if (b.a < 0.02) continue;
      const sx = b.c * bw, sy = b.r * bh;
      fctx.globalAlpha = b.a;
      fctx.drawImage(video, sx, sy, bw, bh, sx + b.ox, sy + b.oy, bw, bh);
    }
    fctx.globalAlpha = 1;
    // lens portals: zoomed fragments of the flower, ringed with a thin white circle
    for (let i = 0; i < LENSES.length; i++) {
      const L = LENSES[i];
      const cx = L.x * FXW, cy = L.y * FXH, R = L.r * FXH, s = (2 * R) / L.zoom;
      fctx.save();
      fctx.beginPath(); fctx.arc(cx, cy, R, 0, 6.2832); fctx.clip();
      fctx.drawImage(video, L.sx * FXW - s / 2, L.sy * FXH - s / 2, s, s, cx - R, cy - R, 2 * R, 2 * R);
      fctx.restore();
      fctx.beginPath(); fctx.arc(cx, cy, R, 0, 6.2832);
      fctx.lineWidth = 1.4; fctx.strokeStyle = 'rgba(245,245,245,0.5)'; fctx.stroke();
    }
  }
  // scale / brightness on the canvas + playback rate on the source video
  if (fx && !reduceMotion) {
    const scale = 1.0 + 0.06 * displayLevel + aliveBreath + 0.095 * hb;
    fx.style.transform = `translate(-50%,-50%) scale(${scale.toFixed(3)})`;
    // beat goes through scale (legible) + a neutral white flash; NOT saturate,
    // which would revive the flower's chromatic fringe behind the button.
    fx.style.filter = `brightness(${(0.96 + 0.30 * displayLevel + 0.34 * hb).toFixed(3)}) saturate(${(1.0 + 0.55 * displayLevel).toFixed(3)})`;
  }
  if (video) {
    const rate = active ? (0.34 + 0.18 * displayLevel) : 0.32;
    if (Math.abs(video.playbackRate - rate) > 0.02) video.playbackRate = rate;
  }

  // particles / pollen (slow drift + twinkle, jets out on each voice burst)
  if (dctx) {
    dctx.clearRect(0, 0, dust.width, dust.height);
    const asp = dust.width / dust.height;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.dist += p.spd * (0.7 + 0.7 * displayLevel + 0.8 * hb);
      p.tw += 0.022;
      if (p.dist > 0.828) spawnPart(p, false);   // recycle at center = continuous jet
      const x = (PCENTER.x + Math.cos(p.ang) * p.dist) * dust.width;
      const y = (PCENTER.y + Math.sin(p.ang) * p.dist / asp) * dust.height;
      const fade = Math.min(1, p.dist / 0.09) * (1 - p.dist / 0.828); // fade near center + at edges
      const a = Math.min(1, p.baseA * fade * (0.6 + 0.4 * Math.sin(p.tw)) * (0.85 + 0.5 * displayLevel));
      if (a <= 0.01) continue;
      const sz = p.r * (0.85 + 0.4 * Math.sin(p.tw * 0.7));
      dctx.globalAlpha = a;
      dctx.drawImage(dot, x - sz, y - sz, sz * 2, sz * 2);
    }
    dctx.globalAlpha = 1;
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
