        pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

        const state = {
            pdf1: { file: null, doc: null, pageCount: 0, name: '', color: '#ef4444' },
            pdf2: { file: null, doc: null, pageCount: 0, name: '', color: '#10b981' },
            color1: '#ef4444',
            color2: '#10b981',
            markupRecolorMode: 'solid',
            renderQuality: 'balanced',
            viewMode: 'overlay',
            blendMode: 'multiply',
            opacity: 1.0,
            nudgeX: 0,
            nudgeY: 0,
            nudgeStep: 1,
            layer1Visible: true,
            layer2Visible: true,
            blinkState: 1,
            blinkInterval: null,
            results: [], 
            currentPage: 0,
            alignMode: 'center',
            includeMarkups: 1,
            transformMatrix: null
        };

        // Toolbox / Page Manager State
        const toolboxState = {
            file: null,
            pdfDoc: null,
            pdfJsDoc: null,
            pageCount: 0,
            selectedPages: new Set(),
            activePreviewPage: 0
        };

        const toolboxPreviewState = {
            zoom: 1.0, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0
        };

        // Binder State (Feature 02)
        const binderState = {
            items: [] // array of { id, file, pdfDoc, pdfJsDoc, name, size, pageCount, pageRange, rotation, thumbUrl }
        };

        const wizState = { 
            step: 1, pts1: [], pts2: [], c1: null, c2: null, 
            zoom: 1.0, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0, dragDist: 0
        };

        const previewState = {
            zoom: 1.0, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0
        };

        const viewSetup = document.getElementById('view-setup');
        const viewWizard = document.getElementById('view-wizard');
        const viewProcessing = document.getElementById('view-processing');
        const viewResults = document.getElementById('view-results');
        const wizCanvas = document.getElementById('wizard-canvas');
        const previewCanvas = document.getElementById('preview-canvas');

        // Responsive navigation helpers
        function toggleMobileModeMenu() {
            const menu = document.getElementById('mobile-mode-menu');
            if (menu) menu.classList.toggle('hidden');
        }
        function closeMobileModeMenu() {
            const menu = document.getElementById('mobile-mode-menu');
            if (menu) menu.classList.add('hidden');
        }
        function switchMobileMode(mode) {
            switchAppMode(mode);
            closeMobileModeMenu();
            window.scrollTo({top: 0, behavior: 'smooth'});
        }

        function switchAppMode(mode) {
            const btnViewer = document.getElementById('nav-mode-viewer');
            const btnCompare = document.getElementById('nav-mode-compare');
            const btnToolbox = document.getElementById('nav-mode-toolbox');
            const btnBinder = document.getElementById('nav-mode-binder');

            const boxViewer = document.getElementById('mode-container-viewer');
            const boxCompare = document.getElementById('mode-container-compare');
            const boxToolbox = document.getElementById('mode-container-toolbox');
            const boxBinder = document.getElementById('mode-container-binder');

            if (btnViewer) btnViewer.className = mode === 'viewer' ? 'nav-tab-btn active' : 'nav-tab-btn';
            if (btnCompare) btnCompare.className = mode === 'compare' ? 'nav-tab-btn active' : 'nav-tab-btn';
            if (btnToolbox) btnToolbox.className = mode === 'toolbox' ? 'nav-tab-btn active' : 'nav-tab-btn';
            if (btnBinder) btnBinder.className = mode === 'binder' ? 'nav-tab-btn active' : 'nav-tab-btn';

            if (boxViewer) boxViewer.classList.toggle('hidden', mode !== 'viewer');
            if (boxCompare) boxCompare.classList.toggle('hidden', mode !== 'compare');
            if (boxToolbox) boxToolbox.classList.toggle('hidden', mode !== 'toolbox');
            if (boxBinder) boxBinder.classList.toggle('hidden', mode !== 'binder');

            if (mode === 'toolbox' && toolboxState.pdfJsDoc) {
                setTimeout(() => resetToolboxPreviewTransform(), 50);
            }
            if (mode === 'compare') {
                setTimeout(() => {
                    const vRes = document.getElementById('view-results');
                    const vWiz = document.getElementById('view-wizard');
                    if (vRes && !vRes.classList.contains('hidden')) {
                        resetPreviewTransform();
                    } else if (vWiz && !vWiz.classList.contains('hidden') && wizState.c1) {
                        resetWizardTransform();
                    }
                }, 50);
            }
        }

        window.addEventListener('resize', () => {
            const boxCompare = document.getElementById('mode-container-compare');
            const boxToolbox = document.getElementById('mode-container-toolbox');
            if (boxCompare && !boxCompare.classList.contains('hidden')) {
                const vRes = document.getElementById('view-results');
                const vWiz = document.getElementById('view-wizard');
                if (vRes && !vRes.classList.contains('hidden')) {
                    resetPreviewTransform();
                } else if (vWiz && !vWiz.classList.contains('hidden') && wizState.c1) {
                    resetWizardTransform();
                }
            }
            if (boxToolbox && !boxToolbox.classList.contains('hidden') && toolboxState.pdfJsDoc) {
                resetToolboxPreviewTransform();
            }
        });

        // Color Management Helpers
        function parseColorToRgb(colorStr) {
            if (!colorStr) return { r: 239, g: 68, b: 68 };
            if (colorStr.startsWith('#')) {
                let hex = colorStr.slice(1);
                if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
                const num = parseInt(hex, 16);
                return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
            }
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (match) {
                return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
            }
            return { r: 239, g: 68, b: 68 };
        }

        function updateDocColor(docKey, hex) {
            if (docKey === 'pdf1') {
                state.color1 = hex;
                state.pdf1.color = hex;
                const lbl = document.getElementById('color-label-1');
                const txt = document.getElementById('color-text-1');
                const dot = document.getElementById('legend-dot-1');
                if (lbl) lbl.innerText = hex.toUpperCase();
                if (txt) txt.innerText = hex.toUpperCase();
                if (dot) dot.style.backgroundColor = hex;
            } else {
                state.color2 = hex;
                state.pdf2.color = hex;
                const lbl = document.getElementById('color-label-2');
                const txt = document.getElementById('color-text-2');
                const dot = document.getElementById('legend-dot-2');
                if (lbl) lbl.innerText = hex.toUpperCase();
                if (txt) txt.innerText = hex.toUpperCase();
                if (dot) dot.style.backgroundColor = hex;
            }
        }

        function applyColorPreset(c1, c2) {
            document.getElementById('color-picker-1').value = c1;
            document.getElementById('color-picker-2').value = c2;
            updateDocColor('pdf1', c1);
            updateDocColor('pdf2', c2);
        }

        function swapDocuments() {
            const temp = state.pdf1;
            state.pdf1 = state.pdf2;
            state.pdf2 = temp;

            const tempColor = state.color1;
            state.color1 = state.color2;
            state.color2 = tempColor;

            // Update UI 1
            if (state.pdf1.file) {
                document.getElementById('ui-empty-1').classList.add('hidden');
                document.getElementById('ui-filled-1').classList.remove('hidden');
                document.getElementById('filename-1').innerText = state.pdf1.name;
                document.getElementById('filesize-1').innerText = state.pdf1.size + ' MB';
                document.getElementById('filepages-1').innerText = state.pdf1.pageCount;
            } else {
                document.getElementById('ui-empty-1').classList.remove('hidden');
                document.getElementById('ui-filled-1').classList.add('hidden');
            }

            // Update UI 2
            if (state.pdf2.file) {
                document.getElementById('ui-empty-2').classList.add('hidden');
                document.getElementById('ui-filled-2').classList.remove('hidden');
                document.getElementById('filename-2').innerText = state.pdf2.name;
                document.getElementById('filesize-2').innerText = state.pdf2.size + ' MB';
                document.getElementById('filepages-2').innerText = state.pdf2.pageCount;
            } else {
                document.getElementById('ui-empty-2').classList.remove('hidden');
                document.getElementById('ui-filled-2').classList.add('hidden');
            }

            document.getElementById('color-picker-1').value = state.color1;
            document.getElementById('color-picker-2').value = state.color2;
            updateDocColor('pdf1', state.color1);
            updateDocColor('pdf2', state.color2);
        }

        // Safe Dynamic Resolution Calculation (Prevents Large PDF Browser Crashes & Blank Canvases)
        function getSafeRenderScale(page, quality = 'balanced') {
            const defaultVp = page.getViewport({ scale: 1.0 });
            const maxDim = Math.max(defaultVp.width, defaultVp.height);
            
            let maxCanvasDim = 2400; // Balanced: safe for Arch D/E 24x36 / 36x48 sheets
            if (quality === 'performance') maxCanvasDim = 1600;
            if (quality === 'high') maxCanvasDim = 2800;
            if (quality === 'ultra') maxCanvasDim = 3400;

            let targetScale = 2.0; // 2x gives 144 DPI on standard 72 DPI PDF
            if (maxDim * targetScale > maxCanvasDim) {
                targetScale = maxCanvasDim / maxDim;
            }
            return Math.max(0.65, Math.min(targetScale, 2.5));
        }

        // Architectural & Engineering Sheet Size Formatter
        function formatSheetDimensions(widthPt, heightPt) {
            const wIn = (widthPt / 72).toFixed(1);
            const hIn = (heightPt / 72).toFixed(1);
            const wMm = Math.round(widthPt * 0.352778);
            const hMm = Math.round(heightPt * 0.352778);
            
            const minD = Math.min(widthPt, heightPt);
            const maxD = Math.max(widthPt, heightPt);
            let name = '';
            if (Math.abs(minD - 612) < 20 && Math.abs(maxD - 792) < 20) name = 'Letter';
            else if (Math.abs(minD - 595.28) < 20 && Math.abs(maxD - 841.89) < 20) name = 'A4';
            else if (Math.abs(minD - 792) < 25 && Math.abs(maxD - 1224) < 25) name = 'Tabloid (11Ã—17")';
            else if (Math.abs(minD - 841.89) < 25 && Math.abs(maxD - 1190.55) < 25) name = 'A3';
            else if (Math.abs(minD - 1296) < 35 && Math.abs(maxD - 1728) < 35) name = 'Arch C (18Ã—24")';
            else if (Math.abs(minD - 1728) < 40 && Math.abs(maxD - 2592) < 40) name = 'Arch D (24Ã—36")';
            else if (Math.abs(minD - 2592) < 50 && Math.abs(maxD - 3456) < 50) name = 'Arch E (36Ã—48")';
            else if (Math.abs(minD - 1683.78) < 40 && Math.abs(maxD - 2383.94) < 40) name = 'A1';
            else if (Math.abs(minD - 2383.94) < 50 && Math.abs(maxD - 3370.39) < 50) name = 'A0';

            return `${wIn}" Ã— ${hIn}" (${wMm} Ã— ${hMm} mm)${name ? ' â€¢ ' + name : ''}`;
        }

        function setupDropzone(id, fileKey) {
            const dropzone = document.getElementById(`dropzone-${id}`);
            const input = document.getElementById(`file-${id}`);
            
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault(); dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0], id, fileKey);
            });
            input.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0], id, fileKey);
            });
        }

        async function handleFileSelect(file, id, fileKey) {
            if (file.type !== 'application/pdf') { showError("Invalid File", "Please upload a valid PDF document."); return; }
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                
                state[fileKey] = { 
                    file: file, 
                    doc: pdf, 
                    pageCount: pdf.numPages, 
                    name: file.name, 
                    size: (file.size / (1024 * 1024)).toFixed(2),
                    color: fileKey === 'pdf1' ? state.color1 : state.color2
                };

                document.getElementById(`ui-empty-${id}`).classList.add('hidden');
                document.getElementById(`ui-filled-${id}`).classList.remove('hidden');
                document.getElementById(`filename-${id}`).innerText = state[fileKey].name;
                document.getElementById(`filesize-${id}`).innerText = state[fileKey].size + ' MB';
                document.getElementById(`filepages-${id}`).innerText = state[fileKey].pageCount;
            } catch (err) {
                showError("Corrupted or Protected PDF", "We couldn't read this PDF: " + err.message);
                document.getElementById(`file-${id}`).value = ""; 
            }
        }

        setupDropzone('1', 'pdf1');
        setupDropzone('2', 'pdf2');

        function parsePageRange(str, max) {
            if(!str || !str.trim()) return Array.from({length: max}, (_, i) => i + 1);
            const pages = [];
            str.split(',').forEach(part => {
                const range = part.trim();
                if(range.includes('-')) {
                    const [s, e] = range.split('-').map(Number);
                    if(s && e && s <= e) { for(let i=s; i<=e; i++) pages.push(i); }
                } else {
                    const p = Number(range);
                    if(p) pages.push(p);
                }
            });
            const result = pages.filter(p => p >= 1 && p <= max);
            return result.length > 0 ? result : Array.from({length: max}, (_, i) => i + 1);
        }

        function initiateComparison() {
            if (!state.pdf1.doc || !state.pdf2.doc) {
                showError("Two PDFs Required", "Please upload both the original and revision PDFs before starting comparison.");
                return;
            }
            state.alignMode = document.getElementById('setting-align').value;
            const markupsEl = document.getElementById('setting-markups');
            if (markupsEl) state.includeMarkups = markupsEl.checked ? 1 : 0;
            state.markupRecolorMode = document.getElementById('setting-markup-mode').value;
            state.renderQuality = document.getElementById('setting-render-quality').value;
            state.transformMatrix = null;
            state.nudgeX = 0;
            state.nudgeY = 0;
            state.layer1Visible = true;
            state.layer2Visible = true;
            state.viewMode = 'overlay';

            if (state.alignMode === '3point') {
                start3PointWizard();
            } else {
                runComparison();
            }
        }

        async function start3PointWizard() {
            viewSetup.classList.add('hidden');
            viewWizard.classList.remove('hidden');
            viewWizard.classList.add('flex');
            
            wizState.step = 1; wizState.pts1 = []; wizState.pts2 = [];
            
            const p1 = parsePageRange(document.getElementById('setting-range-1').value, state.pdf1.pageCount)[0] || 1;
            const p2 = parsePageRange(document.getElementById('setting-range-2').value, state.pdf2.pageCount)[0] || 1;

            document.getElementById('wiz-title').innerHTML = "<span class='text-red-400'>Step 1/2: Original Document</span>";
            document.getElementById('wiz-desc').innerText = "Click 3 distinct reference points on the drawing. Drag to pan.";
            
            wizState.c1 = await renderPDFPageWithColor(state.pdf1.doc, p1, null, state.color1, state.includeMarkups, state.markupRecolorMode);
            wizState.c2 = await renderPDFPageWithColor(state.pdf2.doc, p2, null, state.color2, state.includeMarkups, state.markupRecolorMode);
            
            resetWizardTransform();
        }

        function resetWizardTransform() {
            const container = document.getElementById('wizard-container');
            wizState.zoom = Math.min((container.clientWidth - 40) / wizState.c1.width, (container.clientHeight - 40) / wizState.c1.height);
            wizState.panX = (container.clientWidth - wizState.c1.width * wizState.zoom) / 2;
            wizState.panY = (container.clientHeight - wizState.c1.height * wizState.zoom) / 2;
            drawWizardCanvas();
        }

        function adjustWizardZoom(factor, centerX, centerY) {
            const container = document.getElementById('wizard-container');
            const oldZoom = wizState.zoom;
            wizState.zoom = Math.max(0.05, Math.min(wizState.zoom * factor, 15.0));
            
            if (centerX !== undefined && centerY !== undefined) {
                wizState.panX = centerX - (centerX - wizState.panX) * (wizState.zoom / oldZoom);
                wizState.panY = centerY - (centerY - wizState.panY) * (wizState.zoom / oldZoom);
            } else {
                wizState.panX = (container.clientWidth - wizState.c1.width * wizState.zoom) / 2;
                wizState.panY = (container.clientHeight - wizState.c1.height * wizState.zoom) / 2;
            }
            drawWizardCanvas();
        }

        function panWizard(dir, step = 60) {
            if (dir === 'up') wizState.panY += step;
            if (dir === 'down') wizState.panY -= step;
            if (dir === 'left') wizState.panX += step;
            if (dir === 'right') wizState.panX -= step;
            drawWizardCanvas();
        }

        function drawWizardCanvas() {
            let img = wizState.step === 1 ? wizState.c1 : wizState.c2;
            wizCanvas.width = img.width;
            wizCanvas.height = img.height;
            const ctx = wizCanvas.getContext('2d');
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, wizCanvas.width, wizCanvas.height);
            ctx.drawImage(img, 0, 0);
            
            let pts = wizState.step === 1 ? wizState.pts1 : wizState.pts2;
            pts.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 14 / wizState.zoom, 0, Math.PI * 2);
                ctx.strokeStyle = '#0284c7';
                ctx.lineWidth = 4 / wizState.zoom;
                ctx.stroke();
                
                ctx.fillStyle = '#0284c7';
                ctx.font = `bold ${Math.max(16, 20 / wizState.zoom)}px Arial`;
                ctx.fillText(i + 1, p.x + (18 / wizState.zoom), p.y + (18 / wizState.zoom));
            });

            wizCanvas.style.width = (wizCanvas.width * wizState.zoom) + 'px';
            wizCanvas.style.height = (wizCanvas.height * wizState.zoom) + 'px';
            wizCanvas.style.transform = `translate(${wizState.panX}px, ${wizState.panY}px)`;
        }

        const wizContainer = document.getElementById('wizard-container');
        const previewContainer = document.getElementById('canvas-wrapper');
        const toolboxCanvasWrapper = document.getElementById('toolbox-canvas-wrapper');

        wizContainer.addEventListener('mousedown', (e) => {
            if(e.button === 0 || e.button === 1) { 
                if (e.button === 1) e.preventDefault();
                wizState.isDragging = true;
                wizState.dragDist = 0;
                wizState.startX = e.clientX - wizState.panX;
                wizState.startY = e.clientY - wizState.panY;
            }
        });

        previewContainer.addEventListener('mousedown', (e) => {
            if(e.button === 0 || e.button === 1) { 
                if (e.button === 1) e.preventDefault();
                previewState.isDragging = true;
                previewState.startX = e.clientX - previewState.panX;
                previewState.startY = e.clientY - previewState.panY;
            }
        });

        previewContainer.addEventListener('mousemove', (e) => {
            if (state.results.length === 0) return;
            const rect = previewCanvas.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                const scaleX = previewCanvas.width / rect.width;
                const scaleY = previewCanvas.height / rect.height;
                const canvasX = Math.round((e.clientX - rect.left) * scaleX);
                const canvasY = Math.round((e.clientY - rect.top) * scaleY);
                const pageData = state.results[state.currentPage];
                const ptX = pageData && pageData.ptWidth ? Math.round(canvasX * (pageData.ptWidth / pageData.width)) : canvasX;
                const ptY = pageData && pageData.ptHeight ? Math.round(canvasY * (pageData.ptHeight / pageData.height)) : canvasY;
                const hud = document.getElementById('ui-coord-hud');
                if (hud) hud.innerText = `X: ${ptX} pt â€¢ Y: ${ptY} pt`;
            }
        });

        toolboxCanvasWrapper.addEventListener('mousedown', (e) => {
            if(e.button === 0 || e.button === 1) { 
                if (e.button === 1) e.preventDefault();
                toolboxPreviewState.isDragging = true;
                toolboxPreviewState.startX = e.clientX - toolboxPreviewState.panX;
                toolboxPreviewState.startY = e.clientY - toolboxPreviewState.panY;
            }
        });

        window.addEventListener('auxclick', (e) => {
            if (e.button === 1) e.preventDefault();
        });

        function setupPanEvents() {
            window.addEventListener('mousemove', (e) => {
                if(wizState.isDragging && !viewWizard.classList.contains('hidden')) {
                    wizState.dragDist += Math.abs(e.movementX) + Math.abs(e.movementY);
                    wizState.panX = e.clientX - wizState.startX;
                    wizState.panY = e.clientY - wizState.startY;
                    wizCanvas.style.transform = `translate(${wizState.panX}px, ${wizState.panY}px)`;
                } else if(previewState.isDragging && !viewResults.classList.contains('hidden')) {
                    previewState.panX = e.clientX - previewState.startX;
                    previewState.panY = e.clientY - previewState.startY;
                    applyPreviewTransform();
                } else if(toolboxPreviewState.isDragging && !document.getElementById('toolbox-workspace').classList.contains('hidden')) {
                    toolboxPreviewState.panX = e.clientX - toolboxPreviewState.startX;
                    toolboxPreviewState.panY = e.clientY - toolboxPreviewState.startY;
                    applyToolboxPreviewTransform();
                }
            });

            window.addEventListener('mouseup', () => {
                wizState.isDragging = false;
                previewState.isDragging = false;
                toolboxPreviewState.isDragging = false;
            });

            let touchDist = 0;
            
            previewContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    previewState.isDragging = true;
                    previewState.startX = e.touches[0].clientX - previewState.panX;
                    previewState.startY = e.touches[0].clientY - previewState.panY;
                } else if (e.touches.length === 2) {
                    previewState.isDragging = false;
                    touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                }
            }, { passive: true });

            previewContainer.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1 && previewState.isDragging) {
                    previewState.panX = e.touches[0].clientX - previewState.startX;
                    previewState.panY = e.touches[0].clientY - previewState.startY;
                    applyPreviewTransform();
                } else if (e.touches.length === 2) {
                    const newDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                    if (touchDist > 0) {
                        const factor = newDist / touchDist;
                        adjustPreviewZoom(factor);
                        touchDist = newDist;
                    }
                }
            }, { passive: true });

            previewContainer.addEventListener('touchend', () => {
                previewState.isDragging = false;
                touchDist = 0;
            });
        }
        setupPanEvents();

        wizContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = wizContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : 0.85; 
            adjustWizardZoom(factor, mouseX, mouseY);
        }, { passive: false });

        previewContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = previewContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : 0.85; 
            adjustPreviewZoom(factor, mouseX, mouseY);
        }, { passive: false });

        toolboxCanvasWrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = toolboxCanvasWrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.15 : 0.85; 
            adjustToolboxPreviewZoom(factor, mouseX, mouseY);
        }, { passive: false });

        wizCanvas.addEventListener('click', (e) => {
            if (wizState.dragDist > 5) return; 
            const rect = wizCanvas.getBoundingClientRect();
            const scaleX = wizCanvas.width / rect.width;
            const scaleY = wizCanvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            if(wizState.step === 1 && wizState.pts1.length < 3) {
                wizState.pts1.push({x, y});
                drawWizardCanvas();
                if(wizState.pts1.length === 3) {
                    setTimeout(() => {
                        wizState.step = 2;
                        document.getElementById('wiz-title').innerHTML = "<span class='text-emerald-400'>Step 2/2: New Document</span>";
                        document.getElementById('wiz-desc').innerText = "Click the EXACT SAME 3 points in the same order on the new document.";
                        resetWizardTransform();
                    }, 400);
                }
            } else if(wizState.step === 2 && wizState.pts2.length < 3) {
                wizState.pts2.push({x, y});
                drawWizardCanvas();
                if(wizState.pts2.length === 3) {
                    setTimeout(() => {
                        state.transformMatrix = calculateAffineMatrix(wizState.pts2, wizState.pts1);
                        if(!state.transformMatrix) {
                            showError("Alignment Failed", "Points selected were collinear or invalid. Resetting to Center alignment.");
                            state.alignMode = 'center';
                        }
                        viewWizard.classList.add('hidden');
                        viewWizard.classList.remove('flex');
                        runComparison();
                    }, 400);
                }
            }
        });

        function calculateAffineMatrix(srcPts, dstPts) {
            let x1 = srcPts[0].x, y1 = srcPts[0].y; let u1 = dstPts[0].x, v1 = dstPts[0].y;
            let x2 = srcPts[1].x, y2 = srcPts[1].y; let u2 = dstPts[1].x, v2 = dstPts[1].y;
            let x3 = srcPts[2].x, y3 = srcPts[2].y; let u3 = dstPts[2].x, v3 = dstPts[2].y;
            let det = x1*(y2 - y3) - y1*(x2 - x3) + (x2*y3 - x3*y2);
            if (Math.abs(det) < 0.001) return null;

            let a = (u1*(y2 - y3) - u2*(y1 - y3) + u3*(y1 - y2)) / det;
            let b = -(u1*(x2 - x3) - u2*(x1 - x3) + u3*(x1 - x2)) / det;
            let c = (u1*(x2*y3 - x3*y2) - u2*(x1*y3 - x3*y1) + u3*(x1*y2 - x2*y1)) / det;

            let d = (v1*(y2 - y3) - v2*(y1 - y3) + v3*(y1 - y2)) / det;
            let e = -(v1*(x2 - x3) - v2*(x1 - x3) + v3*(x1 - x2)) / det;
            let f = (v1*(x2*y3 - x3*y2) - v2*(x1*y3 - x3*y1) + v3*(x1*y2 - x2*y1)) / det;

            return [a, d, b, e, c, f];
        }

        // ==================== REVOLUTIONARY UNIFIED RECOLORING ENGINE ====================
        async function renderPDFPageWithColor(pdfDoc, pageNum, reqScale, cssColor, annMode, markupRecolorMode = 'solid') {
            const page = await pdfDoc.getPage(pageNum);
            try {
                const vp1 = page.getViewport({ scale: 1.0 });
                const scale = reqScale || getSafeRenderScale(page, state.renderQuality);
                const viewport = page.getViewport({ scale: scale });
                
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(viewport.width);
                canvas.height = Math.round(viewport.height);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                // Pure white canvas background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Render page with PDF.js
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport,
                    annotationMode: annMode ? 1 : 0
                }).promise;

                // TRUE UNIFIED COLORIZATION (Bluebeam Revu style)
                // All vectors, texts, CAD lines, markups, comments, and annotations are unified into target color!
                const targetRgb = parseColorToRgb(cssColor);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                const len = data.length;
                const tr = targetRgb.r;
                const tg = targetRgb.g;
                const tb = targetRgb.b;

                const isSolid = markupRecolorMode === 'solid';

                for (let i = 0; i < len; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    // Pure background (white or near-white or transparent) stays pure white
                    if (a === 0 || (r >= 250 && g >= 250 && b >= 250)) {
                        data[i] = 255;
                        data[i + 1] = 255;
                        data[i + 2] = 255;
                        data[i + 3] = 255;
                        continue;
                    }

                    // Perceptual luminance calculation (ITU-R BT.601)
                    const lum = (299 * r + 587 * g + 114 * b) / 1000;
                    // Darkness: 0.0 (white background) to 1.0 (ink / annotation / line)
                    let darkness = (1.0 - (lum / 255)) * (a / 255);

                    if (isSolid) {
                        // High contrast CAD mode: boost darkness so annotations and fine lines are crisp and bold
                        if (darkness > 0.08) {
                            darkness = Math.min(1.0, darkness * 1.35 + 0.15);
                        }
                    }

                    // Map ALL content strictly to Target Color
                    data[i] = Math.round(255 - darkness * (255 - tr));
                    data[i + 1] = Math.round(255 - darkness * (255 - tg));
                    data[i + 2] = Math.round(255 - darkness * (255 - tb));
                    data[i + 3] = 255; // Solid opaque layer for crisp Multiply blend
                }

                ctx.putImageData(imgData, 0, 0);

                // Store sheet metadata
                canvas.ptWidth = vp1.width;
                canvas.ptHeight = vp1.height;
                canvas.renderScale = scale;

                return canvas;
            } finally {
                // Free PDF.js memory immediately!
                if (page && typeof page.cleanup === 'function') {
                    page.cleanup();
                }
            }
        }

        async function runComparison() {
            viewSetup.classList.add('hidden');
            viewProcessing.classList.remove('hidden');
            viewProcessing.classList.add('flex');

            // Clean up previous results to free canvas GPU memory immediately!
            if (state.results && state.results.length > 0) {
                state.results.forEach(res => {
                    if (res.c1) { res.c1.width = 0; res.c1.height = 0; }
                    if (res.c2) { res.c2.width = 0; res.c2.height = 0; }
                });
            }
            state.results = [];

            const p1 = parsePageRange(document.getElementById('setting-range-1').value, state.pdf1.pageCount);
            const p2 = parsePageRange(document.getElementById('setting-range-2').value, state.pdf2.pageCount);
            const maxPages = Math.max(p1.length, p2.length);

            try {
                for (let i = 0; i < maxPages; i++) {
                    updateProgress(i + 1, maxPages, `Rendering page ${i + 1} of ${maxPages}... Unified colorizing markups...`);
                    await new Promise(r => setTimeout(r, 20));

                    let canvas1 = null, canvas2 = null;

                    if (i < p1.length) {
                        canvas1 = await renderPDFPageWithColor(
                            state.pdf1.doc, 
                            p1[i], 
                            null, // safe auto-scale
                            state.color1, 
                            state.includeMarkups, 
                            state.markupRecolorMode
                        );
                    }
                    if (i < p2.length) {
                        canvas2 = await renderPDFPageWithColor(
                            state.pdf2.doc, 
                            p2[i], 
                            null, // safe auto-scale
                            state.color2, 
                            state.includeMarkups, 
                            state.markupRecolorMode
                        );
                    }

                    let w = 0, h = 0;
                    let ptW = 0, ptH = 0;
                    if (state.alignMode === '3point' && canvas1) {
                        w = canvas1.width; h = canvas1.height;
                        ptW = canvas1.ptWidth; ptH = canvas1.ptHeight;
                    } else {
                        w = Math.max(canvas1 ? canvas1.width : 0, canvas2 ? canvas2.width : 0);
                        h = Math.max(canvas1 ? canvas1.height : 0, canvas2 ? canvas2.height : 0);
                        ptW = Math.max(canvas1 ? canvas1.ptWidth : 0, canvas2 ? canvas2.ptWidth : 0);
                        ptH = Math.max(canvas1 ? canvas1.ptHeight : 0, canvas2 ? canvas2.ptHeight : 0);
                    }

                    state.results.push({
                        c1: canvas1,
                        c2: canvas2,
                        width: w,
                        height: h,
                        ptWidth: ptW,
                        ptHeight: ptH,
                        p1Num: i < p1.length ? p1[i] : null,
                        p2Num: i < p2.length ? p2[i] : null
                    });
                }
                finishComparison();
            } catch (err) {
                console.error(err);
                showError("Processing Failure", "An error occurred while comparing pages: " + err.message);
                resetApp();
            }
        }

        function updateProgress(current, total, message) {
            const pct = Math.round((current / total) * 100);
            document.getElementById('process-bar').style.width = pct + '%';
            document.getElementById('process-pct').innerText = pct;
            document.getElementById('process-status').innerText = message;
        }

        function finishComparison() {
            viewProcessing.classList.add('hidden');
            viewProcessing.classList.remove('flex');
            viewResults.classList.remove('hidden');
            viewResults.classList.add('flex');
            
            state.currentPage = 0;
            renderFilmstrip();
            renderPreviewCanvas();
            resetPreviewTransform();
        }

        // Bottom Filmstrip Carousel
        function renderFilmstrip() {
            const filmstrip = document.getElementById('results-filmstrip');
            if (!filmstrip) return;
            filmstrip.innerHTML = '';

            state.results.forEach((pageData, idx) => {
                const card = document.createElement('div');
                card.className = `filmstrip-card ${idx === state.currentPage ? 'active' : ''}`;
                card.title = `Switch to Page ${idx + 1}`;
                card.onclick = () => switchComparedPage(idx);

                const icon = document.createElement('i');
                icon.className = 'fa-regular fa-file-pdf text-lg mb-1';
                const label = document.createElement('span');
                label.innerText = `P. ${idx + 1}`;

                card.appendChild(icon);
                card.appendChild(label);
                filmstrip.appendChild(card);
            });
        }

        function switchComparedPage(idx) {
            if (idx >= 0 && idx < state.results.length) {
                state.currentPage = idx;
                renderFilmstrip();
                renderPreviewCanvas();
                resetPreviewTransform();
            }
        }

        // View Mode Controls
        function setViewMode(mode) {
            state.viewMode = mode;
            if (state.blinkInterval) {
                clearInterval(state.blinkInterval);
                state.blinkInterval = null;
            }

            // Update UI buttons
            const modes = ['overlay', 'diff', 'split', 'blink', 'doc1', 'doc2'];
            modes.forEach(m => {
                const btn = document.getElementById(`btn-mode-${m}`);
                if (btn) btn.classList.remove('active');
            });
            const activeBtn = document.getElementById(`btn-mode-${mode === 'difference' ? 'diff' : mode}`);
            if (activeBtn) activeBtn.classList.add('active');

            renderPreviewCanvas();
        }

        function toggleBlink() {
            if (state.viewMode === 'blink') {
                // Toggle between 1 and 2
                state.blinkState = state.blinkState === 1 ? 2 : 1;
            } else {
                setViewMode('blink');
                state.blinkState = 2;
            }
            renderPreviewCanvas();
        }

        function toggleLayerVisibility(layerNum) {
            if (layerNum === 1) {
                state.layer1Visible = !state.layer1Visible;
                const eye = document.getElementById('layer-eye-1');
                if (eye) eye.innerHTML = state.layer1Visible ? '<i class="fa-solid fa-eye text-xs"></i>' : '<i class="fa-solid fa-eye-slash text-xs text-slate-500"></i>';
            } else {
                state.layer2Visible = !state.layer2Visible;
                const eye = document.getElementById('layer-eye-2');
                if (eye) eye.innerHTML = state.layer2Visible ? '<i class="fa-solid fa-eye text-xs"></i>' : '<i class="fa-solid fa-eye-slash text-xs text-slate-500"></i>';
            }
            renderPreviewCanvas();
        }

        // Nudge Controls
        function setNudgeStep(step) {
            state.nudgeStep = step;
            [1, 5, 20].forEach(s => {
                const btn = document.getElementById(`step-${s}`);
                if (btn) {
                    if (s === step) {
                        btn.className = 'px-1.5 py-0.5 rounded bg-sky-600 text-white font-bold text-[10px]';
                    } else {
                        btn.className = 'px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-[10px]';
                    }
                }
            });
        }

        function nudgeDoc2(dx, dy) {
            state.nudgeX += dx * state.nudgeStep;
            state.nudgeY += dy * state.nudgeStep;
            const txt = document.getElementById('nudge-offset-text');
            if (txt) txt.innerText = `X:${state.nudgeX > 0 ? '+' : ''}${state.nudgeX} Y:${state.nudgeY > 0 ? '+' : ''}${state.nudgeY}`;
            renderPreviewCanvas();
        }

        function resetNudge() {
            state.nudgeX = 0;
            state.nudgeY = 0;
            const txt = document.getElementById('nudge-offset-text');
            if (txt) txt.innerText = 'X:0 Y:0';
            renderPreviewCanvas();
        }

        function handleOpacityInput(val) {
            state.opacity = parseFloat(val);
            const badge = document.getElementById('ui-opacity-val');
            if (badge) badge.innerText = Math.round(state.opacity * 100) + '%';
            renderPreviewCanvas();
        }

        function set100PercentZoom() {
            const wrapper = document.getElementById('canvas-wrapper');
            const pageData = state.results[state.currentPage];
            if (!pageData) return;
            previewState.zoom = 1.0;
            previewState.panX = (wrapper.clientWidth - pageData.width) / 2;
            previewState.panY = (wrapper.clientHeight - pageData.height) / 2;
            applyPreviewTransform();
        }

        // Snapshot PNG Export
        function exportSnapshotPNG() {
            if (!previewCanvas) return;
            const link = document.createElement('a');
            link.download = `Revu_Overlay_P${state.currentPage + 1}_Snapshot.png`;
            link.href = previewCanvas.toDataURL('image/png');
            link.click();
        }

        // Master Canvas Rendering Engine
        function renderPreviewCanvas() {
            if (state.results.length === 0) return;
            
            const pageData = state.results[state.currentPage];
            const ctx = previewCanvas.getContext('2d');
            
            // Handle Side-by-Side Split View
            if (state.viewMode === 'split') {
                const totalWidth = pageData.width * 2 + 10;
                previewCanvas.width = totalWidth;
                previewCanvas.height = pageData.height;

                ctx.fillStyle = '#0b1120';
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

                // Left: Document 1
                if (pageData.c1 && state.layer1Visible) {
                    ctx.drawImage(pageData.c1, 0, 0);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, pageData.width, pageData.height);
                }

                // Divider Line
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(pageData.width, 0, 10, pageData.height);

                // Right: Document 2
                if (pageData.c2 && state.layer2Visible) {
                    ctx.drawImage(pageData.c2, pageData.width + 10, 0);
                } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(pageData.width + 10, 0, pageData.width, pageData.height);
                }

            } else {
                // Overlay / Difference / Blink / Doc1 / Doc2
                previewCanvas.width = pageData.width;
                previewCanvas.height = pageData.height;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

                let dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;
                if (state.alignMode === 'center') {
                    if (pageData.c1) { dx1 = (previewCanvas.width - pageData.c1.width) / 2; dy1 = (previewCanvas.height - pageData.c1.height) / 2; }
                    if (pageData.c2) { dx2 = (previewCanvas.width - pageData.c2.width) / 2; dy2 = (previewCanvas.height - pageData.c2.height) / 2; }
                }

                const shouldDrawDoc1 = (state.viewMode === 'overlay' || state.viewMode === 'difference' || state.viewMode === 'doc1' || (state.viewMode === 'blink' && state.blinkState === 1)) && state.layer1Visible;
                const shouldDrawDoc2 = (state.viewMode === 'overlay' || state.viewMode === 'difference' || state.viewMode === 'doc2' || (state.viewMode === 'blink' && state.blinkState === 2)) && state.layer2Visible;

                // Draw Document 1
                if (shouldDrawDoc1 && pageData.c1) {
                    ctx.drawImage(pageData.c1, dx1, dy1);
                }

                // Draw Document 2
                if (shouldDrawDoc2 && pageData.c2) {
                    ctx.save();
                    if (state.viewMode === 'difference') {
                        ctx.globalCompositeOperation = 'difference';
                        ctx.globalAlpha = 1.0;
                    } else if (state.viewMode === 'overlay') {
                        ctx.globalCompositeOperation = 'multiply';
                        ctx.globalAlpha = state.opacity;
                    } else {
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.globalAlpha = state.opacity;
                    }

                    const posX = dx2 + state.nudgeX;
                    const posY = dy2 + state.nudgeY;

                    if (state.alignMode === '3point' && state.transformMatrix) {
                        const m = state.transformMatrix;
                        ctx.transform(m[0], m[1], m[2], m[3], m[4] + state.nudgeX, m[5] + state.nudgeY);
                        ctx.drawImage(pageData.c2, 0, 0);
                    } else {
                        ctx.drawImage(pageData.c2, posX, posY);
                    }
                    ctx.restore();
                }
            }

            // Update Sheet HUD Information
            if (pageData.ptWidth && pageData.ptHeight) {
                const sheetText = formatSheetDimensions(pageData.ptWidth, pageData.ptHeight);
                const hudSheet = document.getElementById('hud-sheet-size');
                if (hudSheet) hudSheet.innerText = sheetText;
            }
            const hudRes = document.getElementById('hud-res-size');
            if (hudRes) hudRes.innerText = `${pageData.width} Ã— ${pageData.height} px`;

            const pageInd = document.getElementById('ui-page-indicator');
            if (pageInd) pageInd.innerText = `Page ${state.currentPage + 1} / ${state.results.length}`;

            applyPreviewTransform();
        }

        function prevPage() { 
            if (state.currentPage > 0) { 
                state.currentPage--; 
                renderFilmstrip();
                renderPreviewCanvas(); 
            } 
        }
        function nextPage() { 
            if (state.currentPage < state.results.length - 1) { 
                state.currentPage++; 
                renderFilmstrip();
                renderPreviewCanvas(); 
            } 
        }

        function resetPreviewTransform() {
            const wrapper = document.getElementById('canvas-wrapper');
            const pageData = state.results[state.currentPage];
            if (!pageData) return;
            const w = state.viewMode === 'split' ? (pageData.width * 2 + 10) : pageData.width;
            const h = pageData.height;

            previewState.zoom = Math.min((wrapper.clientWidth - 40) / w, (wrapper.clientHeight - 40) / h);
            previewState.panX = (wrapper.clientWidth - w * previewState.zoom) / 2;
            previewState.panY = (wrapper.clientHeight - h * previewState.zoom) / 2;
            applyPreviewTransform();
        }

        function panPreview(direction, step = 60) {
            if (direction === 'up') previewState.panY += step;
            if (direction === 'down') previewState.panY -= step;
            if (direction === 'left') previewState.panX += step;
            if (direction === 'right') previewState.panX -= step;
            applyPreviewTransform();
        }

        function adjustPreviewZoom(factor, centerX, centerY) {
            const wrapper = document.getElementById('canvas-wrapper');
            const oldZoom = previewState.zoom;
            previewState.zoom = Math.max(0.05, Math.min(previewState.zoom * factor, 15.0));
            const pageData = state.results[state.currentPage];
            if (!pageData) return;
            const w = state.viewMode === 'split' ? (pageData.width * 2 + 10) : pageData.width;
            const h = pageData.height;

            if (centerX !== undefined && centerY !== undefined) {
                previewState.panX = centerX - (centerX - previewState.panX) * (previewState.zoom / oldZoom);
                previewState.panY = centerY - (centerY - previewState.panY) * (previewState.zoom / oldZoom);
            } else {
                previewState.panX = (wrapper.clientWidth - w * previewState.zoom) / 2;
                previewState.panY = (wrapper.clientHeight - h * previewState.zoom) / 2;
            }
            applyPreviewTransform();
        }

        function applyPreviewTransform() {
            previewCanvas.style.width = (previewCanvas.width * previewState.zoom) + 'px';
            previewCanvas.style.height = (previewCanvas.height * previewState.zoom) + 'px';
            previewCanvas.style.transform = `translate(${previewState.panX}px, ${previewState.panY}px)`;
            
            const pct = Math.round(previewState.zoom * 100);
            const el = document.getElementById('ui-zoom-level');
            if (el) el.innerText = pct + '%';
        }

        // Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            const isWizard = !viewWizard.classList.contains('hidden');
            const isResults = !viewResults.classList.contains('hidden');
            const isToolbox = !document.getElementById('toolbox-workspace').classList.contains('hidden');

            if (!isWizard && !isResults && !isToolbox) return;

            if (isResults && e.code === 'Space') {
                e.preventDefault();
                toggleBlink();
                return;
            }

            const step = 60;
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (isWizard) panWizard('up', step);
                if (isResults) {
                    if (e.shiftKey) nudgeDoc2(0, -1);
                    else panPreview('up', step);
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (isWizard) panWizard('down', step);
                if (isResults) {
                    if (e.shiftKey) nudgeDoc2(0, 1);
                    else panPreview('down', step);
                }
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (isWizard) panWizard('left', step);
                if (isResults) {
                    if (e.shiftKey) nudgeDoc2(-1, 0);
                    else panPreview('left', step);
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (isWizard) panWizard('right', step);
                if (isResults) {
                    if (e.shiftKey) nudgeDoc2(1, 0);
                    else panPreview('right', step);
                }
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                if (isWizard) adjustWizardZoom(1.2);
                if (isResults) adjustPreviewZoom(1.2);
                if (isToolbox) adjustToolboxPreviewZoom(1.2);
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                if (isWizard) adjustWizardZoom(0.8);
                if (isResults) adjustPreviewZoom(0.8);
                if (isToolbox) adjustToolboxPreviewZoom(0.8);
            } else if (e.key === '0' || e.key.toLowerCase() === 'f') {
                e.preventDefault();
                if (isWizard) resetWizardTransform();
                if (isResults) resetPreviewTransform();
                if (isToolbox) resetToolboxPreviewTransform();
            } else if (isResults && e.key === '1') {
                setViewMode('overlay');
            } else if (isResults && e.key === '2') {
                setViewMode('difference');
            } else if (isResults && e.key === '3') {
                setViewMode('split');
            }
        });

        function resetApp() {
            // Free GPU memory
            if (state.results) {
                state.results.forEach(res => {
                    if (res.c1) { res.c1.width = 0; res.c1.height = 0; }
                    if (res.c2) { res.c2.width = 0; res.c2.height = 0; }
                });
            }
            state.pdf1 = { file: null, doc: null, pageCount: 0, name: '', color: state.color1 };
            state.pdf2 = { file: null, doc: null, pageCount: 0, name: '', color: state.color2 };
            state.results = [];
            state.nudgeX = 0;
            state.nudgeY = 0;
            
            document.getElementById('file-1').value = '';
            document.getElementById('file-2').value = '';
            document.getElementById('ui-empty-1').classList.remove('hidden');
            document.getElementById('ui-filled-1').classList.add('hidden');
            document.getElementById('ui-empty-2').classList.remove('hidden');
            document.getElementById('ui-filled-2').classList.add('hidden');

            viewProcessing.classList.add('hidden'); viewProcessing.classList.remove('flex');
            viewResults.classList.add('hidden'); viewResults.classList.remove('flex');
            viewWizard.classList.add('hidden'); viewWizard.classList.remove('flex');
            viewSetup.classList.remove('hidden');
        }

        // ==================== STREAMING MEMORY-SAFE PDF EXPORT ====================
        async function downloadPDF() {
            if (state.results.length === 0) return;
            const modal = document.getElementById('download-progress-modal');
            const bar = document.getElementById('download-progress-bar');
            const pctText = document.getElementById('download-progress-pct');
            const pagesText = document.getElementById('download-progress-pages');
            const statusText = document.getElementById('download-progress-status');

            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }

            setTimeout(async () => {
                try {
                    const mergedPdf = await PDFLib.PDFDocument.create();
                    const totalPages = state.results.length;

                    for (let i = 0; i < totalPages; i++) {
                        const currentPct = Math.round(((i + 1) / totalPages) * 100);
                        if (bar) bar.style.width = currentPct + '%';
                        if (pctText) pctText.innerText = currentPct + '%';
                        if (pagesText) pagesText.innerText = `Page ${i + 1} of ${totalPages}`;
                        if (statusText) statusText.innerText = `Baking unified color layers for Page ${i + 1}...`;
                        await new Promise(r => setTimeout(r, 20));

                        const pageData = state.results[i];
                        
                        const exportCanvas = document.createElement('canvas');
                        exportCanvas.width = pageData.width;
                        exportCanvas.height = pageData.height;
                        const ctx = exportCanvas.getContext('2d');

                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

                        let dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;
                        if (state.alignMode === 'center') {
                            if (pageData.c1) { dx1 = (exportCanvas.width - pageData.c1.width) / 2; dy1 = (exportCanvas.height - pageData.c1.height) / 2; }
                            if (pageData.c2) { dx2 = (exportCanvas.width - pageData.c2.width) / 2; dy2 = (exportCanvas.height - pageData.c2.height) / 2; }
                        }

                        // Draw Doc 1
                        if (pageData.c1 && state.layer1Visible) {
                            ctx.drawImage(pageData.c1, dx1, dy1);
                        }
                        
                        // Draw Doc 2 with Multiply blend & Nudge
                        if (pageData.c2 && state.layer2Visible) {
                            ctx.save();
                            ctx.globalAlpha = state.opacity;
                            ctx.globalCompositeOperation = state.blendMode === 'difference' ? 'difference' : 'multiply'; 

                            const posX = dx2 + state.nudgeX;
                            const posY = dy2 + state.nudgeY;

                            if (state.alignMode === '3point' && state.transformMatrix) {
                                const m = state.transformMatrix;
                                ctx.transform(m[0], m[1], m[2], m[3], m[4] + state.nudgeX, m[5] + state.nudgeY);
                                ctx.drawImage(pageData.c2, 0, 0);
                            } else {
                                ctx.drawImage(pageData.c2, posX, posY);
                            }
                            ctx.restore();
                        }

                        // HIGH-PERFORMANCE BLOB CONVERSION (Zero Memory-Hogging Base64 toDataURL strings)
                        const blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/jpeg', 0.94));
                        const buffer = await blob.arrayBuffer();
                        const embeddedImage = await mergedPdf.embedJpg(buffer);

                        // Free canvas memory immediately
                        exportCanvas.width = 0;
                        exportCanvas.height = 0;

                        // Accurate PDF Sheet Dimensions (Points)
                        const pdfWidth = pageData.ptWidth || (pageData.width / 2.0);
                        const pdfHeight = pageData.ptHeight || (pageData.height / 2.0);

                        const newPage = mergedPdf.addPage([pdfWidth, pdfHeight]);
                        newPage.drawImage(embeddedImage, {
                            x: 0,
                            y: 0,
                            width: pdfWidth,
                            height: pdfHeight
                        });
                    }

                    if (statusText) statusText.innerText = "Finalizing PDF file...";
                    const pdfBytes = await mergedPdf.save();
                    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(pdfBlob);
                    link.download = `Revu_Overlay_Comparison_${Date.now()}.pdf`;
                    link.click();
                    URL.revokeObjectURL(link.href);
                } catch(err) {
                    console.error(err);
                    showError("Download Failed", "There was an error generating the PDF: " + err.message);
                } finally {
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                    }
                }
            }, 60);
        }

        // ==================== ADVANCED PDF TOOLBOX & THUMBNAIL MANAGER ====================

        const PAPER_SIZES = {
            a1: { width: 2383.94, height: 3370.39 },
            a2: { width: 1683.78, height: 2383.94 },
            a3: { width: 841.89, height: 1190.55 },
            a4: { width: 595.28, height: 841.89 },
            a5: { width: 419.53, height: 595.28 },
            letter: { width: 612.00, height: 792.00 },
            legal: { width: 612.00, height: 1008.00 },
            tabloid: { width: 792.00, height: 1224.00 },
            executive: { width: 522.00, height: 756.00 },
            b4: { width: 708.66, height: 1000.63 },
            b5: { width: 498.90, height: 708.66 }
        };

        const toolboxDropzone = document.getElementById('toolbox-dropzone');
        const toolboxFileInput = document.getElementById('toolbox-file-input');

        toolboxDropzone.addEventListener('dragover', (e) => { e.preventDefault(); toolboxDropzone.classList.add('dragover'); });
        toolboxDropzone.addEventListener('dragleave', (e) => { e.preventDefault(); toolboxDropzone.classList.remove('dragover'); });
        toolboxDropzone.addEventListener('drop', (e) => {
            e.preventDefault(); toolboxDropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) initToolboxPDF(e.dataTransfer.files[0]);
        });
        toolboxFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) initToolboxPDF(e.target.files[0]);
        });

        async function initToolboxPDF(file) {
            if (file.type !== 'application/pdf') { showError("Invalid File", "Please upload a valid PDF."); return; }
            try {
                const arrayBuffer = await file.arrayBuffer();
                const copiedBuffer = arrayBuffer.slice(0);
                toolboxState.file = file;
                toolboxState.pdfDoc = await PDFLib.PDFDocument.load(copiedBuffer);
                
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                toolboxState.pdfJsDoc = await loadingTask.promise;
                toolboxState.pageCount = toolboxState.pdfDoc.getPageCount();
                toolboxState.selectedPages.clear();
                toolboxState.activePreviewPage = 0;

                document.getElementById('toolbox-filename').innerText = file.name;
                document.getElementById('toolbox-page-count').innerText = `${toolboxState.pageCount} Pages`;

                document.getElementById('toolbox-upload-view').classList.add('hidden');
                document.getElementById('toolbox-workspace').classList.remove('hidden');
                document.getElementById('toolbox-workspace').classList.add('flex');

                await renderToolboxThumbnails();
                await renderToolboxPreview(0);
            } catch(err) {
                console.error(err);
                showError("Error Loading PDF", err.message);
            }
        }

        function tbResetToolboxUpload() {
            toolboxState.file = null;
            toolboxState.pdfDoc = null;
            toolboxState.pdfJsDoc = null;
            toolboxState.pageCount = 0;
            toolboxState.selectedPages.clear();
            document.getElementById('toolbox-file-input').value = '';
            document.getElementById('toolbox-workspace').classList.add('hidden');
            document.getElementById('toolbox-workspace').classList.remove('flex');
            document.getElementById('toolbox-upload-view').classList.remove('hidden');
        }

        async function renderToolboxThumbnails() {
            const container = document.getElementById('thumbnails-container');
            container.innerHTML = '';
            const currentWidth = document.getElementById('thumb-width-slider') ? document.getElementById('thumb-width-slider').value : 110;

            for (let i = 0; i < toolboxState.pageCount; i++) {
                const pageNum = i + 1;
                const page = await toolboxState.pdfJsDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: 0.35 });

                const card = document.createElement('div');
                card.className = `thumbnail-card bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex flex-col items-center cursor-pointer hover:border-accentBlue ${toolboxState.selectedPages.has(i) ? 'selected ring-2 ring-accentBlue bg-blue-50' : ''}`;
                card.style.width = currentWidth + 'px';
                card.onclick = (e) => {
                    if (e.target.type === 'checkbox') return;
                    togglePageSelection(i);
                };

                const topRow = document.createElement('div');
                topRow.className = 'w-full flex justify-between items-center mb-1 px-1';
                
                const label = document.createElement('span');
                label.className = 'font-bold text-[10px] text-slate-700';
                label.innerText = `Page ${pageNum}`;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = toolboxState.selectedPages.has(i);
                checkbox.className = 'w-3.5 h-3.5 text-accentBlue rounded border-slate-300 cursor-pointer';
                checkbox.onchange = () => togglePageSelection(i);

                topRow.appendChild(label);
                topRow.appendChild(checkbox);

                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = viewport.width;
                thumbCanvas.height = viewport.height;
                thumbCanvas.style.width = '100%';
                thumbCanvas.style.height = 'auto';
                thumbCanvas.className = 'shadow-sm bg-white rounded border border-slate-200 object-contain';
                const tCtx = thumbCanvas.getContext('2d');
                await page.render({ canvasContext: tCtx, viewport: viewport }).promise;

                card.appendChild(topRow);
                card.appendChild(thumbCanvas);
                container.appendChild(card);
            }
            updateSelectedCountBadge();
        }

        function updateThumbnailWidth(val) {
            const cards = document.querySelectorAll('.thumbnail-card');
            cards.forEach(card => {
                card.style.width = val + 'px';
            });
        }

        function togglePageSelection(idx) {
            if (toolboxState.selectedPages.has(idx)) {
                toolboxState.selectedPages.delete(idx);
            } else {
                toolboxState.selectedPages.add(idx);
            }
            renderToolboxThumbnails();
            renderToolboxPreview(idx);
        }

        function tbSelectAll() {
            for (let i = 0; i < toolboxState.pageCount; i++) toolboxState.selectedPages.add(i);
            renderToolboxThumbnails();
        }

        function tbDeselectAll() {
            toolboxState.selectedPages.clear();
            renderToolboxThumbnails();
        }

        function updateSelectedCountBadge() {
            document.getElementById('selected-count-badge').innerText = `${toolboxState.selectedPages.size} selected`;
        }

        async function renderToolboxPreview(idx) {
            toolboxState.activePreviewPage = idx;
            document.getElementById('toolbox-preview-title').innerText = `Previewing Page ${idx + 1} of ${toolboxState.pageCount}`;
            
            const page = await toolboxState.pdfJsDoc.getPage(idx + 1);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.getElementById('toolbox-canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            resetToolboxPreviewTransform();
        }

        function resetToolboxPreviewTransform() {
            const wrapper = document.getElementById('toolbox-canvas-wrapper');
            const canvas = document.getElementById('toolbox-canvas');
            const baseW = canvas.width / 1.5;
            const baseH = canvas.height / 1.5;
            toolboxPreviewState.zoom = Math.min((wrapper.clientWidth - 40) / baseW, (wrapper.clientHeight - 40) / baseH);
            toolboxPreviewState.panX = (wrapper.clientWidth - baseW * toolboxPreviewState.zoom) / 2;
            toolboxPreviewState.panY = (wrapper.clientHeight - baseH * toolboxPreviewState.zoom) / 2;
            applyToolboxPreviewTransform();
        }

        function adjustToolboxPreviewZoom(factor, centerX, centerY) {
            const wrapper = document.getElementById('toolbox-canvas-wrapper');
            const oldZoom = toolboxPreviewState.zoom;
            toolboxPreviewState.zoom = Math.max(0.05, Math.min(toolboxPreviewState.zoom * factor, 15.0));
            const canvas = document.getElementById('toolbox-canvas');
            const baseW = canvas.width / 1.5;
            const baseH = canvas.height / 1.5;

            if (centerX !== undefined && centerY !== undefined) {
                toolboxPreviewState.panX = centerX - (centerX - toolboxPreviewState.panX) * (toolboxPreviewState.zoom / oldZoom);
                toolboxPreviewState.panY = centerY - (centerY - toolboxPreviewState.panY) * (toolboxPreviewState.zoom / oldZoom);
            } else {
                toolboxPreviewState.panX = (wrapper.clientWidth - baseW * toolboxPreviewState.zoom) / 2;
                toolboxPreviewState.panY = (wrapper.clientHeight - baseH * toolboxPreviewState.zoom) / 2;
            }
            applyToolboxPreviewTransform();
        }

        function applyToolboxPreviewTransform() {
            const canvas = document.getElementById('toolbox-canvas');
            const baseW = canvas.width / 1.5;
            const baseH = canvas.height / 1.5;
            canvas.style.width = (baseW * toolboxPreviewState.zoom) + 'px';
            canvas.style.height = (baseH * toolboxPreviewState.zoom) + 'px';
            canvas.style.transform = `translate(${toolboxPreviewState.panX}px, ${toolboxPreviewState.panY}px)`;
            
            const pct = Math.round(toolboxPreviewState.zoom * 100);
            const el = document.getElementById('tb-zoom-level');
            if (el) el.innerText = pct + '%';
        }

        async function tbRotateActivePage(angle) {
            if (!toolboxState.pdfDoc) return;
            await tbRotateAction('current', angle);
        }

        // --- DEDICATED ROTATE MODAL HANDLERS ---
        function toggleRotateCustomRange() {
            const scope = document.getElementById('rotate-modal-scope').value;
            const group = document.getElementById('rotate-custom-range-group');
            if (group) {
                if (scope === 'custom') {
                    group.classList.remove('hidden');
                } else {
                    group.classList.add('hidden');
                }
            }
        }

        async function executeRotateModal() {
            if (!toolboxState.pdfDoc) return;
            const scope = document.getElementById('rotate-modal-scope').value;
            const customRange = document.getElementById('rotate-modal-range') ? document.getElementById('rotate-modal-range').value.trim() : '';
            
            const radios = document.getElementsByName('rotate-angle-choice');
            let angle = 90;
            for (const r of radios) {
                if (r.checked) {
                    angle = parseInt(r.value);
                    break;
                }
            }

            closeModal('modal-rotate');
            await tbRotateAction(scope, angle, customRange);
        }

        // --- FEATURE 01: PDF MARKUP & COMMENT FLATTEN FUNCTION ---

        function toggleFlattenCustomRange() {
            const scope = document.getElementById('flatten-scope').value;
            const group = document.getElementById('flatten-custom-range-group');
            if (group) {
                if (scope === 'custom') {
                    group.classList.remove('hidden');
                } else {
                    group.classList.add('hidden');
                }
            }
        }

        async function executeFlatten() {
            if (!toolboxState.pdfDoc || !toolboxState.pdfJsDoc) return;
            
            const scope = document.getElementById('flatten-scope').value;
            const target = document.getElementById('flatten-target') ? document.getElementById('flatten-target').value : 'all-markups';
            const quality = document.getElementById('flatten-quality').value;
            const customRange = document.getElementById('flatten-custom-range') ? document.getElementById('flatten-custom-range').value.trim() : '';
            const renderScale = quality === 'high' ? 3.0 : 1.5;

            let targetIndices = [];
            if (scope === 'single') {
                targetIndices = [toolboxState.activePreviewPage];
            } else if (scope === 'selected') {
                targetIndices = Array.from(toolboxState.selectedPages).sort((a,b) => a - b);
                if (targetIndices.length === 0) {
                    showError("No Pages Selected", "Please select at least one page in the thumbnail list or choose 'All Pages'.");
                    return;
                }
            } else if (scope === 'custom') {
                if (!customRange) {
                    showError("Invalid Range", "Please enter a valid page range (e.g. 1-3, 5).");
                    return;
                }
                targetIndices = parsePageRange(customRange, toolboxState.pageCount).map(p => p - 1);
            } else {
                // 'all'
                targetIndices = Array.from({ length: toolboxState.pageCount }, (_, i) => i);
            }

            if (targetIndices.length === 0) {
                showError("No Target Pages", "No valid pages were specified for flattening.");
                return;
            }

            const btn = document.getElementById('btn-execute-flatten');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Flattening Markups...';

            setTimeout(async () => {
                try {
                    // Case 1: Form Fields Only - PDFLib pure vector form flattening
                    if (target === 'forms-only') {
                        try {
                            const form = toolboxState.pdfDoc.getForm();
                            form.flatten();
                        } catch (e) {
                            console.log("No form fields detected for flattening");
                        }
                        const pdfBytes = await toolboxState.pdfDoc.save();
                        toolboxState.pdfDoc = await PDFLib.PDFDocument.load(pdfBytes.slice(0));
                        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
                        toolboxState.pdfJsDoc = await loadingTask.promise;

                        closeModal('modal-flatten');
                        await renderToolboxThumbnails();
                        await renderToolboxPreview(toolboxState.activePreviewPage);
                        return;
                    }

                    // Case 2: Markups, Comments, or Everything
                    const newPdfDoc = await PDFLib.PDFDocument.create();

                    for (let i = 0; i < toolboxState.pageCount; i++) {
                        if (targetIndices.includes(i)) {
                            // Render page with PDF.js including annotations & comments
                            const page = await toolboxState.pdfJsDoc.getPage(i + 1);
                            const viewport = page.getViewport({ scale: renderScale });
                            const canvas = document.createElement('canvas');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const ctx = canvas.getContext('2d');
                            ctx.fillStyle = 'white';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);

                            // Enable annotations rendering for burning into visual canvas
                            const annotMode = pdfjsLib.AnnotationMode ? pdfjsLib.AnnotationMode.ENABLE : 1;
                            await page.render({
                                canvasContext: ctx,
                                viewport: viewport,
                                annotationMode: annotMode
                            }).promise;

                            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
                            const buffer = await blob.arrayBuffer();
                            const embeddedImage = await newPdfDoc.embedJpg(buffer);

                            if (page.cleanup) page.cleanup();
                            canvas.width = 0; canvas.height = 0;

                            const origPage = toolboxState.pdfDoc.getPage(i);
                            const pdfPage = newPdfDoc.addPage([origPage.getWidth(), origPage.getHeight()]);
                            pdfPage.drawImage(embeddedImage, {
                                x: 0,
                                y: 0,
                                width: origPage.getWidth(),
                                height: origPage.getHeight()
                            });
                        } else {
                            // Preserve original unflattened page exactly
                            const [copiedPage] = await newPdfDoc.copyPages(toolboxState.pdfDoc, [i]);
                            newPdfDoc.addPage(copiedPage);
                        }
                    }

                    // Flatten interactive form fields if 'everything' was selected
                    if (target === 'everything') {
                        try {
                            const form = newPdfDoc.getForm();
                            form.flatten();
                        } catch (e) {
                            // No form to flatten
                        }
                    }

                    const pdfBytes = await newPdfDoc.save();
                    toolboxState.pdfDoc = await PDFLib.PDFDocument.load(pdfBytes.slice(0));
                    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
                    toolboxState.pdfJsDoc = await loadingTask.promise;

                    closeModal('modal-flatten');
                    await renderToolboxThumbnails();
                    await renderToolboxPreview(toolboxState.activePreviewPage);
                } catch (err) {
                    console.error("Flattening error:", err);
                    showError("Flattening Failed", "Error while flattening PDF markups: " + err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            }, 50);
        }

        // --- TOOLBOX ACTIONS: ROTATE, INSERT, EXTRACT, DELETE ---

        async function tbRotateAction(scope, angle, customRange = '') {
            if (!toolboxState.pdfDoc) return;

            let pagesToRotate = [];
            if (scope === 'all') {
                pagesToRotate = Array.from({ length: toolboxState.pageCount }, (_, i) => i);
            } else if (scope === 'current' || scope === 'single') {
                pagesToRotate = [toolboxState.activePreviewPage];
            } else if (scope === 'selected') {
                if (toolboxState.selectedPages.size > 0) {
                    pagesToRotate = Array.from(toolboxState.selectedPages);
                } else {
                    // Fall back to currently active preview page if none selected
                    pagesToRotate = [toolboxState.activePreviewPage];
                }
            } else if (scope === 'custom') {
                if (customRange) {
                    pagesToRotate = parsePageRange(customRange, toolboxState.pageCount).map(p => p - 1);
                }
            }

            if (!pagesToRotate || pagesToRotate.length === 0) {
                showError("No Pages Selected", "Please select at least one page or choose 'All Pages'.");
                return;
            }

            try {
                for (const idx of pagesToRotate) {
                    if (idx >= 0 && idx < toolboxState.pageCount) {
                        const page = toolboxState.pdfDoc.getPage(idx);
                        const currentRot = page.getRotation().angle;
                        const newRot = (currentRot + angle + 360) % 360;
                        page.setRotation(PDFLib.degrees(newRot));
                    }
                }

                const pdfBytes = await toolboxState.pdfDoc.save();
                // Crucial fix: Reload pdfDoc to prevent internal reference desync on subsequent operations
                toolboxState.pdfDoc = await PDFLib.PDFDocument.load(pdfBytes.slice(0));
                
                // Reload PDF.js document for visual thumbnail & preview rendering
                const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
                toolboxState.pdfJsDoc = await loadingTask.promise;
                
                await renderToolboxThumbnails();
                await renderToolboxPreview(toolboxState.activePreviewPage);
            } catch (err) {
                console.error("Rotation error:", err);
                showError("Rotation Failed", "Could not rotate pages: " + err.message);
            }
        }

        async function tbRotateCustomRange() {
            openModal('modal-rotate');
            const scopeSelect = document.getElementById('rotate-modal-scope');
            if (scopeSelect) {
                scopeSelect.value = 'custom';
                toggleRotateCustomRange();
            }
        }

        function toggleInsertTypeFields() {
            const val = document.getElementById('insert-modal-type').value;
            if (val === 'blank') {
                document.getElementById('insert-group-blank').classList.remove('hidden');
                document.getElementById('insert-group-pdf').classList.add('hidden');
            } else {
                document.getElementById('insert-group-blank').classList.add('hidden');
                document.getElementById('insert-group-pdf').classList.remove('hidden');
            }
        }

        async function executeInsert() {
            if (!toolboxState.pdfDoc) return;
            const insertType = document.getElementById('insert-modal-type').value;
            let pos = parseInt(document.getElementById('insert-position').value) || 0;
            if (pos < 0) pos = 0;
            if (pos > toolboxState.pageCount) pos = toolboxState.pageCount;

            try {
                if (insertType === 'blank') {
                    const paperSizeKey = document.getElementById('insert-paper-size').value;
                    const orient = document.getElementById('insert-paper-orient').value;
                    const count = parseInt(document.getElementById('insert-count').value) || 1;
                    
                    let dims = { width: 595.28, height: 841.89 };
                    if (paperSizeKey === 'custom') {
                        dims.width = parseFloat(document.getElementById('insert-custom-width').value) || 595.28;
                        dims.height = parseFloat(document.getElementById('insert-custom-height').value) || 841.89;
                    } else if (PAPER_SIZES[paperSizeKey]) {
                        dims = PAPER_SIZES[paperSizeKey];
                    }

                    let w = dims.width;
                    let h = dims.height;
                    if (orient === 'landscape' && w < h) {
                        const temp = w; w = h; h = temp;
                    } else if (orient === 'portrait' && w > h) {
                        const temp = w; w = h; h = temp;
                    }

                    for (let i = 0; i < count; i++) {
                        toolboxState.pdfDoc.insertPage(pos, [w, h]);
                    }
                } else if (insertType === 'pdf') {
                    const fileInput = document.getElementById('insert-external-file');
                    if (!fileInput.files || !fileInput.files[0]) {
                        showError("No File Selected", "Please select a PDF file to insert.");
                        return;
                    }
                    const extFile = fileInput.files[0];
                    const extBuffer = await extFile.arrayBuffer();
                    const extPdfDoc = await PDFLib.PDFDocument.load(extBuffer);
                    const extMax = extPdfDoc.getPageCount();
                    
                    const rangeStr = document.getElementById('insert-external-range').value;
                    const targetPages = parsePageRange(rangeStr, extMax).map(p => p - 1);
                    const repeatCount = parseInt(document.getElementById('insert-pdf-count').value) || 1;

                    for (let r = 0; r < repeatCount; r++) {
                        const copiedPages = await toolboxState.pdfDoc.copyPages(extPdfDoc, targetPages);
                        copiedPages.forEach((cp, idx) => {
                            toolboxState.pdfDoc.insertPage(pos + idx, cp);
                        });
                    }
                }

                const pdfBytes = await toolboxState.pdfDoc.save();
                toolboxState.pdfDoc = await PDFLib.PDFDocument.load(pdfBytes.slice(0));
                const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
                toolboxState.pdfJsDoc = await loadingTask.promise;
                toolboxState.pageCount = toolboxState.pdfDoc.getPageCount();
                toolboxState.selectedPages.clear();

                closeModal('modal-insert');
                await renderToolboxThumbnails();
                await renderToolboxPreview(Math.min(pos, toolboxState.pageCount - 1));
            } catch (err) {
                console.error(err);
                showError("Insert Error", "Failed to insert pages: " + err.message);
            }
        }

        async function executeExtract() {
            if (!toolboxState.pdfDoc) return;
            const rangeStr = document.getElementById('extract-range-input').value;
            let targetPages = [];

            if (rangeStr && rangeStr.trim()) {
                targetPages = parsePageRange(rangeStr, toolboxState.pageCount).map(p => p - 1);
            } else {
                targetPages = Array.from(toolboxState.selectedPages).sort((a,b) => a - b);
            }

            if (targetPages.length === 0) {
                showError("No Pages Specified", "Please enter a page range or select thumbnail pages to extract.");
                return;
            }

            try {
                const extractPdfDoc = await PDFLib.PDFDocument.create();
                const copiedPages = await extractPdfDoc.copyPages(toolboxState.pdfDoc, targetPages);
                copiedPages.forEach(p => extractPdfDoc.addPage(p));

                const pdfBytes = await extractPdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Extracted_Pages_${toolboxState.file ? toolboxState.file.name : 'document.pdf'}`;
                link.click();
                URL.revokeObjectURL(link.href);
                closeModal('modal-extract');
            } catch (err) {
                console.error(err);
                showError("Extraction Failed", "Error extracting pages: " + err.message);
            }
        }

        async function tbDeleteSelected() {
            if (!toolboxState.pdfDoc) return;
            if (toolboxState.selectedPages.size === 0) {
                showError("No Pages Selected", "Please select at least one page thumbnail to delete.");
                return;
            }
            if (toolboxState.selectedPages.size >= toolboxState.pageCount) {
                showError("Cannot Delete All Pages", "A PDF document must contain at least one page.");
                return;
            }

            if (!confirm(`Are you sure you want to delete ${toolboxState.selectedPages.size} selected page(s)?`)) return;

            try {
                const pagesToDelete = Array.from(toolboxState.selectedPages).sort((a,b) => b - a);
                pagesToDelete.forEach(idx => {
                    toolboxState.pdfDoc.removePage(idx);
                });

                const pdfBytes = await toolboxState.pdfDoc.save();
                toolboxState.pdfDoc = await PDFLib.PDFDocument.load(pdfBytes.slice(0));
                const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
                toolboxState.pdfJsDoc = await loadingTask.promise;
                toolboxState.pageCount = toolboxState.pdfDoc.getPageCount();
                toolboxState.selectedPages.clear();

                await renderToolboxThumbnails();
                await renderToolboxPreview(0);
            } catch(err) {
                console.error(err);
                showError("Delete Failed", "Could not delete pages: " + err.message);
            }
        }

        async function tbDownloadModifiedPDF() {
            if (!toolboxState.pdfDoc) return;
            try {
                const pdfBytes = await toolboxState.pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Modified_${toolboxState.file ? toolboxState.file.name : 'document.pdf'}`;
                link.click();
                URL.revokeObjectURL(link.href);
            } catch(err) {
                console.error(err);
                showError("Save Error", "Could not save PDF: " + err.message);
            }
        }

        // ==================== FEATURE 02: PDF BINDER & DRAG-DROP SORTING LOGIC ====================

        function setupBinderDropzone() {
            const dropzone = document.getElementById('binder-dropzone');
            const input = document.getElementById('binder-file-input');

            if (!dropzone || !input) return;

            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault(); dropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    addBinderFiles(Array.from(e.dataTransfer.files));
                }
            });
            input.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    addBinderFiles(Array.from(e.target.files));
                }
            });
        }
        setupBinderDropzone();

        async function addBinderFiles(files) {
            if (!files || files.length === 0) return;

            for (let file of files) {
                if (file.type !== 'application/pdf') continue;
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const copiedBuffer = arrayBuffer.slice(0);
                    const pdfDoc = await PDFLib.PDFDocument.load(copiedBuffer);
                    const pdfJsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    
                    // Render 1st page thumbnail
                    const firstPage = await pdfJsDoc.getPage(1);
                    const viewport = firstPage.getViewport({ scale: 0.25 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await firstPage.render({ canvasContext: ctx, viewport: viewport }).promise;
                    const thumbUrl = canvas.toDataURL('image/png');

                    binderState.items.push({
                        id: 'binder_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        file: file,
                        pdfDoc: pdfDoc,
                        pdfJsDoc: pdfJsDoc,
                        name: file.name,
                        size: (file.size / (1024 * 1024)).toFixed(2),
                        pageCount: pdfDoc.getPageCount(),
                        pageRange: '',
                        rotation: 0,
                        thumbUrl: thumbUrl
                    });
                } catch (err) {
                    console.error(err);
                    showError("Error Loading File", `Could not read ${file.name}`);
                }
            }
            renderBinderList();
        }

        let draggedItemIndex = null;

        function renderBinderList() {
            const emptyState = document.getElementById('binder-empty-state');
            const workspace = document.getElementById('binder-workspace');
            const listContainer = document.getElementById('binder-items-list');

            if (binderState.items.length === 0) {
                emptyState.classList.remove('hidden');
                workspace.classList.add('hidden');
                workspace.classList.remove('flex');
                return;
            }

            emptyState.classList.add('hidden');
            workspace.classList.remove('hidden');
            workspace.classList.add('flex');

            document.getElementById('binder-count-label').innerText = `${binderState.items.length} PDF File(s) in Binder Queue`;
            listContainer.innerHTML = '';

            binderState.items.forEach((item, index) => {
                const card = document.createElement('div');
                card.className = 'binder-item-card bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 transition hover:border-slate-300 hover:shadow-sm';
                card.draggable = true;
                card.dataset.index = index;

                // Drag & Drop Event Handlers
                card.addEventListener('dragstart', (e) => {
                    draggedItemIndex = index;
                    card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });

                card.addEventListener('dragend', () => {
                    draggedItemIndex = null;
                    card.classList.remove('dragging');
                    document.querySelectorAll('.binder-item-card').forEach(c => c.classList.remove('border-accentBlue', 'bg-blue-50'));
                });

                card.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    card.classList.add('border-accentBlue', 'bg-blue-50');
                });

                card.addEventListener('dragleave', () => {
                    card.classList.remove('border-accentBlue', 'bg-blue-50');
                });

                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    card.classList.remove('border-accentBlue', 'bg-blue-50');
                    if (draggedItemIndex !== null && draggedItemIndex !== index) {
                        const movedItem = binderState.items.splice(draggedItemIndex, 1)[0];
                        binderState.items.splice(index, 0, movedItem);
                        renderBinderList();
                    }
                });

                card.innerHTML = `
                    <div class="flex items-center space-x-3 min-w-0">
                        <div class="cursor-grab text-slate-400 hover:text-slate-600 px-1 py-2 text-lg" title="Drag to reorder">
                            <i class="fa-solid fa-grip-vertical"></i>
                        </div>
                        <div class="w-10 h-12 bg-white rounded border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xs">
                            ${item.thumbUrl ? `<img src="${item.thumbUrl}" class="w-full h-full object-cover">` : `<i class="fa-regular fa-file-pdf text-pdfRed text-xl"></i>`}
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-xs text-slate-800 truncate max-w-xs md:max-w-md" title="${item.name}">${index + 1}. ${item.name}</h4>
                            <p class="text-[10px] text-slate-400">${item.size} MB â€¢ ${item.pageCount} Pages</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto justify-end">
                        <div class="flex items-center space-x-1.5">
                            <span class="text-slate-500 font-medium text-[11px]">Pages:</span>
                            <input type="text" value="${item.pageRange}" placeholder="All (e.g. 1-3, 5)" 
                                onchange="updateBinderItemRange(${index}, this.value)"
                                class="bg-white border border-slate-200 rounded px-2 py-1 text-xs w-28 focus:ring-accentBlue focus:border-accentBlue">
                        </div>
                        
                        <div class="flex items-center space-x-1">
                            <button onclick="rotateBinderItem(${index}, -90)" class="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600" title="Rotate left -90Â°">
                                <i class="fa-solid fa-rotate-left text-xs"></i>
                            </button>
                            <button onclick="rotateBinderItem(${index}, 90)" class="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600" title="Rotate right +90Â°">
                                <i class="fa-solid fa-rotate-right text-xs"></i>
                            </button>
                            <span class="text-[10px] font-semibold text-slate-400 min-w-[32px] text-center">${item.rotation}Â°</span>
                        </div>

                        <div class="flex items-center space-x-1">
                            <button onclick="moveBinderItem(${index}, -1)" ${index === 0 ? 'disabled' : ''} class="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30" title="Move Up">
                                <i class="fa-solid fa-arrow-up text-xs"></i>
                            </button>
                            <button onclick="moveBinderItem(${index}, 1)" ${index === binderState.items.length - 1 ? 'disabled' : ''} class="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30" title="Move Down">
                                <i class="fa-solid fa-arrow-down text-xs"></i>
                            </button>
                            <button onclick="removeBinderItem(${index})" class="p-1.5 bg-white border border-red-200 hover:bg-red-50 text-pdfRed rounded ml-1" title="Remove File">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;

                listContainer.appendChild(card);
            });
        }

        function updateBinderItemRange(idx, val) {
            if (binderState.items[idx]) {
                binderState.items[idx].pageRange = val;
            }
        }

        function rotateBinderItem(idx, angle) {
            if (binderState.items[idx]) {
                binderState.items[idx].rotation = (binderState.items[idx].rotation + angle + 360) % 360;
                renderBinderList();
            }
        }

        function moveBinderItem(idx, dir) {
            const newIdx = idx + dir;
            if (newIdx >= 0 && newIdx < binderState.items.length) {
                const item = binderState.items.splice(idx, 1)[0];
                binderState.items.splice(newIdx, 0, item);
                renderBinderList();
            }
        }

        function removeBinderItem(idx) {
            binderState.items.splice(idx, 1);
            renderBinderList();
        }

        function clearBinderList() {
            binderState.items = [];
            renderBinderList();
        }

        async function generatePDFBinder() {
            if (binderState.items.length === 0) {
                showError("Binder Empty", "Please add at least one PDF file to create a binder.");
                return;
            }

            const btn = document.getElementById('btn-create-binder');
            const origText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Merging Binder...';

            setTimeout(async () => {
                try {
                    const mergedPdf = await PDFLib.PDFDocument.create();

                    for (let item of binderState.items) {
                        const pagesToInclude = parsePageRange(item.pageRange, item.pageCount);
                        const pageIndices = pagesToInclude.map(p => p - 1);
                        
                        const copiedPages = await mergedPdf.copyPages(item.pdfDoc, pageIndices);
                        
                        copiedPages.forEach(page => {
                            if (item.rotation !== 0) {
                                const currentRot = page.getRotation().angle;
                                page.setRotation(PDFLib.degrees((currentRot + item.rotation + 360) % 360));
                            }
                            mergedPdf.addPage(page);
                        });
                    }

                    const pdfBytes = await mergedPdf.save();
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'PDF_Binder_Combined.pdf';
                    link.click();
                    URL.revokeObjectURL(link.href);
                } catch (err) {
                    console.error(err);
                    showError("Binder Generation Error", "Failed to merge PDF files: " + err.message);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = origText;
                }
            }, 50);
        }

        // --- HELPER & MODAL FUNCTIONS ---

        function toggleCustomPaperSize() {
            const val = document.getElementById('insert-paper-size').value;
            const customDims = document.getElementById('insert-custom-dims');
            if (val === 'custom') {
                customDims.classList.remove('hidden');
            } else {
                customDims.classList.add('hidden');
            }
        }

        function openModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        }

        function showError(title, message) {
            document.getElementById('error-title').innerText = title;
            document.getElementById('error-message').innerText = message;
            openModal('error-modal');
        }

        // =========================================================================
        // UNIFIED OVERLAY WITH / WITHOUT MARKUPS & ALL-IN-ONE BLUEBEAM WORKFLOWS
        // =========================================================================

        function setOverlayMarkupsOption(withMarkups) {
            state.includeMarkups = withMarkups ? 1 : 0;
            const chk = document.getElementById('setting-markups');
            if (chk) chk.checked = withMarkups;

            // Setup buttons
            const btnWith = document.getElementById('btn-mode-with-markups');
            const btnWithout = document.getElementById('btn-mode-without-markups');
            const badge = document.getElementById('badge-markups-mode');
            const desc = document.getElementById('desc-markups-mode');

            if (btnWith && btnWithout) {
                if (withMarkups) {
                    btnWith.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200 dark:border-slate-600';
                    btnWithout.className = 'py-2 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center gap-2';
                    if (badge) {
                        badge.innerText = 'With Markups Included';
                        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                    }
                    if (desc) desc.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Compares base CAD vectors plus all revision clouds, callouts, text boxes, stamps, and user annotations.';
                } else {
                    btnWithout.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200 dark:border-slate-600';
                    btnWith.className = 'py-2 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center gap-2';
                    if (badge) {
                        badge.innerText = 'Without Markups (Base CAD Only)';
                        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                    }
                    if (desc) desc.innerHTML = '<i class="fa-solid fa-drafting-compass text-amber-600 mr-1"></i> Ignores all annotations, comments, clouds & stamps. Compares clean underlying CAD vector/raster drawings only.';
                }
            }

            // Ribbon buttons in Viewer Studio
            const ribWith = document.getElementById('ribbon-btn-with-markups');
            const ribWithout = document.getElementById('ribbon-btn-without-markups');
            if (ribWith && ribWithout) {
                if (withMarkups) {
                    ribWith.className = 'px-2 py-0.5 text-[11px] font-bold rounded bg-sky-600 text-white shadow-xs transition';
                    ribWithout.className = 'px-2 py-0.5 text-[11px] font-semibold rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-650 transition';
                } else {
                    ribWithout.className = 'px-2 py-0.5 text-[11px] font-bold rounded bg-sky-600 text-white shadow-xs transition';
                    ribWith.className = 'px-2 py-0.5 text-[11px] font-semibold rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-650 transition';
                }
            }
        }

        async function toggleOverlayMarkupsLive() {
            const newMode = state.includeMarkups ? 0 : 1;
            setOverlayMarkupsOption(newMode === 1);

            const lbl = document.getElementById('lbl-live-markups');
            if (lbl) {
                lbl.innerText = newMode ? 'ON' : 'OFF';
                lbl.className = newMode ? 'text-sky-600 font-bold' : 'text-slate-400 font-bold';
            }
            const eye = document.getElementById('layer-eye-markups');
            if (eye) {
                eye.innerHTML = newMode ? '<i class="fa-solid fa-eye text-xs"></i>' : '<i class="fa-solid fa-eye-slash text-xs text-slate-400"></i>';
            }

            if (state.pdf1.doc && state.pdf2.doc) {
                showToast(newMode ? "Re-rendering overlay WITH markups..." : "Re-rendering overlay WITHOUT markups (Base CAD only)...", "info");
                await runComparison();
            }
        }

        async function compareActiveDocWithRevision() {
            if (!viewerState.pdfJsDoc) {
                showToast("Please open a PDF document in Viewer first, or select files below.", "info");
                switchAppMode('compare');
                return;
            }
            try {
                state.pdf1 = {
                    doc: viewerState.pdfJsDoc,
                    fileName: viewerState.fileName || 'Active_Document.pdf',
                    fileSize: 'Active Doc',
                    pageCount: viewerState.pageCount,
                    fileObj: viewerState.file
                };

                const uiEmpty1 = document.getElementById('ui-empty-1');
                const uiFilled1 = document.getElementById('ui-filled-1');
                const filename1 = document.getElementById('filename-1');
                const filesize1 = document.getElementById('filesize-1');
                const filepages1 = document.getElementById('filepages-1');

                if (uiEmpty1) uiEmpty1.classList.add('hidden');
                if (uiFilled1) uiFilled1.classList.remove('hidden');
                if (filename1) filename1.innerText = state.pdf1.fileName;
                if (filesize1) filesize1.innerText = state.pdf1.fileSize;
                if (filepages1) filepages1.innerText = state.pdf1.pageCount;

                switchAppMode('compare');
                showToast("Active document loaded as Document 1 (Original). Now choose Revision PDF.", "success");
            } catch (err) {
                console.error("compareActiveDocWithRevision error:", err);
                switchAppMode('compare');
            }
        }

        async function openPageManagerWithCurrentDoc() {
            if (!viewerState.doc && !viewerState.pdfJsDoc) {
                switchAppMode('toolbox');
                return;
            }
            try {
                showToast("Opening active document in Page Manager...", "info");
                let bytes;
                if (viewerState.doc) {
                    bytes = await viewerState.doc.save();
                } else if (viewerState.file) {
                    bytes = await viewerState.file.arrayBuffer();
                }
                if (bytes) {
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    blob.name = viewerState.fileName || 'Document.pdf';
                    await loadToolboxDocument(blob);
                }
                switchAppMode('toolbox');
            } catch (err) {
                console.error("openPageManagerWithCurrentDoc error:", err);
                switchAppMode('toolbox');
            }
        }

        async function addCurrentDocToBinder() {
            if (!viewerState.doc && !viewerState.pdfJsDoc) {
                showToast("No document currently open in Viewer.", "warning");
                switchAppMode('binder');
                return;
            }
            try {
                showToast("Adding active document to Binder...", "info");
                let bytes;
                if (viewerState.doc) {
                    bytes = await viewerState.doc.save();
                } else if (viewerState.file) {
                    bytes = await viewerState.file.arrayBuffer();
                }
                const blob = new Blob([bytes], { type: 'application/pdf' });
                blob.name = viewerState.fileName || 'Active_Document.pdf';

                const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
                const pdf = await loadingTask.promise;

                binderFiles.push({
                    id: 'doc_' + Date.now(),
                    file: blob,
                    name: blob.name,
                    size: formatFileSize(blob.size || bytes.byteLength),
                    pages: pdf.numPages,
                    pageRange: '',
                    rotation: 0,
                    pdfDoc: pdf
                });

                updateBinderUI();
                switchAppMode('binder');
                showToast(`Added "${blob.name}" to Binder queue`, "success");
            } catch (err) {
                console.error("addCurrentDocToBinder error:", err);
                switchAppMode('binder');
            }
        }

        // =========================================================================
        // INSERT BLANK PAGE SYSTEM (BLUEBEAM REVU STYLE - SIZE, ORIENT & GRID)
        // =========================================================================

        let insertBlankState = {
            size: 'match',
            orient: 'landscape',
            currentW: 1296,
            currentH: 864
        };

        function openInsertBlankPageModal() {
            if (!viewerState.doc && !viewerState.pdfJsDoc && !toolboxState.pdfDoc) {
                showToast("Please open a document first, or load a sample CAD plan.", "info");
                return;
            }

            // Determine active document's current page dimensions
            let curW = 1296, curH = 864;
            if (viewerState.doc && viewerState.currentPage > 0) {
                try {
                    const pages = viewerState.doc.getPages();
                    if (pages && pages[viewerState.currentPage - 1]) {
                        const s = pages[viewerState.currentPage - 1].getSize();
                        curW = s.width;
                        curH = s.height;
                    }
                } catch(e) {}
            } else if (toolboxState.pdfDoc) {
                try {
                    const pages = toolboxState.pdfDoc.getPages();
                    if (pages && pages[0]) {
                        const s = pages[0].getSize();
                        curW = s.width;
                        curH = s.height;
                    }
                } catch(e) {}
            }

            insertBlankState.currentW = curW;
            insertBlankState.currentH = curH;

            // Update "Match Current Page" label with live dimensions
            const optMatch = document.getElementById('opt-size-match');
            if (optMatch) {
                const wIn = (curW / 72).toFixed(1);
                const hIn = (curH / 72).toFixed(1);
                optMatch.innerText = `Match Current Page (${wIn}" x ${hIn}" / ${Math.round(curW)} x ${Math.round(curH)} pt)`;
            }

            // Set size select to 'match'
            const sizeSelect = document.getElementById('insert-blank-size');
            if (sizeSelect) sizeSelect.value = 'match';
            const customDims = document.getElementById('insert-blank-custom-dims');
            if (customDims) customDims.classList.add('hidden');

            // Auto-detect orientation from active page
            const initialOrient = curW >= curH ? 'landscape' : 'portrait';
            setInsertBlankOrientation(initialOrient);

            // Populate placement dropdown with active page context
            const curPage = viewerState.currentPage || 1;
            const totalPages = viewerState.pageCount || (toolboxState.pdfDoc ? toolboxState.pdfDoc.getPageCount() : 1);
            const placementSelect = document.getElementById('insert-blank-placement');
            if (placementSelect) {
                placementSelect.innerHTML = `
                    <option value="after" selected>After Current Page (${curPage})</option>
                    <option value="before">Before Current Page (${curPage})</option>
                    <option value="start">At Document Beginning (Page 1)</option>
                    <option value="end">At Document End (Page ${totalPages})</option>
                `;
            }

            const countInput = document.getElementById('insert-blank-count');
            if (countInput) countInput.value = 1;

            updateInsertBlankDimensionsPreview();
            openModal('modal-insert-blank-page');
        }

        function handleInsertBlankSizeChange(sizeVal) {
            insertBlankState.size = sizeVal;
            const customBox = document.getElementById('insert-blank-custom-dims');
            if (customBox) {
                customBox.classList.toggle('hidden', sizeVal !== 'custom');
            }
            updateInsertBlankDimensionsPreview();
        }

        function setInsertBlankOrientation(orient) {
            insertBlankState.orient = orient;
            const btnLand = document.getElementById('btn-orient-landscape');
            const btnPort = document.getElementById('btn-orient-portrait');
            if (btnLand && btnPort) {
                if (orient === 'landscape') {
                    btnLand.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-600';
                    btnPort.className = 'py-2 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center gap-2';
                } else {
                    btnPort.className = 'py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-600';
                    btnLand.className = 'py-2 px-3 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center justify-center gap-2';
                }
            }
            updateInsertBlankDimensionsPreview();
        }

        function getInsertBlankDimensions() {
            const sizeVal = document.getElementById('insert-blank-size') ? document.getElementById('insert-blank-size').value : 'match';
            let baseW = 2592, baseH = 1728; // Default ARCH D

            switch (sizeVal) {
                case 'match':
                    baseW = insertBlankState.currentW;
                    baseH = insertBlankState.currentH;
                    break;
                case 'arch-d': baseW = 2592; baseH = 1728; break; // 36" x 24"
                case 'arch-c': baseW = 1728; baseH = 1296; break; // 24" x 18"
                case 'arch-e': baseW = 3456; baseH = 2592; break; // 48" x 36"
                case 'arch-b': baseW = 1296; baseH = 864; break;  // 18" x 12"
                case 'ansi-d': baseW = 2448; baseH = 1584; break; // 34" x 22"
                case 'tabloid': baseW = 1224; baseH = 792; break; // 17" x 11"
                case 'letter': baseW = 792; baseH = 612; break;   // 11" x 8.5"
                case 'legal': baseW = 1008; baseH = 612; break;   // 14" x 8.5"
                case 'a4': baseW = 841.89; baseH = 595.28; break;
                case 'a3': baseW = 1190.55; baseH = 841.89; break;
                case 'a2': baseW = 1683.78; baseH = 1190.55; break;
                case 'a1': baseW = 2383.94; baseH = 1683.78; break;
                case 'a0': baseW = 3370.39; baseH = 2383.94; break;
                case 'custom':
                    let rawW = parseFloat(document.getElementById('insert-blank-custom-w').value) || 36;
                    let rawH = parseFloat(document.getElementById('insert-blank-custom-h').value) || 24;
                    const unitW = document.getElementById('insert-blank-custom-unit-w').value;
                    const unitH = document.getElementById('insert-blank-custom-unit-h').value;
                    baseW = unitW === 'in' ? rawW * 72 : (unitW === 'mm' ? (rawW * 72) / 25.4 : rawW);
                    baseH = unitH === 'in' ? rawH * 72 : (unitH === 'mm' ? (rawH * 72) / 25.4 : rawH);
                    break;
            }

            // Apply orientation
            let w, h;
            if (insertBlankState.orient === 'landscape') {
                w = Math.max(baseW, baseH);
                h = Math.min(baseW, baseH);
            } else {
                w = Math.min(baseW, baseH);
                h = Math.max(baseW, baseH);
            }

            return { width: Math.round(w * 100) / 100, height: Math.round(h * 100) / 100 };
        }

        function updateInsertBlankDimensionsPreview() {
            const dims = getInsertBlankDimensions();
            const badge = document.getElementById('insert-blank-dim-badge');
            if (badge) {
                const wIn = (dims.width / 72).toFixed(1);
                const hIn = (dims.height / 72).toFixed(1);
                badge.innerText = `${wIn}" x ${hIn}" (${insertBlankState.orient}) — ${Math.round(dims.width)} x ${Math.round(dims.height)} pt`;
            }
        }

        async function confirmInsertBlankPage() {
            const doc = viewerState.doc || toolboxState.pdfDoc;
            if (!doc) {
                showToast("Please open a document first.", "warning");
                return;
            }

            try {
                showToast("Inserting blank page(s)...", "info");
                const dims = getInsertBlankDimensions();
                const count = Math.max(1, parseInt(document.getElementById('insert-blank-count').value) || 1);
                const placement = document.getElementById('insert-blank-placement').value;
                const style = document.getElementById('insert-blank-style').value;

                let insertIndex;
                const totalPages = doc.getPageCount();
                const curPage = viewerState.currentPage || 1;

                if (placement === 'after') {
                    insertIndex = Math.min(totalPages, curPage);
                } else if (placement === 'before') {
                    insertIndex = Math.max(0, curPage - 1);
                } else if (placement === 'start') {
                    insertIndex = 0;
                } else {
                    insertIndex = totalPages;
                }

                for (let i = 0; i < count; i++) {
                    const newPage = doc.insertPage(insertIndex + i);
                    newPage.setSize(dims.width, dims.height);

                    // Draw optional CAD grid/templates (Bluebeam Revu style)
                    if (style === 'grid' || style === 'fine-grid') {
                        const step = style === 'fine-grid' ? 9 : 18; // 1/8" or 1/4" grid
                        const cGrid = PDFLib.rgb(0.9, 0.93, 0.97);
                        for (let x = 0; x <= dims.width; x += step) {
                            newPage.drawLine({ start: { x, y: 0 }, end: { x, y: dims.height }, thickness: 0.5, color: cGrid });
                        }
                        for (let y = 0; y <= dims.height; y += step) {
                            newPage.drawLine({ start: { x: 0, y }, end: { x: dims.width, y }, thickness: 0.5, color: cGrid });
                        }
                    } else if (style === 'dotgrid') {
                        const step = 14.17; // 5mm
                        const cDot = PDFLib.rgb(0.78, 0.82, 0.88);
                        for (let x = step; x < dims.width; x += step) {
                            for (let y = step; y < dims.height; y += step) {
                                newPage.drawCircle({ x, y, size: 0.75, color: cDot });
                            }
                        }
                    } else if (style === 'lined') {
                        const step = 24; // 1/3" ruled lines
                        const cLine = PDFLib.rgb(0.86, 0.9, 0.94);
                        for (let y = 40; y < dims.height - 40; y += step) {
                            newPage.drawLine({ start: { x: 36, y }, end: { x: dims.width - 36, y }, thickness: 0.5, color: cLine });
                        }
                    }
                }

                // Adjust viewer markups if in viewer mode
                if (viewerState.markups && viewerState.markups.length > 0) {
                    viewerState.markups = viewerState.markups.map(m => {
                        if (m.page > insertIndex) {
                            return { ...m, page: m.page + count };
                        }
                        return m;
                    });
                }

                const bytes = await doc.save();
                closeModal('modal-insert-blank-page');

                // If in viewer mode:
                if (viewerState.doc) {
                    await openViewerPDF(bytes, viewerState.fileName);
                    goToViewerPage(insertIndex + 1);
                } else if (toolboxState.pdfDoc) {
                    const blob = new Blob([bytes], { type: 'application/pdf' });
                    blob.name = toolboxState.fileName || 'document.pdf';
                    await loadToolboxDocument(blob);
                }

                const wIn = (dims.width / 72).toFixed(1);
                const hIn = (dims.height / 72).toFixed(1);
                showToast(`Inserted ${count} blank page(s) (${wIn}" x ${hIn}", ${insertBlankState.orient})`, "success");
            } catch (err) {
                console.error("confirmInsertBlankPage error:", err);
                showToast("Failed to insert blank page: " + err.message, "error");
            }
        }

        // Backward compatibility
        function insertViewerBlankPage() {
            openInsertBlankPageModal();
        }

        async function deleteViewerCurrentPage() {
            if (!viewerState.doc || viewerState.pageCount <= 1) {
                showToast("Cannot delete the only page in document.", "warning");
                return;
            }
            if (!confirm(`Delete page ${viewerState.currentPage} of ${viewerState.pageCount}?`)) return;
            try {
                const pageIdx = viewerState.currentPage - 1;
                viewerState.doc.removePage(pageIdx);
                viewerState.markups = viewerState.markups
                    .filter(m => m.page !== viewerState.currentPage)
                    .map(m => (m.page > viewerState.currentPage ? { ...m, page: m.page - 1 } : m));
                const bytes = await viewerState.doc.save();
                const targetPage = Math.max(1, viewerState.currentPage - 1);
                await openViewerPDF(bytes, viewerState.fileName);
                goToViewerPage(targetPage);
                showToast("Page deleted successfully.", "success");
            } catch (err) {
                console.error("deleteViewerCurrentPage error:", err);
                showToast("Failed to delete page: " + err.message, "error");
            }
        }

        function promptInsertViewerFile() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf,application/pdf';
            input.onchange = async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file || !viewerState.doc) return;
                try {
                    showToast("Merging external PDF pages...", "info");
                    const fileBuf = await file.arrayBuffer();
                    const extDoc = await PDFLib.PDFDocument.load(fileBuf);
                    const copiedPages = await viewerState.doc.copyPages(extDoc, extDoc.getPageIndices());
                    const insertIdx = viewerState.currentPage;
                    copiedPages.forEach((p, idx) => {
                        viewerState.doc.insertPage(insertIdx + idx, p);
                    });
                    const bytes = await viewerState.doc.save();
                    await openViewerPDF(bytes, viewerState.fileName);
                    showToast(`Inserted ${copiedPages.length} pages from "${file.name}"`, "success");
                } catch (err) {
                    console.error("promptInsertViewerFile error:", err);
                    showToast("Failed to insert file: " + err.message, "error");
                }
            };
            input.click();
        }

        async function extractViewerPages() {
            if (!viewerState.doc) {
                showToast("Please open a document first.", "warning");
                return;
            }
            const rangeStr = prompt(`Enter page numbers to extract (e.g. 1, 2-3, or leave blank for current page ${viewerState.currentPage}):`, `${viewerState.currentPage}`);
            if (rangeStr === null) return;
            try {
                const pList = parsePageRange(rangeStr.trim() || `${viewerState.currentPage}`, viewerState.pageCount);
                if (pList.length === 0) {
                    showToast("No valid pages selected.", "warning");
                    return;
                }
                const newDoc = await PDFLib.PDFDocument.create();
                const pageIndices = pList.map(p => p - 1);
                const copied = await newDoc.copyPages(viewerState.doc, pageIndices);
                copied.forEach(p => newDoc.addPage(p));
                const bytes = await newDoc.save();
                downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `Extracted_Pages_${rangeStr.replace(/[^0-9-]/g, '_')}.pdf`);
                showToast(`Extracted ${copied.length} pages to new PDF.`, "success");
            } catch (err) {
                console.error("extractViewerPages error:", err);
                showToast("Failed to extract pages: " + err.message, "error");
            }
        }

        async function flattenViewerMarkups() {
            if (!viewerState.markups || viewerState.markups.length === 0) {
                showToast("No active markups to flatten.", "info");
                return;
            }
            if (!confirm(`Flatten ${viewerState.markups.length} markups into permanent base PDF vectors? This action cannot be undone.`)) return;
            try {
                showToast("Flattening markups into drawing vectors...", "info");
                await saveModifiedPDF();
                viewerState.markups = [];
                for (let i = 1; i <= viewerState.pageCount; i++) {
                    renderPageMarkups(i);
                }
                updateMarkupsSidebarList();
                showToast("All markups successfully flattened!", "success");
            } catch (err) {
                console.error("flattenViewerMarkups error:", err);
                showToast("Failed to flatten markups: " + err.message, "error");
            }
        }