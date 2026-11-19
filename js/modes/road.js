// =============================================
//  模式 6：公路求生（横版）
//  开着改装车在末日公路上一直往前走：路边的废弃建筑可以停车搜索，路上会遇到辐射怪物
//  时间：现实 10 秒 = 游戏 1 小时，一天 4 分钟
//  画面在 js/roaddraw.js，界面在 js/roadui.js，数据在 js/roaddata.js
// =============================================
const RD_HOUR = 10;          // 现实几秒 = 游戏 1 小时
const RD_PX_KM = 135;        // 1 公里 = 多少画面像素
const RD_KM_RATE = 1 / 90;   // 时速 1 公里 → 每秒前进多少公里（时速 60 ≈ 每秒 0.67 公里）
const RD_WALK = 34;          // 主角走路速度（像素/秒）

function rdR() { return G.road; }

// ---------- 新游戏 ----------
function rdNewGame(vehId) {
  const v = RD_VEHICLES[vehId];
  const R = {
    veh: vehId, km: 0, t: 7, speedNow: 0, driving: false, hpV: v.hp, shield: 0,
    me: { hp: 100, food: 80, water: 80, energy: 90, mood: 60, rad: 0, loc: 'in', ix: 1.5, face: 1, act: null, wx: 0 },
    ext: {}, wpn: [], hand: null, suit: null, inner: [], inv: [], bps: {},
    research: { done: {}, cur: null }, craftQ: [],
    sites: [], nextSiteKm: 6, obs: [], nextObsKm: 30,
    log: [], pet: null, weather: null, evT: 9, encT: 5,
    stats: { kills: 0, searched: 0 }, view: 'out', autoSearch: false, milestone: 0,
    version: 1,
  };
  G.road = R;
  Object.assign(G.res, { fuel: Math.round(v.tank * 0.7), scrap: 30, food: 10, water: 10, med: 3, ammo: 35, power: Math.round(v.battery * 0.6), alien: 0 });
  // 起步装备
  for (const id of ['armor1', 'ram1', 'wpn1', 'bed1', 'bed2', 'stove1', 'water1', 'store1', 'hand1', 'tank1', 'decor1']) R.bps[id] = true;
  R.hand = vehId === 'ebike' ? 'hand4' : 'hand1';
  R.suit = 'suit1';
  if (vehId === 'courier' || vehId === 'pickup') R.wpn = ['wpn3'];
  if (vehId === 'garbage') { R.wpn = ['wpn1', 'wpn2']; R.ext.ram = 'ram4'; }
  if (vehId === 'icecream') R.wpn = ['wpn2'];
  if (vehId !== 'ebike') {
    rdPlace('bed1'); rdPlace('bench1'); rdPlace('water1'); rdPlace('fun2');
    R.inv.push('armor1', 'store1', 'decor1');
  } else {
    rdPlace('water1');
    R.inv.push('bench1', 'trl1', 'armor2');
  }
  rdFxDirty();
  R.me.ix = 0.6;
  rdLog('出发了。油箱里还有 ' + G.res.fuel + ' 升油。沿着公路一直往前开吧。', '#ffcd75');
  rdSpawnSitesAhead();
}

// ---------- 效果汇总（所有装上的改装件） ----------
function rdInstalled() {
  const R = rdR(), out = [];
  for (const k in R.ext) if (R.ext[k]) out.push(RD_PARTS[R.ext[k]]);
  for (const id of R.wpn) if (id) out.push(RD_PARTS[id]);
  if (R.hand) out.push(RD_PARTS[R.hand]);
  if (R.suit) out.push(RD_PARTS[R.suit]);
  for (const it of R.inner) out.push(RD_PARTS[it.id]);
  return out.filter(Boolean);
}
function rdFxDirty() { if (G.road) G.road._fx = null; }
function rdFxAll() {
  const R = rdR();
  if (R._fx && R._fxPow === R.powered) return R._fx;
  const sum = {}, max = {};
  for (const p of rdInstalled()) {
    if (p.pw > 0 && R.powered === false) continue; // 停电时用电设备不起作用
    if (p.slot === 'weapon' || p.slot === 'hand') continue; // 武器单独算
    for (const k in p.fx) {
      const v = p.fx[k];
      if (typeof v !== 'number') continue;
      sum[k] = (sum[k] || 0) + v;
      max[k] = Math.max(max[k] || 0, v);
    }
  }
  R._fx = { sum, max }; R._fxPow = R.powered;
  return R._fx;
}
function rdSum(k) { return rdFxAll().sum[k] || 0; }
function rdMax(k) { return rdFxAll().max[k] || 0; }
function rdVeh() { return RD_VEHICLES[rdR().veh]; }

function rdWeight() {
  const R = rdR(), v = rdVeh();
  let w = v.weight;
  for (const p of rdInstalled()) if (p.slot !== 'hand' && p.slot !== 'suit' && !(v.towing && p.slot === 'trailer')) w += p.wt || 0;
  return w;
}
function rdStats() {
  const R = rdR(), v = rdVeh(), b = rdBiomeAt(R.km);
  const weight = rdWeight(), torque = v.torque + rdSum('torque');
  const over = Math.max(0, weight - torque), wf = Math.max(0.4, 1 - over / torque * 1.2);
  const hover = rdSum('hover') > 0;
  let speed = (v.speed + rdSum('speed')) * (1 + rdSum('speedPct')) * wf;
  if (b.snow && !hover && !rdSum('snow')) speed *= 0.75;
  if (R.weather && R.weather.type === 'dust') speed *= 0.7;
  const electric = rdMax('electric') || v.electric || 0;
  const fuelMul = Math.max(0, 1 + rdSum('fuelPct'));
  const loadF = 0.6 + 0.4 * weight / v.weight;
  return {
    hp: v.hp + rdSum('hp'), armor: Math.min(0.75, (v.armor || 0) + rdSum('armor')), shieldMax: rdSum('shield'),
    speed: Math.max(15, Math.round(speed)), weight, torque, over,
    fuelKm: electric ? 0 : v.fuel * fuelMul * loadF, powKm: electric ? electric * Math.max(0.2, fuelMul) * loadF : 0,
    tank: v.tank + rdSum('tank'), battery: v.battery + rdSum('battery'), cargo: v.cargo + rdSum('cargo'),
    mounts: v.mounts + rdSum('mounts'), ram: 8 + rdSum('ram'), obs: Math.min(1, rdSum('obs')), thorns: rdSum('thorns'),
    regen: rdSum('regen'), stealth: Math.min(0.8, rdSum('stealth')), hover,
    autopilot: rdSum('autopilot') > 0 && R.veh !== 'ebike', research: rdMax('research'), craft: rdMax('craft'),
    cook: Math.max(1, rdMax('cook')), fridge: Math.max(v.fridge || 0, rdMax('fridge')), comfort: (v.comfort || 0) + rdSum('comfort'),
    light: rdSum('light') > 0, radar: rdMax('radar'), lookout: rdSum('lookout') > 0, rangePct: rdSum('rangePct'), aim: rdSum('aim'),
    searchSpd: (v.searchSpd || 0) + rdSum('searchSpd'), lootBonus: rdSum('lootBonus'), scrapBonus: (v.scrapBonus || 0) + rdSum('scrapBonus'),
    trade: (v.trade || 0) + rdSum('trade'), repair: rdMax('repair'),
  };
}
// 车内空间：车厢 + 挂车，空间核心会把格子数放大
function rdRooms() {
  const R = rdR(), v = rdVeh(), mul = Math.max(1, rdMax('spaceMul'));
  const rooms = [{ name: v.tent ? '露营地' : '车厢', cells: Math.floor(v.cells * mul), wcells: Math.floor(v.wcells * mul), camp: !!v.tent }];
  const tr = R.ext.trailer && RD_PARTS[R.ext.trailer];
  if (tr && tr.fx.cells) rooms.push({ name: '挂车', cells: Math.floor(tr.fx.cells * mul), wcells: Math.floor(tr.fx.wcells * mul), trailer: true });
  let at = 0;
  for (const r of rooms) { r.start = at; at += r.cells; }
  let wat = 0;
  for (const r of rooms) { r.wstart = wat; wat += r.wcells; }
  return rooms;
}
function rdCellCount(layer) { return rdRooms().reduce((s, r) => s + (layer === 'wall' ? r.wcells : r.cells), 0); }
// 找一段空位放家具（返回起始格，-1 = 放不下）
function rdFreeCell(p, ignore) {
  const R = rdR(), rooms = rdRooms(), layer = p.layer || 'floor';
  const used = new Set();
  for (const it of R.inner) { if (it === ignore || (RD_PARTS[it.id].layer || 'floor') !== layer) continue; for (let i = 0; i < (RD_PARTS[it.id].w || 1); i++) used.add(it.cell + i); }
  for (const r of rooms) {
    const s = layer === 'wall' ? r.wstart : r.start, n = layer === 'wall' ? r.wcells : r.cells;
    for (let c = s; c + (p.w || 1) <= s + n; c++) {
      let ok = true;
      for (let i = 0; i < (p.w || 1); i++) if (used.has(c + i)) { ok = false; break; }
      if (ok) return c;
    }
  }
  return -1;
}
function rdPlace(id) {
  const p = RD_PARTS[id], c = rdFreeCell(p);
  if (c < 0) return false;
  rdR().inner.push({ id, cell: c });
  rdFxDirty();
  return true;
}
// 空间变小后（卸了挂车/空间核心）放不下的家具收回仓库
function rdRefit() {
  const R = rdR(), keep = R.inner.slice();
  R.inner = [];
  const back = [];
  for (const it of keep) { const c = rdFreeCell(RD_PARTS[it.id]); if (c >= 0) R.inner.push({ id: it.id, cell: c }); else { R.inv.push(it.id); back.push(RD_PARTS[it.id].name); } }
  if (back.length) rdLog('车内放不下了，' + back.join('、') + ' 收回了仓库', '#ef7d57');
  rdFxDirty();
}

