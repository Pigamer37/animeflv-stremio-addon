//Pure helpers: no network, no fixtures.
const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const { getServerTitle } = require("../lib/streamParsing.js")
const { ParseTitle } = require("../routes/latanime.js")

describe("getServerTitle", () => {
  it("maps embed hosts to the names stream extraction expects", () => {
    assert.equal(getServerTitle("yourupload.com"), "YourUpload")
    assert.equal(getServerTitle("mp4upload.com"), "MP4Upload")
  })
})

describe("Latanime ParseTitle", () => {
  it("groups the sub and dub entries of a season under one key", () => {
    assert.deepEqual(ParseTitle("Spy x Family Latino"), { key: "spyxfamily|1", base: "Spy x Family", dubLang: "lat" })
    assert.deepEqual(ParseTitle("Spy x Family Temporada 3"), { key: "spyxfamily|3", base: "Spy x Family", dubLang: undefined })
    assert.deepEqual(ParseTitle("Spy x Family S2 Castellano"), { key: "spyxfamily|2", base: "Spy x Family", dubLang: "esp" })
    assert.equal(ParseTitle("Dr. Stone Latino S2").key, "drstone|2")
    assert.equal(ParseTitle("Kimetsu no Yaiba 1080p").key, "kimetsunoyaiba|1")
  })
})
