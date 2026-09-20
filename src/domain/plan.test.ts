import { describe, expect, it } from 'vitest'
import { measurePath, PIXELS_PER_METER, resizePathSegment } from './plan'

const points = [
  { id: 'P1', x: 100, y: 100 },
  { id: 'P2', x: 100 + 7.2 * PIXELS_PER_METER, y: 100 },
  { id: 'P3', x: 100 + 7.2 * PIXELS_PER_METER, y: 100 + 4.8 * PIXELS_PER_METER },
]

describe('plan geometry', () => {
  it('uses one consistent canvas scale for every measured segment', () => {
    expect(measurePath(points)).toEqual([7.2, 4.8])
  })

  it('resizes one segment while preserving downstream segment geometry', () => {
    const resized = resizePathSegment(points, 0, 5.8)

    expect(measurePath(resized)).toEqual([5.8, 4.8])
    expect(resized[2].x - resized[1].x).toBe(0)
  })
})