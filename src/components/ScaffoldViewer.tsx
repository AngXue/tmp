import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Box, Focus, Maximize2, Minimize2, Rotate3D, ScanEye } from 'lucide-react'
import type { DeckPanel, MemberType, PipeSegment, ScaffoldLayout } from '../domain/scaffold'

type ViewerProps = {
  layout: ScaffoldLayout
}

type RenderLayer = MemberType | 'deck' | 'connector'

const MEMBER_COLORS: Record<MemberType, string> = {
  post: '#2f3c40',
  longitudinal: '#247b85',
  transverse: '#db7b26',
}

const MEMBER_LABELS: Record<MemberType, string> = {
  post: '立杆',
  longitudinal: '纵向水平杆',
  transverse: '横向杆',
}

const LAYER_LABELS: Record<RenderLayer, string> = {
  ...MEMBER_LABELS,
  deck: '钢笆',
  connector: '扣件',
}

const LAYER_COLORS: Record<RenderLayer, string> = {
  ...MEMBER_COLORS,
  deck: '#87989a',
  connector: '#5b4b3e',
}

const RENDER_LAYERS = Object.keys(LAYER_LABELS) as RenderLayer[]

function CameraRig({ position, target, maximumDistance }: {
  position: [number, number, number]
  target: [number, number, number]
  maximumDistance: number
}) {
  const { camera } = useThree()
  const [initialView] = useState(() => ({ position, target }))

  useEffect(() => {
    camera.position.set(...initialView.position)
    camera.lookAt(...initialView.target)
    camera.updateProjectionMatrix()
  }, [camera, initialView])

  return <OrbitControls makeDefault target={initialView.target} minDistance={3} maxDistance={maximumDistance} />
}

function Pipe({ segment, selected, onSelect }: {
  segment: PipeSegment
  selected: boolean
  onSelect: () => void
}) {
  const start = new THREE.Vector3(...segment.start)
  const end = new THREE.Vector3(...segment.end)
  const midpoint = start.clone().add(end).multiplyScalar(0.5)
  const direction = end.clone().sub(start)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  )

  return (
    <mesh
      position={midpoint}
      quaternion={quaternion}
      onClick={(event) => { event.stopPropagation(); onSelect() }}
    >
      <cylinderGeometry args={[selected ? 0.055 : 0.038, selected ? 0.055 : 0.038, direction.length(), 8]} />
      <meshStandardMaterial
        color={selected ? '#ffb02e' : MEMBER_COLORS[segment.type]}
        roughness={0.5}
        metalness={0.35}
      />
    </mesh>
  )
}

function SteelDeck({ deck, selected, onSelect }: {
  deck: DeckPanel
  selected: boolean
  onSelect: () => void
}) {
  const [a, b, c, d] = deck.corners.map((corner) => new THREE.Vector3(...corner))
  const surfaceVertices = new Float32Array([
    ...a.toArray(), ...b.toArray(), ...c.toArray(),
    ...a.toArray(), ...c.toArray(), ...d.toArray(),
  ])
  const linePoints: number[] = []

  for (let index = 0; index <= 8; index += 1) {
    const ratio = index / 8
    linePoints.push(...a.clone().lerp(d, ratio).toArray(), ...b.clone().lerp(c, ratio).toArray())
  }
  for (let index = 0; index <= 4; index += 1) {
    const ratio = index / 4
    linePoints.push(...a.clone().lerp(b, ratio).toArray(), ...d.clone().lerp(c, ratio).toArray())
  }

  return (
    <group onClick={(event) => { event.stopPropagation(); onSelect() }}>
      <mesh>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[surfaceVertices, 3]} />
        </bufferGeometry>
        <meshStandardMaterial color={selected ? '#ffb02e' : '#788a8c'} transparent opacity={0.3} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(linePoints), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={selected ? '#ffb02e' : '#40575a'} transparent opacity={0.8} />
      </lineSegments>
    </group>
  )
}

