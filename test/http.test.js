//lib/http.js: the cache, deduplication, per-site limit and retry that keep the sites from rate limiting us.
const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const { CreateFetch } = require("../lib/http.js")

//A fake site: counts calls, answers after `delay` ms, optionally with a status sequence
function fakeSite({ delay = 0, statuses = [], headers = {} } = {}) {
  const site = { calls: [], running: 0, peak: 0 }
  site.fetch = async (url, init) => {
    site.calls.push({ url, init })
    site.peak = Math.max(site.peak, ++site.running)
    await new Promise((r) => setTimeout(r, delay))
    site.running--
    const status = statuses.shift() ?? 200
    return new Response(`body of ${url}`, { status, headers: (status === 429) ? headers : {} })
  }
  return site
}

describe("lib/http.js", () => {
  it("downloads a page once and serves it again from the cache", async () => {
    const site = fakeSite()
    const fetch = CreateFetch(site.fetch)
    assert.equal(await (await fetch("https://a.com/x")).text(), "body of https://a.com/x")
    assert.equal(await (await fetch("https://a.com/x")).text(), "body of https://a.com/x")
    assert.equal(site.calls.length, 1)
  })

  it("downloads it again once the cache entry expires", async () => {
    let clock = 0
    const site = fakeSite()
    const fetch = CreateFetch(site.fetch, { ttl: 1000, now: () => clock })
    await fetch("https://a.com/x")
    clock = 999; await fetch("https://a.com/x")
    clock = 1001; await fetch("https://a.com/x")
    assert.equal(site.calls.length, 2)
  })

  it("shares one download between concurrent identical requests", async () => {
    const site = fakeSite({ delay: 20 })
    const fetch = CreateFetch(site.fetch)
    const bodies = await Promise.all([1, 2, 3, 4, 5].map(() => fetch("https://a.com/x").then((r) => r.text())))
    assert.equal(site.calls.length, 1)
    assert.ok(bodies.every((b) => b === "body of https://a.com/x"))
  })

  it("runs at most maxPerHost requests at once per site, but sites in parallel", async () => {
    const a = fakeSite({ delay: 10 }), b = fakeSite({ delay: 10 })
    const fetch = CreateFetch((url, init) => (url.includes("a.com") ? a : b).fetch(url, init), { maxPerHost: 2 })
    await Promise.all([1, 2, 3, 4, 5, 6].flatMap((n) => [fetch(`https://a.com/${n}`), fetch(`https://b.com/${n}`)]))
    assert.equal(a.peak, 2)
    assert.equal(b.peak, 2)
    assert.equal(a.calls.length + b.calls.length, 12)
  })

  it("retries once on 429 when the site asks for a short wait", async () => {
    const site = fakeSite({ statuses: [429, 200], headers: { "retry-after": "0" } })
    const resp = await CreateFetch(site.fetch)("https://a.com/x")
    assert.equal(resp.status, 200)
    assert.equal(site.calls.length, 2)
  })

  it("doesn't wait when the site asks for a long wait or says nothing", async () => {
    for (const headers of [{ "retry-after": "305" }, {}]) {
      const site = fakeSite({ statuses: [429, 200], headers })
      assert.equal((await CreateFetch(site.fetch)("https://a.com/x")).status, 429)
      assert.equal(site.calls.length, 1)
    }
  })

  it("stops asking a site that asked for a long wait until the wait is over", async () => {
    let clock = 0
    const site = fakeSite({ statuses: [429, 200], headers: { "retry-after": "300" } })
    const fetch = CreateFetch(site.fetch, { now: () => clock })
    assert.equal((await fetch("https://a.com/x")).status, 429)
    clock = 299 * 1000
    assert.equal((await fetch("https://a.com/y")).status, 429) //answered without asking the site
    assert.equal(site.calls.length, 1)
    const other = await fetch("https://b.com/z") //other sites are unaffected
    assert.equal(other.status, 200)
    clock = 301 * 1000
    assert.equal((await fetch("https://a.com/y")).status, 200)
    assert.equal(site.calls.filter((c) => c.url.includes("a.com")).length, 2)
  })

  it("doesn't cache rate limits, blocks or server errors", async () => {
    for (const status of [429, 403, 500]) {
      const site = fakeSite({ statuses: [status, 200] })
      const fetch = CreateFetch(site.fetch)
      assert.equal((await fetch("https://a.com/x")).status, status)
      assert.equal((await fetch("https://a.com/x")).status, 200)
      assert.equal(site.calls.length, 2, `status ${status}`)
    }
  })

  it("keeps a 404 only briefly: an episode page that 404s now may be uploaded in minutes", async () => {
    let clock = 0
    const site = fakeSite({ statuses: [404, 200] })
    const fetch = CreateFetch(site.fetch, { now: () => clock }) //default TTLs: episode pages are kept an hour
    await fetch("https://tioanime.com/ver/show-13")
    clock = 3 * 60 * 1000
    assert.equal((await fetch("https://tioanime.com/ver/show-13")).status, 200)
    assert.equal(site.calls.length, 2)
  })

  it("handles responses without a body (204)", async () => {
    const fetch = CreateFetch(async () => new Response(null, { status: 204 }))
    assert.equal((await fetch("https://a.com/x")).status, 204)
  })

  it("understands a Retry-After given as a date", async () => {
    let clock = Date.parse("2026-10-21T10:00:00Z")
    const site = fakeSite({ statuses: [429, 200], headers: { "retry-after": "Wed, 21 Oct 2026 10:05:00 GMT" } })
    const fetch = CreateFetch(site.fetch, { now: () => clock })
    await fetch("https://a.com/x")
    assert.equal((await fetch("https://a.com/y")).status, 429) //paused for 5 minutes
    assert.equal(site.calls.length, 1)
  })

  it("caches a 404, which is a stable answer", async () => {
    const site = fakeSite({ statuses: [404, 200] })
    const fetch = CreateFetch(site.fetch)
    await fetch("https://a.com/x")
    assert.equal((await fetch("https://a.com/x")).status, 404)
    assert.equal(site.calls.length, 1)
  })

  it("caches read-only POSTs per body (AniList, Henaojara's server list)", async () => {
    const site = fakeSite()
    const fetch = CreateFetch(site.fetch)
    await fetch("https://graphql.anilist.co", { method: "POST", body: '{"id":1}' })
    await fetch("https://graphql.anilist.co", { method: "POST", body: '{"id":1}' })
    await fetch("https://graphql.anilist.co", { method: "POST", body: '{"id":2}' })
    assert.equal(site.calls.length, 2)
  })

  it("doesn't cache POSTs with a non-text body", async () => {
    const site = fakeSite()
    const fetch = CreateFetch(site.fetch)
    const form = () => new URLSearchParams({ a: "1" })
    await fetch("https://a.com/form", { method: "POST", body: form() })
    await fetch("https://a.com/form", { method: "POST", body: form() })
    assert.equal(site.calls.length, 2)
  })

  it("sends a browser User-Agent unless the caller set one", async () => {
    const site = fakeSite()
    const fetch = CreateFetch(site.fetch)
    await fetch("https://a.com/default")
    await fetch("https://a.com/custom", { headers: { "User-Agent": "custom" } })
    assert.match(site.calls[0].init.headers.get("user-agent"), /Mozilla\/5\.0/)
    assert.equal(site.calls[1].init.headers.get("user-agent"), "custom")
  })

  it("keeps at most maxEntries pages, dropping the oldest", async () => {
    const site = fakeSite()
    const fetch = CreateFetch(site.fetch, { maxEntries: 2 })
    for (const p of ["1", "2", "3"]) await fetch(`https://a.com/${p}`)
    await fetch("https://a.com/3"); await fetch("https://a.com/2") //still cached
    await fetch("https://a.com/1") //evicted
    assert.equal(site.calls.length, 4)
  })
})

