const ANIMEFLV_BASE = "https://www.animeflv.one"

const fsPromises = require("fs/promises");
const cheerio = require("cheerio");
const streamParser = require("../lib/streamParsing.js");
//const vercelBlob = require("@vercel/blob");
require('dotenv').config()//process.env.var

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
  return fsPromises.readFile('./onair_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
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
    return fsPromises.writeFile('./onair_titles.json', JSON.stringify(titles))
    // return vercelBlob.put(`onair_titles.json`, JSON.stringify(titles), {
    //   access: "public",
    //   allowOverwrite: true, //Allow overwriting the file
    //   cacheControlMaxAge: 86400000, //1 day
    //   contentType: "application/json"
    // })
  }).then(() => console.log('\x1b[32mOn Air titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}

exports.SearchAnimeFLV = async function (query, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchAnimeFLV()")
  const animeFLVURL = (url) ? url
    : `${ANIMEFLV_BASE}/animes?${new URLSearchParams({
      ...(query ? { buscar: query } : {}),
      ...(page ? { page: String(page) } : {})
    })}`
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
    const imgPattern = /\/(\d+).jpg$/g
    const matches = imgPattern.exec(data.data.cover)
    const background = matches
      ? `${ANIMEFLV_BASE}/uploads/animes/thumbs/${matches[1]}.jpg`
      : data.data.cover
    const videos = data.data.episodes.map((ep) => {
      let d = new Date(Date.now())
      return {
        id: `animeflv:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: matches
          ? `${ANIMEFLV_BASE}/uploads/animes/thumbs/${matches[1]}.jpg`
          : data.data.cover,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      videos.push({
        id: `animeflv:${slug}:${epCount + 1}`,
        title: `${data.data.title} Ep. ${epCount + 1}`,
        season: 1,
        episode: epCount + 1,
        number: epCount + 1,
        thumbnail: `${ANIMEFLV_BASE}/assets/animeflv/img/cnt/proximo.png`,
        released: new Date(data.data.next_airing_episode),
        available: false //next episode is not available yet
      })
    }
    if (videos.length === 1 && epCount === 1) { //If only one ep. probably a movie, remove the "Ep. 1" from the title
      videos[0].title = videos[0].title.replace(" Ep. 1", "")
    }
    const links = [{name:"AnimeFLV",category:"Open in",url:data.data.url},{name:data.data.title,category:"share",url:data.data.url}]
    if(data.data.related){//Add relation links if they exist
      links.push(
        ...data.data.related.map((r)=>{
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/animeflv:${r.slug}` }
        })
      )
    }
    // if(data.data.genres){
    //   links.push(
    //     ...data.data.genres.map((r)=>{
    //       return { name:r, category:"Genres", url:`stremio:///discover/https%3A%2F%2Fv3-cinemeta.strem.io%2Fmanifest.json/series/top?genre=${r}`}
    //     })
    //   )
    // }
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type === "Anime") ? "series" : "movie",
      videos, poster: data.data.cover, background, genres: data.data.genres, description: data.data.synopsis, website: data.data.url, id: `animeflv:${slug}`,
      language: "jpn", links, //both behavior hints can't coexist, if there's an upcoming episode, videos.length > 1
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `animeflv:${slug}:1` } }
    }
  })
}

