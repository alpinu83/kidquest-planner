// KidQuest Push Worker (Cloudflare Workers, 무료)
// 앱(GitHub Pages)이 보낸 요청을 받아 가족 기기들에 Web Push(앱 알림 + 아이콘 숫자)를 보냅니다.
// 필요한 환경 변수: VAPID_PUBLIC (공개키), VAPID_PRIVATE_JWK (비밀키 JWK 문자열, Secret), VAPID_SUBJECT (mailto:)
// 예약 알림(크론): FAMILY_CODE (가족 코드, Secret) · 트리거 */5 8-15 * * * (UTC = 한국 17:00~00:55, 5분마다)
const DB = 'https://kidquest-family-default-rtdb.asia-southeast1.firebasedatabase.app';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const enc = new TextEncoder();

const b64uEnc = (buf) => {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64uDec = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
};
const concat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
};

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// RFC 8291 (aes128gcm) 페이로드 암호화
async function encryptPayload(payload, p256dh, auth) {
  const uaPub = b64uDec(p256dh), authSecret = b64uDec(auth);
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey, $public: uaKey }, asKeys.privateKey, 256));
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPub, asPub);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, plain));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
}

let signKey = null;
async function vapidJwt(aud, env) {
  if (!signKey) {
    const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
    signKey = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  const header = b64uEnc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64uEnc(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:admin@example.com' })));
  const data = enc.encode(`${header}.${claims}`);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, data));
  return `${header}.${claims}.${b64uEnc(sig)}`;
}

async function sendPush(sub, payload, env) {
  const body = await encryptPayload(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const jwt = await vapidJwt(new URL(sub.endpoint).origin, env);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}` },
    body
  });
}

const getJson = async (path, q = '') => { const r = await fetch(`${DB}/${path}.json${q ? '?' + q : ''}`); return r.ok ? r.json() : null; };

function unreadFor(member, talk) {
  const lr = Number(((talk && talk.reads) || {})[member] || 0);
  let n = 0;
  for (const m of Object.values((talk && talk.msgs) || {})) if (m && m.by !== member && m.ts > lr) n++;
  return n;
}


// ---------- 발송 (앱 요청 · 예약 알림 공용) ----------
async function deliver(fam, b, env) {
  const subs = (await getJson(`families/${fam}/pushSubs`)) || {};
  const kind = b.kind || 'talk';
  const talk = kind === 'talk' || kind === 'weather' || kind === 'direct' ? await getJson(`families/${fam}/talk`) : null;
  const base = String(b.base || '').slice(0, 200);
  const jobs = [];
  for (const [id, s] of Object.entries(subs)) {
    if (!s || !s.endpoint || !s.keys) continue;
    let direct = null;
    if (kind === 'direct') {
      // 가족 구성원별 맞춤 알림 (저녁 숙제 알림 · 주간 리포트)
      direct = (Array.isArray(b.messages) ? b.messages.slice(0, 10) : []).find((m) => Array.isArray(m.members) && m.members.includes(s.member));
      if (!direct) continue;
    }
    if (kind === 'talk' && s.member === b.from) continue;
    if (kind === 'test' && id !== b.deviceId) continue;
    if (kind === 'weather' && s.weather === false) continue;
    const badge = s.member ? unreadFor(s.member, talk) : 0;
    let payload;
    if (kind === 'talk') {
      const url = s.member === 'dad' || s.member === 'mom' ? `${base}#/parent/talk` : `${base}#/kid/${s.member}/talk`;
      payload = { title: `가족톡 · ${String(b.fromName || '').slice(0, 20)}`, body: String(b.text || '').slice(0, 300), url, badge, tag: 'kq-talk' };
    } else if (kind === 'weather') {
      payload = { title: String(b.title || '내일 날씨').slice(0, 60), body: String(b.text || '').slice(0, 500), url: base, badge, tag: 'kq-weather' };
    } else if (kind === 'direct') {
      payload = { title: String(direct.title || 'KidQuest').slice(0, 60), body: String(direct.body || '').slice(0, 500), url: base + String(direct.url || ''), badge, tag: String(direct.tag || 'kq-direct').slice(0, 30) };
    } else {
      payload = { title: 'KidQuest 알림 테스트', body: '이 기기로 알림이 잘 와요! 🎉', url: base, badge, tag: 'kq-test' };
    }
    jobs.push(sendPush(s, payload, env).then(async (r) => {
      if (r.status === 404 || r.status === 410) await fetch(`${DB}/families/${fam}/pushSubs/${id}.json`, { method: 'DELETE' });
      return { id, status: r.status };
    }).catch((e) => ({ id, error: String(e) })));
  }
  return Promise.all(jobs);
}

