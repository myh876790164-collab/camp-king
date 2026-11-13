// =============================================
//  建筑内部（丧尸模式）
//  点城市里的建筑 → 走到大门 → 进入内部地图
//  每种建筑按自己的设定生成户型（民居有客厅厨房卧室，医院有病房药房，超市有货架和仓库……）
//  物资放在柜子、冰箱、箱子等容器里，点击容器搜刮；点大门回到城市
//  营地建筑内部可以摆放床位（每张床 = 1 个人口）
// =============================================
const IT = { VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3 };
const RESTOCK_DAYS = 6; // 搜过的容器过几天会有新物资

// ---------- 容器：名字 + 物资表（[最少, 最多, 概率]，w/a/c = 武器/护甲/药品的概率） ----------
const CONT = {
  fridge: { name: '冰箱', loot: { food: [2, 5, 0.8], water: [1, 4, 0.7] } },
  counter: { name: '橱柜', loot: { food: [1, 4, 0.7], parts: [0, 1, 0.2] } },
  freezer: { name: '冰柜', loot: { food: [3, 7, 0.85] } },
  shelf: { name: '货架', loot: { food: [2, 5, 0.7], water: [1, 4, 0.5] } },
  wardrobe: { name: '衣柜', loot: { a: 0.15, aPool: ['jacket'], parts: [1, 2, 0.35] } },
  drawer: { name: '床头柜', loot: { parts: [1, 2, 0.4], ammo: [1, 4, 0.15], c: 0.12, w: 0.05, wPool: ['knife', 'pistol'] } },
  bookshelf: { name: '书架', loot: { parts: [1, 2, 0.45] } },
  medcab: { name: '药柜', loot: { c: 0.6 } },
  medshelf: { name: '药品架', loot: { c: 0.8, water: [1, 3, 0.3] } },
  desk: { name: '办公桌', loot: { ammo: [1, 3, 0.08], parts: [1, 3, 0.5], food: [0, 2, 0.2], c: 0.05 } },
  filing: { name: '文件柜', loot: { parts: [1, 3, 0.55] } },
  cooler: { name: '饮水机', loot: { water: [2, 5, 0.9] } },
  vending: { name: '自动售货机', loot: { food: [2, 4, 0.7], water: [2, 4, 0.7] } },
  register: { name: '收银台', loot: { parts: [1, 3, 0.6], ammo: [1, 3, 0.1] } },
  crate: { name: '木箱', loot: { parts: [2, 5, 0.6], food: [1, 3, 0.3], ammo: [2, 5, 0.15] } },
  rack: { name: '仓储货架', loot: { parts: [2, 6, 0.7], food: [1, 3, 0.3], water: [1, 3, 0.3] } },
  plocker: { name: '警用储物柜', loot: { ammo: [3, 8, 0.7], a: 0.35, aPool: ['vest', 'riot'], w: 0.15, wPool: ['pistol', 'knife'] } },
  flocker: { name: '消防储物柜', loot: { a: 0.3, aPool: ['jacket'], w: 0.2, wPool: ['axe'] } },
  locker: { name: '储物柜', loot: { ammo: [1, 4, 0.15], parts: [1, 2, 0.4], a: 0.08, aPool: ['jacket'], food: [0, 2, 0.2] } },
  gunlocker: { name: '枪柜', loot: { ammo: [8, 16, 0.95], w: 0.75, wPool: ['pistol', 'shotgun', 'rifle'] } },
  toolbox: { name: '工具箱', loot: { parts: [2, 5, 0.8], w: 0.1, wPool: ['knife', 'bat', 'axe'] } },
  sack: { name: '饲料袋', loot: { food: [2, 5, 0.8] } },
  schooldesk: { name: '课桌', loot: { parts: [0, 2, 0.35], food: [0, 2, 0.3] } },
  workbench2: { name: '工作台', loot: { parts: [3, 6, 0.8] } },
};

// ---------- 每种建筑的户型 ----------
// layout: bsp = 随机切分房间；hall = 后面一排小房间 + 前面一个大厅；corridor = 中间走廊、两边房间
const IPLANS = {
  house: { layout: 'bsp', rooms: ['living', 'kitchen', 'bedroom', 'bathroom', 'bedroom'], wall: '#c9b7a0' },
  apartment: { layout: 'corridor', rooms: ['living', 'kitchen', 'bedroom', 'bathroom', 'bedroom', 'kitchen'], wall: '#b98a6a' },
  office: { layout: 'bsp', rooms: ['office', 'office', 'reception', 'breakroom', 'office', 'bathroom'], wall: '#8b93a3' },
  shop: { layout: 'hall', hall: 'store', back: ['storage'], wall: '#d8dde6' },
  supermarket: { layout: 'hall', hall: 'market', back: ['storage', 'freezer', 'office', 'storage'], wall: '#e8eef5' },
  hospital: { layout: 'corridor', rooms: ['reception', 'ward', 'pharmacy', 'ward', 'office', 'ward'], wall: '#e8eef5' },
  police: { layout: 'bsp', rooms: ['reception', 'armory', 'cells', 'plocker', 'office', 'office'], wall: '#a7b2c2' },
  firestation: { layout: 'hall', hall: 'garage', back: ['flocker', 'kitchen', 'bedroom'], wall: '#a8423a' },
  school: { layout: 'corridor', rooms: ['classroom', 'classroom', 'cafeteria', 'classroom', 'office', 'bathroom'], wall: '#c46a3a' },
  factory: { layout: 'hall', hall: 'factory', back: ['office', 'locker', 'storage'], wall: '#6b7a8f' },
  warehouse: { layout: 'hall', hall: 'warehouse', back: ['office', 'storage'], wall: '#9aa0ad' },
  gasstation: { layout: 'hall', hall: 'kiosk', back: ['garage2', 'storage'], wall: '#e8eef5' },
  barn: { layout: 'hall', hall: 'barn', back: ['storage'], wall: '#a8423a' },
};
// 地板：wood 木地板 / tile 瓷砖 / carpet 地毯 / concrete 水泥 / lino 塑胶 / dirt 泥地
const FLOORS = ['wood', 'tile', 'carpet', 'concrete', 'lino', 'dirt'];
const ROOM_FLOOR = {
  living: 'wood', bedroom: 'carpet', kitchen: 'tile', bathroom: 'tile', office: 'carpet', reception: 'lino', breakroom: 'lino',
  store: 'lino', market: 'lino', storage: 'concrete', freezer: 'tile', ward: 'lino', pharmacy: 'lino', cells: 'concrete',
  armory: 'concrete', plocker: 'concrete', flocker: 'concrete', locker: 'concrete', garage: 'concrete', garage2: 'concrete',
  classroom: 'wood', cafeteria: 'tile', factory: 'concrete', warehouse: 'concrete', kiosk: 'lino', barn: 'dirt',
};
// 房间里放什么：[种类, 宽, 高, 位置（wall 靠墙 / free 任意 / rug 地毯）]，种类在 CONT 里的就是可搜索的容器
const ROOM_FURN = {
  living: [['rug', 3, 2, 'rug'], ['sofa', 2, 1, 'wall'], ['tv', 1, 1, 'wall'], ['bookshelf', 1, 1, 'wall'], ['table', 1, 1, 'free'], ['plant', 1, 1, 'wall'], ['drawer', 1, 1, 'wall']],
  kitchen: [['counter', 1, 1, 'wall'], ['counter', 1, 1, 'wall'], ['stove', 1, 1, 'wall'], ['fridge', 1, 1, 'wall'], ['table', 1, 1, 'free'], ['chair', 1, 1, 'free']],
  bedroom: [['bed', 1, 2, 'wall'], ['wardrobe', 1, 1, 'wall'], ['drawer', 1, 1, 'wall'], ['rug', 2, 1, 'rug'], ['plant', 1, 1, 'wall']],
  bathroom: [['toilet', 1, 1, 'wall'], ['bathtub', 1, 2, 'wall'], ['sink', 1, 1, 'wall'], ['medcab', 1, 1, 'wall']],
  office: [['desk', 2, 1, 'free'], ['desk', 2, 1, 'free'], ['filing', 1, 1, 'wall'], ['filing', 1, 1, 'wall'], ['plant', 1, 1, 'wall'], ['cooler', 1, 1, 'wall']],
  reception: [['desk', 2, 1, 'free'], ['chair', 1, 1, 'free'], ['chair', 1, 1, 'free'], ['plant', 1, 1, 'wall'], ['cooler', 1, 1, 'wall'], ['vending', 1, 1, 'wall']],
  breakroom: [['counter', 1, 1, 'wall'], ['fridge', 1, 1, 'wall'], ['vending', 1, 1, 'wall'], ['table', 1, 1, 'free'], ['chair', 1, 1, 'free']],
  storage: [['crate', 1, 1, 'wall'], ['crate', 1, 1, 'wall'], ['crate', 1, 1, 'free'], ['pallet', 1, 1, 'free'], ['crate', 1, 1, 'wall']],
  freezer: [['freezer', 1, 1, 'wall'], ['freezer', 1, 1, 'wall'], ['freezer', 1, 1, 'wall'], ['crate', 1, 1, 'wall']],
  ward: [['hbed', 1, 2, 'wall'], ['hbed', 1, 2, 'wall'], ['hbed', 1, 2, 'wall'], ['medcab', 1, 1, 'wall'], ['chair', 1, 1, 'free']],
  pharmacy: [['medshelf', 1, 1, 'wall'], ['medshelf', 1, 1, 'wall'], ['medshelf', 1, 1, 'wall'], ['medshelf', 1, 1, 'wall'], ['desk', 2, 1, 'free']],
  cells: [['bars', 3, 1, 'free'], ['bunkbed', 1, 2, 'wall'], ['toilet', 1, 1, 'wall'], ['bunkbed', 1, 2, 'wall']],
  armory: [['gunlocker', 1, 1, 'wall'], ['gunlocker', 1, 1, 'wall'], ['crate', 1, 1, 'wall'], ['plocker', 1, 1, 'wall']],
  plocker: [['plocker', 1, 1, 'wall'], ['plocker', 1, 1, 'wall'], ['plocker', 1, 1, 'wall'], ['bench', 2, 1, 'free']],
  flocker: [['flocker', 1, 1, 'wall'], ['flocker', 1, 1, 'wall'], ['flocker', 1, 1, 'wall'], ['bench', 2, 1, 'free']],
  locker: [['locker', 1, 1, 'wall'], ['locker', 1, 1, 'wall'], ['locker', 1, 1, 'wall'], ['bench', 2, 1, 'free']],
  garage: [['truck', 4, 2, 'free'], ['toolbox', 1, 1, 'wall'], ['flocker', 1, 1, 'wall'], ['crate', 1, 1, 'wall'], ['toolbox', 1, 1, 'wall']],
  garage2: [['toolbox', 1, 1, 'wall'], ['workbench2', 2, 1, 'wall'], ['crate', 1, 1, 'wall']],
  cafeteria: [['ltable', 3, 1, 'free'], ['ltable', 3, 1, 'free'], ['counter', 1, 1, 'wall'], ['counter', 1, 1, 'wall'], ['fridge', 1, 1, 'wall'], ['vending', 1, 1, 'wall']],
  factory: [['machine', 2, 2, 'free'], ['machine', 2, 2, 'free'], ['machine', 2, 2, 'free'], ['workbench2', 2, 1, 'wall'], ['toolbox', 1, 1, 'wall'], ['crate', 1, 1, 'wall'], ['crate', 1, 1, 'free'], ['toolbox', 1, 1, 'wall']],
  barn: [['tractor', 3, 2, 'free'], ['hay', 1, 1, 'free'], ['hay', 1, 1, 'free'], ['hay', 1, 1, 'wall'], ['sack', 1, 1, 'wall'], ['sack', 1, 1, 'wall'], ['toolbox', 1, 1, 'wall']],
  market: [], warehouse: [], store: [], kiosk: [], classroom: [],
};

