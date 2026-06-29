const JKANIME_BASE = "https://jkanime.net"

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
  return fsPromises.readFile('./onairJK_titles.json').then((data) => JSON.parse(data)).catch((err) => {
    console.error('\x1b[31mFailed reading titles cache:\x1b[39m ' + err)
    return this.GetAiringAnimeFromWeb() //If the file doesn't exist, get the titles from the web
  })
}

exports.UpdateAiringAnimeFile = function () {
  return this.GetAiringAnimeFromWeb().then((titles) => {
    console.log(`\x1b[36mGot ${titles.length} titles\x1b[39m, saving to cache`)
    return fsPromises.writeFile('./onairJK_titles.json', JSON.stringify(titles))
  }).then(() => console.log('\x1b[32mOn Air JKAnime titles "cached" successfully!\x1b[39m')
  ).catch((err) => {
    console.error('\x1b[31mFailed "caching" titles:\x1b[39m ' + err)
  })
}
//TODO
exports.SearchJKAnime = async function (query, type = undefined, genreArr = undefined, url = undefined, page = undefined, gottenItems = 0) {
  if (!url && !query && !genreArr) throw Error("No arguments passed to SearchJKAnime()")
  if (type) {
    type = (type === "movie") ? "type%5B%5D%3D1%26" : "type%5B%5D%3D0%26type%5B%5D%3D2%26type%5B%5D%3D3%26"
  }
  const jkanimeURL = (url) ? url //this search requires the year, sorting order and status (only one of them) to be added, otherwise it returns empty
    : `${JKANIME_BASE}/directorio?${(query) ? "q=" + encodeURIComponent(query) + "&" : ""}${(type) ? type : ""}${(genreArr) ? "genero%5B%5D=" + genreArr.join("&genre%5B%5D=") : ""}${(page) ? "&p=" + page : ""}&year=1950%2C2026&status=2&sort=recent`
  return SearchAnimesBySpecificURL(jkanimeURL).then((data) => {
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
        id: `jkanime:${slug}:${ep.number}`,
        title: data.data.title + " Ep. " + ep.number,
        season: 1,
        episode: ep.number,
        number: ep.number,
        thumbnail: ep.thumbnail,
        released: new Date(d.setDate(d.getDate() - (epCount - ep.number))),
        available: true
      }
    })
    if (data.data.next_airing_episode !== undefined) {
      videos.push({
        id: `jkanime:${slug}:${epCount + 1}`,
        title: `${data.data.title} Ep. ${epCount + 1}`,
        season: 1,
        episode: epCount + 1,
        number: epCount + 1,
        thumbnail: `https://www3.animeflv.net/assets/animeflv/img/cnt/proximo.png`,
        released: new Date(data.data.next_airing_episode),
        available: false //next episode is not available yet
      })
    }
    if (videos.length === 1 && epCount === 1) { //If only one ep. probably a movie, remove the "Ep. 1" from the title
      videos[0].title = videos[0].title.replace(" Ep. 1", "")
    }
    links = [{ name: "JKAnime", category: "Open in", url: data.data.url }, { name: data.data.title, category: "share", url: data.data.url }]
    if (data.data.related) {//Add relation links if they exist
      links.push(
        ...data.data.related.map((r) => {
          return { name: r.title, category: r.relation, url: `stremio:///detail/series/jkanime:${r.slug}` }
        })
      )
    }
    return {
      name: data.data.title, alternative_titles: data.data.alternative_titles, type: (data.data.type !== "Pelicula") ? "series" : "movie",
      videos, poster: data.data.cover, background: videos[0]?.thumbnail, genres: data.data.genres, description: data.data.synopsis, website: data.data.url, id: `jkanime:${slug}`,
      language: "jpn", links,
      ...(data.data.runtime) && { runtime: data.data.runtime },
      ...(data.data.released) && { released: data.data.released, releaseInfo: `${data.data.released.getFullYear()}${(data.data.status === "Concluido") ? "" : "-"}` },
      ...(data.data.trailer) && { trailers: [{ source: data.data.trailer, type: "Trailer" }] },
      ...(data.data.next_airing_episode !== undefined) && { behaviorHints: { hasScheduledVideos: true } },
      ...(videos.length == 1) && { behaviorHints: { defaultVideoId: `jkanime:${slug}:1` } }
    }
  })
}

