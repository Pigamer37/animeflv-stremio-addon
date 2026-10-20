//Same checks as test/sources.test.js but against the real sites: fails when a site changes its HTML.
const { describe, it } = require("node:test")
const { SOURCES, checkSearch, checkMeta, checkStreams, checkOnAir } = require("../helpers/sources.js")

for (const src of SOURCES) {
  describe(`${src.name} (live)`, () => {
    it("search finds the known title", () => checkSearch(src))
    it("metadata lists its episodes", () => checkMeta(src))
    it("episode 1 has streams", () => checkStreams(src))
    if (src.onAirPageSize) it("On Air lists every page", { timeout: 300000 }, () => checkOnAir(src))
  })
}
