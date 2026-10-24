import { useEffect, useMemo, useRef, useState } from 'react'
import { lazy, Suspense } from 'react'
import { getEvents, askAI, health, API_BASE } from './services/api'
import LiveEnvironment from './components/LiveEnvironment'
import Sensors from './components/Sensors'
import ActivityChart from './components/ActivityChart'
const DigitalTwin = lazy(() => import('./components/DigitalTwin'))

const P = {
  Dashboard: 'M3 11l9-8 9 8v10H3z', 'Live View': 'M3 6h12v12H3zM15 10l6-3v10l-6-3', 'Digital Twin': 'M12 2l9 5v10l-9 5-9-5V7zM12 12l9-5M12 12v10M12 12L3 7',
  Events: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4', Analytics: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8', Sensors: 'M10 3h4v10a4 4 0 11-4 0z', Environment: 'M5 19C5 9 11 5 20 4c0 9-4 15-15 15zM5 19l8-8',
  History: 'M12 7v5l3 2M3 12a9 9 0 109-9 9 9 0 00-7 3M3 4v4h4', Settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12l2-1-2-4-2 1-2-1-1-2H9L8 7 6 8 4 7 2 11l2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z',
}
const Ico = ({ n }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={P[n]} /></svg>
const NAV = Object.keys(P)

const fmt = (t) => (t ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(t) ? t : `${t}Z`).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '—')
const fmtFull = (t) => (t ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(t) ? t : `${t}Z`).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '—')






function Current({ ev, onDetails }) {
  return (
    <section className="card c4" aria-label="Current event">
      <div className="hd"><h2>Current Event</h2></div>
      {!ev ? <div className="state">Select an event.</div> : <>
        <div className="hd"><b>{ev.title}</b><span className={'badge ' + ev.severity}>{ev.severity}</span></div>
        <div className="kv"><span>Time</span><b>{fmt(ev.ts)}</b><span>Zone</span><b>{ev.zone}</b><span>Confidence</span><b>{ev.confidence ?? 'n/a'}</b><span>Evidence</span><b>{ev.image ? <img src={ev.image} alt="" height="40" /> : 'none available'}</b></div>
        <button className="btn" style={{ marginTop: 10 }} onClick={onDetails}>View Details →</button></>}
    </section>
  )
}

function AI({ ev }) {
  const [q, setQ] = useState(''); const [st, setSt] = useState({ s: 'empty' })
  const submit = async () => { if (!q.trim()) return; setSt({ s: 'loading' })
    
try {
  const result = await askAI(q, ev?.id)

  setSt({
    s: 'ok',
    text: result.answer,
    mode: result.mode,
    snapshotUrl: result.snapshot_url
      ? `${API_BASE}${result.snapshot_url}`
      : null,
    snapshotTimestamp: result.snapshot_timestamp,
    at: new Date(),
  })
} catch (e) {
  setSt({ s: 'err', text: e.message })
}
}
  return (
    <section className="card c3 glow ai" aria-label="AI explanation">
      <div className="hd"><h2>✦ AI Explanation</h2><span className="tag">BETA</span></div>
      <div className="state" role="status" style={{ textAlign: 'left', padding: '4px 0 10px' }}>
        {st.s === 'empty' && 'Ask a question about the selected event.'}
        {st.s === 'loading' && 'Thinking…'}
        {st.s === 'err' && <span className="err">{st.text}</span>}
        
{st.s === 'ok' && (
  <>
    <div style={{ whiteSpace: 'pre-wrap' }}>{st.text}</div>

    {st.snapshotUrl && (
      <div style={{ marginTop: 12 }}>
        <b>Historical Camera Snapshot</b>

        <img
          src={st.snapshotUrl}
          alt="Camera snapshot from the requested time"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            marginTop: 8,
            borderRadius: 8,
            border: '1px solid #334155',
          }}
        />

        {st.snapshotTimestamp && (
          <small>
            Snapshot time: {fmtFull(
              new Date(Number(st.snapshotTimestamp) * 1000).toISOString()
            )}
          </small>
        )}
      </div>
    )}

    <br />
    <small>Event: {ev?.title} · {fmt(ev?.ts)}</small>
  </>
)}

      </div>
      <textarea rows="2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Why was this flagged?" aria-label="Question" />
      <button className="btn" style={{ marginTop: 6 }} onClick={submit} disabled={st.s === 'loading'}>Ask</button>
    </section>
  )
}

