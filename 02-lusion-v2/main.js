/* MEDIIMG demo 02 — real-time three.js is the protagonist.
   Scenes: (1) hero physics cluster, (2) pinned vessel that grows and gets colored, (3) fly-through tunnel.
   Each scene owns one WebGL context and only renders while its stage is on screen. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createVesselTree, createTunnel, createBloodCellGeometry, JET_GLSL } from '../shared/vessel.js';

const { gsap, ScrollTrigger, Lenis } = window;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const isSmall = () => innerWidth < 760;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

gsap.registerPlugin(ScrollTrigger);

/* ───────── smooth scroll (native scroll kept) ───────── */
let lenis = null;
if (Lenis && !RM) {
  lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  if (!window.__preLift) lenis.stop();
}
const onLift = (fn) => { if (window.__preLift) fn(); else window.addEventListener('pre:lift', fn, { once: true }); };
onLift(() => { if (lenis) lenis.start(); });

/* ───────── shared pointer + render loop ───────── */
const mouse = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

const scenes = [];
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { const s = scenes.find((x) => x.el === en.target); if (s) s.visible = en.isIntersecting; });
}, { rootMargin: '8% 0px 8% 0px' });
function register(el, frame) { scenes.push({ el, frame, visible: false }); io.observe(el); }
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const raw = (now - last) / 1000, dt = Math.min(0.25, raw); last = now;
  if (document.hidden) return;                       // tab hidden → no rendering
  const t = now / 1000;
  for (const s of scenes) if (s.visible) s.frame(t, dt, Math.min(1, raw));   // off-screen scenes are skipped
}
requestAnimationFrame(loop);

