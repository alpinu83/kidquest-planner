import { CHARACTERS, EVOLUTION_STAGES, MAX_CHAR_XP, getStageForXp, renderCharacterSvg } from '../data/characters.js';
import { KOREAN_CITIES, DAY_NAMES, getTodayKey } from '../data/presets.js';
import { VOCAB_LEVELS } from '../data/vocab.js';
import {
  loadState, saveState, resetAllData, ensureTasksForDate,
  generateWorkbookPlan, postponeTodayTasksToTomorrow,
  applyXpChange, getDayLabel, exportStateJson, importStateJson
} from './storage.js';
import { fetchWeatherForecast, describeWeatherCode, buildWeatherAdvice, renderWeatherIconSvg } from './weather.js';
import { runBrowserOcr, parseHomeworkText } from './ocr.js';
import {
  getAllVocabPool, pickDaily20Words, pickWrongReviewWords,
  buildChoiceOptions, buildSentenceTokens, buildLetterTiles,
  recordVocabAnswer, speakEnglish
} from './vocabEngine.js';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fireConfetti(big = false) {
  if (typeof window.confetti === 'function') {
    window.confetti({
      particleCount: big ? 130 : 45,
      spread: big ? 95 : 60,
      origin: { y: 0.65 }
    });
  }
}

const ui = {
  state: loadState(),
  currentKidId: null, // 'bella' | 'wanny' | null
  tab: 'today', // 'today' | 'vocab' | 'schedule' | 'collection' | 'parent'
  selectedDate: getTodayKey(0),
  weather: null,
  modal: null, // { type, ... }
  toastMsg: null,
  parentUnlocked: false,
  parentTargetKid: 'bella',
  parentSubTab: 'homework', // 'homework' | 'penalty' | 'vocab' | 'settings'
  ocrDrafts: [],
  ocrStatus: '',
  ocrRawText: '',
  vocabSession: null // active quiz session
};

let toastTimer = null;
function showToast(msg) {
  ui.toastMsg = msg;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toastMsg = null;
    render();
  }, 3200);
}

async function initWeather(force = false) {
  ui.weather = await fetchWeatherForecast(ui.state.settings.cityId, force);
  render();
}

function applyThemeBody() {
  document.body.classList.remove('theme-lavender', 'theme-mint');
  if (ui.currentKidId && ui.state.kids[ui.currentKidId]) {
    const theme = ui.state.kids[ui.currentKidId].theme || 'lavender';
    document.body.classList.add(`theme-${theme}`);
  }
}

function render() {
  applyThemeBody();
  const root = document.getElementById('app');
  if (!ui.currentKidId) {
    root.innerHTML = renderLoginScreen() + renderModal() + renderToast();
    bindEvents();
    return;
  }

  const kid = ui.state.kids[ui.currentKidId];
  root.innerHTML = `
    <div class="app-shell">
      ${renderTopBar(kid)}
      ${ui.tab === 'today' ? renderTodayTab(kid) : ''}
      ${ui.tab === 'vocab' ? renderVocabTab(kid) : ''}
      ${ui.tab === 'schedule' ? renderScheduleTab(kid) : ''}
      ${ui.tab === 'collection' ? renderCollectionTab(kid) : ''}
      ${ui.tab === 'parent' ? renderParentTab() : ''}
    </div>
    ${renderBottomNav()}
    ${renderModal()}
    ${renderToast()}
  `;
  bindEvents();
}

function renderToast() {
  return ui.toastMsg ? `<div class="toast">${esc(ui.toastMsg)}</div>` : '';
}

function renderLoginScreen() {
  const bella = ui.state.kids.bella;
  const wanny = ui.state.kids.wanny;
  const bStage = getStageForXp(bella.charXp);
  const wStage = getStageForXp(wanny.charXp);

  return `
    <div class="login-screen">
      <div class="brand-badge">KidQuest · 아이패드 학습 & 성장 플래너</div>
      <h1 class="login-title">오늘은 누가 공부할까요?</h1>
      <p class="login-sub">내 이름을 누르면 오늘의 숙제, 캐릭터, 영단어 아레나가 열려요.</p>

      <div class="profile-grid">
        <button class="profile-card bella" data-action="login-kid" data-kid="bella">
          <div>${renderCharacterSvg(bella.activeCharId, bStage.stage, 128)}</div>
          <div class="profile-name">${esc(bella.name)}</div>
          <div class="profile-meta">${esc(bella.grade)} · Level ${bella.vocabLevel} 영단어</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
            <span class="pill">${esc(bStage.badge)} ${esc(bStage.name)}</span>
            <span class="pill success">컬렉션 ${bella.collection.length}개</span>
          </div>
        </button>

        <button class="profile-card wanny" data-action="login-kid" data-kid="wanny">
          <div>${renderCharacterSvg(wanny.activeCharId, wStage.stage, 128)}</div>
          <div class="profile-name">${esc(wanny.name)}</div>
          <div class="profile-meta">${esc(wanny.grade)} · Level ${wanny.vocabLevel} 영단어</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
            <span class="pill" style="background:#E0F2FE;color:#0284C7;">${esc(wStage.badge)} ${esc(wStage.name)}</span>
            <span class="pill success">컬렉션 ${wanny.collection.length}개</span>
          </div>
        </button>
      </div>

      <div style="margin-top:28px;">
        <button class="btn btn-outline" data-action="open-parent-from-login">부모 관리 모드 (숙제·단어·감점 설정)</button>
      </div>
    </div>
  `;
}

function renderTopBar(kid) {
  const stage = getStageForXp(kid.charXp);
  return `
    <header class="topbar">
      <div class="topbar-user">
        <div class="user-avatar-dot" style="background:${kid.avatarColor}">${esc(kid.name[0])}</div>
        <div>
          <div style="font-size:20px;font-weight:800;">${esc(kid.name)}의 성장 플래너</div>
          <div style="font-size:13px;color:var(--text-muted);font-weight:600;">
            ${esc(kid.grade)} · ${esc(stage.badge)} (${kid.charXp}/${MAX_CHAR_XP} XP) · 연속 ${kid.streak}일
          </div>
        </div>
      </div>
      <div class="topbar-actions">
        <button class="btn btn-outline btn-sm" data-action="switch-kid">프로필 전환</button>
        <button class="btn btn-soft btn-sm" data-action="go-tab" data-tab="parent">부모 설정</button>
      </div>
    </header>
  `;
}

