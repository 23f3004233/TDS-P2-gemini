# LLM Analysis Quiz Solver

A robust, production-ready application that autonomously solves data analysis quizzes using LLMs and headless browser automation.

## 🏗️ Architecture

This application implements a sophisticated pipeline that:

1. **Receives quiz tasks** via a FastAPI endpoint
2. **Renders JavaScript-driven quiz pages** using Playwright headless browser
3. **Analyzes tasks** using Gemini 2.0 Flash Exp LLM
4. **Sources and processes data** from various formats (PDFs, APIs, websites)
5. **Solves complex data analysis problems** including visualization
6. **Submits answers** and iterates through quiz chains within a 3-minute time limit

## 🎯 Key Features

- **Asynchronous Processing**: Background task execution ensures immediate HTTP 200 response
- **Intelligent Task Analysis**: LLM-powered task decomposition and solution planning
- **Comprehensive Media Support**: 
  - 📄 **PDFs** - Text extraction from all pages
  - 🖼️ **Images** - Vision analysis with Gemini (OCR, object detection)
  - 🎵 **Audio** - Metadata extraction (duration, format, channels)
  - 🎬 **Video** - Metadata and first-frame analysis
  - 📊 **CSV/Excel** - Data parsing and analysis
  - 📋 **JSON** - Structured data extraction
  - 📝 **Text files** - Content analysis
  - 🌐 **HTML** - Web scraping with JavaScript rendering
  - 🔌 **APIs** - REST endpoint integration
- **Visualization Support**: Automatic chart generation with matplotlib/seaborn
- **Retry Logic**: Smart re-submission with error analysis
- **Time Management**: 3-minute deadline enforcement
- **Production-Ready**: Comprehensive error handling and logging

## 📋 Prerequisites

- Python 3.11+
- Railway account (for deployment)
- Gemini API key
- Git & GitHub account

## 🚀 Setup Instructions

### 1. Clone and Setup Repository

```bash
# Clone your repository
git clone <your-repo-url>
cd <your-repo-name>

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
SECRET_STRING=your_unique_secret_string
GEMINI_API_KEY=your_gemini_api_key
EMAIL=your_email@example.com
```

**Important**: Never commit the `.env` file to Git. It's already in `.gitignore`.

### 3. Local Testing

```bash
# Run the server locally
uvicorn main:app --reload --port 8000

# Test with ThunderClient or curl
curl -X POST http://localhost:8000/quiz \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_email@example.com",
    "secret": "your_secret",
    "url": "https://tds-llm-analysis.s-anand.net/demo"
  }'
```

### 4. Railway Deployment

#### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial commit: LLM Quiz Solver"
git push origin main
```

#### Step 2: Deploy to Railway

1. Go to [Railway](https://railway.app/)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect the Dockerfile

#### Step 3: Configure Environment Variables

In Railway dashboard:
1. Go to your project → Variables
2. Add three variables:
   - `SECRET_STRING`: Your secret string
   - `GEMINI_API_KEY`: Your Gemini API key
   - `EMAIL`: Your email address

#### Step 4: Get Your Public URL

1. Go to Settings → Networking
2. Click "Generate Domain"
3. Copy your HTTPS URL (e.g., `https://your-app.railway.app`)

### 5. Submit to Google Form

Fill out the Google Form with:
- Your email address
- Your secret string
- Your Railway HTTPS endpoint URL + `/quiz` (e.g., `https://your-app.railway.app/quiz`)
- Your GitHub repository URL

## 🧪 Testing

### Local Testing with Demo Endpoint

```json
{
  "email": "your_email@example.com",
  "secret": "your_secret",
  "url": "https://tds-llm-analysis.s-anand.net/demo"
}
```

### Test Invalid Secret (should return 403)

```json
{
  "email": "your_email@example.com",
  "secret": "wrong_secret",
  "url": "https://example.com/quiz"
}
```

### Test Invalid JSON (should return 400)

```
invalid json content
```

## 📁 Project Structure

```
.
├── main.py                 # FastAPI application & orchestration
├── gemini_wrapper.py       # Gemini API integration
├── browser_handler.py      # Playwright headless browser
├── data_processor.py       # Data sourcing & processing
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container configuration
├── railway.json           # Railway deployment config
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🔧 Technical Implementation

### Core Components

#### 1. **GeminiWrapper** (`gemini_wrapper.py`)
- Task analysis and decomposition
- Data processing and solution generation
- Answer format parsing
- Visualization code generation

#### 2. **BrowserHandler** (`browser_handler.py`)
- Playwright-based headless browser
- JavaScript rendering
- DOM extraction
- File downloads

#### 3. **DataProcessor** (`data_processor.py`)
- PDF text extraction
- API data fetching
- CSV/JSON parsing
- Image base64 encoding
- Visualization execution

#### 4. **QuizSolver** (`main.py`)
- Main orchestration logic
- Quiz chain navigation
- Time management (3-minute limit)
- Retry logic with error analysis

### Data Flow

```
POST /quiz → Secret Verification → HTTP 200 Response
                                          ↓
                            Background Task Starts
                                          ↓
                              Fetch Quiz Page (Playwright)
                                          ↓
                             Analyze Task (Gemini)
                                          ↓
                           Fetch Additional Data (if needed)
                                          ↓
                            Solve Task (Gemini)
                                          ↓
                           Submit Answer (HTTP POST)
                                          ↓
                    Correct? → Yes → Next URL? → Continue Loop
                       ↓ No
                    Retry with Error Analysis (max 3 attempts)
```

## 🎓 Design Choices & Rationale

### 1. **FastAPI with Background Tasks**
- **Why**: Immediate HTTP 200 response required while processing continues
- **Benefit**: Non-blocking, handles 3-minute deadline without client timeout

### 2. **Playwright over Selenium**
- **Why**: Modern API, better async support, easier Docker deployment
- **Benefit**: More reliable JavaScript rendering, built-in wait mechanisms

### 3. **Gemini 2.0 Flash Exp**
- **Why**: Fast inference, good balance of speed and accuracy
- **Benefit**: Fits within the 3-minute time constraint

### 4. **Modular Architecture**
- **Why**: Separation of concerns (browser, LLM, data processing)
- **Benefit**: Easier testing, debugging, and maintenance

### 5. **No Hardcoded URLs**
- **Why**: Requirement specification
- **Benefit**: Dynamic submission URL extraction from quiz content

### 6. **Comprehensive Error Handling**
- **Why**: Real-world reliability
- **Benefit**: Graceful degradation, informative logging

## 🐛 Troubleshooting

### Playwright Issues
```bash
# If browser installation fails
playwright install --with-deps chromium
```

### Railway Deployment Issues
- Ensure Dockerfile is in root directory
- Check Railway logs: Project → Deployments → View Logs
- Verify environment variables are set

### API Response Issues
- Check logs for detailed error messages
- Verify Gemini API key is valid and has quota
- Ensure quiz URL is accessible

## 📊 Expected Performance

- **Response Time**: < 100ms for initial HTTP 200
- **Quiz Solve Time**: 10-60 seconds per quiz (depending on complexity)
- **Success Rate**: High (with retry logic)
- **Time Compliance**: Always within 3-minute window

## 🔒 Security Considerations

- Environment variables for sensitive data
- Secret verification on every request
- No exposed API keys in code
- HTTPS-only deployment

## 📝 License

MIT License - See LICENSE file for details

## 👤 Author

Devodita Chakravarty, 
23f3004233@ds.study.iitm.ac.in

---
