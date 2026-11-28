// =============================================
//  公路求生：宠物在车里的生活 + 主人和宠物的互动
//  宠物自己会：饿了去食盆吃饭、晚上睡窝（没窝就睡主人床脚）、白天打盹、趴窗边软垫晒太阳、
//  猫爬上猫爬架、自己玩玩具、主人吃饭时凑过去讨吃的、主人坐着时跳上去依偎、主人回车时跑过去迎接
//  主人会：给食盆添粮、陪宠物玩（扔球 / 逗猫棒）、摸摸它；喝咖啡先接一杯，再端去坐着慢慢喝
//  pet 的字段：ix 位置(格) · tx 要去哪 · h 离地高度 · goalH 到了以后跳多高 · mode 在干嘛 · t 还剩几秒 · hunger 饿(0~100)
// =============================================

// 宠物待在这件家具上时离地多高（世界像素）；0 = 在旁边地上
function rdPetSpotH(p, cat) {
  const v = p.v;
  if (v === 'petbed') return 2;
  if (v === 'cattree') return cat ? 30 : 0;
  if (v === 'windowseat') return 8;
  if (v === 'beanbag') return 7;
  if (v === 'sofa') return 10;
  if (p.kind === 'bed') return v === 'cardboard' ? 2 : v === 'sleepbag' ? 3 : v === 'hammock' ? 0 : 9;
  return 0;
}
// 车里符合条件的家具，随便挑一件
function rdPetFind(test) {
  const l = rdR().inner.filter((it) => RD_PARTS[it.id] && test(RD_PARTS[it.id]));
  return l.length ? l[Math.floor(Math.random() * l.length)] : null;
}
// 主人坐着的话，座位多高（宠物可以跳上去依偎）；没坐着返回 0
function rdOwnerSeatH() {
  const me = rdR().me, a = me.act;
  if (!a || me.walking || me.loc !== 'in') return 0;
  const v = a.it && RD_PARTS[a.it.id] ? RD_PARTS[a.it.id].v : '';
  if (a.type === 'fun' && (v === 'sofa' || v === 'beanbag' || v === 'laptop' || v === 'carpc' || v === 'massage')) return v === 'sofa' ? 10 : v === 'beanbag' ? 7 : 8;
  if ((a.type === 'sip' || a.type === 'window') && a.seatH) return a.seatH;
  if (a.type === 'use' && a.mode === 'rest') return 7;
  return 0;
}
function rdPetGo(pet, mode, tx, h, sec) { pet.mode = mode; pet.tx = Math.max(0, tx); pet.anchor = pet.tx; pet.goalH = h || 0; pet.t = sec; pet.ate = false; pet.greeted = false; }