export function ScaffoldViewer({ layout }: ViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cameraPreset, setCameraPreset] = useState(0)
  const [cameraRevision, setCameraRevision] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [visibility, setVisibility] = useState<Record<RenderLayer, boolean>>(() =>
    Object.fromEntries(RENDER_LAYERS.map((layer) => [layer, true])) as Record<RenderLayer, boolean>)
  const selectedSegment = layout.pipeSegments.find((segment) => segment.id === selectedId)
  const selectedMember = layout.members.find((member) => member.id === selectedSegment?.memberId)
  const selectedAssembly = layout.materials.assemblyPlans.find((plan) => plan.memberId === selectedMember?.id)
  const selectedDeck = layout.decks.find((deck) => deck.id === selectedId)
  const selectedConnector = layout.connectors.find((connector) => connector.id === selectedId)
  const memberPoints = layout.pipeSegments.flatMap((segment) => [segment.start, segment.end])
  const scenePoints = memberPoints.length > 0
    ? memberPoints
    : [[0, 0, 0], [6, 6, 6]] as [number, number, number][]
  const minimum = scenePoints.reduce(
    (result, point) => result.map((value, index) => Math.min(value, point[index])) as [number, number, number],
    [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [number, number, number],
  )
  const maximum = scenePoints.reduce(
    (result, point) => result.map((value, index) => Math.max(value, point[index])) as [number, number, number],
    [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as [number, number, number],
  )
  const center = minimum.map((value, index) => (value + maximum[index]) / 2) as [number, number, number]
  const span = Math.max(6, ...maximum.map((value, index) => value - minimum[index]))
  const cameraPositions: Array<[number, number, number]> = [
    [center[0] + span * 1.35, center[1] + span * 0.8, center[2] + span * 1.35],
    [center[0], center[1] + span * 0.15, center[2] + span * 2],
    [center[0] + span * 2, center[1] + span * 0.15, center[2]],
  ]
  const resetCamera = () => {
    setCameraPreset(0)
    setCameraRevision((revision) => revision + 1)
  }

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === viewerRef.current)
    document.addEventListener('fullscreenchange', handleFullscreen)
    return () => document.removeEventListener('fullscreenchange', handleFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await viewerRef.current?.requestFullscreen()
  }

  const toggleLayer = (layer: RenderLayer) => {
    setVisibility((current) => ({ ...current, [layer]: !current[layer] }))
  }

  const showOnly = (layer: RenderLayer) => {
    setVisibility(Object.fromEntries(RENDER_LAYERS.map((candidate) => [candidate, candidate === layer])) as Record<RenderLayer, boolean>)
  }

  const showAll = () => {
    setVisibility(Object.fromEntries(RENDER_LAYERS.map((layer) => [layer, true])) as Record<RenderLayer, boolean>)
  }

  return (
    <div className="viewer-shell" ref={viewerRef}>
      <div className="canvas-toolbar viewer-toolbar">
        <div className="tool-status"><Rotate3D size={17} /> 拖动旋转 · 双指缩放</div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" title="复位等轴视图" onClick={resetCamera}><Focus size={18} /></button>
          <button className="icon-button" type="button" title="切换观察方向" onClick={() => setCameraPreset((cameraPreset + 1) % cameraPositions.length)}><Box size={18} /></button>
          <button className="icon-button" type="button" title={isFullscreen ? '退出全屏' : '全屏三维'} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>
      <div className="viewer-canvas" data-testid="scaffold-canvas">
        <Canvas dpr={[1, 1.5]} camera={{ fov: 42 }} onPointerMissed={() => setSelectedId(null)}>
          <color attach="background" args={['#eef2f1']} />
          <CameraRig
            key={`${cameraPreset}-${cameraRevision}`}
            position={cameraPositions[cameraPreset]}
            target={center}
            maximumDistance={span * 5}
          />
          <ambientLight intensity={1.3} />
          <directionalLight position={[7, 11, 8]} intensity={2.2} />
          <directionalLight position={[-6, 4, -4]} intensity={0.7} />
          <group>
            {layout.pipeSegments.filter((segment) => visibility[segment.type]).map((segment) => (
              <Pipe
                key={segment.id}
                segment={segment}
                selected={segment.id === selectedId}
                onSelect={() => setSelectedId(segment.id)}
              />
            ))}
            {visibility.deck && layout.decks.map((deck) => (
              <SteelDeck key={deck.id} deck={deck} selected={deck.id === selectedId} onSelect={() => setSelectedId(deck.id)} />
            ))}
            {visibility.connector && layout.connectors.map((connector) => (
              <mesh key={connector.id} position={connector.position} onClick={(event) => { event.stopPropagation(); setSelectedId(connector.id) }}>
                <sphereGeometry args={[connector.id === selectedId ? 0.075 : 0.055, 7, 5]} />
                <meshStandardMaterial color={connector.id === selectedId ? '#ffb02e' : '#55483d'} metalness={0.5} roughness={0.45} />
              </mesh>
            ))}
          </group>
          <Grid
            args={[40, 40]}
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#aebbbd"
            sectionSize={2}
            sectionThickness={1}
            sectionColor="#829294"
            fadeDistance={28}
            infiniteGrid
          />
        </Canvas>
      </div>

      <div className="layer-filter" role="group" aria-label="构件图层">
        <button type="button" className={RENDER_LAYERS.every((layer) => visibility[layer]) ? 'active' : ''} onClick={showAll}>全部</button>
        {RENDER_LAYERS.map((layer) => (
          <div className={visibility[layer] ? 'layer-option active' : 'layer-option'} key={layer}>
            <label>
              <input type="checkbox" checked={visibility[layer]} onChange={() => toggleLayer(layer)} />
              <i style={{ background: LAYER_COLORS[layer] }} />
              <span>{LAYER_LABELS[layer]}</span>
            </label>
            <button type="button" title={`仅显示${LAYER_LABELS[layer]}`} onClick={() => showOnly(layer)}><ScanEye size={13} /></button>
          </div>
        ))}
      </div>

      <aside className={selectedSegment || selectedDeck || selectedConnector ? 'member-popover visible' : 'member-popover'}>
        {selectedSegment && selectedMember && selectedAssembly && (
          <>
            <span className="field-caption">已选择 · {selectedSegment.id}</span>
            <strong>{MEMBER_LABELS[selectedSegment.type]} · 第 {selectedSegment.sequence} 段</strong>
            <dl>
              <div><dt>库存规格</dt><dd>{selectedSegment.stockLength.toFixed(2)} m</dd></div>
              <div><dt>组合</dt><dd>{selectedAssembly.stockLengths.map((length) => `${length}m`).join(' + ')}</dd></div>
              <div><dt>搭接长度</dt><dd>{selectedSegment.overlapWithPrevious.toFixed(2)} m</dd></div>
              <div><dt>目标净长</dt><dd>{selectedAssembly.requiredLength.toFixed(2)} m</dd></div>
              <div><dt>组合外伸</dt><dd>{selectedAssembly.excessLength.toFixed(2)} m</dd></div>
              <div><dt>所在层</dt><dd>{selectedMember.layer ? `第 ${selectedMember.layer} 层` : '立杆全高'}</dd></div>
            </dl>
          </>
        )}
        {selectedDeck && (
          <>
            <span className="field-caption">已选择 · {selectedDeck.id}</span>
            <strong>钢笆片</strong>
            <dl>
              <div><dt>覆盖面积</dt><dd>{selectedDeck.area.toFixed(2)} m²</dd></div>
              <div><dt>所在层</dt><dd>第 {selectedDeck.layer} 层</dd></div>
              <div><dt>路径段</dt><dd>#{selectedDeck.pathSegment + 1}</dd></div>
            </dl>
          </>
        )}
        {selectedConnector && (
          <>
            <span className="field-caption">已选择 · {selectedConnector.id}</span>
            <strong>{selectedConnector.type === 'splice' ? '搭接扣件' : '直角扣件'}</strong>
            <dl><div><dt>关联构件</dt><dd>{selectedConnector.memberId}</dd></div></dl>
          </>
        )}
      </aside>
    </div>
  )
}