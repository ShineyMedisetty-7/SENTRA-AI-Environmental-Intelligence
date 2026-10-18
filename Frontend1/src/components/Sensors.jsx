import { useEffect, useState } from 'react'
import { getSensors } from '../services/api'



const DEF = [['temperature', 'Temperature', '°C', '#B24DFF'], ['humidity', 'Humidity', '%', '#32CFFF'], ['light', 'Light Intensity', 'lux', '#FFB547'], ['distance', 'Distance (ToF)', 'm', '#00D9A0']]
function Spark({ pts, color }) {
  const lo = Math.min(...pts), hi = Math.max(...pts), r = hi - lo || 1
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${28 - ((v - lo) / r) * 24}`).join(' ')
  return <svg viewBox="0 0 100 32" width="100%" height="32" preserveAspectRatio="none" aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}

export default function Sensors() {
  const [st, setSt] = useState('loading'), [data, setData] = useState(null), [hist, setHist] = useState({}), [msg, setMsg] = useState('')
   const [now, setNow] = useState(() => new Date().getTime())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().getTime()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    let on = true
    const tick = async () => {
      try {
        const d = await getSensors(); if (!on) return
        if (d === null) { setSt('missing'); return }
        setData(d); setSt('ok')
        setHist((h) => { const n = { ...h }; DEF.forEach(([k]) => { const v = d[k]?.value; if (typeof v === 'number') n[k] = [...(n[k] || []), v].slice(-30) }); return n })
      } catch (e) { if (on) { setSt('error'); setMsg(e.message) } }
    }
    tick(); const t = setInterval(tick, 5000)
    return () => { on = false; clearInterval(t) }
  }, [])
  const badge = st === 'ok' ? ['Connected', ''] : st === 'loading' ? ['Connecting…', 'dm'] : ['Disconnected', 'off']
  return (
    <section className="card c5" id="sensors" aria-label="Sensor readings">
      <div className="hd"><h2>Sensor Readings</h2><span className="pill"><span className={'dot ' + badge[1]} />{badge[0]}</span></div>
      <div className="sens">{DEF.map(([k, n, u, c]) => {
        const r = data?.[k]
const ts = r?.timestamp || r?.ts
const age = ts ? (now - new Date(ts).getTime()) / 1000 : null
        const stale = age !== null && age > 60
        return (<div className="s" key={k}>
          <b>{st === 'ok' && r?.value != null ? r.value : '—'}</b> {u}<small>{n}</small>
          {hist[k]?.length >= 3 ? <Spark pts={hist[k]} color={c} /> : <small>{st === 'ok' ? 'Collecting trend…' : 'No data'}</small>}
          <small>{ts ? `${stale ? 'Stale · ' : ''}${new Date(ts).toLocaleTimeString([], { hour12: false })}` : 'no timestamp'}</small></div>)
      })}</div>
      {st === 'missing' && <small className="note">No sensor endpoint yet. Expected <code>GET /sensors/latest</code> returning {'{temperature:{value,timestamp}, humidity, light, distance}'}.</small>}
      {st === 'error' && <small className="note err">Sensor request failed: {msg}</small>}
    </section>)
}
