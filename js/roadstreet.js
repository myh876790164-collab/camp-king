// =============================================
//  公路求生：路面、护栏、近景（电线杆 / 广告牌 / 路牌 / 路边废车）、前景杂物、路障（精细像素）
//  和 js/roadscape.js 一样：静态部分预先逐像素画成左右能无缝拼接的长条图缓存（每个地区一套），
//  每帧只贴图；会闪的灯、冒的烟、电火花每帧单独画。
//  图层：近景（视差 0.6）→ 路面 + 护栏（1.0，和车、怪物同速）→ 前景杂物（1.3，比路面快，有纵深感）
//  坐标：精细像素；y = 0 是路面中线附近的「地面线」gy，向下为正
// =============================================
const RDT_UP = 75, RDT_DOWN = 400;   // 路面长条图：gy 往上 75、往下 400 精细像素
const RDT_CACHE = {};                 // 地区编号 → { street, near, front }
const RDT_OBS = {};                   // 路障图片缓存
let RDT_TONE = { day: 1, dusk: 0 };   // 这一帧的昼夜（给路障调色用）
const RDT_WOOD = rdsR(['#a88866', '#82644a', '#604832', '#423022', '#2c2016']);
const RDT_RAIL = rdsR(['#e4e4d8', '#b8baae', '#8e9086', '#66685e', '#44463e']);
const RDT_RUST = rdsR(['#d08040', '#a85a2a', '#7a3a1c', '#4e2412']);
const RDT_LINE = ['#d8b860', '#d4ccb4', '#c4a456', '#c8c070', '#eef2f6', '#90d8e0'];

function rdtRamp(hex) { const c = rdsC(hex), w = 0xf4f0e4, d = 0x1e1a24; return [rdsMixI(c, w, 0.26), rdsMixI(c, w, 0.12), c, rdsMixI(c, d, 0.16), rdsMixI(c, d, 0.32), rdsMixI(c, d, 0.5)]; }
function rdtPaper(w, up, down) { return { w, h: up + down, base: up, c: new Int32Array(w * (up + down)).fill(-1), m: new Uint8Array(w * (up + down)), lights: [], ox: 0, oy: up }; }
// 左右循环的二维噪声：cx 必须能整除 RDS_TW（1536 的约数：16 24 32 48 64 96 128 192 256 384 512）
function rdtN2(x, y, cx, cy, s) {
  const per = RDS_TW / cx, u = rdsWrap(x) / cx, v = y / cy, xi = Math.floor(u), yi = Math.floor(v), fx = u - xi, fy = v - yi;
  const h = (i, j) => rdcHash(((i % per) + per) % per, j, s);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function rdtAt(B, y0, fn) { const b = B.base; B.base = b + Math.round(y0); fn(); B.base = b; } // 临时把「地面」挪到 y0 再画
function rdtGetPx(B, x, y) { const py = Math.round(y) + B.base; if (py < 0 || py >= B.h) return -1; return B.c[py * B.w + rdsWrap(Math.round(x))]; }
function rdtEllipse(B, cx, cy, rx, ry, fn) { for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) { const d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d <= 1) fn(Math.round(cx + x), Math.round(cy + y), d, x / rx, y / ry); } }
// 积雪：所有物体朝上的面盖一两层雪
function rdtSnowCap(B, rows) {
  const S = RDS_PAL[4].snow, snap = B.c.slice(), mm = B.m.slice();
  for (let py = 1; py < Math.min(B.h, rows || B.h); py++) for (let px = 0; px < B.w; px++) {
    const i = py * B.w + px; if (snap[i] < 0 || (mm[i] !== 1 && mm[i] !== 8)) continue;
    const up = snap[i - B.w];
    if (up < 0) { B.c[i] = rdcHash(px, py, 4) < 0.5 ? S[0] : S[1]; if (py + 1 < B.h && rdcHash(px, py, 5) < 0.6 && mm[i + B.w] === 1) B.c[i + B.w] = S[2]; }
  }
}
const RDT_MOSS = rdsR(['#9aa864', '#788a4a', '#5a6c38']);

