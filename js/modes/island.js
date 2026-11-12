// =============================================
//  模式 2：荒岛求生（模拟经营）
//  资源由“成员”采集：给成员分配任务（伐木、采石……），但必须先装备对应工具
//  工具分 木器 / 石器 / 铁器 三档，需要科技和建筑解锁，档次越高干活越快
//  成员有生命、饱食、心情、体力，会自己吃饭、睡觉，技能越用越熟练
//  海上不定期来船：商船（交易）、落难船员（加人）、食人族（袭击）
//  目标：幸福度 ≥ 70、人口 ≥ 8 后建造信号塔获救
// =============================================

// ---------- 工具与装备 ----------
const TIER_NAMES = ['木器', '石器', '铁器'];
const TIER_MULT = [1, 1.5, 2.2];        // 干活速度
const TIER_DMG = [1, 1.6, 2.4];         // 武器伤害
const TIER_COST = [{ wood: 8 }, { wood: 6, stone: 8 }, { wood: 6, iron: 5 }];
const TIER_REQ = [{ tech: 'woodtools' }, { tech: 'stonetools', building: 'workbench' }, { tech: 'irontools', building: 'smelter' }];

const TOOL_KINDS = {
  axe: { name: '斧', names: ['木斧', '石斧', '铁斧'], use: '伐木' },
  pick: { name: '镐', names: ['木镐', '石镐', '铁镐'], use: '采石；石镐以上可采铁' },
  basket: { name: '筐', names: ['草筐', '藤筐', '铁框筐'], use: '采集浆果' },
  bow: { name: '弓', names: ['木弓', '石镞弓', '铁镞弓'], use: '狩猎，也能远程战斗', tech: 'hunting', weapon: { dmg: 8, range: 4, rate: 1, ranged: true } },
  rod: { name: '鱼竿', names: ['竹鱼竿', '骨钩鱼竿', '铁钩鱼竿'], use: '在岸边捕鱼', tech: 'fishing' },
  hoe: { name: '锄', names: ['木锄', '石锄', '铁锄'], use: '在农田务农', tech: 'farming' },
  spear: { name: '矛', names: ['木矛', '石矛', '铁矛'], use: '守卫营地，近战武器', tech: 'defense', weapon: { dmg: 11, range: 1.3, rate: 1.2 } },
  cloth: { name: '衣物', names: ['草衣', '兽皮衣', '铁甲'], use: '增加生命上限', body: true, hp: [20, 50, 100] },
};

function itemInfo(key) {
  const [kind, t] = key.split(':');
  const tier = +t, k = TOOL_KINDS[kind];
  return { kind, tier, k, name: k.names[tier], body: !!k.body };
}
function addIslandItem(key, n) { G.inventory[key] = (G.inventory[key] || 0) + (n || 1); }
function takeIslandItem(key) {
  if (!G.inventory[key]) return false;
  if (--G.inventory[key] <= 0) delete G.inventory[key];
  return true;
}

function craftProblem(kind, tier) {
  const k = TOOL_KINDS[kind];
  if (k.tech && !G.techs[k.tech]) return '需科技：' + techName(k.tech);
  const req = TIER_REQ[tier];
  if (!G.techs[req.tech]) return '需科技：' + techName(req.tech);
  if (req.building && !countType(req.building)) return '需建造：' + bdef(req.building).name;
  return null;
}
function craftCost(kind, tier) {
  const c = Object.assign({}, TIER_COST[tier]);
  if (kind === 'bow') c.wood = (c.wood || 0) + 6;
  if (kind === 'cloth') { delete c.wood; c.food = 8 + tier * 6; }
  return c;
}
function techName(id) { const t = G.def.techs.find((x) => x.id === id); return t ? t.name : id; }

// ---------- 任务 ----------
const ISLAND_TASKS = {
  idle: { name: '空闲' },
  wood: { name: '伐木', tool: 'axe', node: 'palm', time: 2.5, amount: 1, skill: 'wood' },
  stone: { name: '采石', tool: 'pick', node: 'rock', time: 3, amount: 1, skill: 'mine' },
  iron: { name: '采铁', tool: 'pick', minTier: 1, node: 'ironore', time: 5, amount: 1, skill: 'mine' },
  gather: { name: '采集', tool: 'basket', node: 'berry', time: 2.5, amount: 1, skill: 'gather' },
  hunt: { name: '狩猎', tool: 'bow', skill: 'hunt' },
  fish: { name: '捕鱼', tool: 'rod', time: 4, amount: 2, skill: 'fish' },
  farm: { name: '务农', tool: 'hoe', time: 3, amount: 1, skill: 'farm' },
  guard: { name: '守卫', weapon: true, skill: 'fight' },
};
const SKILLS = { wood: '伐木', mine: '采矿', gather: '采集', hunt: '狩猎', fish: '捕鱼', farm: '务农', fight: '战斗' };
const TRAITS = {
  diligent: { name: '勤劳', desc: '干活 +15%', good: true, not: 'lazy' },
  lazy: { name: '懒散', desc: '干活 -15%', good: false, not: 'diligent' },
  cheerful: { name: '乐天', desc: '心情 +10', good: true, not: 'gloomy' },
  gloomy: { name: '忧郁', desc: '心情 -10', good: false, not: 'cheerful' },
  strong: { name: '强壮', desc: '生命+20 战斗+25%', good: true },
  glutton: { name: '大胃王', desc: '饿得更快', good: false },
  tough: { name: '坚韧', desc: '体力消耗 -30%', good: true },
  clever: { name: '聪明', desc: '技能成长 +50%', good: true },
};
const ISLAND_NAMES = ['阿海', '小渔', '老船长', '珊珊', '大壮', '阿木', '小石', '莉娜', '汤姆', '阿珍', '老K', '小葵', '阿诚', '米娅', '大卫', '阿秀', '小虎', '玛丽'];
const MEMBER_SPEED = 1.7;

function newMember(name, x, y) {
  const traits = [];
  const ids = Object.keys(TRAITS).sort(() => Math.random() - 0.5);
  const want = Math.random() < 0.5 ? 1 : 2;
  for (const id of ids) {
    if (traits.length >= want) break;
    if (traits.some((t) => TRAITS[t].not === id)) continue;
    traits.push(id);
  }
  const skills = {}, xp = {};
  for (const s in SKILLS) { skills[s] = 0; xp[s] = 0; }
  for (const s of Object.keys(SKILLS).sort(() => Math.random() - 0.5).slice(0, 2)) skills[s] = randInt(1, 2);
  return {
    id: nextId++, name, look: randInt(0, 3), traits, hp: 100, hunger: rand(65, 90), mood: 60, stamina: 100,
    skills, xp, hand: null, body: null, task: 'idle', state: 'idle', note: '空闲',
    x, y, path: [], dest: null, target: null, workT: 0, cd: 0, face: 1, hit: 0, waitT: 0, stuckT: 0, blk: {}, working: false,
  };
}

function hasTrait(m, id) { return m.traits.includes(id); }
function memberMaxHp(m) {
  let hp = 100 + (hasTrait(m, 'strong') ? 20 : 0);
  if (m.body) { const it = itemInfo(m.body); hp += it.k.hp[it.tier]; }
  return hp;
}
function handTool(m) { return m.hand ? itemInfo(m.hand) : null; }
function memberWeapon(m) {
  const t = handTool(m);
  if (!t || !t.k.weapon) return null;
  const w = t.k.weapon;
  const mult = TIER_DMG[t.tier] * (hasTrait(m, 'strong') ? 1.25 : 1) * (1 + 0.08 * m.skills.fight);
  return { dmg: w.dmg * mult, range: w.range, rate: w.rate, ranged: !!w.ranged };
}

