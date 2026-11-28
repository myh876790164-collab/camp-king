// =============================================
//  公路求生：车内家具的精细像素画（手绘版，替代原来的「自动精细化」）+ 主角使用时的动画
//  每种家具（按 v 外观名）逐像素画好缓存；会动的部分每帧画：火苗、热气、冰箱开门的灯光、水滴、心电图、
//  发电机抖动冒烟、聚变核心转圈、电视画面、音符等。主角睡觉时被子盖在身上（画在人物上面）。
//  坐标：精细像素。地上的家具原点在左下角（往上为负）；墙上的家具原点在左上角（往下为正）。
//  还没手绘的家具继续用原来的画法（js/roaddraw.js 的 rdDrawItem + 自动精细化）
// =============================================
const RDF_CACHE = {};
const RDF = {
  blue: ['#9ac0e0', '#6a94bc', '#46709a', '#2a4c6e'], red: ['#e8987e', '#c66e56', '#984a3a', '#683024'],
  sheet: ['#f6f2e6', '#ddd6c6', '#b4ac9a', '#847c6c'], wood: ['#cfa070', '#a47850', '#7a5636', '#523822'],
  card: ['#dcb47e', '#bc905a', '#926a3e', '#664824'], olive: ['#acae7c', '#828456', '#5c603a', '#3c4026'],
  steel: ['#e2e0d8', '#bcb8ae', '#8e8a80', '#625e56', '#3e3a34'], dark: ['#5e5852', '#423c36', '#2c2722', '#1c1814'],
  white: ['#f8f6ee', '#e2ddd0', '#bcb6a6', '#8c8676'], purple: ['#d4b0f6', '#a47cd8', '#7252a8', '#48326e'],
  cyan: ['#e0fcff', '#9cecf4', '#56bcd4', '#2e7c9c'], orange: ['#f4b070', '#dc8a46', '#ac622a', '#764018'],
  green: ['#b8d88a', '#8ab45e', '#5e8a3c', '#3c5e24'], plum: ['#c890c8', '#a0649c', '#764474', '#4e2a4e'],
  yellow: ['#f4d070', '#d8aa3e', '#a87e24', '#725416'], copper: ['#f0b878', '#c88448', '#94582c', '#5e341a'],
  glow: '#73eff7', glow2: '#c27bd6', fire: ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c'],
};
const rdfBx = (B, x, y, w, h, R, m) => rdcBox(B, Math.round(x), Math.round(y), Math.round(w), Math.round(h), R, m || 1, 0, 1);
const rdfRc = (B, x, y, w, h, c, m) => rdcRect(B, Math.round(x), Math.round(y), Math.round(w), Math.round(h), c, m || 1);
const rdfLn = (B, x0, y0, x1, y1, c, m) => rdcLine(B, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), c, m || 1);
function rdfRound(B, x, y, w, h, r, R, m, sh) { // 圆角块（软的东西：床垫、枕头、睡袋），左上亮右下暗
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const cx = xx < r ? r - xx : xx >= w - r ? xx - (w - r - 1) : 0, cy = yy < r ? r - yy : yy >= h - r ? yy - (h - r - 1) : 0;
    if (cx * cx + cy * cy > r * r) continue;
    const t = (sh == null ? 0.15 : sh) + yy / h * 0.55 + xx / w * 0.15 + (cx + cy > r * 0.6 ? 0.1 : 0);
    rdcPix(B, x + xx, y + yy, rdcRampAt(R, Math.min(1, t), x + xx, y + yy), m || 1);
  }
}
function rdfLeg(B, x, y0, y1, R) { for (let y = y0; y < y1; y++) { rdcPix(B, x, y, R[1], 2); rdcPix(B, x + 1, y, R[2], 2); } }
function rdfKnob(B, x, y) { rdcPix(B, x, y, '#e8e4d8', 2); rdcPix(B, x + 1, y + 1, '#6a665e', 2); }

