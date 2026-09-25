$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$testHtml = @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <script src="../pdf.min.js"></script>
    <script src="../pdf-lib.min.js"></script>
</head>
<body>
<div id="output"></div>
<script>
async function run() {
    const out = (m) => document.getElementById('output').innerHTML += m + '<br>';
    try {
        out('1. Testing PDFLib create...');
        const pdfDoc = await PDFLib.PDFDocument.create();
        out('2. PDFLib created. Adding page via addPage() and setSize...');
        const page = pdfDoc.addPage();
        page.setSize(1296, 864);
        out('3. Page added! Embedding font...');
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
        page.drawText('Sample Plan', { x: 50, y: 50, size: 20, font });
        out('4. Saving PDF...');
        const bytes = await pdfDoc.save();
        out('5. Saved! Bytes length: ' + bytes.length);

        out('6. Loading in PDF.js...');
        const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        out('7. SUCCESS! PDF.js loaded doc with pages: ' + pdf.numPages);
    } catch(err) {
        out('ERROR: ' + err.message + ' | ' + err.stack);
    }
}
run();
</script>
</body>
</html>
"@

$testFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\test_direct_pdf.html"
[System.IO.File]::WriteAllText($testFile, $testHtml, [System.Text.Encoding]::UTF8)

$logFile = "D:\ANTIGRAVITY\PDF-Tool-main\builder\test_direct_dump.html"
if (Test-Path $logFile) { Remove-Item $logFile }

$proc = Start-Process -FilePath $edgePath -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--virtual-time-budget=6000",
    "--dump-dom",
    "file:///D:/ANTIGRAVITY/PDF-Tool-main/builder/test_direct_pdf.html"
) -RedirectStandardOutput $logFile -NoNewWindow -PassThru

$proc.WaitForExit(10000)

if (Test-Path $logFile) {
    Get-Content $logFile -Raw
}