// 每帧：宠物的生活
function rdPetTick(dt) {
  const R = rdR(), pet = R.pet, me = R.me;
  if (!pet) return;
  const cat = pet.type === 'cat', n = Math.max(1, rdCellCount('floor'));
  pet.hunger = Math.min(100, (pet.hunger || 0) + 5 * dt / RD_HOUR); // 一天饿两三次
  if (pet.heartT > 0) pet.heartT -= dt;
  pet.h = pet.h || 0;
  // 主人叫它（摸摸、陪玩）：跑到主人身边
  const a = me.act, call = a && (a.type === 'pet' || a.type === 'playpet') && !me.walking && me.loc === 'in';
  if (call && pet.mode !== 'with') rdPetGo(pet, 'with', me.ix - 0.45, 0, 999);
  if (!call && pet.mode === 'with') pet.t = 0;
  if (pet.mode === 'with') pet.tx = a && a.type === 'playpet' ? Math.max(0, me.ix - 1.1 + Math.sin(G.time * 1.6) * 0.6) : Math.max(0, me.ix - 0.45); // 陪玩时追着球 / 逗猫棒跑来跑去
  pet.t = (pet.t || 0) - dt; // 刚收养的宠物还没有 t
  if (!(pet.t > 0)) rdPetChoose(pet, cat, n);
  // 自己玩玩具：在玩具周围扑来扑去
  if (pet.mode === 'play' && Math.abs(pet.ix - pet.anchor) < 0.9) pet.tx = Math.max(0, pet.anchor + Math.sin(G.time * 1.7) * 0.7);
  // 走过去（先从家具上跳下来），到了再跳上去
  const d = (pet.tx == null ? pet.ix : pet.tx) - pet.ix;
  pet.walking = Math.abs(d) > 0.05;
  if (pet.walking) {
    pet.h = Math.max(0, pet.h - 60 * dt);
    pet.face = d > 0 ? -1 : 1;
    const spd = pet.mode === 'greet' ? 3.2 : pet.mode === 'with' || pet.mode === 'play' ? 2.4 : 1.6;
    pet.ix += Math.sign(d) * Math.min(Math.abs(d), spd * dt);
  } else if (pet.h !== pet.goalH) pet.h += Math.sign(pet.goalH - pet.h) * Math.min(Math.abs(pet.goalH - pet.h), 70 * dt);
  // 到了以后
  if (!pet.walking) {
    if (pet.mode === 'eat') pet.face = 1; // 脸朝食盆（右边）
    if (pet.mode === 'eat' && !pet.ate) { pet.ate = true; R.petBowl = Math.max(0, (R.petBowl || 0) - 0.34); pet.hunger = 0; }
    if (pet.mode === 'greet' && !pet.greeted) { pet.greeted = true; pet.heartT = 3; pet.t = Math.min(pet.t, 3); }
    if (pet.mode === 'beg' || pet.mode === 'greet' || pet.mode === 'with' || pet.mode === 'follow') pet.face = me.ix > pet.ix ? -1 : 1; // 看着主人
  }
  pet.sleep = !pet.walking && Math.abs(pet.h - pet.goalH) < 0.5 && (pet.mode === 'sleep' || pet.mode === 'nap' || pet.mode === 'sun' || (pet.mode === 'lap' && cat));
}
// 想下一件事
function rdPetChoose(pet, cat, n) {
  const R = rdR(), me = R.me, inCar = me.loc === 'in' || me.loc === 'drive';
  const sec = (h0, h1) => (h0 + Math.random() * (h1 - h0)) * RD_HOUR;
  const at = (it) => rdItemAt(it);
  // 晚上：睡觉（宠物窝 > 主人睡的那张床的床脚 > 主人身边地上）
  if (rdIsNight()) {
    const bed = rdPetFind((p) => p.v === 'petbed');
    if (bed) return rdPetGo(pet, 'sleep', at(bed), 2, sec(2, 4));
    const ob = me.act && me.act.type === 'sleep' ? me.act.it : null;
    if (ob && RD_PARTS[ob.id].layer !== 'wall') return rdPetGo(pet, 'sleep', at(ob) + 0.3, rdPetSpotH(RD_PARTS[ob.id], cat), sec(2, 4));
    return rdPetGo(pet, 'sleep', me.ix - 0.6, 0, sec(2, 4));
  }
  // 饿了：去食盆（盆里有粮的话）
  const bowl = rdPetFind((p) => p.fx.petBowl);
  if (pet.hunger > 55 && bowl && (R.petBowl || 0) > 0.2) return rdPetGo(pet, 'eat', at(bowl) + 0.38, 0, sec(0.4, 0.6)); // 站在食盆左边
  // 主人在吃东西 / 做饭：凑过去讨吃的
  const ma = me.act;
  if (inCar && ma && (ma.type === 'eat' || ma.type === 'cook') && Math.random() < 0.6) return rdPetGo(pet, 'beg', me.ix - 0.4, 0, sec(0.4, 0.8));
  // 主人坐着：跳上去依偎（猫会打呼噜睡着）
  const sh = rdOwnerSeatH();
  if (sh && Math.random() < 0.45) return rdPetGo(pet, 'lap', me.ix - 0.38, sh, sec(1, 2.5));
  const r = Math.random();
  // 白天趴在窗边软垫上晒太阳
  const sun = rdPetFind((p) => p.fx.sunSeat);
  if (sun && r < 0.2 && !(ma && ma.it === sun)) return rdPetGo(pet, 'sun', at(sun), 8, sec(1.5, 3));
  // 猫：爬上猫爬架顶上看风景
  const tree = cat ? rdPetFind((p) => p.v === 'cattree') : null;
  if (tree && r < 0.38) return rdPetGo(pet, 'perch', at(tree), 30, sec(1, 2));
  // 自己玩玩具
  const toy = rdPetFind((p) => p.fx.petToy);
  if (toy && r < 0.52) return rdPetGo(pet, 'play', at(toy), 0, sec(0.5, 1));
  // 打个盹：宠物窝、懒人沙发、沙发、床
  if (r < 0.7) {
    const spot = rdPetFind((p) => p.v === 'petbed' || p.v === 'beanbag' || p.v === 'sofa' || (p.kind === 'bed' && p.layer !== 'wall'));
    if (spot && !(ma && ma.it === spot)) { const sp = RD_PARTS[spot.id]; return rdPetGo(pet, 'nap', at(spot) + ((sp.w || 1) > 1 ? 0.4 : 0), rdPetSpotH(sp, cat), sec(1, 2.5)); }
  }
  // 跟着主人 / 到处走走
  if (inCar && Math.random() < 0.55) return rdPetGo(pet, 'follow', me.ix + (Math.random() < 0.5 ? -0.5 : 0.5), 0, sec(0.3, 0.8));
  return rdPetGo(pet, 'wander', Math.random() * n, 0, sec(0.2, 0.6));
}
// 主人回到车上（或刚收养）：宠物冲过去迎接
function rdPetGreet() {
  const R = rdR(), pet = R.pet;
  if (!pet) return;
  rdPetGo(pet, 'greet', R.me.ix - 0.4, 0, 5);
}

