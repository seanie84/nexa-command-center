const fs = require('fs');
const path = require('path');

const AGENTS_FILE = path.join(__dirname, 'agents.json');
const LOG_FILE = path.join(__dirname, 'orchestrator.log');
let agents = [];
let actionLog = [];

function loadAgents() {
  try {
    agents = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
  } catch(e) {
    console.error('Failed to load agents.json:', e.message);
    agents = [];
  }
}

function logAction(action, agent, status, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    agentId: agent?.id,
    status,
    details
  };
  actionLog.push(entry);
  
  // Keep last 100 actions in memory, write to disk
  if(actionLog.length > 100) {
    actionLog = actionLog.slice(-100);
  }
  
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch(e) {
    console.error('Failed to write action log:', e.message);
  }
}

async function checkHealth(agent) {
  try {
    const baseUrl = process.env.ROOT_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = agent.endpoint ? `${baseUrl}${agent.endpoint}` : baseUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'Orchestrator/1.0' }
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      return { ok: true, status: res.status, timestamp: Date.now() };
    }
    return { ok: false, status: res.status, timestamp: Date.now() };
  } catch(e) {
    return { 
      ok: false, 
      error: e.message, 
      timestamp: Date.now() 
    };
  }
}

// Safe repair actions with audit trail
const safeActions = {
  // Restart the service (not implemented in Node, but logged for audit)
  async restartService() {
    console.log('[orchestrator] Restart service action (would trigger via Render API or K8s)');
    logAction('RESTART_SERVICE', null, 'logged', 'Service restart queued for infrastructure');
    return { success: true, message: 'Restart queued' };
  },
  
  // Escalate issue to dashboard for human review
  async escalateToAdmin(agent, issue) {
    console.log(`[orchestrator] Escalating ${agent.id} issue to admin: ${issue}`);
    logAction('ESCALATE_TO_ADMIN', agent, 'logged', issue);
    return { success: true, message: 'Issue escalated to admin dashboard' };
  },
  
  // Log detailed diagnostic information
  async collectDiagnostics(agent) {
    const diagnostics = {
      agent: agent.id,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      recentLogs: actionLog.slice(-10)
    };
    logAction('COLLECT_DIAGNOSTICS', agent, 'success', diagnostics);
    return diagnostics;
  },
  
  // Record failure for trending analysis
  async recordFailure(agent, error) {
    logAction('RECORD_FAILURE', agent, 'logged', {
      error: error.message || error,
      errorType: agent.id,
      threshold: 3
    });
    return { success: true, message: 'Failure recorded' };
  }
};

async function runAgent(agent) {
  // Monitor type: health checks
  if(agent.type === 'monitor') {
    const result = await checkHealth(agent);
    logAction('HEALTH_CHECK', agent, result.ok ? 'success' : 'failure', result);
    
    if(!result.ok) {
      console.log(`[monitor:${agent.id}] Health check failed:`, result);
      await safeActions.recordFailure(agent, result.error || `Status ${result.status}`);
      
      // Escalate to admin after 3 failures
      const recentFailures = actionLog.filter(
        log => log.agentId === agent.id && log.status === 'failure'
      ).length;
      
      if(recentFailures >= 3) {
        await safeActions.escalateToAdmin(agent, `${agent.id} failed ${recentFailures} times`);
      }
    }
  }
  
  // Orchestrator type: meta-monitoring of all agents
  if(agent.type === 'orchestrator') {
    console.log('[orchestrator] Running system-wide health check...');
    let unhealthyCount = 0;
    
    for(const a of agents) {
      if(a.id === agent.id) continue; // skip self
      const health = await checkHealth(a);
      
      if(!health.ok) {
        unhealthyCount++;
        console.log(`[orchestrator] Agent ${a.id} unhealthy:`, health);
        await safeActions.collectDiagnostics(a);
      }
    }
    
    logAction('ORCHESTRATOR_SCAN', agent, unhealthyCount === 0 ? 'success' : 'warning', {
      totalAgents: agents.length,
      unhealthyAgents: unhealthyCount
    });
    
    if(unhealthyCount > 0) {
      console.log(`[orchestrator] ${unhealthyCount}/${agents.length} agents unhealthy`);
    }
  }
}

// HTTP API for admin dashboard
function setupMetricsEndpoint(app) {
  app.get('/api/orchestrator/status', (req, res) => {
    res.json({
      status: 'running',
      agents: agents.map(a => ({ id: a.id, type: a.type, interval: a.intervalSeconds })),
      recentActions: actionLog.slice(-20)
    });
  });
  
  app.get('/api/orchestrator/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    res.json({
      logs: actionLog.slice(-limit),
      total: actionLog.length
    });
  });
  
  app.post('/api/orchestrator/actions/:action', (req, res) => {
    // Require admin authentication in production
    if(process.env.NODE_ENV === 'production' && !req.headers['x-admin-token']) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { action } = req.params;
    console.log(`[orchestrator] Admin requested action: ${action}`);
    logAction(`ADMIN_REQUEST_${action}`, null, 'logged', req.body);
    
    res.json({ 
      success: true, 
      message: `Action ${action} queued for execution`,
      timestamp: new Date().toISOString()
    });
  });
}

function start(app) {
  loadAgents();
  
  // Setup API endpoints if app provided
  if(app) {
    setupMetricsEndpoint(app);
  }
  
  // Start monitoring intervals
  agents.forEach(a => {
    const intervalMs = (a.intervalSeconds || 60) * 1000;
    setInterval(() => runAgent(a), intervalMs);
  });
  
  console.log(`✓ AI Orchestrator started: monitoring ${agents.length} agents`);
  console.log(`  - Endpoints: /api/orchestrator/status, /api/orchestrator/logs`);
}

function getStatus() {
  return {
    agents,
    recentActions: actionLog.slice(-20)
  };
}

module.exports = { start, actionLog, safeActions, getStatus };
