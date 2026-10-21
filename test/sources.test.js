//Scrapers against recorded HTML: catches code changes that break parsing, without touching the network.
const { describe, it, before, after } = require("node:test")
const path = require("node:path")
const fixtures = require("./helpers/fetch-fixtures.js")
const { SOURCES, checkSearch, checkMeta, checkStreams } = require("./helpers/sources.js")

for (const src of SOURCES) {
  describe(`${src.name} (recorded)`, () => {
    before(() => fixtures.replay(fixtures.load(path.join(__dirname, "fixtures", `${src.prefix}.json`))))
    after(fixtures.restore)
    it("parses search results", () => checkSearch(src))
    it("parses series metadata", () => checkMeta(src))
    it("parses episode streams", () => checkStreams(src))
  })
}
