// 펫 도감 · 진화 라인 (이미지: Microsoft Fluent 3D Emoji, MIT)
// forms[i] = i단계 모습, props[i] = i단계에서 추가되는 장식 (x,y,s: 펫 무대 기준 %, z:'back'이면 뒤쪽)

export const STAGES = [
  { stage: 0, name: '알', min: 0, scale: 0.52 },
  { stage: 1, name: '아기', min: 300, scale: 0.5 },
  { stage: 2, name: '어린이', min: 1100, scale: 0.6 },
  { stage: 3, name: '청소년', min: 2400, scale: 0.68 },
  { stage: 4, name: '어른', min: 4300, scale: 0.76 },
  { stage: 5, name: '전설', min: 6800, scale: 0.8 }
];
// 2026-11-19 조정: 하루 달란트(약 25~30개)를 꾸준히 모아 약 3주 키우면 전설 (이전 기준 720)
export const MAX_PET_XP = 6800;

export function stageForXp(xp) {
  let s = STAGES[0];
  for (const st of STAGES) if (xp >= st.min) s = st;
  return s;
}
export function stageProgress(xp) {
  const cur = stageForXp(xp);
  const next = STAGES[cur.stage + 1];
  if (!next) return { cur, next: null, pct: 100, need: 0 };
  const pct = Math.round(((xp - cur.min) / (next.min - cur.min)) * 100);
  return { cur, next, pct, need: next.min - xp };
}

