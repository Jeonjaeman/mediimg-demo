/* MEDIIMG demo 05 v3 — sequence hero → real result screen, history timeline, product screen cards, 3-step process */
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

/* ---------------------------------------------------------------- hero : sequence → real screen */
const FRAMES = 121;
const SEQ_END = 0.55;                 // the 121 frames play over the first 55% of the hero scroll
const REAL_W = 1600, REAL_H = 1136;   // result_roi.webp

const hero = $('#hero');
const stage = $('.hero__stage');
const canvas = $('#seq');
const realImg = $('#heroReal');
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

/* measured ROI segments on the result screen, in pixels of the 1600×1136 image (values from the output table of the captured screen) */
const PINS = { icar: [470, 1000], ical: [1190, 1000], ba: [818, 700] };
const pinEls = $$('.pin').map((el) => ({ el, key: el.dataset.pin }));
const hudFrame = $('#hudFrame'), hudMode = $('#hudMode');

let geo = { s: 1, ox: 0, oy: 0 };
let heroP = 0, lastFrame = -1;

/* cover (desktop) / contain (mobile) fit of the real image inside the stage — must mirror .hero__real object-fit in style.css */
function measureHero() {
  const r = realImg.getBoundingClientRect(), st = stage.getBoundingClientRect();
  const s = mqDesk.matches ? Math.max(r.width / REAL_W, r.height / REAL_H) : Math.min(r.width / REAL_W, r.height / REAL_H);
  geo = { s, ox: r.left - st.left + (r.width - REAL_W * s) * 0.5, oy: r.top - st.top + (r.height - REAL_H * s) * 0.5 };
}

function renderHero(p) {
  heroP = p;
  seq.draw(clamp(p / SEQ_END, 0, 1));
  for (const { el, key } of pinEls) {
    const k = PINS[key];
    el.style.transform = `translate3d(${(geo.ox + k[0] * geo.s).toFixed(1)}px,${(geo.oy + k[1] * geo.s).toFixed(1)}px,0)`;
  }
  const f = Math.round(clamp(p / SEQ_END, 0, 1) * (FRAMES - 1)) + 1;
  if (f !== lastFrame) {
    lastFrame = f;
    hudFrame.textContent = `FRAME ${pad(f, 3)}/${FRAMES}`;
    hudMode.textContent = p > 0.56 ? 'RESULT · REAL' : 'RENDER';
  }
}

/* scroll choreography of the sticky stage (timeline positions == scroll progress 0..1) */
const heroTl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
heroTl
  // A → out
  .to('.hero__foot', { autoAlpha: 0, y: 24, duration: 0.05 }, 0.05)
  .to('.hero__head', { autoAlpha: 0, y: -46, duration: 0.07 }, 0.07)
  .to('.hero__scrim--a', { autoAlpha: 0, duration: 0.08 }, 0.1)
  // B → in
  .to('.hero__dim', { opacity: 0.3, duration: 0.08 }, 0.14)
  .to('.hero__scrim--b', { opacity: 1, duration: 0.07 }, 0.15)
  .fromTo('.hud', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.03 }, 0.16)
  .fromTo('.hero__kicker', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.03 }, 0.17)
  .fromTo('.hero__stmt .ln > span', { yPercent: 112 }, { yPercent: 0, duration: 0.05, stagger: 0.012, ease: 'power3.out' }, 0.175)
  // render → real result screen
  .fromTo(realImg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, 0.5)
  .to('.hero__dim', { opacity: 0.12, duration: 0.1 }, 0.52)
  .fromTo('.hero__src', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.04 }, 0.6)
  .fromTo('.pin__in', { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.04, stagger: 0.03, ease: 'back.out(2.2)' }, 0.64)
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
window.addEventListener('resize', () => { measureHero(); renderHero(heroP); });

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
}
setTimeout(finishLoader, 2300);
Promise.all([seq.load(), new Promise((r) => setTimeout(r, 650))]).then(finishLoader, finishLoader);

/* ---------------------------------------------------------------- header + in-page navigation */
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
function setMenu(open) {
  menuOpen = open;
  burger.setAttribute('aria-expanded', String(open));
  mnav.classList.toggle('is-open', open);
  mnav.setAttribute('aria-hidden', String(!open));
  if (open) { hd.dataset.prevTone = hd.dataset.tone; hd.dataset.tone = 'dark'; lenis && lenis.stop(); }
  else { hd.dataset.tone = hd.dataset.prevTone || 'dark'; lenis && lenis.start(); }
}
burger.addEventListener('click', () => setMenu(!menuOpen));
$$('.hd__lang button').forEach((b) => b.addEventListener('click', () => $$('.hd__lang button').forEach((o) => o.classList.toggle('is-on', o === b))));

