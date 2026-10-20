const ID_RELATIONS_API_BASE = "https://relations.yuna.moe/api/v2"
const ANI_ZIP_API_BASE = "https://api.ani.zip/mappings"
const ANILIST_API_BASE = "https://graphql.anilist.co"

exports.GetIMDBIDFromANIMEID = async function (IDType, ID) {
  return GetIMDBFromYunaMoe(IDType, ID).catch(()=>GetIMDBIDFromAniZip(IDType, ID))
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

async function GetIMDBIDFromAniZip(IDType, ID){
  //get anilist ID from any supported anime-like ID (kitsu, mal, anidb)
  const reqURL = `${ANI_ZIP_API_BASE}?${IDType}_id=${ID}`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).then((data) => {
    if (data === undefined) throw Error("Invalid response!")
    //return first result
    return data.mappings?.imdb_id
  })
}
//Sites list anime by their romaji title, which our metadata providers (Cinemeta/TMDB) usually don't give us
exports.GetRomajiTitle = async function (IDType, ID) {
  return fetch(`${ANI_ZIP_API_BASE}?${IDType}_id=${ID}`).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => {
    if (!data?.mappings?.anilist_id) throw Error("No AniList ID!")
    return fetch(ANILIST_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query: "query($id:Int){Media(id:$id){title{romaji}}}", variables: { id: data.mappings.anilist_id } })
    })
  }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => data?.data?.Media?.title?.romaji)
}
