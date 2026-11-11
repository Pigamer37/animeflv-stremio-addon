//Records every fetch() a scraper makes into a JSON file, or replays it so tests run offline and deterministically.
const fs = require("node:fs")
const realFetch = globalThis.fetch

const keyOf = (input, init) => {
  const url = String(input instanceof Request ? input.url : input)
  const method = (init?.method || "GET").toUpperCase()
  return (method === "GET") ? url : `${method} ${url} ${init?.body || ""}`
}

exports.record = function (fixtures) {
  globalThis.fetch = async (input, init) => {
    const resp = await realFetch(input, init)
    const body = await resp.text()
    fixtures[keyOf(input, init)] = { status: resp.status, type: resp.headers.get("content-type"), body }
    return new Response(body, { status: resp.status, headers: { "content-type": resp.headers.get("content-type") || "text/html" } })
  }
}

exports.replay = function (fixtures) {
  globalThis.fetch = async (input, init) => {
    const entry = fixtures[keyOf(input, init)]
    if (!entry) throw Error(`No recorded response for ${keyOf(input, init)} (run "npm run test:record")`)
    return new Response(entry.body, { status: entry.status, headers: { "content-type": entry.type || "text/html" } })
  }
}

exports.restore = () => { globalThis.fetch = realFetch }
exports.load = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
exports.save = (file, fixtures) => fs.writeFileSync(file, JSON.stringify(fixtures, null, 1) + "\n")
