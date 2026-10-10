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
    decodeLang: 'RU', // 'RU' or 'EN'

    init() {
        this.setupTabs();
        this.buildReferenceTable();

        document.getElementById('to-morse-btn').addEventListener('click', () => this.textToMorse());
        document.getElementById('from-morse-btn').addEventListener('click', () => this.morseToText());
        document.getElementById('play-morse').addEventListener('click', () => this.playMorse());
        document.getElementById('stop-morse').addEventListener('click', () => this.stopMorse());
        document.getElementById('download-morse-audio').addEventListener('click', () => this.downloadMorseAudio());
        document.getElementById('decode-audio-btn').addEventListener('click', () => this.decodeAudio());

        window.CryptoUtils.setupDropZone('morse-audio-drop', 'morse-audio-input', this.handleAudio.bind(this));
        document.getElementById('morse-audio-clear').addEventListener('click', () => this.clearAudio());

        // Zoom/Pan controls
        this.setupZoomPanControls();
        this.setupWaveformZoomControls();
        this.setupLangToggle();
    },

    setupLangToggle() {
        const btnRu = document.getElementById('morse-lang-ru');
        const btnEn = document.getElementById('morse-lang-en');
        if (!btnRu || !btnEn) return;

        const updateUI = () => {
            btnRu.classList.toggle('active', this.decodeLang === 'RU');
            btnEn.classList.toggle('active', this.decodeLang === 'EN');
            // Stylize
            [btnRu, btnEn].forEach(b => {
                if (b.classList.contains('active')) {
                    b.style.background = 'var(--accent-primary)';
                    b.style.color = 'white';
                } else {
                    b.style.background = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                }
            });
        };

        btnRu.addEventListener('click', () => { this.decodeLang = 'RU'; updateUI(); if (document.getElementById('morse-input').value) this.morseToText(); });
        btnEn.addEventListener('click', () => { this.decodeLang = 'EN'; updateUI(); if (document.getElementById('morse-input').value) this.morseToText(); });
        updateUI();
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
        if (!table) return;
        table.innerHTML = '';
        
        // Latin and Numbers
        const mainChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        // Russian (Standard Cyrillic)
        const ruChars = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
        
        [...mainChars, ...ruChars].forEach(char => {
            if (MORSE_CODE[char]) {
                const item = document.createElement('div');
                item.className = 'morse-item';
                item.innerHTML = `<span class="char">${char}</span><br><span class="code">${MORSE_CODE[char]}</span>`;
                table.appendChild(item);
            }
        });
    },

    textToMorse() {
        const input = document.getElementById('text-input').value;
        if (!input) {
            alert('Введи текст');
            return;
        }

        const text = input.toUpperCase().replace('Ё', 'Е');
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
        const dict = this.decodeLang === 'RU' ? MORSE_REVERSE_RU : MORSE_REVERSE_EN;

        for (const word of words) {
            const letters = word.trim().split(/\s+/);
            for (const letter of letters) {
                if (dict[letter]) {
                    text += dict[letter];
                } else if (MORSE_REVERSE_COMMON[letter]) {
                    text += MORSE_REVERSE_COMMON[letter];
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
        const dict = this.decodeLang === 'RU' ? MORSE_REVERSE_RU : MORSE_REVERSE_EN;

        for (const word of words) {
            const letters = word.trim().split(/\s+/);
            for (const letter of letters) {
                if (dict[letter]) {
                    text += dict[letter];
                } else if (MORSE_REVERSE_COMMON[letter]) {
                    text += MORSE_REVERSE_COMMON[letter];
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

const MORSE_CODE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
    '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
    '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
    ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
    '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
    ' ': '/',
    // Russian
    'А': '.-', 'Б': '-...', 'В': '.--', 'Г': '--.', 'Д': '-..', 'Е': '.', 'Ё': '.',
    'Ж': '...-', 'З': '--..', 'И': '..', 'Й': '.---', 'К': '-.-', 'Л': '.-..',
    'М': '--', 'Н': '-.', 'О': '---', 'П': '.--.', 'Р': '.-.', 'С': '...',
    'Т': '-', 'У': '..-', 'Ф': '..-.', 'Х': '....', 'Ц': '-.-.', 'Ч': '---.',
    'Ш': '----', 'Щ': '--.-', 'Ъ': '--.--', 'Ы': '-.--', 'Ь': '-..-', 'Э': '..-..',
    'Ю': '..--', 'Я': '.-.-'
};

const MORSE_REVERSE_RU = {};
const MORSE_REVERSE_EN = {};
const MORSE_REVERSE_COMMON = {};

// Группируем символы для правильного декодирования
Object.entries(MORSE_CODE).forEach(([char, code]) => {
    // Цифры и спецсимволы — общие
    if (/[0-9\.\,\?\!\/\(\)\&\:\;\=\+\-\_\$\@\s]/.test(char)) {
        MORSE_REVERSE_COMMON[code] = char;
    } 
    // Латиница
    else if (/[A-Z]/.test(char)) {
        MORSE_REVERSE_EN[code] = char;
    }
    // Кириллица
    else {
        MORSE_REVERSE_RU[code] = char;
    }
});
// debug: validation checkpoint
