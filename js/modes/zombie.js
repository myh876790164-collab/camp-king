// =============================================
//  模式 3：丧尸求生基地
//  白天：操控角色（WASD / 点地面移动）搜索废墟和汽车、遇到幸存者招募或战斗
//  夜晚：丧尸围攻基地，幸存者站岗射击 + 防御建筑
//  资源：食物、水、零件；武器装备可以搜到或在工作台制作
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
const SURVIVOR_NAMES = ['老王', '小李', '阿强', '莉莉', '老陈', '小芳', '大刘', '杰克', '安娜', '阿杰', '小雨', '老赵', '阿伟', '萍姐', '小白', '铁柱'];

function itemTable(key) { return key[0] === 'w' ? WEAPONS : ARMORS; }
function itemName(key) { return itemTable(key)[key.slice(2)].name; }
function addItem(key, n) { G.inventory[key] = (G.inventory[key] || 0) + (n || 1); }
function personMaxHp(p) { return p.baseHp + ARMORS[p.armor].hp; }
function zombieHousing() {
  return G.buildings.reduce((n, b) => n + (b.def.housing ? b.def.housing + (b.level - 1) : 0), 0);
}

function weaponStatText(id) {
  const w = WEAPONS[id];
  return w.name + '：伤害 ' + w.dmg + ' 射程 ' + w.range + ' 攻速 ' + w.rate + (w.splash ? ' 范围' : '') + (w.melee ? ' 近战' : '');
}

function randomItem(kind) {
  const tbl = kind === 'w' ? WEAPONS : ARMORS;
  const maxTier = Math.min(3, 1 + Math.floor(G.day / 3));
  const pool = Object.keys(tbl).filter((k) => tbl[k].tier && tbl[k].tier <= maxTier);
  return kind + ':' + pick(pool);
}

// ---------- 幸存者 ----------
function addSurvivor(name) {
  G.survivors.push({ name, baseHp: 70, hp: 70, weapon: 'fists', armor: 'none', cd: 0, down: false, x: 0, y: 0, face: 1, hit: 0 });
  placeSurvivors();
}
function placeSurvivors() {
  const c = G.core, n = G.survivors.length;
  G.survivors.forEach((s, i) => {
    const a = i / Math.max(1, n) * Math.PI * 2 + 0.4;
    s.x = c.cx + Math.cos(a) * 2.3 * T;
    s.y = c.cy + Math.sin(a) * 2.0 * T + 6;
  });
}

function personAttack(p, dt, mult) {
  p.cd -= dt;
  if (p.cd > 0) return;
  const w = WEAPONS[p.weapon];
  const [best] = nearestMonsters(p.x, p.y - 4, w.range * T);
  if (!best) { p.cd = 0; return; }
  const dmg = w.dmg * mult;
  if (w.melee) {
    hurtMonster(best, dmg);
    G.effects.push({ type: 'swing', x: p.x, y: p.y - 6, tx: best.x, ty: best.y - 4, t: 0, life: 0.15 });
  } else {
    shoot(p.x, p.y - 8, best, { kind: 'bullet', speed: 26 * T, dmg, splash: w.splash ? w.splash * T : 0 });
  }
  p.face = best.x < p.x ? -1 : 1;
  p.cd = 1 / w.rate;
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
    showBanner('你被击倒了！', '3 秒后在避难所醒来', 3, '#ef7d57');
    sfx('bad');
  }
}
function hurtSurvivor(s, dmg) {
  s.hp -= dmg;
  s.hit = 0.12;
  if (s.hp <= 0) {
    s.hp = 0; s.down = true;
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
  const speed = 3.6 * T;
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
      if (p.search.t >= p.search.dur) { finishSearch(p.search.node); p.search = null; }
    }
  }
  personAttack(p, dt, 1);
}

