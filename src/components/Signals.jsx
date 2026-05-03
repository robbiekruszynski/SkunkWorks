import { useState, useRef, useEffect } from 'react'

// ─── Palette ──────────────────────────────────────────────────────────────────
const CY = '#00ccff'
const MT = '#00ffaa'
const BL = '#2266ff'
const GD = '#ffaa00'

// ─── Math helpers ─────────────────────────────────────────────────────────────
const fract = x => x - Math.floor(x)
const lerp  = (a, b, t) => a + (b - a) * t
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const eio   = t => t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t   // quadratic in-out
const eout  = t => 1 - (1-t)*(1-t)

// ─── Canvas draw helpers ───────────────────────────────────────────────────────
function gCard(ctx, x, y, w, h, col, alpha = 0.6, glow = 0) {
  ctx.save()
  ctx.globalAlpha = alpha
  if (glow > 0) { ctx.shadowColor = col; ctx.shadowBlur = glow }
  ctx.strokeStyle = col; ctx.lineWidth = 1.3
  const r = 3
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath(); ctx.stroke()
  ctx.restore()
}

function gDot(ctx, x, y, r, col, glow = 12, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = glow; ctx.fill()
  ctx.restore()
}

function gLine(ctx, x1, y1, x2, y2, col, alpha = 0.6, w = 1, glow = 0) {
  ctx.save()
  ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w
  if (glow > 0) { ctx.shadowColor = col; ctx.shadowBlur = glow }
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  ctx.restore()
}

function gLabel(ctx, text, x, y, col, size, alpha = 1, glow = 0) {
  ctx.save()
  ctx.globalAlpha = alpha; ctx.fillStyle = col
  ctx.font = `bold ${size}px "Courier New"`; ctx.textAlign = 'center'
  if (glow > 0) { ctx.shadowColor = col; ctx.shadowBlur = glow }
  ctx.fillText(text, x, y)
  ctx.restore()
}

// ─── Per-gesture draw functions ───────────────────────────────────────────────
// `t` = accumulated virtual time (seconds); `active` = mouse is hovering.
// Canvas is always 180 × 110px.

