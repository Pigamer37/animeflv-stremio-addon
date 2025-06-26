const ANIMEFLV_API_BASE = "https://animeflv.ahmedrangel.com/api"
const ANIMEFLV_BASE = "https://www3.animeflv.net/anime"

exports.SearchByTitle = async function (query) {
  const reqURL = `${ANIMEFLV_API_BASE}/search?query=${query}`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data?.data?.media === undefined) throw Error("Invalid response!")
    //return first result
    return {
      title: data.data.media[0].title, type: (data.data.media[0].type === "Anime") ? "series" : "movie",
      slug: data.data.media[0].slug, poster: data.data.media[0].cover, overview: data.data.media[0].synopsis
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
    //return externalStreams
    const downloadStreams = data.data.servers.filter((src) => (src.download !== undefined && src.name === "Stape")/* || (src.embed !== undefined && src.name === "YourUpload")*/)
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
      } /*else if (source.name === "YourUpload") {
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
      }*/
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value).concat(externalStreams)
    )
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