// ---------- 예약 알림: 내일 날씨 · 저녁 남은 숙제 · 일요일 주간 리포트 ----------
// (예전 GitHub Actions 스크립트 scripts/weather_push.py, scripts/study_push.py 와 같은 규칙)
const APP_URL = 'https://alpinu83.github.io/kidquest-planner/';
const PARENTS = ['dad', 'mom'];
const STUDY_SUBJ = ['수학', '영어', '국어', '과학', '사회', '학습지', '숙제', '영단어'];
const STUDY_WORDS = /(풀기|풀이|읽기|문제|숙제|공부|학습|쓰기|복습|예습|구몬|빠작|단어|독해|연산|p\.\s?\d)/;
const CITIES = {
  seoul: [37.5665, 126.978, '서울'], gangnam: [37.4979, 127.0276, '서울 강남·서초'], bundang: [37.3827, 127.1189, '성남·분당'],
  dongtan: [37.2006, 127.0736, '화성·동탄'], suwon: [37.2636, 127.0286, '수원'], incheon: [37.4563, 126.7052, '인천'],
  yongin: [37.2411, 127.1776, '용인'], daejeon: [36.3504, 127.3845, '대전'], daegu: [35.8714, 128.6014, '대구'],
  busan: [35.1796, 129.0756, '부산'], gwangju: [35.1595, 126.8526, '광주'], jeju: [33.4996, 126.5312, '제주']
};
const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];
const vals = (o) => (Array.isArray(o) ? o : Object.values(o || {})).filter(Boolean);
const dowOf = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const addD = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const putJson = (path, v) => fetch(DB + '/' + path + '.json', { method: 'PUT', body: JSON.stringify(v) });
const isStudy = (t) => !t.noTimer && (t.source === 'workbook' || STUDY_SUBJ.includes(t.subject || '') || STUDY_WORDS.test(String(t.title || '')));
function fmt(sec) {
  sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h) return m ? h + '시간 ' + m + '분' : h + '시간';
  return m ? m + '분' : (sec === 0 ? '0분' : sec + '초');
}
const timerSec = (tm, nowMs) => !tm ? 0 : Math.max(0, Math.floor(Number(tm.total) || 0)) + (tm.startedAt ? Math.min(3 * 3600, Math.max(0, Math.floor((nowMs - Number(tm.startedAt)) / 1000))) : 0);

function workbookTask(wb, date) {
  const days = (wb.days || []).map(Number);
  if (!wb.active || !days.includes(dowOf(date))) return null;
  const base = wb.baseDate || date;
  if (date < base) return null;
  let steps = 0;
  for (let cur = base; cur < date; cur = addD(cur, 1)) if (days.includes(dowOf(cur))) steps++;
  const ppd = Number(wb.pagesPerDay) || 1, total = Number(wb.totalPages) || 0;
  const start = (Number(wb.startPage) || 1) + steps * ppd;
  if (start > total) return null;
  const end = Math.min(total, start + ppd - 1);
  return { id: 'wb_' + wb.id + '_' + date.replace(/-/g, ''), title: wb.title + ' ' + (start === end ? 'p.' + start : 'p.' + start + '~' + end), subject: wb.subject, source: 'workbook', done: false };
}
function tasksFor(kid, date) {
  const allTasks = kid.tasks || {};
  const stored = allTasks[date] || {};
  const out = {};
  for (const [tid, t] of Object.entries(stored)) if (t) out[tid] = { ...t, id: tid };
  for (const wb of vals(kid.workbooks)) { const t = workbookTask(wb, date); if (t && !out[t.id]) out[t.id] = t; }
  const dw = dowOf(date);
  const habits = {};
  for (const h of vals(kid.habits)) habits['habit_' + h.id] = h;
  for (const [tid, t] of Object.entries(out)) { const h = habits[tid]; if (h && h.weekly && h.days) t.weekly = true; }
  const doneOn = (d, tid) => !!((allTasks[d] || {})[tid] || {}).done;
  for (const [tid, h] of Object.entries(habits)) {
    if (!h.active) continue;
    if (h.dueDow !== undefined && h.dueDow !== null && h.dueDow !== '') {
      if ((h.from && date < h.from) || (h.until && date > h.until) || out[tid]) {
        if (out[tid]) { out[tid].dueDate = addD(date, (Number(h.dueDow) - dw + 7) % 7); out[tid].due = true; }
        continue;
      }
      const win = Math.max(1, Math.min(7, Number(h.window) || 6));
      const k = (Number(h.dueDow) - dw + 7) % 7;
      if (k > win - 1) continue;
      const dueDate = addD(date, k), start = addD(dueDate, -(win - 1));
      const t = { id: tid, title: h.title, subject: h.subject || '숙제', source: 'habit', done: false, due: true, dueDate, noTimer: !!h.noTimer };
      for (let i = 0; i < win; i++) { const d2 = addD(start, i); if (d2 !== date && doneOn(d2, tid)) { t.done = true; t.lockedDone = true; break; } }
      out[tid] = t;
      continue;
    }
    const days = Array.isArray(h.days) && h.days.length ? h.days.map(Number) : null;
    if (days && !days.includes(dw)) continue;
    if ((h.from && date < h.from) || (h.until && date > h.until)) continue;
    if (out[tid]) continue;
    const t = { id: tid, title: h.title, subject: h.subject || '생활', source: 'habit', done: false, weekly: !!(h.weekly && days), noTimer: !!h.noTimer };
    if (t.weekly) {
      const monday = addD(date, -((dw + 6) % 7));
      for (let i = 0; i < 7; i++) { const d = addD(monday, i); if (d !== date && doneOn(d, tid)) { t.done = true; t.lockedDone = true; break; } }
    }
    out[tid] = t;
  }
  return Object.values(out).filter((t) => !t.deleted);
}
const studiedOn = (kid, date, nowMs) => vals((kid.timers || {})[date]).reduce((n, tm) => n + timerSec(tm, nowMs), 0);
function isDue(cfg, defTime, lastKey, today, nowMin, push) {
  if (!cfg || cfg.enabled === false) return false;
  if (push[lastKey] === today) return false;
  const [hh, mm] = String(cfg.time || defTime).split(':').map(Number);
  const t = hh * 60 + mm;
  return nowMin >= t && nowMin < t + 180;
}

