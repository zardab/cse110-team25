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

async function main() {
  const args = process.argv.slice(2)
  const inputs = []
  let primaryInputs
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--inputs') {
      if (i + 1 >= args.length) throw new Error('--inputs requires a JSON object')
      primaryInputs = JSON.parse(args[++i])
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option: ${arg}`)
    } else inputs.push(arg)
  }
  if (inputs.length === 0) inputs.push(fileURLToPath(new URL('../src/content/levels/', import.meta.url)))
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
      const result = lintLevel(await readFile(file, 'utf8'), { primaryInputs })
      console.log(`PASS ${path.relative(process.cwd(), file)} (${result.levelId}): solvable for inputs ${JSON.stringify(result.primaryInputs)}`)
    } catch (error) {
      console.error(`FAIL ${path.relative(process.cwd(), file)}: ${error.message}`)
      failures += 1
    }
  }
  console.log(`Checked ${files.size} level file(s); ${failures} failure(s).`)
  process.exitCode = failures > 0 ? 1 : 0
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
