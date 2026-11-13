// =============================================
//  Camp King · 公共配置
//  各模式自己的数值在 js/modes/ 目录下（classic / island / zombie / frost）
// =============================================
const CONFIG = {
  TILE: 16,               // 每格像素（像素画原始尺寸）
  MAP_W: 72,              // 地图宽（格）
  MAP_H: 54,              // 地图高（格）
  DUSK_TIME: 10,          // 白天最后几秒开始天黑
  DAWN_REPAIR: 0.3,       // 天亮时建筑恢复 30% 生命
  PATH_BUILDING_COST: 12, // 寻路时“拆墙”的代价，越大怪物越愿意绕路
  MAX_LEVEL: 5,
  UPGRADE_COST_MULT: 1.7, // 每升一级价格 ×1.7
  UPGRADE_STAT_MULT: 0.4, // 每升一级属性 +40%
  DEMOLISH_REFUND: 0.5,   // 拆除返还 50%
};
const T = CONFIG.TILE;
// 地图尺寸：每个模式可以不同（丧尸模式是城市大地图），开局时由 setMapSize 设置
let MAP_W = CONFIG.MAP_W;
let MAP_H = CONFIG.MAP_H;
// 地图面积相对最初 48×36 的倍数：资源数量按它放大
let MAP_SCALE = (MAP_W * MAP_H) / (48 * 36);
function setMapSize(w, h) {
  MAP_W = w; MAP_H = h;
  MAP_SCALE = (w * h) / (48 * 36);
}

// 地形
const TER = { GRASS: 0, WATER: 1, SAND: 2, ROAD: 3, SNOW: 4, DIRT: 5, PAVE: 6, LOT: 7 }; // PAVE 人行道，LOT 城市建筑占地
// 走不过去的地形：水、城市建筑
function solidTer(t) { return t === TER.WATER || t === TER.LOT; }

// 资源名称和颜色（图标在 sprites.js 里，名字为 icon_资源名）
const RES_INFO = {
  wood: { name: '木材', color: '#ffcd75' },
  stone: { name: '石材', color: '#c8d6e5' },
  gold: { name: '金币', color: '#ffcd75' },
  food: { name: '食物', color: '#ef7d57' },
  water: { name: '水', color: '#73eff7' },
  parts: { name: '零件', color: '#c8d6e5' },
  ammo: { name: '子弹', color: '#ffcd75' },
  coal: { name: '煤炭', color: '#94b0c2' },
  iron: { name: '铁', color: '#c8d6e5' },
};

const MODES = {};
const MODE_ORDER = ['classic', 'island', 'zombie', 'frost'];

// 所有加成的初始值（科技和肉鸽强化会修改这些数）
function defaultMods() {
  return {
    dmg: 1, rate: 1, range: 1, gather: 1, prod: 1, hp: 1, gold: 1, tap: 1, coreDmg: 1,
    arrowDmg: 1, cannonDmg: 1, splash: 1, multishot: 0, burn: 0, chain: 0, slowPow: 1,
    thorns: 0, trapDmg: 1, lumberTower: 0, goldPower: 0,
    warm: 0, heatMul: 1, fuelMul: 1, coldResist: 0, furnaceMax: 3,
    happy: 0, foodSave: 0, survDmg: 1, craftTier: 2, wallHp: 1, coreHp: 1,
  };
}

// 通用肉鸽强化（经典、极寒共用）。needs = 拥有其中任一建筑才会出现
const GENERIC_PERKS = [
  { name: '锋利箭头', desc: '所有防御伤害 +25%', apply: (m) => { m.dmg *= 1.25; } },
  { name: '快速装填', desc: '所有防御攻速 +20%', apply: (m) => { m.rate *= 1.2; } },
  { name: '鹰眼', desc: '所有防御射程 +15%', apply: (m) => { m.range *= 1.15; } },
  { name: '勤劳工人', desc: '自动采集速度 +30%', apply: (m) => { m.gather *= 1.3; } },
  { name: '强壮臂膀', desc: '每次点击多采集 2 个资源', apply: (m) => { m.tap += 2; } },
  { name: '坚固建材', desc: '所有建筑生命 +30%', apply: (m) => { m.hp *= 1.3; } },
  { name: '赏金猎人', desc: '击杀奖励 +50%', apply: (m) => { m.gold *= 1.5; } },
  { name: '营地之怒', desc: '营地自身伤害 +60%', apply: (m) => { m.coreDmg *= 1.6; } },
  { name: '多重箭', desc: '【箭塔】每次多射 1 支箭', needs: ['tower'], max: 3, apply: (m) => { m.multishot += 1; } },
  {
    name: '紧急修缮', desc: '立即修满所有建筑，并获得一批木材',
    apply: (m, g) => { g.buildings.forEach((b) => { b.hp = b.maxHp; }); g.res[g.def.resources[0]] += 50; },
  },
  {
    name: '物资补给', desc: '立即获得一批各类资源',
    apply: (m, g) => { const r = g.def.resources; g.res[r[0]] += 60; g.res[r[1]] += 40; g.res[r[2]] += 15; },
  },
];
