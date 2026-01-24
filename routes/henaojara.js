const HENAOJARA_BASE = "https://ww1.henaojara.net"

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
  return fsPromises.readFile('./onairHENAOJARA_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile('./onairHENAOJARA_titles.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air Henaojara titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchHenaojara = async function (query, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchHenaojara()")
  const henaojaraURL = (url) ? url
    : `${encodeURIComponent(HENAOJARA_BASE)}%2Fanimes%3F${(query) ? "buscar%3D" + encodeURIComponent(query).replaceAll('%20','+') + "%26" : ""}${(genreArr) ? encodeURIComponent("genero%3D" + genreArr.join("%2C")) : ""}${(page) ? "%26page%3D" + page : ""}`
  console.log("Henaojara Search URL:", henaojaraURL)
    return SearchAnimesBySpecificURL(henaojaraURL).then((data) => {
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
        id: `henaojara:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: `${HENAOJARA_BASE}/cdn/img/episodios/${data.data.internalID}-${ep.number}.webp?t=0.1`,//`${HENAOJARA_BASE}/cdn/img/episodios/3988-${ep.number}.webp?t=0.1`,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      videos.push({
        id: `henaojara:${slug}:${epCount + 1}`,
        title: `${data.data.title} Ep. ${epCount + 1}`,
        season: 1,
        episode: epCount + 1,
        number: epCount + 1,
        thumbnail: "https://i.imgur.com/3U6r1nF.jpg",
        released: new Date(data.data.next_airing_episode),
        available: false //next episode is not available yet
      })
    }
    if (videos.length === 1 && epCount === 1) { //If only one ep. probably a movie, remove the "Ep. 1" from the title
      videos[0].title = videos[0].title.replace(" Ep. 1", "")
    }
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "Pelicula" || data.data.type === "Película" || data.data.type === "Especial") ? "movie" : "series",
      videos, poster: data.data.cover, background: `${HENAOJARA_BASE}/cdn/img/portada/${data.data.slug}.webp?t=0.1`, genres: data.data.genres, description: data.data.synopsis.replaceAll(/\\n/g,'\n').replaceAll(/\\"/g,'"'), website: data.data.url, id: `henaojara:${slug}`,
      language: "jpn", ...(data.data.related) && {
        links: data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/henaojara:${r.slug}` }
        })
      },
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `henaojara:${slug}:1` } }
    }
  })
}
//WIP
exports.GetItemStreams = async function (slug, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how henaojara works
  return GetEpisodeLinks(slug, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  }).then((data) => {
    if (data?.data?.servers === undefined) throw Error("Invalid response!")
    let epName = (data.data.number) ? data.data.title + " Ep. " + data.data.number : data.data.title
    const externalStreams = data.data.servers.filter((src) => src.embed !== undefined).map((source) => {
      return {
        externalUrl: source.embed,
        name: "Henaojara\n" + source.name + "⇗\n(external)" + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
        title: epName + "\n⚙️ (opens " + source.name + " in your browser)\n🔗 " + source.embed + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
        behaviorHints: {
          bingeGroup: "henaojara|" + source.name + "|ext",
          filename: source.embed
        }
      }
    })
    //return externalStreams WIP
    const downloadStreams = data.data.servers.filter((src) => /*(src.download !== undefined && src.name === "Stape") ||*/ (src.embed !== undefined && ["YourUpload", "MP4Upload"/*, "HLS", "PDrain"*/].includes(src.name)))
    const promises = downloadStreams.map((source) => {
      if (source.name === "YourUpload") {
        return streamParser.GetYourUploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "Henaojara\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "henaojara|" + source.name,
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
        return streamParser.GetMP4UploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "Henaojara\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "henaojara|" + source.name,
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
        return streamParser.GetPDrainLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "Henaojara\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "henaojara|" + source.name,
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
        return streamParser.GetHLSLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "Henaojara\n" + source.name + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL + ((source.dub) ? "\n🗣️🎙️(DUB)" : ""),
            behaviorHints: {
              bingeGroup: "henaojara|" + source.name,
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
        return await fetch(HENAOJARA_BASE + "/ver/" + slug).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && epNumber)
        return await fetch(HENAOJARA_BASE + "/ver/" + slug + "-" + epNumber).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("#l > div > h1").text(),
      servers: []
    }

    const serversDIV = $("div.dwn");
    
    const downloadObj = JSON.parse(serversDIV.attr("data-dwn") || "null");

    const getServerTitle = (serverDomain) => {
      const cleanDom = serverDomain.replace("bysesukior", "Filemoon").replace("movearnpre", "Vidhide")
        .replace("luluvdo", "Lulustream").replace("dhcplay", "Streamwish").replace("listeamed", "Vidguard")
        .replace("rpmvip", "RPMshare").replace("yourupload", "YourUpload").replace("mp4upload", "MP4Upload")
        .replace("pdrain", "PDrain").replace("hls", "HLS")
        .replace(".com", "").replace(".net", "").replace(".org", "").replace(".top", "")
        .replace(".to", "").replace(".ac", "").replace(".sx", "").replace(".ps", "");
      return cleanDom.charAt(0).toUpperCase() + cleanDom.slice(1)
    }
    const hex2a = (hex) => { var str = ''; for (var i = 0; i < hex.length; i += 2) str += String.fromCharCode(parseInt(hex.substr(i, 2), 16)); return str;};
    const serverData = async () => {
      return await fetch(`${HENAOJARA_BASE}/hj`, {
        "headers": {
          "accept": "*/*",
          "accept-language": "en,en-US;q=0.9,es-ES;q=0.8,es;q=0.7,fr;q=0.6,no;q=0.5",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "priority": "u=1, i",
          "sec-ch-ua": "\"Opera GX\";v=\"125\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Windows\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "x-requested-with": "XMLHttpRequest",
          "Referer": `${HENAOJARA_BASE}/ver/${slug}-${epNumber}`,
        },
        "body": `acc=opt&i=${$(".opt").attr("data-encrypt")}`,
        "method": "POST"
      }).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
        if (resp === undefined) throw Error(`Undefined response!`)
        return resp.text()
      }).catch(() => {console.log("Failed to fetch server data"); return null});
    }
    const $2 = cheerio.load(await serverData());
    
    if ($2) {
      const lis = $2("li");
      lis.each((_, el) => {
        const s = hex2a($(el).attr("encrypt"));
        const sURL = new URL(s)
        episodeLinks.servers.push({
          name: getServerTitle(sURL.hostname),
          embed: s?.replace("mega.nz/embed#!", "mega.nz/embed/"),
          dub: false
        });
      });
    }
    if (downloadObj) {
      for (const s of downloadObj) {
        const sURL = new URL(s)
        episodeLinks.servers.push({
          name: getServerTitle(sURL.hostname),
          download: s?.replace("mega.nz/#!", "mega.nz/file/"),
          dub: false
        });
      }
    }

    return episodeLinks;
  } catch (e) {
    console.error("Error on GetEpisodeLinks:", e);
    throw e
  }
}

