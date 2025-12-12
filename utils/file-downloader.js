const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function downloadFile(url, options = {}) {
    console.log(`[DOWNLOADER] Downloading: ${url}`);
    
    const maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    const timeout = options.timeout || 60000; // 60 seconds default
    
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'arraybuffer',
            timeout: timeout,
            maxContentLength: maxSize,
            maxBodyLength: maxSize,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                ...options.headers
            }
        });

        const buffer = Buffer.from(response.data);
        console.log(`[DOWNLOADER] Downloaded ${buffer.length} bytes (${(buffer.length / 1024).toFixed(2)} KB)`);
        
        return {
            buffer: buffer,
            contentType: response.headers['content-type'],
            size: buffer.length,
            headers: response.headers
        };

    } catch (error) {
        console.error(`[DOWNLOADER] Error downloading file:`, error.message);
        if (error.response) {
            console.error(`[DOWNLOADER] Status: ${error.response.status}`);
        }
        throw error;
    }
}

async function downloadAndSave(url, outputPath = null, options = {}) {
    const downloadResult = await downloadFile(url, options);
    
    if (!outputPath) {
        const filename = path.basename(new URL(url).pathname) || `download_${Date.now()}`;
        outputPath = path.join(os.tmpdir(), filename);
    }
    
    await fs.writeFile(outputPath, downloadResult.buffer);
    console.log(`[DOWNLOADER] Saved to: ${outputPath}`);
    
    return {
        ...downloadResult,
        path: outputPath
    };
}

async function downloadMultiple(urls, options = {}) {
    console.log(`[DOWNLOADER] Downloading ${urls.length} files...`);
    
    const results = [];
    const parallel = options.parallel !== false;
    
    if (parallel) {
        const promises = urls.map(url => 
            downloadFile(url, options).catch(error => ({
                error: error.message,
                url: url
            }))
        );
        results.push(...await Promise.all(promises));
    } else {
        for (const url of urls) {
            try {
                const result = await downloadFile(url, options);
                results.push(result);
            } catch (error) {
                results.push({
                    error: error.message,
                    url: url
                });
            }
        }
    }
    
    const successful = results.filter(r => !r.error).length;
    console.log(`[DOWNLOADER] Downloaded ${successful}/${urls.length} files successfully`);
    
    return results;
}

function getFileExtension(url, contentType = null) {
    // Try to get from URL
    const urlPath = new URL(url).pathname;
    const urlExt = path.extname(urlPath).toLowerCase();
    if (urlExt) {
        return urlExt.substring(1);
    }
    
    // Try to get from content type
    if (contentType) {
        const mimeMap = {
            'text/csv': 'csv',
            'application/pdf': 'pdf',
            'application/json': 'json',
            'application/vnd.ms-excel': 'xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg',
            'video/mp4': 'mp4',
            'video/x-msvideo': 'avi',
            'video/quicktime': 'mov'
        };
        
        return mimeMap[contentType.split(';')[0].trim()] || 'bin';
    }
    
    return 'bin';
}

module.exports = {
    downloadFile,
    downloadAndSave,
    downloadMultiple,
    getFileExtension
};