const DRAW = {

  // 1 — PINCH & DRAG
  grab(ctx, t, _active, W, H) {
    const p = fract(t / 3.2)
    let pinch, dx
    if      (p < 0.28) { pinch = eio(p / 0.28);          dx = 0 }
    else if (p < 0.65) { pinch = 1;                       dx = eout((p - 0.28) / 0.37) * 46 }
    else if (p < 0.84) { pinch = 1 - eio((p-0.65)/0.19); dx = 46 - eout((p-0.65)/0.19)*46 }
    else               { pinch = 0; dx = 0 }

    const cx = W / 2 - 14 + dx, cy = H / 2
    gCard(ctx, cx - 32, cy - 18, 62, 36, CY, 0.32 + pinch * 0.52, pinch > 0.5 ? 10 : 2)
    gDot(ctx, lerp(cx - 34, cx - 5, pinch), cy + 9,  4.5, CY, 13)
    gDot(ctx, lerp(cx + 30, cx + 5, pinch), cy - 11, 4.5, MT, 13)
    if (pinch > 0.72)
      gLine(ctx, cx - 5, cy + 9, cx + 5, cy - 11, CY, (pinch - 0.72) / 0.28 * 0.38, 1)
    if (pinch > 0.9 && p > 0.30 && p < 0.62)
      gLabel(ctx, 'GRABBED', cx, cy + 32, CY, 7, 0.55)
  },

  // 2 — DOCK / CONNECT
  dock(ctx, t, _active, W, H) {
    const p = fract(t / 4.0)
    let dx, ringP, flashP, edgeP
    if      (p < 0.38) { dx = lerp(-96, 0, eout(p / 0.38));           ringP=0; flashP=0; edgeP=0 }
    else if (p < 0.64) { dx = 0; ringP = eio((p-0.38)/0.26);          flashP=0; edgeP=0 }
    else if (p < 0.76) { dx = 0; ringP = 1;                            flashP = 1-(p-0.64)/0.12; edgeP=0 }
    else if (p < 0.90) { dx = lerp(0,-96,eio((p-0.76)/0.14));         ringP=0; flashP=0; edgeP=clamp((p-0.76)/0.10,0,1)*(1-clamp((p-0.86)/0.04,0,1)) }
    else               { dx = -96; ringP=0; flashP=0; edgeP=0 }

    const tx = W/2 + 28, ty = H/2
    const mx = W/2 - 28 + dx, my = H/2

    gCard(ctx, tx-26, ty-18, 52, 36, BL,  0.50, 3)
    gLabel(ctx, 'TARGET', tx, ty+6, BL, 6, 0.35)
    gCard(ctx, mx-26, my-18, 52, 36, CY,  0.50 + ringP*0.2, 3)
    gDot(ctx, mx+6, my-2, 4, CY, 8)

    if (ringP > 0) {
      ctx.save()
      ctx.strokeStyle = GD; ctx.shadowColor = GD; ctx.shadowBlur = 14
      ctx.lineWidth = 2.2; ctx.lineCap = 'round'
      ctx.beginPath(); ctx.arc(tx, ty, 30, -Math.PI/2, -Math.PI/2 + Math.PI*2*ringP)
      ctx.stroke(); ctx.restore()
    }
    if (flashP > 0) {
      gLine(ctx, mx, my, tx, ty, MT, flashP * 0.85, 2, 14 * flashP)
      gDot(ctx, tx, ty, 5.5 * flashP, MT, 18 * flashP)
    }
    if (edgeP > 0) gLine(ctx, mx, my, tx, ty, MT, edgeP * 0.5, 1.2, 4)
  },

  // 3 — TWO-HAND ZOOM
  zoom(ctx, t, _active, W, H) {
    const p      = fract(t / 3.0)
    const spread = 0.5 + 0.5 * Math.sin(p * Math.PI * 2)
    const mid    = W / 2
    const sep    = lerp(10, 44, spread)

    // Left pinch
    gDot(ctx, mid - sep - 8, H/2 - 3, 4,   CY, 13)
    gDot(ctx, mid - sep + 5, H/2 + 7, 3.5, MT, 10)
    gLine(ctx, mid-sep-8, H/2-3, mid-sep+5, H/2+7, CY, 0.22, 1)
    // Right pinch
    gDot(ctx, mid + sep + 8, H/2 - 3, 4,   CY, 13)
    gDot(ctx, mid + sep - 5, H/2 + 7, 3.5, MT, 10)
    gLine(ctx, mid+sep+8, H/2-3, mid+sep-5, H/2+7, CY, 0.22, 1)

    // Arrows
    const aA = Math.abs(Math.cos(p * Math.PI * 2)) * 0.45 + 0.08
    const aY  = H / 2 - 28
    if (spread > 0.5) {
      gLine(ctx, mid-8,  aY, mid-28, aY, CY, aA, 1.3)
      gLine(ctx, mid+8,  aY, mid+28, aY, CY, aA, 1.3)
    } else {
      gLine(ctx, mid-28, aY, mid-8,  aY, CY, aA, 1.3)
      gLine(ctx, mid+28, aY, mid+8,  aY, CY, aA, 1.3)
    }
    gLabel(ctx, `${Math.round(80 + spread*180)}%`, mid, H/2 - 38, CY, 8, 0.40)
  },

  // 4 — PAN BOARD
  pan(ctx, t, _active, W, H) {
    const p  = fract(t / 3.2)
    const px = 0.5 + 0.4 * Math.sin(p * Math.PI * 2)
    const x  = lerp(W * 0.16, W * 0.84, px)

    // Scrolling dot grid (moves opposite to pinch)
    const gridX = (((-px + 0.5) * W * 0.6 + t * 6) % 26 + 26) % 26
    ctx.save()
    ctx.globalAlpha = 0.11
    for (let gx = gridX - 26; gx < W + 26; gx += 26) {
      for (let gy = 10; gy < H; gy += 22) {
        ctx.beginPath(); ctx.arc(gx, gy, 1.3, 0, Math.PI * 2)
        ctx.fillStyle = BL; ctx.fill()
      }
    }
    ctx.restore()

    // Velocity trail
    for (let i = 1; i <= 6; i++) {
      const tp = fract(p - i * 0.026)
      const tx = lerp(W*0.16, W*0.84, 0.5 + 0.4 * Math.sin(tp * Math.PI * 2))
      gDot(ctx, tx, H/2, 3.5, CY, 0, (7-i)/7 * 0.22)
    }

    gDot(ctx, x,   H/2,     5,   CY, 14)
    gDot(ctx, x+8, H/2+5, 3.5,   MT, 10)
    gLine(ctx, x, H/2, x+8, H/2+5, CY, 0.20, 1)

    const vel = Math.cos(p * Math.PI * 2)
    if (Math.abs(vel) > 0.22) {
      const len = Math.abs(vel) * 22, dir = vel > 0 ? 1 : -1
      gLine(ctx, x, H/2-22, x + dir*len, H/2-22, CY, 0.38, 1.3)
    }
  },

  // 5 — FOCUS MODE
  focus(ctx, t, _active, W, H) {
    const p  = fract(t / 5.0)
    let tap1 = 0, tap2 = 0, focusP = 0, dimP = 0
    if      (p < 0.12) { tap1   = eio(p / 0.12) }
    else if (p < 0.24) { tap1   = 1 - eio((p-0.12)/0.12) }
    else if (p < 0.36) { tap2   = eio((p-0.24)/0.12) }
    else if (p < 0.56) { tap2   = 1 - eio((p-0.36)/0.11); focusP = eio((p-0.36)/0.20); dimP = focusP }
    else if (p < 0.88) { focusP = 1; dimP = 1 }
    else               { focusP = 1 - eio((p-0.88)/0.12); dimP = focusP }

    const cx = W/2, cy = H/2 - 8

    // Background nodes
    const bgA = lerp(0.28, 0.05, dimP)
    gCard(ctx, 6,     cy-13, 34, 26, BL, bgA)
    gCard(ctx, W-40,  cy-13, 34, 26, BL, bgA)
    gCard(ctx, W/2-15, 6,   30, 20, BL, bgA * 0.8)

    if (dimP > 0) {
      ctx.save(); ctx.fillStyle = `rgba(0,2,12,${dimP*0.65})`
      ctx.fillRect(0, 0, W, H); ctx.restore()
    }

    // Parent card (featured)
    gCard(ctx, cx-34, cy-18, 68, 36, CY, 0.42 + focusP*0.46, lerp(3, 20, focusP))
    gLabel(ctx, 'PARENT', cx, cy+5, CY, 7, 0.38 + focusP*0.5, focusP*8)

    // Pinch dot
    const tapVal = Math.max(tap1, tap2 * 0.75)
    if (tapVal > 0) gDot(ctx, cx+16, cy-14, 4.5, MT, 14*tapVal, tapVal)

    // Children (appear on focus)
    if (focusP > 0.22) {
      const fp = eio((focusP - 0.22) / 0.78)
      gCard(ctx, cx-58, cy+24, 40, 22, MT, fp*0.44, fp*6)
      gLine(ctx, cx, cy+18, cx-38, cy+24, MT, fp*0.32, 1)
      gCard(ctx, cx+18, cy+24, 40, 22, MT, fp*0.44, fp*6)
      gLine(ctx, cx, cy+18, cx+38, cy+24, MT, fp*0.32, 1)
    }
  },

  // 6 — COLLAPSE / EXPAND
  collapse(ctx, t, _active, W, H) {
    const p  = fract(t / 4.0)
    let fistP = 0, hideP = 0, badgeP = 0
    if      (p < 0.38) { fistP=0; hideP=0; badgeP=0 }
    else if (p < 0.58) { fistP = eio((p-0.38)/0.20); hideP=0; badgeP=0 }
    else if (p < 0.78) { fistP=1; hideP = eio((p-0.58)/0.20); badgeP = hideP }
    else if (p < 0.92) { fistP=1; hideP=1; badgeP=1 }
    else               { fistP = 1 - eio((p-0.92)/0.08); hideP = fistP*0.9; badgeP = fistP }

    const cx = W / 2
    // Fist: 5 dots converging toward fistY
    const fistY = 16
    const tips = [[-24,-12],[-14,-20],[-2,-22],[10,-18],[20,-10]]
    for (const [fx, fy] of tips) {
      gDot(ctx, lerp(cx+fx, cx, fistP), lerp(fistY+fy, fistY, fistP),
           lerp(4, 2.5, fistP), CY, lerp(10, 3, fistP))
    }
    // Parent card
    gCard(ctx, cx-30, 28, 60, 28, CY, 0.62, 4)
    gLabel(ctx, 'PARENT', cx, 47, CY, 7, 0.44)
    // Child cards
    const cA = lerp(0.45, 0.03, hideP)
    gCard(ctx, cx-59, 68, 40, 22, MT, cA)
    gCard(ctx, cx-11, 68, 40, 22, MT, cA)
    gCard(ctx, cx+37, 68, 34, 22, MT, cA * 0.65)
    // Count badge
    if (badgeP > 0) {
      const bx = cx+29, by = 28, br = 9.5*badgeP
      ctx.save()
      ctx.globalAlpha = badgeP
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI*2)
      ctx.fillStyle = hideP > 0.5 ? '#cc4400' : GD
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; ctx.fill()
      ctx.globalAlpha = badgeP * 0.9; ctx.fillStyle = '#000'
      ctx.font = `bold ${Math.round(6.5*badgeP)}px "Courier New"`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(hideP > 0.4 ? '▶3' : '3', bx, by)
      ctx.textBaseline = 'alphabetic'; ctx.restore()
    }
  },

  // 7 — LINK / STICKY PARENT
  link(ctx, t, _active, W, H) {
    const p  = fract(t / 5.0)
    let arcP = 0, flashP = 0, edgeP = 0
    if      (p < 0.55) { arcP = eio(p / 0.55);               flashP=0; edgeP=0 }
    else if (p < 0.68) { arcP=1; flashP = 1-(p-0.55)/0.13;   edgeP=0 }
    else if (p < 0.85) { arcP=0; flashP=0; edgeP = eio((p-0.68)/0.17) }
    else               { arcP=0; flashP=0; edgeP = 1 - eio((p-0.85)/0.15) }

    const lx = W/2-44, ly = H/2
    const rx = W/2+44, ry = H/2

    gCard(ctx, lx-26, ly-18, 52, 36, CY, 0.5, 3)
    gLabel(ctx, edgeP > 0 ? 'CHILD' : 'NODE', lx, ly+5, CY, 6, 0.38 + edgeP*0.3)
    gCard(ctx, rx-26, ry-18, 52, 36, GD, 0.5, 3)
    gLabel(ctx, edgeP > 0 ? 'PARENT' : 'NODE', rx, ry+5, GD, 6, 0.38 + edgeP*0.3)
    gDot(ctx, lx+4, ly-2, 4,   CY, 9)
    gDot(ctx, rx-4, ry-2, 4,   GD, 9)

    if (arcP > 0) {
      ctx.save()
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'
      ctx.strokeStyle = CY; ctx.shadowColor = CY; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.arc(lx, ly, 30, -Math.PI/2, -Math.PI/2 + Math.PI*2*arcP); ctx.stroke()
      ctx.strokeStyle = GD; ctx.shadowColor = GD
      ctx.beginPath(); ctx.arc(rx, ry, 30, -Math.PI/2, -Math.PI/2 + Math.PI*2*arcP); ctx.stroke()
      ctx.restore()
      gLabel(ctx, `${(arcP*1.5).toFixed(1)}s`, W/2, H/2-38, GD, 8, 0.48)
    }
    if (flashP > 0) {
      gLine(ctx, lx, ly, rx, ry, MT, flashP*0.88, 2.5, 16*flashP)
      gDot(ctx, lx, ly, 6*flashP, MT, 20*flashP)
      gDot(ctx, rx, ry, 6*flashP, MT, 20*flashP)
    }
    if (edgeP > 0) gLine(ctx, lx, ly, rx, ry, MT, edgeP*0.45, 1.2, 4*edgeP)
  },
}

