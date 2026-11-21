// 학원(ILE) Science 시험 대비 엔진
// 시험 데이터: /families/{가족}/sciTests/{id} (가족 비공개 DB, 단원이 바뀌면 앱 수정 없이 데이터만 추가)
// 실제 시험 형식: ① 단어 박스에서 정의에 맞는 용어 고르기(match) ② 4지선다(mc: NOT/순서/원인·결과 포함)
import * as db from './store.js';
import * as M from './model.js';
import { todayKey, shuffle, uid, daysBetween, vals } from './util.js';

const arr = (x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []);
export const TYPE_LABEL = { match: '용어 매칭', mc: '개념 객관식' };

function normalize(t) {
  return {
    ...t,
    terms: arr(t.terms).filter(Boolean),
    mcq: arr(t.mcq).filter(Boolean).map((q) => ({ ...q, o: arr(q.o) })),
    plan: arr(t.plan).filter(Boolean).map((p) => ({ ...p, lessons: arr(p.lessons).map(Number), review: arr(p.review).map(Number) })),
    lessons: t.lessons || {}
  };
}
export function testsFor(kidId) {
  return vals(db.getState().sciTests)
    .filter((t) => t && t.kids && t.kids[kidId])
    .map(normalize)
    .sort((a, b) => String(a.testDate).localeCompare(String(b.testDate)));
}
export function activeTest(kidId) {
  const list = testsFor(kidId);
  const today = todayKey(0);
  return list.find((t) => t.testDate >= today) || null;
}
export const dDay = (t) => daysBetween(todayKey(0), t.testDate);
export const lessonNums = (t) => Object.keys(t.lessons || {}).filter((k) => t.lessons[k]).map(Number).sort((a, b) => a - b);

// ---------- 진행 상황 ----------
export const sciState = (kid, t) => ((kid.sci || {})[t.id]) || {};
export function itemStat(kid, t, itemId) {
  const s = (sciState(kid, t).stats || {})[itemId] || { c: 0, w: 0 };
  const n = s.c + s.w;
  return { ...s, n, pct: n ? Math.round((s.c / n) * 100) : null };
}
export function record(kidId, testId, itemId, ok) {
  const kid = M.getKid(kidId);
  const cur = ((((kid.sci || {})[testId] || {}).stats || {})[itemId]) || { c: 0, w: 0 };
  db.set(`kids/${kidId}/sci/${testId}/stats/${itemId}`, { c: cur.c + (ok ? 1 : 0), w: cur.w + (ok ? 0 : 1), t: Date.now(), last: ok ? 1 : 0 });
}
export function lessonAccuracy(kid, t) {
  const out = {};
  for (const l of lessonNums(t)) {
    let c = 0, w = 0;
    for (const it of [...t.terms, ...t.mcq].filter((x) => Number(x.l) === l)) { const s = itemStat(kid, t, it.id); c += s.c; w += s.w; }
    out[l] = { c, w, pct: c + w ? Math.round((c / (c + w)) * 100) : null };
  }
  return out;
}
export function typeAccuracy(kid, t) {
  const calc = (items) => { let c = 0, w = 0; for (const it of items) { const s = itemStat(kid, t, it.id); c += s.c; w += s.w; } return { c, w, pct: c + w ? Math.round((c / (c + w)) * 100) : null }; };
  return { match: calc(t.terms), mc: calc(t.mcq) };
}
export function planToday(kid, t) {
  const today = todayKey(0);
  const days = sciState(kid, t).days || {};
  const plan = t.plan.map((p) => ({ ...p, done: !!(days[p.date] && days[p.date].done), result: days[p.date] || null }));
  return { plan, todays: plan.find((p) => p.date === today) || null, missed: plan.filter((p) => p.date < today && !p.done) };
}
// 약한 항목: 정답률 낮은 순 (안 푼 항목은 뒤로)
function weakest(kid, t, items, n) {
  return [...items]
    .map((it) => ({ it, s: itemStat(kid, t, it.id) }))
    .sort((a, b) => ((a.s.pct ?? 101) - (b.s.pct ?? 101)) || (b.s.w - a.s.w) || (Math.random() - 0.5))
    .slice(0, n)
    .map((x) => x.it);
}

