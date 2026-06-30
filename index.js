//npm run devStart
const express = require("express")
const app = express()

//const { addonBuilder, serveHTTP, publishToCentral } = require('stremio-addon-sdk')

function setCORS(_req, res, next) {
  res.header(`Access-Control-Allow-Origin`, `*`);
  res.header(`Access-Control-Allow-Methods`, `GET,PUT,POST,DELETE`);
  res.header(`Access-Control-Allow-Headers`, `Content-Type`);
  next();
}
app.use(setCORS);

app.use(express.static('public'))
app.set('view engine', 'ejs');

const fsPromises = require("fs/promises")
function ReadManifest() {
  return fsPromises.readFile('./package.json', 'utf8').then((data) => {
    const packageJSON = JSON.parse(data);

    let manifest = {
      "id": 'com.' + packageJSON.name.replaceAll('-', '.'),
      "version": packageJSON.version,
      "name": "JKTioAnimeFLVAV1Jara",
      "logo": "https://play-lh.googleusercontent.com/ZIjIwO5FJe9R1rplSd4uz54OwBxQhwDcznjljSPl2MgHaCoyF3qG6R4kRMCB40f4l2A=w256",
      "background": "https://images6.alphacoders.com/113/1135890.jpg",
      "description": packageJSON.description,
      "catalogs": [
        {
          id: "animeflv", type: "AnimeFLV", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
              "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
              "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
              "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
              "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
              "yaoi", "yuri"],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeav1", type: "AnimeAV1", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
              "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
              "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
              "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
              "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
              "yaoi", "yuri"],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "henaojara", type: "Henaojara", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["accion", "aenime", "anime-latino", "artes-marciales", "aventura", "aventuras", "blu-ray",
              "carreras", "castellano", "ciencia-ficcion", "comedia", "comida", "cyberpunk", "demencia", "dementia",
              "demonios", "deportes", "drama", "ecchi", "escolares", "escuela", "espacial", "fantasia", "gore",
              "harem", "historia-paralela", "historico", "horror", "infantil", "josei", "juegos", "latino", "lucha",
              "magia", "mecha", "militar", "misterio", "monogatari", "musica", "parodia", "parodias", "policia",
              "psicologico", "recuentos-de-la-vida", "recuerdos-de-la-vida", "romance", "samurai", "seinen", "shojo",
              "shonen", "shoujo", "shounen", "shounen-ai", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros", "yaoi", "yuri"],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "tioanime", type: "TioAnime", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
              "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
              "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
              "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
              "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
              "yaoi", "yuri"],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animejara", type: "AnimeJara", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["Accion", "Amor", "Artes marciales", "Aventura", "Carreras", "Ciencia ficcion",
              "Comedia", "Crimen", "Demonios", "Deportes", "Drama", "Ecchi", "Escolar", "Espacial", "Espadachin",
              "Familia", "Fantasia", "Gore", "Harem", "Historico", "Isekai", "Josei", "Juegos", "Magia", "Mecha",
              "Militar", "Misterio", "Musica", "Parodia", "Psicologico", "Recuerdos", "Robots", "Romance",
              "Samurai", "Seinen", "Shoujo", "Shounen", "Sobrenatural", "Studio ghibli", "Superpoderes",
              "Suspenso", "Terror", "Vampiros", "Yaoi", "Yuri", "Zombies"
            ],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "jkanime", type: "JKAnime", name: "search results",
          extra: [{ name: "search", isRequired: true },
          {
            name: "genre",
            options: ["accion", "aventura", "autos", "comedia", "dementia", "demonios", "misterio", "drama",
              "ecchi", "fantasia", "juegos", "hentai", "historico", "terror", "nios", "magia", "artes-marciales",
              "mecha", "musica", "parodia", "samurai", "romance", "colegial", "sci-fi", "shoujo", "shoujo-ai",
              "shounen", "shounen-ai", "space", "deportes", "super-poderes", "vampiros", "yaoi", "yuri", "harem",
              "cosas-de-la-vida", "sobrenatural", "militar", "policial", "psicologico", "thriller", "seinen", "josei", "latino", "isekai"],
            optionsLimit: 1, isRequired: false
          },
          { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeflv|genres", type: "AnimeFLV", name: "AnimeFLV",
          extra: [
            {
              name: "genre",
              options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
                "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
                "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
                "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
                "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
                "yaoi", "yuri"],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeav1|genres", type: "AnimeAV1", name: "AnimeAV1",
          extra: [
            {
              name: "genre",
              options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
                "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
                "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
                "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
                "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
                "yaoi", "yuri"],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "henaojara|genres", type: "Henaojara", name: "Henaojara",
          extra: [
            {
              name: "genre",
              options: ["accion", "aenime", "anime-latino", "artes-marciales", "aventura", "aventuras", "blu-ray",
                "carreras", "castellano", "ciencia-ficcion", "comedia", "comida", "cyberpunk", "demencia", "dementia",
                "demonios", "deportes", "drama", "ecchi", "escolares", "escuela", "espacial", "fantasia", "gore",
                "harem", "historia-paralela", "historico", "horror", "infantil", "josei", "juegos", "latino", "lucha",
                "magia", "mecha", "militar", "misterio", "monogatari", "musica", "parodia", "parodias", "policia",
                "psicologico", "recuentos-de-la-vida", "recuerdos-de-la-vida", "romance", "samurai", "seinen", "shojo",
                "shonen", "shoujo", "shounen", "shounen-ai", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros", "yaoi", "yuri"],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "tioanime|genres", type: "TioAnime", name: "TioAnime",
          extra: [
            {
              name: "genre",
              options: ["accion", "artes-marciales", "aventura", "carreras", "ciencia-ficcion", "comedia",
                "demencia", "demonios", "deportes", "drama", "ecchi", "escolares", "espacial", "fantasia",
                "harem", "historico", "infantil", "josei", "juegos", "magia", "mecha", "militar", "misterio",
                "musica", "parodia", "policia", "psicologico", "recuentos-de-la-vida", "romance", "samurai",
                "seinen", "shoujo", "shounen", "sobrenatural", "superpoderes", "suspenso", "terror", "vampiros",
                "yaoi", "yuri"],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animejara|genres", type: "AnimeJara", name: "AnimeJara",
          extra: [
            {
              name: "genre",
              options: ["Accion", "Amor", "Artes marciales", "Aventura", "Carreras", "Ciencia ficcion",
                "Comedia", "Crimen", "Demonios", "Deportes", "Drama", "Ecchi", "Escolar", "Espacial", "Espadachin",
                "Familia", "Fantasia", "Gore", "Harem", "Historico", "Isekai", "Josei", "Juegos", "Magia", "Mecha",
                "Militar", "Misterio", "Musica", "Parodia", "Psicologico", "Recuerdos", "Robots", "Romance",
                "Samurai", "Seinen", "Shoujo", "Shounen", "Sobrenatural", "Studio ghibli", "Superpoderes",
                "Suspenso", "Terror", "Vampiros", "Yaoi", "Yuri", "Zombies"
              ],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "jkanime|genres", type: "JKAnime", name: "JKAnime",
          extra: [
            {
              name: "genre",
              options: ["accion", "aventura", "autos", "comedia", "dementia", "demonios", "misterio", "drama",
                "ecchi", "fantasia", "juegos", "hentai", "historico", "terror", "nios", "magia", "artes-marciales",
                "mecha", "musica", "parodia", "samurai", "romance", "colegial", "sci-fi", "shoujo", "shoujo-ai",
                "shounen", "shounen-ai", "space", "deportes", "super-poderes", "vampiros", "yaoi", "yuri", "harem",
                "cosas-de-la-vida", "sobrenatural", "militar", "policial", "psicologico", "thriller", "seinen", "josei", "latino", "isekai"],
              optionsLimit: 1, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeflv|onair", type: "AnimeFLV", name: "On Air"
        },
        {
          id: "animeav1|onair", type: "AnimeAV1", name: "On Air"
        },
        {
          id: "henaojara|onair", type: "Henaojara", name: "On Air"
        },
        {
          id: "tioanime|onair", type: "TioAnime", name: "On Air"
        },
        {
          id: "animejara|onair", type: "AnimeJara", name: "On Air"
        },
        {
          id: "jkanime|onair", type: "JKAnime", name: "On Air"
        },
        {
          type: "series",
          id: "calendar-videos",
          extra: [
            {
              name: "calendarVideosIds",
              isRequired: true,
              optionsLimit: 15
            }
          ],
          extraSupported: [
            "calendarVideosIds"
          ],
          extraRequired: [
            "calendarVideosIds"
          ],
          name: "Calendar videos"
        }
      ],
      "resources": [
        "stream",
        "meta",
        "catalog"
      ],
      "types": [
        "movie",
        "series",
        "anime",
        "other"
      ],
      "idPrefixes": [
        "tt",
        "animeflv:",
        "animeav1:",
        "henaojara:",
        "tioanime:",
        "animejara:",
        "jkanime:",
        "tmdb:",
        "anilist:",
        "kitsu:",
        "mal:",
        "anidb:"
      ],
      "stremioAddonsConfig": {
        "issuer": "https://stremio-addons.net",
        "signature": "eyJhbGciOiJkaXIiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2In0..0XN39hJS4zjNV5ES2brUeQ.sjRgcAHGPIUA0GXXbZI2BZLuKUOiT3jfI8ALp-QlUcWNuW_9qcVjARUxKCE6ncTE1rdK9yCma3IlgdCbI8-3ZV1E5WsKdS3LncHDeqlXThTZ9V7Znc1rATu7kJE_NDxE.Y8gIKpiHqAVypGGOvEXVqw"
      },
      "behaviorHints": {
        "configurable": true,
        "newEpisodeNotifications": true
      }
    }
    return manifest;
  })
}

app.get("/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    manif.catalogs = manif.catalogs.filter((cat) => {
      return (!cat.id.includes("onair")) ? true : false
    })
    res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

app.get("/:config/manifest.json", (req, res) => {
  ReadManifest().then((manif) => {
    const config = new URLSearchParams(decodeURIComponent(req.params.config))
    let providers = config?.get("onAirCatalogs")?.split(',')
    manif.catalogs = manif.catalogs.filter((cat) => {
      if (!cat.id.includes("onair")) return true
      else return providers.some((prov) => cat.id.startsWith(prov))
    })
    res.header('Cache-Control', "max-age=86400, stale-while-revalidate=86400, stale-if-error=259200")
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

app.get("/configure", (req, res) => {
  ReadManifest().then((manif) => {
    res.render('config', {
      config: undefined,
      manifest: manif
    })
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})
//WIP
app.get("/:config/configure", (req, res) => {
  ReadManifest().then((manif) => {
    res.render('config', {
      config: new URLSearchParams(decodeURIComponent(req.params.config)),
      manifest: manif
    })
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

const streams = require("./routes/streams");
app.use(streams);

const meta = require("./routes/meta");
app.use(meta);

const catalog = require("./routes/catalog");
app.use(catalog);

app.listen(process.env.PORT || 3000, () => {
  console.log(`\x1b[32manimeflv-stremio-addon is listening on port ${process.env.PORT || 3000}\x1b[39m`)
  if (process.argv.includes('--launch')) {
    const OSC = '\u001B]';
    const BEL = '\u0007';
    const url = `${OSC}8;;stremio://127.0.0.1:${process.env.PORT || 3000}/manifest.json${BEL}Open this link to install the running addon on the Stremio app${OSC}8;;${BEL}`
    console.log(url)
  } else if (process.argv.includes('--webLaunch')) {
    const url = `http://127.0.0.1:${process.env.PORT || 3000}/manifest.json`
    console.log('Open the following for a developement web Stremio session:', `https://staging.strem.io#?addonOpen=${encodeURIComponent(url)}`)
  }
  const animeFLVAPI = require('./routes/animeFLV.js')
  const animeAV1API = require('./routes/animeav1.js')
  const henaojaraAPI = require('./routes/henaojara.js')
  const tioanimeAPI = require('./routes/tioanime.js')
  const animejaraAPI = require('./routes/animejara.js')
  const jkanimeAPI = require('./routes/jkanime.js')
  let imports = [animeFLVAPI, animeAV1API, tioanimeAPI, henaojaraAPI, animejaraAPI, jkanimeAPI]
  imports.forEach((api) => {
    api.UpdateAiringAnimeFile().then(() => {
      setInterval(api.UpdateAiringAnimeFile.bind(api), 86400000); //Update every 24h
    })
  })
});
