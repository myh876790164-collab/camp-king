// =============================================
//  异能系统（丧尸模式，参考末世异能小说）
//  · 丧尸里有一定比例的「变异丧尸」，每种对应一种异能，击杀必掉对应晶核；普通丧尸偶尔掉晶核
//  · 觉醒：前 5 颗晶核决定异能配比（例如 3 力量 2 速度），之后不能更改
//  · 觉醒后只能服用配比里的晶核来升级；配比越高、等级越高，异能越强
//  · 不同异能之间有「化学反应」：同时拥有就会触发组合效果（双系 / 三系）
// =============================================

// 强度 s = 配比份数 × (1 + 0.15 × 等级)，最高 5 × 2.5 = 12.5
const ABIL = {
  power: { name: '力量', color: '#d14a5e', desc: '近战伤害、生命上限提升', info: (s) => '近战伤害 +' + pct(0.12 * s) + '，生命上限 +' + Math.round(8 * s), fx: (a, s) => { a.meleeMul += 0.12 * s; a.hpAdd += 8 * s; } },
  speed: { name: '速度', color: '#73eff7', desc: '移动速度、攻击速度提升', info: (s) => '移动速度 +' + pct(0.05 * s) + '，攻击速度 +' + pct(0.06 * s), fx: (a, s) => { a.moveMul += 0.05 * s; a.rateMul += 0.06 * s; } },
  mind: { name: '智力', color: '#b06cd0', desc: '搜刮更快、物资更多、技能成长快、几率暴击', info: (s) => '搜刮速度 +' + pct(0.1 * s) + '，物资 +' + pct(0.05 * s) + '，技能经验 +' + pct(0.15 * s) + '，暴击率 +' + pct(0.03 * s), fx: (a, s) => { a.searchMul += 0.1 * s; a.lootMul += 0.05 * s; a.xpMul += 0.15 * s; a.crit += 0.03 * s; } },
  tele: { name: '念力', color: '#c8a2ff', desc: '隔空攻击：攻击距离变远，击退敌人', info: (s) => '攻击距离 +' + (0.3 * s).toFixed(1) + ' 格（枪械减半），击退敌人，枪械伤害 +' + pct(0.04 * s), fx: (a, s) => { a.rangeAdd += 0.3 * s; a.knock += 2 * s; a.rangedMul += 0.04 * s; } },
  electric: { name: '电击', color: '#ffe066', desc: '攻击时闪电连锁到附近的丧尸', info: (s) => '闪电连锁 ' + Math.ceil(s / 2.5) + ' 个目标，每个造成 ' + pct(0.3 + 0.04 * s) + ' 伤害', fx: (a, s) => { a.chain += Math.ceil(s / 2.5); a.chainDmg = Math.max(a.chainDmg, 0.3 + 0.04 * s); } },
  fire: { name: '火焰', color: '#ef7d57', desc: '攻击点燃敌人，持续灼烧', info: (s) => '点燃敌人：每秒造成攻击伤害的 ' + pct(0.12 * s) + '，持续 3 秒', fx: (a, s) => { a.burn += 0.12 * s; } },
  ice: { name: '冰冻', color: '#a9e4ff', desc: '攻击使敌人减速，几率冻结', info: (s) => '敌人减速 ' + pct(Math.min(0.75, 0.15 + 0.06 * s)) + '（2 秒），' + pct(0.025 * s) + ' 几率冻结 1.3 秒', fx: (a, s) => { a.slow = Math.max(a.slow, 0.15 + 0.06 * s); a.freeze += 0.025 * s; } },
  heal: { name: '治愈', color: '#a7f070', desc: '持续恢复自己和身边同伴的生命', info: (s) => '自己每秒回复 ' + (0.5 * s).toFixed(1) + ' 生命，4 格内同伴每秒 ' + (0.3 * s).toFixed(1), fx: (a, s) => { a.regen += 0.5 * s; a.healAlly += 0.3 * s; } },
  metal: { name: '金属', color: '#c8ccd8', desc: '金属皮肤：减少受到的伤害，反弹伤害', info: (s) => '受到的伤害 -' + pct(Math.min(0.6, 0.035 * s)) + '，反弹 ' + pct(0.24 * s) + ' 伤害给攻击者', fx: (a, s) => { a.reduce += 0.035 * s; a.thorns += 0.08 * s; } },
  earth: { name: '土石', color: '#c49a64', desc: '岩石护盾：不受伤一会儿后生成护盾吸收伤害', info: (s) => '3 秒不受伤后生成护盾，最多吸收 ' + Math.round(10 * s) + ' 伤害', fx: (a, s) => { a.shieldMax += 10 * s; } },
  wind: { name: '风', color: '#9be0b0', desc: '风刃：近战横扫多个敌人，击退，身法更快', info: (s) => '近战额外横扫 ' + Math.ceil(s / 3) + ' 个敌人（60% 伤害），击退，移动速度 +' + pct(0.02 * s), fx: (a, s) => { a.sweep += Math.ceil(s / 3); a.knock += 1 * s; a.moveMul += 0.02 * s; } },
  water: { name: '水', color: '#41a6f6', desc: '凝聚净水：每天产出水，攻击带水流减速', info: (s) => '每天产出 ' + (1.5 * s).toFixed(1) + ' 份水，敌人减速 ' + pct(0.1 + 0.03 * s), fx: (a, s) => { a.dawnWater += 1.5 * s; a.slow = Math.max(a.slow, 0.1 + 0.03 * s); } },
  wood: { name: '木', color: '#38b764', desc: '藤蔓缠绕定身敌人，每天催生食物', info: (s) => pct(0.035 * s) + ' 几率用藤蔓定身敌人 1.5 秒，每天产出 ' + (1.5 * s).toFixed(1) + ' 份食物', fx: (a, s) => { a.root += 0.035 * s; a.dawnFood += 1.5 * s; } },
  space: { name: '空间', color: '#7a86f0', desc: '空间闪避：几率瞬移躲开攻击；随身空间多带物资', info: (s) => pct(Math.min(0.45, 0.03 * s)) + ' 几率闪避攻击，搜刮物资 +' + pct(0.04 * s), fx: (a, s) => { a.dodge += 0.03 * s; a.lootMul += 0.04 * s; } },
  spirit: { name: '精神', color: '#ff9ad5', desc: '精神控制：几率让丧尸陷入混乱；稳定队伍士气', info: (s) => pct(Math.min(0.4, 0.03 * s)) + ' 几率让丧尸混乱 4 秒，全队每天士气 +' + (0.8 * s).toFixed(1), fx: (a, s) => { a.confuse += 0.03 * s; a.moraleUp += 0.8 * s; } },
};
const ABIL_KEYS = Object.keys(ABIL);
function pct(v) { return Math.round(v * 100) + '%'; }

