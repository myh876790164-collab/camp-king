// =============================================
//  公路求生：像素资源图标 + 汽车仪表盘（左上角）
//  仪表盘风格跟着车辆配置变：
//    普通车 → 老式指针仪表（边框是车身颜色）；电单车 → 绿色液晶码表
//    装了车载电脑/量子计算机 → 科技面板（青色）；军用战术终端 → 军用面板（琥珀色）
//    外星AI核心 / 反重力 → 外星全息面板（紫色）
//  点仪表盘 = 打开仓库（所有资源在仓库里看）
// =============================================

// ---------- 像素图标（12×12，每个字母一种颜色） ----------
const RD_ICON_PAL = {
  k: '#0d0d14', D: '#2b2b33', G: '#4a4a55', L: '#6b6b78', Y: '#ffcd75', // 油桶
  B: '#2f7fd8', b: '#6fc0ff', W: '#bfe6ff', // 水桶
  S: '#8a97a8', H: '#c3cfdc', R: '#b5713f', r: '#7a4526', // 工字钢 + 钢筋
  T: '#b8c2cc', N: '#c0392b', w: '#f4f4f4', O: '#f0a040', // 罐头
  X: '#e23b3b', g: '#c9ced6', // 药箱
  P: '#8a5a2b', C: '#e8c25a', c: '#b0902a', u: '#d08a3a', // 子弹
  V: '#3a4466', Z: '#ffe066', // 电池
  M: '#9b5fd0', m: '#e2b8ff', n: '#5b2f8a', // 外星晶体
  E: '#ffb02e', e: '#a8661a', // 发动机故障灯
};
const RD_ICON_MAP = {
  fuel: ['..kkkkkkkk..', '.kGLGGGGGGk.', '.kDLDDDDDDk.', '.kDLDDDDDDk.', '.kGLGGGGGGk.', '.kDLYYYYDDk.', '.kDLYDDYDDk.', '.kGLYYYYGGk.', '.kDLDDDDDDk.', '.kDLDDDDDDk.', '.kGLGGGGGGk.', '..kkkkkkkk..'],
  water: ['...kkkkkk...', '..k......k..', '.k........k.', 'kkkkkkkkkkkk', 'kWWWWWWWWWWk', 'kBbBBBBBBBBk', '.kBbBBBBBBk.', '.kBbBBBBBBk.', '.kBbBBBBBBk.', '..kBbBBBBk..', '..kBBBBBBk..', '...kkkkkk...'],
  scrap: ['kkkkkkk.....', 'kSHHHSkRr.Rr', 'kkkSkkkrR.rR', '..kSk..Rr.Rr', '..kHk..rR.rR', '..kHk..Rr.Rr', '..kSk..rR.rR', '..kSk..Rr.Rr', '..kSk..rR.rR', 'kkkSkkkRr.Rr', 'kSSSSSkrR.rR', 'kkkkkkk.....'],
  food: ['..kkkkkkkk..', '.kTTTTTTTTk.', '.kkkkkkkkkk.', '.kNNNNNNNNk.', '.kNwwwwwwNk.', '.kNwOOOOwNk.', '.kNwOOOOwNk.', '.kNwwwwwwNk.', '.kNNNNNNNNk.', '.kkkkkkkkkk.', '.kTTTTTTTTk.', '..kkkkkkkk..'],
  med: ['....kkkk....', '....k..k....', 'kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwwwwXXwwwwk', 'kwwwwXXwwwwk', 'kwwXXXXXXwwk', 'kwwXXXXXXwwk', 'kwwwwXXwwwwk', 'kwwwwXXwwwwk', 'kggggggggggk', 'kkkkkkkkkkkk'],
  ammo: ['..P...P...P.', '.PuP.PuP.PuP', '.uuP.uuP.uuP', '.kkk.kkk.kkk', '.CCc.CCc.CCc', '.CCc.CCc.CCc', '.CCc.CCc.CCc', '.CCc.CCc.CCc', '.CCc.CCc.CCc', '.CCc.CCc.CCc', '.kkk.kkk.kkk', '............'],
  power: ['....kkkk....', '.kkkkkkkkkk.', '.kVVVVVVVVk.', '.kVVVVZZVVk.', '.kVVVZZVVVk.', '.kVVZZZZZVk.', '.kVVVVZZVVk.', '.kVVVZZVVVk.', '.kVVZZVVVVk.', '.kVVVVVVVVk.', '.kkkkkkkkkk.', '............'],
  alien: ['.....kk.....', '....kmMk....', '....kmMk..k.', '...kmMMk.kmk', '...kmMMnkmMk', '..kmMMMnkmMk', '..kmMMMnkMk.', '..kmMMnkMnk.', '.kmkmMnkMk..', 'kmMkmMnkk...', '.kMnkMnk....', '..kkkkkk....'],
  engine: ['............', '...EEEE.....', '....EE......', '.EEEEEEEE.E.', 'EeeeeeeeEEE.', 'EeE....eE.E.', 'EeE....eE...', 'EeE....eEEE.', 'EeeeeeeeE.E.', '.EEEEEEEE...', '............', '............'],
};
const RD_ICON_CACHE = {};
function rdIconImg(key) {
  if (RD_ICON_CACHE[key]) return RD_ICON_CACHE[key];
  const fine = typeof rdoResIcon === 'function' ? rdoResIcon(key) : null; // 新的精细像素图标（js/roadicons.js）
  if (fine) return (RD_ICON_CACHE[key] = fine);
  const m = RD_ICON_MAP[key], c = createCanvas(12, 12), g = c.getContext('2d');
  m.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const col = RD_ICON_PAL[row[x]]; if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } } });
  return (RD_ICON_CACHE[key] = c);
}
// 画一个资源图标（左上角 x,y，边长 size）
function rdIcon(ctx, key, x, y, size, alpha) {
  if (!RD_ICON_MAP[key]) return;
  const old = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(rdIconImg(key), Math.round(x), Math.round(y), size, size);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = old;
}

