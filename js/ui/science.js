// 학원 Science 시험 대비 화면 (영단어 아레나 안)
import { html, useState, useEffect, useMemo, useRef, Icon, Emo, Bar, Ring, celebrate, Empty } from './core.js';
import * as S from '../science.js';
import { speak, sfx, vibrate, shortDate, todayKey } from '../util.js';

const COLOR = { match: '#0EA5E9', mc: '#16A34A' };
const L_COLOR = ['#7C3AED', '#0EA5E9', '#F59E0B', '#E11D48', '#16A34A', '#0F766E'];

export function SciCard({ kid, test, onRun }) {
  const d = S.dDay(test);
  const { plan, todays, missed } = S.planToday(kid, test);
  const next = todays && !todays.done ? todays : missed[0] || null;
  const lacc = S.lessonAccuracy(kid, test);
  const tacc = S.typeAccuracy(kid, test);
  const mocks = S.mocksOf(kid, test);
  return html`<section class="card" style="border:2px solid #BAE6FD">
    <div class="row between wrap">
      <div>
        <div class="eyebrow">학원 Science 시험 대비 · ${test.book || 'Elevate Science'}</div>
        <h2 style="font-size:23px;font-weight:900;letter-spacing:-.03em;margin-top:2px">${test.title}</h2>
        <div class="muted small">시험일 ${shortDate(test.testDate)} · 핵심 용어 ${test.terms.length}개 · 개념 문제 ${test.mcq.length}개 · 실제 시험처럼 용어 매칭 + 객관식</div>
      </div>
      <div class=${'badge ' + (d <= 1 ? 'bad' : 'accent')} style="font-size:20px;height:42px;padding:0 16px">${d > 0 ? `D-${d}` : d === 0 ? 'D-DAY' : '시험 끝'}</div>
    </div>
    <div class="scroll-x" style="margin-top:14px"><div class="row" style="gap:8px;min-width:max-content">
      ${plan.map((p) => {
        const isToday = p.date === todayKey(0);
        return html`<button key=${p.day} class="card flat tight" style=${`width:160px;text-align:left;padding:12px;${isToday ? 'border:2px solid #0EA5E9;background:#E0F2FE' : ''}${p.done ? ';background:var(--good-soft)' : ''}`} onClick=${() => onRun({ kind: 'day', planDay: p })}>
          <div class="row between"><span class="tiny bold">${shortDate(p.date)}</span>${p.done ? html`<span class="badge good">완료 ${p.result && p.result.total ? `${p.result.score}/${p.result.total}` : ''}</span>` : isToday ? html`<span class="badge accent">오늘</span>` : p.date < todayKey(0) ? html`<span class="badge warn">밀림</span>` : html`<span class="badge">미리보기</span>`}</div>
          <div class="small bold" style="margin-top:6px;line-height:1.35">${p.title}</div>
        </button>`;
      })}
    </div></div>
    ${next ? html`<button class="btn primary lg block" style="margin-top:14px" onClick=${() => onRun({ kind: 'day', planDay: next })}><${Icon} name="play" size=${20} />${next.date === todayKey(0) ? '오늘 Science 학습 시작' : `밀린 학습: ${shortDate(next.date)}`} · ${next.title}</button>`
      : html`<div class="tip" style="margin-top:14px;background:var(--good-soft)"><${Emo} name="Hundred points" size=${22} /><div>오늘 계획 완료! 단원별 연습이나 모의고사로 더 다져 보세요.</div></div>`}
    <hr class="sep" />
    <div class="eyebrow" style="margin-bottom:8px">단원별 연습 · 정답률</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
      ${S.lessonNums(test).map((l, i) => html`<button key=${l} class="game-card" style="padding:12px;flex-direction:column;align-items:flex-start;gap:6px" onClick=${() => onRun({ kind: 'lesson', lesson: l })}>
        <span class="badge" style=${`background:${L_COLOR[i % 6]}1A;color:${L_COLOR[i % 6]}`}>Lesson ${l}</span>
        <span class="small bold" style="line-height:1.3">${test.lessons[l]}</span>
        <span class="bold num" style="font-size:18px">${lacc[l].pct == null ? '-' : lacc[l].pct + '%'}</span>
        <span class="tiny muted">${lacc[l].c + lacc[l].w}문제 풀이</span>
      </button>`)}
    </div>
    <div class="row wrap" style="margin-top:12px">
      <button class="btn" onClick=${() => onRun({ kind: 'mock' })}><${Icon} name="file-text" size=${18} />실전 모의고사 30문항</button>
      <button class="btn" onClick=${() => onRun({ kind: 'type', type: 'match' })}><${Icon} name="list-checks" size=${18} />용어 매칭 ${tacc.match.pct == null ? '' : tacc.match.pct + '%'}</button>
      <button class="btn" onClick=${() => onRun({ kind: 'type', type: 'mc' })}><${Icon} name="circle-help" size=${18} />개념 객관식 ${tacc.mc.pct == null ? '' : tacc.mc.pct + '%'}</button>
      <button class="btn" onClick=${() => onRun({ kind: 'cards' })}><${Icon} name="book-a" size=${18} />용어 카드</button>
      <button class="btn" onClick=${() => onRun({ kind: 'weak' })}><${Icon} name="target" size=${18} />틀린 것 다시</button>
      ${mocks[0] && html`<span class="badge gold" style="height:30px">최근 모의고사 ${mocks[0].score}/${mocks[0].total}</span>`}
    </div>
  </section>`;
}

