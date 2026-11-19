// KidQuest Push Worker (Cloudflare Workers, 무료)
// 앱(GitHub Pages)이 보낸 요청을 받아 가족 기기들에 Web Push(앱 알림 + 아이콘 숫자)를 보냅니다.
// 필요한 환경 변수: VAPID_PUBLIC (공개키), VAPID_PRIVATE_JWK (비밀키 JWK 문자열, Secret), VAPID_SUBJECT (mailto:)
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

const getJson = async (path) => { const r = await fetch(`${DB}/${path}.json`); return r.ok ? r.json() : null; };

function unreadFor(member, talk) {
  const lr = Number(((talk && talk.reads) || {})[member] || 0);
  let n = 0;
  for (const m of Object.values((talk && talk.msgs) || {})) if (m && m.by !== member && m.ts > lr) n++;
  return n;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return new Response('KidQuest push worker OK', { headers: CORS });
    let b;
    try { b = await req.json(); } catch (_) { return new Response('bad json', { status: 400, headers: CORS }); }
    const fam = String(b.family || '');
    if (!/^kq-[a-z0-9]{20,}$/.test(fam)) return new Response('bad family', { status: 400, headers: CORS });
    const subs = (await getJson(`families/${fam}/pushSubs`)) || {};
    const kind = b.kind || 'talk';
    const talk = kind === 'talk' || kind === 'weather' ? await getJson(`families/${fam}/talk`) : null;
    const base = String(b.base || '').slice(0, 200);
    const jobs = [];
    for (const [id, s] of Object.entries(subs)) {
      if (!s || !s.endpoint || !s.keys) continue;
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
      } else {
        payload = { title: 'KidQuest 알림 테스트', body: '이 기기로 알림이 잘 와요! 🎉', url: base, badge, tag: 'kq-test' };
      }
      jobs.push(sendPush(s, payload, env).then(async (r) => {
        if (r.status === 404 || r.status === 410) await fetch(`${DB}/families/${fam}/pushSubs/${id}.json`, { method: 'DELETE' });
        return { id, status: r.status };
      }).catch((e) => ({ id, error: String(e) })));
    }
    const results = await Promise.all(jobs);
    return new Response(JSON.stringify({ sent: results.length, results }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
};
