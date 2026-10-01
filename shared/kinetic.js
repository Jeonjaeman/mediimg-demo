/**
 * MEDIIMG demo shared module — kinetic typography helpers for Korean text rendered in the DOM
 * (instead of baking text into video, where AI-generated footage cannot draw Hangul correctly).
 *
 *   import { splitText, hangulTypingSteps, typeHangul, createDirectionalBlur } from '../shared/kinetic.js';
 *
 *   // 1) split into animatable spans (keeps the original string in aria-label for screen readers / SEO)
 *   const { chars, words } = splitText(el, { by: 'char' });      // or by: 'word'
 *
 *   // 2) IME-accurate Hangul typing: "뇌혈관" -> ['ㄴ','노','뇌','뇧','뇌혀','뇌혈','뇌혈ㄱ','뇌혈고','뇌혈과','뇌혈관']
 *   const steps = hangulTypingSteps('뇌혈관을 색으로');
 *   typeHangul(inputEl, '뇌혈관을 색으로', { interval: 70 });    // returns a Promise; or drive `steps` from a GSAP timeline
 *
 *   // 3) directional (one-axis) motion blur, like After Effects "Directional Blur" — CSS blur() is always round
 *   const blur = createDirectionalBlur();                        // injects one <svg><filter> into the page
 *   el.style.filter = blur.url;                                  // 'url(#kb-1)'
 *   blur.set(40, 0);                                             // horizontal streak of 40px; animate x -> 0 to "land" a word
 */

/* ---------- text splitting ---------- */
export function splitText(el, { by = 'char', charClass = 'k-char', wordClass = 'k-word' } = {}) {
  const text = el.textContent;
  el.setAttribute('aria-label', text.replace(/\s+/g, ' ').trim());
  el.textContent = '';
  const chars = [], words = [];
  const lines = text.split('\n');
  lines.forEach((line, li) => {
    line.split(/(\s+)/).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) { el.appendChild(document.createTextNode(' ')); return; }
      const w = document.createElement('span');
      w.className = wordClass;
      w.setAttribute('aria-hidden', 'true');
      w.style.display = 'inline-block';
      w.style.whiteSpace = 'nowrap';
      if (by === 'char') {
        for (const ch of Array.from(token)) {
          const c = document.createElement('span');
          c.className = charClass;
          c.style.display = 'inline-block';
          c.textContent = ch;
          w.appendChild(c);
          chars.push(c);
        }
      } else {
        w.textContent = token;
      }
      el.appendChild(w);
      words.push(w);
    });
    if (li < lines.length - 1) el.appendChild(document.createElement('br'));
  });
  return { chars, words };
}

/* ---------- Hangul composition (2-set keyboard IME behaviour) ---------- */
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
// compound vowels / final consonants are typed as two key strokes
const JUNG_SPLIT = { 'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'], 'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'] };
const JONG_SPLIT = { 'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'] };

const isSyllable = (ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };
const compose = (cho, jung, jong = 0) => String.fromCharCode(0xac00 + (cho * 21 + jung) * 28 + jong);
function decompose(ch) {
  const n = ch.charCodeAt(0) - 0xac00;
  return { cho: Math.floor(n / 588), jung: Math.floor((n % 588) / 28), jong: n % 28 };
}

/**
 * Every intermediate string a Korean IME shows while `text` is being typed, including the moment
 * a consonant first attaches to the previous syllable as a final ("가" + ㄴ -> "간" -> "가나").
 * @returns {string[]} steps, last one === text
 */
export function hangulTypingSteps(text) {
  const out = [];
  const chars = Array.from(text);
  let done = '';
  const push = (s) => { if (out[out.length - 1] !== s) out.push(s); };
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!isSyllable(ch)) { done += ch; push(done); continue; }
    const { cho, jung, jong } = decompose(ch);
    const prev = chars[i - 1];
    // the initial consonant first lands as the final of the previous open syllable, when that forms a valid block
    let borrowed = false;
    if (prev && isSyllable(prev)) {
      const p = decompose(prev);
      const asJong = JONG.indexOf(CHO[cho]);
      if (p.jong === 0 && asJong > 0) {
        push(done.slice(0, -1) + compose(p.cho, p.jung, asJong));
        borrowed = true;
      }
    }
    if (!borrowed) push(done + CHO[cho]);
    // vowel (compound vowels in two strokes)
    const jv = JUNG[jung];
    if (JUNG_SPLIT[jv]) push(done + compose(cho, JUNG.indexOf(JUNG_SPLIT[jv][0])));
    push(done + compose(cho, jung));
    // final consonant (compound finals in two strokes)
    if (jong) {
      const jf = JONG[jong];
      if (JONG_SPLIT[jf]) push(done + compose(cho, jung, JONG.indexOf(JONG_SPLIT[jf][0])));
      push(done + compose(cho, jung, jong));
    }
    done += ch;
  }
  push(text);
  return out;
}

/** Types `text` into `el` (textContent or value) with IME-accurate steps. Resolves when finished. */
export function typeHangul(el, text, { interval = 70, jitter = 0.35, onStep = null } = {}) {
  const steps = hangulTypingSteps(text);
  const prop = 'value' in el && el.tagName !== 'BUTTON' ? 'value' : 'textContent';
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      el[prop] = steps[i];
      if (onStep) onStep(steps[i], i, steps.length);
      i++;
      if (i >= steps.length) return resolve();
      setTimeout(tick, interval * (1 + (Math.random() - 0.5) * 2 * jitter));
    };
    tick();
  });
}

/* ---------- directional motion blur (SVG feGaussianBlur with separate x / y deviation) ---------- */
let blurCount = 0;
export function createDirectionalBlur() {
  const id = `kb-${++blurCount}`;
  const ns = 'http://www.w3.org/2000/svg';
  let svg = document.getElementById('k-blur-defs');
  if (!svg) {
    svg = document.createElementNS(ns, 'svg');
    svg.id = 'k-blur-defs';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(svg);
  }
  const filter = document.createElementNS(ns, 'filter');
  filter.id = id;
  // generous region so long streaks are not clipped
  filter.setAttribute('x', '-60%'); filter.setAttribute('y', '-30%');
  filter.setAttribute('width', '220%'); filter.setAttribute('height', '160%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const fe = document.createElementNS(ns, 'feGaussianBlur');
  fe.setAttribute('in', 'SourceGraphic');
  fe.setAttribute('stdDeviation', '0 0');
  filter.appendChild(fe);
  svg.appendChild(filter);
  const state = { x: 0, y: 0 };
  return {
    id, url: `url(#${id})`, state,
    /** @param {number} x horizontal blur in px, @param {number} y vertical blur in px */
    set(x, y = 0) {
      state.x = x; state.y = y;
      fe.setAttribute('stdDeviation', `${Math.max(0, x).toFixed(2)} ${Math.max(0, y).toFixed(2)}`);
    },
  };
}
