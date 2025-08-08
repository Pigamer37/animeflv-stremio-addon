const express = require("express")
const metas = express.Router()

require('dotenv').config()//process.env.var

const Metadata = require('./metadata_copy.js')
const relationsAPI = require('./relations.js')
const animeFLVAPI = require('./animeFLV.js')

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
  if (videoID?.startsWith("animeflv")) {
    const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
    let episode = idDetails[2] //undefined if we don't get an episode number in the query, which is fine
    console.log(`\x1b[33mGot a ${req.params.type} with ${videoID} ID:\x1b[39m ${ID}`)
    animeFLVAPI.GetAnimeBySlug(ID).then((animeMeta) => {
      console.log('\x1b[36mGot AnimeFLV metadata for:\x1b[39m', animeMeta.name)
      res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
      res.json({ meta: animeMeta, message: "Got AnimeFLV metadata!" });
      next()
    }).catch((err) => {
      console.error('\x1b[31mFailed on animeFLV slug search because:\x1b[39m ' + err)
      if (!res.headersSent) {
        res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
        res.json({ meta: {}, message: "Failed getting animeFLV info" });
        next()
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
        res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200")
        res.json({ meta: {}, message: "Wrong ID format, check manifest for errors" }); next()
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
          res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200")
          res.json({ meta: {}, message: "Failed getting media info" })
          next()
        }
        throw err //We throw the error so we can catch it later
      })
    }).then((metadata) => {
      const searchTerm = ((season) && (parseInt(season) !== 1)) ? `${metadata.title} ${season}` : metadata.title
      animeFLVAPI.SearchAnimeFLV(searchTerm).then((animeFLVitem) => {
        console.log('\x1b[36mGot AnimeFLV entry:\x1b[39m', animeFLVitem[0].title)
        return animeFLVAPI.GetAnimeBySlug(animeFLVitem[0].slug).then((animeMeta) => {
          console.log('\x1b[36mGot AnimeFLV metadata for:\x1b[39m', animeMeta.name)
          res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
          res.json({ meta: animeMeta, message: "Got AnimeFLV metadata!" });
          next()
        })
      }).catch((err) => {
        if (err.message == "No search results!" && !res.headersSent) {
          res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200")
          res.json({ meta: {}, message: "No search results!" })
          next()
        }
        console.error('\x1b[31mFailed on animeFLV search because:\x1b[39m ' + err)
        if (!res.headersSent) {
          res.json({ meta: {}, message: "Failed getting animeFLV info" });
          next()
        }
      })
    }).catch((err) => {
      console.error('\x1b[31mFailed on metadata search because:\x1b[39m ' + err)
      if (!res.headersSent && err.message !== "Got an AnimeFLV ID/slug") {
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