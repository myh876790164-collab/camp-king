// =============================================
//  游戏主流程：模式初始化、昼夜循环、刷怪、天亮结算、肉鸽强化、主循环
// =============================================
const G = { speed: 1, time: 0, scene: 'title', keys: {}, floats: [] };

// 切换到某个模式，并把所有游戏状态重置为初始值
function setupMode(mode) {
  G.mode = mode;
  G.def = MODES[mode];
  const def = G.def;
  setMapSize(def.mapW || CONFIG.MAP_W, def.mapH || CONFIG.MAP_H);
  Object.assign(G, {
    res: Object.assign({}, def.startRes), day: 1, phase: 'day', timer: def.dayTime, state: 'play',
    buildings: [], monsters: [], projectiles: [], effects: [], floats: [],
    kills: 0, goldAcc: 0, clock: 0, effTimer: 0, dark: 0,
    selected: null, buildMode: null, perkChoices: null, banner: null, dialog: null, confirm: null,
    spawnLeft: 0, spawnTotal: 0, bossLeft: 0, spawnTimer: 0, spawnTiles: [],
    mods: defaultMods(), perksTaken: {}, techs: {},
    unlocked: new Set(def.buildList.filter((t) => !def.buildings[t].locked)),
    dist: null, next: null, flowDirty: false, core: null,
    player: null, survivors: [], npcs: [], inventory: {}, villagers: [], furnace: null, keys: {},
    dawnMsg: null, nightNote: null, buildPage: 0, techPage: 0, equipSel: 0, equipTab: 'equip',
    camFollow: false, moveMarker: null,
    roads: null, natTer: null, fields: null, crosswalks: null, parking: null, structOrder: null, // 城市地图专用
    inside: null, home: null, citySeed: 0, cityCam: null, // 丧尸模式：建筑内部
    mapOpen: false, miniBase: null, scavLog: [], // 小地图、同伴搜刮记录
  });
}

function startGame(mode, opt) {
  if (MODES[mode].applyOpt) MODES[mode].applyOpt(opt); // 难度等开局选项
  setupMode(mode);
  G.opt = opt || {}; // 开局选项（丧尸模式：初始营地）
  G.introNote = null;
  generateMap();
  createBuilding('core', G.coreX, G.coreY);
  if (G.def.hooks.init) G.def.hooks.init();
  finishGameSetup();
  showBanner('第 1 天 · ' + G.def.name, (G.introNote ? G.introNote + '　' : '') + G.def.intro, 7);
}

function finishGameSetup() {
  buildGround();
  recomputeFlow();
  const focus = G.player || G.core;
  G.cam = { x: focus.cx || focus.x, y: focus.cy || focus.y, zoom: defaultZoom() };
  clampCamera();
  G.state = 'play';
  gotoScene('game');
}

function showBanner(text, sub, life, color) {
  G.banner = { text, sub, life: life || 3, max: life || 3, color };
}

// ---------- 夜晚 ----------
const SIDE_NAMES = ['北', '东', '南', '西'];
function nightEnemies() { return G.monsters.reduce((n, m) => n + (m.wander ? 0 : 1), 0); }

function startNightEarly() {
  if (G.phase !== 'day' || G.state !== 'play' || !G.def.hasNights) return;
  const bonus = Math.floor(G.timer / 6), kr = G.def.killRes;
  if (bonus > 0 && kr) {
    G.res[kr] += bonus;
    addFloat(G.core.cx, G.core.cy - 20, '提前入夜 +' + bonus + ' ' + RES_INFO[kr].name, '#ffcd75', true);
  }
  G.timer = 0;
}