// ================= 路面 + 护栏 =================
function rdtGround(x, y, bi, Gr, s, shoulder, rip, nz) {
  let v = 2 + ((nz != null ? nz : rdtN2(x, y, 48, 20, s + 6)) - 0.5) * 1.6 + (y < 60 ? (rdtN2(x, y, 16, 6, s + 7) - 0.5) * 0.6 : 0);
  const h = rdcHash(x, y, s + 8);
  if (h < 0.06) v += 0.8; else if (h > 0.95) v -= 0.8;
  if (shoulder) { v += 0.25; if (h > 0.55 && h < 0.75) v += ((x + y) & 1) ? 1.1 : -0.7; }
  if (y >= -31 && y < -27) v += 0.5;                     // 路沿后面一道阴影
  if (bi === 0 && (((y * 2 + rip + (x >> 3)) % 9) + 9) % 9 === 0) v -= 0.5; // 沙纹
  if (bi === 4 && h > 0.985) return 0xffffff;
  if (bi === 5 && h > 0.992) return 0x73eff7;
  if (bi === 2 && h > 0.97) return [0xb0683a, 0x8a5a2a, 0x6a7a3a][Math.floor(h * 1000) % 3];
  return rdsPick(Gr, v, x, y);
}
function rdtAsphalt(x, y, bi, A, s, t, bo, ally, zone) {
  let v = 2.1 + (rdtN2(x, y, 96, 16, s + 10) - 0.5) * 1.3;
  if (Math.abs(y + 17) < 4 || Math.abs(y - 9) < 4) v += 0.35; // 车轮压出的两道深色
  const h = rdcHash(x, y, s + 11);
  if (h < 0.09) v += 0.9; else if (h > 0.92) v -= 0.8;    // 石子颗粒
  if (y <= t + 1) v -= 0.9;                               // 路沿亮边
  if (y >= bo - 2) v += 0.9;                              // 路边碎裂的暗边
  const c1 = rdtN2(x, y, 64, 18, s + 12);
  if (Math.abs(c1 - 0.5) < 0.016 || (ally && Math.abs(rdtN2(x, y, 16, 8, s + 14) - 0.5) < 0.035)) { // 裂缝
    if ((bi === 3 || bi === 5) && zone > 0.62) return -3;  // 发光的裂缝
    if (bi === 2 && h < 0.45) return RDT_MOSS[1];
    if (bi === 4 && h < 0.5) return RDS_PAL[4].snow[2];
    if (bi === 0 && h < 0.4) return rdtRamp(RD_BIOMES[0].ground)[1];
    return A[5];
  }
  return rdsPick(A, v, x, y);
}
function rdtBuildStreet(bi) {
  const b = RD_BIOMES[bi], s = bi * 53 + 7, B = rdtPaper(RDS_TW, RDT_UP, RDT_DOWN);
  const Gr = rdtRamp(b.ground), A = rdtRamp(b.road), top = new Int16Array(RDS_TW), bot = new Int16Array(RDS_TW);
  // 远离路面的地上，大块明暗只需要粗略算（每 4×2 像素取一次），快很多
  const NG = new Float32Array(384 * 200);
  for (let j = 0; j < 200; j++) for (let k = 0; k < 384; k++) NG[j * 384 + k] = rdtN2(k * 4, j * 2, 48, 20, s + 6);
  const glow = bi === 3 ? RDS_PAL[3].tox : RDS_PAL[5].glow;
  for (let x = 0; x < RDS_TW; x++) {
    top[x] = -27 + Math.round((rdsN(x, 96, s) - 0.5) * 2);
    bot[x] = 20 + Math.round(rdsN(x, 128, s + 1) * 4);
    const rip = Math.round(rdtN2(x, 0, 64, 1, s) * 14), ally = rdtN2(x, 0, 192, 1, s + 13) > 0.68, zone = rdtN2(x, 0, 128, 1, s + 15);
    for (let y = -42; y < RDT_DOWN; y++) {
      const i = (y + B.base) * B.w + x;
      if (y < top[x] || y >= bot[x]) { B.c[i] = rdtGround(x, y, bi, Gr, s, y >= bot[x] && y < 39, rip, y >= 60 ? NG[Math.min(199, y >> 1) * 384 + (x >> 2)] : null); B.m[i] = 2; continue; }
      const c = rdtAsphalt(x, y, bi, A, s, top[x], bot[x], ally, zone);
      if (c === -3) { B.c[i] = glow; B.m[i] = 3; } else { B.c[i] = c; B.m[i] = 2; }
    }
    if ((bi === 3 || bi === 5) && x % 48 === 0 && rdtN2(x, 0, 128, 1, s + 15) > 0.66) rdsLight(B, x, -4, 'glow', bi === 3 ? '#a7f070' : '#73eff7', 4);
  }
  rdtRoadDecor(B, bi, A, Gr, s, top, bot);
  rdtGuardrail(B, bi, s, top);
  rdtGroundBits(B, bi, Gr, s);
  rdsOutline(B, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2), B.base - 27);
  if (bi === 4) rdtSnowCap(B, B.base - 26);
  return { cv: rdsToCanvas(B), lights: B.lights, base: B.base };
}
function rdtRoadDecor(B, bi, A, Gr, s, top, bot) {
  const R = (k) => rdsRand(s + 40, k);
  // 补过的路面（颜色深一点、平一点，四边一圈接缝）
  for (let i = 0; i < 6; i++) {
    const x0 = Math.round(R(i) * RDS_TW), w = 40 + Math.round(R(i + 10) * 90), y0 = -22 + Math.round(R(i + 20) * 30), h = 8 + Math.round(R(i + 30) * 14);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1; rdsPx(B, x0 + x, y0 + y, edge ? A[4] : rdsPick(A, 3 + (rdcHash(x0 + x, y, s) < 0.06 ? 0.8 : 0), x0 + x, y0 + y), 2); }
  }
  // 刹车印
  for (let i = 0; i < 3; i++) { const x0 = R(40 + i) * RDS_TW, L = 90 + R(43 + i) * 130, y0 = -18 + R(46 + i) * 26; for (let k = 0; k < L; k++) { const y = Math.round(y0 + Math.sin(k / L * 2.2) * 5); if (rdcHash(x0 + k, i, s) < 0.75) { rdsPx(B, x0 + k, y, A[5], 2); rdsPx(B, x0 + k, y + 7, A[5], 2); } } }
  // 油渍（边上偶尔一点彩色反光）
  for (let i = 0; i < 6; i++) rdtEllipse(B, R(50 + i) * RDS_TW, -18 + R(56 + i) * 30, 4 + R(62 + i) * 6, 2 + R(68 + i) * 2, (x, y, d) => rdsPx(B, x, y, d > 0.6 && rdcHash(x, y, s) < 0.15 ? [0x6a5a8a, 0x4a7a7a][(x + y) & 1] : (d < 0.5 ? A[5] : A[4]), 2));
  // 中线（褪色的虚线，有的快磨没了）
  const LC = rdtRamp(RDT_LINE[bi]);
  for (let x = 0; x < RDS_TW; x++) {
    if (x % 96 >= 30) continue;
    const fade = rdsRand(s + 41, Math.floor(x / 96)) < 0.22 ? 0.75 : 0.22;
    for (let y = -3; y <= -1; y++) if (rdcHash(x, y, s + 3) > fade) rdsPx(B, x, y, rdsPick(LC, 0.5 + (y === -1 ? 1 : 0) + (rdcHash(x, y, s + 4) < 0.15 ? 1 : 0), x, y), 2);
  }
  // 路边白线（断断续续）
  const WC = rdtRamp('#d4d0c2');
  for (let x = 0; x < RDS_TW; x++) {
    if (rdtN2(x, 0, 64, 1, s + 5) < 0.72) for (const y of [top[x] + 3, top[x] + 4]) if (rdcHash(x, y, s + 6) > 0.25) rdsPx(B, x, y, rdsPick(WC, 1 + (rdcHash(x, y, s) < 0.2 ? 1 : 0), x, y), 2);
    if (rdtN2(x, 0, 64, 1, s + 7) < 0.6) for (const y of [bot[x] - 5, bot[x] - 4]) if (rdcHash(x, y, s + 8) > 0.3) rdsPx(B, x, y, rdsPick(WC, 1.4, x, y), 2);
  }
  // 坑洼（里面积着水 / 沙 / 冰 / 毒水）
  const pool = [Gr.slice(0, 3), rdsR(['#8a9aa0', '#5a6a72', '#3e4a52']), rdsR(['#7a6a4a', '#5a4c36', '#3e3426']), null, rdsR(['#f0fcff', '#c4e8f4', '#94c4dc']), null][bi];
  for (let i = 0; i < 5; i++) {
    const cx = R(80 + i) * RDS_TW, cy = -20 + R(85 + i) * 32, rx = 6 + R(90 + i) * 9, ry = 2.2 + R(95 + i) * 2;
    rdtEllipse(B, cx, cy, rx, ry, (x, y, d, nx, ny) => {
      if (d > 0.62) rdsPx(B, x, y, ny < 0 ? A[5] : A[0], 2);       // 坑沿：上暗下亮
      else if (!pool) rdsPx(B, x, y, bi === 3 ? (ny < -0.3 ? RDS_PAL[3].tox2 : RDS_PAL[3].tox) : (ny < -0.3 ? 0xe0a0ff : 0xa060e0), 3);
      else rdsPx(B, x, y, rdsPick(pool, (ny + 0.6) * 1.5 + (rdcHash(x, y, s) < 0.1 ? -1 : 0), x, y), 2);
    });
    if (!pool) rdsLight(B, cx, cy, 'glow', bi === 3 ? '#a7f070' : '#d080ff', Math.round(rx / 2));
  }
  // ---- 各地区特色 ----
  if (bi === 0 || bi === 4) { // 沙 / 雪从两边漫到路上
    const D = bi === 0 ? Gr : RDS_PAL[4].snow;
    for (let x = 0; x < RDS_TW; x++) {
      const st = Math.max(0, rdtN2(x, 0, 64, 1, s + 20) - 0.45) * (bi === 0 ? 26 : 30), sb = Math.max(0, rdtN2(x, 0, 96, 1, s + 21) - 0.5) * (bi === 0 ? 22 : 30);
      for (let y = top[x]; y < top[x] + st; y++) if (y < top[x] + st - 1 || rdcHash(x, y, s) < 0.5) rdsPx(B, x, y, rdsPick(D, bi === 0 ? 1 + ((x + y * 3) % 11 === 0 ? 1 : 0) : (y - top[x]) / 30, x, y), 2);
      for (let y = Math.floor(bot[x] - sb); y < bot[x]; y++) if (y > bot[x] - sb + 1 || rdcHash(x, y, s + 1) < 0.5) rdsPx(B, x, y, rdsPick(D, bi === 0 ? 1.2 : 0.8, x, y), 2);
    }
  }
  if (bi === 4) { // 车辙里压实的雪、结冰的路面
    for (let x = 0; x < RDS_TW; x++) for (const yy of [-17, 9]) for (let y = yy - 3; y <= yy + 3; y++) if (rdcHash(x, y, s + 22) < 0.22) rdsPx(B, x, y, RDS_PAL[4].snow[2], 2);
    for (let i = 0; i < 5; i++) rdtEllipse(B, R(100 + i) * RDS_TW, -12 + R(105 + i) * 22, 18 + R(110 + i) * 26, 4 + R(115 + i) * 3, (x, y, d, nx, ny) => rdsPx(B, x, y, ((x - y * 2) % 13 === 0 && d < 0.7) ? 0xffffff : rdsPick(RDS_PAL[4].ice, 1.2 + ny + d, x, y), 2));
  }
  if (bi === 1) { // 水泥路的伸缩缝、井盖、碎块
    for (let x = 0; x < RDS_TW; x += 128) for (let y = top[x] + 1; y < bot[x] - 1; y++) { rdsPx(B, x, y, A[5], 2); rdsPx(B, x + 1, y, A[0], 2); }
    for (let i = 0; i < 2; i++) { const cx = R(120 + i) * RDS_TW, cy = -10 + R(122 + i) * 18; rdtEllipse(B, cx, cy, 10, 3.2, (x, y, d, nx) => rdsPx(B, x, y, d > 0.7 ? A[5] : (((x - Math.round(cx)) % 3 === 0) ? 0x3a3c40 : rdsPick(rdtRamp('#6a6c70'), 1 + nx, x, y)), 2)); }
    for (let i = 0; i < 40; i++) { const x = R(130 + i) * RDS_TW, y = -24 + R(180 + i) * 44, w = 1 + Math.round(R(230 + i) * 3); rdsRect(B, x, y, w, 1, rdsC('#a49a88'), 2); rdsRect(B, x, y + 1, w, 1, rdsC('#645a4e'), 2); }
  }
  if (bi === 2) { // 落叶，路边多
    for (let i = 0; i < 700; i++) { const x = R(300 + i) * RDS_TW, e = R(1000 + i), y = e < 0.5 ? -27 + Math.pow(R(1700 + i), 2) * 22 : 20 - Math.pow(R(1700 + i), 2) * 22; rdsRect(B, x, y, 2, 1, [0xb0683a, 0x8a5a2a, 0xc09040, 0x6a7a3a][i % 4], 2); }
  }
  if (bi === 3) { // 一片片发绿的污渍
    for (let i = 0; i < 5; i++) rdtEllipse(B, R(140 + i) * RDS_TW, -16 + R(145 + i) * 26, 20 + R(150 + i) * 30, 4 + R(155 + i) * 4, (x, y, d) => { const c = rdtGetPx(B, x, y); if (c >= 0 && rdcHash(x, y, s) > d * 0.8) rdsPx(B, x, y, rdsMixI(c, RDS_PAL[3].tox, 0.18), 2); });
  }
  if (bi === 5) { // 路边长出来的小水晶
    for (let i = 0; i < 22; i++) { const x = R(160 + i) * RDS_TW, up = i % 2 === 0, y = up ? -26 : 20; rdsCrystal(B, x, y, 6 + R(190 + i) * 10, -Math.PI / 2 + (R(210 + i) - 0.5) * 0.9, 3 + R(220 + i) * 2, R(240 + i) > 0.75 ? RDS_PAL[5].pink : RDS_PAL[5].cry, s + i); }
  }
}
// 护栏：波形钢板（三道起伏的明暗）+ 立柱 + 螺栓 + 琥珀色反光片；有撞瘪的、有缺一段的
function rdtGuardrail(B, bi, s, top) {
  const PR = bi === 2 ? RDT_WOOD : RDT_RAIL, prof = [1.2, 0.3, 0.1, 1, 2, 3, 2.2, 1, 0.3, 1.1, 2.2, 3.6];
  const sec = (x) => rdsRand(s + 30, Math.floor(rdsWrap(x) / 96));
  const jersey = (x) => bi === 1 && rdtN2(x, 0, 384, 1, s + 31) > 0.5;
  // 立柱
  for (let x = 0; x < RDS_TW; x++) {
    if (jersey(x)) continue;
    const pp = x % 48, hs = sec(x);
    if (pp < 4 && hs > 0.05) for (let y = -58; y < -30; y++) rdsPx(B, x, y, rdsPick(PR, [0.4, 1.2, 2.2, 3.4][pp] + (rdcHash(x, y, s) < 0.08 ? 0.7 : 0), x, y), 1);
  }
  // 板
  for (let x = 0; x < RDS_TW; x++) {
    if (jersey(x)) {
      const bx = x % 90; if (bx < 2) continue;
      const blk = Math.floor(x / 90), stripe = rdsRand(s + 32, blk) > 0.55, tag = rdsRand(s + 33, blk);
      const ht = -60 + (rdcHash(x, 1, s) < 0.12 ? 2 : 0) + (bx < 5 || bx > 86 ? 2 : 0);
      for (let y = ht; y < -29; y++) {
        let v = y < ht + 2 ? 0.3 : y > -38 ? 2.6 : y > -42 ? 1.8 : 1.2;
        if (bx > 85) v += 1;
        if (rdcHash(x, y, s + 2) < 0.07) v += 0.7;
        let col = rdsPick(RDS_PAL[1].con2, v, x, y);
        if (stripe && y > ht + 3 && y < ht + 10) col = (((x + y) >> 2) & 1) ? 0xb04a3a : 0xd8d0c0;
        if (tag > 0.6 && Math.abs(bx - 45) < 22 && y > -52 && y < -36 && rdtN2(x, y, 16, 5, s + 34) > 0.55) col = [0x5a8a9a, 0xb0605a, 0xc0a040][Math.floor(tag * 30) % 3]; // 涂鸦
        rdsPx(B, x, y, col, 1);
      }
      continue;
    }
    const hs = sec(x); if (hs < 0.12) continue; // 缺一段
    const dent = hs > 0.88 ? Math.round(Math.sin((x % 96) / 96 * Math.PI) * 4) : 0;
    for (let r = 0; r < 12; r++) {
      const y = -57 + r + dent;
      let v = prof[r] + (rdcHash(x, y, s + 5) < 0.06 ? 0.8 : 0), col = rdsPick(PR, v, x, y);
      if (bi !== 2 && rdtN2(x, y, 24, 6, s + 32) > (bi === 3 ? 0.62 : 0.74)) col = rdsPick(RDT_RUST, v * 0.8, x, y);
      if (bi === 3 && hs > 0.5 && hs < 0.64 && r > 2 && r < 9) col = (((x + y) >> 2) & 1) ? 0xe0c050 : 0x2e2a20; // 警示胶带
      if (bi === 2 && r === 0 && rdcHash(x, 0, s + 6) < 0.4) col = RDT_MOSS[rdcHash(x, 1, s) < 0.5 ? 0 : 1];
      rdsPx(B, x, y, col, 1);
    }
    const pp = x % 48;
    if (pp === 1 || pp === 2) rdsPx(B, x, -51 + dent, PR[4], 1); // 螺栓
    if (x % 96 >= 23 && x % 96 <= 25) for (let y = -54; y <= -52; y++) rdsPx(B, x, y + dent, y === -54 ? 0xffd890 : 0xe09040, 1); // 反光片
    if (bi === 4 && rdcHash(x, 2, s) < 0.14) { const L = 1 + Math.floor(rdcHash(x, 3, s) * 5); for (let k = 0; k < L; k++) rdsPx(B, x, -45 + dent + k, RDS_PAL[4].ice[k < 2 ? 1 : 2], 2); } // 冰柱
  }
  // 沙 / 雪埋住立柱脚
  if (bi === 0 || bi === 4) for (let x = 0; x < RDS_TW; x++) { const sh = rdtN2(x, 0, 64, 1, s + 35) * (bi === 0 ? 12 : 16); for (let y = Math.round(-42 - sh); y < -40; y++) rdsPx(B, x, y, bi === 0 ? rdsPick(rdtRamp(RD_BIOMES[0].ground), 1 + (y > -44 ? 1 : 0), x, y) : rdsPick(RDS_PAL[4].snow, 0.5 + (y > -44 ? 1 : 0), x, y), 2); }
  if (bi === 5) for (let i = 0; i < 9; i++) { const x = rdsRand(s + 36, i) * RDS_TW; rdsCrystal(B, x, -40, 10 + rdsRand(s + 37, i) * 16, -Math.PI / 2 + (rdsRand(s + 38, i) - 0.5), 4, RDS_PAL[5].cry, s + i); }
}
// 路肩和下面地上的碎石子、小草
function rdtGroundBits(B, bi, Gr, s) {
  for (let i = 0; i < 420; i++) {
    const x = rdsRand(s + 50, i) * RDS_TW, y = 26 + Math.pow(rdsRand(s + 51, i), 0.9) * (RDT_DOWN - 32), r = 0.8 + rdsRand(s + 52, i) * (1 + y / 160);
    if (bi === 2 || bi === 1) if (rdsRand(s + 53, i) < 0.25) { for (let k = 0; k < 4; k++) rdsLine(B, x + k, y, x + k + (k - 1.5) * 0.8, y - 3 - (k % 2) * 3 - r, k % 2 ? RDT_MOSS[2] : RDT_MOSS[1], 2); continue; } // 草
    rdtEllipse(B, x, y, r * 1.4, r, (px, py, d, nx, ny) => rdsPx(B, px, py, rdsPick(Gr, 1 + nx * 0.8 + ny * 1.1 + (d > 0.7 && ny > 0 ? 1 : 0), px, py), 2));
    rdsRect(B, x - r, y + r, r * 2.6, 1, Gr[5], 2); // 影子
  }
}