// ---------- 生成内部地图（同一栋楼每次生成都一样） ----------
function interiorSeed(s) { return ((G.citySeed || 1) ^ (s.x * 7919 + s.y * 104729)) | 0; }

function genInterior(s, opts) {
  opts = opts || {};
  const R = mulberry(interiorSeed(s));
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pk = (arr) => arr[Math.floor(R() * arr.length)];
  const d = STRUCTS[s.type], plan = IPLANS[s.type] || IPLANS.house;
  const W = Math.max(12, Math.min(28, d.w * 4 + 2)), H = Math.max(10, Math.min(20, d.h * 4 + 2));
  const N = W * H, I = (x, y) => y * W + x;
  const t = new Uint8Array(N), fl = new Uint8Array(N), occ = new Int16Array(N), resv = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) t[I(x, y)] = x === 0 || y === 0 || x === W - 1 || y === H - 1 ? IT.WALL : IT.FLOOR;
  const door = { x: W >> 1, y: H - 1 };
  t[I(door.x, door.y)] = IT.DOOR;
  const rooms = [], gaps = [];
  const hwall = (y, x0, x1) => { for (let x = x0; x <= x1; x++) t[I(x, y)] = IT.WALL; };
  const vwall = (x, y0, y1) => { for (let y = y0; y <= y1; y++) t[I(x, y)] = IT.WALL; };
  const gap = (x, y) => { t[I(x, y)] = IT.FLOOR; gaps.push([x, y]); };

  if (plan.layout === 'hall') {
    // 后面一排小房间 + 前面的大厅
    const backH = ri(3, 4), wy = backH + 1, n = plan.back.length;
    hwall(wy, 1, W - 2);
    let x0 = 1;
    for (let k = 0; k < n; k++) {
      const x1 = k === n - 1 ? W - 2 : x0 + Math.floor((W - 2) / n) - 1;
      if (k < n - 1) vwall(x1 + 1, 1, backH);
      rooms.push({ x0, y0: 1, x1, y1: backH, kind: plan.back[k] });
      gap(ri(x0, x1), wy);
      x0 = x1 + 2;
    }
    rooms.push({ x0: 1, y0: wy + 1, x1: W - 2, y1: H - 2, kind: plan.hall, hall: true });
  } else if (plan.layout === 'corridor') {
    // 从大门笔直通到最里面的走廊，两边是房间
    const cx = door.x, kinds = plan.rooms.slice();
    vwall(cx - 2, 1, H - 2); vwall(cx + 1, 1, H - 2);
    rooms.push({ x0: cx - 1, y0: 1, x1: cx, y1: H - 2, kind: 'reception', corridor: true });
    for (const [bx0, bx1, gx] of [[1, cx - 3, cx - 2], [cx + 2, W - 2, cx + 1]]) {
      let y0 = 1;
      while (y0 <= H - 2) {
        let y1 = Math.min(H - 2, y0 + ri(3, 5));
        if (H - 2 - y1 < 3) y1 = H - 2;
        rooms.push({ x0: bx0, y0, x1: bx1, y1, kind: kinds.length ? kinds.shift() : pk(plan.rooms) });
        gap(gx, ri(y0, y1));
        if (y1 < H - 2) hwall(y1 + 1, bx0, bx1);
        y0 = y1 + 2;
      }
    }
  } else {
    // BSP：把房子随机切成几个房间，每道墙留一个门洞
    const split = (r, depth) => {
      const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
      if (depth >= 3 || (w < 9 && h < 9) || (w * h < 40 && R() < 0.5)) { rooms.push(r); return; }
      const vert = w > h ? true : h > w ? false : R() < 0.5;
      for (let tries = 0; tries < 12; tries++) {
        if (vert && w >= 9) {
          const sx = ri(r.x0 + 4, r.x1 - 4);
          if (sx === door.x || t[I(sx, r.y0 - 1)] === IT.FLOOR || t[I(sx, r.y1 + 1)] === IT.FLOOR || t[I(sx, r.y1 + 1)] === IT.DOOR) continue;
          vwall(sx, r.y0, r.y1); gap(sx, ri(r.y0, r.y1));
          split({ x0: r.x0, y0: r.y0, x1: sx - 1, y1: r.y1 }, depth + 1);
          split({ x0: sx + 1, y0: r.y0, x1: r.x1, y1: r.y1 }, depth + 1);
          return;
        }
        if (!vert && h >= 9) {
          const sy = ri(r.y0 + 4, r.y1 - 4);
          if (t[I(r.x0 - 1, sy)] === IT.FLOOR || t[I(r.x1 + 1, sy)] === IT.FLOOR) continue;
          hwall(sy, r.x0, r.x1); gap(ri(r.x0, r.x1), sy);
          split({ x0: r.x0, y0: r.y0, x1: r.x1, y1: sy - 1 }, depth + 1);
          split({ x0: r.x0, y0: sy + 1, x1: r.x1, y1: r.y1 }, depth + 1);
          return;
        }
      }
      rooms.push(r);
    };
    split({ x0: 1, y0: 1, x1: W - 2, y1: H - 2 }, 0);
    // 有大门的房间排第一（客厅 / 接待处），其他按面积从大到小
    const front = rooms.findIndex((r) => door.x >= r.x0 && door.x <= r.x1 && r.y1 === H - 2);
    const fr = rooms.splice(front < 0 ? 0 : front, 1)[0];
    rooms.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
    rooms.unshift(fr);
    rooms.forEach((r, k) => { r.kind = plan.rooms[k % plan.rooms.length]; });
  }

  // 地板 + 门洞
  for (const r of rooms) {
    const f = FLOORS.indexOf(ROOM_FLOOR[r.kind] || 'wood');
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) fl[I(x, y)] = f;
  }
  for (const [x, y] of gaps) {
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => fl[I(x + dx, y + dy)]).find((v) => v !== undefined);
    fl[I(x, y)] = nb || 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) resv[I(x + dx, y + dy)] = 1;
  }
  fl[I(door.x, door.y)] = fl[I(door.x, door.y - 1)];
  resv[I(door.x, door.y - 1)] = 1; resv[I(door.x, door.y - 2)] = 1;
  if (door.x > 1) resv[I(door.x - 1, door.y - 1)] = 1;
  if (door.x < W - 2) resv[I(door.x + 1, door.y - 1)] = 1; // 门口两边都留空，柜子不会贴着出口

  const it = { s, W, H, t, fl, occ, resv, door, rooms, gaps, furn: [], cont: [], zombies: [], fx: [], proj: [], floats: [], wall: plan.wall, home: !!opts.home };
  // 放家具：放完检查是否还能走到每一处，不能就撤销
  const put = (k, x, y, w, h) => {
    if (k !== 'rug') {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        if (xx < 1 || yy < 1 || xx > W - 2 || yy > H - 2) return false;
        const i = I(xx, yy);
        if (t[i] !== IT.FLOOR || occ[i] || resv[i]) return false;
      }
    }
    const f = { k, x, y, w, h, ci: -1 };
    if (k === 'rug') { it.furn.push(f); return true; }
    const fi = it.furn.length;
    it.furn.push(f);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) occ[I(xx, yy)] = fi + 1;
    if (CONT[k] && !opts.noLoot) { f.ci = it.cont.length; it.cont.push(f); }
    if (!interiorConnected(it)) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) occ[I(xx, yy)] = 0;
      it.furn.pop();
      if (f.ci >= 0) it.cont.pop();
      return false;
    }
    return true;
  };
  const nearWall = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (t[I(xx - 1, yy)] === IT.WALL || t[I(xx + 1, yy)] === IT.WALL || t[I(xx, yy - 1)] === IT.WALL || t[I(xx, yy + 1)] === IT.WALL) return true;
    }
    return false;
  };
  const place = (r, k, w, h, mode) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = ri(r.x0, r.x1 - w + 1), y = ri(r.y0, r.y1 - h + 1);
      if (x < r.x0 || y < r.y0) return false;
      if (mode === 'wall' && !nearWall(x, y, w, h)) continue;
      if (mode === 'free' && w * h > 1 && (x === r.x0 || y === r.y0 || x + w - 1 === r.x1 || y + h - 1 === r.y1) && tries < 25) continue;
      if (put(k, x, y, w, h)) return true;
    }
    return false;
  };
  // 一排排的货架 / 课桌
  const rows = (r, k, len, rowGap, startY) => {
    for (let y = startY !== undefined ? startY : r.y0 + 1; y <= r.y1 - 2; y += rowGap) {
      for (let x = r.x0 + 1; x + len - 1 <= r.x1 - 1; x += len + 1) put(k, x, y, len, 1);
    }
  };

  for (const r of rooms) {
    if (r.corridor) { place(r, 'plant', 1, 1, 'wall'); continue; }
    if (r.kind === 'market' || r.kind === 'store' || r.kind === 'kiosk') {
      rows(r, 'shelf', r.kind === 'market' ? 3 : 2, 3, r.y0 + 1);
      place(r, 'register', 2, 1, 'free'); place(r, 'fridge', 1, 1, 'wall'); place(r, 'fridge', 1, 1, 'wall');
      if (r.kind === 'market') { place(r, 'register', 2, 1, 'free'); place(r, 'freezer', 1, 1, 'wall'); }
      continue;
    }
    if (r.kind === 'warehouse') { rows(r, 'rack', 4, 3, r.y0 + 1); place(r, 'crate', 1, 1, 'wall'); place(r, 'crate', 1, 1, 'wall'); place(r, 'pallet', 1, 1, 'free'); continue; }
    if (r.kind === 'classroom') {
      place(r, 'board', 2, 1, 'wall');
      for (let y = r.y0 + 2; y <= r.y1 - 1; y += 2) for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) put('schooldesk', x, y, 1, 1);
      continue;
    }
    for (const [k, w, h, mode] of ROOM_FURN[r.kind] || []) {
      if (mode === 'rug') { if (r.x1 - r.x0 >= w + 1 && r.y1 - r.y0 >= h + 1) put('rug', r.x0 + 1 + ri(0, r.x1 - r.x0 - w - 1), r.y0 + 1 + ri(0, r.y1 - r.y0 - h - 1), w, h); continue; }
      place(r, k, w, h, mode);
    }
  }
  return it;
}