// ---------- 化学反应：同时拥有这些异能就会触发 ----------
const COMBOS = [
  { id: 'steam', need: ['fire', 'ice'], name: '蒸汽爆裂', desc: '被冰冻减速的敌人再被火焰击中，引发蒸汽爆炸，伤害周围丧尸', fx: (a) => { a.steam = 1; } },
  { id: 'conduct', need: ['electric', 'water'], name: '导电水域', desc: '闪电额外连锁 2 次，被电到的丧尸短暂麻痹', fx: (a) => { a.chain += 2; a.chainStun = 1; } },
  { id: 'firestorm', need: ['fire', 'wind'], name: '烈焰风暴', desc: '风助火势：燃烧会蔓延到身边的丧尸', fx: (a) => { a.burnSpread = 1; } },
  { id: 'blizzard', need: ['ice', 'wind'], name: '暴风雪', desc: '身边 3 格内的丧尸持续被寒风减速', fx: (a) => { a.blizzard = 1; } },
  { id: 'fortress', need: ['earth', 'metal'], name: '钢铁堡垒', desc: '岩石护盾上限翻倍，减伤 +10%', fx: (a) => { a.shieldMax *= 2; a.reduce += 0.1; } },
  { id: 'combo', need: ['power', 'speed'], name: '疾风连击', desc: '25% 几率连续攻击两次', fx: (a) => { a.double += 0.25; } },
  { id: 'quake', need: ['power', 'earth'], name: '震地', desc: '近战命中时震荡周围 1.5 格的丧尸', fx: (a) => { a.quake = 1; } },
  { id: 'psystorm', need: ['tele', 'spirit'], name: '心灵风暴', desc: '每 8 秒释放精神冲击，震晕周围 4 格的丧尸', fx: (a) => { a.psyBlast = 1; } },
  { id: 'puppet', need: ['mind', 'spirit'], name: '傀儡术', desc: '混乱几率翻倍，被控制的丧尸会去攻击同类', fx: (a) => { a.confuse *= 2; a.puppet = 1; } },
  { id: 'lifetree', need: ['heal', 'wood'], name: '生命之树', desc: '治愈覆盖整个营地的同伴，每天额外催生 5 份食物', fx: (a) => { a.campHeal = 1; a.dawnFood += 5; } },
  { id: 'rain', need: ['water', 'wood'], name: '春雨催生', desc: '每天产出的食物和水再 +50%', fx: (a) => { a.dawnMul += 0.5; } },
  { id: 'shadow', need: ['space', 'speed'], name: '瞬影', desc: '闪避几率 +10%，闪避后下一击必定暴击', fx: (a) => { a.dodge += 0.1; a.dodgeCrit = 1; } },
  { id: 'railgun', need: ['electric', 'metal'], name: '电磁炮', desc: '枪械伤害 +40%', fx: (a) => { a.rangedMul += 0.4; } },
  { id: 'lava', need: ['fire', 'earth'], name: '熔岩', desc: '燃烧伤害翻倍', fx: (a) => { a.burn *= 2; } },
  { id: 'zero', need: ['ice', 'water'], name: '绝对零度', desc: '冻结几率 +15%，被冻结的丧尸受到伤害 +50%', fx: (a) => { a.freeze += 0.15; a.frozenBonus += 0.5; } },
  { id: 'swords', need: ['tele', 'metal'], name: '御剑', desc: '念力操控金属飞刃，每 2 秒自动射向附近的丧尸', fx: (a) => { a.blades = 1; } },
  { id: 'overclock', need: ['mind', 'electric'], name: '超频', desc: '神经电流加速，攻击速度 +25%', fx: (a) => { a.rateMul += 0.25; } },
  { id: 'galestep', need: ['wind', 'speed'], name: '疾风步', desc: '移动速度 +25%', fx: (a) => { a.moveMul += 0.25; } },
  { id: 'soothe', need: ['heal', 'spirit'], name: '安抚', desc: '全营地士气每天额外 +8，且不会低于 40', fx: (a) => { a.moraleUp += 8; a.moraleFloor = 40; } },
  { id: 'pocket', need: ['space', 'mind'], name: '随身空间', desc: '搜刮到的物资再 +30%', fx: (a) => { a.lootMul += 0.3; } },
  { id: 'plasma', need: ['fire', 'electric'], name: '等离子', desc: '每次攻击额外对周围造成 30% 伤害', fx: (a) => { a.plasma += 0.3; } },
  { id: 'cyclone', need: ['tele', 'wind'], name: '气旋', desc: '击退距离翻倍，近战横扫 +2', fx: (a) => { a.knock *= 2; a.sweep += 2; } },
  { id: 'regenarmor', need: ['heal', 'metal'], name: '再生甲', desc: '受伤时立刻恢复受到伤害的 25%', fx: (a) => { a.recover += 0.25; } },
  { id: 'elements', need: ['fire', 'ice', 'electric'], name: '元素掌控', desc: '【三系】火、冰、电的所有效果 +50%', fx: (a) => { a.elem += 0.5; } },
  { id: 'wargod', need: ['power', 'speed', 'metal'], name: '战神之躯', desc: '【三系】生命 +30%，所有伤害 +30%', fx: (a) => { a.hpMul += 0.3; a.meleeMul += 0.3; a.rangedMul += 0.3; } },
  { id: 'divine', need: ['space', 'spirit', 'mind'], name: '神识', desc: '【三系】暴击率 +20%，暴击伤害 +50%', fx: (a) => { a.crit += 0.2; a.critMul += 0.5; } },
  { id: 'nature', need: ['heal', 'water', 'wood'], name: '自然之心', desc: '【三系】每秒额外恢复 2 生命，每天食物和水各 +8', fx: (a) => { a.regen += 2; a.dawnFood += 8; a.dawnWater += 8; } },
];

