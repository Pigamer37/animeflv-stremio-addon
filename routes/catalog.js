const express = require("express")
const catalog = express.Router()

require('dotenv').config()//process.env.var

const Metadata = require('./metadata_copy.js')
const relationsAPI = require('./relations.js')
const CLIENT_CACHE = require('../lib/clientCache.js')
const animeFLVAPI = require('./animeFLV.js')
const animeAV1API = require('./animeav1.js')
const henaojaraAPI = require('./henaojara.js')
const tioanimeAPI = require('./tioanime.js')
const animejaraAPI = require('./animejara.js')
const jkanimeAPI = require('./jkanime.js')
const latanimeAPI = require('./latanime.js')

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
  if (req.params.videoId.startsWith("animeflv")) {
    if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
      const genreArr = res.locals.extraParams.genre
      const page = res.locals.extraParams.skip ? Math.floor(res.locals.extraParams.skip / 24) + 1 : undefined
      const gottenItems = res.locals.extraParams.skip ? res.locals.extraParams.skip % 24 : undefined
      catalogPromise = animeFLVAPI.SearchAnimeFLV(res.locals.extraParams.search, genreArr, undefined, page, gottenItems).then((result) => {
        return result.map((anime) => ({
          id: `animeflv:${anime.slug}`,
          type: anime.type,
          name: anime.title,
          poster: anime.poster,
          description: anime.overview,
          genres: anime.genres
        }))
      })
    } else {
      catalogPromise = animeFLVAPI.GetAiringAnime().then((result) => result.map((anime) => ({
        id: `animeflv:${anime.slug}`,
        type: anime.type,
        name: anime.title,
        poster: anime.poster,
        description: anime.overview,
        genres: anime.genres
      })))
    }
  } else if (req.params.videoId.startsWith("animeav1")) {
    //animeAV1 catalog request
    if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
      let genreArr = res.locals.extraParams.genre
      //calculate the page to start from, AnimeFLV uses 24 results per page
      //if skip is defined, we can calculate the page and the number of items we already delivered
      let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 20) + 1 : undefined,
        gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 20 : undefined
      console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
      catalogPromise = animeAV1API.SearchAnimeAV1(res.locals.extraParams.search, undefined, genreArr, undefined, page, gottenItems).then((result) => {
        console.log('\x1b[36mGot AnimeAV1 metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `animeav1:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    } else {
      catalogPromise = animeAV1API.GetAiringAnime().then((result) => {
        console.log('\x1b[36mGot AnimeAV1 metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `animeav1:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    }
  } else if (req.params.videoId.startsWith("henaojara")) {
    //henaojara catalog request
    if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
      let genreArr = res.locals.extraParams.genre
      //calculate the page to start from, Henaojara uses 24 results per page
      //if skip is defined, we can calculate the page and the number of items we already delivered
      let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 24) + 1 : undefined,
        gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 24 : undefined
      console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
      catalogPromise = henaojaraAPI.SearchHenaojara(res.locals.extraParams.search, genreArr, undefined, page, gottenItems).then((result) => {
        console.log('\x1b[36mGot Henaojara metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `henaojara:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    } else {
      catalogPromise = henaojaraAPI.GetAiringAnime().then((result) => {
        console.log('\x1b[36mGot Henaojara metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `henaojara:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    }
  } else if (req.params.videoId.startsWith("tioanime")) {
    //tioanime catalog request
    if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
      let genreArr = res.locals.extraParams.genre
      //calculate the page to start from, TioAnime uses 20 results per page
      //if skip is defined, we can calculate the page and the number of items we already delivered
      let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 20) + 1 : undefined,
        gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 20 : undefined
      console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
      catalogPromise = tioanimeAPI.SearchTioAnime(res.locals.extraParams.search, undefined, genreArr, undefined, page, gottenItems).then((result) => {
        console.log('\x1b[36mGot TioAnime metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `tioanime:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    } else {
      catalogPromise = tioanimeAPI.GetAiringAnime().then((result) => {
        console.log('\x1b[36mGot TioAnime metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `tioanime:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    }
  // } else if (req.params.videoId.startsWith("animejara")) {
  //   //animejara catalog request
  //   if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
  //     let genreArr = res.locals.extraParams.genre
  //     //calculate the page to start from, TioAnime uses 20 results per page
  //     //if skip is defined, we can calculate the page and the number of items we already delivered
  //     let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 20) + 1 : undefined,
  //       gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 20 : undefined
  //     console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
  //     catalogPromise = animejaraAPI.SearchAnimeJara(res.locals.extraParams.search, undefined, genreArr, undefined, page, gottenItems).then((result) => {
  //       console.log('\x1b[36mGot AnimeJara metadata for:\x1b[39m', result.length, "search results")
  //       return result.map((anime) => {
  //         return {
  //           id: `animejara:${anime.slug}`,
  //           type: anime.type,
  //           name: anime.title,
  //           poster: anime.poster,
  //           description: anime.overview,
  //           genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
  //         }
  //       })
  //     })
  //   } else {
  //     catalogPromise = animejaraAPI.GetAiringAnime().then((result) => {
  //       console.log('\x1b[36mGot AnimeJara metadata for:\x1b[39m', result.length, "search results")
  //       return result.map((anime) => {
  //         return {
  //           id: `animejara:${anime.slug}`,
  //           type: anime.type,
  //           name: anime.title,
  //           poster: anime.poster,
  //           description: anime.overview,
  //           genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
  //         }
  //       })
  //     })
  //   }
  } else if (req.params.videoId.startsWith("latanime")) {
    //latanime catalog request
    if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
      let genreArr = res.locals.extraParams.genre
      //calculate the page to start from, Latanime uses 30 results per page
      //if skip is defined, we can calculate the page and the number of items we already delivered
      let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 30) + 1 : undefined,
        gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 30 : undefined
      console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
      catalogPromise = latanimeAPI.SearchLatanime(res.locals.extraParams.search, undefined, genreArr, undefined, page, gottenItems).then((result) => {
        console.log('\x1b[36mGot Latanime metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `latanime:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    } else {
      catalogPromise = latanimeAPI.GetAiringAnime().then((result) => {
        console.log('\x1b[36mGot Latanime metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `latanime:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    }
  } else if (req.params.videoId.startsWith("jkanime")) {
    //jkanime catalog request
    if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
      let genreArr = res.locals.extraParams.genre
      //calculate the page to start from, JKAnime uses 30 results per page
      //if skip is defined, we can calculate the page and the number of items we already delivered
      let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 30) + 1 : undefined,
        gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 30 : undefined
      console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
      catalogPromise = jkanimeAPI.SearchJKAnime(res.locals.extraParams.search, undefined, genreArr, undefined, page, gottenItems).then((result) => {
        console.log('\x1b[36mGot JKAnime metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `jkanime:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    } else {
      catalogPromise = jkanimeAPI.GetAiringAnime().then((result) => {
        console.log('\x1b[36mGot JKAnime metadata for:\x1b[39m', result.length, "search results")
        return result.map((anime) => {
          return {
            id: `jkanime:${anime.slug}`,
            type: anime.type,
            name: anime.title,
            poster: anime.poster,
            description: anime.overview,
            genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
          }
        })
      })
    }
  }// else {
  //   if (res.locals.extraParams && !req.params.videoId.includes("onair")) {
  //     let genreArr = res.locals.extraParams.genre
  //     //calculate the page to start from, AnimeFLV uses 24 results per page
  //     //if skip is defined, we can calculate the page and the number of items we already delivered
  //     let page = (res.locals.extraParams.skip) ? Math.floor(res.locals.extraParams.skip / 24) + 1 : undefined,
  //       gottenItems = (res.locals.extraParams.skip) ? res.locals.extraParams.skip % 24 : undefined
  //     console.log("Skipping to page:", page, "with", gottenItems, "items already delivered")
  //     catalogPromise = animeFLVAPI.SearchAnimeFLV(res.locals.extraParams.search, genreArr, undefined, page, gottenItems).then((result) => {
  //       console.log('\x1b[36mGot AnimeFLV metadata for:\x1b[39m', result.length, "search results")
  //       return result.map((anime) => {
  //         return {
  //           id: `animeflv:${anime.slug}`,
  //           type: anime.type,
  //           name: anime.title,
  //           poster: anime.poster,
  //           description: anime.overview,
  //           genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
  //         }
  //       })
  //     })
  //   } else {
  //     catalogPromise = animeFLVAPI.GetAiringAnime().then((result) => {
  //       console.log('\x1b[36mGot AnimeFLV metadata for:\x1b[39m', result.length, "search results")
  //       return result.map((anime) => {
  //         return {
  //           id: `animeflv:${anime.slug}`,
  //           type: anime.type,
  //           name: anime.title,
  //           poster: anime.poster,
  //           description: anime.overview,
  //           genres: (anime.genres) ? anime.genres.map((el) => el.slice(0, 1).toUpperCase() + el.slice(1)) : undefined
  //         }
  //       })
  //     })
  //   }
  // }
  if (!catalogPromise) catalogPromise = Promise.reject(Error(`Unknown catalog ${req.params.videoId}`)) //e.g. disabled sources' catalogs requested by old installs
  catalogPromise.then((metas) => {
    res.header('Cache-Control', CLIENT_CACHE.catalog)
    res.json({ metas, message: "Got Anime metadata!" });
    next()
  }).catch((err) => {
    console.error('\x1b[31mFailed on search because:\x1b[39m ' + err)
    if (!res.headersSent) {
      res.header('Cache-Control', CLIENT_CACHE.failure)
      res.json({ metas: [], message: "Failed getting info" });
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
function HandleCalendarRequest(req, res) {
  let metasDetailed = [], uniqueIDs = [...new Set(req.params.calendarVideosIds.slice(18).split(',')//filter idPrefixes not covered by other meta providers
    .filter((id) => id.startsWith("animeflv:") /*|| id.startsWith("animeav1:") || id.startsWith("henaojara:")*/ || id.startsWith("tioanime:") || id.startsWith("animejara:") /*|| id.startsWith("jkanime:")*/ || id.startsWith("anilist:") || id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anidb:")))]

  console.log("Unique IDs:", uniqueIDs)

  Promise.allSettled(uniqueIDs.map((item) => {
    const idDetails = item.split(':')
    const videoID = idDetails[0]
    if (videoID.startsWith("animeflv")) {
      const ID = idDetails[1]
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      return animeFLVAPI.GetAnimeBySlug(ID)
    } else if (videoID.startsWith("animeav1")) {
      const ID = idDetails[1]
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      return animeAV1API.GetAnimeBySlug(ID)
    } else if (videoID.startsWith("henaojara")) {
      const ID = idDetails[1]
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      return henaojaraAPI.GetAnimeBySlug(ID)
    } else if (videoID.startsWith("tioanime")) {
      const ID = idDetails[1]
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      return tioanimeAPI.GetAnimeBySlug(ID)
    // } else if (videoID.startsWith("animejara")) {
    //   const ID = idDetails[1]
    //   console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
    //   return animejaraAPI.GetAnimeBySlug(ID, "series") //only series have upcoming eps
    } else if (videoID.startsWith("jkanime")) {
      const ID = idDetails[1]
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      return jkanimeAPI.GetAnimeBySlug(ID) //only series have upcoming eps
    } else {
      let animeIMDBIDPromise
      const ID = idDetails[1] //We want the second part of the videoID, which is the kitsu ID
      const season = undefined //calendar IDs (kitsu:, mal:...) carry no season; reading an undeclared one threw a ReferenceError
      console.log(`\x1b[33mGot ${videoID} ID:\x1b[39m ${ID}`)
      animeIMDBIDPromise = relationsAPI.GetIMDBIDFromANIMEID(videoID, ID)
      return animeIMDBIDPromise.then((imdbID) => { //returned, so a failure is just a missing item instead of an unhandled rejection
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
        const searchTerm = ((season !== undefined) && (season) && (parseInt(season) !== 1)) ? `${metadata.title} ${season}` : metadata.title
        return animeFLVAPI.SearchAnimeFLV(searchTerm).then((animeFLVitem) => {
          console.log('\x1b[36mGot AnimeFLV entry:\x1b[39m', animeFLVitem[0].title)
          return animeFLVAPI.GetAnimeBySlug(animeFLVitem[0].slug)
        })
      })
    }
  })).then((promises) => {
    console.log("Promises allSettled")
    metasDetailed = promises.filter((prom) => (prom.value)).map((el) => {
      //only upcoming videos; sites without real dates get estimated ones ("today" for the latest episode), so use the flag
      el.value.videos = el.value.videos.filter((video) => video.available === false)
      return el.value
    })

    if (!res.headersSent) {
      res.header('Cache-Control', CLIENT_CACHE.meta)
      res.json({ metasDetailed })
    }
  })
}
//Configured requests
//Calendar requests, configured or not (before the generic routes, which would take them as a normal catalog)
catalog.get("/catalog/series/calendar-videos/:calendarVideosIds(calendarVideosIds=(?:\\S{0,},?){0,}).json", HandleCalendarRequest)
catalog.get("/:config/catalog/series/calendar-videos/:calendarVideosIds(calendarVideosIds=(?:\\S{0,},?){0,}).json", ParseConfig, HandleCalendarRequest)
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
    //if multiple genres get selected, they get requested like &genre=blah&genre=blahblah
    //rn we only get one because Stremio doesn't handle multiple genres right in the UI smh
    let genreArr = []
    const keyVals = extraParams.split('&')
    for (let keyVal of keyVals) {
      const keyValArr = keyVal.split('=')
      const param = keyValArr[0], val = keyValArr[1]
      if (param === "genre")
        genreArr.push(val)
      else paramMap.set(param, val)
    }
    const paramJSON = Object.fromEntries(paramMap)
    paramJSON.genre = genreArr
    //console.log(paramJSON)
    return paramJSON
  } else return {}
}

module.exports = catalog;