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
    expect(result.stdout).toContain('1 level file(s); 0 failure(s)')
  })

  it('recursively checks files and reports all invalid files with nonzero exit status', () => {
    const folder = path.join(temp, 'mixed')
    mkdirSync(path.join(folder, 'nested'), { recursive: true })
    writeFileSync(path.join(folder, 'valid.json'), JSON.stringify(valid))
    writeFileSync(path.join(folder, 'bad.json'), '{')
    const impossible = { ...valid, availableGatePalette: { OR: 1 } }
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
})
