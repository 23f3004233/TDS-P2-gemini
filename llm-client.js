const puppeteer = require('puppeteer');

let llmBrowser = null;
let llmPage = null;

async function initializeLLM() {
    if (!llmBrowser) {
        console.log('[LLM] Initializing Puter.js Claude client...');
        llmBrowser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        llmPage = await llmBrowser.newPage();
        
        // Load a blank page with Puter.js
        await llmPage.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <script src="https://js.puter.com/v2/"></script>
            </head>
            <body>
                <div id="output"></div>
            </body>
            </html>
        `);
        
        // Wait for Puter.js to load
        await llmPage.waitForTimeout(2000);
        console.log('[LLM] Puter.js Claude client initialized');
    }
}

async function askClaude(prompt, options = {}) {
    await initializeLLM();
    
    const model = options.model || 'claude-sonnet-4-5';
    const maxRetries = options.maxRetries || 3;
    
    console.log(`[LLM] Asking Claude (${model})...`);
    console.log(`[LLM] Prompt length: ${prompt.length} chars`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await llmPage.evaluate(async (promptText, modelName) => {
                try {
                    const result = await puter.ai.chat(promptText, { 
                        model: modelName,
                        stream: false
                    });
                    return {
                        success: true,
                        text: result.message.content[0].text
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message || error.toString()
                    };
                }
            }, prompt, model);
            
            if (response.success) {
                console.log(`[LLM] Response received (${response.text.length} chars)`);
                return response.text;
            } else {
                console.error(`[LLM] Error from Claude:`, response.error);
                if (attempt < maxRetries) {
                    console.log(`[LLM] Retrying (${attempt}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                } else {
                    throw new Error(`Claude API error: ${response.error}`);
                }
            }
        } catch (error) {
            console.error(`[LLM] Attempt ${attempt} failed:`, error.message);
            if (attempt < maxRetries) {
                console.log(`[LLM] Retrying (${attempt}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            } else {
                throw error;
            }
        }
    }
}

async function askClaudeWithImage(prompt, imageBase64, options = {}) {
    await initializeLLM();
    
    const model = options.model || 'claude-sonnet-4-5';
    
    console.log(`[LLM] Asking Claude with image (${model})...`);
    
    try {
        const response = await llmPage.evaluate(async (promptText, imageData, modelName) => {
            try {
                // Extract media type and base64 data
                const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
                if (!matches) {
                    throw new Error('Invalid base64 data URI');
                }
                const mediaType = matches[1];
                const base64Data = matches[2];
                
                const result = await puter.ai.chat(promptText, {
                    model: modelName,
                    stream: false,
                    images: [{
                        type: 'base64',
                        media_type: mediaType,
                        data: base64Data
                    }]
                });
                
                return {
                    success: true,
                    text: result.message.content[0].text
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message || error.toString()
                };
            }
        }, prompt, imageBase64, model);
        
        if (response.success) {
            console.log(`[LLM] Response received (${response.text.length} chars)`);
            return response.text;
        } else {
            throw new Error(`Claude API error: ${response.error}`);
        }
    } catch (error) {
        console.error(`[LLM] Error asking Claude with image:`, error.message);
        throw error;
    }
}

async function askClaudeWithPDF(prompt, pdfBase64, options = {}) {
    await initializeLLM();
    
    const model = options.model || 'claude-sonnet-4-5';
    
    console.log(`[LLM] Asking Claude with PDF (${model})...`);
    
    try {
        const response = await llmPage.evaluate(async (promptText, pdfData, modelName) => {
            try {
                // Extract base64 data if it's a data URI
                let base64Data = pdfData;
                if (pdfData.startsWith('data:')) {
                    const matches = pdfData.match(/^data:[^;]+;base64,(.+)$/);
                    if (matches) {
                        base64Data = matches[1];
                    }
                }
                
                const result = await puter.ai.chat(promptText, {
                    model: modelName,
                    stream: false,
                    documents: [{
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: base64Data
                    }]
                });
                
                return {
                    success: true,
                    text: result.message.content[0].text
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message || error.toString()
                };
            }
        }, prompt, pdfBase64, model);
        
        if (response.success) {
            console.log(`[LLM] Response received (${response.text.length} chars)`);
            return response.text;
        } else {
            throw new Error(`Claude API error: ${response.error}`);
        }
    } catch (error) {
        console.error(`[LLM] Error asking Claude with PDF:`, error.message);
        throw error;
    }
}

async function askClaudeWithContext(prompt, context, options = {}) {
    const fullPrompt = `Context:\n${context}\n\nQuestion:\n${prompt}`;
    return askClaude(fullPrompt, options);
}

async function closeLLM() {
    if (llmBrowser) {
        await llmBrowser.close();
        llmBrowser = null;
        llmPage = null;
        console.log('[LLM] LLM client closed');
    }
}

// Cleanup on exit
process.on('exit', closeLLM);
process.on('SIGINT', async () => {
    await closeLLM();
    process.exit();
});

module.exports = {
    askClaude,
    askClaudeWithImage,
    askClaudeWithPDF,
    askClaudeWithContext,
    closeLLM
};