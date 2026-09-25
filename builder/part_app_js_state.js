        // ==========================================
        // VIEWER & MARKUP STUDIO: STATE MANAGEMENT
        // ==========================================
        const viewerState = {
            doc: null,            // PDFLib.PDFDocument instance
            pdfJsDoc: null,       // PDFJS Document instance
            file: null,           // Current File / Blob
            fileName: '',
            pageCount: 0,
            currentPage: 1,       // 1-indexed
            zoom: 1.0,
            rotation: 0,          // 0, 90, 180, 270
            pageDimensions: [],   // Array of { width, height } in PDF points
            activeTool: 'select', // 'select', 'hand', 'textbox', 'callout', 'note', 'pen', 'highlighter', 'eraser', 'rect', 'circle', 'line', 'arrow', 'cloud', 'polyline', 'polygon', 'measure-length', 'measure-area', 'measure-perimeter', 'count', 'stamp', 'sign'
            activeColor: '#0e87eb',
            activeStrokeWidth: 2,
            activeFillColor: 'transparent',
            activeFillOpacity: 0.2,
            activeFontSize: 12,
            activeFontColor: '#0f172a',
            activeLineStyle: 'solid',
            selectedMarkupId: null,
            markups: [],          // Array of markup objects
            // Scale calibration: 1/4" = 1'-0" default for CAD plans.
            // 72 pt = 1 inch. 1/4" = 18 pt. If 18 pt = 1 ft, scaleFactor = 1 / 18 ft per point.
            scale: {
                ratio: 18,        // points per real-world unit
                unit: 'ft',       // real-world unit ('ft', 'in', 'm', 'mm', 'cm')
                label: '1/4" = 1\'-0"'
            },
            undoStack: [],
            redoStack: [],
            isDrawing: false,
            drawStart: { x: 0, y: 0 },
            currentPolyPoints: [],
            isPanning: false,
            panStart: { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 },
            transformState: {
                mode: null,       // 'move', 'resize', 'rotate'
                handle: null,     // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'rot'
                startX: 0,
                startY: 0,
                origMarkup: null
            },
            pendingStamp: null,   // Pre-configured stamp ready for click-to-place
            pendingSignature: null,// Pre-configured signature ready for click-to-place
            searchResults: [],
            searchIndex: -1
        };

        // Theme management helper
        function initTheme() {
            const savedTheme = localStorage.getItem('agy_pdf_theme');
            if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
                updateThemeIcon(true);
            } else {
                document.documentElement.classList.remove('dark');
                updateThemeIcon(false);
            }
        }

        function toggleDarkMode() {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('agy_pdf_theme', isDark ? 'dark' : 'light');
            updateThemeIcon(isDark);
        }

        function updateThemeIcon(isDark) {
            const icon = document.getElementById('theme-toggle-icon');
            if (icon) {
                icon.className = isDark ? 'fa-solid fa-sun text-sm text-amber-400' : 'fa-solid fa-moon text-sm';
            }
        }
