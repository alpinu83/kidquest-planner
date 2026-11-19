// 숙제 목록 + 창의 미션 (그림판 / 글쓰기 / 사진 / 퀴즈 / 영어 말하기 / 실천 체크)
import { html, useState, useEffect, useRef, Icon, Emo, Modal, toast, celebrate, Subj, Reward, Empty } from './core.js';
import * as M from '../model.js';
import * as db from '../store.js';
import { CATEGORIES } from '../../data/missions.js';
import { E, uid, normalizeAnswer, speak, sfx, vibrate, compressImage, dayLabel, todayKey, addDays } from '../util.js';

export function TaskList({ kid, date, editable = false, compact = false, allowKidAdd = false }) {
  const tasks = M.tasksFor(kid, date);
  const [adding, setAdding] = useState('');
  const isToday = date === todayKey(0);
  const run = M.runningTimer(kid);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!run) return;
    const iv = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, [run && run.id, run && run.date]);
  function timerTap(t) {
    const tm = M.timerOf(kid, date, t.id);
    if (tm && tm.startedAt) {
      const sec = M.stopTimer(kid.id, date, t.id);
      sfx('good'); vibrate(15);
      toast(`공부 시간 ${M.fmtDur(sec)} 기록했어요`, 'Alarm clock');
    } else {
      const r = M.startTimer(kid.id, date, t);
      sfx('tap'); vibrate(10);
      toast(r.paused ? `'${r.paused}' 타이머는 멈추고 새로 시작해요` : '타이머 시작! 다 하면 정지를 누르세요', 'Alarm clock');
    }
  }
  const doneN = tasks.filter((t) => t.done).length;

  function toggle(t) {
    if (!editable && date > todayKey(0)) return toast('미래의 숙제는 그날 체크할 수 있어요', 'Spiral calendar');
    const r = M.toggleTask(kid.id, date, t);
    if (r.blocked) return toast(r.msg, 'Thinking face');
    if (r.done) {
      sfx(r.talents > 0 ? 'coin' : 'good');
      vibrate(15);
      toast((r.talents > 0 ? `달란트 +${r.talents} 획득!` : '잘했어요! 스스로 한 일 완료') + (r.studySec ? ` · 공부 ${M.fmtDur(r.studySec)}` : ''), r.talents > 0 ? 'Coin' : 'Sparkles');
      if (r.allClear) { setTimeout(() => { celebrate(1.6); toast('오늘 할 일 모두 완료! 보너스 +3', 'Trophy', 3500); }, 400); }
    }
  }
  function addOwn() {
    const v = adding.trim();
    if (!v) return;
    M.addTask(kid.id, date, { title: v, subject: '생활', talents: 0 });
    setAdding('');
    toast('할 일을 추가했어요', 'Memo');
  }

  if (!tasks.length && !allowKidAdd) return html`<${Empty} emoji="Party popper" title="오늘은 등록된 숙제가 없어요" sub="창의 미션에 도전해 볼까요?" />`;
  return html`<div>
    ${tasks.map((t) => html`<div key=${t.id} class=${'task ' + (t.done ? 'done' : '')}>
      <button class=${'check ' + (t.done ? 'on' : '')} aria-label=${t.done ? '완료 취소' : '완료'} onClick=${() => toggle(t)}><${Icon} name="check" size=${20} stroke=${3} /></button>
      <div class="grow">
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          <${Subj} s=${t.subject || '숙제'} />
          ${t.note && html`<span>${t.note}</span>`}
          ${t.source === 'workbook' && html`<span>자동 배정</span>`}
          ${(() => { const sec = M.timerElapsed(M.timerOf(kid, date, t.id)) || t.studySec || 0; const running = run && run.date === date && run.id === t.id; return sec > 0 && !running ? html`<span class="tm-rec"><${Icon} name="timer" size=${13} />${M.fmtDur(sec)}</span>` : ''; })()}
        </div>
      </div>
      ${M.isStudyTask(t) && !t.done && isToday && !editable && (() => { const running = run && run.date === date && run.id === t.id; const sec = M.timerElapsed(M.timerOf(kid, date, t.id)); return html`<button class=${'tmr' + (running ? ' on' : '')} aria-label=${running ? '타이머 정지' : '타이머 시작'} onClick=${() => timerTap(t)}>${running ? html`<i class="dot"></i><b class="num">${M.fmtDur(sec, true)}</b><span>정지</span>` : html`<${Icon} name="timer" size=${17} /><span>${sec > 0 ? '이어서' : '시작'}</span>`}</button>`; })()}
      ${Number(t.talents) > 0 && html`<${Reward} n=${t.talents} />`}
      ${editable && !t.done && html`<button class="icon-btn sm" title="내일로 미루기" onClick=${() => { M.postponeTask(kid.id, date, t); toast('내일로 옮겼어요', 'Spiral calendar'); }}><${Icon} name="arrow-right" size=${16} /></button>`}
      ${editable && html`<button class="icon-btn sm" title="삭제" onClick=${() => M.deleteTask(kid.id, date, t)}><${Icon} name="trash-2" size=${16} /></button>`}
    </div>`)}
    ${allowKidAdd && html`<div class="row" style="margin-top:10px">
      <input class="input" placeholder="스스로 할 일 추가 (예: 줄넘기 100개)" value=${adding} onInput=${(e) => setAdding(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && addOwn()} />
      <button class="btn" onClick=${addOwn}><${Icon} name="plus" size=${18} />추가</button>
    </div>`}
    ${!compact && tasks.length > 0 && html`<div class="small muted" style="margin-top:10px">${doneN}/${tasks.length} 완료 · 모두 끝내면 보너스 +3 달란트</div>`}
  </div>`;
}