exports.GetItemStreams = async function (slug, onlyInternal=true, epNumber = 1) {
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
    return streamParser.GetStreamLinks("AnimeFLV", "animeFLV", data, onlyInternal)
  })
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetEpisodeLinks(slug, epNumber = 1) {
  try {
    if (!slug) return null;
    const episodeSlug = epNumber ? `${slug}-${epNumber}` : slug;
    const response = await fetch(`${ANIMEFLV_BASE}/ver/${episodeSlug}`);
    if (!response.ok) throw Error(`HTTP error! Status: ${response.status}`);
    const html = await response.text();
    if (!html) return null;

    const $ = cheerio.load(html);

    const episodeLinks = {
      title: $("nav.Brdcrmb a").last().text().trim() || $("h1").first().text().trim(),
      number: Number($(".CapiTop h2.SubTitle").text().replace("Episodio ", "")) || Number(episodeSlug.match(/-(\d+)$/)?.[1]),
      servers: []
    }

    const downloadData = $(".dwn").attr("data-dwn");
    if (downloadData) {
      let links;
      try {
        links = JSON.parse(downloadData.replace(/&quot;/g, '"').replace(/\\\//g, "/"));
      } catch (error) {
        throw Error(`Invalid AnimeFLV download data: ${error.message}`);
      }
      for (const link of links) {
        try {
          const parsed = new URL(link);
          const domain = parsed.hostname.replace(/^www\./, "").split(".")[0].toLowerCase();
          const serverNames = {
            bysesukior: "Filemoon",
            dhcplay: "Streamwish",
            movearnpre: "Vidhide",
            mp4upload: "MP4Upload",
            doodstream: "Doodstream",
            voe: "Voe",
            mixdrop: "Mixdrop",
            streamtape: "Streamtape",
            yourupload: "YourUpload"
          };
          const name = serverNames[domain] || domain;
          episodeLinks.servers.push({ name, embed: link, dub: false });
        } catch {
          console.error("Ignoring invalid AnimeFLV stream URL:", link);
        }
      }
    }

    return episodeLinks;
  } catch (e) {
    console.error("Error on GetEpisodeLinks:", e);
    throw e
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

    const cover = $("figure img").first().attr("data-src") || $("figure img").first().attr("src");
    const animeInfo = {
      title: $("h1").first().text().trim().replace(/^Ver\s+/, "").replace(/\s+Online.*$/i, ""),
      alternative_titles: [],
      status: $("body > div.Wrapper > div > div > div.Container > div > aside > p > span").text(),
      rating: $("#votes_prmd").text(),
      type: "Anime",
      cover: cover ? new URL(cover, ANIMEFLV_BASE).href : undefined,
      synopsis: $(".tx p").first().text().trim() || $("meta[name=description]").attr("content"),
      genres: $(".gn a")
        .map((_, el) => $(el).text().trim())
        .get(),
      next_airing_episode: nextAiringInfo ? JSON.parse(nextAiringInfo)?.[3] : undefined,
      episodes: [],
      url
    };

    const seenEpisodes = new Set();
    $("a[href*='/ver/']").each((_, el) => {
      const href = $(el).attr("href");
      const match = href?.match(/\/ver\/[^/]+-(\d+)$/);
      if (!match || seenEpisodes.has(match[1])) return;
      seenEpisodes.add(match[1]);
      animeInfo.episodes.push({
        number: Number(match[1]),
        slug: slug + "-" + match[1],
        url: new URL(href, ANIMEFLV_BASE).href
      });
    });
    const episodeCount = Number($(".info-r[data-ep]").attr("data-ep"));
    if (animeInfo.episodes.length === 0 && Number.isInteger(episodeCount) && episodeCount > 0) {
      for (let number = 1; number <= episodeCount; number++) {
        animeInfo.episodes.push({
          number,
          slug: `${slug}-${number}`,
          url: `${ANIMEFLV_BASE}/ver/${slug}-${number}`
        });
      }
    }
    animeInfo.episodes.sort((a, b) => a.number - b.number);

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
    throw error
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

    const scrapSearchAnimeData = ($) => {
      const mediaVec = [];
      const seen = new Set();
      $("article.li").each((_, el) => {
        const link = $(el).find("a[href*='/anime/']").first();
        const href = link.attr("href");
        const slug = href?.match(/\/anime\/([^/?#]+)/)?.[1];
        if (!slug || seen.has(slug)) return;
        seen.add(slug);
        const image = link.find("img").first();
        mediaVec.push({
          title: $(el).find("h3").first().text().trim() || link.text().trim(),
          cover: image.attr("data-src") || image.attr("src"),
          synopsis: $(el).find("p").first().text().trim(),
          slug,
          type: $(el).find("u").first().text().trim() || "Anime",
          url: new URL(href, ANIMEFLV_BASE).href
        });
      });
      return mediaVec;
    }
    search.media.push(...scrapSearchAnimeData($));
    return search;
  } catch (error) {
    console.error("Error al buscar animes por URL:", error);
    throw error
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetOnAir() {
  try {
    const onAirData = await fetch(`${ANIMEFLV_BASE}/animes?estado=en-emision`).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    }).catch(() => null);
    const $ = cheerio.load(onAirData);

    const onAir = [];
    const seen = new Set();
    $("article.li").each((_, el) => {
      const link = $(el).find("a[href*='/anime/']").first();
      const href = link.attr("href");
      const slug = href?.match(/\/anime\/([^/?#]+)/)?.[1];
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      onAir.push({ title: $(el).find("h3").first().text().trim() || link.text().trim(), type: "Anime", slug, url: new URL(href, ANIMEFLV_BASE).href });
    });
    return onAir;
  } catch (e) {
    console.error("Error on GetOnAir:", e)
    throw e
  }
}
