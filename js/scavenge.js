// =============================================
//  同伴自动搜刮（丧尸模式）
//  白天：健康的同伴自己出门，走到城里的建筑进去搜刮，搜完可能再去下一栋
//  天快黑 / 受了重伤 / 搜够了：自己走回营地，把带回来的物资交给营地
//  能力越强搜得越多：搜刮技能、拾荒者 / 幸运天赋、异能（智力、空间加成更多，异能等级越高越多）
//  路上会遇到丧尸，楼里的丧尸要先打掉；被打倒的话身上带的东西就丢了
// =============================================
const TRIP_STATE = { base: '在营地', go: '前往', in: '正在搜刮', home: '返回营地' };

function survivorTripText(s) {
  if (s.down) return '倒下了';
  if (s.post !== undefined && s.post !== null) return '派驻在分基地';
  if (s.stay) return '留守营地';
  const st = s.state || 'base';
  if ((st === 'go' || st === 'in') && s.target) return TRIP_STATE[st] + ' ' + STRUCTS[s.target.type].name;
  if (st === 'base' && s.lastOut === G.day && G.phase === 'day') return '今天已经搜刮回来了';
  return TRIP_STATE[st];
}
// 搜刮能力（倍数）：越大搜得越多
function scavPower(s) {
  const a = AB(s);
  // 同伴自己搜只能拿走一部分（0.55），技能、天赋、异能越强拿得越多
  return 0.55 * (1 + 0.06 * s.skills.scav) * (hasT(s, 'scavenger') ? 1.2 : 1) * Math.sqrt(a ? a.lootMul : 1) * (1 + 0.015 * abLevel(s));
}
// 一天最多搜几栋楼
function maxTrips(s) {
  const a = AB(s);
  return Math.min(3, 1 + (s.skills.scav >= 3 ? 1 : 0) + (hasT(s, 'scavenger') ? 1 : 0) + (a && a.searchMul > 1.5 ? 1 : 0));
}
function survivorWantsOut(s) {
  return !s.stay && !s.down && G.phase === 'day' && G.timer > 40 && s.lastOut !== G.day &&
    s.hp >= personMaxHp(s) * 0.5 && s.morale >= 25;
}

function tripPath(s, tx, ty) {
  const path = findPath(Math.floor(s.x / T), Math.floor(s.y / T), tx, ty);
  s.path = path || [];
  s.stuck = 0;
  return !!path;
}
// 挑一栋还有东西的楼（不和别的同伴抢同一栋）
function pickTarget(s) {
  const taken = G.survivors.filter((o) => o !== s && o.target).map((o) => o.target);
  const cands = [];
  for (const st of G.structs) {
    if (st.home || st.op || !structEnterable(st) || taken.includes(st) || structLeftCount(st) <= 0) continue;
    const d = structDist(st, s.x, s.y) / T;
    if (d < 4 || d > 34) continue;
    cands.push([st, d + Math.random() * 6]);
  }
  cands.sort((a, b) => a[1] - b[1]);
  for (const [st] of cands.slice(0, 6)) {
    const door = structEntrance(st);
    if (door && tripPath(s, door.x, door.y)) { s.target = st; s.door = door; s.state = 'go'; return true; }
  }
  return false;
}
function goHome(s) {
  s.target = null;
  s.state = 'home';
  if (!tripPath(s, Math.floor(s.hx / T), Math.floor(s.hy / T))) { s.x = s.hx; s.y = s.hy; arriveHome(s); }
}
function followTripPath(s, dt) {
  if (!s.path.length) return true;
  const ox = s.x, oy = s.y;
  const speed = 3 * T * personMoveMul(s);
  if (moveFree(s, s.path[0].x, s.path[0].y, speed, dt)) s.path.shift();
  s.stuck = Math.hypot(s.x - ox, s.y - oy) < 0.05 ? (s.stuck || 0) + dt : 0;
  if (s.stuck > 1.5) { s.path.shift(); s.stuck = 0; } // 被挡住：跳过这一步
  return !s.path.length;
}

// 按物资表掷骰子，放进同伴的背包（回营地才交）
function rollInto(bag, L, s) {
  const mult = scavPower(s), luck = hasT(s, 'lucky') ? 1.6 : 1;
  for (const r of ['food', 'water', 'parts', 'ammo']) {
    if (!L[r] || Math.random() > L[r][2]) continue;
    bag[r] += Math.round(randInt(L[r][0], L[r][1]) * mult);
  }
  if (L.w && Math.random() < L.w * luck) bag.items.push(randomItem('w', L.wPool));
  else if (L.a && Math.random() < L.a * luck) bag.items.push(randomItem('a', L.aPool));
  if (L.c && Math.random() < L.c) bag.items.push(Math.random() < 0.75 ? 'c:bandage' : 'c:medkit');
}

