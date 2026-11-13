// =============================================
//  建筑、怪物、弹道、特效（所有模式共用）
//  建筑的行为由它在模式配置里的字段决定：
//    attack → 防御塔   gather → 自动采集   produce → 自动生产
//    trap → 陷阱（可踩过）   housing → 住房   happy → 幸福度   heat → 供暖
// =============================================
let nextId = 1;

// ---------- 资源 ----------
function canAfford(cost) {
  for (const k in cost) if ((G.res[k] || 0) < cost[k]) return false;
  return true;
}
function pay(cost) {
  for (const k in cost) G.res[k] -= cost[k];
}

// ---------- 建筑 ----------
function bdef(type) { return G.def.buildings[type]; }
function levelMult(level) { return 1 + CONFIG.UPGRADE_STAT_MULT * (level - 1); }
function countType(type) { return G.buildings.reduce((n, b) => n + (b.type === type ? 1 : 0), 0); }
function hasAny(types) { return types.some((t) => countType(t) > 0); }
function nearType(b, type, r) {
  return G.buildings.some((o) => o.type === type && Math.hypot(o.cx - b.cx, o.cy - b.cy) <= (r + 0.5) * T);
}

function createBuilding(type, x, y) {
  const def = bdef(type);
  const size = def.size || 1;
  const b = {
    id: nextId++, type, def, x, y, size, level: 1, hp: 0, maxHp: 0, cd: 0, hit: 0,
    target: null, idle: false, alive: true, eff: 1,
    cx: (x + size / 2) * T, cy: (y + size / 2) * T,
  };
  refreshBuilding(b);
  b.hp = b.maxHp;
  for (let ty = y; ty < y + size; ty++) for (let tx = x; tx < x + size; tx++) G.bld[idx(tx, ty)] = b;
  G.buildings.push(b);
  if (type === 'core') G.core = b;
  markFlowDirty();
  return b;
}

// 等级或强化变化后重新计算生命上限（保持血量百分比）
function refreshBuilding(b) {
  const ratio = b.maxHp ? b.hp / b.maxHp : 1;
  b.maxHp = Math.round(b.def.hp * levelMult(b.level) * G.mods.hp *
    (b.def.wall || b.def.door ? G.mods.wallHp : 1) * (b.type === 'core' ? G.mods.coreHp : 1));
  b.hp = Math.max(1, ratio * b.maxHp);
}
function refreshAllBuildings() { for (const b of G.buildings) refreshBuilding(b); }

function towerRange(b) { return (b.def.range + 0.3 * (b.level - 1)) * G.mods.range * T; }
function towerDmg(b) {
  const m = G.mods, atk = b.def.attack;
  let d = b.def.dmg * levelMult(b.level) * m.dmg;
  if (b.type === 'core') d *= m.coreDmg;
  if (atk === 'arrow') d *= m.arrowDmg;
  if (atk === 'rock') d *= m.cannonDmg;
  if (b.type === 'tower' && m.lumberTower && nearType(b, 'lumber', 3)) d *= 1 + m.lumberTower;
  if (m.goldPower) d *= 1 + Math.min(0.6, Math.floor((G.res.gold || 0) / 100) * 0.03);
  return d;
}
function towerRate(b) { return b.def.rate * (1 + 0.15 * (b.level - 1)) * G.mods.rate; }
function gatherInterval(b) { return b.def.interval / (levelMult(b.level) * G.mods.gather); }
function produceInterval(b) { return b.def.produce.interval / (levelMult(b.level) * G.mods.prod); }

function upgradeCost(b) {
  const base = b.def.upgrade || b.def.cost || {};
  const m = Math.pow(CONFIG.UPGRADE_COST_MULT, b.level - 1);
  const c = {};
  for (const k in base) c[k] = Math.ceil(base[k] * m);
  const extra = G.def.upgradeExtra;
  if (extra) c[extra] = (c[extra] || 0) + Math.ceil(5 * m);
  return c;
}

function adjacentWater(tx, ty) {
  for (const [dx, dy] of DIRS) if (terrainAt(tx + dx, ty + dy) === TER.WATER) return true;
  return false;
}

// 返回 null 表示可以建造，否则返回原因
function placeProblem(type, tx, ty) {
  if (!inMap(tx, ty)) return '超出地图';
  const i = idx(tx, ty);
  if (G.nodes[i] || G.bld[i]) return '这里不能建造';
  if (G.terrain[i] === TER.WATER) return '不能建在水上';
  if (solidTer(G.terrain[i])) return '这里不能建造';
  if (bdef(type).nearWater && !adjacentWater(tx, ty)) return '必须建在水边';
  if (G.player && Math.floor(G.player.x / T) === tx && Math.floor(G.player.y / T) === ty) return '你站在这里';
  return null;
}

