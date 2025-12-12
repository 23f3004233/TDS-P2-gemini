const express = require('express');
const cors = require('cors');
const { solveMasterQuiz } = require('./quiz-solver');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'running',
        timestamp: new Date().toISOString(),
        message: 'Quiz Solver API is active'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Main quiz endpoint
app.post('/solve', async (req, res) => {
    const startTime = Date.now();
    console.log('\n=== NEW QUIZ REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
        // Validate request body
        if (!req.body || typeof req.body !== 'object') {
            console.error('Invalid JSON payload');
            return res.status(400).json({ 
                error: 'Invalid JSON payload',
                timestamp: new Date().toISOString()
            });
        }

        const { email, secret, url } = req.body;

        // Validate required fields
        if (!email || !secret || !url) {
            console.error('Missing required fields:', { email: !!email, secret: !!secret, url: !!url });
            return res.status(400).json({ 
                error: 'Missing required fields: email, secret, and url are required',
                timestamp: new Date().toISOString()
            });
        }

        // Validate secret
        const expectedSecret = process.env.SECRET || 'your-secret-here';
        if (secret !== expectedSecret) {
            console.error('Invalid secret provided');
            return res.status(403).json({ 
                error: 'Invalid secret',
                timestamp: new Date().toISOString()
            });
        }

        console.log('Secret validated successfully');
        console.log('Starting quiz solving process...');

        // Send immediate 200 response
        res.status(200).json({ 
            status: 'processing',
            message: 'Quiz solving initiated',
            timestamp: new Date().toISOString()
        });

        // Start solving asynchronously
        solveMasterQuiz(email, secret, url, startTime).catch(error => {
            console.error('Error in quiz solving process:', error);
        });

    } catch (error) {
        console.error('Server error:', error);
        const statusCode = res.headersSent ? 500 : 500;
        if (!res.headersSent) {
            res.status(statusCode).json({ 
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
        res.status(500).json({ 
            error: 'Internal server error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Secret configured: ${!!process.env.SECRET}`);
    console.log(`=================================\n`);
});