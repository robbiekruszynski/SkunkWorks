import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Gate        from './components/Gate.jsx'
import GraphCanvas from './components/GraphCanvas.jsx'
import HUD         from './components/HUD.jsx'
import DebugPanel  from './components/DebugPanel.jsx'
import ModeToggle  from './components/ModeToggle.jsx'
import NodeEditor  from './components/NodeEditor.jsx'
import { useHandTracking } from './hooks/useHandTracking.js'
import { INITIAL_NODES, EDGES, computeTagEdges } from './data/graphData.js'

const INIT_NODES = INITIAL_NODES.map(n => ({ ...n }))

export default function App() {
  const [started,      setStarted]      = useState(false)
  const [mode,         setMode]         = useState('hand')
  const [debug,        setDebug]        = useState(true)
  const [editingId,    setEditingId]    = useState(null)
  const [nodes,        setNodes]        = useState(INIT_NODES)
  const [stats,        setStats]        = useState({ fps: 0, zoom: 1, grabbedNode: null, panActive: false })

  // videoRef always mounted so onActivate can attach stream immediately
  const videoRef    = useRef(null)
  const cameraReady = useRef(false)

  const handState = useHandTracking(videoRef, started && mode === 'hand')

  // Tag edges derived from node tags
  const tagEdges = useMemo(() => computeTagEdges(nodes), [nodes])

  const onStatsUpdate = useCallback(s => setStats(s), [])
  const onNodeClick   = useCallback(id => setEditingId(id), [])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = e => {
      if (e.key.toLowerCase() === 'd') setDebug(v => !v)
      if (e.key.toLowerCase() === 'm') setMode(v => v === 'hand' ? 'mouse' : 'hand')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function onActivate(stream) {
    if (stream && videoRef.current) {
      // videoRef.current is valid here because <video> is always rendered below
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
      cameraReady.current = true
      setMode('hand')
    } else {
      cameraReady.current = false
      setMode('mouse')
    }
    setStarted(true)
  }

  function saveNode(updated) {
    setNodes(prev => prev.map(n => n.id === updated.id ? updated : n))
  }

  const editingNode = editingId !== null ? nodes.find(n => n.id === editingId) : null

  return (
    <>
      {/* Video always mounted so videoRef is valid before Gate closes */}
      <video
        ref={videoRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)',
          opacity: started ? 0.28 : 0,
          filter: 'saturate(0.2) brightness(0.55) hue-rotate(180deg)',
          zIndex: 0,
          transition: 'opacity 0.6s',
          pointerEvents: 'none',
        }}
        playsInline muted autoPlay
      />

      {!started && <Gate onActivate={onActivate} />}

      {started && (
        <>
          <GraphCanvas
            nodes={nodes}
            tagEdges={tagEdges}
            handState={handState}
            mode={mode}
            videoRef={videoRef}
            onNodeClick={onNodeClick}
            onStatsUpdate={onStatsUpdate}
          />

          <HUD
            handState={handState}
            grabbedNode={stats.grabbedNode}
            panActive={stats.panActive}
            cameraReady={cameraReady.current}
            mode={mode}
            zoom={stats.zoom}
            nodeCount={nodes.length}
            edgeCount={EDGES.length + tagEdges.length}
            fps={stats.fps}
          />

          {debug && (
            <DebugPanel
              handState={handState}
              cameraReady={cameraReady.current}
            />
          )}

          <ModeToggle mode={mode} onChange={setMode} />
        </>
      )}

      {editingNode && (
        <NodeEditor
          node={editingNode}
          onSave={saveNode}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  )
}
