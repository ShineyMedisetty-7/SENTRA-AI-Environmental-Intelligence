
import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Edges } from '@react-three/drei'
import { getDetections } from '../services/api'

const VIEWS = {
  '3D View': [8, 7, 9],
  'Top View': [0, 14, 0.01],
  'Zone View': [0, 10, 7],
}

const ZONES = [
  { k: 'A', n: 'Entrance', c: '#00D9A0', x: [-2, 2], z: [1.5, 3.8] },
  { k: 'B', n: 'Workspace', c: '#32CFFF', x: [-4.8, -0.4], z: [-3.8, 0.6] },
  { k: 'C', n: 'Meeting Area', c: '#B24DFF', x: [0.4, 4.8], z: [-3.8, 0.6] },
]

const START = [
  { id: 3, kind: 'table', x: -2.6, z: -2.4 },
  { id: 4, kind: 'table', x: 2.6, z: -1.6 },
  { id: 5, kind: 'chair', x: -2.6, z: -1.2 },
  { id: 6, kind: 'chair', x: 2.6, z: -0.4 },
]

const inZone = (o, z) =>
  o.x >= z.x[0] &&
  o.x <= z.x[1] &&
  o.z >= z.z[0] &&
  o.z <= z.z[1]

function Rig({ view, tick }) {
  const { camera, controls } = useThree()

  useEffect(() => {
    camera.position.set(...VIEWS[view])
    controls?.target.set(0, 0, 0)
    controls?.update()
  }, [view, tick, camera, controls])

  return null
}

function Thing({ o, sel, onSel }) {
  const isPerson = o.kind === 'person'
  const color = isPerson ? '#B24DFF' : '#32CFFF'
  const edgeColor = sel ? '#FFFFFF' : color

  const geometry =
    o.kind === 'person'
      ? [0.5, 1.5, 0.5]
      : o.kind === 'table'
        ? [1.6, 0.75, 0.9]
        : [0.5, 0.5, 0.5]

  return (
    <group
      position={[o.x, geometry[1] / 2, o.z]}
      onClick={(event) => {
        event.stopPropagation()
        onSel(o.id)
      }}
    >
      <mesh>
        <boxGeometry args={geometry} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.18}
        />
        <Edges color={edgeColor} />
      </mesh>

      {isPerson && (
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
          />
        </mesh>
      )}

      <Html
        position={[0, geometry[1] / 2 + 0.4, 0]}
        center
        distanceFactor={4}
        style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
      >
        <span className="lbl">
          {isPerson
            ? `Person ${o.personId ?? o.id}`
            : `${o.kind} · editable`}
        </span>
      </Html>
    </group>
  )
}

function Scene({ objs, people, sel, onSel, zones }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight
        position={[0, 6, 0]}
        intensity={30}
        color="#9146FF"
      />

      <gridHelper args={[10, 20, '#9146FF', '#28234C']} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onClick={() => onSel(null)}
      >
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#0D0C1E" />
      </mesh>

      {[
        [0, -4, 10, 0.1],
        [0, 4, 10, 0.1],
        [-5, 0, 0.1, 8],
        [5, 0, 0.1, 8],
      ].map(([x, z, w, d], index) => (
        <mesh key={index} position={[x, 1.25, z]}>
          <boxGeometry args={[w, 2.5, d]} />
          <meshStandardMaterial
            color="#9146FF"
            transparent
            opacity={0.07}
          />
          <Edges color="#9146FF" />
        </mesh>
      ))}

      <mesh position={[0, 0.6, 1]}>
        <boxGeometry args={[0.1, 1.2, 3]} />
        <meshStandardMaterial
          color="#32CFFF"
          transparent
          opacity={0.15}
        />
        <Edges color="#32CFFF" />
      </mesh>

      {[
        [-4.6, 2, -3.6, 'Camera'],
        [4.6, 2, 3.6, 'Sensor node'],
        [0, 2.3, -3.6, 'ToF sensor'],
      ].map(([x, y, z, name]) => (
        <mesh key={name} position={[x, y, z]}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color="#00D9A0" />

          <Html
            position={[0, 0.35, 0]}
            center
            distanceFactor={4}
            style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
          >
            <span className="lbl">{name}</span>
          </Html>
        </mesh>
      ))}

      {zones &&
        ZONES.map((zone) => {
          const width = zone.x[1] - zone.x[0]
          const depth = zone.z[1] - zone.z[0]
          const occupancy = people.filter((person) =>
            inZone(person, zone)
          ).length

          return (
            <mesh
              key={zone.k}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[
                (zone.x[0] + zone.x[1]) / 2,
                0.02,
                (zone.z[0] + zone.z[1]) / 2,
              ]}
            >
              <planeGeometry args={[width, depth]} />
              <meshBasicMaterial
                color={zone.c}
                transparent
                opacity={0.22}
              />

              <Html
                center
                distanceFactor={4}
                style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
              >
                <span className="lbl" style={{ color: zone.c }}>
                  Zone {zone.k} · {zone.n} · {occupancy} people
                </span>
              </Html>
            </mesh>
          )
        })}

      {objs.map((object) => (
        <Thing
          key={object.id}
          o={object}
          sel={sel === object.id}
          onSel={onSel}
        />
      ))}

      {people.map((person) => (
        <Thing
          key={person.id}
          o={person}
          sel={sel === person.id}
          onSel={onSel}
        />
      ))}

      <OrbitControls
        makeDefault
        enableDamping
        maxPolarAngle={Math.PI / 2.05}
        minDistance={4}
        maxDistance={22}
      />
    </>
  )
}