// 能不能从大门走到每一块空地、每个容器旁边
function interiorConnected(it) {
  const { W, H, t, occ } = it, N = W * H, seen = new Uint8Array(N);
  const walk = (i) => (t[i] === IT.FLOOR || t[i] === IT.DOOR) && !occ[i];
  const q = [it.door.y * W + it.door.x];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!seen[j] && walk(j)) { seen[j] = 1; q.push(j); }
    }
  }
  for (let i = 0; i < N; i++) if (walk(i) && !seen[i]) return false;
  for (const f of it.furn) {
    if (f.k === 'rug') continue;
    // 家具四条边外侧（不算斜角）至少有一格能走到
    let ok = false;
    const chk = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H && seen[y * W + x]) ok = true; };
    for (let x = f.x; x < f.x + f.w; x++) { chk(x, f.y - 1); chk(x, f.y + f.h); }
    for (let y = f.y; y < f.y + f.h; y++) { chk(f.x - 1, y); chk(f.x + f.w, y); }
    if (!ok) return false;
  }
  return true;
}

// ---------- 画内部（地板、墙、家具画成一张静态图） ----------
const FURN_PAINT = {
  rug: (P, x, y, w, h) => { P(x + 1, y + 1, w - 2, h - 2, '#5d275d'); P(x + 2, y + 2, w - 4, h - 4, '#7a3a6e'); P(x + 3, y + 3, w - 6, 0.5, '#c4a050'); P(x + 3, y + h - 3.5, w - 6, 0.5, '#c4a050'); },
  sofa: (P, x, y, w, h, B) => { B(x + 1, y + 2, w - 2, h - 3, '#7a3a4a'); P(x + 1.5, y + 2.5, w - 3, 4, '#5d2a38'); for (let k = x + 8; k < x + w - 2; k += 8) P(k, y + 7, 0.5, h - 9, '#5d2a38'); },
  tv: (P, x, y, w, h, B) => { B(x + 3, y + 9, w - 6, 5, '#3a3f4d'); B(x + 1, y + 2, w - 2, 8, '#1a1c2c'); P(x + 2, y + 3, 4, 1, '#566c86'); },
  bookshelf: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, h - 2, '#6e4a2e'); for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) P(x + 2.5 + k * 2.2, y + 2.5 + r * 4.3, 1.6, 3.2, ['#b13e53', '#3b5dc9', '#38b764', '#ffcd75', '#94b0c2'][(k + r) % 5]); },
  table: (P, x, y, w, h, B) => { B(x + 1.5, y + 3, w - 3, h - 6, '#a3804f'); P(x + 2, y + 3.5, w - 4, 1, '#c49a64'); },
  plant: (P, x, y, w, h, B) => { B(x + 5, y + 10, 6, 5, '#b07a45'); P(x + 3, y + 3, 10, 7, '#38704a'); P(x + 5, y + 1.5, 6, 4, '#38b764'); P(x + 6, y + 2, 2, 2, '#a7f070'); },
  counter: (P, x, y, w, h, B) => { B(x + 0.5, y + 1, w - 1, h - 2, '#8b93a3'); P(x + 1, y + 1.5, w - 2, 4, '#d8dde6'); P(x + 4, y + 9, 2, 1, '#1a1c2c'); P(x + w - 6, y + 9, 2, 1, '#1a1c2c'); },
  stove: (P, x, y, w, h, B) => { B(x + 0.5, y + 1, w - 1, h - 2, '#c8ccd8'); for (const [a, b] of [[4, 4], [10, 4], [4, 9], [10, 9]]) { P(x + a - 1.5, y + b - 1.5, 3, 3, '#1a1c2c'); P(x + a - 0.5, y + b - 0.5, 1, 1, '#566c86'); } },
  fridge: (P, x, y, w, h, B) => { B(x + 1.5, y + 0.5, w - 3, h - 1, '#e8eef5'); P(x + 2, y + 6, w - 4, 0.5, '#94b0c2'); P(x + w - 4, y + 2, 1, 3, '#566c86'); P(x + w - 4, y + 8, 1, 4, '#566c86'); },
  chair: (P, x, y, w, h, B) => { B(x + 4, y + 4, 8, 8, '#8f6a42'); P(x + 4.5, y + 4.5, 7, 2, '#6e4a2e'); },
  bed: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, h - 2, '#6e4a2e'); P(x + 2, y + 2, w - 4, h - 4, '#d8dde6'); P(x + 3, y + 3, w - 6, 5, '#f4f4f4'); P(x + 2, y + 11, w - 4, h - 13, '#3b5dc9'); P(x + 2, y + 11, w - 4, 1, '#73a7e0'); },
  cbed: (P, x, y, w, h, B) => { B(x + 2, y + 1, w - 4, h - 2, '#566c86'); P(x + 3, y + 2, w - 6, 5, '#c8ccd8'); P(x + 3, y + 8, w - 6, h - 10, '#38704a'); P(x + 3, y + 8, w - 6, 1, '#5aa04c'); },
  wardrobe: (P, x, y, w, h, B) => { B(x + 1, y + 0.5, w - 2, h - 1, '#6e4a2e'); P(x + w / 2 - 0.25, y + 1, 0.5, h - 2, '#3a2a1d'); P(x + w / 2 - 2, y + 7, 1, 2, '#ffcd75'); P(x + w / 2 + 1, y + 7, 1, 2, '#ffcd75'); },
  drawer: (P, x, y, w, h, B) => { B(x + 3, y + 3, w - 6, h - 5, '#8f6a42'); P(x + 4, y + 7, w - 8, 0.5, '#6e4a2e'); P(x + 4, y + 10, w - 8, 0.5, '#6e4a2e'); P(x + 7, y + 4, 2, 2, '#ffcd75'); },
  toilet: (P, x, y, w, h, B) => { B(x + 4, y + 1, 8, 4, '#e8eef5'); B(x + 4.5, y + 5, 7, 8, '#f4f4f4'); P(x + 6, y + 7, 4, 4, '#a9c4f0'); },
  bathtub: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, h - 2, '#f4f4f4'); P(x + 3, y + 3, w - 6, h - 6, '#a9c4f0'); P(x + 6, y + 2, 4, 1, '#94b0c2'); },
  sink: (P, x, y, w, h, B) => { B(x + 2, y + 2, w - 4, 9, '#f4f4f4'); P(x + 4, y + 5, w - 8, 4, '#a9c4f0'); P(x + 7, y + 2.5, 2, 2, '#94b0c2'); },
  medcab: (P, x, y, w, h, B) => { B(x + 2, y + 1, w - 4, h - 3, '#f4f4f4'); P(x + 7, y + 3, 2, 7, '#b13e53'); P(x + 4.5, y + 5.5, 7, 2, '#b13e53'); },
  desk: (P, x, y, w, h, B) => { B(x + 1, y + 3, w - 2, h - 5, '#8f6a42'); B(x + 4, y + 1, 9, 6, '#1a1c2c'); P(x + 5, y + 2, 7, 3.5, '#41579a'); P(x + w - 12, y + 6, 6, 4, '#f4f4f4'); P(x + w - 11, y + 7, 4, 0.5, '#94b0c2'); },
  filing: (P, x, y, w, h, B) => { B(x + 2, y + 0.5, w - 4, h - 1, '#8b93a3'); for (let k = 0; k < 3; k++) { P(x + 3, y + 1.5 + k * 4.5, w - 6, 0.5, '#566c86'); P(x + 6.5, y + 3 + k * 4.5, 3, 1, '#c8ccd8'); } },
  cooler: (P, x, y, w, h, B) => { B(x + 4, y + 7, 8, 8, '#d8dde6'); B(x + 4.5, y + 1, 7, 7, '#73a7e0'); P(x + 6, y + 2, 2, 4, '#c8e0ff'); },
  vending: (P, x, y, w, h, B) => { B(x + 1, y + 0.5, w - 2, h - 1, '#b13e53'); P(x + 2.5, y + 2, 7, 9, '#1a1c2c'); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) P(x + 3 + k * 2.2, y + 3 + r * 2.8, 1.6, 1.6, ['#ffcd75', '#38b764', '#73eff7'][(r + k) % 3]); P(x + 11, y + 4, 2, 4, '#ffcd75'); },
  shelf: (P, x, y, w, h, B) => { B(x + 0.5, y + 2, w - 1, h - 4, '#8b93a3'); for (let k = x + 2; k < x + w - 2; k += 3) { P(k, y + 3, 2, 3, ['#b13e53', '#ffcd75', '#38b764', '#3b5dc9', '#ef7d57'][Math.floor(k) % 5]); P(k + 0.5, y + 8, 2, 3, ['#73eff7', '#b06cd0', '#ef7d57', '#a7f070'][Math.floor(k) % 4]); } },
  register: (P, x, y, w, h, B) => { B(x + 0.5, y + 3, w - 1, h - 5, '#566c86'); P(x + 1, y + 3.5, w - 2, 2, '#8b93a3'); B(x + 4, y + 1, 8, 6, '#1a1c2c'); P(x + 5, y + 2, 6, 2, '#a7f070'); },
  crate: (P, x, y, w, h, B) => { B(x + 1.5, y + 1.5, w - 3, h - 3, '#a3804f'); P(x + 2, y + 2, w - 4, 1, '#c49a64'); for (let k = 0; k < w - 4; k++) { P(x + 2 + k, y + 2 + k * (h - 4) / (w - 4), 1, 1, '#6e4a2e'); P(x + w - 3 - k, y + 2 + k * (h - 4) / (w - 4), 1, 1, '#6e4a2e'); } },
  freezer: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, h - 2, '#f4f4f4'); P(x + 2.5, y + 2.5, w - 5, h - 5, '#a9c4f0'); P(x + 3, y + 3, w - 6, 1, '#dff6ff'); },
  rack: (P, x, y, w, h, B) => { B(x + 0.5, y + 1, w - 1, h - 2, '#566c86'); P(x + 1, y + 1.5, w - 2, 1, '#ef7d57'); for (let k = x + 2; k < x + w - 4; k += 5) { B(k, y + 4, 4, 4, '#a3804f'); B(k + 1, y + 9, 3, 4, '#c49a64'); } },
  hbed: (P, x, y, w, h, B) => { B(x + 2, y + 1, w - 4, h - 2, '#c8ccd8'); P(x + 3, y + 2, w - 6, 5, '#f4f4f4'); P(x + 3, y + 9, w - 6, h - 11, '#73a7e0'); P(x + 1.5, y + 9, 0.5, 12, '#566c86'); P(x + w - 2, y + 9, 0.5, 12, '#566c86'); },
  medshelf: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, h - 2, '#e8eef5'); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) P(x + 2.5 + k * 3.8, y + 2.5 + r * 4, 2.5, 2.5, ['#f4f4f4', '#b13e53', '#73eff7'][(r + k) % 3]); },
  bunkbed: (P, x, y, w, h, B) => { B(x + 1.5, y + 1, w - 3, h - 2, '#333c57'); P(x + 2.5, y + 2, w - 5, h - 4, '#8b93a3'); P(x + 3, y + 3, w - 6, 4, '#c8ccd8'); },
  bars: (P, x, y, w, h) => { P(x, y + 6, w, 1.5, '#566c86'); P(x, y + 12, w, 1, '#566c86'); for (let k = x + 1; k < x + w; k += 2.5) P(k, y + 2, 1, 12, '#8b93a3'); },
  gunlocker: (P, x, y, w, h, B) => { B(x + 1, y + 0.5, w - 2, h - 1, '#2f4a3a'); P(x + 2, y + 1.5, w - 4, h - 3, '#1f3a2a'); for (const k of [4, 7.5, 11]) { P(x + k, y + 2.5, 1, 10, '#566c86'); P(x + k - 0.5, y + 9, 2, 3, '#6e4a2e'); } },
  plocker: (P, x, y, w, h, B) => { B(x + 1, y + 0.5, w - 2, h - 1, '#41579a'); P(x + w / 2 - 0.25, y + 1, 0.5, h - 2, '#29366f'); for (let k = 0; k < 3; k++) { P(x + 3, y + 2 + k, 3, 0.5, '#29366f'); P(x + 10, y + 2 + k, 3, 0.5, '#29366f'); } },
  flocker: (P, x, y, w, h, B) => { B(x + 1, y + 0.5, w - 2, h - 1, '#b13e53'); P(x + w / 2 - 0.25, y + 1, 0.5, h - 2, '#5d2a38'); for (let k = 0; k < 3; k++) { P(x + 3, y + 2 + k, 3, 0.5, '#5d2a38'); P(x + 10, y + 2 + k, 3, 0.5, '#5d2a38'); } },
  locker: (P, x, y, w, h, B) => { B(x + 1, y + 0.5, w - 2, h - 1, '#8b93a3'); P(x + w / 2 - 0.25, y + 1, 0.5, h - 2, '#566c86'); for (let k = 0; k < 3; k++) { P(x + 3, y + 2 + k, 3, 0.5, '#566c86'); P(x + 10, y + 2 + k, 3, 0.5, '#566c86'); } },
  bench: (P, x, y, w, h, B) => { B(x + 1, y + 5, w - 2, 6, '#8f6a42'); P(x + 1.5, y + 5.5, w - 3, 1, '#a3804f'); },
  truck: (P, x, y, w, h, B) => { B(x + 1, y + 2, w - 2, h - 4, '#b13e53'); B(x + w - 16, y + 3, 14, h - 6, '#c84a5c'); P(x + w - 14, y + 5, 10, 8, '#73a7e0'); for (let k = x + 4; k < x + w - 20; k += 4) P(k, y + 4, 2, h - 8, '#c8ccd8'); P(x + 3, y + h / 2 - 1, w - 22, 2, '#ffcd75'); },
  toolbox: (P, x, y, w, h, B) => { B(x + 2, y + 6, w - 4, h - 8, '#b13e53'); P(x + 6, y + 4, 4, 2.5, '#1a1c2c'); P(x + 2.5, y + 9, w - 5, 0.5, '#5d2a38'); },
  schooldesk: (P, x, y, w, h, B) => { B(x + 2, y + 2, w - 4, 7, '#c49a64'); B(x + 5, y + 10, 6, 4, '#3b5dc9'); },
  board: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, 9, '#2f5a3c'); P(x + 4, y + 4, 8, 0.5, '#f4f4f4'); P(x + 6, y + 6, 12, 0.5, '#f4f4f4'); P(x + 1, y + 10, w - 2, 1.5, '#8f6a42'); },
  ltable: (P, x, y, w, h, B) => { B(x + 1, y + 3, w - 2, h - 6, '#a3804f'); P(x + 1.5, y + 3.5, w - 3, 1, '#c49a64'); },
  machine: (P, x, y, w, h, B) => { B(x + 1, y + 1, w - 2, h - 2, '#6b7a8f'); P(x + 2, y + 2, w - 4, h - 4, '#8b93a3'); B(x + 6, y + 6, 12, 10, '#566c86'); for (let k = 0; k < 5; k++) P(x + 2 + k * 6, y + h - 4, 3, 2, '#ffcd75'); P(x + w - 7, y + 4, 3, 3, '#b13e53'); },
  workbench2: (P, x, y, w, h, B) => { B(x + 0.5, y + 3, w - 1, h - 5, '#8f6a42'); P(x + 1, y + 3.5, w - 2, 1.5, '#a3804f'); P(x + 5, y + 5, 6, 2, '#8b93a3'); P(x + 16, y + 5, 2, 5, '#566c86'); P(x + 22, y + 6, 5, 2, '#b13e53'); },
  hay: (P, x, y, w, h, B) => { B(x + 1, y + 3, w - 2, h - 5, '#e8c170'); P(x + 2, y + 6, w - 4, 0.5, '#c4a050'); P(x + 2, y + 10, w - 4, 0.5, '#c4a050'); },
  tractor: (P, x, y, w, h, B) => { B(x + 2, y + 2, w - 4, h - 4, '#38704a'); B(x + 1, y + h - 12, 10, 10, '#1a1c2c'); B(x + w - 9, y + 4, 7, 7, '#1a1c2c'); P(x + 14, y + 6, 10, 8, '#73a7e0'); P(x + 3, y + 3, w - 6, 1, '#5aa04c'); },
  sack: (P, x, y, w, h, B) => { B(x + 2, y + 4, 6, 9, '#c9b78a'); B(x + 8, y + 5, 6, 8, '#b8a07a'); P(x + 3, y + 7, 4, 0.5, '#8a7650'); },
  pallet: (P, x, y, w, h) => { for (let k = 0; k < 4; k++) P(x + 1, y + 2 + k * 3.5, w - 2, 2, '#a3804f'); P(x + 2, y + 1, 1.5, h - 2, '#6e4a2e'); P(x + w - 3.5, y + 1, 1.5, h - 2, '#6e4a2e'); },
};

