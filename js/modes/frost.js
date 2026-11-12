// =============================================
//  模式 4：极寒求生
//  营地中心是熔炉：每 4 秒烧掉“炉火等级”份燃料（1 煤 = 3 份，1 木 = 1 份）
//  某处温度 = 室外温度 + 熔炉热量（离熔炉越远越弱）+ 附近加热器
//  温度 ≥ 0°C 效率 100%，-30°C 只剩 25%，影响采集、生产和防御塔攻速
// =============================================
const FROST_TICK = 4;

function frostOutsideTemp() {
  return -6 - (G.day - 1) * 1.5 - G.dark * 12 - (G.blizzard ? 12 : 0);
}
function furnaceLevel() { return G.furnace.out ? 0 : G.furnace.level; }

function frostTempAt(wx, wy) {
  let t = frostOutsideTemp() + G.mods.warm;
  const c = G.core;
  const d = Math.hypot(wx - c.cx, wy - c.cy) / T;
  const fall = d <= 5 ? 1 : d >= 13 ? 0 : (13 - d) / 8;
  t += furnaceLevel() * 12 * G.mods.heatMul * (1 + 0.15 * (c.level - 1)) * fall;
  for (const b of G.buildings) {
    if (!b.def.heat || !b.heaterOn) continue;
    const hd = Math.hypot(wx - b.cx, wy - b.cy) / T;
    if (hd <= b.def.heat.radius) t += b.def.heat.amount * levelMult(b.level);
  }
  return t;
}

function frostEfficiency(temp) {
  let e = temp >= 0 ? 1 + Math.min(0.1, temp / 100) : Math.max(0.25, 1 + temp / 40);
  if (e < 1) e = 1 - (1 - e) * (1 - G.mods.coldResist);
  return e;
}

const FROST_PERKS = [
  { name: '炉心强化', desc: '熔炉热量 +30%', apply: (m) => { m.heatMul *= 1.3; } },
  { name: '节能燃烧', desc: '熔炉燃料消耗 -30%', max: 2, apply: (m) => { m.fuelMul *= 0.7; } },
  { name: '耐寒体质', desc: '低温造成的效率下降减半', max: 1, apply: (m) => { m.coldResist = 0.5; } },
  { name: '保暖衣物', desc: '所有地方温度 +4°C', apply: (m) => { m.warm += 4; } },
  { name: '燃烧之箭', desc: '【箭塔】箭矢附带燃烧', needs: ['tower'], max: 2, apply: (m) => { m.burn += 1; } },
];

