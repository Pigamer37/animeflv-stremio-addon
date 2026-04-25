exports.GetStreamLinks = function (serviceName, serviceSlug, streamArray) {
  if (streamArray?.data?.servers === undefined) throw Error("Invalid response!")
  let epName = (streamArray.data.number) ? streamArray.data.title + " Ep. " + streamArray.data.number : streamArray.data.title
  const externalStreams = streamArray.data.servers.filter((src) => src.embed !== undefined).map((source) => {
    return {
      externalUrl: source.embed,
      name: serviceName + "\n" + source.name + "⇗\n(external)" + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
      title: epName + "\n⚙️ (opens " + source.name + " in your browser)\n🔗 " + source.embed + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
      behaviorHints: {
        bingeGroup: serviceSlug + "|" + source.name + "|ext",
        filename: source.embed
      }
    }
  })
  //return externalStreams
  const downloadStreams = streamArray.data.servers.filter((src) => /*(src.download !== undefined && src.name === "Stape") ||*/ (src.embed !== undefined && ["YourUpload", "MP4Upload"/*, "HLS", "PDrain"*/].includes(src.name)))
  const promises = downloadStreams.map((source) => {
    /*if (source.name === "Stape") {
      return this.GetStreamTapeLink(source.download).then((realURL) => {
        return {
          url: realURL,
          name: serviceName + " - " + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
          title: epName + " via " + source.name + "\n" + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
          behaviorHints: {
            bingeGroup: serviceSlug + "|" + source.name,
            filename: realURL,
            notWebReady: true
          }
        }
      }).catch((err) => {
        console.log("Failed getting StreamTape link:", err)
        return undefined
      })
    } else*/ if (source.name === "YourUpload") {
      return this.GetYourUploadLink(source.embed).then((realURL) => {
        return {
          url: realURL,
          name: serviceName + "\n" + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
          title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
          behaviorHints: {
            bingeGroup: serviceSlug + "|" + source.name,
            filename: realURL,
            notWebReady: true,
            proxyHeaders: {
              request: {
                "Referer": "https://yourupload.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
              },
              response: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
              }
            }
          }
        }
      }).catch((err) => {
        console.error("Failed getting YourUpload link:", err)
        return undefined
      })
    } else if (source.name === "MP4Upload") {
        return this.GetMP4UploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: serviceName + "\n" + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
            behaviorHints: {
              bingeGroup: serviceSlug + "|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://a4.mp4upload.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting MP4Upload link:", err)
          return undefined
        })
      } else if(source.name === "PDrain") {
        return this.GetPDrainLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: serviceName + "\n" + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
            behaviorHints: {
              bingeGroup: serviceSlug + "|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://pixeldrain.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                  "Content-Type": "video/mp4"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting PDrain link:", err)
          return undefined
        })
      } else if(source.name === "HLS") {
        return this.GetHLSLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: serviceName + "\n" + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
            behaviorHints: {
              bingeGroup: serviceSlug + "|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://player.zilla-networks.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                  "Content-Type": (realURL.includes("/m3u8/")) ? "application/vnd.apple.mpegurl" : "video/mp4"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting HLS link:", err)
          return undefined
        })
      }
  })

  return Promise.allSettled(promises).then((results) =>
    results.filter((prom) => (prom.value)).map((source) => source.value).concat(externalStreams)
  )
}

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
