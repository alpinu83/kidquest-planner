import { html, useState, useEffect, useRef, Emo, celebrate } from './core.js';
import { E, pick, sfx, vibrate } from '../util.js';
import { STAGES, stageProgress, speciesById } from '../../data/pets.js';
import { MOOD } from '../../data/pets.js';

export const petDisplayName = (pet) => (pet?.name ? pet.name : pet?.species?.name || '펫');

function stageFormName(species, stage) {
  return species.forms[Math.min(stage, species.forms.length - 1)];
}

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  l: 10 + ((i * 37) % 80), t: 10 + ((i * 53) % 70), d: (i * 0.27) % 3
}));

// 펫 무대: 단계별 외형 + 장식 + 오라 + 애니메이션
export function PetStage({ pet, stageOverride, mood = 'ok', interactive = false, fx = null, showBubble = true, silhouette = false, cls = '' }) {
  const [tapKey, setTapKey] = useState(0);
  const [hearts, setHearts] = useState([]);
  const [line, setLine] = useState(null);
  const [eating, setEating] = useState(false);
  const [xpFx, setXpFx] = useState(null);
  const bodyRef = useRef(null);

  const species = pet?.species?.id ? pet.species : speciesById(pet?.species);
  const stage = stageOverride ?? pet?.stage ?? 0;
  const xp = pet?.xp ?? 0;
  const prog = stageProgress(xp);
  const isEgg = stage === 0;
  const form = stageFormName(species, stage);
  const scale = STAGES[stage].scale;
  const props = (species.props || {})[stage] || [];
  const ready = isEgg && prog.pct >= 80;

  useEffect(() => {
    if (!fx || !fx.key) return;
    if (fx.type === 'eat') {
      setEating(true);
      sfx('eat');
      burstHearts(5);
      if (fx.xp) setXpFx({ k: fx.key, v: `+${fx.xp} XP` });
      const t = setTimeout(() => setEating(false), 1600);
      return () => clearTimeout(t);
    }
  }, [fx && fx.key]);

  const tapT = useRef(0);
  useEffect(() => () => clearTimeout(tapT.current), []);
  function burstHearts(n = 3) {
    const now = Date.now();
    const list = Array.from({ length: n }, (_, i) => ({ id: now + i, x: 30 + Math.random() * 40, dx: (Math.random() - 0.5) * 80, d: i * 0.12, e: pick(['Red heart', 'Sparkling heart', 'Sparkles']) }));
    setHearts((h) => [...h, ...list]);
    setTimeout(() => setHearts((h) => h.filter((x) => !list.includes(x))), 1600);
  }

  function onTap() {
    if (!interactive) return;
    setTapKey((k) => k + 1);
    vibrate(10);
    sfx('tap');
    burstHearts(3);
    if (showBubble) {
      const lines = isEgg
        ? ['톡톡… 안에서 무언가 움직여요!', '따뜻하게 지켜 주세요', '먹이를 주면 빨리 부화해요!']
        : mood === 'hungry' ? ['배고파요… 간식 주세요!', '꼬르륵~', '미션 하고 달란트 모아 줘!'] : species.lines;
      setLine(pick(lines));
      clearTimeout(tapT.current);
      tapT.current = setTimeout(() => setLine(null), 2600);
    }
  }

  const tintStyle = `background: linear-gradient(160deg, ${species.colors[0]}, ${species.colors[1]}); -webkit-mask-image:url(${E(form)}); mask-image:url(${E(form)});`;
  const crackOpacity = isEgg ? Math.max(0, (prog.pct - 35) / 65) : 0;

  return html`<div class=${`pet-stage s${stage} ${isEgg ? 'egg' : ''} ${ready ? 'ready' : ''} ${mood} ${silhouette ? 'silhouette' : ''} ${cls}`}
      style=${`--pc1:${species.colors[0]};--pc2:${species.colors[1]};--ps:${scale * 100}%`} onClick=${onTap}>
    <div class="aura"></div>
    ${props.filter((p) => p.z === 'back').map((p, i) => html`<div key=${'b' + i} class=${`prop back a-${p.a || 'none'}`} style=${`left:${p.x}%;top:${p.y}%;width:${p.s}%;height:${p.s}%`}><img src=${E(p.e)} alt="" /></div>`)}
    <div class="floor"></div>
    <div class="pet-body" ref=${bodyRef} key=${'t' + tapKey}>
      <div class=${tapKey ? 'tapped' : ''} style="width:100%;height:100%;position:relative">
        <div class=${eating ? 'eating' : ''} style="width:100%;height:100%;position:relative">
          <img class="pet-img" src=${E(form)} alt=${species.name} draggable="false" />
          ${isEgg && html`<div class="egg-tint" style=${tintStyle}></div><div class="egg-spots" style=${`-webkit-mask-image:url(${E(form)});mask-image:url(${E(form)})`}></div>`}
          ${isEgg && crackOpacity > 0 && html`<svg class="egg-crack" viewBox="0 0 100 100" style=${`opacity:${crackOpacity}`}>
            <path d="M28 46 L36 40 L42 48 L50 38 L57 47 L64 40 L72 46" fill="none" stroke="#5B4636" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
            ${prog.pct > 70 && html`<path d="M44 58 L48 64 L53 58 L57 65" fill="none" stroke="#5B4636" stroke-width="1.8" stroke-linecap="round" />`}
          </svg>`}
        </div>
      </div>
    </div>
    ${props.filter((p) => p.z !== 'back').map((p, i) => html`<div key=${'f' + i} class=${`prop a-${p.a || 'none'}`} style=${`left:${p.x}%;top:${p.y}%;width:${p.s}%;height:${p.s}%`}><img src=${E(p.e)} alt="" /></div>`)}
    ${stage === 5 && html`<img class="crown" src=${E('Crown')} alt="" style=${`top:${50 - scale * 50 - 4}%`} />
      <div class="particles">${PARTICLES.map((p, i) => html`<i key=${i} style=${`left:${p.l}%;top:${p.t}%;animation-delay:${p.d}s`}></i>`)}</div>`}
    ${!isEgg && mood === 'hungry' && html`<img class="mood" src=${E('Thinking face')} alt="배고파요" />`}
    ${mood === 'sleepy' && !isEgg && html`<div class="zzz">Z z</div>`}
    ${line && html`<div class="bubble">${line}</div>`}
    ${hearts.map((h) => html`<img key=${h.id} class="heart-fx" src=${E(h.e)} alt="" style=${`left:${h.x}%;top:45%;--dx:${h.dx}px;animation-delay:${h.d}s`} />`)}
    ${xpFx && html`<div class="xp-fx" key=${xpFx.k}>${xpFx.v}</div>`}
  </div>`;
}

