import { VOCAB_WORDS } from '../data/vocab.js';
import { getTodayKey } from '../data/presets.js';

export function getAllVocabPool(state, level) {
  const custom = (state.customWords || []).filter(w => !level || w.level === level);
  const base = level ? VOCAB_WORDS.filter(w => w.level === level) : VOCAB_WORDS;
  return [...custom, ...base];
}

// 수준에 맞는 20개 단어 출제 (미학습 단어 & 틀린 적 있는 단어 우선)
export function pickDaily20Words(state, kid, count = 20) {
  const pool = getAllVocabPool(state, kid.vocabLevel || 2);
  const mastered = new Set(kid.vocabStats?.masteredIds || []);
  const wrongIds = new Set((kid.vocabStats?.wrongBank || []).map(w => w.wordId));

  const priority = [];
  const fresh = [];
  const rest = [];

  for (const w of pool) {
    if (wrongIds.has(w.id)) priority.push(w);
    else if (!mastered.has(w.id)) fresh.push(w);
    else rest.push(w);
  }

  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const combined = [...shuffle(priority), ...shuffle(fresh), ...shuffle(rest)];
  return combined.slice(0, Math.min(count, combined.length));
}

// 주간 오답 복습용 단어 추출
export function pickWrongReviewWords(state, kid) {
  const wrongBank = kid.vocabStats?.wrongBank || [];
  const all = getAllVocabPool(state, null);
  const map = new Map(all.map(w => [w.id, w]));
  return wrongBank
    .map(entry => ({ entry, word: map.get(entry.wordId) }))
    .filter(x => x.word)
    .sort((a, b) => b.entry.wrongCount - a.entry.wrongCount)
    .map(x => x.word);
}

export function buildChoiceOptions(targetWord, state) {
  const pool = getAllVocabPool(state, targetWord.level);
  const distractors = pool
    .filter(w => w.id !== targetWord.id && w.meaning !== targetWord.meaning)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  return [targetWord, ...distractors].sort(() => Math.random() - 0.5);
}

// 문장 스크램블용 토큰 생성 (문장 내 단어들을 섞어 순서대로 맞추기)
export function buildSentenceTokens(sentence) {
  const rawTokens = sentence.trim().split(/\s+/);
  // 단순 배열 셔플이 원래 순서와 같아지지 않도록 보장
  let shuffled = rawTokens.map((text, idx) => ({ id: `${idx}_${text}`, text, origIdx: idx }));
  if (shuffled.length > 1) {
    for (let tries = 0; tries < 6; tries++) {
      shuffled = [...shuffled].sort(() => Math.random() - 0.5);
      if (shuffled.some((t, i) => t.origIdx !== i)) break;
    }
  }
  return { expected: rawTokens, shuffled };
}

// 단어 스펠링 스크램블용 글자 타일 생성
export function buildLetterTiles(word) {
  const letters = word.toLowerCase().split('');
  let shuffled = letters.map((ch, idx) => ({ id: `${idx}_${ch}`, ch, origIdx: idx }));
  if (shuffled.length > 1) {
    for (let tries = 0; tries < 6; tries++) {
      shuffled = [...shuffled].sort(() => Math.random() - 0.5);
      if (shuffled.some((t, i) => t.origIdx !== i)) break;
    }
  }
  return { expected: letters, shuffled };
}

export function recordVocabAnswer(kid, wordId, isCorrect, isReviewMode = false) {
  if (!kid.vocabStats) kid.vocabStats = { masteredIds: [], wrongBank: [], sessionsDone: 0 };
  const stats = kid.vocabStats;

  if (isCorrect) {
    if (!stats.masteredIds.includes(wordId)) {
      stats.masteredIds.push(wordId);
    }
    if (isReviewMode) {
      // 주간 복습에서 맞히면 오답 횟수 차감 -> 0이 되면 졸업!
      const idx = stats.wrongBank.findIndex(w => w.wordId === wordId);
      if (idx !== -1) {
        stats.wrongBank[idx].wrongCount -= 1;
        if (stats.wrongBank[idx].wrongCount <= 0) {
          stats.wrongBank.splice(idx, 1);
        }
      }
    }
  } else {
    const existing = stats.wrongBank.find(w => w.wordId === wordId);
    if (existing) {
      existing.wrongCount = Math.min(5, existing.wrongCount + 1);
      existing.lastWrong = getTodayKey(0);
    } else {
      stats.wrongBank.push({
        wordId,
        wrongCount: 1,
        lastWrong: getTodayKey(0)
      });
    }
  }
}

export function speakEnglish(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-US';
    utter.rate = 0.88;
    window.speechSynthesis.speak(utter);
    return true;
  } catch (_) {
    return false;
  }
}
