$lines = Get-Content -Path "index.html.bak"

# 1. Compare HTML: lines 398 to 800 (1-indexed -> 0-indexed: 397..799)
$compareHtml = $lines[397..799] -join "`n"
[System.IO.File]::WriteAllText("d:\ANTIGRAVITY\PDF-Tool-main\builder\part_compare_html.html", $compareHtml)

# 2. Toolbox HTML: lines 801 to 941 (0-indexed: 800..940)
$toolboxHtml = $lines[800..940] -join "`n"
[System.IO.File]::WriteAllText("d:\ANTIGRAVITY\PDF-Tool-main\builder\part_toolbox_html.html", $toolboxHtml)

# 3. Binder HTML: lines 942 to 996 (0-indexed: 941..995)
$binderHtml = $lines[941..995] -join "`n"
[System.IO.File]::WriteAllText("d:\ANTIGRAVITY\PDF-Tool-main\builder\part_binder_html.html", $binderHtml)

# 4. Modals HTML: lines 997 to 1319 (0-indexed: 996..1318)
$modalsHtml = $lines[996..1318] -join "`n"
[System.IO.File]::WriteAllText("d:\ANTIGRAVITY\PDF-Tool-main\builder\part_modals_html.html", $modalsHtml)

# 5. Existing JS: lines 1321 to 3498
$existingJs = $lines[1320..3497] -join "`n"
[System.IO.File]::WriteAllText("d:\ANTIGRAVITY\PDF-Tool-main\builder\part_existing_js.js", $existingJs)

Write-Output "Extracted pristine components from backup successfully!"
