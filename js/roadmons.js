// =============================================
//  公路求生：怪物的精细像素画（和车同一种画法：3~4 级明暗、深褐描边、斑点）
//  每种怪物：行走 4 帧（每秒 10 帧）+ 攻击 1 帧（扑 / 挥爪 / 俯冲 / 吐酸 / 砸地 / 蓄力）；
//  受击时闪白（用同一张图的白色剪影）；死亡时整张图碎成小块往外飞散、变淡，中间一团荧光。
//  坐标：精细像素，原点在脚下中间，朝右画（朝左时左右翻转）
// =============================================
const RDN_CACHE = {};
const RDN = {
  roach: ['#b8865a', '#946640', '#6e4a2c', '#4a301c'], fur: ['#a8805c', '#86603e', '#644428', '#422c18'],
  flesh: ['#d89a88', '#b8705e', '#8e4c3e', '#603028'], ghoul: ['#a8b47e', '#86925e', '#626c42', '#40482a'],
  rag: ['#8a7a64', '#6a5c48', '#4c4032', '#302820'], bird: ['#6a5a6e', '#4e4054', '#36283c', '#221828'],
  worm: ['#d8c878', '#b8a654', '#8e7e36', '#62561e'], spider: ['#5a5470', '#3e3a52', '#2a2638', '#1a1624'],
  brute: ['#8a9a5e', '#6a7a42', '#4c5a2e', '#323e1c'], ice: ['#f0f8ff', '#c8e0f0', '#94b8d4', '#6a8eac'],
  alien: ['#9a78d0', '#7454ac', '#523886', '#34225c'], mech: ['#5a4c80', '#40345e', '#2a2240', '#1a142a'],
  bone: ['#f0e6cc', '#d4c6a4', '#a89a7a'], tooth: '#f4ecd8', tox: '#b8f070', cyan: '#73eff7', pink: '#f070c0', red: '#e04a3a', eye: '#ffd860',
};
const rdnB = (B, x, y, w, h, R, m) => rdcBox(B, Math.round(x), Math.round(y), Math.round(w), Math.round(h), R, m || 1, 0, 1);
function rdnBlob(B, cx, cy, rx, ry, R, m, lit) { // 椭圆块：左上亮右下暗，带一点斑点
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
    const d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d > 1) continue;
    let t = 0.2 + (y / ry) * 0.35 + (x / rx) * 0.12 + d * 0.3 - (lit || 0);
    if (rdcHash(cx + x, cy + y, 7) < 0.07) t += 0.25;
    rdcPix(B, Math.round(cx + x), Math.round(cy + y), rdcRampAt(R, t, x, y), m || 1);
  }
}
function rdnLimb(B, x0, y0, x1, y1, w, R) { // 粗细为 w 的肢体（左亮右暗）
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (let k = 0; k < w; k++) rdcPix(B, Math.round(x - w / 2 + k), Math.round(y), R[Math.min(R.length - 1, k === 0 ? 0 : k === w - 1 ? 2 : 1)], 1); }
}
function rdnEye(B, x, y, c, s) { rdcRect(B, x, y, s || 2, s || 2, c, 4); rdcPix(B, x, y, '#ffffff', 4); }