describe("cache lifetimes (new episodes show up within minutes)", () => {
  const { CacheTTL, CLIENT_CACHE } = require("../lib/http.js")
  const MIN = 60 * 1000
  it("keeps episode pages and video hosts for an hour", () => {
    for (const url of ["https://tioanime.com/ver/spy-x-family-1", "https://latanime.org/ver/spy-x-family-latino-episodio-3",
      "https://animeav1.com/media/spy-x-family/1", "https://jkanime.net/spy-x-family/2/", "https://www.mp4upload.com/embed-abc.html"]) {
      assert.equal(CacheTTL(url), 60 * MIN, url)
    }
  })
  it("refreshes series pages (episode lists), searches and listings every 10 minutes", () => {
    for (const url of ["https://animeav1.com/media/spy-x-family", "https://jkanime.net/spy-x-family/", "https://tioanime.com/anime/spy-x-family",
      "https://latanime.org/anime/spy-x-family-latino", "https://jkanime.net/buscar/naruto", "https://animeav1.com/catalogo?status=emision&page=2"]) {
      assert.equal(CacheTTL(url), 10 * MIN, url)
    }
  })
  it("lets Stremio keep metas briefly and empty answers only a few minutes", () => {
    const maxAge = (policy) => Number(policy.match(/max-age=(\d+)/)[1])
    assert.ok(maxAge(CLIENT_CACHE.meta) <= 600)
    assert.ok(maxAge(CLIENT_CACHE.failure) <= 300)
    assert.ok(maxAge(CLIENT_CACHE.streams) <= 3 * 3600)
  })
})