// ---------- 资源 ----------
function rdCargoUsed() { return RD_CARGO_RES.reduce((s, k) => s + Math.max(0, Math.floor(G.res[k] || 0)), 0); }
// 获得资源（货舱 / 油箱 / 电池装不下的会丢掉），返回实际得到多少
function rdGain(k, n) {
  if (n <= 0) return 0;
  const st = rdStats();
  let room = Infinity;
  if (k === 'fuel') room = st.tank - G.res.fuel;
  else if (k === 'power') room = st.battery - G.res.power;
  else if (RD_CARGO_RES.includes(k)) room = st.cargo - rdCargoUsed();
  const got = Math.max(0, Math.min(n, Math.floor(room)));
  G.res[k] = (G.res[k] || 0) + got;
  return got;
}
function rdHas(cost) { for (const k in cost) if ((G.res[k] || 0) < cost[k]) return false; return true; }
function rdPay(cost) { if (!rdHas(cost)) return false; for (const k in cost) G.res[k] -= cost[k]; return true; }
function rdCostText(cost) { return Object.keys(cost).map((k) => RD_RES[k].name + ' ' + cost[k]).join('、'); }

function rdLog(text, color) {
  const R = rdR();
  R.log.unshift({ text, color: color || '#c8d6e5', day: rdDay(), h: Math.floor(R.t % 24) });
  if (R.log.length > 80) R.log.length = 80;
}
function rdDay() { return Math.floor(rdR().t / 24) + 1; }
function rdHour() { return rdR().t % 24; }
function rdIsNight() { const h = rdHour(); return h >= 20 || h < 5; }

// ---------- 路边建筑、路障 ----------
function rdVehX() { return rdR().km * RD_PX_KM; } // 车头所在位置（世界像素）
function rdSpawnSitesAhead() {
  const R = rdR();
  while (R.nextSiteKm < R.km + 40) {
    const km = R.nextSiteKm;
    const pool = RD_SITE_ORDER.filter((k) => !(RD_SITES[k].minKm > km) && (k !== 'alien' || rdBiomeAt(km).alien || Math.random() < (rdSum('alienSense') ? 0.5 : 0.15)));
    // 外星区：外星坠落舱常见
    let type = pool[Math.floor(Math.random() * pool.length)];
    if (rdBiomeAt(km).alien && Math.random() < 0.3 && pool.includes('alien')) type = 'alien';
    R.sites.push({ type, km, seed: Math.floor(Math.random() * 1e6), searched: false, danger: RD_SITES[type].danger * (0.6 + Math.random() * 0.8) });
    R.nextSiteKm = km + 9 + Math.random() * 13;
  }
  while (R.nextObsKm < R.km + 40) {
    R.obs.push({ km: R.nextObsKm, type: ['car', 'barrier', 'crater', 'pole', 'rocks'][Math.floor(Math.random() * 5)], seed: Math.random() });
    R.nextObsKm += 22 + Math.random() * 40;
  }
  R.sites = R.sites.filter((s) => s.km > R.km - 6);
  R.obs = R.obs.filter((o) => o.km > R.km - 3);
}
// 车旁边能搜索的建筑
function rdNearSite() {
  const R = rdR();
  let best = null, bd = 1e9;
  for (const s of R.sites) {
    if (s.searched) continue;
    const d = Math.abs(s.km - R.km) * RD_PX_KM;
    if (d < 70 && d < bd) { bd = d; best = s; }
  }
  return best;
}
// 刚开过、还没搜的建筑（4 公里以内，可以倒车回去）
function rdBehindSite() {
  const R = rdR();
  if (rdNearSite()) return null;
  return R.sites.filter((s) => !s.searched && s.km < R.km && s.km > R.km - 4).sort((a, b) => b.km - a.km)[0] || null;
}
function rdStartReverse(s) {
  const R = rdR();
  R.driving = false;
  R.reverse = s;
  rdLog('倒车回去搜索' + RD_SITES[s.type].name, '#94b0c2');
}
// 前方最近的建筑（瞭望 / 雷达用）
function rdNextSite() {
  const R = rdR();
  return R.sites.filter((s) => !s.searched && s.km > R.km + 0.3).sort((a, b) => a.km - b.km)[0] || null;
}

// ---------- 主循环 ----------
function rdUpdate(dt) {
  const R = rdR(), me = R.me;
  const dh = dt / RD_HOUR;
  R.t += dh;
  const st = rdStats();
  R.st = st;
  // ---- 行驶 ----
  const canDrive = R.driving && me.loc !== 'out' && me.loc !== 'site' && !R.broken;
  let target = canDrive ? st.speed : 0;
  if (canDrive && st.fuelKm > 0 && G.res.fuel <= 0) { target = 0; if (!R.noFuelWarn) { R.noFuelWarn = true; rdLog('没油了！去加油站找找，或者等商人路过。', '#ef7d57'); showBanner('燃油耗尽', '停车搜索附近的建筑，或者换省油/电动的引擎', 4, '#ef7d57'); } R.driving = false; }
  if (canDrive && st.powKm > 0 && G.res.power <= 0) { target = 0; if (!R.noPowWarn) { R.noPowWarn = true; rdLog('电池没电了！停下来充电（太阳能、发电机）。', '#ef7d57'); showBanner('电量耗尽', '停车等太阳能充电，或装发电机', 4, '#ef7d57'); } R.driving = false; }
  if (target > 0) { R.noFuelWarn = false; R.noPowWarn = false; }
  // 倒车回到刚开过的建筑（先刹停，再以 30 km/h 往回倒）
  if (R.reverse) {
    const s = R.reverse;
    if (R.driving || me.loc === 'out' || me.loc === 'site' || s.searched || R.broken) R.reverse = null;
    else if (R.speedNow < 1) {
      const d = (s.km - R.km) * RD_PX_KM;
      if (Math.abs(d) < 15) { R.reverse = null; rdStartSearch(s); }
      else if (st.fuelKm > 0 && G.res.fuel <= 0 || st.powKm > 0 && G.res.power <= 0) { R.reverse = null; showBanner('没有燃料', '倒不回去了', 2, '#ef7d57'); }
      else {
        const back = Math.min(Math.abs(d) / RD_PX_KM, 30 * RD_KM_RATE * dt) * Math.sign(d);
        R.km += back; R.reversing = true;
        if (st.fuelKm > 0) G.res.fuel = Math.max(0, G.res.fuel - Math.abs(back) * st.fuelKm);
        if (st.powKm > 0) G.res.power = Math.max(0, G.res.power - Math.abs(back) * st.powKm);
      }
    }
  } else R.reversing = false;
  const acc = target > R.speedNow ? 28 : 80;
  R.speedNow += Math.sign(target - R.speedNow) * Math.min(Math.abs(target - R.speedNow), acc * dt);
  const dkm = R.speedNow * RD_KM_RATE * dt;
  if (dkm > 0) {
    R.km += dkm;
    if (st.fuelKm > 0) G.res.fuel = Math.max(0, G.res.fuel - dkm * st.fuelKm);
    if (st.powKm > 0) G.res.power = Math.max(0, G.res.power - dkm * st.powKm);
    rdSpawnSitesAhead();
    rdCheckObstacles(st);
    // 里程碑
    const ms = Math.floor(R.km / 250);
    if (ms > R.milestone) { R.milestone = ms; showBanner('已行驶 ' + ms * 250 + ' 公里', '进入「' + rdBiomeAt(R.km).name + '」', 4, '#ffcd75'); rdLog('进入了「' + rdBiomeAt(R.km).name + '」', '#ffcd75'); sfx('dawn'); }
  }
  // 自动停车搜索
  if (R.autoSearch && R.driving && me.loc === 'drive' || R.autoSearch && R.driving && st.autopilot) {
    const s = rdNearSite();
    if (s && Math.abs(s.km - R.km) * RD_PX_KM < 30 && RD_SITES[s.type].trade !== true) rdStartSearch(s);
  }
  // ---- 电力 ----
  rdPowerTick(dh, st);
  // ---- 车辆 ----
  if (st.regen > 0) R.hpV = Math.min(st.hp, R.hpV + st.regen * dh);
  if (st.shieldMax > 0) { R.shieldCd = Math.max(0, (R.shieldCd || 0) - dt); if (R.shieldCd <= 0) R.shield = Math.min(st.shieldMax, R.shield + st.shieldMax * 0.25 * dh); }
  R.hpV = Math.min(R.hpV, st.hp);
  // ---- 人 ----
  rdNeedsTick(dh, st);
  rdProduceTick(dh, st);
  rdAI(dt, dh, st);
  rdPetTick(dt);
  // ---- 天气 / 事件 / 遭遇 ----
  if (R.weather) { R.weather.left -= dh; if (R.weather.left <= 0) { rdLog(R.weather.name + '过去了', '#94b0c2'); R.weather = null; } }
  R.evT -= dh;
  if (R.evT <= 0) { R.evT = 10 + Math.random() * 10; rdRandomEvent(); if (G.state !== 'play') return; }
  rdEncounterTick(dh, st);
  rcTick(dt);
  rdCombat(dt, st);
  rdFxTick(dt);
  // ---- 每天零点自动存档 ----
  if (rdDay() !== R.lastSaveDay) { const first = R.lastSaveDay === undefined; R.lastSaveDay = rdDay(); if (!first && me.hp > 0 && R.hpV > 0 && saveGame()) rdLog('自动存档（第 ' + rdDay() + ' 天）', '#566c86'); }
  // ---- 失败 ----
  if (me.hp <= 0) rdLose('你倒下了', me.lastHurt || '伤势过重');
  // 车辆瘫痪：不能开，修好才行（怪物会冲进车里）
  if (R.hpV <= 0 && !R.broken) { R.broken = true; R.driving = false; rdLog('车辆瘫痪了！用废料修好才能继续开（改装 → 修车）', '#ef7d57'); showBanner('车辆瘫痪！', '怪物会冲进车里——打退它们，然后用废料修车', 4, '#ef7d57'); sfx('bad'); }
  if (R.broken && R.hpV >= st.hp * 0.3) { R.broken = false; rdLog('车修好了，可以继续上路', '#a7f070'); }
}

