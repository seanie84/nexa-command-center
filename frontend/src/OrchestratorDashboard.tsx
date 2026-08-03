import React, { useState, useEffect } from 'react';

interface Agent {
  id: string;
  type: string;
  interval: number;
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
}

export function OrchestratorDashboard() {
  const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
      alert(`✓ Action queued: ${result.message}`);
    } catch (err) {
      alert(`✗ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
            </div>
          </div>

          {/* Agents List */}
          <div style={styles.card}>
            <h3>📊 Monitored Agents</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Agent ID</th>
                  <th>Type</th>
                  <th>Interval (s)</th>
                </tr>
              </thead>
              <tbody>
                {orchestratorStatus.agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>{agent.id}</td>
                    <td>{agent.type}</td>
                    <td>{agent.interval}</td>
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
