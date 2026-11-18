import { createInitialData, getTodayKey, DAY_NAMES } from '../data/presets.js';
import { CHARACTERS, MAX_CHAR_XP, getStageForXp } from '../data/characters.js';

const STORAGE_KEY = 'kidquest_planner_v1';
let memoryFallback = null;

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const init = createInitialData();
      saveState(init);
      return init;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.kids || !parsed.settings) {
      const init = createInitialData();
      saveState(init);
      return init;
    }
    return parsed;
  } catch (e) {
    if (!memoryFallback) memoryFallback = createInitialData();
    return memoryFallback;
  }
}

export function saveState(state) {
  memoryFallback = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Private mode / opaque origin fallback
  }
}

export function resetAllData() {
  const init = createInitialData();
  saveState(init);
  return init;
}

// 선택한 날짜에 대해 활성화된 문제집 규칙(workbooks)으로 일별 숙제 자동 생성
export function ensureTasksForDate(state, kidId, dateKey) {
  const kid = state.kids[kidId];
  if (!kid) return [];
  if (!kid.tasksByDate) kid.tasksByDate = {};
  if (!kid.tasksByDate[dateKey]) kid.tasksByDate[dateKey] = [];

  const dateObj = new Date(dateKey + 'T00:00:00');
  const dow = dateObj.getDay(); // 0..6
  const existing = kid.tasksByDate[dateKey];

  // 오늘 이후 날짜에 대해 문제집 자동 생성 (이미 해당 wbId가 생성되어 있으면 중복 방지)
  const todayKey = getTodayKey(0);
  if (dateKey >= todayKey && Array.isArray(kid.workbooks)) {
    // 오늘부터 dateKey까지 몇 번째 스케줄 회차인지 계산해 페이지 범위를 자동 배정
    for (const wb of kid.workbooks) {
      if (!wb.active) continue;
      if (!wb.daysOfWeek.includes(dow)) continue;
      const alreadyHas = existing.some(t => t.wbId === wb.id);
      if (alreadyHas) continue;

      // todayKey ~ dateKey 사이의 해당 요일 발생 횟수로 오프셋 계산
      const offsetSteps = countScheduledSteps(todayKey, dateKey, wb.daysOfWeek);
      const startP = wb.currentPage + offsetSteps * wb.pagesPerDay;
      if (startP > wb.totalPages) continue;
      const endP = Math.min(wb.totalPages, startP + wb.pagesPerDay - 1);
      const pageLabel = startP === endP ? `p.${startP}` : `p.${startP}~${endP}`;

      existing.push({
        id: `t_${wb.id}_${dateKey}`,
        subject: wb.subject,
        title: `${wb.title} (${pageLabel})`,
        xp: wb.xp || 20,
        done: false,
        source: 'workbook',
        wbId: wb.id
      });
    }
  }

  return kid.tasksByDate[dateKey];
}

function countScheduledSteps(fromKey, toKey, daysOfWeek) {
  if (toKey <= fromKey) return 0;
  let steps = 0;
  const cur = new Date(fromKey + 'T00:00:00');
  const end = new Date(toKey + 'T00:00:00');
  while (cur < end) {
    if (daysOfWeek.includes(cur.getDay())) steps++;
    cur.setDate(cur.getDate() + 1);
  }
  return steps;
}

// 교재 1달치(또는 14일치) 일정을 미리 생성하거나 밀린 숙제를 하루 뒤로 미루기
export function generateWorkbookPlan(state, kidId, wbId, daysAhead = 14) {
  const kid = state.kids[kidId];
  const wb = kid?.workbooks?.find(w => w.id === wbId);
  if (!kid || !wb) return 0;

  let added = 0;
  let pageCursor = wb.currentPage;
  for (let i = 0; i < daysAhead; i++) {
    const dk = getTodayKey(i);
    const d = new Date(dk + 'T00:00:00');
    if (!wb.daysOfWeek.includes(d.getDay())) continue;
    if (pageCursor > wb.totalPages) break;

    if (!kid.tasksByDate[dk]) kid.tasksByDate[dk] = [];
    const exists = kid.tasksByDate[dk].some(t => t.wbId === wb.id);
    const endP = Math.min(wb.totalPages, pageCursor + wb.pagesPerDay - 1);
    const pageLabel = pageCursor === endP ? `p.${pageCursor}` : `p.${pageCursor}~${endP}`;

    if (!exists) {
      kid.tasksByDate[dk].push({
        id: `t_${wb.id}_${dk}`,
        subject: wb.subject,
        title: `${wb.title} (${pageLabel})`,
        xp: wb.xp || 20,
        done: false,
        source: 'workbook',
        wbId: wb.id
      });
      added++;
    }
    pageCursor += wb.pagesPerDay;
  }
  saveState(state);
  return added;
}

