// 도메인 로직: 달란트 장부, 펫 성장, 숙제/미션/단어 보상, 연속 기록
import * as db from './store.js';
import { todayKey, addDays, dowOf, uid, vals, sum, seededRandom, shuffle, daysBetween } from './util.js';
import { MAX_PET_XP, stageForXp, speciesById } from '../data/pets.js';
import { FOODS, FAV_BONUS, REWARDS } from '../data/shop.js';
import { CREATIVE } from '../data/missions.js';
import { BIBLE_VERSES } from '../data/bible.js';
import { VOCAB_WORDS } from '../data/vocab.js';
import { VOCAB_EXTRA } from '../data/vocab-extra.js';

const S = () => db.getState();
export const kidPath = (kidId, rest = '') => `kids/${kidId}${rest ? '/' + rest : ''}`;

// ---------- 기본 조회 ----------
export function kidsList() {
  const kids = S().kids || {};
  return Object.entries(kids)
    .filter(([, k]) => k && k.profile)
    .map(([id, k]) => ({ id, ...k }))
    .sort((a, b) => (b.profile.grade || 0) - (a.profile.grade || 0));
}
export const getKid = (kidId) => {
  const k = (S().kids || {})[kidId];
  return k ? { id: kidId, ...k } : null;
};
export const settings = () => S().settings || { pin: '1234', cityId: 'seoul' };

