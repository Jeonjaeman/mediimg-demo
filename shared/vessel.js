/**
 * MEDIIMG demo shared module — procedural 3D cerebral artery tree (Circle of Willis style)
 * with a SIG-like jet colormap shader. Requires an importmap entry for "three".
 *
 *   import * as THREE from 'three';
 *   import { createVesselTree, createTunnel, createBloodCellGeometry, JET_GLSL, jetColor } from '../shared/vessel.js';
 *
 *   const vessel = createVesselTree({ detail: 1 });   // -> { group, mesh, material, uniforms, update(t) }
 *   scene.add(vessel.group);                           // fits roughly inside a 2.6 (w) x 2.7 (h) x 1.6 (d) box, centered at origin, y up
 *   vessel.uniforms.uColor.value  = 1;   // 0 = clay gray (plain MRA look), 1 = SIG jet colormap
 *   vessel.uniforms.uReveal.value = 1;   // 0..1 grows the tree from the neck upward
 *   vessel.uniforms.uGlow.value   = 0.6; // emissive / rim strength
 *   vessel.update(elapsedSeconds);       // animates the flow pulse
 *
 *   const tunnel = createTunnel();                     // -> { group, mesh, cells, uniforms, curve, place(camera, t), update(t) }
 *   tunnel.place(camera, progress01);                  // flies the camera through the inside of a vessel
 */
import * as THREE from 'three';

export const JET_GLSL = /* glsl */ `
vec3 jet(float t){
  t = clamp(t, 0.0, 1.0);
  return clamp(vec3(1.5 - abs(4.0*t - 3.0), 1.5 - abs(4.0*t - 2.0), 1.5 - abs(4.0*t - 1.0)), 0.0, 1.0);
}`;

export function jetColor(t, target = new THREE.Color()) {
  const c = (v) => Math.min(1, Math.max(0, v));
  t = c(t);
  return target.setRGB(c(1.5 - Math.abs(4 * t - 3)), c(1.5 - Math.abs(4 * t - 2)), c(1.5 - Math.abs(4 * t - 1)));
}

/* ---------- deterministic noise ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}
function fbm(x, y, z) {
  return 0.55 * noise3(x, y, z) + 0.3 * noise3(x * 2.1, y * 2.1, z * 2.1) + 0.15 * noise3(x * 4.3, y * 4.3, z * 4.3);
}

/* ---------- anatomy (left side defined, right side mirrored with a little asymmetry) ---------- */
const MID = [
  { name: 'basilar', r: [0.058, 0.05], pts: [[0, -1.0, -0.25], [0.03, -0.62, -0.22], [-0.025, -0.28, -0.2], [0, 0.05, -0.18]] },
  { name: 'acomm', r: [0.022, 0.022], pts: [[-0.07, 0.2, 0.4], [0, 0.215, 0.42], [0.07, 0.2, 0.4]] },
];
const LEFT = [
  { name: 'vertebral', r: [0.04, 0.044], pts: [[-0.3, -1.55, -0.3], [-0.24, -1.3, -0.34], [-0.1, -1.1, -0.28], [0, -1.0, -0.25]] },
  { name: 'pca', r: [0.036, 0.018], pts: [[0, 0.05, -0.18], [-0.16, 0.11, -0.2], [-0.36, 0.05, -0.3], [-0.56, 0.12, -0.5], [-0.62, 0.3, -0.72], [-0.52, 0.52, -0.86]] },
  { name: 'sca', r: [0.022, 0.012], pts: [[0, -0.06, -0.19], [-0.2, -0.09, -0.25], [-0.42, -0.03, -0.4], [-0.55, -0.1, -0.58]] },
  { name: 'aica', r: [0.018, 0.01], pts: [[0.01, -0.55, -0.22], [-0.18, -0.62, -0.2], [-0.36, -0.6, -0.3]] },
  { name: 'ica', r: [0.075, 0.056], pts: [[-0.4, -1.55, 0.05], [-0.37, -1.15, 0.08], [-0.43, -0.78, 0.0], [-0.37, -0.56, 0.15], [-0.3, -0.45, 0.3], [-0.29, -0.3, 0.23], [-0.33, -0.15, 0.1], [-0.3, 0.02, 0.12]] },
  { name: 'mca', r: [0.05, 0.036], pts: [[-0.3, 0.02, 0.12], [-0.5, 0.05, 0.16], [-0.74, 0.08, 0.13], [-0.9, 0.12, 0.1]] },
  { name: 'm2sup', r: [0.034, 0.014], pts: [[-0.9, 0.12, 0.1], [-1.0, 0.3, 0.05], [-1.06, 0.56, -0.05], [-1.0, 0.82, -0.2], [-0.86, 1.0, -0.36]] },
  { name: 'm2inf', r: [0.032, 0.013], pts: [[-0.9, 0.12, 0.1], [-1.06, 0.15, -0.1], [-1.16, 0.3, -0.36], [-1.1, 0.52, -0.6], [-0.96, 0.7, -0.76]] },
  { name: 'm2ant', r: [0.022, 0.01], pts: [[-0.74, 0.08, 0.13], [-0.82, 0.3, 0.3], [-0.84, 0.56, 0.34], [-0.76, 0.8, 0.26]] },
  { name: 'aca', r: [0.036, 0.016], pts: [[-0.3, 0.02, 0.12], [-0.18, 0.1, 0.26], [-0.07, 0.2, 0.4], [-0.05, 0.42, 0.5], [-0.055, 0.68, 0.5], [-0.06, 0.92, 0.36], [-0.05, 1.07, 0.1], [-0.05, 1.12, -0.2]] },
  { name: 'pcomm', r: [0.018, 0.016], pts: [[-0.33, -0.15, 0.1], [-0.31, -0.06, -0.06], [-0.35, 0.04, -0.28]] },
  { name: 'ophth', r: [0.016, 0.008], pts: [[-0.3, -0.45, 0.3], [-0.36, -0.42, 0.5], [-0.46, -0.36, 0.7]] },
];

