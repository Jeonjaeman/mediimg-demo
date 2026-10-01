/* MEDIIMG demo 06 — brand film with live DOM typography (footage has no text) + scroll sections */
import { splitText, hangulTypingSteps, createDirectionalBlur } from '../shared/kinetic.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const pad2 = (n) => String(n).padStart(2, '0');

const qs = new URLSearchParams(location.search);
const QA_T = qs.has('t') ? Math.max(0, parseFloat(qs.get('t')) || 0) : null;   // ?t=12.5 → film frozen at 12.5s
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mqMobile = matchMedia('(max-width: 700px)');

/* ════════════════════════════════════════════════════════════════ FILM ENGINE */

const DUR = 32.2;
/* one row per scene: start time, act, header tone, background plates (video offsets in `off`) */
const SC = [
  { n: 1, t: 0.0, act: 1, tone: 'light', bg: ['g1'], tones: [[0.14, 'dark']] },
  { n: 2, t: 1.2, act: 1, tone: 'dark', bg: ['g2'] },
  { n: 3, t: 2.3, act: 1, tone: 'dark', bg: ['g3'] },
  { n: 4, t: 3.4, act: 1, tone: 'dark', bg: ['g4'] },
  { n: 5, t: 4.5, act: 1, tone: 'dark', bg: ['g4', 'split'] },
  { n: 6, t: 6.4, act: 1, tone: 'dark', bg: ['g6'] },
  { n: 7, t: 7.6, act: 1, tone: 'dark', bg: ['v1'] },
  { n: 8, t: 8.6, act: 1, tone: 'light', bg: ['light'], tones: [[0.27, 'dark']] },
  { n: 9, t: 9.3, act: 2, tone: 'dark', bg: ['g7'] },
  { n: 10, t: 11.7, act: 2, tone: 'dark', bg: ['v6'], off: { v6: 6 } },
  { n: 11, t: 13.7, act: 3, tone: 'light', bg: ['light'] },
  { n: 12, t: 14.6, act: 3, tone: 'light', bg: ['light'] },
  { n: 13, t: 17.0, act: 3, tone: 'light', bg: ['light'] },
  { n: 14, t: 18.9, act: 4, tone: 'dark', bg: ['rays'] },
  { n: 15, t: 20.5, act: 4, tone: 'dark', bg: ['g8'] },
  { n: 16, t: 21.4, act: 4, tone: 'dark', bg: ['g8'] },
  { n: 17, t: 23.3, act: 4, tone: 'dark', bg: ['v8'], off: { v8: 11.3 }, rate: { v8: 0.5 } },   // turntable faces front as the color arrives
  { n: 18, t: 24.7, act: 4, tone: 'dark', bg: ['v8'] },
  { n: 19, t: 27.1, act: 5, tone: 'dark', bg: ['v3'] },
  { n: 20, t: 28.1, act: 5, tone: 'dark', bg: ['v2'] },
  { n: 21, t: 29.3, act: 5, tone: 'dark', bg: ['v2'], el: 20 },
  { n: 22, t: 30.7, act: 5, tone: 'light', bg: ['light'] },
];
SC.forEach((s, i) => {
  s.t1 = SC[i + 1] ? SC[i + 1].t : DUR;
  s.el = s.el || s.n;
  s.ref = {};                                   // where each plate's video should be at scene start (continues across scenes that share it)
  s.bg.forEach((k) => {
    const p = SC[i - 1];
    s.ref[k] = p && p.bg.includes(k) ? p.ref[k] : { t: s.t, off: (s.off && s.off[k]) || 0, rate: (s.rate && s.rate[k]) || 1 };
  });
});
const ACTS = [1, 2, 3, 4, 5].map((a) => {
  const mine = SC.filter((s) => s.act === a);
  return { t0: mine[0].t, t1: mine[mine.length - 1].t1, p: -1 };
});

/* English script — Korean lives in the HTML. Same keys, same motion. */
const EN = {
  s1: 'Headache', s2: 'Dizziness', s3: 'Blood pressure', s4: 'Family history', s5: 'Health check-ups',
  s6: 'What we want to protect', s7: 'The brain’s<br>vessels', s8: 'And',
  s9a: 'Linking the MRA image', s9b: 'to the force of flow',
  s10: '<span class="th">The</span> <b>faintest signal</b>',
  s11: 'At its <b>center</b>',
  s12: 'how to see brain vessels in color', s12r1: 'NeuFlow', s12r2: 'NeuFlow software', s12r3: 'NeuFlow SIG analysis',
  s13: 'is here.',
  s14a: 'Hidden inside every TOF-MRA', s14b: 'the faintest signal',
  s15: 'Within it',
  s16a: 'Blood <b>never stops</b>', s16b: 'flowing',
  s17a: 'At the heart of', s17b: 'an unseen force',
  s18a: 'With <b>NeuFlow</b>,', s18b: 'it finally appears in <em>color</em> and numbers',
  s19: 'Without another scan', s20: 'With SIG · 3D · quantification', s21: 'We read the brain’s vessels',
  s22: 'FDA 510(k) Cleared · MFDS certified',
};

const film = $('#film');
const typeLayer = $('#filmType');
const TEMPLATE = typeLayer.innerHTML;
const hd = $('#hd');
const BG = {};
$$('[data-bg]', film).forEach((el) => {
  BG[el.dataset.bg] = { el, vids: el.tagName === 'VIDEO' ? [el] : $$('video', el), on: false };
});
const actBtns = $$('.act', film);
const actFills = actBtns.map((b) => $('b', b));
const tcEl = $('#tc');
const pp = $('#pp');

