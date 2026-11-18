// Family Talk — 가족 단체 톡방 (실시간 동기화 · 안 읽은 숫자 · 스티커)
import { html, useState, useEffect, useRef, useStore, Icon } from './core.js';
import { memberInfo, memberIds, talkMsgs, markRead, sendTalk, unreadReaders, PARENTS } from '../members.js';
import { E, hhmm, DAY_NAMES, sfx } from '../util.js';

const STICKERS = ['Red heart', 'Smiling face with hearts', 'Party popper', 'Hundred points', 'Trophy', 'Thinking face', 'Sleeping face', 'Sparkles', 'Glowing star', 'Hot beverage', 'Books', 'Soccer ball'];

export function Avatar({ id, size = 40, ring = false }) {
  const m = memberInfo(id);
  return html`<span class="avatar" style=${`width:${size}px;height:${size}px;background:${m.soft || '#F1F5F9'};${ring ? `box-shadow:0 0 0 2px #fff,0 0 0 4px ${m.color}` : ''}`} title=${m.name}>
    <img src=${m.img} alt="" />
  </span>`;
}

function dateHeader(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`;
}

export function TalkView({ me }) {
  useStore();
  const msgs = talkMsgs();
  const ids = memberIds();
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const lastTs = msgs.length ? msgs[msgs.length - 1].ts : 0;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (document.visibilityState === 'visible') markRead(me);
  }, [lastTs, me]);
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && markRead(me);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [me]);

  function send() {
    const v = text.trim();
    if (!v) return;
    sendTalk(me, { text: v.slice(0, 1000) });
    setText('');
    sfx('tap');
    if (inputRef.current) { inputRef.current.style.height = ''; inputRef.current.focus(); }
  }
  function sendSticker(s) {
    sendTalk(me, { sticker: s });
    setStickers(false);
    sfx('good');
  }
  function onKey(e) {
    if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter 무시
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function autoGrow(e) {
    setText(e.target.value);
    e.target.style.height = '';
    e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px';
  }

  const rows = [];
  let prev = null;
  for (const m of msgs) {
    const day = new Date(m.ts).toDateString();
    if (!prev || new Date(prev.ts).toDateString() !== day) rows.push(html`<div class="talk-day" key=${'d' + m.ts}><span>${dateHeader(m.ts)}</span></div>`);
    const mine = m.by === me;
    const head = !prev || prev.by !== m.by || m.ts - prev.ts > 3 * 60000 || new Date(prev.ts).toDateString() !== day;
    const who = memberInfo(m.by);
    const unread = unreadReaders(m, ids);
    const meta = html`<div class="talk-meta">${unread > 0 && html`<b>${unread}</b>`}<span>${hhmm(m.ts)}</span></div>`;
    const body = m.sticker
      ? html`<img class="talk-sticker" src=${E(m.sticker)} alt="" />`
      : html`<div class="talk-bubble" style=${mine ? `background:${memberInfo(me).color}` : ''}>${m.text}</div>`;
    rows.push(html`<div key=${m.id} class=${'talk-row ' + (mine ? 'mine' : 'other') + (head ? ' head' : '')}>
      ${!mine && html`<div class="talk-av">${head && html`<${Avatar} id=${m.by} size=${40} />`}</div>`}
      <div class="talk-col">
        ${!mine && head && html`<div class="talk-name">${who.name}</div>`}
        <div class="talk-line">${mine && meta}${body}${!mine && meta}</div>
      </div>
    </div>`);
    prev = m;
  }

  return html`<div class="talk fade-in">
    <div class="talk-top">
      <div class="talk-members">${ids.map((id) => html`<${Avatar} key=${id} id=${id} size=${30} ring=${id === me} />`)}</div>
      <div class="grow"><b>우리 가족 톡</b><div class="tiny muted">${ids.map((id) => memberInfo(id).name).join(' · ')}</div></div>
      <div class="tiny muted">나: <b style=${`color:${memberInfo(me).color}`}>${memberInfo(me).name}</b></div>
    </div>
    <div class="talk-list" ref=${listRef}>
      ${msgs.length === 0 && html`<div class="empty"><img src=${E('Speech balloon')} alt="" /><div class="bold" style="color:var(--text-2)">첫 메시지를 보내 보세요!</div><div class="small">가족 모두가 같은 방에서 이야기해요</div></div>`}
      ${rows}
    </div>
    ${stickers && html`<div class="talk-stickers">${STICKERS.map((s) => html`<button key=${s} onClick=${() => sendSticker(s)}><img src=${E(s)} alt="" /></button>`)}</div>`}
    <div class="talk-input">
      <button class=${'icon-btn' + (stickers ? ' on' : '')} aria-label="스티커" onClick=${() => setStickers(!stickers)}><${Icon} name="smile" size=${22} /></button>
      <textarea ref=${inputRef} rows="1" class="textarea" placeholder="메시지 입력" value=${text} onInput=${autoGrow} onKeyDown=${onKey}></textarea>
      <button class="btn primary" style=${`background:${memberInfo(me).color}`} disabled=${!text.trim()} onClick=${send} aria-label="보내기"><${Icon} name="send" size=${18} /></button>
    </div>
  </div>`;
}

// 부모 화면에서 아이 기기로 들어온 경우: 아빠/엄마 중 누구인지 한 번 고르기 (비밀번호 없음)
export function WhoAmIParent({ onPick }) {
  return html`<div class="card" style="max-width:420px;margin:24px auto;text-align:center">
    <div class="bold" style="font-size:18px;margin-bottom:12px">누구로 대화할까요?</div>
    <div class="row" style="justify-content:center;gap:16px">${PARENTS.map((p) => html`<button key=${p.id} class="who-btn" onClick=${() => onPick(p.id)}><${Avatar} id=${p.id} size=${64} /><b>${memberInfo(p.id).name}</b></button>`)}</div>
  </div>`;
}
