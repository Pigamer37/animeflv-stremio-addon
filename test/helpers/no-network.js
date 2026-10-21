//Preloaded with --require: any outgoing fetch() fails, so the server can be tested without touching the sites.
globalThis.fetch = async (input) => { throw Error(`network disabled in tests: ${input}`) }