MODES.frost = {
  id: 'frost',
  name: '极寒求生',
  tag: '塔防 · 生存 · 温度管理',
  icon: 'pine',
  desc: '冰封大地上，熔炉是唯一的希望。保持炉火燃烧，温度太低时一切都会变慢；夜晚还有冰原怪物来袭。',
  intro: '熔炉需要燃料（煤炭最耐烧）。点熔炉可以调节炉火，离熔炉越远越冷！',
  resources: ['wood', 'stone', 'coal'],
  startRes: { wood: 80, stone: 20, coal: 10 },
  dayTime: 60,
  nightSpawnTime: 35,
  hasNights: true,
  killRes: 'coal',
  upgradeExtra: 'coal',
  tapGather: true,
  coreSprite: 'core_frost',
  fire: [15, 22],
  baseTerrain: TER.SNOW,
  noFlowers: true,
  loseText: '熔炉被摧毁，营地被冰雪吞没了……',

  nodes: {
    pine: { name: '雪松', res: 'wood', amount: 25, clusters: 10, perCluster: 11, spread: 2.5, regrow: 8 },
    rock: { name: '石头', res: 'stone', amount: 40, clusters: 6, perCluster: 5, spread: 1.6, regrow: 3 },
    coal: { name: '煤矿石', res: 'coal', amount: 30, clusters: 5, perCluster: 4, spread: 1.4, regrow: 3 },
  },

  buildList: ['wall', 'door', 'stonewall', 'stonedoor', 'tower', 'cannon', 'flame', 'heater', 'lumber', 'quarry', 'coalmine'],
  buildings: {
    core: {
      name: '熔炉', size: 2, hp: 700, attack: 'arrow', range: 4, dmg: 8, rate: 1, light: 6,
      upgrade: { wood: 80, stone: 60 }, desc: '营地的心脏，升级提高热量',
    },
    wall: { name: '木墙', hp: 200, cost: { wood: 8 }, wall: true, wallStyle: 'wood', sprite: 'wall_wood', desc: '阻挡怪物前进，相邻的墙和门会自动连成一片' },
    door: { name: '木门', hp: 170, cost: { wood: 12 }, door: true, wallStyle: 'wood', sprite: 'door_wood', desc: '自己人可以进出，怪物过不去（比木墙略脆）' },
    stonewall: { name: '石墙', hp: 600, cost: { stone: 12 }, wall: true, wallStyle: 'stone', sprite: 'wall_stone', locked: true, desc: '非常结实的墙' },
    stonedoor: { name: '石门', hp: 500, cost: { stone: 14, wood: 4 }, door: true, wallStyle: 'stone', sprite: 'door_stone', locked: true, desc: '自己人可以进出，怪物过不去（比石墙略脆）' },
    tower: { name: '箭塔', hp: 150, cost: { wood: 30, stone: 10 }, attack: 'arrow', range: 5, dmg: 10, rate: 1.5, light: 2.5, desc: '快速射击单个敌人' },
    cannon: { name: '投石塔', hp: 220, cost: { wood: 40, stone: 40, coal: 5 }, attack: 'rock', range: 4.5, dmg: 22, rate: 0.5, splash: 1.3, light: 2, desc: '范围伤害' },
    flame: {
      name: '火焰塔', hp: 180, cost: { stone: 40, coal: 20 }, attack: 'fire', range: 3.5, dmg: 8, rate: 1.5, burn: 0.8,
      light: 3, heat: { amount: 4, radius: 2 }, locked: true, desc: '点燃敌人，还能给周围供暖',
    },
    heater: {
      name: '加热器', hp: 100, cost: { stone: 25, coal: 10 }, heat: { amount: 10, radius: 3.5 }, light: 2, locked: true,
      desc: '3.5 格内 +10°C，每 10 秒烧 1 煤',
    },
    lumber: { name: '伐木屋', hp: 100, cost: { wood: 20 }, gather: 'pine', radius: 3, interval: 2, amount: 1, desc: '自动砍伐 3 格内的雪松' },
    quarry: { name: '采石场', hp: 100, cost: { wood: 30 }, gather: 'rock', radius: 3, interval: 2.5, amount: 1, desc: '自动开采 3 格内的石头' },
    coalmine: { name: '煤矿', hp: 100, cost: { wood: 30, stone: 10 }, gather: 'coal', radius: 3, interval: 3, amount: 1, desc: '自动开采 3 格内的煤矿石' },
  },

  techs: [
    { id: 'heating', name: '供暖技术', desc: '解锁 加热器（局部升温）', cost: { stone: 30, coal: 15 }, unlock: ['heater'] },
    { id: 'insulation', name: '保温材料', desc: '所有地方温度 +5°C', cost: { wood: 80, stone: 30 }, apply: (m) => { m.warm += 5; } },
    { id: 'mason', name: '石工', desc: '解锁 石墙、石门', cost: { wood: 40, stone: 30 }, unlock: ['stonewall', 'stonedoor'] },
    { id: 'tools', name: '精良工具', desc: '自动采集速度 +25%，点击采集 +1', cost: { wood: 60, stone: 40 }, apply: (m) => { m.gather *= 1.25; m.tap += 1; } },
    { id: 'steam', name: '蒸汽核心', desc: '炉火最高等级提升到 4', cost: { stone: 80, coal: 40 }, req: ['heating'], apply: (m) => { m.furnaceMax = 4; } },
    { id: 'pyro', name: '火焰学', desc: '解锁 火焰塔（燃烧敌人并供暖）', cost: { stone: 50, coal: 30 }, req: ['heating'], unlock: ['flame'] },
    { id: 'efficient', name: '高效燃烧', desc: '熔炉燃料消耗 -25%', cost: { stone: 60, coal: 30 }, req: ['steam'], apply: (m) => { m.fuelMul *= 0.75; } },
    { id: 'fort', name: '加固地基', desc: '所有建筑生命 +25%', cost: { stone: 100, coal: 20 }, req: ['mason'], apply: (m) => { m.hp *= 1.25; } },
  ],

  monsters: {
    frostslime: { name: '冰霜史莱姆', sprite: 'frostslime', hp: 26, speed: 1.0, dmg: 6, rate: 1, gold: 0.5, from: 1, weight: 10, color: '#73eff7' },
    wolf: { name: '冰原狼', hp: 18, speed: 2.4, dmg: 5, rate: 1.4, gold: 0.5, from: 2, weight: 5, color: '#f4f4f4' },
    iceskel: { name: '冰霜骷髅', hp: 75, speed: 0.8, dmg: 14, rate: 0.8, gold: 1.5, from: 3, weight: 3, color: '#73eff7' },
    yeti: { name: '雪人王', hp: 800, speed: 0.55, dmg: 45, rate: 0.7, gold: 25, scale: 2, boss: true, color: '#f4f4f4' },
  },
  wave: { baseCount: 10, perNight: 8, growth: 1.1, hpPerNight: 0.3, dmgPerNight: 0.1, bossEvery: 5 },
  perks: GENERIC_PERKS.concat(FROST_PERKS),

  hooks: {
    init() {
      G.furnace = { level: 1, buffer: 0, tick: 0, out: false };
      G.blizzard = false;
      G.flakes = [];
      for (let i = 0; i < 70; i++) G.flakes.push({ x: Math.random(), y: Math.random(), s: rand(0.3, 1) });
    },
    save() { return { level: G.furnace.level, buffer: G.furnace.buffer }; },
    load(d) {
      MODES.frost.hooks.init();
      G.furnace.level = d.level;
      G.furnace.buffer = d.buffer || 0;
    },
    update(dt) {
      const f = G.furnace;
      f.tick += dt;
      if (f.tick >= FROST_TICK) {
        f.tick -= FROST_TICK;
        const need = f.level * G.mods.fuelMul;
        while (f.buffer < need && (G.res.coal > 0 || G.res.wood > 0)) {
          if (G.res.coal > 0) { G.res.coal--; f.buffer += 3; } else { G.res.wood--; f.buffer += 1; }
        }
        const wasOut = f.out;
        if (f.buffer >= need) { f.buffer -= need; f.out = false; } else { f.out = f.level > 0; }
        if (f.out && !wasOut) { showBanner('熔炉燃料耗尽！', '快去采集木材或煤炭，温度正在下降', 4, '#ef7d57'); sfx('bad'); }
        // 加热器各自烧煤
        for (const b of G.buildings) {
          if (b.type !== 'heater') continue;
          b.fuelT = (b.fuelT || 0) + FROST_TICK;
          if (b.fuelT >= 10) {
            b.fuelT -= 10;
            b.heaterOn = G.res.coal > 0;
            if (b.heaterOn) G.res.coal--;
          } else if (b.heaterOn === undefined) b.heaterOn = G.res.coal > 0;
        }
      }
      for (const b of G.buildings) if (b.type === 'flame') b.heaterOn = true;
      for (const fl of G.flakes) {
        fl.y += dt * (0.05 + fl.s * 0.08) * (G.blizzard ? 3 : 1);
        fl.x += dt * (G.blizzard ? 0.12 : 0.02) * fl.s;
        if (fl.y > 1) { fl.y = 0; fl.x = Math.random(); }
        if (fl.x > 1) fl.x = 0;
      }
    },
    efficiency(b) {
      b.temp = frostTempAt(b.cx, b.cy);
      return frostEfficiency(b.temp);
    },
    night() {
      G.blizzard = G.day >= 3 && Math.random() < 0.3;
      if (G.blizzard) G.nightNote = '暴风雪来袭！气温骤降 12°C';
    },
    dawn() { G.blizzard = false; },
    hud() {
      const out = frostOutsideTemp(), core = frostTempAt(G.core.cx, G.core.cy), eff = frostEfficiency(core);
      const tc = (t) => (t >= 0 ? '#a7f070' : t >= -15 ? '#ffcd75' : '#73eff7');
      return [
        { icon: 'temp', text: '室外 ' + Math.round(out) + '°C', color: tc(out) },
        { icon: 'fire', text: G.furnace.out ? '燃料耗尽！' : '炉火 Lv' + G.furnace.level, color: G.furnace.out ? '#ef7d57' : '#ffcd75' },
        { text: '营地 ' + Math.round(core) + '°C · 效率 ' + Math.round(eff * 100) + '%', color: tc(core) },
      ];
    },
    buildingInfo(b) {
      const t = Math.round(frostTempAt(b.cx, b.cy));
      const e = Math.round(frostEfficiency(t) * 100);
      let s = '这里 ' + t + '°C，效率 ' + e + '%';
      if (b.type === 'heater') s += b.heaterOn ? '（运转中）' : '（没有煤，已停机）';
      if (b.type === 'core') {
        const per = G.furnace.level * G.mods.fuelMul;
        s += '　每 4 秒消耗 ' + per.toFixed(1) + ' 份燃料（1 煤 = 3 份）';
      }
      return s;
    },
    // 熔炉面板上的炉火调节按钮
    panelButtons(b) {
      if (b.type !== 'core') return [];
      const f = G.furnace;
      return [
        { label: '炉火 −', dim: f.level <= 0, onClick: () => { f.level = Math.max(0, f.level - 1); } },
        { label: '炉火 +', dim: f.level >= G.mods.furnaceMax, onClick: () => { f.level = Math.min(G.mods.furnaceMax, f.level + 1); f.out = false; } },
      ];
    },
    drawWorld(ctx) {
      // 太冷的建筑头上显示雪花
      for (const b of G.buildings) {
        if (b.eff < 0.75 && (b.def.gather || b.def.attack || b.def.produce)) {
          drawWorldLabel(ctx, '❄', b.cx, b.y * T - 2, '#73eff7');
        }
      }
    },
    drawScreen(ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const fl of G.flakes) {
        const s = fl.s * 2.5;
        ctx.fillRect(fl.x * G.sw, fl.y * G.sh, s, s);
      }
      if (G.blizzard) {
        ctx.fillStyle = 'rgba(200,220,240,0.15)';
        ctx.fillRect(0, 0, G.sw, G.sh);
      }
    },
  },
};
