$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

# Create a small test wrapper that automatically clicks loadSampleCadDocument() on load
$wrapperHtml = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<iframe id="test-frame" src="file:///D:/ANTIGRAVITY/PDF-Tool-main/index.html" style="width:1200px; height:800px;"></iframe>
<script>
    window.addEventListener('message', (e) => {});
</script>
</body>
</html>
"@

$wrapperPath = "D:\ANTIGRAVITY\PDF-Tool-main\builder\test_wrapper.html"
[System.IO.File]::WriteAllText($wrapperPath, $wrapperHtml, [System.Text.Encoding]::UTF8)

Write-Host "Created test wrapper."
