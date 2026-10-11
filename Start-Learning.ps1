param([int]$Port=8765,[switch]$Stop)
$ErrorActionPreference='Stop'
$pidPath=Join-Path $PSScriptRoot '.preview.pid'
if ($Stop) {
  if (Test-Path -LiteralPath $pidPath) {
    $previewProcessId=[int](Get-Content -LiteralPath $pidPath)
    $previewProcess=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $previewProcessId)
    if ($previewProcess -and $previewProcess.CommandLine -like ('*' + $PSScriptRoot + '*serve.mjs*')) { Stop-Process -Id $previewProcessId }
    Remove-Item -LiteralPath $pidPath
  }
  Write-Host '本機預覽服務已停止。'; exit
}
$bundledNode=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeExecutable=if(Test-Path -LiteralPath $bundledNode){$bundledNode}else{(Get-Command node -ErrorAction SilentlyContinue).Source}
if(-not $nodeExecutable){throw '找不到Node.js。請先安裝Node.js，或直接使用README的公開網站。'}
$previewUrl='http://127.0.0.1:' + $Port + '/'
$alreadyAvailable=$false
try { $existingResponse=Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2; $alreadyAvailable=$existingResponse.Content -match '運動科學研究探險隊' } catch {}
if(-not $alreadyAvailable) {
  $previewScript=Join-Path $PSScriptRoot 'tools\serve.mjs'
  $previewProcess=Start-Process -FilePath $nodeExecutable -ArgumentList @(('"' + $previewScript + '"'),[string]$Port) -WindowStyle Hidden -PassThru
  Set-Content -LiteralPath $pidPath -Value $previewProcess.Id -Encoding ASCII
  $ready=$false
  for($attempt=0;$attempt -lt 20;$attempt++){Start-Sleep -Milliseconds 250;try{$response=Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 1;if($response.Content -match '運動科學研究探險隊'){$ready=$true;break}}catch{}}
  if(-not $ready){throw ('預覽啟動失敗。連接埠可能正在使用，請改用 -Port 8766。')}
}
Start-Process $previewUrl
Write-Host ('已開啟 ' + $previewUrl + '；結束時執行相同指令並加上 -Stop。')
