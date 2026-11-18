// 펫 먹이 상점 · 달란트 보상 규칙
export const FOODS = [
  { id: 'apple', name: '사과', e: 'Red apple', cost: 1, xp: 10 },
  { id: 'carrot', name: '당근', e: 'Carrot', cost: 1, xp: 10 },
  { id: 'milk', name: '우유', e: 'Glass of milk', cost: 1, xp: 11 },
  { id: 'strawberry', name: '딸기', e: 'Strawberry', cost: 2, xp: 22 },
  { id: 'cookie', name: '쿠키', e: 'Cookie', cost: 2, xp: 22 },
  { id: 'bone', name: '뼈다귀 간식', e: 'Bone', cost: 2, xp: 22 },
  { id: 'meat', name: '고기', e: 'Meat on bone', cost: 3, xp: 35 },
  { id: 'icecream', name: '아이스크림', e: 'Ice cream', cost: 3, xp: 35 },
  { id: 'honey', name: '꿀단지', e: 'Honey pot', cost: 4, xp: 48 },
  { id: 'cake', name: '조각 케이크', e: 'Shortcake', cost: 5, xp: 62 },
  { id: 'party', name: '파티 케이크', e: 'Birthday cake', cost: 8, xp: 105 },
  { id: 'gem', name: '보석 사탕', e: 'Gem stone', cost: 12, xp: 170 }
];
export const FAV_BONUS = 1.5; // 좋아하는 음식은 경험치 1.5배

// 달란트 지급 기준
export const REWARDS = {
  workbook: 2,       // 문제집 자동 배정 숙제
  homework: 2,       // 부모가 추가한 숙제 기본값
  habit: 1,          // 생활 습관
  creative: 3,       // 창의 미션
  vocabDaily: 3,     // 오늘의 단어 학습 완료
  vocabPerfect: 1,   // 만점 보너스
  game: 1,           // 단어 게임 1판 (하루 최대 gameDailyCap)
  gameDailyCap: 4,
  allClear: 3,       // 오늘 할 일 모두 완료
  streak7: 5         // 7일 연속 보너스
};

export const PRAISE_PRESETS = [
  { label: '스스로 숙제 시작', talents: 2 },
  { label: '동생/누나 도와주기', talents: 2 },
  { label: '정리정돈 최고', talents: 1 },
  { label: '시험·대회 잘함', talents: 5 },
  { label: '예쁜 말 쓰기', talents: 1 },
  { label: '편식 없이 먹기', talents: 1 }
];
export const PENALTY_PRESETS = [
  { label: '숙제 미완료', talents: -2 },
  { label: '약속 시간 어김', talents: -2 },
  { label: '게임·유튜브 시간 초과', talents: -3 },
  { label: '거친 말·싸움', talents: -2 },
  { label: '준비물 안 챙김', talents: -1 }
];
