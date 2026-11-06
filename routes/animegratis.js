const http = require("node:http")
const https = require("node:https")
const fsPromises = require("node:fs/promises")
const cheerio = require("cheerio")

const streamParser = require("../lib/streamParsing.js")
const { CollectPages } = require("../lib/pagination.js")

const ANIMEGRATIS_BASE = "https://animegratis.net"
const PAGE_TTL = 60 * 60 * 1000
const pageCache = new Map()

exports.AiringCacheFile = "./onairANIMEGRATIS_titles.json"

function FetchPage (url, redirects = 3) {
  const hit = pageCache.get(url)
  if (hit && Date.now() - hit.time < PAGE_TTL) return Promise.resolve(hit.body)

  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const transport = (target.protocol === "https:") ? https : http
    const request = transport.get(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      maxHeaderSize: 128 * 1024,
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
        response.resume()
        return FetchPage(new URL(response.headers.location, target).href, redirects - 1).then(resolve, reject)
      }
      if (response.statusCode !== 200) {
        response.resume()
        return reject(Error(`HTTP error! Status: ${response.statusCode}`))
      }

      const chunks = []
      let size = 0
      response.on("data", (chunk) => {
        size += chunk.length
        if (size > 5 * 1024 * 1024) request.destroy(Error("AnimeGratis page is too large"))
        else chunks.push(chunk)
      })
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8")
        pageCache.set(url, { body, time: Date.now() })
        if (pageCache.size > 100) pageCache.delete(pageCache.keys().next().value)
        resolve(body)
      })
    })
    request.on("error", reject)
    request.setTimeout(20_000, () => request.destroy(Error("AnimeGratis request timed out")))
  })
}

function MapDirectoryAnime (anime) {
  return {
    title: anime.t,
    slug: anime.sl,
    type: anime.isMovie || /\bmovie\b/i.test(anime.ty) ? "movie" : "series",
    poster: anime.im,
    overview: anime.sy,
    year: Number(anime.yr) || undefined,
    genres: anime.g?.map((genre) => genre.n || genre.s).filter(Boolean),
  }
}

async function GetDirectoryPage (page, { query, type, genres, status } = {}) {
  const searchURL = new URL(`${ANIMEGRATIS_BASE}/api/animes/directory`)
  searchURL.searchParams.set("page", page)
  searchURL.searchParams.set("limit", "24")
  if (query) searchURL.searchParams.set("q", query)
  if (type) searchURL.searchParams.set("type", type)
  if (genres?.length) searchURL.searchParams.set("genre", genres.join(","))
  if (status) searchURL.searchParams.set("status", status)
  const response = await fetch(searchURL)
  if (!response.ok) throw Error(`HTTP error! Status: ${response.status}`)
  const data = await response.json()
  if (page > (Number(data.totalPages) || 1)) return []
  return (data.animes || []).map(MapDirectoryAnime)
}

exports.SearchAnimeGratis = async function (query, type, genres, page, gottenItems = 0) {
  if (!query && !genres?.length) throw Error("No arguments passed to SearchAnimeGratis()")
  const filters = { query, type, genres }
  if (page) return (await GetDirectoryPage(page, filters)).slice(gottenItems)
  return CollectPages((currentPage) => GetDirectoryPage(currentPage, filters), 5)
}

async function GetOnAir () {
  return CollectPages((page) => GetDirectoryPage(page, { status: "En emisión" }))
}

exports.GetAiringAnimeFromWeb = async function () {
  const data = await GetOnAir()
  if (!data.length) throw Error("Invalid response!")
  return data
}

exports.GetAiringAnime = async function () {
  return fsPromises.readFile(exports.AiringCacheFile).then((data) => JSON.parse(data)).catch((err) => {
    console.error("\x1b[31mFailed reading AnimeGratis titles cache:\x1b[39m " + err)
    return exports.GetAiringAnimeFromWeb()
  })
}

exports.UpdateAiringAnimeFile = function () {
  return exports.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} AnimeGratis titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile(exports.AiringCacheFile, JSON.stringify(titles))
  }).then(() => console.log("\x1b[32mOn Air AnimeGratis titles cached successfully!\x1b[39m")
  ).catch((err) => {
    console.error("\x1b[31mFailed caching AnimeGratis titles:\x1b[39m " + err)
  })
}

