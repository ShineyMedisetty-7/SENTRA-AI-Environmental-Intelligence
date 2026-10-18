import { useEffect, useRef, useState } from 'react'
import { cameraStatus, cameraStreamUrl, getDetections } from '../services/api'

export default function LiveEnvironment({ paused, setPaused }) {
  const [mode, setMode] = useState('backend')
  const [st, setSt] = useState({ state: 'connecting' })
  const [bump, setBump] = useState(0)
  const [det, setDet] = useState({ model: null, detections: [] })
  const [wcErr, setWcErr] = useState(null)
  const [wcOn, setWcOn] = useState(false)
  const [now, setNow] = useState(new Date())
  const wrap = useRef(null), video = useRef(null), media = useRef(null)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (mode !== 'backend' || paused) return
    let on = true
    const tick = async () => {
      try { const s = await cameraStatus(); on && setSt(s) }
      catch { on && setSt({ state: 'offline', error: 'Backend unreachable or camera router not mounted' }) }
    }
    tick(); const t = setInterval(tick, 3000)
    return () => { on = false; clearInterval(t) }
  }, [mode, paused])

  useEffect(() => {
    if (mode !== 'backend' || paused || st.state !== 'live') return
    let on = true
    const tick = () => getDetections().then((d) => on && setDet(d)).catch(() => on && setDet({ model: null, detections: [] }))
    tick(); const t = setInterval(tick, 1000)
    return () => { on = false; clearInterval(t) }
  }, [mode, paused, st.state])

  const stopWebcam = () => {
  media.current?.getTracks().forEach((track) => track.stop())
  media.current = null
  setWcOn(false)
}

useEffect(() => {
  return () => {
    media.current?.getTracks().forEach((track) => track.stop())
    media.current = null
  }
}, [])

useEffect(() => {
  if (mode !== 'webcam' && media.current) {
    media.current.getTracks().forEach((track) => track.stop())
    media.current = null
    setWcOn(false)
  }
}, [mode])

  const startWebcam = async () => {
    setWcErr(null)
    try {
      media.current = await navigator.mediaDevices.getUserMedia({ video: true })
      if (video.current) video.current.srcObject = media.current
      setWcOn(true)
    } catch (e) { setWcErr(e.name === 'NotAllowedError' ? 'Camera permission denied.' : e.message) }
  }

  const live = mode === 'backend' && !paused && st.state !== 'offline'
  const label = mode === 'webcam' ? (wcOn ? 'BROWSER' : 'OFF') : paused ? 'PAUSED' : st.state === 'live' ? 'LIVE' : st.state === 'connecting' ? 'CONNECTING' : 'OFFLINE'
  const colorClass = label === 'LIVE' || label === 'BROWSER' ? '' : ' p'

  return (
    <section className="card c6" id="live" ref={wrap} aria-label="Live environment">
      <div className="hd"><h2><span className={'dot' + (label === 'LIVE' || label === 'BROWSER' ? '' : ' off')} /> Live Environment</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Camera source" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="backend">Backend camera</option><option value="webcam">Browser webcam</option></select>
          {mode === 'backend' && <button className="btn" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>}
          <button className="btn" onClick={() => wrap.current?.requestFullscreen?.()}>Fullscreen</button></div></div>
      <div className="cam">
        {mode === 'backend' && live && st.state !== 'offline' && (
          <img key={bump} src={cameraStreamUrl(bump)} alt="Live camera feed" className="feed"
            onError={() => { setSt({ state: 'offline', error: 'Stream error' }); setTimeout(() => { setBump((b) => b + 1); setSt({ state: 'connecting' }) }, 5000) }} />)}
        {mode === 'webcam' && <video ref={video} className="feed" autoPlay muted playsInline />}
        {mode === 'webcam' && !wcOn && <div className="overlay-msg"><button className="btn" onClick={startWebcam}>Start browser camera</button>{wcErr && <p className="err">{wcErr}</p>}</div>}
        {mode === 'webcam' && wcOn && <button className="btn demo-note" onClick={stopWebcam}>Stop camera</button>}
        {mode === 'backend' && (paused || st.state === 'offline') && <div className="overlay-msg">{paused ? 'Stream paused' : <>Camera offline<br /><small>{st.error}</small></>}</div>}
        {mode === 'backend' && st.state === 'connecting' && !paused && <div className="overlay-msg">Connecting…</div>}
        {mode === 'backend' && st.state === 'live' && det.detections.map((d, i) => (
          <div key={i} className={'box' + (d.label === 'person' ? '' : ' o')} style={{ left: `${d.box[0] * 100}%`, top: `${d.box[1] * 100}%`, width: `${d.box[2] * 100}%`, height: `${d.box[3] * 100}%` }}>
            <span>{d.label === "person" ? `Person ${d.person_id ?? "—"}` : d.label} · {(Number(d.confidence) * 100).toFixed(0)}%</span></div>))}
        <div className="ov">{mode === 'backend' ? `CAM-1 (${st.source_type || '—'})` : 'Browser cam'} · {now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}</div>
        <div className={'live' + colorClass}>{label}</div>
      </div>
      <small className="note">{mode === 'backend' && st.state === 'live' && !det.model ? 'Video is live. No detection model connected — no boxes shown.' : mode === 'backend' && det.model ? `Detections: ${det.model}` : ''}</small>
    </section>
  )
}
