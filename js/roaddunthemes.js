// =============================================
//  公路求生：副本主题（矿洞、鬼城、军阀基地、外星人基地）—— 画面、目标物、主题怪、规则
//  每个主题往 RDX_THEMES 里加一项（框架见 js/roaddungeon.js）：
//    drawBack 自己画背景 + 路面（预先画好的长条图，和公路风景一样缓存）
//    drawObjs 目标物（矿点、矿车、塌方、灯笼、大门、能量核心……）
//    enter / tick / onKill / hud / bonus 规则
// =============================================
const RDY_CACHE = {};
function rdyBlit(g, L, sc, baseY, W, lit) { // 世界坐标里平铺一张长条图（baseY = 图里 y=0 那一行在画面上的位置）
  const Q = RD_Q, tw = L.cv.width / Q, off = ((sc % tw) + tw) % tw;
  for (let x = -off; x < W; x += tw) {
    g.drawImage(L.cv, Math.round(x * Q) / Q, baseY - L.base / Q, tw, L.cv.height / Q);
    if (lit) for (const l of L.lights) { const lx = x + l.x / Q; if (lx < -10 || lx > W + 10) continue; lit.push({ x: lx, y: baseY + l.y / Q, kind: l.kind, col: l.col, r: l.r, ph: l.ph, a: 1, a2: 0 }); }
  }
}
function rdyLayer(B) { return { cv: rdsToCanvas(B), lights: B.lights, base: B.base }; }
function rdySprite(key, w, h, ox, oy, fn) { if (RDY_CACHE[key]) return RDY_CACHE[key]; const B = rdcPaper(w, h, ox, oy); fn(B); rdcOutline(B); return (RDY_CACHE[key] = rdcToCanvas(B)); }
function rdyDraw(g, S, x, y, flip) { const Q = RD_Q; g.save(); g.translate(Math.round(x * Q) / Q, Math.round(y * Q) / Q); if (flip) g.scale(-1, 1); g.drawImage(S.cv, -S.ox / Q, -S.oy / Q, S.cv.width / Q, S.cv.height / Q); g.restore(); }
function rdyBar(g, x, y, w, p, col) { g.fillStyle = '#1a120c'; g.fillRect(x - w / 2 - 0.34, y - 0.34, w + 0.67, 2); g.fillStyle = col; g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, p)), 1.33); }
function rdyRnd(a, b) { return a + Math.random() * (b - a); }
// 底下补一块地面色（长条图不够高时）
function rdyFillBelow(g, L, gy, W, H, col) { const y = gy + (L.cv.height - L.base) / RD_Q - 1; if (y < H) { g.fillStyle = col; g.fillRect(0, y, W, H - y); } }

