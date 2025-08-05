# [AnimeFLV Stremio addon](https://animeflv-stremio-addon.vercel.app/manifest.json)
<p align="center"><img src="https://play-lh.googleusercontent.com/ZIjIwO5FJe9R1rplSd4uz54OwBxQhwDcznjljSPl2MgHaCoyF3qG6R4kRMCB40f4l2A=w256" alt="AnimeFLV logo" height="256"/></p>

Node.js addon to add AnimeFLV functionallity to Stremio, not affiliated with AnimeFLV. (I'm new to backend so I'm using it as a learning experience).

## Normal use:
### Install by copying <stremio://animeflv-stremio-addon.vercel.app/manifest.json> on your browser or paste <https://animeflv-stremio-addon.vercel.app/manifest.json> on the stremio addons search bar
This addon provides metadata and streaming options from AnimeFLV. It offers a catalog with airing anime on the homepage, and a searchable catalog of all AnimeFLV. Additionally, when you open an item on Stremio that matches some parameters set in the manifest (generated on [`index.js`](index.js)), or whenever you start watching something, the platform will call this addon. When the program can get the data for the item you are about to watch, some metadata will be provided and/or streaming options will appear as "AnimeFLV - ..." (the ones marked as external just open the link on your browser, working on getting sources to be watchable directly on Stremio).

> [!TIP]
> ### Recommendations:
> 1. Right now, the metadata provided by Cinemeta (the default meta and catalog addon), the TMDB meta addon or the Anime kitsu addon is much richer and works well with other addons, as they just use IMDB ID's, TMDB ID's or kitsu ID's respectively to provide and identify content. This addon should work with items provided in these catalogs, so you can get AnimeFLV's streams/sources while getting **their** metadata.
> 2. Learning japanese? I have a [Japanese subtitle addon](https://github.com/Pigamer37/buta-no-subs-stremio-addon), and there's also the [Strelingo Addon](https://github.com/Serkali-sudo), which lets you **see two subtitle languages at the same time** (English and Japanese, for example), and uses the former as a provider for Japanese subs.

## Tips are welcome:
If you like the addon and would like to thank me monetarily, you can do so through ko-fi. Thank you!\
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/M4M219PJVI)

## Endpoints:
Here's the path to call it (parameters are marked by being enclosed in {} and described below):
```
/{resource}/{type}/{ID}.json
```
Parameters
1. `resource`: stream and meta are very self explanatory, and catalog exposes a list of airing anime. When using catalog as a resource, you can also do `/catalog/{type}/{ID}/search={quey}.json` where `query` is what to search for on AnimeFLV and return it as a catalog (making it searchable on Stremio)
2. `type`: should not matter, but to make sure, use 'movie' or 'series' depending on what the item is
3. `ID`: Except for IMDB, different seasons have different ID's. Here we have some options:
   - `AnimeFLV ID`: starts with "animeflv:", followed by the series AnimeFLV slug, always. This is the "native" ID type and the one the catalogs the addon offers use. You can specify an episode number if you want. Example: `animeflv:kono-subarashii-sekai-ni-shukufuku-wo:2` *should* give results for Konosuba Season 1 Episode 2
   - `IMDB ID`: starts with "tt", followed by a number, always. If you are looking for a series, you can specify the season and episode numbers. Example: `tt5370118:1:2` *should* give results for Konosuba Season 1 Episode 2
   - `TMDB ID`: starts with "tmdb:", followed by a number, always. You can specify a season and episode number if you want. Example: `tmdb:65844:1:2` *should* give results for Konosuba Season 1 Episode 2
   - `kitsu ID`: starts with "kitsu:", followed by a number, always. You can specify an episode number if you want. Example: `kitsu:10941:2` *should* give results for Konosuba (Season 1 was specified with the kitsu ID) Episode 2
   - `AniList ID`: starts with "anilist:", followed by a number, always. You can specify an episode number if you want. Example: `anilist:21202:2` *should* give results for Konosuba (Season 1 was specified with the AniList ID) Episode 2
   - `MyAnimeList ID`: starts with "mal:", followed by a number, always. You can specify an episode number if you want. Example: `mal:30831:2` *should* give results for Konosuba (Season 1 was specified with the AniList ID) Episode 2
   - `aniDB ID`: starts with "anidb:", followed by a number, always. You can specify an episode number if you want. Example: `anidb:11261:2` *should* give results for Konosuba (Season 1 was specified with the AniList ID) Episode 2