let lang = qs.get('lang') === 'en' ? 'en' : 'ko';
let tl = null, ctx = null, scEls = [], cur = -1, lastT = -1, lastSec = -1;
let blurTracks = [], typeTrack = null, countTrack = null;
const blurPool = [];
let blurN = 0;
const marks = [];                                // times at which each scene's type has fully landed (QA captures use these)
let started = false, playing = false, userPaused = false, inView = true, locked = QA_T !== null || REDUCED;

const S = (n) => $(`[data-sc="${n}"]`, typeLayer);
const T = (n) => SC[n - 1].t;
const E = (n) => SC[n - 1].t1;
const bgEl = (k) => BG[k].el;
const mark = (t) => marks.push(+t.toFixed(2));

/* ---------- copy + auto-fit ---------- */
function applyCopy() {
  if (lang === 'en') {
    $$('[data-k]', typeLayer).forEach((el) => { const v = EN[el.dataset.k]; if (v != null) el.innerHTML = v; });
  }
  $$('[data-ko]', film).forEach((s) => { s.textContent = s.dataset[lang]; });
  film.setAttribute('lang', lang);
}

/* longer (English) lines shrink until they fit the stage: font-size = --fs × --fit */
function fitAll() {
  const W = film.clientWidth, mob = mqMobile.matches;
  $$('[data-fit]', typeLayer).forEach((el) => {
    el.style.setProperty('--fit', 1);
    const cs = getComputedStyle(el);
    const w = el.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const max = W * parseFloat((mob && el.dataset.fitM) || el.dataset.fit);
    if (w > max) el.style.setProperty('--fit', (max / w).toFixed(4));
  });
  const row = $('[data-fitrow]', typeLayer);
  if (row) {
    const a = row.children[0], b = row.children[2];
    a.style.setProperty('--fit', 1); b.style.setProperty('--fit', 1);
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const avail = row.clientWidth;
    const f = mob ? avail / Math.max(a.offsetWidth, b.offsetWidth) : (avail - gap * 2 - W * 0.07) / (a.offsetWidth + b.offsetWidth);
    if (f < 1) { a.style.setProperty('--fit', f.toFixed(4)); b.style.setProperty('--fit', f.toFixed(4)); }
  }
}

/* split every text node under `root` (keeps <b>/<em>/<br> markup intact) */
function splitDeep(root, by = 'char') {
  const out = { chars: [], words: [] };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    let host = n.parentNode;
    if (host.childNodes.length > 1) {
      const lead = /^\s/.test(n.nodeValue), trail = /\s$/.test(n.nodeValue);
      const s = document.createElement('span');
      n.replaceWith(s); s.appendChild(n);
      n.nodeValue = n.nodeValue.trim();
      if (lead) s.before(' ');
      if (trail) s.after(' ');
      host = s;
    }
    const r = splitText(host, { by });
    out.chars.push(...r.chars); out.words.push(...r.words);
  });
  return out;
}

/* first glyph + the rest of the word, for the glyph-wipe transition */
function headTail(w) {
  const { chars } = splitText(w, { by: 'char' });
  const first = chars[0];
  let rest = null;
  if (first.nextSibling) {
    rest = document.createElement('span'); rest.className = 'rest';
    while (first.nextSibling) rest.appendChild(first.nextSibling);
    first.parentNode.appendChild(rest);
  }
  return { first, rest };
}

/* Thickest point of a glyph's stroke (in em from the top-left of a line-height:1 box), so the glyph can be scaled ×110
   around a point that is guaranteed to be ink. The canvas is used only to measure — nothing is drawn to the page. */
const originCache = new Map();
function strokeOrigin(ch, weight) {
  const fam = '"Pretendard Variable", Pretendard, sans-serif';
  const key = ch + weight + document.fonts.check(`${weight} 40px ${fam}`, ch);
  if (originCache.has(key)) return originCache.get(key);
  let res = { x: 0.5, y: 0.56 };
  try {
    const F = 140, P = 50, c = document.createElement('canvas');
    c.width = c.height = F * 2;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.font = `${weight} ${F}px ${fam}`;
    const m = g.measureText(ch);
    const asc = m.fontBoundingBoxAscent || F * 0.95, desc = m.fontBoundingBoxDescent || F * 0.24, adv = m.width;
    g.textBaseline = 'alphabetic';
    g.fillText(ch, P, P + asc);
    const W = c.width, d = g.getImageData(0, 0, W, W).data;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < W && d[(y * W + x) * 4 + 3] > 140;
    let best = 0, bx = 0, by = 0;
    for (let y = P; y < P + asc + desc; y += 2) {
      for (let x = P; x < P + adv; x += 2) {
        if (!on(x, y)) continue;
        let r = 1;
        for (; r < 70; r++) {
          const q = Math.round(r * 0.7);
          if (!(on(x - r, y) && on(x + r, y) && on(x, y - r) && on(x, y + r) && on(x - q, y - q) && on(x + q, y - q) && on(x - q, y + q) && on(x + q, y + q))) break;
        }
        if (r > best) { best = r; bx = x; by = y; }
      }
    }
    if (best > 2) res = { x: (bx - P) / F, y: (1 - (asc + desc) / F) / 2 + (by - P) / F };
  } catch (e) { /* keep the default */ }
  originCache.set(key, res);
  return res;
}
function setGlyphOrigin(first) {
  const o = strokeOrigin(first.textContent, 800);
  const fs = parseFloat(getComputedStyle(first).fontSize);
  gsap.set(first, { transformOrigin: `${(o.x * fs).toFixed(1)}px ${(o.y * fs).toFixed(1)}px` });
}