/* ───────── text helpers ───────── */
function buildRoll(el) {
  const text = el.textContent.trim();
  el.textContent = '';
  el.setAttribute('aria-label', text);
  let i = 0;
  text.split(' ').forEach((word, wi, arr) => {
    const w = document.createElement('span'); w.className = 'rw'; w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const c = document.createElement('span'); c.className = 'rc';
      const s = document.createElement('span'); s.textContent = ch; s.dataset.c = ch; s.style.setProperty('--i', i++);
      c.appendChild(s); w.appendChild(c);
    }
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
}
function splitWords(el) {
  const out = [];
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.textContent = tok;
          w.appendChild(inner); frag.appendChild(w); out.push(inner);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return out;
}

/* ───────── UI: header, menu, reveals ───────── */
function initUI() {
  $$('[data-roll]').forEach(buildRoll);

  // a busy static server can refuse a connection now and then: retry a failed image instead of leaving a broken icon
  $$('img').forEach((img) => img.addEventListener('error', () => {
    const n = +(img.dataset.retry || 0);
    if (n >= 3) return;
    img.dataset.retry = n + 1;
    setTimeout(() => { img.src = img.getAttribute('src'); }, 700 * (n + 1));
  }));

  const btn = $('#menuBtn'), panel = $('#menuPanel'), label = $('.pill__label', btn);
  const setMenu = (open) => {
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', String(!open));
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? label.dataset.open : label.dataset.closed;
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(!panel.classList.contains('is-open')); });
  document.addEventListener('click', (e) => { if (!panel.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  let openY = 0;
  btn.addEventListener('click', () => { openY = scrollY; });
  window.addEventListener('scroll', () => { if (panel.classList.contains('is-open') && Math.abs(scrollY - openY) > 120) setMenu(false); }, { passive: true });
  $$('.menu__lang button').forEach((b) => b.addEventListener('click', () => $$('.menu__lang button').forEach((x) => x.classList.toggle('is-on', x === b))));

  $('#toTop').addEventListener('click', () => { if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); });

  // hero intro (runs as the preloader lifts)
  const words = splitWords($('#heroH1'));
  const introEls = ['.hero__meta div', '.hero__foot', '.hd__logo', '.hd__right'];
  if (!RM) {
    gsap.set(words, { yPercent: 115 });
    gsap.set('#heroView', { y: 90, scale: 0.94, opacity: 0, transformOrigin: '50% 100%' });
    gsap.set(introEls, { opacity: 0, y: 16 });
    onLift(() => {
      gsap.to(words, { yPercent: 0, duration: 1.15, ease: 'power4.out', stagger: 0.035, delay: 0.3 });
      gsap.to('#heroView', { y: 0, scale: 1, opacity: 1, duration: 1.5, ease: 'power4.out', delay: 0.2, clearProps: 'transform' });
      gsap.to(introEls, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.06, delay: 0.7, clearProps: 'transform' });
    });
  }

  if (RM) return;
  $$('.lines').forEach((el) => {
    gsap.from($$('.ln > span', el), { yPercent: 112, duration: 1.25, ease: 'power4.out', stagger: 0.1, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  $$('.rv').forEach((el) => {
    gsap.from(el, { y: 54, opacity: 0, duration: 1.15, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
  $$('.cap__zoom img').forEach((img) => {
    gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: img.closest('.cap'), start: 'top bottom', end: 'bottom top', scrub: true } });
  });
}

/* ───────── Reel: thumbnail grows into a full-width rounded video ───────── */
function initReel() {
  const sec = $('#reel'), stage = $('.reel__stage'), media = $('#reelMedia'), slot = $('#reelSlot');
  const title = $('#reelTitle'), copy = $('#reelCopy'), facts = $('#reelFacts'), label = $('.reel__label'), ui = $('#reelUi'), video = $('#reelVideo');
  let a = { x: 0, y: 0, w: 10, h: 10 }, b = { x: 0, y: 0, w: 10, h: 10 }, prog = 0;
  const measure = () => {
    const sr = stage.getBoundingClientRect(), r = slot.getBoundingClientRect();
    a = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
    const pad = isSmall() ? 10 : 24, top = isSmall() ? 66 : 82;
    b = { x: pad, y: top, w: sr.width - pad * 2, h: sr.height - top - pad };
  };
  const apply = (p) => {
    prog = p;
    const k = clamp01(p / 0.68), e = k * k * (3 - 2 * k);
    media.style.transform = `translate3d(${lerp(a.x, b.x, e)}px, ${lerp(a.y, b.y, e)}px, 0)`;
    media.style.width = lerp(a.w, b.w, e) + 'px';
    media.style.height = lerp(a.h, b.h, e) + 'px';
    media.style.borderRadius = lerp(isSmall() ? 12 : 16, isSmall() ? 22 : 32, e) + 'px';
    const out = clamp01(p / 0.4);
    title.style.transform = `translate3d(0, ${-out * 14}vh, 0)`;
    title.style.opacity = 1 - clamp01((p - 0.12) / 0.3);
    label.style.opacity = copy.style.opacity = facts.style.opacity = 1 - clamp01(p / 0.22);
    const on = clamp01((p - 0.66) / 0.16);
    ui.style.opacity = on;
    ui.classList.toggle('is-on', on > 0.6);
    $('.reel__watch', ui).style.transform = `translate3d(0, ${(1 - on) * 60}px, 0)`;
    $('.reel__play', ui).style.scale = 0.4 + 0.6 * on;
  };
  ScrollTrigger.create({
    trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true,
    onRefresh: (self) => { measure(); apply(self.progress); media.classList.add('is-ready'); },
    onUpdate: (self) => apply(self.progress),
  });
  window.addEventListener('resize', () => { measure(); apply(prog); });
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting) { const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); } else video.pause();
  }, { rootMargin: '20% 0px' }).observe(stage);
}

/* ───────── Compare slider (real result pair) ───────── */
function initCompare() {
  const view = $('#cmpView');
  const setX = (pct, dur = 0.5) => gsap.to(view, { '--x': pct + '%', duration: RM ? 0 : dur, ease: 'power3.out', overwrite: true });
  const fromEvent = (e) => { const r = view.getBoundingClientRect(); setX(Math.min(96, Math.max(4, ((e.clientX - r.left) / r.width) * 100))); };
  view.addEventListener('pointermove', fromEvent);
  view.addEventListener('pointerdown', fromEvent);
  ScrollTrigger.create({ trigger: view, start: 'top 72%', once: true, onEnter: () => { gsap.fromTo(view, { '--x': '94%' }, { '--x': '46%', duration: RM ? 0 : 1.8, ease: 'power3.inOut' }); } });
}

/* ───────── Scene 1: hero physics cluster ───────── */
function initHero() {
  const wrap = $('#heroView'), canvas = $('#heroCanvas'), cursor = $('#heroCursor');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  pmrem.dispose();
  const FOV = 30, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 80);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(5, 8, 9);
  const rim = new THREE.DirectionalLight(0x4f7dff, 2.6); rim.position.set(-8, -3, -6);
  const warm = new THREE.DirectionalLight(0xff6a4a, 0.9); warm.position.set(6, -5, 2);
  scene.add(key, rim, warm);

  // materials — glossy "matcap-like" physical surfaces
  const cellMat = new THREE.MeshPhysicalMaterial({ color: 0xc4111d, roughness: 0.34, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 1.05 });
  const jetMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.9, side: THREE.DoubleSide });
  jetMat.onBeforeCompile = (sh) => {      // SIG-like jet gradient running along each vessel piece
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSig;\nvarying float vJet;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvJet = aSig + position.y * 0.62 + 0.09 * sin(position.x * 11.0 + position.y * 6.0) + 0.07 * sin(position.z * 13.0 - position.y * 9.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vJet;\n' + JET_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = pow(jet(vJet), vec3(2.2));');
  };
  const pearlMat = new THREE.MeshPhysicalMaterial({ color: 0xe9eeff, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });

  // a short, slightly bent, hollow piece of vessel (outer radius R, lumen radius r, length L)
  function vesselPiece(R, r, L, bendRadius, radial = 40) {
    const c = (R - r) / 2, m = (R + r) / 2, h = L / 2 - c, pts = [];
    for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector2(R, -h + (2 * h * i) / 12));                                   // outer wall, going up
    for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push(new THREE.Vector2(m + c * Math.cos(a), h + c * Math.sin(a))); }   // top rim
    for (let i = 1; i <= 12; i++) pts.push(new THREE.Vector2(r, h - (2 * h * i) / 12));                                    // lumen, going down
    for (let i = 1; i <= 8; i++) { const a = Math.PI + (i / 8) * Math.PI; pts.push(new THREE.Vector2(m + c * Math.cos(a), -h + c * Math.sin(a))); } // bottom rim
    const g = new THREE.LatheGeometry(pts, radial);
    const P = g.attributes.position, Nn = g.attributes.normal;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), th = y / bendRadius, cs = Math.cos(th), sn = Math.sin(th);
      P.setXY(i, bendRadius - (bendRadius - x) * cs, (bendRadius - x) * sn);
      const nx = Nn.getX(i), ny = Nn.getY(i);
      Nn.setXY(i, nx * cs + ny * sn, -nx * sn + ny * cs);
    }
    g.translate(-(bendRadius - Math.sqrt(Math.max(0, bendRadius * bendRadius - (L * L) / 16))), 0, 0);   // roughly re-centre the arc
    g.computeBoundingSphere();
    return g;
  }

  const small = isSmall();
  const defs = [
    { geo: createBloodCellGeometry(0.58, 44), mat: cellMat, count: small ? 20 : 30, rad: 0.5, jet: false },
    { geo: vesselPiece(0.31, 0.215, 0.98, 1.25), mat: jetMat, count: small ? 11 : 17, rad: 0.5, jet: true },
    { geo: vesselPiece(0.215, 0.14, 1.0, 0.95), mat: jetMat, count: small ? 9 : 14, rad: 0.43, jet: true },
    { geo: new THREE.SphereGeometry(0.2, 28, 20), mat: pearlMat, count: small ? 6 : 10, rad: 0.2, jet: false },
  ];
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const bodies = [], meshes = [];
  for (const d of defs) {
    const mesh = new THREE.InstancedMesh(d.geo, d.mat, d.count);
    meshes.push(mesh);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    if (d.jet) {
      const sig = new Float32Array(d.count);
      for (let i = 0; i < d.count; i++) sig[i] = 0.12 + rnd() * 0.76;
      d.geo.setAttribute('aSig', new THREE.InstancedBufferAttribute(sig, 1));
    }
    scene.add(mesh);
    for (let i = 0; i < d.count; i++) {
      const s = 0.82 + rnd() * 0.42, ang = rnd() * Math.PI * 2, R = 11 + rnd() * 9;
      bodies.push({
        mesh, i, s, r: d.rad * s,
        p: new THREE.Vector3(Math.cos(ang) * R * 1.5, Math.sin(ang) * R * 0.8, (rnd() - 0.5) * 5),
        v: new THREE.Vector3(),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28)),
        w: new THREE.Vector3(),
        spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.7),
      });
    }
  }

  // invisible pusher sphere that follows the cursor
  const pusher = { p: new THREE.Vector3(0, 0, 60), target: new THREE.Vector3(0, 0, 60), v: new THREE.Vector3(), r: 1.4, active: false, lastMove: -10 };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const point = (e) => {
    const r = wrap.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) pusher.target.copy(hit);
    if (!pusher.active) pusher.p.copy(pusher.target);
    pusher.active = true; pusher.lastMove = performance.now() / 1000;
    cursor.style.setProperty('--x', x + 'px'); cursor.style.setProperty('--y', y + 'px'); cursor.classList.add('is-on');
  };
  const leave = () => { pusher.active = false; cursor.classList.remove('is-on'); };
  wrap.addEventListener('pointermove', point);
  wrap.addEventListener('pointerdown', point);
  wrap.addEventListener('pointerleave', leave);
  wrap.addEventListener('pointercancel', leave);
  wrap.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') leave(); });

  const K = 5.2, DAMP = 2.3, H = 1 / 60;
  let tall = false, kx = 0.46, ky = 1;       // the cluster is wide on landscape viewports, tall on portrait ones
  const n = new THREE.Vector3(), tq = new THREE.Quaternion(), ax = new THREE.Vector3();
  function step(h, t) {
    const cx = Math.sin(t * 0.23) * 0.45, cy = Math.cos(t * 0.31) * 0.22;
    const damp = Math.exp(-DAMP * h), wl = 1 - Math.exp(-0.9 * h);
    // pusher: cursor if active, otherwise a slow ghost that keeps the cluster alive
    let on = pusher.active, pr = pusher.r;
    if (on) {
      hit.copy(pusher.p);
      pusher.p.lerp(pusher.target, 1 - Math.exp(-18 * h));
      pusher.v.subVectors(pusher.p, hit).divideScalar(h);
    } else if (!RM && t > 3.2) {
      on = true; pr = 0.95;
      hit.copy(pusher.p);
      const gx = Math.cos(t * 0.42) * 3.7, gy = Math.sin(t * 0.67) * 1.9;
      pusher.p.set(tall ? gy : gx, tall ? gx : gy, Math.sin(t * 0.3) * 0.6);
      pusher.v.set(0, 0, 0);
    }
    for (const b of bodies) {
      b.v.x -= (b.p.x - cx) * K * kx * h;
      b.v.y -= (b.p.y - cy) * K * ky * h;
      b.v.z -= b.p.z * K * 1.9 * h;
      if (on) {
        n.subVectors(b.p, pusher.p);
        const min = pr + b.r, d2 = n.lengthSq();
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1e-4;
          n.multiplyScalar(1 / d);
          b.v.addScaledVector(n, (min - d) * 150 * h);
          b.v.addScaledVector(pusher.v, 0.06);
          b.w.x += n.y * 2.2 * h * 60; b.w.y -= n.x * 2.2 * h * 60;
        }
      }
      b.v.multiplyScalar(damp);
      b.p.addScaledVector(b.v, h);
      b.w.lerp(b.spin, wl);
      const wm = b.w.length();
      if (wm > 1e-5) { tq.setFromAxisAngle(ax.copy(b.w).multiplyScalar(1 / wm), Math.min(wm, 9) * h); b.q.premultiply(tq); }
    }
    // pairwise separation (bounding spheres)
    const N = bodies.length;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < N; i++) {
        const A = bodies[i];
        for (let j = i + 1; j < N; j++) {
          const B = bodies[j];
          const dx = B.p.x - A.p.x, dy = B.p.y - A.p.y, dz = B.p.z - A.p.z;
          const min = A.r + B.r, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= min * min || d2 < 1e-9) continue;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, nz = dz / d, pen = (min - d) * 0.5;
          A.p.x -= nx * pen; A.p.y -= ny * pen; A.p.z -= nz * pen;
          B.p.x += nx * pen; B.p.y += ny * pen; B.p.z += nz * pen;
          const vn = (B.v.x - A.v.x) * nx + (B.v.y - A.v.y) * ny + (B.v.z - A.v.z) * nz;
          if (vn < 0) {
            const jj = -vn * 0.58;
            A.v.x -= nx * jj; A.v.y -= ny * jj; A.v.z -= nz * jj;
            B.v.x += nx * jj; B.v.y += ny * jj; B.v.z += nz * jj;
            const k = Math.min(3, -vn) * 0.5;
            A.w.x += ny * k; A.w.y -= nx * k; B.w.x -= ny * k; B.w.z += nx * k;
          }
        }
      }
    }
  }

  const dummy = new THREE.Object3D();
  function layout() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    tall = camera.aspect < 1;
    kx = tall ? 1 : 0.46; ky = tall ? 0.5 : 1;
    camera.position.set(0, 0, tall ? Math.max(4.3 / TAN, 2.9 / (TAN * camera.aspect)) : Math.max(3.05 / TAN, 4.5 / (TAN * camera.aspect)));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(layout).observe(wrap); layout();

  function draw() {
    for (const b of bodies) {
      dummy.position.copy(b.p); dummy.quaternion.copy(b.q); dummy.scale.setScalar(b.s); dummy.updateMatrix();
      b.mesh.setMatrixAt(b.i, dummy.matrix);
    }
    for (const m of meshes) m.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  }
  draw();                                   // warm-up behind the preloader: compiles shaders, uploads buffers
  let acc = 0, simT = 0, started = false;
  onLift(() => { started = true; });
  register(wrap, (t, dt) => {
    if (!started) return;
    acc += dt;
    let c = 0;
    while (acc >= H && c < 18) { step(H, simT); simT += H; acc -= H; c++; }
    if (c === 18) acc = 0;
    draw();
  });
}

