// =============================================
//  公路求生：程序化像素特效（参考 Pixel Composer 的做法）
//  思路：像「着色器」一样逐像素算出每一帧（噪声 + 距离 + 角度），
//        只用少量分档颜色（色带），档与档之间用 4×4 抖动点过渡，不用任何模糊/渐变，
//        算好的帧缓存成小画布，之后只按最近邻贴图 → 边缘永远是锐利的像素。
//  包含：噪声溶解火球爆炸、黑洞吸积盘（重力奇点）、像素闪电 + 空间碎裂、
//        岩浆裂谷地面（炮弹落地留下）、火焰龙卷风（怪物着火）、阶梯光晕
//  名字统一用 rdpx / RDPX_ 前缀
// =============================================

const RDPX_CACHE = {};
const RDPX_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// 尺寸档：同样大小的特效共用一套缓存帧
const RDPX_SIZES = [8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128];
// 色带（0 = 最亮）
const RDPX_FIRE = ['#ffffff', '#fff8d8', '#ffd860', '#f08a30', '#c03a1c', '#6a2a28', '#5a4a44', '#3a3438'];
const RDPX_PLASMA = ['#ffffff', '#f0c8ff', '#e0a8ff', '#c27bd6', '#7a3aa0', '#4a2a70', '#3a2050', '#24163a'];
const RDPX_HOLE = ['#ffffff', '#ffe8c0', '#e0a8ff', '#9a60d0', '#5a3290', '#2a1848', '#08040e'];
const RDPX_LAVA = ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c', '#7a2020', '#3a2626', '#2a2022', '#463a38'];

