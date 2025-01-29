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
        // 这里可以添加代码来处理图像，例如调用后端API
    });

    autoOptimizeButton.addEventListener('click', () => {
        if (uploadedImages.length === 0) {
            alert('请先上传图片。');
            return;
        }
        // 触发图像优化请求
        optimizeImages();
    });
}

function optimizeImages() {
    // 这里可以添加代码来发送请求到后端进行图像优化
    const formData = new FormData();
    formData.append("images", uploadedImages[0].src);
    fetch('/optimize', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        optimizedImages = [data.optimizedImage];
        displayOptimizedImages();
    })
    .catch(error => console.error('Error:', error));
}

function displayOptimizedImages() {
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = ''; // 清空预览容器
    optimizedImages.forEach((dataURL, index) => {
        const img = new Image();
        img.src = dataURL;
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
        previewContainer.appendChild(img);
    });
}