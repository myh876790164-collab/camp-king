// =============================================
//  本地存储 + 简单音效（用代码合成，不需要音频文件）
// =============================================
// 以后移植小游戏时，把这里换成 wx.getStorageSync / wx.setStorageSync 即可
const Store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ } },
};

const SETTINGS_DEFAULT = { sfx: true, floats: true, dark: 1 };
function loadSettings() {
  let s = {};
  try { s = JSON.parse(Store.get('campking_settings') || '{}') || {}; } catch (e) { s = {}; }
  return Object.assign({}, SETTINGS_DEFAULT, s);
}
function saveSettings() { Store.set('campking_settings', JSON.stringify(G.settings)); }

let audioCtx = null;
const sfxLast = {};
function unlockAudio() {
  if (audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  } catch (e) { audioCtx = null; }
}

// name: click / build / coin / hit / night / dawn / over / win / bad
function sfx(name) {
  if (!G.settings || !G.settings.sfx || !audioCtx) return;
  const now = audioCtx.currentTime;
  if (sfxLast[name] && now - sfxLast[name] < 0.06) return; // 防止同一帧响太多次
  sfxLast[name] = now;
  const notes = {
    click: [[660, 0.05]],
    build: [[392, 0.06], [523, 0.08]],
    coin: [[880, 0.04], [1175, 0.06]],
    hit: [[140, 0.05]],
    night: [[220, 0.2], [165, 0.3]],
    dawn: [[523, 0.1], [659, 0.1], [784, 0.15]],
    over: [[330, 0.2], [262, 0.2], [196, 0.4]],
    win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]],
    bad: [[180, 0.12]],
  }[name];
  if (!notes) return;
  let t = now;
  for (const [freq, dur] of notes) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = name === 'hit' || name === 'bad' ? 'square' : 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur);
    t += dur * 0.9;
  }
}
