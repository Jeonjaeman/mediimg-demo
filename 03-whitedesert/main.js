import { FrameSequence } from '../shared/frameseq.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad = (n, l = 2) => String(n).padStart(l, '0');

const body = document.body;
const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => window.innerWidth <= 820;

/* --------------------------------------------------------------------------
   layout helpers: scrollbar-free vw unit, fit-to-width display type
   -------------------------------------------------------------------------- */
const heroTitle = $('#heroTitle');
const footerWord = $('.footer-word');

function fitText(el, ratio, maxPx) {
  const inner = $('.fit', el);
  const base = 200;
  el.style.fontSize = base + 'px';
  const w = inner.offsetWidth || 1;
  let fs = base * (el.clientWidth * ratio) / w;
  if (maxPx) fs = Math.min(fs, maxPx);
  el.style.fontSize = fs.toFixed(2) + 'px';
  return fs;
}

function layout() {
  root.style.setProperty('--vw', (root.clientWidth / 100) + 'px');
  const fs = fitText(heroTitle, 0.955, window.innerHeight * 0.52);
  root.style.setProperty('--title-h', (fs * 0.775).toFixed(1) + 'px');
  fitText(footerWord, 0.94);
}
layout();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); ScrollTrigger.refresh(); });

/* --------------------------------------------------------------------------
   smooth scroll
   -------------------------------------------------------------------------- */
let lenis = null;
if (!reduce && Lenis) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* --------------------------------------------------------------------------
   1. hero — MRI bore sequence
   -------------------------------------------------------------------------- */
const loaderBar = $('#loaderBar');
const loaderNum = $('#loaderNum');
const seqUrl = (name) => (i) => `../assets/seq/${name}/${pad(i + 1, 4)}.webp`;

/* The shared player gives up on a frame after one failed request. This thin wrapper (shared file untouched)
   retries a few times so a busy server never leaves holes in the sequence. */
class Sequence extends FrameSequence {
  _loadOne(i, attempt = 0) {
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
      img.onerror = () => {
        if (attempt >= 3) { resolve(); return; }
        window.setTimeout(() => this._loadOne(i, attempt + 1).then(resolve), 350 * (attempt + 1));
      };
      img.src = this.url(i);
    });
  }

  /* same coarse-to-fine order as the shared loader, but three gentle workers instead of six */
  async load() {
    await this._loadOne(0);
    this.draw(0);
    const order = [];
    for (let step = 16; step >= 1; step = Math.floor(step / 2)) {
      for (let i = 0; i < this.count; i += step) if (i !== 0 && !order.includes(i)) order.push(i);
      if (step === 1) break;
    }
    let k = 0;
    const pause = () => new Promise((r) => window.setTimeout(r, 8));
    const next = async () => { while (k < order.length) { await this._loadOne(order[k++]); await pause(); } };
    this.ready = Promise.all([next(), next(), next()]);
    return this;
  }
}

const heroSeq = new Sequence({
  canvas: $('#heroSeq'),
  count: 97,
  url: seqUrl('bore'),
  fit: 'cover',
  onProgress: (loaded, total) => {
    const v = loaded / total;
    loaderBar.style.transform = `scaleX(${v})`;
    loaderNum.textContent = pad(Math.round(v * 100), 3);
  },
});

const heroWhite = $('#heroWhite');
const heroFilm = $('.hero-film video');
const heroSides = $$('.hero-side');
const heroMeta = $('#heroMeta');
let heroP = 0;

