const crypto = require('node:crypto');
const cheerio = require("cheerio");
const unpacker = require("unpacker");

exports.getServerTitle = function (serverDomain) {
  const cleanDom = serverDomain.replace("bysesukior", "Filemoon").replace("movearnpre", "Vidhide")
    .replace("luluvdo", "Lulustream").replace("dhcplay", "Streamwish").replace("listeamed", "Vidguard")
    .replace("rpmvip", "RPMshare").replace("dood", "Doodstream").replace("yourupload", "YourUpload").replace("mp4upload", "MP4Upload").replace("Mp4u", "MP4U")
    .replace("pdrain", "PDrain").replace("hls", "HLS").replace("mixdrop", "Mixdrop")
    .replace(".com", "").replace(".net", "").replace(".org", "").replace(".top", "")
    .replace(".to", "").replace(".ac", "").replace(".sx", "").replace(".ps", "").replace(".la", "");
  return cleanDom.charAt(0).toUpperCase() + cleanDom.slice(1)
}

exports.GetStreamLinks = function (serviceName, serviceSlug, streamArray, onlyInternal = true) {
  if (streamArray?.data?.servers === undefined) throw Error("Invalid response!")
  let epName = (streamArray.data.number) ? streamArray.data.title + " Ep. " + streamArray.data.number : streamArray.data.title
  const externalStreams = streamArray.data.servers.filter((src) => src.embed !== undefined).map((source) => {
    return {
      externalUrl: source.embed,
      name: serviceName + "\n" + source.name + "⇗\n(external)" + ((source.dub) ? `\n🗣️🎙️(${(source.dubLang === "lat") ? "🇲🇽" : "🇪🇸"}DUB)` : ""),
      description: epName + "\n⚙️ (opens " + source.name + " in your browser)\n🔗 " + source.embed + ((source.dub) ? `\n🗣️🎙️(${(source.dubLang === "lat") ? "🇲🇽" : "🇪🇸"}DUB)` : `\n🇯🇵${(source.dubLang === "lat") ? "🇲🇽" : "🇪🇸"}`),
      behaviorHints: {
        bingeGroup: serviceSlug + "|" + source.name + "|ext",
        //filename: source.embed
      }
    }
  })
  //return externalStreams
  const downloadStreams = streamArray.data.servers.filter((src) => (src.embed !== undefined && ["YourUpload", "MP4Upload", /*"Stape", "SW", "Streamwish", "Okru", "Mixdrop", "Voe", "Vidhide", "Hqq", "Filemoon", "HLS", "PDrain"*/].includes(src.name)))
  const promises = downloadStreams.map((source) => {
    if (source.name === "YourUpload") {
      return GetYourUploadLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": "https://yourupload.com" })
      }).catch((err) => {
        console.error("Failed getting YourUpload link:", err)
        return undefined
      })
    } else if (source.name === "MP4Upload") {
      return GetMP4UploadLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": "https://a1.mp4upload.com" })
      }).catch((err) => {
        console.error("Failed getting MP4Upload link:", err)
        return undefined
      })
    } else if (source.name === "Stape" || source.name === "Streamtape") {
      return GetMP4UploadLink(source.download || source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug)
      }).catch((err) => {
        console.error("Failed getting MP4Upload link:", err)
        return undefined
      })
    } else if (source.name === "Voe") {
      return GetVoeLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": new URL(source.embed).origin })
      }).catch((err) => {
        console.error("Failed getting Voe link:", err)
        return undefined
      })
    } else if (source.name === "Vidhide") {
      return GetVidhideLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": new URL(source.embed).origin })
      }).catch((err) => {
        console.error("Failed getting Vidhide link:", err)
        return undefined
      })
    } else if (source.name === "Hqq") {
      return GetHqqLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": new URL(source.embed).origin })
      }).catch((err) => {
        console.error("Failed getting Hqq link:", err)
        return undefined
      })
    } else if (source.name === "Filemoon") {
      return GetFilemoonLink(source.embed).then((realURL) => {
        return FormatStream(realURL.stream_url, source, epName, serviceName, serviceSlug, { "Referer": realURL.referer })
      }).catch((err) => {
        console.error("Failed getting Filemoon link:", err)
        return undefined
      })
    } else if (source.name === "Okru" && source.embed.contains(".ru/")) {//AnimeJara serves Doodstream links labeled as Okru
      return GetOkruLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": source.embed })
      }).catch((err) => {
        console.error("Failed getting Okru link:", err)
        return undefined
      })
    } else if ((source.name === "Streamwish") || (source.name === "SW")) {
      return GetStreamwishLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": new URL(source.embed).origin })
      }).catch((err) => {
        console.error("Failed getting Streamwish link:", err)
        return undefined
      })
    } else if (source.name === "PDrain") {
      return GetPDrainLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": new URL(source.embed).origin })
      }).catch((err) => {
        console.error("Failed getting PDrain link:", err)
        return undefined
      })
    } else if (source.name === "Mixdrop") {
      return GetMixdropLink(source.embed).then((realURL) => {
        const referer = "https://miixdrop.top"
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Host": new URL(realURL).host, "Origin": referer, "Referer": referer + "/" })
      }).catch((err) => {
        console.error("Failed getting Mixdrop link:", err)
        return undefined
      })
    } else if (source.name === "HLS") {
      return GetHLSLink(source.embed).then((realURL) => {
        return FormatStream(realURL, source, epName, serviceName, serviceSlug, { "Referer": new URL(source.embed).origin })
      }).catch((err) => {
        console.error("Failed getting HLS link:", err)
        return undefined
      })
    }
  })

  return Promise.allSettled(promises).then((results) => {
    const internalStreams = results.filter((prom) => (prom.value)).map((source) => source.value)
    return (onlyInternal) ? internalStreams : internalStreams.concat(externalStreams)
  })
}

