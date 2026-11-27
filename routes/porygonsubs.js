const PORYGON_BASE = "https://porygonsubs.com"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
require('dotenv').config()//process.env.var

const SERVER_NAMES = { fm: "Filemoon", voe: "Voe", kf: "Krakenfiles", mega: "Mega", mp4u: "MP4Upload", dood: "Doodstream", wish: "Streamwish" }
const DUB_LANGS = { lat: "lat", cas: "esp" }

//The site's pages are Livewire components: what they load after the page (search results, the full episode list, other
//servers) is asked to them with a POST that carries the page's session cookie, CSRF token and the component's snapshot
async function LoadPage(url) {
  const resp = await fetch(url)
  if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
  const $ = cheerio.load(await resp.text())
  return {
    $, snapshots: $("[wire\\:snapshot]").map((_, el) => $(el).attr("wire:snapshot")).get(),
    livewire: { uri: $("[data-update-uri]").attr("data-update-uri"), token: $("[data-csrf]").attr("data-csrf"), cookie: resp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), referer: url }
  }
}

async function CallLivewire(livewire, snapshot, method, params = [], updates = {}) {
  if (!livewire.uri || !livewire.token || !snapshot) throw Error("No Livewire component!")
  const body = JSON.stringify({ _token: livewire.token, components: [{ snapshot, updates, calls: [{ path: "", method, params }] }] })
  return fetch(livewire.uri, { method: "POST", body, headers: { "Content-Type": "application/json", "X-Livewire": "1", "Cookie": livewire.cookie, "Referer": livewire.referer } }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => ({ html: data.components[0].effects?.html, data: JSON.parse(data.components[0].snapshot).data }))
}

const snapshotOf = (snapshots, name) => snapshots.find((s) => JSON.parse(s).memo.name === name)

/**
 * Searches the site, which returns every match at once (the whole site, about a hundred entries, without filters). Its
 * text search only looks for the term inside the main title
 * @param {{q: string, gene: string, airing: boolean}} [filters] - gene is a genre's slug, as in the site's genre links
 * @return {Promise<{title: string, slug: string, type: string, category: string, poster: string, airing: boolean}[]>}
 * category is the site's (Anime, Película, Ova, Ona, Especial)
 */
