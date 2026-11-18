import { html, useState, useEffect, useRef, Icon, Emo, Ring, Bar, Modal, toast, celebrate, TalentPill, SyncBadge, Empty } from './core.js';
import { PetStage, EvolutionOverlay, EvolutionLine, MoodBadge, petDisplayName } from './pet.js';
import { TaskList, DateNav, CreativeCards, MissionModal } from './missions.js';
import { VocabTab } from './vocab.js';
import * as M from '../model.js';
import { FOODS } from '../../data/shop.js';
import { SPECIES, STAGES, MAX_PET_XP, stageProgress } from '../../data/pets.js';
import { KID_COLORS } from '../../data/presets.js';
import { fetchWeatherForecast, buildWeatherAdvice, describeWeatherCode } from '../weather.js';
import { E, todayKey, dowOf, DAY_NAMES, toMinutes, nowMinutes, sfx, vibrate } from '../util.js';

const TABS = [
  { id: 'home', label: '홈', icon: 'house' },
  { id: 'missions', label: '미션', icon: 'list-checks' },
  { id: 'vocab', label: '영단어', icon: 'languages' },
  { id: 'pet', label: '내 펫', icon: 'paw-print' },
  { id: 'schedule', label: '시간표', icon: 'calendar-days' }
];

export function kidTheme(kid) {
  const c = KID_COLORS.find((x) => x.id === kid?.profile?.colorId) || KID_COLORS[0];
  return `--accent:${c.color};--accent-soft:${c.soft};--accent-ink:${c.color};--hero-2:${c.id === 'sky' ? '#22D3EE' : c.id === 'violet' ? '#EC4899' : '#F59E0B'}`;
}

export function KidApp({ kidId, tab, setTab, onExit, onParent }) {
  const kid = M.getKid(kidId);
  if (!kid) return html`<div class="picker"><${Empty} title="프로필을 찾을 수 없어요" /></div>`;
  const pet = M.activePet(kid);
  const bal = M.talentBalance(kid);
  const streak = M.streakOf(kid);
  const title = { home: `${kid.profile.name}의 하루`, missions: '오늘의 미션', vocab: '영단어 아레나', pet: '내 펫 키우기', schedule: '학원 시간표' }[tab];
  const pending = M.tasksFor(kid, todayKey(0)).filter((t) => !t.done).length;

  return html`<div class="shell" style=${kidTheme(kid)}>
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><${Icon} name="sparkles" size=${18} /></div>KidQuest</div>
      <button class="nav-item" style="margin-bottom:8px;background:var(--surface-2)" onClick=${onExit}>
        <img src=${E(pet ? pet.species.forms[pet.stage] : 'Egg')} width="28" height="28" alt="" />
        <div style="text-align:left;line-height:1.2"><div class="bold" style="color:var(--text)">${kid.profile.name}</div><div class="tiny muted">${kid.profile.grade}학년 · 프로필 전환</div></div>
      </button>
      ${TABS.map((t) => html`<button key=${t.id} class=${'nav-item ' + (tab === t.id ? 'on' : '')} onClick=${() => setTab(t.id)}>
        <${Icon} name=${t.icon} />${t.label}
        ${t.id === 'missions' && pending > 0 && html`<span class="badge accent">${pending}</span>`}
        ${t.id === 'pet' && pet && M.petMood(pet) === 'hungry' && html`<span class="badge warn">배고파요</span>`}
      </button>`)}
      <div class="sidebar-foot">
        <${SyncBadge} />
        <button class="nav-item" onClick=${onParent}><${Icon} name="shield-check" />부모 관리</button>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <h1>${title}</h1>
          <div class="sub">${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
        </div>
        <span class="grow"></span>
        ${streak > 0 && html`<span class="pill-streak num" title="연속 달성"><${Emo} name="Fire" size=${26} />${streak}일</span>`}
        <${TalentPill} value=${bal} />
      </header>
      ${tab === 'home' && html`<${Home} kid=${kid} pet=${pet} setTab=${setTab} />`}
      ${tab === 'missions' && html`<${MissionsTab} kid=${kid} />`}
      ${tab === 'vocab' && html`<${VocabTab} kid=${kid} />`}
      ${tab === 'pet' && html`<${PetRoom} kid=${kid} />`}
      ${tab === 'schedule' && html`<${ScheduleTab} kid=${kid} />`}
    </main>
    <nav class="tabbar">
      ${TABS.map((t) => html`<button key=${t.id} class=${'tab ' + (tab === t.id ? 'on' : '')} onClick=${() => setTab(t.id)}><${Icon} name=${t.icon} size=${22} />${t.label}</button>`)}
      <button class="tab" onClick=${onExit}><${Icon} name="users" size=${22} />전환</button>
    </nav>
  </div>`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '학교 잘 다녀왔어요?';
  if (h < 21) return '좋은 저녁이에요';
  return '오늘도 수고 많았어요';
}

