// =============================================
//  公路求生：界面（顶栏、状态、底部按钮、改装 / 仓库 / 制作 / 研究 / 日志 / 交易面板、开局选车）
// =============================================

// 改装件效果的简短说明
function rdFxText(p) {
  const f = p.fx, out = [];
  const pct = (v) => Math.round(v * 100) + '%';
  if (p.slot === 'weapon' || p.slot === 'hand') {
    out.push('伤害 ' + f.dmg + (f.count ? '×' + f.count : ''), '射速 ' + f.rate + '/秒', f.range < 20 ? '近战' : '射程 ' + f.range);
    if (f.ammo && f.ammo !== 'none' && f.use) out.push('耗' + RD_RES[f.ammo].name + ' ' + f.use + '/发'); else if (f.ammo === 'none') out.push('不耗弹药');
    if (f.splash) out.push('爆炸'); if (f.pierce) out.push(f.pierce >= 99 ? '全穿透' : '穿透'); if (f.burn) out.push('燃烧'); if (f.slow) out.push('减速'); if (f.chain) out.push('连锁闪电'); if (f.pull) out.push('吸附'); if (f.noAir) out.push('打不到飞行怪');
    if (f.turret) out.unshift('自瞄炮塔·360°'); if (f.homing) out.push('追踪'); if (f.airBonus) out.push('对空+' + pct(f.airBonus));
    return out.join(' · ');
  }
  const L = {
    hp: (v) => '耐久+' + v, armor: (v) => '护甲' + pct(v), shield: (v) => '护盾' + v, regen: (v) => '自修' + v + '/时', speed: (v) => '速度' + (v >= 0 ? '+' : '') + v, speedPct: (v) => '速度+' + pct(v),
    fuelPct: (v) => v <= -1 ? '不耗油' : '油耗' + (v >= 0 ? '+' : '') + pct(v), torque: (v) => '载重' + (v >= 0 ? '+' : '') + v, alt: (v) => '行驶发电' + v + '/时', electric: () => '改为耗电',
    ram: (v) => '撞击+' + v, obs: (v) => '路障伤害-' + pct(Math.min(1, v)), thorns: (v) => '反伤' + v, tank: (v) => '油箱+' + v, battery: (v) => '电池+' + v, cargo: (v) => '货舱+' + v,
    cells: (v) => '地面+' + v + '格', wcells: (v) => '墙面+' + v + '格', mounts: (v) => '武器挂点+' + v, solar: (v) => '太阳能' + v + '/时', wind: (v) => '风力' + v + '/时', light: () => '夜视',
    rangePct: (v) => '射程+' + pct(v), lookout: () => '看到前方建筑', radar: () => '雷达', searchSpd: (v) => '搜索加快' + pct(v), lootBonus: (v) => '找到更多' + pct(v), rain: (v) => '雨水' + v + '/天',
    alienSense: () => '感应外星遗迹', nightSolar: () => '夜间发电', stealth: (v) => '遇怪-' + pct(v), trade: () => '商人更爱来', scrapBonus: (v) => '废料+' + pct(v), hover: () => '反重力漂浮',
    spaceMul: (v) => '车内空间×' + v, snow: () => '雪地不减速', comfort: (v) => '舒适+' + v,
    armorP: (v) => '人物护甲' + pct(v), hpP: (v) => '生命+' + v, radRes: (v) => '防辐射' + pct(Math.min(1, v)), walk: (v) => '走路+' + pct(v), regenP: (v) => '回血' + v + '/时',
    sleep: (v) => '睡眠×' + v, sleepHeal: (v) => '睡觉回血' + v, slowNeeds: () => '睡时少饿', cook: (v) => '食物顶饱×' + v, foodGen: (v) => '食物+' + v + '/天', fridge: (v) => v >= 1 ? '食物不变质' : '减缓变质', waterGen: (v) => '水+' + v + '/天',
    heal: (v) => '治疗' + v + '/时', radClean: (v) => '去辐射' + v + '/时', medGen: (v) => '药+' + v + '/天', gen: (v) => '发电机' + v + '/时', genFree: (v) => '免费发电' + v + '/时',
    research: (v) => '研究Lv' + v, autopilot: () => '自动驾驶', aim: (v) => '武器伤害+' + pct(v), craft: (v) => '制作Lv' + v, repair: (v) => '修车' + v + '/时', fun: (v) => '娱乐+' + v, fitness: (v) => '生命上限+' + v,
    pet: () => '宠物窝', warm: () => '保暖', coffee: () => '提神', dine: () => '好好吃饭', wallpaper: () => '换墙纸', floorWood: () => '木地板', rug: () => '地毯',
  };
  for (const k in f) if (L[k]) out.push(L[k](f[k]));
  if (p.slot === 'in') out.push((p.layer === 'wall' ? '墙面' : '地面') + (p.w || 1) + '格');
  if (p.pw > 0) out.push('耗电' + p.pw + '/时');
  if (p.wt && RD_SLOTS[p.slot].ext) out.push('重' + p.wt);
  return out.join(' · ');
}
function rdPartLabel(p) { return '【' + RD_TIER_NAME[p.tier] + '】' + p.name; }

