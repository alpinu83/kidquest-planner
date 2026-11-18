// 지역 프리셋 · 공용 날짜 함수 (OCR/날씨 모듈 호환) · 새 가족 기본 데이터
export const KOREAN_CITIES = [
  { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.978 },
  { id: 'gangnam', name: '서울 강남·서초', lat: 37.4979, lon: 127.0276 },
  { id: 'bundang', name: '성남·분당', lat: 37.3827, lon: 127.1189 },
  { id: 'dongtan', name: '화성·동탄', lat: 37.2006, lon: 127.0736 },
  { id: 'suwon', name: '수원', lat: 37.2636, lon: 127.0286 },
  { id: 'incheon', name: '인천', lat: 37.4563, lon: 126.7052 },
  { id: 'yongin', name: '용인', lat: 37.2411, lon: 127.1776 },
  { id: 'daejeon', name: '대전', lat: 36.3504, lon: 127.3845 },
  { id: 'daegu', name: '대구', lat: 35.8714, lon: 128.6014 },
  { id: 'busan', name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'gwangju', name: '광주', lat: 35.1595, lon: 126.8526 },
  { id: 'jeju', name: '제주', lat: 33.4996, lon: 126.5312 }
];

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function getTodayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const KID_COLORS = [
  { id: 'violet', name: '라벤더', color: '#7C3AED', soft: '#EDE9FE' },
  { id: 'sky', name: '하늘', color: '#0284C7', soft: '#E0F2FE' },
  { id: 'rose', name: '로즈', color: '#E11D48', soft: '#FFE4E6' },
  { id: 'emerald', name: '민트', color: '#059669', soft: '#D1FAE5' },
  { id: 'amber', name: '선샤인', color: '#D97706', soft: '#FEF3C7' }
];

export function newKid(id, name, grade, colorId, vocabLevel, species) {
  const now = Date.now();
  const petId = `pet_${id}_1`;
  return {
    profile: { id, name, grade, colorId, vocabLevel, order: grade, createdAt: now },
    pets: { [petId]: { id: petId, species, name: '', adoptedAt: now } },
    activePet: petId,
    ledger: {
      [`welcome_${id}`]: { id: `welcome_${id}`, ts: now, date: getTodayKey(0), kind: 'bonus', talents: 10, reason: 'KidQuest 2.0 오픈 선물' }
    },
    habits: {
      h_bag: { id: 'h_bag', title: '내일 가방·준비물 스스로 챙기기', talents: 1, active: true },
      h_read: { id: 'h_read', title: '책 20분 읽기', talents: 1, active: true }
    }
  };
}

export function createSeed() {
  return {
    meta: { version: 2, createdAt: Date.now() },
    settings: { pin: '1234', cityId: 'seoul' },
    kids: {
      bella: newKid('bella', 'Bella', 6, 'violet', 4, 'unicorn'),
      wanny: newKid('wanny', 'Wanny', 3, 'sky', 2, 'dragon')
    }
  };
}
