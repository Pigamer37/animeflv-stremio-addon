const ANIMEFLV_API_BASE = "https://animeflv.ahmedrangel.com/api"
const ANIMEFLV_BASE = "https://www3.animeflv.net"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");

exports.GetAiringAnimeFromWeb = async function () {
  /*const reqURL = `${ANIMEFLV_API_BASE}/list/animes-on-air`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).catch((err) => {
    console.error('\x1b[31mUsing npm package because animeFLV API failed because:\x1b[39m ' + err)*/
  return GetOnAir().then((data) => {
    if (!data || data.length < 1) throw Error("Invalid response!")
    return { data }
  })
  /*})*/.then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    const promises = data.data.map((entry) => {
      return this.GetAnimeBySlug(entry.slug).then((anime) => {
        return {
          title: anime.name, type: (anime.type === "Anime" || anime.type === "series") ? "series" : "movie",
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
  /*return fsPromises.readFile('./onair_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)*/
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  //})
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to onair_titles.json`)
    return fsPromises.writeFile('./onair_titles.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimeFLV = async function (query, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimeFLV()")
  const animeFLVURL = (url) ? url
    : `https%3A%2F%2Fwww3.animeflv.net%2Fbrowse%3F${(query) ? "q%3D" + encodeURIComponent(query) + "%26" : ""}${(genreArr) ? "genre%5B%5D%3D" + genreArr.join("%26genre%5B%5D%3D") : ""}${(page) ? "%26page%3D" + page : ""}`
  /*const reqURL = `${ANIMEFLV_API_BASE}/search/by-url?url=${animeFLVURL}`
  console.log("\x1b[36mSearching:\x1b[39m", reqURL)
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).catch((err) => {
    console.error('\x1b[31mUsing npm package because animeFLV API failed because:\x1b[39m ' + err)*/
  return SearchAnimesBySpecificURL(animeFLVURL).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  })
  /*})*/.then((data) => {
    if (data?.data?.media === undefined) throw Error("Invalid response!")
    return data.data.media.slice(gottenItems).map((anime) => {
      return {
        title: anime.title, type: (anime.type === "Anime" || anime.type === "series") ? "series" : "movie",
        slug: anime.slug, poster: anime.cover, overview: anime.synopsis, genres: genreArr
      }
    })
  })
}

exports.GetAnimeBySlug = async function (slug) {
  /*const reqURL = `${ANIMEFLV_API_BASE}/anime/${slug}`
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()
  }).catch((err) => {
    console.error('\x1b[31mUsing npm package because animeFLV API failed because:\x1b[39m ' + err)*/
  return GetAnimeInfo(slug).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  })
  /*})*/.then((data) => {
    if (data?.data === undefined) throw Error("Invalid response!")
    //return first result
    const epCount = data.data.episodes.length
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      const imgPattern = /\/(\d+).jpg$/g
      const matches = imgPattern.exec(data.data.cover)
      return {
        id: `animeflv:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: `https://www3.animeflv.net/uploads/animes/thumbs/${matches[1]}.jpg`,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "Anime") ? "series" : "movie",
      videos, poster: data.data.cover, genres: data.data.genres, description: data.data.synopsis, website: data.data.url, id: `animeflv:${slug}`,
      language: "jpn"
    }
  })
}

exports.GetItemStreams = async function (slug, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how animeFLV works
  /*const reqURL = `${ANIMEFLV_API_BASE}/anime/${slug}/episode/${epNumber}`;
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.json()//npm package doesn't have a stream function, we'll have to program it ourselves
  }).catch((err) => {
    console.error('\x1b[31mUsing adapted funtion from API because animeFLV API failed because:\x1b[39m ' + err)*/
  return GetEpisodeLinks(slug, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  })
  /*})*/.then((data) => {
    if (data?.data?.servers === undefined) throw Error("Invalid response!")
    let epName = data.data.title
    const externalStreams = data.data.servers.filter((src) => src.embed !== undefined).map((source) => {
      return {
        externalUrl: source.embed,
        name: "AnimeFLV - " + source.name + " (external)",
        title: epName + " via " + source.name + "\n(opens in " + source.name + " in your browser)\n" + source.embed,
        behaviorHints: {
          bingeGroup: "animeFLV|" + source.name,
          filename: source.embed
        }
      }
    })
    return externalStreams
    /*const downloadStreams = data.data.servers.filter((src) => (src.download !== undefined && src.name === "Stape") || (src.embed !== undefined && src.name === "YourUpload"))
    const promises = downloadStreams.map((source) => {
      if (source.name === "Stape") {
        return GetStreamTapeLink(source.download).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeFLV - " + source.name,
            title: epName + " via " + source.name + "\n" + realURL,
            behaviorHints: {
              bingeGroup: "animeFLV|" + source.name,
              filename: realURL,
              notWebReady: true
            }
          }
        }).catch((err) => {
          console.log("Failed getting StreamTape link:", err)
          return undefined
        })
      } else if (source.name === "YourUpload") {
        return GetYourUploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeFLV - " + source.name,
            title: epName + " via " + source.name + "\n" + realURL,
            behaviorHints: {
              bingeGroup: "animeFLV|" + source.name,
              filename: realURL,
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                },
                response: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
                }
              }
            }
          }
        }).catch((err) => {
          console.log("Failed getting YourUpload link:", err)
          return undefined
        })
      }
    })

    return Promise.allSettled(promises).then((results) =>
      results.filter((prom) => (prom.value)).map((source) => source.value).concat(externalStreams)
    )*/
  })
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetEpisodeLinks(slug, epNumber = 1) {
  try {
    const episodeData = async () => {
      if (slug && !epNumber)
        return await fetch(ANIMEFLV_BASE + "/ver/" + slug).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && epNumber)
        return await fetch(ANIMEFLV_BASE + "/ver/" + slug + "-" + epNumber).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("body > div.Wrapper > div.Body > div > div > div > nav.Brdcrmb > a").next("i").next("a").text(),
      number: Number($("body > div.Wrapper > div.Body > div > div > div > div.CapiTop > h2.SubTitle").text().replace("Episodio ", "")),
      servers: []
    }

    const scripts = $("script");
    const serversFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var videos ="));
    const serversObj = serversFind?.match(/var videos = (\{.*\})/)?.[1];
    if (serversObj) {
      const servers = JSON.parse(serversObj).SUB;
      for (const s of servers) {
        episodeLinks.servers.push({
          name: s?.title,
          download: s?.url?.replace("mega.nz/#!", "mega.nz/file/"),
          embed: s?.code?.replace("mega.nz/embed#!", "mega.nz/embed/")
        });
      }
    }

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
    }
    return episodeLinks;
  } catch (e) {
    console.error("Error on GetEpisodeLinks:", e);
    return null;
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetAnimeInfo(slug) {
  try {
    const url = `${ANIMEFLV_BASE}/anime/${slug}`;
    const html = await fetch(url).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    if (!html) return null;

    const $ = cheerio.load(html);

    const scripts = $("script");
    const nextAiringFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var anime_info ="));
    const nextAiringInfo = nextAiringFind?.match(/anime_info = (\[.*\])/)?.[1];

    const animeInfo = {
      title: $("body > div.Wrapper > div > div > div.Ficha.fchlt > div.Container > h1").text(),
      alternative_titles: [],
      status: $("body > div.Wrapper > div > div > div.Container > div > aside > p > span").text(),
      rating: $("#votes_prmd").text(),
      type: $("body > div.Wrapper > div > div > div.Ficha.fchlt > div.Container > span").text(),
      cover: "https://animeflv.net" + ($("body > div.Wrapper > div > div > div.Container > div > aside > div.AnimeCover > div > figure > img").attr("src")),
      synopsis: $("body > div.Wrapper > div > div > div.Container > div > main > section:nth-child(1) > div.Description > p").text(),
      genres: $("body > div.Wrapper > div > div > div.Container > div > main > section:nth-child(1) > nav > a")
        .map((_, el) => $(el).text().trim())
        .get(),
      next_airing_episode: nextAiringInfo ? JSON.parse(nextAiringInfo)?.[3] : undefined,
      episodes: [],
      url
    };

    const episodesFind = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("var episodes ="));
    const episodesArray = episodesFind?.match(/episodes = (\[\[.*\].*])/)?.[1];

    if (episodesArray) {
      for (let i = 1; i <= JSON.parse(episodesArray)?.length; i++) {
        if (animeInfo.episodes instanceof Array) {
          animeInfo.episodes.push({
            number: i,
            slug: slug + "-" + i,
            url: ANIMEFLV_BASE + "/ver/" + slug + "-" + i
          });
        }
      }
    }

    $("body > div.Wrapper > div > div > div.Ficha.fchlt > div.Container > div:nth-child(3) > span").each((i, el) => {
      animeInfo.alternative_titles.push($(el).text());
    });

    // Relacionados
    const relatedEls = $("ul.ListAnmRel > li");
    const relatedAnimes = [];
    relatedEls.each((_, el) => {
      const link = $(el).find("a");
      const href = link.attr("href");
      const title = link.text().trim();
      const relation = $(el).text().match(/\(([^)]+)\)$/)?.[1];
      if (href && title) {
        const slug = href.match(/\/anime\/([^/]+)/)?.[1] || href;
        relatedAnimes.push({
          title,
          relation,
          slug,
          url: `${ANIMEFLV_BASE}${href}`
        });
      }
    });

    // Asigna la propiedad si hay elementos
    if (relatedAnimes.length > 0) {
      animeInfo.related = relatedAnimes;
    }

    return animeInfo;
  } catch (error) {
    console.error("Error al obtener la información del anime", slug, error);
    return null;
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function SearchAnimesBySpecificURL(animeFLVURL) {
  try {
    const html = await fetch(decodeURIComponent(animeFLVURL)).then((resp) => {
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

    const pageSelector = $("body > div.Wrapper > div > div > main > div > ul > li");
    const getNextAndPrevPages = (selector) => {
      const aTagValue = selector.last().prev().find("a").text();
      const aRef = selector.eq(0).children("a").attr("href");

      let foundPages = 0;
      let previousPage = "";
      let nextPage = "";

      if (Number(aTagValue) === 0) foundPages = 1;
      else foundPages = Number(aTagValue);

      if (aRef === "#" || foundPages == 1) previousPage = null;
      else previousPage = ANIMEFLV_BASE + aRef;

      if (selector.last().children("a").attr("href") === "#" || foundPages == 1) nextPage = null;
      else nextPage = ANIMEFLV_BASE + selector.last().children("a").attr("href");

      return { foundPages, nextPage, previousPage };
    }
    const { foundPages, nextPage, previousPage } = getNextAndPrevPages(pageSelector)
    const scrapSearchAnimeData = ($) => {
      const selectedElement = $("body > div.Wrapper > div > div > main > ul > li");

      if (selectedElement.length > 0) {
        const mediaVec = [];

        selectedElement.each((i, el) => {
          mediaVec.push({
            title: $(el).find("h3").text(),
            cover: $(el).find("figure > img").attr("src"),
            synopsis: $(el).find("div.Description > p").eq(1).text(),
            rating: $(el).find("article > div > p:nth-child(2) > span.Vts.fa-star").text(),
            slug: $(el).find("a").attr("href").replace("/anime/", ""),
            type: $(el).find("a > div > span.Type").text(),
            url: ANIMEFLV_BASE + ($(el).find("a").attr("href"))
          });
        });
        console.log("Media vector:", mediaVec)
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
  } catch(error) {
    console.error("Error al buscar animes por URL:", error);
    return null;
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetOnAir() {
  try {
    const onAirData = await fetch(decodeURIComponent(ANIMEFLV_BASE)).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    }).catch(() => null);
    const $ = cheerio.load(onAirData);

    const onAir = [];
    if ($(".ListSdbr > li").length > 0) {
      $(".ListSdbr > li").each((i, el) => {
        const temp = {
          title: $(el).find("a").remove("span").text(),
          type: $(el).find("a").children("span").text(),
          slug: $(el).find("a").attr("href").replace("/anime/", ""),
          url: ANIMEFLV_BASE + $(el).find("a").attr("href")
        }
        onAir.push(temp);
      })
    }
    return onAir;
  } catch(e) {
    console.error("Error on GetOnAir:", e)
    return null
  }
}
//Adapted from https://github.com/ChristopherProject/Streamtape-Video-Downloader
function GetStreamTapeLink(url) {
  const reqURL = url.replace("/e/", "/v/")
  return fetch(reqURL).then((resp) => {
    if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
    if (resp === undefined) throw Error(`Undefined response!`)
    return resp.text()
  }).then((data) => {
    const noRobotLinkPattern = /document\.getElementById\('norobotlink'\)\.innerHTML = (.+?);/g
    const matches = noRobotLinkPattern.exec(data)
    if (matches[1]) {
      const tokenPattern = /token=([^&']+)/g
      const tokenMatches = tokenPattern.exec(matches[1])
      if (tokenMatches[1]) {
        const STPattern = /id\s*=\s*"ideoooolink"/g
        const tagEnd = data.indexOf(">", STPattern.exec(data).index) + 1
        const streamtape = data.substring(tagEnd, data.indexOf("<", tagEnd))
        return `https:/${streamtape}&token=${tokenMatches[1]}&dl=1s`
      } else console.log("No token")
    } else console.log("No norobotlink")
  })
}

function GetYourUploadLink(url) {
  //const reqURL = url.replace("/embed/", "/watch/")
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
        console.log(vidMatch[1])
        return vidMatch[1]
      } else console.log("No video link")
    } else console.log("No video")
  })
}