// ---------- 主人和宠物 / 喝咖啡 ----------
// 主人跟宠物有关的事：食盆空了添粮、陪玩、摸摸（rdChooseAct 里调用，go = 生成活动的函数）
function rdPetOwnerAct(go) {
  const R = rdR(), pet = R.pet;
  if (!pet) return null;
  const bowl = R.inner.find((it) => RD_PARTS[it.id] && RD_PARTS[it.id].fx.petBowl);
  if (bowl && (R.petBowl || 0) < 0.3 && G.res.food >= 1) return go('feed', bowl, 0.2);
  const toy = R.inner.find((it) => RD_PARTS[it.id] && RD_PARTS[it.id].fx.petToy);
  if (toy && Math.random() < 0.12) return go('playpet', toy, 0.8, { fun: 6 });
  if (Math.random() < 0.12) return go('pet', null, 0.6, { tx: pet.ix + 0.45, fun: 4 });
  return null;
}
// 接好咖啡以后：端到窗边软垫 / 餐桌 / 沙发坐着慢慢喝；都没有就站在窗边喝
function rdSipAct() {
  const R = rdR(), me = R.me;
  const seat = R.inner.find((it) => RD_PARTS[it.id] && RD_PARTS[it.id].fx.sunSeat) || R.inner.find((it) => RD_PARTS[it.id] && ['table', 'sofa', 'beanbag'].includes(RD_PARTS[it.id].v));
  const v = seat ? RD_PARTS[seat.id].v : '';
  return { type: 'sip', it: seat || null, t: 0.6 + Math.random() * 0.4, tx: seat ? rdItemAt(seat) : me.ix, seatH: v === 'windowseat' ? 8 : v === 'table' ? 7.5 : v === 'sofa' ? 10 : v === 'beanbag' ? 7 : 0, fun: 3 };
}
// 结束时的效果（rdActEnd 里调用）
function rdPetActEnd(a) {
  const R = rdR(), me = R.me, pet = R.pet;
  if (a.type === 'feed') { if (G.res.food >= 0.25) { G.res.food -= 0.25; R.petBowl = 1; } }
  else if (a.type === 'playpet') { me.mood = Math.min(100, me.mood + 8); if (pet) { pet.heartT = 3; pet.hunger = Math.min(100, (pet.hunger || 0) + 10); } rdThink('love'); }
  else if (a.type === 'pet' && pet) pet.heartT = 3;
  else if (a.type === 'coffee') me.queue = rdSipAct();
}

