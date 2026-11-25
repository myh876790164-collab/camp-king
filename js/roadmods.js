// =============================================
//  公路求生：车外改装件的精细像素外观（外装甲、前撞角、轮胎、底盘悬挂 / 反重力漂浮）
//  画法和 js/roadcar.js 的车一样：静态部分按「车型 + 零件」逐像素画好后缓存成图片，
//  会动的部分（滚筒、液压锤、电弧、力场、外星光纹、轮胎花纹、履带、悬浮光束）每帧画，每秒 10 帧。
//  坐标：精细像素，x = 0 是车头，y = 0 是地面，向上为负
// =============================================

// 每辆车放改装件的位置：arm 外装甲的范围 [左 x, 右 x, 上 y, 下 y]；front 撞角 [车头 x, 上 y, 下 y]
const RDM_GEO = {
  courier: { arm: [-136, -8, -42, -21], front: [6, -46, -18] },
  garbage: { arm: [-166, -4, -48, -24], front: [6, -40, -19] },
  ebike: { arm: [-46, -18, -35, -14], front: [0, -40, -12] },
  pickup: { arm: [-131, -2, -40, -20], front: [5, -48, -20] },
  icecream: { arm: [-137, -2, -42, -20], front: [3, -46, -18] },
};
const RDM_CACHE = {};
function rdmPaper() { return rdcPaper(260, 160, 210, 140); }
function rdmNum(id) { return parseInt(id.replace(/\D+/g, ''), 10) || 0; }