// 필요한 데이터만 가져오기 (최근 9일치 숙제·타이머)
async function loadKids(fam, since, withLedger) {
  const ids = Object.keys((await getJson('families/' + fam + '/kids', 'shallow=true')) || {});
  const q = 'orderBy=%22%24key%22&startAt=%22' + since + '%22';
  const kids = await Promise.all(ids.map(async (id) => {
    const p = 'families/' + fam + '/kids/' + id;
    const [profile, tasks, timers, habits, workbooks, academies, ledger] = await Promise.all([
      getJson(p + '/profile'), getJson(p + '/tasks', q), getJson(p + '/timers', q), getJson(p + '/habits'), getJson(p + '/workbooks'), getJson(p + '/academies'),
      withLedger ? getJson(p + '/ledger', 'orderBy=%22date%22&limitToFirst=1').catch(() => null) : null
    ]);
    return { id, profile, tasks: tasks || {}, timers: timers || {}, habits, workbooks, academies, ledger };
  }));
  return kids.filter((k) => k.profile).sort((a, b) => (b.profile.grade || 0) - (a.profile.grade || 0));
}

async function weatherMsg(fam, settings, kids, today) {
  const [lat, lon, city] = CITIES[settings.cityId || 'seoul'] || CITIES.seoul;
  const w = (await (await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&forecast_days=2')).json()).daily;
  const tmin = Math.round(w.temperature_2m_min[1]), tmax = Math.round(w.temperature_2m_max[1]);
  const prob = w.precipitation_probability_max[1] || 0, code = w.weather_code[1];
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86;
  const tips = [];
  if (snow) tips.push('눈 소식 · 우산과 미끄럼 안 되는 신발');
  else if (prob >= 40 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) tips.push('우산 꼭 챙기기 (비 ' + prob + '%)');
  if (tmin <= 4) tips.push('두꺼운 외투·목도리'); else if (tmin <= 12) tips.push('따뜻한 겉옷'); else if (tmax >= 27) tips.push('시원한 옷·물통');
  if (tmax - tmin >= 10) tips.push('일교차 ' + (tmax - tmin) + '도 · 겉옷 겹쳐 입기');
  if (!tips.length) tips.push('비 걱정 없는 날');
  const tm = addD(today, 1), dw = dowOf(tm);
  const lines = [city + ' 내일(' + Number(tm.slice(5, 7)) + '/' + Number(tm.slice(8)) + ' ' + DOW_KO[dw] + ') ' + tmin + '°~' + tmax + '°C · 비 ' + prob + '%', '준비물: ' + tips.join(', ')];
  for (const k of kids) {
    const acs = vals(k.academies).filter((a) => (a.days || []).map(Number).includes(dw)).sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
    if (acs.length) lines.push(k.profile.name + ': ' + acs.map((a) => a.start + ' ' + a.title + (a.note ? '(' + a.note + ')' : '')).join(', '));
  }
  const text = lines.join('\n');
  return { title: (text.includes('우산') ? '\u2602 ' : '') + '내일 날씨·준비물', text };
}

function homeworkMsgs(kids, today, nowMs) {
  const msgs = [], parentLines = [];
  let allDone = true;
  for (const k of kids) {
    const tasks = tasksFor(k, today);
    const left = tasks.filter((t) => !t.done && !(t.due && (t.dueDate || today) > today));
    const studyLeft = left.filter(isStudy), otherLeft = left.filter((t) => !isStudy(t));
    const sec = studiedOn(k, today, nowMs);
    const studied = sec >= 60 ? ' · 공부 ' + fmt(sec) : '';
    const nm = k.profile.name || k.id;
    if (studyLeft.length) {
      allDone = false;
      const titles = studyLeft.slice(0, 4).map((t) => t.title).join(', ') + (studyLeft.length > 4 ? ' 외 ' + (studyLeft.length - 4) + '개' : '');
      msgs.push({ members: [k.id], title: '숙제가 ' + studyLeft.length + '개 남았어요', body: titles + (otherLeft.length ? '\n그 밖에 할 일 ' + otherLeft.length + '개도 남았어요' : '') + '\n타이머 켜고 시작해 볼까요?', url: '#/kid/' + k.id + '/missions', tag: 'kq-hw' });
      parentLines.push(nm + ': ' + studyLeft.length + '개 남음 (' + studyLeft.slice(0, 3).map((t) => t.title).join(', ') + (studyLeft.length > 3 ? ' 등' : '') + ')' + studied);
    } else if (tasks.length) {
      parentLines.push(nm + ': 숙제 다 했어요' + studied + (otherLeft.length ? ' (생활 할 일 ' + otherLeft.length + '개 남음)' : ''));
    }
  }
  if (parentLines.length) msgs.push({ members: PARENTS, title: allDone ? '오늘 숙제 모두 끝!' : '오늘 숙제 현황', body: parentLines.join('\n'), url: '#/parent/overview', tag: 'kq-hw' });
  return msgs;
}

function weeklyMsgs(kids, today, nowMs) {
  const monday = addD(today, -((dowOf(today) + 6) % 7));
  const msgs = [], parentLines = [];
  for (const k of kids) {
    let total = 0, done = 0, secs = 0;
    const subj = {}, seen = {}, books = [];
    const firstCands = vals(k.ledger).map((e) => e.date).filter(Boolean)
      .concat(Object.entries(k.tasks || {}).filter(([, ts]) => vals(ts).some((t) => t.done)).map(([d]) => d));
    const first = firstCands.length ? firstCands.sort()[0] : today;
    for (let i = 0; i < 7; i++) {
      const d = addD(monday, i);
      if (d > today) break;
      if (d < first) continue;
      for (const tm of vals((k.timers || {})[d])) {
        const s = timerSec(tm, nowMs);
        if (s > 0) { secs += s; let key = tm.subject || '기타'; if (key === '생활') key = '기타'; subj[key] = (subj[key] || 0) + s; }
      }
      for (const t of tasksFor(k, d)) {
        if (t.weekly || t.due) {
          const key = t.id + (t.due ? '|' + (t.dueDate || '') : '');
          const prev = seen[key] || { done: false, due: t.due ? t.dueDate : null };
          prev.done = prev.done || (!!t.done && !t.lockedDone);
          seen[key] = prev;
          continue;
        }
        total++; if (t.done) done++;
      }
      for (const t of vals((k.tasks || {})[d])) if (t.done && t.rec && t.rec.book) books.push(t.rec);
    }
    const counted = Object.values(seen).filter((v) => v.done || !(v.due && v.due > today));
    total += counted.length; done += counted.filter((v) => v.done).length;
    const rate = total ? Math.round((done * 100) / total) : 0;
    const subjTxt = Object.entries(subj).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, v]) => s + ' ' + fmt(v)).join(', ');
    const booksTxt = books.map((b) => { const t = Number(b.total) || 0, c = Number(b.correct) || 0; return '「' + b.book + '」' + (t ? ' ' + c + '/' + t + '(' + Math.round((c * 100) / t) + '점)' : ''); }).join(', ');
    const nm = k.profile.name || k.id;
    parentLines.push(nm + ': 공부 ' + fmt(secs) + ' · 숙제 ' + rate + '% (' + done + '/' + total + ')' + (subjTxt ? ' · ' + subjTxt : '') + (booksTxt ? '\n  영어책 ' + booksTxt : ''));
    msgs.push({ members: [k.id], title: '이번 주 공부 리포트', body: '공부 ' + fmt(secs) + ' · 숙제 ' + rate + '% 완료 (' + done + '/' + total + ')' + (booksTxt ? '\n영어책 ' + booksTxt : '') + '\n' + (rate >= 90 ? '정말 잘했어요!' : '다음 주도 화이팅!'), url: '#/kid/' + k.id, tag: 'kq-week' });
  }
  const sun = addD(monday, 6);
  msgs.push({ members: PARENTS, title: '주간 공부 리포트 (' + Number(monday.slice(5, 7)) + '/' + Number(monday.slice(8)) + '~' + Number(sun.slice(5, 7)) + '/' + Number(sun.slice(8)) + ')', body: parentLines.join('\n'), url: '#/parent/report', tag: 'kq-week' });
  return msgs;
}

