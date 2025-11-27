"""
Configuration file for the LLM Analysis Quiz Solver
Centralizes all configurable parameters for easy tuning
"""

import os
from typing import Dict, Any

class Config:
    """Application configuration"""
    
    # Environment variables
    SECRET_STRING = os.getenv("SECRET_STRING")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    EMAIL = os.getenv("EMAIL")
    
    # Time limits
    QUIZ_TIME_LIMIT_MINUTES = 3
    QUIZ_TIME_LIMIT_SECONDS = 180
    
    # Retry configuration
    MAX_ATTEMPTS_PER_QUIZ = 3
    RETRY_DELAY_SECONDS = 1
    
    # Timeout configuration
    BROWSER_TIMEOUT_MS = 30000
    HTTP_TIMEOUT_SECONDS = 30
    BROWSER_WAIT_AFTER_LOAD_MS = 2000
    
    # Gemini configuration
    GEMINI_MODEL = "gemini-2.0-flash-exp"
    GEMINI_MAX_TOKENS = 8192
    GEMINI_TEMPERATURE = 0.1  # Lower temperature for more deterministic outputs
    
    # File handling
    TEMP_DOWNLOAD_DIR = "downloads"
    MAX_FILE_SIZE_MB = 10
    
    # Logging configuration
    LOG_LEVEL = "INFO"
    LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    # Data processing limits
    MAX_PDF_PAGES = 50
    MAX_TEXT_LENGTH = 100000  # characters
    
    @classmethod
    def validate(cls) -> bool:
        """Validate that all required configuration is present"""
        required_vars = ["SECRET_STRING", "GEMINI_API_KEY", "EMAIL"]
        missing = [var for var in required_vars if not getattr(cls, var)]
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        return True
    
    @classmethod
    def get_gemini_config(cls) -> Dict[str, Any]:
        """Get Gemini API configuration"""
        return {
            "model": cls.GEMINI_MODEL,
            "temperature": cls.GEMINI_TEMPERATURE,
        }
    
    @classmethod
    def get_browser_config(cls) -> Dict[str, Any]:
        """Get browser configuration"""
        return {
            "timeout": cls.BROWSER_TIMEOUT_MS,
            "wait_after_load": cls.BROWSER_WAIT_AFTER_LOAD_MS,
        }
    
    @classmethod
    def get_retry_config(cls) -> Dict[str, int]:
        """Get retry configuration"""
        return {
            "max_attempts": cls.MAX_ATTEMPTS_PER_QUIZ,
            "delay": cls.RETRY_DELAY_SECONDS,
        }