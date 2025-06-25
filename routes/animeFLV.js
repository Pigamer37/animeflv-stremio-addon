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
    return externalStreams
    /*const downloadStreams = data.data.servers.filter((src) => src.download !== undefined).map((source) => {
      return {
        url: source.download,
        name: "AnimeFLV - " + source.name,
        title: epName + " via " + source.name + "\n" + source.download,
        behaviorHints: {
          bingeGroup: "animeFLV|" + source.name,
          filename: source.download,
          notWebReady: true
        }
      }
    })
    return downloadStreams.concat(externalStreams)*/
  })
}