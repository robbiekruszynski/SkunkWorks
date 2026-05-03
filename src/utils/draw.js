import { PALETTE, tagColor } from '../data/graphData.js'
import { isPinching, isApproachingPinch, pinchDist, pinchScreen, indexTipScreen, PINCH_THRESHOLD } from './gestures.js'

export function w2s(wx, wy, cam, cw, ch) {
  return { x: wx * cam.zoom + cam.x + cw / 2, y: wy * cam.zoom + cam.y + ch / 2 }
}

export function drawSectionBodies(ctx, sections, activeSectionId, cam, cw, ch) {
  for (const s of sections) {
    const tl = w2s(s.x,           s.y,            cam, cw, ch)
    const br = w2s(s.x + s.width, s.y + s.height, cam, cw, ch)
    const sw = br.x - tl.x, sh = br.y - tl.y
    if (sw < 2 || sh < 2) continue

    const hot = s.id === activeSectionId

    ctx.save()

    ctx.fillStyle = hot ? s.color + '18' : s.color + '06'
    ctx.fillRect(tl.x, tl.y, sw, sh)

    ctx.fillStyle = hot ? s.color + 'cc' : s.color + '44'
    ctx.fillRect(tl.x, tl.y, sw, hot ? 3 : 2)

    ctx.fillStyle = hot ? s.color + '30' : s.color + '12'
    ctx.fillRect(tl.x,          tl.y + 3, 1, sh - 3)
    ctx.fillRect(tl.x + sw - 1, tl.y + 3, 1, sh - 3)

    ctx.restore()
  }
}

export function drawSectionLabels(ctx, sections, cam, cw, ch) {
  for (const s of sections) {
    const tl = w2s(s.x,           s.y, cam, cw, ch)
    const br = w2s(s.x + s.width, s.y, cam, cw, ch)
    const sw = br.x - tl.x
    if (sw < 2) continue

    const hh = 29

    ctx.save()

    // Opaque-ish backing so the label stays legible over any overlapping card
    ctx.fillStyle = 'rgba(0,4,16,0.82)'
    ctx.fillRect(tl.x, tl.y + 3, sw, hh)

    ctx.fillStyle = s.color + '18'
    ctx.fillRect(tl.x, tl.y + 3, sw, hh)

    ctx.font = '10px "Courier New"'
    ctx.fillStyle = s.color
    ctx.textAlign = 'left'
    ctx.shadowColor = s.color
    ctx.shadowBlur = 8
    ctx.fillText(s.label, tl.x + 10, tl.y + 21)

    ctx.restore()
  }
}

export function drawSectionDockProgress(ctx, section, progress, cam, cw, ch) {
  const tl = w2s(section.x,                 section.y, cam, cw, ch)
  const br = w2s(section.x + section.width, section.y, cam, cw, ch)
  const sw = br.x - tl.x

  ctx.save()
  ctx.fillStyle = section.color + '22'
  ctx.fillRect(tl.x, tl.y + 3, sw, 4)
  ctx.fillStyle = section.color
  ctx.shadowColor = section.color
  ctx.shadowBlur = 12
  ctx.fillRect(tl.x, tl.y + 3, sw * progress, 4)
  ctx.restore()
}

