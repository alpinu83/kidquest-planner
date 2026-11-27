import { html, useState, useEffect, useRef, Icon, Emo, Ring, Bar, Modal, toast, celebrate, TalentPill, SyncBadge, Empty, Seg, usePhone } from './core.js';
import { PetStage, EvolutionOverlay, EvolutionLine, MoodBadge, petDisplayName } from './pet.js';
import { TaskList, DateNav, CreativeCards, MissionModal } from './missions.js';
import { VerseCard, VerseModal } from './bible.js';
import { VocabTab } from './vocab.js';
import { TalkView, Avatar } from './talk.js';
import { PetWorld, worldUsage } from './world.js';
import * as M from '../model.js';
import { unreadCount } from '../members.js';
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
  { id: 'schedule', label: '시간표', icon: 'calendar-days' },
  { id: 'talk', label: '가족톡', icon: 'message-circle' }
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
  const title = { home: `${kid.profile.name}의 하루`, missions: '오늘의 미션', vocab: '영단어 아레나', pet: '내 펫 키우기', world: '펫 월드', schedule: '학원 시간표', talk: '가족톡' }[tab] || '';
  const pending = M.tasksFor(kid, todayKey(0)).filter((t) => !t.done).length;
  const unread = unreadCount(kidId);
  const badgeFor = (id) => (id === 'missions' && pending > 0 ? { n: pending, cls: 'accent' } : id === 'talk' && unread > 0 ? { n: unread, cls: 'bad' } : null);

  return html`<div class="shell" style=${kidTheme(kid)}>
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><${Icon} name="sparkles" size=${18} /></div>KidQuest</div>
      <button class="nav-item" style="margin-bottom:8px;background:var(--surface-2)" onClick=${onExit}>
        <${Avatar} id=${kidId} size=${32} />
        <div style="text-align:left;line-height:1.2"><div class="bold" style="color:var(--text)">${kid.profile.name}</div><div class="tiny muted">${kid.profile.grade}학년 · 프로필 전환</div></div>
      </button>
      ${TABS.map((t) => {
        const b = badgeFor(t.id);
        return html`<button key=${t.id} class=${'nav-item ' + (tab === t.id || (t.id === 'pet' && tab === 'world') ? 'on' : '')} onClick=${() => setTab(t.id)}>
          <${Icon} name=${t.icon} />${t.label}
          ${b && html`<span class=${'badge ' + b.cls}>${b.n}</span>`}
          ${t.id === 'pet' && pet && M.petMood(pet) === 'hungry' && html`<span class="badge warn">배고파요</span>`}
        </button>`;
      })}
      <div class="sidebar-foot">
        <button class="nav-item" onClick=${onParent}><${Icon} name="shield-check" />부모 관리</button>
        <div class="corner-mini"><${SyncBadge} /></div>
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="only-phone avatar-btn" onClick=${onExit} aria-label="프로필 전환"><${Avatar} id=${kidId} size=${36} /></button>
        <div class="grow" style="min-width:0">
          <h1>${title}</h1>
          <div class="sub">${new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
        </div>
        ${streak > 0 && html`<span class="pill-streak num" title="연속 달성"><${Emo} name="Fire" size=${26} />${streak}일</span>`}
        <${TalentPill} value=${bal} />
      </header>
      <div class=${'page' + (tab === 'talk' ? ' no-pad' : '')}>
        ${tab === 'home' && html`<${Home} kid=${kid} pet=${pet} setTab=${setTab} />`}
        ${tab === 'missions' && html`<${MissionsTab} kid=${kid} />`}
        ${tab === 'vocab' && html`<${VocabTab} kid=${kid} />`}
        ${tab === 'pet' && html`<${PetRoom} kid=${kid} openWorld=${() => setTab('world')} />`}
        ${tab === 'world' && html`<${PetWorld} kid=${kid} onBack=${() => setTab('pet')} />`}
        ${tab === 'schedule' && html`<${ScheduleTab} kid=${kid} />`}
        ${tab === 'talk' && html`<${TalkView} me=${kidId} />`}
      </div>
    </main>
    <nav class="tabbar">
      ${TABS.map((t) => {
        const b = badgeFor(t.id);
        return html`<button key=${t.id} class=${'tab ' + (tab === t.id || (t.id === 'pet' && tab === 'world') ? 'on' : '')} onClick=${() => setTab(t.id)}><${Icon} name=${t.icon} size=${22} />${t.label}${b && t.id === 'talk' && html`<span class="tab-badge">${b.n}</span>`}</button>`;
      })}
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
  const phone = usePhone();
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
  const [panel, setPanel] = useState('tasks');
  const earned = M.talentsEarnedOn(kid, today);
  const studySec = M.studySecondsOn(kid, today);
  const academies = Object.values(kid.academies || {}).filter((a) => a && (a.days || []).map(Number).includes(dowOf(today)));

  const hero = html`<section class="hero hero-compact">
    <div class="hero-text">
      <div class="eyebrow" style="color:rgba(255,255,255,.8)">${greeting()}</div>
      <h2>오늘 미션 ${complete}/${total} 완료</h2>
      <div class="hero-bar"><i style=${`width:${pct}%`}></i></div>
      <div class="row wrap" style="gap:8px;margin-top:10px">
        <span class="glass sm">오늘 +${earned} 달란트</span>
        ${studySec >= 60 && html`<span class="glass sm">⏱ 공부 ${M.fmtDur(studySec)}</span>`}
        <button class="glass sm" onClick=${() => setTab('pet')}>${pet ? petDisplayName(pet) : '펫'} · ${mood === 'hungry' ? '배고파요!' : pet && pet.stage === 5 ? '전설' : pet ? STAGES[pet.stage].name : ''}</button>
      </div>
    </div>
    <div class="hero-pet">${pet && html`<${PetStage} pet=${pet} mood=${mood} interactive=${true} showBubble=${!phone} />`}</div>
  </section>`;

  const tasksCard = html`<section class="card fill">
    <div class="card-h"><${Ring} pct=${tasks.length ? (done / tasks.length) * 100 : 0} size=${42} stroke=${6}><span class="tiny bold">${done}/${tasks.length}</span><//>
      <div class="grow"><h2>오늘의 숙제</h2></div>
      <button class="btn sm" onClick=${() => setTab('missions')}>전체</button></div>
    <div class="card-body"><${TaskList} kid=${kid} date=${today} compact=${true} /></div>
  </section>`;
  const creativeCard = html`<section class="card fill">
    <div class="card-h"><${Emo} name="Light bulb" size=${28} /><div class="grow"><h2>창의 미션</h2><div class="muted small">하나당 +3 · ${crDone}/${picks.length}</div></div></div>
    <div class="card-body"><${CreativeCards} kid=${kid} date=${today} small=${true} onOpen=${setMission} /></div>
  </section>`;
  const vocabCard = html`<section class="card tight">
    ${vs.todayDone ? html`<div class="row"><${Emo} name="Hundred points" size=${30} /><div class="grow small"><b>오늘의 단어 완료!</b><div class="muted tiny">게임으로 더 연습해요</div></div><button class="btn sm" onClick=${() => setTab('vocab')}>게임</button></div>`
      : html`<button class="btn primary block" onClick=${() => setTab('vocab')}><${Icon} name="play" size=${18} />오늘의 단어 (+3)</button>`}
  </section>`;
  const scheduleCard = html`<section class="card fill">
    <div class="card-h"><${Emo} name="Spiral calendar" size=${28} /><div class="grow"><h2>오늘 일정</h2></div><button class="btn sm" onClick=${() => setTab('schedule')}>주간</button></div>
    <div class="card-body"><${DayTimeline} kid=${kid} dow=${dowOf(today)} /></div>
  </section>`;

  if (phone) {
    const panels = [
      { id: 'tasks', label: `숙제 ${done}/${tasks.length}` },
      { id: 'creative', label: `창의 ${crDone}/${picks.length}` },
      { id: 'day', label: `일정 ${academies.length}` }
    ];
    return html`<div class="home fit fade-in">
      ${hero}
      <${WeatherCard} compact=${true} />
      <${Seg} items=${panels} value=${panel} onChange=${setPanel} cls="block" />
      <div class="panel">
        ${panel === 'tasks' && html`<div class="stack" style="gap:10px;height:100%">${tasksCard}${vocabCard}</div>`}
        ${panel === 'creative' && creativeCard}
        ${panel === 'day' && scheduleCard}
      </div>
      ${mission && html`<${MissionModal} kid=${kid} date=${today} mission=${mission} onClose=${() => setMission(null)} />`}
    </div>`;
  }

  return html`<div class="home fit fade-in">
    ${hero}
    <div class="home-grid">
      ${tasksCard}
      <div class="col">${creativeCard}${vocabCard}</div>
      <div class="col"><${WeatherCard} />${scheduleCard}</div>
    </div>
    ${mission && html`<${MissionModal} kid=${kid} date=${today} mission=${mission} onClose=${() => setMission(null)} />`}
  </div>`;
}

const WEATHER_EMOJI = { sun: 'Sun', partly: 'Sun behind cloud', cloud: 'Sun behind cloud', rain: 'Umbrella with rain drops', snow: 'Snowman', storm: 'High voltage' };
function WeatherCard({ compact = false }) {
  const [w, setW] = useState(null);
  const city = M.settings().cityId || 'seoul';
  useEffect(() => { fetchWeatherForecast(city).then(setW).catch(() => {}); }, [city]);
  if (!w) return html`<section class="card tight"><div class="muted small">날씨 불러오는 중…</div></section>`;
  const d = w.tomorrow;
  const desc = describeWeatherCode(d.weatherCode);
  const tips = buildWeatherAdvice(d);
  if (compact) {
    return html`<section class="weather-strip">
      <img src=${E(WEATHER_EMOJI[desc.icon] || 'Sun')} alt="" />
      <div class="grow" style="min-width:0"><b>내일 ${desc.label} ${Math.round(d.minTemp)}°/${Math.round(d.maxTemp)}°</b> <span class="muted tiny">비 ${d.precipProb}%</span></div>
      ${tips.slice(0, 2).map((t, i) => html`<span key=${i} class=${'badge ' + (t.level === 'alert' ? 'bad' : t.level === 'ok' ? 'good' : 'warn')}>${t.badge}</span>`)}
    </section>`;
  }
  return html`<section class="card tight">
    <div class="weather">
      <img src=${E(WEATHER_EMOJI[desc.icon] || 'Sun')} alt="" />
      <div class="grow"><div class="eyebrow">내일 ${w.cityName}</div><div class="bold" style="font-size:18px">${desc.label} ${Math.round(d.minTemp)}° / ${Math.round(d.maxTemp)}°</div><div class="small muted">강수확률 ${d.precipProb}%</div></div>
    </div>
    <div class="stack" style="gap:6px;margin-top:10px">${tips.slice(0, 2).map((t, i) => html`<div key=${i} class="tip small"><span class=${'badge ' + (t.level === 'alert' ? 'bad' : t.level === 'ok' ? 'good' : 'warn')}>${t.badge}</span><span>${t.text}</span></div>`)}</div>
  </section>`;
}

function MissionsTab({ kid }) {
  const phone = usePhone();
  const [date, setDate] = useState(todayKey(0));
  const [mission, setMission] = useState(null);
  const [panel, setPanel] = useState('tasks');
  const [verseOpen, setVerseOpen] = useState(false);
  const picks = M.creativePicks(kid, date);
  const day = (kid.creative || {})[date] || {};
  const allDone = picks.every((m) => M.creativeDone(kid, date, m.id));
  const isToday = date === todayKey(0);
  const tasks = M.tasksFor(kid, date);
  const tasksCard = html`<section class="card fill">
    <div class="card-h"><${Emo} name="Books" size=${28} /><div class="grow"><h2>숙제 · 할 일</h2><div class="muted small">완료 체크하면 달란트 획득</div></div></div>
    <div class="card-body"><${TaskList} kid=${kid} date=${date} /></div>
  </section>`;
  const creativeCard = html`<section class="card fill">
    <div class="card-h"><${Emo} name="Rocket" size=${28} /><div class="grow"><h2>창의 미션</h2><div class="small muted">매일 새로운 도전 3개</div></div>
      ${isToday && !allDone && (day.rerolls || 0) < 1 && html`<button class="btn sm" onClick=${() => { M.rerollCreative(kid.id, date); toast('새로운 미션이 도착했어요!', 'Wrapped gift'); }}><${Icon} name="shuffle" size=${16} />바꾸기</button>`}</div>
    <div class="card-body"><${CreativeCards} kid=${kid} date=${date} small=${true} onOpen=${setMission} /></div>
  </section>`;
  const verseCard = html`<${VerseCard} kid=${kid} date=${date} onOpen=${() => setVerseOpen(true)} />`;
  return html`<div class="fit fade-in" style="display:flex;flex-direction:column;gap:12px">
    <div class="row between wrap"><${DateNav} date=${date} setDate=${setDate} />
      ${phone && html`<${Seg} items=${[{ id: 'tasks', label: `숙제 ${tasks.filter((t) => t.done).length}/${tasks.length}` }, { id: 'creative', label: '창의' }, { id: 'verse', label: M.verseDone(kid, date) ? '말씀 ✓' : '말씀' }]} value=${panel} onChange=${setPanel} />`}</div>
    ${phone ? html`<div class="panel">${panel === 'tasks' ? tasksCard : panel === 'creative' ? creativeCard : verseCard}</div>`
      : html`<div class="grid g-2 fill-row">${tasksCard}<div class="mis-right">${creativeCard}${verseCard}</div></div>`}
    ${verseOpen && html`<${VerseModal} kid=${kid} date=${date} onClose=${() => setVerseOpen(false)} />`}
    ${mission && html`<${MissionModal} kid=${kid} date=${date} mission=${mission} onClose=${() => setMission(null)} />`}
  </div>`;
}

// ---------- 펫 방 ----------
function PetRoom({ kid, openWorld }) {
  const pet = M.activePet(kid);
  const pets = M.petsOf(kid);
  const bal = M.talentBalance(kid);
  const [fx, setFx] = useState(null);
  const [evo, setEvo] = useState(null);
  const [adopt, setAdopt] = useState(false);
  const [rename, setRename] = useState(false);
  const stageRef = useRef(null);
  const phone = usePhone();
  const [panel, setPanel] = useState('pet');
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

  const petCard = html`<section class="card fill pet-card">
      <div class="row between">
        <div style="min-width:0">
          <div class="eyebrow" style=${`color:${pet.species.color}`}>${pet.species.name} · ${legendary ? pet.species.legend : STAGES[pet.stage].name}</div>
          <div class="row"><h2 style="font-size:22px;font-weight:900;letter-spacing:-.03em">${petDisplayName(pet)}</h2>
            <button class="icon-btn sm" title="이름 짓기" onClick=${() => setRename(true)}><${Icon} name="pencil" size=${15} /></button></div>
        </div>
        <div class="row" style="gap:6px"><${MoodBadge} mood=${mood} /><button class="btn sm world-btn" onClick=${openWorld}><${Icon} name="globe" size=${16} />펫 월드${(() => { const wu = worldUsage(kid); return wu.left > 0 ? ` · ${Math.ceil(wu.left / 60)}분` : ' · 오늘 끝'; })()}</button></div>
      </div>
      <div class="pet-stage-wrap" ref=${stageRef}>
        <${PetStage} pet=${pet} mood=${mood} interactive=${true} fx=${fx} />
      </div>
      ${legendary ? html`<div class="tip" style="background:var(--gold-soft)"><${Emo} name="Crown" size=${26} /><div class="grow"><b>전설 달성!</b> ${pet.species.legend}(으)로 완전히 성장했어요.</div><button class="btn gold sm" onClick=${() => setAdopt(true)}>새 알</button></div>`
        : html`<div class="stack" style="gap:6px">
          <div class="row between small"><b>${STAGES[pet.stage].name} → ${prog.next ? (prog.next.stage === 5 ? '전설' : prog.next.name) : ''}</b><span class="muted num">${pet.xp}/${prog.next?.min} XP</span></div>
          <${Bar} pct=${prog.pct} kind="gold" />
        </div>`}
      <div style="margin-top:10px"><${EvolutionLine} species=${pet.species} stage=${pet.stage} /></div>
    </section>`;
  const shopCard = html`<section class="card fill">
        <div class="card-h"><${Emo} name="Shortcake" size=${28} /><div class="grow"><h2>먹이 상점</h2><div class="muted small">달란트로 먹이를 주면 펫이 자라요</div></div></div>
        <div class="card-body"><div class="food-grid">
          ${FOODS.map((f) => html`<button key=${f.id} class=${'food ' + (bal < f.cost ? 'locked' : '')} onClick=${(e) => feed(f, e)}>
            ${pet.species.fav === f.id && html`<span class="fav badge bad" title="최애 간식">♥</span>`}
            <img src=${E(f.e)} alt="" />
            <span class="fname">${f.name}</span>
            <span class="fxp">+${pet.species.fav === f.id ? Math.round(f.xp * 1.5) : f.xp} XP</span>
            <span class="fcost"><img src=${E('Coin')} alt="" />${f.cost}</span>
          </button>`)}
        </div></div>
      </section>`;
  const dexCard = html`<section class="card fill">
        <div class="card-h"><${Emo} name="Trophy" size=${28} /><div class="grow"><h2>펫 도감</h2><div class="muted small">전설 ${pets.filter((p) => p.xp >= MAX_PET_XP).length}/${SPECIES.length}</div></div>
          <button class="btn sm world-btn" onClick=${openWorld}><${Icon} name="globe" size=${16} />펫 월드${(() => { const wu = worldUsage(kid); return wu.left > 0 ? ` · ${Math.ceil(wu.left / 60)}분` : ' · 오늘 끝'; })()}</button>
          <button class="btn sm" onClick=${() => setAdopt(true)}><${Icon} name="egg" size=${16} />입양</button></div>
        <div class="card-body"><div class="dex">
          ${SPECIES.map((sp) => {
            const mine = pets.filter((p) => p.species.id === sp.id);
            const best = mine.sort((a, b) => b.xp - a.xp)[0];
            const isLegend = best && best.xp >= MAX_PET_XP;
            const form = best ? sp.forms[best.stage] : sp.forms[4];
            return html`<button key=${sp.id} class=${`dex-item ${isLegend ? 'legend' : ''} ${best ? '' : 'unknown'}`} onClick=${() => best && best.id !== pet.id && !isLegend && (M.setActivePet(kid.id, best.id), toast(`${petDisplayName(best)}와(과) 함께해요!`, 'Sparkles'))}>
              <img src=${E(form)} alt="" width="52" height="52" />
              <div class="dex-name">${best ? (isLegend ? sp.legend : sp.name) : '???'}</div>
              <div class="tiny muted">${best ? (isLegend ? '전설 달성' : STAGES[best.stage].name + (best.id === pet.id ? ' · 함께' : '')) : '미발견'}</div>
            </button>`;
          })}
        </div></div>
      </section>`;
  const overlays = html`
    ${evo && html`<${EvolutionOverlay} pet=${M.activePet(M.getKid(kid.id)) || pet} from=${evo.from} to=${evo.to} onDone=${() => setEvo(null)} />`}
    ${adopt && html`<${AdoptModal} kid=${kid} onClose=${() => setAdopt(false)} />`}
    ${rename && html`<${RenameModal} kid=${kid} pet=${pet} onClose=${() => setRename(false)} />`}`;

  if (phone) {
    return html`<div class="fit fade-in" style="display:flex;flex-direction:column;gap:10px">
      <${Seg} cls="block" items=${[{ id: 'pet', label: '내 펫' }, { id: 'shop', label: '먹이 상점' }, { id: 'dex', label: '도감' }]} value=${panel} onChange=${setPanel} />
      <div class="panel">${panel === 'pet' ? petCard : panel === 'shop' ? shopCard : dexCard}</div>
      ${overlays}
    </div>`;
  }
  return html`<div class="grid g-main fit fill-row fade-in">
    ${petCard}
    <div class="col">${shopCard}${dexCard}</div>
    ${overlays}
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

