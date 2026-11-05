/* MEDIIMG demo 05 — specimen sequence + annotation UI */
import { FrameSequence } from '../shared/frameseq.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqDesk = matchMedia('(min-width: 900px)');

/* ---------------------------------------------------------------- smooth scroll */
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.4 }) : window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));

/* ---------------------------------------------------------------- hero : sequence */
const FRAMES = 121;
const IMG_W = 1600, IMG_H = 900;
const P30 = 29 / 120, P60 = 59 / 120;           // progress of the frames the anchors were measured on
const STEP_FROM = 0.665, STEP_TO = 0.975;        // scroll range of the 5-step accordion

const hero = $('#hero');
const stage = $('.hero__stage');
const canvas = $('#seq');
const loader = $('#loader'), loaderNum = $('#loaderNum'), loaderBar = $('#loaderBar');

/* The shared player is used as-is; this wrapper only caps parallel requests and retries a frame that failed to arrive. */
class SpecimenSequence extends FrameSequence {
  constructor(opts) { super(opts); this._busy = 0; this._queue = []; }
  async _loadOne(i) {
    if (this._busy >= 4) await new Promise((r) => this._queue.push(r)); else this._busy++;
    try {
      for (let attempt = 0; attempt < 4 && !this.images[i]; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
        await super._loadOne(i);
      }
    } finally {
      const next = this._queue.shift();
      if (next) next(); else this._busy--;
    }
  }
}

const seq = new SpecimenSequence({
  canvas,
  count: FRAMES,
  url: (i) => `../assets/seq/specimen/${pad(i + 1, 4)}.webp`,
  fit: 'cover',
  background: '#02050c',
  maxDpr: 1.5,
  onProgress: (loaded, total) => {
    const r = loaded / total;
    loaderNum.textContent = pad(Math.round(r * 100), 3);
    loaderBar.style.transform = `scaleX(${r})`;
  },
});

/* annotation anchors, in pixels of the 1600×900 frame. [at frame 1, at frame 30] / pins: [at frame 30, at frame 60] */
const BOXES = {
  a: { d: [[552, 452, 196, 150], [486, 500, 256, 196]], m: [[668, 348, 84, 160], [652, 360, 96, 214]] },
  b: { d: [[758, 282, 80, 80], [750, 280, 96, 96]], m: [[758, 282, 80, 80], [750, 280, 96, 96]] },
  c: { d: [[925, 480, 100, 120], [960, 525, 130, 150]], m: [[836, 348, 84, 160], [838, 362, 96, 214]] },
};
const LEADS = { m1: [[950, 292], [990, 290]] };
const PINS = {
  high: { d: [[800, 470], [795, 500]], m: [[805, 540], [800, 600]] },
  low: { d: [[470, 300], [340, 300]], m: [[712, 385], [680, 420]] },
  roi: { d: [[1030, 600], [1110, 700]], m: [[900, 300], [940, 295]] },
  m1: { d: [[990, 290], [1100, 285]], m: null },
};
const ZOOM = [[0, 1], [P30, 1.36], [P60, 1.75], [89 / 120, 2.55], [1, 4.2]];
const zoomAt = (p) => {
  for (let i = 1; i < ZOOM.length; i++) if (p <= ZOOM[i][0]) return lerp(ZOOM[i - 1][1], ZOOM[i][1], (p - ZOOM[i - 1][0]) / (ZOOM[i][0] - ZOOM[i - 1][0]));
  return ZOOM[ZOOM.length - 1][1];
};

const boxEls = $$('.abox').map((el) => ({ el, key: el.dataset.box }));
const leadEls = $$('.alead').map((el) => ({ el, key: el.dataset.lead }));
const pinEls = $$('.pin').map((el) => ({ el, key: el.dataset.pin }));
const stepEls = $$('.step');
const hudFrame = $('#hudFrame'), hudZoom = $('#hudZoom'), stepNow = $('#stepNow');

let geo = { s: 1, ox: 0, oy: 0 };
let heroP = 0, lastFrame = -1, curStep = 0;

