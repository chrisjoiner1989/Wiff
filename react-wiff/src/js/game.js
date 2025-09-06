import { putGame, getGames, deleteGame } from './db.js'

export function newGameTemplate() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    home: { id: null, name: 'Home', players: [] },
    away: { id: null, name: 'Away', players: [] },
    settings: { innings: 6, mercyRule: 10, maxInnings: 12 },
    weather: { temperature: null, humidity: null, windSpeed: null, windDirection: null, conditions: null, notes: '' },
    field: { name: 'Home Field', dimensions: { leftField: 200, centerField: 250, rightField: 200, foulLines: 150 }, surface: 'grass', conditions: 'good' },
    tournament: { id: null, round: null, gameNumber: null },
    state: {
      inning: 1,
      half: 'top',
      outs: 0,
      balls: 0,
      strikes: 0,
      battingTeam: 'away',
      lineupIndex: { home: 0, away: 0 },
      scoreByInning: { home: {}, away: {} },
      total: { home: 0, away: 0 },
      status: 'in_progress',
      events: [],
      bases: { first: null, second: null, third: null },
      currentBatter: null,
      fieldingPositions: { pitcher: null, catcher: null, first: null, second: null, third: null, shortstop: null, left: null, center: null, right: null },
      currentPitch: { type: null, speed: null, location: null, result: null },
      defensiveShift: { type: 'standard', positions: {} },
    },
  }
}

export function recordEvent(game, ev) {
  game.state.events.push({ ...ev, ts: new Date().toISOString() })
  return game
}

export function addRun(game, n = 1) {
  const t = game.state.battingTeam
  const inn = game.state.inning
  game.state.scoreByInning[t][inn] = (game.state.scoreByInning[t][inn] || 0) + n
  game.state.total[t] += n
  recordEvent(game, { type: 'run', team: t, runs: n, inning: inn })
  checkMercyRule(game)
  return game
}

export function nextBatter(game) {
  const t = game.state.battingTeam
  game.state.lineupIndex[t] = (game.state.lineupIndex[t] + 1) % Math.max(1, game[t].players.length || 1)
}

export function resetCount(game) {
  game.state.balls = 0
  game.state.strikes = 0
}

export function advanceHalfInning(game) {
  resetCount(game)
  game.state.outs = 0
  if (game.state.half === 'top') {
    game.state.half = 'bottom'
    game.state.battingTeam = 'home'
  } else {
    game.state.half = 'top'
    game.state.battingTeam = 'away'
    game.state.inning += 1
    if (game.state.inning > game.settings.innings) {
      game.state.status = 'final'
      recordEvent(game, { type: 'game_end' })
    }
  }
}

export function onStrike(game) {
  if (game.state.status === 'final') return game
  game.state.strikes = Math.min(2, game.state.strikes + 1)
  if (game.state.strikes === 2) {
    game.state.outs += 1
    recordEvent(game, { type: 'strikeout', team: game.state.battingTeam })
    resetCount(game)
    nextBatter(game)
    if (game.state.outs >= 3) advanceHalfInning(game)
  }
  return game
}

export function onBall(game) {
  if (game.state.status === 'final') return game
  game.state.balls = Math.min(3, game.state.balls + 1)
  if (game.state.balls === 3) {
    recordEvent(game, { type: 'walk', team: game.state.battingTeam })
    resetCount(game)
    nextBatter(game)
  }
  return game
}

export function onOut(game) {
  if (game.state.status === 'final') return game
  game.state.outs += 1
  recordEvent(game, { type: 'out', team: game.state.battingTeam })
  resetCount(game)
  nextBatter(game)
  if (game.state.outs >= 3) advanceHalfInning(game)
  checkMercyRule(game)
  return game
}

export function onHit(game) {
  if (game.state.status === 'final') return game
  advanceRunners(game, 1)
  game.state.bases.first = game.state.currentBatter
  recordEvent(game, { type: 'hit', team: game.state.battingTeam, player: game.state.currentBatter, bases: 1 })
  resetCount(game)
  nextBatter(game)
  return game
}

export function onSingle(game) { return baseHit(game, 1) }
export function onDouble(game) { return baseHit(game, 2) }
export function onTriple(game) { return baseHit(game, 3) }
export function onHomeRun(game) { return baseHit(game, 4) }
export function onError(game) { return baseHit(game, 1, true) }

function baseHit(game, bases, isError = false) {
  if (game.state.status === 'final') return game
  advanceRunners(game, bases)
  if (bases < 4) {
    if (bases === 1) game.state.bases.first = game.state.currentBatter
    if (bases === 2) game.state.bases.second = game.state.currentBatter
    if (bases === 3) game.state.bases.third = game.state.currentBatter
  }
  recordEvent(game, { type: isError ? 'error' : bases === 4 ? 'home_run' : `hit_${bases}b`, team: game.state.battingTeam, player: game.state.currentBatter, bases })
  resetCount(game)
  nextBatter(game)
  return game
}

function advanceRunners(game, basesToAdvance) {
  const order = ['third', 'second', 'first']
  for (const base of order) {
    const runner = game.state.bases[base]
    if (!runner) continue
    const newBaseIndex = order.indexOf(base) + basesToAdvance
    if (newBaseIndex >= order.length) {
      addRun(game, 1)
      game.state.bases[base] = null
    } else {
      const target = order[newBaseIndex]
      game.state.bases[target] = runner
      game.state.bases[base] = null
    }
  }
}

function checkMercyRule(game) {
  const inningThreshold = 4
  if (game.state.inning < inningThreshold) return
  const diff = Math.abs(game.state.total.home - game.state.total.away)
  if (diff >= game.settings.mercyRule) {
    game.state.status = 'final'
    recordEvent(game, { type: 'mercy_rule_end' })
  }
}

export async function saveGame(game) { await putGame(game); return game }
export async function loadGames() { return await getGames() }
export async function removeGame(id) { return await deleteGame(id) }

