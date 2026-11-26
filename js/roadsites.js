// =============================================
//  公路求生：路边建筑（精细像素，废墟质感）
//  16 种：加油站、超市、药店、汽修厂、警察局、军事检查站、民居、家电城、家具卖场、工厂、农场、房车营地、
//  废车场、研究所、幸存者营地、外星坠落舱。每种 2 款（按种子），按地区加沙堆 / 藤蔓 / 积雪 / 毒绿污渍 / 水晶；
//  搜过的建筑门开着、墙上喷了橙色 X 记号（末日幸存者「搜过了」的标记）。
//  静态部分逐像素画好缓存成图片；会动的部分每帧画：烟囱冒烟、旗子飘、风车转、篝火、电视雪花、探照灯扫、
//  警车灯闪、吊车磁盘晃、外星舱冒蒸汽；搜索时窗户里有手电筒光在晃、门口扬灰。
//  画在路面图层之前（护栏挡在建筑前面），和远景一起做昼夜调色。坐标：精细像素，y = 0 是建筑脚下（gy - 13）
// =============================================
const RDB_CACHE = {};
const RDB_CON = rdsR(['#dcd4c2', '#bcb2a0', '#9c9280', '#7c7264', '#5c544a', '#3e3830']);
const RDB_BRICK = rdsR(['#dc9a7c', '#bc785e', '#9a5a46', '#784032', '#542c22']);
const RDB_WHITE = rdsR(['#f0ece2', '#d8d2c4', '#b8b2a4', '#949082', '#6e6a5e']);
const RDB_DARK = 0x1e1a18;
const RDB_ICON = { // 7×7 原创小图标（招牌上用）
  drop: ['...#...', '..###..', '.#####.', '#######', '#######', '.#####.', '..###..'],
  cart: ['#......', '.######', '.#####.', '.#####.', '.......', '..#..#.', '.......'],
  cross: ['..###..', '..###..', '#######', '#######', '#######', '..###..', '..###..'],
  wrench: ['##...##', '.#...#.', '.##.##.', '..###..', '...#...', '...#...', '..###..'],
  star: ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '##...##'],
  bolt: ['....##.', '...##..', '..##...', '.#####.', '...##..', '..##...', '.##....'],
  chair: ['#......', '#......', '#......', '######.', '#....#.', '#....#.', '#....#.'],
  gear: ['.#.#.#.', '#######', '.##.##.', '###.###', '.##.##.', '#######', '.#.#.#.'],
  flask: ['..###..', '...#...', '...#...', '..#.#..', '.#...#.', '#.###.#', '#######'],
  car: ['.......', '..###..', '.#...#.', '#######', '#######', '.#...#.', '.......'],
};

