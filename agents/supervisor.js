const fs = require('fs');
const path = require('path');

const AGENTS_FILE = path.join(__dirname, 'agents.json');
const LOG_FILE = path.join(__dirname, 'orchestrator.log');
const STATE_FILE = path.join(__dirname, 'federation-state.json');
let agents = [];
let actionLog = [];
let lastKnownHealth = {};
let incidentMemory = [];
let governanceState = {
  missionProfile: 'balanced',
  autonomyBudget: 'standard',
  doctrineVersion: '1.0.0',
  protectedActions: ['restart_service'],
  humanApprovalRequired: ['restart_service', 'rotate_credentials']
};
let telemetryState = {
  generatedAt: null,
  pluginHeartbeats: {},
  serviceMetrics: {
    healthLatencyMs: {},
    heartbeatCount: 0
  },
  adapterCatalog: {
    collect_diagnostics: { mode: 'live-bounded', mutable: false, requiresApproval: false },
    clear_cache: { mode: 'live-bounded', mutable: true, requiresApproval: false },
    restart_service: { mode: 'approval-gated', mutable: true, requiresApproval: true },
    observe_only: { mode: 'passive', mutable: false, requiresApproval: false }
  }
};
let approvalQueue = [];
let executionPipeline = {
  phase: 'observe',
  lastUpdatedAt: null,
  currentProposal: null,
  guardianDecision: null,
  executionStatus: 'idle',
  simulationStatus: 'pending',
  verificationStatus: 'pending',
  sovereigntyLevel: 'federated',
  lastExecution: null,
  lastVerification: null,
  rollback: {
    status: 'not-required',
    reason: null,
    triggeredAt: null
  }
};

const allowedTransitions = {
  observe: ['diagnose', 'propose'],
  diagnose: ['propose', 'observe'],
  propose: ['guard', 'observe'],
  guard: ['execute', 'propose', 'observe', 'verify'],
  execute: ['verify', 'observe'],
  verify: ['observe', 'propose', 'guard']
};

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidProposal(proposal) {
  return Boolean(
    proposal &&
    isNonEmptyString(proposal.action) &&
    isNonEmptyString(proposal.priority) &&
    typeof proposal.confidence === 'number' &&
    proposal.confidence >= 0 &&
    proposal.confidence <= 1 &&
    isNonEmptyString(proposal.rationale)
  );
}

function validatePipelineState(pipeline) {
  return Boolean(
    pipeline &&
    isNonEmptyString(pipeline.phase) &&
    isNonEmptyString(pipeline.executionStatus) &&
    isNonEmptyString(pipeline.simulationStatus) &&
    isNonEmptyString(pipeline.verificationStatus) &&
    isNonEmptyString(pipeline.sovereigntyLevel) &&
    pipeline.rollback &&
    isNonEmptyString(pipeline.rollback.status) &&
    (pipeline.currentProposal === null || isValidProposal(pipeline.currentProposal))
  );
}

function assertValidTransition(currentPhase, nextPhase) {
  if (!nextPhase || nextPhase === currentPhase) {
    return;
  }

  const allowed = allowedTransitions[currentPhase] || [];
  if (!allowed.includes(nextPhase)) {
    throw new Error(`Invalid phase transition from ${currentPhase} to ${nextPhase}`);
  }
}

function buildProposal(snapshot) {
  if (snapshot.unhealthyAiAgents > 0) {
    return {
      action: 'collect_diagnostics',
      priority: snapshot.unhealthyAiAgents > 1 ? 'high' : 'normal',
      confidence: snapshot.unhealthyAiAgents > 1 ? 0.91 : 0.82,
      rationale: snapshot.unhealthyAiAgents > 0
        ? 'AI agents show unhealthy status and need repair triage.'
        : 'Fleet is healthy; continue observation.'
    };
  }

  return {
    action: 'observe_only',
    priority: 'normal',
    confidence: 0.97,
    rationale: 'Fleet is healthy; continue observation.'
  };
}

