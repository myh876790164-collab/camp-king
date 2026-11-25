// =============================================
//  公路求生：六个地区的远景、中景（精细像素，暖色末日风）
//  每个地区三层：最远的山影（视差 0.03）、远景（0.09）、中景（0.25），越远越朦胧（混进天边的颜色）。
//  每层预先逐像素画成一张 512 世界像素宽、左右能无缝拼接的长条图并缓存，每帧只贴图（手机也流畅）。
//  会动的东西（夜里亮灯的窗户、烟囱顶上闪的红灯、辐射水洼和水晶的荧光）记成「灯点」，每帧单独画。
//  坐标：精细像素；y = 0 是地平线，向上为负；x 在 0 ~ RDS_TW 之间循环
// =============================================
const RDS_TW = 1536;   // 长条图宽（精细像素）
const RDS_FOOT = 12;   // 地平线往下多画一截（会被地面盖住，防止露缝）
const RDS_LAYERS = [{ par: 0.03, h: 200, haze: 0.58 }, { par: 0.09, h: 220, haze: 0.3 }, { par: 0.25, h: 246, haze: 0.05 }];
const RDS_CACHE = {};  // 地区编号 → 三层图
let RDS_LIT = [];      // 这一帧画面上的灯点（夜里在黑幕上挖亮点）

function rdsC(h) { return parseInt(h.slice(1), 16); }
function rdsR(a) { return a.map(rdsC); }
function rdsMixI(a, b, t) {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t, g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, l = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(l);
}
function rdsRand(s, k) { return rdcHash(k * 1.731 + 0.5, s * 0.917 + 3.1, 11); }
function rdsWrap(x) { return ((x % RDS_TW) + RDS_TW) % RDS_TW; }
function rdsDist(x, c) { let d = rdsWrap(x - c); if (d > RDS_TW / 2) d -= RDS_TW; return d; } // 循环距离（带正负）
// 循环的一维平滑噪声：per = 一张图里有多少个起伏
function rdsN(x, per, s) {
  const u = rdsWrap(x) / RDS_TW * per, i = Math.floor(u), f = u - i;
  const a = rdcHash(i % per, 1, s), b = rdcHash((i + 1) % per, 1, s);
  return a + (b - a) * f * f * (3 - 2 * f);
}

// ---------- 调色板（每个地区，从亮到暗） ----------
const RDS_PAL = [
  { // 0 荒漠：赭红方山、金黄沙丘、砂岩、仙人掌
    mesa: rdsR(['#c98a6a', '#b4745a', '#a06048', '#8e5440']),
    sand: rdsR(['#f4cc94', '#e0ac70', '#c88c58', '#a86c44', '#84522f']),
    rock: rdsR(['#eaa874', '#cc8452', '#a8623a', '#7e4428', '#58301c']),
    cactus: rdsR(['#b4bc6c', '#8a9a50', '#66783c', '#48582c', '#30401e']),
    wood: rdsR(['#c09a6a', '#9a744c', '#765434', '#523822']),
    bone: rdsR(['#fbf2dc', '#e4d4ae', '#c4ae84', '#947c58']),
    metal: rdsR(['#c8b8a0', '#988670', '#6e5e4c', '#4a3e32']),
  },
  { // 1 废墟城郊：灰蓝天际线、水泥楼、褪色小屋
    sky: rdsR(['#8a9098', '#7a8088', '#6c727c']),
    con: rdsR(['#aeaaa0', '#908c84', '#74716c', '#5a5854', '#42403e']),
    con2: rdsR(['#c4baa8', '#a49a88', '#847a6a', '#645a4e', '#463e36']),
    brick: rdsR(['#c8866a', '#a4644c', '#7e4636', '#582e24']),
    roof: rdsR(['#7a6658', '#5e4c42', '#46362e', '#30241e']),
    paint: [rdsR(['#a8c0b4', '#86a094', '#648074', '#486056']), rdsR(['#e0cc90', '#c0a86c', '#98824c', '#6e5c34']), rdsR(['#e4dccc', '#c4b8a4', '#9c907c', '#746856'])],
    wood: rdsR(['#b4925e', '#8e6e44', '#6a4e30', '#48341e']),
    rust: rdsR(['#d08040', '#a85a2a', '#7a3a1c', '#4e2412']),
    dark: rdsC('#2a2420'),
  },
  { // 2 枯死森林：雾里的灰褐枯树、青苔、发光蘑菇
    hill: rdsR(['#6e6c5a', '#626250', '#585846']),
    far: rdsR(['#5c5c4a', '#4e5040', '#424436', '#36382e']),
    bark: rdsR(['#968670', '#76664e', '#584c3a', '#3e3428', '#2a221a']),
    moss: rdsR(['#9aa864', '#788a4a', '#5a6c38']),
    ground: rdsR(['#6e6450', '#5a5040', '#463e32', '#342e26']),
    shroom: rdsC('#c8f070'),
  },
  { // 3 辐射荒原：冷却塔、工厂、锈铁、荧光绿水洼
    hill: rdsR(['#6c8458', '#5e7650', '#526846']),
    steel: rdsR(['#8a8c78', '#707260', '#585a4c', '#42443a', '#2e3028']),
    rust: rdsR(['#c07a44', '#9a5a30', '#723e22', '#4c2816']),
    con: rdsR(['#a0a08a', '#82826e', '#666856', '#4c4e40']),
    yel: rdsR(['#e0c050', '#b8982e', '#8a6e1e', '#5c4814']),
    ground: rdsR(['#7c7c52', '#666a42', '#525634', '#3e4228']),
    tox: rdsC('#a7f070'), tox2: rdsC('#e8ffb0'), red: '#ff5038',
  },
  { // 4 冰封高原：雪山、冰岩、雪松
    snow: rdsR(['#fbfdff', '#e4eef6', '#c4d6e6', '#9cb4cc', '#7a94b0']),
    rock: rdsR(['#8296aa', '#687c92', '#52647a', '#3e4e62', '#2c3a4c']),
    pine: rdsR(['#5a7a72', '#44625c', '#324c48', '#223636']),
    ice: rdsR(['#e8fbff', '#b4e4f0', '#84bcd4', '#5a90b0', '#3e6888']),
    metal: rdsR(['#b0b8c0', '#8a929c', '#646c78', '#464c58']),
  },
  { // 5 外星坠落区：紫色岩、巨大残骸、青色水晶、发光触须
    hill: rdsR(['#6a4e92', '#5c4284', '#503878']),
    rock: rdsR(['#7a6898', '#605080', '#4a3c66', '#36294e', '#241a38']),
    hull: rdsR(['#aaa2c4', '#8880a6', '#686286', '#4a4664', '#322f46']),
    cry: rdsR(['#d8fdff', '#86f0f8', '#46b8d4', '#2a7aa0', '#1c4a6e']),
    pink: rdsR(['#f8b8ff', '#d880f0', '#a050c8', '#6a3090']),
    glow: rdsC('#73eff7'), glow2: rdsC('#f070ff'),
  },
];

// ---------- 像素纸（左右循环） ----------
// 材质：1 实心物体（要描边）2 地形 / 细线（不描边）3 发光（不描边、不变朦胧）8 描边
function rdsPaper(h) { const H = h + RDS_FOOT; return { w: RDS_TW, h: H, base: h, c: new Int32Array(RDS_TW * H).fill(-1), m: new Uint8Array(RDS_TW * H), lights: [] }; }
function rdsPx(B, x, y, col, m) {
  x = Math.round(x); y = Math.round(y);
  const py = y + B.base; if (py < 0 || py >= B.h) return;
  const i = py * B.w + (((x % B.w) + B.w) % B.w);
  B.c[i] = col; B.m[i] = m || 1;
}
function rdsHas(B, x, y) { const py = Math.round(y) + B.base; if (py < 0 || py >= B.h) return false; return B.c[py * B.w + rdsWrap(Math.round(x))] >= 0; }
function rdsRect(B, x, y, w, h, col, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) rdsPx(B, x + i, y + j, col, m); }
// 色带取色：v 越大越暗；小数部分用棋盘格抖点过渡
function rdsPick(R, v, x, y) {
  const n = R.length - 1;
  if (v <= 0) return R[0]; if (v >= n) return R[n];
  const i = Math.floor(v), f = v - i;
  return R[i + ((f > 0.66 || (f > 0.33 && ((x + y) & 1))) ? 1 : 0)];
}
function rdsLine(B, x0, y0, x1, y1, col, m) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 2000; n++) { rdsPx(B, x0, y0, col, m); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
// 多边形扫描线填充；fn(x, y, t) 返回颜色（t：从上到下 0~1）
function rdsPoly(B, pts, fn, m) {
  let y0 = 1e9, y1 = -1e9;
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.ceil(y0); y <= Math.floor(y1); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if ((p[1] <= y + 0.5 && q[1] > y + 0.5) || (q[1] <= y + 0.5 && p[1] > y + 0.5)) xs.push(p[0] + (y + 0.5 - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++)
      rdsPx(B, x, y, typeof fn === 'number' ? fn : fn(x, y, (y - y0) / Math.max(1, y1 - y0)), m);
  }
}
// 有粗细的「管子」（树枝、钢管、触须）：左边迎光亮、右边暗，零散暗点当纹理
function rdsStroke(B, x0, y0, x1, y1, r0, r1, R, m, s) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, r = Math.max(0.5, r0 + (r1 - r0) * t), c = Math.ceil(r);
    for (let dx = -c; dx <= c; dx++) for (let dy = -c; dy <= c; dy++) {
      if (dx * dx + dy * dy > r * r + 0.3) continue;
      const px = Math.round(x + dx), py = Math.round(y + dy);
      const v = 1.4 + dx / (r + 0.5) * 1.5 + dy / (r + 0.5) * 0.4 + (rdcHash(px, py, s) < 0.1 ? 0.8 : 0);
      rdsPx(B, px, py, rdsPick(R, v, px, py), m || 1);
    }
  }
}
function rdsLight(B, x, y, kind, col, r) { B.lights.push({ x: rdsWrap(Math.round(x)), y: Math.round(y), kind, col, r: r || 3, ph: rdcHash(x, y, 5) * 6.283 }); }