export function DateNav({ date, setDate }) {
  return html`<div class="row">
    <button class="icon-btn" aria-label="이전 날" onClick=${() => setDate(addDays(date, -1))}><${Icon} name="chevron-left" /></button>
    <div class="bold" style="min-width:150px;text-align:center">${dayLabel(date)}</div>
    <button class="icon-btn" aria-label="다음 날" onClick=${() => setDate(addDays(date, 1))}><${Icon} name="chevron-right" /></button>
    ${date !== todayKey(0) && html`<button class="btn sm" onClick=${() => setDate(todayKey(0))}>오늘</button>`}
  </div>`;
}

export function CreativeCards({ kid, date, small = false, onOpen }) {
  const picks = M.creativePicks(kid, date);
  return html`<div class=${small ? 'stack' : 'grid g-3'}>
    ${picks.map((m) => {
      const cat = CATEGORIES[m.cat];
      const done = M.creativeDone(kid, date, m.id);
      return html`<button key=${m.id} class=${'mission ' + (done ? 'done' : '')} style=${small ? 'flex-direction:row;align-items:center;padding:12px;text-align:left' : 'text-align:left'} onClick=${() => onOpen(m)}>
        <img class="m-emoji" src=${E(cat.e)} alt="" style=${small ? 'width:44px;height:44px' : ''} />
        <div class="grow">
          <div class="m-cat" style=${`color:${cat.color}`}>${cat.name}</div>
          <h3 style=${small ? 'font-size:15px' : ''}>${m.title}</h3>
          ${!small && html`<p>${m.desc}</p>`}
        </div>
        ${done ? html`<span class="badge good stamp" style=${small ? 'position:static;transform:none' : ''}><${Icon} name="check" size=${14} />완료${done.liked ? ' ❤' : ''}</span>` : html`<span style=${small ? '' : 'margin-top:auto'}><${Reward} n=${3} /></span>`}
      </button>`;
    })}
  </div>`;
}