/* every in-page link (header, mobile menu, hero buttons, footer) scrolls smoothly; the NeuFlow menu lands on the NeuFlow section */
const HD_OFFSET = 0;
function scrollToHash(hash) {
  const target = hash === '#hero' ? null : $(hash);
  const y = target ? target.getBoundingClientRect().top + window.scrollY - HD_OFFSET : 0;
  if (menuOpen) setMenu(false);
  hd.classList.remove('is-hidden');
  scrollToY(Math.max(0, y));
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  const hash = a.getAttribute('href');
  if (!$(hash) && hash !== '#hero') return;
  e.preventDefault();
  scrollToHash(hash);
  history.replaceState(null, '', hash);
});

/* current section → highlighted header item */
const NAV_OF = { history: 'history', neuflow: 'neuflow', sig: 'neuflow', compare: 'neuflow', process: 'neuflow', who: 'neuflow', flt: 'neuflow', evidence: 'evidence', qa: 'evidence', contact: 'contact' };
const navLinks = $$('.hd__nav .hd__link');
Object.keys(NAV_OF).forEach((id) => {
  const sec = $('#' + id);
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec, start: 'top 50%', end: 'bottom 50%',
    onToggle: (self) => { if (self.isActive) navLinks.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + NAV_OF[id])); },
  });
});
ScrollTrigger.create({ trigger: hero, start: 'top 50%', end: 'bottom 50%', onToggle: (self) => { if (self.isActive) navLinks.forEach((l) => l.classList.remove('is-active')); } });

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

/* ---------------------------------------------------------------- history timeline : sticky year + progress */
const tl = $('#tl'), tlYearNum = $('#tlYearNum'), tlYearLb = $('#tlYearLb'), tlProg = $('#tlProg');
$$('.tl__group', tl).forEach((g) => {
  ScrollTrigger.create({
    trigger: g, start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => {
      if (!self.isActive) return;
      tlYearNum.textContent = g.dataset.year;
      tlYearLb.textContent = g.dataset.lb;
      if (!reduce) gsap.fromTo(tlYearNum, { yPercent: 18, autoAlpha: 0.2 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', overwrite: true });
    },
  });
});
ScrollTrigger.create({
  trigger: tl, start: 'top 55%', end: 'bottom 55%', scrub: true,
  onUpdate: (self) => { tlProg.style.transform = `scaleY(${self.progress.toFixed(4)})`; },
});

/* ---------------------------------------------------------------- SIG tech : real screen + floating glass cards + wires */
const mm = gsap.matchMedia();
const outVal = $('#cOut');
const techBars = $$('.bar');

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

  const tl2 = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#sig', start: 'top top', end: 'bottom bottom', scrub: true,
      onToggle: (self) => { active = self.isActive; },
      onRefresh: (self) => { active = true; layout(); active = self.isActive; },
    },
  });
  tl2.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 0.3 }, 0)
    .fromTo('.tech__visual', { filter: 'brightness(1)' }, { filter: 'brightness(0.62)', duration: 0.14 }, 0.15)
    .to('.tech__copy--a', { autoAlpha: 0, y: -28, duration: 0.07 }, 0.16)
    .fromTo('.tech__copy--b', { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, 0.23);

  const order = ['map', 'bars', 'sec', 'out'];
  order.forEach((key, i) => {
    const w = byKey[key], t = 0.2 + i * 0.155;
    tl2.fromTo(w.inner, { autoAlpha: 0, y: 80, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.11, ease: 'power3.out' }, t)
      .fromTo(w.path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.08, ease: 'power1.inOut' }, t + 0.045)
      .fromTo([w.halo, w.dot], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, t + 0.115);
  });

  const cnt = { out: 0 };
  tl2.fromTo(techBars, { '--g': 0 }, { '--g': 1, duration: 0.1, stagger: 0.012, ease: 'power3.out' }, 0.38)
    .fromTo(cnt, { out: 0 }, { out: 8.227, duration: 0.13, ease: 'power2.out', onUpdate: () => { outVal.textContent = cnt.out.toFixed(3); } }, 0.68)
    .fromTo('.tchip--white', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.04, ease: 'back.out(2)' }, 0.44)
    .fromTo('.tchip--aqua', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.04, ease: 'back.out(2)' }, 0.62)
    .set({}, {}, 1);

  return () => {
    gsap.ticker.remove(layout);
    svg.replaceChildren();
    outVal.textContent = '8.227';
  };
});