// 点地图：走过去；点到废墟/汽车就搜索，点到陌生人就对话
function playerTap(tx, ty, wx, wy) {
  const p = G.player;
  if (p.down > 0) return;
  let goal = null;
  const npc = G.npcs.find((n) => Math.hypot(n.x - wx, n.y - wy) < T * 0.8);
  const node = inMap(tx, ty) ? G.nodes[idx(tx, ty)] : null;
  if (npc) { goal = { npc }; tx = Math.floor(npc.x / T); ty = Math.floor(npc.y / T); }
  else if (node && G.def.nodes[node.type].search) goal = { node };
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
  return Math.hypot((g.node.x + 0.5) * T - p.x, (g.node.y + 0.5) * T - p.y) < T * 1.7;
}

function reachGoal(g) {
  if (!goalInReach(g)) return;
  if (g.npc) { if (G.npcs.includes(g.npc)) openNpcDialog(g.npc); return; }
  const n = g.node;
  if (G.nodes[idx(n.x, n.y)] !== n) return;
  if (n.searchedUntil > G.day) { addFloat(G.player.x, G.player.y - 18, '刚搜过，过几天再来', '#94b0c2', true); return; }
  G.player.search = { node: n, t: 0, dur: n.type === 'car' ? 1.5 : 1.2 };
}

function finishSearch(n) {
  const got = [];
  const add = (res, k) => { if (k > 0) { G.res[res] += k; got.push(RES_INFO[res].name + ' +' + k); } };
  if (n.type === 'car') {
    add('parts', randInt(3, 7));
    if (Math.random() < 0.3) add('water', randInt(1, 3));
    removeNode(n);
  } else {
    if (Math.random() < 0.7) add('food', randInt(3, 8));
    if (Math.random() < 0.55) add('water', randInt(2, 6));
    if (Math.random() < 0.45) add('parts', randInt(1, 4));
    const r = Math.random();
    if (r < 0.15) { const k = randomItem('w'); addItem(k); got.push('武器：' + itemName(k)); showBanner('找到武器：' + itemName(k), '在「装备」里给自己或幸存者装上', 3, '#ffcd75'); }
    else if (r < 0.24) { const k = randomItem('a'); addItem(k); got.push('护甲：' + itemName(k)); showBanner('找到护甲：' + itemName(k), '在「装备」里给自己或幸存者装上', 3, '#ffcd75'); }
    n.searchedUntil = G.day + 3;
  }
  if (!got.length) got.push('什么也没找到……');
  const p = G.player;
  got.forEach((t, i) => addFloat(p.x, p.y - 18 - i * 11, t, '#ffcd75', true));
  sfx('coin');
}

// ---------- 陌生人 / 强盗 ----------
function spawnNpc() {
  for (let tries = 0; tries < 60; tries++) {
    const x = randInt(1, MAP_W - 2), y = randInt(1, MAP_H - 2);
    if (isBlocked(x, y) || distToCore(x, y) < 9) continue;
    const banditChance = Math.min(0.5, 0.25 + G.day * 0.02);
    G.npcs.push({ x: (x + 0.5) * T, y: (y + 0.5) * T, kind: Math.random() < banditChance ? 'bandit' : 'friendly', name: pick(SURVIVOR_NAMES), face: 1 });
    return;
  }
}
function removeNpc(n) { G.npcs = G.npcs.filter((o) => o !== n); }

function spawnBandits(x, y, count) {
  for (let i = 0; i < count; i++) {
    spawnMonster('bandit', x + rand(-10, 10), y + rand(-10, 10), { wander: true });
  }
}

function openNpcDialog(npc) {
  if (npc.kind === 'friendly') {
    const full = G.survivors.length >= zombieHousing();
    const cost = { food: 8, water: 8 };
    G.dialog = {
      title: '遇到幸存者「' + npc.name + '」',
      text: '对方看起来又累又饿，警惕地打量着你。',
      options: [
        {
          label: full ? '招募（床位已满，先建宿舍）' : '招募入伙（食物 8、水 8）',
          disabled: full || !canAfford(cost),
          action: () => {
            pay(cost); addSurvivor(npc.name); removeNpc(npc);
            showBanner(npc.name + ' 加入了营地！', '在「装备」里给 TA 发武器，晚上会帮你守营地', 4, '#a7f070');
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
            removeNpc(npc);
          },
        },
      ],
    };
  }
  G.state = 'dialog';
  sfx('click');
}

