// =============================================
//  公路求生：画面（横版）
//  先画到一张低分辨率画布上（像素风），再整体放大到屏幕
//  坐标：x 向右，y 向上为负；地面 y = 0
// =============================================
let RDV = null; // 画面缓存：{ buf, g, S, W, H, gy(路面所在行), ax(车头所在列) }

function rdHash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function rdNoise(x) { const i = Math.floor(x), f = x - i, a = rdHash(i), b = rdHash(i + 1); return a + (b - a) * (f * f * (3 - 2 * f)); }
function rdMix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), g2 = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) + (r << 16) + (g2 << 8) + bl).toString(16).slice(1);
}
function rdShade(c, k) { return k > 0 ? rdMix(c, '#f4f4f4', k) : rdMix(c, '#1a1c2c', -k); }

// 画面精细度：1 个「世界像素」= RD_Q × RD_Q 个精细像素。
// 世界坐标（车长、怪物位置、碰撞）不变；新画的车直接画在精细像素上，细节多 3 倍
const RD_Q = 3;
// 画布尺寸：竖屏时镜头拉近，车占屏幕宽度约三分之一；1 个精细像素 = 整数个屏幕像素（像素才不会忽粗忽细）
function rdSetupView() {
  const cw = G.canvas.width, ch = G.canvas.height, portrait = G.sw < G.sh;
  // 车内画面单独定镜头：车厢至少要占满大约半个屏幕宽（竖屏时也看得清）
  const inside = G.road && G.road.view === 'in';
  const ideal = inside ? Math.min(cw / (portrait ? 125 : 230), ch / (portrait ? 230 : 110)) : Math.min(cw / (portrait ? 150 : 270), ch / (portrait ? 230 : 150));
  let F = ideal / RD_Q;
  // 高清屏（手机）上屏幕像素很细，允许 0.5 档，镜头能拉得更合适；普通屏只用整数档
  const step = G.dpr >= 2 ? 0.5 : 1;
  F = F >= step * 0.75 ? Math.max(step, Math.round(F / step) * step) : Math.max(0.4, F);
  const S = F * RD_Q;
  const W = Math.ceil(cw / S), H = Math.ceil(ch / S);
  if (!RDV || RDV.W !== W || RDV.H !== H) {
    const buf = createCanvas(W * RD_Q, H * RD_Q), light = createCanvas(W * RD_Q, H * RD_Q);
    RDV = { buf, g: buf.getContext('2d'), light, lg: light.getContext('2d'), W, H };
  }
  RDV.S = S;
  RDV.gy = Math.round(G.sh * (portrait ? 0.5 : 0.66) * G.dpr / S);
  RDV.ax = Math.round(W * (portrait ? 0.62 : 0.5));
  return RDV;
}
// 世界坐标 → 画布列
function rdSX(wx) { return RDV.ax + (wx - rdVehX()) + (RDV.shakeX || 0); }
// 画布坐标 → 屏幕坐标（css 像素）
function rdToScreen(x, y) { return { x: x * RDV.S / G.dpr, y: y * RDV.S / G.dpr }; }

// 白天亮度：0 夜 1 昼
function rdDaylight() {
  const h = rdHour();
  if (h >= 7 && h < 18) return 1;
  if (h >= 20 || h < 5) return 0;
  if (h < 7) return (h - 5) / 2;
  return 1 - (h - 18) / 2;
}

function rdRender(ctx) {
  const R = G.road;
  if (!R) return;
  const V = rdSetupView(), g = V.g;
  V.shakeX = G.shake > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;
  g.setTransform(RD_Q, 0, 0, RD_Q, 0, 0);
  g.imageSmoothingEnabled = false;
  if (R.view === 'in') rdDrawInterior(g);
  else rdDrawWorld(g);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(V.buf, 0, 0, V.W * V.S, V.H * V.S);
  rdDrawUI(ctx);
}

// ================= 车外：公路 =================
function rdDrawWorld(g) {
  const R = G.road, V = RDV, W = V.W, H = V.H, gy = V.gy;
  const b = rdBiomeAt(R.km), bi = rdBiomeIndex(R.km);
  // 两个地区之间渐变
  const into = (R.km % RD_BIOME_LEN) / RD_BIOME_LEN;
  const prev = RD_BIOMES[(bi + RD_BIOMES.length - 1) % RD_BIOMES.length];
  const blend = rdkBlend(R.km);
  const col = (k, i) => blend > 0 ? rdMix((Array.isArray(b[k]) ? b[k][i] : b[k]), (Array.isArray(prev[k]) ? prev[k][i] : prev[k]), blend) : (Array.isArray(b[k]) ? b[k][i] : b[k]);
  const day = rdDaylight();
  const scroll = rdVehX();
  // ---- 天空（js/roadsky.js：渐变、太阳月亮、星星、云、极光、闪电） ----
  const h = rdHour(), dusk = (h > 16.5 && h < 20) ? Math.max(0, 1 - Math.abs(h - 18.5) / 1.6) : (h > 4.5 && h < 7.5) ? Math.max(0, 1 - Math.abs(h - 6) / 1.4) : 0;
  const themed = rdxBack(g, W, H, gy, day, dusk, scroll); // 副本主题自己画背景和路面（js/roaddunthemes.js）
  if (!themed) rdkSky(g, W, gy, b, prev, blend, day, dusk, h);
  const dim = (c) => rdMix(c, '#10121f', (1 - day) * 0.7);
  // ---- 远景 + 中景（每个地区三层精细像素风景，见 js/roadscape.js） ----
  if (!themed) rdsDrawScenery(g, bi, (bi + RD_BIOMES.length - 1) % RD_BIOMES.length, blend, scroll, gy, day, dusk);
  // ---- 近景 + 路面 + 护栏也在上面一起画了（js/roadstreet.js）；长条图下面不够的地方补地面色 ----
  const ground = dim(col('ground', 0));
  g.fillStyle = rdShade(ground, -0.3); g.fillRect(0, gy + Math.floor(RDT_DOWN / RD_Q) - 1, W, H);
  rdxObjs(g, gy); // 副本里的目标物（矿点、矿车、灯笼、核心……）
  // ---- 建筑 ----
  for (const s of R.sites) rdDrawSite(g, s, gy, dim, day);
  // ---- 路障 ----
  for (const o of R.obs) if (!o.hit) rdtDrawObstacle(g, o, gy);
  // ---- 车 + 怪物 + 人 ----
  const mons = (R.mons || []).slice().sort((a, b2) => (RD_MONSTERS[a.type].fly ? 1 : 0) - (RD_MONSTERS[b2.type].fly ? 1 : 0));
  rdpxGround(g, gy); // 地上的岩浆裂谷（js/roadvfx.js）
  for (const m of mons) if (!RD_MONSTERS[m.type].fly) rdDrawMonster(g, m, gy);
  rdDrawVehicle(g, V.ax + (V.shakeX || 0), gy + 4, { world: true });
  if (R.me.loc === 'out') rdhPerson(g, rdSX(R.me.wx), gy + 3, { pose: (R.search && R.search.phase !== 'in') ? 'walk' : 'stand', face: R.me.face, outside: true, swing: R.me.swing > 0 });
  if (R.pet && R.me.loc === 'out') rdhPet(g, rdSX(R.me.wx) - R.me.face * 8, gy + 3, R.pet.type, true, R.me.face); // 精细像素主角和宠物（js/roadhero.js）
  for (const m of mons) if (RD_MONSTERS[m.type].fly) rdDrawMonster(g, m, gy);
  // ---- 子弹、特效 ----
  rdgProj(g, gy); // 子弹、光束、爆炸（js/roadguns.js）
  rdpxOver(g, gy); // 着火怪物身上的火焰龙卷风（js/roadvfx.js）
  // ---- 前景：路肩碎石 + 近处的杂物（比路面滚得快一点，有纵深感） ----
  rdDrawForeground(g, b, scroll, gy, W, H, ground, dim);
  // ---- 天气 ----
  rdkWeather(g, W, H, gy, day, b, bi);
  // ---- 夜晚（车灯照亮） ----
  rdDrawNight(g, day, gy);
  rdkBeam(g, gy, day);
  // ---- 整体色调（地区、黄昏、闪电、暗角） ----
  rdkGrade(g, W, H, gy, bi, (bi + RD_BIOMES.length - 1) % RD_BIOMES.length, blend, day, dusk);
  // 怪物血条
  for (const m of R.mons || []) { const M = RD_MONSTERS[m.type]; if (m.hp < m.max && m.hp > 0) { const x = Math.round(rdSX(m.x) - M.w / 2), y = Math.round(gy + (M.fly ? m.y : 0) - M.h - 4); g.fillStyle = '#1a1c2c'; g.fillRect(x, y, M.w, 2); g.fillStyle = '#b13e53'; g.fillRect(x, y, Math.max(1, Math.round(M.w * m.hp / m.max)), 2); } }
}

function rdDrawForeground(g, b, scroll, gy, W, H, ground, dim) {
  // 前景杂物（视差 1.3，见 js/roadstreet.js）
  const R = G.road, bi = rdBiomeIndex(R.km), into = (R.km % RD_BIOME_LEN) / RD_BIOME_LEN;
  if (!(R.dun && RDX_THEMES[R.dun.id].drawBack)) rdtDrawFront(g, bi, (bi + RD_BIOMES.length - 1) % RD_BIOMES.length, rdkBlend(R.km), scroll, gy);
  // 越往下越暗
  const gr = g.createLinearGradient(0, gy + 12, 0, H);
  gr.addColorStop(0, 'rgba(10,10,25,0)'); gr.addColorStop(1, 'rgba(10,10,25,0.45)');
  g.fillStyle = gr; g.fillRect(0, gy + 12, W, H - gy);
}

// ---------- 路边建筑 ----------
function rdDrawSite(g, s, gy, dim, day) {
  // 建筑本身在 js/roadsites.js 里画（和远景一起，在护栏后面）；这里只画搜索进度条
  const R = G.road;
  if (!(R.search && R.search.site === s && (R.search.phase === 'in' || R.search.phase === 'arm'))) return;
  const S = RD_SITES[s.type], x = Math.round(rdSX(s.km * RD_PX_KM)), top = gy - 13 - S.h, p = R.search.t / R.search.dur;
  g.fillStyle = '#1a1c2c'; g.fillRect(x - 15, top - 14, 30, 4); g.fillStyle = '#ffcd75'; g.fillRect(x - 14, top - 13, Math.round(28 * p), 2);
}