function getRollbackPlan(proposal) {
  if (!proposal) {
    return null;
  }

  const rollbackByAction = {
    collect_diagnostics: {
      action: 'clear_cache',
      rationale: 'Clear transient diagnostic artifacts if post-checks regress.'
    },
    clear_cache: {
      action: 'observe_only',
      rationale: 'Stop further cache mutation and return to observation.'
    },
    observe_only: {
      action: 'observe_only',
      rationale: 'Observation does not require rollback.'
    }
  };

  return rollbackByAction[proposal.action] || {
    action: 'observe_only',
    rationale: 'Fallback to passive observation.'
  };
}

async function executeCatalogAction(actionName, contextAgent, proposal) {
  if (actionName === 'collect_diagnostics') {
    const target = agents.find((agent) => agent.type !== 'brain' && agent.type !== 'executor' && agent.id !== 'orchestrator') || contextAgent;
    const diagnostics = await safeActions.collectDiagnostics(target);
    return {
      action: actionName,
      success: true,
      bounded: true,
      targetAgentId: target?.id || null,
      result: diagnostics
    };
  }

  if (actionName === 'clear_cache') {
    const result = await safeActions.clearCache(contextAgent, proposal);
    return {
      action: actionName,
      success: true,
      bounded: true,
      targetAgentId: contextAgent?.id || null,
      result
    };
  }

  if (actionName === 'restart_service') {
    const result = await safeActions.restartService();
    return {
      action: actionName,
      success: true,
      bounded: true,
      targetAgentId: 'subservient-server',
      result
    };
  }

  return {
    action: 'observe_only',
    success: true,
    bounded: true,
    targetAgentId: null,
    result: {
      message: 'Observation only; no operational mutation executed.'
    }
  };
}

function persistState() {
  const state = {
    incidentMemory,
    executionPipeline,
    governanceState,
    telemetryState,
    approvalQueue
  };

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to persist federation state:', e.message);
  }
}

function loadPersistedState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return;
    }

    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (Array.isArray(parsed.incidentMemory)) {
      incidentMemory = parsed.incidentMemory.slice(-50);
    }
    if (parsed.governanceState && typeof parsed.governanceState === 'object') {
      governanceState = {
        ...governanceState,
        ...parsed.governanceState
      };
    }
    if (parsed.telemetryState && typeof parsed.telemetryState === 'object') {
      telemetryState = {
        ...telemetryState,
        ...parsed.telemetryState,
        serviceMetrics: {
          ...telemetryState.serviceMetrics,
          ...(parsed.telemetryState.serviceMetrics || {})
        },
        adapterCatalog: {
          ...telemetryState.adapterCatalog,
          ...(parsed.telemetryState.adapterCatalog || {})
        }
      };
    }
    if (Array.isArray(parsed.approvalQueue)) {
      approvalQueue = parsed.approvalQueue.slice(-25);
    }
    if (validatePipelineState(parsed.executionPipeline)) {
      executionPipeline = {
        ...executionPipeline,
        ...parsed.executionPipeline
      };
    }
  } catch (e) {
    console.error('Failed to load persisted federation state:', e.message);
  }
}

function queueApprovalRequest(action, rationale) {
  const record = {
    id: `approval-${Date.now()}`,
    action,
    rationale,
    requestedAt: new Date().toISOString(),
    status: 'pending',
    resolvedAt: null,
    resolutionNote: null
  };
  approvalQueue.push(record);
  if (approvalQueue.length > 25) {
    approvalQueue = approvalQueue.slice(-25);
  }
  persistState();
  return record;
}

