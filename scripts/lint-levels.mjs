import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintLevel } from '../src/content/levelLinter.ts'

async function collect(input) {
  const info = await stat(input)
  if (info.isFile()) {
    if (path.extname(input).toLowerCase() !== '.json') {
      throw new Error(`expected a JSON file: ${input}`)
    }
    return [input]
  }
  if (!info.isDirectory()) throw new Error(`expected a file or directory: ${input}`)
  const entries = await readdir(input, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const child = path.join(input, entry.name)
    if (entry.isDirectory()) files.push(...await collect(child))
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.json') files.push(child)
  }
  return files
}

const args = process.argv.slice(2)
const inputs = args.length > 0 ? args : [fileURLToPath(new URL('../src/content/levels/', import.meta.url))]
const files = new Set()
let failures = 0
for (const input of inputs) {
  try {
    const found = await collect(path.resolve(input))
    if (found.length === 0) throw new Error('no level JSON files found')
    for (const file of found) files.add(file)
  } catch (error) {
    console.error(`FAIL ${input}: ${error.message}`)
    failures += 1
  }
}
for (const file of [...files].sort()) {
  try {
    const result = lintLevel(await readFile(file, 'utf8'))
    console.log(`PASS ${path.relative(process.cwd(), file)} (${result.levelId}): solvable`)
  } catch (error) {
    console.error(`FAIL ${path.relative(process.cwd(), file)}: ${error.message}`)
    failures += 1
  }
}
console.log(`Checked ${files.size} level file(s); ${failures} failure(s).`)
process.exitCode = failures > 0 ? 1 : 0
