import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { seedData } from './seed-data.js'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const STORE_DATA_FILE = process.env.TIXIAOZHU_DATA_FILE || path.join(backendDir, 'data', 'store.json')
export const STORE_DATA_LAYER = process.env.TIXIAOZHU_DATA_LAYER || (process.env.DATABASE_URL || process.env.TIXIAOZHU_DATABASE_URL ? 'postgres' : 'file')
export const STORE_DATABASE_URL = process.env.TIXIAOZHU_DATABASE_URL || process.env.DATABASE_URL || ''
const IS_PRODUCTION_RUNTIME = process.env.NODE_ENV === 'production' || process.env.TIXIAOZHU_ENV === 'production'
const ALLOW_FILE_STORE_FOR_ISOLATED_TESTS = process.env.ALLOW_FILE_STORE_FOR_ISOLATED_TESTS === 'true' && process.env.NODE_ENV !== 'production'
const normalizeIdentifier = (value, fallback) => (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(value || '')) ? String(value) : fallback)
const STORE_DATABASE_TABLE = normalizeIdentifier(process.env.TIXIAOZHU_DATABASE_TABLE, 'tixiaozhu_store')
const STORE_DATABASE_ID = process.env.TIXIAOZHU_STORE_ID || 'main'

const preserveFields = (item, fields) => fields.reduce((result, field) => {
  if (item && Object.prototype.hasOwnProperty.call(item, field)) result[field] = item[field]
  return result
}, {})

const mergeSeededCollection = (baseItems = [], rawItems = [], mutableFields = []) => {
  if (!Array.isArray(rawItems)) return baseItems

  const baseIds = new Set(baseItems.map(item => String(item.id)))
  const rawById = new Map(rawItems.map(item => [String(item.id), item]))
  const upgradedSeedItems = baseItems.map((baseItem) => {
    const rawItem = rawById.get(String(baseItem.id))
    return rawItem ? { ...baseItem, ...preserveFields(rawItem, mutableFields) } : baseItem
  })
  const customItems = rawItems.filter(item => !baseIds.has(String(item.id)))
  return [...upgradedSeedItems, ...customItems]
}

const withDefaults = (rawStore = {}) => {
  const base = structuredClone(seedData)
  return {
    ...base,
    ...rawStore,
    questionPacks: mergeSeededCollection(base.questionPacks, rawStore.questionPacks, [
      'status',
      'accessType',
      'isMemberOnly',
      'pointCost',
      'usageCount',
      'completionRate',
      'questionCount',
      'reviewStatus',
      'updatedAt',
    ]),
    questions: mergeSeededCollection(base.questions, rawStore.questions, [
      'packId',
      'sortOrder',
      'reviewStatus',
      'source',
      'sourceLabel',
      'updatedAt',
    ]),
    knowledgePoints: mergeSeededCollection(base.knowledgePoints, rawStore.knowledgePoints, [
      'wrongRate',
      'status',
      'roundAdvice',
      'updatedAt',
    ]),
    settings: {
      ...base.settings,
      ...(rawStore.settings || {}),
    },
    studentAuthUsers: Array.isArray(rawStore.studentAuthUsers) ? rawStore.studentAuthUsers : [],
    paymentWebhookEvents: Array.isArray(rawStore.paymentWebhookEvents) ? rawStore.paymentWebhookEvents : [],
    favoriteQuestions: Array.isArray(rawStore.favoriteQuestions) ? rawStore.favoriteQuestions : [],
    questionPackVersions: Array.isArray(rawStore.questionPackVersions) ? rawStore.questionPackVersions : [],
  }
}