function rdpxBayer(x, y) { return (RDPX_BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
function rdpxH2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function rdpxN2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = rdpxH2(xi, yi), b = rdpxH2(xi + 1, yi), c = rdpxH2(xi, yi + 1), d = rdpxH2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function rdpxFbm(x, y) { return rdpxN2(x, y) * 0.55 + rdpxN2(x * 2.1 + 5.3, y * 2.1 - 1.7) * 0.3 + rdpxN2(x * 4.3 - 2.9, y * 4.3 + 9.1) * 0.15; }
// 连续值 0..1 → 色带序号（带抖动过渡），v 越大越亮
function rdpxRamp(v, n, px, py, dith) { const k = Math.floor((1 - v) * n + (rdpxBayer(px, py) - 0.5) * (dith == null ? 0.9 : dith)); return k < 0 ? 0 : k >= n ? n - 1 : k; }
function rdpxSize(d) { for (const s of RDPX_SIZES) if (s >= d) return s; return RDPX_SIZES[RDPX_SIZES.length - 1]; }
// 想画 d 个精细像素宽：返回 [缓存尺寸, 每个缓存像素放大几倍]（太大时用 2×/3× 粗像素，仍然锐利）
function rdpxPick(d) { const k = Math.max(1, Math.ceil(d / 128)); return [rdpxSize(Math.max(4, Math.round(d / k))), k]; }

// 「CPU 着色器」：逐像素调用 fn(u, v, t, px, py)，u/v ∈ [-1,1]，t ∈ [0,1)；返回色带序号，-1 = 透明
function rdpxBake(key, W, H, n, ramp, fn) {
  if (RDPX_CACHE[key]) return RDPX_CACHE[key];
  const cols = ramp.map((c) => parseInt(c.slice(1), 16)), out = [];
  for (let f = 0; f < n; f++) {
    const cv = createCanvas(W, H), cx = cv.getContext('2d'), img = cx.createImageData(W, H), d = img.data;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const k = fn((px + 0.5) / W * 2 - 1, (py + 0.5) / H * 2 - 1, f / n, px, py);
      if (k == null || k < 0) continue;
      const col = cols[Math.min(cols.length - 1, k)], i = (py * W + px) * 4;
      d[i] = col >> 16; d[i + 1] = (col >> 8) & 255; d[i + 2] = col & 255; d[i + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    out.push(cv);
  }
  return (RDPX_CACHE[key] = out);
}
// 把缓存帧按精细像素网格对齐贴上去（cx, cy 是中心，世界坐标）
function rdpxBlit(g, cv, cx, cy, k, ay) {
  const Q = RD_Q, w = cv.width * k, h = cv.height * k;
  g.drawImage(cv, Math.round(cx * Q - w / 2) / Q, Math.round(cy * Q - h * (ay == null ? 0.5 : ay)) / Q, w / Q, h / Q);
}

// ---------- 阶梯光晕：三圈实色 + 抖动点，代替模糊的径向渐变 ----------
function rdpxHalo(col, D) {
  return rdpxBake('halo' + col + D, D, D, 1, [col], (u, v, t, px, py) => {
    const r = Math.hypot(u, v), b = rdpxBayer(px, py);
    if (r < 0.32) return 0;
    if (r < 0.62) return b < 0.5 ? 0 : -1;
    if (r < 0.95) return b < 0.19 ? 0 : -1;
    return -1;
  })[0];
}
function rdpxGlow(g, col, x, y, rw, a) {
  const [D, k] = rdpxPick(rw * 2 * RD_Q);
  const old = g.globalAlpha; g.globalAlpha = old * (a == null ? 1 : a);
  rdpxBlit(g, rdpxHalo(col, D), x, y, k); g.globalAlpha = old;
}

// ---------- 噪声溶解火球（爆炸 / 喷火团）：火球膨胀 → 由内向外冷却 → 噪声把边缘咬碎成烟 ----------
const RDPX_BOOM_N = 10;
function rdpxBoomSheet(D, pal, ring) {
  const ramp = pal === 'plasma' ? RDPX_PLASMA : RDPX_FIRE, N = ramp.length;
  return rdpxBake('boom' + pal + D + (ring ? 'r' : ''), D, D, RDPX_BOOM_N, ramp, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), r = Math.hypot(u, v);
    // 冲击波环：前 45% 时间里一圈稀疏的亮点向外扩
    if (ring && t < 0.45) { const rs = 0.28 + t * 1.6; if (Math.abs(r - rs) < 0.03 + 0.03 * (1 - t) && b < 0.85 - t * 1.4) return t < 0.2 ? 0 : 2; }
    const vv = v + t * 0.28, rr = Math.hypot(u, vv); // 整团往上飘
    const n = rdpxFbm(u * 2.4 + 3.1, vv * 2.4 - t * 2.6 + 7.7);
    const R0 = 0.3 + 0.58 * (1 - Math.pow(1 - t, 3)), edge = R0 * (0.7 + 0.55 * n);
    if (rr > edge) return -1;
    if (n < t * 1.15 - 0.3 + (rr / edge) * 0.25 * t) return -1; // 溶解：后期从噪声低的地方开洞
    let heat = (1 - rr / edge) * 0.85 + (n - 0.5) * 0.6 + 0.42 - t * 1.25;
    let k = rdpxRamp(Math.max(0, Math.min(1, heat)), N, px, py);
    if (rr > edge * 0.86 && k < N - 1) k++; // 外缘压暗一档：像素画常见的描边感
    return k;
  });
}
function rdpxDrawBoom(g, f, gy) {
  const a = Math.max(0, f.life / f.max), p = 1 - a, x = rdSX(f.x), y = gy + f.y, pl = f.kind === 'plasmaboom';
  const [D, k] = rdpxPick(f.r * 2.2 * RD_Q), fr = rdpxBoomSheet(D, pl ? 'plasma' : 'fire', true);
  rdpxBlit(g, fr[Math.min(RDPX_BOOM_N - 1, Math.floor(p * RDPX_BOOM_N))], x, y, k);
  // 飞溅的火星：沿抛物线飞，颜色随时间冷却
  const ramp = pl ? RDPX_PLASMA : RDPX_FIRE, q = 1 / RD_Q, n = Math.min(14, 6 + Math.floor(f.r / 4));
  for (let i = 0; i < n; i++) {
    const h = rdpxH2(f.x * 0.37 + i, i * 1.7), an = h * 6.283, sp = f.r * (0.7 + rdpxH2(i, f.x) * 1.1);
    const ex = x + Math.cos(an) * sp * p * 1.4, ey = y + Math.sin(an) * sp * p * 0.9 - sp * p + 30 * p * p;
    if (p > 0.15 + rdpxH2(i * 3, f.x) * 0.8) continue;
    g.fillStyle = ramp[Math.min(5, 1 + Math.floor(p * 6))];
    g.fillRect(Math.round(ex * RD_Q) * q, Math.round(ey * RD_Q) * q, 2 * q, 2 * q);
  }
}

// ---------- 黑洞：倾斜的吸积盘（对数螺旋带）+ 黑色核心 + 光子环 + 上方的透镜光弧 ----------
const RDPX_HOLE_N = 12;
function rdpxHoleSheet(D) {
  const N = 6;
  return rdpxBake('hole' + D, D, D, RDPX_HOLE_N, RDPX_HOLE, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), r = Math.hypot(u, v), core = 0.25, tilt = 0.36, dv = v / tilt, rd = Math.hypot(u, dv);
    let disk = -1;
    if (rd > 0.3 && rd < 0.98) {
      const ang = Math.atan2(dv, u), sw = ang + Math.log(rd) * 3.4 - t * 6.2832;
      const band = 0.5 + 0.5 * Math.sin(sw * 3), nz = rdpxN2(Math.cos(sw) * 1.8 + 4, Math.sin(sw) * 1.8 + rd * 5);
      const fade = (rd - 0.3) / 0.68;
      if (!(fade > 0.72 && b < (fade - 0.72) / 0.28 * 1.1)) {
        const h = (1 - fade) * 0.95 + band * 0.3 + (nz - 0.5) * 0.5 - 0.08 + (u < 0 ? 0.08 : -0.05); // 左边迎面而来更亮（多普勒）
        disk = rdpxRamp(Math.max(0, Math.min(1, h)), N, px, py);
      }
    }
    const front = v > 0.015; // 下半个盘在核心前面
    if (r < core) {
      if (disk >= 0 && front) return disk;
      return r > core - 0.06 ? (b < 0.7 ? 1 : 0) : 6; // 光子环 / 纯黑核心
    }
    if (v < 0 && r < core + 0.11 && disk < 0) return b < 0.55 - (r - core) * 4 ? 2 : -1; // 背面的盘被引力弯到核心上方
    return disk;
  });
}
function rdpxDrawHole(g, x, y, Dw, t) {
  const [D, k] = rdpxPick(Dw * RD_Q), fr = rdpxHoleSheet(D);
  rdpxBlit(g, fr[Math.floor(((t % 1) + 1) % 1 * RDPX_HOLE_N)], x, y, k);
}
function rdpxDrawGravBoom(g, f, gy) {
  const a = Math.max(0, f.life / f.max), p = 1 - a, x = rdSX(f.x), y = gy + f.y;
  const s = p < 0.2 ? 0.35 + p / 0.2 * 0.65 : 1 - (p - 0.2) / 0.8 * 0.8; // 先张开再塌缩
  rdpxDrawHole(g, x, y, f.r * 2.1 * s, G.time * 1.6);
  // 被吸进去的碎片：沿椭圆螺旋往里掉
  const q = 1 / RD_Q;
  for (let i = 0; i < 14; i++) {
    const ph = (G.time * 1.8 + i / 14) % 1, rr = f.r * 1.3 * (1 - ph) * s, an = i * 2.4 + ph * 9;
    g.fillStyle = RDPX_HOLE[1 + (i % 3)];
    g.fillRect(Math.round((x + Math.cos(an) * rr) * RD_Q) * q, Math.round((y + Math.sin(an) * rr * 0.4) * RD_Q) * q, 2 * q, q);
  }
}