// 在楼里：先和里面的丧尸打，再搜几个柜子
function survivorSearch(s, st) {
  const bag = s.bag;
  // 楼里的丧尸
  const w = WEAPONS[s.weapon], lvl = abLevel(s);
  while ((st.zIn || 0) > 0 && !s.down) {
    const z = st.zs && st.zs.length ? st.zs[0] : ['walker', '', 1];
    const tough = z[1] ? 0.25 : 0;
    const win = Math.max(0.25, Math.min(0.95, 0.45 + w.dmg / 45 + lvl * 0.03 + s.skills.melee * 0.03 - tough));
    if (Math.random() < win) {
      st.zIn--; if (st.zs) st.zs.shift();
      G.kills++; s.stats.kills++;
      if (z[1]) bag.items.push('k:' + z[1]); // 变异丧尸：带回晶核
      else if (Math.random() < 0.06) bag.items.push('k:' + pick(ABIL_KEYS));
    } else {
      hurtSurvivor(s, randInt(8, 16) * (z[1] ? 1.5 : 1));
      if (s.hp < personMaxHp(s) * 0.3) break; // 打不过，撤
    }
  }
  if (s.down || (st.zIn || 0) > 0) return;
  // 搜柜子：能力越强，搜的柜子越多
  const it = genInterior(st);
  st.nc = it.cont.length;
  st.opened = st.opened || {};
  const avail = it.cont.filter((f) => containerAvailable(st, f.ci));
  const a = AB(s);
  // 每栋楼搜几个柜子：普通同伴 2 个，能力强的最多 4 个
  let n = Math.min(4, 2 + (s.skills.scav >= 3 ? 1 : 0) + (a && lvl >= 6 ? 1 : 0));
  while (n-- > 0 && avail.length) {
    const f = avail.splice(Math.floor(Math.random() * avail.length), 1)[0];
    rollInto(bag, CONT[f.k].loot, s);
    st.opened[f.ci] = G.day;
    s.stats.searches++;
    gainSkill(s, 'scav', 1);
  }
  st.left = structLeftCount(st);
}

function arriveHome(s) {
  s.state = 'base';
  s.x = s.hx; s.y = s.hy;
  s.path = [];
  const b = s.bag;
  s.bag = null;
  if (!b) return;
  const got = [];
  for (const r of ['food', 'water', 'parts', 'ammo']) if (b[r] > 0) { G.res[r] = (G.res[r] || 0) + b[r]; got.push(RES_INFO[r].name + '+' + b[r]); }
  for (const k of b.items) { addItem(k); got.push(itemName(k)); }
  const text = s.name + ' 带回：' + (got.length ? got.join(' ') : '什么也没找到');
  addFloat(s.x, s.y - 18, got.length ? s.name + ' 带回物资' : s.name + ' 空手而归', got.length ? '#a7f070' : '#94b0c2', true);
  G.scavLog = G.scavLog || [];
  G.scavLog.push(text);
  if (got.length) sfx('coin');
}

// 每帧更新一个同伴的外出行动
function updateSurvivorTrip(s, dt) {
  if (!s.state) s.state = 'base';
  if (s.down) { s.target = null; s.bag = null; return; }
  const mustReturn = G.phase !== 'day' || G.timer < 25 || s.hp < personMaxHp(s) * 0.35;
  if (s.state === 'base') {
    if (survivorWantsOut(s)) {
      s.leaveT = (s.leaveT === undefined || s.leaveT === null ? rand(1, 6) : s.leaveT) - dt;
      if (s.leaveT <= 0) {
        s.leaveT = null;
        s.lastOut = G.day;
        s.bag = { food: 0, water: 0, parts: 0, ammo: 0, items: [] };
        s.trips = 0;
        if (pickTarget(s)) addFloat(s.x, s.y - 18, s.name + ' 出门搜刮了', '#73eff7', true);
        else s.bag = null;
      }
    }
    return;
  }
  if (s.state === 'go') {
    if (mustReturn) { goHome(s); return; }
    if (followTripPath(s, dt) || Math.hypot(s.x - (s.door.x + 0.5) * T, s.y - (s.door.y + 0.5) * T) < T * 0.8) {
      s.state = 'in';
      s.inT = 14 / Math.sqrt(searchSpeed(s)); // 在楼里搜刮的时间
    }
    return;
  }
  if (s.state === 'in') {
    s.inT -= dt;
    if (s.inT > 0 && !mustReturn) return;
    if (s.inT <= 0) { survivorSearch(s, s.target); s.trips++; }
    if (s.down) return;
    if (mustReturn || s.trips >= maxTrips(s) || s.hp < personMaxHp(s) * 0.5 || !pickTarget(s)) goHome(s);
    return;
  }
  if (s.state === 'home') {
    if (followTripPath(s, dt) || Math.hypot(s.x - s.hx, s.y - s.hy) < T) arriveHome(s);
  }
}

// 入夜时：汇报今天同伴带回来的东西
function scavReport() {
  const log = G.scavLog || [];
  G.scavLog = [];
  return log.length ? log.join('；') : null;
}
