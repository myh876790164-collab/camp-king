// =============================================
//  主动防守（丧尸模式）
//  · 营地里的同伴：丧尸进入营地范围就主动迎上去打；建筑（路障、铁门……）被攻击时优先去支援
//    近战的人贴上去砍，用枪的人在射程边上站定开火；附近没敌人了就回到自己的岗位
//  · 分基地：第 3 天起，夜里会有少量丧尸去袭击，驻守的人当场迎战；他被打倒，分基地就丢了
//    （主要的压力还是在主基地：分基地每次只来几只）
// =============================================
const GUARD_R = 11; // 营地范围（离避难所多少格以内算“进入营地”）

function inGuardZone(m) { return Math.hypot(m.x - G.core.cx, m.y - G.core.cy) < GUARD_R * T; }

// 挑一个目标：正在攻击建筑的丧尸优先，其次离自己最近的
function guardTarget(s) {
  let best = null, bd = 1e9;
  const taken = new Map();
  for (const o of campSurvivors()) if (o !== s && o.guard && o.guard.alive) taken.set(o.guard, (taken.get(o.guard) || 0) + 1);
  for (const m of G.monsters) {
    if (!m.alive || m.raid || !inGuardZone(m)) continue;
    let d = Math.hypot(m.x - s.x, m.y - s.y);
    if (G.clock - (m.atkT || -99) < 2) d *= 0.4;          // 正在砸建筑的，优先处理
    if (m.def.boss) d *= 0.8;
    d *= 1 + 0.35 * (taken.get(m) || 0);                   // 别都挤到同一只身上
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}

function usableWeapon(s) {
  const w = WEAPONS[s.weapon];
  return w.ammo && (G.res.ammo || 0) < w.ammo ? GUN_BUTT : w;
}

// 每帧：营地里的同伴（在营地、没倒下）的走位
function updateGuard(s, dt) {
  if ((s.state || 'base') !== 'base' || s.down) return;
  s.gT = (s.gT || 0) - dt;
  if (s.gT <= 0) { s.gT = 0.35; const g = guardTarget(s); if (g !== s.guard) s.gpath = null; s.guard = g; }
  const m = s.guard && s.guard.alive && inGuardZone(s.guard) ? s.guard : null;
  let tx, ty, stopAt;
  if (m) {
    // 近战贴身，枪械在射程的七成处站定
    stopAt = Math.max(0.65, personRange(s, usableWeapon(s)) * 0.7) * T;
    tx = m.x; ty = m.y;
  } else {
    tx = s.hx; ty = s.hy; stopAt = 2;
  }
  const d = Math.hypot(tx - s.x, ty - s.y);
  if (d <= stopAt) { s.gpath = null; return; }
  const speed = 3.1 * T * personMoveMul(s), ox = s.x, oy = s.y;
  if (s.gpath && s.gpath.length) {
    if (moveFree(s, s.gpath[0].x, s.gpath[0].y, speed, dt)) s.gpath.shift();
  } else moveFree(s, tx, ty, speed, dt);
  // 被墙挡住：用寻路绕过去
  if (Math.hypot(s.x - ox, s.y - oy) < speed * dt * 0.3) {
    s.gstuck = (s.gstuck || 0) + dt;
    if (s.gstuck > 0.4) {
      s.gstuck = 0;
      s.gpath = findPath(Math.floor(s.x / T), Math.floor(s.y / T), Math.floor(tx / T), Math.floor(ty / T)) || [];
    }
  } else s.gstuck = 0;
}

// ---------- 分基地夜袭 ----------
function outpostRaidCount(st) {
  return Math.max(1, Math.round(1 + G.day / 4 + STRUCTS[st.type].danger * 0.3 - (st.op.lv - 1) * 0.7));
}
// 入夜时：给一部分分基地派几只丧尸
function outpostNight() {
  if (G.day < 3) return [];
  const notes = [];
  for (const st of outposts()) {
    const w = outpostWorker(st);
    if (!w || w.down || Math.random() > outpostRaidChance(st) * 2) continue;
    const e = structEntrance(st) || { x: st.x, y: st.y + st.h };
    const n = outpostRaidCount(st);
    for (let k = 0; k < n; k++) {
      const pos = randomWalkable((e.x + 0.5) * T, (e.y + 0.5) * T, 6, 10);
      if (!pos) continue;
      spawnMonster(G.day >= 4 && Math.random() < 0.3 ? 'runner' : 'walker', (pos.x + 0.5) * T, (pos.y + 0.5) * T, { wander: true, raid: st });
    }
    st.raided = true;
    notes.push(STRUCTS[st.type].name + '分基地遭到 ' + n + ' 只丧尸袭击');
  }
  return notes;
}
// 袭击分基地的丧尸：只盯着驻守的人
function raidAI(m, dt) {
  const st = m.raid, w = st && st.op ? outpostWorker(st) : null;
  if (!w || w.down) { m.raid = null; return false; }
  const d = Math.hypot(w.x - m.x, w.y - m.y);
  if (d < T * 0.75) {
    if (m.cd <= 0) { m.cd = 1 / m.def.rate; hurtSurvivor(w, m.dmg, m); }
  } else moveFree(m, w.x, w.y, monsterSpeed(m), dt);
  return true;
}