function Events({ events, status, q, sel, setSel, onAll, onRetry }) {
  const [cat, setCat] = useState('all'), [sev, setSev] = useState('all')
  const cats = ['all', ...new Set(events.map((e) => e.type))]
  const list = events.filter((e) => (cat === 'all' || e.type === cat) && (sev === 'all' || e.severity === sev) && `${e.title} ${e.zone} ${e.type}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <section className="card c4" id="events" aria-label="Recent events">
      <div className="hd"><h2>Recent Events</h2><select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">{cats.map((c) => <option key={c}>{c}</option>)}</select><select value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Severity">{['all', 'normal', 'warning', 'critical'].map((c) => <option key={c}>{c}</option>)}</select><button className="link" onClick={onAll}>View All →</button></div>
      {status === 'loading' && <div className="state">Loading events…</div>}
      {status === 'error' && <div className="state err">Could not load events. <button className="btn" onClick={onRetry}>Retry</button></div>}
      {status === 'ok' && !list.length && <div className="state">No events match.</div>}
      {list.slice(0, 6).map((e) => <button key={e.id} className={'ev' + (sel?.id === e.id ? ' on' : '')} onClick={() => setSel(e)}>
        {e.image ? <img className="th" src={e.image} alt="" /> : <span className="th">{e.type.slice(0, 3)}</span>}
        <span><b>{e.title}</b><br /><small>{e.zone}{e.personId !== null && e.personId !== undefined ? ` · Person ID: ${e.personId}` : ""}</small></span><small>{fmt(e.ts)}</small><span className={'badge ' + e.severity}>{e.severity}</span></button>)}
    </section>
  )
}


function Zones({ onManage }) {
  const [z, setZ] = useState(null)
  const Z = [['B', 'Workspace', 10, 10, 90, 50, '#3b82f6'], ['C', 'Meeting Area', 160, 10, 90, 50, '#a855f7'], ['A', 'Entrance', 85, 60, 90, 40, '#22c55e']]
  return (
    <section className="card c3" id="zones" aria-label="Environment zones">
      <div className="hd"><h2>Environment Zones <span className="tag">demo layout</span></h2><button className="link" onClick={onManage}>Manage Zones</button></div>
      <svg viewBox="0 0 260 110" width="100%"><rect x="2" y="2" width="256" height="106" rx="6" fill="none" stroke="#7c4dff" />
        {Z.map(([k, n, x, y, w, h, c]) => <g key={k} className="zone" onClick={() => setZ(k)} tabIndex="0" role="button" aria-label={`Zone ${k} ${n}`}>
          <rect {...{ x, y, width: w, height: h }} fill={c + '33'} stroke={c} strokeWidth={z === k ? 3 : 1.5} /><text x={x + 6} y={y + 18} fontSize="11" fill="#fff">Zone {k}</text><text x={x + 6} y={y + 31} fontSize="9" fill="#cbd5e1">{n}</text></g>)}</svg>
      {z && <small style={{ color: 'var(--mut)' }}>Occupancy for Zone {z}: no backend data.</small>}
    </section>
  )
}

function Modal({ title, children, onClose }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [onClose])
  return <div className="modal" onClick={onClose}><div className="card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}><div className="hd"><h2>{title}</h2><button className="btn" onClick={onClose}>Close</button></div>{children}</div></div>
}

export default function App() {
  const [nav, setNav] = useState('Dashboard'); const [q, setQ] = useState(''); const [paused, setPaused] = useState(false)
  const [events, setEvents] = useState([]); const [status, setStatus] = useState('loading'); const [sel, setSel] = useState(null)
  const [modal, setModal] = useState(null); const [bell, setBell] = useState(false); const [prof, setProf] = useState(false)
  const inp = useRef(null)

const [online, setOnline] = useState(null)

const load = () => {
  setStatus('loading')
  getEvents()
    .then((d) => {
      setEvents(d)
      setSel((s) => s || d[0] || null)
      setStatus('ok')
    })
    .catch(() => {
      setEvents([])
      setStatus('error')
    })
}

useEffect(() => {
  getEvents()
    .then((d) => {
      setEvents(d)
      setSel((s) => s || d[0] || null)
      setStatus('ok')
    })
    .catch(() => {
      setEvents([])
      setStatus('error')
    })
}, [])

  useEffect(() => {
    const timer = setInterval(() => {
      getEvents()
        .then((data) => {
          setEvents(data)
          setSel((current) => {
            if (!current) return data[0] || null
            return data.find((event) => event.id === current.id) || current
          })
          setStatus('ok')
        })
        .catch(() => {})
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => { let on = true; const t = () => health().then((h) => on && setOnline(h)); t(); const i = setInterval(t, 10000); return () => { on = false; clearInterval(i) } }, [])
  const go = (n) => {
    setNav(n)
    setBell(false)
    setProf(false)
    setModal(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  useEffect(() => { const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inp.current?.focus() } }; addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [])
  const alerts = useMemo(() => events.filter((e) => e.severity !== 'normal'), [events])
  const demo = online === false
  return (
    <div className="app">
      <nav className="side" aria-label="Main">
        <div className="logo"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" stroke="#22d3ee" /></svg><div><b>SENTRA</b><small>Environmental Intelligence</small></div></div>
        {NAV.map((n) => <button key={n} className={'nav' + (nav === n ? ' on' : '')} onClick={() => go(n)} aria-current={nav === n ? 'page' : undefined}><Ico n={n} /><span>{n}</span></button>)}
        <div className="sys"><b>SENTRA</b><br />{online === null ? 'Checking backend…' : online ? 'Backend connected' : 'Backend offline'}</div>
      </nav>
      <div className="main">
        <header className="top">
          <label className="search"><span aria-hidden="true">⌕</span><input ref={inp} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events, people, objects, zones…" aria-label="Search events" /><span className="kbd">⌘ K</span></label>
          <span className="pill lm"><span className={'dot' + (demo ? ' off' : '')} />{online === null ? 'Checking…' : online ? 'API online' : 'API offline'}</span>
          <div style={{ position: 'relative' }}><button className="iconbtn" aria-label="Notifications" onClick={() => { setBell(!bell); setProf(false) }}>🔔{alerts.length > 0 && <span className="dot dm" style={{ position: 'absolute', top: 6, right: 6 }} />}</button>
            {bell && <div className="menu">{alerts.length ? alerts.map((a) => <div key={a.id}>{a.title} · {a.zone} · {fmt(a.ts)}</div>) : <div>No warnings or alerts.</div>}</div>}</div>
          <div style={{ position: 'relative' }}><button className="av" aria-label="Profile menu" onClick={() => { setProf(!prof); setBell(false) }}>S</button>{prof && <div className="menu"><div>Shiney · Admin</div><div>Auth not implemented</div></div>}</div>
        </header>

<main className="grid" id="top">
  {nav === 'Dashboard' && (
    <>
      <LiveEnvironment paused={paused} setPaused={setPaused} />
      <Suspense fallback={<section className="card c6"><div className="state">Loading 3D scene…</div></section>}>
        <DigitalTwin />
      </Suspense>
      <Sensors />
      <Current ev={sel} onDetails={() => setModal('event')} />
      <AI ev={sel} />
      <Events events={events} status={status} q={q} sel={sel} setSel={setSel} onAll={() => setModal('all')} onRetry={load} />
      <ActivityChart events={events} status={status} />
      <Zones onManage={() => setModal('zones')} />
    </>
  )}

  {nav === 'Live View' && (
    <div className="full-page">
      <h1>Live Camera Monitoring</h1>
      <LiveEnvironment paused={paused} setPaused={setPaused} />
    </div>
  )}

  {nav === 'Digital Twin' && (
    <div className="full-page">
      <h1>Digital Twin Workspace</h1>
      <Suspense fallback={<div className="state">Loading 3D scene…</div>}>
        <DigitalTwin />
      </Suspense>
    </div>
  )}

  {nav === 'Events' && (
    <div className="full-page">
      <h1>Event Monitoring</h1>
      <Events events={events} status={status} q={q} sel={sel} setSel={setSel} onAll={() => setModal('all')} onRetry={load} />
      <Current ev={sel} onDetails={() => setModal('event')} />
    </div>
  )}

  {nav === 'Analytics' && (
    <div className="full-page">
      <h1>Analytics</h1>
      <ActivityChart events={events} status={status} />
    </div>
  )}

  {nav === 'Sensors' && (
    <div className="full-page">
      <h1>Sensor Monitoring</h1>
      <Sensors />
    </div>
  )}

  {nav === 'Environment' && (
    <div className="full-page">
      <h1>Environment Zones</h1>
      <Zones onManage={() => setModal('zones')} />
      <Sensors />
    </div>
  )}

  {nav === 'History' && (
    <div className="full-page">
      <h1>Event History</h1>
      <button className="btn" onClick={() => setModal('all')}>
        View All Events
      </button>
      <Events events={events} status={status} q={q} sel={sel} setSel={setSel} onAll={() => setModal('all')} onRetry={load} />
    </div>
  )}

  {nav === 'Settings' && (
    <div className="full-page">
      <h1>SENTRA Settings</h1>
      <section className="card">
        <div className="kv">
          <span>Backend</span><b>{API_BASE}</b>
          <span>Status</span><b>{online ? 'Connected' : 'Offline'}</b>
          <span>Events</span><b>{status}</b>
        </div>
        <button className="btn" style={{ marginTop: 16 }} onClick={() => setModal('settings')}>
          View API Configuration
        </button>
      </section>
    </div>
  )}
</main>

      </div>
      {modal === 'event' && sel && <Modal title={sel.title} onClose={() => setModal(null)}><div className="kv"><span>Type</span><b>{sel.type}</b><span>When</span><b>{fmtFull(sel.ts)}</b><span>Zone</span><b>{sel.zone}</b><span>Severity</span><b>{sel.severity}</b><span>Confidence</span><b>{sel.confidence ?? 'n/a'}</b><span>Details</span><b>{sel.detail || '—'}</b></div></Modal>}
      {modal === 'all' && <Modal title={`All events (${events.length})`} onClose={() => setModal(null)}>{events.map((e) => <button key={e.id} className="ev" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => { setSel(e); setModal(null) }}><span>{e.title} <small>{e.zone}</small></span><small>{fmtFull(e.ts)}</small></button>)}</Modal>}
      {modal === 'settings' && <Modal title="Settings" onClose={() => setModal(null)}><div className="kv"><span>API base</span><b>{API_BASE}</b><span>Health</span><b>{online === null ? 'checking' : online ? 'reachable' : 'unreachable'}</b><span>Events</span><b>{status}</b></div><small className="note">Change via VITE_API_BASE_URL in .env.</small></Modal>}
      {modal === 'zones' && <Modal title="Manage Zones" onClose={() => setModal(null)}><div className="state">Zone management needs backend support (no zones endpoint found/connected).</div></Modal>}
    </div>
  )
}
