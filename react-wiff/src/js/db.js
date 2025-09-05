// db.js - a minimal IndexedDB helper (ported)
const DB_NAME = 'wiff-db'
const DB_VERSION = 1
const STORE_TEAMS = 'teams'
const STORE_GAMES = 'games'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_TEAMS)) {
        db.createObjectStore(STORE_TEAMS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_GAMES)) {
        db.createObjectStore(STORE_GAMES, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(storeName, mode, cb) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const result = cb(store)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export async function putTeam(team) {
  return withStore(STORE_TEAMS, 'readwrite', (store) => store.put(team))
}
export async function getTeams() {
  return withStore(STORE_TEAMS, 'readonly', (store) => {
    const all = []
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor) {
        all.push(cursor.value)
        cursor.continue()
      }
    }
    return all
  })
}
export async function deleteTeam(id) {
  return withStore(STORE_TEAMS, 'readwrite', (store) => store.delete(id))
}

export async function putGame(game) {
  return withStore(STORE_GAMES, 'readwrite', (store) => store.put(game))
}
export async function getGames() {
  return withStore(STORE_GAMES, 'readonly', (store) => {
    const all = []
    store.openCursor().onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor) {
        all.push(cursor.value)
        cursor.continue()
      }
    }
    return all
  })
}
export async function getGame(id) {
  return withStore(STORE_GAMES, 'readonly', (store) => {
    const r = store.get(id)
    r.onsuccess = () => {}
    return r
  }).then((r) => r.result ?? null)
}
export async function deleteGame(id) {
  return withStore(STORE_GAMES, 'readwrite', (store) => store.delete(id))
}