function rdPowerTick(dh, st) {
  const R = rdR();
  const day = !rdIsNight();
  let prod = rdSum('genFree');
  if (R.speedNow > 5) prod += rdSum('alt') + rdSum('wind');
  if (R.weather && R.weather.type === 'dust') prod += rdSum('wind') * 0.5;
  const solar = rdSum('solar') + (rdVeh().solar || 0); // 电单车自带折叠太阳能板
  if (solar) prod += day ? solar * (R.weather ? 0.4 : 1) : solar * rdSum('nightSolar');
  let cons = 0;
  for (const p of rdInstalled()) if (p.pw > 0) cons += p.pw;
  // 发电机：电量低于一半时自动烧油发电
  const gen = rdSum('gen');
  R.genOn = false;
  if (gen > 0 && G.res.power < st.battery * 0.5 && G.res.fuel > 1) { prod += gen; G.res.fuel -= gen / 4 * dh; R.genOn = true; }
  R.powNet = prod - cons;
  G.res.power = Math.max(0, Math.min(st.battery, G.res.power + (prod - cons) * dh));
  const powered = G.res.power > 0.2 || prod >= cons;
  if (powered !== R.powered) {
    if (R.powered && !powered) rdLog('停电了！用电设备全部停止工作（冰箱、电脑、自动驾驶……）', '#ef7d57');
    R.powered = powered; rdFxDirty();
  }
}

// 需求：饱食、水分、精力、心情、生命、辐射
function rdNeedsTick(dh, st) {
  const R = rdR(), me = R.me, b = rdBiomeAt(R.km);
  const sleeping = me.act && me.act.type === 'sleep';
  const slow = sleeping ? 0.6 * (1 - (me.act.slowNeeds || 0)) : 1;
  me.food = Math.max(0, me.food - 3.2 * slow * dh);
  me.water = Math.max(0, me.water - 3.5 * slow * dh);
  if (!sleeping) me.energy = Math.max(0, me.energy - (me.loc === 'drive' ? 5.5 : 4.2) * dh);
  // 心情：舒适度、娱乐让心情变好，饿、渴、累、辐射、受伤让心情变差
  let dm = -0.7 + st.comfort * 0.8 + (R.pet ? 0.6 : 0);
  if (me.food < 25) dm -= 2;
  if (me.water < 25) dm -= 2;
  if (me.energy < 20) dm -= 1.5;
  if (me.rad > 50) dm -= 1.5;
  if (me.hp < 40) dm -= 1;
  if (rdIsNight() && !rdSum('warm') && me.loc !== 'drive') dm -= 0.5;
  if (me.act && me.act.fun) dm += me.act.fun;
  me.mood = Math.max(0, Math.min(100, me.mood + dm * dh));
  // 辐射
  const suitRes = Math.min(1, rdSum('radRes'));
  let rad = b.rad * 1.2 + (R.weather && R.weather.type === 'rad' ? 6 : 0);
  if (me.loc === 'out' || me.loc === 'site') rad *= 3; else rad *= 0.35;
  me.rad = Math.max(0, Math.min(100, me.rad + rad * (1 - suitRes) * dh - 0.25 * dh));
  // 生命
  const maxHp = rdMaxHp();
  let dhp = 0;
  if (me.food <= 0) { dhp -= 3; me.lastHurt = '饿死了'; }
  if (me.water <= 0) { dhp -= 4; me.lastHurt = '渴死了'; }
  if (me.rad > 60) { dhp -= (me.rad - 60) * 0.06; me.lastHurt = '辐射病'; }
  if (me.food > 30 && me.water > 30 && me.mood > 10 && me.rad < 60) dhp += 0.7 + rdSum('regenP');
  if (sleeping && me.act.heal) dhp += me.act.heal;
  me.hp = Math.max(0, Math.min(maxHp, me.hp + dhp * dh));
  // 食物变质（没有冰箱时）
  const keep = Math.min(1, st.fridge);
  if (G.res.food > 4 && keep < 1) {
    R.spoil = (R.spoil || 0) + G.res.food * (1 - keep) * 0.035 / 24 * dh * 24 / 24;
    if (R.spoil >= 1) { const n = Math.floor(R.spoil); R.spoil -= n; G.res.food = Math.max(0, G.res.food - n); if (Math.random() < 0.4) rdLog(n + ' 份食物变质了（装个冰箱就不会坏）', '#94b0c2'); }
  }
  // 车辆维修：停车时工作台慢慢修车（每点耐久用 0.25 废料）
  if (!R.driving && st.repair > 0 && R.hpV < st.hp && G.res.scrap > 0 && R.speedNow < 1) {
    const fix = Math.min(st.hp - R.hpV, st.repair * dh);
    R.hpV += fix; G.res.scrap = Math.max(0, G.res.scrap - fix * 0.2);
  }
}
function rdMaxHp() { return 100 + rdSum('hpP') + rdSum('fitness'); }

// 每天产出：种植、净水、合成、雨水
function rdProduceTick(dh, st) {
  const R = rdR();
  R.prodAcc = R.prodAcc || {};
  const add = (k, perDay) => { if (perDay <= 0) return; R.prodAcc[k] = (R.prodAcc[k] || 0) + perDay * dh / 24; if (R.prodAcc[k] >= 1) { const n = Math.floor(R.prodAcc[k]); R.prodAcc[k] -= n; rdGain(k, n); } };
  add('food', rdSum('foodGen'));
  add('water', rdSum('waterGen') + rdSum('rain') * (R.weather && R.weather.type === 'storm' ? 3 : 1));
  add('med', rdSum('medGen'));
}

// ---------- 搜索建筑 ----------
function rdStartSearch(s) {
  const R = rdR(), me = R.me, S = RD_SITES[s.type];
  if (S.trade) { rdOpenTrade(s); return; }
  R.driving = false;
  R.search = { site: s, phase: 'walk', t: 0 };
  me.loc = 'out'; me.act = null;
  me.wx = rdVehX() - rdVeh().len * 0.5;
  me.face = s.km * RD_PX_KM > me.wx ? 1 : -1;
  R.view = 'out';
  rdLog('停车，下车去搜索' + S.name + (rdIsNight() ? '（天黑了，小心）' : ''), '#ffcd75');
}
function rdSearchDur(s) {
  const st = rdStats(), me = rdR().me;
  return RD_SITES[s.type].size * 0.6 * Math.max(0.35, 1 - st.searchSpd) * (me.mood < 20 ? 1.3 : 1) * (me.energy < 15 ? 1.3 : 1);
}
function rdSearchTick(dt) {
  const R = rdR(), me = R.me, sr = R.search;
  if (!sr) return;
  const s = sr.site, door = s.km * RD_PX_KM;
  const walk = RD_WALK * (1 + rdSum('walk'));
  if (sr.phase === 'walk') {
    const d = door - me.wx;
    me.face = d > 0 ? 1 : -1;
    if (Math.abs(d) < 3) { sr.phase = 'in'; sr.t = 0; sr.dur = rdSearchDur(s) * RD_HOUR; me.loc = 'site'; }
    else me.wx += Math.sign(d) * Math.min(Math.abs(d), walk * dt);
  } else if (sr.phase === 'in') {
    sr.t += dt;
    if (sr.t >= sr.dur) rdFinishSearch();
  } else if (sr.phase === 'back') {
    const home = rdVehX() - rdVeh().len * 0.5, d = home - me.wx;
    me.face = d > 0 ? 1 : -1;
    // 有怪物靠近时边打边退
    if (Math.abs(d) < 3) { me.loc = 'in'; me.act = null; R.search = null; me.ix = 0.6; rdLog('回到了车上', '#94b0c2'); }
    else me.wx += Math.sign(d) * Math.min(Math.abs(d), walk * dt);
  }
}
function rdFinishSearch() {
  const R = rdR(), sr = R.search, s = sr.site, S = RD_SITES[s.type], st = rdStats(), me = R.me;
  s.searched = true;
  R.stats.searched++;
  const got = [];
  const mul = (1 + st.lootBonus) * (0.8 + Math.min(1.2, R.km / 1500));
  for (const k in S.res) {
    const [a, b] = S.res[k];
    let n = Math.round((a + Math.random() * (b - a)) * mul);
    if (k === 'scrap') n = Math.round(n * 1.4 * (1 + st.scrapBonus));
    const g = rdGain(k, n);
    if (g > 0) got.push(RD_RES[k].name + ' +' + g);
    if (g < n && k !== 'power') got.push('（' + RD_RES[k].name + '装不下了，丢了 ' + (n - g) + '）');
  }
  // 改装件
  let parts = 0;
  if (Math.random() < S.partChance * (1 + st.lootBonus)) parts++;
  if (Math.random() < S.partChance * 0.35 * (1 + st.lootBonus)) parts++;
  for (let i = 0; i < parts; i++) {
    const p = rdRollPart(S, s);
    if (p) { R.inv.push(p.id); got.push('【' + RD_TIER_NAME[p.tier] + '】' + p.name); rdFound(p); }
  }
  // 图纸
  if (Math.random() < 0.12) {
    const p = rdRollPart(S, s);
    if (p && !R.bps[p.id] && !p.alien) { R.bps[p.id] = true; got.push('图纸：' + p.name); }
  }
  if (S.rad) me.rad = Math.min(100, me.rad + S.rad * (1 - Math.min(1, rdSum('radRes'))));
  rdLog('搜索' + S.name + '：' + (got.length ? got.join('，') : '什么也没找到'), got.length ? '#a7f070' : '#94b0c2');
  showBanner(S.name + ' 搜索完毕', got.slice(0, 4).join('　') || '空手而归', 3, '#a7f070');
  me.mood = Math.min(100, me.mood + (got.length ? 3 : -2));
  sfx('coin');
  // 遇袭：怪物追出来
  const night = rdIsNight() ? 1.5 : 1;
  if (Math.random() < s.danger * night * (1 + R.km / 1800) * (1 - st.stealth * 0.5)) {
    const n = rdSpawnGroup(s.km * RD_PX_KM + 20, true);
    if (n) { rdLog('有东西从' + S.name + '里追了出来！', '#ef7d57'); showBanner('遇袭！', '怪物追出来了，快回车上', 3, '#ef7d57'); sfx('bad'); }
  }
  // 宠物
  if ((s.type === 'house' || s.type === 'farm') && !R.pet && Math.random() < 0.18) rdOfferPet();
  sr.phase = 'back';
  me.loc = 'out';
}
// 掷一个改装件（越往后品阶越高）
function rdRollPart(S, s) {
  const R = rdR();
  const maxT = Math.min(5, 1 + Math.floor(R.km / 220) + (S.tierBonus || 0));
  let tier;
  const r = Math.random();
  if (r < 0.35) tier = maxT; else if (r < 0.75) tier = maxT - 1; else tier = 1 + Math.floor(Math.random() * maxT);
  tier = Math.max(1, Math.min(5, tier));
  const alien = S.alienParts && Math.random() < S.alienParts;
  let pool = RD_PART_LIST.filter((p) => S.slots.includes(p.slot) && (p.slot !== 'in' || !S.kinds || S.kinds.includes(p.kind)));
  if (alien) pool = pool.filter((p) => p.alien);
  else pool = pool.filter((p) => !p.alien);
  let pick = pool.filter((p) => p.tier === tier);
  if (!pick.length) pick = pool.filter((p) => p.tier <= tier);
  if (!pick.length) pick = pool;
  return pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
}
function rdFound(p) { if (p.tier >= 4) rdR().me.mood = Math.min(100, rdR().me.mood + 6); if (p.tier >= 5) { showBanner('稀有发现！', '【' + RD_TIER_NAME[p.tier] + '】' + p.name, 4, RD_TIER_COLOR[p.tier]); rcPlayerRare(p); } }

