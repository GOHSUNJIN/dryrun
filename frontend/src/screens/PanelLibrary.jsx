import { useState } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { PERSONAS } from '../data.js'
import { loadCustomPersonas, addCustomPersona, updateCustomPersona, deleteCustomPersona } from '../utils/storage.js'

const CUSTOM_PALETTE = [
  { color: '#10B981', glow: 'rgba(16,185,129,0.22)', dimColor: 'rgba(16,185,129,0.35)' },
  { color: '#F43F5E', glow: 'rgba(244,63,94,0.22)',  dimColor: 'rgba(244,63,94,0.35)'  },
  { color: '#F97316', glow: 'rgba(249,115,22,0.22)', dimColor: 'rgba(249,115,22,0.35)' },
  { color: '#06B6D4', glow: 'rgba(6,182,212,0.22)',  dimColor: 'rgba(6,182,212,0.35)'  },
  { color: '#EC4899', glow: 'rgba(236,72,153,0.22)', dimColor: 'rgba(236,72,153,0.35)' },
  { color: '#84CC16', glow: 'rgba(132,204,22,0.22)', dimColor: 'rgba(132,204,22,0.35)' },
]

const EMPTY_FORM = { name: '', role: '', cares: '', speaking_style: '', cond1: '', cond2: '' }

