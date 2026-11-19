import { html, useState, useEffect, useMemo, Icon, Emo, Ring, Bar, Modal, toast, SyncBadge, Empty, Subj, Reward, TalentPill, Seg, usePhone } from './core.js';
import { TalkView, WhoAmIParent, Avatar, PushPanel } from './talk.js';
import { getMe, setMe, isParentId, unreadCount, memberInfo, PARENTS, PARENT_AVATARS, memberIds, pushDevices, deviceId } from '../members.js';
import { PetStage, petDisplayName } from './pet.js';
import { TaskList, DateNav } from './missions.js';
import { WeekGrid } from './kid.js';
import * as M from '../model.js';
import * as db from '../store.js';
import { STAGES } from '../../data/pets.js';
import { PRAISE_PRESETS, PENALTY_PRESETS, REWARDS } from '../../data/shop.js';
import { KOREAN_CITIES, KID_COLORS } from '../../data/presets.js';
import { VOCAB_LEVELS } from '../../data/vocab.js';
import { CATEGORIES } from '../../data/missions.js';
import { parseHomeworkText, runBrowserOcr } from '../ocr.js';
import { E, todayKey, addDays, DAY_NAMES, uid, timeAgo, shortDate, hhmm } from '../util.js';
import qrcode from '../../vendor/qrcode.js';

const SECTIONS = [
  { id: 'overview', label: '대시보드', short: '대시', icon: 'layout-dashboard' },
  { id: 'talk', label: '가족톡', short: '톡', icon: 'message-circle' },
  { id: 'homework', label: '숙제 관리', short: '숙제', icon: 'list-checks' },
  { id: 'talents', label: '달란트', short: '달란트', icon: 'coins' },
  { id: 'schedule', label: '시간표', short: '시간표', icon: 'calendar-days' },
  { id: 'vocab', label: '영단어', short: '단어', icon: 'languages' },
  { id: 'settings', label: '설정·기기 연결', short: '설정', icon: 'settings' }
];

// 부모 화면에서 가족톡에 쓸 "나" (아빠/엄마) — 기기에 기억된 값 또는 이번 세션 선택
function parentMe() {
  const me = getMe();
  if (isParentId(me)) return me;
  const s = sessionStorage.getItem('kq2_parent_me');
  return isParentId(s) ? s : null;
}

export function ParentApp({ sec = 'overview', setSec, onExit }) {
  if (!SECTIONS.some((s) => s.id === sec)) sec = 'overview';
  const kids = M.kidsList();
  const [kidId, setKidId] = useState(kids[0]?.id);
  const [me, setMeState] = useState(parentMe());
  const kid = M.getKid(kidId) || kids[0];
  const unread = me ? unreadCount(me) : 0;
  const pickMe = (id) => {
    const dev = getMe();
    if (!dev || isParentId(dev)) setMe(id); else sessionStorage.setItem('kq2_parent_me', id);
    setMeState(id);
  };
  const navBadge = (id) => id === 'talk' && unread > 0 ? html`<span class="badge bad">${unread}</span>` : null;

  return html`<div class="shell" style="--accent:#4F46E5;--accent-soft:#EEF2FF;--accent-ink:#3730A3">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark" style="background:linear-gradient(135deg,#4F46E5,#0EA5E9)"><${Icon} name="shield-check" size=${18} /></div>부모 관리</div>
      ${me && html`<button class="nav-item" style="margin-bottom:8px;background:var(--surface-2)" onClick=${onExit}><${Avatar} id=${me} size=${32} /><div style="text-align:left;line-height:1.2"><div class="bold" style="color:var(--text)">${memberInfo(me).name}</div><div class="tiny muted">프로필 전환</div></div></button>`}
      ${SECTIONS.map((s) => html`<button key=${s.id} class=${'nav-item ' + (sec === s.id ? 'on' : '')} onClick=${() => setSec(s.id)}><${Icon} name=${s.icon} />${s.label}${navBadge(s.id)}</button>`)}
      <div class="sidebar-foot"><button class="nav-item" onClick=${onExit}><${Icon} name="log-out" />나가기</button><div class="corner-mini"><${SyncBadge} /></div></div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="only-phone avatar-btn" onClick=${onExit} aria-label="나가기">${me ? html`<${Avatar} id=${me} size=${36} />` : html`<${Icon} name="log-out" />`}</button>
        <div class="grow" style="min-width:0"><h1>${SECTIONS.find((s) => s.id === sec).label}</h1></div>
        ${!['overview', 'settings', 'talk'].includes(sec) && html`<div class="seg">${kids.map((k) => html`<button key=${k.id} class=${k.id === kid?.id ? 'on' : ''} onClick=${() => setKidId(k.id)}>${k.profile.name}</button>`)}</div>`}
      </header>
      <div class=${'page' + (sec === 'talk' ? ' no-pad' : '')}>
        ${sec === 'overview' && html`<${Overview} kids=${kids} go=${(s, id) => { setKidId(id); setSec(s); }} />`}
        ${sec === 'talk' && (me ? html`<${TalkView} me=${me} />` : html`<${WhoAmIParent} onPick=${pickMe} />`)}
        ${sec === 'homework' && kid && html`<${HomeworkAdmin} kid=${kid} />`}
        ${sec === 'talents' && kid && html`<${TalentAdmin} kid=${kid} />`}
        ${sec === 'schedule' && kid && html`<${ScheduleAdmin} kid=${kid} />`}
        ${sec === 'vocab' && kid && html`<${VocabAdmin} kid=${kid} />`}
        ${sec === 'settings' && html`<${SettingsAdmin} kids=${kids} />`}
      </div>
    </main>
    <nav class="tabbar">
      ${SECTIONS.map((s) => html`<button key=${s.id} class=${'tab ' + (sec === s.id ? 'on' : '')} onClick=${() => setSec(s.id)}><${Icon} name=${s.icon} size=${21} />${s.short}${s.id === 'talk' && unread > 0 && html`<span class="tab-badge">${unread}</span>`}</button>`)}
    </nav>
  </div>`;
}

