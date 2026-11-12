// =============================================
//  模式 3：丧尸求生基地（城市大地图）
//  开局选择初始营地（8 种，各有禀赋）
//  白天：操控角色在城市里搜索建筑（公寓、超市、医院、警局……）、招募幸存者
//  夜晚：附近的丧尸和尸潮围攻营地，幸存者站岗 + 防御工事
//  每个幸存者有：装备栏、天赋词条、技能、士气、数据面板（参考《僵尸毁灭工程》）
// =============================================
const WEAPONS = {
  fists: { name: '拳头', dmg: 4, range: 1.1, rate: 1.5, melee: true },
  knife: { name: '小刀', dmg: 9, range: 1.2, rate: 2, melee: true, tier: 1, craft: { parts: 6 } },
  bat: { name: '球棒', dmg: 15, range: 1.3, rate: 1.2, melee: true, tier: 1, craft: { parts: 10 } },
  axe: { name: '消防斧', dmg: 26, range: 1.3, rate: 0.9, melee: true, tier: 2, craft: { parts: 22 } },
  pistol: { name: '手枪', dmg: 12, range: 5, rate: 1.6, tier: 2, craft: { parts: 28 } },
  shotgun: { name: '霰弹枪', dmg: 28, range: 3.5, rate: 0.8, splash: 1.2, tier: 3, craft: { parts: 45 } },
  rifle: { name: '步枪', dmg: 30, range: 7, rate: 1.1, tier: 3, craft: { parts: 60 } },
};
const ARMORS = {
  none: { name: '无护甲', hp: 0 },
  jacket: { name: '皮夹克', hp: 30, tier: 1, craft: { parts: 12 } },
  vest: { name: '防弹背心', hp: 70, tier: 2, craft: { parts: 30 } },
  riot: { name: '防暴盔甲', hp: 130, tier: 3, craft: { parts: 55 } },
};
const CONSUMABLES = {
  bandage: { name: '绷带', heal: 30, desc: '恢复 30 生命', tier: 1, craft: { water: 3, parts: 2 } },
  medkit: { name: '急救包', heal: 999, desc: '生命回满，倒下的同伴也能救起' },
};

// 天赋词条：good = 正面（绿色），否则是负面（红色）
const ZTRAITS = {
  marksman: { name: '神枪手', desc: '枪械伤害 +25%', good: true },
  brawler: { name: '强壮', desc: '近战伤害 +25%，生命 +10', good: true },
  tough: { name: '坚韧', desc: '生命上限 +30', good: true },
  fast: { name: '敏捷', desc: '移动速度 +15%', good: true },
  scavenger: { name: '拾荒者', desc: '搜索快 40%，物资多 30%', good: true },
  medic: { name: '医生', desc: '每天黎明为全员额外恢复 25% 生命', good: true },
  engineer: { name: '工程师', desc: '营地制作装备费用 -25%', good: true },
  nightowl: { name: '夜猫子', desc: '夜晚伤害 +20%', good: true },
  lucky: { name: '幸运', desc: '搜到武器护甲的概率 +60%', good: true },
  optimist: { name: '乐观', desc: '士气下降减半', good: true },
  weak: { name: '体弱', desc: '生命上限 -20' },
  clumsy: { name: '笨手笨脚', desc: '近战伤害 -20%' },
  shortsight: { name: '近视', desc: '枪械射程 -20%' },
  glutton: { name: '贪吃', desc: '每天多吃 1 份食物' },
  coward: { name: '胆小', desc: '士气下降加倍' },
  slow: { name: '迟缓', desc: '移动速度 -15%' },
};
const TRAIT_CONFLICT = [['brawler', 'clumsy'], ['tough', 'weak'], ['fast', 'slow'], ['optimist', 'coward'], ['marksman', 'shortsight']];
const ZSKILLS = { shoot: '射击', melee: '近战', scav: '搜刮' };
const SURVIVOR_NAMES = ['老王', '小李', '阿强', '莉莉', '老陈', '小芳', '大刘', '杰克', '安娜', '阿杰', '小雨', '老赵', '阿伟', '萍姐', '小白', '铁柱',
  '阿明', '小雪', '胖虎', '老周', '玛丽', '阿飞', '小鹿', '大熊', '秀英', '老孙', '小林', '阿珍'];

// ---------- 8 个初始营地 ----------
const ZCAMPS = {
  police: {
    struct: 'police', name: '警察局', desc: '武器库里还剩些家伙，墙也够结实，就是没什么吃的。',
    pros: ['初始：手枪×2、防弹背心', '路障、避难所生命 +50%'], cons: ['食物只有 5、水只有 10'],
    start: { food: 5, water: 10, parts: 20 },
    apply() { G.player.weapon = 'pistol'; addItem('w:pistol'); addItem('a:vest'); G.mods.wallHp = 1.5; G.mods.coreHp = 1.5; prebuild('barricade', 3); },
  },
  supermarket: {
    struct: 'supermarket', name: '超市', desc: '货架上的食物和水够撑一阵子——但总会吃完的。',
    pros: ['初始食物 40、水 40', '超市库存：每天自动补给 食物/水 各 12，共 150，直到耗尽'], cons: ['零件只有 5，没有武器', '避难所生命 -20%'],
    start: { food: 40, water: 40, parts: 5 },
    apply() { G.player.weapon = 'fists'; G.inventory = {}; G.stock = { food: 150, water: 150 }; G.mods.coreHp = 0.8; },
  },
  hospital: {
    struct: 'hospital', name: '医院', desc: '药品充足，还有一位医生。不过医院附近的丧尸特别多。',
    pros: ['初始：急救包×2、绷带×5', '一名「医生」同伴', '每天黎明全员生命回满'], cons: ['零件只有 8', '附近丧尸多 50%'],
    start: { food: 15, water: 20, parts: 8 },
    apply() { addItem('c:medkit', 2); addItem('c:bandage', 5); addCampSurvivor(['medic']); G.camp.fullHeal = true; G.camp.dangerMul = 1.5; },
  },
  factory: {
    struct: 'factory', name: '工厂', desc: '满地的零件和工具，自带工作台。可惜这里种不出粮食。',
    pros: ['零件 80', '自带工作台', '制作装备费用 -30%'], cons: ['食物、水都只有 8'],
    start: { food: 8, water: 8, parts: 80 },
    apply() { prebuild('workbench', 1); G.camp.craftMul = 0.7; },
  },
  firestation: {
    struct: 'firestation', name: '消防站', desc: '消防斧、防护服和储水罐，还有一位强壮的消防员。',
    pros: ['初始：消防斧×2、皮夹克', '自带 2 座集水器', '一名「强壮」「坚韧」的消防员同伴'], cons: ['零件只有 8'],
    start: { food: 15, water: 25, parts: 8 },
    apply() {
      G.player.weapon = 'axe'; addItem('a:jacket'); prebuild('collector', 2);
      const s = addCampSurvivor(['brawler', 'tough']); s.weapon = 'axe'; s.name = '消防员' + s.name;
    },
  },
  school: {
    struct: 'school', name: '学校', desc: '教室改成了宿舍，两个学生跟着你。人多力量大，但物资紧张。',
    pros: ['两名学生同伴', '自带 2 座宿舍'], cons: ['学生「体弱」', '物资偏少'],
    start: { food: 12, water: 12, parts: 8 },
    apply() { prebuild('bunk', 2); addCampSurvivor(['weak', 'lucky']); addCampSurvivor(['weak', 'optimist']); },
  },
  gasstation: {
    struct: 'gasstation', name: '加油站', desc: '有燃料就有电，机枪塔已经架好了。枪声会引来更多丧尸。',
    pros: ['零件 40，已掌握「机械学」', '自带 1 座机枪塔'], cons: ['水只有 8', '附近丧尸多 40%'],
    start: { food: 15, water: 8, parts: 40 },
    apply() { G.techs.mech = true; G.unlocked.add('turret'); prebuild('turret', 1); G.camp.dangerMul = 1.4; },
  },
  apartment: {
    struct: 'apartment', name: '公寓楼', desc: '楼顶的小菜园和雨水桶，能自给自足的稳妥选择。',
    pros: ['已掌握「屋顶种植」', '自带菜园、集水器', '开局资源均衡'], cons: ['只有一把小刀'],
    start: { food: 20, water: 20, parts: 12 },
    apply() { G.techs.farming = true; G.unlocked.add('vegfarm'); prebuild('vegfarm', 1); prebuild('collector', 1); G.player.weapon = 'knife'; G.inventory = {}; },
  },
};

