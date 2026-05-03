const REPEL  = 12000
const SPRING = 0.014
const TARGET = 210
const DAMP   = 0.86
const CENTER = 0.0008

export function stepPhysics(nodes, edges) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const d  = Math.hypot(dx, dy) || 1
      const f  = REPEL / (d * d)
      const fx = (dx / d) * f, fy = (dy / d) * f
      if (!nodes[i].pinned) { nodes[i].vx -= fx; nodes[i].vy -= fy }
      if (!nodes[j].pinned) { nodes[j].vx += fx; nodes[j].vy += fy }
    }
  }

  for (const [ai, bi] of edges) {
    const a = nodes[ai], b = nodes[bi]
    const dx = b.x - a.x, dy = b.y - a.y
    const d  = Math.hypot(dx, dy) || 1
    const f  = (d - TARGET) * SPRING
    const fx = (dx / d) * f, fy = (dy / d) * f
    if (!a.pinned) { a.vx += fx; a.vy += fy }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy }
  }

  for (const n of nodes) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue }
    n.vx += -n.x * CENTER
    n.vy += -n.y * CENTER
    n.vx *= DAMP
    n.vy *= DAMP
    n.x  += n.vx
    n.y  += n.vy
  }
}
