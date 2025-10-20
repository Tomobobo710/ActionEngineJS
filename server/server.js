const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config();

const blockRoutes = require('./routes/blocks');

const app = express();
const PORT = process.env.PORT || 4444;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for WebGL
    crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS middleware
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../'), {
    maxAge: NODE_ENV === 'production' ? '1d' : 0
}));

// API Routes
app.use('/api/blocks', blockRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Memory Palace API is running',
        environment: NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Memory Palace 3D API',
        version: '1.0.0',
        endpoints: {
            blocks: {
                'GET /api/blocks': 'Get all blocks',
                'GET /api/blocks/:id': 'Get single block',
                'POST /api/blocks': 'Create new block',
                'PUT /api/blocks/:id': 'Update block',
                'DELETE /api/blocks/:id': 'Delete block',
                'POST /api/blocks/bulk': 'Bulk save blocks',
                'GET /api/blocks/stats': 'Get statistics'
            },
            camera: {
                'GET /api/blocks/camera/state': 'Get camera state',
                'PUT /api/blocks/camera/state': 'Save camera state'
            }
        }
    });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        error: NODE_ENV === 'development' ? err.message : 'Internal server error',
        stack: NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🏛️  Memory Palace 3D Server                                 ║
║                                                                ║
║   🌐 Server: http://localhost:${PORT.toString().padEnd(4)}     ║
║   📡 API: http://localhost:${PORT}/api                         ║
║   📚 Docs: http://localhost:${PORT}/api                        ║
║                                                                 ║
║   Environment: ${NODE_ENV.padEnd(11)}                           ║
║   Status: ✅ Running                                           ║
╚════════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

module.exports = app;