export function ledgerList(kid) {
  return vals(kid.ledger).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
export function talentBalance(kid) {
  return sum(vals(kid.ledger), (e) => e.talents);
}
export function talentsEarnedOn(kid, date) {
  return sum(vals(kid.ledger).filter((e) => e.date === date && e.talents > 0 && e.kind !== 'feed'), (e) => e.talents);
}

// ---------- 펫 ----------
export function petXp(kid, petId) {
  return Math.max(0, Math.min(MAX_PET_XP, sum(vals(kid.ledger).filter((e) => e.petId === petId), (e) => e.petXp)));
}
export function petsOf(kid) {
  return vals(kid.pets).map((p) => {
    // 이미 전설이 된 펫은 기준이 바뀌어도 전설 유지
    const xp = p.legendAt ? MAX_PET_XP : petXp(kid, p.id);
    return { ...p, xp, stage: stageForXp(xp).stage, species: speciesById(p.species) };
  }).sort((a, b) => (a.adoptedAt || 0) - (b.adoptedAt || 0));
}
export function activePet(kid) {
  const list = petsOf(kid);
  return list.find((p) => p.id === kid.activePet) || list[list.length - 1] || null;
}
export function petMood(pet) {
  if (!pet) return 'ok';
  const h = new Date().getHours();
  if (h >= 22 || h < 6) return 'sleepy';
  if (!pet.lastFed) return pet.stage === 0 ? 'ok' : 'hungry';
  const hours = (Date.now() - pet.lastFed) / 3600000;
  if (hours < 12) return 'happy';
  if (hours < 30) return 'ok';
  return 'hungry';
}

export function feedPet(kidId, foodId) {
  const kid = getKid(kidId);
  if (!kid) return { ok: false, msg: '먹이를 찾을 수 없어요.' };
  const pet = activePet(kid);
  const food = FOODS.find((f) => f.id === foodId);
  if (!kid || !pet || !food) return { ok: false, msg: '먹이를 찾을 수 없어요.' };
  if (pet.xp >= MAX_PET_XP) return { ok: false, msg: '이미 전설이 되었어요! 새 알을 입양해 주세요.' };
  const bal = talentBalance(kid);
  if (bal < food.cost) return { ok: false, msg: `달란트가 ${food.cost - bal}개 부족해요. 미션을 완료해 모아 보세요!` };
  const fav = pet.species.fav === food.id;
  let gain = Math.round(food.xp * (fav ? FAV_BONUS : 1));
  gain = Math.min(gain, MAX_PET_XP - pet.xp);
  const prevStage = pet.stage;
  const nextXp = pet.xp + gain;
  const nextStage = stageForXp(nextXp).stage;
  const id = uid('feed');
  const updates = {
    [`kids/${kidId}/ledger/${id}`]: { id, ts: Date.now(), date: todayKey(0), kind: 'feed', talents: -food.cost, petId: pet.id, petXp: gain, reason: `${food.name} 먹이 주기${fav ? ' (최애 간식 x1.5)' : ''}` },
    [`kids/${kidId}/pets/${pet.id}/lastFed`]: Date.now()
  };
  if (nextXp >= MAX_PET_XP) updates[`kids/${kidId}/pets/${pet.id}/legendAt`] = Date.now();
  db.multi(updates);
  return { ok: true, gain, fav, prevStage, nextStage, evolved: nextStage > prevStage, legendary: nextXp >= MAX_PET_XP, pet };
}

export function adoptPet(kidId, speciesId, name = '') {
  const id = uid('pet');
  db.multi({
    [`kids/${kidId}/pets/${id}`]: { id, species: speciesId, name, adoptedAt: Date.now() },
    [`kids/${kidId}/activePet`]: id
  });
  return id;
}
export function renamePet(kidId, petId, name) {
  db.set(`kids/${kidId}/pets/${petId}/name`, name.slice(0, 12));
}
export function setActivePet(kidId, petId) {
  db.set(`kids/${kidId}/activePet`, petId);
}

// ---------- 연속 기록 ----------
function streakUpdates(kid, date) {
  const st = kid.stats || {};
  if (date !== todayKey(0) || st.lastDate === date) return {};
  const streak = st.lastDate === addDays(date, -1) ? (st.streak || 0) + 1 : 1;
  const out = { [`kids/${kid.id}/stats`]: { streak, lastDate: date, best: Math.max(st.best || 0, streak) } };
  if (streak > 0 && streak % 7 === 0) {
    const id = `streak_${date}`;
    out[`kids/${kid.id}/ledger/${id}`] = { id, ts: Date.now(), date, kind: 'bonus', talents: REWARDS.streak7, reason: `${streak}일 연속 달성 보너스` };
  }
  return out;
}
export function streakOf(kid) {
  const st = kid.stats || {};
  if (!st.lastDate) return 0;
  if (st.lastDate === todayKey(0) || st.lastDate === todayKey(-1)) return st.streak || 0;
  return 0;
}

function earn(kid, date, id, talents, reason, kind = 'earn', extra = {}) {
  return {
    [`kids/${kid.id}/ledger/${id}`]: { id, ts: Date.now(), date, kind, talents, reason, ...extra },
    ...streakUpdates(kid, date)
  };
}

// ---------- 숙제 (문제집 자동 배정 + 습관 + 개별) ----------
function countSteps(fromKey, toKey, days) {
  let n = 0;
  let cur = fromKey;
  while (cur < toKey) {
    if (days.includes(dowOf(cur))) n++;
    cur = addDays(cur, 1);
  }
  return n;
}
export function workbookTaskFor(wb, date) {
  const days = (wb.days || []).map(Number);
  if (!wb.active || !days.includes(dowOf(date))) return null;
  const base = wb.baseDate || todayKey(0);
  if (date < base) return null;
  const steps = countSteps(base, date, days);
  const start = Number(wb.startPage) + steps * Number(wb.pagesPerDay);
  if (start > Number(wb.totalPages)) return null;
  const end = Math.min(Number(wb.totalPages), start + Number(wb.pagesPerDay) - 1);
  return {
    id: `wb_${wb.id}_${date.replace(/-/g, '')}`,
    title: `${wb.title} ${start === end ? `p.${start}` : `p.${start}~${end}`}`,
    subject: wb.subject,
    talents: wb.talents || REWARDS.workbook,
    source: 'workbook',
    wbId: wb.id,
    order: 0
  };
}

// 날짜의 할 일 목록 (저장된 숙제 + 문제집 규칙 + 습관을 합쳐서 보여줌)
export function tasksFor(kid, date, planned = false) {
  const stored = (kid.tasks || {})[date] || {};
  const out = {};
  for (const [id, t] of Object.entries(stored)) if (t) out[id] = { ...t, id };
  for (const wb of vals(kid.workbooks)) {
    const t = workbookTaskFor(wb, date);
    if (t && !out[t.id]) out[t.id] = { ...t, done: false, virtual: true };
  }
  if (planned || date >= todayKey(-1)) {
    const dow = dowOf(date);
    for (const h of vals(kid.habits)) {
      if (!h.active) continue;
      if (h.dueDow !== undefined && h.dueDow !== null && h.dueDow !== '') {
        // 마감형: 마감 요일까지 남은 기간 동안 매일 보이고, 그 사이 한 번만 하면 완료
        if ((h.from && date < h.from) || (h.until && date > h.until)) continue;
        const did = `habit_${h.id}`;
        if (out[did]) continue;
        const DN = ['일', '월', '화', '수', '목', '금', '토'];
        const due = Number(h.dueDow), win = Math.min(7, Math.max(1, Number(h.window) || 6));
        const k = (due - dow + 7) % 7;
        if (k > win - 1) continue;
        const dueDate = addDays(date, k), start = addDays(dueDate, -(win - 1));
        const t = { id: did, title: h.title, subject: h.subject || '숙제', note: `${DN[due]}요일까지 · ${k === 0 ? '오늘 마감!' : 'D-' + k}`, talents: h.talents ?? REWARDS.habit, source: 'habit', order: k === 0 ? 0 : (h.order ?? 9), done: false, virtual: true, noTimer: !!h.noTimer, dueDate };
        for (let i = 0; i < win; i++) {
          const d2 = addDays(start, i);
          if (d2 === date) continue;
          const other = ((kid.tasks || {})[d2] || {})[did];
          if (other && other.done) { t.done = true; t.lockedDone = true; t.note = `${DN[due]}요일까지 · ${DN[dowOf(d2)]}요일에 완료`; break; }
        }
        out[did] = t;
        continue;
      }
      const days = Array.isArray(h.days) && h.days.length ? h.days.map(Number) : null;
      if (days && !days.includes(dow)) continue;
      if ((h.from && date < h.from) || (h.until && date > h.until)) continue;
      const id = `habit_${h.id}`;
      if (out[id]) continue;
      const t = { id, title: h.title, subject: h.subject || '생활', note: h.note || '', talents: h.talents ?? REWARDS.habit, source: 'habit', order: h.order ?? 9, done: false, virtual: true, noTimer: !!h.noTimer, record: h.record || null };
      // 주 1회 과제: 같은 주(월~일)의 지정 요일 중 하루만 하면 완료
      if (h.weekly && days) {
        const monday = addDays(date, -((dow + 6) % 7));
        for (let i = 0; i < 7; i++) {
          const d = addDays(monday, i);
          if (d === date) continue;
          const other = ((kid.tasks || {})[d] || {})[id];
          if (other && other.done) { t.done = true; t.lockedDone = true; t.note = `이번 주 ${['일','월','화','수','목','금','토'][dowOf(d)]}요일에 완료`; break; }
        }
      }
      out[id] = t;
    }
  }
  return Object.values(out)
    .filter((t) => !t.deleted)
    .sort((a, b) => (a.done - b.done) || ((a.order ?? 5) - (b.order ?? 5)) || String(a.title).localeCompare(String(b.title)));
}

export function toggleTask(kidId, date, task, extra = null) {
  if (task.record && !task.done && !(extra && extra.rec)) return { done: false, needRecord: true };
  if (task.lockedDone) return { done: true, blocked: true, msg: task.dueDate ? '이번 마감 기간에 이미 완료했어요!' : '이번 주에 이미 완료했어요!' };
  const kid = getKid(kidId);
  const path = `kids/${kidId}/tasks/${date}/${task.id}`;
  const ledgerId = `task_${date.replace(/-/g, '')}_${task.id}`;
  const reward = task.talents === undefined || task.talents === null || task.talents === '' ? REWARDS.homework : Math.max(0, Number(task.talents) || 0);
  if (!task.done) {
    const { virtual, ...rest } = task;
    const tm = timerOf(kid, date, task.id);
    const updates = {
      ...(tm && tm.startedAt ? stopUpdates(kidId, date, task.id, tm) : {}),
      [path]: { ...rest, done: true, doneAt: Date.now(), ...(tm ? { studySec: timerElapsed(tm) } : {}), ...(extra || {}) },
      ...earn(kid, date, ledgerId, reward, `${task.subject ? '[' + task.subject + '] ' : ''}${task.title}${extra && extra.rec && extra.rec.book ? ` · 「${extra.rec.book}」${extra.rec.total ? ` ${extra.rec.correct}/${extra.rec.total}` : ''}` : ''}`)
    };
    db.multi(updates);
    // 오늘 모두 완료 보너스
    const after = tasksFor(getKid(kidId), date, true);
    const counted = after.filter((t) => t.done || !(t.dueDate && t.dueDate > date));
    const allDone = counted.length > 0 && counted.every((t) => t.done);
    const acId = `allclear_${date.replace(/-/g, '')}`;
    if (allDone && date >= todayKey(-1) && !(getKid(kidId).ledger || {})[acId]) {
      db.set(`kids/${kidId}/ledger/${acId}`, { id: acId, ts: Date.now(), date, kind: 'bonus', talents: REWARDS.allClear, reason: '오늘 할 일 모두 완료 보너스' });
      return { done: true, talents: reward, allClear: true, studySec: tm ? timerElapsed(tm) : 0 };
    }
    return { done: true, talents: reward, studySec: tm ? timerElapsed(tm) : 0 };
  }
  const entry = (kid.ledger || {})[ledgerId];
  const acId = `allclear_${date.replace(/-/g, '')}`;
  const acEntry = (kid.ledger || {})[acId];
  if ((entry || acEntry) && talentBalance(kid) < (entry?.talents || 0) + (acEntry?.talents || 0)) {
    return { done: true, blocked: true, msg: '이미 달란트를 사용해서 완료를 취소할 수 없어요.' };
  }
  const updates = { [`kids/${kidId}/ledger/${ledgerId}`]: null };
  if (task.source === 'workbook' || task.source === 'habit') updates[path] = null;
  else { updates[`${path}/done`] = false; updates[`${path}/doneAt`] = null; }
  if (acEntry) updates[`kids/${kidId}/ledger/${acId}`] = null;
  db.multi(updates);
  return { done: false };
}

export function saveRecord(kidId, date, taskId, rec) {
  db.set(`kids/${kidId}/tasks/${date}/${taskId}/rec`, rec);
}

export function addTask(kidId, date, { title, subject = '숙제', talents = REWARDS.homework, note = '' }) {
  const id = uid('t');
  db.set(`kids/${kidId}/tasks/${date}/${id}`, { id, title, subject, talents: talents === '' || talents == null ? REWARDS.homework : Math.max(0, Number(talents) || 0), note, source: 'manual', done: false, createdAt: Date.now(), order: 3 });
  return id;
}
export function deleteTask(kidId, date, task) {
  if (task.virtual) db.set(`kids/${kidId}/tasks/${date}/${task.id}`, { id: task.id, deleted: true });
  else db.remove(`kids/${kidId}/tasks/${date}/${task.id}`);
}
export function postponeTask(kidId, date, task) {
  const next = addDays(date, 1);
  const { virtual, ...rest } = task;
  const id = uid('t');
  db.multi({
    [`kids/${kidId}/tasks/${next}/${id}`]: { ...rest, id, title: rest.title.startsWith('[이월]') ? rest.title : `[이월] ${rest.title}`, done: false, source: 'manual', order: 2 },
    [`kids/${kidId}/tasks/${date}/${task.id}`]: task.virtual ? { id: task.id, deleted: true } : null
  });
}

// ---------- 창의 미션 ----------
export function creativePicks(kid, date) {
  const day = (kid.creative || {})[date] || {};
  if (Array.isArray(day.picks) && day.picks.length) return day.picks.map((id) => CREATIVE.find((c) => c.id === id)).filter(Boolean);
  const grade = kid.profile?.grade || 3;
  const dow = dowOf(date);
  const pool = CREATIVE.filter((c) => grade >= c.g[0] && grade <= c.g[1] && (!c.days || c.days.includes(dow)));
  const rnd = seededRandom(`${kid.id}|${date}|${day.seed || 0}`);
  const cats = shuffle([...new Set(pool.map((c) => c.cat))], rnd);
  // 반복 줄이기: 이미 한 미션과 최근 3주 안에 나왔던 미션은 그 분야에 남은 게 있으면 빼고 고름
  const doneEver = new Set(), recent = new Set();
  const since = addDays(date, -21);
  for (const [d, rec] of Object.entries(kid.creative || {})) {
    if (!rec || d >= date) continue;
    for (const id of Object.keys(rec.done || {})) doneEver.add(id);
    if (d >= since) for (const id of rec.picks || []) recent.add(id);
  }
  // 아직 안 해 본 미션이 남은 분야를 먼저 고름
  const fresh = (cat) => pool.some((c) => c.cat === cat && !doneEver.has(c.id) && !recent.has(c.id));
  cats.sort((a, b) => fresh(b) - fresh(a));
  const picks = [];
  for (const cat of cats) {
    const all = pool.filter((c) => c.cat === cat);
    let opts = all.filter((c) => !doneEver.has(c.id) && !recent.has(c.id));
    if (!opts.length) opts = all.filter((c) => !recent.has(c.id));
    if (!opts.length) opts = all;
    picks.push(opts[Math.floor(rnd() * opts.length)]);
    if (picks.length === 3) break;
  }
  return picks;
}
export function rerollCreative(kidId, date) {
  const kid = getKid(kidId);
  const day = (kid.creative || {})[date] || {};
  const done = day.done || {};
  const current = creativePicks(kid, date);
  const keep = current.filter((c) => done[c.id]);
  const grade = kid.profile?.grade || 3;
  const dow = dowOf(date);
  const pool = shuffle(CREATIVE.filter((c) => grade >= c.g[0] && grade <= c.g[1] && (!c.days || c.days.includes(dow)) && !current.some((x) => x.id === c.id)));
  const picks = [...keep.map((c) => c.id)];
  for (const c of pool) {
    if (picks.length >= 3) break;
    if (!picks.some((id) => CREATIVE.find((x) => x.id === id)?.cat === c.cat)) picks.push(c.id);
  }
  db.update(`kids/${kidId}/creative/${date}`, { picks, rerolls: (day.rerolls || 0) + 1 });
}
export function creativeDone(kid, date, missionId) {
  return (((kid.creative || {})[date] || {}).done || {})[missionId] || null;
}
export function completeCreative(kidId, date, mission, payload = {}) {
  const kid = getKid(kidId);
  const id = `cr_${date.replace(/-/g, '')}_${mission.id}`;
  const day = (kid.creative || {})[date] || {};
  const picks = Array.isArray(day.picks) && day.picks.length ? day.picks : creativePicks(kid, date).map((c) => c.id);
  db.multi({
    [`kids/${kidId}/creative/${date}/picks`]: picks,
    [`kids/${kidId}/creative/${date}/done/${mission.id}`]: { at: Date.now(), title: mission.title, cat: mission.cat, type: mission.type, ...payload },
    ...earn(kid, date, id, REWARDS.creative, `[창의] ${mission.title}`)
  });
  return REWARDS.creative;
}
export function likeCreative(kidId, date, missionId, comment = '') {
  const kid = getKid(kidId);
  const id = `like_${date.replace(/-/g, '')}_${missionId}`;
  const updates = {
    [`kids/${kidId}/creative/${date}/done/${missionId}/liked`]: true,
    [`kids/${kidId}/creative/${date}/done/${missionId}/comment`]: comment || null
  };
  if (!(kid.ledger || {})[id]) updates[`kids/${kidId}/ledger/${id}`] = { id, ts: Date.now(), date: todayKey(0), kind: 'bonus', talents: 1, reason: '부모님 하트 칭찬 ❤' };
  db.multi(updates);
}

// ---------- 영단어 (라이트너 간격 반복) ----------
export const BOX_INTERVAL = [0, 1, 2, 4, 7, 14, 30];
export function allWords() {
  const custom = vals(S().customWords).map((w) => ({ ...w, custom: true }));
  return [...VOCAB_WORDS, ...VOCAB_EXTRA, ...custom];
}
export function wordsForLevel(level) {
  return allWords().filter((w) => Number(w.level) === Number(level));
}
export function wordState(kid, wordId) {
  return ((kid.vocab || {}).words || {})[wordId] || null;
}
export function vocabStats(kid) {
  const states = (kid.vocab || {}).words || {};
  const today = todayKey(0);
  const list = Object.values(states);
  const boxes = [0, 0, 0, 0, 0, 0, 0];
  list.forEach((s) => { boxes[Math.min(6, s.b || 0)]++; });
  return {
    learned: list.length,
    mastered: list.filter((s) => (s.b || 0) >= 5).length,
    due: list.filter((s) => s.d && s.d <= today && (s.b || 0) < 6).length,
    boxes,
    todayDone: !!(((kid.vocab || {}).days || {})[today] || {}).daily
  };
}
export function buildDailySession(kid) {
  const today = todayKey(0);
  const states = (kid.vocab || {}).words || {};
  const all = allWords();
  const byId = new Map(all.map((w) => [w.id, w]));
  const due = Object.entries(states)
    .filter(([, s]) => s.d && s.d <= today && (s.b || 0) < 6)
    .sort((a, b) => (a[1].b || 0) - (b[1].b || 0))
    .map(([id]) => byId.get(id))
    .filter(Boolean)
    .slice(0, 12);
  const level = kid.profile?.vocabLevel || 2;
  const newCount = (kid.profile?.grade || 3) >= 5 ? 10 : 8;
  let pool = shuffle(all.filter((w) => Number(w.level) === Number(level) && !states[w.id]));
  if (pool.length < newCount) pool = pool.concat(shuffle(all.filter((w) => Number(w.level) === Number(level) + 1 && !states[w.id])));
  const fresh = pool.slice(0, newCount);
  // 레벨 단어를 다 익혀서 새 단어·복습이 없으면 가장 약한 단어로 복습 (오늘의 단어를 계속 할 수 있게)
  if (!fresh.length && !due.length) {
    const fallback = Object.entries(states).sort((a, b) => (a[1].b || 0) - (b[1].b || 0) || (b[1].w || 0) - (a[1].w || 0)).slice(0, 10).map(([id]) => byId.get(id)).filter(Boolean);
    return { fresh, due: fallback };
  }
  return { fresh, due };
}
export function recordWord(kidId, wordId, correct) {
  const kid = getKid(kidId);
  const cur = wordState(kid, wordId) || { b: 0, c: 0, w: 0 };
  const b = correct ? Math.min(6, (cur.b || 0) + 1) : 1;
  const next = { b, c: (cur.c || 0) + (correct ? 1 : 0), w: (cur.w || 0) + (correct ? 0 : 1), d: addDays(todayKey(0), BOX_INTERVAL[b] || 1), t: Date.now() };
  db.set(`kids/${kidId}/vocab/words/${wordId}`, next);
  return next;
}
export function finishDailyVocab(kidId, correct, total) {
  const kid = getKid(kidId);
  const today = todayKey(0);
  const day = ((kid.vocab || {}).days || {})[today] || {};
  if (day.daily) return 0;
  const perfect = total > 0 && correct === total;
  const talents = REWARDS.vocabDaily + (perfect ? REWARDS.vocabPerfect : 0);
  db.multi({
    [`kids/${kidId}/vocab/days/${today}`]: { ...day, daily: true, correct, total, at: Date.now() },
    ...earn(kid, today, `vocab_${today.replace(/-/g, '')}`, talents, `오늘의 영단어 ${correct}/${total}${perfect ? ' (만점!)' : ''}`)
  });
  return talents;
}
export function finishGame(kidId, gameName, score) {
  const kid = getKid(kidId);
  const today = todayKey(0);
  const day = ((kid.vocab || {}).days || {})[today] || {};
  const games = day.games || 0;
  const updates = { [`kids/${kidId}/vocab/days/${today}/games`]: games + 1 };
  let talents = 0;
  if (games < REWARDS.gameDailyCap) {
    talents = REWARDS.game;
    Object.assign(updates, earn(kid, today, `game_${today.replace(/-/g, '')}_${games + 1}`, talents, `${gameName} ${score}`));
  }
  db.multi(updates);
  return talents;
}
export function weakWords(kid, limit = 10) {
  const states = (kid.vocab || {}).words || {};
  const byId = new Map(allWords().map((w) => [w.id, w]));
  return Object.entries(states)
    .filter(([, s]) => (s.w || 0) > 0)
    .sort((a, b) => (b[1].w - b[1].c * 0.3) - (a[1].w - a[1].c * 0.3))
    .slice(0, limit)
    .map(([id, s]) => ({ ...byId.get(id), ...s }))
    .filter((w) => w.word);
}

// ---------- 부모: 칭찬/감점 ----------
export function grantTalents(kidId, talents, reason, alsoPet = false) {
  const kid = getKid(kidId);
  const id = uid(talents >= 0 ? 'praise' : 'penalty');
  const entry = { id, ts: Date.now(), date: todayKey(0), kind: talents >= 0 ? 'bonus' : 'penalty', talents: Number(talents), reason, by: 'parent' };
  if (alsoPet && talents < 0) {
    const pet = activePet(kid);
    if (pet) { entry.petId = pet.id; entry.petXp = -Math.min(Math.abs(Number(talents)) * 72, petXp(kid, pet.id)); }
  }
  db.set(`kids/${kidId}/ledger/${id}`, entry);
}

// ---------- 주간 통계 ----------
export function weekSummary(kid, days = 7) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = todayKey(-i);
    const list = tasksFor(kid, d, true);
    out.push({
      date: d,
      total: list.length,
      done: list.filter((t) => t.done).length,
      talents: talentsEarnedOn(kid, d)
    });
  }
  return out;
}

