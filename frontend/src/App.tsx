import React, { useEffect, useState } from 'react'
import { OrchestratorDashboard } from './OrchestratorDashboard'

export default function App() {
  const [tab, setTab] = useState<'home' | 'super-admin'>('home')
  const [status, setStatus] = useState('loading')
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    fetch('/health')
      .then(r => r.json())
      .then(j => {
        setHealth(j)
        setStatus(j.status)
      })
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ backgroundColor: '#1a1a2e', color: 'white', padding: '20px 24px', borderBottom: '2px solid #00d4ff' }}>
        <h1 style={{ margin: '0 0 15px 0' }}>🚀 NEXA Command Center</h1>
        <nav style={{ display: 'flex', gap: '20px' }}>
          <button
            onClick={() => setTab('home')}
            style={{
              background: tab === 'home' ? '#00d4ff' : 'transparent',
              color: tab === 'home' ? '#000' : '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: tab === 'home' ? 'bold' : 'normal'
            }}
          >
            Home
          </button>
          <button
            onClick={() => setTab('super-admin')}
            style={{
              background: tab === 'super-admin' ? '#00d4ff' : 'transparent',
              color: tab === 'super-admin' ? '#000' : '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: tab === 'super-admin' ? 'bold' : 'normal'
            }}
          >
            🔐 Super Admin
          </button>
        </nav>
      </header>

      <main style={{ flex: 1, padding: '24px' }}>
        {tab === 'home' && (
          <section>
            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h2>System Status</h2>
              <p>Status: <strong style={{ color: status === 'ok' ? '#28a745' : status === 'operational' ? '#17a2b8' : '#dc3545' }}>{status}</strong></p>
              {health && (
                <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', overflowX: 'auto', fontSize: '0.9em' }}>
                  {JSON.stringify(health, null, 2)}
                </pre>
              )}
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h2>Welcome to NEXA Command Center</h2>
              <p>Your AI-powered platform for autonomous command and control.</p>
              <ul>
                <li>✓ Real-time system health monitoring</li>
                <li>✓ Autonomous agent orchestration (Super Admin tab)</li>
                <li>✓ Distributed repair and recovery system</li>
                <li>✓ Complete audit trail for all operations</li>
              </ul>
            </div>
          </section>
        )}

        {tab === 'super-admin' && (
          <OrchestratorDashboard />
        )}
      </main>

      <footer style={{ backgroundColor: '#1a1a2e', color: '#999', padding: '20px 24px', textAlign: 'center', borderTop: '1px solid #333' }}>
        <p style={{ margin: 0 }}>NEXA Command Center • AI Orchestration Platform</p>
      </footer>
    </div>
  )
}