// ---------- 手绘家具：v → 画法 (B, W)；地上的往上画（y < 0），墙上的往下画（y > 0） ----------
const RDF_B = {
  // ===== 床 =====
  cardboard: (B, W) => { rdfBx(B, 4, -5, W - 8, 5, RDF.card); for (let x = 10; x < W - 8; x += 22) rdfLn(B, x, -5, x + 3, -1, RDF.card[3]); rdfRc(B, 20, -5, 18, 1, '#d8cca0'); rdfRound(B, W - 34, -9, 26, 6, 3, RDF.red, 1); rdfRound(B, 8, -8, 16, 4, 2, RDF.sheet, 1); },
  sleepbag: (B, W) => { rdfRound(B, 4, -11, W - 8, 11, 5, RDF.blue); for (let x = 22; x < W - 8; x += 9) rdfLn(B, x, -10, x, -2, RDF.blue[3]); rdfRound(B, 4, -12, 18, 12, 5, RDF.blue, 1, 0); rdfRound(B, 7, -10, 12, 7, 3, RDF.sheet, 1); rdfLn(B, 24, -6, W - 10, -6, '#d8d0c0'); },
  cot: (B, W) => { for (let x = 6; x < W - 6; x++) { const s = Math.round(Math.sin((x - 6) / (W - 12) * Math.PI) * 2); rdfRc(B, x, -26 + s, 1, 5, rdcRampAt(RDF.olive, 0.2 + s * 0.15, x, 0)); } rdfLn(B, 6, -22, 30, 0, RDF.steel[3], 2); rdfLn(B, 30, -22, 6, 0, RDF.steel[3], 2); rdfLn(B, W - 30, -22, W - 6, 0, RDF.steel[3], 2); rdfLn(B, W - 6, -22, W - 30, 0, RDF.steel[3], 2); rdfRound(B, 8, -31, 18, 6, 3, RDF.sheet); },
  mattress: (B, W) => { rdfBx(B, 4, -9, W - 8, 9, RDF.wood); for (let x = 4; x < W - 4; x += 16) rdfRc(B, x, -9, 2, 9, RDF.wood[3]); rdfRound(B, 4, -30, W - 8, 21, 4, RDF.sheet); for (let x = 10; x < W - 8; x += 6) rdfRc(B, x, -28, 1, 18, '#cfc6b2'); rdfRound(B, 8, -36, 30, 9, 4, RDF.sheet, 1, 0); rdfRound(B, 44, -33, W - 52, 9, 4, RDF.orange); rdcPix(B, 60, -22, '#b8a888'); rdcPix(B, 61, -22, '#b8a888'); },
  bunk: (B, W) => { for (const x of [4, W - 8]) rdfBx(B, x, -72, 4, 72, RDF.wood); for (const y of [-64, -24]) { rdfBx(B, 6, y + 6, W - 12, 4, RDF.wood); rdfRound(B, 8, y - 4, W - 16, 10, 3, RDF.blue); rdfRound(B, 10, y - 8, 18, 6, 3, RDF.sheet, 1, 0); } for (let y = -60; y < -4; y += 7) rdfRc(B, W - 16, y, 10, 2, RDF.wood[1]); rdfLn(B, W - 16, -60, W - 16, -4, RDF.wood[2]); rdfRound(B, 30, -60, 34, 14, 2, RDF.red); },
  hammock: (B, W) => { rdfRc(B, 2, 0, 4, 4, RDF.steel[3], 2); rdfRc(B, W - 6, 0, 4, 4, RDF.steel[3], 2); for (let x = 4; x < W - 4; x++) { const u = (x - 4) / (W - 8), s = Math.round(Math.sin(u * Math.PI) * 52); for (let k = 0; k < 8; k++) { const y = 4 + s + k - Math.round(Math.sin(u * Math.PI) * 6); if (u > 0.12 && u < 0.88) rdcPix(B, x, y, ((x >> 2) & 1) ? RDF.orange[k < 2 ? 0 : 1] : RDF.sheet[k < 2 ? 0 : 1], 1); } if (u <= 0.14 || u >= 0.86) rdcPix(B, x, 4 + s, '#a08060', 2); } },
  bigbed: (B, W) => { rdfRound(B, 2, -60, 12, 60, 4, RDF.plum); for (let y = -54; y < -10; y += 9) rdcPix(B, 8, y, RDF.plum[3]); rdfBx(B, W - 10, -30, 8, 30, RDF.wood); rdfBx(B, 10, -14, W - 18, 8, RDF.wood); rdfRound(B, 12, -30, W - 22, 16, 4, RDF.sheet); rdfRound(B, 14, -38, 26, 10, 4, RDF.sheet, 1, 0); rdfRound(B, 30, -35, 22, 9, 4, RDF.white, 1, 0); rdfRound(B, 54, -32, W - 64, 16, 5, RDF.plum); for (let x = 60; x < W - 12; x += 12) rdcPix(B, x, -26, RDF.plum[0]); rdfBx(B, 12, -6, 4, 6, RDF.wood); rdfBx(B, W - 14, -6, 4, 6, RDF.wood); },
  waterbed: (B, W) => { rdfBx(B, 4, -14, W - 8, 14, RDF.wood); rdfRound(B, 8, -28, W - 16, 15, 6, RDF.cyan); rdfRound(B, 10, -34, 26, 9, 4, RDF.sheet, 1, 0); rdfRound(B, 40, -30, W - 52, 12, 4, RDF.blue); },
  capsule: (B, W) => { rdfRound(B, 2, -44, W - 4, 44, 14, RDF.white); rdfRound(B, 12, -36, W - 24, 22, 8, ['#4a6a7a', '#34505c', '#22343e'], 3); for (let x = 14; x < W - 14; x += 3) rdcPix(B, x, -12, '#73eff7', 4); rdfRc(B, 8, -4, W - 16, 4, RDF.steel[3], 2); },
  alienpod: (B, W) => { rdfRound(B, 4, -40, W - 8, 30, 12, RDF.purple); rdfRound(B, 12, -34, W - 24, 16, 7, ['#5a3a8a', '#3e2866', '#281a44'], 3); for (let x = 14; x < W - 14; x += 6) rdcPix(B, x, -24, RDF.glow, 4); },
  cryo: (B, W) => { rdfBx(B, 6, -10, W - 12, 10, RDF.steel, 2); rdfRound(B, 10, -70, W - 20, 62, 10, ['#cfeff6', '#9cd4e4', '#6ab0c8'], 3); rdfRound(B, 16, -62, W - 32, 46, 8, ['#5ac8e0', '#3aa0c0', '#2a7898'], 3); for (let k = 0; k < 18; k++) rdcPix(B, 14 + Math.floor(rdcHash(k, 1, 3) * (W - 28)), -66 + Math.floor(rdcHash(k, 2, 3) * 56), '#ffffff', 4); rdfBx(B, 6, -76, W - 12, 6, RDF.steel, 2); },
  // ===== 灶 =====
  burner: (B, W) => { const c = W / 2; rdfBx(B, c - 14, -6, 28, 6, RDF.steel, 2); for (const d of [-12, 10]) rdfLn(B, c + d, -6, c + d / 2, -18, RDF.steel[3], 2); rdfRc(B, c - 10, -18, 20, 2, RDF.steel[2], 2); rdfBx(B, c - 6, -10, 12, 4, ['#5a8ab4', '#3a6088'], 2); },
  induction: (B, W) => { rdfBx(B, 4, -40, W - 8, 40, RDF.white); rdfRc(B, 2, -42, W - 4, 3, RDF.steel[1], 2); for (const x of [8, W / 2 + 2]) { rdfRc(B, x, -34, W / 2 - 12, 28, RDF.white[1]); rdfKnob(B, x + W / 2 - 18, -20); } rdfBx(B, 12, -46, W - 24, 4, RDF.dark, 2); rdcPix(B, W - 16, -45, '#e04a3a', 4); },
  grill: (B, W) => { const c = W / 2; rdfRound(B, c - 22, -42, 44, 20, 9, RDF.dark, 2, 0); rdfRc(B, c - 24, -42, 48, 2, RDF.steel[3], 2); for (const d of [-16, 14]) rdfLn(B, c + d, -22, c + d * 1.3, 0, RDF.steel[3], 2); rdfLn(B, c, -22, c, 0, RDF.steel[3], 2); rdfRc(B, c - 26, -44, 52, 1, RDF.steel[1], 2); },
  kitchen: (B, W) => { rdfBx(B, 2, -40, W - 4, 40, RDF.wood); for (let x = 2; x < W - 4; x += 26) { rdfRc(B, x, -36, 1, 34, RDF.wood[3]); rdfKnob(B, x + 20, -26); } rdfBx(B, 0, -44, W, 4, RDF.steel, 2); rdfBx(B, 24, -44, 34, 3, RDF.steel, 2); rdfRc(B, 26, -43, 30, 2, '#8aaab8', 3); rdfLn(B, 40, -44, 40, -56, RDF.steel[2], 2); rdfLn(B, 40, -56, 48, -56, RDF.steel[2], 2); rdfBx(B, 86, -46, 40, 3, RDF.dark, 2);
    rdfBx(B, 8, -110, W - 16, 30, RDF.wood); for (let x = 8; x < W - 16; x += 34) { rdfRc(B, x, -108, 1, 28, RDF.wood[3]); rdfKnob(B, x + 28, -86); } for (let k = 0; k < 5; k++) rdfBx(B, 14 + k * 8, -60, 5, 8, [['#e8a040', '#c47a24'], ['#a8c070', '#7a9a48'], ['#e07050', '#b04a30']][k % 3], 1); rdfBx(B, W - 40, -50, 26, 4, RDF.wood); },
  coffee: (B, W) => { rdfBx(B, 6, 34, W - 12, 4, RDF.wood); rdfBx(B, 14, 4, 34, 30, RDF.dark, 2); rdfRc(B, 18, 8, 26, 8, '#2a2622', 2); rdfBx(B, 24, 18, 14, 4, RDF.steel, 2); rdfRc(B, 40, 8, 4, 4, '#e04a3a', 4); for (let k = 0; k < 2; k++) rdfRound(B, 52 + k * 10, 26, 8, 8, 2, RDF.white); },
  synth: (B, W) => { rdfBx(B, 6, -60, W - 12, 60, RDF.purple, 2); rdfRound(B, 14, -52, W - 28, 30, 8, ['#2e1f50', '#20143a', '#140c26'], 3); rdfBx(B, 14, -16, W - 28, 8, RDF.purple, 2); for (let x = 18; x < W - 18; x += 7) rdcPix(B, x, -12, RDF.glow, 4); },
  // ===== 冰箱 =====
  cooler: (B, W) => { const c = W / 2; rdfBx(B, c - 24, -26, 48, 26, RDF.blue); rdfBx(B, c - 26, -30, 52, 6, RDF.white); rdfRc(B, c - 8, -34, 16, 2, RDF.steel[3], 2); for (let k = 0; k < 2; k++) { rdfBx(B, c - 14 + k * 10, -40, 7, 10, [['#d84a3a', '#a8301e'], ['#5a9ad8', '#3a6aa8']][k], 2); } },
  minifridge: (B, W) => { const c = W / 2; rdfRound(B, c - 22, -54, 44, 54, 4, RDF.white); rdfRc(B, c - 22, -40, 44, 1, RDF.white[3]); rdfRc(B, c + 16, -36, 2, 14, RDF.steel[2], 2); rdfRc(B, c + 16, -52, 2, 8, RDF.steel[2], 2); rdfRc(B, c - 14, -30, 6, 6, '#e8a040'); rdfRc(B, c - 6, -24, 8, 5, '#a0c8e0'); },
  bigfridge: (B, W) => { rdfRound(B, 6, -90, W - 12, 90, 5, RDF.steel); rdfRc(B, W / 2, -88, 1, 86, RDF.steel[4]); for (const x of [W / 2 - 6, W / 2 + 4]) rdfRc(B, x, -70, 2, 26, RDF.steel[0], 2); rdfBx(B, 16, -76, 20, 24, ['#4a5a64', '#34404a', '#222a30'], 2); rdfRc(B, 22, -64, 8, 2, '#73eff7', 4); rdfRc(B, W - 40, -60, 8, 8, '#e8a040'); rdfRc(B, W - 28, -48, 10, 7, '#a0c8e0'); },
  freezer: (B, W) => { rdfRound(B, 4, -40, W - 8, 40, 4, RDF.white); rdfBx(B, 2, -44, W - 4, 6, RDF.white); rdfRc(B, W / 2 - 10, -38, 20, 2, RDF.steel[3], 2); for (let k = 0; k < 6; k++) rdcPix(B, 10 + k * 11, -36 + (k % 2) * 20, '#d8f4ff', 4); },
  stasis: (B, W, wall) => { const y0 = wall ? 2 : -62; rdfBx(B, 6, y0, W - 12, 60, ['#3e2c64', '#2e1f50', '#20143a'], 2); rdfRound(B, 12, y0 + 6, W - 24, 48, 6, ['#4a3a7a', '#382a62'], 3); },
  // ===== 水 =====
  barrel: (B, W) => { const c = W / 2; rdfBx(B, c - 20, -48, 40, 48, RDF.blue); for (const y of [-40, -16]) rdfRc(B, c - 20, y, 40, 2, RDF.blue[3]); rdfRound(B, c - 21, -52, 42, 6, 3, RDF.blue, 1, 0); rdfRc(B, c + 18, -12, 6, 3, RDF.steel[2], 2); rdfRc(B, c + 22, -10, 2, 3, RDF.steel[2], 2); },
  filter: (B, W) => { const c = W / 2; rdfRc(B, c - 20, 2, 40, 2, RDF.steel[3], 2); rdfRound(B, c - 14, 4, 28, 44, 6, RDF.white); rdfRound(B, c - 10, 12, 20, 24, 4, ['#8ac8e8', '#5aa0c8', '#3a78a0'], 3); rdfRc(B, c - 2, 48, 4, 8, RDF.steel[2], 2); rdfRc(B, c - 6, 54, 12, 2, RDF.steel[2], 2); },
  aquagen: (B, W) => { const c = W / 2; rdfBx(B, c - 26, -72, 52, 72, RDF.white); for (let y = -68; y < -44; y += 3) rdfRc(B, c - 22, y, 44, 1, RDF.steel[3], 2); rdfRound(B, c - 16, -38, 32, 22, 4, ['#8ac8e8', '#5aa0c8', '#3a78a0'], 3); rdfRc(B, c - 4, -12, 8, 6, RDF.steel[2], 2); rdcPix(B, c + 18, -66, '#73eff7', 4); },
  // ===== 医疗 =====
  firstaid: (B, W) => { const c = W / 2; rdfRound(B, c - 18, 10, 36, 28, 3, RDF.white); rdfRc(B, c - 3, 15, 6, 18, '#d84a3a'); rdfRc(B, c - 9, 21, 18, 6, '#d84a3a'); rdfRc(B, c - 6, 8, 12, 3, RDF.steel[2], 2); rdfRound(B, c + 20, 28, 10, 10, 4, RDF.sheet); },
  medbed: (B, W) => { rdfBx(B, 6, -32, W - 40, 5, RDF.steel, 2); rdfRound(B, 6, -40, W - 40, 9, 3, RDF.white); rdfRound(B, 8, -46, 22, 7, 3, RDF.sheet, 1, 0); for (const x of [10, W - 40]) { rdfLeg(B, x, -27, -4, RDF.steel); rdgBall(B, x + 1, -3, 3, RDF.dark); } for (let x = 12; x < W - 44; x += 10) rdfRc(B, x, -52, 1, 12, RDF.steel[2], 2); rdfRc(B, 10, -52, W - 54, 1, RDF.steel[2], 2);
    const sx = W - 22; rdfLeg(B, sx, -96, -2, RDF.steel); rdfRc(B, sx - 8, -2, 18, 2, RDF.steel[3], 2); rdfRound(B, sx - 6, -96, 12, 16, 3, ['#e8f4f8', '#c0dce4', '#90b4c0'], 3); rdfBx(B, sx - 14, -66, 28, 18, RDF.dark, 2); rdfRc(B, sx - 12, -64, 24, 14, '#10201a', 2); },
  decon: (B, W) => { rdfBx(B, 4, -96, W - 8, 96, RDF.white); rdfBx(B, 10, -88, W - 20, 82, ['#b8e8a8', '#8ac87a', '#5ea050'], 3); rdfRc(B, W / 2, -88, 1, 82, RDF.white[2]); rdfBx(B, 4, -100, W - 8, 6, RDF.steel, 2); rdfRc(B, W / 2 - 4, -98, 8, 2, '#a7f070', 4); },
  // ===== 电 =====
  battery: (B, W, wall, t) => { const c = W / 2, R = t >= 3 ? RDF.blue : RDF.dark; for (let k = 0; k < 2; k++) { rdfBx(B, c - 24, -14 - k * 16, 48, 14, R, 2); rdfRc(B, c - 18, -18 - k * 16, 6, 4, '#d84a3a', 2); rdfRc(B, c + 12, -18 - k * 16, 6, 4, RDF.dark[1], 2); rdfRc(B, c - 20, -8 - k * 16, 40, 3, R[0], 2); } rdfLn(B, c - 15, -34, c + 15, -18, '#d84a3a'); },
  generator: (B, W) => { rdfBx(B, 4, -44, W - 8, 4, RDF.dark, 2); rdfBx(B, 4, -4, W - 8, 4, RDF.dark, 2); for (const x of [4, W - 8]) rdfRc(B, x, -44, 4, 44, RDF.dark[1], 2); rdfBx(B, 14, -38, W - 28, 30, RDF.yellow, 1); rdfBx(B, 22, -32, 24, 18, RDF.dark, 2); for (let y = -30; y < -16; y += 3) rdfRc(B, 24, y, 20, 1, RDF.dark[0], 2); rdfRc(B, W - 24, -32, 8, 6, RDF.steel[3], 2); rdfLn(B, W - 12, -44, W - 12, -58, RDF.steel[2], 2); rdfRc(B, W - 14, -60, 5, 3, RDF.steel[3], 2); rdfKnob(B, 54, -24); },
  fusion: (B, W) => { const c = W / 2; rdfBx(B, c - 22, -10, 44, 10, RDF.steel, 2); rdfBx(B, c - 22, -62, 44, 8, RDF.steel, 2); for (const d of [-20, 16]) rdfRc(B, c + d, -54, 4, 44, RDF.steel[2], 2); rdfRound(B, c - 16, -54, 32, 44, 10, ['#3a2a60', '#2a1c48'], 3); },
  capwall: (B, W) => { rdfBx(B, 4, 2, W - 8, 56, ['#3a4a7a', '#2a3864', '#1e284a'], 2); for (let k = 0; k < 5; k++) rdfRound(B, 10 + k * 13, 8, 10, 40, 4, RDF.blue, 2); },
  // 空间折叠货舱模块（只用来当图标，用掉了不会摆在车里）：银白立方体 + 发光的折叠网格
  foldmod: (B, W) => { const c = W / 2; rdfBx(B, c - 22, -46, 44, 44, ['#f6f8fa', '#dfe6ec', '#c2ccd6', '#9aa8b6'], 2); for (let k = 1; k < 4; k++) { rdfRc(B, c - 22 + k * 11, -46, 1, 44, '#41a6f6', 4); rdfRc(B, c - 22, -46 + k * 11, 44, 1, '#41a6f6', 4); } rdgBall(B, c, -24, 6, ['#f0fcff', '#9ce8ff', '#41a6f6'], 4); rdfBx(B, c - 26, -4, 52, 4, RDF.steel, 2); },
  // 宠物食盆：两只小碗（一碗粮一碗水），垫在小垫子上
  petbowl: (B, W) => { const c = W / 2; rdfRound(B, c - 26, -4, 52, 4, 2, ['#c86a7a', '#a04a5a'], 1); for (const [x, R] of [[c - 18, RDF.red], [c + 4, RDF.blue]]) { rdfRound(B, x, -12, 16, 9, 3, R, 1); rdfRc(B, x + 2, -12, 12, 2, R[3]); } rdfRc(B, c + 6, -12, 12, 2, '#9ad8f4', 3); rdfRc(B, c - 6, -8, 4, 1, '#f4ecd8'); },
  // 宠物玩具篮：编织篮 + 露出来的球、骨头、逗猫棒
  pettoy: (B, W) => { const c = W / 2; rdgBall(B, c - 12, -22, 6, ['#f08a60', '#e04a3a', '#a8301e'], 1); rdfRc(B, c - 14, -24, 5, 1, '#f4f4f4'); rdfRound(B, c - 2, -26, 14, 5, 2, ['#f4ecd8', '#d8ccb0'], 1); rdfLn(B, c + 10, -16, c + 18, -44, '#a87850'); rdfRc(B, c + 16, -48, 5, 4, '#c27bd6'); rdfRc(B, c + 17, -44, 2, 5, '#ffcd75'); rdfBx(B, c - 22, -18, 44, 18, RDF.wood); for (let x = c - 20; x < c + 20; x += 4) rdfRc(B, x, -16, 2, 14, RDF.wood[3]); rdfRc(B, c - 22, -18, 44, 2, RDF.wood[0]); },
  // 窗边软垫：矮木台 + 厚坐垫 + 两个抱枕
  windowseat: (B, W) => { rdfBx(B, 4, -18, W - 8, 18, RDF.wood); for (let x = 10; x < W - 8; x += 22) rdfKnob(B, x + 8, -10); rdfRound(B, 4, -26, W - 8, 9, 4, ['#a8c8e8', '#7aa0c8', '#5078a0'], 1, 0.1); rdfRound(B, 8, -38, 16, 13, 4, RDF.orange, 1, 0); rdfRound(B, W - 26, -36, 18, 11, 4, ['#f4ecd8', '#ddd0b4', '#b4a68a'], 1, 0); },
  // 蔬菜种植箱：木箱 + 一排绿叶 + 上面一根补光灯架
  planter: (B, W) => { rdfBx(B, 6, -26, W - 12, 26, RDF.wood); for (let x = 8; x < W - 8; x += 12) rdfRc(B, x, -24, 1, 22, RDF.wood[3]); rdfRc(B, 8, -28, W - 16, 3, '#5a3a24'); for (let k = 0; k < 5; k++) { const x = 12 + k * (W - 24) / 5; rdfLn(B, x + 4, -28, x + 4, -38 - (k % 2) * 6, RDF.green[3]); rdfRound(B, x - 1, -44 - (k % 2) * 6, 10, 8, 3, RDF.green, 1, 0); rdfRound(B, x + 4, -38 - (k % 2) * 4, 8, 6, 2, RDF.green, 1, 0); if (k % 2) rdgBall(B, x + 2, -36, 2, ['#f08a60', '#c04a30'], 1); } for (const x of [8, W - 12]) rdfBx(B, x, -72, 4, 46, RDF.steel, 2); rdfBx(B, 8, -76, W - 16, 5, RDF.steel, 2); },
  // 蛋白质合成设备：白色机柜，中间一个绿色培养罐，下面出料口放着蛋白块
  protein: (B, W) => { const c = W / 2; rdfBx(B, 6, -84, W - 12, 84, RDF.white); rdfRound(B, c - 16, -76, 32, 40, 8, ['#c8f0d8', '#8ad0a8', '#5aa880'], 3); rdfRc(B, c - 12, -70, 24, 30, '#3a8a5a', 3); rdfBx(B, 10, -30, W - 20, 6, RDF.steel, 2); rdfBx(B, c - 14, -22, 28, 14, RDF.dark, 2); for (let k = 0; k < 3; k++) rdfBx(B, c - 11 + k * 8, -16, 6, 6, ['#e8d8a8', '#c8b080', '#a08858'], 1); for (let k = 0; k < 3; k++) rdfKnob(B, W - 18, -80 + k * 6); rdfBx(B, 10, -90, W - 20, 6, RDF.steel, 2); },
  // 冷凝净水器：机身 + 顶上散热风扇格栅 + 侧面透明储水罐
  condenser: (B, W) => { rdfBx(B, 6, -66, W - 30, 66, ['#d8e4ec', '#a8bccb', '#7890a4', '#506478'], 2); rdfBx(B, 10, -62, W - 38, 22, RDF.dark, 2); for (let x = 12; x < W - 30; x += 4) rdfRc(B, x, -60, 2, 18, '#5a6670', 2); rdgBall(B, (W - 24) / 2 + 3, -51, 7, RDF.steel, 2); rdfBx(B, W - 24, -54, 18, 54, ['#e0f4ff', '#a8d8f0', '#78b0d0'], 3); rdfRc(B, W - 22, -50, 14, 46, '#2a5a80', 3); rdfLn(B, W - 30, -30, W - 24, -30, RDF.steel[2], 2); rdfRc(B, 14, -30, 20, 10, '#2a3a44', 2); },
  // 高能电池组：钢架里叠三块蓝色电芯模块，顶上一块电量屏
  hibattery: (B, W) => { rdfBx(B, 10, -66, W - 20, 66, RDF.steel, 2); for (let k = 0; k < 3; k++) { const y = -58 + k * 18; rdfBx(B, 14, y, W - 28, 15, ['#5a9ad8', '#3a72b0', '#24508a', '#163660'], 2); rdfRc(B, 18, y + 3, 4, 3, '#d84a3a', 2); rdfRc(B, W - 22, y + 3, 4, 3, RDF.dark[1], 2); for (let x = 26; x < W - 26; x += 5) rdfRc(B, x, y + 10, 3, 2, '#1a2a44', 2); } rdfBx(B, 18, -74, W - 36, 9, RDF.dark, 2); rdfLn(B, 20, -66, 20, -58, '#d84a3a', 2); },
  // 智能充电控制器（墙上）：控制箱 + 小屏 + 几根粗电缆往下走
  chargectl: (B, W) => { const c = W / 2; rdfBx(B, c - 22, 6, 44, 34, RDF.dark, 2); rdfScreen(B, c - 18, 10, 24, 14); for (let k = 0; k < 3; k++) rdfKnob(B, c + 12, 12 + k * 6); for (const [x, col] of [[c - 14, '#d84a3a'], [c - 4, '#2a2622'], [c + 8, '#e8c040']]) { rdfRc(B, x, 40, 3, 18, col, 2); } rdfRc(B, c - 20, 28, 36, 2, RDF.steel[2], 2); },
  // 大功率柴油发电机（2 格）：底座 + 黄色机壳 + 散热格栅 + 控制面板 + 竖排气管
  diesel: (B, W) => { rdfBx(B, 4, -8, W - 8, 8, RDF.dark, 2); rdfBx(B, 10, -62, W - 44, 54, RDF.yellow); for (let x = 16; x < 56; x += 4) rdfRc(B, x, -54, 2, 38, RDF.yellow[3]); rdfBx(B, 62, -54, 40, 26, RDF.dark, 2); for (let k = 0; k < 3; k++) rdfKnob(B, 68 + k * 10, -48); rdfRc(B, 68, -38, 28, 6, '#1a2a20', 2); rdfBx(B, W - 34, -50, 26, 42, RDF.steel, 2); for (let y = -46; y < -12; y += 4) rdfRc(B, W - 30, y, 18, 2, RDF.steel[3], 2); rdfBx(B, W - 30, -96, 6, 46, RDF.steel, 2); rdfBx(B, W - 32, -100, 10, 5, RDF.dark, 2); rdfRc(B, 12, -66, W - 48, 4, RDF.yellow[0]); },
  // 军用固态电池阵列（2 格）：橄榄绿储能柜，四扇门，每扇一排电量灯
  ssbattery: (B, W) => { rdfBx(B, 4, -86, W - 8, 86, RDF.olive, 2); for (let k = 0; k < 4; k++) { const x = 8 + k * (W - 16) / 4; rdfBx(B, x + 2, -80, (W - 16) / 4 - 4, 72, ['#7a7c50', '#5c5e38', '#424428'], 2); rdfRc(B, x + 6, -74, (W - 16) / 4 - 12, 3, '#2a2c1c', 2); rdfRc(B, x + (W - 16) / 4 - 10, -44, 3, 8, RDF.steel[1], 2); } rdfBx(B, 4, -92, W - 8, 6, RDF.dark, 2); for (let x = 14; x < W - 14; x += 10) rdcPix(B, x, -89, '#e8d870', 2); },
  // 外星质能方程反应堆（2 格）：紫色底座 + 两根导能柱 + 中间悬着的能量核心
  // 外星质能方程反应堆（2 格）：圆形发射台 + 上面悬浮的蓝色光球（光球本体在静态图里也画一份，图标里能看到）
  emcreactor: (B, W) => { const c = W / 2; rdfBx(B, 10, -10, W - 20, 10, ['#c8d8e8', '#8aa4c0', '#5a7494', '#3a4e68'], 2); rdfRound(B, c - 34, -18, 68, 9, 4, ['#a8c8e8', '#6a94c4', '#3a6494'], 2); rdfRound(B, c - 22, -24, 44, 7, 3, ['#2a4a78', '#1a3058'], 3); for (let x = 16; x < W - 16; x += 7) rdcPix(B, x, -5, '#73eff7', 4); for (let a = 0; a < 40; a++) { const an = a / 40 * 6.283; rdcPix(B, Math.round(c + Math.cos(an) * 18), Math.round(-21 + Math.sin(an) * 2), '#9ce8ff', 4); } rdgBall(B, c, -66, 14, ['#f0fcff', '#9ce8ff', '#41a6f6', '#2a5ab0'], 4); },
};
// 有的家具在地上 / 墙上高度不同；返回 [上方空间, 下方空间]（精细像素）
function rdfSize(v, wall) { return wall ? [10, 150] : [150, 10]; }
function rdfSprite(v, w, wall, tier) {
  const key = v + '_' + w + '_' + (wall ? 1 : 0) + '_' + (v === 'battery' ? Math.min(3, tier) : 0);
  if (RDF_CACHE[key]) return RDF_CACHE[key];
  const W = w * RD_CELL * RD_Q, [up, down] = rdfSize(v, wall), B = rdcPaper(W + 16, up + down, 8, up);
  RDF_B[v](B, W, wall, tier);
  rdcWeather(B, v.length * 13, -0.2, 9999);
  rdcOutline(B);
  const S = rdcToCanvas(B);
  // 阴影：剪影涂成深褐
  const sh = createCanvas(S.cv.width, S.cv.height), sg = sh.getContext('2d'); sg.drawImage(S.cv, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#140c08'; sg.fillRect(0, 0, sh.width, sh.height);
  S.shadow = sh;
  return (RDF_CACHE[key] = S);
}
function rdfHas(v) { return !!RDF_B[v]; }
let RDF_USE = null; // 这一帧正在被使用的家具（主角画完后再画盖在身上的被子等）

// ---------- 每帧：贴图 + 动画 ----------
function rdfDraw(g, o, xr, base, wall) {
  const p = o.p, v = p.v, w = p.w || 1, Q = RD_Q, R = G.road, t = G.time;
  const S = rdfSprite(v, w, wall, p.tier), X = Math.round((xr - w * RD_CELL) * Q) / Q, W = w * RD_CELL * Q;
  const off = p.pw > 0 && R.powered === false, using = !!(R.me.act && R.me.act.it === o.it && !R.me.walking);
  const usingNow = !!(R.me.act && R.me.act.it === o.it && !R.me.walking);
  const vib = (v === 'generator' || v === 'diesel') && R.genOn ? (Math.floor(t * 30) % 2) / Q : usingNow && R.me.act.mode === 'rummage' ? Math.round(Math.sin(t * 25)) / Q : 0; // 翻储物箱时箱子跟着晃
  if (using && (v === 'guitar' || v === 'harmonica')) return; // 拿在主角手里了
  // 阴影 + 本体
  g.globalAlpha = wall ? 0.4 : 0.22; g.drawImage(S.shadow, X - S.ox / Q + (wall ? 1 : 1.6), base - S.oy / Q + (wall ? 1.3 : -0.6), S.cv.width / Q, S.cv.height / Q);
  g.globalAlpha = 1;
  if (!wall) { g.fillStyle = 'rgba(20,12,8,0.3)'; g.fillRect(X + 1, base - 0.5, w * RD_CELL - 2, 1); }
  g.drawImage(S.cv, X - S.ox / Q + vib, base - S.oy / Q, S.cv.width / Q, S.cv.height / Q);
  // 动画（精细像素坐标）
  g.save(); g.translate(X, base); g.scale(1 / Q, 1 / Q);
  const F = (x, y, w2, h2, c, a) => { if (a != null) g.globalAlpha = a; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w2, h2); g.globalAlpha = 1; };
  const flame = (x, y, s) => { for (let k = 0; k < 6; k++) { const pp = (t * 2.2 + k / 6) % 1; F(x + Math.sin(t * 11 + k) * 2 - 1 + (k % 3 - 1) * 3 * s, y - pp * 10 * s, 3, 3, RDF.fire[Math.min(3, Math.floor(pp * 4))], 1 - pp * 0.5); } };
  const steam = (x, y, n) => { for (let k = 0; k < (n || 3); k++) { const pp = (t * 0.6 + k / (n || 3)) % 1; F(x + Math.sin(pp * 6 + k) * 4, y - pp * 30, 3 + pp * 4, 3 + pp * 4, '#f4f0e8', (1 - pp) * 0.4); } };
  const c = W / 2;
  switch (v) {
    case 'waterbed': F(20 + ((t * 20) % (W - 50)), -24, 14, 1, '#e0fcff', 0.6); F(30 + ((t * 13 + 40) % (W - 60)), -20, 10, 1, '#e0fcff', 0.4); break;
    case 'capsule': if (!off) F(14 + ((t * 30) % (W - 28)), -12, 3, 1, '#ffffff'); break;
    case 'alienpod': g.globalAlpha = 0.4 + Math.sin(t * 2) * 0.2; g.drawImage(rdsGlow('#c27bd6'), 6, -16, W - 12, 20); g.globalAlpha = 1; break;
    case 'cryo': for (let k = 0; k < 4; k++) { const pp = (t * 0.4 + k / 4) % 1; F(20 + k * 10, -18 - pp * 40, 2, 2, '#e0fcff', 1 - pp); } break;
    case 'burner': if (using) { flame(c, -10, 0.6); F(c - 12, -26, 24, 8, '#4a4640'); F(c - 12, -26, 24, 2, '#7a766e'); steam(c, -28, 2); } break;
    case 'induction': if (using) { F(18, -48, 30, 3, '#e04a3a', 0.5 + Math.sin(t * 4) * 0.2); F(16, -56, 36, 8, '#3a3632'); F(16, -56, 36, 2, '#6a665e'); F(52, -54, 14, 2, '#3a3632'); for (let k = 0; k < 3; k++) F(22 + k * 8 + Math.sin(t * 9 + k) * 1, -58, 3, 2, ['#e8a040', '#a0c060', '#d06040'][k]); steam(34, -60, 3); } break;
    case 'grill': { const gl = using ? 1 : 0.35; for (let k = 0; k < 8; k++) F(c - 18 + k * 5, -42, 3, 2, ['#ffd860', '#f08a30', '#c03a1c'][(k + Math.floor(t * 6)) % 3], gl); if (using) { for (let k = 0; k < 3; k++) { F(c - 14 + k * 10, -46, 8, 3, '#8a4a2a'); F(c - 14 + k * 10, -46, 8, 1, '#b06a3a'); } steam(c, -48, 4); } break; }
    case 'kitchen': if (using) { flame(104, -48, 0.5); F(94, -58, 26, 8, '#3a3632'); F(94, -58, 26, 2, '#6a665e'); steam(106, -60, 3); } if (!off) F(26, -42, 30, 1, '#bfe8f4', 0.5); break;
    case 'coffee': if (!off) F(40, 8, 4, 4, Math.sin(t * 3) > 0 ? '#e04a3a' : '#7a2a20'); if (using) { F(30, 22 + ((t * 20) % 8), 2, 3, '#5a3a20'); steam(32, 22, 2); } break;
    case 'synth': if (!off) { g.globalAlpha = 0.45 + Math.sin(t * 3) * 0.25; g.drawImage(rdsGlow('#73eff7'), 14, -52, W - 28, 30); g.globalAlpha = 1; for (let k = 0; k < 3; k++) { const pp = (t * 0.7 + k / 3) % 1; F(c - 3 + Math.sin(t * 2 + k) * 8, -26 - pp * 22, 4, 4, '#c8fcff', 1 - pp); } } break;
    case 'minifridge': case 'bigfridge': case 'freezer': if (using) { const big = v === 'bigfridge', fx = v === 'freezer' ? 6 : big ? W / 2 + 1 : c - 22, fw = v === 'freezer' ? W - 12 : big ? W / 2 - 7 : 44, fy = v === 'freezer' ? -44 : big ? -90 : -54, fh = v === 'freezer' ? 4 : big ? 88 : 54;
      if (v === 'freezer') { F(6, -70, W - 12, 6, '#e2ddd0'); g.globalAlpha = 0.35; g.drawImage(rdsGlow('#e0f4ff'), 6, -64, W - 12, 26); g.globalAlpha = 1; }
      else { F(fx, fy, fw, fh, '#f4ecc8'); for (let k = 1; k < 4; k++) F(fx + 2, fy + k * fh / 4, fw - 4, 1, '#bcb6a6'); F(fx + 6, fy + fh / 4 - 6, 6, 6, '#e8a040'); F(fx + 16, fy + fh / 2 - 5, 8, 5, '#a0c060'); F(fx + 8, fy + fh * 0.75 - 7, 5, 7, '#d06040'); F(fx - 12, fy, 12, fh, '#d8d2c4'); g.globalAlpha = 0.3; g.drawImage(rdsGlow('#fff4c8'), fx - 30, fy - 10, fw + 60, fh + 20); g.globalAlpha = 1; } } break;
    case 'stasis': { const y0 = wall ? 8 : -56; g.globalAlpha = 0.35 + Math.sin(t * 2) * 0.15; g.drawImage(rdsGlow('#73eff7'), 12, y0, W - 24, 48); g.globalAlpha = 1; F(14, y0 + ((t * 20) % 44), W - 28, 1, '#c8fcff', 0.6); break; }
    case 'barrel': if (using) for (let k = 0; k < 3; k++) F(c + 23, -6 + ((t * 30 + k * 3) % 8), 1, 2, '#8ac8e8'); break;
    case 'filter': if (!off && (t * 1.3) % 1 < 0.5) F(c - 1, 58 + ((t * 1.3) % 0.5) * 30, 2, 3, '#8ac8e8'); F(c - 9, 30 - ((t * 3) % 16), 2, 2, '#e0fcff', 0.6); break;
    case 'aquagen': if (!off) { F(c - 14, -36 + ((t * 6) % 18), 2, 2, '#e0fcff', 0.7); F(c - 1, -6 + ((t * 20) % 6), 2, 2, '#8ac8e8'); F(c + 17, -67, 3, 3, Math.sin(t * 4) > 0 ? '#73eff7' : '#2e7c9c'); } break;
    case 'medbed': { const sx = W - 22; for (let k = 0; k < 3; k++) { const pp = (t * 0.8 + k / 3) % 1; F(sx - 1, -78 + pp * 10, 2, 2, '#c0dce4', 1 - pp); } const mx = sx - 12; for (let x = 0; x < 24; x++) { const ph = (x + t * 30) % 24, yy = ph > 10 && ph < 13 ? (ph < 11.5 ? -5 : 4) : 0; F(mx + x, -57 + yy, 1, 1, '#60ff90'); } if (using) F(mx + 20, -62, 2, 2, '#e04a3a', Math.sin(t * 6) > 0 ? 1 : 0.3); break; }
    case 'decon': if (!off) { g.globalAlpha = 0.3; F(10, -88 + ((t * 40) % 82), W - 20, 3, '#ffffff'); g.globalAlpha = 1; if (using) for (let k = 0; k < 8; k++) F(14 + rdHash(k + Math.floor(t * 8)) * (W - 28), -84 + rdHash(k * 3 + Math.floor(t * 8)) * 76, 2, 2, '#e8ffe0', 0.7); } break;
    case 'battery': { const lv = Math.min(1, G.res.power / Math.max(1, rdStats().battery)), n = Math.round(lv * 8); for (let k = 0; k < 8; k++) F(c - 16 + k * 4, -6, 3, 2, k < n ? (lv < 0.25 ? '#e04a3a' : '#a7f070') : '#2a2622'); break; }
    case 'generator': if (R.genOn) { F(W - 14, -64, 2, 2, '#ffd060'); for (let k = 0; k < 4; k++) { const pp = (t * 1.2 + k / 4) % 1; F(W - 14 + Math.sin(pp * 5) * 3 - pp * 4, -62 - pp * 30, 4 + pp * 6, 4 + pp * 6, '#8a847c', (1 - pp) * 0.5); } F(56, -26, 3, 3, Math.sin(t * 8) > 0 ? '#a7f070' : '#3a5a2a'); } break;
    case 'fusion': if (!off) { g.globalAlpha = 0.6 + Math.sin(t * 4) * 0.25; g.drawImage(rdsGlow('#73eff7'), c - 18, -50, 36, 36); g.globalAlpha = 1; for (let k = 0; k < 2; k++) { g.strokeStyle = k ? '#c27bd6' : '#73eff7'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(c, -32, 12, 4, t * (k ? -2 : 2), 0, 7); g.stroke(); } F(c - 2, -34, 4, 4, '#ffffff'); } break;
    case 'petbowl': { const lv = Math.max(0, Math.min(1, G.road.petBowl || 0)); if (lv > 0) { F(c - 16, -12 - Math.round(lv * 2), 12, 2 + Math.round(lv * 2), '#b87a44'); for (let k = 0; k < 4; k++) F(c - 15 + k * 3, -13 - Math.round(lv * 2), 2, 1, '#d89a5c'); } break; } // 碗里的粮：吃一次少一截
    case 'planter': if (!off) { F(10, -71, W - 20, 2, '#f8e0ff', 0.9); g.globalAlpha = 0.18; F(10, -69, W - 20, 40, '#f0b0e0'); g.globalAlpha = 1; } break;
    case 'protein': if (!off) { for (let k = 0; k < 4; k++) { const pp = (t * 0.5 + k / 4) % 1; F(c - 9 + k * 5, -42 - pp * 28, 2, 2, '#c8ffd8', 1 - pp); } F(W - 16, -26, 3, 3, Math.sin(t * 2) > 0 ? '#a7f070' : '#3a5a2a'); } break;
    case 'condenser': if (!off) { const a = t * 12; g.fillStyle = '#c8d4dc'; for (let k = 0; k < 3; k++) { const an = a + k * 2.09; g.fillRect((W - 24) / 2 + 3 + Math.cos(an) * 5 - 1, -51 + Math.sin(an) * 5 - 1, 2, 2); } const lv = 0.35 + ((t * 0.05) % 0.6); F(W - 22, -4 - 46 * lv, 14, 46 * lv, '#41a6f6', 0.55); if ((t * 1.5) % 1 < 0.4) F(W - 16, -50 + ((t * 1.5) % 1) * 30, 2, 3, '#c8f0ff'); } break;
    case 'hibattery': { const lv = Math.min(1, G.res.power / Math.max(1, rdStats().battery)), n = Math.round(lv * 10); for (let k = 0; k < 10; k++) F(22 + k * (W - 44) / 10, -71, (W - 44) / 10 - 1, 3, k < n ? (lv < 0.25 ? '#e04a3a' : '#73eff7') : '#2a2622'); break; }
    case 'chargectl': if (!off) { const net = R.powNet || 0; F(c - 16, 12, 20, 10, net >= 0 ? '#1a3a2a' : '#3a1a1a'); for (let k = 0; k < 4; k++) F(c - 14 + k * 5, 20 - (2 + ((t * 6 + k * 3) % 6)), 3, 2 + ((t * 6 + k * 3) % 6), net >= 0 ? '#a7f070' : '#e04a3a'); F(c + 16, 34, 3, 3, Math.sin(t * 5) > 0 ? '#a7f070' : '#3a5a2a'); } break;
    case 'diesel': if (R.genOn) { F(70, -36, 20, 2, '#a7f070'); for (let k = 0; k < 5; k++) { const pp = (t * 1.4 + k / 5) % 1; F(W - 30 + Math.sin(pp * 5) * 3 - pp * 6, -104 - pp * 36, 5 + pp * 8, 5 + pp * 8, '#6a665e', (1 - pp) * 0.55); } F(W - 30, -101, 4, 3, '#ffd060', 0.6 + Math.sin(t * 20) * 0.3); } else F(70, -36, 6, 2, '#5a3a2a'); break;
    case 'ssbattery': { const lv = Math.min(1, G.res.power / Math.max(1, rdStats().battery)); for (let k = 0; k < 4; k++) { const x = 8 + k * (W - 16) / 4 + 6; for (let j = 0; j < 6; j++) F(x + 4, -20 - j * 7, 6, 4, (j + 0.5) / 6 < lv ? (lv < 0.25 ? '#e04a3a' : '#a7f070') : '#2a2c1c'); } break; }
    case 'emcreactor': if (!off) { // 蓝色光球：上下浮动、呼吸发光、两圈光环、往上飘的光点、底座射上去的光柱
      const cy = -66 + Math.sin(t * 1.4) * 5, pulse = 0.55 + Math.sin(t * 3) * 0.2;
      F(c - 6, cy, 12, -20 - cy, '#73eff7', 0.12 + Math.sin(t * 5) * 0.05);
      g.globalAlpha = pulse; g.drawImage(rdsGlow('#41a6f6'), c - 46, cy - 46, 92, 92); g.globalAlpha = 0.9; g.drawImage(rdsGlow('#9ce8ff'), c - 24, cy - 24, 48, 48); g.globalAlpha = 1;
      rdkCircle(g, c, cy, 13, '#41a6f6'); rdkCircle(g, c, cy, 10, '#9ce8ff'); rdkCircle(g, c - 3, cy - 3, 5, '#f0fcff');
      for (let k = 0; k < 2; k++) { g.strokeStyle = k ? '#9ce8ff' : '#41a6f6'; g.lineWidth = 1.5; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(c, cy, 22 + k * 7, 5 + k * 2, t * (k ? -1.2 : 1.6), 0, 7); g.stroke(); } g.globalAlpha = 1;
      for (let k = 0; k < 6; k++) { const pp = (t * 0.6 + k / 6) % 1, ang = k * 1.05 + t * 0.5; F(c + Math.cos(ang) * (16 + pp * 10), cy + 14 - pp * 50, 2, 2, '#c8f4ff', 1 - pp); }
    } break;
    case 'capwall': { const lv = Math.min(1, G.res.power / Math.max(1, rdStats().battery)); for (let k = 0; k < 5; k++) { const hh = Math.round(36 * lv); F(12 + k * 13, 46 - hh, 6, hh, '#73eff7', 0.5 + Math.sin(t * 3 + k) * 0.2); } break; }
  }
  rdfAnim2(g, v, W, c, using, off, wall, t, F, steam);
  if (p.tier >= 6 && !wall) F(4, -2, W - 8, 1, '#73eff7', 0.3 + Math.sin(t * 3) * 0.15);
  if (off) F(W - 14, wall ? 6 : -12, 4, 4, '#d84a3a');
  g.restore();
  if (using) RDF_USE = { v, X, base, W, wall };
}
// 主角画完之后：睡觉时盖上被子
function rdfOverlay(g) {
  const U = RDF_USE; RDF_USE = null;
  if (!U) return;
  const a = G.road.me.act; if (!a || a.type !== 'sleep') return;
  const Q = RD_Q, cols = { sleepbag: RDF.blue, mattress: RDF.orange, bunk: RDF.red, bigbed: RDF.plum, waterbed: RDF.blue, cot: RDF.olive, cardboard: RDF.red };
  const R2 = cols[U.v]; if (!R2) return;
  const y = { sleepbag: -12, mattress: -34, bunk: -28, bigbed: -33, waterbed: -31, cot: -32, cardboard: -10 }[U.v];
  const x0 = U.v === 'sleepbag' ? 22 : U.v === 'bigbed' ? 50 : U.v === 'bunk' ? 26 : 34, x1 = U.W - 8;
  g.save(); g.translate(U.X, U.base); g.scale(1 / Q, 1 / Q);
  const breathe = Math.round(Math.sin(G.time * 1.6));
  // 被子盖住真人比例的身体（躺着约 20 精细像素厚，屈腿睡时膝盖拱起来更高）
  const curl = U.W < 2 * RD_CELL * Q, th = 20;
  for (let x = x0; x < x1; x++) {
    const kn = curl ? Math.max(0, 14 - Math.abs(x - (x0 + 32)) * 0.7) : 0; // 膝盖拱起的鼓包
    const h = th + Math.round(kn) + (x < x0 + 30 ? breathe : 0), top = y + 9 - h;
    for (let k = 0; k < h; k++) { g.fillStyle = rdcRampAt(R2, 0.1 + k / h * 0.7, x, k); g.fillRect(x, top + k, 1, 1); }
    g.fillStyle = R2[0]; g.fillRect(x, top, 1, 1);
  }
  g.restore();
}

