import React, { useState, useEffect } from 'react';

interface Agent {
  id: string;
  name?: string;
  type: string;
  interval: number;
  source?: string;
  endpoint?: string | null;
  description?: string;
  capabilities?: string[];
  latestHealth?: {
    healthy: boolean;
    checkedAt: string;
    statusCode?: number | null;
    error?: string | null;
  } | null;
}

interface ActionLog {
  timestamp: string;
  action: string;
  agentId?: string;
  status: string;
  details?: any;
}

interface OrchestratorStatus {
  status: string;
  agents: Agent[];
  recentActions: ActionLog[];
  brain?: {
    id: string;
    source: string;
    generatedAt: string;
    coverage: {
      totalAgents: number;
      totalAiAgents: number;
      healthyAiAgents: number;
      unhealthyAiAgents: number;
      healthyAgents: number;
      unhealthyAgents: number;
    };
    subservientServer?: {
      id: string;
      name?: string;
      latestHealth?: {
        healthy: boolean;
      } | null;
    } | null;
    strategicBrain?: Agent | null;
    guardianBrain?: Agent | null;
    memoryBrain?: Agent | null;
    verificationBrain?: Agent | null;
    dependencyBrain?: Agent | null;
    predictionBrain?: Agent | null;
    simulationBrain?: Agent | null;
    governanceBrain?: Agent | null;
    identityBrain?: Agent | null;
    evolutionBrain?: Agent | null;
    riskLevel?: string;
    dependencyGraph?: Record<string, string[]>;
    telemetryState?: {
      generatedAt?: string | null;
      pluginHeartbeats?: Record<string, {
        checkedAt?: string | null;
        healthy: boolean;
        source: string;
        capabilities?: string[];
      }>;
      serviceMetrics?: {
        healthLatencyMs?: Record<string, number | null>;
        heartbeatCount?: number;
      };
      adapterCatalog?: Record<string, {
        mode: string;
        mutable: boolean;
        requiresApproval: boolean;
      }>;
    };
    governanceState?: {
      missionProfile: string;
      autonomyBudget: string;
      doctrineVersion: string;
      protectedActions?: string[];
      humanApprovalRequired?: string[];
    };
    approvalQueue?: Array<{
      id: string;
      action: string;
      rationale: string;
      requestedAt: string;
      status: string;
    }>;
    executionPipeline?: {
      phase: string;
      lastUpdatedAt?: string | null;
      currentProposal?: {
        action: string;
        priority: string;
        confidence: number;
        rationale: string;
      } | null;
      guardianDecision?: string | null;
      executionStatus?: string;
      simulationStatus?: string;
      verificationStatus?: string;
      sovereigntyLevel?: string;
      lastExecution?: {
        action: string;
        success: boolean;
        bounded: boolean;
        targetAgentId?: string | null;
        executedAt?: string;
      } | null;
      lastVerification?: {
        checkedAt: string;
        verified: boolean;
        rollbackRequired: boolean;
        targetState: string;
      } | null;
      rollback?: {
        status: string;
        reason?: string | null;
        triggeredAt?: string | null;
      };
    };
    incidentMemory?: Array<{
      timestamp: string;
      agentId?: string;
      phase: string;
      outcome: string;
      details?: unknown;
    }>;
    uptimeSeconds: number;
  };
}

