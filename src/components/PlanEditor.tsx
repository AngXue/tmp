import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Focus, MousePointer2, Plus, RotateCcw } from 'lucide-react'
import type { Point2D } from '../domain/scaffold'

type PlanEditorProps = {
  points: Point2D[]
  lengths: number[]
  onPointsChange: (points: Point2D[]) => void
  onLengthsChange: (lengths: number[]) => void
}

const VIEWBOX_WIDTH = 720
const VIEWBOX_HEIGHT = 500

export function PlanEditor({ points, lengths, onPointsChange, onLengthsChange }: PlanEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState(0)

  const toSvgPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT,
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingId) return
    const next = toSvgPoint(event)
    onPointsChange(points.map((point) => point.id === draggingId
      ? { ...point, x: Math.max(34, Math.min(686, next.x)), y: Math.max(34, Math.min(466, next.y)) }
      : point))
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
    <div className="plan-editor">
      <div className="canvas-toolbar">
        <div className="tool-status"><MousePointer2 size={16} /> 拖动节点调整路径</div>
        <div className="toolbar-actions">
          <button className="icon-button" type="button" onClick={reset} title="重置示例路径"><RotateCcw size={18} /></button>
          <button className="icon-button" type="button" title="适应画布"><Focus size={18} /></button>
          <button className="compact-button" type="button" onClick={addSegment}><Plus size={17} /> 添加路径段</button>
        </div>
      </div>

      <div className="plan-canvas-wrap">
        <svg
          ref={svgRef}
          className="plan-canvas"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDraggingId(null)}
          onPointerLeave={() => setDraggingId(null)}
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
              <text y="-20" textAnchor="middle" className="node-label">{point.id}</text>
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