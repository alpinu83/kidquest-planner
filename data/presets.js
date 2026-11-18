// 초기 프로필, 학원 시간표, 교재 자동배정 마스터, 지역 날씨 프리셋
export const KOREAN_CITIES = [
  { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.9780 },
  { id: 'gangnam', name: '서울 강남·서초', lat: 37.4979, lon: 127.0276 },
  { id: 'bundang', name: '성남·분당', lat: 37.3827, lon: 127.1189 },
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createInitialData() {
  const today = getTodayKey(0);
  const tomorrow = getTodayKey(1);

  return {
    version: 1,
    settings: {
      parentPin: '1234',
      cityId: 'seoul',
      reviewDayOfWeek: 6, // 6 = 토요일 (0:일 ~ 6:토)
      ntfyTopic: ''
    },
    kids: {
      bella: {
        id: 'bella',
        name: 'Bella',
        grade: '초등 6학년',
        theme: 'lavender',
        avatarColor: '#8B5CF6',
        pin: '', // 선택형 잠금 (비워두면 바로 로그인)
        vocabLevel: 4, // Level 4: 초6~예비중1
        activeCharId: 'unicorn',
        charXp: 95,
        streak: 4,
        lastActiveDate: today,
        collection: [
          {
            uid: 'col_bella_1',
            charId: 'cat',
            name: '루나 냥이',
            completedAt: getTodayKey(-9),
            totalXp: 220
          }
        ],
        // 문제집 자동 배정 마스터 (매일 일일이 입력하지 않고 규칙으로 자동 생성!)
        workbooks: [
          {
            id: 'wb_b1',
            subject: '수학',
            title: '쎈 수학 6-2',
            currentPage: 44,
            pagesPerDay: 2,
            totalPages: 140,
            daysOfWeek: [1, 2, 3, 4, 5], // 월~금
            xp: 25,
            active: true
          },
          {
            id: 'wb_b2',
            subject: '영어',
            title: '리딩 튜터 주니어',
            currentPage: 22,
            pagesPerDay: 2,
            totalPages: 100,
            daysOfWeek: [1, 3, 5], // 월수금
            xp: 20,
            active: true
          },
          {
            id: 'wb_b3',
            subject: '국어',
            title: '매3비 초등 비문학',
            currentPage: 16,
            pagesPerDay: 2,
            totalPages: 90,
            daysOfWeek: [2, 4, 6], // 화목토
            xp: 20,
            active: true
          }
        ],
        // 일자별 추가/개별 숙제 및 할일 (습관 포함)
        tasksByDate: {
          [today]: [
            { id: 't_b_1', subject: '수학', title: '쎈 수학 6-2 (p.44~45)', xp: 25, done: false, source: 'workbook', wbId: 'wb_b1' },
            { id: 't_b_2', subject: '영어', title: '리딩 튜터 주니어 (p.22~23)', xp: 20, done: false, source: 'workbook', wbId: 'wb_b2' },
            { id: 't_b_3', subject: '영단어', title: '오늘의 영단어 20개 챌린지', xp: 30, done: false, source: 'vocab' },
            { id: 't_b_4', subject: '생활', title: '책상 정리 & 내일 시간표 챙기기', xp: 15, done: false, source: 'habit' }
          ],
          [tomorrow]: [
            { id: 't_b_tm1', subject: '수학', title: '쎈 수학 6-2 (p.46~47)', xp: 25, done: false, source: 'workbook', wbId: 'wb_b1' },
            { id: 't_b_tm2', subject: '국어', title: '매3비 초등 비문학 (p.16~17)', xp: 20, done: false, source: 'workbook', wbId: 'wb_b3' }
          ]
        },
        // 하교 후 학원 & 학습지 스케쥴 (요일별)
        academies: [
          { id: 'ac_b1', title: '영어 학원 (어학원)', type: '학원', days: [1, 3, 5], start: '15:30', end: '17:00', note: '단어장·리딩북 지참' },
          { id: 'ac_b2', title: '수학 학원', type: '학원', days: [2, 4], start: '16:00', end: '17:50', note: '오답노트 확인' },
          { id: 'ac_b3', title: '구몬 국어·한자 방문선생님', type: '학습지', days: [3], start: '17:30', end: '18:00', note: '밀린 학습지 채점' },
          { id: 'ac_b4', title: '피아노 레슨', type: '예체능', days: [1, 4], start: '18:10', end: '18:50', note: '체르니 연습' }
        ],
        // 영단어 학습 기록 & 오답 노트
        vocabStats: {
          masteredIds: [],
          wrongBank: [
            { wordId: 'v_155', wrongCount: 2, lastWrong: getTodayKey(-2) },
            { wordId: 'v_168', wrongCount: 1, lastWrong: getTodayKey(-1) },
            { wordId: 'v_182', wrongCount: 1, lastWrong: getTodayKey(-1) }
          ],
          sessionsDone: 0
        },
        // 감점 / 칭찬 기록 로그
        logs: [
          { id: 'log_b1', date: today, type: 'gain', reason: '어제 숙제 100% 완수 보너스', delta: 15 }
        ]
      },

      wanny: {
        id: 'wanny',
        name: 'Wanny',
        grade: '초등 3학년',
        theme: 'mint',
        avatarColor: '#0EA5E9',
        pin: '',
        vocabLevel: 2, // Level 2: 초3~4 핵심
        activeCharId: 'dragon',
        charXp: 55,
        streak: 3,
        lastActiveDate: today,
        collection: [
          {
            uid: 'col_wanny_1',
            charId: 'robo',
            name: '볼트 메카봇',
            completedAt: getTodayKey(-6),
            totalXp: 220
          }
        ],
        workbooks: [
          {
            id: 'wb_w1',
            subject: '수학',
            title: '기적의 계산법 6권',
            currentPage: 28,
            pagesPerDay: 2,
            totalPages: 120,
            daysOfWeek: [1, 2, 3, 4, 5],
            xp: 25,
            active: true
          },
          {
            id: 'wb_w2',
            subject: '국어',
            title: '초등 독해력 3단계',
            currentPage: 14,
            pagesPerDay: 2,
            totalPages: 80,
            daysOfWeek: [1, 3, 5],
            xp: 20,
            active: true
          }
        ],
        tasksByDate: {
          [today]: [
            { id: 't_w_1', subject: '수학', title: '기적의 계산법 6권 (p.28~29)', xp: 25, done: false, source: 'workbook', wbId: 'wb_w1' },
            { id: 't_w_2', subject: '국어', title: '초등 독해력 3단계 (p.14~15)', xp: 20, done: false, source: 'workbook', wbId: 'wb_w2' },
            { id: 't_w_3', subject: '영단어', title: '오늘의 영단어 20개 챌린지', xp: 30, done: false, source: 'vocab' },
            { id: 't_w_4', subject: '독서', title: '재미있는 책 20분 읽기', xp: 15, done: false, source: 'habit' }
          ]
        },
        academies: [
          { id: 'ac_w1', title: '태권도장', type: '예체능', days: [1, 2, 3, 4, 5], start: '15:00', end: '16:00', note: '도복·물통 챙기기' },
          { id: 'ac_w2', title: '눈높이 수학·국어 선생님', type: '학습지', days: [2], start: '16:30', end: '17:10', note: '지난주 학습지 확인' },
          { id: 'ac_w3', title: '영어 회화 학원', type: '학원', days: [1, 3, 5], start: '16:30', end: '17:30', note: '파닉스 워크북' },
          { id: 'ac_w4', title: '미술 창작 교실', type: '예체능', days: [4], start: '16:30', end: '17:40', note: '앞치마 지참' }
        ],
        vocabStats: {
          masteredIds: [],
          wrongBank: [
            { wordId: 'v_57', wrongCount: 1, lastWrong: getTodayKey(-1) },
            { wordId: 'v_65', wrongCount: 2, lastWrong: getTodayKey(-2) }
          ],
          sessionsDone: 0
        },
        logs: [
          { id: 'log_w1', date: today, type: 'gain', reason: '태권도 가방 스스로 챙기기', delta: 10 }
        ]
      }
    }
  };
}