// ---------- 通用画法 ----------
// 地形：hf(x) 给出高度；朝左的坡迎光亮、朝右的坡暗，越往下越暗；o.strata 岩层条纹，o.snow 积雪
function rdsTerrain(B, hf, R, o) {
  o = o || {};
  const s = o.seed || 0, deep = o.deep || 70, m = o.m || 2;
  for (let x = 0; x < B.w; x++) {
    const h = Math.round(hf(x)), sl = hf(x + 3) - hf(x - 3);
    const side = sl > 1.2 ? -0.5 : sl < -1.2 ? 0.8 : 0;
    for (let y = -h; y < RDS_FOOT; y++) {
      const d = y + h;
      let v = (d === 0 && side <= 0) ? 0 : 1 + side + Math.min(1.3, d / deep);
      if (o.strata) v += (Math.floor((y + rdsN(x, 14, s + 4) * o.strata * 2.5) / o.strata) & 1) * 0.45;
      const hs = rdcHash(x, y, s + 2);
      if (hs < 0.035) v += 0.6; else if (hs > 0.978) v -= 0.6;
      let col;
      if (o.snow) {
        const line = o.snow.line + rdsN(x, 26, s + 8) * o.snow.var - (side < 0 ? o.snow.var * 0.6 : 0);
        const cap = d < (side > 0 ? 2 : 4) && h > o.snow.line * 0.6;
        if (-y > line || cap) col = rdsPick(o.snow.R, side > 0 ? 1.6 + d / deep : side < 0 ? d / (deep * 2) : 0.6 + d / deep, x, y);
      }
      rdsPx(B, x, y, col != null ? col : rdsPick(R, v, x, y), m);
    }
  }
}
// 圆石：边缘不规则；左上亮、右下暗；可加岩层、裂缝、积雪顶
function rdsRock(B, cx, w, h, R, s, o) {
  o = o || {};
  const hw = w / 2, inside = (x, y) => {
    if (y > 1) return false;
    const ny = y < -h * 0.45 ? (y + h * 0.45) / (h * 0.55) : (y + h * 0.45) / (h * 0.9), nx = x / hw;
    return nx * nx + ny * ny < 1 + (rdcNoise2(x / 7, y / 6, s) - 0.5) * 0.55;
  };
  for (let y = -Math.ceil(h * 1.1); y <= 1; y++) for (let x = -Math.ceil(hw * 1.2); x <= Math.ceil(hw * 1.2); x++) {
    if (!inside(x, y)) continue;
    const nx = x / hw, ny = (y + h * 0.5) / h, px = cx + x;
    let v = 1.3 + nx * 0.9 + ny * 0.9;
    if (!inside(x, y - 1)) v -= 0.9;            // 顶上一圈亮边
    if (!inside(x + 1, y)) v += 0.5;            // 右边缘更暗
    if (o.strata) v += (Math.floor((y + rdcNoise2(x / 20, 0, s) * 5) / o.strata) & 1) * 0.4;
    if (Math.abs(rdcNoise2(x / 9, y / 3.5, s + 2) - 0.5) < 0.025) v += 1.3; // 裂缝
    const hs = rdcHash(px, y, s + 3); if (hs < 0.05) v += 0.7; else if (hs > 0.97) v -= 0.7;
    let col = rdsPick(R, v, px, y);
    if (o.snow && (!inside(x, y - 2) || !inside(x, y - 3)) && nx < 0.75) col = rdsPick(o.snow, nx < 0 ? 0 : 1, px, y);
    rdsPx(B, px, y, col, o.m || 1);
  }
}
// 竖着的圆柱（圆头）：仙人掌、油桶、烟囱；纵纹 + 左亮右暗
function rdsCol(B, x, yb, yt, w, R, s, o) {
  o = o || {};
  const r = w / 2;
  for (let y = Math.round(yt); y <= Math.round(yb); y++) for (let i = 0; i < w; i++) {
    const dx = i - (w - 1) / 2;
    if (o.round && y < yt + r) { const dy = yt + r - y; if (dx * dx + dy * dy > r * r + 0.5) continue; }
    let v = 1.3 + dx / r * 1.4;
    if (o.ribs && i % 3 === 1) v += 0.5;
    if (o.bands && (Math.floor((y - yt) / o.bands) & 1)) v += 0.6;
    const px = Math.round(x - r + i), hs = rdcHash(px, y, s);
    if (hs < 0.05) v += 0.6;
    let col = rdsPick(R, v, px, y);
    if (o.spines && (i === 0 || i === w - 1) && hs > 0.8) { rdsPx(B, px + (i === 0 ? -1 : 1), y, R[0], 2); }
    rdsPx(B, px, y, col, o.m || 1);
  }
}
// 枯树枝：递归分叉，越分越细
function rdsBranch(B, x, y, a, len, r, R, s, d, o) {
  const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
  rdsStroke(B, x, y, x1, y1, r, r * 0.72, R, 1, s);
  if (d <= 0 || r < 0.55) {
    if (o && o.moss && rdcHash(x1, y1, s + 1) < o.moss) { const L = 5 + rdcHash(x1, y1, s + 2) * 12; for (let k = 0; k < L; k++) rdsPx(B, x1 + Math.round(Math.sin(k * 0.7) * 0.6), y1 + k, rdsPick(o.mossR, k / L * 2, x1, k), 2); }
    if (o && o.crow && rdcHash(x1, y1, s + 3) < o.crow) { rdsRect(B, x1 - 2, y1 - 3, 4, 2, o.crowC, 1); rdsPx(B, x1 + 2, y1 - 4, o.crowC, 1); rdsPx(B, x1 - 3, y1 - 2, o.crowC, 1); }
    return;
  }
  const n = 2 + (rdcHash(x1, y1, s + d) < 0.3 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const da = (rdcHash(x1 + i, y1, s + 7) - 0.5) * 0.9 + (i - (n - 1) / 2) * 0.75;
    rdsBranch(B, x1, y1, a + da, len * (0.58 + rdcHash(i, x1, s) * 0.25), r * 0.62, R, s + i * 13, d - 1, o);
  }
}
function rdsDeadTree(B, x, h, r, R, s, o) {
  const lean = (rdsRand(s, 1) - 0.5) * 0.25, tx = x + Math.sin(lean) * h * 0.5, ty = -h * 0.5;
  rdsStroke(B, x, 0, tx, ty, r, r * 0.75, R, 1, s);
  for (let k = 0; k < 2; k++) rdsStroke(B, x, -1, x + (k ? 1 : -1) * r * 1.8, 2, r * 0.6, 0.6, R, 1, s); // 树根
  for (let k = 0; k < 2; k++) { const t = 0.45 + k * 0.25; rdsBranch(B, x + (tx - x) * t * 2 * 0.5, -h * 0.5 * t, -Math.PI / 2 + (k ? 0.95 : -0.95), h * 0.22, r * 0.4, R, s + 40 + k, 2, o); }
  rdsBranch(B, tx, ty, -Math.PI / 2 + lean, h * 0.28, r * 0.75, R, s + 3, o && o.depth || 4, o);
}
// 雪松：一层层往下垂的松枝，上面压着雪（迎光的左边雪多）
function rdsPine(B, x, h, R, S, s, m) {
  rdsStroke(B, x, 0, x, -h * 0.25, Math.max(1, h / 50), 1, R, m || 1, s);
  const tiers = Math.max(3, Math.round(h / 20)), step = h * 0.86 / tiers;
  for (let t = 0; t < tiers; t++) {
    const yb = -h * 0.14 - t * step, th = step * 1.6, wb = h * 0.3 * (1 - t / (tiers + 0.5)) + 2, ytop = yb - th;
    for (let y = Math.floor(ytop); y <= yb + 3; y++) for (let dx = -Math.ceil(wb) - 1; dx <= Math.ceil(wb) + 1; dx++) {
      const u = Math.abs(dx) / wb;
      const edge = ytop + u * th, droop = yb + u * u * 3;
      const jag = (rdcHash(x + dx, t, s) < 0.35 ? 1 : 0);
      if (y < edge + jag || y > droop - jag || u > 1) continue;
      const px = x + dx, depthBelow = y - edge;
      let col;
      if (depthBelow < (dx < 0 ? 3 : 1.5) || (y > droop - 2 && rdcHash(px, y, s) < 0.35)) col = rdsPick(S, dx < 0 ? 0 : 1.2, px, y);
      else col = rdsPick(R, 1 + dx / wb * 1.1 + (depthBelow > th * 0.6 ? 0.8 : 0) + (rdcHash(px, y, s + 1) < 0.08 ? 0.6 : 0), px, y);
      rdsPx(B, px, y, col, m || 1);
    }
  }
  rdsPx(B, x, -h - 1, S[0], m || 1);
}
// 仙人掌（树形）：主干 + 一两只往上弯的胳膊
function rdsCactus(B, x, h, R, s) {
  const w = Math.max(5, Math.round(h / 8));
  rdsCol(B, x, 0, -h, w, R, s, { round: true, ribs: true, spines: true });
  const arms = h > 50 ? 2 : 1;
  for (let k = 0; k < arms; k++) {
    const side = k ? -1 : (rdsRand(s, 3) > 0.5 ? 1 : -1), ya = -h * (0.32 + rdsRand(s, 4 + k) * 0.25), aw = Math.max(4, w - 1), out = w * 0.9 + 3, up = h * (0.18 + rdsRand(s, 6 + k) * 0.2);
    for (let i = 0; i <= out; i++) for (let j = 0; j < aw; j++) { const px = Math.round(x + side * (w / 2 + i - 1)), py = Math.round(ya - j); rdsPx(B, px, py, rdsPick(R, 1 + (j / aw - 0.5) * -1.6 + (rdcHash(px, py, s) < 0.05 ? 0.6 : 0), px, py), 1); }
    rdsCol(B, x + side * (w / 2 + out - aw / 2), ya, ya - up, aw, R, s + k, { round: true, ribs: true, spines: true });
  }
}
// 一丛枯灌木
function rdsShrub(B, x, h, R, s) { for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.32 + (rdsRand(s, k) - 0.5) * 0.3; rdsBranch(B, x + (k - 2.5) * 0.8, 0, a, h * (0.45 + rdsRand(s, k + 9) * 0.3), 0.9, R, s + k, 1); } }
// 残破的楼：缺一大块的楼顶、楼板线、窗洞（夜里有几扇亮灯）、钢筋、雨水污渍；右侧面更暗
function rdsBlock(B, x0, w, h, R, s, o) {
  o = o || {};
  const bc = rdsRand(s, 1) * w, bw = w * (0.3 + rdsRand(s, 2) * 0.4), bd = h * (0.12 + rdsRand(s, 3) * 0.3), sw = Math.max(3, Math.round(w * 0.12));
  const fh = o.fh || 14, wx = o.wx || 10, dark = o.dark != null ? o.dark : R[R.length - 1], m = o.m || 1;
  const topY = (i) => { const dd = Math.abs(i - bc) / (bw / 2); return -h + (dd < 1 ? bd * (1 - dd * dd) : 0) + Math.floor(rdcHash(x0 + i, 0, s) * 3); };
  for (let i = 0; i < w; i++) {
    const t = Math.round(topY(i)), px = x0 + i;
    for (let y = t; y < RDS_FOOT; y++) {
      let v = i >= w - sw ? 2.2 : 1 + (i / w) * 0.4;
      if (y === t) v -= 0.8;
      const fy = ((y + h) % fh + fh) % fh;
      if (fy === 0) v -= 0.5; else if (fy === 1) v += 0.4;
      const wy = fy >= 4 && fy <= 10, wxx = ((i % wx) + wx) % wx;
      let col = null;
      if (i < w - sw && wy && wxx >= 3 && wxx <= wx - 3 && y > t + 3 && y < -3) {
        const wid = Math.floor(i / wx) * 31 + Math.floor((y + h) / fh), wh = rdcHash(wid, x0, s);
        if (wh > 0.12) {
          col = dark;
          if (o.lit && wh > 1 - o.lit && fy === 7 && wxx === Math.floor(wx / 2)) rdsLight(B, px, y, 'win', wh > 0.985 ? '#ff9a50' : '#ffcd75', 3);
        }
      }
      if (col == null) { if (rdcHash(px, 3, s) < 0.12 && rdcHash(px, y >> 3, s) < 0.6) v += 0.5; if (rdcHash(px, y, s + 4) < 0.04) v += 0.6; col = rdsPick(R, v, px, y); }
      if (y > t && y < t + bd * 0.6 && Math.abs(i - bc) < bw / 2 && rdcHash(px, y, s + 5) < 0.3) col = dark; // 断口里露出的黑洞
      rdsPx(B, px, y, col, m);
    }
    if (Math.abs(Math.abs(i - bc) - bw / 2) < 4 && rdcHash(px, 9, s) < 0.45) { const L = 3 + Math.floor(rdcHash(px, 8, s) * 8); for (let k = 1; k <= L; k++) rdsPx(B, px + (k > L / 2 ? 1 : 0), t - k, o.rebar || R[R.length - 1], 2); }
  }
  if (o.tank && rdsRand(s, 9) > 0.4) { const tx = x0 + Math.round(w * 0.2), ty = topY(w * 0.2 + 3); rdsRect(B, tx, ty - 10, 1, 10, R[3], 1); rdsRect(B, tx + 8, ty - 10, 1, 10, R[3], 1); rdsCol(B, tx + 4.5, ty - 10, ty - 20, 11, R, s, {}); }
  if (o.antenna && rdsRand(s, 10) > 0.5) { const ax = x0 + Math.round(w * 0.7), ay = Math.round(topY(w * 0.7)); rdsLine(B, ax, ay, ax + 2, ay - 26, R[3], 2); rdsLine(B, ax - 4, ay - 18, ax + 5, ay - 19, R[3], 2); if (o.lit) rdsLight(B, ax + 2, ay - 27, 'blink', '#ff5038', 3); }
}
// 一堆瓦砾：碎石块 + 斜着的水泥板 + 钢筋
function rdsRubble(B, x, w, R, s, rebar) {
  for (let k = 0; k < 7; k++) { const rx = x + (rdsRand(s, k) - 0.5) * w, rw = 6 + rdsRand(s, k + 7) * w * 0.3; rdsRock(B, rx, rw, rw * 0.55, R, s + k, { m: 1 }); }
  const a = (rdsRand(s, 20) - 0.5) * 1.2, L = w * 0.5, cx = x + (rdsRand(s, 21) - 0.5) * w * 0.4;
  const ca = Math.cos(a), sa = Math.sin(a);
  rdsPoly(B, [[cx - L / 2 * ca, -4 - L / 2 * sa - 12], [cx + L / 2 * ca, -4 + L / 2 * sa - 12], [cx + L / 2 * ca, -4 + L / 2 * sa - 5], [cx - L / 2 * ca, -4 - L / 2 * sa - 5]], (px, py, t) => rdsPick(R, 0.6 + t * 2, px, py), 1);
  if (rebar) for (let k = 0; k < 4; k++) { const bx = cx + (rdsRand(s, 30 + k) - 0.5) * L; rdsLine(B, bx, -10, bx + (rdsRand(s, 34 + k) - 0.5) * 14, -20 - rdsRand(s, 38 + k) * 12, rebar, 2); }
}
// 格子铁架（电线塔、风车塔、无线电塔）
function rdsLattice(B, x, wb, wt, h, col, m) {
  const L = (t) => [x - wb / 2 + (wb - wt) / 2 * t, x + wb / 2 - (wb - wt) / 2 * t];
  rdsLine(B, L(0)[0], 0, L(1)[0], -h, col, m); rdsLine(B, L(0)[1], 0, L(1)[1], -h, col, m);
  const n = Math.max(2, Math.round(h / 14));
  for (let k = 0; k < n; k++) { const a = L(k / n), b = L((k + 1) / n); rdsLine(B, a[0], -h * k / n, b[1], -h * (k + 1) / n, col, m); rdsLine(B, a[1], -h * k / n, b[0], -h * (k + 1) / n, col, m); rdsLine(B, b[0], -h * (k + 1) / n, b[1], -h * (k + 1) / n, col, m); }
}

