const express = require('express');
const path = require('path');
const Sentry = process.env.SENTRY_DSN ? require('@sentry/node') : null

const app = express();
const PORT = process.env.PORT || 3000;

if(Sentry){
  Sentry.init({ dsn: process.env.SENTRY_DSN })
  app.use(Sentry.Handlers.requestHandler())
}

// basic health endpoint for monitoring and readiness checks
app.get('/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// start agent supervisor when server starts
try{
  const supervisor = require('./agents/supervisor')
  supervisor.start()
} catch(e){ console.error('Failed to start supervisor:', e.message) }

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

if(Sentry){
  app.use(Sentry.Handlers.errorHandler())
}