function FormatStream(realURL, source, epName, serviceName, serviceSlug, headers = undefined) {
  if (headers !== undefined && !headers["User-Agent"]) headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
  return {
    url: realURL,
    name: serviceName + "\n" + source.name + ((source.dub) ? `\n🗣️🎙️(${(source.dubLang === "lat") ? "🇲🇽" : "🇪🇸"}DUB)` : ""),
    description: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? `\n🗣️🎙️(${(source.dubLang === "lat") ? "🇲🇽" : "🇪🇸"}DUB)` : `\n🇯🇵${(source.dubLang === "lat") ? "🇲🇽" : "🇪🇸"}`),
    behaviorHints: {
      bingeGroup: serviceSlug + "|" + source.name,
      //filename: realURL,
      notWebReady: true,
      proxyHeaders: {
        request: headers
      }
    }
  }
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
//Adapted from https://github.com/FxxMorgan/anime1v-api
function isLikelyVideoUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const lower = url.toLowerCase();
  const excludePatterns = [
    "cloudflareinsights",
    "google-analytics",
    "googletagmanager",
    "facebook.net",
    "beacon.min.js",
    ".js?",
    "analytics",
    "pixel",
    "bigbuckbunny",
    "test-videos",
    "sample-video",
    "placeholder",
  ];

  for (const pattern of excludePatterns) {
    if (lower.includes(pattern)) {
      return false;
    }
  }

  // Accept .mp4, .m3u8 (HLS), or direct video URLs
  return /\.(mp4|m3u8)$/i.test(url) || lower.includes("video") || lower.includes("stream") || lower.includes(".mp4") || lower.includes(".m3u8");
}

