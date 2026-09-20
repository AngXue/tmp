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
  spliceOverlap: number
  deckLiftInterval: number
  pipeDiameter: number
  stockLengths: number[]
}

export type MemberType = 'post' | 'longitudinal' | 'transverse'
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

export type PipeSegment = {
  id: string
  memberId: string
  type: MemberType
  start: Vector3Tuple
  end: Vector3Tuple
  stockLength: number
  sequence: number
  overlapWithPrevious: number
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
  type: 'rightAngle' | 'splice'
  position: Vector3Tuple
  memberId: string
}

export type LayoutWarning = {
  id: string
  message: string
}

export type PipeAssemblyPlan = {
  memberId: string
  requiredLength: number
  effectiveLength: number
  excessLength: number
  stockLengths: number[]
  segmentIds: string[]
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
    splice: number
  }
  pendingMaterialSummary: {
    brace: null
  }
  deckCount: number
  deckArea: number
  assemblyPlans: PipeAssemblyPlan[]
}

export type ScaffoldLayout = {
  members: ScaffoldMember[]
  pipeSegments: PipeSegment[]
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
  spliceOverlap: 1,
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

function chooseStockLengths(requiredLength: number, stockLengths: number[], overlap: number) {
  const stocks = [...stockLengths].filter((length) => length > overlap).sort((a, b) => b - a)
  if (!stocks.length) return [requiredLength]

  const maximumSegments = Math.ceil(requiredLength / (stocks[0] - overlap)) + 2
  let states = new Map<number, number[]>([[0, []]])

  for (let count = 1; count <= maximumSegments; count += 1) {
    const nextStates = new Map<number, number[]>()
    for (const [sum, combination] of states) {
      for (const stock of stocks) {
        const nextSum = round(sum + stock)
        if (!nextStates.has(nextSum)) nextStates.set(nextSum, [...combination, stock])
      }
    }

    const candidates = [...nextStates.entries()]
      .map(([sum, combination]) => ({
        combination,
        effectiveLength: round(sum - overlap * (combination.length - 1)),
      }))
      .filter((candidate) => candidate.effectiveLength + 0.001 >= requiredLength)
      .sort((a, b) => a.effectiveLength - b.effectiveLength)

    if (candidates.length) return candidates[0].combination
    states = nextStates
  }

  return [stocks[0]]
}

function createPipeAssembly(
  member: ScaffoldMember,
  stockLengths: number[],
  requestedOverlap: number,
  pipeDiameter: number,
): { segments: PipeSegment[]; connectors: ScaffoldConnector[]; plan: PipeAssemblyPlan } {
  const minimumStock = Math.min(...stockLengths)
  const overlap = Math.max(0, Math.min(requestedOverlap, minimumStock * 0.8))
  const selectedStocks = chooseStockLengths(member.length, stockLengths, overlap)
  const effectiveLength = round(selectedStocks.reduce((sum, stock) => sum + stock, 0) - overlap * (selectedStocks.length - 1))
  const excessLength = round(Math.max(0, effectiveLength - member.length))
  const start = new Vector(member.start)
  const end = new Vector(member.end)
  const direction = end.subtract(start).normalize()
  const assemblyStart = member.type === 'post'
    ? start
    : start.subtract(direction.scale(excessLength / 2))
  const lateral = direction.perpendicular().scale(pipeDiameter * 1.2)
  const segments: PipeSegment[] = []
  const spliceConnectors: ScaffoldConnector[] = []
  let cursor = assemblyStart

  selectedStocks.forEach((stockLength, index) => {
    const offset = index % 2 === 1 ? lateral : Vector.ZERO
    const segmentStart = cursor.add(offset)
    const segmentEnd = cursor.add(direction.scale(stockLength)).add(offset)
    const id = `S-${member.id}-${index + 1}`
    segments.push({
      id,
      memberId: member.id,
      type: member.type,
      start: segmentStart.toTuple(),
      end: segmentEnd.toTuple(),
      stockLength,
      sequence: index + 1,
      overlapWithPrevious: index === 0 ? 0 : overlap,
    })

    if (index > 0) {
      const overlapStart = cursor
      for (const positionRatio of [0.25, 0.75]) {
        spliceConnectors.push({
          id: `C-${member.id}-splice-${index}-${positionRatio}`,
          type: 'splice',
          position: overlapStart.add(direction.scale(overlap * positionRatio)).add(lateral.scale(0.5)).toTuple(),
          memberId: member.id,
        })
      }
    }
    cursor = cursor.add(direction.scale(stockLength - overlap))
  })

  return {
    segments,
    connectors: spliceConnectors,
    plan: {
      memberId: member.id,
      requiredLength: member.length,
      effectiveLength,
      excessLength,
      stockLengths: selectedStocks,
      segmentIds: segments.map((segment) => segment.id),
    },
  }
}

class Vector {
  static readonly ZERO = new Vector([0, 0, 0])
  private readonly value: Vector3Tuple

  constructor(value: Vector3Tuple) {
    this.value = value
  }

  add(other: Vector) {
    return new Vector(this.value.map((value, index) => value + other.value[index]) as Vector3Tuple)
  }

  subtract(other: Vector) {
    return new Vector(this.value.map((value, index) => value - other.value[index]) as Vector3Tuple)
  }

  scale(factor: number) {
    return new Vector(this.value.map((value) => value * factor) as Vector3Tuple)
  }

  normalize() {
    const length = Math.hypot(...this.value)
    return length > 0 ? this.scale(1 / length) : Vector.ZERO
  }

  perpendicular() {
    const [x, y, z] = this.value
    const candidate: Vector3Tuple = Math.abs(y) > 0.9 ? [1, 0, 0] : [-z, 0, x]
    return new Vector(candidate).normalize()
  }

  toTuple() {
    return this.value.map((value) => round(value)) as Vector3Tuple
  }
}

function calculateMaterials(
  members: ScaffoldMember[],
  pipeSegments: PipeSegment[],
  decks: DeckPanel[],
  connectors: ScaffoldConnector[],
  assemblyPlans: PipeAssemblyPlan[],
): MaterialResult {
  const theoreticalLength = round(members.reduce((sum, member) => sum + member.length, 0))
  const purchasedLength = round(pipeSegments.reduce((sum, segment) => sum + segment.stockLength, 0))
  const stockSummary = pipeSegments.reduce<Record<string, number>>((summary, segment) => {
    const key = `${segment.stockLength}m`
    summary[key] = (summary[key] ?? 0) + 1
    return summary
  }, {})

  return {
    theoreticalLength,
    purchasedLength,
    usedLength: theoreticalLength,
    wasteLength: round(purchasedLength - theoreticalLength),
    utilization: purchasedLength ? round((theoreticalLength / purchasedLength) * 100, 1) : 0,
    stockSummary,
    connectorSummary: {
      rightAngle: connectors.filter((connector) => connector.type === 'rightAngle').length,
      splice: connectors.filter((connector) => connector.type === 'splice').length,
    },
    pendingMaterialSummary: { brace: null },
    deckCount: decks.length,
    deckArea: round(decks.reduce((sum, deck) => sum + deck.area, 0)),
    assemblyPlans,
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
        const connectionPoints = row.map((point) => [point[0], elevation, point[2]] as Vector3Tuple)
        addMember(
          'longitudinal',
          connectionPoints[0],
          connectionPoints[connectionPoints.length - 1],
          layer,
          segmentIndex,
          connectionPoints,
        )
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

    if (bayLength < parameters.postSpacing * 0.55) {
      warnings.push({
        id: `short-bay-${segmentIndex}`,
        message: `第 ${segmentIndex + 1} 段末跨仅 ${bayLength.toFixed(2)}m，请复核立杆间距。`,
      })
    }
  })

  const rightAngleConnectors: ScaffoldConnector[] = members
    .filter((member) => member.type !== 'post')
    .flatMap((member) => member.connectionPoints.map((position, index) => ({
      id: `C-${member.id}-${index + 1}`,
      type: 'rightAngle' as const,
      position,
      memberId: member.id,
    })))
  const assemblies = members.map((member) =>
    createPipeAssembly(member, parameters.stockLengths, parameters.spliceOverlap, parameters.pipeDiameter))
  const pipeSegments = assemblies.flatMap((assembly) => assembly.segments)
  const connectors = [
    ...rightAngleConnectors,
    ...assemblies.flatMap((assembly) => assembly.connectors),
  ]
  const assemblyPlans = assemblies.map((assembly) => assembly.plan)

  return {
    members,
    pipeSegments,
    decks,
    connectors,
    warnings,
    materials: calculateMaterials(members, pipeSegments, decks, connectors, assemblyPlans),
  }
}

export function countMembers(layout: ScaffoldLayout) {
  return layout.members.reduce<Record<MemberType, number>>(
    (counts, member) => ({ ...counts, [member.type]: counts[member.type] + 1 }),
    { post: 0, longitudinal: 0, transverse: 0 },
  )
}