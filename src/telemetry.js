// Live telemetry capture for one send attempt. No libraries, no storage —
// everything lives in memory from modal-open to Send-click.

export function startRecorder() {
  const rec = {
    points: [], // mouse path [x, y]
    keyTimes: [], // keydown timestamps (ms)
    pastedFields: new Set(),
    fieldMs: {}, // time spent focused per field
    _focusField: null,
    _focusStart: 0,
  }
  const fieldOf = (el) => el?.placeholder || el?.name || null
  const onMove = (e) => rec.points.push([e.clientX, e.clientY])
  const onKey = () => rec.keyTimes.push(performance.now())
  const onPaste = (e) => { const f = fieldOf(e.target); if (f) rec.pastedFields.add(f) }
  const onFocusIn = (e) => {
    const f = fieldOf(e.target)
    if (f) { rec._focusField = f; rec._focusStart = performance.now() }
  }
  const onFocusOut = () => {
    if (rec._focusField) {
      rec.fieldMs[rec._focusField] =
        (rec.fieldMs[rec._focusField] || 0) + (performance.now() - rec._focusStart)
      rec._focusField = null
    }
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('keydown', onKey)
  window.addEventListener('paste', onPaste, true)
  window.addEventListener('focusin', onFocusIn)
  window.addEventListener('focusout', onFocusOut)
  rec.stop = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('paste', onPaste, true)
    window.removeEventListener('focusin', onFocusIn)
    window.removeEventListener('focusout', onFocusOut)
  }
  return rec
}

// Summarize to the CONTRACTS.md telemetry shape.
// linearity → 1.0 means a perfectly straight (or absent) pointer path: machine-like.
// cadence variance → 0 means metronome typing (or no typing at all): machine-like.
export function summarize(rec, reviewShownAt) {
  const pts = rec.points
  let path = 0
  for (let i = 1; i < pts.length; i++) {
    path += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  }
  const straight = pts.length > 1
    ? Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1])
    : 0
  const linearity = path > 0 ? +(straight / path).toFixed(2) : 1

  const gaps = rec.keyTimes.slice(1).map((t, i) => t - rec.keyTimes[i])
  const mean = gaps.reduce((s, g) => s + g, 0) / (gaps.length || 1)
  const variance = gaps.length
    ? Math.round(Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length))
    : 0

  return {
    mouse_path_linearity: linearity,
    typing_cadence_var_ms: variance,
    hesitation_before_send_ms: Math.round(performance.now() - reviewShownAt),
    field_fill: rec.pastedFields.size >= 2 || (pts.length < 5 && rec.keyTimes.length === 0)
      ? 'paste_all'
      : 'typed',
  }
}
