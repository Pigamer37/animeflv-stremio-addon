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
  const downloadStreams = streamArray.data.servers.filter((src) => /*(src.download !== undefined && src.name === "Stape") ||*/(src.embed !== undefined && ["YourUpload", "MP4Upload"/*, "HLS", "PDrain"*/].includes(src.name)))
  const promises = downloadStreams.map((source) => {
    /*if (source.name === "Stape") {
      return GetStreamTapeLink(source.download).then((realURL) => {
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
      return GetYourUploadLink(source.embed).then((realURL) => {
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
      return GetMP4UploadLink(source.embed).then((realURL) => {
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
    } else if (source.name === "Streamwish") {
      return GetStreamwishLink(source.embed).then((realURL) => {
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
    } else if (source.name === "PDrain") {
      return GetPDrainLink(source.embed).then((realURL) => {
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
              }
            }
          }
        }
      }).catch((err) => {
        console.error("Failed getting PDrain link:", err)
        return undefined
      })
    } else if (source.name === "HLS") {
      return GetHLSLink(source.embed).then((realURL) => {
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

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "*/*",
};

const HTML_HEADERS = {
  "User-Agent": DEFAULT_HEADERS["User-Agent"],
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

function fetchPromise(url, headers = undefined) {
  return fetch(url, headers).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function normalizeExtractedUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/%3A/gi, ":")
    .replace(/%2F/gi, "/")
    .replace(/%3F/gi, "?")
    .replace(/%3D/gi, "=")
    .trim();
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function findFirstUrl(payload, patterns) {
  if (!payload || typeof payload !== "string") {
    return null;
  }

  for (const pattern of patterns) {
    try {
      const match = payload.match(pattern);
      if (match && match[1]) {
        const candidate = normalizeExtractedUrl(match[1]);
        if (candidate) {
          return candidate;
        }
      }
    } catch (_e) {
      // Skip invalid patterns silently
    }
  }
  return null;
}

//Adapted from https://github.com/ChristopherProject/Streamtape-Video-Downloader
GetStreamTapeLink = function (url) {
  const reqURL = url.replace("/e/", "/v/")
  return fetchPromise(reqURL).then((data) => {
    const matches = /document\.getElementById\('norobotlink'\)\.innerHTML = (.+?);/g.exec(data)
    if (matches[1]) {
      const tokenMatches = /token=([^&']+)/g.exec(matches[1])
      if (tokenMatches[1]) {
        const STPattern = /id\s*=\s*"ideoooolink"/g
        const tagEnd = data.indexOf(">", STPattern.exec(data).index) + 1
        const streamtape = data.substring(tagEnd, data.indexOf("<", tagEnd))
        return `https:/${streamtape}&token=${tokenMatches[1]}&dl=1s`
      } else console.log("No token")
    } else console.log("No norobotlink")
  })
}

GetYourUploadLink = function (url) {
  return fetchPromise(url).then((data) => {
    const metaMatch = /property\s*=\s*"og:video"/g.exec(data)
    if (metaMatch[0]) {
      const vidMatch = /content\s*=\s*"(\S+)"/g.exec(data.substring(metaMatch.index))
      if (vidMatch[1]) {
        return vidMatch[1]
      } else console.log("No video link")
    } else console.log("No video")
  })
}

GetHLSLink = function (url) {
  if (url.includes("/play/") || url.includes("/m3u8/")) {
    return Promise.resolve(url.replace("/play/", "/m3u8/"))
  } else { console.log("No video link"); return Promise.reject("No video link") }
}

GetPDrainLink = function (url) {
  const metaMatch = /(.+?:\/\/.+?)\/.+?\/(.+?)(?:\?embed)?$/g.exec(url)
  if (metaMatch && metaMatch[0]) {
    return Promise.resolve(`${metaMatch[1]}/api/file/${metaMatch[2]}`)
  } else { console.log("No video link"); return Promise.reject("No video link") }
}

GetMP4UploadLink = function (url) {
  return fetchPromise(url).then((data) => {
    const metaMatch = /<script(?:.|\n)+?src:(?:.|\n)*?"(.+?\.mp4)"/g.exec(data)
    if (metaMatch && metaMatch[0]) {
      return metaMatch[1]
    } else console.log("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetOkruLink = function (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /"metadata"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/i,
      /flashvars\s*=\s*\{[^}]*src\s*:\s*"([^"]+)"/i,
      /videoUrl\s*=\s*"([^"]+)"/i,
    ])
    return link ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetVidhideLink = function (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*(?:file|src)\s*:\s*["'](https?:\/\/[^"']+)["']/i,
      /"file"\s*:\s*"([^"]+)"/i,
      /"source"\s*:\s*"([^"]+)"/i,
      /file\s*:\s*'([^']+)'/i,
      /setup\([^)]*file[^)]*\)/i,
    ])
    return link ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetFilemoonLink = function (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
      /file\s*:\s*"([^"]+)"/i,
    ])
    return link ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetHqqLink = function (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*file\s*:\s*["'](https?:\/\/[^"']+)["']/i,
      /file\s*:\s*"([^"]+\.mp4[^"]*)"/i,
      /video(?:\d+)?\s*=\s*["']([^"']+\.mp4[^"']+)["']/i,
    ])
    return link ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetFembedLink = function (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
      /file["']?\s*:\s*["']([^"']+)["']/i,
      /video\s*=\s*["']([^"']+\.mp4[^"']*)["']/i,
    ])
    return link ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetStreamwishLink = function (url) {
  return fetchPromise(url).then((data) => {
    // First try to find .m3u8 URL (HLS stream)
    const m3u8Match = data.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
    if (m3u8Match && m3u8Match[1]) {
      const candidate = m3u8Match[1];
      if (!candidate.startsWith("blob:")) {
        return candidate;
      }
    }
    const link = findFirstUrl(data, [
      /(https?:[^\s"']+\.m3u8[^\s"']*)/i,
      /file\s*:\s*["'](https?:[^\s"']+)["']/i,
      /sources\s*:\s*\[\s*\{[^}]*file\s*:\s*["'](https?:[^\s"']+)["']/i,
      /"file"\s*:\s*"([^"]+)"/i,
      /sources\s*:\s*\[([^\]]+)\]/i,
      /player\.config\s*=\s*\{[^}]*file\s*:\s*["']([^"']+)["']/i,
      /player\.setup\(\{[^}]*file\s*:\s*["']([^"']+)["']/i,
      /player\.setup\([\s\S]*?sources\s*:\s*\[[\s\S]*?src\s*:\s*["']([^"']+)["']/i,
    ])

    if (link && !link.startsWith("blob:")) return link

    // Try to find .m3u8 in any data attributes
    const dataMatch = data.match(/data-src=["']([^"']+\.m3u8[^"']*)["']/i);
    if (dataMatch && dataMatch[1] && !dataMatch[1].startsWith("blob:")) return normalizeExtractedUrl(dataMatch[1])

    // Try eval-based extraction: look for sources in script tags
    const scriptMatch = data.match(/<script[^>]*>([\s\S]*?var\s+sources\s*=\s*\[[\s\S]*?\];[\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      const sourcesLines = scriptMatch[1];
      const urlInScript = sourcesLines.match(/src\s*:\s*["'](https?:\/\/[^"']+)["']/i);
      if (urlInScript && urlInScript[1] && !urlInScript[1].startsWith("blob:")) return normalizeExtractedUrl(urlInScript[1])
    }
    return null
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
GetVoeLink = function (url, referer = undefined) {
  const headers = { ...HTML_HEADERS };
  if (referer) {
    headers.Referer = referer;
  }
  return fetchPromise(url, { headers }).then((data) => {
    let html = data
    // Check for redirect in page
    const redirectMatch = data.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/i);
    if (redirectMatch && redirectMatch[1]) {
      return fetchPromise(redirectMatch[1], { headers })
    } else return html
  }).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
      /"file"\s*:\s*"([^"]+)"/i,
      /(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8)[^\s"'<>]*)/i,
    ])
    return link ? link : Promise.reject("No video link")
  })
}
