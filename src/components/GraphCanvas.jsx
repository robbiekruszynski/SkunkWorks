import { useRef, useEffect, useCallback } from 'react'
import { stepPhysics } from '../utils/physics.js'
import { isPinching, isApproachingPinch, pinchScreen, indexTipScreen } from '../utils/gestures.js'
import {
  w2s,
  drawSectionBodies, drawSectionLabels, drawSectionDockProgress, drawSectionLockFlash,
  drawConnectionFlash,
  drawDockRing, drawParentEdges, drawTagLinks, applyTagHighlights, drawNode,
  drawHandSkeleton, drawPinchRing, drawApproachRing, drawCursor, drawMouseCursor,
} from '../utils/draw.js'

const CONN_FLASH_MS    = 700
const SECTION_FLASH_MS = 600
const DOCK_MS          = 500

export default function GraphCanvas({ nodes, sections, handState, mode, videoRef, onNodeClick, onStatsUpdate, onConnect, onDisconnect, onSectionUpdate, onAssignSection }) {
  const canvasRef = useRef(null)

  const nodesRef = useRef(null)
  if (!nodesRef.current) {
    nodesRef.current = nodes.map(n => ({ ...n, vx: 0, vy: 0, pinned: false, grabbed: false, hovered: false }))
  }
  useEffect(() => {
    if (!nodesRef.current) return
    for (const n of nodes) {
      const r = nodesRef.current.find(r => r.id === n.id)
      if (r) {
        r.label = n.label; r.type = n.type; r.content = n.content
        r.tags = n.tags; r.data = n.data; r.role = n.role; r.parentIds = n.parentIds
        r.sectionId = n.sectionId
        if (!r.grabbed) r.anchored = !!n.sectionId
      }
    }
  }, [nodes])

  const sectionsRef = useRef(null)
  if (!sectionsRef.current) sectionsRef.current = sections.map(s => ({ ...s }))
  useEffect(() => {
    if (!sectionsRef.current) return
    for (const s of sections) {
      const r = sectionsRef.current.find(r => r.id === s.id)
      if (r) { r.label = s.label; r.color = s.color; r.x = s.x; r.y = s.y }
    }
  }, [sections])

  const camRef      = useRef({ x: 0, y: 0, zoom: 1 })
  const handRef     = useRef([])
  const modeRef     = useRef(mode)
  const mousePosRef = useRef({ x: -999, y: -999 })
  const zoomingRef  = useRef(false)
  const fpsRef      = useRef({ count: 0, fps: 0, last: Date.now() })

  const gestureRef = useRef({
    h: [
      { node: null, off: {x:0,y:0}, children: [], cOff: [] },
      { node: null, off: {x:0,y:0}, children: [], cOff: [] },
    ],
    panStart: null, panCamStart: null,
    prevPinchDist: null, prevPinchMid: null,
  })
  const mouseRef = useRef({
    down: false, node: null, pan: null, panCam: null,
    grabOff: {x:0,y:0}, downPos: {x:0,y:0},
    children: [], childOffsets: [],
    section: null, sectionMouseStart: null, sectionWorldStart: null,
    sectionNodes: [], sectionNodeOffsets: [],
  })

  // Card-to-card dock ring state — mode: 'connect' | 'detach'
  const dockRef = useRef({ target: null, startTime: null, mode: 'connect' })
  // Section dock bar state
  const sectionDockRef = useRef({ target: null, startTime: null })
  // Flash queues
  const connFlashRef    = useRef([]) // [{childId, parentId, time}]
  const sectionFlashRef = useRef([]) // [{sectionId, nodeId, time}]

  const onConnectRef       = useRef(onConnect)
  const onDisconnectRef    = useRef(onDisconnect)
  const onSectionUpdateRef = useRef(onSectionUpdate)
  const onAssignSectionRef = useRef(onAssignSection)
  useEffect(() => { onConnectRef.current       = onConnect       }, [onConnect])
  useEffect(() => { onDisconnectRef.current    = onDisconnect    }, [onDisconnect])
  useEffect(() => { onSectionUpdateRef.current = onSectionUpdate }, [onSectionUpdate])
  useEffect(() => { onAssignSectionRef.current = onAssignSection }, [onAssignSection])

  useEffect(() => { handRef.current = handState }, [handState])
  useEffect(() => {
    modeRef.current = mode
    const g = gestureRef.current
    g.h.forEach(h => {
      if (h.node) { h.node.pinned = false; h.node.grabbed = false; h.node = null }
      h.children.forEach(c => { c.pinned = false; c.grabbed = false })
      h.children = []; h.cOff = []
    })
    g.panStart = null
    nodesRef.current?.forEach(n => { n.hovered = false })
    const m = mouseRef.current
    if (m.node) { m.node.pinned = false; m.node.grabbed = false; m.node = null }
    m.down = false; m.pan = null; m.section = null
  }, [mode])

  const getChildren = useCallback((parent, ns) => {
    return ns.filter(n => n.parentIds && n.parentIds.includes(parent.id))
  }, [])

  const checkDock = useCallback((dragged, excludes, cw, ch) => {
    const cam  = camRef.current
    const ns   = nodesRef.current
    const dock = dockRef.current
    const ds   = w2s(dragged.x, dragged.y, cam, cw, ch)

    let hit = null, hitMode = 'connect'
    for (const n of ns) {
      if (n === dragged || excludes.includes(n)) continue
      const ts = w2s(n.x, n.y, cam, cw, ch)
      if (Math.hypot(ds.x - ts.x, ds.y - ts.y) < 160) {
        if (dragged.parentIds && dragged.parentIds.includes(n.id)) {
          hit = n; hitMode = 'detach'
        } else {
          hit = n; hitMode = 'connect'
        }
        break
      }
    }

    if (hit) {
      if (dock.target !== hit) {
        // Hysteresis: if the timer is already well underway, don't reset just
        // because jitter briefly makes a different node appear closer.
        const elapsed = dock.startTime ? Date.now() - dock.startTime : Infinity
        if (elapsed < 200) {
          if (dock.target) dock.target.pinned = false
          dock.target = hit; dock.startTime = Date.now(); dock.mode = hitMode
          hit.pinned = true
        }
        // else keep the existing timer running against the original target
      } else if (Date.now() - dock.startTime >= DOCK_MS) {
        hit.pinned = false
        const childId = dragged.id, parentId = hit.id

        if (dock.mode === 'detach') {
          dragged.parentIds = (dragged.parentIds || []).filter(id => id !== parentId)
          if (dragged.parentIds.length === 0) dragged.role = 'standalone'
          onDisconnectRef.current?.(childId, parentId)
        } else {
          dragged.role = 'child'
          if (!dragged.parentIds) dragged.parentIds = []
          if (!dragged.parentIds.includes(parentId)) dragged.parentIds.push(parentId)
          if (hit.role !== 'parent') hit.role = 'parent'
          onConnectRef.current?.(childId, parentId)
          connFlashRef.current.push({ childId, parentId, time: Date.now() })
        }
        dock.target = null; dock.startTime = null; dock.mode = 'connect'
      }
    } else {
      if (dock.target) dock.target.pinned = false
      dock.target = null; dock.startTime = null; dock.mode = 'connect'
    }
  }, [])

  const resetDock = useCallback(() => {
    if (dockRef.current.target) dockRef.current.target.pinned = false
    dockRef.current.target = null; dockRef.current.startTime = null; dockRef.current.mode = 'connect'
  }, [])

  const checkSectionDock = useCallback((dragged, cw, ch) => {
    const dock = sectionDockRef.current

    let hit = null
    for (const s of sectionsRef.current) {
      if (dragged.sectionId === s.id) continue
      if (dragged.x >= s.x && dragged.x <= s.x + s.width &&
          dragged.y >= s.y && dragged.y <= s.y + s.height) { hit = s; break }
    }

    if (hit) {
      if (dock.target !== hit) {
        dock.target = hit; dock.startTime = Date.now()
      } else if (Date.now() - dock.startTime >= DOCK_MS) {
        dragged.sectionId = hit.id
        dragged.anchored  = true
        onAssignSectionRef.current?.(dragged.id, hit.id)
        sectionFlashRef.current.push({ sectionId: hit.id, nodeId: dragged.id, time: Date.now() })
        dock.target = null; dock.startTime = null
      }
    } else {
      dock.target = null; dock.startTime = null
    }
  }, [])

  const resetSectionDock = useCallback(() => {
    sectionDockRef.current.target = null
    sectionDockRef.current.startTime = null
  }, [])

  const processHands = useCallback((hs, cw, ch) => {
    const cam = camRef.current
    const g   = gestureRef.current
    const ns  = nodesRef.current
    const sp2w = sp => ({ x: (sp.x - cw/2 - cam.x)/cam.zoom, y: (sp.y - ch/2 - cam.y)/cam.zoom })
    const scr  = n  => w2s(n.x, n.y, cam, cw, ch)

    zoomingRef.current = false

    ns.forEach(n => { n.hovered = false })
    for (const h of hs) {
      if (!isPinching(h.lms)) {
        const tip = indexTipScreen(h.lms, cw, ch)
        for (const n of ns) { if (Math.hypot(tip.x - scr(n).x, tip.y - scr(n).y) < 80) n.hovered = true }
      }
    }

    if (hs.length === 2 && isPinching(hs[0].lms) && isPinching(hs[1].lms) && !g.h[0].node && !g.h[1].node) {
      zoomingRef.current = true
      const sA = pinchScreen(hs[0].lms, cw, ch), sB = pinchScreen(hs[1].lms, cw, ch)
      const d   = Math.hypot(sA.x-sB.x, sA.y-sB.y)
      const mid = { x:(sA.x+sB.x)/2, y:(sA.y+sB.y)/2 }
      if (g.prevPinchDist !== null) {
        const ratio = d/g.prevPinchDist, wb = sp2w(mid)
        cam.zoom = Math.min(8, Math.max(0.1, cam.zoom*ratio))
        const sa = w2s(wb.x, wb.y, cam, cw, ch)
        cam.x += mid.x - sa.x; cam.y += mid.y - sa.y
        if (g.prevPinchMid) { cam.x += mid.x - g.prevPinchMid.x; cam.y += mid.y - g.prevPinchMid.y }
      }
      g.prevPinchDist = d; g.prevPinchMid = mid
      g.panStart = null; return
    }
    g.prevPinchDist = null; g.prevPinchMid = null

    for (let i = 0; i < 2; i++) {
      const h = hs[i]
      const s = g.h[i]

      if (!h) {
        if (s.node) {
          const n = s.node
          n.grabbed = false; n.vx = 0; n.vy = 0
          const sec = sectionsRef.current.find(sec => sec.id === n.sectionId)
          if (n.sectionId && sec && n.x >= sec.x && n.x <= sec.x + sec.width && n.y >= sec.y && n.y <= sec.y + sec.height) {
            n.pinned = false; n.anchored = true
          } else if (n.sectionId) {
            n.sectionId = null; n.pinned = false; n.anchored = false
            onAssignSectionRef.current?.(n.id, null)
          } else {
            n.pinned = false; n.anchored = false
          }
          s.children.forEach(c => {
            c.grabbed = false; c.vx = 0; c.vy = 0; c.pinned = false
            c.anchored = !!c.sectionId
          })
          s.children=[]; s.cOff=[]; s.node=null
          resetDock(); resetSectionDock()
        }
        if (i === 0) g.panStart = null
        continue
      }

      const pinch = isPinching(h.lms)
      const sp = pinchScreen(h.lms, cw, ch), wp = sp2w(sp)

      if (pinch) {
        if (!s.node) {
          const otherNode = g.h[1 - i].node
          let best = null, bestD = Infinity
          for (const n of ns) {
            if (n === otherNode) continue
            const p = scr(n), d = Math.hypot(sp.x - p.x, sp.y - p.y)
            if (d < 120 && d < bestD) { best = n; bestD = d }
          }
          if (best) {
            s.node = best; best.pinned = true; best.grabbed = true; best.anchored = false
            s.off = { x: best.x - wp.x, y: best.y - wp.y }
            s.children = getChildren(best, ns)
            s.cOff = s.children.map(c => ({ x: c.x - best.x, y: c.y - best.y }))
            s.children.forEach(c => { c.pinned = true; c.grabbed = true; c.anchored = false })
          } else if (i === 0 && !g.panStart) {
            g.panStart = { x: sp.x, y: sp.y }; g.panCamStart = { x: cam.x, y: cam.y }
          }
        }
        if (s.node) {
          s.node.x = wp.x + s.off.x; s.node.y = wp.y + s.off.y
          s.children.forEach((c, j) => { c.x = s.node.x + s.cOff[j].x; c.y = s.node.y + s.cOff[j].y })
          checkDock(s.node, s.children, cw, ch)
          checkSectionDock(s.node, cw, ch)
        } else if (i === 0 && g.panStart) {
          cam.x = g.panCamStart.x + (sp.x - g.panStart.x)
          cam.y = g.panCamStart.y + (sp.y - g.panStart.y)
        }
      } else {
        if (s.node) {
          const n = s.node
          n.grabbed = false; n.vx = 0; n.vy = 0
          const sec = sectionsRef.current.find(sec => sec.id === n.sectionId)
          if (n.sectionId && sec && n.x >= sec.x && n.x <= sec.x + sec.width && n.y >= sec.y && n.y <= sec.y + sec.height) {
            n.pinned = false; n.anchored = true
          } else if (n.sectionId) {
            n.sectionId = null; n.pinned = false; n.anchored = false
            onAssignSectionRef.current?.(n.id, null)
          } else {
            n.pinned = false; n.anchored = false
          }
          s.children.forEach(c => {
            c.grabbed = false; c.vx = 0; c.vy = 0; c.pinned = false
            c.anchored = !!c.sectionId
          })
          s.children=[]; s.cOff=[]; s.node=null
          resetDock(); resetSectionDock()
        }
        if (i === 0) g.panStart = null
      }
    }
  }, [getChildren, checkDock, resetDock, checkSectionDock, resetSectionDock])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let rafId

    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const nodeInSection = (n, s) => n.x >= s.x && n.x <= s.x + s.width && n.y >= s.y && n.y <= s.y + s.height

    function frame() {
      const cw = canvas.width, ch = canvas.height
      const cam = camRef.current
      const now = Date.now()

      const f = fpsRef.current
      f.count++
      if (now - f.last > 900) {
        f.fps = Math.round(f.count * 1000 / (now - f.last))
        f.count = 0; f.last = now
        const grabbed = mouseRef.current.node || gestureRef.current.h[0].node || gestureRef.current.h[1].node
        onStatsUpdate({ fps: f.fps, zoom: cam.zoom, grabbedNode: grabbed, panActive: !!gestureRef.current.panStart })
      }

      ctx.clearRect(0, 0, cw, ch)
      ctx.fillStyle = 'rgba(0,4,16,0.42)'; ctx.fillRect(0, 0, cw, ch)

      if (modeRef.current === 'hand' && handRef.current.length > 0) processHands(handRef.current, cw, ch)

      const ns = nodesRef.current
      if (!zoomingRef.current) stepPhysics(ns, [])

      const dragged = mouseRef.current.node || gestureRef.current.h[0].node || gestureRef.current.h[1].node
      let activeSectionId = null
      if (dragged) {
        for (const s of sectionsRef.current) {
          if (nodeInSection(dragged, s)) { activeSectionId = s.id; break }
        }
      }

      // 1. Section backgrounds — behind everything
      drawSectionBodies(ctx, sectionsRef.current, activeSectionId, cam, cw, ch)

      // Section dock progress bar sits with the bodies
      const sdock = sectionDockRef.current
      if (sdock.target && sdock.startTime) {
        const p = Math.min(1, (now - sdock.startTime) / DOCK_MS)
        drawSectionDockProgress(ctx, sdock.target, p, cam, cw, ch)
      }

      // 2. Edges
      applyTagHighlights(ns)
      drawTagLinks(ctx, ns, cam, cw, ch)
      drawParentEdges(ctx, ns, cam, cw, ch)

      // 3. Nodes
      ns.forEach(n => drawNode(ctx, n, cam, cw, ch))

      // Card-to-card dock ring
      const dock = dockRef.current
      if (dock.target && dock.startTime) {
        const p = Math.min(1, (now - dock.startTime) / DOCK_MS)
        drawDockRing(ctx, dock.target, p, cam, cw, ch, dock.mode)
      }

      // Connection flash animations
      connFlashRef.current = connFlashRef.current.filter(f => now - f.time < CONN_FLASH_MS)
      for (const f of connFlashRef.current) {
        const nA = ns.find(n => n.id === f.childId)
        const nB = ns.find(n => n.id === f.parentId)
        if (nA && nB) drawConnectionFlash(ctx, nA, nB, (now - f.time) / CONN_FLASH_MS, cam, cw, ch)
      }

      // Section lock flash animations
      sectionFlashRef.current = sectionFlashRef.current.filter(f => now - f.time < SECTION_FLASH_MS)
      for (const f of sectionFlashRef.current) {
        const sec = sectionsRef.current.find(s => s.id === f.sectionId)
        const nd  = ns.find(n => n.id === f.nodeId)
        if (sec && nd) drawSectionLockFlash(ctx, sec, nd, (now - f.time) / SECTION_FLASH_MS, cam, cw, ch)
      }

      // 4. Section labels — drawn last so they always render above node cards
      drawSectionLabels(ctx, sectionsRef.current, cam, cw, ch)

      if (modeRef.current === 'hand') {
        for (const h of handRef.current) {
          const color = h.handedness === 'Left' ? '#00aaff' : '#00ff99'
          drawHandSkeleton(ctx, h.lms, color, cw, ch)
          if (isPinching(h.lms)) drawPinchRing(ctx, h.lms, color, cw, ch)
          else { drawApproachRing(ctx, h.lms, color, cw, ch); drawCursor(ctx, h.lms, color, cw, ch) }
        }
      }

      if (modeRef.current === 'mouse') {
        const mp = mousePosRef.current
        const grabbed = !!mouseRef.current.node || !!mouseRef.current.section
        drawMouseCursor(ctx, mp.x, mp.y, grabbed)
      }

      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [processHands, onStatsUpdate])

  useEffect(() => {
    const canvas = canvasRef.current

    const getWP = e => { const cam=camRef.current, cw=canvas.width, ch=canvas.height; return {x:(e.clientX-cw/2-cam.x)/cam.zoom, y:(e.clientY-ch/2-cam.y)/cam.zoom} }
    const getNS = n => w2s(n.x, n.y, camRef.current, canvas.width, canvas.height)

    const hitNode = e => {
      let best=null, bestD=Infinity
      for (const n of nodesRef.current) { const p=getNS(n), d=Math.hypot(e.clientX-p.x, e.clientY-p.y); if(d<90&&d<bestD){best=n;bestD=d} }
      return best
    }

    const hitSectionHeader = e => {
      const cam = camRef.current, cw = canvas.width, ch = canvas.height
      for (const s of sectionsRef.current) {
        const tl = w2s(s.x, s.y, cam, cw, ch)
        const br = w2s(s.x + s.width, s.y + s.height, cam, cw, ch)
        if (e.clientX >= tl.x && e.clientX <= br.x && e.clientY >= tl.y && e.clientY <= tl.y + 30) return s
      }
      return null
    }

    const nodeInSection = (n, s) => n.x >= s.x && n.x <= s.x + s.width && n.y >= s.y && n.y <= s.y + s.height

    function onMouseDown(e) {
      if (modeRef.current !== 'mouse') return
      const m = mouseRef.current
      m.down = true; m.downPos = { x: e.clientX, y: e.clientY }

      const sec = hitSectionHeader(e)
      if (sec) {
        m.section = sec
        m.sectionMouseStart = { x: e.clientX, y: e.clientY }
        m.sectionWorldStart = { x: sec.x, y: sec.y }
        m.sectionNodes = nodesRef.current.filter(n => n.sectionId === sec.id)
        m.sectionNodeOffsets = m.sectionNodes.map(n => ({ x: n.x - sec.x, y: n.y - sec.y }))
        m.sectionNodes.forEach(n => { n.pinned = true })
        return
      }

      const n = hitNode(e)
      if (n) {
        m.node = n; n.pinned = true; n.grabbed = true; n.anchored = false
        const wp = getWP(e); m.grabOff = { x: n.x - wp.x, y: n.y - wp.y }
        m.children = getChildren(n, nodesRef.current)
        m.childOffsets = m.children.map(c => ({ x: c.x - n.x, y: c.y - n.y }))
        m.children.forEach(c => { c.pinned = true; c.grabbed = true; c.anchored = false })
      } else {
        m.pan = { x: e.clientX, y: e.clientY }; m.panCam = { x: camRef.current.x, y: camRef.current.y }
      }
    }

    function onMouseMove(e) {
      if (modeRef.current !== 'mouse') return
      const m = mouseRef.current
      mousePosRef.current = { x: e.clientX, y: e.clientY }
      nodesRef.current.forEach(n => { n.hovered = false })
      const h = hitNode(e); if (h) h.hovered = true

      if (m.section) {
        const dx = (e.clientX - m.sectionMouseStart.x) / camRef.current.zoom
        const dy = (e.clientY - m.sectionMouseStart.y) / camRef.current.zoom
        m.section.x = m.sectionWorldStart.x + dx
        m.section.y = m.sectionWorldStart.y + dy
        m.sectionNodes.forEach((n, i) => {
          n.x = m.section.x + m.sectionNodeOffsets[i].x
          n.y = m.section.y + m.sectionNodeOffsets[i].y
        })
        return
      }

      if (!m.down) return
      const wp = getWP(e)
      if (m.node) {
        m.node.x = wp.x + m.grabOff.x; m.node.y = wp.y + m.grabOff.y
        m.children.forEach((c, i) => { c.x = m.node.x + m.childOffsets[i].x; c.y = m.node.y + m.childOffsets[i].y })
        checkDock(m.node, m.children, canvas.width, canvas.height)
        checkSectionDock(m.node, canvas.width, canvas.height)
      } else if (m.pan) {
        camRef.current.x = m.panCam.x + e.clientX - m.pan.x
        camRef.current.y = m.panCam.y + e.clientY - m.pan.y
      }
    }

    function onMouseUp(e) {
      if (modeRef.current !== 'mouse') return
      const m = mouseRef.current

      if (m.section) {
        m.sectionNodes.forEach(n => { n.pinned = false; n.anchored = true })
        onSectionUpdateRef.current?.(m.section.id, m.section.x, m.section.y)
        m.section = null; m.sectionNodes = []; m.sectionNodeOffsets = []
        m.down = false; return
      }

      const dist = Math.hypot(e.clientX - m.downPos.x, e.clientY - m.downPos.y)
      if (dist < 5 && m.node) onNodeClick(m.node.id)
      m.down = false
      if (m.node) {
        const n = m.node
        n.grabbed = false; n.vx = 0; n.vy = 0
        const sec = sectionsRef.current.find(s => s.id === n.sectionId)
        if (n.sectionId && sec && nodeInSection(n, sec)) {
          n.pinned = false; n.anchored = true
        } else if (n.sectionId) {
          n.sectionId = null; n.pinned = false; n.anchored = false
          onAssignSectionRef.current?.(n.id, null)
        } else {
          n.pinned = false; n.anchored = false
        }
        m.children.forEach(c => {
          c.grabbed = false; c.vx = 0; c.vy = 0; c.pinned = false
          c.anchored = !!c.sectionId
        })
        m.children=[]; m.childOffsets=[]; m.node=null
        resetDock(); resetSectionDock()
      }
      m.pan = null
    }

    function onWheel(e) {
      if (modeRef.current !== 'mouse') return
      e.preventDefault()
      const cam = camRef.current, cw = canvas.width, ch = canvas.height
      const factor = e.deltaY < 0 ? 1.12 : 0.90
      const wb = { x: (e.clientX - cw/2 - cam.x)/cam.zoom, y: (e.clientY - ch/2 - cam.y)/cam.zoom }
      cam.zoom = Math.min(8, Math.max(0.1, cam.zoom * factor))
      const sa = w2s(wb.x, wb.y, cam, cw, ch)
      cam.x += e.clientX - sa.x; cam.y += e.clientY - sa.y
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
  }, [onNodeClick, getChildren, checkDock, resetDock, checkSectionDock, resetSectionDock])

  return (
    <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 1, cursor: 'none' }} />
  )
}
