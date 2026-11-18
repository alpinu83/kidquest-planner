# KidQuest · Bella & Wanny 아이패드 성장형 학습 스케줄러 (PWA)

초등 6학년(Bella)과 초등 3학년(Wanny) 아이들이 매일 숙제·영단어·학원 시간표를 즐겁게 관리하고, 캐릭터를 5단계로 키워 Collection Room에 수집하는 아이패드 설치형 웹 앱(PWA)입니다.

## 주요 기능

1. **아이별 프로필 로그인 & 맞춤 화면**
   - `Bella (초등 6학년)` / `Wanny (초등 3학년)` 프로필 선택 진입
   - 나이에 맞춘 라벤더 / 민트 테마와 개별 영단어 수준·시간표·캐릭터 분리 관리
2. **캐릭터 성장 & 감점 후퇴 & Collection Room**
   - 6종의 커스텀 SVG 진화 캐릭터 (블레이즈 드래곤, 루미나 유니콘, 볼트 메카봇, 모스 여우, 아쿠아 샤크, 루나 냥이)
   - Stage 1(신비한 알) → Stage 5(레전드 마스터, 220 XP) 달성 시 **Collection Room**에 영구 저장
   - 부모 모드에서 숙제 미완료/생활습관 감점 반영 시 경험치 차감 및 **성장 단계 실제 후퇴** 구현
3. **숙제 입력 3종 하이브리드 방식 (부모님의 입력 부담 최소화)**
   - **문제집 자동 배정 마스터**: 교재명, 시작 페이지, 하루 분량, 요일만 등록하면 매일 해당 페이지(`p.44~45`) 자동 생성
   - **사진 OCR 스캔 (`Tesseract.js` v7)**: 주간 계획표나 목차 사진을 찍으면 한국어/영어를 인식해 날짜·과목·페이지별 숙제로 파싱
   - **일괄 붙여넣기 (iPad 라이브 텍스트 호환)**: 메모/카톡 일정을 붙여넣으면 한 번에 등록
4. **하교 후 학원·학습지 시간표 & 내일 날씨 알림**
   - 요일별 하교 후 학원·방문학습지 타임라인 및 준비물 메모
   - **Open-Meteo API** 기반 내일 기온·강수확률·일교차 분석 후 우산·외투 준비 알림 배너 표시
5. **맞춤형 영어단어 학습 아레나 (20단어 세션 + 주간 오답 복습)**
   - Level 1(초3 기초) ~ Level 5(중등 심화) 총 248개 검증 단어 + 부모 커스텀 단어 추가
   - 3종 혼합 챌린지 / 4지선다 뜻 고르기 / Word & Sentence Scramble(문장 만들기) / 주관식 스펠링 쓰기
   - **Web Speech API** 원어민 발음 듣기 + 오답 자동 누적 및 설정된 요일(예: 토요일) **주간 오답 집중 복습**

## 아이패드에 앱으로 설치하는 방법 (GitHub Pages 권장)

1. GitHub에 새 저장소(예: `kidquest-planner`)를 만들고 이 폴더의 모든 파일을 업로드(Push)합니다.
2. GitHub 저장소 **Settings → Pages → Source: Deploy from a branch (`main` / `root`)** 를 켜면 `https://<내아이디>.github.io/kidquest-planner/` 주소가 생성됩니다.
3. 아이패드 **Safari**에서 해당 주소를 열고, 상단 **공유 버튼(네모+위 화살표) → '홈 화면에 추가'** 를 누르면 앱 아이콘과 함께 전체 화면 앱으로 설치됩니다.

## 매일 저녁 푸시 알림 받기 (선택 · GitHub Actions + ntfy)

1. 아이패드 App Store에서 무료 오픈소스 앱 **ntfy** 를 설치하고 나만의 비밀 토픽(예: `bellawanny-weather-2026`)을 구독합니다.
2. GitHub 저장소 **Settings → Secrets and variables → Actions** 에서 Secret `NTFY_TOPIC` 에 해당 토픽명을 등록하면 매일 밤 8시(KST)에 내일 우산·외투 알림이 아이패드로 전송됩니다.

## 활용한 오픈소스 및 공개 API
- **Open-Meteo Forecast API** (무료, API 키 불필요)
- **Tesseract.js v7** (브라우저 내장 WebAssembly OCR)
- **jhseo1211/open-english-korean-dict** (CC-BY-SA 4.0, 발음기호 IPA 및 CEFR 레벨 메타데이터 참조)
- **canvas-confetti** (MIT, 학습 완료 축하 애니메이션)
- **ntfy.sh** (Apache-2.0/GPL, 선택형 iPad 푸시 알림 연동)