function paintFurniture(g, f) {
  const K = '#1a1c2c';
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const B = (x, y, w, h, c) => { P(x - 0.5, y - 0.5, w + 1, h + 1, K); P(x, y, w, h, c); };
  const px = f.x * T, py = f.y * T, w = f.w * T, h = f.h * T;
  if (f.k !== 'rug' && f.k !== 'bars') { g.fillStyle = 'rgba(10,10,30,0.25)'; g.fillRect(px + 2, py + h - 2, w - 2, 2); }
  (FURN_PAINT[f.k] || FURN_PAINT.crate)(P, px, py, w, h, B);
}

function paintFloorTile(g, x, y, style, R) {
  const P = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(a, b, w, h); };
  const X = x * T, Y = y * T;
  if (style === 'wood') {
    P(X, Y, T, T, '#8f6a42');
    for (let k = 0; k < 4; k++) { P(X, Y + k * 4, T, 0.5, '#6e4a2e'); P(X + ((k * 7 + x * 3) % 16), Y + k * 4, 0.5, 4, '#6e4a2e'); }
    P(X + 2, Y + 1, 5, 0.5, '#a3804f');
  } else if (style === 'tile') {
    P(X, Y, T, T, (x + y) % 2 ? '#d8dde6' : '#b8c0cc');
    P(X, Y, T, 0.5, '#94a0b0'); P(X, Y, 0.5, T, '#94a0b0');
  } else if (style === 'carpet') {
    P(X, Y, T, T, '#4b5a7a');
    for (let k = 0; k < 6; k++) P(X + R() * 15, Y + R() * 15, 1, 1, R() < 0.5 ? '#3f4c68' : '#56668a');
  } else if (style === 'concrete') {
    P(X, Y, T, T, '#7a7d88');
    for (let k = 0; k < 4; k++) P(X + R() * 15, Y + R() * 15, 1, 1, R() < 0.5 ? '#6b6e78' : '#8b8e98');
    if (x % 4 === 0) P(X, Y, 0.5, T, '#686b75');
    if (R() < 0.05) { g.fillStyle = 'rgba(30,25,20,0.3)'; g.beginPath(); g.ellipse(X + 8, Y + 8, 5, 3, 0, 0, 7); g.fill(); }
  } else if (style === 'lino') {
    P(X, Y, T, T, '#c4ccbc');
    for (let k = 0; k < 5; k++) P(X + R() * 15, Y + R() * 15, 1, 1, '#a8b0a0');
    P(X, Y, T, 0.5, '#b0b8a8');
  } else {
    P(X, Y, T, T, '#8a7650');
    for (let k = 0; k < 4; k++) P(X + R() * 14, Y + R() * 15, 2, 0.5, '#e8c170');
  }
  if (R() < 0.04) { g.fillStyle = 'rgba(110,25,35,0.4)'; g.beginPath(); g.ellipse(X + 8, Y + 8, 3 + R() * 3, 2, 0, 0, 7); g.fill(); } // 血迹
}

