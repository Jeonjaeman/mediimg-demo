/* MEDIIMG demo 04 — journey concept
 * hero: dotted vessel (three.js Points) + rim glow / journey: pinned scroll-scrubbed image sequences
 * route: vertical vessel line with a blood-cell marker / faq accordion
 */
import * as THREE from 'three';
import { createVesselTree, JET_GLSL } from '../shared/vessel.js';
import { FrameSequence } from '../shared/frameseq.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const jetCss = (t, k = 1) => {
  const c = (v) => Math.round(clamp(v) * 255 * k);
  t = clamp(t);
  return `rgb(${c(1.5 - Math.abs(4 * t - 3))},${c(1.5 - Math.abs(4 * t - 2))},${c(1.5 - Math.abs(4 * t - 1))})`;
};

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE_W = 860;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ───────── smooth scroll ───────── */
let lenis = null;
if (window.Lenis && !REDUCED) {
  lenis = new window.Lenis({ lerp: 0.12 });
  if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
}

const mouse = { x: 0, y: 0 };
addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

/* ═════════ hero: dotted vessel + rim glow ═════════ */
function initHero() {
  const hero = $('#hero'), pin = $('#heroPin'), canvas = $('#heroGl');
  const ui = $('#heroUi'), wash = $('#heroWash'), tagsEl = $('#heroTags');
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-webgl');
  }

  const state = { colorY: -2.1, ready: !renderer, tagA: 0 };
  let scene, camera, rig, spin, ptsU, orbU, shellU, anchors = [];
  const base = { x: 0, y: 0, s: 1 };

  if (renderer) {
    renderer.setClearColor(0x070708, 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(0, 0, 8.6);
    rig = new THREE.Group();
    spin = new THREE.Group();
    scene.add(rig);

    const small = innerWidth <= MOBILE_W;

    /* rim glow disc (does not rotate) */
    const EXT = 1.75, R = 2.28;
    orbU = { uTime: { value: 0 }, uSpread: { value: 0 }, uExt: { value: EXT } };
    const orb = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: orbU, depthTest: false, depthWrite: false, transparent: true,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          varying vec2 vUv;
          uniform float uTime, uSpread, uExt;
          void main(){
            vec2 p = (vUv - 0.5) * 2.0 * uExt;
            float d = length(p);
            vec2 n = p / max(d, 1e-4);
            float lit = dot(n, normalize(vec2(-0.62, 0.78)));
            float warmW = smoothstep(-0.25, 0.85, lit);
            float coolW = smoothstep(0.45, -0.75, lit);
            vec3 warm = mix(vec3(1.0, 0.13, 0.03), vec3(1.0, 0.58, 0.18), smoothstep(0.2, 1.0, lit));
            vec3 cool = vec3(0.07, 0.17, 1.0);
            float inside = 1.0 - smoothstep(0.996, 1.003, d);
            float inner = pow(smoothstep(0.55, 1.0, d), 3.2) * inside;
            float edge = exp(-abs(d - 1.0) * 150.0);
            float halo = exp(-max(d - 1.0, 0.0) * mix(11.0, 2.4, uSpread)) * (1.0 - inside);
            float breathe = 0.92 + 0.08 * sin(uTime * 0.7);
            vec3 col = vec3(0.0);
            col += cool * inner * (0.2 + 1.15 * coolW) * (1.0 + 1.6 * uSpread) * breathe;
            col += warm * inner * 0.5 * warmW;
            col += (warm * warmW * 1.5 + cool * coolW * 1.5 + vec3(0.12)) * edge;
            col += (warm * warmW * 0.42 + cool * coolW * (0.5 + 1.3 * uSpread)) * halo;
            float orbit = exp(-abs(d - 1.075) * 420.0) * smoothstep(0.05, 0.95, lit);
            col += vec3(1.0, 0.42, 0.1) * orbit * 0.8;
            col *= smoothstep(uExt, uExt * 0.8, d);
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    orb.scale.setScalar(R * 2 * EXT);
    orb.renderOrder = 0;
    rig.add(orb);
    rig.add(spin);

    /* dotted vessel: surface points sampled from the shared procedural tree */
    const vessel = createVesselTree({ detail: small ? 0.8 : 1.1, twigs: 30 });
    const sample = vessel.samplePoints(small ? 22000 : 46000);
    const seen = new Set(), pos = [], sig = [], rnd = [];
    for (let i = 0; i < sample.sig.length; i++) {
      const x = sample.positions[i * 3], y = sample.positions[i * 3 + 1], z = sample.positions[i * 3 + 2];
      const key = Math.round(x * 400) + ',' + Math.round(y * 400) + ',' + Math.round(z * 400);
      if (seen.has(key)) continue;
      seen.add(key);
      pos.push(x, y, z); sig.push(sample.sig[i]); rnd.push(Math.random());
    }
    const ptsGeo = new THREE.BufferGeometry();
    ptsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ptsGeo.setAttribute('aSig', new THREE.Float32BufferAttribute(sig, 1));
    ptsGeo.setAttribute('aRnd', new THREE.Float32BufferAttribute(rnd, 1));
    ptsU = { uTime: { value: 0 }, uScale: { value: 9 }, uColorY: { value: -2.1 }, uScanY: { value: -3 }, uBurst: { value: 0 }, uZc: { value: 8.6 } };
    const pts = new THREE.Points(ptsGeo, new THREE.ShaderMaterial({
      uniforms: ptsU, depthTest: false, depthWrite: false, transparent: true, blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute float aSig; attribute float aRnd;
        uniform float uTime, uScale, uColorY, uScanY, uBurst, uZc;
        varying vec3 vCol; varying float vA;
        ${JET_GLSL}
        void main(){
          vec3 p = position;
          vec3 dir = normalize(p + vec3(0.001, 0.25, 0.0));
          p += dir * uBurst * (0.35 + 2.4 * aRnd);
          p.y += uBurst * uBurst * 1.4 * aRnd;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float s = clamp((aSig - 0.5) * 1.3 + 0.5, 0.0, 1.0);
          float colored = smoothstep(uColorY + 0.1, uColorY - 0.1, position.y);
          float front = exp(-pow((position.y - uScanY) / 0.085, 2.0));
          vCol = mix(vec3(0.62, 0.66, 0.74), jet(s), colored) + front * vec3(0.5);
          float flow = 0.5 + 0.5 * sin(position.y * 5.0 + length(position.xz) * 4.0 - uTime * 1.7 + aRnd * 1.5);
          float tw = 0.78 + 0.22 * sin(uTime * 2.1 + aRnd * 40.0);
          float depth = clamp(0.5 + (uZc + mv.z) / 2.3, 0.0, 1.0);
          vA = (0.3 + 0.7 * depth) * (0.66 + 0.34 * flow) * tw * (1.0 - 0.8 * uBurst);
          vA = min(1.0, vA * (1.0 + 0.5 * smoothstep(0.42, 0.85, s)));
          float big = step(0.972, aRnd);
          float hot = smoothstep(0.42, 0.85, s);
          gl_PointSize = uScale * (1.4 + 1.3 * depth + big * 1.8) * (1.0 + front * 0.55) * (1.0 + 0.75 * hot) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vCol; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.2, d);
          gl_FragColor = vec4(vCol, a * vA);
        }`,
    }));
    pts.renderOrder = 2;
    spin.add(pts);
    const ptsLabel = $('#heroPts');
    if (ptsLabel) ptsLabel.textContent = `${(pos.length / 3).toLocaleString('en-US')} PTS · SIG MAP`;

    /* faint dotted brain volume around the vessels (silhouette only) */
    const shN = small ? 2200 : 4600, shPos = [], shNor = [];
    const rx = 1.5, ry = 1.2, rz = 1.72;
    for (let i = 0; i < shN; i++) {
      const y = 1 - (i / (shN - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996323;
      const nx = Math.cos(a) * r, nz = Math.sin(a) * r;
      if (y < -0.72) continue;
      const fis = 1 - 0.1 * Math.exp(-Math.pow(nx / 0.09, 2)) * clamp(y + 0.2);
      shPos.push(nx * rx * fis, y * ry * fis + 0.42, nz * rz * fis - 0.12);
      const n = new THREE.Vector3(nx / rx, y / ry, nz / rz).normalize();
      shNor.push(n.x, n.y, n.z);
    }
    const shGeo = new THREE.BufferGeometry();
    shGeo.setAttribute('position', new THREE.Float32BufferAttribute(shPos, 3));
    shGeo.setAttribute('normal', new THREE.Float32BufferAttribute(shNor, 3));
    shellU = { uScale: { value: 9 }, uAlpha: { value: 0 } };
    const shell = new THREE.Points(shGeo, new THREE.ShaderMaterial({
      uniforms: shellU, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      vertexShader: /* glsl */ `
        uniform float uScale; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float f = 1.0 - abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
          vA = pow(f, 2.4);
          gl_PointSize = uScale * 1.5 / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float; uniform float uAlpha; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.62, 0.72, 1.0) * smoothstep(0.5, 0.2, d) * vA * uAlpha, 1.0); }`,
    }));
    shell.renderOrder = 1;
    spin.add(shell);

    /* a few static stars */
    const stN = 260, stPos = [];
    for (let i = 0; i < stN; i++) stPos.push((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, -2 - Math.random() * 3);
    const stGeo = new THREE.BufferGeometry();
    stGeo.setAttribute('position', new THREE.Float32BufferAttribute(stPos, 3));
    scene.add(new THREE.Points(stGeo, new THREE.PointsMaterial({ color: 0x8a93b0, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.4, depthTest: false })));

    /* vessel labels projected to the screen (values as shown in the real NeuFlow UI screenshot) */
    const defs = small
      ? [['m2sup', 0.5, 'MCA', '6.23'], ['basilar', 0.5, 'BA', '9.07']]
      : [['m2supR', 0.55, 'MCA', '6.23'], ['icaR', 0.3, 'ICA', '7.11'], ['pcaR', 0.62, 'PCA', '8.08'], ['aca', 0.8, 'ACA', '6.87']];
    defs.forEach(([name, t, label, val]) => {
      const c = vessel.curves.find((k) => k.name === name);
      if (!c) return;
      const el = document.createElement('div');
      el.className = 'tag';
      el.innerHTML = `<i></i><span>${label}<b>${val}</b></span>`;
      el.style.opacity = '0';
      tagsEl.appendChild(el);
      anchors.push({ el, p: c.curve.getPointAt(t) });
    });
    vessel.dispose();
  }

  const washH = () => wash.offsetHeight;
  function layout() {
    if (!renderer) return;
    const w = pin.clientWidth, h = pin.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (w > MOBILE_W) {
      base.s = Math.min(1, halfW / 3.3);
      base.x = halfW * 0.56;
      base.y = 0.02;
    } else {
      base.s = Math.min(1, (halfW * 2) / 3.25);
      base.x = 0;
      base.y = halfH * 0.36;
    }
    spin.scale.setScalar(1.2);
    const px = 9 * dpr * (h / 900) * base.s;
    ptsU.uScale.value = px * 1.2;
    shellU.uScale.value = px;
  }
  layout();
  addEventListener('resize', layout);

  const v3 = new THREE.Vector3();
  let visible = true;

  function update(t, vh) {
    const r = hero.getBoundingClientRect();
    visible = r.bottom > 0;
    if (!visible) return;
    const hp = clamp(-r.top / Math.max(1, r.height - vh));
    const H = pin.clientHeight;

    // copy + chrome leave, light spreads, wash covers the screen
    const out = seg(hp, 0.06, 0.42);
    ui.style.opacity = String(1 - out);
    ui.style.transform = `translate3d(0,${-out * 70}px,0)`;
    ui.style.pointerEvents = out > 0.5 ? 'none' : '';
    const wp = seg(hp, 0.12, 0.98);
    wash.style.transform = `translate3d(0,${lerp(H, -(washH() - H), wp)}px,0)`;

    if (!renderer || document.hidden) return;
    const time = t * 0.001;
    const e = easeIO(seg(hp, 0.04, 0.9));
    const sway = REDUCED ? 0.2 : Math.sin(time * 0.23) * 0.34 + 0.14;
    spin.rotation.y += (sway + mouse.x * 0.42 - spin.rotation.y) * 0.06;
    spin.rotation.x += (0.05 + mouse.y * 0.16 - spin.rotation.x) * 0.06;
    rig.position.set(base.x * (1 - 0.3 * e) + mouse.x * 0.05, base.y + e * 1.25 - mouse.y * 0.04, 0);
    rig.scale.setScalar(base.s * (1 + e * 0.6));
    ptsU.uTime.value = time;
    ptsU.uColorY.value = state.colorY;
    ptsU.uScanY.value = state.colorY < 2 ? state.colorY : ((time * 0.42) % 6.4) - 2.0;
    ptsU.uBurst.value = easeIn(seg(hp, 0.2, 0.95)) * 0.9;
    ptsU.uZc.value = camera.position.z;
    shellU.uAlpha.value = 0.34 * seg(state.colorY, -1.2, 1.6) * (1 - seg(hp, 0.1, 0.5));
    orbU.uTime.value = time;
    orbU.uSpread.value = easeIO(seg(hp, 0.05, 0.8));
    renderer.render(scene, camera);
    state.ready = true;

    const w = pin.clientWidth;
    const ta = state.tagA * (1 - seg(hp, 0.02, 0.2));
    for (const a of anchors) {
      v3.copy(a.p).applyMatrix4(spin.matrixWorld).project(camera);
      a.el.style.transform = `translate3d(${((v3.x + 1) / 2) * w}px,${((1 - v3.y) / 2) * H - 12}px,0)`;
      a.el.style.opacity = String(ta);
    }
  }

  /* grayscale dots → color rises from the neck upward */
  function intro() {
    if (!gsap || REDUCED) { state.colorY = 2.4; state.tagA = 1; return; }
    gsap.to(state, { colorY: 2.4, duration: 2.6, ease: 'power2.inOut', delay: 0.25 });
    gsap.to(state, { tagA: 1, duration: 0.9, delay: 2.1 });
  }
  return { update, intro, state };
}

/* ═════════ intro: per-character fill + count-up ═════════ */
function initIntro() {
  const sec = $('#intro'), h = $('#introH');
  const chars = [];
  [...h.childNodes].forEach((node) => {
    if (node.nodeType !== 3) return;
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((word) => {
      if (!word) return;
      if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span');
      w.style.cssText = 'display:inline-block;white-space:nowrap';
      [...word].forEach((c) => {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = c;
        w.appendChild(s); chars.push(s);
      });
      frag.appendChild(w);
    });
    node.replaceWith(frag);
  });
  let last = -1;
  function update(vh) {
    const r = sec.getBoundingClientRect();
    if (r.top > vh || r.bottom < 0) return;
    const p = clamp((vh * 0.72 - r.top) / Math.max(1, r.height - vh * 0.62));
    const n = Math.round(p * chars.length * 1.08);
    if (n === last) return;
    last = n;
    chars.forEach((c, i) => c.classList.toggle('is-on', i < n));
  }

  $$('.stat-n').forEach((el) => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || '';
    const fmt = (v) => Math.round(v).toLocaleString('en-US') + suffix;
    if (!gsap || !ScrollTrigger || REDUCED) return;
    const o = { v: 0 };
    el.textContent = fmt(0);
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => gsap.to(o, { v: end, duration: 1.3, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); } }),
    });
  });
  return { update };
}

/* ═════════ journey: pinned, scroll-scrubbed image sequences ═════════ */
function initJourney() {
  const sec = $('#journey'), stage = $('#jStage');
  const frame = $('#jFrame'), over = $('#jOver');
  const mriWrap = $('#seqMriWrap'), colWrap = $('#seqColWrap');
  const ghostA = $('#ghostA'), ghostB = $('#ghostB');
  const cap = $('#jCap'), panel = $('#jPanel'), track = $('#jTrack');
  const cols = $$('.j-col', track), capItems = $$('.j-cap-i', cap), dots = $$('#jDots i');
  const stepEl = $('#jStep'), barEl = $('#jBar'), frameNo = $('#jFrameNo');
  const gauge = $('#gauge'), gaugeVal = $('#gaugeVal'), gaugeArc = $('#gaugeArc'), gaugeDot = $('#gaugeDot');
  const geo = {};

  // registered before the sequences so their own resize handler measures untransformed canvases
  addEventListener('resize', () => {
    frame.style.transform = over.style.transform = mriWrap.style.transform = colWrap.style.transform = 'none';
    measure();
  });

  const afterLoad = new Promise((res) => {
    if (document.readyState === 'complete') res();
    else { addEventListener('load', () => res(), { once: true }); setTimeout(res, 4000); }
  });
  // the shared player, wrapped: fewer parallel requests + retry, so a busy local server never leaves holes
  class SteadySequence extends FrameSequence {
    _loadOne(i, tries = 0) {
      return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          this.images[i] = img;
          this.loaded++;
          if (this.current === -1 || this._nearest(Math.round(this.progress * (this.count - 1))) === i) { this.current = -1; this.draw(this.progress); }
          resolve();
        };
        img.onerror = () => (tries < 3 ? setTimeout(() => this._loadOne(i, tries + 1).then(resolve), 500 + tries * 700) : resolve());
        img.src = this.url(i) + (tries ? `?r=${tries}` : '');
      });
    }
    async load() {
      await this._loadOne(0);
      this.draw(0);
      const order = [];
      for (let step = 16; step >= 1; step = Math.floor(step / 2)) {
        for (let i = 0; i < this.count; i += step) if (i !== 0 && !order.includes(i)) order.push(i);
        if (step === 1) break;
      }
      let k = 0;
      const next = async () => { while (k < order.length) await this._loadOne(order[k++]); };
      // the remaining frames stream in after window load, so they never hold the load event back
      this.ready = Promise.all([afterLoad, this.after]).then(() => Promise.all(Array.from({ length: 3 }, next)));
      return this;
    }
  }

  const url = (name) => (i) => `../assets/seq/${name}/${String(i + 1).padStart(4, '0')}.webp`;
  const mri = new SteadySequence({ canvas: $('#seqMri'), count: 97, url: url('mri'), fit: 'contain', background: '#ffffff' });
  const col = new SteadySequence({ canvas: $('#seqCol'), count: 97, url: url('colorize'), fit: 'contain', background: '#ffffff' });
  const firstFrame = mri.load().then(() => { col.after = mri.ready; return col.load(); }).catch(() => {});

  function measure() {
    const sh = stage.clientHeight, vw = stage.clientWidth;
    const mobile = vw <= MOBILE_W;
    geo.sh = sh; geo.vw = vw; geo.mobile = mobile;
    geo.band0 = sh * (mobile ? 0.3 : 0.13);
    geo.band1 = sh * (mobile ? 0.62 : 0.57);
    const h = mobile ? vw * 0.844 : Math.min(vw * 0.5625, sh * 0.88);
    geo.scaleEnd = Math.min(1, ((sh - geo.band1) * (mobile ? 0.78 : 0.86)) / (h * 0.895));
    geo.trackW = track.offsetWidth;
    geo.cols = cols.map((c) => c.offsetLeft + c.offsetWidth / 2);
    geo.gA = ghostA.offsetWidth; geo.gB = ghostB.offsetWidth;
    geo.pad = parseFloat(getComputedStyle(cap).paddingLeft) || 24;
  }
  track.style.width = 'max-content';
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  const st = { step: 0, roi: null, report: null, vel: 0, shown: 0, lastY: scrollY, lastT: performance.now(), frameTxt: '' };

  function setStep(step) {
    if (step === st.step) return;
    st.step = step;
    stepEl.textContent = pad(step);
    const capStep = Math.min(step, 3);
    capItems.forEach((el) => el.classList.toggle('is-on', +el.dataset.step === capStep));
    dots.forEach((d, i) => d.classList.toggle('is-on', i < step));
    stage.classList.toggle('is-roi', step >= 4);
    stage.classList.toggle('is-report', step >= 5);
  }

  function update(t, vh) {
    const r = sec.getBoundingClientRect();
    // speed gauge keeps decaying even right after the section leaves
    const now = t, dt = Math.max(1, now - st.lastT), y = scrollY;
    const v = (Math.abs(y - st.lastY) / dt) * 1000;
    st.lastY = y; st.lastT = now;
    st.vel += (v - st.vel) * (v > st.vel ? 0.3 : 0.07);
    if (r.top > vh || r.bottom < 0) return;

    const sig = Math.min(15, st.vel / 190);
    st.shown += (sig - st.shown) * 0.22;
    if (st.shown < 0.004) st.shown = 0;
    const k = st.shown / 15;
    gaugeVal.textContent = st.shown.toFixed(2);
    gauge.style.setProperty('--gc', st.shown < 0.03 ? '#0c0c0e' : jetCss(0.06 + k * 0.94, 0.86));
    gaugeArc.style.strokeDasharray = `${(k * 100).toFixed(1)} 100`;
    gaugeArc.style.opacity = k > 0.002 ? '1' : '0';
    const ang = -Math.PI / 2 + k * Math.PI * 2;
    gaugeDot.setAttribute('cx', (30 + (k > 0.002 ? 26 : 0) * Math.cos(ang)).toFixed(2));
    gaugeDot.setAttribute('cy', (30 + (k > 0.002 ? 26 : 0) * Math.sin(ang)).toFixed(2));

    const p = clamp(-r.top / Math.max(1, r.height - geo.sh));
    const vw = geo.vw;

    // A. MRI turns toward the viewer, then we dive into the bore
    mri.draw(seg(p, 0.015, 0.25));
    const dive = easeIn(seg(p, 0.25, 0.325));
    mriWrap.style.opacity = String(1 - seg(p, 0.275, 0.325));
    mriWrap.style.transform = `scale(${(1 + dive * 2.4).toFixed(4)})`;
    // B. gray vessel appears, then color rises
    const cin = seg(p, 0.29, 0.36);
    colWrap.style.opacity = String(cin);
    colWrap.style.transform = `scale(${(0.82 + 0.18 * easeOut(cin)).toFixed(4)})`;
    col.draw(seg(p, 0.4, 0.655));

    // C. the ground band rises into a panel, the vessel stands on its edge
    const rise = easeIO(seg(p, 0.65, 0.735));
    const band = lerp(geo.band0, geo.band1, rise);
    const s = lerp(1, geo.scaleEnd, rise);
    stage.style.setProperty('--band', band.toFixed(1) + 'px');
    stage.style.setProperty('--inv', (1 / s).toFixed(4));
    frame.style.transform = over.style.transform = `translate3d(0,${(-(band - geo.band0)).toFixed(1)}px,0) scale(${s.toFixed(4)})`;
    cap.style.opacity = String(1 - seg(rise, 0, 0.35));
    panel.style.opacity = String(seg(rise, 0.4, 1));
    panel.style.visibility = rise > 0.38 ? 'visible' : 'hidden';

    const tp = seg(p, 0.7, 0.935);
    const tx = lerp(vw * 0.66, vw - geo.trackW - geo.pad * 2, tp);
    track.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;

    // outline words passing behind the object
    ghostA.style.transform = `translate3d(${lerp(vw * 1.02, -geo.gA - 30, seg(p, 0.3, 0.57)).toFixed(1)}px,-50%,0)`;
    ghostB.style.transform = `translate3d(${lerp(vw * 1.02, -geo.gB - 30, seg(p, 0.5, 0.84)).toFixed(1)}px,-50%,0)`;

    let step = p < 0.27 ? 1 : p < 0.415 ? 2 : 3;
    const panelOn = rise > 0.5;
    cols.forEach((c, i) => {
      const cx = tx + geo.cols[i];
      c.classList.toggle('is-on', panelOn && cx < vw * 0.88);
    });
    if (panelOn && tx + geo.cols[3] < vw * 0.8) step = 4;
    if (panelOn && tx + geo.cols[4] < vw * 0.93) step = 5;
    setStep(step);
    barEl.style.transform = `scaleX(${p.toFixed(4)})`;
    const fr = pad((step === 1 ? Math.max(0, mri.current) : Math.max(0, col.current)) + 1, 3);
    if (fr !== st.frameTxt) { st.frameTxt = fr; frameNo.textContent = fr; }
  }
  return { update, firstFrame, measure };
}

/* ═════════ route: vertical vessel line + blood-cell marker ═════════ */
function initRoute() {
  const route = $('#route'), svg = $('#routeSvg');
  const wall = $('#routeWall'), flow = $('#routeFlow'), twigsG = $('#routeTwigs'), grad = $('#jetGrad');
  const cells = [$('#routeCell'), $('#routeCell2'), $('#routeCell3')];
  const tag = $('#routeTag'), node = $('#arriveNode'), arrive = $('#arrive');
  const feats = $$('.feat', route), paper = $('#paper'), screen = $('#screen');
  const report = $('#arriveReport'), uiBox = $('#arriveUi');
  const NS = 'http://www.w3.org/2000/svg';
  const g = { endY: 1, len: 1, ys: [], ls: [], X: () => 0, anchors: [], mobile: false, w: 0, h: 0 };

  function build() {
    const W = route.clientWidth, H = route.offsetHeight;
    const top0 = route.getBoundingClientRect().top;
    const mobile = W <= MOBILE_W;
    // desktop: the line ends at the top of the report sheet. mobile: just inside the arrival block.
    const endY = Math.max(200, (mobile ? arrive.getBoundingClientRect().top + 64 : node.getBoundingClientRect().top) - top0);
    if (W === g.w && H === g.h && Math.abs(endY - g.endY) < 1) return;
    g.w = W; g.h = H; g.endY = endY; g.mobile = mobile;
    const cx = mobile ? 30 : W / 2, A = mobile ? 5 : 52, L = 940;
    const X = (y) => cx + A * Math.sin((y / L) * Math.PI * 2 + 0.6) * easeIO(clamp(y / 260)) * easeIO(clamp((endY - y) / 420));
    g.X = X;
    let d = '', len = 0, px = 0, py = 0;
    g.ys = []; g.ls = [];
    for (let y = 0; ; y += 8) {
      const yy = Math.min(y, endY), x = X(yy);
      d += (y ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
      if (y) len += Math.hypot(x - px, yy - py);
      g.ys.push(yy); g.ls.push(len); px = x; py = yy;
      if (yy >= endY) break;
    }
    g.len = len;
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    wall.setAttribute('d', d); flow.setAttribute('d', d);
    flow.style.strokeDasharray = `${len.toFixed(1)} ${(len + 40).toFixed(1)}`;
    grad.setAttribute('y2', endY.toFixed(0));

    twigsG.textContent = '';
    g.anchors = feats.map((f) => {
      const top = f.getBoundingClientRect().top - top0;
      const dir = mobile ? 1 : f.classList.contains('feat--l') ? -1 : 1;
      const ay = top - (mobile ? 30 : 44), x0 = X(ay);
      const nx = mobile ? 52 : cx + dir * 132, ny = top + 1;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'twig');
      path.setAttribute('d', `M${x0.toFixed(1)} ${ay.toFixed(1)} C${(x0 + dir * (mobile ? 4 : 50)).toFixed(1)} ${(ay + 6).toFixed(1)} ${(nx - dir * (mobile ? 16 : 70)).toFixed(1)} ${ny.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'twig-node');
      dot.setAttribute('cx', nx.toFixed(1)); dot.setAttribute('cy', ny.toFixed(1)); dot.setAttribute('r', mobile ? 4.5 : 6);
      twigsG.append(path, dot);
      return { y: ay, el: f, path, dot, color: jetLine(ay / endY), on: null };
    });
  }
  // same stops as the SVG gradient, so a lit twig matches the trunk color at its height
  const STOPS = [[0, [27, 43, 255]], [0.24, [0, 168, 255]], [0.46, [18, 201, 138]], [0.66, [255, 204, 0]], [0.84, [255, 122, 0]], [1, [255, 31, 31]]];
  function jetLine(t) {
    t = clamp(t);
    for (let i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        const [a, ca] = STOPS[i - 1], [b, cb] = STOPS[i], k = (t - a) / (b - a);
        return `rgb(${ca.map((c, j) => Math.round(lerp(c, cb[j], k))).join(',')})`;
      }
    }
    return 'rgb(255,31,31)';
  }
  const lenAt = (y) => {
    const i = clamp(Math.floor(y / 8), 0, g.ls.length - 1), j = Math.min(i + 1, g.ls.length - 1);
    const span = g.ys[j] - g.ys[i];
    return span > 0 ? lerp(g.ls[i], g.ls[j], clamp((y - g.ys[i]) / span)) : g.ls[i];
  };

  build();
  if (window.ResizeObserver) new ResizeObserver(build).observe(route);
  addEventListener('resize', build);

  let lastCount = -1;
  function update(vh) {
    const r = route.getBoundingClientRect();
    if (r.top > vh * 1.2 || r.bottom < -vh * 0.2) return;
    const ym = clamp(vh * 0.6 - r.top, 0, g.endY);
    flow.style.strokeDashoffset = (g.len - lenAt(ym)).toFixed(1);
    const show = ym > 2;
    cells.forEach((c, i) => {
      const y = Math.max(0, ym - i * 24);
      c.setAttribute('transform', `translate(${g.X(y).toFixed(1)},${y.toFixed(1)})`);
      c.style.opacity = show && (i === 0 || ym - i * 24 > 0) ? 1 : 0;
    });
    let count = 0;
    for (const a of g.anchors) {
      const on = ym >= a.y;
      if (on) count++;
      if (on !== a.on) {
        a.on = on;
        a.el.classList.toggle('is-on', on);
        a.path.style.stroke = on ? a.color : '';
        a.dot.style.fill = on ? a.color : '';
        a.dot.style.stroke = on ? a.color : '';
      }
    }
    const arrived = ym >= g.endY - 2;
    tag.style.transform = `translate3d(${(g.X(ym) + 30).toFixed(1)}px,${(ym - 11).toFixed(1)}px,0)`;
    tag.style.opacity = show && !arrived ? 1 : 0;
    if (count !== lastCount) { lastCount = count; tag.textContent = `${pad(count)} / 06`; }
    arrive.classList.toggle('is-on', arrived);

    // the report lands like a sheet of paper
    const pr = report.getBoundingClientRect();
    if (pr.top < vh * 1.3 && pr.bottom > -200) {
      const q = easeOut(seg((vh * 1.05 - pr.top) / (vh * 0.8), 0, 1));
      paper.style.transform = `translate3d(0,${((1 - q) * 110).toFixed(1)}px,0) rotate(${lerp(-15, -4, q).toFixed(2)}deg)`;
      const ur = uiBox.getBoundingClientRect();
      const q2 = easeOut(seg((vh * 1.05 - ur.top) / (vh * 0.8), 0, 1));
      screen.style.transform = `translate3d(0,${((1 - q2) * 160).toFixed(1)}px,0) rotate(${lerp(9, 2.5, q2).toFixed(2)}deg)`;
    }
  }
  return { update, build };
}

