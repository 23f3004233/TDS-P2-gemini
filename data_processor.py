import requests
import PyPDF2
import pandas as pd
import json
import base64
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import io
from bs4 import BeautifulSoup
from PIL import Image
import filetype
import tempfile
import os

logger = logging.getLogger(__name__)

class DataProcessor:
    """Handler for data sourcing and processing"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    async def fetch_data(self, data_source_type: str, data_source_url: Optional[str], 
                        headers: Optional[Dict] = None) -> str:
        """
        Fetch data from various sources
        """
        try:
            if data_source_type == "none" or not data_source_url:
                return ""
            
            if headers:
                self.session.headers.update(headers)
            
            if data_source_type == "pdf_link":
                return await self._fetch_pdf(data_source_url)
            elif data_source_type == "image":
                return await self._fetch_image(data_source_url)
            elif data_source_type == "audio":
                return await self._fetch_audio(data_source_url)
            elif data_source_type == "video":
                return await self._fetch_video(data_source_url)
            elif data_source_type == "url":
                return await self._fetch_url(data_source_url)
            elif data_source_type == "api_endpoint":
                return await self._fetch_api(data_source_url)
            else:
                # Auto-detect based on content
                return await self._fetch_auto_detect(data_source_url)
                
        except Exception as e:
            logger.error(f"Error fetching data from {data_source_url}: {e}")
            raise
    
    async def _fetch_pdf(self, url: str) -> str:
        """
        Fetch and extract text from a PDF
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse PDF
            pdf_file = io.BytesIO(response.content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_content = []
            for page_num, page in enumerate(pdf_reader.pages, 1):
                page_text = page.extract_text()
                text_content.append(f"--- Page {page_num} ---\n{page_text}")
            
            full_text = "\n\n".join(text_content)
            logger.info(f"Extracted {len(full_text)} characters from PDF with {len(pdf_reader.pages)} pages")
            return full_text
            
        except Exception as e:
            logger.error(f"Error fetching PDF from {url}: {e}")
            raise
    
    async def _fetch_url(self, url: str) -> str:
        """
        Fetch content from a URL
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Try to parse as HTML first
            content_type = response.headers.get('content-type', '')
            
            if 'html' in content_type:
                soup = BeautifulSoup(response.text, 'lxml')
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                text = soup.get_text(separator='\n', strip=True)
                return text
            else:
                return response.text
            
        except Exception as e:
            logger.error(f"Error fetching URL {url}: {e}")
            raise
    
    async def _fetch_api(self, url: str) -> str:
        """
        Fetch data from an API endpoint
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Try to parse as JSON
            try:
                data = response.json()
                return json.dumps(data, indent=2)
            except:
                return response.text
                
        except Exception as e:
            logger.error(f"Error fetching API data from {url}: {e}")
            raise
    
    def parse_csv_data(self, csv_content: str) -> pd.DataFrame:
        """
        Parse CSV content into a DataFrame
        """
        try:
            return pd.read_csv(io.StringIO(csv_content))
        except Exception as e:
            logger.error(f"Error parsing CSV: {e}")
            raise
    
    def parse_json_data(self, json_content: str) -> Any:
        """
        Parse JSON content
        """
        try:
            return json.loads(json_content)
        except Exception as e:
            logger.error(f"Error parsing JSON: {e}")
            raise
    
    def image_to_base64(self, image_path: str) -> str:
        """
        Convert an image file to base64 data URI
        """
        try:
            with open(image_path, 'rb') as image_file:
                image_data = image_file.read()
                base64_data = base64.b64encode(image_data).decode('utf-8')
                
                # Determine image type
                suffix = Path(image_path).suffix.lower()
                mime_types = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml'
                }
                mime_type = mime_types.get(suffix, 'image/png')
                
                return f"data:{mime_type};base64,{base64_data}"
                
        except Exception as e:
            logger.error(f"Error converting image to base64: {e}")
            raise
    
    def execute_visualization_code(self, code: str, data: Any) -> str:
        """
        Execute visualization code and return base64 image
        """
        try:
            # Create a namespace for code execution
            namespace = {
                'data': data,
                'pd': pd,
                '__builtins__': __builtins__
            }
            
            # Execute the code
            exec(code, namespace)
            
            # Check if output.png was created
            output_path = Path('output.png')
            if output_path.exists():
                base64_image = self.image_to_base64(str(output_path))
                output_path.unlink()  # Clean up
                return base64_image
            else:
                raise Exception("Visualization code did not create output.png")
                
        except Exception as e:
            logger.error(f"Error executing visualization code: {e}")
            raise
    
    async def _fetch_auto_detect(self, url: str) -> str:
        """
        Auto-detect file type and fetch accordingly
        """
        try:
            response = self.session.head(url, timeout=10, allow_redirects=True)
            content_type = response.headers.get('content-type', '').lower()
            
            if 'pdf' in content_type:
                return await self._fetch_pdf(url)
            elif any(img_type in content_type for img_type in ['image', 'png', 'jpeg', 'jpg', 'gif']):
                return await self._fetch_image(url)
            elif any(aud_type in content_type for aud_type in ['audio', 'mpeg', 'wav', 'mp3']):
                return await self._fetch_audio(url)
            elif any(vid_type in content_type for vid_type in ['video', 'mp4', 'avi', 'mov']):
                return await self._fetch_video(url)
            else:
                return await self._fetch_url(url)
                
        except Exception as e:
            logger.warning(f"Auto-detect failed, trying as URL: {e}")
            return await self._fetch_url(url)
    
    async def _fetch_image(self, url: str) -> str:
        """
        Fetch and analyze an image, returning base64 and metadata
        """
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Save temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.img') as tmp_file:
                tmp_file.write(response.content)
                tmp_path = tmp_file.name
            
            try:
                # Open with PIL to get metadata
                img = Image.open(tmp_path)
                
                # Get image information
                img_info = {
                    "format": img.format,
                    "mode": img.mode,
                    "size": img.size,
                    "width": img.width,
                    "height": img.height,
                }
                
                # Convert to base64
                buffered = io.BytesIO()
                img.save(buffered, format=img.format or 'PNG')
                img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                
                # Determine MIME type
                mime_type = f"image/{(img.format or 'png').lower()}"
                if mime_type == "image/jpeg":
                    mime_type = "image/jpeg"
                
                result = {
                    "type": "image",
                    "metadata": img_info,
                    "base64": f"data:{mime_type};base64,{img_base64}",
                    "description": f"Image: {img.width}x{img.height} {img.format}"
                }
                
                logger.info(f"Fetched image: {img.format} {img.size}")
                return json.dumps(result, indent=2)
                
            finally:
                # Clean up temp file
                os.unlink(tmp_path)
                
        except Exception as e:
            logger.error(f"Error fetching image from {url}: {e}")
            raise
    
    async def _fetch_audio(self, url: str) -> str:
        """
        Fetch audio file and return metadata
        """
        try:
            response = self.session.get(url, timeout=60)
            response.raise_for_status()
            
            # Save temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.audio') as tmp_file:
                tmp_file.write(response.content)
                tmp_path = tmp_file.name
            
            try:
                # Detect file type
                kind = filetype.guess(tmp_path)
                file_extension = kind.extension if kind else 'unknown'
                
                # Get basic metadata
                file_size = os.path.getsize(tmp_path)
                
                # Try to get audio metadata using pydub
                try:
                    from pydub import AudioSegment
                    audio = AudioSegment.from_file(tmp_path)
                    
                    audio_info = {
                        "duration_seconds": len(audio) / 1000.0,
                        "channels": audio.channels,
                        "frame_rate": audio.frame_rate,
                        "sample_width": audio.sample_width,
                        "frame_width": audio.frame_width,
                    }
                except Exception as audio_err:
                    logger.warning(f"Could not parse audio metadata: {audio_err}")
                    audio_info = {"error": "Could not parse audio metadata"}
                
                # Convert to base64 for potential transcription
                with open(tmp_path, 'rb') as f:
                    audio_base64 = base64.b64encode(f.read()).decode('utf-8')
                
                result = {
                    "type": "audio",
                    "file_type": file_extension,
                    "file_size_bytes": file_size,
                    "metadata": audio_info,
                    "base64": audio_base64,
                    "description": f"Audio file: {file_extension}, {file_size / 1024:.1f}KB"
                }
                
                logger.info(f"Fetched audio: {file_extension}, {file_size / 1024:.1f}KB")
                return json.dumps(result, indent=2)
                
            finally:
                # Clean up temp file
                os.unlink(tmp_path)
                
        except Exception as e:
            logger.error(f"Error fetching audio from {url}: {e}")
            raise
    
    async def _fetch_video(self, url: str) -> str:
        """
        Fetch video file and return metadata
        """
        try:
            response = self.session.get(url, timeout=120, stream=True)
            response.raise_for_status()
            
            # Save temporarily (streaming to handle large files)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.video') as tmp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    tmp_file.write(chunk)
                tmp_path = tmp_file.name
            
            try:
                # Detect file type
                kind = filetype.guess(tmp_path)
                file_extension = kind.extension if kind else 'unknown'
                
                # Get basic metadata
                file_size = os.path.getsize(tmp_path)
                
                # Try to get video metadata using moviepy
                try:
                    from moviepy.editor import VideoFileClip
                    video = VideoFileClip(tmp_path)
                    
                    video_info = {
                        "duration_seconds": video.duration,
                        "fps": video.fps,
                        "size": list(video.size),
                        "width": video.w,
                        "height": video.h,
                    }
                    
                    # Extract first frame as thumbnail
                    first_frame = video.get_frame(0)
                    img = Image.fromarray(first_frame)
                    buffered = io.BytesIO()
                    img.save(buffered, format='PNG')
                    thumbnail_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
                    
                    video.close()
                    
                except Exception as video_err:
                    logger.warning(f"Could not parse video metadata: {video_err}")
                    video_info = {"error": "Could not parse video metadata"}
                    thumbnail_base64 = None
                
                result = {
                    "type": "video",
                    "file_type": file_extension,
                    "file_size_bytes": file_size,
                    "metadata": video_info,
                    "thumbnail_base64": f"data:image/png;base64,{thumbnail_base64}" if thumbnail_base64 else None,
                    "description": f"Video file: {file_extension}, {file_size / (1024*1024):.1f}MB"
                }
                
                logger.info(f"Fetched video: {file_extension}, {file_size / (1024*1024):.1f}MB")
                return json.dumps(result, indent=2)
                
            finally:
                # Clean up temp file
                os.unlink(tmp_path)
                
        except Exception as e:
            logger.error(f"Error fetching video from {url}: {e}")
            raise