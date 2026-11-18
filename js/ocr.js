// Tesseract.js v7 브라우저 OCR + iPad 라이브 텍스트 일괄 파싱 엔진
import { getTodayKey } from '../data/presets.js';

const SUBJECT_KEYWORDS = [
  { key: '수학', words: ['수학', '쎈', '계산법', '기적', '연산', '디딤돌', '최상위', '큐브', 'math'] },
  { key: '영어', words: ['영어', '리딩', '파닉스', '문법', '그래머', '단어', 'reading', 'english', 'phonics', 'word'] },
  { key: '국어', words: ['국어', '독해', '비문학', '받아쓰기', '어휘', '매3비', '한자', '글쓰기'] },
  { key: '과학', words: ['과학', '실험', '오투', 'science'] },
  { key: '사회', words: ['사회', '한국사', '역사'] },
  { key: '학습지', words: ['눈높이', '구몬', '빨간펜', '학습지', '재능'] }
];

function guessSubject(line) {
  const lower = line.toLowerCase();
  for (const s of SUBJECT_KEYWORDS) {
    if (s.words.some(w => lower.includes(w))) return s.key;
  }
  return '숙제';
}

// 요일 매핑: 오늘 기준 다음 해당 요일 날짜 키 찾기
function resolveDayOffset(dayChar) {
  const map = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
  if (!(dayChar in map)) return 0;
  const targetDow = map[dayChar];
  const todayDow = new Date().getDay();
  let diff = targetDow - todayDow;
  if (diff < 0) diff += 7;
  return diff;
}

// OCR 추출 텍스트 또는 iPad 라이브텍스트 붙여넣기 텍스트 -> 숙제 항목 배열로 파싱
export function parseHomeworkText(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.replace(/^[\-\*\u2022\d\.\)\]]+\s*/, '').trim())
    .filter(l => l.length >= 2);

  let currentDateKey = getTodayKey(0);
  const items = [];

  for (const line of lines) {
    // 요일 헤더 또는 줄 앞 요일 표기 감지: 예) "월:", "[화]", "수요일"
    const dayMatch = line.match(/^(?:\[)?([월화수목금토일])(?:요일)?(?:\]|:|\s)+(.+)?$/);
    if (dayMatch) {
      const offset = resolveDayOffset(dayMatch[1]);
      currentDateKey = getTodayKey(offset);
      const rest = (dayMatch[2] || '').trim();
      if (!rest) continue;
      items.push(...splitCommaTasks(rest, currentDateKey));
      continue;
    }

    // "11/19" 또는 "11월 19일" 날짜 감지
    const dateMatch = line.match(/^(\d{1,2})[\/월\.\s]+(\d{1,2})일?(?:\s|:|-)+(.+)?$/);
    if (dateMatch) {
      const now = new Date();
      const m = String(Number(dateMatch[1])).padStart(2, '0');
      const d = String(Number(dateMatch[2])).padStart(2, '0');
      currentDateKey = `${now.getFullYear()}-${m}-${d}`;
      const rest = (dateMatch[3] || '').trim();
      if (!rest) continue;
      items.push(...splitCommaTasks(rest, currentDateKey));
      continue;
    }

    items.push(...splitCommaTasks(line, currentDateKey));
  }

  return items;
}

function splitCommaTasks(text, dateKey) {
  const parts = text.split(/,|·|\//).map(s => s.trim()).filter(s => s.length >= 2);
  const out = [];
  for (const part of parts) {
    // 페이지 표기 정규화: "p 42 ~ 45" -> "(p.42~45)"
    let clean = part.replace(/\s+/g, ' ');
    const pageMatch = clean.match(/(?:p\.?|페이지|쪽)?\s*(\d{1,3})\s*(?:~|-|부터)\s*(\d{1,3})\s*(?:p|쪽|페이지)?/i);
    let title = clean;
    if (pageMatch && !clean.includes('(')) {
      const withoutPage = clean.replace(pageMatch[0], '').trim();
      if (withoutPage.length >= 2) {
        title = `${withoutPage} (p.${pageMatch[1]}~${pageMatch[2]})`;
      }
    }
    out.push({
      id: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dateKey,
      subject: guessSubject(title),
      title,
      xp: 20,
      selected: true
    });
  }
  return out;
}

// 이미지 대비/흑백 전처리 (인쇄물 OCR 인식률 향상)
async function preprocessImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1600;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Grayscale + mild contrast boost
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const contrast = 1.28;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const c = Math.max(0, Math.min(255, (gray - 128) * contrast + 128));
        d[i] = d[i + 1] = d[i + 2] = c;
      }
      ctx.putImageData(imgData, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// Tesseract.js v7 온디맨드 로드 + 한국어/영어 OCR 실행
export async function runBrowserOcr(file, onProgress) {
  if (typeof window.Tesseract === 'undefined') {
    onProgress?.('OCR 엔진(Tesseract.js) 불러오는 중...', 0.1);
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Tesseract.js CDN 로드 실패 (인터넷 연결을 확인해 주세요)'));
      document.head.appendChild(s);
    });
  }

  onProgress?.('사진 화질 보정 중...', 0.2);
  const processedUrl = await preprocessImageToDataUrl(file);

  onProgress?.('한국어·영어 글자 인식 모델 준비 중...', 0.3);
  const worker = await window.Tesseract.createWorker(['kor', 'eng'], 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0',
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress?.(`글자 읽는 중 (${Math.round((m.progress || 0) * 100)}%)`, 0.35 + (m.progress || 0) * 0.65);
      }
    }
  });

  try {
    const { data } = await worker.recognize(processedUrl);
    onProgress?.('인식 완료!', 1);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}