function Home({ kid, pet, setTab }) {
  const today = todayKey(0);
  const tasks = M.tasksFor(kid, today);
  const done = tasks.filter((t) => t.done).length;
  const picks = M.creativePicks(kid, today);
  const crDone = picks.filter((m) => M.creativeDone(kid, today, m.id)).length;
  const vs = M.vocabStats(kid);
  const total = tasks.length + picks.length + 1;
  const complete = done + crDone + (vs.todayDone ? 1 : 0);
  const pct = total ? Math.round((complete / total) * 100) : 0;
  const mood = M.petMood(pet);
  const [mission, setMission] = useState(null);
  const earned = M.talentsEarnedOn(kid, today);

  return html`<div class="grid fade-in">
    <section class="hero">
      <div style="max-width:62%;position:relative;z-index:2">
        <div class="eyebrow" style="color:rgba(255,255,255,.75)">${greeting()}</div>
        <h2>${kid.profile.name}, 오늘 미션 ${complete}/${total} 완료!</h2>
        <p style="margin-top:4px">${pct >= 100 ? '완벽해요! 펫에게 맛있는 간식을 주세요 🎉' : pct >= 50 ? '절반 넘었어요. 조금만 더 힘내요!' : '하나씩 체크하면 달란트가 쌓여요.'}</p>
        <div class="row wrap" style="margin-top:16px">
          <div class="glass"><div class="tiny" style="opacity:.8">오늘 모은 달란트</div><div class="bold num" style="font-size:20px">+${earned}</div></div>
          <div class="glass"><div class="tiny" style="opacity:.8">펫 상태</div><div class="bold" style="font-size:16px">${pet ? `${petDisplayName(pet)} · ${pet.stage === 5 ? '전설' : STAGES[pet.stage].name}` : '-'}</div></div>
          <button class="btn gold" onClick=${() => setTab('pet')}><${Icon} name="paw-print" size=${18} />${mood === 'hungry' ? '배고파요! 먹이 주기' : '펫 돌보기'}</button>
        </div>
      </div>
      <div class="hero-pet">${pet && html`<${PetStage} pet=${pet} mood=${mood} interactive=${true} />`}</div>
    </section>

    <div class="grid g-main">
      <div class="stack" style="gap:18px">
        <section class="card">
          <div class="card-h"><${Ring} pct=${tasks.length ? (done / tasks.length) * 100 : 0} size=${46} stroke=${6}><span class="tiny bold">${done}/${tasks.length}</span><//>
            <div class="grow"><h2>오늘의 숙제</h2><div class="muted small">체크하면 바로 달란트가 들어와요</div></div>
            <button class="btn sm" onClick=${() => setTab('missions')}>전체 보기</button></div>
          <${TaskList} kid=${kid} date=${today} compact=${true} />
        </section>
        <section class="card">
          <div class="card-h"><${Emo} name="Light bulb" size=${30} /><div class="grow"><h2>오늘의 창의 미션</h2><div class="muted small">하나당 달란트 3개 · ${crDone}/3 완료</div></div></div>
          <${CreativeCards} kid=${kid} date=${today} small=${true} onOpen=${setMission} />
        </section>
      </div>
      <div class="stack" style="gap:18px">
        <${WeatherCard} />
        <section class="card">
          <div class="card-h"><${Emo} name="Spiral calendar" size=${30} /><div class="grow"><h2>오늘 일정</h2><div class="muted small">${DAY_NAMES[dowOf(today)]}요일 학원·학습지</div></div><button class="btn sm" onClick=${() => setTab('schedule')}>주간</button></div>
          <${DayTimeline} kid=${kid} dow=${dowOf(today)} />
        </section>
        <section class="card">
          <div class="card-h"><${Emo} name="Abacus" size=${30} /><div class="grow"><h2>영단어</h2><div class="muted small">익힌 단어 ${vs.learned}개 · 복습 대기 ${vs.due}개</div></div></div>
          ${vs.todayDone ? html`<div class="tip"><${Emo} name="Hundred points" size=${22} /><div>오늘의 단어 학습 완료! 게임으로 더 연습해 보세요.</div></div>` : html`<button class="btn primary block lg" onClick=${() => setTab('vocab')}><${Icon} name="play" size=${18} />오늘의 단어 시작 (+3)</button>`}
        </section>
      </div>
    </div>
    ${mission && html`<${MissionModal} kid=${kid} date=${today} mission=${mission} onClose=${() => setMission(null)} />`}
  </div>`;
}

