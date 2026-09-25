$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$logFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\edge_console.log"
if (Test-Path $logFile) { Remove-Item $logFile }

$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--enable-logging=stderr",
    "--v=1",
    "file:///D:/ANTIGRAVITY/PDF-Tool-main/index.html"
) -RedirectStandardError $logFile -NoNewWindow -PassThru

Start-Sleep -Seconds 3
if (-not $proc.HasExited) {
    $proc.Kill()
}

if (Test-Path $logFile) {
    $logContent = Get-Content $logFile -Raw
    Write-Host "Log size: $($logContent.Length) bytes"
    $hasSyntaxError = $logContent -match "SyntaxError|Uncaught"
    Write-Host "Contains JS Syntax / Uncaught Error: $hasSyntaxError"
    if ($hasSyntaxError) {
        Write-Host "Errors found:"
        $logContent -split "`n" | Where-Object { $_ -match "Error|Uncaught" } | Write-Host
    } else {
        Write-Host "NO JavaScript Syntax or Uncaught Errors detected!"
    }
}