function buildInteriorImage(it) {
  const { W, H, t, fl } = it, R = mulberry(interiorSeed(it.s) + 7);
  const c = createCanvas(W * T * 2, H * T * 2), g = c.getContext('2d');
  g.scale(2, 2);
  const isWall = (x, y) => x < 0 || y < 0 || x >= W || y >= H || t[y * W + x] === IT.WALL;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (t[i] === IT.FLOOR || t[i] === IT.DOOR) paintFloorTile(g, x, y, FLOORS[fl[i]], R);
  }
  // 房间的天花板灯光：每个房间中间一片暖色光晕（没有灯的废弃楼就暗一些）
  for (const r of it.rooms) {
    if (R() < 0.3) continue;
    const cx = (r.x0 + r.x1 + 1) / 2 * T, cy = (r.y0 + r.y1 + 1) / 2 * T, rr = Math.max(r.x1 - r.x0, r.y1 - r.y0) * T * 0.6 + T;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    gr.addColorStop(0, 'rgba(255,220,160,0.16)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  // 墙脚阴影（贴着墙的地板暗一点，看起来有立体感）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (t[y * W + x] !== IT.FLOOR) continue;
    const X = x * T, Y = y * T;
    if (isWall(x, y - 1)) { g.fillStyle = 'rgba(10,10,25,0.32)'; g.fillRect(X, Y, T, 2); g.fillStyle = 'rgba(10,10,25,0.15)'; g.fillRect(X, Y + 2, T, 2); }
    if (isWall(x - 1, y)) { g.fillStyle = 'rgba(10,10,25,0.22)'; g.fillRect(X, Y, 2, T); }
    if (isWall(x + 1, y)) { g.fillStyle = 'rgba(10,10,25,0.12)'; g.fillRect(X + T - 2, Y, 2, T); }
  }
  // 地上的杂物：纸张、易拉罐、碎玻璃、弹壳（不挡路）
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (t[i] !== IT.FLOOR || it.occ[i] || R() > 0.1) continue;
    const X = x * T + 3 + R() * 9, Y = y * T + 3 + R() * 9, k = R();
    if (k < 0.35) { g.fillStyle = '#d8dde6'; g.fillRect(X, Y, 4, 3); g.fillStyle = '#94a0b0'; g.fillRect(X + 0.5, Y + 1, 3, 0.5); }
    else if (k < 0.55) { g.fillStyle = pick(['#b13e53', '#38b764', '#3b5dc9']); g.fillRect(X, Y, 3, 1.5); g.fillStyle = '#c8ccd8'; g.fillRect(X + 3, Y, 0.8, 1.5); }
    else if (k < 0.75) { g.fillStyle = 'rgba(200,230,255,0.7)'; for (let q = 0; q < 4; q++) g.fillRect(X + R() * 5, Y + R() * 4, 1, 1); }
    else if (k < 0.85) { g.fillStyle = '#ffcd75'; g.fillRect(X, Y, 1.5, 0.8); g.fillRect(X + 2, Y + 2, 1.5, 0.8); }
    else { g.fillStyle = 'rgba(40,30,25,0.35)'; g.beginPath(); g.ellipse(X + 2, Y + 2, 3 + R() * 2, 2, 0, 0, 7); g.fill(); }
  }
  // 墙：顶部深色，朝南那面是墙纸（3/4 视角）；外墙开窗，内墙挂画、开关、踢脚线
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (t[y * W + x] !== IT.WALL) continue;
    const X = x * T, Y = y * T, below = y + 1 < H ? t[(y + 1) * W + x] : IT.VOID;
    g.fillStyle = '#2b2e3a'; g.fillRect(X, Y, T, T);
    g.fillStyle = '#3a3f4d'; g.fillRect(X, Y, T, 1);
    if ((x + y) % 2 === 0) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(X, Y + 1, T, 6); }
    if (below === IT.FLOOR) {
      g.fillStyle = it.wall; g.fillRect(X, Y + 7, T, 9);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(X, Y + 7, T, 1);
      g.fillStyle = 'rgba(0,0,0,0.08)'; for (let q = 0; q < 3; q++) g.fillRect(X + q * 5 + 2, Y + 8, 0.5, 6); // 墙纸竖纹
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(X, Y + 14, T, 2); // 踢脚线
      const dec = (x * 5 + y * 3) % 11;
      if (y === 0 && dec % 3 === 0) {
        // 外墙的窗户（有的破了，有的钉了木板）
        const kind = R();
        g.fillStyle = '#1a1c2c'; g.fillRect(X + 2, Y + 7.5, 12, 6);
        if (kind < 0.2) { g.fillStyle = '#6e4a2e'; g.fillRect(X + 2.5, Y + 8, 11, 5); g.fillStyle = '#8f6a42'; g.fillRect(X + 2.5, Y + 8.5, 11, 1.2); g.fillRect(X + 2.5, Y + 11, 11, 1.2); }
        else {
          g.fillStyle = kind < 0.35 ? '#11131f' : '#41579a'; g.fillRect(X + 2.5, Y + 8, 11, 5);
          g.fillStyle = 'rgba(169,196,240,0.7)'; g.fillRect(X + 3, Y + 8.5, 4, 0.8);
          g.fillStyle = '#1a1c2c'; g.fillRect(X + 7.75, Y + 8, 0.5, 5);
          if (kind > 0.7) { g.fillStyle = '#b13e53'; g.fillRect(X + 2.5, Y + 8, 2, 5); g.fillRect(X + 11.5, Y + 8, 2, 5); } // 窗帘
        }
      } else if (dec === 1) { g.fillStyle = '#1a1c2c'; g.fillRect(X + 4, Y + 8.5, 8, 4.5); g.fillStyle = ['#b13e53', '#3b5dc9', '#38704a', '#c49a64'][x % 4]; g.fillRect(X + 4.5, Y + 9, 7, 3.5); } // 挂画
      else if (dec === 5) { g.fillStyle = '#f4f4f4'; g.fillRect(X + 7, Y + 10, 2, 2.5); g.fillStyle = '#94a0b0'; g.fillRect(X + 7.5, Y + 10.5, 1, 1.5); } // 开关
      else if (dec === 8) { g.fillStyle = 'rgba(20,20,30,0.25)'; g.fillRect(X + 3, Y + 9, 1, 5); g.fillRect(X + 4, Y + 11, 2, 0.5); } // 裂缝
    }
  }
  // 房间之间的门框
  for (const [x, y] of it.gaps || []) {
    const X = x * T, Y = y * T, vertWall = isWall(x - 1, y) && isWall(x + 1, y);
    g.fillStyle = '#6e4a2e';
    if (vertWall) { g.fillRect(X, Y, 1.5, T); g.fillRect(X + T - 1.5, Y, 1.5, T); }
    else { g.fillRect(X, Y, T, 1.5); g.fillRect(X, Y + T - 1.5, T, 1.5); }
  }
  // 大门（出口）：门框 + 绿色“出口”灯 + 门垫
  const D = it.door;
  g.fillStyle = '#1a1c2c'; g.fillRect(D.x * T, D.y * T, T, T);
  g.fillStyle = '#6e4a2e'; g.fillRect(D.x * T + 1, D.y * T + 1, T - 2, T - 1);
  g.fillStyle = '#4a2f1d'; g.fillRect(D.x * T + 3, D.y * T + 4, T - 6, T - 4);
  g.fillStyle = '#ffcd75'; g.fillRect(D.x * T + T - 5, D.y * T + 9, 1.5, 1.5);
  g.fillStyle = '#38b764'; g.fillRect(D.x * T + 4, D.y * T + 1.5, T - 8, 2.5);
  g.fillStyle = '#a7f070'; g.fillRect(D.x * T + 5, D.y * T + 2, T - 10, 1);
  g.fillStyle = '#8f2f2a'; g.fillRect(D.x * T + 2, (D.y - 1) * T + 10, T - 4, 5); // 门垫
  g.fillStyle = '#b13e53'; g.fillRect(D.x * T + 3, (D.y - 1) * T + 11, T - 6, 0.6);
  // 家具（地毯先画），每件家具底下一圈柔和阴影
  for (const f of it.furn) if (f.k === 'rug') paintFurniture(g, f);
  for (const f of it.furn) {
    if (f.k === 'rug' || f.k === 'bars') continue;
    g.fillStyle = 'rgba(10,10,25,0.28)';
    g.beginPath(); g.ellipse((f.x + f.w / 2) * T + 1, (f.y + f.h) * T - 1, f.w * T * 0.5, 2.5, 0, 0, 7); g.fill();
  }
  for (const f of it.furn.slice().sort((a, b) => a.y + a.h - b.y - b.h)) if (f.k !== 'rug') paintFurniture(g, f);
  it.img = c;
}