function tryBuild(type, tx, ty) {
  const def = bdef(type);
  const wx = (tx + 0.5) * T, wy = (ty + 0.5) * T;
  const why = placeProblem(type, tx, ty);
  if (why) { addFloat(wx, wy, why, '#ef7d57', true); sfx('bad'); return; }
  if (!canAfford(def.cost)) { addFloat(wx, wy, '资源不足', '#ef7d57', true); sfx('bad'); return; }
  pay(def.cost);
  const b = createBuilding(type, tx, ty);
  addPuff(wx, wy, '#ffcd75', 12);
  sfx('build');
  if (G.def.hooks.onBuild) G.def.hooks.onBuild(b);
}

function upgradeBuilding(b) {
  if (b.level >= CONFIG.MAX_LEVEL) return;
  const cost = upgradeCost(b);
  if (!canAfford(cost)) { addFloat(b.cx, b.cy - 8, '资源不足', '#ef7d57', true); sfx('bad'); return; }
  pay(cost);
  b.level++;
  refreshBuilding(b);
  b.hp = b.maxHp;
  addFloat(b.cx, b.cy - 8, '升级！Lv.' + b.level, '#ffcd75', true);
  addPuff(b.cx, b.cy, '#ffcd75', 14 * b.size);
  sfx('build');
}

function demolishBuilding(b) {
  if (b.type === 'core') return;
  for (const k in b.def.cost) G.res[k] += Math.floor(b.def.cost[k] * CONFIG.DEMOLISH_REFUND);
  b.alive = false;
  removeBuilding(b);
}

function removeBuilding(b) {
  for (let ty = b.y; ty < b.y + b.size; ty++) {
    for (let tx = b.x; tx < b.x + b.size; tx++) G.bld[idx(tx, ty)] = null;
  }
  const i = G.buildings.indexOf(b);
  if (i >= 0) G.buildings.splice(i, 1);
  if (G.selected === b) G.selected = null;
  addPuff(b.cx, b.cy, '#b07a45', 14);
  addParticles(b.cx, b.cy, '#b07a45', 8);
  markFlowDirty();
}

function damageBuilding(b, dmg, attacker) {
  if (!b.alive) return;
  if (attacker) attacker.atkT = G.clock; // 记下：这只怪正在攻击建筑（丧尸模式的同伴会优先去支援）
  b.hp -= dmg;
  b.hit = 0.12;
  if (attacker && (b.def.wall || b.def.door) && G.mods.thorns) hurtMonster(attacker, dmg * G.mods.thorns);
  if (b.hp <= 0) {
    b.alive = false;
    if (b.type === 'core') gameOver(G.def.loseText || '营地被攻破了！');
    else removeBuilding(b);
  }
}

// ---------- 建筑每帧行为 ----------
function updateBuilding(b, dt) {
  b.hit = Math.max(0, b.hit - dt);
  const def = b.def;
  if (def.attack) updateTower(b, dt);
  if (def.gather) updateGatherer(b, dt);
  if (def.produce) updateProducer(b, dt);
  if (def.trap) updateTrap(b, dt);
  if (def.aura) updateAura(b);
  if (def.bp && typeof BP_UPDATE !== 'undefined' && BP_UPDATE[def.bp]) BP_UPDATE[def.bp](b, dt); // 丧尸模式：商人图纸建筑
}

function nearestMonsters(x, y, r) {
  let best = null, bd = r * r, second = null, sd = r * r;
  for (const m of G.monsters) {
    if (!m.alive) continue;
    const dx = m.x - x, dy = m.y - y, d = dx * dx + dy * dy;
    if (d < bd) { second = best; sd = bd; best = m; bd = d; }
    else if (d < sd) { second = m; sd = d; }
  }
  return [best, second];
}

function updateTower(b, dt) {
  if (b.eff <= 0.01) return;
  b.cd -= dt * b.eff;
  if (b.cd > 0) return;
  const [best, second] = nearestMonsters(b.cx, b.cy, towerRange(b));
  if (!best) { b.cd = 0; return; }
  if (b.def.attack === 'chain') {
    chainLightning(b.cx, b.cy - b.size * T * 0.35, best, towerDmg(b), (b.def.chain || 2) + G.mods.chain);
  } else {
    towerShoot(b, best);
    if (b.type === 'tower') for (let k = 0; k < G.mods.multishot; k++) towerShoot(b, second || best);
  }
  b.cd = 1 / towerRate(b);
}

