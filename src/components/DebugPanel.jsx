import { isPinching, isApproachingPinch, pinchDist, PINCH_THRESHOLD } from '../utils/gestures.js'

const S = {
  wrap: {
    position: 'fixed', top: 70, right: 16, zIndex: 10,
    background: 'rgba(0,6,20,0.88)',
    border: '1px solid #00ccff44',
    padding: '8px 10px',
    fontFamily: "'Courier New', monospace",
    fontSize: 8, lineHeight: '16px',
    minWidth: 220,
  },
  header: { color: '#00ccff55', marginBottom: 4 },
  row: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  label: { color: '#1a5a70' },
  val: (color) => ({ color: color || '#00ccff' }),
  divider: { color: '#00ccff33', marginTop: 4, marginBottom: 2 },
}

function stateColor(lms) {
  if (isPinching(lms))         return '#00ff99'
  if (isApproachingPinch(lms)) return '#ffaa00'
  return '#1a5a70'
}

function stateLabel(lms) {
  if (isPinching(lms))         return '◈ PINCHING'
  if (isApproachingPinch(lms)) return '◇ CLOSE'
  return '○ OPEN'
}

export default function DebugPanel({ handState, cameraReady }) {
  return (
    <div style={S.wrap}>
      <div style={S.header}>── HAND DEBUG (D to hide) ──</div>

      <div style={S.row}>
        <span style={S.label}>MEDIAPIPE</span>
        <span style={S.val(cameraReady ? '#00ff99' : '#ff5555')}>
          {cameraReady ? 'LIVE' : 'OFF'}
        </span>
      </div>
      <div style={S.row}>
        <span style={S.label}>HANDS DETECTED</span>
        <span style={S.val()}>{handState.length}</span>
      </div>

      {handState.map((h, i) => {
        const d = pinchDist(h.lms)
        const color = stateColor(h.lms)
        return (
          <div key={i}>
            <div style={{ ...S.divider }}>── HAND {i + 1} ({h.handedness}) ──</div>
            <div style={S.row}>
              <span style={S.label}>PINCH DIST</span>
              <span style={S.val(color)}>{d.toFixed(4)}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>THRESHOLD</span>
              <span style={S.val('#1a5a70')}>{PINCH_THRESHOLD.toFixed(4)}</span>
            </div>
            <div style={S.row}>
              <span style={S.label}>STATE</span>
              <span style={S.val(color)}>{stateLabel(h.lms)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