// =============== 外装甲 ===============
function rdmBuildArmor(veh, id) {
  const P = RDC_PAL, M = P.metal, cf = RDC_CARS[veh], n = rdmNum(id), B = rdmPaper();
  let [x0, x1, t, b] = RDM_GEO[veh].arm;
  const skirt = n === 9; // 坦克装甲：往下盖住轮子上半截（侧裙板）
  if (skirt) { t -= 4; b = Math.max(b, -12); }
  const ok = (x, y) => x >= x0 && x <= x1 && y >= t && y <= b && (skirt ? y <= -cf.r * 2 + 2 || cf.wheels.every((w) => Math.abs(x - w) > cf.r + 3) || y < -cf.r - 2 : cf.wheels.every((w) => Math.hypot(x - w, y + cf.r) > cf.r + 5));
  const plate = (px, py, w, h, ramp, mat, riv) => {
    let any = false;
    for (let y = py; y < py + h; y++) for (let x = px; x < px + w; x++) if (ok(x, y)) { any = true; const tt = h > 1 ? (y - py) / (h - 1) : 0; rdcPix(B, x, y, y === py ? ramp[0] : y === py + h - 1 ? ramp[ramp.length - 1] : rdcRampAt(ramp, 0.15 + tt * 0.7, x, y), mat || 2); }
    if (any && riv) for (const [rx, ry] of [[px + 1, py + 1], [px + w - 3, py + 1], [px + 1, py + h - 3], [px + w - 3, py + h - 3]]) if (ok(rx, ry) && ok(rx + 1, ry + 1)) rdcRivet(B, rx, ry);
  };
  const W = x1 - x0, H = b - t;
  if (n === 1) { // 铁皮补丁：零散的生锈铁皮，铆钉钉上
    for (let k = 0; k < W / 16; k++) { const w = 9 + Math.floor(rdcHash(k, 1, 61) * 7), h = 6 + Math.floor(rdcHash(k, 2, 61) * Math.max(1, H - 8)); plate(x0 + Math.floor(rdcHash(k, 3, 61) * (W - w)), t + Math.floor(rdcHash(k, 4, 61) * Math.max(1, H - h)), w, h, k % 3 ? [P.rust[0], P.rust[1], P.rust[2], P.rust[3]] : [M[1], M[2], M[3]], 2, true); }
  } else if (n === 2) { // 车门拼接甲：拆来的别的车门（不同颜色，带车窗洞和门把手）
    const cols = [['#9ab0bc', '#7890a0', '#5a7080', '#3e5060'], ['#dcd4c4', '#bcb4a2', '#968e7c', '#6e6858'], ['#b8785a', '#985c42', '#74422e', '#50301e']];
    for (let k = 0, x = x0 + 2; x < x1 - 12; k++, x += 30) {
      const w = Math.min(27, x1 - x), c = cols[k % 3];
      plate(x, t, w, H + 1, c, 1, false);
      for (let y = t + 2; y < t + Math.floor(H * 0.4); y++) for (let xx = x + 3; xx < x + w - 3; xx++) if (ok(xx, y)) rdcPix(B, xx, y, rdcRampAt(P.glass, (y - t) / (H * 0.4), xx, y), 3);
      if (ok(x + w - 7, t + Math.floor(H * 0.55))) rdcRect(B, x + w - 8, t + Math.floor(H * 0.55), 4, 1, M[1], 2);
      rdcLine(B, x + 5, t + 3, x + 10, t + Math.floor(H * 0.35), P.glass[0], 3); // 玻璃裂纹
    }
  } else if (n === 3) { // 焊接钢板：一块块厚钢板，焊缝是亮的点线
    for (let k = 0, x = x0; x < x1; k++, x += 18) { plate(x, t, 17, H + 1, k & 1 ? [M[0], M[1], M[2], M[3]] : [M[1], M[1], M[2], M[3]], 2, false); for (let y = t; y <= b; y++) if (ok(x + 17, y)) rdcPix(B, x + 17, y, (y & 1) ? '#e8d8b0' : P.dark[1], 2); }
  } else if (n === 4) { // 废轮胎缓冲甲：一排旧轮胎，用绳子绑着
    const rr = Math.max(4, Math.min(8, Math.floor(H / 2) - 1)), cy = t + Math.floor(H / 2);
    for (let x = x0 + rr; x < x1 - rr; x += rr * 2 + 1) for (let y = -rr; y <= rr; y++) for (let xx = -rr; xx <= rr; xx++) { const d = Math.hypot(xx, y); if (d <= rr && ok(x + xx, cy + y)) rdcPix(B, x + xx, cy + y, d < rr * 0.45 ? P.dark[2] : d < rr * 0.6 ? P.tire[3] : rdcRampAt(P.tire, 0.3 + (y + rr) / (rr * 2) * 0.6, xx, y), 5); }
    for (let x = x0; x <= x1; x++) if (ok(x, cy)) rdcPix(B, x, cy - rr + 1, '#a08860', 2);
  } else if (n === 5) { // 铁丝网刺笼：斜着交叉的铁丝网 + 立柱 + 倒刺
    for (let y = t; y <= b; y++) for (let x = x0; x <= x1; x++) if (ok(x, y) && (((x + y) % 6 + 6) % 6 === 0 || ((x - y) % 6 + 6) % 6 === 0)) rdcPix(B, x, y, ((x + y) & 1) ? M[1] : M[2], 2);
    for (let x = x0 + 4; x < x1; x += 22) plate(x, t - 2, 3, H + 3, [M[1], M[2], M[3]], 2, false);
    for (let k = 0; k < W / 7; k++) { const x = x0 + Math.floor(rdcHash(k, 5, 62) * W), y = t + Math.floor(rdcHash(k, 6, 62) * H); if (ok(x, y)) { rdcPix(B, x - 1, y - 1, M[0], 2); rdcPix(B, x + 1, y + 1, M[0], 2); rdcPix(B, x + 1, y - 1, M[0], 2); rdcPix(B, x - 1, y + 1, M[0], 2); } }
  } else if (n === 6) { // 复合陶瓷装甲：一格格陶瓷砖，有的裂了
    for (let y = t; y <= b; y += 7) for (let x = x0 + ((y - t) / 7 & 1) * 4; x < x1; x += 9) { const v = rdcHash(x, y, 63); plate(x, y, 8, 6, v < 0.5 ? ['#dcd4c4', '#c0b6a4', '#a49a88', '#7e7464'] : ['#d0c8b8', '#b4aa98', '#988e7c', '#766c5c'], 2, false); if (v > 0.85) rdcLine(B, x + 1, y + 1, x + 6, y + 4, '#5e5648', 2); }
  } else if (n === 7) { // 钛合金蒙皮：大块发蓝的银色板，细缝，斜着一道反光
    const T = ['#e0e6ea', '#bcc6ce', '#96a2ae', '#6e7a86'];
    for (let x = x0; x < x1; x += 32) { plate(x, t, 31, H + 1, T, 2, false); for (let y = t; y <= b; y++) { const sx = x + 6 + (y - t); if (ok(sx, y)) rdcPix(B, sx, y, '#f4f8fa', 2); if (ok(sx + 2, y)) rdcPix(B, sx + 2, y, T[0], 2); } for (const [sx, sy] of [[x + 2, t + 2], [x + 28, t + 2], [x + 2, b - 2], [x + 28, b - 2]]) if (ok(sx, sy)) rdcPix(B, sx, sy, T[3], 2); }
  } else if (n === 8) { // 军用反应装甲：一排排橄榄色砖块，每块一个螺栓
    const O = ['#a0a676', '#82885a', '#646a42', '#484e2e'];
    for (let y = t; y <= b; y += 8) for (let x = x0; x < x1; x += 11) { plate(x, y, 10, 7, O, 2, false); if (ok(x + 4, y + 3)) rdcRivet(B, x + 4, y + 3); }
  } else if (n === 9) { // 重型坦克装甲：很厚的深橄榄色斜面板 + 侧裙板 + 大螺栓
    const O = ['#868a62', '#6a6e4a', '#525638', '#3a3e26'];
    for (let x = x0; x < x1; x += 26) { plate(x, t, 25, b - t + 1, O, 2, false); for (let y = t + 3; y < b; y += 9) if (ok(x + 3, y)) { rdcRect(B, x + 2, y, 3, 3, O[3], 2); rdcPix(B, x + 2, y, O[0], 2); } }
    for (let x = x0; x <= x1; x++) for (const y of [t, t + 1]) if (ok(x, y)) rdcPix(B, x, y, y === t ? '#a8aa84' : O[0], 2);
  } else if (n === 10) { // 纳米蜂窝装甲：深蓝灰的六边形格子（青色流光每帧画）
    for (let y = t; y <= b; y++) for (let x = x0; x <= x1; x++) if (ok(x, y)) rdcPix(B, x, y, rdmHexEdge(x, y) ? '#8a98b0' : rdcRampAt(['#5a6478', '#4a5466', '#3a4254', '#2c3242'], (y - t) / Math.max(1, H), x, y), 2);
  } else if (n === 11) { // 外星生物甲壳：一片片紫色的椭圆甲片（发光的血管每帧画）
    for (let k = 0, x = x0 + 4; x < x1 + 8; k++, x += 5) { const row = k & 1, cy = t + H * (row ? 0.72 : 0.3), rx = 7, ry = Math.max(4, H * 0.32); for (let y = -ry; y <= ry; y++) for (let xx = -rx; xx <= rx; xx++) { const d = Math.hypot(xx / rx, y / ry); if (d <= 1 && ok(x + xx, Math.round(cy + y))) rdcPix(B, x + xx, Math.round(cy + y), d > 0.85 ? '#c49ad4' : rdcRampAt(['#9a6ab0', '#7a4e94', '#5d3878', '#40245a'], 0.2 + (y + ry) / (ry * 2) * 0.7, xx, y), 3); } }
  } else if (n === 12) { // 外星相位护盾：车身上只有几个发射器，护盾本身每帧画
    for (let x = x0 + 10; x < x1 - 6; x += 40) if (ok(x, t + 3)) { rdcBox(B, x, t + 1, 7, 5, ['#6a5a8a', '#4a3e66', '#30284a'], 3); rdcRect(B, x + 2, t + 2, 3, 2, '#73eff7', 4); }
  } else if (n === 13) { // 路牌鳞甲：路牌剪成鳞片，一层压一层
    const cols = [['#6a9a6a', '#4e7a50', '#365a3a'], ['#5a7aaa', '#425e8a', '#2e4468'], ['#e0bc50', '#c09a34', '#8a6c20'], ['#c05a46', '#9a4232', '#6e2e22'], ['#e0dcd0', '#c4beb0', '#9a948a']];
    for (let y = t, r = 0; y <= b; y += 5, r++) for (let x = x0 - (r & 1) * 4; x < x1; x += 8) { const c = cols[Math.floor(rdcHash(x, y, 64) * 5)]; for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 8; xx++) { if (yy === 6 && (xx === 0 || xx === 7)) continue; if (ok(x + xx, y + yy)) rdcPix(B, x + xx, y + yy, yy === 0 ? c[0] : yy >= 5 ? c[2] : c[1], 2); } if (rdcHash(x, y, 65) > 0.7 && ok(x + 2, y + 3)) rdcRect(B, x + 2, y + 3, 4, 1, '#f0ece0', 2); }
  } else if (n === 14) { // 防暴车装甲：深蓝灰钢板 + 竖格栅 + 电击网
    for (let x = x0; x < x1; x += 22) { plate(x, t, 21, H + 1, ['#5e687c', '#465064', '#343c4e', '#262c3c'], 2, true); for (let gx = x + 5; gx < x + 17; gx += 3) for (let y = t + 4; y < b - 3; y++) if (ok(gx, y)) rdcPix(B, gx, y, '#1e2230', 6); }
    for (let x = x0; x <= x1; x++) for (const y of [t - 1, b + 1]) if (ok(x, y - (y < t ? -1 : 1))) rdcPix(B, x, y < t ? t : b, (x & 3) === 0 ? '#c8d0e0' : '#7a8296', 2);
  }
  if (n !== 12) rdcWeather(B, 70 + n, n >= 10 ? -0.4 : n === 7 ? -0.25 : -0.05, t);
  rdcOutline(B);
  return rdcToCanvas(B);
}
function rdmHexEdge(x, y) { // 六边形格子的边（蜂窝）
  const h = 6, w = 7, row = Math.floor(y / h), ox = (row & 1) ? w / 2 : 0, cx = ((x + ox) % w + w) % w, cy = ((y % h) + h) % h;
  return cy === 0 || ((cx === 0) && cy < h);
}
// 外装甲：贴缓存图 + 会动的部分
function rdmArmor(g, X, Y, veh, p, fr) {
  const n = rdmNum(p.id), key = 'ar|' + veh + '|' + p.id;
  if (!RDM_CACHE[key]) RDM_CACHE[key] = rdmBuildArmor(veh, p.id);
  const im = RDM_CACHE[key], [x0, x1, t, b] = RDM_GEO[veh].arm;
  g.drawImage(im.cv, X - im.ox, Y - im.oy);
  if (n === 10) { // 蜂窝：一道青色流光从后往前扫
    const sx = X + x0 + ((fr * 6) % (x1 - x0 + 40)) - 20;
    g.fillStyle = '#73eff7';
    for (let y = t; y <= b; y++) for (let x = sx; x < sx + 10; x++) if (rdmHexEdge(x - X, y) && x - X >= x0 && x - X <= x1) { g.globalAlpha = 0.7 - Math.abs(x - sx - 5) * 0.12; g.fillRect(x, Y + y, 1, 1); }
    g.globalAlpha = 1;
  } else if (n === 11) { // 甲壳：血管一样的青色光纹，慢慢一明一暗
    g.fillStyle = '#73eff7';
    for (const k of [0.3, 0.72]) { const y0 = Y + t + (b - t) * k; for (let x = x0 + 2; x < x1 - 2; x++) { if (rdcHash(x >> 3, k * 10, 70) < 0.35) continue; g.globalAlpha = 0.35 + Math.sin(fr * 0.4 - x * 0.08) * 0.3; g.fillRect(X + x, Math.round(y0 + Math.sin(x * 0.35) * 1.5), 1, 1); } }
    g.globalAlpha = 1;
  } else if (n === 12) { // 相位护盾：车外一圈半透明的光壳，一道亮弧绕着转
    const ry = Math.max(40, -t + 14), cx = X + (x0 + x1) / 2, cy = Y - ry * 0.75, rx = (x1 - x0) / 2 + 18;
    g.globalAlpha = 0.07 + Math.sin(fr * 0.3) * 0.03; g.fillStyle = '#73eff7'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
    for (let k = 0; k < 90; k++) { const a = k / 90 * Math.PI * 2, d = Math.abs(((a - fr * 0.25) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI); g.globalAlpha = d > 2.6 ? 0.8 : 0.3; g.fillStyle = d > 2.6 ? '#e0ffff' : '#73eff7'; g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 2, 2); }
    g.globalAlpha = 1;
  } else if (n === 14 && (fr % 5) < 2) { // 防暴车：电击网上跳的电火花
    for (let k = 0; k < 2; k++) { const h = rdcHash(fr, k, 66), x = X + x0 + Math.floor(h * (x1 - x0)), y = Y + (k ? b : t); g.fillStyle = '#e0f0ff'; let px = x; for (let s = 0; s < 6; s++) { g.fillRect(px, y - s, 1, 1); px += rdcHash(fr, s + k * 9, 67) > 0.5 ? 1 : -1; } g.fillStyle = '#73b8ff'; g.fillRect(x - 1, y - 3, 1, 1); }
  }
}

