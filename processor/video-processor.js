const { askClaude } = require('../llm-client');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function processVideo(buffer) {
    console.log('[VIDEO] Processing video file...');
    
    try {
        // Save buffer temporarily
        const tempFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`);
        await fs.writeFile(tempFile, buffer);
        
        console.log('[VIDEO] Video file saved temporarily');
        
        const videoInfo = {
            size: buffer.length,
            format: detectVideoFormat(buffer)
        };
        
        console.log('[VIDEO] Video info:', videoInfo);

        // For video analysis, we need external tools
        // Since we can't process video directly, use Claude for guidance
        const prompt = `This is a video file that needs analysis.
The video file is ${buffer.length} bytes in ${videoInfo.format} format.

Based on common quiz patterns with video files, what kind of information might be requested:
1. Frame analysis
2. Audio transcription
3. Text/caption extraction
4. Object detection
5. Scene changes

Provide guidance on approaching this.`;

        const guidance = await askClaude(prompt);

        // Clean up temp file
        try {
            await fs.unlink(tempFile);
        } catch (e) {
            // Ignore cleanup errors
        }

        return {
            info: videoInfo,
            analysis: guidance,
            note: 'Direct video processing not available - using context analysis'
        };

    } catch (error) {
        console.error('[VIDEO] Error processing video:', error.message);
        throw error;
    }
}

function detectVideoFormat(buffer) {
    const header = buffer.slice(0, 12);
    
    if (header[4] === 0x66 && header[5] === 0x74 && 
        header[6] === 0x79 && header[7] === 0x70) {
        const brand = header.toString('ascii', 8, 12);
        if (brand.includes('mp4') || brand.includes('isom')) {
            return 'mp4';
        } else if (brand.includes('qt')) {
            return 'mov';
        } else if (brand.includes('M4V')) {
            return 'm4v';
        }
    }
    
    if (header.toString('ascii', 0, 4) === 'RIFF' && 
        header.toString('ascii', 8, 12) === 'AVI ') {
        return 'avi';
    }
    
    if (header[0] === 0x1A && header[1] === 0x45 && 
        header[2] === 0xDF && header[3] === 0xA3) {
        return 'mkv';
    }
    
    return 'unknown';
}

module.exports = {
    processVideo
};