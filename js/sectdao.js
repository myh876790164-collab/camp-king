// =============================================
//  修仙门派：道途体系
//  五行（金木水火土）各 5 道 = 2 天干 + 1 八卦 + 2 地支；阴阳 6 道 = 三阳（太阳 少阳 阳明）+ 三阴（太阴 少阴 厥阴）
//  每条道途：概念 → 道途特性（定道后生效，越精纯越强）+ 功法特性（修习功法即生效）+ 采气之法（时辰、地点）
//  七大职业：剑修 术修 符修 丹修 器修 御兽 鬼修；职业 × 道途 = 契合度 + 不同的神通
//  克制：五行相克、阴阳消长（夏阳盛、冬阴盛）、天干五合（相合不相克，人缘更好）
// =============================================
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
function dayIndex() { return Math.floor(G.sect.t) + 40; } // 偏移一下，让开局不是甲子日
function dayStem() { return STEMS[dayIndex() % 10]; }
function dayBranch() { return BRANCHES[dayIndex() % 12]; }
function monthBranch() { return BRANCHES[(sectCal().month + 1) % 12]; } // 正月建寅
function ganzhiText() { return dayStem() + dayBranch() + '日'; }

const EL = {
  jin: { name: '金', color: '#e8e4d8' }, mu: { name: '木', color: '#a7f070' }, shui: { name: '水', color: '#41a6f6' },
  huo: { name: '火', color: '#ef7d57' }, tu: { name: '土', color: '#c49a64' }, yang: { name: '阳', color: '#ffcd75' }, yin: { name: '阴', color: '#b8a8ff' },
};
const SHENG = { jin: 'shui', shui: 'mu', mu: 'huo', huo: 'tu', tu: 'jin' }; // 金生水 水生木 木生火 火生土 土生金
const KE = { jin: 'mu', mu: 'tu', tu: 'shui', shui: 'huo', huo: 'jin' };     // 金克木 木克土 土克水 水克火 火克金
const HE = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' }; // 天干五合

// ---------- 采气时机 ----------
const SEASON_EL = ['mu', 'huo', 'jin', 'shui'];
const stemRate = (st, el) => () => 0.7 * (dayStem() === st ? 4 : 1) * (SEASON_EL[sectSeason()] === el ? 1.5 : 1) * (el === 'tu' && [3, 6, 9, 12].includes(sectCal().month) ? 1.5 : 1);
const branchRate = (br) => () => (monthBranch() === br ? 3 : 0.6) * (dayBranch() === br ? 2 : 1);
const sunny = () => G.sect.weather === 'clear';
const rainy = () => G.sect.weather === 'rain' || G.sect.weather === 'storm';

