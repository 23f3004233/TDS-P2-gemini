from playwright.async_api import async_playwright
import logging
from typing import Dict

logger = logging.getLogger(__name__)

class BrowserHandler:
    """Handler for headless browser operations using Playwright"""
    
    def __init__(self):
        self.playwright = None
        self.browser = None
        
    async def __aenter__(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=True)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    
    async def fetch_quiz_page(self, url: str) -> Dict[str, str]:
        """
        Fetch and render a quiz page, extracting all content
        """
        try:
            page = await self.browser.new_page()
            
            # Navigate with extended timeout and wait for network idle
            await page.goto(url, wait_until='networkidle', timeout=30000)
            
            # Wait a bit more for any delayed JavaScript execution
            await page.wait_for_timeout(2000)
            
            # Extract the full HTML content
            html_content = await page.content()
            
            # Extract the visible text content
            text_content = await page.evaluate("""
                () => {
                    return document.body.innerText;
                }
            """)
            
            # Try to extract specific elements that commonly contain quiz content
            result_content = ""
            try:
                result_element = await page.query_selector("#result")
                if result_element:
                    result_content = await result_element.inner_text()
            except:
                pass
            
            await page.close()
            
            logger.info(f"Successfully fetched quiz page from {url}")
            logger.debug(f"Text content length: {len(text_content)}")
            
            return {
                "html": html_content,
                "text": text_content,
                "result": result_content if result_content else text_content,
                "url": url
            }
            
        except Exception as e:
            logger.error(f"Error fetching quiz page from {url}: {e}")
            raise
    
    async def download_file(self, url: str, output_path: str) -> str:
        """
        Download a file using the browser
        """
        try:
            page = await self.browser.new_page()
            
            # Navigate to the file URL
            response = await page.goto(url, wait_until='networkidle', timeout=30000)
            
            if response.status != 200:
                raise Exception(f"Failed to download file: HTTP {response.status}")
            
            # Get the content
            content = await response.body()
            
            # Save to file
            with open(output_path, 'wb') as f:
                f.write(content)
            
            await page.close()
            
            logger.info(f"Successfully downloaded file from {url} to {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error downloading file from {url}: {e}")
            raise