// ================= 矿洞 =================
const RDY_ROCK = ['#7a6a58', '#625444', '#4c4034', '#382e24', '#241c16'];
function rdyMineTiles() {
  if (RDY_CACHE.mine) return RDY_CACHE.mine;
  const s = 71, TW = RDS_TW, Rk = rdsR(RDY_ROCK), Wd = rdsR(['#b08458', '#8a6440', '#66482c', '#44301c']);
  // ---- 后墙：岩层、裂缝、矿脉闪光，每隔一段一副木支架 + 吊灯 ----
  const B = rdsPaper(330);
  for (let x = 0; x < TW; x++) for (let y = -330; y < 12; y++) {
    const i = (y + B.base) * TW + x, n = rdtN2(x, y, 48, 24, s);
    let v = 1.3 + (n - 0.5) * 1.5 + (Math.floor((y + rdtN2(x, 0, 96, 1, s + 1) * 20) / 7) & 1) * 0.35 + (y < -250 ? (-250 - y) / 60 : 0);
    if (Math.abs(rdtN2(x, y, 32, 12, s + 2) - 0.5) < 0.02) v += 1.3;
    const h = rdcHash(x, y, s); if (h < 0.05) v += 0.6; else if (h > 0.96) v -= 0.6;
    if (h > 0.9985) { B.c[i] = h > 0.9993 ? 0x73e0f0 : 0xf0c050; B.m[i] = 3; continue; }
    B.c[i] = rdsPick(Rk, v, x, y); B.m[i] = 2;
  }
  for (let k = 0; k < 4; k++) {
    const x0 = k * 384 + 60;
    for (const px of [x0, x0 + 150]) for (let y = -206; y < 12; y++) for (let j = 0; j < 9; j++) rdsPx(B, px + j, y, rdsPick(Wd, 0.3 + j / 9 * 2.4 + ((y + 400) % 23 === 0 ? 0.8 : 0), px + j, y), 1);
    for (let x = x0 - 8; x < x0 + 168; x++) for (let y = -216; y < -204; y++) rdsPx(B, x, y, rdsPick(Wd, (y + 216) / 12 * 2.6, x, y), 1);
    rdsLine(B, x0 + 9, -150, x0 + 40, -204, Wd[2], 1); rdsLine(B, x0 + 150, -150, x0 + 120, -204, Wd[2], 1);
    const lx = x0 + 79; rdsLine(B, lx, -204, lx, -186, 0x2a2420, 2); rdsRect(B, lx - 4, -186, 9, 3, 0x3a3430, 1); rdsRect(B, lx - 3, -183, 7, 5, 0xffd890, 3); rdsPx(B, lx, -181, 0xffffff, 3); rdsLight(B, lx, -180, 'win', '#ffc870', 7);
  }
  rdsOutline(B, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  const back = rdyLayer(B);
  // ---- 近处：矿石堆、木箱、油桶、报废矿车 ----
  const N = rdsPaper(170);
  for (let k = 0; k < 9; k++) {
    const x = rdsRand(s + 3, k) * TW, t = k % 4;
    if (t === 0) { rdsRock(N, x, 50, 26, Rk, s + k, { strata: 4 }); for (let j = 0; j < 10; j++) rdsPx(N, x - 20 + rdsRand(s, k * 10 + j) * 40, -4 - rdsRand(s + 9, k * 10 + j) * 20, j % 3 ? 0xf0c050 : 0x8ae0f0, 3); }
    else if (t === 1) { for (let c = 0; c < 2; c++) { const cx = x + c * 26; for (let xx = 0; xx < 24; xx++) for (let y = -22 - c * 4; y < 0; y++) rdsPx(N, cx + xx, y, rdsPick(Wd, 1 + (xx % 8 === 0 ? 1.2 : 0) + (y + 22) / 22, cx + xx, y), 1); } }
    else if (t === 2) { rdsCol(N, x, 0, -26, 16, RDT_RUST, s + k, { bands: 8 }); rdsCol(N, x + 18, 0, -26, 16, rdsR(['#5a6a7a', '#44525e', '#303a44']), s + k, { bands: 8 }); }
    else { rdsPoly(N, [[x - 26, -30], [x + 26, -30], [x + 20, -6], [x - 20, -6]], (px, py, tt) => rdsPick(RDT_RUST, 0.5 + tt * 2.4, px, py), 1); for (const wx of [x - 12, x + 12]) rdtEllipse(N, wx, -4, 5, 5, (px, py, d) => rdsPx(N, px, py, d < 0.3 ? 0x8a8478 : 0x2a2420, 1)); }
  }
  for (let k = 0; k < 6; k++) { const x = rdsRand(s + 4, k) * TW, L = 30 + rdsRand(s + 5, k) * 60; for (let y = -170; y < -170 + L; y++) rdsPx(N, x + Math.round(Math.sin(y * 0.2) * 1.2), y, k % 2 ? 0x3a3430 : 0x5a4a3a, 2); }
  rdsOutline(N, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  const near = rdyLayer(N);
  // ---- 地面 + 铁轨（车就开在铁轨上） ----
  const F = rdtPaper(TW, 75, 400), Gr = rdtRamp('#6a5640');
  for (let x = 0; x < TW; x++) for (let y = -42; y < 400; y++) { const i = (y + F.base) * TW + x; let v = 2 + (rdtN2(x, y, 48, 20, s + 6) - 0.5) * 1.6; const h = rdcHash(x, y, s + 8); if (h < 0.07) v += 0.8; else if (h > 0.95) v -= 0.8; F.c[i] = rdsPick(Gr, v + (y > 30 ? 0.5 : 0), x, y); F.m[i] = 2; }
  for (let x = 0; x < TW; x++) { for (let y = -3; y <= -1; y++) rdsPx(F, x, y, y === -3 ? 0xa8a49a : 0x5a5650, 2); for (let y = 12; y <= 15; y++) rdsPx(F, x, y, y === 12 ? 0xd8d4c8 : y === 13 ? 0x8a867c : 0x4a4640, 2); }
  for (let x = 0; x < TW; x += 30) { for (let xx = 0; xx < 16; xx++) for (let y = 16; y < 22; y++) rdsPx(F, x + xx, y, rdsPick(Wd, 1 + (y - 16) / 6 * 1.5 + (xx === 15 ? 1 : 0), x + xx, y), 1); rdsPx(F, x + 4, 14, 0x2a2622, 2); rdsPx(F, x + 11, 14, 0x2a2622, 2); }
  rdtGroundBits(F, 0, Gr, s);
  const floor = rdyLayer(F);
  return (RDY_CACHE.mine = { back, near, floor });
}
function rdyOre(kind) { return rdySprite('ore' + kind, 60, 44, 30, 40, (B) => { rdyRockC(B, 0, 0, 44, 26, RDY_ROCK); const C = [['#f0d070', '#c8a040'], ['#8ae8f8', '#4ab0c8'], ['#f09070', '#c05040'], ['#7a7064', '#5a5248']][kind]; for (let k = 0; k < 6; k++) { const x = -14 + k * 6, h = 6 + (k % 3) * 4; rdcPoly(B, [[x - 2, -10 - (k % 2) * 4], [x + 1, -10 - h - (k % 2) * 4], [x + 3, -10 - (k % 2) * 4]], C, kind === 3 ? 2 : 4); } }); }
function rdyRockC(B, cx, by, w, h, R) { for (let y = -h; y <= 0; y++) for (let x = -w / 2; x <= w / 2; x++) { const nx = x / (w / 2), ny = (y + h * 0.5) / (h * 0.6); if (nx * nx + ny * ny > 1 + (rdcHash(x, y, 4) - 0.5) * 0.2) continue; rdcPix(B, Math.round(cx + x), Math.round(by + y), rdcRampAt(R, 0.2 + nx * 0.3 + (y + h) / h * 0.5, x, y), 2); } }
function rdyCart() { return rdySprite('cart', 90, 60, 45, 52, (B) => { rdcPoly(B, [[-30, -40], [30, -40], [24, -12], [-24, -12]], RDT_RUST.map((c) => '#' + c.toString(16).padStart(6, '0')), 2); rdcRect(B, -32, -42, 64, 3, '#8a867c', 2); for (let x = -22; x <= 22; x += 11) rdcLine(B, x, -38, x * 0.8, -14, '#5a3018', 2); for (let k = 0; k < 7; k++) rdgBall(B, -18 + k * 6, -44 - (k % 3) * 3, 4, k % 3 ? ['#f0d070', '#c8a040', '#8a6a20'] : ['#8a8070', '#6a6050', '#4a4438']); for (const wx of [-16, 16]) { rdgBall(B, wx, -6, 6, ['#6a645e', '#4a443e', '#2c2722']); rdcPix(B, wx, -6, '#c8c4bc', 2); } }); }

// 矿洞专用怪的样子
Object.assign(RDN_BUILD, {
  digworm(B, fr, atk) { for (let k = 0; k < 5; k++) { const x = -18 + k * 7, y = -6 - Math.round(Math.sin(fr * 1.57 + k * 0.9) * 2) - (k === 4 ? (atk ? 14 : 8) : k === 3 ? 3 : 0); rdnBlob(B, x, y, 6, 6, ['#9a7a8a', '#7a5a6a', '#5a3e4e', '#3a2632']); for (let j = -3; j <= 3; j += 3) rdcPix(B, x + j, y - 5, '#c8a8b0', 1); }
    const hx = 14, hy = atk ? -22 : -16; for (let k = 0; k < 9; k++) rdcLine(B, hx, hy - 5 + k, hx + 12 - Math.abs(k - 4) * 2, hy, k % 2 ? '#c8c4bc' : '#8a867c', 1); rdnEye(B, hx - 2, hy - 4, '#ff9a50', 2); },
  cavebug(B, fr, atk) { const up = atk ? -2 : 0; for (let k = 0; k < 3; k++) { const ph = (fr + k) % 2 ? 2 : -2, lx = -6 + k * 6; rdcLine(B, lx, -3, lx + ph, 0, '#2a2018', 1); } rdnBlob(B, -3, -6 + up, 9, 5, ['#8a7a5a', '#6a5a3e', '#4a3e28', '#2e2618']); rdnBlob(B, -7, -6 + up, 4, 3, ['#fff0a0', '#ffd060', '#c89020'], 4); rdcLine(B, -4, -10 + up, 4, -10 + up, '#3a3020', 1); rdnBlob(B, 7, -5 + up, 3, 3, ['#6a5a3e', '#4a3e28']); rdcLine(B, 9, -7 + up, 13, -11 + up, '#2a2018', 1); rdnEye(B, 8, -6 + up, '#ffd060', 1); },
});

Object.assign(RDX_THEMES, {
  mine: {
    name: '矿洞', dur: 210, color: '#e8a040', hour: 19.3, biomes: [0, 1, 4], npcGoal: 1.9,
    desc: ['一条废弃的地下矿道，铁轨一路通向深处', '矿点前「刹车」停下就会自动开采；矿车顶着往前推', '头顶出现裂缝说明要塌方——刹车或冲刺躲开'],
    goals: '挖矿（每处 +50）、推矿车（每辆 +100）、杀敌、活到最后',
    pool: ['cavebug', 'digworm', 'roach', 'spider'], waveGap: [6, 9], hpMul: 0.85, dmgMul: 0.42,
    slots: ['engine', 'util'], partFilter: (p) => ['engine', 'util', 'tank'].includes(p.slot) || (p.slot === 'in' && p.kind === 'bench'),
    res: { gold: { scrap: 90, ammo: 20, power: 20 }, silver: { scrap: 55, ammo: 10 }, bronze: { scrap: 30 }, fail: { scrap: 8 } },
    enter(D) {
      const X = (d) => (D.baseKm + d) * RD_PX_KM;
      for (let d = 4; d < 150; d += rdyRnd(8, 13)) D.objs.push({ k: 'ore', x: X(d) + 30, prog: 0, kind: Math.floor(Math.random() * 3) });
      for (let d = 18; d < 140; d += rdyRnd(30, 40)) D.objs.push({ k: 'cart', x: X(d), pushed: 0 });
      D.caveT = 14; D.ore = 0; D.carts = 0;
    },
    tick(D, dt) {
      const R = G.road, vx = rdVehX(), L = rdVeh().len, stopped = R.speedNow < 3; D.note = ''; D.creep = false;
      for (const o of D.objs) {
        if (o.k === 'ore' && !o.done && o.x > vx - 8 && o.x < vx + 120) { // 矿点在车头前面
          if (o.x > vx + 40) { D.note = '前方有矿点：按「刹车」，车会停在它跟前开采'; D.creep = true; continue; }
          if (stopped) { o.prog += dt / 2.5; if (Math.random() < 0.3) rdSpark(o.x + (Math.random() - 0.5) * 12, -10, '#f0d070'); if (o.prog >= 1) { o.done = true; D.goal += 50; D.ore++; rdFloat(o.x, -30, '矿石 +50 分', '#f0d070'); sfx('coin'); } }
          else D.note = '矿点就在车头前：「刹车」停下开采';
        }
        if (o.k === 'cart' && !o.done && vx + 2 >= o.x - 12 && o.x - 12 > vx - 40) { const nx = vx + 14; o.pushed += Math.max(0, nx - o.x); o.x = Math.max(o.x, nx); if (o.pushed > 3 * RD_PX_KM) { o.done = true; D.goal += 100; D.carts++; rdFloat(o.x, -40, '矿车送达 +100 分', '#e8a040'); sfx('coin'); } else D.note = '推着矿车走：再推 ' + Math.max(0, 3 - o.pushed / RD_PX_KM).toFixed(1) + ' 公里'; }
        if (o.k === 'cave') {
          o.t -= dt;
          if (o.t <= 0 && !o.fell) { o.fell = true; o.life = 6; G.shake = 0.4; for (let k = 0; k < 14; k++) rdBurst(o.x + (Math.random() - 0.5) * 60, -60, '#7a6a58', 2);
            if (vx > o.x - 34 && vx - L < o.x + 34 && !D.out) { rdHurtVehicle(22 * (1 + D.realKm / 2400)); rdFloat(vx - L / 2, -30, '被落石砸中！', '#ef7d57'); }
            for (const m of R.mons) if (Math.abs(m.x - o.x) < 34) rdHitMon(m, 200, null); }
          if (o.fell) o.life -= dt;
          if (!o.fell && vx > o.x - 60 && vx - L < o.x + 40) D.note = '头顶要塌方了！刹车或冲刺躲开';
        }
      }
      D.objs = D.objs.filter((o) => !(o.k === 'cave' && o.fell && o.life <= 0));
      D.caveT -= dt; if (D.caveT <= 0 && D.t < D.dur - 8) { D.caveT = rdyRnd(16, 26); D.objs.push({ k: 'cave', x: vx + rdyRnd(150, 230), t: 3.2 }); }
    },
    drawBack(g, D, W, H, gy, day, scroll) {
      const T = rdyMineTiles(), lit = [];
      g.fillStyle = '#16110c'; g.fillRect(0, 0, W, gy);
      rdyBlit(g, T.back, scroll * 0.3, gy - 10, W, lit); rdyBlit(g, T.near, scroll * 0.6, gy - 12, W, lit); rdyBlit(g, T.floor, scroll, gy, W, lit);
      rdyFillBelow(g, T.floor, gy, W, H, '#3a2e22');
      rdsDrawLights(g, lit, day); RDS_LIT = lit;
    },
    drawObjs(g, D, gy) {
      const t = G.time;
      for (const o of D.objs) {
        const x = rdSX(o.x); if (x < -60 || x > RDV.W + 60) continue;
        if (o.k === 'ore') { rdyDraw(g, rdyOre(o.done ? 3 : o.kind), x, gy - 1); if (!o.done) { if (o.prog > 0) rdyBar(g, x, gy - 20, 16, o.prog, '#f0d070'); else if (Math.sin(t * 4 + o.x) > 0.6) { g.globalAlpha = 0.6; g.drawImage(rdsGlow(['#f0d070', '#8ae8f8', '#f09070'][o.kind]), x - 6, gy - 16, 12, 12); g.globalAlpha = 1; } } }
        else if (o.k === 'cart') { rdyDraw(g, rdyCart(), x, gy + 4); if (!o.done) rdyBar(g, x, gy - 20, 18, o.pushed / (3 * RD_PX_KM), '#e8a040'); }
        else if (o.k === 'cave') {
          if (!o.fell) { const a = 0.35 + Math.sin(t * 12) * 0.2; g.globalAlpha = a; for (let k = -34; k < 34; k += 4) { g.fillStyle = (k >> 2) & 1 ? '#e04a3a' : '#2a1a10'; g.fillRect(x + k, gy - 1, 4, 2); } g.globalAlpha = 1; g.fillStyle = '#d8c8a8'; for (let k = 0; k < 6; k++) { const p = (t * 1.5 + k / 6) % 1; g.fillRect(x - 30 + rdHash(k + o.x) * 60, (gy - 70) + p * 60, 0.67, 1); } rdyTextW(g, Math.ceil(o.t) + '', x, gy - 40); }
          else { g.fillStyle = '#5a4a3a'; for (let k = 0; k < 9; k++) { const rx = x - 30 + rdHash(k * 3 + o.x) * 60, rs = 3 + rdHash(k + o.x) * 4; g.fillRect(rx - rs / 2, gy - rs + 2, rs, rs); } }
        }
      }
    },
    hud(ctx, D) { drawText(ctx, '矿石 ' + D.ore + ' · 矿车 ' + D.carts, 10, G.sw < G.sh ? 160 : 122, 12, '#e8a040', 'left'); },
    bonus(D, tier, rewards) { if (D.ore > 0 && tier !== 'fail') { const n = rdGain('scrap', D.ore * 5); if (n) rewards.push({ res: 'scrap', n }); } },
  },
});
// 世界坐标里写一个小数字（塌方倒计时等）
function rdyTextW(g, s, x, y) { g.save(); g.font = 'bold 8px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 2; g.strokeStyle = '#24160f'; g.strokeText(s, x, y); g.fillStyle = '#ffd860'; g.fillText(s, x, y); g.restore(); }

// ================= 鬼城 =================
function rdyGhostTiles() {
  if (RDY_CACHE.ghost) return RDY_CACHE.ghost;
  const s = 133, TW = RDS_TW, slate = rdsR(['#4a5068', '#3a4058', '#2c3046', '#202434', '#161824']);
  // 远处：残破的城（窗户里零星发出青绿色的鬼火）
  const B = rdsPaper(260);
  let x = 0, i = 0;
  while (x < TW - 20) { const w = 40 + rdsRand(s, i) * 70, h = 70 + Math.pow(rdsRand(s, i + 50), 1.3) * 170; rdsBlock(B, Math.round(x), Math.round(w), Math.round(h), slate, s + i, { fh: 12, wx: 9, dark: 0x0c0e16, m: 2, lit: 0.07, antenna: true }); x += w + rdsRand(s, i + 90) * 26 - 4; i++; }
  for (const l of B.lights) { l.col = rdsRand(s, l.x) > 0.5 ? '#90ffc0' : '#c0a0ff'; l.kind = 'neon'; }
  rdsHaze(B, rdsC('#20263c'), 0.25, 0.4);
  const back = rdyLayer(B);
  // 中景：塌了一半的房子、歪路灯（闪烁）、枯树、矮墙
  const M = rdsPaper(210), P = Object.assign({}, RDS_PAL[1], { paint: [rdsR(['#6a7888', '#566272', '#424c5a', '#30383f']), rdsR(['#7a7064', '#62584e', '#4a423a', '#34302a']), rdsR(['#5e6a5a', '#4a5648', '#384236', '#262e24'])] });
  for (let k = 0; k < 4; k++) rdsHouse(M, (0.05 + k * 0.25 + rdsRand(s, 10 + k) * 0.06) * TW, 70 + rdsRand(s, 20 + k) * 40, 50 + rdsRand(s, 30 + k) * 30, s + k * 7, P);
  for (const l of M.lights) { l.col = '#a0ffc8'; l.kind = 'neon'; }
  for (let k = 0; k < 5; k++) rdsDeadTree(M, rdsRand(s, 40 + k) * TW, 90 + rdsRand(s, 45 + k) * 60, 4 + rdsRand(s, 48 + k) * 2, rdsR(['#5a5448', '#443e34', '#302c24', '#201c16']), s + k, { depth: 4, crow: 0.05, crowC: 0x14121a });
  for (let k = 0; k < 6; k++) { const lx = (k + 0.5) * 256 + rdsRand(s, 60 + k) * 30, bend = (rdsRand(s, 66 + k) - 0.5) * 16; rdsStroke(M, lx, 0, lx + bend, -84, 1.6, 1.3, rdsR(['#6a6a74', '#4e4e58', '#36363e']), 1, s + k); rdsStroke(M, lx + bend, -84, lx + bend + 12, -90, 1.2, 1, rdsR(['#6a6a74', '#4e4e58', '#36363e']), 1, s); rdsRect(M, lx + bend + 10, -90, 8, 4, 0x2a2a30, 1); rdsRect(M, lx + bend + 11, -86, 6, 2, 0xd8ffe8, 3); rdsLight(M, lx + bend + 14, -85, 'neon', '#c8ffe0', 8); }
  for (let k = 0; k < 8; k++) { const sx = rdsRand(s, 80 + k) * TW; rdsPoly(M, [[sx - 6, 0], [sx - 6, -16], [sx - 3, -20], [sx + 3, -20], [sx + 6, -16], [sx + 6, 0]], (px, py, t) => rdsPick(slate, 0.6 + t * 2 + (px > sx ? 0.8 : 0), px, py), 1); }
  rdsOutline(M, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  rdsHaze(M, rdsC('#262c44'), 0.1, 0.35);
  const mid = rdyLayer(M);
  // 路面：老石板街，积水映着月光
  const F = rdtPaper(TW, 75, 400), Gr = rdtRamp('#4a4c58');
  for (let x2 = 0; x2 < TW; x2++) for (let y = -42; y < 400; y++) { const k = (y + F.base) * TW + x2, cob = ((x2 + (Math.floor((y + 60) / 9) & 1) * 8) % 16 === 0) || ((y + 60) % 9 === 0); let v = 2 + (rdtN2(x2, y, 48, 20, s + 6) - 0.5) * 1.4 + (cob && y > -28 && y < 22 ? 1.2 : 0); const h = rdcHash(x2, y, s); if (h < 0.06) v += 0.7; F.c[k] = rdsPick(Gr, v + (y > 24 ? 0.6 : 0), x2, y); F.m[k] = 2; }
  for (let k = 0; k < 6; k++) rdtEllipse(F, rdsRand(s, 100 + k) * TW, -10 + rdsRand(s, 106 + k) * 26, 20 + rdsRand(s, 112 + k) * 24, 3, (px, py, d, nx, ny) => rdsPx(F, px, py, ny < -0.2 ? 0x8a9ab8 : (Math.abs(px % 9) < 2 ? 0xc8d4e8 : 0x3a4460), 2));
  rdtGroundBits(F, 1, Gr, s);
  const floor = rdyLayer(F);
  return (RDY_CACHE.ghost = { back, mid, floor });
}
function rdyLantern() { return rdySprite('lantern', 30, 40, 15, 30, (B) => { rdcRect(B, -1, -30, 2, 4, '#3a3430', 2); rdcPoly(B, [[-6, -26], [6, -26], [8, -14], [6, -4], [-6, -4], [-8, -14]], ['#fff0c0', '#ffc860', '#e08a30', '#a85a1a'], 4); for (const y of [-20, -12]) rdcRect(B, -7, y, 14, 1, '#a85a1a', 4); rdcRect(B, -4, -4, 8, 3, '#3a3430', 2); rdcLine(B, 0, -1, 0, 4, '#c8a060', 2); }); }
function rdyGate() { return rdySprite('gate', 140, 140, 70, 128, (B) => { for (const x of [-46, 34]) rdcBox(B, x, -110, 14, 110, ['#7a7488', '#5e586c', '#444052', '#2e2a38'], 2, 0, 1); rdcPoly(B, [[-50, -110], [0, -126], [50, -110], [50, -100], [-50, -100]], ['#7a7488', '#5e586c', '#444052'], 2); for (let y = -96; y < 0; y += 2) for (let x = -32; x < 34; x++) if ((x + y) % 7 === 0) rdcPix(B, x, y, '#c8ffe8', 3); rdcRect(B, -6, -120, 12, 8, '#ffe8a0', 4); }); }
Object.assign(RDN_BUILD, {
  ghost(B, fr, atk) { const lean = atk ? 5 : 0; for (let y = -30; y < 0; y++) { const u = (y + 30) / 30, hw = 6 + u * 5, cx = lean * (1 - u) + Math.sin(u * 4 + fr * 1.6) * 1.5; for (let x = -hw; x <= hw; x++) { if (y > -5 && (Math.floor((x + fr * 2 + 20) / 3) % 2)) continue; rdcPix(B, Math.round(cx + x), y, rdcRampAt(['#f4fcff', '#d0e4ec', '#a0b8c8', '#7890a4'], 0.1 + Math.abs(x) / hw * 0.4 + u * 0.3, x, y), 3); } }
    rdnBlob(B, lean + 1, -34, 7, 7, ['#f4fcff', '#d0e4ec', '#a0b8c8'], 3); for (const ex of [-2, 3]) { rdcRect(B, lean + ex, -36, 2, 3, '#14201a', 3); rdcPix(B, lean + ex, -35, '#a0ffd0', 4); } rdcRect(B, lean, atk ? -31 : -30, 2, atk ? 3 : 1, '#14201a', 3); },
  banshee(B, fr, atk) { for (let y = -44; y < 0; y++) { const u = (y + 44) / 44, hw = 4 + u * 9, cx = Math.sin(u * 5 + fr * 1.5) * 2; for (let x = -hw; x <= hw; x++) { if (y > -6 && (Math.floor((x + fr * 3 + 30) / 3) % 2)) continue; rdcPix(B, Math.round(cx + x), y, rdcRampAt(['#f0e4ff', '#c8b0e8', '#9a80c0', '#6a5494'], 0.1 + Math.abs(x) / hw * 0.4 + u * 0.35, x, y), 3); } }
    for (let k = 0; k < 14; k++) rdcLine(B, -6 + k, -56, -10 + k - Math.round(Math.sin(fr + k) * 2), -30 + (k % 3) * 3, '#dcd0f0', 3);
    rdnBlob(B, 0, -50, 6, 7, ['#f8f0ff', '#d8c8f0', '#a890c8'], 3); for (const ex of [-3, 2]) rdcRect(B, ex, -52, 2, 2, '#2a1a3a', 3); rdcRect(B, -1, atk ? -48 : -47, 3, atk ? 4 : 1, '#2a1a3a', 3);
    rdnLimb(B, 6, -38, 14, atk ? -50 : -26, 2, ['#e8dcff', '#c8b0e8', '#9a80c0']); },
});
Object.assign(RDX_THEMES, {
  ghost: {
    name: '鬼城', dur: 210, color: '#90ffc0', hour: 0.3, biomes: [1, 2, 3], npcGoal: 1.0,
    desc: ['一座永远是午夜的废城，雾里飘着幽灵', '幽灵只有被车灯照到时才吃满伤害', '收集路上的魂灯；冲出城门、撑到天亮'],
    goals: '冲出城门（+300）、收集魂灯（每盏 +30）、撑到天亮',
    pool: ['ghost', 'banshee', 'ghoul', 'ghost'], waveGap: [6, 9], hpMul: 0.85, dmgMul: 0.33,
    slots: ['in'], partFilter: (p) => p.slot === 'in' && ['decor', 'fun', 'life'].includes(p.kind),
    res: { gold: { food: 20, water: 20, med: 6, scrap: 30 }, silver: { food: 12, water: 12, med: 3 }, bronze: { food: 8, water: 8 }, fail: { food: 3 } },
    enter(D) { const X = (d) => (D.baseKm + d) * RD_PX_KM; for (let d = 5; d < 150; d += rdyRnd(4, 7)) D.objs.push({ k: 'lantern', x: X(d), y: -18 - Math.random() * 20 }); D.gateX = X(110); D.objs.push({ k: 'gate', x: D.gateX }); D.lan = 0; D.h0 = G.road.t; },
    tick(D, dt) {
      const R = G.road, vx = rdVehX(); R.t = D.h0 + D.t / D.dur * 5.3; D.note = '';
      for (const o of D.objs) {
        if (o.k === 'lantern' && !o.got && vx > o.x && vx - rdVeh().len < o.x + 6) { o.got = true; D.goal += 30; D.lan++; rdFloat(o.x, o.y - 6, '魂灯 +30', '#ffd890'); sfx('coin'); }
        if (o.k === 'gate' && !o.passed) { if (vx > o.x) { o.passed = true; D.goal += 300; showBanner('冲出城门！', '+300 分，再撑到天亮', 3, '#90ffc0'); rcSys('【副本播报】' + rcC().me + ' 冲出了城门！', 0.3); sfx('win'); } else if (o.x - vx < 600) D.note = '城门就在前面——冲过去！'; }
      }
      if (D.t > D.dur - 20 && !D.dawnSaid) { D.dawnSaid = true; showBanner('天快亮了', '再撑 20 秒', 2.5, '#ffcd75'); }
    },
    drawBack(g, D, W, H, gy, day, scroll) {
      const T = rdyGhostTiles(), lit = [], p = D.t / D.dur, dawn = Math.max(0, (p - 0.72) / 0.28);
      const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, rdMix('#070914', '#2a2a48', dawn)); gr.addColorStop(1, rdMix('#1c2238', '#c07a68', dawn)); g.fillStyle = gr; g.fillRect(0, 0, W, gy);
      g.globalAlpha = 1 - dawn; for (let k = 0; k < 60; k++) { g.fillStyle = '#e8ecff'; g.fillRect(Math.round(rdHash(k) * W), Math.round(rdHash(k + 9) * gy * 0.6), 1 / RD_Q * 2, 1 / RD_Q * 2); } g.globalAlpha = 1;
      const mx = W * 0.78, my = gy * 0.22 + dawn * gy * 0.4; g.globalAlpha = 0.4; g.drawImage(rdsGlow('#c8d8ff'), mx - 40, my - 40, 80, 80); g.globalAlpha = 1; rdkCircle(g, mx, my, 12, '#e8ecf4'); g.fillStyle = '#c8ccd8'; g.fillRect(mx - 4, my - 3, 3, 3); g.fillRect(mx + 3, my + 2, 2, 2);
      rdyBlit(g, T.back, scroll * 0.12, gy - 12, W, lit); rdyBlit(g, T.mid, scroll * 0.4, gy - 12, W, lit); rdyBlit(g, T.floor, scroll, gy, W, lit);
      rdyFillBelow(g, T.floor, gy, W, H, '#202230');
      rdsDrawLights(g, lit, day); RDS_LIT = lit;
    },
    ambient(g, D, W, H, gy) { const t = G.time; for (let k = 0; k < 5; k++) { const x = ((rdHash(k) * W * 2 - t * 6 - rdVehX() * 0.5) % (W + 160) + W + 160) % (W + 160) - 80; g.globalAlpha = 0.18; g.drawImage(rdsGlow('#c8d0e0'), x - 80, gy - 30 + k * 4, 160, 26); } g.globalAlpha = 1; for (let k = 0; k < 14; k++) { const p = (t * 0.2 + k / 14) % 1, x = (rdHash(k * 3) * W + Math.sin(t + k) * 10); g.globalAlpha = (1 - p) * 0.7; g.fillStyle = '#a0ffd0'; g.fillRect(x, gy - 10 - p * 60, 1, 1); } g.globalAlpha = 1; },
    drawObjs(g, D, gy) {
      const t = G.time;
      for (const o of D.objs) {
        const x = rdSX(o.x); if (x < -80 || x > RDV.W + 80) continue;
        if (o.k === 'lantern' && !o.got) { const y = gy + o.y + Math.sin(t * 2 + o.x) * 2; g.globalAlpha = 0.5; g.drawImage(rdsGlow('#ffc860'), x - 8, y - 18, 16, 16); g.globalAlpha = 1; rdyDraw(g, rdyLantern(), x, y); RDS_LIT.push({ x, y: y - 6, r: 9, a2: 0.8, kind: 'glow' }); }
        if (o.k === 'gate') { rdyDraw(g, rdyGate(), x, gy - 8); if (!o.passed) { g.globalAlpha = 0.25 + Math.sin(t * 3) * 0.1; g.drawImage(rdsGlow('#90ffc0'), x - 30, gy - 50, 60, 50); g.globalAlpha = 1; } }
      }
    },
    hud(ctx, D) { drawText(ctx, '魂灯 ' + D.lan + (D.objs.find((o) => o.k === 'gate').passed ? ' · 已冲出城门' : ' · 城门还有 ' + Math.max(0, (D.gateX - rdVehX()) / RD_PX_KM).toFixed(0) + ' 公里'), 10, G.sw < G.sh ? 160 : 122, 12, '#90ffc0', 'left'); },
    bonus(D, tier) { if (tier !== 'fail') G.road.me.mood = Math.min(100, G.road.me.mood + 10 + D.lan); },
  },
});

// ================= 军阀基地 =================
function rdyFortTiles() {
  if (RDY_CACHE.fort) return RDY_CACHE.fort;
  const s = 211, TW = RDS_TW, Rs = RDT_RUST, Cn = rdsR(['#a49a88', '#847a6a', '#665e50', '#4a4438', '#302c24']), Wd = rdsR(['#a88060', '#866042', '#64462c', '#44301c']);
  // 后面：废铁皮 + 水泥的堡垒高墙，墙头尖刺，瞭望塔，挂着「扳手齿轮」旗，火盆
  const B = rdsPaper(260);
  for (let x = 0; x < TW; x++) { const sheet = Math.floor(x / 34), hh = 150 + Math.round(rdcHash(sheet, 0, s) * 16), conc = sheet % 5 === 2; for (let y = -hh; y < 12; y++) { const i = (y + B.base) * TW + x; const R = conc ? Cn : sheet % 3 ? Rs : rdsR(['#7a8088', '#5c6268', '#42484e', '#2c3036']); let v = 1.2 + (conc ? 0 : [-0.4, 0, 0.5, 0.9][(x - sheet * 34) % 4]) + (y < -hh + 3 ? -0.8 : 0) + (rdtN2(x, y, 16, 8, s) > 0.7 ? 0.9 : 0) + (rdcHash(x, y, s) < 0.05 ? 0.6 : 0); B.c[i] = rdsPick(R, v, x, y); B.m[i] = 1; }
    if (x % 10 === 0) for (let k = 0; k < 12; k++) rdsPx(B, x + (k > 6 ? 1 : 0), -hh - k, 0x8a867c, 1);}
  for (let k = 0; k < 3; k++) { const tx = k * 512 + 140; for (const d of [-14, 14]) rdsLine(B, tx + d, 0, tx + d * 0.6, -230, Wd[2], 1); for (let y = -40; y > -220; y -= 30) { rdsLine(B, tx - 14, y, tx + 10, y - 30, Wd[3], 1); rdsLine(B, tx + 14, y, tx - 10, y - 30, Wd[3], 1); } rdsRect(B, tx - 22, -238, 44, 6, Wd[1], 1); for (let x = tx - 22; x < tx + 22; x += 6) rdsRect(B, x, -252, 2, 14, Wd[2], 1); rdsPoly(B, [[tx - 26, -252], [tx, -268], [tx + 26, -252]], Rs[1], 1); rdsRect(B, tx + 8, -250, 8, 5, 0x3a3430, 1); rdsLight(B, tx + 14, -248, 'blink', '#fff4c0', 5); }
  for (let k = 0; k < 4; k++) { const fx2 = k * 384 + 300, fy = -120; rdsLine(B, fx2, fy, fx2, fy + 70, 0x3a3430, 1); for (let x = 0; x < 40; x++) for (let y = 0; y < 26; y++) { const wave = Math.round(Math.sin(x / 6) * 2); rdsPx(B, fx2 + 1 + x, fy + y + wave, y < 2 ? 0x2a1a14 : 0xa83a2a, 1); } const cx = fx2 + 21, cy = fy + 13; for (let a = 0; a < 16; a++) rdsPx(B, cx + Math.round(Math.cos(a / 16 * 6.283) * 6), cy + Math.round(Math.sin(a / 16 * 6.283) * 6), 0xe8d8b0, 1); rdsLine(B, cx - 8, cy - 8, cx + 8, cy + 8, 0xe8d8b0, 1); rdsLine(B, cx + 8, cy - 8, cx - 8, cy + 8, 0xe8d8b0, 1); }
  for (let k = 0; k < 5; k++) { const bx = rdsRand(s, 30 + k) * TW; rdsCol(B, bx, 0, -20, 14, Rs, s + k, { bands: 6 }); for (let j = 0; j < 6; j++) rdsPx(B, bx - 4 + j * 1.6, -22 - (j % 3) * 2, [0xfff0a0, 0xffb040, 0xe05a20][j % 3], 3); rdsLight(B, bx, -24, 'glow', '#ff9040', 8); }
  rdsOutline(B, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  rdsHaze(B, rdsC('#c0704a'), 0.12, 0.2);
  const back = rdyLayer(B);
  // 中景：沙袋墙、带刺铁丝、废车、轮胎堆
  const M = rdsPaper(150);
  for (let k = 0; k < 8; k++) { const x = rdsRand(s, 50 + k) * TW, t = k % 4;
    if (t === 0) { for (let r = 0; r < 3; r++) for (let b = 0; b < 5 - r; b++) rdtEllipse(M, x + b * 12 + r * 6, -5 - r * 8, 7, 4.5, (px, py, d, nx, ny) => rdsPx(M, px, py, rdsPick(rdsR(['#d4c08e', '#b8a070', '#968052', '#6e5c3a']), 1 + nx * 0.6 + ny + (d > 0.8 ? 0.8 : 0), px, py), 1)); }
    else if (t === 1) { for (let j = 0; j < 90; j++) { const a = j * 0.5; rdsPx(M, x + j, -14 + Math.round(Math.sin(a) * 6), 0x6a665e, 2); rdsPx(M, x + j + Math.round(Math.cos(a) * 2), -14 + Math.round(Math.cos(a) * 6), 0x9a968c, 2); } for (const px of [x, x + 45, x + 90]) rdsRect(M, px, -26, 2, 26, Wd[2], 1); }
    else if (t === 2) { rdsPoly(M, [[x, -4], [x + 4, -14], [x + 16, -15], [x + 24, -26], [x + 44, -26], [x + 52, -14], [x + 64, -12], [x + 64, -4]], (px, py, tt) => rdsPick(Rs, 0.4 + tt * 2.4 + (rdcHash(px, py, s) < 0.08 ? 0.8 : 0), px, py), 1); for (const wx of [x + 14, x + 52]) rdtEllipse(M, wx, -4, 6, 4, (px, py, d) => rdsPx(M, px, py, d > 0.4 ? 0x2a221c : 0x6e6458, 1)); }
    else { for (let r = 0; r < 4; r++) rdtEllipse(M, x, -4 - r * 7, 11, 3.6, (px, py, d) => rdsPx(M, px, py, d < 0.3 ? 0x3e3630 : rdsPick(rdsR(['#4a423c', '#36302a', '#26201c']), 1 + d, px, py), 1)); } }
  rdsOutline(M, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  const mid = rdyLayer(M);
  // 地面：压实的土场，车辙、油渍
  const F = rdtPaper(TW, 75, 400), Gr = rdtRamp('#9a7854');
  for (let x = 0; x < TW; x++) for (let y = -42; y < 400; y++) { const i = (y + F.base) * TW + x; let v = 2 + (rdtN2(x, y, 48, 20, s + 6) - 0.5) * 1.5 + ((Math.abs(y + 14) < 3 || Math.abs(y - 12) < 3) && rdcHash(x >> 2, y, s) < 0.6 ? 0.6 : 0); const h = rdcHash(x, y, s + 8); if (h < 0.07) v += 0.8; else if (h > 0.95) v -= 0.8; F.c[i] = rdsPick(Gr, v + (y > 30 ? 0.4 : 0), x, y); F.m[i] = 2; }
  for (let k = 0; k < 8; k++) rdtEllipse(F, rdsRand(s, 70 + k) * TW, -16 + rdsRand(s, 78 + k) * 30, 10 + rdsRand(s, 86 + k) * 16, 3, (px, py, d) => rdsPx(F, px, py, d < 0.5 ? 0x2a2420 : 0x4a3e34, 2));
  rdtGroundBits(F, 0, Gr, s);
  const floor = rdyLayer(F);
  return (RDY_CACHE.fort = { back, mid, floor });
}
Object.assign(RDN_BUILD, {
  raider(B, fr, atk) { const sw = [-3, 0, 3, 0][fr], L = ['#6a5a48', '#4e4234', '#362e24'], S = ['#c8906a', '#a86e4e', '#7e4e34'];
    rdnLimb(B, -2, -16, -2 + sw, 0, 4, L); rdnLimb(B, 2, -16, 2 - sw, 0, 4, L);
    rdcPoly(B, [[-6, -32], [6, -32], [7, -16], [-7, -16]], ['#8a5a3a', '#6a4028', '#4a2c1a'], 1); for (let k = 0; k < 3; k++) rdcPix(B, -5 + k * 5, -33, '#d8d0c0', 1); rdcRect(B, -6, -18, 13, 2, '#2a2018', 1);
    rdnBlob(B, 1, -38, 5, 5, S); for (let y = -45; y < -40; y++) rdcPix(B, 1, y, '#e04a3a', 1); rdcRect(B, 2, -40, 4, 1, '#1a1410', 1); rdnEye(B, 4, -39, '#ffcd75', 1);
    const ay = atk ? -46 : -24; rdnLimb(B, 4, -30, 10, ay + 8, 3, S); rdcLine(B, 10, ay + 8, atk ? 14 : 16, ay - (atk ? 8 : -6), '#8a6a4a', 1); rdcLine(B, 11, ay + 8, atk ? 15 : 17, ay - (atk ? 8 : -6), '#6a4a2a', 1); for (let k = 0; k < 3; k++) rdcPix(B, (atk ? 13 : 15) + k % 2, ay - (atk ? 6 : -4) + k * 2, '#c8c4bc', 1); },
  gunner(B, fr, atk) { const sw = [-3, 0, 3, 0][fr], L = ['#5a6040', '#424830', '#2e3220']; rdnLimb(B, -2, -16, -2 + sw, 0, 4, L); rdnLimb(B, 2, -16, 2 - sw, 0, 4, L);
    rdcPoly(B, [[-6, -32], [6, -32], [7, -16], [-7, -16]], ['#6a7048', '#50563a', '#3a3e28'], 1); rdcRect(B, -6, -28, 13, 6, '#3a3e28', 1);
    rdnBlob(B, 1, -38, 5, 5, ['#c8906a', '#a86e4e', '#7e4e34']); rdnBlob(B, 1, -41, 6, 4, ['#6a7048', '#50563a', '#3a3e28']); rdcRect(B, 2, -39, 4, 2, '#1a1410', 1);
    rdcRect(B, 2, -29, 16, 3, '#3a3632', 1); rdcRect(B, -2, -28, 5, 4, '#6a4a2a', 1); if (atk) rdcRect(B, 18, -29, 3, 3, '#fff0a0', 4); },
  gate(B) { for (let x = -32; x < 34; x++) { const plank = Math.floor((x + 32) / 8), top = -116 + Math.round(rdcHash(plank, 0, 3) * 10); for (let y = top; y < 0; y++) rdcPix(B, x, y, plank % 3 === 1 ? rdcRampAt(['#8a8478', '#6a645e', '#4a443e'], ((x + 32) % 8) / 8 + y / 400, x, y) : rdcRampAt(['#a8805a', '#866040', '#64462c', '#44301c'], ((x + 32) % 8) / 8 * 0.6 + 0.2 + (rdcHash(x, y, 2) < 0.06 ? 0.3 : 0), x, y), 2); if ((x + 32) % 8 === 3) for (let k = 0; k < 12; k++) rdcPix(B, x, top - k, '#a8a49a', 2); }
    for (const y of [-90, -40]) { rdcRect(B, -34, y, 68, 6, '#4a443e', 2); for (let x = -30; x < 32; x += 8) rdgRiv(B, x, y + 2); } rdcLine(B, -30, -86, 30, -44, '#4a443e', 2); rdcLine(B, -30, -85, 30, -43, '#6a645e', 2);
    for (let a = 0; a < 20; a++) rdcPix(B, Math.round(Math.cos(a / 20 * 6.283) * 9), -66 + Math.round(Math.sin(a / 20 * 6.283) * 9), '#e04a3a', 2); rdcLine(B, -10, -76, 10, -56, '#e04a3a', 2); rdcLine(B, 10, -76, -10, -56, '#e04a3a', 2); },
  warlord(B, fr, atk) { const sw = [-5, 0, 5, 0][fr], Ar = ['#8a8a94', '#6a6a74', '#4c4c56', '#32323a'];
    rdcPoly(B, [[-22, -80], [-30, -10], [-10, -20]], ['#8a2a20', '#6a1e16', '#4a140e'], 1); // 披风
    rdnLimb(B, -8, -36, -8 + sw, 0, 9, Ar); rdnLimb(B, 8, -36, 8 - sw, 0, 9, Ar); rdcRect(B, -14 + sw, -4, 14, 4, '#2a2a30', 1); rdcRect(B, 2 - sw, -4, 14, 4, '#2a2a30', 1);
    rdnBlob(B, 0, -58, 20, 24, Ar); for (let y = -76; y < -40; y += 7) rdcLine(B, -16, y, 16, y, Ar[3], 1); for (const [x, y] of [[-12, -70], [10, -70], [-14, -50], [12, -50]]) rdgRiv(B, x, y);
    rdnBlob(B, -18, -74, 9, 7, Ar); rdnBlob(B, 18, -74, 9, 7, Ar); for (let k = 0; k < 3; k++) { rdcPoly(B, [[-24 + k * 5, -80], [-22 + k * 5, -90], [-20 + k * 5, -80]], '#c8c4bc', 2); rdcPoly(B, [[14 + k * 5, -80], [16 + k * 5, -90], [18 + k * 5, -80]], '#c8c4bc', 2); }
    rdnBlob(B, 2, -88, 9, 9, ['#a8a8b0', '#7a7a84', '#54545e']); rdcRect(B, -4, -90, 14, 3, '#1a1a20', 2); rdcRect(B, 0, -89, 3, 1, '#e04a3a', 4); rdcRect(B, 5, -89, 3, 1, '#e04a3a', 4); for (let x = -4; x < 10; x += 2) rdcPix(B, x, -82, '#3a3a42', 2);
    const ay = atk ? -96 : -60; rdgTube(B, 18, 40, ay + 18, 5, ['#6a6a74', '#4c4c56', '#32323a']); rdcRect(B, 38, ay + 13, 5, 10, '#2a2a30', 2); if (atk) rdcRect(B, 43, ay + 15, 4, 6, '#ffd860', 4);
    rdnLimb(B, -16, -66, -24, -36, 7, Ar); rdnBlob(B, -24, -34, 6, 6, Ar); },
});
Object.assign(RDX_THEMES, {
  fort: {
    name: '军阀基地', dur: 240, color: '#ef7d57', hour: 18.4, biomes: [2, 3, 4], npcGoal: 2.0,
    desc: ['铁颅军阀的废铁堡垒，墙头架着探照灯', '先轰开大门，再顶住打手和枪手', '最后军阀亲自上场：三个阶段，小心火箭弹'],
    goals: '轰开大门（+120）、打倒军阀（+400）、杀敌、活到最后',
    pool: ['raider', 'gunner', 'raider', 'dog'], waveGap: [7, 10], hpMul: 0.65, dmgMul: 0.26,
    slots: ['weapon', 'hand'], res: { gold: { ammo: 80, scrap: 40, med: 4 }, silver: { ammo: 45, scrap: 20 }, bronze: { ammo: 25 }, fail: { ammo: 8 } },
    enter(D) { const R = G.road; D.gateM = rdxMon('gate', (D.baseKm + 9) * RD_PX_KM); D.bossT = 110; D.marks = []; },
    tick(D, dt) {
      const R = G.road, vx = rdVehX(), L = rdVeh().len; D.note = '';
      if (D.gateM && (D.gateM.dead || D.gateM.hp <= 0)) { D.gateM = null; showBanner('大门被轰开了！', '+120 分，冲进去', 2.5, '#ef7d57'); rcSys('【副本播报】' + rcC().me + ' 轰开了堡垒大门！', 0.3); }
      // 军阀登场
      if (!D.boss && !D.bossDone && D.t > D.bossT) { D.boss = rdxMon('warlord', vx + 230); D.boss.ph0 = 1; showBanner('铁颅军阀登场！', '三个阶段：召唤打手 → 火箭弹齐射 → 狂暴', 3.5, '#e04a3a'); rcSys('【副本播报】铁颅军阀亲自出手了！', 0.3); sfx('bad'); }
      const b = D.boss;
      if (b) {
        if (b.dead || b.hp <= 0) { D.boss = null; D.bossDone = true; D.done = true; D.doneT = D.t; showBanner('军阀倒下了！', '+400 分', 3, '#ffcd75'); rcSys('【副本播报】铁颅军阀被打倒了！', 0.3); sfx('win'); }
        else {
          const f = b.hp / b.max, ph = f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
          if (ph !== b.ph0) { b.ph0 = ph; showBanner(ph === 2 ? '军阀架起火箭炮！' : '军阀狂暴了！', ph === 2 ? '地上出现红圈就快躲开（刹车 / 冲刺）' : '速度和伤害都变高了', 2.5, '#e04a3a'); }
          b.sumT = (b.sumT || 8) - dt; if (ph === 1 && b.sumT <= 0) { b.sumT = 15; for (let k = 0; k < 2; k++) rdxMon('raider', b.x + 20 + k * 12); }
          if (ph === 2) { b.spd = 0; b.rkT = (b.rkT || 3) - dt; if (b.rkT <= 0) { b.rkT = 6; for (let k = 0; k < 3; k++) D.marks.push({ x: vx - L / 2 + (k - 1) * 46 + (Math.random() - 0.5) * 20, t: 1.7 }); } }
          if (ph === 3 && !b.rage) { b.rage = true; b.spd = RD_MONSTERS.warlord.spd * 1.7; b.dmg *= 1.4; }
          D.note = '军阀 ' + Math.ceil(f * 100) + '%';
        }
      }
      for (const mk of D.marks) { mk.t -= dt; if (mk.t <= 0 && !mk.hit) { mk.hit = true; R.fx.push({ kind: 'boom', x: mk.x, y: -6, r: 16, life: 0.4, max: 0.4 }); G.shake = 0.25; if (Math.abs(mk.x - (vx - L / 2)) < L / 2 + 14 && !D.out) rdHurtVehicle(18 * (1 + D.realKm / 2400)); } }
      D.marks = D.marks.filter((mk) => mk.t > -0.5);
      if (D.gateM && D.gateM.x - vx < 300 && !D.note) D.note = '前面是堡垒大门：顶上去按「冲刺」猛撞';
    },
    drawBack(g, D, W, H, gy, day, scroll) {
      const T = rdyFortTiles(), lit = [];
      const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, '#3a2a4a'); gr.addColorStop(0.6, '#a85a4a'); gr.addColorStop(1, '#f0a060'); g.fillStyle = gr; g.fillRect(0, 0, W, gy);
      rdkCircle(g, W * 0.25, gy * 0.7, 10, '#ffb070'); g.globalAlpha = 0.4; g.drawImage(rdsGlow('#ff9050'), W * 0.25 - 40, gy * 0.7 - 40, 80, 80); g.globalAlpha = 1;
      rdyBlit(g, T.back, scroll * 0.2, gy - 12, W, lit); rdyBlit(g, T.mid, scroll * 0.55, gy - 12, W, lit); rdyBlit(g, T.floor, scroll, gy, W, lit);
      rdyFillBelow(g, T.floor, gy, W, H, '#5a442e');
      // 探照灯光柱扫来扫去
      for (let k = 0; k < 3; k++) { const tw = RDS_TW / RD_Q, x = ((k * 512 + 154) / RD_Q - scroll * 0.2) % tw; for (const xx of [x, x + tw, x - tw]) { if (xx < -60 || xx > W + 60) continue; const a = Math.sin(G.time * 0.6 + k * 2) * 0.7 + 1.9, y0 = gy - 12 - 248 / RD_Q; g.globalAlpha = 0.12; g.fillStyle = '#fff4c8'; g.beginPath(); g.moveTo(xx, y0); g.lineTo(xx + Math.cos(a) * 160 - 10, y0 + Math.sin(a) * 160); g.lineTo(xx + Math.cos(a) * 160 + 10, y0 + Math.sin(a) * 160); g.fill(); g.globalAlpha = 1; } }
      rdsDrawLights(g, lit, day); RDS_LIT = lit;
    },
    ambient(g, D, W, H, gy) { const t = G.time; for (let k = 0; k < 20; k++) { const p = (t * 0.4 + k / 20) % 1; g.globalAlpha = (1 - p) * 0.8; g.fillStyle = k % 3 ? '#ffb040' : '#ff6a30'; g.fillRect((rdHash(k) * W + t * 10) % W, gy - 20 - p * 80, 1 / RD_Q * 2, 1 / RD_Q * 2); } g.globalAlpha = 1; },
    drawObjs(g, D, gy) { const t = G.time; for (const mk of D.marks || []) { const x = rdSX(mk.x); if (mk.t > 0) { g.globalAlpha = 0.4 + Math.sin(t * 20) * 0.25; g.strokeStyle = '#e04a3a'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, gy + 4, 14, 4, 0, 0, 7); g.stroke(); g.globalAlpha = 1; const fy = gy - 60 + (1.7 - mk.t) / 1.7 * 60; g.fillStyle = '#c8c4bc'; g.fillRect(x - 1, fy - 3, 2, 4); g.fillStyle = '#ff9040'; g.fillRect(x - 0.67, fy - 5, 1.33, 2); } } },
    hud(ctx, D) {
      const b = D.boss, sw = G.sw;
      if (b) { const w = Math.min(320, sw - 40), x = sw / 2 - w / 2, y = G.sw < G.sh ? 186 : 136; rdxPanel(ctx, x, y, w, 24, '#e04a3a'); ctx.fillStyle = '#2a0e0a'; ctx.fillRect(x + 6, y + 13, w - 12, 6); ctx.fillStyle = b.rage ? (Math.floor(G.time * 6) % 2 ? '#ff4a3a' : '#c02a1a') : '#e04a3a'; ctx.fillRect(x + 6, y + 13, (w - 12) * Math.max(0, b.hp / b.max), 6); drawText(ctx, '铁颅军阀' + (b.rage ? '（狂暴）' : ''), sw / 2, y + 7, 11, '#ffcd75', 'center'); }
      drawText(ctx, (D.gateM ? '大门未破' : '大门已破') + (D.bossDone ? ' · 军阀已倒' : D.boss ? '' : ' · 军阀 ' + Math.max(0, Math.ceil(D.bossT - D.t)) + ' 秒后登场'), 10, G.sw < G.sh ? 160 : 122, 12, '#ef7d57', 'left');
    },
  },
});

// ================= 外星人基地 =================
function rdyAlienTiles() {
  if (RDY_CACHE.abase) return RDY_CACHE.abase;
  const s = 307, TW = RDS_TW, P = RDS_PAL[5], Mt = rdsR(['#8a84a8', '#6a6488', '#4e486a', '#36324c', '#24203a']);
  // 后面：发光的外星尖塔和有机塔楼
  const B = rdsPaper(270);
  rdsTerrain(B, (x) => 20 + rdsN(x, 10, s) * 30, rdsR(['#3a2a5a', '#2e2048', '#221838']), { seed: s });
  for (let k = 0; k < 9; k++) rdsSpire(B, rdsRand(s, k) * TW, 120 + rdsRand(s, k + 9) * 130, 18 + rdsRand(s, k + 19) * 16, (rdsRand(s, k + 29) - 0.5) * 50, rdsR(['#5a4a88', '#463872', '#342a5a', '#241c40']), P.glow, s + k, 2);
  for (let k = 0; k < 4; k++) { const x = rdsRand(s, 40 + k) * TW, h = 150 + rdsRand(s, 44 + k) * 60; for (let y = -h; y < 0; y++) { const u = (y + h) / h, hw = 10 + Math.sin(u * 3.14) * 18; for (let dx = -hw; dx <= hw; dx++) rdsPx(B, x + dx, y, (Math.abs(dx) < 1.5 && (y % 9 < 5)) ? P.glow : rdsPick(rdsR(['#4a3a78', '#382a60', '#281e48']), 0.5 + dx / hw + u * 0.6, x + dx, y), Math.abs(dx) < 1.5 && y % 9 < 5 ? 3 : 2); } rdsLight(B, x, -h + 10, 'glow', '#73eff7', 8); }
  rdsHaze(B, rdsC('#2a1e48'), 0.2, 0.3);
  const back = rdyLayer(B);
  // 中景：能量导管、外星路灯塔、水晶、坠毁的船体残片
  const M = rdsPaper(170);
  for (let x = 0; x < TW; x++) for (let k = 0; k < 2; k++) { const y = -20 - k * 10 + Math.round(Math.sin(x / 80 + k) * 3); rdsPx(M, x, y, Mt[1], 1); rdsPx(M, x, y + 1, Mt[2], 1); rdsPx(M, x, y + 2, Mt[3], 1); if ((x + k * 40) % 64 < 6) rdsPx(M, x, y + 1, P.glow, 3); }
  for (let k = 0; k < 6; k++) { const x = (k + 0.5) * 256; rdsRect(M, x - 3, -110, 6, 110, Mt[2], 1); rdsRect(M, x - 2, -110, 1, 110, Mt[0], 1); rdtEllipse(M, x, -116, 10, 6, (px, py, d) => rdsPx(M, px, py, d < 0.35 ? 0xd8fdff : rdsPick(Mt, 1 + d, px, py), d < 0.35 ? 3 : 1)); rdsLight(M, x, -116, 'glow', '#73eff7', 10); }
  for (let k = 0; k < 7; k++) { const x = rdsRand(s, 60 + k) * TW; for (let c = 0; c < 3; c++) rdsCrystal(M, x + c * 7, 0, 14 + rdsRand(s, 70 + k * 3 + c) * 26, -Math.PI / 2 + (c - 1) * 0.35, 6, c === 1 ? P.pink : P.cry, s + k * 3 + c); }
  rdsOutline(M, rdsC(RDC_PAL.out), rdsC(RDC_PAL.out2));
  const mid = rdyLayer(M);
  // 地面：金属地板，板缝里流着青光
  const F = rdtPaper(TW, 75, 400);
  for (let x = 0; x < TW; x++) for (let y = -42; y < 400; y++) { const i = (y + F.base) * TW + x, seam = x % 64 === 0 || (y + 42) % 18 === 0; let v = 1.6 + (rdtN2(x, y, 64, 24, s) - 0.5) * 0.8 + (y > 30 ? 0.7 : 0) + (rdcHash(x, y, s) < 0.05 ? 0.5 : 0); if (seam) { F.c[i] = (x + y) % 40 < 14 && y > -30 && y < 26 ? P.glow : Mt[4]; F.m[i] = (x + y) % 40 < 14 && y > -30 && y < 26 ? 3 : 2; continue; } F.c[i] = rdsPick(Mt, v, x, y); F.m[i] = 2; }
  const floor = rdyLayer(F);
  return (RDY_CACHE.abase = { back, mid, floor });
}
function rdyCannon() { return rdySprite('doom', 300, 260, 150, 250, (B) => { const Mt = ['#6a6488', '#4e486a', '#36324c', '#24203a']; rdcPoly(B, [[-110, 0], [-70, -80], [70, -80], [110, 0]], Mt, 2); rdcPoly(B, [[-40, -80], [40, -80], [26, -170], [-26, -170]], Mt, 2); for (let k = 0; k < 6; k++) rdcLine(B, -30 + k * 12, -84, -20 + k * 8, -166, '#73eff7', 4); rdcPoly(B, [[-20, -170], [20, -170], [70, -236], [40, -246], [-6, -186]], Mt, 2); rdgBall(B, 0, -176, 18, ['#e0fcff', '#73eff7', '#2a7aa0'], 4); for (let k = 0; k < 4; k++) rdcPoly(B, [[-100 + k * 60, 0], [-90 + k * 60, -40], [-80 + k * 60, 0]], Mt, 2); }); }
Object.assign(RDN_BUILD, {
  core(B, fr) { const Mt = ['#8a84a8', '#6a6488', '#4e486a', '#36324c']; rdcPoly(B, [[-22, 0], [-14, -14], [14, -14], [22, 0]], Mt, 2); for (const x of [-12, 9]) rdcBox(B, x, -110, 4, 96, Mt, 2, 0, 1); rdcBox(B, -14, -116, 28, 6, Mt, 2, 0, 1);
    for (let y = -100; y < -20; y++) for (let x = -8; x <= 8; x++) { const d = Math.abs(x) / 8; rdcPix(B, x, y, d < 0.3 ? '#e8fdff' : d < 0.7 ? '#73eff7' : '#2a7aa0', 4); }
    for (let k = 0; k < 4; k++) { const y = -90 + k * 20 + ((fr * 5) % 20); rdcRect(B, -11, y, 22, 2, '#c8fcff', 4); } },
  adrone(B, fr, atk) { rdcPoly(B, [[-16, -12], [16, -12], [10, -6], [-10, -6]], ['#a89cc8', '#7a6a98', '#54486e'], 2); rdgBall(B, 0, -14, 6, ['#9a8ab8', '#6a5a88', '#463a60']); rdcRect(B, -2, -15, 5, 3, atk ? '#ff6a6a' : '#73eff7', 4); for (const x of [-12, 12]) rdcRect(B, x - 2, -6, 4, 2, fr % 2 ? '#73eff7' : '#2a7aa0', 4); },
});
Object.assign(RDX_THEMES, {
  abase: {
    name: '外星人基地', dur: 240, color: '#73eff7', hour: 21.5, biomes: [4, 5], npcGoal: 2.3,
    desc: ['外星人在这里造了一门「灭星炮」，正在充能', '路上有 4 个能量核心挡路——全部打爆才能阻止它', '核心每隔几秒开一次护盾（几乎打不动），抓住护盾关掉的时候'],
    goals: '摧毁能量核心（每个 +150）、全部摧毁阻止发射（+300）、杀敌、活到最后',
    pool: ['crawler', 'adrone', 'sentinel', 'adrone', 'crawler'], waveGap: [6, 9], hpMul: 0.75, dmgMul: 0.38,
    slots: ['space', 'chassis'], partFilter: (p) => p.alien || p.tier >= 5,
    res: { gold: { alien: 12, power: 40, scrap: 30 }, silver: { alien: 6, power: 20 }, bronze: { alien: 3, power: 10 }, fail: { alien: 1 } },
    rewardMul: (D) => (D.saved ? 1 : 0.5),
    enter(D) { D.cores = [10, 30, 50, 70].map((d, i) => rdxMon('core', (D.baseKm + d) * RD_PX_KM, { sPh: i * 1.5 })); D.saved = false; },
    tick(D, dt) {
      const left = D.cores.filter((c) => !c.dead && c.hp > 0); D.note = '';
      for (const c of left) { const p = (D.t + c.sPh) % 6; c.shieldUp = p < 2; if (c.x - rdVehX() < 260) D.note = c.shieldUp ? '核心开着护盾！等护盾关掉' : '护盾关了——快打！'; }
      if (!left.length && !D.saved) { D.saved = true; D.goal += 300; D.done = true; D.doneT = D.t; G.shake = 0.8; showBanner('灭星炮被摧毁了！', '+300 分，大家得救了', 3.5, '#73eff7'); rcSys('【副本播报】' + rcC().me + ' 打爆了最后一个能量核心，灭星炮瘫痪了！', 0.3); sfx('win'); }
      if (D.t > D.dur - 0.2 && !D.saved && !D.fired) { D.fired = true; G.shake = 1; showBanner('灭星炮发射了……', '没能阻止它，奖励减半', 3, '#ef7d57'); rcSys('【副本播报】灭星炮发射了！整个区域被光吞没……', 0.3); }
    },
    drawBack(g, D, W, H, gy, day, scroll) {
      const T = rdyAlienTiles(), lit = [], ch = Math.min(1, D.t / D.dur);
      const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, '#0e0820'); gr.addColorStop(1, rdMix('#3a2058', '#7a3a8a', ch)); g.fillStyle = gr; g.fillRect(0, 0, W, gy);
      for (let k = 0; k < 50; k++) { g.fillStyle = k % 5 ? '#d8d0ff' : '#73eff7'; g.fillRect(Math.round(rdHash(k * 2) * W), Math.round(rdHash(k + 30) * gy * 0.6), 1 / RD_Q * 2, 1 / RD_Q * 2); }
      // 灭星炮（很远，几乎不动）：越接近发射越亮，炮口往天上打一道越来越粗的光
      const cx = W * 0.72 - (scroll * 0.03) % 60, cy = gy - 14; if (!D.saved) { g.globalAlpha = 0.25 + ch * 0.6; g.fillStyle = '#73eff7'; const bw = 1 + ch * 6; g.fillRect(cx + 16 - bw / 2, 0, bw, cy - 80); g.globalAlpha = 1; }
      g.globalAlpha = 0.85; rdyDraw(g, rdyCannon(), cx, cy); g.globalAlpha = 1;
      g.globalAlpha = D.saved ? 0.1 : 0.4 + ch * 0.5 + Math.sin(G.time * (3 + ch * 10)) * 0.1; g.drawImage(rdsGlow('#73eff7'), cx - 30, cy - 90, 60, 60); g.globalAlpha = 1;
      rdyBlit(g, T.back, scroll * 0.15, gy - 12, W, lit); rdyBlit(g, T.mid, scroll * 0.5, gy - 12, W, lit); rdyBlit(g, T.floor, scroll, gy, W, lit);
      rdyFillBelow(g, T.floor, gy, W, H, '#1e1a30');
      if (D.fired) { const p = Math.max(0, 1 - (D.t - D.dur) / 1); g.fillStyle = 'rgba(220,255,255,' + (0.8 * p) + ')'; g.fillRect(0, 0, W, H); }
      rdsDrawLights(g, lit, day); RDS_LIT = lit;
    },
    ambient(g, D, W, H, gy) { const t = G.time; for (let k = 0; k < 24; k++) { const p = (t * 0.25 + k / 24) % 1; g.globalAlpha = (1 - p) * 0.6; g.fillStyle = k % 3 ? '#73eff7' : '#f070ff'; g.fillRect((rdHash(k) * W + Math.sin(t + k) * 6) % W, gy - p * 90, 1, 1); } g.globalAlpha = 1; },
    drawObjs(g, D, gy) { for (const c of D.cores || []) { if (c.dead || c.hp <= 0) continue; const x = rdSX(c.x); if (x < -60 || x > RDV.W + 60) continue; RDS_LIT.push({ x, y: gy - 20, r: 14, a2: 0.9, kind: 'glow' }); if (c.shieldUp) { g.globalAlpha = 0.35 + Math.sin(G.time * 10) * 0.1; g.strokeStyle = '#a8f8ff'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, gy - 20, 14, 24, 0, 0, 7); g.stroke(); g.globalAlpha = 0.12; g.fillStyle = '#73eff7'; g.fill(); g.globalAlpha = 1; } } },
    hud(ctx, D) { const left = (D.cores || []).filter((c) => !c.dead && c.hp > 0).length; drawText(ctx, '能量核心剩 ' + left + ' / 4 · 灭星炮充能 ' + Math.min(100, Math.round(D.t / D.dur * 100)) + '%', 10, G.sw < G.sh ? 160 : 122, 12, '#73eff7', 'left'); },
  },
});