// 能不能做这个任务，不能的话返回原因
function taskProblem(m, id) {
  const task = ISLAND_TASKS[id];
  if (task.weapon) return memberWeapon(m) ? null : '需要武器';
  if (!task.tool) return null;
  const t = handTool(m);
  if (!t || t.kind !== task.tool) return '需要' + TOOL_KINDS[task.tool].name;
  if (task.minTier && t.tier < task.minTier) return '需要' + TOOL_KINDS[task.tool].names[task.minTier];
  return null;
}

function islandHousing() {
  return G.buildings.reduce((n, b) => n + (b.def.housing ? b.def.housing + (b.level - 1) : 0), 0);
}
function avgMood() {
  if (!G.members.length) return 0;
  return G.members.reduce((s, m) => s + m.mood, 0) / G.members.length;
}

function memberMoodTarget(m) {
  let t = 50;
  t += G.members.length <= islandHousing() ? 10 : -15;
  let decor = 0;
  for (const b of G.buildings) if (b.def.happy) decor += b.def.happy * levelMult(b.level);
  t += Math.min(35, decor);
  if (m.hunger < 25) t -= 20; else if (m.hunger > 70) t += 5;
  if (m.hp < memberMaxHp(m) * 0.5) t -= 10;
  if (m.stamina < 15) t -= 10;
  if (hasTrait(m, 'cheerful')) t += 10;
  if (hasTrait(m, 'gloomy')) t -= 10;
  if (G.raidActive) t -= 10;
  t += G.mods.happy + (G.partyBonus || 0);
  return Math.max(0, Math.min(100, t));
}

function gainXp(m, skill, amt) {
  if (m.skills[skill] >= 10) return;
  m.xp[skill] += amt * (hasTrait(m, 'clever') ? 1.5 : 1);
  const need = 8 * (m.skills[skill] + 1);
  if (m.xp[skill] >= need) {
    m.xp[skill] -= need;
    m.skills[skill]++;
    addFloat(m.x, m.y - 22, m.name + ' ' + SKILLS[skill] + ' Lv' + m.skills[skill] + '！', '#a7f070', true);
  }
}

function workSpeed(m, task) {
  const t = handTool(m);
  let s = (t ? TIER_MULT[t.tier] : 1) * (1 + 0.08 * m.skills[task.skill]);
  if (hasTrait(m, 'diligent')) s *= 1.15;
  if (hasTrait(m, 'lazy')) s *= 0.85;
  s *= 0.7 + m.mood / 250;
  if (m.stamina <= 0) s *= 0.5;
  return s * G.mods.gather;
}

// ---------- 移动 ----------
function campSpot(m) {
  if (m.camp && !isBlocked(m.camp.x, m.camp.y)) return m.camp;
  const c = G.core;
  for (let i = 0; i < 40; i++) {
    const x = c.x + randInt(-2, 3), y = c.y + randInt(-2, 3);
    if (!isBlocked(x, y)) { m.camp = { x, y }; return m.camp; }
  }
  m.camp = { x: c.x, y: c.y + 2 };
  return m.camp;
}
function setDest(m, tx, ty) {
  if (m.dest && m.dest.x === tx && m.dest.y === ty && m.path.length) return true;
  const p = findPath(Math.floor(m.x / T), Math.floor(m.y / T), tx, ty);
  m.dest = { x: tx, y: ty };
  m.path = p || [];
  return !!p;
}
function stepPath(m, dt) {
  if (!m.path.length) return true;
  const ox = m.x, oy = m.y, wp = m.path[0];
  if (moveFree(m, wp.x, wp.y, MEMBER_SPEED * T, dt)) m.path.shift();
  m.stuckT = Math.hypot(m.x - ox, m.y - oy) < 0.02 ? m.stuckT + dt : 0;
  if (m.stuckT > 1) { m.path = []; m.stuckT = 0; return true; }
  return !m.path.length;
}
function goCamp(m, dt) {
  const s = campSpot(m);
  setDest(m, s.x, s.y);
  stepPath(m, dt);
}
function wander(m, dt) {
  m.waitT -= dt;
  if (!m.path.length && m.waitT <= 0) {
    m.waitT = rand(2, 5);
    const c = G.core;
    const x = c.x + randInt(-4, 5), y = c.y + randInt(-3, 5);
    if (!isBlocked(x, y)) setDest(m, x, y);
  }
  stepPath(m, dt);
}

// ---------- 目标 ----------
function shoreTiles() {
  const list = [];
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (isBlocked(x, y)) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => terrainAt(x + dx, y + dy) === TER.WATER)) list.push({ x, y });
    }
  }
  return list;
}
function targetTaken(m, test) {
  return G.members.some((o) => o !== m && o.target && test(o.target));
}
function findTarget(m, id) {
  const task = ISLAND_TASKS[id];
  const now = G.clock;
  let best = null, bd = Infinity;
  const consider = (tgt, x, y, key) => {
    if (m.blk[key] > now) return;
    let d = Math.hypot((x + 0.5) * T - m.x, (y + 0.5) * T - m.y) / T;
    if (targetTaken(m, (t) => t.key === key)) d += 8;
    if (d < bd) { bd = d; best = Object.assign(tgt, { key, x, y }); }
  };
  if (task.node) {
    for (const n of G.nodes) if (n && n.type === task.node) consider({ node: n }, n.x, n.y, 'n' + n.x + ',' + n.y);
  } else if (id === 'fish') {
    for (const s of G.shoreTiles) if (!isBlocked(s.x, s.y)) consider({ shore: true }, s.x, s.y, 's' + s.x + ',' + s.y);
  } else if (id === 'farm') {
    for (const b of G.buildings) if (b.def.farm) consider({ farm: b }, b.x, b.y, 'f' + b.id);
  }
  return best;
}
function targetValid(t) {
  if (!t) return false;
  if (t.node) return G.nodes[idx(t.x, t.y)] === t.node && t.node.amount > 0;
  if (t.farm) return t.farm.alive;
  if (t.shore) return !isBlocked(t.x, t.y);
  return false;
}

// ---------- 成员每帧逻辑 ----------
function updateMember(m, dt) {
  m.hit = Math.max(0, m.hit - dt);
  m.working = false;
  // 需求：饥饿、自动吃饭、心情
  m.hunger = Math.max(0, m.hunger - dt * (hasTrait(m, 'glutton') ? 1.1 : 0.8));
  if (m.hunger < 40 && G.res.food >= 2) {
    G.res.food -= 2;
    m.hunger = Math.min(100, m.hunger + (G.mods.foodSave ? 75 : 50));
    addFloat(m.x, m.y - 16, '吃饭 -2', '#ef7d57');
  }
  if (m.hunger <= 0) m.hp -= 0.6 * dt;
  m.mood += (memberMoodTarget(m) - m.mood) * Math.min(1, dt * 0.1);
  if (m.hp <= 0) { killMember(m, '饿死了'); return; }

  // 食人族来了：有武器就战斗，没有就逃回营地
  const w = memberWeapon(m);
  const [threat] = nearestMonsters(m.x, m.y, (m.task === 'guard' ? 8 : 5) * T);
  if (threat) {
    const d = Math.hypot(threat.x - m.x, threat.y - m.y);
    if (w) {
      m.note = '战斗中！';
      if (d <= w.range * T) { memberAttack(m, w, threat, dt); return; }
      m.path = [];
      moveFree(m, threat.x, threat.y, MEMBER_SPEED * T, dt);
      return;
    }
    // 没武器：被追上了就空手反击，否则逃回营地
    if (d <= T * 1.1) {
      m.note = '空手搏斗！';
      memberAttack(m, { dmg: 4 * (hasTrait(m, 'strong') ? 1.25 : 1) * (1 + 0.08 * m.skills.fight), range: 1.1, rate: 1.2 }, threat, dt);
      return;
    }
    m.note = '逃跑！';
    goCamp(m, dt);
    return;
  }

  // 睡觉 / 休息
  const night = G.phase === 'night';
  if (m.state === 'rest') {
    m.stamina = Math.min(100, m.stamina + dt * (night ? 8 : 5));
    m.hp = Math.min(memberMaxHp(m), m.hp + dt * 0.5);
    if (!night && m.stamina >= 90) m.state = 'work';
    else { m.note = night ? '睡觉 Zz' : '太累了，休息中'; goCamp(m, dt); return; }
  }
  if (night || m.stamina < 15) { m.state = 'rest'; m.target = null; m.path = []; return; }
  doTask(m, dt);
}

