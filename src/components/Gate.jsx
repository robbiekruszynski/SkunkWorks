import { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'

function GeoScene({ onActivate, msg, setMsg, busy, setBusy }) {
  const mountRef      = useRef(null)
  const hoveredRef    = useRef(false)   // whole-screen hover (for glow)
  const innerHovRef   = useRef(false)   // raycasted inner-shape hover (for speed)
  const hpRef         = useRef(0)       // screen hover progress
  const ihpRef        = useRef(0)       // inner hover progress

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const W = window.innerWidth, H = window.innerHeight

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000)
    camera.position.z = 5.5

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const mkLine = (hex, op) => new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: op })

    // ── Outer cage ───────────────────────────────────────────────────────────
    const matDode  = mkLine(0x001e33, 0.22)
    const dodeMesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(3.4, 0)), matDode)
    scene.add(dodeMesh)

    // ── Corona icosahedron ───────────────────────────────────────────────────
    const matIco  = mkLine(0x00ddff, 0.60)
    const icoMesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.0, 1)), matIco)
    scene.add(icoMesh)

    // Internal connectors
    const icoPos = icoMesh.geometry.attributes.position
    const connPts = []
    for (let i = 0; i < Math.min(icoPos.count, 120); i += 3) {
      const ax = icoPos.getX(i), ay = icoPos.getY(i), az = icoPos.getZ(i)
      for (let j = i + 3; j < Math.min(i + 18, icoPos.count); j += 3) {
        const bx = icoPos.getX(j), by = icoPos.getY(j), bz = icoPos.getZ(j)
        if (Math.hypot(ax-bx, ay-by, az-bz) < 1.6 && Math.random() < 0.22)
          connPts.push(ax, ay, az, bx, by, bz)
      }
    }
    const connGeo = new THREE.BufferGeometry()
    connGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(connPts), 3))
    const matConn  = mkLine(0x0055aa, 0.18)
    const connMesh = new THREE.LineSegments(connGeo, matConn)
    scene.add(connMesh)

    // ── Octahedron — electric blue mid-layer ─────────────────────────────────
    const matOct  = mkLine(0x2266ff, 0.80)
    const octMesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.15, 0)), matOct)
    scene.add(octMesh)

    // ── Dual tetrahedra (stella octangula) ───────────────────────────────────
    const matTetraA = mkLine(0x00ffaa, 0.92)
    const matTetraB = mkLine(0x44ffee, 0.75)
    const tetraA    = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(0.78, 0)), matTetraA)
    const tetraB    = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.TetrahedronGeometry(0.78, 0)), matTetraB)
    tetraB.rotation.set(Math.PI, Math.PI * 0.33, Math.PI * 0.66)
    scene.add(tetraA, tetraB)

    // Soft inner core glow
    const coreMat  = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.04 })
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 18), coreMat)
    scene.add(coreMesh)

    // ── Invisible hit sphere for inner-shape raycasting ──────────────────────
    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    scene.add(hitMesh)

    // ── Particle field — two ambient bands ───────────────────────────────────
    const mkParticles = (count, rMin, rMax, hex, sz, op) => {
      const pos = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
        const r = rMin + Math.random() * (rMax - rMin)
        pos[i*3] = r*Math.sin(phi)*Math.cos(theta); pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta); pos[i*3+2] = r*Math.cos(phi)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      return new THREE.Points(geo, new THREE.PointsMaterial({ color: hex, size: sz, transparent: true, opacity: op }))
    }
    const pInner = mkParticles(120, 2.4, 3.2, 0x00ccff, 0.045, 0.65)
    const pOuter = mkParticles(200, 3.8, 5.5, 0x0044aa, 0.025, 0.40)
    scene.add(pInner, pOuter)

    // ── Spark / ember system ─────────────────────────────────────────────────
    const SPARKS = 180
    const sPos   = new Float32Array(SPARKS * 3).fill(9999)
    const sCol   = new Float32Array(SPARKS * 3)
    const sparkGeo = new THREE.BufferGeometry()
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    sparkGeo.setAttribute('color',    new THREE.BufferAttribute(sCol, 3))
    const sparkMat = new THREE.PointsMaterial({ size: 0.055, transparent: true, opacity: 0.95, vertexColors: true, sizeAttenuation: true })
    scene.add(new THREE.Points(sparkGeo, sparkMat))

    const sparks = Array.from({ length: SPARKS }, () => ({ active: false, x:0,y:0,z:0, vx:0,vy:0,vz:0, life:0, maxLife:0, r:0,g:0,b:0 }))
    let sparkPool = 0

    function spawnSpark(ihp) {
      const s = sparks[sparkPool % SPARKS]; sparkPool++
      s.active  = true
      s.maxLife = 0.4 + Math.random() * 0.5
      s.life    = s.maxLife
      const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1)
      const r0 = 0.5 + Math.random() * 0.6
      s.x = r0*Math.sin(phi)*Math.cos(theta); s.y = r0*Math.sin(phi)*Math.sin(theta); s.z = r0*Math.cos(phi)
      const spd = (1.8 + Math.random() * 2.4) * ihp
      s.vx = s.x/r0*spd + (Math.random()-0.5)*0.6
      s.vy = s.y/r0*spd + (Math.random()-0.5)*0.6
      s.vz = s.z/r0*spd + (Math.random()-0.5)*0.6
      // Colour: cycle between mint, cyan, and white
      const c = Math.random()
      s.r = c < 0.33 ? 0.0 : c < 0.66 ? 0.1 : 0.9
      s.g = c < 0.66 ? 1.0 : 0.9
      s.b = c < 0.33 ? 0.7 : 1.0
    }

    // ── Raycaster ────────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouseNDC  = new THREE.Vector2()
    const mouse     = { x: 0, y: 0 }
    const mSmooth   = { x: 0, y: 0 }

    const onMouseMove = e => {
      mouseNDC.x =  (e.clientX / window.innerWidth)  * 2 - 1
      mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1
      mouse.x    =  (e.clientX / window.innerWidth  - 0.5) * 2
      mouse.y    =  (e.clientY / window.innerHeight - 0.5) * 2
      raycaster.setFromCamera(mouseNDC, camera)
      innerHovRef.current = raycaster.intersectObject(hitMesh).length > 0
    }
    window.addEventListener('mousemove', onMouseMove)

    let rafId, prevT = performance.now() / 1000

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const now = performance.now() / 1000
      const dt  = Math.min(now - prevT, 0.05)
      prevT     = now

      // Screen-wide glow progress (for brightness/opacity only)
      hpRef.current  += ((hoveredRef.current  ? 1 : 0) - hpRef.current)  * (1 - Math.exp(-dt * 2.5))
      // Inner shape speed progress (raycasted)
      ihpRef.current += ((innerHovRef.current ? 1 : 0) - ihpRef.current) * (1 - Math.exp(-dt * 4.0))
      const hp  = hpRef.current
      const ihp = ihpRef.current

      // Smooth mouse parallax
      mSmooth.x += (mouse.x - mSmooth.x) * (1 - Math.exp(-dt * 5))
      mSmooth.y += (mouse.y - mSmooth.y) * (1 - Math.exp(-dt * 5))

      // ── Speed tiers — inner speed driven purely by raycasted hover ────────
      // Base speeds are intentionally slow/meditative at rest
      const outerSpd  = 1.0                        // constant — outer never reacts
      const coronaSpd = 1 + hp  * 1.2              // brightens subtly on screen hover
      const innerSpd  = 1 + ihp * 11.0             // inner explodes only on raycast hit

      dodeMesh.rotation.x  += dt * 0.018 * outerSpd
      dodeMesh.rotation.y  -= dt * 0.024 * outerSpd

      icoMesh.rotation.x   += dt * 0.055 * coronaSpd + mSmooth.y * 0.003
      icoMesh.rotation.y   += dt * 0.075 * coronaSpd + mSmooth.x * 0.003
      connMesh.rotation.x   = icoMesh.rotation.x
      connMesh.rotation.y   = icoMesh.rotation.y

      octMesh.rotation.x   -= dt * 0.10  * (1 + ihp * 9.0)
      octMesh.rotation.y   += dt * 0.08  * (1 + ihp * 9.0)
      octMesh.rotation.z   += dt * 0.05  * (1 + ihp * 9.0)

      tetraA.rotation.x    += dt * 0.18  * innerSpd
      tetraA.rotation.y    -= dt * 0.14  * innerSpd
      tetraA.rotation.z    += dt * 0.10  * innerSpd

      tetraB.rotation.x    -= dt * 0.15  * innerSpd
      tetraB.rotation.y    += dt * 0.12  * innerSpd
      tetraB.rotation.z    -= dt * 0.09  * innerSpd

      pInner.rotation.y    += dt * 0.04  * coronaSpd
      pOuter.rotation.y    -= dt * 0.012

      // Breathe
      const breathe = 1 + (0.018 + ihp * 0.05) * Math.sin(now * (0.7 + ihp * 3))
      icoMesh.scale.setScalar(breathe)
      coreMat.opacity = 0.04 + ihp * 0.12

      // ── Sparks — emit only when inner shapes are hovered ─────────────────
      if (ihp > 0.05) {
        const rate = ihp * 28 * dt   // ~28 sparks/sec at full hover
        let emit   = rate
        while (emit > 0) {
          if (Math.random() < (emit > 1 ? 1 : emit)) spawnSpark(ihp)
          emit--
        }
      }

      // Update spark positions and write to buffer
      for (let i = 0; i < SPARKS; i++) {
        const s = sparks[i]
        if (!s.active) { sPos[i*3] = sPos[i*3+1] = sPos[i*3+2] = 9999; continue }
        s.life -= dt
        if (s.life <= 0) { s.active = false; sPos[i*3] = sPos[i*3+1] = sPos[i*3+2] = 9999; continue }
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt
        s.vy -= 0.25 * dt  // tiny gravity drag
        s.vx *= 1 - dt * 0.8; s.vy *= 1 - dt * 0.8; s.vz *= 1 - dt * 0.8  // drag
        const fade = Math.pow(s.life / s.maxLife, 0.6)
        sPos[i*3] = s.x; sPos[i*3+1] = s.y; sPos[i*3+2] = s.z
        sCol[i*3] = s.r*fade; sCol[i*3+1] = s.g*fade; sCol[i*3+2] = s.b*fade
      }
      sparkGeo.attributes.position.needsUpdate = true
      sparkGeo.attributes.color.needsUpdate    = true

      // ── Colour / opacity ramps — driven by hp (glow) and ihp (energy) ─────
      matDode.opacity   = 0.22 + hp * 0.14
      matIco.opacity    = 0.55 + hp * 0.38
      matConn.opacity   = 0.15 + ihp * 0.30
      matOct.opacity    = 0.75 + ihp * 0.22
      matTetraA.opacity = 0.88 + ihp * 0.12
      matTetraB.opacity = 0.70 + ihp * 0.28
      pInner.material.opacity = 0.60 + hp * 0.30
      pOuter.material.opacity = 0.38 + hp * 0.25

      matIco.color.setRGB(ihp * 0.4, 0.87 + ihp * 0.13, 1)
      matOct.color.setRGB(0.13 + ihp * 0.30, 0.40 + ihp * 0.30, 1)
      matTetraA.color.setRGB(ihp * 0.5, 1, 0.68 + ihp * 0.32)
      matTetraB.color.setRGB(0.27 + ihp * 0.5, 1, 0.93 + ihp * 0.07)
      coreMat.color.setRGB(ihp * 0.3, 1, 0.7 + ihp * 0.3)

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const W = window.innerWidth, H = window.innerHeight
      camera.aspect = W / H; camera.updateProjectionMatrix()
      renderer.setSize(W, H)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      renderer.dispose()
      sparkGeo.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  async function handleClick() {
    if (busy) return
    setBusy(true)
    setMsg('REQUESTING CAMERA ACCESS...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      })
      onActivate(stream)
    } catch {
      setMsg('CAMERA DENIED — LAUNCHING IN MOUSE MODE')
      setTimeout(() => onActivate(null), 1600)
    }
  }

  return (
    <div
      ref={mountRef}
      onClick={handleClick}
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
      style={{ position: 'absolute', inset: 0, cursor: busy ? 'wait' : 'pointer' }}
    />
  )
}

