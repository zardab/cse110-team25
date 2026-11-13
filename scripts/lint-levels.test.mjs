// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const cli = path.join(root, 'scripts/lint-levels.mjs')
const temp = mkdtempSync(path.join(tmpdir(), 'level-linter-test-'))
const valid = JSON.parse(readFileSync(path.join(root, 'src/content/levels/level_01_and.json'), 'utf8'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))

function run(...args) {
  return spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args], {
    cwd: root, encoding: 'utf8', timeout: 20_000,
  })
}

describe('level linter CLI', () => {
  it('checks the authored levels by default', () => {
    const result = run()
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('level_01_and')
    expect(result.stdout).toContain('6 level file(s); 0 failure(s)')
  })

  it('recursively checks files and reports all invalid files with nonzero exit status', () => {
    const folder = path.join(temp, 'mixed')
    mkdirSync(path.join(folder, 'nested'), { recursive: true })
    writeFileSync(path.join(folder, 'valid.json'), JSON.stringify(valid))
    writeFileSync(path.join(folder, 'bad.json'), '{')
    // Both slots have identical inputs and gates, but contradictory targets.
    const impossible = { ...valid, availableGatePalette: { AND: 2 },
      primaryOutputs: ['out_Y', 'out_Z'], targetOutputs: { out_Y: 1, out_Z: 0 },
      slots: {
        slot_1: { ...valid.slots.slot_1, allowedGates: ['AND'] },
        slot_2: { ...valid.slots.slot_1, id: 'slot_2', allowedGates: ['AND'], outputWireId: 'out_Z' },
      },
    }
    writeFileSync(path.join(folder, 'nested/impossible.json'), JSON.stringify(impossible))
    const result = run(folder)
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('3 level file(s); 2 failure(s)')
    expect(result.stderr).toContain('bad.json: level: invalid JSON syntax')
    expect(result.stderr).toContain('impossible.json: level_01_and: no complete solvable assignment')
  })

  it('fails for missing paths and empty directories', () => {
    const empty = path.join(temp, 'empty')
    mkdirSync(empty)
    const result = run(path.join(temp, 'missing'), empty)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing')
    expect(result.stderr).toContain('no level JSON files found')
  })

  it('accepts an explicit JSON file and avoids checking duplicate paths twice', () => {
    const file = path.join(root, 'src/content/levels/level_01_and.json')
    const result = run(file, file)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('1 level file(s); 0 failure(s)')
  })

  it('supports fixed primary inputs for the runtime target-output contract', () => {
    const file = path.join(temp, 'and-only.json')
    writeFileSync(file, JSON.stringify({ ...valid, availableGatePalette: { AND: 1 } }))
    expect(run(file, '--inputs', '{"in_A":1,"in_B":1}').status).toBe(0)
    const failed = run(file, '--inputs', '{"in_A":0,"in_B":0}')
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('for the supplied primary inputs')
    expect(run(file, '--inputs', '{broken').status).toBe(1)
    expect(run(file, '--inputs').status).toBe(1)
  })

  it('fails by default when authored inputValues cannot reach the target', () => {
    const file = path.join(temp, 'unsolvable-inputs.json')
    writeFileSync(file, JSON.stringify({ ...valid, inputValues: { in_A: 0, in_B: 0 } }))
    const failed = run(file)
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('for the level inputValues')
    expect(run(file, '--inputs', '{"in_A":1,"in_B":1}').status).toBe(0)
  })
})
