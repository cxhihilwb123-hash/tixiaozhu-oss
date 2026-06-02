import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const buildTargets = [
  { name: 'student frontend', dir: path.join(projectRoot, 'frontend', 'dist') },
  { name: 'admin frontend', dir: path.join(projectRoot, 'admin', 'dist') },
]

const scannedExtensions = new Set(['.html', '.js', '.css', '.json', '.txt'])
const forbiddenPatterns = [
  { label: 'local API origin', pattern: /127\.0\.0\.1:8787|localhost:8787|http:\/\/127\.0\.0\.1|http:\/\/localhost/i },
  { label: 'mock payment confirmation route', pattern: /\/payments\/mock-confirm|mock-confirm/i },
  { label: 'test payment copy', pattern: /测试支付|模拟支付|测试运行配置/ },
  { label: 'default admin copy', pattern: /默认测试账号|admin\/admin123|admin123/ },
  { label: 'mock AI provider copy', pattern: /mock-compatible|内置测试模型|local-review/i },
  { label: 'legacy demo order data', pattern: /WX202604|ALI202604|128,500|自动续费用户/ },
  { label: 'legacy sample pack copy', pattern: /四年级数学每日训练|初一有理数基础训练|阅读理解强化题包|四年级数学上册第1单元同步练/ },
  { label: 'prototype positioning copy', pattern: /适合继续往正式产品推进|后续可以在这个基础上切到真实账号体系/ },
]

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    return [fullPath]
  }))
  return files.flat()
}

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const excerptForMatch = (content, index) => {
  const start = Math.max(0, index - 60)
  const end = Math.min(content.length, index + 100)
  return content.slice(start, end).replace(/\s+/g, ' ').trim()
}

const checks = []
const findings = []
const vercelConfigPath = path.join(projectRoot, 'vercel.json')

if (process.env.VITE_ENABLE_API_FALLBACK === 'true') {
  findings.push({
    target: 'environment',
    file: '.env',
    label: 'production API fallback enabled',
    match: 'VITE_ENABLE_API_FALLBACK=true',
    excerpt: 'Production builds must not silently fall back when API calls fail.',
  })
}

try {
  const vercelConfig = await fs.readFile(vercelConfigPath, 'utf8')
  if (/backend\/data/i.test(vercelConfig)) {
    findings.push({
      target: 'vercel',
      file: 'vercel.json',
      label: 'backend data bundled into serverless function',
      match: 'backend/data',
      excerpt: 'Serverless deployment must not include local store snapshots or credentials.',
    })
  }
} catch {
  // Non-Vercel deployments can skip this config check.
}

for (const target of buildTargets) {
  const indexPath = path.join(target.dir, 'index.html')
  const hasIndex = await fileExists(indexPath)
  checks.push({ name: `${target.name} index exists`, ok: hasIndex, detail: indexPath })
  if (!hasIndex) continue

  const files = await walk(target.dir)
  const sourceMaps = files.filter(file => file.endsWith('.map'))
  checks.push({
    name: `${target.name} source maps are absent`,
    ok: sourceMaps.length === 0,
    detail: sourceMaps.length ? sourceMaps.map(file => path.relative(projectRoot, file)) : 'none',
  })

  for (const file of files) {
    if (!scannedExtensions.has(path.extname(file))) continue
    const content = await fs.readFile(file, 'utf8')
    for (const { label, pattern } of forbiddenPatterns) {
      const match = content.match(pattern)
      if (!match) continue
      findings.push({
        target: target.name,
        file: path.relative(projectRoot, file),
        label,
        match: match[0],
        excerpt: excerptForMatch(content, match.index || 0),
      })
    }
  }
}

checks.push({
  name: 'production bundles contain no forbidden launch residue',
  ok: findings.length === 0,
  detail: findings.length ? `${findings.length} finding(s)` : 'none',
})

const failed = checks.filter(item => !item.ok)
console.log(JSON.stringify({
  ok: failed.length === 0,
  scannedTargets: buildTargets.map(target => path.relative(projectRoot, target.dir)),
  checks,
  findings,
}, null, 2))

if (failed.length > 0) process.exit(1)
