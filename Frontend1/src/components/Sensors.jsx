
import { useEffect, useState } from 'react'
import { getSensors } from '../services/api'

const DEF = [
  ['motion', 'Motion Detection', '', '#00D9A0'],
  ['temperature', 'Temperature', '°C', '#B24DFF'],
  ['humidity', 'Humidity', '%', '#32CFFF'],
  ['light', 'Light Status', '', '#FFB547'],
  ['distance', 'Distance (ToF)', 'm', '#00D9A0'],
]

const LIGHT_LEVELS = ['Dark', 'Dim', 'Low', 'Medium', 'Bright']

function Spark({ pts, color }) {
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const range = hi - lo || 1

  const d = pts
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${(i / Math.max(pts.length - 1, 1)) * 100},${28 - ((v - lo) / range) * 24}`
    )
    .join(' ')

  return (
    <svg
      viewBox="0 0 100 32"
      width="100%"
      height="32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default function Sensors() {
  const [st, setSt] = useState('loading')
  const [data, setData] = useState(null)
  const [hist, setHist] = useState({})
  const [msg, setMsg] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let on = true

    const tick = async () => {
      try {
        const d = await getSensors()
        if (!on) return

        if (!d) {
          setSt('missing')
          return
        }

        setData(d)
        setSt('ok')
        setMsg('')

        setHist((previous) => {
          const next = { ...previous }

          DEF.forEach(([key]) => {
            const value = d[key]?.value

            if (typeof value === 'number') {
              next[key] = [...(next[key] || []), value].slice(-30)
            }
          })

          return next
        })
      } catch (error) {
        if (on) {
          setSt('error')
          setMsg(error.message || 'Unable to fetch sensor readings')
        }
      }
    }

    tick()
    const timer = setInterval(tick, 5000)

    return () => {
      on = false
      clearInterval(timer)
    }
  }, [])

  const badge =
    st === 'ok'
      ? ['Connected', '']
      : st === 'loading'
        ? ['Connecting…', 'dm']
        : ['Disconnected', 'off']

  return (
    <section
      className="card c5"
      id="sensors"
      aria-label="Sensor readings"
    >
      <div className="hd">
        <h2>Sensor Readings</h2>
        <span className="pill">
          <span className={'dot ' + badge[1]} />
          {badge[0]}
        </span>
      </div>

      <div className="sens">
        {DEF.map(([key, name, unit, color]) => {
          const reading = data?.[key]
          const timestamp = reading?.timestamp || reading?.ts
          const age = timestamp
            ? (now - new Date(timestamp).getTime()) / 1000
            : null
          const stale = age !== null && age > 60
          const value = reading?.value

          let displayValue = '—'

          if (value != null) {
            if (key === 'motion') {
              displayValue = value ? 'Detected' : 'Clear'
            } else if (key === 'light') {
              // Digital DO gives only two states, not five measured levels.
              // Adjust this mapping after checking your module's response.
              displayValue = Number(value) === 1 ? 'Dim' : 'Bright'
            } else {
              displayValue = value
            }
          }

          return (
            <div className="s" key={key}>
              <b>{st === 'ok' ? displayValue : '—'}</b>
              {unit && ` ${unit}`}
              <small>{name}</small>

              {key === 'light' ? (
                <small>
                  {value == null
                    ? 'Waiting for sensor'
                    : `Digital reading: ${value}`}
                </small>
              ) : hist[key]?.length >= 3 ? (
                <Spark pts={hist[key]} color={color} />
              ) : (
                <small>
                  {value == null
                    ? 'Waiting for sensor'
                    : 'Collecting trend…'}
                </small>
              )}

              <small>
                {timestamp
                  ? `${stale ? 'Stale · ' : ''}${new Date(timestamp).toLocaleTimeString([], { hour12: false })}`
                  : 'No reading yet'}
              </small>
            </div>
          )
        })}
      </div>

      {st === 'missing' && (
        <small className="note">
          No sensor data returned. Check GET /sensors/latest.
        </small>
      )}

      {st === 'error' && (
        <small className="note err">
          Sensor request failed: {msg}
        </small>
      )}
    </section>
  )
}