const WEATHER_EMOJI = { sun: 'Sun', partly: 'Sun behind cloud', cloud: 'Sun behind cloud', rain: 'Umbrella with rain drops', snow: 'Snowman', storm: 'High voltage' };
function WeatherCard() {
  const [w, setW] = useState(null);
  const city = M.settings().cityId || 'seoul';
  useEffect(() => { fetchWeatherForecast(city).then(setW).catch(() => {}); }, [city]);
  if (!w) return html`<section class="card"><div class="muted small">날씨 불러오는 중…</div></section>`;
  const d = w.tomorrow;
  const desc = describeWeatherCode(d.weatherCode);
  const tips = buildWeatherAdvice(d);
  return html`<section class="card">
    <div class="weather">
      <img src=${E(WEATHER_EMOJI[desc.icon] || 'Sun')} alt="" />
      <div class="grow"><div class="eyebrow">내일 ${w.cityName}</div><div class="bold" style="font-size:20px">${desc.label} ${Math.round(d.minTemp)}° / ${Math.round(d.maxTemp)}°</div><div class="small muted">강수확률 ${d.precipProb}%</div></div>
    </div>
    <div class="stack" style="gap:8px;margin-top:12px">${tips.map((t, i) => html`<div key=${i} class="tip"><span class=${'badge ' + (t.level === 'alert' ? 'bad' : t.level === 'ok' ? 'good' : 'warn')}>${t.badge}</span><span>${t.text}</span></div>`)}</div>
  </section>`;
}

function MissionsTab({ kid }) {
  const [date, setDate] = useState(todayKey(0));
  const [mission, setMission] = useState(null);
  const picks = M.creativePicks(kid, date);
  const day = (kid.creative || {})[date] || {};
  const allDone = picks.every((m) => M.creativeDone(kid, date, m.id));
  const isToday = date === todayKey(0);
  return html`<div class="stack fade-in" style="gap:18px">
    <div class="row between wrap"><${DateNav} date=${date} setDate=${setDate} /></div>
    <section class="card">
      <div class="card-h"><${Emo} name="Books" size=${30} /><div class="grow"><h2>숙제 · 할 일</h2><div class="muted small">완료 체크 → 달란트 획득 · 부모님 폰에도 바로 표시돼요</div></div></div>
      <${TaskList} kid=${kid} date=${date} allowKidAdd=${isToday} />
    </section>
    <section>
      <div class="row between" style="margin-bottom:12px">
        <div class="row"><${Emo} name="Rocket" size=${30} /><div><h2 style="font-size:18px;font-weight:800">창의 미션</h2><div class="small muted">매일 새로운 도전 3개 · 그림, 글쓰기, 실험, 퍼즐, 영어 말하기…</div></div></div>
        ${isToday && !allDone && (day.rerolls || 0) < 1 && html`<button class="btn sm" onClick=${() => { M.rerollCreative(kid.id, date); toast('새로운 미션이 도착했어요!', 'Wrapped gift'); }}><${Icon} name="shuffle" size=${16} />다른 미션 받기</button>`}
      </div>
      <${CreativeCards} kid=${kid} date=${date} onOpen=${setMission} />
    </section>
    ${mission && html`<${MissionModal} kid=${kid} date=${date} mission=${mission} onClose=${() => setMission(null)} />`}
  </div>`;
}

