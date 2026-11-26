// =============================================
//  公路求生：副本系统（设计见 tasks/副本设计.md）
//  每 250~350 公里拉响传送警报 → 和 3~5 个聊天室的人一起被传进限时副本 → 自动开车打怪抢分 →
//  按排名发奖 → 传回公路原位置。副本里公路时间不走、不耗油；车被打瘫 = 淘汰。
//  副本主题放在 RDX_THEMES（任务 6 往里加矿洞、鬼城、军阀基地、外星人基地）。
//  进副本时把公路上的东西（里程、建筑、路障、怪物、天气……）先收起来（R.dunStash），出来时原样放回；
//  在副本里存档 = 存进副本前的公路状态。
// =============================================
const RDX_THEMES = {
  trial: {
    name: '试炼场', dur: 180, test: true, color: '#e04a3a',
    desc: ['系统的入门试炼：一条封锁的竞技公路', '一边往前开一边打怪，比谁的分高', '车被打瘫就淘汰'],
    goals: '杀敌、跑得远、活到最后',
    slots: ['weapon', 'armor', 'ram', 'tires'], waveGap: [6, 10], hpMul: 0.75, dmgMul: 0.4, double: 999, // 教学关：怪少一点、弱一点
    res: { gold: { scrap: 60, ammo: 40, food: 10, water: 10 }, silver: { scrap: 35, ammo: 20 }, bronze: { scrap: 20, ammo: 10 }, fail: { scrap: 5 } },
  },
};
const RDX_LINES = {
  start: ['冲冲冲！', '别抢我的怪啊', '这次第一是我的', '又来？我车还没修好……', '保佑别遇到大家伙', '都小心点', '开干！', '谁跟我组队？', '我先走一步了', '紧张死了'],
  win: ['恭喜恭喜', '大佬带带我', '下次我一定赢', '运气好而已吧', '羡慕了', '这分数有点东西', '服了'],
  out: ['我车废了……', '先走一步，你们加油', '救命！', '这怪太猛了', '淘汰了，气死'],
};
const RDX_STASH_KEYS = ['km', 'sites', 'obs', 'mons', 'proj', 'fx', 'parts', 'floats', 'weather', 'reverse', 'search', 'driving', 'speedNow', 'view'];
function rdxEnsure(R) { if (R.dunNextKm == null) R.dunNextKm = Math.max(120, R.km) + 250 + Math.random() * 100; R.dunCount = R.dunCount || 0; }

// ---------- 模式钩子（js/modes/road.js 里改走这里） ----------
function rdxHookUpdate(dt) {
  const R = G.road;
  if (R && R.dun) { rdxUpdate(dt); return; }
  rdUpdate(dt);
  if (G.road && G.state === 'play') rdxAlarmTick(dt);
}
function rdxHookTap(sx, sy) { if (G.road && G.road.dun) return; rdTap(sx, sy); }

// ---------- 警报 ----------
function rdxAlarmTick(dt) {
  const R = G.road; rdxEnsure(R);
  if (!R.dunAlarm) {
    if (R.km >= R.dunNextKm && R.km > 120 && !R.broken) {
      R.dunAlarm = { t: 12, max: 12 };
      showBanner('空间波动！', '检测到副本传送信号，倒计时结束后强制传送', 4, '#c27bd6');
      rcSys('【空间波动】检测到副本传送信号，坐标锁定中……', 0);
      rcEvent('hello', { who: rcC().me }, { count: 2, vipChance: 0.3 });
      rdLog('传送警报响了！', '#c27bd6'); sfx('bad');
    }
    return;
  }
  const me = R.me, A = R.dunAlarm;
  A.wait = me.loc === 'out' || me.loc === 'site';
  if (A.wait) return;
  R.driving = false;
  A.t -= dt / (G.speed || 1);
  if (A.t <= 0) rdxEnter();
}
function rdxPickTheme(R) {
  const keys = Object.keys(RDX_THEMES).filter((k) => !RDX_THEMES[k].test);
  if (!R.dunCount || !keys.length) return 'trial';
  const bi = rdBiomeIndex(R.km), pref = keys.filter((k) => !RDX_THEMES[k].biomes || RDX_THEMES[k].biomes.includes(bi));
  const list = pref.length ? pref : keys;
  return list[Math.floor(Math.random() * list.length)];
}

