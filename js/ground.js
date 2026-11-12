// =============================================
//  地面：高清背景图（每格 32×32 像素）
//  地形边界用噪声扭曲，不再是一格一格的方块；颜色用抖动混出层次；
//  水越远离岸边越深，岸边有浪花和湿沙；再撒上草丛、花、石子等小装饰
// =============================================

// 地面配色：[底色, 暗色, 亮色]（每种地形会在这三色之间混出 5 档）
const GROUND_COLORS = {
  [TER.GRASS]: ['#4a8c3f', '#3c7434', '#5aa04c'],
  [TER.WATER]: ['#3b6fd0', '#29409a', '#4fb8f0'],
  [TER.SAND]: ['#e4c9a0', '#cdb084', '#f2e0bc'],
  [TER.ROAD]: ['#4b4f5e', '#3b3e4a', '#5a5f70'],
  [TER.SNOW]: ['#e8eef5', '#c9d5e4', '#ffffff'],
  [TER.DIRT]: ['#7d6a45', '#6a5838', '#907b52'],
  [TER.PAVE]: ['#8d909c', '#7f828e', '#9a9daa'],
  [TER.LOT]: ['#5f626d', '#565964', '#686b76'],
};

// 平滑噪声：让颜色深浅、地形边界自然起伏
function makeNoise() {
  const p = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) p[i] = Math.random();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    let xf = x - xi, yf = y - yi;
    xf = xf * xf * (3 - 2 * xf);
    yf = yf * yf * (3 - 2 * yf);
    const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) << 8, y1 = ((yi + 1) & 255) << 8;
    const a = p[x0 + y0], b = p[x1 + y0], c = p[x0 + y1], d = p[x1 + y1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

// 每个水格离岸边几格（越远水越深）
function waterDepthField() {
  const N = MAP_W * MAP_H, d = new Float32Array(N).fill(99), q = [];
  const src = G.natTer || G.terrain; // 城市地图：桥下面是水
  for (let i = 0; i < N; i++) if (src[i] !== TER.WATER) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16 - 0.47);
function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgbStr(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

// 城市地面上的污渍（血迹 / 焦痕）
function cityStain(g, x, y) {
  const blood = Math.random() < 0.6;
  g.fillStyle = blood ? 'rgba(110,25,35,0.55)' : 'rgba(20,18,25,0.45)';
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    g.ellipse(x + randInt(-4, 4), y + randInt(-3, 3), randInt(1, 4), randInt(1, 3), 0, 0, 7);
    g.fill();
  }
}

const GROUND_HD = 2;
function buildGround() {
  const W = MAP_W * T, H = MAP_H * T, S = GROUND_HD;
  const colors = Object.assign({}, GROUND_COLORS, G.def.groundColors || {});
  const pal = {};
  for (const k in colors) {
    const [b, d, l] = colors[k].map(hexRgb);
    pal[k] = [d, mixRgb(d, b, 0.5), b, mixRgb(b, l, 0.5), l];
  }
  const nwx = makeNoise(), nwy = makeNoise(), ntone = makeNoise(), ndet = makeNoise();
  const depth = waterDepthField();
  const depthAt = (u, v) => {
    u -= 0.5; v -= 0.5;
    const x0 = Math.max(0, Math.min(MAP_W - 1, Math.floor(u))), y0 = Math.max(0, Math.min(MAP_H - 1, Math.floor(v)));
    const x1 = Math.min(MAP_W - 1, x0 + 1), y1 = Math.min(MAP_H - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, u - x0)), fy = Math.max(0, Math.min(1, v - y0));
    const a = depth[idx(x0, y0)], b = depth[idx(x1, y0)], c = depth[idx(x0, y1)], d = depth[idx(x1, y1)];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };

  // 第 1 步：每个点属于哪种地形 + 明暗值
  const src = G.natTer || G.terrain; // 城市地图：画路面下面原本的地形，路之后用曲线画上去
  const ter = new Uint8Array(W * H), tone = new Float32Array(W * H);
  for (let py = 0; py < H; py++) {
    const v = (py + 0.5) / T;
    for (let px = 0; px < W; px++) {
      const u = (px + 0.5) / T, i = py * W + px;
      const base = src[idx((px / T) | 0, (py / T) | 0)];
      let t = base;
      if (base !== TER.ROAD && (G.natTer || !G.def.cityGround)) {
        const ox = (nwx(u * 0.8, v * 0.8) - 0.5) * 0.6 + (nwx(u * 3.1 + 40, v * 3.1) - 0.5) * 0.22;
        const oy = (nwy(u * 0.8, v * 0.8) - 0.5) * 0.6 + (nwy(u * 3.1, v * 3.1 + 40) - 0.5) * 0.22;
        const sx = Math.max(0, Math.min(MAP_W - 1, Math.floor(u + ox)));
        const sy = Math.max(0, Math.min(MAP_H - 1, Math.floor(v + oy)));
        const t2 = src[idx(sx, sy)];
        if (t2 !== TER.ROAD) t = t2;
      }
      ter[i] = t;
      tone[i] = ntone(u * 0.22, v * 0.22) * 0.55 + ndet(u * 0.9, v * 0.9) * 0.45;
    }
  }

  // 第 2 步：上色（岸边浪花、湿沙、深浅水、地形交界的阴影）
  const c = createCanvas(W * S, H * S), g = c.getContext('2d');
  const img = g.createImageData(W * S, H * S), D = img.data, OW = W * S;
  const terAt = (x, y) => ter[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + (x < 0 ? 0 : x >= W ? W - 1 : x)];
  const WATER = TER.WATER, SAND = TER.SAND;
  const FOAM = [226, 240, 248], WET = [150, 120, 90];
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px, t = ter[i], p = pal[t], tn = tone[i];
      let shore = 9;
      if (t === WATER || t === SAND) {
        for (let r = 1; r <= 3 && shore === 9; r++) {
          const n0 = terAt(px + r, py), n1 = terAt(px - r, py), n2 = terAt(px, py + r), n3 = terAt(px, py - r);
          if (t === WATER ? (n0 !== WATER || n1 !== WATER || n2 !== WATER || n3 !== WATER)
            : (n0 === WATER || n1 === WATER || n2 === WATER || n3 === WATER)) shore = r;
        }
      }
      let shade = 1;
      if (t !== WATER) {
        const up = terAt(px, py - 1);
        if (up !== t && up !== WATER) shade = 0.86;
      }
      const dep = t === WATER ? depthAt((px + 0.5) / T, (py + 0.5) / T) : 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const ox = px * S + sx, oy = py * S + sy, bay = BAYER4[(oy & 3) * 4 + (ox & 3)];
          let col;
          if (t === WATER) {
            const lv = Math.floor(4.4 - Math.min(4.4, dep * 1.25) + (tn - 0.5) * 1.6 + bay);
            col = p[lv < 0 ? 0 : lv > 4 ? 4 : lv];
            if (shore === 1) col = FOAM;
            else if (shore === 2 && bay > 0) col = mixRgb(p[4], FOAM, 0.55);
          } else {
            const lv = Math.floor((tn - 0.5) * 7 + 2.5 + bay);
            col = p[lv < 0 ? 0 : lv > 4 ? 4 : lv];
            if (t === SAND && shore <= 2) col = mixRgb(col, WET, 0.3); // 被浪打湿的沙
          }
          let m = shade;
          const hsh = ((ox * 374761393) ^ (oy * 668265263)) >>> 0;
          if (hsh % 29 === 0) m *= 0.92; else if (hsh % 37 === 0) m *= 1.06;
          const o = (oy * OW + ox) * 4;
          D[o] = col[0] * m; D[o + 1] = col[1] * m; D[o + 2] = col[2] * m; D[o + 3] = 255;
        }
      }
    }
  }
  g.putImageData(img, 0, 0);
  if (G.roads) drawRoadsHD(g, S);

  // 第 3 步：小装饰（草丛、花、石子、贝壳、雪堆、路面裂缝）
  const TS = T * S;
  const px2 = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const real = G.terrain[idx(x, y)], tt = G.natTer ? G.natTer[idx(x, y)] : real;
      const bx = x * TS, by = y * TS;
      if (G.roads && real !== tt) { if (real === TER.ROAD || real === TER.PAVE) cityRoadDecor(g, x, y, TS, real); continue; }
      if (ter[(y * T + 8) * W + x * T + 8] !== tt) continue; // 边界被扭曲的格子不放装饰
      const p = pal[tt], dk = rgbStr(p[0]), lt = rgbStr(p[4]);
      const cx = bx + randInt(4, TS - 6), cy = by + randInt(6, TS - 6);
      if (tt === TER.GRASS) {
        const n = randInt(0, 3);
        for (let k = 0; k < n; k++) {
          const tx = bx + randInt(2, TS - 6), ty = by + randInt(5, TS - 3);
          px2(tx, ty, 1, 3, dk); px2(tx + 2, ty - 2, 1, 5, dk); px2(tx + 4, ty, 1, 3, dk);
          px2(tx + 2, ty - 2, 1, 1, lt); px2(tx, ty, 1, 1, lt);
        }
        if (!G.def.noFlowers && Math.random() < 0.07) {
          const fc = pick(['#ffcd75', '#f4f4f4', '#ef7d57', '#73eff7', '#b06cd0']);
          px2(cx, cy + 2, 1, 3, dk);
          px2(cx - 1, cy, 3, 1, fc); px2(cx, cy - 1, 1, 3, fc);
          px2(cx, cy, 1, 1, fc === '#ffcd75' ? '#f4f4f4' : '#ffcd75');
        }
        if (Math.random() < 0.04) { px2(cx, cy, 4, 3, '#566c86'); px2(cx, cy, 3, 1, '#94b0c2'); }
        if (G.mode === 'classic' && Math.random() < 0.012) {
          px2(cx - 1, cy + 2, 3, 3, '#e4c9a0');
          px2(cx - 3, cy, 7, 2, '#b13e53'); px2(cx - 2, cy - 1, 5, 1, '#b13e53');
          px2(cx - 1, cy - 1, 1, 1, '#f4f4f4'); px2(cx + 2, cy, 1, 1, '#f4f4f4');
        }
        if (G.def.noFlowers && Math.random() < 0.12) {
          px2(cx, cy, 3, 1, pick(['#8f6a42', '#6e4a2e', '#5d4b3a']));
          px2(cx + 1, cy + 1, 2, 1, '#4a3a2a');
        }
      } else if (tt === TER.SAND) {
        for (let k = 0; k < 3; k++) px2(bx + randInt(1, TS - 2), by + randInt(1, TS - 2), 1, 1, dk);
        if (Math.random() < 0.06) { px2(cx, cy, 3, 2, '#f4f4f4'); px2(cx + 1, cy + 1, 1, 1, '#e8b796'); }
        if (Math.random() < 0.03) px2(cx, cy, 2, 2, '#ef7d57');
      } else if (tt === TER.SNOW) {
        if (Math.random() < 0.35) { px2(cx - 3, cy + 1, 8, 1, dk); px2(cx - 2, cy, 6, 1, '#ffffff'); }
        if (Math.random() < 0.25) px2(bx + randInt(1, TS - 2), by + randInt(1, TS - 2), 1, 1, '#ffffff');
        if (Math.random() < 0.04) { px2(cx, cy, 3, 2, '#566c86'); px2(cx, cy, 3, 1, '#c9d5e4'); }
      } else if (tt === TER.DIRT) {
        for (let k = 0; k < 2; k++) {
          const qx = bx + randInt(1, TS - 3), qy = by + randInt(1, TS - 3);
          px2(qx, qy, 2, 2, dk); px2(qx, qy, 1, 1, lt);
        }
      } else if (tt === TER.ROAD) {
        // 2 格宽的马路：中间黄色虚线，路口旁边画斑马线
        const isR = (xx, yy) => !G.roads && terrainAt(xx, yy) === TER.ROAD;
        const inH = isR(x, y + 1) !== isR(x, y - 1); // 属于横向马路
        const inV = isR(x + 1, y) !== isR(x - 1, y); // 属于纵向马路
        const cross = (xx, yy) => isR(xx, yy) && isR(xx, yy - 1) && isR(xx, yy + 1) && isR(xx - 1, yy) && isR(xx + 1, yy);
        if (inH && !inV) {
          if (cross(x + 1, y) || cross(x - 1, y) || cross(x + 1, y + (isR(x, y - 1) ? -1 : 1)) || cross(x - 1, y + (isR(x, y - 1) ? -1 : 1))) {
            for (let k = 0; k < 4; k++) px2(bx + 5, by + 3 + k * 7, TS - 10, 4, '#d8dde6');
          } else if (isR(x, y - 1) && x % 2 === 0) px2(bx + 6, by - 1, 18, 2, '#c9a23a');
        } else if (inV && !inH) {
          if (cross(x, y + 1) || cross(x, y - 1) || cross(x + (isR(x - 1, y) ? -1 : 1), y + 1) || cross(x + (isR(x - 1, y) ? -1 : 1), y - 1)) {
            for (let k = 0; k < 4; k++) px2(bx + 3 + k * 7, by + 5, 4, TS - 10, '#d8dde6');
          } else if (isR(x - 1, y) && y % 2 === 0) px2(bx - 1, by + 6, 2, 18, '#c9a23a');
        }
        if (Math.random() < 0.1) {
          let qx = cx, qy = cy;
          g.fillStyle = '#2b2e3a';
          for (let k = 0; k < 7; k++) { g.fillRect(qx, qy, 1, 1); qx += randInt(-1, 1); qy += randInt(0, 1); }
        }
        if (Math.random() < 0.05) px2(cx, cy, 2, 2, '#6a6f80');
        if (Math.random() < 0.06) { g.fillStyle = 'rgba(20,20,30,0.3)'; g.beginPath(); g.ellipse(cx, cy, 5 + Math.random() * 4, 3, 0, 0, 7); g.fill(); } // 油渍
        if (G.def.cityGround && Math.random() < 0.03) cityStain(g, cx, cy);
      } else if (tt === TER.PAVE) {
        // 人行道地砖缝 + 路沿石
        px2(bx, by, TS, 1, 'rgba(40,42,55,0.35)'); px2(bx, by, 1, TS, 'rgba(40,42,55,0.35)');
        px2(bx + 16, by, 1, TS, 'rgba(40,42,55,0.18)'); px2(bx, by + 16, TS, 1, 'rgba(40,42,55,0.18)');
        if (Math.random() < 0.15) px2(bx + randInt(1, 3) * 8, by + randInt(0, 3) * 8, 8, 8, 'rgba(40,42,55,0.1)');
        const curb = '#b3b7c2', curbDk = '#5b5e6a';
        if (G.roads) { /* 曲线路的路沿已经画好了 */ } else if (terrainAt(x, y + 1) === TER.ROAD) { px2(bx, by + TS - 3, TS, 2, curb); px2(bx, by + TS - 1, TS, 1, curbDk); }
        if (terrainAt(x, y - 1) === TER.ROAD) px2(bx, by, TS, 2, curb);
        if (terrainAt(x + 1, y) === TER.ROAD) { px2(bx + TS - 3, by, 2, TS, curb); px2(bx + TS - 1, by, 1, TS, curbDk); }
        if (terrainAt(x - 1, y) === TER.ROAD) px2(bx, by, 2, TS, curb);
        if (Math.random() < 0.05) cityStain(g, cx, cy);
        if (Math.random() < 0.06) px2(cx, cy, 3, 2, pick(['#d8dde6', '#c9b7a0', '#8f6a42'])); // 纸屑落叶
      } else if (tt === TER.LOT) {
        px2(bx, by, TS, 1, 'rgba(30,30,40,0.25)');
      }
    }
  }
  if (G.fields) for (const f of G.fields) drawField(g, f, TS);
  G.ground = c;
  G.groundTer = ter; // 渲染水面波光时用（半格精度的地形）
}

