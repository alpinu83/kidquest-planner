// 6종 캐릭터 라인업 · 각 5단계(알 -> 아기 -> 주니어 -> 히어로 -> 레전드) SVG 진화 일러스트
export const EVOLUTION_STAGES = [
  { stage: 1, name: '신비한 알', minXp: 0, badge: 'Lv.1' },
  { stage: 2, name: '아기 펫', minXp: 40, badge: 'Lv.2' },
  { stage: 3, name: '주니어 파트너', minXp: 90, badge: 'Lv.3' },
  { stage: 4, name: '히어로 수호자', minXp: 150, badge: 'Lv.4' },
  { stage: 5, name: '레전드 마스터', minXp: 220, badge: 'MAX' }
];

export const MAX_CHAR_XP = 220;

export const CHARACTERS = [
  {
    id: 'dragon',
    name: '블레이즈 드래곤',
    tag: '열정의 불꽃',
    primary: '#FF6B4A',
    secondary: '#FFB800',
    bg: 'linear-gradient(135deg, #FFF0EA 0%, #FFE1CC 100%)',
    desc: '숙제를 끝낼 때마다 뜨거운 용기의 불꽃이 커지는 아기 용이에요.',
    quotes: [
      '알 속에서 심장이 두근두근 뛰고 있어요!',
      '작은 불꽃이 톡! 오늘 숙제 하나만 더 해볼까요?',
      '날개가 자라고 있어요! 바람을 가를 준비 완료!',
      '거의 다 왔어요! 황금 왕관이 반짝이기 시작했어요!',
      '전설의 드래곤으로 각성! 명예의 컬렉션 룸으로 가자!'
    ]
  },
  {
    id: 'unicorn',
    name: '루미나 유니콘',
    tag: '별빛 마법',
    primary: '#A855F7',
    secondary: '#EC4899',
    bg: 'linear-gradient(135deg, #F5EEFF 0%, #FCE7F3 100%)',
    desc: '무지개 뿔에 별빛 에너지를 모으는 신비로운 유니콘이에요.',
    quotes: [
      '보랏빛 알에 작은 별가루가 반짝이고 있어요.',
      '뿅! 조그만 은빛 뿔이 돋아났어요!',
      '무지개 갈기가 바람에 나풀거려요!',
      '별빛 날개가 펼쳐졌어요! 조금만 더 힘내요!',
      '완벽한 스타라이트 유니콘 완성! 영원히 기억될 거예요!'
    ]
  },
  {
    id: 'robo',
    name: '볼트 메카봇',
    tag: '미래 코딩',
    primary: '#0EA5E9',
    secondary: '#22D3EE',
    bg: 'linear-gradient(135deg, #E0F2FE 0%, #CFFAFE 100%)',
    desc: '단어를 외우고 문제를 풀 때마다 부품이 업그레이드되는 로봇이에요.',
    quotes: [
      '시스템 대기 중... 에너지 코어가 충전되길 기다려요.',
      '삐리릭! 귀여운 미니 봇이 깨어났어요!',
      '제트 부스터 장착 완료! 학습 속도 2배 상승!',
      '플라즈마 실드 활성화! 어떤 숙제도 문제없어요!',
      '울트라 메카 레전드! 최고의 파트너가 되었어요!'
    ]
  },
  {
    id: 'fox',
    name: '모스 여우',
    tag: '숲속 지혜',
    primary: '#10B981',
    secondary: '#F59E0B',
    bg: 'linear-gradient(135deg, #ECFDF5 0%, #FEF3C7 100%)',
    desc: '지혜로운 나뭇잎 꼬리로 영단어를 기억하게 해주는 숲의 수호자예요.',
    quotes: [
      '초록빛 이끼 알이 숲의 노래를 듣고 있어요.',
      '폭신한 꼬리 하나가 살랑살랑 움직여요!',
      '나뭇잎 망토를 두른 꼬마 탐험가가 되었어요!',
      '세 개의 황금 꼬리가 빛나는 숲의 현자예요!',
      '대자연의 구미호 마스터! 지혜의 전당에 입성했어요!'
    ]
  },
  {
    id: 'shark',
    name: '아쿠아 샤크',
    tag: '심해 모험',
    primary: '#2563EB',
    secondary: '#38BDF8',
    bg: 'linear-gradient(135deg, #EFF6FF 0%, #E0F2FE 100%)',
    desc: '거친 파도를 헤치고 목표를 향해 헤엄치는 씩씩한 아기 상어예요.',
    quotes: [
      '바닷속 진주 알에서 물방울이 뽀글뽀글 올라와요.',
      '첨벙! 씩씩한 아기 상어가 헤엄치기 시작했어요!',
      '등지느러미가 멋지게 자라고 있어요!',
      '번개 파도를 타는 바다의 수호자가 되었어요!',
      '심해의 제왕 아쿠아 킹! 파도를 지배했어요!'
    ]
  },
  {
    id: 'cat',
    name: '루나 냥이',
    tag: '달빛 힐링',
    primary: '#F43F5E',
    secondary: '#FB923C',
    bg: 'linear-gradient(135deg, #FFF1F2 0%, #FFEDD5 100%)',
    desc: '초승달 방울을 달고 집중력을 선물하는 마법 고양이예요.',
    quotes: [
      '포근한 달빛 알 속에서 야옹 소리가 들려요.',
      '야옹! 반짝이는 방울을 단 아기 고양이가 나왔어요!',
      '마법 리본을 매고 날렵하게 점프해요!',
      '별빛 마법 지팡이를 손에 넣었어요!',
      '달의 여왕 루나 마스터! 모두가 부러워할 거예요!'
    ]
  }
];

