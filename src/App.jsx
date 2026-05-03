import { useState, useRef, useCallback, useEffect } from 'react'
import Gate        from './components/Gate.jsx'
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
  const [started,      setStarted]      = useState(false)
  const [mode,         setMode]         = useState('hand')
  const [debug,        setDebug]        = useState(true)
  const [editingId,    setEditingId]    = useState(null)
  const [nodes,        setNodes]        = useState(INIT_NODES)
  const [sections,     setSections]     = useState(INIT_SECTIONS)
  const [stats,        setStats]        = useState({ fps: 0, zoom: 1, grabbedNode: null, panActive: false })

  const videoRef    = useRef(null)
  const cameraReady = useRef(false)

  const handState = useHandTracking(videoRef, started && mode === 'hand')

  const onStatsUpdate = useCallback(s => setStats(s), [])
  const onNodeClick   = useCallback(id => setEditingId(id), [])

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

      {!started && <Gate onActivate={onActivate} />}

      {started && (
        <>
          <GraphCanvas
            nodes={nodes}
            sections={sections}
            handState={handState}
            mode={mode}
            videoRef={videoRef}
            onNodeClick={onNodeClick}
            onStatsUpdate={onStatsUpdate}
            onConnect={onConnect}
            onSectionUpdate={onSectionUpdate}
            onAssignSection={onAssignSection}
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
        </>
      )}

      {editingNode && (
        <NodeEditor
          node={editingNode}
          allNodes={nodes}
          onSave={saveNode}
          onClose={() => setEditingId(null)}
          onSwap={onSwap}
        />
      )}
    </>
  )
}