// ---------- 进入 / 离开 ----------
function structEnterable(s) { return s.type !== 'fountain' && !!IPLANS[s.type]; }
function structEntrance(s) {
  const x = s.x + Math.floor(s.w / 2), y = s.y + s.h;
  if (inMap(x, y) && !isBlocked(x, y, true)) return { x, y };
  return structDoor(s, (s.x + s.w / 2) * T, (s.y + s.h + 1) * T);
}
function containerAvailable(s, ci) { const d = s.opened && s.opened[ci]; return d === undefined || d + RESTOCK_DAYS <= G.day; }
function structLeftCount(s) {
  if (!s.nc) return 1; // 还没进去过
  let n = 0;
  for (let i = 0; i < s.nc; i++) if (containerAvailable(s, i)) n++;
  return n;
}

function enterStruct(s) {
  const p = G.player;
  const it = genInterior(s, { noLoot: s.home, home: s.home });
  if (s.home) addHomeBeds(it);
  buildInteriorImage(it);
  s.nc = it.cont.length;
  s.opened = s.opened || {};
  p.cityX = p.x; p.cityY = p.y;
  p.path = []; p.goal = null; p.search = null;
  p.x = (it.door.x + 0.5) * T; p.y = (it.door.y - 0.4) * T;
  G.inside = it;
  // 里面的丧尸（离大门远一点的地方）
  const floors = [];
  for (let y = 1; y < it.H - 1; y++) for (let x = 1; x < it.W - 1; x++) {
    const i = y * it.W + x;
    if (it.t[i] === IT.FLOOR && !it.occ[i] && Math.hypot(x - it.door.x, y - it.door.y) > 5) floors.push([x, y]);
  }
  // 上次离开时留下的丧尸（种类、是否变异、剩余血量）原样还在；之后新来的才随机
  const known = s.zs || [];
  for (let k = 0; k < (s.zIn || 0) && floors.length; k++) {
    const [x, y] = floors.splice(Math.floor(Math.random() * floors.length), 1)[0];
    const prev = known[k];
    const type = prev ? prev[0] : G.day >= 2 && Math.random() < 0.3 ? 'runner' : 'walker';
    const m = spawnMonster(type, (x + 0.5) * T, (y + 0.5) * T, { wander: true, noSpecial: !!prev });
    G.monsters.pop();
    if (prev) {
      if (prev[1]) makeSpecial(m, prev[1]);
      m.hp = Math.max(1, m.maxHp * (prev[2] || 1));
    }
    it.zombies.push(m);
  }
  G.cityCam = G.cam;
  G.cam = { x: p.x, y: p.y, zoom: insideZoom() };
  G.camFollow = true;
  G.buildMode = null; G.selected = null;
  const name = (s.home ? '营地·' : '') + STRUCTS[s.type].name;
  showBanner('进入' + name, s.home ? '可以在这里摆放床位，每张床多住 1 人' : (it.zombies.length ? '小心，里面有 ' + it.zombies.length + ' 只丧尸！' : '点柜子、箱子搜刮物资，点大门离开'), 2.5, s.home ? '#a7f070' : it.zombies.length ? '#ef7d57' : '#ffcd75');
  sfx('click');
}

function exitInterior() {
  const it = G.inside, p = G.player;
  if (!it) return;
  const alive = it.zombies.filter((m) => m.alive);
  it.s.zIn = alive.length;
  it.s.zs = alive.map((m) => [m.type, m.special || '', Math.round(m.hp / m.maxHp * 100) / 100]); // 记住每只丧尸
  it.s.left = structLeftCount(it.s);
  G.inside = null;
  p.x = p.cityX; p.y = p.cityY;
  p.path = []; p.goal = null; p.search = null;
  G.cam = G.cityCam || { x: p.x, y: p.y, zoom: defaultZoom() };
  G.camFollow = true;
  G.buildMode = null;
  clampCamera();
  sfx('click');
}

function insideZoom() {
  const it = G.inside;
  return Math.max(2.2, Math.min(5, G.sw / (it.W * T + 16), (G.sh - UI.topH - UI.bottomH - 70) / (it.H * T + 16)));
}

// 在室内执行时，把怪物 / 子弹 / 特效 / 飘字换成室内的那一套（城里的不受影响）
function withInside(fn) {
  const it = G.inside;
  if (!it) return;
  const sv = [G.monsters, G.projectiles, G.effects, G.floats];
  G.monsters = it.zombies; G.projectiles = it.proj; G.effects = it.fx; G.floats = it.floats;
  G.inLayer = true; // 正在模拟室内（碰撞用室内地图）
  try { fn(); } finally {
    G.inLayer = false;
    it.zombies = G.monsters; it.proj = G.projectiles; it.fx = G.effects; it.floats = G.floats;
    [G.monsters, G.projectiles, G.effects, G.floats] = sv;
  }
}

