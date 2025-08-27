// game.js
import { putGame, getGames, deleteGame } from "./db.js";

export function newGameTemplate() {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    home: { id: null, name: "Home", players: [] },
    away: { id: null, name: "Away", players: [] },
    settings: {
      innings: 6,
      mercyRule: 10, // 10-run mercy rule after 4 innings
      maxInnings: 12,
    },
    // Weather conditions (crucial for wiffle ball!)
    weather: {
      temperature: null, // in Fahrenheit
      humidity: null, // percentage
      windSpeed: null, // mph
      windDirection: null, // N, NE, E, SE, S, SW, W, NW
      conditions: null, // sunny, cloudy, rainy, etc.
      notes: "",
    },
    // Field information
    field: {
      name: "Home Field",
      dimensions: {
        leftField: 200, // feet
        centerField: 250,
        rightField: 200,
        foulLines: 150,
      },
      surface: "grass", // grass, turf, dirt
      conditions: "good", // good, wet, dry, etc.
    },
    // Tournament/League info
    tournament: {
      id: null,
      round: null,
      gameNumber: null,
    },
    state: {
      inning: 1,
      half: "top", // top | bottom
      outs: 0,
      balls: 0,
      strikes: 0,
      battingTeam: "away",
      lineupIndex: { home: 0, away: 0 },
      scoreByInning: { home: {}, away: {} },
      total: { home: 0, away: 0 },
      status: "in_progress",
      events: [], // play-by-play
      // Base running system
      bases: {
        first: null, // player ID or null
        second: null, // player ID or null
        third: null, // player ID or null
      },
      // Current batter
      currentBatter: null,
      // Fielding positions
      fieldingPositions: {
        pitcher: null,
        catcher: null,
        first: null,
        second: null,
        third: null,
        shortstop: null,
        left: null,
        center: null,
        right: null,
      },
      // Pitch tracking
      currentPitch: {
        type: null, // fastball, curve, slider, etc.
        speed: null, // mph
        location: null, // strike zone coordinates
        result: null, // ball, strike, hit, etc.
      },
      // Defensive positioning
      defensiveShift: {
        type: "standard", // standard, shift_left, shift_right, infield_in, etc.
        positions: {}, // specific player positions
      },
    },
  };
}

export function recordEvent(game, ev) {
  game.state.events.push({ ...ev, ts: new Date().toISOString() });
  return game;
}

export function addRun(game, n = 1) {
  const t = game.state.battingTeam;
  const inn = game.state.inning;
  game.state.scoreByInning[t][inn] =
    (game.state.scoreByInning[t][inn] || 0) + n;
  game.state.total[t] += n;
  recordEvent(game, { type: "run", team: t, runs: n, inning: inn });

  // Check mercy rule after each run
  checkMercyRule(game);
  return game;
}

export function nextBatter(game) {
  const t = game.state.battingTeam;
  game.state.lineupIndex[t] =
    (game.state.lineupIndex[t] + 1) % Math.max(1, game[t].players.length || 1);
}

export function resetCount(game) {
  game.state.balls = 0;
  game.state.strikes = 0;
}

export function advanceHalfInning(game) {
  resetCount(game);
  game.state.outs = 0;
  if (game.state.half === "top") {
    game.state.half = "bottom";
    game.state.battingTeam = "home";
  } else {
    game.state.half = "top";
    game.state.battingTeam = "away";
    game.state.inning += 1;
    if (game.state.inning > game.settings.innings) {
      game.state.status = "final";
      recordEvent(game, { type: "game_end" });
    }
  }
}

export function onStrike(game) {
  if (game.state.status === "final") return game;
  game.state.strikes = Math.min(2, game.state.strikes + 1);
  if (game.state.strikes === 2) {
    game.state.outs += 1;
    recordEvent(game, { type: "strikeout", team: game.state.battingTeam });
    resetCount(game);
    nextBatter(game);
    if (game.state.outs >= 3) advanceHalfInning(game);
  }
  return game;
}

