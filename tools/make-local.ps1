# 生成 Windows 离线版压缩包：把游戏文件复制到 dist 文件夹并打包成 zip
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path (Split-Path -Parent $root) 'bonfire-camp-local'
$name = (-join [char[]](0x8425, 0x5730, 0x4E4B, 0x738B))   # 营地之王
$stage = Join-Path $outDir $name
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item (Join-Path $root 'index.html') $stage
Copy-Item (Join-Path $root 'manifest.webmanifest') $stage
Copy-Item (Join-Path $root 'service-worker.js') $stage
Copy-Item (Join-Path $root 'js') $stage -Recurse
Copy-Item (Join-Path $root 'icons') $stage -Recurse
$start = (-join [char[]](0x5F00, 0x59CB, 0x6E38, 0x620F)) + '.bat'          # 开始游戏.bat
$readme = (-join [char[]](0x8BF4, 0x660E)) + '.txt'                                     # 说明.txt
# bat 用系统编码（纯英文内容），说明文字用带 BOM 的 UTF-8，记事本能正确显示中文
[IO.File]::WriteAllText((Join-Path $stage $start), ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'launcher.bat')) -replace "`r?`n", "`r`n"), [Text.Encoding]::ASCII)
[IO.File]::WriteAllText((Join-Path $stage $readme), ([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'readme.txt'), [Text.Encoding]::UTF8) -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding $true))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $outDir ($name + '-Windows' + (-join [char[]](0x79BB, 0x7EBF, 0x7248)) + '.zip')  # 离线版
if (Test-Path $zip) { Remove-Item $zip -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, 'Optimal', $true, [Text.Encoding]::UTF8)
Get-Item $zip | Select-Object FullName, Length
