import { promises as fs } from 'node:fs'
import { validateStoreSnapshot } from '../src/store-validation.js'

const inputFile = process.argv[2]
if (!inputFile) {
  console.error('Usage: node scripts/validate-store-snapshot.js <snapshot.json>')
  process.exit(2)
}

const snapshot = JSON.parse(await fs.readFile(inputFile, 'utf8'))
const report = validateStoreSnapshot(snapshot)

console.log(JSON.stringify({
  ok: report.ok,
  inputFile,
  summary: report.summary,
  issues: report.issues,
}, null, 2))

if (!report.ok) process.exit(1)
