const qrModule = {
    qrCode: null,
    logoUrl: null,
    scanCanvas: null,
    scanCtx: null,
    hasGenerated: false,

    init() {
        // Initialize QR instance
        if (typeof QRCodeStyling !== 'undefined') {
            this.qrCode = new QRCodeStyling({
                width: 300,
                height: 300,
                type: 'canvas',
                data: 'https://crypto-tools.example.com',
                image: '',
                dotsOptions: { color: '#000000', type: 'square' },
                backgroundOptions: { color: '#ffffff' },
                imageOptions: { crossOrigin: 'anonymous', margin: 10 }
            });
        }

        this.setupEventListeners();

        // Mode switch
        document.querySelectorAll('[data-qrmode]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.closest('[data-qrmode]');
                if (!target) return;

                document.querySelectorAll('[data-qrmode]').forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                const mode = target.dataset.qrmode;
                if (mode === 'create') {
                    document.getElementById('qr-create-panel').style.display = 'grid';
                    document.getElementById('qr-scan-panel').style.display = 'none';
                    // Only show result if QR was actually generated
                    if (this.hasGenerated) {
                        document.getElementById('qr-result').style.display = 'block';
                    }
                } else {
                    document.getElementById('qr-create-panel').style.display = 'none';
                    document.getElementById('qr-scan-panel').style.display = 'grid';
                    document.getElementById('qr-result').style.display = 'none';
                }
            });
        });
    },

    setupEventListeners() {
        // Generate button
        document.getElementById('generate-qr').addEventListener('click', () => this.generateQR());

        // Settings listeners
        const updateParams = ['qr-dot-style', 'qr-corner-style', 'qr-dot-color', 'qr-bg-color'];
        updateParams.forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.updatePreview());
            document.getElementById(id).addEventListener('input', () => this.updatePreview());
        });

        document.getElementById('qr-gradient').addEventListener('change', (e) => {
            document.getElementById('qr-gradient-color-group').style.display =
                e.target.value === 'none' ? 'none' : 'block';
            this.updatePreview();
        });
        document.getElementById('qr-gradient-color').addEventListener('input', () => this.updatePreview());
        document.getElementById('qr-size').addEventListener('change', () => this.generateQR());

        // Logo upload
        window.CryptoUtils.setupDropZone('qr-logo-drop', 'qr-logo-input', this.handleLogo.bind(this));
        document.getElementById('qr-logo-clear').addEventListener('click', () => this.clearLogo());

        // Downloads
        document.getElementById('download-qr-png').addEventListener('click', () => this.download('png'));
        document.getElementById('download-qr-svg').addEventListener('click', () => this.download('svg'));

        // SCANNER
        window.CryptoUtils.setupDropZone('qr-scan-drop', 'qr-scan-input', this.handleScanFile.bind(this));
        document.getElementById('scan-qr-btn').addEventListener('click', () => this.scanImage());
        document.getElementById('qr-copy-btn').addEventListener('click', () => {
            const text = document.getElementById('qr-scan-text').textContent;
            navigator.clipboard.writeText(text).then(() => alert('Скопировано!'));
        });
    },

    handleLogo(file) {
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.logoUrl = e.target.result;
            document.getElementById('qr-logo-img').src = this.logoUrl;
            document.getElementById('qr-logo-drop').style.display = 'none';
            document.getElementById('qr-logo-preview').style.display = 'block';
            this.updatePreview();
        };
        reader.readAsDataURL(file);
    },

    handleScanFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('qr-scan-img');
            img.src = e.target.result;
            document.getElementById('qr-scan-drop').style.display = 'none';
            document.getElementById('qr-scan-preview-box').style.display = 'block';
            document.getElementById('qr-scan-result').style.display = 'none';
        };
        reader.readAsDataURL(file);
    },

    scanImage() {
        const img = document.getElementById('qr-scan-img');
        if (!img.src) return;

        // Create canvas to read pixels
        if (!this.scanCanvas) {
            this.scanCanvas = document.createElement('canvas');
            this.scanCtx = this.scanCanvas.getContext('2d');
        }

        this.scanCanvas.width = img.naturalWidth;
        this.scanCanvas.height = img.naturalHeight;
        this.scanCtx.drawImage(img, 0, 0);

        const imageData = this.scanCtx.getImageData(0, 0, this.scanCanvas.width, this.scanCanvas.height);

        // Scan with jsQR
        if (typeof jsQR === 'undefined') {
            alert('Библиотека сканера не загружена');
            return;
        }

        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
            const resultBox = document.getElementById('qr-scan-result');
            const resultText = document.getElementById('qr-scan-text');
            const openLinkBtn = document.getElementById('qr-open-link');

            resultBox.style.display = 'block';
            resultText.textContent = code.data;

            // Check if URL
            if (code.data.startsWith('http')) {
                openLinkBtn.style.display = 'inline-flex';
                openLinkBtn.href = code.data;
            } else {
                openLinkBtn.style.display = 'none';
            }
        } else {
            alert('QR-код не найден на изображении. Попробуйте другую картинку.');
        }
    },

    clearLogo() {
        this.logoUrl = null;
        document.getElementById('qr-logo-drop').style.display = 'block';
        document.getElementById('qr-logo-preview').style.display = 'none';
        document.getElementById('qr-logo-input').value = '';
        this.updatePreview();
    },

    getOptions() {
        const content = document.getElementById('qr-content').value || 'https://crypto-tools.example.com';
        const size = parseInt(document.getElementById('qr-size').value);
        const dotStyle = document.getElementById('qr-dot-style').value;
        const cornerStyle = document.getElementById('qr-corner-style').value;
        const dotColor = document.getElementById('qr-dot-color').value;
        const bgColor = document.getElementById('qr-bg-color').value;
        const gradientType = document.getElementById('qr-gradient').value;
        const gradientColor = document.getElementById('qr-gradient-color').value;

        const options = {
            width: size,
            height: size,
            type: 'canvas',
            data: content,
            image: this.logoUrl,
            dotsOptions: {
                color: dotColor,
                type: dotStyle
            },
            cornersSquareOptions: {
                type: cornerStyle
            },
            cornersDotOptions: {
                type: cornerStyle === 'square' ? 'square' : 'dot'
            },
            backgroundOptions: {
                color: bgColor,
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: 5
            }
        };

        if (gradientType !== 'none') {
            options.dotsOptions.gradient = {
                type: gradientType,
                rotation: 45,
                colorStops: [
                    { offset: 0, color: dotColor },
                    { offset: 1, color: gradientColor }
                ]
            };
        } else {
            delete options.dotsOptions.gradient;
        }

        return options;
    },

    updatePreview() {
        if (!this.qrCode || !this.hasGenerated) return;
        // Only update standard options, full regen for size change
        const options = this.getOptions();
        // Use current size for preview to avoid re-rendering layout
        options.width = 300;
        options.height = 300;
        this.qrCode.update(options);
    },

    generateQR() {
        const content = document.getElementById('qr-content').value;
        if (!content || !content.trim()) {
            alert('Введите содержимое для QR-кода');
            return;
        }

        if (!this.qrCode) {
            alert('Библиотека QR не загружена. Попробуйте обновить страницу.');
            return;
        }

        const options = this.getOptions();
        this.qrCode.update(options);

        const canvasContainer = document.querySelector('.qr-display');

        // Clear previous canvas
        canvasContainer.innerHTML = '';
        this.qrCode.append(canvasContainer);

        this.hasGenerated = true;
        document.getElementById('qr-result').style.display = 'block';

        // Scroll to result
        document.getElementById('qr-result').scrollIntoView({ behavior: 'smooth' });
    },

    download(ext) {
        if (!this.qrCode || !this.hasGenerated) return;
        const content = document.getElementById('qr-content').value || 'qr-code';
        const name = content.substring(0, 10).replace(/[^a-z0-9]/gi, '_');
        this.qrCode.download({ name: name, extension: ext });
    }
};
// refactor: optimize internal handler