export function SciRunner({ kid, test, run, onExit }) {
  const session = useMemo(() => {
    if (run.kind === 'day') return S.buildDay(kid, test, run.planDay);
    if (run.kind === 'mock') return { cards: [], ...S.buildMock(test), mock: true };
    if (run.kind === 'lesson') return { ...S.buildLessonDrill(kid, test, run.lesson), cards: test.terms.filter((x) => Number(x.l) === run.lesson) };
    if (run.kind === 'type') return S.buildTypeDrill(kid, test, run.type);
    if (run.kind === 'weak') return S.buildWeak(kid, test);
    return { cards: test.terms, questions: [], cardsOnly: true };
  }, []);
  const [phase, setPhase] = useState(session.cards.length ? 'cards' : 'quiz');
  const title = run.kind === 'day' ? `Day ${run.planDay.day} · ${run.planDay.title}${run.planDay.date > todayKey(0) ? ' (미리 연습 · 기록은 그날 완료)' : ''}`
    : run.kind === 'mock' ? `${test.title} 실전 모의고사` : run.kind === 'lesson' ? `Lesson ${run.lesson} · ${test.lessons[run.lesson]}`
    : run.kind === 'type' ? `${S.TYPE_LABEL[run.type]} 연습` : run.kind === 'weak' ? '틀린 것 다시' : '용어 카드';
  return html`<div class="stack fade-in" style="gap:16px;max-width:820px;margin:0 auto">
    <div class="row"><button class="icon-btn" aria-label="나가기" onClick=${onExit}><${Icon} name="x" /></button><h2 class="grow" style="font-size:19px;font-weight:800">${title}</h2></div>
    ${phase === 'cards' && html`<${TermCards} test=${test} terms=${session.cards} onDone=${session.cardsOnly ? onExit : () => setPhase('quiz')} doneLabel=${session.cardsOnly ? '닫기' : '문제 풀기 시작'} />`}
    ${phase === 'quiz' && (session.questions.length ? html`<${Quiz} kid=${kid} test=${test} session=${session} run=${run} onExit=${onExit} />` : html`<${Empty} title="아직 틀린 문제가 없어요" sub="단원별 연습이나 모의고사를 먼저 풀어 보세요" />`)}
  </div>`;
}

