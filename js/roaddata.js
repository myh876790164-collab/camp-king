// =============================================
//  公路求生：数据表（载具、改装件、路边建筑、辐射怪物、地区、研究）
//  改数值只需要改这个文件
//  注意：改装件的 id 由“种类 + 序号”自动生成，以后加新型号请加在每组末尾，不要插在中间（否则旧存档会对不上）
// =============================================

// ---------- 起步载具 ----------
// hp 耐久 · speed 极速(km/h) · fuel 每公里油耗(L) · tank 油箱 · weight 车重 · torque 载重能力 · mounts 武器挂点
// cells / wcells 车内地面 / 墙面格子 · cargo 货舱 · battery 电池 · electric 电动（耗电不耗油）
const RD_VEHICLES = {
  courier: {
    name: '快递车', hp: 140, speed: 70, fuel: 0.10, tank: 50, weight: 100, torque: 140, mounts: 1, cells: 5, wcells: 5, cargo: 120, battery: 20,
    color: '#e8e4d8', stripe: '#ef7d57', len: 46, desc: '各项均衡的厢式货车，车厢能改成一个小家。新手推荐。', perk: '均衡：没有明显短板',
  },
  garbage: {
    name: '垃圾车', hp: 230, speed: 55, fuel: 0.16, tank: 80, weight: 160, torque: 240, mounts: 2, cells: 6, wcells: 4, cargo: 200, battery: 20, armor: 0.08,
    color: '#38b764', stripe: '#f4f4f4', len: 54, desc: '又慢又费油，但皮糙肉厚、能装。后斗的压缩机能把垃圾变成宝贝。', perk: '压缩机：搜刮和拆解获得的废料 +40%', scrapBonus: 0.4,
  },
  ebike: {
    name: '电单车', hp: 60, speed: 88, fuel: 0, tank: 0, weight: 25, torque: 50, mounts: 0, cells: 1, wcells: 0, cargo: 70, battery: 60, electric: 0.22, solar: 3,
    color: '#41a6f6', stripe: '#1a1c2c', len: 22, desc: '最快、不用汽油，靠电池跑。没有车厢，一开始只能睡帐篷——挂上拖车才算有个家。高难度。', perk: '轻快：搜索更快、不烧油；可以挂拖车', searchSpd: 0.3, tent: true,
  },
  pickup: {
    name: '皮卡', hp: 170, speed: 75, fuel: 0.13, tank: 70, weight: 120, torque: 200, mounts: 2, cells: 3, wcells: 3, cargo: 160, battery: 20,
    color: '#b13e53', stripe: '#333c57', len: 44, desc: '后斗能架两门武器，拖挂能力强（挂车不拖慢速度）。车内很挤。', perk: '拖挂：挂车重量不影响速度', towing: true,
  },
  icecream: {
    name: '冰淇淋车', hp: 120, speed: 65, fuel: 0.11, tank: 50, weight: 105, torque: 140, mounts: 1, cells: 5, wcells: 5, cargo: 120, battery: 30,
    color: '#f7b8d2', stripe: '#73eff7', len: 46, desc: '自带冷柜和音乐喇叭。末日里也要有一点甜。', perk: '自带冷柜（食物不变质）；商人更爱来；心情恢复更快', fridge: 1, trade: 0.15, comfort: 0.4,
  },
};
const RD_VEHICLE_ORDER = ['courier', 'garbage', 'ebike', 'pickup', 'icecream'];

// ---------- 改装件槽位 ----------
const RD_SLOTS = {
  engine: { name: '动力系统', ext: true },
  tires: { name: '轮胎', ext: true },
  armor: { name: '外装甲', ext: true },
  ram: { name: '前撞角', ext: true },
  chassis: { name: '底盘悬挂', ext: true },
  tank: { name: '油箱', ext: true, noBike: true },
  roof: { name: '车顶', ext: true, noBike: true },
  util: { name: '车身外挂', ext: true },
  trailer: { name: '挂车', ext: true },
  space: { name: '空间核心', ext: true, alienOnly: true },
  weapon: { name: '武器挂点', ext: true, multi: true },
  hand: { name: '随身武器', person: true },
  suit: { name: '防护服', person: true },
  in: { name: '车内设施', inner: true },
};
const RD_EXT_ORDER = ['engine', 'tires', 'armor', 'ram', 'chassis', 'tank', 'roof', 'util', 'trailer', 'space'];
const RD_TIER_COLOR = ['#94b0c2', '#94b0c2', '#a7f070', '#41a6f6', '#c27bd6', '#ffcd75', '#73eff7'];
const RD_TIER_NAME = ['', '破旧', '普通', '精良', '军用', '传说', '外星'];

// ---------- 改装件 ----------
// 每个型号：n 名称 · t 品阶(1~5，6=外星科技) · wt 重量 · pw 耗电/小时(负数=发电) · fx 效果 · d 说明
// 车内设施另有 w 占几格、layer 放地面(floor)还是墙面(wall)、act 主角会拿它做什么、v 画法
const RD_PARTS = {};
const RD_PART_LIST = [];
function rdFamily(slot, kind, def, models) {
  models.forEach((m, i) => {
    const p = Object.assign({ slot, kind, wt: 0, pw: 0, w: 1, layer: 'floor' }, def, m);
    p.fx = Object.assign({}, def.fx || {}, m.fx || {});
    p.id = kind + (i + 1);
    p.name = m.n; p.tier = m.t; p.alien = m.t >= 6;
    RD_PARTS[p.id] = p;
    RD_PART_LIST.push(p);
  });
}

// ===== 外装甲 =====
rdFamily('armor', 'armor', {}, [
  { n: '铁皮补丁', t: 1, wt: 8, fx: { hp: 30, armor: 0.05 }, d: '捡来的铁皮铆在车身上，聊胜于无' },
  { n: '车门拼接甲', t: 1, wt: 5, fx: { hp: 20, armor: 0.04 }, d: '拆下别的车门挂上去，轻便' },
  { n: '焊接钢板', t: 2, wt: 16, fx: { hp: 60, armor: 0.1 }, d: '厚钢板满焊，结实但重' },
  { n: '废轮胎缓冲甲', t: 2, wt: 8, fx: { hp: 45, armor: 0.08, obs: 0.1 }, d: '一圈旧轮胎，撞东西不那么疼' },
  { n: '铁丝网刺笼', t: 3, wt: 10, fx: { hp: 50, armor: 0.08, thorns: 6 }, d: '怪物扒车会被扎得鲜血淋漓' },
  { n: '复合陶瓷装甲', t: 3, wt: 18, fx: { hp: 100, armor: 0.16 }, d: '陶瓷+钢的夹层装甲' },
  { n: '钛合金蒙皮', t: 4, wt: 10, fx: { hp: 110, armor: 0.18 }, d: '轻量又坚固的航空材料' },
  { n: '军用反应装甲', t: 4, wt: 26, fx: { hp: 170, armor: 0.25 }, d: '受击时外层炸开抵消冲击' },
  { n: '重型坦克装甲', t: 5, wt: 40, fx: { hp: 280, armor: 0.32 }, d: '从坦克残骸上切下来的，非常重' },
  { n: '纳米蜂窝装甲', t: 5, wt: 16, fx: { hp: 200, armor: 0.26, regen: 4 }, d: '蜂窝结构里的纳米胶会慢慢填补裂缝' },
  { n: '外星生物甲壳', t: 6, wt: 12, fx: { hp: 300, armor: 0.3, regen: 15 }, d: '活着的甲壳，会自己长好伤口' },
  { n: '外星相位护盾', t: 6, wt: 6, pw: 1, fx: { hp: 150, armor: 0.2, shield: 120 }, d: '护盾先挨打，不受伤时会慢慢充满' },
  { n: '路牌鳞甲', t: 2, wt: 11, fx: { hp: 50, armor: 0.09 }, d: '把一路收集的路牌拼成鳞片' },
  { n: '防暴车装甲', t: 4, wt: 20, fx: { hp: 150, armor: 0.22, thorns: 4 }, d: '从防暴车上拆下，带电击网' },
]);