exports.GetItemStreams = async function (slug, onlyInternal = true, epNumber = 1) {
  //if we don't get an episode number, use 1, that's how jkanime works
  return GetEpisodeLinks(slug, epNumber).then((data) => {
    if (!data) throw Error('Empty response!')
    return { data }
  }).then((data) => {
    return streamParser.GetStreamLinks("JKAnime", "jkanime", data, onlyInternal)
  })
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function GetEpisodeLinks(slug, epNumber = 1) {
  try {
    const episodeData = async () => {
      if (slug && !epNumber)
        return await fetch(JKANIME_BASE + "/ver/" + slug).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else if (slug && epNumber)
        return await fetch(JKANIME_BASE + "/ver/" + slug + "-" + epNumber).then((resp) => {
          if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
          if (resp === undefined) throw Error(`Undefined response!`)
          return resp.text()
        }).catch(() => null);
      else return null;
    }

    if (!(await episodeData())) return null;

    const $ = cheerio.load(await episodeData());

    const episodeLinks = {
      title: $("#jkanime > div > div > aside > h1").text().replace(/\d+$/, "").trim(), //remove ep. number if present
      number: epNumber || $("#jkanime > div > div > aside > h1").text().match(/\d+$/)?.[0],
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

async function GetAnimeInfo(slug) {
  try {
    const url = `${JKANIME_BASE}/${slug}`;
    const html = await fetch(url).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) throw Error(`HTTP error! Status: ${resp.status}`)
      if (resp === undefined) throw Error(`Undefined response!`)
      return resp.text()
    })
    if (!html) return null;

    const $ = cheerio.load(html);

    const metadataLis = $("div.anime__details__content div.anime_data ul > li");
    const nextAiringInfo = $("#proxep > p")?.text()?.replace("Próximo episodio:", "")?.replace(" de", "")?.trim()

    const animeInfo = {
      title: $("div.anime__details__content div.anime_info > h3").text(),
      alternative_titles: [],
      status: $("div.anime__details__content ul > li > div.enemision").first().text(),
      //rating: $("#score").text(),
      type: $("div.anime__details__content ul > li[rel=tipo]").first().text().replace("Tipo:", "").trim(),
      cover: $("div.anime__details__content div.anime_pic > img").attr("src") || `https://cdn.jkdesa.com/assets/images/animes/image/${slug}.jpg`,
      synopsis: $("div.anime__details__content div.anime_info > p.scroll").text(),
      genres: metadataLis.filter((_, el) => $(el).text()?.includes("Generos:")).first().find('a')
        .map((_, el) => $(el).text().trim())
        .get(),
      next_airing_episode: nextAiringInfo ? nextAiringInfo + ' ' + new Date().getFullYear() : undefined,
      episodes: [],
      url,
      runtime: metadataLis.filter((_, el) => $(el).text().includes("Duracion:"))?.first()?.text()?.replace("Duracion:","")?.trim(),
      released: new Date(metadataLis.filter((_, el) => $(el).text().includes("Emitido"))?.first()?.text()?.replace("Emitido:", "")?.replaceAll(" de", "")?.trim())
    };

    const epArray = await fetch(`${JKANIME_BASE}/ajax/episodes/${$("#guardar-anime").first().attr('data-anime')}/1`, {
      "headers": {
        "accept": "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en,en-US;q=0.9,es-ES;q=0.8,es;q=0.7,fr;q=0.6,no;q=0.5",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "pragma": "no-cache",
        "priority": "u=1, i",
        "sec-ch-ua": "\"Chromium\";v=\"148\", \"Opera\";v=\"132\", \"Not/A)Brand\";v=\"99\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Linux\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "Referer": `${JKANIME_BASE}/${slug}/`
      },
      "body": `_token=${$("meta[name=csrf-token]")?.attr('content')}`,
      "method": "POST"
    }).then((resp) => {
      if ((!resp.ok) || resp.status !== 200) return {}
      if (resp === undefined) return {}
      return resp.json()
    })

    if (animeInfo.episodes instanceof Array && epArray) {
      for (let i = 1; i <= epArray.total; i++) {
        animeInfo.episodes.push({
          number: i,
          slug: `${slug}/${i}`,
          url: JKANIME_BASE + `${slug}/${i}`,
          thumbnail: `https://cdn.jkdesa.com/assets/images/animes/video/image_thumb/${epArray.data[i - 1]?.image}`
        })
      }
    }

    // $("#c").children().each((_, el) => {
    //   if ($(el).tagName !== 'b') animeInfo.alternative_titles.push($(el).text());
    // })

    const ytID = $(".animeTrailer")?.attr('data-yt')
    if (ytID) animeInfo.trailer = `https://www.youtube.com/watch?v=${ytID}`

    // Relacionados
    const relatedParent = $("div.temporadas_tab.animetab > div > div.col.col-lg-6 > h3")?.first().parent()
    const relatedCategories = $(relatedParent).find("h5")
    const relatedAnimes = [];
    relatedCategories.each((_, cat) => {
      const relation = $(cat).text().trim();

      $(cat).nextUntil("h5").filter("a").each((_, link) => {
        const $link = $(link);
        relatedAnimes.push({
          title: $link.text().trim(),
          relation,
          slug: $link.attr("href")?.match(/\/([^/]+)(?:\/)?$/)?.[1],
          url: $link.attr("href")
        });
      });
    });

    $("#relacionados div.anime__item > a").each((_,el)=>{
      relatedAnimes.push({
        title: $(el).attr('title'),
        relation: "TE RECOMENDAMOS",
        slug: $(el).attr("href")?.match(/\/([^/]+)(?:\/)?$/)?.[1],
        url: $(el).attr("href")
      });
    })

    // Asigna la propiedad si hay elementos
    if (relatedAnimes.length > 0) animeInfo.related = relatedAnimes;

    return animeInfo;
  } catch (error) {
    console.error("Error al obtener la información del anime", slug, error);
    throw error
  }
}
//Adapted from TypeScript from https://github.com/ahmedrangel/animeflv-api/blob/main/server/utils/scrapers/getEpisodeLinks.ts
async function SearchAnimesBySpecificURL(jkanimeURL) {
  try {
    const html = await fetch(decodeURIComponent(jkanimeURL)).then((resp) => {
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

    const pageSelector = $("#jkanime > div > div.row.justify-content-between.filters-cont > main > nav > ul > li");
    const getNextAndPrevPages = (selector) => {
      const aTagValue = selector.last().prev().find("a").text();
      const aRef = selector.eq(0).children("a").attr("href");

      let foundPages = 0;
      let previousPage = "";
      let nextPage = "";

      if (Number(aTagValue) === 0) foundPages = 1;
      else foundPages = Number(aTagValue);

      if (aRef === "#" || foundPages == 1) previousPage = null;
      else previousPage = JKANIME_BASE + aRef;

      if (selector.last().children("a").attr("href") === "#" || foundPages == 1) nextPage = null;
      else nextPage = JKANIME_BASE + selector.last().children("a").attr("href");

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
            cover: `${JKANIME_BASE}${$(el).find("img").attr("src")}`,
            //synopsis: $(el).find("div.Description > p").eq(1).text(),
            //rating: $(el).find("article > div > p:nth-child(2) > span.Vts.fa-star").text(),
            slug: $(el).find("a").attr("href").replace("/anime/", ""),
            //type: $(el).find("a > div > span.Type").text(),
            url: JKANIME_BASE + ($(el).find("a").attr("href"))
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
  return SearchAnimesBySpecificURL(`${JKANIME_BASE}/directorio?estado=emision`).then((data) => {
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