// ---------- 主界面 ----------
function rdDrawUI(ctx) {
  uiButtons = []; scrollAreas = [];
  const R = G.road, sw = G.sw, sh = G.sh, st = R.st || rdStats();
  if (R.dun) { rdxUI(ctx); return; } // 副本里换成副本的界面（js/roaddungeon.js）
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  const playing = G.state === 'play';
  // ---- 左上角：仪表盘（车速、里程、油量、电量、弹药、警示灯；点它打开仓库看所有资源） ----
  const portrait = sw < sh;
  const tickW = portrait ? sw - 16 : Math.min(360, sw * 0.42);
  const dashH = 84, dashW = Math.floor(portrait ? sw - 16 - 92 : Math.min(380, sw - tickW - 24));
  rdDrawDash(ctx, 8, 6, dashW, dashH);
  const topH = 6 + dashH + 2;
  drawButton(ctx, sw - 46, 4, 40, 30, '‖', () => { G.state = 'paused'; }, { size: 15 });
  drawButton(ctx, sw - 94, 4, 44, 30, '×' + G.speed, () => { nextSpeed(); }, { size: 13 });
  // ---- 信息行 ----
  const h = Math.floor(rdHour()), mi = Math.floor((rdHour() % 1) * 60);
  let info = '第' + rdDay() + '天 ' + String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0') + (rdIsNight() ? ' ☾' : ' ☀') + ' · ' + rdBiomeAt(R.km).name;
  if (R.weather) info += ' · ' + R.weather.name;
  drawText(ctx, info, 8, topH + 12, 12, '#ffcd75', 'left');
  // 前方建筑（瞭望台 / 雷达 / 车载电脑）
  let iy = topH + 30;
  const nx = rdNextSite();
  if (nx && st.lookout) {
    const S = RD_SITES[nx.type];
    let t = '前方 ' + Math.max(0, nx.km - R.km).toFixed(1) + ' 公里：' + S.name;
    if (st.radar) t += '（危险' + (nx.danger < 0.2 ? '低' : nx.danger < 0.4 ? '中' : '高') + (S.slots.length ? '，可能有' + S.slots.slice(0, 3).map((k) => RD_SLOTS[k].name).join('/') : '') + '）';
    drawText(ctx, t, 8, iy, 11, '#73eff7', 'left', false); iy += 16;
  }
  // ---- 聊天室滚动条 ----
  if (playing) {
    const th = rcTicker(ctx, portrait ? 8 : sw - tickW - 8, portrait ? iy : 40, tickW);
    if (portrait) iy += th + 4;
  }
  // ---- 状态条 ----
  // 油门踏板：放在车辆正下方（手机竖屏时状态条挪到踏板下面）
  const bh = 48, yb = sh - bh - 6;
  const roadY = Math.round(RDV.gy * RDV.S / G.dpr);
  const carFront = rdToScreen(RDV.ax, RDV.gy).x, carC = carFront - rdVeh().len * RDV.S / G.dpr / 2;
  let pedTop = roadY + 24, pedH = Math.min(132, (portrait ? yb - 150 : yb - 10) - pedTop), pedX;
  if (pedH >= 86) pedX = carC - pedH * 0.34; // 车正下方
  else { pedH = Math.min(120, yb - 10 - Math.max(topH + 40, roadY - 80)); pedTop = yb - 10 - pedH; pedX = carFront + 18; } // 横屏手机下面放不下：放在车头前面
  const pedW = Math.round(pedH * 0.68);
  const ped = { x: Math.round(Math.max(8, Math.min(sw - pedW - 8, pedX))), y: pedTop, w: pedW, h: pedH };
  const bx = 8, by = portrait ? ped.y + ped.h + 10 : iy + 2, bw = portrait ? Math.min(170, (sw - 24) / 2) : 132;
  const me = R.me, maxHp = rdMaxHp();
  const bars = [
    ['生命', me.hp / maxHp, '#b13e53', Math.round(me.hp)], ['饱食', me.food / 100, '#a7f070', Math.round(me.food)], ['水分', me.water / 100, '#41a6f6', Math.round(me.water)],
    ['精力', me.energy / 100, '#ffcd75', Math.round(me.energy)], ['心情', me.mood / 100, '#c27bd6', Math.round(me.mood)], ['辐射', me.rad / 100, '#73eff7', Math.round(me.rad)],
    ['车辆', R.hpV / st.hp, '#94b0c2', Math.round(R.hpV) + '/' + st.hp],
  ];
  if (st.shieldMax) bars.push(['护盾', R.shield / st.shieldMax, '#73eff7', Math.round(R.shield)]);
  bars.forEach((b, i) => {
    const col = portrait ? i % 2 : 0, row = portrait ? Math.floor(i / 2) : i;
    const xx = bx + col * (bw + 8), yy = by + row * 16;
    // 暖色像素风状态条：深褐底 + 描边 + 两段明暗的条（上亮下暗）
    ctx.fillStyle = 'rgba(30,23,18,0.82)'; ctx.fillRect(xx, yy, bw, 13);
    const bad = (b[0] === '辐射' ? b[1] > 0.5 : b[1] < 0.25), bl = Math.max(0, Math.min(1, b[1])) * (bw - 38);
    ctx.fillStyle = '#120c08'; ctx.fillRect(xx + 33, yy + 2, bw - 36, 9);
    ctx.fillStyle = rdShade(b[2], -0.25); ctx.fillRect(xx + 34, yy + 3, bl, 7); ctx.fillStyle = b[2]; ctx.fillRect(xx + 34, yy + 3, bl, 4); ctx.fillStyle = rdShade(b[2], 0.35); ctx.fillRect(xx + 34, yy + 3, bl, 1);
    if (bad && Math.floor(G.time * 2.5) % 2) { ctx.fillStyle = 'rgba(239,125,87,0.25)'; ctx.fillRect(xx, yy, bw, 13); }
    drawText(ctx, b[0], xx + 3, yy + 7, 10, bad ? '#ef7d57' : '#c8d6e5', 'left', false);
    drawText(ctx, String(b[3]), xx + bw - 3, yy + 7, 10, '#f4f4f4', 'right', false);
  });
  // 当前在干什么
  const doing = rdDoingText();
  if (doing) drawText(ctx, doing, bx, by + (portrait ? Math.ceil(bars.length / 2) : bars.length) * 16 + 8, 11, '#c8d6e5', 'left', false);
  // ---- 底部按钮 ----
  ctx.fillStyle = 'rgba(26,28,44,0.85)'; ctx.fillRect(0, yb - 6, sw, bh + 12); addButton(0, yb - 6, sw, bh + 12, null);
  const outside = me.loc === 'out' || me.loc === 'site';
  rdDrawPedal(ctx, ped, R.driving, outside);
  const btns = [
    { l: R.view === 'in' ? (rdVeh().tent ? '公路' : '车外') : (rdVeh().tent ? '营地' : '车内'), f: () => { R.view = R.view === 'in' ? 'out' : 'in'; } },
    { l: '改装', f: () => rdOpenPanel('garage') },
    { l: '仓库', f: () => rdOpenPanel('inv'), badge: R.inv.length },
    { l: '制作', f: () => rdOpenPanel('craft'), badge: R.craftQ.length },
    { l: '研究', f: () => rdOpenPanel('research') },
    { l: '日志', f: () => rdOpenPanel('log') },
    { l: '聊天', f: () => rdOpenPanel('chat'), badge: R.chat ? R.chat.unread : 0 },
  ];
  const gap = 5, w = Math.min(86, (sw - 12 - gap * (btns.length - 1)) / btns.length);
  let x0 = (sw - (w * btns.length + gap * (btns.length - 1))) / 2;
  btns.forEach((b) => {
    drawButton(ctx, x0, yb, w, bh, b.l, b.dim ? null : b.f, { color: b.c || '#29366f', size: w < 52 ? 13 : 15, dim: b.dim });
    if (b.badge) { ctx.fillStyle = '#b13e53'; ctx.fillRect(x0 + w - 16, yb + 2, 14, 12); drawText(ctx, String(b.badge), x0 + w - 9, yb + 8, 9, '#f4f4f4', 'center'); }
    x0 += w + gap;
  });
  // ---- 建筑名字 ----
  if (R.view === 'out') {
    for (const s of R.sites) {
      const S = RD_SITES[s.type], p = rdToScreen(rdSX(s.km * RD_PX_KM), RDV.gy - S.h - 10);
      if (p.x < -40 || p.x > sw + 40) continue;
      drawText(ctx, S.name + (s.searched ? '（已搜）' : ''), p.x, p.y, 11, s.searched ? '#566c86' : '#f4f4f4', 'center');
    }
  }
  // ---- 搜索按钮（建筑旁边） ----
  if (playing && R.view === 'out') {
    const s = rdNearSite();
    if (s && !outside) {
      const S = RD_SITES[s.type], p = rdToScreen(rdSX(s.km * RD_PX_KM), RDV.gy - S.h - 20);
      const label = S.trade ? '拜访 ' + S.name : '搜索 ' + S.name + '（约' + rdSearchDur(s).toFixed(1) + '小时）';
      ctx.font = 'bold 13px ' + FONT;
      const lw = ctx.measureText(label).width + 24, lx = Math.max(6, Math.min(sw - lw - 6, p.x - lw / 2)), ly = Math.max(topH + 40, p.y - 40);
      drawButton(ctx, lx, ly, lw, 34, label, () => rdStartSearch(s), { color: S.trade ? '#5d275d' : '#a8794f', size: 13, active: true });
    }
    // 开过头了：倒车回去
    const bs = !outside && !R.broken ? rdBehindSite() : null;
    if (bs && !s) {
      const S = RD_SITES[bs.type], dist = (R.km - bs.km).toFixed(1);
      const label = R.reverse === bs ? '◀ 正在倒车……（' + dist + ' 公里）' : '◀ 倒车回去' + (S.trade ? '拜访 ' : '搜索 ') + S.name + '（' + dist + ' 公里）';
      ctx.font = 'bold 13px ' + FONT;
      const lw = ctx.measureText(label).width + 24;
      drawButton(ctx, 8, yb - 50, lw, 34, label, R.reverse === bs ? () => { R.reverse = null; } : () => rdStartReverse(bs), { color: '#566c86', size: 13, active: R.reverse === bs });
    }
    if (outside && R.search) {
      const t = R.search.phase === 'in' ? '正在搜索……' : R.search.phase === 'back' ? '回车上……' : '走向建筑……';
      drawText(ctx, t, sw / 2, yb - 22, 14, '#ffcd75', 'center');
    }
  }
  // 车内：提示可以拖动
  if (R.view === 'in' && playing) {
    drawText(ctx, (rdVeh().tent ? '营地' : '车内') + ' · 左右拖动查看 · 舒适度 ' + st.comfort.toFixed(1) + (R.powered === false ? ' · 停电中！' : ''), sw / 2, yb - 22, 12, R.powered === false ? '#ef7d57' : '#c8d6e5', 'center', false);
    if (me.loc === 'out' || me.loc === 'site') drawText(ctx, '（你下车搜索去了，车里没人）', sw / 2, yb - 40, 12, '#94b0c2', 'center', false);
  }
  // 车外飘字
  for (const f of R.floats || []) rdFloatDraw(ctx, f); // 掉落物飘字（弹出 + 深褐描边 + 资源小图标）
  ctx.globalAlpha = 1;
  // ---- 横幅 ----
  if (G.banner) {
    const b = G.banner;
    ctx.globalAlpha = Math.max(0, Math.min(1, b.life, (b.max - b.life) * 4));
    const yy = sh * 0.3;
    drawText(ctx, b.text, sw / 2, yy, sw < 500 ? 18 : 22, b.color || '#f4f4f4', 'center');
    if (b.sub) wrapText(ctx, b.sub, Math.min(560, sw - 32), 13).forEach((ln, k) => drawText(ctx, ln, sw / 2, yy + 26 + k * 18, 13, '#c8d6e5', 'center'));
    ctx.globalAlpha = 1;
  }
  if (R.dunAlarm) rdxDrawAlarm(ctx); // 副本传送警报
  if (G.state === 'rpanel') rdDrawPanel(ctx);
  if (G.state === 'dialog') drawDialog(ctx);
  if (G.state === 'over') drawEndOverlay(ctx, false);
  if (G.state === 'paused') drawPauseMenu(ctx); else drawConfirm(ctx);
}
// 像素风油门踏板（出发 / 停车）：停着时踏板抬起、写「出发」；开车时踏板被踩下去、写「停车」
function rdDrawPedal(ctx, b, driving, dim) {
  const labH = 26;
  const u = Math.max(2, Math.floor(b.w / 18)); // 一个像素块的大小
  const cols = Math.floor(b.w / u), rows = Math.floor((b.h - labH - 4) / u), ox = b.x + Math.floor((b.w - cols * u) / 2);
  const P = (gx, gy, gw, gh, c) => { ctx.fillStyle = c; ctx.fillRect(ox + gx * u, b.y + gy * u, gw * u, gh * u); };
  const press = driving ? Math.max(2, Math.floor(rows * 0.14)) : 0; // 踩下去：踏板变矮（往里倾斜）
  ctx.globalAlpha = dim ? 0.45 : 1;
  // 地板上的底座 + 铰链
  P(0, rows - 2, cols, 2, '#262b44'); P(0, rows - 2, cols, 1, '#3b4458');
  P(2, rows - 3, cols - 4, 1, '#94b0c2'); P(3, rows - 3, 1, 1, '#c8d6e5');
  // 踏板（圆角的长条橡胶块）
  const top = press, bot = rows - 3, x0 = 2, w = cols - 4;
  for (let r = top; r < bot; r++) {
    const k = r - top, last = bot - 1 - r, inset = k === 0 || last === 0 ? 2 : k === 1 || last === 1 ? 1 : 0;
    P(x0 + inset - 1, r, w - inset * 2 + 2, 1, '#0d0d14'); // 黑边
    let c = '#2a2a33';
    if (k > 1 && last > 1 && k % 3 === 0) c = '#4c4c5c'; // 防滑横纹
    P(x0 + inset, r, w - inset * 2, 1, c);
    if (c !== '#2a2a33') P(x0 + inset, r, 2, 1, '#6a6a7c'); // 横纹左侧高光
  }
  P(x0 + 2, top, w - 4, 1, driving ? '#566c86' : '#8a8a9c'); // 顶部反光（踩下去时变暗）
  // 底部金属铭牌
  P(x0 + 2, bot - 3, w - 4, 2, '#9aa3ad'); P(x0 + 2, bot - 3, w - 4, 1, '#c8d6e5');
  // 文字标签
  const ly = b.y + rows * u + 4;
  ctx.fillStyle = driving ? '#b13e53' : '#1f5e3a'; ctx.fillRect(b.x, ly, b.w, labH);
  ctx.strokeStyle = '#ffcd75'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 1, ly + 1, b.w - 2, labH - 2);
  drawText(ctx, driving ? '停车' : '出发', b.x + b.w / 2, ly + labH / 2, 16, '#f4f4f4', 'center');
  ctx.globalAlpha = 1;
  addButton(b.x - 6, b.y - 6, b.w + 12, b.h + 10, dim ? null : () => { sfx('click'); rdToggleDrive(); });
}
function rdDoingText() {
  const R = G.road, me = R.me, a = me.act;
  if (me.loc === 'drive') return R.driving ? '正在开车' + (me.energy < 25 ? '（很困了）' : '') : '';
  if (me.loc === 'out' || me.loc === 'site') return '在车外';
  if (!a) return '';
  const p = a.it ? RD_PARTS[a.it.id] : null;
  const m = { sleep: p ? '在' + p.name + '上睡觉' : '蜷在地上睡觉', cook: '在做饭', eat: '在吃东西', drink: '在喝水', coffee: '在喝咖啡', heal: '在治疗', shower: '在洗澡', research: '在研究', craft: '在工作台干活', plant: '在照料植物', pet: '在撸' + (R.pet ? R.pet.name : '宠物'), mope: '抱着膝盖发呆……', window: '望着窗外', wander: '在车里走来走去', fun: p ? '在用' + p.name : '在休息' };
  return (m[a.type] || '') + (R.driving ? '（自动驾驶中）' : '');
}
function rdToggleDrive() {
  const R = G.road, me = R.me;
  if (me.loc === 'out' || me.loc === 'site') return;
  if (R.driving) { R.driving = false; return; }
  if (R.broken) { showBanner('车辆瘫痪', '先修车：耐久修到 30% 以上（改装 → 修车，需要废料）', 3, '#ef7d57'); return; }
  if (me.energy < 8 && !rdStats().autopilot) { showBanner('太困了', '先睡一觉再开车', 2, '#ef7d57'); return; }
  const st = rdStats();
  if (st.fuelKm > 0 && G.res.fuel <= 0) { showBanner('没有油', '去搜索加油站，或者等商人', 2, '#ef7d57'); return; }
  if (st.powKm > 0 && G.res.power <= 0) { showBanner('没有电', '等太阳能充电或装发电机', 2, '#ef7d57'); return; }
  R.driving = true;
  R.reverse = null;
  if (me.act && me.act.type === 'sleep' && !st.autopilot) me.act = null;
}
function rdOpenPanel(p) { const R = G.road; R.panel = p; R.pick = null; G.state = 'rpanel'; if (G.scroll) G.scroll.rpanel = 0; }