// ---------- 进入 / 退出 ----------
function rdxEnter(themeId) {
  const R = G.road, C = rcEnsure();
  const id = themeId || rdxPickTheme(R), T = RDX_THEMES[id];
  R.dunStash = {};
  for (const k of RDX_STASH_KEYS) R.dunStash[k] = R[k];
  R.dunAlarm = null;
  // 参赛者：从聊天室抽 3~5 个活着的人（有时有一个 VIP）
  const P = rcPeople(), n = 3 + Math.floor(Math.random() * 3), npcs = [], used = {};
  for (let k = 0; k < 60 && npcs.length < n; k++) {
    const vip = npcs.length === 0 && Math.random() < 0.35, p = vip ? rcVip() : P.list[Math.floor(Math.random() * P.list.length)];
    if (!p || used[p.id] || C.dead[p.id]) continue;
    used[p.id] = true;
    npcs.push({ id: p.id, name: p.name, color: p.vip ? p.color : ['#8ab4d8', '#e8a060', '#a8d070', '#d890c0', '#e8d070', '#90d0c8'][npcs.length % 6], skill: (p.vip ? 1.1 : 0.6) + Math.random() * 0.4, veh: Object.keys(RD_VEHICLES)[Math.floor(Math.random() * 5)],
      score: 0, kill: 0, killN: 0, dist: 0, out: false, kAcc: 0, lag: (Math.random() - 0.5) * 0.6 });
  }
  const bi = rdBiomeIndex(R.km);
  R.dun = { id, phase: 'warpIn', pt: 0, t: 0, dur: T.dur, dist: 0, baseKm: bi * RD_BIOME_LEN + 30, realKm: R.km, kill: 0, killN: 0, out: false, npcs, waveT: 3, leadT: 0, lead: null };
  R.km = R.dun.baseKm; R.sites = []; R.obs = []; R.mons = []; R.proj = []; R.fx = []; R.parts = []; R.floats = [];
  R.weather = null; R.reverse = null; R.search = null; R.view = 'out'; R.driving = false; R.speedNow = 0;
  G.state = 'play';
  rcSys('【副本】「' + T.name + '」开启！参赛者：' + C.me + '、' + npcs.map((x) => x.name).join('、'), 0.5);
  npcs.forEach((x, i) => rcQueue(P.byId[x.id], 'hello', {}, 2 + i * 1.7, { text: RDX_LINES.start[Math.floor(Math.random() * RDX_LINES.start.length)] }));
  rdLog('被传送进了副本「' + T.name + '」', '#c27bd6');
  sfx('dawn');
}
function rdxExit() {
  const R = G.road, D = R.dun, st = rdStats();
  for (const k of RDX_STASH_KEYS) R[k] = R.dunStash[k];
  R.mons = R.mons || []; R.proj = []; R.fx = []; R.parts = []; R.floats = [];
  if (D.out) R.hpV = Math.max(R.hpV, Math.round(st.hp * 0.2));
  R.broken = false; R.driving = false; R.speedNow = 0;
  R.dun = null; R.dunStash = null;
  R.dunNextKm = R.km + 250 + Math.random() * 100;
  G.state = 'play';
  showBanner('回到了公路', '一切还是离开时的样子', 3, '#c27bd6');
}

