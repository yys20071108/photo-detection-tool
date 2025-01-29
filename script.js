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
        if (files.length === 0) {
            alert('请至少选择一张图片进行检测。');
            return;
        }
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
        if (uploadedImages.length === 0) {
            alert('请先上传图片。');
            return;
        }
        loading.style.display = 'block';
        if (typeof Worker !== 'undefined') {
            const worker = new Worker('worker.js');

            worker.onmessage = function (e) {
                console.log('Message received from worker:', e.data);
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