export const SPECIES = [
  {
    id: 'dragon', name: '불꽃 드래곤', legend: '황금 태양룡', color: '#F97316', colors: ['#FDBA74', '#EF4444'], fav: 'meat',
    desc: '용감하고 뜨거운 마음을 가진 불꽃의 수호자',
    forms: ['Egg', 'Lizard', 'Crocodile', 'Dragon face', 'Dragon', 'Dragon'],
    props: {
      3: [{ e: 'Fire', x: 82, y: 30, s: 16, a: 'flicker' }],
      4: [{ e: 'Fire', x: 14, y: 38, s: 18, a: 'flicker' }, { e: 'Fire', x: 86, y: 30, s: 16, a: 'flicker' }],
      5: [{ e: 'Fire', x: 10, y: 52, s: 22, a: 'flicker' }, { e: 'Fire', x: 90, y: 48, s: 22, a: 'flicker' }, { e: 'High voltage', x: 82, y: 14, s: 13, a: 'pulse' }, { e: 'Sun', x: 50, y: 34, s: 70, z: 'back', a: 'spin' }]
    },
    lines: ['크아앙! 오늘 미션도 불태우자!', '숙제 끝내면 불꽃이 더 커져!', '나는 매운 것도 좋아해!']
  },
  {
    id: 'unicorn', name: '무지개 유니콘', legend: '별빛 페가수스', color: '#A855F7', colors: ['#F0ABFC', '#818CF8'], fav: 'cake',
    desc: '꿈과 상상력을 키워주는 무지개 친구',
    forms: ['Egg', 'Horse face', 'Horse', 'Unicorn', 'Unicorn', 'Unicorn'],
    props: {
      3: [{ e: 'Sparkles', x: 84, y: 22, s: 14, a: 'twinkle' }],
      4: [{ e: 'Rainbow', x: 50, y: 30, s: 64, z: 'back', a: 'float' }, { e: 'Sparkles', x: 14, y: 24, s: 14, a: 'twinkle' }],
      5: [{ e: 'Rainbow', x: 50, y: 28, s: 84, z: 'back', a: 'float' }, { e: 'Glowing star', x: 14, y: 20, s: 14, a: 'twinkle' }, { e: 'Glowing star', x: 86, y: 24, s: 12, a: 'twinkle' }, { e: 'Sparkles', x: 80, y: 66, s: 14, a: 'twinkle' }]
    },
    lines: ['오늘은 어떤 상상을 해볼까?', '반짝반짝! 너는 최고야!', '케이크 먹고 싶다~']
  },
  {
    id: 'eagle', name: '하늘 독수리', legend: '천둥 그리폰', color: '#0EA5E9', colors: ['#7DD3FC', '#2563EB'], fav: 'meat',
    desc: '높이 날아 멀리 보는 집중력의 상징',
    forms: ['Egg', 'Hatching chick', 'Front-facing baby chick', 'Bird', 'Eagle', 'Eagle'],
    props: {
      4: [{ e: 'Feather', x: 16, y: 60, s: 13, a: 'float' }],
      5: [{ e: 'High voltage', x: 12, y: 30, s: 18, a: 'pulse' }, { e: 'High voltage', x: 88, y: 34, s: 16, a: 'pulse' }, { e: 'Cloud with rain', x: 50, y: 10, s: 30, z: 'back', a: 'float' }]
    },
    lines: ['집중! 목표를 향해 날아가자!', '높이 날려면 꾸준함이 필요해!', '삐익~ 오늘 몇 개 했어?']
  },
  {
    id: 'lion', name: '정글의 왕', legend: '태양의 사자왕', color: '#EAB308', colors: ['#FDE047', '#F59E0B'], fav: 'meat',
    desc: '자신감과 리더십을 키워주는 정글의 왕',
    forms: ['Egg', 'Cat face', 'Tiger face', 'Tiger', 'Lion', 'Lion'],
    props: {
      5: [{ e: 'Sun', x: 50, y: 40, s: 86, z: 'back', a: 'spin' }, { e: 'Sports medal', x: 82, y: 70, s: 14, a: 'swing' }]
    },
    lines: ['어흥! 오늘도 당당하게!', '용기는 연습하면 커져!', '고기 주면 더 힘낼게!']
  },
  {
    id: 'whale', name: '바다 수호자', legend: '심해의 왕고래', color: '#06B6D4', colors: ['#67E8F9', '#0284C7'], fav: 'apple',
    desc: '넓은 바다처럼 깊은 생각을 가진 친구',
    forms: ['Egg', 'Fish', 'Tropical fish', 'Dolphin', 'Whale', 'Spouting whale'],
    props: {
      1: [{ e: 'Bubbles', x: 78, y: 30, s: 12, a: 'rise' }],
      2: [{ e: 'Bubbles', x: 80, y: 28, s: 14, a: 'rise' }],
      3: [{ e: 'Bubbles', x: 18, y: 30, s: 14, a: 'rise' }, { e: 'Water wave', x: 50, y: 88, s: 40, a: 'float' }],
      4: [{ e: 'Water wave', x: 26, y: 86, s: 36, a: 'float' }, { e: 'Water wave', x: 74, y: 86, s: 36, a: 'float' }, { e: 'Bubbles', x: 84, y: 26, s: 14, a: 'rise' }],
      5: [{ e: 'Trident emblem', x: 86, y: 30, s: 18, a: 'swing' }, { e: 'Water wave', x: 22, y: 86, s: 38, a: 'float' }, { e: 'Water wave', x: 78, y: 86, s: 38, a: 'float' }, { e: 'Bubbles', x: 14, y: 30, s: 16, a: 'rise' }]
    },
    lines: ['뽀글뽀글~ 천천히 깊게 생각해 봐!', '바다만큼 넓은 마음!', '오늘 읽은 책 이야기 해줘!']
  },
  {
    id: 'butterfly', name: '꽃나비 요정', legend: '봄의 여왕나비', color: '#EC4899', colors: ['#FBCFE8', '#DB2777'], fav: 'honey',
    desc: '작은 애벌레가 멋진 나비가 되는 성장의 기적',
    forms: ['Egg', 'Bug', 'Bug', 'Butterfly', 'Butterfly', 'Butterfly'],
    props: {
      1: [{ e: 'Herb', x: 50, y: 82, s: 34, z: 'back' }],
      2: [{ e: 'Herb', x: 30, y: 80, s: 34, z: 'back' }, { e: 'Herb', x: 72, y: 82, s: 30, z: 'back' }],
      3: [{ e: 'Cherry blossom', x: 18, y: 72, s: 16, a: 'float' }],
      4: [{ e: 'Cherry blossom', x: 14, y: 70, s: 18, a: 'float' }, { e: 'Cherry blossom', x: 86, y: 66, s: 16, a: 'float' }, { e: 'Sparkles', x: 82, y: 18, s: 12, a: 'twinkle' }],
      5: [{ e: 'Cherry blossom', x: 12, y: 66, s: 20, a: 'float' }, { e: 'Cherry blossom', x: 88, y: 62, s: 20, a: 'float' }, { e: 'Cherry blossom', x: 50, y: 90, s: 18, a: 'float' }, { e: 'Dizzy', x: 16, y: 18, s: 14, a: 'twinkle' }, { e: 'Sparkles', x: 84, y: 16, s: 14, a: 'twinkle' }]
    },
    lines: ['조금씩 자라는 게 진짜 멋진 거야!', '팔랑팔랑~ 기분 좋아!', '꿀 한 방울만~']
  },
  {
    id: 'wolf', name: '달빛 늑대', legend: '얼음 달의 늑대왕', color: '#6366F1', colors: ['#C7D2FE', '#4338CA'], fav: 'bone',
    desc: '친구와 가족을 지키는 의리의 늑대',
    forms: ['Egg', 'Dog face', 'Dog', 'Wolf', 'Wolf', 'Wolf'],
    props: {
      4: [{ e: 'Crescent moon', x: 80, y: 18, s: 24, z: 'back', a: 'float' }],
      5: [{ e: 'Crescent moon', x: 50, y: 26, s: 70, z: 'back', a: 'float' }, { e: 'Snowflake', x: 12, y: 40, s: 14, a: 'spin' }, { e: 'Snowflake', x: 88, y: 56, s: 12, a: 'spin' }, { e: 'Shooting star', x: 84, y: 12, s: 14, a: 'twinkle' }]
    },
    lines: ['아우~! 같이 하면 더 강해!', '약속은 꼭 지키는 거야!', '뼈다귀 간식 최고!']
  },
  {
    id: 'tree', name: '생명의 나무', legend: '천년 벚꽃 신목', color: '#22C55E', colors: ['#BBF7D0', '#15803D'], fav: 'milk',
    desc: '작은 씨앗이 매일 조금씩 자라 큰 나무가 돼요',
    forms: ['Chestnut', 'Seedling', 'Herb', 'Potted plant', 'Deciduous tree', 'Deciduous tree'],
    props: {
      3: [{ e: 'Sun', x: 84, y: 14, s: 16, a: 'spin' }],
      4: [{ e: 'Sun', x: 84, y: 12, s: 18, a: 'spin' }, { e: 'Bird', x: 18, y: 26, s: 14, a: 'float' }],
      5: [{ e: 'Cherry blossom', x: 30, y: 26, s: 16, a: 'float' }, { e: 'Cherry blossom', x: 70, y: 22, s: 16, a: 'float' }, { e: 'Cherry blossom', x: 52, y: 14, s: 14, a: 'float' }, { e: 'Sun', x: 50, y: 40, s: 90, z: 'back', a: 'spin' }, { e: 'Sparkles', x: 86, y: 60, s: 14, a: 'twinkle' }]
    },
    lines: ['물 주듯 매일 조금씩!', '뿌리가 튼튼해지는 중이야~', '햇빛이 좋아!']
  },
  {
    id: 'rabbit', name: '달토끼', legend: '달나라 수호토끼', color: '#F472B6', colors: ['#FCE7F3', '#BE185D'], fav: 'carrot',
    desc: '부지런하고 재빠른 달나라 친구',
    forms: ['Egg', 'Rabbit face', 'Rabbit', 'Rabbit', 'Rabbit', 'Rabbit'],
    props: {
      3: [{ e: 'Carrot', x: 82, y: 70, s: 16, a: 'swing' }],
      4: [{ e: 'Crescent moon', x: 82, y: 16, s: 22, z: 'back', a: 'float' }, { e: 'Star', x: 16, y: 20, s: 12, a: 'twinkle' }],
      5: [{ e: 'Crescent moon', x: 50, y: 30, s: 76, z: 'back', a: 'float' }, { e: 'Star', x: 12, y: 16, s: 12, a: 'twinkle' }, { e: 'Star', x: 88, y: 22, s: 10, a: 'twinkle' }, { e: 'Shooting star', x: 20, y: 60, s: 14, a: 'twinkle' }]
    },
    lines: ['깡총! 빨리 끝내고 놀자!', '당근 하나만 줄래?', '꾸준한 거북이도 응원해~']
  },
  {
    id: 'owl', name: '지혜의 부엉이', legend: '마법 학자 부엉이', color: '#A16207', colors: ['#FDE68A', '#92400E'], fav: 'cookie',
    desc: '책을 사랑하는 지혜로운 밤의 학자',
    forms: ['Egg', 'Hatching chick', 'Baby chick', 'Owl', 'Owl', 'Owl'],
    props: {
      3: [{ e: 'Books', x: 82, y: 78, s: 18 }],
      4: [{ e: 'Books', x: 82, y: 78, s: 20 }, { e: 'Light bulb', x: 16, y: 20, s: 14, a: 'pulse' }],
      5: [{ e: 'Crystal ball', x: 84, y: 74, s: 20, a: 'pulse' }, { e: 'Books', x: 16, y: 78, s: 20 }, { e: 'Crescent moon', x: 50, y: 22, s: 60, z: 'back', a: 'float' }, { e: 'Sparkles', x: 84, y: 20, s: 14, a: 'twinkle' }]
    },
    lines: ['부엉~ 오늘 배운 걸 설명해 줄래?', '모르는 건 부끄러운 게 아니야!', '책 한 권 더 읽어볼까?']
  },
  {
    id: 'phoenix', name: '불사조', legend: '영원의 피닉스', color: '#DC2626', colors: ['#FCA5A5', '#B91C1C'], fav: 'strawberry',
    desc: '실수해도 다시 일어나는 회복의 새',
    forms: ['Egg', 'Hatching chick', 'Baby chick', 'Parrot', 'Peacock', 'Peacock'],
    props: {
      4: [{ e: 'Sparkles', x: 84, y: 22, s: 14, a: 'twinkle' }],
      5: [{ e: 'Fire', x: 14, y: 46, s: 22, a: 'flicker' }, { e: 'Fire', x: 86, y: 42, s: 22, a: 'flicker' }, { e: 'Fire', x: 50, y: 92, s: 20, a: 'flicker' }, { e: 'Sun', x: 50, y: 40, s: 88, z: 'back', a: 'spin' }]
    },
    lines: ['틀려도 괜찮아, 다시 하면 돼!', '실수는 성장의 불씨!', '딸기 너무 좋아~']
  },
  {
    id: 'kraken', name: '심해 크라켄', legend: '바다의 대마왕', color: '#7C3AED', colors: ['#DDD6FE', '#5B21B6'], fav: 'icecream',
    desc: '여러 개의 팔로 여러 가지를 척척 해내는 친구',
    forms: ['Egg', 'Squid', 'Squid', 'Octopus', 'Octopus', 'Octopus'],
    props: {
      2: [{ e: 'Bubbles', x: 82, y: 26, s: 14, a: 'rise' }],
      3: [{ e: 'Bubbles', x: 16, y: 28, s: 14, a: 'rise' }],
      4: [{ e: 'Water wave', x: 50, y: 88, s: 50, a: 'float' }, { e: 'Bubbles', x: 84, y: 24, s: 14, a: 'rise' }],
      5: [{ e: 'Trident emblem', x: 84, y: 28, s: 18, a: 'swing' }, { e: 'Water wave', x: 24, y: 88, s: 40, a: 'float' }, { e: 'Water wave', x: 76, y: 88, s: 40, a: 'float' }, { e: 'Gem stone', x: 16, y: 26, s: 14, a: 'twinkle' }]
    },
    lines: ['여덟 개 팔로 숙제 척척!', '멀티태스킹 장인!', '아이스크림 주세요~']
  },
  {
    id: 'polar', name: '북극 탐험대', legend: '오로라 북극곰', color: '#38BDF8', colors: ['#E0F2FE', '#0369A1'], fav: 'icecream',
    desc: '추위에도 지지 않는 끈기의 탐험가',
    forms: ['Egg', 'Penguin', 'Penguin', 'Seal', 'Polar bear', 'Polar bear'],
    props: {
      2: [{ e: 'Snowflake', x: 84, y: 24, s: 12, a: 'spin' }],
      3: [{ e: 'Snowflake', x: 14, y: 26, s: 12, a: 'spin' }, { e: 'Snowflake', x: 86, y: 40, s: 10, a: 'spin' }],
      4: [{ e: 'Snowflake', x: 14, y: 22, s: 14, a: 'spin' }, { e: 'Snowflake', x: 86, y: 30, s: 12, a: 'spin' }, { e: 'Snowman', x: 84, y: 76, s: 18 }],
      5: [{ e: 'Snowflake', x: 12, y: 20, s: 16, a: 'spin' }, { e: 'Snowflake', x: 88, y: 26, s: 14, a: 'spin' }, { e: 'Glowing star', x: 50, y: 10, s: 14, a: 'twinkle' }, { e: 'Rainbow', x: 50, y: 32, s: 80, z: 'back', a: 'float' }]
    },
    lines: ['추워도 끝까지 해내자!', '얼음처럼 단단한 집중력!', '아이스크림은 겨울에도 좋아!']
  }
];

export const speciesById = (id) => SPECIES.find((s) => s.id === id) || SPECIES[0];

export const MOOD = {
  happy: { label: '행복해요', emoji: 'Smiling face with hearts' },
  ok: { label: '좋아요', emoji: 'Sparkles' },
  hungry: { label: '배고파요', emoji: 'Thinking face' },
  sleepy: { label: '쿨쿨 자는 중', emoji: 'Sleeping face' }
};
