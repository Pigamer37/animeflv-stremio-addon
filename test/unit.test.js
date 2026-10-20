//Pure helpers: no network, no fixtures.
const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const { ParseTitle } = require("../routes/latanime.js")
const { getServerTitle } = require("../lib/streamParsing.js")
const matching = require("../lib/matching.js")

describe("LatAnime ParseTitle", () => {
  const same = (a, b) => ParseTitle(a).key === ParseTitle(b).key
  it("ignores the dub language and an explicit season 1", () => {
    assert.ok(same("Shingeki no Kyojin S1 Latino", "Shingeki no Kyojin"))
    assert.ok(same("Shingeki no Kyojin Castellano", "Shingeki no Kyojin"))
    assert.ok(same("One piece Latino", "ONE PIECE"))
  })
  it("reads seasons written as S2 or a bare 2", () => {
    assert.ok(same("Shingeki no Kyojin S2 Latino", "Shingeki no Kyojin 2"))
    assert.ok(same("Shingeki no Kyojin 2 Castellano", "Shingeki no Kyojin 2"))
    assert.ok(same("SPY x FAMILY S3 Castellano", "Spy x Family 3"))
    assert.ok(!same("Shingeki no Kyojin S2 Latino", "Shingeki no Kyojin"))
  })
  it("doesn't confuse other entries of the same franchise", () => {
    assert.ok(!same("Shingeki no Kyojin: The Final Season Latino", "Shingeki no Kyojin"))
    assert.ok(!same("Spy × Family CÓDIGO: Blanco Latino", "Spy x Family"))
  })
  it("keeps numbers that are part of the title", () => {
    assert.ok(same("Kaiju No. 8", "Kaiju No. 8"))
    assert.ok(same("Mob Psycho 100 III Castellano", "Mob Psycho 100 III"))
  })
  it("detects the dub language", () => {
    assert.equal(ParseTitle("One piece Latino").dubLang, "lat")
    assert.equal(ParseTitle("Spy x Family Castellano").dubLang, "esp")
    assert.equal(ParseTitle("One Piece Film: Red Catalán").dubLang, "cat")
    assert.equal(ParseTitle("Dragon Ball Super: Beerus").dubLang, undefined)
  })
})

describe("getServerTitle", () => {
  it("maps embed hosts to the names stream extraction expects", () => {
    assert.equal(getServerTitle("yourupload.com"), "YourUpload")
    assert.equal(getServerTitle("mp4upload.com"), "MP4Upload")
    assert.equal(getServerTitle("doodstream.com"), "Doodstream")
    assert.equal(getServerTitle("dood.la"), "Doodstream")
    assert.equal(getServerTitle("www.yourupload.com"), "YourUpload") //Henaojara passes the raw hostname
    assert.equal(getServerTitle("www.mp4upload.com"), "MP4Upload")
  })
})

describe("title matching for Cinemeta/Kitsu lookups", () => {
  it("searches the romaji title first and appends seasons after the first", () => {
    assert.deepEqual(matching.BuildSearchTerms("Tanaka-kun wa Itsumo Kedaruge", "Tanaka-kun Is Always Listless", "1"), ["Tanaka-kun wa Itsumo Kedaruge", "Tanaka-kun Is Always Listless"])
    assert.deepEqual(matching.BuildSearchTerms("SPY×FAMILY", "Spy x Family", "2"), ["SPY×FAMILY 2", "Spy x Family 2"])
    assert.deepEqual(matching.BuildSearchTerms(undefined, "A Day in the Life of Tanaka-kun", "0"), ["A Day in the Life of Tanaka-kun"])
    assert.deepEqual(matching.BuildSearchTerms("One Piece", "One Piece", undefined), ["One Piece"])
  })
  it("recognizes specials in English and Spanish (issue #55)", () => {
    for (const t of ["Tanaka-kun wa Itsumo Kedaruge Specials", "One Piece Especiales", "One Piece - Wano Especial", "Shingeki no Kyojin OVA's Latino"]) assert.ok(matching.IsSpecial(t), t)
    for (const t of ["Tanaka-kun wa Itsumo Kedaruge", "Spy x Family"]) assert.ok(!matching.IsSpecial(t), t)
  })
  it("keeps only entries that can be the requested season (Henaojara lists each season separately)", () => {
    assert.ok(matching.SameSeason("Spy x Family", "1"))
    assert.ok(matching.SameSeason("Spy x Family 1080p", undefined))
    assert.ok(matching.SameSeason("Spy x Family Season 2", "2"))
    assert.ok(!matching.SameSeason("Spy x Family Season 2", "1"))
    assert.ok(!matching.SameSeason("Spy x Family Part 2", undefined))
    assert.ok(!matching.SameSeason("Shingeki no Kyojin 3 Parte 2 Castellano", "3"))
    assert.ok(matching.SameSeason("Shingeki no Kyojin Temporada 3", "3"))
  })
  it("tries each search term until one succeeds", async () => {
    const tried = []
    const result = await matching.FirstMatch(["romaji", "english"], async (t) => { tried.push(t); if (t === "romaji") throw Error("no match"); return t })
    assert.equal(result, "english")
    assert.deepEqual(tried, ["romaji", "english"])
    await assert.rejects(matching.FirstMatch([], async () => "never"))
  })
})