// ---------- 建筑零件 ----------
// 墙：brick 砖 / siding 横向护墙板 / metal 波纹铁皮 / wood 竖木板 / 其他 = 水泥板；带污渍、雨水痕、裂缝
function rdbWall(B, x0, x1, yt, yb, R, kind, s) {
  x0 = Math.round(x0); x1 = Math.round(x1); yt = Math.round(yt); yb = Math.round(yb);
  for (let x = x0; x < x1; x++) for (let y = yt; y < yb; y++) {
    const u = x - x0, v = y - yt;
    let t = 1.2 + (v / Math.max(1, yb - yt)) * 0.8;
    if (kind === 'brick') { const row = Math.floor(v / 4), off = (row & 1) * 4; if (v % 4 === 3 || (u + off) % 8 === 7) t = 3.3; else if (rdcHash(Math.floor((u + off) / 8), row, s) < 0.2) t += 0.6; }
    else if (kind === 'siding') { if (v % 5 === 4) t = 3; else if (v % 5 === 0) t -= 0.5; }
    else if (kind === 'metal') t += [-0.7, 0, 0.5, 1, 0.5, 0][u % 6];
    else if (kind === 'wood') { if (u % 7 === 6) t = 3.4; t += (rdcHash(Math.floor(u / 7), 0, s) - 0.5) * 0.8; }
    else if (u % 36 === 35 || v % 30 === 29) t = 2.8;
    if (rdcHash(x, y, s) < 0.05) t += 0.7;
    if (rdcHash(x, 7, s) < 0.12 && rdcNoise2(x / 3, y / 20, s) > 0.55) t += 0.5;   // 雨水冲出的竖条污渍
    if (x >= x1 - 3) t += 0.8;
    if (y === yt) t -= 0.6;
    rdsPx(B, x, y, rdsPick(R, t, x, y), 1);
  }
  for (let c = 0; c < Math.ceil((x1 - x0) / 60); c++) { let cx = x0 + rdsRand(s, c) * (x1 - x0), cy = yt + rdsRand(s, c + 9) * (yb - yt) * 0.5; for (let k = 0; k < 20; k++) { rdsPx(B, cx, cy, R[R.length - 1], 1); cx += Math.round(rdcHash(k, c, s) * 2 - 1); cy += 1; if (cy >= yb) break; } }
}
function rdbParapet(B, x0, x1, y, R, s) { rdsRect(B, x0 - 2, y - 3, x1 - x0 + 4, 3, R[0], 1); rdsRect(B, x0 - 2, y, x1 - x0 + 4, 1, R[3], 1); for (let x = x0; x < x1; x += 2) if (rdcHash(x, y, s) < 0.12) rdsRect(B, x, y - 4 - Math.floor(rdcHash(x, 1, s) * 3), 2, 2, R[2], 1); }
// 窗：窗框 + 窗台；玻璃（反光斜条）/ 碎了（只剩边上的碎片）/ 钉了木板；可加铁栏；记下位置（搜索时手电筒在里面晃）
function rdbWin(B, x, y, w, h, s, o) {
  o = o || {}; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const fr = o.frame || RDB_CON[4], st = rdsRand(s, x * 3 + y * 7);
  rdsRect(B, x - 1, y - 1, w + 2, h + 2, fr, 1); rdsRect(B, x - 2, y + h + 1, w + 4, 1, RDB_CON[1], 1);
  for (let px = x; px < x + w; px++) for (let py = y; py < y + h; py++) {
    let c = RDB_DARK;
    if (o.shelf && (py - y) % 6 === 4) c = 0x4a4038; else if (o.shelf && (py - y) % 6 < 4 && rdcHash(px >> 1, py, s) < 0.5) c = [0x8a4a3a, 0x4a6a8a, 0x8a8a4a, 0x6a8a5a][(px >> 1) % 4];
    const broken = st < 0.35 && Math.abs(px - x - w / 2) < w / 2 - 2 && Math.abs(py - y - h / 2) < h / 2 - 2 + rdcHash(px, py, s) * 3;
    if (!broken) { if (((px - x) + (py - y)) % 11 < 2) c = o.tint || 0x8aa8b0; else if (st >= 0.35 && rdcHash(px, py, s) < 0.6 && !o.shelf) c = rdsMixI(c, o.tint || 0x5a7080, 0.45); }
    rdsPx(B, px, py, c, 1);
  }
  if (st > 0.35 && st < 0.55 && !o.noBoard) for (let k = 0; k < 3; k++) { const yy = y + 2 + k * Math.max(3, Math.floor(h / 3)); rdsRect(B, x - 2, yy, w + 4, 2, RDT_WOOD[k % 2], 1); rdsPx(B, x, yy, RDB_DARK, 1); rdsPx(B, x + w - 1, yy, RDB_DARK, 1); }
  if (o.bars) for (let px = x + 2; px < x + w; px += 3) rdsRect(B, px, y, 1, h, RDT_RAIL[3], 1);
  if (o.lit && st > 0.55 && rdsRand(s, x + 1) < o.lit) rdsLight(B, x + w / 2, y + h / 2, 'win', o.litC || '#ffcd75', Math.max(3, Math.round(w / 3)));
  (B.wins || (B.wins = [])).push([x, y, w, h]);
}
// 门：没搜过 = 关着（铁门 / 木门、把手）；搜过 = 开着（里面黑的，门板斜着）
function rdbDoor(B, x, w, h, open, R) {
  x = Math.round(x); w = Math.round(w); h = Math.round(h);
  rdsRect(B, x - 2, -h - 2, w + 4, h + 2, RDB_CON[4], 1);
  if (open) { rdsRect(B, x, -h, w, h, 0x141010, 1); rdsPoly(B, [[x, -h], [x + w * 0.35, -h + 3], [x + w * 0.35, -2], [x, 0]], (px, py, t) => rdsPick(R, 1.5 + t, px, py), 1); }
  else { for (let px = x; px < x + w; px++) for (let py = -h; py < 0; py++) rdsPx(B, px, py, rdsPick(R, 1.2 + ((px - x) % 6 === 5 ? 1.2 : 0) + (px >= x + w - 2 ? 0.8 : 0) + (rdcHash(px, py, 3) < 0.06 ? 0.7 : 0), px, py), 1); rdsRect(B, x + w - 5, -h / 2, 2, 2, 0xd8d0c0, 1); }
  B.door = x + w / 2;
}
// 招牌：边框 + 底色 + 图标 + 字块（有掉了的）+ 顶上一排灯泡
function rdbSign(B, x, y, w, h, R, icon, s, o) {
  o = o || {}; x = Math.round(x); y = Math.round(y);
  for (let px = x; px < x + w; px++) for (let py = y; py < y + h; py++) {
    const e = px === x || px === x + w - 1 || py === y || py === y + h - 1;
    rdsPx(B, px, py, e ? RDB_DARK : rdsPick(R, 0.8 + (py - y) / h * 1.4 + (rdcHash(px, py, s) < 0.05 ? 0.8 : 0) + (rdcNoise2(px / 6, py / 4, s) > 0.72 ? 1.2 : 0), px, py), 1);
  }
  const sc = Math.max(1, Math.floor((h - 4) / 7)), I = RDB_ICON[icon], ix = x + 3, iy = y + Math.floor((h - 7 * sc) / 2), fg = o.fg || 0xf4efe0;
  if (I) for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (I[r][c] === '#') rdsRect(B, ix + c * sc, iy + r * sc, sc, sc, fg, 1);
  const tx = ix + 7 * sc + 4, rows = h >= 14 ? 2 : 1;
  for (let r = 0; r < rows; r++) for (let k = 0; tx + k * 5 + 3 < x + w - 3; k++) if (rdcHash(k, r, s) > 0.18) rdsRect(B, tx + k * 5, y + 3 + r * Math.floor((h - 4) / rows), 3, Math.max(2, Math.floor((h - 6) / rows) - 1), fg, 1);
  if (o.bulbs) for (let px = x + 3; px < x + w - 2; px += 6) { rdsPx(B, px, y - 1, 0xfff0c0, 3); if (rdcHash(px, 0, s) > 0.3) rdsLight(B, px, y - 1, 'neon', '#ffe0a0', 2); }
  if (o.neon) rdsLight(B, x + w / 2, y + h / 2, 'neon', o.neon, Math.round(w / 4));
}
function rdbAwning(B, x0, x1, y, c1, c2, s) { for (let x = x0; x < x1; x++) { const torn = rdcNoise2(x / 7, 1, s) > 0.7; for (let r = 0; r < (torn ? 3 : 8); r++) rdsPx(B, x, y + r + (r > 5 ? (x & 1) : 0), (Math.floor((x - x0) / 6) & 1) ? c1 : c2, 1); rdsPx(B, x, y, rdsMixI(c1, 0xffffff, 0.3), 1); } }
function rdbBag(B, x, y, w, h, s) { rdtEllipse(B, x, y, w / 2, h / 2, (px, py, d, nx, ny) => rdsPx(B, px, py, rdsPick(rdsR(['#d4c08e', '#b8a070', '#968052', '#6e5c3a']), 1 + nx * 0.6 + ny + (d > 0.8 ? 0.7 : 0), px, py), 1)); }
function rdbBarrel(B, x, R, s) { rdsCol(B, x, 0, -18, 12, R, s, { bands: 6 }); rdsRect(B, x - 6, -19, 12, 1, R[0], 1); }
function rdbTires(B, x, n, s) { for (let k = 0; k < n; k++) rdtEllipse(B, x, -4 - k * 6, 9, 3.4, (px, py, d) => rdsPx(B, px, py, d < 0.25 ? 0x3e3630 : rdsPick(rdsR(['#4a423c', '#36302a', '#26201c']), 1 + d, px, py), 1)); }
// 橙色喷漆 X 记号（搜过了）+ 下面的点数
function rdbSpray(B, x, y, s) { for (let k = -5; k <= 5; k++) { rdsPx(B, x + k, y + k, 0xe86a2a, 1); rdsPx(B, x + k + 1, y + k, 0xe86a2a, 1); rdsPx(B, x - k, y + k, 0xe86a2a, 1); rdsPx(B, x - k + 1, y + k, 0xe86a2a, 1); if (rdcHash(k, 1, s) < 0.3) rdsPx(B, x + k, y + k + 2, 0xb04a1a, 1); } for (let d = 0; d < 3; d++) rdsRect(B, x - 4 + d * 4, y + 8, 2, 2, 0xe86a2a, 1); }
function rdbCarShape(B, x, len, R, s, f) { const X = (u) => x + u * f * len / 74; rdsPoly(B, [[-37, -9], [-35, -19], [-20, -21], [-12, -33], [14, -33], [24, -21], [36, -18], [38, -9], [38, -5], [-37, -5]].map((p) => [X(p[0]), p[1] * len / 74]), (px, py, t) => rdsPick(R, 0.4 + t * 2.6, px, py), 1); rdsPoly(B, [[-10, -31], [12, -31], [21, -22], [-17, -22]].map((p) => [X(p[0]), p[1] * len / 74]), RDB_DARK, 1); for (const wx of [-23, 24]) rdtEllipse(B, X(wx), -5 * len / 74, 7 * len / 74, 6 * len / 74, (px, py, d) => rdsPx(B, px, py, d < 0.25 ? 0x8a8070 : 0x2a221c, 1)); }