/* ---------- motion primitives ---------- */

/* directional-blur landing: the transform is a GSAP tween, the SVG blur amount is a pure function of film time (see sync) */
function land(el, at, o = {}) {
  const { x = 0, y = 0, sx = 1, sy = 1, s = 1, bx = 0, by = 0, dur = 0.42, ease = 'power3.out' } = o;
  const b = blurPool[blurN] || (blurPool[blurN] = createDirectionalBlur());
  blurN++;
  blurTracks.push({ el, b, t0: at, dur, bx, by, on: -1 });
  tl.fromTo(el, { opacity: 0, xPercent: x, yPercent: y, scaleX: sx * s, scaleY: sy * s },
    { opacity: 1, xPercent: 0, yPercent: 0, scaleX: 1, scaleY: 1, duration: dur, ease }, at);
  return at + dur;
}
/* per-character rack focus */
function focus(chars, at, { dur = 0.45, amount = 0.3, blur = 14, from = {}, to = {} } = {}) {
  tl.fromTo(chars, { opacity: 0, filter: `blur(${blur}px)`, ...from },
    { opacity: 1, filter: 'blur(0px)', ...to, duration: dur, ease: 'power2.out', stagger: { amount } }, at);
  const end = at + dur + amount;
  tl.set(chars, { filter: 'none' }, end);
  return end;
}
/* oversized outline clone drifting behind the word */
function outline(sc, t, dir, d) {
  const o = $('.ol span', sc);
  if (!o) return;
  tl.fromTo(o, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, t + 0.12)
    .fromTo(o, { xPercent: -3.5 * dir, letterSpacing: '-0.02em' }, { xPercent: 2.5 * dir, letterSpacing: '0.05em', duration: d, ease: 'none' }, t);
}

