import { useState, useEffect, useRef } from 'react'

export function useHandTracking(videoRef, active) {
  const [handState, setHandState] = useState([])
  const mpRef = useRef(null)

  useEffect(() => {
    if (!active) { setHandState([]); return }

    // Load MediaPipe via CDN script tag (avoids WASM bundling issues)
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
        const s = document.createElement('script')
        s.src = src
        s.crossOrigin = 'anonymous'
        s.onload  = resolve
        s.onerror = reject
        document.head.appendChild(s)
      })
    }

    let rafId
    let cancelled = false

    async function init() {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js')

      if (cancelled) return

      const mp = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`
      })

      mp.setOptions({
        maxNumHands:            2,
        modelComplexity:        1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence:  0.5,
      })

      mp.onResults(results => {
        if (cancelled) return
        const hs = []
        if (results.multiHandLandmarks) {
          results.multiHandLandmarks.forEach((lms, i) => {
            hs.push({ lms, handedness: results.multiHandedness[i].label })
          })
        }
        setHandState(hs)
      })

      mpRef.current = mp

      let sending = false
      async function sendFrame() {
        if (cancelled) return
        const v = videoRef.current
        if (!sending && v && v.readyState >= 2) {
          sending = true
          try { await mp.send({ image: v }) } catch (_) {}
          sending = false
        }
        rafId = requestAnimationFrame(sendFrame)
      }
      sendFrame()
    }

    init()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      if (mpRef.current) { mpRef.current.close?.(); mpRef.current = null }
      setHandState([])
    }
  }, [active, videoRef])

  return handState
}
