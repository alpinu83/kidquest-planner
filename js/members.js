// 가족 구성원 식별 (비밀번호 없이 기기마다 "나"를 기억) · 프로필 사진 · 가족톡 읽음 상태
import * as db from './store.js';
import * as M from './model.js';
import { E, uid } from './util.js';
import { KID_COLORS } from '../data/presets.js';

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
  if (!k) return { id, name: id, emo: 'Egg', img: E('Egg'), color: '#64748B', soft: '#F1F5F9' };
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

// ---------- 가족톡 푸시 알림 (ntfy · 보낸 사람 빼고 나머지 가족에게) ----------
// 각자 폰·패드의 무료 ntfy 앱에서 자기 토픽을 구독하면, 앱이 꺼져 있어도 바로 알림이 와요.
export function talkPushCfg(id) {
  return ((((db.getState().settings || {}).talkPush) || {})[id]) || {};
}
function randHex(n) {
  const a = new Uint8Array(n);
  try { crypto.getRandomValues(a); } catch (_) { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
  return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function ensureTalkTopics() {
  const s = (db.getState().settings || {}).talkPush || {};
  const add = {};
  for (const id of memberIds()) if (!s[id] || !s[id].topic) add[id] = { topic: `kq-talk-${id}-${randHex(5)}`, enabled: true };
  if (Object.keys(add).length) db.update('settings/talkPush', add);
}
export function talkLink(id) {
  const base = location.origin + location.pathname;
  return isParentId(id) ? `${base}#/parent/talk` : `${base}#/kid/${id}/talk`;
}
export function notifyOthers(me, payload) {
  const from = memberInfo(me).name;
  const body = payload.sticker ? '(스티커)' : String(payload.text || '').slice(0, 300);
  for (const id of memberIds()) {
    if (id === me) continue;
    const cfg = talkPushCfg(id);
    if (!cfg.topic || cfg.enabled === false) continue;
    const q = `title=${encodeURIComponent('가족톡 · ' + from)}&tags=speech_balloon&click=${encodeURIComponent(talkLink(id))}`;
    try { fetch(`https://ntfy.sh/${cfg.topic}?${q}`, { method: 'POST', body }).catch(() => {}); } catch (_) {}
  }
}

// ---------- 앱 아이콘 숫자 (배지) ----------
export const badgeSupported = () => typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
export function notifPermission() {
  try { return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission; } catch (_) { return 'unsupported'; }
}
export async function enableBadge() {
  try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission(); } catch (_) {}
  return notifPermission();
}