// ---------- 대시보드 ----------
function Overview({ kids, go }) {
  const today = todayKey(0);
  return html`<div class="overview fade-in">
    <div class="grid g-2">
      ${kids.map((k) => {
        const tasks = M.tasksFor(k, today);
        const done = tasks.filter((t) => t.done).length;
        const pet = M.activePet(k);
        const vs = M.vocabStats(k);
        const picks = M.creativePicks(k, today);
        const cr = picks.filter((m) => M.creativeDone(k, today, m.id)).length;
        const color = (KID_COLORS.find((c) => c.id === k.profile.colorId) || KID_COLORS[0]).color;
        return html`<section class="card" key=${k.id}>
          <div class="row">
            <div style="width:84px;height:84px;flex:none">${pet && html`<${PetStage} pet=${pet} mood=${M.petMood(pet)} showBubble=${false} />`}</div>
            <div class="grow">
              <div class="row"><h2 style="font-size:22px;font-weight:900;color:${color}">${k.profile.name}</h2><span class="badge">${k.profile.grade}학년</span></div>
              <div class="small muted">${pet ? `${petDisplayName(pet)} · ${STAGES[pet.stage].name} · ${pet.xp} XP` : ''} · 연속 ${M.streakOf(k)}일${M.studySecondsOn(k, today) >= 60 ? ` · 오늘 공부 ${M.fmtDur(M.studySecondsOn(k, today))}` : ''}</div>
            </div>
            <${TalentPill} value=${M.talentBalance(k)} />
          </div>
          <div class="grid g-3 keep" style="gap:8px;margin-top:10px">
            <div class="stat-tile"><${Ring} pct=${tasks.length ? (done / tasks.length) * 100 : 0} size=${44} stroke=${6} color=${color}><span class="tiny bold">${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</span><//><div><div class="v">${done}/${tasks.length}</div><div class="l">오늘 숙제</div></div></div>
            <div class="stat-tile"><${Emo} name="Light bulb" size=${40} /><div><div class="v">${cr}/3</div><div class="l">창의 미션</div></div></div>
            <div class="stat-tile"><${Emo} name=${vs.todayDone ? 'Hundred points' : 'Abacus'} size=${40} /><div><div class="v">${vs.todayDone ? '완료' : '아직'}</div><div class="l">영단어 ${vs.learned}개</div></div></div>
          </div>
          <div style="margin-top:8px">
            ${tasks.filter((t) => !t.done).slice(0, 3).map((t) => html`<div class="list-row" key=${t.id}><span class="check" style="width:22px;height:22px;border-radius:7px"></span><span class="grow small">${t.title}</span><${Subj} s=${t.subject || '숙제'} /></div>`)}
            ${tasks.length > 0 && tasks.every((t) => t.done) && html`<div class="tip" style="background:var(--good-soft)"><${Emo} name="Trophy" size=${22} />오늘 숙제를 모두 끝냈어요!</div>`}
          </div>
          <div class="row wrap" style="margin-top:12px">
            <button class="btn sm" onClick=${() => go('homework', k.id)}><${Icon} name="list-checks" size=${16} />숙제</button>
            <button class="btn sm" onClick=${() => go('talents', k.id)}><${Icon} name="coins" size=${16} />칭찬·감점</button>
          </div>
        </section>`;
      })}
    </div>
    <div class="grid g-3 fill-row">
      <section class="card fill"><div class="card-h"><${Emo} name="Artist palette" size=${28} /><div class="grow"><h2>아이들 작품</h2><div class="muted small">하트 = 칭찬 +1</div></div></div><div class="card-body"><${Submissions} kids=${kids} /></div></section>
      <section class="card fill"><div class="card-h"><${Emo} name="Calendar" size=${28} /><h2 class="grow">최근 7일 숙제</h2></div><div class="card-body">${kids.map((k) => html`<${WeekChart} key=${k.id} kid=${k} />`)}</div></section>
      <section class="card fill"><div class="card-h"><${Emo} name="Speech balloon" size=${28} /><h2 class="grow">최근 활동</h2></div><div class="card-body"><${Activity} kids=${kids} /></div></section>
    </div>
  </div>`;
}

function WeekChart({ kid }) {
  const data = M.weekSummary(kid, 7);
  const color = (KID_COLORS.find((c) => c.id === kid.profile.colorId) || KID_COLORS[0]).color;
  return html`<div style="margin-bottom:10px"><div class="small bold" style=${`color:${color}`}>${kid.profile.name}</div>
    <div class="chart">${data.map((d) => html`<div class="col" key=${d.date}>
      <span class="tiny num" style="color:var(--text-2)">${d.done}/${d.total}</span>
      <div class="stack-bar" style="height:70px"><i style=${`height:${d.total ? (d.done / d.total) * 100 : 0}%;background:${color}`}></i></div>
      ${DAY_NAMES[new Date(d.date + 'T00:00:00').getDay()]}
    </div>`)}</div></div>`;
}

function Activity({ kids }) {
  const items = kids.flatMap((k) => M.ledgerList(k).slice(0, 25).map((e) => ({ ...e, kid: k }))).sort((a, b) => b.ts - a.ts).slice(0, 12);
  if (!items.length) return html`<${Empty} title="아직 활동이 없어요" />`;
  return html`<div>${items.map((e) => html`<div class="list-row" key=${e.kid.id + e.id}>
    <${Emo} name=${e.kind === 'feed' ? 'Shortcake' : e.kind === 'penalty' ? 'Thinking face' : e.kind === 'bonus' ? 'Wrapped gift' : 'Coin'} size=${26} />
    <div class="grow"><div class="small"><b>${e.kid.profile.name}</b> ${e.reason}</div><div class="tiny muted">${timeAgo(e.ts)}</div></div>
    <span class=${'badge ' + (e.talents >= 0 ? 'gold' : 'bad')}>${e.talents >= 0 ? '+' : ''}${e.talents}</span>
  </div>`)}</div>`;
}

function Submissions({ kids }) {
  const items = [];
  for (const k of kids) {
    for (const [date, day] of Object.entries(k.creative || {})) {
      for (const [mid, d] of Object.entries((day && day.done) || {})) items.push({ kid: k, date, mid, ...d });
    }
  }
  items.sort((a, b) => (b.at || 0) - (a.at || 0));
  if (!items.length) return html`<${Empty} emoji="Artist palette" title="아직 제출한 작품이 없어요" sub="아이들이 창의 미션을 하면 여기 모여요" />`;
  return html`<div class="gallery">${items.slice(0, 12).map((it) => html`<${SubCard} key=${it.kid.id + it.date + it.mid} it=${it} />`)}</div>`;
}
function SubCard({ it }) {
  const [img, setImg] = useState(null);
  const [comment, setComment] = useState('');
  useEffect(() => { if (it.media) db.getMedia(it.media).then(setImg); }, [it.media]);
  const cat = CATEGORIES[it.cat] || CATEGORIES.art;
  return html`<div class="sub-card">
    ${it.media && html`<div class="sc-img">${img ? html`<img src=${img} alt="" />` : html`<span class="muted small">불러오는 중…</span>`}</div>`}
    <div class="sc-body">
      <div class="row"><img src=${E(cat.e)} width="22" height="22" alt="" /><b class="grow small">${it.title}</b></div>
      <div class="tiny muted">${it.kid.profile.name} · ${shortDate(it.date)} ${it.at ? hhmm(it.at) : ''}</div>
      ${it.text && html`<div class="sc-text">${it.text}</div>`}
      ${it.answer && html`<span class="badge good">정답 ${it.answer}</span>`}
      ${it.liked ? html`<div class="badge bad">❤ 칭찬 완료${it.comment ? ' · ' + it.comment : ''}</div>`
        : html`<div class="row"><input class="input" style="height:36px;font-size:14px" placeholder="칭찬 한마디" value=${comment} onInput=${(e) => setComment(e.target.value)} />
          <button class="btn sm danger" onClick=${() => { M.likeCreative(it.kid.id, it.date, it.mid, comment.trim()); toast(`${it.kid.profile.name}에게 하트를 보냈어요 (+1)`, 'Red heart'); }}>❤</button></div>`}
    </div>
  </div>`;
}

// ---------- 숙제 관리 ----------
function HomeworkAdmin({ kid }) {
  const [date, setDate] = useState(todayKey(0));
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('수학');
  const [talents, setTalents] = useState(2);
  return html`<div class="grid g-main fade-in">
    <div class="stack" style="gap:18px">
      <section class="card">
        <div class="card-h"><h2 class="grow">${kid.profile.name}의 숙제</h2><${DateNav} date=${date} setDate=${setDate} /></div>
        <${TaskList} kid=${kid} date=${date} editable=${true} />
        <hr class="sep" />
        <div class="form-grid">
          <div class="field" style="grid-column:span 2"><label>숙제 내용</label><input class="input" placeholder="예: 연산 프린트 2장" value=${title} onInput=${(e) => setTitle(e.target.value)} /></div>
          <div class="field"><label>과목</label><select class="select" value=${subject} onChange=${(e) => setSubject(e.target.value)}>${['수학', '영어', '국어', '과학', '사회', '학습지', '생활', '숙제'].map((s) => html`<option>${s}</option>`)}</select></div>
          <div class="field"><label>달란트</label><input class="input" type="number" min="0" max="10" value=${talents} onInput=${(e) => setTalents(e.target.value)} /></div>
          <button class="btn primary" onClick=${() => { if (!title.trim()) return; M.addTask(kid.id, date, { title: title.trim(), subject, talents: Number(talents) }); setTitle(''); toast('숙제를 추가했어요', 'Memo'); }}><${Icon} name="plus" size=${18} />추가</button>
        </div>
      </section>
      <${BulkImport} kid=${kid} />
    </div>
    <div class="stack" style="gap:18px">
      <${WorkbookAdmin} kid=${kid} />
      <${HabitAdmin} kid=${kid} />
    </div>
  </div>`;
}

function WorkbookAdmin({ kid }) {
  const wbs = Object.values(kid.workbooks || {}).filter(Boolean);
  const [f, setF] = useState({ subject: '수학', title: '', startPage: 1, pagesPerDay: 2, totalPages: 120, days: [1, 2, 3, 4, 5], talents: 2 });
  const set = (k, v) => setF({ ...f, [k]: v });
  function add() {
    if (!f.title.trim()) return toast('교재 이름을 입력하세요', 'Memo');
    const id = uid('wb');
    db.set(`kids/${kid.id}/workbooks/${id}`, { ...f, id, title: f.title.trim(), active: true, baseDate: todayKey(0), startPage: Number(f.startPage), pagesPerDay: Number(f.pagesPerDay), totalPages: Number(f.totalPages), talents: Number(f.talents) });
    setF({ ...f, title: '' });
    toast('문제집 자동 배정을 등록했어요', 'Books');
  }
  return html`<section class="card">
    <div class="card-h"><${Emo} name="Books" size=${30} /><div class="grow"><h3>문제집 자동 배정</h3><div class="muted small">시작 페이지·하루 분량·요일만 정하면 매일 자동 생성</div></div></div>
    ${wbs.map((w) => html`<div class="list-row" key=${w.id}><${Subj} s=${w.subject} /><div class="grow"><b class="small">${w.title}</b><div class="tiny muted">p.${w.startPage}부터 하루 ${w.pagesPerDay}쪽 · ${(w.days || []).map((d) => DAY_NAMES[d]).join('')} · 총 ${w.totalPages}p</div></div>
      <button class="btn sm" onClick=${() => db.set(`kids/${kid.id}/workbooks/${w.id}/active`, !w.active)}>${w.active ? '일시정지' : '재개'}</button>
      <button class="icon-btn sm" onClick=${() => db.remove(`kids/${kid.id}/workbooks/${w.id}`)}><${Icon} name="trash-2" size=${15} /></button></div>`)}
    <div class="stack" style="margin-top:10px">
      <div class="form-grid">
        <div class="field"><label>과목</label><input class="input" value=${f.subject} onInput=${(e) => set('subject', e.target.value)} /></div>
        <div class="field" style="grid-column:span 2"><label>교재</label><input class="input" placeholder="예: 최상위 수학 5-2" value=${f.title} onInput=${(e) => set('title', e.target.value)} /></div>
        <div class="field"><label>시작 p</label><input class="input" type="number" value=${f.startPage} onInput=${(e) => set('startPage', e.target.value)} /></div>
        <div class="field"><label>하루 쪽수</label><input class="input" type="number" value=${f.pagesPerDay} onInput=${(e) => set('pagesPerDay', e.target.value)} /></div>
        <div class="field"><label>총 페이지</label><input class="input" type="number" value=${f.totalPages} onInput=${(e) => set('totalPages', e.target.value)} /></div>
      </div>
      <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button key=${d} class=${'day ' + (f.days.includes(d) ? 'on' : '')} onClick=${() => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d])}>${DAY_NAMES[d]}</button>`)}</div>
      <button class="btn primary" onClick=${add}>자동 배정 등록</button>
    </div>
  </section>`;
}

function HabitAdmin({ kid }) {
  const habits = Object.values(kid.habits || {}).filter(Boolean).sort((a, b) => (a.order ?? 9) - (b.order ?? 9));
  const blank = { title: '', subject: '생활', talents: 1, days: [], weekly: false };
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState(null);
  const set = (k, v) => setF({ ...f, [k]: v });
  const startEdit = (h) => { setEditId(h.id); setF({ title: h.title, subject: h.subject || '생활', talents: h.talents ?? 1, days: (h.days || []).map(Number), weekly: !!h.weekly }); };
  const dayText = (h) => !h.days || !h.days.length ? '매일' : [1, 2, 3, 4, 5, 6, 0].filter((d) => h.days.map(Number).includes(d)).map((d) => DAY_NAMES[d]).join('·') + (h.weekly ? ' 중 1회' : '');
  function add() {
    if (!f.title.trim()) return toast('할 일 이름을 입력하세요', 'Memo');
    const data = { title: f.title.trim(), subject: f.subject, talents: Number(f.talents) || 0, days: f.days.length ? [...f.days].sort() : null, weekly: !!f.weekly && f.days.length > 1 };
    if (editId) {
      db.update(`kids/${kid.id}/habits/${editId}`, data);
      toast('반복 할 일을 수정했어요', 'Spiral calendar');
    } else {
      const id = uid('h');
      db.set(`kids/${kid.id}/habits/${id}`, { id, ...data, active: true, order: 5 });
      toast('반복 할 일을 추가했어요', 'Spiral calendar');
    }
    setF(blank);
    setEditId(null);
  }
  return html`<section class="card">
    <div class="card-h"><${Emo} name="Spiral calendar" size=${30} /><div class="grow"><h3>반복 할 일 · 습관</h3><div class="muted small">요일을 정하면 해당 요일마다 할 일에 자동으로 들어가요</div></div></div>
    ${habits.map((h) => html`<div class="list-row" key=${h.id}><${Subj} s=${h.subject || '생활'} /><div class="grow"><b class="small">${h.title}</b><div class="tiny muted">${dayText(h)} · +${h.talents ?? 1}</div></div>
      <button class="icon-btn sm" title="수정" onClick=${() => startEdit(h)}><${Icon} name="pencil" size=${15} /></button>
      <button class="btn sm" onClick=${() => db.set(`kids/${kid.id}/habits/${h.id}/active`, !h.active)}>${h.active ? '켜짐' : '꺼짐'}</button>
      <button class="icon-btn sm" onClick=${() => db.remove(`kids/${kid.id}/habits/${h.id}`)}><${Icon} name="trash-2" size=${15} /></button></div>`)}
    <div class="stack" style="margin-top:10px">
      <div class="form-grid">
        <div class="field" style="grid-column:span 2"><label>할 일</label><input class="input" placeholder="예: 구몬 하루 분량 풀기" value=${f.title} onInput=${(e) => set('title', e.target.value)} /></div>
        <div class="field"><label>과목</label><select class="select" value=${f.subject} onChange=${(e) => set('subject', e.target.value)}>${['생활', '수학', '영어', '국어', '학습지', '과학', '숙제'].map((s) => html`<option>${s}</option>`)}</select></div>
        <div class="field"><label>달란트</label><input class="input" type="number" min="0" max="10" value=${f.talents} onInput=${(e) => set('talents', e.target.value)} /></div>
      </div>
      <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button key=${d} class=${'day ' + (f.days.includes(d) ? 'on' : '')} onClick=${() => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d])}>${DAY_NAMES[d]}</button>`)}<span class="small muted" style="align-self:center">${f.days.length ? '' : '선택 안 하면 매일'}</span></div>
      ${f.days.length > 1 && html`<label class="row small"><input type="checkbox" checked=${f.weekly} onChange=${(e) => set('weekly', e.target.checked)} />선택한 요일 중 한 번만 하면 완료 (주 1회)</label>`}
      <div class="row"><button class="btn primary grow" onClick=${add}>${editId ? '수정 저장' : '추가'}</button>${editId && html`<button class="btn" onClick=${() => { setEditId(null); setF(blank); }}>취소</button>`}</div>
    </div>
  </section>`;
}

