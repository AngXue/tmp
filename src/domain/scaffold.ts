export type Point2D = {
  id: string
  x: number
  y: number
}

export type ScaffoldParameters = {
  height: number
  width: number
  postSpacing: number
  liftHeight: number
  braceBayCount: number
  wallTieHorizontalBays: number
  wallTieVerticalLifts: number
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
  length: number
  layer?: number
  pathSegment?: number
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
  cutPlans: CutPlan[]
}

export type ScaffoldLayout = {
  members: ScaffoldMember[]
  warnings: LayoutWarning[]
  materials: MaterialResult
}

export const DEFAULT_PARAMETERS: ScaffoldParameters = {
  height: 8.4,
  width: 1.2,
  postSpacing: 1.8,
  liftHeight: 1.8,
  braceBayCount: 3,
  wallTieHorizontalBays: 3,
  wallTieVerticalLifts: 2,
  pipeDiameter: 0.048,
  stockLengths: [6, 5, 4, 3, 2],
}

const round = (value: number, precision = 3) => Number(value.toFixed(precision))
const vectorDistance = (a: Vector3Tuple, b: Vector3Tuple) =>
  Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
const pointKey = (point: Vector3Tuple) => point.map((value) => round(value)).join(':')

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

function optimizeCuts(members: ScaffoldMember[], stockLengths: number[]): MaterialResult {
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
      rightAngle: members.filter((member) => member.type === 'longitudinal' || member.type === 'transverse' || member.type === 'wallTie').length * 2,
      swivel: members.filter((member) => member.type === 'brace').length * 2,
      butt: Math.max(0, splitCount),
    },
    cutPlans: plans,
  }
}

export function calculateScaffold(
  points: Point2D[],
  segmentLengths: number[],
  parameters: ScaffoldParameters,
): ScaffoldLayout {
  const physical = getPhysicalPoints(points, segmentLengths)
  const members: ScaffoldMember[] = []
  const warnings: LayoutWarning[] = []
  const postKeys = new Set<string>()
  let memberSequence = 1

  const addMember = (
    type: MemberType,
    start: Vector3Tuple,
    end: Vector3Tuple,
    layer?: number,
    pathSegment?: number,
  ) => {
    const length = round(vectorDistance(start, end))
    if (length <= 0.001) return
    members.push({ id: `M${memberSequence++}`, type, start, end, length, layer, pathSegment })
  }

  const layerCount = Math.max(1, Math.ceil(parameters.height / parameters.liftHeight))
  physical.slice(0, -1).forEach((start2d, segmentIndex) => {
    const end2d = physical[segmentIndex + 1]
    const segmentLength = Math.hypot(end2d[0] - start2d[0], end2d[1] - start2d[1])
    const bayCount = Math.max(1, Math.ceil(segmentLength / parameters.postSpacing))
    const bayLength = segmentLength / bayCount
    const direction: [number, number] = [
      (end2d[0] - start2d[0]) / segmentLength,
      (end2d[1] - start2d[1]) / segmentLength,
    ]
    const normal: [number, number] = [-direction[1], direction[0]]
    const rows: Array<Array<Vector3Tuple>> = [[], []]

    for (let station = 0; station <= bayCount; station += 1) {
      for (let row = 0; row < 2; row += 1) {
        const offset = row * parameters.width
        const point: Vector3Tuple = [
          round(start2d[0] + direction[0] * bayLength * station + normal[0] * offset),
          0,
          round(start2d[1] + direction[1] * bayLength * station + normal[1] * offset),
        ]
        rows[row].push(point)
        const key = pointKey(point)
        if (!postKeys.has(key)) {
          postKeys.add(key)
          addMember('post', point, [point[0], parameters.height, point[2]], undefined, segmentIndex)
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
        const innerPoint = rows[1][station]
        addMember(
          'transverse',
          [outerPoint[0], elevation, outerPoint[2]],
          [innerPoint[0], elevation, innerPoint[2]],
          layer,
          segmentIndex,
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
    }

    for (let startBay = 0; startBay < bayCount; startBay += parameters.braceBayCount) {
      const endBay = Math.min(bayCount, startBay + parameters.braceBayCount)
      const braceHeight = Math.min(parameters.height, parameters.liftHeight * 2)
      for (const row of rows) {
        const reverse = Math.floor(startBay / parameters.braceBayCount) % 2 === 1
        const bottom = row[reverse ? endBay : startBay]
        const top = row[reverse ? startBay : endBay]
        addMember(
          'brace',
          [bottom[0], 0.15, bottom[2]],
          [top[0], braceHeight, top[2]],
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

  return { members, warnings, materials: optimizeCuts(members, parameters.stockLengths) }
}

export function countMembers(layout: ScaffoldLayout) {
  return layout.members.reduce<Record<MemberType, number>>(
    (counts, member) => ({ ...counts, [member.type]: counts[member.type] + 1 }),
    { post: 0, longitudinal: 0, transverse: 0, brace: 0, wallTie: 0 },
  )
}