// ---------- 室内移动 / 寻路 ----------
function insideWalk(it, x, y) {
  if (x < 0 || y < 0 || x >= it.W || y >= it.H) return false;
  const i = y * it.W + x;
  return (it.t[i] === IT.FLOOR || it.t[i] === IT.DOOR) && !it.occ[i];
}
function insideSolidAt(it, px, py) {
  const r = 4;
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) if (!insideWalk(it, Math.floor((px + dx) / T), Math.floor((py + dy) / T))) return true;
  return false;
}
function moveInside(e, tx, ty, speed, dt) {
  const it = G.inside, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, speed * dt), nx = e.x + dx / d * step, ny = e.y + dy / d * step;
  const stuck = insideSolidAt(it, e.x, e.y);
  if (stuck || !insideSolidAt(it, nx, e.y)) e.x = nx;
  if (stuck || !insideSolidAt(it, e.x, ny)) e.y = ny;
  if (Math.abs(dx) > 0.5) e.face = dx < 0 ? -1 : 1;
  return false;
}
// BFS：从 (sx,sy) 到 目标格（或目标家具旁边）
function insidePath(it, sx, sy, goalFn) {
  const { W, H } = it, N = W * H, prev = new Int32Array(N).fill(-1), seen = new Uint8Array(N);
  const start = sy * W + sx, q = [start];
  seen[start] = 1;
  let found = -1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    if (goalFn(x, y)) { found = i; break; }
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!insideWalk(it, nx, ny)) continue;
      if (dx && dy && (!insideWalk(it, x + dx, y) || !insideWalk(it, x, y + dy))) continue;
      const j = ny * W + nx;
      if (seen[j]) continue;
      seen[j] = 1; prev[j] = i; q.push(j);
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let i = found; i !== start && i >= 0; i = prev[i]) path.push(i);
  path.reverse();
  return path.map((i) => ({ x: (i % W + 0.5) * T, y: (((i / W) | 0) + 0.5) * T }));
}
function furnAt(it, x, y) { const f = it.occ[y * it.W + x]; return f ? it.furn[f - 1] : null; }
function nextToFurn(f, x, y) { return x >= f.x - 1 && x <= f.x + f.w && y >= f.y - 1 && y <= f.y + f.h && !(x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h); }

// ---------- 室内点击 ----------
function insideTap(tx, ty, wx, wy) {
  const it = G.inside, p = G.player;
  if (!it || p.down > 0) return;
  // 摆床
  if (G.buildMode === 'bed') { tryPlaceBed(it, tx, ty); return; }
  const ptx = Math.floor(p.x / T), pty = Math.floor(p.y / T);
  let goal = null, goalFn = (x, y) => x === tx && y === ty;
  if (tx >= 0 && ty >= 0 && tx < it.W && ty < it.H) {
    // 先看点到的是不是家具（家具优先），只有门本身那一格（或正上方的空地）才算出口
    const f = furnAt(it, tx, ty);
    const atDoor = !f && tx === it.door.x && ty >= it.door.y - 1;
    if (atDoor) { goal = { exit: true }; goalFn = (x, y) => Math.abs(x - it.door.x) <= 0 && y >= it.door.y - 1; }
    else if (f && f.k === 'cbed') {
      askConfirm('拆掉这张床？返还 3 个零件。', () => removeBed(it, f));
      return;
    } else if (f) {
      goal = { furn: f };
      goalFn = (x, y) => nextToFurn(f, x, y);
    }
  }
  if (goal && insideGoalReached(goal)) { insideReach(goal); return; }
  const path = insidePath(it, ptx, pty, goalFn);
  if (!path) { addFloat(wx, wy, '过不去', '#ef7d57', true); return; }
  p.path = path; p.goal = goal; p.search = null;
  G.moveMarker = { x: wx, y: wy, t: G.time };
}
function insideGoalReached(g) {
  const it = G.inside, p = G.player, px = Math.floor(p.x / T), py = Math.floor(p.y / T);
  if (g.exit) return Math.abs(p.x - (it.door.x + 0.5) * T) < T * 1.2 && p.y > (it.door.y - 1.6) * T;
  return nextToFurn(g.furn, px, py) || Math.hypot(p.x - (g.furn.x + g.furn.w / 2) * T, p.y - (g.furn.y + g.furn.h / 2) * T) < T * (Math.max(g.furn.w, g.furn.h) / 2 + 0.9);
}
function insideReach(g) {
  const it = G.inside, p = G.player;
  if (g.exit) { exitInterior(); return; }
  const f = g.furn;
  if (f.ci < 0) { addFloat(p.x, p.y - 18, it.home ? '营地里的家具' : '没什么可以拿的', '#94b0c2', true); return; }
  if (!containerAvailable(it.s, f.ci)) { addFloat(p.x, p.y - 18, CONT[f.k].name + '已经搜过了', '#94b0c2', true); return; }
  p.search = { furn: f, t: 0, dur: 1.2 / searchSpeed(p) };
}
function finishContainer(f) {
  const it = G.inside, p = G.player;
  const got = rollLoot(CONT[f.k].loot, p);
  it.s.opened[f.ci] = G.day;
  it.s.left = structLeftCount(it.s);
  p.stats.searches++;
  gainSkill(p, 'scav', 1);
  if (!got.length) got.push(CONT[f.k].name + '里什么也没有');
  got.forEach((tx, i) => addFloat(p.x, p.y - 18 - i * 11, tx, '#ffcd75', true));
  sfx('coin');
}

// ---------- 室内更新：玩家 + 丧尸 ----------
function updateInside(dt) {
  const it = G.inside, p = G.player;
  p.hit = Math.max(0, p.hit - dt);
  const speed = 3.2 * T * (hasT(p, 'fast') ? 1.15 : 1) * (hasT(p, 'slow') ? 0.85 : 1) * personMoveMul(p);
  let kx = 0, ky = 0;
  if (G.keys.left) kx--;
  if (G.keys.right) kx++;
  if (G.keys.up) ky--;
  if (G.keys.down) ky++;
  const ox = p.x, oy = p.y;
  if (kx || ky) {
    p.path = []; p.goal = null;
    const d = Math.hypot(kx, ky);
    moveInside(p, p.x + kx / d * 20, p.y + ky / d * 20, speed, dt);
    // 用键盘走到大门口也能出去
    if (p.y > (it.door.y - 0.45) * T && Math.abs(p.x - (it.door.x + 0.5) * T) < T * 0.6) { exitInterior(); return; }
  } else if (p.path.length) {
    if (moveInside(p, p.path[0].x, p.path[0].y, speed, dt)) p.path.shift();
  } else if (p.goal) {
    const g = p.goal;
    p.goal = null;
    if (insideGoalReached(g)) { insideReach(g); if (!G.inside) return; }
  }
  p.moving = Math.hypot(p.x - ox, p.y - oy) > 0.01;
  if (p.search) {
    if (p.moving) p.search = null;
    else if ((p.search.t += dt) >= p.search.dur) { finishContainer(p.search.furn); p.search = null; }
  }
  personAttack(p, dt, 1);
  if (!G.inside) return;

  // 丧尸：闻到人就追（用 BFS 距离场绕开家具）
  it.flowT = (it.flowT || 0) - dt;
  if (it.flowT <= 0) { it.flowT = 0.35; it.flow = insideFlow(it, Math.floor(p.x / T), Math.floor(p.y / T)); }
  for (const m of G.monsters) {
    if (!m.alive) continue;
    m.hit = Math.max(0, m.hit - dt);
    m.cd -= dt;
    if (m.burnUntil > G.clock) { hurtMonster(m, m.burnDps * dt); if (!m.alive) continue; }
    if (confusedAI(m, dt)) continue;
    if (m.special && specialAI(m, dt, p)) { if (!G.inside) return; continue; }
    const pd = p.down > 0 ? 1e9 : Math.hypot(p.x - m.x, p.y - m.y);
    if (pd < T * 0.75) {
      if (m.cd <= 0) { m.cd = 1 / m.def.rate; hurtPlayer(m.dmg, m); if (!G.inside) return; }
      continue;
    }
    if (pd > 10 * T) continue;
    const tx = Math.floor(m.x / T), ty = Math.floor(m.y / T);
    let best = null, bd = it.flow ? it.flow[ty * it.W + tx] : 1e9;
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx, ny = ty + dy;
      if (!insideWalk(it, nx, ny) || (dx && dy && (!insideWalk(it, tx + dx, ty) || !insideWalk(it, tx, ty + dy)))) continue;
      const v = it.flow[ny * it.W + nx];
      if (v < bd) { bd = v; best = [nx, ny]; }
    }
    const target = best ? { x: (best[0] + 0.5) * T, y: (best[1] + 0.5) * T } : p;
    moveInside(m, pd < T * 1.6 ? p.x : target.x, pd < T * 1.6 ? p.y : target.y, monsterSpeed(m), dt);
  }
  for (const pr of G.projectiles) updateProjectile(pr, dt);
  G.projectiles = G.projectiles.filter((pr) => pr.alive);
  G.monsters = G.monsters.filter((m) => m.alive);
  updateEffects(dt);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter((f) => f.t < f.life);
}
function insideFlow(it, sx, sy) {
  const { W, H } = it, d = new Float32Array(W * H).fill(1e9), q = [sy * W + sx];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!insideWalk(it, nx, ny)) continue;
      const j = ny * W + nx;
      if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