function BulkImport({ kid }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [drafts, setDrafts] = useState([]);
  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const t = await runBrowserOcr(f, setStatus);
      setText(t);
      setDrafts(parseHomeworkText(t));
      setStatus('인식 완료!');
    } catch (err) { setStatus('OCR 오류: ' + err.message); }
  }
  function commit() {
    drafts.forEach((d) => M.addTask(kid.id, d.dateKey, { title: d.title, subject: d.subject, talents: REWARDS.homework }));
    toast(`${drafts.length}개 숙제를 등록했어요`, 'Clipboard');
    setDrafts([]); setText('');
  }
  return html`<section class="card">
    <div class="card-h"><${Emo} name="Clipboard" size=${30} /><div class="grow"><h3>사진 OCR · 일괄 붙여넣기</h3><div class="muted small">주간 계획표 사진이나 카톡 메시지를 붙여넣으면 날짜별로 자동 분류</div></div></div>
    <div class="row wrap" style="margin-bottom:10px">
      <label class="btn sm"><${Icon} name="scan-line" size=${16} />사진에서 읽기<input type="file" accept="image/*" class="sr" onChange=${onFile} /></label>
      <span class="small muted">${status}</span>
    </div>
    <textarea class="textarea" placeholder=${'월: 쎈 수학 p.48~50, 영어 리딩 p.24~25\n화: 매3비 비문학 p.18~19'} value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
    <div class="row" style="margin-top:10px"><button class="btn" onClick=${() => setDrafts(parseHomeworkText(text))}>미리보기</button>${drafts.length > 0 && html`<button class="btn primary" onClick=${commit}>${drafts.length}개 등록</button>`}</div>
    ${drafts.length > 0 && html`<div style="margin-top:10px">${drafts.map((d, i) => html`<div class="list-row" key=${i}><span class="badge">${shortDate(d.dateKey)}</span><${Subj} s=${d.subject} /><span class="small grow">${d.title}</span></div>`)}</div>`}
  </section>`;
}

