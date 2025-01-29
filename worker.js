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

        for (let i = 0; i < uploadedImages.length; i++) {
            const image = uploadedImages[i].imgElement;
            const predictions = await model.estimateFaces(image);
            faceCount += predictions.length;

            // 简单的闭眼检测逻辑示例（准确性有限）
            let shouldKeep = true;
            if (predictions.length > 0) {
                const face = predictions[0];
                const leftEye = face.landmarks[0];
                const rightEye = face.landmarks[1];
                if (Math.abs(leftEye[1] - face.landmarks[2][1]) < 10 || Math.abs(rightEye[1] - face.landmarks[3][1]) < 10) {
                    shouldKeep = false;
                    filteredCount++;
                }
            }

            if (shouldKeep) {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = image.width;
                canvas.height = image.height;
                ctx.drawImage(image, 0, 0);

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

            const progress = Math.round((i + 1) / uploadedImages.length * 100);
            self.postMessage({ progress });
        }

        self.postMessage({ optimizedImages, faceCount, filteredCount });
    } catch (error) {
        console.error('人脸检测及优化过程出错:', error);
        self.postMessage({ error: error.message });
    }
};