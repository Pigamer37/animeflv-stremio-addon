const PORYGON_BASE = "https://porygonsubs.com"

const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
require('dotenv').config()//process.env.var

//PorygonSubs has no catalog or search of its own here: its streams are added to the items opened from other catalogs.
//Its search is a Livewire component, but the sitemap lists every series and episode, so it's matched against that
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

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1) {
  const url = `${PORYGON_BASE}/ver/${slug}-${epNumber ?? 1}`
  const resp = await fetch(url)
  if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
  const html = await resp.text()
  const $ = cheerio.load(html)
  const snapshot = $("[wire\\:snapshot]").map((_, el) => $(el).attr("wire:snapshot")).get().find((s) => s.includes('"embed"'))
  if (!snapshot) throw Error("No player in the page!")
  const data = JSON.parse(snapshot).data
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
  return streamParser.GetStreamLinks("PorygonSubs", "porygonsubs", { data: { title: data.title || slug.replace(/-+/g, " "), number: epNumber, servers } }, onlyInternal)
}

async function GetServerEmbed(livewire, button) {
  if (!livewire.uri || !livewire.token) throw Error("No Livewire endpoint!")
  const body = JSON.stringify({ _token: livewire.token, components: [{ snapshot: livewire.snapshot, updates: {}, calls: [{ path: "", method: "selecServer", params: [{ idioma: button.idioma, slug: button.server }] }] }] })
  return fetch(livewire.uri, { method: "POST", body, headers: { "Content-Type": "application/json", "X-Livewire": "1", "Cookie": livewire.cookie, "Referer": livewire.referer } }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => JSON.parse(data.components[0].snapshot).data.embed)
}

