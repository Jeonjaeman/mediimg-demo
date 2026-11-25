/* MEDIIMG demo 05 v3 — sub pages (technology.html · neuflow.html · flocal.html)
   shared: header · menu · sticky sub menu · reveals · footer, then modules switched on by markup
   (SIG diagram, before/after slider, pinned steps, slice zoom, tabs, FAQ, brochure modal) and per-page motion (data-page="tech" | "flocal").
   Animated parts use transform / opacity (and stroke-dashoffset on SVG paths) only, each with an explicit end state;
   anything hidden by script is guaranteed a reveal, and html.no-motion shows everything if a library fails to load. */
import { FrameSequence } from '../shared/frameseq.js';

const { gsap, ScrollTrigger } = window;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const page = document.body.dataset.page;

/* ---------------------------------------------------------------- media that failed to arrive is requested again (max 3x) */
document.addEventListener('error', (e) => {
  const el = e.target;
  if (!el || !el.dataset || el.tagName !== 'IMG') return;
  const n = +(el.dataset.retry || 0);
  if (n >= 3) return;
  el.dataset.retry = n + 1;
  setTimeout(() => { const src = el.getAttribute('src'); el.removeAttribute('src'); el.setAttribute('src', src); }, 600 * (n + 1));
}, true);

/* The shared player is used as-is; this wrapper only caps parallel requests and retries a frame that failed to arrive. */
class RetrySequence extends FrameSequence {
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

if (!gsap || !ScrollTrigger) {
  root.classList.add('no-motion');
} else {
  try { init(); } catch (err) { root.classList.add('no-motion'); throw err; }
}

function init() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ------------------------------------------------------------ smooth scroll */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.4 }) : window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));

  /* ------------------------------------------------------------ header : tone · hide on scroll down · menu */
  const hd = $('#hd'), burger = $('#burger'), mnav = $('#mnav'), snav = $('#snav');
  let menuOpen = false, lastY = window.scrollY;
  $$('section[data-tone]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec, start: 'top 34px', end: 'bottom 34px',
      onToggle: (self) => { if (self.isActive) hd.dataset.tone = sec.dataset.tone; },
    });
    ScrollTrigger.create({     // the sub menu sits below the header (or at the very top while the header is hidden)
      trigger: sec, start: 'top 100px', end: 'bottom 100px',
      onToggle: (self) => { if (self.isActive) snav.dataset.tone = sec.dataset.tone; },
    });
  });
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (self) => {
      const y = self.scroll();
      snav.style.setProperty('--p', self.progress.toFixed(4));
      if (Math.abs(y - lastY) < 8) return;
      const hide = y > lastY && y > 140 && !menuOpen;
      hd.classList.toggle('is-hidden', hide);
      hd.classList.toggle('is-solid', y > 140 && !menuOpen);
      root.classList.toggle('hd-off', hide);
      lastY = y;
    },
  });
  function setMenu(open) {
    menuOpen = open;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    mnav.classList.toggle('is-open', open);
    mnav.setAttribute('aria-hidden', String(!open));
    if (open) { hd.dataset.prevTone = hd.dataset.tone; hd.dataset.tone = 'dark'; lenis && lenis.stop(); }
    else { hd.dataset.tone = hd.dataset.prevTone || 'dark'; lenis && lenis.start(); }
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
  $$('.hd__lang button').forEach((b) => b.addEventListener('click', () => $$('.hd__lang button').forEach((o) => o.classList.toggle('is-on', o === b))));

  /* in-page links (sub menu · hero button) scroll smoothly under the sticky sub menu */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const hash = a.getAttribute('href');
    const target = $(hash);
    if (!target) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    const top = target.getBoundingClientRect().top + window.scrollY;
    // scrolling up brings the header back, and the sub menu then sits below it
    const up = top - snav.offsetHeight < window.scrollY;
    scrollToY(Math.max(0, top - snav.offsetHeight - (up ? hd.offsetHeight : 0)));
    history.replaceState(null, '', hash);
  });
  $('#toTop').addEventListener('click', () => scrollToY(0));

  /* ------------------------------------------------------------ sticky sub menu : current section + sliding bar
     Flat menus: every top item is a section link (a[data-sec]).
     Grouped menus (NeuFlow): top items are groups (a[data-grp]); each group's section links sit in ul.snav__sub[data-grp],
     only the current group's list is shown, and both the group and the section are marked current. */
  const snavList = $('#snavList'), snavBar = $('.snav__bar', snavList);
  const snavLinks = $$('a[data-sec]', snav);
  const snavSubs = $$('.snav__sub', snav);
  const topOf = (l) => { const ul = l.closest('.snav__sub'); return ul ? $(`a[data-grp="${ul.dataset.grp}"]`, snavList) : l; };
  let curLink = null;
  const centerIn = (box, el, smooth) => {
    if (box.scrollWidth > box.clientWidth + 2) box.scrollTo({ left: Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2), behavior: smooth && !reduce ? 'smooth' : 'auto' });
  };
  function placeBar(smooth) {
    if (!curLink) { snavBar.classList.remove('is-on'); return; }
    const li = topOf(curLink).parentElement;
    snavBar.style.setProperty('--x', `${li.offsetLeft}px`);
    snavBar.style.setProperty('--w', `${li.offsetWidth}px`);
    snavBar.classList.add('is-on');
    centerIn(snavList, li, smooth);
    const sub = curLink.closest('.snav__sub');
    if (sub) centerIn(sub, curLink.parentElement, smooth);
  }
  function setCurrent(id) {
    curLink = snavLinks.find((l) => l.dataset.sec === id) || null;
    const top = curLink && topOf(curLink);
    snavLinks.forEach((l) => { if (l === curLink) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
    $$('a[data-grp]', snavList).forEach((g) => { if (g === top) g.setAttribute('aria-current', 'true'); else g.removeAttribute('aria-current'); });
    if (snavSubs.length) {
      const grp = (top && top.dataset.grp) || snavSubs[0].dataset.grp;   // before the first group: show the first group's items
      snavSubs.forEach((u) => u.classList.toggle('is-on', u.dataset.grp === grp));
    }
    placeBar(true);
  }
  snavLinks.forEach((l) => {
    const sec = document.getElementById(l.dataset.sec);
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { if (self.isActive) setCurrent(l.dataset.sec); } });
  });
  ScrollTrigger.create({ trigger: '#top', start: 'top 50%', end: 'bottom 50%', onToggle: (self) => { if (self.isActive) setCurrent(null); } });
  /* very tall screens cannot scroll the last short section up to the 55% line: at the bottom of the page the last item is current */
  const secTop = (l) => { const s = document.getElementById(l.dataset.sec); return s ? s.getBoundingClientRect().top : -Infinity; };
  const lastLink = snavLinks.reduce((a, l) => (!a || secTop(l) > secTop(a) ? l : a), null);
  if (lastLink) ScrollTrigger.create({ start: () => ScrollTrigger.maxScroll(window) - 4, end: () => ScrollTrigger.maxScroll(window) + 100, onToggle: (self) => { if (self.isActive) setCurrent(lastLink.dataset.sec); } });
  window.addEventListener('resize', () => placeBar(false));
  if (snavSubs.length) setCurrent(null);

  /* ------------------------------------------------------------ generic reveals */
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
    /* "from the right" entrances */
    $$('[data-slide="right"]').forEach((el) => {
      gsap.fromTo(el, { x: 90, autoAlpha: 0 }, {
        x: 0, autoAlpha: 1, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
    /* hero : title lines rise, the rest fades up */
    const heroLines = $$('.sh__title .ln > span');
    const heroRest = $$('.sh .fh__logo, .sh .fh__tags, .sh .sh__tag, .sh .sh__desc, .sh .sh__cert, .sh .sh__btn, .sh .sh__scroll');
    gsap.set(heroLines, { yPercent: 112 });
    gsap.set(heroRest, { autoAlpha: 0, y: 18 });
    gsap.to(heroRest.filter((el) => el.matches('.fh__logo, .fh__tags, .sh__tag')), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.15 });
    gsap.to(heroLines, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.1, delay: 0.3 });
    gsap.to(heroRest.filter((el) => el.matches('.sh__desc, .sh__cert, .sh__btn, .sh__scroll')), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.75 });
    /* slow parallax on the hero backdrop */
    const bg = $('.sh__bg');
    if (bg) gsap.to(bg, { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.sh', start: 'top top', end: 'bottom top', scrub: true } });
  }

  if ($('#dg')) initDiagram();
  if ($('#ba')) initBa();
  if ($('.proc')) initProc();
  if ($('.slice')) initZoom();
  $$('[role="tablist"]').forEach(initTabs);
  $$('.qa').forEach(initQa);
  if ($('#modalBrochure')) initModal();
  if (page === 'tech') initTech();
  if (page === 'flocal') initFlocal();

  /* ------------------------------------------------------------ settle */
  const settle = () => { ScrollTrigger.refresh(); placeBar(false); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  window.addEventListener('load', settle);

  /* ============================================================ SIG diagram (technology · neuflow) */
  function initDiagram() {
    /* --- flow arrows -> wall shear stress -> SIG, drawn as the diagram scrolls through --- */
    const legend = $$('#dgLegend li');
    const setStage = (st) => legend.forEach((li) => li.classList.toggle('is-on', +li.dataset.st <= st));
    if (reduce) setStage(3);
    else {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '#dg', start: 'top 82%', end: 'top 26%', scrub: 0.6,
          onUpdate: (self) => setStage(self.progress > 0.66 ? 3 : self.progress > 0.35 ? 2 : self.progress > 0.02 ? 1 : 0),
        },
      });
      tl.fromTo('.dg-s1 .dg-line', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.16, stagger: 0.02 }, 0)
        .fromTo('.dg-s1 .dg-head', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04, stagger: 0.02 }, 0.12)
        .fromTo('.dg-env, .dg-s1 text', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.28)
        .fromTo('.dg-wss .dg-line', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.1, stagger: 0.015 }, 0.37)
        .fromTo('.dg-wss .dg-head', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04, stagger: 0.015 }, 0.43)
        .fromTo('.dg-s2 .dg-lead, .dg-s2 text', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.06 }, 0.5)
        .fromTo('.dg-strip', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08 }, 0.67)
        .fromTo('.dg-s3 > :not(.dg-strip)', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.07, stagger: 0.03 }, 0.74)
        .fromTo('.dg-sec-l, .dg-secring', { autoAlpha: 0.15 }, { autoAlpha: 1, duration: 0.2 }, 0.05)
        .set({}, {}, 1);
    }
  }

  /* ============================================================ TECHNOLOGY */
  function initTech() {
    /* --- VINT : colour fills the vessel as the pinned section scrolls (white stage) --- */
    const canvas = $('#vintSeq');
    const mobile = !matchMedia('(min-width: 900px)').matches;
    const step = mobile ? 2 : 1;                       // phones use every other frame (49 of 97)
    const count = mobile ? 49 : 97;
    const seq = new RetrySequence({
      canvas, count, fit: 'contain', background: '#ffffff', maxDpr: 1.5,
      url: (i) => `../assets/seq/colorize/${pad(i * step + 1, 4)}.webp`,
    });
    let seqStarted = false;
    const startSeq = () => { if (seqStarted) return; seqStarted = true; seq.load().then(() => { if (reduce) seq.draw(1); }); };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) { startSeq(); io.disconnect(); } }, { rootMargin: '500px 0px' });
      io.observe($('#vintFrame'));
    } else startSeq();

    const items = $$('#vintList .vi');
    let viNow = 0;
    const setVi = (i) => { if (i === viNow) return; viNow = i; items.forEach((el, k) => el.classList.toggle('is-on', k === i)); };
    if (reduce) { startSeq(); items.forEach((el) => el.classList.add('is-on')); }

    const mm = gsap.matchMedia();
    mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.create({
        trigger: '#vintPin', start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => { const p = clamp(self.progress / 0.92, 0, 1); seq.draw(p); setVi(Math.min(items.length - 1, Math.floor(p * items.length))); },
        onRefresh: (self) => { const p = clamp(self.progress / 0.92, 0, 1); seq.draw(p); },
      });
      return () => { viNow = -1; setVi(0); };
    });
    mm.add('(max-width: 1099px) and (prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.create({
        trigger: '#vintFrame', start: 'top 82%', end: 'bottom 32%',
        onUpdate: (self) => seq.draw(self.progress),
        onRefresh: (self) => seq.draw(self.progress),
      });
    });

    /* --- HOW : DICOM -> VINT -> Report line draws in; pinned three steps swap the screen --- */
    if (!reduce) {
      gsap.fromTo('.flow__ln', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', stagger: 0.45, scrollTrigger: { trigger: '#flow', start: 'top 90%', once: true } });
    }
    const hsItems = $$('#hs .hs__i'), hmPanels = $$('#hm .hm__p');
    let hsNow = 0;
    const setHs = (i) => {
      hsNow = i;
      hsItems.forEach((el, k) => el.classList.toggle('is-on', k === i));
      hmPanels.forEach((el, k) => el.classList.toggle('is-on', k === i));
    };
    mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
      ScrollTrigger.create({
        trigger: '#howPin', start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => {
          const sp = clamp(self.progress, 0, 0.9999) * hsItems.length;
          const idx = Math.floor(sp);
          if (idx !== hsNow) setHs(idx);
          hsItems[idx].style.setProperty('--prog', (sp - idx).toFixed(3));
        },
      });
      return () => { setHs(0); hsItems.forEach((el) => el.style.removeProperty('--prog')); };
    });
  }

  /* ============================================================ before / after slider (same behaviour as the main page) */
  function initBa() {
    const ba = $('#ba'), baRead = $('#baRead'), baRange = $('#baRange'), baHint = $('#baHint');
    let baDrag = false, baTween = null, baIdle = null, baTouched = false;
    const setBa = (v) => {
      const pos = clamp(v, 0, 100);
      ba.style.setProperty('--pos', `${pos.toFixed(2)}%`);
      if (baRead) baRead.textContent = pad(Math.round(100 - pos));
      baRange.value = pos;
    };
    const fromEvent = (e) => { const r = ba.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
    const stopIdle = () => {
      baTouched = true;
      if (baIdle) { baIdle.kill(); baIdle = null; }
      baHint && baHint.classList.add('is-hidden');
    };
    ba.addEventListener('pointerdown', (e) => {
      baDrag = true; ba.classList.add('is-drag');
      if (baTween) baTween.kill();
      stopIdle();
      try { ba.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
      setBa(fromEvent(e));
    });
    ba.addEventListener('pointermove', (e) => { if (baDrag) setBa(fromEvent(e)); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => ba.addEventListener(t, () => { baDrag = false; ba.classList.remove('is-drag'); }));
    baRange.addEventListener('input', () => { stopIdle(); setBa(+baRange.value); });
    if (reduce) { setBa(50); return; }
    const st = { v: 88 };
    setBa(st.v);
    const startIdle = () => {
      if (baTouched || baIdle) return;
      baIdle = gsap.timeline({ repeat: -1, repeatDelay: 2.4, defaults: { ease: 'sine.inOut', onUpdate: () => setBa(st.v) } })
        .to(st, { v: 58, duration: 1.1 })
        .to(st, { v: 36, duration: 1.6 })
        .to(st, { v: 46, duration: 1.0 });
    };
    ScrollTrigger.create({
      trigger: ba, start: 'top 70%', once: true,
      onEnter: () => { if (baTouched) return; baTween = gsap.to(st, { v: 46, duration: 2.1, ease: 'power3.inOut', onUpdate: () => setBa(st.v), onComplete: startIdle }); },
    });
    ScrollTrigger.create({
      trigger: ba, start: 'top 90%', end: 'bottom 10%',
      onToggle: (self) => { if (baIdle) baIdle[self.isActive ? 'play' : 'pause'](); },
    });
  }

  /* ============================================================ pinned step walkthrough (same as the main page's process section) */
  function initProc() {
    const proc = $('.proc'), steps = $$('.pstep', proc), media = $$('.pm', proc), now = $('.proc__now span', proc);
    let cur = 0, st = null;
    const setStep = (i) => {
      cur = i;
      steps.forEach((el, k) => { el.classList.toggle('is-open', k === i); $('.pstep__head', el).setAttribute('aria-expanded', String(k === i)); });
      media.forEach((el, k) => el.classList.toggle('is-on', k === i));
      if (now) now.textContent = pad(i + 1);
    };
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1100px) and (prefers-reduced-motion: no-preference)', () => {
      st = ScrollTrigger.create({
        trigger: proc, start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => {
          const sp = clamp(self.progress, 0, 0.9999) * steps.length;
          const idx = Math.floor(sp);
          if (idx !== cur) setStep(idx);
          steps[idx].style.setProperty('--prog', (sp - idx).toFixed(3));
        },
      });
      return () => { st && st.kill(); st = null; steps.forEach((el) => el.style.removeProperty('--prog')); };
    });
    steps.forEach((el, i) => {
      $('.pstep__head', el).addEventListener('click', () => {
        if (st) scrollToY(st.start + (st.end - st.start) * ((i + 0.5) / steps.length));
        else setStep(i);
      });
    });
  }

  /* ============================================================ slice zoom (same as the main page) */
  function initZoom() {
    const zoom = document.createElement('div');
    zoom.className = 'zoom';
    zoom.setAttribute('role', 'dialog');
    zoom.setAttribute('aria-modal', 'true');
    zoom.setAttribute('aria-hidden', 'true');
    zoom.innerHTML = '<img alt=""><p></p><button type="button" aria-label="닫기">×</button>';
    document.body.appendChild(zoom);
    let back = null;
    const open = (slice) => {
      const img = $('img', slice), label = ($('span', slice) || {}).textContent || '';
      $('img', zoom).src = img.currentSrc || img.src;
      $('img', zoom).alt = img.alt;
      $('p', zoom).textContent = label;
      back = slice;
      zoom.classList.add('is-open');
      zoom.setAttribute('aria-hidden', 'false');
      lenis && lenis.stop();
      document.body.classList.add('is-locked');
      $('button', zoom).focus();
    };
    const close = () => {
      if (!zoom.classList.contains('is-open')) return;
      zoom.classList.remove('is-open');
      zoom.setAttribute('aria-hidden', 'true');
      lenis && lenis.start();
      document.body.classList.remove('is-locked');
      back && back.focus && back.focus();
    };
    $$('.slice').forEach((s) => {
      const label = ($('span', s) || {}).textContent || '단면 영상';
      s.tabIndex = 0;
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', `${label} 크게 보기`);
      s.addEventListener('click', () => open(s));
      s.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s); } });
    });
    zoom.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ============================================================ tabs (사용자별 혜택) : arrow keys, the active panel fades in */
  function initTabs(list) {
    const tabs = $$('[role="tab"]', list);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    const ink = $('.utabs__ink', list);
    const placeInk = () => {
      const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true');
      if (!ink || !t) return;
      ink.style.setProperty('--x', `${t.offsetLeft}px`);
      ink.style.setProperty('--w', `${t.offsetWidth}px`);
    };
    const select = (i, focus) => {
      tabs.forEach((t, k) => {
        const on = k === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[k].hidden = !on;
      });
      placeInk();
      if (focus) tabs[i].focus();
      if (!reduce) gsap.fromTo($$('.utab__fx', panels[i]), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07, overwrite: true });
      ScrollTrigger.refresh();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const k = tabs.indexOf(t);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); select((k + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true); }
        if (e.key === 'Home') { e.preventDefault(); select(0, true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
      });
    });
    placeInk();
    window.addEventListener('resize', placeInk);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeInk);
  }

  /* ============================================================ FAQ : native <details>, opened / closed with a height tween */
  function initQa(box) {
    $$('details', box).forEach((d) => {
      const sum = $('summary', d), body = $('.qa__a', d);
      sum.addEventListener('click', (e) => {
        if (reduce || !body) return;
        e.preventDefault();
        if (d.open) {
          gsap.to(body, { height: 0, autoAlpha: 0, duration: 0.4, ease: 'power2.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height,opacity,visibility' }); ScrollTrigger.refresh(); } });
        } else {
          d.open = true;
          gsap.fromTo(body, { height: 0, autoAlpha: 0 }, { height: 'auto', autoAlpha: 1, duration: 0.5, ease: 'power3.out', onComplete: () => { gsap.set(body, { clearProps: 'height,opacity,visibility' }); ScrollTrigger.refresh(); } });
        }
      });
    });
  }

  /* ============================================================ brochure request modal (same flow as the main page; nothing is sent) */
  function initModal() {
    const modal = $('#modalBrochure'), form = $('#brochureForm'), msg = $('#modalMsg');
    let back = null;
    const open = () => {
      back = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      lenis && lenis.stop();
      document.body.classList.add('is-locked');
      setTimeout(() => $('input', form).focus(), 60);
    };
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      lenis && lenis.start();
      document.body.classList.remove('is-locked');
      back && back.focus && back.focus();
    };
    $$('[data-modal="brochure"]').forEach((b) => b.addEventListener('click', open));
    $$('[data-modal-close]', modal).forEach((b) => b.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        msg.textContent = '기관명 · 성함 · 이메일과 동의 항목을 확인해 주세요.';
        msg.classList.add('is-err');
        form.reportValidity();
        return;
      }
      // design mock-up: nothing is sent. the receiving address is awaiting the client's confirmation (갑 확인 ④)
      msg.classList.remove('is-err');
      msg.textContent = '시안에서는 발송되지 않습니다. 실제 사이트에서는 확인된 접수 이메일로 전달됩니다.';
    });
  }

  /* ============================================================ FLOCAL */
  function initFlocal() {
    /* --- hero : particles stream to the right along a vessel-shaped band (centre faster than the walls).
           Reduced motion: one still frame. Paused while the hero is off screen or the tab is hidden. --- */
    const cv = $('#fhFlow'), stage = $('.sh--flo');
    if (cv && cv.getContext) {
      const ctx = cv.getContext('2d');
      const COLORS = ['#2f6dff', '#2f6dff', '#19c8f0', '#19c8f0', '#4fa3ff', '#7df5e0', '#ff8a3d'];
      let W = 0, H = 0, dpr = 1, parts = [], run = false, raf = 0, last = 0, t0 = performance.now();
      // the band: a gently curving vessel, narrower in the middle, wider toward the right edge
      const midY = (x, t) => H * 0.6 + H * 0.07 * Math.sin((x / W) * Math.PI * 1.25 - 0.6 + t * 0.0002);
      const half = (x) => Math.min(H, W * 0.9) * (0.15 - 0.06 * Math.exp(-((((x / W) - 0.5) / 0.2) ** 2)) + 0.05 * Math.max(0, (x / W) - 0.6));
      const spawn = (p, anyX) => {
        p.u = (Math.random() * 2 - 1) * 0.97;
        p.x = anyX ? Math.random() * W * 1.1 - W * 0.05 : -Math.random() * W * 0.15;
        p.v = (0.085 + Math.random() * 0.04) * Math.max(W, 900) / 1000 * (1 - 0.7 * p.u * p.u);   // px per ms; parabolic profile (centre fastest)
        p.c = COLORS[(Math.random() * COLORS.length) | 0];
        if (p.c === '#ff8a3d' && Math.abs(p.u) > 0.4) p.c = '#19c8f0';             // warm streaks stay near the centre line
        p.w = 0.7 + Math.random() * 1.4;
        p.a = 0.3 + Math.random() * 0.6;
        p.l = (24 + Math.random() * 70) * (1 - 0.5 * p.u * p.u);
        return p;
      };
      const band = (t) => {                                                       // soft glow inside the vessel walls
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, 'rgba(47,109,255,0)');
        g.addColorStop(0.35, 'rgba(47,109,255,.07)');
        g.addColorStop(1, 'rgba(25,200,240,.12)');
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, midY(x, t) - half(x));
        for (let x = W; x >= 0; x -= 24) ctx.lineTo(x, midY(x, t) + half(x));
        ctx.closePath();
        ctx.fill();
      };
      const size = () => {
        const r = stage.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.round(clamp(W * Math.min(H, W) / 1700, 220, 900));
        parts = Array.from({ length: n }, () => spawn({}, true));
      };
      const draw = (dt, t) => {
        ctx.clearRect(0, 0, W, H);
        band(t);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (const p of parts) {
          p.x += p.v * dt;
          if (p.x - p.l > W) spawn(p, false);
          const y = midY(p.x, t) + p.u * half(p.x);
          const yb = midY(p.x - p.l, t) + p.u * half(p.x - p.l);
          const fade = clamp((p.x / W - 0.02) / 0.3, 0, 1);                     // streams appear from the left, fully lit past ~30%
          if (fade <= 0) continue;
          ctx.globalAlpha = p.a * fade;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = p.w;
          ctx.beginPath(); ctx.moveTo(p.x - p.l, yb); ctx.lineTo(p.x, y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      };
      const loop = (now) => {
        if (!run) return;
        const dt = Math.min(48, now - last); last = now;
        draw(dt, now - t0);
        raf = requestAnimationFrame(loop);
      };
      const start = () => { if (run || reduce) return; run = true; last = performance.now(); raf = requestAnimationFrame(loop); };
      const stop = () => { run = false; cancelAnimationFrame(raf); };
      size();
      if (reduce) draw(0, 0);
      else {
        gsap.fromTo(cv, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.8, ease: 'power2.out', delay: 0.2 });
        start();
        let inView = true;
        if ('IntersectionObserver' in window) {
          new IntersectionObserver((ents) => { ents.forEach((e) => { inView = e.isIntersecting; if (inView && !document.hidden) start(); else stop(); }); }, { threshold: 0.02 }).observe(stage);
        }
        document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (inView) start(); });
      }
      let rt = 0;
      window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { size(); if (reduce) draw(0, 0); }, 150); });
    }

    /* --- 사용 과정 : the line through the five steps draws in --- */
    if (!reduce) {
      const line = $('.fpr__line i');
      if (line) gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.fpr__list', start: 'top 80%', end: 'bottom 60%', scrub: 0.6 } });
    }

    /* --- certification : the check draws itself --- */
    if (!reduce && $('.fce__card')) {
      gsap.fromTo('.fce__c', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', scrollTrigger: { trigger: '.fce__card', start: 'top 85%', once: true } });
      gsap.fromTo('.fce__v', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out', delay: 0.55, scrollTrigger: { trigger: '.fce__card', start: 'top 85%', once: true } });
    }
  }
}