// ---------- 物品 ----------
function itemTable(key) { return key[0] === 'w' ? WEAPONS : key[0] === 'a' ? ARMORS : CONSUMABLES; }
function itemDef(key) { return itemTable(key)[key.slice(2)]; }
function itemName(key) { return itemDef(key).name; }
function addItem(key, n) { G.inventory[key] = (G.inventory[key] || 0) + (n || 1); }
function takeItem(key) {
  if (!G.inventory[key]) return false;
  if (!--G.inventory[key]) delete G.inventory[key];
  return true;
}
function itemStat(key) {
  const it = itemDef(key);
  if (key[0] === 'w') return '伤害 ' + it.dmg + ' 射程 ' + it.range + (it.splash ? ' 范围' : '') + (it.melee ? ' 近战' : ' 枪械');
  if (key[0] === 'a') return '生命 +' + it.hp;
  return it.desc;
}
function randomItem(kind, pool) {
  const tbl = kind === 'w' ? WEAPONS : ARMORS;
  const maxTier = Math.min(3, 1 + Math.floor(G.day / 3) + (pool ? 1 : 0));
  const keys = (pool || Object.keys(tbl)).filter((k) => tbl[k].tier);
  let ok = keys.filter((k) => tbl[k].tier <= maxTier);
  if (!ok.length) ok = keys.sort((a, b) => tbl[a].tier - tbl[b].tier).slice(0, 1);
  return kind + ':' + pick(ok);
}
function craftCostZ(it) {
  const eng = allPeople().some((p) => hasT(p, 'engineer')) ? 0.75 : 1;
  const mul = (G.camp ? G.camp.craftMul : 1) * eng, out = {};
  for (const k in it.craft) out[k] = Math.max(1, Math.ceil(it.craft[k] * mul));
  return out;
}

// ---------- 人物（玩家和幸存者共用） ----------
function allPeople() { return G.player ? [G.player].concat(G.survivors) : []; }
function hasT(p, id) { return p.traits.includes(id); }
function personMaxHp(p) {
  return p.baseHp + ARMORS[p.armor].hp + (hasT(p, 'tough') ? 30 : 0) + (hasT(p, 'brawler') ? 10 : 0) - (hasT(p, 'weak') ? 20 : 0);
}
function isDown(p) { return p === G.player ? p.down > 0 : p.down; }
function zombieHousing() {
  return G.buildings.reduce((n, b) => n + (b.def.housing ? b.def.housing + (b.level - 1) : 0), 0);
}

function newPerson(name, forced) {
  const goods = Object.keys(ZTRAITS).filter((k) => ZTRAITS[k].good), bads = Object.keys(ZTRAITS).filter((k) => !ZTRAITS[k].good);
  const traits = [];
  const add = (t) => {
    if (traits.includes(t)) return;
    if (TRAIT_CONFLICT.some(([a, b]) => (a === t && traits.includes(b)) || (b === t && traits.includes(a)))) return;
    traits.push(t);
  };
  if (forced) forced.forEach(add);
  else {
    add(pick(goods));
    if (Math.random() < 0.35) add(pick(goods));
    if (Math.random() < 0.5) add(pick(bads));
  }
  const p = {
    name, baseHp: 70, hp: 0, weapon: 'fists', armor: 'none', traits,
    skills: { shoot: randInt(0, 1), melee: randInt(0, 1), scav: randInt(0, 1) }, xp: { shoot: 0, melee: 0, scav: 0 },
    stats: { kills: 0, dmg: 0, searches: 0, days: 0 }, morale: randInt(60, 80), look: randInt(0, 5), joined: G.day,
    cd: 0, x: 0, y: 0, face: 1, hit: 0, down: false,
  };
  p.hp = personMaxHp(p);
  return p;
}
const PERSON_KEYS = ['name', 'baseHp', 'hp', 'weapon', 'armor', 'traits', 'skills', 'xp', 'stats', 'morale', 'look', 'joined', 'down', 'x', 'y'];
function personSave(p) { const o = {}; for (const k of PERSON_KEYS) o[k] = p[k]; return o; }
function personLoad(o) { return Object.assign(newPerson(o.name), { cd: 0, face: 1, hit: 0 }, o); }

function personDmgMult(p, w) {
  let m = 1 + 0.08 * (w.melee ? p.skills.melee : p.skills.shoot);
  if (!w.melee && hasT(p, 'marksman')) m *= 1.25;
  if (w.melee && hasT(p, 'brawler')) m *= 1.25;
  if (w.melee && hasT(p, 'clumsy')) m *= 0.8;
  if (hasT(p, 'nightowl') && G.phase === 'night') m *= 1.2;
  if (p.morale < 30) m *= 0.75;
  return m;
}
function personRange(p, w) { return w.range * (!w.melee && hasT(p, 'shortsight') ? 0.8 : 1); }
function changeMorale(p, d) {
  if (d < 0) d *= (hasT(p, 'coward') ? 2 : 1) * (hasT(p, 'optimist') ? 0.5 : 1);
  p.morale = Math.max(0, Math.min(100, p.morale + d));
}
function gainSkill(p, s, amt) {
  p.xp[s] += amt;
  const need = 3 + p.skills[s] * 3;
  if (p.xp[s] >= need && p.skills[s] < 10) {
    p.xp[s] -= need;
    p.skills[s]++;
    addFloat(p.x, p.y - 24, p.name + ' ' + ZSKILLS[s] + ' 升到 ' + p.skills[s] + ' 级', '#a7f070', true);
  }
}

function addSurvivor(p) {
  p.joined = G.day;
  p.hp = Math.min(p.hp || personMaxHp(p), personMaxHp(p));
  G.survivors.push(p);
  placeSurvivors();
  return p;
}
function addCampSurvivor(traits) {
  const used = allPeople().map((p) => p.name);
  const name = pick(SURVIVOR_NAMES.filter((n) => !used.includes(n)));
  return addSurvivor(newPerson(name, traits));
}
function placeSurvivors() {
  const c = G.core, n = G.survivors.length;
  G.survivors.forEach((s, i) => {
    const a = i / Math.max(1, n) * Math.PI * 2 + 0.4;
    s.x = c.cx + Math.cos(a) * 2.3 * T;
    s.y = c.cy + Math.sin(a) * 2.0 * T + 6;
  });
}
// 开局自带的建筑：放在避难所附近的空地上
function prebuild(type, n) {
  for (let k = 0; k < n; k++) {
    let done = false;
    for (let r = 2; r <= 6 && !done; r++) {
      const spots = [];
      for (let y = G.coreY - r; y <= G.coreY + 1 + r; y++) for (let x = G.coreX - r; x <= G.coreX + 1 + r; x++) {
        if (Math.max(Math.abs(x - G.coreX - 0.5), Math.abs(y - G.coreY - 0.5)) < r - 0.5) continue;
        if (!placeProblem(type, x, y)) spots.push([x, y]);
      }
      if (spots.length) { const [x, y] = pick(spots); createBuilding(type, x, y); done = true; }
    }
  }
}

// ---------- 战斗 ----------
function personAttack(p, dt, mult) {
  p.cd -= dt;
  if (p.cd > 0) return;
  const w = WEAPONS[p.weapon];
  const [best] = nearestMonsters(p.x, p.y - 4, personRange(p, w) * T);
  if (!best) { p.cd = 0; return; }
  const dmg = w.dmg * mult * personDmgMult(p, w);
  p.lastMelee = !!w.melee;
  if (w.melee) {
    const was = best.alive;
    hurtMonster(best, dmg);
    zCredit(p, dmg, was && !best.alive);
    G.effects.push({ type: 'swing', x: p.x, y: p.y - 6, tx: best.x, ty: best.y - 4, t: 0, life: 0.15 });
  } else {
    shoot(p.x, p.y - 8, best, { kind: 'bullet', speed: 26 * T, dmg, splash: w.splash ? w.splash * T : 0, owner: p });
    if (p === G.player) G.noise = { x: p.x, y: p.y, until: G.clock + 3 }; // 枪声会引来附近的丧尸
  }
  p.face = best.x < p.x ? -1 : 1;
  p.cd = 1 / w.rate;
}
function zCredit(p, dmg, killed) {
  p.stats.dmg += dmg;
  if (killed) { p.stats.kills++; gainSkill(p, p.lastMelee ? 'melee' : 'shoot', 1); }
}

function hurtPlayer(dmg) {
  const p = G.player;
  if (p.down > 0) return;
  p.hp -= dmg;
  p.hit = 0.12;
  sfx('hit');
  if (p.hp <= 0) {
    p.hp = 0;
    p.down = 3;
    p.path = []; p.goal = null; p.search = null;
    changeMorale(p, -10);
    showBanner('你被击倒了！', '3 秒后在避难所醒来', 3, '#ef7d57');
    sfx('bad');
  }
}
function hurtSurvivor(s, dmg) {
  s.hp -= dmg;
  s.hit = 0.12;
  if (s.hp <= 0) {
    s.hp = 0; s.down = true;
    changeMorale(s, -10);
    addFloat(s.x, s.y - 16, s.name + ' 倒下了', '#ef7d57', true);
  }
}

