const { askClaudeWithPDF, askClaude } = require('../llm-client');
const pdfParse = require('pdf-parse');

async function processPDF(buffer) {
    console.log('[PDF] Processing PDF file...');
    
    try {
        // First try to extract text using pdf-parse
        const pdfData = await pdfParse(buffer);
        
        console.log(`[PDF] Extracted text from ${pdfData.numpages} pages`);
        console.log(`[PDF] Text length: ${pdfData.text.length} characters`);

        // If text extraction is successful and substantial, return it
        if (pdfData.text && pdfData.text.trim().length > 100) {
            return {
                text: pdfData.text,
                pages: pdfData.numpages,
                info: pdfData.info,
                method: 'text-extraction'
            };
        }

        // If text extraction failed or too short, use Claude vision
        console.log('[PDF] Text extraction insufficient, using Claude vision...');
        const base64 = buffer.toString('base64');
        
        const visionPrompt = `Please extract all text and data from this PDF document. Include:
- All visible text
- Any tables or structured data
- Numbers and values
- Headers and sections

Format the output as plain text or JSON if there's structured data.`;

        const extractedContent = await askClaudeWithPDF(visionPrompt, base64);
        
        return {
            text: extractedContent,
            pages: pdfData.numpages,
            method: 'claude-vision'
        };

    } catch (error) {
        console.error('[PDF] Error processing PDF:', error.message);
        
        // Last resort: send to Claude as base64
        try {
            console.log('[PDF] Fallback: sending PDF to Claude...');
            const base64 = buffer.toString('base64');
            const visionPrompt = `Extract all text and data from this PDF.`;
            const extractedContent = await askClaudeWithPDF(visionPrompt, base64);
            
            return {
                text: extractedContent,
                method: 'claude-fallback'
            };
        } catch (fallbackError) {
            console.error('[PDF] Fallback also failed:', fallbackError.message);
            throw error;
        }
    }
}

module.exports = {
    processPDF
};