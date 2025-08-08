const ID_RELATIONS_API_BASE = "https://relations.yuna.moe/api/v2"

exports.GetIMDBIDFromANIMEID = async function (IDType, ID) {
  //get anilist ID from any supported anime-like ID (kitsu, mal, anidb)
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