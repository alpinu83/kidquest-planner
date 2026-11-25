// 실시간 가족 동기화 스토어
// - Firebase Realtime Database REST + Server-Sent Events(EventSource) 스트리밍 (SDK 불필요)
// - 낙관적 로컬 반영 → 오프라인 큐 저장 → 연결되면 자동 전송
// - 경로 단위 쓰기라서 여러 기기가 동시에 서로 다른 항목을 바꿔도 충돌 없이 합쳐집니다.
import { DB_URL } from './config.js';

const LS_FAMILY = 'kq2_family';
const cacheKey = (f) => `kq2_cache_${f}`;
const queueKey = (f) => `kq2_queue_${f}`;

let family = null;
let state = {};
let queue = [];
let es = null;
let status = 'offline'; // offline | connecting | online | denied
let loaded = false;
let flushing = false;
let flushTimer = null;
let retryDelay = 1500;
let lastRemoteAt = 0;
const listeners = new Set();

export function getFamily() {
  if (family) return family;
  try {
    const fromHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('family');
    if (fromHash && fromHash.length >= 24) {
      localStorage.setItem(LS_FAMILY, fromHash);
      history.replaceState(null, '', location.pathname + location.search);
    }
    family = localStorage.getItem(LS_FAMILY);
  } catch (_) {}
  return family;
}

export function setFamily(code) {
  family = code;
  localStorage.setItem(LS_FAMILY, code);
}

export function leaveFamily() {
  try { localStorage.removeItem(LS_FAMILY); } catch (_) {}
  queue = [];
  if (es) es.close();
  family = null;
  state = {};
  loaded = false;
  emit();
}

export const getState = () => state;
export const getStatus = () => ({ status, pending: queue.length, loaded, lastRemoteAt });
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let emitScheduled = false;
function emit() {
  if (emitScheduled) return;
  emitScheduled = true;
  setTimeout(() => {
    emitScheduled = false;
    listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  }, 16);
  scheduleCacheSave();
}

let cacheTimer = null;
function scheduleCacheSave() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    try { localStorage.setItem(cacheKey(family), JSON.stringify(state)); } catch (_) {}
  }, 800);
}
function saveQueue() {
  try { localStorage.setItem(queueKey(family), JSON.stringify(queue)); } catch (_) {}
}

// ---------- 트리 유틸 ----------
const splitPath = (p) => String(p).split('/').filter(Boolean);
export function getAt(path, obj = state) {
  let cur = obj;
  for (const k of splitPath(path)) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}
function setAt(root, path, value) {
  const parts = splitPath(path);
  if (parts.length === 0) return value == null ? {} : clone(value);
  let cur = root;
  const chain = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] == null || typeof cur[k] !== 'object') {
      if (value == null) return root;
      cur[k] = {};
    }
    chain.push([cur, k]);
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  if (value == null) {
    delete cur[last];
    // 빈 부모 정리 (Firebase와 동일한 동작)
    for (let i = chain.length - 1; i >= 0; i--) {
      const [p, k] = chain[i];
      if (p[k] && typeof p[k] === 'object' && Object.keys(p[k]).length === 0) delete p[k];
      else break;
    }
  } else {
    cur[last] = clone(value);
  }
  return root;
}
const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

function applyOp(op) {
  if (op.op === 'set') state = setAt(state, op.path, op.value);
  else if (op.op === 'update') {
    for (const [k, v] of Object.entries(op.value)) state = setAt(state, `${op.path}/${k}`, v);
  }
}

// ---------- 쓰기 API ----------
export function set(path, value) {
  const op = { op: 'set', path, value: value === undefined ? null : clone(value) };
  applyOp(op);
  queue.push(op);
  saveQueue();
  emit();
  scheduleFlush();
}
export function update(path, obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) clean[k] = v === undefined ? null : clone(v);
  const op = { op: 'update', path, value: clean };
  applyOp(op);
  queue.push(op);
  saveQueue();
  emit();
  scheduleFlush();
}
export const remove = (path) => set(path, null);

// 여러 경로를 한 번에 (원자적 다중 경로 업데이트)
export function multi(map) {
  const op = { op: 'update', path: '', value: {} };
  for (const [k, v] of Object.entries(map)) op.value[k.replace(/^\//, '')] = v === undefined ? null : clone(v);
  applyOp(op);
  queue.push(op);
  saveQueue();
  emit();
  scheduleFlush();
}

function scheduleFlush(delay = 60) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, delay);
}

function opsToEntries(op) {
  if (op.op === 'set') return [[op.path, op.value]];
  return Object.entries(op.value).map(([k, v]) => [op.path ? `${op.path}/${k}` : k, v]);
}
const overlaps = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');

