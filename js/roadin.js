// =============================================
//  公路求生：车内剖面（精细像素版）
//  像把货车从侧面切开：外壳切面能看到车漆、保温棉、内衬；后墙是铁皮/木板/墙纸，地板是花纹钢板/木地板；
//  车底下能看到大梁和轮子，窗外是会动的风景。
//  房间的墙和地板是静态的，画一次缓存起来；窗外风景、灯光、轮子每帧画。
//  家具、主角、宠物先用「自动精细化」：把原来的画放大 3 倍，自动圆滑斜边、加明暗和深褐描边
//  坐标：参数都是世界像素；函数内部换成精细像素（× RD_Q）直接画
// =============================================

const RDI_CACHE = {};
const RDI_PAL = {
  foam: ['#f0d080', '#d8b058', '#b08a40'],             // 保温棉
  steel: ['#b8ac9c', '#948878', '#766a5c', '#584e44', '#3e362e'], // 车厢内壁铁皮（暖灰）
  ply: ['#d8a870', '#c08f58', '#a07448', '#7c5636', '#5a3c26'],   // 胶合板
  paper: ['#f2deb0', '#e2c890', '#c8aa70', '#a08450'],             // 墙纸
  plate: ['#a8a090', '#888072', '#6a6258', '#4a443c'],             // 花纹钢板地面
  wood: ['#c89058', '#a87444', '#86582e', '#5e3c1e'],              // 木地板
};

