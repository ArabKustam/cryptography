// ==========================================
// CRYPTO TOOLS - Main Application
// ==========================================

// Morse Code Dictionary (International/Latin only)
const MORSE_CODE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
    "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
    '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.',
    '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};

const MORSE_REVERSE = Object.fromEntries(
    Object.entries(MORSE_CODE).map(([k, v]) => [v, k])
);

// ==========================================
// Tab Navigation
// ==========================================
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
    });
});

// ==========================================
// STEGANOGRAPHY MODULE
// ==========================================
const steganoModule = {
    image: null,

    init() {
        this.setupDropZone('stegano-drop', 'stegano-input', this.handleImage.bind(this));
        this.setupModeSwitch();
        document.getElementById('encode-btn').addEventListener('click', () => this.encode());
        document.getElementById('decode-btn').addEventListener('click', () => this.decode());
        document.getElementById('download-stegano').addEventListener('click', () => this.download());
        document.getElementById('stegano-clear').addEventListener('click', () => this.clear());
    },

    setupDropZone(dropId, inputId, handler) {
        const dropZone = document.getElementById(dropId);
        const input = document.getElementById(inputId);

        dropZone.addEventListener('click', () => input.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handler(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => {
            if (input.files.length) handler(input.files[0]);
        });
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

// ==========================================
// SPECTROGRAM MODULE
// ==========================================
const spectroModule = {
    image: null,
    audioBlob: null,
    audioBuffer: null,
    audioContext: null,

    init() {
        // Mode switch
        document.querySelectorAll('[data-spectro-mode]').forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.spectroMode));
        });

        // Encode mode (Image → WAV)
        steganoModule.setupDropZone.call(this, 'spectro-drop', 'spectro-input', this.handleImage.bind(this));
        document.getElementById('spectro-convert').addEventListener('click', () => this.convert());
        document.getElementById('download-spectro').addEventListener('click', () => this.download());
        document.getElementById('spectro-clear').addEventListener('click', () => this.clearEncode());

        // Decode mode (WAV → Image)
        steganoModule.setupDropZone.call(this, 'spectro-wav-drop', 'spectro-wav-input', this.handleAudio.bind(this));
        document.getElementById('spectro-decode-btn').addEventListener('click', () => this.decodeAudio());
        document.getElementById('download-decoded-img').addEventListener('click', () => this.downloadDecodedImage());
        document.getElementById('spectro-wav-clear').addEventListener('click', () => this.clearDecode());
    },

    switchMode(mode) {
        document.querySelectorAll('[data-spectro-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.spectroMode === mode);
        });
        document.getElementById('spectro-encode').style.display = mode === 'encode' ? 'block' : 'none';
        document.getElementById('spectro-decode').style.display = mode === 'decode' ? 'block' : 'none';
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
                document.getElementById('spectro-img').src = e.target.result;
                document.getElementById('spectro-drop').style.display = 'none';
                document.getElementById('spectro-preview').style.display = 'block';
                document.getElementById('spectro-result').style.display = 'none';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    handleAudio(file) {
        if (!file.type.startsWith('audio/')) {
            alert('Пожалуйста, выберите аудио файл');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioBuffer = await this.audioContext.decodeAudioData(e.target.result);

            document.getElementById('spectro-wav-player').src = URL.createObjectURL(file);
            document.getElementById('spectro-wav-drop').style.display = 'none';
            document.getElementById('spectro-wav-preview').style.display = 'flex';
            document.getElementById('spectro-decode-result').style.display = 'none';
        };
        reader.readAsArrayBuffer(file);
    },

    convert() {
        if (!this.image) {
            alert('Сначала загрузи изображение');
            return;
        }

        const duration = parseFloat(document.getElementById('spectro-duration').value) || 5;
        const minFreq = parseFloat(document.getElementById('spectro-min-freq').value) || 200;
        const maxFreq = parseFloat(document.getElementById('spectro-max-freq').value) || 8000;

        // Get image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Resize image for processing
        const targetWidth = 256;
        const targetHeight = 128;
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(this.image, 0, 0, targetWidth, targetHeight);

        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const pixels = imageData.data;

        // Audio parameters
        const sampleRate = 44100;
        const numSamples = Math.floor(sampleRate * duration);
        const samplesPerColumn = Math.floor(numSamples / targetWidth);

        // Create audio buffer
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
        const channelData = buffer.getChannelData(0);

        // Convert image to audio
        for (let x = 0; x < targetWidth; x++) {
            const startSample = x * samplesPerColumn;

            for (let y = 0; y < targetHeight; y++) {
                const pixelIndex = (y * targetWidth + x) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                const brightness = (r + g + b) / 3 / 255;

                if (brightness < 0.1) continue;

                // Map y position to frequency (inverted so top = high freq)
                const freqRatio = 1 - (y / targetHeight);
                const freq = minFreq + freqRatio * (maxFreq - minFreq);
                const amplitude = brightness * 0.3;

                for (let s = 0; s < samplesPerColumn; s++) {
                    const sampleIndex = startSample + s;
                    if (sampleIndex < numSamples) {
                        const t = sampleIndex / sampleRate;
                        channelData[sampleIndex] += Math.sin(2 * Math.PI * freq * t) * amplitude;
                    }
                }
            }
        }

        // Normalize
        let maxVal = 0;
        for (let i = 0; i < numSamples; i++) {
            maxVal = Math.max(maxVal, Math.abs(channelData[i]));
        }
        if (maxVal > 0) {
            for (let i = 0; i < numSamples; i++) {
                channelData[i] /= maxVal;
            }
        }

        // Convert to WAV
        this.audioBlob = this.bufferToWav(buffer);
        const audioUrl = URL.createObjectURL(this.audioBlob);

        document.getElementById('spectro-audio').src = audioUrl;
        document.getElementById('spectro-result').style.display = 'block';
    },

    async decodeAudio() {
        if (!this.audioBuffer) {
            alert('Сначала загрузи аудио файл');
            return;
        }

        const minFreq = parseFloat(document.getElementById('decode-min-freq').value) || 200;
        const maxFreq = parseFloat(document.getElementById('decode-max-freq').value) || 8000;
        const resolution = parseInt(document.getElementById('decode-resolution').value) || 256;
        const colorScheme = document.getElementById('spectro-colorscheme').value;

        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;
        const totalSamples = channelData.length;

        // Show progress
        document.getElementById('spectro-progress').style.display = 'block';
        document.getElementById('spectro-decode-result').style.display = 'none';
        document.getElementById('spectro-decode-btn').disabled = true;

        // FFT size - use larger for high resolution
        const fftSize = resolution >= 1024 ? 4096 : 2048;
        const hopSize = Math.floor(totalSamples / resolution);

        // Frequency bin calculations
        const binHz = sampleRate / fftSize;
        const minBin = Math.max(0, Math.floor(minFreq / binHz));
        const maxBin = Math.min(fftSize / 2, Math.ceil(maxFreq / binHz));

        // Create output canvas
        const canvas = document.getElementById('spectro-decode-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = resolution;
        canvas.height = resolution;

        const imageData = ctx.createImageData(resolution, resolution);

        // Pre-compute Hann window
        const hannWindow = new Float32Array(fftSize);
        for (let i = 0; i < fftSize; i++) {
            hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / fftSize));
        }

        // Process in batches for responsiveness
        const batchSize = 8;
        const allMagnitudes = new Array(resolution);
        let globalMax = 0;

        for (let batchStart = 0; batchStart < resolution; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, resolution);

            for (let x = batchStart; x < batchEnd; x++) {
                const startSample = x * hopSize;

                // Extract and window the audio chunk
                const realPart = new Float32Array(fftSize);
                const imagPart = new Float32Array(fftSize);

                for (let i = 0; i < fftSize && startSample + i < totalSamples; i++) {
                    realPart[i] = channelData[startSample + i] * hannWindow[i];
                }

                // Perform FFT
                this.fft(realPart, imagPart);

                // Extract magnitudes for frequency range
                const magnitudes = new Float32Array(resolution);
                for (let y = 0; y < resolution; y++) {
                    const freqRatio = y / resolution;
                    const targetBin = Math.round(minBin + freqRatio * (maxBin - minBin));

                    if (targetBin >= 0 && targetBin < fftSize / 2) {
                        const mag = Math.sqrt(realPart[targetBin] ** 2 + imagPart[targetBin] ** 2);
                        magnitudes[y] = mag;
                        globalMax = Math.max(globalMax, mag);
                    }
                }

                allMagnitudes[x] = magnitudes;
            }

            // Update progress
            const progress = Math.floor((batchEnd / resolution) * 100);
            document.getElementById('spectro-progress-fill').style.width = progress + '%';
            document.getElementById('spectro-progress-text').textContent = `Обработка: ${progress}%`;

            // Yield to UI
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Draw with color scheme
        for (let x = 0; x < resolution; x++) {
            const magnitudes = allMagnitudes[x];

            for (let y = 0; y < resolution; y++) {
                const srcY = resolution - 1 - y;
                const normalizedMag = globalMax > 0 ? magnitudes[srcY] / globalMax : 0;
                const adjustedMag = Math.pow(normalizedMag, 0.4);

                const [r, g, b] = this.getColorFromScheme(adjustedMag, colorScheme);

                const pixelIndex = (y * resolution + x) * 4;
                imageData.data[pixelIndex] = r;
                imageData.data[pixelIndex + 1] = g;
                imageData.data[pixelIndex + 2] = b;
                imageData.data[pixelIndex + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Hide progress, show result
        document.getElementById('spectro-progress').style.display = 'none';
        document.getElementById('spectro-decode-btn').disabled = false;
        document.getElementById('spectro-decode-result').style.display = 'block';
    },

    // Cooley-Tukey FFT (radix-2, in-place)
    fft(real, imag) {
        const n = real.length;

        // Bit-reversal permutation
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        // Cooley-Tukey iterative FFT
        for (let len = 2; len <= n; len <<= 1) {
            const halfLen = len >> 1;
            const angle = -2 * Math.PI / len;
            const wReal = Math.cos(angle);
            const wImag = Math.sin(angle);

            for (let i = 0; i < n; i += len) {
                let curReal = 1, curImag = 0;

                for (let k = 0; k < halfLen; k++) {
                    const evenIdx = i + k;
                    const oddIdx = i + k + halfLen;

                    const tReal = curReal * real[oddIdx] - curImag * imag[oddIdx];
                    const tImag = curReal * imag[oddIdx] + curImag * real[oddIdx];

                    real[oddIdx] = real[evenIdx] - tReal;
                    imag[oddIdx] = imag[evenIdx] - tImag;
                    real[evenIdx] += tReal;
                    imag[evenIdx] += tImag;

                    const nextReal = curReal * wReal - curImag * wImag;
                    curImag = curReal * wImag + curImag * wReal;
                    curReal = nextReal;
                }
            }
        }
    },

    getColorFromScheme(value, scheme) {
        const v = Math.min(1, Math.max(0, value));

        switch (scheme) {
            case 'grayscale':
                const gray = Math.floor(v * 255);
                return [gray, gray, gray];

            case 'heat':
                // Black -> Red -> Orange -> Yellow -> White
                if (v < 0.25) {
                    return [Math.floor(v * 4 * 255), 0, 0];
                } else if (v < 0.5) {
                    return [255, Math.floor((v - 0.25) * 4 * 165), 0];
                } else if (v < 0.75) {
                    return [255, 165 + Math.floor((v - 0.5) * 4 * 90), 0];
                } else {
                    const extra = Math.floor((v - 0.75) * 4 * 255);
                    return [255, 255, extra];
                }

            case 'green':
                // Black -> Dark green -> Bright green -> White
                if (v < 0.5) {
                    return [0, Math.floor(v * 2 * 255), 0];
                } else {
                    const extra = Math.floor((v - 0.5) * 2 * 255);
                    return [extra, 255, extra];
                }

            case 'blue':
                // Black -> Dark blue -> Cyan -> White
                if (v < 0.33) {
                    return [0, 0, Math.floor(v * 3 * 255)];
                } else if (v < 0.66) {
                    return [0, Math.floor((v - 0.33) * 3 * 255), 255];
                } else {
                    const extra = Math.floor((v - 0.66) * 3 * 255);
                    return [extra, 255, 255];
                }

            case 'purple':
                // Black -> Purple -> Magenta -> Pink
                if (v < 0.5) {
                    const intensity = Math.floor(v * 2 * 200);
                    return [intensity, 0, intensity + 55];
                } else {
                    const r = 200 + Math.floor((v - 0.5) * 2 * 55);
                    const g = Math.floor((v - 0.5) * 2 * 150);
                    return [r, g, 255];
                }

            default:
                const def = Math.floor(v * 255);
                return [def, def, def];
        }
    },

    bufferToWav(buffer) {
        const numChannels = 1;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const samples = buffer.getChannelData(0);
        const dataLength = samples.length * bytesPerSample;
        const bufferLength = 44 + dataLength;

        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, bufferLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        // Audio data
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    },

    download() {
        if (!this.audioBlob) return;
        const link = document.createElement('a');
        link.download = 'spectrogram.wav';
        link.href = URL.createObjectURL(this.audioBlob);
        link.click();
    },

    downloadDecodedImage() {
        const canvas = document.getElementById('spectro-decode-canvas');
        const link = document.createElement('a');
        link.download = 'decoded_spectrogram.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    },

    clearEncode() {
        this.image = null;
        this.audioBlob = null;
        document.getElementById('spectro-drop').style.display = 'block';
        document.getElementById('spectro-preview').style.display = 'none';
        document.getElementById('spectro-result').style.display = 'none';
        document.getElementById('spectro-input').value = '';
    },

    clearDecode() {
        this.audioBuffer = null;
        document.getElementById('spectro-wav-drop').style.display = 'block';
        document.getElementById('spectro-wav-preview').style.display = 'none';
        document.getElementById('spectro-decode-result').style.display = 'none';
        document.getElementById('spectro-wav-input').value = '';
    }
};

// ==========================================
// MORSE CODE MODULE
// ==========================================
const morseModule = {
    audioContext: null,
    audioBuffer: null,
    isPlaying: false,
    oscillators: [],
    playbackTimeout: null,
    animationFrame: null,
    currentTimeline: null,
    currentTotalDuration: 0,
    zoom: 1,
    panOffset: 0,

    init() {
        this.setupTabs();
        this.buildReferenceTable();

        document.getElementById('to-morse-btn').addEventListener('click', () => this.textToMorse());
        document.getElementById('from-morse-btn').addEventListener('click', () => this.morseToText());
        document.getElementById('play-morse').addEventListener('click', () => this.playMorse());
        document.getElementById('stop-morse').addEventListener('click', () => this.stopMorse());
        document.getElementById('download-morse-audio').addEventListener('click', () => this.downloadMorseAudio());
        document.getElementById('decode-audio-btn').addEventListener('click', () => this.decodeAudio());

        steganoModule.setupDropZone.call(this, 'morse-audio-drop', 'morse-audio-input', this.handleAudio.bind(this));
        document.getElementById('morse-audio-clear').addEventListener('click', () => this.clearAudio());

        // Zoom/Pan controls
        this.setupZoomPanControls();
        this.setupWaveformZoomControls();
    },

    setupZoomPanControls() {
        const zoomSlider = document.getElementById('morse-zoom');
        const zoomLabel = document.getElementById('morse-zoom-label');
        const panSlider = document.getElementById('morse-pan');
        const canvasWrapper = document.getElementById('morse-canvas-wrapper');

        // Zoom slider
        zoomSlider.addEventListener('input', () => {
            this.zoom = parseFloat(zoomSlider.value);
            zoomLabel.textContent = Math.round(this.zoom * 100) + '%';
            this.updateCanvasSize();
            this.redrawVisualization();
        });

        // Zoom buttons
        document.getElementById('morse-zoom-in').addEventListener('click', () => {
            this.zoom = Math.min(10, this.zoom + 0.5);
            zoomSlider.value = this.zoom;
            zoomLabel.textContent = Math.round(this.zoom * 100) + '%';
            this.updateCanvasSize();
            this.redrawVisualization();
        });

        document.getElementById('morse-zoom-out').addEventListener('click', () => {
            this.zoom = Math.max(1, this.zoom - 0.5);
            zoomSlider.value = this.zoom;
            zoomLabel.textContent = Math.round(this.zoom * 100) + '%';
            this.updateCanvasSize();
            this.redrawVisualization();
        });

        // Pan slider
        panSlider.addEventListener('input', () => {
            const maxScroll = canvasWrapper.scrollWidth - canvasWrapper.clientWidth;
            canvasWrapper.scrollLeft = (panSlider.value / 100) * maxScroll;
        });

        // Pan buttons
        document.getElementById('morse-pan-left').addEventListener('click', () => {
            canvasWrapper.scrollLeft -= 50;
            this.updatePanSlider();
        });

        document.getElementById('morse-pan-right').addEventListener('click', () => {
            canvasWrapper.scrollLeft += 50;
            this.updatePanSlider();
        });

        // Sync pan slider with scroll
        canvasWrapper.addEventListener('scroll', () => this.updatePanSlider());

        // Mouse wheel zoom
        canvasWrapper.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                this.zoom = Math.max(1, Math.min(10, this.zoom + delta));
                zoomSlider.value = this.zoom;
                zoomLabel.textContent = Math.round(this.zoom * 100) + '%';
                this.updateCanvasSize();
                this.redrawVisualization();
            }
        });
    },

    updatePanSlider() {
        const canvasWrapper = document.getElementById('morse-canvas-wrapper');
        const panSlider = document.getElementById('morse-pan');
        const maxScroll = canvasWrapper.scrollWidth - canvasWrapper.clientWidth;
        if (maxScroll > 0) {
            panSlider.value = (canvasWrapper.scrollLeft / maxScroll) * 100;
        }
    },

    updateCanvasSize() {
        const canvas = document.getElementById('morse-canvas');
        const wrapper = document.getElementById('morse-canvas-wrapper');
        const baseWidth = wrapper.clientWidth - 8;
        canvas.style.width = (baseWidth * this.zoom) + 'px';
    },

    redrawVisualization() {
        if (this.currentTimeline && this.currentTimeline.length > 0) {
            this.drawMorseVisualization(this.currentTimeline, this.currentTotalDuration);
        }
    },

    // Waveform zoom state
    waveformZoom: 1,
    waveformData: null,
    waveformLabels: null,
    waveformThreshold: 0,

    setupWaveformZoomControls() {
        const zoomSlider = document.getElementById('waveform-zoom');
        const zoomLabel = document.getElementById('waveform-zoom-label');
        const panSlider = document.getElementById('waveform-pan');
        const canvasWrapper = document.getElementById('waveform-canvas-wrapper');

        if (!zoomSlider) return;

        zoomSlider.addEventListener('input', () => {
            this.waveformZoom = parseFloat(zoomSlider.value);
            zoomLabel.textContent = Math.round(this.waveformZoom * 100) + '%';
            this.redrawWaveform();
        });

        document.getElementById('waveform-zoom-in').addEventListener('click', () => {
            this.waveformZoom = Math.min(10, this.waveformZoom + 0.5);
            zoomSlider.value = this.waveformZoom;
            zoomLabel.textContent = Math.round(this.waveformZoom * 100) + '%';
            this.redrawWaveform();
        });

        document.getElementById('waveform-zoom-out').addEventListener('click', () => {
            this.waveformZoom = Math.max(1, this.waveformZoom - 0.5);
            zoomSlider.value = this.waveformZoom;
            zoomLabel.textContent = Math.round(this.waveformZoom * 100) + '%';
            this.redrawWaveform();
        });

        panSlider.addEventListener('input', () => {
            const maxScroll = canvasWrapper.scrollWidth - canvasWrapper.clientWidth;
            canvasWrapper.scrollLeft = (panSlider.value / 100) * maxScroll;
        });

        document.getElementById('waveform-pan-left').addEventListener('click', () => {
            canvasWrapper.scrollLeft -= 50;
            this.updateWaveformPanSlider();
        });

        document.getElementById('waveform-pan-right').addEventListener('click', () => {
            canvasWrapper.scrollLeft += 50;
            this.updateWaveformPanSlider();
        });

        canvasWrapper.addEventListener('scroll', () => this.updateWaveformPanSlider());
    },

    updateWaveformPanSlider() {
        const canvasWrapper = document.getElementById('waveform-canvas-wrapper');
        const panSlider = document.getElementById('waveform-pan');
        const maxScroll = canvasWrapper.scrollWidth - canvasWrapper.clientWidth;
        if (maxScroll > 0) {
            panSlider.value = (canvasWrapper.scrollLeft / maxScroll) * 100;
        }
    },

    redrawWaveform() {
        if (this.waveformData && this.waveformData.length > 0) {
            this.drawWaveform(this.waveformData, this.waveformSampleRate);
            if (this.waveformLabels) {
                this.drawWaveformLabels(this.waveformAmplitudes, this.waveformLabels, this.waveformThreshold);
            }
        }
    },

    setupTabs() {
        document.querySelectorAll('.morse-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.morse-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.morse-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.morse).classList.add('active');
            });
        });
    },

    buildReferenceTable() {
        const table = document.getElementById('morse-table');
        // Show only main characters
        const mainChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        mainChars.split('').forEach(char => {
            if (MORSE_CODE[char]) {
                const item = document.createElement('div');
                item.className = 'morse-item';
                item.innerHTML = `<span class="char">${char}</span><br><span class="code">${MORSE_CODE[char]}</span>`;
                table.appendChild(item);
            }
        });
    },

    textToMorse() {
        const text = document.getElementById('text-input').value.toUpperCase();
        if (!text) {
            alert('Введи текст');
            return;
        }

        let morse = '';
        for (const char of text) {
            if (char === ' ') {
                morse += ' / ';
            } else if (MORSE_CODE[char]) {
                morse += MORSE_CODE[char] + ' ';
            }
        }

        document.getElementById('morse-output').textContent = morse.trim();
        document.getElementById('morse-output-box').style.display = 'block';

        // Draw initial visualization
        this.drawInitialVisualization(morse.trim());
    },

    drawInitialVisualization(morse) {
        const wpm = 15;
        const dotDuration = 1.2 / wpm;
        const dashDuration = dotDuration * 3;
        const symbolPause = dotDuration;
        const letterPause = dotDuration * 3;
        const wordPause = dotDuration * 7;

        const timeline = [];
        let currentTime = 0;

        for (let i = 0; i < morse.length; i++) {
            const char = morse[i];
            if (char === '.') {
                timeline.push({ type: 'dot', start: currentTime, duration: dotDuration });
                currentTime += dotDuration + symbolPause;
            } else if (char === '-') {
                timeline.push({ type: 'dash', start: currentTime, duration: dashDuration });
                currentTime += dashDuration + symbolPause;
            } else if (char === ' ') {
                if (morse[i - 1] !== '/' && morse[i + 1] !== '/') {
                    currentTime += letterPause - symbolPause;
                }
            } else if (char === '/') {
                currentTime += wordPause - symbolPause;
            }
        }

        if (timeline.length > 0) {
            this.currentTimeline = timeline;
            this.currentTotalDuration = currentTime;
            this.updateCanvasSize();
            this.drawMorseVisualization(timeline, currentTime);
        }
    },

    morseToText() {
        const morse = document.getElementById('morse-input').value.trim();
        if (!morse) {
            alert('Введи морзянку');
            return;
        }

        const words = morse.split(/\s*\/\s*/);
        let text = '';

        for (const word of words) {
            const letters = word.trim().split(/\s+/);
            for (const letter of letters) {
                if (MORSE_REVERSE[letter]) {
                    text += MORSE_REVERSE[letter];
                }
            }
            text += ' ';
        }

        document.getElementById('text-output').textContent = text.trim();
        document.getElementById('text-output-box').style.display = 'block';
    },

    playMorse() {
        const morse = document.getElementById('morse-output').textContent;
        if (!morse) return;

        // Stop any existing playback
        if (this.isPlaying) {
            this.stopMorse();
            return;
        }

        this.isPlaying = true;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillators = [];

        // Realistic morse timing (WPM based)
        const wpm = 15; // Words per minute
        const dotDuration = 1.2 / wpm; // ~80ms for 15 WPM
        const dashDuration = dotDuration * 3;
        const symbolPause = dotDuration; // Between dots/dashes
        const letterPause = dotDuration * 3; // Between letters
        const wordPause = dotDuration * 7; // Between words
        const frequency = 800; // Classic CW frequency (Hz)

        // UI updates
        document.getElementById('play-morse').style.display = 'none';
        document.getElementById('stop-morse').style.display = 'inline-block';

        // Build timeline with symbols info for visualization
        const timeline = [];
        let currentTime = this.audioContext.currentTime + 0.1;

        for (let i = 0; i < morse.length; i++) {
            const char = morse[i];
            if (char === '.') {
                timeline.push({ type: 'dot', start: currentTime, duration: dotDuration });
                this.scheduleTone(frequency, currentTime, dotDuration);
                currentTime += dotDuration + symbolPause;
            } else if (char === '-') {
                timeline.push({ type: 'dash', start: currentTime, duration: dashDuration });
                this.scheduleTone(frequency, currentTime, dashDuration);
                currentTime += dashDuration + symbolPause;
            } else if (char === ' ') {
                // Check if it's a word separator (space around /)
                if (morse[i - 1] === '/' || morse[i + 1] === '/') {
                    // Skip, handled by /
                } else {
                    currentTime += letterPause - symbolPause;
                }
            } else if (char === '/') {
                currentTime += wordPause - symbolPause;
            }
        }

        // Draw visualization
        this.drawMorseVisualization(timeline, currentTime - this.audioContext.currentTime);

        // Animate playback indicator
        this.animatePlayback(timeline, this.audioContext.currentTime + 0.1);

        // Auto-stop when done
        const totalDuration = (currentTime - this.audioContext.currentTime) * 1000 + 200;
        this.playbackTimeout = setTimeout(() => {
            this.stopMorse();
        }, totalDuration);
    },

    scheduleTone(frequency, startTime, duration) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';

        // Smooth envelope to prevent clicks
        const attackTime = 0.005;
        const releaseTime = 0.005;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.6, startTime + attackTime);
        gainNode.gain.setValueAtTime(0.6, startTime + duration - releaseTime);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration);

        this.oscillators.push(oscillator);
    },

    drawMorseVisualization(timeline, totalDuration) {
        const canvas = document.getElementById('morse-canvas');
        const ctx = canvas.getContext('2d');
        const wrapper = document.getElementById('morse-canvas-wrapper');

        // Set canvas size based on zoom
        const baseWidth = wrapper.clientWidth - 8;
        const zoomedWidth = baseWidth * this.zoom;
        canvas.width = zoomedWidth;
        canvas.height = 80;
        canvas.style.width = zoomedWidth + 'px';

        const width = canvas.width;
        const height = canvas.height;

        // Background
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw waveform representation
        const pixelsPerSecond = width / totalDuration;
        const waveHeight = 30;
        const centerY = height / 2;

        for (const item of timeline) {
            const x = (item.start - timeline[0].start + 0.1) * pixelsPerSecond;
            const w = item.duration * pixelsPerSecond;

            // Draw the signal bar
            const gradient = ctx.createLinearGradient(x, centerY - waveHeight / 2, x, centerY + waveHeight / 2);
            gradient.addColorStop(0, '#6366f1');
            gradient.addColorStop(0.5, '#8b5cf6');
            gradient.addColorStop(1, '#6366f1');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, centerY - waveHeight / 2, Math.max(w, 3), waveHeight, 3);
            ctx.fill();

            // Draw label above
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            const label = item.type === 'dot' ? '•' : '—';
            ctx.fillText(label, x + w / 2, centerY - waveHeight / 2 - 8);
        }

        // Draw baseline
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    },

    animatePlayback(timeline, startTime) {
        if (!this.isPlaying || timeline.length === 0) return;

        const canvas = document.getElementById('morse-canvas');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const totalDuration = timeline[timeline.length - 1].start + timeline[timeline.length - 1].duration - timeline[0].start + 0.1;
        const pixelsPerSecond = width / totalDuration;

        const animate = () => {
            if (!this.isPlaying) return;

            const elapsed = this.audioContext.currentTime - startTime;
            const x = elapsed * pixelsPerSecond;

            // Redraw visualization
            this.drawMorseVisualization(timeline, totalDuration);

            // Draw playhead
            if (x >= 0 && x < width) {
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();

                // Highlight active signals
                for (const item of timeline) {
                    const itemX = (item.start - timeline[0].start + 0.1) * pixelsPerSecond;
                    const itemEnd = itemX + item.duration * pixelsPerSecond;
                    if (x >= itemX && x <= itemEnd) {
                        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
                        ctx.fillRect(itemX, 0, itemEnd - itemX, height);
                    }
                }
            }

            if (elapsed < totalDuration + 0.5) {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    },

    stopMorse() {
        this.isPlaying = false;

        if (this.oscillators) {
            for (const osc of this.oscillators) {
                try { osc.stop(); } catch (e) { }
            }
            this.oscillators = [];
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.playbackTimeout) {
            clearTimeout(this.playbackTimeout);
            this.playbackTimeout = null;
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        document.getElementById('play-morse').style.display = 'inline-block';
        document.getElementById('stop-morse').style.display = 'none';
    },

    handleAudio(file) {
        if (!file.type.startsWith('audio/')) {
            alert('Пожалуйста, выберите аудио файл');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioBuffer = await this.audioContext.decodeAudioData(e.target.result);

            document.getElementById('morse-audio-player').src = URL.createObjectURL(file);
            document.getElementById('morse-audio-drop').style.display = 'none';
            document.getElementById('morse-audio-preview').style.display = 'flex';
        };
        reader.readAsArrayBuffer(file);
    },

    decodeAudio() {
        if (!this.audioBuffer) {
            alert('Сначала загрузи аудио файл');
            return;
        }

        const channelData = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;

        // Draw waveform first
        this.drawWaveform(channelData, sampleRate);

        // Simple amplitude-based detection
        const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
        const amplitudes = [];

        for (let i = 0; i < channelData.length; i += windowSize) {
            let sum = 0;
            const end = Math.min(i + windowSize, channelData.length);
            for (let j = i; j < end; j++) {
                sum += Math.abs(channelData[j]);
            }
            amplitudes.push(sum / (end - i));
        }

        // Find threshold
        const maxAmp = Math.max(...amplitudes);
        const threshold = maxAmp * 0.3;

        // Detect on/off states
        const states = amplitudes.map(a => a > threshold);

        // Measure pulse durations
        const pulses = [];
        let currentState = false;
        let duration = 0;

        for (const state of states) {
            if (state === currentState) {
                duration++;
            } else {
                if (duration > 0) {
                    pulses.push({ on: currentState, duration });
                }
                currentState = state;
                duration = 1;
            }
        }
        if (duration > 0) {
            pulses.push({ on: currentState, duration });
        }

        // Find average dot duration
        const onDurations = pulses.filter(p => p.on).map(p => p.duration);
        if (onDurations.length === 0) {
            document.getElementById('audio-morse-output').textContent = 'Сигнал не обнаружен';
            document.getElementById('audio-text-output').textContent = '';
            document.getElementById('audio-result-box').style.display = 'block';
            return;
        }

        const minDuration = Math.min(...onDurations);
        const dotThreshold = minDuration * 2;

        // Convert to morse and add labels to waveform
        let morse = '';
        const labels = [];
        let windowIndex = 0;

        for (const pulse of pulses) {
            if (pulse.on) {
                const symbol = pulse.duration < dotThreshold ? '.' : '-';
                morse += symbol;
                labels.push({
                    start: windowIndex,
                    duration: pulse.duration,
                    symbol: symbol
                });
            } else {
                if (pulse.duration > dotThreshold * 3) {
                    morse += ' / ';
                } else if (pulse.duration > dotThreshold) {
                    morse += ' ';
                }
            }
            windowIndex += pulse.duration;
        }

        // Save for redraw and draw labels on waveform
        this.waveformAmplitudes = amplitudes;
        this.waveformLabels = labels;
        this.waveformThreshold = threshold;
        this.drawWaveformLabels(amplitudes, labels, threshold);

        // Decode morse to text
        const words = morse.split(/\s*\/\s*/);
        let text = '';
        for (const word of words) {
            const letters = word.trim().split(/\s+/);
            for (const letter of letters) {
                if (MORSE_REVERSE[letter]) {
                    text += MORSE_REVERSE[letter];
                }
            }
            text += ' ';
        }

        document.getElementById('audio-morse-output').textContent = morse.trim() || 'Не распознано';
        document.getElementById('audio-text-output').textContent = text.trim() || '';
        document.getElementById('audio-result-box').style.display = 'block';
    },

    drawWaveform(channelData, sampleRate) {
        // Save data for redraw
        this.waveformData = channelData;
        this.waveformSampleRate = sampleRate;

        const canvas = document.getElementById('morse-waveform-canvas');
        const ctx = canvas.getContext('2d');
        const wrapper = document.getElementById('waveform-canvas-wrapper');

        // Set canvas size based on zoom
        const baseWidth = wrapper ? wrapper.clientWidth - 8 : 500;
        const zoomedWidth = baseWidth * this.waveformZoom;
        canvas.width = zoomedWidth;
        canvas.height = 100;
        canvas.style.width = zoomedWidth + 'px';

        const width = canvas.width;
        const height = canvas.height;
        const centerY = height / 2;

        // Background
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, width, height);

        // Draw center line
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Downsample for visualization
        const samplesPerPixel = Math.floor(channelData.length / width);

        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let x = 0; x < width; x++) {
            const start = x * samplesPerPixel;
            let min = 0, max = 0;

            for (let i = 0; i < samplesPerPixel && start + i < channelData.length; i++) {
                const sample = channelData[start + i];
                if (sample < min) min = sample;
                if (sample > max) max = sample;
            }

            const y1 = centerY + min * centerY * 0.9;
            const y2 = centerY + max * centerY * 0.9;

            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
        }

        ctx.stroke();
    },

    drawWaveformLabels(amplitudes, labels, threshold) {
        const canvas = document.getElementById('morse-waveform-canvas');
        const ctx = canvas.getContext('2d');

        const width = canvas.width;
        const height = canvas.height;
        const pixelsPerWindow = width / amplitudes.length;

        // Draw amplitude envelope
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';

        for (let i = 0; i < amplitudes.length; i++) {
            if (amplitudes[i] > threshold) {
                const x = i * pixelsPerWindow;
                ctx.fillRect(x, 0, pixelsPerWindow, height);
            }
        }

        // Draw labels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';

        for (const label of labels) {
            const x = (label.start + label.duration / 2) * pixelsPerWindow;
            const symbol = label.symbol === '.' ? '•' : '—';
            ctx.fillText(symbol, x, 20);
        }

        // Draw threshold line
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, height - 10);
        ctx.lineTo(width, height - 10);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    downloadMorseAudio() {
        const morse = document.getElementById('morse-output').textContent;
        if (!morse) {
            alert('Сначала конвертируй текст в морзянку');
            return;
        }

        // Generate audio
        const wpm = 15;
        const dotDuration = 1.2 / wpm;
        const dashDuration = dotDuration * 3;
        const symbolPause = dotDuration;
        const letterPause = dotDuration * 3;
        const wordPause = dotDuration * 7;
        const frequency = 800;
        const sampleRate = 44100;

        // Calculate total duration
        let totalDuration = 0;
        for (let i = 0; i < morse.length; i++) {
            const char = morse[i];
            if (char === '.') {
                totalDuration += dotDuration + symbolPause;
            } else if (char === '-') {
                totalDuration += dashDuration + symbolPause;
            } else if (char === ' ') {
                if (morse[i - 1] !== '/' && morse[i + 1] !== '/') {
                    totalDuration += letterPause - symbolPause;
                }
            } else if (char === '/') {
                totalDuration += wordPause - symbolPause;
            }
        }

        const numSamples = Math.ceil(totalDuration * sampleRate);
        const buffer = new Float32Array(numSamples);

        let currentSample = 0;

        for (let i = 0; i < morse.length; i++) {
            const char = morse[i];
            let toneDuration = 0;

            if (char === '.') {
                toneDuration = dotDuration;
            } else if (char === '-') {
                toneDuration = dashDuration;
            } else if (char === ' ') {
                if (morse[i - 1] !== '/' && morse[i + 1] !== '/') {
                    currentSample += Math.floor((letterPause - symbolPause) * sampleRate);
                }
                continue;
            } else if (char === '/') {
                currentSample += Math.floor((wordPause - symbolPause) * sampleRate);
                continue;
            }

            // Generate tone
            const toneSamples = Math.floor(toneDuration * sampleRate);
            for (let s = 0; s < toneSamples; s++) {
                const t = s / sampleRate;
                // Envelope for smooth start/end
                let envelope = 1;
                const attackSamples = Math.floor(0.005 * sampleRate);
                if (s < attackSamples) {
                    envelope = s / attackSamples;
                } else if (s > toneSamples - attackSamples) {
                    envelope = (toneSamples - s) / attackSamples;
                }
                buffer[currentSample + s] = Math.sin(2 * Math.PI * frequency * t) * 0.6 * envelope;
            }
            currentSample += toneSamples + Math.floor(symbolPause * sampleRate);
        }

        // Convert to WAV
        const wavBlob = this.floatToWav(buffer, sampleRate);

        const link = document.createElement('a');
        link.download = 'morse_audio.wav';
        link.href = URL.createObjectURL(wavBlob);
        link.click();
    },

    floatToWav(samples, sampleRate) {
        const numChannels = 1;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const dataLength = samples.length * bytesPerSample;
        const bufferLength = 44 + dataLength;

        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, bufferLength - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(36, 'data');
        view.setUint32(40, dataLength, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    },

    clearAudio() {
        this.audioBuffer = null;
        document.getElementById('morse-audio-drop').style.display = 'block';
        document.getElementById('morse-audio-preview').style.display = 'none';
        document.getElementById('audio-result-box').style.display = 'none';
        document.getElementById('morse-audio-input').value = '';
    }
};

// ==========================================
// QR CODE MODULE
// ==========================================
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
        steganoModule.setupDropZone.call(this, 'qr-logo-drop', 'qr-logo-input', this.handleLogo.bind(this));
        document.getElementById('qr-logo-clear').addEventListener('click', () => this.clearLogo());

        // Downloads
        document.getElementById('download-qr-png').addEventListener('click', () => this.download('png'));
        document.getElementById('download-qr-svg').addEventListener('click', () => this.download('svg'));

        // SCANNER
        steganoModule.setupDropZone.call(this, 'qr-scan-drop', 'qr-scan-input', this.handleScanFile.bind(this));
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

// ==========================================
// Initialize all modules
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    steganoModule.init();
    spectroModule.init();
    morseModule.init();
    qrModule.init();
});