// =============== 0 荒漠公路 ===============
function rdsDesert(B, k, s) {
  const P = RDS_PAL[0];
  if (k === 0) { // 天边一排平顶方山（台阶状的侧坡）
    const ms = []; for (let i = 0; i < 6; i++) ms.push({ c: rdsRand(s, i) * RDS_TW, w: 90 + rdsRand(s, i + 9) * 200, h: 45 + rdsRand(s, i + 19) * 80, sl: 0.7 + rdsRand(s, i + 29) * 1.2 });
    rdsTerrain(B, (x) => { let h = 12 + rdsN(x, 24, s) * 12; for (const m of ms) { const dx = Math.abs(rdsDist(x, m.c)) - m.w / 2, t = dx <= 0 ? m.h + rdsN(x, 160, s + 1) * 3 : m.h - Math.ceil(dx * m.sl / 9) * 9; if (t > h) h = t; } return h; }, P.mesa, { seed: s, strata: 8, deep: 120 });
  } else if (k === 1) { // 孤峰 + 沙丘
    const bs = []; for (let i = 0; i < 4; i++) bs.push({ c: (i + rdsRand(s, i) * 0.6) * RDS_TW / 4, w: 26 + rdsRand(s, i + 4) * 50, h: 70 + rdsRand(s, i + 8) * 60 });
    rdsTerrain(B, (x) => { let h = 0; for (const b of bs) { const dx = Math.abs(rdsDist(x, b.c)) - b.w / 2, t = dx <= 0 ? b.h + rdsN(x, 200, s) * 4 : b.h - dx * 2.6 - Math.ceil(dx / 6) * 4; if (t > h) h = t; } return h; }, P.rock, { seed: s + 1, strata: 7, deep: 90 });
    rdsTerrain(B, (x) => 16 + Math.pow(rdsN(x, 9, s + 2), 1.6) * 40 + rdsN(x, 37, s + 3) * 8, P.sand, { seed: s + 2, deep: 60 });
  } else { // 中景：沙包、砂岩、仙人掌、枯灌木、旧风车、兽骨
    rdsTerrain(B, (x) => 3 + rdsN(x, 13, s) * 12 + rdsN(x, 41, s + 1) * 4, P.sand, { seed: s, deep: 30 });
    // 石柱（上面顶着一块大石头）
    for (let i = 0; i < 2; i++) { const x = (0.15 + i * 0.5 + rdsRand(s, 50 + i) * 0.2) * RDS_TW, h = 70 + rdsRand(s, 52 + i) * 50, w = 14 + rdsRand(s, 54 + i) * 10; rdsCol(B, x, 0, -h, w, P.rock, s + i, { bands: 6 }); rdsRock(B, x + 2, w * 2.2, w * 1.1, P.rock, s + 60 + i, { strata: 5 }); rdsRock(B, x, w * 2.4, 14, P.rock, s + 70 + i, {}); }
    // 砂岩堆
    for (let i = 0; i < 6; i++) { const x = rdsRand(s, i) * RDS_TW, w = 26 + rdsRand(s, i + 6) * 56; rdsRock(B, x, w, w * (0.45 + rdsRand(s, i + 12) * 0.35), P.rock, s + i, { strata: 5 }); if (rdsRand(s, i + 18) > 0.4) rdsRock(B, x + w * 0.5, w * 0.45, w * 0.3, P.rock, s + i + 30, { strata: 5 }); }
    // 旧风车（抽水用的铁架风车，叶片掉了几片）
    { const x = rdsRand(s, 80) * RDS_TW, h = 150, hub = -h - 6; rdsLattice(B, x, 26, 6, h, P.metal[2], 2); rdsRect(B, x - 5, -h - 2, 10, 3, P.metal[3], 1);
      for (let b = 0; b < 12; b++) { if (rdsRand(s, 90 + b) < 0.25) continue; const a = b / 12 * Math.PI * 2 + 0.2, len = 22 + (rdsRand(s, 100 + b) < 0.2 ? -8 : 0); rdsStroke(B, x + Math.cos(a) * 5, hub + Math.sin(a) * 5, x + Math.cos(a) * len, hub + Math.sin(a) * len, 1.6, 2.2, P.metal, 1, s + b); }
      rdsStroke(B, x, hub, x + 26, hub + 2, 1, 1, P.metal, 1, s); rdsPoly(B, [[x + 22, hub - 7], [x + 36, hub - 3], [x + 36, hub + 6], [x + 22, hub + 7]], (px, py, t) => rdsPick(P.metal, 0.8 + t * 1.6, px, py), 1);
      rdsCol(B, x, hub + 3, hub - 3, 7, P.metal, s, { round: true }); }
    // 巨兽的肋骨
    { const x = rdsRand(s, 81) * RDS_TW; for (let r = 0; r < 6; r++) { const rx = x + r * 11, rh = 34 - Math.abs(r - 2) * 5; for (let a = 0; a <= 12; a++) { const t = a / 12, px = rx + Math.sin(t * 2.2) * 10, py = -Math.sin(t * Math.PI * 0.85) * rh; rdsStroke(B, px, py, px, py, 1.6 - t * 0.8, 1, P.bone, 1, s + r); } } rdsStroke(B, x - 6, -6, x + 70, -4, 2, 1.5, P.bone, 1, s); rdsRock(B, x - 12, 14, 9, P.bone, s + 7, {}); }
    // 仙人掌和灌木
    for (let i = 0; i < 7; i++) { const x = (i + rdsRand(s, 120 + i) * 0.8) * RDS_TW / 7; rdsCactus(B, x, 34 + rdsRand(s, 130 + i) * 74, P.cactus, s + i); }
    for (let i = 0; i < 12; i++) rdsShrub(B, rdsRand(s, 140 + i) * RDS_TW, 10 + rdsRand(s, 150 + i) * 12, P.wood, s + i);
  }
}

