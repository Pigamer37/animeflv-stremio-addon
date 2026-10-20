//Same checks as test/sources.test.js but against the real sites: fails when a site changes its HTML.
const { describe, it, before } = require("node:test")
const { SOURCES, checkSearch, checkMeta, checkStreams, checkOnAir, blockedInCI } = require("../helpers/sources.js")

for (const src of SOURCES) {
  describe(`${src.name} (live)`, () => {
    let blocked = false
    before(async () => { blocked = await blockedInCI(src.home) })
    const check = (name, fn, opts = {}) => it(name, opts, (t) => (blocked) ? t.skip(`${src.name} blocks this runner's IP (HTTP 403)`) : fn(src))
    check("search finds the known title", checkSearch)
    check("metadata lists its episodes", checkMeta)
    check("episode 1 has streams", checkStreams)
    if (src.onAirPageSize) check("On Air lists every page", checkOnAir, { timeout: 300000 })
  })
}
