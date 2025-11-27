import google.generativeai as genai
import os
import json
import logging
import base64
from typing import Optional, Dict, Any
from PIL import Image
import io

logger = logging.getLogger(__name__)

class GeminiWrapper:
    """Wrapper class for Gemini API interactions"""
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        self.vision_model = genai.GenerativeModel('gemini-2.0-flash-exp')  # Same model has vision
        
    def analyze_task(self, quiz_content: str) -> Dict[str, Any]:
        """
        Analyze the quiz task to determine data source type, analysis steps, and answer format
        """
        prompt = f"""You are analyzing a quiz task. The quiz content is:

{quiz_content}

Analyze this quiz and respond ONLY with a valid JSON object (no markdown, no explanation) with this exact structure:
{{
    "data_source_type": "one of: url, pdf_link, image, audio, video, api_endpoint, embedded_data, csv, json, txt, none",
    "data_source_url": "the actual URL/link if present, otherwise null",
    "analysis_steps": ["list of steps needed like scraping, data_processing, math, visualization, image_analysis, audio_analysis, video_analysis"],
    "expected_answer_format": "one of: number, string, boolean, base64_image, json_object",
    "task_description": "brief description of what needs to be done",
    "submit_url": "the submission URL found in the content"
}}

Extract the submit URL carefully - it's typically mentioned in the instructions."""

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if result_text.startswith('```'):
                result_text = result_text.split('```')[1]
                if result_text.startswith('json'):
                    result_text = result_text[4:]
                result_text = result_text.strip()
            
            result = json.loads(result_text)
            logger.info(f"Task analysis result: {result}")
            return result
        except Exception as e:
            logger.error(f"Error analyzing task: {e}")
            raise
    
    def process_data_and_solve(self, task_description: str, data: str, previous_attempt: Optional[Dict] = None) -> Any:
        """
        Process the data and solve the task using LLM
        """
        if previous_attempt:
            prompt = f"""Previous attempt was INCORRECT. 
Task: {task_description}
Data: {data}
Previous answer: {previous_attempt.get('answer')}
Reason for failure: {previous_attempt.get('reason')}

Carefully re-analyze and provide the CORRECT answer. Return ONLY the answer value, nothing else.
If it's a number, return just the number. If it's a string, return just the string.
If it's a boolean, return true or false. If it's a JSON object, return valid JSON."""
        else:
            prompt = f"""Task: {task_description}
Data: {data}

Solve this task step by step. Return ONLY the final answer in the exact format requested.
If it's a number, return just the number. If it's a string, return just the string.
If it's a boolean, return true or false. If it's JSON, return valid JSON.
No explanation, no markdown, just the raw answer."""

        try:
            response = self.model.generate_content(prompt)
            answer = response.text.strip()
            
            # Remove markdown formatting if present
            if answer.startswith('```'):
                answer = answer.split('```')[1]
                if answer.startswith('json'):
                    answer = answer[4:]
                answer = answer.strip()
            
            logger.info(f"Generated answer: {answer}")
            return answer
        except Exception as e:
            logger.error(f"Error processing data: {e}")
            raise
    
    def parse_answer(self, raw_answer: str, expected_format: str) -> Any:
        """
        Parse the raw answer into the expected format
        """
        try:
            if expected_format == "number":
                # Try to extract number from string
                import re
                numbers = re.findall(r'-?\d+\.?\d*', raw_answer)
                if numbers:
                    num_str = numbers[0]
                    return int(num_str) if '.' not in num_str else float(num_str)
                return int(raw_answer)
            elif expected_format == "boolean":
                return raw_answer.lower() in ['true', 'yes', '1']
            elif expected_format == "json_object":
                return json.loads(raw_answer)
            else:
                return raw_answer
        except Exception as e:
            logger.error(f"Error parsing answer: {e}")
            return raw_answer
    
    def generate_visualization_code(self, task_description: str, data: str) -> str:
        """
        Generate Python code for visualization tasks
        """
        prompt = f"""Generate Python code to create a visualization for this task:
Task: {task_description}
Data: {data}

Requirements:
1. Use matplotlib or seaborn
2. Save the plot as a PNG image to 'output.png'
3. Return complete, executable Python code
4. Include all necessary imports
5. Code should be production-ready with no placeholders

Return ONLY the Python code, no explanation."""

        try:
            response = self.model.generate_content(prompt)
            code = response.text.strip()
            
            # Remove markdown code blocks if present
            if code.startswith('```'):
                code = code.split('```')[1]
                if code.startswith('python'):
                    code = code[6:]
                code = code.strip()
            
            return code
        except Exception as e:
            logger.error(f"Error generating visualization code: {e}")
            raise
    
    def analyze_image(self, image_data: str, question: str) -> str:
        """
        Analyze an image using Gemini's vision capabilities
        image_data can be base64 string or path
        """
        try:
            # Check if it's a base64 data URI
            if image_data.startswith('data:image'):
                # Extract base64 part
                base64_str = image_data.split(',')[1]
                image_bytes = base64.b64decode(base64_str)
                img = Image.open(io.BytesIO(image_bytes))
            else:
                # Assume it's a file path or URL
                img = Image.open(image_data)
            
            prompt = f"""Analyze this image and answer the following question:
{question}

Provide a detailed, accurate answer based on what you see in the image."""
            
            response = self.vision_model.generate_content([prompt, img])
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            raise
    
    def process_multimodal_data(self, task_description: str, data: Dict[str, Any]) -> Any:
        """
        Process data that may include multiple formats (text, image, audio metadata, etc.)
        """
        try:
            # Parse the data to check what types we have
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except:
                    # It's just text
                    return self.process_data_and_solve(task_description, data)
            
            # Check if we have image data
            if isinstance(data, dict) and data.get('type') == 'image':
                image_base64 = data.get('base64')
                return self.analyze_image(image_base64, task_description)
            
            # For audio/video, we work with metadata
            elif isinstance(data, dict) and data.get('type') in ['audio', 'video']:
                # Convert structured data back to string for processing
                data_str = json.dumps(data, indent=2)
                return self.process_data_and_solve(task_description, data_str)
            
            # Default: treat as regular data
            else:
                data_str = json.dumps(data, indent=2) if isinstance(data, dict) else str(data)
                return self.process_data_and_solve(task_description, data_str)
                
        except Exception as e:
            logger.error(f"Error processing multimodal data: {e}")
            raise