// ---------- 营地床位 ----------
function bedFits(it, x, y) {
  for (const [xx, yy] of [[x, y], [x, y + 1]]) {
    if (xx < 1 || yy < 1 || xx > it.W - 2 || yy > it.H - 2) return false;
    const i = yy * it.W + xx;
    if (it.t[i] !== IT.FLOOR || it.occ[i] || it.resv[i]) return false;
  }
  const p = G.player;
  if (p && G.inside === it && Math.floor(p.x / T) === x && (Math.floor(p.y / T) === y || Math.floor(p.y / T) === y + 1)) return false;
  const fi = it.furn.length;
  it.furn.push({ k: 'cbed', x, y, w: 1, h: 2, ci: -1 });
  it.occ[y * it.W + x] = fi + 1; it.occ[(y + 1) * it.W + x] = fi + 1;
  const ok = interiorConnected(it);
  it.occ[y * it.W + x] = 0; it.occ[(y + 1) * it.W + x] = 0;
  it.furn.pop();
  return ok;
}
function addHomeBeds(it) {
  for (const [x, y] of G.home.beds) {
    const fi = it.furn.length;
    it.furn.push({ k: 'cbed', x, y, w: 1, h: 2, ci: -1 });
    it.occ[y * it.W + x] = fi + 1; it.occ[(y + 1) * it.W + x] = fi + 1;
  }
}
// 开局：在营地里随机摆几张床
function initHomeBeds(n) {
  const home = G.structs.find((s) => s.home);
  G.home = { beds: [] };
  const it = genInterior(home, { noLoot: true, home: true });
  for (let k = 0; k < n; k++) {
    for (let tries = 0; tries < 300; tries++) {
      const x = 1 + Math.floor(Math.random() * (it.W - 2)), y = 1 + Math.floor(Math.random() * (it.H - 3));
      if (!bedFits(it, x, y)) continue;
      G.home.beds.push([x, y]);
      const fi = it.furn.length;
      it.furn.push({ k: 'cbed', x, y, w: 1, h: 2, ci: -1 });
      it.occ[y * it.W + x] = fi + 1; it.occ[(y + 1) * it.W + x] = fi + 1;
      break;
    }
  }
}
function tryPlaceBed(it, x, y) {
  const cost = bdef('bed').cost;
  const wx = (x + 0.5) * T, wy = (y + 0.5) * T;
  if (!bedFits(it, x, y)) { addFloat(wx, wy, '这里放不下（床占 1×2 格，不能挡路）', '#ef7d57', true); sfx('bad'); return; }
  if (!canAfford(cost)) { addFloat(wx, wy, '零件不足', '#ef7d57', true); sfx('bad'); return; }
  pay(cost);
  G.home.beds.push([x, y]);
  const fi = it.furn.length;
  it.furn.push({ k: 'cbed', x, y, w: 1, h: 2, ci: -1 });
  it.occ[y * it.W + x] = fi + 1; it.occ[(y + 1) * it.W + x] = fi + 1;
  buildInteriorImage(it);
  addFloat(wx, wy, '床位 +1（共 ' + G.home.beds.length + ' 张）', '#a7f070', true);
  sfx('build');
}
function removeBed(it, f) {
  if (campSurvivors().length > G.home.beds.length - 1) { showBanner('不能拆', '床位不够，有人会没地方睡', 2, '#ef7d57'); return; }
  G.home.beds = G.home.beds.filter(([x, y]) => !(x === f.x && y === f.y));
  const i = it.furn.indexOf(f);
  it.furn.splice(i, 1);
  for (let k = 0; k < it.occ.length; k++) { if (it.occ[k] === i + 1) it.occ[k] = 0; else if (it.occ[k] > i + 1) it.occ[k]--; }
  G.res.parts += 3;
  buildInteriorImage(it);
  sfx('build');
}

// ---------- 画室内 ----------
function renderInterior(ctx) {
  const it = G.inside, dpr = G.dpr, z = G.cam.zoom, p = G.player;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0f1e';
  ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
  const ox = Math.round((G.sw / 2 - G.cam.x * z) * dpr), oy = Math.round((G.sh / 2 - G.cam.y * z) * dpr);
  ctx.setTransform(z * dpr, 0, 0, z * dpr, ox, oy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(it.img, 0, 0, it.W * T, it.H * T);
  // 容器状态：能搜的有黄点，搜过的变暗
  for (const f of it.cont) {
    if (containerAvailable(it.s, f.ci)) {
      const bob = Math.sin(G.time * 3 + f.x + f.y) * 0.8;
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect((f.x + f.w) * T - 4.5, f.y * T + 0.5 + bob, 3, 3);
      ctx.fillStyle = '#ffcd75'; ctx.fillRect((f.x + f.w) * T - 4, f.y * T + 1 + bob, 2, 2);
    } else {
      ctx.fillStyle = 'rgba(10,10,30,0.35)'; ctx.fillRect(f.x * T + 1, f.y * T + 1, f.w * T - 2, f.h * T - 2);
    }
  }
  // 营地：同伴睡在床上
  if (it.s.op) {
    // 分基地：驻守的同伴站在门口附近
    const wk = outpostWorker(it.s), wx = (it.door.x - 1) * T, wy = (it.door.y - 1.6) * T;
    if (wk) {
      drawShadow(ctx, wx, wy + 1, 11);
      ctx.drawImage(personSprite(wk).img, wx - 8, wy - 14, 16, 16);
      drawWorldLabel(ctx, wk.name + '·驻守', wx, wy - 18, '#73eff7');
    }
  }
  if (it.home) {
    const sleepers = campSurvivors().filter((s) => (s.state || 'base') === 'base');
    let k = 0;
    for (const f of it.furn) {
      if (f.k !== 'cbed' || k >= sleepers.length) continue;
      const s = sleepers[k++];
      ctx.save();
      ctx.translate((f.x + 0.5) * T, (f.y + 1) * T);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(personSprite(s).img, -8, -8, 16, 16);
      ctx.restore();
      if (Math.sin(G.time * 2 + k) > 0.3) drawWorldLabel(ctx, 'z', (f.x + 0.9) * T, f.y * T - 2 - (G.time * 6 + k * 3) % 6, '#c8d6e5');
    }
  }
  // 摆床预览
  if (G.buildMode === 'bed' && G.hover) {
    const hx = G.hover.x, hy = G.hover.y, ok = bedFits(it, hx, hy);
    ctx.fillStyle = ok ? 'rgba(56,183,100,0.35)' : 'rgba(177,62,83,0.45)';
    ctx.fillRect(hx * T, hy * T, T, 2 * T);
  }
  // 丧尸 + 玩家（按 y 排序）
  const actors = it.zombies.filter((m) => m.alive).concat(p.down > 0 ? [] : [p]).sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (a === p) {
      const spr = SPR.player, bob = p.moving ? -Math.abs(Math.sin(G.time * 12)) * 1.5 : 0;
      drawShadow(ctx, p.x, p.y + 1, 12);
      ctx.drawImage(p.hit > 0 ? spr.white : (p.face < 0 ? spr.flip : spr.img), p.x - 8, p.y - 14 + bob, 16, 16);
      hpBar(ctx, p.x - 6, p.y - 17, 12, p.hp / personMaxHp(p), '#a7f070');
      if (p.search) hpBar(ctx, p.x - 8, p.y - 21, 16, p.search.t / p.search.dur, '#ffcd75');
    } else {
      const spr = SPR[a.def.sprite || a.type], bob = -Math.abs(Math.sin(G.time * 8 + a.bob)) * 1.5;
      drawMonsterFx(ctx, a);
      drawShadow(ctx, a.x, a.y + 2.5, 12, 0.9);
      ctx.drawImage(a.hit > 0 ? spr.white : (a.face < 0 ? spr.flip : spr.img), a.x - 8, a.y - 12 + bob, 16, 16);
      if (a.hp < a.maxHp) hpBar(ctx, a.x - 5, a.y - 15, 10, a.hp / a.maxHp, '#b13e53');
    }
  }
  drawWorldLabel(ctx, '出口', (it.door.x + 0.5) * T, (it.door.y - 0.2) * T, '#a7f070');
  withInside(() => drawProjectilesAndEffects(ctx));
  // 室内光线：屋里比外面暗，手电筒照亮身边
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sp = worldToScreen(p.x, p.y - 6), r = 7 * T * z, dark = 0.35 + G.dark * 0.6;
  const g = ctx.createRadialGradient(sp.x, sp.y, r * 0.15, sp.x, sp.y, r);
  g.addColorStop(0, 'rgba(10,10,30,0)');
  g.addColorStop(1, 'rgba(10,10,30,' + dark.toFixed(2) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, G.sw, G.sh);
  withInside(() => {
    for (const f of G.floats) {
      const q = worldToScreen(f.x, f.y - f.t * 18);
      ctx.globalAlpha = Math.min(1, (1 - f.t / f.life) * 2);
      drawText(ctx, f.text, q.x, q.y, 13, f.color, 'center');
    }
    ctx.globalAlpha = 1;
  });
}

// 建造按钮上的床图标
function initInteriorSprites() {
  const c = createCanvas(32, 32), g = c.getContext('2d');
  g.scale(2, 2);
  g.translate(4, -8);
  paintFurniture(g, { k: 'cbed', x: 0, y: 0.5, w: 1, h: 2 });
  SPR.bed = { w: 16, h: 16, img: c, flip: c, white: c };
}
