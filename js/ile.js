// 학원(ILE) 단어 시험 대비 엔진
// 레슨 데이터: /families/{가족}/ileLessons/{id} (가족 비공개 DB에 저장, 레슨이 추가되면 앱 수정 없이 반영)
// 실제 Voca 시험 5가지 유형: 동의어(syn) · 반의어(ant) · 상황 판단(sce) · 뜻 고르기(def) · 빈칸 채우기(fill)
import * as db from './store.js';
import * as M from './model.js';
import { todayKey, shuffle, uid, daysBetween, vals } from './util.js';

export const TYPE_LABEL = { syn: '동의어', ant: '반의어', sce: '상황 판단', def: '뜻 고르기', fill: '빈칸 채우기', use: '올바른 쓰임', sense: '뜻 구별', ana: '유추' };
export const TYPES = ['syn', 'ant', 'sce', 'def', 'fill'];
export const HARD_TYPES = ['use', 'sense', 'ana'];
export const ALL_TYPES = [...TYPES, ...HARD_TYPES];
export function isHard(kid, lesson) {
  const lv = ileState(kid, lesson).level || lesson.level || 'basic';
  return lv === 'hard';
}
export function setLevel(kidId, lessonId, level) { db.set(`kids/${kidId}/ile/${lessonId}/level`, level); }
export const typesFor = (hard) => (hard ? ALL_TYPES : TYPES);
const arr = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []);

export function lessonsFor(kidId) {
  return vals(db.getState().ileLessons)
    .filter((l) => l && l.kids && l.kids[kidId])
    .map(normalizeLesson)
    .sort((a, b) => String(a.testDate).localeCompare(String(b.testDate)));
}
export function activeLesson(kidId) {
  const list = lessonsFor(kidId);
  const today = todayKey(0);
  return list.find((l) => l.testDate >= today) || list[list.length - 1] || null;
}
function normalizeLesson(l) {
  const words = arr(l.words).map((w) => ({
    ...w,
    senses: arr(w.senses).map((s) => ({ ...s, syn: arr(s.syn), ant: arr(s.ant) })),
    col: arr(w.col),
    q: { syn: arr(w.q && w.q.syn), ant: arr(w.q && w.q.ant), sce: arr(w.q && w.q.sce).map((x) => ({ ...x, o: arr(x.o) })), def: arr(w.q && w.q.def), fill: arr(w.q && w.q.fill) },
    h: {
      synH: arr(w.h && w.h.synH).map((x) => ({ ...x, o: arr(x.o) })), antH: arr(w.h && w.h.antH).map((x) => ({ ...x, o: arr(x.o) })),
      sceH: w.h && w.h.sceH ? [{ ...w.h.sceH, o: arr(w.h.sceH.o) }] : [], use: w.h && w.h.use ? [{ o: arr(w.h.use.o) }] : [],
      sense: w.h && w.h.sense ? [{ ...w.h.sense, o: arr(w.h.sense.o) }] : [], dd: arr(w.h && w.h.dd), family: arr(w.h && w.h.family), fillH: arr(w.h && w.h.fillH)
    }
  })).sort((a, b) => a.n - b.n);
  return { ...l, words, plan: arr(l.plan).map((p) => ({ ...p, learn: arr(p.learn), types: arr(p.types) })), distractors: arr(l.distractors) };
}
export const dDay = (lesson) => daysBetween(todayKey(0), lesson.testDate);

// ---------- 진행 상황 ----------
export function ileState(kid, lesson) {
  return ((kid.ile || {})[lesson.id]) || {};
}
export function wordMastery(kid, lesson, wordId) {
  const st = (ileState(kid, lesson).stats || {})[wordId] || {};
  let c = 0, w = 0;
  for (const t of ALL_TYPES) { c += (st[t] && st[t].c) || 0; w += (st[t] && st[t].w) || 0; }
  const n = c + w;
  return { c, w, n, pct: n ? Math.round((c / n) * 100) : null, byType: st };
}
export function weakWords(kid, lesson, limit = 5) {
  return lesson.words
    .map((w) => ({ w, m: wordMastery(kid, lesson, w.id) }))
    .sort((a, b) => (a.m.pct ?? -1) - (b.m.pct ?? -1) || b.m.w - a.m.w)
    .slice(0, limit)
    .map((x) => x.w);
}
export function typeAccuracy(kid, lesson) {
  const out = {};
  const stats = ileState(kid, lesson).stats || {};
  for (const t of ALL_TYPES) {
    let c = 0, w = 0;
    for (const s of Object.values(stats)) { c += (s[t] && s[t].c) || 0; w += (s[t] && s[t].w) || 0; }
    out[t] = { c, w, pct: c + w ? Math.round((c / (c + w)) * 100) : null };
  }
  return out;
}
export function record(kidId, lessonId, wordId, type, correct) {
  const kid = M.getKid(kidId);
  const cur = ((((kid.ile || {})[lessonId] || {}).stats || {})[wordId] || {})[type] || { c: 0, w: 0 };
  db.set(`kids/${kidId}/ile/${lessonId}/stats/${wordId}/${type}`, { c: cur.c + (correct ? 1 : 0), w: cur.w + (correct ? 0 : 1), t: Date.now(), last: correct ? 1 : 0 });
}
export function planToday(kid, lesson) {
  const today = todayKey(0);
  const days = ileState(kid, lesson).days || {};
  const plan = lesson.plan.map((p) => ({ ...p, done: !!(days[p.date] && days[p.date].done), result: days[p.date] || null }));
  const todays = plan.find((p) => p.date === today) || null;
  const missed = plan.filter((p) => p.date < today && !p.done);
  return { plan, todays, missed };
}

