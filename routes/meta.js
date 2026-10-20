const express = require("express")
const metas = express.Router()

require('dotenv').config()//process.env.var

const Metadata = require('./metadata_copy.js')
const relationsAPI = require('./relations.js')
const animeFLVAPI = require('./animeFLV.js')
const animeAV1API = require('./animeav1.js')
const henaojaraAPI = require('./henaojara.js')
const tioanimeAPI = require('./tioanime.js')
// const animejaraAPI = require('./animejara.js')
const jkanimeAPI = require('./jkanime.js')
const latanimeAPI = require('./latanime.js')
const fuzzysort = require('fuzzysort')
const matching = require('../lib/matching.js')

/**
 * Tipical express middleware callback.
 * @callback subRequestMiddleware
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response
 * @param {function} [next] - The next middleware function in the chain, should end the response at some point
 */
/** 
 * Handles requests to /stream whether they contain extra parameters (see {@link HandleLongSubRequest} for details on this) or just the type and videoID.
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware, but the response is handled by sending an empty stream Object.
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain, can be empty because we already responded with this middleware
 */
function HandleMetaRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleMetaRequest with\x1b[39m ${req.originalUrl}`)
  const idDetails = req.params.videoId.split(':')
  const videoID = idDetails[0] //We only want the first part of the videoID, which is the IMDB ID, the rest would be the season and episode
  /*if (videoID?.startsWith("animeflv")) {
    const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    animeFLVAPI.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot AnimeFLV metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got AnimeFLV metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on AnimeFLV slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting AnimeFLV info" });
        next()
      }
    })
  } else*/ if (videoID?.startsWith("animeav1")){
    const ID = idDetails[1]
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    animeAV1API.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot AnimeAV1 metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got AnimeAV1 metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on AnimeAV1 slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting AnimeAV1 info" });
        next()
      }
    })
  } else if (videoID?.startsWith("henaojara")){
    const ID = idDetails[1]
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    henaojaraAPI.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot Henaojara metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got Henaojara metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on Henaojara slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting Henaojara info" });
        next()
      }
    })
  } else if (videoID?.startsWith("latanime")){
    const ID = idDetails[1]
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    latanimeAPI.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot LatAnime metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got LatAnime metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on LatAnime slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting LatAnime info" });
        next()
      }
    })
  } else if (videoID?.startsWith("tioanime")){
    const ID = idDetails[1]
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    tioanimeAPI.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot TioAnime metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got TioAnime metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on TioAnime slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting TioAnime info" });
        next()
      }
    })
  // } else if (videoID?.startsWith("animejara")){
  //   const ID = idDetails[1] 
  //   let season = idDetails[2] //undefined if we don't get an season number in the query, which is fine
  //   console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
  //   animejaraAPI.GetAnimeBySlug(ID, req.params.type).then((animeMeta) => {
  //     console.log('\x1b[36mGot AnimeJara metadata for:\x1b[39m', animeMeta.name)
  //     res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
  //     res.json({ meta: animeMeta, message: "Got AnimeJara metadata!" })
  //     next()
  //   }).catch((err) => {
  //     console.error('\x1b[31mFailed on AnimeJara slug search because:\x1b[39m ' + err)
  //     if (!res.headersSent) {
  //       res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
  //       res.json({ meta: {}, message: "Failed getting AnimeJara info" });
  //       next()
  //     }
  //   })
  } else if (videoID?.startsWith("jkanime")){
    const ID = idDetails[1]
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    jkanimeAPI.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot JKAnime metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got JKAnime metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on JKAnime slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting JKAnime info" });
        next()
      }
    })
  } else {
    let episode, season, animeIMDBIDPromise, aniZipID
    if (videoID?.startsWith("tt")) { //If we got an IMDB ID/TMDB ID
      const ID = videoID //We want the IMDB ID as is
      season = idDetails[1] //undefined if we don't get a season number in the query, which is fine
      episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with IMDB ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = Promise.resolve(ID)
      aniZipID = ["imdb", ID]
    } else if (videoID?.startsWith("tmdb")) {
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      season = idDetails[2] //undefined if we don't get a season number in the query, which is fine
      episode = idDetails[3] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with TMDB ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = Metadata.GetIMDBIDFromTMDBID(ID, req.params.type)
      aniZipID = ["themoviedb", ID]
    } else if (videoID.match(/^(?:kitsu|mal|anidb|anilist)$/)) { //If we got a kitsu, mal, anilist or anidb ID
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
      console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = relationsAPI.GetIMDBIDFromANIMEID(videoID, ID)
      aniZipID = [videoID, ID]
    } else {
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=31557600, stale-while-revalidate=31557600, stale-if-error=31557600")
        res.json({ meta: {}, message: "Wrong ID format, check manifest for errors" }); next()
      }
      return
    }

    console.log('Extra parameters:', res.locals.extraParams)
    //AnimeFLV used to answer these but it no longer serves videos, so find the show on the active sources.
    //Many anime have no IMDB mapping, so the romaji title (straight from the anime ID) is enough on its own
    const romajiPromise = relationsAPI.GetRomajiTitle(...aniZipID).catch((err) => console.error('\x1b[31mFailed getting romaji title:\x1b[39m ' + err))
    const titlePromise = animeIMDBIDPromise.then((imdbID) => {
      if (!imdbID || imdbID === "null") throw Error("No IMDB ID")
      return Metadata.GetTMDBMeta(imdbID).catch(() => Metadata.GetCinemetaMeta(imdbID, req.params.type))
    }).then((metadata) => metadata.title).catch((err) => console.error('\x1b[31mFailed on metadata:\x1b[39m ' + err))
    Promise.all([romajiPromise, titlePromise]).then(([romaji, title]) => {
      const searchTerms = matching.BuildSearchTerms(romaji, title, season)
      console.log('Search terms:', searchTerms)
      return relationsAPI.GetNativeMeta(searchTerms)
    }).then((animeMeta) => {
      res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
      res.json({ meta: animeMeta, message: "Got anime metadata!" })
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on metadata search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
        res.json({ meta: {}, message: "Failed getting media info" });
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
metas.get("/:config/meta/:type/:videoId.json", ParseConfig, HandleMetaRequest)
//Unconfigured requests
metas.get("/meta/:type/:videoId.json", HandleMetaRequest)

module.exports = metas;