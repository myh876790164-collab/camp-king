// =============================================
//  墙壁自动拼接 + 门
//  墙（def.wall）和门（def.door）会看上下左右四个邻居是不是墙/门，
//  自动画成横墙、竖墙、拐角、T 字路口、十字路口，连成一片。
//  画法（3/4 俯视角）：墙顶是浅色的一条，墙朝南的一面是深色的立面。
//  门：自己人靠近会自动打开，可以穿过；怪物过不去，只能把门砸烂。
// =============================================

// 墙的材质（def.wallStyle）
const WALL_STYLES = {
  wood: { top: '#b08850', topHi: '#d0a868', topLine: '#8f6a42', front: '#8f6a42', frontDk: '#6e4a2e', frontHi: '#a3804f' },
  log: { top: '#a3804f', topHi: '#c49a64', topLine: '#6e4a2e', front: '#8f6a42', frontDk: '#5a3a22', frontHi: '#b07a45' },
  stone: { top: '#a7b2c2', topHi: '#c8d0dc', topLine: '#7a8597', front: '#8b93a3', frontDk: '#566c86', frontHi: '#a7b2c2' },
  metal: { top: '#7a8090', topHi: '#a0a6b4', topLine: '#5a5f6e', front: '#8b93a3', frontDk: '#5a5f6e', frontHi: '#b0b6c4' },
};
const N_ = 1, E_ = 2, S_ = 4, W_ = 8;

function isWallLike(b) { return !!(b && (b.def.wall || b.def.door)); }
// 计算某格四个方向哪些连着墙/门
function wallMask(x, y, selfAlso) {
  const at = (xx, yy) => (inMap(xx, yy) ? G.bld[idx(xx, yy)] : null);
  let m = 0;
  if (isWallLike(at(x, y - 1))) m |= N_;
  if (isWallLike(at(x + 1, y))) m |= E_;
  if (isWallLike(at(x, y + 1))) m |= S_;
  if (isWallLike(at(x - 1, y))) m |= W_;
  return m;
}