const SHOT_SPEED = { arrow: 16, rock: 9, ice: 12, fire: 12, bullet: 26, seed: 14, frostseed: 13 };
function towerShoot(b, target) {
  const atk = b.def.attack;
  const o = { kind: atk, speed: (SHOT_SPEED[atk] || 16) * T, dmg: towerDmg(b) };
  if (b.def.splash) o.splash = b.def.splash * T * G.mods.range * G.mods.splash;
  if (b.def.slow) o.slow = b.def.slow;
  if (b.def.burn) o.burn = b.def.burn;
  if (atk === 'arrow' && b.type === 'tower' && G.mods.burn) o.burn = 0.4 * G.mods.burn;
  shoot(b.cx, b.cy - b.size * T * 0.35, target, o);
}

function shoot(x, y, target, o) {
  G.projectiles.push(Object.assign({
    x, y, target, tx: target.x, ty: target.y - 4, vx: 0, vy: 0, alive: true,
    kind: 'arrow', speed: 16 * T, dmg: 1, splash: 0,
  }, o));
}

// 闪电：打中第一个后跳到附近的下一个，每跳伤害 -20%
function chainLightning(x, y, first, dmg, jumps) {
  const hits = [first], pts = [[x, y], [first.x, first.y - 4]];
  hurtMonster(first, dmg);
  let cur = first;
  for (let k = 0; k < jumps; k++) {
    let next = null, nd = (2.5 * T) * (2.5 * T);
    for (const m of G.monsters) {
      if (!m.alive || hits.includes(m)) continue;
      const d = (m.x - cur.x) ** 2 + (m.y - cur.y) ** 2;
      if (d < nd) { nd = d; next = m; }
    }
    if (!next) break;
    hits.push(next);
    pts.push([next.x, next.y - 4]);
    hurtMonster(next, dmg * Math.pow(0.8, k + 1));
    cur = next;
  }
  G.effects.push({ type: 'bolt', pts, t: 0, life: 0.18 });
}

function updateGatherer(b, dt) {
  if (b.eff <= 0.01) return;
  b.cd -= dt * b.eff;
  if (b.cd > 0) return;
  b.cd = gatherInterval(b);
  let n = b.target;
  if (!n || n.amount <= 0 || G.nodes[idx(n.x, n.y)] !== n) n = b.target = findNode(b);
  b.idle = !n;
  if (!n) return;
  takeFromNode(n, b.def.amount, b.cx, b.cy - T * 0.6);
}

function findNode(b) {
  const r = b.def.radius;
  let best = null, bd = Infinity;
  for (let y = b.y - r; y <= b.y + r; y++) {
    for (let x = b.x - r; x <= b.x + r; x++) {
      if (!inMap(x, y)) continue;
      const n = G.nodes[idx(x, y)];
      if (!n || n.type !== b.def.gather) continue;
      const d = Math.hypot(x - b.x, y - b.y);
      if (d <= r + 0.5 && d < bd) { bd = d; best = n; }
    }
  }
  return best;
}

function updateProducer(b, dt) {
  if (b.eff <= 0.01) return;
  b.cd -= dt * b.eff;
  if (b.cd > 0) return;
  b.cd = produceInterval(b);
  const p = b.def.produce;
  G.res[p.res] += p.amount;
  addFloat(b.cx, b.cy - T * 0.6, '+' + p.amount, RES_INFO[p.res].color);
}

function updateTrap(b, dt) {
  const dps = b.def.trap * levelMult(b.level) * G.mods.trapDmg;
  for (const m of G.monsters) {
    if (!m.alive || m.def.fly) continue;
    if (Math.abs(m.x - b.cx) < T * 0.6 && Math.abs(m.y - b.cy) < T * 0.6) hurtMonster(m, dps * dt);
  }
}

function updateAura(b) {
  const a = b.def.aura, r2 = (a.radius * T) ** 2;
  for (const m of G.monsters) {
    if ((m.x - b.cx) ** 2 + (m.y - b.cy) ** 2 < r2) {
      const active = m.slowUntil > G.clock ? m.slowFactor : 1;
      m.slowFactor = Math.min(active, a.slow);
      m.slowUntil = Math.max(m.slowUntil, G.clock + 0.2);
    }
  }
}

