// 창의 미션 뱅크 — 매일 아이별로 3개씩 (학년·요일 맞춤) 자동 출제
// type: draw(그림판) | write(글쓰기) | photo(사진 인증) | check(실천 체크) | quiz(정답 맞히기) | speak(영어 말하기)
// g: [최소학년, 최대학년]

export const CATEGORIES = {
  art: { name: '그림·상상', e: 'Artist palette', color: '#EC4899' },
  write: { name: '글쓰기', e: 'Memo', color: '#8B5CF6' },
  science: { name: '과학 실험', e: 'Test tube', color: '#06B6D4' },
  brain: { name: '두뇌 퍼즐', e: 'Puzzle piece', color: '#F59E0B' },
  body: { name: '몸 튼튼', e: 'Soccer ball', color: '#22C55E' },
  heart: { name: '마음 일기', e: 'Heart with ribbon', color: '#F43F5E' },
  world: { name: '세상 탐험', e: 'Globe showing asia-australia', color: '#0EA5E9' },
  money: { name: '경제 습관', e: 'Money bag', color: '#EAB308' },
  english: { name: '영어 말하기', e: 'Speaking head', color: '#6366F1' },
  music: { name: '음악·예술', e: 'Musical notes', color: '#D946EF' },
  code: { name: '코딩·논리', e: 'Laptop', color: '#14B8A6' },
  home: { name: '집안일 영웅', e: 'Sparkling heart', color: '#FB7185' }
};

