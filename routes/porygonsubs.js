const PORYGON_BASE = "https://porygonsubs.com"

const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
require('dotenv').config()//process.env.var

//PorygonSubs has no catalog or search of its own here: its streams are added to the items opened from other catalogs.
//Its search is a Livewire component (that only looks at the main title), but the sitemap lists every series and episode,
//so it's matched against that
const SERVER_NAMES = { fm: "Filemoon", voe: "Voe", kf: "Krakenfiles", mega: "Mega", mp4u: "MP4Upload", dood: "Doodstream", wish: "Streamwish" }
const DUB_LANGS = { lat: "lat", cas: "esp" }

/**
 * Lists every PorygonSubs series from its sitemap
 * @param {string} [type] - "movie" or "series", single-episode entries are taken as movies
 * @return {Promise<{title: string, slug: string, type: string}[]>}
 */
exports.GetSeriesList = async function (type = undefined) {
  const xml = await fetch(`${PORYGON_BASE}/sitemap.xml`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.text()
  })
  const paths = [...xml.matchAll(/<loc>https:\/\/porygonsubs\.com\/([^<]+)<\/loc>/g)].map((m) => m[1])
  const episodes = paths.filter((p) => p.startsWith("ver/"))
  return paths.filter((p) => !p.startsWith("ver/") && !p.includes("/")).map((slug) => {
    const count = episodes.filter((p) => new RegExp(`^ver/${slug}-\\d+$`).test(p)).length
    return { title: slug.replace(/-+/g, " "), slug, type: (count > 1) ? "series" : "movie" }
  }).filter((item) => !type || item.type === type)
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
 * Without a site search narrowing the list down, a fuzzy match isn't safe: a longer title containing the search term
 * would match ("Pokémon" would get "Pokémon XY", "Black Clover" would get "Black Clover season 2"). An entry matches when
 * it has the same words as the search term, ignoring filler words and order, so its season number has to be the
 * requested one. The only extra word allowed is a year, which tells remakes apart ("Digimon Adventure 2020"): it must be
 * the item's own, and such an entry is preferred over the one without a year. Without the item's year, a title that has
 * remakes listed is ambiguous, so nothing matches
 * @param {string} searchTerm - with the season number appended when it's not the first, like the other sources' searches
 * @param {{title: string, slug: string}[]} items - from {@link GetSeriesList}
 * @param {number} [year] - the requested item's release year
 * @return {(Object|undefined)} the matching item
 */
exports.MatchSeries = function (searchTerm, items, year = undefined) {
  const term = titleWords(searchTerm)
  const matches = items.map((item) => {
    const words = titleWords(item.title)
    const extraYear = words.find((w) => isYear(w) && !term.includes(w))
    return { item, extraYear, same: words.filter((w) => w !== extraYear).join(" ") === term.join(" ") }
  }).filter((m) => m.same)
  if (!year && matches.some((m) => m.extraYear)) return undefined
  return (matches.find((m) => m.extraYear && Math.abs(Number(m.extraYear) - year) <= REMAKE_YEAR_DIFFERENCE) || matches.find((m) => !m.extraYear))?.item
}

//The site's release year is sometimes off by a few years (Death Note's says 2010), so this only tells apart a remake
//from the original it shares its name with (Shaman King 2001/2021, Ranma 1989/2024)
const MAX_YEAR_DIFFERENCE = 10

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1, year = undefined) {
  const url = `${PORYGON_BASE}/ver/${slug}-${epNumber ?? 1}`
  const resp = await fetch(url)
  if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
  const html = await resp.text()
  const $ = cheerio.load(html)
  const snapshot = $("[wire\\:snapshot]").map((_, el) => $(el).attr("wire:snapshot")).get().find((s) => s.includes('"embed"'))
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
  //the others are asked to its Livewire component, which only answers with this page's session cookie and CSRF token
  const livewire = {
    uri: $("[data-update-uri]").attr("data-update-uri"),
    token: $("[data-csrf]").attr("data-csrf"),
    cookie: resp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "),
    snapshot, referer: url
  }
  const wanted = buttons.filter((b, i) => i === 0 || !onlyInternal || b.server === "mp4u") //external servers are only listed when asked for
  const servers = await Promise.allSettled(wanted.map((b, i) => ((i === 0) ? Promise.resolve(data.embed) : GetServerEmbed(livewire, b)).then((embed) => {
    if (!/^https?:\/\//.test(embed || "")) throw Error("No embed!")
    return { name: SERVER_NAMES[b.server] || streamParser.getServerTitle(new URL(embed).hostname), embed, dub: b.lang !== "sub", dubLang: DUB_LANGS[b.lang] }
  }))).then((results) => results.filter((r) => r.value).map((r) => r.value))
  return streamParser.GetStreamLinks("PorygonSubs", "porygonsubs", { data: { title: data.titleaux?.replace(/\s+cap[ií]tulo\s+\d+.*$/i, "") || slug.replace(/-+/g, " "), number: epNumber, servers } }, onlyInternal)
}

async function GetServerEmbed(livewire, button) {
  if (!livewire.uri || !livewire.token) throw Error("No Livewire endpoint!")
  const body = JSON.stringify({ _token: livewire.token, components: [{ snapshot: livewire.snapshot, updates: {}, calls: [{ path: "", method: "selecServer", params: [{ idioma: button.idioma, slug: button.server }] }] }] })
  return fetch(livewire.uri, { method: "POST", body, headers: { "Content-Type": "application/json", "X-Livewire": "1", "Cookie": livewire.cookie, "Referer": livewire.referer } }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => JSON.parse(data.components[0].snapshot).data.embed)
}

