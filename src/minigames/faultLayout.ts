import type { CompiledCircuit } from '../types/circuit'

/**
 * Places a small circuit on a rectangle: inputs down the left edge, outputs down the
 * right, and gates in columns by depth so every wire runs left to right.
 */

export interface Point {
  readonly x: number
  readonly y: number
}

export interface CircuitLayout {
  /** Switch centres keyed by primary input ID. */
  readonly inputs: Readonly<Record<string, Point>>
  /** Gate box centres keyed by slot ID. */
  readonly gates: Readonly<Record<string, Point>>
  /** Bulb centres keyed by primary output wire ID. */
  readonly outputs: Readonly<Record<string, Point>>
}

export interface LayoutArea {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

function spread(count: number, top: number, bottom: number): number[] {
  return Array.from({ length: count }, (_, index) => top + (bottom - top) * (index + 1) / (count + 1))
}

export function layoutCircuit(circuit: CompiledCircuit, area: LayoutArea): CircuitLayout {
  const depth = new Map<string, number>()
  for (const slotId of circuit.executionOrder) {
    const parents = circuit.slots[slotId].inputs
      .filter((input) => input.sourceType === 'SLOT_OUTPUT')
      .map((input) => depth.get(input.sourceId) ?? 0)
    depth.set(slotId, 1 + Math.max(0, ...parents))
  }
  const columns = Math.max(0, ...depth.values())

  const inputs: Record<string, Point> = {}
  spread(circuit.primaryInputs.length, area.top, area.bottom).forEach((y, index) => {
    inputs[circuit.primaryInputs[index]] = { x: area.left, y }
  })

  const gates: Record<string, Point> = {}
  const sourceY = (source: { sourceType: string; sourceId: string }): number =>
    source.sourceType === 'PRIMARY_INPUT' ? inputs[source.sourceId].y : gates[source.sourceId].y
  for (let column = 1; column <= columns; column += 1) {
    const x = area.left + (area.right - area.left) * column / (columns + 1)
    // Order each column by where its wires come from, so they cross as little as possible.
    const members = circuit.executionOrder
      .filter((slotId) => depth.get(slotId) === column)
      .map((slotId) => {
        const ys = circuit.slots[slotId].inputs.map(sourceY)
        return { slotId, y: ys.reduce((sum, y) => sum + y, 0) / ys.length }
      })
      .sort((a, b) => a.y - b.y || a.slotId.localeCompare(b.slotId))
    spread(members.length, area.top, area.bottom).forEach((y, index) => {
      gates[members[index].slotId] = { x, y }
    })
  }

  const outputs: Record<string, Point> = {}
  const producers = new Map(Object.values(circuit.slots).map((slot) => [slot.outputWireId, slot.id]))
  const ordered = [...circuit.primaryOutputs]
    .sort((a, b) => gates[producers.get(a)!].y - gates[producers.get(b)!].y)
  spread(ordered.length, area.top, area.bottom).forEach((y, index) => {
    outputs[ordered[index]] = { x: area.right, y }
  })

  return { inputs, gates, outputs }
}
