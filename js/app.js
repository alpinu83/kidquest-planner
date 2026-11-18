// KidQuest 2.0 — 앱 진입점 (라우팅 · 가족 연결 · 프로필 선택 · 부모 PIN)
import { html, render, useState, useEffect, useStore, Icon, Emo, Modal, Toasts, toast, TalentPill, SyncBadge } from './ui/core.js';
import { KidApp } from './ui/kid.js';
import { ParentApp } from './ui/parent.js';
import { PetStage, petDisplayName } from './ui/pet.js';
import * as db from './store.js';
import * as M from './model.js';
import { createSeed, KID_COLORS } from '../data/presets.js';
import { STAGES } from '../data/pets.js';
import { E } from './util.js';
import { APP_VERSION } from './config.js';

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('family=')) return { name: 'picker' };
  const [a, b, c] = h.split('/');
  if (a === 'kid' && b) return { name: 'kid', kid: b, tab: c || 'home' };
  if (a === 'parent') return { name: 'parent' };
  return { name: 'picker' };
}
function go(path) {
  location.hash = path;
}

function App() {
  const state = useStore();
  const [route, setRoute] = useState(parseRoute());
  const [pinFor, setPinFor] = useState(false);
  const fam = db.getFamily();
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (!fam) return html`<${JoinScreen} /><${Toasts} />`;
  const st = db.getStatus();
  if (!st.loaded) return html`<div class="picker"><div style="text-align:center"><img src=${E('Egg')} width="96" height="96" style="animation:wobble 1.6s infinite" alt="" /><div class="bold" style="margin-top:10px">가족 데이터 불러오는 중…</div><div class="small muted">${st.status === 'denied' ? '가족 코드가 올바르지 않아요' : '처음 한 번만 조금 걸려요'}</div></div></div>`;
  if (!state.kids) return html`<${JoinScreen} empty=${true} /><${Toasts} />`;

  const unlocked = sessionStorage.getItem('kq2_parent') === '1';
  let view;
  if (route.name === 'kid') view = html`<${KidApp} kidId=${route.kid} tab=${route.tab} setTab=${(t) => go(`/kid/${route.kid}/${t}`)} onExit=${() => go('/')} onParent=${() => (unlocked ? go('/parent') : setPinFor(true))} />`;
  else if (route.name === 'parent' && unlocked) view = html`<${ParentApp} onExit=${() => { sessionStorage.removeItem('kq2_parent'); go('/'); }} />`;
  else view = html`<${Picker} onParent=${() => (unlocked ? go('/parent') : setPinFor(true))} />`;

  return html`${view}
    ${pinFor && html`<${PinModal} onClose=${() => setPinFor(false)} onOk=${() => { sessionStorage.setItem('kq2_parent', '1'); setPinFor(false); go('/parent'); }} />`}
    <${Toasts} />`;
}

function Picker({ onParent }) {
  const kids = M.kidsList();
  return html`<div class="picker">
    <div class="picker-inner fade-in">
      <div style="display:flex;justify-content:center;margin-bottom:10px"><${SyncBadge} /></div>
      <h1>오늘은 누가 모험을 떠날까요?</h1>
      <p class="lead">미션을 완료하고 달란트를 모아 나만의 펫을 전설로 키워 보세요</p>
      <div class="kid-cards">
        ${kids.map((k) => {
          const pet = M.activePet(k);
          const c = KID_COLORS.find((x) => x.id === k.profile.colorId) || KID_COLORS[0];
          return html`<button key=${k.id} class="kid-card" style=${`background:radial-gradient(120% 120% at 100% 0%,rgba(255,255,255,.25),transparent 50%),linear-gradient(135deg,${c.color},${c.id === 'sky' ? '#22D3EE' : '#EC4899'})`} onClick=${() => go(`/kid/${k.id}/home`)}>
            <div class="eyebrow" style="color:rgba(255,255,255,.8)">${k.profile.grade}학년</div>
            <h2>${k.profile.name}</h2>
            <div style="opacity:.9;font-weight:600;position:relative;z-index:2">${pet ? `${petDisplayName(pet)} · ${pet.xp >= 720 ? '전설' : STAGES[pet.stage].name}` : ''}</div>
            <div class="kc-pet">${pet && html`<${PetStage} pet=${pet} mood=${M.petMood(pet)} showBubble=${false} />`}</div>
            <div class="kc-stats">
              <span class="kc-stat"><img src=${E('Coin')} alt="" />${M.talentBalance(k)}</span>
              <span class="kc-stat"><img src=${E('Fire')} alt="" />${M.streakOf(k)}일</span>
              <span class="kc-stat"><img src=${E('Trophy')} alt="" />전설 ${M.petsOf(k).filter((p) => p.xp >= 720).length}</span>
            </div>
          </button>`;
        })}
      </div>
      <div class="parent-entry"><button class="btn lg" onClick=${onParent}><${Icon} name="shield-check" />부모 관리 · 대시보드</button></div>
      <div class="tiny muted" style="text-align:center;margin-top:18px">KidQuest ${APP_VERSION} · 3D 이모지 Microsoft Fluent Emoji(MIT) · Preact · Lucide · Pretendard</div>
    </div>
  </div>`;
}

function PinModal({ onClose, onOk }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const pin = M.settings().pin || '1234';
  function press(d) {
    const nv = (v + d).slice(0, 4);
    setV(nv);
    if (nv.length === 4) {
      if (nv === pin) onOk();
      else { setErr(true); setTimeout(() => { setV(''); setErr(false); }, 500); }
    }
  }
  return html`<${Modal} title="부모 확인" icon="Locked" onClose=${onClose}>
    <div class="muted small" style="text-align:center">부모님 PIN 4자리를 입력하세요${pin === '1234' ? ' (초기값 1234 · 설정에서 꼭 바꿔 주세요)' : ''}</div>
    <div class="pin-dots" style=${err ? 'animation:shake .4s' : ''}>${[0, 1, 2, 3].map((i) => html`<i class=${i < v.length ? 'on' : ''}></i>`)}</div>
    <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => html`<button onClick=${() => press(String(n))}>${n}</button>`)}<span></span><button onClick=${() => press('0')}>0</button><button onClick=${() => setV(v.slice(0, -1))}><${Icon} name="undo-2" /></button></div>
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
