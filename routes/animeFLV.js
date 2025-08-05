const ANIMEFLV_API_BASE = "https://animeflv.ahmedrangel.com/api"
const ANIMEFLV_BASE = "https://www3.animeflv.net/anime"

const fsPromises = require("fs/promises");

exports.GetAiringAnimeFromWeb = async function () {
  const reqURL = `${ANIMEFLV_API_BASE}/list/animes-on-air`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    const promises = data.data.map((entry) => {
      return this.GetAnimeBySlug(entry.slug).then((anime) => {
        return {
          title: anime.name, type: (anime.type === "Anime" || anime.type === "series") ? "series" : "movie",
          slug: entry.slug, poster: anime.poster, overview: anime.description
        }
      })
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value)
    )
  })
}

exports.GetAiringAnime = async function () {
  return fsPromises.readFile('./onair_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to onair_titles.json`)
    return fsPromises.writeFile('./onair_titles.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimeFLV = async function (query, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimeFLV()")
  const animeFLVURL = (url) ? url
    : `https%3A%2F%2Fwww3.animeflv.net%2Fbrowse%3F${(query) ? "q%3D" + query + "%26" : ""}${(genreArr) ? "genre%5B%5D%3D" + genreArr.join("%26genre%5B%5D%3D") : ""}${(page) ? "%26page%3D" + page : ""}`
  const reqURL = `${ANIMEFLV_API_BASE}/search/by-url?url=${animeFLVURL}`
  console.log("\x1b[36mSearching:\x1b[39m", reqURL)
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.data?.media === undefined) throw Error("Invalid response!")
    return data.data.media.slice(gottenItems).map((anime) => {
      return {
        title: anime.title, type: (anime.type === "Anime" || anime.type === "series") ? "series" : "movie",
        slug: anime.slug, poster: anime.cover, overview: anime.synopsis, genres: genreArr
      }
    })
  })
}

exports.GetAnimeBySlug = async function (slug) {
  const reqURL = `${ANIMEFLV_API_BASE}/anime/${slug}`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    //return first result
    const epCount = data.data.episodes.length
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      const imgPattern = /\/(\d+).jpg$/g
      const matches = imgPattern.exec(data.data.cover)
      return {
        id: `animeflv:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: `https://www3.animeflv.net/uploads/animes/thumbs/${matches[1]}.jpg`,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "Anime") ? "series" : "movie",
      videos, poster: data.data.cover, genres: data.data.genres, description: data.data.synopsis, website: data.data.url, id: `animeflv:${slug}`,
      language: "jpn"
    }
  })
}

exports.GetItemStreams = async function (slug, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how animeFLV works
  const reqURL = `${ANIMEFLV_API_BASE}/anime/${slug}/episode/${epNumber}`;
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.data?.servers === undefined) throw Error("Invalid response!")
    let epName = data.data.title
    const externalStreams = data.data.servers.filter((src) => src.embed !== undefined).map((source) => {
      return {
        externalUrl: source.embed,
        name: "AnimeFLV - " + source.name + " (external)",
        title: epName + " via " + source.name + "\n(opens in " + source.name + " in your browser)\n" + source.embed,
        behaviorHints: {
          bingeGroup: "animeFLV|" + source.name,
          filename: source.embed
        }
      }
    })
    return externalStreams
    /*const downloadStreams = data.data.servers.filter((src) => (src.download !== undefined && src.name === "Stape") || (src.embed !== undefined && src.name === "YourUpload"))
    const promises = downloadStreams.map((source) => {
      if (source.name === "Stape") {
        return GetStreamTapeLink(source.download).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeFLV - " + source.name,
            title: epName + " via " + source.name + "\n" + realURL,
            behaviorHints: {
              bingeGroup: "animeFLV|" + source.name,
              filename: realURL,
              notWebReady: true
            }
          }
        }).catch((err) => {
          console.log("Failed getting StreamTape link:", err)
          return undefined
        })
      } else if (source.name === "YourUpload") {
        return GetYourUploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeFLV - " + source.name,
            title: epName + " via " + source.name + "\n" + realURL,
            behaviorHints: {
              bingeGroup: "animeFLV|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                }
              }
            }
          }
        }).catch((err) => {
          console.log("Failed getting YourUpload link:", err)
          return undefined
        })
      }
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value).concat(externalStreams)
    )*/
  })
}
//Adapted from https://github.com/ChristopherProject/Streamtape-Video-Downloader
function GetStreamTapeLink(url) {
  const reqURL = url.replace("/e/", "/v/")
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  }).then((data) => {
    const noRobotLinkPattern = /document\.getElementById\('norobotlink'\)\.innerHTML = (.+?);/g
    const matches = noRobotLinkPattern.exec(data)
    if (matches[1]) {
      const tokenPattern = /token=([^&']+)/g
      const tokenMatches = tokenPattern.exec(matches[1])
      if (tokenMatches[1]) {
        const STPattern = /id\s*=\s*"ideoooolink"/g
        const tagEnd = data.indexOf(">", STPattern.exec(data).index) + 1
        const streamtape = data.substring(tagEnd, data.indexOf("<", tagEnd))
        return `https:/${streamtape}&token=${tokenMatches[1]}&dl=1s`
      } else console.log("No token")
    } else console.log("No norobotlink")
  })
}

function GetYourUploadLink(url) {
  //const reqURL = url.replace("/embed/", "/watch/")
  return fetch(url).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  }).then((data) => {
    const metaPattern = /property\s*=\s*"og:video"/g
    const metaMatch = metaPattern.exec(data)
    if (metaMatch[0]) {
      const vidPattern = /content\s*=\s*"(\S+)"/g
      const vidMatch = vidPattern.exec(data.substring(metaMatch.index))
      if (vidMatch[1]) {
        console.log(vidMatch[1])
        return vidMatch[1]
      } else console.log("No video link")
    } else console.log("No video")
  })
}