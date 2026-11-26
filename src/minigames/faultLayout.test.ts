import { describe, expect, it } from 'vitest'
import { faultLevels } from '../content/faultLevelCatalog'
import { layoutCircuit } from './faultLayout'

const area = { left: 0, right: 400, top: 0, bottom: 200 }

describe('layoutCircuit', () => {
  it('puts inputs on the left, outputs on the right, and gates in columns by depth', () => {
    const deep = faultLevels.find((level) => level.id === 'fault_04_deep_chain')!
    const layout = layoutCircuit(deep, area)
    for (const id of deep.primaryInputs) expect(layout.inputs[id].x).toBe(0)
    for (const id of deep.primaryOutputs) expect(layout.outputs[id].x).toBe(400)
    // NAND and NOT read only inputs (column 1); OR and AND read them (column 2); XOR is deepest.
    expect(layout.gates.g_nand.x).toBe(100)
    expect(layout.gates.g_not.x).toBe(100)
    expect(layout.gates.g_or.x).toBe(200)
    expect(layout.gates.g_and.x).toBe(200)
    expect(layout.gates.g_xor.x).toBe(300)
  })

  it('spreads a column evenly and orders it by where its wires come from', () => {
    const deep = faultLevels.find((level) => level.id === 'fault_04_deep_chain')!
    const layout = layoutCircuit(deep, area)
    // NAND reads A and B (the top inputs); NOT reads C, so NAND sits above NOT.
    expect(layout.gates.g_nand.y).toBeLessThan(layout.gates.g_not.y)
    expect(layout.gates.g_nand.y).toBeCloseTo(200 / 3)
    expect(layout.gates.g_not.y).toBeCloseTo(400 / 3)
  })

  it('gives every node of every shipped level a position inside the area', () => {
    for (const level of faultLevels) {
      const layout = layoutCircuit(level, area)
      const points = [...Object.values(layout.inputs), ...Object.values(layout.gates), ...Object.values(layout.outputs)]
      expect(points).toHaveLength(level.primaryInputs.length + level.executionOrder.length + level.primaryOutputs.length)
      for (const { x, y } of points) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(400)
        expect(y).toBeGreaterThan(0)
        expect(y).toBeLessThan(200)
      }
    }
  })
})