function TermCards({ test, terms, onDone, doneLabel }) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(false);
  const w = terms[i];
  useEffect(() => { setShow(false); if (w) speak(w.term); }, [i]);
  if (!w) return null;
  return html`<div class="stack" style="gap:12px">
    <${Bar} pct=${((i + 1) / terms.length) * 100} />
    <section class="card">
      <div class="row between wrap">
        <div><span class="badge">Lesson ${w.l}</span> <span style="font-size:32px;font-weight:900;letter-spacing:-.02em">${w.term}</span></div>
        <button class="btn sm" onClick=${() => speak(w.term)}><${Icon} name="volume-2" size=${16} />발음</button>
      </div>
      <div class="bold" style="font-size:20px;margin-top:4px;color:#0369A1">${w.ko}</div>
      <div style="margin-top:12px;padding:14px;border-radius:14px;background:var(--surface-2)">
        <div class="row"><b class="grow" style="font-size:17px;line-height:1.5">${w.def}</b><button class="icon-btn sm" onClick=${() => speak(w.def)}><${Icon} name="volume-2" size=${15} /></button></div>
      </div>
      <div class="tiny muted" style="margin-top:8px">시험에서는 이 영어 정의를 보고 단어 박스에서 용어를 골라요. 정의의 핵심 단어에 밑줄 긋듯 읽어 보세요.</div>
    </section>
    <div class="row between">
      <button class="btn" disabled=${i === 0} onClick=${() => setI(i - 1)}><${Icon} name="chevron-left" size=${18} />이전</button>
      <span class="small muted">${i + 1} / ${terms.length}</span>
      ${i + 1 < terms.length ? html`<button class="btn primary" onClick=${() => setI(i + 1)}>다음<${Icon} name="chevron-right" size=${18} /></button>` : html`<button class="btn primary" onClick=${onDone}>${doneLabel}<${Icon} name="arrow-right" size=${18} /></button>`}
    </div>
  </div>`;
}

function Quiz({ kid, test, session, run, onExit }) {
  const [queue, setQueue] = useState(session.questions);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [firstTotal] = useState(session.questions.length);
  const [wrong, setWrong] = useState([]);
  const [retried, setRetried] = useState({});
  const [done, setDone] = useState(null);
  const isMock = !!session.mock;
  const scoreRef = useRef(0);
  const wrongRef = useRef([]);

  function answer(ok, q, given) {
    S.record(kid.id, test.id, q.itemId, ok);
    if (ok && idx < firstTotal) { scoreRef.current += 1; setScore((s) => s + 1); }
    if (!ok) {
      wrongRef.current = [...wrongRef.current, { ...q, given }];
      setWrong((l) => [...l, { ...q, given }]);
      if (!isMock && !retried[q.itemId]) {
        const r = S.retry(test, q);
        if (r) { setQueue((l) => [...l, r]); setRetried((m) => ({ ...m, [q.itemId]: true })); }
      }
    }
  }
  function next() { if (idx + 1 < queue.length) setIdx(idx + 1); else finish(); }
  function finish() {
    const total = firstTotal;
    const score = scoreRef.current;
    const wrong = wrongRef.current;
    let talents = 0;
    const wl = wrong.filter((x) => !x.retry).map((x) => x.itemId);
    if (run.kind === 'day' && run.planDay.date <= todayKey(0) && !session.mock && score / Math.max(1, total) < 0.6) { S.saveAttempt(kid.id, test, run.planDay, score, total); setScore(score); setDone({ total, talents: 0, retryDay: true }); return; }
    if (run.kind === 'day' && run.planDay.date <= todayKey(0)) {
      const r = S.finishDay(kid.id, test, run.planDay, score, total);
      talents = r && r.talents ? r.talents : 0;
      if (session.mock) talents += S.finishMock(kid.id, test, score, total, wl);
    } else if (session.mock) talents = S.finishMock(kid.id, test, score, total, wl);
    if (score / Math.max(1, total) >= 0.8) celebrate(score === total ? 2 : 1);
    if (talents) sfx('coin');
    setScore(score);
    setDone({ total, talents });
  }
  if (done) return html`${done.retryDay && html`<div class="tip" style="background:var(--warn-soft);margin-bottom:10px"><b>정답률 60% 이상이면 오늘 학습이 완료돼요.</b> 틀린 문제를 보고 한 번 더 도전해요!</div>`}<${Result} score=${score} total=${done.total} talents=${done.talents} wrong=${wrongRef.current.filter((x) => !x.retry)} onExit=${onExit} />`;
  const q = queue[idx];
  const sectionStart = session.sections && (idx === 0 || queue[idx - 1].type !== q.type) && !q.retry;
  return html`<div class="stack" style="gap:12px">
    <div class="row between"><span class="badge" style=${`background:${COLOR[q.type]}1A;color:${COLOR[q.type]}`}>${S.TYPE_LABEL[q.type]} · Lesson ${q.l}${q.retry ? ' · 다시 도전' : ''}</span><span class="small muted num">${Math.min(idx + 1, queue.length)} / ${queue.length} · 정답 ${score}</span></div>
    <${Bar} pct=${(idx / queue.length) * 100} kind="good" />
    ${sectionStart && html`<div class="tip small" style="background:#E0F2FE"><b>Directions:</b> ${q.type === 'match' ? 'Match each definition with the correct word from the word box.' : 'Choose the correct answer for each question from the options provided.'}</div>`}
    ${q.type === 'match' ? html`<${MatchQ} key=${q.id} q=${q} mock=${isMock} onAnswer=${answer} onNext=${next} num=${idx + 1} />` : html`<${ChoiceQ} key=${q.id} q=${q} mock=${isMock} onAnswer=${answer} onNext=${next} num=${idx + 1} />`}
  </div>`;
}

