const express = require("express")
const stream = express.Router()

require('dotenv').config()//process.env.var

const Metadata = require('./metadata_copy.js')
const relationsAPI = require('./relations.js')
const CLIENT_CACHE = require('../lib/clientCache.js')
const animeFLVAPI = require('./animeFLV.js')
const animeAV1API = require('./animeav1.js')
const henaojaraAPI = require('./henaojara.js')
const tioanimeAPI = require('./tioanime.js')
// const animejaraAPI = require('./animejara.js')
const jkanimeAPI = require('./jkanime.js')
const latanimeAPI = require('./latanime.js')
const fuzzysort = require('fuzzysort')

/**
 * Tipical express middleware callback.
 * @callback subRequestMiddleware
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response
 * @param {function} [next] - The next middleware function in the chain, should end the response at some point
 */
/** 
 * Handles requests to /stream that contain extra parameters, we should append them to the request for future middleware, see {@link SearchParamsRegex} to see how these are handled
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, we don't end it because this function/middleware doesn't handle the full request!
 * @param {subRequestMiddleware} next - REQUIRED: The next middleware function in the chain, should end the response at some point
 */
function HandleLongStreamRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleLongStreamRequest with\x1b[39m ${req.originalUrl}`)
  res.locals.extraParams = SearchParamsRegex(req.params[0])
  next()
}
/** 
 * Handles requests to /stream whether they contain extra parameters (see {@link HandleLongSubRequest} for details on this) or just the type and videoID.
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware, but the response is handled by sending an empty stream Object.
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain, can be empty because we already responded with this middleware
 */
function HandleStreamRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleStreamRequest with\x1b[39m ${req.originalUrl}`)
  const onlyInternal = (res.locals.config?.get("externalStreams") != 'true')
  let streams = []
  const idDetails = req.params.videoId.split(':')
  const videoID = idDetails[0] //We only want the first part of the videoID, which is the IMDB ID, the rest would be the season and episode
  if ((videoID?.startsWith("animeflv")) || (videoID?.startsWith("animeav1")) || (videoID?.startsWith("henaojara")) || (videoID?.startsWith("tioanime")) || (videoID?.startsWith("animejara")) /*|| (videoID?.startsWith("jkanime"))*/ || (videoID?.startsWith("latanime"))) { //If we got an AnimeFLV or AnimeAV1 specific ID
    const ID = idDetails[1] //We want the second part of the videoID
    let episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
    let season
    if(videoID?.startsWith("animejara")){
      season = idDetails[2]
      episode = idDetails[3]
    }
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    console.log('Extra parameters:', res.locals.extraParams)
    const animeFLVp = animeFLVAPI.GetItemStreams(ID, onlyInternal, episode)
    const animeAV1p = animeAV1API.GetItemStreams(ID, onlyInternal, episode)
    const henaojarap = henaojaraAPI.GetItemStreams(ID, onlyInternal, episode)
    const tioanimep = tioanimeAPI.GetItemStreams(ID, onlyInternal, episode)
    // const animejarap = animejaraAPI.GetItemStreams(ID, onlyInternal, season, episode)
    const animejarap = Promise.resolve([])
    // const jkanimep = jkanimeAPI.GetItemStreams(ID, onlyInternal, episode)
    const jkanimep = Promise.resolve([]) //JKAnime answers 403 to the server's IP (#61)
    const latanimep = latanimeAPI.GetItemStreams(ID, onlyInternal, episode)
    CombineStreams(animeFLVp, animeAV1p, henaojarap, tioanimep, animejarap, jkanimep, latanimep).then((combinedStreams)=>{
      if (combinedStreams.length > 0) {
        console.log(`\x1b[36mGot ${combinedStreams.length} streams\x1b[39m`)
        res.header('Cache-Control', CLIENT_CACHE.streams)
        res.json({ streams: combinedStreams, message: "Got streams!" })
        next()
      } else {
        if (!res.headersSent) {
          res.header('Cache-Control', CLIENT_CACHE.failure)
          res.json({ streams, message: "Failed getting streams" });
          next()
        }
      }
    })
  } else {
    let episode, season, animeIMDBIDPromise, romajiPromise

    if (videoID?.startsWith("tt")) { //If we got an IMDB ID/TMDB ID
      const ID = videoID //We want the IMDB ID as is
      season = idDetails[1] //undefined if we don't get a season number in the query, which is fine
      episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with IMDB ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = Promise.resolve(ID)
      romajiPromise = relationsAPI.GetRomajiTitle("imdb", ID)
    } else if (videoID?.startsWith("tmdb")) {
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      season = idDetails[2] //undefined if we don't get a season number in the query, which is fine
      episode = idDetails[3] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with TMDB ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = Metadata.GetIMDBIDFromTMDBID(ID, req.params.type)
      romajiPromise = relationsAPI.GetRomajiTitle("themoviedb", ID)
    } else if (videoID.match(/^(?:kitsu|mal|anidb|anilist)$/)) { //If we got a kitsu, mal, anilist or anidb ID
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
      const mappings = relationsAPI.GetAniZipMappings(videoID, ID) //one ani.zip call for both the IMDB ID and the romaji title
      animeIMDBIDPromise = relationsAPI.GetIMDBIDFromANIMEID(videoID, ID, mappings)
      romajiPromise = relationsAPI.GetRomajiTitle(videoID, ID, mappings)
    } else {
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ streams, message: "Wrong ID format, check manifest for errors" }); next()
      }
      return //nothing else to do, and there's no promise to continue with
    }

    console.log('Extra parameters:', res.locals.extraParams)
    romajiPromise = romajiPromise?.catch((err) => console.error('\x1b[31mFailed getting romaji title:\x1b[39m ' + err))
    //a special (season 0) is searched by its own title (from Cinemeta): the romaji would be the main series' title
    if (parseInt(season) === 0) romajiPromise = Promise.resolve()
    animeIMDBIDPromise.then((imdbID) => {
      if (!imdbID || imdbID === "null") throw Error("No IMDB ID")
      let metaProm
      if ((season) && (parseInt(season) === 0) && (req.params.type==="series")){
        console.log(`\x1b[33mGot a "special", searching Cinemeta with:`, imdbID, "to get the special's title:\x1b[39m")
        metaProm=Metadata.GetSpecialMeta(imdbID,episode)
      } else {
        console.log(`\x1b[33mGetting TMDB metadata for IMDB ID:\x1b[39m`, imdbID)
        metaProm=Metadata.GetTMDBMeta(imdbID).then((TMDBmeta) => {
          console.log('\x1b[36mGot TMDB metadata:\x1b[39m', TMDBmeta.shortPrint())
          return TMDBmeta
        }).catch((reason) => {
          console.error("\x1b[31mDidn't get TMDB metadata because:\x1b[39m " + reason + ", \x1b[33mtrying Cinemeta...\x1b[39m")
          return Metadata.GetCinemetaMeta(imdbID, req.params.type).then((Cinemeta) => {
            console.log('\x1b[36mGot Cinemeta metadata:\x1b[39m', Cinemeta.shortPrint())
            return Cinemeta
          })
        })
      }
      
      return metaProm.catch((err) => { //only catches error from TMDB or Cinemeta API calls, which we want
        console.error('\x1b[31mFailed on metadata:\x1b[39m ' + err)
        if (!res.headersSent) {
          res.header('Cache-Control', CLIENT_CACHE.failure)
          res.json({ streams, message: "Failed getting media info" })
          next()
        }
        throw err //We throw the error so we can catch it later
      })
    }).then((metadata) => Promise.resolve(romajiPromise).then((romaji) => {
      //Sites list anime by their romaji title: try it first, then the provider's (usually English) title, since the
      //romaji sometimes doesn't match a site's naming (e.g. AniList's "SPY×FAMILY" vs the sites' "Spy x Family")
      const searchTerms = [...new Set([romaji, metadata.title].filter(Boolean))].map((title) => ((season) && (parseInt(season) !== 1) && (parseInt(season) !== 0)) ? `${title} ${season}` : title)
      console.log('Search terms:', searchTerms)
      //Runs a source's search/match/streams chain with each search term until one succeeds
      const firstMatch = async (searchFn) => {
        let lastError = Error('No search terms!')
        for (const searchTerm of searchTerms) {
          try {
            return await searchFn(searchTerm)
          } catch (err) {
            lastError = err //this term found nothing on this site, try the next one
          }
        }
        throw lastError
      }
      //Regular-season episodes must not match a site's separate "Specials"/OVA entry (#55)
      const notSpecial = (items) => (req.params.type === "series" && parseInt(season) !== 0) ? items.filter((i) => !/\b(specials?|especial(es)?|ova)\b/i.test(i.title)) : items
      // const animeFLVp = animeFLVAPI.SearchAnimeFLV(searchTerm).then((animeFLVitem) => {
      //   const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1})[0]?.obj || animeFLVitem.sort((a,b)=>(a.type === req.params.type && b.type !== req.params.type)?-1:0)[0];//Sort by type to enhance matching
      //   console.log('\x1b[36mGot AnimeFLV entry:\x1b[39m', result.title)
      //   return animeFLVAPI.GetItemStreams(result.slug, onlyInternal, episode)
      // })
      const animeFLVp = firstMatch((searchTerm) => animeFLVAPI.SearchAnimeFLV(searchTerm)
        .then(notSpecial)
        .then((animeFLVitems) => {
          const candidates = animeFLVitems
            .filter((item) => !item.type || item.type === req.params.type)
            .filter((item) => {
              const normalizedTitle = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
              const normalizedSearch = searchTerm.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
              return normalizedTitle === normalizedSearch ||
                new RegExp(`^${normalizedSearch} (latino|castellano)$`, "iu").test(normalizedTitle)
            })
          if (candidates.length === 0) throw Error('No AnimeFLV matches!')
          console.log(`\x1b[36mGot ${candidates.length} AnimeFLV entries:\x1b[39m`, candidates.map((item) => item.title).join(", "))
          return Promise.allSettled(candidates.map((result) =>
            animeFLVAPI.GetItemStreams(result.slug, onlyInternal, episode)
          )).then((results) => {
            const streams = results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
            if (streams.length === 0) throw Error("No AnimeFLV streams!")
            return streams
          })
        }))
      const animeAV1p = firstMatch((searchTerm) => animeAV1API.SearchAnimeAV1(searchTerm, req.params.type).then(notSpecial).then((animeFLVitem) => {
        const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1, threshold: .5})[0]?.obj;
        if (!result) throw Error('No search results!')
        console.log('\x1b[36mGot AnimeAV1 entry:\x1b[39m', result.title)
        return animeAV1API.GetItemStreams(result.slug, onlyInternal, episode)
      }))
      //Henaojara lists every season, movie and dub as its own entry: keep only the ones that can be the requested one
      //(same type, no "Season/Part N" of another season), fuzzy match among them, and don't fall back to the first result
      const sameSeason = (title) => { const n = title.match(/\b(?:season|temporada|part|parte)\s*(\d+)/i)?.[1]; return !n || parseInt(n) === (parseInt(season) || 1) }
      const henaojarap = firstMatch((searchTerm) => henaojaraAPI.SearchHenaojara(searchTerm).then(notSpecial).then((animeFLVitem) => {
        const candidates = animeFLVitem.filter((i) => (!i.type || i.type === req.params.type) && sameSeason(i.title))
        const result = fuzzysort.go(searchTerm, candidates, {key: 'title', limit: 1, threshold: .5})[0]?.obj;
        if (!result) throw Error('No search results!')
        console.log('\x1b[36mGot Henaojara entry:\x1b[39m', result.title)
        return henaojaraAPI.GetItemStreams(result.slug, onlyInternal, episode)
      }))
      const tioanimep = firstMatch((searchTerm) => tioanimeAPI.SearchTioAnime(searchTerm, req.params.type).then(notSpecial).then((animeFLVitem) => {
        const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1, threshold: .5})[0]?.obj; //no first-result fallback: it served another show's streams
        if (!result) throw Error('No search results!')
        console.log('\x1b[36mGot TioAnime entry:\x1b[39m', result.title)
        return tioanimeAPI.GetItemStreams(result.slug, onlyInternal, episode)
      }))
      // const animejarap = animejaraAPI.SearchAnimeJara(searchTerm, req.params.type).then((animeFLVitem) => {
      //   const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1})[0]?.obj || animeFLVitem[0];
      //   console.log('\x1b[36mGot AnimeJara entry:\x1b[39m', result.title)
      //   return animejaraAPI.GetItemStreams(result.slug, onlyInternal, season, episode)
      // })
      const animejarap = Promise.resolve([])
      // const jkanimep = firstMatch((searchTerm) => jkanimeAPI.SearchJKAnime(searchTerm).then(notSpecial).then((animeFLVitem) => {
        // const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1, threshold: .5})[0]?.obj;
        // if (!result) throw Error('No search results!')
        // console.log('\x1b[36mGot JKAnime entry:\x1b[39m', result.title)
        // return jkanimeAPI.GetItemStreams(result.slug, onlyInternal, episode)
      // }))
      const jkanimep = Promise.resolve([]) //JKAnime answers 403 to the server's IP (#61)
      //Latanime lists the sub, Latino and Castellano versions as separate entries, with inconsistent season naming
      //("X S2 Latino", "X 2 Castellano"): entries of the requested season are matched by base title (fuzzy matched like
      //the other sources when none is exact) and the streams of every version of the match are merged. Its search is
      //literal ("X 2" doesn't find "X S2"), so the base title is searched
      const latanimep = firstMatch((searchTerm) => latanimeAPI.SearchLatanime(searchTerm.replace(/\s+\d{1,2}$/, ""), req.params.type).then(notSpecial).then((animeFLVitem) => {
        const { key, base } = latanimeAPI.ParseTitle(searchTerm)
        const candidates = animeFLVitem.filter((i) => i.key.split("|")[1] === key.split("|")[1] && i.dubLang !== "cat") //Catalan dubs would be labelled as Castilian
        const best = candidates.find((i) => i.key === key) || fuzzysort.go(base, candidates, {key: 'base', limit: 1, threshold: .5})[0]?.obj
        if (!best) throw Error('No search results!')
        const results = candidates.filter((i) => i.key === best.key)
        console.log('\x1b[36mGot Latanime entries:\x1b[39m', results.map((r) => r.title).join(", "))
        return Promise.allSettled(results.map((r) => latanimeAPI.GetItemStreams(r.slug, onlyInternal, episode, r.title))).then((all) => {
          const streams = all.filter((p) => p.value).flatMap((p) => p.value)
          if (streams.length < 1) throw Error('No streams!')
          return streams
        })
      }))
      CombineStreams(animeFLVp, animeAV1p, henaojarap, tioanimep, animejarap, jkanimep, latanimep).then((combinedStreams)=>{
        if (combinedStreams.length > 0) {
          console.log(`\x1b[36mGot ${combinedStreams.length} streams\x1b[39m`)
          res.header('Cache-Control', CLIENT_CACHE.streams)
          res.json({ streams: combinedStreams, message: "Got streams!" })
          next()
        } else {
          if (!res.headersSent) {
            res.header('Cache-Control', CLIENT_CACHE.failure)
            res.json({ streams, message: "Failed getting streams" });
            next()
          }
        }
      })
    })).catch((err) => {
      console.error('\x1b[31mFailed on metadata search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', CLIENT_CACHE.failure)
        res.json({ streams, message: "Failed getting media info" })
        next()
      }
    })
  }
}
/** 
 * Parses the extra config parameter we can get when the addon is configured
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain
 */