export function drawConnectionFlash(ctx, nodeA, nodeB, progress, cam, cw, ch) {
  const fade  = Math.max(0, 1 - progress)
  const sa    = w2s(nodeA.x, nodeA.y, cam, cw, ch)
  const sb    = w2s(nodeB.x, nodeB.y, cam, cw, ch)
  const dx    = sb.x - sa.x, dy = sb.y - sa.y
  const dist  = Math.hypot(dx, dy) || 1
  const mid   = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 }
  const perpX = (-dy / dist), perpY = (dx / dist)

  ctx.save()

  // Stage 1 (progress 0–0.55): electric arc with jitter
  if (progress < 0.55) {
    const beamFade = 1 - progress / 0.55
    const jAmt     = 12 * beamFade
    const segs     = 10
    const pts      = []
    for (let i = 0; i <= segs; i++) {
      const frac = i / segs
      const bx   = sa.x + dx * frac
      const by   = sa.y + dy * frac
      const jit  = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 2 * jAmt
      pts.push({ x: bx + perpX * jit, y: by + perpY * jit })
    }
    // Outer glow pass
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = `rgba(0,255,153,${beamFade * 0.35})`
    ctx.lineWidth = 10 * beamFade; ctx.shadowColor = '#00ff99'; ctx.shadowBlur = 28 * beamFade
    ctx.stroke()
    // Core beam
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.strokeStyle = `rgba(0,255,153,${beamFade * 0.9})`
    ctx.lineWidth = 2.5 * beamFade; ctx.shadowBlur = 14 * beamFade; ctx.stroke()
    // White hot core
    ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y)
    ctx.strokeStyle = `rgba(220,255,240,${beamFade * 0.55})`
    ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke()
  }

  // Stage 2: three expanding rings on both nodes at staggered radii
  for (const sp of [sa, sb]) {
    for (let ring = 0; ring < 3; ring++) {
      const delay  = ring * 0.12
      const rProg  = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)))
      const radius = 18 + rProg * (70 + ring * 22)
      const alpha  = fade * (0.7 - ring * 0.15) * (1 - rProg * 0.6)
      if (alpha <= 0) continue
      ctx.beginPath(); ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(0,255,153,${alpha})`
      ctx.lineWidth = 2 - ring * 0.4; ctx.shadowColor = '#00ff99'; ctx.shadowBlur = 18 * alpha
      ctx.stroke()
    }
  }

  // Stage 3: radial glow bloom at both nodes
  for (const sp of [sa, sb]) {
    const glowR = 90 * (0.3 + progress * 0.7)
    const grd   = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, glowR)
    grd.addColorStop(0,   `rgba(0,255,153,${fade * 0.55})`)
    grd.addColorStop(0.4, `rgba(0,200,255,${fade * 0.2})`)
    grd.addColorStop(1,   `rgba(0,255,153,0)`)
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(sp.x, sp.y, glowR, 0, Math.PI * 2); ctx.fill()
  }

  // Stage 4: particle burst from midpoint
  const numP = 14
  for (let i = 0; i < numP; i++) {
    const angle  = (i / numP) * Math.PI * 2
    const speed  = 35 + (i % 4) * 18
    const pFade  = Math.max(0, fade - 0.1)
    const px     = mid.x + Math.cos(angle) * speed * progress
    const py     = mid.y + Math.sin(angle) * speed * progress
    const radius = (i % 2 === 0) ? 2.2 : 1.2
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0,255,180,${pFade * 0.85})`
    ctx.shadowColor = '#00ffaa'; ctx.shadowBlur = 8
    ctx.fill()
  }

  // Stage 5: diamond flash at midpoint (early)
  if (progress < 0.3) {
    const df = 1 - progress / 0.3
    const ds = 16 * df
    ctx.beginPath()
    ctx.moveTo(mid.x, mid.y - ds); ctx.lineTo(mid.x + ds * 0.6, mid.y)
    ctx.lineTo(mid.x, mid.y + ds); ctx.lineTo(mid.x - ds * 0.6, mid.y)
    ctx.closePath()
    ctx.fillStyle = `rgba(150,255,220,${df * 0.7})`
    ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 20 * df
    ctx.fill()
  }

  ctx.restore()
}

