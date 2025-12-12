const { extractQuizFromPage, downloadFile } = require('./browser-handler');
const { askClaude, askClaudeWithContext } = require('./llm-client');
const { processCSV } = require('./processors/csv-processor');
const { processPDF } = require('./processors/pdf-processor');
const { processImage } = require('./processors/image-processor');
const { processAudio } = require('./processors/audio-processor');
const { processVideo } = require('./processors/video-processor');
const axios = require('axios');

const TIMEOUT_MS = 170000; // 2 minutes 50 seconds (safety margin)

async function solveMasterQuiz(email, secret, initialUrl, startTime) {
    let currentUrl = initialUrl;
    let attemptCount = 0;
    const maxAttempts = 50;

    console.log(`\n[MASTER] Starting quiz chain from: ${currentUrl}`);

    while (currentUrl && attemptCount < maxAttempts) {
        attemptCount++;
        const elapsed = Date.now() - startTime;
        const remaining = TIMEOUT_MS - elapsed;

        if (remaining < 10000) {
            console.log(`[MASTER] Time running out (${remaining}ms left), stopping`);
            break;
        }

        console.log(`\n[MASTER] === Attempt ${attemptCount} ===`);
        console.log(`[MASTER] URL: ${currentUrl}`);
        console.log(`[MASTER] Time remaining: ${Math.round(remaining / 1000)}s`);

        try {
            const result = await solveSingleQuiz(email, secret, currentUrl, startTime);
            
            if (result.success) {
                console.log(`[MASTER] ✓ Quiz solved successfully`);
                if (result.nextUrl) {
                    console.log(`[MASTER] → Moving to next quiz: ${result.nextUrl}`);
                    currentUrl = result.nextUrl;
                } else {
                    console.log(`[MASTER] ✓ Quiz chain completed - no more URLs`);
                    break;
                }
            } else {
                console.log(`[MASTER] ✗ Quiz failed: ${result.error}`);
                if (result.nextUrl) {
                    console.log(`[MASTER] → Skipping to next quiz: ${result.nextUrl}`);
                    currentUrl = result.nextUrl;
                } else {
                    console.log(`[MASTER] No next URL, stopping`);
                    break;
                }
            }
        } catch (error) {
            console.error(`[MASTER] Error solving quiz:`, error.message);
            break;
        }
    }

    console.log(`\n[MASTER] Quiz chain ended after ${attemptCount} attempts`);
}

