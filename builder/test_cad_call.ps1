$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$testHtml = @"
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<div id="output"></div>
<iframe id="app-frame" src="file:///D:/ANTIGRAVITY/PDF-Tool-main/index.html" style="width:1000px;height:700px;"></iframe>
<script>
const frame = document.getElementById('app-frame');
frame.onload = async function() {
    const out = (m) => document.getElementById('output').innerHTML += m + '<br>';
    const win = frame.contentWindow;
    try {
        out('1. Starting test in iframe...');
        const doc = await win.PDFLib.PDFDocument.create();
        const page = doc.addPage();
        page.setSize(600, 400);
        const bytes = await doc.save();
        out('2. Created PDF, calling getDocument...');
        const pdf = await win.pdfjsLib.getDocument({ data: bytes }).promise;
        out('3. SUCCESS! Got PDF with pages: ' + pdf.numPages);
    } catch(err) {
        out('CATCH: ' + err.message);
    }
};
</script>
</body>
</html>
"@

$testFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\test_cad.html"
[System.IO.File]::WriteAllText($testFile, $testHtml, [System.Text.Encoding]::UTF8)

$logFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\test_cad_dump.html"
if (Test-Path $logFile) { Remove-Item $logFile }

$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "file:///D:/ANTIGRAVITY/PDF-Tool-main/builder/test_cad.html"
) -NoNewWindow -PassThru

Start-Sleep -Seconds 3

# Now dump dom
& $edgePath --headless=new --disable-gpu --allow-file-access-from-files --dump-dom "file:///D:/ANTIGRAVITY/PDF-Tool-main/builder/test_cad.html"