// ---------- 仪表盘 ----------
const RD_DASH_PAL = {
  tech: { bg: '#071425', grid: '#0d2238', frame: '#2fd2ff', on: '#73eff7', off: '#12324d', hot: '#ff5f7a', text: '#9ff6ff', dim: '#3e7896' },
  mil: { bg: '#1c2414', grid: '#2a3520', frame: '#c8a640', on: '#ffcd75', off: '#3b4626', hot: '#ff6b3d', text: '#ffe0a0', dim: '#8a8a5a' },
  holo: { bg: '#170b2b', grid: '#2b1650', frame: '#c27bd6', on: '#e2b8ff', off: '#3a2160', hot: '#73eff7', text: '#f2dcff', dim: '#8d6ab0' },
};
let rdDashBuf = null;
function rdDashStyle(st) {
  const R = G.road;
  if (rdSum('hover') > 0 || st.research >= 5) return 'holo';
  if (st.research === 3) return 'mil';
  if (st.research >= 2) return 'tech';
  return R.veh === 'ebike' ? 'lcd' : 'analog';
}
// 低分辨率画布上的像素工具
function rdDashKit(g) {
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const line = (x0, y0, x1, y1, c) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 200; i++) { px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  const arc = (cx, cy, r, a0, a1, c) => { const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r * 1.5)); for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, c); } };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); rect(cx - w, cy + y, w * 2 + 1, 1, c); } };
  return { px, rect, line, arc, disc };
}
function rdDashText(ctx, t, x, y, size, color, align) {
  ctx.font = 'bold ' + size + 'px ' + FONT;
  ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
// 仪表盘数据
function rdDashData(st) {
  const R = G.road;
  const vmax = Math.max(60, Math.ceil(st.speed * 1.25 / 20) * 20);
  const gauges = [];
  if (st.tank > 0) gauges.push({ key: 'fuel', f: G.res.fuel / st.tank, v: Math.floor(G.res.fuel), low: G.res.fuel < st.tank * 0.15 });
  gauges.push({ key: 'power', f: G.res.power / Math.max(1, st.battery), v: Math.floor(G.res.power), low: G.res.power < st.battery * 0.15 });
  const lights = [
    { key: 'food', on: G.res.food < 3 }, { key: 'water', on: G.res.water < 3 }, { key: 'med', on: G.res.med < 1 },
    { key: 'engine', on: R.hpV < st.hp * 0.3 },
  ];
  return { speed: R.speedNow, vmax, sf: Math.min(1, R.speedNow / vmax), km: Math.floor(R.km), gauges, lights, ammo: Math.floor(G.res.ammo) };
}
// 布局（低分辨率坐标）：速度表 | 小表 × n | 弹药 + 警示灯
function rdDashLayout(W, H, d) {
  const sp = { cx: Math.floor(H / 2) + 1, cy: Math.floor(H / 2) + 1, r: Math.floor(H / 2) - 3 };
  const gw = 25, gx0 = sp.cx + sp.r + 4;
  const gs = d.gauges.map((gg, i) => ({ cx: gx0 + i * gw + 12, cy: Math.floor(H * 0.5), r: 10 }));
  const rx = gx0 + d.gauges.length * gw + 2;
  return { sp, gs, rx, rw: W - rx - 3 };
}

function rdDrawDash(ctx, x, y, w, h) {
  const R = G.road, st = R.st || rdStats(), style = rdDashStyle(st);
  const P = 2, W = Math.floor(w / P), H = Math.floor(h / P);
  if (!rdDashBuf) rdDashBuf = createCanvas(W, H);
  if (rdDashBuf.width !== W || rdDashBuf.height !== H) { rdDashBuf.width = W; rdDashBuf.height = H; }
  const g = rdDashBuf.getContext('2d'), K = rdDashKit(g), d = rdDashData(st), L = rdDashLayout(W, H, d);
  g.clearRect(0, 0, W, H);
  if (style === 'analog') rdDashAnalog(K, W, H, d, L);
  else if (style === 'lcd') rdDashLcd(K, W, H, d, L);
  else rdDashTech(K, W, H, d, L, RD_DASH_PAL[style], style);
  ctx.save();
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(rdDashBuf, x, y, W * P, H * P);
  ctx.restore();
  // ---- 清晰的文字和图标（画在原分辨率上） ----
  const pal = style === 'analog' ? { text: '#f4f4f4', dim: '#94b0c2', hot: '#ff6a3d' } : style === 'lcd' ? { text: '#1d2a14', dim: '#4c5e3a', hot: '#1d2a14' } : RD_DASH_PAL[style];
  const sx = x + L.sp.cx * P, sy = y + L.sp.cy * P;
  rdDashText(ctx, String(Math.round(d.speed)), sx, sy + 6, style === 'lcd' ? 17 : 15, pal.text);
  rdDashText(ctx, 'km/h', sx, sy + 19, 8, pal.dim);
  rdDashText(ctx, String(d.km).padStart(6, '0'), sx, sy - 11, 9, style === 'analog' ? '#ffcd75' : pal.dim);
  d.gauges.forEach((gg, i) => {
    const c = L.gs[i], gx = x + c.cx * P, gy = y + c.cy * P;
    ctx.fillStyle = style === 'analog' ? 'rgba(240,226,192,0.16)' : style === 'lcd' ? 'rgba(29,42,20,0.15)' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(gx - 23, gy + 6, 18, 18);
    rdIcon(ctx, gg.key, gx - 22, gy + 7, 16, gg.low && Math.floor(G.time * 3) % 2 ? 0.35 : 1);
    rdDashText(ctx, String(gg.v), gx + 7, gy + 16, 12, gg.low ? pal.hot : pal.text);
  });
  // 弹药 + 时钟 + 警示灯
  const rx = x + L.rx * P, rw = L.rw * P;
  if (rw > 40) {
    rdIcon(ctx, 'ammo', rx + 4, y + 9, 16);
    rdDashText(ctx, String(d.ammo), rx + 24, y + 17, 13, d.ammo < 10 ? pal.hot : pal.text, 'left');
    if (rw > 120) {
      const hh = Math.floor(rdHour()), mm = Math.floor((rdHour() % 1) * 60);
      rdDashText(ctx, String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), rx + rw - 6, y + 17, 13, style === 'analog' ? '#ffcd75' : pal.text, 'right');
    }
    // 窄屏：警示灯排成 2×2
    const n = d.lights.length, grid = rw < 110, cols = grid ? 2 : n;
    const sz = grid ? Math.min(18, Math.floor((rw - 12) / 2) - 4) : Math.max(10, Math.min(20, Math.floor((rw - 8) / n) - 4));
    d.lights.forEach((lt, i) => {
      const row = Math.floor(i / cols), col = i % cols;
      const lx = rx + 4 + col * (sz + 4), ly = y + h - 10 - (grid ? 2 - row : 1) * (sz + 4) + 4;
      const blink = lt.on && Math.floor(G.time * 2.5) % 2 === 0;
      if (lt.on) { ctx.fillStyle = blink ? 'rgba(239,60,60,0.75)' : 'rgba(239,60,60,0.35)'; ctx.fillRect(lx - 1, ly - 1, sz + 2, sz + 2); }
      rdIcon(ctx, lt.key, lx, ly, sz, lt.on ? 1 : 0.22);
    });
  }
  addButton(x, y, w, h, () => rdOpenPanel('inv'));
}

