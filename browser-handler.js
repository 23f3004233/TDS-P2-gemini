const puppeteer = require('puppeteer');
const axios = require('axios');

let browser = null;

async function getBrowser() {
    if (!browser) {
        console.log('[BROWSER] Launching Puppeteer...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });
        console.log('[BROWSER] Puppeteer launched successfully');
    }
    return browser;
}

async function extractQuizFromPage(url) {
    const br = await getBrowser();
    const page = await br.newPage();
    
    try {
        console.log(`[BROWSER] Navigating to: ${url}`);
        
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for page to render
        await page.waitForTimeout(2000);

        console.log('[BROWSER] Page loaded, extracting content...');

        // Extract all text content
        const pageData = await page.evaluate(() => {
            const getText = (element) => {
                const text = element.innerText || element.textContent || '';
                return text.trim();
            };

            // Get the main question
            let question = '';
            const questionElements = document.querySelectorAll('h1, h2, h3, .question, [class*="question"]');
            if (questionElements.length > 0) {
                question = getText(questionElements[0]);
            } else {
                // Fallback: get first heading or prominent text
                const body = document.body;
                question = getText(body).split('\n')[0];
            }

            // Get all visible text content
            const allText = getText(document.body);

            // Find all links (potential file downloads)
            const links = Array.from(document.querySelectorAll('a')).map(a => ({
                url: a.href,
                text: getText(a)
            })).filter(link => link.url && link.url.startsWith('http'));

            // Find submit URL (look for specific patterns)
            let submitUrl = null;
            const submitPatterns = ['/submit', 'submit', 'answer'];
            
            // Check in text content
            const urlRegex = /https?:\/\/[^\s<>"]+/g;
            const foundUrls = allText.match(urlRegex) || [];
            
            for (const foundUrl of foundUrls) {
                for (const pattern of submitPatterns) {
                    if (foundUrl.includes(pattern)) {
                        submitUrl = foundUrl;
                        break;
                    }
                }
                if (submitUrl) break;
            }

            return {
                question,
                content: allText,
                links,
                submitUrl
            };
        });

        console.log('[BROWSER] Extracted data from page');
        
        // Filter links to find file downloads
        const fileLinks = pageData.links.filter(link => {
            const lower = (link.url + ' ' + link.text).toLowerCase();
            return lower.includes('download') || 
                   lower.includes('.csv') || 
                   lower.includes('.pdf') ||
                   lower.includes('.xlsx') ||
                   lower.includes('.xls') ||
                   lower.includes('.json') ||
                   lower.includes('.jpg') ||
                   lower.includes('.png') ||
                   lower.includes('.mp3') ||
                   lower.includes('.wav') ||
                   lower.includes('.mp4') ||
                   lower.includes('file');
        });

        return {
            question: pageData.question,
            content: pageData.content,
            submitUrl: pageData.submitUrl,
            files: fileLinks
        };

    } catch (error) {
        console.error('[BROWSER] Error extracting quiz:', error.message);
        throw error;
    } finally {
        await page.close();
    }
}

async function downloadFile(url) {
    console.log(`[DOWNLOAD] Downloading: ${url}`);
    
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000,
            maxContentLength: 50 * 1024 * 1024, // 50MB
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        console.log(`[DOWNLOAD] Downloaded ${response.data.length} bytes`);
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`[DOWNLOAD] Error downloading file:`, error.message);
        throw error;
    }
}

async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        console.log('[BROWSER] Browser closed');
    }
}

// Cleanup on exit
process.on('exit', closeBrowser);
process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit();
});

module.exports = {
    extractQuizFromPage,
    downloadFile,
    closeBrowser
};