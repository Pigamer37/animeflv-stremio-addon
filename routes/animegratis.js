const http = require("node:http")
const https = require("node:https")
const fsPromises = require("node:fs/promises")
const cheerio = require("cheerio")

const streamParser = require("../lib/streamParsing.js")
const { CreateFetch } = require("../lib/http.js")
const { CollectPages } = require("../lib/pagination.js")

const ANIMEGRATIS_BASE = "https://animegratis.net"
const animegratisFetch = CreateFetch(FetchWithLargeHeaders)

exports.AiringCacheFile = "./onairANIMEGRATIS_titles.json"

// AnimeGratis responses exceed Node's default header limit and make fetch fail with UND_ERR_HEADERS_OVERFLOW.
function FetchWithLargeHeaders(url, init = {}, redirects = 3) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const transport = (target.protocol === "https:") ? https : http
    const request = transport.request(target, {
      method: init.method || "GET",
      headers: Object.fromEntries(new Headers(init.headers)),
      maxHeaderSize: 128 * 1024,
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
        response.resume()
        return FetchWithLargeHeaders(new URL(response.headers.location, target).href, init, redirects - 1).then(resolve, reject)
      }

      const chunks = []
      let size = 0
      response.on("data", (chunk) => {
        size += chunk.length
        if (size > 5 * 1024 * 1024) request.destroy(Error("AnimeGratis page is too large"))
        else chunks.push(chunk)
      })
      response.on("end", () => {
        const headers = new Headers()
        for (const [name, value] of Object.entries(response.headers)) {
          for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(name, item)
        }
        resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers }))
      })
    })
    request.on("error", reject)
    request.setTimeout(20_000, () => request.destroy(Error("AnimeGratis request timed out")))
    if (init.body) request.write(init.body)
    request.end()
  })
}

async function FetchPage(url) {
  const response = await animegratisFetch(url)
  if (!response.ok) throw Error(`HTTP error! Status: ${response.status}`)
  return response.text()
}

function MapDirectoryAnime(anime) {
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

async function GetDirectoryPage(page, { query, type, genres, status } = {}) {
  const searchURL = new URL(`${ANIMEGRATIS_BASE}/api/animes/directory`)
  searchURL.searchParams.set("page", page)
  searchURL.searchParams.set("limit", "24")
  if (query) searchURL.searchParams.set("q", query)
  if (type) searchURL.searchParams.set("type", type)
  if (genres?.length) searchURL.searchParams.set("genre", genres.join(","))
  if (status) searchURL.searchParams.set("status", status)
  const response = await animegratisFetch(searchURL)
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

async function GetOnAir() {
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
  }).then(() => console.log("\x1b[32mOn Air AnimeGratis titles cached successfully!\x1b[39m")).catch((err) => {
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
  const image = (typeof schema.image === "string") ? schema.image : schema.image?.url
  const videos = episodeNumbers.map((number) => ({
    id: `animegratis:${slug}:${number}`,
    title: isMovie ? schema.name : `${schema.name} Ep. ${number}`,
    season: 1,
    episode: number,
    number,
    thumbnail: image,
    available: true,
  }))
  const website = `${ANIMEGRATIS_BASE}/anime/${slug}`
  const alternateTitles = Array.isArray(schema.alternateName) ? schema.alternateName : [schema.alternateName].filter(Boolean)
  const genres = Array.isArray(schema.genre) ? schema.genre : [schema.genre].filter(Boolean)
  const released = (schema.datePublished) ? new Date(schema.datePublished) : undefined

  return {
    id: `animegratis:${slug}`,
    name: schema.name,
    alternative_titles: alternateTitles,
    type: isMovie ? "movie" : "series",
    videos,
    poster: image,
    background: image,
    genres,
    description: schema.description,
    website,
    language: "jpn",
    links: [{ name: "AnimeGratis", category: "Open in", url: website }, { name: schema.name, category: "share", url: website }],
    ...(released && !Number.isNaN(released.getTime())) && { released, releaseInfo: String(released.getUTCFullYear()) },
    ...(videos.length === 1) && { behaviorHints: { defaultVideoId: videos[0].id } },
  }
}

exports.ParseEpisodePage = function (html, slug, epNumber) {
  const raw = html.match(/<script id="player-ui-data" type="application\/json">(.*?)<\/script>/s)?.[1]
  const sources = []

  if (raw) {
    const data = JSON.parse(raw)
    for (const [language, groups] of Object.entries(data.groups || {})) {
      for (const group of groups || []) {
        for (const player of group.players || []) {
          AddSource(sources, group.name, player.url, language)
        }
      }
    }
  } else {
    const $ = cheerio.load(html)
    $(".server-btn[data-url]").each((_, button) => {
      AddSource(sources, $(button).attr("data-server"), $(button).attr("data-url"), $(button).attr("data-lang-group") || "ja")
    })
  }
  if (!sources.length) throw Error("No AnimeGratis player data")

  return { title: slug.replace(/-/g, " "), number: Number(epNumber), servers: sources }
}

function AddSource(sources, name, embed, language) {
  if (!URL.canParse(embed)) return
  const serverName = streamParser.getServerTitle((!name || /^embed$/i.test(name))
    ? new URL(embed).hostname
    : name.toLowerCase())
  sources.push({
    name: serverName,
    embed,
    dub: language !== "ja",
    dubLang: language === "lat" ? "lat" : language === "cast" ? "esp" : undefined,
  })
}

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1) {
  const html = await FetchPage(`${ANIMEGRATIS_BASE}/anime/${slug}/episodio-${epNumber || 1}`)
  const data = exports.ParseEpisodePage(html, slug, epNumber || 1)
  return streamParser.GetStreamLinks("AnimeGratis", "animegratis", { data }, onlyInternal)
}