function abBase() {
  return {
    meleeMul: 1, rangedMul: 1, rateMul: 1, moveMul: 1, hpAdd: 0, hpMul: 1, rangeAdd: 0, searchMul: 1, lootMul: 1, xpMul: 1,
    crit: 0, critMul: 1.8, knock: 0, chain: 0, chainDmg: 0, chainStun: 0, burn: 0, burnSpread: 0, slow: 0, freeze: 0, frozenBonus: 0,
    regen: 0, healAlly: 0, campHeal: 0, reduce: 0, thorns: 0, recover: 0, shieldMax: 0, sweep: 0, quake: 0, plasma: 0, steam: 0,
    dodge: 0, dodgeCrit: 0, root: 0, confuse: 0, puppet: 0, double: 0, blizzard: 0, psyBlast: 0, blades: 0, elem: 0,
    dawnFood: 0, dawnWater: 0, dawnMul: 1, moraleUp: 0, moraleFloor: 0, combos: [],
  };
}
function abStrength(p, t) { return p.ab.w[t] * (1 + 0.15 * (p.ab.lv[t] || 0)); }
function abLevel(p) { return p.ab && p.ab.w ? Object.keys(p.ab.w).reduce((n, t) => n + (p.ab.lv[t] || 0), 0) : 0; }
function abRatioText(w) { return Object.keys(w).sort((a, b) => w[b] - w[a]).map((t) => w[t] + ABIL[t].name).join(' '); }

// 算出某人的全部异能加成（有缓存，服用晶核时清掉）
function AB(p) {
  if (!p || !p.ab || !p.ab.w) return null;
  if (p.abCache) return p.abCache;
  const a = abBase();
  for (const t in p.ab.w) ABIL[t].fx(a, abStrength(p, t));
  for (const c of COMBOS) if (c.need.every((t) => p.ab.w[t])) { c.fx(a); a.combos.push(c); }
  // 上限，防止数值失控
  a.moveMul = Math.min(a.moveMul, 1.7); a.rateMul = Math.min(a.rateMul, 1.9); a.dodge = Math.min(a.dodge, 0.45);
  a.reduce = Math.min(a.reduce, 0.6); a.freeze = Math.min(a.freeze, 0.4); a.root = Math.min(a.root, 0.35);
  a.confuse = Math.min(a.confuse, 0.4); a.crit = Math.min(a.crit, 0.5); a.slow = Math.min(a.slow, 0.75); a.double = Math.min(a.double, 0.5);
  p.abCache = a;
  return a;
}

// ---------- 晶核 ----------
const CORES = {};
for (const t of ABIL_KEYS) CORES[t] = { name: ABIL[t].name + '晶核', desc: ABIL[t].desc };

// 服用晶核
function eatCore(p, t) {
  if (!p.ab) p.ab = { cores: [], w: null, lv: {}, xp: {} };
  const ab = p.ab;
  if (ab.w && !ab.w[t]) { showBanner('无法吸收', p.name + ' 的异能配比里没有' + ABIL[t].name + '系', 2, '#ef7d57'); return; }
  if (!takeItem('k:' + t)) return;
  const hpRatio = p.hp / personMaxHp(p);
  if (!ab.w) {
    ab.cores.push(t);
    if (ab.cores.length >= 5) {
      ab.w = {};
      for (const c of ab.cores) ab.w[c] = (ab.w[c] || 0) + 1;
      for (const c in ab.w) { ab.lv[c] = 0; ab.xp[c] = 0; }
      p.abCache = null;
      const combos = (AB(p).combos || []).map((c) => c.name);
      showBanner(p.name + ' 觉醒了！', '异能配比：' + abRatioText(ab.w) + (combos.length ? '　化学反应：' + combos.join('、') : ''), 5, '#ffe066');
      sfx('win');
    } else {
      addFloat(p.x, p.y - 20, '吸收' + CORES[t].name + '（' + ab.cores.length + '/5）', ABIL[t].color, true);
      sfx('coin');
    }
  } else {
    ab.xp[t] = (ab.xp[t] || 0) + 1;
    const need = 2 + ab.lv[t];
    if (ab.xp[t] >= need && ab.lv[t] < 10) {
      ab.xp[t] -= need;
      ab.lv[t]++;
      showBanner(ABIL[t].name + '系异能升到 ' + ab.lv[t] + ' 级', p.name, 2.5, ABIL[t].color);
      sfx('win');
    } else sfx('coin');
  }
  p.abCache = null;
  p.hp = Math.max(1, Math.round(hpRatio * personMaxHp(p)));
}