// ===== 前撞角 =====
rdFamily('ram', 'ram', {}, [
  { n: '木板撞角', t: 1, wt: 4, fx: { ram: 15, obs: 0.15 }, d: '几块木板钉成楔形' },
  { n: '购物车护栏', t: 1, wt: 3, fx: { ram: 10, obs: 0.25 }, d: '压扁的购物车，意外地好用' },
  { n: '钢管防撞杠', t: 2, wt: 8, fx: { ram: 25, obs: 0.3 }, d: '越野车常见的防撞杠' },
  { n: '推土铲', t: 2, wt: 14, fx: { ram: 20, obs: 0.6 }, d: '路障、废车一铲推开' },
  { n: '锯齿破城锤', t: 3, wt: 12, fx: { ram: 45, obs: 0.35 }, d: '布满锯齿的撞锤，专门撞怪' },
  { n: '旋转绞肉滚筒', t: 3, wt: 16, fx: { ram: 60, obs: 0.3 }, d: '车头的滚刀不停旋转' },
  { n: '液压撞锤', t: 4, wt: 18, fx: { ram: 80, obs: 0.5 }, d: '撞上的瞬间液压杆猛地弹出' },
  { n: '犁雪铲刀', t: 4, wt: 20, fx: { ram: 55, obs: 0.8 }, d: '巨大的铲刀，几乎什么都能推开' },
  { n: '电磁冲击撞角', t: 5, wt: 14, fx: { ram: 130, obs: 0.6 }, d: '撞击时释放强电磁脉冲' },
  { n: '外星力场犁', t: 6, wt: 4, pw: 1, fx: { ram: 200, obs: 1 }, d: '车头前方的力场把一切弹开' },
  { n: '尖刺栅栏', t: 2, wt: 9, fx: { ram: 32, obs: 0.2 }, d: '一排磨尖的钢筋' },
]);

// ===== 武器（可以装多门，数量看挂点） =====
// dmg 伤害 · rate 每秒几发 · range 射程 · ammo 消耗什么(ammo弹药/fuel燃油/power电力/scrap废料/none不消耗) · use 每发消耗
// proj 弹道外观 · count 一次几发 · splash 溅射半径 · pierce 穿透 · burn 燃烧 · slow 减速 · chain 连锁 · noAir 打不到飞行怪
rdFamily('weapon', 'wpn', {}, [
  { n: '弹弓发射器', t: 1, wt: 4, fx: { dmg: 6, rate: 1.2, range: 110, ammo: 'scrap', use: 0.2, proj: 'rock', noAir: true }, d: '用废料当子弹的大弹弓' },
  { n: '钉枪炮台', t: 1, wt: 5, fx: { dmg: 4, rate: 3, range: 100, ammo: 'scrap', use: 0.08, proj: 'nail' }, d: '工地钉枪改的连射炮台' },
  { n: '改装猎枪', t: 1, wt: 5, fx: { dmg: 16, rate: 0.9, range: 120, ammo: 'ammo', use: 0.2, proj: 'bullet' }, d: '固定在车顶的猎枪' },
  { n: '车载机枪', t: 2, wt: 9, fx: { dmg: 6, rate: 4, range: 150, ammo: 'ammo', use: 0.12, proj: 'bullet' }, d: '经典的车载机枪' },
  { n: '鱼叉炮', t: 2, wt: 8, fx: { dmg: 30, rate: 0.6, range: 170, ammo: 'scrap', use: 0.3, proj: 'harpoon', pierce: 2, slow: 0.5, noAir: true }, d: '一发能串两个，还能拖慢它们' },
  { n: '喷火器', t: 2, wt: 8, fx: { dmg: 5, rate: 8, range: 70, ammo: 'fuel', use: 0.02, proj: 'flame', burn: 4, noAir: true }, d: '烧油，近距离一片火海' },
  { n: '双联机枪', t: 3, wt: 12, fx: { dmg: 7, rate: 7, range: 160, ammo: 'ammo', use: 0.12, proj: 'bullet' }, d: '两挺机枪并联' },
  { n: '霰弹炮台', t: 3, wt: 12, fx: { dmg: 8, count: 6, rate: 0.9, range: 100, ammo: 'ammo', use: 0.5, proj: 'pellet' }, d: '近距离一轰一大片' },
  { n: '特斯拉线圈', t: 3, wt: 10, fx: { dmg: 22, rate: 1.2, range: 120, ammo: 'power', use: 0.5, proj: 'arc', chain: 3 }, d: '耗电，闪电在怪物之间跳跃' },
  { n: '榴弹发射器', t: 4, wt: 14, fx: { dmg: 45, rate: 0.8, range: 190, ammo: 'ammo', use: 0.8, proj: 'shell', splash: 30, noAir: true }, d: '爆炸范围伤害' },
  { n: '火箭巢', t: 4, wt: 16, fx: { dmg: 30, count: 4, rate: 0.5, range: 230, ammo: 'ammo', use: 1.5, proj: 'rocket', splash: 20 }, d: '一次齐射四枚火箭' },
  { n: '加特林转管机枪', t: 4, wt: 18, fx: { dmg: 7, rate: 14, range: 170, ammo: 'ammo', use: 0.1, proj: 'bullet' }, d: '弹雨，非常费子弹' },
  { n: '迫击炮', t: 5, wt: 20, fx: { dmg: 110, rate: 0.4, range: 260, ammo: 'ammo', use: 1.5, proj: 'mortar', splash: 45, noAir: true }, d: '高抛的重炮，炸开一大圈' },
  { n: '电磁轨道炮', t: 5, wt: 18, fx: { dmg: 160, rate: 0.5, range: 320, ammo: 'power', use: 2, proj: 'rail', pierce: 99 }, d: '耗电，一条直线全部贯穿' },
  { n: '凝固汽油喷射器', t: 5, wt: 14, fx: { dmg: 14, rate: 10, range: 90, ammo: 'fuel', use: 0.03, proj: 'flame', burn: 12, noAir: true }, d: '粘稠的火焰甩不掉' },
  { n: '外星激光阵列', t: 6, wt: 6, fx: { dmg: 18, rate: 8, range: 260, ammo: 'power', use: 0.25, proj: 'laser' }, d: '耗电，指哪打哪的光束' },
  { n: '等离子炮', t: 6, wt: 10, fx: { dmg: 90, rate: 1.2, range: 240, ammo: 'power', use: 1.2, proj: 'plasma', splash: 35 }, d: '耗电，炽热的等离子团' },
  { n: '重力奇点发射器', t: 6, wt: 12, fx: { dmg: 70, rate: 0.5, range: 220, ammo: 'power', use: 3, proj: 'grav', splash: 60, pull: true }, d: '制造小型奇点，把怪物吸在一起碾碎' },
  { n: '虚空切割光束', t: 6, wt: 8, fx: { dmg: 40, rate: 3, range: 300, ammo: 'power', use: 0.8, proj: 'beam', pierce: 99 }, d: '撕开空间的光束，贯穿一切' },
  { n: '生物酸液喷射器', t: 6, wt: 8, fx: { dmg: 20, rate: 4, range: 150, ammo: 'none', use: 0, proj: 'acid', burn: 6 }, d: '基因改造的腺体自己分泌酸液，不耗任何东西' },
  { n: '自制土炮', t: 1, wt: 7, fx: { dmg: 24, rate: 0.4, range: 140, ammo: 'scrap', use: 0.5, proj: 'rock', splash: 14, noAir: true }, d: '水管+火药，动静很大' },
  { n: '复合弩炮', t: 3, wt: 9, fx: { dmg: 40, rate: 0.8, range: 200, ammo: 'scrap', use: 0.3, proj: 'harpoon', pierce: 3 }, d: '大号弩，安静又致命' },
  // ---- 车外自瞄炮塔（turret：360° 转动自动瞄准，优先打最靠近车的怪，前后上方都能打） ----
  { n: '自动机枪塔', t: 3, wt: 14, pw: 0.2, fx: { dmg: 6, rate: 6, range: 180, ammo: 'ammo', use: 0.1, proj: 'bullet', turret: 'mg' }, d: '带转台和传感器的机枪，自己找目标，车后和天上的也能打' },
  { n: '双联自动炮塔', t: 4, wt: 22, pw: 0.3, fx: { dmg: 18, rate: 3, range: 220, ammo: 'ammo', use: 0.3, proj: 'bullet', turret: 'cannon', pierce: 1 }, d: '两门小口径机炮，打穿一只再打下一只' },
  { n: '防空速射炮塔', t: 4, wt: 16, pw: 0.3, fx: { dmg: 9, rate: 8, range: 240, ammo: 'ammo', use: 0.12, proj: 'bullet', turret: 'aa', airBonus: 0.6 }, d: '四联装速射炮，优先打飞行怪，对空伤害 +60%' },
  { n: '追踪导弹塔', t: 5, wt: 18, pw: 0.4, fx: { dmg: 36, count: 2, rate: 0.7, range: 300, ammo: 'ammo', use: 1, proj: 'missile', splash: 18, homing: 1, turret: 'missile' }, d: '发射会拐弯的导弹，几乎不会落空' },
  { n: '激光点防御塔', t: 5, wt: 10, pw: 0.8, fx: { dmg: 13, rate: 7, range: 240, ammo: 'power', use: 0.2, proj: 'laser', turret: 'laser' }, d: '耗电，激光瞬间命中，不用子弹' },
  { n: '外星哨兵炮塔', t: 6, wt: 8, pw: 1, fx: { dmg: 45, rate: 2, range: 280, ammo: 'power', use: 0.8, proj: 'plasma', splash: 24, turret: 'alien' }, d: '耗电，悬浮的外星哨兵，自己追着怪物开火' },
]);