// ---------- 달란트 ----------
function TalentAdmin({ kid }) {
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState(2);
  const [pet, setPet] = useState(false);
  const list = M.ledgerList(kid);
  function grant(n, r) {
    M.grantTalents(kid.id, n, r, pet);
    toast(`${kid.profile.name}: ${r} (${n > 0 ? '+' : ''}${n})`, n > 0 ? 'Wrapped gift' : 'Thinking face');
  }
  return html`<div class="grid g-main fade-in">
    <div class="stack" style="gap:18px">
      <section class="card">
        <div class="card-h"><${Emo} name="Wrapped gift" size=${30} /><h3 class="grow">칭찬 달란트</h3><${TalentPill} value=${M.talentBalance(kid)} /></div>
        <div class="row wrap">${PRAISE_PRESETS.map((p) => html`<button key=${p.label} class="chip" onClick=${() => grant(p.talents, p.label)}>${p.label} <b style="color:#9A6100">+${p.talents}</b></button>`)}</div>
        <hr class="sep" />
        <div class="card-h"><${Emo} name="Thinking face" size=${30} /><h3 class="grow">감점</h3>
          <label class="row small" style="gap:6px"><input type="checkbox" checked=${pet} onChange=${(e) => setPet(e.target.checked)} />펫 경험치도 차감 (×10)</label></div>
        <div class="row wrap">${PENALTY_PRESETS.map((p) => html`<button key=${p.label} class="chip" onClick=${() => grant(p.talents, p.label)}>${p.label} <b style="color:var(--bad)">${p.talents}</b></button>`)}</div>
        <hr class="sep" />
        <div class="form-grid">
          <div class="field" style="grid-column:span 2"><label>직접 입력</label><input class="input" placeholder="사유" value=${reason} onInput=${(e) => setReason(e.target.value)} /></div>
          <div class="field"><label>달란트 (±)</label><input class="input" type="number" value=${amount} onInput=${(e) => setAmount(e.target.value)} /></div>
          <button class="btn primary" onClick=${() => { if (!reason.trim() || !Number(amount)) return; grant(Number(amount), reason.trim()); setReason(''); }}>반영</button>
        </div>
      </section>
    </div>
    <section class="card">
      <div class="card-h"><${Emo} name="Ledger" size=${30} /><h3 class="grow">달란트 장부</h3></div>
      ${list.slice(0, 60).map((e) => html`<div class="list-row" key=${e.id}>
        <div class="grow"><div class="small">${e.reason}</div><div class="tiny muted">${shortDate(e.date)} ${hhmm(e.ts)}${e.petXp ? ` · 펫 ${e.petXp > 0 ? '+' : ''}${e.petXp}XP` : ''}</div></div>
        <span class=${'badge ' + (e.talents >= 0 ? 'gold' : 'bad')}>${e.talents >= 0 ? '+' : ''}${e.talents}</span>
        ${e.by === 'parent' && html`<button class="icon-btn sm" title="취소" onClick=${() => db.remove(`kids/${kid.id}/ledger/${e.id}`)}><${Icon} name="rotate-ccw" size=${14} /></button>`}
      </div>`)}
    </section>
  </div>`;
}