async function GetAnimeInfo(slug) {
  try {
    const url = `${HENAOJARA_BASE}/anime/${slug}`;
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

    const animeInfo = {
      title: $("#l > div.info > div.info-b > h1").text() || $("#l > div.info > div.info-a > figure > img").attr("alt"),
      alternative_titles: $("#l > div.info > div.info-b > h3").text().split(",") || [],
      status: $("#l > div.info > div.info-b > span.e").text(),
      //rating: $("div.ic-star-solid > div.text-lead").text(),
      type: $("#l > div.info > div.info-b > ul.dt > li:first-child").text().replace("Tipo: ", ""),
      cover: $("#l > div.info > div.info-a > figure > img").attr("data-src") || `${HENAOJARA_BASE}/cdn/img/anime/${slug}.webp`,
      synopsis: $("#l > div.info > div.info-b > div.tx > p").text(),
      genres: $("#l > div.info > div.info-b > ul.gn > li").map((_, el) => $(el).find("a").text().trim()).get(),
      //next_airing_episode: nextAiringInfo ? JSON.parse(nextAiringInfo)?.[3] : undefined,
      episodes: [],
      internalID: html.match(/data-ai="(\d+)"/)?.[1],
      url
    };
    
    const episodesFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var eps ="));
    const episodesArray = episodesFind?.match(/eps = (\[\[.*\].*])/)?.[1];

    const epObj = JSON.parse(episodesArray)
    if (epObj) {
      for (ep of epObj) {
        if (animeInfo.episodes instanceof Array) {
          animeInfo.episodes.push({
            number: ep[0],
            slug: slug + "-" + ep[0],
            url: HENAOJARA_BASE + "/ver/" + slug + "-" + ep[0]
          });
        }
      }
    }

    // Relacionados
    // const relatedEls = $("body > div > div.container > main > section:nth-child(2) > div > div.gradient-cut > div > div");
    // const relatedAnimes = [];
    // relatedEls.each((_, el) => {
    //   const link = $(el).find("a");
    //   const href = link.attr("href");
    //   const title = $(el).find("h3").text().trim();
    //   const relation = $(el).find("h3 + span").text().trim();
    //   if (href && title) {
    //     const slug = href.match(/\/media\/([^/]+)/)?.[1] || href;
    //     relatedAnimes.push({
    //       title,
    //       relation,
    //       slug,
    //       url: `${ANIMEAV1_BASE}${href}`
    //     });
    //   }
    // });

    // Asigna la propiedad si hay elementos
    // if (relatedAnimes.length > 0) {
    //   animeInfo.related = relatedAnimes;
    // }

    return animeInfo;
  } catch (error) {
    console.error("Error al obtener la información del anime", slug, error);
    throw error
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function SearchAnimesBySpecificURL(henaojaraURL) {
  try {
    const html = await fetch(decodeURIComponent(henaojaraURL)).then((resp) => {
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
      else previousPage = HENAOJARA_BASE + aRef.attr("href");

      if (!selector.last().children("a").text().includes("Último") || foundPages == 1) nextPage = null;
      else nextPage = HENAOJARA_BASE + selector.last().prev().find("a").attr("href");

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
            url: HENAOJARA_BASE + ($(el).find("a").attr("href").replace('.', '') || $(el).find("h3 > a").attr("href").replace('.', '')),
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
  return SearchAnimesBySpecificURL(`${decodeURIComponent(HENAOJARA_BASE)}/animes?estado=en-emision`).then((data) => {
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
