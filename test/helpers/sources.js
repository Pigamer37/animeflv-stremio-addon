//One known title per active source. The same checks run offline (recorded HTML) and live (real sites).
const assert = require("node:assert/strict")

exports.SOURCES = [
  { name: "AnimeAV1", prefix: "animeav1", file: "../../routes/animeav1.js", search: "SearchAnimeAV1", query: "spy x family", slug: "spy-x-family", onAirPageSize: 20 },
  { name: "Henaojara", prefix: "henaojara", file: "../../routes/henaojara.js", search: "SearchHenaojara", query: "spy x family", slug: "spy-x-family", onAirPageSize: 24 },
  { name: "TioAnime", prefix: "tioanime", file: "../../routes/tioanime.js", search: "SearchTioAnime", query: "spy x family", slug: "spy-x-family" },
  { name: "JKAnime", prefix: "jkanime", file: "../../routes/jkanime.js", search: "SearchJKAnime", query: "spy x family", slug: "spy-x-family", onAirPageSize: 30 },
  { name: "LatAnime", prefix: "latanime", file: "../../routes/latanime.js", search: "SearchLatAnime", query: "spy x family", slug: "spy-x-family-latino", onAirPageSize: 30 },
]

exports.checkSearch = async function (src) {
  const results = await require(src.file)[src.search](src.query)
  assert.ok(results.length > 0, "search returned no results")
  for (const r of results) {
    assert.ok(r.title, `result without title: ${JSON.stringify(r)}`)
    assert.ok(r.slug, `result without slug: ${JSON.stringify(r)}`)
    assert.ok(["series", "movie"].includes(r.type), `unexpected type "${r.type}" for ${r.slug}`)
  }
  assert.ok(results.some((r) => r.slug === src.slug), `"${src.slug}" missing from search results`)
}

exports.checkMeta = async function (src) {
  const meta = await require(src.file).GetAnimeBySlug(src.slug)
  assert.ok(meta.name, "meta without name")
  assert.equal(meta.id, `${src.prefix}:${src.slug}`)
  assert.ok(meta.videos.length >= 12, `expected at least 12 episodes, got ${meta.videos.length}`)
  assert.ok(meta.videos.every((v) => v.id.startsWith(`${src.prefix}:${src.slug}:`)), "episode with a foreign id")
  assert.ok(meta.poster, "meta without poster")
}

exports.checkStreams = async function (src) {
  const streams = await require(src.file).GetItemStreams(src.slug, false, 1)
  assert.ok(streams.length > 0, "episode 1 returned no streams")
  for (const s of streams) {
    assert.ok(s.name?.startsWith(src.name), `stream not labelled as ${src.name}: ${s.name}`)
    assert.ok(s.url || s.externalUrl, `stream without url: ${s.name}`)
  }
}

//sites spread their airing shows over several pages; reading only the first one hid most of them
exports.checkOnAir = async function (src) {
  const onAir = await require(src.file).GetAiringAnimeFromWeb()
  assert.ok(onAir.length > src.onAirPageSize, `only ${onAir.length} airing shows, expected more than one page (${src.onAirPageSize})`)
  assert.equal(new Set(onAir.map((a) => a.slug)).size, onAir.length, "duplicated airing shows")
}