function renderHero(p) {
  heroP = p;
  heroSeq.draw(clamp(p / 0.78));
  heroWhite.style.opacity = smooth(0.58, 0.76, p).toFixed(3);

  const t = clamp(p / 0.45);
  heroTitle.style.transform = `translate3d(0, ${(-t * 62).toFixed(2)}vh, 0)`;
  heroTitle.style.opacity = (1 - smooth(0.16, 0.42, p)).toFixed(3);
  heroTitle.style.filter = reduce ? '' : `blur(${(smooth(0.06, 0.42, p) * 16).toFixed(1)}px)`;

  const s = clamp(p / 0.6);
  const so = (1 - smooth(0.3, 0.55, p)).toFixed(3);
  heroSides.forEach((el) => {
    el.style.transform = `translate3d(0, ${(-s * 34).toFixed(2)}vh, 0)`;
    el.style.opacity = so;
    el.style.visibility = so <= 0 ? 'hidden' : 'visible';
  });
  heroMeta.style.opacity = (1 - smooth(0, 0.07, p)).toFixed(3);
  if (so <= 0) { if (!heroFilm.paused) heroFilm.pause(); } else if (heroFilm.paused) { heroFilm.play().catch(() => {}); }

  body.classList.toggle('nav-solid', p > 0.45);
  body.classList.toggle('tab-on', p > 0.3);
}

ScrollTrigger.create({
  trigger: '#hero', start: 'top top', end: 'bottom bottom',
  onUpdate: (self) => renderHero(self.progress),
  onRefresh: (self) => renderHero(self.progress),
});

/* --------------------------------------------------------------------------
   2. statement — gray vessel fills with colour
   -------------------------------------------------------------------------- */
const colorSeq = new Sequence({
  canvas: $('#colorSeq'),
  count: 97,
  url: seqUrl('colorize'),
  fit: 'cover',
  background: '#ffffff',
});
const unseenA = $('#unseenA');
const unseenB = $('#unseenB');
const unseenScale = $('#unseenScale');
const unseenCap = $('#unseenCap');
const unseenPct = $('#unseenPct');
const CAPS = ['TOF-MRA · 3D 혈관 재구성', 'SIG 컬러 매핑', 'NeuFlow · 3D 컬러 + SIG 수치'];
let capState = -1;

function renderUnseen(p) {
  const c = clamp((p - 0.1) / 0.72);
  colorSeq.draw(c);

  const a = smooth(0.4, 0.5, p);
  const b = smooth(0.5, 0.6, p);
  unseenA.style.opacity = (1 - a).toFixed(3);
  unseenA.style.transform = `translate3d(0, ${(-a * 26).toFixed(1)}px, 0)`;
  unseenB.style.opacity = b.toFixed(3);
  unseenB.style.transform = `translate3d(0, ${((1 - b) * 26).toFixed(1)}px, 0)`;

  unseenScale.style.opacity = smooth(0.08, 0.4, c).toFixed(3);
  unseenPct.textContent = pad(Math.round(c * 100), 3);
  const st = c < 0.04 ? 0 : c < 0.985 ? 1 : 2;
  if (st !== capState) { capState = st; unseenCap.textContent = CAPS[st]; }
}

ScrollTrigger.create({
  trigger: '#unseen', start: 'top top', end: 'bottom bottom',
  onUpdate: (self) => renderUnseen(self.progress),
  onRefresh: (self) => renderUnseen(self.progress),
});

/* --------------------------------------------------------------------------
   3. parallax banner / 8. full-bleed photo — image moves slower than the page
   -------------------------------------------------------------------------- */