// ---------- 副本里每帧 ----------
function rdxSpawn(D, T) {
  const R = G.road, behind = Math.random() < 0.25, x = rdVehX() + (behind ? -150 : 160 + Math.random() * 60), keep = R.km, n0 = R.mons.length;
  R.km = D.realKm; // 用真实里程挑怪、算血量（越往后越难）
  rdSpawnGroup(x, false, behind);
  R.km = keep;
  for (let i = n0; i < R.mons.length; i++) { const m = R.mons[i]; m.hp *= T.hpMul; m.max *= T.hpMul; m.dmg *= T.dmgMul || 1; m.patience = 999; }
}
function rdxUpdate(dt) {
  const R = G.road, D = R.dun, T = RDX_THEMES[D.id];
  D.pt += dt;
  if (D.phase === 'warpIn') { if (D.pt > 2.2) { D.phase = 'intro'; D.pt = 0; } return; }
  if (D.phase === 'intro') { if (D.pt > 3.6) { D.phase = 'run'; D.pt = 0; showBanner('开始！', T.goals, 2, T.color); } return; }
  if (D.phase === 'warpOut') { if (D.pt > 2) rdxExit(); return; }
  if (D.phase !== 'run') return;
  D.t += dt;
  const st = rdStats(); R.st = st;
  // 开车（自动、不耗油）
  const target = D.out ? 0 : Math.min(st.speed, 65);
  R.speedNow += Math.sign(target - R.speedNow) * Math.min(Math.abs(target - R.speedNow), 30 * dt);
  const dkm = R.speedNow * RD_KM_RATE * dt;
  D.dist += dkm; R.km += dkm; R.driving = !D.out;
  // 一波一波的怪
  D.waveT -= dt;
  if (D.waveT <= 0 && !D.out && D.t < D.dur - 6) { D.waveT = T.waveGap[0] + Math.random() * (T.waveGap[1] - T.waveGap[0]); rdxSpawn(D, T); if (D.t > (T.double || 60) && Math.random() < 0.4) rdxSpawn(D, T); }
  // 战斗（武器自动开火）+ 算击杀分
  const before = R.mons.slice();
  rdCombat(dt, st); rdFxTick(dt);
  for (const m of before) if (m.dead && !m._dc) { m._dc = 1; D.killN++; D.kill += 10 + RD_MONSTERS[m.type].hp / 5; }
  { const vx = rdVehX(); R.mons = R.mons.filter((m) => m.x > vx - 320); } // 被甩在后面太远的怪就不追了
  rcTick(dt / (G.speed || 1)); // 聊天室照常刷新（副本播报）
  // 淘汰
  if (R.hpV <= 0 && !D.out) {
    D.out = true; D.outT = D.t; R.mons = []; R.proj = [];
    showBanner('你被淘汰了', '车被打瘫了，等待本场结束', 3, '#ef7d57'); sfx('bad');
    rcSys('【副本播报】' + rcC().me + ' 被淘汰！', 0.3);
  }
  if (D.out) { R.mons = []; R.me.hp = Math.max(R.me.hp, 1); }
  rdxNpcTick(D, dt);
  // 领先者播报
  D.leadT -= dt;
  const list = rdxRanking(D);
  if (D.t > 12 && D.leadT <= 0 && list[0].name !== D.lead) { D.lead = list[0].name; D.leadT = 25; rcSys('【副本播报】当前第一：' + list[0].name + '（' + Math.round(list[0].score) + ' 分）', 0); }
  if (D.t >= D.dur || (D.out && D.t - D.outT > 4)) rdxFinish();
}
function rdxNpcTick(D, dt) {
  const P = rcPeople();
  for (const n of D.npcs) {
    if (n.out) continue;
    n.dist += (48 + n.skill * 18) * RD_KM_RATE * dt * (1 + n.lag * 0.1);
    n.kAcc += dt * (0.1 + 0.2 * n.skill) * Math.min(1.6, 0.5 + D.t / 90);
    while (n.kAcc >= 1) { n.kAcc -= 1; n.killN++; n.kill += 10 + (20 + Math.random() * 60) / 5; }
    if (Math.random() < dt * 0.0016 * (2.2 - n.skill) * (D.t / D.dur + 0.3)) {
      n.out = true;
      rcSys('【副本播报】' + n.name + ' 被淘汰！', 0.2);
      rcQueue(P.byId[n.id], 'hello', {}, 1.5, { text: RDX_LINES.out[Math.floor(Math.random() * RDX_LINES.out.length)] });
    }
  }
}
// 分数：击杀 + 路程 ×2/公里 + 存活（结束时才加）
function rdxRanking(D, final) {
  const R = G.road, st = R.st || rdStats(), me = { me: true, name: rcC().me, color: '#ffcd75', killN: D.killN, kill: D.kill, dist: D.dist, out: D.out };
  me.score = D.kill + D.dist * 2 + (final && !D.out ? 150 + 50 * Math.max(0, R.hpV) / st.hp : 0);
  for (const n of D.npcs) n.score = n.kill + n.dist * 2 + (final && !n.out ? 150 + 50 * (0.3 + n.skill * 0.4) : 0);
  return [me, ...D.npcs].sort((a, b) => b.score - a.score);
}
// ---------- 结算 + 发奖 ----------
function rdxFinish() {
  const R = G.road, D = R.dun, T = RDX_THEMES[D.id], P = rcPeople();
  const list = rdxRanking(D, true).map((x) => Object.assign({}, x)), rank = list.findIndex((x) => x.me) + 1; // 拷一份：结算后分数不再变
  const tier = D.out ? 'fail' : rank === 1 ? 'gold' : rank <= 3 ? 'silver' : 'bronze';
  const rewards = [];
  const res = T.res[tier];
  for (const k in res) { const got = rdGain(k, res[k]); if (got > 0) rewards.push({ res: k, n: got }); }
  // 零件：冠军必得一个高 2 品阶的主题零件，前三 50% 得高 1 品阶
  const inst = rdInstalled().filter((p) => p.slot !== 'in'), avg = inst.length ? inst.reduce((s, p) => s + p.tier, 0) / inst.length : 1;
  const want = tier === 'gold' ? 2 : tier === 'silver' && Math.random() < 0.5 ? 1 : -1;
  if (want > 0) {
    const tt = Math.max(1, Math.min(6, Math.round(avg) + want));
    let pool = RD_PART_LIST.filter((p) => T.slots.includes(p.slot) && p.tier === tt);
    if (!pool.length) pool = RD_PART_LIST.filter((p) => T.slots.includes(p.slot) && Math.abs(p.tier - tt) <= 1);
    if (pool.length) { const p = pool[Math.floor(Math.random() * pool.length)]; R.inv.push(p.id); rewards.push({ part: p.id }); if (tier === 'gold' && !R.bps[p.id] && Math.random() < 0.5) { R.bps[p.id] = 1; rewards.push({ bp: p.id }); } }
  }
  D.result = { list, rank, tier, rewards };
  D.phase = 'result'; D.pt = 0; R.driving = false;
  R.dunCount = (R.dunCount || 0) + 1;
  const top = list.slice(0, 3).map((x, i) => (i + 1) + '. ' + x.name + '（' + Math.round(x.score) + '）').join('　');
  rcSys('【副本结束】「' + T.name + '」排名：' + top, 0.5);
  for (let k = 0; k < 3; k++) { const p = rcPickSpeaker(); if (p) rcQueue(p, 'hello', {}, 2 + k * 2.2, { text: (list[0].me && k === 0 ? '@' + list[0].name + ' ' : '') + RDX_LINES.win[Math.floor(Math.random() * RDX_LINES.win.length)] }); }
  rdLog('副本「' + T.name + '」结束：第 ' + rank + ' 名（' + { gold: '冠军', silver: '前三', bronze: '参与', fail: '失败' }[tier] + '）', T.color);
  sfx(tier === 'fail' ? 'bad' : 'win');
}