async function SearchSeries({ q, gene, airing } = {}) {
  const url = new URL(`${PORYGON_BASE}/buscar`)
  if (q) url.searchParams.set("q", q)
  if (gene) url.searchParams.set("gene", gene)
  const page = await LoadPage(url.toString())
  const { html } = await CallLivewire(page.livewire, snapshotOf(page.snapshots, "frontend.buscar"), "loadAnimes", [], (airing) ? { selectedEstado: "1" } : {})
  const $ = cheerio.load(html || "")
  return $("a[href]").filter((_, a) => $(a).find("h4").length > 0).map((_, a) => {
    const el = $(a), category = el.find("span.top-2.right-2").text().trim()
    return {
      title: el.find("h4").text().trim(),
      slug: el.attr("href").match(/porygonsubs\.com\/([^/?#]+)$/)?.[1],
      type: (category === "Película") ? "movie" : "series", category,
      poster: el.find("img").attr("src"),
      airing: /EN EMISI[OÓ]N/i.test(el.text())
    }
  }).get().filter((item) => item.slug)
}

exports.AiringCacheFile = './onairPORYGON_titles.json'

exports.GetAiringAnimeFromWeb = async function () {
  return SearchSeries({ airing: true }).then((data) => {
    if (!data || data.length < 1) throw Error("Invalid response!")
    return data.map(({ title, type, slug, poster }) => ({ title, type, slug, poster }))
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
  }).then(() => console.log('\x1b[32mOn Air PorygonSubs titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

/**
 * For the catalogs: a text search or a genre's entries
 * @param {string} [query]
 * @param {string[]} [genreArr] - the first genre's slug is used
 * @param {number} [skip] - the site returns every result at once, so later pages are cut from the same list
 */
exports.SearchCatalog = async function (query = undefined, genreArr = undefined, skip = 0) {
  if (!query && !genreArr?.length) throw Error("No arguments passed to SearchCatalog()")
  return SearchSeries({ q: query, gene: genreArr?.[0] }).then((data) => data.slice(Number(skip) || 0).map((anime) => ({ ...anime, genres: genreArr })))
}

exports.GetAnimeBySlug = async function (slug) {
  const url = `${PORYGON_BASE}/${slug}`
  const page = await LoadPage(url)
  const $ = page.$
  const title = $("h1").first().text().trim()
  if (!title) throw Error("Invalid response!")
  //"<type> • <year> • <status>"
  const [type, year, status] = $("h1 ~ p.text-gray-400 > span").not(".text-zinc-600").map((_, el) => $(el).text().trim()).get()
  const isMovie = type === "Película"
  //the page shows the last 15 episodes, the rest are asked to its episode list
  const episodes = await CallLivewire(page.livewire, snapshotOf(page.snapshots, "anime.anime-capitulo"), "loadAll").then(({ html }) => cheerio.load(html || "")).catch(() => $)
  const videos = episodes("[data-episode]").map((_, el) => ({ number: Number(episodes(el).attr("data-episode")), thumbnail: episodes(el).find("img").attr("src") })).get()
    .filter((ep) => ep.number > 0).sort((a, b) => a.number - b.number).map(({ number, thumbnail }) => ({
      id: `porygonsubs:${slug}:${number}`,
      title: (isMovie) ? title : `${title} Ep. ${number}`,
      season: 1, episode: number, number, thumbnail, available: true
    }))
  //the page's component has each related entry's slug and relation; its title is in the entry's link
  const related = (JSON.parse(snapshotOf(page.snapshots, "frontend.anime") || "{}").data?.relacionados?.[0] || []).map(([r]) => ({
    name: $(`a[href$='/${r.serie}'][title]`).attr("title") || r.serie, category: r.relacion,
    url: `stremio:///detail/series/porygonsubs:${r.serie}`
  }))
  const altTitles = $("h1 + p.text-blue-400").text().split(",").map((t) => t.trim()).filter(Boolean)
  return {
    name: title, type: (isMovie) ? "movie" : "series",
    videos, poster: `${PORYGON_BASE}/image/imagen/260/380/${slug}.jpg`, background: $("meta[property='og:image']").attr("content"),
    genres: $("a[href^='/buscar?gene=']").map((_, a) => $(a).text().trim()).get(),
    description: $("h1").parent().find("p.leading-relaxed").first().text().trim(),
    website: url, id: `porygonsubs:${slug}`,
    ...(altTitles.length) && { alternative_titles: altTitles },
    ...(/^\d{4}$/.test(year)) && { releaseInfo: (status === "Finalizado" || isMovie) ? year : `${year}-` },
    links: [{ name: "PorygonSubs", category: "Open in", url }, { name: title, category: "share", url }, ...related],
    ...(videos.length == 1) && { behaviorHints: { defaultVideoId: videos[0].id } }
  }
}

//Words that only say which season it is ("Black Clover season 2", "Captain Tsubasa temporada 2 junior youth hen") or
//that it's a movie ("Takagi-san Movie" is "Takagi-san la Película" there; series and movies are listed apart)
const FILLER_WORDS = ["season", "temporada", "part", "parte", "movie", "pelicula", "gekijouban"]
const titleWords = (title) => title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\bla pelicula\b/g, "pelicula")
  .replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1").trim().split(/\s+/) //"2nd Season" is season 2
  .filter((w) => w && !FILLER_WORDS.includes(w)).map((w) => (/^\d+$/.test(w)) ? String(Number(w)) : w).sort()
const isYear = (word) => /^(19|20)\d\d$/.test(word)
//metadata providers don't always agree on a release year (Cinemeta has Digimon Adventure: as 2022, its dub's, not 2020)
const REMAKE_YEAR_DIFFERENCE = 3

/**
 * The site's search only finds titles containing the search term as written ("Black Clover 2" doesn't find "Black Clover
 * Season 2"), and a fuzzy match isn't safe: a longer title containing the search term would match ("Pokémon" would get
 * "Pokémon XY", "Black Clover" would get "Black Clover season 2"). So the whole list is matched here: an entry matches when
 * it has the same words as the search term, ignoring filler words and order, so its season number has to be the
 * requested one. The only extra word allowed is a year, which tells remakes apart ("Digimon Adventure 2020"): it must be
 * the item's own, and such an entry is preferred over the one without a year. Without the item's year, a title that has
 * remakes listed is ambiguous, so nothing matches
 * @param {string} searchTerm - with the season number appended when it's not the first, like the other sources' searches
 * @param {{title: string, slug: string}[]} items - from {@link SearchSeries}
 * @param {number} [year] - the requested item's release year
 * @return {(Object|undefined)} the matching item
 */
function MatchSeries(searchTerm, items, year = undefined) {
  const term = titleWords(searchTerm)
  const matches = items.map((item) => {
    const words = titleWords(item.title)
    const extraYear = words.find((w) => isYear(w) && !term.includes(w))
    return { item, extraYear, same: words.filter((w) => w !== extraYear).join(" ") === term.join(" ") }
  }).filter((m) => m.same)
  if (!year && matches.some((m) => m.extraYear)) return undefined
  return (matches.find((m) => m.extraYear && Math.abs(Number(m.extraYear) - year) <= REMAKE_YEAR_DIFFERENCE) || matches.find((m) => !m.extraYear))?.item
}

//Pokémon (and some Dragon Ball movies) are listed under their Spanish titles, which no search term matches, so they're
//matched by IMDB ID. Pokémon's main series is a single IMDB entry: its seasons (Cinemeta's, TVDB's) are the site's
//entries, except Diamond & Pearl's four, which are one there, and Master Quest's (5), which it doesn't have
const POKEMON_IMDB_ID = "tt0168366"
const DP = "pokemon-diamante-y-perla"
const POKEMON_SEASONS = Object.freeze({ //season: [slug, episodes of that entry in the previous seasons]
  1: ["pokemon-atrapalos-ya", 0], 2: ["pokemon-liga-naranja", 0], 3: ["pokemon-los-viajes-johto", 0], 4: ["pokemon-los-campeones-de-la-liga-johto", 0],
  6: ["pokemon-fuerza-maxima", 0], 7: ["pokemon-reto-maximo", 0], 8: ["pokemon-batalla-avanzada", 0], 9: ["pokemon-batalla-de-la-frontera", 0],
  10: [DP, 0], 11: [DP, 51], 12: [DP, 103], 13: [DP, 155], 14: ["pokemon-best-wishes", 0], 15: ["pokemon-best-wishes-2", 0],
  16: ["pokemon-xy", 0], 17: ["pokemon-xy-and-z", 0], 18: ["pokemon-sun-and-moon", 0], 19: ["pokemon-2019", 0], 20: ["horizontes-pokemon", 0]
})
const IMDB_SLUGS = Object.freeze({
  tt26692417: "horizontes-pokemon", tt29079338: "pokemon-mezase-pokemon-master", tt1294022: "pokemon-cronicas", tt3218680: "pocket-monsters-the-origin",
  tt6071336: "pokemon-generaciones", tt15356258: "pokemon-evoluciones", tt11547516: "pokemon-hakumei-no-tsubasa", tt19848562: "pokemon-nieves-de-hisui",
  tt21970564: "pocket-monsters-pokemon-especial-el-dios-arceus", tt3657074: "pokemon-xy-la-mega-evolucion-mas-fuerte", tt12471116: "poketoon",
  tt0190641: "pokemon-la-pelicula-mewtwo-contraataca", tt0210234: "pokemon-la-pelicula-2000-el-poder-de-uno", tt0235679: "pokemon-pelicula-3-el-hechizo-de-los-unown",
  tt0287635: "pokemon-por-siempre-celebi-la-voz-del-bosque", tt0347791: "heroes-pokemon-latios-y-latias", tt0420076: "pokemon-jirachi-y-los-deseos",
  tt0435286: "pokemon-el-destino-de-deoxys-audio-latino", tt0875609: "pokemon-lucario-y-el-misterio-de-mew-audio-latino", tt1000095: "pokemon-pokemon-ranger-y-el-templo-del-mar",
  tt1226251: "pokemon-el-surgimiento-de-darkrai", tt1160525: "pokemon-giratina-y-el-guerrero-celestial", tt1468843: "pokemon-arceus-y-la-joya-de-la-vida",
  tt1690470: "pokemon-zoroark-el-maestro-de-ilusiones", tt1739212: "pokemon-negro-victini-y-reshiram-pokemon-blanco-victini-y-zekrom",
  tt1961324: "pokemon-negro-victini-y-reshiram-pokemon-blanco-victini-y-zekrom", tt2549540: "pokemon-kyurem-contra-el-espadachin-mistico",
  tt8856470: "pokemon-mewtwo-contraataca-evolucion", tt11819890: "pokemon-koko",
  tt0142251: "dragon-ball-la-leyenda-de-shen-long", tt0142249: "dragon-ball-la-princesa-durmiente-del-castillo-embrujado",
  tt0142248: "dragon-ball-una-aventura-mistica", tt0142250: "dragon-ball-el-camino-hacia-el-poder"
})

/**
 * The PorygonSubs entry and episode an IMDB-mapped item is, see {@link IMDB_SLUGS}
 * @param {{imdbID: string, season: string, episode: string, idType: string, id: string}} item - season is undefined for
 * Kitsu/AniList/MAL/AniDB IDs, whose episode is their own entry's: ani.zip tells its TVDB (Cinemeta) season and episode
 * @return {Promise<{slug: string, episode: (number|undefined)}|undefined>} undefined when it's not mapped
 */
async function MapByIMDBID({ imdbID, season, episode, idType, id }) {
  if (IMDB_SLUGS[imdbID]) return { slug: IMDB_SLUGS[imdbID], episode }
  if (imdbID !== POKEMON_IMDB_ID) return undefined
  if (season === undefined && /^(kitsu|mal|anilist|anidb)$/.test(idType)) {
    const data = await fetch(`https://api.ani.zip/mappings?${idType}_id=${id}`).then((resp) => resp.json()) //cached, the IMDB ID came from it
    ;({ seasonNumber: season, episodeNumber: episode } = data?.episodes?.[episode ?? 1] || {})
  }
  const [slug, offset] = POKEMON_SEASONS[season] || []
  return (slug) ? { slug, episode: offset + parseInt(episode ?? 1) } : { slug: undefined } //a season it doesn't have
}

/**
 * Finds the series a search term (title, plus the season number when it's not the first) refers to, see {@link MatchSeries}.
 * Items with Spanish titles there are found by their IDs instead, see {@link MapByIMDBID}
 * @param {string} query
 * @param {string} [type] - "movie" or "series"
 * @param {number} [year] - the requested item's release year
 * @param {Object} [ids] - the requested item's IDs, see {@link MapByIMDBID}
 * @return {Promise<Object[]>} the matching series, if any, with the year {@link GetItemStreams} should check: a season's
 * entry can be years after the show's first air date, so it's only set for unnumbered titles. Mapped items also have
 * the site's episode number
 */
exports.SearchPorygonSubs = async function (query, type = undefined, year = undefined, ids = {}) {
  const mapped = await MapByIMDBID(ids)
  if (mapped) return (mapped.slug) ? [{ title: query, slug: mapped.slug, episode: mapped.episode }] : []
  //an OVA, ONA or special can be listed as a movie or as a series elsewhere
  const match = MatchSeries(query, (await SearchSeries()).filter((item) => !type || item.type === type || !["Anime", "Película"].includes(item.category)), year)
  return (match) ? [{ ...match, year: (/\s\d{1,2}$/.test(query)) ? undefined : year }] : []
}

//The site's release year is sometimes off by a few years (Death Note's says 2010), so this only tells apart a remake
//from the original it shares its name with (Shaman King 2001/2021, Ranma 1989/2024)
const MAX_YEAR_DIFFERENCE = 10

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1, year = undefined) {
  const { $, snapshots, livewire } = await LoadPage(`${PORYGON_BASE}/ver/${slug}-${epNumber ?? 1}`)
  const snapshot = snapshots.find((s) => s.includes('"embed"'))
  if (!snapshot) throw Error("No player in the page!")
  const data = JSON.parse(snapshot).data
  const pageYear = Number($("div.text-gray-500 > span").map((_, el) => $(el).text().trim()).get().find(isYear))
  if (year && pageYear && Math.abs(pageYear - year) > MAX_YEAR_DIFFERENCE) throw Error(`It's the ${pageYear} one, not the ${year} one!`)
  //every server button has its language (btn-sub/btn-lat/btn-cas) and server slug; the page only carries the first one's embed
  const buttons = $("[data-position^='btn-'][wire\\:click^='selecServer']").map((_, el) => {
    const [, idioma, server] = $(el).attr("wire:click").match(/idioma: (\d+), slug: '(\w+)'/) || []
    return { lang: $(el).attr("data-position").split("-")[1], idioma: Number(idioma), server }
  }).get().filter((b) => b.server)
  if (buttons.length < 1) throw Error("No servers!")
  const wanted = buttons.filter((b, i) => i === 0 || !onlyInternal || b.server === "mp4u") //external servers are only listed when asked for
  const servers = await Promise.allSettled(wanted.map((b, i) => ((i === 0) ? Promise.resolve(data.embed) : CallLivewire(livewire, snapshot, "selecServer", [{ idioma: b.idioma, slug: b.server }]).then((r) => r.data.embed)).then((embed) => {
    if (!/^https?:\/\//.test(embed || "")) throw Error("No embed!")
    return { name: SERVER_NAMES[b.server] || streamParser.getServerTitle(new URL(embed).hostname), embed, dub: b.lang !== "sub", dubLang: DUB_LANGS[b.lang] }
  }))).then((results) => results.filter((r) => r.value).map((r) => r.value))
  return streamParser.GetStreamLinks("PorygonSubs", "porygonsubs", { data: { title: data.titleaux?.replace(/\s+cap[ií]tulo\s+\d+.*$/i, "") || slug.replace(/-+/g, " "), number: epNumber, servers } }, onlyInternal)
}