// ================= 近景：电线杆 + 电线、广告牌、路牌、路边废车 =================
function rdtBuildNear(bi) {
  const s = bi * 41 + 3, B = rdsPaper(170), R = (k) => rdsRand(s, k), PL = bi === 5 ? RDS_PAL[5].rock : RDT_WOOD;
  const xs = [], hs = [], brk = [];
  for (let i = 0; i < 6; i++) { xs.push(Math.round(i * 256 + (R(i) - 0.5) * 30)); hs.push(102 + R(i + 6) * 14); brk.push(R(i + 12) < 0.16); }
  // 电线（先画，被杆子挡住）
  const WC = rdsC('#2c2620');
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6, xa = xs[i], xb = xs[j] + (j === 0 ? RDS_TW : 0), ya = -hs[i] + 6, yb = -hs[j] + 6;
    for (const off of [-12, 0, 12]) {
      if (!brk[i] && !brk[j]) { const sag = 14 + R(20 + i) * 8; for (let k = 0; k <= xb - xa; k++) { const t = k / (xb - xa); rdsPx(B, xa + off + k, ya + (yb - ya) * t + sag * 4 * t * (1 - t) - 1, WC, 2); } }
      else if (!brk[i] || !brk[j]) { const from = brk[i] ? xb : xa, dir = brk[i] ? -1 : 1, y0 = brk[i] ? yb : ya, L = (xb - xa) * (0.45 + R(30 + i) * 0.2); for (let k = 0; k <= L; k++) { const t = k / L; rdsPx(B, from + dir * k + off, y0 + (-2 - y0) * Math.pow(t, 1.6), WC, 2); } }
    }
  }
  // 电线杆
  for (let i = 0; i < 6; i++) {
    const x = xs[i], h = hs[i];
    if (!brk[i]) {
      rdsStroke(B, x, 0, x, -h, 2.3, 1.7, PL, 1, s + i);
      rdsRect(B, x - 16, -h + 5, 32, 3, PL[1], 1); rdsRect(B, x - 16, -h + 7, 32, 1, PL[3], 1);
      rdsLine(B, x - 9, -h + 8, x, -h + 16, PL[2], 1); rdsLine(B, x + 9, -h + 8, x, -h + 16, PL[2], 1);
      for (const o of [-12, 0, 12]) { rdsRect(B, x + o - 1, -h + 1, 3, 4, rdsC(R(40 + i) > 0.5 ? '#d8d0c0' : '#7ab0a0'), 1); rdsPx(B, x + o - 1, -h + 1, 0xffffff, 1); }
      if (R(50 + i) < 0.35) { rdsCol(B, x + 6, -h + 34, -h + 18, 9, RDT_RAIL, s + i, {}); rdsRect(B, x + 2, -h + 17, 9, 1, RDT_RAIL[4], 1); }
      for (let y = -30; y > -h + 20; y -= 7) if (R(60 + i) < 0.5) rdsPx(B, x - 2, y, PL[0], 1); // 脚钉
    } else { // 断掉的杆子：下半截立着，上半截斜靠在地上
      const bh = h * 0.55;
      rdsStroke(B, x, 0, x, -bh, 2.3, 2, PL, 1, s + i);
      for (let k = -2; k <= 2; k++) rdsPx(B, x + k, -bh - 1 - (k & 1) * 2, PL[2], 1);
      rdsStroke(B, x + 3, -bh + 4, x + 70, -3, 2.1, 1.8, PL, 1, s + i + 5);
      rdsRect(B, x + 60, -16, 3, 16, PL[1], 1);
    }
  }
  // 广告牌（原创图案：太阳山、箭头、瓶子、笑脸、汽车；褪色、撕破、剥落）
  const BG = [['#c86a48', '#e0b070', '#5a8aa0'], ['#8a9aa8', '#c8b088', '#6a8a6a'], ['#a8945a', '#7a8a5a', '#c8a080'], ['#c0b060', '#8a9a70', '#b07058'], ['#9ab8d0', '#d0d8e0', '#c07060'], ['#7a5aa0', '#4a8aa0', '#a06a8a']][bi];
  for (let k = 0; k < 2; k++) {
    const bx = xs[k * 3 + 1] + 128 - 42, w = 84, bt = -112, bb = -66;
    for (const lx of [bx + 18, bx + w - 20]) { rdsRect(B, lx, bb, 3, -bb, RDT_RAIL[3], 1); rdsLine(B, lx + 1, bb + 20, lx + (lx < bx + 40 ? 14 : -12), bb, RDT_RAIL[3], 1); }
    rdsRect(B, bx + 6, bb + 2, w - 12, 2, RDT_RAIL[3], 1); // 走台
    const bg = rdtRamp(BG[Math.floor(R(70 + k) * 3)]), art = Math.floor(R(72 + k) * 5);
    for (let x = 0; x < w; x++) for (let y = bt; y < bb; y++) {
      const px = bx + x, edge = x < 2 || x >= w - 2 || y < bt + 2 || y >= bb - 2;
      let col;
      if (edge) col = RDT_RAIL[3];
      else {
        const u = x / w, v = (y - bt) / (bb - bt);
        col = rdsPick(bg, 1.2 + v * 1.2, px, y);
        if (art === 0) { if ((u - 0.3) ** 2 + (v - 0.35) ** 2 < 0.02) col = 0xf0d070; if (v > 0.55 + Math.abs(u - 0.6) * -0.9 + 0.2 && v > 0.6) col = 0x6a4a3a; }
        else if (art === 1) { if (v > 0.35 && v < 0.65 && u > 0.55 && u < 0.75) col = 0xf4efe0; if (u >= 0.75 && u < 0.9 && Math.abs(v - 0.5) < (0.9 - u) * 2.2) col = 0xf4efe0; if (u > 0.08 && u < 0.45 && ((v > 0.25 && v < 0.35) || (v > 0.5 && v < 0.58)) && rdcHash(Math.floor(x / 4), Math.floor(v * 10), s) > 0.2) col = 0x2e2420; }
        else if (art === 2) { if (Math.abs(u - 0.7) < 0.08 && v > 0.3 && v < 0.9) col = 0x5aa070; if (Math.abs(u - 0.7) < 0.035 && v > 0.12 && v <= 0.3) col = 0x5aa070; if (Math.abs(u - 0.7) < 0.08 && v > 0.5 && v < 0.65) col = 0xf4efe0; if (u > 0.08 && u < 0.5 && v > 0.3 && v < 0.42) col = 0xf4efe0; }
        else if (art === 3) { const d = (u - 0.5) ** 2 * 3.5 + (v - 0.5) ** 2; if (d < 0.13) col = 0xf0d070; if (d < 0.13 && ((Math.abs(u - 0.42) < 0.03 || Math.abs(u - 0.58) < 0.03) && Math.abs(v - 0.4) < 0.07)) col = 0x2e2420; if (d < 0.13 && Math.abs(v - 0.7 + (u - 0.5) ** 2 * 6) < 0.04 && Math.abs(u - 0.5) < 0.14) col = 0x2e2420; }
        else { if (v > 0.5 && v < 0.75 && u > 0.15 && u < 0.85) col = 0xc04a3a; if (v > 0.32 && v <= 0.5 && u > 0.32 && u < 0.68) col = 0xc04a3a; if (v > 0.36 && v <= 0.48 && u > 0.36 && u < 0.64) col = 0x9ac8d8; if (v >= 0.72 && ((u - 0.3) ** 2 + (v - 0.78) ** 2 * 3 < 0.006 || (u - 0.7) ** 2 + (v - 0.78) ** 2 * 3 < 0.006)) col = 0x2e2420; }
        col = rdsMixI(col, 0xb8ac98, 0.28);                                           // 晒褪色
        if (rdtN2(px, y, 16, 8, s + 70 + k) > 0.7) col = rdsPick(rdtRamp('#8a8478'), 1 + ((x >> 2) & 1), px, y); // 剥落露出木板
        if (rdcHash(px, y, s + 71) < 0.03) col = rdsMixI(col, 0x2e2420, 0.4);
        if (bi === 5 && rdtN2(px, y, 24, 6, s + 72) > 0.62 && rdtN2(px, y, 24, 6, s + 72) < 0.66) { rdsPx(B, px, y, RDS_PAL[5].glow, 3); continue; } // 外星涂鸦（发光）
      }
      rdsPx(B, px, y, col, 1);
    }
    for (let t = 0; t < 4; t++) { const tx = bx + 8 + R(80 + k * 4 + t) * (w - 16), L = 4 + R(90 + t) * 14; for (let q = 0; q < L; q++) rdsPx(B, tx + (q > L / 2 ? 1 : 0), bb + q, bg[1], 2); } // 垂下来的破纸
    for (const lx of [bx + 20, bx + w - 22]) { rdsLine(B, lx, bt - 1, lx + 4, bt - 6, RDT_RAIL[3], 1); rdsRect(B, lx + 2, bt - 8, 6, 3, RDT_RAIL[2], 1); }
    if (R(95 + k) > 0.5) rdsLight(B, bx + 24, bt - 5, 'win', '#ffe8a0', 4);
  }
  // 路牌：绿色指路牌（白色字块 + 箭头）或圆形限速牌，有弹孔
  for (let k = 0; k < 2; k++) {
    const x = xs[k * 3] + 70 + R(100 + k) * 40;
    if (R(102 + k) > 0.5) {
      rdsRect(B, x + 4, -56, 2, 56, RDT_RAIL[2], 1); rdsRect(B, x + 30, -56, 2, 56, RDT_RAIL[2], 1);
      for (let xx = 0; xx < 36; xx++) for (let y = -76; y < -56; y++) { const e = xx === 0 || xx === 35 || y === -76 || y === -57; rdsPx(B, x + xx, y, e ? 0xd8d8cc : rdsPick(rdtRamp('#3a7a54'), 1 + (y > -62 ? 0.6 : 0) + (rdcHash(x + xx, y, s) < 0.05 ? 1 : 0), x + xx, y), 1); }
      for (let r = 0; r < 2; r++) for (let xx = 4; xx < 22; xx++) if (rdcHash(Math.floor(xx / 3), r, s + k) > 0.25) rdsPx(B, x + xx, -72 + r * 6, 0xeae6d8, 1);
      rdsPoly(B, [[x + 25, -71], [x + 30, -71], [x + 30, -73], [x + 33, -69], [x + 30, -65], [x + 30, -67], [x + 25, -67]], 0xeae6d8, 1);
      for (let h = 0; h < 4; h++) rdsPx(B, x + 3 + R(110 + h) * 30, -74 + R(115 + h) * 16, 0x1e1a18, 1);
    } else {
      rdsStroke(B, x, 0, x + 3, -48, 1.1, 1, RDT_RAIL, 1, s);
      rdtEllipse(B, x + 3, -58, 9, 9, (px, py, d, nx, ny) => rdsPx(B, px, py, d > 0.55 ? (d > 0.92 ? 0xd8d8cc : 0xb84a3a) : rdsPick(rdtRamp('#e4e0d4'), 1 + nx + ny * 0.5, px, py), 1));
      rdsRect(B, x - 1, -61, 3, 6, 0x2e2420, 1); rdsRect(B, x + 4, -61, 3, 6, 0x2e2420, 1); rdsRect(B, x + 5, -60, 1, 4, 0xe4e0d4, 1);
    }
  }
  // 路边的废车
  { const x = xs[4] + 150, P = RDT_RUST; rdsPoly(B, [[x, -3], [x + 3, -11], [x + 14, -12], [x + 22, -21], [x + 42, -21], [x + 50, -12], [x + 60, -10], [x + 60, -3]], (px, py, t) => rdsPick(P, 0.4 + t * 2.3 + (rdcHash(px, py, s) < 0.08 ? 0.8 : 0), px, py), 1);
    rdsRect(B, x + 24, -19, 8, 6, 0x2a221c, 1); rdsRect(B, x + 34, -19, 7, 6, 0x2a221c, 1); for (const wx of [x + 13, x + 48]) rdtEllipse(B, wx, -3, 5, 3.5, (px, py, d) => rdsPx(B, px, py, d > 0.4 ? 0x2a221c : 0x6e6458, 1)); }
  // ---- 各地区特色 ----
  if (bi === 0) { // 木头栅栏 + 铁丝 + 挂着的牛头骨，风滚草
    const x0 = xs[2] + 40; for (let p = 0; p < 7; p++) { const px = x0 + p * 22; rdsStroke(B, px, 0, px + (p % 3 - 1) * 2, -24, 1.4, 1.2, RDT_WOOD, 1, s + p); }
    for (const y of [-20, -12]) for (let k = 0; k < 132; k++) if (rdcHash(k, y, s) > 0.15) rdsPx(B, x0 + k, y + Math.sin(k / 22 * Math.PI) * 2, k % 6 === 0 ? 0x6a5a4a : 0x4a3e34, 2);
    const kx = x0 + 44; rdsRect(B, kx - 4, -30, 9, 6, RDS_PAL[0].bone[1], 1); rdsRect(B, kx - 7, -32, 3, 2, RDS_PAL[0].bone[2], 1); rdsRect(B, kx + 5, -32, 3, 2, RDS_PAL[0].bone[2], 1); rdsPx(B, kx - 2, -28, 0x2e2420, 1); rdsPx(B, kx + 2, -28, 0x2e2420, 1);
    for (let t = 0; t < 3; t++) { const tx = R(120 + t) * RDS_TW, r = 6 + R(123 + t) * 4; for (let a = 0; a < 14; a++) { const an = a / 14 * 6.283; rdsLine(B, tx, -r, tx + Math.cos(an) * r, -r + Math.sin(an) * r, a % 2 ? 0x8a6a44 : 0x6a5034, 2); } }
  } else if (bi === 1) { // 公交站棚、消防栓
    const x = xs[2] + 60; rdsRect(B, x, -40, 2, 40, RDT_RAIL[3], 1); rdsRect(B, x + 40, -40, 2, 40, RDT_RAIL[3], 1); rdsRect(B, x - 3, -42, 48, 3, RDS_PAL[1].roof[1], 1);
    for (let xx = 2; xx < 40; xx++) for (let y = -39; y < -8; y++) if (rdtN2(x + xx, y, 16, 8, s + 1) > 0.42 && ((xx + y) % 9 === 0 || rdcHash(x + xx, y, s) < 0.02)) rdsPx(B, x + xx, y, 0xa8c0c8, 2);
    rdsRect(B, x + 6, -14, 30, 2, RDT_WOOD[1], 1); rdsRect(B, x + 8, -12, 2, 12, RDT_RAIL[3], 1); rdsRect(B, x + 32, -12, 2, 12, RDT_RAIL[3], 1);
    const hx = xs[5] + 40; rdsCol(B, hx, 0, -12, 6, rdsR(['#d86a50', '#b04a36', '#802e22', '#541a14']), s, { round: true }); rdsRect(B, hx - 5, -8, 10, 2, 0x802e22, 1);
  } else if (bi === 2) { // 黄色动物出没警示牌、一垛木头
    const x = xs[1] + 60; rdsRect(B, x, -44, 2, 44, RDT_WOOD[2], 1); rdsPoly(B, [[x + 1, -64], [x + 13, -52], [x + 1, -40], [x - 11, -52]], (px, py) => rdsPick(rdtRamp('#d8b040'), px < x ? 1 : 1.8, px, py), 1);
    rdsRect(B, x - 4, -53, 8, 3, 0x2e2420, 1); rdsRect(B, x + 3, -56, 2, 4, 0x2e2420, 1); rdsPx(B, x - 3, -50, 0x2e2420, 1); rdsPx(B, x + 2, -50, 0x2e2420, 1);
    const lx = xs[4] + 40; for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) rdtEllipse(B, lx + c * 9 + r * 4.5, -4 - r * 8, 4.5, 4, (px, py, d) => rdsPx(B, px, py, d < 0.3 ? 0xc8a878 : d < 0.7 ? 0xa08060 : RDT_WOOD[2], 1));
  } else if (bi === 3) { // 带刺铁丝网围栏 + 黄色警示牌
    const x0 = xs[1] + 20; for (let p = 0; p <= 200; p += 40) { rdsRect(B, x0 + p, -34, 2, 34, RDT_RAIL[3], 1); rdsLine(B, x0 + p, -34, x0 + p + 6, -39, RDT_RAIL[3], 1); }
    for (let xx = 0; xx < 200; xx++) { for (let y = -32; y < 0; y++) if ((((xx + y) % 5) + 5) % 5 === 0 || (((xx - y) % 5) + 5) % 5 === 0) if (rdtN2(x0 + xx, y, 24, 10, s) > 0.3) rdsPx(B, x0 + xx, y, rdsC('#7a7c70'), 2); rdsPx(B, x0 + xx, -38 + Math.round(Math.sin(xx * 0.8) * 1.5), 0x5a5a50, 2); }
    const sx = x0 + 84; rdsPoly(B, [[sx, -30], [sx + 9, -14], [sx - 9, -14]], 0xe0c050, 1); rdsRect(B, sx - 1, -24, 2, 5, 0x2e2a20, 1); rdsPx(B, sx - 1, -17, 0x2e2a20, 1);
  } else if (bi === 4) { // 橙色雪地标杆
    for (let i = 0; i < 12; i++) { const x = (i + 0.5) * 128; for (let y = -30; y < 0; y++) rdsPx(B, x, y, ((y >> 2) & 1) ? 0xe07030 : 0x2e2420, 1); }
    for (let i = 0; i < 8; i++) rdtEllipse(B, rdsRand(s, 200 + i) * RDS_TW, 0, 18 + rdsRand(s, 210 + i) * 20, 6 + rdsRand(s, 220 + i) * 4, (px, py, d, nx, ny) => py <= 0 && rdsPx(B, px, py, rdsPick(RDS_PAL[4].snow, ny < -0.6 ? 0 : 1 + nx * 0.5, px, py), 1));
  } else { // 杆子根部长满水晶，粉色触须缠在杆子上
    for (let i = 0; i < 6; i++) { const x = xs[i]; for (let c = 0; c < 3; c++) rdsCrystal(B, x - 6 + c * 6, 0, 10 + rdsRand(s, 230 + i * 3 + c) * 20, -Math.PI / 2 + (c - 1) * 0.5, 5, RDS_PAL[5].cry, s + i * 3 + c);
      if (i % 2 === 0) for (let t = 0; t < 40; t++) { const y = -t * 1.6, dx = Math.sin(t * 0.55) * 4; rdsPx(B, x + dx, y, RDS_PAL[5].pink[1 + (dx > 0 ? 1 : 0)], 1); rdsPx(B, x + dx, y - 1, RDS_PAL[5].pink[1], 1); } }
  }
  rdsOutline(B, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  if (bi === 4) rdtSnowCap(B, B.base + 1);
  rdsHaze(B, rdsC(RD_BIOMES[bi].sky[1]), 0.05, 0.12);
  return { cv: rdsToCanvas(B), lights: B.lights, base: B.base };
}

