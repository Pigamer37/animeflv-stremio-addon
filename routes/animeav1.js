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
          title: anime.name, type: (anime.type === "TV Anime" || anime.type === "series") ? "series" : "movie",
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
  return fsPromises.readFile('./onair_titles_av1.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading AV1 titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
  /*try {
    return fetch(process.env.BLOB_URL).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.json()
    }).catch(async (err) => {
      console.error('\x1b[31mFailed reading Vercel Blob with direct URL:\x1b[39m', err, 'Using expensive list() method instead')
      const list = await vercelBlob.list({ limit: 2 })
      if (list.blobs.length < 1) throw Error("No files found in Vercel Blob")
      const blobObj = list.blobs.find((blob) => blob.pathname.includes("onair_titles.json"))
      if (!blobObj) throw Error("Files found, but no onair_titles.json found")
      return fetch(blobObj.url).then((resp) => {
        if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
        if (resp === undefined) throw Error(`Undefined response!`)
        return resp.json()
      })
    })
  } catch (error) {
    console.error('\x1b[31mFailed reading titles Vercel Blob:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  }*/
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile('./onair_titles_av1.json', JSON.stringify(titles))
    // return vercelBlob.put(`onair_titles.json`, JSON.stringify(titles), {
    //   access: "public",
    //   allowOverwrite: true, //Allow overwriting the file
    //   cacheControlMaxAge: 86400000, //1 day
    //   contentType: "application/json"
    // })
  }).then(() => console.log('\x1b[32mOn Air (AV1) titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" AV1 titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimeAV1 = async function (query, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimeAV1()")
  const animeAV1URL = (url) ? url
    : `${encodeURIComponent(ANIMEAV1_BASE)}%2Fbrowse%3F${(query) ? "q%3D" + encodeURIComponent(query) + "%26" : ""}${(genreArr) ? "genre%5B%5D%3D" + genreArr.join("%26genre%5B%5D%3D") : ""}${(page) ? "%26page%3D" + page : ""}`
  return SearchAnimesBySpecificURL(animeAV1URL).then((data) => {
    if (!data) throw Error("Invalid response!")
    return { data }
  }).then((data) => {
    if (data?.data?.media === undefined) throw Error("Invalid response!")
    if (data.data.media.length < 1) throw Error("No search results!")
    return data.data.media.slice(gottenItems).map((anime) => {
      return {
        title: anime.title, type: (anime.type === "TV Anime" || anime.type === "series") ? "series" : "movie",
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
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "TV Anime") ? "series" : "movie",
      videos, poster: data.data.cover, background: `https://cdn.animeav1.com/thumbnails/${matches[1]}.jpg`, genres: data.data.genres, description: data.data.synopsis.replaceAll(/\\n/g,'\n'), website: data.data.url, id: `animeav1:${slug}`,
      language: "jpn", ...(data.data.related) && {
        links: data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/animeav1:${r.slug}` }
        })
      },
      runtime: data.data.runtime,
      ...(data.data.startDate) && { released: data.data.startDate, releaseInfo: data.data.startDate.getFullYear() + "-".concat((data.data.endDate!==undefined)?data.data.endDate?.getFullYear():"") },
      ...(data.data.trailers) && { trailers: [ {source: data.data.trailers, type: "Trailer"} ] },
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } }
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
        name: "AnimeAV1\n" + source.name + "⇗\n(external)",
        title: epName + "\n⚙️ (opens " + source.name + " in your browser)\n🔗 " + source.embed,
        behaviorHints: {
          bingeGroup: "animeAV1|" + source.name + "|ext",
          filename: source.embed
        }
      }
    })
    //return externalStreams WIP
    const downloadStreams = data.data.servers.filter((src) => (src.download !== undefined && src.name === "Stape") || (src.embed !== undefined && src.name === "YourUpload"))
    const promises = downloadStreams.map((source) => {
      if (source.name === "YourUpload") {
        return GetYourUploadLink(source.embed).then((realURL) => {
          return {
            url: realURL,
            name: "AnimeAV1\n" + source.name,
            title: epName + "\n⚙️ " + source.name + "\n🔗 " + realURL,
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
      title: $("body > div.Wrapper > div.Body > div > div > div > nav.Brdcrmb > a").next("i").next("a").text(),
      number: Number($("body > div > div.container > main > article > div > div > header > div > h1").text().replace("Episodio ", "")) || epNumber,
      servers: []
    }

    const scripts = $("script");
    const metadataJSON = scripts.map((_, el) => $(el).html()).get().find(script => script?.includes("kit.start(app, element, {"));
    
    const serversObj = metadataJSON?.match(/embeds:\s?\{SUB:\s?(\[.*?\])/)?.[1];
    const downloadObj = metadataJSON?.match(/downloads:\s?\{SUB:\s?(\[.*?\])/)?.[1];
    let servers = {};
    if (serversObj) {
      servers = serversObj.split("},")?.map(s => {
        return {
          title: s.match(/server:\s?"(.*?)"/)?.[1],
          code: s.match(/url:\s?"(.*?)"/)?.[1]
        }
      });
    }
    if (downloadObj) {
      servers.concat(downloadObj.split("},")?.map(s => {
        return {
          title: s.match(/server:\s?"(.*?)"/)?.[1],
          url: s.match(/url:\s?"(.*?)"/)?.[1]
        }
      }));
    }

    for (const s of servers) {
      episodeLinks.servers.push({
        name: s?.title,
        download: s?.url?.replace("mega.nz/#!", "mega.nz/file/"),
        embed: s?.code?.replace("mega.nz/embed#!", "mega.nz/embed/")
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
      else previousPage = ANIMEAV1_BASE + aRef;

      if (selector.last().children("a").attr("href") === "#" || foundPages == 1) nextPage = null;
      else nextPage = ANIMEAV1_BASE + selector.last().children("a").attr("href");

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
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetOnAir() {
  try {
    const onAirData = await fetch(decodeURIComponent(ANIMEAV1_BASE)).then((resp) => {
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
          url: ANIMEAV1_BASE + $(el).find("a").attr("href")
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
