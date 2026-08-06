import React, { useEffect, useMemo, useState } from 'react'
import { OrchestratorDashboard } from './OrchestratorDashboard'

type TabId = 'home' | 'command' | 'security' | 'super-admin'

interface HealthPayload {
  status?: string
  environment?: string
  uptime?: number
  timestamp?: string
}

interface OverviewPayload {
  summary?: {
    totalAgents: number
    healthyAgents: number
    totalAiAgents: number
    healthyAiAgents: number
    riskLevel: string
    phase: string
    verificationStatus: string
  }
  brain?: {
    telemetryState?: {
      serviceMetrics?: {
        heartbeatCount?: number
      }
    }
    governanceState?: {
      doctrineVersion?: string
    }
    approvalQueue?: Array<{
      id: string
      action: string
      status: string
      requestedAt: string
      resolutionNote?: string | null
    }>
  }
}

interface SecurityPayload {
  doctrineVersion?: string
  protectedActions?: string[]
  humanApprovalRequired?: string[]
  rollbackStatus?: string
  adapterCatalog?: Record<string, { mode: string; mutable: boolean; requiresApproval: boolean }>
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'home', label: 'Overview' },
  { id: 'command', label: 'Command Grid' },
  { id: 'security', label: 'Security' },
  { id: 'super-admin', label: 'Sovereign Brain' }
]

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [overview, setOverview] = useState<OverviewPayload | null>(null)
  const [security, setSecurity] = useState<SecurityPayload | null>(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    Promise.all([
      fetch('/health').then((response) => response.json()),
      fetch('/api/orchestrator/overview').then((response) => response.json()),
      fetch('/api/orchestrator/security').then((response) => response.json())
    ])
      .then(([healthPayload, overviewPayload, securityPayload]) => {
        setHealth(healthPayload)
        setOverview(overviewPayload)
        setSecurity(securityPayload)
        setStatus(healthPayload.status || 'operational')
      })
      .catch(() => setStatus('unreachable'))
  }, [])

  const summaryCards = useMemo(() => {
    const summary = overview?.summary
    const heartbeatCount = overview?.brain?.telemetryState?.serviceMetrics?.heartbeatCount || 0
    return [
      { title: 'Fleet Availability', value: summary ? `${summary.healthyAgents}/${summary.totalAgents}` : '—', tone: 'cyan' },
      { title: 'AI Agent Readiness', value: summary ? `${summary.healthyAiAgents}/${summary.totalAiAgents}` : '—', tone: 'emerald' },
      { title: 'Risk Level', value: summary?.riskLevel || 'unknown', tone: 'amber' },
      { title: 'Heartbeats', value: String(heartbeatCount), tone: 'violet' }
    ]
  }, [overview])

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return
    }

    event.preventDefault()
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length

    setTab(tabs[nextIndex].id)
  }

  return (
    <div style={styles.shell}>
      <div style={styles.backgroundGlowA} />
      <div style={styles.backgroundGlowB} />
      <header style={styles.header}>
        <div>
          <div style={styles.kicker}>AI Sovereign Operations</div>
          <h1 style={styles.title}>NEXA Command Center</h1>
          <p style={styles.subtitle}>
            Sales-grade AI command surface with sovereign orchestration, guarded autonomy, and live operator intelligence.
          </p>
        </div>
        <div style={styles.statusPill}>
          <span style={styles.statusDot} />
          {status}
        </div>
      </header>

      <nav style={styles.nav} aria-label="Primary navigation">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => handleNavKeyDown(event, index)}
            aria-pressed={tab === item.id}
            aria-current={tab === item.id ? 'page' : undefined}
            style={{
              ...styles.navButton,
              ...(tab === item.id ? styles.navButtonActive : {})
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === 'home' && (
          <section style={styles.section}>
            <div style={styles.hero}>
              <div style={styles.heroCopy}>
                <div style={styles.badge}>Maximum capacity mode</div>
                <h2 style={styles.heroTitle}>Autonomous command, redesigned for trust, conversion, and AI clarity.</h2>
                <p style={styles.heroText}>
                  The platform now combines sovereign brain orchestration, telemetry-backed execution, approval-gated actions,
                  rollback intelligence, and a premium AI operator experience.
                </p>
              </div>
              <div style={styles.heroPanel}>
                <div style={styles.heroPanelLabel}>Doctrine</div>
                <div style={styles.heroPanelValue}>{security?.doctrineVersion || '1.0.0'}</div>
                <div style={styles.heroPanelMeta}>
                  Verification {overview?.summary?.verificationStatus || 'pending'} · Phase {overview?.summary?.phase || 'observe'}
                </div>
                <div style={{ ...styles.heroPanelMeta, marginTop: '10px' }}>
                  Pending approvals {overview?.brain?.approvalQueue?.length || 0}
                </div>
              </div>
            </div>

            <div style={styles.cardGrid}>
              {summaryCards.map((card) => (
                <article key={card.title} style={styles.metricCard}>
                  <div style={styles.metricTitle}>{card.title}</div>
                  <div style={styles.metricValue}>{card.value}</div>
                  <div style={{ ...styles.metricBar, ...(metricTones[card.tone] || metricTones.cyan) }} />
                </article>
              ))}
            </div>

            <div style={styles.dualGrid}>
              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>What is upgraded</h3>
                <ul style={styles.featureList}>
                  <li>Strict sovereign phase machine for observe → diagnose → propose → guard → execute → verify</li>
                  <li>Live telemetry and heartbeat rollups for all agents and adapters</li>
                  <li>Approval-aware bounded execution catalog with rollback awareness</li>
                  <li>Brain federation with strategy, prediction, dependency, identity, governance, and evolution layers</li>
                  <li>High-contrast AI-inspired redesign with accessible navigation and visual hierarchy</li>
                </ul>
              </section>
              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>Runtime envelope</h3>
                <dl style={styles.definitionList}>
                  <div style={styles.definitionRow}>
                    <dt>Environment</dt>
                    <dd>{health?.environment || 'unknown'}</dd>
                  </div>
                  <div style={styles.definitionRow}>
                    <dt>Uptime</dt>
                    <dd>{health?.uptime ? `${Math.round(health.uptime)}s` : '—'}</dd>
                  </div>
                  <div style={styles.definitionRow}>
                    <dt>Protected Actions</dt>
                    <dd>{security?.protectedActions?.length || 0}</dd>
                  </div>
                  <div style={styles.definitionRow}>
                    <dt>Rollback</dt>
                    <dd>{security?.rollbackStatus || 'not-required'}</dd>
                  </div>
                  <div style={styles.definitionRow}>
                    <dt>Approvals queued</dt>
                    <dd>{overview?.brain?.approvalQueue?.length || 0}</dd>
                  </div>
                </dl>
              </section>
            </div>
          </section>
        )}

        {tab === 'command' && (
          <section style={styles.section}>
            <div style={styles.dualGrid}>
              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>Command grid</h3>
                <p style={styles.panelBody}>
                  Every operational surface is now modeled as a guarded action path with telemetry, doctrine, and verification.
                </p>
                <div style={styles.commandList}>
                  {Object.entries(security?.adapterCatalog || {}).map(([action, adapter]) => (
                    <div key={action} style={styles.commandItem}>
                      <div>
                        <strong>{action}</strong>
                        <div style={styles.commandMeta}>{adapter.mode}</div>
                      </div>
                      <div style={styles.commandFlags}>
                        <span style={styles.commandFlag}>{adapter.mutable ? 'mutable' : 'read-only'}</span>
                        <span style={styles.commandFlag}>{adapter.requiresApproval ? 'approval' : 'autonomous'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>AI sales design system</h3>
                <p style={styles.panelBody}>
                  The interface now uses high-conversion premium tones: electric cyan for trust, violet for intelligence,
                  emerald for success, and controlled gold accents for decision confidence.
                </p>
                <div style={styles.swatchRow}>
                  {[
                    ['Electric Cyan', '#55e6ff'],
                    ['Neural Violet', '#8f7cff'],
                    ['Trust Emerald', '#44d7b6'],
                    ['Signal Gold', '#ffcc66']
                  ].map(([label, color]) => (
                    <div key={label} style={styles.swatchCard}>
                      <div style={{ ...styles.swatch, backgroundColor: color }} />
                      <div>{label}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}

        {tab === 'security' && (
          <section style={styles.section}>
            <div style={styles.dualGrid}>
              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>Security posture</h3>
                <ul style={styles.featureList}>
                  <li>Admin action queue with approval gating for protected operations</li>
                  <li>Helmet, rate limiting, request size caps, and environment-aware server behavior</li>
                  <li>Execution rollback signaling and verification-state persistence</li>
                  <li>Scoped adapter metadata visible to operators for safer action release</li>
                </ul>
              </section>
              <section style={styles.panel}>
                <h3 style={styles.panelTitle}>Protected controls</h3>
                <dl style={styles.definitionList}>
                  <div style={styles.definitionRow}>
                    <dt>Human approval</dt>
                    <dd>{(security?.humanApprovalRequired || []).join(', ') || 'none'}</dd>
                  </div>
                  <div style={styles.definitionRow}>
                    <dt>Protected actions</dt>
                    <dd>{(security?.protectedActions || []).join(', ') || 'none'}</dd>
                  </div>
                  <div style={styles.definitionRow}>
                    <dt>Doctrine version</dt>
                    <dd>{security?.doctrineVersion || 'unknown'}</dd>
                  </div>
                </dl>
                <div style={{ marginTop: '18px' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Approval queue</h4>
                  <div style={styles.commandList}>
                    {(overview?.brain?.approvalQueue || []).length === 0 ? (
                      <div style={styles.commandItem}>No pending approvals</div>
                    ) : (
                      (overview?.brain?.approvalQueue || []).map((entry) => (
                        <div key={entry.id} style={styles.commandItem}>
                          <div>
                            <strong>{entry.action}</strong>
                            <div style={styles.commandMeta}>{new Date(entry.requestedAt).toLocaleTimeString()}</div>
                            {entry.resolutionNote ? <div style={styles.commandMeta}>{entry.resolutionNote}</div> : null}
                          </div>
                          <div style={styles.commandFlags}>
                            <span style={styles.commandFlag}>{entry.status}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>
          </section>
        )}

        {tab === 'super-admin' && <OrchestratorDashboard />}
      </main>
    </div>
  )
}

const metricTones: Record<string, React.CSSProperties> = {
  cyan: { background: 'linear-gradient(90deg, #55e6ff, #00b7ff)' },
  emerald: { background: 'linear-gradient(90deg, #44d7b6, #13b97f)' },
  amber: { background: 'linear-gradient(90deg, #ffcc66, #ff8a3d)' },
  violet: { background: 'linear-gradient(90deg, #8f7cff, #5d4bff)' }
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    position: 'relative',
    minHeight: '100vh',
    padding: '32px',
    color: '#f5f7ff',
    background: 'radial-gradient(circle at top, #1b2248 0%, #0a1024 45%, #060913 100%)',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  },
  backgroundGlowA: {
    position: 'absolute',
    inset: '0 auto auto -10%',
    width: '420px',
    height: '420px',
    background: 'radial-gradient(circle, rgba(85,230,255,0.22) 0%, rgba(85,230,255,0) 70%)',
    pointerEvents: 'none'
  },
  backgroundGlowB: {
    position: 'absolute',
    inset: '15% -5% auto auto',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(143,124,255,0.20) 0%, rgba(143,124,255,0) 70%)',
    pointerEvents: 'none'
  },
  header: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    gap: '24px',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  kicker: {
    color: '#7de8ff',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.78rem',
    fontWeight: 700,
    marginBottom: '12px'
  },
  title: {
    margin: 0,
    fontSize: '3rem',
    lineHeight: 1.02
  },
  subtitle: {
    maxWidth: '720px',
    color: '#c9d4ff',
    fontSize: '1.05rem',
    marginTop: '14px',
    lineHeight: 1.6
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 18px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#f7fbff',
    textTransform: 'capitalize',
    fontWeight: 700
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#44d7b6',
    boxShadow: '0 0 18px rgba(68,215,182,0.7)'
  },
  nav: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px'
  },
  navButton: {
    background: 'rgba(255,255,255,0.05)',
    color: '#eaf0ff',
    border: '1px solid rgba(255,255,255,0.12)',
    padding: '12px 18px',
    borderRadius: '16px',
    cursor: 'pointer',
    fontWeight: 700,
    outlineOffset: '3px'
  },
  navButtonActive: {
    background: 'linear-gradient(135deg, rgba(85,230,255,0.22), rgba(143,124,255,0.25))',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    border: '1px solid rgba(125,232,255,0.45)'
  },
  main: {
    position: 'relative',
    zIndex: 1
  },
  section: {
    display: 'grid',
    gap: '24px'
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
    gap: '24px'
  },
  heroCopy: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '28px',
    padding: '28px'
  },
  badge: {
    display: 'inline-block',
    padding: '8px 14px',
    borderRadius: '999px',
    background: 'rgba(255,204,102,0.16)',
    color: '#ffdc8d',
    fontWeight: 700,
    marginBottom: '18px'
  },
  heroTitle: {
    margin: 0,
    fontSize: '2rem',
    lineHeight: 1.14
  },
  heroText: {
    color: '#d3dcff',
    lineHeight: 1.7,
    marginTop: '16px'
  },
  heroPanel: {
    borderRadius: '28px',
    padding: '28px',
    background: 'linear-gradient(160deg, rgba(85,230,255,0.12), rgba(143,124,255,0.16))',
    border: '1px solid rgba(125,232,255,0.2)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  heroPanelLabel: {
    color: '#9bc8ff',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.78rem'
  },
  heroPanelValue: {
    fontSize: '2.2rem',
    fontWeight: 800,
    margin: '10px 0'
  },
  heroPanelMeta: {
    color: '#d3dcff',
    lineHeight: 1.6
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '18px'
  },
  metricCard: {
    borderRadius: '22px',
    padding: '22px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  metricTitle: {
    color: '#a9bbff',
    marginBottom: '10px'
  },
  metricValue: {
    fontSize: '2rem',
    fontWeight: 800
  },
  metricBar: {
    height: '8px',
    borderRadius: '999px',
    marginTop: '18px'
  },
  dualGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px'
  },
  panel: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '24px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  panelTitle: {
    marginTop: 0,
    marginBottom: '14px'
  },
  panelBody: {
    color: '#d3dcff',
    lineHeight: 1.7
  },
  featureList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#d3dcff',
    lineHeight: 1.8
  },
  definitionList: {
    display: 'grid',
    gap: '12px',
    margin: 0
  },
  definitionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    paddingBottom: '10px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  commandList: {
    display: 'grid',
    gap: '12px'
  },
  commandItem: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '16px',
    alignItems: 'center',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '16px'
  },
  commandMeta: {
    color: '#98abef',
    marginTop: '4px'
  },
  commandFlags: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  commandFlag: {
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.08)',
    color: '#ecf2ff',
    fontSize: '0.85rem'
  },
  swatchRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '14px',
    marginTop: '16px'
  },
  swatchCard: {
    display: 'grid',
    gap: '10px'
  },
  swatch: {
    height: '72px',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.1)'
  }
}
