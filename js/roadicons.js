// =============================================
//  公路求生：零件小图标（仓库、改装、制作、交易面板里每个零件左边的像素图）
//  能直接用游戏里画好的精细像素图的就用（武器、车顶、油箱、挂车、车内家具），
//  其余按种类单独画（外装甲 14、撞角 11、引擎 13、轮胎 11、底盘 7、外挂 12、空间核心 3、随身武器 13、防护服 9）。
//  图标外框颜色 = 品阶颜色（灰 / 绿 / 蓝 / 紫 / 金 / 外星青），外星品阶边框会微微发光。
// =============================================
const RDO_ART = {};
const RDO = {
  steel: ['#e2e0d8', '#b4b0a6', '#86827a', '#5a5650', '#3a3632'], rust: ['#d89058', '#b06a3a', '#844824', '#5a2e16'],
  olive: ['#b0b282', '#888a5a', '#62663e', '#424628'], dark: ['#6a645e', '#4a443e', '#322c28', '#201c18'],
  red: ['#ee8a70', '#c85a44', '#983c2c', '#64241a'], blue: ['#9ac0e0', '#6a94bc', '#46709a', '#2a4c6e'],
  purple: ['#d8b4f8', '#a47cd8', '#7252a8', '#48326e'], cyan: ['#e0fcff', '#8cecf6', '#4ab8d4', '#2a7aa0'],
  yellow: ['#f6d878', '#dcae44', '#a8802a', '#725416'], wood: ['#d0a070', '#a87a50', '#7c5836', '#523822'],
  green: ['#bce08e', '#8ab45e', '#5e8a3c', '#3c5e24'], copper: ['#f4c088', '#cc8a4c', '#985c2e', '#62381c'],
  tire: ['#6a605a', '#4a423c', '#322c28', '#1e1a16'], leather: ['#a87a5a', '#80583e', '#5a3c28', '#3a2618'],
  glow: '#73eff7', glow2: '#d080f0',
};
function rdoP() { return rdcPaper(48, 48, 24, 24); }
function rdoFin(B) { rdcOutline(B); return rdcToCanvas(B).cv; }
function rdoN(id) { return parseInt(id.replace(/\D+/g, ''), 10) || 1; }
const rdoB = (B, x, y, w, h, R, m) => rdcBox(B, x, y, w, h, R, m || 2, 0, 1);
const rdoL = (B, x0, y0, x1, y1, c, m) => rdcLine(B, x0, y0, x1, y1, c, m || 2);
function rdoWheel(B, r, R, rim, tread) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y); if (d > r + 0.4) continue; let c; if (d > r * 0.62) { c = rdcRampAt(R, 0.1 + (y + r) / (2 * r) * 0.7, x, y); if (tread && tread(x, y, d, Math.atan2(y, x))) c = R[0]; } else if (d > r * 0.25) c = rdcRampAt(rim || RDO.steel, 0.2 + (y + r) / (2 * r) * 0.6, x, y); else c = RDO.dark[2]; rdcPix(B, x, y, c, 2); } }
// ---------- 各种类的图 ----------
const RDO_BUILD = {
  armor(n) { const B = rdoP(), pal = [null, RDO.rust, RDO.blue, RDO.steel, RDO.tire, RDO.steel, ['#f0e6d0', '#d4c6a6', '#a8987a', '#7a6c54'], ['#d0e0ec', '#a8bccc', '#7a90a2', '#506474'], RDO.olive, RDO.olive, RDO.cyan, RDO.purple, RDO.cyan, RDO.green, RDO.dark][n];
    const plate = () => { rdcPoly(B, [[-16, -14], [14, -16], [17, 12], [-15, 15]], pal, 2); };
    if (n === 4) { for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) { rdgBall(B, -10 + j * 16, -10 + k * 10, 7, RDO.tire); rdgBall(B, -10 + j * 16, -10 + k * 10, 3, RDO.dark); } }
    else if (n === 13) { for (let k = 0; k < 9; k++) { const x = -15 + (k % 3) * 11, y = -14 + Math.floor(k / 3) * 10; rdoB(B, x, y, 12, 9, [RDO.green, RDO.blue, RDO.red][k % 3]); rdcRect(B, x + 3, y + 3, 6, 1, '#f4f0e0', 2); } }
    else if (n === 5) { for (let x = -16; x <= 16; x += 4) rdoL(B, x, -16, x + 6, 16, '#8a867c'); for (let y = -16; y <= 16; y += 5) rdoL(B, -16, y, 16, y - 2, '#a8a49a'); for (let k = 0; k < 6; k++) rdcPix(B, -14 + k * 6, -17, '#c8c4bc', 2); }
    else { plate(); if (n === 1) { rdoB(B, -6, -6, 14, 12, RDO.steel); } if (n === 2) { rdoB(B, -10, -12, 18, 9, ['#bcdcec', '#7aa8c0', '#4a7890'], 3); rdcRect(B, 4, 2, 6, 2, RDO.dark[1], 2); } if (n === 3) for (let y = -12; y < 14; y += 3) rdcPix(B, -2, y, '#e8c070', 4);
      if (n === 8) for (let k = 0; k < 6; k++) rdoB(B, -13 + (k % 3) * 9, -11 + Math.floor(k / 3) * 12, 8, 10, RDO.olive);
      if (n === 10 || n === 12) for (let y = -14; y < 15; y++) for (let x = -15; x < 16; x++) if (rdmHexEdge(x + 30, y + 30)) rdcPix(B, x, y, RDO.glow, 4);
      if (n === 11) for (let k = 0; k < 4; k++) { rdoL(B, -14, -10 + k * 7, 15, -12 + k * 7, RDO.purple[3]); rdcPix(B, 0, -9 + k * 7, RDO.glow2, 4); }
      if (n === 14) { for (let x = -10; x < 10; x += 3) rdcRect(B, x, -4, 1, 10, RDO.dark[3], 2); rdcRect(B, -12, -12, 24, 4, '#e8c040', 2); }
      for (const [x, y] of [[-13, -11], [11, -13], [14, 9], [-12, 12]]) rdgRiv(B, x, y); }
    return rdoFin(B); },
  ram(n) { const B = rdoP(), P = n >= 10 ? RDO.cyan : n === 9 ? RDO.blue : n === 1 || n === 11 ? RDO.wood : RDO.steel;
    if (n === 1) { for (let k = 0; k < 3; k++) rdoB(B, -16, -12 + k * 9, 32, 7, RDO.wood); rdoL(B, -10, -14, -10, 14, RDO.dark[2]); rdoL(B, 10, -14, 10, 14, RDO.dark[2]); }
    else if (n === 2) { for (let x = -14; x <= 14; x += 4) rdoL(B, x, -10, x, 10, RDO.steel[1]); rdoL(B, -16, -10, 16, -10, RDO.steel[0]); rdoL(B, -16, 10, 16, 10, RDO.steel[2]); }
    else if (n === 3) { rdgTube(B, -18, 18, -6, 3, RDO.steel); rdgTube(B, -18, 18, 6, 3, RDO.steel); rdoB(B, -4, -10, 8, 20, RDO.dark); }
    else if (n === 4 || n === 8) { rdcPoly(B, [[-14, -16], [6, -16], [16, 16], [-14, 16]], n === 8 ? RDO.yellow : RDO.rust, 2); rdoL(B, -14, 0, 10, 0, RDO.dark[2]); }
    else if (n === 5 || n === 11) { rdoB(B, -16, -6, 18, 12, n === 11 ? RDO.wood : RDO.steel); for (let k = 0; k < 5; k++) rdcPoly(B, [[2, -12 + k * 6], [16, -9 + k * 6], [2, -6 + k * 6]], RDO.steel, 2); }
    else if (n === 6) { rdgTube(B, -14, 14, 0, 10, RDO.steel); for (let x = -12; x <= 12; x += 6) rdcPoly(B, [[x, -10], [x + 4, -16], [x + 3, -10]], RDO.steel, 2); }
    else if (n === 7) { rdgTube(B, -18, 0, 0, 7, RDO.yellow); rdgTube(B, 0, 12, 0, 4, RDO.steel); rdoB(B, 12, -12, 6, 24, RDO.steel); }
    else { rdcPoly(B, [[-16, -14], [16, 0], [-16, 14]], P, 2); for (let x = -12; x < 12; x += 5) rdcPix(B, x, 0, n >= 9 ? RDO.glow : '#fff', 4); }
    return rdoFin(B); },
  engine(n) { const B = rdoP();
    if (n === 4 || n === 8) { rdgTube(B, -16, 12, 0, 11, n === 8 ? RDO.blue : RDO.steel); for (let x = -12; x < 10; x += 3) rdcRect(B, x, -9, 2, 18, RDO.copper[1], 2); rdoB(B, 12, -4, 6, 8, RDO.dark); if (n === 8) rdcRect(B, -14, -2, 6, 4, RDO.glow, 4); return rdoFin(B); }
    if (n === 10) { rdcPoly(B, [[-18, -10], [8, -8], [18, -12], [18, 12], [8, 8], [-18, 10]], RDO.steel, 2); for (let k = 0; k < 4; k++) rdcRect(B, 12 + k, -8 + k * 2, 1, 16 - k * 4, ['#fff0c0', '#ffd060', '#f08a30', '#c03a1c'][k], 4); return rdoFin(B); }
    if (n === 11 || n === 12) { rdoB(B, -14, 4, 28, 10, n === 11 ? RDO.purple : RDO.steel); rdgBall(B, 0, -4, 10, n === 11 ? RDO.purple : RDO.cyan); rdgBall(B, -2, -6, 4, ['#ffffff', n === 11 ? RDO.glow2 : RDO.glow], 4); for (let a = 0; a < 30; a++) rdcPix(B, Math.round(Math.cos(a / 30 * 6.28) * 14), Math.round(-4 + Math.sin(a / 30 * 6.28) * 5), n === 11 ? RDO.glow2 : RDO.glow, 4); return rdoFin(B); }
    const P = [null, RDO.red, RDO.dark, RDO.red, null, RDO.green, RDO.steel, RDO.olive, null, RDO.blue, null, null, null, RDO.steel][n];
    const big = n === 6 || n === 7, small = n === 1 || n === 13;
    rdoB(B, small ? -10 : -16, -4, small ? 20 : 32, 16, RDO.dark); rdoB(B, small ? -8 : -14, -14, small ? 16 : 28, 10, P);
    for (let x = small ? -6 : -12; x < (small ? 8 : 14); x += 6) rdgBall(B, x + 2, -9, 2, RDO.steel);
    if (n === 1) { rdgBall(B, 12, 4, 5, RDO.red); rdoL(B, 12, 4, 20, -4, RDO.dark[1]); }
    if (n === 6) rdgBall(B, 16, -12, 6, RDO.steel);
    if (n === 9) { rdoB(B, 8, 6, 12, 10, RDO.blue); rdcRect(B, 11, 9, 6, 2, RDO.glow, 4); }
    if (n === 13) { rdoL(B, -6, -14, -12, -20, RDO.steel[1]); rdoL(B, 6, -14, 12, -20, RDO.steel[1]); }
    if (n === 2 || n === 7) rdoL(B, 14, -14, 14, -22, RDO.dark[1]);
    return rdoFin(B); },
  tires(n) { const B = rdoP();
    if (n === 8) { rdcPoly(B, [[-18, -6], [18, -6], [22, 4], [16, 12], [-16, 12], [-22, 4]], RDO.tire, 2); for (let x = -16; x < 18; x += 4) { rdcRect(B, x, -7, 2, 2, RDO.steel[2], 2); rdcRect(B, x, 12, 2, 2, RDO.steel[2], 2); } for (const x of [-12, 0, 12]) rdgBall(B, x, 3, 4, RDO.steel); return rdoFin(B); }
    const r = n === 11 ? 20 : n === 9 ? 15 : 18, rim = n === 9 ? RDO.red : n === 10 ? RDO.cyan : n === 7 ? RDO.olive : RDO.steel;
    const tread = [null, () => false, (x, y, d) => d > r * 0.8 && d < r * 0.86, (x, y, d, a) => d > r - 2 && Math.floor(a * 8) % 2 === 0, (x, y, d, a) => Math.abs(Math.sin(a * 6)) < 0.2, (x, y, d) => d > r * 0.66 && d < r * 0.72, null, (x, y, d, a) => d > r - 3 && Math.floor(a * 10) % 2 === 0, null, () => false, (x, y, d, a) => d > r - 2 && Math.floor(a * 12) % 3 === 0, (x, y, d, a) => d > r - 4 && Math.abs(Math.sin(a * 5)) < 0.3][n];
    rdoWheel(B, r, n === 5 ? ['#c85a44', '#4a423c', '#322c28', '#1e1a16'] : RDO.tire, rim, tread);
    if (n === 6) for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283; rdcPix(B, Math.round(Math.cos(a) * (r + 2)), Math.round(Math.sin(a) * (r + 2)), '#e8e4d8', 2); }
    if (n === 4) for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; rdoL(B, Math.round(Math.cos(a) * (r - 3)), Math.round(Math.sin(a) * (r - 3)), Math.round(Math.cos(a + 0.4) * (r + 1)), Math.round(Math.sin(a + 0.4) * (r + 1)), '#c8c4bc'); }
    return rdoFin(B); },
  chassis(n) { const B = rdoP();
    if (n === 5 || n === 6) { const C = n === 5 ? RDO.cyan : RDO.purple; rdoB(B, -16, -12, 32, 8, RDO.steel); rdgBall(B, -8, 0, 6, C); rdgBall(B, 8, 0, 6, C); for (let k = 0; k < 3; k++) for (let x = -14; x < 15; x++) if ((x + k) % 3 === 0) rdcPix(B, x, 8 + k * 4, n === 5 ? RDO.glow : RDO.glow2, 4); return rdoFin(B); }
    if (n === 4 || n === 7) { for (let k = 0; k < 4; k++) rdoL(B, -18 + k * 2, -2 + k * 3, 18 - k * 2, -2 + k * 3, RDO.steel[k]); rdoB(B, -4, -14, 8, 10, RDO.dark); rdgBall(B, -16, 0, 3, RDO.steel); rdgBall(B, 16, 0, 3, RDO.steel); if (n === 4) rdoB(B, -18, -18, 36, 4, RDO.olive); return rdoFin(B); }
    rdoB(B, -16, -18, 32, 5, RDO.dark); rdoB(B, -16, 13, 32, 5, RDO.dark);
    if (n === 2) { rdgTube(B, -6, 6, -6, 0, RDO.steel); rdoB(B, -5, -13, 10, 14, RDO.yellow); rdoB(B, -3, 1, 6, 12, RDO.steel); }
    else { for (let y = -12; y < 12; y += 3) rdoL(B, -8, y, 8, y + 2, n === 3 ? RDO.copper[1] : '#d84a3a'); rdoB(B, -2, -12, 4, 24, RDO.steel); if (n === 3) rdcRect(B, -8, -1, 16, 2, RDO.glow, 4); }
    return rdoFin(B); },
  util(n) { const B = rdoP();
    if (n === 1) { rdgTube(B, -14, 6, -2, 8, RDO.steel); for (let x = -12; x < 6; x += 3) rdoL(B, x, -10, x + 1, 6, RDO.steel[3]); rdoL(B, 6, -2, 16, 8, RDO.dark[1]); rdcPoly(B, [[14, 8], [19, 8], [19, 14], [16, 11]], RDO.steel, 2); }
    else if (n === 2) { for (let k = 0; k < 40; k++) { const a = k * 0.55; rdcPix(B, -18 + k, Math.round(Math.sin(a) * 8), '#8a867c', 2); rdcPix(B, -18 + k + Math.round(Math.cos(a) * 2), Math.round(Math.cos(a) * 8), '#b0aca2', 2); if (k % 5 === 0) rdcPix(B, -18 + k, -11, '#c8c4bc', 2); } }
    else if (n === 3) { rdoB(B, -14, -12, 28, 24, RDC_PAL.crate); rdoL(B, -14, 0, 13, 0, RDC_PAL.crate[3]); rdcRect(B, -2, -4, 4, 6, RDO.steel[1], 2); }
    else if (n === 4) { rdoB(B, -4, 4, 8, 12, RDO.dark); rdcPoly(B, [[-2, -2], [-16, -12], [-16, 10], [-2, 4]], RDO.steel, 2); rdcPoly(B, [[2, -2], [16, -12], [16, 10], [2, 4]], RDO.steel, 2); }
    else if (n === 5) { for (let k = 0; k < 2; k++) rdoB(B, -12 + k * 12, -6, 10, 20, RDO.dark); rdcRect(B, -12, 2, 22, 2, '#e8c040', 2); for (let k = 0; k < 3; k++) rdgBall(B, -6 + k * 6, -12 - k * 2, 4 + k, ['#e8e4dc', '#c0bcb4', '#9a968e'], 1); }
    else if (n === 6 || n === 9) { if (n === 9) { rdgBall(B, 0, 4, 10, RDO.purple); rdcRect(B, -2, -10, 4, 6, RDO.glow, 4); } else { for (const y of [-6, 4]) rdoL(B, -18, y, 18, y, '#4a8ac8'); for (const x of [-14, 0, 14]) rdcRect(B, x, -10, 2, 18, RDO.steel[2], 2); rdoL(B, -4, -14, 2, -6, '#e8f8ff'); rdoL(B, 2, -6, -2, 0, '#e8f8ff'); } }
    else if (n === 7) { for (let k = 0; k < 2; k++) rdgTube(B, -14, 10, -6 + k * 12, 4, RDO.red, 1); rdcRect(B, 10, -8, 4, 4, RDO.steel[2], 2); }
    else if (n === 8) { rdoL(B, -14, 14, -4, -6, '#d0a040'); rdoL(B, -13, 14, -3, -6, '#a07a28'); rdoL(B, -4, -6, 12, -2, '#d0a040'); rdoL(B, -4, -5, 12, -1, '#a07a28'); rdoL(B, 12, -2, 18, -10, RDO.steel[1]); rdoL(B, 12, -2, 18, 6, RDO.steel[1]); rdoB(B, -18, 12, 10, 5, RDO.olive); }
    else if (n === 10) { for (let y = -12; y <= 12; y += 4) rdoL(B, -16, y, 16, y + Math.round(Math.sin(y) * 2), '#a8e0ff', 3); rdgBall(B, 0, 0, 6, RDO.cyan, 3); }
    else if (n === 11) { for (let k = 0; k < 24; k++) { const a = k * 0.9, r = 4 + (k % 6) * 2.4; rdcPix(B, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.7), k % 3 ? RDO.glow : RDO.glow2, 4); } }
    else { rdcRect(B, -18, -14, 36, 2, RDO.steel[2], 2); rdcRect(B, -18, 12, 36, 2, RDO.steel[2], 2); for (let k = 0; k < 4; k++) rdpCan(B, -16 + k * 8, 12, k % 2 ? RDP.red : RDP.olive); }
    return rdoFin(B); },
  space(n) { const B = rdoP(), s = 8 + n * 3; rdcPoly(B, [[0, -s - 4], [s + 4, -s / 2], [s + 4, s / 2 + 2], [0, s + 4], [-s - 4, s / 2 + 2], [-s - 4, -s / 2]], RDO.purple, 2); rdcPoly(B, [[0, -s - 4], [s + 4, -s / 2], [0, 0], [-s - 4, -s / 2]], [RDO.purple[0], RDO.purple[1]], 2); for (let a = 0; a < 40; a++) { const t = a / 40 * 6.283 * 2, r = a / 40 * (s - 1); rdcPix(B, Math.round(Math.cos(t) * r), Math.round(4 + Math.sin(t) * r * 0.5), a % 2 ? RDO.glow : RDO.glow2, 4); } return rdoFin(B); },
  hand(n) { const B = rdoP(), S = RDO.steel;
    switch (n) {
      case 1: rdoL(B, -14, 14, 12, -12, S[1]); rdoL(B, -13, 14, 13, -12, S[3]); rdoL(B, 12, -12, 16, -10, S[1]); rdoL(B, -14, 14, -18, 12, '#c84a3a'); break;
      case 2: rdoL(B, -12, 16, 10, -10, RDO.wood[1]); rdoL(B, -11, 16, 11, -10, RDO.wood[2]); rdcPoly(B, [[6, -16], [18, -12], [16, 0], [8, -6]], ['#d84a3a', '#a8301e'], 2); rdoL(B, 16, -12, 16, 0, S[0]); break;
      case 3: rdoB(B, -16, -2, 24, 4, RDO.wood); rdoL(B, 6, 0, 0, -14, S[1]); rdoL(B, 6, 1, 0, 15, S[1]); rdoL(B, 0, -14, -10, 0, '#d8d0c0'); rdoL(B, 0, 15, -10, 1, '#d8d0c0'); rdoL(B, -10, 0, 18, 0, '#c8d0d8'); break;
      case 4: case 12: { const P = n === 12 ? RDO.purple : RDO.steel; rdoB(B, -10, -6, 26, 6, P); rdgBall(B, -4, 2, 5, n === 12 ? RDO.purple : RDO.dark); rdcPoly(B, [[-10, 0], [-6, 0], [-12, 14], [-18, 12]], n === 12 ? RDO.dark : RDO.wood, 2); if (n === 12) rdcRect(B, 10, -4, 6, 2, RDO.glow, 4); break; }
      case 5: case 7: case 8: { const L = n === 8 ? 40 : 34; rdoB(B, -18, -2, 12, 6, n === 7 ? RDO.dark : RDO.wood); rdoB(B, -6, -4, 12, 6, RDO.dark); rdgTube(B, 6, -18 + L, -2, 1, S); if (n === 5) rdgTube(B, 6, -18 + L, 1, 1, S); if (n === 7) rdoB(B, 0, 2, 4, 8, RDO.dark); if (n === 8) { rdgTube(B, -4, 8, -7, 2, RDO.dark); rdcPix(B, 8, -7, '#73b8d8', 3); } break; }
      case 6: rdoB(B, -16, -6, 16, 12, ['#e8a040', '#c47a24', '#8a5414']); rdcPoly(B, [[0, -4], [20, -4], [22, 0], [20, 4], [0, 4]], S, 2); for (let x = 2; x < 20; x += 3) { rdcPix(B, x, -5, S[3], 2); rdcPix(B, x, 5, S[3], 2); } break;
      case 9: rdgTube(B, -18, 18, -2, 5, RDO.olive); rdoB(B, -4, 3, 5, 9, RDO.dark); rdcPoly(B, [[18, -7], [24, -2], [18, 3]], '#c84a3a', 2); break;
      case 10: rdgBall(B, 2, 0, 11, RDO.yellow); for (let k = 0; k < 4; k++) rdoB(B, 8, -9 + k * 5, 6, 4, RDO.steel); rdcRect(B, -10, -4, 6, 8, RDO.dark[1], 2); break;
      case 11: rdoB(B, -16, -2, 10, 5, RDO.dark); rdoL(B, -6, 0, 20, -2, '#ffffff', 4); rdoL(B, -6, -1, 20, -3, RDO.glow, 4); rdoL(B, -6, 1, 20, -1, RDO.glow, 4); break;
      case 13: rdoL(B, -16, 14, 14, -12, RDO.wood[1]); for (let k = 0; k < 3; k++) rdoL(B, -16 + k * 6 + 6, 14 - k * 5 - 5, 14, -12 + k, RDO.wood[k % 2 ? 2 : 0]); rdoL(B, -16, 14, -12, 10, RDO.dark[1]); break;
      default: rdoB(B, -10, -4, 20, 8, S);
    }
    return rdoFin(B); },
  suit(n) { const B = rdoP(), P = [null, RDO.leather, RDO.yellow, RDO.olive, RDO.yellow, RDO.dark, RDO.steel, RDO.steel, RDO.olive, RDO.purple][n] || RDO.steel;
    rdcPoly(B, [[-8, -16], [8, -16], [16, -10], [18, 6], [12, 6], [12, 18], [-12, 18], [-12, 6], [-18, 6], [-16, -10]], P, n === 2 || n === 4 ? 1 : 2);
    rdcPoly(B, [[-5, -16], [0, -10], [5, -16]], RDO.dark[2], 2);
    if (n === 3 || n === 7) { rdoB(B, -9, -8, 18, 14, n === 3 ? RDO.olive : RDO.steel); rdgRiv(B, -7, -6); rdgRiv(B, 5, -6); }
    if (n === 4) { rdgBall(B, 0, -18, 6, ['#a8d8e8', '#6aa8c0', '#3a7890'], 3); }
    if (n === 5) { rdcRect(B, -18, -10, 6, 10, '#c84a3a', 2); rdcRect(B, 12, -10, 6, 10, '#c84a3a', 2); }
    if (n === 6 || n === 8) { for (const x of [-12, 10]) rdoL(B, x, -12, x, 18, RDO.yellow[1]); rdoL(B, -12, 0, 10, 0, RDO.yellow[1]); if (n === 8) rdcRect(B, -3, -6, 6, 4, RDO.glow, 4); }
    if (n === 9) for (let k = 0; k < 5; k++) rdoL(B, -10 + k * 5, -10, -8 + k * 5, 14, RDO.glow2, 4);
    if (n === 1) rdoL(B, 0, -10, 0, 16, RDO.dark[1]);
    if (n === 2) rdcPoly(B, [[-8, -16], [0, -24], [8, -16]], P, 1);
    return rdoFin(B); },
};
// 家具 / 车顶里「会动的部分才是主角」的，单独画图标
const RDO_SPECIAL = {
  lights: () => { const B = rdoP(); for (let x = -20; x <= 20; x++) rdcPix(B, x, Math.round(-8 + Math.sin((x + 20) / 40 * Math.PI) * 10), RDO.dark[1], 2); for (let k = 0; k < 6; k++) { const x = -17 + k * 7, y = Math.round(-6 + Math.sin((x + 20) / 40 * Math.PI) * 10); rdgBall(B, x, y, 2, [['#ffd890', '#f0a040'], ['#ff9a80', '#d84a3a'], ['#c0f090', '#80c050'], ['#a0d8ff', '#4a90d8'], ['#e0b0ff', '#a060d0']][k % 5], 4); } return rdoFin(B); },
  holo: () => { const B = rdoP(); rdcBox(B, -18, 10, 36, 6, ['#4a3a6a', '#3a2a58', '#281a40'], 2, 0, 1); for (let y = -16; y < 10; y++) for (let x = -14; x < 14; x++) if ((x + y) % 4 === 0 || Math.abs(x) === 13) rdcPix(B, x, y, '#73eff7', 4); rdgBall(B, -4, -4, 4, ['#ffd890', '#f0a040'], 4); rdcRect(B, 4, -10, 6, 6, '#c27bd6', 4); return rdoFin(B); },
  aicore: () => { const B = rdoP(); rdcBox(B, -10, 8, 20, 10, ['#3e2c64', '#2e1f50', '#20143a'], 2, 0, 1); rdgBall(B, 0, -6, 9, RDO.purple); rdgBall(B, -2, -8, 3, ['#ffffff', '#e0c8ff'], 4); for (let a = 0; a < 40; a++) rdcPix(B, Math.round(Math.cos(a / 40 * 6.283) * 15), Math.round(-6 + Math.sin(a / 40 * 6.283) * 4), '#73eff7', 4); return rdoFin(B); },
  record: () => { const B = rdoP(); rdcBox(B, -18, 2, 36, 14, RDO.wood, 1, 0, 1); for (let y = -8; y <= 0; y++) for (let x = -14; x <= 10; x++) { const d = ((x + 2) / 12) ** 2 + ((y + 4) / 4.5) ** 2; if (d <= 1) rdcPix(B, x, y, d < 0.08 ? '#d84a3a' : (Math.round(d * 6) % 2 ? '#2a2420' : '#1a1612'), 2); } rdcLine(B, 14, -8, 6, -2, RDO.steel[1], 2); return rdoFin(B); },
  rug: () => { const B = rdoP(); for (let y = -10; y <= 10; y++) for (let x = -18; x <= 18; x++) rdcPix(B, x, y, Math.abs(x) > 15 || Math.abs(y) > 8 ? '#e8c070' : ((Math.abs(x) + Math.abs(y)) % 6 < 2 ? '#e8c070' : (Math.abs(x) + Math.abs(y)) % 6 < 4 ? '#b84a3a' : '#8a3a2e'), 1); return rdoFin(B); },
  mount: (two) => { const B = rdoP(); for (let k = 0; k < (two ? 2 : 1); k++) { const x = two ? -10 + k * 20 : 0; rdcBox(B, x - 9, 6, 18, 6, RDO.olive, 2, 0, 1); rdcBox(B, x - 6, 0, 12, 6, RDO.steel, 2, 0, 1); rdgBall(B, x, -4, 4, RDO.steel); rdgRiv(B, x - 7, 8); rdgRiv(B, x + 5, 8); } return rdoFin(B); },
};
// 武器：底座 + 炮身拼一张图
function rdoWeaponArt(id) {
  const S = rdgBuild(id), cv = createCanvas(110, 80), g = cv.getContext('2d'), px = 40, py = 44;
  g.drawImage(S.base.cv, px - S.base.ox, py + 9 - S.base.oy); g.drawImage(S.gun.cv, px - S.gun.ox, py - S.gun.oy);
  return cv;
}
// 裁掉四周的透明边
function rdoCrop(cv) {
  const g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { cv, sx: 0, sy: 0, sw: cv.width, sh: cv.height };
  return { cv, sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 };
}
function rdoArt(p) {
  if (RDO_ART[p.id]) return RDO_ART[p.id];
  let cv = null;
  const n = rdoN(p.id);
  try {
    if (p.slot === 'weapon') cv = rdoWeaponArt(p.id);
    else if (p.slot === 'in' && RDO_SPECIAL[p.v]) cv = RDO_SPECIAL[p.v]();
    else if (p.slot === 'roof' && (n === 7 || n === 14)) cv = RDO_SPECIAL.mount(n === 14);
    else if (p.slot === 'in') cv = rdfHas(p.v) ? rdfSprite(p.v, p.w || 1, p.layer === 'wall', p.tier).cv : null;
    else if (p.slot === 'trailer') cv = rdpTrailerSprite(p.id).cv;
    else if (p.slot === 'tank') { const dummy = createCanvas(4, 4).getContext('2d'); rdpTank(dummy, 0, 0, 40, p, {}); cv = RDP_CACHE['tank' + n] && RDP_CACHE['tank' + n].cv; }
    else if (p.slot === 'roof' && n !== 6 && n !== 8 && n !== 2) cv = rdpRoofSprite(p.id, 96).cv;
    else if (p.slot === 'roof') { const B = rdoP(); if (n === 2) { rdgTube(B, -18, 18, 0, 5, RDP.canvas, 1); for (let x = -16; x < 18; x += 8) rdcRect(B, x, -5, 3, 10, RDP.stripe[0], 1); } else if (n === 6) { rdcRect(B, -1, -4, 3, 20, RDO.steel[2], 2); rdcPoly(B, [[-16, -18], [16, -12], [14, -4], [-14, -8]], RDO.steel, 2); rdcRect(B, -1, -14, 3, 3, '#e04a3a', 4); } else { rdcRect(B, -1, -6, 3, 24, RDO.steel[2], 2); rdoB(B, -6, -10, 12, 6, RDO.steel); for (let b = 0; b < 3; b++) { const a = b * 2.094 - 1.2; rdoL(B, 0, -7, Math.round(Math.cos(a) * 18), Math.round(-7 + Math.sin(a) * 18), '#ece8dc'); } } cv = rdoFin(B); }
    else { const kind = p.slot === 'tires' ? 'tires' : p.slot; if (RDO_BUILD[kind]) cv = RDO_BUILD[kind](n); }
  } catch (e) { cv = null; }
  return (RDO_ART[p.id] = cv ? rdoCrop(cv) : null);
}
// 画一个零件图标：x, y 左上角，s 边长（界面像素）
function rdoIcon(ctx, p, x, y, s) {
  const tc = RD_TIER_COLOR[p.tier] || '#94b0c2', A = rdoArt(p);
  ctx.save();
  const gr = ctx.createLinearGradient(0, y, 0, y + s); gr.addColorStop(0, rdMix('#1c1a26', tc, 0.22)); gr.addColorStop(1, '#14121a');
  ctx.fillStyle = gr; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = tc; ctx.fillRect(x + 2, y, s - 4, 2); ctx.fillRect(x, y + 2, 2, s - 4);
  ctx.fillStyle = rdShade(tc, -0.35); ctx.fillRect(x + 2, y + s - 2, s - 4, 2); ctx.fillRect(x + s - 2, y + 2, 2, s - 4);
  if (p.tier >= 6) { ctx.globalAlpha = 0.25 + Math.sin(G.time * 3) * 0.12; ctx.strokeStyle = tc; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, s + 2, s + 2); ctx.globalAlpha = 1; }
  if (A) {
    const pad = 5, k = Math.min((s - pad * 2) / A.sw, (s - pad * 2) / A.sh), w = A.sw * k, h = A.sh * k;
    ctx.imageSmoothingEnabled = k < 1; if (k < 1) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(A.cv, A.sx, A.sy, A.sw, A.sh, Math.round(x + (s - w) / 2), Math.round(y + (s - h) / 2), w, h);
  } else { ctx.fillStyle = tc; ctx.fillRect(x + s / 2 - 4, y + s / 2 - 4, 8, 8); }
  ctx.restore();
}