// =============== 前撞角 ===============
function rdmBuildRam(veh, id) {
  const P = RDC_PAL, M = P.metal, D = P.dark, n = rdmNum(id), B = rdmPaper();
  const [F, top, bot] = RDM_GEO[veh].front, mid = Math.round((top + bot) / 2), H = bot - top;
  const tube = (x0, y0, x1, y1) => { rdcLine(B, x0, y0, x1, y1, M[0], 2); rdcLine(B, x0, y0 + 1, x1, y1 + 1, M[1], 2); rdcLine(B, x0, y0 + 2, x1, y1 + 2, M[3], 2); };
  const vtube = (x, y0, y1) => { for (let y = y0; y <= y1; y++) { rdcPix(B, x, y, M[0], 2); rdcPix(B, x + 1, y, M[1], 2); rdcPix(B, x + 2, y, M[3], 2); } };
  if (n === 1) { // 木板撞角：几块木板钉成楔形
    for (let y = top + 4, k = 0; y < bot - 1; y += 4, k++) { const len = 8 + Math.round((1 - Math.abs(y + 2 - mid) / (H / 2)) * 10); rdcBox(B, F - 2, y, len, 3, P.crate, 1, 0, 1); rdcPix(B, F + len - 4, y + 1, M[3], 2); rdcPix(B, F + 1, y + 1, M[3], 2); }
    rdcBox(B, F, top + 3, 3, H - 3, [P.crate[1], P.crate[3]], 1);
  } else if (n === 2) { // 购物车护栏：压扁的购物车筐（细铁丝格子）+ 小轮子 + 红把手
    const x0 = F, x1 = F + 16, y0 = mid - 8, y1 = bot - 3;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1 - Math.floor((y1 - y) * 0.25); x++) if (y === y0 || y === y1 || x === x0 || x === x1 - Math.floor((y1 - y) * 0.25) || (x - x0) % 3 === 0 || (y - y0) % 3 === 0) rdcPix(B, x, y, (x + y) & 1 ? M[1] : M[0], 2);
    rdcBox(B, x0 - 1, y0 - 2, 6, 2, ['#c84a3a', '#8a2a20'], 1);
    for (const wx of [x0 + 3, x1 - 3]) { rdcRect(B, wx - 1, y1 + 1, 3, 3, D[1], 5); rdcPix(B, wx, y1 + 2, M[1], 2); }
  } else if (n === 3) { // 钢管防撞杠：竖管 + 两根横管 + 绞盘
    vtube(F + 4, top + 2, bot); tube(F - 1, top + 3, F + 6, top + 3); tube(F - 1, bot - 7, F + 6, bot - 7);
    rdcBox(B, F, mid - 2, 6, 6, [D[0], D[1], D[2]], 6); rdcRect(B, F + 1, mid - 1, 4, 1, M[2], 2); rdcRect(B, F + 1, mid + 2, 4, 1, M[2], 2);
  } else if (n === 4) { // 推土铲：往前凹的弧形大铲（褪色的黄）+ 两根推杆
    // 侧面看是一块往前凹的厚弧形钢板（铲面亮、背后有加强筋），底下是磨亮的刀口
    const yT = top - 4, yB = -3, hh = (yB - yT) / 2, m = (yT + yB) / 2, Y = ['#e8c470', '#c8a04c', '#a07a34', '#745424'];
    tube(F - 1, mid - 3, F + 8, mid - 1); tube(F - 1, bot - 4, F + 8, bot - 6);
    for (let y = yT; y <= yB; y++) { const c = Math.round(((y - m) / hh) ** 2 * 6), xf = F + 16 + c, th = 7; for (let k = 0; k < th; k++) rdcPix(B, xf - k, y, k === 0 ? Y[0] : k === th - 1 ? Y[3] : rdcRampAt(Y, 0.2 + (y - yT) / (yB - yT) * 0.55 + k * 0.05, k, y), 2); }
    for (let y = yT + 4; y < yB - 2; y += 7) { const c = Math.round(((y - m) / hh) ** 2 * 6); rdcRect(B, F + 7 + c, y, 4, 2, Y[2], 2); rdcRivet(B, F + 12 + c, y); }
    rdcRect(B, F + 16, yB - 1, 6, 2, M[0], 2); rdcRect(B, F + 16, yB, 6, 1, M[2], 2);
    for (let k = 0; k < 4; k++) rdcPix(B, F + 15 + Math.round(((yT + 6 + k * 9 - m) / hh) ** 2 * 6), yT + 6 + k * 9, P.rust[1], 2);
  } else if (n === 5) { // 锯齿破城锤：横梁 + 前面一块锯齿板
    rdcBox(B, F - 1, mid - 3, 16, 6, [M[1], M[2], M[3]], 2); rdcRivet(B, F + 2, mid - 2); rdcRivet(B, F + 10, mid - 2);
    rdcBox(B, F + 15, top + 2, 4, H - 3, [M[0], M[1], M[2], M[3]], 2);
    for (let y = top + 2; y < bot - 1; y += 3) for (let k = 0; k < 4; k++) rdcRect(B, F + 19 + k, y + Math.floor(k / 2), 1, 3 - Math.min(2, k), k > 2 ? M[0] : M[1], 2);
  } else if (n === 6) { // 旋转绞肉滚筒：支架（滚筒每帧画）
    tube(F - 1, mid - 1, F + 11, mid - 1); rdcBox(B, F + 9, mid - 3, 5, 6, [M[1], M[3]], 2);
  } else if (n === 7) { // 液压撞锤：油缸（活塞杆和锤头每帧画）
    rdcBox(B, F - 1, mid - 3, 12, 7, [M[0], M[1], M[2], M[3]], 2); rdcRect(B, F + 2, mid - 4, 2, 1, '#8a2a20', 2); rdcLine(B, F + 3, mid - 4, F - 2, mid - 8, '#8a2a20', 2);
  } else if (n === 8) { // 犁雪铲刀：很高、往前斜的橙色大铲，上沿刷警示斜纹
    // 侧面看到铲刀的端板：上宽下窄、往前探的橙色大板，前沿卷起来，上沿刷警示斜纹，下面刀口
    const yT = top - 12, yB = -2, O = ['#f0a858', '#d08034', '#a85e24', '#7a4018'];
    tube(F - 1, mid - 2, F + 8, mid - 2); tube(F - 1, bot - 4, F + 8, bot - 4);
    rdcPoly(B, [[F + 6, yT], [F + 22, yT - 2], [F + 24, yT + 3], [F + 18, yB], [F + 8, yB]], O, 2, 0.1, 1);
    for (let y = yT - 1; y <= yB; y++) for (let x = F + 6; x <= F + 25; x++) { const m = rdcMat(B, x, y); if (m !== 2) continue; if (y < yT + 4) rdcPix(B, x, y, (((x + y) % 6) + 6) % 6 < 3 ? '#f0c040' : '#2a2018', 7); else if (rdcMat(B, x + 1, y) === 0) rdcPix(B, x, y, O[0], 2); }
    for (let y = yT + 8; y < yB - 3; y += 8) { rdcRect(B, F + 10, y, 8, 1, O[3], 2); rdcRivet(B, F + 9, y - 2); }
    rdcRect(B, F + 8, yB - 1, 11, 2, M[0], 2);
  } else if (n === 9) { // 电磁冲击撞角：上下两根叉 + 铜线圈（电弧每帧画）
    for (const y of [top + 3, bot - 5]) { rdcBox(B, F - 1, y, 15, 3, ['#4a5878', '#2e3a54'], 2); for (let x = F + 1; x < F + 11; x += 2) rdcRect(B, x, y - 1, 1, 5, x & 2 ? '#c88a48' : '#8a5a2a', 2); rdcBox(B, F + 13, y - 1, 3, 5, ['#9ab8e0', '#5a78a8'], 4); }
    rdcBox(B, F - 1, top + 3, 3, bot - top - 5, ['#4a5878', '#2e3a54'], 2);
  } else if (n === 10) { // 外星力场犁：车头一个发射器（力场每帧画）
    rdcBox(B, F - 1, mid - 4, 6, 8, ['#6a5a8a', '#4a3e66', '#30284a'], 3); rdcRect(B, F + 2, mid - 2, 2, 4, '#73eff7', 4);
  } else if (n === 11) { // 尖刺栅栏：两根横梁上焊一排磨尖的钢筋
    rdcBox(B, F - 1, top + 3, 5, 3, [M[1], M[3]], 2); rdcBox(B, F - 1, bot - 5, 5, 3, [M[1], M[3]], 2);
    for (let y = top + 2; y < bot - 1; y += 3) { const len = 9 + Math.round(rdcHash(y, 1, 68) * 4); rdcLine(B, F + 2, y, F + 2 + len, y, M[2], 2); rdcPix(B, F + 3 + len, y, M[0], 2); rdcPix(B, F + 2 + len, y, M[0], 2); }
  }
  rdcWeather(B, 90 + n, n >= 9 ? -0.4 : 0.02, top);
  rdcOutline(B);
  return rdcToCanvas(B);
}
// 前撞角：贴缓存图 + 会动的部分（滚筒转、液压锤弹出、电弧、力场）
function rdmRam(g, X, Y, veh, p, fr) {
  const n = rdmNum(p.id), key = 'ram|' + veh + '|' + p.id;
  if (!RDM_CACHE[key]) RDM_CACHE[key] = rdmBuildRam(veh, p.id);
  const im = RDM_CACHE[key], [F, top, bot] = RDM_GEO[veh].front, mid = Math.round((top + bot) / 2), P = RDC_PAL;
  const box = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(X + x, Y + y, w, h); };
  if (n === 10) { // 力场：半透明的楔形，边上一圈亮线，一明一暗
    const a = 0.25 + Math.sin(fr * 0.6) * 0.1, tip = 26 + (fr & 1);
    g.globalAlpha = a; g.fillStyle = '#73eff7'; g.beginPath(); g.moveTo(X + F + 4, Y + top - 14); g.lineTo(X + F + tip, Y + mid); g.lineTo(X + F + 4, Y - 2); g.fill();
    g.globalAlpha = a + 0.35; g.fillStyle = '#e0ffff';
    for (let k = 0; k <= 20; k++) { const t = k / 20; g.fillRect(Math.round(X + F + 4 + (tip - 4) * t), Math.round(Y + top - 14 + (mid - top + 14) * t), 1, 1); g.fillRect(Math.round(X + F + 4 + (tip - 4) * t), Math.round(Y - 2 + (mid + 2) * t), 1, 1); }
    g.globalAlpha = 1;
  }
  g.drawImage(im.cv, X - im.ox, Y - im.oy);
  if (n === 6) { // 滚筒：一圈刀片在转
    const cx = X + F + 16, cy = Y + mid, r = Math.max(6, Math.min(10, Math.floor((bot - top) / 2) - 1));
    g.fillStyle = P.out; g.beginPath(); g.arc(cx, cy, r + 1, 0, 7); g.fill();
    g.fillStyle = P.metal[2]; g.beginPath(); g.arc(cx, cy, r - 1, 0, 7); g.fill();
    for (let k = 0; k < 8; k++) { const a = fr * 0.5 + k * Math.PI / 4; for (let d = r - 2; d <= r + 3; d++) { g.fillStyle = d > r + 1 ? P.metal[0] : P.metal[1]; g.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1); } }
    g.fillStyle = P.metal[3]; g.fillRect(cx - 1, cy - 1, 3, 3);
  } else if (n === 7) { // 液压锤：平时缩着，每隔一会儿猛地弹出
    const ext = Math.sin(G.time * 6) > 0.8 ? 9 : 0;
    box(F + 10, mid - 1, 4 + ext, 3, P.out); box(F + 10, mid - 1, 4 + ext, 2, P.metal[0]); box(F + 10, mid + 1, 4 + ext, 1, P.metal[2]);
    box(F + 13 + ext, top + 3, 5, bot - top - 5, P.out); box(F + 14 + ext, top + 4, 3, bot - top - 7, P.metal[1]); box(F + 14 + ext, top + 4, 1, bot - top - 7, P.metal[0]);
  } else if (n === 9 && (fr % 3) !== 2) { // 电磁：两根叉之间跳电弧
    let y = Y + top + 4, x = X + F + 14;
    g.fillStyle = (fr & 1) ? '#e0f0ff' : '#73b8ff';
    for (; y < Y + bot - 4; y++) { x += rdcHash(fr, y, 69) > 0.5 ? 1 : -1; g.fillRect(x, y, 1, 1); }
  }
}

