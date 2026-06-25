const ANIMEJARA_BASE = "https://animejara.com"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
//const vercelBlob = require("@vercel/blob");
require('dotenv').config()//process.env.var

exports.GetAiringAnimeFromWeb = async function () {
  return GetOnAir().then((data) => {
    if (!data || data.length < 1) throw Error("Invalid response!")
    return { data }
  }).then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    const promises = data.data.map((entry) => {
      return this.GetAnimeBySlug(entry.slug).then((anime) => {
        return {
          title: anime.name, type: (anime.type === "Pelicula" || anime.type === "Película" || anime.type === "Especial" || anime.type === "movie") ? "movie" : "series",
          slug: entry.slug, poster: anime.poster, overview: anime.description
        }
      })
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value)
    )
  })
}

exports.GetAiringAnime = async function () {
  return fsPromises.readFile('./onairANIMEJARA_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile('./onairANIMEJARA_titles.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air AnimeJara titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimeJara = async function (query, type = undefined, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimejara()")
  if (type) {
    type = (type === "movie") ? "tipo%3Dpelicula%26" : "tipo%3Dserie%26"
  }
  const animejaraURL = (url) ? url
    : `${encodeURIComponent(ANIMEJARA_BASE)}%2Fcatalogo%3F${(query) ? "q%3D" + encodeURIComponent(query) + "%26" : ""}${(type) ? type : ""}${(genreArr) ? encodeURIComponent("tag=" + genreArr.join(",")).replaceAll("%20",'+') : ""}${(page) ? "%26paged%3D" + page : ""}`
  return SearchAnimesBySpecificURL(animejaraURL).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  }).then((data) => {
    if (data?.data?.media === undefined) throw Error("Invalid response!")
    if (data.data.media.length < 1) throw Error("No search results!")
    return data.data.media.slice(gottenItems).map((anime) => {
      return {
        title: anime.title, type: (anime.type === "Pelicula" || anime.type === "Película" || anime.type === "Especial" || anime.type === "movie") ? "movie" : "series",
        slug: anime.slug, poster: anime.cover, overview: anime.synopsis, genres: anime.genres || genreArr
      }
    })
  })
}

