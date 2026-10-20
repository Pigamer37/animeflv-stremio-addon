//The Express app with the network disabled: routing, manifest and graceful failures, no site involved.
const { describe, it, before, after } = require("node:test")
const assert = require("node:assert/strict")
const { startServer } = require("./helpers/server.js")
const { SOURCES } = require("./helpers/sources.js")

describe("server (offline)", () => {
  let server
  before(async () => { server = await startServer({ offline: true }) })
  after(() => server?.stop())

  it("serves a valid manifest", async () => {
    const resp = await server.get("/manifest.json")
    assert.equal(resp.status, 200)
    const manifest = await resp.json()
    assert.ok(manifest.id && manifest.version && manifest.name)
    const ids = manifest.catalogs.map((c) => `${c.type}/${c.id}`)
    assert.equal(new Set(ids).size, ids.length, "duplicated catalog")
    assert.ok(manifest.catalogs.every((c) => !c.id.includes("onair")), "On Air catalogs must be opt-in")
    for (const src of SOURCES) {
      assert.ok(manifest.idPrefixes.includes(`${src.prefix}:`), `${src.prefix}: missing from idPrefixes`)
      assert.ok(manifest.catalogs.some((c) => c.id === src.prefix), `${src.prefix} search catalog missing`)
    }
    assert.ok(["tt", "kitsu:", "mal:", "anilist:"].every((p) => manifest.idPrefixes.includes(p)))
  })

  it("only adds the On Air catalogs chosen in the config", async () => {
    const manifest = await (await server.get("/onAirCatalogs=latanime,jkanime/manifest.json")).json()
    assert.deepEqual(manifest.catalogs.filter((c) => c.id.includes("onair")).map((c) => c.id).sort(), ["jkanime|onair", "latanime|onair"])
  })

  it("serves the manifest when no On Air catalog is chosen", async () => {
    const resp = await server.get("/externalStreams=true/manifest.json") //what the configure page builds with only "external streams" ticked
    assert.equal(resp.status, 200)
    assert.ok((await resp.json()).catalogs.every((c) => !c.id.includes("onair")))
  })

  it("renders the configuration page for a config without On Air catalogs", async () => {
    assert.equal((await server.get("/externalStreams=true/configure")).status, 200)
  })

  it("renders the configuration page with every source", async () => {
    const resp = await server.get("/configure")
    assert.equal(resp.status, 200)
    const html = await resp.text()
    for (const src of SOURCES) assert.ok(html.includes(`id="${src.prefix}"`), `${src.prefix} toggle missing`)
  })

  //When every site is unreachable the addon must still answer, with empty results
  const emptyAnswers = [
    ["/stream/series/tt13706018:1:1.json", "streams"],
    ["/stream/series/kitsu:11538:4.json", "streams"],
    ["/stream/series/latanime:spy-x-family-latino:1.json", "streams"],
    ["/stream/series/unknown:1:1.json", "streams"],
    ["/meta/series/jkanime:spy-x-family.json", "meta"],
    ["/catalog/LatAnime/latanime/search=spy%20x%20family.json", "metas"],
    ["/catalog/JKAnime/jkanime%7Conair.json", "metas"],
    ["/catalog/AnimeFLV/animeflv/search=naruto.json", "metas"], //disabled source, still requested by old installs
    ["/stream/series/animeflv:naruto:1.json", "streams"],
    ["/meta/series/unknown:x.json", "meta"],
    ["/catalog/series/calendar-videos/calendarVideosIds=kitsu:11538,mal:32093.json", "metasDetailed"],
  ]
  for (const [route, key] of emptyAnswers) {
    it(`answers ${route} without the network`, async () => {
      const resp = await server.get(route)
      assert.equal(resp.status, 200)
      const body = await resp.json()
      assert.ok(key in body, `missing "${key}" in ${JSON.stringify(body)}`)
    })
  }

  it("never crashes on those requests", async () => {
    await new Promise((r) => setTimeout(r, 500)) //let rejected promises surface in the log
    const bad = server.output().split("\n").filter((l) => /Unhandled|TypeError|ReferenceError|SyntaxError/.test(l))
    assert.deepEqual(bad, [])
    assert.equal((await server.get("/manifest.json")).status, 200, "server died")
  })
})