// ---------- 路障 ----------
function rdCheckObstacles(st) {
  const R = rdR();
  for (const o of R.obs) {
    if (o.hit || o.km > R.km || o.km < R.km - 0.5) continue;
    o.hit = true;
    if (st.hover) continue; // 漂浮：直接飞过去
    const dmg = Math.round(18 * (1 + R.km / 1500) * (1 - st.obs) * (1 - st.armor * 0.5));
    if (dmg > 0) { rdHurtVehicle(dmg, true); R.speedNow *= 0.45; rdLog('撞上了路障' + (st.obs > 0 ? '（撞角/轮胎减轻了伤害）' : '') + '，车辆 -' + dmg, '#ef7d57'); }
    rdBurst((o.km * RD_PX_KM), 0, '#6e6a62', 10);
    G.shake = 0.25;
  }
}
function rdHurtVehicle(dmg, raw) {
  const R = rdR(), st = R.st || rdStats();
  let d = raw ? dmg : dmg * (1 - st.armor);
  if (R.shield > 0) { const a = Math.min(R.shield, d); R.shield -= a; d -= a; R.shieldCd = 3; }
  R.hpV = Math.max(0, R.hpV - d);
  R.hitT = 0.15;
}
function rdHurtMe(dmg, why) {
  const me = rdR().me;
  me.hp = Math.max(0, me.hp - dmg * (1 - Math.min(0.8, rdSum('armorP'))));
  me.lastHurt = why || '被怪物杀死';
  me.hitT = 0.15;
}

// ---------- 遭遇怪物 ----------
function rdEncounterTick(dh, st) {
  const R = rdR();
  R.encT -= dh * (rdIsNight() ? 1.7 : 1) * (1 - st.stealth) * (R.driving ? 1 : 0.4) * (1 + R.km / 900) * (st.light || !rdIsNight() ? 1 : 1.2);
  if (R.encT > 0) return;
  R.encT = 5 + Math.random() * 5;
  if (R.km < 3) return;
  const ahead = Math.random() < 0.7;
  const x = rdVehX() + (ahead ? 260 + Math.random() * 120 : -rdVeh().len - 200);
  rdSpawnGroup(x, false, !ahead);
}
function rdMonsterPool() {
  const R = rdR(), bi = rdBiomeIndex(R.km), b = rdBiomeAt(R.km);
  return Object.keys(RD_MONSTERS).filter((k) => {
    const m = RD_MONSTERS[k];
    if (m.minKm && R.km < m.minKm) return false;
    if (m.alienOnly && !b.alien) return false;
    if (m.biome !== undefined && m.biome !== bi) return false;
    return true;
  });
}
function rdSpawnGroup(x, fromSite, behind) {
  const R = rdR();
  let pool = rdMonsterPool();
  if (behind) pool = pool.filter((k) => RD_MONSTERS[k].chase || RD_MONSTERS[k].fly);
  if (!pool.length) return 0;
  // 大怪少见
  let type = pool[Math.floor(Math.random() * pool.length)];
  if (RD_MONSTERS[type].big && Math.random() < 0.6) type = pool[Math.floor(Math.random() * pool.length)];
  const M = RD_MONSTERS[type];
  const n = M.swarm[0] + Math.floor(Math.random() * (M.swarm[1] - M.swarm[0] + 1)) + (R.km > 600 && Math.random() < 0.4 ? 1 : 0);
  const hpMul = 1 + R.km / 800, dmgMul = 1 + R.km / 2400;
  R.mons = R.mons || [];
  for (let i = 0; i < n; i++) {
    R.mons.push({ type, x: x + (Math.random() - 0.5) * 40 + i * (behind ? -14 : 14), y: M.fly ? -30 - Math.random() * 20 : 0, hp: M.hp * hpMul, max: M.hp * hpMul, dmg: M.dmg * dmgMul, patience: 25 + Math.random() * 20,
      spd: M.spd * (0.85 + Math.random() * 0.3), cd: 0, ramCd: 0, burn: 0, slow: 0, ph: Math.random() * 6, face: -1, atkT: 0 });
  }
  return n;
}

