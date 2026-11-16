/* MEDIIMG demo 05 v3 — sub pages (technology.html · flocal.html)
   shared: header · menu · sticky sub menu · reveals · footer — then per-page motion (data-page="tech" | "flocal").
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
    scrollToY(Math.max(0, target.getBoundingClientRect().top + window.scrollY - snav.offsetHeight));
    history.replaceState(null, '', hash);
  });
  $('#toTop').addEventListener('click', () => scrollToY(0));

  /* ------------------------------------------------------------ sticky sub menu : current section + sliding bar */
  const snavList = $('#snavList'), snavBar = $('.snav__bar', snavList);
  const snavLinks = $$('a[data-sec]', snavList);
  let curLink = null;
  function placeBar(smooth) {
    if (!curLink) { snavBar.classList.remove('is-on'); return; }
    const li = curLink.parentElement;
    snavBar.style.setProperty('--x', `${li.offsetLeft}px`);
    snavBar.style.setProperty('--w', `${li.offsetWidth}px`);
    snavBar.classList.add('is-on');
    if (snavList.scrollWidth > snavList.clientWidth + 2) {
      snavList.scrollTo({ left: Math.max(0, li.offsetLeft - (snavList.clientWidth - li.offsetWidth) / 2), behavior: smooth && !reduce ? 'smooth' : 'auto' });
    }
  }
  function setCurrent(id) {
    curLink = snavLinks.find((l) => l.dataset.sec === id) || null;
    snavLinks.forEach((l) => { if (l === curLink) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current'); });
    placeBar(true);
  }
  snavLinks.forEach((l) => {
    const sec = document.getElementById(l.dataset.sec);
    if (!sec) return;
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { if (self.isActive) setCurrent(l.dataset.sec); } });
  });
  ScrollTrigger.create({ trigger: '#top', start: 'top 50%', end: 'bottom 50%', onToggle: (self) => { if (self.isActive) setCurrent(null); } });
  window.addEventListener('resize', () => placeBar(false));

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
    const heroRest = $$('.sh .fh__logo, .sh .fh__tags, .sh .sh__tag, .sh .sh__desc, .sh .sh__btn, .sh .sh__scroll');
    gsap.set(heroLines, { yPercent: 112 });
    gsap.set(heroRest, { autoAlpha: 0, y: 18 });
    gsap.to(heroRest.filter((el) => el.matches('.fh__logo, .fh__tags, .sh__tag')), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.15 });
    gsap.to(heroLines, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: 0.1, delay: 0.3 });
    gsap.to(heroRest.filter((el) => el.matches('.sh__desc, .sh__btn, .sh__scroll')), { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.75 });
    /* slow parallax on the hero backdrop */
    const bg = $('.sh__bg');
    if (bg) gsap.to(bg, { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.sh', start: 'top top', end: 'bottom top', scrub: true } });
  }

  if (page === 'tech') initTech();
  if (page === 'flocal') initFlocal();

  /* ------------------------------------------------------------ settle */
  const settle = () => { ScrollTrigger.refresh(); placeBar(false); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  window.addEventListener('load', settle);

  /* ============================================================ TECHNOLOGY */
  function initTech() {
    /* --- SIG diagram : flow arrows -> wall shear stress -> SIG, drawn as the diagram scrolls through --- */
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

  /* ============================================================ FLOCAL */
  function initFlocal() {
    /* --- hero : a circle opens from the logo and the flow-streak video is revealed --- */
    const stage = $('.sh--flo'), vidBox = $('#fhVid'), video = $('#fhVideo'), ring = $('#fhRing'), logo = $('.fh__logo');
    let revealed = reduce;
    const play = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
    if (!reduce) {
      const measure = () => {
        const sr = stage.getBoundingClientRect(), lr = logo.getBoundingClientRect();
        const cx = lr.left - sr.left + lr.width * 0.13, cy = lr.top - sr.top + lr.height / 2;
        const R = Math.hypot(Math.max(cx, sr.width - cx), Math.max(cy, sr.height - cy)) + 4;
        return { cx, cy, R };
      };
      const o = { r: 0 };
      let g = measure();
      const apply = () => {
        vidBox.style.clipPath = `circle(${o.r.toFixed(1)}px at ${g.cx.toFixed(1)}px ${g.cy.toFixed(1)}px)`;
        ring.style.transform = `translate3d(${(g.cx - 100).toFixed(1)}px,${(g.cy - 100).toFixed(1)}px,0) scale(${Math.max(o.r, 0.01) / 100})`;
        ring.style.opacity = String(clamp(0.8 * (1 - o.r / g.R), 0, 0.8));
      };
      apply();
      video.preload = 'auto';
      play();
      gsap.to(o, {
        r: () => g.R, duration: 2.6, ease: 'power3.inOut', delay: 0.6, onUpdate: apply,
        onComplete: () => { revealed = true; vidBox.style.clipPath = 'none'; ring.style.opacity = '0'; },
      });
      window.addEventListener('resize', () => { g = measure(); if (revealed) return; apply(); });
      /* pause the video while the hero is off screen */
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((ents) => { ents.forEach((e) => { if (e.isIntersecting) play(); else video.pause(); }); }, { threshold: 0.05 }).observe(stage);
      }
    }

    /* --- certification : the check draws itself --- */
    if (!reduce) {
      gsap.fromTo('.fce__c', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: 'power2.inOut', scrollTrigger: { trigger: '.fce__card', start: 'top 85%', once: true } });
      gsap.fromTo('.fce__v', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out', delay: 0.55, scrollTrigger: { trigger: '.fce__card', start: 'top 85%', once: true } });
    }

    /* --- launch-notice form : same validation / completion flow as the brochure modal on the main page; nothing is sent --- */
    const form = $('#notifyForm'), body = $('#nfBody'), done = $('#nfDone');
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const rules = {
      name: (v) => (v.trim() ? '' : '이름을 입력해 주세요.'),
      org: (v) => (v.trim() ? '' : '소속 기관을 입력해 주세요.'),
      email: (v) => (!v.trim() ? '이메일을 입력해 주세요.' : EMAIL.test(v.trim()) ? '' : '이메일 형식을 확인해 주세요.'),
    };
    const setErr = (field, msg) => {
      const wrap = field.closest('.nf__f');
      wrap && wrap.classList.toggle('is-err', !!msg);
      $(`#er-${field.name}`).textContent = msg;
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    };
    Object.keys(rules).forEach((k) => {
      const f = form.elements[k];
      f.addEventListener('input', () => { if (f.getAttribute('aria-invalid') === 'true') setErr(f, rules[k](f.value)); });
      f.addEventListener('blur', () => { if (f.value) setErr(f, rules[k](f.value)); });
    });
    const agree = form.elements.agree;
    agree.addEventListener('change', () => { $('#er-agree').textContent = agree.checked ? '' : '개인정보 수집·이용에 동의해 주세요.'; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let first = null;
      Object.keys(rules).forEach((k) => {
        const f = form.elements[k], msg = rules[k](f.value);
        setErr(f, msg);
        if (msg && !first) first = f;
      });
      if (!agree.checked) { $('#er-agree').textContent = '개인정보 수집·이용에 동의해 주세요.'; if (!first) first = agree; } else $('#er-agree').textContent = '';
      if (first) { first.focus(); return; }
      // design mock-up: nothing is sent
      body.hidden = true;
      done.hidden = false;
      if (!reduce) {
        gsap.fromTo('.nf__dc', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' });
        gsap.fromTo('.nf__dv', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', delay: 0.55 });
        gsap.fromTo([$('.nf__done p'), $('.nf__done small'), $('.nf__again')], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.08, delay: 0.7 });
      }
      done.setAttribute('tabindex', '-1');
      done.focus({ preventScroll: true });
      ScrollTrigger.refresh();
      scrollToY(Math.max(0, form.getBoundingClientRect().top + window.scrollY - 180));
    });
    $('#nfAgain').addEventListener('click', () => {
      form.reset();
      $$('.nf__e', form).forEach((n) => { n.textContent = ''; });
      $$('.nf__f', form).forEach((n) => n.classList.remove('is-err'));
      done.hidden = true;
      body.hidden = false;
      form.elements.name.focus();
      ScrollTrigger.refresh();
    });
  }
}
