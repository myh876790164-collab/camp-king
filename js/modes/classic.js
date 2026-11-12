// =============================================
//  模式 1：经典塔防
// =============================================

// 建筑联动强化：只有拥有对应建筑时才会在三选一里出现
//   needs = 拥有其中任一建筑；needs2 = 同时还要拥有其中任一
const CLASSIC_SYNERGY = [
  { name: '火焰箭', desc: '【箭塔】箭矢附带燃烧，3 秒内持续造成伤害', needs: ['tower'], max: 2, apply: (m) => { m.burn += 1; } },
  { name: '连锁闪电', desc: '【雷电塔】闪电额外弹射 2 次', needs: ['tesla'], apply: (m) => { m.chain += 2; } },
  { name: '永冻之心', desc: '【冰霜塔】减速更强、持续更久', needs: ['frost'], max: 2, apply: (m) => { m.slowPow += 0.5; } },
  { name: '荆棘城墙', desc: '【木墙/石墙】被攻击时反弹 60% 伤害', needs: ['wall', 'stonewall'], max: 2, apply: (m) => { m.thorns += 0.6; } },
  { name: '淬毒尖刺', desc: '【尖刺陷阱】伤害翻倍', needs: ['spikes'], apply: (m) => { m.trapDmg *= 2; } },
  { name: '林中哨塔', desc: '【伐木屋+箭塔】伐木屋 3 格内的箭塔伤害 +40%', needs: ['lumber'], needs2: ['tower'], max: 1, apply: (m) => { m.lumberTower = 0.4; } },
  { name: '黄金弹药', desc: '【市场】每持有 100 金币，所有防御伤害 +3%（最多 +60%）', needs: ['market'], max: 1, apply: (m) => { m.goldPower = 1; } },
  { name: '巨石投掷', desc: '【投石塔】溅射范围 +40%，伤害 +20%', needs: ['cannon'], apply: (m) => { m.splash *= 1.4; m.cannonDmg *= 1.2; } },
];

