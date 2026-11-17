const ID_RELATIONS_API_BASE = "https://relations.yuna.moe/api/v2"
const ANI_ZIP_API_BASE = "https://api.ani.zip/mappings"
const ANILIST_API_BASE = "https://graphql.anilist.co"
const KITSU_API_BASE = "https://kitsu.app/api/edge"
const titleCache = new Map()

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

//Sites list anime by their romaji title. TMDB's original title is the Japanese one (e.g. 田中くんはいつもけだるげ) and
//Cinemeta's is the English one, so it comes from AniList, or from Kitsu when AniList fails (its API answered 403
//"temporarily disabled due to severe stability issues" in October 2026). ani.zip's mappings have both IDs
exports.GetRomajiTitle = async function (IDType, ID, mappings = exports.GetAniZipMappings(IDType, ID)) {
  const titles = await exports.GetTitleCandidates(IDType, ID, mappings)
  if (!titles[0]) throw Error("No title found!")
  return titles[0]
}

exports.GetTitleCandidates = async function (IDType, ID, mappings) {
  const cacheKey = `${IDType}:${ID}`
  if (titleCache.has(cacheKey)) return titleCache.get(cacheKey)

  let anilistID = (IDType === "anilist") ? ID : undefined
  let kitsuID = (IDType === "kitsu") ? ID : undefined

  try {
    const resolved = await (mappings || exports.GetAniZipMappings(IDType, ID))
    anilistID ||= resolved?.anilist_id
    kitsuID ||= resolved?.kitsu_id
  } catch (err) {
    console.error('\x1b[31mFailed getting ID mappings, using direct title lookup:\x1b[39m ' + err)
  }

  try {
    const titles = await GetAniListTitles(anilistID, (IDType === "mal") ? ID : undefined)
    titleCache.set(cacheKey, titles)
    return titles
  } catch (err) {
    console.error('\x1b[31mNo AniList titles, trying Kitsu:\x1b[39m ' + err)
    const titles = await GetKitsuTitles(kitsuID)
    titleCache.set(cacheKey, titles)
    return titles
  }
}

async function GetAniListTitles(anilistID, malID) {
  if (!anilistID && !malID) throw Error("No AniList or MAL ID!")
  return fetch(ANILIST_API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      query: "query($id:Int,$idMal:Int){Media(id:$id,idMal:$idMal,type:ANIME){title{romaji english native}synonyms}}",
      variables: { id: anilistID ? parseInt(anilistID) : undefined, idMal: malID ? parseInt(malID) : undefined }
    })
  }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => {
    const media = data?.data?.Media
    const titles = [...new Set([media?.title?.romaji, media?.title?.english, media?.title?.native, ...(media?.synonyms || [])].filter(Boolean))]
    if (!titles.length) throw Error("No AniList titles!")
    return titles
  })
}

//Kitsu's en_jp title is the romaji one ("Shingeki no Kyojin"); its canonicalTitle can be the English one
async function GetKitsuTitles(kitsuID) {
  if (!kitsuID) throw Error("No Kitsu ID!")
  return fetch(`${KITSU_API_BASE}/anime/${kitsuID}`, { headers: { "Accept": "application/vnd.api+json" } }).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    return resp.json()
  }).then((data) => {
    const attributes = data?.data?.attributes
    const titles = [...new Set([attributes?.titles?.en_jp, attributes?.canonicalTitle, ...Object.values(attributes?.titles || {})].filter(Boolean))]
    if (!titles.length) throw Error("No Kitsu titles!")
    return titles
  })
}