// NOT / LEAST / EXCEPT 강조 (실제 시험지처럼)
function Prompt({ text }) {
  const lines = String(text).split('\n');
  return lines.map((ln, k) => html`<div key=${k} style=${k ? 'font-size:17px;font-weight:500;margin-top:4px' : ''}>${ln.split(/\b(NOT|LEAST|OPPOSITE|STRONGER|WITHOUT)\b/g).map((p, i) => (i % 2 ? html`<b style="color:#E11D48;text-decoration:underline">${p}</b>` : p))}</div>`);
}

function MatchQ({ q, mock, onAnswer, onNext, num }) {
  const [picked, setPicked] = useState(null);
  const ok = picked === q.answer;
  function choose(term) {
    if (picked != null) return;
    setPicked(term);
    const good = term === q.answer;
    sfx(good ? 'good' : 'bad');
    if (!good) vibrate(30);
    onAnswer(good, q, term);
    if (mock || good) setTimeout(onNext, mock ? 350 : 800);
  }
  return html`<section class="card">
    <div style="font-size:19px;font-weight:600;line-height:1.55"><span class="muted">${num}. ______ </span>${q.prompt}</div>
    <div style="margin-top:16px;border:2px solid var(--line-strong);border-radius:14px;padding:10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">
      ${q.box.map((b) => html`<button key=${b.id} class=${'choice ' + (picked == null || mock ? (picked === b.term ? 'right' : '') : b.term === q.answer ? 'right' : picked === b.term ? 'wrong' : '')} style="font-size:15px;font-weight:700;min-height:44px;padding:8px 10px" onClick=${() => choose(b.term)}><span class="k">${b.letter}</span>${b.term}</button>`)}
    </div>
    ${picked != null && !ok && !mock && html`<div class="tip" style="margin-top:12px;background:var(--bad-soft);flex-direction:column;align-items:stretch">
      <div>정답: <b style="font-size:17px">${q.answer}</b> <span class="muted">(${q.ko})</span></div>
      ${picked && html`<div class="small">내가 고른 <b>${picked}</b>는 다른 개념이에요. 정의의 핵심 단어를 다시 확인해 보세요.</div>`}
    </div><button class="btn primary block" style="margin-top:10px" onClick=${onNext}>다음 문제</button>`}
    ${picked != null && ok && !mock && html`<div class="tip" style="margin-top:12px;background:var(--good-soft)"><${Emo} name="Hundred points" size=${20} />정답! ${q.answer} = ${q.ko}</div>`}
  </section>`;
}