export function drawSectionLockFlash(ctx, section, node, progress, cam, cw, ch) {
  const a = Math.max(0, 1 - progress)
  const tl = w2s(section.x,                 section.y, cam, cw, ch)
  const br = w2s(section.x + section.width, section.y, cam, cw, ch)
  const ns = w2s(node.x,                    node.y,    cam, cw, ch)
  const sw = br.x - tl.x

  ctx.save()
  ctx.fillStyle = section.color + Math.round(a * 0xcc).toString(16).padStart(2, '0')
  ctx.fillRect(tl.x, tl.y, sw, 3)

  const hh = 26
  ctx.fillStyle = section.color + Math.round(a * 0x30).toString(16).padStart(2, '0')
  ctx.fillRect(tl.x, tl.y + 3, sw, hh)

  const r = 50 + progress * 50
  ctx.beginPath(); ctx.arc(ns.x, ns.y, r, 0, Math.PI * 2)
  ctx.strokeStyle = section.color + Math.round(a * 0xaa).toString(16).padStart(2, '0')
  ctx.lineWidth = 2.5; ctx.shadowColor = section.color; ctx.shadowBlur = 20 * a
  ctx.stroke()
  ctx.restore()
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

export function drawEdges(ctx, nodes, edges, cam, cw, ch) {
  const t = (Date.now() % 4000) / 4000
  for (const [ai, bi] of edges) {
    const a = nodes[ai], b = nodes[bi]
    if (!a || !b) continue
    const as = w2s(a.x, a.y, cam, cw, ch)
    const bs = w2s(b.x, b.y, cam, cw, ch)
    const lit = a.hovered || b.hovered || a.grabbed || b.grabbed
    ctx.save()
    ctx.beginPath(); ctx.moveTo(as.x, as.y); ctx.lineTo(bs.x, bs.y)
    ctx.strokeStyle = lit ? 'rgba(0,220,255,0.55)' : 'rgba(0,100,140,0.18)'
    ctx.lineWidth   = lit ? 1.4 : 0.7
    if (lit) { ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 8 }
    ctx.stroke()
    const dot = { x: as.x + (bs.x - as.x) * t, y: as.y + (bs.y - as.y) * t }
    ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.8, 0, Math.PI * 2)
    ctx.fillStyle = lit ? 'rgba(0,220,255,0.9)' : 'rgba(0,180,200,0.35)'
    ctx.shadowColor = '#00ccff'; ctx.shadowBlur = lit ? 8 : 4
    ctx.fill()
    ctx.restore()
  }
}

