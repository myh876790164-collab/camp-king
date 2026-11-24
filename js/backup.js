// =============================================
//  存档备份：把所有存档导出成一个文件 / 从文件导入
//  用途：换手机、换电脑、清理浏览器之前先备份，防止存档丢失
// =============================================
const BACKUP_PREFIX = 'campking_';

function backupCollect() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(BACKUP_PREFIX) === 0) data[k] = localStorage.getItem(k);
    }
  } catch (e) { /* 存储不可用 */ }
  return data;
}

function backupExport() {
  const data = backupCollect();
  const n = Object.keys(data).filter((k) => k.indexOf('campking_save_') === 0).length;
  if (!n) { showBanner('没有可导出的存档', '先玩一局并保存（白天会自动存档）', 3, '#ef7d57'); return; }
  const d = new Date(), pad = (x) => String(x).padStart(2, '0');
  const name = '营地之王存档_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
  const text = JSON.stringify({ app: 'campking', v: 1, time: Date.now(), data });
  const blob = new Blob([text], { type: 'application/json' });
  // 手机（尤其 iPhone 主屏幕版）优先用系统分享：可以“存储到文件”、发微信、AirDrop
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      navigator.share({ files: [file], title: '营地之王存档' }).catch(() => {});
      return;
    }
  } catch (e) { /* 不支持就走下载 */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showBanner('存档已导出', '文件名：' + name + '（在“下载”文件夹里）', 4, '#38b764');
}

function backupImport() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json,text/plain';
  input.style.display = 'none';
  input.onchange = () => {
    const f = input.files && input.files[0];
    input.remove();
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let obj = null;
      try { obj = JSON.parse(rd.result); } catch (e) { obj = null; }
      if (!obj || obj.app !== 'campking' || !obj.data) { showBanner('导入失败', '这不是营地之王的存档文件', 3, '#ef7d57'); return; }
      const keys = Object.keys(obj.data).filter((k) => k.indexOf(BACKUP_PREFIX) === 0);
      const saves = keys.filter((k) => k.indexOf('campking_save_') === 0).map((k) => k.slice(14)).filter((m) => MODES[m]);
      askConfirm('导入这个存档文件？包含：' + (saves.map((m) => MODES[m].name).join('、') || '设置') + '。同一模式的现有存档会被覆盖。', () => {
        let ok = true;
        for (const k of keys) ok = Store.set(k, obj.data[k]) && ok;
        G.settings = loadSettings();
        avReload();
        showBanner(ok ? '导入成功' : '部分导入失败', ok ? '到“继续游戏”里读取存档' : '浏览器存储空间不足或被禁止', 4, ok ? '#38b764' : '#ef7d57');
      });
    };
    rd.readAsText(f);
  };
  document.body.appendChild(input);
  input.click();
}
