// =============================================
//  公路求生：车载武器（22 种挂点武器 + 6 种自瞄炮塔）的精细像素外观、开火特效、子弹和爆炸
//  画法和车一样（js/roadcar.js 的像素纸）：每种武器分「底座」和「会转的炮身」两张图，逐像素画好后缓存；
//  炮身绕转轴转向目标。开火时：后坐（炮身往后缩 1~2 像素）、枪口火光（按种类不同：火花 / 火舌 / 电光 / 紫光）、
//  抛出弹壳、冒一小团烟；加特林转管、特斯拉线圈放电、喷火器长明火、外星武器呼吸光每帧画。
//  坐标：炮身图以转轴为 (0, 0)、炮口朝右；底座图以转轴为 (0, 0)，往下伸到车顶
// =============================================
const RDG_CACHE = {};
const RDG_PAL = {
  steel: ['#9a948a', '#6e6a62', '#4a4640', '#2e2a26'],
  gun: ['#7a766e', '#55514b', '#3a3632', '#24201c'],
  olive: ['#a4a676', '#7c7e52', '#585c38', '#3a3e26'],
  purple: ['#cfa8f4', '#9e74d4', '#6c4aa4', '#432e6a'],
  green: ['#b4d878', '#86b04e', '#5a8434', '#38561e'],
  copper: ['#f0b878', '#c88448', '#94582c', '#5e341a'],
  red: ['#e0705a', '#b84a36', '#8a2e20', '#5a1a12'],
  yellow: ['#f4d060', '#d4a434', '#a07a22', '#6a5014'],
  wood: ['#c89c68', '#9a744a', '#725232', '#4c3420'],
  glow: '#73eff7', glow2: '#c27bd6',
};
function rdgP(w, h, ox, oy) { return rdcPaper(w, h, ox, oy); }
function rdgBox(B, x, y, w, h, R, m) { rdcBox(B, x, y, w, h, R, m || 2, 0, 1); }
// 横着的圆管：上亮下暗（中间偏上一道高光）
function rdgTube(B, x0, x1, cy, r, R, m) { for (let x = x0; x <= x1; x++) for (let dy = -r; dy <= r; dy++) { const t = (dy + r) / (2 * r || 1); rdcPix(B, x, cy + dy, rdcRampAt(R, Math.min(1, Math.abs(t - 0.28) * 1.6), x, cy + dy), m || 2); } }
function rdgBall(B, cx, cy, r, R, m) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = x * x + y * y; if (d > r * r + r * 0.5) continue; const t = Math.min(1, Math.max(0, (Math.hypot(x + r * 0.35, y + r * 0.4)) / (r * 1.5))); rdcPix(B, cx + x, cy + y, rdcRampAt(R, t, cx + x, cy + y), m || 2); } }
function rdgRiv(B, x, y) { rdcPix(B, x, y, RDC_PAL.metal[0], 2); rdcPix(B, x + 1, y + 1, RDC_PAL.metal[3], 2); }
function rdgFin(B) { rdcWeather(B, 7, -0.15, -6); rdcOutline(B); return rdcToCanvas(B); }