exports.GetAnimeBySlug = async function (slug, type = "series") {
  return GetAnimeInfo(slug, type).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  }).then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    //return first result
    const epCount = data.data.episodes.length
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      return {
        id: `animejara:${slug}${(ep.season) ? `:${ep.season}:${ep.number}` : ""}`,//animejara:konosuba:1:2
        title: ep.name || data.data.title + " Ep. " + ep.number,
        season: ep.season,
        episode: ep.number,
        number: ep.number,
        thumbnail: ep.poster || data.data.cover,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      const lastS = Number(data.data.episodes[epCount - 1].season)
      const lastNum = Number(data.data.episodes[epCount - 1].number)
      videos.push({
        id: `animejara:${slug}:${lastS}:${lastNum + 1}`,
        title: `${data.data.title} Ep. ${lastNum + 1}`,
        season: lastS,
        episode: lastNum + 1,
        number: lastNum + 1,
        thumbnail: "https://i.imgur.com/3U6r1nF.jpg",
        released: new Date(data.data.next_airing_episode),
        available: false //next episode is not available yet
      })
    }

    links = [{ name: "AnimeJara", category: "Open in", url: data.data.url }, { name: data.data.title, category: "share", url: data.data.url }]
    if (data.data.related) {//Add relation links if they exist
      links.push(
        ...data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/animejara:${r.slug}` }
        })
      )
    }
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "movie" || data.data.type === "Pelicula" || data.data.type === "Película" || data.data.type === "Especial") ? "movie" : "series",
      videos, poster: data.data.cover, /*background: ,*/ genres: data.data.genres, description: data.data.synopsis.replaceAll(/\\n/g, '\n').replaceAll(/\\"/g, '"'), website: data.data.url, id: `animejara:${slug}`,
      language: "jpn", links,
      ...(data.data.startDate) && { released: data.data.startDate, releaseInfo: `${data.data.startDate.getFullYear()}${(data.data.status === "FINALIZADO") ? "" : "-"}` },
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `animejara:${slug}` } }
    }
  })
}
//WIP
exports.GetItemStreams = async function (slug, onlyInternal = true, season = undefined, epNumber = undefined) {
  return GetEpisodeLinks(slug, season, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  }).then((data) => {
    return streamParser.GetStreamLinks("AnimeJara", "animejara", data, onlyInternal)
  })
}

async function GetEpisodeLinks(slug, season = undefined, epNumber = undefined) {
  try {
    const episodeData = async () => {
      if (slug && !season)
        return await fetch(`${ANIMEJARA_BASE}/movie/${slug}`).then((resp) => {
          //if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`) //AnimeJara throws 404s
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && season)
        return await fetch(`${ANIMEJARA_BASE}/episode/${slug}-${season}x${epNumber}`).then((resp) => {
          //if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("div.anime-info > h1").text() || $("div.episodio-detalle-header > h1.episodio-title").text(),
      number: Number($("#content div.episodio-info > div.episodio-meta").text().match(/Episodio (\d+)/)?.[1]),
      servers: []
    }

    const serversDIV = $("div.botones-idioma > div.boton-idioma"); //may be 1-3 (LATINO, JAPONÉS, CASTELLANO)

    let japI, latI, espI;
    const episodesFind = $("script").map((_, el) => $(el).html()).get().find(script => script?.includes("const enlaces = ") || script?.includes("const movieLinks = "));
    const enlacesArray = episodesFind?.match(/(?:enlaces|movieLinks) = (\[.*]);/)?.[1];
    try {
      const enlaces = JSON.parse(enlacesArray)
      enlaces.forEach((e, i) => {
        const idioma = serversDIV.filter((_, el) => $(el).attr('onclick').includes(`cambiarIdioma(${i}`) || $(el).attr('onclick').includes(`cambiarIdiomaMovie(${i}`)).first()
        if (idioma) {
          if (idioma.find(".lang-name").text().includes("JAP")) japI = { url: new URL(e), dubLang: "jap" }
          if (idioma.find(".lang-name").text().includes("LAT")) latI = { url: new URL(e), dubLang: "lat" }
          if (idioma.find(".lang-name").text().includes("CAS")) espI = { url: new URL(e), dubLang: "esp" }
        }
      })
    } catch (error) {
      return null
    }

    async function serverData(url) {
      return await fetch(url, {
        "headers": {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "accept-language": "en,en-US;q=0.9,es-ES;q=0.8,es;q=0.7,fr;q=0.6,no;q=0.5",
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "priority": "u=0, i",
          "sec-ch-ua": "\"Chromium\";v=\"148\", \"Opera\";v=\"132\", \"Not/A)Brand\";v=\"99\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Linux\"",
          "sec-fetch-dest": "iframe",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "cross-site",
          "sec-fetch-storage-access": "active",
          "upgrade-insecure-requests": "1",
          "Referer": "https://animejara.com/"
        },
        "method": "GET"
      }).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
        if (resp === undefined) throw Error(`Undefined response!`)
        return resp.text()
      }).catch(() => { console.log("Failed to fetch server data"); return null });
    }
    let servers = [];

    const promises = [japI, latI, espI].map((e) => {
      if (!e) return undefined
      async function lel(e1) {
        const $2 = cheerio.load(await serverData(e1.url));
        if ($2) {
          const lis = $2("#logo-list > li");
          lis.each((_, el) => {
            let match = $(el).attr('onclick')?.match(/playVideo\(&quot;(.*?)&quot/)?.[1]?.trim()
            if (!match) match = $(el).attr('onclick')?.match(/playVideo\("(.*?)"/)?.[1]?.trim()
            const sURL = new URL(match);
            servers.push({
              title: streamParser.getServerTitle($(el).find('.nombre-server')?.text() || sURL.hostname),
              code: sURL.toString().replace("https://nyuu.streamhj.top/player/e/v/go.php?v=", ""),
              dub: e1.dubLang !== 'jap',
              dubLang: e1.dubLang
            });
          });
        }
      }
      return lel(e)
    })

    return Promise.allSettled(promises).then((results) => {
      for (const s of servers) {
        episodeLinks.servers.push({
          name: s?.title,
          download: s?.url?.replace("mega.nz/#!", "mega.nz/file/"),
          embed: s?.code?.replace("mega.nz/embed#!", "mega.nz/embed/"),
          dub: s?.dub || false,
          dubLang: s?.dubLang
        })
      }
      return episodeLinks
    })
  } catch (e) {
    console.error("Error on GetEpisodeLinks:", e);
    throw e
  }
}

