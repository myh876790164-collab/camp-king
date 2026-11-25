#!/bin/sh
# 检查全局名字冲突：所有 js 都是普通 <script>，后加载的同名函数/常量会悄悄覆盖前面的。必须什么都不输出。
cd "$(dirname "$0")/.." && grep -ohE "^(function|const|let|var) +[A-Za-z_\$][A-Za-z0-9_\$]*" js/*.js js/modes/*.js | awk '{print $2}' | sort | uniq -d