export function onBall(game) {
  if (game.state.status === "final") return game;
  game.state.balls = Math.min(3, game.state.balls + 1);
  if (game.state.balls === 3) {
    recordEvent(game, { type: "walk", team: game.state.battingTeam });
    resetCount(game);
    nextBatter(game);
  }
  return game;
}

export function onOut(game) {
  if (game.state.status === "final") return game;
  game.state.outs += 1;
  recordEvent(game, { type: "out", team: game.state.battingTeam });
  resetCount(game);
  nextBatter(game);
  if (game.state.outs >= 3) advanceHalfInning(game);

  // Check mercy rule after each out
  checkMercyRule(game);
  return game;
}

// Advanced hit types with base running
export function onHit(game) {
  if (game.state.status === "final") return game;

  // Generic hit - treat as single by default
  // Advance all runners by 1 base
  advanceRunners(game, 1);

  // Put batter on first
  game.state.bases.first = game.state.currentBatter;

  recordEvent(game, {
    type: "hit",
    team: game.state.battingTeam,
    player: game.state.currentBatter,
    bases: 1,
  });

  resetCount(game);
  nextBatter(game);
  return game;
}

export function onSingle(game) {
  if (game.state.status === "final") return game;

  // Advance all runners by 1 base
  advanceRunners(game, 1);

  // Put batter on first
  game.state.bases.first = game.state.currentBatter;

  recordEvent(game, {
    type: "single",
    team: game.state.battingTeam,
    player: game.state.currentBatter,
    bases: 1,
  });

  resetCount(game);
  nextBatter(game);
  return game;
}

export function onDouble(game) {
  if (game.state.status === "final") return game;

  // Advance all runners by 2 bases
  advanceRunners(game, 2);

  // Put batter on second
  game.state.bases.second = game.state.currentBatter;

  recordEvent(game, {
    type: "double",
    team: game.state.battingTeam,
    player: game.state.currentBatter,
    bases: 2,
  });

  resetCount(game);
  nextBatter(game);
  return game;
}

export function onTriple(game) {
  if (game.state.status === "final") return game;

  // Advance all runners by 3 bases
  advanceRunners(game, 3);

  // Put batter on third
  game.state.bases.third = game.state.currentBatter;

  recordEvent(game, {
    type: "triple",
    team: game.state.battingTeam,
    player: game.state.currentBatter,
    bases: 3,
  });

  resetCount(game);
  nextBatter(game);
  return game;
}

export function onHomeRun(game) {
  if (game.state.status === "final") return game;

  // All runners score + batter scores
  const runnersOnBase = countRunnersOnBase(game);
  addRun(game, runnersOnBase + 1);

  // Clear all bases
  clearBases(game);

  recordEvent(game, {
    type: "home_run",
    team: game.state.battingTeam,
    player: game.state.currentBatter,
    runs: runnersOnBase + 1,
  });

  resetCount(game);
  nextBatter(game);
  return game;
}

export function onError(game, errorType = "fielding") {
  if (game.state.status === "final") return game;

  recordEvent(game, {
    type: "error",
    team: game.state.battingTeam,
    errorType: errorType,
  });

  // Batter reaches first on error
  game.state.bases.first = game.state.currentBatter;

  resetCount(game);
  nextBatter(game);
  return game;
}

// Base running helper functions
function advanceRunners(game, bases) {
  // Start from third base and work backwards to avoid conflicts
  if (game.state.bases.third) {
    addRun(game, 1);
    game.state.bases.third = null;
  }

  if (game.state.bases.second) {
    if (bases >= 2) {
      addRun(game, 1);
      game.state.bases.second = null;
    } else {
      game.state.bases.third = game.state.bases.second;
      game.state.bases.second = null;
    }
  }

  if (game.state.bases.first) {
    if (bases >= 3) {
      addRun(game, 1);
      game.state.bases.first = null;
    } else if (bases >= 2) {
      game.state.bases.third = game.state.bases.first;
      game.state.bases.first = null;
    } else {
      game.state.bases.second = game.state.bases.first;
      game.state.bases.first = null;
    }
  }
}