// 通用底座：方转台 + 立柱（往下伸到车顶），军用 / 土制 / 外星三种
function rdgBase(style) {
  const B = rdgP(44, 26, 22, 8), P = RDG_PAL;
  if (style === 'alien') { rdgBall(B, 0, 4, 5, P.purple, 2); for (let x = -7; x <= 7; x++) rdcPix(B, x, 10, P.glow, 4); rdcPix(B, 0, 4, P.glow, 4); }
  else if (style === 'junk') { rdgBox(B, -9, 6, 18, 8, P.wood, 1); for (let x = -9; x < 9; x += 6) rdcLine(B, x, 6, x, 13, P.wood[3], 1); rdgBox(B, -2, 0, 4, 6, P.steel, 2); rdgRiv(B, -8, 7); rdgRiv(B, 6, 7); }
  else { rdgBox(B, -2, 0, 4, 8, P.gun, 2); rdgBox(B, -9, 8, 18, 4, P.steel, 2); rdgBox(B, -11, 12, 22, 3, P.gun, 2); rdgRiv(B, -8, 9); rdgRiv(B, 6, 9); }
  return rdgFin(B);
}
// 每种武器：炮身图（朝右）+ 底座样式 + 炮口位置 + 开火效果种类
function rdgBuild(id) {
  if (RDG_CACHE[id]) return RDG_CACHE[id];
  const P = RDG_PAL, B = rdgP(72, 44, 18, 22), n = parseInt(id.replace(/\D+/g, ''), 10);
  let base = 'mil', mz = 20, fl = 'fire', fixed = false, spin = false;
  switch (n) {
    case 1: base = 'junk'; rdgBox(B, -6, -2, 14, 4, P.wood, 1); rdcLine(B, 7, -1, 14, -9, P.wood[1], 1); rdcLine(B, 7, 0, 14, -8, P.wood[2], 1); rdcLine(B, 7, 1, 14, 9, P.wood[1], 1); rdcLine(B, 7, 2, 14, 10, P.wood[2], 1); rdcLine(B, 14, -9, 2, 0, '#5a4030', 2); rdcLine(B, 14, 10, 2, 1, '#5a4030', 2); rdgBall(B, 2, 0, 2, P.steel); mz = 14; fl = 'puff'; break;
    case 2: rdgBox(B, -8, -5, 16, 9, P.yellow, 1); rdgBox(B, -6, 4, 5, 7, P.gun); rdgTube(B, 8, 20, 0, 2, P.steel); rdgBox(B, 2, -9, 6, 4, P.gun); for (let x = 3; x < 8; x += 2) rdcPix(B, x, -8, P.steel[0], 2); rdgRiv(B, -6, -3); mz = 21; fl = 'spark'; break;
    case 3: rdgBox(B, -14, -2, 12, 6, P.wood, 1); rdgBox(B, -4, -3, 8, 6, P.gun); rdgTube(B, 4, 26, -2, 1, P.steel); rdgTube(B, 4, 26, 1, 1, P.steel); mz = 27; break;
    case 4: rdgBox(B, -8, -4, 14, 8, P.gun); rdgTube(B, 6, 26, 0, 2, P.steel); for (let x = 9; x < 22; x += 3) rdcPix(B, x, -1, P.gun[3], 2); rdgTube(B, 26, 31, 0, 1, P.gun); rdgBox(B, -6, 4, 8, 6, P.olive); rdcLine(B, 14, 2, 10, 9, P.gun[2], 2); rdcLine(B, 14, 2, 18, 9, P.gun[2], 2); mz = 32; break;
    case 5: base = 'junk'; rdgTube(B, -8, 22, 0, 3, P.olive); rdcLine(B, 20, 0, 34, 0, '#c8d0d8', 2); rdcPoly(B, [[34, -3], [39, 0], [34, 3]], '#d8e0e8', 2); rdcPix(B, 32, -2, '#a8b0b8', 2); rdcPix(B, 32, 2, '#a8b0b8', 2); rdgBall(B, -6, 6, 4, ['#c8a070', '#9a7448', '#6e5030']); mz = 22; fl = 'puff'; break;
    case 6: rdgTube(B, -12, -2, 2, 4, P.red, 1); rdgTube(B, -12, -2, -5, 2, P.red, 1); rdgTube(B, -2, 22, 0, 1, P.steel); rdgBox(B, 20, -2, 4, 4, P.gun); mz = 24; fl = 'pilot'; break;
    case 7: rdgBox(B, -8, -6, 14, 12, P.gun); rdgTube(B, 6, 28, -3, 1, P.steel); rdgTube(B, 6, 28, 3, 1, P.steel); rdgBox(B, -6, 6, 9, 5, P.olive); rdgRiv(B, -6, -4); mz = 29; break;
    case 8: rdgBox(B, -8, -5, 14, 10, P.gun); rdgBall(B, -2, 6, 5, P.steel); rdgTube(B, 6, 22, 0, 3, P.gun); rdcLine(B, 22, -3, 22, 3, P.gun[3], 2); mz = 23; break;
    case 9: fixed = true; fl = 'arc'; rdgBox(B, -3, -4, 6, 6, P.gun); for (let k = 0; k < 6; k++) rdgBox(B, -5 + (k % 2), -6 - k * 3, 10 - (k % 2) * 2, 2, P.copper); rdgBall(B, 0, -26, 4, ['#e8f0f4', '#a8b8c4', '#6a7a88', '#3e4a56']); mz = 0; break;
    case 10: rdgBox(B, -8, -5, 12, 10, P.olive); rdgBall(B, 0, 0, 5, P.gun); rdgTube(B, 4, 20, 0, 3, P.olive); rdcLine(B, 20, -3, 20, 3, P.olive[3], 2); mz = 21; fl = 'boom'; break;
    case 11: rdgBox(B, -8, -9, 22, 18, P.olive); for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { rdgBall(B, 12, -4 + b * 8 - 0, 3, P.gun[0] ? P.gun : P.gun); rdcPix(B, 14, -4 + b * 8, '#e04a3a', 4); } for (let y = -8; y < 9; y += 4) rdcLine(B, -7, y, 13, y, P.olive[3], 2); mz = 16; fl = 'rocket'; break;
    case 12: rdgBox(B, -10, -6, 14, 12, P.gun); rdgBox(B, -8, 6, 10, 6, P.olive); rdgTube(B, 4, 30, 0, 4, P.steel); rdgBox(B, 28, -5, 3, 10, P.gun); mz = 32; spin = true; break;
    case 13: base = 'mil'; rdgTube(B, -4, 22, 0, 3, P.olive); rdgBox(B, -8, -3, 6, 7, P.gun); mz = 23; fl = 'boom'; break;
    case 14: rdgBox(B, -10, -5, 14, 10, ['#4a5a8a', '#34406a', '#22284a', '#161a30']); rdgBox(B, 4, -5, 34, 2, P.steel); rdgBox(B, 4, 3, 34, 2, P.steel); for (let x = 8; x < 36; x += 6) { rdcPix(B, x, -2, P.glow, 4); rdcPix(B, x, 1, P.glow, 4); } mz = 38; fl = 'rail'; break;
    case 15: rdgTube(B, -14, 0, 0, 5, P.red, 1); rdgBox(B, -12, -3, 10, 1, P.yellow); rdgTube(B, 0, 30, 0, 2, P.gun); rdgBox(B, 28, -3, 5, 6, P.steel); mz = 33; fl = 'pilot'; break;
    case 16: base = 'alien'; rdcPoly(B, [[-10, -6], [16, -3], [22, 0], [16, 3], [-10, 6]], P.purple, 2); for (let k = 0; k < 3; k++) { rdcPix(B, 12 + k * 3, -1 + (k % 2) * 2, P.glow, 4); } rdcLine(B, -8, 0, 12, 0, P.purple[3], 2); mz = 22; fl = 'laser'; break;
    case 17: base = 'alien'; rdgBall(B, 0, 0, 7, P.purple); rdgTube(B, 6, 20, 0, 3, P.purple); for (let x = 9; x < 20; x += 4) rdcLine(B, x, -3, x, 3, P.glow2, 4); rdgBall(B, 0, 0, 3, ['#ffffff', P.glow2, '#6a3a9a'], 4); mz = 21; fl = 'plasma'; break;
    case 18: base = 'alien'; for (let a = 0; a < 40; a++) { const an = a / 40 * 6.283; rdcPix(B, Math.round(8 + Math.cos(an) * 8), Math.round(Math.sin(an) * 8), a % 4 ? P.purple[1] : P.glow2, 2); } rdgBall(B, 8, 0, 4, ['#3a2a50', '#20142e', '#0e0816']); rdgBox(B, -8, -3, 8, 6, P.purple); mz = 8; fl = 'grav'; break;
    case 19: base = 'alien'; rdcPoly(B, [[-8, -4], [30, -1], [34, 0], [30, 1], [-8, 4]], ['#e8fcff', '#86f0f8', '#46b8d4', '#2a7aa0'], 2); rdcLine(B, -6, 0, 32, 0, '#ffffff', 4); mz = 34; fl = 'beam'; break;
    case 20: base = 'alien'; rdgBall(B, -2, 0, 7, P.green, 1); for (let k = 0; k < 6; k++) rdcLine(B, -6 + k * 2, -5, -4 + k * 2, 5, P.green[3], 1); rdcPoly(B, [[4, -3], [18, -1], [18, 1], [4, 3]], P.green, 1); rdcPix(B, 18, 0, '#d8ff90', 4); mz = 19; fl = 'acid'; break;
    case 21: base = 'junk'; rdgTube(B, -8, 22, 0, 4, ['#8a8478', '#5e5a52', '#3e3a34', '#28241f']); for (let x = -6; x < 22; x += 7) rdgBox(B, x, -5, 2, 10, P.copper); rdcLine(B, -8, -4, -12, -10, '#3a2a20', 2); rdcPix(B, -12, -10, '#ffb040', 4); mz = 23; fl = 'boom'; break;
    case 22: base = 'junk'; rdgBox(B, -10, -2, 30, 4, P.wood, 1); rdcLine(B, 14, 0, 8, -14, P.steel[1], 2); rdcLine(B, 15, 0, 9, -14, P.steel[2], 2); rdcLine(B, 14, 1, 8, 15, P.steel[1], 2); rdcLine(B, 15, 1, 9, 15, P.steel[2], 2); rdcLine(B, 8, -14, -4, 0, '#d8d0c0', 2); rdcLine(B, 8, 15, -4, 1, '#d8d0c0', 2); rdcLine(B, -4, 0, 26, 0, '#c8d0d8', 2); rdcPoly(B, [[26, -2], [30, 0], [26, 2]], '#e0e8f0', 2); mz = 26; fl = 'puff'; break;
    // ---- 炮塔：头部 ----
    case 23: base = 'turret'; rdgBox(B, -9, -6, 16, 11, P.olive); rdgBox(B, -9, -6, 16, 2, ['#c0c290', '#a4a676']); rdgTube(B, 7, 26, -2, 1, P.steel); rdgTube(B, 7, 26, 2, 1, P.steel); rdgBox(B, -6, -9, 5, 3, P.gun); rdcPix(B, -4, -8, '#e04a3a', 4); mz = 27; break;
    case 24: base = 'turret'; rdgBox(B, -11, -8, 20, 15, ['#7a8aa0', '#56667a', '#3c4a5a', '#28323e']); rdgTube(B, 9, 34, -4, 2, P.steel); rdgTube(B, 9, 34, 3, 2, P.steel); rdgBox(B, 32, -6, 3, 5, P.gun); rdgBox(B, 32, 1, 3, 5, P.gun); rdcPix(B, -6, -4, '#ffcd75', 4); mz = 35; fl = 'boom'; break;
    case 25: base = 'turret'; rdgBox(B, -9, -7, 16, 14, P.olive); for (let k = 0; k < 4; k++) rdgTube(B, 7, 30, -5 + k * 3, 0, ['#e0e8ec', '#a8b0b8']); rdcLine(B, -10, -12, -4, -7, P.steel[1], 2); mz = 31; break;
    case 26: base = 'turret'; rdgBox(B, -10, -10, 22, 20, P.olive); for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { rdgBall(B, 6 + a * 6, -5 + b * 10, 3, P.gun); rdcPix(B, 8 + a * 6, -5 + b * 10, '#e04a3a', 4); } mz = 14; fl = 'rocket'; break;
    case 27: base = 'turret'; rdgBox(B, -8, -7, 14, 14, ['#6a84c0', '#4a62a0', '#334478', '#222c50']); rdgTube(B, 6, 22, 0, 2, ['#e0e8f0', '#a8b8c8', '#6a7a8c']); rdgBox(B, 22, -3, 3, 6, P.gun); rdcPix(B, 24, 0, P.glow, 4); mz = 25; fl = 'laser'; break;
    case 28: base = 'float'; rdgBall(B, 0, 0, 8, P.purple); for (let a = 0; a < 36; a++) { const an = a / 36 * 6.283; rdcPix(B, Math.round(Math.cos(an) * 10), Math.round(Math.sin(an) * 10), a % 3 ? P.purple[2] : P.glow2, 2); } rdgBall(B, 4, 0, 3, ['#ffffff', P.glow, '#2a7aa0'], 4); mz = 12; fl = 'plasma'; break;
    default: rdgBox(B, -6, -3, 12, 6, P.gun); rdgTube(B, 6, 20, 0, 1, P.steel);
  }
  const gun = rdgFin(B);
  let bs;
  if (base === 'turret') { const T = rdgP(44, 26, 22, 8); rdgBox(T, -12, 8, 24, 5, RDG_PAL.gun); rdgBox(T, -10, 4, 20, 4, RDG_PAL.steel); rdgBox(T, -3, -2, 6, 6, RDG_PAL.gun); for (let x = -9; x < 10; x += 4) rdcPix(T, x, 5, RDC_PAL.metal[0], 2); bs = rdgFin(T); }
  else if (base === 'float') { const T = rdgP(44, 26, 22, 8); for (let x = -8; x <= 8; x++) rdcPix(T, x, 14, RDG_PAL.glow, 4); bs = rdgFin(T); }
  else bs = rdgBase(base);
  return (RDG_CACHE[id] = { gun, base: bs, mz, fl, fixed, spin, alien: base === 'alien' || base === 'float', turret: base === 'turret' || base === 'float' });
}