// ---------- 玩家 ----------
function updatePlayer(dt) {
  const p = G.player;
  p.hit = Math.max(0, p.hit - dt);
  if (p.down > 0) {
    p.down -= dt;
    if (p.down <= 0) {
      p.x = G.core.cx; p.y = G.core.cy + T * 1.5;
      p.hp = Math.round(personMaxHp(p) * 0.5);
      G.camFollow = true;
    }
    return;
  }
  const speed = 3.6 * T * (hasT(p, 'fast') ? 1.15 : 1) * (hasT(p, 'slow') ? 0.85 : 1);
  let kx = 0, ky = 0;
  if (G.keys.left) kx--;
  if (G.keys.right) kx++;
  if (G.keys.up) ky--;
  if (G.keys.down) ky++;
  const ox = p.x, oy = p.y;
  if (kx || ky) {
    p.path = []; p.goal = null;
    const d = Math.hypot(kx, ky);
    moveFree(p, p.x + kx / d * 20, p.y + ky / d * 20, speed, dt);
    G.camFollow = true;
  } else if (p.path.length) {
    const wp = p.path[0];
    if (moveFree(p, wp.x, wp.y, speed, dt)) p.path.shift();
    p.stuck = Math.hypot(p.x - ox, p.y - oy) < 0.05 ? (p.stuck || 0) + dt : 0;
    if (p.stuck > 0.6) { p.path = []; p.stuck = 0; }
  } else if (p.goal) {
    const g = p.goal;
    p.goal = null;
    reachGoal(g);
  }
  p.moving = Math.hypot(p.x - ox, p.y - oy) > 0.01;
  if (p.search) {
    if (p.moving) p.search = null;
    else {
      p.search.t += dt;
      if (p.search.t >= p.search.dur) { finishSearch(p.search); p.search = null; }
    }
  }
  personAttack(p, dt, 1);
}

// 点地图：走过去；点到建筑/汽车/垃圾箱就搜索，点到陌生人就对话
function playerTap(tx, ty, wx, wy) {
  const p = G.player;
  if (p.down > 0) return;
  let goal = null;
  const npc = G.npcs.find((n) => Math.hypot(n.x - wx, n.y - wy) < T * 0.8);
  const i = inMap(tx, ty) ? idx(tx, ty) : -1;
  const st = i >= 0 && G.structAt[i] >= 0 ? G.structs[G.structAt[i]] : null;
  const node = i >= 0 ? G.nodes[i] : null;
  if (npc) { goal = { npc }; tx = Math.floor(npc.x / T); ty = Math.floor(npc.y / T); }
  else if (st) {
    if (st.home) { addFloat(wx, wy, '这是我们的营地', '#a7f070', true); return; }
    goal = { struct: st };
    const door = structDoor(st, p.x, p.y);
    if (!door) { addFloat(wx, wy, '进不去', '#ef7d57', true); return; }
    tx = door.x; ty = door.y;
  } else if (node && G.def.nodes[node.type].search) goal = { node };
  if (goal && goalInReach(goal)) { reachGoal(goal); return; }
  const path = findPath(Math.floor(p.x / T), Math.floor(p.y / T), tx, ty);
  if (!path) { addFloat(wx, wy, '过不去', '#ef7d57', true); return; }
  p.path = path;
  p.goal = goal;
  p.search = null;
  G.camFollow = true;
  G.moveMarker = { x: wx, y: wy, t: G.time };
}

function goalInReach(g) {
  const p = G.player;
  if (g.npc) return Math.hypot(g.npc.x - p.x, g.npc.y - p.y) < T * 1.7;
  if (g.struct) return structDist(g.struct, p.x, p.y) < T * 1.3;
  return Math.hypot((g.node.x + 0.5) * T - p.x, (g.node.y + 0.5) * T - p.y) < T * 1.7;
}

function searchSpeed(p) { return (1 + 0.1 * p.skills.scav) * (hasT(p, 'scavenger') ? 1.67 : 1); }
function reachGoal(g) {
  if (!goalInReach(g)) return;
  const p = G.player;
  if (g.npc) { if (G.npcs.includes(g.npc)) openNpcDialog(g.npc); return; }
  if (g.struct) {
    const s = g.struct, d = STRUCTS[s.type];
    if (s.left <= 0) { addFloat(p.x, p.y - 18, d.name + '已经搜空了（第 ' + s.restock + ' 天可能有新物资）', '#94b0c2', true); return; }
    p.search = { struct: s, t: 0, dur: d.dur / searchSpeed(p) };
    return;
  }
  const n = g.node;
  if (G.nodes[idx(n.x, n.y)] !== n) return;
  if (n.searchedUntil > G.day) { addFloat(p.x, p.y - 18, '刚搜过，过几天再来', '#94b0c2', true); return; }
  p.search = { node: n, t: 0, dur: (n.type === 'car' ? 1.5 : 1.1) / searchSpeed(p) };
}

// 按物资表掷骰子
function rollLoot(L, p) {
  const got = [];
  const mult = (1 + 0.05 * p.skills.scav) * (hasT(p, 'scavenger') ? 1.3 : 1), luck = hasT(p, 'lucky') ? 1.6 : 1;
  for (const r of ['food', 'water', 'parts']) {
    if (!L[r] || Math.random() > L[r][2]) continue;
    const k = Math.round(randInt(L[r][0], L[r][1]) * mult);
    G.res[r] += k;
    got.push(RES_INFO[r].name + ' +' + k);
  }
  const found = (k) => { addItem(k); got.push('找到 ' + itemName(k)); showBanner('找到：' + itemName(k), '打开「幸存者」面板给大家装备上', 3, '#ffcd75'); };
  if (L.w && Math.random() < L.w * luck) found(randomItem('w', L.wPool));
  else if (L.a && Math.random() < L.a * luck) found(randomItem('a', L.aPool));
  if (L.c && Math.random() < L.c) found(Math.random() < 0.75 ? 'c:bandage' : 'c:medkit');
  return got;
}

function finishSearch(se) {
  const p = G.player;
  let got;
  if (se.struct) {
    const s = se.struct, d = STRUCTS[s.type];
    got = rollLoot(d.loot, p);
    s.left--;
    if (s.left <= 0) { s.restock = G.day + (d.restock || 5); got.push(d.name + '搜空了'); }
  } else {
    const n = se.node;
    if (n.type === 'car') { got = rollLoot({ parts: [3, 7, 1], water: [1, 3, 0.3] }, p); removeNode(n); }
    else { got = rollLoot({ food: [1, 3, 0.5], parts: [1, 3, 0.5], c: 0.05 }, p); n.searchedUntil = G.day + 3; }
  }
  p.stats.searches++;
  gainSkill(p, 'scav', 1);
  if (!got.length) got.push('什么也没找到……');
  got.forEach((t, i) => addFloat(p.x, p.y - 18 - i * 11, t, '#ffcd75', true));
  sfx('coin');
}

// ---------- 陌生人 / 强盗 ----------
function randomWalkable(cx, cy, rMin, rMax) {
  for (let tries = 0; tries < 60; tries++) {
    const a = rand(0, 6.283), r = rand(rMin, rMax);
    const x = Math.floor(cx / T + Math.cos(a) * r), y = Math.floor(cy / T + Math.sin(a) * r);
    if (!isBlocked(x, y)) return { x, y };
  }
  return null;
}
function spawnNpc() {
  const pos = randomWalkable(G.core.cx, G.core.cy, 9, 36);
  if (!pos) return;
  const banditChance = Math.min(0.5, 0.25 + G.day * 0.02), kind = Math.random() < banditChance ? 'bandit' : 'friendly';
  const used = allPeople().map((p) => p.name).concat(G.npcs.map((n) => n.name));
  const name = pick(SURVIVOR_NAMES.filter((n) => !used.includes(n)).concat(['无名氏']));
  G.npcs.push({ x: (pos.x + 0.5) * T, y: (pos.y + 0.5) * T, kind, name, face: 1, person: kind === 'friendly' ? newPerson(name) : null });
}
function removeNpc(n) { G.npcs = G.npcs.filter((o) => o !== n); }
function spawnBandits(x, y, count) {
  for (let i = 0; i < count; i++) spawnMonster('bandit', x + rand(-10, 10), y + rand(-10, 10), { wander: true });
}
function traitText(p) { return p.traits.map((t) => ZTRAITS[t].name).join('、') || '无'; }