function startNight() {
  const def = G.def;
  G.phase = 'night';
  G.nightNote = null;
  if (!def.hasNights) {
    G.timer = def.nightTime;
    showBanner('夜幕降临', '大家回到篝火边休息（夜里生产效率降低）', 3, '#c8d6e5');
    return;
  }
  flushFlow();
  const n = G.day, W = def.wave;
  G.spawnTotal = G.spawnLeft = Math.floor((W.baseCount + W.perNight * (n - 1)) * Math.pow(W.growth, n - 1));
  G.spawnInterval = def.nightSpawnTime / G.spawnLeft;
  G.spawnTimer = 1.5;
  G.bossLeft = n % W.bossEvery === 0 ? n / W.bossEvery : 0;

  // 随着天数增加，敌人从更多方向来袭
  const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, Math.min(4, 1 + Math.floor((n - 1) / 3)));
  // 地图变大后，怪物不从地图边缘走过来（太远），而是从营地外一圈出现；
  // 某个方向全是海时，就从那个方向离营地最远的岸边出现
  G.spawnTiles = [];
  const R = def.spawnRadius || Math.min(MAP_W, MAP_H) / 2 - 3;
  const ccx = G.coreX + 1, ccy = G.coreY + 1, best = [0, 0, 0, 0], cand = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const i = idx(x, y);
      if (G.nodes[i] || G.bld[i] || !isFinite(G.dist[i]) || solidTer(G.terrain[i])) continue;
      const dx = x + 0.5 - ccx, dy = y + 0.5 - ccy;
      const side = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 0 : 2) : (dx > 0 ? 1 : 3);
      if (!sides.includes(side)) continue;
      const d = Math.min(R, Math.hypot(dx, dy));
      if (d > best[side]) best[side] = d;
      cand.push([i, side, d]);
    }
  }
  for (const [i, side, d] of cand) if (d >= best[side] - 1.2 && best[side] > 6) G.spawnTiles.push(i);
  if (!G.spawnTiles.length) for (let x = 0; x < MAP_W; x++) G.spawnTiles.push(idx(x, 0));
  if (def.hooks.night) def.hooks.night();
  const dirText = sides.map((s) => SIDE_NAMES[s]).join('、');
  const bossName = G.bossLeft ? def.monsters[bossType()].name : '';
  showBanner('第 ' + n + ' 夜 · 敌人来袭！',
    '共 ' + (G.spawnTotal + G.bossLeft) + ' 只，从 ' + dirText + ' 方向来' + (bossName ? '，小心' + bossName + '！' : '') +
    (G.nightNote ? '\n' + G.nightNote : ''), 4, '#ef7d57');
  sfx('night');
}

function bossType() {
  const ms = G.def.monsters;
  return Object.keys(ms).find((k) => ms[k].boss);
}

function pickMonsterType(n) {
  const list = [];
  let total = 0;
  for (const k in G.def.monsters) {
    const d = G.def.monsters[k];
    if (d.weight && d.from <= n) { list.push([k, d.weight]); total += d.weight; }
  }
  let r = Math.random() * total;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}

function spawnAtEdge(type) {
  const i = pick(G.spawnTiles);
  spawnMonster(type, (i % MAP_W + rand(0.2, 0.8)) * T, (((i / MAP_W) | 0) + rand(0.2, 0.8)) * T);
}

function updateNight(dt) {
  if (!G.def.hasNights) {
    G.timer -= dt;
    if (G.timer <= 0) dawn();
    return;
  }
  G.spawnTimer -= dt;
  while (G.spawnLeft > 0 && G.spawnTimer <= 0) {
    spawnAtEdge(pickMonsterType(G.day));
    G.spawnLeft--;
    G.spawnTimer += G.spawnInterval;
  }
  if (G.bossLeft > 0 && G.spawnLeft <= G.spawnTotal / 2) {
    for (; G.bossLeft > 0; G.bossLeft--) spawnAtEdge(bossType());
  }
  if (G.spawnLeft <= 0 && G.bossLeft <= 0 && nightEnemies() === 0) dawn();
}

// ---------- 天亮 ----------
function dawn() {
  G.day++;
  G.phase = 'day';
  G.timer = G.def.dayTime;
  G.projectiles = [];
  G.dawnMsg = null;
  for (const b of G.buildings) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * CONFIG.DAWN_REPAIR);
  regrowNodes();
  markFlowDirty();
  if (G.def.hooks.dawn) G.def.hooks.dawn();
  if (G.state !== 'play') return; // 例如荒岛断粮导致失败
  sfx('dawn');
  if (offerPerks()) {
    G.state = 'perk';
    G.buildMode = null;
    return;
  }
  const saved = saveGame();
  showBanner('第 ' + G.day + ' 天 · 天亮了', (G.dawnMsg || '') + (saved ? '（已自动存档）' : ''), 5, '#ffcd75');
}

function perkAvailable(p) {
  if (p.max && (G.perksTaken[p.name] || 0) >= p.max) return false;
  if (p.needs && !hasAny(p.needs)) return false;
  if (p.needs2 && !hasAny(p.needs2)) return false;
  return true;
}

// 三选一：如果有可用的建筑联动强化，至少放一个进去
function offerPerks() {
  if (!G.def.perks) return false;
  const pool = G.def.perks.filter(perkAvailable).sort(() => Math.random() - 0.5);
  const choices = pool.slice(0, 3);
  const synergy = pool.find((p) => p.needs);
  if (synergy && !choices.some((p) => p.needs)) choices[choices.length - 1] = synergy;
  if (!choices.length) return false;
  G.perkChoices = choices;
  return true;
}

