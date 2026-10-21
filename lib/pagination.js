//Reads a paginated listing (e.g. a site's "airing" pages) until a page is empty or only repeats entries already seen.
//Only reading page 1 used to hide most airing shows: AnimeAV1 lists 66 over 4 pages.
exports.CollectPages = async function (getPage, maxPages = 10) {
  const all = [], seen = new Set()
  for (let page = 1; page <= maxPages; page++) {
    const items = await getPage(page).catch((err) => {
      if (page === 1) throw err
      return [] //keep what we have if a later page fails
    })
    const fresh = items.filter((i) => !seen.has(i.slug))
    if (fresh.length < 1) break
    fresh.forEach((i) => seen.add(i.slug))
    all.push(...fresh)
  }
  return all
}

//Like Promise.allSettled(items.map(fn)) but with at most `limit` calls running at once: opening every airing
//show's page in parallel (90+ for JKAnime) gets the addon rate limited (HTTP 429) by the sites
exports.SettleLimited = async function (items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]).then((value) => ({ status: "fulfilled", value }), (reason) => ({ status: "rejected", reason }))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