export function getStageForXp(xp) {
  let current = EVOLUTION_STAGES[0];
  for (const s of EVOLUTION_STAGES) {
    if (xp >= s.minXp) current = s;
  }
  return current;
}

export function renderCharacterSvg(charId, stage, size = 160) {
  const ch = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
  const p = ch.primary;
  const s = ch.secondary;
  const aura = stage >= 4
    ? `<circle cx="100" cy="100" r="84" fill="none" stroke="${s}" stroke-width="3" stroke-dasharray="8 6" opacity="0.75"><animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="14s" repeatCount="indefinite"/></circle>`
    : '';
  const crown = stage >= 5
    ? `<path d="M74 34 L82 18 L94 29 L100 14 L106 29 L118 18 L126 34 Z" fill="#FACC15" stroke="#B45309" stroke-width="2.5" stroke-linejoin="round"/>
       <circle cx="100" cy="13" r="3.5" fill="#FFF"/>`
    : stage === 4
    ? `<polygon points="152,22 156,31 166,31 158,37 161,46 152,40 143,46 146,37 138,31 148,31" fill="#FACC15" stroke="#B45309" stroke-width="1.5"/>`
    : '';

  // Stage 1: Egg
  if (stage === 1) {
    return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" class="char-svg stage-1">
      <ellipse cx="100" cy="168" rx="44" ry="11" fill="rgba(15,23,42,0.1)"/>
      <path d="M100 34 C66 34 46 84 48 124 C50 154 74 166 100 166 C126 166 150 154 152 124 C154 84 134 34 100 34 Z" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <path d="M62 102 Q82 88 100 104 Q118 120 142 98" fill="none" stroke="${s}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
      <circle cx="80" cy="70" r="7" fill="rgba(255,255,255,0.55)"/>
      <circle cx="122" cy="134" r="9" fill="${s}" opacity="0.65"/>
      <path d="M90 52 L98 63 L92 72" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
    </svg>`;
  }

  // Stage 2..5 per character
  const wings = stage >= 3
    ? (charId === 'robo'
      ? `<rect x="28" y="88" width="22" height="44" rx="8" fill="${s}" stroke="#1E293B" stroke-width="3"/>
         <rect x="150" y="88" width="22" height="44" rx="8" fill="${s}" stroke="#1E293B" stroke-width="3"/>`
      : charId === 'shark'
      ? `<path d="M44 108 Q22 92 32 126 Q42 132 54 122 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>
         <path d="M156 108 Q178 92 168 126 Q158 132 146 122 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>`
      : `<path d="M52 98 Q18 68 24 114 Q36 126 54 118 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>
         <path d="M148 98 Q182 68 176 114 Q164 126 146 118 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>`)
    : '';

  const sparkles = stage >= 4
    ? `<circle cx="34" cy="48" r="4" fill="${s}"/><circle cx="166" cy="52" r="5" fill="${s}"/><circle cx="164" cy="148" r="3.5" fill="${p}"/><circle cx="36" cy="146" r="3.5" fill="${p}"/>`
    : '';

  const bodyScale = stage === 2 ? 'scale(0.84) translate(19, 22)' : stage === 3 ? 'scale(0.93) translate(7, 8)' : 'scale(1)';

  let headAndBody = '';
  if (charId === 'dragon') {
    headAndBody = `
      <path d="M72 52 L60 32 L84 44 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>
      <path d="M128 52 L140 32 L116 44 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>
      <ellipse cx="100" cy="122" rx="44" ry="38" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <ellipse cx="100" cy="128" rx="26" ry="25" fill="#FEF3C7"/>
      <circle cx="100" cy="76" r="34" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <circle cx="86" cy="72" r="6" fill="#1E293B"/><circle cx="88" cy="70" r="2.2" fill="#FFF"/>
      <circle cx="114" cy="72" r="6" fill="#1E293B"/><circle cx="116" cy="70" r="2.2" fill="#FFF"/>
      <path d="M90 88 Q100 96 110 88" fill="none" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
      <circle cx="75" cy="82" r="5" fill="#FDA4AF" opacity="0.7"/><circle cx="125" cy="82" r="5" fill="#FDA4AF" opacity="0.7"/>
      ${stage >= 3 ? `<path d="M138 134 Q166 132 162 108 Q154 122 140 120 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>` : ''}
    `;
  } else if (charId === 'unicorn') {
    headAndBody = `
      <polygon points="100,24 91,52 109,52" fill="#FACC15" stroke="#1E293B" stroke-width="3"/>
      <ellipse cx="72" cy="54" rx="10" ry="16" fill="${p}" stroke="#1E293B" stroke-width="3" transform="rotate(-18 72 54)"/>
      <ellipse cx="128" cy="54" rx="10" ry="16" fill="${p}" stroke="#1E293B" stroke-width="3" transform="rotate(18 128 54)"/>
      <ellipse cx="100" cy="124" rx="40" ry="35" fill="#FFF" stroke="#1E293B" stroke-width="4"/>
      <ellipse cx="100" cy="128" rx="22" ry="20" fill="#FCE7F3"/>
      <circle cx="100" cy="78" r="33" fill="#FFF" stroke="#1E293B" stroke-width="4"/>
      <path d="M74 60 Q100 44 126 60" fill="${p}" stroke="#1E293B" stroke-width="2"/>
      <circle cx="86" cy="78" r="5.5" fill="#1E293B"/><circle cx="88" cy="76" r="2" fill="#FFF"/>
      <circle cx="114" cy="78" r="5.5" fill="#1E293B"/><circle cx="116" cy="76" r="2" fill="#FFF"/>
      <path d="M92 92 Q100 98 108 92" fill="none" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
      <circle cx="76" cy="87" r="5" fill="#F9A8D4" opacity="0.8"/><circle cx="124" cy="87" r="5" fill="#F9A8D4" opacity="0.8"/>
    `;
  } else if (charId === 'robo') {
    headAndBody = `
      <line x1="100" y1="30" x2="100" y2="46" stroke="#1E293B" stroke-width="4"/>
      <circle cx="100" cy="26" r="7" fill="${s}" stroke="#1E293B" stroke-width="3"/>
      <rect x="62" y="96" width="76" height="62" rx="18" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <rect x="78" y="112" width="44" height="30" rx="8" fill="#E0F2FE" stroke="#1E293B" stroke-width="2.5"/>
      <path d="M88 127 L96 127 L100 119 L105 134 L109 127 L115 127" fill="none" stroke="#0284C7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="64" y="46" width="72" height="52" rx="16" fill="#F8FAFC" stroke="#1E293B" stroke-width="4"/>
      <rect x="74" y="57" width="52" height="28" rx="9" fill="#0F172A"/>
      <circle cx="88" cy="71" r="5" fill="#38BDF8"/><circle cx="112" cy="71" r="5" fill="#38BDF8"/>
      <path d="M93 78 Q100 83 107 78" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round"/>
    `;
  } else if (charId === 'fox') {
    headAndBody = `
      <polygon points="62,64 56,28 88,48" fill="${p}" stroke="#1E293B" stroke-width="3.5" stroke-linejoin="round"/>
      <polygon points="138,64 144,28 112,48" fill="${p}" stroke="#1E293B" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="125" rx="38" ry="34" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <ellipse cx="100" cy="130" rx="22" ry="22" fill="#FEF3C7"/>
      <circle cx="100" cy="78" r="34" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <path d="M68 82 Q100 108 132 82 Q122 106 100 108 Q78 106 68 82 Z" fill="#FFF"/>
      <circle cx="86" cy="76" r="5.5" fill="#1E293B"/><circle cx="88" cy="74" r="2" fill="#FFF"/>
      <circle cx="114" cy="76" r="5.5" fill="#1E293B"/><circle cx="116" cy="74" r="2" fill="#FFF"/>
      <polygon points="96,87 104,87 100,92" fill="#1E293B"/>
      <path d="M134 138 Q170 124 160 98 Q144 106 134 128 Z" fill="${s}" stroke="#1E293B" stroke-width="3"/>
    `;
  } else if (charId === 'shark') {
    headAndBody = `
      <path d="M100 28 L114 54 L88 54 Z" fill="${p}" stroke="#1E293B" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="108" rx="46" ry="50" fill="${p}" stroke="#1E293B" stroke-width="4"/>
      <ellipse cx="100" cy="122" rx="32" ry="34" fill="#EFF6FF"/>
      <circle cx="82" cy="86" r="6" fill="#1E293B"/><circle cx="84" cy="84" r="2.2" fill="#FFF"/>
      <circle cx="118" cy="86" r="6" fill="#1E293B"/><circle cx="120" cy="84" r="2.2" fill="#FFF"/>
      <path d="M84 106 Q100 118 116 106" fill="#FFF" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
      <circle cx="70" cy="96" r="5" fill="#93C5FD"/><circle cx="130" cy="96" r="5" fill="#93C5FD"/>
    `;
  } else {
    headAndBody = `
      <polygon points="65,64 60,30 88,48" fill="${p}" stroke="#1E293B" stroke-width="3.5" stroke-linejoin="round"/>
      <polygon points="135,64 140,30 112,48" fill="${p}" stroke="#1E293B" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="100" cy="124" rx="38" ry="34" fill="#FFF1F2" stroke="#1E293B" stroke-width="4"/>
      <circle cx="100" cy="78" r="34" fill="#FFF1F2" stroke="#1E293B" stroke-width="4"/>
      <circle cx="86" cy="76" r="5.5" fill="#1E293B"/><circle cx="88" cy="74" r="2" fill="#FFF"/>
      <circle cx="114" cy="76" r="5.5" fill="#1E293B"/><circle cx="116" cy="74" r="2" fill="#FFF"/>
      <path d="M94 88 Q100 93 106 88" fill="none" stroke="#1E293B" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="108" r="7" fill="#FACC15" stroke="#1E293B" stroke-width="2.5"/>
      <circle cx="74" cy="84" r="5" fill="#FDA4AF" opacity="0.8"/><circle cx="126" cy="84" r="5" fill="#FDA4AF" opacity="0.8"/>
    `;
  }

  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" class="char-svg stage-${stage}">
    <ellipse cx="100" cy="168" rx="46" ry="10" fill="rgba(15,23,42,0.1)"/>
    ${aura}
    ${sparkles}
    <g transform="${bodyScale}">
      ${wings}
      ${headAndBody}
      ${crown}
    </g>
  </svg>`;
}
