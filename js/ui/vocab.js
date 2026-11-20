// 영단어 아레나: 라이트너 간격반복 + 플래시카드 + 5가지 문제 유형 + 게임 4종 + 단어장
import { html, useState, useEffect, useRef, useMemo, Icon, Emo, Bar, Modal, toast, celebrate, Empty } from './core.js';
import * as M from '../model.js';
import { VOCAB_LEVELS } from '../../data/vocab.js';
import { speak, shuffle, sfx, vibrate, normalizeAnswer } from '../util.js';
import * as I from '../ile.js';
import { ILECard, ILERunner } from './ile.js';

let POOL = null; // 게임 단어 범위 (학원 레슨 단어로 바꿀 수 있음)

const BOX_LABEL = ['새 단어', '1일', '2일', '4일', '7일', '14일', '마스터'];

export function VocabTab({ kid }) {
  const [mode, setMode] = useState(null);
  const lesson = I.activeLesson(kid.id);
  const [ileRun, setIleRun] = useState(null);
  const [scope, setScope] = useState(lesson && I.dDay(lesson) >= 0 ? 'ile' : 'level');
  const startGame = (id) => { POOL = scope === 'ile' && lesson ? I.gamePool(lesson) : null; setMode(id); };
  if (ileRun && lesson) return html`<${ILERunner} kid=${kid} lesson=${lesson} run=${ileRun} onExit=${() => setIleRun(null)} />`; // null | 'daily' | 'speed' | 'memory' | 'spell' | 'sentence' | 'book'
  const vs = M.vocabStats(kid);
  const level = kid.profile?.vocabLevel || 2;
  const lv = VOCAB_LEVELS.find((l) => l.level === Number(level));
  const maxBox = Math.max(1, ...vs.boxes);

  if (mode === 'daily') return html`<${DailySession} kid=${kid} onExit=${() => setMode(null)} />`;
  if (mode === 'speed') return html`<${SpeedQuiz} kid=${kid} onExit=${() => setMode(null)} />`;
  if (mode === 'memory') return html`<${MemoryGame} kid=${kid} onExit=${() => setMode(null)} />`;
  if (mode === 'spell') return html`<${SpellingBee} kid=${kid} onExit=${() => setMode(null)} />`;
  if (mode === 'sentence') return html`<${SentenceGame} kid=${kid} onExit=${() => setMode(null)} />`;
  if (mode === 'book') return html`<${WordBook} kid=${kid} onExit=${() => setMode(null)} />`;

  const games = [
    { id: 'speed', name: '스피드 퀴즈', desc: '60초 동안 뜻 맞히기', e: 'Alarm clock' },
    { id: 'memory', name: '짝맞추기', desc: '영어 ↔ 한글 카드 뒤집기', e: 'Joystick' },
    { id: 'spell', name: '스펠링 비', desc: '듣고 철자 쓰기', e: 'Headphone' },
    { id: 'sentence', name: '문장 퍼즐', desc: '단어를 순서대로 배열', e: 'Puzzle piece' }
  ];
  return html`<div class="grid fade-in">
    ${lesson && html`<${ILECard} kid=${kid} lesson=${lesson} onRun=${setIleRun} />`}
    <div class="grid g-main">
      <section class="card" style="background:linear-gradient(135deg,var(--accent-soft),#fff)">
        <div class="row between wrap">
          <div><div class="eyebrow">${lv ? lv.label : 'Level ' + level}</div><h2 style="font-size:24px;font-weight:900;letter-spacing:-.03em;margin-top:4px">오늘의 단어 학습</h2>
            <div class="muted" style="margin-top:4px">새 단어 + 복습 단어를 망각곡선에 맞춰 자동으로 골라줘요</div></div>
          <${Emo} name="Books" size=${72} />
        </div>
        <div class="grid g-3" style="margin-top:16px;gap:10px">
          <div class="stat-tile"><${Emo} name="Open book" size=${44} /><div><div class="v">${vs.learned}</div><div class="l">익힌 단어</div></div></div>
          <div class="stat-tile"><${Emo} name="Sports medal" size=${44} /><div><div class="v">${vs.mastered}</div><div class="l">완벽 암기</div></div></div>
          <div class="stat-tile"><${Emo} name="Hourglass done" size=${44} /><div><div class="v">${vs.due}</div><div class="l">오늘 복습</div></div></div>
        </div>
        <div style="margin-top:16px">${vs.todayDone ? html`<div class="tip"><${Emo} name="Hundred points" size=${24} /><div><b>오늘 학습 완료!</b> 아래 게임으로 실력을 더 키워 보세요 (게임 1판당 +1, 하루 4개까지)</div></div>`
          : html`<button class="btn primary lg block" onClick=${() => setMode('daily')}><${Icon} name="play" size=${20} />시작하기 · 달란트 +3 (만점 +1)</button>`}</div>
      </section>
      <section class="card">
        <div class="card-h"><${Emo} name="Brain" size=${30} /><div class="grow"><h2>기억 상자</h2><div class="muted small">맞히면 다음 상자로, 틀리면 1일 상자로</div></div></div>
        <div class="box-bars">${vs.boxes.map((n, i) => html`<div key=${i} class="bb"><span class="num" style="color:var(--text);font-size:13px">${n}</span><i style=${`height:${(n / maxBox) * 80 + 4}px;${i === 6 ? 'background:linear-gradient(180deg,#F59E0B,#FDE68A)' : ''}`}></i>${BOX_LABEL[i]}</div>`)}</div>
        <button class="btn block" style="margin-top:14px" onClick=${() => setMode('book')}><${Icon} name="book-a" size=${18} />단어장 보기</button>
      </section>
    </div>
    ${lesson && html`<div class="row wrap"><span class="small bold">게임 단어 범위</span><div class="seg"><button class=${scope === 'ile' ? 'on' : ''} onClick=${() => setScope('ile')}>학원 Lesson ${lesson.lesson}</button><button class=${scope === 'level' ? 'on' : ''} onClick=${() => setScope('level')}>내 레벨 단어</button></div></div>`}
    <div class="grid g-4">
      ${games.map((g) => html`<button key=${g.id} class="game-card" onClick=${() => startGame(g.id)}><${Emo} name=${g.e} size=${52} /><div><h4>${g.name}</h4><div class="small muted">${g.desc}</div></div></button>`)}
    </div>
  </div>`;
}