function doTask(m, dt) {
  const id = m.task, task = ISLAND_TASKS[id];
  if (id === 'idle') { m.note = '空闲'; wander(m, dt); return; }
  const why = taskProblem(m, id);
  if (why) { m.note = why + '，无法' + task.name; wander(m, dt); return; }
  if (id === 'guard') { m.note = '守卫营地'; goCamp(m, dt); return; }
  if (id === 'hunt') { doHunt(m, dt); return; }

  if (!targetValid(m.target)) {
    m.target = findTarget(m, id);
    m.path = []; m.dest = null; m.workT = 0;
    if (!m.target) { m.note = '找不到可以' + task.name + '的地方'; wander(m, dt); return; }
  }
  const t = m.target, tx = (t.x + 0.5) * T, ty = (t.y + 0.5) * T;
  const reach = t.shore ? 0.4 : 1.5;
  if (Math.hypot(tx - m.x, ty - m.y) > reach * T) {
    m.note = '前往' + task.name;
    if (!setDest(m, t.x, t.y)) { m.blk[t.key] = G.clock + 15; m.target = null; return; }
    if (stepPath(m, dt) && Math.hypot(tx - m.x, ty - m.y) > reach * T + 4) { m.blk[t.key] = G.clock + 15; m.target = null; }
    return;
  }
  // 干活
  m.note = '正在' + task.name;
  m.working = true;
  m.face = tx < m.x ? -1 : 1;
  m.stamina = Math.max(0, m.stamina - dt * 0.9 * (hasTrait(m, 'tough') ? 0.7 : 1));
  m.workT += dt * workSpeed(m, task);
  if (m.workT < task.time) return;
  m.workT -= task.time;
  gainXp(m, task.skill, 1);
  if (t.node) {
    takeFromNode(t.node, task.amount, tx, ty - 8);
  } else if (t.farm) {
    const k = Math.round(task.amount * levelMult(t.farm.level) + m.skills.farm / 5);
    G.res.food += k;
    addFloat(tx, ty - 8, '+' + k, RES_INFO.food.color);
  } else {
    const k = task.amount + Math.floor(m.skills.fish / 4);
    G.res.food += k;
    addFloat(m.x, m.y - 16, '+' + k + ' 鱼', RES_INFO.food.color);
  }
}

function doHunt(m, dt) {
  const w = memberWeapon(m);
  let a = m.target && m.target.animal;
  if (!a || !a.alive) {
    let bd = Infinity;
    a = null;
    for (const an of G.animals) {
      const d = Math.hypot(an.x - m.x, an.y - m.y);
      if (an.alive && d < bd) { bd = d; a = an; }
    }
    m.target = a ? { animal: a } : null;
    m.path = [];
  }
  if (!a) { m.note = '附近没有猎物'; wander(m, dt); return; }
  const d = Math.hypot(a.x - m.x, a.y - m.y);
  if (d > w.range * T * 0.9) {
    m.note = '追踪猎物';
    m.repath = (m.repath || 0) - dt;
    if (!m.path.length || m.repath <= 0) { m.repath = 1; m.dest = null; setDest(m, Math.floor(a.x / T), Math.floor(a.y / T)); }
    stepPath(m, dt);
    return;
  }
  m.note = '正在狩猎';
  m.working = true;
  m.face = a.x < m.x ? -1 : 1;
  m.cd -= dt;
  if (m.cd > 0) return;
  m.cd = 1 / w.rate;
  m.stamina = Math.max(0, m.stamina - 3);
  G.effects.push({ type: 'tracer', x: m.x, y: m.y - 8, tx: a.x, ty: a.y - 4, t: 0, life: 0.12 });
  a.hp -= w.dmg * (1 + 0.1 * m.skills.hunt);
  a.flee = 2; a.fx = a.x - m.x; a.fy = a.y - m.y;
  if (a.hp <= 0) {
    a.alive = false;
    const k = 8 + m.skills.hunt;
    G.res.food += k;
    addFloat(a.x, a.y - 10, '猎到野猪 +' + k, RES_INFO.food.color, true);
    gainXp(m, 'hunt', 3);
    m.target = null;
  }
}

function memberAttack(m, w, target, dt) {
  m.face = target.x < m.x ? -1 : 1;
  m.cd -= dt;
  if (m.cd > 0) return;
  m.cd = 1 / w.rate;
  if (w.ranged) shoot(m.x, m.y - 8, target, { kind: 'arrow', speed: 16 * T, dmg: w.dmg });
  else {
    hurtMonster(target, w.dmg);
    G.effects.push({ type: 'swing', x: m.x, y: m.y - 6, tx: target.x, ty: target.y - 4, t: 0, life: 0.15 });
  }
  gainXp(m, 'fight', 0.5);
}

function hurtMember(m, dmg) {
  m.hp -= dmg;
  m.hit = 0.12;
  sfx('hit');
  if (m.hp <= 0) killMember(m, '被食人族杀害了');
}
function killMember(m, how) {
  const i = G.members.indexOf(m);
  if (i < 0) return;
  G.members.splice(i, 1);
  if (m.hand) addIslandItem(m.hand);
  if (m.body) addIslandItem(m.body);
  if (G.memberSel === m) G.memberSel = null;
  showBanner(m.name + ' ' + how, '装备已放回仓库', 4, '#ef7d57');
  sfx('bad');
  if (!G.members.length) gameOver('营地里已经没有人了……');
}

function equipIslandItem(m, key) {
  const it = itemInfo(key);
  if (!takeIslandItem(key)) return;
  if (it.body) {
    const ratio = m.hp / memberMaxHp(m);
    if (m.body) addIslandItem(m.body);
    m.body = key;
    m.hp = ratio * memberMaxHp(m);
  } else {
    if (m.hand) addIslandItem(m.hand);
    m.hand = key;
  }
  m.target = null; m.path = [];
  sfx('click');
}
function unequipIsland(m, slot) {
  if (!m[slot]) return;
  addIslandItem(m[slot]);
  m[slot] = null;
  m.hp = Math.min(m.hp, memberMaxHp(m));
  m.target = null;
}