// ---------- 像素线：按精细像素一格一格画（不用 stroke，避免抗锯齿糊边） ----------
function rdpxLine(g, x1, y1, x2, y2, th) {
  const Q = RD_Q, q = 1 / Q, ax = Math.round(x1 * Q), ay = Math.round(y1 * Q), bx = Math.round(x2 * Q), by = Math.round(y2 * Q);
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1), o = (th - 1) >> 1;
  for (let i = 0; i <= n; i++) { const px = Math.round(ax + (bx - ax) * i / n), py = Math.round(ay + (by - ay) * i / n); g.fillRect((px - o) * q, (py - o) * q, th * q, th * q); }
}
// 折线闪电：中点位移法生成，带 1~2 条分叉
function rdpxBoltPts(x1, y1, x2, y2, rough, depth) {
  let pts = [[x1, y1], [x2, y2]];
  for (let d = 0; d < depth; d++) {
    const nx = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay) || 1;
      const off = (Math.random() - 0.5) * L * rough;
      nx.push([(ax + bx) / 2 - (by - ay) / L * off, (ay + by) / 2 + (bx - ax) / L * off], pts[i]);
    }
    pts = nx;
  }
  return pts;
}
function rdpxBolt(g, x1, y1, x2, y2, outer, core, a) {
  const pts = rdpxBoltPts(x1, y1, x2, y2, 0.55, 4), br = [];
  for (let k = 0; k < 2; k++) { const i = 3 + Math.floor(Math.random() * (pts.length - 6)), [bx, by] = pts[i], an = Math.atan2(y2 - y1, x2 - x1) + (Math.random() - 0.5) * 2.2, L = Math.hypot(x2 - x1, y2 - y1) * (0.15 + Math.random() * 0.2); br.push(rdpxBoltPts(bx, by, bx + Math.cos(an) * L, by + Math.sin(an) * L, 0.6, 2)); }
  const old = g.globalAlpha;
  g.globalAlpha = old * a * 0.55; g.fillStyle = outer;
  for (let i = 1; i < pts.length; i++) rdpxLine(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 3);
  for (const b of br) for (let i = 1; i < b.length; i++) rdpxLine(g, b[i - 1][0], b[i - 1][1], b[i][0], b[i][1], 2);
  g.globalAlpha = old * a; g.fillStyle = core;
  for (let i = 1; i < pts.length; i++) rdpxLine(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], 1);
  g.fillStyle = outer;
  for (const b of br) for (let i = 1; i < b.length; i++) rdpxLine(g, b[i - 1][0], b[i - 1][1], b[i][0], b[i][1], 1);
  g.globalAlpha = old;
}
// 空间碎裂：命中点向外裂开的锯齿裂纹 + 飞出的碎片（seed 固定，裂纹形状这次命中内不变）
function rdpxShatter(g, x, y, r, seed, p, outer, core) {
  const q = 1 / RD_Q, n = 6, old = g.globalAlpha, grow = Math.min(1, p * 3);
  for (let i = 0; i < n; i++) {
    let an = (i + rdpxH2(seed, i) * 0.7) / n * 6.283, cx = x, cy = y;
    const L = r * (0.5 + rdpxH2(i, seed) * 0.7) * grow;
    g.fillStyle = i % 2 ? outer : core;
    for (let s = 0; s < 3; s++) { an += (rdpxH2(seed + s, i * 3) - 0.5) * 0.9; const nx = cx + Math.cos(an) * L / 3, ny = cy + Math.sin(an) * L / 3 * 0.8; rdpxLine(g, cx, cy, nx, ny, 1); cx = nx; cy = ny; }
    // 碎片：两格大的亮块沿裂纹方向飞出
    const d = r * (0.4 + p * 1.6);
    g.globalAlpha = old * (1 - p);
    g.fillStyle = core; g.fillRect(Math.round((x + Math.cos(an) * d) * RD_Q) * q, Math.round((y + Math.sin(an) * d * 0.8 + p * p * 6) * RD_Q) * q, 2 * q, 2 * q);
    g.globalAlpha = old;
  }
  g.fillStyle = '#0e0816'; g.fillRect(Math.round(x * RD_Q - 1) * q, Math.round(y * RD_Q - 1) * q, 3 * q, 3 * q); // 裂开的「洞」
}

