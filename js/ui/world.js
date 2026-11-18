// Pet World — 키운 전설 펫들이 한 화면에서 살아 움직이는 마을
// 탭: 반응(점프·회전·하트·대사) · 연속 3번 탭: 전설 스킬 · 끌어서 옮기기 · 빈 곳 탭: 모두 달려옴
// 공 던지기 · 모두 모여 · 해/달을 누르면 낮↔밤
import { html, useState, useEffect, useRef, Icon, celebrate } from './core.js';
import * as M from '../model.js';
import { MAX_PET_XP, STAGES } from '../../data/pets.js';
import { E, sfx, vibrate, shortDate, dateKey } from '../util.js';

// 종류별 움직임: fly(하늘) · swim(연못) · hop(깡총) · root(제자리) · walk(땅)
const MOVE = {
  eagle: 'fly', phoenix: 'fly', butterfly: 'fly', owl: 'fly', dragon: 'fly', unicorn: 'fly',
  whale: 'swim', kraken: 'swim', tree: 'root', rabbit: 'hop', lion: 'walk', wolf: 'walk', polar: 'walk'
};
const REGION = {
  ground: { x0: 8, x1: 92, y0: 62, y1: 93 },
  sky: { x0: 10, x1: 90, y0: 40, y1: 54 },
  pond: { x0: 9, x1: 31, y0: 82, y1: 93 }
};
const SPEED = { walk: 7, hop: 9, fly: 11, swim: 5, root: 0 };
const REACTIONS = ['jump', 'spin', 'wiggle', 'love'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function moveOf(pet) {
  if (pet.stage === 0) return 'root'; // 알은 제자리에서 흔들흔들
  const m = MOVE[pet.species.id] || 'walk';
  if (m === 'fly' && pet.stage < 3) return 'walk'; // 어릴 땐 아직 못 날아요
  return m;
}
function regionOf(mode) {
  return mode === 'fly' ? REGION.sky : mode === 'swim' ? REGION.pond : REGION.ground;
}
function clampTo(r, x, y) {
  return { x: Math.min(r.x1, Math.max(r.x0, x)), y: Math.min(r.y1, Math.max(r.y0, y)) };
}
function isNightNow() {
  const h = new Date().getHours();
  return h >= 19 || h < 6;
}
function legendForm(pet) {
  return pet.species.forms[Math.min(pet.stage, pet.species.forms.length - 1)];
}
function specialEmoji(pet) {
  const p5 = (pet.species.props || {})[5] || [];
  return (p5.find((x) => x.e !== 'Sun' && x.e !== 'Rainbow') || p5[0] || { e: 'Sparkles' }).e;
}

export function PetWorld({ kid, onBack }) {
  const pets = M.petsOf(kid);
  const legends = pets.filter((p) => p.xp >= MAX_PET_XP);
  const cur = M.activePet(kid);
  const residents = [...legends, ...(cur && cur.xp < MAX_PET_XP ? [cur] : [])];
  const key = residents.map((p) => p.id + ':' + p.stage).join('|');

  const sceneRef = useRef(null);
  const ballRef = useRef(null);
  const sim = useRef({ pets: [], ball: null, w: 800, h: 600 });
  const [night, setNight] = useState(isNightNow());
  const nightRef = useRef(night);
  nightRef.current = night;
  const [selId, setSelId] = useState(residents[0]?.id || null);
  const [hint, setHint] = useState(true);
  const sel = residents.find((p) => p.id === selId) || residents[0];
  const selRef = useRef(sel && sel.id);
  selRef.current = sel && sel.id;
  useEffect(() => { sim.current.pets.forEach((p) => p.el && p.el.classList.toggle('sel', p.id === selRef.current)); }, [sel && sel.id]);
  const hasUnicorn = legends.some((p) => p.species.id === 'unicorn');

  // ---------- 시뮬레이션 ----------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const S = sim.current;
    S.pets = residents.map((pet, i) => {
      const mode = moveOf(pet);
      const r = regionOf(mode);
      const x = r.x0 + ((i + 0.5) / residents.length) * (r.x1 - r.x0);
      const y = rand(r.y0, r.y1);
      return {
        id: pet.id, pet, mode, legend: pet.xp >= MAX_PET_XP, x, y, tx: x, ty: y, dir: Math.random() < 0.5 ? -1 : 1,
        state: 'idle', wait: rand(0.3, 1.5), phase: Math.random() * 6, react: 0, held: false, taps: [], speedMul: 1,
        el: scene.querySelector(`[data-pid="${pet.id}"]`)
      };
    }).map((p) => ({ ...p, body: p.el && p.el.querySelector('.w-body'), wrap: p.el && p.el.querySelector('.w-react') }));
    S.pets.forEach((p) => p.el && p.el.classList.toggle('sel', p.id === selRef.current));
    const measure = () => { S.w = scene.clientWidth; S.h = scene.clientHeight; };
    measure();
    let ro = null;
    try { ro = new ResizeObserver(measure); ro.observe(scene); } catch (_) { window.addEventListener('resize', measure); }

    let last = performance.now();
    let raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt, now / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); else window.removeEventListener('resize', measure); };
  }, [key]);

  function step(dt, t) {
    const S = sim.current;
    const base = Math.min(S.w, S.h * 1.35);
    // 공 놀이
    if (S.ball && S.ball.active && !S.ball.flying) {
      for (const p of S.pets) {
        if (p.mode === 'root' || p.held) continue;
        const r = regionOf(p.mode);
        const tgt = clampTo(r, S.ball.x + (p.mode === 'fly' ? 0 : rand(-1, 1)), p.mode === 'fly' ? r.y1 : S.ball.y);
        p.tx = tgt.x; p.ty = tgt.y; p.state = 'walk'; p.speedMul = 1.6;
        if (p.mode !== 'fly' && p.mode !== 'swim' && Math.hypot(p.x - S.ball.x, (p.y - S.ball.y) * 1.3) < 4) kickBall(p);
      }
    }
    for (const p of S.pets) {
      if (!p.el) continue;
      if (!p.held && p.react <= 0 && p.mode !== 'root') {
        if (p.state === 'idle') {
          p.wait -= dt;
          if (p.wait <= 0) {
            const r = regionOf(p.mode);
            const tgt = clampTo(r, p.x + rand(-28, 28), p.y + rand(-10, 10));
            p.tx = tgt.x; p.ty = tgt.y; p.state = 'walk'; p.speedMul = 1;
          }
        } else if (p.state === 'walk') {
          const dx = p.tx - p.x, dy = p.ty - p.y;
          const d = Math.hypot(dx, dy);
          const sp = SPEED[p.mode] * p.speedMul * (nightRef.current ? 0.6 : 1) * dt;
          if (d <= sp || d < 0.2) {
            p.x = p.tx; p.y = p.ty; p.state = 'idle'; p.speedMul = 1;
            p.wait = nightRef.current ? rand(2.5, 6) : rand(1, 3.5);
          } else {
            p.x += (dx / d) * sp; p.y += (dy / d) * sp;
            if (Math.abs(dx) > 0.3) p.dir = dx < 0 ? -1 : 1;
          }
        }
      }
      if (p.react > 0) p.react -= dt;
      // 화면 그리기
      const depth = p.mode === 'fly' ? 0.92 : 0.72 + ((p.y - 58) / 36) * 0.42;
      const size = base * (p.legend ? 0.19 : 0.14) * depth;
      let bob = 0, rot = 0;
      const moving = p.state === 'walk' && !p.held;
      if (p.held) bob = Math.sin(t * 18) * 2;
      else if (p.mode === 'fly') { bob = Math.sin(t * 2.2 + p.phase) * 9; rot = Math.sin(t * 1.4 + p.phase) * 4; }
      else if (p.mode === 'hop') bob = moving ? -Math.abs(Math.sin(t * 7 + p.phase)) * 16 : Math.sin(t * 2 + p.phase) * 1.5;
      else if (p.mode === 'swim') { bob = Math.sin(t * 2.6 + p.phase) * 3; rot = Math.sin(t * 2 + p.phase) * 6; }
      else if (p.mode === 'root') rot = Math.sin(t * 1.3 + p.phase) * (p.pet.stage === 0 ? 7 : 2.5);
      else bob = moving ? -Math.abs(Math.sin(t * 9 + p.phase)) * 4 : Math.sin(t * 2 + p.phase) * 1.2;
      const el = p.el;
      el.style.left = p.x + '%';
      el.style.top = p.y + '%';
      el.style.width = size + 'px';
      el.style.zIndex = String(p.held ? 999 : Math.round(p.y * 10));
      const body = p.body;
      if (body) body.style.transform = `translateY(${bob}px) rotate(${rot}deg) scaleX(${p.dir})`;
      if (el.__sleep !== undefined) {
        const sleeping = nightRef.current && p.state === 'idle' && !p.held && p.react <= 0 && p.wait > 1.2;
        if (sleeping !== el.__sleep) { el.__sleep = sleeping; el.classList.toggle('sleeping', sleeping); }
      } else el.__sleep = false;
    }
    // 공 위치
    const ball = ballRef.current;
    if (ball && S.ball) {
      ball.style.left = S.ball.x + '%';
      ball.style.top = S.ball.y + '%';
      ball.style.width = base * 0.07 + 'px';
    }
  }

  // ---------- 상호작용 ----------
  function find(id) { return sim.current.pets.find((p) => p.id === id); }

  function say(p, text, ms = 2200) {
    const b = p.el && p.el.querySelector('.w-bubble');
    if (!b) return;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(b.__t);
    b.__t = setTimeout(() => b.classList.remove('show'), ms);
  }
  function burst(p, emoji, n = 5, spread = 70) {
    const scene = sceneRef.current;
    if (!scene || !p.el) return;
    const size = parseFloat(p.el.style.width) || 80;
    for (let i = 0; i < n; i++) {
      const img = document.createElement('img');
      img.src = E(emoji);
      img.className = 'w-fx';
      img.style.left = p.x + '%';
      img.style.top = `calc(${p.y}% - ${size * 0.7}px)`;
      img.style.setProperty('--dx', `${rand(-spread, spread)}px`);
      img.style.setProperty('--dy', `${rand(-90, -150)}px`);
      img.style.animationDelay = `${i * 60}ms`;
      img.style.width = img.style.height = `${Math.max(22, size * 0.32)}px`;
      scene.appendChild(img);
      setTimeout(() => img.remove(), 1500 + i * 60);
    }
  }
  function react(p, kind) {
    const w = p.wrap;
    if (!w) return;
    w.classList.remove('r-jump', 'r-spin', 'r-wiggle', 'r-love', 'r-power');
    void w.offsetWidth;
    w.classList.add('r-' + kind);
    p.react = kind === 'power' ? 1.4 : 0.9;
    p.state = 'idle';
    p.wait = 1.2;
  }

  function lines(p) {
    const name = kid.profile.name;
    const base = p.pet.species.lines || [];
    const extra = p.legend
      ? [`${name}, 고마워! 덕분에 전설이 됐어!`, '전설의 힘을 보여줄까?', '여기 펫 월드 너무 좋아!', `${name} 최고! ❤`]
      : ['나도 전설이 될 거야!', '맛있는 거 주면 빨리 클게!', '형님들 멋지다~'];
    const nightLines = ['음냐… 깼잖아~', '별이 예쁘다…', '쿨쿨… 아, 안녕!'];
    return [...base, ...extra, ...(night ? nightLines : [])];
  }

  function tapPet(p) {
    setSelId(p.id);
    setHint(false);
    const now = Date.now();
    p.taps = [...p.taps.filter((x) => now - x < 1400), now];
    vibrate(12);
    if (p.taps.length >= 3) {
      p.taps = [];
      react(p, 'power');
      sfx('levelup');
      burst(p, specialEmoji(p), 8, 110);
      burst(p, 'Sparkles', 4, 90);
      say(p, p.legend ? `${p.pet.species.legend}의 힘!` : '나도 언젠간 전설!', 2400);
      if (p.legend) celebrate(0.6);
      return;
    }
    const kind = pick(REACTIONS);
    react(p, kind);
    sfx(kind === 'love' ? 'coin' : 'good');
    burst(p, kind === 'love' ? 'Red heart' : pick(['Sparkles', 'Sparkling heart', 'Glowing star', 'Musical notes']), kind === 'love' ? 6 : 4);
    say(p, pick(lines(p)));
  }

  function callAll(x, y) {
    const S = sim.current;
    sfx('tap');
    for (const p of S.pets) {
      if (p.mode === 'root' || p.held) continue;
      const tgt = clampTo(regionOf(p.mode), x + rand(-6, 6), y + rand(-4, 4));
      p.tx = tgt.x; p.ty = tgt.y; p.state = 'walk'; p.speedMul = 1.8;
      if (Math.random() < 0.6) say(p, pick(['!', '가요~!', '부르셨어요?', '나 여기!']), 1200);
    }
  }

  function gatherAll() {
    const S = sim.current;
    const cx = 50;
    S.pets.forEach((p, i) => {
      if (p.mode === 'root') return;
      const r = regionOf(p.mode);
      const tgt = clampTo(r, cx + (i - (S.pets.length - 1) / 2) * 14, p.mode === 'fly' ? 50 : 80);
      p.tx = tgt.x; p.ty = tgt.y; p.state = 'walk'; p.speedMul = 2;
    });
    sfx('tap');
    setTimeout(() => {
      S.pets.forEach((p, i) => setTimeout(() => { react(p, 'jump'); say(p, pick(['와아!', '모였다!', '짠!', '야호!']), 1600); burst(p, 'Party popper', 2); }, i * 120));
      sfx('levelup');
    }, 1700);
  }

  function throwBall() {
    const S = sim.current;
    if (S.ball && S.ball.active) return;
    S.ball = { x: rand(25, 75), y: rand(66, 88), active: true, bounces: 0, flying: true };
    const el = ballRef.current;
    if (el) { el.classList.add('show'); el.classList.remove('kick'); void el.offsetWidth; el.classList.add('kick'); }
    sfx('tap');
    setTimeout(() => { if (S.ball) S.ball.flying = false; }, 500);
  }
  function kickBall(p) {
    const S = sim.current;
    const b = S.ball;
    if (!b || b.flying) return;
    b.bounces++;
    react(p, 'jump');
    sfx('good');
    say(p, pick(['내가 잡았다!', '슛~!', '받아라!', '골~!']), 1300);
    if (b.bounces >= 4) {
      b.active = false;
      const el = ballRef.current;
      if (el) el.classList.remove('show');
      setTimeout(() => { S.pets.forEach((q) => { react(q, 'jump'); }); burst(p, 'Trophy', 3); sfx('levelup'); }, 300);
      S.ball = null;
      return;
    }
    b.flying = true;
    b.x = Math.min(88, Math.max(12, b.x + rand(-35, 35)));
    b.y = rand(66, 90);
    const el = ballRef.current;
    if (el) { el.classList.remove('kick'); void el.offsetWidth; el.classList.add('kick'); }
    setTimeout(() => { if (S.ball) S.ball.flying = false; }, 550);
  }

  // 포인터: 탭 / 끌기 / 빈 곳 탭
  const drag = useRef(null);
  function toPct(e) {
    const r = sceneRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }
  function onDown(e) {
    const petEl = e.target.closest && e.target.closest('[data-pid]');
    if (e.target.closest && e.target.closest('.w-ui')) return;
    const pos = toPct(e);
    drag.current = { pid: petEl ? petEl.getAttribute('data-pid') : null, sx: e.clientX, sy: e.clientY, moved: false, pos };
    try { sceneRef.current.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    const d = drag.current;
    if (!d || !d.pid) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 10) {
      d.moved = true;
      const p = find(d.pid);
      if (p) { p.held = true; p.state = 'idle'; p.el.classList.add('held'); say(p, pick(['우와 날아간다~', '어디 가요?', '높다!']), 1200); sfx('tap'); }
    }
    if (d.moved) {
      const p = find(d.pid);
      if (!p) return;
      const pos = toPct(e);
      p.x = Math.min(96, Math.max(4, pos.x));
      p.y = Math.min(96, Math.max(12, pos.y + 4));
    }
  }
  function onUp(e) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.pid) {
      const p = find(d.pid);
      if (!p) return;
      if (!d.moved) return tapPet(p);
      p.held = false;
      p.el.classList.remove('held');
      const tgt = clampTo(regionOf(p.mode), p.x, p.y);
      if (p.mode === 'root') { p.x = tgt.x; p.y = tgt.y; react(p, 'wiggle'); return; }
      p.tx = tgt.x; p.ty = tgt.y; p.state = 'walk'; p.speedMul = 4;
      setTimeout(() => react(p, 'jump'), 250);
      return;
    }
    if (!d.moved) { setHint(false); callAll(d.pos.x, d.pos.y); }
  }

  const days = sel ? Math.max(1, Math.round((Date.now() - (sel.adoptedAt || Date.now())) / 86400000)) : 0;

  return html`<div class=${'world fade-in' + (night ? ' night' : '')}>
    <div class="w-scene" ref=${sceneRef} onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
      <div class="w-sky">
        ${night && html`<div class="w-stars"></div>`}
        <i class="w-cloud c1"></i><i class="w-cloud c2"></i><i class="w-cloud c3"></i>
        ${hasUnicorn && !night && html`<img class="w-rainbow" src=${E('Rainbow')} alt="" />`}
      </div>
      <button class="w-ui w-sun" title=${night ? '아침으로' : '밤으로'} onClick=${() => { setNight(!night); sfx('tap'); }}><img src=${E(night ? 'Crescent moon' : 'Sun')} alt="" /></button>
      <div class="w-hills"></div>
      <div class="w-ground"></div>
      <div class="w-pond"><i></i></div>
      <img class="w-deco" src=${E('Deciduous tree')} style="left:7%;top:63%;width:15%" alt="" />
      <img class="w-deco" src=${E('Deciduous tree')} style="left:93%;top:66%;width:12%" alt="" />
      <img class="w-deco" src=${E('Cherry blossom')} style="left:40%;top:96%;width:4%" alt="" />
      <img class="w-deco" src=${E('Cherry blossom')} style="left:70%;top:94%;width:3.5%" alt="" />
      <img class="w-deco" src=${E('Herb')} style="left:57%;top:70%;width:4%" alt="" />
      <img class="w-deco" src=${E('Seedling')} style="left:82%;top:86%;width:3.5%" alt="" />
      <img class="w-deco" src=${E('Herb')} style="left:24%;top:72%;width:3.5%" alt="" />

      ${residents.map((pet) => html`<div key=${pet.id} class=${'w-pet' + (pet.xp >= MAX_PET_XP ? ' legend' : '')} data-pid=${pet.id}>
        <div class="w-react"><div class="w-body">
          <img class="w-img" src=${E(legendForm(pet))} alt="" draggable="false" />
        </div>
        ${pet.xp >= MAX_PET_XP && html`<img class="w-crown" src=${E('Crown')} alt="" />`}
        <span class="w-zzz">Z z</span></div>
        <div class="w-bubble"></div>
        <div class="w-name">${pet.name || (pet.xp >= MAX_PET_XP ? pet.species.legend : pet.species.name)}</div>
      </div>`)}
      <img class="w-ball" ref=${ballRef} src=${E('Soccer ball')} alt="" />

      ${residents.length === 0 && html`<div class="w-empty w-ui">아직 펫이 없어요. 알을 입양해 보세요!</div>`}
      ${legends.length === 0 && residents.length > 0 && html`<div class="w-empty w-ui">아직 전설이 없어요. 펫을 전설까지 키우면 여기에서 함께 살아요!</div>`}
      ${hint && residents.length > 0 && html`<div class="w-hint w-ui">펫을 눌러 보세요 · 3번 빠르게 누르면 전설 스킬 · 끌어서 옮기기 · 빈 곳을 누르면 달려와요</div>`}

      <div class="w-top w-ui">
        <button class="btn sm" onClick=${onBack}><${Icon} name="chevron-left" size=${16} />내 펫</button>
        <div class="w-title"><b>${kid.profile.name}의 펫 월드</b><span>전설 ${legends.length}마리${cur && cur.xp < MAX_PET_XP ? ' · 키우는 중 1' : ''}</span></div>
      </div>

      <div class="w-bottom w-ui">
        ${sel && html`<div class="w-info">
          <span class="avatar" style=${`width:46px;height:46px;background:${sel.species.color}22`}><img src=${E(legendForm(sel))} alt="" /></span>
          <div class="grow" style="min-width:0">
            <b>${sel.name || (sel.xp >= MAX_PET_XP ? sel.species.legend : sel.species.name)}</b>
            <div class="tiny">${sel.xp >= MAX_PET_XP ? `${sel.species.legend} · 전설 달성 ${sel.legendAt ? shortDate(dateKey(new Date(sel.legendAt))) : ''}` : `${sel.species.name} · ${STAGES[sel.stage].name} 단계 · 키우는 중`} · 함께한 지 ${days}일</div>
          </div>
        </div>`}
        <div class="w-actions">
          <button class="btn sm" onClick=${throwBall}><img src=${E('Soccer ball')} width="20" height="20" alt="" />공 던지기</button>
          <button class="btn sm" onClick=${gatherAll}><img src=${E('Party popper')} width="20" height="20" alt="" />모두 모여!</button>
        </div>
      </div>
    </div>
  </div>`;
}