// =============== 1 废墟城郊 ===============
function rdsRuin(B, k, s) {
  const P = RDS_PAL[1];
  if (k === 0) { // 天边的城市天际线：高低不一的楼、歪掉的塔、吊车
    rdsTerrain(B, (x) => 8 + rdsN(x, 30, s) * 8, P.sky, { seed: s });
    let x = 0, i = 0;
    while (x < RDS_TW - 20) { const w = 26 + rdsRand(s, i) * 60, h = 40 + Math.pow(rdsRand(s, i + 50), 1.5) * 150; rdsBlock(B, Math.round(x), Math.round(w), Math.round(h), P.sky, s + i, { fh: 9, wx: 7, dark: P.sky[2], m: 2, lit: 0.04, antenna: true }); x += w + rdsRand(s, i + 90) * 30 - 6; i++; }
    const cx = rdsRand(s, 300) * RDS_TW; rdsLattice(B, cx, 8, 4, 150, P.sky[2], 2); rdsLine(B, cx - 30, -150, cx + 90, -152, P.sky[2], 2); rdsLine(B, cx - 30, -149, cx + 90, -151, P.sky[2], 2); rdsLine(B, cx + 70, -151, cx + 70, -110, P.sky[2], 2); rdsLight(B, cx + 2, -156, 'blink', '#ff5038', 3);
  } else if (k === 1) { // 近一点的楼：窗洞、楼板、缺角、钢筋、楼顶水箱
    rdsTerrain(B, (x) => 6 + rdsN(x, 20, s) * 10, P.con, { seed: s });
    let x = 10, i = 0;
    while (x < RDS_TW - 40) { const w = 44 + rdsRand(s, i) * 70, h = 60 + rdsRand(s, i + 40) * 130; rdsBlock(B, Math.round(x), Math.round(w), Math.round(h), P.con, s + i, { lit: 0.05, tank: true, antenna: true, rebar: P.rust[2], m: 2 }); x += w + 20 + rdsRand(s, i + 80) * 70; i++; }
  } else { // 中景：塌了一半的小屋、瓦砾、断墙、水塔、歪路灯、铁丝网
    rdsTerrain(B, (x) => 3 + rdsN(x, 16, s) * 9, P.con2, { seed: s, deep: 30 });
    // 水塔
    { const x = rdsRand(s, 7) * RDS_TW; for (const d of [-14, 14]) rdsLine(B, x + d * 1.2, 0, x + d * 0.8, -80, P.rust[3], 1); rdsLine(B, x - 16, -20, x + 14, -50, P.rust[3], 2); rdsLine(B, x + 16, -20, x - 14, -50, P.rust[3], 2);
      rdsCol(B, x, -78, -108, 34, P.rust, s, { bands: 7 }); rdsPoly(B, [[x - 19, -108], [x + 19, -108], [x, -122]], (px, py, t) => rdsPick(P.roof, t * 2 + (px > x ? 1 : 0), px, py), 1); }
    // 小屋
    for (let i = 0; i < 3; i++) rdsHouse(B, (0.1 + i * 0.32 + rdsRand(s, 10 + i) * 0.12) * RDS_TW, 60 + rdsRand(s, 20 + i) * 40, 46 + rdsRand(s, 30 + i) * 30, s + i * 17, P);
    // 断墙（砖）
    for (let i = 0; i < 3; i++) { const x = rdsRand(s, 40 + i) * RDS_TW, w = 30 + rdsRand(s, 43 + i) * 40, h = 20 + rdsRand(s, 46 + i) * 30;
      for (let xx = 0; xx < w; xx++) { const top = -h + Math.abs(rdsDist(xx * 9, w * 4.5)) * 0.05 + rdcHash(xx, i, s) * 6 + (xx > w * 0.6 ? (xx - w * 0.6) * 1.2 : 0); for (let y = Math.round(top); y < 2; y++) { const row = Math.floor((y + 200) / 4), brick = ((xx + (row & 1) * 4) % 8 === 0) || ((y + 200) % 4 === 0); rdsPx(B, x + xx, y, brick ? P.con2[3] : rdsPick(P.brick, (y === Math.round(top) ? 0 : 1) + (rdcHash(x + xx, y, s) < 0.1 ? 0.8 : 0), x + xx, y), 1); } } }
    // 瓦砾堆
    for (let i = 0; i < 5; i++) rdsRubble(B, rdsRand(s, 60 + i) * RDS_TW, 30 + rdsRand(s, 65 + i) * 30, P.con2, s + i * 7, P.rust[2]);
    // 弯掉的路灯
    for (let i = 0; i < 2; i++) { const x = rdsRand(s, 70 + i) * RDS_TW; rdsStroke(B, x, 0, x, -60, 1.5, 1.2, P.con, 1, s); rdsStroke(B, x, -60, x + 10, -72, 1.2, 1, P.con, 1, s); rdsStroke(B, x + 10, -72, x + 18, -66, 1, 1, P.con, 1, s); rdsRect(B, x + 15, -66, 7, 3, P.con[3], 1); }
    // 铁丝网围栏
    { const x0 = rdsRand(s, 75) * RDS_TW, w = 120; for (let p = 0; p <= w; p += 30) rdsRect(B, x0 + p, -30, 2, 30, P.con[3], 1); for (let xx = 0; xx < w; xx++) for (let y = -28; y < 0; y++) { if (rdcNoise2((x0 + xx) / 18, y / 10, s) < 0.35) continue; if (((xx + y) % 5 + 5) % 5 === 0 || ((xx - y) % 5 + 5) % 5 === 0) rdsPx(B, x0 + xx, y, P.con[2], 2); } }
  }
}
// 塌了一半的小屋：褪色护墙板、钉了木板的窗、破屋顶、砖烟囱；有的窗里夜里透出火光（有人住）
function rdsHouse(B, x0, w, h, s, P) {
  x0 = Math.round(x0); w = Math.round(w); h = Math.round(h);
  const pa = P.paint[Math.floor(rdsRand(s, 1) * P.paint.length)], rh = Math.round(w * 0.38), side = rdsRand(s, 2) > 0.5 ? 1 : -1;
  const cut = (xx, y) => { const u = side > 0 ? xx / w : 1 - xx / w; return u > 0.62 && y < -h - rh + (1 - u) * (rh + h) * 1.4 + 18 + rdcHash(xx, y >> 2, s) * 8; };
  // 墙
  for (let xx = 0; xx < w; xx++) for (let y = -h; y < 2; y++) { if (cut(xx, y)) continue; const px = x0 + xx; let v = 1 + (xx > w - 5 ? 1.2 : 0) + ((((y + 400) % 5) === 0) ? 0.9 : 0) + (rdcHash(px, y, s) < 0.07 ? 0.7 : 0) + (rdcHash(px, 1, s) < 0.15 ? 0.4 : 0); rdsPx(B, px, y, rdsPick(pa, v, px, y), 1); }
  // 屋顶
  rdsPoly(B, [[x0 - 4, -h], [x0 + w / 2, -h - rh], [x0 + w + 4, -h]], (px, py, t) => { const xx = px - x0; if (cut(xx, py)) return -2; const row = ((py + 400) % 4); return rdsPick(P.roof, (row === 0 ? 1.8 : 0.6) + (px > x0 + w / 2 ? 1 : 0) + (rdcHash(px >> 1, py, s) < 0.12 ? 0.7 : 0), px, py); }, 1);
  // 把被 cut 掉的屋顶像素清掉（多边形填充时返回了 -2）
  for (let xx = -4; xx < w + 5; xx++) for (let y = -h - rh - 2; y < -h + 1; y++) { const py = y + B.base; if (py < 0) continue; const i = py * B.w + rdsWrap(x0 + xx); if (B.c[i] === -2) B.c[i] = -1; }
  // 烟囱
  const chx = x0 + Math.round(w * (side > 0 ? 0.22 : 0.7)); for (let xx = 0; xx < 7; xx++) for (let y = -h - rh * 0.9; y < -h - rh * 0.3; y++) rdsPx(B, chx + xx, y, rdsPick(P.brick, 1 + (xx > 4 ? 1 : 0) + ((Math.round(y) % 3 === 0) ? 0.8 : 0), chx + xx, y), 1);
  // 窗（钉木板）和门
  for (let f = 0; f < 2; f++) for (let c = 0; c < 2; c++) { const wx = x0 + Math.round(w * (0.18 + c * 0.45)), wy = -h + 6 + f * Math.round(h * 0.48); if (f === 1 && c === 1) continue; if (cut(wx - x0, wy)) continue; rdsRect(B, wx, wy, 10, 12, P.dark, 1); const lit = rdsRand(s, 5 + f * 2 + c) > 0.7; if (lit) rdsLight(B, wx + 5, wy + 6, 'win', '#ff9a50', 5);
    rdsLine(B, wx - 1, wy + 2, wx + 10, wy + 9, P.wood[1], 1); rdsLine(B, wx - 1, wy + 3, wx + 10, wy + 10, P.wood[2], 1); rdsLine(B, wx - 1, wy + 10, wx + 10, wy + 3, P.wood[1], 1); }
  const dx = x0 + Math.round(w * 0.62); if (!cut(dx - x0, -18)) { rdsRect(B, dx, -18, 9, 18, P.dark, 1); rdsRect(B, dx + 1, -17, 3, 17, P.wood[2], 1); }
  // 塌掉那一侧堆着碎砖
  rdsRubble(B, x0 + (side > 0 ? w * 0.85 : w * 0.15), 26, P.con2, s + 3, P.rust[2]);
}