export default function Gate({ onActivate }) {
  const [msg,  setMsg]  = useState('')
  const [busy, setBusy] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#000814', overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <GeoScene
        onActivate={onActivate}
        msg={msg} setMsg={setMsg}
        busy={busy} setBusy={setBusy}
      />

      {/* Title overlay — pointer-events none so clicks pass through to scene */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, pointerEvents: 'none',
      }}>
        <div style={{
          width: 380, height: 1,
          background: 'linear-gradient(to right, transparent, #00ccff66, #00ccff, #00ccff66, transparent)',
        }} />

        <div style={{
          fontSize: 46, fontFamily: "'Courier New', monospace",
          color: '#00ccff', letterSpacing: '0.38em', fontWeight: 'bold',
          textShadow: '0 0 40px #00ccff, 0 0 100px #00ccff33',
        }}>
          SKUNKWORKS
        </div>

        <div style={{ fontSize: 9, color: '#2a5a7a', letterSpacing: '0.26em' }}>
          ▸ GESTURE-DRIVEN KNOWLEDGE SYSTEM ◂
        </div>

        <div style={{
          width: 380, height: 1,
          background: 'linear-gradient(to right, transparent, #00ccff66, #00ccff, #00ccff66, transparent)',
        }} />

        {/* Hover CTA — appears when mouse is over scene */}
        <div
          style={{
            marginTop: 120,
            fontSize: 11, letterSpacing: '0.28em',
            color: '#00ccff', fontFamily: "'Courier New', monospace",
            textShadow: '0 0 14px #00ccff',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.4s',
            animation: hovered ? 'gPulse 1.2s ease-in-out infinite' : 'none',
          }}
        >
          ◉ &nbsp; ACTIVATE
        </div>

        {msg && (
          <div style={{
            fontSize: 9, color: '#00ccff88', letterSpacing: '0.14em',
            marginTop: -8,
          }}>
            {msg}
          </div>
        )}
      </div>

      <style>{`
        @keyframes gPulse {
          0%, 100% { opacity: 0.7; text-shadow: 0 0 14px #00ccff; }
          50%       { opacity: 1;   text-shadow: 0 0 28px #00ccff, 0 0 50px #00ccffaa; }
        }
      `}</style>

      {/* Bottom hints */}
      <div style={{
        position: 'absolute', bottom: 28, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 7, color: '#1a4a5a', letterSpacing: '0.12em' }}>
          REQUIRES CAMERA ACCESS FOR HAND TRACKING
        </div>
        <div style={{ fontSize: 7, color: '#004455', letterSpacing: '0.12em' }}>
          MOUSE + SCROLL ALWAYS AVAILABLE AS FALLBACK
        </div>
      </div>
    </div>
  )
}
