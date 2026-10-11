param([string]$RscriptPath = '', [switch]$Verify)
$ErrorActionPreference = 'Stop'
if (-not $RscriptPath) {
    $taskRCommand = Get-Command Rscript -CommandType Application -ErrorAction SilentlyContinue
    if ($taskRCommand) { $RscriptPath = $taskRCommand.Source }
    elseif (Test-Path -LiteralPath 'C:\Program Files\R\R-4.5.2\bin\Rscript.exe') { $RscriptPath = 'C:\Program Files\R\R-4.5.2\bin\Rscript.exe' }
    else { throw '找不到 Rscript。請安裝 R，或以 -RscriptPath 指定 Rscript.exe 完整位置。' }
}
if (-not (Test-Path -LiteralPath $RscriptPath)) { throw "Rscript 路徑不存在：$RscriptPath" }
# R on Windows rejects Unix C.UTF-8 in LC_ALL. Remove only for this run,
# then restore caller environment even on failure. No system setting is changed.
$taskLocaleNames = @('LC_ALL', 'LC_CTYPE', 'LANG')
$taskLocaleBackup = @{}
foreach ($taskName in $taskLocaleNames) {
    $taskLocaleBackup[$taskName] = [Environment]::GetEnvironmentVariable($taskName, 'Process')
    [Environment]::SetEnvironmentVariable($taskName, $null, 'Process')
}
try {
    if ($Verify) {
        & $RscriptPath --vanilla (Join-Path $PSScriptRoot 'verify_reproducibility.R')
        if ($LASTEXITCODE -ne 0) { throw '兩次重跑驗證失敗；請先檢查上方錯誤。' }
    } else {
        & $RscriptPath --vanilla (Join-Path $PSScriptRoot 'generate_data.R')
        if ($LASTEXITCODE -ne 0) { throw '生成失敗：停止分析；請先檢查上方錯誤。' }
        & $RscriptPath --vanilla (Join-Path $PSScriptRoot 'analysis.R')
        if ($LASTEXITCODE -ne 0) { throw '分析失敗：本次結果未完成，請勿使用舊結果宣稱本次成功。' }
    }
    & $RscriptPath --vanilla (Join-Path $PSScriptRoot 'validate_outputs.R')
    if ($LASTEXITCODE -ne 0) { throw '資料與結果核對失敗；請先檢查上方錯誤。' }
} finally {
    foreach ($taskName in $taskLocaleNames) { [Environment]::SetEnvironmentVariable($taskName, $taskLocaleBackup[$taskName], 'Process') }
}
