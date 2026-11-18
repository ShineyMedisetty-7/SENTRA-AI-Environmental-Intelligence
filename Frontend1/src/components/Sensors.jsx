
import { useEffect, useState } from 'react'
import { getSensors } from '../services/api'
import './Sensors.css'

const GROUPS = [
  {
    id: 'environment',
    label: 'Environment',
    description: 'Temperature, humidity, light, sound, gas and dust',
    icon: '◉',
    sensors: [
      { key: 'temperature', name: 'Temperature', model: 'DHT22', unit: '°C', icon: '°', color: 'blue' },
      { key: 'humidity', name: 'Humidity', model: 'DHT22', unit: '%', icon: '≈', color: 'cyan' },
      { key: 'light', name: 'Light Level', model: 'LDR', unit: '', icon: '☼', color: 'amber' },
      { key: 'sound_raw', name: 'Sound Level', model: 'MAX4466', unit: 'ADC', icon: '♫', color: 'pink' },
      { key: 'gas_raw', name: 'Air Quality', model: 'MQ Gas Sensor', unit: 'ADC', icon: '◎', color: 'green' },
      { key: 'dust_raw', name: 'Dust Sensor', model: 'Sharp GP2Y1010AU0F', unit: 'ADC', icon: '◌', color: 'violet' },
    ],
  },
  {
    id: 'movement',
    label: 'Movement',
    description: 'Motion detection and distance measurement',
    icon: '⌁',
    sensors: [
      { key: 'motion', name: 'Motion Detection', model: 'PIR Sensor', unit: '', icon: '↗', color: 'green' },
      { key: 'distance', name: 'Distance', model: 'VL53L0X ToF', unit: 'cm', icon: '↔', color: 'blue' },
    ],
  },
]

function getValue(reading) {
  if (reading && typeof reading === 'object' && 'value' in reading) {
    return reading.value
  }
  return reading ?? null
}

function formatValue(sensor, value) {
  if (value === null || value === undefined) return '—'

  if (sensor.key === 'motion') return value ? 'Detected' : 'Clear'

  if (sensor.key === 'light') {
    return Number(value) === 1 ? 'Signal High' : 'Signal Low'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toFixed(1)
  }

  return String(value)
}

function SensorCard({ sensor, reading, deviceOnline }) {
  const value = getValue(reading)
  const connected = deviceOnline && value !== null && value !== undefined
  const timestamp = reading?.timestamp || reading?.ts

  const isStale = timestamp &&
    // eslint-disable-next-line react-hooks/purity
    Date.now() - new Date(timestamp).getTime() > 30000

  const status = !connected
    ? 'Not Connected'
    : isStale
      ? 'Stale Data'
      : 'Connected'

  return (
    <article className={`st-card accent-${sensor.color}`}>
      <div className="st-card-head">
        <span className="st-icon" aria-hidden="true">{sensor.icon}</span>
        <span className={`st-status ${connected && !isStale ? 'is-online' : 'is-offline'}`}>
          <span className="st-status-dot" />
          {status}
        </span>
      </div>

      <div className="st-reading">
        {formatValue(sensor, value)}
        {connected && sensor.unit && (
          <span className="st-unit"> {sensor.unit}</span>
        )}
      </div>

      <div className="st-sensor-name">{sensor.name}</div>
      <div className="st-sensor-model">{sensor.model}</div>

      {['sound_raw', 'gas_raw', 'dust_raw'].includes(sensor.key) && connected && (
        <div className="st-hint">
          Raw ADC · Not a calibrated measurement
        </div>
      )}

      {sensor.key === 'light' && connected && (
        <div className="st-hint">Digital signal · Not measured in lux</div>
      )}

      {sensor.key === 'distance' && connected && (
        <div className="st-hint">Distance in centimetres</div>
      )}

      <div className="st-card-footer">
        <span>{timestamp && connected ? 'Last reading' : 'Awaiting data'}</span>
        <span>
          {timestamp && connected
            ? new Date(timestamp).toLocaleTimeString([], { hour12: false })
            : '—'}
        </span>
      </div>
    </article>
  )
}

