# 营地之王 Camp King — 开发说明（给 Claude 看的）

## 关于用户
- 说中文，几乎没有编程经验：解释要用大白话；所有回复用中文。
- 游戏上传到 **GitHub** 发布（不是直接传 Netlify，别记错）。
- 目前只做线上版：改完**不要**再运行 `tools/make-local.ps1` 打包离线版，也不用提醒打包（用户以后另说再恢复）。
- 每次改完要提醒：上传到 GitHub、说明新增了哪些文件。

## 技术结构
- 纯 HTML5 Canvas + 普通 `<script>`（没有构建步骤、没有模块），所有界面都画在 canvas 上。加载顺序见 `index.html`。
- 全局状态 `G`；每个模式是 `js/modes/*.js` 里的 `MODES.xxx` 配置 + hooks。`MODE_ORDER` 在 `js/config.js`。
- 公路求生是横版 `custom: true` 模式：main/render/input/save 里遇到 `G.def.custom` 会直接调用模式自己的 hooks（update/render/tap/drag/key/save/load/dayText）。
- 存档：`Store`（localStorage），键 `campking_save_<模式>`；设置里有导出/导入备份（`js/backup.js`）。
- 离线：`manifest.webmanifest` + `service-worker.js`（有网先取最新，改了文件列表要把 CACHE 版本号 +1）。
- 文件作用见 `README.md`。

## 必须遵守
1. **全局名字冲突**：后加载文件里的同名函数/常量会悄悄覆盖前面的。每次改完运行 `sh tools/dupcheck.sh`，必须什么都不输出。新模式的名字统一加前缀（修仙 `sect*`/`SECT_*`，公路 `rd*`/`RD_*`）。
2. **公路求生改装件 id = 种类 + 序号**（`js/roaddata.js` 的 `rdFamily`）：新型号只能加在每组末尾，否则旧存档对不上。
3. 改代码优先用 Edit 工具；需要批量精确替换时可以用 `perl tools/lit.pl 文件 <<'EOF'`，内容为 `@@OLD`/`@@NEW`/`@@END` 块（每个 OLD 必须恰好匹配一次，否则整个文件不改；NEW 不能为空）。
4. **不要**用 `perl -i` 同时重定向输出到同一个文件（曾经把 sectui.js 清空过）。
5. PowerShell 5.1 读带中文的 .ps1 必须是 UTF-8 带 BOM。

## 测试方法
- 启动服务器：`Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','C:\Users\myh87\Projects\bonfire-camp\tools\serve.ps1' -WindowStyle Hidden`，打开 http://localhost:8123/ 。
  停止：`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*serve.ps1*' } | % { Stop-Process -Id $_.ProcessId -Force }`
- 内置浏览器面板里用 JS 直接驱动：`startGame('road',{veh:'courier'})`、循环调用 `update(dt)` 快进（修仙：`update(0.25)` = 1.5 天，240 次 = 1 年；公路：10 秒 = 1 小时），再 `render()` 后截图（截图可能是旧的，先 render）。
- 用 `window.onerror` 收集报错；改完要把其他模式也各跑几百步确认没坏；手机竖屏用 resize_window mobile 检查，测完改回 desktop。
- 公路求生调数值：把 `tools/rdsim.js` 的内容在页面里执行，然后 `rdSim('courier', 60)`。返回结果里的 `dun` 列表是自动打的每场副本（里程、主题、名次、等级、分数），用来看副本难度。
- 副本：`rdxDebug('fort')` 马上进一场指定主题（trial / mine / ghost / fort / abase）。主题配置在 `js/roaddunthemes.js` 的 `RDX_THEMES.xxx`（hpMul / dmgMul / waveGap / npcGoal 调难度）；副本专用怪在 `roaddata.js` 里标 `dunOnly`，不会出现在公路上。
- 内置浏览器不支持 service worker（会报 "unknown error fetching the script"，正常）；要验证离线功能用 headless Edge + `--remote-debugging-port`，读 `/json` 里的页面标题。