MODES.classic = {
  id: 'classic',
  name: '经典塔防',
  tag: '塔防 · 肉鸽 · 割草',
  icon: 'tower',
  desc: '白天采集建设，夜晚抵御越来越多的怪物。研究科技解锁新塔，强化与建筑联动，看你能撑几夜！',
  intro: '点击树木和石头采集，建造伐木屋自动采集，天黑前建好箭塔！',
  resources: ['wood', 'stone', 'gold'],
  startRes: { wood: 60, stone: 20, gold: 0 },
  dayTime: 60,
  nightSpawnTime: 35,
  hasNights: true,
  killRes: 'gold',
  upgradeExtra: 'gold',
  tapGather: true,
  coreSprite: 'core_classic',
  fire: [23, 25],

  nodes: {
    tree: { name: '树木', res: 'wood', amount: 25, clusters: 10, perCluster: 12, spread: 2.5, regrow: 10 },
    rock: { name: '石头', res: 'stone', amount: 40, clusters: 7, perCluster: 5, spread: 1.6, regrow: 4 },
  },

  buildList: ['wall', 'stonewall', 'tower', 'cannon', 'frost', 'tesla', 'spikes', 'lumber', 'quarry', 'market'],
  buildings: {
    core: {
      name: '营地', size: 2, hp: 600, attack: 'arrow', range: 4, dmg: 8, rate: 1, light: 5,
      upgrade: { wood: 80, stone: 50, gold: 15 }, desc: '被摧毁就输了！',
    },
    wall: { name: '木墙', hp: 200, cost: { wood: 8 }, wall: true, desc: '阻挡怪物前进' },
    stonewall: { name: '石墙', hp: 600, cost: { stone: 12 }, wall: true, locked: true, desc: '非常结实的墙' },
    tower: { name: '箭塔', hp: 150, cost: { wood: 30, stone: 10 }, attack: 'arrow', range: 5, dmg: 10, rate: 1.5, light: 2.5, desc: '快速射击单个敌人' },
    cannon: { name: '投石塔', hp: 220, cost: { wood: 40, stone: 40, gold: 10 }, attack: 'rock', range: 4.5, dmg: 22, rate: 0.5, splash: 1.3, light: 2, desc: '范围伤害，割草利器' },
    frost: {
      name: '冰霜塔', hp: 160, cost: { stone: 30, gold: 15 }, attack: 'ice', range: 4, dmg: 5, rate: 1.2,
      slow: { factor: 0.5, dur: 1.5 }, light: 2, locked: true, desc: '命中后减速敌人',
    },
    tesla: {
      name: '雷电塔', hp: 180, cost: { stone: 50, gold: 40 }, attack: 'chain', range: 4, dmg: 16, rate: 0.8,
      chain: 3, light: 2.5, locked: true, desc: '闪电在敌人之间弹射',
    },
    spikes: { name: '尖刺陷阱', hp: 80, cost: { wood: 15, stone: 5 }, trap: 14, passable: true, locked: true, desc: '不挡路，踩上去持续受伤' },
    lumber: { name: '伐木屋', hp: 100, cost: { wood: 20 }, gather: 'tree', radius: 3, interval: 2, amount: 1, desc: '自动砍伐 3 格内的树木' },
    quarry: { name: '采石场', hp: 100, cost: { wood: 30 }, gather: 'rock', radius: 3, interval: 2.5, amount: 1, desc: '自动开采 3 格内的石头' },
    market: { name: '市场', hp: 120, cost: { wood: 60, stone: 20 }, produce: { res: 'gold', amount: 1, interval: 4 }, locked: true, desc: '持续产出金币' },
  },

  techs: [
    { id: 'mason', name: '石工', desc: '解锁 石墙（生命是木墙的 3 倍）', cost: { wood: 40, stone: 30 }, unlock: ['stonewall'] },
    { id: 'traps', name: '陷阱学', desc: '解锁 尖刺陷阱（不挡路，怪物踩上去持续受伤）', cost: { wood: 60 }, unlock: ['spikes'] },
    { id: 'trade', name: '贸易', desc: '解锁 市场（持续产出金币）', cost: { wood: 80, stone: 20 }, unlock: ['market'] },
    { id: 'tools', name: '精良工具', desc: '自动采集速度 +25%，点击采集 +1', cost: { wood: 60, stone: 40 }, apply: (m) => { m.gather *= 1.25; m.tap += 1; } },
    { id: 'frostmagic', name: '冰霜魔法', desc: '解锁 冰霜塔（减速敌人）', cost: { stone: 50, gold: 20 }, req: ['mason'], unlock: ['frost'] },
    { id: 'lightning', name: '雷电研究', desc: '解锁 雷电塔（闪电弹射多个敌人）', cost: { stone: 80, gold: 60 }, req: ['frostmagic'], unlock: ['tesla'] },
    { id: 'arrows', name: '精良箭矢', desc: '箭塔和营地伤害 +20%', cost: { wood: 100, gold: 30 }, apply: (m) => { m.arrowDmg *= 1.2; } },
    { id: 'ballistics', name: '弹道学', desc: '投石塔溅射范围 +30%', cost: { stone: 80, gold: 30 }, apply: (m) => { m.splash *= 1.3; } },
    { id: 'fort', name: '加固地基', desc: '所有建筑生命 +25%', cost: { stone: 100, gold: 20 }, req: ['mason'], apply: (m) => { m.hp *= 1.25; } },
    { id: 'bounty', name: '悬赏令', desc: '击杀金币 +30%', cost: { gold: 50 }, req: ['trade'], apply: (m) => { m.gold *= 1.3; } },
  ],

  monsters: {
    slime: { name: '史莱姆', hp: 22, speed: 1.1, dmg: 6, rate: 1, gold: 1, from: 1, weight: 10, color: '#41a6f6' },
    bat: { name: '蝙蝠', hp: 12, speed: 2.2, dmg: 3, rate: 1.5, gold: 1, from: 2, weight: 4, fly: true, color: '#9a4fb0' },
    skeleton: { name: '骷髅兵', hp: 70, speed: 0.8, dmg: 14, rate: 0.8, gold: 3, from: 3, weight: 3, color: '#f4f4f4' },
    boss: { name: '史莱姆王', hp: 600, speed: 0.55, dmg: 40, rate: 0.7, gold: 40, scale: 2, boss: true, color: '#ef7d57' },
  },
  // 每夜怪物数量 = (baseCount + perNight×(夜数-1)) × growth^(夜数-1)
  wave: { baseCount: 10, perNight: 8, growth: 1.1, hpPerNight: 0.3, dmgPerNight: 0.1, bossEvery: 5 },
  perks: GENERIC_PERKS.concat(CLASSIC_SYNERGY),
  hooks: {},
};
