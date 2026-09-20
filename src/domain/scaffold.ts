export type Point2D = {
  id: string
  x: number
  y: number
}

export type ScaffoldParameters = {
  height: number
  width: number
  rowCount: number
  postSpacing: number
  liftHeight: number
  tubeEndExtension: number
  postTopExtension: number
  braceBayCount: number
  wallTieHorizontalBays: number
  wallTieVerticalLifts: number
  deckLiftInterval: number
  pipeDiameter: number
  stockLengths: number[]
}

export type MemberType = 'post' | 'longitudinal' | 'transverse' | 'brace' | 'wallTie'
export type Vector3Tuple = [number, number, number]

export type ScaffoldMember = {
  id: string
  type: MemberType
  start: Vector3Tuple
  end: Vector3Tuple
  connectionPoints: Vector3Tuple[]
  length: number
  layer?: number
  pathSegment?: number
}

export type DeckPanel = {
  id: string
  corners: [Vector3Tuple, Vector3Tuple, Vector3Tuple, Vector3Tuple]
  area: number
  layer: number
  pathSegment: number
}

export type ScaffoldConnector = {
  id: string
  type: 'rightAngle' | 'swivel'
  position: Vector3Tuple
  memberId: string
}

export type LayoutWarning = {
  id: string
  message: string
}

export type CutPlan = {
  stockLength: number
  cuts: number[]
  remainder: number
  memberIds: string[]
}

export type MaterialResult = {
  theoreticalLength: number
  purchasedLength: number
  usedLength: number
  wasteLength: number
  utilization: number
  stockSummary: Record<string, number>
  connectorSummary: {
    rightAngle: number
    swivel: number
    butt: number
  }
  deckCount: number
  deckArea: number
  cutPlans: CutPlan[]
}

export type ScaffoldLayout = {
  members: ScaffoldMember[]
  decks: DeckPanel[]
  connectors: ScaffoldConnector[]
  warnings: LayoutWarning[]
  materials: MaterialResult
}

export const DEFAULT_PARAMETERS: ScaffoldParameters = {
  height: 8.4,
  width: 1.2,
  rowCount: 2,
  postSpacing: 1.8,
  liftHeight: 1.8,
  tubeEndExtension: 0.1,
  postTopExtension: 0.2,
  braceBayCount: 3,
  wallTieHorizontalBays: 3,
  wallTieVerticalLifts: 2,
  deckLiftInterval: 1,
  pipeDiameter: 0.048,
  stockLengths: [6, 5, 4, 3, 2],
}

const round = (value: number, precision = 3) => Number(value.toFixed(precision))
const vectorDistance = (a: Vector3Tuple, b: Vector3Tuple) =>
  Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
const pointKey = (point: Vector3Tuple) => point.map((value) => round(value)).join(':')

function extendLine(
  start: Vector3Tuple,
  end: Vector3Tuple,
  startExtension: number,
  endExtension: number,
): [Vector3Tuple, Vector3Tuple] {
  const length = vectorDistance(start, end)
  if (length <= 0.001) return [start, end]
  const direction = end.map((value, index) => (value - start[index]) / length) as Vector3Tuple
  return [
    start.map((value, index) => round(value - direction[index] * startExtension)) as Vector3Tuple,
    end.map((value, index) => round(value + direction[index] * endExtension)) as Vector3Tuple,
  ]
}

function getPhysicalPoints(points: Point2D[], lengths: number[]) {
  if (!points.length) return []

  const physical: Array<[number, number]> = [[0, 0]]
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const dx = next.x - current.x
    const dy = next.y - current.y
    const visualLength = Math.hypot(dx, dy) || 1
    const actualLength = Math.max(0.1, lengths[index] ?? visualLength / 50)
    const previous = physical[index]
    physical.push([
      round(previous[0] + (dx / visualLength) * actualLength),
      round(previous[1] + (dy / visualLength) * actualLength),
    ])
  }
  return physical
}