function openNpcDialog(npc) {
  if (npc.kind === 'friendly') {
    const full = G.survivors.length >= zombieHousing(), cost = { food: 8, water: 8 }, pp = npc.person;
    const best = Object.keys(ZSKILLS).sort((a, b) => pp.skills[b] - pp.skills[a])[0];
    G.dialog = {
      title: '遇到幸存者「' + npc.name + '」',
      text: '对方又累又饿，警惕地打量着你。\n天赋：' + traitText(pp) + '　擅长：' + ZSKILLS[best] + ' ' + pp.skills[best] + ' 级',
      options: [
        {
          label: full ? '招募（床位已满，先建宿舍）' : '招募入伙（食物 8、水 8）',
          disabled: full || !canAfford(cost),
          action: () => {
            pay(cost); addSurvivor(pp); removeNpc(npc);
            allPeople().forEach((p) => changeMorale(p, 5));
            showBanner(npc.name + ' 加入了营地！', '在「幸存者」面板查看 TA 的天赋并发装备', 4, '#a7f070');
            sfx('win');
          },
        },
        {
          label: '分一点食物（食物 5）换零件', disabled: G.res.food < 5,
          action: () => {
            G.res.food -= 5;
            const k = randInt(5, 10); G.res.parts += k;
            showBanner('交易完成', npc.name + ' 给了你 ' + k + ' 个零件', 2.5, '#ffcd75');
            removeNpc(npc);
          },
        },
        { label: '抢劫（战斗）', action: () => { removeNpc(npc); spawnBandits(npc.x, npc.y, 1); } },
        { label: '离开', action: () => {} },
      ],
    };
  } else {
    const count = Math.min(4, 2 + Math.floor(G.day / 4));
    G.dialog = {
      title: '强盗「' + npc.name + '」一伙拦住了你！',
      text: '“把物资交出来，不然别怪我们不客气！”（' + count + ' 人，持有武器）',
      options: [
        { label: '战斗！', action: () => { removeNpc(npc); spawnBandits(npc.x, npc.y, count); } },
        {
          label: '交出三成食物和水',
          action: () => {
            G.res.food = Math.floor(G.res.food * 0.7);
            G.res.water = Math.floor(G.res.water * 0.7);
            allPeople().forEach((p) => changeMorale(p, -5));
            removeNpc(npc);
          },
        },
      ],
    };
  }
  G.state = 'dialog';
  sfx('click');
}

// ---------- 白天游荡的丧尸 ----------
function wanderCap() { return Math.round(Math.min(80, 18 + G.day * 3) * (G.camp ? G.camp.dangerMul : 1)); }
function spawnZombieAt(x, y) {
  const type = G.day >= 2 && Math.random() < 0.3 ? 'runner' : 'walker';
  spawnMonster(type, (x + rand(0.3, 0.7)) * T, (y + rand(0.3, 0.7)) * T, { wander: true });
}
// 危险建筑（医院、警局、超市……）门口聚着丧尸
function spawnNearStruct(s, n) {
  for (let k = 0; k < n; k++) {
    const pos = randomWalkable((s.x + s.w / 2) * T, (s.y + s.h / 2) * T, Math.max(s.w, s.h) / 2 + 1, Math.max(s.w, s.h) / 2 + 3);
    if (pos) spawnZombieAt(pos.x, pos.y);
  }
}
function spawnWanderer() {
  const p = G.player;
  if (Math.random() < 0.5) {
    const near = G.structs.filter((s) => !s.home && STRUCTS[s.type].danger && structDist(s, p.x, p.y) > 12 * T && structDist(s, p.x, p.y) < 30 * T);
    if (near.length) { spawnNearStruct(pick(near), 1); return; }
  }
  const pos = randomWalkable(p.x, p.y, 14, 30);
  if (pos && distToCore(pos.x, pos.y) > 10) spawnZombieAt(pos.x, pos.y);
}
function seedCityZombies() {
  const mul = G.camp.dangerMul;
  for (const s of G.structs) {
    const d = STRUCTS[s.type];
    if (s.home || !d.danger || structDist(s, G.core.cx, G.core.cy) < 12 * T) continue;
    // 自己营地类型以外，越危险的地方丧尸越多
    spawnNearStruct(s, Math.round(d.danger * 0.6 * mul * rand(0.5, 1.3)));
  }
  // 公路、树林、田野里也零散游荡着丧尸
  for (let k = 0; k < 30 * mul; k++) {
    const pos = randomWalkable(G.core.cx, G.core.cy, 14, 60);
    if (pos) spawnZombieAt(pos.x, pos.y);
  }
}

// ---------- 装备 / 物品 ----------
function equipItem(person, key) {
  if (!takeItem(key)) return;
  const id = key.slice(2);
  if (key[0] === 'w') {
    if (person.weapon !== 'fists') addItem('w:' + person.weapon);
    person.weapon = id;
  } else {
    const ratio = person.hp / personMaxHp(person);
    if (person.armor !== 'none') addItem('a:' + person.armor);
    person.armor = id;
    person.hp = Math.round(ratio * personMaxHp(person));
  }
  sfx('click');
}
function unequip(person, kind) {
  if (kind === 'w' && person.weapon !== 'fists') { addItem('w:' + person.weapon); person.weapon = 'fists'; }
  if (kind === 'a' && person.armor !== 'none') {
    addItem('a:' + person.armor); person.armor = 'none';
    person.hp = Math.min(person.hp, personMaxHp(person));
  }
}
function useItem(p, key) {
  const c = CONSUMABLES[key.slice(2)];
  if (p === G.player && p.down > 0) return;
  if (p.down && key !== 'c:medkit') { showBanner('倒下的同伴需要急救包', '', 2, '#ef7d57'); return; }
  if (p.hp >= personMaxHp(p) && !p.down) { showBanner(p.name + ' 不需要治疗', '', 1.5, '#94b0c2'); return; }
  if (!takeItem(key)) return;
  p.down = p === G.player ? 0 : false;
  p.hp = Math.min(personMaxHp(p), p.hp + c.heal);
  addFloat(p.x, p.y - 18, '使用' + c.name, '#a7f070', true);
  sfx('build');
}
function craftItem(key) {
  const it = itemDef(key), cost = craftCostZ(it);
  if (!canAfford(cost)) { showBanner('材料不足', '', 1.5, '#ef7d57'); sfx('bad'); return; }
  pay(cost);
  addItem(key);
  showBanner('制作完成：' + it.name, '', 2, '#ffcd75');
  sfx('build');
}

// ---------- 幸存者面板（状态 / 装备栏 / 天赋 / 技能 / 数据） ----------
function personSprite(p) { return p === G.player ? SPR.player : SPR['zs' + (p.look || 0)]; }
function itemIcon(key) { return SPR['icon_' + key.slice(2)] || SPR.icon_parts; }

function drawEquipPanel(ctx) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.7)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(900, sw - 12), px = (sw - pw) / 2, top = 6, bottom = sh - 6;
  drawPanel(ctx, px, top, pw, bottom - top);
  drawText(ctx, '幸存者 ' + allPeople().length + '　床位 ' + G.survivors.length + '/' + zombieHousing(), px + 14, top + 22, 17, '#ffcd75');
  drawButton(ctx, px + pw - 44, top + 8, 36, 30, '✕', () => { G.state = 'play'; G.pickSlot = null; }, { size: 14 });
  let tab = G.equipTab;
  if (tab !== 'craft' && tab !== 'bag') tab = 'people';
  [['people', '幸存者'], ['craft', '制作'], ['bag', '背包']].forEach(([id, label], i) => {
    drawButton(ctx, px + 12 + i * 92, top + 44, 86, 28, label, () => { G.equipTab = id; G.pickSlot = null; }, { active: tab === id, size: 13 });
  });
  const y0 = top + 82;
  if (tab === 'craft') { drawZCraft(ctx, px + 12, y0, pw - 24, bottom - 8); return; }
  if (tab === 'bag') { drawZBag(ctx, px + 12, y0, pw - 24, bottom - 8); return; }

  const people = allPeople();
  if (G.zSel && !people.includes(G.zSel)) G.zSel = null;
  const wide = pw >= 700;
  if (wide) {
    if (!G.zSel) G.zSel = G.player;
    const lw = 250;
    drawPeopleList(ctx, people, px + 12, y0, lw, bottom - 8);
    drawPersonDetail(ctx, G.zSel, px + lw + 26, y0, pw - lw - 38, bottom - 8);
  } else if (G.zSel) {
    drawButton(ctx, px + pw - 110, top + 44, 98, 28, '◀ 返回列表', () => { G.zSel = null; G.pickSlot = null; }, { size: 12 });
    drawPersonDetail(ctx, G.zSel, px + 12, y0, pw - 24, bottom - 8);
  } else drawPeopleList(ctx, people, px + 12, y0, pw - 24, bottom - 8);
}

function moraleColor(v) { return v >= 60 ? '#38b764' : v >= 30 ? '#ffcd75' : '#b13e53'; }

