// 가족 구성원 식별 (비밀번호 없이 기기마다 "나"를 기억) · 프로필 사진 · 가족톡 읽음 상태
import * as db from './store.js';
import * as M from './model.js';
import { E, uid } from './util.js';
import { KID_COLORS } from '../data/presets.js';
import { PUSH_URL, VAPID_PUBLIC } from './config.js';

export const PARENTS = [
  { id: 'dad', defName: '아빠', defAvatar: 'Polar bear', color: '#2563EB', soft: '#DBEAFE' },
  { id: 'mom', defName: '엄마', defAvatar: 'Rabbit face', color: '#DB2777', soft: '#FCE7F3' }
];
// 엄마·아빠 프로필로 고를 수 있는 캐릭터 (assets/emoji 에 있는 Fluent 3D 이모지)
export const PARENT_AVATARS = [
  'Polar bear', 'Rabbit face', 'Tiger face', 'Dog face', 'Cat face', 'Panda', 'Owl', 'Penguin', 'Lion', 'Wolf',
  'Dolphin', 'Spouting whale', 'Teddy bear', 'Octopus', 'Parrot', 'Seal', 'Unicorn', 'Horse face', 'Eagle', 'Sun',
  'Crescent moon', 'Cherry blossom', 'Hot beverage', 'Crown'
];

const LS_ME = 'kq2_me';
const LS_PARENT_OK = 'kq2_parent_ok';
export function getMe() {
  try { return localStorage.getItem(LS_ME) || null; } catch (_) { return null; }
}
export function setMe(id) {
  try { id ? localStorage.setItem(LS_ME, id) : localStorage.removeItem(LS_ME); } catch (_) {}
  if (id) syncPush(id);
}
export const isParentId = (id) => id === 'dad' || id === 'mom';
// 부모 PIN은 그 기기에서 한 번만 확인하고 기억 (아이 패드에는 기록이 없으니 그대로 보호됨)
export function parentDeviceOk() {
  try { return localStorage.getItem(LS_PARENT_OK) === '1'; } catch (_) { return false; }
}
export function rememberParentDevice() {
  try { localStorage.setItem(LS_PARENT_OK, '1'); } catch (_) {}
}

export function memberInfo(id) {
  if (isParentId(id)) {
    const p = PARENTS.find((x) => x.id === id);
    const cfg = (((db.getState().settings || {}).members) || {})[id] || {};
    const emo = cfg.avatar || p.defAvatar;
    return { id, name: cfg.name || p.defName, emo, img: E(emo), color: p.color, soft: p.soft, parent: true };
  }
  const k = M.getKid(id);
  if (!k || !k.profile) return { id, name: id, emo: 'Egg', img: E('Egg'), color: '#64748B', soft: '#F1F5F9' };
  const pet = M.activePet(k);
  const c = KID_COLORS.find((x) => x.id === k.profile.colorId) || KID_COLORS[0];
  const emo = pet ? pet.species.forms[Math.min(pet.stage, pet.species.forms.length - 1)] : 'Egg';
  return { id, name: k.profile.name, emo, img: E(emo), color: c.color, soft: c.soft, kid: true, pet };
}
export function memberIds() {
  return [...M.kidsList().map((k) => k.id), ...PARENTS.map((p) => p.id)];
}

// ---------- 가족톡 ----------
const MAX_MSGS = 300;
export function talkMsgs() {
  return Object.values(((db.getState().talk || {}).msgs) || {}).filter((m) => m && m.ts).sort((a, b) => a.ts - b.ts);
}
export function lastRead(id) {
  return Number((((db.getState().talk || {}).reads) || {})[id] || 0);
}
export function unreadCount(me) {
  if (!me) return 0;
  const lr = lastRead(me);
  let n = 0;
  for (const m of talkMsgs()) if (m.by !== me && m.ts > lr) n++;
  return n;
}
export function markRead(me) {
  if (!me) return;
  const msgs = talkMsgs();
  const last = msgs.length ? msgs[msgs.length - 1].ts : 0;
  if (last > lastRead(me)) db.set(`talk/reads/${me}`, last);
}
export function sendTalk(me, payload) {
  const id = uid('m');
  const ts = Math.max(Date.now(), (talkMsgs().slice(-1)[0]?.ts || 0) + 1);
  const updates = {
    [`talk/msgs/${id}`]: { id, by: me, ts, ...payload },
    [`talk/reads/${me}`]: ts
  };
  const all = talkMsgs();
  if (all.length >= MAX_MSGS) all.slice(0, all.length - MAX_MSGS + 1).forEach((m) => { updates[`talk/msgs/${m.id}`] = null; });
  db.multi(updates);
  notifyOthers(me, payload);
}
// 메시지별 안 읽은 사람 수 (카톡의 노란 숫자)
export function unreadReaders(msg, ids = memberIds()) {
  let n = 0;
  for (const id of ids) if (id !== msg.by && lastRead(id) < msg.ts) n++;
  return n;
}