// ---------- 16 种建筑 ----------
// 返回值里的 fx：每帧要画的动画（位置相对建筑中心 / 脚下）
function rdbBuild(type, v, bi, open) {
  const S = RD_SITES[type], w = S.w * RD_Q, h = S.h * RD_Q, W = w + 160, UP = h + 130, cx = Math.round(W / 2), L = Math.round(cx - w / 2), Rr = L + w;
  const B = rdtPaper(W, UP, 14), s = (type.length * 131 + v * 17 + 3) | 0, fx = [];
  const sign = rdtRamp(rdMix(S.color, '#8a8070', 0.3)), R = (k) => rdsRand(s, k);
  if (type === 'gas') {
    const sw = Math.round(w * 0.42), sh = Math.round(h * 0.72);
    rdbWall(B, L, L + sw, -sh, 0, RDB_CON, 'concrete', s); rdbParapet(B, L, L + sw, -sh, RDB_CON, s);
    rdbWin(B, L + 8, -sh * 0.62, sw * 0.46, sh * 0.42, s, { shelf: true, lit: 0.6 });
    rdbDoor(B, L + sw - 30, 22, 40, open, RDT_RAIL);
    rdbSign(B, L + 6, -sh - 22, sw - 12, 16, sign, 'drop', s, { bulbs: true });
    const c0 = L + sw + 8, c1 = Rr + 10, sag = v ? 8 : 0;
    rdsPoly(B, [[c0, -h], [c1, -h + sag], [c1, -h + 13 + sag], [c0, -h + 13]], (px, py, t) => t > 0.62 ? sign[1 + (rdcHash(px, 0, s) < 0.1 ? 2 : 0)] : rdsPick(RDB_WHITE, 0.6 + t * 1.6 + (rdcNoise2(px / 9, py / 3, s) > 0.7 ? 1.5 : 0), px, py), 1);
    for (let x = c0 + 8; x < c1 - 4; x += 22) { rdsRect(B, x, -h + 14 + Math.round(sag * (x - c0) / (c1 - c0)), 8, 1, 0xf8f4e0, 3); rdsLight(B, x + 4, -h + 15, 'neon', '#f0f4ff', 5); }
    for (const px of [c0 + 10, c1 - 16]) for (let y = -h + 13; y < 0; y++) rdsPx(B, px, y, rdsPick(RDT_RAIL, 1, px, y), 1), rdsPx(B, px + 1, y, RDT_RAIL[2], 1), rdsPx(B, px + 2, y, RDT_RAIL[3], 1), rdsPx(B, px + 3, y, RDT_RAIL[4], 1);
    for (let k = 0; k < 2; k++) { const px = c0 + 34 + k * 46; rdsRect(B, px - 4, -6, 26, 6, RDB_CON[3], 1); for (let x = 0; x < 16; x++) for (let y = -38; y < -6; y++) rdsPx(B, px + x, y, rdsPick(sign, 1 + (x > 12 ? 1.2 : 0) + (y < -36 ? -0.6 : 0) + (rdcHash(px + x, y, s) < 0.07 ? 0.8 : 0), px + x, y), 1); rdsRect(B, px + 3, -33, 10, 6, RDB_DARK, 1); rdsRect(B, px + 4, -31, 2, 2, 0xe0a040, 3); rdsRect(B, px + 7, -31, 2, 2, 0xe0a040, 3); for (let t = 0; t < 14; t++) rdsPx(B, px + 16 + Math.sin(t / 4) * 3, -26 + t, RDB_DARK, 1); }
    const sx = Rr + 30; rdsRect(B, sx, -h - 50, 3, h + 50, RDT_RAIL[3], 1); rdbSign(B, sx - 20, -h - 86, 44, 36, sign, 'drop', s + 1, { neon: '#ff9050' });
    rdsRect(B, sx - 16, -h - 62, 36, 8, RDB_DARK, 1); for (let k = 0; k < 4; k++) if (R(k) > 0.25) rdsRect(B, sx - 13 + k * 8, -h - 60, 5, 4, 0xe0a040, 3);
  } else if (type === 'market') {
    rdbWall(B, L, Rr, -h, 0, RDB_CON, 'concrete', s); rdbParapet(B, L, Rr, -h, RDB_CON, s);
    rdbSign(B, cx - w * 0.3, -h + 6, w * 0.6, 22, sign, 'cart', s, { bulbs: true, neon: '#ff7050' });
    for (let k = 0; k < 4; k++) { const px = L + 10 + k * ((w - 20) / 4); if (k === 1 || k === 2) { if (k === 1) rdbDoor(B, px + (w - 20) / 4 - 22, 50, h * 0.5, open, rdsR(['#9ab0b8', '#7a8e96', '#5a6c74', '#3e4c52'])); continue; } rdbWin(B, px + 3, -h * 0.55, (w - 20) / 4 - 8, h * 0.5 - 4, s + k, { shelf: true, noBoard: true, lit: 0.5 }); }
    for (let k = 0; k < 2; k++) { const ax = L + 30 + k * (w - 80); rdsRect(B, ax, -h - 14, 28, 11, RDB_CON[2], 1); for (let x = 0; x < 28; x += 3) rdsRect(B, ax + x, -h - 12, 1, 7, RDB_CON[4], 1); }
    for (let k = 0; k < 2; k++) { const kx = Rr + 6 + k * 20, ky = 0; for (let x = 0; x < 16; x++) { rdsPx(B, kx + x, ky - 14, RDT_RAIL[2], 1); rdsPx(B, kx + x, ky - 6, RDT_RAIL[2], 1); } for (let x = 0; x < 16; x += 3) rdsLine(B, kx + x, ky - 14, kx + x + 1, ky - 6, RDT_RAIL[3], 1); rdsLine(B, kx - 4, ky - 18, kx, ky - 14, RDT_RAIL[3], 1); rdsRect(B, kx + 2, -3, 2, 2, RDB_DARK, 1); rdsRect(B, kx + 12, -3, 2, 2, RDB_DARK, 1); }
  } else if (type === 'pharmacy') {
    rdbWall(B, L, Rr, -h, 0, RDB_BRICK, 'brick', s); rdbParapet(B, L, Rr, -h, RDB_CON, s);
    rdbAwning(B, L + 6, Rr - 50, -h * 0.62, 0x5a9a6a, 0xe8e4d8, s);
    rdbWin(B, L + 14, -h * 0.5, w * 0.42, h * 0.38, s, { shelf: true, bars: true, lit: 0.4 });
    rdbDoor(B, Rr - 44, 22, 44, open, rdsR(['#6a9a7a', '#4a7a5a', '#365a42', '#22382a']));
    rdsRect(B, L + 2, -h + 10, 14, 3, RDT_RAIL[3], 1); rdbSign(B, L - 18, -h + 13, 24, 24, rdsR(['#f4f0e4', '#dcd6c8', '#b8b2a4']), 'cross', s, { fg: 0x3aa860, neon: '#60ff90' });
    rdbSign(B, L + 20, -h + 8, w - 40, 14, rdsR(['#4a8a5a', '#3a7048', '#2a5434', '#1e3c26']), null, s + 2, {});
  } else if (type === 'garage') {
    const top = -h * 0.86;
    rdbWall(B, L, Rr, top, 0, v ? RDT_RUST : RDT_RAIL, 'metal', s); rdsPoly(B, [[L - 4, top], [Rr + 4, top], [Rr + 4, top - 4], [cx, top - 16], [L - 4, top - 4]], (px, py, t) => rdsPick(RDT_RUST, 0.5 + t * 2, px, py), 1);
    for (let k = 0; k < 2; k++) { const dx = L + 12 + k * 74, dw = 64, dh = Math.round(h * 0.56), half = (k === 0 && open) || (k === 1 && v === 1);
      for (let x = dx; x < dx + dw; x++) for (let y = -dh; y < 0; y++) { const up = half && y > -dh * 0.45; rdsPx(B, x, y, up ? (y > -6 && Math.abs(x - dx - dw / 2) < 20 ? 0x3a3430 : 0x161210) : rdsPick(RDT_RAIL, 1.2 + ((y + dh) % 5 === 4 ? 1.4 : 0) + (rdcHash(x, y, s) < 0.05 ? 0.8 : 0), x, y), 1); }
      if (half) { rdsRect(B, dx + 14, -24, 3, 24, 0xc0a040, 1); rdsRect(B, dx + 46, -24, 3, 24, 0xc0a040, 1); rdsRect(B, dx + 10, -26, 44, 3, 0xd0b050, 1); } }
    B.door = L + 44;
    rdbWin(B, Rr - 54, -h * 0.6, 40, 24, s, { lit: 0.5 }); rdbSign(B, L + 30, top - 24, w - 60, 18, sign, 'wrench', s, {});
    rdbTires(B, Rr + 14, 4, s); rdbBarrel(B, Rr + 36, RDT_RUST, s); rdbBarrel(B, L - 14, rdsR(['#c86a48', '#a04a30', '#783220', '#4e2012']), s + 1);
  } else if (type === 'police') {
    rdbWall(B, L, Rr, -h, 0, v ? RDB_BRICK : RDB_CON, v ? 'brick' : 'concrete', s); rdbParapet(B, L, Rr, -h, RDB_CON, s);
    rdsRect(B, L, -h * 0.52, w, 6, 0x3a5a9a, 1); rdsRect(B, L, -h * 0.52 + 6, w, 1, 0x22325a, 1);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) { if (r === 1 && k === 2) continue; rdbWin(B, L + 12 + k * (w - 24) / 5, -h + 14 + r * h * 0.5, 22, 22, s + r * 7 + k, { bars: true, lit: 0.35 }); }
    rdbDoor(B, cx - 14, 28, 50, open, rdsR(['#6a7a9a', '#4a5a7a', '#34405a', '#222a3c'])); rdsRect(B, cx - 22, -2, 44, 2, RDB_CON[1], 1);
    rdbSign(B, cx - 40, -h * 0.52 - 20, 80, 16, rdsR(['#4a6aaa', '#3a5490', '#2a3e70', '#1e2c50']), 'star', s, { fg: 0xf0d070 });
    rdsRect(B, Rr - 20, -h - 60, 2, 60, RDT_RAIL[2], 1); fx.push({ k: 'flag', x: Rr - 18 - cx, y: -h - 58, c: '#3a5a9a', c2: '#e8e4d8' });
    for (let b = 0; b < 4; b++) rdbBag(B, cx + 30 + b * 10, -4, 12, 7, s + b); for (let b = 0; b < 3; b++) rdbBag(B, cx + 35 + b * 10, -10, 12, 7, s + b + 5);
    rdbCarShape(B, L - 6, 70, RDB_WHITE, s, 1); rdsRect(B, L - 18, -25, 22, 4, RDB_DARK, 1); rdsRect(B, L - 14, -20, 20, 4, 0x2a3e70, 1); fx.push({ k: 'police', x: L - 12 - cx, y: -26 });
  } else if (type === 'military') {
    const camo = (px, py) => [0x5a6a3a, 0x4a5a30, 0x6a6a46, 0x3a4226][Math.floor(rdcNoise2(px / 9, py / 7, s) * 3.99)];
    const kx = L + 20, kw = 120; for (let x = kx; x < kx + kw; x++) for (let y = -60; y < 0; y++) rdsPx(B, x, y, (x - kx) % 12 === 0 ? 0x2e3420 : camo(x, y), 1);
    for (let x = kx - 6; x < kx + kw + 10; x++) for (let y = -72; y < -60; y++) if (rdcHash(x >> 1, y >> 1, s) < 0.55 + (y + 72) / 30) rdsPx(B, x, y + Math.round(Math.sin(x / 9) * 2), camo(x, y), 1);
    for (let p = 0; p < 5; p++) { const sx = kx + 12 + p * 24; const pts = []; for (let a = 0; a < 10; a++) { const an = -Math.PI / 2 + a / 10 * 6.283, r = a % 2 ? 3 : 7; pts.push([sx + 10 + Math.cos(an) * r, -34 + Math.sin(an) * r]); } if (p === 2) rdsPoly(B, pts, 0xd8d0a8, 1); }
    for (let r = 0; r < 3; r++) for (let b = 0; b < 6 - r; b++) rdbBag(B, kx + kw + 18 + b * 12 + r * 6, -4 - r * 7, 13, 7, s + r * 9 + b);
    for (let k = 0; k < 120; k++) { const a = k * 0.5; rdsPx(B, kx + kw + 14 + k * 0.7, -26 + Math.sin(a) * 4, 0x6a6a60, 2); }
    const gx = Rr - 70; rdsRect(B, gx, -40, 26, 40, RDB_CON[2], 1); rdbWin(B, gx + 5, -34, 16, 12, s, { lit: 0.6, noBoard: true }); rdsRect(B, gx - 2, -44, 30, 4, 0x4a5a30, 1); B.door = gx + 13;
    for (let x = gx + 28; x < gx + 100; x++) for (let y = -24; y < -19; y++) rdsPx(B, x, y, (((x >> 3) & 1) ? 0xd84a3a : 0xece6d8), 1); rdsRect(B, gx + 26, -28, 6, 28, RDB_CON[3], 1);
    const tx = L - 6; for (const d of [-12, 12]) rdsLine(B, tx + d, 0, tx + d * 0.6, -110, RDT_WOOD[2], 1); rdsLine(B, tx - 12, -20, tx + 10, -60, RDT_WOOD[3], 1); rdsLine(B, tx + 12, -20, tx - 10, -60, RDT_WOOD[3], 1);
    rdsRect(B, tx - 18, -112, 36, 4, RDT_WOOD[1], 1); for (let x = tx - 18; x < tx + 18; x++) for (let y = -126; y < -112; y++) if ((x - tx + 18) % 6 < 2 || y > -116) rdsPx(B, x, y, RDT_WOOD[2], 1); rdsPoly(B, [[tx - 22, -128], [tx, -140], [tx + 22, -128]], 0x4a5a30, 1);
    fx.push({ k: 'beam', x: tx + 12 - cx, y: -122 });
  } else if (type === 'house') {
    const pa = [rdsR(['#b8ccc0', '#96aa9e', '#74887c', '#566a5e', '#3e4e44']), rdsR(['#e8d8a8', '#c8b484', '#a08c60', '#786842', '#54482e'])][v], top = -Math.round(h * 0.72), rh = Math.round(w * 0.36);
    rdbWall(B, L, Rr, top, 0, pa, 'siding', s);
    rdsPoly(B, [[L - 8, top + 1], [cx, top - rh], [Rr + 8, top + 1]], (px, py, t) => rdsPick(RDS_PAL[1].roof, (((py + 400) % 5) === 0 ? 2 : 0.6) + (px > cx ? 0.9 : 0) + (rdcHash(px >> 2, py, s) < 0.1 ? 0.8 : 0), px, py), 1);
    if (v === 1) rdsPoly(B, [[cx + 16, top - rh + 18], [cx + 44, top - rh + 40], [cx + 30, top - rh + 44]], 0x161210, 1); // 屋顶破洞
    const chx = cx + Math.round(w * 0.22); rdbWall(B, chx, chx + 12, top - rh * 0.85, top - rh * 0.3, RDB_BRICK, 'brick', s);
    rdbWin(B, L + 16, top + 12, 22, 24, s, { lit: 0.5, litC: '#ff9a50' }); rdbWin(B, Rr - 38, top + 12, 22, 24, s + 1, { lit: 0.5, litC: '#ff9a50' }); rdbWin(B, cx - 9, top - rh * 0.45, 18, 16, s + 2, {});
    rdbWin(B, L + 16, -h * 0.4, 22, 24, s + 3, { lit: 0.4, litC: '#ff9a50' });
    rdbDoor(B, cx + 6, 22, 44, open, RDT_WOOD);
    rdsRect(B, cx - 6, -54, 58, 4, RDS_PAL[1].roof[1], 1); for (const px of [cx - 4, cx + 46]) rdsRect(B, px, -50, 3, 50, RDB_WHITE[1], 1); rdsRect(B, cx - 8, -2, 62, 2, RDT_WOOD[2], 1);
    for (let x = Rr + 6; x < Rr + 56; x += 6) if (R(x) > 0.25) { rdsRect(B, x, -16 + (R(x + 1) < 0.2 ? 6 : 0), 3, 16, RDB_WHITE[1 + (x % 12 === 0 ? 1 : 0)], 1); rdsPx(B, x + 1, -17, RDB_WHITE[0], 1); } rdsRect(B, Rr + 6, -11, 50, 2, RDB_WHITE[2], 1);
    rdsRect(B, L - 14, -18, 2, 18, RDT_WOOD[2], 1); rdsRect(B, L - 20, -24, 12, 7, 0x6a7a8a, 1);
    if (v === 0) fx.push({ k: 'smoke', x: chx + 6 - cx, y: top - rh * 0.85, thin: 1 });
  } else if (type === 'electro') {
    rdbWall(B, L, Rr, -h, 0, RDB_CON, 'concrete', s); rdbParapet(B, L, Rr, -h, RDB_CON, s);
    for (let x = L + 8; x < Rr - 8; x++) for (let y = -h + 30; y < -h * 0.5; y++) { const gx = (x - L - 8) % 20, gy2 = (y + h - 30) % 16; let c = gx < 2 || gy2 < 2 ? RDB_CON[3] : (((x + y) % 13) < 3 ? 0xa8d0dc : 0x3a6a7a); if (rdcNoise2(x / 14, y / 10, s) > 0.68 && gx >= 2 && gy2 >= 2) c = RDB_DARK; rdsPx(B, x, y, c, 1); }
    rdbSign(B, cx - w * 0.28, -h + 6, w * 0.56, 20, sign, 'bolt', s, { bulbs: true, fg: 0xf0e060, neon: '#60e0ff' });
    rdbWin(B, L + 12, -h * 0.42, w * 0.5, h * 0.34, s, { noBoard: true });
    const tvs = []; for (let k = 0; k < 4; k++) { const tx = L + 18 + k * Math.floor(w * 0.5 / 4), ty = -h * 0.36; rdsRect(B, tx, ty, Math.floor(w * 0.5 / 4) - 8, 16, 0x2a2a2a, 1); tvs.push([tx + 2 - cx, Math.round(ty) + 2, Math.floor(w * 0.5 / 4) - 12, 12]); } fx.push({ k: 'tv', list: tvs });
    rdbDoor(B, Rr - 64, 44, h * 0.42, open, rdsR(['#9ab0b8', '#7a8e96', '#5a6c74', '#3e4c52']));
    const dx = Rr - 40; rdsRect(B, dx, -h - 18, 3, 18, RDT_RAIL[3], 1); rdtEllipse(B, dx - 4, -h - 26, 12, 9, (px, py, d, nx) => nx < 0.3 && rdsPx(B, px, py, rdsPick(RDB_WHITE, 1 + nx + d, px, py), 1));
  } else if (type === 'furniture') {
    const top = -Math.round(h * 0.88);
    rdbWall(B, L, Rr, top, 0, v ? RDT_RAIL : rdsR(['#d8c8a8', '#bcaa88', '#9c8a6a', '#7a6a4e', '#584a34']), v ? 'metal' : 'concrete', s); rdbParapet(B, L, Rr, top, RDB_CON, s);
    rdbSign(B, L + 20, top - 34, w * 0.62, 30, sign, 'chair', s, { bulbs: true, neon: '#ffa050' });
    for (let x = Rr - 80; x < Rr - 16; x++) for (let y = -h * 0.55; y < 0; y++) rdsPx(B, x, y, open && y > -h * 0.3 ? 0x161210 : rdsPick(RDT_RAIL, 1.2 + ((Math.round(y) + 400) % 5 === 4 ? 1.4 : 0), x, y), 1); B.door = Rr - 48;
    rdsRect(B, Rr - 84, -4, 72, 4, RDB_CON[3], 1);
    rdbWin(B, L + 16, -h * 0.5, 70, 40, s, { shelf: true, lit: 0.4 });
    const so = L + 100; for (let x = so; x < so + 50; x++) for (let y = -18; y < 0; y++) { const arm = x < so + 6 || x >= so + 44; if (!arm && y < -12) continue; rdsPx(B, x, y, rdsPick(rdsR(['#a86a5a', '#88503e', '#6a3a2c', '#4a2820']), 1 + (y > -6 ? 1 : 0) + ((x - so) % 13 === 0 ? 0.8 : 0), x, y), 1); }
    for (let m = 0; m < 3; m++) for (let x = Rr + 8; x < Rr + 56; x++) for (let y = -8 - m * 9; y < -m * 9; y++) rdsPx(B, x + m * 3, y, (y === -8 - m * 9) ? 0xf0ece0 : (((x >> 2) & 1) ? 0xd8d0c0 : 0x8aa0b8), 1);
  } else if (type === 'factory') {
    const top = -Math.round(h * 0.72);
    rdbWall(B, L, Rr, top, 0, RDB_BRICK, 'brick', s);
    for (let t = L; t < Rr - 10; t += 36) rdsPoly(B, [[t, top], [t, top - 26], [t + 36, top]], (px, py) => (px - t < 4 ? (((px + py) % 5) < 2 ? 0x9ab8c0 : 0x3a5a62) : rdsPick(RDT_RAIL, 1.5 + (px - t) / 36, px, py)), 1);
    for (let k = 0; k < 6; k++) { const wx = L + 12 + k * (w - 24) / 6, wy = top + 18, ww = 22, wh = 46; rdbWin(B, wx, wy, ww, wh, s + k, { noBoard: k % 3 !== 1, lit: 0.2 }); rdtEllipse(B, wx + ww / 2, wy, ww / 2 + 1, 6, (px, py, d, nx, ny) => ny < 0 && rdsPx(B, px, py, d > 0.6 ? RDB_BRICK[3] : RDB_DARK, 1)); }
    rdbDoor(B, cx - 22, 44, 50, open, RDT_RAIL);
    const chx = Rr - 30; for (let y = top - 110; y < top; y++) { const ww = 14 + Math.round((y - top + 110) / 22); for (let x = -ww / 2; x < ww / 2; x++) rdsPx(B, chx + x, y, (((y - top) >> 4) & 1) && y < top - 70 ? rdsPick(RDB_WHITE, 1.5 + x / ww * 2, chx + x, y) : rdsPick(RDB_BRICK, 1.3 + x / ww * 2.4 + ((y & 3) === 3 ? 0.8 : 0), chx + x, y), 1); }
    fx.push({ k: 'smoke', x: chx - cx, y: top - 112 });
    rdsStroke(B, L - 4, -30, Rr - 50, -30, 3, 3, RDT_RUST, 1, s); rdsStroke(B, L + 40, -30, L + 40, top - 6, 3, 3, RDT_RUST, 1, s);
    rdbSign(B, L + 20, top - 46, 70, 16, sign, 'gear', s, {});
    const wt = L - 30; for (const d of [-10, 10]) rdsLine(B, wt + d, 0, wt + d * 0.7, -70, RDT_RUST[2], 1); rdsCol(B, wt, -70, -96, 30, RDT_RUST, s, { bands: 8 });
  } else if (type === 'farm') {
    const bw = Math.round(w * 0.62), bx = L, top = -Math.round(h * 0.62), red = rdsR(['#d0745a', '#b05640', '#8a3e2e', '#662c20', '#441c14']);
    rdbWall(B, bx, bx + bw, top, 0, red, 'wood', s);
    rdsPoly(B, [[bx - 6, top + 1], [bx + bw * 0.12, top - 30], [bx + bw / 2, top - 46], [bx + bw * 0.88, top - 30], [bx + bw + 6, top + 1]], (px, py, t) => rdsPick(RDS_PAL[1].roof, 0.5 + t * 1.5 + (((py + 400) % 5) === 0 ? 1 : 0) + (px > bx + bw / 2 ? 0.8 : 0), px, py), 1);
    const dx = bx + bw / 2 - 26; for (let x = dx; x < dx + 52; x++) for (let y = -56; y < 0; y++) { const e = x === dx || x === dx + 51 || y === -56 || Math.abs((x - dx) - (y + 56) * 52 / 56) < 2 || Math.abs((x - dx) - (52 - (y + 56) * 52 / 56)) < 2; rdsPx(B, x, y, open && x < dx + 26 ? 0x161210 : e ? 0xece6d8 : rdsPick(red, 1.6 + ((x - dx) % 7 === 6 ? 1 : 0), x, y), 1); } B.door = dx + 26;
    rdsRect(B, bx + bw / 2 - 10, top - 26, 20, 18, RDB_DARK, 1); rdsRect(B, bx + bw / 2 - 11, top - 27, 22, 1, 0xece6d8, 1);
    const sx = bx + bw + 30; rdsCol(B, sx, 0, -h * 1.05, 34, RDT_RAIL, s, { bands: 10 }); rdtEllipse(B, sx, -h * 1.05, 17, 12, (px, py, d, nx, ny) => ny < 0 && rdsPx(B, px, py, rdsPick(RDT_RAIL, 0.5 + nx + d, px, py), 1));
    const wx = Rr + 30; rdsLattice(B, wx, 20, 5, 110, RDT_RUST[2], 1); fx.push({ k: 'mill', x: wx - cx, y: -114 });
    for (let k = 0; k < 3; k++) { const hx = sx + 28 + k * 18; rdtEllipse(B, hx, -8, 9, 8, (px, py, d, nx, ny) => rdsPx(B, px, py, rdsPick(rdsR(['#f0d890', '#d8b868', '#b09048', '#86682e']), 1 + nx + ny * 0.5 + (((px + py) % 4) === 0 ? 0.6 : 0), px, py), 1)); }
  } else if (type === 'rvpark') {
    for (let k = 0; k < 2; k++) {
      const rx = L + 10 + k * 128, rw = 108 - k * 14, rh = 50 - k * 4, st = [0x5a8aa0, 0xc06a4a][k];
      for (let x = rx; x < rx + rw; x++) for (let y = -rh - 8; y < -8; y++) { const yy = y + rh + 8; if ((x - rx < 6 && yy < 6 - (x - rx)) || (rx + rw - x < 6 && yy < 6 - (rx + rw - x))) continue; rdsPx(B, x, y, Math.abs(yy - rh * 0.55) < 3 ? st : rdsPick(RDB_WHITE, 0.6 + yy / rh * 1.6 + (rdcHash(x, y, s) < 0.05 ? 0.8 : 0), x, y), 1); }
      rdbWin(B, rx + 10, -rh + 4, 20, 12, s + k, { lit: 0.6, noBoard: true }); rdbWin(B, rx + rw - 30, -rh + 4, 18, 12, s + k + 3, { noBoard: true });
      if (k === 0) rdbDoor(B, rx + 44, 16, rh - 12, open, RDB_WHITE); rdtEllipse(B, rx + rw * 0.65, -7, 8, 7, (px, py, d) => rdsPx(B, px, py, d < 0.3 ? 0x8a8070 : 0x2a221c, 1));
      rdbAwning(B, rx + 30, rx + 80, -rh - 4, 0xe8a040, 0xe8e4d8, s + k);
    }
    const kx = Rr - 22; rdsRect(B, kx, -60, 30, 60, RDB_CON[2], 1); rdbWin(B, kx + 6, -48, 18, 14, s + 9, { lit: 0.6 }); rdbSign(B, kx - 6, -76, 42, 14, sign, 'car', s, {});
    for (let x = L; x < Rr; x++) { const t = (x - L) / (w / 3) % 1, y = -84 + Math.round(Math.sin(t * Math.PI) * 10); rdsPx(B, x, y, RDB_DARK, 2); if ((x - L) % 14 === 7) { rdsPx(B, x, y + 1, [0xffd070, 0xff8070, 0x80d0ff][Math.floor((x - L) / 14) % 3], 3); rdsLight(B, x, y + 1, 'neon', ['#ffd070', '#ff8070', '#80d0ff'][Math.floor((x - L) / 14) % 3], 2); } }
    for (const px of [L, L + w / 3, L + 2 * w / 3, Rr]) rdsRect(B, px, -86, 2, 86, RDT_WOOD[2], 1);
  } else if (type === 'junkyard') {
    for (let x = L; x < Rr; x++) { if (x > cx - 26 && x < cx + 26) continue; const sheet = Math.floor((x - L) / 22), hh = 52 + Math.round(rdcHash(sheet, 0, s) * 10); const Rm = [RDT_RUST, RDT_RAIL, rdsR(['#8aa0a8', '#6a8088', '#4e6068', '#36444a'])][sheet % 3]; for (let y = -hh; y < 0; y++) rdsPx(B, x, y, rdsPick(Rm, 1 + [-0.6, 0, 0.5, 1, 0.5, 0][(x - L) % 6] + (rdcHash(x, y, s) < 0.06 ? 0.8 : 0) + (rdcNoise2(x / 8, y / 8, s) > 0.7 ? 0.8 : 0), x, y), 1); }
    B.door = cx;
    for (let st = 0; st < 3; st++) for (let k = 0; k < 3; k++) { const sx = L + 30 + st * 90 + (k % 2) * 6, sy = -52 - k * 16, col = rdtRamp(['#6a88a0', '#a05a48', '#c8b890', '#5a7a4a', '#8a6aa0'][(st * 3 + k) % 5]); for (let x = 0; x < 60; x++) for (let y = 0; y < 15; y++) rdsPx(B, sx + x, sy + y, y > 4 && y < 9 && x > 14 && x < 40 ? RDB_DARK : rdsPick(col, 1 + y / 15 * 1.6 + (rdcHash(sx + x, y, s) < 0.12 ? 1 : 0), sx + x, sy + y), 1); }
    const kx = Rr + 10; rdsRect(B, kx - 14, -24, 30, 24, 0xc0a040, 1); rdbWin(B, kx - 10, -20, 12, 10, s, { noBoard: true }); rdsLine(B, kx, -24, kx + 50, -120, 0xc0a040, 1); rdsLine(B, kx + 4, -24, kx + 54, -120, 0xb09030, 1); for (let k = 0; k < 10; k++) rdsLine(B, kx + k * 5, -24 - k * 9.6, kx + 4 + (k + 1) * 5, -24 - (k + 1) * 9.6, 0x8a7020, 1);
    fx.push({ k: 'magnet', x: kx + 52 - cx, y: -120 });
    rdbSign(B, cx - 24, -66, 48, 14, sign, 'car', s, {}); rdbTires(B, L - 14, 5, s);
  } else if (type === 'lab') {
    rdbWall(B, L, Rr, -h * 0.82, 0, RDB_WHITE, 'concrete', s); rdbParapet(B, L, Rr, -h * 0.82, RDB_WHITE, s);
    for (let x = L; x < Rr; x++) for (let y = -h * 0.82 + 6; y < -h * 0.82 + 12; y++) rdsPx(B, x, y, ((x + y) >> 2) & 1 ? 0xe0c040 : 0x2e2a20, 1);
    rdtEllipse(B, cx - 20, -h * 0.82, 40, 34, (px, py, d, nx, ny) => ny < 0 && rdsPx(B, px, py, Math.abs(nx) < 0.08 && ny < -0.2 ? RDB_DARK : rdsPick(RDB_WHITE, 0.5 + nx * 1.4 + (d > 0.85 ? 0.8 : 0), px, py), 1));
    for (let k = 0; k < 6; k++) rdbWin(B, L + 10 + k * (w - 20) / 6, -h * 0.6, 26, 18, s + k, { tint: 0x80c0d0, lit: 0.45, litC: '#a0e8ff', noBoard: k !== 4 });
    rdbDoor(B, Rr - 56, 40, 40, open, rdsR(['#b8d0d8', '#94acb4', '#708890', '#4e6268']));
    const ax = Rr - 16; rdsLattice(B, ax, 10, 3, h * 0.82 + 60, RDT_RAIL[3], 1); rdsLight(B, ax, -h * 0.82 - 62, 'blink', '#ff5038', 3);
    rdsPoly(B, [[L + 40, -40], [L + 52, -18], [L + 28, -18]], 0xe0c040, 1); rdsRect(B, L + 39, -33, 2, 7, RDB_DARK, 1); rdsPx(B, L + 39, -23, RDB_DARK, 1);
    rdbSign(B, L + 60, -36, 50, 14, rdsR(['#d8e4ec', '#b8c8d0', '#94a8b4']), 'flask', s, { fg: 0x3a7a9a });
    for (let x = Rr + 6; x < Rr + 60; x++) for (let y = -40; y < 0; y++) if ((((x + y) % 5) + 5) % 5 === 0 || (((x - y) % 5) + 5) % 5 === 0) rdsPx(B, x, y, 0x8a8c84, 2);
  } else if (type === 'camp') { // 幸存者营地：废铁皮 + 木头围墙（顶上削尖）、敞开的大门、瞭望台、帐篷顶、旗子、篝火、守卫
    const gate0 = cx - 24, gate1 = cx + 24;
    for (let x = L; x < Rr; x++) { if (x >= gate0 && x < gate1) continue; const sheet = Math.floor((x - L) / 16), log = sheet % 3 === 1, hh = 56 + Math.round(rdcHash(sheet, 3, s) * 14);
      const Rm = log ? RDT_WOOD : [RDT_RUST, RDT_RAIL, rdsR(['#7a9a8a', '#5a7a6a', '#3e5a4e', '#2a3e36'])][sheet % 3];
      const tip = log ? Math.abs(((x - L) % 16) - 8) : 0;
      for (let y = -hh + tip; y < 0; y++) rdsPx(B, x, y, rdsPick(Rm, 1 + (log ? (((x - L) % 4) === 3 ? 1.2 : 0) : [-0.5, 0, 0.6, 1][(x - L) % 4]) + (rdcHash(x, y, s) < 0.07 ? 0.8 : 0), x, y), 1);
      if (!log && (x - L) % 16 === 3) for (const ry of [-hh + 4, -10]) rdsPx(B, x, ry, 0xd8d0c0, 1); }
    for (const gx of [gate0 - 4, gate1]) rdsRect(B, gx, -78, 4, 78, RDT_WOOD[2], 1); rdsRect(B, gate0 - 4, -80, 52, 4, RDT_WOOD[1], 1);
    rdsPoly(B, [[gate0, 0], [gate0 - 18, -6], [gate0 - 18, -58], [gate0, -64]], (px, py, t) => rdsPick(RDT_WOOD, 1.4 + (px % 5 === 0 ? 1 : 0), px, py), 1); // 大门敞开
    rdbSign(B, gate0 - 2, -96, 52, 14, rdsR(['#e8d8a8', '#c8b484', '#a08c60']), null, s, { fg: 0x3a2a20 }); B.door = cx;
    for (let k = 0; k < 3; k++) { const tx = L + 30 + k * 90 + (k === 1 ? 40 : 0); rdsPoly(B, [[tx - 26, -54], [tx, -84], [tx + 26, -54]], (px, py, t) => rdsPick(k === 1 ? rdsR(['#9ab070', '#7a9050', '#5a7038', '#3e5026']) : RDC_PAL.canvas.map(rdsC), 0.8 + (px > tx ? 1.2 : 0) + t, px, py), 1); }
    const wt = Rr - 20; for (const d of [-10, 10]) rdsLine(B, wt + d, 0, wt + d * 0.6, -100, RDT_WOOD[2], 1); rdsRect(B, wt - 16, -104, 32, 4, RDT_WOOD[1], 1); for (let x = wt - 16; x < wt + 16; x += 4) rdsRect(B, x, -116, 2, 12, RDT_WOOD[2], 1); rdsPoly(B, [[wt - 20, -118], [wt, -128], [wt + 20, -118]], RDT_RUST[1], 1);
    rdsRect(B, L + 8, -130, 2, 130, RDT_WOOD[3], 1); fx.push({ k: 'flag', x: L + 10 - cx, y: -128, c: '#e8b040', c2: '#3a8a5a' });
    for (let x = L; x < Rr; x++) { const t = (x - L) / (w / 4) % 1, y = -70 + Math.round(Math.sin(t * Math.PI) * 8); rdsPx(B, x, y, RDB_DARK, 2); if ((x - L) % 12 === 6) { rdsPx(B, x, y + 1, 0xffd070, 3); rdsLight(B, x, y + 1, 'win', '#ffd070', 2); } }
    rdbBarrel(B, gate1 + 14, rdsR(['#6a8aa0', '#4a6a80', '#344e60', '#22343e']), s);
    fx.push({ k: 'fire', x: gate0 - 40 - cx, y: 0 }, { k: 'people', x: 0, y: 0, pts: [gate0 - 60 - cx, gate1 + 34 - cx, wt - cx] });
    rdsLight(B, gate0 - 40, -6, 'glow', '#ffa040', 10);
  } else { // 外星坠落舱：斜插在土堆里的金属舱，发光的接缝和符文，舱门（搜过后打开发光）
    const pcx = cx, pcy = -50, rx = 80, ry = 44, an = -0.32, ca = Math.cos(an), sa = Math.sin(an), H = RDS_PAL[5].hull;
    for (let y = pcy - 70; y < 10; y++) for (let x = pcx - 100; x < pcx + 100; x++) {
      const dx = x - pcx, dy = y - pcy, u = (dx * ca + dy * sa) / rx, vv = (-dx * sa + dy * ca) / ry, taper = u > 0 ? 1 - u * 0.35 : 1, d = u * u + (vv / taper) * (vv / taper);
      if (d > 1 || y > 4) continue;
      let c = rdsPick(H, 1.2 + vv * 1.6 - u * 0.3 + (d > 0.85 ? 0.8 : 0) + (rdcHash(x, y, s) < 0.04 ? 0.6 : 0), x, y), m = 1;
      if (Math.abs(((u + 1) * 7) % 1 - 0.5) < 0.04 && d < 0.9) c = H[4];
      if (Math.abs(vv) < 0.06 && u > -0.8 && u < 0.7) { c = RDS_PAL[5].glow; m = 3; }
      if (Math.abs(u + 0.3) < 0.03 && Math.abs(vv) < 0.7) { c = RDS_PAL[5].glow; m = 3; }
      if (u > -0.15 && u < 0.2 && vv > 0.1 && vv < 0.55) { c = open ? (vv > 0.3 ? 0x2a1a40 : 0xa0f8ff) : rdsPick(H, 2.4 + (Math.abs(u - 0.02) < 0.02 ? 1 : 0), x, y); if (open) m = 3; }
      rdsPx(B, x, y, c, m);
    }
    for (let k = 0; k < 5; k++) rdsLight(B, pcx - 60 + k * 30, pcy + 14 - k * 9, 'glow', '#73eff7', 5);
    if (open) rdsLight(B, pcx + 4, pcy + 14, 'glow', '#a0f8ff', 10);
    B.door = pcx + 4;
    for (let x = L - 30; x < Rr + 30; x++) { const hh = Math.max(0, 26 * (1 - Math.pow((x - cx) / (w / 2 + 30), 2))) + rdcHash(x >> 2, 0, s) * 4; for (let y = -Math.round(hh); y < 2; y++) if (!rdsHas(B, x, y) || y > -hh * 0.5) rdsPx(B, x, y, rdsPick(RDS_PAL[5].rock, 1 + (y + hh) / Math.max(1, hh) * 1.5 + (rdcHash(x, y, s) < 0.08 ? 0.8 : 0), x, y), 1); }
    for (let c = 0; c < 6; c++) rdsCrystal(B, L - 10 + c * (w + 20) / 5, -8, 12 + R(c) * 26, -Math.PI / 2 + (R(c + 9) - 0.5) * 1.2, 6, RDS_PAL[5].cry, s + c);
    for (let k = 0; k < 6; k++) { const a = -0.6 + k * 0.25, L2 = 40 + R(k + 20) * 50; for (let t = 0; t < L2; t++) if (rdcHash(t, k, s) < 0.6) rdsPx(B, pcx + 80 + Math.cos(a) * t, 2 - t * 0.05, 0x1a1420, 2); } // 焦痕
    fx.push({ k: 'steam', x: -40, y: pcy - 10 }, { k: 'steam', x: 50, y: pcy - 34 });
  }
  // ---- 地区特色：沙堆 / 藤蔓青苔 / 毒绿污渍 / 积雪 / 水晶 ----
  if (bi === 0) for (let k = 0; k < 4; k++) rdtEllipse(B, L + R(40 + k) * w, 0, 20 + R(44 + k) * 30, 8 + R(48 + k) * 8, (px, py, d, nx, ny) => py <= 0 && rdsPx(B, px, py, rdsPick(rdtRamp(RD_BIOMES[0].ground), 1 + nx * 0.6 + (ny + 1), px, py), 2));
  if (bi === 2 || bi === 1) for (let x = L; x < Rr + 40; x += 1) { if (rdcNoise2(x / 14, 3, s) < (bi === 2 ? 0.5 : 0.7)) continue; let y = -UP + 1; while (y < 0 && rdtGetPx(B, x, y) < 0) y++; const len = 6 + rdcHash(x, 1, s) * (bi === 2 ? 50 : 24); for (let k = 0; k < len && y + k < 0; k++) if (rdtGetPx(B, x, y + k) >= 0) rdsPx(B, x, y + k, RDT_MOSS[(k + x) % 3], 1); }
  if (bi === 3) for (let k = 0; k < 6; k++) rdtEllipse(B, L + R(60 + k) * w, -R(66 + k) * h * 0.8, 10 + R(70 + k) * 20, 6 + R(74 + k) * 10, (px, py, d) => { const c = rdtGetPx(B, px, py); if (c >= 0 && rdcHash(px, py, s) > d) rdsPx(B, px, py, rdsMixI(c, RDS_PAL[3].tox, 0.22), 1); });
  if (bi === 5 && type !== 'alien') for (let c = 0; c < 4; c++) rdsCrystal(B, L + R(80 + c) * w, 0, 14 + R(84 + c) * 30, -Math.PI / 2 + (R(88 + c) - 0.5), 6, RDS_PAL[5].cry, s + c);
  if (open && type !== 'camp' && type !== 'alien') rdbSpray(B, (B.door || cx) + 34, -h * 0.45, s);
  rdcOutline(B);
  if (bi === 4) { rdtSnowCap(B); for (let k = 0; k < 4; k++) rdtEllipse(B, L + R(90 + k) * w, 0, 24 + R(94 + k) * 30, 7 + R(98 + k) * 7, (px, py, d, nx, ny) => py <= 0 && rdsPx(B, px, py, rdsPick(RDS_PAL[4].snow, ny < -0.5 ? 0 : 1 + nx * 0.5, px, py), 2)); }
  return { cv: rdsToCanvas(B), cx, up: UP, lights: B.lights, wins: (B.wins || []).map((q) => [q[0] - cx, q[1], q[2], q[3]]), door: (B.door || cx) - cx, fx, h };
}

