// 학원 Voca 시험 대비 화면
import { html, useState, useEffect, useMemo, useRef, Icon, Emo, Bar, Ring, toast, celebrate, Empty } from './core.js';
import * as I from '../ile.js';
import { speak, sfx, vibrate, shortDate, todayKey, DAY_NAMES, dowOf } from '../util.js';

const TYPE_COLOR = { syn: '#7C3AED', ant: '#E11D48', sce: '#0EA5E9', def: '#F59E0B', fill: '#16A34A' };

export function Bold({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') ? html`<b key=${i} style="color:var(--accent-ink);text-decoration:underline;text-underline-offset:3px">${p.slice(2, -2)}</b>` : p));
}

// ---------- 메인 카드 ----------
export function ILECard({ kid, lesson, onRun }) {
  const d = I.dDay(lesson);
  const { plan, todays, missed } = I.planToday(kid, lesson);
  const acc = I.typeAccuracy(kid, lesson);
  const mocks = I.mocksOf(kid, lesson);
  const next = todays && !todays.done ? todays : missed[0] || null;
  return html`<section class="card" style="border:2px solid var(--accent-soft)">
    <div class="row between wrap">
      <div>
        <div class="eyebrow">학원 Voca 시험 대비 · ${lesson.book}</div>
        <h2 style="font-size:23px;font-weight:900;letter-spacing:-.03em;margin-top:2px">Lesson ${lesson.lesson} · ${lesson.words.length}단어</h2>
        <div class="muted small">시험일 ${shortDate(lesson.testDate)} · 동의어·반의어·상황·뜻·빈칸 5가지 유형</div>
      </div>
      <div style="text-align:center"><div class=${'badge ' + (d <= 1 ? 'bad' : 'accent')} style="font-size:20px;height:42px;padding:0 16px">${d > 0 ? `D-${d}` : d === 0 ? 'D-DAY' : '시험 끝'}</div></div>
    </div>
    <div class="scroll-x" style="margin-top:14px"><div class="row" style="gap:8px;min-width:max-content">
      ${plan.map((p) => {
        const isToday = p.date === todayKey(0);
        return html`<button key=${p.day} class="card flat tight" style=${`width:150px;text-align:left;padding:12px;${isToday ? 'border:2px solid var(--accent);background:var(--accent-soft)' : ''}${p.done ? ';background:var(--good-soft)' : ''}`} onClick=${() => onRun({ kind: 'day', planDay: p })}>
          <div class="row between"><span class="tiny bold">${shortDate(p.date)}</span>${p.done ? html`<span class="badge good">완료 ${p.result && p.result.total ? `${p.result.score}/${p.result.total}` : ''}</span>` : isToday ? html`<span class="badge accent">오늘</span>` : p.date < todayKey(0) ? html`<span class="badge warn">밀림</span>` : html`<span class="badge">미리보기</span>`}</div>
          <div class="small bold" style="margin-top:6px;line-height:1.35">${p.title}</div>
        </button>`;
      })}
    </div></div>
    ${next ? html`<button class="btn primary lg block" style="margin-top:14px" onClick=${() => onRun({ kind: 'day', planDay: next })}><${Icon} name="play" size=${20} />${next.date === todayKey(0) ? '오늘 학습 시작' : `밀린 학습: ${shortDate(next.date)}`} · ${next.title}</button>`
      : html`<div class="tip" style="margin-top:14px;background:var(--good-soft)"><${Emo} name="Hundred points" size=${22} /><div>오늘 계획 완료! 아래 유형별 연습이나 모의고사로 더 다져 보세요.</div></div>`}
    <hr class="sep" />
    <div class="eyebrow" style="margin-bottom:8px">시험 유형별 연습 · 정답률</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
      ${I.TYPES.map((t) => html`<button key=${t} class="game-card" style="padding:12px;flex-direction:column;align-items:flex-start;gap:6px" onClick=${() => onRun({ kind: 'drill', type: t })}>
        <span class="badge" style=${`background:${TYPE_COLOR[t]}1A;color:${TYPE_COLOR[t]}`}>${I.TYPE_LABEL[t]}</span>
        <span class="bold num" style="font-size:18px">${acc[t].pct == null ? '-' : acc[t].pct + '%'}</span>
        <span class="tiny muted">${acc[t].c + acc[t].w}문제 풀이</span>
      </button>`)}
    </div>
    <div class="row wrap" style="margin-top:12px">
      <button class="btn" onClick=${() => onRun({ kind: 'mock' })}><${Icon} name="file-text" size=${18} />실전 모의고사 33문항</button>
      <button class="btn" onClick=${() => onRun({ kind: 'cards' })}><${Icon} name="book-a" size=${18} />단어 카드</button>
      <button class="btn" onClick=${() => onRun({ kind: 'weak' })}><${Icon} name="target" size=${18} />약한 단어 집중</button>
      ${mocks[0] && html`<span class="badge gold" style="height:30px">최근 모의고사 ${mocks[0].score}/${mocks[0].total}</span>`}
    </div>
    <hr class="sep" />
    <div class="eyebrow" style="margin-bottom:8px">단어별 숙련도</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px">
      ${lesson.words.map((w) => { const m = I.wordMastery(kid, lesson, w.id); const c = m.pct == null ? 'var(--surface-2)' : m.pct >= 85 ? 'var(--good-soft)' : m.pct >= 60 ? 'var(--warn-soft)' : 'var(--bad-soft)';
        return html`<div key=${w.id} style=${`border-radius:12px;padding:8px 10px;background:${c};border:1px solid var(--line)`}><div class="small bold">${w.n}. ${w.word}</div><div class="tiny muted">${m.pct == null ? '아직' : m.pct + '%'} · ${w.ko}</div></div>`; })}
    </div>
  </section>`;
}

// ---------- 실행기 ----------
export function ILERunner({ kid, lesson, run, onExit, onGame }) {
  const session = useMemo(() => {
    if (run.kind === 'day') return I.buildDaySession(kid, lesson, run.planDay);
    if (run.kind === 'mock') return { cards: [], ...I.buildMock(lesson), mock: true };
    if (run.kind === 'drill') return { cards: [], ...I.buildTypeDrill(lesson, run.type, 12) };
    if (run.kind === 'weak') {
      const weak = I.weakWords(kid, lesson, 5);
      const qs = [];
      I.TYPES.forEach((t) => weak.forEach((w) => { const q = I.makeQuestion(lesson, w, t); if (q) qs.push(q); }));
      return { cards: weak, questions: qs };
    }
    return { cards: lesson.words, questions: [], cardsOnly: true };
  }, []);
  const [phase, setPhase] = useState(session.cards.length ? 'cards' : 'quiz');
  const title = run.kind === 'day' ? `Day ${run.planDay.day} · ${run.planDay.title}${run.planDay.date > todayKey(0) ? ' (미리 연습 · 기록은 그날 완료)' : ''}` : run.kind === 'mock' ? '실전 모의고사' : run.kind === 'drill' ? `${I.TYPE_LABEL[run.type]} 연습` : run.kind === 'weak' ? '약한 단어 집중' : '단어 카드';

  return html`<div class="stack fade-in" style="gap:16px;max-width:820px;margin:0 auto">
    <div class="row"><button class="icon-btn" aria-label="나가기" onClick=${onExit}><${Icon} name="x" /></button><h2 class="grow" style="font-size:19px;font-weight:800">${title}</h2></div>
    ${phase === 'cards' && html`<${WordCards} words=${session.cards} onDone=${session.cardsOnly ? onExit : () => setPhase('quiz')} doneLabel=${session.cardsOnly ? '닫기' : '문제 풀기 시작'} onGame=${onGame} lesson=${lesson} />`}
    ${phase === 'quiz' && html`<${Quiz} kid=${kid} lesson=${lesson} session=${session} run=${run} onExit=${onExit} />`}
  </div>`;
}

export function WordCards({ words, onDone, doneLabel, onGame, lesson }) {
  const [i, setI] = useState(0);
  const w = words[i];
  useEffect(() => { if (w) speak(w.word); }, [i]);
  if (!w) return null;
  return html`<div class="stack" style="gap:12px">
    <${Bar} pct=${((i + 1) / words.length) * 100} />
    <section class="card">
      <div class="row between wrap">
        <div><span class="badge">${w.n}</span> <span style="font-size:34px;font-weight:900;letter-spacing:-.02em">${w.word}</span> <span class="muted">[${w.ipa}]</span></div>
        <div class="row"><button class="btn sm" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${16} />발음</button><button class="btn sm" onClick=${() => speak(w.word, 'en-US', 0.55)}>천천히</button></div>
      </div>
      <div class="bold" style="font-size:20px;margin-top:4px">${w.ko}</div>
      ${w.tip && html`<div class="tip small" style="margin-top:8px"><${Emo} name="Light bulb" size=${18} /><span>${w.tip}</span></div>`}
      ${w.senses.map((s, k) => html`<div key=${k} style="margin-top:12px;padding:12px;border-radius:14px;background:var(--surface-2)">
        <div><span class="badge accent">${s.pos}${w.senses.length > 1 ? ' ' + (k + 1) : ''}</span> <b>${s.def}</b></div>
        <div class="small muted" style="margin-top:2px">${s.ko}</div>
        ${s.syn.length > 0 && html`<div class="row wrap" style="margin-top:8px;gap:6px"><span class="tiny bold" style="color:#7C3AED">동의어</span>${s.syn.map((x) => html`<span class="chip" style="height:26px">${x}</span>`)}</div>`}
        ${s.ant.length > 0 && html`<div class="row wrap" style="margin-top:6px;gap:6px"><span class="tiny bold" style="color:#E11D48">반의어</span>${s.ant.map((x) => html`<span class="chip" style="height:26px;border-color:#FECDD3">${x}</span>`)}</div>`}
      </div>`)}
      ${w.col.length > 0 && html`<div class="small" style="margin-top:10px"><b>자주 쓰는 표현</b> · ${w.col.join(' · ')}</div>`}
      <div style="margin-top:10px;padding:12px;border-radius:14px;border:1px dashed var(--line-strong)">
        <div class="row"><b class="grow">${w.ex}</b><button class="icon-btn sm" onClick=${() => speak(w.ex)}><${Icon} name="volume-2" size=${15} /></button></div>
        <div class="small muted">${w.exKo}</div>
      </div>
    </section>
    <div class="row between">
      <button class="btn" disabled=${i === 0} onClick=${() => setI(i - 1)}><${Icon} name="chevron-left" size=${18} />이전</button>
      <span class="small muted">${i + 1} / ${words.length}</span>
      ${i + 1 < words.length ? html`<button class="btn primary" onClick=${() => setI(i + 1)}>다음<${Icon} name="chevron-right" size=${18} /></button>` : html`<button class="btn primary" onClick=${onDone}>${doneLabel}<${Icon} name="arrow-right" size=${18} /></button>`}
    </div>
  </div>`;
}

function Quiz({ kid, lesson, session, run, onExit }) {
  const [queue, setQueue] = useState(session.questions);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [firstTotal] = useState(session.questions.length);
  const [wrong, setWrong] = useState([]);
  const [retried, setRetried] = useState({});
  const [done, setDone] = useState(null);
  const isMock = !!session.mock;

  function answer(ok, q, given) {
    I.record(kid.id, lesson.id, q.wordId, q.type, ok);
    const isFirst = idx < firstTotal;
    if (ok && isFirst) setScore((s) => s + 1);
    if (!ok) {
      setWrong((l) => [...l, { ...q, given }]);
      // 실전 모의고사가 아니면 틀린 단어를 다른 문장으로 한 번 더
      if (!isMock && !retried[q.wordId + q.type]) {
        const r = I.retryQuestion(lesson, q);
        if (r) { setQueue((l) => [...l, { ...r, retry: true }]); setRetried((m) => ({ ...m, [q.wordId + q.type]: true })); }
      }
    }
  }
  function next() {
    if (idx + 1 < queue.length) { setIdx(idx + 1); return; }
    finish();
  }
  function finish() {
    const total = firstTotal;
    let talents = 0;
    const wrongList = wrong.filter((x) => !x.retry).map((x) => ({ wordId: x.wordId, type: x.type }));
    if (run.kind === 'day' && run.planDay.date <= todayKey(0)) { const r = I.finishDay(kid.id, lesson, run.planDay, score, total); talents = r && r.talents ? r.talents : 0; if (session.mock) talents += I.finishMock(kid.id, lesson, score, total, wrongList); }
    else if (run.kind === 'day' && session.mock) talents = I.finishMock(kid.id, lesson, score, total, wrongList);
    else if (run.kind === 'mock') talents = I.finishMock(kid.id, lesson, score, total, wrong.filter((x) => !x.retry).map((x) => ({ wordId: x.wordId, type: x.type })));
    if (score / Math.max(1, total) >= 0.8) celebrate(score === total ? 2 : 1);
    if (talents) sfx('coin');
    setDone({ total, talents });
  }

  if (!queue.length) return html`<${Empty} title="문제가 없어요" />`;
  if (done) return html`<${Result} lesson=${lesson} score=${score} total=${done.total} talents=${done.talents} wrong=${wrong.filter((x) => !x.retry)} onExit=${onExit} mock=${isMock} />`;
  const q = queue[idx];
  const section = isMock ? q.type : null;
  return html`<div class="stack" style="gap:12px">
    <div class="row between"><span class="badge" style=${`background:${TYPE_COLOR[q.type]}1A;color:${TYPE_COLOR[q.type]}`}>${I.TYPE_LABEL[q.type]}${q.retry ? ' · 다시 도전' : ''}</span><span class="small muted num">${Math.min(idx + 1, queue.length)} / ${queue.length} · 정답 ${score}</span></div>
    <${Bar} pct=${(idx / queue.length) * 100} kind="good" />
    ${q.type === 'fill' ? html`<${FillQ} key=${q.id} q=${q} lesson=${lesson} bank=${session.bankWords || [...new Set(session.questions.map((x) => (lesson.words.find((w) => w.id === x.wordId) || {}).word).filter(Boolean))]} mock=${isMock} onAnswer=${answer} onNext=${next} num=${idx + 1} />`
      : html`<${ChoiceQ} key=${q.id} q=${q} lesson=${lesson} mock=${isMock} onAnswer=${answer} onNext=${next} num=${idx + 1} />`}
  </div>`;
}

function Explain({ lesson, q }) {
  const w = lesson.words.find((x) => x.id === q.wordId);
  if (!w) return null;
  return html`<div class="tip" style="margin-top:12px;text-align:left;flex-direction:column;align-items:stretch">
    <div><b style="font-size:16px">${w.word}</b> <span class="muted">${w.ko}</span></div>
    ${w.senses.map((s) => html`<div class="small">${s.pos} ${s.def}${s.syn.length ? html` · <span style="color:#7C3AED">동 ${s.syn.join(', ')}</span>` : ''}${s.ant.length ? html` · <span style="color:#E11D48">반 ${s.ant.join(', ')}</span>` : ''}</div>`)}
  </div>`;
}

function ChoiceQ({ q, lesson, mock, onAnswer, onNext, num }) {
  const [picked, setPicked] = useState(null);
  const ok = picked != null && picked === q.answer;
  function choose(o) {
    if (picked != null) return;
    setPicked(o);
    const good = o === q.answer;
    sfx(good ? 'good' : 'bad');
    if (!good) vibrate(30);
    onAnswer(good, q, o);
    if (mock || good) setTimeout(onNext, mock ? 350 : 750);
  }
  return html`<section class="card">
    <div class="tiny bold muted" style="margin-bottom:8px">${q.instruction}</div>
    <div style="font-size:19px;font-weight:600;line-height:1.55"><span class="muted">${num}. </span><${Bold} text=${q.prompt} /></div>
    ${q.prompt2 && html`<div style="font-size:18px;margin-top:6px"><${Bold} text=${q.prompt2} /></div>`}
    <div class="stack" style="gap:8px;margin-top:16px">
      ${q.options.map((o, i) => html`<button key=${o} class=${'choice ' + (picked == null || mock ? (picked === o ? 'right' : '') : o === q.answer ? 'right' : picked === o ? 'wrong' : '')} style="font-size:16px;font-weight:700" onClick=${() => choose(o)}><span class="k">${'ABCD'[i]}</span>${o}</button>`)}
    </div>
    ${picked != null && !ok && !mock && html`<${Explain} lesson=${lesson} q=${q} /><button class="btn primary block" style="margin-top:10px" onClick=${onNext}>다음 문제</button>`}
  </section>`;
}

function FillQ({ q, lesson, bank, mock, onAnswer, onNext, num }) {
  const [v, setV] = useState('');
  const [res, setRes] = useState(null);
  const ref = useRef(null);
  const parts = q.prompt.split('___');
  function submit() {
    if (res != null || !v.trim()) return;
    const ok = I.checkFill(q, v);
    setRes(ok);
    sfx(ok ? 'good' : 'bad');
    onAnswer(ok, q, v.trim());
    if (mock || ok) setTimeout(onNext, mock ? 350 : 900);
  }
  const fb = res === false ? I.fillFeedback(q, v, lesson) : '';
  return html`<section class="card">
    <div class="tiny bold muted" style="margin-bottom:8px">${q.instruction}</div>
    <div style="font-size:19px;font-weight:600;line-height:1.7"><span class="muted">${num}. </span>${parts[0]}<span style=${`display:inline-block;min-width:120px;border-bottom:2px solid ${res == null ? 'var(--accent)' : res ? 'var(--good)' : 'var(--bad)'};text-align:center;color:${res === false ? 'var(--bad)' : 'var(--accent-ink)'};font-weight:800`}>${v || '\u00a0'}</span>${parts[1] || ''}</div>
    <div class="row wrap" style="gap:6px;margin-top:14px">${bank.map((b) => html`<button key=${b} class="chip" disabled=${res != null} onClick=${() => { setV(b); ref.current && ref.current.focus(); }}>${b}</button>`)}</div>
    <div class="row" style="margin-top:12px">
      <input ref=${ref} class="input" style="font-size:20px;font-weight:700" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="단어를 골라 어형에 맞게 고쳐 쓰세요" value=${v} disabled=${res != null} onInput=${(e) => setV(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && submit()} />
      <button class="btn primary" disabled=${res != null} onClick=${submit}>확인</button>
    </div>
    ${res === false && !mock && html`<div class="tip" style="margin-top:12px;background:var(--bad-soft)"><div>정답: <b style="font-size:17px">${q.answer}</b>${fb ? html` · ${fb}` : ''}</div></div><${Explain} lesson=${lesson} q=${q} /><button class="btn primary block" style="margin-top:10px" onClick=${onNext}>다음 문제</button>`}
    ${res === true && html`<div class="tip" style="margin-top:12px;background:var(--good-soft)"><${Emo} name="Hundred points" size=${20} />정답!</div>`}
  </section>`;
}

function Result({ lesson, score, total, talents, wrong, onExit, mock }) {
  const pct = Math.round((score / Math.max(1, total)) * 100);
  const byType = {};
  wrong.forEach((x) => { byType[x.type] = (byType[x.type] || 0) + 1; });
  return html`<section class="card" style="text-align:center">
    <${Ring} pct=${pct} size=${140} stroke=${14} color=${pct >= 85 ? 'var(--good)' : pct >= 60 ? '#F59E0B' : 'var(--bad)'}><div style="font-size:30px;font-weight:900">${score}<span class="muted" style="font-size:16px">/${total}</span></div><div class="tiny muted">${pct}%</div><//>
    <h2 style="font-size:24px;font-weight:900;margin-top:10px">${pct >= 90 ? '시험 준비 완벽해요!' : pct >= 70 ? '잘했어요! 틀린 것만 다시 보면 돼요' : '괜찮아요, 반복하면 확실히 늘어요'}</h2>
    ${talents > 0 && html`<div class="pill-talent" style="margin:12px auto 0;width:max-content"><${Emo} name="Coin" size=${30} />+${talents}</div>`}
    ${wrong.length > 0 && html`<div style="text-align:left;margin-top:16px">
      <div class="row wrap" style="gap:6px;margin-bottom:8px">${Object.entries(byType).map(([t, n]) => html`<span class="badge" style=${`background:${TYPE_COLOR[t]}1A;color:${TYPE_COLOR[t]}`}>${I.TYPE_LABEL[t]} ${n}개 틀림</span>`)}</div>
      ${wrong.map((x, i) => { const w = lesson.words.find((y) => y.id === x.wordId); return html`<div key=${i} class="list-row" style="align-items:flex-start">
        <span class="badge" style=${`background:${TYPE_COLOR[x.type]}1A;color:${TYPE_COLOR[x.type]}`}>${I.TYPE_LABEL[x.type]}</span>
        <div class="grow small"><div><${Bold} text=${x.prompt} /></div><div style="margin-top:2px"><span style="color:var(--bad)">내 답: ${x.given || '-'}</span> · <b style="color:var(--good)">정답: ${x.answer}</b></div><div class="tiny muted">${w ? `${w.word} = ${w.ko}` : ''}</div></div>
      </div>`; })}
    </div>`}
    <button class="btn primary lg" style="margin-top:16px" onClick=${onExit}>확인</button>
  </section>`;
}