// ---------- 变异丧尸 ----------
// 每种异能对应一种变异丧尸。ranged = 远程攻击距离（格），on = 打中人时的效果
const SPECIALS = {
  power: { name: '巨力尸', hp: 4, dmg: 2, speed: 0.8 },
  speed: { name: '疾行尸', hp: 1.2, dmg: 1, speed: 2.4 },
  mind: { name: '智尸', hp: 2, dmg: 1, speed: 1, aura: 'command' },
  tele: { name: '念尸', hp: 1.8, dmg: 1, speed: 0.9, ranged: 4, shot: '#c8a2ff', on: 'knock' },
  electric: { name: '雷尸', hp: 1.8, dmg: 1.1, speed: 1, ranged: 4.5, shot: '#ffe066', on: 'stun' },
  fire: { name: '火尸', hp: 1.8, dmg: 1, speed: 1, ranged: 3.5, shot: '#ef7d57', on: 'burn' },
  ice: { name: '冰尸', hp: 2, dmg: 0.9, speed: 0.9, ranged: 3.5, shot: '#a9e4ff', on: 'slow' },
  heal: { name: '愈尸', hp: 2.2, dmg: 0.8, speed: 0.9, aura: 'heal' },
  metal: { name: '铁甲尸', hp: 2.5, dmg: 1.3, speed: 0.8, armor: 0.5 },
  earth: { name: '岩尸', hp: 3, dmg: 1.4, speed: 0.7, armor: 0.7, on: 'slow' },
  wind: { name: '风尸', hp: 1.5, dmg: 1, speed: 1.8, on: 'knock' },
  water: { name: '水尸', hp: 2, dmg: 1, speed: 1, ranged: 3.5, shot: '#41a6f6', on: 'slow', regen: 0.03 },
  wood: { name: '藤尸', hp: 2.2, dmg: 0.9, speed: 0.9, ranged: 4, shot: '#38b764', on: 'root' },
  space: { name: '空间尸', hp: 1.6, dmg: 1.1, speed: 1, blink: true },
  spirit: { name: '魅尸', hp: 1.8, dmg: 0.8, speed: 1, ranged: 4, shot: '#ff9ad5', on: 'weak' },
};
function specialChance() { return Math.min(0.25, 0.05 + G.day * 0.01); }
function makeSpecial(m, t) {
  const s = SPECIALS[t];
  m.special = t;
  m.hp = m.maxHp = m.maxHp * s.hp;
  m.dmg *= s.dmg;
  m.speedMul = s.speed;
  if (s.armor) m.armorMul = s.armor;
  m.scd = rand(0.5, 2);
}
// 刚生成的丧尸：有一定几率变成变异丧尸
function maybeSpecial(m) {
  if (m.type === 'bandit' || m.def.boss || m.special || m.noSpecial) return;
  if (Math.random() < specialChance()) makeSpecial(m, pick(ABIL_KEYS));
}

// 变异丧尸的特殊行动；返回 true 表示这一帧已经行动（不再走默认逻辑）
function specialAI(m, dt, p) {
  const s = SPECIALS[m.special];
  if (!s) return false;
  m.scd -= dt;
  if (s.regen) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * s.regen * dt);
  if (s.aura && m.scd <= 0) {
    m.scd = 2;
    for (const o of G.monsters) {
      if (o === m || !o.alive || Math.hypot(o.x - m.x, o.y - m.y) > 4 * T) continue;
      if (s.aura === 'heal') { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); G.effects.push({ type: 'puff', x: o.x, y: o.y - 6, t: 0, life: 0.4, color: '#a7f070', size: 6 }); }
      else o.buffUntil = G.clock + 2.5; // 智尸指挥：周围丧尸加速
    }
  }
  const pd = !p || p.down > 0 ? 1e9 : Math.hypot(p.x - m.x, p.y - m.y);
  if (s.blink && m.scd <= 0 && pd < 9 * T && pd > 2 * T) {
    // 空间尸：瞬移到玩家身边
    m.scd = 4;
    G.effects.push({ type: 'puff', x: m.x, y: m.y - 6, t: 0, life: 0.4, color: '#7a86f0', size: 10 });
    const a = rand(0, 6.28);
    const nx = p.x + Math.cos(a) * 1.3 * T, ny = p.y + Math.sin(a) * 1.3 * T;
    const solid = G.inLayer ? insideSolidAt(G.inside, nx, ny) : solidAt(nx, ny);
    if (!solid) { m.x = nx; m.y = ny; }
    G.effects.push({ type: 'puff', x: m.x, y: m.y - 6, t: 0, life: 0.4, color: '#7a86f0', size: 10 });
    return true;
  }
  if (s.ranged && pd < s.ranged * T && pd > T && m.scd <= 0) {
    m.scd = 2.2;
    m.face = p.x < m.x ? -1 : 1;
    G.effects.push({ type: 'tracer', x: m.x, y: m.y - 8, tx: p.x, ty: p.y - 8, t: 0, life: 0.15, color: s.shot });
    G.effects.push({ type: 'puff', x: p.x, y: p.y - 6, t: 0, life: 0.3, color: s.shot, size: 6 });
    hurtPlayer(m.dmg * 0.8, m);
    return true;
  }
  return false;
}
// 变异丧尸打中人时的附加效果
function specialOnHit(m, p) {
  const s = m && m.special && SPECIALS[m.special];
  if (!s || !s.on || !p) return;
  const c = G.clock;
  if (s.on === 'burn') { p.burnUntil = c + 3; p.burnDps = m.dmg * 0.25; }
  else if (s.on === 'slow') p.slowUntil = c + 2;
  else if (s.on === 'root') { p.rootUntil = c + 1.2; addFloat(p.x, p.y - 22, '被藤蔓缠住！', '#38b764', true); }
  else if (s.on === 'stun') p.rootUntil = c + 0.6;
  else if (s.on === 'weak') { p.weakUntil = c + 4; changeMorale(p, -2); }
  else if (s.on === 'knock' && p === G.player) {
    const d = Math.hypot(p.x - m.x, p.y - m.y) || 1;
    for (let k = 0; k < 6; k++) {
      const nx = p.x + (p.x - m.x) / d * 3, ny = p.y + (p.y - m.y) / d * 3;
      const solid = G.inLayer ? insideSolidAt(G.inside, nx, ny) : solidAt(nx, ny, true);
      if (solid) break;
      p.x = nx; p.y = ny;
    }
  }
}
// 人身上的负面状态：减速 / 定身 / 灼烧 / 虚弱
function statusSpeedMul(p) {
  if (p.rootUntil > G.clock) return 0;
  return p.slowUntil > G.clock ? 0.5 : 1;
}
function personMoveMul(p) { const a = AB(p); return (a ? a.moveMul : 1) * statusSpeedMul(p); }

