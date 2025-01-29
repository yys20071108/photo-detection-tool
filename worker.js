importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest');
importScripts('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@latest');

self.onerror = function (error) {
    console.error('Web Worker 出错:', error.message);
    self.postMessage({ error: error.message });
};

self.onmessage = async function (e) {
    try {
        const { uploadedImages } = e.data;
        const model = await blazeface.load();
        const optimizedImages = [];
        let faceCount = 0;
        let filteredCount = 0;

        const totalImages = uploadedImages.length;
        for (let i = 0; i < totalImages; i++) {
            const predictions = await model.estimateFaces(uploadedImages[i]);
            let shouldKeep = true;

            faceCount += predictions.length;

            // 简单的闭眼检测逻辑示例（准确性有限）
            if (predictions.length > 0) {
                const face = predictions[0];
                const leftEye = face.landmarks[0];
                const rightEye = face.landmarks[1];
                // 这里简单假设眼睛垂直距离过小为闭眼
                if (Math.abs(leftEye[1] - face.landmarks[2][1]) < 10 || Math.abs(rightEye[1] - face.landmarks[3][1]) < 10) {
                    shouldKeep = false;
                    filteredCount++;
                }
            }

            if (shouldKeep) {
                const canvas = new OffscreenCanvas(uploadedImages[i].width, uploadedImages[i].height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(uploadedImages[i], 0, 0);

                // 自动优化：直方图均衡化增强对比度
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const histogram = new Array(256).fill(0);
                for (let j = 0; j < data.length; j += 4) {
                    const gray = (data[j] + data[j + 1] + data[j + 2]) / 3;
                    histogram[Math.round(gray)]++;
                }
                const cdf = new Array(256);
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
                const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
                const tempCtx = tempCanvas.getContext('2d');
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

            // 计算并发送进度
            const progress = Math.round((i + 1) / totalImages * 100);
            self.postMessage({ progress });
        }

        self.postMessage({ optimizedImages, faceCount, filteredCount });
    } catch (error) {
        console.error('人脸检测及优化过程出错:', error);
        self.postMessage({ error: error.message });
    }
};