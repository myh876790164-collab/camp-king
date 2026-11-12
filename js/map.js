// =============================================
//  地图：地形、资源分布、背景、每日再生
//  各模式可以在自己的 mapGen 里定制地形（海岛、城市街道、雪原）
// =============================================
function idx(x, y) { return y * MAP_W + x; }
function inMap(x, y) { return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 1.4; }

function distToCore(x, y) {
  return Math.hypot(x + 0.5 - (G.coreX + 1), y + 0.5 - (G.coreY + 1));
}
function terrainAt(x, y) { return inMap(x, y) ? G.terrain[idx(x, y)] : TER.WATER; }

function placeNode(type, x, y, minCoreDist) {
  if (x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
  const i = idx(x, y);
  if (G.nodes[i] || G.bld[i]) return false;
  const def = G.def.nodes[type];
  const ter = G.terrain[i];
  if (ter === TER.WATER) return false;
  if (def.onRoad ? ter !== TER.ROAD : ter === TER.ROAD) return false;
  if (distToCore(x, y) < (minCoreDist || 4)) return false; // 营地周围留出空地
  G.nodes[i] = { type, x, y, amount: def.amount || 1, max: def.amount || 1, shakeUntil: 0, searchedUntil: 0 };
  return true;
}

// 成片撒资源：clusters 个中心，每个中心周围 perCluster 个
function scatterNodes(type, clusters, perCluster, spread) {
  const ccx = G.coreX + 1, ccy = G.coreY + 1;
  for (let c = 0; c < clusters; c++) {
    let cx, cy, tries = 0;
    do {
      cx = randInt(2, MAP_W - 3);
      cy = randInt(2, MAP_H - 3);
      tries++;
    } while ((Math.hypot(cx - ccx, cy - ccy) < 8 || terrainAt(cx, cy) === TER.WATER) && tries < 80);
    for (let i = 0; i < perCluster; i++) {
      placeNode(type, cx + Math.round(gauss() * spread), cy + Math.round(gauss() * spread));
    }
  }
}

// 营地附近保证有资源，开局就能用
function scatterNearCore(type, count, ang, spreadAng) {
  const ccx = G.coreX + 1, ccy = G.coreY + 1;
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 20) {
    tries++;
    const a = ang + rand(-spreadAng, spreadAng), d = rand(4.5, 6.8);
    if (placeNode(type, Math.round(ccx + Math.cos(a) * d), Math.round(ccy + Math.sin(a) * d))) placed++;
  }
}

function generateMap() {
  const N = MAP_W * MAP_H;
  G.nodes = new Array(N).fill(null);
  G.bld = new Array(N).fill(null);
  G.terrain = new Uint8Array(N).fill(G.def.baseTerrain || TER.GRASS);
  G.coreX = Math.floor(MAP_W / 2) - 1;
  G.coreY = Math.floor(MAP_H / 2) - 1;
  if (G.def.mapGen) {
    G.def.mapGen();
    return;
  }
  // 默认：按 nodes 配置成片分布
  const types = Object.keys(G.def.nodes);
  for (const type of types) {
    const d = G.def.nodes[type];
    scatterNodes(type, d.clusters || 6, d.perCluster || 8, d.spread || 2);
  }
  const ang = rand(0, Math.PI * 2);
  types.forEach((type, i) => scatterNearCore(type, i === 0 ? 8 : 4, ang + i * 2.1, 0.6));
}

// 每天早上：在已有资源旁边长出新的，没有就随机长
function regrowNodes() {
  for (const type in G.def.nodes) {
    const want = G.def.nodes[type].regrow || 0;
    if (!want) continue;
    const list = G.nodes.filter((n) => n && n.type === type);
    let grown = 0, tries = 0;
    while (grown < want && tries < want * 25) {
      tries++;
      let x, y;
      if (list.length && Math.random() < 0.75) {
        const n = pick(list);
        x = n.x + randInt(-1, 1);
        y = n.y + randInt(-1, 1);
      } else {
        x = randInt(1, MAP_W - 2);
        y = randInt(1, MAP_H - 2);
      }
      if (placeNode(type, x, y)) grown++;
    }
  }
}

function removeNode(n) {
  G.nodes[idx(n.x, n.y)] = null;
  addPuff((n.x + 0.5) * T, (n.y + 0.5) * T, '#f4f4f4', 10);
  markFlowDirty();
}

// 地面配色：[底色, 斑点1, 斑点2]
const GROUND_COLORS = {
  [TER.GRASS]: ['#4a8c3f', '#427e38', '#56994a'],
  [TER.WATER]: ['#3b5dc9', '#3554b5', '#41a6f6'],
  [TER.SAND]: ['#e4c9a0', '#d4b98a', '#f0dcb4'],
  [TER.ROAD]: ['#4b4f5e', '#3d404d', '#565b6b'],
  [TER.SNOW]: ['#e8eef5', '#cfd9e6', '#ffffff'],
  [TER.DIRT]: ['#7d6a45', '#6e5c3a', '#8c7850'],
};

// 背景只画一次，存成一张大图
function buildGround() {
  const c = createCanvas(MAP_W * T, MAP_H * T);
  const g = c.getContext('2d');
  const colors = Object.assign({}, GROUND_COLORS, G.def.groundColors || {});
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ter = G.terrain[idx(x, y)];
      const col = colors[ter];
      g.fillStyle = col[0];
      g.fillRect(x * T, y * T, T, T);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = Math.random() < 0.5 ? col[1] : col[2];
        g.fillRect(x * T + randInt(0, T - 1), y * T + randInt(0, T - 1), ter === TER.WATER ? 3 : 1, 1);
      }
      if (ter === TER.GRASS && Math.random() < 0.5) {
        g.fillStyle = col[1];
        const gx = x * T + randInt(0, T - 3), gy = y * T + randInt(0, T - 3);
        g.fillRect(gx, gy, 1, 2);
        g.fillRect(gx + 2, gy + 1, 1, 1);
      }
      if (ter === TER.GRASS && Math.random() < 0.06 && !G.def.noFlowers) {
        g.fillStyle = pick(['#ffcd75', '#f4f4f4', '#ef7d57', '#73eff7']);
        g.fillRect(x * T + randInt(0, T - 1), y * T + randInt(0, T - 1), 1, 1);
      }
      // 道路中线
      if (ter === TER.ROAD && x % 3 === 0) {
        const vert = terrainAt(x, y - 1) === TER.ROAD && terrainAt(x, y + 1) === TER.ROAD &&
          terrainAt(x - 1, y) !== TER.ROAD;
        if (!vert) { g.fillStyle = '#8a7f4a'; g.fillRect(x * T + 4, y * T + (y % 2 ? 15 : 0), 8, 1); }
      }
      // 海浪：水边画一道白边
      if (ter === TER.WATER) {
        g.fillStyle = 'rgba(244,244,244,0.55)';
        if (terrainAt(x, y - 1) !== TER.WATER) g.fillRect(x * T, y * T, T, 1);
        if (terrainAt(x, y + 1) !== TER.WATER) g.fillRect(x * T, y * T + T - 1, T, 1);
        if (terrainAt(x - 1, y) !== TER.WATER) g.fillRect(x * T, y * T, 1, T);
        if (terrainAt(x + 1, y) !== TER.WATER) g.fillRect(x * T + T - 1, y * T, 1, T);
      }
    }
  }
  G.ground = c;
}
