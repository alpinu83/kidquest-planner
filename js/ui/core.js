import { html, render, useState, useEffect, useRef, useMemo, useCallback } from '../../vendor/preact-htm.js';
import confetti from '../../vendor/confetti.js';
import { ICONS } from '../../vendor/lucide-icons.js';
import * as db from '../store.js';
import { E } from '../util.js';

export { html, render, useState, useEffect, useRef, useMemo, useCallback };

// 스토어 구독 훅: 원격/로컬 변경 시 다시 그림
export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => db.subscribe(() => setTick((t) => t + 1)), []);
  return db.getState();
}

// 화면 크기 훅 (폰/아이패드 레이아웃 전환)
export function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, [query]);
  return m;
}
export const usePhone = () => useMedia('(max-width: 700px)');

// 세그먼트 탭 (폰에서 스크롤 대신 화면 나눠 보기)
export function Seg({ items, value, onChange, cls = '' }) {
  return html`<div class=${'seg ' + cls}>${items.map((it) => html`<button key=${it.id} class=${value === it.id ? 'on' : ''} onClick=${() => onChange(it.id)}>${it.label}${it.badge ? html` <span class="badge accent" style="height:18px;padding:0 6px">${it.badge}</span>` : ''}</button>`)}</div>`;
}

export function Icon({ name, size = 20, stroke = 2, cls = '' }) {
  const inner = ICONS[name] || ICONS['circle-help'];
  return html`<svg class=${'ic ' + cls} xmlns="http://www.w3.org/2000/svg" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML=${{ __html: inner }}></svg>`;
}

export function Emo({ name, size = 28, cls = '', style = '' }) {
  return html`<img class=${cls} src=${E(name)} alt="" width=${size} height=${size} loading="lazy" style=${style} />`;
}

export function Ring({ pct = 0, size = 120, stroke = 12, color = 'var(--accent)', track = 'var(--surface-2)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return html`<div class="ring" style=${`width:${size}px;height:${size}px`}>
    <svg width=${size} height=${size}>
      <circle cx=${size / 2} cy=${size / 2} r=${r} stroke=${track} stroke-width=${stroke} fill="none" />
      <circle cx=${size / 2} cy=${size / 2} r=${r} stroke=${color} stroke-width=${stroke} fill="none" stroke-linecap="round"
        stroke-dasharray=${c} stroke-dashoffset=${off} style="transition: stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" />
    </svg>
    <div class="ring-label">${children}</div>
  </div>`;
}

export function Bar({ pct = 0, kind = '' }) {
  return html`<div class=${'bar ' + kind}><i style=${`width:${Math.max(0, Math.min(100, pct))}%`}></i></div>`;
}

export function Modal({ title, onClose, wide = false, children, icon }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose && onClose()}>
    <div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-label=${title}>
      <div class="modal-h">
        ${icon && html`<${Emo} name=${icon} size=${34} />`}
        <h3>${title}</h3>
        ${onClose && html`<button class="icon-btn sm" aria-label="닫기" onClick=${onClose}><${Icon} name="x" size=${18} /></button>`}
      </div>
      ${children}
    </div>
  </div>`;
}

// ---------- Toast ----------
let toastSetter = null;
export function toast(msg, emoji = 'Sparkles', ms = 2600) {
  if (!toastSetter) return;
  const id = Math.random();
  toastSetter((l) => [...l, { id, msg, emoji }]);
  setTimeout(() => toastSetter((l) => l.filter((t) => t.id !== id)), ms);
}
export function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => { toastSetter = setList; return () => { toastSetter = null; }; }, []);
  return html`<div class="toasts" aria-live="polite">${list.map((t) => html`<div class="toast" key=${t.id}><${Emo} name=${t.emoji} size=${30} /><span>${t.msg}</span></div>`)}</div>`;
}

export function celebrate(power = 1) {
  try {
    const colors = ['#7C3AED', '#EC4899', '#F59E0B', '#22C55E', '#0EA5E9'];
    confetti({ particleCount: Math.round(80 * power), spread: 70 + 20 * power, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
    if (power > 1) {
      setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }), 200);
      setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }), 350);
    }
  } catch (_) {}
}

export function TalentPill({ value }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) { setBump(true); const t = setTimeout(() => setBump(false), 500); prev.current = value; return () => clearTimeout(t); }
  }, [value]);
  return html`<span class="pill-talent num" style=${bump ? 'transform:scale(1.12);transition:transform .2s' : 'transition:transform .3s'} title="내 달란트">
    <${Emo} name="Coin" size=${30} />${value}
  </span>`;
}

export function SyncBadge() {
  useStore();
  const s = db.getStatus();
  const label = { online: '실시간 동기화', connecting: '연결 중…', offline: '오프라인 (자동 재전송)', denied: '접근 거부' }[s.status] || s.status;
  return html`<span class=${'sync ' + s.status} title="가족 기기 간 실시간 동기화 상태"><i></i>${label}${s.pending ? ` · 대기 ${s.pending}` : ''}</span>`;
}

export function Empty({ emoji = 'Sparkles', title, sub, children }) {
  return html`<div class="empty"><${Emo} name=${emoji} size=${64} /><div class="bold" style="color:var(--text-2)">${title}</div>${sub && html`<div class="small">${sub}</div>`}${children}</div>`;
}

export const SUBJECT_COLORS = {
  수학: ['#EEF2FF', '#4338CA'], 영어: ['#ECFEFF', '#0E7490'], 국어: ['#FFF1F2', '#BE123C'], 과학: ['#F0FDF4', '#15803D'],
  사회: ['#FFF7ED', '#C2410C'], 생활: ['#F5F3FF', '#6D28D9'], 영단어: ['#EFF6FF', '#1D4ED8'], 학습지: ['#FEFCE8', '#A16207'], 숙제: ['#F1F5F9', '#334155']
};
export function Subj({ s }) {
  const [bg, fg] = SUBJECT_COLORS[s] || ['#F1F5F9', '#334155'];
  return html`<span class="subj" style=${`background:${bg};color:${fg}`}>${s}</span>`;
}
export function Reward({ n }) {
  return html`<span class="reward"><${Emo} name="Coin" size=${18} />+${n}</span>`;
}
