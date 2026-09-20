import { describe, expect, it } from 'vitest'
import { calculateScaffold, countMembers, DEFAULT_PARAMETERS } from './scaffold'

const points = [
  { id: 'P1', x: 0, y: 0 },
  { id: 'P2', x: 200, y: 0 },
  { id: 'P3', x: 200, y: 200 },
]

describe('calculateScaffold', () => {
  it('deduplicates the outer post shared by an L-shaped corner', () => {
    const layout = calculateScaffold(points, [3.6, 3.6], DEFAULT_PARAMETERS)
    const outerCornerPosts = layout.members.filter(
      (member) => member.type === 'post' && member.start[0] === 3.6 && member.start[2] === 0,
    )

    expect(outerCornerPosts).toHaveLength(1)
    expect(countMembers(layout).post).toBe(11)
  })

  it('derives material totals from the generated members', () => {
    const layout = calculateScaffold(points.slice(0, 2), [5.8], DEFAULT_PARAMETERS)
    const memberLength = layout.members.reduce((sum, member) => sum + member.length, 0)

    expect(layout.materials.theoreticalLength).toBeCloseTo(memberLength, 2)
    expect(layout.materials.purchasedLength).toBeGreaterThanOrEqual(memberLength)
    expect(layout.materials.utilization).toBeGreaterThan(0)
  })

  it('supports three post rows and physical tube overhangs', () => {
    const parameters = { ...DEFAULT_PARAMETERS, rowCount: 3 }
    const layout = calculateScaffold(points.slice(0, 2), [3.6], parameters)
    const transverse = layout.members.find((member) => member.type === 'transverse')

    expect(countMembers(layout).post).toBe(9)
    expect(transverse?.connectionPoints).toHaveLength(3)
    expect(transverse?.length).toBeCloseTo(parameters.width + parameters.tubeEndExtension * 2, 3)
    expect(layout.decks).toHaveLength(10)
    expect(layout.materials.deckCount).toBe(layout.decks.length)
  })

  it('keeps brace coverage continuous from the base to the top lift', () => {
    const layout = calculateScaffold(points.slice(0, 2), [5.4], DEFAULT_PARAMETERS)
    const braces = layout.members.filter((member) => member.type === 'brace')
    const highestBracePoint = Math.max(...braces.flatMap((brace) => [brace.start[1], brace.end[1]]))

    expect(braces.length).toBeGreaterThan(2)
    expect(highestBracePoint).toBeGreaterThanOrEqual(DEFAULT_PARAMETERS.height)
  })

  it('accepts legacy parameter objects without newly added fields', () => {
    const legacy = { ...DEFAULT_PARAMETERS } as Partial<typeof DEFAULT_PARAMETERS>
    delete legacy.rowCount
    delete legacy.tubeEndExtension

    const layout = calculateScaffold(points.slice(0, 2), [3.6], legacy as typeof DEFAULT_PARAMETERS)
    expect(countMembers(layout).post).toBe(6)
  })
})