// ---------- 怪物 ----------
function rdDrawMonster(g, m, gy) {
  if (rdnHas(m.type)) { rdnDraw(g, m, gy); return; } // 精细像素怪物（js/roadmons.js）
  const M = RD_MONSTERS[m.type], x = Math.round(rdSX(m.x)), y = Math.round(gy + (M.fly ? m.y : 0) + (M.fly ? 0 : 3) + (m.lunge > 0 ? -2 : 0));
  if (x < -40 || x > RDV.W + 40) return;
  const f = m.face, c = m.hitT > 0 ? '#f4f4f4' : M.color, gl = M.glow, t = m.ph;
  const P = (dx, dy, w, h, col) => { g.fillStyle = col; g.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  if (!M.fly) { g.fillStyle = 'rgba(10,10,25,0.3)'; g.fillRect(x - M.w / 2, gy + 3, M.w, 1); }
  const leg = Math.sin(t * 14) > 0 ? 1 : 0;
  if (m.type === 'roach') { P(-4, -3, 8, 3, c); P(-3, -4, 5, 1, rdShade(c, 0.2)); P(4, -3, 1, 1, gl); P(-3 + leg, -1, 1, 1, '#1a1c2c'); P(1 - leg, -1, 1, 1, '#1a1c2c'); P(5, -4, 2, 1, c); }
  else if (m.type === 'dog') { P(-7, -7, 11, 4, c); P(3, -9, 5, 4, c); P(6, -8, 2, 1, gl); P(7, -6, 2, 1, '#f4f4f4'); P(-6 + leg, -3, 2, 3, c); P(2 - leg, -3, 2, 3, c); P(-9, -8, 2, 2, c); P(-4, -9, 3, 2, '#b13e53'); }
  else if (m.type === 'ghoul') { P(-2, -15, 5, 4, c); P(1, -14, 1, 1, gl); P(-3, -11, 6, 6, rdShade(c, -0.2)); P(2, -10, 4, 1, c); P(4, -10, 1, 3, c); P(-2 + leg, -5, 2, 5, rdShade(c, -0.35)); P(1 - leg, -5, 2, 5, rdShade(c, -0.35)); P(-3, -9, 2, 2, '#b13e53'); }
  else if (m.type === 'vulture') { const wf = Math.sin(t * 12) * 3; P(-5, -4, 10, 4, c); P(4, -6, 3, 3, '#b13e53'); P(7, -5, 2, 1, '#ffcd75'); P(-4, -4 - Math.max(0, wf), 7, 2 + Math.abs(wf), rdShade(c, -0.2)); P(-7, -3, 2, 2, c); }
  else if (m.type === 'worm') { for (let k = 0; k < 5; k++) P(-8 + k * 4, -4 - Math.round(Math.sin(t * 4 + k) * 2) - (k === 4 ? 6 : 0), 4, 5, k % 2 ? c : rdShade(c, -0.15)); P(8, -11, 3, 3, '#1a1c2c'); P(9, -10, 2, 1, gl); }
  else if (m.type === 'spider') { P(-4, -7, 8, 5, c); P(3, -6, 3, 3, c); P(5, -6, 1, 1, gl); P(5, -4, 1, 1, gl); for (let k = 0; k < 4; k++) { const lg = (k + leg) % 2; P(-7 + k * 4, -4 + lg, 1, 4 - lg, c); P(-8 + k * 4, -5 + lg, 2, 1, c); } }
  else if (m.type === 'brute') { P(-7, -28, 12, 9, c); P(2, -26, 2, 2, gl); P(-10, -20, 18, 12, rdShade(c, -0.1)); P(-12, -20, 4, 12, c); P(7, -19, 5, 14, c); P(9, -6, 4, 3, rdShade(c, -0.3)); P(-6 + leg, -8, 5, 8, rdShade(c, -0.3)); P(1 - leg, -8, 5, 8, rdShade(c, -0.3)); g.globalAlpha = 0.5 + Math.sin(t * 3) * 0.3; P(-6, -16, 3, 3, gl); P(-1, -12, 2, 2, gl); g.globalAlpha = 1; }
  else if (m.type === 'wraith') { g.globalAlpha = 0.75; P(-4, -16, 8, 12, c); P(-5, -6, 10, 4, rdShade(c, -0.1)); P(1, -13, 2, 2, gl); P(-2, -13, 2, 2, gl); for (let k = 0; k < 5; k++) P(-5 + k * 2, -2 + Math.round(Math.sin(t * 6 + k)), 1, 2, c); g.globalAlpha = 1; }
  else if (m.type === 'crawler') { P(-8, -7, 16, 5, c); P(6, -9, 5, 5, rdShade(c, 0.2)); P(9, -8, 1, 1, gl); P(9, -6, 1, 1, gl); for (let k = 0; k < 5; k++) P(-7 + k * 3, -2 + ((k + leg) % 2), 1, 2, c); P(-10, -9, 3, 2, gl); P(-12, -11, 2, 2, gl); }
  else if (m.type === 'sentinel') { P(-6, -30, 12, 8, c); P(-1, -27, 5, 2, gl); P(-8, -22, 16, 14, rdShade(c, 0.15)); P(-9, -21, 2, 10, gl); P(6, -20, 7, 3, rdShade(c, 0.3)); P(12, -20, 2, 3, gl); P(-6 + leg, -8, 4, 8, c); P(2 - leg, -8, 4, 8, c); g.globalAlpha = 0.3 + Math.sin(t * 4) * 0.2; g.strokeStyle = gl; g.beginPath(); g.arc(x, y - 18, 16, 0, 7); g.stroke(); g.globalAlpha = 1; }
  if (m.burn > 0) { g.fillStyle = '#ef7d57'; g.fillRect(x - 2 + Math.round(Math.sin(G.time * 30) * 2), y - M.h, 2, 2); g.fillStyle = '#ffcd75'; g.fillRect(x + 1, y - M.h + 2, 1, 1); }
  if (m.slow > 0) { g.fillStyle = '#73eff7'; g.fillRect(x - 3, y - M.h - 2, 1, 1); g.fillRect(x + 2, y - M.h - 1, 1, 1); }
}

// ---------- 子弹、爆炸、粒子 ----------


// 夜晚：整体变暗，车灯和建筑的灯光照亮
function rdDrawNight(g, day, gy) {
  const dark = (1 - day) * 0.62 * (1 - RDK.flash * 0.7);
  if (dark <= 0.02) return;
  const V = RDV, lg = V.lg, R = G.road;
  lg.setTransform(RD_Q, 0, 0, RD_Q, 0, 0);
  lg.globalCompositeOperation = 'source-over';
  lg.clearRect(0, 0, V.W, V.H);
  lg.fillStyle = 'rgba(8,10,28,' + dark + ')';
  lg.fillRect(0, 0, V.W, V.H);
  lg.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const gr = lg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.beginPath(); lg.arc(x, y, r, 0, 7); lg.fill(); };
  const st = R.st || rdStats(), ax = V.ax;
  // 车灯光锥
  const reach = st.light ? 150 : 70;
  const gr = lg.createLinearGradient(ax, 0, ax + reach, 0); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  lg.fillStyle = gr; lg.beginPath(); lg.moveTo(ax, gy - 10); lg.lineTo(ax + reach, gy - 26); lg.lineTo(ax + reach, gy + 14); lg.lineTo(ax, gy - 4); lg.fill();
  hole(ax - rdVeh().len / 2, gy - 12, 40, 0.6);
  if (st.light) hole(ax - 10, gy - 40, 60, 0.4);
  if (R.me.loc === 'out') hole(rdSX(R.me.wx), gy - 6, 26, 0.7); // 手电筒
  for (const p of R.proj || []) if (p.kind === 'flame' || p.kind === 'plasma' || p.kind === 'rocket') hole(rdSX(p.x), gy + p.y, 12, 0.6);
  for (const f of R.fx || []) hole(rdSX(f.x), gy + f.y, (f.r || 10) * 2, 0.8);
  for (const m of R.mons || []) { const M = RD_MONSTERS[m.type]; hole(rdSX(m.x), gy + (M.fly ? m.y : -M.h / 2), 6, 0.35); } // 怪物身上的辐射荧光
  for (const s of R.sites) if (s.type === 'camp' || s.type === 'alien') hole(rdSX(s.km * RD_PX_KM), gy - 16, 40, 0.7);
  // 远景里的灯（窗户、红灯、荧光）：挖一个小亮点
  for (const l of RDS_LIT) if (l.a2 > 0.08) { lg.globalAlpha = Math.min(1, l.a2 * 0.7); const r = Math.min(8, l.r / RD_Q * 2.2); lg.drawImage(rdsGlow('#000000'), l.x - r, l.y - r, r * 2, r * 2); }
  lg.globalAlpha = 1;
  lg.globalCompositeOperation = 'source-over';
  g.drawImage(V.light, 0, 0, V.W, V.H);
}