export function OrchestratorDashboard() {
  const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/orchestrator/status');
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const data = await response.json();
        setOrchestratorStatus(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`/api/orchestrator/actions/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // In production, this would be a real admin token
          'X-Admin-Token': process.env.REACT_APP_ADMIN_TOKEN || 'dev-token'
        },
        body: JSON.stringify({ requestedAt: new Date().toISOString() })
      });
      
      if (!response.ok) throw new Error(`Action failed: ${response.status}`);
      const result = await response.json();
      setActionMessage(`Action queued: ${result.message}`);
    } catch (err) {
      setActionMessage(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading orchestrator status...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🤖 AI Orchestrator Dashboard</h1>
        <div style={styles.controls}>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
        </div>
      </div>

      {error && (
        <div style={{ ...styles.card, backgroundColor: '#ffe6e6', borderColor: '#ff4444' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {actionMessage && (
        <div
          style={{ ...styles.card, backgroundColor: '#eef6ff', borderColor: '#55aaff' }}
          role="status"
          aria-live="polite"
        >
          <strong>Operator Notice:</strong> {actionMessage}
        </div>
      )}

      {orchestratorStatus && (
        <>
          {/* Status Summary */}
          <div style={styles.card}>
            <h2>Status Summary</h2>
            <div style={styles.statusGrid}>
              <div>
                <strong>Orchestrator:</strong> <span style={styles.badge}>{orchestratorStatus.status}</span>
              </div>
              <div>
                <strong>Agents:</strong> <span style={styles.badge}>{orchestratorStatus.agents.length} active</span>
              </div>
              <div>
                <strong>Recent Actions:</strong> <span style={styles.badge}>{orchestratorStatus.recentActions.length}</span>
              </div>
              {orchestratorStatus.brain && (
                <div>
                  <strong>Collective Brain:</strong> <span style={styles.badge}>{orchestratorStatus.brain.source}</span>
                </div>
              )}
            </div>
          </div>

          {orchestratorStatus.brain && (
            <div style={styles.card}>
              <h3>🧠 Collective Brain</h3>
              <div style={styles.statusGrid}>
                <div>
                  <strong>Coverage:</strong>
                  <span style={styles.badge}>
                    {orchestratorStatus.brain.coverage.healthyAiAgents}/{orchestratorStatus.brain.coverage.totalAiAgents} AI healthy
                  </span>
                </div>
                <div>
                  <strong>Subservient Server:</strong>
                  <span style={styles.badge}>
                    {orchestratorStatus.brain.subservientServer
                      ? orchestratorStatus.brain.subservientServer.latestHealth?.healthy
                        ? 'healthy'
                        : 'unhealthy'
                      : 'pending'}
                  </span>
                </div>
                <div>
                  <strong>Snapshot:</strong>
                  <span style={styles.badge}>
                    {new Date(orchestratorStatus.brain.generatedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <strong>Risk:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.riskLevel || 'unknown'}</span>
                </div>
              </div>
              <p style={{ marginTop: '12px', color: '#555' }}>
                Authentic runtime rollup across all AI agents, with the subservient server tracked as the supporting host layer.
              </p>
            </div>
          )}

          {orchestratorStatus.brain && (
            <div style={styles.card}>
              <h3>🧠 Brain Stack</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Brain</th>
                    <th>Source</th>
                    <th>Health</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { layer: 'Operational', brain: orchestratorStatus.brain ? { id: orchestratorStatus.brain.id, name: 'Collective Brain', source: orchestratorStatus.brain.source, latestHealth: { healthy: true } } : null },
                    { layer: 'Strategic', brain: orchestratorStatus.brain.strategicBrain || null },
                    { layer: 'Guardian', brain: orchestratorStatus.brain.guardianBrain || null },
                    { layer: 'Memory', brain: orchestratorStatus.brain.memoryBrain || null },
                    { layer: 'Verification', brain: orchestratorStatus.brain.verificationBrain || null },
                    { layer: 'Dependency', brain: orchestratorStatus.brain.dependencyBrain || null },
                    { layer: 'Prediction', brain: orchestratorStatus.brain.predictionBrain || null },
                    { layer: 'Simulation', brain: orchestratorStatus.brain.simulationBrain || null },
                    { layer: 'Governance', brain: orchestratorStatus.brain.governanceBrain || null },
                    { layer: 'Identity', brain: orchestratorStatus.brain.identityBrain || null },
                    { layer: 'Evolution', brain: orchestratorStatus.brain.evolutionBrain || null }
                  ].map((entry) => (
                    <tr key={entry.layer}>
                      <td>{entry.layer}</td>
                      <td>{entry.brain?.name || entry.brain?.id || 'pending'}</td>
                      <td>{entry.brain?.source || 'n/a'}</td>
                      <td>{entry.brain?.latestHealth ? (entry.brain.latestHealth.healthy ? 'healthy' : 'unhealthy') : 'pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {orchestratorStatus.brain?.executionPipeline && (
            <div style={styles.card}>
              <h3>🔁 Execution Pipeline</h3>
              <div style={styles.statusGrid}>
                <div>
                  <strong>Phase:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.phase}</span>
                </div>
                <div>
                  <strong>Guardian:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.guardianDecision || 'pending'}</span>
                </div>
                <div>
                  <strong>Status:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.executionStatus || 'idle'}</span>
                </div>
                <div>
                  <strong>Simulation:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.simulationStatus || 'pending'}</span>
                </div>
                <div>
                  <strong>Verification:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.verificationStatus || 'pending'}</span>
                </div>
                <div>
                  <strong>Sovereignty:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.sovereigntyLevel || 'unknown'}</span>
                </div>
                <div>
                  <strong>Rollback:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.executionPipeline.rollback?.status || 'not-required'}</span>
                </div>
              </div>
              {orchestratorStatus.brain.executionPipeline.currentProposal && (
                <div style={{ marginTop: '12px', color: '#555' }}>
                  <strong>Proposal:</strong> {orchestratorStatus.brain.executionPipeline.currentProposal.action} (
                  {orchestratorStatus.brain.executionPipeline.currentProposal.priority}, confidence{' '}
                  {Math.round(orchestratorStatus.brain.executionPipeline.currentProposal.confidence * 100)}%)
                </div>
              )}
              {orchestratorStatus.brain.executionPipeline.lastExecution && (
                <div style={{ marginTop: '8px', color: '#555' }}>
                  <strong>Last Execution:</strong> {orchestratorStatus.brain.executionPipeline.lastExecution.action}
                  {' · '}
                  {orchestratorStatus.brain.executionPipeline.lastExecution.success ? 'success' : 'failure'}
                  {' · '}
                  {orchestratorStatus.brain.executionPipeline.lastExecution.bounded ? 'bounded' : 'unbounded'}
                  {orchestratorStatus.brain.executionPipeline.lastExecution.targetAgentId
                    ? ` · target ${orchestratorStatus.brain.executionPipeline.lastExecution.targetAgentId}`
                    : ''}
                </div>
              )}
              {orchestratorStatus.brain.executionPipeline.lastVerification && (
                <div style={{ marginTop: '8px', color: '#555' }}>
                  <strong>Last Verification:</strong>{' '}
                  {orchestratorStatus.brain.executionPipeline.lastVerification.verified ? 'validated' : 'pending / failed'}
                  {' · target '}
                  {orchestratorStatus.brain.executionPipeline.lastVerification.targetState}
                  {orchestratorStatus.brain.executionPipeline.lastVerification.rollbackRequired ? ' · rollback required' : ''}
                </div>
              )}
              {orchestratorStatus.brain.executionPipeline.rollback?.reason && (
                <div style={{ marginTop: '8px', color: '#555' }}>
                  <strong>Rollback Reason:</strong> {orchestratorStatus.brain.executionPipeline.rollback.reason}
                </div>
              )}
            </div>
          )}

          {orchestratorStatus.brain?.governanceState && (
            <div style={styles.card}>
              <h3>🏛️ Governance State</h3>
              <div style={styles.statusGrid}>
                <div>
                  <strong>Mission Profile:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.governanceState.missionProfile}</span>
                </div>
                <div>
                  <strong>Autonomy Budget:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.governanceState.autonomyBudget}</span>
                </div>
                <div>
                  <strong>Doctrine Version:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.governanceState.doctrineVersion}</span>
                </div>
              </div>
              <div style={{ marginTop: '12px', color: '#555' }}>
                <strong>Protected Actions:</strong>{' '}
                {(orchestratorStatus.brain.governanceState.protectedActions || []).join(', ') || 'none'}
              </div>
              <div style={{ marginTop: '8px', color: '#555' }}>
                <strong>Human Approval Required:</strong>{' '}
                {(orchestratorStatus.brain.governanceState.humanApprovalRequired || []).join(', ') || 'none'}
              </div>
            </div>
          )}

          {orchestratorStatus.brain?.approvalQueue && (
            <div style={styles.card}>
              <h3>✋ Approval Queue</h3>
              <div style={styles.logContainer}>
                {orchestratorStatus.brain.approvalQueue.length === 0 ? (
                  <p style={{ color: '#666' }}>No protected actions are waiting for operator approval</p>
                ) : (
                  orchestratorStatus.brain.approvalQueue.map((entry) => (
                    <div key={entry.id} style={styles.logEntry}>
                      <div style={styles.logTimestamp}>
                        {new Date(entry.requestedAt).toLocaleTimeString()}
                      </div>
                      <div style={styles.logContent}>
                        <strong>{entry.action}</strong>
                        <span>{entry.status}</span>
                        <span>{entry.rationale}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {orchestratorStatus.brain?.telemetryState && (
            <div style={styles.card}>
              <h3>📡 Live Telemetry & Adapters</h3>
              <div style={styles.statusGrid}>
                <div>
                  <strong>Heartbeats:</strong>
                  <span style={styles.badge}>{orchestratorStatus.brain.telemetryState.serviceMetrics?.heartbeatCount || 0}</span>
                </div>
                <div>
                  <strong>Telemetry Snapshot:</strong>
                  <span style={styles.badge}>
                    {orchestratorStatus.brain.telemetryState.generatedAt
                      ? new Date(orchestratorStatus.brain.telemetryState.generatedAt).toLocaleTimeString()
                      : 'pending'}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <strong>Adapter Catalog</strong>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Mode</th>
                      <th>Mutable</th>
                      <th>Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(orchestratorStatus.brain.telemetryState.adapterCatalog || {}).map(([action, adapter]) => (
                      <tr key={action}>
                        <td>{action}</td>
                        <td>{adapter.mode}</td>
                        <td>{adapter.mutable ? 'yes' : 'no'}</td>
                        <td>{adapter.requiresApproval ? 'required' : 'not required'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {orchestratorStatus.brain?.dependencyGraph && (
            <div style={styles.card}>
              <h3>🕸️ Dependency Graph</h3>
              <div style={styles.logContainer}>
                {Object.entries(orchestratorStatus.brain.dependencyGraph).map(([node, deps]) => (
                  <div key={node} style={styles.logEntry}>
                    <div style={styles.logTimestamp}>{node}</div>
                    <div style={styles.logContent}>
                      <strong>depends on</strong>
                      <span>{deps.join(', ') || 'none'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orchestratorStatus.brain?.incidentMemory && (
            <div style={styles.card}>
              <h3>🧠 Incident Memory</h3>
              <div style={styles.logContainer}>
                {orchestratorStatus.brain.incidentMemory.length === 0 ? (
                  <p style={{ color: '#666' }}>No incidents recorded yet</p>
                ) : (
                  orchestratorStatus.brain.incidentMemory.map((incident, idx) => (
                    <div key={idx} style={styles.logEntry}>
                      <div style={styles.logTimestamp}>
                        {new Date(incident.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={styles.logContent}>
                        <strong>{incident.outcome}</strong>
                        {incident.agentId && <span> [{incident.agentId}]</span>}
                        <span>{incident.phase}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Agents List */}
          <div style={styles.card}>
            <h3>📊 Monitored Agents</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Agent ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Health</th>
                  <th>Interval (s)</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {orchestratorStatus.agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>{agent.id}</td>
                    <td>{agent.name || '—'}</td>
                    <td>{agent.type}</td>
                    <td>
                      {agent.latestHealth
                        ? agent.latestHealth.healthy
                          ? 'healthy'
                          : `unhealthy${agent.latestHealth.error ? ` (${agent.latestHealth.error})` : ''}`
                        : 'pending'}
                    </td>
                    <td>{agent.interval}</td>
                    <td>{agent.source || 'runtime'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Actions Audit Log */}
          <div style={styles.card}>
            <h3>📜 Recent Actions (Audit Log)</h3>
            <div style={styles.logContainer}>
              {orchestratorStatus.recentActions.length === 0 ? (
                <p style={{ color: '#666' }}>No recent actions</p>
              ) : (
                orchestratorStatus.recentActions.map((action, idx) => (
                  <div key={idx} style={styles.logEntry}>
                    <div style={styles.logTimestamp}>
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </div>
                    <div style={styles.logContent}>
                      <strong>{action.action}</strong>
                      {action.agentId && <span> [{action.agentId}]</span>}
                      <span style={{
                        marginLeft: '10px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        backgroundColor: action.status === 'success' ? '#d4edda' : 
                                         action.status === 'warning' ? '#fff3cd' :
                                         action.status === 'failure' ? '#f8d7da' : '#e7e7e7',
                        color: action.status === 'success' ? '#155724' :
                               action.status === 'warning' ? '#856404' :
                               action.status === 'failure' ? '#721c24' : '#383d41'
                      }}>
                        {action.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Admin Actions */}
          <div style={styles.card}>
            <h3>⚙️ Admin Controls</h3>
            <div style={styles.actionGrid}>
              <button
                style={styles.button}
                onClick={() => handleAction('restart_service')}
              >
                🔄 Restart Service
              </button>
              <button
                style={styles.button}
                onClick={() => handleAction('collect_diagnostics')}
              >
                📋 Collect Diagnostics
              </button>
              <button
                style={styles.button}
                onClick={() => handleAction('clear_cache')}
              >
                🗑️ Clear Cache
              </button>
              <button
                style={styles.button}
                onClick={() => handleAction('check_updates')}
              >
                ⬆️ Check Updates
              </button>
            </div>
            <p style={{ fontSize: '0.9em', color: '#666', marginTop: '10px' }}>
              ℹ️ Admin actions are queued and logged for audit. Requires valid admin token in production.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    borderBottom: '2px solid #333',
    paddingBottom: '15px'
  },
  controls: {
    display: 'flex',
    gap: '15px'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #ddd',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginTop: '10px'
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#007bff',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '0.9em',
    marginLeft: '10px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px'
  },
  logContainer: {
    maxHeight: '400px',
    overflowY: 'auto',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    padding: '10px',
    marginTop: '10px'
  },
  logEntry: {
    display: 'flex',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #eee',
    fontSize: '0.9em'
  },
  logTimestamp: {
    color: '#999',
    minWidth: '100px',
    fontFamily: 'monospace'
  },
  logContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '10px',
    marginTop: '15px'
  },
  button: {
    padding: '10px 15px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.95em',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  }
};