// ---------- 面板 ----------
function rdDrawPanel(ctx) {
  const R = G.road, sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, sw, sh); addButton(0, 0, sw, sh, null);
  const pw = Math.min(640, sw - 12), ph = sh - 16, px = (sw - pw) / 2, py = 8;
  drawPanel(ctx, px, py, pw, ph);
  const tabs = R.panel === 'trade' ? [['trade', R.trade ? R.trade.name : '交易']] : [['garage', '改装'], ['inv', '仓库'], ['craft', '制作'], ['research', '研究'], ['log', '日志'], ['chat', '聊天']];
  const tw = Math.min(90, (pw - 60) / tabs.length);
  tabs.forEach(([k, l], i) => drawButton(ctx, px + 8 + i * (tw + 4), py + 8, tw, 32, l, () => { R.panel = k; R.pick = null; if (G.scroll) G.scroll.rpanel = 0; }, { active: R.panel === k || (R.panel === 'pick' && k === 'garage'), color: R.panel === k ? '#29366f' : '#333c57', size: 13 }));
  drawButton(ctx, px + pw - 44, py + 8, 36, 32, '✕', () => { G.state = 'play'; R.pick = null; }, { size: 14 });
  const top = py + 48, areaH = ph - 56;
  beginScroll(ctx, 'rpanel', px + 8, top, pw - 22, areaH);
  const c = { ctx, x: px + 12, y: top + 4, w: pw - 30 };
  if (R.panel === 'garage') rdPanelGarage(c);
  else if (R.panel === 'pick') rdPanelPick(c);
  else if (R.panel === 'inv') rdPanelInv(c);
  else if (R.panel === 'craft') rdPanelCraft(c);
  else if (R.panel === 'research') rdPanelResearch(c);
  else if (R.panel === 'log') rdPanelLog(c);
  else if (R.panel === 'trade') rdPanelTrade(c);
  else if (R.panel === 'chat') rcPanel(c);
  endScroll(ctx, c.y + 10);
}
function rdLine(c, t, size, color, bold) { wrapText(c.ctx, t, c.w, size || 13).forEach((ln) => { drawText(c.ctx, ln, c.x, c.y + (size || 13) / 2 + 2, size || 13, color || '#c8d6e5', 'left', !!bold); c.y += (size || 13) + 5; }); }
function rdHead(c, t) { c.y += 4; c.ctx.fillStyle = '#333c57'; c.ctx.fillRect(c.x, c.y, c.w, 24); drawText(c.ctx, t, c.x + 8, c.y + 12, 13, '#ffcd75'); c.y += 30; }
// 一行改装件：label 槽位名 · p 零件 · btns 按钮
function rdPartRow(c, label, p, btns, note) {
  const ctx = c.ctx, h = 46;
  ctx.fillStyle = 'rgba(38,43,68,0.9)'; ctx.fillRect(c.x, c.y, c.w, h);
  const bw = btns.length ? btns.reduce((s, b) => s + (b.w || 60) + 4, 0) : 0;
  const tx = c.x + 8;
  if (label) drawText(ctx, label, tx, c.y + 13, 11, '#94b0c2', 'left', false);
  const lx0 = label ? tx + Math.max(64, ctx.measureText(label).width + 10) : tx;
  const lx = p ? lx0 + 42 : lx0;
  if (p) {
    rdoIcon(ctx, p, lx0, c.y + 5, 36); // 零件像素图标（js/roadicons.js）
    drawText(ctx, rdPartLabel(p), lx, c.y + 13, 13, RD_TIER_COLOR[p.tier]);
    const t = note || rdFxText(p);
    const lines = wrapText(ctx, t, c.w - (lx - c.x) - bw - 8, 10);
    drawText(ctx, lines[0] + (lines.length > 1 ? '…' : ''), lx, c.y + 32, 10, '#c8d6e5', 'left', false);
  } else drawText(ctx, note || '（空）', lx, c.y + (note && !label ? 23 : 13), 12, note && !label ? '#c8d6e5' : '#566c86', 'left', false);
  let bx = c.x + c.w - 4;
  for (let i = btns.length - 1; i >= 0; i--) { const b = btns[i], w = b.w || 60; bx -= w; drawButton(ctx, bx, c.y + 7, w, 32, b.l, b.dim ? null : b.f, { color: b.c || '#29366f', size: 12, dim: b.dim }); bx -= 4; }
  c.y += h + 4;
}
// 车辆预览图
function rdPreviewImg(scale) {
  const v = rdVeh(), tr = G.road.ext.trailer ? 50 : 0;
  const w = v.len + tr + 30, h = 64;
  const cv = createCanvas(w * RD_Q, h * RD_Q), g = cv.getContext('2d');
  g.setTransform(RD_Q, 0, 0, RD_Q, 0, 0); // 和公路画面一样用精细像素
  rdDrawVehicle(g, w - 12, h - 6, {});
  cv.lw = w; cv.lh = h; // 换算成「世界像素」的尺寸
  return cv;
}
function rdPanelGarage(c) {
  const R = G.road, ctx = c.ctx, st = rdStats(), v = rdVeh();
  // 预览
  const img = rdPreviewImg();
  const sc = Math.max(2, Math.min(4, Math.floor(c.w * 0.45 / img.lw)));
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(c.x, c.y, c.w, img.lh * sc + 8);
  ctx.drawImage(img, c.x + 4, c.y + 4, img.lw * sc, img.lh * sc);
  const sx = c.x + img.lw * sc + 14;
  const stats = [
    v.name + (st.hover ? '（漂浮）' : ''), '耐久 ' + Math.round(R.hpV) + '/' + st.hp + ' · 护甲 ' + Math.round(st.armor * 100) + '%', '速度 ' + st.speed + ' km/h' + (st.over > 0 ? '（超重！）' : ''),
    st.fuelKm > 0 ? '油耗 ' + st.fuelKm.toFixed(2) + ' 升/公里' : st.powKm > 0 ? '电耗 ' + st.powKm.toFixed(2) + ' 电/公里' : '不耗燃料',
    '重量 ' + st.weight + '/' + st.torque + ' · 货舱 ' + rdCargoUsed() + '/' + st.cargo, '电力 ' + (R.powNet >= 0 ? '+' : '') + (R.powNet || 0).toFixed(1) + '/时 · 撞击 ' + st.ram,
  ];
  stats.forEach((t, i) => { if (sx + 60 < c.x + c.w) drawText(ctx, t, sx, c.y + 12 + i * 16, i ? 11 : 14, i ? '#c8d6e5' : '#ffcd75', 'left', i === 0); });
  c.y += Math.max(img.lh * sc + 8, stats.length * 16 + 8) + 6;
  if (sx + 60 >= c.x + c.w) stats.forEach((t) => rdLine(c, t, 11));
  rdLine(c, '特性：' + v.perk, 11, '#a7f070');
  if (R.broken && R.speedNow < 1) { drawButton(ctx, c.x, c.y, 260, 32, '应急抢修（8 小时，不花废料，修到 30%）', () => rdEmergencyRepair(), { color: '#b13e53', size: 12 }); c.y += 38; }
  if (R.hpV < st.hp) { const cost = Math.ceil((st.hp - R.hpV) / 5); drawButton(ctx, c.x, c.y, 200, 32, '修车（' + Math.min(cost, Math.floor(G.res.scrap)) + ' 废料）', R.speedNow < 1 ? () => rdRepair() : null, { color: '#1f5e3a', size: 12, dim: R.speedNow >= 1 }); c.y += 38; }
  if (R.speedNow < 1 && (R.broken || G.res.fuel < 3 && st.fuelKm > 0)) { drawButton(ctx, c.x + 208, c.y - (R.hpV < st.hp ? 38 : 0), 220, 32, '徒步去附近搜寻（6 小时）', () => rdHike(), { color: '#a8794f', size: 12 }); if (R.hpV >= st.hp) c.y += 38; }
  const can = rdCanModExt();
  if (!can) rdLine(c, '车子在开，停车后才能改装车外的部件（车内家具随时可以摆）', 12, '#ef7d57');
  // 车外
  rdHead(c, '车外改装');
  for (const k of RD_EXT_ORDER) {
    const S = RD_SLOTS[k];
    if (S.noBike && v.tent) continue;
    const id = R.ext[k], p = id ? RD_PARTS[id] : null, have = R.inv.some((x) => RD_PARTS[x].slot === k);
    if (S.alienOnly && !p && !have) continue;
    rdPartRow(c, S.name, p, [
      { l: p ? '更换' : '安装', f: () => { R.pick = { slot: k }; R.panel = 'pick'; if (G.scroll) G.scroll.rpanel = 0; }, dim: !have || !can, c: '#29366f' },
      ...(p ? [{ l: '卸下', f: () => rdUninstall('ext', k), dim: !can, c: '#5d275d', w: 50 }] : []),
    ], p ? null : (have ? '（空，仓库里有可装的）' : '（空）'));
  }
  // 武器
  rdHead(c, '武器挂点 ' + Math.min(R.wpn.filter(Boolean).length, st.mounts) + '/' + st.mounts + (st.mounts === 0 ? '（这辆车没有挂点，可以装车顶炮座或装甲挂车）' : ''));
  const haveW = R.inv.some((x) => RD_PARTS[x].slot === 'weapon');
  for (let i = 0; i < Math.max(st.mounts, R.wpn.length); i++) {
    const id = R.wpn[i], p = id ? RD_PARTS[id] : null, off = i >= st.mounts;
    rdPartRow(c, '挂点' + (i + 1) + (off ? '（停用）' : ''), p, [
      ...(!off ? [{ l: p ? '更换' : '安装', f: () => { R.pick = { slot: 'weapon', mount: i }; R.panel = 'pick'; if (G.scroll) G.scroll.rpanel = 0; }, dim: !haveW || !can }] : []),
      ...(p ? [{ l: '卸下', f: () => rdUninstall('wpn', i), dim: !can, c: '#5d275d', w: 50 }] : []),
    ]);
  }
  // 随身
  rdHead(c, '随身装备（下车搜索时用）');
  for (const k of ['hand', 'suit']) {
    const p = R[k] ? RD_PARTS[R[k]] : null, have = R.inv.some((x) => RD_PARTS[x].slot === k);
    rdPartRow(c, RD_SLOTS[k].name, p, [{ l: p ? '更换' : '装备', f: () => { R.pick = { slot: k }; R.panel = 'pick'; if (G.scroll) G.scroll.rpanel = 0; }, dim: !have }, ...(p ? [{ l: '卸下', f: () => rdUninstall('person', k), c: '#5d275d', w: 50 }] : [])]);
  }
  // 车内
  const fl = rdCellCount('floor'), wl = rdCellCount('wall');
  const usedF = R.inner.filter((it) => (RD_PARTS[it.id].layer || 'floor') === 'floor').reduce((s, it) => s + (RD_PARTS[it.id].w || 1), 0);
  const usedW = R.inner.filter((it) => RD_PARTS[it.id].layer === 'wall').reduce((s, it) => s + (RD_PARTS[it.id].w || 1), 0);
  rdHead(c, (v.tent ? '营地' : '车内') + '布置 · 地面 ' + usedF + '/' + fl + ' 格 · 墙面 ' + usedW + '/' + wl + ' 格');
  const haveIn = R.inv.some((x) => RD_PARTS[x].slot === 'in');
  drawButton(ctx, c.x, c.y, 160, 32, '+ 添加家具/设施', haveIn ? () => { R.pick = { slot: 'in' }; R.panel = 'pick'; if (G.scroll) G.scroll.rpanel = 0; } : null, { color: '#1f5e3a', size: 12, dim: !haveIn });
  drawButton(ctx, c.x + 168, c.y, 120, 32, '去车内看看', () => { G.state = 'play'; R.view = 'in'; }, { size: 12 });
  c.y += 38;
  R.inner.forEach((it, i) => { const p = RD_PARTS[it.id]; rdPartRow(c, '', p, [{ l: '收起', f: () => rdUninstall('in', i), c: '#5d275d', w: 50 }]); });
  // 自动搜索开关
  rdHead(c, '驾驶设置');
  drawButton(ctx, c.x, c.y, 240, 32, '路过建筑自动停车搜索：' + (R.autoSearch ? '开' : '关'), () => { R.autoSearch = !R.autoSearch; }, { color: R.autoSearch ? '#1f5e3a' : '#333c57', size: 12 });
  c.y += 40;
}
function rdPanelPick(c) {
  const R = G.road, pk = R.pick, ctx = c.ctx;
  if (!pk) { R.panel = 'garage'; return; }
  drawButton(ctx, c.x, c.y, 90, 30, '← 返回', () => { R.panel = 'garage'; R.pick = null; }, { size: 12 });
  drawText(ctx, '选择要装的' + RD_SLOTS[pk.slot].name + (pk.mount !== undefined ? '（挂点' + (pk.mount + 1) + '）' : ''), c.x + 100, c.y + 15, 14, '#ffcd75');
  c.y += 40;
  const cur = pk.slot === 'weapon' ? R.wpn[pk.mount] : pk.slot === 'hand' || pk.slot === 'suit' ? R[pk.slot] : pk.slot === 'in' ? null : R.ext[pk.slot];
  if (cur) { rdLine(c, '当前：' + rdPartLabel(RD_PARTS[cur]) + ' — ' + rdFxText(RD_PARTS[cur]), 11, '#94b0c2'); }
  const seen = {};
  R.inv.forEach((id, idx) => {
    const p = RD_PARTS[id];
    if (p.slot !== pk.slot || seen[id]) return;
    seen[id] = true;
    const n = R.inv.filter((x) => x === id).length;
    let fits = true;
    if (p.slot === 'in') fits = rdFreeCell(p) >= 0;
    rdPartRow(c, n > 1 ? '×' + n : '', p, [{ l: fits ? '装上' : '放不下', dim: !fits, c: '#1f5e3a', f: () => {
      const i2 = R.inv.indexOf(id);
      if (rdInstall(i2, pk.slot, pk.mount)) { R.panel = 'garage'; R.pick = null; }
    } }]);
    if (p.d) { c.y -= 2; rdLine(c, '　' + p.d, 10, '#94b0c2'); }
  });
  if (!Object.keys(seen).length) rdLine(c, '仓库里没有这类零件。去搜索建筑、找商人，或者在工作台制作。', 12, '#94b0c2');
}
function rdPanelInv(c) {
  const R = G.road, ctx = c.ctx, st = rdStats();
  // 物资一览（像素图标）
  rdHead(c, '物资　货舱 ' + rdCargoUsed() + '/' + st.cargo);
  const keys = ['fuel', 'power', 'scrap', 'food', 'water', 'med', 'ammo', 'alien'];
  const cols = c.w < 420 ? 2 : 4, gap = 6, cw = (c.w - gap * (cols - 1)) / cols, chh = 40;
  keys.forEach((k, i) => {
    const cx = c.x + (i % cols) * (cw + gap), cy = c.y + Math.floor(i / cols) * (chh + gap);
    const cap = k === 'fuel' ? st.tank : k === 'power' ? st.battery : 0;
    const low = (k === 'food' || k === 'water') ? G.res[k] < 3 : k === 'med' ? G.res[k] < 1 : cap ? G.res[k] < cap * 0.15 : false;
    ctx.fillStyle = low ? 'rgba(177,62,83,0.35)' : 'rgba(38,43,68,0.9)'; ctx.fillRect(cx, cy, cw, chh);
    rdIcon(ctx, k, cx + 6, cy + 8, 24);
    drawText(ctx, RD_RES[k].name, cx + 38, cy + 12, 11, '#94b0c2', 'left', false);
    drawText(ctx, Math.floor(G.res[k] || 0) + (cap ? ' / ' + cap : ''), cx + 38, cy + 28, 14, low ? '#ef7d57' : '#f4f4f4', 'left');
  });
  c.y += Math.ceil(keys.length / cols) * (chh + gap) + 2;
  rdLine(c, '废料、食物、水、药、弹药、晶体占货舱；燃油在油箱里，电在电池里', 11, '#94b0c2');
  rdHead(c, '零件');
  rdLine(c, '拆解零件可以换废料；工作台等级 ≥ 零件品阶时，拆解还能学会它的图纸（工作台等级：' + (st.craft || '没有工作台') + '）', 11, '#94b0c2');
  if (!R.inv.length) { rdLine(c, '仓库是空的。', 13, '#566c86'); return; }
  const order = ['weapon', ...RD_EXT_ORDER, 'hand', 'suit', 'in'];
  for (const slot of order) {
    const ids = [...new Set(R.inv.filter((id) => RD_PARTS[id].slot === slot))];
    if (!ids.length) continue;
    rdHead(c, RD_SLOTS[slot].name);
    ids.sort((a, b) => RD_PARTS[b].tier - RD_PARTS[a].tier);
    for (const id of ids) {
      const p = RD_PARTS[id], n = R.inv.filter((x) => x === id).length;
      const learn = !R.bps[id] && st.craft >= p.tier;
      rdPartRow(c, n > 1 ? '×' + n : '', p, [
        { l: '装上', c: '#1f5e3a', w: 50, f: () => rdQuickInstall(id) },
        { l: learn ? '拆解+图纸' : '拆解 +' + rdScrapValue(p), c: '#5d275d', w: learn ? 76 : 70, f: () => askConfirm('拆解 ' + p.name + '？会得到 ' + Math.round(rdScrapValue(p) * (1 + st.scrapBonus)) + ' 废料' + (learn ? '，并学会它的图纸' : '') + '。', () => rdDismantle(R.inv.indexOf(id))) },
      ]);
    }
  }
}
function rdQuickInstall(id) {
  const R = G.road, p = RD_PARTS[id], i = R.inv.indexOf(id), st = rdStats();
  if (p.slot === 'weapon') {
    let m = -1;
    for (let k = 0; k < st.mounts; k++) if (!R.wpn[k]) { m = k; break; }
    if (st.mounts === 0) { showBanner('没有武器挂点', '装车顶炮座或装甲挂车可以增加挂点', 3, '#ef7d57'); return; }
    if (m < 0) { R.pick = { slot: 'weapon', mount: 0 }; R.panel = 'garage'; showBanner('挂点满了', '在改装页选择要替换的挂点', 3, '#ffcd75'); return; }
    rdInstall(i, 'weapon', m);
  } else rdInstall(i, p.slot);
}
function rdPanelCraft(c) {
  const R = G.road, ctx = c.ctx, st = rdStats();
  if (!st.craft) { rdLine(c, '车上没有工作台。先把「简易工具箱」或「工作台」装进车里（改装 → 车内布置）。', 13, '#ef7d57'); }
  else rdLine(c, '工作台等级 ' + st.craft + '：可以制作品阶 ≤ ' + st.craft + ' 的零件。制作需要主角在工作台前干活（停车或开着自动驾驶时）。', 12, '#c8d6e5');
  if (st.craft) {
    rdHead(c, '快速制作');
    drawButton(ctx, c.x, c.y, 220, 32, '复装弹药：4 废料 → 10 发', G.res.scrap >= 4 ? () => rdMakeAmmo() : null, { color: '#1f5e3a', size: 12, dim: G.res.scrap < 4 });
    c.y += 40;
  }
  if (R.craftQ.length) {
    rdHead(c, '制作队列');
    R.craftQ.forEach((q, i) => rdPartRow(c, i === 0 ? '进行中' : '排队', RD_PARTS[q.id], i === 0 ? [] : [{ l: '取消', c: '#5d275d', w: 50, f: () => { R.craftQ.splice(i, 1); const cost = rdCraftCost(RD_PARTS[q.id]); for (const k in cost) G.res[k] += cost[k]; } }], '还要 ' + q.left.toFixed(1) + ' 小时'));
  }
  rdHead(c, '已学会的图纸（拆解零件、搜索、研究都能学到新图纸）');
  const ids = Object.keys(R.bps).filter((id) => RD_PARTS[id]).sort((a, b) => RD_PARTS[a].tier - RD_PARTS[b].tier || (RD_PARTS[a].slot > RD_PARTS[b].slot ? 1 : -1));
  for (const id of ids) {
    const p = RD_PARTS[id], cost = rdCraftCost(p), ok = st.craft >= p.tier && rdHas(cost);
    rdPartRow(c, RD_SLOTS[p.slot].name, p, [{ l: '制作', c: '#1f5e3a', w: 50, dim: !ok, f: () => rdQueueCraft(id) }], rdCostText(cost) + (st.craft < p.tier ? ' · 需要工作台 Lv' + p.tier : '') + ' · ' + rdFxText(p));
  }
}
function rdPanelResearch(c) {
  const R = G.road, st = rdStats();
  if (!st.research) rdLine(c, '车上没有电脑。装上「旧笔记本电脑」「车载电脑」等才能研究（改装 → 车内布置）。', 13, '#ef7d57');
  else rdLine(c, '电脑研究等级 ' + st.research + '。电脑有电就会自己运算（开车时也算，速度一半）；主角坐在电脑前时全速，心情好更快。外星科技需要外星晶体——在外星坠落舱和外星怪物身上找。', 12, '#c8d6e5');
  if (R.research.cur) {
    const r = RD_RESEARCH.find((x) => x.id === R.research.cur.id), me = R.me;
    const at = me.act && me.act.type === 'research' && me.loc === 'in', pc = rdResearchPC(st);
    rdHead(c, '正在研究：' + r.name);
    rdLine(c, '还要 ' + R.research.cur.left.toFixed(1) + ' 小时 · ' + (!pc ? (st.research < r.lv ? '电脑等级不够，暂停' : '没电，暂停') : at ? '主角在电脑前，全速' : '电脑自己算，半速'), 12, pc ? '#a7f070' : '#ef7d57');
    if (pc && !at) { drawButton(c.ctx, c.x, c.y, 150, 32, '让主角去研究', () => rdGoResearch(), { color: '#29366f', size: 12 }); c.y += 38; }
  }
  rdHead(c, '研究项目');
  for (const r of RD_RESEARCH) {
    const done = R.research.done[r.id], lock = st.research < r.lv, busy = !!R.research.cur;
    const ctx = c.ctx, h = 58;
    ctx.fillStyle = 'rgba(38,43,68,0.9)'; ctx.fillRect(c.x, c.y, c.w, h);
    drawText(ctx, r.name + (done ? '（已完成）' : ''), c.x + 8, c.y + 13, 13, done ? '#a7f070' : lock ? '#566c86' : '#73eff7');
    drawText(ctx, '需要电脑 Lv' + r.lv + ' · ' + rdCostText(r.cost) + ' · ' + r.hours + ' 小时', c.x + 8, c.y + 30, 10, '#94b0c2', 'left', false);
    const lines = wrapText(ctx, r.d, c.w - 90, 10);
    drawText(ctx, lines[0] + (lines.length > 1 ? '…' : ''), c.x + 8, c.y + 46, 10, '#c8d6e5', 'left', false);
    if (!done) drawButton(ctx, c.x + c.w - 70, c.y + 12, 64, 32, '研究', !lock && !busy && rdHas(r.cost) ? () => rdStartResearch(r) : null, { color: '#29366f', size: 12, dim: lock || busy || !rdHas(r.cost) });
    c.y += h + 4;
  }
}
function rdPanelLog(c) {
  const R = G.road;
  rdLine(c, '行驶 ' + Math.floor(R.km) + ' 公里 · 第 ' + rdDay() + ' 天 · 击杀 ' + R.stats.kills + ' · 搜索 ' + R.stats.searched + ' 处' + (R.pet ? ' · 伙伴：' + R.pet.name : ''), 13, '#ffcd75');
  for (const e of R.log) rdLine(c, '第' + e.day + '天 ' + e.h + '时　' + e.text, 12, e.color);
}
function rdPanelTrade(c) {
  const R = G.road, T = R.trade, ctx = c.ctx;
  if (!T) { G.state = 'play'; return; }
  rdLine(c, '这里只收废料。你有 ' + Math.floor(G.res.scrap) + ' 废料。', 13, '#ffcd75');
  rdHead(c, '出售的零件');
  T.items.forEach((it, i) => {
    const p = RD_PARTS[it.id];
    if (it.sold) return;
    rdPartRow(c, '', p, [{ l: '买 ' + it.price, c: '#1f5e3a', w: 64, dim: G.res.scrap < it.price, f: () => { G.res.scrap -= it.price; R.inv.push(it.id); it.sold = true; rdLog('买下了 ' + p.name, '#a7f070'); sfx('coin'); } }]);
  });
  rdHead(c, '买物资（废料换）');
  for (const k of ['fuel', 'food', 'water', 'med', 'ammo']) {
    const n = k === 'ammo' ? 10 : 5, price = Math.ceil(RD_PRICES[k] * n * (1 - Math.min(0.3, rdStats().trade)));
    rdPartRow(c, '', null, [{ l: '买 ' + n, c: '#1f5e3a', w: 56, dim: G.res.scrap < price, f: () => { const got = rdGain(k, n); if (got > 0) { G.res.scrap -= Math.ceil(price * got / n); sfx('coin'); } else showBanner('装不下了', '', 2, '#ef7d57'); } }], RD_RES[k].name + ' ×' + n + '：' + price + ' 废料');
  }
  rdHead(c, '卖物资（换废料）');
  for (const k of ['food', 'water', 'med', 'ammo', 'fuel']) {
    const n = k === 'ammo' ? 10 : 5, price = Math.floor(RD_PRICES[k] * n * 0.5 * T.sell);
    rdPartRow(c, '', null, [{ l: '卖 ' + n, c: '#5d275d', w: 56, dim: G.res[k] < n, f: () => { G.res[k] -= n; rdGain('scrap', price, true); rdLog('卖出 ' + RD_RES[k].name + ' ×' + n + '：废料 +' + price, '#a7f070'); sfx('coin'); } }], RD_RES[k].name + ' ×' + n + '：+' + price + ' 废料（你有 ' + Math.floor(G.res[k]) + '）');
  }
  rdHead(c, '卖零件');
  const seen = {};
  R.inv.forEach((id) => {
    if (seen[id]) return; seen[id] = true;
    const p = RD_PARTS[id], price = Math.round(rdScrapValue(p) * 1.5 * T.sell);
    rdPartRow(c, '', p, [{ l: '卖 ' + price, c: '#5d275d', w: 60, f: () => { const i = R.inv.indexOf(id); if (i >= 0) { R.inv.splice(i, 1); rdGain('scrap', price, true); rdLog('卖出 ' + p.name + '：废料 +' + price, '#a7f070'); showBanner('卖出 ' + p.name, '废料 +' + price, 2, '#a7f070'); sfx('coin'); } } }]);
  });
}