async function flush() {
  if (flushing || !family || queue.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    while (queue.length) {
      // 겹치지 않는 경로끼리 묶어서 하나의 PATCH로 전송
      const batch = {};
      let count = 0;
      for (const op of queue) {
        const entries = opsToEntries(op);
        const keys = Object.keys(batch);
        if (entries.some(([p]) => keys.some((k) => overlaps(k, p)))) break;
        if (entries.some(([p], i) => entries.some(([q], j) => i !== j && overlaps(p, q)))) {
          if (count > 0) break;
        }
        for (const [p, v] of entries) batch[p || '/'] = v;
        count++;
        if (count >= 40) break;
      }
      if (count === 0) count = 1;
      const single = count === 1 && queue[0].op === 'set';
      const url = single
        ? `${DB_URL}/families/${family}/${queue[0].path}.json`
        : `${DB_URL}/families/${family}.json`;
      const res = await fetch(url, {
        method: single ? 'PUT' : 'PATCH',
        body: JSON.stringify(single ? queue[0].value : batch)
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { status = 'denied'; emit(); throw new Error('HTTP ' + res.status); }
        // 잘못된 요청(400 등)은 다시 보내도 계속 실패하므로 버리고 다음 변경을 보냄 (큐 막힘 방지)
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          console.error('KidQuest: 전송 실패로 버린 변경', res.status, JSON.stringify(single ? queue[0] : batch).slice(0, 300));
          queue.splice(0, count);
          saveQueue();
          continue;
        }
        throw new Error('HTTP ' + res.status);
      }
      queue.splice(0, count);
      saveQueue();
    }
    retryDelay = 1500;
  } catch (e) {
    retryDelay = Math.min(retryDelay * 2, 30000);
    scheduleFlush(retryDelay);
  } finally {
    flushing = false;
    emit();
  }
}

// ---------- 실시간 수신 ----------
export function connect() {
  getFamily();
  if (!family) return;
  try {
    const cached = localStorage.getItem(cacheKey(family));
    if (cached && !loaded) {
      state = JSON.parse(cached) || {};
      loaded = true;
    }
    queue = JSON.parse(localStorage.getItem(queueKey(family)) || '[]');
    // 앱이 갑자기 꺼져 캐시에 반영 못 한 로컬 변경도 화면에 바로 보이게
    for (const op of queue) applyOp(op);
  } catch (_) {}
  emit();
  openStream();
  window.addEventListener('online', () => { openStream(); scheduleFlush(10); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // iPad 절전 후에는 연결이 '열림'으로 보여도 실제로 끊겨 있는 경우가 많아서 오래 조용했으면 다시 연결
      if (!es || es.readyState === 2 || Date.now() - lastRemoteAt > 60000) reopenStream();
      scheduleFlush(10);
    }
  });
  // 스트림이 조용히 끊긴 경우 대비 (Firebase는 30초마다 keep-alive를 보냄)
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (!es || es.readyState === 2 || (lastRemoteAt && Date.now() - lastRemoteAt > 90000)) reopenStream();
  }, 15000);
}

function reopenStream() {
  if (es) { try { es.close(); } catch (_) {} }
  es = null;
  openStream();
}
function openStream() {
  if (!family) return;
  if (es && es.readyState !== 2) return;
  status = 'connecting';
  emit();
  es = new EventSource(`${DB_URL}/families/${family}.json`);
  es.addEventListener('put', (e) => onRemote(e, 'put'));
  es.addEventListener('patch', (e) => onRemote(e, 'patch'));
  es.addEventListener('keep-alive', () => { lastRemoteAt = Date.now(); });
  es.addEventListener('cancel', () => { status = 'denied'; emit(); });
  es.onopen = () => { lastRemoteAt = Date.now(); status = 'online'; retryDelay = 1500; scheduleFlush(10); emit(); };
  es.onerror = () => {
    status = navigator.onLine === false ? 'offline' : 'connecting';
    emit();
  };
}

function onRemote(e, kind) {
  let msg;
  try { msg = JSON.parse(e.data); } catch (_) { return; }
  if (!msg) return;
  const { path, data } = msg;
  if (kind === 'put') {
    if (path === '/') state = data && typeof data === 'object' ? data : {};
    else state = setAt(state, path, data);
  } else {
    for (const [k, v] of Object.entries(data || {})) state = setAt(state, `${path}/${k}`.replace(/^\/+/, ''), v);
  }
  // 아직 전송되지 않은 로컬 변경을 다시 덮어씌움 (깜빡임 방지)
  for (const op of queue) applyOp(op);
  loaded = true;
  status = 'online';
  lastRemoteAt = Date.now();
  emit();
}

// ---------- 일회성 읽기/쓰기 (미디어 등 큰 데이터) ----------
export async function fetchOnce(path) {
  const res = await fetch(`${DB_URL}/families/${family}/${path}.json`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
export async function putMedia(id, dataUrl) {
  const res = await fetch(`${DB_URL}/media/${family}/${id}.json`, { method: 'PUT', body: JSON.stringify(dataUrl) });
  if (!res.ok) throw new Error('업로드 실패 (' + res.status + ')');
  return id;
}
const mediaCache = new Map();
export async function getMedia(id) {
  if (mediaCache.has(id)) return mediaCache.get(id);
  const p = fetch(`${DB_URL}/media/${family}/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  mediaCache.set(id, p);
  return p;
}
export async function deleteMedia(id) {
  mediaCache.delete(id);
  await fetch(`${DB_URL}/media/${family}/${id}.json`, { method: 'DELETE' }).catch(() => {});
}

export async function createFamily(code, seed) {
  const res = await fetch(`${DB_URL}/families/${code}.json`, { method: 'PUT', body: JSON.stringify(seed) });
  if (!res.ok) throw new Error('가족 공간을 만들지 못했어요 (' + res.status + ')');
  setFamily(code);
}
export async function familyExists(code) {
  const res = await fetch(`${DB_URL}/families/${code}/meta.json`);
  if (!res.ok) return false;
  const j = await res.json();
  return !!j;
}
