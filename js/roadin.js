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
  foam: ['#a89880', '#8a7a64', '#6a5c4a'],             // 保温层（旧了发灰的玻璃棉）
  steel: ['#9a8e7e', '#7e7264', '#665a4e', '#4c433a', '#352e28'], // 车厢内壁铁皮（暖灰、旧）
  ply: ['#b08a5e', '#97734c', '#7c5c3c', '#5e4430', '#45311f'],   // 胶合板（旧、发暗）
  paper: ['#c8b48e', '#b09c78', '#968260', '#7a684c'],             // 墙纸（褪色）
  plate: ['#968e80', '#787064', '#5c564c', '#403a34'],             // 花纹钢板地面
  wood: ['#a87a4c', '#8a603a', '#6c4a2c', '#4c321e'],              // 木地板
};

// ---------- 车厢房间（缓存成图片） ----------
// w：房间宽（世界像素）；kind：'steel' | 'ply' | 'paper'；floor：'plate' | 'wood'；skin：外壳车漆颜色（ramp）
function rdiRoomKey(w, kind, floor, trailer, lit) { return [w, kind, floor, trailer ? (G.road.ext.trailer || 1) : 0, lit ? 1 : 0, rdiVeh()].join('|'); }
// 当前车型（车内外壳颜色、车型专属的内部细节跟着它变）
function rdiVeh() { return (G.road && G.road.veh) || 'courier'; }
function rdiSkin() { const v = rdiVeh(); return v === 'garbage' ? RDC_PAL.olive : v === 'pickup' ? RDC_PAL.brick : v === 'icecream' ? RDC_PAL.rose : RDC_PAL.cream; }
// 冰淇淋车车厢：墙下半截是粉 / 薄荷竖条纹的护墙板 + 镀铬扶手条
function rdiIceRoom(B, FW, FH) {
  const P = RDC_PAL, Q = RD_Q, top = FH - 15 * Q;
  for (let y = top; y < FH; y++) for (let x = 0; x < FW; x++) {
    const s = x % 18, ramp = s < 9 ? P.rose : P.mint, t = 0.25 + (y - top) / (FH - top) * 0.5 + (s === 0 || s === 9 ? 0.3 : 0);
    rdcPix(B, x, y, rdcRampAt(ramp, Math.max(0, Math.min(1, t)), x, y), 1);
  }
  rdcBox(B, 0, top - 4, FW, 4, [P.metal[0], P.metal[0], P.metal[1], P.metal[2]], 2);
  for (let x = 6; x < FW; x += 40) rdcRivet(B, x, top - 3);
}
// 冰淇淋车地板：褪色的黑白格地砖
function rdiIceFloor(B, FW, FH) {
  for (let y = FH; y < FH + 4; y++) for (let x = 0; x < FW; x++) {
    const c = ((Math.floor((x + (y - FH) * 2) / 8)) & 1) ? ['#d8ccb4', '#c4b89e', '#b0a488', '#9a8e74'] : ['#4a403a', '#3c332e', '#30282a', '#262022'];
    rdcPix(B, x, y, c[y - FH], 1);
  }
}
// 车厢顶上的小甜筒（车外那个大甜筒的剖面图版本）
function rdiIceCone(B, x) {
  const Wf = RDC_PAL.waffle;
  rdcPoly(B, [[x - 6, -24], [x + 6, -24], [x + 1, -13], [x - 1, -13]], Wf, 1, 0, 1);
  for (let y = -24; y < -13; y++) for (let xx = x - 6; xx <= x + 6; xx++) if (rdcMat(B, xx, y) === 1 && ((xx + y) % 4 + 4) % 4 === 0) rdcPix(B, xx, y, Wf[3], 1);
  for (let y = -32; y <= -22; y++) for (let xx = x - 7; xx <= x + 7; xx++) { const d = Math.hypot(xx - x, (y + 27) * 1.2); if (d <= 7) rdcPix(B, xx, y, d < 3 ? '#f8d8d4' : d < 5.5 ? '#eab4b4' : '#cc8c90', 1); }
  rdcBox(B, x - 1, -36, 3, 3, ['#e05050', '#7a1a1a'], 4);
}
// 皮卡车厢（后斗上加了个罩子）：下半截是后斗内壁（砖红铁皮、横向加强棱、围栏包边、绑货孔）+ 后轮的轮包鼓起来
function rdiPickupRoom(B, FW, FH) {
  const P = RDC_PAL, K = P.brick, M = P.metal, Q = RD_Q, top = FH - RDI_RAIL * Q;
  for (let y = top; y < FH; y++) for (let x = 0; x < FW; x++) {
    let t = 0.2 + (y - top) / (FH - top) * 0.6; const m = (y - top) % 9;
    if (m === 3) t -= 0.25; else if (m === 4) t += 0.3;
    rdcPix(B, x, y, rdcRampAt(K, Math.max(0, Math.min(1, t)), x, y), 1);
  }
  rdcBox(B, 0, top - 4, FW, 5, [M[0], M[1], M[2], M[3]], 2);
  for (let x = 10; x < FW - 6; x += 30) rdcRect(B, x, top - 3, 5, 2, P.dark[2], 6);
  const wx = Math.min(28 * Q, FW / 2), r = 12 * Q;
  for (let y = FH - r; y < FH; y++) for (let x = wx - r; x <= wx + r; x++) {
    const d = Math.hypot(x - wx, y - FH); if (d > r) continue;
    rdcPix(B, x, y, d > r - 2 ? K[0] : d > r - 4 ? K[1] : rdcRampAt([K[2], K[3], K[4]], 1 - d / r * 0.8, x, y), 1);
  }
}
// 垃圾车车厢（压缩厢内部）：每格之间一根粗加强筋（和车外一致）、尾门那头刷警示斜纹 + 铰链、地上有排污格栅
function rdiGarbageRoom(B, FW, FH) {
  const P = RDC_PAL, M = P.metal, Hz = P.hazard, Q = RD_Q;
  for (let x = RD_CELL * Q - 2; x < FW - 6; x += RD_CELL * Q) {
    for (let y = 6; y < FH; y++) { rdcPix(B, x, y, M[1], 2); rdcPix(B, x + 1, y, M[2], 2); rdcPix(B, x + 2, y, M[2], 2); rdcPix(B, x + 3, y, M[3], 2); rdcPix(B, x + 4, y, RDC_PAL.dark[1], 6); }
    for (let y = 14; y < FH - 4; y += 22) rdcRivet(B, x + 1, y);
  }
  // 尾门（左边）：竖着一条警示斜纹 + 两个大铰链
  for (let y = 6; y < FH; y++) for (let x = 0; x < 9; x++) rdcPix(B, x, y, (((x + y) % 10) + 10) % 10 < 5 ? Hz[1] : Hz[2], 7);
  rdcRect(B, 9, 6, 1, FH - 6, RDC_PAL.dark[2], 6);
  for (const y of [16, FH - 30]) { rdcBox(B, 2, y, 11, 8, [M[0], M[1], M[2], M[3]], 2); rdcRivet(B, 4, y + 3); rdcRivet(B, 9, y + 3); }
}
function rdiGarbageFloor(B, FW, FH) {
  const M = RDC_PAL.metal, D = RDC_PAL.dark;
  for (let gx = 40; gx < FW - 30; gx += 160) { rdcRect(B, gx, FH + 1, 22, 3, D[2], 6); for (let x = gx + 1; x < gx + 22; x += 3) rdcRect(B, x, FH + 1, 1, 3, M[2], 2); }
}
// 皮卡后斗是敞开的（和车外一样）：斗壁高 RDI_RAIL 格，上面是天空 + 防滚架延伸出来的货架（墙面家具挂在架子上）
const RDI_RAIL = 26;
function rdiOpenTop(trailer) { return !trailer && rdiVeh() === 'pickup'; }
function rdiPickupOpen(B, FW, FH) {
  const P = RDC_PAL, M = P.metal, K = P.brick, Q = RD_Q, rail = FH - RDI_RAIL * Q - 4;
  for (let y = -B.oy; y < rail; y++) for (let x = -B.ox; x < B.w - B.ox; x++) B.c[(y + B.oy) * B.w + x + B.ox] = -1; // 斗壁以上全部挖空
  for (const sx of [-9, FW]) { rdcBox(B, sx, rail, 9, 5, [M[0], M[1], M[2], M[3]], 2); rdcBox(B, sx, rail + 5, 9, 10, K, 1, 0, 1); } // 前后斗壁的顶边
  // 货架：两头立柱 + 顶上一根横管 + 每格一根细竖管（挂东西）
  const pipe = (x, y, w, h) => rdcBox(B, x, y, w, h, [M[0], M[1], M[2], M[3]], 2);
  for (const px of [-7, FW + 2]) pipe(px, -12, 5, rail + 12);
  pipe(-9, -12, FW + 18, 5);
  for (let x = RD_CELL * Q; x < FW - 6; x += RD_CELL * Q) { rdcRect(B, x - 1, -7, 2, 10, M[2], 2); rdcRivet(B, x - 1, -9); }
  for (const px of [-7, FW + 2]) for (const y of [-11, rail - 6]) rdcRivet(B, px + 1, y);
}
// 垃圾车压缩厢尾部：车外那个往上鼓、后面圆角的料斗，剖面图里也画出来
function rdiGarbageHopper(B, FW, skin) {
  const Q = RD_Q, hw = Math.min(Math.round(FW * 0.3), 36 * Q), M = RDC_PAL.metal;
  const pts = [[-9, -11], [-9, -18]];
  for (let a = 0; a <= 8; a++) { const t = Math.PI - a / 8 * Math.PI / 2; pts.push([Math.round(-9 + 12 + Math.cos(t) * 12), Math.round(-18 - 12 + 12 - Math.sin(t) * 12)]); } // 圆角
  pts.push([hw, -30], [hw + 14, -11]);
  rdcPoly(B, pts, skin, 1, 0, 1);
  rdcRect(B, -9, -12, hw + 22, 1, RDC_PAL.dark[2], 6);
  for (let x = 4; x < hw; x += 14) rdcRivet(B, x, -26);
  rdcBox(B, hw - 8, -36, 6, 6, [M[1], M[2], M[3]], 2); // 液压缸顶
}
function rdiBuildRoom(w, kind, floor, trailer, lit) {
  const Q = RD_Q, P = RDC_PAL, IP = RDI_PAL;
  const FW = w * Q, FH = 50 * Q; // 房间内部：宽 FW，高 FH（天花板 y = 0，地面 y = FH）
  const ice = !trailer && rdiVeh() === 'icecream', garbage = !trailer && rdiVeh() === 'garbage', pickup = !trailer && rdiVeh() === 'pickup';
  const extra = ice ? 26 : garbage ? 26 : 0;
  const B = rdcPaper(FW + 20, FH + 36 + extra, 10, 13 + extra);
  const skin = trailer ? rdpTrailerSkin() : rdiSkin();
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
  if (garbage) rdiGarbageHopper(B, FW, skin);
  // —— 后墙
  const RAMP = kind === 'ply' ? IP.ply : kind === 'paper' ? IP.paper : IP.steel;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let t = 0.15 + (y / FH) * 0.55; // 上亮下暗
    if (kind === 'steel') { const m = x % 6; t += m === 0 ? -0.2 : m === 4 ? 0.18 : m === 5 ? 0.3 : 0; } // 竖向瓦楞
    if (kind === 'ply') { const n = rdcNoise2(x / 14, y / 2.2, 3 + Math.floor(x / 78)); t += (n - 0.5) * 0.35; } // 木纹
    if (kind === 'paper') { const px = x % 12, py = y % 12; if ((Math.abs(px - 6) + Math.abs(py - 6)) === 4 && ((x + y) & 1)) t += 0.25; } // 褪色的菱形花纹
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
    for (let x = 3; x < FW - 3; x += 6) rdcRect(B, x, ty + 1, 3, 3, RDC_PAL.dark[2], 6);
    for (let k = 0; k < FW / 9; k++) { const x = Math.floor(rdcHash(k, 1, 8) * FW), y0 = Math.floor(rdcHash(k, 2, 8) * FH * 0.7), len = 3 + Math.floor(rdcHash(k, 3, 8) * 10); for (let j = 0; j < len; j++) if (rdcMat(B, x, y0 + j) === 1) rdcPix(B, x, y0 + j, j < 2 ? P.rust[1] : P.rust[2], 1); }
  }
  if (garbage) rdiGarbageRoom(B, FW, FH);
  if (pickup) rdiPickupRoom(B, FW, FH);
  if (ice) rdiIceRoom(B, FW, FH);
  if (trailer) rdpTrailerRoom(B, FW, FH); // 挂车车内按种类换花样（js/roadparts.js）
  rdiGrime(B, FW, FH, kind);
  // —— 天花板：暗色顶棚 + 横梁 + 灯具
  rdcBox(B, 0, 0, FW, 6, [RDC_PAL.dark[0], RDC_PAL.dark[1], RDC_PAL.dark[2]], 6);
  for (let x = 6; x < FW; x += 39) rdcBox(B, x, 0, 4, 7, [P.metal[2], P.metal[3]], 2);
  for (let k = 20 * Q; k < FW - 10 * Q; k += 40 * Q) {
    rdcBox(B, k, 6, 18, 3, [P.metal[1], P.metal[2]], 2);
    rdcRect(B, k + 1, 9, 16, 1, lit ? '#f0e2b8' : P.metal[3], 4); rdcRect(B, k + 2, 10, 14, 1, lit ? '#c8b088' : P.metal[3], 4);
  }
  // —— 地板：表面 + 厚度（看得见的切面）
  const F = floor === 'wood' ? IP.wood : IP.plate;
  for (let x = 0; x < FW; x++) for (let y = FH; y < FH + 4; y++) {
    let t = (y - FH) / 4 * 0.5;
    if (floor === 'wood') { if (x % 27 === 0) t = 0.95; else t += (rdcNoise2(x / 9, y, 4) - 0.5) * 0.4; }
    else { const px = (x + (y - FH) * 2) % 8; if (px === 0 || px === 1) t -= 0.3; if (px === 2) t += 0.35; } // 花纹钢板的凸起
    rdcPix(B, x, y, rdcRampAt(F, Math.max(0, Math.min(1, t)), x, y), floor === 'wood' ? 1 : 2);
  }
  if (garbage && floor !== 'wood') rdiGarbageFloor(B, FW, FH);
  if (ice && floor !== 'wood') rdiIceFloor(B, FW, FH);
  rdcBox(B, -9, FH + 4, FW + 18, 8, [RDC_PAL.dark[0], RDC_PAL.dark[1], RDC_PAL.dark[2]], 6);
  for (let x = 4; x < FW; x += 26) rdcRivet(B, x, FH + 7);
  rdcBox(B, -9, FH + 12, FW + 18, 4, skin, 1);
  // 外壳做旧（只锈外壳，不锈墙）
  rdiWeatherShell(B, FW, FH);
  if (ice) rdiIceCone(B, Math.round(FW * 0.4));
  if (pickup) rdiPickupOpen(B, FW, FH);
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 墙面做旧：大片水渍/污渍（边缘一圈深色）、墙角积灰、墙纸剥落露出底下的木板、零散划痕
function rdiGrime(B, FW, FH, kind) {
  const mix = (c, h, k) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, t = rdcHex(h), tr = (t >> 16) & 255, tg = (t >> 8) & 255, tb = t & 255; return (Math.round(r + (tr - r) * k) << 16) | (Math.round(g + (tg - g) * k) << 8) | Math.round(b + (tb - b) * k); };
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const i = (y + B.oy) * B.w + x + B.ox; if (B.m[i] !== 1 || B.c[i] < 0) continue;
    let c = B.c[i];
    const n = rdcNoise2(x / 22, y / 16, 41) * 0.7 + rdcNoise2(x / 6, y / 6, 42) * 0.3;
    if (n > 0.66) c = mix(c, '#3a2a1c', Math.min(0.22, (n - 0.66) * 1.2));     // 污渍
    if (n > 0.71 && n < 0.73) c = mix(c, '#2a1c12', 0.25);                    // 水渍的边
    const low = y / FH; if (low > 0.7) c = mix(c, '#2e2218', (low - 0.7) * 0.9); // 墙根积灰
    if (y < 14) c = mix(c, '#1e140e', (14 - y) / 14 * 0.35);                  // 顶棚下的阴影
    if (kind === 'paper') {                                                   // 墙纸剥落
      const pe = rdcNoise2(x / 9, y / 7, 43);
      if (pe > 0.86) c = rdcHex(rdcRampAt(RDI_PAL.ply, 0.55 + rdcHash(x, y, 44) * 0.3, x, y));
      else if (pe > 0.84) c = mix(c, '#efe0c0', 0.35);                         // 翘起来的纸边
    }
    if (rdcHash(x, y, 45) < 0.004) { for (let k = 0; k < 4; k++) { const j = i + k * (B.w + 1); if (B.m[j] === 1) B.c[j] = mix(B.c[j], '#d8c8a8', 0.25); } } // 划痕
    B.c[i] = c;
  }
}
// 整个车内：暖色调 + 四周暗角（让画面统一、不那么「干净」）
function rdiGradeScreen(g, vw, vh) {
  const Q = RD_Q, W = vw * Q, H = vh * Q;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = '#ecd8bc'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  const r = Math.max(W, H) * 0.75, gr = g.createRadialGradient(W / 2, H * 0.55, r * 0.35, W / 2, H * 0.55, r);
  gr.addColorStop(0, 'rgba(20,12,8,0)'); gr.addColorStop(1, 'rgba(20,12,8,0.45)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.restore();
}
// 外壳切面上的锈和泥点
function rdiWeatherShell(B, FW, FH) {
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
  // 路面（往后滚）：离地板的距离 = 车外车厢底到地面的距离（同样放大，见 rdiWheelLayout）
  const road = fy + wheels.gap * Q, hz = road - 6 * Q, gr = rdMix('#10121f', b.ground, day * 0.8), rc = rdMix('#10121f', b.road, day * 0.85);
  for (let x = 0; x < W; x += 2) { const hh = (14 + rdNoise((x + scroll * 0.05) / 110) * 40 + rdNoise((x + scroll * 0.05) / 37) * 12); g.fillRect(x, hz - hh, 2, hh); }
  g.fillStyle = sg; g.fillRect(0, fy + Q * 12, W, Math.max(0, hz - fy - Q * 12));
  g.fillStyle = gr; g.fillRect(0, hz, W, H);
  g.fillStyle = rc; g.fillRect(0, road - 4, W, 30);
  g.fillStyle = rdShade(rc, 0.12); g.fillRect(0, road - 4, W, 1);
  g.fillStyle = rdMix('#10121f', b.snow ? '#94b0c2' : '#c9a86a', day * 0.9);
  const off = ((scroll % 72) + 72) % 72;
  for (let x = -off; x < W; x += 72) g.fillRect(Math.round(x), road + 10, 30, 2);
  g.fillStyle = rdShade(rc, -0.25); for (let x = 0; x < W; x += 3) if (rdHash(Math.floor((x + scroll) / 3)) > 0.8) g.fillRect(x, road + 4 + Math.floor(rdHash(Math.floor((x + scroll) / 3) + 9) * 18), 1, 1);
  // 大梁（纵梁 + 横梁头）+ 轮子（照车外比例放大）
  const D = RDC_PAL.dark, r = wheels.r;
  for (const s of wheels.spans) {
    const X0 = Math.round(s[0] * Q), X1 = Math.round(s[1] * Q), by = fy + 3 * Q;
    for (let x = X0 + 10; x < X1 - 6; x += 14 * Q) { g.fillStyle = D[2]; g.fillRect(x, fy, 5, 3 * Q); }
    g.fillStyle = D[1]; g.fillRect(X0, by, X1 - X0, 3 * Q); g.fillStyle = D[0]; g.fillRect(X0, by, X1 - X0, 2); g.fillStyle = D[2]; g.fillRect(X0, by + 3 * Q - 2, X1 - X0, 2);
  }
  for (const wx of wheels.xs) {
    const cx = Math.round(wx * Q), cy = road - r;
    g.fillStyle = 'rgba(20,12,8,0.35)'; g.fillRect(cx - r, road - 2, r * 2, 4);
    rdcDrawWheel(g, cx, cy, r, RDC_ANIM.ph);
  }
  g.restore();
}
// 车内剖面的轮子：车外的车有几个轮子、在车身前后什么位置、多大，车内就照比例放大（车头 = 驾驶室右边）
// 返回 { xs: 轮心 x（世界像素）, r: 轮半径（精细像素）, gap: 地板到路面的距离（世界像素）, spans: 大梁范围 }
function rdiWheelLayout(lay, ox, camp) {
  const R = G.road, Q = RD_Q, cf = RDC_CARS[R.veh], wh = { xs: [], spans: [], r: 11 * Q, gap: 12 };
  let xx = ox - lay.cab, s = 3;
  lay.rooms.forEach((r, i) => {
    if (i > 0) xx -= lay.gap;
    const left = xx - r.w;
    if (i === 0 && !r.camp && cf) { // 主车：车头到车厢尾巴
      const L = lay.cab + r.w; s = L * Q / cf.len;
      wh.r = Math.round(cf.r * Math.min(s, 3)); // 车厢高度只放大了约 3 倍，轮子跟着高度走，不然显得太大
      for (const wx of cf.wheels) wh.xs.push(ox + wx * s / Q);
      wh.spans.push([ox - L + 3, ox - 3]);
    } else if (!r.camp) { // 挂车：一根轴（长挂车两根），靠后
      const rr = wh.r / Q; wh.xs.push(left + rr * 1.6); if (r.w > 120) wh.xs.push(left + rr * 4);
      wh.spans.push([left + 3, xx - 3]);
    }
    xx = left;
  });
  if (wh.xs.length) wh.gap = Math.ceil(wh.r * 1.72 / Q); // 轮子顶上一小截藏在车厢地板后面（像车外的轮拱）
  return wh;
}

// ---------- 房间：贴缓存好的墙地 + 灯光 ----------
function rdiRoom(g, left, ceil, w, kind, floor, trailer, lit, night) {
  const key = rdiRoomKey(w, kind, floor, trailer, lit);
  if (!RDI_CACHE[key]) { RDI_CACHE[key] = rdiBuildRoom(w, kind, floor, trailer, lit); }
  const im = RDI_CACHE[key], Q = RD_Q, X = Math.round(left * Q), Y = Math.round(ceil * Q);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(im.cv, X - im.ox, Y - im.oy);
  // 晚上屋里暗一些，灯下一圈暖光
  const open = rdiOpenTop(trailer), oy = open ? (50 - RDI_RAIL) * Q : 0; // 敞开的皮卡后斗：只有斗壁以下才算「屋里」
  if (night) { g.fillStyle = lit ? 'rgba(20,12,24,0.28)' : 'rgba(8,10,28,0.5)'; g.fillRect(X, Y + oy, w * Q, 50 * Q - oy); }
  if (lit && !open) {
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
  const C = ['#a8604c', '#8a4a3a', '#6c382c', '#4e261e'];
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = RDC_PAL.metal[2]; g.fillRect(X - 3, Y - 3, w * Q + 6, 2);
  for (const side of [0, 1]) {
    const cx = side ? X + w * Q - 9 : X;
    for (let k = 0; k < 9; k++) { g.fillStyle = C[[1, 0, 1, 2, 3, 2, 1, 0, 2][k]]; g.fillRect(cx + k, Y - 1, 1, h * Q + 2 - (k % 3)); }
    g.fillStyle = RDC_PAL.out; g.fillRect(cx - 1, Y - 1, 1, h * Q + 2); g.fillRect(cx + 9, Y - 1, 1, h * Q + 2);
    g.fillStyle = '#b89660'; g.fillRect(cx + 1, Y + Math.round(h * Q * 0.55), 7, 2); // 绑带
  }
  g.restore();
}

// ---------- 驾驶室（平头货车，从侧面剖开） ----------
function rdiCab(g, left, floorY, ceil, w, R, day, b) {
  const Q = RD_Q, P = RDC_PAL, X = Math.round(left * Q), FW = w * Q, top = (ceil + 6) * Q, fy = floorY * Q;
  const key = 'cab' + w + rdiVeh();
  if (!RDI_CACHE[key]) RDI_CACHE[key] = rdiBuildCab(w);
  const im = RDI_CACHE[key];
  // 前窗外的风景（先画，驾驶室图里窗户是空的）
  const S = rdiCabShape(w), top0 = ceil + 6; // 斜车头：风景只画在车顶下面（上面是天空）
  g.save(); g.beginPath(); g.moveTo(left + 12, top0 + 21);
  for (let k = 0; k <= 8; k++) { const xx = left + 12 + (w - 13) * k / 8; g.lineTo(xx, top0 + (S.roofY((xx - left) * Q) + 12) / Q); }
  g.lineTo(left + w - 1, top0 + 21); g.closePath(); g.clip();
  rdiWindow(g, left + 12, ceil + 8 + S.drop / Q, w - 13, 16 - S.drop / Q, R, day, b, 99);
  g.restore();
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
  const hx = X + (w - 6) * Q, hy = Math.round(top + S.roofY((w - 6) * Q) + 12);
  g.fillStyle = P.metal[3]; g.fillRect(hx, hy, 1, 5);
  g.fillStyle = '#38b764'; g.fillRect(hx - 2 + sw, hy + 5, 5, 2); g.fillRect(hx - 1 + sw, hy + 3, 3, 2); g.fillRect(hx - 3 + sw, hy + 7, 7, 2);
  g.fillStyle = '#a7f070'; g.fillRect(hx - 1 + sw, hy + 4, 1, 1);
  g.restore();
}
// 驾驶室外形跟着车外的样子：快递车 / 冰淇淋车是面包车的斜车头；垃圾车驾驶室比后面的压缩厢矮一截
function rdiCabShape(w) {
  const v = rdiVeh(), Q = RD_Q, FW = w * Q;
  const van = v === 'courier' || v === 'icecream', drop = v === 'garbage' ? 6 * Q : 0, top = -12 + drop;
  const sx0 = Math.round(FW * 0.3), sy1 = 15 * Q; // 斜风挡：从车顶 (sx0, top) 斜到前脸 (FW + 6, sy1)
  const roofY = (x) => (van && x > sx0) ? top + (Math.min(x, FW + 6) - sx0) * (sy1 - top) / (FW + 6 - sx0) : top; // 精细像素：x 处车顶外沿的 y
  return { van, drop, top, sx0, sy1, roofY };
}
function rdiBuildCab(w) {
  const Q = RD_Q, P = RDC_PAL, C = rdiSkin(), M = P.metal, D = P.dark, FW = w * Q, FH = 44 * Q; // 驾驶室：顶在 y = 0，地面在 y = FH
  const B = rdcPaper(FW + 64, FH + 40, 10, 13);
  const S = rdiCabShape(w), T = S.top;
  // 外壳：顶 + 前脸（面包车是一整面斜风挡，其他车微后倾）
  if (S.van) rdcPoly(B, [[-1, T], [S.sx0, T], [FW + 6, S.sy1], [FW + 8, FH + 16], [-1, FH + 16]], C, 1, 0, 1);
  else rdcPoly(B, [[-1, T], [FW - 4, T], [FW + 6, T + 6], [FW + 8, FH + 16], [-1, FH + 16]], C, 1, 0, 1);
  // 内饰：暗色顶棚、门板（深灰褐，有缝线）——在车顶外壳里面
  const IN = ['#6a5a4e', '#56483e', '#463a32', '#382e28'];
  if (S.van) rdcPoly(B, [[0, T + 9], [S.sx0, T + 9], [FW, Math.round(S.roofY(FW)) + 9], [FW, FH], [0, FH]], IN, 1, 0, 1);
  else rdcBox(B, 0, T + 9, FW, FH - T - 9, IN, 1, 0, 1);
  for (let x = 4; x < FW; x += 8) for (let y = 30; y < FH - 10; y += 2) if (rdcHash(x, y, 2) < 0.6) rdcPix(B, x, y, '#3c322a', 1);
  rdcRect(B, 0, 26 + S.drop, FW, 1, '#2e2620', 6); rdcRect(B, 0, 27 + S.drop, FW, 1, '#7a685a', 1);
  // 侧窗洞（风景另外画，透出来）：车顶下面留一圈框
  for (let y = 4 * Q - 2 + S.drop; y < 20 * Q; y++) for (let x = 12 * Q; x < (w - 1) * Q; x++) if (y > S.roofY(x) + 14) B.c[(y + B.oy) * B.w + x + B.ox] = -1;
  // A 柱（面包车：顺着斜风挡一道车漆窗框）
  if (S.van) {
    for (let x = S.sx0; x <= FW + 6; x++) for (let k = 0; k < 13; k++) rdcPix(B, x, Math.round(S.roofY(x)) + k, rdcRampAt(C, k / 13, x, k), 1);
    rdcPoly(B, [[(w - 1) * Q, Math.round(S.roofY((w - 1) * Q)) + 10], [FW + 6, S.sy1], [FW + 7, 20 * Q], [(w - 1) * Q, 20 * Q]], C, 1, 0, 1);
  } else rdcPoly(B, [[(w - 1) * Q, T + 9], [FW + 6, T + 9], [FW + 7, 20 * Q], [(w - 1) * Q, 20 * Q]], C, 1, 0, 1);
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
  if (rdiVeh() === 'pickup') { // 皮卡：驾驶室前面还有一段长引擎盖（大灯、格栅、钢管防撞架）
    const hy = 24 * Q;
    rdcPoly(B, [[FW + 6, hy], [FW + 38, hy + 4], [FW + 42, hy + 8], [FW + 42, FH + 12], [FW + 6, FH + 12]], C, 1, 0.1, 1);
    rdcLine(B, FW + 7, hy, FW + 38, hy + 4, C[0], 1); rdcLine(B, FW + 7, hy + 1, FW + 37, hy + 5, C[0], 1);
    rdcBox(B, FW + 39, hy + 10, 3, 6, [P.light[0], P.light[1], P.light[2]], 4);
    for (let y = hy + 20; y < FH; y += 3) rdcRect(B, FW + 39, y, 3, 1, D[1], 6);
    rdcBox(B, FW + 36, FH + 4, 10, 7, [M[1], M[2], M[3]], 2);
    rdcBox(B, FW + 46, hy - 2, 3, FH + 12 - hy, [M[0], M[1], M[2]], 2); rdcRect(B, FW + 42, hy + 2, 5, 2, M[2], 2); rdcRect(B, FW + 42, FH - 6, 5, 2, M[2], 2);
  }
  if (rdiVeh() === 'garbage') { // 垃圾车：车顶警示灯（底座 + 灯罩）
    rdcBox(B, FW / 2 - 6, T - 3, 12, 3, [M[1], M[2], M[3]], 2);
    rdcBox(B, FW / 2 - 4, T - 8, 8, 5, [P.beacon[1], P.beacon[2], P.beacon[3]], 4); rdcPix(B, FW / 2 - 2, T - 7, P.beacon[0], 4);
  }
  rdiWeatherShell(B, FW, FH);
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
// shadow：'wall' 挂在墙上的（往右下投影到墙上）/ 'floor' 放在地上的（脚下一圈接触阴影 + 墙上淡淡的影子）
function rdiFine(g, x, y, box, draw, shadow) {
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
  const X = (x + x0 - 1) * Q, Y = (y + y0 - 1) * Q;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (shadow && out.shadow) {
    g.globalAlpha = shadow === 'wall' ? 0.45 : 0.22;
    g.drawImage(out.shadow, X + (shadow === 'wall' ? 3 : 5), Y + (shadow === 'wall' ? 4 : -2));
    if (shadow === 'floor' && out.foot) { // 脚下的接触阴影
      const [fx0, fx1] = out.foot, fy = y * Q;
      g.globalAlpha = 0.35; g.fillStyle = '#140c08'; g.fillRect(X + fx0 - 2, fy - 1, fx1 - fx0 + 6, 3);
      g.globalAlpha = 0.18; g.fillRect(X + fx0 - 5, fy - 2, fx1 - fx0 + 12, 5);
    }
    g.globalAlpha = 1;
  }
  g.drawImage(out, X, Y);
  g.restore();
}
// 写实调色：去掉卡通的高饱和，偏暖、发灰；纯白变成旧的米白；纯黑变成深褐
function rdiGrade(v) {
  const a = v >>> 24; if (!a) return v;
  let r = v & 255, gg = (v >> 8) & 255, b = (v >> 16) & 255;
  const L = r * 0.3 + gg * 0.55 + b * 0.15;
  r = L + (r - L) * 0.5; gg = L + (gg - L) * 0.5; b = L + (b - L) * 0.45;
  r = r * 1.04 + 6; gg = gg * 0.97 + 3; b = b * 0.82;
  const top = 212; if (L > 170) { const k = top / Math.max(top, L * 1.02); r *= k; gg *= k; b *= k; }
  r *= 0.93; gg *= 0.93; b *= 0.93;
  const c = (n) => Math.max(14, Math.min(255, Math.round(n)));
  return ((a << 24) | (c(b) << 16) | (c(gg) << 8) | c(r)) >>> 0;
}
function rdiUpscale(u0, sw, sh) {
  const Q = 3, W = sw * Q, H = sh * Q, o = new Uint32Array(W * H);
  const u = new Uint32Array(u0.length);
  for (let i = 0; i < u0.length; i++) u[i] = (u0[i] >>> 24) >= 200 ? rdiGrade(u0[i]) : u0[i];
  const at = (x, y) => (x < 0 || y < 0 || x >= sw || y >= sh) ? 0 : u[y * sw + x];
  // Scale3x：斜边变圆滑
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const E = u[y * sw + x], A = at(x - 1, y - 1), Bq = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), F = at(x + 1, y), Gq = at(x - 1, y + 1), Hq = at(x, y + 1), I = at(x + 1, y + 1);
    const e = [E, E, E, E, E, E, E, E, E];
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
  const solid = (v) => (v >>> 24) >= 200;
  const mixTo = (v, r, g2, b, k) => { const vr = v & 255, vg = (v >> 8) & 255, vb = (v >> 16) & 255; return ((255 << 24) | (Math.round(vb + (b - vb) * k) << 16) | (Math.round(vg + (g2 - vg) * k) << 8) | Math.round(vr + (r - vr) * k)) >>> 0; };
  const DK = [26, 16, 10], LT = [236, 220, 190];
  // 物体的上下范围（越往下越脏、越暗）
  let minY = H, maxY = 0, fx0 = W, fx1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (solid(o[y * W + x])) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
  for (let x = 0; x < W; x++) for (let y = maxY - 2; y <= maxY; y++) if (y >= 0 && solid(o[y * W + x])) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }
  const res = o.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = o[i];
    if (!solid(v)) continue;
    const lum = ((v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255)) / 3;
    const up = y > 0 ? o[i - W] : 0, dn = y < H - 1 ? o[i + W] : 0, dn2 = y < H - 2 ? o[i + 2 * W] : 0, rt = x < W - 1 ? o[i + 1] : 0, lf = x > 0 ? o[i - 1] : 0;
    let nv = v;
    if (lum >= 36) {
      // 边缘：顶边一道细亮边（有的地方磨掉了），底边两行暗，右边稍暗
      const hh = rdcHash(x, y, 31);
      if (up !== v) nv = hh < 0.75 ? mixTo(v, LT[0], LT[1], LT[2], 0.16) : mixTo(v, DK[0], DK[1], DK[2], 0.1);
      else if (dn !== v) nv = mixTo(v, DK[0], DK[1], DK[2], 0.3);
      else if (dn2 !== v) nv = mixTo(v, DK[0], DK[1], DK[2], 0.14);
      else if (rt !== v) nv = mixTo(v, DK[0], DK[1], DK[2], 0.14);
      else if (lf !== v) nv = mixTo(v, LT[0], LT[1], LT[2], 0.06);
      // 颗粒质感 + 越往下越脏
      const grain = (rdcHash(x, y, 33) - 0.5) * 0.12;
      nv = grain > 0 ? mixTo(nv, LT[0], LT[1], LT[2], grain * 0.6) : mixTo(nv, DK[0], DK[1], DK[2], -grain);
      const low = maxY > minY ? (y - minY) / (maxY - minY) : 0;
      if (low > 0.55) nv = mixTo(nv, 70, 52, 36, (low - 0.55) * 0.35);
      // 污渍、锈点（成片，不是均匀撒）
      const st = rdcNoise2(x / 5, y / 4, 34);
      if (st > 0.78) nv = mixTo(nv, 92, 58, 30, (st - 0.78) * 1.2);
    }
    res[i] = nv;
  }
  // 描边：用旁边颜色加深（不是一圈统一的黑褐色），更像写实的轮廓
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (o[i] >>> 24) continue;
    let nb = 0;
    if (y < H - 1 && solid(o[i + W])) nb = res[i + W]; else if (y > 0 && solid(o[i - W])) nb = res[i - W]; else if (x > 0 && solid(o[i - 1])) nb = res[i - 1]; else if (x < W - 1 && solid(o[i + 1])) nb = res[i + 1];
    if (nb) res[i] = mixTo(nb, DK[0], DK[1], DK[2], 0.68);
  }
  const cv = createCanvas(W, H), cg = cv.getContext('2d'), im = cg.createImageData(W, H);
  new Uint32Array(im.data.buffer).set(res); cg.putImageData(im, 0, 0);
  // 影子：同样形状的深色剪影
  const sc = createCanvas(W, H), sg = sc.getContext('2d'), sim = sg.createImageData(W, H), sd = new Uint32Array(sim.data.buffer);
  const SH = (255 << 24 | 10 << 16 | 14 << 8 | 22) >>> 0;
  for (let i = 0; i < res.length; i++) if (res[i] >>> 24 >= 200) sd[i] = SH;
  sg.putImageData(sim, 0, 0);
  cv.shadow = sc; cv.foot = fx1 >= fx0 ? [fx0, fx1] : null;
  return cv;
}