// ---------- 岩浆裂谷：炮弹落地后的地面贴花（Voronoi 裂纹里流着岩浆，几秒内冷却） ----------
const RDPX_RIFT_N = 6;
function rdpxRiftSheet(W) {
  const H = Math.max(4, Math.round(W * 0.2)), N = 5;
  return rdpxBake('rift' + W, W, H, RDPX_RIFT_N, RDPX_LAVA, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), e = u * u + v * v, rim = rdpxN2(u * 4 + 9, v * 2 + 3);
    if (e > 0.62 + rim * 0.38) return -1;
    if (e > 0.55 + rim * 0.3) return b < 0.45 ? 7 : -1; // 外圈焦土：稀疏抖动
    // Voronoi：离最近两个点的距离差小 = 在裂缝上
    const X = u * 4.2, Y = v * 1.5; let f1 = 9, f2 = 9;
    const xi = Math.floor(X), yi = Math.floor(Y);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = xi + i + rdpxH2(xi + i, yi + j), cy = yi + j + rdpxH2(yi + j + 31, xi + i + 17), d = Math.hypot(X - cx, Y - cy);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    const gap = f2 - f1, heat = 1 - t, wide = 0.07 + 0.13 * (1 - e) * heat;
    if (gap < wide) return rdpxRamp(Math.max(0, Math.min(1, (1 - gap / wide) * 0.5 + heat * 0.75 - e * 0.35)), N, px, py, 0.7);
    if (gap < wide + 0.08 && heat > 0.35) return b < heat * 0.7 ? 4 : 5; // 裂缝边上被烤红的地壳
    return (rdpxN2(X * 3, Y * 3) > 0.62) ? 7 : 6;
  });
}
function rdpxDrawRift(g, f, gy) {
  const a = Math.max(0, f.life / f.max), p = 1 - a, x = rdSX(f.x);
  const [D, k] = rdpxPick(f.r * 2.4 * RD_Q), fr = rdpxRiftSheet(D);
  const old = g.globalAlpha; g.globalAlpha = Math.min(1, a * 3.5);
  rdpxBlit(g, fr[Math.min(RDPX_RIFT_N - 1, Math.floor(p * 1.2 * RDPX_RIFT_N))], x, gy + 3.5, k);
  // 冒泡：刚落地时岩浆里偶尔鼓出一个亮点往上跳
  if (p < 0.5) { const q = 1 / RD_Q; for (let i = 0; i < 3; i++) { const ph = (G.time * 1.7 + rdpxH2(f.x, i)) % 1, bx = x + (rdpxH2(i, f.x) - 0.5) * f.r * 1.6; g.fillStyle = ph < 0.5 ? '#ffd860' : '#f08a30'; g.fillRect(Math.round(bx * RD_Q) * q, Math.round((gy + 3 - Math.sin(ph * Math.PI) * 3) * RD_Q) * q, 2 * q, 2 * q); } }
  g.globalAlpha = old;
}
// 炮弹落地：留下一块岩浆裂谷（js/modes/road.js 的 rdExplode、副本的火箭弹落点调用）
function rdpxRift(x, r) {
  const R = rdR(); R.fx = R.fx || [];
  if (R.fx.filter((f) => f.kind === 'rift').length >= 10) return;
  R.fx.push({ kind: 'rift', x, y: 0, r: Math.max(8, r), life: 3, max: 3 });
}