function GameShell({ title, onExit, right, children }) {
  return html`<div class="stack fade-in" style="gap:16px;max-width:760px;margin:0 auto">
    <div class="row"><button class="icon-btn" aria-label="나가기" onClick=${onExit}><${Icon} name="x" /></button><h2 class="grow" style="font-size:20px;font-weight:800">${title}</h2>${right}</div>
    ${children}
  </div>`;
}

// 오답 보기 만들기
function distractors(word, field, n = 3) {
  if (POOL && POOL.some((w) => w.id === word.id)) return shuffle(POOL.filter((w) => w.id !== word.id && w[field] !== word[field])).slice(0, n);
  const pool = M.allWords().filter((w) => w.id !== word.id && w[field] !== word[field]);
  const near = pool.filter((w) => Math.abs(Number(w.level) - Number(word.level)) <= 1);
  return shuffle(near.length >= n ? near : pool).slice(0, n);
}

// ---------- 오늘의 학습 ----------
function DailySession({ kid, onExit }) {
  const plan = useMemo(() => M.buildDailySession(kid), []);
  const [phase, setPhase] = useState(plan.fresh.length ? 'learn' : 'quiz');
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const queue = useMemo(() => {
    const base = shuffle([...plan.fresh, ...plan.due]);
    return base.map((w, idx) => {
      const st = M.wordState(kid, w.id);
      const box = st ? st.b || 0 : 0;
      const types = box <= 1 ? ['meaning', 'listen'] : box <= 3 ? ['reverse', 'tiles', 'meaning'] : ['spell', 'sentence', 'tiles'];
      let type = types[idx % types.length];
      if (type === 'sentence' && !w.sentence) type = 'tiles';
      if (type === 'tiles' && w.word.length > 11) type = 'reverse';
      return { w, type };
    });
  }, []);
  const [qi, setQi] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrongs, setWrongs] = useState([]);
  const [reward, setReward] = useState(null);
  const total = queue.length;

  useEffect(() => { if (phase === 'learn' && plan.fresh[i]) speak(plan.fresh[i].word); }, [i, phase]);

  if (!total) return html`<${GameShell} title="오늘의 단어" onExit=${onExit}><${Empty} emoji="Party popper" title="학습할 단어가 없어요" sub="부모님께 단어 레벨을 올려 달라고 해 보세요!" /><//>`;

  if (phase === 'learn') {
    const w = plan.fresh[i];
    return html`<${GameShell} title=${`새 단어 익히기 ${i + 1}/${plan.fresh.length}`} onExit=${onExit} right=${html`<span class="badge accent">STEP 1</span>`}>
      <${Bar} pct=${((i + 1) / plan.fresh.length) * 100} />
      <div class=${'flash-card ' + (flipped ? 'flipped' : '')} onClick=${() => { setFlipped(!flipped); sfx('tap'); }}>
        <div class="flash-inner">
          <div class="flash-face">
            <span class="badge">${w.pos || ''}</span>
            <div class="flash-word">${w.word}</div>
            ${w.ipa && html`<div class="muted">${w.ipa}</div>`}
            <div class="small muted" style="margin-top:6px">탭해서 뜻 보기</div>
          </div>
          <div class="flash-face back">
            <div class="flash-mean">${w.meaning}</div>
            ${w.sentence && html`<div style="font-size:17px;font-weight:700;margin-top:6px">${w.sentence}</div><div class="muted">${w.sentenceKo}</div>`}
          </div>
        </div>
      </div>
      <div class="row" style="justify-content:center">
        <button class="btn" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${18} />단어</button>
        ${w.sentence && html`<button class="btn" onClick=${() => speak(w.sentence)}><${Icon} name="volume-2" size=${18} />예문</button>`}
        <button class="btn primary" onClick=${() => { setFlipped(false); if (i + 1 < plan.fresh.length) setI(i + 1); else setPhase('quiz'); }}>알겠어요 <${Icon} name="arrow-right" size=${18} /></button>
      </div>
    <//>`;
  }

  if (phase === 'done') {
    return html`<${GameShell} title="학습 완료!" onExit=${onExit}>
      <section class="card" style="text-align:center">
        <${Emo} name=${correct === total ? 'Trophy' : 'Party popper'} size=${96} />
        <h2 style="font-size:28px;font-weight:900;margin-top:8px">${correct} / ${total} 정답</h2>
        <div class="muted">${correct === total ? '만점! 보너스 달란트까지 획득!' : '틀린 단어는 내일 다시 나와요. 잘했어요!'}</div>
        ${reward > 0 && html`<div class="pill-talent" style="margin:14px auto 0;width:max-content"><${Emo} name="Coin" size=${30} />+${reward}</div>`}
        ${wrongs.length > 0 && html`<div class="stack" style="margin-top:16px;text-align:left">${wrongs.map((w) => html`<div class="list-row" key=${w.id}><button class="icon-btn sm" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${16} /></button><b>${w.word}</b><span class="muted">${w.meaning}</span></div>`)}</div>`}
        <button class="btn primary lg" style="margin-top:16px" onClick=${onExit}>확인</button>
      </section>
    <//>`;
  }

  const q = queue[qi];
  function answered(ok) {
    M.recordWord(kid.id, q.w.id, ok);
    if (ok) setCorrect((c) => c + 1); else setWrongs((l) => [...l, q.w]);
    setTimeout(() => {
      if (qi + 1 < total) setQi(qi + 1);
      else {
        const c = correct + (ok ? 1 : 0);
        const t = M.finishDailyVocab(kid.id, c, total);
        setReward(t);
        if (t) { sfx('coin'); celebrate(c === total ? 2 : 1); }
        setPhase('done');
      }
    }, ok ? 650 : 1500);
  }
  return html`<${GameShell} title=${`퀴즈 ${qi + 1}/${total}`} onExit=${onExit} right=${html`<span class="badge good">정답 ${correct}</span>`}>
    <${Bar} pct=${(qi / total) * 100} kind="good" />
    <${Question} key=${qi} q=${q} onAnswer=${answered} />
  <//>`;
}