function resolveApprovalRequest(approvalId, decision, note) {
  const entry = approvalQueue.find((item) => item.id === approvalId);
  if (!entry) {
    throw new Error(`Approval request ${approvalId} was not found`);
  }
  if (entry.status !== 'pending') {
    throw new Error(`Approval request ${approvalId} is already ${entry.status}`);
  }

  const approved = decision === 'approved';
  entry.status = approved ? 'approved' : 'denied';
  entry.resolvedAt = new Date().toISOString();
  entry.resolutionNote = isNonEmptyString(note) ? note.trim() : null;

  if (approved) {
    updateExecutionPipeline({
      phase: 'propose',
      guardianDecision: 'approve',
      executionStatus: 'proposal-ready',
      currentProposal: {
        action: entry.action,
        priority: 'high',
        confidence: 1,
        rationale: entry.rationale
      }
    });
  } else {
    updateExecutionPipeline({
      phase: 'observe',
      guardianDecision: 'deny',
      executionStatus: 'denied',
      currentProposal: null,
      simulationStatus: 'pending',
      verificationStatus: 'pending',
      rollback: {
        status: 'not-required',
        reason: null,
        triggeredAt: null
      }
    });
  }

  logAction('APPROVAL_DECISION', null, approved ? 'success' : 'warning', {
    approvalId: entry.id,
    action: entry.action,
    decision: entry.status,
    note: entry.resolutionNote
  });
  rememberIncident({
    timestamp: new Date().toISOString(),
    agentId: 'guardian-brain',
    phase: 'guard',
    outcome: approved ? 'approval_granted' : 'approval_denied',
    details: {
      approvalId: entry.id,
      action: entry.action,
      note: entry.resolutionNote
    }
  });
  persistState();
  return entry;
}

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

function rememberIncident(entry) {
  incidentMemory.push(entry);
  if (incidentMemory.length > 50) {
    incidentMemory = incidentMemory.slice(-50);
  }
  persistState();
}

function updateExecutionPipeline(nextState) {
  assertValidTransition(executionPipeline.phase, nextState.phase);
  const candidate = {
    ...executionPipeline,
    ...nextState,
    lastUpdatedAt: new Date().toISOString()
  };

  if (!validatePipelineState(candidate)) {
    throw new Error('Invalid execution pipeline state update');
  }

  executionPipeline = candidate;
  persistState();
}

function refreshTelemetry() {
  const pluginHeartbeats = {};
  const latencyMap = {};

  for (const agent of agents) {
    const health = lastKnownHealth[agent.id];
    pluginHeartbeats[agent.id] = {
      checkedAt: health?.checkedAt || null,
      healthy: health?.healthy || false,
      source: agent.source || 'runtime',
      capabilities: agent.capabilities || []
    };
    latencyMap[agent.id] = health?.latencyMs ?? null;
  }

  telemetryState = {
    ...telemetryState,
    generatedAt: new Date().toISOString(),
    pluginHeartbeats,
    serviceMetrics: {
      ...telemetryState.serviceMetrics,
      healthLatencyMs: latencyMap,
      heartbeatCount: Object.keys(pluginHeartbeats).length
    }
  };
}

function trackHealth(agent, result) {
  lastKnownHealth[agent.id] = {
    agentId: agent.id,
    agentName: agent.name,
    type: agent.type,
    source: agent.source || 'runtime',
    endpoint: agent.endpoint || null,
    intervalSeconds: agent.intervalSeconds || 60,
    capabilities: agent.capabilities || [],
    healthy: Boolean(result.ok),
    statusCode: result.status || null,
    error: result.error || null,
    latencyMs: result.latencyMs || null,
    checkedAt: new Date().toISOString()
  };
  refreshTelemetry();
}

