// KidQuest 2.1 — 앱 진입점 (라우팅 · 가족 연결 · "누구세요?" 구성원 선택 · 부모 PIN · 가족톡 알림)
import { html, render, useState, useEffect, useRef, useStore, Icon, Modal, Toasts, toast, SyncBadge } from './ui/core.js';
import { KidApp } from './ui/kid.js';
import { ParentApp } from './ui/parent.js';
import { PetStage } from './ui/pet.js';
import { Avatar } from './ui/talk.js';
import * as db from './store.js';
import * as M from './model.js';
import { getMe, setMe, isParentId, parentDeviceOk, rememberParentDevice, memberInfo, unreadCount, talkMsgs, PARENTS } from './members.js';
import { createSeed, KID_COLORS } from '../data/presets.js';
import { E } from './util.js';
import { APP_VERSION } from './config.js';

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('family=')) return { name: 'picker' };
  const [a, b, c] = h.split('/');
  if (a === 'kid' && b) return { name: 'kid', kid: b, tab: c || 'home' };
  if (a === 'parent') return { name: 'parent', sec: b || 'overview' };
  return { name: 'picker' };
}
function go(path) {
  location.hash = path;
}
const parentUnlocked = () => sessionStorage.getItem('kq2_parent') === '1' || parentDeviceOk();

// 앱을 처음 열 때 이 기기의 "나"로 바로 들어가기 (전환 버튼으로 오면 선택 화면 유지)
let booted = false;

function App() {
  const state = useStore();
  const [route, setRoute] = useState(parseRoute());
  const [pinFor, setPinFor] = useState(null);
  const fam = db.getFamily();
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const st = db.getStatus();
  const ready = !!(fam && st.loaded && state.kids);
  useEffect(() => {
    if (!ready || booted) return;
    booted = true;
    const me = getMe();
    if (route.name !== 'picker' || !me) return;
    if (isParentId(me) && parentUnlocked()) go('/parent');
    else if (!isParentId(me) && M.getKid(me)) go(`/kid/${me}/home`);
  }, [ready]);

  const me = getMe();
  const unread = ready ? unreadCount(me) : 0;
  useNewMessageToast(ready, me, route);
  useEffect(() => {
    try {
      if ('setAppBadge' in navigator) unread > 0 ? navigator.setAppBadge(unread) : navigator.clearAppBadge();
    } catch (_) {}
  }, [unread]);

  if (!fam) return html`<${JoinScreen} /><${Toasts} />`;
  if (!st.loaded) return html`<div class="picker"><div style="text-align:center"><img src=${E('Egg')} width="96" height="96" style="animation:wobble 1.6s infinite" alt="" /><div class="bold" style="margin-top:10px">가족 데이터 불러오는 중…</div><div class="small muted">${st.status === 'denied' ? '가족 코드가 올바르지 않아요' : '처음 한 번만 조금 걸려요'}</div></div></div>`;
  if (!state.kids) return html`<${JoinScreen} empty=${true} /><${Toasts} />`;

  const askParent = (who) => {
    if (parentUnlocked()) { if (who) setMe(who); go('/parent'); }
    else setPinFor(who || 'any');
  };
  let view;
  if (route.name === 'kid') view = html`<${KidApp} kidId=${route.kid} tab=${route.tab} setTab=${(t) => go(`/kid/${route.kid}/${t}`)} onExit=${() => go('/')} onParent=${() => askParent(null)} />`;
  else if (route.name === 'parent' && parentUnlocked()) view = html`<${ParentApp} sec=${route.sec} setSec=${(s) => go(`/parent/${s}`)} onExit=${() => { sessionStorage.removeItem('kq2_parent'); go('/'); }} />`;
  else view = html`<${Picker} onKid=${(id) => { setMe(id); go(`/kid/${id}/home`); }} onParent=${askParent} />`;

  return html`${view}
    ${pinFor && html`<${PinModal} onClose=${() => setPinFor(null)} onOk=${(remember) => {
      sessionStorage.setItem('kq2_parent', '1');
      if (remember) {
        rememberParentDevice();
        if (pinFor !== 'any') setMe(pinFor);
      } else if (pinFor !== 'any') sessionStorage.setItem('kq2_parent_me', pinFor);
      setPinFor(null);
      go('/parent');
    }} />`}
    <${Toasts} />`;
}

// 다른 화면에 있을 때 새 가족톡 메시지가 오면 살짝 알려주기
function useNewMessageToast(ready, me, route) {
  const seen = useRef(0);
  const msgs = ready ? talkMsgs() : [];
  const last = msgs[msgs.length - 1];
  useEffect(() => {
    if (!ready || !last) return;
    if (!seen.current) { seen.current = last.ts; return; }
    if (last.ts <= seen.current) return;
    seen.current = last.ts;
    const inTalk = (route.name === 'kid' && route.tab === 'talk') || (route.name === 'parent' && route.sec === 'talk');
    if (last.by === me || inTalk || !me) return;
    const who = memberInfo(last.by);
    toast(`${who.name}: ${last.sticker ? '스티커를 보냈어요' : String(last.text || '').slice(0, 40)}`, who.emo, 3500);
  }, [ready, last && last.ts]);
}