// force: 'weather' | 'homework' | 'weekly' (즉시 실행) · dry: 보내지 않고 내용만 돌려줌
async function runFamily(fam, env, opt = {}) {
  const kst = new Date(Date.now() + 9 * 3600000);
  const today = opt.today || kst.toISOString().slice(0, 10);
  const nowMin = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const nowMs = Date.now();
  const settings = (await getJson('families/' + fam + '/settings')) || {};
  const push = settings.push || {};
  const want = {
    weather: opt.force ? opt.force === 'weather' : isDue({ enabled: push.enabled, time: push.time }, '21:00', 'lastSent', today, nowMin, push),
    homework: opt.force ? opt.force === 'homework' : isDue(push.homework || {}, '20:00', 'hwLastSent', today, nowMin, push),
    weekly: opt.force ? opt.force === 'weekly' : dowOf(today) === 0 && isDue(push.weekly || {}, '20:30', 'weeklyLastSent', today, nowMin, push)
  };
  const log = { fam: fam.slice(0, 8) + '…', today, now: kst.toISOString().slice(11, 16), want };
  if (!want.weather && !want.homework && !want.weekly) return log;
  const real = !opt.dry && !opt.force;
  const kids = await loadKids(fam, addD(today, -9), want.weekly);
  if (want.weather) {
    if (real) await putJson('families/' + fam + '/settings/push/lastSent', today);
    const w = await weatherMsg(fam, settings, kids, today);
    log.weather = w;
    if (!opt.dry) log.weatherSent = (await deliver(fam, { kind: 'weather', title: w.title, text: w.text, base: APP_URL }, env)).length;
  }
  if (want.homework) {
    if (real) await putJson('families/' + fam + '/settings/push/hwLastSent', today);
    const m = homeworkMsgs(kids, today, nowMs);
    log.homework = m;
    if (!opt.dry && m.length) log.homeworkSent = (await deliver(fam, { kind: 'direct', messages: m, base: APP_URL }, env)).length;
  }
  if (want.weekly) {
    if (real) await putJson('families/' + fam + '/settings/push/weeklyLastSent', today);
    const m = weeklyMsgs(kids, today, nowMs);
    log.weekly = m;
    if (!opt.dry) log.weeklySent = (await deliver(fam, { kind: 'direct', messages: m, base: APP_URL }, env)).length;
  }
  return log;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return new Response('KidQuest push worker OK', { headers: CORS });
    let b;
    try { b = await req.json(); } catch (_) { return new Response('bad json', { status: 400, headers: CORS }); }
    const fam = String(b.family || '');
    if (!/^kq-[a-z0-9]{20,}$/.test(fam)) return new Response('bad family', { status: 400, headers: CORS });
    const json = (o) => new Response(JSON.stringify(o), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    if (b.kind === 'run') {
      // 예약 알림 수동 실행/미리보기: {family, kind:'run', force:'weather'|'homework'|'weekly', dry:true, today}
      try { return json(await runFamily(fam, env, { force: ['weather', 'homework', 'weekly'].includes(b.force) ? b.force : '', dry: b.dry !== false, today: /^\d{4}-\d{2}-\d{2}$/.test(b.today || '') ? b.today : '' })); }
      catch (e) { return json({ error: String(e && e.stack || e) }); }
    }
    const results = await deliver(fam, b, env);
    return json({ sent: results.length, results });
  },
  async scheduled(event, env, ctx) {
    const fams = String(env.FAMILY_CODE || '').split(',').map((s) => s.trim()).filter((s) => /^kq-[a-z0-9]{20,}$/.test(s));
    ctx.waitUntil(Promise.all(fams.map((f) => runFamily(f, env).then((l) => console.log(JSON.stringify(l))).catch((e) => console.log('error', String(e))))));
  }
};