//Adapted from https://github.com/ChristopherProject/Streamtape-Video-Downloader
function GetStreamTapeLink (url) {
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

function GetYourUploadLink (url) {
  return fetchPromise(url).then((data) => {
    const metaMatch = /property\s*=\s*"og:video"/g.exec(data)
    if (metaMatch[0]) {
      const vidMatch = /content\s*=\s*"(\S+)"/g.exec(data.substring(metaMatch.index))
      if (vidMatch[1] && vidMatch[1] !== "/embed/novideo.mp4") {
        return vidMatch[1]
      } else return Promise.reject("No video link")
    } else return Promise.reject("No video link")
  })
}

function GetHLSLink (url) {
  if (url.includes("/play/") || url.includes("/m3u8/")) {
    return Promise.resolve(url.replace("/play/", "/m3u8/"))
  } else { return Promise.reject("No video link") }
}

function GetPDrainLink (url) {
  const metaMatch = /(.+?:\/\/.+?)\/.+?\/(.+?)(?:\?embed)?$/g.exec(url)
  if (metaMatch && metaMatch[0]) {
    return Promise.resolve(`${metaMatch[1]}/api/file/${metaMatch[2]}`)
  } else { return Promise.reject("No video link") }
}

function GetMP4UploadLink (url) {
  return fetchPromise(url).then((data) => {
    const metaMatch = /<script(?:.|\n)+?src:(?:.|\n)*?"(.+?\.mp4)"/g.exec(data)
    if (metaMatch && metaMatch[0]) {
      return metaMatch[1]
    } else { return Promise.reject("No video link") }
  })
}
// Translated from https://github.com/mhdzumair/mediaflow-proxy/blob/main/mediaflow_proxy/extractors/okru.py
function GetOkruLink (url) {
  return fetchPromise(url).then((data) => {
    const $ = cheerio.load(data);
    const data_opts = JSON.parse($('div[data-module="OKVideo"]').data("options"))
    const metadata = JSON.parse(data_opts.flashvars.metadata)
    const link = metadata.hlsMasterPlaylistUrl || metadata.rtmpUrl || metadata.hlsManifestUrl || metadata.ondemandHls
    return isLikelyVideoUrl(link) ? link : Promise.reject("No video link")
  })
}
//Translated from https://github.com/mhdzumair/mediaflow-proxy/blob/main/mediaflow_proxy/extractors/mixdrop.py
function GetMixdropLink (url) {
  if (url.includes("club")) url = url.replace("club", "ps").split("/2")[0]
  const headers = { "accept-language": "en,en-US;q=0.9,es-ES;q=0.8,es;q=0.7,fr;q=0.6,no;q=0.5" }
  return fetchPromise(url, { headers }).then((data) => {
    const $ = cheerio.load(data);
    $("script").each((_, scr) => {
      if (unpacker.detect($(scr).text())) {
        try {
          const up = unpacker.unpack($(scr).text())
          const m3u8Match2 = /https:\/\/[^"\']+?\.m3u8[^"\']*/i.exec(up)
          if (m3u8Match2 && m3u8Match2[0]) finalURL = m3u8Match2[0]
        } catch (err) { } //if unpack throws, go to next script
      }
    })
    let extracted_url
    $("script").each((_, scr) => {
      const evalTXTIdx = $(scr).text().indexOf("eval(")
      if (evalTXTIdx !== -1) {
        let evalTXT = $(scr).text().slice(evalTXTIdx)
        if (unpacker.detect(evalTXT)) {
          try {
            evalTXT = unpacker.unpack(evalTXT)
            const metaMatch = /MDCore.wurl\s?=\s?"(.+?)"/g.exec(evalTXT)
            if (metaMatch && metaMatch[1]) {
              extracted_url = metaMatch[1]
              if (extracted_url.startsWith("//")) extracted_url = "https:" + extracted_url
              if (!extracted_url.includes("http")) extracted_url = new URL(extracted_url, url).href
            }
          } catch (err) { } //if unpack throws, go to next script
        }
      }
    })
    if (extracted_url) return extracted_url
    return Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function GetVidhideLink (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*(?:file|src)\s*:\s*["'](https?:\/\/[^"']+)["']/i,
      /"file"\s*:\s*"([^"]+)"/i,
      /"source"\s*:\s*"([^"]+)"/i,
      /file\s*:\s*'([^']+)'/i,
      /setup\([^)]*file[^)]*\)/i,
    ])
    return isLikelyVideoUrl(link) ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function GetFilemoonLink (url) {
  // Translated from https://github.com/mhdzumair/mediaflow-proxy/blob/main/mediaflow_proxy/extractors/filemoon.py
  // URL format: https://filemoon.sx/e/{code} or https://filemoon.sx/d/{code}
  const codeMatch = url.match(/\/[ed]\/([^\/\s]+)\/?$/i);
  if (codeMatch && codeMatch[1]) {
    const fileMoonURL = new URL(url)
    const headers = { Referer: fileMoonURL.href }
    return fetch(`${fileMoonURL.origin}/api/videos/${codeMatch[1]}`, { headers }).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.json()
    }).then((data) => {
      if (!data || data.error !== undefined) throw Error("Error in response")
      const playback = data.playback
      if (playback === undefined || playback["key_parts"] === undefined || playback.payload === undefined) throw Error("No playback data available")
      console.log('playback["key_parts"]:', playback["key_parts"])
      let key = Buffer.concat(playback["key_parts"].map(part => Buffer.from(part, 'base64url')))
      const iv = Buffer.from(playback.iv, 'base64url')
      const payload = Buffer.from(playback.payload, 'base64url')
      const tag = payload.subarray(-16)//.slice(-16)
      const ciphertext = payload.subarray(0, -16)//.slice(0,-16)
      // 2. Create decipher instance
      const aesgcm = crypto.createDecipheriv('aes-256-gcm', key, iv);
      // 3. Provide the authentication tag for integrity verification
      aesgcm.setAuthTag(tag);
      // 4. Decrypt data
      //plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
      let plaintext = aesgcm.update(ciphertext, null, 'utf8');
      plaintext += aesgcm.final('utf8');
      const decrypted = JSON.parse(plaintext)
      let hls_source = undefined
      for (const source of decrypted.sources) {
        if (source["mime_type"] === "application/vnd.apple.mpegurl") {
          hls_source = source
          break
        }
      }
      if (hls_source === undefined) throw Error("No HLS source found in decrypted playback")
      return { stream_url: hls_source.url, referer: url }
    })
  } else Promise.reject("Wrong URL format")
  // return fetchPromise(url).then((data) => {
  //   const link = findFirstUrl(data, [
  //     /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
  //     /file\s*:\s*"([^"\)]+)"/i,
  //   ])
  //   return isLikelyVideoUrl(link) ? link : Promise.reject("No video link")
  // })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function GetHqqLink (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*file\s*:\s*["'](https?:\/\/[^"']+)["']/i,
      /file\s*:\s*"([^"]+\.mp4[^"]*)"/i,
      /video(?:\d+)?\s*=\s*["']([^"']+\.mp4[^"']+)["']/i,
    ])
    return isLikelyVideoUrl(link) ? link : Promise.reject("No video link")
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function GetFembedLink (url) {
  return fetchPromise(url).then((data) => {
    const link = findFirstUrl(data, [
      /sources?\s*:\s*\[\s*\{[^}]*src\s*:\s*["']([^"']+)["']/i,
      /file["']?\s*:\s*["']([^"']+)["']/i,
      /video\s*=\s*["']([^"']+\.mp4[^"']*)["']/i,
    ])
    return isLikelyVideoUrl(link) ? link : Promise.reject("No video link")
  })
}
//Translated from https://github.com/mhdzumair/mediaflow-proxy/blob/main/mediaflow_proxy/extractors/streamwish.py
function GetStreamwishLink (url) {
  const headers = { Referer: url.origin }
  return fetchPromise(url, { headers }).then((data) => {
    const iframe_match = data.match(/<iframe[^>]+src=["\']([^"\']+)["\']/i)
    let htmlPromise
    if (iframe_match && iframe_match[1]) {
      url = new URL(iframe_match[1], url).href
      htmlPromise = fetchPromise(url, { headers })
    } else htmlPromise = Promise.resolve(data)
    return htmlPromise.then((data) => {
      if (!data) return Promise.reject("Empty response!")
      let finalURL
      const m3u8Match = data.match(/https:\/\/[^"\']+?\.m3u8[^"\']*/i)
      if (m3u8Match && m3u8Match[0]) finalURL = m3u8Match[0]
      if (!finalURL && data.replace(" ", "").includes("eval(function(p,a,c,k,e")) {
        const $ = cheerio.load(data);
        $("script").each((_, scr) => {
          if (unpacker.detect($(scr).text())) {
            try {
              const up = unpacker.unpack($(scr).text())
              const m3u8Match2 = /https:\/\/[^"\']+?\.m3u8[^"\']*/i.exec(up)
              if (m3u8Match2 && m3u8Match2[0]) finalURL = m3u8Match2[0]
            } catch (err) { } //if unpack throws, go to next script
          }
        })
      }
      if (!finalURL) return Promise.reject("No video link")

      if (!finalURL.includes("http")) finalURL = new URL(finalURL, url).href
      return finalURL
    })
  })
}
//Adapted from https://github.com/FxxMorgan/anime1v-api
function GetVoeLink (url, referer = undefined) {
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
    return isLikelyVideoUrl(link) ? link : Promise.reject("No video link")
  })
}
