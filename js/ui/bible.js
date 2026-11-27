// 말씀 미션: 오늘의 성경 구절을 소리 내어 3번 읽고 → 단어 카드를 순서대로 맞춰 암송
import { html, useState, useRef, Icon, Emo, Modal, toast, celebrate, Reward } from './core.js';
import * as M from '../model.js';
import { speak, sfx, vibrate, shuffle, todayKey, hhmm } from '../util.js';

const READS = 3;

export function VerseCard({ kid, date, onOpen }) {
  const v = M.verseFor(kid, date);
  const done = M.verseDone(kid, date);
  if (!v) return null;
  return html`<section class="card bv-card">
    <button class=${'bv-row' + (done ? ' done' : '')} onClick=${onOpen}>
      <img src=${'./assets/emoji/open_book.png'} alt="" width="44" height="44" />
      <div class="grow" style="min-width:0">
        <div class="bv-cat">말씀 미션 · 읽고 외우기</div>
        <div class="bv-ref">${v.ref}</div>
        <div class="bv-pre">${v.text}</div>
      </div>
      ${done ? html`<span class="badge good"><${Icon} name="check" size=${14} />암송</span>` : html`<${Reward} n=${3} />`}
    </button>
  </section>`;
}

export function VerseModal({ kid, date, onClose }) {
  const v = M.verseFor(kid, date);
  const done = M.verseDone(kid, date);
  const words = v.text.split(/\s+/);
  const isToday = date === todayKey(0);
  const [step, setStep] = useState(done ? 'done' : 'read');
  const [reads, setReads] = useState(0);
  const lastRead = useRef(0);
  const [chips, setChips] = useState([]);
  const [placed, setPlaced] = useState([]);
  const [bad, setBad] = useState(null);
  const [hint, setHint] = useState(null);
  const [mistakes, setMistakes] = useState(0);
  const minGap = Math.max(2500, words.length * 280);

  function readOnce() {
    const now = Date.now();
    if (reads > 0 && now - lastRead.current < minGap) return toast('천천히 또박또박 소리 내어 읽어 보세요', 'Open book');
    lastRead.current = now;
    sfx('tap');
    setReads(Math.min(READS, reads + 1));
  }
  function startRecall() {
    setChips(shuffle(words.map((w, i) => ({ id: i, w }))));
    setPlaced([]);
    setHint(null);
    setStep('recall');
  }
  function tapChip(c) {
    const need = words[placed.length];
    if (c.w === need) {
      sfx('tap');
      const nextPlaced = [...placed, c];
      setPlaced(nextPlaced);
      setChips(chips.filter((x) => x.id !== c.id));
      setHint(null);
      if (nextPlaced.length === words.length) finish();
    } else {
      setMistakes(mistakes + 1);
      setBad(c.id);
      vibrate(40);
      sfx('bad');
      setTimeout(() => setBad(null), 450);
    }
  }
  function showHint() {
    const need = words[placed.length];
    const c = chips.find((x) => x.w === need);
    if (c) { setHint(c.id); setMistakes(mistakes + 1); }
  }
  function finish() {
    if (!isToday) { setStep('done'); return; }
    const t = M.completeVerse(kid.id, date, v, mistakes);
    sfx('coin');
    celebrate(1);
    toast(`말씀 암송 완료! 달란트 +${t}`, 'Coin');
    setStep('done');
  }

  return html`<${Modal} title="말씀 미션" icon="Open book" onClose=${onClose}>
    <div class="stack bv-modal">
      <div class="row wrap"><span class="badge" style="background:#FEF3C71A;color:#B45309;background:#FEF3C7">${v.ref}</span><${Reward} n=${3} /><span class="tiny muted">개역한글</span></div>

      ${step === 'read' && html`
        <div class="bv-text">${v.text}</div>
        <div class="tip small"><${Emo} name="Light bulb" size=${22} /><div>${v.m}</div></div>
        <div class="row wrap" style="gap:8px">
          <button class="btn" onClick=${() => { if (!speak(v.text, 'ko-KR', 0.85)) toast('이 기기에서는 읽어 주기가 안 돼요', 'Thinking face'); }}><${Icon} name="volume-2" size=${18} />듣기</button>
          <button class="btn primary grow" disabled=${reads >= READS} onClick=${readOnce}><${Icon} name="book-open" size=${18} />소리 내어 읽었어요 (${reads}/${READS})</button>
        </div>
        <div class="bv-dots">${Array.from({ length: READS }, (_, i) => html`<i class=${i < reads ? 'on' : ''}></i>`)}</div>
        ${isToday ? html`<button class="btn block" disabled=${reads < READS} onClick=${startRecall}><${Icon} name="sparkles" size=${18} />${reads < READS ? `${READS}번 읽으면 외우기 시작` : '이제 안 보고 외워 볼까요?'}</button>`
          : html`<div class="tiny muted">달란트는 그날 하루 안에만 받을 수 있어요. 읽고 외우기 연습은 언제든 해도 좋아요.</div>`}
      `}

      ${step === 'recall' && html`
        <div class="small muted">말씀을 떠올리며 단어 카드를 <b>순서대로</b> 눌러 보세요.</div>
        <div class="bv-built">${placed.map((c) => html`<span key=${c.id}>${c.w}</span>`)}${placed.length < words.length && html`<span class="bv-blank">${words.length - placed.length}개 남음</span>`}</div>
        <div class="bv-chips">${chips.map((c) => html`<button key=${c.id} class=${'bv-chip' + (bad === c.id ? ' bad' : '') + (hint === c.id ? ' hint' : '')} onClick=${() => tapChip(c)}>${c.w}</button>`)}</div>
        <div class="row between wrap">
          <button class="btn sm" onClick=${() => { setStep('read'); }}><${Icon} name="eye" size=${16} />다시 보기</button>
          <span class="tiny muted">틀린 횟수 ${mistakes}</span>
          <button class="btn sm" onClick=${showHint}><${Icon} name="lightbulb" size=${16} />힌트</button>
        </div>
      `}

      ${step === 'done' && html`
        <div class="bv-text">${v.text}</div>
        <div class="tip small" style="background:var(--good-soft)"><${Emo} name="Glowing star" size=${24} /><div>
          ${done ? html`<b>${hhmm(done.at)}</b>에 암송했어요${done.mistakes ? ` · 틀린 횟수 ${done.mistakes}` : ' · 한 번도 안 틀렸어요!'}` : html`<b>잘 외웠어요!</b> ${mistakes ? `틀린 횟수 ${mistakes}` : '한 번도 안 틀렸어요!'}`}
        </div></div>
        <div class="tip small"><${Emo} name="Light bulb" size=${22} /><div>${v.m}</div></div>
        <button class="btn" onClick=${() => { if (!speak(v.text, 'ko-KR', 0.85)) toast('이 기기에서는 읽어 주기가 안 돼요', 'Thinking face'); }}><${Icon} name="volume-2" size=${18} />다시 듣기</button>
      `}
    </div>
  <//>`;
}
