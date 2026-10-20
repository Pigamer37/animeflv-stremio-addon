//Every request the addon makes goes through here once index.js calls Install(). Without it, opening one episode
//cost ~28 requests to the sites, repeated in full for every user and every retry, which gets us rate limited (429).
// - shared cache: a page asked again (by anyone) within its TTL (see CacheTTL) is not downloaded again
// - concurrent identical requests share one download
// - at most MAX_PER_HOST requests at once per site: bursts wait their turn instead of tripping rate limits
// - one retry on HTTP 429 when the site asks for a short wait (Retry-After); for a long one, that site isn't asked
//   again until the wait is over, since knocking meanwhile only extends the block and makes users wait for nothing
// - a browser User-Agent instead of Node's default one, which flags us as a bot
const MINUTE = 60 * 1000
//Episode pages (their servers) and video hosts rarely change once published. Everything else (series pages with their
//episode list, searches, listings) expires soon, so a new episode shows up within minutes of being uploaded
const EPISODE_PAGE = /\/ver\/|-episodio-\d+|animeav1\.com\/media\/[^/]+\/\d+|jkanime\.net\/[^/]+\/\d+|mp4upload|yourupload/i
exports.CacheTTL = (url) => (EPISODE_PAGE.test(url)) ? 60 * MINUTE : 10 * MINUTE

//What Stremio clients may keep (Cache-Control). Metas list the episodes, so they must refresh soon after one airs; an
//empty answer (e.g. an episode the sites haven't uploaded yet) must not stick for a day
exports.CLIENT_CACHE = {
  meta: "max-age=600, stale-while-revalidate=600, stale-if-error=259200",
  catalog: "max-age=3600, stale-while-revalidate=3600, stale-if-error=259200",
  streams: "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200",
  failure: "max-age=300, stale-if-error=259200",
}

const DEFAULTS = { ttl: exports.CacheTTL, maxEntries: 300, maxPerHost: 2, maxRetryWait: 5000, now: Date.now }
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
}

exports.CreateFetch = function (baseFetch, options = {}) {
  const { ttl, maxEntries, maxPerHost, maxRetryWait, now } = { ...DEFAULTS, ...options }
  const cache = new Map(), inFlight = new Map(), hosts = new Map(), pausedUntil = new Map()

  //per-host semaphore
  const limited = async (host, fn) => {
    const slot = hosts.get(host) || { running: 0, queue: [] }
    hosts.set(host, slot)
    if (slot.running >= maxPerHost) await new Promise((resolve) => slot.queue.push(resolve))
    slot.running++
    try { return await fn() } finally {
      slot.running--
      slot.queue.shift()?.()
    }
  }

  const request = async (url, init) => {
    const headers = new Headers(init?.headers)
    for (const [k, v] of Object.entries(BROWSER_HEADERS)) if (!headers.has(k)) headers.set(k, v)
    const host = new URL(url).host
    if (now() < (pausedUntil.get(host) || 0)) return new Response("", { status: 429, headers: { "x-paused-until": String(pausedUntil.get(host)) } })
    let resp = await limited(host, () => baseFetch(url, { ...init, headers }))
    const retryAfter = resp.headers.get("retry-after")
    const wait = (retryAfter === null) ? NaN : Number(retryAfter) * 1000
    if (resp.status === 429 && wait >= 0 && wait <= maxRetryWait) {
      await new Promise((r) => setTimeout(r, wait))
      resp = await limited(host, () => baseFetch(url, { ...init, headers }))
    } else if (resp.status === 429 && wait > maxRetryWait) {
      pausedUntil.set(host, now() + wait)
      console.error(`\x1b[31m${host} rate limited us, pausing requests to it for ${Math.round(wait / 1000)}s\x1b[39m`)
    }
    return resp
  }

  const toResponse = (entry) => new Response(entry.body, { status: entry.status, headers: entry.headers })

  return async function fetch(input, init) {
    const url = String(input instanceof Request ? input.url : input)
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase()
    //the POSTs we make are read-only queries (AniList's GraphQL, Henaojara's server list): same body, same answer
    if (method !== "GET" && typeof (init?.body ?? "") !== "string") return request(url, init)
    const key = (method === "GET") ? url : `${method} ${url} ${init?.body ?? ""}`

    const hit = cache.get(key)
    if (hit && now() - hit.time < ((typeof ttl === "function") ? ttl(url) : ttl)) return toResponse(hit)
    if (!inFlight.has(key)) {
      inFlight.set(key, request(url, init).then(async (resp) => {
        const entry = { status: resp.status, headers: [...resp.headers], body: await resp.text(), time: now() }
        if (resp.status === 200 || resp.status === 404) { //rate limits, blocks and server errors are retried next time
          cache.delete(key)
          cache.set(key, entry)
          if (cache.size > maxEntries) cache.delete(cache.keys().next().value) //drop the oldest
        }
        return entry
      }).finally(() => inFlight.delete(key)))
    }
    return toResponse(await inFlight.get(key))
  }
}

exports.Install = function (options) {
  globalThis.fetch = exports.CreateFetch(globalThis.fetch, options)
}