// ---------- 掉落 ----------
function dropCores(m) {
  const drops = [];
  if (m.special) { drops.push(m.special); if (Math.random() < 0.3) drops.push(m.special); }
  else if (m.def.boss) { for (let k = 0; k < 3; k++) drops.push(pick(ABIL_KEYS)); }
  else if (m.type !== 'bandit' && Math.random() < 0.06) drops.push(pick(ABIL_KEYS));
  drops.forEach((t, i) => {
    addItem('k:' + t);
    addFloat(m.x, m.y - 14 - i * 10, '获得' + CORES[t].name, ABIL[t].color, true);
  });
}

// ---------- 战斗中的异能效果 ----------
// 攻击前：暴击、冻结增伤、虚弱
const BASE_CRIT = 0.05; // 所有人都有 5% 基础暴击
function abilityDamage(p, m, dmg) {
  const a = AB(p);
  if (p.weakUntil > G.clock) dmg *= 0.7;
  if (a && m.frozenUntil > G.clock) dmg *= 1 + a.frozenBonus;
  p.lastCrit = false;
  if (p.nextCrit || Math.random() < BASE_CRIT + (a ? a.crit : 0)) {
    p.nextCrit = false;
    p.lastCrit = true;
    dmg *= a ? a.critMul : 1.8;
  }
  return dmg;
}
function hitArea(x, y, r, dmg, except, color) {
  for (const o of G.monsters) {
    if (!o.alive || o === except || Math.hypot(o.x - x, o.y - y) > r) continue;
    hurtMonster(o, dmg);
  }
  G.effects.push({ type: 'boom', x, y, t: 0, life: 0.25, size: r * 0.7, color });
}
// 攻击命中后：各种异能效果
function abilityHit(p, m, dmg, melee) {
  const a = AB(p);
  if (!a || !m) return;
  const em = 1 + a.elem, c = G.clock, boss = m.def.boss;
  // 蒸汽爆裂：减速中的敌人被火焰击中
  if (a.steam && a.burn && m.slowUntil > c && m.slowFactor < 0.95) {
    hitArea(m.x, m.y, 1.6 * T, dmg * 0.8 * em, null, '#dff6ff');
    addFloat(m.x, m.y - 18, '蒸汽爆裂', '#dff6ff');
  }
  if (a.burn) {
    m.burnDps = Math.max(m.burnUntil > c ? m.burnDps : 0, dmg * a.burn * em);
    m.burnUntil = c + 3;
    if (a.burnSpread) for (const o of G.monsters) if (o !== m && o.alive && Math.hypot(o.x - m.x, o.y - m.y) < 1.5 * T) { o.burnDps = Math.max(o.burnDps, m.burnDps * 0.6); o.burnUntil = c + 3; }
  }
  if (a.slow) { m.slowUntil = c + 2; m.slowFactor = Math.min(m.slowUntil > c ? m.slowFactor : 1, 1 - Math.min(0.85, a.slow * em)); }
  if (!boss && Math.random() < a.freeze * em) { m.slowUntil = m.frozenUntil = c + 1.3; m.slowFactor = 0.02; }
  if (!boss && Math.random() < a.root) { m.slowUntil = m.rootUntil = c + 1.5; m.slowFactor = 0; }
  if (!boss && Math.random() < a.confuse) { m.confusedUntil = c + 4; addFloat(m.x, m.y - 18, '混乱', '#ff9ad5'); }
  if (a.chain && m) {
    const jumps = a.chain, cd = dmg * a.chainDmg * em;
    let cur = m, hits = [m];
    const pts = [[m.x, m.y - 4]];
    for (let k = 0; k < jumps; k++) {
      let next = null, nd = (2.6 * T) ** 2;
      for (const o of G.monsters) { if (!o.alive || hits.includes(o)) continue; const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d < nd) { nd = d; next = o; } }
      if (!next) break;
      hits.push(next); pts.push([next.x, next.y - 4]);
      hurtMonster(next, cd);
      if (a.chainStun && !next.def.boss) { next.slowUntil = c + 0.5; next.slowFactor = 0.05; }
      cur = next;
    }
    if (pts.length > 1) G.effects.push({ type: 'bolt', pts, t: 0, life: 0.18 });
  }
  if (a.plasma) hitArea(m.x, m.y, 1.2 * T, dmg * a.plasma, m, '#ffe066');
  if (melee && a.quake) hitArea(p.x, p.y, 1.5 * T, dmg * 0.4, m, '#c49a64');
  if (melee && a.sweep) {
    let n = a.sweep;
    for (const o of G.monsters) {
      if (n <= 0) break;
      if (o === m || !o.alive || Math.hypot(o.x - p.x, o.y - p.y) > 1.8 * T) continue;
      hurtMonster(o, dmg * 0.6); n--;
    }
  }
  if (a.knock && !boss && m.alive) {
    const d = Math.hypot(m.x - p.x, m.y - p.y) || 1, dist = Math.min(28, a.knock);
    const nx = m.x + (m.x - p.x) / d * dist, ny = m.y + (m.y - p.y) / d * dist;
    const solid = G.inLayer ? insideSolidAt(G.inside, nx, ny) : solidAt(nx, ny);
    if (!solid) { m.x = nx; m.y = ny; }
  }
}