// ---------- 미션 실행 모달 ----------
export function MissionModal({ kid, date, mission, onClose }) {
  const done = M.creativeDone(kid, date, mission.id);
  const cat = CATEGORIES[mission.cat];
  const [busy, setBusy] = useState(false);

  async function finish(payload) {
    setBusy(true);
    try {
      const t = M.completeCreative(kid.id, date, mission, payload);
      sfx('coin');
      celebrate(1);
      toast(`창의 미션 완료! 달란트 +${t}`, 'Coin');
      onClose();
    } catch (e) {
      toast('저장 중 문제가 생겼어요: ' + e.message, 'Thinking face');
    } finally {
      setBusy(false);
    }
  }

  return html`<${Modal} title=${mission.title} icon=${cat.e} onClose=${onClose} wide=${mission.type === 'draw'}>
    <div class="stack">
      <div class="row wrap"><span class="badge" style=${`background:${cat.color}1A;color:${cat.color}`}>${cat.name}</span><${Reward} n=${3} /></div>
      <p style="font-size:16px;color:var(--text-2)">${mission.desc}</p>
      ${done ? html`<${DoneView} done=${done} />` : html`
        ${mission.type === 'draw' && html`<${DrawPad} busy=${busy} onSave=${async (dataUrl) => { const id = uid('img'); setBusy(true); await db.putMedia(id, dataUrl); finish({ media: id }); }} />`}
        ${mission.type === 'write' && html`<${WriteBox} min=${mission.min || 30} busy=${busy} onSave=${(text) => finish({ text })} />`}
        ${mission.type === 'photo' && html`<${PhotoBox} busy=${busy} onSave=${async (dataUrl) => { const id = uid('img'); setBusy(true); await db.putMedia(id, dataUrl); finish({ media: id }); }} />`}
        ${mission.type === 'quiz' && html`<${QuizBox} mission=${mission} onSolved=${(answer) => finish({ answer })} />`}
        ${mission.type === 'speak' && html`<${SpeakBox} mission=${mission} onDone=${(heard) => finish({ text: heard || mission.say })} />`}
        ${mission.type === 'check' && html`<${CheckBox} busy=${busy} onSave=${(memo) => finish({ text: memo })} />`}
      `}
    </div>
  <//>`;
}

function DoneView({ done }) {
  const [img, setImg] = useState(null);
  useEffect(() => { if (done.media) db.getMedia(done.media).then(setImg); }, [done.media]);
  return html`<div class="stack">
    <div class="tip"><${Emo} name="Party popper" size=${22} /><div><b>완료했어요!</b> ${new Date(done.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>
    ${done.media && (img ? html`<img src=${img} alt="내 작품" style="width:100%;border-radius:18px;border:1px solid var(--line)" />` : html`<div class="muted small">작품 불러오는 중…</div>`)}
    ${done.text && html`<div class="card flat tight" style="white-space:pre-wrap">${done.text}</div>`}
    ${done.answer && html`<div class="badge good">정답: ${done.answer}</div>`}
    ${done.liked && html`<div class="tip" style="background:var(--bad-soft)"><${Emo} name="Red heart" size=${22} /><div><b>부모님 하트 칭찬!</b>${done.comment ? ` "${done.comment}"` : ''}</div></div>`}
  </div>`;
}