// ---------- 공부 타이머 (숙제·문제 풀이 시간 기록) ----------
// 저장 위치: kids/{아이}/timers/{날짜}/{할일ID} = { total(초), startedAt(진행 중이면 시작 시각), title, subject, sessions }
const STUDY_SUBJ = ['수학', '영어', '국어', '과학', '사회', '학습지', '숙제', '영단어'];
const STUDY_WORDS = /(풀기|풀이|읽기|문제|숙제|공부|학습|쓰기|복습|예습|구몬|빠작|단어|독해|연산|p\.\s?\d)/;
export function isStudyTask(t) {
  if (t && t.noTimer) return false;
  return !!t && (t.source === 'workbook' || STUDY_SUBJ.includes(t.subject) || STUDY_WORDS.test(String(t.title || '')));
}
export const MIN_STUDY_SEC = 120; // 공부 타이머 최소 2분 (1초만 켜고 체크하는 것 방지)
export function timerOf(kid, date, taskId) {
  return (((kid && kid.timers) || {})[date] || {})[taskId] || null;
}
export function timerElapsed(tm, now = Date.now()) {
  if (!tm) return 0;
  // 켜 두고 잊은 타이머가 몇 시간씩 쌓이지 않도록 한 번에 최대 3시간까지만 인정
  return Math.max(0, Number(tm.total) || 0) + (tm.startedAt ? Math.min(3 * 3600, Math.max(0, Math.floor((now - tm.startedAt) / 1000))) : 0);
}
export function runningTimer(kid) {
  for (const [date, day] of Object.entries((kid && kid.timers) || {})) {
    for (const [id, tm] of Object.entries(day || {})) if (tm && tm.startedAt) return { date, id, tm };
  }
  return null;
}
function stopUpdates(kidId, date, id, tm) {
  return { [`kids/${kidId}/timers/${date}/${id}/total`]: timerElapsed(tm), [`kids/${kidId}/timers/${date}/${id}/startedAt`]: null, [`kids/${kidId}/timers/${date}/${id}/stoppedAt`]: Date.now() };
}
export function startTimer(kidId, date, task) {
  const kid = getKid(kidId);
  const upd = {};
  const run = runningTimer(kid);
  if (run && run.date === date && run.id === task.id) return { paused: null };
  let paused = null;
  if (run && !(run.date === date && run.id === task.id)) { Object.assign(upd, stopUpdates(kidId, run.date, run.id, run.tm)); paused = run.tm.title || null; }
  const cur = timerOf(kid, date, task.id) || {};
  upd[`kids/${kidId}/timers/${date}/${task.id}`] = { total: Number(cur.total) || 0, startedAt: Date.now(), title: task.title, subject: task.subject || '', sessions: (cur.sessions || 0) + 1 };
  db.multi(upd);
  return { paused };
}
export function stopTimer(kidId, date, taskId) {
  const tm = timerOf(getKid(kidId), date, taskId);
  if (!tm || !tm.startedAt) return timerElapsed(tm);
  const total = timerElapsed(tm);
  db.multi(stopUpdates(kidId, date, taskId, tm));
  return total;
}
export function studySecondsOn(kid, date) {
  return sum(Object.values(((kid && kid.timers) || {})[date] || {}), (tm) => timerElapsed(tm));
}
export function fmtDur(sec, live = false) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (live) return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (h) return m ? `${h}시간 ${m}분` : `${h}시간`;
  if (m) return `${m}분`;
  return sec ? `${s}초` : '0분';
}