// 在 16×16 的格子里画一块墙（g 已经放大 2 倍，单位是原始像素）
// kind: 'wall' / 'doorH'（横向门）/ 'doorV'（竖向门）；open = 门是否打开
function paintWallTile(g, style, mask, kind, open) {
  const C = WALL_STYLES[style] || WALL_STYLES.wood, K = '#1a1c2c';
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  if (kind === 'doorH') mask |= E_ | W_; // 门两边总是画出门框
  if (kind === 'doorV') mask |= N_ | S_;
  const n = mask & N_, e = mask & E_, s = mask & S_, w = mask & W_;
  const X0 = 4, X1 = 12, TY0 = 1, TY1 = 7, FB = 15; // 墙厚 8，墙顶 1~7，立面 7~15
  const tops = [[X0, n ? 0 : TY0, X1 - X0, (s ? 16 : TY1) - (n ? 0 : TY0)]];
  if (w) tops.push([0, TY0, X0, TY1 - TY0]);
  if (e) tops.push([X1, TY0, 16 - X1, TY1 - TY0]);
  const fronts = [];
  if (w) fronts.push([0, TY1, X0, FB - TY1]);
  if (!s) fronts.push([X0, TY1, X1 - X0, FB - TY1]);
  if (e) fronts.push([X1, TY1, 16 - X1, FB - TY1]);
  // 1) 描边：每块往外扩半像素画深色，但不越过格子边（连着的地方没有缝）
  const clampRect = ([x, y, ww, hh]) => {
    const x0 = Math.max(0, x - 0.5), y0 = Math.max(0, y - 0.5), x1 = Math.min(16, x + ww + 0.5), y1 = Math.min(16, y + hh + 0.5);
    P(x0, y0, x1 - x0, y1 - y0, K);
  };
  tops.forEach(clampRect);
  fronts.forEach(clampRect);
  // 2) 立面（朝南的墙面）
  for (const [x, y, ww, hh] of fronts) {
    P(x, y, ww, hh, C.front);
    if (style === 'stone') {
      for (let yy = y; yy < y + hh; yy += 2.5) {
        P(x, yy, ww, 0.5, C.frontDk);
        const off = (Math.round(yy * 2) % 2) * 2;
        for (let xx = x + off; xx < x + ww; xx += 4) P(xx, yy, 0.5, 2.5, C.frontDk);
      }
    } else if (style === 'metal') {
      for (let xx = x; xx < x + ww; xx += 1.5) P(xx, y, 0.5, hh, C.frontDk);
      P(x, y + 1, ww, 0.75, C.frontHi);
      for (let xx = x; xx < x + ww; xx += 3) { P(xx, y + hh - 3, 2.5, 2.5, '#b8a07a'); P(xx + 0.5, y + hh - 3, 1.5, 0.5, '#d8c49a'); } // 沙袋
      if ((x + y) % 5 < 1) P(x + 1, y + 2, 1.5, 1, 'rgba(160,80,40,0.6)');
    } else {
      // 木头：竖向木板 / 圆木
      const step = style === 'log' ? 2 : 2.5;
      for (let xx = x; xx < x + ww; xx += step) {
        P(xx, y, 0.5, hh, C.frontDk);
        if (style === 'log') P(xx + 0.5, y, 0.75, hh, C.frontHi);
      }
      if (style === 'wood') { P(x, y + 2, ww, 1, C.frontDk); P(x, y + hh - 3, ww, 1, C.frontDk); }
    }
    P(x, y, ww, 0.5, 'rgba(0,0,0,0.35)'); // 墙顶下方的阴影线
    P(x, y + hh - 0.5, ww, 0.5, 'rgba(0,0,0,0.4)');
  }
  // 3) 墙顶
  for (const [x, y, ww, hh] of tops) {
    P(x, y, ww, hh, C.top);
    if (style === 'log') {
      for (let yy = y + 0.5; yy < y + hh; yy += 2) for (let xx = x + 0.5; xx < x + ww; xx += 2) { P(xx, yy, 1.5, 1.5, C.topLine); P(xx + 0.25, yy + 0.25, 1, 1, C.topHi); }
    } else if (style === 'stone') {
      for (let yy = y + 2; yy < y + hh; yy += 3) P(x, yy, ww, 0.5, C.topLine);
    } else if (style === 'metal') {
      for (let xx = x + 1; xx < x + ww; xx += 3) P(xx, y, 0.5, hh, C.topLine);
    } else {
      for (let yy = y + 1.5; yy < y + hh; yy += 2) P(x, yy, ww, 0.5, C.topLine);
    }
  }
  // 墙顶亮边（只在没有连接的边上）
  if (!n) P(X0, TY0, X1 - X0, 0.5, C.topHi);
  if (w) P(0, TY0, X0, 0.5, C.topHi);
  if (e) P(X1, TY0, 16 - X1, 0.5, C.topHi);
  if (!w) P(X0, n ? 0 : TY0, 0.5, (s ? 16 : TY1) - (n ? 0 : TY0), C.topHi);

  // 4) 门
  const doorCol = style === 'metal' || style === 'stone' ? '#566c86' : '#6e4a2e', doorHi = style === 'metal' || style === 'stone' ? '#8b93a3' : '#a3804f';
  if (kind === 'doorH') {
    // 横向门：立面中间开一个门洞
    P(2.5, TY1 - 0.5, 11, FB - TY1 + 0.5, K);
    if (open) {
      P(3, TY1, 10, FB - TY1, '#262b3a');
      P(3, FB - 2, 10, 2, 'rgba(255,205,117,0.18)');
      P(3, TY1, 1.5, FB - TY1, doorCol); P(3, TY1, 0.5, FB - TY1, doorHi); // 打开的门板贴在一边
    } else {
      P(3, TY1, 10, FB - TY1, doorCol);
      for (let xx = 3; xx < 13; xx += 2.5) P(xx, TY1, 0.5, FB - TY1, 'rgba(0,0,0,0.35)');
      P(3, TY1 + 1, 10, 0.75, doorHi); P(3, FB - 2.5, 10, 0.75, doorHi);
      P(7.75, TY1, 0.5, FB - TY1, K); // 两扇门中缝
      P(6.5, TY1 + 4, 1, 1, '#ffcd75'); P(8.5, TY1 + 4, 1, 1, '#ffcd75'); // 门把手
    }
  } else if (kind === 'doorV') {
    // 竖向门：从上往下看，墙顶中间是一扇门
    P(X0 - 0.5, 2.5, X1 - X0 + 1, 11, K);
    if (open) {
      P(X0, 3, X1 - X0, 10, 'rgba(26,28,44,0.25)');
      P(X0, 3, 1.5, 10, doorCol); P(X0, 3, 0.5, 10, doorHi);
    } else {
      P(X0, 3, X1 - X0, 10, doorCol);
      for (let yy = 3; yy < 13; yy += 2.5) P(X0, yy, X1 - X0, 0.5, 'rgba(0,0,0,0.35)');
      P(X0 + 1, 3, 0.75, 10, doorHi); P(X1 - 1.75, 3, 0.75, 10, doorHi);
      P(X0, 7.75, X1 - X0, 0.5, K);
      P(X1 - 3, 6.5, 1, 1, '#ffcd75'); P(X1 - 3, 8.5, 1, 1, '#ffcd75');
    }
  }
}