/* ---------- the 22 scenes ---------- */
const SCENES = [
  /* 1 — white glyph pulls away → word */
  () => {
    const sc = S(1), t = T(1), d = E(1) - t;
    const { first, rest } = headTail($('.w', sc));
    setGlyphOrigin(first);
    tl.fromTo($('.flash', sc), { opacity: 1 }, { opacity: 0, duration: 0.09, ease: 'none' }, t)
      .fromTo(first, { scale: 110 }, { scale: 1, duration: 0.5, ease: 'expo.out' }, t);
    let end = t + 0.5;
    if (rest) end = Math.max(end, land(rest, t + 0.1, { x: 30, sx: 2.2, bx: 56, dur: 0.42 }));
    outline(sc, t, 1, d);
    tl.fromTo(bgEl('g1'), { scale: 1.12 }, { scale: 1.03, duration: d, ease: 'none' }, t);
    mark(end + 0.03);
  },
  /* 2–4 — blur landings (→, ↓, ←) */
  () => wordScene(2, 'g2', { x: 16, sx: 2.3, bx: 72 }, 1),
  () => wordScene(3, 'g3', { y: -26, sy: 2.1, by: 44 }, 1),
  () => wordScene(4, 'g4', { x: -16, sx: 2.3, bx: 72 }, -1),
  /* 5 — 2×2 split, word crosses the seam */
  () => {
    const sc = S(5), t = T(5), w = $('.w', sc), cells = $$('.cell', bgEl('split'));
    const from = ['inset(0% 100% 0% 0%)', 'inset(0% 0% 100% 0%)', 'inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 100%)'];
    [0, 3, 1, 2].forEach((ci, i) => {
      tl.fromTo(cells[ci], { clipPath: from[ci] }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'power3.inOut' }, t + i * 0.09)
        .fromTo(cells[ci].firstElementChild, { scale: 1.4 }, { scale: 1.04, duration: E(5) - t, ease: 'power2.out' }, t + i * 0.09);
    });
    const end = land(w, t + 0.36, { x: 20, sx: 2.4, bx: 80, dur: 0.44 });
    tl.to(w, { scale: 1.05, duration: E(5) - end, ease: 'none' }, end);
    mark(end + 0.03);
  },
  /* 6 — small line, per-character focus */
  () => {
    const sc = S(6), t = T(6), p = $('.t-s', sc);
    const end = focus(splitDeep(p).chars, t + 0.08, { dur: 0.36, amount: 0.22 });
    tl.fromTo(bgEl('g6'), { scale: 1.14 }, { scale: 1.02, duration: E(6) - t, ease: 'none' }, t)
      .to(p, { opacity: 0, scale: 1.08, duration: 0.12, ease: 'power2.in' }, E(6) - 0.12);
    mark(end + 0.03);
  },
  /* 7 — screen-filling word */
  () => {
    const sc = S(7), t = T(7), p = $('.t-xl', sc);
    const end = land(p, t, { s: 1.26, by: 26, dur: 0.34, ease: 'expo.out' });
    tl.to(p, { scale: 1.06, duration: E(7) - end, ease: 'none' }, end)
      .fromTo(bgEl('v1'), { scale: 1.32 }, { scale: 1.08, duration: E(7) - t, ease: 'power2.out' }, t);
    mark(end + 0.04);
  },
  /* 8 — bridge: light → black inversion cut */
  () => {
    const sc = S(8), t = T(8), p = $('.t-and', sc), c = t + 0.27;
    tl.fromTo(p, { opacity: 0, scale: 1 }, { opacity: 1, duration: 0.06, ease: 'none' }, t)
      .set($('.inv', sc), { opacity: 1 }, c)
      .set(p, { color: '#ffffff', scale: 1.32 }, c)
      .to(p, { scale: 1.4, duration: E(8) - c, ease: 'none' }, c);
    mark(c + 0.18);
  },
  /* 9 — two phrases joined by a drawn rule, words light up one by one */
  () => {
    const sc = S(9), t = T(9), row = $('.row', sc);
    const words = [...splitDeep(row.children[0], 'word').words, ...splitDeep(row.children[2], 'word').words];
    tl.fromTo(row, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' }, t)
      .fromTo(words, { color: '#3a404e' }, { color: '#ffffff', duration: 0.5, ease: 'power1.out', stagger: { amount: 0.9 } }, t + 0.3)
      .fromTo($('.rule', row), { '--p': 0 }, { '--p': 1, duration: 1, ease: 'power2.inOut' }, t + 0.4)
      .fromTo(bgEl('g7'), { scale: 1.16, xPercent: -3 }, { scale: 1.03, xPercent: 0, duration: E(9) - t, ease: 'none' }, t)
      .to(sc, { opacity: 0, duration: 0.18, ease: 'power1.in' }, E(9) - 0.18);
    mark(t + 1.73);
  },
  /* 10 — thin → bold, per-character focus (variable-font weight axis) */
  () => {
    const sc = S(10), t = T(10), p = $('.t-m', sc);
    tl.fromTo($('.th', p), { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, t + 0.1);
    const end = focus(splitDeep($('b', p)).chars, t + 0.32, { dur: 0.6, amount: 0.5, from: { fontWeight: 300 }, to: { fontWeight: 700 } });
    tl.fromTo(bgEl('v6'), { scale: 1.1 }, { scale: 1, duration: E(10) - t, ease: 'none' }, t)
      .to(sc, { opacity: 0, duration: 0.16, ease: 'power1.in' }, E(10) - 0.16);
    mark(end + 0.03);
  },
  /* 11 — box + crosshair */
  () => {
    const sc = S(11), t = T(11);
    tl.fromTo($('.box__bd', sc), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.36, ease: 'power2.inOut' }, t + 0.02)
      .fromTo($('.box', sc), { '--bg': 0 }, { '--bg': 1, duration: 0.3, ease: 'power1.out' }, t + 0.1)
      .fromTo($('.t-box', sc), { opacity: 0, color: '#a8a8a8' }, { opacity: 1, color: '#0d0f14', duration: 0.4, ease: 'power1.out' }, t + 0.08)
      .fromTo($('.cx--h', sc), { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power3.inOut' }, t + 0.14)
      .fromTo($('.cx--v', sc), { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: 'power3.inOut' }, t + 0.2);
    mark(t + 0.72);
  },
  /* 12 — tilted search card, IME-accurate Hangul typing, autocomplete */
  () => {
    const sc = S(12), t = T(12), card = $('.srch__card', sc), q = $('.srch__txt', sc), rows = $$('.srch__row', sc);
    const mob = mqMobile.matches;
    const a = mob ? { rotateX: 14, rotateY: -18, rotateZ: 3 } : { rotateX: 25, rotateY: -31, rotateZ: 5.5 };
    const b = mob ? { rotateX: 9, rotateY: -11, rotateZ: 2 } : { rotateX: 17, rotateY: -21, rotateZ: 3.5 };
    typeTrack = { el: q, steps: hangulTypingSteps(q.textContent.trim()), t0: t + 0.22, dur: 1.2, i: -1 };
    tl.fromTo(card, { opacity: 0, scale: 0.92, ...a }, { opacity: 1, scale: 1, ...b, duration: 0.7, ease: 'power3.out' }, t)
      .to(card, { scale: 1.07, rotateY: b.rotateY + 4, duration: E(12) - t - 0.7, ease: 'none' }, t + 0.7)
      .fromTo($('.srch__list', sc), { height: 0 }, { height: 'auto', duration: 0.34, ease: 'power3.out' }, t + 1.44)
      .fromTo(rows, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.26, stagger: 0.07 }, t + 1.5)
      .fromTo(rows[0], { '--sel': 0 }, { '--sel': 1, duration: 0.22, ease: 'power2.out' }, t + 1.92);
    mark(t + 2.16);
  },
  /* 13 — product logo + sentence tail */
  () => {
    const sc = S(13), t = T(13);
    tl.fromTo($('.here__logo', sc), { opacity: 0, clipPath: 'inset(0% 100% 0% 0%)', x: -18 }, { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', x: 0, duration: 0.65, ease: 'power3.out' }, t + 0.04)
      .fromTo(splitDeep($('.here__t', sc)).chars, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.32, ease: 'power2.out', stagger: { amount: 0.3 } }, t + 0.5)
      .to(sc, { opacity: 0, duration: 0.16, ease: 'power1.in' }, E(13) - 0.16);
    mark(t + 1.15);
  },
  /* 14 — black, CSS light rays, small line + big line */
  () => {
    const sc = S(14), t = T(14), d = E(14) - t, rays = $$('i', bgEl('rays'));
    tl.fromTo(rays, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'none' }, t)
      .fromTo(rays[0], { scale: 0.7, rotate: 0 }, { scale: 1.5, rotate: 14, duration: d, ease: 'power1.out' }, t)
      .fromTo(rays[1], { scale: 0.6, rotate: 0 }, { scale: 1.7, rotate: -10, duration: d, ease: 'power1.out' }, t)
      .fromTo($('.sm', sc), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, t + 0.14);
    const end = focus(splitDeep($('.lg', sc)).chars, t + 0.3, { dur: 0.42, amount: 0.28 });
    tl.to(sc, { opacity: 0, scale: 1.3, duration: 0.2, ease: 'power2.in' }, E(14) - 0.2);
    mark(end + 0.03);
  },
  /* 15 — zoom-blur entrance */
  () => {
    const sc = S(15), t = T(15), p = $('.t-zm', sc);
    const end = land(p, t + 0.02, { s: 1.6, bx: 30, by: 18, dur: 0.45 });
    tl.to(p, { scale: 0.97, duration: E(15) - end, ease: 'none' }, end)
      .fromTo(bgEl('g8'), { scale: 1.36 }, { scale: 1.12, duration: 0.9, ease: 'power2.out' }, t)
      .to(bgEl('g8'), { scale: 1.02, duration: E(16) - T(16), ease: 'none' }, T(16));
    mark(end + 0.03);
  },
  /* 16 — two lines, one after the other */
  () => {
    const sc = S(16), t = T(16), ln = $$('.ln', sc);
    land(ln[0], t + 0.04, { x: 8, sx: 1.6, bx: 46 });
    const end = land(ln[1], t + 0.5, { x: -8, sx: 1.6, bx: 46 });
    tl.to(sc, { opacity: 0, duration: 0.16, ease: 'power1.in' }, E(16) - 0.16);
    mark(end + 0.03);
  },
  /* 17 — ROI frame on the grayscale vessel */
  () => {
    const sc = S(17), t = T(17), roi = $('.roi', sc), vid = BG.v8.vids[0];
    tl.fromTo(bgEl('v8'), { scale: 2.1 }, { scale: 1.12, duration: 0.6, ease: 'expo.out' }, t)
      .fromTo(vid, { filter: 'grayscale(1) brightness(0.7) blur(14px)' }, { filter: 'grayscale(1) brightness(0.7) blur(0px)', duration: 0.5, ease: 'power2.out' }, t)
      .fromTo(roi, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out' }, t + 0.16)
      .fromTo($$('.roi__t > *', sc), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.12 }, t + 0.38)
      .to(roi, { scale: 3.2, opacity: 0, duration: 0.24, ease: 'power2.in' }, E(17) - 0.24);
    mark(t + 0.88);
  },
  /* 18 — grayscale → color, SIG read-out counts up */
  () => {
    const sc = S(18), t = T(18), vid = BG.v8.vids[0], lnB = $('.ln--b', sc);
    const { chars } = splitDeep(lnB);
    const ems = $$('em .k-char', lnB);
    ems.forEach((c, i) => {
      c.style.backgroundSize = `${ems.length * 100}% 100%`;
      c.style.backgroundPosition = `${ems.length > 1 ? (i / (ems.length - 1)) * 100 : 0}% 0`;
    });
    tl.to(bgEl('v8'), { scale: 1.26, duration: E(18) - t, ease: 'none' }, t)
      .to(vid, { filter: 'grayscale(0) brightness(0.92) blur(0px)', duration: 1, ease: 'power2.inOut' }, t + 0.45)
      .fromTo($('.ln--a', sc), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, t + 0.08);
    const end = focus(chars, t + 0.55, { dur: 0.45, amount: 0.5 });
    tl.fromTo($('.sig', sc), { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.5 }, t + 0.6)
      .to(sc, { opacity: 0, duration: 0.18, ease: 'power1.in' }, E(18) - 0.18);
    countTrack = { el: $('.sig__n', sc), mk: $('.sig__mk', sc), t0: t + 0.7, dur: 1.15, to: 5.86, max: 9, last: '' };
    mark(Math.max(end, t + 1.85) + 0.03);
  },
  /* 19 — thin line, blur landing */
  () => {
    const sc = S(19), t = T(19), p = $('.t-thin', sc);
    const end = land(p, t + 0.05, { x: 14, sx: 2, bx: 64 });
    tl.to(p, { scale: 1.03, duration: E(19) - end, ease: 'none' }, end)
      .fromTo(bgEl('v3'), { scale: 1.02 }, { scale: 1.14, duration: E(19) - t, ease: 'none' }, t);
    mark(end + 0.03);
  },
  /* 20 + 21 — one line lands, shrinks upward, the slogan arrives; a highlight wipe leads into the end card */
  () => {
    const sc = S(20), t = T(20), t2 = T(21), fin = $('.fin', sc), aw = $('.fin__aw', sc), a = $('.fin__a', sc), b = $('.fin__b', sc);
    const off = (b.offsetHeight + (parseFloat(getComputedStyle(fin).rowGap) || 0)) / 2;
    gsap.set(aw, { y: off });
    const end1 = land(a, t + 0.05, { x: -14, sx: 2, bx: 64 });
    mark(end1 + 0.03);
    const { chars } = splitDeep($('span', b));
    tl.fromTo(bgEl('v2'), { scale: 1.02 }, { scale: 1.12, duration: E(21) - t, ease: 'none' }, t)
      .to(aw, { y: 0, scale: 0.44, duration: 0.5, ease: 'power3.inOut' }, t2)
      .to(a, { color: 'rgba(255,255,255,0.82)', duration: 0.4, ease: 'power1.out' }, t2);
    const end2 = focus(chars, t2 + 0.16, { dur: 0.4, amount: 0.26 });
    mark(end2 + 0.03);
    tl.fromTo($('.fin__hl', sc), { scaleX: 0 }, { scaleX: 1, duration: 0.26, ease: 'power3.inOut' }, E(21) - 0.3)
      .to(chars, { color: '#0b0d12', duration: 0.1, ease: 'none' }, E(21) - 0.2);
  },
  /* 22 — company logo on light gray, then the first glyph of scene 1 swells to white and the film loops */
  () => {
    const sc = S(22), t = T(22), logo = $('.end__logo', sc), sub = $('.end__t', sc);
    const { first } = headTail($('.w--ghost', sc));
    setGlyphOrigin(first);
    tl.fromTo(logo, { opacity: 0, scale: 1.14 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'power3.out' }, t + 0.04)
      .fromTo(sub, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, t + 0.3)
      .to([logo, sub], { opacity: 0, duration: 0.16, ease: 'power1.in' }, DUR - 0.62)
      .fromTo(first, { opacity: 0, scale: 1 }, { opacity: 1, duration: 0.08, ease: 'none' }, DUR - 0.5)
      .to(first, { scale: 110, duration: 0.42, ease: 'expo.in' }, DUR - 0.44)
      .fromTo($('.flash', sc), { opacity: 0 }, { opacity: 1, duration: 0.05, ease: 'none' }, DUR - 0.06);
    mark(t + 0.8);
  },
];

function wordScene(n, bgKey, o, dir) {
  const sc = S(n), t = T(n), d = E(n) - t, w = $('.w', sc);
  const end = land(w, t + 0.05, o);
  tl.to(w, { scale: 1.035, duration: E(n) - end, ease: 'none' }, end);
  outline(sc, t, dir, d);
  tl.fromTo(bgEl(bgKey), { scale: 1.1 }, { scale: 1.02, duration: d, ease: 'none' }, t);
  mark(end + 0.03);
}

function build() {
  blurN = 0; blurTracks = []; typeTrack = null; countTrack = null; marks.length = 0;
  typeLayer.innerHTML = TEMPLATE;
  applyCopy();
  fitAll();
  scEls = $$('.sc', typeLayer);
  ctx = gsap.context(() => {
    tl = gsap.timeline({ paused: true, repeat: -1, defaults: { ease: 'power3.out', duration: 0.5 } });
    SCENES.forEach((fn) => fn());
    tl.set({}, {}, DUR);
  });
  marks.sort((a, b) => a - b);
}

/* ---------- everything that is a pure function of film time ---------- */
const sceneAt = (t) => { for (let i = SC.length - 1; i >= 0; i--) if (t >= SC[i].t) return i; return 0; };
function playVideo(v) { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }
function seekVideo(v, s, k, t) {
  const r = s.ref[k];
  let x = r.off + Math.max(0, t - r.t) * r.rate;
  if (v.playbackRate !== r.rate) v.playbackRate = r.rate;
  if (v.duration && isFinite(v.duration)) x = v.loop ? x % v.duration : Math.min(x, v.duration - 0.05);
  try { if (Math.abs(v.currentTime - x) > 0.08) v.currentTime = x; } catch (e) { /* not seekable yet */ }
}
function primeNext(i) {                          // decode the first frame of the next plate while it is still hidden
  const nx = SC[(i + 1) % SC.length];
  nx.bg.forEach((k) => {
    if (BG[k].on) return;
    BG[k].vids.forEach((v) => { if (v.preload !== 'auto') v.preload = 'auto'; seekVideo(v, nx, k, nx.t); });
  });
}

function sync(t, force) {
  const i = sceneAt(t), s = SC[i];
  if (i !== cur || force) {
    for (const el of scEls) el.classList.toggle('is-on', +el.dataset.sc === s.el);
    for (const k in BG) {
      const b = BG[k], on = s.bg.includes(k);
      if (on && (!b.on || force)) b.vids.forEach((v) => seekVideo(v, s, k, t));
      b.el.classList.toggle('is-on', on);
      b.vids.forEach((v) => { if (on && playing) playVideo(v); else if (!v.paused) v.pause(); });
      b.on = on;
    }
    actBtns.forEach((b, n) => b.classList.toggle('is-on', n + 1 === s.act));
    film.dataset.act = s.act;
    cur = i;
    primeNext(i);
  }
  let tone = s.tone;
  if (s.tones) for (const [dt, tn] of s.tones) if (t - s.t >= dt) tone = tn;
  if (film.dataset.tone !== tone) { film.dataset.tone = tone; headerTone(); }

  for (const k of blurTracks) {                  // SVG directional blur: strong while flying, exactly none once landed
    const p = (t - k.t0) / k.dur;
    const st = p > 0 && p < 1 ? 1 : 0;
    if (st) { const e = Math.pow(1 - p, 1.4); k.b.set(k.bx * e, k.by * e); }
    if (st !== k.on) { k.el.style.filter = st ? k.b.url : 'none'; k.on = st; }
  }
  if (typeTrack) {                               // IME typing: which composition step is on screen at time t
    const k = typeTrack, n = k.steps.length, idx = clamp(Math.floor(((t - k.t0) / k.dur) * n), 0, n);
    if (idx !== k.i) { k.el.textContent = idx ? k.steps[idx - 1] : ''; k.i = idx; }
  }
  if (countTrack) {
    const k = countTrack, p = clamp((t - k.t0) / k.dur), v = k.to * (1 - Math.pow(1 - p, 3)), txt = v.toFixed(2);
    if (txt !== k.last) { k.el.textContent = txt; k.mk.style.setProperty('--v', (v / k.max).toFixed(3)); k.last = txt; }
  }
  ACTS.forEach((a, n) => {
    const p = clamp((t - a.t0) / (a.t1 - a.t0));
    if (Math.abs(p - a.p) > 0.002 || (p === 0 && a.p !== 0) || (p === 1 && a.p !== 1)) { actFills[n].style.setProperty('--p', p.toFixed(3)); a.p = p; }
  });
  const sec = Math.floor(t);
  if (sec !== lastSec) { tcEl.textContent = `00:${pad2(sec)}`; lastSec = sec; }
}

function applyRun() {
  const run = started && !locked && !userPaused && inView && !document.hidden;
  playing = run;
  film.classList.toggle('is-run', run);
  if (run) {
    tl.play();
    if (cur >= 0) SC[cur].bg.forEach((k) => BG[k].vids.forEach(playVideo));
  } else {
    tl.pause();
    for (const k in BG) BG[k].vids.forEach((v) => { if (!v.paused) v.pause(); });
  }
  const shown = !(started && !locked && !userPaused);
  pp.classList.toggle('is-paused', shown);
  pp.setAttribute('aria-label', shown ? '필름 재생' : '필름 일시정지');
}

function seek(t, hold = true) {
  t = clamp(+t || 0, 0, DUR - 0.001);
  if (hold) userPaused = true;
  tl.time(t, false);
  lastT = t;
  sync(t, true);
  applyRun();
}

function rebuild() {
  const t = tl ? tl.time() : 0;
  if (ctx) ctx.revert();
  build();
  if (t > 0) tl.time(t, false);
  cur = -1; lastT = t;
  sync(t, true);
  applyRun();
}

function setLang(l) {
  l = l === 'en' ? 'en' : 'ko';
  $$('.lang__b').forEach((b) => { const on = b.dataset.lang === l; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
  if (l === lang) return;
  lang = l;
  rebuild();                                     // same clock position, same motion, new words
}

/* ---------- header tone follows whatever is under it ---------- */
const toneSecs = $$('main [data-tone], footer[data-tone]');
function headerTone() {
  const y = hd.offsetHeight / 2;
  let tone = 'dark', overFilm = false;
  for (const s of toneSecs) {
    const r = s.getBoundingClientRect();
    if (r.top <= y && r.bottom > y) { tone = s.dataset.tone; overFilm = s === film; }
  }
  hd.dataset.tone = tone;
  hd.classList.toggle('is-solid', !overFilm);
}

/* ---------- boot ---------- */
build();
sync(0, true);
gsap.ticker.add(() => {
  if (!tl) return;
  const t = tl.time();
  if (t !== lastT) { lastT = t; sync(t); }
});

window.__film = {
  get tl() { return tl; },
  marks,
  seek,
  setLang,
  get lang() { return lang; },
  scenes: SC,
};

const filmText = typeLayer.textContent + Object.values(EN).join(' ').replace(/<[^>]+>/g, ' ');
const fontsLoaded = Promise.race([
  Promise.all([300, 500, 800].map((w) => document.fonts.load(`${w} 40px "Pretendard Variable"`, filmText))).catch(() => {}),
  new Promise((r) => setTimeout(r, 2400)),
]);

function startFilm() {
  if (started) return;
  started = true;
  $('#pre').classList.add('is-done');
  if (QA_T !== null) seek(QA_T);
  else if (REDUCED) seek(marks[marks.length - 2]);         // hold on the slogan
  else { tl.time(0, false); sync(0, true); applyRun(); }
}
if (QA_T !== null) startFilm();                             // QA: show the requested frame at once, refine when fonts arrive
fontsLoaded.then(() => {
  if (started) rebuild(); else { rebuild(); startFilm(); }
});
document.fonts.ready.then(() => { if (started && (locked || userPaused)) rebuild(); });

pp.addEventListener('click', () => {
  if (locked) { locked = false; userPaused = false; } else userPaused = !userPaused;
  applyRun();
});
actBtns.forEach((b, n) => b.addEventListener('click', () => { locked = false; userPaused = false; seek(ACTS[n].t0, false); }));
$$('.lang__b').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
setLang(lang);

new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (started) applyRun(); }, { threshold: 0.04 }).observe(film);
document.addEventListener('visibilitychange', () => { if (started) applyRun(); });

let rw = innerWidth, rh = innerHeight, rT = 0;
addEventListener('resize', () => {
  clearTimeout(rT);
  rT = setTimeout(() => {
    if (innerWidth === rw && Math.abs(innerHeight - rh) < 120) return;
    rw = innerWidth; rh = innerHeight;
    rebuild();
  }, 180);
});

/* ════════════════════════════════════════════════════════════════ PAGE BELOW THE FILM */

let lenis = null;
if (!REDUCED && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* header: hide on the way down, show on the way up */
let lastY = 0;
function onScroll() {
  const y = scrollY;
  if (y < innerHeight * 0.5) hd.classList.remove('is-hide');
  else if (y > lastY + 6) hd.classList.add('is-hide');
  else if (y < lastY - 6) hd.classList.remove('is-hide');
  if (Math.abs(y - lastY) > 6) lastY = y;
  headerTone();
}
addEventListener('scroll', onScroll, { passive: true });
headerTone();

/* mobile menu (names only) */
const burger = $('#burger'), mnav = $('#mnav');
burger.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') !== 'true';
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  mnav.classList.toggle('is-open', open);
  mnav.setAttribute('aria-hidden', !open);
  hd.dataset.tone = open ? 'dark' : hd.dataset.tone;
  if (!open) headerTone();
  if (lenis) open ? lenis.stop() : lenis.start();
});

