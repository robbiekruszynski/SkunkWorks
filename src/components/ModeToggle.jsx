const S = {
  wrap: {
    position: 'fixed', bottom: 44, right: 16, zIndex: 10,
    display: 'flex',
    border: '1px solid #00ccff44',
    boxShadow: '0 0 10px rgba(0,204,255,0.15)',
  },
  btn: (active) => ({
    padding: '6px 14px',
    fontFamily: "'Courier New', monospace",
    fontSize: 8, letterSpacing: '0.15em',
    background: active ? 'rgba(0,204,255,0.15)' : 'transparent',
    color: active ? '#00ccff' : '#1a5a70',
    textShadow: active ? '0 0 8px #00ccff' : 'none',
    border: 'none', cursor: 'pointer',
  }),
}

export default function ModeToggle({ mode, onChange }) {
  return (
    <div style={S.wrap}>
      <button style={S.btn(mode === 'hand')}  onClick={() => onChange('hand')}>✋ HAND</button>
      <button style={S.btn(mode === 'mouse')} onClick={() => onChange('mouse')}>⌖ MOUSE</button>
    </div>
  )
}