// 주간 시간표: 화면 높이에 맞춰 시간 칸 높이를 자동 조절 (스크롤 최소화)
export function WeekGrid({ kid, fitHeight = 0 }) {
  const items = Object.values(kid.academies || {}).filter(Boolean);
  const boxRef = useRef(null);
  const [h, setH] = useState(fitHeight);
  useEffect(() => {
    if (fitHeight) return;
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setH(el.clientHeight);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  if (!items.length) return html`<${Empty} emoji="Spiral calendar" title="등록된 시간표가 없어요" sub="부모 관리에서 추가할 수 있어요" />`;
  const minH = Math.max(7, Math.floor(Math.min(...items.map((a) => toMinutes(a.start))) / 60));
  const maxH = Math.min(24, Math.ceil(Math.max(...items.map((a) => toMinutes(a.end))) / 60));
  const hours = Math.max(1, maxH - minH);
  const PX = h ? Math.max(26, Math.min(60, Math.floor((h - 56) / hours))) : 44;
  const height = hours * PX;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const todayDow = new Date().getDay();
  const now = nowMinutes();
  return html`<div class="week-box" ref=${boxRef}><div class="week">
    <div class="wh"></div>
    ${order.map((d) => html`<div key=${'h' + d} class=${'wh ' + (d === todayDow ? 'today' : '')}>${DAY_NAMES[d]}</div>`)}
    <div class="wtime" style=${`height:${height}px`}>${Array.from({ length: hours + 1 }, (_, i) => html`<span key=${i} style=${`top:${i * PX}px`}>${minH + i}:00</span>`)}</div>
    ${order.map((d) => html`<div key=${'c' + d} class="wcol" style=${`height:${height}px`}>
      ${Array.from({ length: hours }, (_, i) => html`<div key=${i} class="hl" style=${`top:${i * PX}px`}></div>`)}
      ${items.filter((a) => (a.days || []).map(Number).includes(d)).map((a) => {
        const top = ((toMinutes(a.start) - minH * 60) / 60) * PX;
        const hh = Math.max(20, ((toMinutes(a.end) - toMinutes(a.start)) / 60) * PX - 2);
        const c = typeColor(a.type);
        return html`<div key=${a.id} class="ev" style=${`top:${top}px;height:${hh}px;background:${c}14;border-color:${c};color:${c}`}>${a.title}${hh > 34 && html`<div class="t">${a.start}~${a.end}</div>`}</div>`;
      })}
      ${d === todayDow && now >= minH * 60 && now <= maxH * 60 && html`<div class="now-line" style=${`top:${((now - minH * 60) / 60) * PX}px`}></div>`}
    </div>`)}
  </div></div>`;
}

function ScheduleTab({ kid }) {
  const phone = usePhone();
  const [dow, setDow] = useState(new Date().getDay());
  const notes = Object.values(kid.academies || {}).filter((a) => a && a.note && (a.days || []).map(Number).includes(dow));
  const dayCard = html`<section class="card fill">
    <div class="card-h"><h2 class="grow">요일별 보기</h2></div>
    <div class="seg block" style="margin-bottom:12px">${[1, 2, 3, 4, 5, 6, 0].map((d) => html`<button key=${d} class=${d === dow ? 'on' : ''} onClick=${() => setDow(d)}>${DAY_NAMES[d]}</button>`)}</div>
    <div class="card-body">
      <${DayTimeline} kid=${kid} dow=${dow} />
      ${notes.length > 0 && html`<div class="stack" style="gap:6px;margin-top:12px"><div class="eyebrow">준비물</div>${notes.map((a) => html`<div key=${a.id} class="tip small"><b>${a.title}</b><span>${a.note}</span></div>`)}</div>`}
    </div>
  </section>`;
  if (phone) return html`<div class="fit fade-in">${dayCard}</div>`;
  return html`<div class="grid fit fill-row fade-in" style="grid-template-columns:minmax(0,2.2fr) minmax(0,1fr)">
    <section class="card fill"><div class="card-h"><${Emo} name="Calendar" size=${28} /><div class="grow"><h2>주간 시간표</h2><div class="muted small">빨간 선은 지금 시간</div></div></div><div class="card-body" style="overflow:hidden"><${WeekGrid} kid=${kid} /></div></section>
    ${dayCard}
  </div>`;
}
