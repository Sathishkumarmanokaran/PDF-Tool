$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$logFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\edge_cad_console.log"
if (Test-Path $logFile) { Remove-Item $logFile }

$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--enable-logging=stderr",
    "--v=1",
    "--allow-file-access-from-files",
    "file:///D:/ANTIGRAVITY/PDF-Tool-main/builder/test_cad_run.html"
) -RedirectStandardError $logFile -NoNewWindow -PassThru

Start-Sleep -Seconds 4
if (-not $proc.HasExited) {
    $proc.Kill()
}

if (Test-Path $logFile) {
    $content = Get-Content $logFile -Raw
    Write-Host "Console Log Content:"
    Write-Host $content
} else {
    Write-Host "No log file found."
}