function PersonaForm({ initial = EMPTY_FORM, onSave, onCancel, colorIdx = 0 }) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const palette = CUSTOM_PALETTE[colorIdx % CUSTOM_PALETTE.length]

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())          e.name = 'Required'
    if (!form.role.trim())          e.role = 'Required'
    if (!form.cares.trim())         e.cares = 'Required'
    if (!form.speaking_style.trim()) e.speaking_style = 'Required'
    if (!form.cond1.trim())         e.cond1 = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave(form, palette)
  }

  const inputStyle = (key) => ({ width: '100%', boxSizing: 'border-box', borderColor: errors[key] ? '#DC2626' : undefined })

  const field = (label, key, opts = {}) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {errors[key] && <span style={{ color: '#DC2626', fontWeight: 400 }}>{errors[key]}</span>}
      </div>
      {opts.textarea ? (
        <textarea
          className="settings-input"
          value={form[key]}
          onChange={set(key)}
          rows={opts.rows || 2}
          placeholder={opts.placeholder || ''}
          style={inputStyle(key)}
        />
      ) : (
        <input
          className="settings-input"
          value={form[key]}
          onChange={set(key)}
          placeholder={opts.placeholder || ''}
          style={inputStyle(key)}
        />
      )}
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 32, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {initial.name ? 'Edit role' : 'Create a custom role'}
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>Name</span>
              {errors.name && <span style={{ color: '#DC2626', fontWeight: 400 }}>{errors.name}</span>}
            </div>
            <input className="settings-input" value={form.name} onChange={set('name')} placeholder="Their first name" style={inputStyle('name')} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>Role title</span>
              {errors.role && <span style={{ color: '#DC2626', fontWeight: 400 }}>{errors.role}</span>}
            </div>
            <input className="settings-input" value={form.role} onChange={set('role')} placeholder="Their job title" style={inputStyle('role')} />
          </div>
        </div>

        {field('Main concerns', 'cares', { placeholder: 'What this persona cares about, comma-separated' })}
        {field('Speaking style', 'speaking_style', { textarea: true, rows: 3, placeholder: 'One or two sentences describing how they communicate and challenge.' })}

        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', margin: '20px 0 12px', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          Conditions met
          <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>What must the presenter explicitly say to satisfy this persona?</div>
        </div>
        {field('Condition 1', 'cond1', { placeholder: 'What must the presenter explicitly say to satisfy this persona?' })}
        {field('Condition 2 (optional)', 'cond2', { placeholder: 'A second condition, or leave blank' })}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Check size={13} /> {initial.name ? 'Save changes' : 'Create role'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PanelLibrary() {
  const [customPersonas, setCustomPersonas] = useState(loadCustomPersonas)
  const [showForm, setShowForm]             = useState(false)
  const [editingId, setEditingId]           = useState(null)

  const reload = () => setCustomPersonas(loadCustomPersonas())

  const handleCreate = (form, palette) => {
    const ts = Date.now()
    const conditions = [{ id: `c_${ts}_1`, text: form.cond1.trim() }]
    if (form.cond2.trim()) conditions.push({ id: `c_${ts}_2`, text: form.cond2.trim() })
    addCustomPersona({
      id: `custom_${ts}`,
      name: form.name.trim(),
      role: form.role.trim(),
      initial: form.name.trim()[0].toUpperCase(),
      cares: form.cares.trim(),
      speaking_style: form.speaking_style.trim(),
      conditions,
      custom: true,
      ...palette,
      panelPct: 50,
      glow: palette.glow,
      dimColor: palette.dimColor,
    })
    reload()
    setShowForm(false)
  }

  const handleEdit = (form, palette) => {
    const existing = customPersonas.find(p => p.id === editingId)
    const ts = Date.now()
    const conditions = [{ id: existing.conditions[0]?.id || `c_${ts}_1`, text: form.cond1.trim() }]
    if (form.cond2.trim()) conditions.push({ id: existing.conditions[1]?.id || `c_${ts}_2`, text: form.cond2.trim() })
    updateCustomPersona(editingId, {
      name: form.name.trim(),
      role: form.role.trim(),
      initial: form.name.trim()[0].toUpperCase(),
      cares: form.cares.trim(),
      speaking_style: form.speaking_style.trim(),
      conditions,
    })
    reload()
    setEditingId(null)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Remove this custom role?')) return
    deleteCustomPersona(id)
    reload()
  }

  const editingPersona = customPersonas.find(p => p.id === editingId)
  const editingInitial = editingPersona ? {
    name: editingPersona.name,
    role: editingPersona.role,
    cares: Array.isArray(editingPersona.cares) ? (editingPersona.cares[0] || '') : (editingPersona.cares || ''),
    speaking_style: editingPersona.speaking_style || '',
    cond1: editingPersona.conditions[0]?.text || '',
    cond2: editingPersona.conditions[1]?.text || '',
  } : EMPTY_FORM

  return (
    <div className="page">
      {(showForm || editingId) && (
        <PersonaForm
          initial={editingId ? editingInitial : EMPTY_FORM}
          colorIdx={customPersonas.length}
          onSave={editingId ? handleEdit : handleCreate}
          onCancel={() => { setShowForm(false); setEditingId(null) }}
        />
      )}

      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Panel Library</div>
          <div className="page-subtitle">The roles available to add to your rehearsals.</div>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Create role
        </button>
      </div>

      {customPersonas.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 16 }}>Custom roles</div>
          <div className="panel-cards-grid" style={{ marginBottom: 32 }}>
            {customPersonas.map((p, i) => (
              <div key={p.id} className="panel-card">
                <div className="panel-card-top" style={{ background: p.color }} />
                <div className="panel-card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        border: `2px solid ${p.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: p.color,
                        flexShrink: 0,
                      }}>{p.initial}</div>
                      <div>
                        <div className="panel-card-role">{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{p.role}</div>
                      </div>
                    </div>
                    <div style={{
                      padding: '3px 8px', borderRadius: 99, fontSize: '0.625rem',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: `${p.color}14`, color: p.color, whiteSpace: 'nowrap',
                    }}>Custom</div>
                  </div>
                  <div className="panel-card-cares-label">Focuses on</div>
                  <ul className="panel-card-cares-list">
                    {(p.cares || []).map((c, j) => <li key={j}>{c}</li>)}
                  </ul>
                  <div className="panel-card-conditions-label">Conditions met</div>
                  {(p.conditions || []).map(c => (
                    <div key={c.id} className="panel-card-condition">
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `1.5px solid ${p.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, opacity: 0.5 }} />
                      </div>
                      {c.text}
                    </div>
                  ))}
                </div>
                <div className="panel-card-footer" style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(p.id)} style={{ gap: 6 }}>
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDelete(p.id)}
                    style={{ gap: 6, color: '#DC2626', borderColor: 'rgba(220,38,38,0.25)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label" style={{ marginBottom: 16 }}>Built-in roles</div>
      <div className="panel-cards-grid">
        {PERSONAS.map(p => (
          <div key={p.id} className="panel-card">
            <div className="panel-card-top" style={{ background: p.color }} />
            <div className="panel-card-body">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: `2px solid ${p.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', color: p.color,
                    flexShrink: 0,
                  }}>{p.initial}</div>
                  <div>
                    <div className="panel-card-role">{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 1 }}>{p.role}</div>
                  </div>
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 99, fontSize: '0.625rem',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  background: `${p.color}14`, color: p.color, whiteSpace: 'nowrap',
                }}>Built-in</div>
              </div>
              <div className="panel-card-cares-label">Focuses on</div>
              <ul className="panel-card-cares-list">
                {p.cares.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              <div className="panel-card-conditions-label">Conditions met</div>
              {(p.conditions || []).map(c => (
                <div key={c.id} className="panel-card-condition">
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `1.5px solid ${p.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, opacity: 0.5 }} />
                  </div>
                  {c.text}
                </div>
              ))}
            </div>
            <div className="panel-card-footer">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Read-only</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
