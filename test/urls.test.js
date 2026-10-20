//The URLs scrapers request: titles with &, #, / or % must reach the site intact.
const { describe, it, afterEach } = require("node:test")
const assert = require("node:assert/strict")
const fixtures = require("./helpers/fetch-fixtures.js")

//Captures the first URL a call fetches, then aborts it
async function requestedURL(call) {
  let url
  globalThis.fetch = async (input) => { url = String(input); throw Error("captured") }
  await call().catch(() => {})
  return new URL(url)
}

const TITLES = ["Love & Lies #1", "Fate/Zero", "100% Pascal-sensei", "spy x family"]

describe("search URLs", () => {
  afterEach(fixtures.restore)

  for (const title of TITLES) {
    it(`keeps "${title}" intact`, async () => {
      assert.equal((await requestedURL(() => require("../routes/animeav1.js").SearchAnimeAV1(title))).searchParams.get("search"), title)
      assert.equal((await requestedURL(() => require("../routes/henaojara.js").SearchHenaojara(title))).searchParams.get("buscar"), title)
      assert.equal((await requestedURL(() => require("../routes/tioanime.js").SearchTioAnime(title))).searchParams.get("q"), title)
      assert.equal((await requestedURL(() => require("../routes/latanime.js").SearchLatAnime(title))).searchParams.get("q"), title)
      const jk = await requestedURL(() => require("../routes/jkanime.js").SearchJKAnime(title))
      assert.equal(jk.pathname.split("/").length, 3, `"${title}" split the JKAnime path: ${jk.pathname}`)
      assert.equal(decodeURIComponent(jk.pathname.replace("/buscar/", "")), title)
    })
  }

  it("filters Henaojara by genre", async () => {
    assert.equal((await requestedURL(() => require("../routes/henaojara.js").SearchHenaojara(undefined, ["accion"]))).searchParams.get("genero"), "accion")
  })
})
