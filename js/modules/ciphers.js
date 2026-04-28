const ciphersModule = {
    mode: 'encode',
    algo: 'caesar',

    init() {
        document.querySelectorAll('[data-cipher-mode]').forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.cipherMode));
        });

        document.getElementById('cipher-algo').addEventListener('change', (e) => {
            this.algo = e.target.value;
            this.updateSettingsUI();
        });

        document.getElementById('cipher-shift').addEventListener('input', (e) => {
            document.getElementById('val-shift').textContent = e.target.value;
        });

        document.getElementById('cipher-action-btn').addEventListener('click', () => this.execute());
        document.getElementById('cipher-copy-btn').addEventListener('click', () => this.copy());

        document.getElementById('shift-plus').addEventListener('click', () => this.quickShift(1));
        document.getElementById('shift-minus').addEventListener('click', () => this.quickShift(-1));
    },

    switchMode(mode) {
        this.mode = mode;
        document.querySelectorAll('[data-cipher-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cipherMode === mode);
        });
        document.getElementById('cipher-action-text').textContent = mode === 'encode' ? 'Зашифровать' : 'Расшифровать';
    },

    updateSettingsUI() {
        document.getElementById('caesar-settings').style.display = this.algo === 'caesar' ? 'block' : 'none';
        document.getElementById('vigenere-settings').style.display = this.algo === 'vigenere' ? 'block' : 'none';
    },

    execute() {
        const input = document.getElementById('cipher-input').value;
        if (!input) return alert('Введите текст');

        let result = '';
        if (this.algo === 'caesar') {
            const shift = parseInt(document.getElementById('cipher-shift').value);
            result = this.caesar(input, this.mode === 'encode' ? shift : -shift);
        } else {
            const key = document.getElementById('cipher-key').value;
            if (!key) return alert('Введите ключевое слово');
            result = this.vigenere(input, key, this.mode);
        }

        document.getElementById('cipher-output').value = result;
        document.getElementById('cipher-result-section').style.display = 'block';
    },

    quickShift(step) {
        const inputEl = document.getElementById('cipher-input');
        if (!inputEl.value) return;
        
        // Сдвигаем текст прямо в поле ввода
        inputEl.value = this.caesar(inputEl.value, step);
        
        // Показываем визуальный фидбек (можно добавить вспышку или просто обновить результат)
        this.execute();
    },

    caesar(text, shift) {
        const ruLower = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
        const ruUpper = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
        const enLower = 'abcdefghijklmnopqrstuvwxyz';
        const enUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        return text.split('').map(char => {
            if (ruLower.includes(char)) {
                const idx = (ruLower.indexOf(char) + shift) % 33;
                return ruLower[(idx + 33) % 33];
            }
            if (ruUpper.includes(char)) {
                const idx = (ruUpper.indexOf(char) + shift) % 33;
                return ruUpper[(idx + 33) % 33];
            }
            if (enLower.includes(char)) {
                const idx = (enLower.indexOf(char) + shift) % 26;
                return enLower[(idx + 26) % 26];
            }
            if (enUpper.includes(char)) {
                const idx = (enUpper.indexOf(char) + shift) % 26;
                return enUpper[(idx + 26) % 26];
            }
            return char;
        }).join('');
    },

    vigenere(text, key, mode) {
        const ruLower = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
        const ruUpper = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
        const enLower = 'abcdefghijklmnopqrstuvwxyz';
        const enUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        key = key.toLowerCase();
        let keyIndex = 0;
        const isEncode = mode === 'encode';

        return text.split('').map(char => {
            let alphabet = '';
            if (ruLower.includes(char)) alphabet = ruLower;
            else if (ruUpper.includes(char)) alphabet = ruUpper;
            else if (enLower.includes(char)) alphabet = enLower;
            else if (enUpper.includes(char)) alphabet = enUpper;
            else return char;

            const kChar = key[keyIndex % key.length];
            let shift = 0;
            
            if (ruLower.includes(kChar)) shift = ruLower.indexOf(kChar);
            else if (enLower.includes(kChar)) shift = enLower.indexOf(kChar);
            else shift = 0;

            if (!isEncode) shift = -shift;

            keyIndex++;
            const idx = (alphabet.indexOf(char) + shift) % alphabet.length;
            return alphabet[(idx + alphabet.length) % alphabet.length];
        }).join('');
    },

    copy() {
        const text = document.getElementById('cipher-output').value;
        navigator.clipboard.writeText(text).then(() => alert('Скопировано!'));
    }
};