// ---------- 每帧：画一门武器 ----------
function rdgDraw(g, x, y, w, key, i) {
  const R = G.road, p = w.p, S = rdgBuild(p.id), Q = RD_Q, t = G.time;
  const last = R.aimAt && R.aimAt[key], since = last != null && last <= t ? t - last : 99;
  // 转向：炮塔没目标时左右巡视；普通武器朝最后一次开火的方向（平时微微朝前上）
  R.aimS = R.aimS || {};
  const busy = since < 1.5, want = busy ? R.aim[key] : (S.turret ? -Math.PI / 2 + Math.sin(t * 0.7 + i * 1.7) * 1.15 : -0.12);
  let cur = R.aimS[key] != null ? R.aimS[key] : want;
  cur += Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * (busy ? 0.35 : 0.06);
  R.aimS[key] = cur;
  const hover = S.alien ? Math.sin(t * 2.5 + i) * 1.2 : 0, py = y - 3 + (p.fx.turret === 'alien' ? -4 + hover : 0);
  // 底座
  g.drawImage(S.base.cv, x - S.base.ox / Q, y - 3 - S.base.oy / Q, S.base.cv.width / Q, S.base.cv.height / Q);
  if (S.alien) { g.globalAlpha = 0.35 + Math.sin(t * 4 + i) * 0.2; g.drawImage(rdsGlow('#73eff7'), x - 5, y - 1, 10, 4); g.globalAlpha = 1; }
  // 炮身（特斯拉线圈不转）
  const ang = S.fixed ? 0 : cur, rec = since < 0.08 ? (1 - since / 0.08) * 1.5 : 0;
  g.save(); g.translate(x, py); g.rotate(ang); if (Math.cos(ang) < 0) g.scale(1, -1);
  g.drawImage(S.gun.cv, -S.gun.ox / Q - rec, -S.gun.oy / Q, S.gun.cv.width / Q, S.gun.cv.height / Q);
  const mzx = S.mz / Q - rec;
  if (S.spin) { const sp = since < 0.5 ? t * 40 : t * 2; g.fillStyle = '#d8d0c0'; for (let k = 0; k < 3; k++) { const yy = Math.sin(sp + k * 2.09) * 1.1; g.fillRect(2, yy - 1 / (2 * Q), 8, 1 / Q); } }
  if (S.fl === 'pilot') { const f = 0.6 + Math.random() * 0.6; g.fillStyle = '#5ab0ff'; g.fillRect(mzx, -f / 2, f, f); }
  // 枪口火光
  if (since < 0.07) {
    const a = 1 - since / 0.07;
    g.globalAlpha = a;
    if (S.fl === 'fire' || S.fl === 'boom' || S.fl === 'spark') { const L = S.fl === 'boom' ? 6 : S.fl === 'spark' ? 2 : 4; g.drawImage(rdsGlow('#ffcd75'), mzx - 2, -3, 8, 6); g.fillStyle = '#fff8d8'; g.fillRect(mzx, -0.67, L, 1.33); g.fillStyle = '#ffd860'; g.fillRect(mzx + 0.67, -2, L * 0.6, 4); g.fillRect(mzx + L * 0.4, -1.33, 1, 2.67); }
    else if (S.fl === 'rocket') { g.fillStyle = '#c8c4bc'; g.fillRect(-S.gun.ox / Q - 4, -2, 4, 4); g.fillStyle = '#ffd860'; g.fillRect(mzx, -1, 3, 2); }
    else if (S.fl === 'laser' || S.fl === 'rail' || S.fl === 'beam') g.drawImage(rdsGlow(S.fl === 'laser' ? '#ff8a6a' : S.fl === 'rail' ? '#73eff7' : '#e0a8ff'), mzx - 4, -4, 8, 8);
    else if (S.fl === 'plasma' || S.fl === 'grav') g.drawImage(rdsGlow('#c27bd6'), mzx - 5, -5, 10, 10);
    else if (S.fl === 'acid') { g.fillStyle = '#a7f070'; g.fillRect(mzx, -0.67, 2, 1.33); }
    g.globalAlpha = 1;
  }
  g.restore();
  // 特斯拉线圈：顶上的球一直噼啪放电
  if (S.fl === 'arc') { const top = py - 26 / Q; g.globalAlpha = 0.4 + Math.random() * 0.4; g.drawImage(rdsGlow('#73eff7'), x - 4, top - 4, 8, 8); g.fillStyle = '#d8fdff'; let ax = x, ay = top; for (let k = 0; k < 4; k++) { const nx = ax + (Math.random() - 0.5) * 3, ny = ay + (Math.random() - 0.5) * 3; g.fillRect(Math.round(nx * Q) / Q, Math.round(ny * Q) / Q, 1 / Q, 1 / Q); ax = nx; ay = ny; } g.globalAlpha = 1; }
  // 开火后抛弹壳、冒烟
  if (since < 0.35 && (S.fl === 'fire' || S.fl === 'boom')) {
    const k = since / 0.35; g.fillStyle = '#e0b048'; g.fillRect(x - 1 - k * 4, py - 1 - Math.sin(k * Math.PI) * 4 + k * 3, 2 / Q, 1 / Q);
    g.globalAlpha = (1 - k) * 0.45; g.fillStyle = '#b8b4ac'; const sx = x + Math.cos(cur) * (S.mz / Q + 1) - k * 3, sy = py + Math.sin(cur) * (S.mz / Q + 1) - k * 5, sz = 1 + k * 3; g.fillRect(sx - sz / 2, sy - sz / 2, sz, sz); g.globalAlpha = 1;
  }
}

