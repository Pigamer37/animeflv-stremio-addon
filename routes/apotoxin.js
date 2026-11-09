const APOTOXIN_API_BASE = "https://intranet.apotoxinfansub.com/api/v3"
const CINEMETA_BASE = "https://v3-cinemeta.strem.io"

const streamParser = require("../lib/streamParsing.js");
require('dotenv').config()//process.env.var

//Apotoxin Fansub only subtitles Detective Conan, so it has no catalog or search: it adds streams to that show's episodes
exports.CONAN_IMDB_ID = "tt0131179"

/**
 * Apotoxin numbers episodes like the Japanese broadcast (absolute, as Kitsu/AniList do), Cinemeta splits them in seasons.
 * Counting the regular episodes of the previous seasons gives the same number (checked from episode 3 up to 1218)
 * @param {number} season
 * @param {number} episode
 * @return {Promise<number>} absolute episode number
 */
exports.GetAbsoluteEpisode = async function (season, episode) {
  const data = await fetch(`${CINEMETA_BASE}/meta/series/${exports.CONAN_IMDB_ID}.json`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  })
  if (data?.meta?.videos === undefined) throw Error("Invalid response!")
  return data.meta.videos.filter((v) => v.season > 0 && v.season < season).length + parseInt(episode)
}

exports.GetItemStreams = async function (epNumber, onlyInternal = true) {
  const data = await fetch(`${APOTOXIN_API_BASE}/capitulo/online/${epNumber}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  })
  if (!data?.capitulo) throw Error('Empty response!') //episodes they haven't subtitled answer {}
  const epName = `Detective Conan Ep. ${data.capitulo}`
  //the magnets play inside Stremio, the embeds go through the usual server handling
  const torrentStreams = [["FHD", data.magnet_FHD], ["HD", data.magnet_HD]].filter(([, magnet]) => magnet?.startsWith("magnet:")).map(([quality, magnet]) => {
    const params = new URLSearchParams(magnet.slice(magnet.indexOf("?") + 1))
    return {
      infoHash: params.get("xt").split(":").pop().toLowerCase(),
      sources: params.getAll("tr").map((tracker) => "tracker:" + tracker),
      name: "Apotoxin\n" + quality + " (torrent)",
      description: epName + "\n⚙️ " + params.get("dn") + "\n🇯🇵🇪🇸",
      behaviorHints: { bingeGroup: "apotoxin|" + quality }
    }
  })
  const servers = [data.enlace_online, data.enlace_online2].filter((embed) => /^https?:\/\//.test(embed || "")).map((embed) => {
    return { name: streamParser.getServerTitle(new URL(embed).hostname), embed }
  })
  return streamParser.GetStreamLinks("Apotoxin", "apotoxin", { data: { title: "Detective Conan", number: data.capitulo, servers } }, onlyInternal).then((streams) => torrentStreams.concat(streams))
}