/* ═════════ faq accordion ═════════ */
function initFaq() {
  const items = $$('.acc-i');
  items.forEach((item) => {
    const btn = $('.acc-q', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('is-open');
      items.forEach((o) => {
        o.classList.toggle('is-open', o === item && open);
        $('.acc-q', o).setAttribute('aria-expanded', String(o === item && open));
      });
      if (ScrollTrigger) setTimeout(() => ScrollTrigger.refresh(), 650);
    });
  });
}

/* ═════════ reveals ═════════ */
function initReveals() {
  if (!gsap || !ScrollTrigger || REDUCED) return;
  $$('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 34, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
  });
  $$('[data-lines]').forEach((el) => {
    gsap.from($$('.ln > span', el), { yPercent: 112, duration: 1.15, ease: 'power4.out', stagger: 0.09, scrollTrigger: { trigger: el, start: 'top 88%' } });
  });
  gsap.from('.logos li', { opacity: 0, y: 26, duration: 0.8, ease: 'power3.out', stagger: 0.05, scrollTrigger: { trigger: '.logos', start: 'top 86%' } });
}

/* ═════════ small robustness helpers ═════════ */
// a lazily loaded image that failed once (busy dev server) gets one more try
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el && el.tagName === 'IMG' && !el.dataset.retry) {
    el.dataset.retry = '1';
    setTimeout(() => { el.src = el.src.split('?')[0] + '?r=1'; }, 900);
  }
}, true);
// the thumbnail video only plays while it is on screen
if (window.IntersectionObserver) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) en.target.play().catch(() => {}); else en.target.pause();
  }), { threshold: 0.1 });
  $$('video').forEach((v) => io.observe(v));
}