function pickPerk(p) {
  p.apply(G.mods, G);
  G.perksTaken[p.name] = (G.perksTaken[p.name] || 0) + 1;
  refreshAllBuildings();
  G.state = 'play';
  G.perkChoices = null;
  const saved = saveGame();
  showBanner('第 ' + G.day + ' 天', '获得强化：' + p.name + (saved ? '（已自动存档）' : ''), 3, '#ffcd75');
}

// ---------- 胜负 ----------
function bestKey() { return 'campking_best_' + G.mode; }
function gameOver(reason) {
  if (G.state === 'over') return;
  G.state = 'over';
  G.buildMode = null;
  G.selected = null;
  const best = Math.max(G.day, parseInt(Store.get(bestKey()) || '0', 10) || 0);
  Store.set(bestKey(), String(best));
  G.endTitle = reason;
  G.endText = '坚持到第 ' + G.day + ' 天　击杀 ' + G.kills + '\n最佳纪录：第 ' + best + ' 天';
  sfx('over');
}
function victory(title, text) {
  G.state = 'victory';
  G.buildMode = null;
  G.selected = null;
  G.endTitle = title;
  G.endText = text;
  sfx('win');
}

// ---------- 主循环 ----------
function update(dt) {
  const hooks = G.def.hooks;
  G.clock += dt;
  flushFlow();
  if (G.phase === 'day') {
    G.timer -= dt;
    if (G.timer <= 0) startNight();
  } else {
    updateNight(dt);
    if (G.state !== 'play') return;
  }
  G.effTimer -= dt;
  if (G.effTimer <= 0) {
    G.effTimer = 0.25;
    for (const b of G.buildings) b.eff = hooks.efficiency ? hooks.efficiency(b) : 1;
  }
  if (hooks.update) hooks.update(dt);
  if (G.state !== 'play') return;
  for (const b of G.buildings) updateBuilding(b, dt);
  for (const m of G.monsters) {
    if (!m.alive) continue;
    updateMonster(m, dt);
    if (G.state !== 'play') return;
  }
  for (const p of G.projectiles) updateProjectile(p, dt);
  G.projectiles = G.projectiles.filter((p) => p.alive);
  G.monsters = G.monsters.filter((m) => m.alive);
  updateEffects(dt);
}

let lastTime = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  G.time += dt;

  if (G.scene === 'game') {
    if (G.state === 'play') {
      for (let s = 0; s < G.speed; s++) {
        update(dt);
        if (G.state !== 'play') break;
      }
    }
    // 昼夜明暗渐变
    let target = 0;
    if (G.phase === 'night') target = 0.62;
    else if (G.timer < CONFIG.DUSK_TIME) target = (1 - G.timer / CONFIG.DUSK_TIME) * 0.62;
    G.dark += (target - G.dark) * Math.min(1, dt * 2);
    // 丧尸模式：镜头跟随玩家
    const p = G.player;
    if (p && G.camFollow && p.down <= 0) {
      G.cam.x += (p.x - G.cam.x) * Math.min(1, dt * 6);
      G.cam.y += (p.y - G.cam.y) * Math.min(1, dt * 6);
      clampCamera();
    }
    for (const f of G.floats) f.t += dt;
    G.floats = G.floats.filter((f) => f.t < f.life);
    if (G.banner) {
      G.banner.life -= dt;
      if (G.banner.life <= 0) G.banner = null;
    }
    flushFlow();
  }
  render();
  requestAnimationFrame(frame);
}

function resize() {
  G.dpr = Math.min(window.devicePixelRatio || 1, 2);
  // 用画布外层容器的尺寸（网页版会给手机刘海/底部横条留出安全边距）
  const box = G.canvas.parentElement;
  G.sw = box.clientWidth || window.innerWidth;
  G.sh = box.clientHeight || window.innerHeight;
  const c = G.canvas;
  c.width = Math.round(G.sw * G.dpr);
  c.height = Math.round(G.sh * G.dpr);
  c.style.width = G.sw + 'px';
  c.style.height = G.sh + 'px';
  G.light.width = c.width;
  G.light.height = c.height;
  if (G.cam) {
    G.cam.zoom = Math.max(minZoom(), G.cam.zoom);
    clampCamera();
  }
}

function boot() {
  G.settings = loadSettings();
  G.canvas = document.getElementById('game');
  G.ctx = G.canvas.getContext('2d');
  G.light = createCanvas(1, 1);
  G.lightCtx = G.light.getContext('2d');
  initSprites();
  resize();
  window.addEventListener('resize', resize);
  setupInput(G.canvas);
  requestAnimationFrame((t) => { lastTime = t; frame(t); });
}

boot();
