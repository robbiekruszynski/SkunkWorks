import { useState } from 'react'

const S = {
  wrap: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: '#000814',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 18,
  },
  line: {
    width: 340, height: 1,
    background: 'linear-gradient(to right, transparent, #00ccff, transparent)',
  },
  title: {
    fontSize: 18, color: '#00ccff', letterSpacing: '0.3em',
    textShadow: '0 0 20px #00ccff',
  },
  sub: { fontSize: 9, color: '#2a5a7a', letterSpacing: '0.22em' },
  msg: { fontSize: 9, color: '#00ccff88', letterSpacing: '0.12em', minHeight: 14 },
  btn: {
    marginTop: 8, padding: '11px 32px',
    background: 'transparent', border: '1px solid #00ccff',
    color: '#00ccff', fontFamily: "'Courier New', monospace",
    fontSize: 10, letterSpacing: '0.2em', cursor: 'pointer',
    textShadow: '0 0 8px #00ccff',
    boxShadow: '0 0 14px rgba(0,204,255,0.25), inset 0 0 14px rgba(0,204,255,0.05)',
  },
  hint: { fontSize: 7, color: '#1a4a5a', letterSpacing: '0.12em' },
}

export default function Gate({ onActivate }) {
  const [msg, setMsg] = useState('AWAITING OPERATOR AUTHENTICATION')
  const [busy, setBusy] = useState(false)

  async function activate() {
    setBusy(true)
    setMsg('REQUESTING CAMERA ACCESS...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      })
      onActivate(stream)
    } catch (err) {
      setMsg('CAMERA DENIED — LAUNCHING IN MOUSE MODE')
      setTimeout(() => onActivate(null), 1600)
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.line} />
      <div style={S.title}>TACTILE GRAPH INTERFACE</div>
      <div style={S.sub}>▸ GESTURE-DRIVEN KNOWLEDGE SYSTEM ◂</div>
      <div style={S.line} />
      <div style={S.msg}>{msg}</div>
      <button style={S.btn} onClick={activate} disabled={busy}>
        ◉ ACTIVATE TRACKING
      </button>
      <div style={S.hint}>REQUIRES CAMERA ACCESS FOR HAND TRACKING</div>
      <div style={{ ...S.hint, color: '#004455' }}>MOUSE + SCROLL ALWAYS AVAILABLE AS FALLBACK</div>
    </div>
  )
}