// ---------- 문제 생성 ----------
function wordById(lesson, id) { return lesson.words.find((w) => w.id === id); }
function allSyn(w) { return w.senses.flatMap((s) => s.syn); }
function allAnt(w) { return w.senses.flatMap((s) => s.ant); }
function pool(lesson, exclude) {
  const ex = new Set(exclude.map((x) => x.toLowerCase()));
  const p = new Set();
  for (const w of lesson.words) { allSyn(w).forEach((x) => p.add(x)); allAnt(w).forEach((x) => p.add(x)); }
  lesson.distractors.forEach((x) => p.add(x));
  return [...p].filter((x) => !ex.has(x.toLowerCase()) && !x.includes(' '));
}

export function hasType(w, type, hard) {
  if (type === 'use' || type === 'sense') return hard && w.h[type].length > 0;
  if (type === 'ana') return hard && allSyn(w).length + allAnt(w).length > 0;
  if (hard && (type === 'syn' || type === 'ant')) return w.h[type + 'H'].length > 0 || w.q[type].length > 0;
  return (w.q[type] || []).length > 0;
}
function listFor(w, type, hard) {
  if (!hard) return w.q[type] || [];
  if (type === 'syn' || type === 'ant') return w.h[type + 'H'].length ? w.h[type + 'H'] : w.q[type];
  if (type === 'sce') return [...w.h.sceH, ...w.q.sce];
  if (type === 'fill') return [...w.h.fillH, ...w.q.fill];
  if (type === 'use' || type === 'sense') return w.h[type];
  return w.q[type] || [];
}
export function makeQuestion(lesson, w, type, variant = null, hard = false) {
  const id = uid('q');
  if (type === 'ana') return makeAnalogy(lesson, w, id);
  const list = listFor(w, type, hard);
  if (!list.length) return null;
  const item = variant != null ? list[variant % list.length] : list[Math.floor(Math.random() * list.length)];
  if (type === 'syn' || type === 'ant') {
    const ins = type === 'syn' ? 'Choose the best SYNONYM for the bolded word.' : 'Choose the best ANTONYM for the bolded word.';
    if (item.o && item.o.length) return { id, type, wordId: w.id, prompt: item.s, instruction: ins, options: shuffle(item.o), answer: item.a, hard: true };
    const trapFrom = type === 'syn' ? allAnt(w) : allSyn(w);
    const trap = shuffle(trapFrom)[0];
    const others = shuffle(pool(lesson, [...allSyn(w), ...allAnt(w), item.a, w.word])).slice(0, trap ? 2 : 3);
    return { id, type, wordId: w.id, prompt: item.s, instruction: ins, options: shuffle([item.a, ...(trap ? [trap] : []), ...others]), answer: item.a };
  }
  if (type === 'sce' || type === 'sense') {
    return { id, type, wordId: w.id, prompt: item.q, instruction: 'Choose the best answer.', options: shuffle(item.o), answer: item.o[0] };
  }
  if (type === 'use') {
    return { id, type, wordId: w.id, prompt: `Which sentence uses **${w.word}** correctly?`, instruction: 'Choose the sentence in which the word is used correctly.', options: shuffle(item.o), answer: item.o[0] };
  }
  if (type === 'def') {
    const sense = w.senses[item.sense || 0] || w.senses[0];
    const near = hard && w.h.dd.length >= 3 ? shuffle(w.h.dd).slice(0, 3) : null;
    const others = near || shuffle(lesson.words.filter((x) => x.id !== w.id).flatMap((x) => x.senses.map((s) => s.def))).slice(0, 3);
    const cap = w.word.charAt(0).toUpperCase() + w.word.slice(1);
    return { id, type, wordId: w.id, prompt: item.s, prompt2: `**${cap}** means ______.`, instruction: 'Choose the best answer to complete each sentence.', options: shuffle([sense.def, ...others]), answer: sense.def };
  }
  if (type === 'fill') {
    return { id, type, wordId: w.id, prompt: item.s, instruction: hard ? 'Fill in the blank. You may need to change the word form (noun, adverb, tense, plural).' : 'Fill in the blank with the correct word. Pay attention to spelling and grammar.', answer: item.a };
  }
  return null;
}