// ---------- 火焰龙卷风：着火的怪物身上卷起一股旋转的火柱 ----------
const RDPX_TOR_N = 12;
function rdpxTornadoSheet(W, H) {
  const N = 6;
  return rdpxBake('tor' + W + 'x' + H, W, H, RDPX_TOR_N, RDPX_FIRE, (u, v, t, px, py) => {
    const b = rdpxBayer(px, py), y01 = (v + 1) / 2, up = 1 - y01, T = t * 6.2832;
    const w = 0.16 + 0.8 * Math.pow(up, 1.15), cx = Math.sin(y01 * 5.5 - T) * 0.14 * up;
    const dx = (u - cx) / w;
    const nz = rdpxN2(y01 * 6 + Math.cos(T) * 1.3, Math.sin(T) * 1.3 + 4);
    if (Math.abs(dx) > 0.75 + nz * 0.35) { // 被甩出去的火星
      return (Math.abs(dx) < 1.35 && rdpxH2(px * 0.7 + Math.floor(t * 12), py) > 0.985) ? 2 : -1;
    }
    const ang = Math.asin(Math.max(-1, Math.min(1, dx))), s = ang + y01 * 8 - T * 2;
    const band = Math.sin(s * 2 + nz * 3);
    if (band < -0.3 && y01 < 0.92) return -1; // 螺旋缝隙：看起来是一股一股绞在一起
    const depth = Math.cos(ang);
    let heat = depth * 0.45 + (band + 1) * 0.15 + y01 * 0.3 - 0.22;
    let k = rdpxRamp(Math.max(0, Math.min(1, heat)), N, px, py) + 1;
    if (Math.abs(dx) > 0.66 && k < N) k++;
    return k;
  });
}
function rdpxDrawBurn(g, m, gy) {
  const M = RD_MONSTERS[m.type]; if (!M) return;
  const x = rdSX(m.x); if (x < -30 || x > RDV.W + 30) return;
  const base = gy + (M.fly ? m.y + M.h / 2 : 3), hot = Math.min(1, (m.burnDps || 4) / 12);
  const Ww = Math.max(7, M.w * (0.85 + hot * 0.45)), Hw = M.h * (1.0 + hot * 0.5);
  const W = Math.min(96, Math.round(Ww * RD_Q / 6) * 6), H = Math.min(160, Math.round(Hw * RD_Q / 6) * 6);
  const fr = rdpxTornadoSheet(W, H), old = g.globalAlpha;
  g.globalAlpha = Math.min(1, m.burn * 1.5) * 0.72;
  rdpxBlit(g, fr[Math.floor(((G.time * 14 + m.x * 0.1) % RDPX_TOR_N + RDPX_TOR_N) % RDPX_TOR_N)], x, base + 1, 1, 1);
  g.globalAlpha = old;
}