// ---------- 城市地图：用平滑曲线画路（参考《僵尸毁灭工程》，不是全横平竖直） ----------
// 每种路 3 层：外沿（人行道/路肩）→ 边线 → 沥青；所有路先画完同一层再画下一层，路口才能自然连在一起
const ROAD_STYLE = {
  street: [[2, '#8d909c'], [0.3, '#b3b7c2'], [0, '#4b4f5e']],
  hwy: [[0.8, '#2b2e38'], [0, '#c8ccd8'], [-0.3, '#454959']],
  rural: [[0.4, '#3b3e4a'], [0.4, '#3b3e4a'], [0, '#555a69']],
  dirt: [[0.6, '#6a5838'], [0.6, '#6a5838'], [0, '#8a7650']],
  circle: [[2, '#8d909c'], [0.3, '#b3b7c2'], [0, '#4b4f5e']],
};
function drawRoadsHD(g, S) {
  const TS = T * S, nat = G.natTer;
  const path = (r) => { g.beginPath(); r.pts.forEach(([x, y], i) => (i ? g.lineTo(x * TS, y * TS) : g.moveTo(x * TS, y * TS))); };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // 桥：过河的路段先画桥面和栏杆
  for (const r of G.roads) {
    if (r.kind === 'circle' || r.kind === 'dirt') continue;
    for (let k = 1; k < r.pts.length; k++) {
      const [x, y] = r.pts[k], [px, py] = r.pts[k - 1];
      if (!inMap(Math.floor(x), Math.floor(y)) || nat[idx(Math.floor(x), Math.floor(y))] !== TER.WATER) continue;
      const len = Math.hypot(x - px, y - py) || 1, nx = -(y - py) / len, ny = (x - px) / len, o = r.w / 2 + 0.55;
      g.fillStyle = '#3a3f4d';
      g.beginPath(); g.arc(x * TS, y * TS, (r.w / 2 + 0.75) * TS, 0, 7); g.fill();
      if (k % 2 === 0) for (const s of [-1, 1]) {
        g.fillStyle = '#1a1c2c'; g.fillRect((x + nx * o * s) * TS - 3, (y + ny * o * s) * TS - 3, 6, 6);
        g.fillStyle = '#c8ccd8'; g.fillRect((x + nx * o * s) * TS - 2, (y + ny * o * s) * TS - 2, 4, 4);
      }
    }
  }
  for (let layer = 0; layer < 3; layer++) {
    for (const r of G.roads) {
      const [extra, col] = ROAD_STYLE[r.kind][layer], w = (r.w + extra) * TS;
      g.strokeStyle = g.fillStyle = col;
      if (r.pts.length === 1) { g.beginPath(); g.arc(r.pts[0][0] * TS, r.pts[0][1] * TS, w / 2, 0, 7); g.fill(); continue; }
      g.lineWidth = w;
      path(r);
      g.stroke();
    }
  }
  // 中间的黄色虚线
  g.setLineDash([12, 12]);
  g.lineWidth = 2;
  g.strokeStyle = '#c9a23a';
  for (const r of G.roads) {
    if (r.pts.length < 2 || r.kind === 'dirt' || r.kind === 'circle') continue;
    path(r);
    g.stroke();
  }
  g.setLineDash([]);
  // 路口斑马线（只在真的有路的方向画）
  g.fillStyle = '#d8dde6';
  for (const [x, y] of G.crosswalks || []) {
    const road = (xx, yy) => inMap(Math.floor(xx), Math.floor(yy)) && G.terrain[idx(Math.floor(xx), Math.floor(yy))] === TER.ROAD;
    if (!road(x - 0.5, y - 0.5)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!road(x + dx * 2.6 - (dx ? 0 : 0.5), y + dy * 2.6 - (dy ? 0 : 0.5))) continue;
      for (let k = 0; k < 5; k++) {
        if (dx === 0) g.fillRect((x - 1) * TS + 4 + k * 12, (y + dy * 1.6 - 0.25) * TS, 6, 0.5 * TS);
        else g.fillRect((x + dx * 1.6 - 0.25) * TS, (y - 1) * TS + 4 + k * 12, 0.5 * TS, 6);
      }
    }
  }
}