function spawnWanderer() {
  const p = G.player;
  for (let tries = 0; tries < 40; tries++) {
    const x = randInt(1, MAP_W - 2), y = randInt(1, MAP_H - 2);
    if (isBlocked(x, y) || distToCore(x, y) < 10) continue;
    if (Math.hypot((x + 0.5) * T - p.x, (y + 0.5) * T - p.y) < 10 * T) continue;
    const type = G.day >= 2 && Math.random() < 0.3 ? 'runner' : 'walker';
    spawnMonster(type, (x + 0.5) * T, (y + 0.5) * T, { wander: true });
    return;
  }
}

// ---------- 装备 ----------
function equipItem(person, key) {
  if (!G.inventory[key]) return;
  const id = key.slice(2);
  G.inventory[key]--;
  if (!G.inventory[key]) delete G.inventory[key];
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
function craftItem(key) {
  const it = itemTable(key)[key.slice(2)];
  if (!canAfford(it.craft)) { showBanner('零件不足', '', 1.5, '#ef7d57'); sfx('bad'); return; }
  pay(it.craft);
  addItem(key);
  showBanner('制作完成：' + it.name, '', 2, '#ffcd75');
  sfx('build');
}

function drawEquipPanel(ctx) {
  const sw = G.sw, sh = G.sh;
  ctx.fillStyle = 'rgba(10,10,30,0.7)';
  ctx.fillRect(0, 0, sw, sh);
  addButton(0, 0, sw, sh, null);
  const pw = Math.min(600, sw - 16), px = (sw - pw) / 2, top = 8, bottom = sh - 8;
  drawPanel(ctx, px, top, pw, bottom - top);
  drawText(ctx, '装备与制作', px + 14, top + 22, 18, '#ffcd75');
  drawButton(ctx, px + pw - 44, top + 8, 36, 30, '✕', () => { G.state = 'play'; }, { size: 14 });
  const tab = G.equipTab || 'equip';
  drawButton(ctx, px + 12, top + 46, 110, 30, '背包装备', () => { G.equipTab = 'equip'; }, { active: tab === 'equip', size: 13 });
  drawButton(ctx, px + 128, top + 46, 110, 30, '制作', () => { G.equipTab = 'craft'; }, { active: tab === 'craft', size: 13 });
  let y = top + 88;

  if (tab === 'equip') {
    const people = [G.player].concat(G.survivors);
    G.equipSel = Math.max(0, Math.min(people.length - 1, G.equipSel || 0));
    const cols = pw >= 480 ? 2 : 1, cw = (pw - 24 - (cols - 1) * 6) / cols, ch = 44;
    people.forEach((p, i) => {
      const cx = px + 12 + (i % cols) * (cw + 6), cy = y + Math.floor(i / cols) * (ch + 6);
      drawButton(ctx, cx, cy, cw, ch, '', () => { G.equipSel = i; }, { active: i === G.equipSel, color: i === G.equipSel ? '#29366f' : '#333c57' });
      const down = p === G.player ? p.down > 0 : p.down;
      drawText(ctx, p.name + (down ? '（倒下）' : ''), cx + 10, cy + 14, 13, down ? '#ef7d57' : '#ffcd75');
      drawText(ctx, '生命 ' + Math.ceil(p.hp) + '/' + personMaxHp(p), cx + cw - 8, cy + 14, 11, '#c8d6e5', 'right', false);
      drawText(ctx, WEAPONS[p.weapon].name + ' · ' + ARMORS[p.armor].name, cx + 10, cy + 32, 12, '#f4f4f4', 'left', false);
    });
    y += Math.ceil(people.length / cols) * (ch + 6) + 6;
    const sel = people[G.equipSel];
    drawText(ctx, '当前：' + weaponStatText(sel.weapon), px + 14, y + 8, 12, '#c8d6e5', 'left', false);
    y += 22;
    drawButton(ctx, px + 12, y, 100, 28, '卸下武器', () => unequip(sel, 'w'), { size: 12, dim: sel.weapon === 'fists' });
    drawButton(ctx, px + 118, y, 100, 28, '卸下护甲', () => unequip(sel, 'a'), { size: 12, dim: sel.armor === 'none' });
    y += 40;
    drawText(ctx, '背包（点击装备给上面选中的人）', px + 14, y, 13, '#ffcd75');
    y += 16;
    const keys = Object.keys(G.inventory);
    if (!keys.length) drawText(ctx, '空空如也——去废墟里找找，或者用工作台制作', px + 14, y + 14, 12, '#94b0c2', 'left', false);
    let ix = px + 12;
    for (const k of keys) {
      const label = itemName(k) + ' ×' + G.inventory[k];
      ctx.font = 'bold 12px ' + FONT;
      const w = ctx.measureText(label).width + 24;
      if (ix + w > px + pw - 12) { ix = px + 12; y += 36; }
      drawButton(ctx, ix, y, w, 30, label, () => equipItem(sel, k), { size: 12, color: k[0] === 'w' ? '#5d275d' : '#257179' });
      ix += w + 6;
    }
  } else {
    if (!countType('workbench')) {
      drawText(ctx, '需要先建造「工作台」才能制作', px + 14, y + 10, 14, '#ef7d57');
      return;
    }
    const list = [];
    for (const k in WEAPONS) if (WEAPONS[k].craft) list.push('w:' + k);
    for (const k in ARMORS) if (ARMORS[k].craft) list.push('a:' + k);
    const rowH = 38, maxRows = Math.floor((bottom - y - 8) / (rowH + 4));
    list.slice(0, maxRows).forEach((k, i) => {
      const it = itemTable(k)[k.slice(2)], ry = y + i * (rowH + 4);
      const locked = it.tier > G.mods.craftTier;
      drawButton(ctx, px + 12, ry, pw - 24, rowH, '', () => { if (!locked) craftItem(k); }, { dim: locked });
      const info = k[0] === 'w' ? '伤害 ' + it.dmg + ' 射程 ' + it.range + (it.melee ? ' 近战' : '') : '生命 +' + it.hp;
      drawText(ctx, it.name, px + 24, ry + rowH / 2, 14, locked ? '#94b0c2' : '#ffcd75');
      drawText(ctx, locked ? '需要研究「军火工艺」' : info, px + 110, ry + rowH / 2, 12, '#c8d6e5', 'left', false);
      if (!locked) drawCost(ctx, it.craft, px + pw - 60, ry + rowH / 2, 90, 12);
    });
  }
}

MODES.zombie = {
  id: 'zombie',
  name: '丧尸求生基地',
  tag: 'RPG 探索 · 招募 · 守夜',
  icon: 'walker',
  desc: '丧尸爆发后的城市。白天操控角色搜索废墟、收集物资、招募幸存者；夜晚尸潮来袭，幸存者和防御工事一起守护基地。',
  intro: 'WASD 或点地面移动。点废墟/汽车搜索物资，点陌生人对话。天黑前回到基地！',
  resources: ['food', 'water', 'parts'],
  startRes: { food: 20, water: 20, parts: 15 },
  dayTime: 75,
  nightSpawnTime: 35,
  hasNights: true,
  killRes: 'parts',
  upgradeExtra: 'parts',
  tapGather: false,
  coreSprite: 'core_zombie',
  fire: null,
  loseText: '避难所被丧尸攻破了！',
  groundColors: { [TER.GRASS]: ['#5f6b45', '#56603e', '#6b774e'] },
  noFlowers: true,

  nodes: {
    ruin: { name: '废弃房屋', search: true, amount: 1 },
    car: { name: '废弃汽车', search: true, onRoad: true, amount: 1, regrow: 3 },
    deadtree: { name: '枯树', amount: 1 },
  },

  mapGen() {
    const hRoads = [7, 8, 27, 28], vRoads = [9, 10, 37, 38];
    for (let x = 0; x < MAP_W; x++) for (const y of hRoads) G.terrain[idx(x, y)] = TER.ROAD;
    for (let y = 0; y < MAP_H; y++) for (const x of vRoads) G.terrain[idx(x, y)] = TER.ROAD;
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        if (G.terrain[idx(x, y)] === TER.ROAD) continue;
        const nearRoad = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => terrainAt(x + dx, y + dy) === TER.ROAD);
        if (nearRoad && Math.random() < 0.2) placeNode('ruin', x, y, 6);
      }
    }
    for (let i = 0; i < 14; i++) placeNode('ruin', randInt(1, MAP_W - 2), randInt(1, MAP_H - 2), 7);
    for (let i = 0; i < 60; i++) placeNode('car', randInt(1, MAP_W - 2), randInt(1, MAP_H - 2), 5);
    scatterNodes('deadtree', 6, 4, 2);
    scatterNearCore('ruin', 3, rand(0, 6.28), 1.5);
  },

  buildList: ['barricade', 'bunk', 'collector', 'workbench', 'vegfarm', 'spikes', 'turret', 'floodlight'],
  buildings: {
    core: {
      name: '避难所', size: 2, hp: 800, attack: 'bullet', range: 4, dmg: 6, rate: 1, housing: 2, light: 5,
      upgrade: { parts: 30, food: 10, water: 10 }, desc: '被攻破就输了，升级可多住 1 人',
    },
    barricade: { name: '路障', hp: 250, cost: { parts: 4 }, wall: true, desc: '阻挡丧尸' },
    bunk: { name: '宿舍', hp: 120, cost: { parts: 12, food: 5 }, housing: 2, desc: '可多招募 2 名幸存者' },
    collector: { name: '集水器', hp: 80, cost: { parts: 15 }, produce: { res: 'water', amount: 1, interval: 5 }, desc: '收集雨水' },
    workbench: { name: '工作台', hp: 120, cost: { parts: 20 }, desc: '可以在「装备」里制作武器护甲' },
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
      const c = G.core;
      G.player = {
        name: '你', x: c.cx, y: c.cy + T * 1.5, baseHp: 100, hp: 100, weapon: 'bat', armor: 'none',
        cd: 0, path: [], goal: null, search: null, face: 1, down: 0, hit: 0,
      };
      G.survivors = [];
      G.inventory = { 'w:knife': 1 };
      G.npcs = [];
      for (let i = 0; i < 4; i++) spawnNpc();
      G.wanderTimer = 0;
      G.camFollow = true;
    },
    save() {
      const p = G.player;
      return {
        player: { x: p.x, y: p.y, hp: p.hp, weapon: p.weapon, armor: p.armor },
        survivors: G.survivors.map((s) => ({ name: s.name, hp: s.hp, weapon: s.weapon, armor: s.armor, down: s.down })),
        inventory: G.inventory,
        npcs: G.npcs.map((n) => ({ x: n.x, y: n.y, kind: n.kind, name: n.name })),
      };
    },
    load(d) {
      MODES.zombie.hooks.init.call(null, true);
      G.npcs = [];
      Object.assign(G.player, d.player);
      G.survivors = d.survivors.map((s) => Object.assign({ baseHp: 70, cd: 0, x: 0, y: 0, face: 1, hit: 0 }, s));
      placeSurvivors();
      G.inventory = d.inventory || {};
      G.npcs = (d.npcs || []).map((n) => Object.assign({ face: 1 }, n));
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
          G.wanderTimer = 4;
          const want = Math.min(30, 4 + G.day * 2);
          if (G.monsters.filter((m) => m.wander).length < want) spawnWanderer();
        }
      }
    },
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
        if (!m.wt || G.clock > m.wtUntil || moveFree(m, m.wt.x, m.wt.y, monsterSpeed(m) * 0.4, dt)) {
          m.wt = { x: m.x + rand(-3, 3) * T, y: m.y + rand(-3, 3) * T };
          m.wtUntil = G.clock + rand(2, 5);
        }
        return true;
      }
      return false;
    },
    night() {
      for (const m of G.monsters) m.wander = false; // 白天游荡的丧尸也被吸引过来
      if (Math.hypot(G.player.x - G.core.cx, G.player.y - G.core.cy) > 8 * T) {
        G.dawnMsg = null;
        addFloat(G.player.x, G.player.y - 20, '天黑了，快回基地！', '#ef7d57', true);
      }
    },
    dawn() {
      const people = 1 + G.survivors.length, msgs = [];
      const short = G.res.food < people || G.res.water < people;
      G.res.food = Math.max(0, G.res.food - people);
      G.res.water = Math.max(0, G.res.water - people);
      if (short) {
        msgs.push('食物或水不够了！');
        if (G.survivors.length) {
          const s = G.survivors.splice(randInt(0, G.survivors.length - 1), 1)[0];
          msgs.push(s.name + ' 饿得受不了，离开了营地');
          placeSurvivors();
        } else {
          G.player.hp = Math.max(1, G.player.hp - 30);
          msgs.push('你饿得头晕眼花（生命 -30）');
        }
      }
      const p = G.player;
      if (p.down > 0) p.down = 0.01;
      p.hp = Math.min(personMaxHp(p), p.hp + personMaxHp(p) * 0.4);
      for (const s of G.survivors) {
        if (s.down) { s.down = false; s.hp = personMaxHp(s) * 0.5; }
        else s.hp = Math.min(personMaxHp(s), s.hp + personMaxHp(s) * 0.5);
      }
      const add = randInt(1, 2);
      for (let i = 0; i < add && G.npcs.length < 6; i++) spawnNpc();
      msgs.push('今天消耗 食物 ' + people + '、水 ' + people);
      G.dawnMsg = msgs.join('　');
    },
    onKill(m) {
      if (m.type === 'bandit' && Math.random() < 0.45) {
        const k = randomItem(Math.random() < 0.7 ? 'w' : 'a');
        addItem(k);
        addFloat(m.x, m.y - 20, '缴获：' + itemName(k), '#ffcd75', true);
      }
    },
    lights() {
      const p = G.player;
      return p.down > 0 ? [] : [{ x: p.x, y: p.y - 6, r: 3 }];
    },
    hud() {
      const p = G.player, cap = zombieHousing(), people = 1 + G.survivors.length;
      return [
        { icon: 'heart', text: '生命 ' + Math.ceil(p.hp) + '/' + personMaxHp(p), color: p.hp < personMaxHp(p) * 0.3 ? '#ef7d57' : '#f4f4f4' },
        { icon: 'person', text: '幸存者 ' + G.survivors.length + '/' + cap },
        { text: '每日 食物-' + people + ' 水-' + people, color: G.res.food < people || G.res.water < people ? '#ef7d57' : '#f4f4f4' },
      ];
    },
    buildingInfo(b) {
      if (b.def.housing) return '可住 ' + (b.def.housing + b.level - 1) + ' 人（现有幸存者 ' + G.survivors.length + '/' + zombieHousing() + '）';
      if (b.type === 'workbench') return '打开「装备」→「制作」来制造武器护甲';
      return null;
    },
    drawWorld(ctx) {
      // 陌生人
      for (const n of G.npcs) {
        const spr = SPR[n.kind === 'bandit' ? 'bandit' : 'stranger'];
        ctx.drawImage(spr.img, Math.round(n.x - 8), Math.round(n.y - 14));
        const bob = Math.sin(G.time * 4) * 1.5;
        drawWorldLabel(ctx, n.kind === 'bandit' ? '!' : '?', n.x, n.y - 18 + bob, n.kind === 'bandit' ? '#ef7d57' : '#ffcd75');
      }
      // 幸存者
      for (const s of G.survivors) {
        const spr = SPR.survivor;
        ctx.globalAlpha = s.down ? 0.4 : 1;
        ctx.drawImage(s.hit > 0 ? spr.white : (s.face < 0 ? spr.flip : spr.img), Math.round(s.x - 8), Math.round(s.y - 14));
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
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(p.x - 5, p.y + 1, 10, 2);
      ctx.drawImage(p.hit > 0 ? spr.white : (p.face < 0 ? spr.flip : spr.img), Math.round(p.x - 8), Math.round(p.y - 14 + bob));
      hpBar(ctx, p.x - 6, p.y - 17, 12, p.hp / personMaxHp(p), '#a7f070');
      if (p.search) {
        hpBar(ctx, p.x - 8, p.y - 21, 16, p.search.t / p.search.dur, '#ffcd75');
      }
    },
  },
};
