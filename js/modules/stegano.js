const steganoModule = {
    image: null,

    init() {
        window.CryptoUtils.setupDropZone('stegano-drop', 'stegano-input', this.handleImage.bind(this));
        this.setupModeSwitch();
        document.getElementById('encode-btn').addEventListener('click', () => this.encode());
        document.getElementById('decode-btn').addEventListener('click', () => this.decode());
        document.getElementById('download-stegano').addEventListener('click', () => this.download());
        document.getElementById('stegano-clear').addEventListener('click', () => this.clear());
    },

    handleImage(file) {
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                document.getElementById('stegano-img').src = e.target.result;
                document.getElementById('stegano-drop').style.display = 'none';
                document.getElementById('stegano-preview').style.display = 'block';
                document.getElementById('stegano-result').style.display = 'none';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    setupModeSwitch() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const mode = btn.dataset.mode;
                document.getElementById('encode-controls').style.display = mode === 'encode' ? 'block' : 'none';
                document.getElementById('decode-controls').style.display = mode === 'decode' ? 'block' : 'none';
                document.getElementById('stegano-result').style.display = 'none';
                document.getElementById('decode-result').style.display = 'none';
            });
        });
    },

    encode() {
        if (!this.image) {
            alert('Сначала загрузи изображение');
            return;
        }

        const text = document.getElementById('secret-text').value;
        if (!text) {
            alert('Введи текст для скрытия');
            return;
        }

        const canvas = document.getElementById('stegano-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.image.width;
        canvas.height = this.image.height;
        ctx.drawImage(this.image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert text to binary with length prefix
        const textBytes = new TextEncoder().encode(text);
        const lengthBytes = new Uint8Array(4);
        new DataView(lengthBytes.buffer).setUint32(0, textBytes.length);
        const allBytes = new Uint8Array([...lengthBytes, ...textBytes]);

        let binary = '';
        allBytes.forEach(byte => binary += byte.toString(2).padStart(8, '0'));

        // Check if image is large enough
        const maxBits = Math.floor((data.length / 4) * 3);
        if (binary.length > maxBits) {
            alert('Изображение слишком маленькое для этого текста');
            return;
        }

        // Embed binary data into LSB of RGB channels
        let bitIndex = 0;
        for (let i = 0; i < data.length && bitIndex < binary.length; i += 4) {
            for (let j = 0; j < 3 && bitIndex < binary.length; j++) {
                data[i + j] = (data[i + j] & 0xFE) | parseInt(binary[bitIndex]);
                bitIndex++;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        document.getElementById('stegano-result').style.display = 'block';
    },

    decode() {
        if (!this.image) {
            alert('Сначала загрузи изображение');
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = this.image.width;
        canvas.height = this.image.height;
        ctx.drawImage(this.image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Extract binary from LSB
        let binary = '';
        for (let i = 0; i < data.length; i += 4) {
            for (let j = 0; j < 3; j++) {
                binary += (data[i + j] & 1);
            }
        }

        // Read length (first 32 bits)
        const lengthBinary = binary.slice(0, 32);
        const length = parseInt(lengthBinary, 2);

        if (length <= 0 || length > 1000000) {
            document.getElementById('decoded-text').textContent = 'Скрытый текст не найден';
            document.getElementById('decode-result').style.display = 'block';
            return;
        }

        // Extract message bytes
        const bytes = [];
        for (let i = 0; i < length; i++) {
            const start = 32 + i * 8;
            const byteBinary = binary.slice(start, start + 8);
            bytes.push(parseInt(byteBinary, 2));
        }

        try {
            const text = new TextDecoder().decode(new Uint8Array(bytes));
            document.getElementById('decoded-text').textContent = text;
        } catch {
            document.getElementById('decoded-text').textContent = 'Ошибка декодирования';
        }

        document.getElementById('decode-result').style.display = 'block';
    },

    download() {
        const canvas = document.getElementById('stegano-canvas');
        const link = document.createElement('a');
        link.download = 'stegano_image.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    },

    clear() {
        this.image = null;
        document.getElementById('stegano-drop').style.display = 'block';
        document.getElementById('stegano-preview').style.display = 'none';
        document.getElementById('stegano-result').style.display = 'none';
        document.getElementById('decode-result').style.display = 'none';
        document.getElementById('secret-text').value = '';
        document.getElementById('stegano-input').value = '';
    }
};