// =============== 2 枯死森林 ===============
function rdsForest(B, k, s) {
  const P = RDS_PAL[2];
  if (k === 0) { // 雾里的山脊，上面一根根枯松尖
    const hf = (x) => 26 + rdsN(x, 7, s) * 36 + rdsN(x, 23, s + 1) * 10;
    rdsTerrain(B, hf, P.hill, { seed: s });
    for (let x = 0; x < RDS_TW; x += 3 + Math.floor(rdcHash(x, 0, s) * 6)) { const base = -Math.round(hf(x)) + 2, h = 8 + rdcHash(x, 1, s) * 26; for (let y = 0; y < h; y++) { const ww = y < h * 0.3 ? 2 : 1; rdsRect(B, x, base - y, ww, 1, P.hill[2], 2); } if (rdcHash(x, 2, s) > 0.6) rdsLine(B, x, base - h * 0.6, x + 3, base - h * 0.7, P.hill[2], 2); }
  } else if (k === 1) { // 远处的枯树林（雾很浓）
    rdsTerrain(B, (x) => 14 + rdsN(x, 11, s) * 22, P.far, { seed: s });
    for (let i = 0; i < 34; i++) { const x = rdsRand(s, i) * RDS_TW; rdsDeadTree(B, x, 50 + rdsRand(s, i + 40) * 90, 2.2 + rdsRand(s, i + 80) * 1.6, P.far, s + i, { depth: 3 }); }
  } else { // 中景：大枯树（挂着青苔、停着乌鸦）、树桩、倒下的树干和发光蘑菇
    rdsTerrain(B, (x) => 4 + rdsN(x, 14, s) * 12, P.ground, { seed: s, deep: 30 });
    for (let i = 0; i < 6; i++) { const x = (i + 0.2 + rdsRand(s, i) * 0.6) * RDS_TW / 6; rdsDeadTree(B, x, 130 + rdsRand(s, i + 10) * 100, 6 + rdsRand(s, i + 20) * 5, P.bark, s + i * 11, { depth: 4, moss: 0.35, mossR: P.moss, crow: 0.04, crowC: rdsC('#1e1a18') }); }
    for (let i = 0; i < 4; i++) { const x = rdsRand(s, 30 + i) * RDS_TW, w = 14 + rdsRand(s, 34 + i) * 8, h = 10 + rdsRand(s, 38 + i) * 16; rdsCol(B, x, 0, -h, w, P.bark, s + i, { ribs: true }); for (let xx = 0; xx < w; xx++) if (rdcHash(xx, i, s) > 0.4) rdsPx(B, x - w / 2 + xx, -h - 1 - Math.floor(rdcHash(xx, i + 1, s) * 3), P.bark[1], 1); rdsRect(B, x - w / 2 + 2, -h, w - 4, 1, P.bark[0], 1); }
    // 倒下的树干：横着的圆木，截面有年轮，上面长着会发光的蘑菇
    for (let i = 0; i < 2; i++) { const x = rdsRand(s, 50 + i) * RDS_TW, L = 90 + rdsRand(s, 52 + i) * 60, r = 6 + rdsRand(s, 54 + i) * 3;
      for (let xx = 0; xx < L; xx++) for (let y = -2 * r; y <= 0; y++) { const dy = (y + r) / r; rdsPx(B, x + xx, y, rdsPick(P.bark, 1.2 + dy * 1.5 + (((xx + Math.round(y * 0.3)) % 7 === 0) ? 0.7 : 0) + (rdcHash(x + xx, y, s) < 0.06 ? 0.7 : 0), x + xx, y), 1); }
      for (let y = -2 * r; y <= 0; y++) for (let xx = -2; xx <= 2; xx++) { const d = Math.hypot(xx * 1.6, y + r); if (d > r + 0.5) continue; rdsPx(B, x + L + xx, y, (Math.round(d) % 3 === 0) ? P.bark[2] : P.ground[0], 1); }
      for (let m = 0; m < 4; m++) { const mx = x + 10 + rdsRand(s, 60 + m + i * 4) * (L - 20), my = -2 * r - 1; rdsRect(B, mx, my - 3, 5, 2, P.shroom, 3); rdsRect(B, mx + 2, my - 1, 1, 2, P.bark[0], 1); rdsLight(B, mx + 2, my - 2, 'glow', '#c8f070', 4); } }
    for (let i = 0; i < 8; i++) rdsShrub(B, rdsRand(s, 70 + i) * RDS_TW, 12 + rdsRand(s, 80 + i) * 14, P.bark, s + i);
  }
}