function optimizeCuts(
  members: ScaffoldMember[],
  decks: DeckPanel[],
  connectors: ScaffoldConnector[],
  stockLengths: number[],
): MaterialResult {
  const stocks = [...stockLengths].sort((a, b) => b - a)
  const maximumStock = stocks[0]
  const pieces = members.flatMap((member) => {
    const result: Array<{ length: number; memberId: string }> = []
    let remaining = member.length
    while (remaining > maximumStock + 0.001) {
      result.push({ length: maximumStock, memberId: member.id })
      remaining -= maximumStock
    }
    if (remaining > 0.001) result.push({ length: round(remaining), memberId: member.id })
    return result
  }).sort((a, b) => b.length - a.length)

  const plans: CutPlan[] = []
  for (const piece of pieces) {
    const existing = plans
      .filter((plan) => plan.remainder + 0.001 >= piece.length)
      .sort((a, b) => a.remainder - b.remainder)[0]

    if (existing) {
      existing.cuts.push(piece.length)
      existing.memberIds.push(piece.memberId)
      existing.remainder = round(existing.remainder - piece.length)
      continue
    }

    const stockLength = [...stocks].reverse().find((stock) => stock + 0.001 >= piece.length) ?? maximumStock
    plans.push({
      stockLength,
      cuts: [piece.length],
      remainder: round(stockLength - piece.length),
      memberIds: [piece.memberId],
    })
  }

  const theoreticalLength = round(members.reduce((sum, member) => sum + member.length, 0))
  const purchasedLength = round(plans.reduce((sum, plan) => sum + plan.stockLength, 0))
  const wasteLength = round(purchasedLength - theoreticalLength)
  const stockSummary = plans.reduce<Record<string, number>>((summary, plan) => {
    const key = `${plan.stockLength}m`
    summary[key] = (summary[key] ?? 0) + 1
    return summary
  }, {})
  const splitCount = pieces.length - members.length

  return {
    theoreticalLength,
    purchasedLength,
    usedLength: theoreticalLength,
    wasteLength,
    utilization: purchasedLength ? round((theoreticalLength / purchasedLength) * 100, 1) : 0,
    stockSummary,
    connectorSummary: {
      rightAngle: connectors.filter((connector) => connector.type === 'rightAngle').length,
      swivel: connectors.filter((connector) => connector.type === 'swivel').length,
      butt: Math.max(0, splitCount),
    },
    deckCount: decks.length,
    deckArea: round(decks.reduce((sum, deck) => sum + deck.area, 0)),
    cutPlans: plans,
  }
}