// ─── Animated canvas ───────────────────────────────────────────────────────────
function GestureCanvas({ id, active }) {
  const canvasRef = useRef(null)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let rafId, tAccum = 0, lastNow = performance.now()

    function frame() {
      const now = performance.now()
      tAccum += Math.min((now - lastNow) / 1000, 0.05) * (activeRef.current ? 2.5 : 0.78)
      lastNow = now
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      DRAW[id]?.(ctx, tAccum, activeRef.current, canvas.width, canvas.height)
      rafId = requestAnimationFrame(frame)
    }

    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [id])

  return (
    <canvas
      ref={canvasRef}
      width={180} height={110}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}

// ─── Gesture data ──────────────────────────────────────────────────────────────
const GESTURES = [
  {
    id: 'grab', name: 'PINCH — GRAB & DRAG', tag: 'PRIMARY', tagCol: CY,
    desc: 'Close thumb + index finger over any card to grab it. Drag to reposition. Release to drop. The card and all its children move together.',
    mouse: 'Left-click drag',
  },
  {
    id: 'dock', name: 'DOCK — CONNECT CARDS', tag: 'CONNECT', tagCol: BL,
    desc: 'Drag a card within range of another and hold for 0.5s to forge a parent-child link. Approach an existing parent edge to detach instead.',
    mouse: 'Drag within ~160px of target, hold 0.5s',
  },
  {
    id: 'zoom', name: 'TWO-HAND ZOOM', tag: 'NAVIGATE', tagCol: CY,
    desc: 'Pinch with both hands simultaneously — no card grabbed. Spread apart to zoom in, compress to zoom out. The focal point stays fixed.',
    mouse: 'Scroll wheel',
  },
  {
    id: 'pan', name: 'PAN BOARD', tag: 'NAVIGATE', tagCol: CY,
    desc: 'Pinch on empty space (dominant hand, no card under the pinch) and drag to translate the entire board in any direction.',
    mouse: 'Left-click drag on empty space',
  },
  {
    id: 'focus', name: 'FOCUS MODE', tag: 'PARENT', tagCol: '#ff8844',
    desc: 'Double-pinch your right hand on a PARENT card. The camera glides to the cluster, the rest of the board dims. Double-pinch again or press ESC to exit.',
    mouse: 'Click a PARENT card to focus · click again to open its editor',
  },
  {
    id: 'collapse', name: 'COLLAPSE — EXPAND', tag: 'PARENT', tagCol: GD,
    desc: 'Make a fist with your right hand over a PARENT card to fold all its children out of view. Fist again to reveal them. The badge shows the hidden count.',
    mouse: '— hand tracking only',
  },
  {
    id: 'link', name: 'LINK — STICKY PARENT', tag: 'CONNECT', tagCol: GD,
    desc: 'Grab two different cards with both hands and hold simultaneously for 1.5s. A parent-child link fires. Sticky-parent mode then activates — hold any additional card for 1.5s to adopt it.',
    mouse: '— hand tracking only',
  },
]