// =============== 3 辐射荒原 ===============
function rdsRad(B, k, s) {
  const P = RDS_PAL[3];
  if (k === 0) { // 天边：矮山、冷却塔（冒着白汽）、高烟囱（顶上闪红灯）
    rdsTerrain(B, (x) => 16 + rdsN(x, 9, s) * 24, P.hill, { seed: s });
    for (let i = 0; i < 2; i++) { const x = (0.2 + i * 0.45 + rdsRand(s, i) * 0.15) * RDS_TW; rdsCooling(B, x, 70, 100, P.hill, s + i, 2); for (let c = 0; c < 6; c++) rdsRock(B, x + c * 9 - 10 + rdsRand(s, 10 + c) * 6, 26 + c * 4, 16 + c * 2, rdsR(['#c8d4bc', '#b4c2a8', '#a2b296']), s + c, { m: 2 }); }
    for (let i = 0; i < 3; i++) { const x = rdsRand(s, 20 + i) * RDS_TW, h = 120 + rdsRand(s, 23 + i) * 40; rdsCol(B, x, 0, -h, 8, P.hill, s, { bands: 20, m: 2 }); rdsLight(B, x, -h - 2, 'blink', P.red, 3); }
  } else if (k === 1) { // 工厂区：锯齿屋顶厂房、管道、储罐、电线塔
    rdsTerrain(B, (x) => 8 + rdsN(x, 18, s) * 12, P.con, { seed: s });
    for (let i = 0; i < 4; i++) { const x = Math.round((i + rdsRand(s, i) * 0.4) * RDS_TW / 4), w = 90 + Math.round(rdsRand(s, i + 4) * 60), h = 40 + rdsRand(s, i + 8) * 30;
      rdsBlock(B, x, w, Math.round(h), P.con, s + i, { fh: 12, wx: 8, m: 2, lit: 0.03 });
      for (let t = 0; t < w - 14; t += 16) rdsPoly(B, [[x + t, -h + 1], [x + t + 4, -h - 12], [x + t + 16, -h + 1]], (px, py, tt) => rdsPick(P.steel, (px - x - t < 5 ? 0.5 : 1.8) + tt, px, py), 2);
      const cx = x + w - 20, ch = h + 60 + rdsRand(s, i + 12) * 40; rdsCol(B, cx, -h, -ch, 9, P.rust, s + i, { bands: 14, m: 2 }); rdsLight(B, cx, -ch - 2, 'blink', P.red, 3);
      rdsStroke(B, x + w, -20 - i * 4, x + w + 40, -20 - i * 4, 2.2, 2.2, P.steel, 2, s); }
    for (let i = 0; i < 3; i++) { const x = rdsRand(s, 30 + i) * RDS_TW; rdsCol(B, x, 0, -36, 34, P.steel, s + i, { m: 2 }); rdsPoly(B, [[x - 17, -36], [x + 17, -36], [x + 10, -44], [x - 10, -44]], (px, py) => rdsPick(P.steel, px < x ? 0.6 : 1.8, px, py), 2); rdsLine(B, x - 17, -24, x + 17, -24, P.steel[3], 2); }
    { const x = rdsRand(s, 50) * RDS_TW; rdsCooling(B, x, 96, 150, P.con, s + 3, 2); for (let c = 0; c < 9; c++) rdsRock(B, x - 14 + c * 7 + rdsRand(s, 60 + c) * 8, 30 + c * 5, 18 + c * 2, rdsR(['#eef2e4', '#d8e0cc', '#c0ccb2']), s + c, { m: 2 }); }
    for (let i = 0; i < 2; i++) { const x = rdsRand(s, 40 + i) * RDS_TW; rdsLattice(B, x, 30, 8, 130, P.steel[3], 2); for (const yy of [-110, -94]) { rdsLine(B, x - 22, yy, x + 22, yy, P.steel[3], 2); rdsLine(B, x - 22, yy + 1, x - 22, yy + 6, P.steel[2], 2); rdsLine(B, x + 22, yy + 1, x + 22, yy + 6, P.steel[2], 2); } }
  } else { // 中景：锈油桶、荧光绿毒水洼、警示牌、扭曲的钢梁、枯灰树
    rdsTerrain(B, (x) => 3 + rdsN(x, 12, s) * 12, P.ground, { seed: s, deep: 30 });
    for (let i = 0; i < 5; i++) { const x = rdsRand(s, i) * RDS_TW, w = 30 + rdsRand(s, 5 + i) * 50; for (let xx = -w / 2; xx < w / 2; xx++) { const d = Math.abs(xx) / (w / 2), hh = Math.round((1 - d * d) * 3); for (let y = -hh; y <= 1; y++) rdsPx(B, x + xx, y, y === -hh ? P.tox2 : P.tox, 3); } rdsLight(B, x, -2, 'glow', '#a7f070', Math.round(w / 3)); for (let b = 0; b < 3; b++) rdsLight(B, x + (rdsRand(s, 20 + i * 3 + b) - 0.5) * w * 0.6, -3, 'bubble', '#e8ffb0', 2); }
    for (let i = 0; i < 6; i++) { const x = rdsRand(s, 40 + i) * RDS_TW, n = 1 + Math.floor(rdsRand(s, 46 + i) * 3); for (let b = 0; b < n; b++) { const R2 = rdsRand(s, 50 + i + b) > 0.4 ? P.yel : P.rust, bx = x + b * 12, tip = rdsRand(s, 60 + i + b) > 0.75; if (tip) { for (let xx = 0; xx < 16; xx++) for (let y = -10; y <= 0; y++) rdsPx(B, bx + xx, y, rdsPick(R2, 1 + (y + 5) / 5 * 1.3 + ((xx % 5) === 0 ? 0.8 : 0), bx + xx, y), 1); for (let y = -8; y <= -2; y++) rdsPx(B, bx + 16, y, P.steel[3], 1); rdsLight(B, bx + 18, 0, 'glow', '#a7f070', 3); } else { rdsCol(B, bx, 0, -15, 10, R2, s + b, { bands: 5 }); rdsRect(B, bx - 2, -9, 4, 3, P.steel[4], 1); rdsPx(B, bx - 1, -10, P.steel[4], 1); } } }
    for (let i = 0; i < 4; i++) { const x = rdsRand(s, 70 + i) * RDS_TW, a = -0.4 - rdsRand(s, 74 + i) * 1.6, L = 40 + rdsRand(s, 78 + i) * 40; rdsStroke(B, x, 0, x + Math.cos(a) * L, Math.sin(a) * L, 2.2, 1.8, P.rust, 1, s + i); rdsStroke(B, x + 6, 0, x + 6 + Math.cos(a + 0.3) * L * 0.6, Math.sin(a + 0.3) * L * 0.6, 1.6, 1.4, P.rust, 1, s + i + 9); }
    for (let i = 0; i < 2; i++) { const x = rdsRand(s, 85 + i) * RDS_TW; rdsRect(B, x, -36, 2, 36, P.steel[2], 1); rdsPoly(B, [[x + 1, -60], [x + 14, -38], [x - 12, -38]], P.steel[4], 1); rdsPoly(B, [[x + 1, -57], [x + 11, -40], [x - 9, -40]], (px, py) => rdsPick(P.yel, px < x ? 0 : 1, px, py), 1); rdsRect(B, x - 1, -47, 4, 4, P.steel[4], 1); rdsPx(B, x - 3, -44, P.steel[4], 1); rdsPx(B, x + 4, -44, P.steel[4], 1); }
    for (let i = 0; i < 4; i++) rdsDeadTree(B, rdsRand(s, 90 + i) * RDS_TW, 50 + rdsRand(s, 94 + i) * 40, 2.5, rdsR(['#9a9a88', '#7a7a6a', '#5c5c50', '#42423a']), s + i, { depth: 3 });
    for (let i = 0; i < 5; i++) rdsRubble(B, rdsRand(s, 100 + i) * RDS_TW, 34, P.con, s + i * 5, P.rust[2]);
    // 架在支架上的旧管道（断了一截，往下滴绿水）
    for (let i = 0; i < 2; i++) { const x = rdsRand(s, 110 + i) * RDS_TW, L = 140 + rdsRand(s, 112 + i) * 80, y = -26 - rdsRand(s, 114 + i) * 14;
      for (let p = 0; p <= L; p += 36) { rdsRect(B, x + p - 1, y, 3, -y, P.steel[3], 1); rdsLine(B, x + p - 6, 0, x + p, y + 4, P.steel[3], 1); }
      rdsStroke(B, x - 4, y - 4, x + L * 0.55, y - 4, 4, 4, P.rust, 1, s + i); rdsStroke(B, x + L * 0.62, y - 4, x + L, y - 4, 4, 4, P.rust, 1, s + i + 3);
      const dx = x + L * 0.62; for (let k = 0; k < 6; k++) rdsPx(B, dx, y + k * 3, P.tox, 3); rdsLight(B, dx, y + 4, 'glow', '#a7f070', 3); }
    // 报废的小汽车（锈得只剩壳）
    for (let i = 0; i < 2; i++) { const x = rdsRand(s, 120 + i) * RDS_TW; rdsPoly(B, [[x, -4], [x + 4, -14], [x + 14, -15], [x + 20, -24], [x + 38, -24], [x + 46, -14], [x + 56, -12], [x + 56, -4]], (px, py, t) => rdsPick(P.rust, 0.5 + t * 2.2 + (rdcHash(px, py, s) < 0.08 ? 0.7 : 0), px, py), 1); rdsRect(B, x + 22, -22, 7, 7, P.steel[4], 1); rdsRect(B, x + 31, -22, 7, 7, P.steel[4], 1); for (const wx of [x + 12, x + 44]) rdsRect(B, wx - 4, -6, 8, 6, P.steel[4], 1); }
  }
}
// 冷却塔：中间细两头粗的双曲面，竖向的水渍，顶上一圈亮边
function rdsCooling(B, x, w, h, R, s, m) {
  for (let y = -h; y <= 1; y++) {
    const t = (y + h) / h, hw = w / 2 * (0.6 + 0.42 * Math.pow(Math.abs(t - 0.3) / 0.7, 2));
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
      if (Math.abs(dx) > hw) continue;
      const px = Math.round(x + dx);
      let v = 0.8 + dx / hw * 1.2 + (y === -h ? -0.8 : 0) + (rdcHash(px, 0, s) < 0.18 && t > 0.1 ? 0.5 : 0) + (rdcHash(px, y, s) < 0.04 ? 0.5 : 0);
      rdsPx(B, px, y, rdsPick(R, v, px, y), m || 1);
    }
  }
}

// =============== 4 冰封高原 ===============
function rdsSnow(B, k, s) {
  const P = RDS_PAL[4];
  if (k === 0) { // 锯齿状的雪山
    const hf = (x) => { const r1 = 1 - Math.abs(rdsN(x, 6, s) * 2 - 1), r2 = 1 - Math.abs(rdsN(x, 17, s + 1) * 2 - 1); return 30 + r1 * r1 * 120 + r2 * 26; };
    rdsTerrain(B, hf, P.rock, { seed: s, deep: 120, snow: { R: P.snow, line: 70, var: 40 } });
  } else if (k === 1) { // 山脚：积雪的小山、远处一片雪松
    const hf = (x) => 24 + rdsN(x, 10, s) * 50 + (1 - Math.abs(rdsN(x, 29, s + 1) * 2 - 1)) * 14;
    rdsTerrain(B, hf, P.rock, { seed: s, deep: 80, snow: { R: P.snow, line: 26, var: 24 } });
    for (let i = 0; i < 46; i++) { const x = rdsRand(s, i) * RDS_TW, base = -Math.round(hf(x)) * (0.3 + rdsRand(s, i + 60) * 0.5); if (base < -50) continue; const h = 20 + rdsRand(s, i + 50) * 30; rdsPineAt(B, x, base, h, P, s + i); }
  } else { // 中景：雪堆、大雪松、冰岩、冻住的无线电塔
    rdsTerrain(B, (x) => 4 + rdsN(x, 12, s) * 14, P.snow, { seed: s, deep: 40 });
    { const x = rdsRand(s, 5) * RDS_TW; rdsLattice(B, x, 22, 4, 170, P.metal[2], 1); rdsLine(B, x - 7, -120, x + 7, -120, P.metal[2], 1); for (let y = -168; y < 0; y += 14) rdsPx(B, x - 4 + ((y / 14) & 1) * 6, y, P.snow[0], 1); rdsLight(B, x, -174, 'blink', '#ff5038', 3); for (let c = 0; c < 6; c++) rdsLine(B, x - 10 + c * 4, -60, x - 10 + c * 4, -60 + 3 + (c % 3) * 2, P.ice[1], 2); }
    for (let i = 0; i < 5; i++) { const x = rdsRand(s, 10 + i) * RDS_TW, w = 28 + rdsRand(s, 15 + i) * 50; rdsRock(B, x, w, w * (0.5 + rdsRand(s, 20 + i) * 0.3), P.rock, s + i, { snow: P.snow }); }
    for (let i = 0; i < 3; i++) { const x = rdsRand(s, 30 + i) * RDS_TW; for (let c = 0; c < 4; c++) { const h = 16 + rdsRand(s, 33 + i * 4 + c) * 30, cx = x + c * 9 - 12, a = (c - 1.5) * 0.18; rdsPoly(B, [[cx - 5, 0], [cx + Math.sin(a) * h, -h], [cx + 5, 0]], (px, py, t) => rdsPick(P.ice, (px < cx + Math.sin(a) * h * (1 - t) ? 0.4 : 2) + t * 0.8, px, py), 1); } rdsLight(B, x, -14, 'glow', '#b4e4f0', 6); }
    for (let i = 0; i < 9; i++) { const x = (i + rdsRand(s, 40 + i) * 0.8) * RDS_TW / 9, h = 70 + rdsRand(s, 50 + i) * 110; rdsPine(B, x, h, P.pine, P.snow, s + i); }
  }
}
function rdsPineAt(B, x, base, h, P, s) { // 在坡上种一棵（先画到底边，再整体抬到坡上太复杂，这里直接按偏移画）
  const sb = B.base; B.base = sb + Math.round(base); rdsPine(B, x, h, P.pine, P.snow, s, 2); B.base = sb;
}