// ===== 动力系统 =====
// speed 极速加成 · fuelPct 油耗增减 · torque 载重能力 · alt 行驶时发电/小时 · electric 改为耗电(每公里)
rdFamily('engine', 'eng', {}, [
  { n: '割草机引擎', t: 1, wt: 6, fx: { speed: -10, fuelPct: -0.35, torque: -10, alt: 1 }, d: '慢，但特别省油' },
  { n: '老旧柴油机', t: 1, wt: 14, fx: { speed: 0, torque: 20, alt: 2 }, d: '突突突，扛得住' },
  { n: '改装汽油V6', t: 2, wt: 14, fx: { speed: 12, fuelPct: 0.1, torque: 25, alt: 2 }, d: '更快一些' },
  { n: '电动机组', t: 2, wt: 10, fx: { speed: 6, torque: 15, electric: 0.18 }, d: '改成耗电，不烧油（需要发电）' },
  { n: '生物柴油引擎', t: 3, wt: 14, fx: { speed: 6, fuelPct: -0.3, torque: 30, alt: 3 }, d: '省油的环保引擎' },
  { n: '涡轮增压V8', t: 3, wt: 18, fx: { speed: 25, fuelPct: 0.25, torque: 50, alt: 3 }, d: '咆哮的大马力' },
  { n: '军用多燃料引擎', t: 4, wt: 20, fx: { speed: 18, fuelPct: -0.15, torque: 80, alt: 4 }, d: '什么油都能烧，耐操' },
  { n: '氢燃料电池', t: 4, wt: 12, fx: { speed: 15, torque: 50, electric: 0.12 }, d: '耗电驱动，效率很高' },
  { n: '混动引擎', t: 5, wt: 18, fx: { speed: 25, fuelPct: -0.4, torque: 80, alt: 6 }, d: '又快又省，还能发电' },
  { n: '喷气推进器', t: 5, wt: 16, fx: { speed: 60, fuelPct: 0.9, torque: 40, alt: 2 }, d: '车尾喷火，快得离谱，油老虎' },
  { n: '外星反物质核心', t: 6, wt: 8, fx: { speed: 40, fuelPct: -1, torque: 150, alt: 12 }, d: '不再需要任何燃料，还能大量发电' },
  { n: '零点能引擎', t: 6, wt: 5, fx: { speed: 70, fuelPct: -1, torque: 200, alt: 25 }, d: '从真空里抽取能量' },
  { n: '摩托车双缸', t: 2, wt: 7, fx: { speed: 10, fuelPct: -0.1, torque: 10, alt: 1 }, d: '小巧轻快' },
]);

// ===== 轮胎 =====  obs = 撞到路障时少受的伤
rdFamily('tires', 'tire', {}, [
  { n: '光头旧胎', t: 1, wt: 4, fx: { speed: -5 }, d: '花纹都磨平了' },
  { n: '实心橡胶胎', t: 1, wt: 6, fx: { speed: -3, obs: 0.15 }, d: '不会爆胎' },
  { n: '越野胎', t: 2, wt: 7, fx: { speed: 2, obs: 0.25 }, d: '大块花纹，烂路也能跑' },
  { n: '防滑雪地链', t: 2, wt: 7, fx: { speed: -2, obs: 0.2, snow: true }, d: '冰雪地区不减速' },
  { n: '防爆缺气保用胎', t: 3, wt: 8, fx: { speed: 4, obs: 0.35, hp: 20 }, d: '扎破了也能继续跑' },
  { n: '钉刺轮胎', t: 3, wt: 8, fx: { speed: 2, obs: 0.25, ram: 20 }, d: '轮子上全是钉子' },
  { n: '军用全地形胎', t: 4, wt: 9, fx: { speed: 8, obs: 0.45, snow: true }, d: '什么路都能跑' },
  { n: '履带套件', t: 4, wt: 20, fx: { speed: -10, obs: 0.75, ram: 30, snow: true }, d: '改成履带，像坦克一样碾过去' },
  { n: '碳纤维竞速胎', t: 5, wt: 5, fx: { speed: 20, obs: 0.3 }, d: '赛车用的轮胎' },
  { n: '智能变形轮', t: 5, wt: 9, fx: { speed: 14, obs: 0.6, snow: true }, d: '会根据路面自动改变形状' },
  { n: '拖拉机大轮', t: 2, wt: 12, fx: { speed: -6, obs: 0.45 }, d: '巨大的后轮，慢但稳' },
]);

// ===== 底盘悬挂 =====  hover 反重力漂浮
rdFamily('chassis', 'chs', {}, [
  { n: '加高悬挂', t: 2, wt: 6, fx: { obs: 0.15, speed: 2 }, d: '底盘抬高，不怕刮底' },
  { n: '液压气动悬挂', t: 3, wt: 8, fx: { obs: 0.25, speed: 4, comfort: 0.2 }, d: '车内更平稳' },
  { n: '主动电磁减震', t: 4, wt: 8, pw: 0.3, fx: { obs: 0.35, speed: 6, comfort: 0.5 }, d: '几乎感觉不到颠簸' },
  { n: '军用重载底盘', t: 5, wt: 14, fx: { obs: 0.4, torque: 80, hp: 60 }, d: '能扛更多重量' },
  { n: '反重力漂浮装置', t: 6, wt: 6, pw: 1, fx: { hover: 1, speedPct: 0.3, obs: 1, fuelPct: -0.25 }, d: '整辆车浮离地面！路障、坑洞都不再是问题' },
  { n: '引力波悬浮阵列', t: 6, wt: 4, pw: 1.5, fx: { hover: 1, speedPct: 0.45, obs: 1, comfort: 1, fuelPct: -0.3 }, d: '悬浮得更高更稳，车内如履平地' },
  { n: '弹簧钢板悬挂', t: 1, wt: 5, fx: { obs: 0.08, torque: 20 }, d: '老式板簧，多拉点东西' },
]);

// ===== 油箱 =====
rdFamily('tank', 'tank', {}, [
  { n: '捆扎塑料油桶', t: 1, wt: 4, fx: { tank: 20 }, d: '几个油桶绑在车身上' },
  { n: '副油箱', t: 2, wt: 6, fx: { tank: 35 } },
  { n: '加大油箱', t: 3, wt: 8, fx: { tank: 60 } },
  { n: '防弹自封油箱', t: 4, wt: 10, fx: { tank: 70, hp: 30 }, d: '中弹也不会漏油' },
  { n: '军用燃料舱', t: 5, wt: 14, fx: { tank: 120 } },
  { n: '外星能量储罐', t: 6, wt: 4, fx: { tank: 80, battery: 80 }, d: '同时储存燃料和电力' },
]);

// ===== 车顶 =====
rdFamily('roof', 'roof', {}, [
  { n: '车顶行李架', t: 1, wt: 4, fx: { cargo: 40 }, d: '多装点东西' },
  { n: '帆布遮阳棚', t: 1, wt: 3, fx: { comfort: 0.3 }, d: '停车时撑开，坐在下面歇会' },
  { n: '小型太阳能板', t: 2, wt: 4, fx: { solar: 2 }, d: '白天每小时发 2 电' },
  { n: '探照灯组', t: 2, wt: 4, pw: 0.3, fx: { light: 1 }, d: '夜里看得清：夜间武器射程不打折，遇袭更少' },
  { n: '瞭望台', t: 2, wt: 8, fx: { rangePct: 0.15, lookout: 1 }, d: '武器射程 +15%，能提前看到前方建筑是什么' },
  { n: '雷达天线', t: 3, wt: 5, pw: 0.4, fx: { radar: 1, lookout: 1 }, d: '提前看到建筑里大概有什么、危不危险' },
  { n: '车顶自动炮座', t: 3, wt: 10, fx: { mounts: 1 }, d: '多一个武器挂点' },
  { n: '风力发电机', t: 3, wt: 6, fx: { wind: 3 }, d: '行驶时每小时发 3 电' },
  { n: '大型光伏阵列', t: 4, wt: 8, fx: { solar: 6 } },
  { n: '无人机机库', t: 5, wt: 10, pw: 0.5, fx: { searchSpd: 0.5, lootBonus: 0.2 }, d: '无人机帮忙搜索：更快、找到更多' },
  { n: '雨水收集棚', t: 2, wt: 5, fx: { rain: 2 }, d: '每天收集 2 份水' },
  { n: '外星感应天线', t: 6, wt: 3, pw: 0.5, fx: { radar: 2, lookout: 1, alienSense: 1 }, d: '能感应外星遗迹，外星坠落点出现得更多' },
  { n: '外星光子帆', t: 6, wt: 3, fx: { solar: 18, nightSolar: 0.5 }, d: '连星光都能转成电，夜里也有一半发电' },
  { n: '双联炮塔座', t: 5, wt: 16, fx: { mounts: 2 }, d: '多两个武器挂点' },
]);