// ---------- 点击 / 拖动 / 按键 ----------
function rdTap(sx, sy) {
  const R = G.road;
  if (R.view === 'out') {
    // 点车 = 进车内
    const p = rdToScreen(RDV.ax, RDV.gy);
    const L = rdVeh().len * RDV.S / G.dpr;
    if (sx > p.x - L && sx < p.x && sy > p.y - 36 * RDV.S / G.dpr && sy < p.y + 6) { R.view = 'in'; return; }
  }
}
function rdDrag(dx) {
  const R = G.road;
  if (R.view !== 'in' || !RDV) return;
  R.icam = (R.icam || 0) + dx * G.dpr / (RDV.S * (RDV.izoom || 1));
  R.ifollowT = G.time + 6;
}
function rdKey(key) {
  const R = G.road;
  if (G.state === 'rpanel' && key === 'escape') { G.state = 'play'; return true; }
  if (G.state !== 'play') return false;
  if (key === 'enter' || key === 'w') rdToggleDrive();
  else if (key === 'f') { const s = rdNearSite(); if (s) rdStartSearch(s); else { const b = rdBehindSite(); if (b) rdStartReverse(b); } }
  else if (key === 'i' || key === 'tab') R.view = R.view === 'in' ? 'out' : 'in';
  else if (key === 'g') rdOpenPanel('garage');
  else if (key === 'b') rdOpenPanel('inv');
  else if (key === 'c') rdOpenPanel('craft');
  else if (key === 'r') rdOpenPanel('research');
  else if (key === 'l') rdOpenPanel('log');
  else if (key === 't') rdOpenPanel('chat');
  else return false;
  return true;
}

