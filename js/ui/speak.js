// 영어 듣고 따라 말하기 공통 화면 (창의 미션 · 영단어 아레나 게임에서 같이 사용)
import { html, useState, useEffect, useRef, Icon, Emo } from './core.js';
import * as SP from '../speech.js';
import { speak, sfx, vibrate } from '../util.js';

export function SpeakTrainer({ target, grade, onPass, passLabel = '완료!', allowRecord = false, onRecorded, onSkip, compact = false }) {
  const clean = String(target || '').replace(/_{2,}/g, ' ').replace(/\s+/g, ' ').trim();
  const tw = String(target || '').split(/\s+/).filter(Boolean);
  const mark = SP.passMark(grade);
  const [phase, setPhase] = useState('idle'); // idle | listening | result | recording | recorded
  const [interim, setInterim] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [tries, setTries] = useState(0);
  const [usable, setUsable] = useState(SP.srUsable());
  const [rec, setRec] = useState(null);
  const [recSec, setRecSec] = useState(0);
  const recRef = useRef(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; if (recRef.current) recRef.current.stop(); }, []);
  useEffect(() => { if (phase !== 'recording') return; const t = setInterval(() => setRecSec((s) => s + 1), 1000); return () => clearInterval(t); }, [phase]);

  async function listen() {
    if (phase === 'listening') return;
    setErr(null); setInterim(''); setPhase('listening');
    const r = await SP.listenOnce({ onInterim: (t) => alive.current && setInterim(t) });
    if (!alive.current) return;
    setTries((n) => n + 1);
    if (!r.ok) {
      setErr(r.error); setPhase('idle'); setUsable(SP.srUsable()); sfx('bad');
      return;
    }
    const s = SP.scoreSpeech(r.alts, clean);
    setRes(s); setPhase('result');
    if (s.pct >= mark) sfx('good'); else { sfx('bad'); vibrate(30); }
  }
  async function startRec() {
    setErr(null);
    try {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
      recRef.current = await SP.startRecording(12000);
      setRecSec(0); setPhase('recording');
      recRef.current.stopped.then((out) => { if (!alive.current) return; recRef.current = null; if (out && out.size > 1500) { setRec(out); setPhase('recorded'); } else { setErr('no-speech'); setPhase('idle'); } });
    } catch (e) {
      setErr('not-allowed'); setPhase('idle');
    }
  }
  const passed = res && res.pct >= mark;
  const showRecord = allowRecord && SP.canRecord() && (!usable || tries >= 2 || err === 'not-allowed' || err === 'service-not-allowed');
  const noWay = !usable && !(allowRecord && SP.canRecord());

  // 단어별 결과 표시 (___ 는 자유롭게 말하는 칸)
  let k = 0;
  const wordsView = tw.map((w, i) => {
    if (/^_+[.,!?]*$/.test(w)) return html`<span key=${i} style="color:var(--text-3)">(내 이름)</span> `;
    const n = SP.words(w).length;
    const ok = res ? res.hit.slice(k, k + n).every(Boolean) : null;
    k += n;
    return html`<span key=${i} style=${ok == null ? '' : ok ? 'color:var(--good)' : 'color:var(--bad);text-decoration:underline wavy'}>${w}</span> `;
  });

  return html`<div class="stack" style="gap:12px">
    <div class="card flat" style=${`text-align:center;font-size:${compact ? 26 : 22}px;font-weight:800;line-height:1.45`}>${wordsView}</div>
    ${/_{2,}/.test(target) && html`<div class="tiny muted" style="text-align:center">___ 자리에는 내 이름을 넣어서 말해요</div>`}
    <div class="row wrap" style="justify-content:center">
      <button class="btn" onClick=${() => speak(clean)}><${Icon} name="volume-2" size=${18} />원어민 발음 듣기</button>
      <button class="btn" onClick=${() => speak(clean, 'en-US', 0.6)}><${Icon} name="headphones" size=${18} />천천히</button>
      ${usable && phase !== 'recording' && html`<button class=${'btn ' + (phase === 'listening' ? 'danger' : 'primary')} onClick=${listen}><${Icon} name="mic" size=${18} />${phase === 'listening' ? '듣는 중… 말해 보세요' : tries ? '다시 말하기' : '말하고 채점받기'}</button>`}
    </div>
    ${phase === 'listening' && html`<div class="tip" style="background:#EEF2FF"><${Emo} name="Speaking head" size=${22} /><div>${interim ? html`들리는 말: <b>${interim}</b>` : '마이크가 켜졌어요. 문장을 또박또박 말해 보세요!'}</div></div>`}
    ${err && html`<div class="tip" style="background:var(--warn-soft)"><${Emo} name="Thinking face" size=${22} /><div class="small">${SP.ERR_KO[err] || '다시 한 번 해 볼까요? (' + err + ')'}</div></div>`}
    ${res && phase === 'result' && html`<div class="tip" style=${`background:${passed ? 'var(--good-soft)' : 'var(--bad-soft)'}`}><${Emo} name=${passed ? 'Hundred points' : 'Thinking face'} size=${24} /><div>
      <div>들린 문장: <b>${res.heard}</b></div>
      <div class="small">정확도 <b>${Math.round(res.pct * 100)}%</b> ${passed ? '· 통과!' : `· ${Math.round(mark * 100)}% 이상이면 통과 (빨간 단어를 다시 연습해요)`}</div>
    </div></div>`}
    ${passed && html`<button class="btn primary lg" onClick=${() => onPass({ heard: res.heard, pct: res.pct })}><${Icon} name="check" size=${20} />${passLabel}</button>`}
    ${phase === 'recording' && html`<div class="stack" style="align-items:center"><div class="badge bad" style="height:34px;font-size:16px">● 녹음 중 ${recSec}초</div><button class="btn primary lg" onClick=${() => recRef.current && recRef.current.stop()}><${Icon} name="check" size=${18} />다 말했어요 (녹음 끝)</button></div>`}
    ${phase === 'recorded' && rec && html`<div class="stack">
      <audio controls src=${rec.dataUrl} style="width:100%"></audio>
      <div class="row wrap"><button class="btn" onClick=${startRec}><${Icon} name="rotate-ccw" size=${18} />다시 녹음</button><button class="btn primary grow" onClick=${() => onRecorded && onRecorded(rec)}><${Icon} name="send" size=${18} />녹음 제출 (부모님이 들어요)</button></div>
    </div>`}
    ${showRecord && phase !== 'recording' && phase !== 'recorded' && !passed && html`<button class="btn" onClick=${startRec}><${Icon} name="mic" size=${18} />${usable ? '채점이 잘 안 되면: 녹음해서 제출하기' : '녹음해서 제출하기'}</button>`}
    ${noWay && html`<div class="tip small"><${Emo} name="Light bulb" size=${20} /><div>이 기기에서는 말하기 채점이 안 돼요. 원어민 발음을 듣고 3번 따라 말해 보세요.</div></div>`}
    ${onSkip && !passed && html`<button class="btn ghost sm" onClick=${onSkip}>건너뛰기</button>`}
  </div>`;
}