// =============== 轮胎 ===============
// 卡车轮：和 js/roadcar.js 的 rdcDrawWheel 一样的底子，花纹按轮胎型号换
function rdmWheel(g, cx, cy, r, ph, id, bike, rear) {
  const P = RDC_PAL, n = id ? rdmNum(id) : 0, a0 = ph * Math.PI / 32;
  if (n === 11 && rear) r += bike ? 3 : 5; // 拖拉机大轮：后轮特别大
  if (bike) rdcBikeWheel(g, cx, cy, r, ph, rear);
  else {
    const d = rdcWheelDisc(r); g.drawImage(d.cv, cx - d.ox, cy - d.oy);
    for (let k = 0; k < 5; k++) { const a = a0 + k * Math.PI * 2 / 5; g.fillStyle = P.metal[3]; g.fillRect(Math.round(cx + Math.cos(a) * r * 0.4 - 0.5), Math.round(cy + Math.sin(a) * r * 0.4 - 0.5), 1, 1); g.fillStyle = P.metal[0]; g.fillRect(Math.round(cx + Math.cos(a) * r * 0.3 - 0.5), Math.round(cy + Math.sin(a) * r * 0.3 - 0.5), 1, 1); }
  }
  const dot = (a, d, c, s) => { g.fillStyle = c; g.fillRect(Math.round(cx + Math.cos(a) * d - 0.5), Math.round(cy + Math.sin(a) * d - 0.5), s || 1, s || 1); };
  const N = 16, step = Math.PI * 2 / N;
  if (!bike && (n === 0 || n === 5 || n === 9)) for (let k = 0; k < N; k++) { const a = a0 + k * step; dot(a, r - 1.6, P.tire[3]); dot(a, r - 2.8, P.tire[3]); }
  if (n === 1) { for (let k = 0; k < 10; k++) dot(-2.6 + k * 0.12, r - 1.5, P.tire[0]); } // 光头胎：磨平了，只有一道反光
  else if (n === 2) { g.fillStyle = '#3a322c'; for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2; dot(a, r - 1.5, '#3a322c'); dot(a, r - 2.5, '#2e2722'); } } // 实心胎：厚厚一圈没有花纹
  else if (n === 3 || n === 7 || n === 11) { // 越野 / 全地形 / 拖拉机：大块花纹凸出轮廓
    const M = n === 11 ? 10 : 12;
    for (let k = 0; k < M; k++) { const a = a0 + k * Math.PI * 2 / M; dot(a, r + 0.5, P.out, 2); dot(a, r - 0.5, P.tire[1], 2); if (n === 11) dot(a + 0.12, r - 2.5, P.tire[1], 2); }
    if (n === 7) for (let k = 0; k < 20; k++) dot(k / 20 * Math.PI * 2, r * 0.36, '#6a7048'); // 军绿轮毂
  } else if (n === 4) { // 雪地链：横着的链条 + 一圈链子
    for (let k = 0; k < 8; k++) { const a = a0 + k * Math.PI / 4; for (let d = r - 3; d <= r + 0.5; d += 1) dot(a, d, (Math.round(d) & 1) ? P.metal[0] : P.metal[2]); }
    for (let k = 0; k < 24; k++) dot(a0 + k * Math.PI / 12, r - 1, k & 1 ? P.metal[1] : P.metal[3]);
  } else if (n === 5) { for (let k = 0; k < 30; k++) dot(k / 30 * Math.PI * 2, r * 0.6, '#b8483a'); } // 防爆胎：侧壁一圈红线
  else if (n === 6) { // 钉刺轮胎：一圈尖钉往外扎
    for (let k = 0; k < 10; k++) { const a = a0 + k * Math.PI / 5; dot(a, r + 0.5, P.out); dot(a, r + 1.5, P.metal[2]); dot(a, r + 2.5, P.metal[0]); }
  } else if (n === 9) { // 碳纤维竞速胎：黑亮的轮毂 + 红色细圈
    for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; dot(a, r * 0.5, '#2a2a2e'); dot(a, r * 0.42, '#2a2a2e'); dot(a, r * 0.58, '#c84040'); }
    for (let k = 0; k < 5; k++) { const a = a0 + k * Math.PI * 2 / 5; for (let d = r * 0.18; d < r * 0.55; d++) dot(a, d, '#3a3a40'); }
  } else if (n === 10) { // 智能变形轮：花纹一段段在变，缝里透出青光
    for (let k = 0; k < 6; k++) { const a = a0 + k * Math.PI / 3, open = ((ph >> 1) + k) % 3 === 0; for (let s = -2; s <= 2; s++) dot(a + s * 0.12, r + (open ? 1.5 : 0.5), open ? P.out : P.tire[2], open ? 2 : 1); dot(a + 0.5, r - 2, '#73eff7'); }
    g.fillStyle = '#73eff7'; g.fillRect(cx - 1, cy - 1, 2, 2);
  }
}
// 履带：前后轮之间绕一圈履带，履带板每帧往后挪 2 像素（8 帧一圈）；里面一排负重轮
function rdmTrack(g, X, GY, cf, ph, veh) {
  const P = RDC_PAL, xs = cf.wheels.slice().sort((a, b) => a - b), rear = xs[0], front = xs[xs.length - 1], r = cf.r + 1, cy = GY - r;
  const key = 'trk|' + veh;
  if (!RDM_CACHE[key]) { // 静态：履带外框 + 负重轮
    const w = front - rear + r * 2 + 6, B = rdcPaper(w, r * 2 + 6, -rear + r + 3, r * 2 + 4);
    for (let y = -r * 2 - 1; y <= 0; y++) for (let x = rear - r - 1; x <= front + r + 1; x++) {
      const dx = x > front ? x - front : x < rear ? x - rear : 0, d = Math.hypot(dx, y + r);
      if (d <= r && d > r - 3) rdcPix(B, x, y, d > r - 1 ? P.tire[2] : P.tire[1], 5);
      else if (d <= r - 3 && d > r - 4) rdcPix(B, x, y, P.dark[2], 6);
    }
    const nW = Math.max(3, Math.round((front - rear) / (r * 1.3)));
    for (let k = 0; k <= nW; k++) { const wx = Math.round(rear + (front - rear) * k / nW), rr = k === 0 || k === nW ? r - 4 : Math.round(r * 0.5); for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) { const d = Math.hypot(x, y); if (d <= rr) rdcPix(B, wx + x, -r + (k === 0 || k === nW ? 0 : r - rr - 3) + y, d < rr * 0.4 ? P.metal[1] : d < rr * 0.6 ? P.metal[3] : rdcRampAt(P.tire, 0.4 + y / rr * 0.3, x, y), 5); } }
    rdcOutline(B);
    RDM_CACHE[key] = rdcToCanvas(B);
  }
  const im = RDM_CACHE[key];
  g.drawImage(im.cv, X - im.ox, GY - im.oy);
  // 履带板：上面往前走、下面往后走（相对车身）
  const off = (ph * 2) % 6;
  g.fillStyle = P.metal[2];
  for (let x = rear; x <= front; x++) { if (((x - off) % 6 + 6) % 6 === 0) g.fillRect(X + x, GY - r * 2, 1, 2); if (((x + off) % 6 + 6) % 6 === 0) g.fillRect(X + x, GY - 2, 1, 2); }
  for (const [ex, s] of [[front, 1], [rear, -1]]) for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + s * (k / 6 * Math.PI) + s * off * 0.15; if (s * Math.cos(a) < 0) continue; g.fillRect(Math.round(X + ex + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)), 2, 2); }
}

