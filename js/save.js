// =============================================
//  存档：每个模式一个存档位，保存在浏览器本地
//  只在白天存档（夜里怪物太多，不保存战斗中的状态）
// =============================================
const SAVE_VERSION = 1;
function saveKey(mode) { return 'campking_save_' + mode; }
function hasSave(mode) { return !!Store.get(saveKey(mode)); }
function deleteSave(mode) { Store.del(saveKey(mode)); }

function saveInfo(mode) {
  try {
    const d = JSON.parse(Store.get(saveKey(mode)));
    if (!d) return null;
    const t = new Date(d.time);
    const pad = (n) => String(n).padStart(2, '0');
    return { day: d.day, when: t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) + ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) };
  } catch (e) { return null; }
}

function saveGame() {
  if (G.phase !== 'day' || G.state === 'over') return false;
  const hooks = G.def.hooks;
  const data = {
    v: SAVE_VERSION, mode: G.mode, time: Date.now(),
    day: G.day, timer: G.timer, res: G.res, kills: G.kills, goldAcc: G.goldAcc,
    mods: G.mods, perksTaken: G.perksTaken, techs: Object.keys(G.techs), unlocked: [...G.unlocked],
    coreX: G.coreX, coreY: G.coreY,
    terrain: Array.from(G.terrain).join(''),
    nodes: G.nodes.filter(Boolean).map((n) => [n.type, n.x, n.y, n.amount, n.searchedUntil || 0]),
    buildings: G.buildings.map((b) => [b.type, b.x, b.y, b.level, Math.round(b.hp)]),
    extra: hooks.save ? hooks.save() : null,
  };
  const ok = Store.set(saveKey(G.mode), JSON.stringify(data));
  if (!ok) showBanner('保存失败', '浏览器不允许本地存储（可能是无痕模式）', 3, '#ef7d57');
  return ok;
}

function loadGame(mode) {
  let d;
  try { d = JSON.parse(Store.get(saveKey(mode))); } catch (e) { d = null; }
  if (!d || d.v !== SAVE_VERSION) { showBanner('存档损坏或版本不兼容', '', 3, '#ef7d57'); return; }
  setupMode(mode);
  Object.assign(G, { day: d.day, timer: d.timer, res: d.res, kills: d.kills, goldAcc: d.goldAcc || 0 });
  G.mods = Object.assign(defaultMods(), d.mods);
  G.perksTaken = d.perksTaken || {};
  G.techs = {};
  for (const t of d.techs) G.techs[t] = true;
  G.unlocked = new Set(d.unlocked);
  G.coreX = d.coreX; G.coreY = d.coreY;
  const N = MAP_W * MAP_H;
  G.terrain = new Uint8Array(N);
  for (let i = 0; i < N; i++) G.terrain[i] = d.terrain.charCodeAt(i) - 48;
  G.nodes = new Array(N).fill(null);
  G.bld = new Array(N).fill(null);
  for (const [type, x, y, amount, searched] of d.nodes) {
    if (!G.def.nodes[type]) continue;
    const def = G.def.nodes[type];
    G.nodes[idx(x, y)] = { type, x, y, amount, max: def.amount || 1, shakeUntil: 0, searchedUntil: searched };
  }
  // 营地必须先建（其他逻辑依赖 G.core）
  const sorted = d.buildings.slice().sort((a, b) => (a[0] === 'core' ? -1 : 0) - (b[0] === 'core' ? -1 : 0));
  for (const [type, x, y, level, hp] of sorted) {
    if (!bdef(type)) continue;
    const b = createBuilding(type, x, y);
    b.level = level;
    b.maxHp = 0;
    refreshBuilding(b);
    b.hp = Math.max(1, Math.min(b.maxHp, hp));
  }
  if (G.def.hooks.load && d.extra) G.def.hooks.load(d.extra);
  finishGameSetup();
  showBanner('读取存档', G.def.name + ' · 第 ' + G.day + ' 天', 3, '#a7f070');
}