function ParseConfig(req, res, next) {
  //console.log(`\x1b[96mEntered ParseConfig with\x1b[39m ${req.originalUrl}`)
  res.locals.config = new URLSearchParams(decodeURIComponent(req.params.config))
  console.log('Config parameters:', res.locals.config)
  next()
}
//Configured requests
stream.get("/:config/stream/:type/:videoId/*.json", ParseConfig, HandleLongStreamRequest, HandleStreamRequest)
stream.get("/:config/stream/:type/:videoId.json", ParseConfig, HandleStreamRequest)
//Unconfigured requests
stream.get("/stream/:type/:videoId/*.json", HandleLongStreamRequest, HandleStreamRequest)
stream.get("/stream/:type/:videoId.json", HandleStreamRequest)
/** 
 * Parses the capture group corresponding to URL parameters that stremio might send with its request. Tipical extra info is a dot separated title, the video hash or even file size
 * @param {string} extraParams - The string captured by express in req.params[0] in route {@link stream.get("/:type/:videoId/*.json", HandleLongSubRequest, HandleSubRequest)}
 * @return {Object} Empty if we passed undefined, populated with key/value pairs corresponding to parameters otherwise
 */
function SearchParamsRegex(extraParams) {
  //console.log(`\x1b[33mfull extra params were:\x1b[39m ${extraParams}`)
  if (extraParams !== undefined) {
    const paramMap = new Map()
    const keyVals = extraParams.split('&');
    for (let keyVal of keyVals) {
      const keyValArr = keyVal.split('=')
      const param = keyValArr[0]; const val = keyValArr[1];
      paramMap.set(param, val)
    }
    const paramJSON = Object.fromEntries(paramMap)
    //console.log(paramJSON)
    return paramJSON
  } else return {}
}