/* ---------- 1–2. pinned: cards → full-bleed → circle wipe into the line-up ---------- */
(function beyond() {
  const by = $('#by'), lu = $('#lu');
  const head = $('.by__hd', by), card = $('.by__card', by), copy = $('.by__copy', by), full = $('.by__full', by);
  const ms = $$('.by__m', by), caps = $$('.by__cap', by), says = $$('.by__say span', by);
  const nums = $$('.by__num b', by), bar = $('.by__idx u', by), defs = $$('.by__def p', by);
  const cardVid = $('video', card);

  const U = 9.4, WIPE = 1.5;                                   // timeline length / wipe length, in timeline units
  const dist = () => Math.round(innerHeight * 4.6);            // scroll distance of the pin
  const wipePx = () => dist() * (WIPE / U);
  const H = () => by.offsetHeight;

  const t = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: by, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1,
      onUpdate: (self) => lu.classList.toggle('is-in', self.progress >= 0.999),
      onRefresh: (self) => lu.classList.toggle('is-in', self.progress >= 0.999),
      onToggle: (self) => { if (self.isActive) playVideo(cardVid); else cardVid.pause(); },
    },
  });

  /* intro: title settles to the top, card + copy rise into place */
  t.fromTo(head, { y: () => H() * 0.2, scale: 1.24 }, { y: 0, scale: 1, duration: 1, ease: 'power2.inOut' }, 0)
    .fromTo(card, { y: () => H() * 0.3 }, { y: 0, duration: 1, ease: 'power2.inOut' }, 0)
    .fromTo(copy, { y: () => H() * 0.38, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power2.inOut' }, 0)
    .fromTo(says[0], { opacity: 0.3 }, { opacity: 1, duration: 0.4 }, 0.6);

  const swap = (i, at) => {
    t.fromTo(ms[i], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'power2.inOut' }, at)
      .fromTo(ms[i].firstElementChild, { scale: 1.25 }, { scale: 1, duration: 0.8, ease: 'power2.inOut' }, at)
      .to(ms[i - 1].firstElementChild, { yPercent: -8, duration: 0.8, ease: 'power2.inOut' }, at)
      .to(caps[i - 1], { opacity: 0, y: -30, duration: 0.4, ease: 'power1.in' }, at)
      .fromTo(caps[i], { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, at + 0.35)
      .to(says[i], { opacity: 1, duration: 0.4 }, at + 0.3)
      .to(nums, { yPercent: -100 * i, duration: 0.5, ease: 'power2.inOut' }, at + 0.15)
      .to(bar, { '--ip': (i + 1) / 3, duration: 0.6, ease: 'power2.inOut' }, at + 0.15);
  };
  swap(1, 1.7);
  swap(2, 3.2);

  /* card → full bleed (clip-path opens from the card's own rectangle), statement on top */
  t.to(caps[2], { opacity: 0, duration: 0.3 }, 4.5)
    .to(copy, { opacity: 0, duration: 0.4 }, 4.6)
    .to(head, { opacity: 0, duration: 0.5 }, 5.0)
    .fromTo(full, { opacity: 0 }, { opacity: 1, duration: 0.35 }, 4.55)
    .fromTo($('img', full), { scale: 1.32 }, { scale: 1, duration: 2.4, ease: 'power1.out' }, 4.55)
    .fromTo(by, { '--e1': 0 }, { '--e1': 1, duration: 1.5, ease: 'power2.inOut' }, 4.8)
    .fromTo(full, { '--dim': 0 }, { '--dim': 0.5, duration: 0.8 }, 6.1)
    .fromTo(defs, { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.22, ease: 'power2.out' }, 6.3)

  /* circle wipe: the line-up section is held at the top of the viewport (y cancels the remaining scroll) while its clip circle grows */
    .fromTo(lu, { y: () => -wipePx() }, { y: 0, duration: WIPE }, U - WIPE)
    .fromTo(lu, { clipPath: () => `circle(0px at 50% ${H() / 2}px)` },
      { clipPath: () => `circle(${Math.ceil(Math.hypot(innerWidth, H()) / 2 + 30)}px at 50% ${H() / 2}px)`, duration: WIPE, ease: 'power1.in' }, U - WIPE)
    .set(lu, { clipPath: 'none' }, U);
})();

/* ---------- reveals, counters, in-view video ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
$$('[data-rv], .pc, .lu__note, .ws__big').forEach((el) => io.observe(el));

const cnt = $('#cnt');
if (cnt) {
  const to = +cnt.dataset.to, st = { v: REDUCED ? to : 0 };
  const put = () => { cnt.textContent = Math.round(st.v).toLocaleString('en-US'); };
  put();
  new IntersectionObserver(([e], ob) => {
    if (!e.isIntersecting) return;
    ob.disconnect();
    gsap.to(st, { v: to, duration: 2.2, ease: 'power3.out', onUpdate: put });
  }, { threshold: 0.5 }).observe(cnt);
}

const oVid = $('.ws__o video');
if (oVid) new IntersectionObserver(([e]) => { if (e.isIntersecting && !REDUCED) playVideo(oVid); else oVid.pause(); }, { threshold: 0.1 }).observe(oVid);

addEventListener('load', () => ScrollTrigger.refresh());
