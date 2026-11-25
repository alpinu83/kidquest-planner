// 영어 말하기 채점 엔진 (iPad Safari · 홈 화면 앱 대응)
// 1) 음성 인식(webkitSpeechRecognition): 중간 결과까지 모아서 채점 (iOS는 최종 결과 없이 끝나는 경우가 많음)
// 2) 음성 인식이 막히거나 안 되는 기기: 녹음(MediaRecorder)해서 제출 → 부모님이 듣고 확인
const W = typeof window !== 'undefined' ? window : {};
export const SR = W.SpeechRecognition || W.webkitSpeechRecognition || null;
const BLOCK_KEY = 'kq_sr_blocked';

export function srUsable() {
  try { return !!SR && sessionStorage.getItem(BLOCK_KEY) !== '1'; } catch (_) { return !!SR; }
}
export function canRecord() {
  return !!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && W.MediaRecorder);
}

export const ERR_KO = {
  'not-allowed': '마이크 사용이 허용되지 않았어요. 설정 → Safari(또는 KidQuest) → 마이크를 "허용"으로 바꿔 주세요. 지금은 녹음해서 제출할 수 있어요.',
  'service-not-allowed': '이 기기(홈 화면 앱)에서는 음성 인식을 쓸 수 없어요. 녹음해서 제출하면 부모님이 확인해 줘요.',
  'no-speech': '목소리가 안 들렸어요. 마이크 버튼을 누르고 바로, 조금 크게 말해 보세요.',
  'audio-capture': '마이크를 찾을 수 없어요. 다른 앱이 마이크를 쓰고 있는지 확인해 주세요.',
  network: '인터넷 연결이 약해서 채점을 못 했어요. 잠시 뒤 다시 해 보세요.',
  aborted: '중간에 멈췄어요. 다시 눌러 주세요.',
  unsupported: '이 기기에서는 음성 인식이 안 돼요. 녹음해서 제출해 주세요.',
  'start-failed': '마이크를 시작하지 못했어요. 잠시 뒤 다시 눌러 주세요.'
};

// 한 번 듣기 → { ok, alts: [문장 후보들], error }
export function listenOnce({ lang = 'en-US', maxMs = 9000, onInterim } = {}) {
  return new Promise((resolve) => {
    if (!SR) return resolve({ ok: false, alts: [], error: 'unsupported' });
    try { W.speechSynthesis && W.speechSynthesis.cancel(); } catch (_) {}
    let r;
    try { r = new SR(); } catch (_) { return resolve({ ok: false, alts: [], error: 'unsupported' }); }
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 5;
    let alts = [];
    let err = null;
    let finished = false;
    let timer = null;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { r.abort(); } catch (_) {}
      resolve({ ok: alts.length > 0, alts, error: alts.length ? null : err || 'no-speech' });
    };
    r.onresult = (e) => {
      let joined = '';
      for (let i = 0; i < e.results.length; i++) joined += e.results[i][0].transcript + ' ';
      const list = [joined.trim()];
      const last = e.results[e.results.length - 1];
      if (e.results.length === 1) for (let j = 1; j < last.length; j++) list.push(last[j].transcript);
      alts = list.filter(Boolean);
      if (onInterim) onInterim(alts[0]);
      if (last.isFinal) setTimeout(done, 250);
    };
    r.onerror = (e) => {
      err = (e && e.error) || 'error';
      if (err === 'not-allowed' || err === 'service-not-allowed') { try { sessionStorage.setItem(BLOCK_KEY, '1'); } catch (_) {} }
      done();
    };
    r.onend = () => setTimeout(done, 150);
    timer = setTimeout(() => { try { r.stop(); } catch (_) {} setTimeout(done, 900); }, maxMs);
    try { r.start(); } catch (_) { err = 'start-failed'; done(); }
  });
}

// ---------- 채점 ----------
const CONTRACTIONS = { "it's": 'it is', "i'm": 'i am', "don't": 'do not', "can't": 'can not', "cannot": 'can not', "i'll": 'i will', "you're": 'you are', "we're": 'we are', "they're": 'they are', "that's": 'that is', "what's": 'what is', "let's": 'let us', "isn't": 'is not', "doesn't": 'does not', "didn't": 'did not', "won't": 'will not', "i've": 'i have', "there's": 'there is', "he's": 'he is', "she's": 'she is' };
const NUMS = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve' };
export function words(s) {
  let t = String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/_+/g, ' ');
  t = t.replace(/\b[a-z]+'[a-z]+\b/g, (m) => CONTRACTIONS[m] || m.replace(/'/g, ''));
  return t.replace(/[^a-z0-9\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean).map((w) => NUMS[w] || w);
}
function lev(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const close = (x, w) => x === w || (w.length >= 4 && lev(x, w) <= 1) || (w.length >= 7 && lev(x, w) <= 2) || (w.length >= 3 && x.replace(/s$/, '') === w.replace(/s$/, ''));

// 목표 문장의 단어 중 몇 %를 말했는지 + 단어별 결과
export function scoreSpeech(alts, target) {
  const tw = words(target);
  let best = { pct: 0, hit: tw.map(() => false), heard: alts[0] || '' };
  if (!tw.length) return best;
  for (const h of alts) {
    const hw = words(h);
    const used = new Set();
    const hit = tw.map((w) => { const k = hw.findIndex((x, i) => !used.has(i) && close(x, w)); if (k >= 0) { used.add(k); return true; } return false; });
    const pct = hit.filter(Boolean).length / tw.length;
    if (pct > best.pct) best = { pct, hit, heard: h };
  }
  return best;
}
export const passMark = (grade) => (Number(grade) <= 4 ? 0.5 : 0.6);

// ---------- 녹음 (음성 인식 대체) ----------
export async function startRecording(maxMs = 12000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'];
  const mimeType = types.find((t) => W.MediaRecorder.isTypeSupported && W.MediaRecorder.isTypeSupported(t));
  const rec = new W.MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
  const chunks = [];
  const t0 = Date.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/mp4' });
      const fr = new FileReader();
      fr.onload = () => resolve({ dataUrl: String(fr.result), ms: Date.now() - t0, size: blob.size });
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    };
  });
  rec.start(500);
  const timer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, maxMs);
  return {
    stop() { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); return stopped; },
    stopped
  };
}
export const isAudio = (src) => typeof src === 'string' && src.startsWith('data:audio');