/* ───────── Scene 2: pinned vessel — grows, gets colored, zooms to an ROI ───────── */
function initProcess() {
  const sec = $('#proc'), stage = $('#procStage'), canvas = $('#procCanvas');
  const steps = $$('#procSteps li'), rail = $$('#procRail li'), shots = $$('.proc__shotimgs img'), shot = $('#procShot');
  const digit = $('#procDigit'), roi = $('#procRoi'), legend = $('#procLegend');
  let p = 0, ps = 0, cur = 0;

  const setStep = (i) => {
    if (i === cur) return;
    const dir = i > cur ? 1 : -1; cur = i;
    steps.forEach((li, k) => { li.classList.toggle('is-on', k === i); li.classList.toggle('is-past', k < i); });
    shots.forEach((im, k) => im.classList.toggle('is-on', k === i));
    shot.classList.toggle('is-report', i === 4);
    digit.textContent = String(i + 1);
    if (!RM) gsap.fromTo(digit, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.65, ease: 'power3.out', overwrite: true });
  };
  const applyUI = (v) => {
    p = v;
    setStep(Math.min(4, Math.floor(v * 5)));
    rail.forEach((li, k) => { li.style.setProperty('--f', clamp01(v * 5 - k).toFixed(3)); li.classList.toggle('is-on', v * 5 >= k); });
  };
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: (s) => applyUI(s.progress), onRefresh: (s) => applyUI(s.progress) });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  const FOV = 35, TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  const pivot = new THREE.Group(); scene.add(pivot);

  const vessel = createVesselTree({ detail: isSmall() ? 0.8 : 1.15, twigs: 30 });
  const u = vessel.uniforms;
  u.uColor.value = 0; u.uReveal.value = 0; u.uGlow.value = 0.22; u.uGray.value.set(0xbcc3cf);
  pivot.add(vessel.group);

  // step 1 — "raw MRA signal": point cloud sampled on the vessel + background noise + slice frames
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const NP = isSmall() ? 5000 : 9000;
  const sp = vessel.samplePoints(NP).positions;
  for (let i = 0; i < sp.length; i++) sp[i] += (rnd() - 0.5) * 0.045;
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xc3cee6, size: 0.017, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(pg, pMat); pivot.add(points);
  const NN = 2200, np = new Float32Array(NN * 3);
  for (let i = 0; i < NN; i++) { np[i * 3] = (rnd() - 0.5) * 3.0; np[i * 3 + 1] = -1.55 + rnd() * 2.9; np[i * 3 + 2] = (rnd() - 0.5) * 2.0; }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
  const nMat = new THREE.PointsMaterial({ color: 0x6f7fa6, size: 0.012, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false });
  const noise = new THREE.Points(ng, nMat); pivot.add(noise);

  const HW = 1.55, HD = 1.05, rect = [[-HW, -HD], [HW, -HD], [HW, HD], [-HW, HD]];
  const sv = [];
  for (let k = 0; k < 9; k++) { const y = -1.5 + k * 0.35; for (let e = 0; e < 4; e++) { const a = rect[e], b = rect[(e + 1) % 4]; sv.push(a[0], y, a[1], b[0], y, b[1]); } }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  const sMat = new THREE.LineBasicMaterial({ color: 0x8fa6ff, transparent: true, opacity: 0.2 });
  const slices = new THREE.LineSegments(sg, sMat); pivot.add(slices);
  const scan = new THREE.Group();
  const scanFill = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HD * 2), new THREE.MeshBasicMaterial({ color: 0x9fc0ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  scanFill.rotation.x = -Math.PI / 2;
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(rect.flatMap(([x, z]) => [x, 0, z]), 3));
  const scanEdge = new THREE.LineLoop(eg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  scan.add(scanFill, scanEdge); pivot.add(scan);

  // step 4 — ROI ring on the left MCA
  const mca = vessel.curves.find((c) => c.name === 'mca');
  const roiLocal = mca.curve.getPointAt(0.5), roiTan = mca.curve.getTangentAt(0.5).normalize();
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.0055, 8, 72), ringMat);
  ring.position.copy(roiLocal); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), roiTan); ring.renderOrder = 5;
  const ring2 = ring.clone(); ring2.material = ringMat.clone(); ring2.renderOrder = 5;
  vessel.group.add(ring, ring2);

  let portrait = false, W = 1, Hh = 1, fit = 6.1;
  function layout() {
    W = stage.clientWidth; Hh = stage.clientHeight;
    if (!W || !Hh) return;
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh; camera.updateProjectionMatrix();
    portrait = camera.aspect < 0.95;
    fit = portrait ? 3.1 / (2 * TAN * camera.aspect) : Math.max(6.1, 3.3 / (TAN * camera.aspect));
  }
  new ResizeObserver(layout).observe(stage); layout();

  camera.position.set(0, 0, fit);
  renderer.compile(scene, camera);          // warm-up behind the preloader so entering the pinned stage does not hitch
  renderer.render(scene, camera);

  const roiW = new THREE.Vector3(), target = new THREE.Vector3(), tmp = new THREE.Vector3(), prj = new THREE.Vector3();
  let mx = 0, my = 0;
  register(stage, (t, dt, rdt) => {
    ps += (p - ps) * (1 - Math.exp(-rdt * 7));      // raw (unclamped) dt so a slow frame still catches up with the scroll
    const reveal = smooth(0.13, 0.4, ps), color = smooth(0.42, 0.6, ps);
    const zoom = smooth(0.6, 0.68, ps) * (1 - smooth(0.77, 0.83, ps));
    const rep = smooth(0.83, 0.95, ps);
    u.uReveal.value = reveal * 1.03; u.uColor.value = color; u.uGlow.value = 0.22 + 0.42 * color;
    vessel.update(t);
    legend.style.setProperty('--c', color.toFixed(3));

    const raw = 1 - smooth(0.2, 0.42, ps);
    pMat.opacity = 0.9 * raw; nMat.opacity = 0.5 * raw * (1 - reveal * 0.6); sMat.opacity = 0.2 * raw;
    points.visible = noise.visible = slices.visible = scan.visible = raw > 0.01;
    scanFill.material.opacity = 0.12 * raw; scanEdge.material.opacity = 0.9 * raw;
    scan.position.y = lerp(-1.5 + (0.5 + 0.5 * Math.sin(t * 0.9)) * 2.7, -1.6 + reveal * 3.0, smooth(0.1, 0.16, ps));

    mx += (mouse.x - mx) * Math.min(1, dt * 3); my += (mouse.y - my) * Math.min(1, dt * 3);
    const rotY = lerp(-0.75, 0.38, smooth(0, 0.62, ps)) + 0.95 * smooth(0.8, 1, ps) + Math.sin(t * 0.25) * 0.07;
    pivot.rotation.set(0.07 + my * 0.1, rotY + mx * 0.2, 0);
    pivot.position.set(portrait ? 0 : lerp(0.66, 0.3, rep), portrait ? 1.0 : 0.04, 0);
    pivot.updateMatrixWorld(true);
    roiW.copy(roiLocal).applyMatrix4(vessel.group.matrixWorld);
    tmp.set(roiW.x - (portrait ? 0 : 0.3), roiW.y - (portrait ? 0.45 : 0), roiW.z);
    target.set(0, 0, 0).lerp(tmp, zoom);
    const dist = lerp(fit, portrait ? fit * 0.5 : 3.0, zoom);
    camera.position.set(target.x, target.y, target.z + dist);
    camera.lookAt(target);

    ringMat.opacity = zoom; ring2.material.opacity = zoom * (1 - (t * 0.7) % 1) * 0.7; ring2.scale.setScalar(1 + ((t * 0.7) % 1) * 0.9);
    ring.visible = ring2.visible = zoom > 0.01;
    camera.updateMatrixWorld();
    prj.copy(roiW).project(camera);
    roi.style.setProperty('--x', ((prj.x * 0.5 + 0.5) * W).toFixed(1) + 'px');
    roi.style.setProperty('--y', ((-prj.y * 0.5 + 0.5) * Hh).toFixed(1) + 'px');
    roi.style.setProperty('--o', zoom.toFixed(3));
    renderer.render(scene, camera);
  });
}