// fx 里的数都是“加成”：power 0.25 = 战力 +25%；brk 0.05 = 突破率 +5%
const DAOS = {
  // ===== 金 =====
  geng: { name: '庚金', el: 'jin', src: '天干', pol: 'yang', rare: 1, concept: '阳金，刀剑斧钺之金。肃杀刚猛，主兵戈、决断。',
    path: { text: '战力 +25%', fx: { power: 0.25 } }, gf: { name: '《庚金斩罡诀》', text: '演武收益 +30%', fx: { train: 0.3 } },
    img: ['庚金', '斩罡'], loc: 'lianqi', how: '于炼器峰锻炉旁吐纳金铁锐气。庚日 ×4，秋季 ×1.5。', rate: stemRate('庚', 'jin') },
  xin: { name: '辛金', el: 'jin', src: '天干', pol: 'yin', rare: 1, concept: '阴金，珠玉首饰之金。温润精巧，锋芒内敛。',
    path: { text: '炼器威力 +25%，法器效果 +15%', fx: { forge: 0.25, weapon: 0.15 } }, gf: { name: '《辛金玉衡篇》', text: '突破成功率 +5%', fx: { brk: 0.05 } },
    img: ['玉衡', '碎玉'], loc: 'lianqi', how: '于炼器峰打磨灵玉时采其精气。辛日 ×4，秋季 ×1.5。', rate: stemRate('辛', 'jin') },
  qian: { name: '乾金', el: 'jin', src: '八卦', pol: 'yang', rare: 3, concept: '乾为天。天行健，君子以自强不息，至刚至健之金。',
    path: { text: '突破成功率 +6%，战力 +10%', fx: { brk: 0.06, power: 0.1 } }, gf: { name: '《乾元天罡经》', text: '修炼速度 +20%', fx: { speed: 0.2 } },
    img: ['乾元', '天罡'], loc: 'zongzhu', how: '晴朗之日登宗主峰顶，仰采天罡正气。晴天 ×2，阴雨雪天采不到。', rate: () => (sunny() ? 2 : 0) },
  shen: { name: '申金', el: 'jin', src: '地支', pol: 'yang', rare: 2, concept: '申为猴，七月建申。金气初成，主变通、道路、远行。',
    path: { text: '历练收获 +40%，历练更安全', fx: { loot: 0.4, safe: 0.3 } }, gf: { name: '《申猴通变诀》', text: '采气速度 +25%', fx: { gather: 0.25 } },
    img: ['通变', '白猿'], loc: 'yanwu', how: '于演武场腾挪纵跃，采金风流转之气。七月（申月）×3，申日 ×2。', rate: branchRate('申') },
  you: { name: '酉金', el: 'jin', src: '地支', pol: 'yin', rare: 2, concept: '酉为鸡，八月建酉。秋分纯金，主收敛、肃降。',
    path: { text: '受伤时间减半', fx: { heal: 1 } }, gf: { name: '《酉金肃杀篇》', text: '战力 +15%', fx: { power: 0.15 } },
    img: ['鸣金', '肃杀'], loc: 'lianqi', how: '于炼器峰听金石之声，采肃降之气。八月（酉月）×3，酉日 ×2。', rate: branchRate('酉') },
  // ===== 木 =====
  jia: { name: '甲木', el: 'mu', src: '天干', pol: 'yang', rare: 1, concept: '阳木，参天大树，栋梁之材。主仁，生发向上。',
    path: { text: '寿元 +20%，修炼速度 +10%', fx: { life: 0.2, speed: 0.1 } }, gf: { name: '《甲木参天诀》', text: '炼化真气 +20%', fx: { refine: 0.2 } },
    img: ['参天', '青帝'], loc: 'forest', how: '入灵松林，抱古松而采其生发之气。甲日 ×4，春季 ×1.5。', rate: stemRate('甲', 'mu') },
  yi: { name: '乙木', el: 'mu', src: '天干', pol: 'yin', rare: 1, concept: '阴木，花草藤萝。柔韧缠绕，主滋养、灵动。',
    path: { text: '服用丹药效果 +25%', fx: { pill: 0.25 } }, gf: { name: '《乙木回春诀》', text: '受伤恢复速度 ×2', fx: { heal: 1 } },
    img: ['回春', '缠藤'], loc: 'forest', how: '于灵松林花草间采草木灵息。乙日 ×4，春季 ×1.5。', rate: stemRate('乙', 'mu') },
  zhen: { name: '震木', el: 'mu', src: '八卦', pol: 'yang', rare: 3, concept: '震为雷。春雷惊蛰，万物萌动，主震动、奋发。',
    path: { text: '术法威力 +30%', fx: { spell: 0.3 } }, gf: { name: '《震雷惊蛰经》', text: '突破失败时损失减半', fx: { failSafe: 0.5 } },
    img: ['惊蛰', '奔雷'], loc: 'yanwu', how: '雷雨之时立于演武场，引天雷入体（有可能被雷击伤）。雷雨天 ×4，二月惊蛰前后 ×1.5，其余时候几乎采不到。',
    rate: () => (G.sect.weather === 'storm' ? 4 : 0.15) * (sectCal().month === 2 ? 1.5 : 1) },
  yin3: { name: '寅木', el: 'mu', src: '地支', pol: 'yang', rare: 2, concept: '寅为虎，正月建寅。春之始，主勇猛、开拓。',
    path: { text: '战力 +20%，灵兽战力 +30%', fx: { power: 0.2, beast: 0.3 } }, gf: { name: '《寅虎啸林功》', text: '遭遇战胜率提升（战力 +15%）', fx: { power: 0.15 } },
    img: ['啸林', '山君'], loc: 'forest', how: '于灵松林中长啸吐纳，采山林虎气。正月（寅月）×3，寅日 ×2。', rate: branchRate('寅') },
  mao: { name: '卯木', el: 'mu', src: '地支', pol: 'yin', rare: 2, concept: '卯为兔，二月建卯。春分繁盛，主柔美、桃花、人缘。',
    path: { text: '机缘事件 +50%', fx: { fortune: 0.5 } }, gf: { name: '《卯木桃夭诀》', text: '人际更容易交好', fx: { charm: 0.3 } },
    img: ['桃夭', '青藤'], loc: 'forest', how: '于灵松林桃花之下采春木柔气。二月（卯月）×3，卯日 ×2。', rate: branchRate('卯') },
  // ===== 水 =====
  ren: { name: '壬水', el: 'shui', src: '天干', pol: 'yang', rare: 1, concept: '阳水，江河大海，奔流不息。主智，包容万物。',
    path: { text: '灵力 +40%，术法 +15%', fx: { mana: 0.4, spell: 0.15 } }, gf: { name: '《壬水沧溟经》', text: '修炼速度 +15%', fx: { speed: 0.15 } },
    img: ['沧溟', '怒涛'], loc: 'spring', how: '于灵泉之畔观水势奔流，采江河之气。壬日 ×4，冬季 ×1.5。', rate: stemRate('壬', 'shui') },
  gui: { name: '癸水', el: 'shui', src: '天干', pol: 'yin', rare: 1, concept: '阴水，雨露云雾，润物无声。主智，渗透。',
    path: { text: '悟性积累 +30%', fx: { wu: 0.3 } }, gf: { name: '《癸水润物诀》', text: '炼化真气 +25%', fx: { refine: 0.25 } },
    img: ['玄冥', '雨露'], loc: 'spring', how: '于灵泉之畔引雨露至柔之气。癸日 ×4，冬季 ×1.5，雨天再 ×2。', rate: () => stemRate('癸', 'shui')() * (rainy() ? 2 : 1) },
  kan: { name: '坎水', el: 'shui', src: '八卦', pol: 'yang', rare: 3, concept: '坎为水，为险。外柔内刚，主险中求生。',
    path: { text: '对战强敌时战力 +30%', fx: { underdog: 0.3 } }, gf: { name: '《坎水渡厄篇》', text: '历练遇险时更安全', fx: { safe: 0.4 } },
    img: ['渡厄', '重渊'], loc: 'spring', how: '雨中立于灵泉深处，采重险之水气。雨天 ×3，冬季 ×1.5，晴天很慢。', rate: () => (rainy() ? 3 : 0.4) * (sectSeason() === 3 ? 1.5 : 1) },
  hai: { name: '亥水', el: 'shui', src: '地支', pol: 'yin', rare: 2, concept: '亥为猪，十月建亥。水之源头，主蓄藏、孕育。',
    path: { text: '孕育元婴 +25%，寿元 +10%', fx: { ying: 0.25, life: 0.1 } }, gf: { name: '《亥水藏渊诀》', text: '灵力 +30%', fx: { mana: 0.3 } },
    img: ['藏渊', '归墟'], loc: 'spring', how: '于灵泉源头静守，采蓄藏之水气。十月（亥月）×3，亥日 ×2。', rate: branchRate('亥') },
  zi: { name: '子水', el: 'shui', src: '地支', pol: 'yang', rare: 2, concept: '子为鼠，冬月建子。夜半至阴而一阳来复，主机变、潜藏。',
    path: { text: '修炼速度 +20%', fx: { speed: 0.2 } }, gf: { name: '《子夜潜龙诀》', text: '采气速度 +30%', fx: { gather: 0.3 } },
    img: ['子夜', '潜龙'], loc: 'dianji', how: '夜半于典籍峰静坐，候一阳来复。冬月（子月）×3，子日 ×2。', rate: branchRate('子') },
  // ===== 火 =====
  bing: { name: '丙火', el: 'huo', src: '天干', pol: 'yang', rare: 1, concept: '阳火，太阳之火。普照万物，刚烈光明。',
    path: { text: '术法威力 +35%', fx: { spell: 0.35 } }, gf: { name: '《大日焚天经》', text: '战力 +10%，对阴属道途克制更强', fx: { power: 0.1, antiYin: 0.15 } },
    img: ['大日', '焚天'], loc: 'liandan', how: '守在炼丹峰丹炉旁，引炉中阳火入体。丙日 ×4，夏季 ×1.5，晴天再 ×1.3。', rate: () => stemRate('丙', 'huo')() * (sunny() ? 1.3 : 1) },
  ding: { name: '丁火', el: 'huo', src: '天干', pol: 'yin', rare: 1, concept: '阴火，灯烛之火。微弱而不灭，主文明、心灯。',
    path: { text: '悟性积累 +35%', fx: { wu: 0.35 } }, gf: { name: '《丁火心灯诀》', text: '炼丹成丹率 +15%', fx: { alchOk: 0.15 } },
    img: ['心灯', '烛照'], loc: 'liandan', how: '于炼丹峰守一盏心灯，采文火之气。丁日 ×4，夏季 ×1.5。', rate: stemRate('丁', 'huo') },
  li: { name: '离火', el: 'huo', src: '八卦', pol: 'yin', rare: 3, concept: '离为火，为日，为明。附丽而中虚，主明察、光明。',
    path: { text: '突破成功率 +5%，修炼速度 +10%', fx: { brk: 0.05, speed: 0.1 } }, gf: { name: '《离火明照经》', text: '炼丹速度 +30%', fx: { alch: 0.3 } },
    img: ['离明', '朱雀'], loc: 'liandan', how: '烈日当空时于炼丹峰采离明之火。晴天 ×1.2，夏日晴天 ×2.5，阴雨天采不到。', rate: () => (sunny() ? (sectSeason() === 1 ? 2.5 : 1.2) : 0) },
  si: { name: '巳火', el: 'huo', src: '地支', pol: 'yin', rare: 2, concept: '巳为蛇，四月建巳。火之初生，主蜕变、阴柔之火。',
    path: { text: '法器效果 +20%，战力 +10%', fx: { weapon: 0.2, power: 0.1 } }, gf: { name: '《巳蛇蜕变诀》', text: '突破失败时损失减半', fx: { failSafe: 0.5 } },
    img: ['腾蛇', '蜕变'], loc: 'liandan', how: '于炼丹峰地火之侧采初生火气。四月（巳月）×3，巳日 ×2。', rate: branchRate('巳') },
  wu2: { name: '午火', el: 'huo', src: '地支', pol: 'yang', rare: 2, concept: '午为马，五月建午。火之极盛而一阴始生，主奔放、极致。',
    path: { text: '战力 +30%，但寿元 -10%', fx: { power: 0.3, life: -0.1 } }, gf: { name: '《午马烈阳诀》', text: '修炼速度 +20%', fx: { speed: 0.2 } },
    img: ['烈阳', '天马'], loc: 'yanwu', how: '正午于演武场纵马狂奔，采极盛阳火。五月（午月）×3，午日 ×2，晴天再 ×1.3。', rate: () => branchRate('午')() * (sunny() ? 1.3 : 1) },
  // ===== 土 =====
  wu: { name: '戊土', el: 'tu', src: '天干', pol: 'yang', rare: 1, concept: '阳土，城墙高山。厚重稳固，主信、守护。',
    path: { text: '宗门防御 +20%，受伤时间减半', fx: { def: 0.2, heal: 1 } }, gf: { name: '《戊土镇岳功》', text: '突破成功率 +8%', fx: { brk: 0.08 } },
    img: ['镇岳', '山岳'], loc: 'zhufeng', how: '于主峰灵脉之上静坐，引高山厚重之气。戊日 ×4，季月（三、六、九、腊月）×1.5。', rate: stemRate('戊', 'tu') },
  ji: { name: '己土', el: 'tu', src: '天干', pol: 'yin', rare: 1, concept: '阴土，田园沃土。生养万物，主包容、蓄藏。',
    path: { text: '宗门杂务产出 +50%', fx: { labor: 0.5 } }, gf: { name: '《己土厚德诀》', text: '服用丹药效果 +20%', fx: { pill: 0.2 } },
    img: ['厚德', '息壤'], loc: 'zhufeng', how: '于主峰灵田间采沃土生养之气。己日 ×4，季月 ×1.5。', rate: stemRate('己', 'tu') },
  kun: { name: '坤土', el: 'tu', src: '八卦', pol: 'yin', rare: 3, concept: '坤为地。地势坤，君子以厚德载物，至柔而动也刚。',
    path: { text: '寿元 +25%，突破成功率 +4%', fx: { life: 0.25, brk: 0.04 } }, gf: { name: '《坤元载物经》', text: '炼化真气 +20%，孕育元婴 +10%', fx: { refine: 0.2, ying: 0.1 } },
    img: ['坤元', '载物'], loc: 'zhufeng', how: '伏于主峰大地之上，采坤元地气。四季皆可，季月 ×2。', rate: () => ([3, 6, 9, 12].includes(sectCal().month) ? 2 : 0.8) },
  chen: { name: '辰土', el: 'tu', src: '地支', pol: 'yang', rare: 2, concept: '辰为龙，三月建辰。水库湿土，主变化、蛰伏。',
    path: { text: '灵力 +25%，术法 +15%', fx: { mana: 0.25, spell: 0.15 } }, gf: { name: '《辰龙蛰云诀》', text: '孕育元婴 +20%', fx: { ying: 0.2 } },
    img: ['苍龙', '蛰云'], loc: 'zhufeng', how: '雨中于主峰采云中龙气。三月（辰月）×3，辰日 ×2，雨天再 ×1.3。', rate: () => branchRate('辰')() * (rainy() ? 1.3 : 1) },
  xu: { name: '戌土', el: 'tu', src: '地支', pol: 'yang', rare: 2, concept: '戌为犬，九月建戌。火库燥土，主忠诚、守护。',
    path: { text: '忠诚不会低于 50，宗门防御 +15%', fx: { loyal: 50, def: 0.15 } }, gf: { name: '《戌土守山诀》', text: '战力 +15%', fx: { power: 0.15 } },
    img: ['守山', '天狗'], loc: 'zhufeng', how: '于主峰山门要道守夜，采燥土守护之气。九月（戌月）×3，戌日 ×2。', rate: branchRate('戌') },
  // ===== 阳 =====
  taiyang: { name: '太阳', el: 'yang', src: '三阳', pol: 'yang', rare: 3, qiEl: 'shui', concept: '太阳主开，巨阳统摄诸阳，护卫一身之表。六气属寒水。',
    path: { text: '受伤时间减半，宗门防御 +15%', fx: { heal: 1, def: 0.15 } }, gf: { name: '《太阳巨阳经》', text: '战力 +20%', fx: { power: 0.2 } },
    img: ['巨阳', '烈日'], loc: 'zongzhu', how: '晴日正午于宗主峰顶迎日吐纳。晴天 ×1.5，五月晴天 ×3，阴雨天几乎采不到。', rate: () => (sunny() ? (sectCal().month === 5 ? 3 : 1.5) : 0.2) },
  shaoyang: { name: '少阳', el: 'yang', src: '三阳', pol: 'yang', rare: 3, qiEl: 'huo', concept: '少阳为枢，一阳初生，枢转阴阳。六气属相火。',
    path: { text: '修炼速度 +20%，突破成功率 +3%', fx: { speed: 0.2, brk: 0.03 } }, gf: { name: '《少阳枢机诀》', text: '采气速度 +30%', fx: { gather: 0.3 } },
    img: ['枢机', '初阳'], loc: 'zongzhu', how: '每月初一至初三新阳初生时于宗主峰采气（×3），春季 ×1.5。', rate: () => (sectCal().day <= 3 ? 3 : 0.4) * (sectSeason() === 0 ? 1.5 : 1) },
  yangming: { name: '阳明', el: 'yang', src: '三阳', pol: 'yang', rare: 3, qiEl: 'jin', concept: '阳明主阖，两阳合明，阳气极盛而收敛。六气属燥金。',
    path: { text: '战力 +30%', fx: { power: 0.3 } }, gf: { name: '《阳明合照经》', text: '术法威力 +20%', fx: { spell: 0.2 } },
    img: ['合明', '燥金'], loc: 'yanwu', how: '秋日晴天于演武场采两阳合明之气。秋季 ×2，晴天再 ×1.3。', rate: () => (sectSeason() === 2 ? 2 : 0.6) * (sunny() ? 1.3 : 1) },
  // ===== 阴 =====
  taiyin: { name: '太阴', el: 'yin', src: '三阴', pol: 'yin', rare: 3, qiEl: 'tu', concept: '太阴主开，三阴之始，月之精华。六气属湿土。',
    path: { text: '修炼速度 +25%', fx: { speed: 0.25 } }, gf: { name: '《太阴炼形篇》', text: '寿元 +20%', fx: { life: 0.2 } },
    img: ['太阴', '月华'], loc: 'zongzhu', how: '每月十四至十六满月之时，于宗主峰之巅吞吐月华（×4），其余日子几乎采不到。', rate: () => (fullMoon() ? 4 : 0.15) },
  shaoyin: { name: '少阴', el: 'yin', src: '三阴', pol: 'yin', rare: 3, qiEl: 'huo', concept: '少阴为枢，心肾相交，水火既济。六气属君火。',
    path: { text: '突破成功率 +8%', fx: { brk: 0.08 } }, gf: { name: '《少阴既济经》', text: '悟性积累 +25%', fx: { wu: 0.25 } },
    img: ['既济', '心火'], loc: 'dianji', how: '于典籍峰静室调和心肾水火。冬季 ×2，子日 ×2。', rate: () => (sectSeason() === 3 ? 2 : 0.6) * (dayBranch() === '子' ? 2 : 1) },
  jueyin: { name: '厥阴', el: 'yin', src: '三阴', pol: 'yin', rare: 3, qiEl: 'mu', concept: '厥阴主阖，两阴交尽，阴尽而阳生。六气属风木。',
    path: { text: '突破失败后，下次突破成功率 +15%', fx: { comeback: 0.15 } }, gf: { name: '《厥阴风木经》', text: '参悟时神识精进几率 ×3', fx: { mindGrow: 2 } },
    img: ['阴尽', '幽风'], loc: 'dianji', how: '每月末（廿八至三十）阴尽之时于典籍峰采气（×3），腊月 ×2。', rate: () => (sectCal().day >= 28 ? 3 : 0.3) * (sectCal().month === 12 ? 2 : 1) },
};
const DAO_IDS = Object.keys(DAOS);
for (const id of DAO_IDS) { DAOS[id].id = id; DAOS[id].qiName = DAOS[id].name + '之气'; DAOS[id].color = EL[DAOS[id].el].color; }
const DAO_STARTER = DAO_IDS.filter((k) => DAOS[k].rare === 1);
// 五行属性（阴阳道途按六气算五行，用于五行生克）
function daoWx(id) { const d = DAOS[id]; return d ? (d.qiEl || d.el) : null; }
// “同属性”：五行道途看五行，阴阳道途看阴/阳
function daoGroup(id) { return DAOS[id] ? DAOS[id].el : null; }
function daoLabel(id) { const d = DAOS[id]; return d ? d.name + '（' + EL[d.el].name + '·' + d.src + '）' : '无'; }

