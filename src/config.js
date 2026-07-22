// MOCK_BACKEND = true → the UI runs fully standalone: every API response is
// scripted in mock.js (scenarios, consent flow, verdicts). Copy the frontend
// folder anywhere, `npm install && npm run dev`, done — no backend needed.
// Flip to false to integrate against the real FastAPI backend again.
export const MOCK_BACKEND = true