describe("AnimeAV1 ServerList", () => {
  const { ServerList } = require("../routes/animeav1.js")
  const page = `embeds:{DUB:[{server:"HLS",url:"a"}],SUB:[{server:"HLS",url:"b"}]},downloads:{SUB:[{server:"Mega",url:"c"}]}`
  it("reads each block's languages", () => {
    assert.equal(ServerList(page, "embeds", "DUB"), `[{server:"HLS",url:"a"}]`)
    assert.equal(ServerList(page, "embeds", "SUB"), `[{server:"HLS",url:"b"}]`)
    assert.equal(ServerList(page, "downloads", "SUB"), `[{server:"Mega",url:"c"}]`)
    assert.equal(ServerList(page, "downloads", "DUB"), undefined)
  })
  it("doesn't take dubbed downloads as dubbed embeds", () => {
    const subOnlyEmbeds = `embeds:{SUB:[{server:"HLS",url:"b"}]},downloads:{DUB:[{server:"Mega",url:"d"}]}`
    assert.equal(ServerList(subOnlyEmbeds, "embeds", "DUB"), undefined)
    assert.equal(ServerList(subOnlyEmbeds, "downloads", "DUB"), `[{server:"Mega",url:"d"}]`)
  })
})

describe("FindNativeMeta (metas for AniList/MAL/AniDB IDs)", () => {
  const source = (name, titles) => ({ name, search: async () => titles.map((title) => ({ title, slug: `${name}:${title}` })), meta: async (slug) => ({ id: slug }) })
  it("uses the first source that has the show", async () => {
    const meta = await matching.FindNativeMeta(["Tanaka-kun wa Itsumo Kedaruge"], [source("a", ["Naruto"]), source("b", ["Tanaka-kun wa Itsumo Kedaruge"])])
    assert.equal(meta.id, "b:Tanaka-kun wa Itsumo Kedaruge")
  })
  it("tries every search term on a source", async () => {
    const meta = await matching.FindNativeMeta(["SPY×FAMILY", "Spy x Family"], [source("a", ["Spy x Family"])])
    assert.equal(meta.id, "a:Spy x Family")
  })
  it("skips specials unless a special is asked for", async () => {
    const titles = ["Tanaka-kun wa Itsumo Kedaruge Specials", "Tanaka-kun wa Itsumo Kedaruge"]
    assert.equal((await matching.FindNativeMeta(["Tanaka-kun wa Itsumo Kedaruge"], [source("a", titles)])).id, "a:Tanaka-kun wa Itsumo Kedaruge")
    assert.equal((await matching.FindNativeMeta(["Tanaka-kun wa Itsumo Kedaruge Specials"], [source("a", titles)])).id, "a:Tanaka-kun wa Itsumo Kedaruge Specials")
  })
  it("fails when no source has it", async () => {
    await assert.rejects(matching.FindNativeMeta(["Nothing like this"], [source("a", ["Naruto"])]))
  })
})

describe("CollectPages (On Air catalogs)", () => {
  const { CollectPages } = require("../lib/pagination.js")
  const pages = { 1: ["a", "b"], 2: ["c"], 3: [] }
  const getPage = async (n) => (pages[n] || []).map((slug) => ({ slug }))
  it("reads pages until an empty one", async () => {
    assert.deepEqual((await CollectPages(getPage)).map((i) => i.slug), ["a", "b", "c"])
  })
  it("stops when a site repeats its last page", async () => {
    let calls = 0
    const repeating = async (n) => { calls++; return [{ slug: n === 1 ? "a" : "b" }] }
    assert.deepEqual((await CollectPages(repeating, 5)).map((i) => i.slug), ["a", "b"])
    assert.equal(calls, 3)
  })
  it("keeps the pages read when a later one fails, but fails if the first does", async () => {
    const flaky = async (n) => { if (n === 2) throw Error("429"); return [{ slug: "a" }] }
    assert.deepEqual((await CollectPages(flaky)).map((i) => i.slug), ["a"])
    await assert.rejects(CollectPages(async () => { throw Error("down") }))
  })
  it("never reads more than maxPages", async () => {
    let n = 0
    await CollectPages(async () => [{ slug: String(n++) }], 3)
    assert.equal(n, 3)
  })
})

describe("SettleLimited (On Air metadata without getting rate limited)", () => {
  const { SettleLimited } = require("../lib/pagination.js")
  it("never runs more than `limit` calls at once and keeps the order", async () => {
    let running = 0, peak = 0
    const results = await SettleLimited([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      peak = Math.max(peak, ++running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      if (n === 4) throw Error("429")
      return n * 10
    })
    assert.equal(peak, 3)
    assert.deepEqual(results.map((r) => r.value ?? r.status), [10, 20, 30, "rejected", 50, 60, 70])
  })
  it("handles an empty list", async () => {
    assert.deepEqual(await SettleLimited([], 4, async () => 1), [])
  })
})

describe("GetStreamLinks episode names", () => {
  const { GetStreamLinks } = require("../lib/streamParsing.js")
  const linksFor = (number) => GetStreamLinks("JKAnime", "jkanime", { data: { title: "Show", number, servers: [{ name: "Voe", embed: "https://voe.sx/e/x" }] } }, false)
  it("names episode 0 (some shows start there)", async () => {
    assert.match((await linksFor(0))[0].description, /^Show Ep\. 0\n/)
  })
  it("omits the number when there isn't one", async () => {
    assert.match((await linksFor(undefined))[0].description, /^Show\n/)
    assert.match((await linksFor(NaN))[0].description, /^Show\n/)
  })
})
