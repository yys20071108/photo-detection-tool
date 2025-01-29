// 全局变量
let uploadedImages = [];
let optimizedImages = [];
let selectedImages = [];
let faceCount = 0;
let filteredCount = 0;

// 事件监听器：文件输入变化时触发
document.getElementById('file-input').addEventListener('change', (e) => {
    const files = e.target.files;
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = ''; // 清空预览容器
    uploadedImages = []; // 清空已上传的图片数组

    for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            uploadedImages.push({ imgElement: img, dataURL: event.target.result }); // 将图片对象和数据URL存储在数组中
            previewContainer.appendChild(img);
        };
        reader.readAsDataURL(files[i]);
    }
});

// 事件监听器：点击检测与筛选按钮时触发
document.getElementById('detect-button').addEventListener('click', () => {
    if (uploadedImages.length === 0) {
        alert('请先上传图片。');
        return;
    }
    const loading = document.getElementById('loading');
    const progressBar = document.getElementById('progress-bar');
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
                    return img;
                });
                faceCount = fc;
                filteredCount = fcCount;
                sessionStorage.setItem('optimizedImages', JSON.stringify(optimizedImages.map(img => img.src)));
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

// 事件监听器：点击自动优化调整按钮时触发
document.getElementById('auto-optimize-button').addEventListener('click', () => {
    if (uploadedImages.length === 0) {
        alert('请先上传图片。');
        return;
    }
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = ''; // 清空预览容器

    for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i].imgElement;
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