// 공부 기록 초기화 (기록된 시간 지우기)
export function resetTimer(kidId, date, taskId) {
  db.multi({ [`kids/${kidId}/timers/${date}/${taskId}`]: null, [`kids/${kidId}/tasks/${date}/${taskId}/studySec`]: null });
}

// ---------- 공부 리포트 (주간: 월~일) ----------
export function weekStartOf(date) { return addDays(date, -((dowOf(date) + 6) % 7)); }
function firstActiveDate(kid) {
  let first = null;
  for (const e of vals(kid.ledger)) if (e && e.date && (!first || e.date < first)) first = e.date;
  for (const d of Object.keys(kid.tasks || {})) if ((kid.tasks[d] && Object.values(kid.tasks[d]).some((t) => t && t.done)) && (!first || d < first)) first = d;
  return first;
}
const SUBJ_LABEL = (s) => (!s || s === '생활' ? '기타' : s);
export function studyReport(kid, monday) {
  const today = todayKey(0);
  const first = firstActiveDate(kid) || today;
  const days = [];
  const subj = {}, taskSec = [], missed = [];
  const weeklySeen = {};
  let totalSec = 0, done = 0, total = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const timers = ((kid.timers || {})[d]) || {};
    const sec = sum(Object.values(timers), (tm) => timerElapsed(tm));
    const counted = d <= today && d >= first;
    let dTotal = 0, dDone = 0;
    if (counted) {
      for (const t of tasksFor(kid, d, true)) {
        const h = t.source === 'habit' ? vals(kid.habits).find((x) => 'habit_' + x.id === t.id) : null;
        const isDue = h && h.dueDow !== undefined && h.dueDow !== null && h.dueDow !== '';
        if (h && (h.weekly || isDue)) { // 주 1회·마감형 과제는 한 기간에 한 번만 셈
          const key = isDue ? t.id + '|' + t.dueDate : t.id;
          const w = weeklySeen[key] || (weeklySeen[key] = { title: t.title, done: false, last: d, due: isDue ? t.dueDate : null });
          if (t.done && !t.lockedDone) w.done = true;
          w.last = d;
          continue;
        }
        dTotal++; if (t.done) dDone++;
        else if (d < today) missed.push({ date: d, title: t.title });
      }
    }
    for (const [id, tm] of Object.entries(timers)) {
      const s = timerElapsed(tm);
      if (s <= 0) continue;
      const task = ((kid.tasks || {})[d] || {})[id];
      const key = SUBJ_LABEL(tm.subject || (task && task.subject));
      subj[key] = (subj[key] || 0) + s;
      taskSec.push({ date: d, title: tm.title || (task && task.title) || '공부', sec: s, subject: key });
    }
    totalSec += sec; total += dTotal; done += dDone;
    days.push({ date: d, sec, total: dTotal, done: dDone, future: d > today, before: d < first });
  }
  for (const [id, w] of Object.entries(weeklySeen)) {
    if (w.due && w.due > today && !w.done) continue; // 아직 마감 전
    total++; if (w.done) done++;
    else if ((w.due ? w.due : addDays(monday, 6)) < today) missed.push({ date: w.last, title: w.title + (w.due ? ' (마감 지남)' : ' (주 1회)') });
  }
  const books = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    for (const t of Object.values(((kid.tasks || {})[d]) || {})) if (t && t.done && t.rec && t.rec.book) books.push({ date: d, title: t.title, ...t.rec });
  }
  const studied = days.filter((d) => d.sec > 0).length;
  const talents = sum(days, (d) => talentsEarnedOn(kid, d.date));
  return {
    monday, days, totalSec, done, total, rate: total ? Math.round((done / total) * 100) : 0,
    avgSec: studied ? Math.round(totalSec / studied) : 0, studied, talents,
    bySubject: Object.entries(subj).map(([subject, sec]) => ({ subject, sec })).sort((a, b) => b.sec - a.sec),
    topTasks: taskSec.sort((a, b) => b.sec - a.sec).slice(0, 8),
    missed,
    books
  };
}