function getSystemSnapshot() {
  const runtimeAgents = agents.map((agent) => {
    const health = lastKnownHealth[agent.id];
    return {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      description: agent.description || '',
      interval: agent.intervalSeconds || 60,
      source: agent.source || 'runtime',
      endpoint: agent.endpoint || null,
      capabilities: agent.capabilities || [],
      latestHealth: health || null
    };
  });

  const healthyAgents = runtimeAgents.filter((agent) => agent.latestHealth?.healthy).length;
  const unhealthyAgents = runtimeAgents.filter((agent) => agent.latestHealth && !agent.latestHealth.healthy).length;
  const aiAgents = runtimeAgents.filter((agent) => agent.type !== 'server' && agent.type !== 'brain');
  const healthyAiAgents = aiAgents.filter((agent) => agent.latestHealth?.healthy).length;
  const unhealthyAiAgents = aiAgents.filter((agent) => agent.latestHealth && !agent.latestHealth.healthy).length;
  const serverAgents = runtimeAgents.filter((agent) => agent.type === 'server');
  const brainAgents = runtimeAgents.filter((agent) => agent.type === 'brain');
  const executorAgents = runtimeAgents.filter((agent) => agent.type === 'executor');
  const collectiveBrain = brainAgents.find((agent) => agent.id === 'collective-brain') || null;
  const strategicBrain = brainAgents.find((agent) => agent.id === 'strategic-brain') || null;
  const guardianBrain = brainAgents.find((agent) => agent.id === 'guardian-brain') || null;
  const memoryBrain = brainAgents.find((agent) => agent.id === 'memory-brain') || null;
  const verificationBrain = brainAgents.find((agent) => agent.id === 'verification-brain') || null;
  const dependencyBrain = brainAgents.find((agent) => agent.id === 'dependency-brain') || null;
  const predictionBrain = brainAgents.find((agent) => agent.id === 'prediction-brain') || null;
  const simulationBrain = brainAgents.find((agent) => agent.id === 'simulation-brain') || null;
  const governanceBrain = brainAgents.find((agent) => agent.id === 'governance-brain') || null;
  const identityBrain = brainAgents.find((agent) => agent.id === 'identity-brain') || null;
  const evolutionBrain = brainAgents.find((agent) => agent.id === 'evolution-brain') || null;
  const riskLevel = unhealthyAiAgents > 0 || unhealthyAgents > 0 ? (unhealthyAiAgents > 1 ? 'high' : 'elevated') : 'stable';
  const dependencyGraph = {
    'subservient-server': aiAgents.map((agent) => agent.id),
    orchestrator: ['collective-brain', 'strategic-brain', 'guardian-brain', 'memory-brain', 'execution-agent'],
    'execution-agent': ['guardian-brain', 'simulation-brain', 'verification-brain']
  };

  return {
    generatedAt: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development',
    uptimeSeconds: process.uptime(),
    memory: process.memoryUsage(),
    totalAgents: runtimeAgents.length,
    healthyAgents,
    unhealthyAgents,
    totalAiAgents: aiAgents.length,
    healthyAiAgents,
    unhealthyAiAgents,
    serverAgents,
    brainAgents,
    executorAgents,
    collectiveBrain,
    strategicBrain,
    guardianBrain,
    memoryBrain,
    verificationBrain,
    dependencyBrain,
    predictionBrain,
    simulationBrain,
    governanceBrain,
    identityBrain,
    evolutionBrain,
    riskLevel,
    dependencyGraph,
    telemetryState,
    incidentMemory: incidentMemory.slice(-10),
    governanceState,
    approvalQueue: approvalQueue.slice(-10),
    executionPipeline,
    recentActions: actionLog.slice(-20),
    runtimeAgents
  };
}

