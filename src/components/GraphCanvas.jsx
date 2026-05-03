import { useRef, useEffect, useCallback } from 'react'
import { EDGES } from '../data/graphData.js'
import { stepPhysics } from '../utils/physics.js'
import { isPinching, isApproachingPinch, pinchScreen, indexTipScreen } from '../utils/gestures.js'
import { w2s, drawEdges, drawTagEdges, drawNode, drawHandSkeleton, drawPinchRing, drawApproachRing, drawCursor } from '../utils/draw.js'

export default function GraphCanvas({ nodes, tagEdges, handState, mode, videoRef, onNodeClick, onStatsUpdate }) {
  const canvasRef = useRef(null)

  // Physics working copy — initialized from nodes prop once, then mutated in place
  const nodesRef = useRef(null)
  if (!nodesRef.current) {
    nodesRef.current = nodes.map(n => ({ ...n, vx: 0, vy: 0, pinned: false, grabbed: false, hovered: false }))
  }

  // When nodes prop changes (content edits), sync non-physics fields into nodesRef
  useEffect(() => {
    if (!nodesRef.current) return
    for (const n of nodes) {
      const r = nodesRef.current.find(r => r.id === n.id)
      if (r) { r.label = n.label; r.type = n.type; r.content = n.content; r.tags = n.tags; r.data = n.data }
    }
  }, [nodes])

  const tagEdgesRef  = useRef(tagEdges)
  useEffect(() => { tagEdgesRef.current = tagEdges }, [tagEdges])

  const camRef   = useRef({ x: 0, y: 0, zoom: 1 })
  const handRef  = useRef([])
  const modeRef  = useRef(mode)
  const fpsRef   = useRef({ count: 0, fps: 0, last: Date.now() })

  const gestureRef = useRef({
    grabbedNode: null, grabOffset: { x:0,y:0 },
    panStart: null, panCamStart: null,
    prevPinchDist: null, prevPinchMid: null,
  })
  const mouseRef = useRef({ down: false, node: null, pan: null, panCam: null, grabOff: {x:0,y:0}, downPos: {x:0,y:0} })

  useEffect(() => { handRef.current = handState }, [handState])
  useEffect(() => {
    modeRef.current = mode
    const s = gestureRef.current
    if (s.grabbedNode) { s.grabbedNode.pinned = false; s.grabbedNode.grabbed = false; s.grabbedNode = null }
    nodesRef.current?.forEach(n => { n.hovered = false })
    s.panStart = null
    const m = mouseRef.current
    if (m.node) { m.node.pinned = false; m.node.grabbed = false; m.node = null }
    m.down = false; m.pan = null
  }, [mode])

  // ── Gesture processing ──────────────────────────────────────────
  const processHands = useCallback((hs, cw, ch) => {
    const cam = camRef.current
    const s   = gestureRef.current
    const ns  = nodesRef.current

    const sp2w = sp => ({ x: (sp.x - cw/2 - cam.x)/cam.zoom, y: (sp.y - ch/2 - cam.y)/cam.zoom })
    const scr  = n  => w2s(n.x, n.y, cam, cw, ch)

    ns.forEach(n => { n.hovered = false })
    for (const h of hs) {
      if (!isPinching(h.lms)) {
        const tip = indexTipScreen(h.lms, cw, ch)
        for (const n of ns) { if (Math.hypot(tip.x - scr(n).x, tip.y - scr(n).y) < 80) n.hovered = true }
      }
    }

    if (hs.length === 2 && isPinching(hs[0].lms) && isPinching(hs[1].lms)) {
      const sA = pinchScreen(hs[0].lms, cw, ch), sB = pinchScreen(hs[1].lms, cw, ch)
      const d  = Math.hypot(sA.x-sB.x, sA.y-sB.y)
      const mid = { x:(sA.x+sB.x)/2, y:(sA.y+sB.y)/2 }
      if (s.prevPinchDist !== null) {
        const ratio = d/s.prevPinchDist, wb = sp2w(mid)
        cam.zoom = Math.min(4, Math.max(0.25, cam.zoom*ratio))
        const sa = w2s(wb.x, wb.y, cam, cw, ch)
        cam.x += mid.x - sa.x; cam.y += mid.y - sa.y
        if (s.prevPinchMid) { cam.x += mid.x - s.prevPinchMid.x; cam.y += mid.y - s.prevPinchMid.y }
      }
      s.prevPinchDist = d; s.prevPinchMid = mid
      if (s.grabbedNode) { s.grabbedNode.pinned = false; s.grabbedNode.grabbed = false; s.grabbedNode = null }
      s.panStart = null; return
    }
    s.prevPinchDist = null; s.prevPinchMid = null

    if (hs.length >= 1) {
      const h = hs[0], pinch = isPinching(h.lms)
      const sp = pinchScreen(h.lms, cw, ch), wp = sp2w(sp)
      if (pinch) {
        if (!s.grabbedNode && !s.panStart) {
          let best = null, bestD = Infinity
          for (const n of ns) { const p = scr(n), d = Math.hypot(sp.x-p.x, sp.y-p.y); if (d<90&&d<bestD){best=n;bestD=d} }
          if (best) { s.grabbedNode=best; best.pinned=true; best.grabbed=true; s.grabOffset={x:best.x-wp.x,y:best.y-wp.y} }
          else { s.panStart={x:sp.x,y:sp.y}; s.panCamStart={x:cam.x,y:cam.y} }
        }
        if (s.grabbedNode) { s.grabbedNode.x=wp.x+s.grabOffset.x; s.grabbedNode.y=wp.y+s.grabOffset.y }
        else if (s.panStart) { cam.x=s.panCamStart.x+(sp.x-s.panStart.x); cam.y=s.panCamStart.y+(sp.y-s.panStart.y) }
      } else {
        if (s.grabbedNode) { s.grabbedNode.pinned=false; s.grabbedNode.grabbed=false; s.grabbedNode.vx=0; s.grabbedNode.vy=0; s.grabbedNode=null }
        s.panStart = null
      }
    } else {
      if (s.grabbedNode) { s.grabbedNode.pinned=false; s.grabbedNode.grabbed=false; s.grabbedNode=null }
      s.panStart = null
    }
  }, [])

  // ── rAF render loop ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let rafId

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    function frame() {
      const cw = canvas.width, ch = canvas.height
      const cam = camRef.current

      const f = fpsRef.current
      f.count++
      const now = Date.now()
      if (now - f.last > 900) {
        f.fps = Math.round(f.count * 1000 / (now - f.last))
        f.count = 0; f.last = now
        onStatsUpdate({ fps: f.fps, zoom: cam.zoom, grabbedNode: gestureRef.current.grabbedNode, panActive: !!gestureRef.current.panStart })
      }

      ctx.clearRect(0, 0, cw, ch)
      ctx.fillStyle = 'rgba(0,4,16,0.42)'; ctx.fillRect(0, 0, cw, ch)

      if (modeRef.current === 'hand' && handRef.current.length > 0) processHands(handRef.current, cw, ch)

      const ns = nodesRef.current
      stepPhysics(ns, EDGES)

      drawTagEdges(ctx, ns, tagEdgesRef.current, cam, cw, ch)
      drawEdges(ctx, ns, EDGES, cam, cw, ch)
      ns.forEach(n => drawNode(ctx, n, cam, cw, ch))

      if (modeRef.current === 'hand') {
        for (const h of handRef.current) {
          const color = h.handedness === 'Left' ? '#00aaff' : '#00ff99'
          drawHandSkeleton(ctx, h.lms, color, cw, ch)
          if (isPinching(h.lms)) drawPinchRing(ctx, h.lms, color, cw, ch)
          else { drawApproachRing(ctx, h.lms, color, cw, ch); drawCursor(ctx, h.lms, color, cw, ch) }
        }
      }

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [processHands, onStatsUpdate])

  // ── Mouse interaction ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current

    const getWP = e => { const cam=camRef.current, cw=canvas.width, ch=canvas.height; return {x:(e.clientX-cw/2-cam.x)/cam.zoom, y:(e.clientY-ch/2-cam.y)/cam.zoom} }
    const getNS = n => w2s(n.x, n.y, camRef.current, canvas.width, canvas.height)
    const hitNode = e => {
      let best=null, bestD=Infinity
      for (const n of nodesRef.current) { const p=getNS(n), d=Math.hypot(e.clientX-p.x, e.clientY-p.y); if(d<80&&d<bestD){best=n;bestD=d} }
      return best
    }

    function onMouseDown(e) {
      if (modeRef.current !== 'mouse') return
      const m = mouseRef.current
      m.down = true; m.downPos = { x: e.clientX, y: e.clientY }
      const n = hitNode(e)
      if (n) {
        m.node = n; n.pinned = true; n.grabbed = true
        const wp = getWP(e); m.grabOff = { x: n.x-wp.x, y: n.y-wp.y }
      } else {
        m.pan = { x: e.clientX, y: e.clientY }; m.panCam = { x: camRef.current.x, y: camRef.current.y }
      }
    }

    function onMouseMove(e) {
      if (modeRef.current !== 'mouse') return
      const m = mouseRef.current
      nodesRef.current.forEach(n => { n.hovered = false })
      const h = hitNode(e); if (h) h.hovered = true
      if (!m.down) return
      const wp = getWP(e)
      if (m.node) { m.node.x = wp.x+m.grabOff.x; m.node.y = wp.y+m.grabOff.y }
      else if (m.pan) { camRef.current.x = m.panCam.x+e.clientX-m.pan.x; camRef.current.y = m.panCam.y+e.clientY-m.pan.y }
    }

    function onMouseUp(e) {
      if (modeRef.current !== 'mouse') return
      const m = mouseRef.current
      // Click (not drag) → open editor
      const dist = Math.hypot(e.clientX-m.downPos.x, e.clientY-m.downPos.y)
      if (dist < 5 && m.node) onNodeClick(m.node.id)
      m.down = false
      if (m.node) { m.node.pinned=false; m.node.grabbed=false; m.node.vx=0; m.node.vy=0; m.node=null }
      m.pan = null
    }

    function onWheel(e) {
      if (modeRef.current !== 'mouse') return
      e.preventDefault()
      const cam=camRef.current, cw=canvas.width, ch=canvas.height
      const factor=e.deltaY<0?1.1:0.91, wb={x:(e.clientX-cw/2-cam.x)/cam.zoom, y:(e.clientY-ch/2-cam.y)/cam.zoom}
      cam.zoom = Math.min(4, Math.max(0.25, cam.zoom*factor))
      const sa = w2s(wb.x, wb.y, cam, cw, ch)
      cam.x += e.clientX-sa.x; cam.y += e.clientY-sa.y
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup',   onMouseUp)
    canvas.addEventListener('wheel',     onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup',   onMouseUp)
      canvas.removeEventListener('wheel',     onWheel)
    }
  }, [onNodeClick])

  return (
    <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 1, cursor: 'none' }} />
  )
}