async function solveSingleQuiz(email, secret, quizUrl, startTime) {
    try {
        console.log(`\n[SOLVER] Extracting quiz from page...`);
        const quizData = await extractQuizFromPage(quizUrl);
        
        console.log(`[SOLVER] Quiz extracted:`);
        console.log(`  Question: ${quizData.question.substring(0, 200)}...`);
        console.log(`  Submit URL: ${quizData.submitUrl}`);
        console.log(`  Files found: ${quizData.files.length}`);

        let answer = await solveQuizQuestion(quizData, startTime);
        
        console.log(`[SOLVER] Generated answer:`, typeof answer === 'object' ? JSON.stringify(answer) : answer);

        const submitResult = await submitAnswer(email, secret, quizUrl, answer, quizData.submitUrl);
        
        return {
            success: submitResult.correct,
            nextUrl: submitResult.url,
            error: submitResult.reason
        };

    } catch (error) {
        console.error(`[SOLVER] Error:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

async function solveQuizQuestion(quizData, startTime) {
    const { question, content, files } = quizData;

    try {
        // Check if files need to be downloaded and processed
        if (files.length > 0) {
            console.log(`[SOLVER] Processing ${files.length} file(s)...`);
            
            for (const fileInfo of files) {
                try {
                    const fileData = await downloadFile(fileInfo.url);
                    const fileType = detectFileType(fileInfo.url, fileInfo.text);
                    
                    console.log(`[SOLVER] Processing file: ${fileInfo.text} (type: ${fileType})`);

                    let processedData = null;
                    
                    if (fileType === 'csv') {
                        processedData = await processCSV(fileData);
                    } else if (fileType === 'pdf') {
                        processedData = await processPDF(fileData);
                    } else if (fileType === 'image') {
                        processedData = await processImage(fileData);
                    } else if (fileType === 'audio') {
                        processedData = await processAudio(fileData);
                    } else if (fileType === 'video') {
                        processedData = await processVideo(fileData);
                    } else if (fileType === 'json') {
                        processedData = JSON.parse(fileData.toString());
                    } else if (fileType === 'excel') {
                        const { processExcel } = require('./processors/csv-processor');
                        processedData = await processExcel(fileData);
                    } else {
                        processedData = fileData.toString();
                    }

                    // Ask Claude to analyze the data and answer the question
                    const analysisPrompt = `You are solving a quiz question. Here is the question:

${question}

Here is the processed data from the file "${fileInfo.text}":
${typeof processedData === 'object' ? JSON.stringify(processedData, null, 2) : processedData}

Additional context from the page:
${content}

Analyze this data and provide the EXACT answer to the question. Your response should be ONLY the answer value, nothing else.

Rules:
- If the answer is a number, respond with just the number (e.g., 42 or 3.14)
- If the answer is text, respond with just the text (e.g., "hello")
- If the answer is boolean, respond with true or false
- If the answer is a JSON object, respond with valid JSON only
- If you need to generate a chart/image, create it and respond with the base64 data URI
- Do not include any explanation or extra text

Answer:`;

                    const answer = await askClaude(analysisPrompt);
                    return parseAnswer(answer);

                } catch (fileError) {
                    console.error(`[SOLVER] Error processing file ${fileInfo.text}:`, fileError.message);
                }
            }
        }

        // No files or file processing failed, use Claude to solve based on question and content
        const directPrompt = `You are solving a quiz question. Here is the complete context:

Question: ${question}

Page content:
${content}

Analyze this and provide the EXACT answer. Your response should be ONLY the answer value.

Rules:
- If the answer is a number, respond with just the number
- If the answer is text, respond with just the text
- If the answer is boolean, respond with true or false
- If the answer is a JSON object, respond with valid JSON only
- Do not include any explanation

Answer:`;

        const answer = await askClaude(directPrompt);
        return parseAnswer(answer);

    } catch (error) {
        console.error(`[SOLVER] Error solving question:`, error.message);
        throw error;
    }
}

function detectFileType(url, fileName) {
    const lower = (url + ' ' + fileName).toLowerCase();
    
    if (lower.includes('.csv')) return 'csv';
    if (lower.includes('.xlsx') || lower.includes('.xls')) return 'excel';
    if (lower.includes('.pdf')) return 'pdf';
    if (lower.includes('.json')) return 'json';
    if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || 
        lower.includes('.gif') || lower.includes('.bmp') || lower.includes('.webp')) return 'image';
    if (lower.includes('.mp3') || lower.includes('.wav') || lower.includes('.ogg') || 
        lower.includes('.m4a')) return 'audio';
    if (lower.includes('.mp4') || lower.includes('.avi') || lower.includes('.mov') || 
        lower.includes('.mkv')) return 'video';
    
    return 'text';
}

function parseAnswer(rawAnswer) {
    const trimmed = rawAnswer.trim();
    
    // Try to parse as JSON
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            return JSON.parse(trimmed);
        } catch (e) {
            // Not valid JSON, continue
        }
    }
    
    // Check for boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    
    // Check for number
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') {
        return num;
    }
    
    // Check for base64 data URI
    if (trimmed.startsWith('data:')) {
        return trimmed;
    }
    
    // Return as string
    return trimmed;
}

async function submitAnswer(email, secret, quizUrl, answer, submitUrl) {
    const payload = {
        email,
        secret,
        url: quizUrl,
        answer
    };

    console.log(`[SUBMIT] Submitting to: ${submitUrl}`);
    console.log(`[SUBMIT] Payload:`, JSON.stringify(payload, null, 2));

    try {
        const response = await axios.post(submitUrl, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        console.log(`[SUBMIT] Response status: ${response.status}`);
        console.log(`[SUBMIT] Response:`, JSON.stringify(response.data, null, 2));

        return response.data;
    } catch (error) {
        console.error(`[SUBMIT] Error:`, error.message);
        if (error.response) {
            console.error(`[SUBMIT] Response status: ${error.response.status}`);
            console.error(`[SUBMIT] Response data:`, error.response.data);
            return error.response.data;
        }
        throw error;
    }
}

module.exports = {
    solveMasterQuiz,
    solveSingleQuiz
};