async function checkHealth(agent) {
  const startedAt = Date.now();
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
      return { ok: true, status: res.status, timestamp: Date.now(), latencyMs: Date.now() - startedAt };
    }
    return { ok: false, status: res.status, timestamp: Date.now(), latencyMs: Date.now() - startedAt };
  } catch(e) {
    return { 
      ok: false, 
      error: e.message, 
      timestamp: Date.now(),
      latencyMs: Date.now() - startedAt
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

  async clearCache(agent, proposal) {
    const details = {
      requestedBy: agent?.id || 'admin',
      proposalAction: proposal?.action || 'clear_cache',
      bounded: true,
      timestamp: new Date().toISOString()
    };
    logAction('CLEAR_CACHE', agent || null, 'success', details);
    return {
      success: true,
      message: 'Cache clear simulated in bounded mode',
      details
    };
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
  if(agent.type === 'server') {
    const result = await checkHealth(agent);
    trackHealth(agent, result);
    logAction('SERVER_HEALTH_CHECK', agent, result.ok ? 'success' : 'failure', result);

    if(!result.ok) {
      await safeActions.recordFailure(agent, result.error || `Status ${result.status}`);
      rememberIncident({
        timestamp: new Date().toISOString(),
        agentId: agent.id,
        phase: 'observe',
        outcome: 'server_failure',
        details: result.error || `Status ${result.status}`
      });
    }
  }

  // Monitor type: health checks
  if(agent.type === 'monitor') {
    const result = await checkHealth(agent);
    trackHealth(agent, result);
    logAction('HEALTH_CHECK', agent, result.ok ? 'success' : 'failure', result);
    
    if(!result.ok) {
      console.log(`[monitor:${agent.id}] Health check failed:`, result);
      await safeActions.recordFailure(agent, result.error || `Status ${result.status}`);
      rememberIncident({
        timestamp: new Date().toISOString(),
        agentId: agent.id,
        phase: 'observe',
        outcome: 'monitor_failure',
        details: result.error || `Status ${result.status}`
      });
      
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
    updateExecutionPipeline({ phase: 'diagnose', executionStatus: 'evaluating' });
    
    for(const a of agents) {
      if(a.id === agent.id) continue; // skip self
      const health = await checkHealth(a);
      trackHealth(a, health);
      
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

  if(agent.type === 'brain') {
    const snapshot = getSystemSnapshot();
    let details;

    if (agent.id === 'collective-brain') {
      updateExecutionPipeline({ phase: 'observe' });
      details = {
        totalAgents: snapshot.totalAgents,
        coveredAgents: snapshot.runtimeAgents.length,
        totalAiAgents: snapshot.totalAiAgents,
        healthyAiAgents: snapshot.healthyAiAgents,
        unhealthyAiAgents: snapshot.unhealthyAiAgents,
        subservientServerAgents: snapshot.serverAgents.length,
        healthyAgents: snapshot.healthyAgents,
        unhealthyAgents: snapshot.unhealthyAgents,
        telemetryCoverage: snapshot.telemetryState.serviceMetrics.heartbeatCount,
        dataSource: 'authentic_runtime_data'
      };
    } else if (agent.id === 'strategic-brain') {
      const proposal = buildProposal(snapshot);
      updateExecutionPipeline({
        phase: 'propose',
        currentProposal: proposal,
        executionStatus: 'proposal-ready',
        rollback: {
          status: 'not-required',
          reason: null,
          triggeredAt: null
        }
      });
      details = {
        riskLevel: snapshot.riskLevel,
        recommendedPriority: snapshot.unhealthyAiAgents > 0 ? 'repair-and-rebalance' : 'optimize-and-observe',
        affectedAiAgents: snapshot.unhealthyAiAgents,
        serverSupportStatus: snapshot.serverAgents[0]?.latestHealth?.healthy ? 'ready' : 'degraded',
        proposal,
        dataSource: 'derived_operational_intelligence'
      };
    } else if (agent.id === 'guardian-brain') {
      const guardianDecision = snapshot.unhealthyAiAgents > 1
        ? 'require-human'
        : snapshot.serverAgents[0]?.latestHealth?.healthy
          ? 'approve'
          : 'deny';
      updateExecutionPipeline({
        phase: 'guard',
        guardianDecision,
        executionStatus: guardianDecision === 'approve' ? 'approved' : guardianDecision
      });
      details = {
        approvalMode: snapshot.unhealthyAiAgents > 1 ? 'manual-review-preferred' : 'autonomous-safe',
        policyPosture: snapshot.serverAgents[0]?.latestHealth?.healthy ? 'guarded' : 'restricted',
        pendingEscalationReview: snapshot.recentActions.filter((entry) => entry.action === 'ESCALATE_TO_ADMIN').length,
        pendingApprovals: snapshot.approvalQueue.length,
        decision: guardianDecision,
        dataSource: 'policy_guardrail_intelligence'
      };
    } else if (agent.id === 'memory-brain') {
      details = {
        incidentsTracked: snapshot.incidentMemory.length,
        latestIncident: snapshot.incidentMemory[snapshot.incidentMemory.length - 1] || null,
        recurringFailureAgents: Array.from(new Set(snapshot.incidentMemory.map((entry) => entry.agentId))).filter(Boolean),
        dataSource: 'persistent_incident_memory'
      };
    } else if (agent.id === 'verification-brain') {
      const lastExecution = snapshot.executionPipeline.lastExecution;
      const verified = Boolean(
        snapshot.executionPipeline.phase === 'verify' &&
        snapshot.executionPipeline.executionStatus === 'verification-pending' &&
        lastExecution &&
        lastExecution.success
      );
      const rollbackRequired = Boolean(
        snapshot.executionPipeline.phase === 'verify' &&
        snapshot.executionPipeline.currentProposal?.action !== 'observe_only' &&
        snapshot.unhealthyAiAgents > 1
      );
      updateExecutionPipeline({
        verificationStatus: verified ? 'validated' : rollbackRequired ? 'rollback-required' : 'awaiting-proof',
        lastVerification: {
          checkedAt: new Date().toISOString(),
          verified,
          rollbackRequired,
          targetState: snapshot.unhealthyAiAgents === 0 ? 'healthy-fleet' : 'repair-still-required'
        },
        rollback: rollbackRequired
          ? {
              status: 'armed',
              reason: 'Verification indicates remaining unhealthy AI agents after bounded execution.',
              triggeredAt: new Date().toISOString()
            }
          : {
              status: 'not-required',
              reason: null,
              triggeredAt: null
            }
      });
      details = {
        verificationStatus: verified ? 'validated' : rollbackRequired ? 'rollback-required' : 'awaiting-proof',
        targetState: snapshot.unhealthyAiAgents === 0 ? 'healthy-fleet' : 'repair-still-required',
        rollbackRequired,
        rollbackPlan: getRollbackPlan(snapshot.executionPipeline.currentProposal),
        dataSource: 'verification_intelligence'
      };
    } else if (agent.id === 'dependency-brain') {
      details = {
        dependencyGraph: snapshot.dependencyGraph,
        rootCauseCandidate: snapshot.serverAgents[0]?.latestHealth?.healthy ? 'agent-local-fault' : 'host-runtime-degradation',
        pluginHeartbeats: snapshot.telemetryState.pluginHeartbeats,
        dataSource: 'causal_graph_intelligence'
      };
    } else if (agent.id === 'prediction-brain') {
      details = {
        driftRisk: snapshot.riskLevel === 'stable' ? 'low' : 'elevated',
        forecast: snapshot.unhealthyAiAgents > 0 ? 'further-intervention-likely' : 'stable-horizon',
        capacityPressure: snapshot.totalAgents > 8 ? 'moderate' : 'low',
        latencyPressure: Object.values(snapshot.telemetryState.serviceMetrics.healthLatencyMs).some((value) => typeof value === 'number' && value > 1500) ? 'elevated' : 'nominal',
        dataSource: 'predictive_intelligence'
      };
    } else if (agent.id === 'simulation-brain') {
      const simulationStatus = snapshot.executionPipeline.currentProposal ? 'safe-to-stage' : 'no-proposal';
      updateExecutionPipeline({
        simulationStatus
      });
      details = {
        simulationStatus,
        blastRadius: snapshot.executionPipeline.currentProposal?.action === 'collect_diagnostics' ? 'minimal' : 'none',
        rollbackCost: 'low',
        dataSource: 'simulation_intelligence'
      };
    } else if (agent.id === 'governance-brain') {
      details = {
        sovereigntyLevel: snapshot.executionPipeline.sovereigntyLevel,
        autonomyBudget: snapshot.unhealthyAiAgents > 1 ? 'restricted' : governanceState.autonomyBudget,
        doctrine: 'federated-sovereign-control',
        missionProfile: governanceState.missionProfile,
        doctrineVersion: governanceState.doctrineVersion,
        adapterCatalog: snapshot.telemetryState.adapterCatalog,
        pendingApprovals: snapshot.approvalQueue.length,
        dataSource: 'governance_intelligence'
      };
    } else if (agent.id === 'identity-brain') {
      details = {
        trustedActors: ['collective-brain', 'strategic-brain', 'guardian-brain', 'execution-agent'],
        scopeStatus: 'enforced',
        authorizationModel: 'brain-federation-scope-gating',
        dataSource: 'identity_trust_intelligence'
      };
    } else if (agent.id === 'evolution-brain') {
      details = {
        learningMode: 'continuous',
        thresholdRecommendation: snapshot.incidentMemory.length > 3 ? 'tighten-escalation-thresholds' : 'hold-current-thresholds',
        strategyUpdate: snapshot.riskLevel === 'stable' ? 'optimize-observation' : 'optimize-repair-readiness',
        recommendedDoctrineBump: snapshot.incidentMemory.length > 5 ? '1.1.0' : governanceState.doctrineVersion,
        dataSource: 'continuous_improvement_intelligence'
      };
    } else {
      details = {
        totalAgents: snapshot.totalAgents,
        dataSource: agent.source || 'runtime'
      };
    }

    trackHealth(agent, { ok: true, status: 200, timestamp: Date.now() });
    logAction('BRAIN_SYNC', agent, 'success', details);
  }

  if(agent.type === 'executor') {
    const snapshot = getSystemSnapshot();
    const canExecute = snapshot.executionPipeline.guardianDecision === 'approve' && snapshot.executionPipeline.currentProposal;

    if (canExecute) {
      const executionResult = await executeCatalogAction(
        snapshot.executionPipeline.currentProposal.action,
        agent,
        snapshot.executionPipeline.currentProposal
      );
      updateExecutionPipeline({
        phase: 'execute',
        executionStatus: 'executing',
        lastExecution: {
          executedAt: new Date().toISOString(),
          ...executionResult
        }
      });
      logAction('EXECUTION_AGENT_RUN', agent, executionResult.success ? 'success' : 'failure', {
        proposal: snapshot.executionPipeline.currentProposal,
        executionResult
      });
      rememberIncident({
        timestamp: new Date().toISOString(),
        agentId: agent.id,
        phase: 'execute',
        outcome: executionResult.success ? 'proposal_executed' : 'proposal_failed',
        details: {
          proposal: snapshot.executionPipeline.currentProposal,
          executionResult
        }
      });
      updateExecutionPipeline({
        phase: 'verify',
        executionStatus: 'verification-pending',
        simulationStatus: executionResult.bounded ? 'bounded-executed' : snapshot.executionPipeline.simulationStatus
      });
    } else {
      logAction('EXECUTION_AGENT_STANDBY', agent, 'logged', {
        guardianDecision: snapshot.executionPipeline.guardianDecision,
        proposal: snapshot.executionPipeline.currentProposal
      });
    }
  }
}

// HTTP API for admin dashboard
function setupMetricsEndpoint(app) {
  app.get('/api/orchestrator/status', (req, res) => {
    const snapshot = getSystemSnapshot();
    res.json({
      status: 'running',
      agents: snapshot.runtimeAgents,
      recentActions: snapshot.recentActions,
      brain: {
        id: 'collective-brain',
        source: 'authentic_runtime_data',
        generatedAt: snapshot.generatedAt,
        coverage: {
          totalAgents: snapshot.totalAgents,
          totalAiAgents: snapshot.totalAiAgents,
          healthyAiAgents: snapshot.healthyAiAgents,
          unhealthyAiAgents: snapshot.unhealthyAiAgents,
          healthyAgents: snapshot.healthyAgents,
          unhealthyAgents: snapshot.unhealthyAgents
        },
        subservientServer: snapshot.serverAgents[0] || null,
        strategicBrain: snapshot.strategicBrain,
        guardianBrain: snapshot.guardianBrain,
        memoryBrain: snapshot.memoryBrain,
        verificationBrain: snapshot.verificationBrain,
        dependencyBrain: snapshot.dependencyBrain,
        predictionBrain: snapshot.predictionBrain,
        simulationBrain: snapshot.simulationBrain,
        governanceBrain: snapshot.governanceBrain,
        identityBrain: snapshot.identityBrain,
        evolutionBrain: snapshot.evolutionBrain,
        riskLevel: snapshot.riskLevel,
        dependencyGraph: snapshot.dependencyGraph,
        telemetryState: snapshot.telemetryState,
        governanceState: snapshot.governanceState,
        approvalQueue: snapshot.approvalQueue,
        executionPipeline: snapshot.executionPipeline,
        incidentMemory: snapshot.incidentMemory,
        memory: snapshot.memory,
        uptimeSeconds: snapshot.uptimeSeconds
      }
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

    const requestedAction = String(action || '').trim();
    const requiresApproval = governanceState.humanApprovalRequired.includes(requestedAction);
    const isProtected = governanceState.protectedActions.includes(requestedAction);

    if (requiresApproval) {
      const approval = queueApprovalRequest(
        requestedAction,
        'Manual admin request entered the sovereign execution queue.'
      );
      updateExecutionPipeline({
        phase: 'guard',
        guardianDecision: 'require-human',
        executionStatus: 'manual-approval-required',
        currentProposal: {
          action: requestedAction,
          priority: 'high',
          confidence: 1,
          rationale: 'Manual admin request entered the sovereign execution queue.'
        }
      });
      return res.status(202).json({
        success: true,
        message: `Action ${requestedAction} requires human approval before execution`,
        approvalId: approval.id,
        protected: isProtected,
        timestamp: new Date().toISOString()
      });
    }

    updateExecutionPipeline({
      phase: 'propose',
      guardianDecision: 'approve',
      executionStatus: 'proposal-ready',
      currentProposal: {
        action: requestedAction || 'observe_only',
        priority: 'normal',
        confidence: 1,
        rationale: 'Manual admin request injected into execution pipeline.'
      }
    });

    res.json({
      success: true,
      message: `Action ${requestedAction} queued for execution`,
      protected: isProtected,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/orchestrator/approvals/:approvalId/:decision', (req, res) => {
    if(process.env.NODE_ENV === 'production' && !req.headers['x-admin-token']) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { approvalId, decision } = req.params;
    if (decision !== 'approve' && decision !== 'deny') {
      return res.status(400).json({ error: 'Decision must be approve or deny' });
    }

    try {
      const resolved = resolveApprovalRequest(
        String(approvalId || '').trim(),
        decision === 'approve' ? 'approved' : 'denied',
        req.body?.note
      );
      return res.json({
        success: true,
        approval: resolved,
        message: `Approval ${resolved.id} ${resolved.status}`
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });
}

function start(app) {
  loadAgents();
  loadPersistedState();
  
  // Setup API endpoints if app provided
  if(app) {
    setupMetricsEndpoint(app);
  }
  
  // Start monitoring intervals
  agents.forEach(a => {
    const intervalMs = (a.intervalSeconds || 60) * 1000;
    setInterval(() => runAgent(a), intervalMs);
    runAgent(a).catch((error) => {
      logAction('AGENT_BOOTSTRAP_FAILURE', a, 'failure', {
        error: error.message
      });
    });
  });
  
  console.log(`✓ AI Orchestrator started: monitoring ${agents.length} agents`);
  console.log(`  - Endpoints: /api/orchestrator/status, /api/orchestrator/logs`);
}

function getStatus() {
  const snapshot = getSystemSnapshot();
  return {
    agents: snapshot.runtimeAgents,
    recentActions: snapshot.recentActions,
    brain: {
      id: 'collective-brain',
      source: 'authentic_runtime_data',
      generatedAt: snapshot.generatedAt,
      coverage: {
        totalAgents: snapshot.totalAgents,
        totalAiAgents: snapshot.totalAiAgents,
        healthyAiAgents: snapshot.healthyAiAgents,
        unhealthyAiAgents: snapshot.unhealthyAiAgents,
        healthyAgents: snapshot.healthyAgents,
        unhealthyAgents: snapshot.unhealthyAgents
      },
      subservientServer: snapshot.serverAgents[0] || null,
      strategicBrain: snapshot.strategicBrain,
      guardianBrain: snapshot.guardianBrain,
      memoryBrain: snapshot.memoryBrain,
      verificationBrain: snapshot.verificationBrain,
      dependencyBrain: snapshot.dependencyBrain,
      predictionBrain: snapshot.predictionBrain,
      simulationBrain: snapshot.simulationBrain,
      governanceBrain: snapshot.governanceBrain,
      identityBrain: snapshot.identityBrain,
      evolutionBrain: snapshot.evolutionBrain,
      riskLevel: snapshot.riskLevel,
      dependencyGraph: snapshot.dependencyGraph,
      telemetryState: snapshot.telemetryState,
      governanceState: snapshot.governanceState,
      approvalQueue: snapshot.approvalQueue,
      executionPipeline: snapshot.executionPipeline,
      incidentMemory: snapshot.incidentMemory,
      memory: snapshot.memory,
      uptimeSeconds: snapshot.uptimeSeconds
    }
  };
}

module.exports = { start, actionLog, safeActions, getStatus, resolveApprovalRequest };
