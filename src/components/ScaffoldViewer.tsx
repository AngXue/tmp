import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { Box, Focus, Rotate3D } from 'lucide-react'
import type { MemberType, ScaffoldLayout, ScaffoldMember } from '../domain/scaffold'

type ViewerProps = {
  layout: ScaffoldLayout
  filter: MemberType | 'all'
  onFilterChange: (filter: MemberType | 'all') => void
}

const MEMBER_COLORS: Record<MemberType, string> = {
  post: '#2f3c40',
  longitudinal: '#247b85',
  transverse: '#db7b26',
  brace: '#d6473f',
  wallTie: '#65717a',
}

const MEMBER_LABELS: Record<MemberType, string> = {
  post: '立杆',
  longitudinal: '纵向水平杆',
  transverse: '横向杆',
  brace: '剪刀撑',
  wallTie: '连墙件',
}

function Pipe({ member, muted, selected, onSelect }: {
  member: ScaffoldMember
  muted: boolean
  selected: boolean
  onSelect: () => void
}) {
  const start = new THREE.Vector3(...member.start)
  const end = new THREE.Vector3(...member.end)
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
        color={selected ? '#ffb02e' : MEMBER_COLORS[member.type]}
        transparent={muted}
        opacity={muted ? 0.08 : 1}
        roughness={0.5}
        metalness={0.35}
      />
    </mesh>
  )
}

export function ScaffoldViewer({ layout, filter, onFilterChange }: ViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cameraPreset, setCameraPreset] = useState(0)
  const [cameraRevision, setCameraRevision] = useState(0)
  const selected = layout.members.find((member) => member.id === selectedId)
  const cameraPositions: Array<[number, number, number]> = [
    [16, 12, 19],
    [3.5, 5, 23],
    [21, 5, 2.5],
  ]

  const resetCamera = () => {
    setCameraPreset(0)
    setCameraRevision((revision) => revision + 1)
  }

  return (
    <div className="viewer-shell">
      <div className="canvas-toolbar viewer-toolbar">
        <div className="tool-status"><Rotate3D size={17} /> 拖动旋转 · 双指缩放</div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" title="复位等轴视图" onClick={resetCamera}><Focus size={18} /></button>
          <button className="icon-button" type="button" title="切换观察方向" onClick={() => setCameraPreset((cameraPreset + 1) % cameraPositions.length)}><Box size={18} /></button>
        </div>
      </div>
      <div className="viewer-canvas" data-testid="scaffold-canvas">
        <Canvas dpr={[1, 1.5]} onPointerMissed={() => setSelectedId(null)}>
          <color attach="background" args={['#eef2f1']} />
          <PerspectiveCamera key={`camera-${cameraPreset}-${cameraRevision}`} makeDefault position={cameraPositions[cameraPreset]} fov={42} />
          <ambientLight intensity={1.3} />
          <directionalLight position={[7, 11, 8]} intensity={2.2} />
          <directionalLight position={[-6, 4, -4]} intensity={0.7} />
          <group>
            {layout.members.map((member) => (
              <Pipe
                key={member.id}
                member={member}
                selected={member.id === selectedId}
                muted={filter !== 'all' && member.type !== filter}
                onSelect={() => setSelectedId(member.id)}
              />
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
          <OrbitControls key={`controls-${cameraPreset}-${cameraRevision}`} makeDefault target={[3.5, 4.2, 2]} minDistance={5} maxDistance={40} />
        </Canvas>
      </div>

      <div className="layer-filter" role="group" aria-label="构件图层">
        {(['all', 'post', 'longitudinal', 'transverse', 'brace', 'wallTie'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={filter === type ? 'active' : ''}
            onClick={() => onFilterChange(type)}
          >
            {type === 'all' ? '全部' : MEMBER_LABELS[type]}
          </button>
        ))}
      </div>

      <aside className={selected ? 'member-popover visible' : 'member-popover'}>
        {selected && (
          <>
            <span className="field-caption">已选择 · {selected.id}</span>
            <strong>{MEMBER_LABELS[selected.type]}</strong>
            <dl>
              <div><dt>理论长度</dt><dd>{selected.length.toFixed(2)} m</dd></div>
              <div><dt>所在层</dt><dd>{selected.layer ? `第 ${selected.layer} 层` : '全高 / 斜向'}</dd></div>
              <div><dt>路径段</dt><dd>#{(selected.pathSegment ?? 0) + 1}</dd></div>
            </dl>
          </>
        )}
      </aside>
    </div>
  )
}