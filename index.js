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
      "name": "AnimeFLV",
      "logo": "https://play-lh.googleusercontent.com/ZIjIwO5FJe9R1rplSd4uz54OwBxQhwDcznjljSPl2MgHaCoyF3qG6R4kRMCB40f4l2A=w256",
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
            optionsLimit: 4, isRequired: false
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
              optionsLimit: 4, isRequired: true
            },
            { name: "skip", isRequired: false }
          ]
        },
        {
          id: "animeflv|onair", type: "AnimeFLV", name: "On Air"
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
        "newEpisodeNotifications": true
      }/*,
      "behaviorHints": { "configurable": true }*/
    }
    return manifest;
  })
}

app.get("/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    //manif.behaviorHints.configurationRequired = true
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

app.get("/:config/manifest.json", (_req, res) => {
  ReadManifest().then((manif) => {
    //console.log("Params:", decodeURIComponent(req.params[0]))
    res.json(manif);
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})

/*app.get("/configure", (req, res) => {
  ReadManifest().then((manif) => {
    let base_url = req.host;
    res.render('config', {
      logged_in: false,
      base_url: base_url,
      manifest: manif
    })
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})
//WIP
app.get("/:config/configure", (req, res) => {
  ReadManifest().then((manif) => {
    let base_url = req.host;
    res.render('config', {
      logged_in: true,
      config: req.params.config,
      user: req.params.config,
      base_url: base_url,
      manifest: manif
    })
  }).catch((err) => {
    res.status(500).statusMessage("Error reading file: " + err);
  })
})*/

const streams = require("./routes/streams");
app.use(streams);

const meta = require("./routes/meta");
app.use(meta);

const catalog = require("./routes/catalog");
app.use(catalog);

app.listen(process.env.PORT || 3000, () => {
  console.log(`\x1b[32manimeflv-stremio-addon is listening on port ${process.env.PORT || 3000}\x1b[39m`)
  const animeFLVAPI = require('./routes/animeFLV.js')
  animeFLVAPI.UpdateAiringAnimeFile().then(() => {
    setInterval(animeFLVAPI.UpdateAiringAnimeFile.bind(animeFLVAPI), 86400000); //Update every 24h
  })
});