// ---------- 战斗 ----------
function rdWeapons() {
  const R = rdR(), st = R.st || rdStats();
  return R.wpn.slice(0, st.mounts).map((id, i) => ({ id, p: RD_PARTS[id], i })).filter((w) => w.p);
}
function rdMountPos(i) { // 武器在车上的位置（相对车头，像素）
  const v = rdVeh(), L = v.len;
  const xs = [-L * 0.45, -L * 0.75, -L * 0.25, -L * 0.6, -L * 0.15];
  return { x: xs[i % xs.length], y: -(v.tent ? 18 : L > 50 ? 30 : 26) };
}
function rdCombat(dt, st) {
  const R = rdR(), me = R.me;
  R.mons = R.mons || []; R.proj = R.proj || [];
  const vx = rdVehX(), L = rdVeh().len;
  rdSearchTick(dt);
  if (R.hitT > 0) R.hitT -= dt;
  if (me.hitT > 0) me.hitT -= dt;
  // ---- 怪物移动、攻击 ----
  const outside = me.loc === 'out';
  for (const m of R.mons) {
    const M = RD_MONSTERS[m.type];
    m.ph += dt;
    if (m.burn > 0) { m.burn -= dt; m.hp -= m.burnDps * dt; }
    if (m.slow > 0) m.slow -= dt;
    m.cd -= dt; m.ramCd -= dt; m.atkT -= dt;
    // 目标：车外的主角更近就追主角
    const tx = outside && Math.abs(me.wx - m.x) < Math.abs((vx - L / 2) - m.x) + 30 ? me.wx : vx - L / 2;
    const half = outside && tx === me.wx ? 4 : L / 2 + M.w / 2 - 2;
    let d = tx - m.x;
    const spd = m.spd * (m.slow > 0 ? 0.45 : 1);
    // 围着一辆关紧门的车啃久了会失去耐心，自己走掉
    if (!outside && R.speedNow < 1 && Math.abs(d) < half + 30) { m.patience -= dt * (R.hpV > 0 ? 1 : 0.5); if (m.patience <= 0) m.leave = true; }
    if (m.leave) { d = -(Math.sign(tx - m.x) || 1) * 999; if (Math.abs(m.x - tx) > 420) m.hp = 0; }
    m.face = d > 0 ? 1 : -1;
    if (M.ranged && Math.abs(d) < M.ranged && Math.abs(d) > half) {
      if (m.cd <= 0) { m.cd = 2.2; R.proj.push({ kind: 'spit', x: m.x, y: M.fly ? m.y : -M.h * 0.6, tx, ty: outside && tx === me.wx ? -8 : -14, spd: 160, dmg: m.dmg * 1.2, foe: true, life: 3, toMe: outside && tx === me.wx, color: M.glow }); }
    } else if (Math.abs(d) > half) {
      m.x += Math.sign(d) * spd * dt;
    } else if (m.atkT <= 0) {
      m.atkT = 1.2;
      m.lunge = 0.2;
      if (outside && tx === me.wx) { rdHurtMe(m.dmg * 1.5, '被' + M.name + '杀死'); sfx('hit'); }
      else if (R.hpV <= 0 && me.loc !== 'site') { rdHurtMe(m.dmg * 0.4, '怪物冲进了瘫痪的车里'); sfx('hit'); } // 车被攻破：怪物扒进车里
      else { rdHurtVehicle(m.dmg); if (st.thorns) rdHitMon(m, st.thorns, null); sfx('hit'); }
    }
    if (m.lunge > 0) m.lunge -= dt;
    // 飞行怪：上下飘
    if (M.fly) m.y = -34 + Math.sin(m.ph * 3) * 6 + (Math.abs(d) < half + 8 ? 14 : 0);
    // 撞击：车开着冲过去
    if (!M.fly && R.speedNow > 12 && m.ramCd <= 0 && m.x > vx - L && m.x < vx + M.w / 2 + 2) {
      m.ramCd = 0.6;
      const dmg = st.ram * (R.speedNow / 60) * 1.6;
      rdHitMon(m, dmg, null, true);
      m.x = vx + 6 + M.w; // 被撞飞
      m.y = -6;
      rdHurtVehicle(m.dmg * 0.25 * Math.max(0.25, 1 - rdSum('ram') / 120)); // 撞角越强，撞怪时车自己越不疼
      R.speedNow *= M.big ? 0.4 : 0.85;
      G.shake = Math.max(G.shake || 0, M.big ? 0.3 : 0.12);
    }
    if (!M.fly && m.y < 0) m.y = Math.min(0, m.y + 60 * dt);
  }
  // 太远的怪物消失（被甩掉了）
  R.mons = R.mons.filter((m) => m.hp > 0 && m.x > vx - 700 && m.x < vx + 900);
  // ---- 车载武器 ----
  const night = rdIsNight() && !st.light;
  for (const w of rdWeapons()) {
    w.p._cd = w.p._cd || {};
    const key = 'w' + w.i;
    R.wcd = R.wcd || {};
    R.wcd[key] = (R.wcd[key] || 0) - dt;
    if (R.wcd[key] > 0) continue;
    const fx = w.p.fx, mp = rdMountPos(w.i);
    const ox = vx + mp.x, oy = mp.y;
    const range = fx.range * (1 + st.rangePct) * (night ? 0.75 : 1);
    const tgt = rdTarget(ox, range, fx.noAir);
    if (!tgt) continue;
    if (fx.ammo !== 'none' && fx.use > 0) {
      const have = G.res[fx.ammo] || 0;
      if (have < fx.use) { if (!R.ammoWarn || R.ammoWarn < G.time - 20) { R.ammoWarn = G.time; rdLog(w.p.name + '没有' + RD_RES[fx.ammo].name + '了，打不响', '#ef7d57'); } continue; }
      G.res[fx.ammo] = have - fx.use;
    }
    R.wcd[key] = 1 / fx.rate;
    R.aim = R.aim || {}; R.aim[key] = Math.atan2((tgt.y - (RD_MONSTERS[tgt.type].fly ? 0 : RD_MONSTERS[tgt.type].h / 2)) - oy, tgt.x - ox);
    rdFire(fx, ox, oy, tgt, 1 + st.aim, false);
  }
  // ---- 主角随身武器（在车外；在车里时从车窗还击扒车的怪物） ----
  const inCar = (me.loc === 'in' || me.loc === 'drive') && R.speedNow < 5;
  if ((outside || inCar) && R.hand) {
    const fx = RD_PARTS[R.hand].fx;
    me.wcd = (me.wcd || 0) - dt;
    if (inCar) me.wx = vx - L / 2;
    const tgt = rdTarget(me.wx, inCar ? (fx.range < 20 ? L / 2 + 12 : Math.min(fx.range, 120)) : fx.range + (fx.range < 20 ? 6 : 0), fx.range > 20 ? false : true);
    if (tgt && me.wcd <= 0) {
      let ok = true;
      if (fx.ammo && fx.use) { if ((G.res[fx.ammo] || 0) < fx.use) ok = false; else G.res[fx.ammo] -= fx.use; }
      if (!ok && fx.range > 20) { // 没子弹就用枪托砸
        if (Math.abs(tgt.x - me.wx) < 18) { me.wcd = 1; rdHitMon(tgt, 4, null); me.swing = 0.2; }
      } else if (ok) {
        me.wcd = 1 / fx.rate;
        me.face = tgt.x > me.wx ? 1 : -1;
        if (fx.range < 20) { rdHitMon(tgt, fx.dmg * (inCar ? 0.7 : 1), fx); me.swing = 0.2; rdSpark(tgt.x, -6, '#f4f4f4'); }
        else rdFire(fx, me.wx + me.face * 4, inCar ? -20 : -9, tgt, 1, true);
      }
    }
  }
  if (me.swing > 0) me.swing -= dt;
  // ---- 子弹 ----
  for (const p of R.proj) rdProjTick(p, dt);
  R.proj = R.proj.filter((p) => p.life > 0);
}
function rdTarget(x, range, noAir) {
  const R = rdR();
  let best = null, bd = range;
  for (const m of R.mons) {
    if (m.hp <= 0) continue;
    if (noAir && RD_MONSTERS[m.type].fly) continue;
    const d = Math.abs(m.x - x);
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
const RD_PROJ_SPD = { rock: 220, nail: 320, bullet: 420, pellet: 380, harpoon: 300, flame: 160, shell: 230, rocket: 260, mortar: 200, acid: 240, plasma: 280, grav: 150, spit: 160 };
function rdFire(fx, ox, oy, tgt, mul, mine) {
  const R = rdR(), M = RD_MONSTERS[tgt.type];
  const ty = M.fly ? tgt.y : -M.h / 2;
  const n = fx.count || 1;
  sfx(fx.proj === 'laser' || fx.proj === 'beam' || fx.proj === 'rail' || fx.proj === 'arc' ? 'coin' : 'hit');
  // 光束类：瞬间命中
  if (fx.proj === 'laser' || fx.proj === 'beam' || fx.proj === 'rail' || fx.proj === 'arc') {
    const hits = fx.pierce ? R.mons.filter((m) => m.hp > 0 && Math.abs(m.x - ox) < fx.range * 1.2 && Math.sign(m.x - ox) === Math.sign(tgt.x - ox)) : [tgt];
    for (const m of hits) rdHitMon(m, fx.dmg * mul, fx);
    R.fx.push({ kind: fx.proj, x: ox, y: oy, x2: fx.pierce ? ox + Math.sign(tgt.x - ox) * fx.range : tgt.x, y2: ty, life: fx.proj === 'rail' ? 0.25 : 0.1, max: 0.25 });
    if (fx.chain) { // 闪电链
      let from = tgt; const done = new Set([tgt]);
      for (let c = 0; c < fx.chain; c++) {
        const nx = R.mons.filter((m) => m.hp > 0 && !done.has(m)).sort((a, b) => Math.abs(a.x - from.x) - Math.abs(b.x - from.x))[0];
        if (!nx || Math.abs(nx.x - from.x) > 70) break;
        done.add(nx); rdHitMon(nx, fx.dmg * mul * 0.7, fx);
        R.fx.push({ kind: 'arc', x: from.x, y: RD_MONSTERS[from.type].fly ? from.y : -6, x2: nx.x, y2: RD_MONSTERS[nx.type].fly ? nx.y : -6, life: 0.12, max: 0.12 });
        from = nx;
      }
    }
    return;
  }
  for (let i = 0; i < n; i++) {
    const spread = n > 1 ? (Math.random() - 0.5) * (fx.proj === 'pellet' ? 22 : 30) : 0;
    const spd = RD_PROJ_SPD[fx.proj] || 300;
    const arc = fx.proj === 'mortar' || fx.proj === 'shell' || fx.proj === 'rock';
    const tx = tgt.x + (tgt.spd || 0) * 0.15 * (tgt.face || 0), tyy = ty + spread;
    const dist = Math.hypot(tx - ox, tyy - oy), time = Math.max(0.15, dist / spd);
    R.proj.push({ kind: fx.proj, x: ox, y: oy, vx: (tx - ox) / time + (n > 1 && fx.proj === 'rocket' ? (Math.random() - 0.5) * 40 : 0), vy: (tyy - oy) / time - (arc ? 120 * time * 0.5 * 2 : 0), g: arc ? 240 : 0,
      dmg: fx.dmg * mul, fx, life: time + 0.6, pierce: fx.pierce || 0, hitSet: [], mine });
  }
}
function rdProjTick(p, dt) {
  const R = rdR(), me = R.me;
  p.life -= dt;
  if (p.foe) { // 怪物的酸液
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    if (d < 6) { p.life = 0; if (p.toMe) rdHurtMe(p.dmg, '被酸液腐蚀'); else rdHurtVehicle(p.dmg); rdBurst(p.x, p.y, p.color, 5); return; }
    p.x += dx / d * p.spd * dt; p.y += dy / d * p.spd * dt;
    return;
  }
  p.vy += (p.g || 0) * dt;
  const ox = p.x, oy = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.kind === 'flame' || p.kind === 'rocket') if (Math.random() < 0.5) rdSmoke(p.x, p.y, p.kind === 'flame' ? '#ef7d57' : '#94b0c2');
  // 撞地 / 命中
  const ground = p.y >= 0;
  for (const m of R.mons) {
    if (m.hp <= 0 || p.hitSet.includes(m)) continue;
    const M = RD_MONSTERS[m.type];
    const my = M.fly ? m.y : -M.h / 2;
    // 按这一帧飞过的线段判断（帧率低时子弹也不会穿过怪物）
    const sx = p.x - ox, sy = p.y - oy, L2 = sx * sx + sy * sy || 1;
    const tt = Math.max(0, Math.min(1, ((m.x - ox) * sx + (my - oy) * sy) / L2));
    const cx = ox + sx * tt, cy = oy + sy * tt;
    if (Math.abs(m.x - cx) < M.w / 2 + 3 && Math.abs(my - cy) < M.h / 2 + 4) {
      if (p.fx.splash) { rdExplode(p, p.x, p.y); return; }
      rdHitMon(m, p.dmg, p.fx);
      p.hitSet.push(m);
      if (p.pierce > 0) p.pierce--; else { p.life = 0; return; }
    }
  }
  if (ground) { if (p.fx.splash) rdExplode(p, p.x, 0); else { p.life = 0; rdSpark(p.x, 0, '#94b0c2'); } }
}
function rdExplode(p, x, y) {
  const R = rdR();
  p.life = 0;
  const r = p.fx.splash;
  for (const m of R.mons) {
    if (m.hp <= 0) continue;
    const M = RD_MONSTERS[m.type], my = M.fly ? m.y : -M.h / 2;
    if (Math.hypot(m.x - x, my - y) < r + M.w / 2) {
      rdHitMon(m, p.dmg, p.fx);
      if (p.fx.pull) m.x += (x - m.x) * 0.6;
    }
  }
  R.fx.push({ kind: p.kind === 'grav' ? 'gravboom' : p.kind === 'plasma' ? 'plasmaboom' : 'boom', x, y, r, life: 0.4, max: 0.4 });
  G.shake = Math.max(G.shake || 0, 0.12);
  sfx('hit');
}
function rdHitMon(m, dmg, fx, ram) {
  const R = rdR();
  m.hp -= dmg;
  m.hitT = 0.1;
  if (fx && fx.burn) { m.burn = 3; m.burnDps = fx.burn; }
  if (fx && fx.slow) m.slow = 2;
  if (Math.random() < 0.5) rdSpark(m.x, RD_MONSTERS[m.type].fly ? m.y : -RD_MONSTERS[m.type].h / 2, ram ? '#ffcd75' : '#b13e53');
  if (m.hp <= 0 && !m.dead) {
    m.dead = true;
    R.stats.kills++;
    const M = RD_MONSTERS[m.type], st = R.st || rdStats();
    rdBurst(m.x, M.fly ? m.y : -M.h / 2, M.glow, 8);
    const got = [];
    if (!M.drop.scrap && Math.random() < 0.45) { const n = rdGain('scrap', 1); if (n) got.push('+1废料'); }
    for (const k in M.drop) if (Math.random() < M.drop[k]) { let n = 1 + Math.floor(Math.random() * (M.big ? 4 : 2)); if (k === 'scrap') n = Math.round(n * (1 + st.scrapBonus)); n = rdGain(k, n); if (n) got.push('+' + n + RD_RES[k].name); }
    if (got.length) rdFloat(m.x, -M.h - 6, got.join(' '), '#ffcd75');
  }
}

// ---------- 特效粒子 ----------
function rdFxTick(dt) {
  const R = rdR();
  R.fx = R.fx || []; R.parts = R.parts || [];
  for (const f of R.fx) f.life -= dt;
  R.fx = R.fx.filter((f) => f.life > 0);
  for (const p of R.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
  R.parts = R.parts.filter((p) => p.life > 0);
  if (R.parts.length > 300) R.parts.splice(0, R.parts.length - 300);
  R.floats = (R.floats || []).filter((f) => (f.t += dt) < 1.4);
  if (G.shake > 0) G.shake -= dt;
}
function rdSpark(x, y, c) { const R = rdR(); R.parts = R.parts || []; for (let i = 0; i < 3; i++) R.parts.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, g: 200, life: 0.3, c }); }
function rdBurst(x, y, c, n) { const R = rdR(); R.parts = R.parts || []; for (let i = 0; i < n; i++) R.parts.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 90, g: 220, life: 0.5 + Math.random() * 0.3, c, s: 2 }); }
function rdSmoke(x, y, c) { const R = rdR(); R.parts = R.parts || []; R.parts.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: -10 - Math.random() * 10, life: 0.4, c, s: 2, fade: true }); }
function rdFloat(x, y, text, color) { const R = rdR(); R.floats = R.floats || []; R.floats.push({ x, y, text, color, t: 0 }); }