// 受到攻击时：闪避、护盾、减伤、反伤、再生
function abilityDefend(p, dmg, attacker) {
  const a = AB(p);
  p.lastHurt = G.clock;
  if (!a) return dmg;
  if (Math.random() < a.dodge) {
    addFloat(p.x, p.y - 20, '闪避', '#7a86f0');
    if (a.dodgeCrit) p.nextCrit = true;
    return 0;
  }
  if (p.shield > 0) {
    const used = Math.min(p.shield, dmg);
    p.shield -= used; dmg -= used;
    if (dmg <= 0) return 0;
  }
  dmg *= 1 - a.reduce;
  if (a.thorns && attacker && attacker.alive) hurtMonster(attacker, dmg * a.thorns * 3);
  if (a.recover) p.hp += dmg * a.recover;
  return dmg;
}

// 每帧：回血、护盾、暴风雪、心灵风暴、御剑、负面状态
function abilityTick(p, dt, allies) {
  const c = G.clock;
  if (p.burnUntil > c) {
    p.burnT = (p.burnT || 0) - dt;
    if (p.burnT <= 0) { p.burnT = 0.5; if (p === G.player) hurtPlayer(p.burnDps * 0.5); else hurtSurvivor(p, p.burnDps * 0.5); }
  }
  const a = AB(p);
  if (!a || (p === G.player ? p.down > 0 : p.down)) return;
  const mx = personMaxHp(p);
  if (a.regen) p.hp = Math.min(mx, p.hp + a.regen * dt);
  if (a.healAlly && allies) {
    for (const o of allies) {
      if (o === p || (o === G.player ? o.down > 0 : o.down)) continue;
      if (!a.campHeal && Math.hypot(o.x - p.x, o.y - p.y) > 4 * T) continue;
      o.hp = Math.min(personMaxHp(o), o.hp + a.healAlly * dt);
    }
  }
  if (a.shieldMax && c - (p.lastHurt || 0) > 3) p.shield = Math.min(a.shieldMax, (p.shield || 0) + a.shieldMax * 0.15 * dt);
  p.abT = (p.abT || 0) - dt;
  if (p.abT <= 0) {
    p.abT = 0.5;
    if (a.blizzard) for (const o of G.monsters) if (o.alive && !o.def.boss && Math.hypot(o.x - p.x, o.y - p.y) < 3 * T) { o.slowUntil = c + 0.7; o.slowFactor = Math.min(o.slowFactor, 0.55); }
  }
  p.psyT = (p.psyT || 0) - dt;
  if (a.psyBlast && p.psyT <= 0) {
    const near = G.monsters.filter((o) => o.alive && Math.hypot(o.x - p.x, o.y - p.y) < 4 * T);
    if (near.length) {
      p.psyT = 8;
      for (const o of near) { o.slowUntil = c + 1.5; o.slowFactor = 0; hurtMonster(o, 8 + abLevel(p) * 2); }
      G.effects.push({ type: 'ring', x: p.x, y: p.y - 6, t: 0, life: 0.5, size: 4 * T, color: '#ff9ad5' });
    }
  }
  p.bladeT = (p.bladeT || 0) - dt;
  if (a.blades && p.bladeT <= 0) {
    const [best] = nearestMonsters(p.x, p.y - 4, 5 * T);
    if (best) {
      p.bladeT = 2;
      shoot(p.x, p.y - 10, best, { kind: 'blade', speed: 22 * T, dmg: 8 + abLevel(p) * 2.5, owner: p });
    }
  }
}

// 丧尸混乱时：乱走，或者（傀儡术）去攻击别的丧尸
function confusedAI(m, dt) {
  if (!(m.confusedUntil > G.clock)) return false;
  const puppet = G.player && AB(G.player) && AB(G.player).puppet;
  if (puppet) {
    let t = null, td = 5 * T;
    for (const o of G.monsters) { if (o === m || !o.alive) continue; const d = Math.hypot(o.x - m.x, o.y - m.y); if (d < td) { td = d; t = o; } }
    if (t) {
      if (td < T * 0.8) { if (m.cd <= 0) { m.cd = 1 / m.def.rate; hurtMonster(t, m.dmg * 1.5); } }
      else if (G.inLayer) moveInside(m, t.x, t.y, monsterSpeed(m), dt); else moveFree(m, t.x, t.y, monsterSpeed(m), dt);
      return true;
    }
  }
  if (!m.wt || G.clock > m.wtUntil) { m.wt = { x: m.x + rand(-2, 2) * T, y: m.y + rand(-2, 2) * T }; m.wtUntil = G.clock + 1; }
  if (G.inLayer) moveInside(m, m.wt.x, m.wt.y, monsterSpeed(m) * 0.5, dt); else moveFree(m, m.wt.x, m.wt.y, monsterSpeed(m) * 0.5, dt);
  return true;
}