// ---------- 문제 유형 ----------
function Question({ q, onAnswer }) {
  const { w, type } = q;
  if (type === 'meaning' || type === 'listen' || type === 'reverse') return html`<${ChoiceQ} w=${w} type=${type} onAnswer=${onAnswer} />`;
  if (type === 'tiles') return html`<${TilesQ} w=${w} onAnswer=${onAnswer} />`;
  if (type === 'spell') return html`<${SpellQ} w=${w} onAnswer=${onAnswer} />`;
  if (type === 'sentence') return html`<${SentenceQ} w=${w} onAnswer=${onAnswer} />`;
  return null;
}

function ChoiceQ({ w, type, onAnswer }) {
  const field = type === 'reverse' ? 'word' : 'meaning';
  const opts = useMemo(() => shuffle([w, ...distractors(w, field)]), [w.id]);
  const [picked, setPicked] = useState(null);
  useEffect(() => { if (type !== 'reverse') speak(w.word); }, [w.id]);
  function choose(o) {
    if (picked) return;
    setPicked(o.id);
    const ok = o.id === w.id;
    sfx(ok ? 'good' : 'bad');
    if (!ok) vibrate(40);
    onAnswer(ok);
  }
  return html`<section class="card" style="text-align:center">
    <div class="eyebrow">${type === 'meaning' ? '알맞은 뜻을 고르세요' : type === 'listen' ? '듣고 알맞은 뜻을 고르세요' : '알맞은 영어 단어를 고르세요'}</div>
    <div style="margin:14px 0 18px">
      ${type === 'meaning' && html`<div class="flash-word">${w.word}</div>`}
      ${type === 'listen' && html`<button class="btn lg primary" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${22} />다시 듣기</button>`}
      ${type === 'reverse' && html`<div class="flash-mean">${w.meaning}</div>`}
    </div>
    <div class="choice-grid">${opts.map((o, i) => html`<button key=${o.id} class=${'choice ' + (picked ? (o.id === w.id ? 'right' : picked === o.id ? 'wrong' : '') : '')} onClick=${() => choose(o)}><span class="k">${i + 1}</span>${o[field]}</button>`)}</div>
    ${picked && picked !== w.id && html`<div class="tip" style="margin-top:12px;text-align:left"><b>${w.word}</b> = ${w.meaning}</div>`}
  </section>`;
}

