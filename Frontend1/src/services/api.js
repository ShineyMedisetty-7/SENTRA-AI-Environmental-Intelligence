const BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8765'
const AI_PATH = import.meta.env.VITE_AI_PATH || ''
const sig = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined)
export const API_BASE = BASE

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, { signal: sig(8000), ...opts })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  try { return await r.json() } catch { throw new Error('Invalid JSON from server') }
}

export function normalizeEvent(e, i) {
  const personId = e.person_id ?? null
  const rawType = String(e.event_type || e.type || e.category || 'event')
  const description = e.description || e.details || null

  let title = e.title || e.label || description || rawType.replaceAll('_', ' ')
  if (!e.title && !e.label && rawType === 'person_detected' && personId !== null) {
    title = `Person ${personId} detected`
  }

  return {
    id: e.id ?? i,
    title,
    type: String(e.category || e.event_type || e.type || 'event').toLowerCase(),
    zone: e.zone || e.location || '—',
    ts: e.timestamp || e.created_at || e.time || e.detected_at || null,
    severity: String(e.severity || 'normal').toLowerCase(),
    confidence: e.confidence ?? null,
    image: e.image_url || e.snapshot || e.thumbnail || null,
    detail: description,
    personId,
    eventType: rawType,
  }
}
export async function getEvents() {
  const d = await req('/events/')
  const list = Array.isArray(d) ? d : d.events || d.items || []
  return list.map(normalizeEvent).sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)).slice(0, 200)
}

// Real health check: /health if present, else FastAPI's always-on /openapi.json.
export async function health() {
  for (const p of ['/health', '/openapi.json']) {
    try { if ((await fetch(BASE + p, { signal: sig(3000) })).ok) return true } catch { /* try next */ }
  }
  return false
}

// Camera (backend/camera_service.py)
export const cameraStreamUrl = (n) => `${BASE}/camera/stream?n=${n}`
export const cameraStatus = () => req('/camera/status')
export const getDetections = () => req('/camera/detections')

// Sensors: expected GET /sensors/latest ->
// { temperature:{value,timestamp}, humidity:{...}, light:{...}, distance:{...} }
// Returns null when the endpoint does not exist (404).
export async function getSensors() {
  try { return await req('/sensors/latest') } catch (e) { if (e.message === 'HTTP 404') return null; throw e }
}

export async function askAI(question, eventId) {
  if (!AI_PATH) throw new Error('AI endpoint not configured (set VITE_AI_PATH).')
  const d = await req(AI_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, event_id: eventId }) })
  return d.answer || d.explanation || d.response || JSON.stringify(d)
}
