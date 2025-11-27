from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
import os
from dotenv import load_dotenv
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional
import requests
import json

from gemini_wrapper import GeminiWrapper
from browser_handler import BrowserHandler
from data_processor import DataProcessor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="LLM Analysis Quiz Solver")

# Environment variables
SECRET_STRING = os.getenv("SECRET_STRING")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
EMAIL = os.getenv("EMAIL")

if not SECRET_STRING or not GEMINI_API_KEY or not EMAIL:
    raise ValueError("Missing required environment variables: SECRET_STRING, GEMINI_API_KEY, EMAIL")

# Initialize components
gemini = GeminiWrapper(GEMINI_API_KEY)
data_processor = DataProcessor()

class QuizRequest(BaseModel):
    email: EmailStr
    secret: str
    url: str

class QuizSolver:
    """Main quiz solving orchestrator"""
    
    def __init__(self):
        self.start_time = None
        self.time_limit = timedelta(minutes=3)
    
    def is_time_remaining(self) -> bool:
        """Check if there's still time remaining"""
        if not self.start_time:
            return True
        elapsed = datetime.now() - self.start_time
        return elapsed < self.time_limit
    
    async def solve_quiz_chain(self, initial_url: str):
        """
        Solve the entire quiz chain, following URLs until completion
        """
        self.start_time = datetime.now()
        current_url = initial_url
        attempt_count = 0
        max_attempts_per_quiz = 3
        
        logger.info(f"Starting quiz chain from {initial_url}")
        
        while current_url and self.is_time_remaining():
            try:
                logger.info(f"Processing quiz URL: {current_url}")
                
                # Solve the current quiz
                result = await self.solve_single_quiz(current_url, max_attempts_per_quiz)
                
                if result.get("correct"):
                    logger.info(f"Quiz solved correctly!")
                    next_url = result.get("url")
                    
                    if next_url:
                        logger.info(f"Moving to next quiz: {next_url}")
                        current_url = next_url
                        attempt_count = 0  # Reset attempt count for new quiz
                    else:
                        logger.info("Quiz chain completed successfully!")
                        break
                else:
                    logger.warning(f"Quiz solved incorrectly: {result.get('reason')}")
                    next_url = result.get("url")
                    
                    if next_url:
                        # Skip to next quiz even if current one failed
                        logger.info(f"Skipping to next quiz: {next_url}")
                        current_url = next_url
                        attempt_count = 0
                    else:
                        # No next URL, quiz chain ends
                        logger.error("Quiz chain ended with incorrect answer and no next URL")
                        break
                        
            except Exception as e:
                logger.error(f"Error in quiz chain: {e}", exc_info=True)
                break
        
        if not self.is_time_remaining():
            logger.warning("Time limit exceeded (3 minutes)")
    
    async def solve_single_quiz(self, quiz_url: str, max_attempts: int = 3) -> dict:
        """
        Solve a single quiz with retry logic
        """
        previous_attempt = None
        
        for attempt in range(max_attempts):
            try:
                if not self.is_time_remaining():
                    logger.warning("Time limit reached, stopping attempts")
                    return {"correct": False, "reason": "Time limit exceeded"}
                
                logger.info(f"Attempt {attempt + 1}/{max_attempts} for {quiz_url}")
                
                # Step 1: Fetch the quiz page using headless browser
                async with BrowserHandler() as browser:
                    quiz_content = await browser.fetch_quiz_page(quiz_url)
                
                logger.info(f"Quiz content fetched, length: {len(quiz_content['text'])}")
                
                # Step 2: Analyze the task using Gemini
                task_analysis = gemini.analyze_task(quiz_content['result'])
                logger.info(f"Task analysis: {task_analysis}")
                
                submit_url = task_analysis.get('submit_url')
                if not submit_url:
                    logger.error("Could not extract submit URL from quiz content")
                    raise Exception("Submit URL not found")
                
                # Step 3: Fetch additional data if needed
                additional_data = ""
                if task_analysis['data_source_url']:
                    logger.info(f"Fetching additional data from: {task_analysis['data_source_url']}")
                    additional_data = await data_processor.fetch_data(
                        task_analysis['data_source_type'],
                        task_analysis['data_source_url']
                    )
                    logger.info(f"Additional data fetched, length: {len(additional_data)}")
                
                # Step 4: Combine all data
                full_data = f"{quiz_content['result']}\n\n{additional_data}".strip()
                
                # Check if we have structured data (image, audio, video)
                is_multimodal = False
                try:
                    parsed_data = json.loads(additional_data) if additional_data else {}
                    if isinstance(parsed_data, dict) and parsed_data.get('type') in ['image', 'audio', 'video']:
                        is_multimodal = True
                        full_data = parsed_data
                except:
                    pass
                
                # Step 5: Solve the task
                if "visualization" in task_analysis['analysis_steps']:
                    # Handle visualization tasks
                    viz_code = gemini.generate_visualization_code(
                        task_analysis['task_description'],
                        str(full_data)
                    )
                    answer = data_processor.execute_visualization_code(viz_code, full_data)
                elif is_multimodal:
                    # Handle multimodal data (images, audio, video)
                    raw_answer = gemini.process_multimodal_data(
                        task_analysis['task_description'],
                        full_data
                    )
                    answer = gemini.parse_answer(
                        raw_answer,
                        task_analysis['expected_answer_format']
                    )
                else:
                    # Handle regular analysis tasks
                    raw_answer = gemini.process_data_and_solve(
                        task_analysis['task_description'],
                        str(full_data),
                        previous_attempt
                    )
                    
                    # Parse the answer to the expected format
                    answer = gemini.parse_answer(
                        raw_answer,
                        task_analysis['expected_answer_format']
                    )
                
                logger.info(f"Generated answer: {answer}")
                
                # Step 6: Submit the answer
                submission_payload = {
                    "email": EMAIL,
                    "secret": SECRET_STRING,
                    "url": quiz_url,
                    "answer": answer
                }
                
                logger.info(f"Submitting answer to {submit_url}")
                response = requests.post(submit_url, json=submission_payload, timeout=30)
                response.raise_for_status()
                
                result = response.json()
                logger.info(f"Submission result: {result}")
                
                if result.get("correct"):
                    return result
                else:
                    # Store the failed attempt for retry
                    previous_attempt = {
                        "answer": answer,
                        "reason": result.get("reason", "Unknown error")
                    }
                    
                    # If there's a next URL in the response, return it even if incorrect
                    if result.get("url"):
                        return result
                    
                    # Otherwise, continue retrying
                    logger.warning(f"Attempt {attempt + 1} failed: {result.get('reason')}")
                    
            except Exception as e:
                logger.error(f"Error in attempt {attempt + 1}: {e}", exc_info=True)
                if attempt == max_attempts - 1:
                    return {"correct": False, "reason": str(e)}
        
        return {"correct": False, "reason": "Max attempts reached"}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "active",
        "service": "LLM Analysis Quiz Solver",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/quiz")