function TilesQ({ w, onAnswer }) {
  const letters = useMemo(() => {
    const arr = w.word.split('').map((ch, i) => ({ id: i, ch }));
    let s = shuffle(arr);
    if (s.map((x) => x.ch).join('') === w.word && arr.length > 1) s = s.reverse();
    return s;
  }, [w.id]);
  const [picked, setPicked] = useState([]);
  const [res, setRes] = useState(null);
  const answer = picked.map((id) => letters.find((l) => l.id === id).ch).join('');
  useEffect(() => {
    if (picked.length === letters.length && res === null) {
      const ok = answer === w.word;
      setRes(ok); sfx(ok ? 'good' : 'bad'); onAnswer(ok);
    }
  }, [picked.length]);
  return html`<section class="card" style="text-align:center">
    <div class="eyebrow">글자를 순서대로 눌러 단어를 완성하세요</div>
    <div class="flash-mean" style="margin:10px 0">${w.meaning}</div>
    <button class="btn sm" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${16} />힌트 듣기</button>
    <div class="answer-line" style=${`margin:14px 0;${res === false ? 'border-color:var(--bad)' : res ? 'border-color:var(--good)' : ''}`}>${picked.map((id) => html`<button key=${id} class="tile" onClick=${() => res === null && setPicked(picked.filter((x) => x !== id))}>${letters.find((l) => l.id === id).ch === ' ' ? '␣' : letters.find((l) => l.id === id).ch}</button>`)}</div>
    <div class="tiles">${letters.map((l) => html`<button key=${l.id} class=${'tile ' + (picked.includes(l.id) ? 'used' : '')} onClick=${() => { sfx('tap'); setPicked([...picked, l.id]); }}>${l.ch === ' ' ? '␣' : l.ch}</button>`)}</div>
    ${res === false && html`<div class="tip" style="margin-top:12px">정답: <b>${w.word}</b></div>`}
  </section>`;
}