// =============== 第 9 步：电脑、工作台、娱乐、装饰、生活、储物 ===============
function rdfPcStool(B, x) { rdfBx(B, x, -22, 22, 4, RDF.dark, 2); rdfRound(B, x + 1, -26, 20, 5, 2, RDF.red, 1, 0.1); for (const lx of [x + 2, x + 17]) rdfLeg(B, lx, -18, 0, RDF.steel); rdfRc(B, x + 4, -8, 14, 2, RDF.steel[2], 2); }
function rdfShelf(B, x, y, w) { rdfBx(B, x, y, w, 4, RDF.wood); rdfLn(B, x + 4, y + 4, x + 10, y + 10, RDF.wood[3]); rdfLn(B, x + w - 4, y + 4, x + w - 10, y + 10, RDF.wood[3]); }
function rdfScreen(B, x, y, w, h, frame) { rdfBx(B, x, y, w, h, frame || RDF.dark, 2); rdfRc(B, x + 2, y + 2, w - 4, h - 4, '#1a2a30', 3); rdfLn(B, x + 3, y + 3, x + 8, y + 3, '#4a6a74', 3); }
Object.assign(RDF_B, {
  // ---- 电脑 ----
  // 电脑放在桌上：左边一张凳子（主角坐着，面朝右边的桌子），右边是小桌 + 电脑
  laptop: (B, W) => { rdfBx(B, 44, -40, W - 44, 5, RDF.wood); for (const x of [48, W - 5]) rdfBx(B, x, -35, 4, 35, RDF.wood); rdfRc(B, 52, -14, W - 57, 2, RDF.wood[2]); rdfBx(B, 52, -43, 24, 3, RDF.steel, 2); rdfScreen(B, 56, -60, 19, 17, RDF.steel); rdfPcStool(B, 30); },
  carpc: (B, W) => { rdfBx(B, 44, -40, W - 44, 5, RDF.wood); for (const x of [48, W - 5]) rdfBx(B, x, -35, 4, 35, RDF.wood); rdfBx(B, 58, -32, 14, 32, RDF.dark, 2); for (let y = -28; y < -18; y += 3) rdfRc(B, 61, y, 8, 1, '#3a3632', 2); rdcPix(B, 64, -8, '#a7f070', 4); rdfBx(B, 62, -46, 6, 6, RDF.dark, 2); rdfScreen(B, 52, -72, 26, 26); rdfBx(B, 46, -43, 12, 3, ['#3a3632', '#2a2622'], 2); rdfPcStool(B, 30); },
  terminal: (B, W) => { const c = W / 2; rdfBx(B, c - 26, -30, 52, 30, RDF.olive); for (const x of [c - 22, c + 18]) rdfBx(B, x, -26, 4, 4, RDF.dark, 2); rdfBx(B, c - 22, -72, 44, 40, RDF.olive, 2); rdfScreen(B, c - 18, -68, 36, 26); rdfBx(B, c - 20, -38, 40, 6, RDF.dark, 2); for (let x = c - 18; x < c + 18; x += 3) rdcPix(B, x, -36, RDF.dark[0], 2); },
  quantum: (B, W) => { rdfBx(B, 4, -96, W - 8, 96, RDF.white); for (let k = 0; k < 5; k++) { const x = 10 + k * (W - 20) / 5; rdfBx(B, x, -90, (W - 20) / 5 - 4, 84, ['#3a4a64', '#2a3850', '#1e283a'], 2); for (let y = -84; y < -10; y += 6) rdfRc(B, x + 2, y, (W - 20) / 5 - 8, 1, '#4a5a78', 2); } rdfBx(B, 2, -100, W - 4, 5, RDF.steel, 2); },
  aicore: (B, W) => { const c = W / 2; rdfBx(B, c - 18, -16, 36, 16, ['#3e2c64', '#2e1f50', '#20143a'], 2); rdfBx(B, c - 12, -22, 24, 6, RDF.purple, 2); for (let x = c - 14; x < c + 14; x += 5) rdcPix(B, x, -8, RDF.glow2, 4); },
  // ---- 工作台 ----
  toolwall: (B, W) => { rdfBx(B, 4, 2, W - 8, 56, RDF.card); for (let y = 6; y < 56; y += 5) for (let x = 8; x < W - 8; x += 5) rdcPix(B, x, y, RDF.card[3]); rdfRc(B, 12, 10, 3, 22, RDF.wood[2]); rdfBx(B, 9, 8, 10, 5, RDF.steel, 2); rdfLn(B, 26, 10, 26, 36, RDF.steel[2], 2); rdfBx(B, 23, 8, 7, 5, RDF.steel, 2); rdfRc(B, 25, 36, 3, 10, '#d84a3a'); rdfLn(B, 38, 10, 38, 40, RDF.steel[1], 2); for (let y = 10; y < 40; y += 2) rdcPix(B, 39, y, RDF.steel[3], 2); rdfRc(B, 36, 40, 5, 8, RDF.wood[1]); for (let k = 0; k < 4; k++) { rdfRc(B, 50 + k * 5, 12, 2, 14, RDF.steel[1], 2); rdfRc(B, 50 + k * 5, 26, 2, 8, ['#e8a040', '#d84a3a', '#5a88b4', '#a0c060'][k]); } },
  bench: (B, W) => { rdfBx(B, 2, -40, W - 4, 6, RDF.wood); rdfBx(B, 6, -16, W - 12, 3, RDF.wood); for (const x of [6, W - 10]) rdfBx(B, x, -34, 4, 34, RDF.wood); rdfBx(B, W - 26, -50, 18, 10, RDF.steel, 2); rdfRc(B, W - 30, -46, 4, 2, RDF.steel[3], 2); rdfBx(B, 10, -48, 16, 8, ['#d84a3a', '#a8301e'], 2); rdfRc(B, 30, -44, 12, 2, RDF.steel[2], 2); rdfRc(B, 40, -46, 3, 6, RDF.wood[2]); rdfBx(B, 12, -26, 20, 10, RDF.card); },
  workshop: (B, W) => { RDF_B.bench(B, 80); rdfBx(B, 92, -96, 50, 96, RDF.steel, 2); rdfBx(B, 98, -88, 38, 16, RDF.dark, 2); rdfLn(B, 116, -72, 116, -48, RDF.steel[3], 2); rdfBx(B, 104, -44, 26, 6, RDF.dark, 2); rdfRc(B, 98, -24, 38, 3, '#e8a040'); rdfRc(B, 100, -94, 8, 4, '#e04a3a', 4); rdfLn(B, 86, -110, 96, -96, RDF.steel[2], 2); rdfBx(B, 80, -116, 12, 6, RDF.yellow, 2); },
  printer: (B, W) => { const c = W / 2; for (const x of [c - 22, c + 18]) rdfBx(B, x, -72, 4, 72, RDF.dark, 2); rdfBx(B, c - 22, -76, 44, 4, RDF.dark, 2); rdfBx(B, c - 18, -18, 36, 4, RDF.steel, 2); rdfBx(B, c - 22, -6, 44, 6, RDF.dark, 2); rdfRc(B, c - 16, -4, 10, 2, '#73eff7', 4); },
  // ---- 娱乐 ----
  radio: (B, W) => { const c = W / 2; rdfShelf(B, c - 24, 46, 48); rdfRound(B, c - 20, 22, 40, 24, 4, RDF.wood); rdfBx(B, c - 16, 26, 16, 16, ['#5a4a3a', '#3a2e24'], 2); for (let y = 27; y < 41; y += 2) rdfRc(B, c - 15, y, 14, 1, '#2a2018', 2); rdfRc(B, c + 3, 28, 13, 6, '#f0d890', 3); rdfLn(B, c + 4, 31, c + 14, 31, '#8a5a2a', 3); rdfKnob(B, c + 6, 38); rdfKnob(B, c + 12, 38); rdfLn(B, c + 14, 22, c + 22, 4, RDF.steel[2], 2); },
  harmonica: (B, W) => { const c = W / 2; rdfShelf(B, c - 18, 46, 36); rdfBx(B, c - 12, 40, 24, 6, RDF.steel, 2); for (let x = c - 10; x < c + 10; x += 3) rdcPix(B, x, 43, RDF.dark[2], 2); },
  shelf: (B, W) => { rdfBx(B, 6, 2, W - 12, 58, RDF.wood); for (let r = 0; r < 3; r++) { const y = 4 + r * 19; rdfRc(B, 8, y, W - 16, 17, RDF.wood[3]); let x = 10; while (x < W - 12) { const bw = 3 + Math.floor(rdcHash(x, r, 4) * 4), bh = 11 + Math.floor(rdcHash(x, r, 5) * 5); rdfBx(B, x, y + 17 - bh, bw, bh, [['#c86a54', '#984a3a'], ['#5a88b4', '#3a6088'], ['#8ab45e', '#5e8a3c'], ['#e8c070', '#b0883a'], ['#a07cc8', '#6c4aa4']][Math.floor(rdcHash(x, r, 6) * 5)]); x += bw + 1; } rdfRc(B, 6, y + 17, W - 12, 2, RDF.wood[0]); } },
  puzzle: (B, W) => { const c = W / 2; rdfBx(B, c - 26, 8, 52, 36, RDF.wood); rdfRc(B, c - 22, 12, 44, 28, '#c8b890'); for (let y = 12; y < 40; y++) for (let x = c - 22; x < c + 22; x++) { const done = rdcNoise2(x / 10, y / 10, 3) > 0.42; if (!done) continue; const sky = y < 26; rdcPix(B, x, y, sky ? rdcRampAt(RDF.blue, (y - 12) / 14, x, y) : rdcRampAt(RDF.green, (y - 26) / 14, x, y)); if ((x - c) % 9 === 0 || (y - 12) % 9 === 0) rdcPix(B, x, y, '#6a6250'); } },
  guitar: (B, W) => { const c = W / 2; rdfRc(B, c - 1, 2, 3, 3, RDF.steel[3], 2); rdfBx(B, c - 3, 4, 6, 8, RDF.wood); rdfRc(B, c - 1, 12, 3, 22, RDF.wood[3]); rdfRound(B, c - 9, 32, 18, 12, 5, RDF.orange); rdfRound(B, c - 11, 42, 22, 16, 6, RDF.orange); rdcPix(B, c, 44, '#2a1a10'); rdfRc(B, c - 2, 43, 4, 3, '#2a1a10'); rdfRc(B, c - 4, 52, 8, 2, RDF.wood[3]); },
  tv: (B, W) => { const c = W / 2; rdfRc(B, c - 4, 2, 8, 6, RDF.dark[1], 2); rdfScreen(B, c - 30, 8, 60, 40); rdfRc(B, c - 8, 48, 16, 3, RDF.dark[2], 2); },
  console: (B, W) => { const c = W / 2; rdfScreen(B, c - 26, 4, 52, 32); rdfShelf(B, c - 26, 48, 52); rdfBx(B, c - 16, 40, 22, 8, RDF.white, 2); rdfRc(B, c - 14, 44, 3, 1, '#73eff7', 4); rdfRound(B, c + 10, 42, 12, 6, 2, RDF.dark, 2); },
  dumbbell: (B, W) => { const c = W / 2; rdfBx(B, c - 22, -30, 44, 4, RDF.dark, 2); for (const x of [c - 22, c + 18]) rdfBx(B, x, -26, 4, 26, RDF.dark, 2); for (let k = 0; k < 3; k++) { const x = c - 16 + k * 12; rdfRc(B, x + 2, -36, 6, 2, RDF.steel[2], 2); rdfBx(B, x, -40, 3, 10, RDF.dark, 2); rdfBx(B, x + 7, -40, 3, 10, RDF.dark, 2); rdfRc(B, x + 2, -16, 6, 2, RDF.steel[2], 2); rdfBx(B, x, -20, 3, 10, RDF.dark, 2); rdfBx(B, x + 7, -20, 3, 10, RDF.dark, 2); } },
  beanbag: (B, W) => { const c = W / 2; rdfRound(B, c - 28, -30, 56, 30, 13, RDF.orange); rdfRound(B, c - 20, -36, 30, 16, 8, RDF.orange, 1, 0); },
  record: (B, W) => { const c = W / 2; rdfBx(B, c - 26, -30, 52, 30, RDF.wood); rdfRc(B, c - 22, -24, 44, 1, RDF.wood[3]); rdfBx(B, c - 26, -36, 52, 6, RDF.dark, 2); rdfLn(B, c + 16, -38, c + 6, -40, RDF.steel[1], 2); },
  speaker: (B, W) => { for (const x of [6, W - 30]) { rdfBx(B, x, -72, 24, 72, RDF.dark, 2); rdgBall(B, x + 12, -52, 8, ['#6a6460', '#46403a', '#2a2622'], 2); rdgBall(B, x + 12, -24, 10, ['#6a6460', '#46403a', '#2a2622'], 2); rdcPix(B, x + 12, -63, '#73eff7', 4); } },
  treadmill: (B, W) => { rdfBx(B, 4, -10, W - 8, 10, RDF.dark, 2); rdfBx(B, 6, -12, W - 12, 2, ['#3a3632', '#2a2622'], 2); rdfLn(B, W - 16, -12, W - 10, -60, RDF.steel[2], 2); rdfLn(B, W - 14, -12, W - 8, -60, RDF.steel[3], 2); rdfBx(B, W - 26, -66, 22, 8, RDF.dark, 2); rdfRc(B, W - 22, -64, 10, 3, '#1a2a30', 3); },
  aquarium: (B, W) => { const c = W / 2; rdfBx(B, c - 30, -40, 60, 40, RDF.wood); rdfRc(B, c - 26, -34, 52, 1, RDF.wood[3]); rdfBx(B, c - 30, -100, 60, 60, ['#6a8ab0', '#4a6a90'], 3); for (let y = -96; y < -42; y++) for (let x = c - 28; x < c + 28; x++) rdcPix(B, x, y, rdcRampAt(['#7ac0d8', '#4a98b8', '#2a6a90'], (y + 96) / 54, x, y), 3); rdfRc(B, c - 28, -46, 56, 4, '#c8b890', 3); for (let k = 0; k < 4; k++) for (let y = 0; y < 14 + k * 3; y++) rdcPix(B, c - 22 + k * 12 + Math.round(Math.sin(y * 0.5) * 1.5), -46 - y, k % 2 ? '#5aa04a' : '#3a7a3a', 3); rdfBx(B, c - 32, -104, 64, 4, RDF.dark, 2); },
  sofa: (B, W) => { rdfRound(B, 4, -50, W - 8, 30, 6, RDF.green); rdfRound(B, 4, -32, W - 8, 22, 5, RDF.green); for (const x of [2, W - 16]) rdfRound(B, x, -40, 14, 30, 5, RDF.green, 1, 0.3); for (let k = 0; k < 2; k++) rdfRound(B, 18 + k * ((W - 36) / 2), -36, (W - 36) / 2 - 2, 10, 4, RDF.green, 1, 0); rdfRound(B, 22, -46, 16, 14, 4, RDF.orange, 1, 0); for (const x of [8, W - 12]) rdfBx(B, x, -10, 4, 10, RDF.wood); },
  massage: (B, W) => { const c = W / 2; rdfRound(B, c - 24, -74, 20, 50, 6, RDF.dark); rdfRound(B, c - 24, -36, 48, 18, 6, RDF.dark); rdfRound(B, c + 10, -26, 22, 12, 5, RDF.dark); rdfBx(B, c - 20, -18, 34, 18, RDF.dark, 2); rdfRc(B, c - 10, -30, 10, 4, '#3a3a40', 2); rdcPix(B, c - 8, -29, '#73eff7', 4); },
  projector: (B, W) => { rdfRc(B, 8, 2, W - 16, 3, RDF.dark[1], 2); rdfBx(B, 12, 5, W - 24, 52, RDF.white); rdfRc(B, 12, 57, W - 24, 2, RDF.dark[2], 2); rdfBx(B, W - 30, 0, 22, 8, RDF.dark, 2); },
  karaoke: (B, W) => { const c = W / 2; rdfBx(B, c - 22, -52, 30, 52, RDF.plum, 2); rdfScreen(B, c - 18, -48, 22, 16); for (let k = 0; k < 4; k++) rdfKnob(B, c - 16 + k * 5, -24); rdgBall(B, c - 7, -10, 6, RDF.dark, 2); rdfLn(B, c + 18, 0, c + 18, -60, RDF.steel[2], 2); rdfLn(B, c + 12, 0, c + 24, 0, RDF.steel[2], 2); rdgBall(B, c + 18, -64, 3, RDF.steel, 2); },
  pool: (B, W) => { rdfBx(B, 4, -40, W - 8, 8, RDF.wood); rdfRc(B, 8, -42, W - 16, 3, '#3a8a4a'); rdfRc(B, 8, -43, W - 16, 1, '#5aaa6a'); for (const x of [6, W / 2 - 3, W - 12]) rdfRc(B, x, -42, 6, 3, '#1a1612'); for (const x of [10, W - 18]) rdfBx(B, x, -32, 8, 32, RDF.wood); rdgBall(B, 50, -45, 2, ['#ffffff', '#d8d8d0']); rdgBall(B, 90, -45, 2, ['#e04a3a', '#a8301e']); rdgBall(B, 98, -45, 2, ['#f0c040', '#b08a20']); },
  holo: (B, W) => { rdfBx(B, 6, -8, W - 12, 8, ['#4a3a6a', '#3a2a58', '#281a40'], 2); for (let x = 12; x < W - 12; x += 8) rdcPix(B, x, -5, RDF.glow, 4); rdfRc(B, 10, -9, W - 20, 1, RDF.glow, 4); },
  easel: (B, W) => { const c = W / 2; rdfLn(B, c - 16, 0, c - 4, -80, RDF.wood[2]); rdfLn(B, c + 16, 0, c + 4, -80, RDF.wood[2]); rdfLn(B, c, -10, c, -84, RDF.wood[3]); rdfBx(B, c - 22, -80, 44, 36, RDF.white); for (let y = -78; y < -46; y++) for (let x = c - 20; x < c + 20; x++) { const u = (y + 78) / 32; let col = rdcRampAt(['#f0b070', '#e08060', '#a06080'], u * 1.4, x, y); if (y > -60 + Math.round(Math.sin(x / 6) * 3)) col = rdcRampAt(RDF.green, (y + 60) / 14, x, y); if ((x - c - 8) ** 2 + (y + 66) ** 2 < 16) col = '#fff0c0'; rdcPix(B, x, y, col); } rdfRc(B, c - 24, -44, 48, 3, RDF.wood[1]); },
  desk: (B, W) => { rdfBx(B, 4, -36, W - 8, 5, RDF.wood); for (const x of [6, W - 10]) rdfBx(B, x, -31, 4, 31, RDF.wood); rdfBx(B, W - 34, -30, 24, 16, RDF.wood); rdfKnob(B, W - 23, -23); for (let k = 0; k < 3; k++) rdfBx(B, 10, -42 - k * 3, 18, 3, [['#c86a54', '#984a3a'], ['#5a88b4', '#3a6088'], ['#e8c070', '#b0883a']][k]); rdfLn(B, 44, -36, 40, -56, RDF.dark[1], 2); rdfBx(B, 34, -62, 16, 6, RDF.green, 2); rdfRound(B, 56, -44, 8, 8, 2, RDF.white); },
  table: (B, W) => { const c = W / 2; rdfBx(B, c - 24, -32, 48, 4, RDF.wood); rdfBx(B, c - 3, -28, 6, 26, RDF.wood); rdfBx(B, c - 12, -3, 24, 3, RDF.wood); for (const d of [-1, 1]) { const x = c + d * 30; rdfBx(B, x - 6, -22, 12, 3, RDF.wood); rdfLn(B, x + d * 5, -22, x + d * 6, -52, RDF.wood[2]); rdfLn(B, x - 5, -19, x - 5, 0, RDF.wood[2]); rdfLn(B, x + 5, -19, x + 5, 0, RDF.wood[2]); } rdfRound(B, c - 10, -38, 10, 6, 2, RDF.white); rdfBx(B, c + 4, -42, 5, 10, ['#e8e4d8', '#c8c0b0'], 3); },
  // ---- 装饰 ----
  poster: (B, W) => { const c = W / 2; rdfBx(B, c - 18, 4, 36, 50, RDF.sheet); for (let y = 8; y < 50; y++) for (let x = c - 15; x < c + 15; x++) { let col = rdcRampAt(['#f0a060', '#c86a5a', '#6a4a7a'], (y - 8) / 30, x, y); if (y > 34 - Math.abs(x - c) * 0.6) col = '#3a2a3a'; if ((x - c) ** 2 + (y - 22) ** 2 < 25) col = '#ffe090'; if (y > 44) col = (x % 4 < 2 && y < 48) ? '#2a2018' : '#e8e0c8'; rdcPix(B, x, y, col); } for (const [x, y] of [[c - 19, 3], [c + 15, 3]]) rdfRc(B, x, y, 5, 3, '#e8e0b8', 3); rdfLn(B, c + 18, 40, c + 12, 54, RDF.sheet[2]); },
  curtain: (B, W) => { rdfRc(B, 4, 1, W - 8, 2, RDF.wood[2]); for (const [x0, x1] of [[6, 26], [W - 26, W - 6]]) for (let x = x0; x < x1; x++) for (let y = 3; y < 60; y++) { const pinch = y > 30 && y < 36; rdcPix(B, x, y, rdcRampAt(RDF.red, 0.2 + ((x - x0) % 5) / 5 * 0.6 + (pinch ? 0.3 : 0), x, y)); } for (const x of [6, W - 26]) rdfRc(B, x, 32, 20, 2, '#e8c070'); },
  lights: (B, W) => { for (let x = 2; x < W - 2; x++) rdcPix(B, x, 4 + Math.round(Math.sin((x - 2) / (W - 4) * Math.PI) * 8), RDF.dark[1], 2); },
  wallpaper: (B, W) => { const c = W / 2; rdfRound(B, c - 18, 20, 36, 12, 5, ['#e8d0a8', '#c8a878', '#a08458'], 1); for (let x = c - 16; x < c + 16; x += 6) rdfRc(B, x, 22, 2, 8, '#a86a5a'); },
  heater: (B, W) => { const c = W / 2; rdfBx(B, c - 20, -44, 40, 40, RDF.white); for (let x = c - 16; x < c + 16; x += 6) rdfRc(B, x, -40, 4, 32, RDF.white[2]); for (const x of [c - 16, c + 12]) rdfBx(B, x, -4, 4, 4, RDF.dark, 2); rdfKnob(B, c + 14, -48); },
  ac: (B, W) => { rdfRound(B, 6, 2, W - 12, 22, 4, RDF.white); for (let x = 10; x < W - 10; x += 3) rdfRc(B, x, 18, 1, 4, RDF.white[3]); rdcPix(B, W - 14, 6, '#60ff90', 4); },
  diffuser: (B, W) => { const c = W / 2; rdfShelf(B, c - 16, 46, 32); rdfRound(B, c - 8, 32, 16, 14, 6, RDF.white); rdfRc(B, c - 2, 30, 4, 3, RDF.white[2]); },
  photo: (B, W) => { const c = W / 2; rdfBx(B, c - 16, 10, 32, 26, RDF.wood); rdfRc(B, c - 12, 14, 24, 18, '#d8e4ec'); rdgBall(B, c - 6, 22, 3, ['#c8906a', '#a06a4a']); rdfRc(B, c - 9, 26, 7, 6, '#5a88b4'); rdgBall(B, c + 4, 23, 3, ['#c8906a', '#a06a4a']); rdfRc(B, c + 1, 27, 7, 5, '#c86a54'); rdgBall(B, c - 1, 27, 2, ['#e0b090', '#b08060']); },
  plant: (B, W) => { const c = W / 2; rdfBx(B, c - 10, -22, 20, 22, RDF.orange); rdfRc(B, c - 12, -24, 24, 3, RDF.orange[0]); rdfLn(B, c, -24, c - 2, -50, RDF.green[3]); for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.45, L = 14 + (k % 3) * 6; rdfLn(B, c, -30 - (k % 2) * 10, c + Math.cos(a) * L, -30 - (k % 2) * 10 + Math.sin(a) * L, RDF.green[2]); rdfRound(B, Math.round(c + Math.cos(a) * L) - 5, Math.round(-30 - (k % 2) * 10 + Math.sin(a) * L) - 4, 10, 8, 3, RDF.green, 1, 0); } },
  rug: (B, W) => { for (let x = 4; x < W - 4; x++) for (let y = -3; y < 0; y++) rdcPix(B, x, y, ((x >> 2) + y) % 3 === 0 ? '#e8c070' : ((x >> 3) & 1) ? '#b84a3a' : '#8a3a2e'); for (let x = 2; x < W - 2; x += 2) rdcPix(B, x, -1, '#e8d8a8'); },
  ecowall: (B, W) => { rdfBx(B, 4, 2, W - 8, 58, ['#3a4a2e', '#2c3a22', '#1e2a18'], 2); for (let k = 0; k < W / 3; k++) { const x = 6 + rdcHash(k, 1, 2) * (W - 12), y = 4 + rdcHash(k, 2, 2) * 52; rdfRound(B, Math.round(x), Math.round(y), 6, 5, 2, k % 3 ? RDF.green : ['#c8e890', '#a0c860', '#78a040'], 1, 0); } for (let x = 8; x < W - 8; x += 14) rdcPix(B, x, 30, RDF.glow, 4); },
  // ---- 生活 ----
  shower: (B, W) => { rdfBx(B, 4, -110, W - 8, 110, RDF.white); for (let y = -106; y < -4; y += 8) for (let x = 6; x < W - 6; x += 8) rdfRc(B, x, y, 7, 7, '#e8ecee'); rdfRc(B, 4, -110, W - 8, 4, RDF.steel[2], 2); rdfLn(B, W / 2, -106, W / 2 + 10, -96, RDF.steel[2], 2); rdfBx(B, W / 2 + 6, -96, 10, 3, RDF.steel, 2); rdfRc(B, 4, -4, W - 8, 4, RDF.steel[3], 2); for (let x = 8; x < W - 8; x += 3) rdcPix(B, x, -60 + ((x * 7) % 9), '#c8e4f0', 3); },
  bath: (B, W) => { RDF_B.shower(B, 70); rdfRound(B, 76, -34, W - 80, 34, 8, RDF.white); rdfRc(B, 80, -32, W - 88, 4, '#8ac8e8', 3); for (let k = 0; k < 5; k++) rdgBall(B, 86 + k * 12, -33, 3, ['#ffffff', '#e0ecf0'], 3); },
  washer: (B, W) => { const c = W / 2; rdfRound(B, c - 24, -60, 48, 60, 3, RDF.white); rdfRc(B, c - 22, -54, 44, 1, RDF.white[3]); rdgBall(B, c, -28, 15, RDF.steel, 2); rdgBall(B, c, -28, 11, ['#4a6a90', '#2a4a70', '#1a2e48'], 3); rdfKnob(B, c + 14, -58); rdfRc(B, c - 18, -58, 10, 3, '#73eff7', 4); },
  petbed: (B, W) => { const c = W / 2; rdfRound(B, c - 26, -16, 52, 16, 7, RDF.red); rdfRound(B, c - 20, -12, 40, 8, 4, ['#f0d0b8', '#d8b098', '#b89078'], 1); rdgBall(B, c + 18, -18, 4, ['#a0c8e8', '#6a94bc']); },
  cattree: (B, W) => { const c = W / 2; for (const [x, y0, y1] of [[c - 4, -90, 0], [c - 22, -44, -10]]) for (let y = y0; y < y1; y++) for (let k = 0; k < 8; k++) rdcPix(B, x + k, y, ((y + k) % 3 === 0) ? '#a8946a' : '#d8c08e'); rdfRound(B, c - 24, -96, 48, 8, 3, RDF.red); rdfRound(B, c - 30, -50, 30, 8, 3, RDF.red); rdfRound(B, c - 30, -8, 60, 8, 3, RDF.red); rdfLn(B, c + 18, -88, c + 18, -66, RDF.dark[1]); rdgBall(B, c + 18, -64, 3, ['#f0d070', '#c8a040']); },
  grow: (B, W) => { for (const x of [6, W - 10]) rdfBx(B, x, -86, 4, 86, RDF.wood); for (const y of [-80, -42, -6]) rdfBx(B, 6, y, W - 12, 4, RDF.wood); for (let k = 0; k < 4; k++) for (const y of [-42, -80]) { const x = 12 + k * (W - 24) / 4; rdfBx(B, x, y - 8, 12, 8, RDF.orange); for (let l = 0; l < 4; l++) rdfRound(B, x + l * 3 - 1, y - 16 - (l % 2) * 4, 6, 6, 2, RDF.green, 1, 0); } rdfRc(B, 8, -86, W - 16, 3, '#f0d8e8', 4); },
  hydro: (B, W) => { rdfBx(B, 6, -96, W - 12, 96, RDF.white); rdfRc(B, 10, -90, W - 20, 84, '#3a2a48', 3); for (const y of [-60, -26]) { rdfRc(B, 10, y, W - 20, 3, RDF.white[2]); for (let k = 0; k < 5; k++) rdfRound(B, 14 + k * (W - 28) / 5, y - 12, 8, 12, 3, RDF.green, 1, 0); } },
  boxes: (B, W) => { rdfBx(B, 6, -30, 32, 30, RDF.card); rdfBx(B, 40, -24, 30, 24, RDF.card); rdfBx(B, 14, -50, 28, 20, RDF.card); for (const [x, y, w] of [[6, -30, 32], [40, -24, 30], [14, -50, 28]]) { rdfRc(B, x + w / 2 - 3, y, 6, 1, '#d8cca0'); rdfRc(B, x + 4, y + 8, 10, 6, '#f0ecdc'); } },
  rack: (B, W) => { for (const x of [6, W - 10]) rdfBx(B, x, -96, 4, 96, RDF.steel, 2); for (let r = 0; r < 3; r++) { const y = -90 + r * 30; rdfRc(B, 6, y + 24, W - 12, 3, RDF.steel[2], 2); rdfBx(B, 12, y + 8, 22, 16, [RDF.card, RDF.blue, RDF.green][r]); rdfBx(B, 38, y + 12, 14, 12, [RDF.yellow, RDF.card, RDF.red][r]); rdfBx(B, 56, y + 14, 10, 10, RDF.white); } },
  locker: (B, W) => { const c = W / 2; rdfBx(B, c - 24, 2, 48, 58, RDF.steel, 2); rdfRc(B, c, 2, 1, 58, RDF.steel[4], 2); for (const x of [c - 20, c + 4]) for (let y = 6; y < 16; y += 3) rdfRc(B, x, y, 16, 1, RDF.steel[3], 2); rdfRc(B, c - 4, 30, 2, 8, RDF.steel[0], 2); rdfRc(B, c + 3, 30, 2, 8, RDF.steel[0], 2); rdfBx(B, c + 6, 38, 5, 6, RDF.yellow, 2); },
  ammorack: (B, W) => { rdfBx(B, 4, 2, W - 8, 58, RDF.olive, 2); for (let r = 0; r < 3; r++) { rdfRc(B, 6, 18 + r * 19, W - 12, 2, RDF.olive[3], 2); for (let k = 0; k < 3; k++) rdfBx(B, 10 + k * 22, 6 + r * 19, 18, 12, RDF.olive, 2); for (let k = 0; k < 3; k++) rdfRc(B, 14 + k * 22, 9 + r * 19, 8, 2, '#e8d870', 2); } },
});
// 第 9 步家具的动画
function rdfAnim2(g, v, W, c, using, off, wall, t, F, steam) {
  const on = using && !off, scr = (x, y, w, h, kind) => { const fr = Math.floor(t * 4); if (kind === 'code') { for (let k = 0; k < Math.floor(h / 3); k++) F(x, y + k * 3, 3 + ((k * 7 + fr) % (w - 4)), 1, '#a7f070'); } else if (kind === 'game') { F(x, y + h - 4, w, 4, '#3a7a3a'); F(x + ((t * 20) % (w - 4)), y + h - 8 - Math.abs(Math.sin(t * 6)) * 6, 4, 4, '#ffcd75'); F(x + w - 10, y + h - 10, 4, 6, '#d84a3a'); } else { for (let k = 0; k < 3; k++) F(x, y + k * h / 3, w, Math.ceil(h / 3), ['#5a88b4', '#8ab45e', '#e8a040', '#c86a54', '#a07cc8'][(k + fr) % 5]); F(x + ((t * 15) % (w - 6)), y + h / 2 - 2, 6, 4, '#f4f0e4'); } g.globalAlpha = 0.25; g.drawImage(rdsGlow('#a0d0ff'), x - 6, y - 6, w + 12, h + 12); g.globalAlpha = 1; };
  switch (v) {
    case 'laptop': if (on) scr(58, -58, 15, 13, rdPcScr()); break;                       // 研究时写代码，娱乐时打游戏
    case 'carpc': if (!off) scr(54, -70, 22, 22, using ? rdPcScr() : 'tv'); break;
    case 'terminal': if (!off) scr(c - 16, -66, 32, 22, using ? rdPcScr() : 'code'); break;
    case 'quantum': if (!off) for (let k = 0; k < 5; k++) for (let y = -84; y < -10; y += 6) if (Math.sin(t * 5 + k * 3 + y) > 0.3) F(12 + k * (W - 20) / 5, y, 3, 1, (y + k) % 4 ? '#73eff7' : '#a7f070'); break;
    case 'aicore': if (!off) { const fy = -46 + Math.sin(t * 1.5) * 4; g.globalAlpha = 0.6; g.drawImage(rdsGlow('#c27bd6'), c - 20, fy - 20, 40, 40); g.globalAlpha = 1; rdkCircle(g, c, fy, 9, '#9e74d4'); rdkCircle(g, c - 2, fy - 2, 5, '#e0c8ff'); g.strokeStyle = '#73eff7'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(c, fy, 16, 5, t, 0, 7); g.stroke(); } break;
    case 'bench': case 'workshop': if (using) for (let k = 0; k < 6; k++) { const pp = (t * 3 + k / 6) % 1; F(36 + Math.cos(k * 2) * pp * 18, -46 - pp * 14 + pp * pp * 20, 2, 2, pp < 0.5 ? '#fff0a0' : '#f08a30', 1 - pp); } if (v === 'workshop' && !off) F(104, -44 - ((t * 10) % 4), 26, 1, '#e04a3a', 0.5); break;
    case 'printer': if (!off) { const nx = c + Math.sin(t * 3) * 14, h = Math.round(((t * 2) % 20)); F(nx - 4, -52, 8, 6, '#3a3632'); F(nx - 1, -46, 2, 3, '#e04a3a'); F(c - 22, -54, 44, 2, '#5e5852'); F(c - 8, -18 - h, 16, h, '#73b8d8'); } break;
    case 'radio': if (on) rdfNotes(g, c + 10, 18, t); break;
    case 'tv': if (on) scr(c - 27, 11, 54, 34, 'tv'); break;
    case 'console': if (on) scr(c - 23, 7, 46, 26, 'game'); break;
    case 'projector': if (on) { g.globalAlpha = 0.12; F(W - 24, 6, -W + 40, 40, '#fff8d8'); g.globalAlpha = 1; scr(16, 9, W - 32, 44, 'tv'); } break;
    case 'record': { const sp = on ? t * 8 : 0; rdkCircle(g, c - 4, -40, 12, '#1a1612'); F(c - 4 + Math.cos(sp) * 8, -40, 2, 1, '#5a524a'); F(c - 6, -41, 4, 2, '#d84a3a'); if (on) rdfNotes(g, c + 12, -50, t); break; }
    case 'speaker': if (on) for (const x of [18, W - 18]) { const s = Math.abs(Math.sin(t * 9)) * 2; g.strokeStyle = '#8a847c'; g.lineWidth = 1; g.beginPath(); g.arc(x, -24, 11 + s, 0, 7); g.stroke(); } break;
    case 'treadmill': for (let x = 6 + ((on ? t * 40 : 0) % 8); x < W - 6; x += 8) F(x, -11, 3, 1, '#5e5852'); if (!off) F(W - 21, -63, 6, 1, on ? '#a7f070' : '#4a6a4a'); break;
    case 'aquarium': for (let k = 0; k < 3; k++) { const fx = c - 24 + ((t * (8 + k * 3) + k * 20) % 48), fy = -86 + k * 13 + Math.sin(t * 2 + k) * 2, dir = Math.floor((t * (8 + k * 3) + k * 20) / 48) % 2 ? -1 : 1; F(fx, fy, 6, 3, ['#f08a30', '#f0d040', '#e04a6a'][k]); F(fx - dir * 3, fy, 2, 3, ['#f08a30', '#f0d040', '#e04a6a'][k]); } for (let k = 0; k < 4; k++) F(c + 18, -46 - ((t * 15 + k * 12) % 50), 2, 2, '#e0fcff', 0.7); break;
    case 'massage': if (on) F(c - 22 + Math.sin(t * 6) * 2, -60, 3, 30, '#3a3a40', 0.4); break;
    case 'karaoke': if (!off && using) { scr(c - 16, -46, 18, 12, 'code'); rdfNotes(g, c + 22, -70, t); } break;
    case 'holo': if (!off) { g.globalAlpha = 0.18 + Math.sin(t * 2) * 0.06; F(12, -90, W - 24, 82, '#73eff7'); g.globalAlpha = 0.7; for (let k = 0; k < 6; k++) F(16 + ((k * 23 + t * (using ? 30 : 8)) % (W - 36)), -80 + k * 12, 6, 6, ['#ef7d57', '#a7f070', '#ffcd75', '#c27bd6', '#41a6f6', '#f4f4f4'][k]); g.globalAlpha = 0.3; F(12, -90 + ((t * 30) % 82), W - 24, 1, '#ffffff'); g.globalAlpha = 1; } break;
    case 'easel': if (using) F(c - 10 + Math.sin(t * 4) * 8, -64 + Math.cos(t * 3) * 6, 3, 3, ['#e04a3a', '#5a88b4', '#f0d040'][Math.floor(t) % 3]); break;
    case 'lights': for (let x = 6; x < W - 4; x += 7) { const y = 6 + Math.round(Math.sin((x - 2) / (W - 4) * Math.PI) * 8), col = off ? '#5e5852' : ['#ef7d57', '#ffcd75', '#a7f070', '#41a6f6', '#c27bd6'][(x / 7 + Math.floor(t * 2)) % 5 | 0]; F(x, y, 3, 4, col); if (!off) { g.globalAlpha = 0.3; g.drawImage(rdsGlow(col), x - 4, y - 3, 11, 11); g.globalAlpha = 1; } } break;
    case 'heater': if (!off) for (let k = 0; k < 3; k++) { const pp = (t * 0.7 + k / 3) % 1; F(c - 12 + k * 10 + Math.sin(pp * 8) * 2, -50 - pp * 20, 2, 4, '#f0a070', (1 - pp) * 0.4); } break;
    case 'ac': if (!off) for (let k = 0; k < 3; k++) { const pp = (t * 1.2 + k / 3) % 1; F(14 + k * 18, 26 + pp * 18, 12, 1, '#c8f0ff', (1 - pp) * 0.6); } break;
    case 'diffuser': if (!off) steam(c, 30, 3); break;
    case 'ecowall': g.globalAlpha = 0.15 + Math.sin(t) * 0.05; F(4, 2, W - 8, 58, '#73eff7'); g.globalAlpha = 1; break;
    case 'shower': case 'bath': if (using) { for (let k = 0; k < 10; k++) F(W / 2 + 4 + (k % 4) * 3 - (v === 'bath' ? W / 2 - 35 : 0), -92 + ((t * 80 + k * 13) % 88), 1, 4, '#9ad0ec', 0.8); steam(v === 'bath' ? 40 : W / 2, -60, 3); } break;
    case 'washer': if (!off) { const a = t * (using ? 10 : 3); for (let k = 0; k < 3; k++) F(c + Math.cos(a + k * 2.1) * 6 - 2, -28 + Math.sin(a + k * 2.1) * 6 - 1, 4, 3, ['#d84a3a', '#5a88b4', '#f0d040'][k]); } break;
    case 'grow': if (!off) { g.globalAlpha = 0.18; F(8, -83, W - 16, 78, '#f0b0e0'); g.globalAlpha = 1; } break;
    case 'hydro': if (!off) { g.globalAlpha = 0.25 + Math.sin(t * 1.5) * 0.08; F(10, -90, W - 20, 84, '#c27bd6'); g.globalAlpha = 1; } break;
  }
}
function rdPcScr() { const a = G.road.me.act; return a && a.type === 'fun' ? 'game' : 'code'; } // 电脑屏幕：打游戏还是写代码
function rdfNotes(g, x, y, t) { for (let k = 0; k < 3; k++) { const pp = (t * 0.5 + k / 3) % 1; g.globalAlpha = 1 - pp; g.fillStyle = ['#ffcd75', '#c27bd6', '#73eff7'][k]; const nx = x + pp * 10 + Math.sin(pp * 6) * 3, ny = y - pp * 24; g.fillRect(nx, ny, 3, 3); g.fillRect(nx + 2, ny - 8, 1, 8); g.fillRect(nx + 2, ny - 8, 3, 1); } g.globalAlpha = 1; }