// ---------- 每种怪物的画法：fr 0~3 行走帧，atk 攻击帧 ----------
const RDN_BUILD = {
  roach(B, fr, atk) { const up = atk ? -3 : 0; rdnBlob(B, -1, -6 + up, 11, 5, RDN.roach); for (let x = -9; x < 8; x += 4) rdcPix(B, x, -10 + up, RDN.roach[0], 1); rdnBlob(B, 11, -6 + up * 2, 4, 3, RDN.roach); rdcLine(B, 13, -8 + up * 2, 22, -14 + up * 3, RDN.roach[3], 1); rdcLine(B, 13, -7 + up * 2, 21, -6 + up * 2, RDN.roach[3], 1);
    for (let k = 0; k < 3; k++) { const ph = (fr + k) % 2 ? 2 : -2, lx = -6 + k * 7; rdcLine(B, lx, -3, lx + ph - 2, 0, RDN.roach[3], 1); rdcLine(B, lx + 1, -3, lx + 3 - ph, 0, RDN.roach[3], 1); }
    for (const x of [-5, 1]) rdcPix(B, x, -8 + up, RDN.tox, 4); rdnEye(B, 13, -8 + up * 2, RDN.tox, 1); },
  dog(B, fr, atk) { const st = atk ? 5 : 0, bob = fr % 2 ? -1 : 0, sw = [-3, -1, 3, 1][fr];
    rdcLine(B, -15, -15 + bob, -22, -20 + bob + (fr % 2) * 2, RDN.fur[2], 1); rdcLine(B, -15, -14 + bob, -21, -19 + bob + (fr % 2) * 2, RDN.fur[3], 1);
    rdnLimb(B, -11, -9, -11 + sw, 0, 4, RDN.fur); rdnLimb(B, 8 + st, -9, 8 + st - sw, 0, 4, RDN.fur); // 远侧两条腿（暗）
    rdnBlob(B, -1 + st / 2, -13 + bob, 16 + st / 2, 6, RDN.fur); for (let k = 0; k < 4; k++) rdcLine(B, -5 + k * 4, -15 + bob, -6 + k * 4, -10 + bob, RDN.flesh[2], 1); rdnBlob(B, -9, -16 + bob, 4, 3, RDN.flesh, 1, 0.2); rdcPix(B, -9, -17 + bob, '#ffa060', 4);
    rdnLimb(B, -8, -9, -8 - sw, 0, 4, RDN.fur); rdnLimb(B, 11 + st, -9, 11 + st + sw, 0, 4, RDN.fur); for (const x of [-8 - sw, 11 + st + sw]) rdcRect(B, x - 2, -1, 5, 1, RDN.fur[3], 1);
    rdnBlob(B, 15 + st, -16 + bob - (atk ? 1 : 0), 6, 5, RDN.fur); rdcPoly(B, [[17 + st, -18 + bob], [25 + st, -15 + bob], [25 + st, -11 + bob + (atk ? 3 : 0)], [18 + st, -12 + bob]], RDN.fur, 1); rdcPix(B, 25 + st, -15 + bob, '#2a1a14', 1);
    if (atk) { rdcRect(B, 19 + st, -12 + bob, 6, 2, '#5a1a14', 1); for (let x = 19; x < 25; x += 2) { rdcPix(B, x + st, -13 + bob, RDN.tooth, 1); rdcPix(B, x + st, -10 + bob, RDN.tooth, 1); } }
    rdcPoly(B, [[11 + st, -20 + bob], [12 + st, -26 + bob], [15 + st, -20 + bob]], RDN.fur, 1); rdnEye(B, 18 + st, -18 + bob, '#ff7040'); },
  ghoul(B, fr, atk) { const sw = [-3, 0, 3, 0][fr], bob = fr % 2 ? 0 : -1;
    rdnLimb(B, -2, -18, -2 + sw, 0, 4, RDN.rag); rdnLimb(B, 3, -18, 3 - sw, 0, 4, RDN.rag);
    rdcPoly(B, [[-7, -36 + bob], [7, -34 + bob], [8, -16], [-8, -16]], RDN.rag, 1); for (let x = -7; x < 8; x += 3) rdcPix(B, x, -16 + (x & 1), RDN.rag[3], 1); rdcLine(B, -3, -32 + bob, 2, -22, RDN.ghoul[2], 1);
    const ay = atk ? -46 : -30; rdnLimb(B, 6, -32 + bob, 14, ay + 6, 3, RDN.ghoul); rdnLimb(B, 14, ay + 6, 20, ay + (atk ? 0 : 10), 2, RDN.ghoul); if (atk) for (let k = 0; k < 3; k++) rdcLine(B, 20, ay, 24, ay - 3 + k * 2, RDN.bone[0], 1);
    rdnBlob(B, 3, -40 + bob, 6, 6, RDN.ghoul); rdcRect(B, 1, -42 + bob, 8, 1, RDN.ghoul[3], 1); rdnEye(B, 5, -41 + bob, RDN.tox); rdcLine(B, 3, -37 + bob, 8, -37 + bob, '#3a2a20', 1); for (let k = 0; k < 4; k++) rdcPix(B, -3 + k * 2, -26 + bob + k * 2, RDN.tox, 4);
    rdnLimb(B, -6, -32 + bob, -10, -22, 3, RDN.ghoul); },
  vulture(B, fr, atk) { const wy = [-14, -4, 6, -4][fr], dive = atk ? 6 : 0;
    rdcPoly(B, [[-2, -6], [-18, -12 + wy], [-34, -12 + Math.round(wy * 1.4)], [-26, -2 + Math.round(wy * 0.4)], [-6, 0]], RDN.bird, 1); for (let k = 0; k < 4; k++) rdcLine(B, -24 - k * 2, -3 + wy, -16 - k * 2, Math.round(wy * 0.3), RDN.bird[0], 1);
    rdnBlob(B, 2, -4, 13, 6, RDN.bird); rdcPoly(B, [[-11, -4], [-20, -8], [-20, 0]], RDN.bird, 1);
    rdnBlob(B, 16, -10 + dive, 4, 4, RDN.flesh, 1, 0.1); rdcPoly(B, [[19, -11 + dive], [25, -8 + dive], [19, -7 + dive]], ['#f0c060', '#c89030'], 1); rdnEye(B, 16, -12 + dive, RDN.red, 1); rdcLine(B, 13, -8 + dive, 10, -4, RDN.bird[1], 1);
    for (const x of [0, 4]) { rdcLine(B, x, 2, x + (atk ? 8 : 0), 8, '#c89030', 1); rdcLine(B, x + (atk ? 8 : 0), 8, x + (atk ? 11 : 3), 9, '#c89030', 1); }
    rdcPoly(B, [[0, -8], [-14, -14 - wy], [-30, -14 - Math.round(wy * 1.3)], [-22, -4 - Math.round(wy * 0.5)], [-4, -2]], RDN.bird, 1); for (let k = 0; k < 4; k++) rdcLine(B, -28 + k * 3, -13 - Math.round(wy * 1.2), -24 + k * 3, -6 - Math.round(wy * 0.5), RDN.bird[0], 1); },
  worm(B, fr, atk) { for (let k = 0; k < 6; k++) { const x = -18 + k * 6, y = -6 - Math.round(Math.sin(fr * 1.57 + k * 0.9) * 2) - (k === 5 ? (atk ? 20 : 12) : k === 4 ? (atk ? 8 : 4) : 0); rdnBlob(B, x, y, 5, 6 - (k === 0 ? 2 : 0), k % 2 ? RDN.worm : ['#c8b866', '#a89644', '#7e6e28', '#544a14']); rdcPix(B, x, y - 5, RDN.tox, 4); }
    const hx = 12, hy = atk ? -26 : -18; rdnBlob(B, hx + 2, hy, 6, 5, RDN.worm); rdcPoly(B, [[hx + 6, hy - 4], [hx + 12, hy - (atk ? 8 : 4)], [hx + 8, hy - 1]], RDN.bone, 1); rdcPoly(B, [[hx + 6, hy + 2], [hx + 12, hy + (atk ? 6 : 3)], [hx + 8, hy]], RDN.bone, 1); if (atk) { rdcRect(B, hx + 7, hy - 1, 3, 2, '#3a5a10', 1); rdcPix(B, hx + 12, hy, RDN.tox, 4); } rdnEye(B, hx + 1, hy - 3, RDN.tox, 1); },
  spider(B, fr, atk) { const lift = atk ? 8 : 0;
    for (let k = 0; k < 4; k++) { const ph = ((fr + k) % 2) * 3, x0 = -2 + k * 3; rdcLine(B, x0 - 6, -12, x0 - 16, -20 + ph, RDN.spider[1], 1); rdcLine(B, x0 - 16, -20 + ph, x0 - 22 + k, 0, RDN.spider[2], 1); rdcLine(B, x0 + 2, -12, x0 + 12 + k * 2, -18 - ph - (k === 3 ? lift : 0), RDN.spider[0], 1); rdcLine(B, x0 + 12 + k * 2, -18 - ph - (k === 3 ? lift : 0), x0 + 16 + k * 2, k === 3 && atk ? -24 : 0, RDN.spider[1], 1); }
    rdnBlob(B, -10, -14, 10, 8, RDN.spider); for (const [x, y] of [[-12, -18], [-8, -14], [-14, -12], [-6, -19]]) rdcRect(B, x, y, 2, 2, RDN.cyan, 4); rdcLine(B, -16, -16, -4, -16, RDN.cyan, 4);
    rdnBlob(B, 6, -12, 6, 5, RDN.spider); for (const [x, y] of [[9, -15], [11, -13], [9, -11]]) rdnEye(B, x, y, RDN.cyan, 1); rdcLine(B, 12, -9, 14, -5, RDN.bone[1], 1); },
  brute(B, fr, atk) { const sw = [-5, 0, 5, 0][fr], bob = fr % 2 ? 0 : -2;
    rdnLimb(B, -8, -30, -8 + sw, 0, 9, RDN.brute); rdnLimb(B, 6, -30, 6 - sw, 0, 9, RDN.brute); rdnB(B, -14 + sw, -4, 12, 4, RDN.rag); rdnB(B, 0 - sw, -4, 12, 4, RDN.rag);
    rdnBlob(B, -1, -50 + bob, 20, 22, RDN.brute); rdnB(B, -14, -38 + bob, 26, 10, RDN.rag); for (let k = 0; k < 6; k++) rdcLine(B, -14 + k * 5, -38 + bob, -13 + k * 5, -30 + bob, RDN.rag[3], 1);
    for (const [x, y, r] of [[-8, -62, 5], [6, -54, 3], [-12, -46, 3]]) { rdnBlob(B, x, y + bob, r, r, ['#e0ffb0', '#b8f070', '#7ac040'], 4); }
    rdnBlob(B, 12, -74 + bob, 8, 7, RDN.brute); rdcRect(B, 10, -77 + bob, 10, 2, RDN.brute[3], 1); rdnEye(B, 16, -76 + bob, RDN.tox, 3); rdcRect(B, 14, -70 + bob, 6, 2, '#3a2a10', 1); for (let x = 14; x < 20; x += 2) rdcPix(B, x, -70 + bob, RDN.tooth, 1);
    const ay = atk ? -96 : -40, ax = atk ? 22 : 26; rdnLimb(B, 14, -60 + bob, ax, ay + 20, 7, RDN.brute); rdnBlob(B, ax, ay + 18, 7, 7, RDN.brute); rdnLimb(B, -18, -58 + bob, -24, -30, 7, RDN.brute); rdnBlob(B, -24, -28, 6, 6, RDN.brute); },
  wraith(B, fr, atk) { const lean = atk ? 6 : 0;
    for (let y = -52; y < 0; y++) { const u = (y + 52) / 52, hw = 6 + u * 9 + Math.sin(u * 8 + fr * 1.6) * 2, cx = lean * (1 - u) + Math.sin(u * 5 + fr) * 2; for (let x = -hw; x <= hw; x++) { if (y > -6 && Math.floor((x + fr * 3) / 3) % 2) continue; rdcPix(B, Math.round(cx + x), y, rdcRampAt(RDN.ice, 0.1 + Math.abs(x) / hw * 0.5 + u * 0.3, x, y), 3); } }
    rdnBlob(B, 2 + lean, -48, 7, 7, RDN.ice, 3); rdcRect(B, -3 + lean, -52, 12, 4, RDN.ice[2], 3); rdnEye(B, 3 + lean, -48, RDN.cyan); rdnEye(B, 7 + lean, -48, RDN.cyan);
    rdnLimb(B, 8 + lean, -38, 18 + lean * 2, atk ? -46 : -26, 2, RDN.ice); for (let k = 0; k < 3; k++) rdcLine(B, 18 + lean * 2, atk ? -46 : -26, 22 + lean * 2, (atk ? -48 : -24) + k * 2, '#ffffff', 3); },
  crawler(B, fr, atk) { const lift = atk ? -6 : 0;
    for (let k = 0; k < 3; k++) { const ph = ((fr + k) % 2) * 4 - 2, x0 = -14 + k * 10; rdcLine(B, x0, -12, x0 + ph - 4, -18, RDN.alien[1], 1); rdcLine(B, x0 + ph - 4, -18, x0 + ph - 6, 0, RDN.alien[2], 1); rdcLine(B, x0 + 2, -10, x0 - ph + 4, 0, RDN.alien[1], 1); }
    rdnBlob(B, -4, -15 + lift / 2, 18, 7, RDN.alien); for (let x = -18; x < 12; x += 6) { rdcLine(B, x, -21 + lift / 2, x + 2, -9 + lift / 2, RDN.alien[3], 1); rdcPix(B, x + 3, -20 + lift / 2, RDN.pink, 4); }
    rdcPoly(B, [[-20, -18], [-30, -26], [-28, -16]], RDN.alien, 1); rdcPix(B, -29, -25, RDN.pink, 4);
    rdnBlob(B, 18, -18 + lift, 8, 6, ['#b898e0', '#8a68bc', '#62469a', '#3e2a6a']); for (const [x, y] of [[21, -21], [23, -18], [20, -17]]) rdnEye(B, x, y + lift, RDN.cyan, 1); rdcLine(B, 24, -14 + lift, 30, -10 + lift + (atk ? -6 : 0), RDN.bone[1], 1); rdcLine(B, 24, -13 + lift, 30, -8 + lift, RDN.bone[1], 1); },
  sentinel(B, fr, atk) { const sw = [-4, 0, 4, 0][fr];
    rdnLimb(B, -6, -36, -8 + sw, -18, 7, RDN.mech); rdnLimb(B, -8 + sw, -18, -6 + sw, 0, 6, RDN.mech); rdnLimb(B, 6, -36, 8 - sw, -18, 7, RDN.mech); rdnLimb(B, 8 - sw, -18, 6 - sw, 0, 6, RDN.mech); for (const x of [-8 + sw, 8 - sw]) rdcRect(B, x - 2, -19, 4, 2, RDN.cyan, 4);
    rdcPoly(B, [[-14, -66], [14, -66], [12, -36], [-12, -36]], RDN.mech, 1); for (let y = -62; y < -40; y += 6) rdcLine(B, -10, y, 10, y, RDN.mech[3], 1); rdcRect(B, -1, -60, 2, 18, RDN.cyan, 4);
    rdcPoly(B, [[-8, -84], [8, -84], [12, -72], [0, -66], [-12, -72]], ['#b8f4ff', '#73c8e0', '#3a8ab0', '#24587a'], 1); rdnEye(B, 2, -76, '#ffffff', 3);
    rdcPoly(B, [[10, -66], [26, -64], [26, -56], [12, -54]], RDN.mech, 1); rdgTube(B, 24, 34, -60, 2, RDN.mech); rdcRect(B, 33, -61, 2, 3, atk ? '#ffffff' : RDN.cyan, 4);
    rdnLimb(B, -14, -62, -20, -40, 4, RDN.mech); rdcPix(B, -20, -40, RDN.cyan, 4); },
};
function rdnFrame(type, k) { // k: 0~3 行走，4 攻击
  const key = type + k;
  if (RDN_CACHE[key]) return RDN_CACHE[key];
  const M = RD_MONSTERS[type], W = M.w * RD_Q * 3 + 40, H = M.h * RD_Q * 2 + 50;
  const B = rdcPaper(W, H, Math.round(W / 2), H - 12);
  RDN_BUILD[type](B, k % 4, k === 4);
  rdcWeather(B, type.length * 11 + k, -0.25, 9999);
  rdcOutline(B);
  return (RDN_CACHE[key] = rdcToCanvas(B));
}
function rdnHas(type) { return !!RDN_BUILD[type]; }
// ---------- 每帧画一只怪物（替换 js/roaddraw.js 的方块画法） ----------
function rdnDraw(g, m, gy) {
  const M = RD_MONSTERS[m.type], x = rdSX(m.x), y = gy + (M.fly ? m.y : 3);
  if (x < -60 || x > RDV.W + 60) return;
  const Q = RD_Q, atk = m.lunge > 0, k = atk ? 4 : Math.floor(m.ph * (M.fly ? 8 : 10) * (M.big ? 0.7 : 1)) % 4, S = rdnFrame(m.type, k);
  if (!M.fly) { g.fillStyle = 'rgba(20,12,8,0.3)'; g.fillRect(x - M.w / 2 - 1, gy + 3, M.w + 2, 1); }
  g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (m.face < 0) g.scale(-1, 1);
  const w = S.cv.width / Q, h = S.cv.height / Q, ox = -S.ox / Q, oy = -S.oy / Q;
  if (m.type === 'wraith') g.globalAlpha = 0.8 + Math.sin(m.ph * 3) * 0.1;
  g.drawImage(S.cv, ox, oy, w, h);
  if (m.hitT > 0) { g.globalAlpha = Math.min(1, m.hitT / 0.1); g.drawImage(S.white, ox, oy, w, h); }
  g.globalAlpha = 1;
  // 发光部位的光晕（夜里更明显）
  const day = rdDaylight();
  if (day < 0.7 || M.big) { g.globalAlpha = (0.15 + (1 - day) * 0.3) * (0.8 + Math.sin(m.ph * 4) * 0.2); const s = Math.max(M.w, M.h) * 0.9; g.drawImage(rdsGlow(M.glow), -s / 2, -M.h * 0.6 - s / 2, s, s); g.globalAlpha = 1; }
  if (atk && (m.type === 'worm' || m.type === 'sentinel')) { g.globalAlpha = 0.7; g.drawImage(rdsGlow(m.type === 'worm' ? '#b8f070' : '#73eff7'), M.w / 2 - 2, -M.h * 0.8 - 3, 6, 6); g.globalAlpha = 1; }
  g.restore();
  if (m.burn > 0) for (let i = 0; i < 3; i++) { const p = (G.time * 3 + i / 3) % 1; g.fillStyle = ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c'][Math.floor(p * 4)]; g.fillRect(x - 2 + i * 2 + Math.sin(G.time * 20 + i), y - M.h * 0.5 - p * M.h * 0.6, 1, 1); }
  if (m.slow > 0) { g.fillStyle = '#c8f8ff'; g.fillRect(x - 3, y - M.h - 2, 1 / Q * 2, 1 / Q * 2); g.fillRect(x + 2, y - M.h - 1, 1 / Q * 2, 1 / Q * 2); }
}
// ---------- 死亡爆散：图碎成小块往外飞、往下掉、变淡 ----------
function rdnDeath(g, f, gy) {
  const M = RD_MONSTERS[f.type]; if (!M) return;
  const S = rdnFrame(f.type, f.fr || 0), Q = RD_Q, p = 1 - f.life / f.max, x = rdSX(f.x), y = gy + f.y, cs = Math.max(4, Math.round(Math.max(M.w, M.h) * Q / 6));
  g.save(); g.globalAlpha = Math.max(0, 1 - p * 1.1);
  const W = S.cv.width, H = S.cv.height;
  for (let sy = 0; sy < H; sy += cs) for (let sx = 0; sx < W; sx += cs) {
    const cx = sx + cs / 2 - S.ox, cy = sy + cs / 2 - S.oy, h1 = rdHash(sx * 3.7 + sy * 1.3 + f.x);
    const dx = (cx / Q) * (f.face < 0 ? -1 : 1), vx = dx * 2.2 + (h1 - 0.5) * 30, vy = -18 - h1 * 30 + cy / Q;
    const px = x + dx + vx * p, py = y + cy / Q + vy * p + 70 * p * p;
    g.save(); g.translate(px, py); g.rotate((h1 - 0.5) * p * 8); if (f.face < 0) g.scale(-1, 1);
    g.drawImage(S.cv, sx, sy, cs, cs, -cs / Q / 2, -cs / Q / 2, cs / Q, cs / Q); g.restore();
  }
  g.globalAlpha = (1 - p) * 0.6; const s = Math.max(M.w, M.h) * (1 + p * 1.5); g.drawImage(rdsGlow(M.glow), x - s / 2, y - M.h / 2 - s / 2, s, s);
  g.restore();
}
