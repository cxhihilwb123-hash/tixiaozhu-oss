import { promises as fs } from 'node:fs'
import path from 'node:path'
import { seedData } from '../src/seed-data.js'
import { STORE_DATA_FILE } from '../src/store-persistence.js'

await fs.mkdir(path.dirname(STORE_DATA_FILE), { recursive: true })
await fs.writeFile(STORE_DATA_FILE, JSON.stringify({
  ...structuredClone(seedData),
  favoriteQuestions: [],
  questionPackVersions: [],
}, null, 2), 'utf8')

console.log(`Store reset to seed snapshot: ${STORE_DATA_FILE}`)