// ---------- 画：变异丧尸光环 + 状态 ----------
function drawMonsterFx(ctx, m) {
  const c = G.clock;
  if (m.special) {
    const col = ABIL[m.special].color, r = 7 + Math.sin(G.time * 5 + m.bob) * 1.2;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(m.x, m.y + 2, r, r * 0.45, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a1c2c'; ctx.fillRect(m.x - 2, m.y - 21, 4, 4);
    ctx.fillStyle = col; ctx.fillRect(m.x - 1.5, m.y - 20.5, 3, 3);
  }
  if (m.frozenUntil > c) { ctx.fillStyle = 'rgba(169,228,255,0.45)'; ctx.fillRect(m.x - 6, m.y - 14, 12, 15); }
  if (m.rootUntil > c) { ctx.fillStyle = '#38b764'; for (let k = 0; k < 3; k++) ctx.fillRect(m.x - 5 + k * 4, m.y - 4 - k % 2 * 2, 1.5, 6); }
  if (m.confusedUntil > c) drawWorldLabel(ctx, '?', m.x + Math.sin(G.time * 6) * 3, m.y - 20, '#ff9ad5');
}
function specialLabel(m) { return m.special ? SPECIALS[m.special].name : ''; }

// 晶核图标（彩色宝石）
function initAbilitySprites() {
  for (const t of ABIL_KEYS) {
    const c = createCanvas(16, 16), g = c.getContext('2d'), col = ABIL[t].color;
    const [r, gg, b] = hexRgb(col);
    const P = (x, y, w, h, cl) => { g.fillStyle = cl; g.fillRect(x, y, w, h); };
    const poly = (pts, cl) => { g.fillStyle = cl; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
    poly([[8, 0.5], [14.5, 6], [8, 15.5], [1.5, 6]], '#1a1c2c');
    poly([[8, 2], [13, 6], [8, 14], [3, 6]], col);
    poly([[8, 2], [13, 6], [8, 6]], 'rgba(255,255,255,0.45)');
    poly([[3, 6], [8, 14], [8, 6]], 'rgba(0,0,0,0.25)');
    P(6, 4, 1.5, 1.5, '#ffffff');
    SPR['icon_core_' + t] = { w: 8, h: 8, img: c, flip: c, white: c };
    void r; void gg; void b;
  }
}

// ---------- 异能面板 ----------
function drawAbilityTab(ctx, x, y, w, bottom) {
  const people = allPeople();
  if (!G.zSel || !people.includes(G.zSel)) G.zSel = G.player;
  if (G.abGuide) return drawAbilityGuide(ctx, x, y, w, bottom);
  // 选人
  let bx = x;
  for (const p of people) {
    ctx.font = 'bold 12px ' + FONT;
    const label = p.name + (p.ab && p.ab.w ? ' ★' : '');
    const bw = ctx.measureText(label).width + 20;
    if (bx + bw > x + w - 96) break;
    drawButton(ctx, bx, y, bw, 28, label, () => { G.zSel = p; }, { active: p === G.zSel, size: 12, color: p === G.zSel ? '#29366f' : '#333c57' });
    bx += bw + 4;
  }
  drawButton(ctx, x + w - 90, y, 90, 28, '异能图鉴', () => { G.abGuide = true; G.abPage = 0; }, { size: 12, color: '#5d275d' });
  y += 38;
  const p = G.zSel, ab = p.ab;
  const cores = ABIL_KEYS.filter((t) => G.inventory['k:' + t]);
  if (!ab || !ab.w) {
    // 未觉醒：展示已经服用的晶核
    drawText(ctx, p.name + ' · 未觉醒', x, y + 8, 16, '#ffcd75');
    drawText(ctx, '前 5 颗晶核决定异能配比（例如 3 颗力量 + 2 颗速度），确定后不能更改，请谨慎选择', x, y + 30, 12, '#c8d6e5', 'left', false);
    y += 46;
    for (let k = 0; k < 5; k++) {
      const t = ab && ab.cores[k];
      ctx.fillStyle = '#262b44'; ctx.fillRect(x + k * 46, y, 40, 40);
      ctx.strokeStyle = t ? ABIL[t].color : '#566c86'; ctx.lineWidth = 2; ctx.strokeRect(x + k * 46 + 1, y + 1, 38, 38);
      if (t) ctx.drawImage(SPR['icon_core_' + t].img, x + k * 46 + 6, y + 6, 28, 28);
    }
    if (ab && ab.cores.length) {
      const w2 = {};
      for (const c of ab.cores) w2[c] = (w2[c] || 0) + 1;
      drawText(ctx, '当前：' + abRatioText(w2), x + 240, y + 20, 13, '#a7f070', 'left', false);
    }
    y += 52;
  } else {
    drawText(ctx, p.name + ' · 觉醒者 · ' + abRatioText(ab.w), x, y + 8, 16, '#ffe066');
    y += 24;
    const types = Object.keys(ab.w).sort((a, b) => ab.w[b] - ab.w[a]);
    for (const t of types) {
      const A = ABIL[t], lv = ab.lv[t], need = 2 + lv;
      // 当前效果（具体数值）+ 下一级的效果
      const sNow = abStrength(p, t), sNext = ab.w[t] * (1 + 0.15 * (lv + 1));
      const lines = wrapText(ctx, '当前：' + A.info(sNow), w - 46, 11);
      if (lv < 10) lines.push(...wrapText(ctx, '下一级：' + A.info(sNext), w - 46, 11).map((l) => '>' + l));
      const rh = 28 + lines.length * 15;
      ctx.fillStyle = '#262b44'; ctx.fillRect(x, y, w, rh);
      ctx.fillStyle = A.color; ctx.fillRect(x, y, 3, rh);
      ctx.drawImage(SPR['icon_core_' + t].img, x + 6, y + 4, 26, 26);
      drawText(ctx, A.name + ' ×' + ab.w[t] + '　Lv ' + lv + (lv >= 10 ? '（满级）' : ''), x + 38, y + 12, 13, A.color);
      const barW = Math.min(110, w * 0.22), barX = x + w - barW - 92;
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect(barX, y + 14, barW, 5);
      ctx.fillStyle = A.color; ctx.fillRect(barX, y + 14, barW * Math.min(1, (ab.xp[t] || 0) / need), 5);
      drawText(ctx, (ab.xp[t] || 0) + '/' + need, barX + barW / 2, y + 6, 10, '#94b0c2', 'center', false);
      const n = G.inventory['k:' + t] || 0;
      drawButton(ctx, x + w - 86, y + 2, 82, 24, '服用 (' + n + ')', n ? () => eatCore(p, t) : null, { dim: !n, size: 12, color: '#1f5e3a' });
      lines.forEach((ln, k) => { const nx = ln[0] === '>'; drawText(ctx, nx ? ln.slice(1) : ln, x + 38, y + 33 + k * 15, 11, nx ? '#94b0c2' : '#f4f4f4', 'left', false); });
      y += rh + 4;
    }
    // 当前生效的全部增益（配比、等级、化学反应都算进去之后的实际数值）
    y += 4;
    drawText(ctx, '当前增益（实际生效的数值）', x, y + 6, 13, '#ffcd75');
    y = drawBuffChips(ctx, abBuffList(p), x, y + 18, w);
    // 化学反应
    const a = AB(p);
    y += 4;
    drawText(ctx, '化学反应', x, y + 6, 13, '#ffcd75');
    y += 18;
    if (!a.combos.length) { drawText(ctx, '（没有触发组合——配比里有特定的异能搭配才会触发，见「异能图鉴」）', x, y + 6, 11, '#94b0c2', 'left', false); y += 18; }
    for (const c of a.combos) {
      // 名字一行，说明自动换行（手机上也能看全）
      const lines = wrapText(ctx, c.need.map((t) => ABIL[t].name).join(' + ') + '：' + c.desc, w - 16, 11);
      const rh = 20 + lines.length * 15;
      ctx.fillStyle = '#3a2a4a'; ctx.fillRect(x, y, w, rh);
      drawText(ctx, c.name, x + 8, y + 11, 12, '#ffe066');
      lines.forEach((ln, k) => drawText(ctx, ln, x + 8, y + 27 + k * 15, 11, '#f4f4f4', 'left', false));
      y += rh + 4;
    }
    y += 4;
  }
  // 背包里的晶核：服用按钮
  if (!ab || !ab.w) {
    drawText(ctx, '背包里的晶核（点击服用）', x, y + 6, 13, '#ffcd75');
    y += 18;
    if (!cores.length) drawText(ctx, '没有晶核——击杀丧尸有几率掉落，变异丧尸（脚下有彩色光环）必定掉落', x, y + 10, 12, '#94b0c2', 'left', false);
    let ix = x;
    for (const t of cores) {
      const label = CORES[t].name + ' ×' + G.inventory['k:' + t];
      ctx.font = 'bold 12px ' + FONT;
      const bw = ctx.measureText(label).width + 36;
      if (ix + bw > x + w) { ix = x; y += 38; }
      drawButton(ctx, ix, y, bw, 32, '', () => {
        const cur = (p.ab && p.ab.cores) || [];
        if (cur.length === 4) {
          const w2 = {};
          for (const c of cur.concat([t])) w2[c] = (w2[c] || 0) + 1;
          askConfirm('服用后 ' + p.name + ' 的异能配比将确定为「' + abRatioText(w2) + '」，以后不能更改。确定吗？', () => eatCore(p, t));
        } else eatCore(p, t);
      }, { color: '#262b44' });
      ctx.drawImage(SPR['icon_core_' + t].img, ix + 5, y + 5, 22, 22);
      drawText(ctx, label, ix + 30, y + 16, 12, ABIL[t].color);
      ix += bw + 6;
    }
  }
  return y + 44;
}

// 图鉴：15 种异能 + 所有化学反应（分页）
function drawAbilityGuide(ctx, x, y, w, bottom) {
  drawButton(ctx, x, y, 80, 28, '◀ 返回', () => { G.abGuide = false; }, { size: 12 });
  const pages = 3;
  G.abPage = Math.max(0, Math.min(pages - 1, G.abPage || 0));
  drawButton(ctx, x + 86, y, 36, 28, '◀', () => { G.abPage--; }, { size: 12, dim: G.abPage === 0 });
  drawText(ctx, ['15 种异能', '双系化学反应', '三系化学反应 · 变异丧尸'][G.abPage] + '（' + (G.abPage + 1) + '/' + pages + '）', x + 132, y + 14, 13, '#ffcd75');
  drawButton(ctx, x + w - 36, y, 36, 28, '▶', () => { G.abPage++; }, { size: 12, dim: G.abPage === pages - 1 });
  y += 38;
  const cols = w >= 640 ? 2 : 1, cw = (w - (cols - 1) * 8) / cols;
  let items;
  if (G.abPage === 0) items = ABIL_KEYS.map((t) => ({ icon: t, title: ABIL[t].name + '系', color: ABIL[t].color, text: ABIL[t].desc + '。例（3 份配比、5 级）：' + ABIL[t].info(3 * 1.75) }));
  else if (G.abPage === 1) items = COMBOS.filter((c) => c.need.length === 2).map((c) => ({ title: c.name, color: '#ffe066', text: c.need.map((t) => ABIL[t].name).join(' + ') + '：' + c.desc }));
  else items = COMBOS.filter((c) => c.need.length === 3).map((c) => ({ title: c.name, color: '#ffe066', text: c.need.map((t) => ABIL[t].name).join(' + ') + '：' + c.desc }))
    .concat(ABIL_KEYS.map((t) => ({ icon: t, title: SPECIALS[t].name, color: ABIL[t].color, text: '变异丧尸（掉落' + CORES[t].name + '）' })));
  const colY = [y, y];
  items.forEach((it, i) => {
    const col = cols === 2 && colY[1] < colY[0] ? 1 : 0, ix = x + col * (cw + 8), iy = colY[col];
    const tx = ix + (it.icon ? 30 : 8);
    const lines = wrapText(ctx, it.text, cw - (tx - ix) - 8, 11), rh = 22 + lines.length * 15;
    ctx.fillStyle = '#262b44'; ctx.fillRect(ix, iy, cw, rh);
    if (it.icon) ctx.drawImage(SPR['icon_core_' + it.icon].img, ix + 4, iy + 5, 22, 22);
    drawText(ctx, it.title, tx, iy + 11, 12, it.color);
    lines.forEach((ln, k) => drawText(ctx, ln, tx, iy + 27 + k * 15, 11, '#c8d6e5', 'left', false));
    colY[col] = iy + rh + 4;
  });
  return Math.max(colY[0], colY[1]);
}
