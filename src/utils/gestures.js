export const PINCH_THRESHOLD = 0.040

export function lm2s(lm, canvasWidth, canvasHeight) {
  return {
    x: (1 - lm.x) * canvasWidth,
    y: lm.y * canvasHeight,
  }
}

export function pinchDist(lms) {
  const t = lms[4], i = lms[8]
  return Math.hypot(t.x - i.x, t.y - i.y)
}

export function isPinching(lms) {
  return pinchDist(lms) < PINCH_THRESHOLD
}

export function isApproachingPinch(lms) {
  return pinchDist(lms) < PINCH_THRESHOLD * 1.8
}

export function pinchScreen(lms, cw, ch) {
  const t = lm2s(lms[4], cw, ch)
  const i = lm2s(lms[8], cw, ch)
  return { x: (t.x + i.x) / 2, y: (t.y + i.y) / 2 }
}

export function indexTipScreen(lms, cw, ch) {
  return lm2s(lms[8], cw, ch)
}

// Fist: all fingertips curled below their PIP joints (y increases downward in image space)
export function isFist(lms) {
  return [[8,6],[12,10],[16,14],[20,18]].every(([tip,pip]) => lms[tip].y > lms[pip].y)
}