// ---------- 앱 푸시 알림 (Web Push · Cloudflare Worker 발송) ----------
// 알림을 허용한 기기마다 구독 정보를 가족 데이터(pushSubs)에 저장하고, 톡을 보내면 발송기가 다른 가족 기기로 알림을 보냅니다.
function randHex(n) {
  const a = new Uint8Array(n);
  try { crypto.getRandomValues(a); } catch (_) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const LS_DEV = 'kq2_device';
export function deviceId() {
  try {
    let d = localStorage.getItem(LS_DEV);
    if (!d) { d = 'd' + randHex(8); localStorage.setItem(LS_DEV, d); }
    return d;
  } catch (_) { return 'd-unknown'; }
}
export const appBase = () => location.origin + location.pathname;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
export const pushSupported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && typeof Notification !== 'undefined';
export function notifPermission() {
  try { return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission; } catch (_) { return 'unsupported'; }
}
function deviceLabel() {
  const u = navigator.userAgent;
  if (/iPad/.test(u) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(u)) return 'iPhone';
  if (/Android/.test(u)) return /Mobile/.test(u) ? 'Android 폰' : 'Android 태블릿';
  if (/Mac/.test(u)) return 'Mac';
  if (/Windows/.test(u)) return 'PC';
  return '기기';
}
function urlB64ToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
function saveSub(member, sub) {
  const j = sub.toJSON();
  db.set(`pushSubs/${deviceId()}`, { member, endpoint: j.endpoint, keys: j.keys, ua: deviceLabel(), ts: Date.now() });
}
// 알림 켜기: 반드시 버튼을 눌렀을 때 호출 (iOS는 홈 화면에 추가한 앱에서만 가능)
export async function enablePush(member) {
  if (!pushSupported()) return { ok: false, reason: isIOS() && !isStandalone() ? 'ios-home' : 'unsupported' };
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: perm };
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(VAPID_PUBLIC) });
    saveSub(member, sub);
    return { ok: true };
  } catch (e) { return { ok: false, reason: 'error', msg: String(e && e.message || e) }; }
}
// 이 기기의 사용자(나)가 바뀌었거나 구독 주소가 바뀌었으면 갱신
export async function syncPush(member) {
  try {
    if (!member || !pushSupported() || Notification.permission !== 'granted' || !db.getFamily()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const cur = ((db.getState().pushSubs) || {})[deviceId()];
    if (!cur || cur.endpoint !== sub.endpoint || cur.member !== member) saveSub(member, sub);
  } catch (_) {}
}
export async function disablePush() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (_) {}
  db.remove(`pushSubs/${deviceId()}`);
}
export function pushDevices() {
  return Object.entries((db.getState().pushSubs) || {}).filter(([, s]) => s && s.endpoint).map(([id, s]) => ({ id, ...s }));
}
export const thisDevicePush = () => ((db.getState().pushSubs) || {})[deviceId()] || null;
function post(body) {
  return fetch(PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ family: db.getFamily(), base: appBase(), ...body }), keepalive: true });
}
export async function testPush() {
  try { const r = await post({ kind: 'test', deviceId: deviceId() }); return await r.json(); } catch (e) { return { error: String(e) }; }
}
// 톡을 보낸 뒤: 서버에 저장이 끝나면(최대 4초 대기) 다른 가족에게 알림
export function notifyOthers(me, payload) {
  const text = payload.sticker ? '(스티커)' : String(payload.text || '').slice(0, 300);
  const t0 = Date.now();
  const go = () => {
    const st = db.getStatus();
    if (st.pending > 0 && Date.now() - t0 < 4000) return setTimeout(go, 250);
    post({ kind: 'talk', from: me, fromName: memberInfo(me).name, text }).catch(() => {});
  };
  setTimeout(go, 150);
}