function drawPeopleList(ctx, people, x, y, w, bottom) {
  const rh = 58, gap = 6;
  const per = Math.max(1, Math.floor((bottom - y - 40 + gap) / (rh + gap)));
  const pages = Math.max(1, Math.ceil(people.length / per));
  G.zPage = Math.max(0, Math.min(pages - 1, G.zPage || 0));
  people.slice(G.zPage * per, (G.zPage + 1) * per).forEach((p, i) => {
    const ry = y + i * (rh + gap), sel = p === G.zSel, down = isDown(p);
    drawButton(ctx, x, ry, w, rh, '', () => { G.zSel = p; G.pickSlot = null; }, { active: sel, color: sel ? '#29366f' : '#333c57' });
    ctx.globalAlpha = down ? 0.45 : 1;
    ctx.drawImage(personSprite(p).img, x + 4, ry + 5, 48, 48);
    ctx.globalAlpha = 1;
    drawText(ctx, p.name + (down ? '（倒下）' : ''), x + 56, ry + 13, 14, down ? '#ef7d57' : '#ffcd75');
    ctx.drawImage(itemIcon('w:' + p.weapon).img, x + w - 26, ry + 5, 18, 18);
    if (p.armor !== 'none') ctx.drawImage(itemIcon('a:' + p.armor).img, x + w - 46, ry + 5, 18, 18);
    let tx = x + 56;
    for (const t of p.traits) {
      const tr = ZTRAITS[t];
      ctx.font = '10px ' + FONT;
      const tw = ctx.measureText(tr.name).width + 8;
      if (tx + tw > x + w - 4) break;
      ctx.fillStyle = tr.good ? '#1f5e3a' : '#5d275d';
      ctx.fillRect(tx, ry + 24, tw, 14);
      drawText(ctx, tr.name, tx + 4, ry + 31, 10, '#f4f4f4', 'left', false);
      tx += tw + 3;
    }
    const bw = (w - 64) / 2;
    [[p.hp / personMaxHp(p), '#b13e53'], [p.morale / 100, moraleColor(p.morale)]].forEach(([v, c], k) => {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(x + 56 + k * bw, ry + 45, bw - 4, 6);
      ctx.fillStyle = c; ctx.fillRect(x + 56 + k * bw, ry + 45, (bw - 4) * Math.max(0, Math.min(1, v)), 6);
    });
  });
  if (pages > 1) {
    const by = bottom - 34;
    drawButton(ctx, x, by, 60, 30, '◀', () => { G.zPage--; }, { size: 12 });
    drawText(ctx, (G.zPage + 1) + '/' + pages, x + w / 2, by + 15, 13, '#f4f4f4', 'center');
    drawButton(ctx, x + w - 60, by, 60, 30, '▶', () => { G.zPage++; }, { size: 12 });
  }
}

function sectionTitle(ctx, text, x, y) {
  drawText(ctx, text, x, y + 6, 13, '#ffcd75');
  ctx.fillStyle = '#566c86';
  ctx.fillRect(x, y + 15, 40, 1);
}

function drawPersonDetail(ctx, p, x, y, w, bottom) {
  const down = isDown(p);
  // 头像 + 名字
  ctx.fillStyle = '#262b44'; ctx.fillRect(x, y, 64, 64);
  ctx.strokeStyle = '#566c86'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, 62, 62);
  ctx.globalAlpha = down ? 0.45 : 1;
  ctx.drawImage(personSprite(p).img, x + 4, y + 4, 56, 56);
  ctx.globalAlpha = 1;
  drawText(ctx, p.name, x + 76, y + 14, 19, '#ffcd75');
  const role = p === G.player ? '你自己' : '第 ' + p.joined + ' 天加入';
  const state = down ? '倒下了' : p.hp < personMaxHp(p) * 0.35 ? '重伤' : p.hp < personMaxHp(p) ? '轻伤' : '健康';
  drawText(ctx, role + ' · ' + state + ' · 士气' + (p.morale >= 60 ? '高昂' : p.morale >= 30 ? '一般' : '低落'), x + 76, y + 36, 12, down ? '#ef7d57' : '#c8d6e5', 'left', false);
  if (p.morale < 30) drawText(ctx, '士气低落：伤害 -25%，可能离开营地', x + 76, y + 54, 11, '#ef7d57', 'left', false);
  y += 74;

  const two = w >= 540, cw = two ? (w - 16) / 2 : w;
  let ly = y, ry = y;
  const rx = two ? x + cw + 16 : x;

  // 状态条
  sectionTitle(ctx, '状态', x, ly); ly += 20;
  statBar(ctx, x, ly, cw, '生命', p.hp, personMaxHp(p), '#b13e53'); ly += 20;
  statBar(ctx, x, ly, cw, '士气', p.morale, 100, moraleColor(p.morale)); ly += 26;

  // 装备栏
  sectionTitle(ctx, '装备栏', x, ly); ly += 20;
  const slotW = (cw - 8) / 2;
  [['w', '武器', 'w:' + p.weapon], ['a', '护甲', 'a:' + p.armor]].forEach(([slot, label, key], i) => {
    const sx = x + i * (slotW + 8), empty = key === 'w:fists' || key === 'a:none';
    drawButton(ctx, sx, ly, slotW, 50, '', () => { G.pickSlot = G.pickSlot === slot ? null : slot; }, { active: G.pickSlot === slot, color: '#262b44' });
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(sx + 6, ly + 7, 36, 36);
    ctx.drawImage(itemIcon(key).img, sx + 8, ly + 9, 32, 32);
    drawText(ctx, label, sx + 48, ly + 12, 10, '#94b0c2', 'left', false);
    drawText(ctx, itemName(key), sx + 48, ly + 27, 13, empty ? '#94b0c2' : '#f4f4f4');
    const st = key[0] === 'w' ? '伤害 ' + Math.round(WEAPONS[p.weapon].dmg * personDmgMult(p, WEAPONS[p.weapon])) + ' 射程 ' + personRange(p, WEAPONS[p.weapon]).toFixed(1) : '生命 +' + ARMORS[p.armor].hp;
    drawText(ctx, st, sx + 48, ly + 41, 10, '#73eff7', 'left', false);
  });
  ly += 58;

  if (G.pickSlot) {
    // 从背包里选装备
    const kind = G.pickSlot;
    drawText(ctx, '点击装备（背包）：', x, ly + 8, 12, '#ffcd75', 'left', false);
    ly += 18;
    let ix = x;
    const cur = kind === 'w' ? p.weapon !== 'fists' : p.armor !== 'none';
    if (cur) { drawButton(ctx, ix, ly, 64, 34, '卸下', () => { unequip(p, kind); G.pickSlot = null; }, { size: 12, color: '#5d275d' }); ix += 70; }
    const keys = Object.keys(G.inventory).filter((k) => k[0] === kind);
    if (!keys.length) drawText(ctx, '背包里没有' + (kind === 'w' ? '武器' : '护甲') + '，去搜索建筑或制作', ix, ly + 17, 12, '#94b0c2', 'left', false);
    for (const k of keys) {
      const label = itemName(k) + ' ×' + G.inventory[k];
      ctx.font = 'bold 12px ' + FONT;
      const bw = ctx.measureText(label).width + 38;
      if (ix + bw > x + cw) { ix = x; ly += 40; }
      drawButton(ctx, ix, ly, bw, 34, '', () => { equipItem(p, k); G.pickSlot = null; }, { color: k[0] === 'w' ? '#5d275d' : '#257179' });
      ctx.drawImage(itemIcon(k).img, ix + 5, ly + 7, 20, 20);
      drawText(ctx, label, ix + 29, ly + 17, 12, '#f4f4f4');
      ix += bw + 6;
    }
    ly += 42;
  }

  // 消耗品
  const meds = Object.keys(G.inventory).filter((k) => k[0] === 'c');
  if (meds.length) {
    sectionTitle(ctx, '使用物品', x, ly); ly += 20;
    let ix = x;
    for (const k of meds) {
      const label = itemName(k) + ' ×' + G.inventory[k];
      ctx.font = 'bold 12px ' + FONT;
      const bw = ctx.measureText(label).width + 38;
      if (ix + bw > x + cw) { ix = x; ly += 40; }
      drawButton(ctx, ix, ly, bw, 34, '', () => useItem(p, k), { color: '#1f5e3a' });
      ctx.drawImage(itemIcon(k).img, ix + 5, ly + 7, 20, 20);
      drawText(ctx, label, ix + 29, ly + 17, 12, '#f4f4f4');
      ix += bw + 6;
    }
    ly += 42;
  }
  if (!two) ry = ly;
  if (!two && G.pickSlot) return; // 窄屏打开选择列表时，下面的内容先不画

  // 天赋词条
  sectionTitle(ctx, '天赋', rx, ry); ry += 20;
  for (const t of p.traits) {
    const tr = ZTRAITS[t];
    ctx.font = 'bold 11px ' + FONT;
    const nw = ctx.measureText(tr.name).width + 12;
    ctx.fillStyle = tr.good ? '#1f5e3a' : '#5d275d';
    ctx.fillRect(rx, ry, nw, 18);
    drawText(ctx, (tr.good ? '' : '') + tr.name, rx + 6, ry + 9, 11, '#f4f4f4');
    drawText(ctx, tr.desc, rx + nw + 6, ry + 9, 11, tr.good ? '#a7f070' : '#ef7d57', 'left', false);
    ry += 22;
  }
  if (!p.traits.length) { drawText(ctx, '（无）', rx, ry + 8, 11, '#94b0c2', 'left', false); ry += 20; }
  ry += 4;

  // 技能
  sectionTitle(ctx, '技能', rx, ry); ry += 20;
  const sk = Object.keys(ZSKILLS), skw = cw / sk.length;
  sk.forEach((s, i) => {
    const sx = rx + i * skw;
    drawText(ctx, ZSKILLS[s] + ' ' + p.skills[s] + ' 级', sx, ry + 7, 12, '#f4f4f4', 'left', false);
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(sx, ry + 16, skw - 10, 4);
    ctx.fillStyle = '#a7f070'; ctx.fillRect(sx, ry + 16, (skw - 10) * Math.min(1, p.xp[s] / (3 + p.skills[s] * 3)), 4);
  });
  ry += 30;

  // 数据
  sectionTitle(ctx, '数据', rx, ry); ry += 20;
  const data = [['击杀', p.stats.kills], ['造成伤害', Math.round(p.stats.dmg)], ['搜索', p.stats.searches], ['存活天数', p.stats.days]];
  const dw = (cw - 3 * 6) / 4;
  data.forEach(([label, v], i) => {
    const dx = rx + i * (dw + 6);
    ctx.fillStyle = '#262b44'; ctx.fillRect(dx, ry, dw, 38);
    drawText(ctx, String(v), dx + dw / 2, ry + 13, 15, '#ffcd75', 'center');
    drawText(ctx, label, dx + dw / 2, ry + 30, 10, '#94b0c2', 'center', false);
  });
}