export default function DigitalTwin() {
  const [view, setView] = useState('3D View')
  const [tick, setTick] = useState(0)
  const [zones, setZones] = useState(true)
  const [objs, setObjs] = useState(START)
  const [sel, setSel] = useState(null)
  const [kind, setKind] = useState('chair')
  const [people, setPeople] = useState([])
  const [trackingStatus, setTrackingStatus] =
    useState('Connecting to camera…')

  const next = useRef(100)

  useEffect(() => {
    let active = true

    const refresh = async () => {
      try {
        const data = await getDetections()

        if (!active) return

        const detections = Array.isArray(data?.detections)
          ? data.detections
          : []

        const livePeople = detections
          .filter(
            (detection) =>
              detection.label === 'person' &&
              detection.person_id != null &&
              Array.isArray(detection.box) &&
              detection.box.length === 4 &&
              detection.box.every(Number.isFinite)
          )
          .map((detection) => {
            const [x, y, boxWidth, boxHeight] = detection.box

            const centerX = Math.max(
              0,
              Math.min(1, x + boxWidth / 2)
            )

            const footY = Math.max(
              0,
              Math.min(1, y + boxHeight)
            )


            return {
              id: `live-person-${detection.person_id}`,
              personId: detection.person_id,
              kind: 'person',
              x: (centerX - 0.5) * 9,
              z: (footY - 0.5) * 7,
              confidence: detection.confidence,
              live: true,
            }
          })

        setPeople(livePeople)
        setTrackingStatus('Live camera connected')
      } catch {
        if (active) {
          setTrackingStatus('Camera detections unavailable')
        }
      }
    }

    refresh()

    const timer = setInterval(refresh, 1000)

    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const nudge = (dx, dz) => {
    if (sel == null || String(sel).startsWith('live-person-')) {
      return
    }

    setObjs((currentObjects) =>
      currentObjects.map((object) =>
        object.id === sel
          ? {
              ...object,
              x: Math.max(-4.6, Math.min(4.6, object.x + dx)),
              z: Math.max(-3.6, Math.min(3.6, object.z + dz)),
            }
          : object
      )
    )
  }

  const addObject = () => {
    const id = next.current++

    setObjs((currentObjects) => [
      ...currentObjects,
      { id, kind, x: 0, z: 0 },
    ])

    setSel(id)
  }

  const removeObject = () => {
    if (sel == null || String(sel).startsWith('live-person-')) {
      return
    }

    setObjs((currentObjects) =>
      currentObjects.filter((object) => object.id !== sel)
    )

    setSel(null)
  }

  const selectedIsPerson =
    sel != null && String(sel).startsWith('live-person-')

  const peopleCount = people.length

  return (
    <section className="card c6" id="twin" aria-label="Digital twin">
      <div className="hd">
        <h2>
          Digital Twin <span className="tag">{trackingStatus}</span>
        </h2>

        <div className="seg">
          {Object.keys(VIEWS).map((name) => (
            <button
              key={name}
              className={view === name ? 'on' : ''}
              onClick={() => {
                setView(name)
                if (name === 'Zone View') setZones(true)
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="twin">
        <div className="stage3d">
          <Canvas
            camera={{ position: VIEWS['3D View'], fov: 45 }}
            dpr={[1, 1.5]}
          >
            <Rig view={view} tick={tick} />
            <Scene
              objs={objs}
              people={people}
              sel={sel}
              onSel={setSel}
              zones={zones}
            />
          </Canvas>
        </div>

        <div className="ctl">
          <b>Object Controls</b>

          <div style={{ display: 'flex', gap: 4 }}>
            <select
              aria-label="Object type"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="chair">chair</option>
              <option value="table">table</option>
              <option value="person">person</option>
            </select>

            <button className="btn" onClick={addObject}>
              Add
            </button>
          </div>

          <button
            className="btn"
            disabled={sel == null || selectedIsPerson}
            onClick={removeObject}
          >
            Remove Object
          </button>

          <div className="pad" aria-label="Move selected object">
            <button
              className="btn"
              disabled={sel == null || selectedIsPerson}
              onClick={() => nudge(0, -0.4)}
            >
              ↑
            </button>

            <button
              className="btn"
              disabled={sel == null || selectedIsPerson}
              onClick={() => nudge(-0.4, 0)}
            >
              ←
            </button>

            <button
              className="btn"
              disabled={sel == null || selectedIsPerson}
              onClick={() => nudge(0.4, 0)}
            >
              →
            </button>

            <button
              className="btn"
              disabled={sel == null || selectedIsPerson}
              onClick={() => nudge(0, 0.4)}
            >
              ↓
            </button>
          </div>

          <button
            className="btn"
            onClick={() => setZones((visible) => !visible)}
          >
            {zones ? 'Hide' : 'View'} Zones
          </button>

          <button
            className="btn"
            onClick={() => {
              setTick((current) => current + 1)
              setView('3D View')
            }}
          >
            Reset View
          </button>

          <small className="note">
            Drag to orbit, scroll to zoom. {peopleCount} live tracked{' '}
            {peopleCount === 1 ? 'person' : 'people'}. Floor positions
            are estimated from camera boxes, not calibrated room
            coordinates.
          </small>
        </div>
      </div>
    </section>
  )
}