function SpellQ({ w, onAnswer }) {
  const [v, setV] = useState('');
  const [res, setRes] = useState(null);
  useEffect(() => { speak(w.word); }, [w.id]);
  function submit() {
    if (res !== null) return;
    const ok = normalizeAnswer(v) === normalizeAnswer(w.word);
    setRes(ok); sfx(ok ? 'good' : 'bad'); onAnswer(ok);
  }
  return html`<section class="card" style="text-align:center">
    <div class="eyebrow">듣고 철자를 쓰세요</div>
    <div class="row" style="justify-content:center;margin:14px 0"><button class="btn lg primary" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${22} />듣기</button><button class="btn lg" onClick=${() => speak(w.word, 'en-US', 0.55)}>천천히</button></div>
    <div class="muted" style="margin-bottom:10px">뜻: ${w.meaning}</div>
    <input class="input" autocapitalize="off" autocomplete="off" spellcheck="false" style=${`font-size:24px;height:60px;text-align:center;font-weight:800;${res === false ? 'border-color:var(--bad)' : res ? 'border-color:var(--good)' : ''}`} value=${v} onInput=${(e) => setV(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && submit()} />
    <button class="btn primary lg block" style="margin-top:12px" onClick=${submit}>확인</button>
    ${res === false && html`<div class="tip" style="margin-top:12px">정답: <b>${w.word}</b></div>`}
  </section>`;
}

function SentenceQ({ w, onAnswer }) {
  const tokens = useMemo(() => {
    const t = w.sentence.split(/\s+/).map((x, i) => ({ id: i, x }));
    let s = shuffle(t);
    if (s.every((v, i) => v.id === i) && t.length > 1) s = s.reverse();
    return s;
  }, [w.id]);
  const [picked, setPicked] = useState([]);
  const [res, setRes] = useState(null);
  useEffect(() => {
    if (picked.length === tokens.length && res === null) {
      const built = picked.map((id) => tokens.find((t) => t.id === id).x).join(' ');
      const ok = normalizeAnswer(built) === normalizeAnswer(w.sentence);
      setRes(ok); sfx(ok ? 'good' : 'bad'); if (ok) speak(w.sentence); onAnswer(ok);
    }
  }, [picked.length]);
  return html`<section class="card" style="text-align:center">
    <div class="eyebrow">단어를 순서대로 배열해 문장을 완성하세요</div>
    <div class="muted" style="margin:10px 0;font-size:16px">${w.sentenceKo}</div>
    <div class="answer-line" style="margin:12px 0">${picked.map((id) => html`<button key=${id} class="tile" style="font-size:17px" onClick=${() => res === null && setPicked(picked.filter((x) => x !== id))}>${tokens.find((t) => t.id === id).x}</button>`)}</div>
    <div class="tiles">${tokens.map((t) => html`<button key=${t.id} class=${'tile ' + (picked.includes(t.id) ? 'used' : '')} style="font-size:17px" onClick=${() => { sfx('tap'); setPicked([...picked, t.id]); }}>${t.x}</button>`)}</div>
    ${res === false && html`<div class="tip" style="margin-top:12px">정답: <b>${w.sentence}</b></div>`}
  </section>`;
}

// ---------- 게임 ----------
function practicePool(kid) {
  if (POOL) return POOL;
  const states = (kid.vocab || {}).words || {};
  const learned = M.allWords().filter((w) => states[w.id]);
  const lvl = M.wordsForLevel(kid.profile?.vocabLevel || 2);
  return learned.length >= 12 ? learned : [...learned, ...lvl];
}
function GameResult({ title, score, sub, onExit, onRetry, kid, gameName }) {
  const [t, setT] = useState(null);
  useEffect(() => { const r = M.finishGame(kid.id, gameName, score); setT(r); if (r) { sfx('coin'); celebrate(1); } }, []);
  return html`<section class="card" style="text-align:center">
    <${Emo} name="Trophy" size=${90} />
    <h2 style="font-size:26px;font-weight:900;margin-top:8px">${title}</h2>
    <div class="muted">${sub}</div>
    ${t > 0 ? html`<div class="pill-talent" style="margin:14px auto 0;width:max-content"><${Emo} name="Coin" size=${30} />+${t}</div>` : t === 0 && html`<div class="small muted" style="margin-top:10px">오늘 게임 달란트는 모두 받았어요. 연습은 계속 할 수 있어요!</div>`}
    <div class="row" style="justify-content:center;margin-top:16px"><button class="btn" onClick=${onExit}>나가기</button><button class="btn primary" onClick=${onRetry}>한 판 더</button></div>
  </section>`;
}