// ================= 前景杂物（离镜头最近，视差 1.3） =================
function rdtBuildFront(bi) {
  const s = bi * 29 + 11, B = rdtPaper(RDS_TW, 0, RDT_DOWN), R = (k) => rdsRand(s, k);
  const rock = [RDS_PAL[0].rock, RDS_PAL[1].con2, RDS_PAL[2].ground, RDS_PAL[3].con, RDS_PAL[4].rock, RDS_PAL[5].rock][bi];
  const items = [];
  for (let i = 0; i < 46; i++) items.push({ x: R(i) * RDS_TW, y: 52 + Math.pow(R(i + 100), 0.85) * (RDT_DOWN - 70), t: R(i + 200), i });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) rdtAt(B, it.y, () => {
    const k = 0.7 + it.y / RDT_DOWN * 1.2, x = it.x, t = it.t, ss = s + it.i;
    if (t < 0.3) { rdsRock(B, x, (8 + R(it.i + 300) * 12) * k, (5 + R(it.i + 400) * 6) * k, rock, ss, { snow: bi === 4 ? RDS_PAL[4].snow : null }); return; }
    if (bi === 5 && t < 0.62) { const n = 2 + Math.floor(R(it.i + 500) * 3); for (let c = 0; c < n; c++) rdsCrystal(B, x + c * 4 * k, 0, (8 + R(it.i * 3 + c) * 14) * k, -Math.PI / 2 + (c - n / 2) * 0.4, 3.5 * k, R(it.i + 600) > 0.7 ? RDS_PAL[5].pink : RDS_PAL[5].cry, ss + c); rdsLight(B, x, -6 * k, 'glow', '#73eff7', 3); return; }
    if (bi === 4 && t < 0.6) { rdtEllipse(B, x, 0, 16 * k, 6 * k, (px, py, d, nx, ny) => py <= 0 && rdsPx(B, px, py, rdsPick(RDS_PAL[4].snow, ny < -0.5 ? 0 : 1 + nx * 0.6, px, py), 1)); return; }
    if (bi === 3 && t < 0.42) { rdtEllipse(B, x, 0, 14 * k, 2.5 * k, (px, py, d, nx, ny) => rdsPx(B, px, py, ny < -0.2 ? RDS_PAL[3].tox2 : RDS_PAL[3].tox, 3)); rdsLight(B, x, 0, 'glow', '#a7f070', Math.round(5 * k)); rdsLight(B, x + 4 * k, -1, 'bubble', '#e8ffb0', 2); return; }
    if (t < 0.48) { for (let q = 0; q < 6; q++) rdsBranch(B, x + q * 1.5, 0, -Math.PI / 2 + (q - 2.5) * 0.25, (5 + R(it.i + q) * 6) * k, 0.6, bi === 2 || bi === 1 ? RDT_MOSS : RDT_WOOD, ss + q, 0); return; } // 草 / 枯草
    if (t < 0.56) { rdtEllipse(B, x, -5 * k, 7 * k, 5 * k, (px, py, d, nx, ny) => rdsPx(B, px, py, d < 0.25 ? 0x3e3630 : d < 0.4 ? 0x6a625a : rdsPick(rdsR(['#4a423c', '#36302a', '#26201c', '#1a1612']), 1 + nx + ny * 0.5 + (d > 0.85 && (((px + py) & 3) === 0) ? 1 : 0), px, py), 1)); return; } // 旧轮胎
    if (t < 0.64) { const R2 = bi === 3 ? RDS_PAL[3].yel : RDT_RUST; if (R(it.i + 700) > 0.5) rdsCol(B, x, 0, -14 * k, 10 * k, R2, ss, { bands: Math.max(2, Math.round(4 * k)) }); else { for (let xx = 0; xx < 15 * k; xx++) for (let y = -9 * k; y <= 0; y++) rdsPx(B, x + xx, y, rdsPick(R2, 1 + (y + 4.5 * k) / (4.5 * k) * 1.3 + ((Math.round(xx) % Math.round(5 * k)) === 0 ? 0.8 : 0), x + xx, y), 1); } return; } // 油桶
    if (t < 0.7) { const P = RDS_PAL[0].bone; rdsStroke(B, x, -1, x + 10 * k, -2, 1.2 * k, 1 * k, P, 1, ss); rdtEllipse(B, x + 11 * k, -2.5 * k, 2 * k, 2 * k, (px, py) => rdsPx(B, px, py, P[1], 1)); return; } // 骨头
    if (t < 0.78) { const a = (R(it.i + 800) - 0.5) * 0.6, L = 16 * k; rdsPoly(B, [[x, 0], [x + Math.cos(a) * L, Math.sin(a) * L - 2], [x + Math.cos(a) * L + 2, Math.sin(a) * L - 8 * k], [x + 2, -7 * k]], (px, py, tt) => rdsPick(R(it.i + 801) > 0.5 ? RDT_RUST : RDT_RAIL, 1 + tt * 2 + (rdcHash(px, py, ss) < 0.1 ? 0.7 : 0), px, py), 1); return; } // 铁皮
    if (t < 0.84 && bi === 0) { rdsCactus(B, x, (14 + R(it.i + 900) * 14) * k, RDS_PAL[0].cactus, ss); return; }
    if (t < 0.84 && bi === 2) { for (let m = 0; m < 3; m++) { const mx = x + m * 4 * k, mh = (3 + m) * k; rdsRect(B, mx, -mh, 1.5 * k, mh, 0xd8ccb0, 1); rdtEllipse(B, mx + 0.7 * k, -mh, 2.5 * k, 1.5 * k, (px, py) => rdsPx(B, px, py, m === 1 ? 0xc8f070 : 0xb0683a, m === 1 ? 3 : 1)); } rdsLight(B, x + 4 * k, -4 * k, 'glow', '#c8f070', 3); return; }
    if (t < 0.9 && (bi === 0 || bi === 1)) { rdsPoly(B, [[x, 0], [x + 12 * k, 0], [x + 9 * k, -5 * k]], (px, py) => (((px - py) >> 1) & 1) ? 0xe07030 : 0xeae6d8, 1); return; } // 倒了的路锥
    rdsRect(B, x, -3 * k, 2, 3 * k, 0x5a9a6a, 3); rdsPx(B, x, -3 * k - 1, 0xc8f0d0, 3); // 碎玻璃瓶（一点反光）
  });
  rdsOutline(B, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2), B.h);
  if (bi === 4) rdtSnowCap(B);
  return { cv: rdsToCanvas(B), lights: B.lights, base: 0 };
}