// 老式指针仪表（车身颜色的边框）
function rdDashAnalog(K, W, H, d, L) {
  const v = rdVeh(), body = v.color, trim = v.stripe;
  // 暖色做旧：深褐描边 + 车漆外框（锈点、划痕）+ 铆钉 + 深褐色表盘底
  K.rect(0, 0, W, H, '#24160f'); K.rect(1, 1, W - 2, H - 2, rdMix(body, '#8a7a62', 0.35)); K.rect(1, 1, W - 2, 1, rdMix(body, '#f4ead0', 0.4)); K.rect(1, H - 2, W - 2, 1, rdMix(body, '#24160f', 0.5));
  for (let i = 0; i < W * H / 14; i++) { const x = Math.floor(rdHash(i * 3.1) * W), y = Math.floor(rdHash(i * 7.3) * H); if (x < 2 || y < 2 || x > W - 3 || y > H - 3 || (x > 3 && x < W - 4 && y > 3 && y < H - 4)) continue; K.px(x, y, rdHash(i) > 0.5 ? '#a85a2a' : '#6a3a1c'); }
  K.rect(3, 3, W - 6, H - 6, '#1e1712'); K.rect(3, 3, W - 6, 1, '#3a2c22');
  K.rect(3, 3, W - 6, 2, trim); // 顶上的装饰条
  for (const [rx, ry] of [[1, 1], [W - 3, 1], [1, H - 3], [W - 3, H - 3]]) { K.px(rx, ry, '#d8d0c0'); K.px(rx + 1, ry + 1, '#48423a'); }
  for (let x = 5; x < W - 5; x += 6) K.px(x, H - 5, '#2e241c');
  // 速度表
  const s = L.sp;
  K.disc(s.cx, s.cy, s.r + 1, '#c8a060'); K.disc(s.cx, s.cy, s.r, '#14100c'); K.arc(s.cx, s.cy, s.r + 1, Math.PI * 1.1, Math.PI * 1.6, '#f0d8a0');
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  for (let i = 0; i <= 12; i++) {
    const a = a0 + (a1 - a0) * i / 12, red = i >= 10, big = i % 2 === 0;
    K.line(s.cx + Math.cos(a) * (s.r - (big ? 3 : 2)), s.cy + Math.sin(a) * (s.r - (big ? 3 : 2)), s.cx + Math.cos(a) * (s.r - 1), s.cy + Math.sin(a) * (s.r - 1), red ? '#e23b3b' : '#e9e1c8');
  }
  const na = a0 + (a1 - a0) * d.sf + Math.sin(G.time * 30) * 0.01 * (d.speed > 1 ? 1 : 0);
  K.line(s.cx, s.cy, s.cx + Math.cos(na) * (s.r - 3), s.cy + Math.sin(na) * (s.r - 3), '#ff6a3d');
  K.disc(s.cx, s.cy, 1, '#c8ccd2');
  // 小表（油量 / 电量）
  d.gauges.forEach((gg, i) => {
    const c = L.gs[i], b0 = Math.PI * 1.1, b1 = Math.PI * 1.9;
    K.disc(c.cx, c.cy - 2, c.r + 1, '#c8a060'); K.disc(c.cx, c.cy - 2, c.r, '#14100c');
    K.rect(c.cx - c.r - 1, c.cy + 1, c.r * 2 + 3, c.r + 2, '#1e1712');
    K.rect(c.cx - c.r, c.cy, c.r * 2 + 1, 1, '#c8a060');
    for (let k = 0; k <= 4; k++) { const a = b0 + (b1 - b0) * k / 4; K.px(c.cx + Math.cos(a) * (c.r - 1), c.cy - 2 + Math.sin(a) * (c.r - 1), k === 0 ? '#e23b3b' : '#e9e1c8'); }
    const a = b0 + (b1 - b0) * Math.max(0, Math.min(1, gg.f));
    K.line(c.cx, c.cy - 2, c.cx + Math.cos(a) * (c.r - 2), c.cy - 2 + Math.sin(a) * (c.r - 2), '#ff6a3d');
  });
  // 右边：镀铬小牌子
  if (L.rw > 18) { for (const yy of [5, H - 16]) { K.rect(L.rx, yy, L.rw, 13, '#2a2018'); K.rect(L.rx, yy, L.rw, 1, '#4a3a2c'); K.px(L.rx + 1, yy + 1, '#a89a84'); K.px(L.rx + L.rw - 2, yy + 1, '#a89a84'); } }
}
// 电单车：绿色液晶码表
function rdDashLcd(K, W, H, d, L) {
  K.rect(0, 0, W, H, '#2a2f38'); K.rect(1, 1, W - 2, H - 2, '#3c4a2c'); K.rect(2, 2, W - 4, H - 4, '#9fb38a');
  for (let y = 3; y < H - 3; y += 2) K.rect(3, y, W - 6, 1, '#98ad83');
  const s = L.sp;
  // 速度：一圈 20 格的液晶刻度
  for (let i = 0; i < 20; i++) {
    const a = Math.PI * 0.75 + Math.PI * 1.5 * i / 19, on = i / 19 <= d.sf && d.sf > 0;
    const c = on ? '#1d2a14' : '#8a9e75';
    K.rect(s.cx + Math.cos(a) * (s.r - 1) - 1, s.cy + Math.sin(a) * (s.r - 1) - 1, 2, 2, c);
  }
  // 电量：竖着的格子
  d.gauges.forEach((gg, i) => {
    const c = L.gs[i], n = 8;
    for (let k = 0; k < n; k++) K.rect(c.cx - 9, c.cy - 13 + (n - 1 - k) * 2, 18, 1, k / n < gg.f ? '#1d2a14' : '#8a9e75');
  });
}
// 科技 / 军用 / 外星全息面板
function rdDashTech(K, W, H, d, L, p, style) {
  K.rect(0, 0, W, H, p.frame); K.rect(1, 1, W - 2, H - 2, p.bg);
  // 背景网格（全息面板是六边形点阵，会闪）
  if (style === 'holo') { for (let y = 3; y < H - 2; y += 4) for (let x = 3 + (y % 8 ? 2 : 0); x < W - 2; x += 4) if ((x * 7 + y * 3 + Math.floor(G.time * 4)) % 9) K.px(x, y, p.grid); }
  else { for (let x = 4; x < W - 2; x += 6) K.rect(x, 2, 1, H - 4, p.grid); for (let y = 4; y < H - 2; y += 6) K.rect(2, y, W - 4, 1, p.grid); }
  K.px(1, 1, p.frame); K.px(W - 2, H - 2, p.frame);
  const s = L.sp, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, N = 26;
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1), a = a0 + (a1 - a0) * f, on = d.sf > 0 && f <= d.sf;
    const c = on ? (f > 0.8 ? p.hot : p.on) : p.off;
    K.line(s.cx + Math.cos(a) * (s.r - 3), s.cy + Math.sin(a) * (s.r - 3), s.cx + Math.cos(a) * s.r, s.cy + Math.sin(a) * s.r, c);
  }
  K.arc(s.cx, s.cy, s.r - 5, a0, a1, p.off);
  // 扫描线（转圈）
  const sw = G.time * 1.6;
  K.px(s.cx + Math.cos(sw) * (s.r - 6), s.cy + Math.sin(sw) * (s.r - 6), p.on);
  // 油量 / 电量：分段竖条
  d.gauges.forEach((gg, i) => {
    const c = L.gs[i], n = 10;
    K.rect(c.cx - 10, 3, 1, H - 6, p.off); K.rect(c.cx + 10, 3, 1, H - 6, p.off);
    for (let k = 0; k < n; k++) {
      const on = k / n < gg.f, col = on ? (gg.low ? p.hot : p.on) : p.off;
      K.rect(c.cx - 8, c.cy - 15 + (n - 1 - k) * 2, 4, 1, col);
      K.rect(c.cx + 4, c.cy - 15 + (n - 1 - k) * 2, 4, 1, col);
    }
  });
  // 右边的信息框
  if (L.rw > 18) {
    K.rect(L.rx, 3, L.rw, 1, p.frame); K.rect(L.rx, H - 4, L.rw, 1, p.frame);
    if ((G.road.st || rdStats()).radar) { // 有雷达：小雷达扫描
      const rcx = L.rx + L.rw - 9, rcy = 11, rr = 6, a = G.time * 2.4;
      K.arc(rcx, rcy, rr, 0, Math.PI * 2, p.off); K.line(rcx, rcy, rcx + Math.cos(a) * rr, rcy + Math.sin(a) * rr, p.on);
    }
  }
  // 扫描线条纹
  const sy = Math.floor((G.time * 20) % H);
  K.rect(2, sy, W - 4, 1, 'rgba(255,255,255,0.06)');
}