// ===== 车身外挂 =====
rdFamily('util', 'util', {}, [
  { n: '绞盘', t: 1, wt: 5, fx: { obs: 0.2 }, d: '把路障拖开' },
  { n: '带刺铁丝网', t: 1, wt: 3, fx: { thorns: 4 }, d: '扒车的怪物会受伤' },
  { n: '外挂储物箱', t: 1, wt: 5, fx: { cargo: 30 } },
  { n: '车外扬声器', t: 2, wt: 3, pw: 0.2, fx: { trade: 0.1, comfort: 0.2 }, d: '放点音乐，商人也更愿意靠近' },
  { n: '烟雾发生器', t: 3, wt: 5, fx: { stealth: 0.2 }, d: '路上遇到的怪物少 20%' },
  { n: '电击护栏', t: 3, wt: 6, pw: 0.4, fx: { thorns: 15 }, d: '通电的护栏' },
  { n: '自动灭火系统', t: 4, wt: 5, fx: { regen: 6 }, d: '车辆每小时自动修复 6 点' },
  { n: '机械臂回收器', t: 4, wt: 8, fx: { scrapBonus: 0.3 }, d: '搜刮和打怪获得的废料 +30%' },
  { n: 'EMP脉冲器', t: 5, wt: 6, pw: 0.5, fx: { stealth: 0.3, thorns: 10 } },
  { n: '外星隐形力场', t: 6, wt: 2, pw: 1, fx: { stealth: 0.5 }, d: '怪物很难发现你' },
  { n: '外星纳米修复云', t: 6, wt: 2, pw: 0.5, fx: { regen: 25 }, d: '车辆每小时自动修复 25 点' },
  { n: '侧挂油桶架', t: 2, wt: 6, fx: { tank: 15, cargo: 10 } },
]);

// ===== 挂车 =====
rdFamily('trailer', 'trl', {}, [
  { n: '小推车拖斗', t: 1, wt: 8, fx: { cargo: 60 }, d: '多拉点物资' },
  { n: '露营挂车', t: 2, wt: 22, fx: { cells: 3, wcells: 3, cargo: 20 }, d: '多一个小房间（地面 3 格 + 墙面 3 格）' },
  { n: '货运集装箱挂车', t: 3, wt: 35, fx: { cells: 4, wcells: 4, cargo: 120, hp: 60 }, d: '集装箱改装的房间，还能装很多货' },
  { n: '双层房车挂车', t: 4, wt: 40, fx: { cells: 6, wcells: 6, cargo: 40 }, d: '宽敞的房车' },
  { n: '装甲运兵挂车', t: 5, wt: 45, fx: { cells: 5, wcells: 5, hp: 150, armor: 0.05, mounts: 1 }, d: '带武器挂点的装甲车厢' },
  { n: '外星折叠空间舱', t: 6, wt: 10, fx: { cells: 8, wcells: 8, cargo: 80 }, d: '小小一个舱，里面大得惊人' },
]);

// ===== 空间核心（车内空间扩展：外观不变，车厢变大） =====
rdFamily('space', 'spc', {}, [
  { n: '空间折叠装置·I型', t: 6, wt: 3, pw: 1, fx: { spaceMul: 1.5 }, d: '车内空间 ×1.5（外面看还是原来那么大）' },
  { n: '空间折叠装置·II型', t: 6, wt: 3, pw: 2, fx: { spaceMul: 2 }, d: '车内空间 ×2' },
  { n: '空间折叠装置·III型', t: 6, wt: 3, pw: 3, fx: { spaceMul: 3 }, d: '车内空间 ×3，像住进了一栋房子' },
]);

// ===== 随身武器（下车搜索时用） =====
rdFamily('hand', 'hand', {}, [
  { n: '生锈撬棍', t: 1, fx: { dmg: 6, rate: 1.2, range: 14 }, d: '近战' },
  { n: '消防斧', t: 1, fx: { dmg: 12, rate: 0.8, range: 14 }, d: '近战' },
  { n: '自制弩', t: 2, fx: { dmg: 14, rate: 0.8, range: 90, ammo: 'scrap', use: 0.1 } },
  { n: '左轮手枪', t: 2, fx: { dmg: 12, rate: 1.5, range: 100, ammo: 'ammo', use: 0.2 } },
  { n: '双管霰弹枪', t: 3, fx: { dmg: 7, count: 5, rate: 0.8, range: 70, ammo: 'ammo', use: 0.4 } },
  { n: '电锯', t: 3, fx: { dmg: 10, rate: 5, range: 16, ammo: 'fuel', use: 0.01 }, d: '近战，烧一点油' },
  { n: '突击步枪', t: 4, fx: { dmg: 9, rate: 6, range: 130, ammo: 'ammo', use: 0.15 } },
  { n: '狙击步枪', t: 4, fx: { dmg: 60, rate: 0.5, range: 200, ammo: 'ammo', use: 0.4 } },
  { n: '单兵火箭筒', t: 5, fx: { dmg: 80, rate: 0.3, range: 180, ammo: 'ammo', use: 1.5, splash: 30 } },
  { n: '动力拳套', t: 5, fx: { dmg: 50, rate: 1.5, range: 16 }, d: '近战，一拳一个' },
  { n: '外星光刃', t: 6, fx: { dmg: 60, rate: 2, range: 18 }, d: '近战' },
  { n: '外星离子手枪', t: 6, fx: { dmg: 30, rate: 3, range: 160, ammo: 'power', use: 0.2 } },
  { n: '棒球棍', t: 1, fx: { dmg: 8, rate: 1, range: 14 }, d: '近战' },
]);

// ===== 防护服 =====
rdFamily('suit', 'suit', {}, [
  { n: '旧皮夹克', t: 1, fx: { armorP: 0.08 } },
  { n: '自制防辐射雨衣', t: 1, fx: { radRes: 0.3 }, d: '辐射 -30%' },
  { n: '防弹背心', t: 2, fx: { armorP: 0.2 } },
  { n: '防化服', t: 2, fx: { radRes: 0.6, armorP: 0.05 } },
  { n: '摩托护甲', t: 3, fx: { armorP: 0.25, hpP: 20 } },
  { n: '军用外骨骼', t: 4, fx: { armorP: 0.35, hpP: 40, walk: 0.3 }, d: '走路更快' },
  { n: '铅衬防辐射甲', t: 4, fx: { radRes: 0.8, armorP: 0.2 } },
  { n: '动力装甲', t: 5, fx: { armorP: 0.5, hpP: 80, radRes: 0.5, walk: 0.2 } },
  { n: '外星共生服', t: 6, fx: { armorP: 0.45, hpP: 60, radRes: 1, regenP: 5 }, d: '完全免疫辐射，还会慢慢治疗你' },
]);

