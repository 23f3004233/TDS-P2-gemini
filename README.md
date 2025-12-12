# TDS LLM Quiz Solver

Automated quiz solver using Claude Sonnet 4.5 via Puter.js for the TDS LLM Analysis Project.

## Features

- ✅ Automatic quiz solving with Claude Sonnet 4.5
- ✅ Handles multiple quiz types (25+ types)
- ✅ Supports various file formats (CSV, Excel, PDF, Images, Audio, Video)
- ✅ Browser automation with Puppeteer
- ✅ Free unlimited LLM access via Puter.js
- ✅ Automatic retry logic
- ✅ Chain quiz handling

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tds-llm-quiz-solver
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set your values:
```env
SECRET=your-secret-from-google-form
EMAIL=your-email@iitm.ac.in
PORT=3000
```

## Local Development

1. Start the server:
```bash
npm start
```

2. Test with Thunder Client or curl:
```bash
curl -X POST http://localhost:3000/solve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@iitm.ac.in",
    "secret": "your-secret",
    "url": "https://tds-llm-analysis.s-anand.net/demo"
  }'
```

## Deployment to Railway

1. Create a new project on Railway

2. Connect your GitHub repository

3. Add environment variables in Railway dashboard:
   - `SECRET`: Your secret from the Google Form
   - `EMAIL`: Your email
   - `NODE_ENV`: production

4. Railway will automatically:
   - Detect Node.js
   - Run `npm install`
   - Start with `npm start`

5. Get your deployment URL from Railway (e.g., `https://your-app.railway.app`)

6. Update your Google Form with:
   - API Endpoint: `https://your-app.railway.app/solve`
   - GitHub Repo: Your repository URL

## Testing

Test your endpoint before submission:

```bash
curl -X POST https://your-app.railway.app/solve \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@iitm.ac.in",
    "secret": "your-secret",
    "url": "https://tds-llm-analysis.s-anand.net/demo"
  }'
```

## Project Structure

```
project/
├── server.js                 # Express server
├── quiz-solver.js           # Main quiz solving logic
├── browser-handler.js       # Puppeteer automation
├── llm-client.js           # Puter.js Claude integration
├── processors/
│   ├── csv-processor.js    # CSV/Excel processing
│   ├── pdf-processor.js    # PDF processing
│   ├── image-processor.js  # Image processing
│   ├── audio-processor.js  # Audio processing
│   └── video-processor.js  # Video processing
├── utils/
│   ├── file-downloader.js  # File download utilities
│   ├── data-transformer.js # Data transformation
│   └── validator.js        # Request validation
├── package.json
├── .env
└── README.md
```

## Supported Quiz Types

The system handles all 25+ quiz types including:
- Entry point validation
- File downloads (CSV, Excel, PDF, Images)
- Data analysis and aggregation
- Web scraping and DOM manipulation
- Custom headers and API calls
- Audio/video processing
- Chart generation
- Machine learning tasks
- RAG and embedding tasks

## How It Works

1. **Receive POST request** with email, secret, and quiz URL
2. **Validate** secret against environment variable
3. **Visit quiz page** using Puppeteer (headless browser)
4. **Extract** question, content, and file links
5. **Download and process** any files (CSV, PDF, images, etc.)
6. **Analyze** using Claude Sonnet 4.5 via Puter.js
7. **Generate answer** based on analysis
8. **Submit answer** to the specified endpoint
9. **Handle response** and move to next quiz if available
10. **Repeat** until quiz chain completes or timeout

## Time Management

- 3-minute window from initial POST
- Automatic timeout tracking
- Quick fail-fast on errors
- Optimized LLM prompts

## Troubleshooting

### Puppeteer Issues on Railway
If Puppeteer fails to launch, Railway automatically handles Chrome dependencies. The configuration in `browser-handler.js` includes all necessary flags.

### LLM Timeout
If Claude takes too long, the system will retry up to 3 times with exponential backoff.

### File Processing Errors
The system includes fallback mechanisms for each file type. Check logs for specific errors.

### Secret Validation Fails
Ensure your `.env` file has the correct secret matching your Google Form submission.

## Logs

All operations are logged with timestamps:
- `[MASTER]` - Quiz chain orchestration
- `[SOLVER]` - Individual quiz solving
- `[BROWSER]` - Puppeteer operations
- `[LLM]` - Claude API calls
- `[CSV/PDF/IMAGE/etc]` - File processing
- `[DOWNLOAD]` - File downloads
- `[SUBMIT]` - Answer submissions

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET` | Yes | - | Your secret from Google Form |
| `EMAIL` | No | - | Your email (optional) |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment |

## License

MIT

## Support

For issues or questions, check the logs first. Most errors are logged with descriptive messages.

---

**Author**: Devodita Chakravarty