// ---------- 펫 방 ----------
function PetRoom({ kid }) {
  const pet = M.activePet(kid);
  const pets = M.petsOf(kid);
  const bal = M.talentBalance(kid);
  const [fx, setFx] = useState(null);
  const [evo, setEvo] = useState(null);
  const [adopt, setAdopt] = useState(false);
  const [rename, setRename] = useState(false);
  const stageRef = useRef(null);
  if (!pet) return html`<div class="card"><${Empty} emoji="Egg" title="아직 펫이 없어요" /><button class="btn primary" onClick=${() => setAdopt(true)}>알 입양하기</button>${adopt && html`<${AdoptModal} kid=${kid} onClose=${() => setAdopt(false)} />`}</div>`;
  const prog = stageProgress(pet.xp);
  const mood = M.petMood(pet);
  const legendary = pet.xp >= MAX_PET_XP;

  function feed(food, ev) {
    if (legendary) return toast('전설이 된 펫은 도감에 기록돼요. 새 알을 입양해 보세요!', 'Crown');
    if (bal < food.cost) { sfx('bad'); vibrate(30); return toast(`달란트가 ${food.cost - bal}개 부족해요`, 'Coin'); }
    flyFood(ev.currentTarget, stageRef.current, food.e);
    setTimeout(() => {
      const r = M.feedPet(kid.id, food.id);
      if (!r.ok) return toast(r.msg, 'Thinking face');
      setFx({ key: Date.now(), type: 'eat', xp: r.gain });
      if (r.fav) toast(`최애 간식! 경험치 1.5배 (+${r.gain})`, 'Smiling face with hearts');
      if (r.evolved || r.legendary) setTimeout(() => setEvo({ from: r.prevStage, to: r.nextStage }), 1100);
    }, 520);
  }

  return html`<div class="grid g-main fade-in">
    <section class="card" style="overflow:hidden">
      <div class="row between wrap">
        <div>
          <div class="eyebrow" style=${`color:${pet.species.color}`}>${pet.species.name} · ${legendary ? pet.species.legend : STAGES[pet.stage].name}</div>
          <div class="row"><h2 style="font-size:26px;font-weight:900;letter-spacing:-.03em">${petDisplayName(pet)}</h2>
            <button class="icon-btn sm" title="이름 짓기" onClick=${() => setRename(true)}><${Icon} name="pencil" size=${15} /></button></div>
        </div>
        <${MoodBadge} mood=${mood} />
      </div>
      <div ref=${stageRef} style="max-width:440px;margin:0 auto">
        <${PetStage} pet=${pet} mood=${mood} interactive=${true} fx=${fx} />
      </div>
      ${legendary ? html`<div class="tip" style="background:var(--gold-soft)"><${Emo} name="Crown" size=${26} /><div class="grow"><b>전설 달성!</b> ${pet.species.legend}(으)로 완전히 성장했어요. 도감에 영원히 남아요.</div><button class="btn gold" onClick=${() => setAdopt(true)}>새 알 입양</button></div>`
        : html`<div class="stack" style="gap:8px">
          <div class="row between small"><b>${STAGES[pet.stage].name} → ${prog.next ? (prog.next.stage === 5 ? '전설' : prog.next.name) : ''}</b><span class="muted num">${pet.xp} / ${prog.next?.min} XP · ${prog.need} 남음</span></div>
          <${Bar} pct=${prog.pct} kind="gold" />
        </div>`}
      <hr class="sep" />
      <div class="eyebrow" style="margin-bottom:6px">진화 라인</div>
      <${EvolutionLine} species=${pet.species} stage=${pet.stage} />
    </section>

    <div class="stack" style="gap:18px">
      <section class="card">
        <div class="card-h"><${Emo} name="Shortcake" size=${30} /><div class="grow"><h2>먹이 상점</h2><div class="muted small">미션으로 모은 달란트로 먹이를 주면 펫이 자라요</div></div><${TalentPill} value=${bal} /></div>
        <div class="food-grid">
          ${FOODS.map((f) => html`<button key=${f.id} class=${'food ' + (bal < f.cost ? 'locked' : '')} onClick=${(e) => feed(f, e)}>
            ${pet.species.fav === f.id && html`<span class="fav badge bad" title="최애 간식">♥</span>`}
            <img src=${E(f.e)} alt="" />
            <span class="fname">${f.name}</span>
            <span class="fxp">+${pet.species.fav === f.id ? Math.round(f.xp * 1.5) : f.xp} XP</span>
            <span class="fcost"><img src=${E('Coin')} alt="" />${f.cost}</span>
          </button>`)}
        </div>
      </section>
      <section class="card">
        <div class="card-h"><${Emo} name="Trophy" size=${30} /><div class="grow"><h2>펫 도감</h2><div class="muted small">전설까지 키운 펫이 모여요 · ${pets.filter((p) => p.xp >= MAX_PET_XP).length}/${SPECIES.length}</div></div>
          <button class="btn sm" onClick=${() => setAdopt(true)}><${Icon} name="egg" size=${16} />입양</button></div>
        <div class="dex">
          ${SPECIES.map((sp) => {
            const mine = pets.filter((p) => p.species.id === sp.id);
            const best = mine.sort((a, b) => b.xp - a.xp)[0];
            const isLegend = best && best.xp >= MAX_PET_XP;
            const form = best ? sp.forms[best.stage] : sp.forms[4];
            return html`<button key=${sp.id} class=${`dex-item ${isLegend ? 'legend' : ''} ${best ? '' : 'unknown'}`} onClick=${() => best && best.id !== pet.id && !isLegend && (M.setActivePet(kid.id, best.id), toast(`${petDisplayName(best)}와(과) 함께해요!`, 'Sparkles'))}>
              <img src=${E(form)} alt="" width="64" height="64" />
              <div class="dex-name">${best ? (isLegend ? sp.legend : sp.name) : '???'}</div>
              <div class="tiny muted">${best ? (isLegend ? '전설 달성' : STAGES[best.stage].name + (best.id === pet.id ? ' · 함께하는 중' : '')) : '미발견'}</div>
            </button>`;
          })}
        </div>
      </section>
    </div>
    ${evo && html`<${EvolutionOverlay} pet=${M.activePet(M.getKid(kid.id)) || pet} from=${evo.from} to=${evo.to} onDone=${() => setEvo(null)} />`}
    ${adopt && html`<${AdoptModal} kid=${kid} onClose=${() => setAdopt(false)} />`}
    ${rename && html`<${RenameModal} kid=${kid} pet=${pet} onClose=${() => setRename(false)} />`}
  </div>`;
}