// ---------- 开局选车 ----------
const RD_PREVIEW = {};
function rdDrawCarSelect(ctx) {
  const sw = G.sw, sh = G.sh;
  drawText(ctx, '选择你的座驾', sw / 2, 34, 22, '#ffcd75', 'center');
  drawButton(ctx, 10, 12, 70, 34, '返回', () => gotoScene('modes'), { size: 13 });
  const cols = sw >= 760 ? 2 : 1, gap = 10;
  const cw = Math.min(cols === 2 ? 360 : 440, (sw - 20 - (cols - 1) * gap) / cols);
  const ch = 132;
  const x0 = (sw - (cols * cw + (cols - 1) * gap)) / 2;
  beginScroll(ctx, 'rcar', 4, 60, sw - 16, sh - 70);
  let maxY = 60;
  const saved = G.road, savedRes = G.res;
  RD_VEHICLE_ORDER.forEach((id, i) => {
    const v = RD_VEHICLES[id];
    const lastAlone = cols === 2 && i === RD_VEHICLE_ORDER.length - 1 && RD_VEHICLE_ORDER.length % 2 === 1;
    const x = lastAlone ? (sw - cw) / 2 : x0 + (i % cols) * (cw + gap), y = 66 + Math.floor(i / cols) * (ch + gap);
    drawButton(ctx, x, y, cw, ch, '', () => startGame('road', { veh: id }), { color: 'rgba(26,28,44,0.92)' });
    // 预览
    if (!RD_PREVIEW[id]) { G.res = Object.assign({}, MODES.road.startRes); rdNewGame(id); RD_PREVIEW[id] = G.road; }
    G.road = RD_PREVIEW[id];
    const img = rdPreviewImg();
    ctx.imageSmoothingEnabled = false;
    const sc = 2;
    ctx.drawImage(img, x + 6, y + ch - img.lh * sc - 4, img.lw * sc, img.lh * sc);
    const tx = x + Math.min(150, img.lw * sc + 10);
    drawText(ctx, v.name, tx, y + 18, 17, '#ffcd75');
    const lines = wrapText(ctx, v.desc, cw - (tx - x) - 10, 11);
    lines.slice(0, 3).forEach((ln, k) => drawText(ctx, ln, tx, y + 40 + k * 15, 11, '#c8d6e5', 'left', false));
    const s2 = '耐久' + v.hp + ' 速度' + v.speed + ' 车内' + v.cells + '+' + v.wcells + '格 挂点' + v.mounts;
    drawText(ctx, s2, tx, y + 40 + Math.min(3, lines.length) * 15 + 2, 10, '#73eff7', 'left', false);
    drawText(ctx, v.perk, tx, y + ch - 12, 10, '#a7f070', 'left', false);
    maxY = y + ch;
  });
  G.road = saved; G.res = savedRes;
  endScroll(ctx, maxY + 10);
}