/* ───────── Scene 3: tunnel fly-through ───────── */
function initTunnel() {
  const sec = $('#tun'), stage = $('#tunStage'), canvas = $('#tunCanvas');
  const lines = $$('#tunLines p'), stats = $$('#tunStats .stat'), pct = $('#tunPct');
  const nums = stats.map((s) => { const b = $('b', s); return { el: s, b, v: +b.dataset.v, suf: b.dataset.suf, last: -1 }; });
  const C = [0.07, 0.215, 0.36], HWD = 0.105, TH = [0.54, 0.66, 0.78];
  let p = 0, ps = 0;
  const applyUI = (v) => {
    p = v;
    lines.forEach((el, i) => {
      const l = (v - C[i]) / HWD, a = Math.max(0, 1 - Math.pow(Math.abs(l), 2.2));
      el.style.opacity = a.toFixed(3);
      el.style.transform = `translate3d(0, ${(-l * 5).toFixed(2)}vh, 0) scale(${(0.74 + (l + 1) * 0.25).toFixed(3)})`;
    });
    nums.forEach((n, i) => {
      const l = clamp01((v - TH[i]) / 0.09), e = 1 - Math.pow(1 - l, 3);
      n.el.style.opacity = l.toFixed(3);
      n.el.style.transform = `translate3d(0, ${((1 - e) * 60).toFixed(1)}px, 0)`;
      const val = Math.round(n.v * e);
      if (val !== n.last) { n.last = val; n.b.textContent = val.toLocaleString('en-US') + n.suf; }
    });
    pct.textContent = String(Math.round(v * 100)).padStart(3, '0');
    stage.style.setProperty('--dim', (0.3 * smooth(0.24, 0.36, v) + 0.28 * smooth(0.46, 0.56, v)).toFixed(3));   // darken the colored wall behind the type and the numbers
  };
  ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: (s) => applyUI(s.progress), onRefresh: (s) => applyUI(s.progress) });

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x020308, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 90);
  const tunnel = createTunnel({ length: 90, cells: isSmall() ? 200 : 330 });   // long enough that the open far end stays in the fog
  scene.add(tunnel.group);
  // The module lights the cells with a point light riding on the camera, which blows out cells that pass close by.
  // Swap it (on the returned objects only) for a distance-independent head light + fog matching the wall shader.
  tunnel.group.children.forEach((o) => { if (o.isPointLight) o.intensity = 0; else if (o.isAmbientLight) o.intensity = 0.6; });
  const head = new THREE.DirectionalLight(0xffe6de, 2.6);
  scene.add(head, head.target);
  scene.fog = new THREE.FogExp2(0x020308, 0.085);
  const fwd = new THREE.Vector3(), cm = new THREE.Matrix4();
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = camera.aspect < 0.95 ? 92 : 72; camera.updateProjectionMatrix();
  }
  new ResizeObserver(layout).observe(stage); layout();

  tunnel.update(0); tunnel.place(camera, 0.012);
  renderer.compile(scene, camera);          // warm-up, same reason as above
  renderer.render(scene, camera);

  let mx = 0, my = 0;
  register(stage, (t, dt, rdt) => {
    ps += (p - ps) * (1 - Math.exp(-rdt * 6));
    tunnel.uniforms.uColor.value = smooth(0.24, 0.44, ps);     // blood-red wall → SIG colormap as "숫자로." passes
    tunnel.update(t);
    tunnel.place(camera, 0.012 + ps * 0.6);
    camera.getWorldDirection(fwd);
    head.position.copy(camera.position).addScaledVector(camera.up, 0.8);
    head.target.position.copy(camera.position).addScaledVector(fwd, 2);
    // cells about to hit the lens shrink away instead of filling the screen
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, e = cm.elements;
    for (let i = 0; i < tunnel.cells.count; i++) {
      tunnel.cells.getMatrixAt(i, cm);
      const dx = e[12] - cx, dy = e[13] - cy, dz = e[14] - cz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 1.0) continue;
      const s = smooth(0.3, 1.0, Math.sqrt(d2));
      e[0] *= s; e[1] *= s; e[2] *= s; e[4] *= s; e[5] *= s; e[6] *= s; e[8] *= s; e[9] *= s; e[10] *= s;
      tunnel.cells.setMatrixAt(i, cm);
    }
    mx += (mouse.x - mx) * Math.min(1, dt * 3); my += (mouse.y - my) * Math.min(1, dt * 3);
    camera.rotateY(-mx * 0.07); camera.rotateX(-my * 0.05);
    camera.rotateZ(Math.sin(t * 0.17) * 0.07 + ps * 0.9);
    renderer.render(scene, camera);
  });
}

/* ───────── boot ───────── */
const safe = (name, fn) => { try { fn(); } catch (err) { console.warn('[demo02] ' + name + ' skipped:', err); } };
safe('ui', initUI);
safe('reel', initReel);
safe('compare', initCompare);
safe('hero', initHero);
// the two pinned scenes are built right after the first paint so the preloader counter keeps moving
setTimeout(() => { safe('process', initProcess); safe('tunnel', initTunnel); ScrollTrigger.refresh(); }, 60);

window.addEventListener('load', () => ScrollTrigger.refresh());
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