if (!reduce) {
  gsap.fromTo('.method-media img', { yPercent: -10.7 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '#method', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.voice-media img', { yPercent: -13.8 }, {
    yPercent: 0, ease: 'none',
    scrollTrigger: { trigger: '#voice', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo('.cta-img img', { scale: 1.14 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.cta-img', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}

/* --------------------------------------------------------------------------
   4. process — hand-drawn underline + blur accordion
   -------------------------------------------------------------------------- */
if (!reduce) {
  gsap.fromTo('#scribble path', { strokeDashoffset: 1 }, {
    strokeDashoffset: 0, duration: 2.1, ease: 'power2.inOut',
    scrollTrigger: { trigger: '#scribble', start: 'top 82%', once: true },
  });
}

const accCards = $$('#acc .acc-card');
const accIndex = $$('#accIndex li');
function setAcc(i) {
  accCards.forEach((c, k) => c.classList.toggle('is-active', k === i));
  accIndex.forEach((c, k) => c.classList.toggle('is-active', k === i));
}
accCards.forEach((card, i) => {
  card.addEventListener('mouseenter', () => { if (!isMobile()) setAcc(i); });
  card.addEventListener('focus', () => setAcc(i));
  card.addEventListener('click', () => setAcc(i));
});
accIndex.forEach((li, i) => {
  li.addEventListener('mouseenter', () => setAcc(i));
  li.addEventListener('click', () => setAcc(i));
});

/* --------------------------------------------------------------------------
   5. quote — words ink in with the scroll
   -------------------------------------------------------------------------- */
const quoteText = $('#quoteText');
if (!reduce) {
  quoteText.innerHTML = quoteText.textContent.trim().split(/\s+/).map((w) => `<span>${w}</span>`).join(' ');
  gsap.fromTo($$('span', quoteText), { opacity: 0.14 }, {
    opacity: 1, ease: 'none', stagger: 0.5,
    scrollTrigger: { trigger: quoteText, start: 'top 82%', end: 'top 38%', scrub: true },
  });
}

/* --------------------------------------------------------------------------
   6. result — pillar mask opens to the teal field, then cards drift sideways
   -------------------------------------------------------------------------- */
const rSticky = $('#result .result-sticky');
const rPhoto = $('#resultPhoto');
const rTeal = $('#resultTeal');
const rTealImg = $('img', rTeal);
const rTrack = $('#resultTrack');
const rCards = $$('.rcard', rTrack);
const rImgs = rCards.map((c) => $('.rcard-in > img', c));
const rCap = $('#resultCap');
const rCount = $('#resultCount');
const rCountNum = $('b', rCount);
const rCountBar = $('em', rCount);
const PILLARS = 5;
const PILLAR_DELAY = [0.3, 0.07, 0.42, 0, 0.19];
const PILLAR_SPAN = 0.58;
let rW = 0, rCardW = 0, rLefts = [], rIdx = -1, rMaskDone = null;

function measureResult() {
  rW = rSticky.clientWidth;
  rCardW = rCards[0].offsetWidth;
  rLefts = rCards.map((c) => c.offsetLeft);
}

function setMask(size, pos) {
  rTeal.style.webkitMaskSize = size; rTeal.style.maskSize = size;
  rTeal.style.webkitMaskPosition = pos; rTeal.style.maskPosition = pos;
}

function renderResult(p) {
  if (!rW) measureResult();

  // phase A — five columns widen from their own centre lines, out of step with each other
  const pa = clamp(p / 0.2);
  if (pa >= 1) {
    if (rMaskDone !== true) { rMaskDone = true; setMask('100% 100%', '0 0'); }
  } else {
    rMaskDone = false;
    const colW = rW / PILLARS;
    const size = [], pos = [];
    for (let i = 0; i < PILLARS; i++) {
      const t = easeInOut(clamp((pa - PILLAR_DELAY[i]) / PILLAR_SPAN));
      const w = t <= 0 ? 0 : Math.ceil((colW + 2) * t);
      size.push(`${w}px 100%`);
      pos.push(`${Math.round(i * colW + colW / 2 - w / 2)}px 0`);
    }
    setMask(size.join(','), pos.join(','));
  }

  // phase B — the card track travels right → left
  const t = clamp((p - 0.17) / 0.8);
  const last = rLefts.length - 1;
  const x = lerp(rW * 1.02, rW / 2 - (rLefts[last] + rCardW / 2), t);
  rTrack.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
  rTealImg.style.transform = `translate3d(${(-t * 4).toFixed(2)}%, 0, 0) scale(1.14)`;

  let best = 0, bestD = Infinity;
  for (let i = 0; i < rCards.length; i++) {
    const d = (x + rLefts[i] + rCardW / 2 - rW / 2) / rW;
    if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = i; }
    if (rImgs[i]) rImgs[i].style.transform = `translate3d(${(-clamp(d, -1.3, 1.3) * 5).toFixed(2)}%, 0, 0)`;
  }
  if (best !== rIdx) { rIdx = best; rCountNum.textContent = pad(best + 1); }
  rCountBar.style.transform = `scaleX(${t.toFixed(4)})`;

  const ui = smooth(0.16, 0.23, p).toFixed(3);
  rCap.style.opacity = ui;
  rCount.style.opacity = ui;
}

ScrollTrigger.create({
  trigger: '#result', start: 'top top', end: 'bottom bottom',
  onUpdate: (self) => renderResult(self.progress),
  onRefresh: (self) => { measureResult(); renderResult(self.progress); },
});

if (!reduce) {
  // the dark photograph arrives as an inset plate and opens to full bleed
  gsap.fromTo(rPhoto, { clipPath: 'inset(14% 4.2% 0% 4.2%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
    scrollTrigger: { trigger: '#result', start: 'top bottom', end: 'top top', scrub: true },
  });
  gsap.from('#resultTitle > *', {
    opacity: 0, y: 40, duration: 1.2, ease: 'power3.out', stagger: 0.12,
    scrollTrigger: { trigger: '#result', start: 'top 55%', once: true },
  });
}

/* --------------------------------------------------------------------------
   7. numbers — count up once
   -------------------------------------------------------------------------- */
$$('[data-count]').forEach((el) => {
  const target = Number(el.dataset.count);
  const comma = el.dataset.comma === '1';
  const fmt = (v) => (comma ? Math.round(v).toLocaleString('en-US') : String(Math.round(v)));
  if (reduce) { el.textContent = fmt(target); return; }
  const o = { v: 0 };
  el.textContent = fmt(0);
  gsap.to(o, {
    v: target, duration: 1.3, ease: 'power3.out',
    onUpdate: () => { el.textContent = fmt(o.v); },
    scrollTrigger: { trigger: el, start: 'top 92%', once: true },
  });
});

/* --------------------------------------------------------------------------
   generic reveals
   -------------------------------------------------------------------------- */
if (!reduce) {
  const groups = new Map();
  $$('.ln').forEach((ln) => {
    const k = ln.parentElement;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(ln.firstElementChild);
  });
  groups.forEach((spans, parent) => {
    gsap.from(spans, {
      yPercent: 112, duration: 1.15, ease: 'power4.out', stagger: 0.09,
      scrollTrigger: { trigger: parent, start: 'top 84%', once: true },
    });
  });

  gsap.set('[data-reveal]', { opacity: 0, y: 26 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.05, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });

  gsap.from('.numbers-list li', {
    opacity: 0, y: 46, duration: 1.1, ease: 'power3.out', stagger: 0.12,
    scrollTrigger: { trigger: '.numbers-list', start: 'top 84%', once: true },
  });
  gsap.from('.hosp-list li', {
    opacity: 0, y: 18, duration: 0.9, ease: 'power2.out', stagger: 0.05,
    scrollTrigger: { trigger: '.hosp-list', start: 'top 90%', once: true },
  });
  gsap.from('.acc-card', {
    opacity: 0, y: 60, duration: 1.2, ease: 'power3.out', stagger: 0.07, clearProps: 'transform,opacity',
    scrollTrigger: { trigger: '#acc', start: 'top 88%', once: true },
  });
}

/* --------------------------------------------------------------------------
   images — below-the-fold photographs are queued (three at a time, in page order);
   every image gets a quiet retry cycle if the server drops a request
   -------------------------------------------------------------------------- */
$$('video').forEach((v) => {
  let tries = 0;
  v.addEventListener('error', () => { if (tries++ < 2) window.setTimeout(() => v.load(), 700 * tries); });
});
const queuedImages = $$('img[data-src]');
function loadQueuedImages() {
  let k = 0;
  const one = () => new Promise((resolve) => {
    const img = queuedImages[k++];
    const done = () => { img.removeEventListener('load', done); img.removeEventListener('error', done); resolve(); };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    img.src = img.dataset.src;
  });
  const worker = async () => { while (k < queuedImages.length) await one(); };
  return Promise.all([worker(), worker(), worker()]);
}

$$('img').forEach((img) => {
  let tries = 0;
  const retry = () => {
    if (tries >= 3) return;
    tries += 1;
    window.setTimeout(() => { const src = img.getAttribute('src'); img.removeAttribute('src'); img.setAttribute('src', src); }, 450 * tries);
  };
  img.addEventListener('error', retry);
  if (img.loading !== 'lazy' && img.complete && img.naturalWidth === 0) retry();
});

/* --------------------------------------------------------------------------
   nav — hides while reading down, returns on the way up
   -------------------------------------------------------------------------- */
let lastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  if (Math.abs(y - lastY) < 6) return;
  body.classList.toggle('nav-hidden', y > lastY && y > 140);
  lastY = y;
}, { passive: true });

/* --------------------------------------------------------------------------
   right tab + slide-in panel
   -------------------------------------------------------------------------- */
const tab = $('#tab');
const panel = $('#panel');
const panelClose = $('#panelClose');

function openPanel() {
  body.classList.add('panel-open');
  tab.setAttribute('aria-expanded', 'true');
  panel.setAttribute('aria-hidden', 'false');
  if (lenis) lenis.stop();
  window.setTimeout(() => panelClose.focus({ preventScroll: true }), 350);
}
function closePanel() {
  if (!body.classList.contains('panel-open')) return;
  body.classList.remove('panel-open');
  tab.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-hidden', 'true');
  if (lenis) lenis.start();
  tab.focus({ preventScroll: true });
}
tab.addEventListener('click', openPanel);
panelClose.addEventListener('click', closePanel);
$('#panelDim').addEventListener('click', closePanel);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

/* --------------------------------------------------------------------------
   resize
   -------------------------------------------------------------------------- */
let resizeW = window.innerWidth;
let resizeT = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeT);
  resizeT = window.setTimeout(() => {
    layout();
    measureResult();
    if (window.innerWidth !== resizeW) { resizeW = window.innerWidth; ScrollTrigger.refresh(); }
  }, 160);
});
window.addEventListener('load', () => { layout(); ScrollTrigger.refresh(); });