/* ═════════ boot ═════════ */
const hero = initHero();
const intro = initIntro();
const journey = initJourney();
const route = initRoute();
initFaq();
initReveals();

function frame(t) {
  if (lenis) lenis.raf(t);
  const vh = innerHeight;
  hero.update(t, vh);
  intro.update(vh);
  journey.update(t, vh);
  route.update(vh);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener('load', () => {
  journey.measure(); route.build();
  if (ScrollTrigger) ScrollTrigger.refresh();
});

/* preloader: always released within ~2.4s, even if assets fail */
(function preloader() {
  const pre = $('#pre'), num = $('#preNum'), bar = $('#preBar');
  const t0 = performance.now();
  let ready = false, done = false;
  journey.firstFrame.then(() => { ready = true; });
  if (lenis) lenis.stop();
  history.scrollRestoration = 'manual';
  function finish() {
    if (done) return;
    done = true;
    pre.classList.add('is-done');
    if (lenis) lenis.start();
    hero.intro();
    if (gsap && !REDUCED) {
      gsap.from('.hero-h .ln > span', { yPercent: 112, duration: 1.2, ease: 'power4.out', stagger: 0.1, delay: 0.25 });
      gsap.from('.hero-eyebrow, .hero-kr, .hero-sub, .hero-cta, .hero-meta, .hero-scale', { y: 22, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.07, delay: 0.55 });
      gsap.from('.top-logo, .top-nav .nav-i, .top-r, .ticker', { opacity: 0, y: -10, duration: 0.8, ease: 'power2.out', stagger: 0.05, delay: 0.4 });
    }
  }
  function step(now) {
    const el = now - t0;
    const p = clamp(el / 1500) * (ready && hero.state.ready ? 1 : 0.9);
    num.textContent = pad(Math.round(p * 100), 3);
    bar.style.transform = `scaleX(${p})`;
    if ((p >= 1 && el > 900) || el > 2400) { num.textContent = '100'; bar.style.transform = 'scaleX(1)'; finish(); return; }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  setTimeout(finish, 2600);
})();