const COLORS = ['#171A2C', '#E11D48', '#F97316', '#EAB308', '#22C55E', '#0EA5E9', '#7C3AED', '#EC4899', '#8B5E3C', '#FFFFFF'];
export function DrawPad({ onSave, busy }) {
  const ref = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(6);
  const hist = useRef([]);
  const drawing = useRef(false);
  const last = useRef(null);

  useEffect(() => {
    const c = ref.current;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = r.width * dpr;
    c.height = r.width * 0.75 * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);
  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5];
  };
  function down(e) {
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    const ctx = ref.current.getContext('2d');
    hist.current.push(ctx.getImageData(0, 0, ref.current.width, ref.current.height));
    if (hist.current.length > 25) hist.current.shift();
    drawing.current = true;
    last.current = pos(e);
    move(e);
  }
  function move(e) {
    if (!drawing.current) return;
    const ctx = ref.current.getContext('2d');
    const [x, y, p] = pos(e);
    const [lx, ly] = last.current;
    ctx.strokeStyle = color;
    ctx.lineWidth = e.pointerType === 'pen' ? size * (0.5 + p) : size;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    last.current = [x, y];
  }
  function up() { drawing.current = false; }
  function undo() {
    const img = hist.current.pop();
    if (img) ref.current.getContext('2d').putImageData(img, 0, 0);
  }
  function clear() {
    const c = ref.current;
    const ctx = c.getContext('2d');
    hist.current.push(ctx.getImageData(0, 0, c.width, c.height));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
  }
  function save() {
    const c = ref.current;
    const out = document.createElement('canvas');
    const scale = Math.min(1, 800 / c.width);
    out.width = c.width * scale; out.height = c.height * scale;
    out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
    onSave(out.toDataURL('image/jpeg', 0.72));
  }
  return html`<div class="drawpad">
    <canvas ref=${ref} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onPointerLeave=${up}></canvas>
    <div class="swatches">
      ${COLORS.map((c) => html`<button key=${c} class=${'sw ' + (c === color ? 'on' : '')} style=${`background:${c}`} aria-label=${c} onClick=${() => setColor(c)}></button>`)}
      <div class="seg" style="margin-left:6px">${[3, 6, 12, 22].map((s) => html`<button class=${s === size ? 'on' : ''} onClick=${() => setSize(s)}><span style=${`display:inline-block;width:${s / 1.6 + 4}px;height:${s / 1.6 + 4}px;border-radius:50%;background:currentColor`}></span></button>`)}</div>
      <span class="grow"></span>
      <button class="icon-btn" title="되돌리기" onClick=${undo}><${Icon} name="undo-2" /></button>
      <button class="icon-btn" title="모두 지우기" onClick=${clear}><${Icon} name="eraser" /></button>
    </div>
    <button class="btn primary lg block" disabled=${busy} onClick=${save}>${busy ? '저장 중…' : '작품 제출하기'}</button>
  </div>`;
}

function WriteBox({ min, onSave, busy }) {
  const [text, setText] = useState('');
  const len = text.replace(/\s/g, '').length;
  return html`<div class="stack">
    <textarea class="textarea" style="min-height:180px" placeholder="여기에 자유롭게 써 보세요" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
    <div class="row between"><span class=${'small ' + (len >= min ? '' : 'muted')}>${len} / ${min}자 이상</span>
      <button class="btn primary" disabled=${len < min || busy} onClick=${() => onSave(text.trim())}>제출하기</button></div>
  </div>`;
}

function PhotoBox({ onSave, busy }) {
  const [img, setImg] = useState(null);
  async function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setImg(await compressImage(f, 900, 0.72));
  }
  return html`<div class="stack">
    ${img ? html`<img src=${img} alt="미리보기" style="width:100%;border-radius:18px;border:1px solid var(--line)" />` : html`<label class="card flat" style="display:grid;place-items:center;gap:6px;padding:30px;cursor:pointer;border-style:dashed">
      <${Emo} name="Video camera" size=${56} /><b>사진 찍기 / 앨범에서 고르기</b><span class="small muted">찍은 사진은 가족만 볼 수 있어요</span>
      <input type="file" accept="image/*" capture="environment" class="sr" onChange=${onFile} />
    </label>`}
    ${img && html`<div class="row"><label class="btn"><${Icon} name="camera" size=${18} />다시 찍기<input type="file" accept="image/*" capture="environment" class="sr" onChange=${onFile} /></label><span class="grow"></span><button class="btn primary" disabled=${busy} onClick=${() => onSave(img)}>${busy ? '업로드 중…' : '인증하기'}</button></div>`}
  </div>`;
}