// ===== 车内设施 =====
// act = 主角会在这里做什么（sleep睡觉 cook做饭 eat吃 drink喝水 heal治疗 craft制作 pc电脑 fun娱乐 …）
// ---- 床 ----  sleep = 睡眠质量（恢复精力的速度）
rdFamily('in', 'bed', { act: 'sleep', v: 'bed' }, [
  { n: '纸箱地铺', t: 1, fx: { sleep: 0.6 }, v: 'cardboard', d: '铺几层纸板，凑合睡' },
  { n: '睡袋', t: 1, fx: { sleep: 0.75 }, v: 'sleepbag' },
  { n: '折叠行军床', t: 1, fx: { sleep: 0.85 }, v: 'cot' },
  { n: '弹簧床垫', t: 2, w: 2, fx: { sleep: 1.0, comfort: 0.2 }, v: 'mattress' },
  { n: '双层床', t: 2, fx: { sleep: 1.0 }, v: 'bunk', d: '只占一格的床' },
  { n: '吊床', t: 2, layer: 'wall', fx: { sleep: 0.9, comfort: 0.3 }, v: 'hammock', d: '挂在墙上，不占地面' },
  { n: '记忆棉大床', t: 3, w: 2, fx: { sleep: 1.3, comfort: 0.5 }, v: 'bigbed' },
  { n: '水床', t: 4, w: 2, fx: { sleep: 1.45, comfort: 0.8 }, v: 'waterbed' },
  { n: '胶囊睡眠舱', t: 4, pw: 0.2, fx: { sleep: 1.3 }, v: 'capsule' },
  { n: '外星悬浮睡眠舱', t: 6, pw: 0.5, fx: { sleep: 2, sleepHeal: 4 }, v: 'alienpod', d: '睡觉时还会治疗' },
  { n: '外星冬眠舱', t: 6, pw: 0.8, fx: { sleep: 1.6, slowNeeds: 0.5 }, v: 'cryo', d: '睡着时饥饿口渴减半' },
]);
// ---- 炉灶 ----  cook = 每份食物顶饱的倍数
rdFamily('in', 'stove', { act: 'cook', v: 'stove' }, [
  { n: '酒精炉', t: 1, fx: { cook: 1.2 }, v: 'burner' },
  { n: '野营燃气灶', t: 1, fx: { cook: 1.3 }, v: 'burner' },
  { n: '电磁炉', t: 2, pw: 0.3, fx: { cook: 1.5 }, v: 'induction' },
  { n: '烧烤架', t: 2, fx: { cook: 1.4, fun: 3 }, v: 'grill' },
  { n: '整体厨房', t: 3, w: 2, pw: 0.3, fx: { cook: 1.8, comfort: 0.3 }, v: 'kitchen' },
  { n: '咖啡机', t: 2, layer: 'wall', pw: 0.2, act: 'coffee', fx: { fun: 4, coffee: 1 }, v: 'coffee', d: '来一杯：精力 +15、心情变好' },
  { n: '智能料理机', t: 4, pw: 0.4, fx: { cook: 2.0 }, v: 'induction' },
  { n: '外星基因食物合成器', t: 6, pw: 2, fx: { cook: 2.2, foodGen: 6 }, v: 'synth', d: '用电合成食物，每天 +6 食物' },
]);
// ---- 冷藏 ----  fridge = 防止食物变质
rdFamily('in', 'fridge', { act: 'eat', v: 'fridge' }, [
  { n: '泡沫保温箱', t: 1, fx: { fridge: 0.4 }, v: 'cooler' },
  { n: '车载小冰箱', t: 2, pw: 0.3, fx: { fridge: 0.8 }, v: 'minifridge' },
  { n: '双门冰箱', t: 3, w: 2, pw: 0.5, fx: { fridge: 1, cargo: 30 }, v: 'bigfridge' },
  { n: '冷冻柜', t: 3, pw: 0.5, fx: { fridge: 1 }, v: 'freezer' },
  { n: '外星静滞力场柜', t: 6, pw: 0.3, fx: { fridge: 1, cargo: 60 }, v: 'stasis' },
]);
// ---- 饮水 ----  waterGen = 每天产水
rdFamily('in', 'water', { act: 'drink', v: 'water' }, [
  { n: '雨水过滤桶', t: 1, fx: { waterGen: 1.5 }, v: 'barrel' },
  { n: '便携净水器', t: 2, layer: 'wall', fx: { waterGen: 2 }, v: 'filter' },
  { n: '反渗透净水机', t: 3, layer: 'wall', pw: 0.3, fx: { waterGen: 4 }, v: 'filter' },
  { n: '大气制水机', t: 4, pw: 0.6, fx: { waterGen: 7 }, v: 'aquagen' },
  { n: '外星分子水合成器', t: 6, pw: 1, fx: { waterGen: 14 }, v: 'synth' },
]);
// ---- 医疗 ----  heal 使用时每小时回血 · radClean 每小时去辐射 · medGen 每天产药
rdFamily('in', 'med', { act: 'heal', v: 'med' }, [
  { n: '急救箱', t: 1, layer: 'wall', fx: { heal: 4 }, v: 'firstaid' },
  { n: '医疗床', t: 3, w: 2, fx: { heal: 8, radClean: 2 }, v: 'medbed' },
  { n: '辐射净化舱', t: 4, pw: 0.5, fx: { radClean: 10, heal: 2 }, v: 'decon' },
  { n: '外星纳米修复舱', t: 6, pw: 1, fx: { heal: 30, radClean: 20 }, v: 'alienpod' },
  { n: '基因药剂工坊', t: 6, pw: 1, fx: { medGen: 2, heal: 4 }, v: 'synth', d: '每天产出 2 份药品' },
]);
// ---- 电力 ----  battery 电池容量 · gen 发电机(烧油) · genFree 免费发电
rdFamily('in', 'pow', { v: 'battery' }, [
  { n: '铅酸电池组', t: 1, fx: { battery: 30 }, v: 'battery' },
  { n: '锂电池组', t: 3, fx: { battery: 80 }, v: 'battery' },
  { n: '汽油发电机', t: 2, fx: { gen: 6 }, v: 'generator', d: '缺电时自动启动，每 4 电烧 1 升油' },
  { n: '柴油发电机组', t: 3, w: 2, fx: { gen: 12 }, v: 'generator' },
  { n: '外星聚变电池', t: 6, fx: { battery: 200, genFree: 8 }, v: 'fusion', d: '每小时免费发 8 电' },
  { n: '超级电容墙', t: 4, layer: 'wall', fx: { battery: 60 }, v: 'capwall' },
]);
// ---- 电脑 ----  research 研究等级 · autopilot 自动驾驶（主角开车时也能在车里活动） · nav 导航
rdFamily('in', 'pc', { act: 'pc', v: 'pc' }, [
  { n: '旧笔记本电脑', t: 1, layer: 'wall', pw: 0.2, fx: { research: 1, fun: 3 }, v: 'laptop' },
  { n: '车载电脑', t: 2, layer: 'wall', pw: 0.3, fx: { research: 2, lookout: 1, fun: 3 }, v: 'carpc' },
  { n: '军用战术终端', t: 3, pw: 0.5, fx: { research: 3, autopilot: 1, lookout: 1, radar: 1 }, v: 'terminal', d: '能自动驾驶！开车时你也能在车里休息' },
  { n: '量子计算机', t: 5, w: 2, pw: 1.5, fx: { research: 4, autopilot: 1, radar: 1 }, v: 'quantum' },
  { n: '外星AI核心', t: 6, pw: 1, fx: { research: 5, autopilot: 1, aim: 0.3, radar: 2 }, v: 'aicore', d: '自动驾驶，所有车载武器伤害 +30%' },
  { n: '自动驾驶模块', t: 4, layer: 'wall', pw: 0.4, fx: { autopilot: 1 }, v: 'carpc', d: '专门的自动驾驶电脑' },
]);
// ---- 工作台 ----  craft 制作等级（可以制作学会图纸的改装件，也能修车）
rdFamily('in', 'bench', { act: 'craft', v: 'bench' }, [
  { n: '简易工具箱', t: 1, layer: 'wall', fx: { craft: 1, repair: 3 }, v: 'toolwall' },
  { n: '工作台', t: 2, fx: { craft: 2, repair: 5 }, v: 'bench' },
  { n: '机械车间', t: 3, w: 2, fx: { craft: 3, repair: 10 }, v: 'workshop' },
  { n: '3D打印机', t: 4, pw: 0.5, fx: { craft: 5, repair: 6 }, v: 'printer', d: '能打印传说级零件' },
  { n: '外星物质重组器', t: 6, pw: 1.5, fx: { craft: 6, repair: 15 }, v: 'synth', d: '能制作外星科技部件' },
]);
// ---- 娱乐休闲 ----  fun 使用时每小时心情 · comfort 放着就加心情
rdFamily('in', 'fun', { act: 'fun' }, [
  { n: '旧收音机', t: 1, layer: 'wall', fx: { fun: 3, comfort: 0.1 }, v: 'radio', anim: 'radio' },
  { n: '口琴', t: 1, layer: 'wall', fx: { fun: 3 }, v: 'harmonica', anim: 'music' },
  { n: '书架', t: 1, layer: 'wall', fx: { fun: 4, comfort: 0.1 }, v: 'shelf', anim: 'read' },
  { n: '拼图', t: 1, layer: 'wall', fx: { fun: 3 }, v: 'puzzle', anim: 'sitfloor' },
  { n: '吉他', t: 2, layer: 'wall', fx: { fun: 6 }, v: 'guitar', anim: 'guitar' },
  { n: '旧电视+DVD', t: 2, layer: 'wall', pw: 0.3, fx: { fun: 6 }, v: 'tv', anim: 'watch' },
  { n: '哑铃架', t: 2, fx: { fun: 3, fitness: 5 }, v: 'dumbbell', anim: 'lift' },
  { n: '懒人沙发', t: 2, fx: { fun: 4, comfort: 0.2 }, v: 'beanbag', anim: 'sit' },
  { n: '游戏机', t: 3, layer: 'wall', pw: 0.3, fx: { fun: 8 }, v: 'console', anim: 'game' },
  { n: '黑胶唱机', t: 3, pw: 0.2, fx: { fun: 7, comfort: 0.2 }, v: 'record', anim: 'dance' },
  { n: '音响套装', t: 3, pw: 0.3, fx: { fun: 6, comfort: 0.3 }, v: 'speaker', anim: 'dance' },
  { n: '跑步机', t: 3, pw: 0.3, fx: { fun: 4, fitness: 10 }, v: 'treadmill', anim: 'run' },
  { n: '鱼缸', t: 3, pw: 0.1, fx: { fun: 4, comfort: 0.4 }, v: 'aquarium', anim: 'watch' },
  { n: '布艺沙发', t: 3, w: 2, fx: { fun: 5, comfort: 0.5 }, v: 'sofa', anim: 'sofa' },
  { n: '按摩椅', t: 4, pw: 0.3, fx: { fun: 9 }, v: 'massage', anim: 'sofa' },
  { n: '投影家庭影院', t: 4, w: 2, layer: 'wall', pw: 0.6, fx: { fun: 12, comfort: 0.4 }, v: 'projector', anim: 'watch' },
  { n: '卡拉OK机', t: 4, pw: 0.4, fx: { fun: 10 }, v: 'karaoke', anim: 'sing' },
  { n: '台球桌', t: 4, w: 2, fx: { fun: 9 }, v: 'pool', anim: 'pool' },
  { n: '外星全息娱乐室', t: 6, w: 2, pw: 1.5, fx: { fun: 20, comfort: 1 }, v: 'holo', anim: 'holo' },
  { n: '画架', t: 2, fx: { fun: 6 }, v: 'easel', anim: 'paint' },
  { n: '小型书桌', t: 1, fx: { fun: 3, comfort: 0.1 }, v: 'desk', anim: 'read' },
]);
// ---- 装饰 ----（放着就加心情）
rdFamily('in', 'decor', {}, [
  { n: '旧海报', t: 1, layer: 'wall', fx: { comfort: 0.3 }, v: 'poster' },
  { n: '窗帘', t: 1, layer: 'wall', fx: { comfort: 0.3 }, v: 'curtain' },
  { n: '盆栽绿植', t: 1, fx: { comfort: 0.3 }, v: 'plant', act: 'plant', anim: 'water' },
  { n: '串灯', t: 2, layer: 'wall', pw: 0.05, fx: { comfort: 0.5 }, v: 'lights' },
  { n: '编织地毯', t: 2, fx: { comfort: 0.4, rug: 1 }, v: 'rug' },
  { n: '墙纸', t: 2, layer: 'wall', fx: { comfort: 0.5, wallpaper: 1 }, v: 'wallpaper', d: '整面墙换成温馨的墙纸' },
  { n: '暖风机', t: 2, pw: 0.4, fx: { comfort: 0.3, warm: 1 }, v: 'heater', d: '夜里不冷' },
  { n: '空调', t: 3, layer: 'wall', pw: 0.5, fx: { comfort: 0.8, warm: 1 }, v: 'ac' },
  { n: '香薰机', t: 3, layer: 'wall', pw: 0.05, fx: { comfort: 0.4 }, v: 'diffuser' },
  { n: '全家福相框', t: 1, layer: 'wall', fx: { comfort: 0.4 }, v: 'photo', d: '你在废墟里捡到的，不知道是谁家的' },
  { n: '木地板', t: 3, fx: { comfort: 0.6, floorWood: 1 }, v: 'rug', d: '整个车厢铺上木地板' },
  { n: '外星生态墙', t: 6, w: 2, layer: 'wall', fx: { comfort: 1.5, foodGen: 1, waterGen: 1 }, v: 'ecowall' },
]);
// ---- 生活设施 ----
rdFamily('in', 'life', {}, [
  { n: '简易淋浴间', t: 2, act: 'shower', fx: { radClean: 5, fun: 3 }, v: 'shower' },
  { n: '豪华浴室', t: 4, w: 2, pw: 0.3, act: 'shower', fx: { radClean: 10, fun: 8, comfort: 0.5 }, v: 'bath' },
  { n: '洗衣机', t: 3, pw: 0.3, fx: { comfort: 0.4 }, v: 'washer' },
  { n: '宠物窝', t: 1, fx: { pet: 1, comfort: 0.2 }, v: 'petbed', d: '如果路上遇到流浪狗，可以收留它' },
  { n: '猫爬架', t: 2, fx: { pet: 2, comfort: 0.3 }, v: 'cattree', d: '如果路上遇到流浪猫，可以收留它' },
  { n: '温室种植架', t: 2, act: 'plant', fx: { foodGen: 1.5 }, v: 'grow', anim: 'water' },
  { n: '水培蔬菜柜', t: 3, pw: 0.3, act: 'plant', fx: { foodGen: 3 }, v: 'hydro', anim: 'water' },
  { n: '外星克隆蔬菜舱', t: 6, pw: 1, act: 'plant', fx: { foodGen: 8 }, v: 'synth', anim: 'water' },
  { n: '餐桌椅', t: 2, fx: { comfort: 0.3, dine: 1 }, v: 'table', d: '坐下来好好吃饭，吃饭时心情更好' },
]);
// ---- 储物 ----
rdFamily('in', 'store', {}, [
  { n: '纸箱堆', t: 1, fx: { cargo: 25 }, v: 'boxes' },
  { n: '储物柜', t: 1, layer: 'wall', fx: { cargo: 30 }, v: 'locker' },
  { n: '金属货架', t: 2, fx: { cargo: 50 }, v: 'rack' },
  { n: '弹药箱架', t: 2, layer: 'wall', fx: { cargo: 40 }, v: 'ammorack' },
  { n: '外星压缩储物格', t: 6, layer: 'wall', fx: { cargo: 200 }, v: 'stasis' },
]);

