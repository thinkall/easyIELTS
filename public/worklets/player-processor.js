// Plays queued Float32 audio chunks pushed from the main thread.
class PlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.current = null;
    this.offset = 0;
    this.port.onmessage = (e) => {
      if (e.data === "flush") { this.queue = []; this.current = null; this.offset = 0; }
      else this.queue.push(e.data);
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    for (let i = 0; i < out.length; i++) {
      if (!this.current || this.offset >= this.current.length) {
        this.current = this.queue.shift() || null;
        this.offset = 0;
      }
      out[i] = this.current ? this.current[this.offset++] : 0;
    }
    return true;
  }
}
registerProcessor("player-processor", PlayerProcessor);