export function drawDockRing(ctx, node, progress, cam, cw, ch, mode = 'connect') {
  const { x: sx, y: sy } = w2s(node.x, node.y, cam, cw, ch)
  const color  = mode === 'detach' ? '#ff6633' : '#00ff99'
  const colorA = mode === 'detach' ? '255,102,51' : '0,255,153'
  const radius = 72
  const start  = -Math.PI / 2
  // Detach ring runs counter-clockwise for visual distinction
  const end    = mode === 'detach'
    ? start - Math.PI * 2 * progress
    : start + Math.PI * 2 * progress

  ctx.save()

  ctx.beginPath()
  ctx.arc(sx, sy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${colorA},0.08)`
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(sx, sy, radius, start, end, mode === 'detach')
  ctx.strokeStyle = `rgba(${colorA},${0.4 + progress * 0.6})`
  ctx.lineWidth = 3
  ctx.shadowColor = color
  ctx.shadowBlur = 16 * progress
  ctx.stroke()

  // Detach: show a breaking/scissors symbol at center when complete
  if (progress >= 1) {
    ctx.beginPath()
    ctx.arc(sx, sy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.shadowBlur = 24
    ctx.stroke()

    if (mode === 'detach') {
      const s = 10
      ctx.lineWidth = 2.5; ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(sx - s, sy - s); ctx.lineTo(sx + s, sy + s)
      ctx.moveTo(sx + s, sy - s); ctx.lineTo(sx - s, sy + s)
      ctx.stroke()
    }
  }

  ctx.restore()
}

export function drawParentEdges(ctx, nodes, cam, cw, ch) {
  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n
  const now = Date.now()

  for (const child of nodes) {
    if (!child.parentIds || child.parentIds.length === 0) continue
    for (const pid of child.parentIds) {
      const parent = nodeMap[pid]
      if (!parent) continue

      const ps  = w2s(parent.x, parent.y, cam, cw, ch)
      const cs  = w2s(child.x,  child.y,  cam, cw, ch)
      const lit = child.hovered || parent.hovered || child.grabbed || parent.grabbed

      const dx    = cs.x - ps.x, dy = cs.y - ps.y
      const dist  = Math.hypot(dx, dy) || 1
      const perpX = -dy / dist, perpY = dx / dist
      const bend  = Math.min(70, dist * 0.25)
      const cp    = { x: (ps.x + cs.x) / 2 + perpX * bend, y: (ps.y + cs.y) / 2 + perpY * bend }

      ctx.save()

      // Glow halo — gold near parent, cyan near child
      const grdGlow = ctx.createLinearGradient(ps.x, ps.y, cs.x, cs.y)
      grdGlow.addColorStop(0,   lit ? 'rgba(255,204,0,0.28)'  : 'rgba(255,204,0,0.06)')
      grdGlow.addColorStop(0.5, lit ? 'rgba(80,210,255,0.18)' : 'rgba(80,200,255,0.04)')
      grdGlow.addColorStop(1,   lit ? 'rgba(0,170,255,0.28)'  : 'rgba(0,170,255,0.06)')
      ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.quadraticCurveTo(cp.x, cp.y, cs.x, cs.y)
      ctx.strokeStyle = grdGlow; ctx.lineWidth = lit ? 12 : 7
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = lit ? 16 : 0; ctx.stroke()

      // Core line — gold → cyan
      const grd = ctx.createLinearGradient(ps.x, ps.y, cs.x, cs.y)
      grd.addColorStop(0,   lit ? '#ffcc00ee' : '#ffcc0055')
      grd.addColorStop(0.5, lit ? '#66ddffcc' : '#44bbcc33')
      grd.addColorStop(1,   lit ? '#00aaffee' : '#00aaff55')
      ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.quadraticCurveTo(cp.x, cp.y, cs.x, cs.y)
      ctx.strokeStyle = grd; ctx.lineWidth = lit ? 2.4 : 1.4
      ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = lit ? 10 : 3; ctx.stroke()

      // Flowing particles: colour shifts gold → cyan as they travel
      const numDots = lit ? 4 : 2
      for (let di = 0; di < numDots; di++) {
        const period = 2000 - di * 250
        const t      = ((now % period) / period + di / numDots) % 1
        const bx     = (1-t)*(1-t)*ps.x + 2*(1-t)*t*cp.x + t*t*cs.x
        const by     = (1-t)*(1-t)*ps.y + 2*(1-t)*t*cp.y + t*t*cs.y
        const r8 = Math.round(255 * (1 - t)).toString(16).padStart(2,'0')
        const b8 = Math.round(255 * t).toString(16).padStart(2,'0')
        ctx.beginPath(); ctx.arc(bx, by, lit ? 3 : 1.8, 0, Math.PI * 2)
        ctx.fillStyle   = `#${r8}cc${b8}`
        ctx.shadowColor = '#aaddff'; ctx.shadowBlur = lit ? 14 : 5; ctx.fill()
      }

      // Gold diamond at parent end
      const ds = lit ? 11 : 7
      ctx.beginPath()
      ctx.moveTo(ps.x, ps.y - ds); ctx.lineTo(ps.x + ds * 0.6, ps.y)
      ctx.lineTo(ps.x, ps.y + ds); ctx.lineTo(ps.x - ds * 0.6, ps.y)
      ctx.closePath()
      ctx.fillStyle = lit ? '#ffcc00cc' : '#ffcc0066'
      ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = lit ? 14 : 5; ctx.fill()

      // Cyan arrowhead at child end
      const endDirX = cs.x - cp.x, endDirY = cs.y - cp.y
      const angle   = Math.atan2(endDirY, endDirX)
      const al = lit ? 16 : 11, aw = 0.4
      ctx.beginPath()
      ctx.moveTo(cs.x, cs.y)
      ctx.lineTo(cs.x - al * Math.cos(angle - aw), cs.y - al * Math.sin(angle - aw))
      ctx.lineTo(cs.x - al * Math.cos(angle + aw), cs.y - al * Math.sin(angle + aw))
      ctx.closePath()
      ctx.fillStyle = lit ? '#00aaffcc' : '#00aaff66'
      ctx.shadowColor = '#00aaff'; ctx.shadowBlur = lit ? 14 : 5; ctx.fill()

      // Text labels — visible when hovered/grabbed OR zoom is high enough to read
      if (lit || cam.zoom >= 1.2) {
        const fs = Math.max(8, Math.min(11, 9 * cam.zoom))
        ctx.font = `${fs}px "Courier New"`
        ctx.textAlign = 'center'

        ctx.fillStyle = '#ffcc00cc'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 8
        ctx.fillText('◈ PARENT', ps.x, ps.y - ds - 7)

        ctx.fillStyle = '#00aaffcc'; ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 8
        const childOffset = al + 9
        ctx.fillText('⊂ CHILD', cs.x - childOffset * Math.cos(angle), cs.y - childOffset * Math.sin(angle) - 7)
        ctx.shadowBlur = 0
      }

      ctx.restore()
    }
  }
}

