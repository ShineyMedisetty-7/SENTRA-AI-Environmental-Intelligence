import { useMemo, useState } from 'react'

const COLS = { People: '#B24DFF', Objects: '#32CFFF', Motion: '#FFB547', 'Environmental Changes': '#00D9A0' }
const RANGES = { 'Last 1 Hour': 3600e3, 'Last 6 Hours': 6 * 3600e3, 'Last 24 Hours': 24 * 3600e3 }
const N = 12
const cat = (e) => { const s = `${e.type} ${e.title}`.toLowerCase()
  return /person|people/.test(s) ? 'People' : /motion/.test(s) ? 'Motion' : /environment|sensor|temperature|humidity/.test(s) ? 'Environmental Changes' : /object|chair|table/.test(s) ? 'Objects' : null }

// Counts of REAL stored events per time bucket (no synthetic data).
export default function ActivityChart({ events, status }) {
  const [r, setR] = useState('Last 1 Hour'); const [hover, setHover] = useState(null)
  const { b, max, total, t0 } = useMemo(() => {
    const span = RANGES[r]
const t1 = events.reduce(
  (latest, e) => Math.max(latest, new Date(e.ts).getTime() || 0),
  0
) || 0
const t0 = t1 - span
    const b = Array.from({ length: N }, () => Object.fromEntries(Object.keys(COLS).map((k) => [k, 0]))); let total = 0
    events.forEach((e) => { const t = new Date(e.ts).getTime(), c = cat(e); if (!c || !(t >= t0 && t <= t1)) return
      b[Math.min(N - 1, Math.floor(((t - t0) / span) * N))][c]++; total++ })
    return { b, max: Math.max(4, ...b.flatMap((x) => Object.values(x))), total, t0 }
  }, [events, r])
  const X = (i) => 34 + (i / (N - 1)) * 360, Y = (v) => 120 - (v / max) * 108
  const tl = (i) => new Date(t0 + ((i + 0.5) / N) * RANGES[r]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return (
    <section className="card c5" id="analytics" aria-label="Activity overview">
      <div className="hd"><h2>Activity Overview</h2><select value={r} onChange={(e) => setR(e.target.value)} aria-label="Time range">{Object.keys(RANGES).map((k) => <option key={k}>{k}</option>)}</select></div>
      {status !== 'ok' ? <div className="state">{status === 'loading' ? 'Loading…' : 'No data: events API unavailable.'}</div>
        : total === 0 ? <div className="state">No categorized events in this range.</div> : <>
        <svg viewBox="0 0 400 150" width="100%" onMouseLeave={() => setHover(null)} role="img" aria-label="Event counts over time">
          {[0, 0.5, 1].map((f) => <g key={f}><line x1="34" x2="396" y1={Y(max * f)} y2={Y(max * f)} stroke="#fff1" /><text x="2" y={Y(max * f) + 3} fontSize="9" fill="#9692B5">{Math.round(max * f)}</text></g>)}
          {[0, 5, 11].map((i) => <text key={i} x={X(i)} y="138" fontSize="9" fill="#9692B5" textAnchor="middle">{tl(i)}</text>)}
          <text x="2" y="10" fontSize="8" fill="#9692B5">events</text>
          {Object.entries(COLS).map(([k, c]) => <path key={k} fill="none" stroke={c} strokeWidth="2" d={b.map((x, i) => `${i ? 'L' : 'M'}${X(i)},${Y(x[k])}`).join('')} />)}
          {hover !== null && <line x1={X(hover)} x2={X(hover)} y1="8" y2="120" stroke="#fff3" />}
          {b.map((_, i) => <rect key={i} x={X(i) - 15} y="0" width="30" height="125" fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
        {hover !== null && <small className="note">{tl(hover)} — {Object.entries(b[hover]).map(([k, v]) => `${k}: ${v}`).join(' · ')}</small>}</>}
      <div className="leg">{Object.entries(COLS).map(([k, c]) => <span key={k}><i style={{ background: c }} />{k}</span>)}</div>
    </section>)
}