// ---------- 主角的自主活动（车内） ----------
// 每个活动：type · item(用哪件家具) · t(还剩几小时) · 去的位置 tx
function rdItemAt(it) { // 家具中心在车内的位置（格）
  const p = RD_PARTS[it.id];
  return it.cell + (p.w || 1) / 2;
}
function rdFindItem(test) {
  const R = rdR();
  let best = null, bv = -1;
  for (const it of R.inner) {
    const p = RD_PARTS[it.id];
    if (p.pw > 0 && !R.powered) continue;
    const v = test(p, it);
    if (v > bv) { bv = v; best = it; }
  }
  return bv > 0 ? best : null;
}
function rdAI(dt, dh, st) {
  const R = rdR(), me = R.me;
  if (me.loc === 'out' || me.loc === 'site') return;
  const mustDrive = R.driving && !st.autopilot;
  // 开车：没有自动驾驶就得坐在驾驶座上
  if (mustDrive) {
    if (me.loc !== 'drive') { me.loc = 'drive'; me.act = null; }
    me.ix = -0.8;
    // 路上随手吃喝
    if (me.food < 35 && G.res.food >= 1) { G.res.food--; me.food = Math.min(100, me.food + 22); rdThink('eat'); }
    if (me.water < 35 && G.res.water >= 1) { G.res.water--; me.water = Math.min(100, me.water + 28); rdThink('drink'); }
    if (me.hp < 40 && G.res.med >= 1) { G.res.med--; me.hp = Math.min(rdMaxHp(), me.hp + 30); me.rad = Math.max(0, me.rad - 15); }
    // 太困了：只能停车
    if (me.energy < 8) { R.driving = false; rdLog('困得睁不开眼，只好停车休息（装上自动驾驶就能边开边睡）', '#ef7d57'); showBanner('疲劳驾驶', '太困了，停车休息', 3, '#ef7d57'); }
    me.bubble = me.energy < 25 ? 'tired' : me.food < 30 ? 'hungry' : me.mood < 25 ? 'sad' : null;
    return;
  }
  if (me.loc === 'drive') { me.loc = 'in'; me.act = null; }
  // 正在做的事
  const a = me.act;
  if (a) {
    if (a.tx !== undefined && Math.abs(me.ix - a.tx) > 0.05) { // 先走过去
      const d = a.tx - me.ix;
      me.face = d > 0 ? -1 : 1; // 车内：格子往左增大，所以往“格子大”的方向走是朝左
      me.ix += Math.sign(d) * Math.min(Math.abs(d), (RD_WALK / 24) * dt);
      me.walking = true;
      return;
    }
    me.walking = false;
    a.t -= dh;
    rdActTick(a, dh, st);
    if (a.t <= 0 || a.done) { rdActEnd(a); me.act = null; }
    return;
  }
  me.act = rdChooseAct(st);
}
function rdThink(b) { const me = rdR().me; me.bubble = b; me.bubbleT = 2.5; }
function rdChooseAct(st) {
  const R = rdR(), me = R.me, night = rdIsNight();
  const go = (type, it, hours, extra) => Object.assign({ type, it, t: hours, tx: it ? rdItemAt(it) : me.ix }, extra || {});
  // 急救
  if (me.hp < 50 && G.res.med >= 1) { G.res.med--; me.hp = Math.min(rdMaxHp(), me.hp + 30); me.rad = Math.max(0, me.rad - 15); rdThink('heal'); }
  if (me.water < 50 && G.res.water >= 1) { const it = rdFindItem((p) => p.act === 'drink' ? 1 : p.kind === 'fridge' ? 0.5 : 0); return go('drink', it, 0.2); }
  if (me.food < 50 && G.res.food >= 1) {
    const stove = rdFindItem((p) => p.act === 'cook' ? p.fx.cook : 0);
    if (stove) return go('cook', stove, 0.7);
    const fr = rdFindItem((p) => p.act === 'eat' ? 1 : 0);
    return go('eat', fr, 0.4);
  }
  if (me.energy < 28 || (night && me.energy < 85) || me.energy < 50 && me.mood < 15) {
    const bed = rdFindItem((p) => p.act === 'sleep' ? p.fx.sleep : 0);
    return go('sleep', bed, 99, { q: bed ? RD_PARTS[bed.id].fx.sleep : rdVeh().tent ? 0.7 : 0.5, heal: bed ? RD_PARTS[bed.id].fx.sleepHeal || 0 : 0, slowNeeds: bed ? RD_PARTS[bed.id].fx.slowNeeds || 0 : 0, tx: bed ? rdItemAt(bed) : me.ix });
  }
  if (me.rad > 35) { const sh = rdFindItem((p) => p.fx.radClean || 0); if (sh) return go(RD_PARTS[sh.id].act === 'shower' ? 'shower' : 'heal', sh, 1.5); }
  if (me.hp < rdMaxHp() * 0.8) { const md = rdFindItem((p) => p.act === 'heal' ? p.fx.heal : 0); if (md) return go('heal', md, 2); }
  if (me.energy < 55) { const cf = rdFindItem((p) => p.fx.coffee ? 1 : 0); if (cf && !(R.coffeeT > R.t - 6)) { R.coffeeT = R.t; return go('coffee', cf, 0.4); } }
  if (R.research.cur && st.research >= (RD_RESEARCH.find((x) => x.id === R.research.cur.id) || { lv: 9 }).lv) { const pc = rdFindItem((p) => p.fx.research || 0); if (pc) return go('research', pc, 2); }
  if (R.craftQ.length) { const bn = rdFindItem((p) => p.fx.craft >= RD_PARTS[R.craftQ[0].id].tier ? p.fx.craft : 0); if (bn) return go('craft', bn, 2); }
  // 植物
  const plant = rdFindItem((p) => p.act === 'plant' ? 1 : 0);
  if (plant && Math.random() < 0.15) return go('plant', plant, 0.5);
  // 宠物
  if (R.pet && Math.random() < 0.12) return go('pet', null, 0.6, { tx: R.pet.ix });
  // 娱乐
  if (me.mood < 85 || Math.random() < 0.5) {
    const fun = rdFindItem((p) => p.fx.fun ? p.fx.fun * (0.6 + Math.random() * 0.8) : 0);
    if (fun) { const p = RD_PARTS[fun.id]; return go('fun', fun, 1.5 + Math.random() * 1.5, { fun: p.fx.fun, anim: p.anim || (p.kind === 'pc' ? 'game' : 'watch') }); }
  }
  // 发呆：心情差时抱膝坐着，心情好时到处走走、看窗外
  const n = Math.max(1, rdCellCount('floor'));
  if (me.mood < 30 && Math.random() < 0.6) return go('mope', null, 1, { tx: Math.random() * n });
  return Math.random() < 0.5 ? go('window', null, 0.6 + Math.random() * 0.8, { tx: Math.random() * n, fun: 1.2 }) : go('wander', null, 0.4 + Math.random() * 0.6, { tx: Math.random() * n, fun: 0.5 });
}
function rdActTick(a, dh, st) {
  const R = rdR(), me = R.me;
  if (a.type === 'sleep') {
    me.energy = Math.min(100, me.energy + 12 * a.q * dh);
    if (me.energy >= 99 || (!rdIsNight() && me.energy > 75) || (me.food < 20 && G.res.food > 0) || (me.water < 20 && G.res.water > 0)) a.done = true;
  } else if (a.type === 'heal') {
    const p = a.it && RD_PARTS[a.it.id];
    if (p) { me.hp = Math.min(rdMaxHp(), me.hp + (p.fx.heal || 0) * dh); me.rad = Math.max(0, me.rad - (p.fx.radClean || 0) * dh); }
    if (me.hp >= rdMaxHp() - 1 && me.rad < 5) a.done = true;
  } else if (a.type === 'shower') {
    const p = RD_PARTS[a.it.id];
    me.rad = Math.max(0, me.rad - (p.fx.radClean || 0) * dh);
    a.fun = p.fx.fun || 0;
  } else if (a.type === 'research') {
    const cur = R.research.cur;
    if (!cur) { a.done = true; return; }
    cur.left -= dh * (me.mood > 70 ? 1.2 : me.mood < 20 ? 0.7 : 1);
    if (cur.left <= 0) rdFinishResearch();
  } else if (a.type === 'craft') {
    const q = R.craftQ[0];
    if (!q) { a.done = true; return; }
    q.left -= dh;
    if (q.left <= 0) { R.craftQ.shift(); R.inv.push(q.id); rdLog('制作完成：' + RD_PARTS[q.id].name, '#a7f070'); showBanner('制作完成', RD_PARTS[q.id].name + '（在仓库里）', 3, '#a7f070'); sfx('build'); a.done = true; }
  }
}
function rdActEnd(a) {
  const R = rdR(), me = R.me, st = R.st;
  if (a.type === 'eat' || a.type === 'cook') {
    if (G.res.food >= 1) {
      G.res.food--;
      const mul = a.type === 'cook' ? st.cook : 1;
      me.food = Math.min(100, me.food + 25 * mul);
      me.water = Math.min(100, me.water + 6); // 吃东西也补一点水分
      if (rdSum('dine')) me.mood = Math.min(100, me.mood + 4);
      if (a.type === 'cook' && mul >= 1.5) me.mood = Math.min(100, me.mood + 2);
      rdThink(mul >= 1.5 ? 'yum' : 'eat');
    }
  } else if (a.type === 'drink') {
    if (G.res.water >= 1) { G.res.water--; me.water = Math.min(100, me.water + 35); rdThink('drink'); }
  } else if (a.type === 'coffee') {
    me.energy = Math.min(100, me.energy + 15); me.mood = Math.min(100, me.mood + 4); rdThink('yum');
  } else if (a.type === 'pet') {
    me.mood = Math.min(100, me.mood + 6); rdThink('love');
  } else if (a.type === 'fun') {
    if (a.fun >= 8) rdThink('happy');
  }
}
function rdPetTick(dt) {
  const R = rdR(), pet = R.pet, me = R.me;
  if (!pet) return;
  pet.t = (pet.t || 0) - dt;
  if (pet.t <= 0) {
    pet.t = 2 + Math.random() * 4;
    const n = Math.max(1, rdCellCount('floor'));
    const bed = R.inner.find((it) => RD_PARTS[it.id].fx.pet);
    if (rdIsNight() && bed) pet.tx = rdItemAt(bed);
    else if (Math.random() < 0.5 && me.loc === 'in') pet.tx = me.ix + (Math.random() - 0.5);
    else pet.tx = Math.random() * n;
    pet.sleep = rdIsNight() && !!bed;
  }
  const d = (pet.tx || 0) - pet.ix;
  pet.walking = Math.abs(d) > 0.05;
  if (pet.walking) { pet.face = d > 0 ? -1 : 1; pet.ix += Math.sign(d) * Math.min(Math.abs(d), 1.6 * dt); }
}