function drawZCraft(ctx, x, y, w, bottom) {
  if (!countType('workbench')) { drawText(ctx, '需要先建造「工作台」才能制作', x, y + 10, 14, '#ef7d57'); return; }
  const list = [];
  for (const k in WEAPONS) if (WEAPONS[k].craft) list.push('w:' + k);
  for (const k in ARMORS) if (ARMORS[k].craft) list.push('a:' + k);
  for (const k in CONSUMABLES) if (CONSUMABLES[k].craft) list.push('c:' + k);
  const notes = [];
  if (G.camp && G.camp.craftMul < 1) notes.push('工厂营地 -30%');
  if (allPeople().some((p) => hasT(p, 'engineer'))) notes.push('有工程师 -25%');
  if (notes.length) { drawText(ctx, '费用优惠：' + notes.join('，'), x, y + 6, 12, '#a7f070', 'left', false); y += 18; }
  const cols = w >= 600 ? 2 : 1, cw = (w - (cols - 1) * 8) / cols, rh = 42;
  list.forEach((k, i) => {
    const it = itemDef(k), rx = x + (i % cols) * (cw + 8), ry = y + Math.floor(i / cols) * (rh + 6);
    if (ry + rh > bottom) return;
    const locked = it.tier > G.mods.craftTier;
    drawButton(ctx, rx, ry, cw, rh, '', () => { if (!locked) craftItem(k); }, { dim: locked });
    ctx.drawImage(itemIcon(k).img, rx + 6, ry + 7, 28, 28);
    drawText(ctx, it.name, rx + 40, ry + 13, 14, locked ? '#94b0c2' : '#ffcd75');
    drawText(ctx, locked ? '需要研究「军火工艺」' : itemStat(k), rx + 40, ry + 31, 11, '#c8d6e5', 'left', false);
    if (!locked) drawCost(ctx, craftCostZ(it), rx + cw - 50, ry + rh / 2, 90, 12);
  });
}

function drawZBag(ctx, x, y, w, bottom) {
  const keys = Object.keys(G.inventory);
  const target = G.zSel || G.player;
  drawText(ctx, '点击武器/护甲去「幸存者」页给人装备；点击药品给「' + target.name + '」使用', x, y + 6, 12, '#94b0c2', 'left', false);
  y += 20;
  if (!keys.length) { drawText(ctx, '背包空空如也——去城市里搜索建筑吧', x, y + 14, 13, '#94b0c2', 'left', false); return; }
  const cols = Math.max(1, Math.floor(w / 260)), cw = (w - (cols - 1) * 8) / cols, rh = 48;
  keys.forEach((k, i) => {
    const rx = x + (i % cols) * (cw + 8), ry = y + Math.floor(i / cols) * (rh + 6);
    if (ry + rh > bottom) return;
    drawButton(ctx, rx, ry, cw, rh, '', () => {
      if (k[0] === 'c') useItem(target, k);
      else { G.equipTab = 'people'; G.zSel = target; G.pickSlot = k[0]; }
    }, { color: '#262b44' });
    ctx.drawImage(itemIcon(k).img, rx + 6, ry + 8, 32, 32);
    drawText(ctx, itemName(k) + ' ×' + G.inventory[k], rx + 46, ry + 15, 14, '#ffcd75');
    drawText(ctx, itemStat(k), rx + 46, ry + 34, 11, '#c8d6e5', 'left', false);
  });
}

// ---------- 选择初始营地 ----------
function drawCampSelect(ctx) {
  const sw = G.sw, sh = G.sh, ids = Object.keys(ZCAMPS);
  drawText(ctx, '选择初始营地', sw / 2, 34, 22, '#ffcd75', 'center');
  drawButton(ctx, 10, 12, 70, 34, '返回', () => gotoScene('modes'), { size: 13 });
  if (!ZCAMPS[G.campSel]) G.campSel = ids[0];
  const wide = sw >= 820;
  const listW = wide ? Math.min(480, sw * 0.52) : sw - 24;
  const cols = wide ? 2 : sw >= 560 ? 4 : 2;
  const gap = 8, tw = (listW - (cols - 1) * gap) / cols, th = wide ? 96 : sw >= 560 ? 84 : 68;
  const gx = wide ? Math.max(12, (sw - listW - 16 - Math.min(440, sw - listW - 40)) / 2) : 12, gy = 62;
  ids.forEach((id, i) => {
    const c = ZCAMPS[id], x = gx + (i % cols) * (tw + gap), y = gy + Math.floor(i / cols) * (th + gap), sel = id === G.campSel;
    drawButton(ctx, x, y, tw, th, '', () => { G.campSel = id; }, { active: sel, color: sel ? '#29366f' : 'rgba(26,28,44,0.92)' });
    const im = structImg(c.struct, 1), maxW = tw - 12, maxH = th - 28;
    const k = Math.min(maxW / im.w, maxH / im.h);
    ctx.drawImage(im.img, x + (tw - im.w * k) / 2, y + 6 + (maxH - im.h * k) / 2, im.w * k, im.h * k);
    drawText(ctx, c.name, x + tw / 2, y + th - 11, 13, sel ? '#ffcd75' : '#f4f4f4', 'center');
  });
  // 详情
  const c = ZCAMPS[G.campSel];
  const rows = Math.ceil(ids.length / cols);
  let dx, dy, dw;
  if (wide) { dx = gx + listW + 16; dy = gy; dw = Math.min(440, sw - dx - 12); }
  else { dx = 12; dy = gy + rows * (th + gap) + 4; dw = sw - 24; }
  const dh = sh - dy - 12;
  drawPanel(ctx, dx, dy, dw, dh);
  let y = dy + 22;
  drawText(ctx, c.name, dx + 14, y, 20, '#ffcd75');
  y += 24;
  for (const ln of wrapText(ctx, c.desc, dw - 28, 12)) { drawText(ctx, ln, dx + 14, y, 12, '#c8d6e5', 'left', false); y += 17; }
  y += 6;
  const list = (title, arr, color, mark) => {
    drawText(ctx, title, dx + 14, y, 13, color);
    y += 19;
    for (const t of arr) for (const [k, ln] of wrapText(ctx, t, dw - 46, 12).entries()) {
      drawText(ctx, (k ? '　' : mark) + ' ' + ln, dx + 18, y, 12, '#f4f4f4', 'left', false);
      y += 17;
    }
    y += 6;
  };
  list('优势', c.pros, '#a7f070', '✚');
  list('劣势', c.cons, '#ef7d57', '✖');
  const by = Math.max(y + 4, dy + dh - 56);
  drawButton(ctx, dx + 14, Math.min(by, dy + dh - 50), dw - 28, 40, '在「' + c.name + '」建立营地', () => startGame('zombie', { camp: G.campSel }), { color: '#1f5e3a', size: 15 });
}