// ---------- 말씀 미션 (짧은 성경 구절 읽고 암송) ----------
// 저장: kids/{아이}/bible/{날짜} = { vid, ref, at, mistakes }
export function versePool(kid) {
  const grade = kid?.profile?.grade || 3;
  return BIBLE_VERSES.filter((v) => (v.lv || 1) <= (grade >= 5 ? 2 : 1));
}
export function verseFor(kid, date) {
  const saved = ((kid.bible || {})[date]) || null;
  if (saved && saved.vid) { const v = BIBLE_VERSES.find((x) => x.id === saved.vid); if (v) return v; }
  const pool = shuffle(versePool(kid), seededRandom('bible|' + kid.id));
  // 그 날 이전에 외운 구절은 빼고 고름 → 남은 구절을 다 외울 때까지 같은 구절이 다시 나오지 않음
  const learned = new Set(Object.entries(kid.bible || {}).filter(([d, r]) => d < date && r && r.at && r.vid).map(([, r]) => r.vid));
  let left = pool.filter((v) => !learned.has(v.id));
  if (!left.length) left = pool; // 다 외웠으면 처음부터 다시 (복습)
  const n = daysBetween('2026-01-01', date);
  return left[((n % left.length) + left.length) % left.length];
}
export function verseDone(kid, date) {
  const r = ((kid.bible || {})[date]) || null;
  return r && r.at ? r : null;
}
export function completeVerse(kidId, date, verse, mistakes = 0) {
  const kid = getKid(kidId);
  if (verseDone(kid, date)) return 0;
  const id = `bv_${date.replace(/-/g, '')}`;
  db.multi({
    [`kids/${kidId}/bible/${date}`]: { vid: verse.id, ref: verse.ref, at: Date.now(), mistakes: Number(mistakes) || 0 },
    ...earn(kid, date, id, REWARDS.bible, `[말씀] ${verse.ref} 암송`)
  });
  return REWARDS.bible;
}
