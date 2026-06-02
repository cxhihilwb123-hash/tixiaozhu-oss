import { buildCommercialLaunchReadinessReport } from '../src/commercial-launch-readiness.js'
import { loadStore } from '../src/store-persistence.js'

const store = await loadStore()
const report = buildCommercialLaunchReadinessReport(store, process.env)

console.log(JSON.stringify(report, null, 2))

if (report.readiness !== 'launch_ready') {
  process.exit(1)
}
