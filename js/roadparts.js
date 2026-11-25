// =============================================
//  公路求生：车顶（14 种）、车身外挂（12 种）、油箱（6 种）、挂车（6 种）、空间核心的精细像素外观
//  和车一样逐像素画好缓存（按「零件 + 车型」），会动的部分每帧画：风车 / 雷达 / 无人机螺旋桨转、探照灯夜里亮、
//  遮阳棚停车时撑开、喇叭飘音符、烟雾发生器冒烟、电护栏和 EMP 放电、机械臂摆动、纳米云和隐形力场、
//  挂车轮子转、房车窗户夜里亮灯、外星舱悬浮发光、空间核心在车门上荡出涟漪。
//  坐标：世界像素画位置，图片是 RD_Q 倍精细像素；车头 x = 0，地面 y = 0
// =============================================
const RDP_CACHE = {};
const RDP = {
  rail: ['#d0ccc0', '#a29e94', '#76726a', '#4c4842'],
  canvas: ['#e8d8a8', '#c8b47e', '#a08a58', '#76643c'],
  stripe: ['#e8a040', '#c47a24'],
  solar: ['#6a8ac8', '#3a5a9a', '#24386a', '#141e3a'],
  olive: ['#a4a676', '#7c7e52', '#585c38', '#3a3e26'],
  red: ['#e0705a', '#b84a36', '#8a2e20', '#5a1a12'],
  blue: ['#8ab4d8', '#5a88b4', '#3a6088', '#22405e'],
  white: ['#f4f0e4', '#d8d2c4', '#aea898', '#7e786a'],
  purple: ['#cfa8f4', '#9e74d4', '#6c4aa4', '#432e6a'],
  orange: ['#e8945a', '#c06a34', '#8e4822', '#5a2c14'],
  wood: ['#c89c68', '#9a744a', '#725232', '#4c3420'],
  cry: ['#d8fdff', '#86f0f8', '#46b8d4', '#2a7aa0'],
  glow: '#73eff7', glow2: '#c27bd6',
};
function rdpGet(key, w, h, ox, oy, fn) {
  if (RDP_CACHE[key]) return RDP_CACHE[key];
  const B = rdcPaper(w, h, ox, oy); fn(B); rdcWeather(B, key.length * 7, -0.1, -6); rdcOutline(B);
  return (RDP_CACHE[key] = rdcToCanvas(B));
}
function rdpBlit(g, S, x, y) { const Q = RD_Q; g.drawImage(S.cv, x - S.ox / Q, y - S.oy / Q, S.cv.width / Q, S.cv.height / Q); }
function rdpTubeH(B, x0, x1, cy, r, R, m) { rdgTube(B, x0, x1, cy, r, R, m); }
function rdpRail(B, x0, x1, y) { rdcLine(B, x0, y, x1, y, RDP.rail[1], 2); rdcLine(B, x0, y + 1, x1, y + 1, RDP.rail[3], 2); }
function rdpCan(B, x, y, R) { rdcBox(B, x, y - 12, 8, 12, R, 1, 0, 1); rdcRect(B, x + 2, y - 14, 3, 2, RDP.rail[2], 2); rdcLine(B, x + 1, y - 9, x + 6, y - 3, R[3], 1); rdcLine(B, x + 6, y - 9, x + 1, y - 3, R[3], 1); }