function mirror(def, rnd) {
  const j = () => (rnd() - 0.5) * 0.05;
  return {
    name: def.name + 'R',
    r: def.r,
    pts: def.pts.map(([x, y, z], i) => (x === 0 ? [0, y, z] : [-x + (i ? j() : 0), y + (i ? j() : 0), z + (i ? j() : 0)])),
  };
}

function sprout(branches, rnd, count) {
  // small distal branches growing out of the thinner vessels
  const hosts = branches.filter((b) => /m2|pca|aca|sca/.test(b.name));
  const out = [];
  for (let i = 0; i < count; i++) {
    const host = hosts[Math.floor(rnd() * hosts.length)];
    const c = new THREE.CatmullRomCurve3(host.pts.map((p) => new THREE.Vector3(...p)));
    const t = 0.35 + rnd() * 0.6;
    const o = c.getPointAt(t);
    const tan = c.getTangentAt(t);
    const side = new THREE.Vector3(rnd() - 0.5, rnd() - 0.3, rnd() - 0.5).normalize();
    const dir = tan.clone().multiplyScalar(0.6).add(side).normalize();
    const len = 0.18 + rnd() * 0.3;
    const p1 = o.clone().addScaledVector(dir, len * 0.5).add(new THREE.Vector3((rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.08));
    const p2 = o.clone().addScaledVector(dir, len).add(new THREE.Vector3((rnd() - 0.5) * 0.14, rnd() * 0.12, (rnd() - 0.5) * 0.14));
    const r0 = THREE.MathUtils.lerp(host.r[0], host.r[1], t) * 0.62;
    out.push({ name: 'twig', r: [r0, r0 * 0.45], pts: [o.toArray(), p1.toArray(), p2.toArray()] });
  }
  return out;
}

/* ---------- geometry ---------- */
function buildTubes(branches, { radial = 14, perUnit = 44, radiusScale = 1 }) {
  const pos = [], nor = [], sig = [], along = [], grow = [], idx = [];
  let base = 0;
  const N = new THREE.Vector3(), P = new THREE.Vector3();
  for (const b of branches) {
    const curve = new THREE.CatmullRomCurve3(b.pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const len = curve.getLength();
    const seg = Math.max(8, Math.round(len * perUnit));
    const frames = curve.computeFrenetFrames(seg, false);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      curve.getPointAt(t, P);
      // tortuosity: bend the path a little between its (fixed) end points
      const bend = Math.sin(Math.PI * t) * 0.075;
      P.x += (noise3(P.y * 3.1 + 11, P.z * 3.1, t * 2 + base * 0.01) - 0.5) * bend;
      P.y += (noise3(P.z * 3.1 + 23, P.x * 3.1, t * 2 + base * 0.01) - 0.5) * bend * 0.6;
      P.z += (noise3(P.x * 3.1 + 37, P.y * 3.1, t * 2 + base * 0.01) - 0.5) * bend;
      const wob = 1 + 0.1 * (noise3(P.x * 6, P.y * 6, P.z * 6) - 0.5);
      const r = THREE.MathUtils.lerp(b.r[0], b.r[1], t) * wob * radiusScale;
      // SIG-like scalar: thinner + more curved + noisy => "hotter"
      const curv = i > 0 && i < seg ? frames.tangents[i].distanceTo(frames.tangents[i - 1]) * seg * 0.02 : 0;
      // thick central trunks read hot (red/orange), thin distal branches cool (blue) — like real SIG maps
      const thick = Math.min(1, THREE.MathUtils.lerp(b.r[0], b.r[1], t) / 0.07);
      const s0 = 0.1 + 0.46 * fbm(P.x * 2.4 + 7, P.y * 2.4, P.z * 2.4) + 0.36 * thick + Math.min(0.22, curv);
      const g = THREE.MathUtils.clamp(0.62 * (P.y + 1.55) / 2.7 + 0.38 * Math.hypot(P.x, P.z) / 1.3, 0, 1);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const cs = Math.cos(a), sn = Math.sin(a);
        N.set(0, 0, 0).addScaledVector(frames.normals[i], cs).addScaledVector(frames.binormals[i], sn).normalize();
        pos.push(P.x + N.x * r, P.y + N.y * r, P.z + N.z * r);
        nor.push(N.x, N.y, N.z);
        // angular variation so one side of the wall reads hotter (like real SIG maps)
        const sAng = 0.16 * Math.sin(a + P.y * 5 + P.x * 3) + 0.1 * (noise3(P.x * 9 + cs, P.y * 9 + sn, P.z * 9) - 0.5);
        sig.push(THREE.MathUtils.clamp(s0 + sAng, 0, 1));
        along.push(t * len);
        grow.push(g);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < radial; j++) {
        const a = base + i * (radial + 1) + j, b2 = a + radial + 1;
        idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
      }
    }
    base += (seg + 1) * (radial + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aSig', new THREE.Float32BufferAttribute(sig, 1));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('aGrow', new THREE.Float32BufferAttribute(grow, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const VERT = /* glsl */ `
attribute float aSig; attribute float aAlong; attribute float aGrow;
uniform float uInflate;
varying vec3 vN; varying vec3 vV; varying float vSig; varying float vAlong; varying float vGrow; varying vec3 vW;
void main(){
  vec3 p = position + normal * uInflate;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz; vSig = aSig; vAlong = aAlong; vGrow = aGrow;
  vW = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uColor, uReveal, uGlow, uOpacity, uPulse, uSigShift, uSigGain;
uniform vec3 uGray, uRim, uLightDir;
varying vec3 vN; varying vec3 vV; varying float vSig; varying float vAlong; varying float vGrow; varying vec3 vW;
${JET_GLSL}
void main(){
  if (vGrow > uReveal) discard;
  vec3 n = normalize(vN); vec3 v = normalize(vV);
  float pulse = 0.5 + 0.5 * sin(vAlong * 9.0 - uTime * 2.4);
  float s = clamp((vSig - 0.5) * uSigGain + 0.5 + uSigShift + (pulse - 0.5) * 0.12 * uPulse, 0.0, 1.0);
  vec3 col = mix(uGray, jet(s), uColor);
  float ndl = max(dot(n, normalize(uLightDir)), 0.0);
  float ndl2 = max(dot(n, normalize(vec3(-0.6, 0.2, 0.5))), 0.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.6);
  float spec = pow(max(dot(reflect(-normalize(uLightDir), n), v), 0.0), 36.0);
  vec3 lit = col * (0.34 + 0.62 * ndl + 0.2 * ndl2) + spec * 0.35;
  lit += col * uGlow * 0.55 * uColor;                 // emissive when colored
  lit += uRim * fres * (0.35 + uGlow);
  float edge = smoothstep(uReveal, uReveal - 0.035, vGrow);  // bright growth front
  lit += (1.0 - edge) * vec3(0.9, 0.95, 1.0) * step(uReveal, 0.999);
  gl_FragColor = vec4(lit, uOpacity);
}`;

export function createVesselMaterial(overrides = {}) {
  const uniforms = {
    uTime: { value: 0 }, uColor: { value: 1 }, uReveal: { value: 1 }, uGlow: { value: 0.35 }, uOpacity: { value: 1 },
    uPulse: { value: 1 }, uSigShift: { value: 0 }, uSigGain: { value: 1.25 }, uInflate: { value: 0 },
    uGray: { value: new THREE.Color(0xc9ced6) }, uRim: { value: new THREE.Color(0x6fb6ff) },
    uLightDir: { value: new THREE.Vector3(0.45, 0.8, 0.6) },
  };
  for (const k in overrides) if (uniforms[k]) uniforms[k].value = overrides[k];
  return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
}

/**
 * @param {object} o
 * @param {number} [o.detail=1]  geometry density multiplier (0.6 mobile .. 1.4 hero)
 * @param {number} [o.twigs=26]  number of small distal branches
 * @param {number} [o.seed=7]
 * @param {number} [o.radiusScale=1.35]
 */
export function createVesselTree(o = {}) {
  const { detail = 1, twigs = 26, seed = 7, radiusScale = 1.35 } = o;
  const rnd = mulberry32(seed);
  let branches = [...MID, ...LEFT, ...LEFT.map((d) => mirror(d, rnd))];
  branches = branches.concat(sprout(branches, rnd, twigs));
  const geometry = buildTubes(branches, { radial: Math.round(14 * detail), perUnit: Math.round(44 * detail), radiusScale });
  const material = createVesselMaterial(o.uniforms);
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  const curves = branches.map((b) => ({ name: b.name, curve: new THREE.CatmullRomCurve3(b.pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), r: b.r }));
  return {
    group, mesh, geometry, material, uniforms: material.uniforms, branches, curves,
    update(t) { material.uniforms.uTime.value = t; },
    /** points sampled on the vessel surface, e.g. for particle / dotted versions: Float32Array xyz + Float32Array sig */
    samplePoints(n = 6000) {
      const p = geometry.attributes.position, s = geometry.attributes.aSig;
      const out = new Float32Array(n * 3), sg = new Float32Array(n);
      const r = mulberry32(seed + 99);
      for (let i = 0; i < n; i++) {
        const k = Math.floor(r() * p.count);
        out[i * 3] = p.getX(k); out[i * 3 + 1] = p.getY(k); out[i * 3 + 2] = p.getZ(k); sg[i] = s.getX(k);
      }
      return { positions: out, sig: sg };
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}

/* ---------- red blood cell (biconcave disc) ---------- */
export function createBloodCellGeometry(radius = 1, segments = 28) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const x = (i / 16) * radius;
    const u = x / radius;
    const h = 0.32 * radius * Math.sqrt(Math.max(0, 1 - u * u)) * (0.28 + 1.9 * u * u - 1.05 * u * u * u * u);
    pts.push(new THREE.Vector2(x, h));
  }
  for (let i = 16; i >= 0; i--) pts.push(new THREE.Vector2(pts[i].x, -pts[i].y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}

/* ---------- inside-the-vessel tunnel ---------- */
const TUNNEL_FRAG = /* glsl */ `
precision highp float;
uniform float uTime, uColor, uFog; uniform vec3 uFogColor;
varying vec2 vUv; varying vec3 vV; varying vec3 vN;
${JET_GLSL}
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 uv = vec2(vUv.x * 46.0, vUv.y * 6.2831);
  float s = 0.5 * n2(vec2(uv.x * 0.55, sin(uv.y) * 1.6 + cos(uv.y) * 0.7)) + 0.3 * n2(uv * vec2(1.6, 1.1) + 9.0) + 0.2 * sin(uv.x * 0.7 - uTime * 1.2 + sin(uv.y * 2.0));
  s = clamp(s * 1.15, 0.0, 1.0);
  vec3 wall = mix(vec3(0.42, 0.06, 0.08), jet(s), uColor);
  float ribs = 0.92 + 0.08 * sin(vUv.x * 900.0);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
  vec3 col = wall * ribs * (0.55 + 0.6 * fres);
  float d = length(vV);
  col = mix(col, uFogColor, 1.0 - exp(-d * uFog));
  gl_FragColor = vec4(col, 1.0);
}`;
const TUNNEL_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vV; varying vec3 vN;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;

/**
 * A long winding vessel seen from the inside, with flowing red blood cells.
 * @param {object} o  {length=60, radius=1.25, cells=220, seed=3}
 */
export function createTunnel(o = {}) {
  const { length = 60, radius = 1.25, cells = 220, seed = 3 } = o;
  const rnd = mulberry32(seed);
  const pts = [];
  const steps = 16;
  for (let i = 0; i <= steps; i++) {
    const z = -(i / steps) * length;
    pts.push(new THREE.Vector3(Math.sin(i * 1.1) * 2.4 + (rnd() - 0.5) * 1.2, Math.cos(i * 0.8) * 1.6 + (rnd() - 0.5) * 1.0, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const geometry = new THREE.TubeGeometry(curve, 520, radius, 40, false);
  const uniforms = { uTime: { value: 0 }, uColor: { value: 1 }, uFog: { value: 0.085 }, uFogColor: { value: new THREE.Color(0x020308) } };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: TUNNEL_VERT, fragmentShader: TUNNEL_FRAG, side: THREE.BackSide });
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);

  // blood cells
  const cellGeo = createBloodCellGeometry(0.12, 20);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0x9c0d18, roughness: 0.5, metalness: 0.05, emissive: 0x1c0204 });
  const inst = new THREE.InstancedMesh(cellGeo, cellMat, cells);
  const data = [];
  for (let i = 0; i < cells; i++) {
    data.push({ t: rnd(), ang: rnd() * Math.PI * 2, rad: rnd() * radius * 0.72, speed: 0.012 + rnd() * 0.02, rx: rnd() * 6.28, ry: rnd() * 6.28, spin: (rnd() - 0.5) * 2, sc: 0.7 + rnd() * 0.7 });
  }
  group.add(inst);
  const light = new THREE.PointLight(0xffe9e0, 7, 12, 1.8);
  group.add(light, new THREE.AmbientLight(0xffffff, 0.22));

  const dummy = new THREE.Object3D();
  const frames = curve.computeFrenetFrames(400, false);
  const P = new THREE.Vector3(), T = new THREE.Vector3(), L = new THREE.Vector3();
  function frameAt(t) {
    const i = Math.min(399, Math.max(0, Math.floor(t * 400)));
    return { n: frames.normals[i], b: frames.binormals[i] };
  }
  return {
    group, mesh, cells: inst, uniforms, curve, material,
    /** put the camera inside the tunnel at progress t (0..1), looking forward */
    place(camera, t) {
      t = THREE.MathUtils.clamp(t, 0, 0.985);
      curve.getPointAt(t, P);
      curve.getPointAt(Math.min(1, t + 0.012), L);
      camera.position.copy(P);
      camera.lookAt(L);
      light.position.copy(P);
    },
    update(time) {
      uniforms.uTime.value = time;
      for (let i = 0; i < cells; i++) {
        const d = data[i];
        const t = (d.t + time * d.speed) % 1;
        curve.getPointAt(t, P);
        const f = frameAt(t);
        dummy.position.copy(P).addScaledVector(f.n, Math.cos(d.ang) * d.rad).addScaledVector(f.b, Math.sin(d.ang) * d.rad);
        dummy.rotation.set(d.rx + time * d.spin, d.ry + time * d.spin * 0.7, 0);
        dummy.scale.setScalar(d.sc);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    },
  };
}
