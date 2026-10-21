//The Express app with the network disabled: routing and manifest, no site involved.
const { describe, it, before, after } = require("node:test")
const assert = require("node:assert/strict")
const { startServer } = require("./helpers/server.js")
const { SOURCES } = require("./helpers/sources.js")
const ENABLED = SOURCES.filter((src) => src.enabled !== false)

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
    for (const src of ENABLED) {
      assert.ok(manifest.idPrefixes.includes(`${src.prefix}:`), `${src.prefix}: missing from idPrefixes`)
      assert.ok(manifest.catalogs.some((c) => c.id === src.prefix), `${src.prefix} search catalog missing`)
    }
  })

  it("only adds the On Air catalogs chosen in the config", async () => {
    const manifest = await (await server.get("/onAirCatalogs=tioanime,henaojara/manifest.json")).json()
    assert.deepEqual(manifest.catalogs.filter((c) => c.id.includes("onair")).map((c) => c.id).sort(), ["henaojara|onair", "tioanime|onair"])
  })

  it("renders the configuration page with every source", async () => {
    const resp = await server.get("/configure")
    assert.equal(resp.status, 200)
    const html = await resp.text()
    for (const src of ENABLED) assert.ok(html.includes(`id="${src.prefix}"`), `${src.prefix} toggle missing`)
  })

  //When every site is unreachable the addon must still answer, with empty results
  for (const [route, key] of [["/stream/series/tt13706018:1:1.json", "streams"], ["/stream/series/tioanime:spy-x-family:1.json", "streams"],
    ["/meta/series/tioanime:spy-x-family.json", "meta"], ["/catalog/TioAnime/tioanime/search=naruto.json", "metas"]]) {
    it(`answers ${route} without the network`, async () => {
      const resp = await server.get(route)
      assert.equal(resp.status, 200)
      assert.ok(key in await resp.json())
    })
  }
})
