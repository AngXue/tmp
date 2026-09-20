import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Magnet, Maximize2, Minimize2, MousePointer2, Plus, RotateCcw } from 'lucide-react'
import type { Point2D } from '../domain/scaffold'

type PlanEditorProps = {
  points: Point2D[]
  lengths: number[]
  onPointsChange: (points: Point2D[]) => void
  onLengthsChange: (lengths: number[]) => void
}

const VIEWBOX_WIDTH = 720
const VIEWBOX_HEIGHT = 500
const GRID_SIZE = 20
const ALIGN_THRESHOLD = 12

export function PlanEditor({ points, lengths, onPointsChange, onLengthsChange }: PlanEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState(0)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [snapGuide, setSnapGuide] = useState<{ x?: number; y?: number }>({})
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreen = () => setIsFullscreen(document.fullscreenElement === editorRef.current)
    document.addEventListener('fullscreenchange', handleFullscreen)
    return () => document.removeEventListener('fullscreenchange', handleFullscreen)
  }, [])

  const toSvgPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const scale = Math.min(rect.width / VIEWBOX_WIDTH, rect.height / VIEWBOX_HEIGHT)
    const offsetX = (rect.width - VIEWBOX_WIDTH * scale) / 2
    const offsetY = (rect.height - VIEWBOX_HEIGHT * scale) / 2
    return {
      x: (event.clientX - rect.left - offsetX) / scale,
      y: (event.clientY - rect.top - offsetY) / scale,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingId) return
    const raw = toSvgPoint(event)
    let next = raw
    const guide: { x?: number; y?: number } = {}

    if (snapEnabled) {
      next = {
        x: Math.round(raw.x / GRID_SIZE) * GRID_SIZE,
        y: Math.round(raw.y / GRID_SIZE) * GRID_SIZE,
      }
      for (const point of points) {
        if (point.id === draggingId) continue
        if (Math.abs(raw.x - point.x) <= ALIGN_THRESHOLD) {
          next.x = point.x
          guide.x = point.x
        }
        if (Math.abs(raw.y - point.y) <= ALIGN_THRESHOLD) {
          next.y = point.y
          guide.y = point.y
        }
      }
    }

    setSnapGuide(guide)
    onPointsChange(points.map((point) => point.id === draggingId
      ? { ...point, x: Math.max(34, Math.min(686, next.x)), y: Math.max(34, Math.min(466, next.y)) }
      : point))
  }

  const stopDragging = () => {
    setDraggingId(null)
    setSnapGuide({})
  }

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await editorRef.current?.requestFullscreen()
    }
  }

  const addSegment = () => {
    const last = points.at(-1) ?? { x: 120, y: 160 }
    const direction = points.length % 2 === 0 ? { x: 0, y: 130 } : { x: 150, y: 0 }
    onPointsChange([...points, {
      id: `P${points.length + 1}`,
      x: Math.min(670, last.x + direction.x),
      y: Math.min(450, last.y + direction.y),
    }])
    onLengthsChange([...lengths, 4.2])
    setSelectedSegment(lengths.length)
  }

  const reset = () => {
    onPointsChange([
      { id: 'P1', x: 110, y: 125 },
      { id: 'P2', x: 520, y: 125 },
      { id: 'P3', x: 520, y: 380 },
    ])
    onLengthsChange([7.2, 4.8])
    setSelectedSegment(0)
  }

  return (
    <div className="plan-editor" ref={editorRef}>
      <div className="canvas-toolbar">
        <div className="tool-status"><MousePointer2 size={16} /> 拖动节点 · {snapEnabled ? '吸附已开启' : '自由移动'}</div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={reset} title="重置示例路径"><RotateCcw size={18} /></button>
          <button className={snapEnabled ? 'icon-button active' : 'icon-button'} type="button" onClick={() => setSnapEnabled(!snapEnabled)} title="网格与同轴吸附"><Magnet size={18} /></button>
          <button className="icon-button" type="button" onClick={toggleFullscreen} title={isFullscreen ? '退出全屏' : '全屏画布'}>
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <button className="compact-button" type="button" onClick={addSegment}><Plus size={17} /> 添加路径段</button>
        </div>
      </div>

      <div className="plan-canvas-wrap">
        <svg
          ref={svgRef}
          className="plan-canvas"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerLeave={stopDragging}
        >
          <defs>
            <pattern id="minor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#d8dfe2" strokeWidth="0.7" />
            </pattern>
            <pattern id="major-grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#minor-grid)" />
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#c0cbd0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#major-grid)" />
          {snapGuide.x !== undefined && <line x1={snapGuide.x} y1="0" x2={snapGuide.x} y2={VIEWBOX_HEIGHT} className="snap-guide" />}
          {snapGuide.y !== undefined && <line x1="0" y1={snapGuide.y} x2={VIEWBOX_WIDTH} y2={snapGuide.y} className="snap-guide" />}
          {points.slice(0, -1).map((point, index) => {
            const next = points[index + 1]
            const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 }
            const selected = selectedSegment === index
            return (
              <g key={`${point.id}-${next.id}`} onClick={() => setSelectedSegment(index)} className="plan-segment">
                <line x1={point.x} y1={point.y} x2={next.x} y2={next.y} stroke="transparent" strokeWidth="28" />
                <line x1={point.x} y1={point.y} x2={next.x} y2={next.y} className={selected ? 'segment-line selected' : 'segment-line'} />
                <g transform={`translate(${midpoint.x}, ${midpoint.y})`}>
                  <rect x="-38" y="-17" width="76" height="34" rx="4" className="length-label-bg" />
                  <text textAnchor="middle" dominantBaseline="middle" className="length-label">{(lengths[index] ?? 0).toFixed(2)} m</text>
                </g>
              </g>
            )
          })}
          {points.map((point) => (
            <g
              key={point.id}
              transform={`translate(${point.x}, ${point.y})`}
              className="plan-node"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setDraggingId(point.id)
              }}
            >
              <circle r="14" className="node-hit" />
              <circle r="7" className="node-dot" />
              <rect x="-17" y="-38" width="34" height="20" rx="3" className="node-label-bg" />
              <text y="-24" textAnchor="middle" className="node-label">{point.id}</text>
            </g>
          ))}
        </svg>
        <div className="scale-indicator"><span /> 1 m 参考</div>
      </div>

      <div className="segment-strip">
        <div>
          <span className="field-caption">当前路径段</span>
          <strong>{points[selectedSegment]?.id} → {points[selectedSegment + 1]?.id}</strong>
        </div>
        <label className="inline-field">
          <span>实际测量长度</span>
          <span className="number-input">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={lengths[selectedSegment] ?? 0}
              onChange={(event) => onLengthsChange(lengths.map((length, index) =>
                index === selectedSegment ? Math.max(0.1, Number(event.target.value)) : length))}
            />
            <b>m</b>
          </span>
        </label>
        <span className="authority-note">此数值用于计算，画布比例仅作示意</span>
      </div>
    </div>
  )
}