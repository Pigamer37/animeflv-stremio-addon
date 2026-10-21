//What Stremio clients may keep (Cache-Control). Metas list the episodes, so they must refresh soon after one airs;
//an empty answer (e.g. an episode the sites haven't uploaded yet) must not stick for a day.
//Before, everything was kept a day plus another day stale (catalogs 3 days), so a new episode could take up to
//2 days to show up.
module.exports = {
  meta: "max-age=600, stale-while-revalidate=600, stale-if-error=259200",
  catalog: "max-age=3600, stale-while-revalidate=3600, stale-if-error=259200",
  streams: "max-age=10800, stale-while-revalidate=3600, stale-if-error=259200",
  failure: "max-age=300, stale-if-error=259200",
}
