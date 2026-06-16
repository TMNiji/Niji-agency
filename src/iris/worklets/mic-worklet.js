// Mic capture worklet. We can't assume the AudioContext honoured a requested
// 16 kHz rate — Safari in particular locks to the hardware rate (often 48 kHz).
// So we resample from the context's real rate (`sampleRate`, a worklet global)
// down to the target with linear interpolation, convert Float32 → Int16 PCM,
// and hand ~100 ms chunks to the main thread. Speech tolerates linear resampling
// fine and it keeps the processor cheap.
const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100 ms @ 16 kHz

class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / TARGET_RATE; // input samples per output sample
    this._readPos = 0; // fractional read cursor into the input stream
    this._buf = new Int16Array(CHUNK_SAMPLES);
    this._n = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];

    // Walk the fractional cursor across this render quantum, emitting one output
    // sample per TARGET_RATE step. _readPos carries the remainder between blocks.
    while (this._readPos < ch.length) {
      const i = Math.floor(this._readPos);
      const frac = this._readPos - i;
      const a = ch[i];
      const b = i + 1 < ch.length ? ch[i + 1] : ch[i];
      let s = a + (b - a) * frac;
      s = s < -1 ? -1 : s > 1 ? 1 : s;
      this._buf[this._n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this._n === CHUNK_SAMPLES) {
        const out = this._buf.slice(0, CHUNK_SAMPLES);
        this.port.postMessage(out.buffer, [out.buffer]);
        this._n = 0;
      }
      this._readPos += this._ratio;
    }
    this._readPos -= ch.length; // carry remainder into the next block
    return true;
  }
}

registerProcessor('mic-processor', MicProcessor);