export const CREATIVE = [
  // 🎨 그림·상상
  { id: 'c_art1', cat: 'art', type: 'draw', g: [3, 6], title: '내가 만든 상상 동물', desc: '두 동물을 합친 새로운 동물을 그리고 이름을 붙여 보세요. (예: 고래+토끼 = 고토끼)' },
  { id: 'c_art2', cat: 'art', type: 'draw', g: [3, 6], title: '10년 뒤 내 방', desc: '미래의 내 방에는 어떤 신기한 물건이 있을까요? 설계도처럼 그려 보세요.' },
  { id: 'c_art3', cat: 'art', type: 'draw', g: [3, 6], title: '내 펫의 하루', desc: '내 펫이 하루 동안 무엇을 하는지 4컷 만화로 그려 보세요.' },
  { id: 'c_art4', cat: 'art', type: 'draw', g: [3, 6], title: '오늘 기분 날씨', desc: '오늘 내 기분을 날씨로 표현해 그려 보세요. (맑음? 소나기? 무지개?)' },
  { id: 'c_art5', cat: 'art', type: 'draw', g: [3, 6], title: '세상에 없는 발명품', desc: '숙제를 도와주는 발명품을 그리고, 버튼마다 기능을 적어 보세요.' },
  { id: 'c_art6', cat: 'art', type: 'draw', g: [3, 6], title: '동그라미 10개 변신', desc: '동그라미를 10개 그리고 각각 다른 물건(공, 해, 얼굴…)으로 바꿔 보세요.' },
  { id: 'c_art7', cat: 'art', type: 'draw', g: [4, 6], title: '내 이름 디자인', desc: '내 이름 글자를 좋아하는 것들로 꾸며서 로고처럼 디자인해 보세요.' },
  { id: 'c_art8', cat: 'art', type: 'photo', g: [3, 6], title: '집 안 물건 아트', desc: '집에 있는 물건 5개로 얼굴이나 동물 모양을 만들고 사진을 찍어 보세요.' },

  // ✍️ 글쓰기
  { id: 'c_wr1', cat: 'write', type: 'write', g: [3, 6], min: 60, title: '만약에 내가 투명인간이라면?', desc: '하루 동안 투명인간이 된다면 무엇을 할지 써 보세요.' },
  { id: 'c_wr2', cat: 'write', type: 'write', g: [3, 6], min: 60, title: '펫에게 쓰는 편지', desc: '내 펫에게 오늘 있었던 일을 편지로 알려 주세요.' },
  { id: 'c_wr3', cat: 'write', type: 'write', g: [3, 6], min: 50, title: '세 단어 이야기', desc: '"우산, 공룡, 비밀번호" 세 단어가 모두 들어간 짧은 이야기를 지어 보세요.' },
  { id: 'c_wr4', cat: 'write', type: 'write', g: [4, 6], min: 100, title: '오늘의 뉴스 기자', desc: '우리 집이나 학교에서 있었던 일을 신문 기사처럼 써 보세요. (누가, 언제, 어디서, 무엇을, 왜)' },
  { id: 'c_wr5', cat: 'write', type: 'write', g: [3, 6], min: 40, title: '읽은 책 한 줄 광고', desc: '최근 읽은 책을 친구에게 추천하는 광고 문구를 만들어 보세요.' },
  { id: 'c_wr6', cat: 'write', type: 'write', g: [5, 6], min: 120, title: '찬성 vs 반대', desc: '"초등학생도 스마트폰을 자유롭게 써야 한다" 에 대한 내 생각과 이유 2가지를 써 보세요.' },
  { id: 'c_wr7', cat: 'write', type: 'write', g: [3, 6], min: 50, title: '이야기 이어 쓰기', desc: '"문을 열었더니 거실이 온통 젤리로 변해 있었다…" 다음 이야기를 이어 써 보세요.' },
  { id: 'c_wr8', cat: 'write', type: 'write', g: [4, 6], min: 80, title: '내가 선생님이라면', desc: '내가 하루 선생님이 된다면 어떤 수업을 할지 계획을 써 보세요.' },
  { id: 'c_wr9', cat: 'write', type: 'write', g: [3, 6], min: 30, title: '삼행시 짓기', desc: '내 펫 이름이나 "달란트"로 삼행시를 지어 보세요.' },

  // 🔬 과학 실험
  { id: 'c_sc1', cat: 'science', type: 'photo', g: [3, 6], title: '떠요? 가라앉아요?', desc: '물그릇에 동전, 클립, 지우개, 귤을 넣기 전에 예상하고 결과를 사진으로 남겨 보세요.' },
  { id: 'c_sc2', cat: 'science', type: 'write', g: [3, 6], min: 40, title: '그림자 관찰', desc: '아침·저녁 그림자 길이가 어떻게 다른지 관찰하고 이유를 생각해 써 보세요.' },
  { id: 'c_sc3', cat: 'science', type: 'photo', g: [3, 6], title: '종이컵 전화기', desc: '종이컵 2개와 실로 전화기를 만들어 실을 팽팽하게/느슨하게 했을 때를 비교해 보세요.' },
  { id: 'c_sc4', cat: 'science', type: 'photo', g: [4, 6], title: '무지개 만들기', desc: '물컵과 햇빛(또는 손전등)으로 무지개를 만들어 사진을 찍어 보세요.' },
  { id: 'c_sc5', cat: 'science', type: 'write', g: [4, 6], min: 60, title: '얼음 빨리 녹이기 대회', desc: '얼음 3개를 서로 다른 방법(소금, 손, 그대로)으로 녹여 보고 결과와 이유를 써 보세요.' },
  { id: 'c_sc6', cat: 'science', type: 'photo', g: [3, 5], title: '콩나물 키우기 관찰', desc: '식물이나 화분 하나를 정해 오늘의 모습을 사진으로 기록해 보세요.' },
  { id: 'c_sc7', cat: 'science', type: 'write', g: [5, 6], min: 80, title: '왜 하늘은 파랄까?', desc: '스스로 가설을 세워 보고, 책이나 백과사전으로 찾아본 답을 비교해 써 보세요.' },
  { id: 'c_sc8', cat: 'science', type: 'photo', g: [3, 6], title: '정전기 마술', desc: '풍선을 머리에 문지른 뒤 종잇조각을 들어 올려 보세요. 사진으로 인증!' },

  // 🧩 두뇌 퍼즐
  { id: 'c_br1', cat: 'brain', type: 'quiz', g: [3, 6], title: '수 규칙 찾기', desc: '2, 4, 8, 16, ?  다음에 올 수는?', answers: ['32'], hint: '앞의 수에 같은 수를 곱해요.' },
  { id: 'c_br2', cat: 'brain', type: 'quiz', g: [3, 6], title: '넌센스 퀴즈', desc: '세상에서 가장 뜨거운 과일은?', answers: ['천도복숭아', '천도'], hint: '온도가 아주 높아요…' },
  { id: 'c_br3', cat: 'brain', type: 'quiz', g: [3, 6], title: '넌센스 사과 나누기', desc: '바구니에 사과 3개가 있어요. 3명이 사과를 1개씩 가져갔는데 바구니 안에 사과 1개가 그대로 남아 있어요! 마지막 사람은 사과를 어떻게 가져갔을까요? (○○째)', answers: ['바구니째', '바구니채', '바구니'], hint: '마지막 사람은 사과를 꺼내지 않았어요.' },
  { id: 'c_br4', cat: 'brain', type: 'quiz', g: [4, 6], title: '나이 퍼즐', desc: '형은 동생보다 4살 많고, 둘의 나이를 더하면 20살이에요. 형은 몇 살?', answers: ['12', '12살'], hint: '(20+4)÷2' },
  { id: 'c_br5', cat: 'brain', type: 'quiz', g: [3, 6], title: '수수께끼', desc: '먹으면 먹을수록 커지는 것은?', answers: ['나이'], hint: '해마다 하나씩!' },
  { id: 'c_br6', cat: 'brain', type: 'quiz', g: [4, 6], title: '시계 퍼즐', desc: '3시 정각에 시침과 분침이 이루는 작은 각도는 몇 도?', answers: ['90', '90도'], hint: '한 칸(1시간)은 30도' },
  { id: 'c_br7', cat: 'brain', type: 'quiz', g: [5, 6], title: '논리 추리', desc: 'A는 B보다 크고, C는 A보다 크다. 가장 작은 사람은?', answers: ['b', '비'], hint: '순서대로 줄을 세워 보세요.' },
  { id: 'c_br8', cat: 'brain', type: 'quiz', g: [3, 6], title: '도형 세기', desc: '정사각형을 가로 2칸, 세로 2칸으로 나누면 크고 작은 정사각형은 모두 몇 개?', answers: ['5', '5개'], hint: '작은 것 4개 + 큰 것 1개' },
  { id: 'c_br9', cat: 'brain', type: 'quiz', g: [5, 6], title: '수 규칙 심화', desc: '1, 1, 2, 3, 5, 8, 13, ?', answers: ['21'], hint: '앞의 두 수를 더해요 (피보나치)' },
  { id: 'c_br10', cat: 'brain', type: 'write', g: [3, 6], min: 15, title: '넌센스 상상 퀴즈', desc: '바다에서 가장 웃긴 물고기는 누구일까요? 이름을 지어 주고, 왜 웃긴지 이유를 문장으로 써 보세요. (예: 하하하마 - 웃음소리가 하하하라서)' },
  { id: 'c_br11', cat: 'brain', type: 'quiz', g: [4, 6], title: '거꾸로 계산', desc: '어떤 수에 3을 곱하고 5를 더했더니 26이 되었어요. 어떤 수는?', answers: ['7'], hint: '거꾸로: 26-5, 그 다음 ÷3' },
  { id: 'c_br12', cat: 'brain', type: 'quiz', g: [3, 6], title: '단어 퍼즐', desc: '"사과"의 "사"로 시작하는 동물 이름 하나!', answers: ['사자', '사슴', '사막여우', '사마귀', '사슴벌레', '사향고양이', '사향노루', '사냥개', '사모예드', '사랑앵무'], hint: '갈기가 멋진 동물?' },
  { id: 'c_br13', cat: 'brain', type: 'quiz', g: [5, 6], title: '비율 퀴즈', desc: '6학년 30명 중 40%가 안경을 써요. 안경 쓴 학생은 몇 명?', answers: ['12', '12명'], hint: '30 × 0.4' },
  { id: 'c_br14', cat: 'brain', type: 'quiz', g: [3, 5], title: '홀짝 퀴즈', desc: '1부터 10까지 홀수를 모두 더하면?', answers: ['25'], hint: '1+3+5+7+9' },

  // 💪 몸 튼튼
  { id: 'c_bd1', cat: 'body', type: 'check', g: [3, 6], title: '줄넘기 100개', desc: '쉬어도 좋아요! 모두 합쳐 100개 성공하기.' },
  { id: 'c_bd2', cat: 'body', type: 'check', g: [3, 6], title: '스트레칭 5분', desc: '목·어깨·허리·다리 스트레칭으로 공부 피로 풀기.' },
  { id: 'c_bd3', cat: 'body', type: 'check', g: [3, 6], title: '물 5컵 마시기', desc: '오늘 물을 5컵 이상 마셨나요?' },
  { id: 'c_bd4', cat: 'body', type: 'check', g: [3, 6], title: '플랭크 챌린지', desc: '플랭크 30초 × 3번 도전!' },
  { id: 'c_bd5', cat: 'body', type: 'check', g: [3, 6], title: '바른 자세 지킴이', desc: '공부할 때 허리 펴고 30분 버티기.' },
  { id: 'c_bd6', cat: 'body', type: 'check', g: [3, 6], title: '일찍 자기 약속', desc: '오늘은 정해진 시간에 잠자리에 들기 (내일 아침 체크!)' },
  { id: 'c_bd7', cat: 'body', type: 'check', g: [3, 6], title: '테니스·운동 복습', desc: '오늘 배운 운동 동작을 거울 앞에서 10번 연습하기.' },

  // 💗 마음 일기
  { id: 'c_ht1', cat: 'heart', type: 'write', g: [3, 6], min: 30, title: '감사한 일 3가지', desc: '오늘 고마웠던 일 3가지를 적어 보세요.' },
  { id: 'c_ht2', cat: 'heart', type: 'write', g: [3, 6], min: 30, title: '칭찬 한마디', desc: '가족 중 한 명에게 구체적인 칭찬을 해 주고, 무엇이라고 했는지 적어 보세요.' },
  { id: 'c_ht3', cat: 'heart', type: 'write', g: [3, 6], min: 40, title: '속상했던 일 다시 보기', desc: '오늘 속상했던 일과, 다음엔 어떻게 해 볼지 적어 보세요.' },
  { id: 'c_ht4', cat: 'heart', type: 'write', g: [3, 6], min: 30, title: '나의 장점 찾기', desc: '내가 잘하는 것 3가지와 그 증거를 적어 보세요.' },
  { id: 'c_ht5', cat: 'heart', type: 'check', g: [3, 6], title: '안아주기 미션', desc: '가족을 꼭 안아주며 "사랑해" 말하기.' },
  { id: 'c_ht6', cat: 'heart', type: 'write', g: [4, 6], min: 50, title: '1년 뒤 나에게', desc: '1년 뒤의 나에게 응원 편지를 써 보세요.' },

  // 🌍 세상 탐험
  { id: 'c_wd1', cat: 'world', type: 'write', g: [3, 6], min: 40, title: '나라 탐험', desc: '가 보고 싶은 나라 하나를 골라 수도, 유명한 음식, 인사말을 조사해 보세요.' },
  { id: 'c_wd2', cat: 'world', type: 'write', g: [4, 6], min: 50, title: '오늘의 뉴스 한 줄', desc: '뉴스나 신문에서 본 소식 하나와 내 생각을 써 보세요.' },
  { id: 'c_wd3', cat: 'world', type: 'quiz', g: [3, 6], title: '세계 수도 퀴즈', desc: '프랑스의 수도는?', answers: ['파리', 'paris'], hint: '에펠탑이 있는 곳' },
  { id: 'c_wd4', cat: 'world', type: 'quiz', g: [4, 6], title: '우리나라 퀴즈', desc: '한글을 만든 왕은?', answers: ['세종대왕', '세종'], hint: '만 원 지폐에 계신 분' },
  { id: 'c_wd5', cat: 'world', type: 'photo', g: [3, 6], title: '동네 탐험 사진', desc: '오늘 길에서 본 재미있는 간판이나 풍경을 찍어 보세요.' },
  { id: 'c_wd6', cat: 'world', type: 'quiz', g: [5, 6], title: '지구 퀴즈', desc: '지구에서 가장 넓은 바다는?', answers: ['태평양'], hint: '우리나라 동쪽 바다 너머!' },

  // 💰 경제 습관
  { id: 'c_mn1', cat: 'money', type: 'write', g: [3, 6], min: 30, title: '용돈 계획표', desc: '이번 주 용돈을 어디에 쓰고 얼마나 모을지 계획해 보세요.' },
  { id: 'c_mn2', cat: 'money', type: 'quiz', g: [3, 6], title: '거스름돈 계산', desc: '3,700원짜리 과자를 5,000원으로 사면 거스름돈은?', answers: ['1300', '1300원', '1,300원', '1,300'], hint: '5000 - 3700' },
  { id: 'c_mn3', cat: 'money', type: 'write', g: [4, 6], min: 40, title: '필요 vs 원함', desc: '갖고 싶은 물건 3개를 "꼭 필요한 것"과 "그냥 갖고 싶은 것"으로 나눠 보세요.' },
  { id: 'c_mn4', cat: 'money', type: 'quiz', g: [5, 6], title: '저금 퀴즈', desc: '매주 2,500원씩 모으면 8주 뒤에는 얼마?', answers: ['20000', '20000원', '20,000원', '2만원'], hint: '2500 × 8' },

  // 🗣️ 영어 말하기
  { id: 'c_en1', cat: 'english', type: 'speak', g: [3, 6], title: '영어로 자기소개', desc: '이 문장을 소리 내어 말해 보세요.', say: 'Hi, my name is ___. I like animals and games.' },
  { id: 'c_en2', cat: 'english', type: 'speak', g: [3, 6], title: '오늘의 영어 한 문장', desc: '따라 말해 보세요.', say: 'I finished my homework, so I can play now.' },
  { id: 'c_en3', cat: 'english', type: 'speak', g: [3, 6], title: '날씨 말하기', desc: '따라 말해 보세요.', say: 'It is cold today. Wear a warm jacket.' },
  { id: 'c_en4', cat: 'english', type: 'speak', g: [4, 6], title: '꿈 말하기', desc: '따라 말해 보세요.', say: 'When I grow up, I want to be a scientist.' },
  { id: 'c_en5', cat: 'english', type: 'speak', g: [5, 6], title: '의견 말하기', desc: '따라 말해 보세요.', say: 'In my opinion, reading every day makes us smarter.' },
  { id: 'c_en6', cat: 'english', type: 'speak', g: [3, 6], title: '펫 소개하기', desc: '따라 말해 보세요.', say: 'This is my pet. It is cute and very strong.' },
  { id: 'c_en7', cat: 'english', type: 'write', g: [4, 6], min: 20, title: '영어 일기 3줄', desc: '오늘 한 일을 영어 3문장으로 써 보세요. (I ate…, I played…, I felt…)' },

  // 🎵 음악·예술
  { id: 'c_mu1', cat: 'music', type: 'check', g: [3, 6], title: '악기 연습 15분', desc: '첼로·피아노·리코더 등 악기 연습 15분!' },
  { id: 'c_mu2', cat: 'music', type: 'write', g: [3, 6], min: 30, title: '노래 가사 바꾸기', desc: '좋아하는 노래 한 소절을 우리 가족 이야기로 바꿔 써 보세요.' },
  { id: 'c_mu3', cat: 'music', type: 'check', g: [3, 6], title: '클래식 1곡 감상', desc: '클래식 한 곡을 끝까지 듣고 떠오르는 장면을 가족에게 말해 주세요.' },
  { id: 'c_mu4', cat: 'music', type: 'photo', g: [3, 6], title: '종이접기 작품', desc: '종이접기로 동물이나 꽃을 하나 완성하고 사진 찍기.' },

  // 💻 코딩·논리
  { id: 'c_cd1', cat: 'code', type: 'write', g: [3, 6], min: 40, title: '라면 끓이기 알고리즘', desc: '라면 끓이는 과정을 순서(1, 2, 3…)대로 로봇에게 명령하듯 써 보세요.' },
  { id: 'c_cd2', cat: 'code', type: 'quiz', g: [4, 6], title: '반복문 퍼즐', desc: '"앞으로 2칸, 오른쪽 돌기"를 4번 반복하면 로봇이 그리는 도형은?', answers: ['정사각형', '사각형', '네모'], hint: '같은 길이, 같은 방향 회전 4번' },
  { id: 'c_cd3', cat: 'code', type: 'quiz', g: [5, 6], title: '이진수 퀴즈', desc: '이진수 101은 십진수로 얼마?', answers: ['5'], hint: '4 + 0 + 1' },
  { id: 'c_cd4', cat: 'code', type: 'draw', g: [3, 6], title: '보물지도 명령어', desc: '방 지도를 그리고, 보물까지 가는 방향 명령(↑→↓←)을 적어 보세요.' },

  // 🏠 집안일 영웅
  { id: 'c_hm1', cat: 'home', type: 'photo', g: [3, 6], title: '책상 정리 Before/After', desc: '정리 후 내 책상 사진을 찍어 인증하세요.' },
  { id: 'c_hm2', cat: 'home', type: 'check', g: [3, 6], title: '식사 준비 돕기', desc: '수저 놓기나 설거지 돕기 중 하나!' },
  { id: 'c_hm3', cat: 'home', type: 'check', g: [3, 6], days: [0, 1, 2, 3, 4], title: '내일 가방 스스로 싸기', desc: '시간표 보고 준비물까지 스스로 챙기기.' },
  { id: 'c_hm4', cat: 'home', type: 'check', g: [3, 6], title: '빨래 개기 도전', desc: '내 옷을 직접 개서 서랍에 넣기.' },
  { id: 'c_hm5', cat: 'home', type: 'photo', g: [4, 6], title: '요리 보조 셰프', desc: '가족과 간단한 요리(샌드위치, 계란 요리 등)를 만들고 사진 찍기.' }
];

// 기본 생활 습관 (매일)
export const DAILY_HABITS = {
  default: [
    { id: 'h_bag', title: '내일 가방·준비물 챙기기', e: 'Wrapped gift' },
    { id: 'h_read', title: '책 20분 읽기', e: 'Open book' }
  ]
};