function countRunnersOnBase(game) {
  let count = 0;
  if (game.state.bases.first) count++;
  if (game.state.bases.second) count++;
  if (game.state.bases.third) count++;
  return count;
}

function clearBases(game) {
  game.state.bases.first = null;
  game.state.bases.second = null;
  game.state.bases.third = null;
}

// Check for mercy rule
export function checkMercyRule(game) {
  if (game.state.inning >= 4) {
    const homeScore = game.state.total.home;
    const awayScore = game.state.total.away;
    const runDiff = Math.abs(homeScore - awayScore);

    if (runDiff >= game.settings.mercyRule) {
      game.state.status = "final";
      recordEvent(game, {
        type: "mercy_rule",
        winningTeam: homeScore > awayScore ? "home" : "away",
        runDifference: runDiff,
      });
    }
  }
  return game;
}

// Weather impact functions
export function getWindImpact(game, hitType) {
  if (!game.weather?.windSpeed || game.weather.windSpeed < 5) return 1.0;

  const windSpeed = game.weather.windSpeed;
  const direction = game.weather.windDirection;

  // Wind-aided home runs
  if (hitType === "home_run") {
    if (direction === "out" && windSpeed > 10) return 1.2; // Wind blowing out
    if (direction === "in" && windSpeed > 10) return 0.8; // Wind blowing in
  }

  // Wind impact on fly balls
  if (hitType === "fly_ball") {
    if (windSpeed > 15) return 1.3; // Strong wind
    if (windSpeed > 10) return 1.15; // Moderate wind
  }

  return 1.0;
}

export function updateWeather(game, weatherData) {
  game.weather = { ...game.weather, ...weatherData };
  recordEvent(game, {
    type: "weather_update",
    weather: game.weather,
    timestamp: new Date().toISOString(),
  });
  return game;
}

export function updateFieldConditions(game, fieldData) {
  game.field = { ...game.field, ...fieldData };
  recordEvent(game, {
    type: "field_update",
    field: game.field,
    timestamp: new Date().toISOString(),
  });
  return game;
}

// Pitch tracking functions
export function recordPitch(game, pitchData) {
  game.state.currentPitch = { ...game.state.currentPitch, ...pitchData };

  // Auto-determine result based on count
  if (game.state.strikes === 2 && pitchData.result === "strike") {
    onStrike(game);
  } else if (game.state.balls === 3 && pitchData.result === "ball") {
    onBall(game);
  }

  recordEvent(game, {
    type: "pitch",
    pitch: game.state.currentPitch,
    count: `${game.state.balls}-${game.state.strikes}`,
  });

  return game;
}

// Defensive positioning functions
export function setDefensiveShift(game, shiftType, positions = {}) {
  game.state.defensiveShift = {
    type: shiftType,
    positions: { ...positions },
    timestamp: new Date().toISOString(),
  };

  recordEvent(game, {
    type: "defensive_shift",
    shift: game.state.defensiveShift,
  });

  return game;
}

export function getShiftEffectiveness(game, hitType, hitLocation) {
  const shift = game.state.defensiveShift;
  if (shift.type === "standard") return 1.0;

  // Analyze if shift was effective
  let effectiveness = 1.0;

  if (shift.type === "shift_left" && hitLocation === "right_side") {
    effectiveness = 0.7; // Shift was effective
  } else if (shift.type === "shift_right" && hitLocation === "left_side") {
    effectiveness = 0.7; // Shift was effective
  } else if (shift.type === "infield_in" && hitType === "ground_ball") {
    effectiveness = 1.3; // Infield in was effective
  }

  return effectiveness;
}

export async function saveGame(game) {
  await putGame(game);
  return game;
}

export async function loadGames() {
  return getGames();
}

export async function removeGame(id) {
  return deleteGame(id);
}