function flyFood(fromEl, toEl, emoji) {
  try {
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const img = document.createElement('img');
    img.src = E(emoji);
    img.className = 'flying-food';
    document.body.appendChild(img);
    const sx = a.left + a.width / 2 - 28, sy = a.top + a.height / 2 - 28;
    const ex = b.left + b.width / 2 - 28, ey = b.top + b.height * 0.55 - 28;
    img.animate([
      { transform: `translate(${sx}px, ${sy}px) scale(1) rotate(0)`, opacity: 1 },
      { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 120}px) scale(1.3) rotate(-20deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${ex}px, ${ey}px) scale(.4) rotate(10deg)`, opacity: 0.2 }
    ], { duration: 560, easing: 'cubic-bezier(.4,.1,.3,1)' }).onfinish = () => img.remove();
  } catch (_) {}
}

function AdoptModal({ kid, onClose }) {
  const [sel, setSel] = useState(null);
  const [name, setName] = useState('');
  const pets = M.petsOf(kid);
  const current = M.activePet(kid);
  const busy = current && current.xp < MAX_PET_XP;
  return html`<${Modal} title="새 알 입양하기" icon="Egg" onClose=${onClose} wide=${true}>
    ${busy && html`<div class="tip" style="margin-bottom:12px"><${Emo} name="Thinking face" size=${22} /><div>지금 키우는 <b>${petDisplayName(current)}</b>는 아직 전설이 아니에요. 새로 입양해도 기존 펫은 도감에서 다시 선택해 이어 키울 수 있어요.</div></div>`}
    <div class="dex">
      ${SPECIES.map((sp) => html`<button key=${sp.id} class="dex-item" style=${sel === sp.id ? `outline:3px solid ${sp.color};background:#fff` : ''} onClick=${() => setSel(sp.id)}>
        <img src=${E(sp.forms[4])} alt="" width="58" height="58" />
        <div class="dex-name">${sp.name}</div>
        <div class="tiny muted">${sp.desc}</div>
        ${pets.some((p) => p.species.id === sp.id && p.xp >= MAX_PET_XP) && html`<span class="badge gold" style="margin-top:4px">전설 보유</span>`}
      </button>`)}
    </div>
    ${sel && html`<div class="stack" style="margin-top:14px">
      <div class="card flat tight"><div class="eyebrow">진화 라인 미리보기</div><${EvolutionLine} species=${SPECIES.find((s) => s.id === sel)} stage=${0} /></div>
      <div class="row"><input class="input" placeholder="이름 (선택)" maxlength="12" value=${name} onInput=${(e) => setName(e.target.value)} />
        <button class="btn primary" onClick=${() => { M.adoptPet(kid.id, sel, name.trim()); celebrate(1); toast('새 알이 도착했어요! 먹이를 주면 부화해요', 'Egg'); onClose(); }}>입양하기</button></div>
    </div>`}
  <//>`;
}

function RenameModal({ kid, pet, onClose }) {
  const [name, setName] = useState(pet.name || '');
  return html`<${Modal} title="펫 이름 짓기" icon="Pencil" onClose=${onClose}>
    <div class="row"><input class="input" maxlength="12" value=${name} placeholder=${pet.species.name} onInput=${(e) => setName(e.target.value)} />
      <button class="btn primary" onClick=${() => { M.renamePet(kid.id, pet.id, name.trim()); onClose(); }}>저장</button></div>
  <//>`;
}

// ---------- 시간표 ----------
export function DayTimeline({ kid, dow }) {
  const items = Object.values(kid.academies || {}).filter((a) => a && (a.days || []).map(Number).includes(dow)).sort((a, b) => a.start.localeCompare(b.start));
  const now = nowMinutes();
  const isToday = dow === new Date().getDay();
  if (!items.length) return html`<div class="muted small">일정 없음 · 자유 시간!</div>`;
  return html`<div class="timeline">${items.map((a) => {
    const s = toMinutes(a.start), e = toMinutes(a.end);
    const state = !isToday ? '' : now > e ? 'past' : now >= s ? 'now' : '';
    return html`<div key=${a.id} class="tl-item"><div class="tl-time">${a.start}</div>
      <div class=${'tl-card ' + state} style=${`border-left-color:${typeColor(a.type)}`}>
        <div class="row between"><b>${a.title}</b>${state === 'now' && html`<span class="badge accent">진행 중</span>`}</div>
        <div class="tiny muted">${a.start}~${a.end} · ${a.type || '학원'}${a.note ? ' · ' + a.note : ''}</div>
      </div></div>`;
  })}</div>`;
}
const typeColor = (t) => ({ 학원: '#7C3AED', 학습지: '#F59E0B', 예체능: '#10B981', '과외/기타': '#0EA5E9' }[t] || '#7C3AED');

export function WeekGrid({ kid }) {
  const items = Object.values(kid.academies || {}).filter(Boolean);
  if (!items.length) return html`<${Empty} emoji="Spiral calendar" title="등록된 시간표가 없어요" sub="부모 관리에서 추가할 수 있어요" />`;
  const minH = Math.max(7, Math.floor(Math.min(...items.map((a) => toMinutes(a.start))) / 60));
  const maxH = Math.min(24, Math.ceil(Math.max(...items.map((a) => toMinutes(a.end))) / 60));
  const PX = 52;
  const height = (maxH - minH) * PX;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const todayDow = new Date().getDay();
  const now = nowMinutes();
  return html`<div class="scroll-x"><div class="week" style="min-width:720px">
    <div class="wh"></div>
    ${order.map((d) => html`<div key=${'h' + d} class=${'wh ' + (d === todayDow ? 'today' : '')}>${DAY_NAMES[d]}</div>`)}
    <div class="wtime" style=${`height:${height}px`}>${Array.from({ length: maxH - minH + 1 }, (_, i) => html`<span key=${i} style=${`top:${i * PX}px`}>${minH + i}:00</span>`)}</div>
    ${order.map((d) => html`<div key=${'c' + d} class="wcol" style=${`height:${height}px`}>
      ${Array.from({ length: maxH - minH }, (_, i) => html`<div key=${i} class="hl" style=${`top:${i * PX}px`}></div>`)}
      ${items.filter((a) => (a.days || []).map(Number).includes(d)).map((a) => {
        const top = ((toMinutes(a.start) - minH * 60) / 60) * PX;
        const h = Math.max(22, ((toMinutes(a.end) - toMinutes(a.start)) / 60) * PX - 2);
        const c = typeColor(a.type);
        return html`<div key=${a.id} class="ev" style=${`top:${top}px;height:${h}px;background:${c}14;border-color:${c};color:${c}`}>${a.title}<div class="t">${a.start}~${a.end}</div></div>`;
      })}
      ${d === todayDow && now >= minH * 60 && now <= maxH * 60 && html`<div class="now-line" style=${`top:${((now - minH * 60) / 60) * PX}px`}></div>`}
    </div>`)}
  </div></div>`;
}

function ScheduleTab({ kid }) {
  const [dow, setDow] = useState(new Date().getDay());
  return html`<div class="grid g-main fade-in">
    <section class="card span-2"><div class="card-h"><${Emo} name="Calendar" size=${30} /><div class="grow"><h2>주간 시간표</h2><div class="muted small">빨간 선은 지금 시간이에요</div></div></div><${WeekGrid} kid=${kid} /></section>
    <section class="card">
      <div class="card-h"><h2 class="grow">요일별 보기</h2></div>
      <div class="seg" style="margin-bottom:12px">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button key=${d} class=${d === dow ? 'on' : ''} onClick=${() => setDow(d)}>${DAY_NAMES[d]}</button>`)}</div>
      <${DayTimeline} kid=${kid} dow=${dow} />
    </section>
    <section class="card">
      <div class="card-h"><${Emo} name="Clipboard" size=${30} /><h2 class="grow">준비물 체크</h2></div>
      <div class="stack" style="gap:8px">${Object.values(kid.academies || {}).filter((a) => a && a.note && (a.days || []).map(Number).includes(dow)).map((a) => html`<div key=${a.id} class="tip"><b>${a.title}</b><span>${a.note}</span></div>`)}
      <div class="muted small">준비물 메모는 부모 관리 → 시간표에서 적을 수 있어요.</div></div>
    </section>
  </div>`;
}