function rdPart(id) { return RD_PARTS[id]; }
function rdPartsOf(slot) { return RD_PART_LIST.filter((p) => p.slot === slot); }

// ---------- 资源 ----------
const RD_RES = {
  fuel: { name: '燃油', color: '#ef7d57' },
  scrap: { name: '废料', color: '#94b0c2' },
  food: { name: '食物', color: '#a7f070' },
  water: { name: '水', color: '#41a6f6' },
  med: { name: '药品', color: '#f4f4f4' },
  ammo: { name: '弹药', color: '#ffcd75' },
  power: { name: '电力', color: '#73eff7' },
  alien: { name: '外星晶体', color: '#c27bd6' },
};
// 占货舱的资源（燃油在油箱、电在电池里）
const RD_CARGO_RES = ['scrap', 'food', 'water', 'med', 'ammo', 'alien'];

// ---------- 地区（每 270 公里换一次风景，越往后越危险） ----------
const RD_BIOMES = [
  { name: '荒漠公路', sky: ['#f2b56b', '#e98a52', '#7c4a3a'], far: '#a5674a', mid: '#7c4a3a', ground: '#c99464', road: '#4a4a52', deco: 'cactus', rad: 0 },
  { name: '废墟城郊', sky: ['#b8c0c4', '#8a9298', '#4e555c'], far: '#5d6670', mid: '#3e444c', ground: '#7d7a72', road: '#3d3f45', deco: 'ruin', rad: 0 },
  { name: '枯死森林', sky: ['#a9a28a', '#7f7a63', '#3f3d33'], far: '#4c5040', mid: '#2f3328', ground: '#5b5440', road: '#3a3934', deco: 'deadtree', rad: 0.2 },
  { name: '辐射荒原', sky: ['#9fc58a', '#6a8f55', '#2c3d2a'], far: '#46603a', mid: '#2c3d2a', ground: '#6b7046', road: '#383c33', deco: 'glow', rad: 1 },
  { name: '冰封高原', sky: ['#cfe3f0', '#94b6cf', '#4c6a85'], far: '#8aa8c2', mid: '#5f7f9c', ground: '#dfe9f1', road: '#5a6370', deco: 'snow', rad: 0.2, snow: true },
  { name: '外星坠落区', sky: ['#b48ad6', '#6d4ca0', '#24183f'], far: '#4b3378', mid: '#2e1f50', ground: '#5a4a6e', road: '#2c2838', deco: 'crystal', rad: 0.6, alien: true },
];
const RD_BIOME_LEN = 270;
function rdBiomeAt(km) { return RD_BIOMES[Math.floor(km / RD_BIOME_LEN) % RD_BIOMES.length]; }
function rdBiomeIndex(km) { return Math.floor(km / RD_BIOME_LEN) % RD_BIOMES.length; }