function SpeedQuiz({ kid, onExit }) {
  const [round, setRound] = useState(0);
  return html`<${SpeedQuizRound} key=${round} kid=${kid} onExit=${onExit} onRetry=${() => setRound(round + 1)} />`;
}
function SpeedQuizRound({ kid, onExit, onRetry }) {
  const pool = useMemo(() => shuffle(practicePool(kid)), []);
  const [left, setLeft] = useState(60);
  const [n, setN] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  useEffect(() => { const t = setInterval(() => setLeft((l) => (l > 0 ? l - 1 : 0)), 1000); return () => clearInterval(t); }, []);
  const w = pool[n % pool.length];
  const opts = useMemo(() => shuffle([w, ...distractors(w, 'meaning')]), [n]);
  if (left === 0) return html`<${GameShell} title="스피드 퀴즈" onExit=${onExit}><${GameResult} kid=${kid} gameName="스피드 퀴즈" title=${`${score}개 정답!`} score=${`${score}점`} sub="60초 동안 맞힌 개수" onExit=${onExit} onRetry=${onRetry} /><//>`;
  function choose(o) {
    if (picked) return;
    setPicked(o.id);
    const ok = o.id === w.id;
    sfx(ok ? 'good' : 'bad');
    if (ok) setScore(score + 1);
    setTimeout(() => { setPicked(null); setN(n + 1); }, ok ? 250 : 700);
  }
  return html`<${GameShell} title="스피드 퀴즈" onExit=${onExit} right=${html`<span class=${'badge ' + (left <= 10 ? 'bad' : 'accent')}><${Icon} name="timer" size=${14} />${left}초</span><span class="badge good">${score}</span>`}>
    <${Bar} pct=${(left / 60) * 100} kind=${left <= 10 ? '' : 'good'} />
    <section class="card" style="text-align:center">
      <div class="flash-word" style="margin:8px 0 18px">${w.word}</div>
      <div class="choice-grid">${opts.map((o, i) => html`<button key=${o.id} class=${'choice ' + (picked ? (o.id === w.id ? 'right' : picked === o.id ? 'wrong' : '') : '')} onClick=${() => choose(o)}><span class="k">${i + 1}</span>${o.meaning}</button>`)}</div>
    </section>
  <//>`;
}

function MemoryGame({ kid, onExit }) {
  const [round, setRound] = useState(0);
  return html`<${MemoryRound} key=${round} kid=${kid} onExit=${onExit} onRetry=${() => setRound(round + 1)} />`;
}
function MemoryRound({ kid, onExit, onRetry }) {
  const cards = useMemo(() => {
    const words = shuffle(practicePool(kid)).filter((w, i, a) => a.findIndex((x) => x.meaning === w.meaning) === i).slice(0, 6);
    return shuffle(words.flatMap((w) => [{ k: w.id + 'e', pair: w.id, text: w.word, en: true }, { k: w.id + 'k', pair: w.id, text: w.meaning }]));
  }, []);
  const [open, setOpen] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const start = useRef(Date.now());
  function flip(c) {
    if (open.length === 2 || open.includes(c.k) || matched.includes(c.pair)) return;
    sfx('tap');
    if (c.en) speak(c.text);
    const next = [...open, c.k];
    setOpen(next);
    if (next.length === 2) {
      setMoves(moves + 1);
      const [a, b] = next.map((k) => cards.find((x) => x.k === k));
      if (a.pair === b.pair) { setTimeout(() => { setMatched([...matched, a.pair]); setOpen([]); sfx('good'); }, 350); }
      else setTimeout(() => setOpen([]), 900);
    }
  }
  if (matched.length === cards.length / 2) {
    const secs = Math.round((Date.now() - start.current) / 1000);
    return html`<${GameShell} title="짝맞추기" onExit=${onExit}><${GameResult} kid=${kid} gameName="짝맞추기" title="모두 찾았어요!" score=${`${moves}번 만에`} sub=${`${moves}번 시도 · ${secs}초`} onExit=${onExit} onRetry=${onRetry} /><//>`;
  }
  return html`<${GameShell} title="짝맞추기" onExit=${onExit} right=${html`<span class="badge">시도 ${moves}</span>`}>
    <div class="memory-grid">${cards.map((c) => html`<button key=${c.k} class=${'mem ' + (open.includes(c.k) ? 'open ' : '') + (matched.includes(c.pair) ? 'matched' : '')} onClick=${() => flip(c)}>${open.includes(c.k) || matched.includes(c.pair) ? c.text : '?'}</button>`)}</div>
  <//>`;
}