function Picker({ onKid, onParent }) {
  const kids = M.kidsList();
  const me = getMe();
  return html`<div class="picker">
    <div class="picker-inner fade-in">
      <h1 class="picker-title"><span class="brand-mark"><${Icon} name="sparkles" size=${20} /></span>KidQuest</h1>
      <div class="kid-cards">
        ${kids.map((k) => {
          const pet = M.activePet(k);
          const c = KID_COLORS.find((x) => x.id === k.profile.colorId) || KID_COLORS[0];
          return html`<button key=${k.id} class="kid-card" style=${`background:radial-gradient(120% 120% at 100% 0%,rgba(255,255,255,.25),transparent 50%),linear-gradient(135deg,${c.color},${c.id === 'sky' ? '#22D3EE' : '#EC4899'})`} onClick=${() => onKid(k.id)}>
            <div class="eyebrow" style="color:rgba(255,255,255,.8)">${k.profile.grade}학년${me === k.id ? ' · 이 기기' : ''}</div>
            <h2>${k.profile.name}</h2>
            <div class="kc-pet">${pet && html`<${PetStage} pet=${pet} mood=${M.petMood(pet)} showBubble=${false} />`}</div>
            <div class="kc-stats">
              <span class="kc-stat"><img src=${E('Coin')} alt="" />${M.talentBalance(k)}</span>
              <span class="kc-stat"><img src=${E('Fire')} alt="" />${M.streakOf(k)}일</span>
            </div>
          </button>`;
        })}
      </div>
      <div class="parent-tiles">
        ${PARENTS.map((p) => {
          const m = memberInfo(p.id);
          return html`<button key=${p.id} class="parent-tile" onClick=${() => onParent(p.id)}>
            <${Avatar} id=${p.id} size=${52} />
            <div style="text-align:left"><b>${m.name}</b><div class="tiny muted">${me === p.id ? '이 기기 · ' : ''}부모 관리 · 가족톡</div></div>
          </button>`;
        })}
      </div>
    </div>
    <div class="corner-status"><${SyncBadge} /><span>v${APP_VERSION}</span></div>
  </div>`;
}

function PinModal({ onClose, onOk }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  // 아이 기기(이 기기의 "나"가 아이)에서는 기본으로 기억하지 않음
  const [remember, setRemember] = useState(!getMe() || isParentId(getMe()));
  const pin = M.settings().pin || '1234';
  function press(d) {
    const nv = (v + d).slice(0, 4);
    setV(nv);
    if (nv.length === 4) {
      if (nv === pin) onOk(remember);
      else { setErr(true); setTimeout(() => { setV(''); setErr(false); }, 500); }
    }
  }
  return html`<${Modal} title="부모 확인" icon="Locked" onClose=${onClose}>
    <div class="muted small" style="text-align:center">부모님 PIN 4자리를 입력하세요${pin === '1234' ? ' (초기값 1234)' : ''}</div>
    <div class="pin-dots" style=${err ? 'animation:shake .4s' : ''}>${[0, 1, 2, 3].map((i) => html`<i class=${i < v.length ? 'on' : ''}></i>`)}</div>
    <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button onClick=${() => press(String(n))}>${n}</button>`)}<span></span><button onClick=${() => press('0')}>0</button><button onClick=${() => setV(v.slice(0, -1))}><${Icon} name="undo-2" /></button></div>
    <label class="row small" style="justify-content:center;margin-top:12px"><input type="checkbox" checked=${remember} onChange=${(e) => setRemember(e.target.checked)} />부모님 기기예요 · 다음부터 PIN 묻지 않기</label>
  <//>`;
}

function JoinScreen({ empty = false }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  async function join() {
    const c = code.trim().replace(/^.*family=/, '');
    if (c.length < 24) return toast('가족 코드가 너무 짧아요', 'Thinking face');
    setBusy(true);
    try {
      if (!(await db.familyExists(c))) { toast('해당 가족을 찾을 수 없어요', 'Thinking face'); setBusy(false); return; }
      db.setFamily(c);
      location.reload();
    } catch (e) { toast('연결 실패: ' + e.message, 'Thinking face'); setBusy(false); }
  }
  async function create() {
    setBusy(true);
    try {
      const arr = new Uint8Array(12);
      crypto.getRandomValues(arr);
      const c = 'kq-' + Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
      await db.createFamily(c, createSeed());
      location.reload();
    } catch (e) { toast(e.message, 'Thinking face'); setBusy(false); }
  }
  return html`<div class="picker"><div class="card" style="width:min(520px,100%);text-align:center">
    <img src=${E('Egg')} width="88" height="88" alt="" />
    <h2 style="font-size:26px;font-weight:900;margin-top:6px">KidQuest 가족 연결</h2>
    <p class="muted" style="margin:6px 0 16px">부모님이 보내 준 연결 링크를 열거나, 가족 코드를 붙여넣으세요.${empty ? ' (가족 데이터가 비어 있어요)' : ''}</p>
    <div class="row"><input class="input" placeholder="가족 코드 또는 링크" value=${code} onInput=${(e) => setCode(e.target.value)} /><button class="btn primary" disabled=${busy} onClick=${join}>연결</button></div>
    <hr class="sep" />
    <button class="btn" disabled=${busy} onClick=${create}><${Icon} name="plus" size=${18} />새 가족 공간 만들기</button>
  </div></div>`;
}

window.KQ = { db, M };
db.connect();
render(html`<${App} />`, document.getElementById('app'));
