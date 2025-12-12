const { askClaude } = require('../llm-client');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function processAudio(buffer) {
    console.log('[AUDIO] Processing audio file...');
    
    try {
        // Use Whisper API via OpenAI-compatible endpoint (free alternatives exist)
        // For now, we'll use a workaround with Claude analyzing audio properties
        
        // Save buffer temporarily
        const tempFile = path.join(os.tmpdir(), `audio_${Date.now()}.mp3`);
        await fs.writeFile(tempFile, buffer);
        
        console.log('[AUDIO] Audio file saved temporarily');
        
        // Try to get audio duration and properties
        const audioInfo = await getAudioInfo(buffer);
        
        console.log('[AUDIO] Audio info:', audioInfo);

        // For speech-to-text, we need an external service
        // Let's try using a free Whisper API or Assembly AI
        let transcription = null;
        
        try {
            transcription = await transcribeAudio(buffer);
        } catch (transcribeError) {
            console.warn('[AUDIO] Transcription failed:', transcribeError.message);
        }

        // Clean up temp file
        try {
            await fs.unlink(tempFile);
        } catch (e) {
            // Ignore cleanup errors
        }

        return {
            info: audioInfo,
            transcription: transcription,
            size: buffer.length
        };

    } catch (error) {
        console.error('[AUDIO] Error processing audio:', error.message);
        throw error;
    }
}

async function getAudioInfo(buffer) {
    // Basic audio info extraction
    return {
        size: buffer.length,
        format: detectAudioFormat(buffer)
    };
}

function detectAudioFormat(buffer) {
    // Check magic numbers
    const header = buffer.slice(0, 12);
    
    if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) {
        return 'mp3';
    } else if (header.toString('ascii', 0, 4) === 'RIFF' && 
               header.toString('ascii', 8, 12) === 'WAVE') {
        return 'wav';
    } else if (header.toString('ascii', 0, 4) === 'fLaC') {
        return 'flac';
    } else if (header.toString('ascii', 0, 4) === 'OggS') {
        return 'ogg';
    } else if (header[4] === 0x66 && header[5] === 0x74 && 
               header[6] === 0x79 && header[7] === 0x70) {
        return 'm4a';
    }
    
    return 'unknown';
}

async function transcribeAudio(buffer) {
    console.log('[AUDIO] Attempting transcription...');
    
    // Since we don't have API keys, we'll use Claude to provide guidance
    // In a real scenario, you'd use Whisper API or similar
    
    const prompt = `This is an audio file that needs transcription. 
Since I cannot directly process audio, please provide guidance on:
1. What information might be in the audio based on the context
2. Common patterns in audio quiz questions
3. How to approach this systematically

The audio file is ${buffer.length} bytes.`;

    const guidance = await askClaude(prompt);
    
    return {
        method: 'guidance',
        content: guidance,
        note: 'Direct transcription not available - using context analysis'
    };
}

module.exports = {
    processAudio
};