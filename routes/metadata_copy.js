require('dotenv').config()

/** 
 * Gets auth headers for TMDB API requests
 * @return {Object} { "Authorization": `Bearer ${process.env.TMDB_API_READ_TOKEN}` }
 */
GetTMDBAuthToken = function () {
  return { "Authorization": `Bearer ${process.env.TMDB_API_READ_TOKEN}` }
}
const TMDB_API_BASE = "https://api.themoviedb.org/3"
const CINEMETA_BASE = "https://v3-cinemeta.strem.io"

class Metadata {
  /**
   * Metadata constructor
   * @param {string} imdbID 
   * @param {number} tmdbID 
   * @param {string} type 
   * @param {string} title 
   * @param {string} summary 
   * @param {(Date|string)} releaseDate 
   * @param {boolean} adult 
   */
  constructor(imdbID, tmdbID, type, title, summary, releaseDate, adult) {
    this.imdbID = imdbID, this.tmdbID = tmdbID, this.title = title, this.summary = summary, this.adult = adult;
    if (type !== undefined) this.type = type;
    if (typeof releaseDate === 'Date') { this.releaseDate = releaseDate }
    else if (typeof releaseDate === 'string') { this.releaseDate = new Date(releaseDate) }
  }
  shortPrint() {
    return `${this.title}, a ${(this.type === "tv") ? "series" : this.type} released ${this.releaseDate.toDateString()}`;
  }
  fullPrint() {
    return `${this.title}, a` + (adult !== undefined) ? "n adult" : "" +
      ` ${(this.type === "tv") ? "series" : this.type} released ${this.releaseDate.toDateString()}.\n
    Overview: ${this.summary}`;
  }
  imdbID;
  tmdbID;
  type;
  title;
  summary;
  releaseDate;
  adult;
  /**
 * Requests metadata from TMDB
 * @param {String} imdbID - IMDB item ID like "tt29623480"
 * @param {String} [lang=undefined] - optional language code for query
 * @returns {Promise<Object>} array of metadata objects or movie items
 */
  static GetTMDBMeta(imdbID, lang = undefined) {
    const reqURL = (lang === undefined) ?
      `${TMDB_API_BASE}/find/${imdbID}?external_source=imdb_id` :
      `${TMDB_API_BASE}/find/${imdbID}?external_source=imdb_id&language=${lang}`;
    const options = { headers: GetTMDBAuthToken() }
    return new Promise((resolve, reject) => {
      fetch(reqURL, options).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) reject(new Error(`HTTP error! Status: ${resp.status}`))
        if (resp === undefined) reject(new Error("Undefined response!"))
        return resp.json()
      }).then((data) => {
        if ((data === undefined)) reject(new Error("Invalid response!"))
        if (data.movie_results.length > 0) resolve(Metadata.ParseTMDBMeta(data.movie_results, imdbID))
        else if (data.tv_results.length > 0) resolve(Metadata.ParseTMDBMeta(data.tv_results, imdbID))
      }).catch(e => {
        reject(e)
      })
    })
  }
  /**
 * Requests metadata from TMDB
 * @param {String} imdbID - IMDB item ID like "tt29623480"
 * @param {String} [lang=undefined] - optional language code for query
 * @param {String} mediaType - type of media, either "movie" or "series"
 * @returns {Promise<Object>} array of metadata objects or movie items
 */
  static GetTMDBMetaFromTMDBID(tmdbID, mediaType, lang = undefined) {
    if (mediaType === "series") mediaType = "tv"
    const reqURL = (lang === undefined) ?
      `${TMDB_API_BASE}/${mediaType}/${tmdbID}` :
      `${TMDB_API_BASE}/${mediaType}/${tmdbID}?language=${lang}`;
    const options = { headers: GetTMDBAuthToken() }
    return new Promise((resolve, reject) => {
      fetch(reqURL, options).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) reject(new Error(`HTTP error! Status: ${resp.status}`))
        if (resp === undefined) reject(new Error("Undefined response!"))
        return resp.json()
      }).then((data) => {
        if ((data === undefined)) reject(new Error("Invalid response!"))
        if (mediaType === "movie") resolve(new Metadata(data.imdb_id, data.id, mediaType, data.title, data.overview, data.release_date, data.adult))
        else {
          const imdbIDPromise = (!data.imdb_id) ? this.GetIMDBIDFromTMDBID(tmdbID, mediaType) : Promise.resolve(data.imdb_id)
          imdbIDPromise.then((imdbID) => {
            resolve(new Metadata(imdbID, data.id, mediaType, data.name, data.overview, data.first_air_date, data.adult))
          })
        }
      }).catch(e => {
        reject(e)
      })
    })
  }
  static GetIMDBIDFromTMDBID(tmdbID, mediaType) {
    if (mediaType === "series") mediaType = "tv"
    const reqURL = `${TMDB_API_BASE}/${mediaType}/${tmdbID}/external_ids`
    const options = { headers: GetTMDBAuthToken() }
    return new Promise((resolve, reject) => {
      fetch(reqURL, options).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) reject(new Error(`HTTP error! Status: ${resp.status}`))
        if (resp === undefined) reject(new Error("Undefined response!"))
        return resp.json()
      }).then((data) => {
        if ((data === undefined)) reject(new Error("Invalid response!"))
        if (data.imdb_id === undefined) reject(new Error("No IMDB ID found!"))
        resolve(data.imdb_id)
      }).catch(e => {
        reject(e)
      })
    })
  }
  /**
   * Parses TMDB metadata to standardize in this app
   * @param {Array} resultsArray - movie_results array from JSON TMDB response
   * @param {String} imdbID - IMDB item ID
   * @returns {Object} Parsed and standardised metadata
   */
  static ParseTMDBMeta(resultsArray, imdbID) {
    const first_item = resultsArray[0]
    const release_date = first_item.release_date || first_item.first_air_date,
      title = first_item.title || first_item.name
    return new Metadata(imdbID, first_item.id, first_item.media_type, title, first_item.overview, release_date, first_item.adult)
  }
  /**
   * Requests metadata from the Cinemeta Stremio Addon
   * @param {String} imdbID - IMDB item ID like "tt29623480"
   * @param {String} [type=movie] - optional item type for query
   * @returns {Promise<Object>} array of metadata objects or movie items
   */
  static GetCinemetaMeta = function (imdbID, type = "movie") {
    const reqURL = `${CINEMETA_BASE}/meta/${type}/${imdbID}.json`
    return new Promise((resolve, reject) => {
      fetch(reqURL).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) reject(new Error(`HTTP error! Status: ${resp.status}`))
        if (resp === undefined) reject(new Error("Undefined response!"))
        return resp.json()
      }).then((data) => {
        if (data?.meta === undefined) reject(new Error("Invalid response!"))
        resolve(Metadata.ParseCinemetaMeta(data.meta))
      }).catch(e => {
        reject(e)
      })
    })
  }
  /**
   * Parses Cinemta metadata to standardize in this app
   * @param {Object} meta - movie_results array from JSON TMDB response
   * @returns {Object} Parsed and standardised metadata
   */
  static ParseCinemetaMeta(meta) {
    return new Metadata(meta.id, meta.moviedb_id, meta.type, meta.name, meta.description, meta.released || meta.releaseInfo)
  }
}

module.exports = Metadata;