// ---------- 野猪 ----------
function spawnAnimal() {
  for (let i = 0; i < 40; i++) {
    const x = randInt(2, MAP_W - 3), y = randInt(2, MAP_H - 3);
    if (isBlocked(x, y) || terrainAt(x, y) !== TER.GRASS || distToCore(x, y) < 7) continue;
    G.animals.push({ x: (x + 0.5) * T, y: (y + 0.5) * T, hp: 30, alive: true, face: 1, wt: null, flee: 0 });
    return;
  }
}
function updateAnimals(dt) {
  for (const a of G.animals) {
    if (a.flee > 0) {
      a.flee -= dt;
      const d = Math.hypot(a.fx, a.fy) || 1;
      moveFree(a, a.x + a.fx / d * 20, a.y + a.fy / d * 20, 2.2 * T, dt);
      continue;
    }
    if (!a.wt || moveFree(a, a.wt.x, a.wt.y, 0.6 * T, dt)) {
      a.wt = { x: a.x + rand(-2, 2) * T, y: a.y + rand(-2, 2) * T };
    }
  }
  G.animals = G.animals.filter((a) => a.alive);
  G.animalTimer -= dt;
  if (G.animalTimer <= 0) {
    G.animalTimer = 20;
    if (G.animals.length < 6) spawnAnimal();
  }
}

// ---------- 海上来船 ----------
const SHIP_TYPES = {
  merchant: { name: '商船', sprite: 'ship' },
  castaway: { name: '破船', sprite: 'wreck' },
  cannibal: { name: '独木舟', sprite: 'canoe' },
};

function spawnShip() {
  const day = G.day;
  const weights = [['merchant', 45], ['castaway', 40], ['cannibal', day <= 2 ? 0 : Math.min(45, (day - 2) * 10)]];
  let r = Math.random() * weights.reduce((s, w) => s + w[1], 0), type = 'merchant';
  for (const [k, w] of weights) { r -= w; if (r <= 0) { type = k; break; } }
  const c = G.core;
  const cands = G.shoreTiles.filter((s) => { const d = distToCore(s.x, s.y); return d >= 7 && d <= 18 && !isBlocked(s.x, s.y); });
  if (!cands.length) return;
  const land = pick(cands);
  let wx = land.x, wy = land.y;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (terrainAt(land.x + dx, land.y + dy) === TER.WATER) { wx = land.x + dx; wy = land.y + dy; break; }
  const dx = wx - (c.x + 1), dy = wy - (c.y + 1), d = Math.hypot(dx, dy) || 1;
  const sx = (wx + dx / d * 30 + 0.5) * T, sy = (wy + dy / d * 30 + 0.5) * T;
  G.ship = { type, x: sx, y: sy, sx, sy, tx: (wx + 0.5) * T, ty: (wy + 0.5) * T, land, state: 'arrive', waitT: 0, face: dx < 0 ? 1 : -1 };
  if (type === 'cannibal') showBanner('海上出现了独木舟……', '看起来来者不善，让有武器的成员做好准备！', 4, '#ef7d57');
  else showBanner('海上有船靠近', SHIP_TYPES[type].name + '正朝岛上驶来', 3, '#73eff7');
}

function updateShip(dt) {
  if (!G.ship) {
    if (G.phase === 'day') {
      G.shipTimer -= dt;
      if (G.shipTimer <= 0) { G.shipTimer = rand(50, 100); spawnShip(); }
    }
    return;
  }
  const s = G.ship;
  const sail = (tx, ty) => {
    const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
    const step = 3 * T * dt;
    if (d <= step) { s.x = tx; s.y = ty; return true; }
    s.x += dx / d * step; s.y += dy / d * step;
    return false;
  };
  if (s.state === 'arrive') {
    if (sail(s.tx, s.ty)) { s.state = 'wait'; s.waitT = s.type === 'cannibal' ? 90 : 40; shipArrived(s); }
  } else if (s.state === 'wait') {
    s.waitT -= dt;
    if (s.type === 'cannibal' && !G.monsters.length) s.waitT = Math.min(s.waitT, 2);
    if (s.waitT <= 0) s.state = 'leave';
  } else if (sail(s.sx, s.sy)) {
    G.ship = null;
  }
}

function shipArrived(s) {
  const lx = (s.land.x + 0.5) * T, ly = (s.land.y + 0.5) * T;
  if (s.type === 'merchant') {
    s.offers = genOffers();
    openTrade();
  } else if (s.type === 'castaway') {
    const n = randInt(1, 3), free = islandHousing() - G.members.length;
    const take = Math.max(0, Math.min(n, free));
    const join = (k) => {
      for (let i = 0; i < k; i++) {
        const used = G.members.map((m) => m.name);
        const name = pick(ISLAND_NAMES.filter((x) => !used.includes(x)).concat(['无名氏']));
        G.members.push(newMember(name, lx + rand(-6, 6), ly + rand(-6, 6)));
      }
      showBanner(k + ' 名船员加入了营地！', '打开「成员」给他们分配工具和任务', 4, '#a7f070');
      sfx('win');
      s.waitT = 3;
    };
    G.dialog = {
      title: '一艘破船靠岸了',
      text: n + ' 名落难船员请求收留。' + (free < n ? '\n营地床位只够 ' + Math.max(0, free) + ' 人（多建草棚或木屋）。' : ''),
      options: [
        { label: take >= n ? '收留全部 ' + n + ' 人' : '收留 ' + take + ' 人（床位不足）', disabled: take <= 0, action: () => join(take) },
        { label: '分给他们食物让他们离开（食物 -6）', disabled: G.res.food < 6, action: () => { G.res.food -= 6; G.partyBonus = 5; s.waitT = 3; } },
        { label: '拒绝', action: () => { s.waitT = 3; } },
      ],
    };
    G.state = 'dialog';
  } else {
    const count = Math.min(8, 1 + Math.floor(G.day / 3));
    for (let i = 0; i < count; i++) spawnMonster('cannibal', lx + rand(-8, 8), ly + rand(-8, 8));
    showBanner('食人族登陆了！', count + ' 名敌人，拿着武器的成员会自动迎战，其他人会逃回营地', 4, '#ef7d57');
    sfx('night');
  }
}

// 商船：以物易物
function genOffers() {
  const toolOffer = () => {
    const kinds = ['axe', 'pick', 'basket', 'bow', 'rod', 'spear', 'cloth'];
    const kind = pick(kinds), tier = Math.random() < 0.7 ? 1 : 2, key = kind + ':' + tier;
    const give = tier === 1 ? { wood: 25, food: 10 } : { wood: 40, stone: 25, food: 20 };
    return { give, text: '换 ' + itemInfo(key).name, get: () => addIslandItem(key) };
  };
  const res = (give, k, n) => ({ give, text: '换 ' + n + ' ' + RES_INFO[k].name, get: () => { G.res[k] += n; } });
  const pool = [
    () => res({ wood: 30 }, 'iron', 4), () => res({ stone: 25 }, 'iron', 3), () => res({ food: 20 }, 'iron', 3),
    () => res({ wood: 20 }, 'food', 15), () => res({ stone: 20 }, 'food', 15), () => res({ food: 15 }, 'wood', 25),
    () => res({ food: 15 }, 'stone', 20), toolOffer, toolOffer,
  ];
  return pool.sort(() => Math.random() - 0.5).slice(0, 4).map((f) => Object.assign(f(), { done: false }));
}
function costText(c) { return Object.keys(c).map((k) => c[k] + ' ' + RES_INFO[k].name).join(' + '); }
function openTrade() {
  const s = G.ship;
  if (!s || !s.offers) return;
  G.dialog = {
    title: '商船靠岸了',
    text: '船长愿意以物易物（再点一次可以继续交易）。商船过一会儿就会起航。',
    options: s.offers.map((o) => ({
      label: (o.done ? '✔ ' : '') + '用 ' + costText(o.give) + ' ' + o.text,
      disabled: o.done || !canAfford(o.give),
      action: () => { pay(o.give); o.get(); o.done = true; sfx('coin'); openTrade(); },
    })).concat([{ label: '离开', action: () => { s.waitT = Math.min(s.waitT, 8); } }]),
  };
  G.state = 'dialog';
}