// 유추: A : B = C : ?  (동의어/반의어 관계)
function makeAnalogy(lesson, w, id) {
  const rels = [];
  if (allSyn(w).length) rels.push('syn');
  if (allAnt(w).length) rels.push('ant');
  if (!rels.length) return null;
  const rel = shuffle(rels)[0];
  const others = shuffle(lesson.words.filter((x) => x.id !== w.id && (rel === 'syn' ? allSyn(x).length : allAnt(x).length)));
  if (!others.length) return null;
  const x = others[0];
  const xr = shuffle(rel === 'syn' ? allSyn(x) : allAnt(x))[0];
  const answer = shuffle(rel === 'syn' ? allSyn(w) : allAnt(w))[0];
  const trap = shuffle(rel === 'syn' ? allAnt(w) : allSyn(w))[0];
  const rest = shuffle(pool(lesson, [...allSyn(w), ...allAnt(w), answer, w.word])).slice(0, trap ? 2 : 3);
  return { id, type: 'ana', wordId: w.id, prompt: `**${x.word}** : ${xr}  =  **${w.word}** : ______`, instruction: 'Choose the word that completes the analogy (same relationship).', options: shuffle([answer, ...(trap ? [trap] : []), ...rest]), answer, rel };
}

function interleave(qs) {
  const out = [];
  let rest = shuffle(qs);
  while (rest.length) {
    const lastWord = out.length ? out[out.length - 1].wordId : null;
    const i = rest.findIndex((q) => q.wordId !== lastWord);
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return out;
}

export function buildDaySession(kid, lesson, planDay) {
  const hard = isHard(kid, lesson);
  const all = lesson.words;
  const learn = planDay.learn.map((id) => wordById(lesson, id)).filter(Boolean);
  const reviewIds = planDay.review === 'all' ? all.map((w) => w.id) : arr(planDay.review);
  const review = reviewIds.map((id) => wordById(lesson, id)).filter(Boolean);
  const qs = [];
  const add = (w, t, v = null) => { if (hasType(w, t, hard)) { const q = makeQuestion(lesson, w, t, v, hard); if (q) qs.push(q); } };
  if (planDay.mode === 'learn') {
    const learnTypes = hard ? [...TYPES, 'use', 'sense'] : TYPES;
    learn.forEach((w) => learnTypes.forEach((t) => add(w, t, 0)));
    review.forEach((w) => {
      const m = wordMastery(kid, lesson, w.id).byType;
      const weakSA = ['syn', 'ant'].filter((t) => hasType(w, t, hard)).sort((a, b) => ((m[b] && m[b].w) || 0) - ((m[a] && m[a].w) || 0))[0];
      if (weakSA) add(w, weakSA, 1);
      add(w, 'fill', 1);
      if (hard) add(w, 'ana');
    });
    return { cards: learn, questions: interleave(qs), bank: false };
  }
  if (planDay.mode === 'drill' || planDay.mode === 'final') {
    let types = planDay.types.length ? planDay.types : TYPES;
    if (hard) types = planDay.mode === 'drill' ? [...types, 'ana'] : [...types, 'use'];
    review.forEach((w) => types.forEach((t) => add(w, t)));
    if (planDay.mode === 'final') weakWords(kid, lesson, 5).forEach((w) => ['syn', 'ant'].forEach((t) => add(w, t)));
    return { cards: [], questions: interleave(qs), bank: false };
  }
  if (planDay.mode === 'mock') return { cards: [], ...buildMock(lesson, hard), mock: true };
  return { cards: learn, questions: [], bank: false };
}

// 기본: 실제 시험 구성 (동의어7·반의어5·상황5·뜻6·빈칸10 = 33)
// 심화: 동의어7·반의어5·상황5·뜻5·뜻구별2·쓰임5·유추3·빈칸8 = 40 (근접 오답, 어형 변화)
export function buildMock(lesson, hard = false) {
  const ws = lesson.words;
  const pick = (type, n) => shuffle(ws.filter((w) => hasType(w, type, hard))).slice(0, n).map((w) => makeQuestion(lesson, w, type, null, hard));
  const plan = hard ? [['syn', 7], ['ant', 5], ['sce', 5], ['def', 5], ['sense', 2], ['use', 5], ['ana', 3]] : [['syn', 7], ['ant', 5], ['sce', 5], ['def', 6]];
  const fill = pick('fill', hard ? 8 : 10).filter(Boolean);
  const bankBase = fill.map((q) => wordById(lesson, q.wordId).word);
  const extra = hard ? shuffle(ws.map((w) => w.word).filter((x) => !bankBase.includes(x))).slice(0, 2) : [];
  return {
    questions: [...plan.flatMap(([t, n]) => pick(t, n)), ...fill].filter(Boolean),
    bankWords: shuffle([...bankBase, ...extra]),
    sections: true
  };
}

export function buildTypeDrill(lesson, type, count = 12, focus = null, hard = false) {
  const ws = (focus || lesson.words).filter((w) => hasType(w, type, hard));
  const qs = [];
  for (let i = 0; ws.length && qs.length < count && i < count * 3; i++) {
    const w = ws[i % ws.length];
    const q = makeQuestion(lesson, w, type, type === 'ana' ? null : Math.floor(i / ws.length), hard);
    if (q) qs.push(q);
  }
  const questions = interleave(qs);
  return { questions, bankWords: type === 'fill' ? shuffle([...new Set(questions.map((q) => wordById(lesson, q.wordId).word))]) : null };
}

export function retryQuestion(lesson, q, hard = false) {
  const w = wordById(lesson, q.wordId);
  if (q.type === 'ana') return makeQuestion(lesson, w, 'ana', null, hard);
  const list = listFor(w, q.type, hard);
  const curIdx = list.findIndex((x) => (x.s || x.q) === q.prompt);
  return makeQuestion(lesson, w, q.type, list.length > 1 ? curIdx + 1 : 0, hard);
}

export function checkFill(q, input) {
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[.,!?]/g, '');
  return norm(input) === norm(q.answer);
}
export function fillFeedback(q, input, lesson) {
  const v = String(input || '').trim().toLowerCase();
  const w = wordById(lesson, q.wordId);
  if (!v) return '';
  if (v === q.answer.toLowerCase()) return '';
  if (w && v === w.word && q.answer.toLowerCase() !== w.word) return '단어는 맞았어요! 문장에 맞게 품사·어형(명사/부사/-ing/-ed/복수형)으로 바꿔야 해요.';
  if (w && v.startsWith(w.word.slice(0, Math.max(4, w.word.length - 2))) || (w && q.answer.startsWith(v))) return '단어는 맞았어요! 어형(시제·-ing·복수형)을 확인해 보세요.';
  if (w && levenshtein(v, q.answer.toLowerCase()) <= 2) return '거의 맞았어요! 철자를 다시 확인해 보세요.';
  return '';
}
function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