export function calculateScaffold(
  points: Point2D[],
  segmentLengths: number[],
  parameters: ScaffoldParameters,
): ScaffoldLayout {
  parameters = { ...DEFAULT_PARAMETERS, ...parameters }
  const physical = getPhysicalPoints(points, segmentLengths)
  const members: ScaffoldMember[] = []
  const decks: DeckPanel[] = []
  const warnings: LayoutWarning[] = []
  const postKeys = new Set<string>()
  let memberSequence = 1

  const addMember = (
    type: MemberType,
    start: Vector3Tuple,
    end: Vector3Tuple,
    layer?: number,
    pathSegment?: number,
    connectionPoints: Vector3Tuple[] = [start, end],
    startExtension = parameters.tubeEndExtension,
    endExtension = parameters.tubeEndExtension,
  ) => {
    const [physicalStart, physicalEnd] = extendLine(start, end, startExtension, endExtension)
    const length = round(vectorDistance(physicalStart, physicalEnd))
    if (length <= 0.001) return
    members.push({
      id: `M${memberSequence++}`,
      type,
      start: physicalStart,
      end: physicalEnd,
      connectionPoints,
      length,
      layer,
      pathSegment,
    })
  }

  const layerCount = Math.max(1, Math.ceil(parameters.height / parameters.liftHeight))
  const rowCount = Math.max(2, Math.round(parameters.rowCount))
  physical.slice(0, -1).forEach((start2d, segmentIndex) => {
    const end2d = physical[segmentIndex + 1]
    const segmentLength = Math.hypot(end2d[0] - start2d[0], end2d[1] - start2d[1])
    if (segmentLength <= 0.001) {
      warnings.push({
        id: `zero-length-${segmentIndex}`,
        message: `第 ${segmentIndex + 1} 段的两个节点重合，请移动节点或删除该路径段。`,
      })
      return
    }
    const bayCount = Math.max(1, Math.ceil(segmentLength / parameters.postSpacing))
    const bayLength = segmentLength / bayCount
    const direction: [number, number] = [
      (end2d[0] - start2d[0]) / segmentLength,
      (end2d[1] - start2d[1]) / segmentLength,
    ]
    const normal: [number, number] = [-direction[1], direction[0]]
    const rows: Array<Array<Vector3Tuple>> = Array.from({ length: rowCount }, () => [])

    for (let station = 0; station <= bayCount; station += 1) {
      for (let row = 0; row < rowCount; row += 1) {
        const offset = (row / (rowCount - 1)) * parameters.width
        const point: Vector3Tuple = [
          round(start2d[0] + direction[0] * bayLength * station + normal[0] * offset),
          0,
          round(start2d[1] + direction[1] * bayLength * station + normal[1] * offset),
        ]
        rows[row].push(point)
        const key = pointKey(point)
        if (!postKeys.has(key)) {
          postKeys.add(key)
          addMember(
            'post',
            point,
            [point[0], parameters.height, point[2]],
            undefined,
            segmentIndex,
            [point, [point[0], parameters.height, point[2]]],
            0,
            parameters.postTopExtension,
          )
        }
      }
    }

    for (let layer = 1; layer <= layerCount; layer += 1) {
      const elevation = Math.min(parameters.height, round(layer * parameters.liftHeight))
      for (const row of rows) {
        for (let bay = 0; bay < row.length - 1; bay += 1) {
          addMember(
            'longitudinal',
            [row[bay][0], elevation, row[bay][2]],
            [row[bay + 1][0], elevation, row[bay + 1][2]],
            layer,
            segmentIndex,
          )
        }
      }

      rows[0].forEach((outerPoint, station) => {
        const innerPoint = rows[rowCount - 1][station]
        const transverseConnections = rows.map((row) => [row[station][0], elevation, row[station][2]] as Vector3Tuple)
        addMember(
          'transverse',
          [outerPoint[0], elevation, outerPoint[2]],
          [innerPoint[0], elevation, innerPoint[2]],
          layer,
          segmentIndex,
          transverseConnections,
        )
        if (
          station % parameters.wallTieHorizontalBays === 0 &&
          layer % parameters.wallTieVerticalLifts === 0
        ) {
          addMember(
            'wallTie',
            [innerPoint[0], elevation, innerPoint[2]],
            [
              round(innerPoint[0] + normal[0] * 0.65),
              elevation,
              round(innerPoint[2] + normal[1] * 0.65),
            ],
            layer,
            segmentIndex,
          )
        }
      })

      if (layer % Math.max(1, Math.round(parameters.deckLiftInterval)) === 0) {
        for (let bay = 0; bay < bayCount; bay += 1) {
          const outerStart = rows[0][bay]
          const outerEnd = rows[0][bay + 1]
          const innerEnd = rows[rowCount - 1][bay + 1]
          const innerStart = rows[rowCount - 1][bay]
          const deckElevation = elevation + 0.055
          decks.push({
            id: `D${decks.length + 1}`,
            corners: [
              [outerStart[0], deckElevation, outerStart[2]],
              [outerEnd[0], deckElevation, outerEnd[2]],
              [innerEnd[0], deckElevation, innerEnd[2]],
              [innerStart[0], deckElevation, innerStart[2]],
            ],
            area: round(bayLength * parameters.width),
            layer,
            pathSegment: segmentIndex,
          })
        }
      }
    }

    for (let startBay = 0; startBay < bayCount; startBay += parameters.braceBayCount) {
      const endBay = Math.min(bayCount, startBay + parameters.braceBayCount)
      const outerRow = rows[0]
      for (let startLift = 0; startLift < layerCount; startLift += 2) {
        const bottomElevation = round(startLift * parameters.liftHeight)
        const topElevation = Math.min(parameters.height, round((startLift + 2) * parameters.liftHeight))
        addMember(
          'brace',
          [outerRow[startBay][0], bottomElevation + 0.1, outerRow[startBay][2]],
          [outerRow[endBay][0], topElevation, outerRow[endBay][2]],
          undefined,
          segmentIndex,
        )
        addMember(
          'brace',
          [outerRow[endBay][0], bottomElevation + 0.1, outerRow[endBay][2]],
          [outerRow[startBay][0], topElevation, outerRow[startBay][2]],
          undefined,
          segmentIndex,
        )
      }
    }

    if (bayLength < parameters.postSpacing * 0.55) {
      warnings.push({
        id: `short-bay-${segmentIndex}`,
        message: `第 ${segmentIndex + 1} 段末跨仅 ${bayLength.toFixed(2)}m，请复核立杆间距。`,
      })
    }
  })

  const connectors: ScaffoldConnector[] = members
    .filter((member) => member.type !== 'post')
    .flatMap((member) => member.connectionPoints.map((position, index) => ({
      id: `C-${member.id}-${index + 1}`,
      type: member.type === 'brace' ? 'swivel' as const : 'rightAngle' as const,
      position,
      memberId: member.id,
    })))

  return {
    members,
    decks,
    connectors,
    warnings,
    materials: optimizeCuts(members, decks, connectors, parameters.stockLengths),
  }
}

export function countMembers(layout: ScaffoldLayout) {
  return layout.members.reduce<Record<MemberType, number>>(
    (counts, member) => ({ ...counts, [member.type]: counts[member.type] + 1 }),
    { post: 0, longitudinal: 0, transverse: 0, brace: 0, wallTie: 0 },
  )
}