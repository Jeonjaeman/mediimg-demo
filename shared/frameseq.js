/**
 * MEDIIMG demo shared module — scroll-scrubbed image sequence on a <canvas>.
 *
 *   import { FrameSequence } from '../shared/frameseq.js';
 *   const seq = new FrameSequence({
 *     canvas: document.querySelector('#seq'),
 *     count: 121,                                              // number of frames
 *     url: (i) => `../assets/seq/specimen/${String(i + 1).padStart(4, '0')}.webp`,   // i is 0-based
 *     fit: 'cover',                                            // 'cover' | 'contain'
 *     background: '#060b16',                                   // painted behind 'contain' frames (or null for transparent)
 *     onProgress: (loaded, total) => {},                       // preload progress
 *   });
 *   await seq.load();            // resolves when the first frame is ready; the rest keep streaming in
 *   seq.draw(progress01);        // call from a ScrollTrigger onUpdate / rAF with 0..1
 *
 * Frames that are not loaded yet fall back to the nearest loaded one, so scrubbing never shows a blank canvas.
 */
export class FrameSequence {
  constructor({ canvas, count, url, fit = 'cover', background = null, onProgress = null, maxDpr = 2, focus = [0.5, 0.5] }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.count = count;
    this.url = url;
    this.fit = fit;
    this.background = background;
    this.onProgress = onProgress;
    this.maxDpr = maxDpr;
    this.focus = focus;
    this.images = new Array(count).fill(null);
    this.loaded = 0;
    this.current = -1;
    this.progress = 0;
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.current = -1;
      this.draw(this.progress);
    }
  }

  _loadOne(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.images[i] = img;
        this.loaded++;
        if (this.onProgress) this.onProgress(this.loaded, this.count);
        if (this.current === -1 || this._nearest(Math.round(this.progress * (this.count - 1))) === i) { this.current = -1; this.draw(this.progress); }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.url(i);
    });
  }

  /** resolves once frame 0 is drawn; remaining frames load in a coarse-to-fine order */
  async load() {
    await this._loadOne(0);
    this.draw(0);
    const order = [];
    for (let step = 16; step >= 1; step = Math.floor(step / 2)) {
      for (let i = 0; i < this.count; i += step) if (!order.includes(i) && i !== 0) order.push(i);
      if (step === 1) break;
    }
    const pool = 6;
    let k = 0;
    const next = async () => { while (k < order.length) await this._loadOne(order[k++]); };
    this.ready = Promise.all(Array.from({ length: pool }, next));
    return this;
  }

  _nearest(i) {
    if (this.images[i]) return i;
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.images[i - d]) return i - d;
      if (i + d < this.count && this.images[i + d]) return i + d;
    }
    return -1;
  }

  draw(progress) {
    this.progress = Math.min(1, Math.max(0, progress));
    const i = this._nearest(Math.round(this.progress * (this.count - 1)));
    if (i < 0 || i === this.current) return;
    this.current = i;
    const img = this.images[i], c = this.canvas, ctx = this.ctx;
    const cw = c.width, ch = c.height, iw = img.naturalWidth, ih = img.naturalHeight;
    const s = this.fit === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
    const w = iw * s, h = ih * s;
    const x = (cw - w) * this.focus[0], y = (ch - h) * this.focus[1];
    if (this.background) { ctx.fillStyle = this.background; ctx.fillRect(0, 0, cw, ch); } else ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
  }

  destroy() { window.removeEventListener('resize', this._resize); }
}