// ---------- 路边建筑 ----------
// res 可能找到的资源 [最少, 最多] · slots 可能找到的改装件槽位 · danger 遇袭概率 · rad 辐射 · size 搜索时间(小时)
const RD_SITES = {
  gas: { name: '废弃加油站', w: 70, h: 40, res: { fuel: [8, 26], food: [0, 3], water: [1, 4], scrap: [2, 8], ammo: [0, 4] }, slots: ['tank', 'engine', 'util'], partChance: 0.35, danger: 0.15, size: 2, color: '#b13e53' },
  market: { name: '超市', w: 80, h: 46, res: { food: [4, 12], water: [4, 12], med: [0, 2], scrap: [2, 6] }, slots: ['in'], kinds: ['fridge', 'store', 'stove', 'fun'], partChance: 0.4, danger: 0.25, size: 3, color: '#3b5dc9' },
  pharmacy: { name: '药店', w: 50, h: 38, res: { med: [2, 6], water: [0, 3], food: [0, 2], scrap: [1, 5] }, slots: ['in', 'suit'], kinds: ['med'], partChance: 0.35, danger: 0.2, size: 2, color: '#38b764' },
  garage: { name: '汽修厂', w: 76, h: 44, res: { scrap: [8, 22], fuel: [2, 10], ammo: [0, 5] }, slots: ['engine', 'tires', 'armor', 'ram', 'chassis', 'util'], partChance: 0.8, danger: 0.2, size: 3, color: '#566c86' },
  police: { name: '警察局', w: 70, h: 50, res: { ammo: [8, 24], med: [0, 2], scrap: [2, 6] }, slots: ['weapon', 'hand', 'suit', 'armor'], partChance: 0.65, danger: 0.35, size: 3, color: '#29366f' },
  military: { name: '军事检查站', w: 84, h: 44, res: { ammo: [15, 40], fuel: [5, 15], med: [1, 4], scrap: [4, 12] }, slots: ['weapon', 'armor', 'hand', 'suit', 'tires', 'roof'], partChance: 0.9, danger: 0.5, size: 4, color: '#4c5a36', minKm: 120, tierBonus: 1 },
  house: { name: '民居', w: 48, h: 44, res: { food: [2, 6], water: [2, 6], med: [0, 2], scrap: [1, 5], ammo: [0, 4] }, slots: ['in', 'hand'], kinds: ['bed', 'fun', 'decor', 'life', 'store'], partChance: 0.55, danger: 0.15, size: 2, color: '#a8794f' },
  electro: { name: '家电城', w: 84, h: 48, res: { scrap: [4, 12], power: [5, 20], water: [0, 4] }, slots: ['in', 'roof'], kinds: ['fridge', 'pow', 'pc', 'fun', 'decor', 'stove'], partChance: 0.85, danger: 0.25, size: 3, color: '#257179' },
  furniture: { name: '家具卖场', w: 90, h: 50, res: { scrap: [3, 10], water: [0, 3], food: [0, 3] }, slots: ['in'], kinds: ['bed', 'fun', 'decor', 'life', 'store'], partChance: 0.9, danger: 0.2, size: 3, color: '#ef7d57' },
  factory: { name: '工厂', w: 96, h: 56, res: { scrap: [12, 30], fuel: [0, 8], ammo: [0, 5], water: [0, 4] }, slots: ['engine', 'armor', 'ram', 'chassis', 'tank', 'util', 'in'], kinds: ['bench', 'pow'], partChance: 0.7, danger: 0.35, size: 4, color: '#5d275d' },
  farm: { name: '农场', w: 76, h: 44, res: { food: [6, 16], water: [3, 8], fuel: [0, 6], scrap: [2, 6] }, slots: ['in', 'tires', 'trailer'], kinds: ['life', 'water', 'stove'], partChance: 0.45, danger: 0.2, size: 3, color: '#8f6a42' },
  rvpark: { name: '房车营地', w: 92, h: 40, res: { food: [2, 6], water: [2, 6], fuel: [2, 10], scrap: [3, 8] }, slots: ['trailer', 'in', 'roof'], kinds: ['bed', 'stove', 'water', 'life'], partChance: 0.8, danger: 0.25, size: 3, color: '#c9a86a' },
  junkyard: { name: '废车场', w: 96, h: 36, res: { scrap: [15, 35], fuel: [0, 8], ammo: [0, 4] }, slots: ['tires', 'engine', 'armor', 'ram', 'tank', 'chassis', 'util', 'trailer'], partChance: 0.9, danger: 0.3, size: 3, color: '#6e4a2e' },
  lab: { name: '研究所', w: 80, h: 56, res: { med: [2, 6], power: [10, 30], scrap: [3, 10] }, slots: ['in', 'suit'], kinds: ['pc', 'med', 'bench', 'pow'], partChance: 0.75, danger: 0.4, size: 4, color: '#94b0c2', minKm: 200, tierBonus: 1 },
  camp: { name: '幸存者营地', w: 90, h: 40, res: {}, slots: [], partChance: 0, danger: 0, size: 1, color: '#ffcd75', trade: true, minKm: 40 },
  alien: { name: '外星坠落舱', w: 70, h: 50, res: { alien: [3, 9], power: [10, 40], scrap: [4, 12] }, slots: ['weapon', 'armor', 'engine', 'chassis', 'space', 'in', 'hand', 'suit', 'roof', 'util', 'trailer'], partChance: 0.6, alienParts: 0.5, danger: 0.55, rad: 12, size: 4, color: '#73eff7', minKm: 900 },
};
const RD_SITE_ORDER = Object.keys(RD_SITES);