// 계획된 하루 학습 완료 → 해당 날짜 숙제 자동 체크 (달란트 지급)
export function finishDay(kidId, lesson, planDay, score, total) {
  db.set(`kids/${kidId}/ile/${lesson.id}/days/${planDay.date}`, { done: true, score, total, at: Date.now() });
  const kid = M.getKid(kidId);
  const tid = `ile_${lesson.id}_d${planDay.day}`;
  const t = M.tasksFor(kid, planDay.date).find((x) => x.id === tid);
  if (t && !t.done) return M.toggleTask(kidId, planDay.date, t);
  return null;
}
export function finishMock(kidId, lesson, score, total, wrong) {
  const id = uid('mock');
  const today = todayKey(0);
  const kid = M.getKid(kidId);
  const updates = { [`kids/${kidId}/ile/${lesson.id}/mocks/${id}`]: { id, score, total, at: Date.now(), wrong } };
  const ratio = total ? score / total : 0;
  const bonusId = `ilemock_${lesson.id}_${today.replace(/-/g, '')}`;
  let talents = 0;
  if (!(kid.ledger || {})[bonusId] && ratio >= 0.7) {
    talents = ratio >= 0.9 ? 3 : 2;
    updates[`kids/${kidId}/ledger/${bonusId}`] = { id: bonusId, ts: Date.now(), date: today, kind: 'earn', talents, reason: `ILE 모의고사 ${score}/${total}` };
  }
  db.multi(updates);
  return talents;
}
export function mocksOf(kid, lesson) {
  return vals(ileState(kid, lesson).mocks).sort((a, b) => b.at - a.at);
}

// 게임(스피드 퀴즈·짝맞추기·스펠링 비·문장 퍼즐)용 단어 목록
export function gamePool(lesson) {
  return lesson.words.map((w) => ({ id: `ile_${w.id}`, word: w.word, meaning: w.ko, pos: w.senses[0].pos, sentence: w.ex, sentenceKo: w.exKo, level: 99 }));
}
