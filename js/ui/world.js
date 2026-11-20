// Pet World 2 — 전설 펫들이 전신으로 살아 움직이는 마을 (Canvas 렌더러)
// · 날갯짓/걷기/깡총/수영 4프레임 애니메이션 + 스쿼시·스트레치, 그림자, 먼지, 물결
// · 탭: 반응 · 3번 연속 탭: 종류별 전설 스킬 · 끌어서 들어 올리기(놓으면 떨어짐) · 빈 곳 탭: 달려옴
// · 공 놀이(물리) · 모두 모여 · 낮/밤
import { html, useState, useEffect, useRef, Icon, celebrate } from './core.js';
import * as M from '../model.js';
import { MAX_PET_XP } from '../../data/pets.js';
import { SPRITES, TERRAIN, WORLD_BG, onGround, inPond } from '../../data/world.js';
import { E, sfx, vibrate, shortDate, dateKey } from '../util.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const G = 1900; // 중력 (px/s²)

const imgCache = new Map();
function loadImg(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  imgCache.set(src, p);
  return p;
}
function isNightNow() { const h = new Date().getHours(); return h >= 19 || h < 6; }

// ---------------------------------------------------------------- 엔진
class WorldEngine {
  constructor(canvas, overlay, opts) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.ov = overlay; this.opts = opts;
    this.ents = []; this.parts = []; this.ball = null; this.t = 0; this.nightMix = opts.night ? 1 : 0; this.night = opts.night;
    this.shake = 0; this.flash = null; this.trails = []; this.bolts = []; this.auroraT = 0; this.markers = [];
    this.ambient = []; this.birds = []; this.grass = [];
    this.imgs = {}; this.ready = false; this.dead = false;
    this.resize();
    for (let i = 0; i < 70; i++) this.grass.push({ x: Math.random(), h: rand(16, 34), w: rand(3, 6), ph: Math.random() * 6, c: pick(['#4E9F4A', '#5FB45A', '#6CC163', '#3F8E40']) });
  }
  async load(pets) {
    const [day, night, coin, heart, star, ball, crownImg, petal] = await Promise.all([
      loadImg(WORLD_BG.day), loadImg(WORLD_BG.night), loadImg(E('Coin')), loadImg(E('Red heart')), loadImg(E('Glowing star')), loadImg(E('Soccer ball')), loadImg(E('Crown')), loadImg(E('Cherry blossom'))
    ]);
    Object.assign(this.imgs, { day, night, coin, heart, star, ball, crown: crownImg, petal });
    const extra = ['Sparkles', 'Sparkling heart', 'Musical notes', 'Party popper', 'Fire', 'Snowflake', 'High voltage', 'Magic wand', 'Rainbow', 'Crescent moon', 'Bubbles', 'Trophy', 'Smiling face with hearts', 'Glowing star', 'Red heart'];
    for (const e of extra) loadImg(E(e)).then((im) => { this.imgs[e] = im; });
    const sheets = await Promise.all(pets.map((p) => loadImg(`assets/world/${p.species.id}.webp`)));
    this.ents = pets.map((p, i) => this.makeEnt(p, sheets[i], i, pets.length)).filter(Boolean);
    this.ready = true;
  }
  makeEnt(pet, sheet, i, n) {
    const sp = SPRITES[pet.species.id];
    if (!sp || !sheet) return null;
    const e = { id: pet.id, pet, sp, sheet, mode: sp.mode, x: 0, y: 0, z: 0, vz: 0, vx: 0, vy: 0, face: 1, dir: 1,
      tx: 0, ty: 0, state: 'idle', timer: rand(0.5, 2), frameT: Math.random() * 4, sq: 0, sqv: 0, rot: 0, spin: 0, spinV: 0,
      held: false, act: null, taps: [], sleep: false, hopT: 0, speedMul: 1, lastStep: 0, bubble: null, bubbleT: 0 };
    const p = this.randPoint(e.mode, (i + 0.5) / n);
    e.x = e.tx = p.x; e.y = e.ty = p.y;
    const b = document.createElement('div');
    b.className = 'pw-bubble';
    this.ov.appendChild(b);
    e.bubbleEl = b;
    return e;
  }
  destroy() { this.dead = true; this.ents.forEach((e) => e.bubbleEl && e.bubbleEl.remove()); }

  // ---------- 카메라 (배경을 화면에 꽉 차게) ----------
  resize() {
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(10, r.width); this.H = Math.max(10, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    const N = WORLD_BG.size;
    this.s = Math.max(this.W / N, this.H / N);
    const portrait = this.W / this.H < 0.9;
    const fx = portrait ? 0.3 : 0.5, fy = 0.6;
    this.ox = (this.W - N * this.s) * fx; this.oy = (this.H - N * this.s) * fy;
    this.phone = this.W < 560;
    const bottomUi = this.phone ? 150 : 112, topUi = 64;
    this.vis = { x0: -this.ox / this.s, x1: (this.W - this.ox) / this.s, y0: (topUi - this.oy) / this.s, y1: (this.H - bottomUi - this.oy) / this.s };
  }
  toWorld(cx, cy) { return { x: (cx - this.ox) / this.s, y: (cy - this.oy) / this.s }; }
  toScreen(x, y) { return { x: x * this.s + this.ox, y: y * this.s + this.oy }; }
  depth(e) {
    if (e.mode === 'fly') return 1;
    if (e.held && e.heldDepth) return e.heldDepth;
    const g = TERRAIN.ground;
    return 0.72 + 0.42 * clamp((e.y - g.y0) / (g.y1 - g.y0), 0, 1);
  }
  sizeOf(e) {
    const k = this.depth(e) * (e.mode === 'swim' ? 0.95 : 1) * (this.phone ? 1.12 : 1);
    const h = e.sp.h * k;
    return { h, w: h * (e.sp.fw / e.sp.fh) };
  }
  randPoint(mode, u = Math.random()) {
    const v = this.vis, m = 70;
    if (mode === 'fly') {
      const s = TERRAIN.sky;
      const x0 = Math.max(s.x0, v.x0 + 95), x1 = Math.min(s.x1, v.x1 - 95);
      const y0 = Math.max(s.y0, v.y0 + 110), y1 = Math.min(s.y1, v.y1 - 40);
      return { x: lerp(x0, x1, u * 0.9 + Math.random() * 0.1), y: rand(y0, Math.max(y0 + 1, y1)) };
    }
    if (mode === 'swim') {
      const p = TERRAIN.pond;
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.8;
        const x = p.cx + Math.cos(a) * p.rx * r, y = p.cy + Math.sin(a) * p.ry * r;
        if (x > v.x0 + 40) return { x, y };
      }
      return { x: Math.max(p.cx, v.x0 + 60), y: p.cy };
    }
    const g = TERRAIN.ground;
    const x0 = Math.max(g.x0, v.x0 + m), x1 = Math.min(g.x1, v.x1 - m), y1 = Math.min(g.y1, v.y1);
    for (let i = 0; i < 60; i++) {
      const x = i < 30 ? lerp(x0, x1, clamp(u + rand(-0.15, 0.15), 0, 1)) : rand(x0, x1), y = rand(g.y0, y1);
      if (onGround(x, y)) return { x, y };
    }
    return { x: (x0 + x1) / 2, y: Math.min(y1, 720) };
  }
  clampTo(mode, x, y) {
    const v = this.vis;
    if (mode === 'fly') {
      const s = TERRAIN.sky;
      return { x: clamp(x, Math.max(s.x0, v.x0 + 95), Math.min(s.x1, v.x1 - 95)), y: clamp(y, Math.max(s.y0, v.y0 + 100), Math.min(s.y1, v.y1 - 40)) };
    }
    if (mode === 'swim') {
      const p = TERRAIN.pond;
      let dx = (x - p.cx) / p.rx, dy = (y - p.cy) / p.ry;
      const d = Math.hypot(dx, dy);
      if (d > 0.85) { dx = dx / d * 0.85; dy = dy / d * 0.85; }
      return { x: Math.max(p.cx + dx * p.rx, v.x0 + 50), y: p.cy + dy * p.ry };
    }
    const g = TERRAIN.ground;
    let px = clamp(x, Math.max(g.x0, v.x0 + 60), Math.min(g.x1, v.x1 - 60)), py = clamp(y, g.y0, Math.min(g.y1, v.y1));
    if (!onGround(px, py)) {
      // 가장 가까운 풀밭으로
      let best = null, bd = 1e9;
      for (let i = 0; i < 50; i++) { const q = this.randPoint('walk'); const d = Math.hypot(q.x - px, q.y - py); if (d < bd) { bd = d; best = q; } }
      if (best) { px = best.x; py = best.y; }
    }
    return { x: px, y: py };
  }

  // ---------- 루프 ----------
  step(dt) {
    if (!this.ready) return;
    this.t += dt;
    const t = this.t;
    this.nightMix = lerp(this.nightMix, this.night ? 1 : 0, Math.min(1, dt * 2.2));
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    for (const e of this.ents) this.updateEnt(e, dt, t);
    this.separate(dt);
    this.updateBall(dt);
    this.updateParts(dt);
    this.updateAmbient(dt);
    this.draw(t);
  }

  freePoint(e, mode) {
    let best = null, bestD = -1;
    for (let i = 0; i < 8; i++) {
      const p = this.randPoint(mode);
      let dmin = 1e9;
      for (const o of this.ents) if (o !== e && (o.mode === 'fly') === (mode === 'fly')) dmin = Math.min(dmin, Math.hypot(o.tx - p.x, (o.ty - p.y) * 1.6), Math.hypot(o.x - p.x, (o.y - p.y) * 1.6));
      if (dmin > bestD) { bestD = dmin; best = p; }
      if (dmin > 170) break;
    }
    return best;
  }
  separate(dt) {
    // 서로 겹치면 살짝 밀어냄
    const L = this.ents;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.held || b.held || (a.mode === 'fly') !== (b.mode === 'fly') || a.mode === 'swim' || b.mode === 'swim') continue;
      const fy = a.mode === 'fly' ? 1.1 : 1.8;
      const dx = b.x - a.x, dy = (b.y - a.y) * fy, d = Math.hypot(dx, dy) || 1;
      const min = (this.sizeOf(a).w + this.sizeOf(b).w) * (a.mode === 'fly' ? 0.46 : 0.36);
      if (d < min) {
        const push = (min - d) * 0.5 * Math.min(1, dt * 4);
        const ux = dx / d, uy = dy / d / fy;
        const ok = (m, x, y) => m === 'fly' ? true : onGround(x, y) && x > this.vis.x0 + 50 && x < this.vis.x1 - 50 && y < this.vis.y1;
        const ax = a.x - ux * push, ay = a.y - uy * push, bx = b.x + ux * push, by = b.y + uy * push;
        if (ok(a.mode, ax, ay)) { a.x = ax; a.y = ay; }
        if (ok(b.mode, bx, by)) { b.x = bx; b.y = by; }
      }
    }
  }
  updateEnt(e, dt, t) {
    // 스쿼시 스프링
    e.sqv += (-140 * e.sq - 10 * e.sqv) * dt; e.sq += e.sqv * dt;
    // 방향 전환은 부드럽게 (몸이 돌아서는 느낌)
    e.face = lerp(e.face, e.dir, Math.min(1, dt * 9));
    if (e.spinV) { e.spin += e.spinV * dt; if (e.spin >= Math.PI * 2) { e.spin = 0; e.spinV = 0; } }
    if (e.bubbleT > 0) { e.bubbleT -= dt; if (e.bubbleT <= 0) e.bubbleEl.classList.remove('show'); }

    if (e.held) {
      const vx = (e.hx - e.x) / Math.max(dt, 0.001);
      e.x = lerp(e.x, e.hx, Math.min(1, dt * 18)); e.y = lerp(e.y, e.hy, Math.min(1, dt * 18));
      e.rot = lerp(e.rot, clamp(-vx * 0.0006, -0.5, 0.5), Math.min(1, dt * 8));
      e.frameT += dt * 14;
      return;
    }
    // 점프/낙하 물리
    if (e.z > 0 || e.vz !== 0) {
      e.vz -= G * dt; e.z += e.vz * dt;
      if (e.z <= 0) {
        e.z = 0;
        const impact = -e.vz;
        e.vz = impact > 520 ? impact * 0.28 : 0;
        if (impact > 160) { e.sqv += Math.min(9, impact / 90); this.dust(e, impact > 500 ? 9 : 5); if (e.mode === 'swim') this.splash(e.x, e.y, 14); }
        if (e.landTo) { e.landTo = null; }
      }
    }
    if (e.act) { this.updateAct(e, dt); }
    const sleepy = this.night && !e.act;

    if (e.mode === 'fly') {
      if (!e.act || e.act.free) {
        if (e.state === 'idle') { e.timer -= dt; if (e.timer <= 0) { const p = this.freePoint(e, 'fly'); e.tx = p.x; e.ty = p.y; e.state = 'go'; e.speedMul = 1; } }
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        const max = 120 * e.speedMul * (sleepy ? 0.6 : 1);
        const want = e.state === 'go' ? Math.min(max, d * 1.6) : 0;
        const dvx = d > 1 ? dx / d * want : 0, dvy = d > 1 ? dy / d * want : 0;
        e.vx = lerp(e.vx, dvx, Math.min(1, dt * 2.2)); e.vy = lerp(e.vy, dvy, Math.min(1, dt * 2.2));
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (Math.abs(e.vx) > 8) e.dir = e.vx < 0 ? -1 : 1;
        if (e.state === 'go' && d < 6) { e.state = 'idle'; e.timer = rand(0.6, 2.6) * (sleepy ? 2 : 1); }
      }
      e.rot = lerp(e.rot, clamp(e.vx / 120, -1, 1) * 0.16 + clamp(e.vy / 120, -1, 1) * 0.08 * e.dir, Math.min(1, dt * 4));
      e.frameT += dt * e.sp.fps * (1 + Math.min(1, Math.hypot(e.vx, e.vy) / 120) * 0.5) * (sleepy ? 0.6 : 1);
      if (e.pet.xp >= MAX_PET_XP && Math.random() < dt * 6) this.spawn({ k: 'spark', x: e.x - e.dir * rand(10, 40), y: e.y - rand(10, 60), vx: -e.vx * 0.2, vy: rand(-10, 10), life: 0.9, size: rand(3, 6), col: e.pet.species.color });
      return;
    }

    if (e.mode === 'swim') {
      if (!e.act) {
        if (e.state === 'idle') {
          e.timer -= dt;
          if (e.timer <= 0) {
            if (Math.random() < 0.22 && e.z === 0) { this.leap(e); }
            else { const p = this.randPoint('swim'); e.tx = p.x; e.ty = p.y; e.state = 'go'; }
          }
        } else {
          const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy), sp = 38 * e.speedMul * dt;
          if (d <= sp) { e.state = 'idle'; e.timer = rand(1, 3.5); e.speedMul = 1; } else { e.x += dx / d * sp; e.y += dy / d * sp; if (Math.abs(dx) > 1) e.dir = dx < 0 ? -1 : 1; }
        }
      }
      e.rot = e.z > 0 ? clamp(-e.vz / 900, -0.6, 0.6) * e.dir : Math.sin(t * 1.6 + e.x) * 0.05;
      e.frameT += dt * e.sp.fps * (e.state === 'go' ? 1.4 : 0.8);
      if (Math.random() < dt * 1.3 && e.z === 0) this.spawn({ k: 'ring', x: e.x + rand(-20, 20), y: e.y + 2, life: 1.6, size: rand(18, 30) });
      if (e.pet.species.id === 'whale' && Math.random() < dt * 0.25 && e.z === 0) this.spout(e, 10);
      return;
    }

    // 땅 위 (walk / hop / waddle)
    if (!e.act || e.act.free) {
      if (e.state === 'idle') {
        e.timer -= dt;
        if (e.timer <= 0) {
          const r = Math.random();
          if (sleepy && r < 0.55) { e.timer = rand(3, 6); e.sleep = true; }
          else if (r < 0.62) { const p = this.freePoint(e, 'walk'); e.tx = p.x; e.ty = p.y; e.state = 'go'; e.speedMul = 1; e.sleep = false; }
          else if (r < 0.75) { e.dir = -e.dir; e.timer = rand(0.8, 1.8); }
          else if (r < 0.87) { this.jump(e, 360); e.timer = rand(1, 2); }
          else { e.timer = rand(2, 4); e.sqv += 2.5; }
        }
      }
      if (e.state === 'go') {
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 2) e.dir = dx < 0 ? -1 : 1;
        if (e.mode === 'hop') {
          if (e.z === 0 && e.vz === 0) {
            if (d < 8) { e.state = 'idle'; e.timer = rand(1, 3); e.speedMul = 1; }
            else { e.hopT += dt; if (e.hopT > 0.12) { e.hopT = 0; e.vz = 520; e.hopVx = dx / d * Math.min(d, 85) / 0.55 * e.speedMul; e.hopVy = dy / d * Math.min(d, 85) / 0.55 * e.speedMul; e.sqv -= 3; } else if (e.hopT < 0.02) e.sqv += 3; }
          } else { e.x += (e.hopVx || 0) * dt; e.y += (e.hopVy || 0) * dt; }
        } else {
          const base = e.mode === 'waddle' ? 46 : 74;
          const sp = base * this.depth(e) * e.speedMul * dt;
          if (d <= sp) { e.x = e.tx; e.y = e.ty; e.state = 'idle'; e.timer = rand(0.8, 3.2); e.speedMul = 1; }
          else { e.x += dx / d * sp; e.y += dy / d * sp; }
          e.frameT += dt * e.sp.fps * e.speedMul;
          const fi = Math.floor(e.frameT);
          if (fi !== e.lastStep && fi % 2 === 0) { e.lastStep = fi; this.dust(e, 2, 0.5); }
        }
      }
    }
    const moving = e.state === 'go' && !e.act;
    e.rot = lerp(e.rot, moving ? e.dir * (e.mode === 'waddle' ? Math.sin(e.frameT * Math.PI) * 0.08 : 0.035) : 0, Math.min(1, dt * 6));
    if (e.sleep && Math.random() < dt * 0.6) this.spawn({ k: 'z', x: e.x + 20, y: e.y - this.sizeOf(e).h * 0.85, vx: 8, vy: -18, life: 2.2, size: 15 });
  }

  updateAct(e, dt) {
    const a = e.act;
    a.t += dt;
    if (a.type === 'dash') {
      // 무지개 질주: 하늘을 가로질러 원을 그리며
      const u = a.t / a.dur;
      e.x = a.cx + Math.cos(a.a0 + u * Math.PI * 2 * a.sgn) * a.rx;
      e.y = a.cy + Math.sin(a.a0 + u * Math.PI * 2 * a.sgn) * a.ry;
      const nx = a.cx + Math.cos(a.a0 + (u + 0.01) * Math.PI * 2 * a.sgn) * a.rx;
      e.dir = nx < e.x ? -1 : 1; e.vx = (nx - e.x) * 60;
      this.trails.push({ x: e.x, y: e.y, life: 1.2 });
      if (u >= 1) { e.act = null; e.tx = e.x; e.ty = e.y; e.state = 'idle'; e.timer = 1; }
      return;
    }
    if (a.type === 'breath') {
      const k = this.sizeOf(e);
      if (a.t < a.dur && Math.random() < 0.9) {
        const mx = e.x + e.dir * k.w * 0.42, my = e.y - e.z - k.h * 0.62 + (e.mode === 'fly' ? k.h * 0.5 : 0);
        for (let i = 0; i < 3; i++) this.spawn({ k: 'flame', x: mx, y: my, vx: e.dir * rand(260, 420), vy: rand(-60, 60), life: rand(0.5, 0.8), size: rand(10, 18) });
      }
      if (a.t >= a.dur) e.act = null;
      return;
    }
    if (a.type === 'wait') { if (a.t >= a.dur) e.act = null; return; }
    if (a.type === 'hops') {
      a.cd = (a.cd || 0) - dt;
      if (e.z === 0 && e.vz === 0 && a.n > 0 && a.cd <= 0) { a.n--; a.cd = 0.3; this.jump(e, 330); }
      if (a.n <= 0 && a.cd <= 0 && e.z === 0 && e.vz === 0) e.act = null;
    }
  }

  jump(e, v = 480) { if (e.mode === 'fly') { e.vy -= v * 0.5; return; } e.sqv += 3.2; setTimeout(() => { e.vz = v; e.sqv -= 5; }, 70); }
  leap(e) { e.vz = rand(560, 700); e.sqv -= 4; this.splash(e.x, e.y, 12); e.timer = rand(2, 4); }

  updateBall(dt) {
    const b = this.ball;
    if (!b) return;
    b.life -= dt;
    b.vz -= G * 0.8 * dt; b.z += b.vz * dt;
    if (b.z <= 0) { b.z = 0; if (b.vz < -120) { b.vz = -b.vz * 0.52; this.spawn({ k: 'dust', x: b.x, y: b.y, life: 0.5, size: 10 }); } else b.vz = 0; }
    const fr = b.z > 0 ? 0.999 : 0.985;
    b.vx *= Math.pow(fr, dt * 60); b.vy *= Math.pow(fr, dt * 60);
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.spin += (b.vx / 30) * dt;
    const bb = this.ballBounds();
    if (b.x < bb.x0) { b.x = bb.x0; b.vx = Math.abs(b.vx) * 0.7; } if (b.x > bb.x1) { b.x = bb.x1; b.vx = -Math.abs(b.vx) * 0.7; }
    if (b.y < bb.y0) { b.y = bb.y0; b.vy = Math.abs(b.vy) * 0.7; } if (b.y > bb.y1) { b.y = bb.y1; b.vy = -Math.abs(b.vy) * 0.7; }
    // 펫이 공을 쫓아감
    for (const e of this.ents) {
      if (e.held || (e.act && !e.act.free)) continue;
      if (e.mode === 'fly') {
        // 나는 펫: 공 높이까지 내려와서 헤딩·날개로 슛
        const by = b.y - b.z - 24;
        e.tx = b.x - e.dir * 16; e.ty = by - 8; e.state = 'go'; e.speedMul = 2.8;
        const dd = Math.hypot(e.x - b.x, e.y - by);
        if (dd < 62 && b.cool <= 0) {
          b.vx = (e.x < b.x ? 1 : -1) * rand(220, 360); b.vy = rand(-110, 110); b.vz = rand(420, 600); b.cool = 0.4; b.kicks++;
          e.vy -= 160; e.sqv -= 3; sfx('good');
          if (Math.random() < 0.6) this.say(e, pick(['헤딩~!', '날개 슛!', '하늘에서 받아라!', '내가 찼다!']), 1.2);
        }
        continue;
      }
      if (e.mode === 'swim') {
        // 헤엄치는 펫: 물대포로 공을 쳐 줌
        e.ballT = (e.ballT == null ? rand(1.2, 2.5) : e.ballT) - dt;
        if (e.ballT <= 0 && b.z < 80) {
          e.ballT = rand(2.6, 4.6);
          if (e.z === 0) this.leap(e);
          this.spout(e, 8);
          const ddx = b.x - e.x, ddy = b.y - e.y, n = Math.hypot(ddx, ddy) || 1;
          b.vx = ddx / n * rand(200, 320); b.vy = ddy / n * rand(70, 150); b.vz = rand(380, 540); b.cool = 0.3; b.kicks++;
          this.emoji('Bubbles', b.x, b.y - b.z - 30, 3, 80);
          sfx('good');
          if (Math.random() < 0.7) this.say(e, pick(['물대포 슛~!', '첨벙 슛!', '받아라~ 물보라!']), 1.2);
        }
        continue;
      }
      e.tx = b.x - e.dir * 10; e.ty = b.y; e.state = 'go'; e.speedMul = 1.7; e.sleep = false;
      const d = Math.hypot(e.x - b.x, (e.y - b.y) * 1.5);
      if (d < 46 * this.depth(e) && b.z < 40 && b.cool <= 0) {
        b.vx = e.dir * rand(220, 360); b.vy = rand(-110, 110); b.vz = rand(380, 560); b.cool = 0.4; b.kicks++;
        this.jump(e, 300); sfx('good');
        if (Math.random() < 0.5) this.say(e, pick(['슛~!', '내가 찼다!', '받아라!', '골인~!']), 1.2);
      }
    }
    b.cool -= dt;
    if (b.kicks >= 18 || b.life <= 0) {
      this.ball = null;
      this.ents.forEach((e, i) => { e.state = 'idle'; e.timer = e.mode === 'fly' ? 0.3 : 1.5; e.speedMul = 1; e.ballT = null; setTimeout(() => this.jump(e, 420), i * 120); });
      this.emoji('Trophy', b.x, b.y - 40, 3);
      sfx('levelup');
      this.opts.onBallEnd && this.opts.onBallEnd();
    }
  }

  ballBounds() {
    const v = this.vis;
    return { x0: Math.max(470, v.x0 + 70), x1: Math.min(960, v.x1 - 70), y0: 655, y1: Math.min(880, v.y1 - 10) };
  }
  // ---------- 파티클 ----------
  spawn(p) { if (this.parts.length < 420) { p.t = 0; this.parts.push(p); } }
  dust(e, n = 4, s = 1) {
    const k = this.sizeOf(e);
    for (let i = 0; i < n; i++) this.spawn({ k: 'dust', x: e.x + rand(-k.w * 0.3, k.w * 0.3), y: e.y + rand(-4, 4), vx: rand(-40, 40), vy: rand(-18, -4), life: rand(0.45, 0.8), size: rand(6, 12) * s });
  }
  splash(x, y, n = 10) {
    for (let i = 0; i < n; i++) this.spawn({ k: 'drop', x: x + rand(-14, 14), y, z: 0, vx: rand(-90, 90), vy: rand(-30, 10), vz: rand(220, 480), life: 1.2, size: rand(3, 6) });
    this.spawn({ k: 'ring', x, y, life: 1.2, size: 30 });
  }
  spout(e, n) { const k = this.sizeOf(e); for (let i = 0; i < n; i++) this.spawn({ k: 'drop', x: e.x + e.dir * k.w * 0.05, y: e.y, z: k.h * 0.75, vx: rand(-50, 50), vy: rand(-10, 10), vz: rand(250, 420), life: 1.4, size: rand(3, 6) }); }
  emoji(name, x, y, n = 5, spread = 120, opt = {}) {
    for (let i = 0; i < n; i++) this.spawn({ k: 'emoji', name, x, y, vx: rand(-spread, spread), vy: rand(-260, -140), g: opt.g ?? 260, life: opt.life ?? rand(1, 1.5), size: opt.size ?? rand(22, 34), rot: rand(-0.5, 0.5), vr: rand(-3, 3), delay: i * 0.05 });
  }
  updateParts(dt) {
    const keep = [];
    for (const p of this.parts) {
      if (p.delay > 0) { p.delay -= dt; keep.push(p); continue; }
      p.t += dt;
      if (p.t >= p.life) continue;
      if (p.k === 'drop') { p.vz -= G * 0.7 * dt; p.z += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.z < 0) { if (inPond(p.x, p.y)) this.spawn({ k: 'ring', x: p.x, y: p.y, life: 0.6, size: 8 }); continue; } }
      else if (p.k === 'emoji') { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt; }
      else if (p.k === 'flame') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy -= 60 * dt; }
      else if (p.k === 'petal' || p.k === 'flake') { p.x += (p.vx + Math.sin(this.t * 2 + p.ph) * 30) * dt; p.y += p.vy * dt; p.rot += dt * (p.vr || 1); }
      else if (p.k !== 'ring') { p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; }
      keep.push(p);
    }
    this.parts = keep;
    this.trails = this.trails.filter((tr) => (tr.life -= dt) > 0);
    this.bolts = this.bolts.filter((b) => (b.life -= dt) > 0);
    this.markers = this.markers.filter((m) => (m.life -= dt) > 0);
    if (this.flash) { this.flash.life -= dt; if (this.flash.life <= 0) this.flash = null; }
    if (this.auroraT > 0) this.auroraT -= dt;
  }
  updateAmbient(dt) {
    const v = this.vis;
    if (this.nightMix > 0.5) {
      while (this.ambient.filter((a) => a.k === 'fly').length < 16) this.ambient.push({ k: 'fly', x: rand(v.x0, v.x1), y: rand(560, 960), ph: Math.random() * 6, sp: rand(0.4, 1) });
    } else this.ambient = this.ambient.filter((a) => a.k !== 'fly');
    for (const a of this.ambient) { a.x += Math.cos(this.t * a.sp + a.ph) * 14 * dt; a.y += Math.sin(this.t * a.sp * 1.3 + a.ph) * 10 * dt; }
    // 낮: 가끔 꽃잎이 날림, 먼 하늘에 작은 새
    if (this.nightMix < 0.5 && Math.random() < dt * 0.9) this.spawn({ k: 'petal', x: rand(v.x0, v.x1), y: v.y0 - 20 + rand(0, 80), vx: rand(10, 30), vy: rand(18, 34), life: 14, size: rand(9, 14), rot: Math.random() * 6, vr: rand(-1.5, 1.5), ph: Math.random() * 6 });
    if (this.nightMix < 0.5 && this.birds.length < 1 && Math.random() < dt * 0.06) this.birds.push({ x: v.x0 - 30, y: rand(120, 300), vx: rand(40, 70), n: Math.floor(rand(2, 4)) });
    this.birds = this.birds.filter((b) => (b.x += b.vx * dt) < v.x1 + 60);
  }

  // ---------- 그리기 ----------
  draw(t) {
    const c = this.ctx, d = this.dpr, s = this.s;
    const sx = this.shake ? rand(-this.shake, this.shake) : 0, sy = this.shake ? rand(-this.shake, this.shake) : 0;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    c.setTransform(d * s, 0, 0, d * s, d * (this.ox + sx), d * (this.oy + sy));
    const N = WORLD_BG.size;
    if (this.imgs.day) c.drawImage(this.imgs.day, 0, 0, N, N);
    if (this.imgs.night && this.nightMix > 0.01) { c.globalAlpha = this.nightMix; c.drawImage(this.imgs.night, 0, 0, N, N); c.globalAlpha = 1; }
    this.drawAurora(c, t);
    this.drawPondGlints(c, t);
    // 먼 새
    c.strokeStyle = 'rgba(60,70,90,.55)'; c.lineWidth = 2.4; c.lineCap = 'round';
    for (const b of this.birds) for (let i = 0; i < b.n; i++) { const bx = b.x - i * 26, by = b.y + i * 9 + Math.sin(t * 3 + i) * 3, f = Math.sin(t * 10 + i) * 5; c.beginPath(); c.moveTo(bx - 8, by - f); c.quadraticCurveTo(bx - 3, by - 2, bx, by); c.quadraticCurveTo(bx + 3, by - 2, bx + 8, by - f); c.stroke(); }
    // 무지개 꼬리
    this.drawTrails(c);
    // 그림자
    for (const e of this.ents) this.drawShadow(e);
    if (this.ball) { c.fillStyle = 'rgba(30,50,20,.25)'; const r = 20 * (1 - Math.min(0.5, this.ball.z / 400)); c.beginPath(); c.ellipse(this.ball.x, this.ball.y, r * 1.4, r * 0.5, 0, 0, Math.PI * 2); c.fill(); }
    // 뒤쪽 파티클 (먼지·물결)
    for (const p of this.parts) if (p.k === 'dust' || p.k === 'ring') this.drawPart(c, p);
    // 개체 (깊이순)
    const key = (e) => (e.held ? 1e6 : e.mode === 'fly' ? e.y + 400 : e.y);
    const list = [...this.ents].sort((a, b) => key(a) - key(b));
    let ballDrawn = !this.ball;
    for (const e of list) {
      if (!ballDrawn && e.mode !== 'fly' && this.ball.y < e.y) { this.drawBall(c); ballDrawn = true; }
      this.drawEnt(c, e, t);
    }
    if (!ballDrawn) this.drawBall(c);
    // 앞쪽 파티클
    for (const p of this.parts) if (p.k !== 'dust' && p.k !== 'ring') this.drawPart(c, p);
    for (const m of this.markers) { const u = 1 - m.life / 0.7; c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - u)})`; c.lineWidth = 3; c.beginPath(); c.ellipse(m.x, m.y, 12 + u * 40, (12 + u * 40) * 0.38, 0, 0, Math.PI * 2); c.stroke(); }
    // 반딧불
    for (const a of this.ambient) { const al = (0.55 + 0.45 * Math.sin(t * 3 + a.ph)) * this.nightMix; const gr = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, 12); gr.addColorStop(0, `rgba(255,240,150,${al})`); gr.addColorStop(1, 'rgba(255,240,150,0)'); c.fillStyle = gr; c.beginPath(); c.arc(a.x, a.y, 12, 0, Math.PI * 2); c.fill(); }
    this.drawBolts(c);
    // 화면 좌표: 앞쪽 풀, 이름표, 번쩍임
    c.setTransform(d, 0, 0, d, 0, 0);
    this.drawGrass(c, t);
    for (const e of this.ents) this.drawLabel(c, e);
    if (this.flash) { c.fillStyle = this.flash.col; c.globalAlpha = Math.max(0, this.flash.life / this.flash.dur) * this.flash.a; c.fillRect(0, 0, this.W, this.H); c.globalAlpha = 1; }
    // 말풍선 위치
    for (const e of this.ents) {
      if (!e.bubbleEl) continue;
      const k = this.sizeOf(e);
      const p = this.toScreen(e.x, e.y - e.z - (e.mode === 'fly' ? k.h * 0.5 : k.h) - 8);
      e.bubbleEl.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
  }
  drawShadow(e) {
    const c = this.ctx, k = this.sizeOf(e);
    if (e.mode === 'swim') return;
    let gy = e.y, alpha = 0.28, sc = 1;
    if (e.mode === 'fly') { gy = clamp(e.y + 330, TERRAIN.ground.y0 + 10, 900); alpha = 0.13; sc = 0.6; }
    if (e.held) { gy = clamp(e.y + 120, TERRAIN.ground.y0, TERRAIN.ground.y1); alpha = 0.15; sc = 0.6; }
    const hz = Math.min(1, e.z / 300);
    const r = k.w * 0.34 * sc * (1 - hz * 0.4);
    const g = c.createRadialGradient(e.x, gy, 0, e.x, gy, r);
    g.addColorStop(0, `rgba(25,45,20,${alpha * (1 - hz * 0.5)})`); g.addColorStop(1, 'rgba(25,45,20,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(e.x, gy, r, r * 0.32, 0, 0, Math.PI * 2); c.fill();
  }
  drawEnt(c, e, t) {
    const k = this.sizeOf(e), sp = e.sp;
    let frame;
    if (e.held) frame = Math.floor(e.frameT) % 4;
    else if (e.mode === 'fly' || e.mode === 'swim') frame = Math.floor(e.frameT) % 4;
    else if (e.mode === 'hop') frame = e.z > 0 ? (e.vz > 120 ? 1 : e.vz > -200 ? 2 : 3) : 0;
    else frame = (e.state === 'go' && !e.act) ? Math.floor(e.frameT) % 4 : (sp.idle ?? 1);
    const legend = e.pet.xp >= MAX_PET_XP;
    // 숨쉬기 + 스쿼시
    const breathe = 1 + Math.sin(t * 2.4 + e.x * 0.01) * 0.018;
    const sq = clamp(e.sq, -0.35, 0.35);
    const scx = (1 + sq * 0.55) / Math.sqrt(breathe), scy = (1 - sq) * breathe;
    let bob = 0;
    if (e.mode === 'fly') bob = Math.sin(t * 2.2 + e.x * 0.02) * 7 + Math.sin(e.frameT * Math.PI / 2) * 4;
    else if (e.mode === 'walk' || e.mode === 'waddle') bob = e.state === 'go' && !e.act ? -Math.abs(Math.sin(e.frameT * Math.PI / 2)) * 4 : 0;
    const anchorY = e.mode === 'fly' ? 0.5 : e.mode === 'swim' ? 0.66 : 1; // 발 위치
    const baseY = e.y - e.z + bob;
    // 전설 오라
    if (legend) {
      const cy = baseY - k.h * (anchorY - 0.5) - (e.mode === 'swim' ? k.h * 0.1 : 0);
      const pulse = 0.75 + Math.sin(t * 2.6 + e.x) * 0.25;
      const r = k.h * 0.8;
      const g = c.createRadialGradient(e.x, cy, r * 0.15, e.x, cy, r);
      g.addColorStop(0, hexA(e.pet.species.color, 0.32 * pulse)); g.addColorStop(1, hexA(e.pet.species.color, 0));
      c.fillStyle = g; c.beginPath(); c.arc(e.x, cy, r, 0, Math.PI * 2); c.fill();
      // 주위를 도는 반짝이
      for (let i = 0; i < 2; i++) {
        const a = t * 1.8 + i * Math.PI;
        this.star(c, e.x + Math.cos(a) * k.w * 0.55, cy + Math.sin(a) * k.h * 0.18, 4 + Math.sin(t * 5 + i) * 1.5, 'rgba(255,240,170,.95)');
      }
    }
    c.save();
    c.translate(e.x, baseY);
    if (e.mode === 'swim' && e.z < k.h * 0.6) {
      // 물 아래는 잘라서 잠긴 느낌
      c.beginPath(); c.rect(-k.w, -k.h * 2, k.w * 2, k.h * 2 + e.z + 2); c.clip();
    }
    c.rotate(e.rot + e.spin * (e.face >= 0 ? 1 : -1));
    c.scale(e.face * scx, scy);
    if (e.sleep && this.nightMix > 0.5) c.filter = 'brightness(0.85)';
    c.drawImage(e.sheet, frame * sp.fw, 0, sp.fw, sp.fh, -k.w / 2, -k.h * anchorY, k.w, k.h);
    c.restore();
    if (e.mode === 'swim' && e.z < k.h * 0.6) {
      // 물결 띠
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5;
      const wy = e.y + 2, ww = k.w * 0.5;
      c.beginPath(); c.ellipse(e.x, wy, ww, ww * 0.18, 0, 0, Math.PI * 2); c.stroke();
    }
    if (e.selected) {
      const p = 0.5 + Math.sin(t * 5) * 0.5;
      c.strokeStyle = `rgba(255,255,255,${0.5 + p * 0.4})`; c.lineWidth = 3;
      const gy = e.mode === 'fly' ? baseY + k.h * 0.55 : e.y + 4;
      c.beginPath(); c.ellipse(e.x, gy, k.w * 0.42, k.w * 0.12, 0, 0, Math.PI * 2); c.stroke();
    }
  }
  drawLabel(c, e) {
    const k = this.sizeOf(e);
    const p = this.toScreen(e.x, e.y - e.z + (e.mode === 'fly' ? k.h * 0.52 : e.mode === 'swim' ? k.h * 0.12 : 6));
    const name = e.pet.name || e.pet.species.legend;
    c.font = `800 ${this.phone ? 11 : 12.5}px "Pretendard Variable", Pretendard, sans-serif`;
    const w = c.measureText(name).width + 16, h = this.phone ? 19 : 21;
    c.fillStyle = e.pet.xp >= MAX_PET_XP ? 'rgba(255,240,200,.92)' : 'rgba(255,255,255,.88)';
    roundRect(c, p.x - w / 2, p.y + 4, w, h, h / 2); c.fill();
    c.fillStyle = '#7A4B00'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(name, p.x, p.y + 4 + h / 2 + 0.5);
  }
  drawBall(c) {
    const b = this.ball; if (!b || !this.imgs.ball) return;
    const r = 24;
    c.save(); c.translate(b.x, b.y - b.z - r); c.rotate(b.spin); c.drawImage(this.imgs.ball, -r, -r, r * 2, r * 2); c.restore();
  }
  drawPart(c, p) {
    const u = p.t / p.life;
    if (p.k === 'dust') {
      c.fillStyle = `rgba(255,255,245,${0.55 * (1 - u)})`;
      c.beginPath(); c.arc(p.x, p.y, p.size * (0.6 + u), 0, Math.PI * 2); c.fill();
    } else if (p.k === 'ring') {
      c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - u)})`; c.lineWidth = 2;
      const r = p.size * (0.4 + u);
      c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2); c.stroke();
    } else if (p.k === 'drop') {
      c.fillStyle = `rgba(150,215,255,${0.9 * (1 - u * 0.5)})`;
      c.beginPath(); c.arc(p.x, p.y - p.z, p.size, 0, Math.PI * 2); c.fill();
    } else if (p.k === 'spark') {
      this.star(c, p.x, p.y, p.size * (1 - u * 0.5), `rgba(255,245,190,${1 - u})`);
    } else if (p.k === 'flame') {
      const r = p.size * (1 + u * 1.6);
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,250,200,${1 - u})`); g.addColorStop(0.4, `rgba(255,170,40,${0.9 * (1 - u)})`); g.addColorStop(1, 'rgba(230,60,20,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
    } else if (p.k === 'petal') {
      if (!this.imgs.petal) return;
      c.save(); c.globalAlpha = Math.min(1, (1 - u) * 3) * 0.9; c.translate(p.x, p.y); c.rotate(p.rot); c.drawImage(this.imgs.petal, -p.size / 2, -p.size / 2, p.size, p.size); c.restore();
    } else if (p.k === 'flake') {
      c.fillStyle = `rgba(255,255,255,${0.9 * Math.min(1, (1 - u) * 3)})`; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill();
    } else if (p.k === 'z') {
      c.font = `900 ${p.size * (1 + u * 0.5)}px sans-serif`; c.fillStyle = `rgba(200,210,255,${1 - u})`; c.textAlign = 'center'; c.fillText('Z', p.x, p.y);
    } else if (p.k === 'emoji') {
      const im = this.imgs[p.name] || (p.name === 'Red heart' ? this.imgs.heart : null);
      if (!im) return;
      const pop = Math.min(1, p.t / 0.15);
      const sz = p.size * (0.5 + pop * 0.5) * (1 - Math.max(0, u - 0.7));
      c.save(); c.globalAlpha = 1 - Math.max(0, (u - 0.6) / 0.4); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.drawImage(im, -sz / 2, -sz / 2, sz, sz); c.restore();
    }
  }
  star(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.38 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  drawPondGlints(c, t) {
    const p = TERRAIN.pond;
    for (let i = 0; i < 7; i++) {
      const a = i * 2.1, x = p.cx + Math.cos(a) * p.rx * 0.6 * ((i % 3) / 3 + 0.3), y = p.cy + Math.sin(a * 1.7) * p.ry * 0.5;
      const al = Math.max(0, Math.sin(t * 1.8 + i * 1.3));
      this.star(c, x, y, 3 + al * 3, `rgba(255,255,255,${al * 0.9})`);
    }
  }
  drawTrails(c) {
    if (!this.trails.length) return;
    const cols = ['#FF6B6B', '#FFB347', '#FFE66D', '#7BE495', '#6EC6FF', '#B28DFF'];
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (let k = 0; k < cols.length; k++) {
      c.strokeStyle = cols[k]; c.lineWidth = 7;
      c.beginPath();
      this.trails.forEach((tr, i) => { const yy = tr.y + 26 + (k - 2.5) * 7; c.globalAlpha = Math.min(1, tr.life) * 0.85; if (i === 0) c.moveTo(tr.x, yy); else c.lineTo(tr.x, yy); });
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  drawBolts(c) {
    for (const b of this.bolts) {
      c.strokeStyle = `rgba(255,250,190,${b.life / b.dur})`; c.lineWidth = 7; c.shadowColor = '#FFF5A0'; c.shadowBlur = 18;
      c.beginPath(); b.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke();
      c.lineWidth = 2.5; c.strokeStyle = '#fff'; c.stroke(); c.shadowBlur = 0;
    }
  }
  drawAurora(c, t) {
    if (this.auroraT <= 0) return;
    const a = Math.min(1, this.auroraT / 1.5) * 0.55;
    const cols = ['#5EEAD4', '#A78BFA', '#F0ABFC'];
    cols.forEach((col, i) => {
      const g = c.createLinearGradient(0, 80, 0, 360);
      g.addColorStop(0, hexA(col, 0)); g.addColorStop(0.5, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g; c.beginPath();
      for (let x = 0; x <= 1024; x += 32) c.lineTo(x, 150 + i * 50 + Math.sin(x * 0.01 + t * 1.2 + i) * 40);
      for (let x = 1024; x >= 0; x -= 32) c.lineTo(x, 260 + i * 50 + Math.sin(x * 0.012 + t + i) * 40);
      c.closePath(); c.fill();
    });
  }
  drawGrass(c, t) {
    const night = this.nightMix;
    const base = this.H + 4;
    for (const b of this.grass) {
      const x = b.x * this.W, h = b.h * (this.phone ? 0.9 : 1.1);
      const sw = Math.sin(t * 1.6 + b.ph + b.x * 4) * 6;
      c.strokeStyle = night > 0.5 ? shade(b.c, -0.45) : b.c; c.lineWidth = b.w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + sw * 0.4, base - h * 0.6, x + sw, base - h); c.stroke();
    }
  }

  // ---------- 상호작용 ----------
  hit(cx, cy) {
    const sorted = [...this.ents].sort((a, b) => (b.mode === 'fly' ? b.y + 400 : b.y) - (a.mode === 'fly' ? a.y + 400 : a.y));
    for (const e of sorted) {
      const k = this.sizeOf(e);
      const anchorY = e.mode === 'fly' ? 0.5 : e.mode === 'swim' ? 0.66 : 1;
      const ccx = e.x, ccy = e.y - e.z - k.h * (anchorY - 0.5);
      const p = this.toScreen(ccx, ccy);
      if (Math.abs(cx - p.x) < k.w * this.s * 0.42 && Math.abs(cy - p.y) < k.h * this.s * 0.47) return e;
    }
    return null;
  }
  say(e, text, sec = 2.2) {
    const b = e.bubbleEl; if (!b) return;
    b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); e.bubbleT = sec;
  }
  react(e, kid) {
    e.sleep = false;
    const names = kid.profile.name;
    const lines = [...(e.pet.species.lines || []), `${names}, 고마워! 덕분에 전설이 됐어!`, '간지러워~ 히히', '같이 놀자!', `${names} 최고! ❤`, '오늘 숙제 다 했어?'];
    if (this.night) lines.push('음냐… 깼잖아~', '별이 예쁘다…');
    const k = this.sizeOf(e);
    const top = { x: e.x, y: e.y - e.z - (e.mode === 'fly' ? k.h * 0.5 : k.h * 0.8) };
    const r = Math.random();
    if (e.mode === 'fly') {
      if (r < 0.4) { e.spinV = 10; e.vy -= 140; this.emoji('Sparkles', top.x, top.y, 4); }
      else if (r < 0.7) { e.vy -= 260; e.sqv -= 4; this.emoji('Sparkling heart', top.x, top.y, 5); }
      else { e.sqv += 5; this.emoji('Red heart', top.x, top.y, 6); }
    } else if (e.mode === 'swim') {
      if (r < 0.6) { this.leap(e); this.emoji('Sparkles', top.x, top.y, 3); } else { e.sqv += 5; this.emoji('Red heart', top.x, top.y, 5); this.splash(e.x, e.y, 6); }
    } else {
      if (r < 0.35) { this.jump(e, 640); this.emoji('Sparkles', top.x, top.y, 4); }
      else if (r < 0.6) { this.jump(e, 560); e.spinV = 9; this.emoji('Glowing star', top.x, top.y, 3); }
      else if (r < 0.8) { e.act = { type: 'hops', n: 3, t: 0 }; this.emoji('Musical notes', top.x, top.y, 3); }
      else { e.sqv += 6; setTimeout(() => (e.sqv -= 6), 220); this.emoji('Red heart', top.x, top.y, 6); }
    }
    this.say(e, pick(lines));
    sfx(r < 0.5 ? 'good' : 'coin');
  }
  skill(e, kid) {
    e.sleep = false;
    const k = this.sizeOf(e);
    const top = { x: e.x, y: e.y - e.z - (e.mode === 'fly' ? k.h * 0.5 : k.h * 0.7) };
    const name = e.pet.species.legend;
    sfx('levelup');
    switch (e.sp.skill) {
      case 'rainbow': {
        const p = this.clampTo('fly', 512, 300);
        e.act = { type: 'dash', t: 0, dur: 2.4, cx: p.x, cy: p.y, rx: 230, ry: 110, a0: Math.atan2(e.y - p.y, e.x - p.x), sgn: Math.random() < 0.5 ? 1 : -1 };
        this.emoji('Sparkles', top.x, top.y, 8, 160);
        this.say(e, '무지개 질주~!', 2.4);
        break;
      }
      case 'fire':
        e.act = { type: 'breath', t: 0, dur: 1.4 };
        this.flash = { col: '#FF9F43', a: 0.18, life: 1.2, dur: 1.2 };
        this.say(e, '화르르륵~!', 2);
        break;
      case 'flameRing':
        for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; this.spawn({ k: 'flame', x: top.x, y: top.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 170, life: 0.9, size: 14 }); }
        e.vy -= 300; this.flash = { col: '#FF7A45', a: 0.22, life: 1, dur: 1 };
        this.say(e, '불꽃은 영원해!', 2);
        break;
      case 'thunder': {
        const pts = []; let x = e.x + rand(-60, 60), y = 0;
        while (y < e.y + 60) { pts.push({ x, y }); x += rand(-40, 40); y += rand(40, 70); }
        this.bolts.push({ pts, life: 0.6, dur: 0.6 });
        this.flash = { col: '#FFFFFF', a: 0.55, life: 0.35, dur: 0.35 };
        this.shake = 10; this.emoji('High voltage', top.x, top.y, 6, 140);
        this.say(e, '번쩍! 우르릉!', 2);
        break;
      }
      case 'magic':
        for (let i = 0; i < 3; i++) setTimeout(() => { const p = this.clampTo('fly', e.x + rand(-200, 200), e.y + rand(-120, 60)); this.emoji('Sparkles', p.x, p.y, 8, 200, { g: 60 }); this.emoji('Glowing star', p.x, p.y, 4, 160, { g: 60 }); sfx('coin'); }, i * 350);
        this.say(e, '수리수리 마수리~', 2.2);
        break;
      case 'bloom':
        for (let i = 0; i < 40; i++) this.spawn({ k: 'petal', x: top.x + rand(-40, 40), y: top.y, vx: rand(-160, 160), vy: rand(-60, 120), life: 3, size: rand(12, 20), rot: Math.random() * 6, vr: rand(-3, 3), ph: Math.random() * 6 });
        this.say(e, '봄이 왔어요~', 2);
        break;
      case 'roar':
        this.shake = 14; this.jump(e, 300); e.sqv += 6;
        this.emoji('Sparkles', top.x, top.y, 10, 260);
        this.flash = { col: '#FFD24D', a: 0.25, life: 0.8, dur: 0.8 };
        this.say(e, '어흥!!! 내가 왕이다!', 2.2);
        break;
      case 'howl':
        for (let i = 0; i < 60; i++) this.spawn({ k: 'flake', x: rand(this.vis.x0, this.vis.x1), y: this.vis.y0 - rand(0, 300), vx: rand(-10, 20), vy: rand(50, 90), life: 7, size: rand(2.5, 5), ph: Math.random() * 6 });
        this.flash = { col: '#9BD3FF', a: 0.22, life: 1.2, dur: 1.2 };
        this.say(e, '아우우우~!', 2.4);
        break;
      case 'aurora':
        this.auroraT = 6;
        for (let i = 0; i < 40; i++) this.spawn({ k: 'flake', x: rand(this.vis.x0, this.vis.x1), y: this.vis.y0 - rand(0, 200), vx: rand(-10, 20), vy: rand(40, 70), life: 7, size: rand(2.5, 4.5), ph: Math.random() * 6 });
        this.say(e, '오로라를 불러왔어!', 2.4);
        break;
      case 'moonJump':
        e.vz = 1250; e.sqv -= 6;
        for (let i = 0; i < 6; i++) setTimeout(() => this.emoji('Glowing star', e.x, e.y - e.z - 40, 2, 80, { g: 120 }), i * 120);
        this.say(e, '달까지 점프~!', 2.2);
        break;
      case 'spout':
        this.spout(e, 50); this.say(e, '푸슈우우~!', 2);
        break;
      case 'bubbles':
        for (let i = 0; i < 18; i++) this.spawn({ k: 'emoji', name: 'Bubbles', x: e.x + rand(-60, 60), y: e.y - 20, vx: rand(-30, 30), vy: rand(-140, -60), g: -20, life: 2, size: rand(18, 30), rot: 0, vr: 0, delay: i * 0.05 });
        this.leap(e); this.say(e, '보글보글 대마왕!', 2);
        break;
      case 'petals':
        for (let i = 0; i < 70; i++) this.spawn({ k: 'petal', x: rand(this.vis.x0, this.vis.x1), y: this.vis.y0 - rand(0, 250), vx: rand(20, 70), vy: rand(50, 110), life: 8, size: rand(12, 20), rot: Math.random() * 6, vr: rand(-2, 2), ph: Math.random() * 6 });
        e.sqv += 4; this.say(e, '벚꽃 비가 내려요~', 2.4);
        break;
      default:
        this.emoji('Sparkles', top.x, top.y, 10, 200);
    }
    this.opts.onSkill && this.opts.onSkill(name);
  }
  callTo(x, y) {
    this.markers.push({ x, y, life: 0.7 });
    for (const e of this.ents) {
      if (e.held) continue;
      e.act = null; e.sleep = false;
      if (e.mode === 'fly') { const p = this.clampTo('fly', x + rand(-80, 80), y - 220); e.tx = p.x; e.ty = p.y; e.state = 'go'; e.speedMul = 1.8; }
      else if (e.mode === 'swim') { const p = this.clampTo('swim', x, y); e.tx = p.x; e.ty = p.y; e.state = 'go'; e.speedMul = 2.2; }
      else { const p = this.clampTo('walk', x + rand(-50, 50), y + rand(-25, 25)); e.tx = p.x; e.ty = p.y; e.state = 'go'; e.speedMul = 1.9; }
      if (Math.random() < 0.6) this.say(e, pick(['!', '가요~!', '부르셨어요?', '나 여기!']), 1.2);
    }
    sfx('tap');
  }
  gather() {
    const n = this.ents.length;
    this.ents.forEach((e, i) => {
      e.act = null; e.sleep = false;
      const x = 560 + (i - (n - 1) / 2) * 120;
      if (e.mode === 'fly') { const p = this.clampTo('fly', x, 380); e.tx = p.x; e.ty = p.y; }
      else if (e.mode === 'swim') { const p = this.clampTo('swim', 250, 770); e.tx = p.x; e.ty = p.y; }
      else { const p = this.clampTo('walk', x, 760); e.tx = p.x; e.ty = p.y; }
      e.state = 'go'; e.speedMul = 2.2;
    });
    setTimeout(() => {
      this.ents.forEach((e, i) => setTimeout(() => {
        e.dir = 1;
        if (e.mode === 'fly') { e.spinV = 10; e.vy -= 200; } else if (e.mode === 'swim') this.leap(e); else this.jump(e, 620);
        this.say(e, pick(['와아!', '모였다!', '짠!', '야호!']), 1.6);
        const k = this.sizeOf(e); this.emoji('Party popper', e.x, e.y - e.z - k.h * 0.8, 2);
      }, i * 160));
      sfx('levelup');
      celebrate(0.8);
    }, 1800);
  }
  throwBall() {
    const bb = this.ballBounds();
    const sx = (bb.x0 + bb.x1) / 2, sy = bb.y1;
    this.ball = { x: sx, y: sy, z: 80, vx: rand(-160, 160), vy: rand(-220, -140), vz: 700, spin: 0, cool: 0, kicks: 0, life: 30 };
    sfx('tap');
    const talker = this.ents.find((e) => !e.held);
    if (talker) this.say(talker, '같이 차자! 공을 톡 치거나 밀어 봐!', 2.4);
  }
  // 나도 공놀이: 공을 탭하면 톡, 밀면(스와이프) 그 방향으로 뻥!
  hitBall(cx, cy) {
    const b = this.ball; if (!b) return false;
    const p = this.toScreen(b.x, b.y - b.z - 24);
    return Math.hypot(cx - p.x, cy - p.y) < Math.max(40, 24 * this.s * 1.8);
  }
  kickBall(cx, cy, sdx = 0, sdy = 0) {
    const b = this.ball; if (!b) return;
    const p = this.toScreen(b.x, b.y - b.z - 24);
    const len = Math.hypot(sdx, sdy);
    let vx, vy;
    if (len > 14) { vx = sdx / this.s * 5; vy = sdy / this.s * 3; }
    else { const ax = p.x - cx, ay = p.y - cy, n = Math.hypot(ax, ay) || 1; vx = (ax / n) * rand(260, 380) + rand(-60, 60); vy = (ay / n) * rand(60, 140); }
    b.vx = clamp(vx, -680, 680); b.vy = clamp(vy, -320, 320); b.vz = rand(440, 620) + Math.min(260, len * 2);
    b.cool = 0.15; b.life = Math.max(b.life, 14);
    this.spawn({ k: 'ring', x: b.x, y: b.y, life: 0.6, size: 26 });
    this.emoji('Sparkles', b.x, b.y - b.z - 30, 2, 80);
    sfx('good');
    const fan = pick(this.ents.filter((e) => !e.held));
    if (fan && Math.random() < 0.5) this.say(fan, pick(['나이스 슛!', '내 쪽으로 차 줘!', '우와 잘 찬다!', '패스~!']), 1.2);
  }
}

function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function hexA(hex, a) { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function shade(hex, f) { const h = hex.replace('#', ''); const n = parseInt(h, 16); const m = (v) => Math.round(clamp(v * (1 + f), 0, 255)); return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`; }

