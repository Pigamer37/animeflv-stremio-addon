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
      "name": "AnimeFLV Stremio Addon",
      "logo": "https://www3.animeflv.net/favicon.ico",
      "description": packageJSON.description,
      "catalogs": [],
      "resources": [
        "stream"
      ],
      "types": [
        "movie",
        "series",
        "anime",
        "other"
      ],
      "idPrefixes": [
        "tt",
        "tmdb",
        "anilist",
        "kitsu",
        "mal",
        "anidb"
      ]/*,
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

app.listen(process.env.PORT || 3000, () => {
  console.log(`\x1b[32manimeflv-stremio-addon is listening on port ${process.env.PORT || 3000}\x1b[39m`)
});
