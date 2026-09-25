$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$dumpFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\edge_dump.html"
if (Test-Path $dumpFile) { Remove-Item $dumpFile }

$proc = Start-Process -FilePath $edgePath -ArgumentList @("--headless=new", "--dump-dom", "--disable-gpu", "file:///D:/ANTIGRAVITY/PDF-Tool-main/index.html") -RedirectStandardOutput $dumpFile -NoNewWindow -PassThru
$proc.WaitForExit(10000)

if (Test-Path $dumpFile) {
    $fullText = Get-Content $dumpFile -Raw -Encoding UTF8
    Write-Host "Dump file size: $($fullText.Length) bytes"

    $hasViewer = $fullText.Contains("mode-container-viewer")
    $hasCompare = $fullText.Contains("mode-container-compare")
    $hasToolbox = $fullText.Contains("mode-container-toolbox")
    $hasBinder = $fullText.Contains("mode-container-binder")
    $hasRibbon = $fullText.Contains("ribbon-tab-home")
    $hasEmptyState = $fullText.Contains("viewer-empty-state")
    $hasCadSampleBtn = $fullText.Contains("loadSampleCadDocument")
    $hasScaleModal = $fullText.Contains("modal-calibrate-scale")
    $hasSignatureModal = $fullText.Contains("modal-signature")

    Write-Host "DOM Validation Results:"
    Write-Host "  mode-container-viewer:  $hasViewer"
    Write-Host "  mode-container-compare: $hasCompare"
    Write-Host "  mode-container-toolbox: $hasToolbox"
    Write-Host "  mode-container-binder:  $hasBinder"
    Write-Host "  ribbon-tab-home:        $hasRibbon"
    Write-Host "  viewer-empty-state:     $hasEmptyState"
    Write-Host "  CAD sample button:      $hasCadSampleBtn"
    Write-Host "  scale modal:            $hasScaleModal"
    Write-Host "  signature modal:        $hasSignatureModal"

    if ($hasViewer -and $hasCompare -and $hasToolbox -and $hasBinder -and $hasRibbon -and $hasEmptyState -and $hasCadSampleBtn) {
        Write-Host "`nSUCCESS: All containers and elements verified in DOM!"
    } else {
        Write-Host "`nFAILURE: Some elements are missing."
        exit 1
    }
} else {
    Write-Host "Dump file was not generated."
    exit 1
}