// ---------- 研究 / 制作 ----------
function rdStartResearch(r) {
  const R = rdR();
  if (R.research.cur) return;
  if (!rdPay(r.cost)) return;
  R.research.cur = { id: r.id, left: r.hours };
  rdLog('开始研究：' + r.name + '（需要坐在电脑前 ' + r.hours + ' 小时）', '#73eff7');
}
function rdFinishResearch() {
  const R = rdR(), cur = R.research.cur, r = RD_RESEARCH.find((x) => x.id === cur.id);
  R.research.done[r.id] = true; R.research.cur = null;
  for (const id of r.bp) R.bps[id] = true;
  rdLog('研究完成：' + r.name + '！学会了 ' + r.bp.map((id) => RD_PARTS[id].name).join('、') + ' 的图纸', '#73eff7');
  showBanner('研究完成：' + r.name, '可以在「制作」里制作新部件了', 4, '#73eff7');
  sfx('win');
}
// 用废料做弹药（需要工作台，马上做好）
function rdMakeAmmo() {
  if (!rdStats().craft) return;
  if (G.res.scrap < 4) { showBanner('废料不够', '做 10 发弹药需要 4 废料', 2, '#ef7d57'); return; }
  const n = rdGain('ammo', 10);
  if (n <= 0) { showBanner('货舱满了', '', 2, '#ef7d57'); return; }
  G.res.scrap -= Math.ceil(4 * n / 10);
  sfx('build');
}
function rdQueueCraft(id) {
  const p = RD_PARTS[id];
  if (!rdPay(rdCraftCost(p))) return false;
  rdR().craftQ.push({ id, left: 1 + p.tier * 1.5 });
  rdLog('开始制作：' + p.name + '（需要在工作台干 ' + (1 + p.tier * 1.5) + ' 小时）', '#a7f070');
  return true;
}
// 拆解：变成废料，工作台等级够的话还能学会图纸
function rdDismantle(idx) {
  const R = rdR(), id = R.inv[idx], p = RD_PARTS[id];
  if (!p) return;
  R.inv.splice(idx, 1);
  const st = rdStats();
  const n = rdGain('scrap', Math.round(rdScrapValue(p) * (1 + st.scrapBonus)));
  let learn = '';
  if (!R.bps[id] && st.craft >= p.tier) { R.bps[id] = true; learn = '，学会了它的图纸'; }
  if (p.alien && n === 0) {}
  if (p.alien) rdGain('alien', 2);
  rdLog('拆解 ' + p.name + '：废料 +' + n + (p.alien ? '，外星晶体 +2' : '') + learn, '#94b0c2');
}

// ---------- 安装 / 卸下 ----------
function rdCanModExt() { const R = rdR(); return R.speedNow < 1 && !R.driving; }
function rdInstall(invIdx, slotKey, mountIdx) {
  const R = rdR(), id = R.inv[invIdx], p = RD_PARTS[id];
  if (!p) return false;
  if (p.slot === 'in') {
    const c = rdFreeCell(p);
    if (c < 0) { showBanner('车内放不下', p.name + ' 需要' + (p.layer === 'wall' ? '墙面' : '地面') + ' ' + (p.w || 1) + ' 格空位', 3, '#ef7d57'); return false; }
    R.inv.splice(invIdx, 1); R.inner.push({ id, cell: c });
  } else {
    if (RD_SLOTS[p.slot].ext && !rdCanModExt()) { showBanner('先停车', '停车后才能改装车外的部件', 2, '#ef7d57'); return false; }
    R.inv.splice(invIdx, 1);
    if (p.slot === 'weapon') {
      const old = R.wpn[mountIdx];
      if (old) R.inv.push(old);
      R.wpn[mountIdx] = id;
    } else if (p.slot === 'hand' || p.slot === 'suit') {
      if (R[p.slot]) R.inv.push(R[p.slot]);
      R[p.slot] = id;
    } else {
      if (R.ext[p.slot]) R.inv.push(R.ext[p.slot]);
      R.ext[p.slot] = id;
    }
  }
  rdFxDirty();
  if (p.slot === 'trailer' || p.slot === 'space') rdRefit();
  R.hpV = Math.min(R.hpV, rdStats().hp);
  sfx('build');
  return true;
}
function rdUninstall(kind, key) {
  const R = rdR();
  if (kind === 'ext') { if (!rdCanModExt()) { showBanner('先停车', '停车后才能改装车外的部件', 2, '#ef7d57'); return; } R.inv.push(R.ext[key]); R.ext[key] = null; if (key === 'trailer' || key === 'space') { rdFxDirty(); rdRefit(); } }
  else if (kind === 'wpn') { if (!rdCanModExt()) { showBanner('先停车', '停车后才能改装车外的部件', 2, '#ef7d57'); return; } R.inv.push(R.wpn[key]); R.wpn[key] = null; }
  else if (kind === 'person') { R.inv.push(R[key]); R[key] = null; }
  else if (kind === 'in') { const it = R.inner[key]; R.inner.splice(key, 1); R.inv.push(it.id); if (R.me.act && R.me.act.it === it) R.me.act = null; }
  rdFxDirty();
  R.hpV = Math.min(R.hpV, rdStats().hp);
}
function rdRepair() {
  const R = rdR(), st = rdStats(), need = Math.ceil(st.hp - R.hpV);
  if (need <= 0) return;
  const cost = Math.min(Math.floor(G.res.scrap), Math.ceil(need / 5));
  if (cost <= 0) { showBanner('废料不够', '修车需要废料（车瘫痪时可以“应急抢修”）', 2, '#ef7d57'); return; }
  G.res.scrap -= cost; R.hpV = Math.min(st.hp, R.hpV + cost * 5);
  rdLog('用 ' + cost + ' 废料修好了车（耐久 ' + Math.round(R.hpV) + '/' + st.hp + '）', '#a7f070');
  sfx('build');
}

// 应急抢修：车瘫痪了又没废料时，花 8 小时用手头的东西凑合修到 30%
function rdEmergencyRepair() {
  const R = rdR(), me = R.me, st = rdStats();
  if (!R.broken || R.driving) return;
  R.t += 8; me.energy = Math.max(0, me.energy - 15); me.food = Math.max(0, me.food - 25); me.water = Math.max(0, me.water - 28);
  R.hpV = Math.max(R.hpV, Math.ceil(st.hp * 0.3)); R.broken = false;
  R.mons = []; // 熬了一整夜，怪物早就散了
  rdLog('拆东墙补西墙，花了 8 小时把车凑合修好了（耐久 ' + Math.round(R.hpV) + '/' + st.hp + '）', '#ffcd75');
  showBanner('应急抢修完成', '车能开了，但只有三成耐久', 3, '#ffcd75');
}
// 徒步搜寻：没油或车坏了又没废料时的兜底办法（花 6 小时，可能遇袭）
function rdHike() {
  const R = rdR(), me = R.me;
  if (R.driving || me.loc === 'out' || me.loc === 'site') return;
  R.t += 6; me.energy = Math.max(0, me.energy - 20); me.food = Math.max(0, me.food - 20); me.water = Math.max(0, me.water - 25);
  const sc = rdGain('scrap', 6 + Math.floor(Math.random() * 10)), fu = rdGain('fuel', 4 + Math.floor(Math.random() * 8));
  if (rdStats().powKm > 0) rdGain('power', 15 + Math.floor(Math.random() * 15)); // 电动车：找个地方充电
  let hurt = '';
  if (Math.random() < 0.35) { const d = 10 + Math.floor(Math.random() * 15); rdHurtMe(d, '徒步时被怪物袭击'); hurt = '，路上被怪物抓伤（生命 -' + d + '）'; }
  rdLog('徒步在附近搜寻了 6 小时：废料 +' + sc + '，燃油 +' + fu + hurt, '#ffcd75');
  showBanner('徒步搜寻', '废料 +' + sc + '　燃油 +' + fu, 3, '#ffcd75');
}