// =============== 5 外星坠落区 ===============
function rdsAlien(B, k, s) {
  const P = RDS_PAL[5];
  if (k === 0) { // 天边：半截插进地里的巨大飞船残骸 + 浮空岩
    rdsTerrain(B, (x) => 14 + rdsN(x, 8, s) * 26, P.hill, { seed: s });
    const cx = rdsRand(s, 1) * RDS_TW, rx = 260, ry = 150;
    for (let y = -ry; y <= 2; y++) for (let dx = -rx; dx <= rx; dx++) {
      const nx = dx / rx, ny = (y - 30) / (ry + 30); if (nx * nx + ny * ny > 1) continue;
      const brk = dx > rx * 0.35 && y < -ry + (dx - rx * 0.35) * 1.1 + rdcHash(dx >> 2, 0, s) * 20; if (brk) continue; // 断开的缺口
      const px = cx + dx, rib = (((dx + 1000) % 34) < 2) || (((y + 1000) % 26) === 0);
      rdsPx(B, px, y, rdsPick(P.hull, 0.6 + nx * 0.8 + (rib ? 0.9 : 0) + (rdcHash(px, y, s) < 0.04 ? 0.5 : 0), px, y), 2);
      if ((((dx + 1000) % 34) === 17) && (((y + 1000) % 26) === 13) && rdcHash(dx, y, s) > 0.4) rdsLight(B, px, y, 'glow', '#73eff7', 3);
    }
    for (let i = 0; i < 4; i++) rdsFloatRock(B, rdsRand(s, 10 + i) * RDS_TW, -110 - rdsRand(s, 14 + i) * 60, 16 + rdsRand(s, 18 + i) * 22, P.hill, s + i, 2);
  } else if (k === 1) { // 弯弯的外星尖塔、浮空岛、地上的发光纹路
    rdsTerrain(B, (x) => 10 + rdsN(x, 13, s) * 22, P.rock, { seed: s });
    for (let i = 0; i < 6; i++) rdsSpire(B, rdsRand(s, i) * RDS_TW, 70 + rdsRand(s, i + 6) * 110, 10 + rdsRand(s, i + 12) * 10, (rdsRand(s, i + 18) - 0.5) * 60, P.rock, P.glow, s + i, 2);
    for (let i = 0; i < 3; i++) rdsFloatRock(B, rdsRand(s, 30 + i) * RDS_TW, -100 - rdsRand(s, 33 + i) * 50, 22 + rdsRand(s, 36 + i) * 20, P.rock, s + i + 30, 2, P.glow);
  } else { // 中景：水晶簇、飞船碎片（发光接缝）、会发光的触须植物
    rdsTerrain(B, (x) => 3 + rdsN(x, 15, s) * 11, P.rock, { seed: s, deep: 30 });
    for (let i = 0; i < 3; i++) { const x = rdsRand(s, 40 + i) * RDS_TW, w = 50 + rdsRand(s, 43 + i) * 40, a = (rdsRand(s, 46 + i) - 0.5) * 0.8, ca = Math.cos(a), sa = Math.sin(a), hh = 30 + rdsRand(s, 49 + i) * 20;
      const pts = [[x - w / 2, 2], [x - w / 2 + sa * hh, -hh * ca], [x + w / 2 + sa * hh * 0.6, -hh * ca * 0.7 - 10], [x + w / 2, 2]];
      rdsPoly(B, pts, (px, py, t) => { const seam = (((px - x + 1000) % 15) === 0) || (Math.round(py) === Math.round(-hh * 0.45)); return seam ? P.glow : rdsPick(P.hull, 0.5 + t * 2 + (rdcHash(px, py, s) < 0.06 ? 0.6 : 0), px, py); }, 1);
      rdsLight(B, x, -hh * 0.45, 'glow', '#73eff7', 8); }
    for (let i = 0; i < 7; i++) { const x = (i + rdsRand(s, i) * 0.7) * RDS_TW / 7, pink = rdsRand(s, i + 70) > 0.75, R = pink ? P.pink : P.cry, n = 3 + Math.floor(rdsRand(s, i + 7) * 3);
      for (let c = 0; c < n; c++) rdsCrystal(B, x + (c - n / 2) * 7, 0, 24 + rdsRand(s, i * 9 + c) * (c === 1 ? 80 : 46), -Math.PI / 2 + (c - (n - 1) / 2) * 0.32 + (rdsRand(s, i * 5 + c) - 0.5) * 0.2, 7 + rdsRand(s, i + c) * 6, R, s + i * 9 + c);
      rdsLight(B, x, -20, 'glow', pink ? '#f070ff' : '#73eff7', 10); }
    for (let i = 0; i < 6; i++) { const x = rdsRand(s, 80 + i) * RDS_TW, h = 30 + rdsRand(s, 86 + i) * 40, bend = (rdsRand(s, 92 + i) - 0.5) * 30; let px = x, py = 0; for (let t = 1; t <= 10; t++) { const nx = x + Math.sin(t / 10 * 2.4) * bend, ny = -h * t / 10; rdsStroke(B, px, py, nx, ny, 2.2 - t * 0.14, 2.1 - t * 0.15, P.pink, 1, s + i); px = nx; py = ny; } for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) rdsPx(B, px + dx, py + dy, dx * dx + dy * dy <= 2 ? rdsC('#ffe8ff') : P.glow2, 3); rdsLight(B, px, py, 'glow', '#f070ff', 6); }
  }
}
// 尖塔：弯弯的、越往上越细的角，上面有几圈发光的环
function rdsSpire(B, x, h, w, bend, R, glow, s, m) {
  let px = x, py = 0;
  for (let t = 1; t <= 20; t++) { const u = t / 20, nx = x + Math.sin(u * 1.7) * bend * u, ny = -h * u; rdsStroke(B, px, py, nx, ny, w / 2 * (1 - (u - 0.05)) + 0.5, w / 2 * (1 - u) + 0.5, R, m, s); if (t % 6 === 3) { const r = w / 2 * (1 - u) + 1; for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) rdsPx(B, nx + dx, ny, glow, 3); rdsLight(B, nx, ny, 'glow', '#73eff7', 4); } px = nx; py = ny; }
}
// 浮空岩：上面平、下面尖的一块石头，下面挂着发光的根须
function rdsFloatRock(B, x, y, w, R, s, m, glow) {
  for (let yy = -w * 0.25; yy <= w * 0.7; yy++) {
    const hw = yy < 0 ? w / 2 * Math.sqrt(1 - Math.pow(yy / (w * 0.25), 2)) : w / 2 * (1 - yy / (w * 0.7)) + (rdcHash(Math.round(yy), 0, s) - 0.5) * 3;
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) { if (Math.abs(dx) > hw) continue; const px = Math.round(x + dx), py = Math.round(y + yy); rdsPx(B, px, py, rdsPick(R, (yy < -w * 0.18 ? 0 : 1) + dx / w * 1.4 + yy / w * 1.4 + (rdcHash(px, py, s) < 0.06 ? 0.6 : 0), px, py), m); }
  }
  if (glow) for (let r = 0; r < 4; r++) { const rx = x + (r - 1.5) * w * 0.2, L = 6 + rdcHash(r, x, s) * 14; for (let k = 0; k < L; k++) rdsPx(B, rx + Math.round(Math.sin(k * 0.5 + r) * 1.2), y + w * 0.5 * (1 - Math.abs(r - 1.5) / 2) + k, glow, 3); }
}
// 水晶：长条六棱柱，左边亮面、右边暗面、中间一道高光棱，里面零星发光
function rdsCrystal(B, x, y, len, a, w, R, s) {
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, hw = w / 2, rr = Math.ceil(len + w);
  for (let py = Math.floor(y - rr); py <= y + w; py++) for (let px = Math.floor(x - rr); px <= x + rr; px++) {
    const dx = px - x, dy = py - y, u = dx * ux + dy * uy, v = dx * nx + dy * ny;
    if (u < -1 || u > len) continue;
    const lim = u < len * 0.72 ? hw : hw * (len - u) / (len * 0.28);
    if (Math.abs(v) > lim) continue;
    const left = (v * (ux > 0 ? 1 : -1)) < 0 ? 1 : 0; // 屏幕左边那一半是亮面
    let t = Math.abs(v) < 0.8 ? 0 : left ? 1 + Math.abs(v) / hw * 0.6 : 2.4 + Math.abs(v) / hw * 0.8;
    if (u > len * 0.72) t = Math.max(0, t - 0.8);
    t += (1 - u / len) * 0.6;
    const hs = rdcHash(px, py, s);
    if (hs < 0.03) { rdsPx(B, px, py, R[0], 3); continue; }
    rdsPx(B, px, py, rdsPick(R, t, px, py), 1);
  }
}