// ---------------------------------------------------------------- 화면
export function PetWorld({ kid, onBack }) {
  const pets = M.petsOf(kid);
  const legends = pets.filter((p) => p.xp >= MAX_PET_XP && SPRITES[p.species.id]);
  const key = legends.map((p) => p.id).join('|');
  const canvasRef = useRef(null);
  const ovRef = useRef(null);
  const eng = useRef(null);
  const [night, setNight] = useState(isNightNow());
  const [selId, setSelId] = useState(legends[0]?.id || null);
  const [hint, setHint] = useState(true);
  const [loading, setLoading] = useState(true);
  const [ballOn, setBallOn] = useState(false);
  const sel = legends.find((p) => p.id === selId) || legends[0];
  const kidRef = useRef(kid); kidRef.current = kid;

  useEffect(() => {
    const cv = canvasRef.current, ov = ovRef.current;
    if (!cv) return;
    const en = new WorldEngine(cv, ov, { night, onBallEnd: () => setBallOn(false) });
    eng.current = en;
    window.__pw = en;
    en.load(legends).then(() => { if (!en.dead) { setLoading(false); en.ents.forEach((e) => (e.selected = e.id === (sel && sel.id))); } });
    let last = performance.now(), raf = 0;
    const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (document.visibilityState === 'visible') en.step(dt); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    let ro = null;
    const onResize = () => en.resize();
    try { ro = new ResizeObserver(onResize); ro.observe(cv); } catch (_) { window.addEventListener('resize', onResize); }
    return () => { cancelAnimationFrame(raf); en.destroy(); if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize); };
  }, [key]);
  useEffect(() => { if (eng.current) eng.current.night = night; }, [night]);
  useEffect(() => { if (eng.current) eng.current.ents.forEach((e) => (e.selected = e.id === (sel && sel.id))); }, [sel && sel.id]);

  // 포인터: 탭 / 들어 올리기 / 빈 곳 탭
  const drag = useRef(null);
  function local(ev) { const r = canvasRef.current.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function onDown(ev) {
    const en = eng.current; if (!en || !en.ready) return;
    const p = local(ev);
    if (en.ball && en.hitBall(p.x, p.y)) {
      drag.current = { ball: true, sx: p.x, sy: p.y, t: performance.now() };
      try { canvasRef.current.setPointerCapture(ev.pointerId); } catch (_) {}
      return;
    }
    const e = en.hit(p.x, p.y);
    drag.current = { e, sx: p.x, sy: p.y, moved: false, t: performance.now() };
    try { canvasRef.current.setPointerCapture(ev.pointerId); } catch (_) {}
  }
  function onMove(ev) {
    const d = drag.current, en = eng.current; if (!d || !d.e || !en) return;
    const p = local(ev);
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 9) {
      d.e.heldDepth = en.depth(d.e) * 1.08;
      d.moved = true; d.e.held = true; d.e.act = null; d.e.sleep = false; d.e.z = 0; d.e.vz = 0; d.e.state = 'idle';
      en.say(d.e, pick(['우와 날아간다~', '어디 가요?', '높다 높다!', '히히 간지러워']), 1.4); sfx('tap'); vibrate(10);
      setHint(false);
    }
    if (d.moved) { const w = en.toWorld(p.x, p.y); const k = en.sizeOf(d.e); d.e.hx = w.x; d.e.hy = w.y + (d.e.mode === 'fly' ? 0 : k.h * 0.45); }
  }
  function onUp(ev) {
    const d = drag.current, en = eng.current; drag.current = null;
    if (!d || !en) return;
    const p = local(ev);
    if (d.ball) { en.kickBall(d.sx, d.sy, p.x - d.sx, p.y - d.sy); vibrate(15); setHint(false); return; }
    if (d.e) {
      const e = d.e;
      if (!d.moved) {
        setSelId(e.id); setHint(false); vibrate(12);
        const now = Date.now();
        e.taps = [...e.taps.filter((x) => now - x < 1300), now];
        if (e.taps.length >= 3) { e.taps = []; en.skill(e, kidRef.current); } else en.react(e, kidRef.current);
        return;
      }
      // 놓기: 땅으로 떨어지거나(걷는 펫), 그 자리에서 날거나(나는 펫), 연못으로 퐁당(헤엄 펫)
      e.held = false;
      if (e.mode === 'fly') { const q = en.clampTo('fly', e.x, e.y); e.tx = q.x; e.ty = q.y; e.state = 'go'; e.vx = 0; e.vy = 0; e.sqv -= 3; return; }
      const q = en.clampTo(e.mode === 'swim' ? 'swim' : 'walk', e.x, Math.max(e.y, TERRAIN.ground.y0 + 20));
      const height = Math.max(0, q.y - e.y);
      e.x = q.x; e.y = q.y; e.z = height; e.vz = 0; e.rot = 0; e.state = 'idle'; e.timer = 1.2; e.tx = q.x; e.ty = q.y;
      return;
    }
    if (!d.moved) { setHint(false); const w = en.toWorld(p.x, p.y); en.callTo(w.x, w.y); }
  }

  const legendDay = sel && sel.legendAt ? shortDate(dateKey(new Date(sel.legendAt))) : '';
  const days = sel ? Math.max(1, Math.round((Date.now() - (sel.adoptedAt || Date.now())) / 86400000)) : 0;

  return html`<div class="pw fade-in">
    <canvas class="pw-canvas" ref=${canvasRef} onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}></canvas>
    <div class="pw-ov" ref=${ovRef}></div>
    ${loading && legends.length > 0 && html`<div class="pw-loading">펫들이 놀러 오는 중…</div>`}
    ${legends.length === 0 && html`<div class="pw-empty"><img src=${E('Egg')} alt="" /><b>아직 전설 펫이 없어요</b><span>펫을 전설까지 키우면 여기 펫 월드에서 함께 살아요!</span></div>`}
    ${hint && legends.length > 0 && !loading && html`<div class="pw-hint">펫을 눌러 보세요 · 빠르게 3번 = 전설 스킬 · 꾹 눌러 들어 올리기 · 빈 곳을 누르면 달려와요 · 공 놀이 땐 공을 톡 치거나 밀어 보세요</div>`}
    <div class="pw-top">
      <button class="btn sm pw-glass" onClick=${onBack}><${Icon} name="chevron-left" size=${16} />내 펫</button>
      <div class="pw-title pw-glass"><b>${kid.profile.name}의 펫 월드</b><span>전설 ${legends.length}마리</span></div>
      <span class="grow"></span>
      <button class="pw-daynight pw-glass" aria-label="낮/밤 바꾸기" onClick=${() => { setNight(!night); sfx('tap'); }}><img src=${E(night ? 'Sun' : 'Crescent moon')} alt="" /></button>
    </div>
    ${legends.length > 0 && html`<div class="pw-bottom">
      ${sel && html`<div class="pw-info pw-glass">
        <span class="pw-ava" style=${`background-image:url(assets/world/${sel.species.id}.webp);aspect-ratio:${SPRITES[sel.species.id].fw}/${SPRITES[sel.species.id].fh}`}></span>
        <div class="grow" style="min-width:0"><b>${sel.name || sel.species.legend}</b><div class="tiny">${sel.species.legend} · 전설 달성 ${legendDay} · 함께한 지 ${days}일</div></div>
      </div>`}
      <div class="pw-actions">
        <button class="btn sm pw-glass" disabled=${ballOn} onClick=${() => { eng.current && eng.current.throwBall(); setBallOn(true); setHint(false); }}><img src=${E('Soccer ball')} width="20" height="20" alt="" />공 놀이</button>
        <button class="btn sm pw-glass" onClick=${() => { eng.current && eng.current.gather(); setHint(false); }}><img src=${E('Party popper')} width="20" height="20" alt="" />모두 모여!</button>
      </div>
    </div>`}
  </div>`;
}