function SpellingBee({ kid, onExit }) {
  const [round, setRound] = useState(0);
  const words = useMemo(() => shuffle(practicePool(kid)).filter((w) => !w.word.includes(' ')).slice(0, 8), [round]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  if (i >= words.length) return html`<${GameShell} title="스펠링 비" onExit=${onExit}><${GameResult} kid=${kid} gameName="스펠링 비" title=${`${score} / ${words.length}`} score=${`${score}/${words.length}`} sub="철자 정답 수" onExit=${onExit} onRetry=${() => { setRound(round + 1); setI(0); setScore(0); }} /><//>`;
  return html`<${GameShell} title=${`스펠링 비 ${i + 1}/${words.length}`} onExit=${onExit} right=${html`<span class="badge good">${score}</span>`}>
    <${SpellQ} key=${round + '_' + i} w=${words[i]} onAnswer=${(ok) => { if (ok) setScore((s) => s + 1); setTimeout(() => setI(i + 1), ok ? 600 : 1500); }} />
  <//>`;
}

function SentenceGame({ kid, onExit }) {
  const [round, setRound] = useState(0);
  const words = useMemo(() => shuffle(practicePool(kid)).filter((w) => w.sentence && w.sentence.split(' ').length <= 9).slice(0, 5), [round]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  if (i >= words.length) return html`<${GameShell} title="문장 퍼즐" onExit=${onExit}><${GameResult} kid=${kid} gameName="문장 퍼즐" title=${`${score} / ${words.length}`} score=${`${score}/${words.length}`} sub="완성한 문장 수" onExit=${onExit} onRetry=${() => { setRound(round + 1); setI(0); setScore(0); }} /><//>`;
  return html`<${GameShell} title=${`문장 퍼즐 ${i + 1}/${words.length}`} onExit=${onExit} right=${html`<span class="badge good">${score}</span>`}>
    <${SentenceQ} key=${round + '_' + i} w=${words[i]} onAnswer=${(ok) => { if (ok) setScore((s) => s + 1); setTimeout(() => setI(i + 1), ok ? 900 : 1800); }} />
  <//>`;
}

function WordBook({ kid, onExit }) {
  const [q, setQ] = useState('');
  const [lv, setLv] = useState(kid.profile?.vocabLevel || 2);
  const states = (kid.vocab || {}).words || {};
  const list = M.allWords().filter((w) => (lv === 0 ? states[w.id] : Number(w.level) === Number(lv)) && (!q || w.word.includes(q.toLowerCase()) || w.meaning.includes(q)));
  return html`<${GameShell} title="단어장" onExit=${onExit}>
    <div class="row wrap">
      <div class="seg">${[0, 1, 2, 3, 4, 5].map((l) => html`<button key=${l} class=${l === lv ? 'on' : ''} onClick=${() => setLv(l)}>${l === 0 ? '내 단어' : 'Lv.' + l}</button>`)}</div>
      <input class="input grow" style="max-width:260px" placeholder="검색" value=${q} onInput=${(e) => setQ(e.target.value)} />
    </div>
    <section class="card">
      ${list.length === 0 ? html`<${Empty} title="단어가 없어요" />` : list.map((w) => {
        const s = states[w.id];
        return html`<div class="list-row" key=${w.id}>
          <button class="icon-btn sm" onClick=${() => speak(w.word)}><${Icon} name="volume-2" size=${16} /></button>
          <div class="grow"><b style="font-size:16px">${w.word}</b> <span class="muted">${w.meaning}</span>${w.sentence && html`<div class="tiny muted">${w.sentence}</div>`}</div>
          ${s ? html`<span class=${'badge ' + ((s.b || 0) >= 5 ? 'gold' : 'accent')}>${BOX_LABEL[Math.min(6, s.b || 0)]}</span>` : html`<span class="badge">미학습</span>`}
        </div>`;
      })}
    </section>
  <//>`;
}