// ---------- 车厢房间（缓存成图片） ----------
// w：房间宽（世界像素）；kind：'steel' | 'ply' | 'paper'；floor：'plate' | 'wood'；skin：外壳车漆颜色（ramp）
function rdiRoomKey(w, kind, floor, trailer, lit) { return [w, kind, floor, trailer ? 1 : 0, lit ? 1 : 0].join('|'); }
function rdiBuildRoom(w, kind, floor, trailer, lit) {
  const Q = RD_Q, P = RDC_PAL, IP = RDI_PAL;
  const FW = w * Q, FH = 50 * Q; // 房间内部：宽 FW，高 FH（天花板 y = 0，地面 y = FH）
  const B = rdcPaper(FW + 20, FH + 36, 10, 13);
  const skin = trailer ? P.metal : P.cream;
  // —— 外壳切面（上、左、右）：车漆 → 保温棉 → 内衬
  rdcBox(B, -9, -12, FW + 18, 4, skin, 1);
  rdcBox(B, -9, -8, FW + 18, 5, IP.foam, 1);
  rdcBox(B, -9, -3, FW + 18, 3, [P.metal[1], P.metal[2]], 2);
  for (const sx of [-9, FW + 1]) {
    rdcBox(B, sx, -12, 8, FH + 26, skin, 1);
    rdcBox(B, sx === -9 ? -6 : FW + 1, -8, 5, FH + 20, IP.foam, 1);
    rdcRect(B, sx === -9 ? -1 : FW, -3, 1, FH + 3, P.metal[2], 2);
  }
  // 保温棉的蓬松纹理（抖点）
  for (let y = -8; y < FH + 12; y++) for (let x = -9; x < FW + 9; x++) if (B.c[(y + B.oy) * B.w + x + B.ox] === rdcHex(IP.foam[1]) && rdcHash(x, y, 5) < 0.18) rdcPix(B, x, y, rdcHash(x, y, 6) < 0.5 ? IP.foam[0] : IP.foam[2], 1);
  // —— 后墙
  const RAMP = kind === 'ply' ? IP.ply : kind === 'paper' ? IP.paper : IP.steel;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let t = 0.15 + (y / FH) * 0.55; // 上亮下暗
    if (kind === 'steel') { const m = x % 6; t += m === 0 ? -0.2 : m === 4 ? 0.18 : m === 5 ? 0.3 : 0; } // 竖向瓦楞
    if (kind === 'ply') { const n = rdcNoise2(x / 14, y / 2.2, 3 + Math.floor(x / 78)); t += (n - 0.5) * 0.35; } // 木纹
    if (kind === 'paper') { const px = x % 12, py = y % 12; if ((Math.abs(px - 6) + Math.abs(py - 6)) === 4) t += 0.4; if (px === 6 && py === 6) t += 0.6; } // 菱形花纹
    // 靠天花板、地面、两边的地方暗一点（阴影）
    if (y < 4) t += 0.25; if (y > FH - 5) t += 0.2; if (x < 3 || x > FW - 4) t += 0.2;
    rdcPix(B, x, y, rdcRampAt(RAMP, Math.max(0, Math.min(1, t)), x, y), 1);
  }
  // 墙纸下面三分之一是木护墙板
  if (kind === 'paper') { for (let y = FH - 42; y < FH; y++) for (let x = 0; x < FW; x++) { let t = 0.3 + ((y - FH + 42) / 42) * 0.5 + (x % 18 === 0 ? 0.4 : x % 18 === 1 ? -0.2 : 0); rdcPix(B, x, y, rdcRampAt(IP.ply, Math.min(1, t), x, y), 1); } rdcRect(B, 0, FH - 43, FW, 2, IP.ply[3], 1); rdcRect(B, 0, FH - 44, FW, 1, IP.ply[0], 1); }
  // 每格一块板：板缝 + 角上的螺丝
  for (let x = 0; x <= FW; x += 26 * Q) {
    if (x > 0 && x < FW) { rdcRect(B, x, 0, 1, FH, RAMP[RAMP.length - 1], 6); rdcRect(B, x + 1, 0, 1, FH, RAMP[0], 1); }
    if (kind !== 'paper') for (const y of [8, FH - 8]) { if (x > 2) rdcRivet(B, x - 3, y); if (x < FW - 3) rdcRivet(B, x + 2, y); }
  }
  // 铁皮车厢：一条货物固定轨（真实货车车厢里都有）+ 锈迹顺着铆钉往下流
  if (kind === 'steel') {
    const ty = FH - 54;
    rdcBox(B, 0, ty, FW, 5, [P.metal[0], P.metal[1], P.metal[2], P.metal[3]], 2);
    for (let x = 3; x < FW - 3; x += 6) rdcRect(B, x, ty + 1, 3, 3, D_SLOT(), 6);
    for (let k = 0; k < FW / 9; k++) { const x = Math.floor(rdcHash(k, 1, 8) * FW), y0 = Math.floor(rdcHash(k, 2, 8) * FH * 0.7), len = 3 + Math.floor(rdcHash(k, 3, 8) * 10); for (let j = 0; j < len; j++) if (rdcMat(B, x, y0 + j) === 1) rdcPix(B, x, y0 + j, j < 2 ? P.rust[1] : P.rust[2], 1); }
  }
  // —— 天花板：暗色顶棚 + 横梁 + 灯具
  rdcBox(B, 0, 0, FW, 6, [RDC_PAL.dark[0], RDC_PAL.dark[1], RDC_PAL.dark[2]], 6);
  for (let x = 6; x < FW; x += 39) rdcBox(B, x, 0, 4, 7, [P.metal[2], P.metal[3]], 2);
  for (let k = 20 * Q; k < FW - 10 * Q; k += 40 * Q) {
    rdcBox(B, k, 6, 18, 3, [P.metal[1], P.metal[2]], 2);
    rdcRect(B, k + 1, 9, 16, 1, lit ? P.light[0] : P.metal[3], 4); rdcRect(B, k + 2, 10, 14, 1, lit ? P.light[1] : P.metal[3], 4);
  }
  // —— 地板：表面 + 厚度（看得见的切面）
  const F = floor === 'wood' ? IP.wood : IP.plate;
  for (let x = 0; x < FW; x++) for (let y = FH; y < FH + 4; y++) {
    let t = (y - FH) / 4 * 0.5;
    if (floor === 'wood') { if (x % 27 === 0) t = 0.95; else t += (rdcNoise2(x / 9, y, 4) - 0.5) * 0.4; }
    else { const px = (x + (y - FH) * 2) % 8; if (px === 0 || px === 1) t -= 0.3; if (px === 2) t += 0.35; } // 花纹钢板的凸起
    rdcPix(B, x, y, rdcRampAt(F, Math.max(0, Math.min(1, t)), x, y), floor === 'wood' ? 1 : 2);
  }
  rdcBox(B, -9, FH + 4, FW + 18, 8, [RDC_PAL.dark[0], RDC_PAL.dark[1], RDC_PAL.dark[2]], 6);
  for (let x = 4; x < FW; x += 26) rdcRivet(B, x, FH + 7);
  rdcBox(B, -9, FH + 12, FW + 18, 4, skin, 1);
  // 外壳做旧（只锈外壳，不锈墙）
  rdcWeatherShell(B, FW, FH);
  rdcOutline(B);
  return rdcToCanvas(B);
}
function D_SLOT() { return RDC_PAL.dark[2]; }
// 外壳切面上的锈和泥点
function rdcWeatherShell(B, FW, FH) {
  for (let y = -12; y < FH + 16; y++) for (let x = -9; x < FW + 9; x++) {
    const inside = x >= 0 && x < FW && y >= 0 && y < FH + 12;
    if (inside || rdcMat(B, x, y) !== 1) continue;
    const n = rdcNoise2(x / 10, y / 6, 21) * 0.8 + rdcHash(x, y, 22) * 0.2;
    if (n > 0.8) rdcPix(B, x, y, n > 0.86 ? RDC_PAL.rust[2] : RDC_PAL.rust[1], 1);
  }
}

