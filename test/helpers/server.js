//Starts index.js on a free port and resolves once it is listening. offline: true makes every fetch() fail.
const { spawn } = require("node:child_process")
const path = require("node:path")

exports.startServer = function ({ offline = false } = {}) {
  const port = 30000 + Math.floor(Math.random() * 20000)
  const args = (offline) ? ["--require", path.join(__dirname, "no-network.js"), "index.js"] : ["index.js"]
  const proc = spawn(process.execPath, args, { cwd: path.join(__dirname, "../.."), env: { ...process.env, PORT: port } })
  let output = ""
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`server did not start:\n${output}`)), 20000)
    proc.on("exit", (code) => reject(Error(`server exited with ${code}:\n${output}`)))
    const onData = (data) => {
      output += data
      if (output.includes(`listening on port ${port}`)) {
        clearTimeout(timer)
        resolve({
          get: (route) => fetch(`http://127.0.0.1:${port}${route}`),
          stop: () => proc.kill(),
          output: () => output
        })
      }
    }
    proc.stdout.on("data", onData)
    proc.stderr.on("data", onData)
  })
}
