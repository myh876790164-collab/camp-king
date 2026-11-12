// =============================================
//  寻路：流场（Flow Field）
//  从营地出发算一遍全图“到营地的距离”，每个怪物只要往距离更小的格子走。
//  几百只怪也只需要算一次，适合割草玩法。
//  树木/石头不能通过；建筑可以“拆过去”但代价很高，所以怪物会优先绕路，
//  被完全围住时才会攻击城墙。
// =============================================
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class MinHeap {
  constructor() { this.items = []; this.pris = []; }
  get size() { return this.items.length; }
  push(item, pri) {
    const it = this.items, pr = this.pris;
    let i = it.length;
    it.push(item); pr.push(pri);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (pr[p] <= pri) break;
      it[i] = it[p]; pr[i] = pr[p];
      i = p;
    }
    it[i] = item; pr[i] = pri;
  }
  pop() {
    const it = this.items, pr = this.pris;
    const top = it[0];
    this.lastPri = pr[0];
    const lastI = it.pop(), lastP = pr.pop();
    if (it.length) {
      let i = 0;
      const n = it.length;
      while (true) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pr[c + 1] < pr[c]) c++;
        if (pr[c] >= lastP) break;
        it[i] = it[c]; pr[i] = pr[c];
        i = c;
      }
      it[i] = lastI; pr[i] = lastP;
    }
    return top;
  }
}

// friendly = 自己人（玩家、幸存者、岛民）：门对自己人是开着的，对怪物是关着的
function isBlocked(x, y, friendly) {
  if (!inMap(x, y)) return true;
  const i = idx(x, y);
  if (solidTer(G.terrain[i]) || G.nodes[i]) return true;
  const b = G.bld[i];
  if (!b || b.def.passable) return false;
  return !(friendly && b.def.door);
}

// 走进格子 i 的代价（有建筑 = 要先拆掉）
function enterCost(i) {
  const b = G.bld[i];
  return b && b !== G.core && !b.def.passable ? CONFIG.PATH_BUILDING_COST : 0;
}

function canStepDiag(x, y, dx, dy, friendly) {
  return !isBlocked(x + dx, y, friendly) && !isBlocked(x, y + dy, friendly);
}

// 地图变化时只标记“需要重算”，每帧最多重算一次（同一帧采完多个资源也只算一遍）
function markFlowDirty() { G.flowDirty = true; }
function flushFlow() {
  if (G.flowDirty) recomputeFlow();
}

function recomputeFlow() {
  G.flowDirty = false;
  const N = MAP_W * MAP_H;
  // 必须用 Float64：Float32 精度不够会和计算结果比较出错，导致同一格被反复计算，造成卡顿
  if (!G.dist) { G.dist = new Float64Array(N); G.next = new Int32Array(N); }
  const dist = G.dist, next = G.next;
  dist.fill(Infinity);
  next.fill(-1);

  const heap = new MinHeap();
  const c = G.core;
  for (let y = c.y; y < c.y + c.size; y++) {
    for (let x = c.x; x < c.x + c.size; x++) {
      dist[idx(x, y)] = 0;
      heap.push(idx(x, y), 0);
    }
  }

  // Dijkstra：dist[j] = 站在 j 的怪物走到营地的最小代价
  while (heap.size) {
    const i = heap.pop();
    const d = heap.lastPri;
    if (d > dist[i]) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const stepIn = enterCost(i);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (G.nodes[j] || solidTer(G.terrain[j])) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag && !canStepDiag(nx, ny, -dx, -dy)) continue;
      const nd = d + (diag ? 1.4142 : 1) + stepIn;
      if (nd < dist[j]) {
        dist[j] = nd;
        heap.push(j, nd);
      }
    }
  }

  // 每个格子记录“下一步该走哪个格子”
  for (let i = 0; i < N; i++) {
    if (!isFinite(dist[i]) || dist[i] === 0) continue;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    let best = -1, bestD = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (!isFinite(dist[j])) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag && !canStepDiag(x, y, dx, dy)) continue;
      const cost = dist[j] + (diag ? 1.4142 : 1) + enterCost(j);
      if (cost < bestD) { bestD = cost; best = j; }
    }
    next[i] = best;
  }
}

// 玩家点地面移动（丧尸模式）：BFS 找路；目标被挡住时（房屋、NPC 所在格）走到它旁边
function findPath(sx, sy, tx, ty) {
  if (!inMap(tx, ty) || !inMap(sx, sy)) return null;
  const N = MAP_W * MAP_H;
  const prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N);
  const start = idx(sx, sy), goal = idx(tx, ty);
  const goalBlocked = isBlocked(tx, ty, true);
  const q = [start];
  seen[start] = 1;
  let found = -1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MAP_W, y = (i / MAP_W) | 0;
    if (i === goal || (goalBlocked && Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1)) { found = i; break; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inMap(nx, ny)) continue;
      const j = idx(nx, ny);
      if (seen[j] || isBlocked(nx, ny, true)) continue;
      if (dx !== 0 && dy !== 0 && !canStepDiag(x, y, dx, dy, true)) continue;
      seen[j] = 1;
      prev[j] = i;
      q.push(j);
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let i = found; i !== start && i >= 0; i = prev[i]) path.push(i);
  path.reverse();
  return path.map((i) => ({ x: (i % MAP_W + 0.5) * T, y: (((i / MAP_W) | 0) + 0.5) * T }));
}