mm.add('(max-width: 1099px) and (prefers-reduced-motion: no-preference)', () => {
  const inners = $$('.gc__in');
  gsap.set(inners, { autoAlpha: 0, y: 40 });
  ScrollTrigger.batch(inners, {
    start: 'top 92%', once: true,
    onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }),
  });
  gsap.fromTo(techBars, { '--g': 0 }, { '--g': 1, duration: 1.1, stagger: 0.08, ease: 'power3.out', scrollTrigger: { trigger: '.gc--bars', start: 'top 88%', once: true } });
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

/* ---------------------------------------------------------------- process : pinned 3-step walkthrough */
const proc = $('#process');
const pstepEls = $$('.pstep');
const pmEls = $$('.pm');
const procNow = $('#procNow');
let curStep = 0;
function setProcStep(i) {
  curStep = i;
  pstepEls.forEach((el, k) => { el.classList.toggle('is-open', k === i); $('.pstep__head', el).setAttribute('aria-expanded', String(k === i)); });
  pmEls.forEach((el, k) => el.classList.toggle('is-on', k === i));
  procNow.textContent = pad(i + 1);
}
let procST = null;
mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
  procST = ScrollTrigger.create({
    trigger: proc, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (self) => {
      const sp = clamp(self.progress, 0, 0.9999) * pstepEls.length;
      const idx = Math.floor(sp);
      if (idx !== curStep) setProcStep(idx);
      pstepEls[idx].style.setProperty('--prog', (sp - idx).toFixed(3));
    },
  });
  return () => { procST && procST.kill(); procST = null; pstepEls.forEach((el) => el.style.removeProperty('--prog')); };
});
pstepEls.forEach((el, i) => {
  $('.pstep__head', el).addEventListener('click', () => {
    if (procST) scrollToY(procST.start + (procST.end - procST.start) * ((i + 0.5) / pstepEls.length));
    else setProcStep(i);
  });
});

/* ---------------------------------------------------------------- numbers : count-ups + floating parallax cards */
$$('[data-count]').forEach((el) => {
  const to = +el.dataset.count, suffix = el.dataset.suffix || '';
  const fmt = (v) => Math.round(v).toLocaleString('en-US') + suffix;
  if (reduce) { el.textContent = fmt(to); return; }
  const o = { v: 0 };
  ScrollTrigger.create({
    trigger: el, start: 'top 88%', once: true,
    onEnter: () => gsap.to(o, { v: to, duration: 1.8, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); } }),
  });
});

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

/* ---------------------------------------------------------------- contact : wordmark fit, back to top, brochure modal */
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
$('#toTop').addEventListener('click', () => scrollToY(0));

const modal = $('#modalBrochure'), modalForm = $('#brochureForm'), modalMsg = $('#modalMsg');
let modalReturn = null;
function openModal() {
  modalReturn = document.activeElement;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  lenis && lenis.stop();
  document.body.classList.add('is-locked');
  setTimeout(() => $('input', modalForm).focus(), 60);
}
function closeModal() {
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  lenis && lenis.start();
  document.body.classList.remove('is-locked');
  modalReturn && modalReturn.focus && modalReturn.focus();
}
$$('[data-modal="brochure"]').forEach((b) => b.addEventListener('click', openModal));
$$('[data-modal-close]', modal).forEach((b) => b.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!modalForm.checkValidity()) {
    modalMsg.textContent = '기관명 · 성함 · 이메일과 동의 항목을 확인해 주세요.';
    modalMsg.classList.add('is-err');
    modalForm.reportValidity();
    return;
  }
  // design mock-up: nothing is sent. the receiving address is awaiting the client's confirmation (갑 확인 ④)
  modalMsg.classList.remove('is-err');
  modalMsg.textContent = '시안에서는 발송되지 않습니다. 실제 사이트에서는 확인된 접수 이메일로 전달됩니다.';
});

/* ---------------------------------------------------------------- media that failed to arrive is requested again (max 3×) */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!el || !el.dataset || el.tagName !== 'IMG') return;
  const n = +(el.dataset.retry || 0);
  if (n >= 3) return;
  el.dataset.retry = n + 1;
  setTimeout(() => { const src = el.getAttribute('src'); el.removeAttribute('src'); el.setAttribute('src', src); }, 600 * (n + 1));
}, true);

/* ---------------------------------------------------------------- settle */
const settle = () => { fitWordmark(); measureHero(); renderHero(heroP); ScrollTrigger.refresh(); syncCarousel(); };
if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
window.addEventListener('load', settle);
