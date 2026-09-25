        // ==========================================
        // VIEWER & MARKUP STUDIO: TOOLS, EXPORT & PDF-LIB BURNING
        // ==========================================

        // --- TOAST NOTIFICATIONS ---
        function showToast(message, type = 'info', duration = 3000) {
            const container = document.getElementById('toast-container');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            
            const icons = {
                'success': 'fa-solid fa-circle-check',
                'error': 'fa-solid fa-circle-exclamation',
                'info': 'fa-solid fa-circle-info',
                'warning': 'fa-solid fa-triangle-exclamation'
            };

            toast.innerHTML = `
                <i class="${icons[type] || icons.info} text-base"></i>
                <div class="flex-1">${message}</div>
            `;

            container.appendChild(toast);

            setTimeout(() => {
                toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(1rem) scale(0.95)';
                setTimeout(() => toast.remove(), 250);
            }, duration);
        }

        // --- SCALE CALIBRATION LOGIC ---
        function handleScalePresetChange(val) {
            const customFields = document.getElementById('custom-scale-fields');
            if (val === 'custom') {
                if (customFields) customFields.classList.remove('hidden');
            } else {
                if (customFields) customFields.classList.add('hidden');
            }
        }

        function applyScaleCalibration() {
            const select = document.getElementById('scale-preset-select');
            const val = select ? select.value : 'arch-1-4';

            // 72 points = 1 inch
            const scalePresets = {
                'arch-1-4': { ratio: 18, unit: 'ft', label: '1/4" = 1\'-0"' },   // 18 pt = 1 ft
                'arch-1-8': { ratio: 9, unit: 'ft', label: '1/8" = 1\'-0"' },    // 9 pt = 1 ft
                'arch-1-2': { ratio: 36, unit: 'ft', label: '1/2" = 1\'-0"' },   // 36 pt = 1 ft
                'arch-3-4': { ratio: 54, unit: 'ft', label: '3/4" = 1\'-0"' },   // 54 pt = 1 ft
                'arch-1': { ratio: 72, unit: 'ft', label: '1" = 1\'-0"' },       // 72 pt = 1 ft
                'arch-3': { ratio: 216, unit: 'ft', label: '3" = 1\'-0"' },      // 216 pt = 1 ft
                'eng-10': { ratio: 7.2, unit: 'ft', label: '1" = 10\'-0"' },
                'eng-20': { ratio: 3.6, unit: 'ft', label: '1" = 20\'-0"' },
                'eng-50': { ratio: 1.44, unit: 'ft', label: '1" = 50\'-0"' },
                'eng-100': { ratio: 0.72, unit: 'ft', label: '1" = 100\'-0"' },
                'metric-10': { ratio: 204.09, unit: 'm', label: '1:10 (Metric)' },
                'metric-20': { ratio: 102.05, unit: 'm', label: '1:20 (Metric)' },
                'metric-50': { ratio: 40.82, unit: 'm', label: '1:50 (Metric)' },
                'metric-100': { ratio: 20.41, unit: 'm', label: '1:100 (Metric)' },
                'metric-200': { ratio: 10.20, unit: 'm', label: '1:200 (Metric)' },
                'metric-500': { ratio: 4.08, unit: 'm', label: '1:500 (Metric)' }
            };

            if (val === 'custom') {
                const docInches = parseFloat(document.getElementById('custom-scale-doc-val').value) || 1.0;
                const realVal = parseFloat(document.getElementById('custom-scale-real-val').value) || 1.0;
                const realUnit = document.getElementById('custom-scale-real-unit').value || 'ft';
                const pts = docInches * 72;
                const ratio = pts / realVal;
                viewerState.scale = {
                    ratio: ratio,
                    unit: realUnit,
                    label: `${docInches}" = ${realVal} ${realUnit}`
                };
            } else if (scalePresets[val]) {
                viewerState.scale = scalePresets[val];
            }

            const labelEl = document.getElementById('viewer-scale-label');
            if (labelEl) labelEl.innerText = `Scale: ${viewerState.scale.label}`;

            closeModal('modal-calibrate-scale');
            showToast(`Scale calibrated to: ${viewerState.scale.label}`, "success");

            // Re-render measurement markups to update dimension labels
            for (let i = 1; i <= viewerState.pageCount; i++) {
                renderPageMarkups(i);
            }
            updateMarkupsSidebarList();
        }

        function startInteractiveScaleCalibration() {
            closeModal('modal-calibrate-scale');
            showToast("Click and drag between 2 known points on the drawing to calibrate scale", "info", 5000);
            setActiveViewerTool('measure-length');
        }

        // --- STAMPS & SIGNATURES ---
        function prepareStampPlacement(stampType) {
            const stampConfigs = {
                'APPROVED': { text: 'APPROVED', strokeColor: '#059669', author: 'Architect' },
                'REJECTED': { text: 'REJECTED', strokeColor: '#dc2626', author: 'Reviewer' },
                'REVISED': { text: 'REVISED', strokeColor: '#0284c7', author: 'Engineer' },
                'DRAFT': { text: 'PRELIMINARY DRAFT', strokeColor: '#d97706', author: 'Drafting' }
            };

            const config = stampConfigs[stampType] || stampConfigs.APPROVED;
            viewerState.pendingStamp = {
                type: 'stamp',
                width: 190,
                height: 60,
                text: config.text,
                strokeColor: config.strokeColor,
                author: config.author,
                date: new Date().toLocaleDateString()
            };

            showToast(`Click anywhere on drawing to place ${stampType} stamp`, "info");
        }

        function placeConfiguredStamp(pageIndex, x, y, stampData) {
            const markup = {
                id: 'markup_' + Date.now(),
                page: pageIndex,
                type: 'stamp',
                x: x - stampData.width / 2,
                y: y - stampData.height / 2,
                width: stampData.width,
                height: stampData.height,
                text: stampData.text,
                strokeColor: stampData.strokeColor,
                strokeWidth: 3,
                author: stampData.author,
                date: stampData.date,
                subject: `Stamp: ${stampData.text}`
            };
            saveMarkup(markup);
            selectViewerMarkup(markup.id);
            showToast("Stamp placed", "success");
        }

        function applyCustomStamp() {
            const title = document.getElementById('custom-stamp-title').value || 'REVIEWED';
            const author = document.getElementById('custom-stamp-author').value || 'User';
            const color = document.getElementById('custom-stamp-color').value || '#059669';
            const incDate = document.getElementById('custom-stamp-include-date').checked;

            viewerState.pendingStamp = {
                type: 'stamp',
                width: 220,
                height: 65,
                text: title.toUpperCase(),
                strokeColor: color,
                author: author,
                date: incDate ? new Date().toLocaleDateString() : ''
            };

            closeModal('modal-custom-stamp');
            showToast("Click on drawing to place custom stamp", "info");
        }

        // --- SIGNATURE ENGINE ---
        let sigPadCtx = null;
        let isSigning = false;
        let sigInkColor = '#000000';
        let sigTab = 'draw';

        function initSignaturePad() {
            const canvas = document.getElementById('signature-canvas');
            if (!canvas) return;
            sigPadCtx = canvas.getContext('2d');
            sigPadCtx.lineWidth = 2.5;
            sigPadCtx.lineCap = 'round';
            sigPadCtx.lineJoin = 'round';
            sigPadCtx.strokeStyle = sigInkColor;

            const getPos = (e) => {
                const rect = canvas.getBoundingClientRect();
                return {
                    x: (e.clientX || e.touches[0].clientX) - rect.left,
                    y: (e.clientY || e.touches[0].clientY) - rect.top
                };
            };

            canvas.addEventListener('mousedown', (e) => {
                isSigning = true;
                const pos = getPos(e);
                sigPadCtx.beginPath();
                sigPadCtx.moveTo(pos.x, pos.y);
            });

            canvas.addEventListener('mousemove', (e) => {
                if (!isSigning) return;
                const pos = getPos(e);
                sigPadCtx.lineTo(pos.x, pos.y);
                sigPadCtx.stroke();
            });

            const stopSign = () => { isSigning = false; };
            canvas.addEventListener('mouseup', stopSign);
            canvas.addEventListener('mouseleave', stopSign);
        }

        function clearSignatureCanvas() {
            const canvas = document.getElementById('signature-canvas');
            if (canvas && sigPadCtx) {
                sigPadCtx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        function setSigColor(color) {
            sigInkColor = color;
            if (sigPadCtx) sigPadCtx.strokeStyle = color;
        }

        function setSignatureTab(tab) {
            sigTab = tab;
            const drawTab = document.getElementById('sig-tab-draw');
            const typeTab = document.getElementById('sig-tab-type');
            const drawPanel = document.getElementById('sig-panel-draw');
            const typePanel = document.getElementById('sig-panel-type');

            if (drawTab) drawTab.className = tab === 'draw' ? 'pb-2 font-semibold text-brand-600 border-b-2 border-brand-600' : 'pb-2 font-medium text-slate-500 border-b-2 border-transparent';
            if (typeTab) typeTab.className = tab === 'type' ? 'pb-2 font-semibold text-brand-600 border-b-2 border-brand-600' : 'pb-2 font-medium text-slate-500 border-b-2 border-transparent';
            if (drawPanel) drawPanel.classList.toggle('hidden', tab !== 'draw');
            if (typePanel) typePanel.classList.toggle('hidden', tab !== 'type');
        }

        function updateTypedSigPreview(val) {
            const preview = document.getElementById('sig-type-preview');
            if (preview) preview.innerText = val || 'Your Signature';
        }

        function applySignature() {
            if (sigTab === 'draw') {
                const canvas = document.getElementById('signature-canvas');
                const dataUrl = canvas.toDataURL('image/png');
                viewerState.pendingSignature = {
                    width: 160,
                    height: 55,
                    dataUrl: dataUrl
                };
            } else {
                const name = document.getElementById('sig-type-input').value || 'Johnathan Doe';
                viewerState.pendingSignature = {
                    width: 170,
                    height: 50,
                    text: name
                };
            }
            closeModal('modal-signature');
            showToast("Click on drawing to place signature", "info");
        }

        function placeConfiguredSignature(pageIndex, x, y, sigData) {
            const markup = {
                id: 'markup_' + Date.now(),
                page: pageIndex,
                type: 'sign',
                x: x - sigData.width / 2,
                y: y - sigData.height / 2,
                width: sigData.width,
                height: sigData.height,
                dataUrl: sigData.dataUrl,
                text: sigData.text,
                author: 'Signer',
                date: new Date().toLocaleDateString(),
                subject: 'Digital Signature'
            };
            saveMarkup(markup);
            selectViewerMarkup(markup.id);
            showToast("Signature applied", "success");
        }

        // --- MARKUPS LIST & TAKEOFF EXPORT ---
        function updateMarkupsSidebarList() {
            const listEl = document.getElementById('viewer-markups-list');
            const countBadge = document.getElementById('markups-count-badge');
            if (!listEl) return;

            if (countBadge) countBadge.innerText = viewerState.markups.length;

            if (viewerState.markups.length === 0) {
                listEl.innerHTML = '<div class="p-4 text-center text-slate-400">No annotations or measurements yet.</div>';
                return;
            }

            listEl.innerHTML = '';
            viewerState.markups.forEach(m => {
                const row = document.createElement('div');
                row.className = `p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer flex items-center justify-between transition ${m.id === viewerState.selectedMarkupId ? 'bg-brand-50 dark:bg-brand-950/40 border-l-3 border-brand-500' : ''}`;
                row.onclick = () => {
                    goToViewerPage(m.page);
                    selectViewerMarkup(m.id);
                };

                const iconMap = {
                    'rect': 'fa-regular fa-square',
                    'circle': 'fa-regular fa-circle',
                    'line': 'fa-solid fa-minus',
                    'arrow': 'fa-solid fa-arrow-right',
                    'cloud': 'fa-solid fa-cloud text-red-500',
                    'pen': 'fa-solid fa-pen-nib',
                    'highlighter': 'fa-solid fa-highlighter text-amber-500',
                    'textbox': 'fa-solid fa-font text-blue-500',
                    'callout': 'fa-solid fa-comment-dots text-indigo-500',
                    'note': 'fa-solid fa-note-sticky text-amber-500',
                    'measure-length': 'fa-solid fa-ruler-horizontal text-emerald-600',
                    'measure-area': 'fa-solid fa-chart-area text-emerald-600',
                    'count': 'fa-solid fa-list-ol text-blue-600',
                    'stamp': 'fa-solid fa-stamp text-purple-600',
                    'sign': 'fa-solid fa-signature text-blue-900'
                };

                let detail = m.text || '';
                if (m.type === 'measure-length') {
                    const distPx = Math.hypot(m.width, m.height);
                    detail = formatRealWorldLength(distPx);
                } else if (m.type === 'measure-area') {
                    detail = formatRealWorldArea(m.width * m.height);
                } else if (m.type === 'count') {
                    detail = `#${m.count}`;
                }

                row.innerHTML = `
                    <div class="flex items-center gap-2 truncate">
                        <i class="${iconMap[m.type] || 'fa-solid fa-draw-polygon'} text-xs w-4"></i>
                        <div class="truncate">
                            <div class="font-medium text-slate-700 dark:text-slate-200 truncate capitalize">${m.subject || m.type}</div>
                            <div class="text-[10px] text-slate-400 truncate">${detail ? detail + ' • ' : ''}Pg ${m.page}</div>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); deleteMarkupById('${m.id}')" class="text-slate-400 hover:text-red-500 p-1">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                `;
                listEl.appendChild(row);
            });
        }

        function filterMarkupsList(query) {
            const listEl = document.getElementById('viewer-markups-list');
            if (!listEl) return;
            const rows = listEl.querySelectorAll('.markup-list-item');
            const q = (query || '').toLowerCase();
            // Simple filter
            viewerState.markups.forEach((m, idx) => {
                const match = m.type.toLowerCase().includes(q) || (m.text && m.text.toLowerCase().includes(q)) || (m.subject && m.subject.toLowerCase().includes(q));
                if (rows[idx]) rows[idx].style.display = match ? 'flex' : 'none';
            });
        }

        function exportMarkupsToCSV() {
            if (viewerState.markups.length === 0) {
                showToast("No markups to export", "warning");
                return;
            }

            let csv = "ID,Page,Type,Subject,Text/Value,Author,Date,Color\n";
            viewerState.markups.forEach(m => {
                let val = (m.text || '').replace(/"/g, '""');
                if (m.type === 'measure-length') val = formatRealWorldLength(Math.hypot(m.width, m.height));
                if (m.type === 'measure-area') val = formatRealWorldArea(m.width * m.height);
                if (m.type === 'count') val = `#${m.count}`;

                csv += `"${m.id}",${m.page},"${m.type}","${m.subject || ''}","${val}","${m.author || ''}","${m.date || ''}","${m.strokeColor || ''}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${(viewerState.fileName || 'markups').replace('.pdf', '')}_takeoff_summary.csv`;
            link.click();
            showToast("Exported Markups CSV spreadsheet", "success");
        }

        function exportMarkupsToJSON() {
            if (viewerState.markups.length === 0) {
                showToast("No markups to export", "warning");
                return;
            }
            const json = JSON.stringify(viewerState.markups, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${(viewerState.fileName || 'markups').replace('.pdf', '')}_annotations.json`;
            link.click();
            showToast("Exported Markups JSON data", "success");
        }

        // --- IN-DOCUMENT TEXT SEARCH ---
        async function executePdfSearch() {
            const query = document.getElementById('pdf-search-input').value.trim();
            const resultsList = document.getElementById('search-results-list');
            const countEl = document.getElementById('search-results-count');
            if (!query || !viewerState.pdfJsDoc) return;

            viewerState.searchResults = [];
            viewerState.searchIndex = -1;
            resultsList.innerHTML = '<div class="p-2 text-center text-slate-400">Searching...</div>';

            for (let i = 1; i <= viewerState.pageCount; i++) {
                const page = await viewerState.pdfJsDoc.getPage(i);
                const textContent = await page.getTextContent();
                const fullText = textContent.items.map(s => s.str).join(' ');

                let idx = fullText.toLowerCase().indexOf(query.toLowerCase());
                while (idx !== -1) {
                    const snippetStart = Math.max(0, idx - 25);
                    const snippetEnd = Math.min(fullText.length, idx + query.length + 25);
                    const snippet = fullText.substring(snippetStart, snippetEnd);
                    viewerState.searchResults.push({ page: i, snippet: snippet });
                    idx = fullText.toLowerCase().indexOf(query.toLowerCase(), idx + 1);
                }
            }

            countEl.innerText = `${viewerState.searchResults.length} matches`;
            resultsList.innerHTML = '';

            if (viewerState.searchResults.length === 0) {
                resultsList.innerHTML = '<div class="p-2 text-center text-slate-400">No matches found.</div>';
                return;
            }

            viewerState.searchResults.forEach((res, index) => {
                const item = document.createElement('div');
                item.className = 'p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-700 dark:text-slate-300';
                item.innerHTML = `<span class="font-bold text-brand-600">Pg ${res.page}:</span> ...${res.snippet}...`;
                item.onclick = () => {
                    viewerState.searchIndex = index;
                    goToViewerPage(res.page);
                };
                resultsList.appendChild(item);
            });
        }

        function navigateSearchResult(delta) {
            if (viewerState.searchResults.length === 0) return;
            viewerState.searchIndex = (viewerState.searchIndex + delta + viewerState.searchResults.length) % viewerState.searchResults.length;
            const res = viewerState.searchResults[viewerState.searchIndex];
            if (res) {
                goToViewerPage(res.page);
            }
        }

        // --- SAVE / EXPORT PDF WITH MARKUPS (PDF-LIB BURNING) ---
        async function saveModifiedPDF() {
            if (!viewerState.doc) {
                showToast("No active PDF to export. Load a PDF first.", "warning");
                return;
            }

            try {
                showToast("Burning vector markups into PDF...", "info");
                const pdfDoc = viewerState.doc;
                const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
                const regularFont = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

                // Iterate each page and draw markups
                for (let i = 1; i <= viewerState.pageCount; i++) {
                    const page = pdfDoc.getPage(i - 1);
                    const pageHeight = page.getHeight();
                    const pageMarkups = viewerState.markups.filter(m => m.page === i);

                    // Note: PDF coordinate system has (0, 0) at BOTTOM-LEFT
                    // Screen has (0, 0) at TOP-LEFT
                    // scale factor between screen zoom and PDF point size
                    const zoom = viewerState.zoom;

                    for (const m of pageMarkups) {
                        const pdfX = m.x / zoom;
                        const pdfY = (pageHeight - (m.y + m.height) / zoom);
                        const pdfW = m.width / zoom;
                        const pdfH = m.height / zoom;

                        const rgbStroke = parseColorToPdfRgb(m.strokeColor || '#0e87eb');
                        const rgbFill = (m.fillColor && m.fillColor !== 'transparent') ? parseColorToPdfRgb(m.fillColor) : undefined;

                        if (m.type === 'rect') {
                            page.drawRectangle({
                                x: pdfX,
                                y: pdfY,
                                width: pdfW,
                                height: pdfH,
                                borderWidth: (m.strokeWidth || 2) / zoom,
                                borderColor: rgbStroke,
                                color: rgbFill,
                                opacity: rgbFill ? (m.fillOpacity || 0.2) : undefined
                            });
                        } else if (m.type === 'circle') {
                            page.drawEllipse({
                                x: pdfX + pdfW / 2,
                                y: pdfY + pdfH / 2,
                                xScale: pdfW / 2,
                                yScale: pdfH / 2,
                                borderWidth: (m.strokeWidth || 2) / zoom,
                                borderColor: rgbStroke,
                                color: rgbFill,
                                opacity: rgbFill ? (m.fillOpacity || 0.2) : undefined
                            });
                        } else if (m.type === 'line' || m.type === 'measure-length') {
                            const x1 = m.x / zoom;
                            const y1 = pageHeight - (m.y / zoom);
                            const x2 = (m.x + m.width) / zoom;
                            const y2 = pageHeight - ((m.y + m.height) / zoom);
                            page.drawLine({
                                start: { x: x1, y: y1 },
                                end: { x: x2, y: y2 },
                                thickness: (m.strokeWidth || 2) / zoom,
                                color: rgbStroke
                            });

                            if (m.type === 'measure-length') {
                                const distPx = Math.hypot(m.width, m.height);
                                const dimStr = formatRealWorldLength(distPx);
                                page.drawText(dimStr, {
                                    x: (x1 + x2) / 2 - 20,
                                    y: (y1 + y2) / 2 + 5,
                                    size: 10,
                                    font: font,
                                    color: rgbStroke
                                });
                            }
                        } else if (m.type === 'cloud') {
                            // Draw bounding cloud rectangle as visual fallback in PDF
                            page.drawRectangle({
                                x: pdfX,
                                y: pdfY,
                                width: pdfW,
                                height: pdfH,
                                borderWidth: 2,
                                borderColor: PDFLib.rgb(0.86, 0.15, 0.15),
                                color: PDFLib.rgb(1, 0.9, 0.9),
                                opacity: 0.2
                            });
                        } else if (m.type === 'textbox' || m.type === 'callout') {
                            // Draw background box
                            page.drawRectangle({
                                x: pdfX,
                                y: pdfY,
                                width: pdfW,
                                height: pdfH,
                                borderWidth: 1,
                                borderColor: rgbStroke,
                                color: PDFLib.rgb(1, 1, 1),
                                opacity: 0.95
                            });
                            // Draw text
                            page.drawText(m.text || 'Annotation', {
                                x: pdfX + 6,
                                y: pdfY + pdfH - 14,
                                size: (m.fontSize || 11) / zoom,
                                font: regularFont,
                                color: PDFLib.rgb(0.1, 0.1, 0.1)
                            });
                        } else if (m.type === 'stamp') {
                            // Outer border
                            page.drawRectangle({
                                x: pdfX,
                                y: pdfY,
                                width: pdfW,
                                height: pdfH,
                                borderWidth: 2.5,
                                borderColor: rgbStroke,
                                color: PDFLib.rgb(1, 1, 1),
                                opacity: 0.9
                            });
                            // Text
                            page.drawText(m.text || 'APPROVED', {
                                x: pdfX + 15,
                                y: pdfY + pdfH - 24,
                                size: 14,
                                font: font,
                                color: rgbStroke
                            });
                            page.drawText(`BY: ${m.author || 'User'}  ${m.date || ''}`, {
                                x: pdfX + 15,
                                y: pdfY + 8,
                                size: 8,
                                font: regularFont,
                                color: rgbStroke
                            });
                        }
                    }
                }

                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                const originalName = viewerState.fileName || 'Document.pdf';
                link.download = originalName.replace('.pdf', '') + '_reviewed.pdf';
                link.click();
                showToast("Exported PDF with all markups burned successfully!", "success");
            } catch (err) {
                console.error("saveModifiedPDF Error:", err);
                showToast("Failed to save PDF: " + err.message, "error");
            }
        }

        function parseColorToPdfRgb(colorStr) {
            const rgb = parseColorToRgb(colorStr);
            return PDFLib.rgb(rgb.r / 255, rgb.g / 255, rgb.b / 255);
        }

        // --- GLOBAL INITIALIZATION & KEYBOARD SHORTCUTS ---
        function initApp() {
            initTheme();
            initSignaturePad();

            // Keyboard Shortcuts
            window.addEventListener('keydown', (e) => {
                // If focused in an input/textarea, do not trigger tool shortcuts
                if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                    return;
                }

                // Delete / Backspace: delete selected markup
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    if (viewerState.selectedMarkupId) {
                        e.preventDefault();
                        deleteSelectedMarkup();
                        showToast("Deleted markup", "info");
                    }
                }

                // Ctrl + Z: Undo
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) redoViewerAction();
                    else undoViewerAction();
                }

                // Ctrl + Y: Redo
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    redoViewerAction();
                }

                // Tool single-key shortcuts
                const key = e.key.toLowerCase();
                if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                    if (key === 'v') setActiveViewerTool('select');
                    else if (key === 'h') setActiveViewerTool('hand');
                    else if (key === 't') setActiveViewerTool('textbox');
                    else if (key === 'c') setActiveViewerTool('callout');
                    else if (key === 'n') setActiveViewerTool('note');
                    else if (key === 'p') setActiveViewerTool('pen');
                    else if (key === 'g') setActiveViewerTool('highlighter');
                    else if (key === 'e') setActiveViewerTool('eraser');
                    else if (key === 'r') setActiveViewerTool('rect');
                    else if (key === 'o') setActiveViewerTool('circle');
                    else if (key === 'k') setActiveViewerTool('cloud');
                    else if (key === 'd') setActiveViewerTool('measure-length');
                    else if (key === 's') setActiveViewerTool('measure-area');
                    else if (key === 'escape') {
                        deselectViewerMarkup();
                        setActiveViewerTool('select');
                    }
                }

                // Arrow keys: nudge selected markup
                if (viewerState.selectedMarkupId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    const markup = viewerState.markups.find(m => m.id === viewerState.selectedMarkupId);
                    if (markup) {
                        const step = e.shiftKey ? 10 : 1;
                        if (e.key === 'ArrowUp') markup.y -= step;
                        if (e.key === 'ArrowDown') markup.y += step;
                        if (e.key === 'ArrowLeft') markup.x -= step;
                        if (e.key === 'ArrowRight') markup.x += step;
                        renderPageMarkups(markup.page);
                        pushUndoState();
                    }
                }
            });

            // Ctrl + Mouse Wheel for Viewport Zoom
            const vp = document.getElementById('viewer-viewport');
            if (vp) {
                vp.addEventListener('wheel', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (e.deltaY < 0) zoomViewerIn();
                        else zoomViewerOut();
                    }
                }, { passive: false });
            }

            // Default to Viewer mode on startup
            switchAppMode('viewer');
        }

        // Launch initialization on DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
