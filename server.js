const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Sentry = process.env.SENTRY_DSN ? require('@sentry/node') : null;

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Sentry error tracking
if(Sentry){
  Sentry.init({ 
    dsn: process.env.SENTRY_DSN,
    environment: NODE_ENV,
    tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 1.0
  });
  app.use(Sentry.Handlers.requestHandler());
}

// Security middleware: Helmet for HTTP headers (CSP, HSTS, X-Frame-Options, etc)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // inline for Vite HMR in dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'no-referrer' },
  noSniff: true,
  xssFilter: true
}));

// Rate limiting: 120 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: 'Too many requests from this IP',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,  // Disable `X-RateLimit-*` headers
  skip: (req) => req.path === '/health' // Don't rate limit health checks
});
app.use(limiter);

// Parse JSON with size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));

// Health endpoint for monitoring and readiness checks
app.get('/health', (req, res) => {
  res.json({ 
    ok: true,
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
});

// Metrics endpoint for Prometheus monitoring
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}

# HELP nodejs_version NodeJS version
# TYPE nodejs_version gauge
nodejs_version{version="${process.version}"} 1
`);
});

// Orchestrator status endpoint (returns JSON)
app.get('/api/orchestrator/status', (req, res) => {
  try {
    const supervisor = require('./agents/supervisor');
    if (supervisor && typeof supervisor.getStatus === 'function') {
      const st = supervisor.getStatus();
      return res.json({ status: 'running', ...st });
    }
    // fallback if module doesn't expose getStatus yet
    return res.json({ status: 'running', agents: [], recentActions: supervisor && supervisor.actionLog ? supervisor.actionLog.slice(-20) : [] });
  } catch (e) {
    return res.status(503).json({ status: 'unavailable', error: e.message });
  }
});

// Serve static files with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: NODE_ENV === 'production' ? '1d' : '0',
  etag: false
}));

// API route: return app version
app.get('/api/version', (req, res) => {
  res.json({ 
    version: process.env.APP_VERSION || '0.1.0',
    environment: NODE_ENV 
  });
});

// 404 fallback to index.html for SPA client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start agent supervisor
try {
  const supervisor = require('./agents/supervisor');
  supervisor.start(app);
  console.log('✓ Agent supervisor started');
} catch(e) { 
  console.error('⚠ Failed to start supervisor:', e.message);
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`✓ Server listening on port ${PORT} [${NODE_ENV}]`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Sentry error handler (must be last)
if(Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}
