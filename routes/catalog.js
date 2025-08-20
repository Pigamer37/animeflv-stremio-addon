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
    //calculate the page to start from, AnimeFLV uses 24 results per page
    //if skip is defined, we can calculate the page and the number of items we already delivered
    let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 24) + 1 : undefined,
      gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 24 : undefined
    console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
    catalogPromise = animeFLVAPI.SearchAnimeFLV(res.locals.extraParams.search, genreArr, undefined, page, gottenItems)
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
    res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200");
    res.json({ metas, message: "Got AnimeFLV metadata!" });
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
//Calendar requests
catalog.get("/catalog/series/calendar-videos/:calendarVideosIds(calendarVideosIds=(?:\\S{0,},?){0,}).json", (req, res) => {
  console.log("Entered catalog request with", req.params.calendarVideosIds)
  console.log("IDvector", req.params.calendarVideosIds.slice(18).split(','))
  console.log("FilteredVector", req.params.calendarVideosIds.slice(18).split(',')//filter idPrefixes not covered by other meta providers
    .filter((id) => id.startsWith("animeflv:") || id.startsWith("anilist:") || id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anidb:")))
  let metasDetailed = [], uniqueIDs = [...new Set(req.params.calendarVideosIds.slice(18).split(',')//filter idPrefixes not covered by other meta providers
    .filter((id) => id.startsWith("animeflv:") || id.startsWith("anilist:") || id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anidb:")))]

  console.log("Unique IDs:", uniqueIDs)

  Promise.allSettled(uniqueIDs.map((item) => {
    const idDetails = item.split(':')
    const videoID = idDetails[0]
    if (videoID.startsWith("animeflv")) {
      const ID = idDetails[1]
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      return animeFLVAPI.GetAnimeBySlug(ID)
    } else {
      let animeIMDBIDPromise
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = relationsAPI.GetIMDBIDFromANIMEID(videoID, ID)
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
        })
      }).then((metadata) => {
        const searchTerm = ((season) && (parseInt(season) !== 1)) ? `${metadata.title} ${season}` : metadata.title
        return animeFLVAPI.SearchAnimeFLV(searchTerm).then((animeFLVitem) => {
          console.log('\x1b[36mGot AnimeFLV entry:\x1b[39m', animeFLVitem[0].title)
          return animeFLVAPI.GetAnimeBySlug(animeFLVitem[0].slug)
        })
      })
    }
  })).then((promises) => {
    console.log("Promises allSettled")
    metasDetailed = promises.filter((prom) => (prom.value)).map((el) => {
      el.value.videos = el.value.videos.filter((video) => (video.released >= new Date()))//only resolve future videos
      return el.value
    })

    if (!res.headersSent) {
      res.header('Cache-Control', "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200")
      res.json({ metasDetailed })
    }
  })
})
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