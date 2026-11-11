//Re-records test/fixtures/<source>.json from the live sites: npm run test:record [-- <prefix>...]
const path = require("node:path")
const fixtures = require("./helpers/fetch-fixtures.js")
const { SOURCES, checkSearch, checkMeta, checkStreams } = require("./helpers/sources.js")

const only = process.argv.slice(2);
(async () => {
  for (const src of SOURCES.filter((s) => only.length === 0 || only.includes(s.prefix))) {
    const recorded = {}
    fixtures.record(recorded)
    try {
      await checkSearch(src); await checkMeta(src); await checkStreams(src)
      fixtures.save(path.join(__dirname, "fixtures", `${src.prefix}.json`), recorded)
      console.log(`${src.name}: recorded ${Object.keys(recorded).length} responses`)
    } catch (err) {
      console.error(`${src.name}: NOT recorded, live checks failed: ${err.message}`)
      process.exitCode = 1
    } finally {
      fixtures.restore()
    }
  }
})()