// ---------- 成员面板（参考《僵尸毁灭工程》的角色面板） ----------
function openMembers(m) {
  G.state = 'members';
  G.memberTab = 'list';
  G.memberSel = m || G.memberSel || null;
  G.pickSlot = null;
  G.buildMode = null;
}

function statBar(ctx, x, y, w, label, v, max, color) {
  drawText(ctx, label, x, y + 7, 12, '#c8d6e5', 'left', false);
  const bx = x + 34, bw = w - 34;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(bx, y, bw, 14);
  ctx.fillStyle = color; ctx.fillRect(bx + 1, y + 1, (bw - 2) * Math.max(0, Math.min(1, v / max)), 12);
  drawText(ctx, Math.round(v) + (max !== 100 ? '/' + Math.round(max) : ''), bx + bw / 2, y + 7, 11, '#f4f4f4', 'center');
}

function drawMembersPanel(ctx) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.7)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(880, sw - 12), px = (sw - pw) / 2, top = 6, bottom = sh - 6;
  drawPanel(ctx, px, top, pw, bottom - top);
  drawText(ctx, '营地成员 ' + G.members.length + '/' + islandHousing(), px + 14, top + 22, 17, '#ffcd75');
  drawButton(ctx, px + pw - 44, top + 8, 36, 30, '✕', () => { G.state = 'play'; G.pickSlot = null; }, { size: 14 });
  const tab = G.memberTab;
  drawButton(ctx, px + 12, top + 44, 90, 28, '成员', () => { G.memberTab = 'list'; }, { active: tab === 'list', size: 13 });
  drawButton(ctx, px + 108, top + 44, 90, 28, '制作工具', () => { G.memberTab = 'craft'; }, { active: tab === 'craft', size: 13 });
  drawButton(ctx, px + 204, top + 44, 90, 28, '仓库', () => { G.memberTab = 'store'; }, { active: tab === 'store', size: 13 });
  const y0 = top + 82;
  if (tab === 'craft') { drawCraftTab(ctx, px + 12, y0, pw - 24, bottom - 8); return; }
  if (tab === 'store') { drawStoreTab(ctx, px + 12, y0, pw - 24); return; }

  if (G.memberSel && !G.members.includes(G.memberSel)) G.memberSel = null;
  const wide = pw >= 700;
  if (wide) {
    const lw = 250;
    drawMemberList(ctx, px + 12, y0, lw, bottom - 8);
    if (G.memberSel) drawMemberDetail(ctx, G.memberSel, px + lw + 24, y0, pw - lw - 36, bottom - 8);
    else drawText(ctx, '← 点左边的成员查看详情', px + lw + 40, y0 + 20, 14, '#94b0c2');
  } else if (G.memberSel) {
    drawButton(ctx, px + pw - 110, top + 44, 98, 28, '◀ 返回列表', () => { G.memberSel = null; G.pickSlot = null; }, { size: 12 });
    drawMemberDetail(ctx, G.memberSel, px + 12, y0, pw - 24, bottom - 8);
  } else {
    drawMemberList(ctx, px + 12, y0, pw - 24, bottom - 8);
  }
}

function drawMemberList(ctx, x, y, w, bottom) {
  const rh = 54, gap = 6;
  const per = Math.max(1, Math.floor((bottom - y - 40 + gap) / (rh + gap)));
  const pages = Math.max(1, Math.ceil(G.members.length / per));
  G.memberPage = Math.max(0, Math.min(pages - 1, G.memberPage || 0));
  G.members.slice(G.memberPage * per, (G.memberPage + 1) * per).forEach((m, i) => {
    const ry = y + i * (rh + gap);
    const sel = m === G.memberSel;
    drawButton(ctx, x, ry, w, rh, '', () => { G.memberSel = m; G.pickSlot = null; }, { active: sel, color: sel ? '#29366f' : '#333c57' });
    ctx.drawImage(SPR['villager' + m.look].img, x + 4, ry + 3, 48, 48);
    drawText(ctx, m.name, x + 56, ry + 14, 14, '#ffcd75');
    drawText(ctx, ISLAND_TASKS[m.task].name + (m.hand ? ' · ' + itemInfo(m.hand).name : ''), x + w - 8, ry + 14, 11, '#73eff7', 'right', false);
    const note = wrapText(ctx, m.note, w - 64, 11)[0];
    drawText(ctx, note, x + 56, ry + 31, 11, '#c8d6e5', 'left', false);
    const bw = (w - 64) / 3;
    [[m.hp / memberMaxHp(m), '#b13e53'], [m.hunger / 100, '#ef7d57'], [m.stamina / 100, '#41a6f6']].forEach(([v, c], k) => {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x + 56 + k * bw, ry + 43, bw - 4, 5);
      ctx.fillStyle = c; ctx.fillRect(x + 56 + k * bw, ry + 43, (bw - 4) * Math.max(0, v), 5);
    });
  });
  if (pages > 1) {
    const by = bottom - 34;
    drawButton(ctx, x, by, 60, 30, '◀', () => { G.memberPage--; }, { size: 12 });
    drawText(ctx, (G.memberPage + 1) + '/' + pages, x + w / 2, by + 15, 13, '#f4f4f4', 'center');
    drawButton(ctx, x + w - 60, by, 60, 30, '▶', () => { G.memberPage++; }, { size: 12 });
  }
}