// ================= 车辆（按改装件拼出来） =================
// x = 车头，y = 地面
function rdDrawVehicle(g, x0, y0, opt) {
  const R = G.road, v = rdVeh(), L = v.len, ext = R.ext;
  const part = (k) => ext[k] ? RD_PARTS[ext[k]] : null;
  const st = R.st || rdStats();
  const hover = st.hover;
  const moving = R.speedNow > 1;
  const fine = rdcHasCar(R.veh); // 已经重画成精细像素的车（js/roadcar.js）
  const bob = hover ? Math.round(-6 + Math.sin(G.time * 2.5) * 1.5) : (!fine && moving && Math.sin(G.time * 22) > 0.6 ? -1 : 0);
  const lift = (part('chassis') && !hover ? Math.min(3, part('chassis').tier) : 0);
  const x = Math.round(x0), y = Math.round(y0 + bob - lift);
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  const stealth = rdSum('stealth') >= 0.5;
  if (stealth) g.globalAlpha = 0.65 + Math.sin(G.time * 3) * 0.1;
  // 阴影
  if (!fine) { g.fillStyle = 'rgba(10,10,25,0.35)'; g.fillRect(x - L - 2, Math.round(y0) + (hover ? 2 : 0), L + 4, 2); }
  // 挂车
  const tr = part('trailer');
  if (tr) rdpTrailer(g, x - L - 4, y, tr, hover, moving); // 精细像素挂车（js/roadparts.js）
  // 反重力光
  if (hover && !fine) { g.globalAlpha = 0.35 + Math.sin(G.time * 6) * 0.15; g.fillStyle = part('chassis').id === 'chs6' ? '#c27bd6' : '#73eff7'; g.fillRect(x - L + 3, Math.round(y0) - 2, L - 6, 2); g.fillRect(x - L + 6, Math.round(y0) - 4, L - 12, 1); g.globalAlpha = stealth ? 0.7 : 1; }
  // 轮子
  const tire = part('tires');
  const wheels = v.tent ? [-4, -L + 4] : [-9, -L + 10];
  const fineWheels = fine && !hover; // 精细车的轮胎、履带、悬挂、悬浮都在 js/roadmods.js 里画
  if (!hover && !fineWheels) rdDrawWheels(g, x, y, wheels, tire, R.km, v);
  // 车身
  const col = v.color, dk = rdShade(col, -0.3), lt = rdShade(col, 0.25), glass = '#73b8d8';
  const hit = R.hitT > 0;
  let fineBob = 0;
  if (fine) {
    fineBob = rdcDrawCar(g, x, y, { moving, wheels: fineWheels, hit, driver: R.me.loc === 'drive' || (v.tent && R.driving), dust: opt.world && !hover, ground: rdBiomeAt(R.km).ground, fast: R.speedNow > 60,
      gy: y0, hover, tire: tire && tire.id, chs: part('chassis') && part('chassis').id, armor: part('armor'), ram: part('ram') });
    g.save(); g.translate(0, fineBob / RD_Q); // 车上的零件跟着车身一起颠
  } else if (R.veh === 'courier' || R.veh === 'icecream') {
    const ice = R.veh === 'icecream';
    P(-L + 2, -8, L - 4, 2, '#333c57'); // 底盘
    P(-L, -32, L - 14, 25, col); P(-L, -32, L - 14, 1, lt); P(-L, -8, L - 14, 1, dk); // 货厢
    if (ice) { P(-L, -34, L - 14, 3, lt); P(-L + 1, -35, L - 16, 1, lt); P(-L + 10, -26, 16, 10, '#1a1c2c'); P(-L + 11, -25, 14, 8, '#ffcd75'); for (let k = 0; k < 16; k += 4) P(-L + 10 + k, -29, 2, 3, '#b13e53'), P(-L + 12 + k, -29, 2, 3, '#f4f4f4'); P(-L + 6, -14, L - 24, 2, v.stripe); P(-L + 6, -40, 5, 6, '#ffcd75'); P(-L + 5, -45, 7, 5, '#f7b8d2'); P(-L + 7, -47, 3, 2, '#b13e53'); }
    else { P(-L, -18, L - 14, 3, v.stripe); P(-L + 4, -28, 10, 2, v.stripe); P(-L + 4, -25, 6, 1, v.stripe); P(-L, -32, 1, 25, dk); P(-L + 2, -30, 1, 20, dk); }
    P(-15, -25, 13, 18, col); P(-15, -25, 13, 1, lt); P(-5, -16, 5, 9, col); // 驾驶室 + 车头
    P(-6, -24, 4, 8, glass); P(-5, -24, 3, 1, '#f4f4f4'); P(-13, -23, 6, 6, glass); P(-14, -15, 1, 7, dk);
    P(-1, -14, 1, 2, '#ffcd75'); P(-2, -9, 3, 2, '#566c86'); P(-15, -9, 1, 2, '#b13e53');
  } else if (R.veh === 'garbage') {
    P(-L + 2, -8, L - 4, 3, '#333c57');
    P(-L, -34, L - 18, 27, col); P(-L, -34, L - 18, 1, lt); for (let k = 4; k < L - 20; k += 6) P(-L + k, -33, 1, 25, dk); // 压缩斗
    P(-L - 2, -30, 3, 20, dk); P(-L - 3, -12, 5, 2, '#566c86'); // 后斗口
    P(-L + 6, -22, L - 30, 3, v.stripe);
    P(-18, -30, 16, 23, col); P(-18, -30, 16, 1, lt); P(-4, -18, 4, 11, col);
    P(-8, -29, 5, 10, glass); P(-16, -28, 7, 8, glass); P(-7, -28, 4, 1, '#f4f4f4');
    P(-1, -15, 1, 2, '#ffcd75'); P(-3, -9, 4, 2, '#566c86'); P(-20, -38, 2, 9, '#566c86'); P(-21, -40, 4, 2, '#ffcd75'); // 警示灯
    if (G.road.driving) { P(-21, -40, 4, 2, Math.sin(G.time * 10) > 0 ? '#ef7d57' : '#ffcd75'); }
  } else if (R.veh === 'pickup') {
    P(-L + 2, -8, L - 4, 2, '#333c57');
    P(-L, -16, L - 18, 9, col); P(-L, -16, L - 18, 1, lt); P(-L, -18, 2, 11, dk); P(-21, -18, 2, 11, dk); // 后斗
    P(-20, -26, 13, 19, col); P(-20, -26, 13, 1, lt); P(-7, -16, 7, 9, col); P(-7, -16, 7, 1, lt);
    P(-11, -25, 4, 8, glass); P(-18, -24, 6, 6, glass); P(-10, -25, 3, 1, '#f4f4f4');
    P(-1, -14, 1, 2, '#ffcd75'); P(-2, -9, 3, 2, '#566c86'); P(-L, -12, L - 22, 1, v.stripe);
  } else if (R.veh === 'ebike') {
    P(-L + 2, -10, L - 4, 2, '#333c57'); P(-L + 4, -14, 12, 5, col); P(-L + 4, -14, 12, 1, lt); P(-8, -18, 2, 9, '#566c86'); P(-9, -19, 5, 1, '#1a1c2c'); P(-L + 1, -15, 7, 2, '#3a2a22'); P(-3, -14, 2, 2, '#ffcd75');
    P(-L + 6, -9, 8, 2, '#73eff7'); // 电池
    P(-L - 2, -16, 4, 6, '#a8794f'); // 后座储物箱
  }
  if (hit && !fine) { g.globalAlpha = 0.5; g.fillStyle = '#f4f4f4'; g.fillRect(x - L, y - 34, L, 28); g.globalAlpha = stealth ? 0.7 : 1; }
  // 车窗里的人影（停车、人在车里时）
  if (R.me.loc === 'drive' && !v.tent && !fine) { const hx = R.veh === 'garbage' ? -12 : R.veh === 'pickup' ? -15 : -11; const AL = avLook(); P(hx, -22, 3, 3, AV_SKIN[AL.skin]); P(hx, -23, 3, 1, AL.hc); }
  if (v.tent && !fine && (R.me.loc === 'drive' || R.driving)) rdDrawPerson(g, x - 10, y - 8, { pose: 'ride', face: 1 });
  if (v.tent && !v.pod && !R.driving && R.me.loc === 'in') rdDrawCamp(g, x - L - (tr ? 50 : 6), y); // 三轮车有货舱，不用搭帐篷
  // 外装甲
  const ar = part('armor');
  if (ar && !fine) rdDrawArmor(g, x, y, L, ar, v);
  // 前撞角
  const ram = part('ram');
  if (ram && !fine) rdDrawRam(g, x, y, ram);
  // 车顶高度、车身外挂、油箱、车顶（精细像素，js/roadparts.js）
  const roofY = fine && rdcCarRoof(R.veh) ? rdcCarRoof(R.veh) : R.veh === 'garbage' ? -34 : R.veh === 'pickup' ? -26 : v.tent ? -16 : fine ? -26 : -32;
  const ut = part('util');
  if (ut) rdpUtil(g, x, y, L, ut, v, roofY);
  const tk = part('tank');
  if (tk) rdpTank(g, x, y, L, tk, v);
  const rf = part('roof');
  if (rf) rdpRoof(g, x, y, L, rf, roofY);
  // 引擎特效：排气、火焰、光
  const en = part('engine');
  rdDrawEngineFx(g, x, y, L, en, moving, v);
  // 武器
  const ws = rdWeapons();
  ws.forEach((w) => {
    const mp = rdMountPos(w.i), gx = x + mp.x, gy = y + mp.y + (R.veh === 'pickup' && w.i < 2 ? 6 : 0) + (R.veh === 'garbage' ? -2 : 0);
    rdgDraw(g, gx, gy, w, 'w' + w.i, w.i); // 精细像素武器（js/roadguns.js）
  });
  // 空间核心：车门处的空间涟漪
  const sp = part('space');
  if (sp) { rdpSpace(g, x, y, L, sp); g.globalAlpha = stealth ? 0.7 : 1; }
  // 护盾
  if (R.shield > 1) { g.globalAlpha = 0.15 + 0.15 * (R.shield / Math.max(1, st.shieldMax)); g.strokeStyle = '#73eff7'; g.beginPath(); g.ellipse(x - L / 2, y - 16, L / 2 + 6, 22, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
  if (fine) g.restore();
  g.globalAlpha = 1;
}
function rdDrawWheels(g, x, y, list, tire, km, v) {
  const id = tire ? tire.id : '', track = id === 'tire8';
  const rad = v.tent ? 5 : id === 'tire11' ? 6 : 5;
  const rot = km * RD_PX_KM / rad;
  if (track) { g.fillStyle = '#1a1c2c'; g.fillRect(x + list[1] - 6, y - 10, list[0] - list[1] + 12, 10); g.fillStyle = '#566c86'; const o = Math.floor(rot * 2) % 3; for (let k = -6 + o; k < list[0] - list[1] + 6; k += 3) { g.fillRect(x + list[1] + k, y - 10, 1, 1); g.fillRect(x + list[1] + k, y - 1, 1, 1); } }
  for (const wx of list) {
    const cx = x + wx, cy = y - rad, r = wx === list[1] && id === 'tire11' ? 6 : rad;
    g.fillStyle = '#1a1c2c'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    if (id === 'tire3' || id === 'tire7' || id === 'tire11') { g.fillStyle = '#333c57'; for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; g.fillRect(Math.round(cx + Math.cos(a) * r - 0.5), Math.round(cy + Math.sin(a) * r - 0.5), 1, 1); } }
    if (id === 'tire6') { g.fillStyle = '#c8d6e5'; for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; g.fillRect(Math.round(cx + Math.cos(a) * (r + 1)), Math.round(cy + Math.sin(a) * (r + 1)), 1, 1); } }
    if (id === 'tire4') { g.fillStyle = '#94b0c2'; for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); } }
    const rim = id === 'tire9' ? '#b13e53' : id === 'tire10' ? '#73eff7' : '#94b0c2';
    g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, r * 0.45, 0, 7); g.fill();
    g.fillStyle = '#566c86'; g.fillRect(Math.round(cx + Math.cos(rot) * r * 0.4 - 0.5), Math.round(cy + Math.sin(rot) * r * 0.4 - 0.5), 1, 1);
  }
}
function rdDrawArmor(g, x, y, L, p, v) {
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  const top = v.tent ? -15 : -30, bot = v.tent ? -9 : -9, len = v.tent ? L - 6 : L - 4;
  const cols = { armor1: '#8f6a42', armor2: '#7a8a96', armor3: '#94b0c2', armor4: '#333c57', armor5: '#566c86', armor6: '#4a4e5c', armor7: '#c8d6e5', armor8: '#5a6a3a', armor9: '#4c5a36', armor10: '#3b4a5c', armor11: '#5d275d', armor12: '#73eff7', armor13: '#38b764', armor14: '#29366f' };
  const c = cols[p.id] || '#566c86';
  if (p.id === 'armor12') { g.globalAlpha = 0.3 + Math.sin(G.time * 4) * 0.1; g.strokeStyle = c; g.beginPath(); g.ellipse(x - L / 2, y - 18, L / 2 + 4, 20, 0, 0, 7); g.stroke(); g.globalAlpha = 1; return; }
  if (p.id === 'armor4') { for (let k = 0; k < 3; k++) { g.fillStyle = '#1a1c2c'; g.beginPath(); g.arc(x - L + 8 + k * 9, y + bot - 6, 4, 0, 7); g.fill(); g.fillStyle = '#333c57'; g.beginPath(); g.arc(x - L + 8 + k * 9, y + bot - 6, 2, 0, 7); g.fill(); } return; }
  if (p.id === 'armor5' || p.id === 'armor14') { g.fillStyle = '#94b0c2'; for (let k = 0; k < len; k += 4) { P(-L + 2 + k, top, 1, bot - top, '#566c86'); } for (let yy = top; yy < bot; yy += 4) P(-L + 2, yy, len, 1, '#566c86'); for (let k = 0; k < len; k += 6) P(-L + 3 + k, top - 2, 1, 2, '#c8d6e5'); return; }
  if (p.id === 'armor11') { for (let k = 0; k < len; k += 5) { g.fillStyle = k % 10 ? '#5d275d' : '#4b3378'; g.beginPath(); g.ellipse(x - L + 4 + k, y + top + 8 + (k % 3) * 4, 4, 6, 0, 0, 7); g.fill(); } g.globalAlpha = 0.5 + Math.sin(G.time * 2) * 0.3; P(-L + 8, top + 10, 1, 1, '#73eff7'); P(-L + 20, top + 14, 1, 1, '#73eff7'); P(-L + 30, top + 6, 1, 1, '#73eff7'); g.globalAlpha = 1; return; }
  if (p.id === 'armor2') { P(-L + 6, top + 6, 10, 14, c); P(-L + 7, top + 8, 4, 3, '#73b8d8'); P(-L + 14, top + 13, 2, 1, '#1a1c2c'); return; }
  if (p.id === 'armor13') { for (let k = 0; k < len - 4; k += 7) P(-L + 3 + k, top + 4 + (k % 14 ? 2 : 0), 6, 6, ['#38b764', '#3b5dc9', '#ffcd75', '#b13e53'][(k / 7) % 4]); return; }
  // 普通钢板：一块块铆接
  const plateH = Math.min(9, (bot - top) / 2), heavy = p.tier >= 4;
  for (let yy = top + 2; yy < bot - 1; yy += plateH + 1) for (let k = 0; k < len - 2; k += 9) {
    const w = Math.min(8, len - 2 - k);
    P(-L + 2 + k, yy, w, plateH, c); P(-L + 2 + k, yy, w, 1, rdShade(c, 0.2));
    g.fillStyle = rdShade(c, -0.35); g.fillRect(x - L + 3 + k, y + yy + 1, 1, 1); g.fillRect(x - L + k + w, y + yy + plateH - 2, 1, 1);
  }
  if (heavy) P(-17, -27, 12, 3, c); // 驾驶室上的护板
  if (p.id === 'armor1') { P(-L + 10, top + 5, 2, 2, '#b13e53'); P(-L + 22, top + 12, 3, 1, '#6e4a2e'); }
  if (p.id === 'armor10') { g.globalAlpha = 0.4; for (let k = 0; k < len; k += 4) P(-L + 2 + k, top + 2 + (k % 8), 2, 2, '#73eff7'); g.globalAlpha = 1; }
}
function rdDrawRam(g, x, y, p) {
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  const id = p.id;
  if (id === 'ram1') { P(0, -14, 3, 8, '#a8794f'); P(3, -12, 2, 4, '#8f6a42'); P(0, -14, 3, 1, '#c49a64'); }
  else if (id === 'ram2') { for (let k = 0; k < 8; k += 2) P(0, -15 + k, 4, 1, '#94b0c2'); P(3, -15, 1, 8, '#94b0c2'); }
  else if (id === 'ram3') { P(0, -13, 4, 2, '#c8d6e5'); P(0, -9, 4, 2, '#c8d6e5'); P(3, -13, 2, 6, '#94b0c2'); }
  else if (id === 'ram4' || id === 'ram8') { const big = id === 'ram8'; g.fillStyle = big ? '#ffcd75' : '#c9a86a'; g.beginPath(); g.moveTo(x + 1, y - (big ? 20 : 16)); g.lineTo(x + (big ? 9 : 6), y - 2); g.lineTo(x + 1, y - 4); g.fill(); P(1, -10, 3, 1, '#566c86'); if (big) for (let k = 0; k < 16; k += 4) P(2 + k / 4, -19 + k, 1, 2, '#1a1c2c'); }
  else if (id === 'ram5' || id === 'ram11') { P(0, -14, 3, 8, '#566c86'); for (let k = 0; k < 8; k += 2) P(3, -14 + k, 3 + (k % 4 ? 0 : 2), 1, '#c8d6e5'); }
  else if (id === 'ram6') { const a = G.time * 12; P(1, -14, 2, 9, '#566c86'); g.fillStyle = '#333c57'; g.beginPath(); g.arc(x + 5, y - 9, 4, 0, 7); g.fill(); g.fillStyle = '#c8d6e5'; for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; g.fillRect(Math.round(x + 5 + Math.cos(b) * 5), Math.round(y - 9 + Math.sin(b) * 5), 2, 1); } }
  else if (id === 'ram7') { P(0, -12, 4, 3, '#94b0c2'); const ext = R_RAMPOS(); P(4, -13, 3 + ext, 5, '#566c86'); P(7 + ext, -14, 2, 7, '#c8d6e5'); }
  else if (id === 'ram9') { P(0, -14, 3, 8, '#29366f'); g.fillStyle = '#73eff7'; for (let k = 0; k < 3; k++) if (Math.random() < 0.5) g.fillRect(x + 3 + Math.floor(Math.random() * 4), y - 14 + Math.floor(Math.random() * 8), 1, 1); P(3, -12, 2, 4, '#41a6f6'); }
  else if (id === 'ram10') { g.globalAlpha = 0.4 + Math.sin(G.time * 5) * 0.15; g.fillStyle = '#73eff7'; g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 12, y - 8); g.lineTo(x, y - 2); g.fill(); g.globalAlpha = 1; }
}
function R_RAMPOS() { return Math.sin(G.time * 6) > 0.8 ? 3 : 0; }
function rdDrawEngineFx(g, x, y, L, en, moving, v) {
  const R = G.road;
  if (!moving) return;
  const id = en ? en.id : '';
  if (id === 'eng4' || id === 'eng8' || v.electric && !en) { if (Math.random() < 0.3) rdSmoke(rdVehX() - L - 1, -6, '#73eff7'); return; }
  if (id === 'eng11' || id === 'eng12') { g.globalAlpha = 0.6; g.fillStyle = id === 'eng12' ? '#f4f4f4' : '#c27bd6'; g.fillRect(x - 6, y - 15, 3, 3); g.globalAlpha = 1; if (Math.random() < 0.4) rdSmoke(rdVehX() - L - 1, -6, id === 'eng12' ? '#73eff7' : '#c27bd6'); return; }
  if (id === 'eng10') { const f = 4 + Math.random() * 5; g.fillStyle = '#ef7d57'; g.fillRect(x - L - f, y - 14, f, 4); g.fillStyle = '#ffcd75'; g.fillRect(x - L - f * 0.6, y - 13, f * 0.6, 2); g.fillStyle = '#566c86'; g.fillRect(x - L - 1, y - 15, 2, 6); return; }
  if (id === 'eng6') { g.fillStyle = '#c8d6e5'; g.fillRect(x - 10, y - 18, 2, 3); g.fillRect(x - 13, y - 18, 2, 3); if (Math.random() < 0.15) { g.fillStyle = '#ef7d57'; g.fillRect(x - L - 3, y - 8, 2, 2); } }
  if (Math.random() < (id === 'eng1' ? 0.15 : 0.35)) rdSmoke(rdVehX() - L - 1, -7, id === 'eng5' ? '#a7f070' : '#566c86');
}
// 电单车停车时：帐篷 + 篝火
// x：营地右边（世界像素），帐篷在左、篝火在右；画成精细像素（js/roadcar.js 的 rdcTent / rdcCampfire）
function rdDrawCamp(g, x, y) {
  const Q = RD_Q, night = rdDaylight() < 0.5, fr = Math.floor(G.time * 10);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  rdcTent(g, Math.round((x - 34) * Q), Math.round(y * Q), 46, night);
  rdcCampfire(g, Math.round((x - 8) * Q), Math.round(y * Q), fr, night, 0.8);
  g.restore();
}

