const express = require("express")
const catalog = express.Router()

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
 * Handles requests to /catalog that contain extra parameters, we should append them to the request for future middleware, see {@link SearchParamsRegex} to see how these are handled
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, we don't end it because this function/middleware doesn't handle the full request!
 * @param {subRequestMiddleware} next - REQUIRED: The next middleware function in the chain, should end the response at some point
 */
function HandleLongCatalogRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleLongCatalogRequest with\x1b[39m ${req.originalUrl}`)
  res.locals.extraParams = SearchParamsRegex(req.params[0])
  next()
}
/** 
 * Handles requests to /catalog whether they contain extra parameters (see {@link HandleLongSubRequest} for details on this) or just the type and videoID.
 * @param req - Request sent to our router, containing all relevant info
 * @param res - Our response, note we use next() just in case we need to add middleware, but the response is handled by sending an empty catalog Object.
 * @param {subRequestMiddleware} [next] - The next middleware function in the chain, can be empty because we already responded with this middleware
 */
function HandleCatalogRequest(req, res, next) {
  console.log(`\x1b[96mEntered HandleCatalogRequest with\x1b[39m ${req.originalUrl}`)
  console.log('Extra parameters:', res.locals.extraParams)
  let catalogPromise
  if (res.locals.extraParams) {
    let genreArr = (res.locals.extraParams.genre) ? res.locals.extraParams.genre.split(',', 4) : undefined
    catalogPromise = animeFLVAPI.SearchAnimeFLV(res.locals.extraParams.search, genreArr)
  } else {
    catalogPromise = animeFLVAPI.GetAiringAnime()
  }
  catalogPromise.then((result) => {
    console.log('\x1b[36mGot AnimeFLV metadata for:\x1b[39m', result.length, "search results")
    const metas = result.map((anime) => {
      return {
        id: `animeflv:${anime.slug}`,
        type: anime.type,
        name: anime.title,
        poster: anime.poster,
        description: anime.overview,
        genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
      }
    })
    res.json({ metas, cacheMaxAge: 10800, staleRevalidate: 3600, staleError: 259200, message: "Got AnimeFLV metadata!" });
    next()
  }).catch((err) => {
    console.error('\x1b[31mFailed on animeFLV search because:\x1b[39m ' + err)
    if (!res.headersSent) {
      res.json({ metas: [], message: "Failed getting animeFLV info" });
      next()
    }
  })
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
catalog.get("/:config/catalog/:type/:videoId/*.json", ParseConfig, HandleLongCatalogRequest, HandleCatalogRequest)
catalog.get("/:config/catalog/:type/:videoId.json", ParseConfig, HandleCatalogRequest)
//Unconfigured requests
catalog.get("/catalog/:type/:videoId/*.json", HandleLongCatalogRequest, HandleCatalogRequest)
catalog.get("/catalog/:type/:videoId.json", HandleCatalogRequest)
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

module.exports = catalog;