// =============== 底盘悬挂 ===============
// 抬高后车身和轮子之间露出来的减震 / 弹簧（画在车身后面）；lift 是抬高了多少（精细像素）
function rdmSuspension(g, X, GY, cf, id, lift, fr) {
  const P = RDC_PAL, M = P.metal, n = rdmNum(id), top = GY - lift - 24, box = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  for (const wx of cf.wheels) {
    const ax = X + wx, ay = GY - cf.r;
    if (n === 7) { // 板簧：车轴上面一叠弯弯的钢板
      for (let k = 0; k < 3; k++) for (let x = -cf.r; x <= cf.r; x++) { const y = Math.round(ay - cf.r * 0.5 - 2 - k * 2 + (x * x) / (cf.r * cf.r) * -3); box(ax + x, y, 1, 2, k ? M[2] : M[1]); }
      box(ax - cf.r, top, 2, ay - cf.r * 0.5 - top, M[3]);
    } else {
      // 减震筒：从车轴竖到车身底下
      const col = n === 4 ? ['#7a7e56', '#5c6040', '#42462c'] : n === 2 ? [M[0], '#e8e8e0', M[1]] : [M[1], M[2], M[3]];
      const sx = ax + (wx === cf.wheels[0] ? -cf.r * 0.6 : cf.r * 0.6) | 0;
      box(sx - 2, top, 6, ay - top, P.out); box(sx - 1, top, 4, ay - top, col[1]); box(sx - 1, top, 1, ay - top, col[0]); box(sx + 2, top, 1, ay - top, col[2]);
      if (n === 1) for (let y = top + 3; y < ay - 3; y += 3) box(sx - 2, y, 6, 1, '#c8a040');           // 加高：黄色弹簧圈
      if (n === 2) { box(sx - 3, ay - 12, 8, 6, '#2a2420'); box(sx - 2, ay - 11, 6, 1, '#4a4038'); box(sx + 4, top + 2, 1, ay - top - 14, '#a83a2a'); } // 气囊 + 红油管
      if (n === 3) { const a = 0.5 + Math.sin(fr * 0.8) * 0.4; g.globalAlpha = a; for (const y of [top + 4, ay - 8]) box(sx - 3, y, 8, 2, '#73eff7'); g.globalAlpha = 1; } // 电磁：青色光环
      if (n === 4) { box(ax - cf.r - 2, top + 2, cf.r * 2 + 4, 4, P.out); box(ax - cf.r - 1, top + 3, cf.r * 2 + 2, 2, '#6a6e4a'); } // 军用：粗横梁
    }
  }
  box(X + cf.wheels[cf.wheels.length - 1] - 6, top - 1, cf.wheels[0] - cf.wheels[cf.wheels.length - 1] + 12, 3, P.dark[1]); // 抬高垫块（大梁下面一条）
}
// 反重力漂浮：轮子收起来变成发光的悬浮盘，往下打光束，地上一圈光；引力波阵列还有一圈圈往外扩的波纹
function rdmHover(g, X, Y, GY, cf, id, fr) {
  const n = rdmNum(id), col = n === 6 ? ['#e0c0f0', '#c27bd6', '#7a3e96'] : ['#e0ffff', '#73eff7', '#2a8a96'], box = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  for (const wx of cf.wheels) {
    const px = X + wx, py = Y - 16, w = cf.r + 3;
    // 光束（梯形，往下变宽变淡，横纹往下走）
    for (let y = py + 3; y < GY; y++) { const t = (y - py) / Math.max(1, GY - py), hw = Math.round(w * 0.6 + t * w * 0.5); g.globalAlpha = (0.32 - t * 0.22) * ((((y - py) - fr * 2) % 6 + 6) % 6 < 2 ? 1.6 : 1); box(px - hw, y, hw * 2, 1, col[1]); }
    g.globalAlpha = 0.5 + Math.sin(fr * 0.7 + wx) * 0.2; box(px - w - 3, GY - 2, (w + 3) * 2, 2, col[1]); box(px - w, GY - 3, w * 2, 1, col[0]);
    g.globalAlpha = 1;
    // 悬浮盘：扁扁的金属盘 + 发光圈
    box(px - w - 1, py - 1, w * 2 + 2, 6, RDC_PAL.out); box(px - w, py, w * 2, 2, RDC_PAL.metal[1]); box(px - w, py + 2, w * 2, 2, RDC_PAL.metal[3]);
    box(px - w + 2, py + 4, w * 2 - 4, 1, (fr & 1) ? col[0] : col[1]);
  }
  if (n === 6) { // 引力波：地上一圈圈往外扩的椭圆
    const cx = X + (cf.wheels[0] + cf.wheels[cf.wheels.length - 1]) / 2;
    for (let k = 0; k < 2; k++) { const t = ((fr + k * 5) % 10) / 10, rx = 20 + t * cf.len * 0.6; g.globalAlpha = 0.5 * (1 - t); g.strokeStyle = col[1]; g.beginPath(); g.ellipse(cx, GY - 1, rx, 3 + t * 3, 0, 0, 7); g.stroke(); }
    g.globalAlpha = 1;
  }
}
