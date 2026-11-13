// =============================================
//  小地图（所有模式）
//  右上角：地形 + 建筑 + 你 / 营地 / 同伴 / 敌人 / 视野框
//  点小地图 → 打开大地图；在大地图上点一个位置 → 镜头移过去
// =============================================
const MINI_COL = {
  [TER.GRASS]: '#4a7a3f', [TER.WATER]: '#3b5dc9', [TER.SAND]: '#d8bf94', [TER.ROAD]: '#3b3e4a',
  [TER.SNOW]: '#dde6f0', [TER.DIRT]: '#7d6a45', [TER.PAVE]: '#8d909c', [TER.LOT]: '#c8ccd8',
};

// 底图：每格 1 像素（地形 + 树木 / 资源）
function buildMiniBase() {
  const c = G.miniBase && G.miniBase.width === MAP_W && G.miniBase.height === MAP_H ? G.miniBase : createCanvas(MAP_W, MAP_H);
  const g = c.getContext('2d'), img = g.createImageData(MAP_W, MAP_H), D = img.data;
  const over = G.def.groundColors || {};
  const rgbCache = {};
  const rgb = (h) => rgbCache[h] || (rgbCache[h] = hexRgb(h));
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    const t = G.terrain[i];
    let col = rgb(t === TER.GRASS && over[t] ? over[t][1] : MINI_COL[t] || '#4a7a3f');
    const n = G.nodes[i];
    if (n) col = n.type === 'car' ? [74, 78, 92] : n.type === 'dumpster' ? [56, 112, 74] : n.type.match(/rock|ore|coal/) ? [148, 176, 194] : [31, 94, 58];
    const o = i * 4;
    D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  G.miniBase = c;
  G.miniTime = G.time;
}

function miniLayout() {
  const big = G.sw >= 700, w = big ? 170 : 108;
  return { x: G.sw - w - 8, y: UI.topH + 38, w, h: Math.round(w * MAP_H / MAP_W) };
}

// 在 (x,y,w,h) 范围里画整张地图 + 动态的点
function drawMiniContent(ctx, x, y, w, h, big) {
  if (!G.miniBase || G.time - (G.miniTime || 0) > 10) buildMiniBase();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(G.miniBase, x, y, w, h);
  const sx = w / (MAP_W * T), sy = h / (MAP_H * T), dot = big ? 4 : 2.5;
  const P = (wx, wy, col, r) => { ctx.fillStyle = col; ctx.fillRect(x + wx * sx - r / 2, y + wy * sy - r / 2, r, r); };
  // 城市建筑（丧尸模式）
  if (G.structs) {
    for (const s of G.structs) {
      ctx.fillStyle = s.home ? '#38b764' : s.op ? '#41a6f6' : s.left > 0 ? '#c8ccd8' : '#6b6e78';
      ctx.fillRect(x + s.x * T * sx, y + s.y * T * sy, Math.max(1, s.w * T * sx), Math.max(1, s.h * T * sy));
    }
  }
  // 自己建的建筑
  for (const b of G.buildings) {
    if (b === G.core) continue;
    ctx.fillStyle = b.def.wall || b.def.door ? '#ffcd75' : '#f4f4f4';
    ctx.fillRect(x + b.x * T * sx, y + b.y * T * sy, Math.max(1, T * sx), Math.max(1, T * sy));
  }
  if (G.core) P(G.core.cx, G.core.cy, '#a7f070', dot * 2);
  // 敌人
  for (const m of G.monsters) if (m.alive) P(m.x, m.y, m.special && typeof ABIL !== 'undefined' ? ABIL[m.special].color : m.def.boss ? '#ff4060' : '#d13a3a', m.def.boss ? dot * 1.8 : dot);
  // 陌生人 / 船只 / 动物
  for (const n of G.npcs || []) P(n.x, n.y, n.kind === 'bandit' ? '#ef7d57' : '#ffcd75', dot);
  if (G.ship) P(G.ship.x, G.ship.y, '#f4f4f4', dot * 1.6);
  // 同伴 / 岛民
  for (const s of G.survivors || []) { if (s.state === 'in' && Math.sin(G.time * 6) < 0) continue; P(s.x, s.y, s.down ? '#566c86' : '#41a6f6', dot * 1.2); }
  for (const m of G.members || []) P(m.x, m.y, '#41a6f6', dot * 1.2);
  // 你（在建筑里时显示在门口）
  const p = G.player;
  if (p && !(p.down > 0)) {
    const px = G.inside ? p.cityX : p.x, py = G.inside ? p.cityY : p.y;
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x + px * sx - dot - 1, y + py * sy - dot - 1, dot * 2 + 2, dot * 2 + 2);
    P(px, py, Math.sin(G.time * 6) > 0 ? '#ffffff' : '#ffe066', dot * 2);
  }
  // 当前视野框
  if (!G.inside && G.cam) {
    const tl = screenToWorld(0, 0), br = screenToWorld(G.sw, G.sh);
    const rx = Math.max(x, x + tl.x * sx), ry = Math.max(y, y + tl.y * sy);
    const rw = Math.min(x + w, x + br.x * sx) - rx, rh = Math.min(y + h, y + br.y * sy) - ry;
    if (rw > 0 && rh > 0) { ctx.strokeStyle = '#ffcd75'; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1); }
  }
}

