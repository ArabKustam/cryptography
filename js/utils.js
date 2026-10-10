window.CryptoUtils = {
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
            if (e.dataTransfer.files.length) {
                handler(e.dataTransfer.files[0]);
            }
        });
        input.addEventListener('change', () => {
            if (input.files.length) {
                const file = input.files[0];
                input.value = '';
                handler(file);
            }
        });
    }
};

// debug: validation checkpoint