// ---------- 每帧：贴图 + 动画（画在风景草稿纸上，精细像素坐标） ----------
function rdbDrawSites(sg, gy, lit) {
  const R = G.road, Q = RD_Q, t = G.time, base = (gy - 13) * Q;
  for (const s of R.sites) {
    const S = RD_SITES[s.type], xw = rdSX(s.km * RD_PX_KM);
    if (xw + S.w < -40 || xw - S.w > RDV.W + 40) continue;
    const bi = rdBiomeIndex(s.km), searching = !!(R.search && R.search.site === s && R.search.phase === 'in'), open = s.searched || searching;
    const key = s.type + '_' + (s.seed % 2) + '_' + bi + '_' + (open ? 1 : 0);
    if (!RDB_CACHE[key]) { const ks = Object.keys(RDB_CACHE); if (ks.length > 24) for (const k of ks) delete RDB_CACHE[k]; RDB_CACHE[key] = rdbBuild(s.type, s.seed % 2, bi, open); }
    const Sp = RDB_CACHE[key], X = Math.round(xw * Q);
    sg.drawImage(Sp.cv, X - Sp.cx, base - Sp.up);
    rdbFx(sg, Sp, X, base, s, t);
    if (!s.searched || s.type === 'camp' || s.type === 'alien') for (const l of Sp.lights) lit.push({ x: (X - Sp.cx + l.x) / Q, y: (base + l.y) / Q, kind: l.kind, col: l.col, r: l.r, ph: l.ph + s.seed, a: 1, a2: 0 });
    if (searching) { // 手电筒在窗户里晃 + 门口扬灰
      const ws = Sp.wins; if (ws.length) { const k = Math.floor(t * 0.6 + s.seed) % ws.length, q = ws[k], ph = (t * 1.7) % 1; lit.push({ x: (X + q[0] + q[2] * (0.2 + 0.6 * (Math.sin(t * 2.3) * 0.5 + 0.5))) / Q, y: (base + q[1] + q[3] * 0.5) / Q, kind: 'glow', col: '#fff0b0', r: 6, ph: 0, a: 0.6 + ph * 0.3, a2: 0 }); }
      for (let k = 0; k < 3; k++) { const p = (t * 0.8 + k / 3) % 1, sz = 3 + p * 8; sg.globalAlpha = (1 - p) * 0.5; sg.fillStyle = '#a89a84'; sg.fillRect(X + Sp.door + (k - 1) * 8 + p * 10 * (k - 1) - sz / 2, base - 4 - p * 20 - sz / 2, sz, sz); }
      sg.globalAlpha = 1;
    }
  }
}
function rdbFx(sg, Sp, X, base, s, t) {
  for (const f of Sp.fx) {
    const x = X + f.x, y = base + f.y;
    if (f.k === 'smoke') for (let k = 0; k < 6; k++) { const p = (t * 0.25 + k / 6 + s.seed * 0.01) % 1, sz = (f.thin ? 4 : 8) + p * (f.thin ? 10 : 22); sg.globalAlpha = (1 - p) * (f.thin ? 0.35 : 0.5); sg.fillStyle = p < 0.2 ? '#5a524c' : '#8a8480'; sg.fillRect(x - sz / 2 - p * 30 + Math.sin(p * 6 + k) * 4, y - p * 70 - sz / 2, sz, sz); }
    else if (f.k === 'flag') { for (let i = 0; i < 22; i++) { const wv = Math.round(Math.sin(t * 6 - i * 0.45) * (i / 8)); sg.fillStyle = i < 11 ? f.c : f.c2; sg.fillRect(x + i, y + wv, 1, 12); sg.fillStyle = 'rgba(0,0,0,0.25)'; if (Math.sin(t * 6 - i * 0.45) < -0.3) sg.fillRect(x + i, y + wv, 1, 12); } }
    else if (f.k === 'mill') { const a0 = t * 1.8; sg.fillStyle = '#8a7a64'; for (let b = 0; b < 8; b++) { const a = a0 + b / 8 * 6.283; for (let r = 4; r < 26; r++) sg.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 2, 2); } sg.fillStyle = '#4a3e32'; sg.fillRect(x - 3, y - 3, 6, 6); sg.fillRect(x, y - 2, 22, 2); sg.fillRect(x + 18, y - 8, 10, 10); }
    else if (f.k === 'tv') { for (const q of f.list) for (let k = 0; k < 10; k++) { sg.fillStyle = rdHash(k + Math.floor(t * 12) * 13 + q[0]) > 0.5 ? '#c8d0d8' : '#5a6268'; sg.fillRect(X + q[0] + Math.floor(rdHash(k * 3 + Math.floor(t * 12)) * q[2]), base + q[1] + Math.floor(rdHash(k * 5 + 1 + Math.floor(t * 12)) * q[3]), 3, 1); } }
    else if (f.k === 'beam') { const a = Math.sin(t * 0.7 + s.seed) * 0.6 + 0.4; sg.globalAlpha = 0.18; sg.fillStyle = '#fff4c0'; sg.beginPath(); sg.moveTo(x, y); sg.lineTo(x + Math.cos(a) * 160 - Math.sin(a) * 12, y + Math.sin(a) * 160 + Math.cos(a) * 12); sg.lineTo(x + Math.cos(a) * 160 + Math.sin(a) * 12, y + Math.sin(a) * 160 - Math.cos(a) * 12); sg.fill(); sg.globalAlpha = 1; sg.fillStyle = '#5a6a4a'; sg.fillRect(x - 4, y - 3, 8, 6); }
    else if (f.k === 'police') { const on = Math.floor(t * 4) % 2; if (!s.searched) { sg.fillStyle = on ? '#ff4040' : '#5a2020'; sg.fillRect(x, y, 6, 3); sg.fillStyle = on ? '#30306a' : '#4080ff'; sg.fillRect(x + 7, y, 6, 3); } }
    else if (f.k === 'magnet') { const sw = Math.sin(t * 1.1 + s.seed) * 10; sg.fillStyle = '#3a342e'; for (let k = 0; k < 40; k++) sg.fillRect(Math.round(x + sw * k / 40), y + k, 1, 1); sg.fillStyle = '#5a544c'; sg.fillRect(Math.round(x + sw) - 9, y + 40, 18, 5); sg.fillStyle = '#c0a040'; sg.fillRect(Math.round(x + sw) - 9, y + 44, 18, 2); }
    else if (f.k === 'fire') { const C = ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c']; for (let k = 0; k < 7; k++) rdbStone(sg, x - 10 + k * 3, y - 2); for (let k = 0; k < 8; k++) { const p = (t * 1.6 + k / 8) % 1, hx = x - 6 + (k % 4) * 4 + Math.sin(t * 9 + k) * 1.5, hh = (1 - p) * 14; sg.fillStyle = C[Math.min(3, Math.floor(p * 4))]; sg.fillRect(Math.round(hx), Math.round(y - 3 - p * 18), 3, Math.max(1, Math.round(hh * 0.4))); } for (let k = 0; k < 3; k++) { const p = (t * 0.4 + k / 3) % 1; sg.globalAlpha = (1 - p) * 0.35; sg.fillStyle = '#8a8480'; sg.fillRect(x - 4 + p * -10, y - 24 - p * 40, 6 + p * 10, 6 + p * 10); } sg.globalAlpha = 1; }
    else if (f.k === 'people') { sg.save(); sg.setTransform(RD_Q, 0, 0, RD_Q, 0, 0); for (let k = 0; k < f.pts.length; k++) { const px = (X + f.pts[k]) / RD_Q + (k === 1 ? Math.sin(t * 0.5 + s.seed) * 4 : 0), py = (base + (k === 2 ? -104 : 0)) / RD_Q; rdhPerson(sg, px, py, { pose: k === 1 && Math.abs(Math.cos(t * 0.5 + s.seed)) > 0.3 ? 'walk' : 'stand', face: k === 1 ? (Math.cos(t * 0.5 + s.seed) > 0 ? 1 : -1) : -1, shirt: ['#5a78b8', '#a05a48', '#5a7a4a'][k], seed: k + (s.seed % 5) }); } sg.restore(); }
    else if (f.k === 'steam') for (let k = 0; k < 4; k++) { const p = (t * 0.5 + k / 4 + f.x * 0.01) % 1, sz = 4 + p * 14; sg.globalAlpha = (1 - p) * 0.4; sg.fillStyle = '#d8e8f0'; sg.fillRect(x - sz / 2 + Math.sin(p * 5 + k) * 4, y - p * 40 - sz / 2, sz, sz); }
    sg.globalAlpha = 1;
  }
}
function rdbStone(sg, x, y) { sg.fillStyle = '#6e6458'; sg.fillRect(x, y, 3, 2); sg.fillStyle = '#9a9080'; sg.fillRect(x, y, 2, 1); }