// ================= 缓存 =================
function rdtGet(bi) {
  const C = RDT_CACHE[bi] || (RDT_CACHE[bi] = {});
  if (!C.near) C.near = rdtBuildNear(bi);
  if (!C.street) C.street = rdtBuildStreet(bi);
  if (!C.front) C.front = rdtBuildFront(bi);
  return C;
}
function rdtPrebuild(bi) { // 每帧最多画一块
  const C = RDT_CACHE[bi] || (RDT_CACHE[bi] = {});
  if (!C.near) C.near = rdtBuildNear(bi); else if (!C.street) C.street = rdtBuildStreet(bi); else if (!C.front) C.front = rdtBuildFront(bi);
}
// 前景杂物：在车、怪物之后画（离镜头最近）
function rdtDrawFront(g, bi, pi, blend, scroll, gy) {
  const V = RDV, cw = V.buf.width, ch = V.buf.height;
  if (!cw || !ch || !V.sc) return;
  const sg = V.scg, lit = [], day = RDT_TONE.day, dusk = RDT_TONE.dusk;
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
  sg.clearRect(0, 0, cw, ch);
  if (blend > 0.003) rdsBlit(sg, rdtGet(pi).front, scroll * 1.3, gy * RD_Q, blend, lit, cw);
  rdsBlit(sg, rdtGet(bi).front, scroll * 1.3, gy * RD_Q, blend > 0.003 ? 1 - blend : 1, lit, cw);
  rdtTint(sg, cw, ch, day, dusk);
  g.drawImage(V.sc, 0, 0, V.W, V.H);
  rdsDrawLights(g, lit, day);
  for (const l of lit) RDS_LIT.push(l);
}
function rdtTint(sg, cw, ch, day, dusk) {
  sg.globalCompositeOperation = 'source-atop';
  const dk = (1 - day) * 0.66;
  if (dk > 0.01) { sg.fillStyle = 'rgba(14,16,36,' + dk.toFixed(3) + ')'; sg.fillRect(0, 0, cw, ch); }
  if (dusk > 0.02) { sg.fillStyle = 'rgba(236,112,72,' + (dusk * 0.2).toFixed(3) + ')'; sg.fillRect(0, 0, cw, ch); }
  sg.globalCompositeOperation = 'source-over';
}