// ---------- 背景：天空、远山、路面、车底的大梁和轮子 ----------
function rdiBackground(g, vw, vh, floorY, day, b, wheels) {
  const Q = RD_Q, R = G.road, W = Math.ceil(vw * Q), H = Math.ceil(vh * Q), fy = floorY * Q;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const sg = g.createLinearGradient(0, 0, 0, fy);
  sg.addColorStop(0, rdMix('#0b0d1c', b.sky[0], day)); sg.addColorStop(1, rdMix('#1f2346', b.sky[1], day));
  g.fillStyle = sg; g.fillRect(0, 0, W, fy + Q * 12);
  const scroll = rdVehX() * Q;
  g.fillStyle = rdMix('#10121f', b.far, day * 0.9);
  for (let x = 0; x < W; x += 2) { const hh = (14 + rdNoise((x + scroll * 0.05) / 110) * 40 + rdNoise((x + scroll * 0.05) / 37) * 12); g.fillRect(x, fy + 6 * Q - hh, 2, hh); }
  // 路面（往后滚）
  const road = fy + 12 * Q, gr = rdMix('#10121f', b.ground, day * 0.8), rc = rdMix('#10121f', b.road, day * 0.85);
  g.fillStyle = gr; g.fillRect(0, fy + 6 * Q, W, H);
  g.fillStyle = rc; g.fillRect(0, road - 4, W, 30);
  g.fillStyle = rdShade(rc, 0.12); g.fillRect(0, road - 4, W, 1);
  g.fillStyle = rdMix('#10121f', b.snow ? '#94b0c2' : '#c9a86a', day * 0.9);
  const off = ((scroll % 72) + 72) % 72;
  for (let x = -off; x < W; x += 72) g.fillRect(Math.round(x), road + 10, 30, 2);
  g.fillStyle = rdShade(rc, -0.25); for (let x = 0; x < W; x += 3) if (rdHash(Math.floor((x + scroll) / 3)) > 0.8) g.fillRect(x, road + 4 + Math.floor(rdHash(Math.floor((x + scroll) / 3) + 9) * 18), 1, 1);
  // 大梁 + 轮子
  for (const s of wheels.spans) { g.fillStyle = RDC_PAL.dark[1]; g.fillRect(Math.round(s[0] * Q), fy + 15, Math.round((s[1] - s[0]) * Q), 7); g.fillStyle = RDC_PAL.dark[0]; g.fillRect(Math.round(s[0] * Q), fy + 15, Math.round((s[1] - s[0]) * Q), 1); }
  for (const wx of wheels.xs) rdcDrawWheel(g, Math.round(wx * Q), road - 11, 11, RDC_ANIM.ph);
  g.restore();
}