/* --------------------------------------------------------------------------
   preloader → intro (always released within ~2.4s, even if assets fail)
   -------------------------------------------------------------------------- */
let started = false;
function start() {
  if (started) return;
  started = true;
  layout();
  body.classList.remove('is-loading');
  // loading is staged — hero frames → colour frames → the photographs further down — so the page never
  // opens more than a few connections at once
  let restStarted = false;
  const loadRest = async () => {
    if (restStarted) return;
    restStarted = true;
    await colorSeq.load();
    await Promise.race([colorSeq.ready || Promise.resolve(), new Promise((r) => window.setTimeout(r, 1200))]);
    loadQueuedImages();
  };
  if (heroSeq.ready) heroSeq.ready.then(loadRest);
  window.setTimeout(loadRest, 2500);
  if (reduce) return;
  gsap.from('.hero-title b', { yPercent: 106, duration: 1.5, ease: 'power4.out', stagger: 0.06, delay: 0.3 });
  gsap.from(['.hero-tag-in', '.hero-film-in'], { opacity: 0, y: 26, duration: 1.3, ease: 'power3.out', stagger: 0.14, delay: 0.85 });
  gsap.from('.hero-meta > *', { opacity: 0, duration: 1.2, ease: 'power1.out', stagger: 0.1, delay: 1.2 });
  gsap.from('.nav > *', { opacity: 0, y: -14, duration: 1.1, ease: 'power3.out', stagger: 0.08, delay: 0.6, clearProps: 'all' });
}
const minShow = new Promise((r) => window.setTimeout(r, 700));
Promise.all([heroSeq.load(), minShow]).then(start).catch(start);
window.setTimeout(start, 2400);
