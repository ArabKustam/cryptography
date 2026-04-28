const imageEditorModule = {
    canvas: null,
    ctx: null,
    originalImage: null,
    currentFile: null,
    isDragging: false,
    renderPending: false,
    // Кэш «чистого» канваса (после вращения/отражения, но до пиксельных эффектов)
    baseImageData: null,

    // Zoom & Pan (transform-based)
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartPanX: 0,
    panStartPanY: 0,
    zoomIndicatorTimer: null,

    isCropMode: false,
    cropRect: null,
    cropCanvas: null,
    cropCtx: null,
    
    settings: {
        brightness: 100,
        contrast: 100,
        offset: 0,
        rotation: 0,
        flipH: 1,
        flipV: 1,
        lsb: false,
        invert: false
    },

    sliderMap: {
        'edit-brightness': { key: 'brightness', label: 'val-bright' },
        'edit-contrast':   { key: 'contrast',   label: 'val-contrast' },
        'edit-offset':     { key: 'offset',     label: 'val-offset' }
    },

    init() {
        this.canvas = document.getElementById('editor-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        window.CryptoUtils.setupDropZone('editor-drop', 'editor-input', this.handleImage.bind(this));

        // Ползунки — плавный live-preview через CSS фильтры (GPU)
        Object.keys(this.sliderMap).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const info = this.sliderMap[id];

            // Обновить заливку трека
            this._updateTrackFill(el);

            el.addEventListener('input', () => {
                this.settings[info.key] = parseFloat(el.value);
                const lbl = document.getElementById(info.label);
                if (lbl) lbl.textContent = el.value;
                this.isDragging = true;
                this._updateTrackFill(el);
                this._applyCSSPreview();
            });

            el.addEventListener('pointerup', () => {
                if (!this.isDragging) return;
                this.isDragging = false;
                this.canvas.style.filter = 'none';
                this.canvas.style.transition = 'none';
                this.scheduleRender();
            });

            el.addEventListener('change', () => {
                if (!this.isDragging) return;
                this.isDragging = false;
                this.canvas.style.filter = 'none';
                this.canvas.style.transition = 'none';
                this.scheduleRender();
            });
        });

        // Чекбоксы
        document.getElementById('edit-lsb').addEventListener('change', (e) => {
            this.settings.lsb = e.target.checked;
            this._rebuildBase();
            this.scheduleRender();
        });
        document.getElementById('edit-invert').addEventListener('change', (e) => {
            this.settings.invert = e.target.checked;
            this._rebuildBase();
            this.scheduleRender();
        });
        
        // Вращение
        document.getElementById('edit-rot-left').addEventListener('click', () => {
            this.settings.rotation -= 90;
            this._rebuildBase();
            this.scheduleRender();
        });
        document.getElementById('edit-rot-right').addEventListener('click', () => {
            this.settings.rotation += 90;
            this._rebuildBase();
            this.scheduleRender();
        });
        
        // Отражение
        document.getElementById('edit-flip-h').addEventListener('click', () => {
            this.settings.flipH *= -1;
            this._rebuildBase();
            this.scheduleRender();
        });
        document.getElementById('edit-flip-v').addEventListener('click', () => {
            this.settings.flipV *= -1;
            this._rebuildBase();
            this.scheduleRender();
        });
        
        document.getElementById('edit-reset').addEventListener('click', () => this.resetSettings());
        document.getElementById('edit-download').addEventListener('click', () => this.download());

        // OCR
        document.getElementById('edit-ocr-btn').addEventListener('click', () => this.recognizeText());
        document.getElementById('ocr-copy-btn').addEventListener('click', () => {
            const text = document.getElementById('ocr-output').value;
            navigator.clipboard.writeText(text)
                .then(() => alert('Текст скопирован!'))
                .catch(err => alert('Ошибка: ' + err));
        });

        // Zoom and Crop
        document.getElementById('edit-zoom-in').addEventListener('click', () => this.handleZoomIn());
        document.getElementById('edit-zoom-out').addEventListener('click', () => this.handleZoomOut());
        document.getElementById('edit-zoom-reset').addEventListener('click', () => this.handleZoomReset());
        document.getElementById('edit-crop-mode').addEventListener('click', () => this.toggleCropMode());
        
        document.getElementById('btn-crop-apply').addEventListener('click', () => this.applyCrop());
        document.getElementById('btn-crop-cancel').addEventListener('click', () => this.toggleCropMode());

        this.initCrop();
        this._initZoomPan();
    },

    handleImage(file) {
        if (!file.type.startsWith('image/')) return;
        this.currentFile = file;
        this.resetSettings();

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                
                document.getElementById('editor-drop').style.display = 'none';
                document.getElementById('editor-sidebar').style.display = 'block';
                document.getElementById('editor-canvas-container').style.display = 'block';
                document.getElementById('ocr-result-group').style.display = 'none';
                document.getElementById('ocr-progress').style.display = 'none';
                
                if (this.isCropMode) this.toggleCropMode();

                this._rebuildBase();
                this.scheduleRender();
                // Fit after render so container has dimensions
                requestAnimationFrame(() => this.fitToView());
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // Отрисовать «чистое» изображение (вращение + отражение), закэшировать пиксели
    _rebuildBase() {
        if (!this.originalImage) return;
        const img = this.originalImage;

        let rot = this.settings.rotation % 360;
        if (rot < 0) rot += 360;
        const isVertical = (rot === 90 || rot === 270);

        const w = isVertical ? img.height : img.width;
        const h = isVertical ? img.width  : img.height;

        this.canvas.width = w;
        this.canvas.height = h;

        this.ctx.clearRect(0, 0, w, h);
        this.ctx.save();
        this.ctx.translate(w / 2, h / 2);
        this.ctx.rotate((rot * Math.PI) / 180);
        this.ctx.scale(this.settings.flipH, this.settings.flipV);
        this.ctx.drawImage(img, -img.width / 2, -img.height / 2);
        this.ctx.restore();

        // Кэшируем «чистые» пиксели — это делается один раз
        this.baseImageData = this.ctx.getImageData(0, 0, w, h);
        
        // Sync crop canvas if active
        if (this.isCropMode) {
            this._syncCropCanvas();
            this.drawCropOverlay();
        }
        
        this._applyTransform();
    },

    resetSettings() {
        this.settings = {
            brightness: 100, contrast: 100, offset: 0,
            rotation: 0, flipH: 1, flipV: 1,
            lsb: false, invert: false
        };
        
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
        const txt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };

        set('edit-brightness', 100); txt('val-bright', 100);
        set('edit-contrast', 100);   txt('val-contrast', 100);
        set('edit-offset', 0);       txt('val-offset', 0);

        // Обновить заливку треков
        ['edit-brightness', 'edit-contrast', 'edit-offset'].forEach(id => {
            const el = document.getElementById(id);
            if (el) this._updateTrackFill(el);
        });
        
        const lsb = document.getElementById('edit-lsb');
        if (lsb) lsb.checked = false;
        const inv = document.getElementById('edit-invert');
        if (inv) inv.checked = false;
        
        this.canvas.style.filter = 'none';
        
        if (this.originalImage) {
            this._rebuildBase();
            this.scheduleRender();
        }
    },

    // ==========================================
    // ZOOM & PAN — CSS transform-based
    // ==========================================

    _initZoomPan() {
        const container = document.getElementById('editor-canvas-container');
        const wrapper = document.getElementById('canvas-wrapper');
        if (!container || !wrapper) return;

        // Wheel zoom — toward cursor
        container.addEventListener('wheel', (e) => {
            if (!this.canvas || !this.originalImage) return;
            e.preventDefault();

            const containerRect = container.getBoundingClientRect();
            // Mouse position relative to container
            const mx = e.clientX - containerRect.left;
            const my = e.clientY - containerRect.top;

            // Mouse position in image-space (before zoom)
            const imgX = (mx - this.panX) / this.zoom;
            const imgY = (my - this.panY) / this.zoom;

            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            let newZoom = this.zoom * factor;
            newZoom = Math.max(0.05, Math.min(80, newZoom));

            // Adjust pan so the point under cursor stays put
            this.panX = mx - imgX * newZoom;
            this.panY = my - imgY * newZoom;
            this.zoom = newZoom;

            this._applyTransform();
            this._showZoomIndicator();
        }, { passive: false });

        // Mouse drag to pan
        container.addEventListener('mousedown', (e) => {
            if (this.isCropMode) return;
            this.isPanning = true;
            this.panStartX = e.clientX;
            this.panStartY = e.clientY;
            this.panStartPanX = this.panX;
            this.panStartPanY = this.panY;
            container.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            this.panX = this.panStartPanX + (e.clientX - this.panStartX);
            this.panY = this.panStartPanY + (e.clientY - this.panStartY);
            this._applyTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                const container = document.getElementById('editor-canvas-container');
                if (container) container.style.cursor = '';
            }
        });
    },

    fitToView() {
        const container = document.getElementById('editor-canvas-container');
        if (!container || !this.canvas || !this.canvas.width) return;

        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const iw = this.canvas.width;
        const ih = this.canvas.height;

        const padding = 20;
        const scale = Math.min((cw - padding * 2) / iw, (ch - padding * 2) / ih, 1);

        this.zoom = scale;
        this.panX = (cw - iw * scale) / 2;
        this.panY = (ch - ih * scale) / 2;

        this._applyTransform();
        this._showZoomIndicator();
    },

    _applyTransform() {
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;
        wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    },

    _showZoomIndicator() {
        const el = document.getElementById('zoom-indicator');
        if (!el) return;
        el.textContent = Math.round(this.zoom * 100) + '%';
        el.style.opacity = '1';
        clearTimeout(this.zoomIndicatorTimer);
        this.zoomIndicatorTimer = setTimeout(() => {
            el.style.opacity = '0';
        }, 1200);
    },

    handleZoomIn() {
        this._zoomToCenter(1.3);
    },

    handleZoomOut() {
        this._zoomToCenter(1 / 1.3);
    },

    handleZoomReset() {
        this.fitToView();
    },

    _zoomToCenter(factor) {
        const container = document.getElementById('editor-canvas-container');
        if (!container) return;

        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;

        const imgX = (cx - this.panX) / this.zoom;
        const imgY = (cy - this.panY) / this.zoom;

        let newZoom = this.zoom * factor;
        newZoom = Math.max(0.05, Math.min(80, newZoom));

        this.panX = cx - imgX * newZoom;
        this.panY = cy - imgY * newZoom;
        this.zoom = newZoom;

        this._applyTransform();
        this._showZoomIndicator();
    },

    initCrop() {
        this.cropCanvas = document.getElementById('crop-canvas');
        if (!this.cropCanvas) return;
        this.cropCtx = this.cropCanvas.getContext('2d');
        
        let isDrawing = false;
        let startX = 0, startY = 0;
        
        const getMousePos = (e) => {
            const container = document.getElementById('editor-canvas-container');
            const containerRect = container.getBoundingClientRect();
            // Screen coords relative to container
            const sx = e.clientX - containerRect.left;
            const sy = e.clientY - containerRect.top;
            // Inverse transform to get image-space coords
            return {
                x: (sx - this.panX) / this.zoom,
                y: (sy - this.panY) / this.zoom
            };
        };

        this.cropCanvas.addEventListener('mousedown', (e) => {
            if (!this.isCropMode) return;
            isDrawing = true;
            const pos = getMousePos(e);
            startX = pos.x;
            startY = pos.y;
            this.cropRect = { x: startX, y: startY, w: 0, h: 0 };
        });

        this.cropCanvas.addEventListener('mousemove', (e) => {
            if (!isDrawing || !this.isCropMode) return;
            const pos = getMousePos(e);
            this.cropRect.w = pos.x - startX;
            this.cropRect.h = pos.y - startY;
            this.drawCropOverlay();
        });

        const endDraw = () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (this.cropRect) {
                if (this.cropRect.w < 0) {
                    this.cropRect.x += this.cropRect.w;
                    this.cropRect.w = Math.abs(this.cropRect.w);
                }
                if (this.cropRect.h < 0) {
                    this.cropRect.y += this.cropRect.h;
                    this.cropRect.h = Math.abs(this.cropRect.h);
                }
            }
        };

        this.cropCanvas.addEventListener('mouseup', endDraw);
        this.cropCanvas.addEventListener('mouseleave', endDraw);
    },

    toggleCropMode() {
        this.isCropMode = !this.isCropMode;
        const btn = document.getElementById('edit-crop-mode');
        const controls = document.getElementById('crop-controls');
        if (!btn || !controls || !this.cropCanvas) return;

        if (this.isCropMode) {
            btn.classList.add('active');
            btn.style.background = 'var(--accent-primary)';
            btn.style.borderColor = 'var(--accent-primary)';
            controls.style.display = 'flex';
            this.cropCanvas.style.display = 'block';
            this._syncCropCanvas();
            this.cropRect = null;
            this.drawCropOverlay();
        } else {
            btn.classList.remove('active');
            btn.style.background = '';
            btn.style.borderColor = '';
            controls.style.display = 'none';
            this.cropCanvas.style.display = 'none';
        }
    },

    _syncCropCanvas() {
        if (!this.isCropMode || !this.cropCanvas || !this.canvas) return;
        this.cropCanvas.width = this.canvas.width;
        this.cropCanvas.height = this.canvas.height;
    },

    drawCropOverlay() {
        const ctx = this.cropCtx;
        const w = this.cropCanvas.width;
        const h = this.cropCanvas.height;
        ctx.clearRect(0, 0, w, h);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, w, h);
        
        if (this.cropRect && this.cropRect.w && this.cropRect.h) {
            ctx.clearRect(this.cropRect.x, this.cropRect.y, this.cropRect.w, this.cropRect.h);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2 / this.zoom;
            ctx.strokeRect(this.cropRect.x, this.cropRect.y, this.cropRect.w, this.cropRect.h);
        }
    },

    applyCrop() {
        if (!this.cropRect || this.cropRect.w <= 0 || this.cropRect.h <= 0) {
            this.toggleCropMode();
            return;
        }
        
        const rw = this.cropRect.w;
        const rh = this.cropRect.h;
        const rx = this.cropRect.x;
        const ry = this.cropRect.y;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = rw;
        tempCanvas.height = rh;
        const tempCtx = tempCanvas.getContext('2d');
        
        const cleanCanvas = document.createElement('canvas');
        cleanCanvas.width = this.baseImageData.width;
        cleanCanvas.height = this.baseImageData.height;
        cleanCanvas.getContext('2d').putImageData(this.baseImageData, 0, 0);
        
        tempCtx.drawImage(cleanCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
        
        const newImg = new Image();
        newImg.onload = () => {
            this.originalImage = newImg;
            this.settings.rotation = 0;
            this.settings.flipH = 1;
            this.settings.flipV = 1;
            
            this._rebuildBase();
            this.scheduleRender();
            this.toggleCropMode();
            requestAnimationFrame(() => this.fitToView());
        };
        newImg.src = tempCanvas.toDataURL();
    },

    // Обновить градиентную заливку ползунка
    _updateTrackFill(el) {
        const min = parseFloat(el.min);
        const max = parseFloat(el.max);
        const val = parseFloat(el.value);
        const pct = ((val - min) / (max - min)) * 100;
        el.style.background = `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-secondary) ${pct}%, var(--bg-tertiary) ${pct}%)`;
    },

    // === GPU-ускоренный превью через CSS-фильтры (мгновенный, без лагов) ===
    _applyCSSPreview() {
        const b = this.settings.brightness / 100;
        const c = this.settings.contrast / 100;
        this.canvas.style.transition = 'filter 0.05s ease';
        this.canvas.style.filter = `brightness(${b}) contrast(${c})`;
    },

    scheduleRender() {
        if (this.renderPending) return;
        this.renderPending = true;
        requestAnimationFrame(() => {
            this.renderPending = false;
            this._doRender();
        });
    },

    _doRender() {
        if (!this.baseImageData) return;

        const w = this.baseImageData.width;
        const h = this.baseImageData.height;

        this.canvas.width = w;
        this.canvas.height = h;

        // Клонируем кэшированные «чистые» пиксели (быстрее чем drawImage + getImageData)
        const imageData = new ImageData(
            new Uint8ClampedArray(this.baseImageData.data),
            w, h
        );
        const d = imageData.data;
        
        const bright = this.settings.brightness / 100;
        const contr  = this.settings.contrast / 100;
        const off    = this.settings.offset;
        const lsb    = this.settings.lsb;
        const inv    = this.settings.invert;

        for (let i = 0, len = d.length; i < len; i += 4) {
            let r = d[i], g = d[i+1], b = d[i+2];

            if (lsb) {
                r = (r & 1) * 255;
                g = (g & 1) * 255;
                b = (b & 1) * 255;
            } else {
                r = ((r + off - 128) * contr + 128) * bright;
                g = ((g + off - 128) * contr + 128) * bright;
                b = ((b + off - 128) * contr + 128) * bright;
            }
            
            if (inv) { r = 255 - r; g = 255 - g; b = 255 - b; }

            d[i]   = r > 255 ? 255 : (r < 0 ? 0 : r);
            d[i+1] = g > 255 ? 255 : (g < 0 ? 0 : g);
            d[i+2] = b > 255 ? 255 : (b < 0 ? 0 : b);
        }

        this.ctx.putImageData(imageData, 0, 0);
    },

    download() {
        if (!this.originalImage) return;
        this.canvas.style.filter = 'none';
        this._doRender();
        
        const link = document.createElement('a');
        link.download = `edited_${this.currentFile ? this.currentFile.name : 'image.png'}`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    },

    async recognizeText() {
        if (!window.Tesseract) {
            alert('Библиотека Tesseract.js еще не загрузилась. Подождите пару секунд.');
            return;
        }

        this.canvas.style.filter = 'none';
        this._doRender();

        const progressDiv = document.getElementById('ocr-progress');
        const resultGroup = document.getElementById('ocr-result-group');
        const output = document.getElementById('ocr-output');
        const statusText = document.getElementById('ocr-status-text');
        const pctText = document.getElementById('ocr-pct');
        const progressFill = document.getElementById('ocr-progress-fill');
        const confidenceEl = document.getElementById('ocr-confidence');
        const lang = document.getElementById('ocr-lang').value;
        const doPreprocess = document.getElementById('ocr-preprocess').checked;
        
        progressDiv.style.display = 'block';
        resultGroup.style.display = 'none';
        output.value = '';
        statusText.textContent = 'Подготовка...';
        pctText.textContent = '0%';
        progressFill.style.width = '0%';

        try {
            let imageData;
            if (doPreprocess) {
                statusText.textContent = 'Предобработка изображения...';
                imageData = this._preprocessForOCR();
            } else {
                imageData = this.canvas.toDataURL('image/png');
            }
            
            const result = await Tesseract.recognize(
                imageData,
                lang,
                { logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round(m.progress * 100);
                        statusText.textContent = 'Распознавание текста...';
                        pctText.textContent = pct + '%';
                        progressFill.style.width = pct + '%';
                    } else if (m.status === 'loading language traineddata') {
                        const pct = Math.round(m.progress * 100);
                        statusText.textContent = 'Загрузка языкового пакета...';
                        pctText.textContent = pct + '%';
                        progressFill.style.width = (pct * 0.3) + '%';
                    } else if (m.status === 'initializing api') {
                        statusText.textContent = 'Инициализация движка...';
                    } else {
                        statusText.textContent = m.status;
                    }
                }}
            );

            progressDiv.style.display = 'none';
            resultGroup.style.display = 'block';
            
            const text = result.data.text ? result.data.text.trim() : '';
            output.value = text || 'Текст не найден';
            
            const conf = Math.round(result.data.confidence);
            if (confidenceEl) {
                confidenceEl.textContent = 'Точность: ' + conf + '%';
                confidenceEl.style.color = conf > 70 ? 'var(--success)' : conf > 40 ? 'var(--warning)' : 'var(--error)';
            }
        } catch (err) {
            progressDiv.style.display = 'none';
            alert('Ошибка OCR: ' + err.message);
        }
    },

    /**
     * Preprocessing: 3x upscale → grayscale → gentle contrast →
     * adaptive threshold (local window) → dilate thin strokes.
     * Designed to preserve thin symbols: — – - = _ . , : ;
     */
    _preprocessForOCR() {
        const src = this.canvas;
        const scale = 3; // 3x upscale preserves thin strokes much better
        const w = src.width * scale;
        const h = src.height * scale;

        const tmp = document.createElement('canvas');
        tmp.width = w;
        tmp.height = h;
        const tCtx = tmp.getContext('2d');

        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = 'high';
        tCtx.drawImage(src, 0, 0, w, h);

        const imgData = tCtx.getImageData(0, 0, w, h);
        const d = imgData.data;

        // Step 1: Convert to grayscale with gentle contrast (1.2x, not 1.5x)
        const gray = new Uint8Array(w * h);
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
            let g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
            g = ((g - 128) * 1.2) + 128;
            gray[p] = g > 255 ? 255 : (g < 0 ? 0 : g);
        }

        // Step 2: Adaptive threshold (local mean in a window)
        // This preserves thin strokes that global Otsu destroys
        const radius = Math.max(12, Math.round(Math.min(w, h) * 0.02));
        const C = 8; // bias — lower = keep more dark pixels (thin lines)
        const binary = new Uint8Array(w * h);

        // Build integral image for fast local mean
        const integral = new Float64Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
            let rowSum = 0;
            for (let x = 0; x < w; x++) {
                rowSum += gray[y * w + x];
                integral[(y + 1) * (w + 1) + (x + 1)] = rowSum + integral[y * (w + 1) + (x + 1)];
            }
        }

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const x1 = Math.max(0, x - radius);
                const y1 = Math.max(0, y - radius);
                const x2 = Math.min(w - 1, x + radius);
                const y2 = Math.min(h - 1, y + radius);
                const area = (x2 - x1 + 1) * (y2 - y1 + 1);

                const s = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
                        - integral[y1 * (w + 1) + (x2 + 1)]
                        - integral[(y2 + 1) * (w + 1) + x1]
                        + integral[y1 * (w + 1) + x1];
                const mean = s / area;

                binary[y * w + x] = gray[y * w + x] < (mean - C) ? 0 : 255;
            }
        }

        // Step 3: Dilate dark pixels by 1px to thicken thin strokes (—, =, -, _)
        const dilated = new Uint8Array(binary);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                if (binary[y * w + x] === 0) {
                    // Already dark, darken neighbors
                    dilated[(y - 1) * w + x] = 0;
                    dilated[(y + 1) * w + x] = 0;
                    dilated[y * w + (x - 1)] = 0;
                    dilated[y * w + (x + 1)] = 0;
                }
            }
        }

        // Write back
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
            d[i] = d[i+1] = d[i+2] = dilated[p];
        }

        tCtx.putImageData(imgData, 0, 0);
        return tmp.toDataURL('image/png');
    }
};