// ---------- 接入：rdgProj（js/roadguns.js）先问这里，返回 true 就不再走老画法 ----------
function rdpxProj(g, p, gy) {
  const x = rdSX(p.x), y = gy + p.y, k = p.kind, q = 1 / RD_Q;
  if (k === 'grav') { rdpxDrawHole(g, x, y, 15, G.time * 2); return true; }
  if (k === 'flame') {
    const life = (((G.time * 7 + p.x * 0.37) % 1) + 1) % 1, [D, s] = rdpxPick((3 + life * 6) * RD_Q);
    rdpxBlit(g, rdpxBoomSheet(D, 'fire', false)[Math.min(RDPX_BOOM_N - 1, Math.floor(life * 0.9 * RDPX_BOOM_N))], x, y - life * 2, s);
    return true;
  }
  if (k === 'bullet' || k === 'nail') { rdpxGlow(g, '#ffcd75', x, y, 1.7, 0.5); return false; } // 光晕换成阶梯版，弹体仍用老画法
  if (k === 'plasma') {
    rdpxGlow(g, '#c27bd6', x, y, 6, 0.55); rdpxGlow(g, '#e0a8ff', x, y, 3.2, 0.9);
    g.fillStyle = '#ffffff'; g.fillRect(Math.round(x * RD_Q - 2) * q, Math.round(y * RD_Q - 2) * q, 4 * q, 4 * q);
    if (Math.random() < 0.5) { g.fillStyle = '#f0c8ff'; rdpxLine(g, x, y, x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 1); } // 等离子团表面的小电弧
    const a = Math.atan2(p.vy || 0, p.vx || 1);
    for (let s = 1; s < 4; s++) { g.globalAlpha = 0.6 - s * 0.15; g.fillStyle = RDPX_PLASMA[2 + s]; g.fillRect(Math.round((x - Math.cos(a) * s * 2) * RD_Q - 2) * q, Math.round((y - Math.sin(a) * s * 2) * RD_Q - 2) * q, 4 * q, 4 * q); }
    g.globalAlpha = 1;
    return true;
  }
  return false;
}
function rdpxFx(g, f, gy) {
  const k = f.kind;
  if (k === 'boom' || k === 'plasmaboom') { rdpxDrawBoom(g, f, gy); return true; }
  if (k === 'gravboom') { rdpxDrawGravBoom(g, f, gy); return true; }
  if (k === 'rift') return true; // 地面贴花在 rdpxGround 里先画
  const a = Math.max(0, f.life / f.max), x = rdSX(f.x), y = gy + f.y;
  if (k === 'arc') {
    const x2 = rdSX(f.x2), y2 = gy + f.y2;
    rdpxBolt(g, x, y, x2, y2, '#73eff7', '#e8fcff', a);
    rdpxGlow(g, '#73eff7', x2, y2, 4, a * 0.8);
    rdpxShatter(g, x2, y2, 6, Math.floor(f.x2 * 7), 1 - a, '#73eff7', '#e8fcff');
    return true;
  }
  if (k === 'laser' || k === 'beam' || k === 'rail') {
    const x2 = rdSX(f.x2), y2 = gy + f.y2, col = k === 'laser' ? '#ff7a50' : k === 'beam' ? '#c27bd6' : '#73eff7';
    const wd = k === 'rail' ? 3 : k === 'beam' ? 2 : 1, old = g.globalAlpha;
    g.globalAlpha = a * 0.4; g.fillStyle = col; rdpxLine(g, x, y, x2, y2, wd * 2 + 3);
    g.globalAlpha = a; rdpxLine(g, x, y, x2, y2, wd * 2 + 1);
    g.fillStyle = '#ffffff'; rdpxLine(g, x, y, x2, y2, wd);
    rdpxGlow(g, col, x2, y2, 4, a);
    if (k !== 'laser') rdpxShatter(g, x2, y2, k === 'rail' ? 10 : 7, Math.floor(f.x * 13), 1 - a, col, '#ffffff');
    if (k === 'beam') { g.fillStyle = '#f0d8ff'; for (let s = 0; s < 6; s++) { const u = Math.random(); g.fillRect(Math.round((x + (x2 - x) * u) * RD_Q) / RD_Q, Math.round((y + (y2 - y) * u + (Math.random() - 0.5) * 4) * RD_Q) / RD_Q, 2 / RD_Q, 2 / RD_Q); } }
    g.globalAlpha = old;
    return true;
  }
  return false;
}
// 地面层（在怪物和车之前画）：岩浆裂谷
function rdpxGround(g, gy) {
  for (const f of G.road.fx || []) if (f.kind === 'rift') rdpxDrawRift(g, f, gy);
}
// 怪物身上的火焰龙卷风（在怪物之后画）
function rdpxOver(g, gy) {
  for (const m of G.road.mons || []) if (m.burn > 0 && m.hp > 0) rdpxDrawBurn(g, m, gy);
}