function measureHero() {
  const c = canvas.getBoundingClientRect(), st = stage.getBoundingClientRect();
  const s = Math.max(c.width / IMG_W, c.height / IMG_H);
  geo = { s, ox: c.left - st.left + (c.width - IMG_W * s) * 0.5, oy: c.top - st.top + (c.height - IMG_H * s) * 0.5 };
}

function setStep(i) {
  curStep = i;
  stepEls.forEach((el, k) => el.classList.toggle('is-open', k === i));
  stepNow.textContent = pad(i + 1);
}

function renderHero(p) {
  heroP = p;
  seq.draw(p);
  const desk = mqDesk.matches, v = desk ? 'd' : 'm';

  if (p < 0.3) {
    const t = p / P30;
    for (const { el, key } of boxEls) {
      const [a, b] = BOXES[key][v];
      el.style.transform = `translate3d(${(geo.ox + lerp(a[0], b[0], t) * geo.s).toFixed(1)}px,${(geo.oy + lerp(a[1], b[1], t) * geo.s).toFixed(1)}px,0)`;
      el.style.width = `${(lerp(a[2], b[2], t) * geo.s).toFixed(1)}px`;
      el.style.height = `${(lerp(a[3], b[3], t) * geo.s).toFixed(1)}px`;
    }
    for (const { el, key } of leadEls) {
      const [a, b] = LEADS[key];
      el.style.transform = `translate3d(${(geo.ox + lerp(a[0], b[0], t) * geo.s).toFixed(1)}px,${(geo.oy + lerp(a[1], b[1], t) * geo.s).toFixed(1)}px,0)`;
    }
  }

  if (p > 0.12 && p < 0.64) {
    const t = (p - P30) / (P60 - P30);
    for (const { el, key } of pinEls) {
      const k = PINS[key][v];
      if (!k) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate3d(${(geo.ox + lerp(k[0][0], k[1][0], t) * geo.s).toFixed(1)}px,${(geo.oy + lerp(k[0][1], k[1][1], t) * geo.s).toFixed(1)}px,0)`;
    }
  }

  const f = Math.round(p * (FRAMES - 1)) + 1;
  if (f !== lastFrame) {
    lastFrame = f;
    hudFrame.textContent = `FRAME ${pad(f, 3)}/${FRAMES}`;
    hudZoom.textContent = `×${zoomAt(p).toFixed(2)}`;
  }

  const sp = clamp((p - STEP_FROM) / (STEP_TO - STEP_FROM), 0, 0.9999) * stepEls.length;
  const idx = Math.floor(sp);
  if (idx !== curStep) setStep(idx);
  stepEls[idx].style.setProperty('--prog', (sp - idx).toFixed(3));
}

/* scroll choreography of the sticky stage (timeline positions == scroll progress 0..1) */
const heroTl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
heroTl
  // A → out
  .to('.hero__foot', { autoAlpha: 0, y: 24, duration: 0.05 }, 0.05)
  .to('.hero__head', { autoAlpha: 0, y: -46, duration: 0.07 }, 0.07)
  .to('.anno', { autoAlpha: 0, duration: 0.05 }, 0.12)
  .to('.hero__scrim--a', { autoAlpha: 0, duration: 0.08 }, 0.1)
  // B → in
  .to('.hero__dim', { opacity: 0.3, duration: 0.08 }, 0.14)
  .to('.hero__scrim--b', { opacity: 1, duration: 0.07 }, 0.15)
  .fromTo('.hud', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, 0.16)
  .fromTo('.hero__kicker', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.03 }, 0.17)
  .fromTo('.hero__stmt .ln > span', { yPercent: 112 }, { yPercent: 0, duration: 0.05, stagger: 0.012, ease: 'power3.out' }, 0.175)
  .fromTo('.pin__in', { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.035, stagger: 0.024, ease: 'back.out(2.2)' }, 0.215)
  // B → out
  .to('.hero__state', { autoAlpha: 0, duration: 0.05 }, 0.53)
  .to('.hero__scrim--b', { opacity: 0, duration: 0.05 }, 0.53)
  // C → in
  .to('.hero__dim', { opacity: 0.5, duration: 0.07 }, 0.55)
  .fromTo('.steps__lead', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, 0.585)
  .fromTo('.step', { autoAlpha: 0, x: 46 }, { autoAlpha: 1, x: 0, duration: 0.045, stagger: 0.009, ease: 'power2.out' }, 0.585)
  .set({}, {}, 1);

const heroST = ScrollTrigger.create({
  trigger: hero,
  start: 'top top',
  end: 'bottom bottom',
  scrub: true,
  animation: heroTl,
  onUpdate: (self) => renderHero(self.progress),
  onRefresh: (self) => { measureHero(); renderHero(self.progress); },
});

stepEls.forEach((el, i) => {
  $('.step__head', el).addEventListener('click', () => {
    const y = heroST.start + (heroST.end - heroST.start) * (STEP_FROM + ((i + 0.5) * (STEP_TO - STEP_FROM)) / stepEls.length);
    scrollToY(y);
  });
});

window.addEventListener('resize', () => { measureHero(); renderHero(heroP); });

/* live readout on the SIG chip */
const liveSig = $('#liveSig');
setInterval(() => {
  if (heroP > 0.2 || document.hidden) return;
  liveSig.textContent = (4.33 + (Math.random() - 0.5) * 0.06).toFixed(2);
}, 1500);

/* ---------------------------------------------------------------- loader + intro */
const introTitle = $$('.hero__title .ln > span');
const introFade = ['.hero__btn', '.hero__sub', '.hero__scroll'];
if (!reduce) {
  gsap.set(introTitle, { yPercent: 112 });
  gsap.set(introFade, { autoAlpha: 0, y: 18 });
}
let loaderDone = false;
function finishLoader() {
  if (loaderDone) return;
  loaderDone = true;
  loader.classList.add('is-done');
  measureHero();
  renderHero(heroST.progress);
  if (!reduce) {
    gsap.to(introTitle, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
    gsap.to(introFade, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.55 });
  }
  [...boxEls, ...leadEls].forEach(({ el }, i) => setTimeout(() => el.classList.add('is-on'), reduce ? 0 : 650 + i * 230));
}
setTimeout(finishLoader, 2300);
Promise.all([seq.load(), new Promise((r) => setTimeout(r, 650))]).then(finishLoader, finishLoader);

/* ---------------------------------------------------------------- header */
const hd = $('#hd'), burger = $('#burger'), mnav = $('#mnav');
let menuOpen = false, lastY = window.scrollY;
$$('[data-tone]').forEach((sec) => {
  if (sec === hd) return;
  ScrollTrigger.create({
    trigger: sec, start: 'top 34px', end: 'bottom 34px',
    onToggle: (self) => { if (self.isActive) hd.dataset.tone = sec.dataset.tone; },
  });
});
ScrollTrigger.create({
  start: 0, end: 'max',
  onUpdate: (self) => {
    const y = self.scroll();
    if (Math.abs(y - lastY) < 8) return;
    hd.classList.toggle('is-hidden', y > lastY && y > 140 && !menuOpen);
    hd.classList.toggle('is-solid', y > 140 && !menuOpen);
    lastY = y;
  },
});
burger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  burger.setAttribute('aria-expanded', String(menuOpen));
  mnav.classList.toggle('is-open', menuOpen);
  mnav.setAttribute('aria-hidden', String(!menuOpen));
  if (menuOpen) { hd.dataset.prevTone = hd.dataset.tone; hd.dataset.tone = 'dark'; lenis && lenis.stop(); }
  else { hd.dataset.tone = hd.dataset.prevTone || 'dark'; lenis && lenis.start(); }
});
$$('.hd__lang button').forEach((b) => b.addEventListener('click', () => $$('.hd__lang button').forEach((o) => o.classList.toggle('is-on', o === b))));

/* ---------------------------------------------------------------- generic reveals */
if (!reduce) {
  $$('.js-lines').forEach((h) => {
    const spans = $$('.ln > span', h);
    gsap.set(spans, { yPercent: 112 });
    ScrollTrigger.create({
      trigger: h, start: 'top 88%', once: true,
      onEnter: () => gsap.to(spans, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.09 }),
    });
  });
  const reveals = $$('[data-reveal]');
  gsap.set(reveals, { autoAlpha: 0, y: 28 });
  ScrollTrigger.batch(reveals, {
    start: 'top 92%', once: true,
    onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.95, ease: 'power3.out', stagger: 0.08, overwrite: true }),
  });

  /* who : cards unmask + image drift */
  $$('[data-card-reveal]').forEach((card, i) => {
    gsap.fromTo(card, { clipPath: 'inset(100% 0% 0% 0% round 22px)', y: 70 }, {
      clipPath: 'inset(0% 0% 0% 0% round 22px)', y: 0, duration: 1.3, ease: 'expo.out', delay: i * 0.12,
      scrollTrigger: { trigger: card, start: 'top 92%', once: true },
    });
    gsap.fromTo($('.wcard__media', card), { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ---------------------------------------------------------------- tech : floating glass cards + wires */
const mm = gsap.matchMedia();
const fmtTime = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const techEls = {
  score: $('#cScore'), gauge: $('#gaugeVal'), roi: $('#cRoi'), time: $('#cTime'),
  bars: $$('.bar'), segs: $$('.time__seg i'),
};

mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
  const tStage = $('.tech__stage'), img = $('.tech__visual img'), svg = $('.tech__wires');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
  const byKey = {};
  const wires = $$('.gc').map((card) => {
    const w = {
      key: card.dataset.gc, inner: $('.gc__in', card), node: $('.gc__node', card),
      anchor: card.dataset.anchor.split(',').map(Number),
      path: mk('path', { pathLength: 1 }), halo: mk('circle', { r: 10, class: 'wire__halo' }), dot: mk('circle', { r: 3.5 }),
    };
    byKey[w.key] = w;
    return w;
  });

  let active = false;
  const layout = () => {
    if (!active) return;
    const sr = tStage.getBoundingClientRect(), ir = img.getBoundingClientRect();
    for (const w of wires) {
      const nr = w.node.getBoundingClientRect();
      const x1 = nr.left + nr.width / 2 - sr.left, y1 = nr.top + nr.height / 2 - sr.top;
      const x2 = ir.left + ir.width * w.anchor[0] - sr.left, y2 = ir.top + ir.height * w.anchor[1] - sr.top;
      const dx = (x2 - x1) * 0.55;
      w.path.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}C${(x1 + dx).toFixed(1)} ${y1.toFixed(1)} ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      w.dot.setAttribute('cx', x2); w.dot.setAttribute('cy', y2);
      w.halo.setAttribute('cx', x2); w.halo.setAttribute('cy', y2);
    }
  };
  gsap.ticker.add(layout);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#tech', start: 'top top', end: 'bottom bottom', scrub: true,
      onToggle: (self) => { active = self.isActive; },
      onRefresh: (self) => { active = true; layout(); active = self.isActive; },
    },
  });
  tl.fromTo(img, { scale: 1.12 }, { scale: 1, duration: 0.3 }, 0)
    .fromTo('.tech__visual', { filter: 'brightness(1)' }, { filter: 'brightness(0.6)', duration: 0.14 }, 0.15)
    .to('.tech__copy--a', { autoAlpha: 0, y: -28, duration: 0.07 }, 0.16)
    .fromTo('.tech__copy--b', { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.23);

  const order = ['score', 'roi', 'bars', 'time'];
  order.forEach((key, i) => {
    const w = byKey[key], t = 0.2 + i * 0.155;
    tl.fromTo(w.inner, { autoAlpha: 0, y: 80, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.11, ease: 'power3.out' }, t)
      .fromTo(w.path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.08, ease: 'power1.inOut' }, t + 0.045)
      .fromTo([w.halo, w.dot], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, t + 0.115);
  });

  const cnt = { score: 0, roi: 0, time: 0, seg: 0 };
  tl.fromTo(cnt, { score: 0 }, { score: 7.4, duration: 0.13, ease: 'power2.out', onUpdate: () => {
    techEls.score.textContent = cnt.score.toFixed(1);
    techEls.gauge.style.strokeDashoffset = 100 - cnt.score * 10;
  } }, 0.215)
    .fromTo(cnt, { roi: 0 }, { roi: 4.33, duration: 0.12, ease: 'power2.out', onUpdate: () => { techEls.roi.textContent = cnt.roi.toFixed(2); } }, 0.37)
    .fromTo(techEls.bars, { '--g': 0 }, { '--g': 1, duration: 0.1, stagger: 0.012, ease: 'power3.out' }, 0.535)
    .fromTo(cnt, { time: 0 }, { time: 3, duration: 0.13, ease: 'power1.out', onUpdate: () => { techEls.time.textContent = String(Math.round(cnt.time)).padStart(2, '0'); } }, 0.68)
    .fromTo(techEls.segs, { '--f': 0 }, { '--f': 1, duration: 0.026, stagger: 0.026 }, 0.68)
    .fromTo('.tchip--white', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.04, ease: 'back.out(2)' }, 0.44)
    .fromTo('.tchip--aqua', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.04, ease: 'back.out(2)' }, 0.62)
    .set({}, {}, 1);

  return () => {
    gsap.ticker.remove(layout);
    svg.replaceChildren();
    techEls.score.textContent = '7.4'; techEls.roi.textContent = '4.33'; techEls.time.textContent = '03';
    techEls.gauge.style.strokeDashoffset = '';
  };
});

mm.add('(max-width: 1099px) and (prefers-reduced-motion: no-preference)', () => {
  const inners = $$('.gc__in');
  gsap.set(inners, { autoAlpha: 0, y: 40 });
  ScrollTrigger.batch(inners, {
    start: 'top 92%', once: true,
    onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }),
  });
  const cnt = { v: 0 };
  gsap.to(cnt, {
    v: 7.4, duration: 1.6, ease: 'power2.out',
    onUpdate: () => { techEls.score.textContent = cnt.v.toFixed(1); techEls.gauge.style.strokeDashoffset = 100 - cnt.v * 10; },
    scrollTrigger: { trigger: '.gc--score', start: 'top 88%', once: true },
  });
  gsap.fromTo(techEls.bars, { '--g': 0 }, { '--g': 1, duration: 1.1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.gc--bars', start: 'top 88%', once: true } });
});

/* ---------------------------------------------------------------- before / after slider */
const ba = $('#ba'), baRead = $('#baRead'), baRange = $('#baRange');
let baDrag = false, baTween = null;
function setBa(v) {
  const pos = clamp(v, 0, 100);
  ba.style.setProperty('--pos', `${pos.toFixed(2)}%`);
  baRead.textContent = pad(Math.round(100 - pos));
  baRange.value = pos;
}
const baFromEvent = (e) => { const r = ba.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
ba.addEventListener('pointerdown', (e) => {
  baDrag = true; ba.classList.add('is-drag');
  if (baTween) baTween.kill();
  try { ba.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
  setBa(baFromEvent(e));
});
ba.addEventListener('pointermove', (e) => { if (baDrag) setBa(baFromEvent(e)); });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => ba.addEventListener(t, () => { baDrag = false; ba.classList.remove('is-drag'); }));
baRange.addEventListener('input', () => setBa(+baRange.value));
if (reduce) setBa(50);
else {
  const st = { v: 88 };
  setBa(st.v);
  ScrollTrigger.create({
    trigger: ba, start: 'top 70%', once: true,
    onEnter: () => { baTween = gsap.to(st, { v: 46, duration: 2.1, ease: 'power3.inOut', onUpdate: () => setBa(st.v) }); },
  });
}

/* ---------------------------------------------------------------- floating parallax cards */
const flt = $('#flt');
const fltH = $('#fltH');
fltH.innerHTML = fltH.innerHTML.split(/<br\s*\/?>/i)
  .map((line) => line.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' '))
  .join('<br>');
if (reduce) gsap.set('.flt__h .w', { opacity: 1 });
else {
  const travel = () => window.innerHeight * (mqDesk.matches ? 0.78 : 0.16);
  $$('.fc', flt).forEach((el) => {
    const d = parseFloat(el.dataset.depth) || 0.5;
    gsap.fromTo(el, { y: () => (d * travel()) / 2 }, {
      y: () => (-d * travel()) / 2, ease: 'none',
      scrollTrigger: { trigger: flt, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });
  gsap.to('.flt__h .w', {
    opacity: 1, ease: 'none', stagger: 0.14,
    scrollTrigger: { trigger: flt, start: 'top 42%', end: '+=92%', scrub: true },
  });
}

/* ---------------------------------------------------------------- evidence carousel */
const track = $('#eviTrack'), prev = $('#eviPrev'), next = $('#eviNext'), eviNow = $('#eviNow');
const papers = $$('.paper', track);
const paperStep = () => (papers.length > 1 ? papers[1].offsetLeft - papers[0].offsetLeft : track.clientWidth);
function syncCarousel() {
  const max = track.scrollWidth - track.clientWidth;
  const x = track.scrollLeft;
  prev.disabled = x <= 2;
  next.disabled = x >= max - 2;
  const idx = x >= max - 2 ? papers.length - 1 : clamp(Math.round(x / paperStep()), 0, papers.length - 1);
  eviNow.textContent = pad(idx + 1);
}
const moveCarousel = (dir) => track.scrollBy({ left: dir * paperStep(), behavior: reduce ? 'auto' : 'smooth' });
prev.addEventListener('click', () => moveCarousel(-1));
next.addEventListener('click', () => moveCarousel(1));
track.addEventListener('scroll', syncCarousel, { passive: true });
window.addEventListener('resize', syncCarousel);
syncCarousel();

/* ---------------------------------------------------------------- end : wordmark fit, video, back to top */
const wm = $('#wm'), wmText = $('#wmText');
function fitWordmark() {
  const cs = getComputedStyle(wm);
  const avail = wm.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  wmText.style.fontSize = '200px';
  const w = wmText.getBoundingClientRect().width;
  // optical fit: the first glyph's side bearing (≈.079em) and the trailing negative tracking are compensated
  if (w > 0) wmText.style.fontSize = `${(avail / (w / 200 - 0.045)).toFixed(2)}px`;
}
fitWordmark();
window.addEventListener('resize', fitWordmark);
if (!reduce) {
  gsap.fromTo('.wm__text i', { yPercent: 105 }, {
    yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.06,
    scrollTrigger: { trigger: wm, start: 'top 94%', once: true },
  });
}

const endVideo = $('#endVideo');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !reduce) endVideo.play().catch(() => {});
    else endVideo.pause();
  }, { rootMargin: '200px 0px' }).observe($('#end'));
}
$('#toTop').addEventListener('click', () => scrollToY(0));

/* ---------------------------------------------------------------- media that failed to arrive is requested again (max 3×) */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!el || !el.dataset) return;
  const n = +(el.dataset.retry || 0);
  if (n >= 3) return;
  if (el.tagName === 'IMG') {
    el.dataset.retry = n + 1;
    setTimeout(() => { const src = el.getAttribute('src'); el.removeAttribute('src'); el.setAttribute('src', src); }, 600 * (n + 1));
  } else if (el.tagName === 'VIDEO') {
    el.dataset.retry = n + 1;
    setTimeout(() => el.load(), 900 * (n + 1));
  }
}, true);

/* ---------------------------------------------------------------- settle */
const settle = () => { fitWordmark(); measureHero(); ScrollTrigger.refresh(); syncCarousel(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
window.addEventListener('load', settle);
