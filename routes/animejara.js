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
  }).then(() => console.log('\x1b[32mOn Air Animejara titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimejara = async function (query, type = undefined, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimejara()")
  if (type) {
    type = (type === "movie") ? "tipo%3Dpelicula%26" : "tipo%3Dserie%26"
  }
  const animejaraURL = (url) ? url
    : `${encodeURIComponent(ANIMEJARA_BASE)}%2Fcatalogo%3F${(query) ? "q%3D" + encodeURIComponent(query) + "%26" : ""}${(type) ? type : ""}${(genreArr) ? encodeURIComponent("tag%3D" + genreArr.join("%2C")) : ""}${(page) ? "%26paged%3D" + page : ""}`
  console.log("Animejara Search URL:", animejaraURL)
    return SearchAnimesBySpecificURL(animejaraURL).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  }).then((data) => {
    if (data?.data?.media === undefined) throw Error("Invalid response!")
    if (data.data.media.length < 1) throw Error("No search results!")
    return data.data.media.slice(gottenItems).map((anime) => {
      return {
        title: anime.title, type: (anime.type === "Pelicula" || anime.type === "Película" || anime.type === "Especial" || anime.type === "movie") ? "movie" : "series",
        slug: anime.slug, poster: anime.cover, overview: anime.synopsis, genres: genreArr
      }
    })
  })
}

exports.GetAnimeBySlug = async function (slug) {
  return GetAnimeInfo(slug).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  }).then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    //return first result
    const epCount = data.data.episodes.length
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      return {
        id: `animejara:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: data.data.cover,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      videos.push({
        id: `animejara:${slug}:${epCount + 1}`,
        title: `${data.data.title} Ep. ${epCount + 1}`,
        season: 1,
        episode: epCount + 1,
        number: epCount + 1,
        thumbnail: "https://www3.animeflv.net/assets/animeflv/img/cnt/proximo.png",
        released: new Date(data.data.next_airing_episode),
        available: false //next episode is not available yet
      })
    }
    if (videos.length === 1 && epCount === 1) { //If only one ep. probably a movie, remove the "Ep. 1" from the title
      videos[0].title = videos[0].title.replace(" Ep. 1", "")
    }
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "Pelicula" || data.data.type === "Película" || data.data.type === "Especial") ? "movie" : "series",
      videos, poster: data.data.cover, /*background: ,*/ genres: data.data.genres, description: data.data.synopsis.replaceAll(/\\n/g,'\n').replaceAll(/\\"/g,'"'), website: data.data.url, id: `animejara:${slug}`,
      language: "jpn", ...(data.data.related) && {
        links: data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/animejara:${r.slug}` }
        })
      },
      ...(data.data.startDate) && { released: data.data.startDate, releaseInfo: data.data.startDate.getFullYear() + "-" },
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `animejara:${slug}:1` } }
    }
  })
}
//WIP
exports.GetItemStreams = async function (slug, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how animejara works
  return GetEpisodeLinks(slug, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  }).then((data) => {
    return streamParser.GetStreamLinks("Animejara", "animejara", data)
  })
}

