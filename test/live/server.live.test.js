//End to end against the real sites and metadata APIs: what a Stremio user gets.
const { describe, it, before, after } = require("node:test")
const assert = require("node:assert/strict")
const { startServer } = require("../helpers/server.js")
const { blockedInCI } = require("../helpers/sources.js")

describe("server (live)", { timeout: 180000 }, () => {
  let server
  before(async () => { server = await startServer() })
  after(() => server?.stop())

  const streamsFor = async (route) => (await (await server.get(route)).json()).streams

  it("finds streams for a Cinemeta episode", async () => {
    assert.ok((await streamsFor("/stream/series/tt13706018:1:1.json")).length > 0) //Spy x Family
  })
  it("finds streams when Cinemeta only gives the English title (issue #41)", async () => {
    assert.ok((await streamsFor("/stream/series/tt5531604:1:4.json")).length > 0) //Tanaka-kun Is Always Listless
  })
  it("finds streams for a Kitsu episode", async () => {
    assert.ok((await streamsFor("/stream/series/kitsu:11538:4.json")).length > 0)
  })
  it("merges LatAnime's Latino and Castellano versions", async (t) => {
    if (await blockedInCI("https://latanime.org/buscar?q=naruto")) return t.skip("LatAnime blocks this runner's IP (HTTP 403)")
    const lat = (await streamsFor("/externalStreams=true/stream/series/tt13706018:1:1.json")).filter((s) => s.name.startsWith("LatAnime"))
    assert.ok(lat.some((s) => s.name.includes("🇲🇽")), "no Latino stream")
    assert.ok(lat.some((s) => s.name.includes("🇪🇸")), "no Castellano stream")
  })
  it("resolves AniList/MAL metadata to a source with streams", async () => {
    for (const id of ["anilist:21495", "mal:32093"]) {
      const { meta } = await (await server.get(`/meta/series/${id}.json`)).json()
      assert.ok(meta.videos?.length >= 12, `${id}: ${JSON.stringify(meta).slice(0, 200)}`)
      const [prefix] = meta.videos[0].id.split(":")
      assert.ok(["animeav1", "jkanime", "tioanime"].includes(prefix), `${id} resolved to ${prefix}`)
    }
  })
  it("fills a search catalog", async () => {
    const { metas } = await (await server.get("/catalog/AnimeAV1/animeav1/search=naruto.json")).json()
    assert.ok(metas.length > 0)
  })
})
