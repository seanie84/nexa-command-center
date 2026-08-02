import React, { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/health').then(r => r.json()).then(j => setStatus(j.status)).catch(() => setStatus('unreachable'))
  }, [])

  return (
    <div style={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto', padding: 24 }}>
      <h1>NEXA Command Center</h1>
      <p>Site status: <strong>{status}</strong></p>
      <section>
        <h2>Super Admin</h2>
        <p>AI Orchestrator: <em>Prototype running</em></p>
      </section>
      <small>Replace this skeleton with the full UI.</small>
    </div>
  )
}
