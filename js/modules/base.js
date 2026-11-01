const baseModule = {
    mode: 'encode',
    datatype: 'text',
    file: null,

    init() {
        document.querySelectorAll('[data-base-mode]').forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.baseMode));
        });

        document.getElementById('base-datatype').addEventListener('change', (e) => {
            this.datatype = e.target.value;
            this.updateInputUI();
        });

        window.CryptoUtils.setupDropZone('base-file-drop', 'base-file-input', this.handleFile.bind(this));
        
        document.getElementById('base-file-clear').addEventListener('click', () => this.clearFile());
        document.getElementById('base-action-btn').addEventListener('click', () => this.executeAction());
        document.getElementById('base-copy-btn').addEventListener('click', () => this.copyResult());
        document.getElementById('base-download-btn').addEventListener('click', () => this.downloadResult());
    },

    switchMode(mode) {
        this.mode = mode;
        document.querySelectorAll('[data-base-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.baseMode === mode);
        });
        document.getElementById('base-action-text').textContent = mode === 'encode' ? 'Закодировать' : 'Декодировать';
        document.getElementById('base-result').style.display = 'none';
    },

    updateInputUI() {
        if (this.datatype === 'text') {
            document.getElementById('base-text-input-group').style.display = 'block';
            document.getElementById('base-file-input-group').style.display = 'none';
        } else {
            document.getElementById('base-text-input-group').style.display = 'none';
            document.getElementById('base-file-input-group').style.display = 'block';
        }
        document.getElementById('base-result').style.display = 'none';
    },

    handleFile(file) {
        this.file = file;
        document.getElementById('base-file-drop').style.display = 'none';
        document.getElementById('base-file-preview').style.display = 'flex';
        document.getElementById('base-file-name').textContent = file.name;
        document.getElementById('base-result').style.display = 'none';
    },

    clearFile() {
        this.file = null;
        document.getElementById('base-file-drop').style.display = 'block';
        document.getElementById('base-file-preview').style.display = 'none';
        document.getElementById('base-file-input').value = '';
    },

    async executeAction() {
        const algo = document.getElementById('base-algorithm').value;
        const resultSection = document.getElementById('base-result');
        const textGroup = document.getElementById('base-result-text-group');
        const fileGroup = document.getElementById('base-result-file-group');
        const outputText = document.getElementById('base-output-text');
        
        try {
            if (this.mode === 'encode') {
                let bytes;
                if (this.datatype === 'text') {
                    const text = document.getElementById('base-input-text').value;
                    if (!text) return alert('Введите текст');
                    bytes = new TextEncoder().encode(text);
                } else {
                    if (!this.file) return alert('Выберите файл');
                    bytes = await this.fileToBytes(this.file);
                }

                let encoded = '';
                if (algo === 'base64') encoded = this.bytesToBase64(bytes);
                else if (algo === 'base32') encoded = this.bytesToBase32(bytes);
                else if (algo === 'base16') encoded = this.bytesToHex(bytes);
                else if (algo === 'base2') encoded = this.bytesToBinary(bytes);

                outputText.value = encoded;
                textGroup.style.display = 'block';
                fileGroup.style.display = 'none';

            } else { // Decode
                let encodedStr = '';
                if (this.datatype === 'text') {
                    encodedStr = document.getElementById('base-input-text').value.trim();
                } else {
                    if (!this.file) return alert('Выберите файл с кодом');
                    encodedStr = await this.fileToText(this.file);
                    encodedStr = encodedStr.trim();
                }

                if (!encodedStr) return alert('Нет данных для декодирования');

                let bytes;
                if (algo === 'base64') bytes = this.base64ToBytes(encodedStr);
                else if (algo === 'base32') bytes = this.base32ToBytes(encodedStr);
                else if (algo === 'base16') bytes = this.hexToBytes(encodedStr);
                else if (algo === 'base2') bytes = this.binaryToBytes(encodedStr);

                // Пытаемся определить, изображение ли это
                const type = this.detectMimeType(bytes);
                
                let forceFile = false;
                if (type && type.startsWith('image/')) {
                    // Если это точно картинка, лучше показать её
                    forceFile = true;
                } else if (this.datatype === 'file' && type) {
                    forceFile = true;
                }

                if (!forceFile && this.datatype === 'text') {
                    // Пользователь ввел текст и хочет получить текст. 
                    // Декодируем даже если есть непечатаемые символы (будут )
                    const decodedText = new TextDecoder('utf-8').decode(bytes);
                    outputText.value = decodedText;
                    textGroup.style.display = 'block';
                    fileGroup.style.display = 'none';
                } else {
                    // Это бинарные данные или картинка
                    this.decodedBlob = new Blob([bytes], { type: type || 'application/octet-stream' });
                    
                    textGroup.style.display = 'none';
                    fileGroup.style.display = 'block';
                    
                    const imgPreview = document.getElementById('base-image-preview');
                    const imgOut = document.getElementById('base-output-image');
                    
                    if (type && type.startsWith('image/')) {
                        imgOut.src = URL.createObjectURL(this.decodedBlob);
                        imgPreview.style.display = 'block';
                    } else {
                        imgPreview.style.display = 'none';
                    }
                }
            }
            resultSection.style.display = 'block';
        } catch (err) {
            console.error(err);
            alert('Ошибка при выполнении: ' + err.message);
        }
    },

    fileToBytes(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(new Uint8Array(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    },

    fileToText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },

    bytesToBinary(bytes) {
        return Array.from(bytes).map(b => b.toString(2).padStart(8, '0')).join(' ');
    },

    binaryToBytes(bin) {
        bin = bin.replace(/[^01]/g, '');
        const bytes = [];
        for (let i = 0; i < bin.length; i += 8) {
            bytes.push(parseInt(bin.slice(i, i + 8), 2));
        }
        return new Uint8Array(bytes);
    },

    bytesToHex(bytes) {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    },

    hexToBytes(hex) {
        // Убираем пробелы и переносы строк, которые могут быть в коде
        hex = hex.replace(/\s+/g, '');
        const match = hex.match(/.{1,2}/g) || [];
        return new Uint8Array(match.map(byte => parseInt(byte, 16)));
    },

    bytesToBase32(bytes) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = 0, value = 0, output = '';
        for (let i = 0; i < bytes.length; i++) {
            value = (value << 8) | bytes[i];
            bits += 8;
            while (bits >= 5) {
                output += chars[(value >>> (bits - 5)) & 31];
                bits -= 5;
            }
        }
        if (bits > 0) output += chars[(value << (5 - bits)) & 31];
        while (output.length % 8 !== 0) output += '=';
        return output;
    },

    base32ToBytes(str) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        str = str.replace(/\s+/g, '').replace(/=+$/, '').toUpperCase();
        let bits = 0, value = 0, index = 0;
        const output = new Uint8Array((str.length * 5) / 8 | 0);
        for (let i = 0; i < str.length; i++) {
            const val = chars.indexOf(str[i]);
            if (val === -1) continue;
            value = (value << 5) | val;
            bits += 5;
            if (bits >= 8) {
                output[index++] = (value >>> (bits - 8)) & 255;
                bits -= 8;
            }
        }
        return output;
    },

    bytesToBase64(bytes) {
        const len = bytes.byteLength;
        const chunkSize = 32768;
        let binary = '';
        for (let i = 0; i < len; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        return window.btoa(binary);
    },

    base64ToBytes(base64) {
        base64 = base64.replace(/\s+/g, '');
        const binString = window.atob(base64);
        const len = binString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binString.charCodeAt(i);
        }
        return bytes;
    },

    detectMimeType(bytes) {
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) return 'image/jpeg';
        if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
        if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
        if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
            if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
                return 'image/webp';
            }
        }
        if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'application/pdf';
        return null;
    },

    copyResult() {
        const text = document.getElementById('base-output-text').value;
        navigator.clipboard.writeText(text)
            .then(() => alert('Скопировано в буфер обмена'))
            .catch(() => alert('Не удалось скопировать.'));
    },

    downloadResult() {
        if (!this.decodedBlob) return;
        
        let ext = 'bin';
        const type = this.decodedBlob.type;
        if (type === 'image/jpeg') ext = 'jpg';
        else if (type === 'image/png') ext = 'png';
        else if (type === 'image/gif') ext = 'gif';
        else if (type === 'image/webp') ext = 'webp';
        else if (type === 'application/pdf') ext = 'pdf';

        const link = document.createElement('a');
        link.download = 'decoded_file.' + ext;
        link.href = URL.createObjectURL(this.decodedBlob);
        link.click();
    }
};
