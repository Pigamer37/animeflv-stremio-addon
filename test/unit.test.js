//Pure helpers: no network, no fixtures.
const { describe, it } = require("node:test")
const assert = require("node:assert/strict")
const { getServerTitle } = require("../lib/streamParsing.js")

describe("getServerTitle", () => {
  it("maps embed hosts to the names stream extraction expects", () => {
    assert.equal(getServerTitle("yourupload.com"), "YourUpload")
    assert.equal(getServerTitle("mp4upload.com"), "MP4Upload")
  })
})
