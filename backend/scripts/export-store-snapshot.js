import { promises as fs } from 'node:fs'
import path from 'node:path'
import { loadStore } from '../src/store-persistence.js'
import { validateStoreSnapshot } from '../src/store-validation.js'

const outputFile = process.argv[2] || path.resolve('backend', 'data', `store-backup-${Date.now()}.json`)
const store = await loadStore()
const validation = validateStoreSnapshot(store)

if (!validation.ok) {
  console.error(JSON.stringify({
    ok: false,
    error: 'Current store snapshot is invalid; export aborted',
    issues: validation.issues,
  }, null, 2))
  process.exit(1)
}

await fs.mkdir(path.dirname(outputFile), { recursive: true })
await fs.writeFile(outputFile, JSON.stringify(store, null, 2), 'utf8')

console.log(JSON.stringify({
  ok: true,
  outputFile,
  questionPacks: Array.isArray(store.questionPacks) ? store.questionPacks.length : 0,
  questions: Array.isArray(store.questions) ? store.questions.length : 0,
  users: Array.isArray(store.users) ? store.users.length : 0,
  validation: validation.summary,
}, null, 2))
