const LATANIME_BASE = "https://latanime.org"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
const { CollectPages } = require("../lib/pagination.js");
require('dotenv').config()//process.env.var

/**
 * Latanime lists each dub as its own entry, with the language (or nothing, for subs) at the end of the title,
 * seasons as "S2" or a bare "2", and sometimes a tag (e.g. "Shingeki no Kyojin S2 Latino", "Shingeki no Kyojin 2
 * Castellano", "Dr. Stone: Stone Wars Latino S2", "Dandadan CR Latino"). Parsing search terms the same way lets us
 * compare entries by base title and season.
 * @param {string} title
 * @return {{key: string, base: string, dubLang: (string|undefined)}} key is "<normalized base title>|<season>"
 */
exports.ParseTitle = function (title) {
  let dubLang, season, base = title.trim(), prev
  do { //the suffixes come in any order
    prev = base
    base = base.replace(/\s+(latino|castellano|catal[aá]n)$/i, (_, lang) => {
      dubLang = { latino: "lat", castellano: "esp" }[lang.toLowerCase()] || "cat"
      return ""
    }).replace(/\s+(\d{3,4}p|cr|hd)$/i, "")
    if (season === undefined) base = base.replace(/\s+(?:s|season\s*|temporada\s*)?(\d{1,2})$/i, (_, n) => { season = Number(n); return "" })
  } while (base !== prev)
  return { key: base.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "") + "|" + (season || 1), base, dubLang }
}

exports.AiringCacheFile = './onair_titlesLAT.json'

exports.GetAiringAnimeFromWeb = async function () {
  //the listing already has title, type and poster; opening every series page was slow and dropped the ones that failed
  return GetOnAir().then((data) => {
    if (!data || data.length < 1) throw Error("Invalid response!")
    return data
  })
}

exports.GetAiringAnime = async function () {
  return fsPromises.readFile(exports.AiringCacheFile).then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile(exports.AiringCacheFile, JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air Latanime titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchLatanime = async function (query, type = undefined, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchLatanime()")
  if (query && page > 1) return [] //text searches return every match at once; asking again only repeats page 1
  let latanimeURL
  if (url) latanimeURL = new URL(url)
  else if (query) {
    latanimeURL = new URL(`${LATANIME_BASE}/buscar`)
    latanimeURL.searchParams.set('q', query)
  } else {
    latanimeURL = new URL(`${LATANIME_BASE}/animes`)
    latanimeURL.searchParams.set('genero', genreArr[0])
    if (page) latanimeURL.searchParams.set('p', page)
  }
  return SearchAnimesBySpecificURL(latanimeURL.toString()).then((data) => {
    if (!data || data.length < 1) throw Error("No search results!")
    return data.filter((anime) => !type || anime.type === type).slice(gottenItems).map((anime) => ({ ...anime, genres: genreArr }))
  })
}

exports.GetAnimeBySlug = async function (slug) {
  const html = await fetch(`${LATANIME_BASE}/anime/${slug}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.text()
  })
  const $ = cheerio.load(html)
  const title = $("h2").first().text().trim()
  if (!title) throw Error("Invalid response!")
  const epNumbers = [...new Set($("a[href*='/ver/']").map((_, a) => Number($(a).attr("href").match(/-episodio-(\d+)$/)?.[1])).get().filter((n) => n > 0))].sort((a, b) => a - b)
  const poster = $("meta[property='og:image']").attr("content")
  //an airing series with its first episode out also has a single episode, so that alone doesn't make a movie
  const finished = /\bFinalizado\b/.test($("body").clone().find("nav, header, footer").remove().end().text())
  const isMovie = /pel[ií]cula|\bmovie\b|\bfilm\b/i.test(`${title} ${slug}`) || (epNumbers.length <= 1 && finished)
  const d = new Date(Date.now())
  const videos = epNumbers.map((n, i) => ({
    id: `latanime:${slug}:${n}`,
    title: (isMovie) ? title : `${title} Ep. ${n}`,
    season: 1, episode: n, number: n,
    thumbnail: poster,
    released: new Date(new Date(d).setDate(d.getDate() - (epNumbers.length - 1 - i))), //estimated: the site gives no dates
    available: true
  }))
  const url = `${LATANIME_BASE}/anime/${slug}`
  return {
    name: title, type: (isMovie) ? "movie" : "series",
    videos, poster, background: poster,
    genres: $("a[href*='/genero/']").map((_, a) => $(a).text().trim()).get(),
    description: $("p").map((_, p) => $(p).text().trim()).get().find((t) => t.length > 60),
    website: url, id: `latanime:${slug}`,
    language: ({ lat: "spa", esp: "spa", cat: "cat" })[exports.ParseTitle(title).dubLang] || "jpn",
    links: [{ name: "Latanime", category: "Open in", url }, { name: title, category: "share", url }],
    ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `latanime:${slug}:${epNumbers[0]}` } }
  }
}

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1, title = undefined) {
  return GetEpisodeLinks(slug, epNumber || 1, title).then((data) => {
    if (!data) throw Error('Empty response!')
    return streamParser.GetStreamLinks("Latanime", "latanime", { data }, onlyInternal)
  })
}

async function GetEpisodeLinks(slug, epNumber, title) {
  const html = await fetch(`${LATANIME_BASE}/ver/${slug}-episodio-${epNumber}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.text()
  }).catch(() => null)
  if (!html) return null
  const $ = cheerio.load(html)
  //the episode heading is "<title> - <episode>"; the title carries the dub language
  title = title || $("h2").first().text().trim().replace(/\s+-\s+\d+$/, "") || slug.replace(/-/g, " ")
  const dubLang = exports.ParseTitle(title).dubLang
  const servers = $("a.play-video[data-player]").map((_, el) => {
    const embed = atob($(el).attr("data-player")).trim().replace("mega.nz/embed#!", "mega.nz/embed/")
    if (!/^https?:\/\//.test(embed)) return null //some entries are bare file names, not players
    return { name: streamParser.getServerTitle(new URL(embed).hostname.replace(/^www\./, "")), embed, dub: dubLang !== undefined, dubLang }
  }).get()
  return { title: title.replace(/\s+(latino|castellano|catal[aá]n)(?=(\s+s?\d{1,2})?$)/i, ""), number: epNumber, servers }
}

async function SearchAnimesBySpecificURL(latanimeURL) {
  const html = await fetch(latanimeURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.text()
  })
  const $ = cheerio.load(html)
  return $("a[href*='/anime/']").filter((_, a) => $(a).find("h3").length > 0).map((_, a) => {
    const el = $(a)
    const title = el.find("h3").first().text().trim()
    const label = el.find("span.opacity-75").first().text().trim()
    return {
      title,
      slug: el.attr("href").match(/\/anime\/([^/?#]+)/)?.[1],
      type: (/pel[ií]cula/i.test(label)) ? "movie" : "series",
      poster: el.find("img").attr("data-src") || el.find("img").attr("src"),
      ...exports.ParseTitle(title)
    }
  }).get()
}

async function GetOnAir() {
  return CollectPages((page) => SearchAnimesBySpecificURL(`${LATANIME_BASE}/emision?p=${page}`)).then((data) =>
    data.map(({ title, type, slug, poster }) => ({ title, type, slug, poster }))
  )
}
