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
        uploadedImages = []; // 清空之前的图片数据
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
    const autoOptimizeButton = document.getElementById('auto-optimize-button');
    const loading = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');

    detectButton.addEventListener('click', () => {
        if (uploadedImages.length === 0) {
            alert('请先上传图片。');
            return;
        }
        loading.style.display = 'block';
        progressBar.value = 0; // 重置进度条
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
                    window.location.href = 'result.html'; // 跳转到结果页面
                }
            };

            worker.postMessage({ uploadedImages }); // 发送图片数据到Web Worker
        } else {
            alert('您的浏览器不支持 Web Worker，可能会影响性能。');
        }
    });

    autoOptimizeButton.addEventListener('click', () => {
        if (uploadedImages.length === 0) {
            alert('请先上传图片。');
            return;
        }
        const previewContainer = document.getElementById('preview-container');
        previewContainer.innerHTML = ''; // 清空预览容器

        for (let i = 0; i < uploadedImages.length; i++) {
            const img = uploadedImages[i];
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            // 自动优化：直方图均衡化增强对比度
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const histogram = new Array(256).fill(0);
            for (let j = 0; j < data.length; j += 4) {
                const gray = (data[j] + data[j + 1] + data[j + 2]) / 3;
                histogram[Math.round(gray)]++;
            }
            const cdf = new Array(256).fill(0);
            cdf[0] = histogram[0];
            for (let j = 1; j < 256; j++) {
                cdf[j] = cdf[j - 1] + histogram[j];
            }
            const minCDF = Math.min(...cdf.filter(val => val > 0));
            const numPixels = canvas.width * canvas.height;
            for (let j = 0; j < data.length; j += 4) {
                const gray = (data[j] + data[j + 1] + data[j + 2]) / 3;
                const newGray = Math.round((cdf[Math.round(gray)] - minCDF) / (numPixels - minCDF) * 255);
                data[j] = newGray;
                data[j + 1] = newGray;
                data[j + 2] = newGray;
            }
            ctx.putImageData(imageData, 0, 0);

            // 自动优化：简单锐化
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
            ctx.putImageData(imageData, 0, 0);

            optimizedImages.push(canvas.toDataURL());
        }

        optimizedImages.forEach((dataURL, index) => {
            const newImg = new Image();
            newImg.src = dataURL;
            newImg.dataset.index = index;
            newImg.addEventListener('click', () => {
                if (newImg.classList.contains('selected')) {
                    newImg.classList.remove('selected');
                    selectedImages = selectedImages.filter(i => i !== index);
                } else {
                    newImg.classList.add('selected');
                    selectedImages.push(index);
                }
            });
            previewContainer.appendChild(newImg);
        });
    });
}