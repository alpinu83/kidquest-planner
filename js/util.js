import { EMOJI_BASE } from './config.js';

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKey(d);
}
export function addDays(key, n) {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
export function dowOf(key) {
  return new Date(key + 'T00:00:00').getDay();
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
export function dayLabel(key) {
  const d = new Date(key + 'T00:00:00');
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_NAMES[d.getDay()]})`;
  if (key === todayKey(0)) return `오늘 · ${base}`;
  if (key === todayKey(1)) return `내일 · ${base}`;
  if (key === todayKey(-1)) return `어제 · ${base}`;
  return base;
}
export function shortDate(key) {
  const d = new Date(key + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}
export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}
export function hhmm(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
export function toMinutes(t) {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + (m || 0);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// 문자열 시드 기반 난수 (날짜·아이별로 매일 같은 미션이 나오도록)
export function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0);
}
export function seededRandom(seedStr) {
  let a = hashStr(seedStr);
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function pick(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length)];
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const vals = (obj) => Object.values(obj || {}).filter(Boolean);

// Fluent 3D 이모지 경로
export function E(name) {
  return EMOJI_BASE + name.toLowerCase().replace(/ /g, '_').replace(/[^a-z0-9_]/g, '') + '.png';
}

export function normalizeAnswer(s) {
  return String(s || '').toLowerCase().replace(/[\s.,!?'"~\-]/g, '');
}

export function speak(text, lang = 'en-US', rate = 0.85) {
  try {
    if (!('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === lang && /Samantha|Google US|Aria|Jenny|Ava/i.test(x.name)) || voices.find((x) => x.lang === lang);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
    return true;
  } catch (_) {
    return false;
  }
}

export function vibrate(ms = 12) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {}
}

// 간단한 효과음 (Web Audio, 외부 파일 불필요)
let audioCtx = null;
export function sfx(kind = 'tap') {
  try {
    if (localStorage.getItem('kq2_mute') === '1') return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => {});
    const notes = {
      tap: [[660, 0.05]],
      good: [[660, 0.08], [880, 0.12]],
      bad: [[220, 0.15]],
      coin: [[988, 0.07], [1319, 0.18]],
      levelup: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]],
      eat: [[392, 0.06], [330, 0.06], [440, 0.1]]
    }[kind] || [[600, 0.05]];
    let t = ctx.currentTime;
    for (const [f, d] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + d + 0.02);
      t += d * 0.9;
    }
  } catch (_) {}
}

export function compressImage(file, maxSize = 640, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// iPad(iOS)는 사용자가 화면을 한 번 터치해야 소리·음성이 나와요 → 첫 터치 때 미리 깨워 두기
export function unlockAudioOnce() {
  const go = () => {
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } } catch (_) {}
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {}); } catch (_) {}
  };
  window.addEventListener('pointerdown', go, { once: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') window.addEventListener('pointerdown', go, { once: true, capture: true }); });
}