// 掉落物飘字：先弹一下再慢慢上升变淡；文字有深褐描边；文字里提到的资源前面画小图标
function rdFloatDraw(ctx, f) {
  const ease = 1 - Math.pow(1 - Math.min(1, f.t / 0.5), 3), p = rdToScreen(rdSX(f.x), RDV.gy + f.y - ease * 12 - f.t * 4);
  const pop = f.t < 0.15 ? 0.7 + f.t / 0.15 * 0.5 : f.t < 0.25 ? 1.2 - (f.t - 0.15) / 0.1 * 0.2 : 1, size = Math.round(12 * pop);
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, (1.4 - f.t) / 0.5));
  ctx.font = 'bold ' + size + 'px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const parts = String(f.text).split(' '), keys = Object.keys(RD_RES);
  const widths = parts.map((s) => ctx.measureText(s).width + (keys.some((k) => s.indexOf(RD_RES[k].name) >= 0) ? size + 2 : 0));
  let x = p.x - (widths.reduce((a, b) => a + b, 0) + (parts.length - 1) * 6) / 2;
  parts.forEach((s, i) => {
    const k = keys.find((kk) => s.indexOf(RD_RES[kk].name) >= 0);
    if (k) { rdIcon(ctx, k, x, p.y - size / 2, size); x += size + 2; }
    ctx.lineWidth = 3; ctx.strokeStyle = '#24160f'; ctx.strokeText(s, x, p.y); ctx.fillStyle = f.color; ctx.fillText(s, x, p.y);
    x += ctx.measureText(s).width + 6;
  });
  ctx.restore();
}