export default function Sensors() {
  const [data, setData] = useState(null)
  const [apiState, setApiState] = useState('loading')
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [activeGroup, setActiveGroup] = useState('all')

  useEffect(() => {
    let active = true

    async function refresh() {
      try {
        const response = await getSensors()
        if (!active) return

        setData(response)
        setApiState(response?.source === 'esp32' ? 'online' : 'waiting')
        setError('')
        setLastUpdated(new Date())
      } catch (err) {
        if (!active) return
        setApiState('error')
        setError(err?.message || 'Could not reach the sensor API.')
      }
    }

    refresh()
    const timer = setInterval(refresh, 2000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const deviceOnline = apiState === 'online'

  const allSensors = GROUPS.flatMap(group =>
    group.sensors.map(sensor => ({ ...sensor, groupId: group.id }))
  )

  const connectedCount = allSensors.filter(sensor => {
    const value = getValue(data?.[sensor.key])
    return deviceOnline && value !== null && value !== undefined
  }).length

  const visibleGroups = activeGroup === 'all'
    ? GROUPS
    : GROUPS.filter(group => group.id === activeGroup)

  return (
    <section className="st-dashboard" aria-label="SENTRA sensor monitoring">
      <header className="st-header">
        <div>
          <div className="st-eyebrow">SENTRA / HARDWARE</div>
          <h2>Sensor Monitoring</h2>
          <p>Environmental awareness and real-time physical activity.</p>
        </div>

        <div className={`st-device-pill ${deviceOnline ? 'device-online' : 'device-offline'}`}>
          <span className="st-status-dot" />
          {deviceOnline ? 'ESP32 Connected' : 'ESP32 Not Connected'}
        </div>
      </header>

      <div className="st-overview">
        <div className="st-overview-card">
          <span className="st-overview-label">Active Readings</span>
          <strong>{connectedCount}<span> / {allSensors.length}</span></strong>
          <small>Based on available backend data</small>
        </div>

        <div className="st-overview-card">
          <span className="st-overview-label">Device</span>
          <strong className="st-device-name">{data?.device_id || 'ESP32-SENTRA'}</strong>
          <small>{deviceOnline ? 'Device data received' : 'Waiting for device data'}</small>
        </div>

        <div className="st-overview-card">
          <span className="st-overview-label">Last API Update</span>
          <strong className="st-device-name">
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], { hour12: false })
              : '—'}
          </strong>
          <small>{apiState === 'error' ? 'API unavailable' : 'Checks every 2 seconds'}</small>
        </div>
      </div>

      <nav className="st-tabs" aria-label="Sensor categories">
        <button
          type="button"
          className={activeGroup === 'all' ? 'active' : ''}
          onClick={() => setActiveGroup('all')}
        >
          All Sensors <span>{allSensors.length}</span>
        </button>

        {GROUPS.map(group => (
          <button
            type="button"
            key={group.id}
            className={activeGroup === group.id ? 'active' : ''}
            onClick={() => setActiveGroup(group.id)}
          >
            {group.label}
            <span>{group.sensors.length}</span>
          </button>
        ))}
      </nav>

      {apiState === 'error' && (
        <div className="st-alert">
          <strong>Cannot reach the backend</strong>
          <span>{error}</span>
          <span>Check that FastAPI is running and the frontend API URL is correct.</span>
        </div>
      )}

      {apiState === 'waiting' && (
        <div className="st-alert">
          <strong>ESP32 not connected</strong>
          <span>The backend is reachable, but it has not received readings from the ESP32.</span>
        </div>
      )}

      {visibleGroups.map(group => (
        <section className="st-group" key={group.id}>
          <div className="st-group-heading">
            <div className="st-group-symbol">{group.icon}</div>
            <div>
              <h3>{group.label}</h3>
              <p>{group.description}</p>
            </div>
            <span className="st-group-count">{group.sensors.length} sensors</span>
          </div>

          <div className="st-grid">
            {group.sensors.map(sensor => (
              <SensorCard
                key={sensor.key}
                sensor={sensor}
                reading={data?.[sensor.key]}
                deviceOnline={deviceOnline}
              />
            ))}
          </div>
        </section>
      ))}

      <footer className="st-footer">
        <span className="st-footer-dot" />
        Live refresh enabled
        <span>·</span>
        Unavailable readings are never estimated or invented.
      </footer>
    </section>
  )
}