export function applyTagHighlights(nodes) {
  // Clear previous highlights
  for (const n of nodes) n.tagHighlight = null

  // Find hovered nodes that have tags
  const hoveredWithTags = nodes.filter(n => (n.hovered || n.grabbed) && n.tags && n.tags.length > 0)
  if (hoveredWithTags.length === 0) return

  // Build tag → color map from hovered node tags
  const activeTagColors = {}
  for (const n of hoveredWithTags) {
    for (const tag of n.tags) activeTagColors[tag] = tagColor(tag)
  }

  // Mark every other node that shares at least one active tag
  for (const n of nodes) {
    if (n.hovered || n.grabbed) continue
    if (!n.tags || n.tags.length === 0) continue
    for (const tag of n.tags) {
      if (activeTagColors[tag]) { n.tagHighlight = activeTagColors[tag]; break }
    }
  }
}

export function drawTagLinks(ctx, nodes, cam, cw, ch) {
  const now = Date.now()

  for (const src of nodes) {
    if ((!src.hovered && !src.grabbed) || !src.tags || src.tags.length === 0) continue
    const ss = w2s(src.x, src.y, cam, cw, ch)

    for (const dst of nodes) {
      if (dst === src || !dst.tags || dst.tags.length === 0) continue
      // Find shared tags
      const shared = src.tags.filter(t => dst.tags.includes(t))
      if (shared.length === 0) continue

      const ds    = w2s(dst.x, dst.y, cam, cw, ch)
      const color = tagColor(shared[0])

      ctx.save()

      // Dashed connection in tag color
      const grd = ctx.createLinearGradient(ss.x, ss.y, ds.x, ds.y)
      grd.addColorStop(0, color + 'cc')
      grd.addColorStop(1, color + '44')
      ctx.beginPath(); ctx.moveTo(ss.x, ss.y); ctx.lineTo(ds.x, ds.y)
      ctx.strokeStyle = grd; ctx.lineWidth = 1.2
      ctx.setLineDash([4, 6]); ctx.shadowColor = color; ctx.shadowBlur = 8
      ctx.stroke()
      ctx.setLineDash([])

      // Animated traveling dot along the line
      const t   = ((now % 1800) / 1800)
      const px  = ss.x + (ds.x - ss.x) * t
      const py  = ss.y + (ds.y - ss.y) * t
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = color; ctx.shadowBlur = 10; ctx.fill()

      // Tag label at midpoint
      if (cam.zoom >= 0.7) {
        const mx  = (ss.x + ds.x) / 2, my = (ss.y + ds.y) / 2
        const fs  = Math.max(8, 8 * cam.zoom)
        ctx.font = `${fs}px "Courier New"`; ctx.textAlign = 'center'
        ctx.fillStyle = color + 'bb'; ctx.shadowBlur = 6
        ctx.fillText('#' + shared[0], mx, my - 6)
      }

      ctx.restore()
    }
  }
}

