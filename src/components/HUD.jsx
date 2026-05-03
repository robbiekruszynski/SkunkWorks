import { isPinching } from '../utils/gestures.js'

const mono = "'Courier New', monospace"

const S = {
  // Corner bracket overlay (pure CSS, no canvas)
  corners: {
    position: 'fixed', inset: 8, pointerEvents: 'none', zIndex: 5,
    border: '1px solid transparent',
    outline: '0px solid transparent',
  },
  // Top bar
  topLeft: {
    position: 'fixed', top: 16, left: 16, zIndex: 5,
    fontFamily: mono, pointerEvents: 'none',
  },
  topRight: {
    position: 'fixed', top: 16, right: 16, zIndex: 5,
    fontFamily: mono, textAlign: 'right', pointerEvents: 'none',
  },
  title: { fontSize: 11, color: '#00ccff', textShadow: '0 0 8px #00ccff' },
  sub:   { fontSize: 8,  color: '#1a6080', marginTop: 4 },
  // Bottom bar
  bar: {
    position: 'fixed', bottom: 0, left: 0, right: 0, height: 32,
    background: 'rgba(0,6,20,0.80)',
    borderTop: '1px solid #00ccff22',
    display: 'flex', alignItems: 'center',
    padding: '0 16px', zIndex: 5, fontFamily: mono,
  },
  gesture: { fontSize: 8, color: '#00ccff', textShadow: '0 0 6px #00ccff' },
  // Scanlines
  scanlines: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4,
    background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
  },
  // Corner SVG overlay
  cornerSvg: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 5,
  },
}

function gestureHint(handState, grabbedNode, panActive, cameraReady, mode) {
  const bothPinching = handState.length === 2 && handState.every(h => isPinching(h.lms))
  if (mode === 'mouse') return '⟵ DRAG NODE   ✥ DRAG CANVAS TO PAN   SCROLL TO ZOOM'
  if (bothPinching)     return '⇔ ZOOM MODE — SPREAD HANDS TO ZOOM IN'
  if (grabbedNode)      return `◈ DRAGGING: ${grabbedNode.label}`
  if (panActive)        return '✥ PANNING VIEW'
  if (handState.length > 0) return '◇ POINT TO HOVER   ◈ PINCH TO GRAB   ◈◈ TWO-HAND PINCH TO ZOOM'
  if (cameraReady)      return '◻ RAISE A HAND TO INTERACT'
  return '◻ HAND TRACKING INITIALISING...'
}

export default function HUD({ handState, grabbedNode, panActive, cameraReady, mode, zoom, nodeCount, edgeCount, fps }) {
  const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  const hint = gestureHint(handState, grabbedNode, panActive, cameraReady, mode)

  return (
    <>
      {/* Scanlines */}
      <div style={S.scanlines} />

      {/* Corner brackets via SVG */}
      <svg style={S.cornerSvg} xmlns="http://www.w3.org/2000/svg">
        <g stroke="#00ccff44" strokeWidth="1.5" fill="none">
          {/* TL */}
          <polyline points="8,28 8,8 28,8" />
          {/* TR */}
          <polyline points={`${window.innerWidth - 28},8 ${window.innerWidth - 8},8 ${window.innerWidth - 8},28`} />
          {/* BL */}
          <polyline points={`8,${window.innerHeight - 28} 8,${window.innerHeight - 8} 28,${window.innerHeight - 8}`} />
          {/* BR */}
          <polyline points={`${window.innerWidth - 28},${window.innerHeight - 8} ${window.innerWidth - 8},${window.innerHeight - 8} ${window.innerWidth - 8},${window.innerHeight - 28}`} />
        </g>
      </svg>

      {/* Top-left */}
      <div style={S.topLeft}>
        <div style={S.title}>TACTILE GRAPH // INTEL LAYER</div>
        <div style={S.sub}>{ts}</div>
        <div style={S.sub}>NODES: {nodeCount}  │  EDGES: {edgeCount}  │  ZOOM: {Math.round(zoom * 100)}%</div>
      </div>

      {/* Top-right */}
      <div style={S.topRight}>
        <div style={{ ...S.title, color: cameraReady ? '#00ccff' : '#ffaa00' }}>
          {cameraReady ? '◉ TRACKING LIVE' : '◌ MOUSE MODE'}
        </div>
        <div style={S.sub}>HANDS: {handState.length}  │  FPS: {fps}</div>
      </div>

      {/* Bottom bar */}
      <div style={S.bar}>
        <span style={S.gesture}>{hint}</span>
      </div>
    </>
  )
}