// ─── Gesture card ──────────────────────────────────────────────────────────────
function GestureCard({ g, active, onEnter, onLeave, delay }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(id)
  }, [delay])

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        display: 'flex', alignItems: 'stretch',
        border: `1px solid ${active ? g.tagCol + '55' : '#00ccff14'}`,
        borderRadius: 2,
        background: active ? 'rgba(0,18,36,0.94)' : 'rgba(0,6,18,0.72)',
        boxShadow: active ? `0 0 32px ${g.tagCol}16, inset 0 0 18px ${g.tagCol}07` : 'none',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'none' : 'translateY(10px)',
        transition: 'opacity 0.38s ease, transform 0.38s ease, border-color 0.20s, background 0.20s, box-shadow 0.20s',
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      {/* Illustration */}
      <div style={{
        flexShrink: 0, width: 180, height: 110,
        background: 'rgba(0,3,12,0.72)',
        borderRight: `1px solid ${active ? g.tagCol + '33' : '#001828'}`,
        transition: 'border-color 0.20s',
      }}>
        <GestureCanvas id={g.id} active={active} />
      </div>

      {/* Text */}
      <div style={{
        flex: 1, padding: '16px 22px',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, letterSpacing: '0.22em', fontWeight: 'bold',
            color: active ? '#ddeeff' : '#6a9aaa',
            transition: 'color 0.18s',
          }}>
            {g.name}
          </span>
          <span style={{
            fontSize: 7, letterSpacing: '0.16em', padding: '2px 8px',
            color: g.tagCol, border: `1px solid ${g.tagCol}44`,
            borderRadius: 1, flexShrink: 0,
          }}>
            {g.tag}
          </span>
        </div>
        <p style={{
          margin: 0, fontSize: 9.5, lineHeight: 1.80, letterSpacing: '0.04em',
          color: active ? '#6ab8c8' : '#2e6878',
          transition: 'color 0.18s',
        }}>
          {g.desc}
        </p>
        <div style={{
          fontSize: 7.5, letterSpacing: '0.10em',
          color: active ? '#1c4858' : '#0c2830',
          transition: 'color 0.18s',
        }}>
          MOUSE: {g.mouse}
        </div>
      </div>
    </div>
  )
}

