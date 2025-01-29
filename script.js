// 全局变量
let uploadedImages = [];
let optimizedImages = [];
let selectedImages = [];
let faceCount = 0;
let filteredCount = 0;

if (document.getElementById('file-input')) {
    const fileInput = document.getElementById('file-input');
    const previewContainer = document.getElementById('preview-container');
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        previewContainer.innerHTML = '';
        for (let i = 0; i < files.length; i++) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                uploadedImages.push(img);
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(files[i]);
        }
    });

    const detectButton = document.getElementById('detect-button');
    const loading = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');
    detectButton.addEventListener('click', () => {
        loading.style.display = 'block';
        if (typeof Worker !== 'undefined') {
            const worker = new Worker('worker.js');

            worker.onmessage = function (e) {
                if (e.data.hasOwnProperty('progress')) {
                    progressBar.value = e.data.progress;
                } else {
                    const { optimizedImages: optImages, faceCount: fc, filteredCount: fcCount } = e.data;
                    loading.style.display = 'none';
                    optimizedImages = optImages.map(dataURL => {
                        const img = new Image();
                        img.src = dataURL;
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        ctx.drawImage(img, 0, 0);
                        return canvas;
                    });
                    faceCount = fc;
                    filteredCount = fcCount;
                    sessionStorage.setItem('optimizedImages', JSON.stringify(optimizedImages.map(canvas => canvas.toDataURL())));
                    sessionStorage.setItem('faceCount', faceCount);
                    sessionStorage.setItem('filteredCount', filteredCount);
                    window.location.href = 'result.html';
                }
            };

            worker.postMessage({ uploadedImages });
        } else {
            alert('您的浏览器不支持 Web Worker，可能会影响性能。');
            // 可以选择使用其他方式处理
        }
    });
}

if (document.getElementById('view-optimized-button')) {
    const storedImages = sessionStorage.getItem('optimizedImages');
    if (storedImages) {
        optimizedImages = JSON.parse(storedImages).map(dataURL => {
            const img = new Image();
            img.src = dataURL;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            return canvas;
        });
    }
    faceCount = sessionStorage.getItem('faceCount');
    filteredCount = sessionStorage.getItem('filteredCount');

    const imageContainer = document.getElementById('image-container');
    const viewOptimizedButton = document.getElementById('view-optimized-button');
    viewOptimizedButton.addEventListener('click', () => {
        imageContainer.innerHTML = '';
        optimizedImages.forEach((canvas, index) => {
            const img = new Image();
            img.src = canvas.toDataURL();
            img.dataset.index = index;
            img.addEventListener('click', () => {
                if (img.classList.contains('selected')) {
                    img.classList.remove('selected');
                    selectedImages = selectedImages.filter(i => i !== index);
                } else {
                    img.classList.add('selected');
                    selectedImages.push(index);
                }
            });
            imageContainer.appendChild(img);
        });
        const analysisInfo = document.getElementById('analysis-info');
        analysisInfo.style.display = 'block';
        document.querySelector('#face-count span').textContent = faceCount;
        document.querySelector('#filtered-count span').textContent = filteredCount;
    });

    const saveButton = document.getElementById('save-button');
    saveButton.addEventListener('click', () => {
        optimizedImages.forEach((canvas, index) => {
            const link = document.createElement('a'); // 修复：添加了 'a'
            link.href = canvas.toDataURL();
            link.download = `optimized_image_${index}.png`;
            link.click();
        });
    });

    const fineTuneButton = document.getElementById('fine-tune-button');
    const fineTuneSection = document.getElementById('fine-tune-section');
    fineTuneButton.addEventListener('click', () => {
        fineTuneSection.style.display = 'flex';
    });

    const applyTuneButton = document.getElementById('apply-tune-button');
    applyTuneButton.addEventListener('click', () => {
        const brightness = parseInt(document.getElementById('brightness').value);
        const contrast = parseInt(document.getElementById('contrast').value);
        const sharpness = parseInt(document.getElementById('sharpness').value);

        optimizedImages = optimizedImages.map(canvas => {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 调整亮度和对比度
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, (data[i] - 128) * (contrast / 100) + 128 + brightness));
                data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * (contrast / 100) + 128 + brightness));
                data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * (contrast / 100) + 128 + brightness));
            }

            // 调整锐度（简单示例）
            if (sharpness !== 100) {
                const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                tempCtx.drawImage(canvas, 0, 0);
                const tempImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
                const tempData = tempImageData.data;
                for (let y = 1; y < canvas.height - 1; y++) {
                    for (let x = 1; x < canvas.width - 1; x++) {
                        for (let c = 0; c < 3; c++) {
                            let sum = 0;
                            for (let ky = -1; ky <= 1; ky++) {
                                for (let kx = -1; kx <= 1; kx++) {
                                    const index = ((y + ky) * canvas.width + (x + kx)) * 4 + c;
                                    sum += tempData[index] * kernel[(ky + 1) * 3 + (kx + 1)];
                                }
                            }
                            const index = (y * canvas.width + x) * 4 + c;
                            data[index] = Math.min(255, Math.max(0, sum));
                        }
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
            return canvas;
        });
        imageContainer.innerHTML = '';
        optimizedImages.forEach(canvas => {
            const img = new Image();
            img.src = canvas.toDataURL();
            imageContainer.appendChild(img);
        });
    });

    const deleteSelectedButton = document.getElementById('delete-selected-button');
    deleteSelectedButton.addEventListener('click', () => {
        selectedImages.sort((a, b) => b - a);
        selectedImages.forEach(index => {
            optimizedImages.splice(index, 1);
        });
        selectedImages = [];
        imageContainer.innerHTML = '';
        optimizedImages.forEach((canvas, index) => {
            const img = new Image();
            img.src = canvas.toDataURL();
            img.dataset.index = index;
            img.addEventListener('click', () => {
                if (img.classList.contains('selected')) {
                    img.classList.remove('selected');
                    selectedImages = selectedImages.filter(i => i !== index);
                } else {
                    img.classList.add('selected');
                    selectedImages.push(index);
                }
            });
            imageContainer.appendChild(img);
        });
    });
}