// ---------- 子弹、光束、爆炸（替换原来的简单画法） ----------
function rdgProj(g, gy) {
  const R = G.road, t = G.time, q = 1 / RD_Q;
  for (const p of R.proj || []) {
    if (rdpxProj(g, p, gy)) continue; // 程序化像素特效（js/roadvfx.js）
    const x = rdSX(p.x), y = gy + p.y, k = p.kind, a = Math.atan2(p.vy || 0, p.vx || 1), ca = Math.cos(a), sa = Math.sin(a);
    const streak = (len, c1, c2) => { for (let s = 0; s < len * 3; s++) { g.fillStyle = s < 2 ? c1 : c2; g.globalAlpha = 1 - s / (len * 3); g.fillRect(x - ca * s * q, y - sa * s * q, q * 2, q * 2); } g.globalAlpha = 1; };
    if (k === 'spit') { g.fillStyle = p.color; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = '#ffffff'; g.globalAlpha = 0.5; g.fillRect(x - 0.67, y - 0.67, 1, 1); g.globalAlpha = 1; }
    else if (k === 'bullet' || k === 'nail') { streak(k === 'nail' ? 2 : 4, '#fff8d8', '#ffcd75'); }
    else if (k === 'pellet') { g.fillStyle = '#f4efe0'; g.fillRect(x, y, q * 2, q * 2); g.fillStyle = '#ffcd75'; g.fillRect(x - ca * q * 3, y - sa * q * 3, q, q); }
    else if (k === 'rock') { const r = t * 12 + p.x; g.fillStyle = '#8a8070'; g.fillRect(x - 1, y - 1, 2, 2); g.fillStyle = '#b8ac98'; g.fillRect(x - 1 + (Math.sin(r) > 0 ? q : 0), y - 1, q * 2, q * 2); g.fillStyle = '#5a5248'; g.fillRect(x + 1 - q, y + 1 - q, q, q); }
    else if (k === 'harpoon') { g.fillStyle = '#c8d0d8'; for (let s = 0; s < 18; s++) g.fillRect(x - ca * s * q, y - sa * s * q, q, q); g.fillStyle = '#e8f0f8'; g.fillRect(x - q, y - q, q * 3, q * 3); g.globalAlpha = 0.6; g.fillStyle = '#7a6448'; for (let s = 18; s < 60; s += 2) g.fillRect(x - ca * s * q, y - sa * s * q + Math.sin(s * 0.3 + t * 10) * q, q, q); g.globalAlpha = 1; }
    else if (k === 'flame') { const life = (t * 7 + p.x * 0.37) % 1, r = 1.5 + life * 3; const C = ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c', '#5a4a44']; g.globalAlpha = 0.9 - life * 0.5; g.fillStyle = C[Math.min(4, Math.floor(life * 5))]; g.fillRect(x - r / 2, y - r / 2 - life * 2, r, r); g.fillStyle = '#ffd860'; g.globalAlpha *= 0.6; g.fillRect(x - r / 4, y - r / 4 - life * 2, r / 2, r / 2); g.globalAlpha = 1; }
    else if (k === 'shell' || k === 'mortar') { g.fillStyle = '#4a4e3a'; g.fillRect(x - 1, y - 1, 2.67, 2); g.fillStyle = '#8a8e6a'; g.fillRect(x - 1, y - 1, 2.67, q); g.globalAlpha = 0.4; g.fillStyle = '#c8c4bc'; for (let s = 1; s < 5; s++) g.fillRect(x - ca * s * 1.5 - 0.5, y - sa * s * 1.5 - 0.5, 1, 1); g.globalAlpha = 1; }
    else if (k === 'rocket' || k === 'missile') { g.fillStyle = '#d8d4c8'; for (let s = 0; s < 9; s++) g.fillRect(x - ca * s * q, y - sa * s * q, q * 2, q * 2); g.fillStyle = '#c03a1c'; g.fillRect(x, y, q * 2, q * 2); const fx = x - ca * 3.3, fy = y - sa * 3.3; g.drawImage(rdsGlow('#ffb040'), fx - 2, fy - 2, 4, 4); g.fillStyle = Math.random() < 0.5 ? '#fff8d8' : '#ffd860'; g.fillRect(fx - q, fy - q, q * 3, q * 3); g.globalAlpha = 0.35; g.fillStyle = '#b8b4ac'; for (let s = 1; s < 6; s++) { const sz = 0.7 + s * 0.4; g.fillRect(fx - ca * s * 2 - sz / 2, fy - sa * s * 2 - sz / 2 + Math.sin(s + t * 6) * 0.3, sz, sz); } g.globalAlpha = 1; }
    else if (k === 'plasma') { g.globalAlpha = 0.6; g.drawImage(rdsGlow('#c27bd6'), x - 6, y - 6, 12, 12); g.globalAlpha = 1; g.fillStyle = '#e0a8ff'; g.fillRect(x - 1.67, y - 1.67, 3.33, 3.33); g.fillStyle = '#ffffff'; g.fillRect(x - 1, y - 1, 2, 2); for (let s = 1; s < 4; s++) { g.globalAlpha = 0.5 - s * 0.12; g.fillStyle = '#c27bd6'; g.fillRect(x - ca * s * 2 - 1, y - sa * s * 2 - 1, 2, 2); } g.globalAlpha = 1; }
    else if (k === 'grav') { for (let r = 2; r < 7; r += 2) { const rr = r + ((t * 6) % 2); g.globalAlpha = 0.5 - rr / 16; g.strokeStyle = '#c27bd6'; g.lineWidth = q; g.beginPath(); g.arc(x, y, rr, 0, 7); g.stroke(); } g.globalAlpha = 1; g.fillStyle = '#0e0816'; g.fillRect(x - 1.33, y - 1.33, 2.67, 2.67); g.fillStyle = '#e0a8ff'; g.fillRect(x - 1.33, y - 1.33, q, q); }
    else if (k === 'acid') { g.fillStyle = '#5a8434'; g.fillRect(x - 1.33, y - 1, 2.67, 2); g.fillStyle = '#d8ff90'; g.fillRect(x - 1, y - 1, q * 2, q); g.fillStyle = '#a7f070'; g.fillRect(x - ca * 2, y - sa * 2 + 0.5, q * 2, q * 2); }
    else { g.fillStyle = '#f4f4f4'; g.fillRect(x, y, 2, 1); }
  }
  for (const f of R.fx || []) {
    if (f.kind === 'mdeath') { rdnDeath(g, f, gy); continue; } // 怪物死亡爆散（js/roadmons.js）
    if (rdpxFx(g, f, gy)) continue; // 爆炸、黑洞、闪电、光束（js/roadvfx.js）
    const a = Math.max(0, f.life / f.max), x = rdSX(f.x), y = gy + f.y;
    if (f.kind === 'laser' || f.kind === 'beam' || f.kind === 'rail') {
      const x2 = rdSX(f.x2), y2 = gy + f.y2, col = f.kind === 'laser' ? '#ff7a50' : f.kind === 'beam' ? '#c27bd6' : '#73eff7', wd = f.kind === 'rail' ? 3 : f.kind === 'beam' ? 2 : 1.33;
      g.globalAlpha = a * 0.35; g.strokeStyle = col; g.lineWidth = wd * 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.globalAlpha = a; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = wd * 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.drawImage(rdsGlow(col), x2 - 4, y2 - 4, 8, 8);
      if (f.kind === 'beam') { g.fillStyle = '#f0d8ff'; for (let s = 0; s < 6; s++) { const u = Math.random(); g.fillRect(x + (x2 - x) * u, y + (y2 - y) * u + (Math.random() - 0.5) * 4, q * 2, q * 2); } }
      g.globalAlpha = 1;
    } else if (f.kind === 'arc') {
      const x2 = rdSX(f.x2), y2 = gy + f.y2, pts = [[x, y]];
      for (let k = 1; k < 8; k++) pts.push([x + (x2 - x) * k / 8 + (Math.random() - 0.5) * 5, y + (y2 - y) * k / 8 + (Math.random() - 0.5) * 5]); pts.push([x2, y2]);
      g.globalAlpha = a * 0.4; g.strokeStyle = '#73eff7'; g.lineWidth = 2; g.beginPath(); pts.forEach((p2, k) => k ? g.lineTo(p2[0], p2[1]) : g.moveTo(p2[0], p2[1])); g.stroke();
      g.globalAlpha = a; g.strokeStyle = '#e8fcff'; g.lineWidth = q * 1.5; g.stroke();
      const mid = pts[3]; g.beginPath(); g.moveTo(mid[0], mid[1]); g.lineTo(mid[0] + (Math.random() - 0.5) * 8, mid[1] - Math.random() * 6); g.stroke();
      g.drawImage(rdsGlow('#73eff7'), x2 - 5, y2 - 5, 10, 10); g.globalAlpha = 1;
    } else { // 爆炸：白 → 黄 → 橙 → 红 → 烟，碎片飞出
      const p = 1 - a, r = f.r * (0.45 + p * 0.75), grav = f.kind === 'gravboom', pl = f.kind === 'plasmaboom';
      const C = grav ? ['#ffffff', '#e0a8ff', '#9a60d0', '#4a2a70', '#1a0e2a'] : pl ? ['#ffffff', '#f0c8ff', '#c27bd6', '#7a3aa0', '#3a2050'] : ['#fff8d8', '#ffd860', '#f08a30', '#c03a1c', '#5a4a44'];
      g.globalAlpha = Math.min(1, a * 1.6) * 0.5; g.drawImage(rdsGlow(C[2]), x - r * 2, y - r * 2, r * 4, r * 4);
      for (let k = 0; k < 4; k++) { const rk = r * (1 - k * 0.22) * (grav ? (1 - p * 0.5) : 1), col = C[Math.min(4, k + Math.floor(p * 3))]; g.globalAlpha = Math.min(1, a * 1.5); rdkCircle(g, Math.round(x * RD_Q) / RD_Q, Math.round((y - p * 3) * RD_Q) / RD_Q, Math.max(0.5, rk / (k ? 1 : 1)), col); if (k === 0) continue; }
      g.fillStyle = C[1]; for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283 + f.x, d = r * (0.6 + p * 1.4); g.globalAlpha = a; g.fillRect(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.7 - p * 4, q * 2, q * 2); }
      if (!grav && p > 0.4) { g.globalAlpha = (1 - p) * 0.6; g.fillStyle = '#6a625c'; for (let k = 0; k < 4; k++) { const sz = r * 0.5 + p * 4; g.fillRect(x - sz / 2 + (k - 1.5) * r * 0.4, y - r - p * 8 - k, sz, sz); } }
      g.globalAlpha = 1;
    }
  }
  for (const p of R.parts || []) { g.globalAlpha = p.fade ? Math.max(0, p.life / 0.4) * 0.6 : Math.min(1, p.life * 3); g.fillStyle = p.c; const s = p.s || 1; g.fillRect(Math.round(rdSX(p.x)), Math.round(gy + p.y), s, s); }
  g.globalAlpha = 1;
}
