import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"

export function createStore(file, seed) {
  let data = readOrSeed(file, seed)
  let chain = Promise.resolve()

  function update(change) {
    const run = chain.then(() => {
      data = change(data)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(data))
      return data
    })
    chain = run.then(() => {}, () => {})
    return run
  }

  return {
    read() {
      return data
    },
    update,
  }
}

function readOrSeed(file, seed) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return seed()
  }
}
