//Adapted from https://github.com/ChristopherProject/Streamtape-Video-Downloader
exports.GetStreamTapeLink = function (url) {
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

exports.GetYourUploadLink = function (url) {
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
        return vidMatch[1]
      } else console.log("No video link")
    } else console.log("No video")
  })
}

exports.GetHLSLink = function (url) {
  if (url.includes("/play/") || url.includes("/m3u8/")) {
    return Promise.resolve(url.replace("/play/", "/m3u8/"))
  } else { console.log("No video link"); Promise.reject("No video link") }
}

exports.GetPDrainLink = function (url) {
  const metaPattern = /(.+?:\/\/.+?)\/.+?\/(.+?)(?:\?embed)?$/g
  const metaMatch = metaPattern.exec(url)
  if (metaMatch && metaMatch[0]) {
    return Promise.resolve(`${metaMatch[1]}/api/file/${metaMatch[2]}`)
  } else { console.log("No video link"); Promise.reject("No video link") }
}

exports.GetMP4UploadLink = function (url) {
  return fetch(url).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  }).then((data) => {
    const metaPattern = /<script(?:.|\n)+?src:(?:.|\n)*?"(.+?\.mp4)"/g
    const metaMatch = metaPattern.exec(data)
    if (metaMatch && metaMatch[0]) {
      return metaMatch[1]
    } else console.log("No video link")
  })
}
