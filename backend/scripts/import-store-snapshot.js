import { promises as fs } from 'node:fs'
import { createStorePersistence } from '../src/store-persistence.js'
import { validateStoreSnapshot } from '../src/store-validation.js'

const inputFile = process.argv[2]
if (!inputFile) {
  console.error('Usage: node scripts/import-store-snapshot.js <snapshot.json>')
  process.exit(2)
}

const raw = await fs.readFile(inputFile, 'utf8')
const store = JSON.parse(raw)
const validation = validateStoreSnapshot(store)

if (!validation.ok) {
  console.error(JSON.stringify({
    ok: false,
    inputFile,
    error: 'Snapshot validation failed; import aborted',
    issues: validation.issues,
  }, null, 2))
  process.exit(1)
}

const persistence = createStorePersistence(store)
await persistence.flush()

console.log(JSON.stringify({
  ok: true,
  inputFile,
  dataLayer: persistence.dataLayer,
  dataFile: persistence.dataFile,
  databaseTable: persistence.databaseTable,
  questionPacks: Array.isArray(store.questionPacks) ? store.questionPacks.length : 0,
  questions: Array.isArray(store.questions) ? store.questions.length : 0,
  users: Array.isArray(store.users) ? store.users.length : 0,
  validation: validation.summary,
}, null, 2))
