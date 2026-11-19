// Pet World 데이터 — 전설 펫 전신 스프라이트(4프레임) · 움직임 종류 · 배경 지형 (배경 이미지 1024×1024 좌표)
// 스프라이트/배경: KidQuest 전용으로 생성한 일러스트 (assets/world/*.webp)

export const WORLD_BG = { day: 'assets/world/day.webp', night: 'assets/world/night.webp', size: 1024 };

// mode: fly(하늘) · walk(걷기) · hop(깡총) · swim(연못) · waddle(뒤뚱)
// fps: 프레임 속도 · h: 기준 키(배경 좌표 px) · idle: 멈춰 있을 때 프레임
export const SPRITES = {
  unicorn: { fw: 340, fh: 313, mode: 'fly', fps: 7, h: 150, skill: 'rainbow' },
  dragon: { fw: 340, fh: 264, mode: 'fly', fps: 7, h: 135, skill: 'fire' },
  phoenix: { fw: 340, fh: 302, mode: 'fly', fps: 8, h: 145, skill: 'flameRing' },
  eagle: { fw: 340, fh: 275, mode: 'fly', fps: 8, h: 140, skill: 'thunder' },
  owl: { fw: 340, fh: 290, mode: 'fly', fps: 7, h: 135, skill: 'magic' },
  butterfly: { fw: 340, fh: 315, mode: 'fly', fps: 11, h: 125, skill: 'bloom' },
  lion: { fw: 306, fh: 340, mode: 'walk', fps: 7, h: 165, idle: 1, skill: 'roar' },
  wolf: { fw: 340, fh: 337, mode: 'walk', fps: 7, h: 160, idle: 1, skill: 'howl' },
  polar: { fw: 279, fh: 340, mode: 'walk', fps: 6, h: 165, idle: 1, skill: 'aurora' },
  rabbit: { fw: 287, fh: 340, mode: 'hop', fps: 0, h: 150, idle: 0, skill: 'moonJump' },
  whale: { fw: 340, fh: 285, mode: 'swim', fps: 4, h: 120, skill: 'spout' },
  kraken: { fw: 340, fh: 309, mode: 'swim', fps: 4, h: 120, skill: 'bubbles' },
  tree: { fw: 315, fh: 340, mode: 'waddle', fps: 5, h: 170, idle: 1, skill: 'petals' }
};

// 배경 지형 (1024 기준)
export const TERRAIN = {
  ground: { x0: 110, x1: 980, y0: 605, y1: 935 },
  sky: { x0: 150, x1: 880, y0: 150, y1: 440 },
  pond: { cx: 160, cy: 768, rx: 118, ry: 36 }
};
export function onGround(x, y) {
  const g = TERRAIN.ground;
  if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) return false;
  if (x < 440 && y > 615 && y < 885) return false; // 연못·돌
  if (x < 330 && y >= 870) return false; // 왼쪽 아래 꽃밭
  return true;
}
export function inPond(x, y) {
  const p = TERRAIN.pond;
  return ((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 <= 1;
}