// ================= 路障 =================
// 车：锈掉的废轿车（三种车漆，有的车门没了、有的引擎盖翘起来）；路障：水泥隔离墩 + 木马拒 + 警示灯 / 沙袋 / 钢制拒马；
// 弹坑：路面炸开的黑洞 + 翘起的沥青块（冒烟）；电线杆：倒在路上的杆子和电线（偶尔打火花）/ 倒下的枯树 / 倒下的广告牌铁架；石头：塌方的大石块
function rdtBuildObs(type, v, bi) {
  const W = 140, B = rdtPaper(W, 70, 14), cx = 70, s = bi * 7 + v * 31 + type.length * 5, R = (k) => rdsRand(s, k), lamps = [], smoke = [], spark = [];
  const rock = [RDS_PAL[0].rock, RDS_PAL[1].con2, RDS_PAL[2].bark, RDS_PAL[3].con, RDS_PAL[4].rock, RDS_PAL[5].rock][bi];
  if (type === 'car') {
    const paint = rdtRamp(['#6a88a0', '#a05a48', '#c8b890'][v]), f = R(1) > 0.5 ? 1 : -1, X = (x) => cx + x * f;
    rdsPoly(B, [[-37, -9], [-35, -19], [-20, -21], [-12, -33], [14, -33], [24, -21], [36, -18], [38, -9], [38, -6], [-37, -6]].map((p) => [X(p[0]), p[1]]), (px, py, t) => rdsPick(paint, 0.4 + t * 2.6 + (py === -20 ? -0.6 : 0), px, py), 1);
    rdsPoly(B, [[-10, -31], [12, -31], [21, -22], [-17, -22]].map((p) => [X(p[0]), p[1]]), (px, py) => (((px + py) % 7) === 0 ? 0x9ab8c0 : 0x2a2420), 3);
    rdsRect(B, X(1) - 1, -31, 3, 10, paint[3], 1);
    for (let y = -20; y < -8; y++) { rdsPx(B, X(-12), y, paint[4], 1); rdsPx(B, X(12), y, paint[4], 1); }
    if (v === 1) rdsRect(B, Math.min(X(-11), X(11)) + 1, -20, 22, 11, 0x2a2420, 1); // 车门没了
    if (v === 2) rdsPoly(B, [[24, -21], [36, -30], [38, -27], [26, -19]].map((p) => [X(p[0]), p[1]]), (px, py) => rdsPick(paint, 1.5, px, py), 1); // 引擎盖翘起
    rdsRect(B, X(36) - (f > 0 ? 2 : 0), -16, 3, 3, 0xe0d8a0, 1); rdsRect(B, X(-37) - (f > 0 ? 0 : 2), -15, 3, 3, 0x8a2a1a, 1);
    for (const wx of [-23, 24]) rdtEllipse(B, X(wx), -5, 7.5, 6, (px, py, d, nx, ny) => py < 2 && rdsPx(B, px, py, d < 0.2 ? 0x8a8070 : d < 0.45 ? 0x4a423a : 0x2a221c, 1)); // 瘪胎
    rdcWeather(B, s, 0.12 + v * 0.06, -22);
    rdsRect(B, cx - 34, 0, 72, 2, 0x1e1a18, 2); // 影子
  } else if (type === 'barrier') {
    if (v === 0) {
      for (let x = -32; x < 32; x++) for (let y = -22; y < 0; y++) { const sl = y > -6 ? 0 : (y + 6) * -0.15; if (Math.abs(x) > 32 - sl * 3) continue; let col = rdsPick(RDS_PAL[1].con2, (y < -20 ? 0.3 : y > -6 ? 2.4 : 1.3) + (rdcHash(x, y, s) < 0.07 ? 0.8 : 0), cx + x, y); if (y > -19 && y < -12) col = (((x + y + 99) >> 2) & 1) ? 0xb84a3a : 0xe0d8c8; rdsPx(B, cx + x, y, col, 1); }
      rdsRect(B, cx - 2, -28, 4, 6, RDT_RAIL[3], 1); lamps.push([cx, -30]);
    } else if (v === 1) {
      for (const lx of [-24, 22]) { rdsLine(B, cx + lx - 5, 0, cx + lx, -22, RDT_WOOD[2], 1); rdsLine(B, cx + lx + 5, 0, cx + lx, -22, RDT_WOOD[2], 1); }
      for (let x = -32; x < 32; x++) for (let y = -24; y < -17; y++) rdsPx(B, cx + x, y, y === -24 ? 0xfff0e0 : (((x - y + 99) >> 2) & 1) ? 0xe07030 : 0xeae6d8, 1);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5 - r; c++) rdtEllipse(B, cx - 22 + c * 10 + r * 5, -4 - r * 7, 6, 4, (px, py, d, nx, ny) => rdsPx(B, px, py, rdsPick(rdtRamp('#a8946a'), 1 + nx * 0.6 + ny + (d > 0.8 ? 0.8 : 0), px, py), 1));
      rdsRect(B, cx - 26, -29, 3, 5, RDT_RAIL[3], 1); lamps.push([cx - 25, -31]);
    } else {
      for (const hx of [-18, 16]) { const P = RDT_RUST; rdsStroke(B, cx + hx - 12, 0, cx + hx + 12, -24, 1.8, 1.8, P, 1, s); rdsStroke(B, cx + hx + 12, 0, cx + hx - 12, -24, 1.8, 1.8, P, 1, s + 1); rdsStroke(B, cx + hx - 3, -2, cx + hx + 3, -22, 1.6, 1.6, P, 1, s + 2); }
      for (let k = 0; k < 64; k++) { const a = k * 0.55; rdsPx(B, cx - 32 + k, -12 + Math.sin(a) * 5, 0x5a5448, 2); rdsPx(B, cx - 32 + k + Math.cos(a), -12 + Math.cos(a) * 5, 0x7a7266, 2); }
    }
  } else if (type === 'crater') {
    rdtEllipse(B, cx, 0, 40, 9, (px, py, d) => { if (rdcHash(px, py, s) < (1 - d) * 0.8 + 0.2) rdsPx(B, px, py, 0x221c18, 2); }); // 焦痕
    rdtEllipse(B, cx, 0, 28, 6.5, (px, py, d, nx, ny) => rdsPx(B, px, py, d > 0.75 ? (ny < 0 ? 0x4a4440 : 0x8a8478) : rdsPick(rdsR(['#3a302a', '#2a221e', '#1a1412', '#100c0a']), 3 - ny * 2 - d, px, py), 2));
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + R(i), bx = cx + Math.cos(a) * 30, by = Math.sin(a) * 6 - 1, w = 6 + R(i + 10) * 6, h = 3 + R(i + 20) * 4, tl = (R(i + 30) - 0.5) * 1.4;
      rdsPoly(B, [[bx - w / 2, by], [bx + w / 2, by + tl * 3], [bx + w / 2 + tl * 2, by - h + tl * 3], [bx - w / 2 + tl * 2, by - h]], (px, py, t) => rdsPick(rdtRamp(RD_BIOMES[bi].road), t < 0.3 ? 0 : 2 + t, px, py), 1); }
    smoke.push([cx - 6, -3], [cx + 8, -2]);
  } else if (type === 'pole') {
    if (v === 1) { // 倒下的枯树
      rdsStroke(B, cx - 55, -5, cx + 40, -9, 4.5, 3, RDS_PAL[2].bark, 1, s);
      for (let b = 0; b < 5; b++) rdsBranch(B, cx + 10 + b * 8, -10, -Math.PI / 2 + (b - 2) * 0.5 + 0.6, 10 + R(b) * 10, 1.6, RDS_PAL[2].bark, s + b, 2);
      for (let r = 0; r < 4; r++) rdsStroke(B, cx - 56, -5, cx - 62 - R(r + 9) * 6, -12 + r * 5, 1.4, 0.6, RDS_PAL[2].bark, 1, s + r);
    } else if (v === 2) { // 倒下的广告牌铁架
      rdsStroke(B, cx - 58, -4, cx + 50, -14, 1.2, 1.2, RDT_RUST, 1, s); rdsStroke(B, cx - 58, -12, cx + 50, -22, 1.2, 1.2, RDT_RUST, 1, s + 1);
      for (let k = 0; k <= 12; k++) { const x = cx - 58 + k * 9; rdsLine(B, x, -4 - k * 0.83, x + 9 * (k % 2 ? -1 : 1) * 0, -12 - k * 0.83, RDT_RUST[2], 1); rdsLine(B, x, -4 - k * 0.83, x + 9, -12 - (k + 1) * 0.83, RDT_RUST[2], 1); }
      rdsPoly(B, [[cx + 30, -10], [cx + 62, -16], [cx + 58, -36], [cx + 28, -30]], (px, py, t) => rdsPick(rdtRamp('#a8946a'), 1 + t * 1.5 + (rdtN2(px, py, 16, 6, s) > 0.6 ? 1 : 0), px, py), 1);
    } else { // 电线杆
      rdsStroke(B, cx - 58, -4, cx + 46, -12, 2.6, 2.3, RDT_WOOD, 1, s);
      rdsStroke(B, cx + 38, -26, cx + 42, 2, 1.6, 1.6, RDT_WOOD, 1, s + 1);
      for (const o of [-12, 0, 12]) { rdsRect(B, cx + 40 + o * 0.15 - 1, -12 + o - 1, 3, 3, 0xd8d0c0, 1); }
      for (let w = 0; w < 2; w++) { let px = cx + 40, py = -12 - 10 + w * 18; for (let k = 0; k < 40; k++) { const nx = px - 2, ny = py + Math.sin(k * 0.4 + w) * 1.2 + (py < -1 ? 0.5 : 0); rdsPx(B, nx, ny, 0x2c2620, 2); px = nx; py = Math.min(-1, ny); } spark.push([px, py]); }
    }
  } else { // 塌方的石头
    const sn = bi === 4 ? RDS_PAL[4].snow : null;
    for (let i = 0; i < 6; i++) { const x = cx + (R(i) - 0.5) * 50, w = 14 + R(i + 6) * 20; rdsRock(B, x, w, w * (0.55 + R(i + 12) * 0.3), rock, s + i, { snow: sn, strata: bi === 0 ? 5 : 0 }); }
    if (bi === 5) for (let c = 0; c < 4; c++) rdsCrystal(B, cx - 12 + c * 8, -6, 10 + R(c + 20) * 16, -Math.PI / 2 + (c - 1.5) * 0.4, 5, RDS_PAL[5].cry, s + c);
    for (let i = 0; i < 14; i++) { const x = cx + (R(i + 30) - 0.5) * 70; rdsRect(B, x, -1 - R(i + 40) * 2, 2, 2, rock[2], 1); }
  }
  if (bi === 4) rdtSnowCap(B);
  rdcOutline(B);
  return { cv: rdsToCanvas(B), w: W, up: 70, lamps, smoke, spark };
}
let RDT_TMP = null;
function rdtDrawObstacle(g, o, gy) {
  const x = rdSX(o.km * RD_PX_KM);
  if (x < -40 || x > RDV.W + 40) return;
  const bi = rdBiomeIndex(o.km), v = Math.min(2, Math.floor((o.seed || 0) * 3)), key = o.type + v + '_' + bi;
  if (!RDT_OBS[key]) { const ks = Object.keys(RDT_OBS); if (ks.length > 40) for (const k of ks) delete RDT_OBS[k]; RDT_OBS[key] = rdtBuildObs(o.type, v, bi); }
  const S = RDT_OBS[key], Q = RD_Q, by = gy + 2, x0 = Math.round((x - S.w / 2 / Q) * Q) / Q, y0 = by - S.up / Q;
  if (!RDT_TMP) { RDT_TMP = createCanvas(S.cv.width, S.cv.height); }
  const tg = RDT_TMP.getContext('2d');
  tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, RDT_TMP.width, RDT_TMP.height); tg.drawImage(S.cv, 0, 0);
  rdtTint(tg, RDT_TMP.width, RDT_TMP.height, RDT_TONE.day, RDT_TONE.dusk);
  g.drawImage(RDT_TMP, 0, 0, S.cv.width, S.cv.height, x0, y0, S.cv.width / Q, S.cv.height / Q);
  // 会动的：警示灯闪、弹坑冒烟和火星、断电线打火花
  const t = G.time, q = 1 / Q, px = (p) => x0 + p[0] * q, py = (p) => by + p[1] * q;
  for (const l of S.lamps) { const on = (t * 1.6 + o.seed * 7) % 1 < 0.5; g.fillStyle = on ? '#ffb040' : '#6a4a20'; g.fillRect(px(l) - 1.5 * q, py(l) - 1.5 * q, 3 * q, 3 * q); if (on) { g.globalAlpha = 0.25; g.fillRect(px(l) - 2, py(l) - 2, 4, 4); g.globalAlpha = 1; RDS_LIT.push({ x: px(l), y: py(l), r: 6, a2: 0.8, kind: 'blink' }); } }
  for (const sm of S.smoke) for (let k = 0; k < 4; k++) { const p = (t * 0.35 + k / 4 + o.seed) % 1, sz = (3 + p * 7) * q * 1.5; g.globalAlpha = (1 - p) * 0.45; g.fillStyle = p < 0.15 ? '#5a4a40' : '#7a746c'; g.fillRect(px(sm) + Math.sin(p * 5 + k) * 2 - sz / 2 - p * 4, py(sm) - p * 16 - sz / 2, sz, sz); }
  for (const sm of S.smoke) if (Math.sin(t * 7 + sm[0]) > 0.6) { g.globalAlpha = 0.9; g.fillStyle = '#ffa040'; g.fillRect(px(sm) + Math.sin(t * 13) * 3, py(sm) - ((t * 3) % 1) * 6, q * 2, q * 2); }
  g.globalAlpha = 1;
  for (const sp of S.spark) if ((t * 2.3 + o.seed * 5) % 3 < 0.25) { g.fillStyle = '#e8f4ff'; for (let k = 0; k < 6; k++) g.fillRect(px(sp) + (rdHash(k + Math.floor(t * 20)) - 0.5) * 5, py(sp) - rdHash(k + 7 + Math.floor(t * 20)) * 4, q * 2, q * 2); RDS_LIT.push({ x: px(sp), y: py(sp), r: 8, a2: 1, kind: 'blink' }); }
}
