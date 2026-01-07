const ANIMEAV1_BASE = "https://animeav1.com"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");
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
  return fsPromises.readFile('./onairAV1_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile('./onairAV1_titles.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air AV1 titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimeAV1 = async function (query, type = undefined, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimeAV1()")
  if (type) {
    type = (type === "movie") ? "category%3Dpelicula%26" : "category%3Dtv-anime%26category%3Dova%26category%3Despecial%26"
  }
//https://animeav1.com/catalogo?search=one-piece&category=tv-anime&genre=accion&page=2
  const animeAV1URL = (url) ? url
    : `${encodeURIComponent(ANIMEAV1_BASE)}%2Fcatalogo%3F${(query) ? "search%3D" + encodeURIComponent(query) + "%26" : ""}${(type) ? type : ""}${(genreArr) ? "genre%3D" + genreArr.join("%26genre%3D") : ""}${(page) ? "%26page%3D" + page : ""}`
  return SearchAnimesBySpecificURL(animeAV1URL).then((data) => {
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
    const imgPattern = /\/(\d+).jpg$/g
    const matches = imgPattern.exec(data.data.cover)
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      return {
        id: `animeav1:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: `https://cdn.animeav1.com/screenshots/${matches[1]}/${ep.number}.jpg`,//`https://cdn.animeflv.net/screenshots/${matches[1]}/${ep.number}/th_3.jpg`,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      videos.push({
        id: `animeav1:${slug}:${epCount + 1}`,
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
      videos, poster: data.data.cover, background: `https://cdn.animeav1.com/thumbnails/${matches[1]}.jpg`, genres: data.data.genres, description: data.data.synopsis.replaceAll(/\\n/g,'\n').replaceAll(/\\"/g,'"'), website: data.data.url, id: `animeav1:${slug}`,
      language: "jpn", ...(data.data.related) && {
        links: data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/animeav1:${r.slug}` }
        })
      },
      runtime: data.data.runtime,
      ...(data.data.startDate) && { released: data.data.startDate, releaseInfo: data.data.startDate.getFullYear() + "-".concat((data.data.endDate!==undefined)?data.data.endDate?.getFullYear():"") },
      ...(data.data.trailers) && { trailers: [ {source: data.data.trailers, type: "Trailer"} ] },
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `animeav1:${slug}:1` } }
    }
  })
}
//WIP
exports.GetItemStreams = async function (slug, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how animeAV1 works
  return GetEpisodeLinks(slug, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  }).then((data) => {
    if (data?.data?.servers === undefined) throw Error("Invalid response!")
    let epName = (data.data.number) ? data.data.title + " Ep. " + data.data.number : data.data.title
    const externalStreams = data.data.servers.filter((src) => src.embed !== undefined).map((source) => {
      return {
        externalUrl: source.embed,
        name: "AnimeAV1\n" + source.name + "⇗\n(external)" + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
        title: epName + "\n⚙️ (opens " + source.name + " in your browser)\n🔗 " + source.embed + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
        behaviorHints: {
          bingeGroup: "animeAV1|" + source.name + "|ext",
          filename: source.embed
        }
      }
    })
    //return externalStreams WIP
    const downloadStreams = data.data.servers.filter((src) => /*(src.download !== undefined && src.name === "Stape") ||*/ (src.embed !== undefined && ["YourUpload", "MP4Upload"/*, "HLS", "PDrain"*/].includes(src.name)))
    const promises = downloadStreams.map((source) => {
      if (source.name === "YourUpload") {
        return GetYourUploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeAV1\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "animeAV1|" + source.name,
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
      } else if (source.name === "MP4Upload") {
        return GetMP4UploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeAV1\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "animeAV1|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://a4.mp4upload.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting MP4Upload link:", err)
          return undefined
        })
      } else if(source.name === "PDrain") {
        return GetPDrainLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeAV1\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "animeAV1|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://pixeldrain.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                  "Content-Type": "video/mp4"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting PDrain link:", err)
          return undefined
        })
      } else if(source.name === "HLS") {
        return GetHLSLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeAV1\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "animeAV1|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "Referer": "https://player.zilla-networks.com",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
                  "Content-Type": (realURL.includes("/m3u8/")) ? "application/vnd.apple.mpegurl" : "video/mp4"
                }
              }
            }
          }
        }).catch((err) => {
          console.error("Failed getting HLS link:", err)
          return undefined
        })
      }
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value).concat(externalStreams)
    )
  })
}

async function GetEpisodeLinks(slug, epNumber = 1) {
  try {
    const episodeData = async () => {
      if (slug && !epNumber)
        return await fetch(ANIMEAV1_BASE + "/media/" + slug).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && epNumber)
        return await fetch(ANIMEAV1_BASE + "/media/" + slug + "/" + epNumber).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("body > div > div.container > main > article > div > div > header > div > div > a").text(),
      number: (["Película", "Especial"].includes($("body > div > div.container > main > article > div > div > header > div.flex > span").first().text().trim())) ? undefined : Number($("body > div > div.container > main > article > div > div > header > div.flex + h1").text().replace("Episodio ", "")) || epNumber,
      servers: []
    }

    const scripts = $("script");
    const metadataJSON = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("kit.start(app, element, {"));
    
    const serversObj = metadataJSON?.match(/embeds:\s?.*?SUB:\s?(\[.*?\])/)?.[1];
    const downloadObj = metadataJSON?.match(/downloads:\s?.*?SUB:\s?(\[.*?\])/)?.[1];
    const serversObjDUB = metadataJSON?.match(/embeds:\s?.*?DUB:\s?(\[.*?\])/)?.[1];
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
    /*
    const otherDownloads = $("body > div.Wrapper > div.Body > div > div > div > div > div > table > tbody > tr");

    for (const el of otherDownloads) {
      const name = $(el).find("td").eq(0).text();
      const lookFor = ["Zippyshare", "1Fichier"];
      if (lookFor.includes(name)) {
        episodeLinks.servers.push({
          name: $(el).find("td").eq(0).text(),
          download: $(el).find("td:last-child a").attr("href")
        });
      }
    }*/
    return episodeLinks;
  } catch (e) {
    console.error("Error on GetEpisodeLinks:", e);
    throw e
  }
}

async function GetAnimeInfo(slug) {
  try {
    const url = `${ANIMEAV1_BASE}/media/${slug}`;
    const html = await fetch(url).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    if (!html) return null;

    const $ = cheerio.load(html);
    //WIP
    const scripts = $("script");
    // const nextAiringFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var anime_info ="));
    // const nextAiringInfo = nextAiringFind?.match(/anime_info = (\[.*\])/)?.[1];

    const metadataJSON = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("kit.start(app, element, {"));
    const metadataObj = metadataJSON?.match(/data:(.+\]),/)?.[1];

    const animeInfo = {
      title: metadataObj?.match(/title:\s?"(.+?)",/)?.[1] || $("body main > article > div > div > header > div > h1").text(),
      alternative_titles: [],
      status: metadataObj?.match(/title:\s?"(.*?)",/)?.[1] || $("body main > article > div > div > header > div > span:last-child").text(),
      rating: metadataObj?.match(/score:\s?(\d{0,2}\.\d{0,2}),/)?.[1] || $("div.ic-star-solid > div.text-lead").text(),
      type: metadataObj?.match(/category:\s?.+?name:"(.*?)",/)?.[1] || $("body main > article > div > div > header > div > span:first-child").text(),
      cover: $("body main > article > div > div > figure > img").attr("src"),
      synopsis: metadataObj?.match(/synopsis:\s?"(.*?)",/)?.[1] ||$("body main > article > div > div > div.entry > p").text(),
      genres: metadataObj?.match(/genres:\s?(.*?)],/)?.[1]?.matchAll(/name:\s?"(.+?)"/g).toArray().map((el)=>el[1].trim()) || $("body main > article > div > div > header > div > a")
        .map((_, el) => $(el).text().trim())
        .get(),
      //next_airing_episode: nextAiringInfo ? JSON.parse(nextAiringInfo)?.[3] : undefined,
      episodes: [],
      url,
      ...(metadataObj?.match(/runtime:\s?(.*?),/)?.[1] !== "null") && { runtime: `${metadataObj?.match(/runtime:\s?(.*?),/)?.[1]}m` || undefined },
      ...(metadataObj?.match(/trailer:\s?"(.*?)",/)?.[1]) && { trailers: metadataObj?.match(/trailer:\s?"(.*?)",/)?.[1] || undefined }
    };
    
    if (metadataObj?.includes("episodesCount")){
      const episodesCount = Number(metadataObj?.match(/episodesCount:\s?(\d+),/)?.[1]);
      for (let i = 1; i <= episodesCount; i++) {
        if (animeInfo.episodes instanceof Array) {
          animeInfo.episodes.push({
            number: i,
            slug: slug + "-" + i,
            url: ANIMEAV1_BASE + "/media/" + slug + "/" + i
          });
        }
      }
    }
    // Alternative titles
    if (metadataObj?.includes("aka:")){
      try {
        const alt_titls = JSON.parse(metadataObj?.match(/aka:\s?({.+?}),/)?.[1]);
        for (const value of Object.values(alt_titls)) {
          animeInfo.alternative_titles.push(value);
        }
      } catch (error) {}
    } else {
      $("body main > article > div > div > header > div > h2").each((_, el) => {
        animeInfo.alternative_titles.push($(el).text());
      });
    }

    // Relacionados
    const relatedEls = $("body > div > div.container > main > section:nth-child(2) > div > div.gradient-cut > div > div");
    const relatedAnimes = [];
    relatedEls.each((_, el) => {
      const link = $(el).find("a");
      const href = link.attr("href");
      const title = $(el).find("h3").text().trim();
      const relation = $(el).find("h3 + span").text().trim();
      if (href && title) {
        const slug = href.match(/\/media\/([^/]+)/)?.[1] || href;
        relatedAnimes.push({
          title,
          relation,
          slug,
          url: `${ANIMEAV1_BASE}${href}`
        });
      }
    });

    // Asigna la propiedad si hay elementos
    if (relatedAnimes.length > 0) {
      animeInfo.related = relatedAnimes;
    }

    // Dates
    if (metadataObj?.includes("startDate:")){
      const startDate = Date.parse(metadataObj?.match(/startDate:\s?"(.*?)",/)?.[1]);
      const endDate = Date.parse(metadataObj?.match(/endDate:\s?"(.*?)",/)?.[1]);
      if (!isNaN(startDate)) animeInfo.startDate = new Date(startDate);
      if (!isNaN(endDate)) animeInfo.endDate = new Date(endDate);
    }

    return animeInfo;
  } catch (error) {
    console.error("Error al obtener la información del anime", slug, error);
    throw error
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function SearchAnimesBySpecificURL(animeAV1URL) {
  try {
    const html = await fetch(decodeURIComponent(animeAV1URL)).then((resp) => {
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

    const pageSelector = $("body > div > div.container > main > section > div > a");
    const getNextAndPrevPages = (selector) => {
      const aTagValue = selector.last().prev().find("a").text();
      const aRef = selector.eq(0).children("a").attr("href");

      let foundPages = 0;
      let previousPage = "";
      let nextPage = "";

      if (Number(aTagValue) === 0) foundPages = 1;
      else foundPages = Number(aTagValue);

      if (aRef === "#" || foundPages == 1) previousPage = null;
      else previousPage = ANIMEAV1_BASE + aRef;

      if (selector.last().children("a").attr("href") === "#" || foundPages == 1) nextPage = null;
      else nextPage = ANIMEAV1_BASE + selector.last().children("a").attr("href");

      return { foundPages, nextPage, previousPage };
    }
    const { foundPages, nextPage, previousPage } = getNextAndPrevPages(pageSelector)
    const scrapSearchAnimeData = ($) => {
      const selectedElement = $("body > div > div.container > main > section > div > article");

      if (selectedElement.length > 0) {
        const mediaVec = [];

        selectedElement.each((_, el) => {
          mediaVec.push({
            title: $(el).find("header > h3").text(),
            cover: $(el).find("div > figure > img").attr("src"),
            synopsis: $(el).find("div > div > div > p").eq(1).text(),
            //rating: $(el).find("article > div > p:nth-child(2) > span.Vts.fa-star").text(),
            slug: $(el).find("a").attr("href").replace("/media/", ""),
            type: $(el).find("div > figure + div > div").text(),
            url: ANIMEAV1_BASE + ($(el).find("a").attr("href"))
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
  return SearchAnimesBySpecificURL("https://animeav1.com/catalogo?status=emision").then((data) => {
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

function GetYourUploadLink(url) {
  return fetch(url).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  }).then((data) => {
    const metaPattern = /property\s*=\s*"og:video"/g
    const metaMatch = metaPattern.exec(data)
    if (metaMatch[0]) {
      const vidPattern = /content\s*=\s*"(\S+)"/g
      const vidMatch = vidPattern.exec(data.substring(metaMatch.index))
      if (vidMatch[1]) {
        return vidMatch[1]
      } else console.log("No video link")
    } else console.log("No video")
  })
}

function GetMP4UploadLink(url) {
  return fetch(url).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  }).then((data) => {
    const metaPattern = /<script(?:.|\n)+?src:(?:.|\n)*?"(.+?\.mp4)"/g
    const metaMatch = metaPattern.exec(data)
    if (metaMatch && metaMatch[0]) {
      return metaMatch[1]
    } else console.log("No video link")
  })
}

function GetPDrainLink(url) {
  const metaPattern = /(.+?:\/\/.+?)\/.+?\/(.+?)(?:\?embed)?$/g
  const metaMatch = metaPattern.exec(url)
  if (metaMatch && metaMatch[0]) {
    return Promise.resolve(`${metaMatch[1]}/api/file/${metaMatch[2]}`)
  } else { console.log("No video link"); Promise.reject("No video link") }
}

function GetHLSLink(url) {
  if (url.includes("/play/") || url.includes("/m3u8/")) {
    return Promise.resolve(url.replace("/play/", "/m3u8/"))
  } else { console.log("No video link"); Promise.reject("No video link") }
}