function drawMemberDetail(ctx, m, x, y, w, bottom) {
  // 头像 + 名字 + 特质
  ctx.fillStyle = '#262b44'; ctx.fillRect(x, y, 60, 60);
  ctx.drawImage(SPR['villager' + m.look].img, x + 2, y + 2, 56, 56);
  drawText(ctx, m.name, x + 70, y + 12, 18, '#ffcd75');
  let tx = x + 70;
  for (const id of m.traits) {
    const t = TRAITS[id], label = t.name + '：' + t.desc;
    ctx.font = '11px ' + FONT;
    const tw = ctx.measureText(label).width + 12;
    if (tx + tw > x + w) break;
    ctx.fillStyle = t.good ? '#1f5e3a' : '#5d275d';
    ctx.fillRect(tx, y + 26, tw, 18);
    drawText(ctx, label, tx + 6, y + 35, 11, '#f4f4f4', 'left', false);
    tx += tw + 4;
  }
  drawText(ctx, '状态：' + m.note, x + 70, y + 54, 12, '#73eff7', 'left', false);
  y += 70;

  // 属性条
  const cols = w >= 420 ? 2 : 1, cw = (w - (cols - 1) * 12) / cols;
  const bars = [
    ['生命', m.hp, memberMaxHp(m), '#b13e53'], ['饱食', m.hunger, 100, '#ef7d57'],
    ['心情', m.mood, 100, m.mood >= 60 ? '#38b764' : m.mood >= 35 ? '#ffcd75' : '#b13e53'], ['体力', m.stamina, 100, '#41a6f6'],
  ];
  bars.forEach((b, i) => statBar(ctx, x + (i % cols) * (cw + 12), y + Math.floor(i / cols) * 20, cw, b[0], b[1], b[2], b[3]));
  y += Math.ceil(bars.length / cols) * 20 + 8;

  // 技能
  drawText(ctx, '技能', x, y + 6, 13, '#ffcd75');
  y += 16;
  const skillIds = Object.keys(SKILLS), sc = w >= 420 ? 4 : 2, sw = w / sc;
  skillIds.forEach((s, i) => {
    const sx = x + (i % sc) * sw, sy = y + Math.floor(i / sc) * 22;
    drawText(ctx, SKILLS[s] + ' ' + m.skills[s], sx, sy + 7, 12, m.skills[s] ? '#f4f4f4' : '#94b0c2', 'left', false);
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(sx, sy + 15, sw - 10, 3);
    ctx.fillStyle = '#a7f070'; ctx.fillRect(sx, sy + 15, (sw - 10) * Math.min(1, m.xp[s] / (8 * (m.skills[s] + 1))), 3);
  });
  y += Math.ceil(skillIds.length / sc) * 22 + 6;

  // 装备栏
  drawText(ctx, '装备', x, y + 6, 13, '#ffcd75');
  y += 16;
  const slotW = (w - 8) / 2;
  [['hand', '手持'], ['body', '衣物']].forEach(([slot, label], i) => {
    const it = m[slot] ? itemInfo(m[slot]) : null;
    const sx = x + i * (slotW + 8);
    drawButton(ctx, sx, y, slotW, 34, '', () => { G.pickSlot = G.pickSlot === slot ? null : slot; }, { active: G.pickSlot === slot, color: '#262b44' });
    drawText(ctx, label, sx + 8, y + 17, 11, '#94b0c2', 'left', false);
    drawText(ctx, it ? it.name : '（空）', sx + 44, y + 17, 13, it ? '#f4f4f4' : '#566c86');
    if (it) drawText(ctx, TIER_NAMES[it.tier], sx + slotW - 8, y + 17, 11, ['#b07a45', '#94b0c2', '#73eff7'][it.tier], 'right', false);
  });
  y += 44;

  if (G.pickSlot) {
    const body = G.pickSlot === 'body';
    drawText(ctx, '选择要装备的物品（仓库）', x, y + 6, 13, '#ffcd75');
    y += 18;
    const keys = Object.keys(G.inventory).filter((k) => itemInfo(k).body === body);
    let ix = x;
    if (m[G.pickSlot]) {
      drawButton(ctx, ix, y, 70, 30, '卸下', () => { unequipIsland(m, G.pickSlot); G.pickSlot = null; }, { size: 12, color: '#5d275d' });
      ix += 76;
    }
    if (!keys.length) drawText(ctx, '仓库里没有可用的' + (body ? '衣物' : '工具') + '，去「制作工具」做一个', ix, y + 15, 12, '#94b0c2', 'left', false);
    for (const k of keys) {
      const label = itemInfo(k).name + ' ×' + G.inventory[k];
      ctx.font = 'bold 12px ' + FONT;
      const bw = ctx.measureText(label).width + 22;
      if (ix + bw > x + w) { ix = x; y += 36; }
      drawButton(ctx, ix, y, bw, 30, label, () => { equipIslandItem(m, k); G.pickSlot = null; }, { size: 12, color: '#29366f' });
      ix += bw + 6;
    }
    return;
  }

  // 任务分配
  drawText(ctx, '分配工作（需要手持对应工具）', x, y + 6, 13, '#ffcd75');
  y += 18;
  const ids = Object.keys(ISLAND_TASKS), tc = w >= 420 ? 5 : 3, tw = (w - (tc - 1) * 6) / tc, th = 38;
  ids.forEach((id, i) => {
    const why = taskProblem(m, id), active = m.task === id;
    const bx = x + (i % tc) * (tw + 6), by = y + Math.floor(i / tc) * (th + 6);
    if (by + th > bottom) return;
    drawButton(ctx, bx, by, tw, th, '', why ? null : () => { m.task = id; m.target = null; m.path = []; m.workT = 0; }, { active, dim: !!why, color: active ? '#1f5e3a' : '#333c57' });
    drawText(ctx, ISLAND_TASKS[id].name, bx + tw / 2, by + (why ? 13 : th / 2), 13, why ? '#94b0c2' : '#f4f4f4', 'center');
    if (why) drawText(ctx, why, bx + tw / 2, by + 28, 10, '#ef7d57', 'center', false);
  });
}

function drawCraftTab(ctx, x, y, w, bottom) {
  drawText(ctx, '制作的工具放进仓库，再到「成员」里装备', x, y + 6, 12, '#94b0c2', 'left', false);
  y += 18;
  const kinds = Object.keys(TOOL_KINDS);
  const rh = Math.max(40, Math.min(52, (bottom - y) / kinds.length - 4));
  const nameW = Math.min(150, w * 0.28), cw = (w - nameW - 12) / 3;
  kinds.forEach((kind, r) => {
    const k = TOOL_KINDS[kind], ry = y + r * (rh + 4);
    drawText(ctx, k.name, x, ry + 12, 14, '#ffcd75');
    wrapText(ctx, k.use, nameW - 6, 10).slice(0, 2).forEach((ln, j) => drawText(ctx, ln, x, ry + 27 + j * 12, 10, '#94b0c2', 'left', false));
    for (let t = 0; t < 3; t++) {
      const bx = x + nameW + t * (cw + 6) - 6, why = craftProblem(kind, t), cost = craftCost(kind, t);
      drawButton(ctx, bx, ry, cw, rh, '', why ? null : () => {
        if (!canAfford(cost)) { showBanner('资源不足', '', 1.5, '#ef7d57'); sfx('bad'); return; }
        pay(cost); addIslandItem(kind + ':' + t); sfx('build');
        showBanner('制作完成：' + k.names[t], '已放入仓库', 1.5, '#ffcd75');
      }, { dim: !!why, color: ['#4a3626', '#333c57', '#29366f'][t] });
      drawText(ctx, k.names[t] + (G.inventory[kind + ':' + t] ? ' (' + G.inventory[kind + ':' + t] + ')' : ''), bx + cw / 2, ry + 12, 12, why ? '#94b0c2' : '#f4f4f4', 'center');
      if (why) drawText(ctx, why, bx + cw / 2, ry + rh - 12, 10, '#ef7d57', 'center', false);
      else drawCost(ctx, cost, bx + cw / 2, ry + rh - 12, cw - 6, 10);
    }
  });
}

function drawStoreTab(ctx, x, y, w) {
  drawText(ctx, '仓库里的工具和衣物（装备到成员身上的不在这里）', x, y + 6, 12, '#94b0c2', 'left', false);
  y += 22;
  const keys = Object.keys(G.inventory);
  if (!keys.length) { drawText(ctx, '空的', x, y + 10, 13, '#566c86'); return; }
  let ix = x;
  for (const k of keys) {
    const label = itemInfo(k).name + ' ×' + G.inventory[k];
    ctx.font = 'bold 12px ' + FONT;
    const bw = ctx.measureText(label).width + 22;
    if (ix + bw > x + w) { ix = x; y += 36; }
    drawButton(ctx, ix, y, bw, 30, label, null, { size: 12, color: '#262b44' });
    ix += bw + 6;
  }
}

const ISLAND_EVENTS = [
  { text: '海浪冲上来一些漂流木（木材 +25）', apply: () => { G.res.wood += 25; } },
  { text: '有人在礁石边捡到海鸟蛋（食物 +15）', apply: () => { G.res.food += 15; } },
  { text: '昨夜下了大雨，部分食物受潮了（食物 -15%）', apply: () => { G.res.food = Math.floor(G.res.food * 0.85); } },
  { text: '大家在篝火边唱歌跳舞（今天心情 +10）', apply: () => { G.partyBonus = 10; } },
  { text: '退潮露出了一片石滩（石材 +20）', apply: () => { G.res.stone += 20; } },
];