// ---------- 辐射怪物 ----------
// hp 生命 · dmg 每秒伤害 · spd 移动速度 · fly 飞行 · ranged 远程 · swarm 成群数量 · drop 掉落 · minKm 最早出现
const RD_MONSTERS = {
  roach: { name: '辐射蟑螂', hp: 8, dmg: 1, spd: 55, w: 8, h: 4, swarm: [3, 6], color: '#8f6a42', glow: '#a7f070', drop: { scrap: 0.3 } },
  dog: { name: '变异野狗', hp: 24, dmg: 2, spd: 105, w: 14, h: 9, swarm: [2, 4], color: '#6e4a2e', glow: '#ef7d57', drop: { food: 0.4 }, chase: true },
  ghoul: { name: '辐射食尸鬼', hp: 45, dmg: 3.5, spd: 38, w: 9, h: 16, swarm: [1, 4], color: '#7a8a5a', glow: '#a7f070', drop: { scrap: 0.4, ammo: 0.35 } },
  vulture: { name: '变异秃鹫', hp: 28, dmg: 2.5, spd: 90, w: 16, h: 8, swarm: [1, 3], fly: true, color: '#3e3040', glow: '#b13e53', drop: { food: 0.3 }, minKm: 60, chase: true },
  worm: { name: '酸液蠕虫', hp: 80, dmg: 5, spd: 22, w: 18, h: 12, swarm: [1, 2], ranged: 90, color: '#b0a050', glow: '#a7f070', drop: { med: 0.2, scrap: 0.4 }, minKm: 150 },
  spider: { name: '辐射蜘蛛', hp: 60, dmg: 4, spd: 75, w: 16, h: 9, swarm: [1, 3], color: '#2c2838', glow: '#73eff7', drop: { med: 0.2, ammo: 0.2 }, minKm: 250 },
  brute: { name: '发光巨人', hp: 280, dmg: 10, spd: 30, w: 22, h: 30, swarm: [1, 1], color: '#5a6a3a', glow: '#a7f070', drop: { scrap: 1, ammo: 0.6, med: 0.4 }, minKm: 380, big: true },
  wraith: { name: '冰原游魂', hp: 70, dmg: 4.5, spd: 70, w: 12, h: 18, swarm: [1, 3], fly: true, color: '#cfe3f0', glow: '#73eff7', drop: { power: 0.6 }, minKm: 1080, biome: 4 },
  crawler: { name: '外星爬行者', hp: 130, dmg: 6, spd: 85, w: 18, h: 10, swarm: [2, 4], color: '#4b3378', glow: '#c27bd6', drop: { alien: 0.35 }, minKm: 900, alienOnly: true },
  sentinel: { name: '外星守卫', hp: 420, dmg: 12, spd: 26, w: 18, h: 30, swarm: [1, 1], ranged: 160, color: '#24183f', glow: '#73eff7', drop: { alien: 1, power: 1 }, minKm: 1100, alienOnly: true, big: true },
  // ---- 副本专用（dunOnly：公路上不会出现） ----
  digworm: { name: '地底钻虫', hp: 90, dmg: 5, spd: 40, w: 18, h: 12, swarm: [1, 2], color: '#7a5a6a', glow: '#ff9a50', drop: { scrap: 0.6 }, dunOnly: true },
  cavebug: { name: '矿洞甲虫', hp: 20, dmg: 1.5, spd: 70, w: 10, h: 6, swarm: [3, 6], color: '#5a4a3a', glow: '#ffd060', drop: { scrap: 0.4 }, dunOnly: true, chase: true },
  ghost: { name: '游荡幽灵', hp: 40, dmg: 3, spd: 60, w: 12, h: 16, swarm: [2, 4], fly: true, color: '#c8d8e0', glow: '#a0ffd0', drop: { power: 0.3 }, dunOnly: true, ghostly: true, chase: true },
  banshee: { name: '哭嚎女妖', hp: 120, dmg: 6, spd: 45, w: 14, h: 22, swarm: [1, 1], fly: true, ranged: 110, color: '#d8c8f0', glow: '#e070ff', drop: { med: 0.5 }, dunOnly: true, ghostly: true },
  raider: { name: '军阀打手', hp: 50, dmg: 4, spd: 72, w: 9, h: 16, swarm: [2, 4], color: '#8a5a3a', glow: '#ef7d57', drop: { ammo: 0.5, scrap: 0.3 }, dunOnly: true, chase: true },
  gunner: { name: '军阀枪手', hp: 40, dmg: 3.5, spd: 45, w: 9, h: 16, swarm: [1, 3], ranged: 130, color: '#5a6040', glow: '#ffcd75', drop: { ammo: 0.8 }, dunOnly: true },
  gate: { name: '堡垒大门', hp: 600, dmg: 0, spd: 0, w: 22, h: 40, swarm: [1, 1], color: '#6a5a48', glow: '#ef7d57', drop: { scrap: 1 }, dunOnly: true, inert: true, block: true, score: 120, big: true },
  warlord: { name: '铁颅军阀', hp: 1800, dmg: 11, spd: 32, w: 26, h: 40, swarm: [1, 1], color: '#4a4a52', glow: '#e04a3a', drop: { ammo: 1, scrap: 1 }, dunOnly: true, big: true, boss: true, score: 400 },
  core: { name: '能量核心', hp: 450, dmg: 0, spd: 0, w: 18, h: 40, swarm: [1, 1], color: '#4b3378', glow: '#73eff7', drop: { alien: 1 }, dunOnly: true, inert: true, block: true, score: 150, big: true },
  adrone: { name: '外星无人机', hp: 50, dmg: 3, spd: 80, w: 12, h: 8, swarm: [2, 3], fly: true, color: '#7a6a98', glow: '#73eff7', drop: { power: 0.4 }, dunOnly: true, chase: true },
};

// ---------- 研究（需要车载电脑 + 外星晶体） ----------
// lv 需要的电脑研究等级 · cost 消耗 · hours 研究时长（主角坐在电脑前的游戏小时） · bp 学会的图纸
const RD_RESEARCH = [
  { id: 'solar', name: '光伏改良', lv: 1, cost: { scrap: 40 }, hours: 8, bp: ['roof9', 'roof3'], d: '学会制作太阳能板、大型光伏阵列' },
  { id: 'hydro', name: '无土栽培', lv: 1, cost: { scrap: 30, water: 10 }, hours: 8, bp: ['life6', 'life7'], d: '学会制作温室种植架、水培蔬菜柜' },
  { id: 'auto', name: '自动驾驶算法', lv: 2, cost: { scrap: 80, power: 20 }, hours: 16, bp: ['pc6'], d: '学会制作自动驾驶模块——开车时也能在车里休息' },
  { id: 'xmat', name: '外星材料分析', lv: 2, cost: { alien: 5 }, hours: 12, bp: ['armor11'], d: '学会制作外星生物甲壳' },
  { id: 'xbio', name: '基因工程', lv: 3, cost: { alien: 12 }, hours: 20, bp: ['stove8', 'med5', 'life8', 'wpn20'], d: '基因食物合成器、基因药剂工坊、克隆蔬菜舱、生物酸液喷射器' },
  { id: 'xgrav', name: '反重力原理', lv: 3, cost: { alien: 15 }, hours: 24, bp: ['chs5'], d: '学会制作反重力漂浮装置' },
  { id: 'xspace', name: '空间折叠理论', lv: 3, cost: { alien: 20 }, hours: 24, bp: ['spc1', 'trl6'], d: '空间折叠装置·I型、外星折叠空间舱' },
  { id: 'xforge', name: '外星物质重组', lv: 3, cost: { alien: 18 }, hours: 20, bp: ['bench5'], d: '学会制作外星物质重组器（制作外星部件必需）' },
  { id: 'xlaser', name: '定向能武器', lv: 3, cost: { alien: 15 }, hours: 20, bp: ['wpn16', 'hand12'], d: '外星激光阵列、外星离子手枪' },
  { id: 'xplasma', name: '等离子约束', lv: 4, cost: { alien: 25 }, hours: 30, bp: ['wpn17', 'armor12', 'hand11'], d: '等离子炮、外星相位护盾、外星光刃' },
  { id: 'xlife', name: '外星生态学', lv: 4, cost: { alien: 20 }, hours: 24, bp: ['bed10', 'bed11', 'fridge5', 'water5', 'decor12', 'suit9'], d: '悬浮睡眠舱、冬眠舱、静滞力场柜、分子水合成器、生态墙、共生服' },
  { id: 'xanti', name: '反物质', lv: 4, cost: { alien: 30 }, hours: 32, bp: ['eng11', 'tank6', 'pow5'], d: '外星反物质核心、能量储罐、聚变电池' },
  { id: 'xspace2', name: '高维空间', lv: 4, cost: { alien: 40 }, hours: 36, bp: ['spc2', 'store5'], d: '空间折叠装置·II型、压缩储物格' },
  { id: 'xholo', name: '全息技术', lv: 4, cost: { alien: 22 }, hours: 24, bp: ['fun19', 'pc5', 'util10'], d: '全息娱乐室、外星AI核心、隐形力场' },
  { id: 'xgrav2', name: '引力操控', lv: 5, cost: { alien: 45 }, hours: 40, bp: ['wpn18', 'chs6', 'ram10', 'roof12'], d: '重力奇点发射器、引力波悬浮、力场犁、感应天线' },
  { id: 'turret', name: '自动炮塔', lv: 2, cost: { scrap: 90, ammo: 30 }, hours: 18, bp: ['wpn23', 'wpn25'], d: '自动机枪塔、防空速射炮塔：装在车外，自己转着找怪打' },
  { id: 'turret2', name: '智能火控', lv: 3, cost: { scrap: 150, power: 40 }, hours: 28, bp: ['wpn24', 'wpn26', 'wpn27'], d: '双联自动炮塔、追踪导弹塔、激光点防御塔' },
  { id: 'xturret', name: '外星哨兵协议', lv: 4, cost: { alien: 30 }, hours: 30, bp: ['wpn28'], d: '外星哨兵炮塔：悬浮在车顶自动开火' },
  { id: 'xzero', name: '零点能', lv: 5, cost: { alien: 60 }, hours: 48, bp: ['eng12', 'spc3', 'wpn19', 'roof13', 'util11', 'med4'], d: '零点能引擎、空间折叠·III型、虚空光束、光子帆、纳米修复' },
];

// 制作/拆解的价格
function rdCraftCost(p) {
  const c = { scrap: Math.round(10 * Math.pow(p.tier, 1.8)) };
  if (p.alien) { c.scrap = 60; c.alien = 6 + Math.round((p.wt || 3) * 0.8 + (p.pw || 0) * 4); }
  return c;
}
function rdScrapValue(p) { return p.alien ? 25 : Math.round(5 * Math.pow(p.tier, 1.8)); }