// ---------- 七大职业 ----------
const PROFS = {
  jian: { name: '剑修', desc: '以剑入道，攻伐第一。战力 +35%，演武收益 +30%', fx: { power: 0.35, train: 0.3 } },
  shu: { name: '术修', desc: '精研术法，呼风唤雨。术法 +50%，灵力 +30%，悟性 +15%', fx: { spell: 0.5, mana: 0.3, wu: 0.15 } },
  fu: { name: '符修', desc: '以符载道。制符速度 ×2，符箓效果 +50%', fx: { fu: 0.5, fuSpeed: 1 } },
  dan: { name: '丹修', desc: '以丹证道。炼丹速度 +50%、成丹率 +15%，自己服丹效果 +20%', fx: { alch: 0.5, alchOk: 0.15, pill: 0.2 } },
  qi: { name: '器修', desc: '身外化身在于器。炼器威力 +40%，法器效果 +25%', fx: { forge: 0.4, weapon: 0.25 } },
  shou: { name: '御兽', desc: '与灵兽缔结契约并肩作战。获得一只随境界成长的灵兽，灵兽战力 +30%', fx: { beast: 0.3 } },
  gui: { name: '鬼修', desc: '修阴魂鬼道。战力 +20%，战斗经验 ×1.5，寿元 -15%；陨落时一半几率残魂不灭', fx: { power: 0.2, train: 0.5, life: -0.15 } },
};
const PROF_IDS = Object.keys(PROFS);
// ---------- 性格词条（每人两个，互斥的不会同时出现） ----------
const SECT_TRAITS = {
  qinfen: { name: '勤奋', desc: '修炼速度 +10%', fx: { speed: 0.1 }, no: 'lansan' },
  lansan: { name: '懒散', desc: '修炼速度 -10%，但心宽体胖，寿元 +5%', fx: { speed: -0.1, life: 0.05 }, no: 'qinfen' },
  haozhan: { name: '好战', desc: '战力 +10%，演武收益 +20%', fx: { power: 0.1, train: 0.2 }, no: 'jinshen' },
  jinshen: { name: '谨慎', desc: '历练更安全（+25%）', fx: { safe: 0.25 }, no: 'haozhan' },
  haoshuang: { name: '豪爽', desc: '人缘更好', fx: { charm: 0.2 }, no: 'gupi' },
  gupi: { name: '孤僻', desc: '人缘较差，但悟性 +15%', fx: { charm: -0.2, wu: 0.15 }, no: 'haoshuang' },
  tancai: { name: '贪财', desc: '历练收获 +30%', fx: { loot: 0.3 } },
  fuyuan: { name: '福缘深厚', desc: '机缘事件 +40%', fx: { fortune: 0.4 } },
  wuxing: { name: '悟性超群', desc: '悟性积累 +25%，参悟时神识更易精进', fx: { wu: 0.25, mindGrow: 0.5 } },
  daoxin: { name: '道心坚定', desc: '突破成功率 +4%', fx: { brk: 0.04 }, no: 'jiaozao' },
  jiaozao: { name: '急躁', desc: '战力 +5%，突破成功率 -3%', fx: { power: 0.05, brk: -0.03 }, no: 'daoxin' },
  hushort: { name: '护短', desc: '宗门防御 +15%', fx: { def: 0.15 } },
  yaoli: { name: '药理通达', desc: '炼丹速度 +20%，服丹效果 +10%', fx: { alch: 0.2, pill: 0.1 } },
  qiaoshou: { name: '心灵手巧', desc: '炼器威力 +20%，符箓效果 +20%', fx: { forge: 0.2, fu: 0.2 } },
};
const SECT_TRAIT_IDS = Object.keys(SECT_TRAITS);
function rollSectTraits() {
  const a = pick(SECT_TRAIT_IDS);
  let b = pick(SECT_TRAIT_IDS);
  for (let k = 0; k < 20 && (b === a || SECT_TRAITS[a].no === b); k++) b = pick(SECT_TRAIT_IDS);
  return [a, b];
}
function sectTraitText(p) { return (p.traits || []).map((t) => SECT_TRAITS[t].name).join('、'); }
// 职业 × 道途契合度：-1 相悖 / 0 一般 / 1 良好 / 2 极佳
const SYN = {
  jian: { jin: 2, huo: 1, mu: 1, shui: 0, tu: 0, yang: 1, yin: 0 },
  shu: { huo: 2, shui: 1, mu: 1, jin: 0, tu: 0, yang: 1, yin: 1 },
  fu: { tu: 2, mu: 1, shui: 1, jin: 0, huo: 0, yang: 1, yin: 1 },
  dan: { huo: 2, mu: 2, shui: 1, tu: 0, jin: 0, yang: 0, yin: 0 },
  qi: { jin: 2, huo: 2, tu: 1, mu: 0, shui: 0, yang: 0, yin: 0 },
  shou: { mu: 2, tu: 1, shui: 1, huo: 0, jin: 0, yang: 1, yin: 0 },
  gui: { yin: 2, shui: 1, jin: 0, mu: 0, tu: 0, huo: -1, yang: -1 },
};
const SYN_SPECIAL = { jian: { qian: 2, geng: 2 }, shu: { zhen: 2, li: 2 }, fu: { kun: 2, gui: 2 }, dan: { li: 2, ding: 2, yi: 2 }, qi: { xin: 2, geng: 2 }, shou: { yin3: 2, chen: 2 }, gui: { kan: 2, zi: 2 } };
const SYN_NAME = { '-1': '相悖', 0: '一般', 1: '良好', 2: '极佳' };
function synergy(p) {
  if (!p.prof) return 0;
  const id = p.dao || p.manual;
  if (!id) return 0;
  const sp = SYN_SPECIAL[p.prof] && SYN_SPECIAL[p.prof][id];
  return sp !== undefined ? sp : SYN[p.prof][daoGroup(id)] || 0;
}
// 神通：道途意象 + 职业形态
const ST_FORMS = {
  jian: ['{a}剑诀', '{b}剑域', '{a}{b}剑'], shu: ['{a}法相', '{b}神术', '{a}真法'], fu: ['{a}真符', '{b}符阵', '{a}敕令'],
  dan: ['{a}丹火', '{b}药王身', '{a}炉鼎'], qi: ['{a}神兵', '{b}法宝', '{a}天工'], shou: ['{a}兽魂', '{b}灵契', '{a}化形'],
  gui: ['{a}鬼域', '{b}阴魂', '{a}幽冥身'], none: ['{a}{b}', '{a}神通'],
};
const ST_EFFECT = {
  jian: '战力再 ×1.5', shu: '术法再 ×1.6', fu: '符箓效果再 ×2', dan: '服丹效果 ×1.5，炼丹成丹率 +10%', qi: '法器效果 ×1.5',
  shou: '灵兽战力 ×1.6', gui: '战力 ×1.3，陨落时必定残魂不灭', none: '战力 ×1.3',
};
function makeShentong(p) {
  const d = DAOS[p.dao] || DAOS.wu, forms = ST_FORMS[p.prof || 'none'];
  return pick(forms).replace('{a}', d.img[0]).replace('{b}', d.img[1]);
}
// 灵兽
const BEASTS = {
  jin: ['白虎幼崽', '金翅雕'], mu: ['青鸾雏鸟', '翠玉灵鹿'], shui: ['玄龟', '碧水蛟'], huo: ['赤焰狐', '火鸦'],
  tu: ['岩甲穿山兽', '镇山石猿'], yang: ['金乌雏', '日曜麒麟'], yin: ['幽冥猫', '月影蝶'],
};
function beastPower(p) {
  if (!p.beast) return 0;
  const match = p.beast.el === daoGroup(p.dao) ? 1.3 : 1;
  return Math.round(20 * REALM_MUL[p.realm] * (1 + p.beast.lv * 0.2) * match * (1 + sumFx(p, 'beast')) * (p.sht && p.prof === 'shou' ? 1.6 : 1));
}