function ChoiceQ({ q, mock, onAnswer, onNext, num }) {
  const [picked, setPicked] = useState(null);
  const ok = picked === q.answer;
  function choose(o) {
    if (picked != null) return;
    setPicked(o);
    const good = o === q.answer;
    sfx(good ? 'good' : 'bad');
    if (!good) vibrate(30);
    onAnswer(good, q, o);
    if (mock) setTimeout(onNext, 350);
  }
  return html`<section class="card">
    <div style="font-size:19px;font-weight:600;line-height:1.55"><span class="muted">${num}. </span><${Prompt} text=${q.prompt} /></div>
    <div class="stack" style="gap:8px;margin-top:16px">
      ${q.options.map((o, i) => html`<button key=${i} class=${'choice ' + (picked == null || mock ? (picked === o ? 'right' : '') : o === q.answer ? 'right' : picked === o ? 'wrong' : '')} style="font-size:16px;font-weight:600;text-align:left" onClick=${() => choose(o)}><span class="k">${'ABCD'[i]}</span>${o}</button>`)}
    </div>
    ${picked != null && !mock && html`<div class="tip" style=${`margin-top:12px;background:${ok ? 'var(--good-soft)' : 'var(--bad-soft)'};flex-direction:column;align-items:stretch`}>
      <div><b>${ok ? '정답!' : '정답: ' + q.answer}</b></div>
      ${q.e && html`<div class="small" style="margin-top:4px">${q.e}</div>`}
    </div><button class="btn primary block" style="margin-top:10px" onClick=${onNext}>다음 문제</button>`}
  </section>`;
}

function Result({ score, total, talents, wrong, onExit }) {
  const pct = Math.round((score / Math.max(1, total)) * 100);
  const byL = {};
  wrong.forEach((x) => { byL[x.l] = (byL[x.l] || 0) + 1; });
  return html`<section class="card" style="text-align:center">
    <${Ring} pct=${pct} size=${140} stroke=${14} color=${pct >= 85 ? 'var(--good)' : pct >= 60 ? '#F59E0B' : 'var(--bad)'}><div style="font-size:30px;font-weight:900">${score}<span class="muted" style="font-size:16px">/${total}</span></div><div class="tiny muted">${pct}%</div><//>
    <h2 style="font-size:24px;font-weight:900;margin-top:10px">${pct >= 90 ? 'Science 시험 준비 완벽해요!' : pct >= 70 ? '잘했어요! 틀린 것만 다시 보면 돼요' : '괜찮아요, 반복하면 확실히 늘어요'}</h2>
    ${talents > 0 && html`<div class="pill-talent" style="margin:12px auto 0;width:max-content"><${Emo} name="Coin" size=${30} />+${talents}</div>`}
    ${wrong.length > 0 && html`<div style="text-align:left;margin-top:16px">
      <div class="row wrap" style="gap:6px;margin-bottom:8px">${Object.entries(byL).map(([l, n]) => html`<span class="badge warn">Lesson ${l} · ${n}개 틀림</span>`)}</div>
      ${wrong.map((x, i) => html`<div key=${i} class="list-row" style="align-items:flex-start">
        <span class="badge" style=${`background:${COLOR[x.type]}1A;color:${COLOR[x.type]}`}>${S.TYPE_LABEL[x.type]}</span>
        <div class="grow small"><div style="white-space:pre-line">${x.prompt}</div><div style="margin-top:2px"><span style="color:var(--bad)">내 답: ${x.given || '-'}</span> · <b style="color:var(--good)">정답: ${x.answer}</b></div><div class="tiny muted">${x.type === 'match' ? x.ko : x.e || ''}</div></div>
      </div>`)}
    </div>`}
    <button class="btn primary lg" style="margin-top:16px" onClick=${onExit}>확인</button>
  </section>`;
}
