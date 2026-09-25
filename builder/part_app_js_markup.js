        // ==========================================
        // VIEWER & MARKUP STUDIO: INTERACTIVE MARKUPS
        // ==========================================

        function setRibbonTab(tabName) {
            ['home', 'markup', 'shapes', 'measure', 'stamps', 'compare', 'pages', 'binder'].forEach(t => {
                const btn = document.getElementById(`ribbon-tab-${t}`);
                const panel = document.getElementById(`ribbon-panel-${t}`);
                const active = t === tabName;
                if (btn) {
                    btn.className = active
                        ? 'px-3 py-1.5 font-semibold text-brand-600 dark:text-brand-400 border-b-2 border-brand-600 dark:border-brand-400 whitespace-nowrap flex items-center gap-1.5'
                        : 'px-3 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-b-2 border-transparent whitespace-nowrap flex items-center gap-1.5';
                }
                if (panel) {
                    panel.classList.toggle('hidden', !active);
                }
            });

            // Synchronize top navbar active button
            const navMap = {
                'home': 'nav-mode-viewer',
                'markup': 'nav-mode-viewer',
                'shapes': 'nav-mode-viewer',
                'measure': 'nav-mode-viewer',
                'stamps': 'nav-mode-viewer',
                'compare': 'nav-mode-compare',
                'pages': 'nav-mode-toolbox',
                'binder': 'nav-mode-binder'
            };
            const targetNavId = navMap[tabName] || 'nav-mode-viewer';
            ['nav-mode-viewer', 'nav-mode-compare', 'nav-mode-toolbox', 'nav-mode-binder'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('active', id === targetNavId);
            });
        }

        function switchStudioTab(tabName) {
            // Keep user in unified studio and activate corresponding tool group
            switchAppMode('viewer');
            setRibbonTab(tabName);
        }

        function setActiveViewerTool(toolName) {
            viewerState.activeTool = toolName;

            // Update ribbon button states
            document.querySelectorAll('.ribbon-btn').forEach(b => b.classList.remove('active'));
            const activeBtn = document.getElementById(`tool-${toolName}`);
            if (activeBtn) activeBtn.classList.add('active');

            // Update badge & hint in sub-bar
            const badge = document.getElementById('active-tool-badge');
            const hint = document.getElementById('active-tool-hint');
            if (badge) badge.innerText = toolName.toUpperCase().replace('-', ' ');

            const hints = {
                'select': 'Click markup to select, drag to move, drag handles to resize or rotate. Del to remove.',
                'hand': 'Click and drag to pan around document viewport.',
                'select-text': 'Click and drag over document text to highlight and copy.',
                'textbox': 'Click and drag on page to create text box.',
                'callout': 'Click to place leader arrow, then drag to place text box.',
                'note': 'Click on page to place a sticky review note.',
                'pen': 'Draw freehand lines and sketches.',
                'highlighter': 'Highlight text or drawing areas with semi-transparent ink.',
                'eraser': 'Click any markup to immediately delete it.',
                'rect': 'Click and drag to draw rectangle.',
                'circle': 'Click and drag to draw circle / ellipse.',
                'line': 'Click and drag to draw straight line.',
                'arrow': 'Click and drag to draw pointer arrow.',
                'cloud': 'Click and drag to draw architectural revision cloud.',
                'polyline': 'Click to add points. Double-click or press Enter to finish polyline.',
                'polygon': 'Click to add points. Double-click or press Enter to close polygon.',
                'measure-length': 'Click and drag between 2 points to measure linear distance.',
                'measure-area': 'Click and drag to measure rectangular area, or click points.',
                'measure-perimeter': 'Click points to measure cumulative perimeter distance.',
                'count': 'Click to place numbered punch-list markers (#1, #2, #3...).',
                'stamp': 'Click anywhere on page to place rubber stamp.',
                'sign': 'Click anywhere on page to place signature.'
            };
            if (hint) hint.innerText = hints[toolName] || 'Select tool';

            // Cursor styling on viewport
            const viewport = document.getElementById('viewer-viewport');
            if (viewport) {
                if (toolName === 'hand') viewport.style.cursor = 'grab';
                else if (toolName === 'select-text') viewport.style.cursor = 'text';
                else if (toolName === 'select') viewport.style.cursor = 'default';
                else viewport.style.cursor = 'crosshair';
            }

            // Text layer interactivity
            document.querySelectorAll('.pdf-text-layer').forEach(layer => {
                layer.classList.toggle('interactive', toolName === 'select-text');
            });

            if (toolName !== 'select') {
                deselectViewerMarkup();
            }
        }

        function setViewerQuickColor(color) {
            viewerState.activeColor = color;
            const picker = document.getElementById('quick-color-picker');
            if (picker) picker.value = color;

            if (viewerState.selectedMarkupId) {
                updateSelectedMarkupProperty('strokeColor', color);
            }
        }

        function setViewerQuickWidth(width) {
            viewerState.activeStrokeWidth = parseFloat(width);
            if (viewerState.selectedMarkupId) {
                updateSelectedMarkupProperty('strokeWidth', parseFloat(width));
            }
        }

        // --- SVG OVERLAY INTERACTION & DRAWING ENGINE ---
        function attachSvgOverlayListeners(svg, pageIndex) {
            let activeDrawingMarkup = null;

            svg.addEventListener('pointerdown', (e) => {
                const pt = getSvgCoordinates(svg, e);

                // 1. If Hand tool is active, pan viewport
                if (viewerState.activeTool === 'hand' || e.spaceKey || e.button === 1) {
                    viewerState.isPanning = true;
                    const vp = document.getElementById('viewer-viewport');
                    viewerState.panStart = { x: e.clientX, y: e.clientY, scrollLeft: vp.scrollLeft, scrollTop: vp.scrollTop };
                    svg.style.cursor = 'grabbing';
                    return;
                }

                // 2. Pending Stamp or Signature placement
                if (viewerState.pendingStamp) {
                    placeConfiguredStamp(pageIndex, pt.x, pt.y, viewerState.pendingStamp);
                    viewerState.pendingStamp = null;
                    setActiveViewerTool('select');
                    return;
                }
                if (viewerState.pendingSignature) {
                    placeConfiguredSignature(pageIndex, pt.x, pt.y, viewerState.pendingSignature);
                    viewerState.pendingSignature = null;
                    setActiveViewerTool('select');
                    return;
                }

                // 3. Selection & Transformation Handle detection
                if (viewerState.activeTool === 'select') {
                    const handleTarget = e.target.closest('.sel-handle, .sel-rotate-handle');
                    if (handleTarget) {
                        e.stopPropagation();
                        const handleType = handleTarget.dataset.handle;
                        const markup = viewerState.markups.find(m => m.id === viewerState.selectedMarkupId);
                        if (markup) {
                            viewerState.transformState = {
                                mode: handleType === 'rot' ? 'rotate' : 'resize',
                                handle: handleType,
                                startX: pt.x,
                                startY: pt.y,
                                origMarkup: JSON.parse(JSON.stringify(markup))
                            };
                        }
                        return;
                    }

                    const markupTarget = e.target.closest('.markup-elem');
                    if (markupTarget) {
                        e.stopPropagation();
                        const markupId = markupTarget.dataset.id;
                        selectViewerMarkup(markupId);
                        const markup = viewerState.markups.find(m => m.id === markupId);
                        if (markup) {
                            viewerState.transformState = {
                                mode: 'move',
                                handle: null,
                                startX: pt.x,
                                startY: pt.y,
                                origMarkup: JSON.parse(JSON.stringify(markup))
                            };
                        }
                        return;
                    }

                    // Clicked empty area: deselect
                    deselectViewerMarkup();
                    return;
                }

                // 4. Eraser Tool: Click to delete
                if (viewerState.activeTool === 'eraser') {
                    const markupTarget = e.target.closest('.markup-elem');
                    if (markupTarget) {
                        deleteMarkupById(markupTarget.dataset.id);
                        showToast("Markup deleted", "info");
                    }
                    return;
                }

                // 5. Count Tool: Single click to drop number marker
                if (viewerState.activeTool === 'count') {
                    const countMarkups = viewerState.markups.filter(m => m.type === 'count');
                    const countNum = countMarkups.length + 1;
                    const newMarkup = {
                        id: 'markup_' + Date.now(),
                        page: pageIndex,
                        type: 'count',
                        x: pt.x - 14,
                        y: pt.y - 14,
                        width: 28,
                        height: 28,
                        count: countNum,
                        strokeColor: viewerState.activeColor,
                        strokeWidth: 2,
                        fillColor: viewerState.activeColor,
                        fillOpacity: 0.85,
                        textColor: '#ffffff',
                        fontSize: 12,
                        author: 'User',
                        date: new Date().toLocaleDateString(),
                        subject: `Punch Item #${countNum}`
                    };
                    saveMarkup(newMarkup);
                    return;
                }

                // 6. Sticky Note: Single click to drop note
                if (viewerState.activeTool === 'note') {
                    const newMarkup = {
                        id: 'markup_' + Date.now(),
                        page: pageIndex,
                        type: 'note',
                        x: pt.x,
                        y: pt.y,
                        width: 32,
                        height: 32,
                        strokeColor: '#f59e0b',
                        strokeWidth: 1.5,
                        fillColor: '#fef08a',
                        fillOpacity: 1.0,
                        text: 'Review note: Click to view details.',
                        author: 'User',
                        date: new Date().toLocaleDateString(),
                        subject: 'Review Comment'
                    };
                    saveMarkup(newMarkup);
                    selectViewerMarkup(newMarkup.id);
                    return;
                }

                // 7. Drawing Tools: Start bounding / polyline drawing
                viewerState.isDrawing = true;
                viewerState.drawStart = { x: pt.x, y: pt.y };

                const baseMarkup = {
                    id: 'markup_' + Date.now(),
                    page: pageIndex,
                    type: viewerState.activeTool,
                    x: pt.x,
                    y: pt.y,
                    width: 1,
                    height: 1,
                    strokeColor: viewerState.activeColor,
                    strokeWidth: viewerState.activeStrokeWidth,
                    fillColor: viewerState.activeFillColor,
                    fillOpacity: viewerState.activeFillOpacity,
                    lineStyle: viewerState.activeLineStyle,
                    author: 'User',
                    date: new Date().toLocaleDateString(),
                    subject: viewerState.activeTool.toUpperCase()
                };

                if (viewerState.activeTool === 'pen' || viewerState.activeTool === 'highlighter') {
                    baseMarkup.points = [{ x: pt.x, y: pt.y }];
                    if (viewerState.activeTool === 'highlighter') {
                        baseMarkup.strokeColor = viewerState.activeColor;
                        baseMarkup.strokeWidth = 14;
                        baseMarkup.fillOpacity = 0.35;
                    }
                } else if (viewerState.activeTool === 'callout') {
                    baseMarkup.targetX = pt.x;
                    baseMarkup.targetY = pt.y;
                    baseMarkup.text = 'Callout note';
                    baseMarkup.fontSize = 11;
                    baseMarkup.textColor = '#0369a1';
                    baseMarkup.fillColor = '#f0f9ff';
                    baseMarkup.fillOpacity = 0.9;
                } else if (viewerState.activeTool === 'textbox') {
                    baseMarkup.text = 'Double-click to edit text';
                    baseMarkup.fontSize = 13;
                    baseMarkup.textColor = viewerState.activeFontColor;
                    baseMarkup.fillColor = '#ffffff';
                    baseMarkup.fillOpacity = 0.9;
                }

                activeDrawingMarkup = baseMarkup;
            });

            svg.addEventListener('pointermove', (e) => {
                const pt = getSvgCoordinates(svg, e);
                updateCursorCoordinates(pt.x, pt.y);

                // Panning Viewport
                if (viewerState.isPanning) {
                    const vp = document.getElementById('viewer-viewport');
                    const dx = e.clientX - viewerState.panStart.x;
                    const dy = e.clientY - viewerState.panStart.y;
                    vp.scrollLeft = viewerState.panStart.scrollLeft - dx;
                    vp.scrollTop = viewerState.panStart.scrollTop - dy;
                    return;
                }

                // Transforming Selected Markup (Move / Resize / Rotate)
                if (viewerState.transformState && viewerState.transformState.mode) {
                    const ts = viewerState.transformState;
                    const markup = viewerState.markups.find(m => m.id === viewerState.selectedMarkupId);
                    if (!markup) return;

                    const dx = pt.x - ts.startX;
                    const dy = pt.y - ts.startY;

                    if (ts.mode === 'move') {
                        markup.x = Math.round(ts.origMarkup.x + dx);
                        markup.y = Math.round(ts.origMarkup.y + dy);
                        if (markup.type === 'callout' && ts.origMarkup.targetX !== undefined) {
                            // Move callout box while keeping target point fixed (or offset proportionally)
                        }
                    } else if (ts.mode === 'resize') {
                        const orig = ts.origMarkup;
                        if (ts.handle.includes('e')) markup.width = Math.max(10, orig.width + dx);
                        if (ts.handle.includes('s')) markup.height = Math.max(10, orig.height + dy);
                        if (ts.handle.includes('w')) {
                            const newW = Math.max(10, orig.width - dx);
                            markup.x = orig.x + (orig.width - newW);
                            markup.width = newW;
                        }
                        if (ts.handle.includes('n')) {
                            const newH = Math.max(10, orig.height - dy);
                            markup.y = orig.y + (orig.height - newH);
                            markup.height = newH;
                        }
                    } else if (ts.mode === 'rotate') {
                        const cx = markup.x + markup.width / 2;
                        const cy = markup.y + markup.height / 2;
                        const angleRad = Math.atan2(pt.y - cy, pt.x - cx);
                        let angleDeg = Math.round(angleRad * (180 / Math.PI)) + 90;
                        if (angleDeg < 0) angleDeg += 360;
                        markup.rotation = angleDeg;
                    }

                    renderPageMarkups(pageIndex);
                    return;
                }

                // Active Drawing Markup Live Preview
                if (viewerState.isDrawing && activeDrawingMarkup) {
                    const start = viewerState.drawStart;

                    if (activeDrawingMarkup.type === 'pen' || activeDrawingMarkup.type === 'highlighter') {
                        activeDrawingMarkup.points.push({ x: pt.x, y: pt.y });
                    } else {
                        activeDrawingMarkup.x = Math.min(start.x, pt.x);
                        activeDrawingMarkup.y = Math.min(start.y, pt.y);
                        activeDrawingMarkup.width = Math.abs(pt.x - start.x);
                        activeDrawingMarkup.height = Math.abs(pt.y - start.y);

                        if (activeDrawingMarkup.type === 'callout') {
                            activeDrawingMarkup.targetX = start.x;
                            activeDrawingMarkup.targetY = start.y;
                            activeDrawingMarkup.x = pt.x;
                            activeDrawingMarkup.y = pt.y;
                            activeDrawingMarkup.width = 140;
                            activeDrawingMarkup.height = 45;
                        }
                    }

                    renderLiveDrawingPreview(svg, activeDrawingMarkup);
                }
            });

            const finishAction = () => {
                if (viewerState.isPanning) {
                    viewerState.isPanning = false;
                    svg.style.cursor = viewerState.activeTool === 'hand' ? 'grab' : 'crosshair';
                }

                if (viewerState.transformState && viewerState.transformState.mode) {
                    viewerState.transformState = { mode: null, handle: null, startX: 0, startY: 0, origMarkup: null };
                    pushUndoState();
                    updateMarkupsSidebarList();
                }

                if (viewerState.isDrawing && activeDrawingMarkup) {
                    viewerState.isDrawing = false;
                    const removePreview = svg.querySelector('#live-drawing-preview');
                    if (removePreview) removePreview.remove();

                    // Only save if meaningful size
                    if (activeDrawingMarkup.points || activeDrawingMarkup.width > 5 || activeDrawingMarkup.height > 5) {
                        saveMarkup(activeDrawingMarkup);
                        selectViewerMarkup(activeDrawingMarkup.id);
                        showToast(`Created ${activeDrawingMarkup.type} markup`, "success");
                    }
                    activeDrawingMarkup = null;
                }
            };

            svg.addEventListener('pointerup', finishAction);
            svg.addEventListener('pointercancel', finishAction);
        }

        function getSvgCoordinates(svg, e) {
            const rect = svg.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        function updateCursorCoordinates(x, y) {
            const coordsEl = document.getElementById('viewer-cursor-coords');
            if (!coordsEl) return;
            const xIn = (x / 72).toFixed(2);
            const yIn = (y / 72).toFixed(2);
            coordsEl.innerHTML = `<i class="fa-solid fa-crosshairs text-slate-400"></i> X: ${xIn}" Y: ${yIn}"`;
        }

        // --- DRAWING PREVIEW HELPER ---
        function renderLiveDrawingPreview(svg, markup) {
            let preview = svg.querySelector('#live-drawing-preview');
            if (!preview) {
                preview = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                preview.id = 'live-drawing-preview';
                svg.appendChild(preview);
            }
            preview.innerHTML = '';
            const elem = createSvgElementForMarkup(markup);
            elem.setAttribute('opacity', '0.75');
            preview.appendChild(elem);
        }

        // --- MARKUP RENDERING (SVG NODES) ---
        function renderPageMarkups(pageIndex) {
            const svg = document.getElementById(`pdf-markup-svg-${pageIndex}`);
            if (!svg) return;
            svg.innerHTML = '';

            const pageMarkups = viewerState.markups.filter(m => m.page === pageIndex);

            pageMarkups.forEach(markup => {
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.setAttribute('class', 'markup-elem');
                group.dataset.id = markup.id;

                if (markup.rotation) {
                    const cx = markup.x + markup.width / 2;
                    const cy = markup.y + markup.height / 2;
                    group.setAttribute('transform', `rotate(${markup.rotation} ${cx} ${cy})`);
                }

                // Create main shape / text node
                const shapeElem = createSvgElementForMarkup(markup);
                group.appendChild(shapeElem);

                // Double click to edit text inline
                if (['textbox', 'callout', 'note'].includes(markup.type)) {
                    group.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        promptEditTextMarkup(markup);
                    });
                }

                // If selected, render Selection Box and 8 Resize Handles + Rotation Handle
                if (markup.id === viewerState.selectedMarkupId) {
                    renderSelectionHandles(group, markup);
                }

                svg.appendChild(group);
            });
        }

        function createSvgElementForMarkup(m) {
            const ns = 'http://www.w3.org/2000/svg';

            if (m.type === 'rect') {
                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', m.x);
                rect.setAttribute('y', m.y);
                rect.setAttribute('width', m.width);
                rect.setAttribute('height', m.height);
                rect.setAttribute('stroke', m.strokeColor);
                rect.setAttribute('stroke-width', m.strokeWidth);
                rect.setAttribute('fill', m.fillColor || 'transparent');
                rect.setAttribute('fill-opacity', m.fillOpacity || 0.2);
                if (m.lineStyle === 'dashed') rect.setAttribute('stroke-dasharray', '6 4');
                if (m.lineStyle === 'dotted') rect.setAttribute('stroke-dasharray', '2 4');
                return rect;
            }

            if (m.type === 'circle') {
                const ellipse = document.createElementNS(ns, 'ellipse');
                ellipse.setAttribute('cx', m.x + m.width / 2);
                ellipse.setAttribute('cy', m.y + m.height / 2);
                ellipse.setAttribute('rx', m.width / 2);
                ellipse.setAttribute('ry', m.height / 2);
                ellipse.setAttribute('stroke', m.strokeColor);
                ellipse.setAttribute('stroke-width', m.strokeWidth);
                ellipse.setAttribute('fill', m.fillColor || 'transparent');
                ellipse.setAttribute('fill-opacity', m.fillOpacity || 0.2);
                return ellipse;
            }

            if (m.type === 'line' || m.type === 'arrow') {
                const g = document.createElementNS(ns, 'g');
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', m.x);
                line.setAttribute('y1', m.y);
                line.setAttribute('x2', m.x + m.width);
                line.setAttribute('y2', m.y + m.height);
                line.setAttribute('stroke', m.strokeColor);
                line.setAttribute('stroke-width', m.strokeWidth);
                g.appendChild(line);

                if (m.type === 'arrow') {
                    const arrowHead = document.createElementNS(ns, 'polygon');
                    const angle = Math.atan2(m.height, m.width);
                    const headLen = 12;
                    const x2 = m.x + m.width;
                    const y2 = m.y + m.height;
                    const p1x = x2 - headLen * Math.cos(angle - Math.PI / 6);
                    const p1y = y2 - headLen * Math.sin(angle - Math.PI / 6);
                    const p2x = x2 - headLen * Math.cos(angle + Math.PI / 6);
                    const p2y = y2 - headLen * Math.sin(angle + Math.PI / 6);
                    arrowHead.setAttribute('points', `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`);
                    arrowHead.setAttribute('fill', m.strokeColor);
                    g.appendChild(arrowHead);
                }
                return g;
            }

            if (m.type === 'cloud') {
                // Architectural Scalloped Cloud Algorithm
                const path = document.createElementNS(ns, 'path');
                const d = generateRevisionCloudPath(m.x, m.y, m.width, m.height, 16);
                path.setAttribute('d', d);
                path.setAttribute('stroke', m.strokeColor || '#dc2626');
                path.setAttribute('stroke-width', m.strokeWidth || 2.5);
                path.setAttribute('fill', m.fillColor || '#fee2e2');
                path.setAttribute('fill-opacity', m.fillOpacity || 0.2);
                return path;
            }

            if (m.type === 'pen' || m.type === 'highlighter') {
                const path = document.createElementNS(ns, 'path');
                if (m.points && m.points.length > 0) {
                    let d = `M ${m.points[0].x} ${m.points[0].y}`;
                    for (let i = 1; i < m.points.length; i++) {
                        d += ` L ${m.points[i].x} ${m.points[i].y}`;
                    }
                    path.setAttribute('d', d);
                }
                path.setAttribute('stroke', m.strokeColor);
                path.setAttribute('stroke-width', m.strokeWidth);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                if (m.type === 'highlighter') {
                    path.setAttribute('opacity', '0.35');
                    path.setAttribute('style', 'mix-blend-mode: multiply;');
                }
                return path;
            }

            if (m.type === 'textbox') {
                const g = document.createElementNS(ns, 'g');
                const bg = document.createElementNS(ns, 'rect');
                bg.setAttribute('x', m.x);
                bg.setAttribute('y', m.y);
                bg.setAttribute('width', m.width);
                bg.setAttribute('height', m.height);
                bg.setAttribute('fill', m.fillColor || '#ffffff');
                bg.setAttribute('fill-opacity', m.fillOpacity !== undefined ? m.fillOpacity : 0.95);
                bg.setAttribute('stroke', m.strokeColor || '#cbd5e1');
                bg.setAttribute('stroke-width', m.strokeWidth || 1);
                bg.setAttribute('rx', '4');

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', m.x + 8);
                text.setAttribute('y', m.y + (m.fontSize || 12) + 4);
                text.setAttribute('font-size', m.fontSize || 12);
                text.setAttribute('font-family', 'Segoe UI, sans-serif');
                text.setAttribute('fill', m.textColor || '#0f172a');
                text.textContent = m.text || '';

                g.appendChild(bg);
                g.appendChild(text);
                return g;
            }

            if (m.type === 'callout') {
                const g = document.createElementNS(ns, 'g');
                // Leader line from target to text box
                const tx = m.targetX !== undefined ? m.targetX : m.x - 30;
                const ty = m.targetY !== undefined ? m.targetY : m.y - 30;
                const bx = m.x;
                const by = m.y + m.height / 2;

                const leader = document.createElementNS(ns, 'line');
                leader.setAttribute('x1', tx);
                leader.setAttribute('y1', ty);
                leader.setAttribute('x2', bx);
                leader.setAttribute('y2', by);
                leader.setAttribute('stroke', m.strokeColor || '#0284c7');
                leader.setAttribute('stroke-width', m.strokeWidth || 2);

                // Arrow head at target
                const arrow = document.createElementNS(ns, 'circle');
                arrow.setAttribute('cx', tx);
                arrow.setAttribute('cy', ty);
                arrow.setAttribute('r', '3');
                arrow.setAttribute('fill', m.strokeColor || '#0284c7');

                // Text box
                const bg = document.createElementNS(ns, 'rect');
                bg.setAttribute('x', m.x);
                bg.setAttribute('y', m.y);
                bg.setAttribute('width', m.width);
                bg.setAttribute('height', m.height);
                bg.setAttribute('fill', m.fillColor || '#e0f2fe');
                bg.setAttribute('fill-opacity', m.fillOpacity !== undefined ? m.fillOpacity : 0.95);
                bg.setAttribute('stroke', m.strokeColor || '#0284c7');
                bg.setAttribute('stroke-width', m.strokeWidth || 1.5);
                bg.setAttribute('rx', '4');

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', m.x + 8);
                text.setAttribute('y', m.y + 20);
                text.setAttribute('font-size', m.fontSize || 11);
                text.setAttribute('font-weight', '500');
                text.setAttribute('fill', m.textColor || '#0369a1');
                text.textContent = m.text || 'Callout';

                g.appendChild(leader);
                g.appendChild(arrow);
                g.appendChild(bg);
                g.appendChild(text);
                return g;
            }

            if (m.type === 'measure-length') {
                const g = document.createElementNS(ns, 'g');
                const x1 = m.x;
                const y1 = m.y;
                const x2 = m.x + m.width;
                const y2 = m.y + m.height;

                // Main dimension line
                const line = document.createElementNS(ns, 'line');
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', m.strokeColor || '#059669');
                line.setAttribute('stroke-width', m.strokeWidth || 2);

                // Dimension end ticks
                const tickLen = 8;
                const angle = Math.atan2(m.height, m.width);
                const perp = angle + Math.PI / 2;

                const tick1 = document.createElementNS(ns, 'line');
                tick1.setAttribute('x1', x1 - tickLen * Math.cos(perp));
                tick1.setAttribute('y1', y1 - tickLen * Math.sin(perp));
                tick1.setAttribute('x2', x1 + tickLen * Math.cos(perp));
                tick1.setAttribute('y2', y1 + tickLen * Math.sin(perp));
                tick1.setAttribute('stroke', m.strokeColor || '#059669');
                tick1.setAttribute('stroke-width', 2);

                const tick2 = document.createElementNS(ns, 'line');
                tick2.setAttribute('x1', x2 - tickLen * Math.cos(perp));
                tick2.setAttribute('y1', y2 - tickLen * Math.sin(perp));
                tick2.setAttribute('x2', x2 + tickLen * Math.cos(perp));
                tick2.setAttribute('y2', y2 + tickLen * Math.sin(perp));
                tick2.setAttribute('stroke', m.strokeColor || '#059669');
                tick2.setAttribute('stroke-width', 2);

                // Real-world length readout label
                const distPx = Math.hypot(m.width, m.height);
                const formattedDim = formatRealWorldLength(distPx);

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                const labelBg = document.createElementNS(ns, 'rect');
                labelBg.setAttribute('x', midX - 35);
                labelBg.setAttribute('y', midY - 18);
                labelBg.setAttribute('width', 70);
                labelBg.setAttribute('height', 18);
                labelBg.setAttribute('fill', '#ffffff');
                labelBg.setAttribute('stroke', m.strokeColor || '#059669');
                labelBg.setAttribute('stroke-width', 1);
                labelBg.setAttribute('rx', 3);

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', midX);
                text.setAttribute('y', midY - 5);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '10');
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('font-family', 'monospace');
                text.setAttribute('fill', m.strokeColor || '#059669');
                text.textContent = formattedDim;

                g.appendChild(line);
                g.appendChild(tick1);
                g.appendChild(tick2);
                g.appendChild(labelBg);
                g.appendChild(text);
                return g;
            }

            if (m.type === 'measure-area') {
                const g = document.createElementNS(ns, 'g');
                const rect = document.createElementNS(ns, 'rect');
                rect.setAttribute('x', m.x);
                rect.setAttribute('y', m.y);
                rect.setAttribute('width', m.width);
                rect.setAttribute('height', m.height);
                rect.setAttribute('stroke', m.strokeColor || '#10b981');
                rect.setAttribute('stroke-width', m.strokeWidth || 2);
                rect.setAttribute('stroke-dasharray', '4 3');
                rect.setAttribute('fill', m.fillColor || '#d1fae5');
                rect.setAttribute('fill-opacity', 0.35);

                const areaPx = m.width * m.height;
                const formattedArea = formatRealWorldArea(areaPx);

                const midX = m.x + m.width / 2;
                const midY = m.y + m.height / 2;

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', midX);
                text.setAttribute('y', midY);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '11');
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('font-family', 'monospace');
                text.setAttribute('fill', '#047857');
                text.textContent = `Area: ${formattedArea}`;

                g.appendChild(rect);
                g.appendChild(text);
                return g;
            }

            if (m.type === 'count') {
                const g = document.createElementNS(ns, 'g');
                const circle = document.createElementNS(ns, 'circle');
                circle.setAttribute('cx', m.x + 14);
                circle.setAttribute('cy', m.y + 14);
                circle.setAttribute('r', '13');
                circle.setAttribute('fill', m.fillColor || '#0e87eb');
                circle.setAttribute('stroke', '#ffffff');
                circle.setAttribute('stroke-width', '2');

                const text = document.createElementNS(ns, 'text');
                text.setAttribute('x', m.x + 14);
                text.setAttribute('y', m.y + 18);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '11');
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('fill', '#ffffff');
                text.textContent = `#${m.count || 1}`;

                g.appendChild(circle);
                g.appendChild(text);
                return g;
            }

            if (m.type === 'stamp') {
                const g = document.createElementNS(ns, 'g');
                const border = document.createElementNS(ns, 'rect');
                border.setAttribute('x', m.x);
                border.setAttribute('y', m.y);
                border.setAttribute('width', m.width);
                border.setAttribute('height', m.height);
                border.setAttribute('fill', '#ffffff');
                border.setAttribute('fill-opacity', '0.9');
                border.setAttribute('stroke', m.strokeColor || '#059669');
                border.setAttribute('stroke-width', '3');
                border.setAttribute('rx', '6');

                const innerBorder = document.createElementNS(ns, 'rect');
                innerBorder.setAttribute('x', m.x + 4);
                innerBorder.setAttribute('y', m.y + 4);
                innerBorder.setAttribute('width', m.width - 8);
                innerBorder.setAttribute('height', m.height - 8);
                innerBorder.setAttribute('fill', 'none');
                innerBorder.setAttribute('stroke', m.strokeColor || '#059669');
                innerBorder.setAttribute('stroke-width', '1');
                innerBorder.setAttribute('rx', '4');

                const title = document.createElementNS(ns, 'text');
                title.setAttribute('x', m.x + m.width / 2);
                title.setAttribute('y', m.y + 28);
                title.setAttribute('text-anchor', 'middle');
                title.setAttribute('font-size', '16');
                title.setAttribute('font-weight', '900');
                title.setAttribute('letter-spacing', '2');
                title.setAttribute('fill', m.strokeColor || '#059669');
                title.textContent = m.text || 'APPROVED';

                const meta = document.createElementNS(ns, 'text');
                meta.setAttribute('x', m.x + m.width / 2);
                meta.setAttribute('y', m.y + 46);
                meta.setAttribute('text-anchor', 'middle');
                meta.setAttribute('font-size', '9');
                meta.setAttribute('font-weight', '600');
                meta.setAttribute('fill', m.strokeColor || '#059669');
                meta.textContent = `BY: ${m.author || 'User'}  |  ${m.date || ''}`;

                g.appendChild(border);
                g.appendChild(innerBorder);
                g.appendChild(title);
                g.appendChild(meta);
                return g;
            }

            if (m.type === 'sign') {
                const g = document.createElementNS(ns, 'g');
                const bg = document.createElementNS(ns, 'rect');
                bg.setAttribute('x', m.x);
                bg.setAttribute('y', m.y);
                bg.setAttribute('width', m.width);
                bg.setAttribute('height', m.height);
                bg.setAttribute('fill', '#ffffff');
                bg.setAttribute('fill-opacity', '0.85');
                bg.setAttribute('stroke', '#cbd5e1');
                bg.setAttribute('stroke-width', '1');
                bg.setAttribute('rx', '4');

                if (m.dataUrl) {
                    const img = document.createElementNS(ns, 'image');
                    img.setAttribute('href', m.dataUrl);
                    img.setAttribute('x', m.x + 5);
                    img.setAttribute('y', m.y + 5);
                    img.setAttribute('width', m.width - 10);
                    img.setAttribute('height', m.height - 10);
                    g.appendChild(bg);
                    g.appendChild(img);
                } else {
                    const text = document.createElementNS(ns, 'text');
                    text.setAttribute('x', m.x + 15);
                    text.setAttribute('y', m.y + m.height / 2 + 6);
                    text.setAttribute('font-family', 'Georgia, cursive, serif');
                    text.setAttribute('font-size', '20');
                    text.setAttribute('font-style', 'italic');
                    text.setAttribute('fill', '#002b49');
                    text.textContent = m.text || 'Signed';
                    g.appendChild(bg);
                    g.appendChild(text);
                }
                return g;
            }

            // Fallback generic box
            const fallback = document.createElementNS(ns, 'rect');
            fallback.setAttribute('x', m.x);
            fallback.setAttribute('y', m.y);
            fallback.setAttribute('width', m.width);
            fallback.setAttribute('height', m.height);
            fallback.setAttribute('stroke', m.strokeColor || '#0e87eb');
            fallback.setAttribute('stroke-width', '2');
            fallback.setAttribute('fill', 'none');
            return fallback;
        }

        // --- SELECTION BOUNDING BOX & 8 RESIZE HANDLES + ROTATION HANDLE ---
        function renderSelectionHandles(group, m) {
            const ns = 'http://www.w3.org/2000/svg';

            // Selection dashed box
            const selBox = document.createElementNS(ns, 'rect');
            selBox.setAttribute('class', 'sel-box');
            selBox.setAttribute('x', m.x - 3);
            selBox.setAttribute('y', m.y - 3);
            selBox.setAttribute('width', m.width + 6);
            selBox.setAttribute('height', m.height + 6);
            group.appendChild(selBox);

            // 8 Resize Handles
            const handles = [
                { pos: 'nw', x: m.x - 4, y: m.y - 4, cursor: 'nwse-resize' },
                { pos: 'n', x: m.x + m.width / 2 - 4, y: m.y - 4, cursor: 'ns-resize' },
                { pos: 'ne', x: m.x + m.width - 4, y: m.y - 4, cursor: 'nesw-resize' },
                { pos: 'e', x: m.x + m.width - 4, y: m.y + m.height / 2 - 4, cursor: 'ew-resize' },
                { pos: 'se', x: m.x + m.width - 4, y: m.y + m.height - 4, cursor: 'nwse-resize' },
                { pos: 's', x: m.x + m.width / 2 - 4, y: m.y + m.height - 4, cursor: 'ns-resize' },
                { pos: 'sw', x: m.x - 4, y: m.y + m.height - 4, cursor: 'nesw-resize' },
                { pos: 'w', x: m.x - 4, y: m.y + m.height / 2 - 4, cursor: 'ew-resize' }
            ];

            handles.forEach(h => {
                const handle = document.createElementNS(ns, 'rect');
                handle.setAttribute('class', 'sel-handle');
                handle.setAttribute('x', h.x);
                handle.setAttribute('y', h.y);
                handle.setAttribute('width', '8');
                handle.setAttribute('height', '8');
                handle.setAttribute('style', `cursor: ${h.cursor};`);
                handle.dataset.handle = h.pos;
                group.appendChild(handle);
            });

            // Rotation handle & connecting stem
            const stem = document.createElementNS(ns, 'line');
            stem.setAttribute('class', 'sel-rotate-stem');
            stem.setAttribute('x1', m.x + m.width / 2);
            stem.setAttribute('y1', m.y - 3);
            stem.setAttribute('x2', m.x + m.width / 2);
            stem.setAttribute('y2', m.y - 20);
            group.appendChild(stem);

            const rotHandle = document.createElementNS(ns, 'circle');
            rotHandle.setAttribute('class', 'sel-rotate-handle');
            rotHandle.setAttribute('cx', m.x + m.width / 2);
            rotHandle.setAttribute('cy', m.y - 20);
            rotHandle.setAttribute('r', '5');
            rotHandle.dataset.handle = 'rot';
            group.appendChild(rotHandle);
        }

        // --- ARCHITECTURAL REVISION CLOUD SCALLOPED ARCS ALGORITHM ---
        function generateRevisionCloudPath(x, y, w, h, radius = 16) {
            let d = '';
            // Top Edge (Left to Right)
            const numTop = Math.max(1, Math.round(w / (radius * 1.5)));
            const stepTop = w / numTop;
            d += `M ${x} ${y}`;
            for (let i = 0; i < numTop; i++) {
                const xEnd = x + (i + 1) * stepTop;
                d += ` A ${radius} ${radius} 0 0 1 ${xEnd} ${y}`;
            }
            // Right Edge (Top to Bottom)
            const numRight = Math.max(1, Math.round(h / (radius * 1.5)));
            const stepRight = h / numRight;
            for (let i = 0; i < numRight; i++) {
                const yEnd = y + (i + 1) * stepRight;
                d += ` A ${radius} ${radius} 0 0 1 ${x + w} ${yEnd}`;
            }
            // Bottom Edge (Right to Left)
            const numBottom = Math.max(1, Math.round(w / (radius * 1.5)));
            const stepBottom = w / numBottom;
            for (let i = 0; i < numBottom; i++) {
                const xEnd = (x + w) - (i + 1) * stepBottom;
                d += ` A ${radius} ${radius} 0 0 1 ${xEnd} ${y + h}`;
            }
            // Left Edge (Bottom to Top)
            const numLeft = Math.max(1, Math.round(h / (radius * 1.5)));
            const stepLeft = h / numLeft;
            for (let i = 0; i < numLeft; i++) {
                const yEnd = (y + h) - (i + 1) * stepLeft;
                d += ` A ${radius} ${radius} 0 0 1 ${x} ${yEnd}`;
            }
            d += ' Z';
            return d;
        }

        // --- REAL WORLD MEASUREMENT FORMATTERS ---
        function formatRealWorldLength(px) {
            // viewerState.scale.ratio = points per unit (default: 18 points = 1 foot)
            const units = px / viewerState.scale.ratio;
            if (viewerState.scale.unit === 'ft') {
                const totalInches = units * 12;
                const feet = Math.floor(totalInches / 12);
                const inches = (totalInches % 12).toFixed(1);
                return `${feet}'-${inches}"`;
            }
            return `${units.toFixed(2)} ${viewerState.scale.unit}`;
        }

        function formatRealWorldArea(sqPx) {
            const sqUnits = sqPx / (viewerState.scale.ratio * viewerState.scale.ratio);
            if (viewerState.scale.unit === 'ft') {
                return `${sqUnits.toFixed(1)} sq ft`;
            }
            return `${sqUnits.toFixed(2)} ${viewerState.scale.unit}²`;
        }

        // --- SELECTION & PROPERTY UPDATES ---
        function selectViewerMarkup(markupId) {
            viewerState.selectedMarkupId = markupId;
            const markup = viewerState.markups.find(m => m.id === markupId);
            if (!markup) return;

            // Re-render to show selection handles
            renderPageMarkups(markup.page);

            // Populate Inspector
            const strokeColorEl = document.getElementById('prop-stroke-color');
            if (strokeColorEl && markup.strokeColor) strokeColorEl.value = markup.strokeColor;
            const strokeTextEl = document.getElementById('prop-stroke-color-text');
            if (strokeTextEl && markup.strokeColor) strokeTextEl.value = markup.strokeColor;

            const strokeWidthEl = document.getElementById('prop-stroke-width');
            if (strokeWidthEl && markup.strokeWidth) strokeWidthEl.value = markup.strokeWidth;

            const fillColorEl = document.getElementById('prop-fill-color');
            if (fillColorEl && markup.fillColor && markup.fillColor !== 'transparent') fillColorEl.value = markup.fillColor;

            const fillOpacityEl = document.getElementById('prop-fill-opacity');
            if (fillOpacityEl && markup.fillOpacity !== undefined) {
                fillOpacityEl.value = markup.fillOpacity;
                const valEl = document.getElementById('prop-fill-opacity-val');
                if (valEl) valEl.innerText = Math.round(markup.fillOpacity * 100) + '%';
            }

            const textSec = document.getElementById('inspector-typography-section');
            if (textSec) {
                const isText = ['textbox', 'callout', 'note', 'stamp'].includes(markup.type);
                textSec.classList.toggle('hidden', !isText);
                if (isText) {
                    const textInput = document.getElementById('prop-text-content');
                    if (textInput) textInput.value = markup.text || '';
                }
            }
        }

        function deselectViewerMarkup() {
            if (!viewerState.selectedMarkupId) return;
            const oldId = viewerState.selectedMarkupId;
            viewerState.selectedMarkupId = null;
            const markup = viewerState.markups.find(m => m.id === oldId);
            if (markup) {
                renderPageMarkups(markup.page);
            }
        }

        function updateSelectedMarkupProperty(prop, value) {
            const markup = viewerState.markups.find(m => m.id === viewerState.selectedMarkupId);
            if (!markup) return;
            markup[prop] = value;
            renderPageMarkups(markup.page);
            updateMarkupsSidebarList();
        }

        function deleteSelectedMarkup() {
            if (!viewerState.selectedMarkupId) return;
            deleteMarkupById(viewerState.selectedMarkupId);
        }

        function deleteMarkupById(id) {
            const idx = viewerState.markups.findIndex(m => m.id === id);
            if (idx !== -1) {
                const page = viewerState.markups[idx].page;
                viewerState.markups.splice(idx, 1);
                viewerState.selectedMarkupId = null;
                renderPageMarkups(page);
                updateMarkupsSidebarList();
                pushUndoState();
            }
        }

        function duplicateSelectedMarkup() {
            const markup = viewerState.markups.find(m => m.id === viewerState.selectedMarkupId);
            if (!markup) return;
            const clone = JSON.parse(JSON.stringify(markup));
            clone.id = 'markup_' + Date.now();
            clone.x += 20;
            clone.y += 20;
            saveMarkup(clone);
            selectViewerMarkup(clone.id);
            showToast("Duplicated markup", "info");
        }

        function bringSelectedMarkupToFront() {
            const idx = viewerState.markups.findIndex(m => m.id === viewerState.selectedMarkupId);
            if (idx === -1) return;
            const item = viewerState.markups.splice(idx, 1)[0];
            viewerState.markups.push(item);
            renderPageMarkups(item.page);
            pushUndoState();
        }

        function sendSelectedMarkupToBack() {
            const idx = viewerState.markups.findIndex(m => m.id === viewerState.selectedMarkupId);
            if (idx === -1) return;
            const item = viewerState.markups.splice(idx, 1)[0];
            viewerState.markups.unshift(item);
            renderPageMarkups(item.page);
            pushUndoState();
        }

        function saveMarkup(markup) {
            viewerState.markups.push(markup);
            renderPageMarkups(markup.page);
            updateMarkupsSidebarList();
            pushUndoState();
        }

        function promptEditTextMarkup(markup) {
            const current = markup.text || '';
            const newText = prompt("Edit Markup Text:", current);
            if (newText !== null) {
                markup.text = newText;
                renderPageMarkups(markup.page);
                updateMarkupsSidebarList();
                pushUndoState();
            }
        }

        // --- UNDO / REDO ENGINE ---
        function pushUndoState() {
            viewerState.undoStack.push(JSON.stringify(viewerState.markups));
            if (viewerState.undoStack.length > 30) viewerState.undoStack.shift();
            viewerState.redoStack = [];
        }

        function undoViewerAction() {
            if (viewerState.undoStack.length === 0) return;
            viewerState.redoStack.push(JSON.stringify(viewerState.markups));
            const prev = viewerState.undoStack.pop();
            viewerState.markups = JSON.parse(prev);
            for (let i = 1; i <= viewerState.pageCount; i++) {
                renderPageMarkups(i);
            }
            updateMarkupsSidebarList();
            showToast("Undo performed", "info");
        }

        function redoViewerAction() {
            if (viewerState.redoStack.length === 0) return;
            viewerState.undoStack.push(JSON.stringify(viewerState.markups));
            const next = viewerState.redoStack.pop();
            viewerState.markups = JSON.parse(next);
            for (let i = 1; i <= viewerState.pageCount; i++) {
                renderPageMarkups(i);
            }
            updateMarkupsSidebarList();
            showToast("Redo performed", "info");
        }