// ---------- 시간표 ----------
function ScheduleAdmin({ kid }) {
  const [f, setF] = useState({ title: '', type: '학원', start: '15:30', end: '17:00', note: '', days: [1] });
  const set = (k, v) => setF({ ...f, [k]: v });
  const items = Object.values(kid.academies || {}).filter(Boolean).sort((a, b) => (a.days[0] ?? 9) - (b.days[0] ?? 9) || a.start.localeCompare(b.start));
  return html`<div class="stack fade-in" style="gap:18px">
    <section class="card"><${WeekGrid} kid=${kid} /></section>
    <div class="grid g-2">
      <section class="card">
        <div class="card-h"><h3 class="grow">등록된 일정</h3></div>
        ${items.length === 0 && html`<${Empty} title="일정이 없어요" />`}
        ${items.map((a) => html`<div class="list-row" key=${a.id}><span class="badge">${(a.days || []).map((d) => DAY_NAMES[d]).join('')}</span>
          <div class="grow"><b class="small">${a.title}</b><div class="tiny muted">${a.start}~${a.end} · ${a.type}${a.note ? ' · ' + a.note : ''}</div></div>
          <button class="icon-btn sm" onClick=${() => db.remove(`kids/${kid.id}/academies/${a.id}`)}><${Icon} name="trash-2" size=${15} /></button></div>`)}
      </section>
      <section class="card">
        <div class="card-h"><h3 class="grow">일정 추가</h3></div>
        <div class="stack">
          <div class="form-grid">
            <div class="field" style="grid-column:span 2"><label>이름</label><input class="input" placeholder="예: 테니스" value=${f.title} onInput=${(e) => set('title', e.target.value)} /></div>
            <div class="field"><label>종류</label><select class="select" value=${f.type} onChange=${(e) => set('type', e.target.value)}>${['학원', '학습지', '예체능', '과외/기타'].map((t) => html`<option>${t}</option>`)}</select></div>
            <div class="field"><label>시작</label><input class="input" type="time" value=${f.start} onInput=${(e) => set('start', e.target.value)} /></div>
            <div class="field"><label>종료</label><input class="input" type="time" value=${f.end} onInput=${(e) => set('end', e.target.value)} /></div>
          </div>
          <input class="input" placeholder="준비물 메모 (예: 라켓, 물통)" value=${f.note} onInput=${(e) => set('note', e.target.value)} />
          <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button key=${d} class=${'day ' + (f.days.includes(d) ? 'on' : '')} onClick=${() => set('days', f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d])}>${DAY_NAMES[d]}</button>`)}</div>
          <button class="btn primary" onClick=${() => { if (!f.title.trim() || !f.days.length) return toast('이름과 요일을 선택하세요', 'Memo'); const id = uid('ac'); db.set(`kids/${kid.id}/academies/${id}`, { ...f, id, title: f.title.trim(), days: [...f.days].sort() }); set('title', ''); toast('시간표에 추가했어요', 'Spiral calendar'); }}>저장</button>
        </div>
      </section>
    </div>
  </div>`;
}

// ---------- 영단어 ----------
function VocabAdmin({ kid }) {
  const vs = M.vocabStats(kid);
  const weak = M.weakWords(kid);
  const [w, setW] = useState({ word: '', meaning: '', sentence: '' });
  const custom = Object.values(db.getState().customWords || {}).filter(Boolean);
  return html`<div class="grid g-2 fade-in">
    <section class="card">
      <div class="card-h"><h3 class="grow">${kid.profile.name}의 단어 레벨</h3></div>
      <div class="stack" style="gap:8px">${VOCAB_LEVELS.map((l) => html`<button key=${l.level} class=${'list-row'} style=${`border-radius:14px;padding:12px;${Number(kid.profile.vocabLevel) === l.level ? 'background:var(--accent-soft)' : ''}`} onClick=${() => db.set(`kids/${kid.id}/profile/vocabLevel`, l.level)}>
        <span class=${'badge ' + (Number(kid.profile.vocabLevel) === l.level ? 'accent' : '')}>Lv.${l.level}</span><div class="grow" style="text-align:left"><b class="small">${l.label}</b><div class="tiny muted">${l.desc} · ${M.wordsForLevel(l.level).length}단어</div></div>
        ${Number(kid.profile.vocabLevel) === l.level && html`<${Icon} name="circle-check" />`}</button>`)}</div>
      <div class="grid g-3" style="margin-top:14px;gap:10px">
        <div class="stat-tile"><div><div class="v">${vs.learned}</div><div class="l">익힌 단어</div></div></div>
        <div class="stat-tile"><div><div class="v">${vs.mastered}</div><div class="l">마스터</div></div></div>
        <div class="stat-tile"><div><div class="v">${vs.due}</div><div class="l">복습 대기</div></div></div>
      </div>
    </section>
    <div class="stack" style="gap:18px">
      <section class="card">
        <div class="card-h"><${Emo} name="Thinking face" size=${30} /><h3 class="grow">자주 틀리는 단어</h3></div>
        ${weak.length === 0 ? html`<div class="muted small">아직 데이터가 없어요</div>` : weak.map((x) => html`<div class="list-row" key=${x.id}><b class="small">${x.word}</b><span class="small muted grow">${x.meaning}</span><span class="badge bad">오답 ${x.w}</span></div>`)}
      </section>
      <section class="card">
        <div class="card-h"><h3 class="grow">학원 단어 추가 (가족 공용)</h3><span class="badge">Lv.${kid.profile.vocabLevel}로 추가</span></div>
        <div class="stack">
          <div class="row"><input class="input" placeholder="영어 단어" value=${w.word} onInput=${(e) => setW({ ...w, word: e.target.value })} /><input class="input" placeholder="뜻" value=${w.meaning} onInput=${(e) => setW({ ...w, meaning: e.target.value })} /></div>
          <input class="input" placeholder="예문 (선택)" value=${w.sentence} onInput=${(e) => setW({ ...w, sentence: e.target.value })} />
          <button class="btn primary" onClick=${() => { if (!w.word.trim() || !w.meaning.trim()) return; const id = uid('cw'); db.set(`customWords/${id}`, { id, level: Number(kid.profile.vocabLevel), word: w.word.trim().toLowerCase(), meaning: w.meaning.trim(), sentence: w.sentence.trim(), pos: '' }); setW({ word: '', meaning: '', sentence: '' }); toast('단어를 추가했어요', 'Memo'); }}>추가</button>
        </div>
        ${custom.slice(-10).reverse().map((c) => html`<div class="list-row" key=${c.id}><b class="small">${c.word}</b><span class="small muted grow">${c.meaning}</span><span class="badge">Lv.${c.level}</span><button class="icon-btn sm" onClick=${() => db.remove(`customWords/${c.id}`)}><${Icon} name="trash-2" size=${14} /></button></div>`)}
      </section>
    </div>
  </div>`;
}

// ---------- 설정 ----------
function SettingsAdmin({ kids }) {
  const s = M.settings();
  const fam = db.getFamily();
  const link = `${location.origin}${location.pathname}#family=${fam}`;
  const [pin, setPin] = useState(s.pin || '1234');
  const qrSvg = useMemo(() => { try { const q = qrcode(0, 'M'); q.addData(link); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (_) { return ''; } }, [link]);
  const [mute, setMute] = useState(localStorage.getItem('kq2_mute') === '1');
  return html`<div class="grid g-2 fade-in">
    <section class="card">
      <div class="card-h"><${Emo} name="Laptop" size=${30} /><div class="grow"><h3>다른 기기 연결</h3><div class="muted small">아이 패드·부모님 폰에서 이 QR을 찍거나 링크를 열면 같은 데이터를 실시간으로 공유해요</div></div></div>
      <div class="row wrap" style="align-items:flex-start">
        <div class="qr" dangerouslySetInnerHTML=${{ __html: qrSvg }}></div>
        <div class="stack grow" style="min-width:220px">
          <div class="field"><label>가족 연결 링크</label><input class="input" readonly value=${link} onFocus=${(e) => e.target.select()} /></div>
          <button class="btn primary" onClick=${async () => { try { await navigator.clipboard.writeText(link); toast('링크를 복사했어요. 카톡으로 다른 기기에 보내세요', 'Sparkles'); } catch (_) { toast('복사 실패: 링크를 길게 눌러 복사하세요', 'Memo'); } }}><${Icon} name="copy" size=${18} />링크 복사</button>
          <div class="tip small"><${Icon} name="info" size=${16} /><div>iPad Safari에서 링크를 연 뒤 <b>공유 → 홈 화면에 추가</b>하면 앱처럼 쓸 수 있어요. 링크는 가족끼리만 공유하세요.</div></div>
          <${SyncBadge} />
        </div>
      </div>
    </section>
    <section class="card">
      <div class="card-h"><${Emo} name="Gear" size=${30} /><h3 class="grow">기본 설정</h3></div>
      <div class="stack">
        <div class="form-grid">
          <div class="field"><label>부모 PIN (4자리)</label><input class="input" inputmode="numeric" maxlength="4" value=${pin} onInput=${(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
          <button class="btn" onClick=${() => { if (pin.length !== 4) return toast('4자리 숫자로 입력하세요', 'Memo'); db.set('settings/pin', pin); toast('PIN을 변경했어요', 'Locked'); }}>PIN 저장</button>
        </div>
        <hr class="sep" />
        <${PushSettings} />
        <hr class="sep" />
        <${TalkPushSettings} />
        <hr class="sep" />
        <div class="field"><label>날씨 지역</label><select class="select" value=${s.cityId} onChange=${(e) => db.set('settings/cityId', e.target.value)}>${KOREAN_CITIES.map((c) => html`<option value=${c.id}>${c.name}</option>`)}</select></div>
        <label class="row small"><input type="checkbox" checked=${mute} onChange=${(e) => { setMute(e.target.checked); localStorage.setItem('kq2_mute', e.target.checked ? '1' : '0'); }} />이 기기 효과음 끄기</label>
        <hr class="sep" />
        <div class="label">엄마·아빠 프로필 (가족톡 사진)</div>
        <${ParentProfiles} />
        <div class="label" style="margin-top:6px">아이 프로필 <span class="tiny muted">· 가족톡 사진은 지금 키우는 펫이에요</span></div>
        ${kids.map((k) => html`<div class="list-row" key=${k.id}><b class="grow">${k.profile.name}</b>
          <select class="select" style="width:auto;height:36px" value=${k.profile.grade} onChange=${(e) => db.set(`kids/${k.id}/profile/grade`, Number(e.target.value))}>${[1, 2, 3, 4, 5, 6].map((g) => html`<option value=${g}>${g}학년</option>`)}</select>
          <select class="select" style="width:auto;height:36px" value=${k.profile.colorId} onChange=${(e) => db.set(`kids/${k.id}/profile/colorId`, e.target.value)}>${KID_COLORS.map((c) => html`<option value=${c.id}>${c.name}</option>`)}</select></div>`)}
        <hr class="sep" />
        <div class="row wrap">
          <button class="btn" onClick=${() => { const blob = new Blob([JSON.stringify(db.getState(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kidquest-backup-${todayKey(0)}.json`; a.click(); }}><${Icon} name="download" size=${18} />JSON 백업</button>
          <button class="btn danger" onClick=${() => { if (confirm('이 기기에서 가족 연결을 해제할까요? (데이터는 서버에 그대로 남아요)')) { db.leaveFamily(); location.reload(); } }}><${Icon} name="log-out" size=${18} />이 기기 연결 해제</button>
        </div>
      </div>
    </section>
  </div>`;
}


// ---------- 엄마·아빠 프로필 캐릭터 ----------
function ParentProfiles() {
  const [open, setOpen] = useState(null);
  return html`<div class="stack" style="gap:8px">
    ${PARENTS.map((p) => {
      const m = memberInfo(p.id);
      return html`<div class="list-row" key=${p.id}>
        <button onClick=${() => setOpen(p.id)} title="캐릭터 바꾸기"><${Avatar} id=${p.id} size=${44} /></button>
        <input class="input" style="height:38px;max-width:140px" value=${m.name} onChange=${(e) => db.set(`settings/members/${p.id}/name`, e.target.value.trim().slice(0, 8) || null)} />
        <span class="grow"></span>
        <button class="btn sm" onClick=${() => setOpen(p.id)}><${Icon} name="smile" size=${16} />캐릭터 선택</button>
      </div>`;
    })}
    ${open && html`<${Modal} title=${memberInfo(open).name + ' 캐릭터 선택'} icon=${memberInfo(open).emo} onClose=${() => setOpen(null)}>
      <div class="avatar-grid">${PARENT_AVATARS.map((a) => html`<button key=${a} class=${memberInfo(open).emo === a ? 'on' : ''} onClick=${() => { db.set(`settings/members/${open}/avatar`, a); setOpen(null); toast('프로필 캐릭터를 바꿨어요', a); }}><img src=${E(a)} alt="" /></button>`)}</div>
    <//>`}
  </div>`;
}

// ---------- 내일 날씨 푸시 알림 (GitHub Actions → 앱 알림) ----------
const PUSH_TIMES = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00', '22:30', '23:00'];
function PushSettings() {
  const s = M.settings();
  const push = s.push || {};
  const time = push.time || '21:00';
  const enabled = push.enabled !== false;
  return html`<div class="stack" style="gap:8px">
    <div class="label">내일 날씨 푸시 알림</div>
    <div class="form-grid">
      <div class="field"><label>알림 시간 (전날 저녁)</label><select class="select" value=${time} onChange=${(e) => db.set('settings/push/time', e.target.value)}>${PUSH_TIMES.map((t) => html`<option value=${t}>${t}</option>`)}</select></div>
      <label class="row small" style="height:46px"><input type="checkbox" checked=${enabled} onChange=${(e) => db.set('settings/push/enabled', e.target.checked)} />알림 켜기</label>
    </div>
    <div class="tip small"><${Icon} name="bell" size=${16} /><div>알림을 켠 모든 기기로 매일 <b>${time}</b>에 내일 날씨·준비물·학원 일정을 보내요. (서버가 15분마다 확인해서 조금 늦을 수 있어요)</div></div>
  </div>`;
}

// ---------- 알림 받는 기기 ----------
function TalkPushSettings() {
  const devs = pushDevices();
  const me = parentMeForSettings();
  return html`<div class="stack" style="gap:8px">
    <div class="label">알림 받는 기기 (가족톡 · 내일 날씨)</div>
    <${PushPanel} me=${me} compact=${true} />
    ${devs.length === 0 ? html`<div class="tiny muted">아직 알림을 켠 기기가 없어요. 각자 기기의 가족톡 화면 종 버튼에서 켤 수 있어요.</div>`
      : devs.map((d) => html`<div class="list-row" key=${d.id}>
        <${Avatar} id=${d.member} size=${32} />
        <div class="grow"><b class="small">${memberInfo(d.member).name}</b> <span class="tiny muted">· ${d.ua || '기기'}${d.id === deviceId() ? ' · 이 기기' : ''}</span><div class="tiny muted">${d.ts ? shortDate(new Date(d.ts).toISOString().slice(0, 10)) + ' 등록' : ''}</div></div>
        <button class="icon-btn sm" title="알림 끄기" onClick=${() => db.remove(`pushSubs/${d.id}`)}><${Icon} name="trash-2" size=${14} /></button>
      </div>`)}
  </div>`;
}
function parentMeForSettings() {
  const m = getMe();
  if (isParentId(m)) return m;
  const s = sessionStorage.getItem('kq2_parent_me');
  return isParentId(s) ? s : 'mom';
}
