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

  it('splits tall posts into overlapping standard stock pipes', () => {
    const parameters = { ...DEFAULT_PARAMETERS, height: 12.4 }
    const layout = calculateScaffold(points.slice(0, 2), [3.6], parameters)
    const post = layout.members.find((member) => member.type === 'post')!
    const segments = layout.pipeSegments.filter((segment) => segment.memberId === post.id)

    expect(segments.length).toBeGreaterThan(1)
    expect(segments.every((segment) => parameters.stockLengths.includes(segment.stockLength))).toBe(true)
    expect(segments.every((segment) => segment.stockLength <= Math.max(...parameters.stockLengths))).toBe(true)
    expect(layout.connectors.filter((connector) => connector.type === 'splice' && connector.memberId === post.id)).toHaveLength((segments.length - 1) * 2)
    expect(Math.max(...segments.map((segment) => segment.end[1]))).toBeGreaterThan(parameters.height)
    const plan = layout.materials.assemblyPlans.find((assembly) => assembly.memberId === post.id)!
    expect(plan.effectiveLength).toBe(
      plan.stockLengths.reduce((sum, length) => sum + length, 0) - parameters.spliceOverlap * (plan.stockLengths.length - 1),
    )
  })

  it('treats a long longitudinal run as one assembly of stock pipes', () => {
    const layout = calculateScaffold(points.slice(0, 2), [7.2], DEFAULT_PARAMETERS)
    const longitudinal = layout.members.find((member) => member.type === 'longitudinal')!
    const segments = layout.pipeSegments.filter((segment) => segment.memberId === longitudinal.id)

    expect(longitudinal.length).toBeGreaterThan(Math.max(...DEFAULT_PARAMETERS.stockLengths))
    expect(segments.length).toBeGreaterThan(1)
    expect(segments[1].overlapWithPrevious).toBe(DEFAULT_PARAMETERS.spliceOverlap)
  })

  it('excludes wall ties and leaves braces pending outside the layout', () => {
    const layout = calculateScaffold(points, [3.6, 3.6], DEFAULT_PARAMETERS)

    expect(layout.members.every((member) => ['post', 'longitudinal', 'transverse'].includes(member.type))).toBe(true)
    expect(layout.materials.pendingMaterialSummary.brace).toBeNull()
  })

  it('accepts legacy parameter objects without newly added fields', () => {
    const legacy = { ...DEFAULT_PARAMETERS } as Partial<typeof DEFAULT_PARAMETERS>
    delete legacy.rowCount
    delete legacy.tubeEndExtension

    const layout = calculateScaffold(points.slice(0, 2), [3.6], legacy as typeof DEFAULT_PARAMETERS)
    expect(countMembers(layout).post).toBe(6)
  })
})