// ---------- 模式定义 ----------
MODES.zombie = {
  id: 'zombie',
  name: '丧尸求生基地',
  tag: '城市探索 · 8 种营地 · 招募 · 守夜',
  icon: 'walker',
  desc: '丧尸爆发后的大城市。选择警局、超市、医院等 8 种营地开局；白天搜索公寓、工厂、医院等建筑，招募各有天赋的幸存者；夜晚尸潮来袭。',
  intro: 'WASD 或点地面移动。点建筑/汽车/垃圾箱搜索，点陌生人对话。枪声会引来丧尸，天黑前回到营地！',
  resources: ['food', 'water', 'parts'],
  startRes: { food: 20, water: 20, parts: 15 },
  mapW: 112, mapH: 84, cityGround: true, spawnRadius: 24,
  dayTime: 100,
  nightSpawnTime: 35,
  hasNights: true,
  killRes: 'parts',
  upgradeExtra: 'parts',
  tapGather: false,
  coreSprite: 'core_zombie',
  fire: null,
  loseText: '避难所被丧尸攻破了！',
  groundColors: { [TER.GRASS]: ['#5f6b45', '#4f5a39', '#6e7a52'] },
  noFlowers: true,
  saveCheck: (d) => !!(d.extra && d.extra.city === 2),

  nodes: {
    car: { name: '废弃汽车', search: true, onRoad: true, amount: 1, regrow: 2 },
    dumpster: { name: '垃圾箱', search: true, amount: 1 },
    ctree: { name: '行道树', amount: 1 },
    ftree: { name: '树林', amount: 1, sprite: 'tree' },
    fpine: { name: '松林', amount: 1, sprite: 'zpine' },
  },

  mapGen() { cityMapGen(ZCAMPS[(G.opt && G.opt.camp) || 'police'].struct); },

  buildList: ['barricade', 'bunk', 'collector', 'workbench', 'vegfarm', 'spikes', 'turret', 'floodlight'],
  buildings: {
    core: {
      name: '避难所', size: 2, hp: 800, attack: 'bullet', range: 4, dmg: 6, rate: 1, housing: 2, light: 5,
      upgrade: { parts: 30, food: 10, water: 10 }, desc: '被攻破就输了，升级可多住 1 人',
    },
    barricade: { name: '路障', hp: 250, cost: { parts: 4 }, wall: true, desc: '阻挡丧尸' },
    bunk: { name: '宿舍', hp: 120, cost: { parts: 12, food: 5 }, housing: 2, desc: '可多招募 2 名幸存者' },
    collector: { name: '集水器', hp: 80, cost: { parts: 15 }, produce: { res: 'water', amount: 1, interval: 5 }, desc: '收集雨水' },
    workbench: { name: '工作台', hp: 120, cost: { parts: 20 }, desc: '可以在「幸存者」→「制作」里制作装备和绷带' },
    vegfarm: { name: '菜园', hp: 60, cost: { parts: 8, water: 10 }, produce: { res: 'food', amount: 1, interval: 5 }, locked: true, desc: '种菜产出食物' },
    spikes: { name: '钉板', hp: 80, cost: { parts: 6 }, trap: 12, passable: true, locked: true, desc: '不挡路，丧尸踩上去持续受伤' },
    turret: { name: '机枪塔', hp: 200, cost: { parts: 30 }, attack: 'bullet', range: 5, dmg: 6, rate: 3, light: 2, locked: true, desc: '高射速自动炮塔' },
    floodlight: { name: '探照灯', hp: 120, cost: { parts: 20 }, light: 5, aura: { radius: 4, slow: 0.6 }, locked: true, desc: '照亮周围并减速丧尸' },
  },

  techs: [
    { id: 'farming', name: '屋顶种植', desc: '解锁 菜园', cost: { parts: 10, water: 15 }, unlock: ['vegfarm'] },
    { id: 'traps', name: '陷阱', desc: '解锁 钉板', cost: { parts: 15 }, unlock: ['spikes'] },
    { id: 'drill', name: '战术训练', desc: '幸存者伤害 +30%', cost: { food: 20, parts: 20 }, apply: (m) => { m.survDmg *= 1.3; } },
    { id: 'purify', name: '净水技术', desc: '集水器和菜园产量 +40%', cost: { parts: 25, water: 10 }, apply: (m) => { m.prod *= 1.4; } },
    {
      id: 'mech', name: '机械学', desc: '解锁 机枪塔', cost: { parts: 40 },
      cond: () => countType('workbench') > 0, condText: '需要先建造工作台', unlock: ['turret'],
    },
    { id: 'power', name: '电力', desc: '解锁 探照灯（照亮并减速丧尸）', cost: { parts: 35 }, req: ['mech'], unlock: ['floodlight'] },
    { id: 'armory', name: '军火工艺', desc: '工作台可制作霰弹枪、步枪和防暴盔甲', cost: { parts: 60 }, req: ['mech'], apply: (m) => { m.craftTier = 3; } },
    { id: 'fort', name: '加固工事', desc: '所有建筑生命 +30%', cost: { parts: 40 }, apply: (m) => { m.hp *= 1.3; } },
  ],

  monsters: {
    walker: { name: '行尸', hp: 30, speed: 0.75, dmg: 8, rate: 1, gold: 0.4, from: 1, weight: 10, color: '#8db36b' },
    runner: { name: '疾跑者', hp: 16, speed: 2.0, dmg: 5, rate: 1.4, gold: 0.4, from: 2, weight: 4, color: '#b13e53' },
    brute: { name: '巨尸', hp: 700, speed: 0.5, dmg: 45, rate: 0.6, gold: 15, scale: 2, boss: true, color: '#5d275d' },
    bandit: { name: '强盗', hp: 45, speed: 1.3, dmg: 7, rate: 1, gold: 3, ranged: 3.5, aggro: 9, color: '#1a1c2c' },
  },
  wave: { baseCount: 8, perNight: 7, growth: 1.1, hpPerNight: 0.25, dmgPerNight: 0.08, bossEvery: 5 },
  perks: null,

  hooks: {
    init() {
      const c = G.core, campId = (G.opt && G.opt.camp) || 'police', camp = ZCAMPS[campId];
      G.camp = { id: campId, craftMul: 1, fullHeal: false, dangerMul: 1 };
      G.player = Object.assign(newPerson('你'), { baseHp: 100, weapon: 'bat', path: [], goal: null, search: null, down: 0 });
      G.player.hp = personMaxHp(G.player);
      G.player.x = c.cx; G.player.y = c.cy + T * 1.5;
      G.survivors = [];
      G.inventory = { 'w:knife': 1 };
      G.stock = null;
      G.res = Object.assign({}, camp.start);
      camp.apply();
      G.player.hp = personMaxHp(G.player);
      refreshAllBuildings();
      G.core.hp = G.core.maxHp;
      G.npcs = [];
      for (let i = 0; i < 6; i++) spawnNpc();
      seedCityZombies();
      G.wanderTimer = 0;
      G.camFollow = true;
    },
    save() {
      return {
        city: 2, camp: G.camp,
        roads: G.roads, natTer: Array.from(G.natTer).join(''), fields: G.fields, crosswalks: G.crosswalks, opt: G.opt, stock: G.stock,
        player: personSave(G.player),
        survivors: G.survivors.map(personSave),
        inventory: G.inventory,
        npcs: G.npcs.map((n) => ({ x: n.x, y: n.y, kind: n.kind, name: n.name, person: n.person ? personSave(n.person) : null })),
        structs: G.structs.map((s) => [s.type, s.x, s.y, s.v, s.left, s.restock, s.home ? 1 : 0]),
        decor: G.decor,
      };
    },
    load(d) {
      G.camp = d.camp; G.opt = d.opt || {}; G.stock = d.stock || null;
      G.player = Object.assign(personLoad(d.player), { path: [], goal: null, search: null, down: 0 });
      G.survivors = d.survivors.map(personLoad);
      placeSurvivors();
      G.inventory = d.inventory || {};
      G.npcs = (d.npcs || []).map((n) => Object.assign({ face: 1 }, n, { person: n.person ? personLoad(n.person) : null }));
      G.structs = [];
      G.structAt = new Int16Array(MAP_W * MAP_H).fill(-1);
      for (const [type, x, y, v, left, restock, home] of d.structs) {
        const sd = STRUCTS[type], si = G.structs.length;
        G.structs.push({ type, x, y, w: sd.w, h: sd.h, v, left, restock, home: !!home });
        for (let yy = y; yy < y + sd.h; yy++) for (let xx = x; xx < x + sd.w; xx++) G.structAt[idx(xx, yy)] = si;
      }
      G.decor = d.decor || [];
      G.roads = d.roads; G.fields = d.fields || []; G.crosswalks = d.crosswalks || [];
      G.natTer = new Uint8Array(MAP_W * MAP_H);
      for (let i = 0; i < G.natTer.length; i++) G.natTer[i] = d.natTer.charCodeAt(i) - 48;
      G.wanderTimer = 0;
      G.camFollow = true;
    },
    update(dt) {
      updatePlayer(dt);
      for (const s of G.survivors) {
        s.hit = Math.max(0, s.hit - dt);
        if (!s.down) personAttack(s, dt, G.mods.survDmg);
      }
      if (G.phase === 'day') {
        G.wanderTimer -= dt;
        if (G.wanderTimer <= 0) {
          G.wanderTimer = 3;
          if (G.monsters.filter((m) => m.wander).length < wanderCap()) spawnWanderer();
        }
      }
    },
    credit(owner, dmg, killed) { zCredit(owner, dmg, killed); },
    monsterAI(m, dt) {
      const p = G.player;
      const pd = p.down > 0 ? 1e9 : Math.hypot(p.x - m.x, p.y - m.y);
      if (m.def.ranged && pd < m.def.ranged * T) {
        m.face = p.x < m.x ? -1 : 1;
        if (m.cd <= 0) {
          m.cd = 1 / m.def.rate;
          hurtPlayer(m.dmg);
          G.effects.push({ type: 'tracer', x: m.x, y: m.y - 8, tx: p.x, ty: p.y - 8, t: 0, life: 0.1 });
        }
        return true;
      }
      if (pd < T * 0.75 * (m.def.scale || 1)) {
        if (m.cd <= 0) { m.cd = 1 / m.def.rate; hurtPlayer(m.dmg); }
        return true;
      }
      for (const s of G.survivors) {
        if (s.down || Math.hypot(s.x - m.x, s.y - m.y) > T * 0.7) continue;
        if (m.cd <= 0) { m.cd = 1 / m.def.rate; hurtSurvivor(s, m.dmg); }
        return true;
      }
      if (m.wander) {
        if (pd < (m.def.aggro || 6) * T) { moveFree(m, p.x, p.y, monsterSpeed(m), dt); return true; }
        const nz = G.noise;
        if (nz && G.clock < nz.until && Math.hypot(nz.x - m.x, nz.y - m.y) < 11 * T) {
          moveFree(m, nz.x, nz.y, monsterSpeed(m), dt);
          return true;
        }
        if (!m.wt || G.clock > m.wtUntil || moveFree(m, m.wt.x, m.wt.y, monsterSpeed(m) * 0.4, dt)) {
          m.wt = { x: m.x + rand(-3, 3) * T, y: m.y + rand(-3, 3) * T };
          m.wtUntil = G.clock + rand(2, 5);
        }
        return true;
      }
      return false;
    },
    night() {
      // 营地附近游荡的丧尸也被吸引过来（远处的继续游荡）
      for (const m of G.monsters) if (m.wander && m.type !== 'bandit' && Math.hypot(m.x - G.core.cx, m.y - G.core.cy) < 18 * T) m.wander = false;
      if (Math.hypot(G.player.x - G.core.cx, G.player.y - G.core.cy) > 8 * T) {
        G.dawnMsg = null;
        addFloat(G.player.x, G.player.y - 20, '天黑了，快回营地！', '#ef7d57', true);
      }
    },
    dawn() {
      const people = allPeople(), msgs = [];
      // 超市库存补给
      if (G.stock && (G.stock.food > 0 || G.stock.water > 0)) {
        const f = Math.min(12, G.stock.food), w = Math.min(12, G.stock.water);
        G.stock.food -= f; G.stock.water -= w;
        G.res.food += f; G.res.water += w;
        msgs.push(G.stock.food + G.stock.water > 0 ? '超市库存补给 食物+' + f + ' 水+' + w : '超市的库存已经耗尽了！');
      }
      const needFood = people.length + people.filter((p) => hasT(p, 'glutton')).length, needWater = people.length;
      const short = G.res.food < needFood || G.res.water < needWater;
      G.res.food = Math.max(0, G.res.food - needFood);
      G.res.water = Math.max(0, G.res.water - needWater);
      for (const p of people) { p.stats.days++; changeMorale(p, short ? -20 : 5); }
      if (short) {
        msgs.push('食物或水不够了！大家士气大跌');
        G.player.hp = Math.max(1, G.player.hp - 15);
      }
      // 士气太低的人会离开
      for (const s of G.survivors.slice()) {
        if (s.morale < 20 && Math.random() < 0.5) {
          G.survivors.splice(G.survivors.indexOf(s), 1);
          if (s.weapon !== 'fists') addItem('w:' + s.weapon);
          if (s.armor !== 'none') addItem('a:' + s.armor);
          msgs.push(s.name + ' 心灰意冷，离开了营地（装备留下了）');
        }
      }
      placeSurvivors();
      // 治疗
      const p = G.player;
      if (p.down > 0) p.down = 0.01;
      const medic = people.some((q) => hasT(q, 'medic'));
      for (const q of allPeople()) {
        const mx = personMaxHp(q);
        if (q !== p && q.down) { q.down = false; q.hp = mx * 0.5; }
        q.hp = Math.min(mx, q.hp + mx * (0.4 + (medic ? 0.25 : 0)));
        if (G.camp.fullHeal) q.hp = mx;
      }
      if (medic) msgs.push('医生为大家处理了伤口');
      // 搜空的建筑过几天会有新物资（其他幸存者留下的、风吹来的……）
      for (const s of G.structs) if (!s.home && s.left <= 0 && s.restock <= G.day) s.left = STRUCTS[s.type].search;
      const add = randInt(1, 3);
      for (let i = 0; i < add && G.npcs.length < 10; i++) spawnNpc();
      msgs.push('今天消耗 食物 ' + needFood + '、水 ' + needWater);
      G.dawnMsg = msgs.join('　');
    },
    onKill(m) {
      if (m.type === 'bandit' && Math.random() < 0.45) {
        const k = randomItem(Math.random() < 0.7 ? 'w' : 'a');
        addItem(k);
        addFloat(m.x, m.y - 20, '缴获：' + itemName(k), '#ffcd75', true);
      }
      if (m.def.boss) allPeople().forEach((p) => changeMorale(p, 10));
    },
    lights() {
      const p = G.player, out = cityLights();
      if (p.down <= 0) out.push({ x: p.x, y: p.y - 6, r: 3 });
      return out;
    },
    hud() {
      const p = G.player, people = allPeople().length;
      const needFood = people + allPeople().filter((q) => hasT(q, 'glutton')).length;
      const pills = [
        { icon: 'heart', text: '生命 ' + Math.ceil(p.hp) + '/' + personMaxHp(p), color: p.hp < personMaxHp(p) * 0.3 ? '#ef7d57' : '#f4f4f4' },
        { icon: 'person', text: '幸存者 ' + people + ' · 床位 ' + G.survivors.length + '/' + zombieHousing() },
        { text: '每日 食物-' + needFood + ' 水-' + people, color: G.res.food < needFood || G.res.water < people ? '#ef7d57' : '#f4f4f4' },
      ];
      if (G.stock && G.stock.food + G.stock.water > 0) pills.push({ text: '超市库存 食物' + G.stock.food + ' 水' + G.stock.water, color: '#73eff7' });
      return pills;
    },
    buildingInfo(b) {
      if (b.def.housing) return '可住 ' + (b.def.housing + b.level - 1) + ' 人（床位 ' + G.survivors.length + '/' + zombieHousing() + '）';
      if (b.type === 'workbench') return '打开「幸存者」→「制作」来制造装备';
      return null;
    },
    extraButtons() { return []; },
    drawUnder(ctx, x0, y0, x1, y1) { drawCity(ctx, x0, y0, x1, y1); },
    drawWorld(ctx) {
      // 陌生人
      for (const n of G.npcs) {
        const spr = n.kind === 'bandit' ? SPR.bandit : n.person ? SPR['zs' + n.person.look] : SPR.stranger;
        drawShadow(ctx, n.x, n.y + 1, 11);
        ctx.drawImage(spr.img, n.x - 8, n.y - 14, 16, 16);
        const bob = Math.sin(G.time * 4) * 1.5;
        drawWorldLabel(ctx, n.kind === 'bandit' ? '!' : '?', n.x, n.y - 18 + bob, n.kind === 'bandit' ? '#ef7d57' : '#ffcd75');
      }
      // 幸存者
      for (const s of G.survivors) {
        const spr = personSprite(s);
        ctx.globalAlpha = s.down ? 0.4 : 1;
        drawShadow(ctx, s.x, s.y + 1, 11);
        ctx.drawImage(s.hit > 0 ? spr.white : (s.face < 0 ? spr.flip : spr.img), s.x - 8, s.y - 14, 16, 16);
        ctx.globalAlpha = 1;
        if (s.hp < personMaxHp(s)) hpBar(ctx, s.x - 5, s.y - 16, 10, s.hp / personMaxHp(s), '#38b764');
      }
      // 移动目标标记
      const mk = G.moveMarker;
      if (mk && G.time - mk.t < 0.6) {
        ctx.strokeStyle = '#ffcd75';
        ctx.lineWidth = 1;
        const r = 3 + (G.time - mk.t) * 8;
        ctx.strokeRect(mk.x - r, mk.y - r, r * 2, r * 2);
      }
      // 玩家
      const p = G.player;
      if (p.down > 0) return;
      const spr = SPR.player;
      const bob = p.moving ? -Math.abs(Math.sin(G.time * 12)) * 1.5 : 0;
      drawShadow(ctx, p.x, p.y + 1, 12);
      ctx.drawImage(p.hit > 0 ? spr.white : (p.face < 0 ? spr.flip : spr.img), p.x - 8, p.y - 14 + bob, 16, 16);
      hpBar(ctx, p.x - 6, p.y - 17, 12, p.hp / personMaxHp(p), '#a7f070');
      if (p.search) hpBar(ctx, p.x - 8, p.y - 21, 16, p.search.t / p.search.dur, '#ffcd75');
    },
  },
};
