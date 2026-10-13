import { useState } from 'react'
import { Plus, Edit2, Check } from 'lucide-react'
import { PERSONAS } from '../data.js'

export default function PanelLibrary({ navigate }) {
  const [hoveredCard, setHoveredCard] = useState(null)

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Panel Library</div>
          <div className="page-subtitle">Saved roles you've created or edited. Use them in any rehearsal.</div>
        </div>
        <button className="btn btn-primary">
          <Plus size={14} /> Create role
        </button>
      </div>

      <div className="panel-cards-grid">
        {PERSONAS.map(p => (
          <div
            key={p.id}
            className="panel-card"
            onMouseEnter={() => setHoveredCard(p.id)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            {/* Color bar */}
            <div className="panel-card-top" style={{ background: p.color }} />

            <div className="panel-card-body">
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: `2px solid ${p.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem',
                      color: p.color,
                    }}>
                      {p.initial}
                    </div>
                    <div>
                      <div className="panel-card-role">{p.role}</div>
                    </div>
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px',
                  borderRadius: 99,
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: `${p.color}14`,
                  color: p.color,
                  whiteSpace: 'nowrap',
                }}>
                  Built-in
                </div>
              </div>

              {/* Cares */}
              <div className="panel-card-cares-label">Focuses on</div>
              <ul className="panel-card-cares-list">
                {p.cares.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>

              {/* Conviction conditions */}
              <div className="panel-card-conditions-label">Conviction conditions</div>
              {p.conditions.map(c => (
                <div key={c.id} className="panel-card-condition">
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `1.5px solid ${p.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, opacity: 0.5 }} />
                  </div>
                  {c.text}
                </div>
              ))}
            </div>

            <div className="panel-card-footer">
              <button
                className="btn btn-secondary btn-sm"
                style={{ gap: 6 }}
              >
                <Edit2 size={12} /> Edit role
              </button>
            </div>
          </div>
        ))}

        {/* Custom role card */}
        <div className="panel-card-add panel-card" style={{ minHeight: 220, cursor: 'pointer' }}>
          <Plus size={24} style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Create a custom role
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: 200 }}>
            Define a persona with specific concerns, speaking style, and conviction conditions.
          </div>
        </div>
      </div>
    </div>
  )
}
