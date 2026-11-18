# KidQuest 2.0 · 우리 가족 성장 플래너 (PWA)

Bella(초6)와 Wanny(초3)가 숙제·창의 미션·영단어를 하면 **달란트**를 받고, 달란트로 먹이를 사서 **3D 펫을 알 → 아기 → 어린이 → 청소년 → 어른 → 전설**까지 키우는 가족 학습 앱입니다.
아이 패드 2대와 부모님 폰이 **실시간으로 같은 데이터**를 봅니다.

## 무엇이 달라졌나 (v1 → v2)

| 영역 | v1 (Gemini) | v2 |
|---|---|---|
| 데이터 | 기기별 localStorage | Firebase Realtime DB 실시간 동기화 + 오프라인 큐 |
| 보상 | 캐릭터 XP 직접 증가 | 미션 → **달란트** → 먹이 상점 → 펫 성장 (장부 기반) |
| 펫 | SVG 6종 | Fluent 3D 13종 × 6단계 외형 변화, 전설 연출(왕관·오라·파티클), 부화/진화 애니메이션, 배고픔·잠 상태 |
| 미션 | 숙제 체크 | 숙제 + **창의 미션 80여 개**(그림판, 글쓰기, 사진 인증, 과학 실험, 두뇌 퍼즐, 영어 말하기 채점 등) |
| 영단어 | 20문제 퀴즈 | 라이트너 간격반복, 플래시카드, 5가지 문제 유형, 게임 4종(스피드·짝맞추기·스펠링 비·문장 퍼즐), 단어장, 약 400단어 |
| 부모 | 설정 화면 | 대시보드(아이별 진행률·작품 갤러리·하트 칭찬·7일 차트·활동 피드), 달란트 장부, 시간표 편집, QR 기기 연결 |
| UI | 단일 화면 | iPad 가로: 사이드바 / 폰: 하단 탭, 디자인 시스템(Pretendard, Lucide) |

## 기기 연결
1. 부모 관리 → **설정·기기 연결**에서 QR 코드를 찍거나 링크를 카톡으로 보내 각 기기에서 엽니다.
2. iPad Safari: **공유 → 홈 화면에 추가** 하면 앱처럼 실행됩니다.
3. 가족 코드는 주소의 `#family=...` 부분입니다. 가족 외부에 공유하지 마세요.

## 달란트 규칙
- 문제집/숙제 +2, 생활 습관 +1, 창의 미션 +3, 오늘의 단어 +3(만점 +1), 단어 게임 +1(하루 4회), 하루 전부 완료 +3, 7일 연속 +5
- 먹이: 사과 1(10XP) ~ 보석 사탕 12(170XP). 펫마다 **최애 간식은 1.5배**
- 부모님은 칭찬/감점(선택 시 펫 경험치도 차감), 작품에 하트(+1)를 줄 수 있어요.

## 구조
```
index.html · styles/app.css · sw.js · manifest.webmanifest
js/app.js        라우팅, 프로필 선택, PIN, 가족 연결
js/store.js      Firebase REST + SSE 실시간 동기화, 오프라인 큐, 미디어 업로드
js/model.js      달란트 장부, 펫 성장, 숙제/미션/단어 보상 로직
js/ui/*.js       kid(홈·펫·시간표), missions, vocab, parent, pet(무대·진화 연출), core
data/*.js        펫 도감, 먹이·보상, 창의 미션, 단어
vendor/*         Preact+htm, canvas-confetti, qrcode-generator, Lucide 아이콘
assets/emoji/*   Microsoft Fluent 3D Emoji
```

## 오픈소스 · 라이선스
- [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (MIT) — 펫·먹이·UI 3D 이미지
- [Preact](https://github.com/preactjs/preact) + [htm](https://github.com/developit/htm) (MIT)
- [Lucide](https://github.com/lucide-icons/lucide) (ISC) — 아이콘
- [Pretendard](https://github.com/orioncactus/pretendard) (OFL) — 폰트
- [canvas-confetti](https://github.com/catdad/canvas-confetti) (ISC)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT)
- [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) — 숙제표 사진 OCR
- Open-Meteo API — 내일 날씨·준비물 알림
- 단어 IPA/CEFR 메타데이터: jhseo1211/open-english-korean-dict (CC-BY-SA 4.0)

## 매일 저녁 날씨 푸시 (선택)
GitHub Actions `daily-weather-alert.yml` + [ntfy](https://ntfy.sh) — Secret `NTFY_TOPIC` 등록 시 매일 20시 알림.
