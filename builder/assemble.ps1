$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $baseDir

$headCss = Get-Content (Join-Path $baseDir "part_head_css.html") -Raw -Encoding UTF8
$headerNav = Get-Content (Join-Path $baseDir "part_header_nav.html") -Raw -Encoding UTF8
$viewerHtml = Get-Content (Join-Path $baseDir "part_viewer_html.html") -Raw -Encoding UTF8
$compareHtml = Get-Content (Join-Path $baseDir "part_compare_html.html") -Raw -Encoding UTF8
$toolboxHtml = Get-Content (Join-Path $baseDir "part_toolbox_html.html") -Raw -Encoding UTF8
$binderHtml = Get-Content (Join-Path $baseDir "part_binder_html.html") -Raw -Encoding UTF8
$modalsHtml = Get-Content (Join-Path $baseDir "part_modals_html.html") -Raw -Encoding UTF8
$newModalsHtml = Get-Content (Join-Path $baseDir "part_new_modals.html") -Raw -Encoding UTF8

$existingJs = Get-Content (Join-Path $baseDir "part_existing_js.js") -Raw -Encoding UTF8
$appJsState = Get-Content (Join-Path $baseDir "part_app_js_state.js") -Raw -Encoding UTF8
$appJsEngine = Get-Content (Join-Path $baseDir "part_app_js_engine_doc.js") -Raw -Encoding UTF8
$appJsMarkup = Get-Content (Join-Path $baseDir "part_app_js_markup.js") -Raw -Encoding UTF8
$appJsTools = Get-Content (Join-Path $baseDir "part_app_js_tools_export.js") -Raw -Encoding UTF8

$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine($headCss)
[void]$sb.AppendLine($headerNav)
[void]$sb.AppendLine('    <main class="flex-1 flex flex-col min-h-0 relative">')
[void]$sb.AppendLine($viewerHtml)
[void]$sb.AppendLine($compareHtml)
[void]$sb.AppendLine($toolboxHtml)
[void]$sb.AppendLine($binderHtml)
[void]$sb.AppendLine('    </main>')
[void]$sb.AppendLine($modalsHtml)
[void]$sb.AppendLine($newModalsHtml)
[void]$sb.AppendLine('    <script>')
[void]$sb.AppendLine($existingJs)
[void]$sb.AppendLine($appJsState)
[void]$sb.AppendLine($appJsEngine)
[void]$sb.AppendLine($appJsMarkup)
[void]$sb.AppendLine($appJsTools)
[void]$sb.AppendLine('    </script>')
[void]$sb.AppendLine('</body>')
[void]$sb.AppendLine('</html>')

$finalHtml = $sb.ToString()
$outputPath = Join-Path $rootDir "index.html"
[System.IO.File]::WriteAllText($outputPath, $finalHtml, [System.Text.Encoding]::UTF8)

Write-Host "Successfully assembled index.html ($($finalHtml.Length) characters) at $outputPath"