function QuizBox({ mission, onSolved }) {
  const [ans, setAns] = useState('');
  const [tries, setTries] = useState(0);
  const [wrong, setWrong] = useState(false);
  function check() {
    const ok = (mission.answers || []).some((a) => normalizeAnswer(a) === normalizeAnswer(ans)) || (mission.answers || []).some((a) => normalizeAnswer(ans).includes(normalizeAnswer(a)) && normalizeAnswer(a).length >= 2);
    if (ok) { sfx('good'); onSolved(ans.trim()); }
    else { sfx('bad'); vibrate(30); setTries((t) => t + 1); setWrong(true); setTimeout(() => setWrong(false), 500); }
  }
  return html`<div class="stack">
    <input class="input" style=${`font-size:20px;height:56px;text-align:center;${wrong ? 'animation:shake .4s;border-color:var(--bad)' : ''}`} placeholder="정답을 입력하세요" value=${ans} onInput=${(e) => setAns(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && check()} />
    ${tries >= 1 && mission.hint && html`<div class="tip"><${Emo} name="Light bulb" size=${22} /><div><b>힌트</b> ${mission.hint}</div></div>`}
    ${tries >= 3 && html`<div class="small muted">정답 예시: ${mission.answers[0]} (다시 입력해 보세요!)</div>`}
    <button class="btn primary lg" onClick=${check}>정답 확인</button>
  </div>`;
}

function similarity(a, b) {
  const wa = normalizeAnswer(a).length ? a.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean) : [];
  const wb = b.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  if (!wb.length) return 0;
  const set = new Set(wa);
  return wb.filter((w) => set.has(w)).length / wb.length;
}
function SpeakBox({ mission, onDone }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [score, setScore] = useState(null);
  const target = mission.say.replace(/___/g, '');
  function listen() {
    try {
      const r = new SR();
      r.lang = 'en-US';
      r.interimResults = false;
      r.onresult = (e) => {
        const t = e.results[0][0].transcript;
        setHeard(t);
        const s = similarity(t, target);
        setScore(s);
        if (s >= 0.6) sfx('good'); else sfx('bad');
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      setListening(true);
      r.start();
    } catch (_) { setListening(false); }
  }
  return html`<div class="stack">
    <div class="card flat" style="text-align:center;font-size:22px;font-weight:800;line-height:1.4">${mission.say}</div>
    <div class="row wrap" style="justify-content:center">
      <button class="btn" onClick=${() => speak(target)}><${Icon} name="volume-2" size=${18} />원어민 발음 듣기</button>
      <button class="btn" onClick=${() => speak(target, 'en-US', 0.6)}><${Icon} name="headphones" size=${18} />천천히</button>
      ${SR && html`<button class=${'btn ' + (listening ? 'danger' : 'primary')} onClick=${listen}><${Icon} name="mic" size=${18} />${listening ? '듣는 중…' : '말하고 채점받기'}</button>`}
    </div>
    ${heard && html`<div class="tip"><${Emo} name=${score >= 0.6 ? 'Hundred points' : 'Thinking face'} size=${22} /><div>들린 문장: <b>${heard}</b> · 정확도 ${Math.round(score * 100)}%</div></div>`}
    ${SR ? html`<button class="btn primary lg" disabled=${!(score >= 0.6)} onClick=${() => onDone(heard)}>${score >= 0.6 ? '미션 완료!' : '60% 이상이면 완료할 수 있어요'}</button>`
      : html`<button class="btn primary lg" onClick=${() => onDone('')}>3번 따라 말했어요!</button>`}
  </div>`;
}

function CheckBox({ onSave, busy }) {
  const [memo, setMemo] = useState('');
  return html`<div class="stack">
    <input class="input" placeholder="한 줄 소감 (선택)" value=${memo} onInput=${(e) => setMemo(e.target.value)} />
    <button class="btn primary lg" disabled=${busy} onClick=${() => onSave(memo.trim())}><${Icon} name="check" size=${20} />했어요!</button>
  </div>`;
}