// 진화 / 전설 연출
export function EvolutionOverlay({ pet, from, to, onDone }) {
  const [phase, setPhase] = useState(0); // 0: 실루엣, 1: 섬광, 2: 새 모습
  useEffect(() => {
    sfx('levelup');
    const t1 = setTimeout(() => setPhase(1), 1400);
    const t2 = setTimeout(() => { setPhase(2); celebrate(to === 5 ? 2 : 1.2); }, 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const species = pet.species;
  const legendary = to === 5;
  const fromName = from === 0 ? '알' : STAGES[from].name;
  return html`<div class="evo" onClick=${() => phase === 2 && onDone()}>
    <div class="rays"></div>
    <div class=${'flash ' + (phase >= 1 ? 'go' : '')}></div>
    <div class="evo-inner">
      <div class="eyebrow" style="color:#C4B5FD">${phase < 2 ? '어…? 무언가 일어나고 있어요!' : legendary ? 'LEGENDARY' : 'EVOLUTION'}</div>
      <div class="evo-pet">
        <${PetStage} pet=${{ ...pet, stage: phase < 2 ? from : to, xp: pet.xp }} stageOverride=${phase < 2 ? from : to} silhouette=${phase < 2} showBubble=${false} />
      </div>
      ${phase === 2 && html`<div class="fade-in" style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <h2>${legendary ? `전설의 ${species.legend} 탄생!` : from === 0 ? `${species.name}가 태어났어요!` : `${STAGES[to].name} 단계로 진화!`}</h2>
        <div style="opacity:.85;font-weight:600">${legendary ? '도감에 영원히 기록되었어요. 새 알을 입양할 수 있어요!' : `${fromName} → ${STAGES[to].name} · 모습이 바뀌었어요`}</div>
        <button class="btn gold lg" style="margin-top:10px" onClick=${onDone}>멋져요!</button>
      </div>`}
    </div>
  </div>`;
}

// 진화 라인 미리보기
export function EvolutionLine({ species, stage, compact = false }) {
  return html`<div class="evo-line">
    ${STAGES.map((st, i) => html`
      ${i > 0 && html`<span class="arrow">›</span>`}
      <div class=${`step ${i > stage ? 'lock' : ''} ${i === stage ? 'cur' : ''}`}>
        <div class="im"><img src=${E(species.forms[i])} alt="" style=${i === 5 && i <= stage ? 'filter: drop-shadow(0 0 6px gold)' : ''} /></div>
        ${!compact && html`<div>${i === 5 ? '전설' : st.name}</div>`}
      </div>`)}
  </div>`;
}

export function MoodBadge({ mood }) {
  const m = MOOD[mood] || MOOD.ok;
  const cls = mood === 'hungry' ? 'warn' : mood === 'happy' ? 'good' : 'accent';
  return html`<span class=${'badge ' + cls}><${Emo} name=${m.emoji} size=${16} />${m.label}</span>`;
}