MODES.island = {
  id: 'island',
  name: '荒岛求生',
  tag: '模拟经营 · 人员管理',
  icon: 'palm',
  desc: '船难后流落荒岛。给成员制作工具、分配工作，照顾大家的饱食和心情；海上会漂来商船、落难船员，还有食人族。最终点燃信号塔获救。',
  intro: '点「成员」查看大家的状态、装备工具、分配工作。你也可以亲手点资源采集。',
  resources: ['wood', 'stone', 'food', 'iron'],
  startRes: { wood: 30, stone: 0, food: 30, iron: 0 },
  dayTime: 70,
  nightTime: 20,
  hasNights: false,
  tapGather: true,
  upgradeExtra: null,
  coreSprite: 'core_island',
  fire: [23, 25],
  baseTerrain: TER.GRASS,

  nodes: {
    palm: { name: '椰子树', res: 'wood', amount: 20, regrow: 8 },
    rock: { name: '石头', res: 'stone', amount: 35, regrow: 3 },
    berry: { name: '浆果丛', res: 'food', amount: 12, regrow: 8 },
    ironore: { name: '铁矿', res: 'iron', amount: 20, regrow: 1 },
  },

  mapGen() {
    const cx = MAP_W / 2, cy = MAP_H / 2, k1 = rand(0, 6.28), k2 = rand(0, 6.28);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const dx = (x + 0.5 - cx) / (MAP_W * 0.45), dy = (y + 0.5 - cy) / (MAP_H * 0.43);
        const a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
        const edge = 1 + 0.12 * Math.sin(a * 3 + k1) + 0.07 * Math.sin(a * 5 + k2);
        G.terrain[idx(x, y)] = r > edge ? TER.WATER : r > edge - 0.13 ? TER.SAND : TER.GRASS;
      }
    }
    scatterNodes('palm', 9, 9, 2.2);
    scatterNodes('rock', 6, 5, 1.5);
    scatterNodes('berry', 7, 5, 1.8);
    scatterNodes('ironore', 3, 3, 1.2);
    const ang = rand(0, 6.28);
    scatterNearCore('palm', 7, ang, 0.6);
    scatterNearCore('berry', 5, ang + 2.1, 0.5);
    scatterNearCore('rock', 4, ang + 4.2, 0.5);
  },

  buildList: ['shelter', 'workbench', 'farm', 'house', 'smelter', 'palisade', 'gate', 'watchtower', 'garden', 'tavern', 'statue', 'signal'],
  buildings: {
    core: { name: '篝火营地', size: 2, hp: 500, housing: 2, happy: 5, light: 5, upgrade: { wood: 60, stone: 30, food: 20 }, desc: '大家围坐的地方，升级可多住 1 人' },
    shelter: { name: '草棚', hp: 80, cost: { wood: 15 }, housing: 2, desc: '简陋的住处，可住 2 人' },
    workbench: { name: '工作台', hp: 120, cost: { wood: 25, stone: 10 }, locked: true, desc: '可以制作石器工具' },
    farm: { name: '农田', hp: 60, cost: { wood: 20, food: 5 }, farm: true, locked: true, desc: '派拿锄头的成员来务农' },
    house: { name: '木屋', hp: 150, cost: { wood: 40, stone: 15 }, housing: 4, happy: 3, locked: true, desc: '舒适的家，可住 4 人' },
    smelter: { name: '熔炼炉', hp: 150, cost: { wood: 20, stone: 40 }, light: 2, locked: true, desc: '可以制作铁器工具' },
    palisade: { name: '木栅栏', sprite: 'wall_log', wallStyle: 'log', hp: 200, cost: { wood: 8 }, wall: true, locked: true, desc: '阻挡食人族，相邻的栅栏和门会自动连成一片' },
    gate: { name: '栅栏门', sprite: 'door_log', wallStyle: 'log', hp: 170, cost: { wood: 12 }, door: true, locked: true, desc: '成员可以进出，食人族过不去（比栅栏略脆）' },
    watchtower: { name: '瞭望塔', sprite: 'tower', hp: 150, cost: { wood: 40, stone: 15 }, attack: 'arrow', range: 5, dmg: 9, rate: 1.2, light: 2.5, locked: true, desc: '自动射击来犯的敌人' },
    garden: { name: '花园', hp: 60, cost: { wood: 10, food: 10 }, happy: 6, locked: true, desc: '让大家心情变好' },
    tavern: { name: '酒馆', hp: 150, cost: { wood: 60, stone: 30, food: 20 }, happy: 14, locked: true, desc: '大幅提升心情' },
    statue: { name: '石像', hp: 300, cost: { stone: 60 }, happy: 10, locked: true, desc: '岛上的地标' },
    signal: { name: '信号塔', hp: 200, cost: { wood: 150, stone: 100, food: 50 }, light: 3, locked: true, desc: '点燃求救信号——获救！' },
  },

  techs: [
    { id: 'woodtools', name: '木器', desc: '可以制作木制工具（斧、镐、筐、衣物）', cost: {} },
    { id: 'hunting', name: '狩猎', desc: '可以制作弓，派人狩猎野猪', cost: { wood: 20 } },
    { id: 'fishing', name: '捕鱼', desc: '可以制作鱼竿，派人在岸边捕鱼', cost: { wood: 25 } },
    { id: 'stonetools', name: '石器', desc: '解锁 工作台，可以制作石器工具（干活速度 ×1.5）', cost: { wood: 30, stone: 20 }, unlock: ['workbench'] },
    { id: 'farming', name: '农耕', desc: '解锁 农田，可以制作锄头', cost: { wood: 40, food: 15 }, unlock: ['farm'] },
    { id: 'carpentry', name: '木工', desc: '解锁 木屋（可住 4 人）', cost: { wood: 60, stone: 20 }, unlock: ['house'] },
    { id: 'defense', name: '防御工事', desc: '解锁 木栅栏、栅栏门、瞭望塔，可以制作矛', cost: { wood: 50, stone: 20 }, unlock: ['palisade', 'gate', 'watchtower'] },
    { id: 'irontools', name: '冶铁', desc: '解锁 熔炼炉，可以制作铁器工具（干活速度 ×2.2）', cost: { wood: 40, stone: 60 }, req: ['stonetools'], unlock: ['smelter'] },
    { id: 'gardening', name: '园艺', desc: '解锁 花园', cost: { wood: 20, food: 20 }, req: ['farming'], unlock: ['garden'] },
    { id: 'cooking', name: '烹饪', desc: '吃一顿饭顶得更久，所有人心情 +5', cost: { wood: 30, food: 30 }, req: ['fishing'], apply: (m) => { m.foodSave = 1; m.happy += 5; } },
    { id: 'brewing', name: '酿造', desc: '解锁 酒馆（大幅提升心情）', cost: { wood: 60, food: 40 }, req: ['farming'], unlock: ['tavern'] },
    { id: 'sculpture', name: '雕刻', desc: '解锁 石像', cost: { stone: 50 }, req: ['carpentry'], unlock: ['statue'] },
    {
      id: 'signal', name: '求救信号', desc: '解锁 信号塔，建成即获救通关', cost: { wood: 100, stone: 60 }, req: ['carpentry'],
      cond: () => G.happiness >= 70 && G.members.length >= 8, condText: '需要幸福度 ≥ 70、人口 ≥ 8', unlock: ['signal'],
    },
  ],

  monsters: {
    cannibal: { name: '食人族', sprite: 'cannibal', hp: 35, speed: 1.3, dmg: 8, rate: 1, color: '#b13e53' },
  },
  wave: { hpPerNight: 0.12, dmgPerNight: 0.05 },
  perks: null,

  hooks: {
    init() {
      G.techs.woodtools = true;
      G.members = [];
      G.inventory = {};
      G.animals = [];
      G.ship = null;
      G.shipTimer = rand(40, 60);
      G.animalTimer = 0;
      G.partyBonus = 0;
      G.memberSel = null;
      G.memberTab = 'list';
      G.pickSlot = null;
      G.shoreTiles = shoreTiles();
      const c = G.core;
      const a = newMember('你', c.cx - 8, c.cy + T * 1.4);
      a.hand = 'axe:0'; a.task = 'wood';
      const b = newMember(pick(ISLAND_NAMES), c.cx + 8, c.cy + T * 1.4);
      b.hand = 'basket:0'; b.task = 'gather';
      G.members.push(a, b);
      for (let i = 0; i < 5; i++) spawnAnimal();
      G.happiness = avgMood();
    },
    save() {
      const keep = ['name', 'look', 'traits', 'hp', 'hunger', 'mood', 'stamina', 'skills', 'xp', 'hand', 'body', 'task', 'x', 'y'];
      return {
        members: G.members.map((m) => { const o = {}; keep.forEach((k) => { o[k] = m[k]; }); return o; }),
        inventory: G.inventory,
      };
    },
    load(d) {
      MODES.island.hooks.init();
      if (!d.members) return; // v0.2 的旧存档没有成员数据，用新开局的两名成员
      G.members = d.members.map((o) => Object.assign(newMember(o.name, o.x, o.y), o));
      G.inventory = d.inventory || {};
    },
    update(dt) {
      for (const m of G.members.slice()) {
        updateMember(m, dt);
        if (G.state === 'over') return;
      }
      updateAnimals(dt);
      updateShip(dt);
      G.raidActive = G.monsters.length > 0;
      G.happiness = avgMood();
    },
    monsterAI(mo, dt) {
      let t = null, bd = 8 * T;
      for (const m of G.members) {
        const d = Math.hypot(m.x - mo.x, m.y - mo.y);
        if (d < bd) { bd = d; t = m; }
      }
      if (!t) return false; // 没人在附近就冲营地
      if (bd < T * 0.8) {
        if (mo.cd <= 0) { mo.cd = 1 / mo.def.rate; hurtMember(t, mo.dmg); }
        return true;
      }
      moveFree(mo, t.x, t.y, monsterSpeed(mo), dt);
      return true;
    },
    onKill(mo) {
      if (Math.random() < 0.3) { G.res.iron += 1; addFloat(mo.x, mo.y - 14, '+1 铁', RES_INFO.iron.color, true); }
      if (G.monsters.filter((x) => x.alive).length === 0) showBanner('击退了食人族！', '受伤的成员休息后会慢慢恢复', 3, '#a7f070');
    },
    night() { showBanner('夜幕降临', '成员们回营地睡觉', 2.5, '#c8d6e5'); },
    dawn() {
      const msgs = [];
      G.partyBonus = 0;
      if (Math.random() < 0.5) { const e = pick(ISLAND_EVENTS); e.apply(); msgs.push(e.text); }
      const free = islandHousing() - G.members.length;
      if (free > 0 && avgMood() >= 55 && Math.random() < 0.25) {
        const c = G.core;
        G.members.push(newMember(pick(ISLAND_NAMES), c.cx, c.cy + T * 2));
        msgs.push('一位漂流者被冲上岸，加入了营地！');
      }
      G.dawnMsg = msgs.join('　');
    },
    onBuild(b) {
      if (b.type === 'signal') {
        victory('获救了！', '冲天的信号火被路过的货船看到了。\n' + G.members.length + ' 位岛民在第 ' + G.day + ' 天全部获救！');
      }
      G.shoreTiles = shoreTiles();
    },
    onWorldTap(wx, wy) {
      if (G.ship && G.ship.state === 'wait' && G.ship.type === 'merchant' && Math.hypot(G.ship.x - wx, G.ship.y - wy) < T * 1.2) { openTrade(); return true; }
      let best = null, bd = 10;
      for (const m of G.members) {
        const d = Math.hypot(m.x - wx, m.y - 6 - wy);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) { openMembers(best); return true; }
      return false;
    },
    hud() {
      const cap = islandHousing(), h = Math.round(G.happiness || 0);
      const working = G.members.filter((m) => m.working).length;
      const hc = h >= 70 ? '#a7f070' : h >= 40 ? '#ffcd75' : '#ef7d57';
      return [
        { icon: 'heart', text: '幸福 ' + h, color: hc },
        { icon: 'person', text: '人口 ' + G.members.length + '/' + cap, color: cap < G.members.length ? '#ef7d57' : '#f4f4f4' },
        { text: '干活中 ' + working + '/' + G.members.length },
      ].concat(G.raidActive ? [{ text: '⚠ 食人族来袭', color: '#ef7d57' }] : []);
    },
    buildingInfo(b) {
      if (b.def.housing) return '可住 ' + (b.def.housing + b.level - 1) + ' 人（营地共 ' + G.members.length + '/' + islandHousing() + '）';
      if (b.def.farm) { const f = G.members.find((m) => m.target && m.target.farm === b); return f ? f.name + ' 正在这里务农' : '没人务农：给成员装备锄头并分配「务农」'; }
      if (b.type === 'workbench') return '现在可以在「成员」→「制作工具」里做石器了';
      if (b.type === 'smelter') return '现在可以在「成员」→「制作工具」里做铁器了';
      if (b.def.happy) return '心情 +' + Math.round(b.def.happy * levelMult(b.level));
      return null;
    },
    extraButtons() { return [{ label: '成员', onClick: () => openMembers() }]; },
    drawWorld(ctx) {
      for (const a of G.animals) {
        drawShadow(ctx, a.x, a.y + 2, 14);
        ctx.drawImage(a.face < 0 ? SPR.boar.flip : SPR.boar.img, a.x - 8, a.y - 12, 16, 16);
        if (a.hp < 30) hpBar(ctx, a.x - 5, a.y - 8, 10, a.hp / 30, '#b13e53');
      }
      const s = G.ship;
      if (s) {
        const spr = SPR[SHIP_TYPES[s.type].sprite], bob = Math.sin(G.time * 2) * 1.5;
        ctx.drawImage(s.face < 0 ? spr.flip : spr.img, Math.round(s.x - 16), Math.round(s.y - 24 + bob), 32, 32);
        if (s.state === 'wait' && s.type === 'merchant') drawWorldLabel(ctx, '交易', s.x, s.y - 28 + bob, '#ffcd75');
      }
      for (const m of G.members) {
        const spr = SPR['villager' + m.look];
        const bob = m.path.length ? -Math.abs(Math.sin(G.time * 9 + m.id)) * 1.5 : 0;
        if (m === G.memberSel) {
          ctx.strokeStyle = '#ffcd75';
          ctx.lineWidth = 1;
          ctx.strokeRect(m.x - 7.5, m.y + 1.5, 15, 2);
        }
        drawShadow(ctx, m.x, m.y + 1, 11);
        ctx.drawImage(m.hit > 0 ? spr.white : (m.face < 0 ? spr.flip : spr.img), m.x - 8, m.y - 14 + bob, 16, 16);
        if (m.working && m.workT) hpBar(ctx, m.x - 5, m.y - 17, 10, m.workT / (ISLAND_TASKS[m.task].time || 1), '#ffcd75');
        if (m.hp < memberMaxHp(m)) hpBar(ctx, m.x - 5, m.y - 20, 10, m.hp / memberMaxHp(m), '#a7f070');
        const icon = m.state === 'rest' ? 'Zz' : m.hunger < 25 ? '饿' : m.note.indexOf('需要') === 0 ? '?' : null;
        if (icon) drawWorldLabel(ctx, icon, m.x + 6, m.y - 18, icon === '饿' ? '#ef7d57' : '#c8d6e5');
      }
    },
  },
};
