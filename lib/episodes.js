//Episode release dates for sites that only give episode numbers.
//They used to be "today" for the latest episode and a day earlier for each previous one, recomputed on every refresh,
//so a show finished years ago looked like it had a new episode every day. These are anchored to the series' start
//date instead, so they stay the same between refreshes.
const DAY = 86400000
const HOUR = 3600000

/**
 * Release date of the episode at `index` (0 = oldest) out of `total` released ones.
 * - start and end known (e.g. AnimeAV1): spread evenly between them
 * - only start known: one episode a week from it
 * - never later than now, keeping the order (long or irregular shows can outrun a weekly estimate)
 * - no start: the old estimate (latest one "now"), the best we can do
 */
exports.EstimateReleased = function (index, total, { start, end, now = Date.now() } = {}) {
  const startTime = new Date(start).getTime(), endTime = new Date(end).getTime()
  let time
  if (isNaN(startTime)) time = now - (total - 1 - index) * DAY
  else if (!isNaN(endTime) && endTime > startTime && total > 1) time = startTime + (endTime - startTime) * index / (total - 1)
  else time = startTime + 7 * DAY * index
  return new Date(Math.min(time, now - (total - 1 - index) * HOUR))
}

//"Temporada Invierno 2022" -> the first day of that anime season (winter = January, spring = April...), in UTC
exports.ParseAnimeSeason = function (text) {
  const match = text?.toLowerCase().match(/(invierno|primavera|verano|oto[ñn]o)\s+(\d{4})/)
  if (!match) return undefined
  const month = { invierno: 0, primavera: 3, verano: 6, "otoño": 9, otono: 9 }[match[1]]
  return new Date(Date.UTC(Number(match[2]), month, 1))
}

//Position of each episode number among all of them, oldest first (lists can come newest first, start at 0 or skip)
exports.Ranks = (numbers) => {
  const sorted = [...numbers].map(Number).sort((a, b) => a - b)
  return (number) => sorted.indexOf(Number(number))
}