exports.GetAnimeBySlug = async function (slug) {
  const html = await FetchPage(`${ANIMEGRATIS_BASE}/anime/${slug}`)
  const $ = cheerio.load(html)
  const schemas = []
  $("script[type='application/ld+json']").each((_, script) => {
    try {
      const parsed = JSON.parse($(script).text())
      schemas.push(...(Array.isArray(parsed) ? parsed : [parsed]))
    } catch (_err) { }
  })
  const schema = schemas.find((entry) => ["TVSeries", "Movie"].includes(entry?.["@type"]))
  if (!schema?.name) throw Error("Invalid AnimeGratis metadata")

  const isMovie = schema["@type"] === "Movie"
  const listedEpisodes = $("a[href*='/episodio-']").map((_, link) => Number($(link).attr("href").match(/\/episodio-(\d+)/)?.[1])).get().filter((number) => number > 0)
  const episodeCount = Number(schema.numberOfEpisodes) || 0
  const episodeNumbers = [...new Set([
    ...listedEpisodes,
    ...((episodeCount > 0) ? Array.from({ length: episodeCount }, (_, index) => index + 1) : []),
    ...(isMovie && listedEpisodes.length === 0 ? [1] : []),
  ])].sort((a, b) => a - b)
  const videos = episodeNumbers.map((number) => ({
    id: `animegratis:${slug}:${number}`,
    title: isMovie ? schema.name : `${schema.name} Ep. ${number}`,
    season: 1,
    episode: number,
    number,
    thumbnail: schema.image,
    available: true,
  }))
  const website = `${ANIMEGRATIS_BASE}/anime/${slug}`
  const alternateTitles = Array.isArray(schema.alternateName) ? schema.alternateName : [schema.alternateName].filter(Boolean)

  return {
    id: `animegratis:${slug}`,
    name: schema.name,
    alternative_titles: alternateTitles,
    type: isMovie ? "movie" : "series",
    videos,
    poster: schema.image,
    background: schema.image,
    genres: schema.genre,
    description: schema.description,
    website,
    language: "jpn",
    links: [{ name: "AnimeGratis", category: "Open in", url: website }, { name: schema.name, category: "share", url: website }],
    ...(schema.datePublished) && { released: new Date(schema.datePublished), releaseInfo: String(new Date(schema.datePublished).getUTCFullYear()) },
    ...(videos.length === 1) && { behaviorHints: { defaultVideoId: videos[0].id } },
  }
}

exports.ParseEpisodePage = function (html, slug, epNumber) {
  const raw = html.match(/<script id="player-ui-data" type="application\/json">(.*?)<\/script>/s)?.[1]
  const languageNames = { ja: "Sub", cast: "Castellano", lat: "Latino" }
  const sources = []

  if (raw) {
    const data = JSON.parse(raw)
    for (const [language, groups] of Object.entries(data.groups || {})) {
      for (const group of groups || []) {
        for (const player of group.players || []) {
          AddSource(sources, group.name, player.url, language, languageNames)
        }
      }
    }
  } else {
    const $ = cheerio.load(html)
    $(".server-btn[data-url]").each((_, button) => {
      AddSource(sources, $(button).attr("data-server"), $(button).attr("data-url"), $(button).attr("data-lang-group") || "ja", languageNames)
    })
  }
  if (!sources.length) throw Error("No AnimeGratis player data")

  const totals = sources.reduce((counts, source) => {
    const key = `${source.language}|${source.resolver}`
    counts.set(key, (counts.get(key) || 0) + 1)
    return counts
  }, new Map())
  const indexes = new Map()
  for (const source of sources) {
    const key = `${source.language}|${source.resolver}`
    const index = (indexes.get(key) || 0) + 1
    indexes.set(key, index)
    if (totals.get(key) > 1) source.name += ` #${index}`
  }

  return { title: slug.replace(/-/g, " "), number: Number(epNumber), servers: sources }
}

function AddSource (sources, name, embed, language, languageNames) {
  if (!URL.canParse(embed)) return
  const source = { name, embed }
  const normalizedName = name?.replace(/[^a-z0-9]/gi, "").toLowerCase()
  const resolver = streamParser.getResolverName?.(source) || ((normalizedName === "yourupload")
    ? "YourUpload"
    : (normalizedName === "mp4upload") ? "MP4Upload" : name)
  sources.push({
    name: resolver,
    resolver,
    embed,
    language: languageNames[language] || language.toUpperCase(),
    dub: language !== "ja",
    dubLang: language === "lat" ? "lat" : language === "cast" ? "esp" : undefined,
  })
}

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1) {
  const html = await FetchPage(`${ANIMEGRATIS_BASE}/anime/${slug}/episodio-${epNumber || 1}`)
  const data = exports.ParseEpisodePage(html, slug, epNumber || 1)
  return streamParser.GetStreamLinks("AnimeGratis", "animegratis", { data }, onlyInternal)
}
