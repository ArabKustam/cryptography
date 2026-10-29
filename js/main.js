document.addEventListener('DOMContentLoaded', () => {
    // Initialize only the modules whose panels exist on the current page
    if (document.getElementById('stegano') && typeof steganoModule !== 'undefined') {
        steganoModule.init();
    }
    if (document.getElementById('spectro') && typeof spectroModule !== 'undefined') {
        spectroModule.init();
    }
    if (document.getElementById('morse') && typeof morseModule !== 'undefined') {
        morseModule.init();
    }
    if (document.getElementById('qrcode') && typeof qrModule !== 'undefined') {
        qrModule.init();
    }
    if (document.getElementById('base') && typeof baseModule !== 'undefined') {
        baseModule.init();
    }
    if (document.getElementById('ciphers') && typeof ciphersModule !== 'undefined') {
        ciphersModule.init();
    }
    if (document.getElementById('metadata') && typeof metadataModule !== 'undefined') {
        metadataModule.init();
    }
    if (document.getElementById('editor') && typeof imageEditorModule !== 'undefined') {
        imageEditorModule.init();
    }

    // Global Paste Handler
    document.addEventListener('paste', (e) => {
        if (!e.clipboardData || !e.clipboardData.items) return;
        
        const activeTab = document.querySelector('.nav-item.active');
        if (!activeTab) return;
        const tabId = activeTab.dataset.tab;
        
        let targetHandler = null;

        for (let i = 0; i < e.clipboardData.items.length; i++) {
            const item = e.clipboardData.items[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                
                if (tabId === 'stegano' && typeof steganoModule !== 'undefined') {
                    targetHandler = steganoModule.handleImage.bind(steganoModule);
                }
                else if (tabId === 'spectro' && typeof spectroModule !== 'undefined') {
                    const modeBtn = document.querySelector('#spectro .mode-btn.active');
                    if (modeBtn && modeBtn.dataset.spectroMode === 'encode') {
                        targetHandler = spectroModule.handleImage.bind(spectroModule);
                    }
                }
                else if (tabId === 'qrcode' && typeof qrModule !== 'undefined') {
                    const modeBtn = document.querySelector('#qrcode .mode-btn.active');
                    if (modeBtn && modeBtn.dataset.qrmode === 'scan') {
                        targetHandler = qrModule.handleScanFile.bind(qrModule);
                    } else {
                        targetHandler = qrModule.handleLogo.bind(qrModule);
                    }
                }
                else if (tabId === 'base' && typeof baseModule !== 'undefined') {
                    const datatypeEl = document.getElementById('base-datatype');
                    if (datatypeEl && datatypeEl.value === 'file') {
                        targetHandler = baseModule.handleFile.bind(baseModule);
                    }
                }
                else if (tabId === 'editor' && typeof imageEditorModule !== 'undefined') {
                    targetHandler = imageEditorModule.handleImage.bind(imageEditorModule);
                }

                if (targetHandler) {
                    targetHandler(file);
                }
                break;
            }
        }
    });
});

