// MOCK_BACKEND = true → the UI runs fully standalone: every API response is
// scripted in mock.js (scenarios, consent flow, verdicts). Copy the frontend
// folder anywhere, `npm install && npm run dev`, done — no backend needed.
// This constant is only the STARTUP DEFAULT — the scenario rail has a
// Mock/Real toggle that switches the live mode at runtime (in-memory only,
// per tab; no browser storage per hard rule 1).
export const MOCK_BACKEND = true

let mock = MOCK_BACKEND
const listeners = new Set()

export function isMock() {
  return mock
}

export function setMockMode(on) {
  mock = on === true
  for (const fn of listeners) fn(mock)
}

export function onMockModeChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
