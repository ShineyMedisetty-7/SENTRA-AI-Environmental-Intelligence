
import { useEffect, useState } from 'react'
import { getSensors } from '../services/api'
import './CompactSensors.css'

const SENSORS = [
  { key: 'temperature', name: 'Temperature', model: 'DHT22', unit: '°C' },
  { key: 'humidity', name: 'Humidity', model: 'DHT22', unit: '%' },
  { key: 'light', name: 'Light Level', model: 'LDR', unit: '' },
  { key: 'motion', name: 'Motion Detection', model: 'PIR Sensor', unit: '' },
  { key: 'distance', name: 'Distance', model: 'VL53L0X ToF', unit: 'cm' },
  { key: 'sound_raw', name: 'Sound Level', model: 'MAX4466', unit: 'ADC' },
  { key: 'gas_raw', name: 'Air Quality', model: 'MQ Gas Sensor', unit: 'ADC' },
  { key: 'dust_raw', name: 'Dust Sensor', model: 'Sharp GP2Y1010AU0F', unit: 'ADC' },
]

function getValue(reading) {
  if (reading && typeof reading === 'object' && 'value' in reading) {
    return reading.value
  }
  return reading ?? null
}

function formatValue(sensor, value) {
  if (value === null || value === undefined) return '—'

  if (sensor.key === 'motion') {
    return value ? 'Detected' : 'Clear'
  }

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

export default function CompactSensors() {
  const [data, setData] = useState(null)
  const [apiError, setApiError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let active = true

    async function refresh() {
      try {
        const response = await getSensors()
        if (!active) return

        setData(response)
        setApiError(false)
        setLastUpdated(new Date())
      } catch {
        if (active) setApiError(true)
      }
    }

    refresh()
    const timer = setInterval(refresh, 2000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const online = data?.source === 'esp32' && !apiError

  const connectedCount = SENSORS.filter(sensor => {
    const value = getValue(data?.[sensor.key])
    return online && value !== null && value !== undefined
  }).length

  return (
    <section
      className="compact-dashboard-sensors"
      aria-label="SENTRA dashboard sensor summary"
    >
      <header className="cds-heading">
        <div>
          <h2>Live Sensors</h2>
          <p>Real-time readings from SENTRA hardware</p>
        </div>

        <span className={`cds-device ${online ? 'online' : 'offline'}`}>
          <span className="cds-dot" />
          {apiError
            ? 'API Offline'
            : online
              ? 'ESP32 Connected'
              : 'Waiting for ESP32'}
        </span>
      </header>

      <div className="cds-summary">
        <div>
          <span>Active Readings</span>
          <strong>{connectedCount} / {SENSORS.length}</strong>
        </div>

        <div>
          <span>Device ID</span>
          <strong>{data?.device_id || 'ESP32-SENTRA'}</strong>
        </div>

        <div>
          <span>Last API Update</span>
          <strong>
            {lastUpdated
              ? lastUpdated.toLocaleTimeString([], { hour12: false })
              : '—'}
          </strong>
        </div>
      </div>

      {apiError && (
        <p className="cds-error">
          Cannot reach the sensor API. Check that the backend is running.
        </p>
      )}

      <div className="cds-grid">
        {SENSORS.map(sensor => {
          const reading = data?.[sensor.key]
          const value = getValue(reading)
          const connected = online && value !== null && value !== undefined
          const timestamp = reading?.timestamp || reading?.ts

          return (
            <article className="cds-card" key={sensor.key}>
              <div className="cds-card-top">
                <span className="cds-name">{sensor.name}</span>
                <span className={`cds-status ${connected ? 'connected' : 'disconnected'}`}>
                  <span className="cds-dot" />
                  {connected ? 'Connected' : 'Not connected'}
                </span>
              </div>

              <strong className="cds-value">
                {formatValue(sensor, value)}
                {connected && sensor.unit && (
                  <small> {sensor.unit}</small>
                )}
              </strong>

              <span className="cds-model">{sensor.model}</span>

              {['sound_raw', 'gas_raw', 'dust_raw'].includes(sensor.key) && connected && (
                <span className="cds-note">
                  Raw ADC · Not calibrated
                </span>
              )}

              {sensor.key === 'light' && connected && (
                <span className="cds-note">
                  Digital signal · Not lux
                </span>
              )}

              {sensor.key === 'distance' && connected && (
                <span className="cds-note">
                  Distance in centimetres
                </span>
              )}

              <div className="cds-card-footer">
                <span>{timestamp && connected ? 'Last reading' : 'Awaiting data'}</span>
                <span>
                  {timestamp && connected
                    ? new Date(timestamp).toLocaleTimeString([], { hour12: false })
                    : '—'}
                </span>
              </div>
            </article>
          )
        })}
      </div>

      <footer className="cds-footer">
        <span className="cds-dot" />
        Live refresh every 2 seconds
        <span>·</span>
        {connectedCount} of {SENSORS.length} sensors reporting
      </footer>
    </section>
  )
}
