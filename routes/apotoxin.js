const APOTOXIN_API_BASE = "https://intranet.apotoxinfansub.com/api/v3"
const CINEMETA_BASE = "https://v3-cinemeta.strem.io"

const streamParser = require("../lib/streamParsing.js");
require('dotenv').config()//process.env.var

//Apotoxin Fansub only subtitles Detective Conan, so it has no catalog or search: it adds streams to that show's episodes
//and movies
const CONAN_IMDB_ID = "tt0131179"

/**
 * Apotoxin numbers episodes like the Japanese broadcast (absolute, as Kitsu/AniList do), Cinemeta splits them in seasons.
 * Counting the regular episodes of the previous seasons gives the same number (checked from episode 3 up to 1218)
 * @param {number} season
 * @param {number} episode
 * @return {Promise<number>} absolute episode number
 */
async function GetAbsoluteEpisode(season, episode) {
  const data = await fetch(`${CINEMETA_BASE}/meta/series/${CONAN_IMDB_ID}.json`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  })
  if (data?.meta?.videos === undefined) throw Error("Invalid response!")
  return data.meta.videos.filter((v) => v.season > 0 && v.season < season).length + parseInt(episode)
}

//Apotoxin numbers the movies in release order; IMDB lists each one apart. A new one comes out every April (none in 2020)
const MOVIE_IMDB_IDS = [
  "tt0131479", "tt0965649", "tt1067920", "tt1068773", "tt1073223", "tt0990372", "tt1133935", "tt1133559", "tt1133936", "tt0498536", //1-10 (1997-2006)
  "tt1146290", "tt1155696", "tt1343046", "tt1636815", "tt1840372", "tt2131586", "tt3303446", "tt3455204", "tt3737650", "tt4954660", //11-20 (2007-2016)
  "tt5692622", "tt7880466", "tt9501310", "tt12093860", "tt19770970", "tt27521477", "tt31474158", "tt35444710" //21-28 (2017-2025)
]

/**
 * Gets Apotoxin's streams for a Detective Conan episode or movie, empty for anything else
 * @param {string} imdbID - the item's IMDB ID (Kitsu/AniList items get theirs from the mappings)
 * @param {string} type - "series" or "movie"
 * @param {string} [season] - Cinemeta's season, undefined for Kitsu/AniList IDs, which already use absolute numbers
 * @param {string} [episode]
 * @param {boolean} [onlyInternal]
 * @return {Promise<Array>} streams
 */
exports.SearchApotoxin = async function (imdbID, type, season, episode, onlyInternal = true) {
  if (type === "movie") {
    const movieNumber = MOVIE_IMDB_IDS.indexOf(imdbID) + 1
    return (movieNumber) ? exports.GetMovieStreams(movieNumber, onlyInternal) : []
  }
  if (imdbID !== CONAN_IMDB_ID || parseInt(season) === 0) return [] //season 0 holds the specials, which Apotoxin numbers apart
  return exports.GetItemStreams((season) ? await GetAbsoluteEpisode(parseInt(season), episode) : episode, onlyInternal)
}

exports.GetItemStreams = async function (epNumber, onlyInternal = true) {
  const data = await fetch(`${APOTOXIN_API_BASE}/capitulo/online/${epNumber}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  })
  if (!data?.capitulo) throw Error('Empty response!') //episodes they haven't subtitled answer {}
  return FormatStreams("Detective Conan", data.capitulo, [["FHD", data.magnet_FHD], ["HD", data.magnet_HD]], [data.enlace_online, data.enlace_online2], onlyInternal)
}

exports.GetMovieStreams = async function (movieNumber, onlyInternal = true) {
  const data = await fetch(`${APOTOXIN_API_BASE}/pelicula/${movieNumber}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  })
  if (!data?.numero) throw Error('Empty response!')
  //the "online" list has the magnets too, but with HD and FHD swapped in some movies: the download list labels them right
  const magnets = (data.enlaces || []).filter((e) => e.tipo_enlace?.startsWith("torrent_magnet_")).map((e) => [e.tipo_enlace.split("_").pop().toUpperCase(), e.url])
  const embeds = (data.enlaces_online || []).map((e) => e.url)
  return FormatStreams(`Detective Conan: ${data.titulo}`, undefined, magnets.sort(([a], [b]) => a.localeCompare(b)), embeds, onlyInternal)
}

//the magnets play inside Stremio, the embeds go through the usual server handling
function FormatStreams(title, number, magnets, embeds, onlyInternal) {
  const epName = (number !== undefined) ? `${title} Ep. ${number}` : title
  const torrentStreams = magnets.filter(([, magnet]) => magnet?.startsWith("magnet:")).map(([quality, magnet]) => {
    const params = new URL(magnet).searchParams
    const infoHash = params.get("xt").split(":").pop().toLowerCase()
    return {
      infoHash,
      sources: params.getAll("tr").map((tracker) => "tracker:" + tracker).concat("dht:" + infoHash),
      name: "Apotoxin\n" + quality + " (torrent)",
      description: epName + "\n⚙️ " + params.get("dn") + "\n🇯🇵🇪🇸",
      behaviorHints: { bingeGroup: "apotoxin|" + quality, filename: params.get("dn") || undefined }
    }
  })
  const servers = embeds.filter((embed) => /^https?:\/\//.test(embed || "")).map((embed) => {
    return { name: streamParser.getServerTitle(new URL(embed).hostname), embed }
  })
  return streamParser.GetStreamLinks("Apotoxin", "apotoxin", { data: { title, number, servers } }, onlyInternal).then((streams) => torrentStreams.concat(streams))
}
