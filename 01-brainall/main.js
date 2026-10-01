/* MEDIIMG demo 01 — brainall concept
 * GSAP + ScrollTrigger + Lenis. WebGL 없음: 입체감은 미리 렌더링한 영상에서 나온다.
 */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const html = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const t0 = performance.now();

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ---------- 지연 로딩 영상: 가까워지면 포스터를, 화면에 들어오면 영상을 불러와 재생. 나가면 정지 ---------- */
  function lazyVideo(video, canPlay = () => true) {
    const state = { inView: false };
    const sync = () => {
      if (state.inView && canPlay()) {
        if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        video.pause();
      }
    };
    if (!('IntersectionObserver' in window)) { state.inView = true; if (video.dataset.poster) video.poster = video.dataset.poster; sync(); return sync; }
    new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; sync(); }, { rootMargin: '10% 0px' }).observe(video);
    if (video.dataset.poster) {
      const pio = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        pio.disconnect();
        video.poster = video.dataset.poster;
      }, { rootMargin: '150% 0px' });
      pio.observe(video);
    }
    return sync;
  }

  /* ---------- 캐러셀 안의 이미지는 가로로 화면 밖에 있어 lazy 로딩이 늦다
                → 섹션이 가까워지면 한 장씩 차례로 미리 받는다 ---------- */
  function loadInTurn(section, imgSel) {
    const sec = $(section);
    if (!sec || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const imgs = $$(imgSel, sec);
      let i = 0;
      const next = () => {
        if (i >= imgs.length) return;
        const im = imgs[i++];
        if (im.complete && im.naturalWidth) { next(); return; }
        im.addEventListener('load', next, { once: true });
        im.addEventListener('error', next, { once: true });
        im.loading = 'eager';
      };
      next();
    }, { rootMargin: '120% 0px' });
    io.observe(sec);
  }

  /* ---------- 받지 못한 이미지·영상은 간격을 늘려 가며 최대 3번 다시 시도한다 ---------- */
  function retryMedia() {
    const waits = [700, 1500, 3000];
    $$('img').forEach((im) => {
      const src = im.getAttribute('src');
      let tries = 0;
      im.addEventListener('error', () => {
        if (!src || tries >= waits.length) return;
        const n = ++tries;
        setTimeout(() => { im.src = src + (src.includes('?') ? '&' : '?') + 'retry=' + n; }, waits[n - 1]);
      });
    });
    $$('video').forEach((v) => {
      let tries = 0;
      v.addEventListener('error', () => {
        if (!v.getAttribute('src') || tries >= waits.length) return;
        const wasPlaying = v.autoplay || !v.paused;
        setTimeout(() => {
          v.load();
          if (wasPlaying) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        }, waits[tries++]);
      });
    });
  }

  /* ==========================================================================
     Header: 스크롤 방향에 따라 숨김/표시
     ========================================================================== */
  function initHeader() {
    const hd = $('#hd');
    const hero = $('#hero');
    const qm = $('.qm');
    const burger = $('.hd__burger');
    let lastY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const heroEnd = hero ? hero.offsetHeight - window.innerHeight : 0;
      hd.classList.toggle('is-solid', y > heroEnd - 80);
      if (!document.body.classList.contains('nav-open')) {
        if (y > lastY + 4 && y > 160) hd.classList.add('is-hidden');
        else if (y < lastY - 4 || y <= 160) hd.classList.remove('is-hidden');
      }
      // 모바일 TOP 버튼은 히어로 고정 구간이 끝난 뒤에 나타난다 (SCROLL 표시와 겹치지 않게)
      if (qm) qm.classList.toggle('is-show', y > heroEnd - window.innerHeight * 0.4);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const setNav = (open) => {
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      $('#mnav').setAttribute('aria-hidden', String(!open));
      if (open) hd.classList.remove('is-hidden');
      if (lenis) open ? lenis.stop() : lenis.start();
    };
    burger.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
    $$('#mnav button').forEach((b) => b.addEventListener('click', () => setNav(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 1120) setNav(false); });

    $$('.hd__lang button').forEach((b) => b.addEventListener('click', () => {
      $$('.hd__lang button').forEach((x) => x.classList.toggle('is-on', x === b));
    }));

    const ft = $('#contact');
    if (qm && ft && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => qm.classList.toggle('is-min', e.isIntersecting), { rootMargin: '0px 0px -30% 0px' }).observe(ft);
    }

    $('#toTop').addEventListener('click', () => {
      if (lenis) lenis.scrollTo(0, { duration: 1.6 });
      else window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ==========================================================================
     등장 연출 + 숫자 카운트업
     ========================================================================== */
  function initReveal() {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
    els.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length || !hasGsap || reduce) return; // HTML에 최종 값이 들어 있다
    const fmt = (v) => Math.round(v).toLocaleString('en-US');
    els.forEach((el) => { el.textContent = '0'; });
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target;
        const end = Number(el.dataset.count);
        const o = { v: 0 };
        gsap.to(o, { v: end, duration: end > 1000 ? 2 : 1.6, ease: 'power3.out', onUpdate: () => { el.textContent = fmt(o.v); } });
      });
    }, { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  }

  /* ==========================================================================
     1. Hero — 단어 분리 → 워드마크 → 문장 점등 → 배경 밝아짐
     ========================================================================== */
  function initHero() {
    const hero = $('#hero');
    if (!hero || !hasGsap) return;

    // 인트로 시작 상태 (프리로더 뒤에서 세팅)
    gsap.set('.hero__media', { autoAlpha: 0, scale: 0.84 });
    gsap.set('.hero__big > span', { yPercent: 112 });
    gsap.set(['.hero__cap', '.hero__lead-in', '.hero__scroll'], { autoAlpha: 0 });

    // 스크롤 구간 시작 상태
    gsap.set('.hero__mark', { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.86, y: 36 });
    gsap.set('.hero__copy', { xPercent: -50, yPercent: -50, autoAlpha: 0, y: 60 });

    const words = $$('.hero__copy .w');
    const video = $('.hero__video');
    let videoOff = false;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: hero, start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 0.7, invalidateOnRefresh: true,
        // 영상이 완전히 사라진 구간에서는 재생을 멈춘다
        onUpdate: (self) => {
          const off = self.progress > 0.62;
          if (off === videoOff || !video) return;
          videoOff = off;
          if (off) video.pause();
          else { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
        },
      },
    });

    tl
      // ① 두 단어가 좌우로 벌어지며 사라진다
      .to('.hero__word--a', { x: () => -window.innerWidth * 0.46, duration: 0.2, ease: 'power1.in' }, 0)
      .to('.hero__word--b', { x: () => window.innerWidth * 0.46, duration: 0.2, ease: 'power1.in' }, 0)
      .to('.hero__word', { autoAlpha: 0, duration: 0.09 }, 0.11)
      .to('.hero__lead', { autoAlpha: 0, y: -24, duration: 0.08 }, 0)
      // ② 영상이 작아지며 어두워진다
      .to('.hero__video', { scale: 0.6, opacity: 0.2, duration: 0.2, ease: 'power1.inOut' }, 0.05)
      // ③ 워드마크 등장
      .to('.hero__mark', { autoAlpha: 1, scale: 1, y: 0, duration: 0.1, ease: 'power2.out' }, 0.2)
      .to('.hero__video', { scale: 0.52, opacity: 0.08, duration: 0.2 }, 0.3)
      .to('.hero__mark', { autoAlpha: 0, scale: 1.05, y: -36, duration: 0.07, ease: 'power1.in' }, 0.5)
      .to('.hero__video', { opacity: 0, duration: 0.06 }, 0.5)
      // ④ 소개 문장이 단어 단위로 켜진다
      .to('.hero__copy', { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out' }, 0.56)
      .to(words, { opacity: 1, duration: 0.035, stagger: 0.26 / words.length }, 0.61)
      // ⑤ 배경이 남보라로 밝아지며 다음 섹션으로
      .to('.hero__bg', { opacity: 1, duration: 0.13 }, 0.87)
      .to('.hero__copy', { y: -24, duration: 0.13 }, 0.87)
      .to({}, { duration: 0.001 }, 0.999);
  }

  function heroIntro() {
    const v = $('.hero__video');
    if (v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    if (!hasGsap) return;
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .to('.hero__media', { autoAlpha: 1, scale: 1, duration: 2, ease: 'power3.out' }, 0)
      .to('.hero__big > span', { yPercent: 0, duration: 1.3, stagger: 0.16 }, 0.15)
      .to('.hero__cap', { autoAlpha: 1, duration: 0.9, stagger: 0.16 }, 0.75)
      .to('.hero__lead-in', { autoAlpha: 1, duration: 1 }, 1)
      .to('.hero__scroll', { autoAlpha: 1, duration: 1 }, 1.2);
  }

  /* ==========================================================================
     2. Highlight slides — 자동 전환 + 진행 막대
     ========================================================================== */
  function initHighlight() {
    const root = $('#hl');
    if (!root) return;
    const slides = $$('.hl__slide', root);
    const bars = $$('.hl__bar', root);
    const now = $('#hlNow');
    const n = slides.length;
    let idx = 0;

    const video = $('video', slides[0]);
    const syncVideo = video ? lazyVideo(video, () => idx === 0) : () => {};

    function go(i) {
      idx = ((i % n) + n) % n;
      slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === idx);
        s.setAttribute('aria-hidden', String(k !== idx));
      });
      bars.forEach((b, k) => {
        b.classList.remove('is-active');
        b.classList.toggle('is-done', k < idx);
        b.setAttribute('aria-selected', String(k === idx));
      });
      void bars[idx].offsetWidth; // 진행 막대 애니메이션 재시작
      bars[idx].classList.add('is-active');
      if (now) now.textContent = String(idx + 1).padStart(2, '0');
      syncVideo();
    }

    bars.forEach((b, k) => {
      b.addEventListener('click', () => go(k));
      // 막대가 다 차면 다음 슬라이드로 (진행 표시와 전환이 항상 일치)
      $('.hl__bar-line i', b).addEventListener('animationend', () => go(idx + 1));
    });
    $$('[data-hl]', root).forEach((b) => b.addEventListener('click', () => go(idx + (b.dataset.hl === 'next' ? 1 : -1))));

    // 화면 밖이거나 탭이 가려지면 일시정지
    let inView = false;
    const setPaused = () => root.classList.toggle('is-paused', !inView || document.hidden);
    root.classList.add('is-paused');
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; setPaused(); }, { threshold: 0.35 }).observe(root);
    document.addEventListener('visibilitychange', setPaused);

    slides.forEach((s, k) => s.setAttribute('aria-hidden', String(k !== 0)));
  }

  /* ==========================================================================
     4. 전후 비교 슬라이더 (마우스·터치·키보드)
     ========================================================================== */
  function initCompare() {
    const view = $('#cmpView');
    const handle = $('#cmpHandle');
    if (!view || !handle) return;
    const state = { p: 50 };
    let dragging = false;
    let touched = false;
    let hint = null;

    const set = (p) => {
      state.p = clamp(p, 0, 100);
      view.style.setProperty('--pos', state.p + '%');
      handle.setAttribute('aria-valuenow', String(Math.round(state.p)));
    };
    const fromEvent = (e) => {
      const r = view.getBoundingClientRect();
      set(((e.clientX - r.left) / r.width) * 100);
    };
    const stopHint = () => { touched = true; if (hint) { hint.kill(); hint = null; } };

    view.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stopHint();
      dragging = true;
      view.classList.add('is-drag');
      try { view.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      fromEvent(e);
    });
    view.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    const end = () => { dragging = false; view.classList.remove('is-drag'); };
    view.addEventListener('pointerup', end);
    view.addEventListener('pointercancel', end);
    view.addEventListener('lostpointercapture', end);

    handle.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft') { stopHint(); set(state.p - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { stopHint(); set(state.p + step); e.preventDefault(); }
      else if (e.key === 'Home') { stopHint(); set(0); e.preventDefault(); }
      else if (e.key === 'End') { stopHint(); set(100); e.preventDefault(); }
    });

    // 처음 화면에 들어올 때 한 번 쓸어 보여 준다
    if (hasGsap && !reduce) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        if (touched) return;
        set(86);
        hint = gsap.to(state, { p: 50, duration: 1.7, delay: 0.35, ease: 'power3.inOut', onUpdate: () => set(state.p) });
      }, { threshold: 0.45 });
      io.observe(view);
    }
  }

  /* ==========================================================================
     5. One Stop Process — 탭 + 가운데가 강조되는 카드 캐러셀
     ========================================================================== */
  function initProcess() {
    const stage = $('#procStage');
    if (!stage) return;
    const track = $('.proc__track', stage);
    const cards = $$('.proc__card', stage);
    const tabs = $$('.proc__tab');
    const infos = $$('.proc__info');
    const ink = $('.proc__ink');
    const n = cards.length;
    let idx = 0;
    let tidy = 0;

    const wrap = (v) => ((v % n) + n) % n;
    // 카드의 자리: -1(왼쪽) 0(가운데) 1(오른쪽) 2(숨김)
    const slot = (v) => { const o = wrap(v); return o > n / 2 ? o - n : o; };
    const cur = cards.map((_, i) => slot(i));

    const paint = (c, o) => {
      c.style.setProperty('--o', o);
      c.classList.toggle('is-active', o === 0);
      c.classList.toggle('is-far', Math.abs(o) > 1);
      c.setAttribute('aria-hidden', String(o !== 0));
    };
    const snap = (c, o) => {
      c.classList.add('no-anim');
      c.style.setProperty('--o', o);
      void c.offsetWidth;
      c.classList.remove('no-anim');
    };
    // 화면 밖으로 밀려난 카드를 조용히 제자리(반대편)로 돌려놓는다
    const settle = () => {
      clearTimeout(tidy);
      cards.forEach((c, i) => {
        const o = slot(i - idx);
        if (cur[i] !== o) { snap(c, o); cur[i] = o; }
        paint(c, o);
      });
    };
    const ui = () => {
      tabs.forEach((t, k) => {
        t.classList.toggle('is-active', k === idx);
        t.setAttribute('aria-selected', String(k === idx));
        t.tabIndex = k === idx ? 0 : -1;
      });
      infos.forEach((el, k) => el.classList.toggle('is-active', k === idx));
      if (ink) ink.style.setProperty('--i', idx);
    };

    function go(target) {
      target = wrap(target);
      if (target === idx) return;
      settle();
      const d = slot(target - idx); // -1, 1, 2
      idx = target;
      // 숨어 있던 카드는 들어올 방향 쪽에 미리 세워 둔다
      cards.forEach((c, i) => {
        if (Math.abs(cur[i]) > 1) {
          const s = slot(i - idx) + d;
          if (s !== cur[i]) { snap(c, s); cur[i] = s; }
        }
      });
      cards.forEach((c, i) => { cur[i] -= d; paint(c, cur[i]); });
      tidy = setTimeout(settle, 720);
      ui();
    }

    settle();
    ui();

    tabs.forEach((t, k) => {
      t.addEventListener('click', () => go(k));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        go(idx + (e.key === 'ArrowRight' ? 1 : -1));
        tabs[idx].focus();
      });
    });
    $('.proc__arw--prev', stage).addEventListener('click', () => go(idx - 1));
    $('.proc__arw--next', stage).addEventListener('click', () => go(idx + 1));

    // 드래그 / 스와이프
    let drag = false;
    let pid = null;
    let sx = 0;
    let dx = 0;
    stage.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.proc__arw')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = true; pid = e.pointerId; sx = e.clientX; dx = 0;
      stage.classList.add('is-drag');
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== pid) return;
      dx = e.clientX - sx;
      track.style.setProperty('--drag', dx * 0.55 + 'px');
    });
    const end = (e) => {
      if (!drag || (e && e.pointerId !== pid)) return;
      drag = false;
      stage.classList.remove('is-drag');
      track.style.setProperty('--drag', '0px');
      if (Math.abs(dx) > 48) { go(idx + (dx < 0 ? 1 : -1)); return; }
      // 드래그가 아니라 옆 카드를 누른 경우 그 카드로 이동
      if (e && e.type === 'pointerup' && Math.abs(dx) < 6) {
        const card = e.target.closest && e.target.closest('.proc__card');
        if (card && !card.classList.contains('is-active')) go(cards.indexOf(card));
      }
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  /* ==========================================================================
     6. Feature lineup — 가로 슬라이더 + 마우스를 따라다니는 원형 버튼
     ========================================================================== */
  function initFeatures() {
    const view = $('#featView');
    if (!view) return;
    const prog = $('#featProg');
    const bar = prog ? prog.parentElement : null;
    const pos = { v: 0 };
    const max = () => Math.max(0, view.scrollWidth - view.clientWidth);
    const stepSize = () => {
      const c = $('.fc', view);
      if (!c) return 360;
      return c.getBoundingClientRect().width + (parseFloat(getComputedStyle(c.parentElement).columnGap) || 16);
    };

    const paintProg = () => {
      if (!bar) return;
      const bw = bar.clientWidth;
      const m = max();
      const w = clamp(view.clientWidth / view.scrollWidth, 0.12, 1) * bw;
      prog.style.setProperty('--w', w + 'px');
      prog.style.setProperty('--x', (m > 0 ? view.scrollLeft / m : 0) * (bw - w) + 'px');
    };
    view.addEventListener('scroll', paintProg, { passive: true });
    window.addEventListener('resize', paintProg);
    window.addEventListener('load', paintProg);
    paintProg();

    const glide = (to, duration = 0.9) => {
      to = clamp(to, 0, max());
      if (!hasGsap || reduce) { view.scrollLeft = to; return; }
      pos.v = view.scrollLeft;
      gsap.to(pos, { v: to, duration, ease: 'power3.out', overwrite: true, onUpdate: () => { view.scrollLeft = pos.v; } });
    };
    $$('[data-feat]').forEach((b) => b.addEventListener('click', () => {
      glide(view.scrollLeft + (b.dataset.feat === 'next' ? 1 : -1) * stepSize());
    }));

    // 마우스 드래그로 가로 스크롤 (터치는 네이티브 스크롤)
    let down = false;
    let sx = 0;
    let sl = 0;
    let lastX = 0;
    let vx = 0;
    view.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; sx = lastX = e.clientX; sl = view.scrollLeft; vx = 0;
      if (hasGsap) gsap.killTweensOf(pos);
      view.classList.add('is-drag');
      try { view.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    });
    view.addEventListener('pointermove', (e) => {
      if (!down) return;
      vx = e.clientX - lastX;
      lastX = e.clientX;
      view.scrollLeft = sl - (e.clientX - sx);
    });
    const up = () => {
      if (!down) return;
      down = false;
      view.classList.remove('is-drag');
      if (Math.abs(vx) > 2) glide(view.scrollLeft - vx * 16, 1);
    };
    view.addEventListener('pointerup', up);
    view.addEventListener('pointercancel', up);
    view.addEventListener('lostpointercapture', up);

    // 따라다니는 원형 버튼
    const cur = $('#fcur');
    if (cur && finePointer && hasGsap) {
      html.classList.add('has-fcur');
      gsap.set(cur, { scale: 0, autoAlpha: 0 });
      const qx = gsap.quickTo(cur, 'x', { duration: 0.45, ease: 'power3.out' });
      const qy = gsap.quickTo(cur, 'y', { duration: 0.45, ease: 'power3.out' });
      let shown = false;
      const show = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (!shown) {
          shown = true;
          gsap.set(cur, { x: e.clientX, y: e.clientY });
          gsap.to(cur, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.7)', overwrite: 'auto' });
        }
        qx(e.clientX);
        qy(e.clientY);
      };
      const hide = () => {
        if (!shown) return;
        shown = false;
        gsap.to(cur, { scale: 0, autoAlpha: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
      };
      view.addEventListener('pointerenter', show);
      view.addEventListener('pointermove', show);
      view.addEventListener('pointerleave', hide);
      view.addEventListener('pointerdown', () => { if (shown) gsap.to(cur, { scale: 0.82, duration: 0.25, overwrite: 'auto' }); });
      view.addEventListener('pointerup', () => { if (shown) gsap.to(cur, { scale: 1, duration: 0.4, ease: 'back.out(2)', overwrite: 'auto' }); });
    }
  }

  /* ==========================================================================
     8. Partners — 영상 재생, 큰 숫자·윤곽선 글자의 스크롤 연동
     ========================================================================== */
  function initPartners() {
    const v = $('.pt__media video');
    if (v) lazyVideo(v);
    if (!hasGsap || reduce) return;
    gsap.fromTo('.pt__year span', { xPercent: 9 }, {
      xPercent: -9, ease: 'none',
      scrollTrigger: { trigger: '.pt', start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
    gsap.fromTo('.pt__outline span', { xPercent: 3 }, {
      xPercent: -24, ease: 'none',
      scrollTrigger: { trigger: '.pt__outline', start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
  }

  /* ---------- 탭이 가려지면 재생 중인 영상을 멈추고, 돌아오면 이어서 재생 ---------- */
  function initVisibility() {
    let resume = [];
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        resume = $$('video').filter((v) => !v.paused);
        resume.forEach((v) => v.pause());
      } else {
        resume.forEach((v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); });
        resume = [];
      }
    });
  }

  /* ==========================================================================
     Boot
     ========================================================================== */
  initHero();
  initHeader();
  initReveal();
  initCounters();
  initHighlight();
  initCompare();
  initProcess();
  initFeatures();
  initPartners();
  retryMedia();
  initVisibility();
  loadInTurn('#hl', '.hl__bg img');
  loadInTurn('#proc', '.proc__card img');
  loadInTurn('#feat', '.fc__bg');
  loadInTurn('#pt', '.pt__logos img');

  // 프리로더: 최소 1.1초, 늦어도 2.4초 안에 풀린다
  let ready = false;
  const setReady = () => {
    if (ready) return;
    ready = true;
    html.classList.add('is-ready');
    heroIntro();
  };
  window.addEventListener('load', () => {
    setTimeout(setReady, Math.max(0, 1100 - (performance.now() - t0)));
    if (hasGsap) ScrollTrigger.refresh();
  });
  setTimeout(setReady, 2400);
  if (document.fonts && document.fonts.ready && hasGsap) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