export function drawNode(ctx, n, cam, cw, ch) {
  const { x: sx, y: sy } = w2s(n.x, n.y, cam, cw, ch)
  const z       = Math.min(Math.max(cam.zoom, 0.25), 4)
  const pal     = PALETTE[n.type] || PALETTE.CONCEPT
  const hasTags = n.tags && n.tags.length > 0

  // Micro mode: just a glowing dot at very low zoom
  if (z < 0.38) {
    ctx.save()
    const roleC = n.role === 'parent' ? '#ffcc00' : n.role === 'child' ? '#00aaff' : pal.hi
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2)
    ctx.fillStyle = roleC + 'cc'; ctx.shadowColor = roleC; ctx.shadowBlur = 10; ctx.fill()
    ctx.restore()
    return
  }

  // Larger base dimensions for readability at default zoom
  const W  = 220 * z, H = (hasTags ? 152 : 132) * z, R = 4 * z
  const x0 = sx - W/2, y0 = sy - H/2
  const HH = 30 * z  // header height

  const roleC = n.role === 'parent' ? '#ffcc00' : n.role === 'child' ? '#00aaff' : null

  ctx.save()

  // Parent: pulsing gold outer halo
  if (n.role === 'parent') {
    const t = (Date.now() % 2200) / 2200
    const pulse = 0.12 + 0.06 * Math.sin(t * Math.PI * 2)
    ctx.beginPath(); ctx.arc(sx, sy, Math.hypot(W, H) * 0.55, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(255,204,0,${pulse})`
    ctx.lineWidth = 2; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 18; ctx.stroke()
    ctx.shadowBlur = 0
  }

  ctx.shadowColor = roleC || pal.hi
  ctx.shadowBlur  = n.grabbed ? 32 : n.hovered ? 20 : 9

  rrect(ctx, x0, y0, W, H, R)
  ctx.fillStyle = 'rgba(0, 6, 20, 0.94)'; ctx.fill()

  const borderBase = roleC || pal.hi
  ctx.strokeStyle = n.grabbed ? borderBase : n.hovered ? borderBase + 'cc' : borderBase + (roleC ? '66' : '44')
  ctx.lineWidth   = n.grabbed ? 2 : roleC ? 1.8 : 1.3
  ctx.stroke()
  ctx.shadowBlur  = 0

  // Header bar
  const headerFill = n.role === 'parent' ? '#1c1200' : n.role === 'child' ? '#001222' : null
  rrect(ctx, x0, y0, W, HH, R)
  ctx.fillStyle = (headerFill || pal.dim) + 'ee'; ctx.fill()

  // Type label — left of header
  ctx.fillStyle = pal.hi + 'cc'; ctx.font = `${9 * z}px "Courier New"`; ctx.textAlign = 'left'
  ctx.fillText(n.type, x0 + 9 * z, y0 + HH * 0.68)

  // Role badge — right of header
  const roleBadge  = n.role === 'parent' ? '◈ PARENT' : n.role === 'child' ? '⊂ CHILD' : `NODE-${String(n.id).padStart(2,'0')}`
  const badgeColor = roleC || '#ff4444'
  ctx.fillStyle = badgeColor; ctx.shadowColor = badgeColor; ctx.shadowBlur = roleC ? 9 : 0
  ctx.font = `bold ${8 * z}px "Courier New"`; ctx.textAlign = 'right'
  ctx.fillText(roleBadge, x0 + W - 9 * z, y0 + HH * 0.68)
  ctx.shadowBlur = 0

  // Main label
  ctx.shadowColor = pal.hi; ctx.shadowBlur = 7
  ctx.fillStyle = '#e8f4ff'; ctx.font = `bold ${13 * z}px "Courier New"`; ctx.textAlign = 'center'
  ctx.fillText(n.label, sx, y0 + HH + 20 * z)
  ctx.shadowBlur = 0

  // Separator
  ctx.beginPath()
  ctx.moveTo(x0 + 10 * z, y0 + HH + 28 * z); ctx.lineTo(x0 + W - 10 * z, y0 + HH + 28 * z)
  ctx.strokeStyle = pal.hi + '2a'; ctx.lineWidth = 0.6; ctx.stroke()

  // Content — more text revealed at higher zoom, word-wrapped above z=1.2
  if (n.content) {
    const maxChars = z > 2.5 ? 400 : z > 1.5 ? 140 : z > 0.9 ? 65 : 42
    const preview  = n.content.slice(0, maxChars) + (n.content.length > maxChars ? '…' : '')
    const fs       = Math.min(9.5 * z, 14)
    ctx.font = `${fs}px "Courier New"`; ctx.fillStyle = '#5a9aaa'; ctx.textAlign = 'center'
    const contentTop = y0 + HH + 42 * z
    if (z > 1.2) {
      const words = preview.split(' ')
      let line = '', row = contentTop
      const maxW = W - 22 * z
      for (const word of words) {
        const test = line ? line + ' ' + word : word
        if (ctx.measureText(test).width > maxW) { ctx.fillText(line, sx, row); line = word; row += fs * 1.55 }
        else line = test
        if (row > y0 + H - 26 * z) { ctx.fillText(line + '…', sx, row); line = null; break }
      }
      if (line) ctx.fillText(line, sx, row)
    } else {
      ctx.fillText(preview, sx, contentTop)
    }
  }

  if (!n.content && n.data) {
    const fs = Math.min(9 * z, 14)
    ctx.font = `${fs}px "Courier New"`
    let row = y0 + HH + 44 * z
    for (const [k, v] of Object.entries(n.data)) {
      ctx.fillStyle = '#3a6a88'; ctx.textAlign = 'left'
      ctx.fillText(k.toUpperCase() + ':', x0 + 10 * z, row)
      ctx.fillStyle = pal.hi + 'bb'; ctx.textAlign = 'right'
      ctx.fillText(String(v), x0 + W - 10 * z, row)
      ctx.textAlign = 'left'; row += 16 * z
    }
  }

  if (hasTags) {
    const tagY = y0 + H - 24 * z
    ctx.beginPath()
    ctx.moveTo(x0 + 10 * z, tagY - 5 * z); ctx.lineTo(x0 + W - 10 * z, tagY - 5 * z)
    ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 0.5; ctx.stroke()

    let tx = x0 + 10 * z
    for (const tag of n.tags.slice(0, 5)) {
      const color = tagColor(tag)
      const label = '#' + tag
      const fs    = 8 * z
      ctx.font    = `${fs}px "Courier New"`
      const tw    = ctx.measureText(label).width + 10 * z
      if (tx + tw > x0 + W - 8 * z) break
      // Highlighted tag pill if active
      const active = n.tagHighlight && n.tags.some(t => tagColor(t) === color)
      ctx.fillStyle = active ? color + '44' : color + '1e'
      rrect(ctx, tx, tagY, tw, 14 * z, 3 * z); ctx.fill()
      ctx.strokeStyle = active ? color + 'aa' : color + '55'
      ctx.lineWidth = active ? 1 : 0.6; ctx.stroke()
      ctx.fillStyle = active ? color : color + 'cc'; ctx.textAlign = 'left'
      ctx.shadowColor = active ? color : 'transparent'; ctx.shadowBlur = active ? 8 : 0
      ctx.fillText(label, tx + 5 * z, tagY + 10 * z)
      ctx.shadowBlur = 0
      tx += tw + 5 * z
    }
  }

  if (n.grabbed) {
    const bx = x0 - 5 * z, by = y0 - 5 * z, bw = W + 10 * z, bh = H + 10 * z, cs = 16 * z
    ctx.strokeStyle = borderBase; ctx.lineWidth = 1.5; ctx.shadowColor = borderBase; ctx.shadowBlur = 14
    for (const pts of [
      [[bx,by+cs],[bx,by],[bx+cs,by]], [[bx+bw-cs,by],[bx+bw,by],[bx+bw,by+cs]],
      [[bx,by+bh-cs],[bx,by+bh],[bx+cs,by+bh]], [[bx+bw-cs,by+bh],[bx+bw,by+bh],[bx+bw,by+bh-cs]],
    ]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); ctx.lineTo(pts[1][0],pts[1][1]); ctx.lineTo(pts[2][0],pts[2][1]); ctx.stroke()
    }
  }

  ctx.restore()
}

const HAND_BONES = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
  [9,10],[10,11],[11,12],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17],
]

export function drawHandSkeleton(ctx, lms, color, cw, ch) {
  ctx.save()
  ctx.strokeStyle = color + '77'; ctx.lineWidth = 1; ctx.shadowColor = color; ctx.shadowBlur = 6
  for (const [a, b] of HAND_BONES) {
    const pa = { x: (1-lms[a].x)*cw, y: lms[a].y*ch }, pb = { x: (1-lms[b].x)*cw, y: lms[b].y*ch }
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke()
  }
  for (const i of [0,4,8,12,16,20]) {
    const p = { x: (1-lms[i].x)*cw, y: lms[i].y*ch }
    ctx.shadowBlur = i === 8 ? 12 : 6; ctx.beginPath(); ctx.arc(p.x, p.y, i===4||i===8 ? 5 : 3, 0, Math.PI*2)
    ctx.fillStyle = i===4||i===8 ? '#ffffff' : color+'cc'; ctx.fill()
  }
  ctx.restore()
}

export function drawPinchRing(ctx, lms, color, cw, ch) {
  if (!isPinching(lms)) return
  const p = pinchScreen(lms, cw, ch), t = (Date.now() % 700) / 700
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.shadowColor = color; ctx.shadowBlur = 14
  ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(p.x, p.y, 18 + t*14, 0, Math.PI*2); ctx.stroke()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(p.x-9, p.y); ctx.lineTo(p.x+9, p.y); ctx.moveTo(p.x, p.y-9); ctx.lineTo(p.x, p.y+9); ctx.stroke()
  ctx.restore()
}

export function drawApproachRing(ctx, lms, color, cw, ch) {
  if (isPinching(lms) || !isApproachingPinch(lms)) return
  const p = pinchScreen(lms, cw, ch), d = pinchDist(lms)
  const pct = 1 - (d - PINCH_THRESHOLD) / (PINCH_THRESHOLD * 0.8)
  ctx.save()
  ctx.strokeStyle = color+'66'; ctx.lineWidth = 1; ctx.shadowColor = color; ctx.shadowBlur = 6
  ctx.setLineDash([3,4]); ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI*2*pct); ctx.stroke()
  ctx.restore()
}

export function drawCursor(ctx, lms, color, cw, ch) {
  if (isPinching(lms)) return
  const p = indexTipScreen(lms, cw, ch)
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.shadowColor = color; ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.moveTo(p.x, p.y-9); ctx.lineTo(p.x+6, p.y); ctx.lineTo(p.x, p.y+9); ctx.lineTo(p.x-6, p.y)
  ctx.closePath(); ctx.stroke()
  ctx.restore()
}

export function drawMouseCursor(ctx, x, y, grabbed) {
  const color = grabbed ? '#00ff99' : '#00aaff'
  ctx.save()
  ctx.shadowColor = color; ctx.shadowBlur = 12
  ctx.strokeStyle = color; ctx.lineWidth = grabbed ? 2 : 1.5
  ctx.beginPath(); ctx.arc(x, y, grabbed ? 7 : 5, 0, Math.PI * 2)
  ctx.stroke()
  if (grabbed) {
    ctx.fillStyle = color + '33'
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}
