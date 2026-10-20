const ID_RELATIONS_API_BASE = "https://relations.yuna.moe/api/v2"
const ANI_ZIP_API_BASE = "https://api.ani.zip/mappings"
const ANILIST_API_BASE = "https://graphql.anilist.co"

const matching = require("../lib/matching.js")
const animeAV1API = require("./animeav1.js")
const jkanimeAPI = require("./jkanime.js")
const tioanimeAPI = require("./tioanime.js")

//Sources whose meta can stand in for an anime ID's (AniList, MAL, AniDB...), in order of preference
const NATIVE_META_SOURCES = [
  { name: "AnimeAV1", search: (term) => animeAV1API.SearchAnimeAV1(term), meta: (slug) => animeAV1API.GetAnimeBySlug(slug) },
  { name: "JKAnime", search: (term) => jkanimeAPI.SearchJKAnime(term), meta: (slug) => jkanimeAPI.GetAnimeBySlug(slug) },
  { name: "TioAnime", search: (term) => tioanimeAPI.SearchTioAnime(term), meta: (slug) => tioanimeAPI.GetAnimeBySlug(slug) },
]

//AnimeFLV used to provide these metas, but it no longer serves videos
exports.GetNativeMeta = (searchTerms) => matching.FindNativeMeta(searchTerms, NATIVE_META_SOURCES)

//One api.ani.zip call has every ID we need for a show: IMDB (for its metadata) and AniList (for its romaji title).
//Callers that need both share the same promise, so it's only requested once
exports.GetAniZipMappings = async function (IDType, ID) {
  return fetch(`${ANI_ZIP_API_BASE}?${IDType}_id=${ID}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => {
    if (!data?.mappings) throw Error("Invalid response!")
    return data.mappings
  })
}

exports.GetIMDBIDFromANIMEID = async function (IDType, ID, mappings = exports.GetAniZipMappings(IDType, ID)) {
  return mappings.then((m) => m.imdb_id || Promise.reject(Error("No IMDB ID"))).catch(() => GetIMDBFromYunaMoe(IDType, ID))
}

async function GetIMDBFromYunaMoe(IDType, ID){
  const reqURL = `${ID_RELATIONS_API_BASE}/ids?source=${(IDType === 'mal') ? 'myanimelist' : IDType}&id=${ID}&include=imdb`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data === undefined) throw Error("Invalid response!")
    //return first result
    return data.imdb
  })
}

//Sites list anime by their romaji title, which our metadata providers (Cinemeta/TMDB) usually don't give us
//TMDB's original title is the Japanese one (e.g. 田中くんはいつもけだるげ), not the romaji the sites use
exports.GetRomajiTitle = async function (IDType, ID, mappings = exports.GetAniZipMappings(IDType, ID)) {
  return mappings.then((m) => {
    if (!m.anilist_id) throw Error("No AniList ID!")
    return fetch(ANILIST_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query: "query($id:Int){Media(id:$id){title{romaji}}}", variables: { id: m.anilist_id } })
    })
  }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => data?.data?.Media?.title?.romaji)
}