// 曲线路上的颗粒、裂缝、油渍、血迹
function cityRoadDecor(g, x, y, TS, t) {
  const bx = x * TS, by = y * TS;
  if (t === TER.ROAD) {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(20,20,30,0.25)' : 'rgba(200,205,215,0.12)';
      g.fillRect(bx + randInt(0, TS - 2), by + randInt(0, TS - 2), randInt(1, 2), 1);
    }
    if (Math.random() < 0.1) {
      let qx = bx + randInt(4, TS - 6), qy = by + randInt(4, TS - 6);
      g.fillStyle = '#2b2e3a';
      for (let k = 0; k < 7; k++) { g.fillRect(qx, qy, 1, 1); qx += randInt(-1, 1); qy += randInt(0, 1); }
    }
    if (Math.random() < 0.05) { g.fillStyle = 'rgba(20,20,30,0.3)'; g.beginPath(); g.ellipse(bx + 16, by + 16, 5 + Math.random() * 4, 3, 0, 0, 7); g.fill(); }
    if (Math.random() < 0.025) cityStain(g, bx + randInt(6, TS - 6), by + randInt(6, TS - 6));
  } else {
    if (Math.random() < 0.05) cityStain(g, bx + randInt(6, TS - 6), by + randInt(6, TS - 6));
    if (Math.random() < 0.06) { g.fillStyle = pick(['#d8dde6', '#c9b7a0', '#8f6a42']); g.fillRect(bx + randInt(4, TS - 6), by + randInt(4, TS - 6), 3, 2); }
  }
}

// 农田：一垄一垄的庄稼（有的已经枯黄）
function drawField(g, f, TS) {
  const [fx, fy, fw, fh] = f;
  const crop = pick(['#5a7a45', '#6e8a3a', '#b0904a']);
  for (let y = fy * TS + 3; y < (fy + fh) * TS - 3; y += 7) {
    for (let x = fx * TS + 2; x < (fx + fw) * TS - 2; x += 3) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (!inMap(tx, ty) || G.terrain[idx(tx, ty)] !== TER.DIRT) continue;
      g.fillStyle = '#5d4b2e'; g.fillRect(x, y + 3, 3, 1);
      if (Math.random() < 0.85) { g.fillStyle = crop; g.fillRect(x, y, 2, 3); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x, y, 1, 1); }
    }
  }
}