const createDatabasePool = () => {
  if (!STORE_DATABASE_URL) {
    throw new Error('DATABASE_URL / TIXIAOZHU_DATABASE_URL is required when TIXIAOZHU_DATA_LAYER=postgres')
  }
  return new pg.Pool({
    connectionString: STORE_DATABASE_URL,
    max: Number(process.env.TIXIAOZHU_DATABASE_POOL_MAX || 4),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
}

let databasePool = null

const getDatabasePool = () => {
  databasePool ||= createDatabasePool()
  return databasePool
}

const ensureDatabaseTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${STORE_DATABASE_TABLE} (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

const loadStoreFromDatabase = async () => {
  const pool = getDatabasePool()
  await ensureDatabaseTable(pool)
  const result = await pool.query(`SELECT data FROM ${STORE_DATABASE_TABLE} WHERE id = $1`, [STORE_DATABASE_ID])
  if (result.rows[0]?.data) return withDefaults(result.rows[0].data)

  const initial = withDefaults()
  await pool.query(
    `INSERT INTO ${STORE_DATABASE_TABLE} (id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [STORE_DATABASE_ID, JSON.stringify(initial)]
  )
  return initial
}

export const loadStore = async () => {
  if (IS_PRODUCTION_RUNTIME && STORE_DATA_LAYER !== 'postgres' && !ALLOW_FILE_STORE_FOR_ISOLATED_TESTS) {
    throw new Error('Production runtime requires TIXIAOZHU_DATA_LAYER=postgres and DATABASE_URL / TIXIAOZHU_DATABASE_URL')
  }

  if (STORE_DATA_LAYER === 'postgres') {
    try {
      return await loadStoreFromDatabase()
    } catch (error) {
      console.error(`[store] failed to load PostgreSQL store: ${error.message}`)
      throw error
    }
  }

  try {
    const raw = await fs.readFile(STORE_DATA_FILE, 'utf8')
    return withDefaults(JSON.parse(raw))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(`[store] failed to load ${STORE_DATA_FILE}: ${error.message}`)
    }
    return withDefaults()
  }
}

export const createStorePersistence = (store) => {
  let timer = null
  let activeWrite = null
  let queued = false
  let dirty = false

  const writeRetryCount = Number(process.env.TIXIAOZHU_STORE_WRITE_RETRIES || 2)
  const writeRetryDelayMs = Number(process.env.TIXIAOZHU_STORE_WRITE_RETRY_DELAY_MS || 150)

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  const writeFileSnapshot = async () => {
    await fs.mkdir(path.dirname(STORE_DATA_FILE), { recursive: true })
    const tempFile = `${STORE_DATA_FILE}.tmp`
    await fs.writeFile(tempFile, JSON.stringify(store, null, 2), 'utf8')
    await fs.rename(tempFile, STORE_DATA_FILE)
  }

  const writeDatabaseSnapshotOnce = async () => {
    const pool = getDatabasePool()
    await ensureDatabaseTable(pool)
    await pool.query(
      `INSERT INTO ${STORE_DATABASE_TABLE} (id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [STORE_DATABASE_ID, JSON.stringify(store)]
    )
  }

  const writeDatabaseSnapshot = async () => {
    let lastError = null
    for (let attempt = 0; attempt <= writeRetryCount; attempt += 1) {
      try {
        await writeDatabaseSnapshotOnce()
        return
      } catch (error) {
        lastError = error
        if (attempt >= writeRetryCount) break
        await wait(writeRetryDelayMs * (attempt + 1))
      }
    }
    throw lastError
  }

  const writeSnapshot = STORE_DATA_LAYER === 'postgres' ? writeDatabaseSnapshot : writeFileSnapshot

  const flush = async () => {
    if (!dirty && !activeWrite && !timer) return

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    if (activeWrite) {
      queued = true
      await activeWrite
      if (!queued) return
      queued = false
    }

    dirty = false
    activeWrite = writeSnapshot()
      .catch((error) => {
        dirty = true
        const target = STORE_DATA_LAYER === 'postgres' ? `${STORE_DATABASE_TABLE}:${STORE_DATABASE_ID}` : STORE_DATA_FILE
        console.error(`[store] failed to persist ${target}: ${error.message}`)
      })
      .finally(() => {
        activeWrite = null
      })

    await activeWrite

    if (queued) {
      queued = false
      await flush()
    }
  }

  const schedule = () => {
    dirty = true
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      flush().catch((error) => {
        const target = STORE_DATA_LAYER === 'postgres' ? `${STORE_DATABASE_TABLE}:${STORE_DATABASE_ID}` : STORE_DATA_FILE
        console.error(`[store] failed to flush ${target}: ${error.message}`)
      })
    }, 120)
  }

  return {
    dataLayer: STORE_DATA_LAYER,
    dataFile: STORE_DATA_LAYER === 'file' ? STORE_DATA_FILE : null,
    databaseTable: STORE_DATA_LAYER === 'postgres' ? STORE_DATABASE_TABLE : null,
    flush,
    pending: () => Boolean(dirty || timer || activeWrite || queued),
    schedule,
  }
}