// ---------- 문제 만들기 ----------
// 단어 박스: 정답 용어 + 같은 단원의 헷갈리는 용어 + 다른 단원 용어 (실제 시험처럼 A, B, C… 알파벳)
export function makeBox(t, answers, size) {
  const ids = new Set(answers.map((x) => x.id));
  const lessons = new Set(answers.map((x) => Number(x.l)));
  const near = shuffle(t.terms.filter((x) => !ids.has(x.id) && lessons.has(Number(x.l))));
  const far = shuffle(t.terms.filter((x) => !ids.has(x.id) && !lessons.has(Number(x.l))));
  const extra = [...near, ...far].slice(0, Math.max(0, size - answers.length));
  return shuffle([...answers, ...extra]).map((x, i) => ({ id: x.id, term: x.term, letter: String.fromCharCode(65 + i) }));
}
export function matchQ(term, box) {
  return { id: uid('sq'), type: 'match', itemId: term.id, l: term.l, prompt: term.def, answer: term.term, box, ko: term.ko };
}
export function mcQ(item) {
  const CIRC = ['①', '②', '③', '④', '⑤', '⑥'];
  const isOrder = item.o.every((o) => /^[\d,\s]+$/.test(o)) && item.q.includes('①');
  if (isOrder) {
    // 순서 문제: 단계 번호를 매번 섞어서 정답 위치가 고정되지 않게
    const lines = item.q.split('\n');
    const head = lines.filter((x) => !CIRC.some((c) => x.startsWith(c)));
    const steps = lines.filter((x) => CIRC.some((c) => x.startsWith(c))).map((x) => x.replace(/^[①-⑥]\s*/, ''));
    const correct = item.o[0].split(',').map((x) => Number(x.trim()) - 1); // 원래 번호 기준 정답 순서
    const perm = shuffle(steps.map((_, i) => i)); // 새 번호 k → 원래 단계 perm[k]
    const newNo = {}; perm.forEach((orig, k) => { newNo[orig] = k + 1; });
    const fmt = (seq) => seq.join(', ');
    const answer = fmt(correct.map((orig) => newNo[orig]));
    const opts = new Set([answer]);
    for (let g = 0; opts.size < 4 && g < 200; g++) {
      const cand = [...answer.split(', ').map(Number)];
      const a = Math.floor(Math.random() * cand.length), b = Math.floor(Math.random() * cand.length);
      [cand[a], cand[b]] = [cand[b], cand[a]];
      if (g % 3 === 0) { const c = Math.floor(Math.random() * cand.length), d = Math.floor(Math.random() * cand.length); [cand[c], cand[d]] = [cand[d], cand[c]]; }
      opts.add(fmt(cand));
    }
    const q = [...head, ...perm.map((orig, k) => `${CIRC[k]} ${steps[orig]}`)].join('\n');
    return { id: uid('sq'), type: 'mc', itemId: item.id, l: item.l, prompt: q, options: [...opts].sort(), answer, e: item.e };
  }
  return { id: uid('sq'), type: 'mc', itemId: item.id, l: item.l, prompt: item.q, options: shuffle(item.o), answer: item.o[0], e: item.e };
}
function interleave(qs) {
  const out = [];
  let rest = shuffle(qs);
  while (rest.length) {
    const last = out.length ? out[out.length - 1].type : null;
    const i = Math.random() < 0.5 ? rest.findIndex((q) => q.type !== last) : 0;
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return out;
}

// 하루 학습: 그날 단원 용어 카드 → 용어 매칭(단어 박스) → 개념 문제, 지난 단원은 약한 것 위주 복습
export function buildDay(kid, t, p) {
  if (p.mode === 'mock') return { cards: [], ...buildMock(t), mock: true };
  const ls = new Set(p.lessons);
  const terms = t.terms.filter((x) => ls.has(Number(x.l)));
  const mcs = shuffle(t.mcq.filter((x) => ls.has(Number(x.l)))).slice(0, 15);
  const rvTerms = [], rvMc = [];
  for (const l of p.review) {
    rvTerms.push(...weakest(kid, t, t.terms.filter((x) => Number(x.l) === l), p.review.length > 1 ? 2 : 3));
    rvMc.push(...weakest(kid, t, t.mcq.filter((x) => Number(x.l) === l), p.review.length > 1 ? 2 : 3));
  }
  const matchTerms = [...terms, ...rvTerms];
  const box = makeBox(t, matchTerms, Math.min(t.terms.length, matchTerms.length + 4));
  const matchPart = shuffle(matchTerms).map((x) => matchQ(x, box));
  const mcPart = interleave([...mcs, ...rvMc].map(mcQ));
  return { cards: terms, questions: [...matchPart, ...mcPart], sections: true };
}

// 실전 모의고사: 시험지와 같은 30문항 (용어 매칭 10 · 객관식 20, 단원별 고르게)
export function buildMock(t) {
  const ls = lessonNums(t);
  const pickEven = (items, n) => {
    const by = ls.map((l) => shuffle(items.filter((x) => Number(x.l) === l)));
    const out = [];
    for (let k = 0; out.length < n && k < 50; k++) for (const g of by) if (g[k] && out.length < n) out.push(g[k]);
    return out;
  };
  const terms = pickEven(t.terms, 10);
  const box = makeBox(t, terms, 16);
  const match = shuffle(terms).map((x) => matchQ(x, box));
  const mc = shuffle(pickEven(t.mcq, 20)).map(mcQ);
  return { questions: [...match, ...mc], sections: true };
}

export function buildLessonDrill(kid, t, l) {
  const terms = t.terms.filter((x) => Number(x.l) === l);
  const box = makeBox(t, terms, terms.length + 4);
  return { cards: [], questions: [...shuffle(terms).map((x) => matchQ(x, box)), ...shuffle(t.mcq.filter((x) => Number(x.l) === l)).map(mcQ)], sections: true };
}
export function buildTypeDrill(kid, t, type) {
  if (type === 'match') {
    const terms = weakest(kid, t, t.terms, 12);
    const box = makeBox(t, terms, 16);
    return { cards: [], questions: shuffle(terms).map((x) => matchQ(x, box)) };
  }
  return { cards: [], questions: interleave(weakest(kid, t, t.mcq, 15).map(mcQ)) };
}
export function buildWeak(kid, t) {
  const terms = weakest(kid, t, t.terms, 6).filter((x) => itemStat(kid, t, x.id).w > 0);
  const mcs = weakest(kid, t, t.mcq, 10).filter((x) => itemStat(kid, t, x.id).w > 0);
  const box = terms.length ? makeBox(t, terms, terms.length + 5) : [];
  return { cards: terms, questions: [...terms.map((x) => matchQ(x, box)), ...interleave(mcs.map(mcQ))] };
}
export function retry(t, q) {
  if (q.type === 'match') { const term = t.terms.find((x) => x.id === q.itemId); return term ? { ...matchQ(term, shuffle(q.box).map((b, i) => ({ ...b, letter: String.fromCharCode(65 + i) }))), retry: true } : null; }
  const it = t.mcq.find((x) => x.id === q.itemId);
  return it ? { ...mcQ(it), retry: true } : null;
}

// ---------- 완료 ----------
export function finishDay(kidId, t, p, score, total) {
  db.set(`kids/${kidId}/sci/${t.id}/days/${p.date}`, { done: true, score, total, at: Date.now() });
  const kid = M.getKid(kidId);
  const tid = `sci_${t.id}_d${p.day}`;
  const task = M.tasksFor(kid, p.date).find((x) => x.id === tid);
  if (task && !task.done) return M.toggleTask(kidId, p.date, task);
  return null;
}
export function finishMock(kidId, t, score, total, wrong) {
  const id = uid('mock');
  const today = todayKey(0);
  const kid = M.getKid(kidId);
  const updates = { [`kids/${kidId}/sci/${t.id}/mocks/${id}`]: { id, score, total, at: Date.now(), wrong } };
  const ratio = total ? score / total : 0;
  const bonusId = `scimock_${t.id}_${today.replace(/-/g, '')}`;
  let talents = 0;
  if (!(kid.ledger || {})[bonusId] && ratio >= 0.7) {
    talents = ratio >= 0.9 ? 3 : 2;
    updates[`kids/${kidId}/ledger/${bonusId}`] = { id: bonusId, ts: Date.now(), date: today, kind: 'earn', talents, reason: `Science 모의고사 ${score}/${total}` };
  }
  db.multi(updates);
  return talents;
}
export const mocksOf = (kid, t) => vals(sciState(kid, t).mocks).sort((a, b) => b.at - a.at);
