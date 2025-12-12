const { askClaudeWithImage } = require('../llm-client');
const sharp = require('sharp');

async function processImage(buffer) {
    console.log('[IMAGE] Processing image file...');
    
    try {
        // Get image metadata
        const metadata = await sharp(buffer).metadata();
        console.log(`[IMAGE] Format: ${metadata.format}, Size: ${metadata.width}x${metadata.height}`);

        // Convert to base64 for Claude
        let base64Data;
        let mimeType;

        if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
            mimeType = 'image/jpeg';
            base64Data = buffer.toString('base64');
        } else if (metadata.format === 'png') {
            mimeType = 'image/png';
            base64Data = buffer.toString('base64');
        } else if (metadata.format === 'gif') {
            mimeType = 'image/gif';
            base64Data = buffer.toString('base64');
        } else if (metadata.format === 'webp') {
            mimeType = 'image/webp';
            base64Data = buffer.toString('base64');
        } else {
            // Convert other formats to PNG
            console.log(`[IMAGE] Converting ${metadata.format} to PNG...`);
            const pngBuffer = await sharp(buffer).png().toBuffer();
            mimeType = 'image/png';
            base64Data = pngBuffer.toString('base64');
        }

        const dataUri = `data:${mimeType};base64,${base64Data}`;

        // Use Claude to analyze the image
        const analysisPrompt = `Analyze this image and extract all relevant information including:
- Any text visible in the image (OCR)
- Any data, numbers, charts, or graphs
- Visual elements and their descriptions
- Any patterns or important details

Provide a detailed analysis.`;

        console.log('[IMAGE] Sending to Claude for analysis...');
        const analysis = await askClaudeWithImage(analysisPrompt, dataUri);

        return {
            metadata: {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                channels: metadata.channels,
                hasAlpha: metadata.hasAlpha
            },
            analysis: analysis,
            base64: dataUri
        };

    } catch (error) {
        console.error('[IMAGE] Error processing image:', error.message);
        throw error;
    }
}

async function createChart(data, type = 'bar') {
    console.log(`[IMAGE] Creating ${type} chart...`);
    
    try {
        const { createCanvas } = require('canvas');
        const { Chart } = require('chart.js/auto');

        const width = 800;
        const height = 600;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const chart = new Chart(ctx, {
            type: type,
            data: data,
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: {
                        display: true
                    }
                }
            }
        });

        // Convert to base64
        const base64 = canvas.toDataURL('image/png');
        
        console.log('[IMAGE] Chart created successfully');
        return base64;

    } catch (error) {
        console.error('[IMAGE] Error creating chart:', error.message);
        throw error;
    }
}

module.exports = {
    processImage,
    createChart
};