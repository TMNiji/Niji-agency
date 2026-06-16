// Playback worklet. Iris streams 24 kHz PCM, but — as with capture — we can't
// assume the output AudioContext actually runs at 24 kHz (Safari may force
// 48 kHz), so we resample from SOURCE_RATE to the context's real `sampleRate`
// with linear interpolation. Pitch stays correct on every browser.
//
// Two behaviours ported from iris.py's output callback:
//  • flush (barge-in): when the human starts talking the model is interrupted,
//    so we ramp the current audio down over FADE_MS and drop the queue — no
//    click, no leftover speech.
//  • level reporting: we emit a smoothed RMS so the UI equalizer reflects Iris's
//    actual voice instead of a fixed animation.
const SOURCE_RATE = 24000;
const FADE_MS = 12;

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._step = SOURCE_RATE / sampleRate; // source samples advanced per output sample
    this._queue = []; // Float32Array chunks at SOURCE_RATE
    this._chunk = null;
    this._pos = 0; // fractional read cursor into _chunk
    this._fading = false;
    this._fadeLeft = 0;
    this._fadeTotal = Math.max(1, Math.round((sampleRate * FADE_MS) / 1000));
    this._level = 0;
    this._sinceLevel = 0;
    this._wasPlaying = false;

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'push') {
        // Int16 → Float32 once, here, so the hot render loop only interpolates.
        const i16 = new Int16Array(msg.buffer);
        const f32 = new Float32Array(i16.length);
        for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
        this._queue.push(f32);
      } else if (msg.type === 'flush') {
        if (this._chunk || this._queue.length) {
          this._fading = true;
          this._fadeLeft = this._fadeTotal;
        } else {
          this._reset();
        }
      }
    };
  }

  _reset() {
    this._queue = [];
    this._chunk = null;
    this._pos = 0;
    this._fading = false;
  }

  // Linear-interpolated read of one output sample; advances the fractional
  // cursor and rolls over to the next queued chunk as needed.
  _sample() {
    if (!this._chunk || this._pos >= this._chunk.length) {
      this._chunk = this._queue.shift() || null;
      this._pos = 0;
      if (!this._chunk) return null;
    }
    const i = Math.floor(this._pos);
    const frac = this._pos - i;
    const a = this._chunk[i];
    const b = i + 1 < this._chunk.length ? this._chunk[i + 1] : a;
    this._pos += this._step;
    return a + (b - a) * frac;
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    let sum = 0;

    for (let i = 0; i < out.length; i++) {
      let s = this._sample();
      if (s === null) {
        out[i] = 0;
        continue;
      }
      if (this._fading) {
        s *= this._fadeLeft / this._fadeTotal;
        this._fadeLeft--;
        if (this._fadeLeft <= 0) {
          out[i] = s;
          this._reset();
          continue;
        }
      }
      out[i] = s;
      sum += s * s;
    }

    const rms = Math.sqrt(sum / out.length);
    this._level = Math.max(rms, this._level * 0.85);
    this._sinceLevel += out.length;
    if (this._sinceLevel >= 256) {
      this._sinceLevel = 0;
      this.port.postMessage({ type: 'level', level: Math.min(1, this._level * 2.2) });
    }

    const playing = !!this._chunk || this._queue.length > 0;
    if (playing !== this._wasPlaying) {
      this._wasPlaying = playing;
      this.port.postMessage({ type: playing ? 'playing' : 'drained' });
    }
    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