function drawMinimap(ctx) {
  if (G.inside || G.state !== 'play') return;
  const L = miniLayout();
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(L.x - 3, L.y - 3, L.w + 6, L.h + 6);
  ctx.strokeStyle = '#566c86'; ctx.lineWidth = 2; ctx.strokeRect(L.x - 2, L.y - 2, L.w + 4, L.h + 4);
  drawMiniContent(ctx, L.x, L.y, L.w, L.h, false);
  drawText(ctx, '地图', L.x + 4, L.y + 8, 10, '#f4f4f4');
  addButton(L.x - 3, L.y - 3, L.w + 6, L.h + 6, () => { G.mapOpen = true; });
}

// 大地图（点开小地图后）
function drawBigMap(ctx) {
  if (!G.mapOpen) return;
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.85)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, () => { G.mapOpen = false; });
  const maxW = sw - 24, maxH = sh - 120;
  const k = Math.min(maxW / MAP_W, maxH / MAP_H), w = MAP_W * k, h = MAP_H * k, x = (sw - w) / 2, y = 56 + (maxH - h) / 2;
  drawText(ctx, '地图（点地图上的位置，镜头移过去）', sw / 2, 30, 16, '#ffcd75', 'center');
  drawButton(ctx, sw - 52, 12, 40, 32, '✕', () => { G.mapOpen = false; }, { size: 14 });
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  drawMiniContent(ctx, x, y, w, h, true);
  addButton(x, y, w, h, () => {
    const pt = G.lastTap;
    if (pt && !G.inside) {
      G.cam.x = (pt.x - x) / w * MAP_W * T;
      G.cam.y = (pt.y - y) / h * MAP_H * T;
      G.camFollow = false;
      clampCamera();
    }
    G.mapOpen = false;
  });
  // 图例
  const legend = [['#ffe066', '你'], ['#a7f070', '营地'], ['#d13a3a', '丧尸/怪物'], ['#ffcd75', '陌生人'], ['#ef7d57', '强盗'], ['#41a6f6', '同伴/分基地'], ['#c8ccd8', '可搜建筑'], ['#6b6e78', '已搜空']];
  let lx = Math.max(12, sw / 2 - legend.length * 42);
  const ly = y + h + 22;
  for (const [col, name] of legend) {
    ctx.fillStyle = col; ctx.fillRect(lx, ly - 4, 8, 8);
    drawText(ctx, name, lx + 12, ly, 11, '#c8d6e5', 'left', false);
    ctx.font = '11px ' + FONT;
    lx += ctx.measureText(name).width + 26;
    if (lx > sw - 60) break;
  }
}