function takeFromNode(n, amount, fx, fy) {
  const def = G.def.nodes[n.type];
  if (!def.res) return;
  const take = Math.min(amount, n.amount);
  n.amount -= take;
  n.shakeUntil = G.time + 0.15;
  G.res[def.res] += take;
  addFloat(fx, fy, '+' + take, RES_INFO[def.res].color);
  if (n.amount <= 0) removeNode(n);
}

// 玩家点击资源点
function tapNode(n) {
  const def = G.def.nodes[n.type];
  if (!def.res) return;
  const wx = (n.x + 0.5) * T, wy = (n.y + 0.5) * T;
  addParticles(wx, wy, def.res === 'wood' ? '#38b764' : def.res === 'food' ? '#b13e53' : '#94b0c2', 4);
  takeFromNode(n, G.mods.tap, wx, wy - 6);
  sfx('click');
}

// ---------- 怪物 ----------
function spawnMonster(type, x, y, opts) {
  const def = G.def.monsters[type];
  const W = G.def.wave || {};
  const n = G.day;
  const hp = def.hp * (1 + (W.hpPerNight || 0.3) * (n - 1));
  const m = {
    type, def, x, y, hp, maxHp: hp, cd: 0, hit: 0, alive: true, face: 1,
    dmg: def.dmg * (1 + (W.dmgPerNight || 0.1) * (n - 1)),
    ox: rand(-4, 4), oy: rand(-4, 4), bob: rand(0, 6.28),
    slowUntil: 0, slowFactor: 1, burnUntil: 0, burnDps: 0,
  };
  Object.assign(m, opts || {});
  G.monsters.push(m);
  if (G.def.hooks.onSpawn) G.def.hooks.onSpawn(m); // 丧尸模式：几率变成变异丧尸
  return m;
}

function monsterSpeed(m) {
  return m.def.speed * T * (m.slowUntil > G.clock ? m.slowFactor : 1) * (m.speedMul || 1) * (m.buffUntil > G.clock ? 1.4 : 1);
}

function moveMonster(m, tx, ty, dt) {
  const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
  if (d < 0.01) return;
  const step = Math.min(d, monsterSpeed(m) * dt);
  m.x += dx / d * step;
  m.y += dy / d * step;
  if (Math.abs(dx) > 0.5) m.face = dx < 0 ? -1 : 1;
}

// 带碰撞的自由移动（玩家、白天游荡的丧尸）。返回 true 表示已到达
function solidAt(px, py, friendly) {
  const r = 4;
  return isBlocked(Math.floor((px - r) / T), Math.floor((py - r) / T), friendly) ||
    isBlocked(Math.floor((px + r) / T), Math.floor((py - r) / T), friendly) ||
    isBlocked(Math.floor((px - r) / T), Math.floor((py + r) / T), friendly) ||
    isBlocked(Math.floor((px + r) / T), Math.floor((py + r) / T), friendly);
}
function moveFree(e, tx, ty, speed, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt);
  const nx = e.x + dx / d * step, ny = e.y + dy / d * step;
  const fr = !!e.skills; // 有技能的 = 自己人（玩家、幸存者、岛民），可以穿过门
  const stuckBefore = solidAt(e.x, e.y, fr); // 已经卡在障碍里时允许走出来
  if (stuckBefore || !solidAt(nx, e.y, fr)) e.x = nx;
  if (stuckBefore || !solidAt(e.x, ny, fr)) e.y = ny;
  if (Math.abs(dx) > 0.5) e.face = dx < 0 ? -1 : 1;
  return false;
}

function monsterAttack(m, b) {
  if (m.cd > 0) return;
  m.cd = 1 / m.def.rate;
  damageBuilding(b, m.dmg, m);
}

