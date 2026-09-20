import type { Point2D } from './scaffold'

export const PIXELS_PER_METER = 50
export const GRID_SIZE = PIXELS_PER_METER / 2

const round = (value: number, precision = 2) => Number(value.toFixed(precision))

export function measurePath(points: Point2D[]) {
  return points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]
    return round(Math.hypot(next.x - point.x, next.y - point.y) / PIXELS_PER_METER)
  })
}

export function resizePathSegment(points: Point2D[], segmentIndex: number, length: number) {
  const start = points[segmentIndex]
  const end = points[segmentIndex + 1]
  if (!start || !end) return points

  const dx = end.x - start.x
  const dy = end.y - start.y
  const currentLength = Math.hypot(dx, dy)
  const direction = currentLength > 0 ? { x: dx / currentLength, y: dy / currentLength } : { x: 1, y: 0 }
  const targetEnd = {
    x: round(start.x + direction.x * length * PIXELS_PER_METER),
    y: round(start.y + direction.y * length * PIXELS_PER_METER),
  }
  const translation = { x: targetEnd.x - end.x, y: targetEnd.y - end.y }

  return points.map((point, index) => index > segmentIndex
    ? { ...point, x: round(point.x + translation.x), y: round(point.y + translation.y) }
    : point)
}