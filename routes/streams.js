const express = require("express")
const stream = express.Router()

require('dotenv').config()//process.env.var

const Metadata = require('./metadata_copy.js')
const relationsAPI = require('./relations.js')
const animeFLVAPI = require('./animeFLV.js')
const animeAV1API = require('./animeav1.js')
const henaojaraAPI = require('./henaojara.js')
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
  let streams = []
  const idDetails = req.params.videoId.split(':')
  const videoID = idDetails[0] //We only want the first part of the videoID, which is the IMDB ID, the rest would be the season and episode
  if ((videoID?.startsWith("animeflv")) || (videoID?.startsWith("animeav1")) || (videoID?.startsWith("henaojara"))) { //If we got an AnimeFLV or AnimeAV1 specific ID
    const ID = idDetails[1] //We want the second part of the videoID
    let episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    console.log('Extra parameters:', res.locals.extraParams)
    const animeFLVp = animeFLVAPI.GetItemStreams(ID, episode)
    const animeAV1p = animeAV1API.GetItemStreams(ID, episode)
    const henaojarap = henaojaraAPI.GetItemStreams(ID, episode)
    CombineStreams(animeFLVp, animeAV1p, henaojarap).then((combinedStreams)=>{
      if (combinedStreams.length > 0) {
        console.log(`\x1b[36mGot ${combinedStreams.length} streams\x1b[39m`)
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ streams: combinedStreams, message: "Got streams!" })
        next()
      } else {
        if (!res.headersSent) {
          res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
          res.json({ streams, message: "Failed getting Anime info" });
          next()
        }
      }
    })
  } else {
    let episode, season, animeIMDBIDPromise

    if (videoID?.startsWith("tt")) { //If we got an IMDB ID/TMDB ID
      const ID = videoID //We want the IMDB ID as is
      season = idDetails[1] //undefined if we don't get a season number in the query, which is fine
      episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with IMDB ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = Promise.resolve(ID)
    } else if (videoID?.startsWith("tmdb")) {
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      season = idDetails[2] //undefined if we don't get a season number in the query, which is fine
      episode = idDetails[3] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with TMDB ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = Metadata.GetIMDBIDFromTMDBID(ID, req.params.type)
    } else if (videoID.match(/^(?:kitsu|mal|anidb|anilist)$/)) { //If we got a kitsu, mal, anilist or anidb ID
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = relationsAPI.GetIMDBIDFromANIMEID(videoID, ID)
    } else {
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ streams, message: "Wrong ID format, check manifest for errors" }); next()
      }
    }

    console.log('Extra parameters:', res.locals.extraParams)
    animeIMDBIDPromise.then((imdbID) => {
      if (!imdbID || imdbID === "null") throw Error("No IMDB ID")
      console.log(`\x1b[33mGetting TMDB metadata for IMDB ID:\x1b[39m`, imdbID)
      return Metadata.GetTMDBMeta(imdbID).then((TMDBmeta) => {
        console.log('\x1b[36mGot TMDB metadata:\x1b[39m', TMDBmeta.shortPrint())
        return TMDBmeta
      }).catch((reason) => {
        console.error("\x1b[31mDidn't get TMDB metadata because:\x1b[39m " + reason + ", \x1b[33mtrying Cinemeta...\x1b[39m")
        return Metadata.GetCinemetaMeta(imdbID, req.params.type).then((Cinemeta) => {
          console.log('\x1b[36mGot Cinemeta metadata:\x1b[39m', Cinemeta.shortPrint())
          return Cinemeta
        })
      }).catch((err) => { //only catches error from TMDB or Cinemeta API calls, which we want
        console.error('\x1b[31mFailed on metadata:\x1b[39m ' + err)
        if (!res.headersSent) {
          res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
          res.json({ streams, message: "Failed getting media info" })
          next()
        }
        throw err //We throw the error so we can catch it later
      })
    }).then((metadata) => {
      const searchTerm = ((season) && (parseInt(season) !== 1)) ? `${metadata.title} ${season}` : metadata.title
      const animeFLVp = animeFLVAPI.SearchAnimeFLV(searchTerm).then((animeFLVitem) => {
        const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1, all: true})[0]?.obj || animeFLVitem.sort((a,b)=>(a.type === req.params.type && b.type !== req.params.type)?-1:0)[0];//Sort by type to enhance matching
        console.log('\x1b[36mGot AnimeFLV entry:\x1b[39m', result.title)
        return animeFLVAPI.GetItemStreams(result.slug, episode)
      })
      const animeAV1p = animeAV1API.SearchAnimeAV1(searchTerm, req.params.type).then((animeFLVitem) => {
        const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1, all: true})[0]?.obj || animeFLVitem[0];
        console.log('\x1b[36mGot AnimeAV1 entry:\x1b[39m', result.title)
        return animeAV1API.GetItemStreams(result.slug, episode)
      })
      const henaojarap = henaojaraAPI.SearchHenaojara(searchTerm).then((animeFLVitem) => {
        const result = fuzzysort.go(searchTerm, animeFLVitem, {key: 'title', limit: 1, all: true})[0]?.obj || animeFLVitem[0];
        console.log('\x1b[36mGot Henaojara entry:\x1b[39m', result.title)
        return henaojaraAPI.GetItemStreams(result.slug, episode)
      })
      CombineStreams(animeFLVp, animeAV1p, henaojarap).then((combinedStreams)=>{
        if (combinedStreams.length > 0) {
          console.log(`\x1b[36mGot ${combinedStreams.length} streams\x1b[39m`)
          res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
          res.json({ streams: combinedStreams, message: "Got streams!" })
          next()
        } else {
          if (!res.headersSent) {
            res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
            res.json({ streams, message: "Failed getting Anime info" });
            next()
          }
        }
      })
    }).catch((err) => {
      console.error('\x1b[31mFailed on metadata search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
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
  console.log(`\x1b[96mEntered ParseConfig with\x1b[39m ${req.originalUrl}`)
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

function CombineStreams(animeFLVPromise, animeAV1Promise, henaojaraPromise) {
  return Promise.allSettled([animeFLVPromise, animeAV1Promise, henaojaraPromise]).then((results) => {
    let combinedStreams = []
    if (results[0].value) {
      console.log(`\x1b[36mGot ${results[0].value.length} AnimeFLV streams\x1b[39m`)
      combinedStreams = combinedStreams.concat(results[0].value)
    } else {console.error('\x1b[31mFailed on AnimeFLV slug search because:\x1b[39m ' + results[0].reason)}
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
    return combinedStreams
  })
}

module.exports = stream;