## Run locally:
> [!IMPORTANT]
> 0. Previous steps/requirements:
>  - This project runs on Node.js, so install both Node.js and the npm (Node Package Manager)
>  - You'll need to get all necessary API keys. Right now you only need to get keys for the TMDB API and the Jimaku API [^API], which are free. This addon uses the AniList API and <https://relations.yuna.moe/api/v2> too, but those don't need a key/authentication for publicly accessible data
> [^API]: Because of how it works, you can *probably* (I have not tested this) get away with not setting these keys, and you'll just won't get subtitles from Jimaku, or be able to process IMDB ID (starting with "tt") based items.
>  - Enter your parameters inside a .env file like this: [^dotenv]
> [^dotenv]: You just need to make a file inside the top level repository folder, enter the required information and rename it ".env". You don't need to install the **dotenv** npm package manually, the next steps will take care of project dependencies.
>    ```
>    TMDB_API_READ_TOKEN = yourTMDBAPIReadToken
>    TMDB_API_KEY = yourTMDBAPIkey
>    ```
1. Clone the repo/dowload the code on your machine however you like, and navigate to the project's directory (where `package.json` resides)
2. Run the following command to install all necessary dependencies based on `package.json`:
   ```
   npm install
   ```
3. Run a local instance of the server.
> [!TIP]
> You can run a convenient instance of the project that will restart itself when you make changes to the files (after saving) using `nodemon`, with the preprogrammed devStart command (`nodemon index.js` under the hood) with:
> ```
> npm run devStart
> ```
5. Make requests to the app on localhost:3000 (or the port set in an environment variable if it exists) or by using Stremio, in which case you'll need to install the addon (just provide Stremio the manifest url: "https://localhost:3000/manifest.json", for example)

## Acknowledgements:
> [!NOTE]
> <p align="center"><img src="https://www3.animeflv.net/assets/animeflv/img/logo.png?v=2.3" alt="AnimeFLV logo"/></p>
> This application/addon uses AnimeFLV but is not endorsed, certified, or otherwise approved by AnimeFLV.
>
> [The unofficial AnimeFLV API](https://animeflv.ahmedrangel.com/api)
> This application/addon uses The unofficial AnimeFLV API but is not endorsed, certified, or otherwise approved by it.
>
> ![The Movie DataBase logo](https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg)
> This application/addon uses TMDB and the TMDB API but is not endorsed, certified, or otherwise approved by TMDB.
>
> In case TMDB doesn't work, the [Cinemeta Stremio Addon](https://v3-cinemeta.strem.io/) will be used to get the item's metadata.

## TO DO:
- [X] Publish to Stremio Addon Catalog (not on Beam Up, because the beamup tool is not working for me)
- [X] Support Metadata requests
   - [X] Get episode thumbnails (same for each episode atm)
   - [ ] Get series logo
   - [ ] Get series backgound image
   - [ ] Get episode overviews
- [X] Offer "On Air" catalog and searchable catalog
- [X] Make catalog searchable by genre
- [ ] Research how to get the files directly to Stremio instead of having to send an external link

### Enhancements/new features
- [X] Support MyAnimeList, AniDB, AniList and kitsu ID's and thus the kitsu Stremio addon via <https://relations.yuna.moe/api/v2>
- [X] Implement skip extra argument functionality (each search page in the api outputs 24 results, so it's not cleanly divided by 100)
- [ ] Touch up the views (the homepage, mainly)
- [ ] Investigate Stremio API

## Documentation used:
- [Stremio Addon guide](https://stremio.github.io/stremio-addon-guide/basics)
- [Stremio Addon docs](https://github.com/Stremio/stremio-addon-sdk/tree/master/docs)
- [TMDB API](https://developer.themoviedb.org/docs/getting-started)
- Node.js docs
- Express.js docs
- [MDN docs](https://developer.mozilla.org/en-US/docs/Web)
- [JSDoc docs](https://jsdoc.app/)