// ---------- 随机事件 ----------
function rdDialog(title, text, options) { G.dialog = { title, text, options }; G.state = 'dialog'; }
function rdRandomEvent() {
  const R = rdR(), st = rdStats();
  const evs = [
    ['trader', 3 + st.trade * 20], ['drop', 2], ['weather', 2], ['wreck', 2.5], ['radio', 1.5], ['distress', 1.5],
  ];
  if (!R.pet && R.inner.some((it) => RD_PARTS[it.id].fx.pet)) evs.push(['pet', 1.5]);
  if (R.km > 800) evs.push(['alien', 1.5 + rdSum('alienSense') * 3]);
  let tot = evs.reduce((s, e) => s + e[1], 0), r = Math.random() * tot, ev = evs[0][0];
  for (const e of evs) { r -= e[1]; if (r <= 0) { ev = e[0]; break; } }
  if (ev === 'trader') {
    rdDialog('流动商人', '一辆挂满杂货的三轮车靠了过来。“朋友，要不要看看货？只收废料。”', [
      { label: '看看货', action: () => rdOpenTrade(null) }, { label: '不用了，谢谢', action: () => {} }]);
  } else if (ev === 'drop') {
    const ks = ['food', 'water', 'med', 'ammo', 'fuel'], k = ks[Math.floor(Math.random() * ks.length)], n = rdGain(k, 5 + Math.floor(Math.random() * 10));
    rdLog('路边发现一个坠落的补给箱：' + RD_RES[k].name + ' +' + n, '#a7f070');
    showBanner('补给箱', RD_RES[k].name + ' +' + n, 3, '#a7f070');
  } else if (ev === 'weather') {
    const w = [{ type: 'dust', name: '沙尘暴', d: '车速变慢，太阳能变弱' }, { type: 'rad', name: '辐射风暴', d: '辐射猛增，尽量待在车里' }, { type: 'storm', name: '暴雨', d: '雨水收集翻倍，太阳能变弱' }][Math.floor(Math.random() * 3)];
    R.weather = Object.assign({ left: 4 + Math.random() * 6 }, w);
    rdLog(w.name + '来了：' + w.d, '#ef7d57');
    rcWeather(w.type);
    showBanner(w.name, w.d, 4, '#ef7d57');
  } else if (ev === 'wreck') {
    rdDialog('路边的废车', '一辆翻倒的车横在路边，看起来还没被人拆过。', [
      { label: '拆点零件（花 2 小时）', action: () => { R.t += 2; const p = rdRollPart({ slots: ['tires', 'engine', 'armor', 'tank', 'util', 'ram', 'chassis'], partChance: 1 }, null); let s = rdGain('scrap', 6 + Math.floor(Math.random() * 10)); if (p) R.inv.push(p.id); rdLog('拆废车：废料 +' + s + (p ? '，' + p.name : ''), '#a7f070'); if (p) rdFound(p); } },
      { label: '抽点油（花 1 小时）', action: () => { R.t += 1; const n = rdGain('fuel', 4 + Math.floor(Math.random() * 10)); rdLog('从废车里抽了 ' + n + ' 升油', '#a7f070'); } },
      { label: '不管它', action: () => {} }]);
  } else if (ev === 'radio') {
    const lines = ['“……这里是绿洲城广播，我们还在，一直往东开……”', '“……今天的天气：辐射指数偏高，请幸存者减少外出……”', '收音机里传来一首老歌，你跟着哼了起来。', '“……有人在吗？有人在吗……”信号断了。'];
    const l = lines[Math.floor(Math.random() * lines.length)];
    R.me.mood = Math.min(100, R.me.mood + 6);
    rdLog('收音机：' + l, '#c8d6e5');
  } else if (ev === 'distress') {
    rdDialog('求救信号', '路边有人挥着红布在求救：“我的车坏了，求你分我一点水和食物吧！”', [
      { label: '给他 3 食物 + 3 水', disabled: G.res.food < 3 || G.res.water < 3, action: () => {
        G.res.food -= 3; G.res.water -= 3; R.me.mood = Math.min(100, R.me.mood + 15);
        if (Math.random() < 0.6) { const p = rdRollPart({ slots: ['weapon', 'hand', 'roof', 'in'], partChance: 1 }, null); if (p) { R.inv.push(p.id); rdFound(p); } rdLog('他千恩万谢，送了你一件东西：' + (p ? p.name : '一张旧地图'), '#a7f070'); }
        else rdLog('他千恩万谢地走了。帮助别人让你心情好了很多。', '#a7f070');
      } },
      { label: '小心有诈，开走', action: () => { R.me.mood = Math.max(0, R.me.mood - 5); } },
      { label: '下车看看', action: () => { if (Math.random() < 0.5) { rdSpawnGroup(rdVehX() + 60, true); rdLog('是个陷阱！埋伏的怪物冲了出来', '#ef7d57'); } else { const n = rdGain('ammo', 10); rdLog('他已经不行了……你收下了他的遗物：弹药 +' + n, '#94b0c2'); } } }]);
  } else if (ev === 'pet') {
    rdOfferPet();
  } else if (ev === 'alien') {
    rdDialog('外星信号', '车载收音机突然收到一段奇怪的脉冲信号，源头就在前方不远处。', [
      { label: '去看看', action: () => { R.sites.push({ type: 'alien', km: R.km + 3, seed: Math.floor(Math.random() * 1e6), searched: false, danger: 0.6 }); rdLog('前方 3 公里处出现了外星坠落舱', '#73eff7'); } },
      { label: '太危险了', action: () => {} }]);
  }
}
function rdOfferPet() {
  const R = rdR();
  const cat = Math.random() < 0.4;
  const hasBed = R.inner.some((it) => RD_PARTS[it.id].fx.pet);
  rdDialog(cat ? '流浪猫' : '流浪狗', (cat ? '一只瘦巴巴的小猫' : '一只脏兮兮的小狗') + '一直跟在你后面，可怜巴巴地看着你。' + (hasBed ? '' : '（车里还没有宠物窝，它可能待不住）'), [
    { label: '收留它（' + (cat ? '喵' : '汪') + '！）', action: () => { R.pet = { type: cat ? 'cat' : 'dog', ix: 1, name: cat ? '小橘' : '旺财' }; rdLog('收留了' + R.pet.name + '。旅途不再孤单了。', '#ffcd75'); R.me.mood = Math.min(100, R.me.mood + 20); showBanner('新伙伴：' + R.pet.name, '有宠物在，心情会一直变好', 4, '#ffcd75'); } },
    { label: '喂它点吃的就走', disabled: G.res.food < 1, action: () => { G.res.food--; R.me.mood = Math.min(100, R.me.mood + 5); } },
    { label: '狠心离开', action: () => { R.me.mood = Math.max(0, R.me.mood - 8); } }]);
}

// ---------- 交易 ----------
function rdOpenTrade(site) {
  const R = rdR(), st = rdStats();
  R.driving = false;
  const items = [];
  const n = site ? 6 : 4;
  for (let i = 0; i < n; i++) {
    const p = rdRollPart({ slots: Object.keys(RD_SLOTS), partChance: 1, tierBonus: site ? 1 : 0 }, null);
    if (p && !p.alien) items.push({ id: p.id, price: Math.round(rdCraftCost(p).scrap * 1.5 * (1 - st.trade)) });
  }
  R.trade = { items, sell: 1 + st.trade, name: site ? '幸存者营地' : '流动商人' };
  if (site) site.searched = true;
  R.panel = 'trade'; G.state = 'rpanel';
}
const RD_PRICES = { fuel: 3, food: 3, water: 2, med: 7, ammo: 1, power: 1 };

// ---------- 失败 ----------
function rdLose(title, why) {
  const R = rdR();
  if (G.state === 'over') return;
  G.state = 'over';
  const best = Math.max(Math.floor(R.km), parseInt(Store.get('campking_best_road') || '0', 10) || 0);
  Store.set('campking_best_road', String(best));
  G.endTitle = title;
  G.endText = why + '\n行驶了 ' + Math.floor(R.km) + ' 公里，坚持了 ' + rdDay() + ' 天，击杀 ' + R.stats.kills + '，搜索 ' + R.stats.searched + ' 处\n最远纪录：' + best + ' 公里';
  sfx('over');
}

// ---------- 存档 ----------
function rdSaveData() {
  const R = rdR(), out = {};
  for (const k in R) if (!['mons', 'proj', 'fx', 'parts', 'floats', '_fx', '_fxPow', 'st', 'wcd', 'aim', 'trade', 'panel', 'search'].includes(k)) out[k] = R[k];
  return { road: out, res: G.res };
}
function rdLoadData(d) {
  G.road = d.road;
  Object.assign(G.res, d.res);
  const R = G.road;
  R.mons = []; R.proj = []; R.fx = []; R.parts = []; R.floats = [];
  if (R.chat) R.chat._real = 0;
  if (R.me.loc === 'out' || R.me.loc === 'site') { R.me.loc = 'in'; R.me.ix = 0.6; }
  R.me.act = null;
  R.powered = undefined;
  rdFxDirty();
}

// ---------- 模式配置 ----------
MODES.road = {
  id: 'road',
  name: '公路求生',
  tag: '横版 · 公路旅行 · 改装生存',
  icon: 'road_icon',
  desc: '开着改装车在末日公路上流浪。停车搜索废弃建筑，改装车辆、布置车内的小家，提防辐射怪物。',
  intro: '点「出发」开车。路边出现建筑时点「搜索」停车下去找物资。',
  custom: true,
  resources: ['fuel', 'scrap', 'food', 'water', 'med', 'ammo'],
  startRes: { fuel: 0, scrap: 0, food: 0, water: 0, med: 0, ammo: 0, power: 0, alien: 0 },
  dayTime: 9999,
  speeds: [1, 2, 4],
  buildList: [], buildings: { core: { name: '车', size: 1, hp: 1 } }, techs: [], perks: [], nodes: {},
  hooks: {
    update: (dt) => rdUpdate(dt),
    render: (ctx) => rdRender(ctx),
    tap: (sx, sy) => rdTap(sx, sy),
    drag: (dx, dy) => rdDrag(dx, dy),
    key: (k) => rdKey(k),
    save: () => rdSaveData(),
    load: (d) => rdLoadData(d),
    dayText: (d) => '第 ' + (Math.floor((d.road.t || 0) / 24) + 1) + ' 天 · 已行驶 ' + Math.floor(d.road.km || 0) + ' 公里',
  },
};