// ---------- 修士身上的全部加成 ----------
function sumFx(p, key) {
  let v = 0;
  const d = DAOS[p.dao], m = DAOS[p.manual];
  if (d) v += (d.path.fx[key] || 0) * (0.5 + 0.5 * daoPurity(p)); // 道途特性：越精纯越强
  if (m) v += m.gf.fx[key] || 0;                                   // 功法特性
  if (p.prof) v += PROFS[p.prof].fx[key] || 0;                     // 职业
  if (p.apt && p.apt === p.prof && (key === 'power' || key === 'spell')) v += 0.1; // 天赋
  if (typeof skillFx === 'function') v += skillFx(p, key);           // 道途辅助技能
  for (const t of p.traits || []) v += SECT_TRAITS[t].fx[key] || 0;       // 性格
  return v;
}
// 精纯度：服下的真气、用过的物品里，和本命道途相同（1）/同属性（0.5）/其他（0）的比例
function daoPurity(p) {
  if (!p.dao || !p.mix) return 1;
  let tot = 0, good = 0;
  for (const k in p.mix) { const n = p.mix[k]; tot += n; good += n * (k === p.dao ? 1 : daoGroup(k) === daoGroup(p.dao) ? 0.5 : 0); }
  return tot ? good / tot : 1;
}
function touchDao(p, id, amount) { if (!id) return; p.mix = p.mix || {}; p.mix[id] = (p.mix[id] || 0) + amount; }