// ---------- 房间：贴缓存好的墙地 + 灯光 ----------
function rdiRoom(g, left, ceil, w, kind, floor, trailer, lit, night) {
  const key = rdiRoomKey(w, kind, floor, trailer, lit);
  if (!RDI_CACHE[key]) { RDI_CACHE[key] = rdiBuildRoom(w, kind, floor, trailer, lit); }
  const im = RDI_CACHE[key], Q = RD_Q, X = Math.round(left * Q), Y = Math.round(ceil * Q);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(im.cv, X - im.ox, Y - im.oy);
  // 晚上屋里暗一些，灯下一圈暖光
  if (night) { g.fillStyle = lit ? 'rgba(20,12,24,0.28)' : 'rgba(8,10,28,0.5)'; g.fillRect(X, Y, w * Q, 50 * Q); }
  if (lit) {
    g.globalAlpha = night ? 0.3 : 0.08;
    for (let k = 20 * Q; k < w * Q - 10 * Q; k += 40 * Q) {
      const cx = X + k + 9, gg = g.createRadialGradient(cx, Y + 10, 2, cx, Y + 10, 70);
      gg.addColorStop(0, '#ffe08a'); gg.addColorStop(1, 'rgba(255,224,138,0)');
      g.fillStyle = gg; g.fillRect(cx - 70, Y + 10, 140, 70);
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

// ---------- 窗户：窗框（焊的铁框 + 铆钉 + 铁丝网）+ 窗外风景 ----------
function rdiWindow(g, x, y, w, h, R, day, b, seed) {
  const Q = RD_Q, P = RDC_PAL, X = Math.round(x * Q), Y = Math.round(y * Q), Wd = w * Q, Ht = h * Q;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  // 窗框
  g.fillStyle = P.out; g.fillRect(X - 5, Y - 5, Wd + 10, Ht + 10);
  g.fillStyle = P.metal[2]; g.fillRect(X - 4, Y - 4, Wd + 8, Ht + 8);
  g.fillStyle = P.metal[1]; g.fillRect(X - 4, Y - 4, Wd + 8, 1); g.fillRect(X - 4, Y - 4, 1, Ht + 8);
  g.fillStyle = P.metal[3]; g.fillRect(X - 4, Y + Ht + 3, Wd + 8, 1); g.fillRect(X + Wd + 3, Y - 4, 1, Ht + 8);
  for (const [rx, ry] of [[X - 3, Y - 3], [X + Wd + 1, Y - 3], [X - 3, Y + Ht + 1], [X + Wd + 1, Y + Ht + 1]]) { g.fillStyle = P.metal[0]; g.fillRect(rx, ry, 1, 1); g.fillStyle = P.metal[3]; g.fillRect(rx + 1, ry + 1, 1, 1); }
  g.fillStyle = P.dark[2]; g.fillRect(X - 1, Y - 1, Wd + 2, Ht + 2); // 橡胶密封条
  g.beginPath(); g.rect(X, Y, Wd, Ht); g.clip();
  // 天空
  const sg = g.createLinearGradient(0, Y, 0, Y + Ht);
  sg.addColorStop(0, rdMix('#0b0d1c', b.sky[0], day)); sg.addColorStop(1, rdMix('#1f2346', b.sky[1], day));
  g.fillStyle = sg; g.fillRect(X, Y, Wd, Ht);
  if (day < 0.5) { g.fillStyle = '#f4f4f4'; for (let k = 0; k < 6; k++) g.fillRect(X + Math.floor(rdHash(k + seed * 7) * Wd), Y + Math.floor(rdHash(k + seed * 3 + 1) * Ht * 0.6), 1, 1); }
  // 远山、近处的东西（往后滚，越近越快）
  const sc = rdVehX() * Q;
  g.fillStyle = rdMix('#10121f', b.far, day);
  for (let k = 0; k < Wd; k++) { const hh = 10 + rdNoise((k + sc * 0.08 + seed * 97) / 26) * 18; g.fillRect(X + k, Y + Ht - hh, 1, hh); }
  g.fillStyle = rdMix('#10121f', b.mid, day);
  for (let k = 0; k < Wd; k++) { const n = rdHash(Math.floor((k + sc * 0.6 + seed * 111) / 14)); if (n > 0.62) g.fillRect(X + k, Y + Ht - 8 - Math.floor(n * 16), 1, 12 + Math.floor(n * 16)); }
  g.fillStyle = rdMix('#10121f', b.ground, day * 0.9); g.fillRect(X, Y + Ht - 5, Wd, 5);
  if (R.weather && R.weather.type === 'storm') { g.fillStyle = 'rgba(148,176,194,0.7)'; for (let k = 0; k < 8; k++) g.fillRect(X + Math.floor(rdHash(k + seed) * Wd), Y + ((G.time * 120 + k * 21) % Ht), 1, 5); }
  if (R.weather && R.weather.type === 'dust') { g.fillStyle = 'rgba(201,148,100,0.4)'; g.fillRect(X, Y, Wd, Ht); }
  // 玻璃反光（两道斜的亮条）
  g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let k = 0; k < Ht; k++) { g.fillRect(X + 6 + k, Y + Ht - 1 - k, 4, 1); g.fillRect(X + 14 + k, Y + Ht - 1 - k, 1, 1); }
  g.globalAlpha = 1;
  // 铁丝网
  g.fillStyle = P.metal[3]; g.globalAlpha = 0.85;
  for (let k = 3; k < Wd; k += 6) g.fillRect(X + k, Y, 1, Ht);
  for (let k = 3; k < Ht; k += 6) g.fillRect(X, Y + k, Wd, 1);
  g.globalAlpha = 1;
  g.restore();
}
// 窗帘：布料竖褶（亮暗相间）+ 窗帘杆
function rdiCurtain(g, x, y, w, h) {
  const Q = RD_Q, X = Math.round(x * Q), Y = Math.round(y * Q);
  const C = ['#e86a6a', '#c84a50', '#9c3240', '#6e2230'];
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = RDC_PAL.metal[2]; g.fillRect(X - 3, Y - 3, w * Q + 6, 2);
  for (const side of [0, 1]) {
    const cx = side ? X + w * Q - 9 : X;
    for (let k = 0; k < 9; k++) { g.fillStyle = C[[1, 0, 1, 2, 3, 2, 1, 0, 2][k]]; g.fillRect(cx + k, Y - 1, 1, h * Q + 2 - (k % 3)); }
    g.fillStyle = RDC_PAL.out; g.fillRect(cx - 1, Y - 1, 1, h * Q + 2); g.fillRect(cx + 9, Y - 1, 1, h * Q + 2);
    g.fillStyle = '#ffcd75'; g.fillRect(cx + 1, Y + Math.round(h * Q * 0.55), 7, 2); // 绑带
  }
  g.restore();
}

// ---------- 驾驶室（平头货车，从侧面剖开） ----------
function rdiCab(g, left, floorY, ceil, w, R, day, b) {
  const Q = RD_Q, P = RDC_PAL, X = Math.round(left * Q), FW = w * Q, top = (ceil + 6) * Q, fy = floorY * Q;
  const key = 'cab' + w;
  if (!RDI_CACHE[key]) RDI_CACHE[key] = rdiBuildCab(w);
  const im = RDI_CACHE[key];
  // 前窗外的风景（先画，驾驶室图里窗户是空的）
  rdiWindow(g, left + 12, ceil + 8, w - 13, 16, R, day, b, 99);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(im.cv, X - im.ox, top - im.oy);
  // 仪表：开车时亮绿灯，指针跟车速
  const dy = top + (20 * Q);
  g.fillStyle = R.speedNow > 1 ? '#a7f070' : P.metal[3]; g.fillRect(X + 15 * Q, dy + 5, 3, 2);
  g.fillStyle = '#ffcd75'; g.fillRect(X + 15 * Q + 6, dy + 5, 2, 2);
  const ang = -2.4 + Math.min(1, (R.speedNow || 0) / 120) * 2.2, gx = X + 19 * Q + 4, gy2 = dy + 6;
  g.fillStyle = '#ef7d57'; for (let k = 1; k < 4; k++) g.fillRect(Math.round(gx + Math.cos(ang) * k), Math.round(gy2 + Math.sin(ang) * k), 1, 1);
  if (R.driving && rdStats().autopilot) { g.fillStyle = '#73eff7'; g.fillRect(X + 26 * Q, dy + 3, 8, 5); }
  // 后视镜下挂的小香片，随车晃
  const sw = Math.round(Math.sin(G.time * (R.speedNow > 1 ? 7 : 2)) * (R.speedNow > 1 ? 2 : 1));
  const hx = X + (w - 6) * Q, hy = (ceil + 8) * Q;
  g.fillStyle = P.metal[3]; g.fillRect(hx, hy, 1, 5);
  g.fillStyle = '#38b764'; g.fillRect(hx - 2 + sw, hy + 5, 5, 2); g.fillRect(hx - 1 + sw, hy + 3, 3, 2); g.fillRect(hx - 3 + sw, hy + 7, 7, 2);
  g.fillStyle = '#a7f070'; g.fillRect(hx - 1 + sw, hy + 4, 1, 1);
  g.restore();
}
function rdiBuildCab(w) {
  const Q = RD_Q, P = RDC_PAL, C = P.cream, M = P.metal, D = P.dark, FW = w * Q, FH = 44 * Q; // 驾驶室：顶在 y = 0，地面在 y = FH
  const B = rdcPaper(FW + 24, FH + 40, 10, 13);
  // 外壳：顶 + 前脸（微后倾）
  rdcPoly(B, [[-1, -12], [FW - 4, -12], [FW + 6, -6], [FW + 8, FH + 16], [-1, FH + 16], [-1, -1]], C, 1, 0, 1);
  // 内饰：暗色顶棚、门板（深灰褐，有缝线）
  rdcBox(B, 0, -3, FW, FH + 3, ['#6a5a4e', '#56483e', '#463a32', '#382e28'], 1, 0, 1);
  for (let x = 4; x < FW; x += 8) for (let y = 30; y < FH - 10; y += 2) if (rdcHash(x, y, 2) < 0.6) rdcPix(B, x, y, '#3c322a', 1);
  rdcRect(B, 0, 26, FW, 1, '#2e2620', 6); rdcRect(B, 0, 27, FW, 1, '#7a685a', 1);
  // 侧窗洞（风景另外画，透出来）
  for (let y = 4 * Q - 2; y < 20 * Q; y++) for (let x = 12 * Q; x < (w - 1) * Q; x++) B.c[(y + B.oy) * B.w + x + B.ox] = -1;
  // A 柱
  rdcPoly(B, [[(w - 1) * Q, -3], [FW + 6, -3], [FW + 7, 20 * Q], [(w - 1) * Q, 20 * Q]], C, 1, 0, 1);
  // 仪表台
  rdcBox(B, 10 * Q, 20 * Q, FW - 10 * Q + 6, 6 * Q, [D[0], D[1], D[2]], 6);
  rdcRect(B, 10 * Q, 20 * Q, FW - 10 * Q + 6, 1, '#6a5a4e', 1);
  rdcBox(B, 14 * Q, 20 * Q + 2, 9 * Q, 10, ['#241a14', '#1a1410'], 6); // 仪表盘框
  rdcRect(B, 19 * Q, 20 * Q + 4, 8, 6, '#2c4a3a', 4);
  // 方向盘（斜着的圆环）+ 转向柱
  const sx = 22 * Q, sy = 24 * Q;
  for (let a = 0; a < 6.28; a += 0.05) { const px = Math.round(sx + Math.cos(a) * 4), py = Math.round(sy + Math.sin(a) * 12); rdcPix(B, px, py, a > 3.6 && a < 5.8 ? '#5a4a40' : '#241a14', 6); rdcPix(B, px + 1, py, '#3a2e26', 6); }
  rdcLine(B, sx + 1, sy, sx + 12, sy + 10, D[1], 6); rdcLine(B, sx + 1, sy + 1, sx + 12, sy + 11, D[0], 6);
  // 座椅：靠背（有缝线的布面）+ 坐垫 + 头枕
  rdcBox(B, 5 * Q, FH - 24 * Q, 4 * Q, 13 * Q, ['#8a5a3a', '#74482c', '#5c3820', '#442816'], 1, 0, 1);
  for (let y = FH - 22 * Q; y < FH - 12 * Q; y += 5) rdcRect(B, 5 * Q + 2, y, 4 * Q - 4, 1, '#442816', 6);
  rdcBox(B, 5 * Q + 1, FH - 28 * Q, 3 * Q, 4 * Q, ['#8a5a3a', '#5c3820'], 1);
  rdcBox(B, 5 * Q, FH - 13 * Q, 12 * Q, 3 * Q, ['#9a6a48', '#74482c', '#5c3820'], 1, 0, 1);
  rdcBox(B, 8 * Q, FH - 10 * Q, 6 * Q, 10 * Q, [M[2], M[3], D[0]], 2); // 座椅底座
  // 换挡杆
  rdcLine(B, 17 * Q, FH - 2, 19 * Q, FH - 9 * Q, M[3], 2); rdcBox(B, 19 * Q - 2, FH - 9 * Q - 4, 5, 5, ['#3a2e26', '#241a14'], 6);
  // 脚垫 + 地板
  rdcBox(B, 0, FH, FW + 8, 4, ['#3a3a3a', '#2a2a2a'], 6);
  rdcBox(B, 0, FH + 4, FW + 8, 8, [D[0], D[1], D[2]], 6);
  // 驾驶室和货厢之间的隔断（留一个过道）
  rdcBox(B, -1, -3, 4, FH - 18 * Q + 3, [M[1], M[2], M[3]], 2);
  rdcBox(B, -1, FH - 18 * Q, 4, 2, [M[0], M[2]], 2);
  // 前保险杠 + 大灯（在前脸下面）
  rdcBox(B, FW + 2, FH, 8, 8, [M[1], M[2], M[3]], 2);
  rdcBox(B, FW + 5, FH - 9, 3, 6, [P.light[0], P.light[1], P.light[2]], 4);
  rdcWeatherShell(B, FW, FH);
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 挂车连接处：拖杆 + 防尘折叠棚
function rdiHitch(g, x, floorY, ceil) {
  const Q = RD_Q, P = RDC_PAL, X = Math.round(x * Q), fy = floorY * Q;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = P.out; g.fillRect(X - 31, fy + 8, 32, 8);
  g.fillStyle = P.metal[2]; g.fillRect(X - 30, fy + 9, 30, 6); g.fillStyle = P.metal[1]; g.fillRect(X - 30, fy + 9, 30, 1);
  g.fillStyle = P.metal[3]; g.fillRect(X - 16, fy + 6, 4, 12);
  // 折叠风琴棚（人从这里走到挂车）
  const top = (ceil + 10) * Q;
  for (let k = 0; k < 30; k++) { g.fillStyle = k % 6 < 3 ? '#4a3e34' : '#2e2620'; g.fillRect(X - 30 + k, top, 1, fy - top); }
  g.fillStyle = P.out; g.fillRect(X - 31, top - 1, 32, 1);
  g.restore();
}

// ---------- 自动精细化：把用世界像素画的东西放大 3 倍，圆滑斜边、加明暗、深褐描边 ----------
const RDI_FINE = { cv: null, g: null, cache: new Map() };
// x, y：锚点（世界像素）；box：[x0, y0, w, h] 相对锚点的范围；draw(gg, ax, ay) 在小画布上以 (ax, ay) 为锚点画
function rdiFine(g, x, y, box, draw) {
  const Q = RD_Q, [x0, y0, bw, bh] = box, sw = bw + 2, sh = bh + 2;
  x = Math.round(x); y = Math.round(y);
  if (!RDI_FINE.cv || RDI_FINE.cv.width < sw || RDI_FINE.cv.height < sh) { RDI_FINE.cv = createCanvas(Math.max(sw, 80), Math.max(sh, 64)); RDI_FINE.g = RDI_FINE.cv.getContext('2d'); }
  const sg = RDI_FINE.g;
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1; sg.clearRect(0, 0, sw, sh); sg.imageSmoothingEnabled = false;
  draw(sg, 1 - x0, 1 - y0);
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalAlpha = 1;
  const src = sg.getImageData(0, 0, sw, sh), u = new Uint32Array(src.data.buffer);
  // 画面一样就直接用上次算好的
  let h = 2166136261 ^ sw ^ (sh << 12);
  for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); }
  let out = RDI_FINE.cache.get(h);
  if (!out) {
    out = rdiUpscale(u, sw, sh);
    if (RDI_FINE.cache.size > 400) RDI_FINE.cache.clear();
    RDI_FINE.cache.set(h, out);
  }
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(out, (x + x0 - 1) * Q, (y + y0 - 1) * Q);
  g.restore();
}
function rdiUpscale(u, sw, sh) {
  const Q = 3, W = sw * Q, H = sh * Q, o = new Uint32Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= sw || y >= sh) ? 0 : u[y * sw + x];
  // Scale3x：斜边变圆滑
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const E = u[y * sw + x], A = at(x - 1, y - 1), Bq = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), F = at(x + 1, y), Gq = at(x - 1, y + 1), Hq = at(x, y + 1), I = at(x + 1, y + 1);
    let e = [E, E, E, E, E, E, E, E, E];
    if (Bq !== Hq && D !== F) {
      e[0] = D === Bq ? D : E;
      e[1] = (D === Bq && E !== C) || (Bq === F && E !== A) ? Bq : E;
      e[2] = Bq === F ? F : E;
      e[3] = (D === Bq && E !== Gq) || (D === Hq && E !== A) ? D : E;
      e[5] = (Bq === F && E !== I) || (Hq === F && E !== C) ? F : E;
      e[6] = D === Hq ? D : E;
      e[7] = (D === Hq && E !== I) || (Hq === F && E !== Gq) ? Hq : E;
      e[8] = Hq === F ? F : E;
    }
    for (let k = 0; k < 9; k++) o[(y * Q + ((k / 3) | 0)) * W + x * Q + (k % 3)] = e[k];
  }
  // 明暗：每块颜色的顶边亮、底边两行暗、右边稍暗（像素是 ABGR 存的）
  const solid = (v) => (v >>> 24) >= 200;
  const mixTo = (v, r, g2, b, k) => { const vr = v & 255, vg = (v >> 8) & 255, vb = (v >> 16) & 255; return ((255 << 24) | (Math.round(vb + (b - vb) * k) << 16) | (Math.round(vg + (g2 - vg) * k) << 8) | Math.round(vr + (r - vr) * k)) >>> 0; };
  const res = o.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = o[i];
    if (!solid(v)) continue;
    const lum = ((v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255)) / 3;
    if (lum < 40) continue; // 很暗的小细节（眼睛、缝）不加光影
    const up = y > 0 ? o[i - W] : 0, dn = y < H - 1 ? o[i + W] : 0, dn2 = y < H - 2 ? o[i + 2 * W] : 0, rt = x < W - 1 ? o[i + 1] : 0, lf = x > 0 ? o[i - 1] : 0;
    let nv = v;
    if (up !== v) nv = mixTo(v, 255, 244, 220, 0.24);
    else if (dn !== v) nv = mixTo(v, 36, 22, 15, 0.28);
    else if (dn2 !== v) nv = mixTo(v, 36, 22, 15, 0.12);
    else if (rt !== v) nv = mixTo(v, 36, 22, 15, 0.12);
    else if (lf !== v) nv = mixTo(v, 255, 244, 220, 0.08);
    if (((x * 7 + y * 13) % 29) === 0 && lum > 60) nv = mixTo(nv, 36, 22, 15, 0.12); // 零散的脏点
    res[i] = nv;
  }
  // 深褐描边（朝上的边用浅褐）
  const O1 = (255 << 24 | 0x0f << 16 | 0x16 << 8 | 0x24) >>> 0, O2 = (255 << 24 | 0x26 << 16 | 0x3b << 8 | 0x5c) >>> 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (o[i] >>> 24) continue;
    const dn = y < H - 1 && solid(o[i + W]), up = y > 0 && solid(o[i - W]), sd = (x > 0 && solid(o[i - 1])) || (x < W - 1 && solid(o[i + 1]));
    if (dn || up || sd) res[i] = dn && !up && !sd ? O2 : O1;
  }
  const cv = createCanvas(W, H), cg = cv.getContext('2d'), im = cg.createImageData(W, H);
  new Uint32Array(im.data.buffer).set(res); cg.putImageData(im, 0, 0);
  return cv;
}