// ---------- 画 ----------
// 冒出来的小爱心
function rdPetHearts(g, x, y) {
  for (let k = 0; k < 2; k++) {
    const pp = (G.time * 0.7 + k * 0.5) % 1, hx = Math.round(x + k * 5 - 2 + Math.sin(pp * 6) * 1.5), hy = Math.round(y - pp * 10);
    g.globalAlpha = 1 - pp; g.fillStyle = '#e04a6a';
    g.fillRect(hx, hy, 1, 1); g.fillRect(hx + 2, hy, 1, 1); g.fillRect(hx - 0.5, hy + 0.5, 4, 1); g.fillRect(hx + 0.5, hy + 1.5, 2, 1); g.fillRect(hx + 1, hy + 2.5, 1, 0.8);
  }
  g.globalAlpha = 1;
}
// 车里的宠物：front = false 在主人前面画，true 在主人后面画（依偎在主人身上的时候盖在主人上面）
function rdPetDraw(g, lay, ox, floorY, front) {
  const R = G.road, pet = R.pet, me = R.me;
  if (!pet || me.loc === 'out' || me.loc === 'site') return;
  const lap = pet.mode === 'lap' && !pet.walking && pet.h > 1;
  if (lap !== front) return;
  const px = rdCellX(lay, ox, Math.floor(pet.ix), 'floor') - (pet.ix % 1) * RD_CELL;
  let y = floorY - (pet.h || 0);
  const playing = pet.mode === 'play' || (pet.mode === 'with' && me.act && me.act.type === 'playpet');
  if (playing && pet.walking) y -= Math.abs(Math.sin(G.time * 7)) * 4; // 蹦蹦跳跳
  const st = pet.mode === 'eat' && !pet.walking ? 'eat' : pet.sleep;
  rdhPet(g, px, y, pet.type, pet.walking, pet.sleep ? 1 : pet.face, st);
  if (pet.sleep) rdZzz(g, px + 3, y - 8);
  if (pet.heartT > 0 || (pet.mode === 'with' && !pet.walking) || (pet.mode === 'lap' && !pet.walking)) rdPetHearts(g, px, y - 14);
  if (pet.mode === 'beg' && !pet.walking && Math.floor(G.time * 1.5) % 2) rdDrawBubble(g, px + 2, y - 16, 'hungry');
  if (pet.mode === 'eat' && !pet.walking) { const f = pet.face < 0 ? -1 : 1; g.fillStyle = '#c87a4a'; for (let k = 0; k < 2; k++) if ((G.time * 3 + k) % 1 < 0.5) g.fillRect(px + f * (11 + k * 2), y - 3 - k, 1, 1); } // 嘴边碎屑乱飞
}
// 主人和宠物互动时的特效：扔球给狗（球画抛物线）、晃逗猫棒（棒头羽毛晃）
function rdPetPlayFx(g, px, y, top) {
  const R = G.road, pet = R.pet, me = R.me, a = me.act;
  if (!pet || !a || a.type !== 'playpet' || me.walking) return;
  const t = G.time;
  if (pet.type === 'dog') {
    const pp = (t * 0.8) % 1, bx = px - pp * 22, by = y - 12 - Math.sin(pp * Math.PI) * 14;
    g.fillStyle = '#e04a3a'; g.fillRect(bx - 1, by - 1, 2.5, 2.5); g.fillStyle = '#f4f4f4'; g.fillRect(bx - 0.5, by - 0.5, 1, 1);
  } else {
    const hx = px - 3, hy = top + 18, ex = hx - 12 + Math.sin(t * 5) * 3, ey = hy - 6 + Math.cos(t * 7) * 2;
    g.strokeStyle = '#a87850'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo((hx + ex) / 2, hy - 8, ex, ey); g.stroke();
    g.fillStyle = '#c27bd6'; g.fillRect(ex - 1.5, ey, 3, 2); g.fillStyle = '#ffcd75'; g.fillRect(ex - 0.5, ey + 2, 1, 2);
  }
}