function updateMonster(m, dt) {
  m.hit = Math.max(0, m.hit - dt);
  m.cd -= dt;
  if (m.burnUntil > G.clock) {
    hurtMonster(m, m.burnDps * dt);
    if (!m.alive) return;
  }
  if (G.def.hooks.monsterAI && G.def.hooks.monsterAI(m, dt)) return;

  const core = G.core;
  const reach = T * (m.def.scale || 1) * 0.5;
  // 飞行怪 / 无路可走：直接冲向营地
  const goStraight = () => {
    if (Math.hypot(core.cx - m.x, core.cy - m.y) < T + reach) monsterAttack(m, core);
    else moveMonster(m, core.cx, core.cy, dt);
  };
  if (m.def.fly) { goStraight(); return; }

  const tx = Math.floor(m.x / T), ty = Math.floor(m.y / T);
  if (!inMap(tx, ty)) { goStraight(); return; }
  const i = idx(tx, ty);
  const here = G.bld[i];
  if (here && !here.def.passable) { monsterAttack(m, here); return; }
  const n = G.next[i];
  if (n < 0) { goStraight(); return; }

  const nx = (n % MAP_W + 0.5) * T, ny = (((n / MAP_W) | 0) + 0.5) * T;
  const nb = G.bld[n];
  if (nb && !nb.def.passable) {
    if (Math.hypot(nx - m.x, ny - m.y) < T * 0.95 + reach * 0.5) monsterAttack(m, nb);
    else moveMonster(m, nx, ny, dt);
    return;
  }
  moveMonster(m, nx + m.ox, ny + m.oy, dt);
}

function hurtMonster(m, dmg) {
  if (!m.alive) return;
  if (m.armorMul) dmg *= m.armorMul; // 铁甲尸、岩尸：减伤
  m.hp -= dmg;
  m.hit = Math.max(m.hit, dmg >= 1 ? 0.1 : 0);
  if (m.hp <= 0) {
    m.alive = false;
    G.kills++;
    const kr = G.def.killRes;
    if (kr) {
      G.goldAcc += (m.def.gold || 0) * G.mods.gold;
      const whole = Math.floor(G.goldAcc);
      G.res[kr] += whole;
      G.goldAcc -= whole;
    }
    if (G.def.hooks.onKill) G.def.hooks.onKill(m);
    addParticles(m.x, m.y - 4, m.def.color || '#f4f4f4', m.def.scale ? 16 : 6);
    sfx('hit');
  }
}

function applyHitFx(m, p) {
  if (p.slow) {
    m.slowUntil = G.clock + p.slow.dur * G.mods.slowPow;
    m.slowFactor = Math.max(0.15, 1 - (1 - p.slow.factor) * G.mods.slowPow);
  }
  if (p.burn) {
    m.burnDps = Math.max(m.burnUntil > G.clock ? m.burnDps : 0, p.dmg * p.burn);
    m.burnUntil = G.clock + 3;
  }
}

// ---------- 弹道 ----------
// 子弹由谁打出（丧尸模式记录幸存者的击杀和伤害）
function creditOwner(p, m, wasAlive) {
  if (p.owner && G.def.hooks.credit) G.def.hooks.credit(p.owner, p.dmg, wasAlive && !m.alive, m, p);
}
function updateProjectile(p, dt) {
  if (p.target && p.target.alive) { p.tx = p.target.x; p.ty = p.target.y - 4; }
  const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
  const step = p.speed * dt;
  if (d <= step) {
    p.alive = false;
    if (p.splash) {
      const r2 = p.splash * p.splash;
      for (const m of G.monsters) {
        const ex = m.x - p.tx, ey = m.y - p.ty;
        if (ex * ex + ey * ey < r2) { const was = m.alive; applyHitFx(m, p); hurtMonster(m, p.dmg); creditOwner(p, m, was); }
      }
      G.effects.push({ type: 'boom', x: p.tx, y: p.ty, t: 0, life: 0.3, size: p.splash });
    } else if (p.target && p.target.alive) {
      const was = p.target.alive;
      applyHitFx(p.target, p);
      hurtMonster(p.target, p.dmg);
      creditOwner(p, p.target, was);
    }
    return;
  }
  p.vx = dx / d; p.vy = dy / d;
  p.x += p.vx * step;
  p.y += p.vy * step;
}

// ---------- 特效 ----------
function addPuff(x, y, color, size) {
  G.effects.push({ type: 'puff', x, y, t: 0, life: 0.35, color, size: size || 8 });
}
function addParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    G.effects.push({ type: 'p', x, y, vx: rand(-40, 40), vy: rand(-70, -10), t: 0, life: rand(0.3, 0.6), color });
  }
}
// important = 提示类文字（资源不足等），关闭“飘字”设置时仍然显示
function addFloat(x, y, text, color, important) {
  if (!important && G.settings && !G.settings.floats) return;
  G.floats.push({ x, y, text, color, t: 0, life: 1 });
  if (G.floats.length > 60) G.floats.shift();
}

function updateEffects(dt) {
  for (const e of G.effects) {
    e.t += dt;
    if (e.type === 'p') { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += 200 * dt; }
  }
  G.effects = G.effects.filter((e) => e.t < e.life);
}