// ---------- 车顶（图片以车顶左端为原点，y = 0 是车顶面） ----------
function rdpRoofSprite(id, rw) {
  const n = parseInt(id.replace(/\D+/g, ''), 10);
  return rdpGet('roof' + n + '_' + rw, rw + 40, 110, 20, 96, (B) => {
    const W = rw, P = RDP;
    if (n === 1) { // 行李架 + 货物
      for (const x of [2, W - 4]) rdcRect(B, x, -8, 2, 8, P.rail[2], 2); rdpRail(B, 2, W - 2, -9);
      for (let x = 8; x < W - 6; x += 10) rdcRect(B, x, -8, 1, 8, P.rail[3], 2);
      rdcBox(B, 8, -20, 22, 12, RDC_PAL.crate, 1, 0, 1); rdcLine(B, 8, -14, 29, -14, RDC_PAL.crate[3], 1);
      rdgBall(B, 44, -14, 7, ['#6a8a5a', '#4e6a42', '#36502e', '#22341c'], 1); rdcLine(B, 37, -14, 51, -14, '#2a2018', 1);
      rdpCan(B, 58, -8, P.red); if (W > 90) { rdcBox(B, 70, -18, 18, 10, P.blue, 1, 0, 1); rdcLine(B, 70, -16, 88, -16, '#e8e0c8', 1); }
    } else if (n === 2) { // 卷起来的遮阳棚
      rdpTubeH(B, 4, W - 8, -4, 3, P.canvas, 1); for (let x = 6; x < W - 8; x += 8) rdcRect(B, x, -7, 3, 6, P.stripe[0], 1);
      for (const x of [4, W - 10]) rdcRect(B, x, -3, 2, 3, P.rail[2], 2);
    } else if (n === 3 || n === 9 || n === 13) { // 太阳能板 / 大型光伏阵列 / 外星光子帆
      if (n === 13) { const hw = Math.round(W / 2); rdcRect(B, hw, -60, 2, 60, P.purple[2], 2); for (let y = -58; y < -6; y++) { const w2 = (y + 60) * 0.9; for (let x = 0; x < w2; x++) rdcPix(B, hw - x - 2, y, rdcRampAt(P.purple, 0.2 + x / (w2 + 1) * 0.6, x, y), (x + y) % 9 === 0 ? 4 : 1); } return; }
      const panels = n === 3 ? 2 : Math.max(3, Math.floor(W / 26)), pw = n === 3 ? 24 : Math.floor((W - 6) / panels) - 2;
      for (let k = 0; k < panels; k++) { const px = 4 + k * (pw + 2); rdcLine(B, px + (pw >> 1), -1, px + (pw >> 1), -6, P.rail[3], 2);
        for (let x = 0; x < pw; x++) for (let y = 0; y < 4; y++) { const yy = -8 - y - Math.round(x * 0.12); rdcPix(B, px + x, yy, (x % 6 === 0 || y === 0) ? '#a8b8d0' : rdcRampAt(P.solar, 0.3 + y * 0.15, px + x, yy), (x + y * 3) % 17 === 0 ? 4 : 2); } }
    } else if (n === 4) { // 探照灯组
      rdpRail(B, 6, 50, -6); for (let k = 0; k < 4; k++) { const lx = 8 + k * 11; rdcBox(B, lx, -14, 9, 8, ['#5a5650', '#3a3632', '#24201c'], 2, 0, 1); rdcRect(B, lx + 7, -13, 2, 6, '#f0ecd8', 4); }
    } else if (n === 5) { // 瞭望台：木台子 + 栏杆 + 梯子 + 沙袋
      for (const x of [8, 40]) rdcRect(B, x, -40, 3, 40, P.wood[2], 1); rdcLine(B, 10, -6, 40, -36, P.wood[3], 1); rdcLine(B, 40, -6, 10, -36, P.wood[3], 1);
      rdcBox(B, 2, -44, 48, 4, P.wood, 1, 0, 1); for (let x = 2; x <= 50; x += 8) rdcRect(B, x, -56, 2, 12, P.wood[2], 1); rdcRect(B, 2, -56, 50, 2, P.wood[1], 1);
      for (let k = 0; k < 3; k++) rdgBall(B, 14 + k * 9, -47, 4, ['#d4c08e', '#b8a070', '#968052'], 1);
      for (let y = -40; y < 0; y += 5) rdcRect(B, 52, y, 6, 1, P.wood[2], 1); rdcRect(B, 52, -40, 1, 40, P.wood[3], 1); rdcRect(B, 57, -40, 1, 40, P.wood[3], 1);
    } else if (n === 6 || n === 12) { // 雷达天线 / 外星感应天线（杆子；转盘、光环每帧画）
      if (n === 12) { rdcPoly(B, [[20, 0], [24, -48], [28, 0]], P.cry, 2); for (let y = -40; y < 0; y += 10) rdcRect(B, 21, y, 6, 1, P.glow, 4); }
      else { rdcRect(B, 22, -26, 3, 26, P.rail[2], 2); rdcBox(B, 16, -4, 15, 4, RDP.rail, 2, 0, 1); }
    } else if (n === 7 || n === 14) { // 炮座
      for (let k = 0; k < (n === 14 ? 2 : 1); k++) { const bx = 10 + k * 40; rdcBox(B, bx, -5, 26, 5, P.olive, 2, 0, 1); rdcBox(B, bx + 4, -9, 18, 4, RDP.rail, 2, 0, 1); for (let x = bx + 2; x < bx + 26; x += 6) rdgRiv(B, x, -4); }
    } else if (n === 8) { rdcRect(B, 20, -40, 3, 40, P.rail[2], 2); rdcBox(B, 14, -46, 16, 7, P.white, 2, 0, 1); rdcPoly(B, [[30, -44], [38, -48], [38, -40]], P.white, 2); } // 风力发电机：杆子 + 机舱（叶片每帧画）
    else if (n === 10) { rdcBox(B, 4, -18, 50, 18, P.olive, 2, 0, 1); rdcRect(B, 8, -19, 42, 2, P.olive[0], 2); rdcLine(B, 29, -18, 29, 0, P.olive[3], 2); rdcRect(B, 10, -12, 10, 2, '#ffd060', 4); for (let x = 6; x < 54; x += 8) rdgRiv(B, x, -4); } // 无人机机库
    else if (n === 11) { rdcPoly(B, [[4, -16], [40, -16], [28, -6], [16, -6]], P.blue, 1); for (let x = 8; x < 38; x += 5) rdcLine(B, x, -16, 22, -7, P.blue[3], 1); rdcBox(B, 16, -6, 12, 6, P.rail, 2, 0, 1); rdcBox(B, 46, -16, 14, 16, P.blue, 1, 0, 1); rdcRect(B, 46, -12, 14, 1, P.blue[3], 1); rdcRect(B, 46, -6, 14, 1, P.blue[3], 1); } // 雨水收集棚
  });
}
function rdpRoof(g, x, y, L, p, ry) {
  const R = G.road, Q = RD_Q, t = G.time, n = parseInt(p.id.replace(/\D+/g, ''), 10), rx = -L + 3, rw = Math.max(40, (L - 21) * Q), X = x + rx, Y = y + ry;
  if (n === 2 && !R.driving && R.speedNow < 1) { // 停车时遮阳棚撑开
    const S = rdpGet('awnOpen_' + rw, rw + 120, 80, 100, 10, (B) => { for (let x = -90; x < rw - 8; x++) { const yy = Math.round(-4 + Math.max(0, -x) * 0.25); for (let k = 0; k < 4; k++) rdcPix(B, x, yy + k, ((x >> 3) & 1) ? RDP.stripe[0] : RDP.canvas[0], 1); if (x < 0 && (x % 6 === 0)) rdcPix(B, x, yy + 4, RDP.canvas[2], 1); } rdcRect(B, -88, 22, 2, 48, RDP.rail[2], 2); rdcRect(B, -50, 12, 2, 58, RDP.rail[2], 2); });
    rdpBlit(g, S, X, Y); return;
  }
  rdpBlit(g, rdpRoofSprite(p.id, rw), X, Y);
  const q = 1 / Q;
  if (n === 4 && rdDaylight() < 0.5) { for (let k = 0; k < 4; k++) { g.globalAlpha = 0.7; g.drawImage(rdsGlow('#fff4c8'), X + (8 + k * 11 + 8) * q - 3, Y - 10 * q - 3, 6, 6); } g.globalAlpha = 1; }
  if (n === 6) { const a = t * 2, w2 = Math.abs(Math.cos(a)) * 8; g.fillStyle = '#d8d4c8'; g.fillRect(X + 23.5 * q - w2 / 2, Y - 30 * q, Math.max(q, w2), 3); g.fillStyle = '#8a867c'; g.fillRect(X + 23.5 * q - w2 / 2, Y - 30 * q + 2, Math.max(q, w2), 1); g.fillStyle = '#ff5038'; if (Math.sin(t * 5) > 0) g.fillRect(X + 23 * q, Y - 32 * q - 1, q * 2, q * 2); }
  if (n === 12) { const pl = 0.5 + Math.sin(t * 2) * 0.3; g.globalAlpha = pl; g.drawImage(rdsGlow('#73eff7'), X + 24 * q - 5, Y - 48 * q - 5, 10, 10); for (let k = 0; k < 3; k++) { const r = ((t * 6 + k * 4) % 12); g.globalAlpha = (1 - r / 12) * 0.6; g.strokeStyle = '#73eff7'; g.lineWidth = q; g.beginPath(); g.ellipse(X + 24 * q, Y - 48 * q, r, r * 0.35, 0, 0, 7); g.stroke(); } g.globalAlpha = 1; }
  if (n === 13) { g.globalAlpha = 0.3 + Math.sin(t * 1.5) * 0.15; g.fillStyle = '#e0b0ff'; for (let k = 0; k < 5; k++) g.fillRect(X + (rw / 2 - 6 - k * 9) * q, Y - (50 - k * 6) * q + Math.sin(t * 2 + k), q * 2, q * 2); g.globalAlpha = 1; }
  if (n === 8) { const a0 = t * (R.speedNow > 1 ? 14 : 2), cx = X + 30 * q, cy = Y - 43 * q; g.fillStyle = '#ece8dc'; for (let b = 0; b < 3; b++) { const a = a0 + b * 2.094; for (let r = 1; r < 13; r++) g.fillRect(Math.round((cx + Math.cos(a) * r * q * 1.6) * Q) / Q, Math.round((cy + Math.sin(a) * r * q * 1.6) * Q) / Q, q * 2, q * 2); } g.fillStyle = '#5a5650'; g.fillRect(cx - q, cy - q, q * 3, q * 3); }
  if (n === 10) { // 无人机：搜索时飞到建筑上空，平时停在机库上
    let dx = X + 29 * q, dy = Y - 22 * q;
    if (R.search && R.search.phase === 'in') { const s = R.search.site; dx = rdSX(s.km * RD_PX_KM) + Math.sin(t * 2) * 20; dy = RDV.gy - 13 - RD_SITES[s.type].h - 14 + Math.sin(t * 3) * 4; }
    const D = rdpGet('drone', 40, 20, 20, 10, (B) => { rdcBox(B, -6, -2, 12, 5, ['#5a5650', '#3a3632', '#24201c'], 2, 0, 1); rdcLine(B, -12, -3, 12, -3, '#3a3632', 2); rdcRect(B, -1, 3, 2, 2, '#ff5038', 4); rdcRect(B, -3, 1, 6, 1, '#73eff7', 4); });
    rdpBlit(g, D, dx, dy); g.fillStyle = '#c8c4bc'; const sp = Math.abs(Math.sin(t * 40)) * 2.5; g.fillRect(dx - 4 - sp / 2, dy - 4 * q, sp + q, q); g.fillRect(dx + 4 - sp / 2, dy - 4 * q, sp + q, q);
  }
  if (n === 11 && R.weather && R.weather.type === 'storm') { g.fillStyle = '#9ab0c8'; for (let k = 0; k < 3; k++) { const p2 = (t * 2 + k / 3) % 1; g.fillRect(X + 22 * q, Y - 5 * q + p2 * 3, q, q * 2); } }
}

