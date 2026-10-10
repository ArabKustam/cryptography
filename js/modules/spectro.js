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
        window.CryptoUtils.setupDropZone('spectro-drop', 'spectro-input', this.handleImage.bind(this));
        document.getElementById('spectro-convert').addEventListener('click', () => this.convert());
        document.getElementById('download-spectro').addEventListener('click', () => this.download());
        document.getElementById('spectro-clear').addEventListener('click', () => this.clearEncode());

        // Decode mode (WAV → Image)
        window.CryptoUtils.setupDropZone('spectro-wav-drop', 'spectro-wav-input', this.handleAudio.bind(this));
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