async function GetEpisodeLinks(slug, epNumber = 1) {
  try {
    const episodeData = async () => {
      if (slug && !epNumber)
        return await fetch(ANIMEJARA_BASE + "/movie/" + slug).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && epNumber)
        return await fetch(ANIMEJARA_BASE + "/episode/" + slug + "-" + epNumber).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("div.anime-info > h1").text() || $("div.episodio-detalle-header > h1.episodio-title").text(),
      servers: []
    }

    const serversDIV = $("div.botones-idioma > div.boton-idioma"); //may be 1-3 (LATINO, JAPONÉS, CASTELLANO)
    
    const serversObj = serversDIV.filter((_, el) => $(el).find(".lang-name").text().includes("JAP"));
    const downloadObj = metadataJSON?.match(/downloads:\s?.*?SUB:\s?(\[.*?\])/)?.[1];
    const serversObjDUB = serversDIV.filter((_, el) => !$(el).find(".lang-name").text().includes("JAP"));
    const downloadObjDUB = metadataJSON?.match(/downloads:\s?.*?DUB:\s?(\[.*?\])/)?.[1];
    let servers = [];
    if (serversObj) {
      servers = serversObj.split("},")?.map(s => {
        return {
          title: s.match(/server:\s?"(.*?)"/)?.[1],
          code: s.match(/url:\s?"(.*?)"/)?.[1]
        }
      });
    }
    if (downloadObj) {
      servers = servers.concat(downloadObj.split("},")?.map(s => {
        return {
          title: s.match(/server:\s?"(.*?)"/)?.[1],
          url: s.match(/url:\s?"(.*?)"/)?.[1]
        }
      }));
    }
    if (serversObjDUB) {
      servers = servers.concat(serversObjDUB.split("},")?.map(s => {
        return {
          title: s.match(/server:\s?"(.*?)"/)?.[1],
          code: s.match(/url:\s?"(.*?)"/)?.[1],
          dub: true
        }
      }));
    }
    if (downloadObjDUB) {
      servers = servers.concat(downloadObjDUB.split("},")?.map(s => {
        return {
          title: s.match(/server:\s?"(.*?)"/)?.[1],
          url: s.match(/url:\s?"(.*?)"/)?.[1],
          dub: true
        }
      }));
    }

    for (const s of servers) {
      episodeLinks.servers.push({
        name: s?.title,
        download: s?.url?.replace("mega.nz/#!", "mega.nz/file/"),
        embed: s?.code?.replace("mega.nz/embed#!", "mega.nz/embed/"),
        dub: s?.dub || false
      });
    }

    return episodeLinks;
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
    const nextAiringFind = $("div.fechas-container > div.fechas-lista > div.proximo-item");
    const nextAiringInfo = nextAiringFind?.find("span")[0]?.text().replace("LATINO", "").replace("JAPONÉS", "").replace("CASTELLANO", "").trim();

    const animeInfo = {
      title: $("div.anime-info > h1").text(),
      //alternative_titles: $("#l > div.info > div.info-b > h3").text().split(",") || [],
      status: $("#posterContainer > div").text(),
      startDate: new Date($("div:stat-item > span").text()),
      rating: $("#rating-val").text(),
      type: ($("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.movie-meta-row > span").text()=="PELÍCULA") ? "movie" : "series",
      cover: $("#mainPosterImg").attr("src"),
      synopsis: $("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.anime-sinopsis-contenedor > div").text(),
      genres: $("#content > div > div.main-content > div > div.anime-detalle-contenedor > div > div.anime-info > div.anime-categorias > span").map((_, el) => $(el).text().trim()).get(),
      next_airing_episode: nextAiringInfo,
      episodes: [],
      url
    };

    if (type === "movie") {
      if (animeInfo.episodes instanceof Array) {
        animeInfo.episodes.push({
          number: 1,
          slug: slug,
          url: ANIMEAV1_BASE + "/movie/" + slug
        });
      }
    } else {
      const episodesFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("TEMPORADAS_DATA"));
      const episodesArray = episodesFind?.match(/TEMPORADAS_DATA = (\[.*]);/)?.[1];

      const selectedSeason = $("#seasonsNav > div.active");
      let seasonNumber = Number(selectedSeason.find("div.tab-title")?.text().replace("TEMPORADA", "").trim()) || 1;

      let epCount = 0;
      try {
        const epObj = JSON.parse(episodesArray)
        if (epObj) epCount = epObj.find((season) => season.numero_temporada === seasonNumber)?.episodios.length;
      } catch (error) {
        const epCountStr = selectedSeason.find("span")?.text().replace("episodios", "").trim();
        if (epCountStr && epCountStr !== "") epCount = Number(epCountStr);
      }
      
      for (let i = 1; i <= epCount; i++) {
        if (animeInfo.episodes instanceof Array) {
          animeInfo.episodes.push({
            number: i,
            slug: slug + "-" + seasonNumber + "x" + i,
            url: ANIMEAV1_BASE + "/episode/" + slug + "-" + seasonNumber + "x" + i
          });
        }
      }

      //Relacionados
      const relatedEls = $("#seasonsNav > div.season-tab").not(".active");
      const relatedAnimes = [];
      relatedEls.each((_, el) => {
        const title = $(el).find(".tab-title").text().trim();
        const relation = "TEMPORADAS";//$(el).find(".tab-title").text().trim();
        if (title) {
          const slugi = `${slug}#season-${title.replace("TEMPORADA", "").trim()}`;
          relatedAnimes.push({
            title,
            relation,
            slug: slugi,
            url: `${ANIMEJARA_BASE}/anime/${slugi}`
          });
        }
      });

      //Asigna la propiedad si hay elementos
      if (relatedAnimes.length > 0) {
        animeInfo.related = relatedAnimes;
      }
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
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
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

    const pageSelector = $("#m > section > ul.pag > li");
    const getNextAndPrevPages = (selector) => {
      let aTagValue = selector.last().prev().find("a").text();
      if (aTagValue.includes("Siguiente")) aTagValue = selector.last().prev().prev().find("a").text();
      let aRef = selector.eq(0).children("a");
      if (aRef.text().includes("Inicio")) aRef = selector.eq(1).children("a");

      let foundPages = 0;
      let previousPage = "";
      let nextPage = "";

      if (Number(aTagValue) === 0) foundPages = 1;
      else foundPages = Number(aTagValue);

      if (aRef.text() === "1" || foundPages == 1) previousPage = null;
      else previousPage = ANIMEJARA_BASE + aRef.attr("href");

      if (!selector.last().children("a").text().includes("Último") || foundPages == 1) nextPage = null;
      else nextPage = ANIMEJARA_BASE + selector.last().prev().find("a").attr("href");

      return { foundPages, nextPage, previousPage };
    }
    const { foundPages, nextPage, previousPage } = getNextAndPrevPages(pageSelector)
    const scrapSearchAnimeData = ($) => {
      const selectedElement = $("#m > section > div > article");

      if (selectedElement.length > 0) {
        const mediaVec = [];

        selectedElement.each((_, el) => {
          mediaVec.push({
            title: $(el).find("h3").text() || $(el).find("figure > a > img").attr("alt"),
            cover: $(el).find("figure > a > img").attr("data-src"),
            //synopsis: $(el).find("div > div > div > p").eq(1).text(),
            //rating: $(el).find("article > div > p:nth-child(2) > span.Vts.fa-star").text(),
            slug: $(el).find("a").attr("href").replace("./anime/", ""),
            type: $(el).find("figure > a > b").text(),
            url: ANIMEJARA_BASE + ($(el).find("a").attr("href").replace('.', '') || $(el).find("h3 > a").attr("href").replace('.', '')),
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
    const getPage = (url) => new URL(url).searchParams.get("page")
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
  return SearchAnimesBySpecificURL(`${decodeURIComponent(ANIMEJARA_BASE)}/inicio`).then((data) => {
    if (!data || data.media === undefined) throw Error("Invalid response!")
    return data.media.map((anime) => {
      return {
        title: anime.title,
        type: anime.type,
        slug: anime.slug,
        url: anime.url
      }
    })
  })
}
