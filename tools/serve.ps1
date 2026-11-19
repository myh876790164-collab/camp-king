# 本地测试服务器：http://localhost:8123/ （项目根目录 = 本脚本的上一级）
$root = Split-Path -Parent $PSScriptRoot
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add('http://localhost:8123/')
$l.Start()
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8'; '.css' = 'text/css'; '.png' = 'image/png'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json' }
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($p -eq '') { $p = 'index.html' }
  $f = Join-Path $root $p
  if (Test-Path $f -PathType Leaf) {
    $b = [System.IO.File]::ReadAllBytes($f)
    $ext = [System.IO.Path]::GetExtension($f)
    if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] }
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