// ---------- 画面 ----------
const RDX_CAR_IMG = {};
function rdxCarImg(veh) { // 其他参赛者的车（缓存一张静态图）
  if (RDX_CAR_IMG[veh] !== undefined) return RDX_CAR_IMG[veh];
  let cv = null;
  const R = G.road, keep = R.veh;
  try { const L = RD_VEHICLES[veh].len; R.veh = veh; cv = createCanvas((L + 12) * RD_Q, 50 * RD_Q); const g = cv.getContext('2d'); g.setTransform(RD_Q, 0, 0, RD_Q, 0, 0); rdcDrawCar(g, L + 6, 46, { moving: false, wheels: true, hit: false, driver: true, dust: false, gy: 46 }); }
  catch (e) { cv = null; } finally { R.veh = keep; }
  return (RDX_CAR_IMG[veh] = cv);
}
function rdxUI(ctx) {
  const R = G.road, D = R.dun, T = RDX_THEMES[D.id], sw = G.sw, sh = G.sh, t = G.time;
  uiButtons = []; scrollAreas = [];
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  // 主题气氛：四角闪警戒红光
  const pulse = 0.18 + Math.sin(t * 3) * 0.08;
  for (const [x, y] of [[0, 0], [sw, 0]]) { const gr = ctx.createRadialGradient(x, y, 0, x, y, Math.min(sw, sh) * 0.6); gr.addColorStop(0, rdHexA(T.color, pulse)); gr.addColorStop(1, rdHexA(T.color, 0)); ctx.fillStyle = gr; ctx.fillRect(0, 0, sw, sh); }
  // 其他参赛者的车（半透明，在后面的车道）
  if (D.phase === 'run' || D.phase === 'result') for (const n of D.npcs) {
    const img = rdxCarImg(n.veh); if (!img) continue;
    const wx = (D.baseKm + n.dist) * RD_PX_KM, p = rdToScreen(rdSX(wx), RDV.gy - 15), s = RDV.S / G.dpr / RD_Q * 0.62; // 远一点的车道：小一号
    const w = img.width * s, h = img.height * s, x = Math.max(4, Math.min(sw - w - 4, p.x - w)), off = Math.abs(p.x - w - x) > 2;
    ctx.globalAlpha = n.out ? 0.22 : off ? 0.35 : 0.5; ctx.imageSmoothingEnabled = false; ctx.drawImage(img, x, p.y - h, w, h);
    ctx.globalAlpha = 1; drawText(ctx, (off ? (p.x < x ? '◀ ' : '') : '') + n.name + (n.out ? '（淘汰）' : '') + (off && p.x > x + w ? ' ▶' : ''), x + w / 2, p.y - h - 6, 10, n.out ? '#94b0c2' : n.color, 'center', false);
  }
  // 仪表盘（只看，不能点）
  rdDrawDash(ctx, 8, 6, Math.min(380, sw - 120), 84); uiButtons = [];
  drawButton(ctx, sw - 46, 4, 40, 30, '‖', () => { G.state = 'paused'; }, { size: 15 });
  drawButton(ctx, sw - 94, 4, 44, 30, '×' + G.speed, () => { nextSpeed(); }, { size: 13 });
  for (const f of R.floats || []) rdFloatDraw(ctx, f);
  if (D.phase === 'run' || D.phase === 'result') rdxHud(ctx, D, T);
  if (D.phase === 'warpIn' || D.phase === 'warpOut') rdxWarp(ctx, D.phase === 'warpIn' ? D.pt / 2.2 : 1 - D.pt / 2);
  if (D.phase === 'intro') rdxIntro(ctx, D, T);
  if (D.phase === 'result') rdxResult(ctx, D, T);
  if (G.banner) { const b = G.banner; ctx.globalAlpha = Math.max(0, Math.min(1, b.life, (b.max - b.life) * 4)); drawText(ctx, b.text, sw / 2, sh * 0.3, sw < 500 ? 18 : 22, b.color || '#f4f4f4', 'center'); if (b.sub) drawText(ctx, b.sub, sw / 2, sh * 0.3 + 26, 13, '#c8d6e5', 'center'); ctx.globalAlpha = 1; }
  if (G.state === 'dialog') drawDialog(ctx);
  if (G.state === 'paused') drawPauseMenu(ctx); else drawConfirm(ctx);
}
function rdHexA(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')'; }
function rdxPanel(ctx, x, y, w, h, col) { ctx.fillStyle = 'rgba(24,18,14,0.88)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = col || '#c27bd6'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h); }
function rdxHud(ctx, D, T) {
  const sw = G.sw, left = Math.max(0, D.dur - D.t), list = D.result ? D.result.list : rdxRanking(D);
  // 顶部：主题 + 倒计时条
  const portrait = sw < G.sh, bw = portrait ? sw - 16 : Math.min(300, sw - 140), bx = sw / 2 - bw / 2, by = 96;
  rdxPanel(ctx, bx, by, bw, 34, T.color);
  drawText(ctx, '「' + T.name + '」' + String(Math.floor(left / 60)) + ':' + String(Math.floor(left % 60)).padStart(2, '0'), sw / 2, by + 12, 13, '#ffcd75', 'center');
  ctx.fillStyle = '#120c08'; ctx.fillRect(bx + 8, by + 23, bw - 16, 5); ctx.fillStyle = T.color; ctx.fillRect(bx + 8, by + 23, (bw - 16) * left / D.dur, 5);
  // 右侧：实时排名
  const rw = Math.min(190, sw * (portrait ? 0.56 : 0.42)), rx = sw - rw - 8, ry = portrait ? 150 : 42;
  rdxPanel(ctx, rx, ry, rw, 20 + list.length * 17, '#c27bd6');
  drawText(ctx, '实时排名', rx + 8, ry + 11, 11, '#c27bd6', 'left');
  list.forEach((x, i) => { const yy = ry + 26 + i * 17; if (x.me) { ctx.fillStyle = 'rgba(255,205,117,0.18)'; ctx.fillRect(rx + 3, yy - 8, rw - 6, 16); } drawText(ctx, (i + 1) + '. ' + x.name + (x.out ? '（淘汰）' : ''), rx + 8, yy, 11, x.out ? '#6a7484' : x.me ? '#ffcd75' : x.color, 'left', false); drawText(ctx, String(Math.round(x.score)), rx + rw - 8, yy, 11, '#f4f4f4', 'right', false); });
  // 左下：自己的分数构成
  const me = list.find((x) => x.me);
  drawText(ctx, '击杀 ' + D.killN + ' · 路程 ' + D.dist.toFixed(1) + ' 公里 · 分数 ' + Math.round(me.score), 10, portrait ? 142 : 104, 12, '#ffcd75', 'left');
}
function rdxWarp(ctx, p) { // 传送漩涡：一圈圈光环往外扩，最后满屏闪白
  const sw = G.sw, sh = G.sh, cx = sw / 2, cy = sh * 0.45, t = G.time;
  ctx.fillStyle = 'rgba(20,8,40,' + (0.5 * Math.min(1, p * 1.5)).toFixed(3) + ')'; ctx.fillRect(0, 0, sw, sh);
  for (let k = 0; k < 7; k++) { const r = ((t * 120 + k * 60) % 420) * (0.3 + p), a = (1 - r / 500) * Math.min(1, p * 2); if (a <= 0) continue; ctx.strokeStyle = k % 2 ? 'rgba(115,239,247,' + a.toFixed(2) + ')' : 'rgba(194,123,214,' + a.toFixed(2) + ')'; ctx.lineWidth = 3 + k % 3; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.55, Math.sin(t + k) * 0.2, 0, 7); ctx.stroke(); }
  for (let k = 0; k < 40; k++) { const a = k / 40 * 6.283 + t * 2, d = (1 - ((t * 0.8 + k * 0.137) % 1)) * 260 * (0.4 + p); ctx.fillStyle = k % 2 ? '#e0c8ff' : '#a8f8ff'; ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 3, 3); }
  const flash = p > 0.72 ? (p - 0.72) / 0.28 : 0; if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, flash).toFixed(3) + ')'; ctx.fillRect(0, 0, sw, sh); }
  drawText(ctx, '空间传送中……', cx, sh * 0.78, 16, '#e0c8ff', 'center');
}
function rdxIntro(ctx, D, T) {
  const sw = G.sw, sh = G.sh, w = Math.min(440, sw - 24), h = 230 + D.npcs.length * 18, x = sw / 2 - w / 2, y = Math.max(96, sh / 2 - h / 2);
  ctx.fillStyle = 'rgba(10,6,20,0.55)'; ctx.fillRect(0, 0, sw, sh);
  rdxPanel(ctx, x, y, w, h, T.color);
  drawText(ctx, '副本「' + T.name + '」', sw / 2, y + 26, 22, T.color, 'center');
  T.desc.forEach((l, i) => drawText(ctx, l, sw / 2, y + 56 + i * 18, 12, '#c8d6e5', 'center', false));
  drawText(ctx, '目标：' + T.goals + ' · 时限 ' + Math.round(D.dur / 60) + ' 分钟', sw / 2, y + 60 + T.desc.length * 18, 12, '#ffcd75', 'center', false);
  const ly = y + 90 + T.desc.length * 18;
  drawText(ctx, '参赛者', sw / 2, ly, 13, '#c27bd6', 'center');
  [{ name: rcC().me + '（你）', color: '#ffcd75', veh: G.road.veh }, ...D.npcs].forEach((n, i) => drawText(ctx, n.name + ' · ' + RD_VEHICLES[n.veh].name, sw / 2, ly + 20 + i * 18, 12, n.color, 'center', false));
  const left = 3.6 - D.pt, num = left > 3 ? '' : left > 0.6 ? String(Math.ceil(left - 0.6)) : '开始！';
  if (num) drawText(ctx, num, sw / 2, y + h - 22, 28, '#f4f4f4', 'center');
}
function rdxResult(ctx, D, T) {
  const sw = G.sw, sh = G.sh, Rz = D.result, w = Math.min(460, sw - 20), h = Math.min(sh - 40, 210 + Rz.list.length * 22 + Math.ceil(Rz.rewards.length / 2) * 30), x = sw / 2 - w / 2, y = sh / 2 - h / 2;
  ctx.fillStyle = 'rgba(10,6,20,0.6)'; ctx.fillRect(0, 0, sw, sh);
  const tierName = { gold: '冠军！', silver: '前三名', bronze: '完成参与', fail: '被淘汰' }[Rz.tier], tierCol = { gold: '#ffcd75', silver: '#c8d6e5', bronze: '#d89a6a', fail: '#ef7d57' }[Rz.tier];
  rdxPanel(ctx, x, y, w, h, tierCol);
  drawText(ctx, '「' + T.name + '」结束 · 第 ' + Rz.rank + ' 名 · ' + tierName, sw / 2, y + 22, 17, tierCol, 'center');
  let yy = y + 50;
  drawText(ctx, '排名', x + 14, yy, 11, '#94b0c2', 'left', false); drawText(ctx, '击杀', x + w * 0.55, yy, 11, '#94b0c2', 'center', false); drawText(ctx, '路程', x + w * 0.7, yy, 11, '#94b0c2', 'center', false); drawText(ctx, '分数', x + w - 14, yy, 11, '#94b0c2', 'right', false);
  yy += 18;
  Rz.list.forEach((r, i) => { if (r.me) { ctx.fillStyle = 'rgba(255,205,117,0.16)'; ctx.fillRect(x + 6, yy - 10, w - 12, 20); } const c = r.out ? '#6a7484' : r.me ? '#ffcd75' : r.color; drawText(ctx, (i + 1) + '. ' + r.name + (r.out ? '（淘汰）' : ''), x + 14, yy, 12, c, 'left', false); drawText(ctx, String(r.killN), x + w * 0.55, yy, 12, c, 'center', false); drawText(ctx, r.dist.toFixed(1), x + w * 0.7, yy, 12, c, 'center', false); drawText(ctx, String(Math.round(r.score)), x + w - 14, yy, 12, c, 'right', false); yy += 22; });
  yy += 6; drawText(ctx, '获得奖励', x + 14, yy, 13, '#a7f070', 'left'); yy += 14;
  Rz.rewards.forEach((rw, i) => {
    const cx = x + 14 + (i % 2) * (w - 28) / 2, cy = yy + Math.floor(i / 2) * 30;
    if (rw.res) { rdIcon(ctx, rw.res, cx, cy, 24); drawText(ctx, RD_RES[rw.res].name + ' +' + rw.n, cx + 30, cy + 12, 12, '#f4f4f4', 'left', false); }
    else { const p = RD_PARTS[rw.part || rw.bp]; rdoIcon(ctx, p, cx, cy, 26); drawText(ctx, (rw.bp ? '图纸：' : '') + p.name, cx + 32, cy + 13, 12, RD_TIER_COLOR[p.tier], 'left', false); }
  });
  if (!Rz.rewards.length) drawText(ctx, '（货舱满了，什么也没装下）', x + 14, yy + 10, 12, '#94b0c2', 'left', false);
  drawButton(ctx, sw / 2 - 70, y + h - 46, 140, 36, '返回公路', () => { D.phase = 'warpOut'; D.pt = 0; }, { color: '#5d275d', size: 14 });
}
// 公路上：警报倒计时
function rdxDrawAlarm(ctx) {
  const R = G.road, A = R.dunAlarm; if (!A) return;
  const sw = G.sw, sh = G.sh, t = G.time;
  ctx.save(); ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.fillStyle = 'rgba(194,123,214,' + (0.08 + Math.sin(t * 6) * 0.05).toFixed(3) + ')'; ctx.fillRect(0, 0, sw, sh);
  rdxPanel(ctx, sw / 2 - 150, sh * 0.18, 300, 54, '#c27bd6');
  drawText(ctx, '⚠ 副本传送警报', sw / 2, sh * 0.18 + 16, 14, '#e0c8ff', 'center');
  drawText(ctx, A.wait ? '回到车上后开始传送' : '倒计时 ' + Math.ceil(A.t) + ' 秒', sw / 2, sh * 0.18 + 38, 13, A.wait ? '#ffcd75' : '#f4f4f4', 'center');
  ctx.restore();
}
// 调试 / 测试用：马上触发一场
function rdxDebug(theme) { const R = G.road; rdxEnsure(R); rdxEnter(theme); }