// 缓存：同一种材质 + 连接方式 + 门状态只画一次
const WALL_CACHE = {};
function wallTileImg(style, mask, kind, open) {
  const key = style + '_' + mask + '_' + kind + (open ? 'o' : '');
  let c = WALL_CACHE[key];
  if (c) return c;
  const img = createCanvas(32, 32), g = img.getContext('2d');
  g.scale(2, 2);
  paintWallTile(g, style, mask, kind, open);
  const white = createCanvas(32, 32), wg = white.getContext('2d');
  wg.drawImage(img, 0, 0);
  wg.globalCompositeOperation = 'source-in';
  wg.fillStyle = '#ffffff';
  wg.fillRect(0, 0, 32, 32);
  c = WALL_CACHE[key] = { w: 16, h: 16, img, flip: img, white };
  return c;
}

// 门朝向：左右有墙 → 横向门；只有上下有墙 → 竖向门
function doorKind(mask) { return (mask & (E_ | W_)) || !(mask & (N_ | S_)) ? 'doorH' : 'doorV'; }

// 有自己人站在门边时门是开着的
function doorOpen(b) {
  const people = [];
  if (G.player && !(G.player.down > 0)) people.push(G.player);
  if (G.survivors) people.push(...G.survivors);
  if (G.members) people.push(...G.members);
  return people.some((p) => Math.abs(p.x - b.cx) < T * 1.1 && Math.abs(p.y - b.cy) < T * 1.1);
}

// 画一个墙/门建筑
function drawWallBuilding(ctx, b) {
  const mask = wallMask(b.x, b.y), style = b.def.wallStyle || 'wood';
  const im = b.def.door ? wallTileImg(style, mask, doorKind(mask), doorOpen(b)) : wallTileImg(style, mask, 'wall');
  ctx.fillStyle = 'rgba(10,10,30,0.22)';
  ctx.fillRect(b.x * T + 1, b.y * T + 14.5, T, 2.5); // 脚下的阴影
  ctx.drawImage(b.hit > 0 ? im.white : im.img, b.x * T, b.y * T, T, T);
}

// 建造预览：假设这里已经有墙，看看会怎么连
function drawWallPreview(ctx, type, x, y) {
  const def = bdef(type), mask = wallMask(x, y), style = def.wallStyle || 'wood';
  const im = def.door ? wallTileImg(style, mask, doorKind(mask), false) : wallTileImg(style, mask, 'wall');
  ctx.drawImage(im.img, x * T, y * T, T, T);
}

// 建造按钮上用的图标（横向一段）
function initWallSprites() {
  for (const style in WALL_STYLES) {
    SPR['wall_' + style] = wallTileImg(style, E_ | W_, 'wall');
    SPR['door_' + style] = wallTileImg(style, E_ | W_, 'doorH', false);
  }
}
