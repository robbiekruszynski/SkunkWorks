import { useState, useRef, useCallback, useEffect } from 'react'
import Gate        from './components/Gate.jsx'
import Signals     from './components/Signals.jsx'
import GraphCanvas from './components/GraphCanvas.jsx'
import HUD         from './components/HUD.jsx'
import DebugPanel  from './components/DebugPanel.jsx'
import ModeToggle  from './components/ModeToggle.jsx'
import NodeEditor  from './components/NodeEditor.jsx'
import { useHandTracking } from './hooks/useHandTracking.js'
import { INITIAL_NODES, DEFAULT_SECTIONS } from './data/graphData.js'

const INIT_NODES    = INITIAL_NODES.map(n => ({ ...n }))
const INIT_SECTIONS = DEFAULT_SECTIONS.map(s => ({ ...s }))

export default function App() {
  // phase: 'gate' | 'signals' | 'board'
  const [phase,        setPhase]        = useState('gate')
  const [mode,         setMode]         = useState('hand')
  const [debug,        setDebug]        = useState(true)
  const [editingId,    setEditingId]    = useState(null)
  const [focusId,      setFocusId]      = useState(null)
  const [nodes,        setNodes]        = useState(INIT_NODES)
  const [sections,     setSections]     = useState(INIT_SECTIONS)
  const [stats,        setStats]        = useState({ fps: 0, zoom: 1, grabbedNode: null, panActive: false })

  const videoRef          = useRef(null)
  const cameraReady       = useRef(false)
  const pendingStreamRef  = useRef(null)

  const handState = useHandTracking(videoRef, phase === 'board' && mode === 'hand')

  const onStatsUpdate = useCallback(s => setStats(s), [])
  const onNodeClick   = useCallback(id => setEditingId(id), [])
  const onFocusNode   = useCallback(id => setFocusId(id),   [])

  useEffect(() => {
    const onKey = e => {
      if (e.key.toLowerCase() === 'd') setDebug(v => !v)
      if (e.key.toLowerCase() === 'm') setMode(v => v === 'hand' ? 'mouse' : 'hand')
      if (e.key === 'Escape') { setFocusId(null); setEditingId(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Gate → Signals: stash the camera stream and show the tutorial
  function onGateActivate(stream) {
    pendingStreamRef.current = stream
    setPhase('signals')
  }

  // Signals → Board: wire up the camera (if we have it) and start
  function onSignalsInitiate() {
    const stream = pendingStreamRef.current
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
      cameraReady.current = true
      setMode('hand')
    } else {
      cameraReady.current = false
      setMode('mouse')
    }
    setPhase('board')
  }

  function saveNode(updated) {
    setNodes(prev => prev.map(n => n.id === updated.id ? updated : n))
  }

  function onConnect(childId, parentId) {
    setNodes(prev => prev.map(n => {
      if (n.id === childId) {
        const ids = n.parentIds || []
        return { ...n, role: 'child', parentIds: ids.includes(parentId) ? ids : [...ids, parentId] }
      }
      if (n.id === parentId && n.role !== 'parent') return { ...n, role: 'parent' }
      return n
    }))
  }

  function onDisconnect(childId, parentId) {
    setNodes(prev => prev.map(n => {
      if (n.id === childId) {
        const newParentIds = (n.parentIds || []).filter(id => id !== parentId)
        return { ...n, parentIds: newParentIds, role: newParentIds.length === 0 ? 'standalone' : 'child' }
      }
      if (n.id === parentId) {
        const stillHasChildren = prev.some(c => c.id !== childId && (c.parentIds || []).includes(parentId))
        if (!stillHasChildren) return { ...n, role: 'standalone' }
      }
      return n
    }))
  }

  function onSwap(nodeId, parentNodeId) {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        const newIds = (n.parentIds || []).filter(id => id !== parentNodeId)
        return { ...n, role: newIds.length === 0 ? 'parent' : 'child', parentIds: newIds }
      }
      if (n.id === parentNodeId) {
        const newIds = [...(n.parentIds || []), nodeId]
        return { ...n, role: 'child', parentIds: newIds }
      }
      return n
    }))
  }

  function onSectionUpdate(id, x, y) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, x, y } : s))
  }

  function onAssignSection(nodeId, sectionId) {
    setNodes(prev => {
      const children = prev.filter(n => (n.parentIds || []).includes(nodeId)).map(n => n.id)
      return prev.map(n => {
        if (n.id === nodeId || children.includes(n.id)) return { ...n, sectionId }
        return n
      })
    })
  }

  const editingNode = editingId !== null ? nodes.find(n => n.id === editingId) : null

  return (
    <>
      <video
        ref={videoRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', transform: 'scaleX(-1)',
          opacity: 0,
          filter: 'none',
          zIndex: 0,
          transition: 'opacity 0.6s',
          pointerEvents: 'none',
        }}
        playsInline muted autoPlay
      />

      {phase === 'gate'    && <Gate    onActivate={onGateActivate} />}
      {phase === 'signals' && <Signals onInitiate={onSignalsInitiate} hasCamera={!!pendingStreamRef.current} />}

      {phase === 'board' && (
        <>
          <GraphCanvas
            nodes={nodes}
            sections={sections}
            handState={handState}
            mode={mode}
            videoRef={videoRef}
            onNodeClick={onNodeClick}
            onFocusNode={onFocusNode}
            onStatsUpdate={onStatsUpdate}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onSectionUpdate={onSectionUpdate}
            onAssignSection={onAssignSection}
            focusNodeId={focusId}
          />

          <HUD
            handState={handState}
            grabbedNode={stats.grabbedNode}
            panActive={stats.panActive}
            cameraReady={cameraReady.current}
            mode={mode}
            zoom={stats.zoom}
            nodeCount={nodes.length}
            edgeCount={nodes.reduce((sum, n) => sum + (n.parentIds?.length || 0), 0)}
            fps={stats.fps}
          />

          {debug && (
            <DebugPanel
              handState={handState}
              cameraReady={cameraReady.current}
            />
          )}

          <ModeToggle mode={mode} onChange={setMode} />

          {focusId !== null && (
            <button
              onClick={() => setFocusId(null)}
              style={{
                position: 'fixed', top: 16, left: 16, zIndex: 20,
                background: 'rgba(0,6,20,0.90)',
                border: '1px solid #00ccff55',
                color: '#00ccff',
                fontFamily: "'Courier New', monospace",
                fontSize: 10, letterSpacing: '0.18em',
                padding: '9px 18px',
                cursor: 'pointer',
                textShadow: '0 0 10px #00ccff',
                boxShadow: '0 0 14px rgba(0,204,255,0.18)',
              }}
            >
              ← BOARD
            </button>
          )}
        </>
      )}

      {phase === 'board' && editingNode && (
        <NodeEditor
          node={editingNode}
          allNodes={nodes}
          onSave={saveNode}
          onClose={() => setEditingId(null)}
          onSwap={onSwap}
          onDetach={onDisconnect}
        />
      )}
    </>
  )
}
