const metadataModule = {
    FILE_SIGNATURES: {
        '89504E47': { ext: 'PNG', mime: 'image/png', icon: '🖼️' },
        'FFD8FF': { ext: 'JPEG', mime: 'image/jpeg', icon: '📷' },
        '47494638': { ext: 'GIF', mime: 'image/gif', icon: '🎞️' },
        '52494646': { ext: 'RIFF (AVI/WAV/WebP)', mime: 'media', icon: '🎵' },
        '49443303': { ext: 'MP3 (ID3v2)', mime: 'audio/mpeg', icon: '🎵' },
        '664C6143': { ext: 'FLAC', mime: 'audio/flac', icon: '🎵' },
        '4F676753': { ext: 'OGG', mime: 'audio/ogg', icon: '🎵' },
        '1A45DFA3': { ext: 'MKV/WebM', mime: 'video/webm', icon: '🎬' },
        '00000018': { ext: 'MP4', mime: 'video/mp4', icon: '🎬' },
        '0000001C': { ext: 'MP4', mime: 'video/mp4', icon: '🎬' },
        '00000020': { ext: 'MP4', mime: 'video/mp4', icon: '🎬' },
        '25504446': { ext: 'PDF', mime: 'application/pdf', icon: '📄' },
        '504B0304': { ext: 'ZIP/DOCX/XLSX', mime: 'application/zip', icon: '📦' },
        '504B0506': { ext: 'ZIP (empty)', mime: 'application/zip', icon: '📦' },
        '526172211A07': { ext: 'RAR', mime: 'application/rar', icon: '📦' },
        '377ABCAF271C': { ext: '7Z', mime: 'application/x-7z', icon: '📦' },
        '1F8B08': { ext: 'GZIP', mime: 'application/gzip', icon: '📦' },
        '425A68': { ext: 'BZ2', mime: 'application/bzip2', icon: '📦' },
        '7F454C46': { ext: 'ELF (Linux)', mime: 'application/x-elf', icon: '⚙️' },
        '4D5A': { ext: 'EXE/DLL (PE)', mime: 'application/x-exe', icon: '⚙️' },
        'CAFEBABE': { ext: 'Java Class', mime: 'application/java', icon: '☕' },
        '7B': { ext: 'JSON (вероятно)', mime: 'application/json', icon: '📋' },
        '3C3F786D6C': { ext: 'XML', mime: 'text/xml', icon: '📋' },
        '3C21444F43': { ext: 'HTML', mime: 'text/html', icon: '🌐' },
        '49545346': { ext: 'CHM', mime: 'application/chm', icon: '📘' },
        '00010000': { ext: 'TTF Font', mime: 'font/ttf', icon: '🔤' },
        '774F4646': { ext: 'WOFF Font', mime: 'font/woff', icon: '🔤' },
        '774F4632': { ext: 'WOFF2 Font', mime: 'font/woff2', icon: '🔤' },
        '424D': { ext: 'BMP', mime: 'image/bmp', icon: '🖼️' },
        '00000100': { ext: 'ICO', mime: 'image/x-icon', icon: '🖼️' },
        '38425053': { ext: 'PSD', mime: 'image/vnd.adobe.photoshop', icon: '🎨' },
        '4949': { ext: 'TIFF (LE)', mime: 'image/tiff', icon: '🖼️' },
        '4D4D': { ext: 'TIFF (BE)', mime: 'image/tiff', icon: '🖼️' },
        'FD377A585A00': { ext: 'XZ', mime: 'application/x-xz', icon: '📦' },
    },

    collectedMeta: {},

    init() {
        const drop = document.getElementById('metadata-drop');
        if (!drop) return;
        window.CryptoUtils.setupDropZone('metadata-drop', 'metadata-input', f => this.processFile(f));
    },

    async processFile(file) {
        this.collectedMeta = {};
        const res = document.getElementById('metadata-results');
        res.style.display = 'block';
        res.innerHTML = '<div class="meta-progress"><div class="meta-spinner"></div><span class="meta-progress-text">Анализ файла...</span></div>';

        const buf = await file.slice(0, 65536).arrayBuffer();
        const bytes = new Uint8Array(buf);

        const sig = this.detectSignature(bytes);
        const basicInfo = this.getBasicInfo(file, sig);
        this.collectedMeta['Основное'] = basicInfo;

        const hashInfo = await this.computeHashes(file);
        this.collectedMeta['Хеши'] = hashInfo;

        const entropy = this.calcEntropy(bytes);

        let exifData = null;
        if (file.type.startsWith('image/')) {
            exifData = await this.getExifData(file);
        }

        const strings = this.extractStrings(bytes);
        
        this.renderAll(file, sig, basicInfo, hashInfo, entropy, exifData, strings, bytes);
    },

    detectSignature(bytes) {
        const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
        for (const [magic, info] of Object.entries(this.FILE_SIGNATURES)) {
            if (hex.startsWith(magic)) return { ...info, magic };
        }
        // Check for text
        let isText = true;
        for (let i = 0; i < Math.min(bytes.length, 512); i++) {
            if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32 && bytes[i] !== 27)) { isText = false; break; }
        }
        if (isText) return { ext: 'Text', mime: 'text/plain', icon: '📝', magic: '' };
        return { ext: 'Unknown', mime: 'unknown', icon: '❓', magic: '' };
    },

    getBasicInfo(file, sig) {
        const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : '—';
        const sigMatch = sig.ext !== 'Unknown' ? (sig.ext.toLowerCase().includes(ext.toLowerCase()) || ext === '—' ? 'match' : 'mismatch') : 'unknown';
        return {
            'Имя файла': file.name,
            'Размер': this.fmtSize(file.size) + ` (${file.size.toLocaleString()} байт)`,
            'MIME тип': file.type || 'Не определён',
            'Расширение': '.' + ext,
            'Сигнатура': `${sig.icon} ${sig.ext}`,
            'Совпадение': sigMatch === 'match' ? '✅ Расширение соответствует' : sigMatch === 'mismatch' ? '⚠️ Расширение НЕ соответствует сигнатуре!' : '❓ Неизвестная сигнатура',
            'Magic bytes': sig.magic || '—',
            'Последнее изменение': new Date(file.lastModified).toLocaleString('ru-RU'),
            'Дата (ISO)': new Date(file.lastModified).toISOString(),
        };
    },

    async computeHashes(file) {
        const buf = await file.arrayBuffer();
        const [sha256, sha1] = await Promise.all([
            crypto.subtle.digest('SHA-256', buf),
            crypto.subtle.digest('SHA-1', buf),
        ]);
        const toHex = b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
        return {
            'SHA-256': toHex(sha256),
            'SHA-1': toHex(sha1),
            'CRC32': this.crc32(new Uint8Array(buf)),
        };
    },

    crc32(data) {
        let crc = ~0;
        for (let i = 0; i < data.length; i++) {
            crc ^= data[i];
            for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
        return ((~crc) >>> 0).toString(16).padStart(8, '0').toUpperCase();
    },

    calcEntropy(bytes) {
        const len = bytes.length;
        if (len === 0) return 0;
        const freq = new Array(256).fill(0);
        for (let i = 0; i < len; i++) freq[bytes[i]]++;
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (freq[i] === 0) continue;
            const p = freq[i] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    },

    extractStrings(bytes, minLen = 6) {
        const results = [];
        let current = '';
        let startOff = 0;
        for (let i = 0; i < bytes.length && results.length < 80; i++) {
            if (bytes[i] >= 32 && bytes[i] <= 126) {
                if (current.length === 0) startOff = i;
                current += String.fromCharCode(bytes[i]);
            } else {
                if (current.length >= minLen) results.push({ offset: startOff, value: current });
                current = '';
            }
        }
        if (current.length >= minLen) results.push({ offset: startOff, value: current });
        return results;
    },

    getExifData(file) {
        return new Promise(resolve => {
            if (typeof EXIF === 'undefined') { resolve(null); return; }
            EXIF.getData(file, function () {
                const all = EXIF.getAllTags(this);
                if (Object.keys(all).length === 0) { resolve(null); return; }
                const cats = { camera: {}, image: {}, gps: {}, other: {} };
                const cameraKeys = ['Make', 'Model', 'LensModel', 'LensMake', 'Software', 'FocalLength', 'FocalLengthIn35mmFilm', 'FNumber', 'ExposureTime', 'ISOSpeedRatings', 'ExposureProgram', 'MeteringMode', 'Flash', 'WhiteBalance', 'ExposureBias', 'MaxApertureValue', 'DigitalZoomRatio', 'SceneCaptureType', 'Contrast', 'Saturation', 'Sharpness'];
                const imgKeys = ['ImageWidth', 'ImageHeight', 'PixelXDimension', 'PixelYDimension', 'XResolution', 'YResolution', 'ResolutionUnit', 'ColorSpace', 'BitsPerSample', 'Orientation', 'DateTime', 'DateTimeOriginal', 'DateTimeDigitized', 'SubsecTime', 'SubsecTimeOriginal'];
                const gpsKeys = ['GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef', 'GPSAltitude', 'GPSAltitudeRef', 'GPSSpeed', 'GPSImgDirection', 'GPSDateStamp', 'GPSTimeStamp'];
                for (const [k, v] of Object.entries(all)) {
                    if (typeof v === 'object' && !(v instanceof Number) || typeof v === 'function') continue;
                    const val = String(v);
                    if (cameraKeys.includes(k)) cats.camera[k] = val;
                    else if (imgKeys.includes(k)) cats.image[k] = val;
                    else if (gpsKeys.includes(k)) cats.gps[k] = val;
                    else cats.other[k] = val;
                }
                // GPS coords conversion
                if (all.GPSLatitude && all.GPSLongitude) {
                    const toDD = (arr, ref) => {
                        const d = arr[0] + arr[1] / 60 + arr[2] / 3600;
                        return (ref === 'S' || ref === 'W') ? -d : d;
                    };
                    const lat = toDD(all.GPSLatitude, all.GPSLatitudeRef);
                    const lon = toDD(all.GPSLongitude, all.GPSLongitudeRef);
                    cats.gps['Координаты'] = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                    cats.gps['_gpsLink'] = `https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
                }
                resolve(cats);
            });
        });
    },

    renderAll(file, sig, basicInfo, hashInfo, entropy, exifData, strings, bytes) {
        const res = document.getElementById('metadata-results');
        const isImg = file.type.startsWith('image/');
        const isAudio = file.type.startsWith('audio/');
        const isVideo = file.type.startsWith('video/');

        let html = '';
        // File Hero
        html += `<div class="file-hero">
            <div class="file-hero-icon">${sig.icon}</div>
            <div class="file-hero-info">
                <div class="file-hero-name">${file.name}</div>
                <div class="file-hero-details">
                    <span class="file-hero-tag type-tag">${sig.ext}</span>
                    <span class="file-hero-tag">${this.fmtSize(file.size)}</span>
                    <span class="file-hero-tag">${file.type || 'unknown'}</span>
                </div>
            </div>
        </div>`;

        // Preview
        if (isImg || isAudio || isVideo) {
            const url = URL.createObjectURL(file);
            html += '<div class="meta-preview">';
            if (isImg) html += `<img src="${url}" alt="preview" onload="URL.revokeObjectURL(this.src)">`;
            else if (isAudio) html += `<audio controls src="${url}"></audio>`;
            else if (isVideo) html += `<video controls src="${url}" style="max-width:100%;max-height:280px;border-radius:var(--radius-md)"></video>`;
            html += '</div>';
        }

        // Tabs
        const tabs = ['📋 Метаданные', '🔐 Хеши', '📊 Энтропия', '🔡 Строки', '💾 Hex'];
        if (exifData) tabs.splice(1, 0, '📷 EXIF');
        html += '<div class="meta-tabs">';
        tabs.forEach((t, i) => html += `<button class="meta-tab${i === 0 ? ' active' : ''}" onclick="metadataModule.switchTab(this, 'mtab-${i}')" data-tab="mtab-${i}"><span>${t}</span></button>`);
        html += '</div>';

        let tabIdx = 0;

        // Tab: Metadata
        html += `<div class="meta-tab-content active" id="mtab-${tabIdx++}">`;
        html += this.renderCategory('📋', 'Основная информация', basicInfo);
        html += '</div>';

        // Tab: EXIF (if exists)
        if (exifData) {
            html += `<div class="meta-tab-content" id="mtab-${tabIdx++}">`;
            if (Object.keys(exifData.camera).length) html += this.renderCategory('📷', 'Камера', exifData.camera);
            if (Object.keys(exifData.image).length) html += this.renderCategory('🖼️', 'Изображение', exifData.image);
            if (Object.keys(exifData.gps).length) {
                const gpsCopy = { ...exifData.gps };
                const gpsLink = gpsCopy['_gpsLink'];
                delete gpsCopy['_gpsLink'];
                if (gpsLink) gpsCopy['Карта'] = `<a href="${gpsLink}" target="_blank" class="gps-link">📍 Открыть на карте</a>`;
                html += this.renderCategory('🌍', 'GPS', gpsCopy, true);
            }
            if (Object.keys(exifData.other).length) html += this.renderCategory('📎', 'Прочие EXIF', exifData.other);
            if (!Object.keys(exifData.camera).length && !Object.keys(exifData.image).length && !Object.keys(exifData.gps).length && !Object.keys(exifData.other).length) {
                html += '<p style="color:var(--text-muted);text-align:center;padding:2rem">EXIF данные не найдены</p>';
            }
            html += '</div>';
        }

        // Tab: Hashes
        html += `<div class="meta-tab-content" id="mtab-${tabIdx++}">`;
        html += this.renderHashCategory(hashInfo);
        html += '</div>';

        // Tab: Entropy
        const ePct = (entropy / 8 * 100).toFixed(1);
        const eColor = entropy < 3 ? 'var(--success)' : entropy < 6 ? 'var(--warning)' : 'var(--error)';
        const eDesc = entropy < 2 ? 'Очень низкая — структурированные/текстовые данные' : entropy < 4 ? 'Низкая — вероятно текст или код' : entropy < 6 ? 'Средняя — смешанные данные' : entropy < 7.5 ? 'Высокая — возможно сжатие' : 'Очень высокая — шифрование или сжатие';
        html += `<div class="meta-tab-content" id="mtab-${tabIdx++}">`;
        html += `<div class="meta-category"><div class="meta-category-header"><span class="cat-icon">📊</span><span class="cat-title">Анализ энтропии</span></div><div class="meta-category-body">
            <div class="entropy-bar-container"><span style="font-size:0.8rem;color:var(--text-secondary);min-width:2rem">0</span>
            <div class="entropy-bar-track"><div class="entropy-bar-fill" style="width:${ePct}%;background:${eColor}"></div></div>
            <span class="entropy-label" style="color:${eColor}">${entropy.toFixed(3)}</span><span style="font-size:0.8rem;color:var(--text-muted);min-width:2rem">8</span></div>
            <div class="entropy-description">${eDesc}</div>
            <table class="meta-table"><tr><td>Энтропия (бит/байт)</td><td>${entropy.toFixed(6)}</td></tr>
            <tr><td>Макс. энтропия</td><td>8.000000</td></tr>
            <tr><td>Рандомность</td><td>${ePct}%</td></tr>
            <tr><td>Объём анализа</td><td>${this.fmtSize(Math.min(65536, bytes.length))}</td></tr></table></div></div>`;
        html += '</div>';

        // Tab: Strings
        html += `<div class="meta-tab-content" id="mtab-${tabIdx++}">`;
        html += `<div class="meta-category"><div class="meta-category-header"><span class="cat-icon">🔡</span><span class="cat-title">Извлечённые строки</span><span class="cat-count">${strings.length}</span></div><div class="meta-category-body"><div class="strings-list">`;
        if (strings.length === 0) html += '<p style="color:var(--text-muted);padding:1.5rem;text-align:center">Строки не найдены</p>';
        else strings.forEach(s => html += `<div class="string-item"><span class="string-offset">0x${s.offset.toString(16).padStart(6, '0')}</span><span class="string-value">${this.escHtml(s.value)}</span></div>`);
        html += '</div></div></div></div>';

        // Tab: Hex
        html += `<div class="meta-tab-content" id="mtab-${tabIdx++}">`;
        html += `<div class="hex-toolbar"><div class="hex-toolbar-left"><button class="hex-size-btn active" onclick="metadataModule.setHexSize(1024,this)">1 KB</button><button class="hex-size-btn" onclick="metadataModule.setHexSize(4096,this)">4 KB</button><button class="hex-size-btn" onclick="metadataModule.setHexSize(16384,this)">16 KB</button><button class="hex-size-btn" onclick="metadataModule.setHexSize(65536,this)">64 KB</button></div></div>`;
        html += '<div class="hex-viewer-enhanced" id="hex-viewer"></div></div>';

        // Export bar
        html += `<div class="meta-export-bar"><button class="meta-export-btn" onclick="metadataModule.exportJSON()">📋 Экспорт JSON</button><button class="meta-export-btn" onclick="metadataModule.exportTXT()">📄 Экспорт TXT</button><button class="meta-export-btn" onclick="metadataModule.copyAll()">📑 Копировать всё</button></div>`;

        res.innerHTML = html;
        this._currentFile = file;
        this._currentBytes = bytes;
        this.renderHex(bytes, 1024);
    },

    renderCategory(icon, title, data, allowHtml = false) {
        const entries = Object.entries(data);
        let html = `<div class="meta-category"><div class="meta-category-header" onclick="this.parentElement.classList.toggle('collapsed')"><span class="cat-icon">${icon}</span><span class="cat-title">${title}</span><span class="cat-count">${entries.length}</span><span class="cat-toggle">▼</span></div><div class="meta-category-body"><table class="meta-table">`;
        entries.forEach(([k, v]) => html += `<tr><td>${k}</td><td>${allowHtml ? v : this.escHtml(String(v))}</td></tr>`);
        html += '</table></div></div>';
        return html;
    },

    renderHashCategory(data) {
        let html = `<div class="meta-category"><div class="meta-category-header"><span class="cat-icon">🔐</span><span class="cat-title">Контрольные суммы</span></div><div class="meta-category-body"><table class="meta-table">`;
        for (const [k, v] of Object.entries(data)) {
            html += `<tr><td>${k}</td><td><div class="hash-value"><code>${v}</code><button class="hash-copy-btn" onclick="navigator.clipboard.writeText('${v}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1500)" title="Копировать">📋</button></div></td></tr>`;
        }
        html += '</table></div></div>';
        return html;
    },

    renderHex(bytes, size) {
        const viewer = document.getElementById('hex-viewer');
        if (!viewer) return;
        const len = Math.min(bytes.length, size);
        let out = '<span class="hex-header">  Offset    00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F  |ASCII           |</span>\n';
        for (let i = 0; i < len; i += 16) {
            const off = `<span class="hex-offset">${i.toString(16).padStart(8, '0')}</span>`;
            let hex = '', ascii = '';
            for (let j = 0; j < 16; j++) {
                if (i + j < len) {
                    const b = bytes[i + j];
                    hex += b.toString(16).padStart(2, '0') + ' ';
                    ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
                } else { hex += '   '; ascii += ' '; }
                if (j === 7) hex += ' ';
            }
            out += `${off}    <span class="hex-bytes">${hex}</span> <span class="hex-ascii">|${ascii}|</span>\n`;
        }
        viewer.innerHTML = out;
    },

    setHexSize(size, btn) {
        document.querySelectorAll('.hex-size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this._currentFile) {
            this._currentFile.slice(0, size).arrayBuffer().then(buf => {
                this.renderHex(new Uint8Array(buf), size);
            });
        }
    },

    switchTab(btn, tabId) {
        btn.closest('.meta-tabs') && btn.closest('.meta-tabs').querySelectorAll('.meta-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const parent = document.getElementById('metadata-results');
        parent.querySelectorAll('.meta-tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(tabId);
        if (target) target.classList.add('active');
    },

    exportJSON() {
        const data = JSON.stringify(this.collectedMeta, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'metadata.json';
        a.click();
    },

    exportTXT() {
        let txt = '';
        for (const [cat, entries] of Object.entries(this.collectedMeta)) {
            txt += `=== ${cat} ===\n`;
            for (const [k, v] of Object.entries(entries)) txt += `${k}: ${v}\n`;
            txt += '\n';
        }
        const blob = new Blob([txt], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'metadata.txt';
        a.click();
    },

    copyAll() {
        let txt = '';
        for (const [cat, entries] of Object.entries(this.collectedMeta)) {
            txt += `=== ${cat} ===\n`;
            for (const [k, v] of Object.entries(entries)) txt += `${k}: ${v}\n`;
            txt += '\n';
        }
        navigator.clipboard.writeText(txt).then(() => {
            const btn = document.querySelector('.meta-export-btn:last-child');
            if (btn) { const orig = btn.innerHTML; btn.innerHTML = '✅ Скопировано'; setTimeout(() => btn.innerHTML = orig, 1500); }
        });
    },

    escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },

    fmtSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
    }
};