// ---------- 物品与修士的契合（同道途 100%，同属性 85%，……） ----------
function itemFactor(p, dao) {
  const mine = p.dao || p.manual;
  if (!dao || !mine) return 0.6;
  if (dao === mine) return 1;
  if (daoGroup(dao) === daoGroup(mine)) return 0.85;
  const a = daoWx(dao), b = daoWx(mine);
  if (a === b) return 0.7;          // 六气相同（例如太阳与壬水同为水）
  if (SHENG[a] === b) return 0.6;   // 物品之气生我
  if (KE[a] === b) return 0.3;      // 物品之气克我
  return 0.5;
}
function factorText(f, dao, p) { if (!dao) return '无属性 60%'; if (p && !p.dao && !p.manual) return '未定道 60%'; return f >= 1 ? '同道 100%' : f >= 0.85 ? '同属 85%' : f >= 0.7 ? '同气 70%' : f >= 0.6 ? '相生 60%' : f >= 0.5 ? '无关 50%' : '相克 30%'; }

// ---------- 克制 ----------
// 返回 a 对 b 的战力倍率和说明
function daoClash(a, b) {
  if (!a || !b) return { k: 1, text: '' };
  const A = DAOS[a], B = DAOS[b];
  let k = 1, text = [];
  const sa = A.name[0], sb = B.name[0];
  if (HE[sa] === sb) return { k: 1, text: sa + sb + '相合，不相克制' };
  const wa = daoWx(a), wb = daoWx(b);
  if (KE[wa] === wb) { k *= 1.3; text.push(EL[wa].name + '克' + EL[wb].name + '，战力 +30%'); }
  else if (KE[wb] === wa) { k /= 1.3; text.push('被' + EL[wb].name + '所克，战力 -23%'); }
  const s = sectSeason();
  if (A.pol !== B.pol) {
    if ((s === 1 && A.pol === 'yang') || (s === 3 && A.pol === 'yin')) { k *= 1.15; text.push((s === 1 ? '夏日阳盛' : '冬日阴盛') + '，战力 +15%'); }
    else if ((s === 1 && B.pol === 'yang') || (s === 3 && B.pol === 'yin')) { k /= 1.15; text.push((s === 1 ? '夏日阳盛' : '冬日阴盛') + '，战力 -13%'); }
  }
  return { k, text: text.join('；') };
}
// 天下敌人也有道途属性
const FOE_DAO = {
  '山中妖狼': 'yin3', '游荡散修': null, '邪修': 'jueyin', '夺宝贼人': 'shen', '黑熊精': 'wu',
  '劫修': 'geng', '恶霸修士': 'wu2', '海妖': 'gui', '蛟龙幼崽': 'ren', '毒蛟': 'kan', '瘴林妖王': 'yi',
  '沙虫': 'xu', '古尸': 'taiyin', '冰原狼王': 'you', '雪妖': 'hai', '遗府傀儡': 'kun', '守府灵兽': 'yin3',
};