export function postponeTodayTasksToTomorrow(state, kidId, fromDateKey) {
  const kid = state.kids[kidId];
  if (!kid) return 0;
  const list = kid.tasksByDate[fromDateKey] || [];
  const pending = list.filter(t => !t.done);
  if (pending.length === 0) return 0;

  const d = new Date(fromDateKey + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!kid.tasksByDate[nextKey]) kid.tasksByDate[nextKey] = [];

  for (const t of pending) {
    kid.tasksByDate[nextKey].push({
      ...t,
      id: `${t.id}_moved_${Date.now()}`,
      title: t.title.includes('[이월]') ? t.title : `[이월] ${t.title}`
    });
  }
  kid.tasksByDate[fromDateKey] = list.filter(t => t.done);
  saveState(state);
  return pending.length;
}

// XP 증가/감소 및 성장·후퇴·컬렉션 자동 처리
export function applyXpChange(state, kidId, delta, reason) {
  const kid = state.kids[kidId];
  if (!kid) return null;

  const prevXp = kid.charXp || 0;
  const prevStage = getStageForXp(prevXp).stage;

  let nextXp = Math.max(0, prevXp + delta);
  let completedChar = null;

  if (nextXp >= MAX_CHAR_XP) {
    // 캐릭터 완성 -> Collection Room에 영구 저장!
    const chMeta = CHARACTERS.find(c => c.id === kid.activeCharId) || CHARACTERS[0];
    completedChar = {
      uid: `col_${kidId}_${Date.now()}`,
      charId: chMeta.id,
      name: chMeta.name,
      completedAt: getTodayKey(0),
      totalXp: MAX_CHAR_XP
    };
    if (!kid.collection) kid.collection = [];
    kid.collection.unshift(completedChar);

    // 초과 XP는 다음 알에 이월하거나 0으로 시작
    const overflow = nextXp - MAX_CHAR_XP;
    nextXp = Math.min(30, overflow);

    // 아직 컬렉션에 없는 다음 캐릭터 자동 추천 선택
    const ownedIds = new Set(kid.collection.map(c => c.charId));
    const nextChar = CHARACTERS.find(c => !ownedIds.has(c.id)) || CHARACTERS[(CHARACTERS.findIndex(c => c.id === kid.activeCharId) + 1) % CHARACTERS.length];
    kid.activeCharId = nextChar.id;
  }

  kid.charXp = nextXp;
  const nextStage = getStageForXp(nextXp).stage;

  if (!kid.logs) kid.logs = [];
  kid.logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: getTodayKey(0),
    type: delta >= 0 ? 'gain' : 'penalty',
    reason: reason || (delta >= 0 ? '미션 완료' : '감점 반영'),
    delta
  });
  if (kid.logs.length > 60) kid.logs = kid.logs.slice(0, 60);

  saveState(state);

  return {
    prevXp,
    nextXp,
    prevStage,
    nextStage,
    evolved: !completedChar && nextStage > prevStage,
    devolved: !completedChar && nextStage < prevStage,
    completedChar
  };
}

export function getDayLabel(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  const today = getTodayKey(0);
  const tomorrow = getTodayKey(1);
  const base = `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`;
  if (dateKey === today) return `오늘 · ${base}`;
  if (dateKey === tomorrow) return `내일 · ${base}`;
  return base;
}

export function exportStateJson(state) {
  return JSON.stringify(state, null, 2);
}

export function importStateJson(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed || !parsed.kids || !parsed.kids.bella || !parsed.kids.wanny) {
    throw new Error('올바른 KidQuest 백업 파일이 아닙니다.');
  }
  saveState(parsed);
  return parsed;
}
