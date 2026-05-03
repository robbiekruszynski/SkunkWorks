import { PALETTE, tagColor } from '../data/graphData.js'
import { isPinching, isApproachingPinch, pinchDist, pinchScreen, indexTipScreen, PINCH_THRESHOLD } from './gestures.js'

export function w2s(wx, wy, cam, cw, ch) {
  return { x: wx * cam.zoom + cam.x + cw / 2, y: wy * cam.zoom + cam.y + ch / 2 }
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// ── Structural edges ──────────────────────────────────────────────
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

// ── Tag edges (dashed, colored by tag) ───────────────────────────
export function drawTagEdges(ctx, nodes, tagEdges, cam, cw, ch) {
  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n

  for (const e of tagEdges) {
    const a = nodeMap[e.source], b = nodeMap[e.target]
    if (!a || !b) continue
    const as = w2s(a.x, a.y, cam, cw, ch)
    const bs = w2s(b.x, b.y, cam, cw, ch)
    const color = tagColor(e.tag)
    const lit   = a.hovered || b.hovered || a.grabbed || b.grabbed

    ctx.save()
    ctx.beginPath(); ctx.moveTo(as.x, as.y); ctx.lineTo(bs.x, bs.y)
    ctx.strokeStyle = lit ? color + 'cc' : color + '44'
    ctx.lineWidth   = lit ? 1.5 : 1
    ctx.setLineDash([4, 6])
    ctx.shadowColor = color
    ctx.shadowBlur  = lit ? 12 : 4
    ctx.stroke()

    // Tag label at midpoint
    if (lit) {
      const mx = (as.x + bs.x) / 2, my = (as.y + bs.y) / 2
      ctx.setLineDash([])
      ctx.font      = '6px "Courier New"'
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.shadowBlur = 8
      ctx.fillText('#' + e.tag, mx, my - 4)
    }
    ctx.restore()
  }
}

// ── Node card ─────────────────────────────────────────────────────
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

  // Header strip
  rrect(ctx, sx - W/2, sy - H/2, W, 22, R)
  ctx.fillStyle = pal.dim + 'ee'; ctx.fill()

  ctx.fillStyle = pal.hi; ctx.font = '6px "Courier New"'; ctx.textAlign = 'left'
  ctx.fillText(n.type, sx - W/2 + 7, sy - H/2 + 14)
  ctx.fillStyle = '#ff444488'; ctx.font = '5px "Courier New"'; ctx.textAlign = 'right'
  ctx.fillText(`NODE-${String(n.id).padStart(2,'0')}`, sx + W/2 - 6, sy - H/2 + 14)

  // Label
  ctx.shadowColor = pal.hi; ctx.shadowBlur = 6
  ctx.fillStyle   = '#e8f4ff'; ctx.font = 'bold 9px "Courier New"'; ctx.textAlign = 'center'
  ctx.fillText(n.label, sx, sy - H/2 + 37)
  ctx.shadowBlur  = 0

  // Divider
  ctx.beginPath()
  ctx.moveTo(sx - W/2 + 8, sy - H/2 + 42); ctx.lineTo(sx + W/2 - 8, sy - H/2 + 42)
  ctx.strokeStyle = pal.hi + '33'; ctx.lineWidth = 0.5; ctx.stroke()

  // Content preview (first line)
  if (n.content) {
    const preview = n.content.slice(0, 36) + (n.content.length > 36 ? '…' : '')
    ctx.font = '5.5px "Courier New"'; ctx.fillStyle = '#2a5a70'; ctx.textAlign = 'center'
    ctx.fillText(preview, sx, sy - H/2 + 55)
  }

  // Data rows (if no content, show data)
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

  // Tag strip
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

  // Grab brackets
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

// ── Hand skeleton ─────────────────────────────────────────────────
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
