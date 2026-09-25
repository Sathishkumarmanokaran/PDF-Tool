        // ==========================================
        // VIEWER & MARKUP STUDIO: DOCUMENT ENGINE
        // ==========================================

        function handleViewerFileSelect(event) {
            const file = event.target.files && event.target.files[0];
            if (file) {
                openViewerPDF(file, file.name);
            }
            try {
                event.target.value = '';
            } catch (e) {}
        }

        function handleViewerFileDrop(event) {
            event.preventDefault();
            const files = event.dataTransfer.files;
            if (files && files.length > 0 && files[0].type === 'application/pdf') {
                openViewerPDF(files[0], files[0].name);
            }
        }

        async function openViewerPDF(fileOrBytes, fileName = 'Document.pdf') {
            try {
                showToast("Loading document...", "info");
                let arrayBuffer;
                if (fileOrBytes instanceof File || fileOrBytes instanceof Blob) {
                    arrayBuffer = await fileOrBytes.arrayBuffer();
                } else if (fileOrBytes instanceof ArrayBuffer) {
                    arrayBuffer = fileOrBytes;
                } else if (fileOrBytes instanceof Uint8Array || (fileOrBytes && fileOrBytes.buffer instanceof ArrayBuffer)) {
                    arrayBuffer = fileOrBytes.buffer.slice(fileOrBytes.byteOffset || 0, (fileOrBytes.byteOffset || 0) + (fileOrBytes.byteLength || fileOrBytes.length));
                }

                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    throw new Error("Invalid or empty PDF document buffer");
                }

                // 1. Try to load in PDFLib for modification & burning markups
                let pdfDoc = null;
                try {
                    pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
                } catch (pdfLibErr) {
                    console.warn("PDF-Lib load warning (will fallback to view mode):", pdfLibErr);
                }

                // 2. Load in PDF.js for rendering
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
                const pdfJsDoc = await loadingTask.promise;

                // 3. Update State
                viewerState.doc = pdfDoc;
                viewerState.pdfJsDoc = pdfJsDoc;
                viewerState.file = fileOrBytes;
                viewerState.fileName = fileName;
                viewerState.pageCount = pdfJsDoc.numPages;
                viewerState.currentPage = 1;
                viewerState.markups = []; // Clear previous markups for new document
                viewerState.pageDimensions = [];

                // 4. Update Header & UI
                const docNameEl = document.getElementById('header-doc-name');
                if (docNameEl) docNameEl.innerText = fileName;
                const docPagesEl = document.getElementById('header-doc-pages');
                if (docPagesEl) docPagesEl.innerText = `(${pdfJsDoc.numPages} pg${pdfJsDoc.numPages > 1 ? 's' : ''})`;

                document.getElementById('viewer-empty-state').classList.add('hidden');
                document.getElementById('viewer-page-total').innerText = pdfJsDoc.numPages;
                document.getElementById('viewer-page-input').max = pdfJsDoc.numPages;
                document.getElementById('viewer-page-input').value = 1;

                // 5. Render Document Pages
                await renderViewerDocument();

                // 6. Generate Thumbnails & Bookmarks in Sidebar
                generateViewerThumbnails();
                loadViewerBookmarks();
                updateMarkupsSidebarList();

                showToast(`Opened ${fileName} (${pdfJsDoc.numPages} pages)`, "success");
            } catch (err) {
                console.error("openViewerPDF Error:", err);
                showToast("Failed to open PDF: " + err.message, "error");
            }
        }

        // --- SAMPLE CAD ARCHITECTURAL PLAN GENERATOR ---
        // Generates an interactive CAD floor plan with title block, walls, doors, dimensions, and grid lines
        async function loadSampleCadDocument() {
            try {
                showToast("Generating Sample Architectural CAD Drawing...", "info");
                const pdfDoc = await PDFLib.PDFDocument.create();
                
                // ARCH D size: 36" x 24" at 72 dpi = 2592 x 1728 points (scaled for screen: 1296 x 864)
                const width = 1296;
                const height = 864;
                const page = pdfDoc.addPage();
                page.setSize(width, height);
                const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
                const regularFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

                const cDark = PDFLib.rgb(0.08, 0.12, 0.18);
                const cWall = PDFLib.rgb(0.15, 0.25, 0.4);
                const cDim = PDFLib.rgb(0.3, 0.6, 0.85);
                const cGrid = PDFLib.rgb(0.8, 0.85, 0.9);
                const cAccent = PDFLib.rgb(0.0, 0.5, 0.9);

                // Drawing Sheet Border
                const margin = 36;
                page.drawRectangle({
                    x: margin, y: margin,
                    width: width - margin * 2, height: height - margin * 2,
                    borderWidth: 2, borderColor: cDark, color: PDFLib.rgb(0.99, 0.99, 1.0)
                });
                page.drawRectangle({
                    x: margin + 6, y: margin + 6,
                    width: width - (margin + 6) * 2, height: height - (margin + 6) * 2,
                    borderWidth: 0.75, borderColor: cDark, color: undefined
                });

                // Title Block (Bottom Right)
                const tbW = 340;
                const tbH = 110;
                const tbX = width - margin - tbW - 6;
                const tbY = margin + 6;
                page.drawRectangle({
                    x: tbX, y: tbY, width: tbW, height: tbH,
                    borderWidth: 1.5, borderColor: cDark, color: PDFLib.rgb(0.96, 0.98, 1.0)
                });
                // Title Block Grid Lines & Text
                page.drawLine({ start: { x: tbX, y: tbY + 70 }, end: { x: tbX + tbW, y: tbY + 70 }, thickness: 1, color: cDark });
                page.drawLine({ start: { x: tbX, y: tbY + 35 }, end: { x: tbX + tbW, y: tbY + 35 }, thickness: 1, color: cDark });
                page.drawLine({ start: { x: tbX + 220, y: tbY }, end: { x: tbX + 220, y: tbY + 70 }, thickness: 1, color: cDark });

                page.drawText('ANTIGRAVITY ARCHITECTURAL STUDIO', { x: tbX + 15, y: tbY + 85, size: 12, font, color: cAccent });
                page.drawText('PROJECT: INNOVATION CENTER — LEVEL 2 FLOOR PLAN', { x: tbX + 15, y: tbY + 73, size: 8, font: regularFont, color: cDark });
                page.drawText('DRAWING: ARCHITECTURAL GENERAL ARRANGEMENT', { x: tbX + 15, y: tbY + 52, size: 9, font, color: cDark });
                page.drawText('SCALE: 1/4" = 1\'-0"   |   DATE: 2026-09-25', { x: tbX + 15, y: tbY + 40, size: 8, font: regularFont, color: cDark });
                page.drawText('SHEET NUMBER', { x: tbX + 230, y: tbY + 54, size: 8, font: regularFont, color: cDark });
                page.drawText('A-201', { x: tbX + 230, y: tbY + 12, size: 28, font, color: cAccent });

                // Grid Lines
                const gridX = [120, 380, 640, 900, 1160];
                const gridLabels = ['1', '2', '3', '4', '5'];
                gridX.forEach((gx, i) => {
                    page.drawLine({ start: { x: gx, y: 150 }, end: { x: gx, y: 780 }, thickness: 0.5, color: cGrid });
                    // Grid Bubble Top
                    page.drawCircle({ x: gx, y: 800, size: 12, borderWidth: 1, borderColor: cDark, color: PDFLib.rgb(1, 1, 1) });
                    page.drawText(gridLabels[i], { x: gx - 3, y: 796, size: 10, font, color: cDark });
                });

                // Architectural Floor Plan: Exterior Perimeter Walls
                const planX = 140;
                const planY = 200;
                const planW = 980;
                const planH = 540;

                // Outer double-wall
                page.drawRectangle({ x: planX, y: planY, width: planW, height: planH, borderWidth: 3.5, borderColor: cWall, color: undefined });
                page.drawRectangle({ x: planX + 12, y: planY + 12, width: planW - 24, height: planH - 24, borderWidth: 1.5, borderColor: cWall, color: undefined });

                // Interior Partition Walls
                // Conference Room (Left)
                page.drawRectangle({ x: planX + 12, y: planY + 280, width: 320, height: 236, borderWidth: 2, borderColor: cWall, color: undefined });
                page.drawText('MAIN CONFERENCE ROOM', { x: planX + 45, y: planY + 410, size: 12, font, color: cDark });
                page.drawText('CAPACITY: 24 PERSONS   AREA: 720 SQ FT', { x: planX + 45, y: planY + 392, size: 8, font: regularFont, color: cDim });

                // Conference Table
                page.drawRectangle({ x: planX + 80, y: planY + 320, width: 180, height: 50, borderWidth: 1, borderColor: cDark, color: PDFLib.rgb(0.92, 0.95, 0.98) });

                // Executive Office (Middle-Top)
                page.drawRectangle({ x: planX + 332, y: planY + 280, width: 280, height: 236, borderWidth: 2, borderColor: cWall, color: undefined });
                page.drawText('EXECUTIVE SUITE 201', { x: planX + 370, y: planY + 410, size: 12, font, color: cDark });
                page.drawText('AREA: 540 SQ FT', { x: planX + 370, y: planY + 392, size: 8, font: regularFont, color: cDim });

                // Breakroom & Kitchen (Right-Top)
                page.drawRectangle({ x: planX + 612, y: planY + 280, width: 344, height: 236, borderWidth: 2, borderColor: cWall, color: undefined });
                page.drawText('BREAKROOM / PANTRY', { x: planX + 660, y: planY + 410, size: 12, font, color: cDark });
                page.drawText('AREA: 680 SQ FT', { x: planX + 660, y: planY + 392, size: 8, font: regularFont, color: cDim });

                // Open Collaboration Workspace (Bottom)
                page.drawText('OPEN COLLABORATION WORKSPACE & ENGINEERING LAB', { x: planX + 280, y: planY + 120, size: 14, font, color: cDark });
                page.drawText('64 HOT DESKS  |  AREA: 2,150 SQ FT  |  HIGH CEILINGS 14\'-0"', { x: planX + 320, y: planY + 98, size: 9, font: regularFont, color: cDim });

                // Dimension Lines & Ticks
                const dimY = planY - 30;
                page.drawLine({ start: { x: planX, y: dimY }, end: { x: planX + planW, y: dimY }, thickness: 1, color: cDim });
                page.drawLine({ start: { x: planX, y: dimY - 8 }, end: { x: planX, y: dimY + 8 }, thickness: 1.5, color: cDim });
                page.drawLine({ start: { x: planX + planW, y: dimY - 8 }, end: { x: planX + planW, y: dimY + 8 }, thickness: 1.5, color: cDim });
                page.drawText('54\'-6" [OVERALL BUILDING LENGTH]', { x: planX + planW / 2 - 80, y: dimY + 4, size: 9, font, color: cDim });

                const dimX = planX - 30;
                page.drawLine({ start: { x: dimX, y: planY }, end: { x: dimX, y: planY + planH }, thickness: 1, color: cDim });
                page.drawLine({ start: { x: dimX - 8, y: planY }, end: { x: dimX + 8, y: planY }, thickness: 1.5, color: cDim });
                page.drawLine({ start: { x: dimX - 8, y: planY + planH }, end: { x: dimX + 8, y: planY + planH }, thickness: 1.5, color: cDim });
                page.drawText('30\'-0"', { x: dimX - 35, y: planY + planH / 2, size: 9, font, color: cDim });

                // Save PDF to Uint8Array and open in Viewer
                const pdfBytes = await pdfDoc.save();
                await openViewerPDF(pdfBytes, "A-201_Sample_Level2_FloorPlan.pdf");

                // Pre-populate sample revision cloud & callout markup for immediate WOW effect
                addSampleInitialMarkups();

            } catch (err) {
                console.error("loadSampleCadDocument error:", err);
                showToast("Failed to generate sample CAD: " + err.message, "error");
            }
        }

        function addSampleInitialMarkups() {
            // Add a sample Revision Cloud and Callout so the user immediately sees interactive markups
            viewerState.markups = [
                {
                    id: 'markup_sample_1',
                    page: 1,
                    type: 'cloud',
                    x: 630,
                    y: 290,
                    width: 320,
                    height: 180,
                    strokeColor: '#dc2626',
                    strokeWidth: 2.5,
                    fillColor: '#fee2e2',
                    fillOpacity: 0.2,
                    lineStyle: 'solid',
                    author: 'Project Manager',
                    date: new Date().toLocaleDateString(),
                    subject: 'Rev 2 - Relocate Breakroom Exhaust'
                },
                {
                    id: 'markup_sample_2',
                    page: 1,
                    type: 'callout',
                    x: 750,
                    y: 490,
                    width: 170,
                    height: 50,
                    targetX: 720,
                    targetY: 420,
                    strokeColor: '#0284c7',
                    strokeWidth: 2,
                    fillColor: '#e0f2fe',
                    fillOpacity: 0.9,
                    textColor: '#0369a1',
                    fontSize: 11,
                    text: 'Verify plumbing rough-in connections',
                    author: 'Lead Architect',
                    date: new Date().toLocaleDateString(),
                    subject: 'Plumbing Review'
                }
            ];
            renderPageMarkups(1);
            updateMarkupsSidebarList();
        }

        // --- RENDER VIEWER PAGES ---
        async function renderViewerDocument() {
            const container = document.getElementById('viewer-pages-container');
            if (!container || !viewerState.pdfJsDoc) return;
            container.innerHTML = '';

            for (let i = 1; i <= viewerState.pageCount; i++) {
                const pageContainer = document.createElement('div');
                pageContainer.className = 'pdf-page-container';
                pageContainer.id = `pdf-page-${i}`;
                pageContainer.dataset.page = i;

                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-canvas';
                canvas.id = `pdf-canvas-${i}`;

                const textLayer = document.createElement('div');
                textLayer.className = 'pdf-text-layer';
                textLayer.id = `pdf-text-layer-${i}`;

                // Essential: SVG overlay on top of canvas & text layer (z-index: 10)
                const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svgOverlay.setAttribute('class', 'pdf-markup-svg');
                svgOverlay.setAttribute('id', `pdf-markup-svg-${i}`);
                svgOverlay.dataset.page = i;

                pageContainer.appendChild(canvas);
                pageContainer.appendChild(textLayer);
                pageContainer.appendChild(svgOverlay);
                container.appendChild(pageContainer);

                // Setup markup drawing & interaction listeners on this page's SVG overlay
                attachSvgOverlayListeners(svgOverlay, i);

                await renderViewerPage(i);
            }

            updateViewerStatusBar();
        }

        async function renderViewerPage(pageIndex) {
            try {
                const pdfPage = await viewerState.pdfJsDoc.getPage(pageIndex);
                const scale = viewerState.zoom;
                const dpr = window.devicePixelRatio || 1;
                const viewport = pdfPage.getViewport({ scale: scale * dpr, rotation: viewerState.rotation });
                const cssViewport = pdfPage.getViewport({ scale: scale, rotation: viewerState.rotation });

                // Store PDF point dimensions for scale calculations
                viewerState.pageDimensions[pageIndex - 1] = {
                    width: pdfPage.view[2] - pdfPage.view[0],
                    height: pdfPage.view[3] - pdfPage.view[1]
                };

                const pageContainer = document.getElementById(`pdf-page-${pageIndex}`);
                const canvas = document.getElementById(`pdf-canvas-${pageIndex}`);
                const textLayer = document.getElementById(`pdf-text-layer-${pageIndex}`);
                const svgOverlay = document.getElementById(`pdf-markup-svg-${pageIndex}`);

                if (!pageContainer || !canvas) return;

                // Page container dimensions (CSS pixels)
                pageContainer.style.width = `${cssViewport.width}px`;
                pageContainer.style.height = `${cssViewport.height}px`;

                // Canvas high-DPI sizing
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${cssViewport.width}px`;
                canvas.style.height = `${cssViewport.height}px`;

                // SVG overlay match
                svgOverlay.setAttribute('width', cssViewport.width);
                svgOverlay.setAttribute('height', cssViewport.height);
                svgOverlay.setAttribute('viewBox', `0 0 ${cssViewport.width} ${cssViewport.height}`);

                // Render Canvas
                const ctx = canvas.getContext('2d');
                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                await pdfPage.render(renderContext).promise;

                // Render Text Layer for search & copy
                if (textLayer) {
                    textLayer.innerHTML = '';
                    textLayer.style.width = `${cssViewport.width}px`;
                    textLayer.style.height = `${cssViewport.height}px`;
                    textLayer.classList.toggle('interactive', viewerState.activeTool === 'select-text');

                    try {
                        const textContent = await pdfPage.getTextContent();
                        pdfjsLib.renderTextLayer({
                            textContentSource: textContent,
                            container: textLayer,
                            viewport: cssViewport,
                            textDivs: []
                        });
                    } catch (tErr) {
                        console.warn("Text layer rendering skipped:", tErr);
                    }
                }

                // Render markups for this page
                renderPageMarkups(pageIndex);
            } catch (err) {
                console.error(`Error rendering page ${pageIndex}:`, err);
            }
        }

        // --- ZOOM & VIEWPORT CONTROLS ---
        function setViewerZoom(newZoom) {
            const clamped = Math.max(0.2, Math.min(5.0, newZoom));
            viewerState.zoom = clamped;

            const slider = document.getElementById('viewer-zoom-slider');
            if (slider) slider.value = clamped;

            const percentStr = `${Math.round(clamped * 100)}%`;
            const zoomPercent = document.getElementById('viewer-zoom-percent');
            if (zoomPercent) zoomPercent.innerText = percentStr;

            const floatingZoom = document.getElementById('floating-zoom-level');
            if (floatingZoom) floatingZoom.innerText = percentStr;

            // Re-render all pages at new zoom
            if (viewerState.pdfJsDoc) {
                for (let i = 1; i <= viewerState.pageCount; i++) {
                    renderViewerPage(i);
                }
            }
        }

        function zoomViewerIn() {
            setViewerZoom(viewerState.zoom + 0.15);
        }

        function zoomViewerOut() {
            setViewerZoom(viewerState.zoom - 0.15);
        }

        function zoomViewerFitWidth() {
            const viewportEl = document.getElementById('viewer-viewport');
            const firstPage = viewerState.pageDimensions[0];
            if (!viewportEl || !firstPage) return;

            const availableWidth = viewportEl.clientWidth - 80;
            const fitZoom = availableWidth / firstPage.width;
            setViewerZoom(fitZoom);
        }

        function zoomViewerFitPage() {
            const viewportEl = document.getElementById('viewer-viewport');
            const firstPage = viewerState.pageDimensions[0];
            if (!viewportEl || !firstPage) return;

            const availableHeight = viewportEl.clientHeight - 80;
            const fitZoom = availableHeight / firstPage.height;
            setViewerZoom(fitZoom);
        }

        function rotateViewerCurrentPage(deg = 90) {
            viewerState.rotation = (viewerState.rotation + deg) % 360;
            if (viewerState.pdfJsDoc) {
                for (let i = 1; i <= viewerState.pageCount; i++) {
                    renderViewerPage(i);
                }
            }
            showToast(`Rotated page view ${viewerState.rotation}°`, "info");
        }

        // --- PAGE NAVIGATION ---
        function goToViewerPage(pageNum) {
            if (!viewerState.pdfJsDoc) return;
            const clamped = Math.max(1, Math.min(viewerState.pageCount, pageNum));
            viewerState.currentPage = clamped;

            const input = document.getElementById('viewer-page-input');
            if (input) input.value = clamped;

            const targetPageEl = document.getElementById(`pdf-page-${clamped}`);
            if (targetPageEl) {
                targetPageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            updateViewerStatusBar();
        }

        function navigateViewerPage(delta) {
            goToViewerPage(viewerState.currentPage + delta);
        }

        function updateViewerStatusBar() {
            const dimsEl = document.getElementById('viewer-sheet-dimensions');
            if (dimsEl && viewerState.pageDimensions[viewerState.currentPage - 1]) {
                const dims = viewerState.pageDimensions[viewerState.currentPage - 1];
                const wIn = (dims.width / 72).toFixed(1);
                const hIn = (dims.height / 72).toFixed(1);
                dimsEl.innerHTML = `<i class="fa-regular fa-file text-slate-400"></i> ${wIn}" x ${hIn}"`;
            }
        }

        // --- SIDEBAR TABS & THUMBNAILS ---
        function setViewerSidebarTab(tabName) {
            ['pages', 'markups', 'bookmarks', 'search'].forEach(t => {
                const btn = document.getElementById(`sidebar-tab-${t}`);
                const panel = document.getElementById(`sidebar-panel-${t}`);
                const active = t === tabName;
                if (btn) {
                    btn.className = active 
                        ? 'px-2 py-1 text-xs font-semibold text-brand-600 dark:text-brand-400 rounded bg-white dark:bg-slate-800 shadow-xs'
                        : 'px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 rounded';
                }
                if (panel) {
                    panel.classList.toggle('hidden', !active);
                }
            });
        }

        function toggleViewerSidebar() {
            const sidebar = document.getElementById('viewer-sidebar');
            const restore = document.getElementById('viewer-sidebar-restore');
            if (!sidebar || !restore) return;
            const isHidden = sidebar.classList.contains('hidden');
            if (isHidden) {
                sidebar.classList.remove('hidden');
                restore.classList.add('hidden');
            } else {
                sidebar.classList.add('hidden');
                restore.classList.remove('hidden');
            }
        }

        function toggleViewerInspector() {
            const inspector = document.getElementById('viewer-inspector');
            const restore = document.getElementById('viewer-inspector-restore');
            if (!inspector || !restore) return;
            const isHidden = inspector.classList.contains('hidden');
            if (isHidden) {
                inspector.classList.remove('hidden');
                restore.classList.add('hidden');
            } else {
                inspector.classList.add('hidden');
                restore.classList.remove('hidden');
            }
        }

        async function generateViewerThumbnails() {
            const container = document.getElementById('viewer-thumbnails-container');
            if (!container || !viewerState.pdfJsDoc) return;
            container.innerHTML = '';

            for (let i = 1; i <= viewerState.pageCount; i++) {
                const thumbCard = document.createElement('div');
                thumbCard.className = `p-2 rounded-lg border cursor-pointer transition ${i === viewerState.currentPage ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'}`;
                thumbCard.onclick = () => goToViewerPage(i);

                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.className = 'w-full rounded shadow-xs mb-1.5 bg-white';

                const label = document.createElement('div');
                label.className = 'text-center text-[11px] font-medium text-slate-600 dark:text-slate-300';
                label.innerText = `Page ${i}`;

                thumbCard.appendChild(thumbCanvas);
                thumbCard.appendChild(label);
                container.appendChild(thumbCard);

                // Render thumbnail asynchronously
                viewerState.pdfJsDoc.getPage(i).then(page => {
                    const viewport = page.getViewport({ scale: 0.25 });
                    thumbCanvas.width = viewport.width;
                    thumbCanvas.height = viewport.height;
                    const ctx = thumbCanvas.getContext('2d');
                    page.render({ canvasContext: ctx, viewport: viewport });
                });
            }
        }

        async function loadViewerBookmarks() {
            const treeEl = document.getElementById('viewer-bookmarks-tree');
            if (!treeEl || !viewerState.pdfJsDoc) return;
            try {
                const outline = await viewerState.pdfJsDoc.getOutline();
                if (!outline || outline.length === 0) {
                    treeEl.innerHTML = '<div class="p-4 text-center text-slate-400">No bookmarks found in document.</div>';
                    return;
                }
                treeEl.innerHTML = '';
                outline.forEach(item => {
                    const itemEl = document.createElement('div');
                    itemEl.className = 'p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-1.5';
                    itemEl.innerHTML = `<i class="fa-solid fa-bookmark text-brand-500 text-[10px]"></i> <span>${item.title}</span>`;
                    itemEl.onclick = async () => {
                        if (typeof item.dest === 'string') {
                            const dest = await viewerState.pdfJsDoc.getDestination(item.dest);
                            const pageIndex = await viewerState.pdfJsDoc.getPageIndex(dest[0]);
                            goToViewerPage(pageIndex + 1);
                        } else if (Array.isArray(item.dest)) {
                            const pageIndex = await viewerState.pdfJsDoc.getPageIndex(item.dest[0]);
                            goToViewerPage(pageIndex + 1);
                        }
                    };
                    treeEl.appendChild(itemEl);
                });
            } catch (bErr) {
                console.warn("Could not load outline:", bErr);
            }
        }
