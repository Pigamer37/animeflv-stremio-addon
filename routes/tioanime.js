const TIOANIME_BASE = "https://tioanime.com"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
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
  return fsPromises.readFile('./onair_titlesTIO.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile('./onair_titlesTIO.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}
//TODO
exports.SearchTioAnime = async function (query, type = undefined, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchTioAnime()")
  if (type) {
    type = (type === "movie") ? "type%5B%5D%3D1%26" : "type%5B%5D%3D0%26type%5B%5D%3D2%26type%5B%5D%3D3%26"
  }
  const tioanimeURL = (url) ? url //this search requires the year, sorting order and status (only one of them) to be added, otherwise it returns empty
    : `${TIOANIME_BASE}/directorio?${(query) ? "q=" + encodeURIComponent(query) + "&" : ""}${(type) ? type : ""}${(genreArr) ? "genero%5B%5D=" + genreArr.join("&genre%5B%5D=") : ""}${(page) ? "&p=" + page : ""}&year=1950%2C2026&status=2&sort=recent`
  return SearchAnimesBySpecificURL(tioanimeURL).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  })
  /*})*/.then((data) => {
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
//TODO
exports.GetAnimeBySlug = async function (slug) {
  return GetAnimeInfo(slug).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  })
  /*})*/.then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    //return first result
    const epCount = data.data.episodes.length
    const imgPattern = /\/(\d+).jpg$/g
    const matches = imgPattern.exec(data.data.cover)
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      return {
        id: `tioanime:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: `${TIOANIME_BASE}/uploads/thumbs/${matches[1]}.jpg`,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      videos.push({
        id: `tioanime:${slug}:${epCount + 1}`,
        title: `${data.data.title} Ep. ${epCount + 1}`,
        season: 1,
        episode: epCount + 1,
        number: epCount + 1,
        thumbnail: `https://www3.animeflv.net/assets/animeflv/img/cnt/proximo.png`,
        released: new Date(data.data.next_airing_episode),
        available: false //next episode is not available yet
      })
    }
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "Anime") ? "series" : "movie",
      videos, poster: data.data.cover, background: `${TIOANIME_BASE}/uploads/animes/thumbs/${matches[1]}.jpg`, genres: data.data.genres, description: data.data.synopsis, website: data.data.url, id: `tioanime:${slug}`,
      language: "jpn", ...(data.data.related) && {
        links: data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/tioanime:${r.slug}` }
        })
      },
      ...(data.data.year) && { releaseInfo: data.data.year },
      //both behavior hints can't coexist, if there's an upcoming episode, videos.length > 1
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `tioanime:${slug}:1` } }
    }
  })
}
//TODO
exports.GetItemStreams = async function (slug, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how tioanime works
  return GetEpisodeLinks(slug, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  }).then((data) => {
    if (data?.data?.servers === undefined) throw Error("Invalid response!")
    let epName = (data.data.number) ? data.data.title + " Ep. " + data.data.number : data.data.title
    const externalStreams = data.data.servers.filter((src) => src.embed !== undefined).map((source) => {
      return {
        externalUrl: source.embed,
        name: "TioAnime\n" + source.name + "⇗\n(external)" + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
        title: epName + "\n⚙️ (opens " + source.name + " in your browser)\n🔗 " + source.embed + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
        behaviorHints: {
          bingeGroup: "tioanime|" + source.name + "|ext",
          filename: source.embed
        }
      }
    })
    //return externalStreams
    const downloadStreams = data.data.servers.filter((src) => (src.download !== undefined && src.name === "Stape") || (src.embed !== undefined && src.name === "YourUpload"))
    const promises = downloadStreams.map((source) => {
      /*if (source.name === "Stape") {
        return streamParser.GetStreamTapeLink(source.download).then((realURL) => {
          return {
            url: realURL,
            name: "TioAnime - " + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
            title: epName + " via " + source.name + "\n" + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
            behaviorHints: {
              bingeGroup: "tioanime|" + source.name,
              filename: realURL,
              notWebReady: true
            }
          }
        }).catch((err) => {
          console.log("Failed getting StreamTape link:", err)
          return undefined
        })
      } else*/ if (source.name === "YourUpload") {
        return streamParser.GetYourUploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "TioAnime\n" + source.name + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(🇪🇸DUB)" : "\n🇯🇵🇪🇸"),
            behaviorHints: {
              bingeGroup: "tioanime|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://yourupload.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting YourUpload link:", err)
          return undefined
        })
      }
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value).concat(externalStreams)
    )
  })
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetEpisodeLinks(slug, epNumber = 1) {
  try {
    const episodeData = async () => {
      if (slug && !epNumber)
        return await fetch(TIOANIME_BASE + "/ver/" + slug).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && epNumber)
        return await fetch(TIOANIME_BASE + "/ver/" + slug + "-" + epNumber).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("#tioanime > div > div > aside > h1").text(),
      number: epNumber,
      servers: []
    }

    const scripts = $("script");
    const serversFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var videos ="));
    const serversObj = serversFind?.match(/var videos = (\[\[.*]])/)?.[1];
    if (serversObj) {
      const servers = JSON.parse(serversObj);
      for (const s of servers) {
        episodeLinks.servers.push({
          name: s?.[0],
          //download: s?.[1]?.replace("mega.nz/#!", "mega.nz/file/"),
          embed: s?.[1]?.replace("mega.nz/embed#!", "mega.nz/embed/"),
          dub: false
        });
      }
    }

    // const otherDownloads = $("body > div.Wrapper > div.Body > div > div > div > div > div > table > tbody > tr");

    // for (const el of otherDownloads) {
    //   const name = $(el).find("td").eq(0).text();
    //   const lookFor = ["Zippyshare", "1Fichier"];
    //   if (lookFor.includes(name)) {
    //     episodeLinks.servers.push({
    //       name: $(el).find("td").eq(0).text(),
    //       download: $(el).find("td:last-child a").attr("href")
    //     });
    //   }
    // }
    return episodeLinks;
  } catch (e) {
    console.error("Error on GetEpisodeLinks:", e);
    throw e
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetAnimeInfo(slug) {
  try {
    const url = `${TIOANIME_BASE}/anime/${slug}`;
    const html = await fetch(url).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    if (!html) return null;

    const $ = cheerio.load(html);

    const scripts = $("script");
    // const nextAiringFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var anime_info ="));
    const nextAiringInfo = html?.match(/Proximo episodio: <span>(.*)<\/span>/)?.[1];

    const animeInfo = {
      title: $("#tioanime > article > div > div > aside > h1.title").text(),
      alternative_titles: [],
      status: $("#tioanime > article > div > div > aside > div > a.status").text(),
      rating: $("#score").text(),
      type: $("#tioanime > article > div > div > aside > div.meta > span.anime-type-peli").text(),
      cover: TIOANIME_BASE + ($("#tioanime > article > div > div > aside > div > figure > img").attr("src")),
      synopsis: $("#tioanime > article > div > div > aside > p.sinopsis").text(),
      genres: $("#tioanime > article > div > div > aside > p.genres > span")
        .map((_, el) => $(el).find("a").text().trim())
        .get(),
      next_airing_episode: nextAiringInfo ? Date.parse(nextAiringInfo) : undefined,
      episodes: [],
      url
    };

    const episodesFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var episodes ="));
    const episodesArray = episodesFind?.match(/episodes = (\[.*])/)?.[1];
    
    const epObj = JSON.parse(episodesArray)
    if (epObj) {
      for (ep of epObj) {
        if (animeInfo.episodes instanceof Array) {
          animeInfo.episodes.push({
            number: ep,
            slug: slug + "-" + ep,
            url: TIOANIME_BASE + "/ver/" + slug + "-" + ep
          });
        }
      }
    }

    // $("body > div.Wrapper > div > div > div.Ficha.fchlt > div.Container > div:nth-child(3) > span").each((i, el) => {
    //   animeInfo.alternative_titles.push($(el).text());
    // });

    // Relacionados
    const relatedEls = $("#tioanime > div > div > aside > div > section > ul > li");
    const relatedAnimes = [];
    relatedEls.each((_, el) => {
      const link = $(el).find("a");
      const href = link.attr("href");
      const title = $(el).find("h3.title").text().trim();
      const relation = "Cronología"; //$(el).find("article > div.thumb > span.anime-type-peli").text().trim();
      if (href && title) {
        const slug = href.match(/\/anime\/([^/]+)/)?.[1] || href;
        relatedAnimes.push({
          title,
          relation,
          slug,
          url: `${TIOANIME_BASE}${href}`
        });
      }
    });

    // Asigna la propiedad si hay elementos
    if (relatedAnimes.length > 0) {
      animeInfo.related = relatedAnimes;
    }

    animeInfo.year = $("#tioanime > article > div > div > aside > div.meta > span.year").text().trim();

    return animeInfo;
  } catch (error) {
    console.error("Error al obtener la información del anime", slug, error);
    throw error
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function SearchAnimesBySpecificURL(tioanimeURL) {
  try {
    const html = await fetch(decodeURIComponent(tioanimeURL)).then((resp) => {
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

    const pageSelector = $("#tioanime > div > div.row.justify-content-between.filters-cont > main > nav > ul > li");
    const getNextAndPrevPages = (selector) => {
      const aTagValue = selector.last().prev().find("a").text();
      const aRef = selector.eq(0).children("a").attr("href");

      let foundPages = 0;
      let previousPage = "";
      let nextPage = "";

      if (Number(aTagValue) === 0) foundPages = 1;
      else foundPages = Number(aTagValue);

      if (aRef === "#" || foundPages == 1) previousPage = null;
      else previousPage = TIOANIME_BASE + aRef;

      if (selector.last().children("a").attr("href") === "#" || foundPages == 1) nextPage = null;
      else nextPage = TIOANIME_BASE + selector.last().children("a").attr("href");

      return { foundPages, nextPage, previousPage };
    }
    const { foundPages, nextPage, previousPage } = getNextAndPrevPages(pageSelector)
    const scrapSearchAnimeData = ($) => {
      const selectedElement = $("main > ul > li");

      if (selectedElement.length > 0) {
        const mediaVec = [];

        selectedElement.each((_, el) => {
          mediaVec.push({
            title: $(el).find("h3").text(),
            cover: `${TIOANIME_BASE}${$(el).find("img").attr("src")}`,
            //synopsis: $(el).find("div.Description > p").eq(1).text(),
            //rating: $(el).find("article > div > p:nth-child(2) > span.Vts.fa-star").text(),
            slug: $(el).find("a").attr("href").replace("/anime/", ""),
            //type: $(el).find("a > div > span.Type").text(),
            url: TIOANIME_BASE + ($(el).find("a").attr("href"))
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
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetOnAir() {
  try {
    const onAirData = await fetch(decodeURIComponent(TIOANIME_BASE)).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    }).catch(() => null);
    const $ = cheerio.load(onAirData);

    const onAir = [];
    if ($("#tioanime > div > section:nth-child(3) > ul > li").length > 0) {
      $("#tioanime > div > section:nth-child(3) > ul > li").each((_, el) => {
        const temp = {
          title: $(el).find("h3").text(),
          //type: $(el).find("a").children("span").text(),
          slug: $(el).find("a").attr("href").replace("/anime/", ""),
          url: TIOANIME_BASE + $(el).find("a").attr("href")
        }
        onAir.push(temp);
      })
    }
    return onAir;
  } catch (e) {
    console.error("Error on GetOnAir:", e)
    throw e
  }
}