function CombineStreams(animeFLVPromise, animeAV1Promise, henaojaraPromise, tioanimePromise, animejaraPromise, jkanimePromise, latanimePromise) {
  let lastInternal, lastInternalFLV, lastInternalAV1, lastInternalHena, lastInternalTio, lastInternalJara, lastInternalJK
  return Promise.allSettled([animeFLVPromise, animeAV1Promise, henaojaraPromise, tioanimePromise, animejaraPromise, jkanimePromise, latanimePromise]).then((results) => {
    let combinedStreams = []
    if (results[0].value) {
      console.log(`\x1b[36mGot ${results[0].value.length} AnimeFLV streams\x1b[39m`)
      combinedStreams = combinedStreams.concat(results[0].value)
    } else {console.error('\x1b[31mFailed on AnimeFLV stream search because:\x1b[39m ' + results[0].reason)}
    if (results[1].value) {
      console.log(`\x1b[36mGot ${results[1].value.length} AnimeAV1 streams\x1b[39m`)
      lastInternalFLV = combinedStreams.findLastIndex((stream)=>stream.url !== undefined)
      lastInternalAV1 = results[1].value.findLastIndex((stream)=>stream.url !== undefined)
      if (lastInternalAV1 === -1) {
        combinedStreams = combinedStreams.concat(results[1].value) //AnimeAV1 has only external links, just append at the end
      } else if ((lastInternalAV1 !== -1) && (lastInternalFLV === -1)) {
        combinedStreams = results[1].value.concat(combinedStreams) //AnimeFLV has only external links, prepend at the start
      } else {
        combinedStreams.splice(lastInternalFLV + 1, 0, ...results[1].value.slice(0, lastInternalAV1 + 1)) //Both have internal links, insert AnimeAV1 internal links after last AnimeFLV internal links
        combinedStreams = combinedStreams.concat(results[1].value.slice(lastInternalAV1 + 1)) //Append external links at the end
      }
    } else {console.error('\x1b[31mFailed on AnimeAV1 slug search because:\x1b[39m ' + results[1].reason)}
    if (results[2].value) {
      console.log(`\x1b[36mGot ${results[2].value.length} Henaojara streams\x1b[39m`)
      lastInternal = combinedStreams.findLastIndex((stream)=>stream.url !== undefined)
      lastInternalHena = results[2].value.findLastIndex((stream)=>stream.url !== undefined)
      if (lastInternalHena === -1) {
        combinedStreams = combinedStreams.concat(results[2].value) //Henaojara has only external links, just append at the end
      } else if ((lastInternalHena !== -1) && (lastInternal === -1)) {
        combinedStreams = results[2].value.concat(combinedStreams) //Previous has only external links, prepend at the start
      } else {
        combinedStreams.splice(lastInternal + 1, 0, ...results[2].value.slice(0, lastInternalHena + 1)) //Both have internal links, insert Henaojara internal links after last internal links
        combinedStreams = combinedStreams.concat(results[2].value.slice(lastInternalHena + 1)) //Append external links at the end
      }
    } else {console.error('\x1b[31mFailed on Henaojara slug search because:\x1b[39m ' + results[2].reason)}
    if (results[3].value) {
      console.log(`\x1b[36mGot ${results[3].value.length} TioAnime streams\x1b[39m`)
      lastInternal = combinedStreams.findLastIndex((stream)=>stream.url !== undefined)
      lastInternalTio = results[3].value.findLastIndex((stream)=>stream.url !== undefined)
      if (lastInternalTio === -1) {
        combinedStreams = combinedStreams.concat(results[3].value) //TioAnime has only external links, just append at the end
      } else if ((lastInternalTio !== -1) && (lastInternal === -1)) {
        combinedStreams = results[3].value.concat(combinedStreams) //Previous has only external links, prepend at the start
      } else {
        combinedStreams.splice(lastInternal + 1, 0, ...results[3].value.slice(0, lastInternalTio + 1)) //Both have internal links, insert TioAnime internal links after last internal links
        combinedStreams = combinedStreams.concat(results[3].value.slice(lastInternalTio + 1)) //Append external links at the end
      }
    } else {console.error('\x1b[31mFailed on TioAnime slug search because:\x1b[39m ' + results[3].reason)}
    if (results[4].value) {
      console.log(`\x1b[36mGot ${results[4].value.length} AnimeJara streams\x1b[39m`)
      lastInternal = combinedStreams.findLastIndex((stream)=>stream.url !== undefined)
      lastInternalJara = results[4].value.findLastIndex((stream)=>stream.url !== undefined)
      if (lastInternalJara === -1) {
        combinedStreams = combinedStreams.concat(results[4].value) //AnimeJara has only external links, just append at the end
      } else if ((lastInternalJara !== -1) && (lastInternal === -1)) {
        combinedStreams = results[4].value.concat(combinedStreams) //Previous has only external links, prepend at the start
      } else {
        combinedStreams.splice(lastInternal + 1, 0, ...results[4].value.slice(0, lastInternalJara + 1)) //Both have internal links, insert AnimeJara internal links after last internal links
        combinedStreams = combinedStreams.concat(results[4].value.slice(lastInternalJara + 1)) //Append external links at the end
      }
    } else {console.error('\x1b[31mFailed on AnimeJara slug search because:\x1b[39m ' + results[4].reason)}
    if (results[5].value) {
      console.log(`\x1b[36mGot ${results[5].value.length} JKAnime streams\x1b[39m`)
      lastInternal = combinedStreams.findLastIndex((stream)=>stream.url !== undefined)
      lastInternalJK = results[5].value.findLastIndex((stream)=>stream.url !== undefined)
      if (lastInternalJK === -1) {
        combinedStreams = combinedStreams.concat(results[5].value) //JKAnime has only external links, just append at the end
      } else if ((lastInternalJK !== -1) && (lastInternal === -1)) {
        combinedStreams = results[5].value.concat(combinedStreams) //Previous has only external links, prepend at the start
      } else {
        combinedStreams.splice(lastInternal + 1, 0, ...results[5].value.slice(0, lastInternalJK + 1)) //Both have internal links, insert JKAnime internal links after last internal links
        combinedStreams = combinedStreams.concat(results[5].value.slice(lastInternalJK + 1)) //Append external links at the end
      }
    } else {console.error('\x1b[31mFailed on JKAnime slug search because:\x1b[39m ' + results[5].reason)}
    if (results[6].value) {
      console.log(`\x1b[36mGot ${results[6].value.length} Latanime streams\x1b[39m`)
      lastInternal = combinedStreams.findLastIndex((stream)=>stream.url !== undefined)
      const lastInternalLat = results[6].value.findLastIndex((stream)=>stream.url !== undefined)
      if (lastInternalLat === -1) {
        combinedStreams = combinedStreams.concat(results[6].value) //Latanime has only external links, just append at the end
      } else if ((lastInternalLat !== -1) && (lastInternal === -1)) {
        combinedStreams = results[6].value.concat(combinedStreams) //Previous has only external links, prepend at the start
      } else {
        combinedStreams.splice(lastInternal + 1, 0, ...results[6].value.slice(0, lastInternalLat + 1)) //Both have internal links, insert Latanime internal links after last internal links
        combinedStreams = combinedStreams.concat(results[6].value.slice(lastInternalLat + 1)) //Append external links at the end
      }
    } else {console.error('\x1b[31mFailed on Latanime slug search because:\x1b[39m ' + results[6].reason)}
    return combinedStreams
  })
}

module.exports = stream;