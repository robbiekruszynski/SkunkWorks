import { useState, useEffect, useRef } from 'react'
import { NODE_TYPES, tagColor } from '../data/graphData.js'

const mono = "'Courier New', monospace"
const C = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 50,
    background: 'rgba(0,4,16,0.65)',
    backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    background: '#010c1e',
    border: '1px solid #00ccff55',
    boxShadow: '0 0 40px rgba(0,204,255,0.15), 0 0 0 1px #001a2e',
    width: 420, maxHeight: '80vh',
    display: 'flex', flexDirection: 'column',
    fontFamily: mono, color: '#c8d8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#000c1e',
    borderBottom: '1px solid #00ccff22',
  },
  nodeId: { fontSize: 8, color: '#00ccff88', letterSpacing: '0.15em' },
  closeBtn: {
    background: 'none', border: 'none', color: '#1a5a70',
    fontFamily: mono, fontSize: 14, cursor: 'pointer', padding: '0 4px',
    lineHeight: 1,
  },
  body: { padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  label: { fontSize: 7, color: '#00ccff88', letterSpacing: '0.2em', marginBottom: 5 },
  titleInput: {
    background: 'transparent', border: 'none', borderBottom: '1px solid #00ccff33',
    color: '#e8f4ff', fontFamily: mono, fontSize: 12, letterSpacing: '0.08em',
    padding: '4px 0', outline: 'none', width: '100%',
  },
  typeRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  typeBtn: (active, color) => ({
    padding: '3px 10px', fontSize: 7, letterSpacing: '0.12em',
    fontFamily: mono, cursor: 'pointer',
    background: active ? color + '22' : 'transparent',
    border: `1px solid ${active ? color : color + '44'}`,
    color: active ? color : color + '88',
  }),
  contentArea: {
    background: '#000814', border: '1px solid #00ccff22',
    color: '#8aaccc', fontFamily: mono, fontSize: 8, lineHeight: 1.8,
    padding: 10, resize: 'none', outline: 'none', width: '100%',
    minHeight: 90,
  },
  tagsWrap: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: (color) => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', fontSize: 8,
    background: color + '20', border: `1px solid ${color}66`,
    color: color,
  }),
  chipX: (color) => ({
    background: 'none', border: 'none', color: color + '99',
    cursor: 'pointer', fontFamily: mono, fontSize: 10,
    padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center',
  }),
  tagInput: {
    background: 'transparent', border: 'none', borderBottom: '1px solid #00ccff22',
    color: '#00ccff88', fontFamily: mono, fontSize: 8,
    padding: '2px 4px', outline: 'none', width: 100,
  },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    padding: '10px 16px', borderTop: '1px solid #00ccff11',
    background: '#000c1e',
  },
  saveBtn: {
    padding: '6px 20px', fontFamily: mono, fontSize: 8, letterSpacing: '0.15em',
    background: 'rgba(0,204,255,0.1)', border: '1px solid #00ccff',
    color: '#00ccff', cursor: 'pointer',
    textShadow: '0 0 8px #00ccff',
  },
  cancelBtn: {
    padding: '6px 14px', fontFamily: mono, fontSize: 8, letterSpacing: '0.15em',
    background: 'transparent', border: '1px solid #1a4a5a',
    color: '#1a5a70', cursor: 'pointer',
  },
}

import { PALETTE } from '../data/graphData.js'

export default function NodeEditor({ node, onSave, onClose }) {
  const [label,    setLabel]    = useState(node.label)
  const [type,     setType]     = useState(node.type)
  const [content,  setContent]  = useState(node.content || '')
  const [tags,     setTags]     = useState([...(node.tags || [])])
  const [tagInput, setTagInput] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') handleSave() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [label, type, content, tags])

  function addTag(raw) {
    const t = (raw || tagInput).trim().toLowerCase().replace(/[\s,]+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function removeTag(tag) { setTags(prev => prev.filter(t => t !== tag)) }

  function handleSave() {
    onSave({ ...node, label: label.trim() || node.label, type, content, tags })
    onClose()
  }

  // Stop clicks inside panel from hitting canvas
  function stopProp(e) { e.stopPropagation() }

  return (
    <div style={C.backdrop} onMouseDown={handleSave}>
      <div style={C.panel} onMouseDown={stopProp}>

        {/* Header */}
        <div style={C.header}>
          <span style={C.nodeId}>◈ NODE-{String(node.id).padStart(2,'0')} // EDIT MODE</span>
          <button style={C.closeBtn} onClick={handleSave} title="Save & close (Esc)">×</button>
        </div>

        <div style={C.body}>

          {/* Title */}
          <div>
            <div style={C.label}>TITLE</div>
            <input
              ref={inputRef}
              style={C.titleInput}
              value={label}
              onChange={e => setLabel(e.target.value.toUpperCase())}
              placeholder="NODE TITLE"
            />
          </div>

          {/* Type selector */}
          <div>
            <div style={C.label}>TYPE</div>
            <div style={C.typeRow}>
              {NODE_TYPES.map(t => (
                <button
                  key={t}
                  style={C.typeBtn(type === t, PALETTE[t].hi)}
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <div style={C.label}>NOTES</div>
            <textarea
              style={C.contentArea}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Add notes, context, or details..."
              rows={5}
            />
          </div>

          {/* Tags */}
          <div>
            <div style={C.label}>TAGS — shared tags create connections between nodes</div>
            <div style={C.tagsWrap}>
              {tags.map(tag => {
                const color = tagColor(tag)
                return (
                  <span key={tag} style={C.chip(color)}>
                    #{tag}
                    <button style={C.chipX(color)} onClick={() => removeTag(tag)}>×</button>
                  </span>
                )
              })}
              <input
                style={C.tagInput}
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
                  if (e.key === 'Backspace' && !tagInput && tags.length) removeTag(tags[tags.length - 1])
                }}
                placeholder="+ add tag ↵"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={C.footer}>
          <button style={C.cancelBtn} onClick={onClose}>DISCARD</button>
          <button style={C.saveBtn}   onClick={handleSave}>SAVE ▶</button>
        </div>

      </div>
    </div>
  )
}