function renderBottomNav() {
  const tabs = [
    { id: 'today', label: '오늘의 미션', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'vocab', label: '영단어 학습', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { id: 'schedule', label: '학원 시간표', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'collection', label: '컬렉션 룸', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { id: 'parent', label: '부모 관리', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
  ];

  return `
    <nav class="bottom-nav">
      ${tabs.map(t => `
        <button class="nav-tab ${ui.tab === t.id ? 'active' : ''}" data-action="go-tab" data-tab="${t.id}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <path d="${t.icon}"/>
          </svg>
          <span>${t.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function renderWeatherCard() {
  if (!ui.weather) {
    return `<div class="card weather-card"><div class="card-title">내일 날씨 & 등교 준비물</div><div>날씨 정보를 불러오는 중입니다...</div></div>`;
  }
  const w = ui.weather;
  const tmDesc = describeWeatherCode(w.tomorrow.weatherCode);
  const tdDesc = describeWeatherCode(w.today.weatherCode);
  const tips = buildWeatherAdvice(w.tomorrow);

  return `
    <div class="card weather-card">
      <div class="card-title">
        <span>내일 날씨 & 준비물 알림 (${esc(w.cityName)})</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="pill neutral" style="font-size:11px;">${esc(w.source)}</span>
          <button class="btn btn-outline btn-sm" data-action="refresh-weather">새로고침</button>
        </div>
      </div>
      <div class="weather-split">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div class="weather-day-box">
            ${renderWeatherIconSvg(tmDesc.icon, 42)}
            <div>
              <div style="font-size:12px;font-weight:700;color:var(--primary);">내일 (${esc(w.tomorrow.date)})</div>
              <div style="font-size:17px;font-weight:800;">${esc(tmDesc.label)} · ${Math.round(w.tomorrow.minTemp)}° ~ ${Math.round(w.tomorrow.maxTemp)}°C</div>
              <div style="font-size:12px;color:var(--text-muted);font-weight:600;">강수확률 ${w.tomorrow.precipProb}%</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);padding-left:6px;font-weight:600;">
            오늘: ${esc(tdDesc.label)} ${Math.round(w.today.minTemp)}°~${Math.round(w.today.maxTemp)}°C (비 확률 ${w.today.precipProb}%)
          </div>
        </div>
        <div class="weather-tips">
          ${tips.map(tip => `
            <div class="weather-tip-item">
              <span class="pill ${tip.level === 'alert' ? 'danger' : tip.level === 'cold' ? 'warn' : 'success'}">${esc(tip.badge)}</span>
              <span>${esc(tip.text)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderTodayTab(kid) {
  const tasks = ensureTasksForDate(ui.state, kid.id, ui.selectedDate);
  const doneCount = tasks.filter(t => t.done).length;
  const stage = getStageForXp(kid.charXp);
  const charMeta = CHARACTERS.find(c => c.id === kid.activeCharId) || CHARACTERS[0];
  const pct = Math.min(100, Math.round((kid.charXp / MAX_CHAR_XP) * 100));

  const selDow = new Date(ui.selectedDate + 'T00:00:00').getDay();
  const dayAcademies = (kid.academies || [])
    .filter(a => a.days.includes(selDow))
    .sort((a, b) => a.start.localeCompare(b.start));

  const todayDow = new Date().getDay();
  const isReviewDay = todayDow === Number(ui.state.settings.reviewDayOfWeek);
  const wrongCount = (kid.vocabStats?.wrongBank || []).length;

  return `
    ${isReviewDay && wrongCount > 0 ? `
      <div class="card" style="background:linear-gradient(135deg,#FEF3C7,#FDE68A);border-color:#F59E0B;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:800;font-size:16px;color:#92400E;">오늘은 주간 영단어 오답 복습 데이!</div>
            <div style="font-size:14px;color:#78350F;">이번 주에 틀렸던 단어 ${wrongCount}개를 모두 복습하면 보너스 XP가 쌓여요.</div>
          </div>
          <button class="btn btn-primary" data-action="start-wrong-review">오답 복습 시작하기</button>
        </div>
      </div>
    ` : ''}

    ${renderWeatherCard()}

    <div class="grid-2">
      <div>
        <div class="card">
          <div class="card-title">
            <span>오늘의 숙제 & 미션 (${doneCount}/${tasks.length})</span>
            <div class="date-nav">
              <button class="btn btn-outline btn-sm" data-action="shift-date" data-delta="-1">&lt;</button>
              <button class="btn btn-soft btn-sm" data-action="set-today">오늘</button>
              <button class="btn btn-outline btn-sm" data-action="shift-date" data-delta="1">&gt;</button>
            </div>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
            <span class="pill">${esc(getDayLabel(ui.selectedDate))}</span>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="date" class="input" style="width:auto;min-height:36px;padding:4px 10px;" value="${esc(ui.selectedDate)}" data-action="pick-date" />
              ${tasks.some(t => !t.done) ? `<button class="btn btn-outline btn-sm" data-action="postpone-tasks">미완료 내일로</button>` : ''}
            </div>
          </div>

          ${tasks.length === 0 ? `
            <div style="text-align:center;padding:28px 12px;color:var(--text-muted);">
              이 날짜에 등록된 숙제가 없어요. 부모 관리에서 문제집 자동배정 또는 사진 OCR로 쉽게 추가해 보세요!
            </div>
          ` : tasks.map(t => `
            <div class="task-item ${t.done ? 'done' : ''}">
              <button class="task-check" data-action="toggle-task" data-task-id="${esc(t.id)}" aria-label="완료 체크">
                ${t.done ? '✓' : ''}
              </button>
              <div class="task-body">
                <div class="task-title">${esc(t.title)}</div>
                <div class="task-meta">
                  <span class="pill neutral">${esc(t.subject)}</span>
                  <span class="pill">+${t.xp} XP</span>
                </div>
              </div>
              ${t.source === 'vocab' && !t.done ? `<button class="btn btn-soft btn-sm" data-action="go-tab" data-tab="vocab">풀러 가기</button>` : ''}
            </div>
          `).join('')}

          <div style="display:flex;gap:8px;margin-top:12px;">
            <input type="text" id="quick-kid-task" class="input" placeholder="아이가 직접 할일 추가 (예: 줄넘기 100개)" />
            <button class="btn btn-primary" data-action="add-quick-kid-task">추가</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <span>하교 후 학원·학습지 스케쥴 (${DAY_NAMES[selDow]}요일)</span>
            <button class="btn btn-outline btn-sm" data-action="go-tab" data-tab="schedule">전체 시간표</button>
          </div>
          ${dayAcademies.length === 0 ? `
            <div style="color:var(--text-muted);font-size:14px;padding:10px 0;">오늘은 등록된 학원·학습지 일정이 없어요.</div>
          ` : dayAcademies.map(a => `
            <div class="academy-item">
              <div class="academy-time">${esc(a.start)} ~ ${esc(a.end)}</div>
              <div style="flex:1;">
                <div style="font-weight:700;">${esc(a.title)}</div>
                <div style="font-size:12px;color:var(--text-muted);">${esc(a.note || '')}</div>
              </div>
              <span class="pill neutral">${esc(a.type)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <div class="card char-stage-card">
          <div class="card-title">
            <span>나의 성장 파트너</span>
            <button class="btn btn-outline btn-sm" data-action="open-char-picker">캐릭터 바꾸기</button>
          </div>
          <div class="char-arena" style="background:${charMeta.bg}">
            ${renderCharacterSvg(charMeta.id, stage.stage, 168)}
            <div style="font-size:20px;font-weight:800;margin-top:4px;">${esc(charMeta.name)}</div>
            <div style="font-size:13px;font-weight:700;color:var(--primary);">${esc(stage.badge)} · ${esc(stage.name)}</div>
            <p style="font-size:13px;color:var(--text-muted);margin:8px 0 2px;">"${esc(charMeta.quotes[stage.stage - 1])}"</p>
          </div>

          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;">
            <span>성장 게이지</span>
            <span>${kid.charXp} / ${MAX_CHAR_XP} XP (${pct}%)</span>
          </div>
          <div class="xp-bar-wrap">
            <div class="xp-bar-fill" style="width:${pct}%"></div>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
            220 XP를 채우면 컬렉션 룸에 영구 저장돼요! 감점되면 단계가 후퇴할 수 있어요.
          </div>

          <div class="stage-dots">
            ${EVOLUTION_STAGES.map(s => `
              <div class="stage-dot ${stage.stage === s.stage ? 'current' : stage.stage > s.stage ? 'reached' : ''}">
                ${esc(s.badge)}<br/>${esc(s.name.split(' ')[0])}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-title">
            <span>최근 성장 · 감점 기록</span>
            <span class="pill neutral">최근 ${Math.min(5, (kid.logs || []).length)}건</span>
          </div>
          ${(kid.logs || []).slice(0, 5).map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;">
              <div>
                <div style="font-weight:600;">${esc(l.reason)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${esc(l.date)}</div>
              </div>
              <span class="pill ${l.delta >= 0 ? 'success' : 'danger'}">${l.delta >= 0 ? '+' : ''}${l.delta} XP</span>
            </div>
          `).join('') || '<div style="color:var(--text-muted);font-size:14px;">기록이 없습니다.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderVocabTab(kid) {
  if (ui.vocabSession) return renderVocabSession(kid);

  const lvlInfo = VOCAB_LEVELS.find(v => v.level === kid.vocabLevel) || VOCAB_LEVELS[1];
  const pool = getAllVocabPool(ui.state, kid.vocabLevel);
  const wrongWords = pickWrongReviewWords(ui.state, kid);
  const reviewDayName = DAY_NAMES[Number(ui.state.settings.reviewDayOfWeek)];

  return `
    <div class="card">
      <div class="card-title">
        <span>영어단어 학습 아레나 (20단어 세션)</span>
        <span class="pill">${esc(lvlInfo.label)}</span>
      </div>
      <p style="margin:0 0 16px;color:var(--text-muted);font-size:14px;">
        ${esc(lvlInfo.desc)} · 총 ${pool.length}개 단어 중 <strong>20개</strong>를 골라 학습합니다. (마스터 완료: ${(kid.vocabStats?.masteredIds || []).length}개)
      </p>

      <div class="vocab-mode-grid">
        <button class="mode-card" data-action="start-vocab" data-mode="mixed">
          <div class="pill" style="margin-bottom:8px;">추천 · 3종 혼합</div>
          <div style="font-size:17px;font-weight:800;">종합 20단어 챌린지</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">뜻 고르기 + 문장/단어 스크램블 + 주관식 쓰기를 골고루 연습해요.</div>
        </button>

        <button class="mode-card" data-action="start-vocab" data-mode="choice">
          <div class="pill success" style="margin-bottom:8px;">4지선다</div>
          <div style="font-size:17px;font-weight:800;">뜻에 맞는 단어 고르기</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">원어민 발음을 듣고 알맞은 한국어 뜻을 빠르게 맞춰보세요.</div>
        </button>

        <button class="mode-card" data-action="start-vocab" data-mode="scramble">
          <div class="pill warn" style="margin-bottom:8px;">Word Scramble</div>
          <div style="font-size:17px;font-weight:800;">문장 만들기 · 철자 배열</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">섞여 있는 영어 단어 카드를 순서대로 눌러 문장을 완성해요.</div>
        </button>

        <button class="mode-card" data-action="start-vocab" data-mode="typing">
          <div class="pill danger" style="margin-bottom:8px;">주관식</div>
          <div style="font-size:17px;font-weight:800;">스펠링 직접 쓰기</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">뜻과 발음을 듣고 영어 철자를 직접 타이핑해요.</div>
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>주간 오답 복습 노트 (매주 ${reviewDayName}요일 추천)</span>
        <span class="pill ${wrongWords.length > 0 ? 'danger' : 'success'}">오답 ${wrongWords.length}개</span>
      </div>
      ${wrongWords.length === 0 ? `
        <div style="color:var(--text-muted);font-size:14px;">아직 틀린 단어가 없어요! 20단어 챌린지에서 틀린 단어는 자동으로 이곳에 모여 반복 복습할 수 있어요.</div>
      ` : `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div style="font-size:14px;color:var(--text-muted);">복습 테스트에서 맞히면 오답 횟수가 줄고 모두 맞히면 오답 노트에서 졸업해요.</div>
          <button class="btn btn-primary" data-action="start-wrong-review">틀린 단어 ${wrongWords.length}개 복습하기</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${wrongWords.map(w => `
            <button class="btn btn-outline btn-sm" data-action="speak-word" data-text="${esc(w.word)}">
              <strong>${esc(w.word)}</strong> · ${esc(w.meaning)}
            </button>
          `).join('')}
        </div>
      `}
    </div>

    <div class="card">
      <div class="card-title">
        <span>현재 수준 단어장 미리보기 (클릭 시 발음 듣기)</span>
        <span class="pill neutral">${pool.length}단어</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;max-height:340px;overflow-y:auto;">
        ${pool.slice(0, 40).map(w => `
          <div class="academy-item" style="margin:0;cursor:pointer;" data-action="speak-word" data-text="${esc(w.word)}">
            <div>
              <div style="font-weight:800;font-size:15px;">${esc(w.word)} <span style="font-size:11px;color:var(--text-muted);">${esc(w.ipa || '')}</span></div>
              <div style="font-size:13px;color:var(--text-muted);">${esc(w.meaning)} (${esc(w.pos)})</div>
            </div>
            <span class="pill neutral">발음</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function createVocabQuestionItem(wordObj, mode, state) {
  let qType = mode;
  if (mode === 'mixed') {
    const r = Math.random();
    qType = r < 0.38 ? 'choice' : r < 0.72 ? 'scramble' : 'typing';
  }
  const item = { wordObj, qType, answered: false, isCorrect: false, userChoice: null };
  if (qType === 'choice') {
    item.options = buildChoiceOptions(wordObj, state);
  } else if (qType === 'scramble') {
    // 번갈아가며 문장 스크램블 / 단어 스펠링 스크램블 출제
    const useSentence = Boolean(wordObj.sentence) && Math.random() < 0.65;
    item.scrambleKind = useSentence ? 'sentence' : 'letters';
    if (useSentence) {
      const built = buildSentenceTokens(wordObj.sentence);
      item.expected = built.expected;
      item.pool = built.shuffled;
    } else {
      const built = buildLetterTiles(wordObj.word);
      item.expected = built.expected;
      item.pool = built.shuffled;
    }
    item.pickedIds = [];
  }
  return item;
}

function renderVocabSession(kid) {
  const s = ui.vocabSession;
  if (s.finished) {
    return `
      <div class="card quiz-box" style="text-align:center;padding:32px 24px;">
        <div class="pill success" style="margin-bottom:10px;">학습 완료!</div>
        <h2 style="margin:6px 0;font-size:26px;">${s.isReview ? '주간 오답 복습' : '오늘의 영단어'} 결과</h2>
        <p style="font-size:18px;font-weight:700;margin:10px 0;">
          ${s.items.length}문제 중 <span style="color:var(--primary);">${s.correctCount}문제</span> 정답!
        </p>
        <p style="color:var(--text-muted);font-size:14px;">
          캐릭터 경험치 +${s.earnedXp} XP가 반영되었어요.
          ${s.wrongInSession.length > 0 ? `<br/>틀린 ${s.wrongInSession.length}개 단어는 오답 노트에 저장되었어요.` : '<br/>완벽해요! 틀린 단어가 하나도 없어요!'}
        </p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
          <button class="btn btn-primary" data-action="close-vocab-session">영단어 홈으로</button>
          <button class="btn btn-outline" data-action="go-tab" data-tab="today">오늘의 미션 보기</button>
        </div>
      </div>
    `;
  }

  const cur = s.items[s.index];
  const w = cur.wordObj;
  const pct = Math.round(((s.index) / s.items.length) * 100);

  return `
    <div class="card quiz-box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span class="pill">${s.isReview ? '주간 오답 복습' : `Level ${kid.vocabLevel}`} · ${s.index + 1} / ${s.items.length}</span>
        <button class="btn btn-outline btn-sm" data-action="close-vocab-session">그만하기</button>
      </div>
      <div class="xp-bar-wrap" style="height:10px;margin-bottom:18px;">
        <div class="xp-bar-fill" style="width:${pct}%"></div>
      </div>

      ${cur.qType === 'choice' ? `
        <div style="text-align:center;">
          <div style="font-size:13px;color:var(--text-muted);font-weight:700;">뜻에 맞는 해석을 고르세요</div>
          <div style="font-size:34px;font-weight:900;margin:8px 0 4px;">${esc(w.word)}</div>
          <div style="font-size:14px;color:var(--text-muted);margin-bottom:10px;">${esc(w.ipa || '')} · ${esc(w.pos)}</div>
          <button class="btn btn-soft btn-sm" data-action="speak-word" data-text="${esc(w.word)}">발음 듣기</button>
        </div>
        <div class="choice-grid">
          ${cur.options.map(opt => {
            let cls = 'choice-btn';
            if (cur.answered) {
              if (opt.id === w.id) cls += ' correct';
              else if (cur.userChoice === opt.id) cls += ' wrong';
            }
            return `<button class="${cls}" data-action="answer-choice" data-word-id="${esc(opt.id)}" ${cur.answered ? 'disabled' : ''}>${esc(opt.meaning)}</button>`;
          }).join('')}
        </div>
      ` : ''}

      ${cur.qType === 'scramble' ? `
        <div style="text-align:center;">
          <span class="pill warn" style="margin-bottom:8px;">
            ${cur.scrambleKind === 'sentence' ? 'Word Scramble · 문장 만들기' : 'Word Scramble · 철자 맞추기'}
          </span>
          <div style="font-size:20px;font-weight:800;margin:6px 0;">
            ${cur.scrambleKind === 'sentence' ? esc(w.sentenceKo) : `${esc(w.meaning)} (${esc(w.pos)})`}
          </div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">
            핵심 단어: <strong>${cur.scrambleKind === 'sentence' ? `${esc(w.word)} (${esc(w.meaning)})` : '아래 알파벳 카드를 순서대로 눌러 단어를 완성하세요'}</strong>
          </div>
          <button class="btn btn-soft btn-sm" data-action="speak-word" data-text="${esc(cur.scrambleKind === 'sentence' ? w.sentence : w.word)}">문장/단어 듣기</button>
        </div>

        <div class="scramble-answer-zone">
          ${cur.pickedIds.length === 0 ? `<span style="color:var(--text-muted);font-size:14px;">아래 카드를 터치해 순서대로 채워보세요</span>` : ''}
          ${cur.pickedIds.map(pid => {
            const tile = cur.pool.find(t => t.id === pid);
            return `<button class="word-tile" data-action="unpick-tile" data-tile-id="${esc(pid)}" ${cur.answered ? 'disabled' : ''}>${esc(tile.text || tile.ch)}</button>`;
          }).join('')}
        </div>

        <div class="tile-pool">
          ${cur.pool.map(tile => {
            const used = cur.pickedIds.includes(tile.id);
            return `<button class="word-tile ${used ? 'used' : ''}" data-action="pick-tile" data-tile-id="${esc(tile.id)}" ${used || cur.answered ? 'disabled' : ''}>${esc(tile.text || tile.ch)}</button>`;
          }).join('')}
        </div>

        ${!cur.answered ? `
          <div style="display:flex;gap:10px;justify-content:center;margin-top:12px;">
            <button class="btn btn-outline" data-action="clear-scramble">다시 배열</button>
            <button class="btn btn-primary" data-action="submit-scramble">정답 확인</button>
          </div>
        ` : ''}
      ` : ''}

      ${cur.qType === 'typing' ? `
        <div style="text-align:center;">
          <span class="pill danger" style="margin-bottom:8px;">주관식 스펠링 쓰기</span>
          <div style="font-size:26px;font-weight:900;margin:8px 0;">${esc(w.meaning)}</div>
          <div style="font-size:14px;color:var(--text-muted);margin-bottom:10px;">
            품사: ${esc(w.pos)} · 힌트: <strong>${esc(w.word[0].toUpperCase())}${' _'.repeat(Math.max(1, w.word.length - 1))}</strong> (${w.word.length}글자)
          </div>
          <button class="btn btn-soft btn-sm" data-action="speak-word" data-text="${esc(w.word)}">발음 듣기</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <input type="text" id="vocab-typing-input" class="input" placeholder="영어 단어를 입력하세요" autocomplete="off" autocapitalize="none" spellcheck="false" ${cur.answered ? 'disabled' : ''} value="${esc(cur.typed || '')}" />
          ${!cur.answered ? `<button class="btn btn-primary" data-action="submit-typing">확인</button>` : ''}
        </div>
      ` : ''}

      ${cur.answered ? `
        <div style="margin-top:16px;padding:14px;border-radius:16px;background:${cur.isCorrect ? 'var(--success-soft)' : 'var(--danger-soft)'};display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-weight:800;color:${cur.isCorrect ? '#065F46' : '#991B1B'};">
              ${cur.isCorrect ? '정답이에요! (+3 XP)' : `아쉬워요! 정답: ${w.word} (${w.meaning})`}
            </div>
            <div style="font-size:13px;margin-top:4px;">예문: ${esc(w.sentence)} — ${esc(w.sentenceKo)}</div>
          </div>
          <button class="btn btn-primary" data-action="next-vocab-q">
            ${s.index + 1 >= s.items.length ? '결과 보기' : '다음 문제'}
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderScheduleTab(kid) {
  const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // 월~일
  return `
    <div class="card">
      <div class="card-title">
        <span>${esc(kid.name)}의 주간 학원·학습지 시간표</span>
        <span class="pill">하교 후 스케쥴</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
        ${daysOrder.map(dow => {
          const items = (kid.academies || []).filter(a => a.days.includes(dow)).sort((a,b) => a.start.localeCompare(b.start));
          return `
            <div style="border:1.5px solid var(--border);border-radius:16px;padding:14px;background:var(--surface);">
              <div style="font-weight:800;font-size:16px;margin-bottom:10px;color:var(--primary);">${DAY_NAMES[dow]}요일</div>
              ${items.length === 0 ? `<div style="font-size:13px;color:var(--text-muted);">자유 시간 / 집 공부</div>` : items.map(a => `
                <div class="academy-item" style="margin-bottom:8px;">
                  <div>
                    <div style="font-size:12px;font-weight:800;color:var(--primary);">${esc(a.start)}~${esc(a.end)}</div>
                    <div style="font-weight:700;font-size:14px;">${esc(a.title)}</div>
                    ${a.note ? `<div style="font-size:12px;color:var(--text-muted);">${esc(a.note)}</div>` : ''}
                  </div>
                  <button class="btn btn-danger btn-sm" data-action="delete-academy" data-id="${esc(a.id)}">삭제</button>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span>새 학원 / 학습지 스케쥴 추가</span></div>
      <div class="form-row">
        <input id="ac-title" class="input" placeholder="학원/학습지 이름 (예: 영어 학원)" />
        <select id="ac-type" class="select">
          <option value="학원">학원</option>
          <option value="학습지">학습지</option>
          <option value="예체능">예체능</option>
          <option value="과외/기타">과외/기타</option>
        </select>
        <input id="ac-start" class="input" type="time" value="15:30" />
        <input id="ac-end" class="input" type="time" value="17:00" />
      </div>
      <div class="form-row">
        <input id="ac-note" class="input" placeholder="준비물 메모 (예: 단어장, 물통)" />
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px;">요일 선택</div>
        <div class="day-chips" id="ac-days">
          ${[1,2,3,4,5,6,0].map(d => `<button type="button" class="day-chip ${[1,3,5].includes(d)?'on':''}" data-day="${d}">${DAY_NAMES[d]}</button>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary" data-action="add-academy">시간표에 저장</button>
    </div>
  `;
}

function renderCollectionTab(kid) {
  const col = kid.collection || [];
  return `
    <div class="card">
      <div class="card-title">
        <span>${esc(kid.name)}의 Collection Room (명예의 전당)</span>
        <span class="pill success">총 ${col.length}마리 완성!</span>
      </div>
      <p style="color:var(--text-muted);font-size:14px;margin-top:0;">
        캐릭터가 220 XP(레전드 마스터)에 도달하면 이곳에 영구 보관되며, 감점되어도 컬렉션 룸의 완성 캐릭터는 사라지지 않아요!
      </p>
      ${col.length === 0 ? `
        <div style="text-align:center;padding:30px;color:var(--text-muted);">아직 완성된 캐릭터가 없어요. 오늘 숙제부터 차근차근 모아보세요!</div>
      ` : `
        <div class="collection-grid">
          ${col.map(item => {
            const ch = CHARACTERS.find(c => c.id === item.charId) || CHARACTERS[0];
            return `
              <div class="collection-card" style="background:${ch.bg}">
                ${renderCharacterSvg(ch.id, 5, 130)}
                <div style="font-size:17px;font-weight:800;margin-top:6px;">${esc(ch.name)}</div>
                <div class="pill success" style="margin:6px 0;">레전드 완성</div>
                <div style="font-size:12px;color:var(--text-muted);font-weight:600;">달성일: ${esc(item.completedAt)}</div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>

    <div class="card">
      <div class="card-title"><span>전체 6종 캐릭터 도감 (지금 키울 파트너 선택)</span></div>
      <div class="collection-grid">
        ${CHARACTERS.map(ch => {
          const isCurrent = kid.activeCharId === ch.id;
          const ownedCount = col.filter(c => c.charId === ch.id).length;
          return `
            <div class="collection-card">
              ${renderCharacterSvg(ch.id, 4, 115)}
              <div style="font-size:16px;font-weight:800;">${esc(ch.name)}</div>
              <div style="font-size:12px;color:var(--text-muted);margin:4px 0 10px;">${esc(ch.desc)}</div>
              <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                ${ownedCount > 0 ? `<span class="pill success">보유 ${ownedCount}회</span>` : ''}
                ${isCurrent
                  ? `<span class="pill">현재 육성 중</span>`
                  : `<button class="btn btn-soft btn-sm" data-action="select-char" data-char-id="${esc(ch.id)}">이 캐릭터 키우기</button>`}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderParentTab() {
  if (!ui.parentUnlocked) {
    return `
      <div class="card" style="max-width:440px;margin:24px auto;text-align:center;">
        <h2 style="margin-top:0;">부모 관리 모드</h2>
        <p style="color:var(--text-muted);font-size:14px;">숙제 자동 배정, 사진 OCR 업로드, 감점 관리, 단어 수준 설정을 위해 PIN을 입력하세요. (초기 PIN: <strong>1234</strong>)</p>
        <input id="parent-pin-input" type="password" inputmode="numeric" class="input" placeholder="부모 PIN (예: 1234)" style="text-align:center;font-size:20px;letter-spacing:4px;margin-bottom:12px;" />
        <button class="btn btn-primary" style="width:100%;" data-action="unlock-parent">잠금 해제</button>
      </div>
    `;
  }

  const targetKid = ui.state.kids[ui.parentTargetKid];
  const sub = ui.parentSubTab;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;gap:8px;align-items:center;">
          <strong style="font-size:17px;">관리 대상 아이:</strong>
          <button class="btn ${ui.parentTargetKid === 'bella' ? 'btn-primary' : 'btn-outline'} btn-sm" data-action="set-parent-kid" data-kid="bella">Bella (초6)</button>
          <button class="btn ${ui.parentTargetKid === 'wanny' ? 'btn-primary' : 'btn-outline'} btn-sm" data-action="set-parent-kid" data-kid="wanny">Wanny (초3)</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn ${sub==='homework'?'btn-soft':'btn-outline'} btn-sm" data-action="set-parent-sub" data-sub="homework">숙제/OCR 입력</button>
          <button class="btn ${sub==='penalty'?'btn-soft':'btn-outline'} btn-sm" data-action="set-parent-sub" data-sub="penalty">감점/칭찬</button>
          <button class="btn ${sub==='vocab'?'btn-soft':'btn-outline'} btn-sm" data-action="set-parent-sub" data-sub="vocab">영단어 수준</button>
          <button class="btn ${sub==='settings'?'btn-soft':'btn-outline'} btn-sm" data-action="set-parent-sub" data-sub="settings">날씨·백업·PIN</button>
        </div>
      </div>
    </div>

    ${sub === 'homework' ? renderParentHomework(targetKid) : ''}
    ${sub === 'penalty' ? renderParentPenalty(targetKid) : ''}
    ${sub === 'vocab' ? renderParentVocab(targetKid) : ''}
    ${sub === 'settings' ? renderParentSettings() : ''}
  `;
}

function renderParentHomework(kid) {
  return `
    <div class="card">
      <div class="card-title">
        <span>방법 1 (추천) · 문제집 자동 배정 규칙 (${esc(kid.name)})</span>
        <span class="pill">매일 페이지 자동 계산</span>
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0;">
        매일 일일이 입력할 필요 없이 문제집의 시작 페이지와 하루 분량만 등록하면 요일에 맞춰 자동으로 일일 숙제가 생성됩니다.
      </p>
      ${(kid.workbooks || []).map(wb => `
        <div class="academy-item">
          <div>
            <div style="font-weight:800;">[${esc(wb.subject)}] ${esc(wb.title)}</div>
            <div style="font-size:12px;color:var(--text-muted);">
              현재 p.${wb.currentPage} ~ (총 ${wb.totalPages}p) · 하루 ${wb.pagesPerDay}쪽 · 요일: ${wb.daysOfWeek.map(d => DAY_NAMES[d]).join(', ')} · +${wb.xp} XP
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-soft btn-sm" data-action="gen-wb-14" data-wb-id="${esc(wb.id)}">14일치 생성</button>
            <button class="btn btn-danger btn-sm" data-action="delete-wb" data-wb-id="${esc(wb.id)}">삭제</button>
          </div>
        </div>
      `).join('')}

      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">
        <div style="font-weight:700;font-size:14px;margin-bottom:8px;">새 문제집 자동 배정 추가</div>
        <div class="form-row">
          <div><label style="font-size:11px;font-weight:700;color:var(--text-muted);">과목</label><input id="wb-subject" class="input" placeholder="예: 수학" value="수학" /></div>
          <div><label style="font-size:11px;font-weight:700;color:var(--text-muted);">문제집 이름</label><input id="wb-title" class="input" placeholder="예: 최상위 수학 6-2" /></div>
          <div><label style="font-size:11px;font-weight:700;color:var(--text-muted);">시작 페이지</label><input id="wb-start" type="number" class="input" value="1" /></div>
          <div><label style="font-size:11px;font-weight:700;color:var(--text-muted);">하루 쪽수</label><input id="wb-perday" type="number" class="input" value="2" /></div>
          <div><label style="font-size:11px;font-weight:700;color:var(--text-muted);">총 페이지</label><input id="wb-total" type="number" class="input" value="120" /></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div class="day-chips" id="wb-days">
            ${[1,2,3,4,5,6,0].map(d => `<button type="button" class="day-chip ${[1,2,3,4,5].includes(d)?'on':''}" data-day="${d}">${DAY_NAMES[d]}</button>`).join('')}
          </div>
          <button class="btn btn-primary" data-action="add-workbook">자동 배정 등록</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>방법 2 · 주간 계획표/목차 사진 OCR 스캔 & 일괄 붙여넣기</span>
        <span class="pill success">Tesseract.js 한국어·영어 OCR</span>
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0;">
        인쇄된 주간 학습표나 문제집 목차를 찍어 올리면 자동으로 과목과 페이지를 읽어옵니다. 손글씨나 카톡 메시지는 iPad 라이브 텍스트로 복사해 아래 칸에 붙여넣으면 더욱 빠릅니다!
      </p>
      <div class="form-row">
        <div>
          <label class="btn btn-soft" style="width:100%;cursor:pointer;">
            사진 찍기 / 앨범에서 선택해 OCR 스캔
            <input type="file" id="ocr-file-input" accept="image/*" style="display:none;" />
          </label>
          ${ui.ocrStatus ? `<div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:8px;">${esc(ui.ocrStatus)}</div>` : ''}
        </div>
        <button class="btn btn-outline" data-action="fill-ocr-sample">인식 예시 텍스트 불러오기</button>
      </div>

      <textarea id="bulk-hw-text" class="textarea" placeholder="여기에 OCR 결과가 채워지거나, 직접/라이브텍스트로 붙여넣으세요.&#10;예시:&#10;월: 쎈 수학 p.48~50, 영어 리딩 p.24~25&#10;화: 매3비 비문학 p.18~19&#10;수: 영단어 20개 복습">${esc(ui.ocrRawText)}</textarea>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn btn-primary" data-action="parse-bulk-text">자동 분석해서 미리보기</button>
      </div>

      ${ui.ocrDrafts.length > 0 ? `
        <div style="margin-top:14px;padding:12px;border-radius:16px;background:var(--surface-soft);">
          <div style="font-weight:800;margin-bottom:8px;">인식된 숙제 목록 (${ui.ocrDrafts.length}건) · 확인 후 일괄 등록</div>
          ${ui.ocrDrafts.map((d, idx) => `
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
              <input type="checkbox" ${d.selected ? 'checked' : ''} data-action="toggle-ocr-draft" data-idx="${idx}" />
              <span class="pill neutral">${esc(d.dateKey)}</span>
              <span class="pill">${esc(d.subject)}</span>
              <span style="flex:1;font-weight:600;">${esc(d.title)}</span>
            </div>
          `).join('')}
          <button class="btn btn-success" style="margin-top:8px;" data-action="commit-ocr-drafts">${esc(kid.name)} 숙제로 일괄 등록하기</button>
        </div>
      ` : ''}
    </div>

    <div class="card">
      <div class="card-title"><span>방법 3 · 오늘/특정 날짜 숙제 1건 직접 입력</span></div>
      <div class="form-row">
        <input id="single-date" type="date" class="input" value="${esc(ui.selectedDate)}" />
        <input id="single-subject" class="input" placeholder="과목 (예: 수학)" value="수학" />
        <input id="single-title" class="input" placeholder="내용 (예: 연산 프린트 2장)" />
        <input id="single-xp" type="number" class="input" value="20" placeholder="XP" />
      </div>
      <button class="btn btn-primary" data-action="add-single-hw">숙제 1건 추가</button>
    </div>
  `;
}

function renderParentPenalty(kid) {
  const stage = getStageForXp(kid.charXp);
  return `
    <div class="card">
      <div class="card-title">
        <span>${esc(kid.name)} 감점(성장 후퇴) & 특별 칭찬 관리</span>
        <span class="pill">${esc(stage.badge)} · ${kid.charXp} XP</span>
      </div>
      <p style="font-size:13px;color:var(--text-muted);margin-top:0;">
        숙제를 완수하지 못했거나 약속을 어겼을 때 감점을 반영하면 캐릭터 경험치가 줄고, 이전 단계 기준보다 낮아지면 <strong>캐릭터 단계가 실제로 후퇴</strong>합니다.
      </p>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <button class="btn btn-danger" data-action="quick-xp" data-delta="-20" data-reason="숙제 미완료 감점">숙제 미완료 (-20 XP)</button>
        <button class="btn btn-danger" data-action="quick-xp" data-delta="-15" data-reason="약속/미디어 시간 초과">약속 시간 초과 (-15 XP)</button>
        <button class="btn btn-danger" data-action="quick-xp" data-delta="-10" data-reason="정리정돈 미흡">방 정리 안 함 (-10 XP)</button>
        <button class="btn btn-success" data-action="quick-xp" data-delta="20" data-reason="부모님 특별 칭찬 보너스">특별 칭찬 (+20 XP)</button>
      </div>

      <div class="form-row">
        <input id="custom-xp-reason" class="input" placeholder="사유 입력 (예: 동생과 사이좋게 지냄 / 거짓말함)" />
        <input id="custom-xp-delta" type="number" class="input" value="-15" placeholder="점수 (감점은 음수)" />
        <button class="btn btn-primary" data-action="apply-custom-xp">점수 반영</button>
      </div>
    </div>
  `;
}

function renderParentVocab(kid) {
  return `
    <div class="card">
      <div class="card-title"><span>${esc(kid.name)} 영단어 수준 & 주간 복습 요일 설정</span></div>
      <div class="form-row">
        <div>
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">학습 수준 선택</label>
          <select id="kid-vocab-level" class="select">
            ${VOCAB_LEVELS.map(v => `<option value="${v.level}" ${kid.vocabLevel === v.level ? 'selected' : ''}>${esc(v.label)} (${esc(v.cefr)})</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">주간 오답 복습 데이</label>
          <select id="global-review-day" class="select">
            ${DAY_NAMES.map((name, idx) => `<option value="${idx}" ${Number(ui.state.settings.reviewDayOfWeek) === idx ? 'selected' : ''}>매주 ${name}요일</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" data-action="save-vocab-settings">수준·복습 요일 저장</button>
    </div>

    <div class="card">
      <div class="card-title"><span>부모 직접 영단어 추가 (학원 단어장 연동)</span></div>
      <div class="form-row">
        <input id="cw-word" class="input" placeholder="영어 단어 (예: telescope)" />
        <input id="cw-meaning" class="input" placeholder="한국어 뜻 (예: 망원경)" />
        <select id="cw-level" class="select">
          ${VOCAB_LEVELS.map(v => `<option value="${v.level}" ${kid.vocabLevel === v.level ? 'selected' : ''}>Level ${v.level}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <input id="cw-sentence" class="input" placeholder="예문 (Word Scramble용, 예: I see stars with a telescope.)" />
        <input id="cw-sentence-ko" class="input" placeholder="예문 해석 (예: 나는 망원경으로 별을 봐요.)" />
      </div>
      <button class="btn btn-primary" data-action="add-custom-word">단어장에 추가</button>
    </div>
  `;
}

function renderParentSettings() {
  return `
    <div class="card">
      <div class="card-title"><span>날씨 지역 · 부모 PIN · 데이터 백업</span></div>
      <div class="form-row">
        <div>
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">날씨 지역 (Open-Meteo)</label>
          <select id="setting-city" class="select">
            ${KOREAN_CITIES.map(c => `<option value="${c.id}" ${ui.state.settings.cityId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:13px;font-weight:700;display:block;margin-bottom:6px;">부모 모드 PIN</label>
          <input id="setting-pin" class="input" value="${esc(ui.state.settings.parentPin)}" maxlength="8" />
        </div>
      </div>
      <button class="btn btn-primary" data-action="save-general-settings">지역·PIN 저장</button>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn btn-outline" data-action="export-backup">JSON 백업 파일 다운로드</button>
        <label class="btn btn-outline" style="cursor:pointer;">
          백업 파일 불러오기
          <input type="file" id="import-backup-input" accept=".json,application/json" style="display:none;" />
        </label>
        <button class="btn btn-danger" data-action="reset-demo-data">초기 예시 데이터로 리셋</button>
      </div>
    </div>
  `;
}

function renderModal() {
  if (!ui.modal) return '';
  if (ui.modal.type === 'parent-pin') {
    return `
      <div class="modal-backdrop">
        <div class="modal-box" style="text-align:center;">
          <h3 style="margin-top:0;">부모 관리 모드 잠금 해제</h3>
          <p style="font-size:14px;color:var(--text-muted);">초기 비밀번호는 <strong>1234</strong>입니다.</p>
          <input id="modal-pin-input" type="password" inputmode="numeric" class="input" style="text-align:center;font-size:20px;margin-bottom:12px;" placeholder="PIN 입력" />
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-outline" data-action="close-modal">취소</button>
            <button class="btn btn-primary" data-action="confirm-modal-pin">확인</button>
          </div>
        </div>
      </div>
    `;
  }
  if (ui.modal.type === 'char-picker') {
    const kid = ui.state.kids[ui.currentKidId];
    return `
      <div class="modal-backdrop">
        <div class="modal-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">함께 성장할 캐릭터 선택</h3>
            <button class="btn btn-outline btn-sm" data-action="close-modal">닫기</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            ${CHARACTERS.map(c => `
              <button class="mode-card" style="text-align:center;${kid.activeCharId===c.id?'border-color:var(--primary);background:var(--primary-soft);':''}" data-action="select-char" data-char-id="${esc(c.id)}">
                ${renderCharacterSvg(c.id, 3, 90)}
                <div style="font-weight:800;font-size:14px;">${esc(c.name)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${esc(c.tag)}</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
  if (ui.modal.type === 'celebrate') {
    const { title, body, charId, stage } = ui.modal;
    return `
      <div class="modal-backdrop">
        <div class="modal-box" style="text-align:center;">
          ${charId ? renderCharacterSvg(charId, stage || 5, 160) : ''}
          <h2 style="margin:8px 0;">${esc(title)}</h2>
          <p style="color:var(--text-muted);font-size:15px;">${esc(body)}</p>
          <button class="btn btn-primary" style="width:100%;" data-action="close-modal">확인!</button>
        </div>
      </div>
    `;
  }
  return '';
}

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', handleAction);
  });

  document.querySelectorAll('#ac-days .day-chip, #wb-days .day-chip').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('on'));
  });

  const dateInput = document.querySelector('[data-action="pick-date"]');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      ui.selectedDate = e.target.value || getTodayKey(0);
      render();
    });
  }

  const typingInput = document.getElementById('vocab-typing-input');
  if (typingInput) {
    typingInput.focus();
    typingInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitTypingAnswer();
    });
  }

  const ocrInput = document.getElementById('ocr-file-input');
  if (ocrInput) {
    ocrInput.addEventListener('change', handleOcrFileChange);
  }

  const importInput = document.getElementById('import-backup-input');
  if (importInput) {
    importInput.addEventListener('change', handleImportBackup);
  }
}

async function handleOcrFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await runBrowserOcr(file, (msg) => {
      ui.ocrStatus = msg;
      render();
    });
    ui.ocrRawText = text;
    ui.ocrDrafts = parseHomeworkText(text);
    ui.ocrStatus = `인식 완료! ${ui.ocrDrafts.length}건의 숙제를 추출했어요.`;
    render();
  } catch (err) {
    ui.ocrStatus = `OCR 오류: ${err.message}`;
    render();
  }
}

async function handleImportBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const txt = await file.text();
    ui.state = importStateJson(txt);
    showToast('백업 데이터를 성공적으로 불러왔습니다!');
    initWeather(true);
  } catch (err) {
    showToast(`불러오기 실패: ${err.message}`);
  }
}

function submitTypingAnswer() {
  const s = ui.vocabSession;
  if (!s) return;
  const cur = s.items[s.index];
  if (cur.answered) return;
  const val = (document.getElementById('vocab-typing-input')?.value || '').trim().toLowerCase();
  if (!val) return;
  cur.typed = val;
  const ok = val === cur.wordObj.word.toLowerCase();
  finalizeQuestionAnswer(cur, ok);
}

function finalizeQuestionAnswer(cur, isCorrect) {
  const s = ui.vocabSession;
  const kid = ui.state.kids[ui.currentKidId];
  cur.answered = true;
  cur.isCorrect = isCorrect;

  if (isCorrect) {
    s.correctCount += 1;
    s.earnedXp += 3;
    fireConfetti(false);
  } else {
    s.wrongInSession.push(cur.wordObj.word);
  }
  recordVocabAnswer(kid, cur.wordObj.id, isCorrect, s.isReview);
  saveState(ui.state);
  speakEnglish(cur.wordObj.word);
  render();
}

function handleXpOutcome(outcome, charId) {
  if (!outcome) return;
  if (outcome.completedChar) {
    fireConfetti(true);
    ui.modal = {
      type: 'celebrate',
      charId: outcome.completedChar.charId,
      stage: 5,
      title: `${outcome.completedChar.name} 레전드 완성!`,
      body: `220 XP를 모두 채워 Collection Room에 영구 보관되었어요! 이제 새로운 알과 모험을 시작해요.`
    };
  } else if (outcome.evolved) {
    fireConfetti(true);
    const st = getStageForXp(outcome.nextXp);
    ui.modal = {
      type: 'celebrate',
      charId,
      stage: st.stage,
      title: `축하해요! ${st.badge} ${st.name}로 진화!`,
      body: `꾸준한 노력으로 캐릭터가 한 단계 더 멋지게 성장했어요!`
    };
  } else if (outcome.devolved) {
    const prevSt = EVOLUTION_STAGES[outcome.prevStage - 1];
    const nextSt = EVOLUTION_STAGES[outcome.nextStage - 1];
    ui.modal = {
      type: 'celebrate',
      charId,
      stage: nextSt.stage,
      title: `성장이 ${prevSt.badge} → ${nextSt.badge}로 후퇴했어요`,
      body: `감점이 반영되어 단계가 내려갔어요. 오늘 숙제와 영단어를 완수하면 금방 다시 성장할 수 있어요!`
    };
  }
}

function handleAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const kid = ui.currentKidId ? ui.state.kids[ui.currentKidId] : null;

  if (action === 'login-kid') {
    ui.currentKidId = btn.dataset.kid;
    ui.tab = 'today';
    ui.selectedDate = getTodayKey(0);
    render();
    return;
  }
  if (action === 'switch-kid') {
    ui.currentKidId = null;
    ui.vocabSession = null;
    render();
    return;
  }
  if (action === 'open-parent-from-login') {
    ui.modal = { type: 'parent-pin' };
    render();
    return;
  }
  if (action === 'confirm-modal-pin') {
    const pin = document.getElementById('modal-pin-input')?.value || '';
    if (pin === ui.state.settings.parentPin) {
      ui.parentUnlocked = true;
      ui.currentKidId = ui.currentKidId || 'bella';
      ui.tab = 'parent';
      ui.modal = null;
      render();
    } else {
      showToast('PIN 번호가 일치하지 않습니다.');
    }
    return;
  }
  if (action === 'close-modal') {
    ui.modal = null;
    render();
    return;
  }
  if (action === 'go-tab') {
    ui.tab = btn.dataset.tab;
    render();
    return;
  }
  if (action === 'refresh-weather') {
    initWeather(true);
    showToast('최신 날씨를 다시 불러왔습니다.');
    return;
  }
  if (action === 'shift-date') {
    const d = new Date(ui.selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + Number(btn.dataset.delta));
    ui.selectedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    render();
    return;
  }
  if (action === 'set-today') {
    ui.selectedDate = getTodayKey(0);
    render();
    return;
  }
  if (action === 'toggle-task') {
    const list = ensureTasksForDate(ui.state, kid.id, ui.selectedDate);
    const task = list.find(t => t.id === btn.dataset.taskId);
    if (!task) return;
    task.done = !task.done;
    // 문제집 진행 페이지 업데이트
    if (task.done && task.wbId) {
      const wb = kid.workbooks.find(w => w.id === task.wbId);
      if (wb) wb.currentPage = Math.min(wb.totalPages, wb.currentPage + wb.pagesPerDay);
    }
    const delta = task.done ? task.xp : -task.xp;
    const outcome = applyXpChange(ui.state, kid.id, delta, `${task.done ? '완료' : '취소'}: ${task.title}`);
    if (task.done) fireConfetti(false);
    handleXpOutcome(outcome, kid.activeCharId);
    render();
    return;
  }
  if (action === 'postpone-tasks') {
    const cnt = postponeTodayTasksToTomorrow(ui.state, kid.id, ui.selectedDate);
    showToast(cnt > 0 ? `미완료 숙제 ${cnt}건을 내일로 이월했습니다.` : '이월할 숙제가 없어요.');
    render();
    return;
  }
  if (action === 'add-quick-kid-task') {
    const inp = document.getElementById('quick-kid-task');
    const title = (inp?.value || '').trim();
    if (!title) return;
    const list = ensureTasksForDate(ui.state, kid.id, ui.selectedDate);
    list.push({ id: `t_q_${Date.now()}`, subject: '할일', title, xp: 15, done: false, source: 'manual' });
    saveState(ui.state);
    render();
    return;
  }
  if (action === 'open-char-picker') {
    ui.modal = { type: 'char-picker' };
    render();
    return;
  }
  if (action === 'select-char') {
    kid.activeCharId = btn.dataset.charId;
    saveState(ui.state);
    ui.modal = null;
    showToast('성장할 캐릭터를 변경했어요!');
    render();
    return;
  }

  // Vocab actions
  if (action === 'speak-word') {
    speakEnglish(btn.dataset.text);
    return;
  }
  if (action === 'start-vocab') {
    const mode = btn.dataset.mode;
    const words = pickDaily20Words(ui.state, kid, 20);
    ui.vocabSession = {
      mode,
      isReview: false,
      items: words.map(w => createVocabQuestionItem(w, mode, ui.state)),
      index: 0,
      correctCount: 0,
      earnedXp: 0,
      wrongInSession: [],
      finished: false
    };
    render();
    return;
  }
  if (action === 'start-wrong-review') {
    ui.tab = 'vocab';
    const wrongWords = pickWrongReviewWords(ui.state, kid);
    if (wrongWords.length === 0) {
      showToast('복습할 오답 단어가 없어요!');
      render();
      return;
    }
    ui.vocabSession = {
      mode: 'mixed',
      isReview: true,
      items: wrongWords.map(w => createVocabQuestionItem(w, 'mixed', ui.state)),
      index: 0,
      correctCount: 0,
      earnedXp: 0,
      wrongInSession: [],
      finished: false
    };
    render();
    return;
  }
  if (action === 'answer-choice') {
    const cur = ui.vocabSession.items[ui.vocabSession.index];
    if (cur.answered) return;
    cur.userChoice = btn.dataset.wordId;
    finalizeQuestionAnswer(cur, cur.userChoice === cur.wordObj.id);
    return;
  }
  if (action === 'pick-tile') {
    const cur = ui.vocabSession.items[ui.vocabSession.index];
    if (cur.answered) return;
    const tid = btn.dataset.tileId;
    if (!cur.pickedIds.includes(tid)) cur.pickedIds.push(tid);
    render();
    return;
  }
  if (action === 'unpick-tile') {
    const cur = ui.vocabSession.items[ui.vocabSession.index];
    if (cur.answered) return;
    cur.pickedIds = cur.pickedIds.filter(id => id !== btn.dataset.tileId);
    render();
    return;
  }
  if (action === 'clear-scramble') {
    const cur = ui.vocabSession.items[ui.vocabSession.index];
    cur.pickedIds = [];
    render();
    return;
  }
  if (action === 'submit-scramble') {
    const cur = ui.vocabSession.items[ui.vocabSession.index];
    if (cur.answered) return;
    const pickedTexts = cur.pickedIds.map(id => {
      const t = cur.pool.find(x => x.id === id);
      return t.text || t.ch;
    });
    const ok = cur.scrambleKind === 'sentence'
      ? pickedTexts.join(' ').toLowerCase() === cur.expected.join(' ').toLowerCase()
      : pickedTexts.join('').toLowerCase() === cur.expected.join('').toLowerCase();
    finalizeQuestionAnswer(cur, ok);
    return;
  }
  if (action === 'submit-typing') {
    submitTypingAnswer();
    return;
  }
  if (action === 'next-vocab-q') {
    const s = ui.vocabSession;
    if (s.index + 1 < s.items.length) {
      s.index += 1;
      render();
    } else {
      s.finished = true;
      kid.vocabStats.sessionsDone = (kid.vocabStats.sessionsDone || 0) + 1;
      const totalGain = Math.max(5, s.earnedXp);
      const outcome = applyXpChange(ui.state, kid.id, totalGain, `${s.isReview ? '주간 영단어 오답 복습' : '영단어 20단어 학습'} (${s.correctCount}/${s.items.length})`);
      // 오늘 할일에 있는 영단어 미션 자동 체크
      const todayTasks = ensureTasksForDate(ui.state, kid.id, getTodayKey(0));
      const vTask = todayTasks.find(t => t.source === 'vocab' && !t.done);
      if (vTask && !s.isReview) vTask.done = true;
      saveState(ui.state);
      fireConfetti(true);
      handleXpOutcome(outcome, kid.activeCharId);
      render();
    }
    return;
  }
  if (action === 'close-vocab-session') {
    ui.vocabSession = null;
    render();
    return;
  }

  // Schedule actions
  if (action === 'add-academy') {
    const title = document.getElementById('ac-title')?.value.trim();
    const type = document.getElementById('ac-type')?.value || '학원';
    const start = document.getElementById('ac-start')?.value || '15:30';
    const end = document.getElementById('ac-end')?.value || '17:00';
    const note = document.getElementById('ac-note')?.value.trim() || '';
    const days = [...document.querySelectorAll('#ac-days .day-chip.on')].map(el => Number(el.dataset.day));
    if (!title || days.length === 0) {
      showToast('학원 이름과 요일을 선택해 주세요.');
      return;
    }
    kid.academies.push({ id: `ac_${Date.now()}`, title, type, start, end, note, days });
    saveState(ui.state);
    showToast('학원/학습지 시간표를 추가했어요!');
    render();
    return;
  }
  if (action === 'delete-academy') {
    kid.academies = kid.academies.filter(a => a.id !== btn.dataset.id);
    saveState(ui.state);
    render();
    return;
  }

  // Parent actions
  if (action === 'unlock-parent') {
    const pin = document.getElementById('parent-pin-input')?.value || '';
    if (pin === ui.state.settings.parentPin) {
      ui.parentUnlocked = true;
      render();
    } else {
      showToast('PIN 번호가 틀렸습니다. (초기값 1234)');
    }
    return;
  }
  if (action === 'set-parent-kid') {
    ui.parentTargetKid = btn.dataset.kid;
    render();
    return;
  }
  if (action === 'set-parent-sub') {
    ui.parentSubTab = btn.dataset.sub;
    render();
    return;
  }
  if (action === 'add-workbook') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    const subject = document.getElementById('wb-subject')?.value.trim() || '수학';
    const title = document.getElementById('wb-title')?.value.trim();
    const startP = Number(document.getElementById('wb-start')?.value || 1);
    const perDay = Math.max(1, Number(document.getElementById('wb-perday')?.value || 2));
    const totalP = Math.max(startP, Number(document.getElementById('wb-total')?.value || 120));
    const daysOfWeek = [...document.querySelectorAll('#wb-days .day-chip.on')].map(el => Number(el.dataset.day));
    if (!title || daysOfWeek.length === 0) {
      showToast('문제집 이름과 요일을 입력해 주세요.');
      return;
    }
    const newWb = { id: `wb_${Date.now()}`, subject, title, currentPage: startP, pagesPerDay: perDay, totalPages: totalP, daysOfWeek, xp: 20, active: true };
    pKid.workbooks.push(newWb);
    const created = generateWorkbookPlan(ui.state, pKid.id, newWb.id, 14);
    showToast(`문제집 등록 완료! 앞으로 14일 중 ${created}일치 숙제를 자동 생성했어요.`);
    render();
    return;
  }
  if (action === 'gen-wb-14') {
    const created = generateWorkbookPlan(ui.state, ui.parentTargetKid, btn.dataset.wbId, 14);
    showToast(`${created}일치 숙제를 추가로 생성했습니다.`);
    render();
    return;
  }
  if (action === 'delete-wb') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    pKid.workbooks = pKid.workbooks.filter(w => w.id !== btn.dataset.wbId);
    saveState(ui.state);
    render();
    return;
  }
  if (action === 'fill-ocr-sample') {
    ui.ocrRawText = `월: 쎈 수학 p.50~51, 리딩 튜터 p.24~25\n화: 매3비 초등 비문학 20-21쪽\n수: 기적의 계산법 p.32~33, 영단어 복습`;
    ui.ocrDrafts = parseHomeworkText(ui.ocrRawText);
    render();
    return;
  }
  if (action === 'parse-bulk-text') {
    const txt = document.getElementById('bulk-hw-text')?.value || '';
    ui.ocrRawText = txt;
    ui.ocrDrafts = parseHomeworkText(txt);
    showToast(`${ui.ocrDrafts.length}건의 숙제 항목을 분석했습니다.`);
    render();
    return;
  }
  if (action === 'toggle-ocr-draft') {
    const idx = Number(btn.dataset.idx);
    if (ui.ocrDrafts[idx]) ui.ocrDrafts[idx].selected = !ui.ocrDrafts[idx].selected;
    return;
  }
  if (action === 'commit-ocr-drafts') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    const picked = ui.ocrDrafts.filter(d => d.selected);
    for (const d of picked) {
      if (!pKid.tasksByDate[d.dateKey]) pKid.tasksByDate[d.dateKey] = [];
      pKid.tasksByDate[d.dateKey].push({
        id: `t_ocr_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        subject: d.subject,
        title: d.title,
        xp: d.xp || 20,
        done: false,
        source: 'ocr'
      });
    }
    saveState(ui.state);
    ui.ocrDrafts = [];
    ui.ocrRawText = '';
    ui.ocrStatus = '';
    showToast(`${pKid.name} 일정에 ${picked.length}건의 숙제를 일괄 등록했어요!`);
    render();
    return;
  }
  if (action === 'add-single-hw') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    const dk = document.getElementById('single-date')?.value || getTodayKey(0);
    const subject = document.getElementById('single-subject')?.value.trim() || '숙제';
    const title = document.getElementById('single-title')?.value.trim();
    const xp = Number(document.getElementById('single-xp')?.value || 20);
    if (!title) {
      showToast('숙제 내용을 입력해 주세요.');
      return;
    }
    if (!pKid.tasksByDate[dk]) pKid.tasksByDate[dk] = [];
    pKid.tasksByDate[dk].push({ id: `t_p_${Date.now()}`, subject, title, xp, done: false, source: 'parent' });
    saveState(ui.state);
    showToast(`${pKid.name} (${dk}) 숙제를 추가했습니다.`);
    render();
    return;
  }
  if (action === 'quick-xp') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    const delta = Number(btn.dataset.delta);
    const reason = btn.dataset.reason;
    const outcome = applyXpChange(ui.state, pKid.id, delta, reason);
    handleXpOutcome(outcome, pKid.activeCharId);
    showToast(`${pKid.name}: ${reason} (${delta >= 0 ? '+' : ''}${delta} XP)`);
    render();
    return;
  }
  if (action === 'apply-custom-xp') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    const reason = document.getElementById('custom-xp-reason')?.value.trim() || '부모 점수 반영';
    const delta = Number(document.getElementById('custom-xp-delta')?.value || 0);
    if (!delta) return;
    const outcome = applyXpChange(ui.state, pKid.id, delta, reason);
    handleXpOutcome(outcome, pKid.activeCharId);
    showToast(`${pKid.name} ${delta >= 0 ? '+' : ''}${delta} XP 반영 완료`);
    render();
    return;
  }
  if (action === 'save-vocab-settings') {
    const pKid = ui.state.kids[ui.parentTargetKid];
    pKid.vocabLevel = Number(document.getElementById('kid-vocab-level')?.value || 2);
    ui.state.settings.reviewDayOfWeek = Number(document.getElementById('global-review-day')?.value || 6);
    saveState(ui.state);
    showToast(`${pKid.name} 영단어 수준(Level ${pKid.vocabLevel}) 및 복습 요일을 저장했어요.`);
    render();
    return;
  }
  if (action === 'add-custom-word') {
    const word = document.getElementById('cw-word')?.value.trim().toLowerCase();
    const meaning = document.getElementById('cw-meaning')?.value.trim();
    const level = Number(document.getElementById('cw-level')?.value || 2);
    const sentence = document.getElementById('cw-sentence')?.value.trim() || `I practice the word ${word}.`;
    const sentenceKo = document.getElementById('cw-sentence-ko')?.value.trim() || `나는 ${word} 단어를 연습해요.`;
    if (!word || !meaning) {
      showToast('단어와 뜻을 모두 입력해 주세요.');
      return;
    }
    if (!ui.state.customWords) ui.state.customWords = [];
    ui.state.customWords.push({ id: `cw_${Date.now()}`, level, word, meaning, pos: '단어', cefr: 'Custom', ipa: '', sentence, sentenceKo });
    saveState(ui.state);
    showToast(`'${word}' 단어를 Level ${level}에 추가했습니다.`);
    render();
    return;
  }
  if (action === 'save-general-settings') {
    ui.state.settings.cityId = document.getElementById('setting-city')?.value || 'seoul';
    ui.state.settings.parentPin = document.getElementById('setting-pin')?.value.trim() || '1234';
    saveState(ui.state);
    initWeather(true);
    showToast('설정을 저장했습니다.');
    return;
  }
  if (action === 'export-backup') {
    const blob = new Blob([exportStateJson(ui.state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kidquest-backup-${getTodayKey(0)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  if (action === 'reset-demo-data') {
    ui.state = resetAllData();
    showToast('초기 예시 데이터로 복원했습니다.');
    render();
    return;
  }
}

// 앱 시작
render();
initWeather();