// ─── INITIATE button ───────────────────────────────────────────────────────────
function InitiateButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(0,204,255,0.09)' : 'transparent',
        border: `1px solid ${hov ? CY : CY + '88'}`,
        color: CY,
        fontFamily: "'Courier New', monospace",
        fontSize: 13, letterSpacing: '0.50em', fontWeight: 'bold',
        padding: '15px 58px',
        cursor: 'pointer',
        textShadow: `0 0 ${hov ? 24 : 12}px ${CY}`,
        boxShadow: hov ? `0 0 44px ${CY}44, inset 0 0 22px ${CY}11` : `0 0 20px ${CY}22`,
        transition: 'all 0.22s ease',
        animation: 'sig-pulse 2.4s ease-in-out infinite',
      }}
    >
      INITIATE
    </button>
  )
}

// ─── Main Signals screen ───────────────────────────────────────────────────────
export default function Signals({ onInitiate, hasCamera }) {
  const [hovered, setHovered] = useState(null)
  const [headerIn, setHeaderIn] = useState(false)
  useEffect(() => { const id = setTimeout(() => setHeaderIn(true), 60); return () => clearTimeout(id) }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 110,
      background: '#000814',
      overflowY: 'auto', overflowX: 'hidden',
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,204,255,0.010) 2px, rgba(0,204,255,0.010) 4px)',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 700, margin: '0 auto',
        padding: '56px 24px 80px',
      }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <header style={{
          textAlign: 'center', marginBottom: 44,
          opacity: headerIn ? 1 : 0,
          transform: headerIn ? 'none' : 'translateY(-8px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          <div style={{
            height: 1,
            background: 'linear-gradient(to right, transparent, #00ccff88, #00ccff, #00ccff88, transparent)',
            marginBottom: 30,
          }} />

          <div style={{
            fontSize: 54, letterSpacing: '0.50em', fontWeight: 'bold',
            color: CY, textShadow: `0 0 44px ${CY}, 0 0 90px ${CY}44`,
          }}>
            SIGNALS
          </div>

          <div style={{
            fontSize: 8, color: '#2a6a7a', letterSpacing: '0.32em', marginTop: 10,
          }}>
            GESTURE REFERENCE — HAND TRACKING CONTROL SURFACE
          </div>

          <div style={{
            height: 1,
            background: 'linear-gradient(to right, transparent, #00ccff88, #00ccff, #00ccff88, transparent)',
            marginTop: 30,
          }} />

          {!hasCamera && (
            <div style={{
              marginTop: 14, fontSize: 8, color: '#cc6622',
              letterSpacing: '0.16em', textShadow: '0 0 8px #cc662244',
            }}>
              ⚠ CAMERA DENIED — RUNNING IN MOUSE MODE — HAND GESTURES UNAVAILABLE
            </div>
          )}
        </header>

        {/* ── Gesture cards ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {GESTURES.map((g, i) => (
            <GestureCard
              key={g.id}
              g={g}
              active={hovered === g.id}
              onEnter={() => setHovered(g.id)}
              onLeave={() => setHovered(null)}
              delay={100 + i * 65}
            />
          ))}
        </div>

        {/* ── INITIATE ────────────────────────────────────────── */}
        <div style={{
          marginTop: 60,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            height: 1, width: '100%',
            background: 'linear-gradient(to right, transparent, #00ccff44, transparent)',
          }} />
          <InitiateButton onClick={onInitiate} />
          <div style={{ fontSize: 7, color: '#1a4a5a', letterSpacing: '0.14em' }}>
            M — TOGGLE INPUT MODE
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sig-pulse {
          0%,100% { box-shadow: 0 0 18px ${CY}33, inset 0 0 10px ${CY}08; }
          50%      { box-shadow: 0 0 40px ${CY}66, inset 0 0 20px ${CY}14; }
        }
      `}</style>
    </div>
  )
}