async def handle_quiz(request: QuizRequest, background_tasks: BackgroundTasks):
    """
    Main endpoint to receive quiz tasks
    """
    try:
        # Step 1: Verify secret
        if request.secret != SECRET_STRING:
            logger.warning(f"Invalid secret attempt from {request.email}")
            raise HTTPException(status_code=403, detail="Invalid secret")
        
        # Step 2: Verify email matches
        if request.email != EMAIL:
            logger.warning(f"Email mismatch: {request.email} vs {EMAIL}")
            raise HTTPException(status_code=403, detail="Email does not match")
        
        logger.info(f"Received valid quiz request for URL: {request.url}")
        
        # Step 3: Return immediate 200 OK response
        # Start quiz solving in background
        solver = QuizSolver()
        background_tasks.add_task(solver.solve_quiz_chain, request.url)
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "accepted",
                "message": "Quiz processing started",
                "url": request.url
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling quiz request: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.exception_handler(400)
async def bad_request_handler(request: Request, exc: HTTPException):
    """Handle bad request errors"""
    return JSONResponse(
        status_code=400,
        content={"error": "Invalid JSON payload"}
    )

@app.exception_handler(403)
async def forbidden_handler(request: Request, exc: HTTPException):
    """Handle forbidden errors"""
    return JSONResponse(
        status_code=403,
        content={"error": "Invalid secret or email"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)