// ---------- 车身外挂 ----------
function rdpUtil(g, x, y, L, p, v, roofY) {
  const R = G.road, Q = RD_Q, q = 1 / Q, t = G.time, n = parseInt(p.id.replace(/\D+/g, ''), 10), bike = !!v.tent, top = roofY;
  const get = (k, w, h, ox, oy, fn) => rdpGet('u' + n + '_' + k, w, h, ox, oy, fn);
  if (n === 1) { const S = get('w', 30, 30, 10, 20, (B) => { rdgTube(B, -6, 6, -6, 4, RDP.rail); rdcRect(B, -7, -2, 14, 3, RDP.olive[2], 2); for (let k = 0; k < 6; k++) rdcLine(B, -6 + k * 2, -9, -5 + k * 2, -3, RDP.rail[3], 2); rdcLine(B, 6, -6, 12, 2, '#3a3632', 2); rdcPoly(B, [[11, 2], [15, 2], [15, 6], [13, 4]], RDP.rail[1], 2); }); rdpBlit(g, S, x + 1, y - 8); }
  else if (n === 2 || n === 6 || n === 9) { // 铁丝网 / 电护栏 / EMP 环：沿车身上沿
    const len = Math.round((L - 4) * Q), S = get('l' + len, len + 20, 30, 10, 20, (B) => {
      if (n === 2) for (let x = 0; x < len; x++) { const a = x * 0.6; rdcPix(B, x, Math.round(-4 + Math.sin(a) * 3), '#6a665e', 2); rdcPix(B, x + Math.round(Math.cos(a) * 2), Math.round(-4 + Math.cos(a) * 3), '#8a867c', 2); if (x % 9 === 0) { rdcPix(B, x, -8, '#a8a49a', 2); rdcPix(B, x, 0, '#a8a49a', 2); } }
      else if (n === 6) { for (let x = 0; x < len; x += 14) rdcRect(B, x, -8, 2, 8, RDP.rail[2], 2); for (const yy of [-7, -3]) rdcLine(B, 0, yy, len, yy, '#4a8ac8', 2); }
      else { for (let x = 6; x < len; x += 26) { rdcBox(B, x, -6, 10, 6, RDP.purple, 2, 0, 1); rdcRect(B, x + 3, -8, 4, 2, RDP.glow, 4); } }
    });
    rdpBlit(g, S, x - L + 2, y + top);
    if (n === 6 && Math.random() < 0.35) { const sx = x - L + 2 + Math.random() * (L - 4); g.fillStyle = '#d8f0ff'; for (let k = 0; k < 4; k++) g.fillRect(sx + (Math.random() - 0.5) * 3, y + top - 2 - Math.random() * 3, q * 2, q * 2); }
    if (n === 9) { const r = (t * 30) % 30; g.globalAlpha = (1 - r / 30) * 0.5; g.strokeStyle = '#73eff7'; g.lineWidth = q * 2; g.beginPath(); g.ellipse(x - L / 2, y - 16, L / 2 + r * 0.6, 20 + r * 0.3, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
  }
  else if (n === 3) { const S = get('b', 50, 50, 25, 40, (B) => { rdcBox(B, -10, -30, 14, 30, RDC_PAL.crate, 1, 0, 1); for (let y = -26; y < 0; y += 8) rdcLine(B, -10, y, 3, y, RDC_PAL.crate[3], 1); rdcRect(B, -8, -20, 3, 4, RDP.rail[1], 2); }); rdpBlit(g, S, x - L, y - (bike ? 6 : 8)); }
  else if (n === 4) { const S = get('s', 40, 30, 20, 24, (B) => { rdcRect(B, -1, -6, 2, 6, RDP.rail[2], 2); for (const d of [-1, 1]) rdcPoly(B, [[d * 2, -12], [d * 12, -18], [d * 12, -6], [d * 2, -10]], RDP.white, 2); }); const sx = x - (bike ? 12 : 22); rdpBlit(g, S, sx, y + top); if (!R.driving || Math.sin(t) > 0) rdNotes(g, sx + 4, y + top - 6, '#ffcd75'); }
  else if (n === 5) { const S = get('k', 30, 40, 15, 30, (B) => { for (let k = 0; k < 2; k++) rdcBox(B, -8 + k * 9, -18, 8, 18, ['#8a8478', '#5e5a52', '#3e3a34'], 2, 0, 1); rdcRect(B, -8, -10, 17, 2, '#e0c040', 2); }); rdpBlit(g, S, x - L + 3, y - 6); if (R.speedNow > 1) for (let k = 0; k < 5; k++) { const pp = (t * 0.8 + k / 5) % 1; g.globalAlpha = (1 - pp) * 0.45; g.fillStyle = '#c8c4bc'; const sz = 2 + pp * 9; g.fillRect(x - L - pp * 30 - sz / 2, y - 12 - pp * 10 - sz / 2, sz, sz); } g.globalAlpha = 1; }
  else if (n === 7) { const S = get('f', 40, 40, 20, 30, (B) => { for (let k = 0; k < 2; k++) { rdgTube(B, -10, 6, -6 - k * 9, 3, RDP.red, 1); rdcRect(B, 6, -8 - k * 9, 3, 4, RDP.rail[2], 2); } rdcLine(B, 9, -6, 14, -16, '#2a2622', 2); }); rdpBlit(g, S, x - L * 0.45, y - 10); }
  else if (n === 8) { // 机械臂：车顶后部，臂节摆动，爪子开合
    const bx = x - L + 8, by = y + top, a1 = -1.1 + Math.sin(t * 0.9) * 0.4, a2 = a1 + 1.2 + Math.sin(t * 1.3) * 0.5;
    const seg = (x0, y0, a, len, c, w) => { g.fillStyle = c; for (let s = 0; s <= len * Q; s++) g.fillRect(Math.round((x0 + Math.cos(a) * s * q) * Q) / Q - w / 2, Math.round((y0 + Math.sin(a) * s * q) * Q) / Q - w / 2, w, w); return [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]; };
    g.fillStyle = '#3a3e26'; g.fillRect(bx - 2, by - 2, 4, 2);
    const j = seg(bx, by - 2, a1, 9, '#d0a040', 1.33), k2 = seg(j[0], j[1], a2, 7, '#c09030', 1); g.fillStyle = '#3a3632'; g.fillRect(j[0] - 0.67, j[1] - 0.67, 1.33, 1.33);
    const op = 0.5 + Math.sin(t * 2) * 0.3; seg(k2[0], k2[1], a2 + op, 2.5, '#6a665e', q * 2); seg(k2[0], k2[1], a2 - op, 2.5, '#6a665e', q * 2);
  }
  else if (n === 10) { g.globalAlpha = 0.25; g.strokeStyle = '#a8e0ff'; g.lineWidth = q; for (let k = 0; k < 6; k++) { const yy = y - 4 - ((t * 10 + k * 6) % 34); g.beginPath(); g.moveTo(x - L - 2, yy); g.lineTo(x + 2, yy + Math.sin(t * 3 + k) * 1.5); g.stroke(); } g.globalAlpha = 1; }
  else if (n === 11) { for (let k = 0; k < 14; k++) { const tt = t * 1.5 + k * 0.45, px = x - L / 2 + Math.cos(tt) * L * 0.6, py = y - 16 + Math.sin(tt * 1.3) * 16; g.globalAlpha = 0.6; g.fillStyle = k % 3 ? '#73eff7' : '#c27bd6'; g.fillRect(px, py, q * 2, q * 2); if (k % 4 === 0) { g.globalAlpha = 0.25; g.drawImage(rdsGlow('#73eff7'), px - 2, py - 2, 4, 4); } } g.globalAlpha = 1; }
  else if (n === 12) { const S = get('r', 50, 30, 10, 26, (B) => { rdcRect(B, -2, -18, 34, 2, RDP.rail[2], 2); rdcRect(B, -2, 0, 34, 2, RDP.rail[2], 2); for (let k = 0; k < 4; k++) rdpCan(B, k * 8, 0, k % 2 ? RDP.red : RDP.olive); }); rdpBlit(g, S, x - L - 1, y - 6); }
}

// ---------- 油箱（车身侧面下方） ----------
function rdpTank(g, x, y, L, p, v) {
  const n = parseInt(p.id.replace(/\D+/g, ''), 10), bike = !!v.tent;
  const S = rdpGet('tank' + n, 80, 40, 10, 30, (B) => {
    if (n === 1) for (let k = 0; k < 3; k++) { rdcBox(B, k * 9, -14, 8, 14, k % 2 ? ['#e8e8e0', '#c8c8c0', '#a0a098'] : RDP.blue, 1, 0, 1); rdcRect(B, k * 9 + 3, -16, 2, 2, '#3a3632', 2); } // 塑料桶 + 绑带
    else if (n === 2 || n === 3) { const len = n === 2 ? 22 : 36; rdgTube(B, 0, len, -7, 6, RDP.rail); for (const bx of [3, len - 4]) rdcRect(B, bx, -14, 2, 15, '#3a3632', 2); rdcRect(B, len - 3, -13, 3, 3, '#3a3632', 2); }
    else if (n === 4) { rdgTube(B, 0, 30, -7, 6, RDP.rail); rdcBox(B, -2, -15, 34, 6, RDP.olive, 2, 0, 1); for (let xx = 0; xx < 32; xx += 7) rdgRiv(B, xx, -13); }
    else if (n === 5) { rdgTube(B, 0, 40, -8, 7, RDP.olive); rdcRect(B, 6, -9, 22, 2, '#e8e0c0', 2); for (let xx = 8; xx < 28; xx += 4) rdcRect(B, xx, -9, 2, 2, '#2a2a20', 2); rdgBall(B, 40, -8, 6, RDP.olive); }
    else { rdgTube(B, 0, 30, -8, 7, RDP.purple); for (let xx = 4; xx < 30; xx += 7) rdcRect(B, xx, -14, 1, 12, RDP.glow, 4); }
  });
  rdpBlit(g, S, x - L + (bike ? 6 : 4), y - (bike ? 8 : 4));
  if (n === 6) { g.globalAlpha = 0.3 + Math.sin(G.time * 3) * 0.15; g.drawImage(rdsGlow('#73eff7'), x - L + (bike ? 6 : 4) - 1, y - 12, 12, 8); g.globalAlpha = 1; }
}

// ---------- 挂车 ----------
const RDP_TRL = { trl1: [28, 10], trl2: [36, 24], trl3: [44, 24], trl4: [48, 30], trl5: [46, 28], trl6: [24, 20] }; // 长、高（世界像素）
function rdpTrailerSprite(id) {
  const n = parseInt(id.replace(/\D+/g, ''), 10), [Lw, Hw] = RDP_TRL[id] || [30, 20], Q = RD_Q, L = Lw * Q, H = Hw * Q;
  return rdpGet('trl' + n, L + 40, H + 60, L + 20, H + 40, (B) => {
    const top = -H - 12, P = RDP;
    rdcRect(B, -L, -12, L, 4, '#3a3632', 2); rdcLine(B, 0, -10, 14, -12, '#3a3632', 2); rdcRect(B, 13, -14, 4, 4, RDP.rail[2], 2); // 底盘 + 挂杆
    if (n === 1) { rdcBox(B, -L, -30, L, 18, P.wood, 1, 0, 1); for (let xx = -L; xx < 0; xx += 12) rdcRect(B, xx, -30, 2, 18, P.wood[3], 1); rdcBox(B, -L + 6, -44, 22, 14, RDC_PAL.crate, 1, 0, 1); rdgBall(B, -L + 44, -36, 8, ['#6a8a5a', '#4e6a42', '#36502e'], 1); rdpCan(B, -18, -30, P.red); return; }
    if (n === 2) { for (let xx = -L; xx < 0; xx++) for (let yy = top; yy < -12; yy++) { const u = (xx + L) / L, rr = Math.min(u * 3, 1), lim = top + (1 - Math.sqrt(Math.max(0, 1 - Math.pow(1 - rr, 2)))) * 30; if (yy < lim) continue; rdcPix(B, xx, yy, Math.abs(yy - (top + H * 0.55)) < 3 ? P.stripe[0] : rdcRampAt(P.white, 0.2 + (yy - top) / H * 0.6, xx, yy), 1); } }
    else { const R = n === 3 ? P.orange : n === 4 ? P.white : n === 5 ? P.olive : P.purple;
      rdcBox(B, -L, top, L, H, R, 1, 0, 1);
      if (n === 3) for (let xx = -L + 2; xx < 0; xx += 6) { rdcRect(B, xx, top + 2, 1, H - 4, R[3], 1); rdcRect(B, xx + 1, top + 2, 1, H - 4, R[0], 1); }
      if (n === 3) { for (const yy of [top + 8, top + H - 10]) rdcRect(B, -L + 4, yy, 2, 3, '#3a3632', 2); rdcRect(B, -L + 2, top, 1, H, R[3], 1); }
      if (n === 4) { const sy = top + Math.round(H * 0.45); rdcRect(B, -L, sy, L, 5, P.blue[1], 1); rdcRect(B, -L, sy + 5, L, 2, P.stripe[0], 1); }
      if (n === 5) { for (let xx = -L; xx < 0; xx += 24) { rdcRect(B, xx, top, 1, H, R[3], 2); for (let yy = top + 4; yy < top + H; yy += 12) rdgRiv(B, xx + 3, yy); } for (let k = 0; k < 3; k++) rdcRect(B, -L + 16 + k * 40, top + 16, 16, 3, '#1a1612', 2); rdcBox(B, -Math.round(L / 2) - 12, top - 6, 24, 6, P.olive, 2, 0, 1); }
      if (n === 6) { for (let xx = -L + 6; xx < 0; xx += 14) rdcRect(B, xx, top + 3, 1, H - 6, P.glow, 4); rdcRect(B, -L, top + H / 2, L, 1, P.glow2, 4); }
    }
    if (n === 2 || n === 4) { const rows = n === 4 ? 2 : 1; for (let r = 0; r < rows; r++) for (let k = 0; k < (n === 4 ? 4 : 2); k++) { const wx = -L + 16 + k * (n === 4 ? 34 : 40), wy = top + 10 + r * 44; rdcRect(B, wx - 1, wy - 1, 22, 16, '#5a5650', 2); for (let xx = 0; xx < 20; xx++) for (let yy = 0; yy < 14; yy++) rdcPix(B, wx + xx, wy + yy, ((xx + yy) % 9 < 2) ? '#a8c8d8' : '#3a5056', 3); } rdcRect(B, -24, top + 18, 14, H - 30, P.white[2], 1); rdcRect(B, -13, top + 34, 2, 2, '#3a3632', 2); }
  });
}
function rdpTrailer(g, x, y, p, hover, moving) {
  const id = p.id, [Lw] = RDP_TRL[id] || [30, 20], S = rdpTrailerSprite(id), Q = RD_Q, t = G.time;
  const hy = id === 'trl6' || hover ? -4 + Math.sin(t * 2.5) * 1.2 : 0;
  // 轮子（和车一样转）
  if (id !== 'trl6' && !hover) { const wxs = Lw > 40 ? [-Lw * 0.25, -Lw * 0.25 - 9] : [-Lw * 0.45]; g.save(); g.translate(x, y); g.scale(1 / Q, 1 / Q); for (const wx of wxs) rdmWheel(g, wx * Q, -10, 10, RDC_ANIM.ph, null, false, false); g.restore(); }
  else { g.globalAlpha = 0.35 + Math.sin(t * 6) * 0.15; g.drawImage(rdsGlow(id === 'trl6' ? '#c27bd6' : '#73eff7'), x - Lw - 2, y - 3, Lw + 4, 6); g.globalAlpha = 1; }
  rdpBlit(g, S, x, y + hy);
  if ((id === 'trl2' || id === 'trl4') && rdDaylight() < 0.5) { const H = RDP_TRL[id][1]; g.globalAlpha = 0.55; g.fillStyle = '#ffcd75'; const rows = id === 'trl4' ? 2 : 1; for (let r = 0; r < rows; r++) for (let k = 0; k < (id === 'trl4' ? 4 : 2); k++) g.fillRect(x + (-Lw * Q + 16 + k * (id === 'trl4' ? 34 : 40)) / Q, y + hy + (-H * Q - 12 + 10 + r * 44) / Q, 20 / Q, 14 / Q); g.globalAlpha = 1; }
  if (id === 'trl6') { g.globalAlpha = 0.25 + Math.sin(t * 2) * 0.15; g.drawImage(rdsGlow('#c27bd6'), x - Lw - 4, y + hy - 26, Lw + 8, 24); g.globalAlpha = 1; }
}
// ---------- 空间核心：后车门上荡开的紫色涟漪 ----------
function rdpSpace(g, x, y, L, p) {
  const t = G.time, n = parseInt(p.id.replace(/\D+/g, ''), 10), cx = x - L + 5, cy = y - 20, q = 1 / RD_Q;
  g.globalAlpha = 0.25 + Math.sin(t * 2) * 0.1; g.drawImage(rdsGlow('#c27bd6'), cx - 6, cy - 12, 12, 24);
  for (let k = 0; k < n + 1; k++) { const r = ((t * 4 + k * 3) % 8); g.globalAlpha = (1 - r / 8) * 0.7; g.strokeStyle = k % 2 ? '#73eff7' : '#c27bd6'; g.lineWidth = q * 1.5; g.beginPath(); g.ellipse(cx, cy, 1.5 + r * 0.4, 5 + r, 0, 0, 7); g.stroke(); }
  g.globalAlpha = 1;
}
// ---------- 挂车车内：按挂车种类换外壳颜色和墙上的花样 ----------
function rdpTrailerSkin() { const id = G.road && G.road.ext && G.road.ext.trailer; return ({ trl2: RDC_PAL.cream, trl3: RDP.orange, trl4: RDP.white, trl5: RDP.olive, trl6: RDP.purple })[id] || RDC_PAL.metal; }
function rdpTrailerRoom(B, FW, FH) {
  const id = G.road && G.road.ext && G.road.ext.trailer;
  if (id === 'trl2') { for (let x = 0; x < FW; x++) { rdcPix(B, x, FH - 30, RDP.stripe[0], 1); rdcPix(B, x, FH - 29, RDP.stripe[0], 1); rdcPix(B, x, FH - 28, RDP.stripe[1], 1); } }
  else if (id === 'trl3') { for (let y = 4; y < FH; y++) for (let x = 0; x < FW; x++) { if (rdcMat(B, x, y) !== 1) continue; const m = x % 8; rdcPix(B, x, y, rdcRampAt(RDP.orange, 0.3 + (m < 2 ? -0.2 : m > 5 ? 0.35 : 0.1) + y / FH * 0.3, x, y), 1); } for (let x = 0; x < FW; x += 52) for (let y = 10; y < FH - 6; y += 14) rdcRect(B, x + 2, y, 3, 3, '#3a3632', 2); }
  else if (id === 'trl4') { for (let y = FH - 40; y < FH; y++) for (let x = 0; x < FW; x++) rdcPix(B, x, y, rdcRampAt(RDP.wood, 0.3 + (x % 14 === 0 ? 0.5 : 0) + (y - FH + 40) / 40 * 0.4, x, y), 1); rdcRect(B, 0, FH - 41, FW, 2, RDP.wood[3], 1); }
  else if (id === 'trl5') { for (let y = 4; y < FH; y++) for (let x = 0; x < FW; x++) if (rdcMat(B, x, y) === 1) rdcPix(B, x, y, rdcRampAt(RDP.olive, 0.25 + y / FH * 0.5 + (x % 39 === 0 ? 0.4 : 0), x, y), 1); for (let x = 3; x < FW; x += 13) for (const y of [8, FH - 10]) rdgRiv(B, x, y); }
  else if (id === 'trl6') { for (let y = 4; y < FH; y++) for (let x = 0; x < FW; x++) { if (rdcMat(B, x, y) !== 1) continue; const e = rdmHexEdge ? rdmHexEdge(x, y) : false; const lit = e && rdcNoise2(x / 30, y / 20, 9) > 0.62; rdcPix(B, x, y, lit ? RDP.glow : e ? RDP.purple[3] : rdcRampAt(RDP.purple, 0.25 + y / FH * 0.4, x, y), lit ? 4 : 1); } }
}