// ================= 人物 =================
// 主角：短发、夹克、背包；pose 决定姿势
function rdDrawPerson(g, x, y, o) {
  const R = G.road, f = o.face < 0 ? -1 : 1, t = G.time;
  x = Math.round(x); y = Math.round(y);
  const suit = R && R.suit ? RD_PARTS[R.suit] : null;
  // 主角用玩家设置的角色外观（js/avatar.js）；穿上防护服后上衣变成防护服的颜色
  const me = !o.tiny && !o.shirt, L = me ? avLook() : null;
  const suitC = suit && suit.id !== 'suit1' ? ({ suit2: '#ffcd75', suit3: '#333c57', suit4: '#ffcd75', suit5: '#b13e53', suit6: '#566c86', suit7: '#94b0c2', suit8: '#4c5a36', suit9: '#4b3378' })[suit.id] : null;
  const shirt = o.shirt || suitC || (L ? L.tc : suit ? '#6e4a2e' : '#3b5dc9');
  const skin = L ? AV_SKIN[L.skin] : '#f2d0a9', hair = L ? L.hc : '#3a2a22', pants = L ? L.bc : '#29366f';
  const longHair = L && ['long', 'bob', 'braid', 'twintail', 'ponytail'].includes(L.hair), skirt = L && !suitC && ['skirt', 'longskirt', 'qipao'].includes(L.bot);
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  const pose = o.pose || 'stand';
  if (R && R.me.hitT > 0 && o.outside) { P(-2, -13, 5, 13, '#f4f4f4'); return; }
  if (pose === 'lie') { // 躺着（睡觉）
    P(-6, -3, 3, 3, skin); P(-6, -4, 3, 1, hair); P(-3, -3, 9, 3, o.blanket || shirt); if (o.curl) { P(-3, -4, 5, 4, shirt); P(2, -3, 3, 3, pants); }
    return;
  }
  if (pose === 'sit' || pose === 'drive' || pose === 'sitfloor' || pose === 'hug' || pose === 'ride') {
    const low = pose === 'sitfloor' || pose === 'hug' ? 4 : 0;
    P(-1, -12 + low, 4, 4, skin); P(-1, -13 + low, 4, 2, hair); P(-2, -12 + low, 1, 3, hair);
    if (longHair) P(-2, -10 + low, 1, 3, hair);
    P(-1, -8 + low, 4, 5, shirt);
    if (pose === 'hug') { P(1, -6 + low, 3, 3, pants); P(2, -7 + low, 2, 2, skin); } // 抱膝
    else { P(0, -3 + low, 5, 2, pants); P(4, -3 + low, 1, 3, pants); P(4, 0 + low - 1, 2, 1, '#1a1c2c'); }
    if (pose === 'drive' || pose === 'ride') P(3, -7, 3, 1, skin); // 手握方向盘
    return;
  }
  // 站 / 走
  const walk = pose === 'walk' || pose === 'run';
  const sw = walk ? Math.round(Math.sin(t * (pose === 'run' ? 18 : 11)) * 1.5) : 0;
  const bob = walk && Math.sin(t * 22) > 0 ? -1 : 0;
  if (skirt) { P(-1 + sw, -3, 1, 3, skin); P(1 - sw, -3, 1, 3, skin); P(-2, -5 + bob, 5, 2, L.bot === 'qipao' ? shirt : pants); }
  else { P(-1 + sw, -4, 2, 4, pants); P(1 - sw, -4, 2, 4, rdShade(pants, -0.2)); }
  P(-2, -9 + bob, 5, 5, shirt); P(-3, -9 + bob, 1, 4, '#6e4a2e'); // 背包
  if (L && !suitC && L.t2 && ['jacket', 'labcoat', 'coat', 'suit', 'armor'].includes(L.top)) P(0, -9 + bob, 1, 4, L.t2); // 外套里面的衣服
  P(-1, -13 + bob, 4, 4, skin); P(-1, -14 + bob, 4, 2, hair); P(-2, -13 + bob, 1, 3, hair); P(2, -12 + bob, 1, 1, '#1a1c2c');
  if (longHair) P(-2, -11 + bob, 1, L.hair === 'bob' ? 2 : 4, hair); // 长发 / 马尾垂在脑后
  if (L && L.hair === 'ponytail') P(-3, -13 + bob, 1, 3, hair);
  if (L && (avHas(L, 'cap') || avHas(L, 'beret') || avHas(L, 'strawhat'))) { const hc = avHas(L, 'cap') || avHas(L, 'beret') || avHas(L, 'strawhat'); P(-1, -15 + bob, 4, 2, hc); P(2, -14 + bob, avHas(L, 'strawhat') ? 3 : 2, 1, hc); if (avHas(L, 'strawhat')) P(-3, -14 + bob, 2, 1, hc); }
  else if (L && (avHas(L, 'bandana') || avHas(L, 'headband'))) P(-1, -13 + bob, 4, 1, avHas(L, 'bandana') || avHas(L, 'headband'));
  if (L && (avHas(L, 'sunglasses') || avHas(L, 'visor'))) P(1, -12 + bob, 2, 1, avHas(L, 'visor') || '#1a1c2c');
  // 手上的东西
  const hold = o.hold;
  if (o.outside && R && R.hand) {
    const h = RD_PARTS[R.hand], melee = h.fx.range < 20;
    if (melee) { const up = o.swing ? -4 : 0; P(3, -10 + up + bob, 1, 6, '#94b0c2'); P(3, -11 + up + bob, 3, 2, '#c8d6e5'); }
    else { P(2, -8 + bob, 6, 2, '#333c57'); P(2, -7 + bob, 1, 2, '#333c57'); }
  } else if (hold === 'cup') P(3, -8 + bob, 2, 2, '#f4f4f4');
  else if (hold === 'mic') { P(3, -11, 1, 3, '#333c57'); P(3, -12, 2, 1, '#94b0c2'); }
  else if (hold === 'cue') { g.fillStyle = '#a8794f'; g.fillRect(f > 0 ? x + 2 : x - 9, y - 7, 8, 1); }
  else if (hold === 'can') { P(3, -7, 3, 2, '#38b764'); P(5, -6, 2, 1, '#41a6f6'); }
  else if (hold === 'brush') P(3, -10, 1, 4, '#ef7d57');
  else if (hold === 'arms') P(-2, -10 + bob, 7, 1, skin);
  else if (hold === 'bar') { P(-3, -14 + Math.round(Math.sin(t * 4) * 2), 8, 1, '#566c86'); }
  if (o.tiny) return;
}
function rdDrawPet(g, x, y, type, walking, face) {
  x = Math.round(x); y = Math.round(y);
  const f = face < 0 ? -1 : 1, P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(f > 0 ? x + dx : x - dx - w, y + dy, w, h); };
  const c = type === 'cat' ? '#ef7d57' : '#c9a86a', leg = walking && Math.sin(G.time * 14) > 0 ? 1 : 0;
  P(-3, -4, 6, 3, c); P(2, -6, 3, 3, c); P(4, -5, 1, 1, '#1a1c2c');
  if (type === 'cat') { P(2, -7, 1, 1, c); P(4, -7, 1, 1, c); P(-5, -6, 1, 3, c); }
  else { P(2, -7, 2, 1, rdShade(c, -0.3)); P(-4, -5, 1, 2, c); P(5, -4, 1, 1, '#b13e53'); }
  P(-3 + leg, -1, 1, 1, rdShade(c, -0.3)); P(1 - leg, -1, 1, 1, rdShade(c, -0.3));
}
// 头顶气泡
function rdDrawBubble(g, x, y, b) {
  if (!b) return;
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = '#f4f4f4'; g.fillRect(x - 5, y - 9, 11, 8); g.fillRect(x - 4, y - 10, 9, 10); g.fillRect(x - 1, y - 1, 2, 2);
  const P = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
  if (b === 'hungry' || b === 'eat') { P(-2, -7, 4, 3, '#a8794f'); P(1, -8, 2, 2, '#f4f4f4'); P(-3, -5, 2, 1, '#a8794f'); }
  else if (b === 'thirsty' || b === 'drink') { P(-1, -8, 2, 1, '#41a6f6'); P(-2, -7, 4, 4, '#41a6f6'); }
  else if (b === 'tired' || b === 'zzz') { P(-3, -8, 4, 1, '#3b5dc9'); P(-1, -7, 1, 1, '#3b5dc9'); P(-3, -6, 4, 1, '#3b5dc9'); P(2, -5, 2, 1, '#566c86'); }
  else if (b === 'sad') { P(-3, -8, 6, 2, '#566c86'); P(-2, -5, 1, 2, '#41a6f6'); P(1, -5, 1, 2, '#41a6f6'); }
  else if (b === 'happy' || b === 'yum') { P(-2, -7, 1, 1, '#1a1c2c'); P(1, -7, 1, 1, '#1a1c2c'); P(-2, -5, 4, 1, '#b13e53'); P(-3, -6, 1, 1, '#b13e53'); P(2, -6, 1, 1, '#b13e53'); }
  else if (b === 'love') { P(-3, -8, 2, 2, '#b13e53'); P(1, -8, 2, 2, '#b13e53'); P(-3, -7, 6, 2, '#b13e53'); P(-2, -5, 4, 1, '#b13e53'); P(-1, -4, 2, 1, '#b13e53'); }
  else if (b === 'heal') { P(-1, -8, 2, 6, '#b13e53'); P(-3, -6, 6, 2, '#b13e53'); }
  else if (b === 'rad') { P(-1, -6, 2, 2, '#a7f070'); P(-3, -8, 2, 2, '#a7f070'); P(1, -8, 2, 2, '#a7f070'); P(-1, -4, 2, 2, '#a7f070'); }
  else if (b === 'cold') { P(-1, -8, 2, 6, '#73eff7'); P(-3, -6, 6, 2, '#73eff7'); }
}
function rdNotes(g, x, y, c) { // 飘起的音符
  for (let k = 0; k < 2; k++) { const t = (G.time * 0.8 + k * 0.5) % 1; g.globalAlpha = 1 - t; g.fillStyle = c || '#ffcd75'; const nx = Math.round(x + k * 4 + Math.sin(t * 6) * 2), ny = Math.round(y - t * 12); g.fillRect(nx, ny, 2, 2); g.fillRect(nx + 1, ny - 4, 1, 4); g.fillRect(nx + 1, ny - 4, 2, 1); }
  g.globalAlpha = 1;
}
function rdZzz(g, x, y) { for (let k = 0; k < 3; k++) { const t = (G.time * 0.5 + k / 3) % 1; g.globalAlpha = 1 - t; g.fillStyle = '#f4f4f4'; const zx = Math.round(x + t * 6), zy = Math.round(y - t * 12); g.fillRect(zx, zy, 3, 1); g.fillRect(zx + 1, zy + 1, 1, 1); g.fillRect(zx, zy + 2, 3, 1); } g.globalAlpha = 1; }