// ---------- 建图 / 缓存 ----------
function rdsToCanvas(B) {
  const cv = createCanvas(B.w, B.h), g = cv.getContext('2d'), im = g.createImageData(B.w, B.h), d = im.data;
  for (let i = 0; i < B.w * B.h; i++) { const c = B.c[i]; if (c < 0) continue; d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
  return cv;
}
// 描边：物体（材质 1）外面一圈深褐；物体顶上那一圈用浅一点的褐色
function rdsOutline(B, o1, o2, rows) {
  const s = B.c.slice(), sm = B.m.slice(), W = B.w, H = B.h;
  const f = (px, py) => { if (py < 0 || py >= H) return false; const i = py * W + ((px % W) + W) % W; return s[i] >= 0 && sm[i] === 1; };
  for (let py = 0; py < Math.min(H, rows || B.base + 2); py++) for (let px = 0; px < W; px++) {
    const i = py * W + px;
    if (s[i] >= 0 && (sm[i] === 1 || sm[i] === 3)) continue;
    const down = f(px, py + 1), side = f(px - 1, py) || f(px + 1, py), up = f(px, py - 1);
    if (!down && !side && !up) continue;
    B.c[i] = (down && !up && !side) ? o2 : o1; B.m[i] = 8;
  }
}
// 空气透视：越远越接近天边的颜色；贴地的地方再加一层雾
function rdsHaze(B, hz, amt, fog) {
  for (let py = 0; py < B.h; py++) {
    const up = B.base - py, f = up <= 0 ? 1 : Math.max(0, 1 - up / (B.base * 0.3)), k = amt + (1 - amt) * fog * f * f;
    if (k < 0.01) continue;
    for (let px = 0; px < B.w; px++) { const i = py * B.w + px, c = B.c[i]; if (c < 0 || B.m[i] === 3) continue; B.c[i] = rdsMixI(c, hz, k); }
  }
}
const RDS_FOG = [0.25, 0.3, 0.6, 0.35, 0.3, 0.3];
const RDS_HAZEK = [1, 1, 0.85, 0.6, 0.45, 0.85]; // 各地区远景的朦胧程度（雪山、冷却塔要看得清）
function rdsBuildLayer(bi, k) {
  const fns = [rdsDesert, rdsRuin, rdsForest, rdsRad, rdsSnow, rdsAlien], hz = rdsC(RD_BIOMES[bi].sky[1]);
  const o1 = rdsC(RDC_PAL.out), o2 = rdsC(RDC_PAL.out2), L = RDS_LAYERS[k], B = rdsPaper(L.h), s = bi * 97 + k * 13 + 5;
  fns[bi](B, k, s);
  if (k > 0) rdsOutline(B, k === 1 ? rdsMixI(o1, hz, 0.35) : o1, k === 1 ? rdsMixI(o2, hz, 0.35) : o2);
  rdsHaze(B, hz, L.haze * (k < 2 ? RDS_HAZEK[bi] : 1), RDS_FOG[bi] * (k === 2 ? 0.5 : 1));
  return { cv: rdsToCanvas(B), lights: B.lights, base: B.base };
}
let RDS_PEND = null; // 正在提前画的下一个地区（每帧画一层，避免进新地区时卡一下）
function rdsGetBiome(bi) {
  if (!RDS_CACHE[bi]) {
    const done = RDS_PEND && RDS_PEND.bi === bi ? RDS_PEND.layers : [];
    for (let k = done.length; k < 3; k++) done.push(rdsBuildLayer(bi, k));
    RDS_CACHE[bi] = done; if (RDS_PEND && RDS_PEND.bi === bi) RDS_PEND = null;
  }
  return RDS_CACHE[bi];
}
function rdsPrebuild(bi) {
  if (RDS_CACHE[bi]) return;
  if (!RDS_PEND || RDS_PEND.bi !== bi) RDS_PEND = { bi, layers: [] };
  if (RDS_PEND.layers.length < 3) RDS_PEND.layers.push(rdsBuildLayer(bi, RDS_PEND.layers.length));
  if (RDS_PEND.layers.length === 3) { RDS_CACHE[bi] = RDS_PEND.layers; RDS_PEND = null; }
}

// ---------- 每帧：贴图 + 昼夜调色 + 灯点 ----------
function rdsBlit(sg, L, sc, baseY, a, lit, cw) {
  if (a <= 0.003) return;
  const off = ((Math.round(sc * RD_Q) % RDS_TW) + RDS_TW) % RDS_TW, top = baseY - L.base;
  sg.globalAlpha = a;
  for (let x = -off; x < cw; x += RDS_TW) {
    sg.drawImage(L.cv, x, top);
    for (const l of L.lights) { const lx = x + l.x; if (lx < -20 || lx > cw + 20) continue; lit.push({ x: lx / RD_Q, y: (baseY + l.y) / RD_Q, kind: l.kind, col: l.col, r: l.r, ph: l.ph, a, a2: 0 }); }
  }
  sg.globalAlpha = 1;
}
// bi 当前地区，pi 上一个地区，blend 上一个地区还剩多少（刚进新地区时两边渐变）
function rdsDrawScenery(g, bi, pi, blend, scroll, gy, day, dusk) {
  const V = RDV, cw = V.buf.width, ch = V.buf.height;
  if (!cw || !ch) return;
  if (!V.sc || V.sc.width !== cw || V.sc.height !== ch) { V.sc = createCanvas(cw, ch); V.scg = V.sc.getContext('2d'); }
  const sg = V.scg, baseY = (gy - 13) * RD_Q;
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.imageSmoothingEnabled = false; sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
  sg.clearRect(0, 0, cw, ch);
  const cur = rdsGetBiome(bi), prev = blend > 0.003 ? rdsGetBiome(pi) : null, lit = [];
  // 快到下一个地区时提前画好；其余地区的图扔掉省内存
  const nb = (bi + 1) % RD_BIOMES.length, into = (G.road.km % RD_BIOME_LEN) / RD_BIOME_LEN;
  if (into > 0.9) { if (!RDS_CACHE[nb]) rdsPrebuild(nb); else rdtPrebuild(nb); }
  const keep = (key) => +key === bi || +key === pi || (into > 0.9 && +key === nb);
  for (const key in RDS_CACHE) if (!keep(key)) delete RDS_CACHE[key];
  for (const key in RDT_CACHE) if (!keep(key)) delete RDT_CACHE[key];
  for (let k = 0; k < 3; k++) {
    if (prev) rdsBlit(sg, prev[k], scroll * RDS_LAYERS[k].par, baseY, blend, lit, cw);
    rdsBlit(sg, cur[k], scroll * RDS_LAYERS[k].par, baseY, prev ? 1 - blend : 1, lit, cw);
  }
  // 近景（电线杆、广告牌）和路面（见 js/roadstreet.js）
  const T = rdtGet(bi), TP = prev ? rdtGet(pi) : null;
  if (TP) rdsBlit(sg, TP.near, scroll * 0.6, baseY, blend, lit, cw);
  rdsBlit(sg, T.near, scroll * 0.6, baseY, TP ? 1 - blend : 1, lit, cw);
  rdbDrawSites(sg, gy, lit); // 路边建筑（js/roadsites.js），在护栏后面
  rdsBlit(sg, T.street, scroll, gy * RD_Q, 1, lit, cw);
  if (TP) rdsBlit(sg, TP.street, scroll, gy * RD_Q, blend, lit, cw);
  RDT_TONE = { day, dusk };
  // 昼夜：夜里整体压暗偏蓝；黄昏 / 清晨蒙一层橙红
  sg.globalCompositeOperation = 'source-atop';
  const dk = (1 - day) * 0.66;
  if (dk > 0.01) { sg.fillStyle = 'rgba(14,16,36,' + dk.toFixed(3) + ')'; sg.fillRect(0, 0, cw, ch); }
  if (dusk > 0.02) { sg.fillStyle = 'rgba(236,112,72,' + (dusk * 0.24).toFixed(3) + ')'; sg.fillRect(0, 0, cw, ch); }
  sg.globalCompositeOperation = 'source-over';
  g.drawImage(V.sc, 0, 0, V.W, V.H);
  rdsDrawLights(g, lit, day);
  RDS_LIT = lit;
}
// 圆形柔光贴图（按颜色缓存）：夜里的灯晕、在黑幕上挖亮点
const RDS_GLOW = {};
function rdsGlow(col) {
  if (RDS_GLOW[col]) return RDS_GLOW[col];
  // 先画实色，再用中间实、四周透明的蒙版抠成圆形柔光
  const m = createCanvas(32, 32), mc = m.getContext('2d'), mg = mc.createRadialGradient(16, 16, 0, 16, 16, 16);
  mg.addColorStop(0, 'rgba(0,0,0,1)'); mg.addColorStop(0.3, 'rgba(0,0,0,0.6)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  mc.fillStyle = col; mc.fillRect(0, 0, 32, 32); mc.globalCompositeOperation = 'destination-in'; mc.fillStyle = mg; mc.fillRect(0, 0, 32, 32);
  return (RDS_GLOW[col] = m);
}
function rdsDrawLights(g, lit, day) {
  const t = G.time, q = 1 / RD_Q;
  for (const l of lit) {
    let a = l.a;
    if (l.kind === 'win') a *= (1 - day) * (l.ph > 5.2 ? 0.7 + 0.3 * Math.sin(t * 9 + l.ph) * Math.sin(t * 3.7) : 0.9);
    else if (l.kind === 'blink') a *= ((t * 0.8 + l.ph) % 2) < 0.35 ? 1 : 0.1;
    else if (l.kind === 'bubble') { const p = (t * 0.6 + l.ph) % 1; a *= (1 - p) * 0.9; l.y -= p * 4 * q * 3; }
    else if (l.kind === 'neon') a *= (Math.sin(t * 23 + l.ph) > -0.9 && Math.sin(t * 1.3 + l.ph * 3) > -0.8 ? 1 : 0.12) * (0.15 + (1 - day) * 0.85);
    else a *= 0.5 + 0.3 * Math.sin(t * 1.6 + l.ph) + (1 - day) * 0.2;
    if (a < 0.03) continue;
    l.a2 = a;
    const r = l.r * q;
    g.fillStyle = l.col;
    if (l.kind !== 'bubble') { g.globalAlpha = Math.min(1, a * (0.25 + (1 - day) * 0.45)); const R2 = Math.min(10, r * 3); g.drawImage(rdsGlow(l.col), l.x - R2, l.y - R2, R2 * 2, R2 * 2); }
    g.globalAlpha = Math.min(1, a * 1.2); g.fillRect(l.x - q, l.y - q, 2 * q, 2 * q);
  }
  g.globalAlpha = 1;
}