async function GetAnimeInfo(slug, type = "series") {
  try {
    const url = (type === "series") ? `${ANIMEJARA_BASE}/anime/${slug}` : `${ANIMEJARA_BASE}/movie/${slug}`;
    const html = await fetch(url).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    if (!html) return null;

    const $ = cheerio.load(html);
    const scripts = $("script");

    const animeInfo = {
      title: $("div.anime-info > h1").text(),
      //alternative_titles: $("#l > div.info > div.info-b > h3").text().split(",") || [],
      status: $("#posterContainer > div").text().trim(),
      startDate: new Date($("div.stat-item > span").first().text()),
      rating: $("#rating-val").text(),
      type: ($("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.movie-meta-row > span").text() == "PELÍCULA") ? "movie" : "series",
      cover: $("#mainPosterImg").attr("src"),
      synopsis: $("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.anime-sinopsis-contenedor > div").text().trim(),
      genres: $("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.anime-categorias > span").map((_, el) => $(el).text().trim()).get(),
      //next_airing_episode: nextAiringInfo,
      episodes: [],
      url
    };

    if (type !== "movie") { //only populate eps if series
      const nextAiringFind = $("div.fechas-container > div.fechas-lista > div.proximo-item");
      const nextAiringInfo = new Date(nextAiringFind?.first()?.find("span")?.text().replace("LATINO", "").replace("JAPONÉS", "").replace("CASTELLANO", "").replace("Enero", "Jan").replace("Abril", "Apr").replace("Agosto", "Aug").replace("Diciembre", "Dec").trim());
      animeInfo.next_airing_episode = (nextAiringInfo.toString() !== "Invalid Date") ? nextAiringInfo : undefined;//check valid date

      const episodesFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("TEMPORADAS_DATA"));
      const episodesArray = episodesFind?.match(/TEMPORADAS_DATA = (\[.*]);/)?.[1];

      let temporadasData;
      try {
        temporadasData = JSON.parse(episodesArray)
      } catch (error) {
        const tempData = $("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.anime-stats-top > div")
        const seasonCountStr = tempData?.eq(0)?.text().replace("Temporadas", "").trim();
        if (seasonCountStr && seasonCountStr !== "") {
          temporadasData = []
          $("#seasonsNav > div.season-tab").get().forEach((e, i) => {
            const seasEpCount = Number(e.find('div.tab-info > span').text().replace("episodios").trim())
            const seasonNum = Number(e.attr('data-season')) || i + 1;
            const seasonImg = e.find('img').attr('src');
            let epArr = []
            for (let ep = 1; ep < seasEpCount; ep++) { epArr.push({ numero_episodio: ep, poster_episodio: seasonImg }) }
            temporadasData.push({ numero_temporada: seasonNum, poster_temporada: seasonImg, episodios: epArr })
          })
        }
        const epCountStr = tempData?.eq(1)?.text().replace("Episodios", "").trim();
        if (epCountStr && epCountStr !== "") epCount = Number(epCountStr);
      }

      temporadasData?.forEach((s, si) => {
        s.episodios?.forEach((e, ei) => {
          const sn = Number(s.numero_temporada) || si + 1, en = Number(e.numero_episodio) || ei + 1;
          animeInfo.episodes.push({
            season: sn,
            number: en,
            slug: `${slug}-${sn}x${en}`,
            url: `${ANIMEJARA_BASE}/episode/${slug}-${sn}x${en}`,
            poster: e.poster_episodio
          })
        })
      })
    }

    return animeInfo;
  } catch (error) {
    console.error("Error al obtener la información del anime", slug, error);
    throw error
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function SearchAnimesBySpecificURL(animejaraURL) {
  try {
    const html = await fetch(decodeURIComponent(animejaraURL)).then((resp) => {
      //if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`) //returns 404 but doesn't fail
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    const $ = cheerio.load(html);

    const search = {
      currentPage: 1,
      hasNextPage: false,
      previousPage: null,
      nextPage: null,
      foundPages: 0,
      media: []
    };

    const pageSelector = $("#paginacion-container > ul.paginacion > li");
    const getNextAndPrevPages = (selector) => {
      let aTagValue = selector.last().prev().find("a").text();
      if (aTagValue.includes("»")) aTagValue = selector.last().prev().prev().find("a").text();
      let aRef = selector.eq(0).children("a");
      //if (aRef.text().includes("«")) aRef = selector.eq(1).children("a");

      let foundPages = 0;
      let previousPage = "";
      let nextPage = "";

      if (Number(aTagValue) === 0) foundPages = 1;
      else foundPages = Number(aTagValue);

      if (aRef.text() === "1" || foundPages == 1) previousPage = null;
      else previousPage = animejaraURL.replace(/%26paged%3D\d+/, "") + `%26paged%3D${aRef.attr('data-page')}`;

      if (!selector.last().children("a").text().includes("Último") || foundPages == 1) nextPage = null;
      else nextPage = animejaraURL.replace(/%26paged%3D\d+/, "") + `%26paged%3D${selector.last().find("a").attr('data-page')}`;

      return { foundPages, nextPage, previousPage };
    }
    const { foundPages, nextPage, previousPage } = getNextAndPrevPages(pageSelector)
    const scrapSearchAnimeData = ($) => {
      const selectedElement = $("#anime-results > div.anime-card-wrapper");

      if (selectedElement.length > 0) {
        const mediaVec = [];

        selectedElement.each((_, el) => {
          let dataAnime
          try {
            dataAnime = JSON.parse($(el).find("a.anime-card").attr('data-anime'))
          } catch (error) { }
          mediaVec.push({
            title: $(el).find("h3").text() || dataAnime?.titulo,
            cover: $(el).find("a > div > div.card-poster-wrapper > img").attr("src") || dataAnime?.poster,
            synopsis: dataAnime?.sinopsis,
            genres: dataAnime?.categorias,
            rating: $(el).find("a > div > div.card-poster-wrapper div.card-rating-year > span.card-rating").text().trim() || dataAnime?.rating,
            slug: $(el).find("a").attr("href").match(/\/([^\/]*)(?:\/)?$/)?.[1],
            type: $(el).find("a > div > div.card-poster-wrapper div.card-meta > span.meta-type").text() || dataAnime?.tipo,
            url: $(el).find("a").attr("href"),
          });
        });
        return mediaVec
      }
      else {
        return [];
      }
    }
    search.media.push(...scrapSearchAnimeData($));
    search.foundPages = foundPages;
    search.nextPage = nextPage;
    search.previousPage = previousPage;
    const getPage = (url) => new URL(decodeURIComponent(url)).searchParams.get("paged")
    const pageFromQuery = nextPage ? Number(getPage(nextPage)) : previousPage ? Number(getPage(previousPage)) : null;
    const isNextPage = nextPage && pageFromQuery;
    const isPreviousPage = previousPage && pageFromQuery;
    const inferredPage = isNextPage ? pageFromQuery - 1 : isPreviousPage ? pageFromQuery + 1 : null;
    search.currentPage = inferredPage || 1;
    search.hasNextPage = nextPage ? true : false;
    return search;
  } catch (error) {
    console.error("Error al buscar animes por URL:", error);
    throw error
  }
}

async function GetOnAir() {
  return SearchAnimesBySpecificURL(`${decodeURIComponent(ANIMEJARA_BASE)}/catalogo?estado=Emision`).then((data) => {
    if (!data || data.media === undefined) throw Error("Invalid response!")
    return data.media.map((anime) => {
      return {
        title: anime.title,
        type: anime.type,
        slug: anime.slug,
        url: anime.url,
        genres: anime.genres
      }
    })
  })
}
