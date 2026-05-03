import { PALETTE, tagColor } from '../data/graphData.js'
import { isPinching, isApproachingPinch, pinchDist, pinchScreen, indexTipScreen, PINCH_THRESHOLD } from './gestures.js'

export function w2s(wx, wy, cam, cw, ch) {
  return { x: wx * cam.zoom + cam.x + cw / 2, y: wy * cam.zoom + cam.y + ch / 2 }
}

export function drawSections(ctx, sections, activeSectionId, cam, cw, ch) {
  for (const s of sections) {
    const tl = w2s(s.x,           s.y,            cam, cw, ch)
    const br = w2s(s.x + s.width, s.y + s.height, cam, cw, ch)
    const sw = br.x - tl.x, sh = br.y - tl.y
    if (sw < 2 || sh < 2) continue

    const hot = s.id === activeSectionId

    ctx.save()

    // Column fill — only visible when hot
    ctx.fillStyle = hot ? s.color + '18' : s.color + '06'
    ctx.fillRect(tl.x, tl.y, sw, sh)

    // Top accent line
    ctx.fillStyle = hot ? s.color + 'cc' : s.color + '44'
    ctx.fillRect(tl.x, tl.y, sw, hot ? 3 : 2)

    // Vertical side guides
    ctx.fillStyle = hot ? s.color + '30' : s.color + '12'
    ctx.fillRect(tl.x,        tl.y + 3, 1, sh - 3)
    ctx.fillRect(tl.x + sw - 1, tl.y + 3, 1, sh - 3)

    // Header row
    const hh = 26
    ctx.fillStyle = hot ? s.color + '22' : s.color + '0a'
    ctx.fillRect(tl.x, tl.y + 3, sw, hh)

    // Label
    ctx.font = `${hot ? 'bold' : 'normal'} 10px "Courier New"`
    ctx.fillStyle = hot ? s.color : s.color + '99'
    ctx.textAlign = 'left'
    ctx.shadowColor = s.color
    ctx.shadowBlur = hot ? 14 : 4
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
  const a = Math.max(0, 1 - progress)
  const sa = w2s(nodeA.x, nodeA.y, cam, cw, ch)
  const sb = w2s(nodeB.x, nodeB.y, cam, cw, ch)

  ctx.save()
  ctx.beginPath(); ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y)
  ctx.strokeStyle = `rgba(0,255,153,${a * 0.9})`
  ctx.lineWidth = 1.5 + (1 - progress) * 5
  ctx.shadowColor = '#00ff99'; ctx.shadowBlur = 24 * a
  ctx.stroke()

  for (const sp of [sa, sb]) {
    const r = 30 + progress * 80
    ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0,255,153,${a * 0.7})`
    ctx.lineWidth = 2; ctx.shadowBlur = 18 * a
    ctx.stroke()
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

export function drawDockRing(ctx, node, progress, cam, cw, ch) {
  const { x: sx, y: sy } = w2s(node.x, node.y, cam, cw, ch)
  const radius = 72
  const start  = -Math.PI / 2
  const end    = start + Math.PI * 2 * progress

  ctx.save()
  ctx.beginPath()
  ctx.arc(sx, sy, radius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0,255,153,0.08)'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(sx, sy, radius, start, end)
  ctx.strokeStyle = `rgba(0,255,153,${0.4 + progress * 0.6})`
  ctx.lineWidth = 3
  ctx.shadowColor = '#00ff99'
  ctx.shadowBlur = 16 * progress
  ctx.stroke()

  if (progress >= 1) {
    ctx.beginPath()
    ctx.arc(sx, sy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = '#00ff99'
    ctx.lineWidth = 2
    ctx.shadowBlur = 24
    ctx.stroke()
  }
  ctx.restore()
}

export function drawParentEdges(ctx, nodes, cam, cw, ch) {
  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n

  for (const child of nodes) {
    if (!child.parentIds || child.parentIds.length === 0) continue
    for (const pid of child.parentIds) {
    const parent = nodeMap[pid]
    if (!parent) continue

    const ps  = w2s(parent.x, parent.y, cam, cw, ch)
    const cs  = w2s(child.x,  child.y,  cam, cw, ch)
    const lit = child.hovered || parent.hovered || child.grabbed || parent.grabbed

    ctx.save()
    ctx.beginPath(); ctx.moveTo(ps.x, ps.y); ctx.lineTo(cs.x, cs.y)
    ctx.strokeStyle = lit ? 'rgba(0,255,153,0.65)' : 'rgba(0,255,153,0.18)'
    ctx.lineWidth   = lit ? 1.6 : 0.9
    ctx.setLineDash([5, 5])
    ctx.shadowColor = '#00ff99'
    ctx.shadowBlur  = lit ? 12 : 4
    ctx.stroke()

    const angle = Math.atan2(cs.y - ps.y, cs.x - ps.x)
    const al = 8, aw = 0.35
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cs.x, cs.y)
    ctx.lineTo(cs.x - al * Math.cos(angle - aw), cs.y - al * Math.sin(angle - aw))
    ctx.lineTo(cs.x - al * Math.cos(angle + aw), cs.y - al * Math.sin(angle + aw))
    ctx.closePath()
    ctx.fillStyle = lit ? 'rgba(0,255,153,0.7)' : 'rgba(0,255,153,0.25)'
    ctx.shadowBlur = lit ? 8 : 2
    ctx.fill()
    ctx.restore()
    }
  }
}

export function drawNode(ctx, n, cam, cw, ch) {
  const { x: sx, y: sy } = w2s(n.x, n.y, cam, cw, ch)
  const pal     = PALETTE[n.type] || PALETTE.CONCEPT
  const hasTags = n.tags && n.tags.length > 0
  const W = 172, H = hasTags ? 112 : 96, R = 3

  ctx.save()
  ctx.shadowColor = pal.hi
  ctx.shadowBlur  = n.grabbed ? 32 : n.hovered ? 20 : 9

  rrect(ctx, sx - W/2, sy - H/2, W, H, R)
  ctx.fillStyle   = 'rgba(0, 6, 20, 0.93)'
  ctx.fill()
  ctx.strokeStyle = n.grabbed ? pal.hi : n.hovered ? pal.hi + 'cc' : pal.hi + '44'
  ctx.lineWidth   = n.grabbed ? 2 : 1.2
  ctx.stroke()
  ctx.shadowBlur  = 0

  rrect(ctx, sx - W/2, sy - H/2, W, 22, R)
  ctx.fillStyle = pal.dim + 'ee'; ctx.fill()

  ctx.fillStyle = pal.hi; ctx.font = '6px "Courier New"'; ctx.textAlign = 'left'
  ctx.fillText(n.type, sx - W/2 + 7, sy - H/2 + 14)
  const roleBadge = n.role === 'parent' ? '◈ PARENT' : n.role === 'child' ? '⊂ CHILD' : `NODE-${String(n.id).padStart(2,'0')}`
  const roleColor = n.role === 'parent' ? '#00ff9988' : n.role === 'child' ? '#00ccff88' : '#ff444488'
  ctx.fillStyle = roleColor; ctx.font = '5px "Courier New"'; ctx.textAlign = 'right'
  ctx.fillText(roleBadge, sx + W/2 - 6, sy - H/2 + 14)

  ctx.shadowColor = pal.hi; ctx.shadowBlur = 6
  ctx.fillStyle   = '#e8f4ff'; ctx.font = 'bold 9px "Courier New"'; ctx.textAlign = 'center'
  ctx.fillText(n.label, sx, sy - H/2 + 37)
  ctx.shadowBlur  = 0

  ctx.beginPath()
  ctx.moveTo(sx - W/2 + 8, sy - H/2 + 42); ctx.lineTo(sx + W/2 - 8, sy - H/2 + 42)
  ctx.strokeStyle = pal.hi + '33'; ctx.lineWidth = 0.5; ctx.stroke()

  if (n.content) {
    const preview = n.content.slice(0, 36) + (n.content.length > 36 ? '…' : '')
    ctx.font = '5.5px "Courier New"'; ctx.fillStyle = '#2a5a70'; ctx.textAlign = 'center'
    ctx.fillText(preview, sx, sy - H/2 + 55)
  }

  if (!n.content && n.data) {
    ctx.font = '6.5px "Courier New"'
    let row  = sy - H/2 + 56
    for (const [k, v] of Object.entries(n.data)) {
      ctx.fillStyle = '#3a6a88'; ctx.textAlign = 'left'
      ctx.fillText(k.toUpperCase() + ':', sx - W/2 + 9, row)
      ctx.fillStyle = pal.hi + 'bb'; ctx.textAlign = 'right'
      ctx.fillText(String(v), sx + W/2 - 9, row)
      ctx.textAlign = 'left'; row += 13
    }
  }

  if (hasTags) {
    const tagY = sy + H/2 - 18
    ctx.beginPath()
    ctx.moveTo(sx - W/2 + 8, tagY - 4); ctx.lineTo(sx + W/2 - 8, tagY - 4)
    ctx.strokeStyle = '#ffffff11'; ctx.lineWidth = 0.5; ctx.stroke()

    let tx = sx - W/2 + 8
    for (const tag of n.tags.slice(0, 4)) {
      const color = tagColor(tag)
      const label = '#' + tag
      ctx.font = '5px "Courier New"'
      const tw  = ctx.measureText(label).width + 8
      if (tx + tw > sx + W/2 - 6) break
      ctx.fillStyle = color + '25'
      rrect(ctx, tx, tagY, tw, 11, 2); ctx.fill()
      ctx.strokeStyle = color + '66'; ctx.lineWidth = 0.5; ctx.stroke()
      ctx.fillStyle = color; ctx.textAlign = 'left'
      ctx.fillText(label, tx + 4, tagY + 8)
      tx += tw + 4
    }
  }

  if (n.grabbed) {
    const bx = sx - W/2 - 5, by = sy - H/2 - 5, bw = W + 10, bh = H + 10, cs = 14
    ctx.strokeStyle = pal.hi; ctx.lineWidth = 1.5; ctx.shadowColor = pal.hi; ctx.shadowBlur = 14
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
