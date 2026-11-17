// =============================================
//  资源建筑的杂役（经典模式、修仙门派共用）
//  建筑配置里写 chore = 要采的资源点类型、carry = 每趟背回多少、workTime = 采一次要几秒
//  杂役：出门找最近的资源点 → 采集 → 背回建筑交货才入账
//  附近采光了就去地图上最近的资源点继续采，整张地图都没有了才停工
//  升级：杂役人数 1 → 1 → 2 → 2 → 3，速度每级 +10%（采集类加成，如“勤劳工人”，也会加速）
// =============================================
const CHORE_WORKERS = [0, 1, 1, 2, 2, 3];
const CHORE_NEAR = 12; // 超过这么远就算“去远处采”（只用来显示提示）
function choreCount(b) { return CHORE_WORKERS[Math.min(5, b.level)] || 1; }
function choreSpeed(b) { return (1 + 0.1 * (b.level - 1)) * ((G.mods && G.mods.gather) || 1); }
function choreTick(dt) {
  for (const b of G.buildings) {
    const def = b.def;
    if (!def.chore) continue;
    b.workers = b.workers || [];
    while (b.workers.length < choreCount(b)) b.workers.push({ x: b.cx, y: b.cy + 6, st: 'home', t: rand(0.2, 1.5), carry: 0, face: 1, id: Math.random() * 100 });
    if (b.workers.length > choreCount(b)) b.workers.length = choreCount(b);
    let anyWork = false;
    for (const w of b.workers) {
      const sp = 1.6 * T * choreSpeed(b);
      const walk = (tx, ty) => { const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy); if (Math.abs(dx) > 0.5) w.face = dx > 0 ? 1 : -1; if (d <= sp * dt) { w.x = tx; w.y = ty; return true; } w.x += dx / d * sp * dt; w.y += dy / d * sp * dt; return false; };
      w.moving = false;
      if (w.st === 'home') { // 在建筑门口歇一会儿，然后出门
        w.t -= dt;
        if (w.t > 0) continue;
        const n = findChoreNode(b, w);
        if (!n) { w.t = 2; continue; }
        // 站位在选定时就固定（站在资源点靠近建筑的那一侧），不能跟着朝向变，否则会在树前来回晃
        const side = b.cx < (n.x + 0.5) * T ? -1 : 1;
        w.node = n; w.tx = (n.x + 0.5) * T + 7 * side; w.ty = (n.y + 0.85) * T; w.st = 'go';
      } else if (w.st === 'go') {
        const n = w.node;
        if (!n || G.nodes[idx(n.x, n.y)] !== n) { w.st = 'home'; w.t = 0.3; continue; }
        w.moving = true;
        if (walk(w.tx, w.ty)) { w.st = 'work'; w.t = def.workTime / choreSpeed(b); w.face = (n.x + 0.5) * T > w.x ? 1 : -1; }
      } else if (w.st === 'work') {
        const n = w.node;
        if (!n || G.nodes[idx(n.x, n.y)] !== n) { w.st = 'home'; w.t = 0.3; continue; }
        w.t -= dt; anyWork = true;
        if (Math.floor(w.t * 3) !== Math.floor((w.t + dt) * 3)) n.shakeUntil = G.time + 0.12; // 一下一下地砍、凿
        if (w.t <= 0) {
          const isMine = def.chore === 'orevein' || def.chore === 'spiritvein';
          const take = Math.min(Math.round(def.carry * (isMine ? (G.mods && G.mods.mine) || 1 : 1)), n.amount); // 修仙“移山”：只有矿场每趟多背
          n.amount -= take; w.carry = take;
          if (n.amount <= 0) removeNode(n);
          w.node = null; w.st = 'back';
        }
      } else if (w.st === 'back') {
        w.moving = true;
        if (walk(b.cx, b.cy + 6)) {
          const res = G.def.nodes[def.chore].res;
          G.res[res] += w.carry;
          addFloat(b.cx, b.cy - 10, '+' + w.carry + ' ' + RES_INFO[res].name, RES_INFO[res].color);
          w.carry = 0; w.st = 'home'; w.t = 0.6;
        }
      }
      if (w.st !== 'home') anyWork = true;
    }
    // 是否整张地图都采光了（每秒查一次就够）
    b.choreCheck = (b.choreCheck || 0) - dt;
    if (b.choreCheck <= 0) { b.choreCheck = 1; b.choreNone = !findChoreNode(b, null); }
    b.idle = !anyWork && b.choreNone;
  }
}
// 地图上离建筑最近的资源点（别的杂役已经盯上的尽量不抢）
function findChoreNode(b, me) {
  const type = b.def.chore, bx = Math.floor(b.cx / T), by = Math.floor(b.cy / T);
  const taken = new Set();
  for (const o of G.buildings) for (const w of o.workers || []) if (w !== me && w.node) taken.add(w.node);
  let best = null, bd = 1e9;
  for (const n of G.nodes) {
    if (!n || n.type !== type) continue;
    const d = Math.hypot(n.x - bx, n.y - by) + (taken.has(n) ? 6 : 0);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
// 面板里的说明
function choreInfo(b) {
  const n = G.def.nodes[b.def.chore], res = RES_INFO[n.res].name;
  const far = (b.workers || []).some((w) => w.node && Math.hypot(w.node.x + 0.5 - b.cx / T, w.node.y + 0.5 - b.cy / T) > CHORE_NEAR);
  return '杂役 ' + choreCount(b) + ' 人，速度 ×' + choreSpeed(b).toFixed(1) + '，每趟背回 ' + b.def.carry + ' ' + res +
    (b.idle ? '　（整张地图都没有' + n.name + '了）' : far ? '　（附近采光了，正去远处采）' : '') +
    '。升级：' + (b.level < 5 ? '杂役 ' + CHORE_WORKERS[b.level + 1] + ' 人、速度再 +10%' : '已满级');
}
// 杂役小人：斗笠短褂，干活时挥工具，回程背着货
function drawChoreWorkers(ctx) {
  for (const b of G.buildings) {
    if (!b.def.chore) continue;
    const res = G.def.nodes[b.def.chore].res;
    for (const w of b.workers || []) {
      const x = Math.round(w.x), y = Math.round(w.y), f = w.face < 0 ? -1 : 1;
      const bob = w.moving ? -Math.abs(Math.sin(G.time * 10 + w.id)) : 0;
      const P = (a, c, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x + (f > 0 ? a : -a - ww), y + c + bob, ww, hh); };
      drawShadow(ctx, x, y + 0.5, 8, 0.7);
      const step = w.moving ? Math.sin(G.time * 12 + w.id) : 0;
      P(-2 + step, -2, 1.6, 2, '#3a2a22'); P(0.5 - step, -2, 1.6, 2, '#3a2a22');
      P(-2.5, -7.5, 5, 5.5, '#8f6a42'); P(-2.5, -5, 5, 1, '#5a3e28');
      P(-2, -11, 4, 3.5, '#f2d0a9');
      P(-4, -12, 8, 1.5, '#c9a86a'); P(-2, -13.5, 4, 1.5, '#b08a50'); // 斗笠
      if (w.st === 'work') { // 挥工具
        const sw = Math.sin(G.time * 14 + w.id);
        ctx.save(); ctx.translate(x + 3 * f, y - 7 + bob); ctx.rotate(f * (-0.9 + sw * 0.9));
        ctx.fillStyle = '#6e4a2e'; ctx.fillRect(-0.5, -6, 1, 6); ctx.fillStyle = '#c8d6e5'; ctx.fillRect(-1.5, -7, 3, 1.5);
        ctx.restore();
      }
      if (w.carry > 0) { // 背着货
        const col = res === 'wood' ? '#a8794f' : res === 'ore' || res === 'stone' ? '#94b0c2' : res === 'herb' ? '#38b764' : '#73eff7';
        P(-4.5, -10, 3, 5, col); P(-4.5, -10, 3, 1, '#1a1c2c');
      }
    }
  }
}