// ================= 车内（剖面图） =================
// 驾驶室在右边，往左是车厢，再往左是挂车；地面家具站在地上，墙面家具挂在墙上，没挂东西的墙是窗户
const RD_CELL = 26;
function rdInteriorLayout() {
  const rooms = rdRooms(), v = rdVeh();
  const cab = v.tent ? 0 : 34, gap = 10; // 电动三轮车（v.pod）也没有驾驶室：骑手在舱外
  let w = cab;
  const out = [];
  rooms.forEach((r, i) => { const rw = Math.max(r.cells, r.wcells, 1) * RD_CELL; out.push(Object.assign({}, r, { w: rw })); w += rw + (i ? gap : 0); });
  return { rooms: out, total: w + 8, cab, gap };
}
// 车内第 c 格（从驾驶室往左数）的画布 x
function rdCellX(lay, ox, c, layer) {
  let x = ox - lay.cab;
  for (let i = 0; i < lay.rooms.length; i++) {
    const r = lay.rooms[i], s = layer === 'wall' ? r.wstart : r.start, n = layer === 'wall' ? r.wcells : r.cells;
    if (i > 0) x -= lay.gap;
    if (c < s + n || i === lay.rooms.length - 1) return x - (c - s) * RD_CELL;
    x -= r.w;
  }
  return x;
}
function rdDrawInterior(g) {
  const R = G.road, V = RDV, W = V.W, H = V.H, v = rdVeh();
  const lay = rdInteriorLayout();
  const z = 1; // 车内的镜头远近在 rdSetupView 里定
  const vw = W / z, vh = H / z;
  // 镜头：放得下就居中，放不下就从驾驶室开始，可以左右拖动
  const maxScroll = Math.max(0, lay.total - vw + 20);
  // 镜头跟着主角（手动拖动后 6 秒内不跟）
  if (!(R.ifollowT > G.time) && maxScroll > 0) {
    const me = R.me, ix = me.loc === 'drive' ? -1 : me.ix;
    const off = me.loc === 'drive' ? lay.cab - 12 : -(rdCellX(lay, 0, Math.floor(Math.max(0, ix)), 'floor') - (Math.max(0, ix) % 1) * RD_CELL);
    const want = off - vw / 2 + 10;
    R.icam = (R.icam || 0) + (want - (R.icam || 0)) * 0.08;
  }
  R.icam = Math.max(0, Math.min(maxScroll, R.icam || 0));
  const ox = Math.round(lay.total < vw - 10 ? (vw + lay.total) / 2 - 4 : vw - 10 + R.icam);
  const floorY = Math.round(vh * (G.sw < G.sh ? 0.5 : 0.66)), ceil = floorY - 50;
  V.izoom = z; V.iox = ox; V.ifloor = floorY;
  g.setTransform(z * RD_Q, 0, 0, z * RD_Q, 0, 0);
  // 背景：天空、远山、路面、车底大梁和轮子（js/roadin.js）
  const day = rdDaylight(), b = rdBiomeAt(R.km);
  const wp = rdSum('wallpaper') > 0, wood = rdSum('floorWood') > 0, camp = v.tent && !v.pod; // 三轮车的货舱不是露营地
  const comfort = rdStats().comfort;
  const fold = (R.cargoFold || 0) > 0; // 装了货舱折叠模块：全车换成银白科技舱
  const kind = fold ? 'scifi' : wp ? 'paper' : comfort > 3 ? 'ply' : 'steel', floorK = fold ? 'scifi' : wood ? 'wood' : 'plate';
  const lit = R.powered !== false, night = day < 0.5;
  const curtain = rdSum('curtain') || R.inner.some((it) => RD_PARTS[it.id].v === 'curtain');
  // 轮子和大梁的位置：驾驶室下面一个前轮，每个车厢靠后一个后轮
  const wh = rdiWheelLayout(lay, ox, camp); // 照着车外那辆车的比例放大（js/roadin.js）
  rdiBackground(g, vw, vh, floorY, day, b, wh);
  // 每个房间
  let x = ox - lay.cab;
  if (!camp && !v.pod) rdiCab(g, ox - lay.cab, floorY, ceil, lay.cab, R, day, b); // 三轮车是骑的，没有驾驶室
  lay.rooms.forEach((r, i) => {
    if (i > 0) { x -= lay.gap; rdiHitch(g, x + lay.gap, floorY, ceil); }
    const left = x - r.w;
    if (r.camp) rdDrawCampRoom(g, left, x, floorY, day, b);
    else {
      rdiRoom(g, left, ceil, r.w, kind, floorK, r.trailer, lit, night);
      // 墙面格：没挂东西的地方是窗户
      const usedW = new Set();
      for (const it of R.inner) { const p = RD_PARTS[it.id]; if (p.layer === 'wall') for (let k = 0; k < (p.w || 1); k++) usedW.add(it.cell + k); }
      for (let c = 0; c < (rdiOpenTop(r.trailer) ? 0 : r.wcells); c++) { // 敞开的皮卡后斗没有墙，也就没有窗
        if (usedW.has(c + r.wstart)) continue;
        const wx = x - (c + 1) * RD_CELL;
        rdiWindow(g, wx + 4, ceil + 9, RD_CELL - 8, 13, R, day, b, c + r.wstart);
        if (curtain) rdiCurtain(g, wx + 3, ceil + 8, RD_CELL - 6, 15);
      }
    }
    // 空间核心：房间边缘闪光
    if (rdMax('spaceMul') > 1) { g.globalAlpha = 0.25 + Math.sin(G.time * 2) * 0.1; g.strokeStyle = '#c27bd6'; g.strokeRect(left + 0.5, ceil + 0.5, r.w - 1, floorY - ceil - 1); g.globalAlpha = 1; }
    x = left;
  });
  // 家具
  const items = R.inner.map((it, i) => ({ it, i, p: RD_PARTS[it.id] }));
  // 家具：手绘过的用 js/roadfurn.js，其余先「自动精细化」（js/roadin.js 的 rdiFine）
  for (const o of items) if ((o.p.layer || 'floor') === 'wall') { if (rdfHas(o.p.v)) { rdfDraw(g, o, rdCellX(lay, ox, o.it.cell, 'wall'), ceil + 6, true); continue; } const iw = (o.p.w || 1) * RD_CELL; rdiFine(g, rdCellX(lay, ox, o.it.cell, 'wall'), ceil + 6, [-iw - 3, -14, iw + 6, 48], (gg, ax, ay) => rdDrawItem(gg, o, ax, ay, true, lay), 'wall'); }
  for (const o of items) if ((o.p.layer || 'floor') !== 'wall') { if (rdfHas(o.p.v)) { rdfDraw(g, o, rdCellX(lay, ox, o.it.cell, 'floor'), floorY, false); continue; } const iw = (o.p.w || 1) * RD_CELL; rdiFine(g, rdCellX(lay, ox, o.it.cell, 'floor'), floorY, [-iw - 3, -46, iw + 6, 50], (gg, ax, ay) => rdDrawItem(gg, o, ax, ay, false, lay), 'floor'); }
  // 宠物
  rdPetDraw(g, lay, ox, floorY, false); // js/roadpet.js
  // 主角
  rdDrawMeInside(g, lay, ox, floorY, ceil);
  rdPetDraw(g, lay, ox, floorY, true); // 依偎在主人身上的宠物画在主人前面
  rdfOverlay(g); // 睡觉时盖在身上的被子（js/roadfurn.js）
  rdiGradeScreen(g, vw, vh);
  // 没开空间核心但外面看着一样大：提示
  g.setTransform(RD_Q, 0, 0, RD_Q, 0, 0);
  // 夜里稍暗
  if (day < 0.5 && R.powered === false) { g.fillStyle = 'rgba(8,10,28,0.45)'; g.fillRect(0, 0, W, H); }
}
function rdDrawCampRoom(g, left, right, floorY, day, b) {
  // 露营地：没有墙，地上是泥土，左边是帐篷
  const Q = RD_Q, gc = rdMix('#10121f', b.ground, day * 0.8), X0 = Math.round((left - 34) * Q), X1 = Math.round((right + 30) * Q), FY = Math.round(floorY * Q);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  // 泥土地：上面一层亮边，零散的石子和草
  g.fillStyle = gc; g.fillRect(X0, FY, X1 - X0, 18);
  g.fillStyle = rdShade(gc, 0.15); g.fillRect(X0, FY, X1 - X0, 2);
  for (let x = X0; x < X1; x += 2) { const h = rdcHash(x, 3, 51); if (h < 0.12) { g.fillStyle = rdShade(gc, -0.3); g.fillRect(x, FY + 3 + Math.floor(h * 100) % 12, 2, 1); } else if (h > 0.95) { g.fillStyle = rdMix('#10121f', '#8a8a4a', day * 0.8); g.fillRect(x, FY - 2, 1, 2); g.fillRect(x + 1, FY - 3, 1, 3); } }
  const night = day < 0.5, fr = Math.floor(G.time * 10);
  rdcTent(g, Math.round((left - 14) * Q), FY, 64, night);
  // 坐的木头
  const lx = Math.round((right + 16) * Q);
  g.fillStyle = RDC_PAL.out; g.fillRect(lx - 1, FY - 9, 32, 10); g.fillStyle = '#6e4a2e'; g.fillRect(lx, FY - 8, 30, 8); g.fillStyle = '#8f6a42'; g.fillRect(lx, FY - 8, 30, 2); g.fillStyle = '#c49a64'; g.fillRect(lx + 26, FY - 7, 3, 6); g.fillStyle = '#8f6a42'; g.fillRect(lx + 27, FY - 5, 1, 2);
  rdcCampfire(g, Math.round((right + 8) * Q), FY, fr, night, 1);
  g.restore();
}
// 一件家具（x = 所在格的右边缘）
function rdDrawItem(g, o, xr, base, wall, lay) {
  const p = o.p, w = (p.w || 1) * RD_CELL, x = Math.round(xr - w), t = p.tier, R = G.road;
  const off = p.pw > 0 && R.powered === false;
  const P = (dx, dy, ww, hh, c) => { g.fillStyle = c; g.fillRect(x + dx, base + dy, ww, hh); };
  const tc = RD_TIER_COLOR[t];
  const using = R.me.act && R.me.act.it === o.it && !R.me.walking;
  const v = p.v;
  // 墙上的：base = 天花板下面；地上的：base = 地面
  if (wall) {
    if (v === 'poster') { P(6, 2, 12, 16, '#c9a86a'); P(8, 4, 8, 6, '#b13e53'); P(8, 12, 8, 1, '#1a1c2c'); P(8, 14, 6, 1, '#1a1c2c'); }
    else if (v === 'curtain') { P(2, 0, 22, 2, '#6e4a2e'); P(2, 2, 6, 18, '#b13e53'); P(18, 2, 6, 18, '#b13e53'); P(4, 2, 1, 18, '#8a2a3a'); P(20, 2, 1, 18, '#8a2a3a'); }
    else if (v === 'lights') { for (let k = 0; k < 24; k += 3) { g.fillStyle = off ? '#566c86' : ['#ef7d57', '#ffcd75', '#a7f070', '#41a6f6', '#c27bd6'][(k / 3 + Math.floor(G.time * 2)) % 5]; g.fillRect(x + 1 + k, base + 1 + Math.round(Math.sin(k / 4) * 2), 1, 2); } }
    else if (v === 'wallpaper') { P(10, 4, 6, 8, '#a8794f'); P(11, 5, 4, 6, '#f2d0a9'); }
    else if (v === 'photo') { P(8, 4, 10, 8, '#6e4a2e'); P(9, 5, 8, 6, '#c8d6e5'); P(10, 8, 2, 3, '#b13e53'); P(13, 7, 2, 4, '#3b5dc9'); }
    else if (v === 'ac') { P(2, 0, 22, 7, '#f4f4f4'); P(3, 5, 20, 1, '#94b0c2'); if (!off) { g.globalAlpha = 0.4; P(5, 8 + (G.time * 6 % 4), 16, 1, '#73eff7'); g.globalAlpha = 1; } }
    else if (v === 'diffuser') { P(10, 8, 6, 6, '#c8d6e5'); if (!off) { g.globalAlpha = 0.4; P(12 + Math.round(Math.sin(G.time * 2)), 2, 2, 5, '#f4f4f4'); g.globalAlpha = 1; } }
    else if (v === 'tv' || v === 'projector') {
      const big = v === 'projector';
      P(big ? 6 : 3, 1, big ? 40 : 20, big ? 18 : 13, '#1a1c2c');
      const on = using && !off;
      P(big ? 7 : 4, 2, big ? 38 : 18, big ? 16 : 11, on ? ['#41a6f6', '#73eff7', '#a7f070', '#ffcd75'][Math.floor(G.time * 2) % 4] : '#29366f');
      if (on) { P((big ? 12 : 7) + Math.floor(G.time * 4) % 6, 6, 3, 3, '#f4f4f4'); }
      if (!big) P(8, 14, 10, 2, '#333c57');
    }
    else if (v === 'laptop' || v === 'carpc') { P(6, 6, 14, 10, '#333c57'); P(7, 7, 12, 8, using && !off ? '#73eff7' : '#29366f'); if (using && !off) for (let k = 0; k < 3; k++) P(8, 8 + k * 2, 4 + ((k * 5 + Math.floor(G.time * 3)) % 7), 1, '#1a1c2c'); }
    else if (v === 'radio') { P(6, 8, 14, 8, '#8f6a42'); P(7, 10, 5, 5, '#3a2a22'); P(14, 10, 4, 2, '#ffcd75'); P(16, 4, 1, 4, '#94b0c2'); if (using && !off) rdNotes(g, x + 18, base + 6); }
    else if (v === 'harmonica' || v === 'guitar') { if (!using) { if (v === 'guitar') { P(10, 0, 2, 10, '#6e4a2e'); P(7, 10, 8, 8, '#a8794f'); P(10, 13, 2, 2, '#3a2a22'); } else P(8, 10, 10, 3, '#c8d6e5'); } }
    else if (v === 'shelf') { P(3, 0, 20, 20, '#6e4a2e'); for (let r = 0; r < 3; r++) { P(4, 1 + r * 7, 18, 6, '#3a2a22'); for (let k = 0; k < 6; k++) P(5 + k * 3, 2 + r * 7 + (k % 2), 2, 5 - (k % 2), ['#b13e53', '#3b5dc9', '#38b764', '#ffcd75'][(k + r) % 4]); } }
    else if (v === 'puzzle') { P(5, 6, 16, 10, '#a8794f'); for (let k = 0; k < 4; k++) P(6 + k * 4, 7 + (k % 2) * 4, 3, 3, ['#41a6f6', '#a7f070', '#ffcd75', '#b13e53'][k]); }
    else if (v === 'console') { P(4, 2, 18, 12, '#1a1c2c'); P(5, 3, 16, 10, using && !off ? (Math.sin(G.time * 8) > 0 ? '#c27bd6' : '#41a6f6') : '#29366f'); if (using && !off) { P(8 + Math.floor(G.time * 5) % 10, 8, 2, 2, '#ffcd75'); P(14, 5, 3, 2, '#b13e53'); } }
    else if (v === 'filter') { P(8, 0, 10, 16, '#c8d6e5'); P(9, 4, 8, 8, '#41a6f6'); P(12, 16, 2, 3, '#94b0c2'); if (!off && Math.sin(G.time * 3) > 0.5) P(12, 19, 1, 2, '#41a6f6'); }
    else if (v === 'coffee') { P(6, 4, 14, 14, '#333c57'); P(8, 6, 10, 4, '#1a1c2c'); P(10, 13, 6, 4, '#f4f4f4'); P(9, 6, 2, 2, off ? '#566c86' : '#b13e53'); if (using) { g.globalAlpha = 0.5; P(12 + Math.round(Math.sin(G.time * 3)), 9, 1, 3, '#f4f4f4'); g.globalAlpha = 1; } }
    else if (v === 'firstaid') { P(7, 4, 12, 10, '#f4f4f4'); P(12, 6, 2, 6, '#b13e53'); P(10, 8, 6, 2, '#b13e53'); }
    else if (v === 'toolwall') { P(2, 0, 22, 18, '#8f6a42'); for (let k = 0; k < 6; k++) P(4 + k * 3, 3, 1, 6 + (k % 3) * 2, '#94b0c2'); P(5, 13, 6, 2, '#b13e53'); P(14, 12, 6, 3, '#ffcd75'); }
    else if (v === 'locker' || v === 'ammorack') { P(3, 0, 20, 20, v === 'ammorack' ? '#4c5a36' : '#566c86'); P(13, 0, 1, 20, '#333c57'); P(10, 9, 2, 3, '#c8d6e5'); P(15, 9, 2, 3, '#c8d6e5'); if (v === 'ammorack') { P(5, 3, 6, 4, '#ffcd75'); P(16, 3, 5, 4, '#ffcd75'); } }
    else if (v === 'capwall') { P(2, 0, 22, 20, '#29366f'); for (let k = 0; k < 4; k++) P(4 + k * 5, 2, 3, 16, '#41a6f6'); P(4, 18 - Math.round(16 * Math.min(1, G.res.power / Math.max(1, rdStats().battery))), 18, 1, '#73eff7'); }
    else if (v === 'hammock') { g.strokeStyle = '#a8794f'; g.beginPath(); g.moveTo(x + 1, base + 6); g.quadraticCurveTo(x + w / 2, base + 26, x + w - 1, base + 6); g.stroke(); P(4, 16, w - 8, 2, '#ef7d57'); }
    else if (v === 'stasis') { P(3, 0, 20, 20, '#2e1f50'); g.globalAlpha = 0.5 + Math.sin(G.time * 2) * 0.2; P(5, 2, 16, 16, '#73eff7'); g.globalAlpha = 1; }
    else if (v === 'ecowall') { P(2, 0, w - 4, 20, '#2c3d2a'); for (let k = 0; k < w - 6; k += 3) P(3 + k, 2 + (k * 7 % 12), 2, 6, k % 2 ? '#38b764' : '#a7f070'); g.globalAlpha = 0.3; P(2, 0, w - 4, 20, '#73eff7'); g.globalAlpha = 1; }
    else { P(6, 4, 14, 12, tc); P(7, 5, 12, 10, rdShade(tc, -0.3)); }
    if (t >= 6) { g.globalAlpha = 0.3 + Math.sin(G.time * 3) * 0.15; g.fillStyle = '#73eff7'; g.fillRect(x + 2, base + 20, w - 4, 1); g.globalAlpha = 1; }
    return;
  }
  // ---- 地面家具 ----
  if (v === 'cardboard') { P(2, -2, 22, 2, '#a8794f'); P(4, -3, 6, 1, '#c49a64'); }
  else if (v === 'sleepbag') { P(2, -4, 22, 4, '#3b5dc9'); P(2, -4, 6, 4, '#41a6f6'); }
  else if (v === 'cot') { P(2, -8, 22, 2, '#4c5a36'); P(3, -6, 1, 6, '#566c86'); P(22, -6, 1, 6, '#566c86'); P(12, -6, 1, 6, '#566c86'); }
  else if (v === 'mattress' || v === 'bigbed' || v === 'waterbed') {
    const big = v !== 'mattress';
    if (big) { P(1, -16, 3, 16, '#6e4a2e'); P(w - 4, -10, 3, 10, '#6e4a2e'); }
    P(2, -9, w - 4, 6, v === 'waterbed' ? '#41a6f6' : '#f4f4f4'); P(2, -3, w - 4, 3, '#8f6a42');
    P(4, -11, 8, 3, '#f4f4f4'); P(12, -9, w - 16, 3, v === 'bigbed' ? '#5d275d' : '#ef7d57');
    if (v === 'waterbed') { g.globalAlpha = 0.5; P(14 + Math.round(Math.sin(G.time * 2) * 4), -8, 6, 1, '#73eff7'); g.globalAlpha = 1; }
  }
  else if (v === 'bunk') { P(2, -24, 2, 24, '#6e4a2e'); P(22, -24, 2, 24, '#6e4a2e'); P(3, -22, 20, 3, '#c8d6e5'); P(3, -8, 20, 3, '#c8d6e5'); P(4, -11, 5, 3, '#f4f4f4'); P(4, -25, 5, 3, '#f4f4f4'); }
  else if (v === 'capsule' || v === 'alienpod' || v === 'cryo') { const c = v === 'capsule' ? '#c8d6e5' : '#4b3378'; P(2, -14, 22, 14, c); P(4, -12, 18, 8, v === 'capsule' ? '#29366f' : '#2e1f50'); g.globalAlpha = 0.4 + Math.sin(G.time * 2) * 0.2; P(4, -12, 18, 8, v === 'cryo' ? '#73eff7' : '#c27bd6'); g.globalAlpha = 1; }
  else if (v === 'burner') { P(6, -8, 14, 8, '#566c86'); P(8, -10, 10, 2, '#333c57'); if (using) { P(10, -12, 6, 2, '#ef7d57'); P(9, -16, 8, 4, '#94b0c2'); } }
  else if (v === 'induction' || v === 'kitchen') { const big = v === 'kitchen'; P(1, -14, w - 2, 14, '#c8d6e5'); P(1, -14, w - 2, 2, '#94b0c2'); P(3, -10, 8, 6, '#566c86'); if (big) { P(30, -10, 18, 8, '#94b0c2'); P(28, -30, 22, 10, '#c8d6e5'); P(32, -28, 4, 6, '#a7f070'); P(40, -28, 4, 6, '#ffcd75'); } if (using) { P(6, -18, 10, 4, '#333c57'); g.globalAlpha = 0.5; P(10 + Math.round(Math.sin(G.time * 3)), -24, 2, 5, '#f4f4f4'); g.globalAlpha = 1; } }
  else if (v === 'grill') { P(5, -14, 16, 6, '#1a1c2c'); P(8, -8, 1, 8, '#566c86'); P(18, -8, 1, 8, '#566c86'); if (using) { P(7, -16, 12, 2, '#ef7d57'); P(9, -17, 3, 1, '#b13e53'); } }
  else if (v === 'synth') { P(3, -20, 20, 20, '#2e1f50'); P(5, -18, 16, 10, '#4b3378'); g.globalAlpha = 0.6 + Math.sin(G.time * 3) * 0.3; P(8, -16, 10, 6, '#73eff7'); g.globalAlpha = 1; P(7, -6, 12, 4, '#c27bd6'); }
  else if (v === 'cooler') { P(5, -10, 16, 10, '#41a6f6'); P(5, -10, 16, 2, '#f4f4f4'); }
  else if (v === 'minifridge' || v === 'freezer' || v === 'bigfridge') { const hh = v === 'bigfridge' ? 30 : v === 'freezer' ? 14 : 18; P(2, -hh, w - 4, hh, '#f4f4f4'); P(2, -hh, w - 4, 1, '#c8d6e5'); P(w - 7, -hh + 4, 1, 6, '#94b0c2'); if (v === 'bigfridge') { P(w / 2, -hh, 1, hh, '#c8d6e5'); P(5, -hh + 4, 6, 3, '#ffcd75'); } if (using) { P(4, -hh + 2, 10, hh - 4, '#ffcd75'); P(6, -hh + 6, 3, 3, '#a7f070'); } }
  else if (v === 'barrel') { P(6, -16, 14, 16, '#3b5dc9'); P(6, -12, 14, 1, '#29366f'); P(6, -5, 14, 1, '#29366f'); P(7, -17, 12, 1, '#94b0c2'); }
  else if (v === 'aquagen') { P(4, -24, 18, 24, '#c8d6e5'); P(6, -20, 14, 8, '#41a6f6'); P(9, -8, 8, 4, '#94b0c2'); if (!off) { g.globalAlpha = 0.5; P(8 + (G.time * 8) % 10, -18, 1, 1, '#f4f4f4'); g.globalAlpha = 1; } }
  else if (v === 'medbed') { P(2, -10, w - 4, 3, '#c8d6e5'); P(4, -7, 1, 7, '#94b0c2'); P(w - 6, -7, 1, 7, '#94b0c2'); P(3, -12, 8, 2, '#f4f4f4'); P(w - 8, -28, 2, 18, '#94b0c2'); P(w - 10, -28, 6, 5, '#73eff7'); P(w - 9, -26, 1, 1, '#b13e53'); }
  else if (v === 'decon') { P(3, -30, 20, 30, '#c8d6e5'); P(5, -28, 16, 26, '#a7f070'); g.globalAlpha = 0.4; P(5, -28 + (G.time * 10) % 26, 16, 2, '#f4f4f4'); g.globalAlpha = 1; }
  else if (v === 'battery') { P(5, -10, 16, 10, t >= 3 ? '#41a6f6' : '#333c57'); P(8, -12, 3, 2, '#b13e53'); P(15, -12, 3, 2, '#333c57'); P(7, -6, Math.round(12 * Math.min(1, G.res.power / Math.max(1, rdStats().battery))), 2, '#a7f070'); }
  else if (v === 'generator') { P(2, -14, w - 4, 14, '#ffcd75'); P(4, -12, w - 8, 8, '#333c57'); P(w - 6, -18, 2, 4, '#566c86'); if (R.genOn) { P(4 + Math.round(Math.random()), -12, 4, 2, '#94b0c2'); if (Math.random() < 0.3) { g.globalAlpha = 0.4; P(w - 6, -22, 2, 3, '#94b0c2'); g.globalAlpha = 1; } } }
  else if (v === 'fusion') { P(6, -18, 14, 18, '#2e1f50'); g.fillStyle = '#73eff7'; g.globalAlpha = 0.6 + Math.sin(G.time * 4) * 0.3; g.beginPath(); g.arc(x + 13, base - 10, 4, 0, 7); g.fill(); g.globalAlpha = 1; }
  else if (v === 'terminal' || v === 'quantum' || v === 'aicore') {
    if (v === 'terminal') { P(4, -10, 18, 10, '#4c5a36'); P(6, -24, 14, 12, '#1a1c2c'); P(7, -23, 12, 10, using && !off ? '#a7f070' : '#29366f'); }
    else if (v === 'quantum') { P(2, -30, w - 4, 30, '#c8d6e5'); for (let k = 0; k < 6; k++) P(5 + k * 7, -26, 4, 20, '#29366f'); g.globalAlpha = 0.6; for (let k = 0; k < 6; k++) P(6 + k * 7, -24 + ((G.time * 10 + k * 5) % 16), 2, 2, '#73eff7'); g.globalAlpha = 1; }
    else { P(6, -16, 14, 16, '#24183f'); g.fillStyle = '#c27bd6'; g.globalAlpha = 0.6 + Math.sin(G.time * 3) * 0.3; g.beginPath(); g.arc(x + 13, base - 22, 5, 0, 7); g.fill(); g.globalAlpha = 1; }
  }
  else if (v === 'bench' || v === 'workshop') { const big = v === 'workshop'; P(1, -12, w - 2, 3, '#8f6a42'); P(2, -9, 2, 9, '#6e4a2e'); P(w - 4, -9, 2, 9, '#6e4a2e'); P(5, -15, 6, 3, '#566c86'); P(14, -14, 2, 2, '#ffcd75'); if (big) { P(30, -26, 18, 26, '#566c86'); P(32, -22, 14, 4, '#333c57'); P(34, -14, 10, 2, '#ef7d57'); } if (using) { if (Math.random() < 0.3) { P(10 + Math.floor(Math.random() * 6), -16, 1, 1, '#ffcd75'); } } }
  else if (v === 'printer') { P(4, -24, 18, 24, '#c8d6e5'); P(6, -20, 14, 12, '#29366f'); P(8 + Math.round(Math.sin(G.time * 3) * 5), -19, 2, 2, '#ef7d57'); P(10, -10, 6, 2, '#ffcd75'); }
  else if (v === 'dumbbell') { P(4, -12, 18, 2, '#566c86'); P(4, -12, 1, 12, '#566c86'); P(21, -12, 1, 12, '#566c86'); P(7, -8, 4, 2, '#333c57'); P(14, -8, 4, 2, '#333c57'); }
  else if (v === 'beanbag') { g.fillStyle = '#ef7d57'; g.beginPath(); g.ellipse(x + 13, base - 5, 10, 6, 0, 0, 7); g.fill(); }
  else if (v === 'record') { P(4, -10, 18, 10, '#8f6a42'); P(5, -12, 16, 2, '#6e4a2e'); g.fillStyle = '#1a1c2c'; g.beginPath(); g.ellipse(x + 12, base - 12, 6, 2, 0, 0, 7); g.fill(); if (using && !off) rdNotes(g, x + 16, base - 16, '#c27bd6'); }
  else if (v === 'speaker') { P(3, -22, 8, 22, '#1a1c2c'); P(15, -22, 8, 22, '#1a1c2c'); const pulse = using && !off ? Math.round(Math.abs(Math.sin(G.time * 8))) : 0; g.fillStyle = '#566c86'; g.beginPath(); g.arc(x + 7, base - 8, 2 + pulse, 0, 7); g.fill(); g.beginPath(); g.arc(x + 19, base - 8, 2 + pulse, 0, 7); g.fill(); }
  else if (v === 'treadmill') { P(2, -4, 22, 4, '#333c57'); P(20, -18, 2, 14, '#566c86'); P(16, -18, 6, 3, '#1a1c2c'); P(17, -17, 2, 1, using && !off ? '#a7f070' : '#566c86'); }
  else if (v === 'aquarium') { P(3, -22, 20, 6, '#6e4a2e'); P(3, -38, 20, 16, '#29366f'); g.globalAlpha = 0.6; P(4, -37, 18, 14, '#41a6f6'); g.globalAlpha = 1; const fx = Math.round(5 + (Math.sin(G.time * 0.8) * 0.5 + 0.5) * 12); P(fx, -32, 3, 2, '#ef7d57'); P(fx + 3, -32 + (Math.sin(G.time) > 0 ? 0 : 1), 1, 1, '#ef7d57'); P(8, -26, 1, 3, '#38b764'); P(16, -27, 1, 4, '#38b764'); P(6, -22, 14, 1, '#c9a86a'); P(4, -16, 1, 16, '#6e4a2e'); P(21, -16, 1, 16, '#6e4a2e'); }
  else if (v === 'sofa' || v === 'massage') { const big = v === 'sofa'; P(2, -12, w - 4, 6, big ? '#5f8a4a' : '#333c57'); P(2, -20, big ? 4 : 6, 14, big ? '#4a6e3a' : '#1a1c2c'); P(w - (big ? 6 : 4), -14, big ? 4 : 2, 8, big ? '#4a6e3a' : '#333c57'); P(2, -6, 2, 6, '#3a2a22'); P(w - 4, -6, 2, 6, '#3a2a22'); if (big) { P(8, -14, 8, 3, '#ffcd75'); P(24, -14, 8, 3, '#ef7d57'); } }
  else if (v === 'karaoke') { P(6, -16, 14, 16, '#5d275d'); P(8, -14, 10, 6, using && !off ? '#c27bd6' : '#29366f'); P(9, -6, 3, 3, '#ffcd75'); }
  else if (v === 'pool') { P(2, -12, w - 4, 4, '#38b764'); P(2, -12, w - 4, 1, '#6e4a2e'); P(4, -8, 3, 8, '#6e4a2e'); P(w - 7, -8, 3, 8, '#6e4a2e'); P(16, -13, 2, 1, '#f4f4f4'); P(30, -13, 2, 1, '#b13e53'); P(34, -13, 2, 1, '#ffcd75'); }
  else if (v === 'holo') { P(2, -2, w - 4, 2, '#4b3378'); g.globalAlpha = 0.25 + Math.sin(G.time * 2) * 0.1; P(4, -40, w - 8, 38, '#73eff7'); g.globalAlpha = 0.7; for (let k = 0; k < 5; k++) P(6 + ((k * 13 + G.time * 10) % (w - 12)), -30 + k * 5, 3, 3, ['#ef7d57', '#a7f070', '#ffcd75', '#c27bd6', '#41a6f6'][k]); g.globalAlpha = 1; }
  else if (v === 'easel') { P(8, -24, 1, 24, '#6e4a2e'); P(18, -24, 1, 24, '#6e4a2e'); P(6, -26, 16, 14, '#f4f4f4'); P(8, -22, 6, 4, '#41a6f6'); P(14, -18, 5, 3, '#a7f070'); P(10, -16, 3, 2, '#ef7d57'); }
  else if (v === 'desk' || v === 'table') { P(2, -12, 22, 2, '#a8794f'); P(3, -10, 2, 10, '#8f6a42'); P(21, -10, 2, 10, '#8f6a42'); if (v === 'desk') { P(6, -16, 6, 4, '#b13e53'); P(14, -14, 3, 2, '#f4f4f4'); } else { P(20, -16, 4, 4, '#8f6a42'); P(9, -14, 4, 2, '#f4f4f4'); } }
  else if (v === 'plant') { P(9, -6, 8, 6, '#b13e53'); P(12, -14, 2, 8, '#38b764'); P(8, -16, 5, 4, '#a7f070'); P(13, -18, 5, 5, '#38b764'); P(10, -11, 3, 3, '#38b764'); }
  else if (v === 'rug') { P(1, -1, w - 2, 1, '#b13e53'); P(3, -1, 4, 1, '#ffcd75'); P(13, -1, 4, 1, '#ffcd75'); }
  else if (v === 'heater') { P(7, -14, 12, 14, '#c8d6e5'); for (let k = 0; k < 4; k++) P(8, -12 + k * 3, 10, 1, off ? '#566c86' : '#ef7d57'); }
  else if (v === 'shower' || v === 'bath') { const big = v === 'bath'; P(2, -36, big ? 20 : 22, 36, '#c8d6e5'); g.globalAlpha = 0.45; P(4, -34, big ? 16 : 18, 34, '#73eff7'); g.globalAlpha = 1; P(10, -36, 2, 4, '#94b0c2'); if (big) { P(24, -10, 24, 10, '#f4f4f4'); P(25, -9, 22, 3, '#41a6f6'); } if (using) { g.fillStyle = '#41a6f6'; for (let k = 0; k < 4; k++) g.fillRect(x + 7 + k * 3, base - 30 + (G.time * 30 + k * 7) % 26, 1, 2); } }
  else if (v === 'washer') { P(4, -20, 18, 20, '#f4f4f4'); g.fillStyle = '#29366f'; g.beginPath(); g.arc(x + 13, base - 10, 5, 0, 7); g.fill(); g.fillStyle = '#41a6f6'; g.fillRect(x + 11 + Math.round(Math.sin(G.time * 6) * 2), base - 11, 3, 2); }
  else if (v === 'petbed' || v === 'cattree') { if (v === 'petbed') { g.fillStyle = '#b13e53'; g.beginPath(); g.ellipse(x + 13, base - 3, 9, 3, 0, 0, 7); g.fill(); P(7, -4, 12, 2, '#ef7d57'); } else { P(11, -28, 4, 28, '#c9a86a'); P(5, -28, 16, 3, '#8f6a42'); P(5, -14, 12, 3, '#8f6a42'); P(4, -2, 18, 2, '#8f6a42'); } }
  else if (v === 'grow' || v === 'hydro') { P(3, -26, 20, 2, '#6e4a2e'); P(3, -14, 20, 2, '#6e4a2e'); P(3, -26, 1, 26, '#6e4a2e'); P(22, -26, 1, 26, '#6e4a2e'); for (let k = 0; k < 4; k++) { P(5 + k * 5, -30, 2, 4, '#38b764'); P(5 + k * 5, -18, 2, 4, '#a7f070'); } if (v === 'hydro' && !off) { g.globalAlpha = 0.25; P(3, -32, 20, 32, '#c27bd6'); g.globalAlpha = 1; } }
  else if (v === 'boxes') { P(3, -10, 10, 10, '#a8794f'); P(14, -8, 9, 8, '#8f6a42'); P(6, -16, 9, 6, '#c49a64'); P(3, -6, 10, 1, '#6e4a2e'); }
  else if (v === 'rack') { P(3, -30, 1, 30, '#94b0c2'); P(22, -30, 1, 30, '#94b0c2'); for (let r = 0; r < 3; r++) { P(3, -30 + r * 10, 20, 1, '#94b0c2'); P(5, -29 + r * 10 + 3, 6, 6, ['#a8794f', '#38b764', '#3b5dc9'][r]); P(13, -29 + r * 10 + 4, 7, 5, ['#ffcd75', '#a8794f', '#b13e53'][r]); } }
  else { P(5, -14, 16, 14, tc); P(6, -13, 14, 12, rdShade(tc, -0.3)); }
  if (t >= 6 && v !== 'synth') { g.globalAlpha = 0.3 + Math.sin(G.time * 3) * 0.15; g.fillStyle = '#73eff7'; g.fillRect(x + 2, base - 1, w - 4, 1); g.globalAlpha = 1; }
  if (off && (p.pw || 0) > 0) { g.fillStyle = '#b13e53'; g.fillRect(x + w - 5, base - 4, 2, 2); }
}
// 主角在车内（真人比例，js/roadhero.js 的 rdhPersonIn）：坐的高度、躺的位置按家具的真实尺寸算
function rdDrawMeInside(g, lay, ox, floorY, ceil) {
  const R = G.road, me = R.me;
  if (me.loc === 'out' || me.loc === 'site') return; // 车里空着：人在外面
  const HEAD = 36; // 站着时头顶离地多高（世界像素）
  if (me.loc === 'drive') {
    const x = rdVeh().tent ? ox - 20 : ox - lay.cab + 11;
    rdhPersonIn(g, x, floorY, { pose: 'drive', face: 1, seat: 13 }); // 坐在驾驶座坐垫上（坐垫离地 13）
    if (me.bubble) rdDrawBubble(g, x + 2, floorY - 13 - 25, me.bubble);
    return;
  }
  let px = rdCellX(lay, ox, Math.floor(me.ix), 'floor') - (me.ix % 1) * RD_CELL;
  const a = me.act;
  let pose = me.walking ? 'walk' : 'stand', hold = null, y = floorY, seat = 0, stool = false;
  if (a && !me.walking) {
    const p = a.it ? RD_PARTS[a.it.id] : null, v = p ? p.v : '';
    // 正在用的家具占的位置（左边缘 x0、宽 w）
    const span = p ? [rdCellX(lay, ox, a.it.cell, p.layer || 'floor') - (p.w || 1) * RD_CELL, (p.w || 1) * RD_CELL] : null;
    const lieOn = (h) => { // 躺在床上：两格宽的床伸直躺，一格的床曲着腿躺；头靠枕头那头（左边）
      y = floorY - h;
      if (!span) { pose = 'curl'; return; }
      pose = span[1] >= 2 * RD_CELL ? 'lie' : 'curl';
      px = span[0] + (pose === 'lie' ? 22 : 19); // 屈腿躺约 25 宽：一格床（26）正好放下
    };
    switch (a.type) {
      case 'sleep':
        if (v === 'hammock') { pose = 'curl'; y = ceil + 30; if (span) px = rdCellX(lay, ox, a.it.cell, 'wall') - RD_CELL + 19; }
        else lieOn(v === 'cardboard' ? 2 : v === 'sleepbag' ? 3 : v === 'cot' ? 8 : v === 'bunk' ? 8 : v === 'capsule' || v === 'alienpod' || v === 'cryo' ? 7 : p ? 9 : 0);
        break;
      case 'cook': hold = 'arms'; break;
      case 'eat': hold = 'can'; if (rdSum('dine')) { pose = 'sit'; seat = 9; stool = true; } break;
      case 'drink': hold = 'cup'; break;
      case 'coffee': hold = 'cup'; break;
      case 'sip': hold = 'cup'; if (a.seatH) { pose = 'sit'; seat = a.seatH; if (span) px = v === 'table' ? span[0] + span[1] / 2 - 9 : span[0] + span[1] / 2 - 3; } break; // 端着咖啡坐着慢慢喝
      case 'feed': hold = 'can'; break;                                                                                        // 给食盆添粮
      case 'playpet': hold = R.pet && R.pet.type === 'cat' ? null : 'arms'; if (R.pet && R.pet.type === 'cat') pose = 'sitfloor'; break; // 扔球 / 蹲着晃逗猫棒
      case 'heal': if (v === 'medbed') lieOn(11); else if (v === 'alienpod') lieOn(16); else hold = 'arms'; break; // 纳米修复舱躺进去；急救箱、药剂工坊、净化舱：动手处理
      case 'use': { // 摆弄车里的其他东西（js/modes/road.js 的 rdUseMode）
        const md = a.mode;
        if (md === 'rest') { pose = 'sit'; seat = 7.5; stool = false; if (span) px = span[0] + span[1] / 2 - 9; } // 坐到餐桌旁的椅子上歇会
        else if (md === 'refuel' || md === 'collect') hold = 'can';          // 拎油桶加油 / 取蛋白块
        else if (md === 'fix') { pose = 'sitfloor'; hold = 'arms'; }         // 蹲在电池 / 控制器前检修
        else if (md !== 'look') hold = 'arms';                               // 翻箱子、烤手、按开关、塞衣服、收拾窝
        break;
      }
      case 'shower': break;
      case 'research': if (v === 'laptop' || v === 'carpc') { pose = 'sit'; seat = 8.7; } hold = 'arms'; break; // 笔记本 / 车载电脑：坐在凳子上对着桌上的电脑打字
      case 'craft': hold = 'arms'; break;
      case 'plant': hold = 'can'; break;
      case 'pet': pose = 'sitfloor'; break;
      case 'mope': pose = 'hug'; break;
      case 'window': if (a.seatH) { pose = 'sit'; seat = a.seatH; if (span) px = span[0] + span[1] / 2 - 3; if (R.inner.some((it) => RD_PARTS[it.id] && RD_PARTS[it.id].fx.coffee)) hold = 'cup'; } break; // 坐在窗边软垫上看风景（有咖啡机就端一杯）
      case 'fun': {
        const an = a.anim;
        if (v === 'laptop' || v === 'carpc') { pose = 'sit'; seat = 8.7; if (an === 'game') hold = 'arms'; }
        else if (an === 'sit') { pose = 'sit'; seat = 8; if (span) px = span[0] + span[1] / 2 - 3; }   // 懒人沙发（陷进去一点）
        else if (an === 'sofa') { pose = 'sit'; seat = v === 'massage' ? 12 : 10.5; if (span) px = span[0] + span[1] / 2 - 3; }
        else if (an === 'watch' || an === 'game') { pose = 'sitfloor'; if (an === 'game') hold = 'arms'; } // 没有椅子：盘腿坐地上
        else if (an === 'sitfloor' || an === 'read') { pose = 'sitfloor'; }
        else if (an === 'guitar' || an === 'music') { pose = 'sit'; seat = 9; stool = true; hold = an === 'guitar' ? 'arms' : 'mic'; }
        else if (an === 'run') { pose = 'run'; y = floorY - 4; }
        else if (an === 'lift') { hold = 'bar'; }
        else if (an === 'sing') { hold = 'mic'; }
        else if (an === 'pool') { hold = 'cue'; }
        else if (an === 'paint') { hold = 'brush'; }
        else if (an === 'dance') { pose = 'walk'; }
        else if (an === 'water') { hold = 'can'; }
        else if (an === 'holo') { pose = 'walk'; hold = 'arms'; }
        break;
      }
    }
  }
  const face = a && !me.walking && a.it ? 1 : me.face;
  const lying = pose === 'lie' || pose === 'curl';
  // 头顶高度：站 36，坐着 = 座位 + 25，坐地上 21，躺着 = 床面 + 9
  const top = lying ? y - 9 : pose === 'sit' ? y - seat - 25 : pose === 'sitfloor' || pose === 'hug' ? y - 21 : y - HEAD;
  const shA = a && a.type === 'shower' && !me.walking ? 0.6 : 1;
  g.globalAlpha = shA; rdhPersonIn(g, px, y, { pose, face, hold, seat, stool }); g.globalAlpha = 1;
  // 活动特效
  if (a && !me.walking) {
    if (a.type === 'sleep') rdZzz(g, px - 10, top - 4);
    if (a.type === 'fun' && (a.anim === 'guitar' || a.anim === 'music' || a.anim === 'sing' || a.anim === 'dance')) {
      rdNotes(g, px + 8, top + 2);
      if (a.anim === 'guitar') { const gy = y - seat - 6; g.fillStyle = '#6e4a2e'; g.fillRect(px + 2, gy - 3, 10, 6); g.fillStyle = '#a8794f'; g.fillRect(px + 2, gy - 2, 9, 4); g.fillStyle = '#3a2618'; g.fillRect(px + 6, gy - 1, 2, 2); g.fillStyle = '#6e4a2e'; g.fillRect(px + 11, gy - 2, 10, 1); }
    }
    if (a.type === 'fun' && a.anim === 'read') { const by = y - 11; g.fillStyle = '#8a2f30'; g.fillRect(px + 6, by, 5, 4); g.fillStyle = '#ece4d6'; g.fillRect(px + 6.5, by + 0.4, 4, 3.2); g.fillStyle = '#8a2f30'; g.fillRect(px + 8.3, by, 0.6, 4); }
    if (a.type === 'cook') { g.globalAlpha = 0.5; g.fillStyle = '#f4f4f4'; g.fillRect(px + 14 + Math.round(Math.sin(G.time * 3)), y - 26, 1, 3); g.globalAlpha = 1; }
    if (hold === 'cup') { const t = G.time; for (let k = 0; k < 3; k++) { const pp = (t * 0.6 + k / 3) % 1; g.globalAlpha = (1 - pp) * 0.5; g.fillStyle = '#f4f0e8'; g.fillRect(px + 8 + Math.sin(pp * 6 + k) * 1.5, top + 10 - pp * 9, 1, 1.5); } g.globalAlpha = 1; } // 杯子冒热气
    if (a.type === 'pet') rdPetHearts(g, px + 2, top - 2);
    rdPetPlayFx(g, px, y, top); // 扔球 / 逗猫棒（js/roadpet.js）
    if (a.type === 'fun' && a.anim === 'game' || a.type === 'fun' && a.it && RD_PARTS[a.it.id] && RD_PARTS[a.it.id].kind === 'pc') { const t = G.time; if ((t * 0.5) % 1 < 0.25) { g.fillStyle = '#ffcd75'; g.fillRect(px + 3, top - 4, 1, 1); g.fillRect(px + 6, top - 6, 1, 1); g.fillRect(px + 5, top - 3, 1, 1); } } // 打游戏打得开心：头上冒星星
    if (a.type === 'use') { // 摆弄时的小特效：检修冒电火花、烤暖风手边一团暖光、翻箱子扬灰、按开关亮绿灯
      const t = G.time;
      if (a.mode === 'fix' && Math.sin(t * 9) > 0.3) { g.fillStyle = Math.sin(t * 23) > 0 ? '#ffe060' : '#73eff7'; g.fillRect(px + 9, y - 12, 1, 1); g.fillRect(px + 11, y - 14, 1, 1); g.fillRect(px + 10, y - 10, 1, 1); }
      if (a.mode === 'warm') { g.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1; g.drawImage(rdsGlow('#ffb060'), px + 4, y - 26, 16, 16); g.globalAlpha = 1; }
      if (a.mode === 'rummage') { g.globalAlpha = 0.45; g.fillStyle = '#c8b89a'; for (let k = 0; k < 3; k++) { const pp = (t * 1.5 + k / 3) % 1; g.fillRect(px + 9 + k * 2, y - 16 - pp * 8, 1, 1); } g.globalAlpha = 1; }
      if (a.mode === 'press' && Math.floor(t * 2) % 2) { g.fillStyle = '#a7f070'; g.fillRect(px + 10, top + 14, 1, 1); }
      if (a.mode === 'look' && a.fun >= 3) { g.globalAlpha = 0.5 + Math.sin(t * 2) * 0.3; g.fillStyle = '#ffcd75'; g.fillRect(px + 9, top - 3, 1, 1); g.fillRect(px + 12, top - 6, 1, 1); g.globalAlpha = 1; }
    }
    if (a.type === 'mope') { g.fillStyle = '#566c86'; g.fillRect(px - 3, top - 7, 12, 3); g.fillStyle = '#41a6f6'; if (Math.sin(G.time * 5) > 0) g.fillRect(px + 1, top - 3, 1, 2); }
  }
  // 冷：发抖
  const cold = rdIsNight() && !rdSum('warm') && rdStats().comfort < 1.2 && (!a || a.type !== 'sleep');
  let bub = me.bubbleT > 0 ? me.bubble : null;
  if (!bub) bub = me.food < 25 ? 'hungry' : me.water < 25 ? 'thirsty' : me.energy < 20 ? 'tired' : me.rad > 50 ? 'rad' : cold ? 'cold' : me.mood < 25 ? 'sad' : (a && a.type === 'fun' && a.fun >= 8 && me.mood > 70 ? 'happy' : null);
  if (me.bubbleT > 0) me.bubbleT -= 1 / 60;
  if (bub) rdDrawBubble(g, px + 2, top - 2, bub);
}

// ---------- 模式图标 ----------
function initRoadSprites() {
  SPR.road_icon = bigSprite(16, 16, (P, O, g) => {
    O(8, 14.5, 7, 1.2, 'rgba(10,10,25,0.35)');
    P(0, 11, 16, 3, '#4a4a52'); P(2, 12, 3, 1, '#c9a86a'); P(9, 12, 3, 1, '#c9a86a');
    P(2, 4, 9, 7, '#e8e4d8'); P(2, 7, 9, 1, '#ef7d57'); P(11, 6, 3, 5, '#e8e4d8'); P(12, 7, 2, 2, '#73b8d8');
    P(1, 5, 1, 5, '#8f6a42'); P(4, 2, 4, 2, '#566c86'); P(7, 2, 3, 1, '#94b0c2');
    O(4.5, 11.5, 1.6, 1.6, '#1a1c2c'); O(11.5, 11.5, 1.6, 1.6, '#1a1c2c');
  });
}
